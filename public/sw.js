// public/sw.js

// This file is intentionally blank.
// It's required for OneSignal service worker registration.
// OneSignal will dynamically import its own worker script.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Import the OneSignal SDK
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
