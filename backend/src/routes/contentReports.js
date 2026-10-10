// POST /api/reports — user-submitted content reports (meals, comments, users, messages).
// Mounted on /api/reports alongside the nutrition reports router (which only uses GET
// sub-paths and POST /backfill-stats), so POST / is free.
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const ms = require('../services/microservices');

const router = Router();

const reportSchema = z.object({
  targetType: z.enum(['MEAL', 'COMMENT', 'USER', 'MESSAGE']),
  targetId: z.string().min(1).max(100),
  reason: z.enum(['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'OTHER']),
  note: z.string().trim().max(500).optional().nullable(),
});

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Returns the id of the user who owns/sent the target, or throws 404. */
async function resolveTargetOwner(reporterId, targetType, targetId) {
  if (targetType === 'MEAL') {
    const meal = await prisma.meal.findUnique({ where: { id: targetId }, select: { userId: true } });
    if (!meal) throw httpError(404, 'Meal not found');
    return meal.userId;
  }

  if (targetType === 'USER') {
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!user) throw httpError(404, 'User not found');
    return user.id;
  }

  if (targetType === 'COMMENT') {
    const comment = await prisma.comment.findUnique({ where: { id: targetId }, select: { userId: true } });
    if (comment) return comment.userId;
    // Comments are stored by the social microservice in production; we can't look them up
    // locally, so accept the id when that service is configured.
    if (ms.SERVICES.social) return null;
    throw httpError(404, 'Comment not found');
  }

  // MESSAGE: targetId is the conversation id (the UI reports a conversation), or a local message id.
  const convs = await ms.getUserConversations(reporterId);
  const conv = convs?.conversations?.find((c) => c.id === targetId);
  if (conv?.otherUserId) return conv.otherUserId;

  const message = await prisma.message.findUnique({
    where: { id: targetId },
    select: { senderId: true, conversation: { select: { participants: { select: { userId: true } } } } },
  });
  if (message && message.conversation.participants.some((p) => p.userId === reporterId)) {
    return message.senderId;
  }
  throw httpError(404, 'Conversation not found');
}

router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = reportSchema.parse(req.body);
    const ownerId = await resolveTargetOwner(req.userId, data.targetType, data.targetId);
    if (ownerId && ownerId === req.userId) {
      return res.status(400).json({ error: 'You cannot report your own content' });
    }

    let report;
    try {
      report = await prisma.report.create({
        data: {
          reporterId: req.userId,
          targetType: data.targetType,
          targetId: data.targetId,
          reason: data.reason,
          note: data.note || null,
        },
      });
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'You have already reported this' });
      throw err;
    }

    // Reporting a conversation also blocks the other person for the reporter.
    // toggleBlock is a toggle, so only call it when not already blocked.
    let blocked = false;
    if (data.targetType === 'MESSAGE' && ownerId) {
      const existing = await ms.checkBlocked(req.userId, ownerId);
      if (existing?.blocked) {
        blocked = true;
      } else {
        const result = await ms.toggleBlock(req.userId, ownerId);
        blocked = !!result?.blocked;
      }
    }

    res.status(201).json({ id: report.id, status: report.status, blocked });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
