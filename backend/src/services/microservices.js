/**
 * HTTP client for calling microservices.
 * Falls back to direct Prisma queries if service is unavailable.
 */

const prisma = require('../utils/prisma');
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

// ─── Social Service (with local Prisma fallbacks) ───

async function toggleLike(userId, contentId) {
  const svc = await serviceCall('social', '/likes/toggle', {
    method: 'POST',
    body: { userId, contentId },
  });
  if (svc) return svc;

  // Prisma fallback
  const existing = await prisma.like.findUnique({
    where: { userId_mealId: { userId, mealId: contentId } },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    const likesCount = await prisma.like.count({ where: { mealId: contentId } });
    return { liked: false, likesCount };
  }
  await prisma.like.create({ data: { userId, mealId: contentId } });
  const likesCount = await prisma.like.count({ where: { mealId: contentId } });
  return { liked: true, likesCount };
}

async function getContentEngagement(contentId, userId) {
  const svc = await serviceCall('social', `/engagement/${contentId}?userId=${userId}`);
  if (svc) return svc;

  // Prisma fallback
  const [like, save] = await Promise.all([
    userId ? prisma.like.findUnique({ where: { userId_mealId: { userId, mealId: contentId } } }) : null,
    userId ? prisma.savedMeal.findUnique({ where: { userId_mealId: { userId, mealId: contentId } } }) : null,
  ]);
  return { isLiked: !!like, isSaved: !!save };
}

async function addComment(userId, contentId, text) {
  const svc = await serviceCall('social', '/comments', {
    method: 'POST',
    body: { userId, contentId, text },
  });
  if (svc) return svc;

  // Prisma fallback
  const comment = await prisma.comment.create({
    data: { userId, mealId: contentId, text },
  });
  return { id: comment.id, userId, contentId, text, createdAt: comment.createdAt, likesCount: 0, isLiked: false };
}

async function getComments(contentId, cursor, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const svc = await serviceCall('social', `/comments/content/${contentId}?${params}`);
  if (svc) return svc;

  // Prisma fallback
  const comments = await prisma.comment.findMany({
    where: { mealId: contentId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { _count: { select: { likes: true } } },
  });
  const hasMore = comments.length > limit;
  if (hasMore) comments.pop();
  return {
    comments: comments.map(c => ({
      id: c.id, userId: c.userId, contentId: c.mealId, text: c.text,
      createdAt: c.createdAt, likesCount: c._count.likes, isLiked: false,
    })),
    nextCursor: hasMore ? comments[comments.length - 1].id : null,
  };
}

async function toggleCommentLike(userId, commentId) {
  const svc = await serviceCall('social', `/comments/${commentId}/like`, {
    method: 'POST',
    body: { userId },
  });
  if (svc) return svc;

  // Prisma fallback
  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId, commentId } },
  });
  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    const likesCount = await prisma.commentLike.count({ where: { commentId } });
    return { liked: false, likesCount };
  }
  await prisma.commentLike.create({ data: { userId, commentId } });
  const likesCount = await prisma.commentLike.count({ where: { commentId } });
  return { liked: true, likesCount };
}

async function toggleFollow(followerId, followingId) {
  const svc = await serviceCall('social', '/follows/toggle', {
    method: 'POST',
    body: { followerId, followingId },
  });
  if (svc) return svc;

  // Prisma fallback
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return { following: false };
  }
  await prisma.follow.create({ data: { followerId, followingId } });
  return { following: true };
}

async function getUserFollowStats(userId, checkerId) {
  const params = checkerId ? `?checkerId=${checkerId}` : '';
  const svc = await serviceCall('social', `/follows/user/${userId}${params}`);
  if (svc) return svc;

  // Prisma fallback
  if (!checkerId) return { isFollowing: false };
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: checkerId, followingId: userId } },
  });
  return { isFollowing: !!follow };
}

async function getFollowers(userId) {
  const svc = await serviceCall('social', `/follows/user/${userId}/followers`);
  if (svc) return svc;

  // Prisma fallback
  const follows = await prisma.follow.findMany({
    where: { followingId: userId },
    select: { followerId: true },
  });
  return { users: follows.map(f => f.followerId) };
}

async function getFollowing(userId) {
  const svc = await serviceCall('social', `/follows/user/${userId}/following`);
  if (svc) return svc;

  // Prisma fallback
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  return { users: follows.map(f => f.followingId) };
}

async function toggleBlock(blockerId, blockedId) {
  const svc = await serviceCall('social', '/blocks/toggle', {
    method: 'POST',
    body: { blockerId, blockedId },
  });
  if (svc) return svc;

  // Prisma fallback
  const existing = await prisma.blockedUser.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  if (existing) {
    await prisma.blockedUser.delete({ where: { id: existing.id } });
    return { blocked: false };
  }
  await prisma.blockedUser.create({ data: { blockerId, blockedId } });
  return { blocked: true };
}

async function checkBlocked(blockerId, blockedId) {
  const svc = await serviceCall('social', `/blocks/check?blockerId=${blockerId}&blockedId=${blockedId}`);
  if (svc) return svc;

  // Prisma fallback
  if (!blockedId) return { blocked: false };
  const block = await prisma.blockedUser.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  return { blocked: !!block };
}

async function toggleSave(userId, contentId) {
  const svc = await serviceCall('social', '/saves/toggle', {
    method: 'POST',
    body: { userId, contentId },
  });
  if (svc) return svc;

  // Prisma fallback
  const existing = await prisma.savedMeal.findUnique({
    where: { userId_mealId: { userId, mealId: contentId } },
  });
  if (existing) {
    await prisma.savedMeal.delete({ where: { id: existing.id } });
    return { saved: false };
  }
  await prisma.savedMeal.create({ data: { userId, mealId: contentId } });
  return { saved: true };
}

async function getSavedContent(userId, cursor, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const svc = await serviceCall('social', `/saves/user/${userId}?${params}`);
  if (svc) return svc;

  // Prisma fallback
  const saves = await prisma.savedMeal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = saves.length > limit;
  if (hasMore) saves.pop();
  return {
    saves: saves.map(s => ({ contentId: s.mealId })),
    nextCursor: hasMore ? saves[saves.length - 1].id : null,
  };
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
