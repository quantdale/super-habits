self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("superhabits-shell-v1").then((cache) =>
      cache.addAll(["/", "/index.html"]).catch(() => Promise.resolve()),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open("superhabits-shell-v1").then((cache) => {
            cache.put(event.request, cloned).catch(() => Promise.resolve());
          });
          return response;
        })
        .catch(() => cached);
    }),
  );
});
