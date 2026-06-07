// ════════════════════════════════════════════════════════════════
// NotaFácil — sw.js (Service Worker — versão produção otimizada)
// ════════════════════════════════════════════════════════════════
const CACHE_VERSION = 'notafacil-v19';
const ASSETS_LOCAIS = [
  '',
  'index.html',
  'style.css',
  'manifest.json',
  'jsqr.js',
  'core.formatter.js',
  'core.storage.js',
  'core.geo.js',
  'data.mercados.js',
  'data.cesta.js',
  'feature.home.js',
  'feature.hist.js',
  'feature.scan.js',
  'feature.cesta.js',
  'feature.comparar.js',
  'app.js',
];


// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return Promise.allSettled(
        ASSETS_LOCAIS.map(url => 
          fetch(new Request(url, { cache: 'reload' }))
            .then(response => {
              if (!response.ok) throw new Error(`Status ${response.status}`);
              return cache.put(url, response);
            })
            .catch(err => console.warn(`[SW] Não cacheou na instalação: ${url}`, err.message))
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
  const { request } = event;
  const { url, method } = request;

  // 1. Ignora métodos que não sejam GET
  if (method !== 'GET') return;

  // 2. CORREÇÃO DO ERRO: Ignora completamente extensões do Chrome
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  // 3. APIs externas — sempre rede, nunca cacheia
  if (
    url.includes('://google.com') || 
    url.includes('overpass-api.de') || 
    url.includes('nominatim.openstreetmap.org')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // 4. Fontes Google e CDNs — network-first com fallback cache
  if (
    url.includes('://googleapis.com') || 
    url.includes('://gstatic.com') || 
    url.includes('://cloudflare.com') || 
    url.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            event.waitUntil(
              caches.open(CACHE_VERSION).then(c => c.put(request, clone))
            );
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 5. Assets locais — cache-first puro com fallback rede
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_VERSION).then(c => c.put(request, clone))
          );
        }
        return response;
      });
    })
  );
});


  // 3. Assets locais — cache-first puro com fallback rede (sem re-cachear dinamicamente)
  // Nota: Evita que arquivos modificados fiquem presos no cache para sempre se a versão não mudar.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      
      return fetch(request).then(response => {
        // Opcional: Só cacheia dinamicamente se NÃO for um asset local conhecido (evita poluição)
        if (response && response.status === 200) {
          const clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_VERSION).then(c => c.put(request, clone))
          );
        }
        return response;
      });
    })
  );
});
