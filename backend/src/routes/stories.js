const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { uploadVideo } = require('../middleware/upload');
const ms = require('../services/microservices');

const router = Router();

const SERVICE_KEY = process.env.SERVICE_API_KEY || 'dev-key-change-me';
const VIDEO_URL = process.env.SERVICE_VIDEO_URL;

// POST / — upload a story
router.post('/', authenticate, uploadVideo.single('video'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video uploaded' });
    if (!VIDEO_URL) return res.status(503).json({ error: 'Video service not available' });

    // Forward file to video service
    const fs = require('fs');
    const FormData = globalThis.FormData;
    const form = new FormData();
    const blob = new Blob([fs.readFileSync(req.file.path)], { type: req.file.mimetype });
    form.append('video', blob, req.file.originalname);
    form.append('userId', req.userId);

    const response = await fetch(`${VIDEO_URL}/stories`, {
      method: 'POST',
      headers: { 'X-Service-Key': SERVICE_KEY },
      body: form,
    });

    // Cleanup local file
    fs.unlink(req.file.path, () => {});

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error || 'Upload failed' });
    }

    const story = await response.json();
    res.status(201).json(story);
  } catch (err) {
    next(err);
  }
});

// GET /feed — stories for followed users + own
router.get('/feed', authenticate, async (req, res, next) => {
  try {
    // Get following list from social service
    const svcFollowing = await ms.getFollowing(req.userId);
    const followingIds = svcFollowing ? svcFollowing.users : [];

    const userIds = [req.userId, ...followingIds];

    const svc = await ms.getStoriesFeed(userIds, req.userId);
    if (!svc) return res.json({ users: [] });

    // Enrich with user details
    const allUserIds = svc.users.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = svc.users.map(u => ({
      ...u,
      user: userMap[u.userId] || null,
    }));

    // Put current user first
    enriched.sort((a, b) => {
      if (a.userId === req.userId) return -1;
      if (b.userId === req.userId) return 1;
      return 0;
    });

    res.json({ users: enriched });
  } catch (err) {
    next(err);
  }
});

// GET /user/:userId — stories for a specific user
router.get('/user/:userId', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.getUserStories(req.params.userId, req.userId);
    if (!svc) return res.json({ stories: [] });
    res.json(svc);
  } catch (err) {
    next(err);
  }
});

// POST /:id/view — mark as viewed
router.post('/:id/view', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.markStoryViewed(req.params.id, req.userId);
    res.json(svc || { viewed: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete own story
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.deleteStory(req.params.id);
    res.json(svc || { deleted: true });
  } catch (err) {
    next(err);
  }
});

// GET /:id/viewers — who viewed
router.get('/:id/viewers', authenticate, async (req, res, next) => {
  try {
    const svc = await ms.getStoryViewers(req.params.id);
    if (!svc) return res.json({ viewers: [] });

    // Enrich with user details
    const viewerIds = svc.viewers.map(v => v.viewerId);
    const users = await prisma.user.findMany({
      where: { id: { in: viewerIds } },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = svc.viewers.map(v => ({
      ...v,
      user: userMap[v.viewerId] || null,
    }));

    res.json({ viewers: enriched });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
