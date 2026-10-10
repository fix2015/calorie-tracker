// Last-known API responses, so screens like the Dashboard can render offline.
const PREFIX = 'offline:';

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw).value : null;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, at: Date.now() }));
  } catch { /* quota exceeded — caching is best effort */ }
}

export function clearOfflineCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** Network errors (fetch rejected) have no HTTP status; server errors do. */
export const isNetworkError = (err) => !err?.status && (err instanceof TypeError || !navigator.onLine);

/** Run `fn`; cache successes; on a network error fall back to the cached value when there is one. */
export async function withCache(key, fn) {
  try {
    const value = await fn();
    writeCache(key, value);
    return value;
  } catch (err) {
    if (isNetworkError(err)) {
      const cached = readCache(key);
      if (cached !== null) return cached;
    }
    throw err;
  }
}
