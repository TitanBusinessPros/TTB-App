const CACHE_NAME = 'ttb-static-v22';
const STATIC_FILES = [
  './site.webmanifest',
  './icons/favicon.ico',
  './icons/favicon-96x96.png',
  './icons/apple-touch-icon.png',
  './icons/web-app-manifest-192x192.png',
  './icons/web-app-manifest-512x512.png',
  './assets/TTTB-Logo.png'
];
const STATIC_URLS = new Set(STATIC_FILES.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(async keys => {
        const oldKeys = keys.filter(key => key.startsWith('ttb-static-') && key !== CACHE_NAME);
        await Promise.all(oldKeys.map(key => caches.delete(key)));
        await self.clients.claim();
        if (!oldKeys.length) return;
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(windows.map(client => {
          const url = new URL(client.url);
          url.searchParams.set('ttb-update', '22');
          return client.navigate(url.href).catch(() => {});
        }));
      })
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })).catch(() => new Response(
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Titan Team Task Board</title><body style="font-family:system-ui;padding:2rem;max-width:32rem;margin:auto"><h1>You are offline</h1><p>Reconnect to the internet to open your task board.</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )));
    return;
  }

  if (STATIC_URLS.has(request.url)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
