// Service Worker for Audio Player
const VERSION = "1.0.1";
const MEDIA_CACHE_NAME = `music-player-media-v${VERSION}`;
const STATIC_CACHE_NAME = `music-player-static-v${VERSION}`;

// Base path for the player
const BASE_PATH = "##path##";

self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");

  // Cache the essential files
  // event.waitUntil(
  //   Promise.all([
  //     self.skipWaiting(),
  //     caches.open(STATIC_CACHE_NAME).then((cache) => {
  //       return cache.addAll(["/static/music/playlist.html"]);
  //     }),
  //   ])
  // );
  event.waitUntil(
    Promise.all([
      self.skipWaiting(),
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache
          .addAll([
            `/${BASE_PATH}/playlist.html`,
            `/${BASE_PATH}/tailwind.css`,
            `/${BASE_PATH}/howler.min.js`,
            `/${BASE_PATH}/playlists.json`,
          ])
          .catch((err) => {
            console.log("Cacheing inital assets failed");
          });
      }),
    ])
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.");

  // Clean up old caches
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => {
              // Delete old caches from both static and media
              return (
                key.startsWith("music-player-") &&
                key !== MEDIA_CACHE_NAME &&
                key !== STATIC_CACHE_NAME
              );
            })
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

  // Handle MP3 files - Cache First
  if (url.pathname.endsWith(".mp3")) {
    console.log("Intercepting MP3 request:", url.pathname);

    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log("Serving MP3 from cache:", url.pathname);
          return cachedResponse;
        }

        console.log("Fetching MP3 from network:", url.pathname);
        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              // Return the error response instead of throwing
              return networkResponse;
            }

            return caches.open(MEDIA_CACHE_NAME).then((cache) => {
              console.log("Caching MP3:", url.pathname);
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
          .catch((error) => {
            // Create and return a error response that matches what fetch would return
            return new Response(null, {
              status: 404,
              statusText: "Not Found",
            });
          });
      })
    );
    return;
  }

  // Handle playlist.html and JSON files - Stale While Revalidate
  if (
    url.pathname.endsWith("playlist.html") ||
    url.pathname.endsWith(".json") ||
    url.href.includes("cdn")
  ) {
    console.log("Intercepting HTML/JSON/CDN request:", url.pathname);

    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Get fresh version from network
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              // Update cache with new version
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log("Updating cache:", url.pathname);
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log("Network fetch failed, falling back to cache");
            if (cachedResponse) {
              return cachedResponse;
            }
            throw error;
          });

        // Return cached version immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // For all other requests, just fetch from network
  event.respondWith(fetch(event.request));
});
