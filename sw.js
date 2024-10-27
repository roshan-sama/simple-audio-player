// Service Worker for Audio Player
const VERSION = "1.0.0";
const CACHE_NAME = `music-player-cache-v${VERSION}`;
const MEDIA_CACHE_NAME = `music-player-media-v${VERSION}`;

// Base path for the player
const BASE_PATH = "/##path##/";

// Initial resources to cache
const INITIAL_RESOURCES = [
  `${BASE_PATH}playlist.html`,
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.3/howler.min.js",
];

const addResourcesToCache = async (resources) => {
  const cache = await caches.open(VERSION);
  await cache.addAll(resources);
};

// Installation
self.addEventListener("install", (event) => {
  event.waitUntil(addResourcesToCache(INITIAL_RESOURCES));
});

// Activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("music-player-") && !key.includes(VERSION)
            )
            .map((key) => {
              console.log("Removing old cache:", key);
              return caches.delete(key);
            })
        )
      ),
      // Take control immediately
      self.clients.claim(),
    ])
  );
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle MP3 files - Cache First strategy
  if (url.pathname.endsWith(".mp3")) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Handle playlist.html and JSON files - Stale While Revalidate
  if (
    url.pathname.endsWith("playlist.html") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => {
              if (cached) return cached;
              throw new Error("No cached version available");
            });

          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Handle CDN resources - Cache First with network fallback
  if (url.href.includes("cdn")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((response) => {
              if (response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
        )
      )
    );
    return;
  }
});
