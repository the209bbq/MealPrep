const CACHE = 'daily-report-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './model.js',
  './idb.js',
  './auth.js',
  './config.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      fetch(event.request).then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response));
      }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(event.request);
      const url = new URL(event.request.url);
      if (response.ok && url.origin === location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw error;
    }
  })());
});
