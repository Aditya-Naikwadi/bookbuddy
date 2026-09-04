const CACHE_VERSION = "6.2.108";
const CACHE_NAME = `bookbuddy-pwa-v${CACHE_VERSION}`;
const STATIC_ASSETS = ["/", "/index.html", "/version.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Network-first for JavaScript/worker .mjs scripts to prevent stale worker API desynchronization for returning sessions
  if (url.pathname.endsWith(".mjs") || url.pathname.includes("pdf.worker")) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Cache-first for offline media / e-resources / static documents, network-first for API
  if (
    url.pathname.includes("/eresources/") ||
    url.pathname.endsWith(".epub") ||
    url.pathname.endsWith(".pdf")
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      }),
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
  }
});
