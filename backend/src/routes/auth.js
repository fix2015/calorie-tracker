const { Router } = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const prisma = require('../utils/prisma');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { registerSchema, loginSchema } = require('../utils/validation');
const { computeDailyCalorieTarget } = require('../utils/calories');
const { authenticate } = require('../middleware/auth');

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts, try again in 15 minutes' },
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

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const dailyCalorieTarget = computeDailyCalorieTarget(data);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        age: data.age,
        gender: data.gender,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        weightUpdatedAt: data.weightKg ? new Date() : null,
        activityLevel: data.activityLevel,
        goal: data.goal,
        dailyCalorieTarget,
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
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

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
        heightCm: true, weightKg: true, weightUpdatedAt: true,
        activityLevel: true, goal: true, dailyCalorieTarget: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
