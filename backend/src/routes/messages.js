const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const { z } = require('zod');
const ms = require('../services/microservices');

const router = Router();

const messageSchema = z.object({ text: z.string().min(1).max(2000) });
const startSchema = z.object({ userId: z.string().min(1) });

// GET / — list conversations
router.get('/', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.getUserConversations(req.userId);
    if (!svc) return res.json({ conversations: [] });

    const userIds = svc.conversations.map(c => c.otherUserId).filter(Boolean);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const enriched = svc.conversations.map(c => ({
      ...c, otherUser: userMap[c.otherUserId] || null, unreadCount: c.unread ? 1 : 0,
    }));
    res.json({ conversations: enriched });
  } catch (err) {
    next(err);
  }
});

// POST / — start or get existing conversation
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { userId: targetId } = startSchema.parse(req.body);
    if (targetId === req.userId) return res.status(400).json({ error: 'Cannot message yourself' });

    const svc = await ms.findOrCreateConversation([req.userId, targetId]);
    if (!svc) return res.status(503).json({ error: 'Messaging service unavailable' });

    const otherUser = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, username: true, avatarUrl: true } });
    res.json({ id: svc.id, otherUser });
  } catch (err) {
    next(err);
  }
});

// GET /:conversationId — get messages
router.get('/:conversationId', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const svc = await ms.getMessages(req.params.conversationId, req.query.cursor, limit);
    if (!svc) return res.json({ messages: [], nextCursor: null });

    const senderIds = [...new Set(svc.messages.map(m => m.senderId))];
    const senders = await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true, username: true, avatarUrl: true } });
    const senderMap = Object.fromEntries(senders.map(s => [s.id, s]));
    const enriched = svc.messages.map(m => ({ ...m, sender: senderMap[m.senderId] || null }));
    res.json({ messages: enriched, nextCursor: svc.nextCursor });
  } catch (err) {
    next(err);
  }
});

// POST /:conversationId — send message
router.post('/:conversationId', authenticate, async (req, res, next) => {
  try {
    const { text } = messageSchema.parse(req.body);
    const svc = await ms.sendMessage(req.params.conversationId, req.userId, text);
    if (!svc) return res.status(503).json({ error: 'Messaging service unavailable' });

    const sender = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, username: true, avatarUrl: true } });
    const convData = await ms.getUserConversations(req.userId).catch(() => null);
    const conv = convData?.conversations?.find(c => c.id === req.params.conversationId);
    if (conv?.otherUserId) createNotification(conv.otherUserId, req.userId, 'message');
    res.status(201).json({ ...svc, sender });
  } catch (err) {
    next(err);
  }
});

// PATCH /:conversationId/read
router.patch('/:conversationId/read', authenticate, async (req, res, next) => {
  try {
    await ms.markConversationRead(req.params.conversationId, req.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
