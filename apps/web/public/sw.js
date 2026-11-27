// Croissant: service worker без кэша. Нужен только для установки приложения (PWA).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* запросы идут в сеть как обычно */
});
