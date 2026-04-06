const CACHE_VERSION = "v3";
const CACHE_NAME = `superhabits-shell-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache
        .addAll([
          "/",
          "/index.html",
          "/manifest.json",
          "/icon-192.png",
          "/icon-512.png",
          "/icon-maskable-512.png",
        ])
        .catch(() => Promise.resolve()),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Dev bypass: never cache Metro dev server responses
  const url = new URL(event.request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
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
        .catch(() => cached);
    }),
  );
});
