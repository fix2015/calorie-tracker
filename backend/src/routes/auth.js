const express = require('express');
const { Router } = express;
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const prisma = require('../utils/prisma');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { registerSchema, loginSchema, socialLoginSchema, acceptTermsSchema, setPasswordSchema } = require('../utils/validation');
const { TERMS_VERSION, TERMS_REQUIRED, needsTermsAcceptance } = require('../utils/terms');
const { computeDailyCalorieTarget } = require('../utils/calories');
const { authenticate } = require('../middleware/auth');
const social = require('../services/socialAuth');

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts, try again in 15 minutes' },
  skipSuccessfulRequests: true,
});

async function createTokens(userId) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

// Auto-generate a unique-ish username from the display name
async function generateUsername(name) {
  let username = name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (username.length < 3) username = username + Math.random().toString(36).slice(2, 6);
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) username = username + Math.random().toString(36).slice(2, 5);
  return username;
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    if (data.acceptedTerms !== true) return res.status(400).json({ error: TERMS_REQUIRED, code: 'TERMS_REQUIRED' });
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const dailyCalorieTarget = computeDailyCalorieTarget(data);

    const username = await generateUsername(data.name);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        username,
        isPublic: true,
        age: data.age,
        gender: data.gender,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        targetWeightKg: data.targetWeightKg,
        weightUpdatedAt: data.weightKg ? new Date() : null,
        activityLevel: data.activityLevel,
        goal: data.goal,
        dailyCalorieTarget,
        termsAcceptedAt: new Date(),
      },
      select: { id: true, email: true, name: true, dailyCalorieTarget: true },
    });

    const tokens = await createTokens(user.id);
    res.status(201).json({ user, ...tokens });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Accounts created with Apple / Google have no password until the user sets one
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const tokens = await createTokens(user.id);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, dailyCalorieTarget: user.dailyCalorieTarget },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, userId: payload.userId, expiresAt: { gt: new Date() } },
    });
    if (!stored) return res.status(401).json({ error: 'Invalid refresh token' });

    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await createTokens(payload.userId);
    res.json(tokens);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(err);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await prisma.refreshToken.deleteMany({ where: { userId: req.userId } });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, name: true, age: true, gender: true,
        heightCm: true, weightKg: true, targetWeightKg: true, weightUpdatedAt: true,
        activityLevel: true, goal: true, dailyCalorieTarget: true,
        username: true, bio: true, avatarUrl: true, linkUrl: true, isPublic: true, followersOnly: true,
        profileComplete: true, termsAcceptedAt: true, passwordHash: true, identities: { select: { provider: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { passwordHash, identities, ...profile } = user;
    res.json({
      ...profile,
      hasPassword: !!passwordHash,
      authProviders: [...new Set(identities.map((i) => i.provider))],
      needsTerms: needsTermsAcceptance(user.termsAcceptedAt),
      termsVersion: TERMS_VERSION,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Sign in with Apple / Google ───

/** Explicit agreement to the current Terms of Use (the sheet shown to accounts that never accepted them). */
router.post('/terms', authenticate, async (req, res, next) => {
  try {
    acceptTermsSchema.parse(req.body);
    const { termsAcceptedAt } = await prisma.user.update({
      where: { id: req.userId },
      data: { termsAcceptedAt: new Date() },
      select: { termsAcceptedAt: true },
    });
    res.json({ termsAcceptedAt, termsVersion: TERMS_VERSION });
  } catch (err) {
    next(err);
  }
});

router.get('/providers', (req, res) => {
  res.json(social.providerStatus());
});

const loginUserPayload = (user) => ({
  id: user.id, email: user.email, name: user.name, dailyCalorieTarget: user.dailyCalorieTarget,
});

/** Stores (encrypted) the Apple refresh token so the account can be revoked on deletion. */
async function saveAppleRefreshToken(identityId, refreshToken, clientId) {
  if (!refreshToken) return;
  await prisma.authIdentity.update({
    where: { id: identityId },
    data: { appleRefreshToken: social.encryptSecret(refreshToken), appleClientId: clientId },
  });
}

/**
 * Resolves the verified identity to a user: known identity → that user; verified email of an existing
 * account → link it; otherwise create a new account (profile incomplete until body stats are entered),
 * which needs `acceptedTerms` — without it nothing is created and the app shows the agreement sheet.
 */
async function resolveSocialUser(identity, displayName, acceptedTerms) {
  const where = { provider_providerUserId: { provider: identity.provider, providerUserId: identity.sub } };
  const existingIdentity = await prisma.authIdentity.findUnique({ where, include: { user: true } });
  if (existingIdentity) return { user: existingIdentity.user, identityId: existingIdentity.id, isNewUser: false };

  if (!identity.email) throw new social.SocialAuthError('Your account did not share an email address', 400);

  const byEmail = await prisma.user.findFirst({ where: { email: { equals: identity.email, mode: 'insensitive' } } });
  if (byEmail) {
    if (!identity.emailVerified) {
      throw new social.SocialAuthError('An account with this email already exists. Sign in with your password.', 409);
    }
    const created = await prisma.authIdentity.create({
      data: { userId: byEmail.id, provider: identity.provider, providerUserId: identity.sub, email: identity.email },
    });
    return { user: byEmail, identityId: created.id, isNewUser: false };
  }

  if (acceptedTerms !== true) throw new social.SocialAuthError(TERMS_REQUIRED, 400, 'TERMS_REQUIRED');

  const name = (displayName || identity.name || identity.email.split('@')[0]).trim().slice(0, 100) || 'Calorize user';
  const user = await prisma.user.create({
    data: {
      email: identity.email,
      passwordHash: null,
      name,
      username: await generateUsername(name),
      isPublic: true,
      profileComplete: false,
      termsAcceptedAt: new Date(),
      identities: {
        create: { provider: identity.provider, providerUserId: identity.sub, email: identity.email },
      },
    },
    include: { identities: true },
  });
  return { user, identityId: user.identities[0].id, isNewUser: true };
}

router.post('/social', authLimiter, async (req, res, next) => {
  try {
    const { provider, token, name, authorizationCode, acceptedTerms } = socialLoginSchema.parse(req.body);
    if (!social.providerStatus()[provider]) {
      return res.status(503).json({ error: `${provider === 'apple' ? 'Apple' : 'Google'} sign-in is not configured` });
    }

    const identity = await social.verifyIdToken(provider, token);

    // Android hand-off: the callback already redeemed the code and kept the refresh token + name for us
    const handoff = provider === 'apple' ? social.takeAppleSignIn(token) : null;

    let resolved;
    try {
      resolved = await resolveSocialUser(identity, name || handoff?.name, acceptedTerms);
    } catch (err) {
      // The app retries with acceptedTerms after the agreement sheet: keep the Android hand-off for it
      if (handoff && err.code === 'TERMS_REQUIRED') social.stashAppleSignIn(token, handoff);
      throw err;
    }
    const { user, identityId, isNewUser } = resolved;
    // An existing account that ticked the agreement (Register screen) records it too
    if (!isNewUser && acceptedTerms === true && needsTermsAcceptance(user.termsAcceptedAt)) {
      await prisma.user.update({ where: { id: user.id }, data: { termsAcceptedAt: new Date() } });
    }

    if (provider === 'apple') {
      try {
        if (authorizationCode) {
          const tokens = await social.exchangeAppleCode(authorizationCode, identity.audience);
          await saveAppleRefreshToken(identityId, tokens.refresh_token, identity.audience);
        } else if (handoff) {
          await saveAppleRefreshToken(identityId, handoff.refreshToken, handoff.clientId);
        }
      } catch (err) {
        // Sign-in still succeeds; without a refresh token the account just can't be revoked at Apple
        console.error('[social-auth] storing Apple refresh token failed:', err.message);
      }
    }

    const tokens = await createTokens(user.id);
    res.status(isNewUser ? 201 : 200).json({ user: loginUserPayload(user), ...tokens, isNewUser });
  } catch (err) {
    if (err instanceof social.SocialAuthError) {
      return res.status(err.status).json({ error: err.message, ...(err.code && { code: err.code }) });
    }
    next(err);
  }
});

/**
 * Apple's form_post return URL for the Android (and any redirect-based web) flow. Redeems the code,
 * stashes the refresh token, then hands the id_token to the app through its custom URL scheme.
 */
router.post('/apple/callback', express.urlencoded({ extended: false }), async (req, res) => {
  const scheme = process.env.APPLE_ANDROID_APP_SCHEME || 'app.probooking.calorize';
  const back = (params) => res.redirect(303, `${scheme}://apple-login?${new URLSearchParams(params)}`);
  try {
    if (!social.providerStatus().apple) return back({ success: 'false', error: 'not_configured' });
    const { code, id_token: postedIdToken, user: userJson } = req.body || {};
    if (!code || !postedIdToken) return back({ success: 'false', error: req.body?.error || 'missing_code' });

    const identity = await social.verifyIdToken('apple', postedIdToken);
    const tokens = await social.exchangeAppleCode(code, identity.audience);

    let name = null;
    try {
      const u = JSON.parse(userJson || 'null');
      name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ') || null;
    } catch { /* `user` is only sent on the first sign-in */ }

    const idToken = tokens.id_token || postedIdToken;
    social.stashAppleSignIn(idToken, { refreshToken: tokens.refresh_token, clientId: identity.audience, name });
    back({ success: 'true', id_token: idToken, access_token: tokens.access_token || '' });
  } catch (err) {
    console.error('[social-auth] Apple callback failed:', err.message);
    back({ success: 'false', error: 'server_error' });
  }
});

/** Set a password (social accounts) or change it (requires the current password). */
router.post('/password', authenticate, authLimiter, async (req, res, next) => {
  try {
    const { password, currentPassword } = setPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.passwordHash) {
      const valid = currentPassword && await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    res.json({ message: 'Password saved' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
