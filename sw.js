// Guarda els fitxers de l'app perquè s'obri sense connexió.
// Augmenta VERSION quan canviïs els fitxers de SHELL.
const VERSION = 'family-v2';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/config.js',
  'js/demo.js',
  'js/household.js',
  'js/lunch.js',
  'js/screens.js',
  'js/session.js',
  'js/store.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const CACHED_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isOwnFile = url.origin === self.location.origin;
  // Les dades de Supabase no passen mai per aquesta memòria.
  if (!isOwnFile && !CACHED_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: isOwnFile });
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
