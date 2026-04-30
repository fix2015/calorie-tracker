const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { getSuggestion } = require('../services/vision');

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Rate limit reached' },
  keyGenerator: (req) => req.userId,
});

router.get('/daily', authenticate, async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const meals = await prisma.meal.findMany({
      where: {
        userId: req.userId,
        consumedAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { consumedAt: 'asc' },
    });

    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { dailyCalorieTarget: true },
    });

    res.json({
      date: dateStr,
      target: user?.dailyCalorieTarget || 2000,
      totals,
      meals,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/weekly', authenticate, async (req, res, next) => {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

      const meals = await prisma.meal.findMany({
        where: {
          userId: req.userId,
          consumedAt: { gte: dayStart, lte: dayEnd },
        },
      });

      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + m.calories,
          proteinG: acc.proteinG + m.proteinG,
          carbsG: acc.carbsG + m.carbsG,
          fatG: acc.fatG + m.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      );

      days.push({ date: dateStr, ...totals, mealCount: meals.length });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { dailyCalorieTarget: true },
    });

    res.json({ target: user?.dailyCalorieTarget || 2000, days });
  } catch (err) {
    next(err);
  }
});

const analysisLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: { error: 'Daily analysis limit reached (10/day). Try again tomorrow!' },
  keyGenerator: (req) => req.userId,
});

router.get('/analyze', authenticate, analysisLimiter, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${today}T00:00:00.000Z`);
    const dayEnd = new Date(`${today}T23:59:59.999Z`);

    const meals = await prisma.meal.findMany({
      where: { userId: req.userId, consumedAt: { gte: dayStart, lte: dayEnd } },
    });

    if (meals.length === 0) {
      return res.json({ analysis: "Log some meals first — I need data to give you a meaningful analysis!" });
    }

    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const target = user.dailyCalorieTarget || 2000;
    const mealList = meals.map((m) => `${m.name}: ${m.calories} kcal, P${Math.round(m.proteinG)}g C${Math.round(m.carbsG)}g F${Math.round(m.fatG)}g`).join('; ');

    const OpenAI = require('openai');
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'You are a friendly, knowledgeable nutrition coach. Give personalized, actionable advice. Use short paragraphs. Be encouraging but honest.',
        },
        {
          role: 'user',
          content: `Analyze my nutrition today. Profile: ${user.gender || 'unknown'}, ${user.age || '?'} years, ${user.weightKg || '?'} kg, ${user.heightCm || '?'} cm, goal: ${user.goal || 'maintain'}${user.targetWeightKg ? `, target weight: ${user.targetWeightKg} kg` : ''}.

Daily target: ${target} kcal. Eaten so far: ${Math.round(totals.calories)} kcal, P: ${Math.round(totals.proteinG)}g, C: ${Math.round(totals.carbsG)}g, F: ${Math.round(totals.fatG)}g.

Meals: ${mealList}

Give a brief analysis (3-4 short paragraphs): 1) Overall assessment 2) What's good 3) What to improve 4) Suggestion for next meal. Keep it under 150 words.`,
        },
      ],
    });

    res.json({ analysis: response.choices[0].message.content.trim() });
  } catch (err) {
    next(err);
  }
});

router.get('/suggestion', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${today}T00:00:00.000Z`);
    const dayEnd = new Date(`${today}T23:59:59.999Z`);

    const meals = await prisma.meal.findMany({
      where: { userId: req.userId, consumedAt: { gte: dayStart, lte: dayEnd } },
    });

    if (meals.length === 0) {
      return res.json({ suggestion: "Log your first meal today to get personalized suggestions!", cached: true });
    }

    // Check cache — at least 4h since last suggestion
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const cached = await prisma.suggestionCache.findFirst({
      where: { userId: req.userId, createdAt: { gt: fourHoursAgo } },
      orderBy: { createdAt: 'desc' },
    });

    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const target = user.dailyCalorieTarget || 2000;
    const deviation = Math.abs(totals.calories - target) / target;

    // Return cached if recent and not significantly off target
    if (cached && deviation <= 0.15) {
      return res.json({ suggestion: cached.message, cached: true });
    }

    // Call AI
    const suggestion = await getSuggestion({
      goal: user.goal || 'maintain',
      target,
      eaten: totals.calories,
      protein: Math.round(totals.proteinG),
      carbs: Math.round(totals.carbsG),
      fat: Math.round(totals.fatG),
    });

    await prisma.suggestionCache.create({
      data: { userId: req.userId, message: suggestion },
    });

    res.json({ suggestion, cached: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
