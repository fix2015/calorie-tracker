/**
 * Calorize Pro billing (src/routes/billing.js) with RevenueCat's REST API faked.
 * Requires a running PostgreSQL instance. Run: node --test src/tests/billing.test.js
 */
process.env.REVENUECAT_API_URL = 'http://rc.test';
process.env.REVENUECAT_SECRET_KEY = 'sk_test';
process.env.REVENUECAT_WEBHOOK_AUTH = 'Bearer whsec_test';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const prisma = require('../utils/prisma');
const { signAccessToken } = require('../utils/jwt');
const app = require('../index');
const { proFromSubscriber } = require('../routes/billing');

const realFetch = global.fetch;
let rcEntitlements = {};
global.fetch = async (url, opts) => {
  if (String(url).startsWith('http://rc.test/')) {
    assert.strictEqual(opts.headers.Authorization, 'Bearer sk_test');
    return new Response(JSON.stringify({ subscriber: { entitlements: rcEntitlements } }), { status: 200 });
  }
  return realFetch(url, opts);
};

let server;
let baseUrl;
let user;
let token;

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api/billing`;
  user = await prisma.user.create({ data: { email: `billing_${crypto.randomUUID().slice(0, 8)}@example.com`, name: 'Billing Test' } });
  token = signAccessToken(user.id);
});

after(async () => {
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  server.close();
  global.fetch = realFetch;
});

describe('proFromSubscriber', () => {
  test('active, lifetime and missing entitlement', () => {
    const exp = '2027-01-01T00:00:00Z';
    assert.deepStrictEqual(proFromSubscriber({ entitlements: { pro: { expires_date: exp, product_identifier: 'calorize.pro.yearly' } } }),
      { proUntil: new Date(exp), proProductId: 'calorize.pro.yearly' });
    assert.strictEqual(proFromSubscriber({ entitlements: { pro: { expires_date: null } } }).proUntil.getUTCFullYear(), 9999);
    assert.deepStrictEqual(proFromSubscriber({ entitlements: {} }), { proUntil: null, proProductId: null });
  });
});

describe('billing routes', () => {
  test('sync stores the pro entitlement from RevenueCat', async () => {
    const exp = new Date(Date.now() + 7 * 86400000).toISOString();
    rcEntitlements = { pro: { expires_date: exp, product_identifier: 'calorize.pro.monthly' } };
    const r = await realFetch(`${baseUrl}/sync`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.isPro, true);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    assert.strictEqual(row.proProductId, 'calorize.pro.monthly');
  });

  test('webhook rejects a wrong Authorization header', async () => {
    const r = await realFetch(`${baseUrl}/revenuecat-webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer nope' },
      body: JSON.stringify({ event: { type: 'EXPIRATION', app_user_id: user.id } }),
    });
    assert.strictEqual(r.status, 401);
  });

  test('webhook re-reads RevenueCat and clears an expired subscription', async () => {
    rcEntitlements = {};
    const r = await realFetch(`${baseUrl}/revenuecat-webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer whsec_test' },
      body: JSON.stringify({ event: { type: 'EXPIRATION', app_user_id: user.id, aliases: ['$RCAnonymousID:abc'] } }),
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).refreshed, 1);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    assert.strictEqual(row.proUntil, null);
  });
});
