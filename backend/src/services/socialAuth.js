/**
 * Sign in with Apple / Google — server-side ID-token verification, the Apple client-secret JWT,
 * authorization-code exchange and token revocation (App Store guideline 5.1.1(v)).
 *
 * Env (all optional — social login is reported as unavailable when missing):
 *   GOOGLE_CLIENT_IDS        comma-separated OAuth client ids (web, iOS, Android) accepted as `aud`
 *   APPLE_AUDIENCES          comma-separated: bundle id (iOS) + Services ID (web / Android)
 *   APPLE_TEAM_ID, APPLE_SIWA_KEY_ID, APPLE_SIWA_PRIVATE_KEY (PEM, newlines as \n)
 *   APPLE_REDIRECT_URI       return URL registered on the Services ID (…/api/auth/apple/callback)
 *   SOCIAL_TOKEN_ENCRYPTION_KEY  key for Apple refresh tokens at rest (defaults to one derived from JWT_SECRET)
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const JWKS_TTL_MS = 24 * 60 * 60 * 1000;

class SocialAuthError extends Error {
  constructor(message, status = 401, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const list = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);

function appleConfig() {
  return {
    audiences: list(process.env.APPLE_AUDIENCES),
    teamId: process.env.APPLE_TEAM_ID || '',
    keyId: process.env.APPLE_SIWA_KEY_ID || '',
    privateKey: (process.env.APPLE_SIWA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    redirectUri: process.env.APPLE_REDIRECT_URI || '',
  };
}

/** Which providers are fully configured. Apple also needs the signing key so tokens can be revoked. */
function providerStatus() {
  const apple = appleConfig();
  return {
    apple: apple.audiences.length > 0 && !!apple.teamId && !!apple.keyId && !!apple.privateKey,
    google: list(process.env.GOOGLE_CLIENT_IDS).length > 0,
  };
}

// Network access is injectable so tests can stub Apple's JWKS / token endpoints and Google's certs
const deps = {
  fetch: (...args) => fetch(...args),
  googleCerts: null, // { kid: PEM } — when set, used instead of Google's published certs
};
function _setTestDeps(overrides) {
  Object.assign(deps, overrides);
  appleJwks = null;
}

// ─── Apple ───

let appleJwks = null; // { keys, fetchedAt }

async function getAppleKeys(force = false) {
  if (!force && appleJwks && Date.now() - appleJwks.fetchedAt < JWKS_TTL_MS) return appleJwks.keys;
  const res = await deps.fetch(APPLE_KEYS_URL);
  if (!res.ok) throw new SocialAuthError('Could not fetch Apple signing keys', 502);
  const { keys } = await res.json();
  appleJwks = { keys, fetchedAt: Date.now() };
  return keys;
}

const isTrue = (v) => v === true || v === 'true';

async function verifyAppleToken(idToken) {
  const { audiences } = appleConfig();
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) throw new SocialAuthError('Invalid Apple token');

  let jwk = (await getAppleKeys()).find((k) => k.kid === decoded.header.kid);
  if (!jwk) jwk = (await getAppleKeys(true)).find((k) => k.kid === decoded.header.kid); // key rotation
  if (!jwk) throw new SocialAuthError('Invalid Apple token');

  let payload;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    payload = jwt.verify(idToken, key, { algorithms: ['RS256'], issuer: APPLE_ISSUER, audience: audiences });
  } catch {
    throw new SocialAuthError('Invalid Apple token');
  }
  if (!payload.sub) throw new SocialAuthError('Invalid Apple token');

  return {
    provider: 'apple',
    sub: payload.sub,
    email: payload.email ? String(payload.email).toLowerCase() : null,
    emailVerified: isTrue(payload.email_verified), // private-relay addresses are verified too
    name: null, // Apple never puts the name in the token
    audience: payload.aud,
  };
}

