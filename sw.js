// Service Worker for Audio Player
const VERSION = "1.0.4";
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
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const rangeHeader = event.request.headers.get("range");

        // First, try to get the full file from cache
        let cachedResponse = await cache.match(event.request);

        if (!cachedResponse) {
          // If not in cache, fetch the full file first
          try {
            // Create a new request without range header to get full file
            const fullFileRequest = new Request(event.request.url, {
              method: "GET",
              headers: new Headers({
                // Add headers that might be needed for your server
                Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
              }),
            });

            const fullFileResponse = await fetch(fullFileRequest);

            if (fullFileResponse.status === 200) {
              console.log("Caching full MP3 file:", url.pathname);
              // Cache the full file
              await cache.put(event.request, fullFileResponse.clone());
              cachedResponse = await cache.match(event.request);
            } else {
              // If we can't get the full file, proceed with original request
              return fetch(event.request);
            }
          } catch (error) {
            console.error("Failed to fetch full file:", error);
            return fetch(event.request);
          }
        }

        // Handle range request if present
        if (rangeHeader && cachedResponse) {
          const ranges = rangeHeader.replace("bytes=", "").split(",");
          const [start, end] = ranges[0].split("-").map((value) => {
            // If value is empty string, return undefined
            return value === "" ? undefined : Number(value);
          });

          try {
            const blob = await cachedResponse.blob();

            // Handle case where only start is specified (bytes=X-)
            const rangeStart = start || 0;
            // If end is undefined, use the full file size
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

        // If no range request or we failed to handle it, return full cached response
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
