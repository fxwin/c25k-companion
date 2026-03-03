const CACHE_NAME = 'c25k-pwa-v2';
const CORE_ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'ui.js',
  'utils.js',
  'plan.js',
  'tick-worker.js',
  'manifest.webmanifest',
  'sample_history.json',
  'icons/favicon.svg',
  'icons/speaker.svg',
  'icons/speaker_mute.svg',
  'icons/arrow_curved_green.svg',
  'icons/globe.svg',
  'icons/github_logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        return response;
      }).catch(() => cached);
    })
  );
});
