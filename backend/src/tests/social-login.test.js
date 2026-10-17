/**
 * Sign in with Apple / Google — token verification against stubbed Apple JWKS and Google certs,
 * account resolution (new user, duplicate identity, link by verified email), set-password and
 * Apple token revocation on account deletion.
 *
 * Uses Node.js built-in test runner. Requires a running PostgreSQL instance.
 * Run: NODE_ENV=test node --test src/tests/social-login.test.js
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const BUNDLE_ID = 'app.test.calorize';
const SERVICES_ID = 'app.test.calorize.web';
const GOOGLE_WEB_ID = 'web-client.apps.googleusercontent.com';
const GOOGLE_IOS_ID = 'ios-client.apps.googleusercontent.com';

const appleKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const googleKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const siwaKey = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

process.env.APPLE_AUDIENCES = `${BUNDLE_ID},${SERVICES_ID}`;
process.env.APPLE_TEAM_ID = 'TEAMID1234';
process.env.APPLE_SIWA_KEY_ID = 'KEYID12345';
process.env.APPLE_SIWA_PRIVATE_KEY = siwaKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
process.env.GOOGLE_CLIENT_IDS = `${GOOGLE_WEB_ID},${GOOGLE_IOS_ID}`;
process.env.APPLE_REDIRECT_URI = 'https://calories.example/api/auth/apple/callback';

const app = require('../index');
const prisma = require('../utils/prisma');
const social = require('../services/socialAuth');

const suffix = crypto.randomUUID().slice(0, 8);
const APPLE_SUB = `apple-${suffix}`;
const APPLE_EMAIL = `relay_${suffix}@privaterelay.appleid.com`;
const PASSWORD_EMAIL = `test_social_${suffix}@example.com`;
const UNVERIFIED_EMAIL = `test_unverified_${suffix}@example.com`;
const ANDROID_EMAIL = `test_android_${suffix}@example.com`;

const calls = [];
let server;
let baseUrl;

function stubFetch(url, opts = {}) {
  calls.push({ url, body: opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : null });
  const json = (status, data) => Promise.resolve({ ok: status < 400, status, json: async () => data });
  if (url === 'https://appleid.apple.com/auth/keys') {
    const jwk = appleKeys.publicKey.export({ format: 'jwk' });
    return json(200, { keys: [{ ...jwk, kid: 'apple-test-kid', alg: 'RS256', use: 'sig' }] });
  }
  if (url === 'https://appleid.apple.com/auth/token') {
    return json(200, { access_token: 'apple-access', refresh_token: `apple-refresh-${suffix}` });
  }
  if (url === 'https://appleid.apple.com/auth/revoke') return json(200, {});
  return json(404, {});
}

// Tokens expire in 10 minutes unless the claims carry their own `exp`
const withExpiry = (claims, opts) => (claims.exp ? opts : { expiresIn: '10m', ...opts });

function appleToken(claims = {}, opts = {}) {
  return jwt.sign(
    { sub: APPLE_SUB, email: APPLE_EMAIL, email_verified: 'true', is_private_email: 'true', ...claims },
    appleKeys.privateKey,
    withExpiry(claims, { algorithm: 'RS256', keyid: 'apple-test-kid', issuer: 'https://appleid.apple.com', audience: BUNDLE_ID, ...opts }),
  );
}

function googleToken(claims = {}, opts = {}) {
  return jwt.sign(
    { sub: `google-${suffix}`, email: PASSWORD_EMAIL, email_verified: true, name: 'Google Person', ...claims },
    googleKeys.privateKey,
    withExpiry(claims, { algorithm: 'RS256', keyid: 'google-test-kid', issuer: 'https://accounts.google.com', audience: GOOGLE_WEB_ID, ...opts }),
  );
}

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
  social._setTestDeps({
    fetch: stubFetch,
    googleCerts: { 'google-test-kid': googleKeys.publicKey.export({ type: 'spki', format: 'pem' }) },
  });
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [APPLE_EMAIL, PASSWORD_EMAIL, UNVERIFIED_EMAIL, ANDROID_EMAIL] } } });
  await prisma.$disconnect();
  server.close();
});

describe('Social login', () => {
  let appleUserId;
  let appleAccessToken;
  let passwordUserId;

  test('GET /auth/providers reports both providers configured', async () => {
    const { status, data } = await api('/auth/providers');
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(data, { apple: true, google: true });
  });

  test('Apple: first sign-in creates an incomplete-profile user and stores the refresh token encrypted', async () => {
    const { status, data } = await api('/auth/social', {
      method: 'POST',
      body: { provider: 'apple', token: appleToken(), name: 'Ada Apple', authorizationCode: 'code-123' },
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(data.isNewUser, true);
    assert.ok(data.accessToken && data.refreshToken);
    assert.strictEqual(data.user.name, 'Ada Apple');
    assert.strictEqual(data.user.email, APPLE_EMAIL);
    appleUserId = data.user.id;
    appleAccessToken = data.accessToken;

    const exchange = calls.find((c) => c.url === 'https://appleid.apple.com/auth/token');
    assert.strictEqual(exchange.body.client_id, BUNDLE_ID);
    assert.strictEqual(exchange.body.code, 'code-123');
    const secret = jwt.verify(exchange.body.client_secret, siwaKey.publicKey, { algorithms: ['ES256'] });
    assert.strictEqual(secret.iss, 'TEAMID1234');
    assert.strictEqual(secret.aud, 'https://appleid.apple.com');
    assert.strictEqual(secret.sub, BUNDLE_ID);

    const identity = await prisma.authIdentity.findFirst({ where: { userId: appleUserId } });
    assert.ok(identity.appleRefreshToken.startsWith('v1:'));
    assert.ok(!identity.appleRefreshToken.includes(`apple-refresh-${suffix}`));
    assert.strictEqual(social.decryptSecret(identity.appleRefreshToken), `apple-refresh-${suffix}`);

    const me = await api('/auth/me', { token: appleAccessToken });
    assert.strictEqual(me.data.profileComplete, false);
    assert.strictEqual(me.data.hasPassword, false);
    assert.deepStrictEqual(me.data.authProviders, ['apple']);
  });

  test('Apple: the same identity signs in to the same user', async () => {
    const { status, data } = await api('/auth/social', { method: 'POST', body: { provider: 'apple', token: appleToken() } });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.isNewUser, false);
    assert.strictEqual(data.user.id, appleUserId);
    assert.strictEqual(await prisma.authIdentity.count({ where: { userId: appleUserId } }), 1);
  });

  test('Apple: rejects a token for another audience', async () => {
    const { status } = await api('/auth/social', {
      method: 'POST', body: { provider: 'apple', token: appleToken({}, { audience: 'com.someone.else' }) },
    });
    assert.strictEqual(status, 401);
  });

  test('Apple: rejects an expired token', async () => {
    const expired = appleToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    const { status } = await api('/auth/social', { method: 'POST', body: { provider: 'apple', token: expired } });
    assert.strictEqual(status, 401);
  });

  test('Password login is refused for a social account without a password', async () => {
    const { status } = await api('/auth/login', { method: 'POST', body: { email: APPLE_EMAIL, password: 'whatever123' } });
    assert.strictEqual(status, 401);
  });

  test('Finishing the profile marks it complete', async () => {
    const { status, data } = await api('/users/me', {
      method: 'PATCH',
      token: appleAccessToken,
      body: { age: 30, gender: 'female', heightCm: 170, weightKg: 65, goal: 'maintain', activityLevel: 'light' },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.profileComplete, true);
    assert.ok(data.dailyCalorieTarget > 0);
  });

  test('POST /auth/password lets a social account add a password, then log in with it', async () => {
    const set = await api('/auth/password', { method: 'POST', token: appleAccessToken, body: { password: 'NewPass123!' } });
    assert.strictEqual(set.status, 200);
    const login = await api('/auth/login', { method: 'POST', body: { email: APPLE_EMAIL, password: 'NewPass123!' } });
    assert.strictEqual(login.status, 200);
    assert.strictEqual(login.data.user.id, appleUserId);
  });

  test('Google: verified email links to the existing password account', async () => {
    const reg = await api('/auth/register', {
      method: 'POST', body: { email: PASSWORD_EMAIL, password: 'TestPass123!', name: 'Password Person' },
    });
    assert.strictEqual(reg.status, 201);
    passwordUserId = reg.data.user.id;

    const { status, data } = await api('/auth/social', { method: 'POST', body: { provider: 'google', token: googleToken() } });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.isNewUser, false);
    assert.strictEqual(data.user.id, passwordUserId);

    const me = await api('/auth/me', { token: data.accessToken });
    assert.deepStrictEqual(me.data.authProviders, ['google']);
    assert.strictEqual(me.data.hasPassword, true);
    assert.strictEqual(me.data.profileComplete, true);
  });

  test('Google: accepts the iOS client id as audience', async () => {
    const { status, data } = await api('/auth/social', {
      method: 'POST', body: { provider: 'google', token: googleToken({}, { audience: GOOGLE_IOS_ID }) },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.user.id, passwordUserId);
  });

  test('Google: rejects a wrong audience and an expired token', async () => {
    const wrongAud = await api('/auth/social', {
      method: 'POST', body: { provider: 'google', token: googleToken({}, { audience: 'other.apps.googleusercontent.com' }) },
    });
    assert.strictEqual(wrongAud.status, 401);
    const expired = googleToken({ iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 });
    const exp = await api('/auth/social', { method: 'POST', body: { provider: 'google', token: expired } });
    assert.strictEqual(exp.status, 401);
  });

  test('Google: an unverified email never takes over an existing account', async () => {
    await prisma.user.create({ data: { email: UNVERIFIED_EMAIL, passwordHash: 'x', name: 'Victim' } });
    const { status } = await api('/auth/social', {
      method: 'POST',
      body: { provider: 'google', token: googleToken({ sub: `google-unverified-${suffix}`, email: UNVERIFIED_EMAIL, email_verified: false }) },
    });
    assert.strictEqual(status, 409);
  });

  test('Deleting an Apple account revokes the Apple token', async () => {
    calls.length = 0;
    const { status } = await api('/users/me', { method: 'DELETE', token: appleAccessToken });
    assert.strictEqual(status, 200);
    const revoke = calls.find((c) => c.url === 'https://appleid.apple.com/auth/revoke');
    assert.ok(revoke, 'revoke endpoint called');
    assert.strictEqual(revoke.body.token, `apple-refresh-${suffix}`);
    assert.strictEqual(revoke.body.client_id, BUNDLE_ID);
    assert.strictEqual(revoke.body.token_type_hint, 'refresh_token');
    assert.strictEqual(await prisma.user.count({ where: { id: appleUserId } }), 0);
  });

  test('Android: Apple callback redeems the code and hands the id_token + name to /auth/social', async () => {
    calls.length = 0;
    const idToken = appleToken({ sub: `apple-android-${suffix}`, email: ANDROID_EMAIL }, { audience: SERVICES_ID });
    const res = await fetch(`${baseUrl}/api/auth/apple/callback`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: 'android-code', id_token: idToken, user: JSON.stringify({ name: { firstName: 'Andy', lastName: 'Droid' } }) }),
    });
    assert.strictEqual(res.status, 303);
    const location = new URL(res.headers.get('location'));
    assert.strictEqual(location.protocol, 'app.probooking.calorize:');
    assert.strictEqual(location.searchParams.get('success'), 'true');
    assert.strictEqual(location.searchParams.get('id_token'), idToken);

    const exchange = calls.find((c) => c.url === 'https://appleid.apple.com/auth/token');
    assert.strictEqual(exchange.body.client_id, SERVICES_ID);
    assert.strictEqual(exchange.body.redirect_uri, 'https://calories.example/api/auth/apple/callback');

    const { status, data } = await api('/auth/social', { method: 'POST', body: { provider: 'apple', token: idToken } });
    assert.strictEqual(status, 201);
    assert.strictEqual(data.user.name, 'Andy Droid');
    const identity = await prisma.authIdentity.findFirst({ where: { userId: data.user.id } });
    assert.strictEqual(identity.appleClientId, SERVICES_ID);
    assert.strictEqual(social.decryptSecret(identity.appleRefreshToken), `apple-refresh-${suffix}`);
  });

  test('Returns 503 when a provider is not configured', async () => {
    const saved = process.env.GOOGLE_CLIENT_IDS;
    delete process.env.GOOGLE_CLIENT_IDS;
    try {
      const providers = await api('/auth/providers');
      assert.strictEqual(providers.data.google, false);
      const { status } = await api('/auth/social', { method: 'POST', body: { provider: 'google', token: googleToken() } });
      assert.strictEqual(status, 503);
    } finally {
      process.env.GOOGLE_CLIENT_IDS = saved;
    }
  });
});
