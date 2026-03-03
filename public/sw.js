const CACHE_NAME = 'c25k-pwa-v3';
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE_ASSETS.map((u) => new Request(u, { cache: 'no-cache' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
