/**
 * Daily AI caps (src/utils/aiQuota.js). Requires a running PostgreSQL instance.
 * Run: node --test src/tests/ai-quota.test.js
 */
const { describe, test, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const prisma = require('../utils/prisma');
const aiQuota = require('../utils/aiQuota');

let user;

before(async () => {
  user = await prisma.user.create({
    data: { email: `quota_${crypto.randomUUID().slice(0, 8)}@example.com`, name: 'Quota Test' },
  });
});

after(async () => {
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

afterEach(async () => {
  delete process.env.AI_PAYWALL_ENABLED;
  await prisma.aiUsage.deleteMany({ where: { userId: user.id } });
});

describe('aiQuota', () => {
  test('everyone gets Pro limits until the paywall is enabled', () => {
    assert.strictEqual(aiQuota.tierFor(user), 'pro');
    process.env.AI_PAYWALL_ENABLED = 'true';
    assert.strictEqual(aiQuota.tierFor(user), 'free');
    assert.strictEqual(aiQuota.tierFor({ ...user, proUntil: new Date(Date.now() + 86400000) }), 'pro');
    assert.strictEqual(aiQuota.tierFor({ ...user, proUntil: new Date(Date.now() - 1000) }), 'free');
  });

  test('photo scans stop at the daily cap', async () => {
    const limit = aiQuota.LIMITS.pro.photoScans;
    for (let i = 0; i < limit; i++) {
      assert.strictEqual((await aiQuota.reserve(user, 'photoScans')).ok, true, `scan ${i + 1}`);
    }
    const denied = await aiQuota.reserve(user, 'photoScans');
    assert.strictEqual(denied.ok, false);
    assert.strictEqual(denied.limit, limit);
    assert.strictEqual(denied.used, limit);
    assert.ok(denied.resetsAt > new Date());
  });

  test('parallel requests cannot slip past the cap', async () => {
    const limit = aiQuota.LIMITS.pro.photoScans;
    const results = await Promise.all(Array.from({ length: limit + 15 }, () => aiQuota.reserve(user, 'photoScans')));
    assert.strictEqual(results.filter((r) => r.ok).length, limit);
    const { used } = await aiQuota.summary(user);
    assert.strictEqual(used.photoScans, limit);
  });

  test('release gives a failed scan back', async () => {
    await aiQuota.reserve(user, 'photoScans');
    await aiQuota.release(user, 'photoScans');
    assert.strictEqual((await aiQuota.summary(user)).used.photoScans, 0);
  });

  test('free tier: 1 scan a day, no voice', async () => {
    process.env.AI_PAYWALL_ENABLED = 'true';
    assert.strictEqual((await aiQuota.reserve(user, 'photoScans')).ok, true);
    assert.strictEqual((await aiQuota.reserve(user, 'photoScans')).ok, false);
    const voice = await aiQuota.reserve(user, 'voiceSeconds', 5);
    assert.strictEqual(voice.ok, false);
    assert.strictEqual(voice.limit, 0);
  });

  test('voice: reservation over the remaining seconds is refused, charge adds the real length', async () => {
    const limit = aiQuota.LIMITS.pro.voiceSeconds;
    assert.strictEqual((await aiQuota.reserve(user, 'voiceSeconds', limit - 10)).ok, true);
    assert.strictEqual((await aiQuota.reserve(user, 'voiceSeconds', 20)).ok, false);
    // App claimed 1s but Whisper measured 30s: charged past the cap, so the next request is refused.
    assert.strictEqual((await aiQuota.reserve(user, 'voiceSeconds', 1)).ok, true);
    await aiQuota.charge(user, 'voiceSeconds', 29);
    assert.strictEqual((await aiQuota.summary(user)).used.voiceSeconds, limit + 20);
    assert.strictEqual((await aiQuota.reserve(user, 'voiceSeconds', 1)).ok, false);
  });
});
