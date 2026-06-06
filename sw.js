// ════════════════════════════════════════════════════════
// sw.js — Service Worker de Paladear Mercado de Sabores
// Versión: 1.5
//
// CAMBIO CLAVE (arregla "no carga si no borrás el historial" y
// "tarda muchísimo en cargar"):
//
//   1. Ya NO cacheamos las llamadas a datos (Google Sheets / Apps
//      Script). Esas URLs llevan timestamp + random y son únicas en
//      cada visita, así que el Cache Storage crecía sin límite hasta
//      agotar la cuota del navegador y romper la carga. Los datos ya
//      se guardan en localStorage por la propia app, así que el modo
//      offline sigue funcionando.
//
//   2. index.html (la página): NETWORK-FIRST. Siempre se pide la
//      versión más reciente a la red, así los cambios publicados se
//      ven en la primera visita sin tener que borrar el historial.
//      Si no hay red, cae al cache (sigue abriendo offline).
//
//   3. Resto del shell (íconos, imágenes propias): stale-while-
//      revalidate. Cargan al instante desde el cache y se actualizan
//      en segundo plano. Casi nunca cambian.
// ════════════════════════════════════════════════════════

const CACHE_VERSION = 'paladear-v6';

const SHELL_FILES = [
  '/paladeartienda/',
  '/paladeartienda/index.html',
  '/paladeartienda/android-chrome-192x192.png',
  '/paladeartienda/android-chrome-512x512.png',
  '/paladeartienda/apple-touch-icon.png',
  '/paladeartienda/favicon-32x32.png',
  '/paladeartienda/og-image.jpg',
];

// ── INSTALL ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_FILES))
      .catch(err => console.warn('[SW] Error cacheando shell:', err))
  );
  self.skipWaiting();
});

// ── ACTIVATE: borrar caches viejos (incluye el v4 inflado) ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ───────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }

  // DATOS y recursos externos (Google Sheets, Apps Script, imágenes
  // de Google, fuentes, etc.): NO los interceptamos. Van directo a la
  // red y, si corresponde, los maneja el cache HTTP normal del
  // navegador. Así el Cache Storage nunca se infla con URLs únicas.
  if (url.origin !== self.location.origin) return;

  // index.html (la página en sí): NETWORK-FIRST. Siempre pedimos la
  // versión más reciente a la red para que los cambios se vean en la
  // primera visita (sin tener que borrar el historial). Si no hay red,
  // caemos al cache para que la página siga abriendo offline.
  const _path = url.pathname;
  const _esPagina = _path === '/paladeartienda/' ||
                    _path === '/paladeartienda/index.html';

  if (_esPagina) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_VERSION)
              .then(cache => cache.put(event.request, response.clone()))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match('/paladeartienda/index.html'))
        )
    );
    return;
  }

  // Resto del shell del mismo origen (íconos, imágenes propias):
  // stale-while-revalidate. Cargan al instante desde el cache y se
  // actualizan en segundo plano. Estos archivos casi no cambian.
  event.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(event.request).then(cached => {
        const network = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached || caches.match('/paladeartienda/index.html'));
        // Servimos el cache al instante si existe; si no, esperamos la red.
        return cached || network;
      })
    )
  );
});

// ── PUSH: placeholder para Fase 2 (OneSignal) ──────────
self.addEventListener('push', event => {
  console.log('[SW] Push recibido (OneSignal no configurado aún)');
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/paladeartienda/'));
});
