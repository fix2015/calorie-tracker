const prisma = require('./prisma');

async function createNotification(userId, actorId, type, opts = {}) {
  if (userId === actorId) return; // don't notify yourself
  try {
    await prisma.notification.create({
      data: {
        userId,
        actorId,
        type,
        mealId: opts.mealId || null,
        commentId: opts.commentId || null,
      },
    });
  } catch {
    // non-blocking — don't crash if notification fails
  }
}

module.exports = { createNotification };
