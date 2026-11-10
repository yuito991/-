'use strict';

const CACHE_PREFIX = 'fischers-quest-install:' + self.registration.scope;
const CACHE_NAME = CACHE_PREFIX + ':v1';
const OFFLINE_URL = new URL('./offline.html', self.registration.scope).href;
const APP_ASSETS = ['offline.html', 'icons/app-192.png', 'icons/app-512.png', 'icons/app-maskable-512.png']
  .map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX + ':') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    // Always load the current site; only the connection-error page is available offline.
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
  } else if (APP_ASSETS.includes(url.href)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
