// Service Worker - Mi Triatlón PWA
const CACHE_VERSION = 'mi-triatlon-v4';
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// INSTALL: precache de archivos principales
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CACHE_FILES.filter(f => f)))
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

// ACTIVATE: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// FETCH: estrategia
// - Apps Script (datos): network-first (datos siempre frescos)
// - Estáticos: cache-first con fallback a red
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Apps Script — siempre intentar red primero
  if (url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ ok: false, error: 'Sin conexión' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Solo HTTP/HTTPS, GET
  if (event.request.method !== 'GET' || !url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Devolver desde cache si está
      if (cached) {
        // Actualizar en segundo plano
        fetch(event.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_VERSION).then(c => c.put(event.request, res));
          }
        }).catch(() => {});
        return cached;
      }
      // Sino, ir a red y guardar
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        // Sin red ni cache: fallback básico
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
