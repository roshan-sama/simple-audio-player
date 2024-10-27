// Service Worker for Audio Player
console.log("Service worker initiating");

const VERSION = "1.0.1";
const CACHE_NAME = `audio-player-cache-v${VERSION}`;
const MEDIA_CACHE_NAME = `audio-player-media-cache-v${VERSION}`;

// Adjust the base path to match your subdirectory
const BASE_PATH = "/##path##/";

// Resources to cache initially - adjusted for subdirectory
const INITIAL_CACHED_RESOURCES = [
  BASE_PATH, // Directory path
  BASE_PATH + "playlist.html", // Main HTML file
  "https://cdn.tailwindcss.com", // CDN resources stay the same
  "https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.3/howler.min.js",
];

// Install event remains the same
self.addEventListener("install", (event) => {
  console.log("Service worker installing");

  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log("Caching initial resources");
        return cache.addAll(INITIAL_CACHED_RESOURCES);
      }),
      self.skipWaiting(),
    ])
  );
});

// Fetch event - adjusted to handle subdirectory paths
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle MP3 files - Cache First
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

  // Handle HTML, JSON, and CDN resources - Stale While Revalidate
  if (
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".json") ||
    url.pathname.startsWith(BASE_PATH) || // Modified to check for base path
    url.href.includes("cdn")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              if (cachedResponse) {
                return cachedResponse;
              }
              throw new Error("No cached response available");
            });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
});

// Activate event remains the same
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.includes(VERSION))
            .map((cacheName) => {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      clients.claim(),
    ])
  );
});
