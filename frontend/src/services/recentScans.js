// Last 20 scanned foods per user, kept on-device for one-tap re-logging.
const MAX = 20;
const key = (userId) => `recentScans:${userId || 'anon'}`;

export function getRecentScans(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addRecentScan(userId, food) {
  if (!food?.name) return;
  const entry = {
    name: String(food.name).slice(0, 200),
    calories: Math.round(Number(food.calories) || 0),
    proteinG: Math.round((Number(food.proteinG) || 0) * 10) / 10,
    carbsG: Math.round((Number(food.carbsG) || 0) * 10) / 10,
    fatG: Math.round((Number(food.fatG) || 0) * 10) / 10,
    photoUrl: food.photoUrl || null,
    ts: Date.now(),
  };
  const rest = getRecentScans(userId).filter((f) => f.name.toLowerCase() !== entry.name.toLowerCase());
  try {
    localStorage.setItem(key(userId), JSON.stringify([entry, ...rest].slice(0, MAX)));
  } catch { /* storage full or unavailable */ }
}
