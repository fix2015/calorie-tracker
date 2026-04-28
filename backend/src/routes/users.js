const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { updateProfileSchema } = require('../utils/validation');
const { computeDailyCalorieTarget } = require('../utils/calories');

const router = Router();

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const current = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!current) return res.status(404).json({ error: 'User not found' });

    const merged = { ...current, ...data };
    const dailyCalorieTarget = computeDailyCalorieTarget(merged);

    const updateData = { ...data };
    if (dailyCalorieTarget) updateData.dailyCalorieTarget = dailyCalorieTarget;
    if (data.weightKg) updateData.weightUpdatedAt = new Date();

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true, email: true, name: true, age: true, gender: true,
        heightCm: true, weightKg: true, targetWeightKg: true, weightUpdatedAt: true,
        activityLevel: true, goal: true, dailyCalorieTarget: true,
      },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete('/me', authenticate, async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
