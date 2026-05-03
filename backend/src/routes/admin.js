const { Router } = require('express');
const prisma = require('../utils/prisma');

const router = Router();

// Hardcoded admin credentials
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'caltrack2026!';

// Simple admin auth middleware
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Admin auth required' });
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  next();
}

router.use(adminAuth);

// GET /stats — dashboard overview
router.get('/stats', async (req, res, next) => {
  try {
    const [
      userCount,
      mealCount,
      likeCount,
      commentCount,
      followCount,
      suggestionCount,
      notificationCount,
      messageCount,
      savedMealCount,
      weightLogCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.meal.count(),
      prisma.like.count(),
      prisma.comment.count(),
      prisma.follow.count(),
      prisma.suggestionCache.count(),
      prisma.notification.count(),
      prisma.message.count(),
      prisma.savedMeal.count(),
      prisma.weightLog.count(),
    ]);

    // AI usage: count suggestion cache entries as proxy for AI calls
    const aiCallsToday = await prisma.suggestionCache.count({
      where: { createdAt: { gte: new Date(new Date().toISOString().split('T')[0]) } },
    });

    // Meals by source
    const photoAiMeals = await prisma.meal.count({ where: { source: 'photo_ai' } });
    const manualMeals = await prisma.meal.count({ where: { source: 'manual' } });

    // Users registered today
    const usersToday = await prisma.user.count({
      where: { createdAt: { gte: new Date(new Date().toISOString().split('T')[0]) } },
    });

    // Meals created today
    const mealsToday = await prisma.meal.count({
      where: { createdAt: { gte: new Date(new Date().toISOString().split('T')[0]) } },
    });

    res.json({
      users: userCount,
      meals: mealCount,
      likes: likeCount,
      comments: commentCount,
      follows: followCount,
      suggestions: suggestionCount,
      notifications: notificationCount,
      messages: messageCount,
      savedMeals: savedMealCount,
      weightLogs: weightLogCount,
      aiCallsToday,
      photoAiMeals,
      manualMeals,
      usersToday,
      mealsToday,
    });
  } catch (err) {
    next(err);
  }
});

// GET /users — list all users
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, name: true, username: true,
        avatarUrl: true, isPublic: true, followersOnly: true,
        weightKg: true, targetWeightKg: true, goal: true,
        dailyCalorieTarget: true, createdAt: true,
        _count: { select: { meals: true, followers: true, following: true, likes: true, comments: true } },
      },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id — update user profile (admin)
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { isPublic, followersOnly, username, name, bio, email } = req.body;
    const data = {};
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (followersOnly !== undefined) data.followersOnly = followersOnly;
    if (username !== undefined) data.username = username;
    if (name !== undefined) data.name = name;
    if (bio !== undefined) data.bio = bio;
    if (email !== undefined) data.email = email;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, username: true, isPublic: true, followersOnly: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id — delete user
router.delete('/users/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /suggestions — list AI suggestion cache entries
router.get('/suggestions', async (req, res, next) => {
  try {
    const suggestions = await prisma.suggestionCache.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, message: true, createdAt: true,
        user: { select: { id: true, name: true, username: true, email: true } },
      },
    });
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

// GET /meals — list recent meals with optional filters
router.get('/meals', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const cursor = req.query.cursor || null;
    const source = req.query.source || null;
    const search = req.query.search || null;

    const where = {};
    if (source) where.source = source;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const meals = await prisma.meal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, name: true, calories: true, proteinG: true, carbsG: true, fatG: true,
        source: true, photoUrl: true, isPublic: true, consumedAt: true, createdAt: true,
        user: { select: { id: true, name: true, username: true, email: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const hasMore = meals.length > limit;
    if (hasMore) meals.pop();
    const nextCursor = hasMore ? meals[meals.length - 1].id : null;

    res.json({ meals, nextCursor });
  } catch (err) {
    next(err);
  }
});

// DELETE /meals/:id — delete meal
router.delete('/meals/:id', async (req, res, next) => {
  try {
    await prisma.meal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Meal deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
