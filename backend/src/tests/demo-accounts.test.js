/**
 * Sample (demo) account tests — demo users are labelled and cannot be followed or messaged.
 *
 * Uses Node.js built-in test runner. Requires a running PostgreSQL instance.
 * Run: NODE_ENV=test node --test src/tests/demo-accounts.test.js
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const app = require('../index');
const prisma = require('../utils/prisma');

const suffix = crypto.randomUUID().slice(0, 8);
const VIEWER_EMAIL = `test_${suffix}@example.com`;
const DEMO_EMAIL = `test_demo_${suffix}@calorize-demo.sample`;
const DEMO_USERNAME = `demo_${suffix}`;

let server;
let baseUrl;
let viewerToken;
let demoUserId;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${baseUrl}/api${path}`, {
    ...opts,
    headers,
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const demo = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: 'x',
      name: 'Demo Person',
      username: DEMO_USERNAME,
      isPublic: true,
      isDemo: true,
    },
  });
  demoUserId = demo.id;

  const { data } = await api('/auth/register', {
    method: 'POST',
    body: { email: VIEWER_EMAIL, password: 'TestPass123!', name: 'Viewer' },
  });
  viewerToken = data.accessToken;
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [VIEWER_EMAIL, DEMO_EMAIL] } } });
  await prisma.$disconnect();
  server.close();
});

describe('Demo accounts', () => {
  test('GET /public/u/:username includes isDemo', async () => {
    const { status, data } = await api(`/public/u/${DEMO_USERNAME}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(data.isDemo, true);
  });

  test('POST /public/u/:username/follow returns 403 for a demo user', async () => {
    assert.ok(viewerToken);
    const { status } = await api(`/public/u/${DEMO_USERNAME}/follow`, { method: 'POST', token: viewerToken });
    assert.strictEqual(status, 403);
  });

  test('POST /messages returns 403 for a demo user', async () => {
    const { status } = await api('/messages', { method: 'POST', token: viewerToken, body: { userId: demoUserId } });
    assert.strictEqual(status, 403);
  });
});
