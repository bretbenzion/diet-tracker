const CACHE_NAME = 'nutritrack-v6';
const STATIC = [
  '/diet-tracker/',
  '/diet-tracker/index.html',
  '/diet-tracker/main.css',
  '/diet-tracker/store.js',
  '/diet-tracker/ui.js',
  '/diet-tracker/charts.js',
  '/diet-tracker/ai.js',
  '/diet-tracker/app.js',
  '/diet-tracker/manifest.json',
  '/diet-tracker/icon-192.png',
  '/diet-tracker/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC))
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
  if (e.request.url.includes('anthropic.com')) return;
  const isHTML = e.request.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    // Network-first for HTML
    e.respondWith(
      fetch(e.request).then(r => {
        caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for static assets
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        if (r.status === 200) caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
        return r;
      }))
    );
  }
});
