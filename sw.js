// Guarda els fitxers de l'app perquè s'obri sense connexió.
// Augmenta VERSION quan afegeixis o treguis fitxers de SHELL.
const VERSION = 'family-v7';

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
  'js/push.js',
  'js/screens.js',
  'js/session.js',
  'js/store.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const CACHED_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // reload evita guardar fitxers antics de la memòria del navegador.
      .then((cache) => cache.addAll(SHELL.map((path) => new Request(path, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
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

  // Els fitxers propis es demanen primer a la xarxa, per tenir sempre l'última versió.
  // La còpia desada només s'usa sense connexió.
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      if (isOwnFile) {
        try {
          const response = await fetch(request, { cache: 'no-cache' });
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch (error) {
          const saved = await cache.match(request, { ignoreSearch: true });
          if (saved) return saved;
          throw error;
        }
      }

      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }),
  );
});

self.addEventListener('push', (event) => {
  const { title = 'Family', body = '' } = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(title, { body, icon: 'icons/icon-192.png', lang: 'ca' }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const [open] = windows;
      return open ? open.focus() : self.clients.openWindow('./');
    }),
  );
});
