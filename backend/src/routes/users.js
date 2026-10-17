const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { updateProfileSchema } = require('../utils/validation');
const { computeDailyCalorieTarget } = require('../utils/calories');
const { upload } = require('../middleware/upload');
const { uploadImage } = require('../services/s3');
const { revokeAppleToken, decryptSecret } = require('../services/socialAuth');

const router = Router();

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const current = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!current) return res.status(404).json({ error: 'User not found' });

    const merged = { ...current, ...data };
    const dailyCalorieTarget = computeDailyCalorieTarget(merged);

    if (data.username && data.username !== current.username) {
      const existing = await prisma.user.findUnique({ where: { username: data.username } });
      if (existing && existing.id !== req.userId) {
        return res.status(409).json({ error: 'Username is already taken' });
      }
      if (current.usernameChangedAt) {
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - new Date(current.usernameChangedAt).getTime() < oneWeek) {
          return res.status(429).json({ error: 'You can only change your username once per week' });
        }
      }
    }

    const updateData = { ...data };
    if (dailyCalorieTarget) {
      updateData.dailyCalorieTarget = dailyCalorieTarget;
      // Social sign-ups finish their profile once body stats + goal are known
      if (!current.profileComplete) updateData.profileComplete = true;
    }
    if (data.weightKg && data.weightKg !== current.weightKg) {
      updateData.weightUpdatedAt = new Date();
      // Log weight change
      prisma.weightLog.create({
        data: { userId: req.userId, weightKg: data.weightKg },
      }).catch(() => {});
    }
    if (data.username && data.username !== current.username) updateData.usernameChangedAt = new Date();

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true, email: true, name: true, age: true, gender: true,
        heightCm: true, weightKg: true, targetWeightKg: true, weightUpdatedAt: true,
        activityLevel: true, goal: true, dailyCalorieTarget: true,
        username: true, bio: true, avatarUrl: true, linkUrl: true, isPublic: true, followersOnly: true,
        profileComplete: true,
      },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /avatar — upload avatar image (resized to 256x256)
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const s3Url = await uploadImage(req.file.path, { maxWidth: 256, maxHeight: 256, cover: true });
    const avatarUrl = s3Url || `/uploads/${req.file.filename}`;

    await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl },
    });

    res.json({ avatarUrl });
  } catch (err) {
    next(err);
  }
});

router.delete('/me', authenticate, async (req, res, next) => {
  try {
    // Sign in with Apple: revoke the user's token (guideline 5.1.1(v)); deletion proceeds even if it fails
    const appleIdentities = await prisma.authIdentity.findMany({
      where: { userId: req.userId, provider: 'apple', appleRefreshToken: { not: null } },
    });
    for (const identity of appleIdentities) {
      try {
        await revokeAppleToken(decryptSecret(identity.appleRefreshToken), identity.appleClientId);
      } catch (err) {
        console.error('[social-auth] Apple revoke on delete failed:', err.message);
      }
    }

    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
