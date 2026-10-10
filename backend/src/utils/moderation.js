const prisma = require('./prisma');

// A public meal or comment with this many OPEN reports is hidden from public
// queries until an admin resolves enough of them.
const AUTO_HIDE_THRESHOLD = 3;

/**
 * Ids of targets of the given type that currently have >= AUTO_HIDE_THRESHOLD open reports.
 * @param {'MEAL'|'COMMENT'} targetType
 * @returns {Promise<string[]>}
 */
async function getHiddenIds(targetType) {
  const groups = await prisma.report.groupBy({
    by: ['targetId'],
    where: { targetType, status: 'OPEN' },
    having: { targetId: { _count: { gte: AUTO_HIDE_THRESHOLD } } },
  });
  return groups.map((g) => g.targetId);
}

async function isHidden(targetType, targetId) {
  const count = await prisma.report.count({ where: { targetType, targetId, status: 'OPEN' } });
  return count >= AUTO_HIDE_THRESHOLD;
}

/** Merge an "exclude hidden meals" clause into a Prisma meal `where`. */
async function withVisibleMeals(where) {
  const hidden = await getHiddenIds('MEAL');
  if (hidden.length === 0) return where;
  return { AND: [where, { id: { notIn: hidden } }] };
}

/** Drop hidden comments from a list of comment objects that have an `id`. */
async function filterVisibleComments(comments) {
  const hidden = await getHiddenIds('COMMENT');
  if (hidden.length === 0) return comments;
  const set = new Set(hidden);
  return comments.filter((c) => !set.has(c.id));
}

module.exports = { AUTO_HIDE_THRESHOLD, getHiddenIds, isHidden, withVisibleMeals, filterVisibleComments };
