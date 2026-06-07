// ════════════════════════════════════════════════════════════════
// NotaFácil — sw.js  (Service Worker — versão produção)
// • Cache-first para assets locais
// • Network-first para CDNs externos (com fallback cache)
// • API do Google sempre vai à rede (sem cache)
// • Atualize CACHE_VERSION a cada deploy
// ════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'notafacil-v19';

const ASSETS_LOCAIS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './jsqr.js',
  // Core
  './core.formatter.js',
  './core.storage.js',
  './core.geo.js',
  // Data
  './data.mercados.js',
  './data.cesta.js',
  // Features
  './feature.home.js',
  './feature.hist.js',
  './feature.scan.js',
  './feature.cesta.js',
  './feature.comparar.js',
  // App
  './app.js',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // addAll individual para não travar se um asset falhar
      return Promise.allSettled(
        ASSETS_LOCAIS.map(url =>
          cache.add(url).catch(err =>
            console.warn(`[SW] Não cacheou: ${url}`, err.message)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => {
            console.log(`[SW] Removendo cache antigo: ${k}`);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { url } = event.request;

  // 1. API Google Apps Script — sempre rede, nunca cacheia
  if (url.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. APIs externas (OSM, Nominatim) — sempre rede, nunca cacheia
  if (url.includes('overpass-api.de') || url.includes('nominatim.openstreetmap.org')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Fontes Google e CDNs — network-first com fallback cache
  if (url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com')    ||
      url.includes('cdnjs.cloudflare.com') ||
      url.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. Assets locais — cache-first com fallback rede
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
