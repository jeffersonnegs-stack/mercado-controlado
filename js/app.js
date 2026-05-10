// ════════════════════════════════════════════════════════════════
// NotaFácil — app.js
// Controlador principal: navegação, inicialização, eventos globais
// ════════════════════════════════════════════════════════════════

const App = (() => {
  const SCREENS = {
    home:     's-home',
    cesta:    's-cesta',
    scan:     's-scan',
    hist:     's-hist',
    detalhe:  's-detalhe',
    comparar: 's-comparar',
  };

  // ── NAVEGAÇÃO ─────────────────────────────────────────────────
  function navTo(destino) {
    // Para câmera se sair da tela de scan
    if (destino !== 'scan') ScanFeature.pararCam();

    // Remove active de todas as telas
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const tela = document.getElementById(SCREENS[destino]);
    if (!tela) {
      console.warn(`[App] Tela não encontrada: ${destino}`);
      return;
    }
    tela.classList.add('active');
    window.scrollTo(0, 0);

    // Executa lógica específica de cada tela
    switch (destino) {
      case 'home':    HomeFeature.render(); break;
      case 'hist':    HistFeature.renderHist(); break;
      case 'cesta':   CestaFeature.abrir(); break;
      // 'scan', 'detalhe', 'comparar' são ativados por chamadas externas
    }
  }

  // ── AÇÕES GLOBAIS (chamadas a partir de onclick inline) ───────
  function irParaDetalhe(realIdx) {
    const ok = HistFeature.abrirDetalhe(realIdx);
    if (ok) navTo('detalhe');
  }

  function abrirComparacaoDetalhe(realIdx) {
    const notas = Storage.lerNotas();
    const nota  = notas[realIdx];
    if (!nota) {
      console.warn(`[App] Nota ${realIdx} não encontrada`);
      return;
    }
    CompararFeature.abrir(nota);
  }

  function abrirComparacao(nota) {
    CompararFeature.abrir(nota);
  }

  // ── INICIALIZAÇÃO ─────────────────────────────────────────────
  function init() {
    // Service Worker (apenas em contexto seguro)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('[App] SW não registrado:', err.message);
      });
    }

    // Renderiza home na inicialização
    HomeFeature.render();

    console.log('[App] NotaFácil inicializado ✓');
  }

  return { navTo, irParaDetalhe, abrirComparacaoDetalhe, abrirComparacao, init };
})();

window.App = App;

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', App.init);
