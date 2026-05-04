const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const ms = require('../services/microservices');

const router = Router();

// GET / — list notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.getNotifications(req.userId, req.query.cursor, parseInt(req.query.limit) || 30);
    if (svc) {
      // Service doesn't include actor user details — enrich from local DB
      const actorIds = [...new Set(svc.notifications.map(n => n.actorId))];
      const actors = await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, username: true, avatarUrl: true },
      });
      const actorMap = Object.fromEntries(actors.map(a => [a.id, a]));
      const enriched = svc.notifications.map(n => ({ ...n, actor: actorMap[n.actorId] || null }));
      return res.json({ notifications: enriched, nextCursor: svc.nextCursor });
    }

    // Fallback to direct DB
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const cursor = req.query.cursor || null;
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { actor: { select: { id: true, name: true, username: true, avatarUrl: true } } },
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
    const svc = await ms.getUnreadCount(req.userId);
    if (svc) return res.json(svc);

    const count = await prisma.notification.count({ where: { userId: req.userId, read: false } });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// PATCH /read-all
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.markAllNotificationsRead(req.userId);
    if (svc) return res.json({ ok: true });

    await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.markNotificationRead(req.params.id);
    if (svc) return res.json({ ok: true });

    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
