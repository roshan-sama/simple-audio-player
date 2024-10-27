// Service Worker for Audio Player
const VERSION = "1.0.0";

self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Just log for now to confirm it's working
  console.log("Fetch intercepted for:", event.request.url);
  event.respondWith(fetch(event.request));
});
