// jsqr.js — Este arquivo carrega a biblioteca jsQR do CDN
// Se este arquivo não carregar, o index.html usa o CDN automaticamente
// Para usar local: baixe de https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js
// e substitua este arquivo pelo conteúdo baixado.
(function() {
  if (typeof window !== 'undefined' && !window.jsQR) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    s.onerror = function() { window._jsQRFailed = true; };
    document.head.appendChild(s);
  }
})();
