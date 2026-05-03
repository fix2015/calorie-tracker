const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

const router = Router();

// GET / — list notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const cursor = req.query.cursor || null;

    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();
    const nextCursor = hasMore ? notifications[notifications.length - 1].id : null;

    res.json({ notifications, nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /unread-count
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId, read: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// PATCH /read-all
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
