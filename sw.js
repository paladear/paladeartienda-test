// ════════════════════════════════════════════════════════
// sw.js — Service Worker de Paladear Mercado de Sabores
// Versión: 1.6
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

// Cada carpeta su propio cajón: las cuatro tiendas viven en paladear.github.io y
// comparten el guardado del navegador. Antes todas usaban el mismo nombre y, peor,
// al activarse esta borraba TODOS los cajones del dominio: entrar a la minorista
// dejaba a la distribuidora sin su copia offline, y la tester sin la de la real.
// La carpeta sale de dónde está parado este mismo archivo. Escrita a mano decía
// siempre "paladeartienda-test", así que la tienda oficial guardaba los archivos
// de la de pruebas y su propia página nunca entraba por la regla de red primero.
const BASE = new URL('./', self.location).pathname;
const CACHE_PREFIX = 'paladear-min-';
const CACHE_VERSION = CACHE_PREFIX + BASE.replace(/\//g, '') + '-v28';

const SHELL_FILES = [
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
  'favicon-32x32.png',
  'og-image.jpg',
  'paladear-wordmark.png',
  'home-hero-minorista-mobile-v10.webp',
  'home-hero-minorista-desktop-v4.webp',
  'home-discount-strip-v2.webp',
  'home-banner-v2-mix.webp',
  'home-banner-v2-granola.webp',
  'home-banner-v2-blend.webp',
  'home-banner-v2-lista.webp',
  'may-icon-home-filled.png',
  'may-icon-products-bag.png',
  'may-icon-catalog-filled.png',
  'may-icon-offers-filled.png',
  'may-icon-account-outline.png',
  'may-icon-cart-outline.png',
  'may-icon-favorites-filled.svg',
].concat([
  'aceites','aceitunas','bebidas','cereales','congelados','deshidratados','dulces',
  'encurtidos','especias','frio','frutos','gourmet','granos','harinas','home',
  'infusiones','mantecas','reposteria','semillas','sintacc','snack','suplementos',
  'tomate','vinos'
].map(function(c){ return 'cat-v2-' + c + '.webp'; })).map(function(f){ return BASE + f; });

// ── INSTALL ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(async cache => {
        // El HTML se descarga ignorando cualquier copia HTTP anterior. Así una
        // instalación/actualización nunca vuelve a sembrar una interfaz vieja.
        const page = await fetch(BASE + 'index.html', { cache: 'reload' });
        if (!page || !page.ok) throw new Error('No se pudo actualizar index.html');
        await Promise.all([
          cache.put(BASE, page.clone()),
          cache.put(BASE + 'index.html', page.clone()),
          Promise.all(SHELL_FILES.map(function(f){
            return cache.add(f).catch(function(){ console.warn('[SW] no pude guardar', f); });
          }))
        ]);
      })
      .catch(err => {
        console.warn('[SW] Error cacheando shell:', err);
        throw err; // conservar el SW anterior si la actualización quedó incompleta
      })
  );
  self.skipWaiting();
});

// ── ACTIVATE: borrar caches viejos (incluye el v4 inflado) ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // Sólo los cajones propios, más los de nombre viejo. Los de la
        // distribuidora (paladear-distri-*) no se tocan.
        keys.filter(k => (k.startsWith(CACHE_PREFIX) || /^paladear-v\d+$/.test(k)) &&
                         k !== CACHE_VERSION).map(k => caches.delete(k))
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
  const _esPagina = _path === BASE ||
                    _path === BASE + 'index.html' ||
                    _path === BASE + 'admin.html';

  // DATOS DE PRECIOS Y STOCK: tambien NETWORK-FIRST.
  // Antes los precios venian del Apps Script de Google (otro origen), asi que
  // este service worker ni los tocaba y siempre llegaban frescos. Ahora salen
  // de E-Pyme y viajan como archivos del propio sitio, asi que sin esta regla
  // caerian en stale-while-revalidate y un visitante que vuelve veria los
  // precios de la carga anterior. Con la red primero, siempre ve los de hoy;
  // el cache queda solo como respaldo para cuando no hay conexion.
  const _esDato = /\/(precios-min|info-min|precios-may|info-may|stock)\.csv$|\/(catalog-min|pendientes|catalogo-panel)\.json$/.test(_path);

  if (_esPagina || _esDato) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_VERSION)
              .then(cache => cache.put(event.request, response.clone()))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Un CSV/JSON no puede caer al index.html: devolveria HTML donde se
            // espera datos. Mejor fallar y que la pagina haga su reintento.
            return _esDato ? Response.error()
                           : caches.match(BASE + 'index.html');
          })
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
          .catch(() => cached || caches.match(BASE + 'index.html'));
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
  event.waitUntil(clients.openWindow(BASE));
});

// ── El botón "Actualizar" de la tienda ─────────────────
// Cuando el visitante toca Actualizar, esta versión toma el control enseguida
// en vez de esperar a que cierre todas las pestañas.
self.addEventListener('message', event => {
  if (event.data && event.data.tipo === 'ACTUALIZAR_YA') self.skipWaiting();
});
