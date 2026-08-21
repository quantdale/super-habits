// SuperHabits PWA service worker.
//
// Strategy: the app shell (document + boot-critical bundles) is precached at
// install; every other successful same-origin GET is runtime-cached
// cache-first. Bump CACHE_VERSION on every shell-changing deploy so activate
// drops the previous generation instead of stranding users on a mixed cache.
//
// Update flow: this worker deliberately does NOT skipWaiting at install. A
// waiting worker is the update signal for the in-app "Update available"
// banner (core/pwa/registerServiceWorker.ts); the user applies it via the
// SKIP_WAITING message below, and only the tab that requested the update
// reloads (applyRequested gate in registerServiceWorker.ts).
//
// Precache manifest: CORE_SHELL_URLS is hand-maintained; everything else
// index.html references (hashed entry JS/CSS, fonts, favicon) is discovered
// and warmed at install by precacheShell(). The full upgrade path is
// workbox-build `injectManifest` driven by a post-`expo export` step that
// walks dist/, injects a revisioned manifest, and derives CACHE_VERSION from
// a content hash (audit AREA 9 F3). Until that lands, boot-critical URLs
// fail the install loudly instead of silently producing an offline-dead
// shell.

const CACHE_VERSION = 'v5';
const CACHE_NAME = `superhabits-shell-${CACHE_VERSION}`;

// E2E hook: scripts/serve-e2e.js rewrites this constant to `true` when it
// serves /sw.js to Playwright, so the real fetch handler (cache read/write)
// is exercisable on localhost. Product builds keep the dev bypass.
const E2E_DISABLE_DEV_BYPASS = false;

/** Boot-critical shell URLs. addAll fails the install loudly on any miss. */
const CORE_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

/** Asset extensions worth warming at install from index.html references. */
const WARMABLE_ASSET_EXTENSIONS = [
  '.js',
  '.css',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.ico',
  '.wasm',
];

/** Entry JS/CSS must be cached or the warmed shell cannot boot offline. */
function isBootCriticalAsset(url) {
  return /\.js($|\?)/i.test(url) || /\.css($|\?)/i.test(url);
}

/** Same-origin absolute paths referenced by index.html (src/href attributes). */
function extractIndexReferencedAssets(html) {
  const urls = new Set();
  const attributePattern = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = attributePattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    const pathOnly = url.split('?')[0].toLowerCase();
    if (!WARMABLE_ASSET_EXTENSIONS.some((ext) => pathOnly.endsWith(ext))) continue;
    urls.add(url);
  }
  return [...urls];
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  // Fail loud: a missing core shell URL must fail the install so the old
  // worker stays in control rather than advertising an offline shell that
  // cannot boot. No blanket catch here (audit AREA 9 F3).
  await cache.addAll(CORE_SHELL_URLS);

  // Warm what index.html boots with. Hashed bundle names change every export;
  // without warming, the window right after applying an update serves a
  // precached index.html that references uncached bundles — a dead shell if
  // the network dropped during the update.
  const indexResponse =
    (await cache.match('/index.html', { cacheName: CACHE_NAME })) ?? (await fetch('/index.html'));
  const assets = extractIndexReferencedAssets(await indexResponse.text()).filter(
    (url) => !CORE_SHELL_URLS.includes(url),
  );
  await Promise.all(
    assets.map(async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        if (isBootCriticalAsset(url)) {
          throw new Error(`[sw] precache failed for ${url}: HTTP ${response.status}`);
        }
        // Fonts/images are best-effort; the runtime handler caches them on
        // first use.
        return;
      }
      await cache.put(url, response);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  // Do NOT skipWaiting here: a waiting worker is the update signal for the
  // in-app "Update available" banner (core/pwa/registerServiceWorker.ts).
  // The user applies it explicitly via SKIP_WAITING below.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Dev bypass: never cache Metro dev server responses. Neutralized in E2E
  // builds of this file (see E2E_DISABLE_DEV_BYPASS above) so Playwright
  // exercises the real handler.
  const url = new URL(event.request.url);
  if (!E2E_DISABLE_DEV_BYPASS && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // The service worker owns the same-origin app shell only. API/auth and
  // restore requests belong to their remote origin and must reach the browser
  // fetch stack directly (including Playwright's route interception).
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // Explicit cacheName: during the install/waiting window two generations
    // coexist; searching only our own cache keeps responses version-consistent
    // instead of depending on cache creation order (audit AREA 9 F7).
    caches.match(event.request, { cacheName: CACHE_NAME }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Never cache error pages (e.g. old Vercel 404 for /todos); they stick until cache bump.
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned).catch(() => Promise.resolve());
            });
          }
          return response;
        })
        .catch(() => cached ?? fetch(event.request));
    }),
  );
});
