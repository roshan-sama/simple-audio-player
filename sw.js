// Service Worker for Audio Player
const VERSION = "1.0.0";
const MEDIA_CACHE_NAME = `music-player-media-v${VERSION}`;

self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.");
  // Clean up old caches
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Delete old media caches
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("music-player-media-") &&
                key !== MEDIA_CACHE_NAME
            )
            .map((key) => {
              console.log("Deleting old cache:", key);
              return caches.delete(key);
            })
        );
      }),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle MP3 files for now
  if (url.pathname.endsWith(".mp3")) {
    console.log("Intercepting MP3 request:", url.pathname);

    event.respondWith(
      // Try to get from cache first
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log("Serving MP3 from cache:", url.pathname);
          return cachedResponse;
        }

        // Not in cache, get from network
        console.log("Fetching MP3 from network:", url.pathname);
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache the response
          return caches.open(MEDIA_CACHE_NAME).then((cache) => {
            console.log("Caching MP3:", url.pathname);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // For all other requests, just fetch from network
  event.respondWith(fetch(event.request));
});
