const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { commentSchema } = require('../utils/validation');
const { createNotification } = require('../utils/notifications');

const router = Router();

// GET /search — search public profiles
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        isPublic: true,
        username: { not: null },
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
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
router.get('/trending', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 48);
    const cursor = req.query.cursor || null;

    const meals = await prisma.meal.findMany({
      where: {
        isPublic: true,
        user: { isPublic: true },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, name: true, calories: true,
        proteinG: true, carbsG: true, fatG: true,
        photoUrl: true, consumedAt: true, source: true,
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
router.get('/popular-users', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const offset = parseInt(req.query.offset) || 0;

    const users = await prisma.user.findMany({
      where: {
        isPublic: true,
        username: { not: null },
      },
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
    const followingIds = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const excludeIds = [req.userId, ...followingIds.map(f => f.followingId)];

    const users = await prisma.user.findMany({
      where: {
        isPublic: true,
        username: { not: null },
        id: { notIn: excludeIds },
      },
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
    const followingIds = await prisma.follow.findMany({
      where: { followerId: req.userId },
      select: { followingId: true },
    });
    const ids = followingIds.map(f => f.followingId);

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

    // Check which meals current user has liked
    const mealIds = meals.map(m => m.id);
    const userLikes = await prisma.like.findMany({
      where: { userId: req.userId, mealId: { in: mealIds } },
      select: { mealId: true },
    });
    const likedSet = new Set(userLikes.map(l => l.mealId));

    const hasMore = meals.length > limit;
    if (hasMore) meals.pop();
    const nextCursor = hasMore ? meals[meals.length - 1].id : null;

    const feedMeals = meals.map(m => ({ ...m, isLiked: likedSet.has(m.id) }));
    res.json({ meals: feedMeals, nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /u/:username — public profile with follow counts
router.get('/u/:username', optionalAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, name: true, username: true, bio: true,
        avatarUrl: true, linkUrl: true, createdAt: true, isPublic: true,
        _count: { select: { followers: true, following: true, meals: true } },
      },
    });

    if (!user || !user.isPublic) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    let isFollowing = false;
    if (req.userId && req.userId !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.userId, followingId: user.id } },
      });
      isFollowing = !!follow;
    }

    const { isPublic, ...profile } = user;
    res.json({ ...profile, isFollowing });
  } catch (err) {
    next(err);
  }
});

// POST /u/:username/follow — toggle follow
router.post('/u/:username/follow', authenticate, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, isPublic: true },
    });

    if (!target || !target.isPublic) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.id === req.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId, followingId: target.id } },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
    } else {
      await prisma.follow.create({
        data: { followerId: req.userId, followingId: target.id },
      });
      createNotification(target.id, req.userId, 'follow');
    }

    const followersCount = await prisma.follow.count({ where: { followingId: target.id } });
    res.json({ following: !existing, followersCount });
  } catch (err) {
    next(err);
  }
});

// GET /u/:username/followers
router.get('/u/:username/followers', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, isPublic: true },
    });
    if (!user || !user.isPublic) return res.status(404).json({ error: 'Not found' });

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    const follows = await prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { follower: { select: { id: true, name: true, username: true, avatarUrl: true, bio: true } } },
    });

    const hasMore = follows.length > limit;
    if (hasMore) follows.pop();
    const nextCursor = hasMore ? follows[follows.length - 1].id : null;

    res.json({ users: follows.map(f => f.follower), nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /u/:username/following
router.get('/u/:username/following', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, isPublic: true },
    });
    if (!user || !user.isPublic) return res.status(404).json({ error: 'Not found' });

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    const follows = await prisma.follow.findMany({
      where: { followerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { following: { select: { id: true, name: true, username: true, avatarUrl: true, bio: true } } },
    });

    const hasMore = follows.length > limit;
    if (hasMore) follows.pop();
    const nextCursor = hasMore ? follows[follows.length - 1].id : null;

    res.json({ users: follows.map(f => f.following), nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /u/:username/meals — public meals with cursor pagination
router.get('/u/:username/meals', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, isPublic: true },
    });

    if (!user || !user.isPublic) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 12, 48);
    const cursor = req.query.cursor || null;

    const meals = await prisma.meal.findMany({
      where: { userId: user.id, isPublic: true },
      orderBy: { consumedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, name: true, calories: true,
        proteinG: true, carbsG: true, fatG: true,
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

    if (!meal || !meal.user.isPublic || !meal.isPublic) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    let isLiked = false;
    if (req.userId) {
      const like = await prisma.like.findUnique({
        where: { userId_mealId: { userId: req.userId, mealId: meal.id } },
      });
      isLiked = !!like;
    }

    const comments = await prisma.comment.findMany({
      where: { mealId: meal.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });

    const { user, ...mealData } = meal;
    res.json({
      ...mealData,
      owner: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
      isLiked,
      comments,
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

    if (!meal || !meal.user.isPublic) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    const existing = await prisma.like.findUnique({
      where: { userId_mealId: { userId: req.userId, mealId: meal.id } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
    } else {
      await prisma.like.create({
        data: { userId: req.userId, mealId: meal.id },
      });
      createNotification(meal.user.id, req.userId, 'like', { mealId: meal.id });
    }

    const likesCount = await prisma.like.count({ where: { mealId: meal.id } });
    res.json({ liked: !existing, likesCount });
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

    if (!meal || !meal.user.isPublic) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    const comment = await prisma.comment.create({
      data: { userId: req.userId, mealId: meal.id, text: data.text },
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });

    createNotification(meal.user.id, req.userId, 'comment', { mealId: meal.id, commentId: comment.id });

    // Also notify any @mentioned users
    const mentions = data.text.match(/@([a-zA-Z0-9_]{3,30})/g);
    if (mentions) {
      const usernames = mentions.map(m => m.slice(1));
      const mentioned = await prisma.user.findMany({
        where: { username: { in: usernames } },
        select: { id: true },
      });
      for (const u of mentioned) {
        if (u.id !== req.userId && u.id !== meal.user.id) {
          createNotification(u.id, req.userId, 'mention', { mealId: meal.id, commentId: comment.id });
        }
      }
    }

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

// GET /meals/:mealId/comments — list comments with cursor pagination
router.get('/meals/:mealId/comments', async (req, res, next) => {
  try {
    const meal = await prisma.meal.findUnique({
      where: { id: req.params.mealId },
      include: { user: { select: { isPublic: true } } },
    });

    if (!meal || !meal.user.isPublic) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    const comments = await prisma.comment.findMany({
      where: { mealId: meal.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });

    const hasMore = comments.length > limit;
    if (hasMore) comments.pop();
    const nextCursor = hasMore ? comments[comments.length - 1].id : null;

    res.json({ comments, nextCursor });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
