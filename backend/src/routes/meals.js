const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { manualMealSchema } = require('../utils/validation');
const { analyzePhoto } = require('../services/vision');

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'AI rate limit reached, try again later' },
  keyGenerator: (req) => req.userId,
});

router.post('/manual', authenticate, async (req, res, next) => {
  try {
    const data = manualMealSchema.parse(req.body);
    const meal = await prisma.meal.create({
      data: {
        userId: req.userId,
        name: data.name,
        calories: data.calories,
        proteinG: data.proteinG,
        carbsG: data.carbsG,
        fatG: data.fatG,
        source: 'manual',
        consumedAt: data.consumedAt ? new Date(data.consumedAt) : new Date(),
      },
    });
    res.status(201).json(meal);
  } catch (err) {
    next(err);
  }
});

router.post('/photo', authenticate, aiLimiter, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo is required' });

    let user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Accept weight from form body to update profile
    const bodyWeight = req.body.weight ? parseFloat(req.body.weight) : null;
    if (bodyWeight && bodyWeight >= 20 && bodyWeight <= 500) {
      user = await prisma.user.update({
        where: { id: req.userId },
        data: { weightKg: bodyWeight, weightUpdatedAt: new Date() },
      });
    }

    // Check if weight is available (either from profile or just submitted)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (!user.weightKg || !user.weightUpdatedAt || user.weightUpdatedAt < sevenDaysAgo) {
      return res.status(200).json({
        needs_weight: true,
        message: 'Please update your weight for accurate portion estimation',
        photoUrl: `/uploads/${req.file.filename}`,
      });
    }

    const result = await analyzePhoto(req.file.path, user.weightKg);
    const lowConfidence = result.confidence < 0.4;

    const meal = await prisma.meal.create({
      data: {
        userId: req.userId,
        name: result.name,
        calories: result.calories,
        proteinG: result.proteinG,
        carbsG: result.carbsG,
        fatG: result.fatG,
        source: 'photo_ai',
        photoUrl: `/uploads/${req.file.filename}`,
        aiConfidence: result.confidence,
        consumedAt: new Date(),
      },
    });

    res.status(201).json({
      meal,
      low_confidence: lowConfidence,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { userId: req.userId };

    if (from || to) {
      where.consumedAt = {};
      if (from) where.consumedAt.gte = new Date(from);
      if (to) where.consumedAt.lte = new Date(to);
    }

    const meals = await prisma.meal.findMany({
      where,
      orderBy: { consumedAt: 'desc' },
    });
    res.json(meals);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const meal = await prisma.meal.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    const data = manualMealSchema.parse(req.body);
    const updated = await prisma.meal.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        calories: data.calories,
        proteinG: data.proteinG,
        carbsG: data.carbsG,
        fatG: data.fatG,
        consumedAt: data.consumedAt ? new Date(data.consumedAt) : meal.consumedAt,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const meal = await prisma.meal.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    await prisma.meal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Meal deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
