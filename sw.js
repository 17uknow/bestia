// Service worker: la app funciona sin conexión (gym sin cobertura).
// App: primero red y, si falla, caché (así siempre coges la última versión cuando hay internet).
// Imágenes de ejercicios: primero caché. Dropbox: nunca se cachea.
const VERSION = 'fit-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-512.png',
  './js/foods.js', './js/dishes.js', './js/meals.js', './js/exercises.js', './js/routines.js', './js/muscles.js', './js/anim.js', './js/store.js', './js/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'fit-img').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('dropbox')) return;
  if (url.hostname === 'raw.githubusercontent.com') {
    e.respondWith(caches.open('fit-img').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
