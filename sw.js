// Service Worker for Audio Player
const CACHE_NAME = "audio-player-cache-v1";
const MEDIA_CACHE_NAME = "audio-player-media-cache-v1";

// Cache-first for media files, stale-while-revalidate for everything else
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle MP3 files
  if (url.pathname.endsWith(".mp3")) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Handle HTML and JSON files
  if (url.pathname.endsWith(".html") || url.pathname.endsWith(".json")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            return cache.match(event.request);
          });
      })
    );
    return;
  }
});

// Clear old caches on activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== MEDIA_CACHE_NAME;
            })
            .map((cacheName) => {
              return caches.delete(cacheName);
            })
        );
      }),
    ])
  );
});
