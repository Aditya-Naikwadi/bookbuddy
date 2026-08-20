/* eslint-disable no-restricted-globals */

// Workbox & Custom Service Worker for BookBuddy PWA & Offline E-Resources Mode
const CACHE_NAME = 'bookbuddy-static-v1';
const EBOOK_CACHE = 'bookbuddy-ebooks-v1';

const OFFLINE_URLS = [
  '/',
  '/index.html',
];

// Pre-cache core static assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[BookBuddy SW] Pre-caching offline static assets');
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn('[BookBuddy SW] Pre-cache assets warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate & cleanup stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== EBOOK_CACHE) {
            console.log('[BookBuddy SW] Removing old cache:', cache);
            return caches.delete(cache);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event with strategy dispatch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Handle offline e-resource PDF/EPUB caching
  if (url.pathname.includes('/uploads/ebooks/') || url.pathname.includes('/download-url')) {
    event.respondWith(
      caches.open(EBOOK_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response('Offline E-Resource Content Unavailable', { status: 503 });
        }
      })
    );
    return;
  }

  // Stale-While-Revalidate for static assets
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default Network-First Strategy
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request).then((matching) => {
        return matching || caches.match('/index.html');
      });
    })
  );
});
