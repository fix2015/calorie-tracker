const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { commentSchema } = require('../utils/validation');
const { createNotification } = require('../utils/notifications');
const ms = require('../services/microservices');

const router = Router();

// POST /meals/:mealId/save — toggle save/bookmark
router.post('/meals/:mealId/save', authenticate, async (req, res, next) => {
  try {
    const meal = await prisma.meal.findUnique({
      where: { id: req.params.mealId },
      include: { user: { select: { isPublic: true } } },
    });
    if (!meal || !meal.user.isPublic) return res.status(404).json({ error: 'Meal not found' });

    const svc = await ms.toggleSave(req.userId, meal.id);
    res.json(svc);
  } catch (err) {
    next(err);
  }
});

// GET /saved — list saved meals
router.get('/saved', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.getSavedContent(req.userId, req.query.cursor, parseInt(req.query.limit) || 20);
    if (!svc) return res.json({ meals: [], nextCursor: null });

    const mealIds = svc.saves.map(s => s.contentId);
    const meals = await prisma.meal.findMany({
      where: { id: { in: mealIds } },
      select: {
        id: true, name: true, calories: true, proteinG: true, carbsG: true, fatG: true,
        photoUrl: true, consumedAt: true, tags: true,
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    const mealMap = Object.fromEntries(meals.map(m => [m.id, m]));
    const orderedMeals = mealIds.map(id => mealMap[id]).filter(Boolean);
    res.json({ meals: orderedMeals, nextCursor: svc.nextCursor || null });
  } catch (err) {
    next(err);
  }
});

// GET /search — search public profiles
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ users: [] });

    const where = {
      isPublic: true,
      username: { not: null },
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (req.userId) where.id = { not: req.userId };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, username: true, bio: true, avatarUrl: true,
        _count: { select: { followers: true } },
      },
      take: 20,
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// GET /trending — popular public meals
router.get('/trending', optionalAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 48);
    const cursor = req.query.cursor || null;
    const tag = req.query.tag || null;
    const where = { isPublic: true, user: { isPublic: true } };
    if (req.userId) where.userId = { not: req.userId };
    if (tag) where.tags = { has: tag };

    const meals = await prisma.meal.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, name: true, calories: true, proteinG: true, carbsG: true, fatG: true,
        photoUrl: true, consumedAt: true, source: true, tags: true,
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
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

// GET /popular-users — public users sorted by followers
router.get('/popular-users', optionalAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const offset = parseInt(req.query.offset) || 0;
    const where = { isPublic: true, username: { not: null } };
    if (req.userId) where.id = { not: req.userId };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, username: true, bio: true, avatarUrl: true,
        _count: { select: { followers: true, meals: true } },
      },
      orderBy: { followers: { _count: 'desc' } },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = users.length > limit;
    if (hasMore) users.pop();
    res.json({ users, hasMore, nextOffset: offset + limit });
  } catch (err) {
    next(err);
  }
});

