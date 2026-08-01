/* Service worker minimal — necesar pentru instalarea ca aplicație (WebAPK).
   Strategie network-first, fără cache pe /api/ (rezultatele nu se cache-uiesc). */
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // mereu live
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || new Response('Offline', {status: 503}))
    )
  );
});