/** ES256 client secret for Apple's token / revoke endpoints (short-lived; Apple allows up to 6 months). */
function appleClientSecret(clientId) {
  const { teamId, keyId, privateKey } = appleConfig();
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    keyid: keyId,
    issuer: teamId,
    subject: clientId,
    audience: APPLE_ISSUER,
    expiresIn: '10m',
  });
}

/**
 * Exchanges a Sign in with Apple authorization code for tokens. Codes from the web / Android flow were
 * issued for the Services ID and must be redeemed with the same redirect_uri; native iOS codes need none.
 */
async function exchangeAppleCode(code, clientId) {
  const { redirectUri, audiences } = appleConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: appleClientSecret(clientId),
    code,
    grant_type: 'authorization_code',
  });
  // The first audience is the iOS bundle id by convention; any other one is a Services ID
  if (redirectUri && clientId !== audiences[0]) body.set('redirect_uri', redirectUri);

  const res = await deps.fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SocialAuthError(`Apple code exchange failed: ${data.error || res.status}`, 502);
  return data; // { access_token, refresh_token, id_token, ... }
}

/** Revokes an Apple refresh token. Resolves true on success; never throws. */
async function revokeAppleToken(refreshToken, clientId) {
  try {
    const res = await deps.fetch(APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: appleClientSecret(clientId),
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
    });
    if (!res.ok) console.error(`[social-auth] Apple revoke failed: HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error('[social-auth] Apple revoke failed:', err.message);
    return false;
  }
}

// ─── Google ───

const googleClient = new OAuth2Client();

async function verifyGoogleToken(idToken) {
  const audiences = list(process.env.GOOGLE_CLIENT_IDS);
  let payload;
  try {
    const certs = deps.googleCerts || (await googleClient.getFederatedSignonCertsAsync()).certs;
    const ticket = await googleClient.verifySignedJwtWithCertsAsync(idToken, certs, audiences, GOOGLE_ISSUERS);
    payload = ticket.getPayload();
  } catch {
    throw new SocialAuthError('Invalid Google token');
  }
  if (!payload || !payload.sub) throw new SocialAuthError('Invalid Google token');

  return {
    provider: 'google',
    sub: payload.sub,
    email: payload.email ? String(payload.email).toLowerCase() : null,
    emailVerified: isTrue(payload.email_verified),
    name: payload.name || null,
    audience: payload.aud,
  };
}

function verifyIdToken(provider, token) {
  if (provider === 'apple') return verifyAppleToken(token);
  if (provider === 'google') return verifyGoogleToken(token);
  throw new SocialAuthError('Unknown provider', 400);
}

// ─── Refresh tokens at rest (AES-256-GCM) ───

function encryptionKey() {
  const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || `${process.env.JWT_SECRET}:social-token`;
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

function decryptSecret(stored) {
  const raw = Buffer.from(stored.replace(/^v1:/, ''), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

// ─── Android Apple hand-off ───
// On Android, Apple form-posts to /auth/apple/callback; we redeem the code there and pass only the
// id_token back to the app. The refresh token and first-sign-in name wait here (10 min) until the app
// calls /auth/social with that id_token.

const STASH_TTL_MS = 10 * 60 * 1000;
const appleStash = new Map();
const tokenKey = (idToken) => crypto.createHash('sha256').update(idToken).digest('hex');

function stashAppleSignIn(idToken, data) {
  const now = Date.now();
  for (const [k, v] of appleStash) if (v.expiresAt < now) appleStash.delete(k);
  appleStash.set(tokenKey(idToken), { ...data, expiresAt: now + STASH_TTL_MS });
}

function takeAppleSignIn(idToken) {
  const key = tokenKey(idToken);
  const entry = appleStash.get(key);
  appleStash.delete(key);
  return entry && entry.expiresAt >= Date.now() ? entry : null;
}

module.exports = {
  SocialAuthError,
  providerStatus,
  verifyIdToken,
  exchangeAppleCode,
  revokeAppleToken,
  appleClientSecret,
  encryptSecret,
  decryptSecret,
  stashAppleSignIn,
  takeAppleSignIn,
  _setTestDeps,
};