// GET /suggestions — suggested users to follow
router.get('/suggestions', authenticate, async (req, res, next) => {
  try {
    const svcFollowing = await ms.getFollowing(req.userId);
    const followingIds = svcFollowing ? svcFollowing.users : [];
    const excludeIds = [req.userId, ...followingIds];

    const users = await prisma.user.findMany({
      where: { isPublic: true, username: { not: null }, id: { notIn: excludeIds } },
      select: {
        id: true, name: true, username: true, bio: true, avatarUrl: true,
        _count: { select: { followers: true } },
      },
      orderBy: { followers: { _count: 'desc' } },
      take: 10,
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// GET /feed — meals from followed users
router.get('/feed', authenticate, async (req, res, next) => {
  try {
    const svcFollowing = await ms.getFollowing(req.userId);
    const ids = svcFollowing ? svcFollowing.users : [];

    if (ids.length === 0) return res.json({ meals: [], nextCursor: null });

    const limit = Math.min(parseInt(req.query.limit) || 12, 48);
    const cursor = req.query.cursor || null;

    const meals = await prisma.meal.findMany({
      where: { userId: { in: ids }, isPublic: true },
      orderBy: { consumedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const mealIds = meals.map(m => m.id);
    const svcEngagements = await Promise.all(mealIds.map(id => ms.getContentEngagement(id, req.userId)));
    const engagementMap = Object.fromEntries(mealIds.map((id, i) => [id, svcEngagements[i]]));

    const hasMore = meals.length > limit;
    if (hasMore) meals.pop();
    const nextCursor = hasMore ? meals[meals.length - 1].id : null;

    const feedMeals = meals.map(m => ({
      ...m,
      isLiked: engagementMap[m.id]?.isLiked || false,
      isSaved: engagementMap[m.id]?.isSaved || false,
    }));
    res.json({ meals: feedMeals, nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /u/:username — public profile
router.get('/u/:username', optionalAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, name: true, username: true, bio: true,
        avatarUrl: true, linkUrl: true, createdAt: true, isPublic: true, followersOnly: true,
        _count: { select: { followers: true, following: true, meals: true } },
      },
    });

    if (!user || !user.isPublic) return res.status(404).json({ error: 'Profile not found' });

    // Check blocked via service
    if (req.userId && req.userId !== user.id) {
      const svcBlocked = await ms.checkBlocked(user.id, req.userId);
      if (svcBlocked?.blocked) return res.status(404).json({ error: 'Profile not found' });
    }

    let isFollowing = false;
    if (req.userId && req.userId !== user.id) {
      const svcFollow = await ms.getUserFollowStats(user.id, req.userId);
      isFollowing = svcFollow ? svcFollow.isFollowing : false;
    }

    const isOwner = req.userId === user.id;
    const canSeeMeals = !user.followersOnly || isFollowing || isOwner;
    const { isPublic, ...profile } = user;
    res.json({ ...profile, isFollowing, canSeeMeals });
  } catch (err) {
    next(err);
  }
});

// POST /u/:username/follow — toggle follow
router.post('/u/:username/follow', authenticate, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { username: req.params.username }, select: { id: true, isPublic: true } });
    if (!target || !target.isPublic) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const svc = await ms.toggleFollow(req.userId, target.id);
    if (svc.following) createNotification(target.id, req.userId, 'follow');
    res.json(svc);
  } catch (err) {
    next(err);
  }
});

// GET /u/:username/followers
router.get('/u/:username/followers', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username }, select: { id: true, isPublic: true } });
    if (!user || !user.isPublic) return res.status(404).json({ error: 'Not found' });

    const svc = await ms.getFollowers(user.id);
    if (!svc || !svc.users?.length) return res.json({ users: [], nextCursor: null });

    const users = await prisma.user.findMany({
      where: { id: { in: svc.users } },
      select: { id: true, name: true, username: true, avatarUrl: true, bio: true },
    });
    res.json({ users, nextCursor: null });
  } catch (err) {
    next(err);
  }
});

// GET /u/:username/following
router.get('/u/:username/following', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username }, select: { id: true, isPublic: true } });
    if (!user || !user.isPublic) return res.status(404).json({ error: 'Not found' });

    const svc = await ms.getFollowing(user.id);
    if (!svc || !svc.users?.length) return res.json({ users: [], nextCursor: null });

    const users = await prisma.user.findMany({
      where: { id: { in: svc.users } },
      select: { id: true, name: true, username: true, avatarUrl: true, bio: true },
    });
    res.json({ users, nextCursor: null });
  } catch (err) {
    next(err);
  }
});

// POST /u/:username/block — toggle block
router.post('/u/:username/block', authenticate, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { username: req.params.username }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Cannot block yourself' });

    const svc = await ms.toggleBlock(req.userId, target.id);
    res.json(svc);
  } catch (err) {
    next(err);
  }
});

// GET /blocked — list blocked users
router.get('/blocked', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.checkBlocked(req.userId);
    // Fallback to local for listing since social service checkBlocked is pair-based
    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: req.userId },
      include: { blocked: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users: blocks.map(b => b.blocked) });
  } catch (err) {
    next(err);
  }
});

