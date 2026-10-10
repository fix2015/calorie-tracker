/**
 * Content reporting + moderation (App Store guideline 1.2):
 *   POST /api/reports → 201, duplicate → 409, auto-hide after 3 OPEN reports,
 *   admin resolve → visible again.
 *
 * Requires a running PostgreSQL instance (same as main-flow.test.js).
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const app = require('../index');
const prisma = require('../utils/prisma');

let server;
let baseUrl;

const tag = crypto.randomUUID().slice(0, 8);
const emails = ['owner', 'r1', 'r2', 'r3'].map((n) => `report_${n}_${tag}@example.com`);
const tokens = {};
const ids = {};
let mealId;

const ADMIN_AUTH = 'Basic ' + Buffer.from(
  `${process.env.ADMIN_USER || 'admin'}:${process.env.ADMIN_PASS || 'caltrack2026!'}`,
).toString('base64');

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...opts,
    headers,
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const report = (who, body) => api('/reports', { method: 'POST', token: tokens[who], body });

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (const [i, who] of ['owner', 'r1', 'r2', 'r3'].entries()) {
    const { status, data } = await api('/auth/register', {
      method: 'POST',
      body: { email: emails[i], password: 'TestPass123!', name: `Report ${who}` },
    });
    assert.strictEqual(status, 201, `register ${who}`);
    tokens[who] = data.accessToken;
    ids[who] = data.user.id;
  }

  // Owner: public profile + one public meal
  const prof = await api('/users/me', { method: 'PATCH', token: tokens.owner, body: { isPublic: true } });
  assert.strictEqual(prof.status, 200);
  const meal = await api('/meals/manual', {
    method: 'POST',
    token: tokens.owner,
    body: { name: `Reportable ${tag}`, calories: 400, proteinG: 20, carbsG: 40, fatG: 10 },
  });
  assert.strictEqual(meal.status, 201);
  mealId = meal.data.id;
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
  server.close();
});

async function trendingHasMeal() {
  const { status, data } = await api('/public/trending?limit=48');
  assert.strictEqual(status, 200);
  return data.meals.some((m) => m.id === mealId);
}

describe('POST /api/reports', () => {
  test('requires auth', async () => {
    const { status } = await api('/reports', {
      method: 'POST',
      body: { targetType: 'MEAL', targetId: mealId, reason: 'SPAM' },
    });
    assert.strictEqual(status, 401);
  });

  test('rejects invalid payload with 400', async () => {
    const { status } = await report('r1', { targetType: 'POST', targetId: mealId, reason: 'SPAM' });
    assert.strictEqual(status, 400);
  });

  test('404 for a missing target', async () => {
    const { status } = await report('r1', { targetType: 'MEAL', targetId: 'does-not-exist', reason: 'SPAM' });
    assert.strictEqual(status, 404);
  });

  test('cannot report your own content', async () => {
    const { status } = await report('owner', { targetType: 'MEAL', targetId: mealId, reason: 'SPAM' });
    assert.strictEqual(status, 400);
  });

  test('creates a report → 201 OPEN', async () => {
    assert.strictEqual(await trendingHasMeal(), true, 'meal is visible before reports');
    const { status, data } = await report('r1', {
      targetType: 'MEAL', targetId: mealId, reason: 'INAPPROPRIATE', note: 'test note',
    });
    assert.strictEqual(status, 201);
    assert.ok(data.id);
    assert.strictEqual(data.status, 'OPEN');
  });

  test('duplicate report from the same user → 409', async () => {
    const { status } = await report('r1', { targetType: 'MEAL', targetId: mealId, reason: 'SPAM' });
    assert.strictEqual(status, 409);
  });

  test('can report a user', async () => {
    const { status } = await report('r1', { targetType: 'USER', targetId: ids.owner, reason: 'HARASSMENT' });
    assert.strictEqual(status, 201);
  });
});

describe('Auto-hide and admin moderation', () => {
  test('meal stays visible with 2 open reports', async () => {
    const { status } = await report('r2', { targetType: 'MEAL', targetId: mealId, reason: 'SPAM' });
    assert.strictEqual(status, 201);
    assert.strictEqual(await trendingHasMeal(), true);
  });

  test('3rd report hides the meal from trending, profile and detail', async () => {
    const { status } = await report('r3', { targetType: 'MEAL', targetId: mealId, reason: 'OTHER' });
    assert.strictEqual(status, 201);

    assert.strictEqual(await trendingHasMeal(), false);

    const detail = await api(`/public/meals/${mealId}`);
    assert.strictEqual(detail.status, 404);

    const me = await api('/auth/me', { token: tokens.owner });
    const profileMeals = await api(`/public/u/${me.data.username}/meals`);
    assert.strictEqual(profileMeals.status, 200);
    assert.ok(!profileMeals.data.meals.some((m) => m.id === mealId));
  });

  test('admin endpoints require admin auth', async () => {
    const { status } = await api('/admin/reports', { token: tokens.r1 });
    assert.strictEqual(status, 401);
  });

  test('admin lists open reports and resolving one makes the meal visible again', async () => {
    const list = await api('/admin/reports', { headers: { Authorization: ADMIN_AUTH } });
    assert.strictEqual(list.status, 200);
    const mealReports = list.data.reports.filter((r) => r.targetId === mealId);
    assert.strictEqual(mealReports.length, 3);
    assert.strictEqual(mealReports[0].openReportsForTarget, 3);
    assert.strictEqual(mealReports[0].target.id, mealId);

    const bad = await api(`/admin/reports/${mealReports[0].id}`, {
      method: 'PATCH', headers: { Authorization: ADMIN_AUTH }, body: { status: 'NOPE' },
    });
    assert.strictEqual(bad.status, 400);

    const resolved = await api(`/admin/reports/${mealReports[0].id}`, {
      method: 'PATCH', headers: { Authorization: ADMIN_AUTH }, body: { status: 'RESOLVED' },
    });
    assert.strictEqual(resolved.status, 200);
    assert.strictEqual(resolved.data.status, 'RESOLVED');

    assert.strictEqual(await trendingHasMeal(), true);
    const detail = await api(`/public/meals/${mealId}`);
    assert.strictEqual(detail.status, 200);
  });
});
