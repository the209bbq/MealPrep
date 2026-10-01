/* eslint-disable no-restricted-globals */
/**
 * App-shell service worker for MealPlanatic (GitHub Pages subpath).
 * Cache version and precache list are injected at export time by scripts/apply-pwa-export.mjs.
 */
const CACHE_VERSION = '__CACHE_VERSION__';
const PRECACHE_URLS = __PRECACHE_URLS__;
/** Bumped when navigation caching policy changes (forces fresh shell cache). */
const NAV_POLICY_VERSION = '3';
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
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
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }
          return serveAppShell();
        })
        .catch(() => serveAppShell())
    );
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
