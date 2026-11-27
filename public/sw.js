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
// CACHE_VERSION IS GENERATED, never hand-maintained (AUD-SH05-A). Browser worker
// updates are detected by BYTE comparison, so a byte-identical worker never
// installs: a hand-edited constant that a release forgets to bump strands every
// existing client on the old precached shell forever. `scripts/pwa-shell-revision.mjs`
// runs after EVERY export (production, hermetic E2E, dist-sync, web:verify) and
// substitutes `sha-<content revision>` computed from a deterministic sorted
// manifest of index.html plus the boot-critical asset graph. Identical bytes
// therefore give an identical revision (no spurious update banner) and any
// shell change gives a different one (a real install). File mtimes and clock
// time never contribute, and this file is excluded from the hash input to avoid
// a cycle.
//
// Precache manifest: CORE_SHELL_URLS is hand-maintained; everything else
// index.html references (hashed entry JS/CSS, fonts, favicon) is discovered
// and warmed at install along with the scripts and WASM required by SQLite.
// Missing or invalid boot-critical assets fail the install so a usable worker
// can stay in control.

const CACHE_VERSION = '__SUPERHABITS_CACHE_VERSION__';
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

/** Entry JS/CSS and SQLite's worker and WASM are required for offline boot. */
function isBootCriticalAsset(url) {
  return /\.(js|css|wasm)($|\?)/i.test(url);
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
  const warming = new Set(CORE_SHELL_URLS);

  async function warmAsset(url) {
    if (warming.has(url)) return;
    warming.add(url);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      if (isBootCriticalAsset(url)) {
        throw new Error(`[sw] precache failed for ${url}: HTTP ${response.status}`);
      }
      return;
    }

    const contentType = response.headers.get('content-type');
    if (isBootCriticalAsset(url) && /^text\/html(?:\s*;|$)/i.test(contentType ?? '')) {
      throw new Error(`[sw] precache expected a boot asset at ${url}, received HTML`);
    }

    if (/\.js($|\?)/i.test(url)) {
      // Metro emits the hashed worker URL in the entry bundle and the WASM
      // URL inside that worker. Neither URL is referenced directly by HTML.
      const source = await response.clone().text();
      const dependencies = source.matchAll(
        /['"](\/_expo\/static\/js\/web\/worker-[a-f0-9]+\.js|\/assets\/[^'"\s]+\.wasm)['"]/g,
      );
      await Promise.all(Array.from(dependencies, ([, dependency]) => warmAsset(dependency)));
    }

    await cache.put(url, response);
  }

  await Promise.all(extractIndexReferencedAssets(await indexResponse.text()).map(warmAsset));
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
        Promise.all(
          keys
            .filter((key) => key.startsWith('superhabits-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
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

  // The root is the same app shell with or without a query string. Resolve it
  // by the precached URL so a launch link can open offline and stays on this
  // worker's shell while a newer deployment is waiting.
  const cacheKey = event.request.mode === 'navigate' && url.pathname === '/' ? '/' : event.request;
  let cacheWrite = Promise.resolve();
  const response = (async () => {
    // Explicit cacheName: during the install/waiting window two generations
    // coexist; searching only our own cache keeps responses version-consistent.
    // Cache Storage can be unavailable (quota/private mode); that must not
    // prevent an otherwise usable network response.
    const cached = await caches
      .match(cacheKey, { cacheName: CACHE_NAME })
      .catch(() => undefined);
    if (cached) return cached;
    const fetched = await fetch(event.request);
    // Never cache error pages. Cache writes are best-effort but must remain
    // alive after the response is delivered, including opening Cache Storage.
    if (fetched.ok) {
      const cloned = fetched.clone();
      cacheWrite = caches
        .open(CACHE_NAME)
        .then((cache) => cache.put(cacheKey, cloned))
        .catch(() => undefined);
    }
    return fetched;
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => cacheWrite).catch(() => undefined));
});
