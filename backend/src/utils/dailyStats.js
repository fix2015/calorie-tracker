const prisma = require('./prisma');

/**
 * Recalculate daily stats for a user on a specific date.
 * Called after meal create/update/delete.
 */
async function refreshDailyStat(userId, date) {
  const dateStr = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  const meals = await prisma.meal.findMany({
    where: {
      userId,
      consumedAt: { gte: dayStart, lte: dayEnd },
    },
    select: { calories: true, proteinG: true, carbsG: true, fatG: true },
  });

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  await prisma.dailyStat.upsert({
    where: { userId_date: { userId, date: dateStr } },
    update: {
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      mealCount: meals.length,
    },
    create: {
      userId,
      date: dateStr,
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      mealCount: meals.length,
    },
  });
}

/**
 * Get cached daily stats for a date range.
 * Fills missing days with zeros.
 */
async function getDailyStats(userId, days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push(dateStr);
  }

  const stats = await prisma.dailyStat.findMany({
    where: {
      userId,
      date: { in: result },
    },
  });

  const statMap = {};
  for (const s of stats) statMap[s.date] = s;

  return result.map((date) => ({
    date,
    totals: statMap[date]
      ? {
          calories: statMap[date].calories,
          proteinG: statMap[date].proteinG,
          carbsG: statMap[date].carbsG,
          fatG: statMap[date].fatG,
        }
      : { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    mealCount: statMap[date]?.mealCount || 0,
  }));
}

/**
 * Backfill daily stats for a user (run once or periodically).
 */
async function backfillDailyStats(userId, days = 30) {
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    await refreshDailyStat(userId, d);
  }
}

module.exports = { refreshDailyStat, getDailyStats, backfillDailyStats };
