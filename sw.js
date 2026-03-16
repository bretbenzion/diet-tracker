/**
 * NutriTrack – Service Worker
 * Network-first for HTML (so new deployments are picked up on normal refresh).
 * Cache-first for static assets (JS, CSS, fonts).
 */

const CACHE_NAME = 'nutritrack-v3';
const STATIC_ASSETS = [
  '/diet-tracker/main.css',
  '/diet-tracker/store.js',
  '/diet-tracker/ui.js',
  '/diet-tracker/charts.js',
  '/diet-tracker/ai.js',
  '/diet-tracker/app.js',
  '/diet-tracker/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never intercept Anthropic API calls
  if (e.request.url.includes('anthropic.com')) return;

  const isHTML = e.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // Network-first for HTML: always try to get the latest page,
    // fall back to cache only when truly offline
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('/diet-tracker/index.html')))
    );
  } else {
    // Cache-first for static assets
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (e.request.method === 'GET' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
  }
});
