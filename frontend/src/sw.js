/* Service worker (web only — not registered inside Capacitor or on localhost, see index.html).
 *
 * This file is a template: the `swPlugin` in vite.config.js emits it as /sw.js and fills in the
 * three constants below at build time. Because the precache list contains the content-hashed
 * chunk names, every deploy changes sw.js, so browsers install the new worker on their next
 * visit, precache the new chunks and prune the old ones.
 *
 * Strategies:
 *   - navigations    network-first; on failure (offline, 5xx, or no answer within a few seconds)
 *                    the cached index.html (app shell). Every successful navigation refreshes it.
 *   - /assets/*      cache-first (Vite hashes the file names, so a cached copy is never stale)
 *   - /uploads/*     network-first, cached copy when offline
 *   - other static   stale-while-revalidate (manifest, icons)
 *   - /api/*         never touched, never cached (user data; the app keeps its own offline copy)
 */
const BUILD_ID = 'dev';
const BASE = '/';
const PRECACHE_ASSETS = [];

const VERSION = 'v3';
const SHELL_CACHE = `calorie-tracker-shell-${VERSION}`;
const ASSET_CACHE = `calorie-tracker-assets-${VERSION}`;
const RUNTIME_CACHE = `calorie-tracker-runtime-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE];

const NAVIGATION_TIMEOUT_MS = 4000;

const abs = (path) => new URL(path, self.location.origin).href;
const SHELL_URL = abs(`${BASE}index.html`);
const ASSETS_PREFIX = `${BASE}assets/`;
const API_PREFIX = '/api/';
const UPLOADS_PREFIX = '/uploads/';
const SHELL_EXTRAS = ['manifest.json', 'favicon.png', 'favicon.svg'].map((p) => abs(`${BASE}${p}`));

// Hashed files and the shell don't vary per request; servers add `Vary: Origin` / `Accept-Encoding`,
// which would otherwise make module-script requests (which carry Origin) miss the cache.
const MATCH = { ignoreVary: true };

const isHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');

async function precacheAssets() {
  const cache = await caches.open(ASSET_CACHE);
  // Best effort, one by one: chunks unchanged since the previous deploy are already cached.
  await Promise.all(PRECACHE_ASSETS.map(async (path) => {
    const url = abs(path);
    if (await cache.match(url, MATCH)) return;
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (res.ok) await cache.put(url, res);
    } catch { /* fetched on demand later */ }
  }));
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.add(new Request(SHELL_URL, { cache: 'reload' }));
  await Promise.all(SHELL_EXTRAS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
}

self.addEventListener('install', (event) => {
  // Chunks first, then the index.html that references them.
  event.waitUntil(precacheAssets().then(precacheShell));
  self.skipWaiting();
});

async function pruneAssets() {
  if (!PRECACHE_ASSETS.length) return; // dev build: no manifest to prune against
  const keep = new Set(PRECACHE_ASSETS.map(abs));
  const cache = await caches.open(ASSET_CACHE);
  const requests = await cache.keys();
  await Promise.all(requests.filter((req) => !keep.has(req.url)).map((req) => cache.delete(req)));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(pruneAssets)
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function handleNavigation(network) {
  const cached = await caches.match(SHELL_URL, { ...MATCH, cacheName: SHELL_CACHE });
  if (!cached) return network;
  try {
    const res = await Promise.race([network, timeout(NAVIGATION_TIMEOUT_MS)]);
    if (res.status < 500) return res;
  } catch { /* offline or too slow — serve the shell */ }
  return cached;
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request, MATCH);
    if (cached) return cached;
    throw err;
  }
}

function staleWhileRevalidate(event) {
  const { request } = event;
  const update = fetch(request).then(async (res) => {
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, res.clone());
    }
    return res;
  });
  event.waitUntil(update.catch(() => {}));
  return caches.match(request, MATCH).then((cached) => cached || update);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only same-origin GETs; never the API (user data) or the worker script itself.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(API_PREFIX) || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    if (url.pathname.startsWith(UPLOADS_PREFIX)) return;
    const network = fetch(request);
    // Keep the shell fresh: every successful HTML navigation replaces the cached index.html.
    event.waitUntil(network.then(async (res) => {
      if (res.ok && !res.redirected && isHtml(res)) {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(SHELL_URL, res.clone());
      }
    }).catch(() => {}));
    event.respondWith(handleNavigation(network));
    return;
  }

  if (url.pathname.startsWith(ASSETS_PREFIX)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith(UPLOADS_PREFIX)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});

// Referenced so the build stamp is visible when inspecting the worker (and to bust byte-equality).
self.SW_BUILD_ID = BUILD_ID;
