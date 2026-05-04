const prisma = require('./prisma');
const ms = require('../services/microservices');

async function createNotification(userId, actorId, type, opts = {}) {
  if (userId === actorId) return;
  try {
    const result = await ms.sendNotification(userId, actorId, type, opts);
    if (result) return; // Service handled it

    // Fallback to direct DB
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
    // non-blocking
  }
}

module.exports = { createNotification };
