// Service Worker for Audio Player
const VERSION = "1.0.5";
const MEDIA_CACHE_NAME = `music-player-media-v${VERSION}`;
const STATIC_CACHE_NAME = `music-player-static-v${VERSION}`;

// Base path for the player
const BASE_PATH = "##path##";

// Cache preference state
let enableCaching = false;

// Message handler for cache preference updates
self.addEventListener("message", (event) => {
  if (event.data.type === "CACHE_PREFERENCE_UPDATED") {
    enableCaching = event.data.enableCaching;
    console.log("Cache preference updated:", enableCaching);
  }
});

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
            console.log("Caching initial assets failed");
          });
      }),
    ])
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.");
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => {
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
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const rangeHeader = event.request.headers.get("range");

        // Check cache only if caching is enabled
        let cachedResponse = enableCaching
          ? await cache.match(event.request)
          : null;

        if (!cachedResponse && enableCaching) {
          // If not in cache and caching is enabled, fetch and cache the full file
          try {
            const fullFileRequest = new Request(event.request.url, {
              method: "GET",
              headers: new Headers({
                Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
              }),
            });

            const fullFileResponse = await fetch(fullFileRequest);

            if (fullFileResponse.status === 200) {
              console.log("Caching full MP3 file:", url.pathname);
              await cache.put(event.request, fullFileResponse.clone());
              cachedResponse = await cache.match(event.request);
            } else {
              return fetch(event.request);
            }
          } catch (error) {
            console.error("Failed to fetch full file:", error);
            return fetch(event.request);
          }
        }

        // If caching is disabled or no cached response, fetch from network
        if (!enableCaching || !cachedResponse) {
          return fetch(event.request);
        }

        // Handle range request if present
        if (rangeHeader && cachedResponse) {
          const ranges = rangeHeader.replace("bytes=", "").split(",");
          const [start, end] = ranges[0].split("-").map((value) => {
            return value === "" ? undefined : Number(value);
          });

          try {
            const blob = await cachedResponse.blob();
            const rangeStart = start || 0;
            const rangeEnd = end !== undefined ? end : blob.size - 1;

            const slicedBlob = blob.slice(
              rangeStart,
              rangeEnd + 1,
              "audio/mpeg"
            );

            return new Response(slicedBlob, {
              status: 206,
              statusText: "Partial Content",
              headers: {
                "Content-Type": "audio/mpeg",
                "Content-Range": `bytes ${rangeStart}-${rangeEnd}/${blob.size}`,
                "Content-Length": String(slicedBlob.size),
                "Accept-Ranges": "bytes",
              },
            });
          } catch (error) {
            console.error("Failed to handle range request:", error);
            return fetch(event.request);
          }
        }

        return cachedResponse || fetch(event.request);
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
