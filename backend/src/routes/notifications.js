const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const ms = require('../services/microservices');

const router = Router();

// GET / — list notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.getNotifications(req.userId, req.query.cursor, parseInt(req.query.limit) || 30);
    if (!svc) return res.json({ notifications: [], nextCursor: null });

    const actorIds = [...new Set(svc.notifications.map(n => n.actorId))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });
    const actorMap = Object.fromEntries(actors.map(a => [a.id, a]));
    const enriched = svc.notifications.map(n => ({ ...n, actor: actorMap[n.actorId] || null }));
    res.json({ notifications: enriched, nextCursor: svc.nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /unread-count
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.getUnreadCount(req.userId);
    if (svc) return res.json(svc);
    res.json({ count: 0 });
  } catch (err) {
    next(err);
  }
});

// PATCH /read-all
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await ms.markAllNotificationsRead(req.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await ms.markNotificationRead(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
