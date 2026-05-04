const ms = require('../services/microservices');

async function createNotification(userId, actorId, type, opts = {}) {
  if (userId === actorId) return;
  try {
    await ms.sendNotification(userId, actorId, type, opts);
  } catch {
    // non-blocking — don't crash if notification fails
  }
}

module.exports = { createNotification };
