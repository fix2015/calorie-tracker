/**
 * Calorize Pro subscription state.
 *
 * The app buys through RevenueCat with our user id as the RevenueCat app_user_id (Purchases.logIn).
 * RevenueCat is the source of truth: both the app's POST /sync (right after a purchase or restore,
 * and on launch) and RevenueCat's webhook (renewals, cancellations, expiry) re-read the subscriber
 * from RevenueCat's REST API and store the `pro` entitlement's expiry in users.pro_until.
 * The webhook body is never trusted for the expiry itself, only for which user to refresh.
 */
const { Router } = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const aiQuota = require('../utils/aiQuota');

const router = Router();
const ENTITLEMENT = 'pro';
const RC_API = process.env.REVENUECAT_API_URL || 'https://api.revenuecat.com';

async function fetchSubscriber(userId) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) throw Object.assign(new Error('REVENUECAT_SECRET_KEY is not set'), { status: 503 });
  const r = await fetch(`${RC_API}/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw Object.assign(new Error(`RevenueCat ${r.status}`), { status: 502 });
  return (await r.json()).subscriber;
}

/** Pure: RevenueCat subscriber → { proUntil, proProductId }. Lifetime entitlements (no expiry) map to year 9999. */
function proFromSubscriber(subscriber) {
  const ent = subscriber && subscriber.entitlements && subscriber.entitlements[ENTITLEMENT];
  if (!ent) return { proUntil: null, proProductId: null };
  const proUntil = ent.expires_date ? new Date(ent.expires_date) : new Date('9999-12-31T00:00:00Z');
  return { proUntil, proProductId: ent.product_identifier || null };
}

async function refreshPro(userId) {
  const data = proFromSubscriber(await fetchSubscriber(userId));
  return prisma.user.update({ where: { id: userId }, data });
}

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(await aiQuota.summary(user));
  } catch (err) {
    next(err);
  }
});

router.post('/sync', authenticate, async (req, res, next) => {
  try {
    const user = await refreshPro(req.userId);
    res.json(await aiQuota.summary(user));
  } catch (err) {
    next(err);
  }
});

router.post('/revenuecat-webhook', async (req, res, next) => {
  try {
    const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected || req.headers.authorization !== expected) return res.status(401).json({ error: 'Unauthorized' });

    const event = (req.body && req.body.event) || {};
    // TRANSFER moves purchases between ids; refresh everyone involved.
    const ids = new Set([event.app_user_id, event.original_app_user_id, ...(event.aliases || []), ...(event.transferred_from || []), ...(event.transferred_to || [])]
      .filter((id) => typeof id === 'string' && !id.startsWith('$RCAnonymousID')));
    const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
    for (const u of users) await refreshPro(u.id);
    res.json({ ok: true, refreshed: users.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.proFromSubscriber = proFromSubscriber;
