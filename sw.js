// Service Worker for Audio Player
const VERSION = "1.0.3";
const MEDIA_CACHE_NAME = `music-player-media-v${VERSION}`;
const STATIC_CACHE_NAME = `music-player-static-v${VERSION}`;

// Base path for the player
const BASE_PATH = "##path##";

self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");
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

  // Handle MP3 files with range request support
  if (url.pathname.endsWith(".mp3")) {
    console.log("Intercepting MP3 request:", url.pathname);

    event.respondWith(
      (async () => {
        const rangeHeader = event.request.headers.get("range");
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const cachedResponse = await cache.match(event.request);

        // If no range request and we have a cache, return it
        if (!rangeHeader && cachedResponse) {
          return cachedResponse;
        }

        try {
          // Always fetch from network for range requests or if not cached
          const networkResponse = await fetch(event.request);

          // Cache the full response if it's not a range request
          if (!rangeHeader && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            cache.put(event.request, clonedResponse).catch((err) => {
              console.error("Cache write failed:", err);
            });
          }

          return networkResponse;
        } catch (error) {
          console.error("Fetch failed:", error);

          // If we have a cached response, try to handle range request
          if (cachedResponse && rangeHeader) {
            const ranges = rangeHeader.replace("bytes=", "").split(",");
            const [rangeStart, rangeEnd] = ranges[0].split("-").map(Number);

            try {
              const blob = await cachedResponse.blob();
              const slicedBlob = blob.slice(
                rangeStart,
                rangeEnd ? rangeEnd + 1 : undefined,
                "audio/mpeg"
              );

              // Create a new response with the correct headers
              return new Response(slicedBlob, {
                status: 206,
                statusText: "Partial Content",
                headers: {
                  "Content-Type": "audio/mpeg",
                  "Content-Range": `bytes ${rangeStart}-${
                    rangeEnd || blob.size - 1
                  }/${blob.size}`,
                  "Content-Length": slicedBlob.size,
                },
              });
            } catch (sliceError) {
              console.error("Range request handling failed:", sliceError);
            }
          }

          // If all else fails, return 404
          return new Response(null, {
            status: 404,
            statusText: "Not Found",
          });
        }
      })()
    );
    return;
  }

  // Handle playlist.html and JSON files - Stale While Revalidate
  if (
    url.pathname.endsWith("playlist.html") ||
    url.pathname.endsWith(".json")
  ) {
    console.log("Intercepting HTML/JSON request:", url.pathname);

    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Get fresh version from network
        return Promise.resolve()
          .then(() => fetch(event.request))
          .then((networkResponse) => {
            console.log("Network response:", networkResponse);

            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches
                .open(STATIC_CACHE_NAME)
                .then((cache) => {
                  console.log("Updating cache:", url.pathname);
                  return cache.put(event.request, responseToCache);
                })
                .catch((err) => console.error("Cache write failed:", err));

              return networkResponse;
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log("Network fetch failed, falling back to cache");
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(null, {
              status: 404,
              statusText: "Not Found",
            });
          });
      })
    );
    return;
  }
});
