const CACHE_NAME = 'projektzentrale-v2';
const APP_ROOT = '/Projektzentrale/';
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}manifest.webmanifest`,
  `${APP_ROOT}icons/icon.svg`,
  `${APP_ROOT}icons/icon-192.png`,
  `${APP_ROOT}icons/icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, response.clone()));
          return response;
        })
        .catch(() => caches.match(APP_ROOT)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      // Content-gehashte Build-Assets ändern sich unter derselben URL nie; ein 404 hier heißt,
      // dass diese Datei aus einem inzwischen überholten Build stammt und der Client neu laden muss
      // (siehe vite:preloadError-Handler in main.tsx) statt sie fälschlich zwischenzuspeichern.
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    })),
  );
});
