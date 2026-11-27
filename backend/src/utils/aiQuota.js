/**
 * Daily caps on paid AI calls, stored in the ai_usage table so they survive restarts and deploys.
 *
 * The caps are sized so a user can never cost more in OpenAI fees than a subscription pays us:
 * the yearly plan nets ~£1.46–1.77 a month after VAT and Apple's cut, and a maxed-out Pro user
 * (10 scans + 3 min voice every day) costs ~£1.20–1.65 a month depending on scan cost.
 *
 * Until the paywall ships (AI_PAYWALL_ENABLED=true and a Pro flag on the user), everyone gets
 * the Pro limits, so current users lose nothing but the unlimited worst case is gone.
 */
const prisma = require('./prisma');

const LIMITS = {
  free: { photoScans: 1, voiceSeconds: 60, analyses: 1 },
  pro: { photoScans: 10, voiceSeconds: 180, analyses: 10 },
};

const KINDS = Object.keys(LIMITS.free);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextResetAt() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

// eslint-disable-next-line no-unused-vars
function tierFor(user) {
  if (process.env.AI_PAYWALL_ENABLED !== 'true') return 'pro';
  // The Pro flag arrives with the RevenueCat integration; until then nobody is Pro once the paywall is on.
  return user && user.isPro ? 'pro' : 'free';
}

function limitsFor(user) {
  return LIMITS[tierFor(user)];
}

async function getUsage(userId) {
  const row = await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: today() } } });
  return Object.fromEntries(KINDS.map((k) => [k, row ? row[k] : 0]));
}

/**
 * Atomically reserve `amount` units of `kind` for today. Returns { ok: true } or
 * { ok: false, limit, used, resetsAt } when the reservation would go over the cap.
 * The conditional UPDATE runs as one statement, so parallel requests can't both slip under the cap.
 */
async function reserve(user, kind, amount = 1) {
  if (!KINDS.includes(kind)) throw new Error(`Unknown AI quota kind: ${kind}`);
  const limit = limitsFor(user)[kind];
  const day = today();
  const userId = user.id;

  await prisma.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day },
    update: {},
  });

  const { count } = await prisma.aiUsage.updateMany({
    where: { userId, day, [kind]: { lte: limit - amount } },
    data: { [kind]: { increment: amount } },
  });
  if (count === 1) return { ok: true };

  const used = (await getUsage(userId))[kind];
  return { ok: false, limit, used, resetsAt: nextResetAt() };
}

/** Add usage without checking the cap (e.g. when the real cost turned out higher than reserved). */
async function charge(user, kind, amount) {
  if (amount <= 0) return;
  await prisma.aiUsage.upsert({
    where: { userId_day: { userId: user.id, day: today() } },
    create: { userId: user.id, day: today(), [kind]: amount },
    update: { [kind]: { increment: amount } },
  });
}

/** Give back a reservation when the AI call failed on our side and the user got nothing. */
async function release(user, kind, amount = 1) {
  await prisma.aiUsage.updateMany({
    where: { userId: user.id, day: today(), [kind]: { gte: amount } },
    data: { [kind]: { decrement: amount } },
  });
}

async function summary(user) {
  const used = await getUsage(user.id);
  const limits = limitsFor(user);
  return { tier: tierFor(user), used, limits, resetsAt: nextResetAt() };
}

module.exports = { LIMITS, reserve, release, charge, summary, limitsFor, tierFor };
