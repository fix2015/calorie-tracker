/**
 * Explicit Terms of Use agreement (App Store guideline 1.2): registration and account-creating social
 * sign-in require `acceptedTerms: true`, store termsAcceptedAt, and accounts that never accepted see the
 * agreement again (GET /auth/me → needsTerms) until they POST /auth/terms.
 *
 * Uses Node.js built-in test runner. Requires a running PostgreSQL instance.
 * Run: NODE_ENV=test node --test src/tests/terms-agreement.test.js
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const GOOGLE_WEB_ID = 'terms-web-client.apps.googleusercontent.com';
const googleKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.GOOGLE_CLIENT_IDS = GOOGLE_WEB_ID;

const app = require('../index');
const prisma = require('../utils/prisma');
const social = require('../services/socialAuth');
const { TERMS_VERSION, needsTermsAcceptance } = require('../utils/terms');

const suffix = crypto.randomUUID().slice(0, 8);
const EMAIL = `test_terms_${suffix}@example.com`;
const GOOGLE_EMAIL = `test_terms_google_${suffix}@example.com`;
const LEGACY_EMAIL = `test_terms_legacy_${suffix}@example.com`;
const PASSWORD = 'TestPass123!';

let server;
let baseUrl;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl}/api${path}`, { ...opts, headers, body: opts.body && JSON.stringify(opts.body) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const googleToken = () => jwt.sign(
  { sub: `google-terms-${suffix}`, email: GOOGLE_EMAIL, email_verified: true, name: 'Terms Person' },
  googleKeys.privateKey,
  { algorithm: 'RS256', keyid: 'terms-kid', issuer: 'https://accounts.google.com', audience: GOOGLE_WEB_ID, expiresIn: '10m' },
);

before(() => {
  social._setTestDeps({ googleCerts: { 'terms-kid': googleKeys.publicKey.export({ type: 'spki', format: 'pem' }) } });
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, GOOGLE_EMAIL, LEGACY_EMAIL] } } });
  await prisma.$disconnect();
  server.close();
});

describe('Terms agreement', () => {
  test('needsTermsAcceptance: never accepted or accepted before TERMS_VERSION → true', () => {
    assert.strictEqual(needsTermsAcceptance(null), true);
    assert.strictEqual(needsTermsAcceptance(new Date('2020-01-01')), true);
    assert.strictEqual(needsTermsAcceptance(new Date(`${TERMS_VERSION}T12:00:00Z`)), false);
    assert.strictEqual(needsTermsAcceptance(new Date()), false);
  });

  test('POST /auth/register without acceptedTerms → 400 TERMS_REQUIRED, no user created', async () => {
    for (const acceptedTerms of [undefined, false]) {
      const { status, data } = await api('/auth/register', {
        method: 'POST', body: { email: EMAIL, password: PASSWORD, name: 'Terms', acceptedTerms },
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.code, 'TERMS_REQUIRED');
    }
    assert.strictEqual(await prisma.user.count({ where: { email: EMAIL } }), 0);
  });

  test('POST /auth/register with acceptedTerms stores termsAcceptedAt', async () => {
    const before = Date.now();
    const { status, data } = await api('/auth/register', {
      method: 'POST', body: { email: EMAIL, password: PASSWORD, name: 'Terms', acceptedTerms: true },
    });
    assert.strictEqual(status, 201);
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    assert.ok(user.termsAcceptedAt.getTime() >= before - 1000);
    const me = await api('/auth/me', { token: data.accessToken });
    assert.strictEqual(me.data.needsTerms, false);
    assert.strictEqual(me.data.termsVersion, TERMS_VERSION);
  });

  test('POST /auth/social that would create an account needs acceptedTerms', async () => {
    const refused = await api('/auth/social', { method: 'POST', body: { provider: 'google', token: googleToken() } });
    assert.strictEqual(refused.status, 400);
    assert.strictEqual(refused.data.code, 'TERMS_REQUIRED');
    assert.strictEqual(await prisma.user.count({ where: { email: GOOGLE_EMAIL } }), 0);

    const { status, data } = await api('/auth/social', {
      method: 'POST', body: { provider: 'google', token: googleToken(), acceptedTerms: true },
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(data.isNewUser, true);
    const user = await prisma.user.findUnique({ where: { email: GOOGLE_EMAIL } });
    assert.ok(user.termsAcceptedAt);
  });

  test('POST /auth/social for an existing account does not need acceptedTerms', async () => {
    const { status, data } = await api('/auth/social', { method: 'POST', body: { provider: 'google', token: googleToken() } });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.isNewUser, false);
  });

  test('An account that never accepted gets needsTerms until POST /auth/terms', async () => {
    await api('/auth/register', {
      method: 'POST', body: { email: LEGACY_EMAIL, password: PASSWORD, name: 'Legacy', acceptedTerms: true },
    });
    await prisma.user.update({ where: { email: LEGACY_EMAIL }, data: { termsAcceptedAt: null } });

    const login = await api('/auth/login', { method: 'POST', body: { email: LEGACY_EMAIL, password: PASSWORD } });
    assert.strictEqual(login.status, 200);
    const token = login.data.accessToken;
    assert.strictEqual((await api('/auth/me', { token })).data.needsTerms, true);

    const refused = await api('/auth/terms', { method: 'POST', token, body: { acceptedTerms: false } });
    assert.strictEqual(refused.status, 400);
    assert.strictEqual((await api('/auth/terms', { method: 'POST', body: { acceptedTerms: true } })).status, 401);

    const accepted = await api('/auth/terms', { method: 'POST', token, body: { acceptedTerms: true } });
    assert.strictEqual(accepted.status, 200);
    assert.ok(accepted.data.termsAcceptedAt);
    assert.strictEqual((await api('/auth/me', { token })).data.needsTerms, false);
  });
});
