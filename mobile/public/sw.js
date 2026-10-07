/* eslint-disable no-restricted-globals */
/**
 * App-shell service worker for MealPlanatic (GitHub Pages subpath).
 * Cache version and precache list are injected at export time by scripts/apply-pwa-export.mjs.
 */
const CACHE_VERSION = '__CACHE_VERSION__';
const PRECACHE_URLS = __PRECACHE_URLS__;
/** Bumped when navigation caching policy changes (forces fresh shell cache). */
const NAV_POLICY_VERSION = '5';
const SHELL_CACHE = `meal-prep-shell-${CACHE_VERSION}-${NAV_POLICY_VERSION}`;

const SUPABASE_HOST_RE = /(^|\.)supabase\.co$/i;

function isSupabaseRequest(url) {
  return SUPABASE_HOST_RE.test(url.hostname);
}

function isAuthLikeRequest(url, request) {
  if (isSupabaseRequest(url)) return true;
  const path = url.pathname.toLowerCase();
  if (path.includes('/auth/') || path.includes('token')) return true;
  if (request.credentials === 'include' && request.method !== 'GET') return true;
  return false;
}

function appShellUrl() {
  return new URL('index.html', self.registration.scope).pathname;
}

function serveAppShell() {
  const indexPath = appShellUrl();
  return caches.match(indexPath).then((cached) => {
    if (cached) return cached;
    return fetch(indexPath);
  });
}

function isImmutableHashedAsset(pathname) {
  return pathname.includes('/_expo/static/');
}

function isSwBootstrapAsset(pathname) {
  return pathname.endsWith('/sw.js') || pathname.endsWith('/pwa-register.js');
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  });
}

function staleWhileRevalidate(request, offlineFallback) {
  return caches.open(SHELL_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached ?? offlineFallback?.() ?? undefined);
      if (cached) {
        void networkFetch;
        return cached;
      }
      return networkFetch;
    }),
  );
}

function precacheUrl(url) {
  return caches.open(SHELL_CACHE).then((cache) =>
    cache.add(url).catch(() => {
      /* tolerate missing URLs during deploy transitions */
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all(PRECACHE_URLS.map((url) => precacheUrl(url))).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('meal-prep-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isAuthLikeRequest(url, request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, serveAppShell));
    return;
  }

  if (isImmutableHashedAsset(url.pathname) || isSwBootstrapAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? networkFetch;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
