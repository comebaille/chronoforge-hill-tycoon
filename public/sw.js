const CACHE = 'chronoforge-v3';
const scopeUrl = new URL(self.registration.scope);
const assetUrl = (path) => new URL(path, scopeUrl).toString();
const INDEX = assetUrl('index.html');
const CORE = [
  '',
  'index.html',
  'manifest.webmanifest',
  'icons/chronoforge-icon.svg',
  'icons/chronoforge-icon-192.png',
  'icons/chronoforge-icon-512.png',
  'assets/generated/chronoforge-key-art.webp',
  'assets/original/unit-sprites.svg',
  'assets/app.js',
  'assets/app.css',
  'audio/original/chronoforge-loop.wav',
  'audio/original/coin.wav',
  'audio/original/era-unlock.wav',
  'audio/original/impact.wav',
  'audio/original/ui-confirm.wav',
].map(assetUrl);
const APP_SHELL = new Set([
  assetUrl('assets/app.js'),
  assetUrl('assets/app.css'),
  assetUrl('manifest.webmanifest'),
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const appShellRequest = APP_SHELL.has(event.request.url);
  if (event.request.mode === 'navigate' || appShellRequest) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        const cacheKey = event.request.mode === 'navigate' ? INDEX : event.request;
        caches.open(CACHE).then((cache) => cache.put(cacheKey, copy));
        return response;
      }).catch(() => caches.match(event.request.mode === 'navigate' ? INDEX : event.request)),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    })),
  );
});
