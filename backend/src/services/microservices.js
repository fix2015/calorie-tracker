/**
 * HTTP client for calling microservices.
 * Falls back to direct Prisma queries if service is unavailable.
 */

const SERVICE_KEY = process.env.SERVICE_API_KEY || 'dev-key-change-me';

const SERVICES = {
  image: process.env.SERVICE_IMAGE_URL || null,
  notification: process.env.SERVICE_NOTIFICATION_URL || null,
  messaging: process.env.SERVICE_MESSAGING_URL || null,
  social: process.env.SERVICE_SOCIAL_URL || null,
  video: process.env.SERVICE_VIDEO_URL || null,
};

async function serviceCall(service, path, opts = {}) {
  const baseUrl = SERVICES[service];
  if (!baseUrl) return null; // Service not configured — caller should fallback to Prisma

  try {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout(3000),
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': SERVICE_KEY,
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Service ${service} error: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    console.error(`[microservice] ${service}${path} failed:`, err.message);
    return null; // Service unreachable — caller should fallback
  }
}

// ─── Notification Service ───

async function sendNotification(userId, actorId, type, data = {}) {
  if (!SERVICES.notification) return null;
  return serviceCall('notification', '/send', {
    method: 'POST',
    body: { userId, actorId, type, data },
  }).catch(() => null); // Non-blocking
}

async function getNotifications(userId, cursor, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return serviceCall('notification', `/user/${userId}?${params}`);
}

async function getUnreadCount(userId) {
  return serviceCall('notification', `/user/${userId}/unread`);
}

async function markNotificationRead(id) {
  return serviceCall('notification', `/${id}/read`, { method: 'PATCH' });
}

async function markAllNotificationsRead(userId) {
  return serviceCall('notification', `/user/${userId}/read-all`, { method: 'PATCH' });
}

// ─── Messaging Service ───

async function findOrCreateConversation(userIds) {
  return serviceCall('messaging', '/conversations', {
    method: 'POST',
    body: { userIds },
  });
}

async function getUserConversations(userId) {
  return serviceCall('messaging', `/user/${userId}/conversations`);
}

async function sendMessage(conversationId, senderId, text) {
  return serviceCall('messaging', `/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { senderId, text },
  });
}

async function getMessages(conversationId, cursor, limit = 30) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return serviceCall('messaging', `/conversations/${conversationId}/messages?${params}`);
}

async function markConversationRead(conversationId, userId) {
  return serviceCall('messaging', `/conversations/${conversationId}/read`, {
    method: 'PATCH',
    body: { userId },
  });
}

async function getUnreadMessagesCount(userId) {
  return serviceCall('messaging', `/user/${userId}/unread`);
}

// ─── Social Service ───

async function toggleLike(userId, contentId) {
  return serviceCall('social', '/likes/toggle', {
    method: 'POST',
    body: { userId, contentId },
  });
}

async function getContentEngagement(contentId, userId) {
  const params = userId ? `?userId=${userId}` : '';
  return serviceCall('social', `/engagement/${contentId}${params}`);
}

async function addComment(userId, contentId, text) {
  return serviceCall('social', '/comments', {
    method: 'POST',
    body: { userId, contentId, text },
  });
}

async function getComments(contentId, cursor, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return serviceCall('social', `/comments/content/${contentId}?${params}`);
}

async function toggleCommentLike(userId, commentId) {
  return serviceCall('social', `/comments/${commentId}/like`, {
    method: 'POST',
    body: { userId },
  });
}

async function toggleFollow(followerId, followingId) {
  return serviceCall('social', '/follows/toggle', {
    method: 'POST',
    body: { followerId, followingId },
  });
}

async function getUserFollowStats(userId, checkerId) {
  const params = checkerId ? `?checkerId=${checkerId}` : '';
  return serviceCall('social', `/follows/user/${userId}${params}`);
}

async function getFollowers(userId) {
  return serviceCall('social', `/follows/user/${userId}/followers`);
}

async function getFollowing(userId) {
  return serviceCall('social', `/follows/user/${userId}/following`);
}

async function toggleBlock(blockerId, blockedId) {
  return serviceCall('social', '/blocks/toggle', {
    method: 'POST',
    body: { blockerId, blockedId },
  });
}

async function checkBlocked(blockerId, blockedId) {
  return serviceCall('social', `/blocks/check?blockerId=${blockerId}&blockedId=${blockedId}`);
}

async function toggleSave(userId, contentId) {
  return serviceCall('social', '/saves/toggle', {
    method: 'POST',
    body: { userId, contentId },
  });
}

async function getSavedContent(userId, cursor, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return serviceCall('social', `/saves/user/${userId}?${params}`);
}

// ─── Image Service ───

async function uploadImage(buffer, opts = {}) {
  if (!SERVICES.image) return null;

  const FormData = (await import('node:buffer')).FormData || globalThis.FormData;
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
  if (opts.maxWidth) form.append('maxWidth', String(opts.maxWidth));
  if (opts.maxHeight) form.append('maxHeight', String(opts.maxHeight));
  if (opts.cover) form.append('cover', 'true');
  if (opts.prefix) form.append('prefix', opts.prefix);

  const res = await fetch(`${SERVICES.image}/upload`, {
    method: 'POST',
    headers: { 'X-Service-Key': SERVICE_KEY },
    body: form,
  });

  if (!res.ok) throw new Error('Image upload failed');
  return res.json();
}

// ─── Video/Stories Service ───

async function getStoriesFeed(userIds, viewerId) {
  return serviceCall('video', `/stories/feed?userIds=${userIds.join(',')}&viewerId=${viewerId || ''}`);
}

async function getUserStories(userId, viewerId) {
  const params = viewerId ? `?viewerId=${viewerId}` : '';
  return serviceCall('video', `/stories/user/${userId}${params}`);
}

async function markStoryViewed(storyId, viewerId) {
  return serviceCall('video', `/stories/${storyId}/view`, {
    method: 'POST',
    body: { viewerId },
  });
}

async function deleteStory(storyId) {
  return serviceCall('video', `/stories/${storyId}`, { method: 'DELETE' });
}

async function getStoryViewers(storyId) {
  return serviceCall('video', `/stories/${storyId}/viewers`);
}

module.exports = {
  SERVICES,
  serviceCall,
  // Notifications
  sendNotification,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  // Messaging
  findOrCreateConversation,
  getUserConversations,
  sendMessage,
  getMessages,
  markConversationRead,
  getUnreadMessagesCount,
  // Social
  toggleLike,
  getContentEngagement,
  addComment,
  getComments,
  toggleCommentLike,
  toggleFollow,
  getUserFollowStats,
  getFollowers,
  getFollowing,
  toggleBlock,
  checkBlocked,
  toggleSave,
  getSavedContent,
  // Image
  uploadImage: uploadImage,
  // Video/Stories
  getStoriesFeed,
  getUserStories,
  markStoryViewed,
  deleteStory,
  getStoryViewers,
};