// GET /u/:username/meals — public meals
router.get('/u/:username/meals', optionalAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, isPublic: true, followersOnly: true },
    });
    if (!user || !user.isPublic) return res.status(404).json({ error: 'Profile not found' });

    if (req.userId && req.userId !== user.id) {
      const svcBlocked = await ms.checkBlocked(user.id, req.userId);
      if (svcBlocked?.blocked) return res.status(404).json({ error: 'Profile not found' });
    }

    if (user.followersOnly && req.userId !== user.id) {
      let isFollower = false;
      if (req.userId) {
        const svcFollow = await ms.getUserFollowStats(user.id, req.userId);
        isFollower = svcFollow ? svcFollow.isFollowing : false;
      }
      if (!isFollower) return res.json({ meals: [], nextCursor: null });
    }

    const limit = Math.min(parseInt(req.query.limit) || 12, 48);
    const cursor = req.query.cursor || null;
    const meals = await prisma.meal.findMany({
      where: { userId: user.id, isPublic: true },
      orderBy: { consumedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, name: true, calories: true, proteinG: true, carbsG: true, fatG: true,
        photoUrl: true, consumedAt: true, source: true,
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

// GET /meals/:mealId — single public meal detail
router.get('/meals/:mealId', optionalAuth, async (req, res, next) => {
  try {
    const meal = await prisma.meal.findUnique({
      where: { id: req.params.mealId },
      include: {
        user: { select: { id: true, username: true, name: true, avatarUrl: true, isPublic: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!meal || !meal.user.isPublic || !meal.isPublic) return res.status(404).json({ error: 'Meal not found' });

    let isLiked = false;
    let isSaved = false;
    if (req.userId) {
      const engagement = await ms.getContentEngagement(meal.id, req.userId);
      isLiked = engagement?.isLiked || false;
      isSaved = engagement?.isSaved || false;
    }

    const svcComments = await ms.getComments(meal.id);
    let commentsWithLiked = [];
    if (svcComments) {
      const authorIds = [...new Set(svcComments.comments.map(c => c.userId))];
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, username: true, avatarUrl: true },
      });
      const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));
      commentsWithLiked = svcComments.comments.map(c => ({
        ...c,
        user: authorMap[c.userId] || null,
        isLiked: c.isLiked || false,
      }));
    }

    const { user, ...mealData } = meal;
    res.json({
      ...mealData,
      owner: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
      isLiked, isSaved,
      comments: commentsWithLiked,
    });
  } catch (err) {
    next(err);
  }
});

// POST /meals/:mealId/like — toggle like
router.post('/meals/:mealId/like', authenticate, async (req, res, next) => {
  try {
    const meal = await prisma.meal.findUnique({
      where: { id: req.params.mealId },
      include: { user: { select: { id: true, isPublic: true } } },
    });
    if (!meal || !meal.user.isPublic) return res.status(404).json({ error: 'Meal not found' });

    const svc = await ms.toggleLike(req.userId, meal.id);
    if (svc.liked) createNotification(meal.user.id, req.userId, 'like', { mealId: meal.id });
    res.json(svc);
  } catch (err) {
    next(err);
  }
});

// POST /meals/:mealId/comments — add comment
router.post('/meals/:mealId/comments', authenticate, async (req, res, next) => {
  try {
    const data = commentSchema.parse(req.body);
    const meal = await prisma.meal.findUnique({
      where: { id: req.params.mealId },
      include: { user: { select: { id: true, isPublic: true } } },
    });
    if (!meal || !meal.user.isPublic) return res.status(404).json({ error: 'Meal not found' });

    const svc = await ms.addComment(req.userId, meal.id, data.text);

    const author = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });

    createNotification(meal.user.id, req.userId, 'comment', { mealId: meal.id, commentId: svc.id });

    const mentions = data.text.match(/@([a-zA-Z0-9_]{3,30})/g);
    if (mentions) {
      const usernames = mentions.map(m => m.slice(1));
      const mentioned = await prisma.user.findMany({ where: { username: { in: usernames } }, select: { id: true } });
      for (const u of mentioned) {
        if (u.id !== req.userId && u.id !== meal.user.id) {
          createNotification(u.id, req.userId, 'mention', { mealId: meal.id, commentId: svc.id });
        }
      }
    }

    res.status(201).json({ ...svc, user: author });
  } catch (err) {
    next(err);
  }
});

// POST /comments/:commentId/like — toggle comment like
router.post('/comments/:commentId/like', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.toggleCommentLike(req.userId, req.params.commentId);
    res.json(svc);
  } catch (err) {
    next(err);
  }
});

// GET /meals/:mealId/comments — list comments
router.get('/meals/:mealId/comments', async (req, res, next) => {
  try {
    const meal = await prisma.meal.findUnique({
      where: { id: req.params.mealId },
      include: { user: { select: { isPublic: true } } },
    });
    if (!meal || !meal.user.isPublic) return res.status(404).json({ error: 'Meal not found' });

    const svc = await ms.getComments(meal.id, req.query.cursor, parseInt(req.query.limit) || 20);
    if (!svc) return res.json({ comments: [], nextCursor: null });

    const authorIds = [...new Set(svc.comments.map(c => c.userId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));
    const comments = svc.comments.map(c => ({ ...c, user: authorMap[c.userId] || null }));
    res.json({ comments, nextCursor: svc.nextCursor || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
