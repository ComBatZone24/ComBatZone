// public/sw.js

const CACHE_NAME = 'arena-ace-offline-cache-v1';
const OFFLINE_URL = '/offline';

// --- 1. Installation: Precaching the Offline Page ---
// This runs when the service worker is first installed.
// It opens a cache and adds our essential offline fallback page to it.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline page:', OFFLINE_URL);
      return cache.add(OFFLINE_URL);
    })
  );
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

// --- 2. Activation: Cleaning Up Old Caches ---
// This runs after the install event and when the service worker becomes active.
// It ensures that we clean up any old caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Enable navigation preloading if it's supported.
      // This allows the browser to start fetching navigation requests while the service worker is starting up.
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      
      // Delete old caches that are not our current CACHE_NAME
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })()
  );
  // Tell the active service worker to take control of the page immediately.
  self.clients.claim();
});


// --- 3. Fetch: Intercepting Network Requests ---
// This is the core logic. It listens for every network request from the app.
self.addEventListener('fetch', (event) => {
  // We only want to intercept navigation requests (i.e., when the user tries to go to a new page).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // First, try to use the preloaded response, if available.
          const preloadedResponse = await event.preloadResponse;
          if (preloadedResponse) {
            return preloadedResponse;
          }

          // If no preloaded response, try to fetch from the network.
          const networkResponse = await fetch(event.request);
          return networkResponse;

        } catch (error) {
          // The network request failed (e.g., server is down, no connection).
          console.log('[Service Worker] Fetch failed; returning offline page instead.', error);

          // Get the offline page from the cache.
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  }
  // For non-navigation requests (images, APIs, etc.), we don't do anything special.
  // The browser will handle them as usual. We could add more caching strategies here later if needed.
});
