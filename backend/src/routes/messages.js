const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const { z } = require('zod');

const router = Router();

const messageSchema = z.object({ text: z.string().min(1).max(2000) });
const startSchema = z.object({ userId: z.string().min(1) });

// GET / — list conversations
router.get('/', authenticate, async (req, res, next) => {
  try {
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId: req.userId },
      include: {
        conversation: {
          include: {
            participants: {
              where: { userId: { not: req.userId } },
              include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    const conversations = await Promise.all(participations.map(async (p) => {
      const otherUser = p.conversation.participants[0]?.user || null;
      const lastMessage = p.conversation.messages[0] || null;
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: req.userId },
          createdAt: p.lastReadAt ? { gt: p.lastReadAt } : undefined,
        },
      });
      return {
        id: p.conversationId,
        otherUser,
        lastMessage,
        unreadCount,
        updatedAt: p.conversation.updatedAt,
      };
    }));

    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

// POST / — start or get existing conversation
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { userId: targetId } = startSchema.parse(req.body);
    if (targetId === req.userId) return res.status(400).json({ error: 'Cannot message yourself' });

    // Find existing conversation between the two users
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: req.userId } } },
          { participants: { some: { userId: targetId } } },
        ],
      },
      include: {
        participants: {
          where: { userId: { not: req.userId } },
          include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        },
      },
    });

    if (existing) {
      return res.json({ id: existing.id, otherUser: existing.participants[0]?.user });
    }

    // Create new conversation
    const conv = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: req.userId },
            { userId: targetId },
          ],
        },
      },
      include: {
        participants: {
          where: { userId: targetId },
          include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        },
      },
    });

    res.status(201).json({ id: conv.id, otherUser: conv.participants[0]?.user });
  } catch (err) {
    next(err);
  }
});

// GET /:conversationId — get messages
router.get('/:conversationId', authenticate, async (req, res, next) => {
  try {
    // Verify user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: req.params.conversationId, userId: req.userId } },
    });
    if (!participant) return res.status(404).json({ error: 'Conversation not found' });

    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const cursor = req.query.cursor || null;

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    res.json({ messages, nextCursor });
  } catch (err) {
    next(err);
  }
});

// POST /:conversationId — send message
router.post('/:conversationId', authenticate, async (req, res, next) => {
  try {
    const { text } = messageSchema.parse(req.body);

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: req.params.conversationId, userId: req.userId } },
    });
    if (!participant) return res.status(404).json({ error: 'Conversation not found' });

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.conversationId,
        senderId: req.userId,
        text,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });

    // Touch conversation updatedAt
    await prisma.conversation.update({
      where: { id: req.params.conversationId },
      data: { updatedAt: new Date() },
    });

    // Update sender's lastReadAt
    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: new Date() },
    });

    // Notify other participant
    const otherParticipant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: req.params.conversationId, userId: { not: req.userId } },
    });
    if (otherParticipant) {
      createNotification(otherParticipant.userId, req.userId, 'message');
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// PATCH /:conversationId/read — mark as read
router.patch('/:conversationId/read', authenticate, async (req, res, next) => {
  try {
    await prisma.conversationParticipant.updateMany({
      where: { conversationId: req.params.conversationId, userId: req.userId },
      data: { lastReadAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
