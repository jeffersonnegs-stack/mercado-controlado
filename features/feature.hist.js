// ════════════════════════════════════════════════════════════════
// NotaFácil — features/hist.js
// Tela de Histórico completo + Detalhe da nota
//  • Índices reais corretos (bug fix)
//  • Filtro por categoria (Essencial/Complementar/Supérfluo)
//  • Cards coloridos clicáveis
// ════════════════════════════════════════════════════════════════

const HistFeature = (() => {
  let _idxAtual    = null;  // índice real da nota aberta
  let _filtroAtivo = null;  // 'Essencial' | 'Complementar' | 'Superfluo' | null

  // ── HISTÓRICO COMPLETO ────────────────────────────────────────
  function renderHist() {
    const el = document.getElementById('hist-full');
    if (!el) return;

    const todasNotas = Storage.lerNotas();
    if (!todasNotas.length) {
      el.innerHTML = '<div class="empty-state" style="padding-top:48px">Nenhuma nota registrada ainda.</div>';
      return;
    }

    // Monta lista com índice real preservado, ordem cronológica inversa
    const itens = todasNotas
      .map((n, realIdx) => ({ n, realIdx }))
      .reverse();

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;padding:8px 16px 100px">
        ${itens.map(({ n, realIdx }, i) => {
          const total = HomeFeature.totalNota(n);
          const [cls, label] = HomeFeature.badgeInfo(n);
          return HomeFeature.itemHTML(n, total, cls, label, realIdx, i);
        }).join('')}
      </div>`;
  }

  // ── ABRE DETALHE ──────────────────────────────────────────────
  function abrirDetalhe(realIdx) {
    const notas = Storage.lerNotas();
    if (realIdx < 0 || realIdx >= notas.length) {
      console.warn(`[Hist] Índice inválido: ${realIdx}`);
      return false;
    }
    _idxAtual    = realIdx;
    _filtroAtivo = null;
    _renderDetalhe();
    return true;
  }

  // ── TOGGLE FILTRO ─────────────────────────────────────────────
  function toggleFiltro(cat) {
    _filtroAtivo = (_filtroAtivo === cat) ? null : cat;
    _renderDetalhe();
  }

  // ── RENDER DETALHE ────────────────────────────────────────────
  function _renderDetalhe() {
    const notas = Storage.lerNotas();
    const n = notas[_idxAtual];
    if (!n) return;

    const total = HomeFeature.totalNota(n);
    const dataEmissao   = Fmt.date(n.data, true);
    const dataEscaneado = n.dataEscaneamento ? Fmt.date(n.dataEscaneamento, true) : null;
    const [cls, label] = HomeFeature.badgeInfo(n);

    const pEss  = _pct(n.essencial,    total);
    const pComp = _pct(n.complementar, total);
    const pSup  = _pct(n.superfluo,    total);

    const el = document.getElementById('detalhe-content');
    if (!el) return;

    el.innerHTML = `
      <div style="padding:16px 16px 0">

        <button class="back-btn" onclick="App.navTo('hist')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          Histórico
        </button>

        <div class="detalhe-header">
          <div class="detalhe-loja">${Fmt.esc(n.emitente || 'Mercado')}</div>
          <div class="detalhe-data">📅 Emitida em: ${dataEmissao}</div>
          ${dataEscaneado ? `<div class="detalhe-data" style="color:var(--muted);font-size:11px">📷 Escaneada em: ${dataEscaneado}</div>` : ''}
          <div class="detalhe-total">${Fmt.currency(total)}</div>
          <span class="hist-badge ${cls}"
                style="margin-top:8px;display:inline-block">${label}</span>
        </div>

        <!-- Cards coloridos de categoria -->
        <div class="cat-cards">
          ${_catCard('Essencial',    '🟢', '#00e676', 'cat-card-ess',
                     n.essencial,  pEss,  _filtroAtivo === 'Essencial')}
          ${_catCard('Complementar','🟡', '#ffd600', 'cat-card-comp',
                     n.complementar, pComp, _filtroAtivo === 'Complementar')}
          ${_catCard('Superfluo',   '🔴', '#ff5252', 'cat-card-sup',
                     n.superfluo,  pSup,  _filtroAtivo === 'Superfluo',
                     'Supérfluo')}
        </div>

        ${_filtroAtivo ? `
          <div class="filtro-banner">
            Itens <strong>${_filtroAtivo === 'Superfluo' ? 'Supérfluo' : _filtroAtivo}</strong> ·
            <span onclick="HistFeature.toggleFiltro('${_filtroAtivo}')"
                  style="color:var(--green);cursor:pointer">Ver todos</span>
          </div>` : ''}

        <div class="section-title" style="padding-left:0;margin:14px 0 8px">
          ${_filtroAtivo
            ? 'Itens ' + (_filtroAtivo === 'Superfluo' ? 'Supérfluo' : _filtroAtivo)
            : 'Todos os Itens'}
        </div>

        ${_renderItens(n)}

        <div style="margin-top:20px;padding-bottom:8px">
          <button class="btn-primary"
                  onclick="App.abrirComparacaoDetalhe(${_idxAtual})">
            🏪 Comparador de Mercados + Cesta
          </button>
        </div>

      </div>`;
  }

  function _catCard(cat, icone, cor, cssClass, valor, pct, ativo, labelOverride) {
    const label = labelOverride || cat;
    const activeClass = ativo ? 'cat-card-active' : '';
    return `
      <div class="cat-card ${cssClass} ${activeClass}"
           onclick="HistFeature.toggleFiltro('${cat}')">
        <div class="cat-card-top">
          <span class="cat-card-icon">${icone}</span>
          <span class="cat-card-pct">${pct}%</span>
        </div>
        <div class="cat-card-val">${Fmt.short(valor)}</div>
        <div class="cat-card-lbl">${label}</div>
        <div class="cat-card-bar-track">
          <div class="cat-card-bar" style="width:${pct}%;background:${cor}"></div>
        </div>
        ${ativo ? `<div class="cat-card-badge" style="color:${cor}">✓ Filtrado</div>` : ''}
      </div>`;
  }

  function _renderItens(n) {
    if (!n.produtos || !n.produtos.length) {
      return '<div class="empty-state" style="padding:24px 0">Itens não disponíveis nesta nota.</div>';
    }

    // Normaliza: 'Superfluo' sem acento para consistência interna
    const lista = _filtroAtivo
      ? n.produtos.filter(p => _normalizar(p.grupo) === _filtroAtivo)
      : n.produtos;

    if (!lista.length) {
      const label = _filtroAtivo === 'Superfluo' ? 'Supérfluo' : _filtroAtivo;
      return `<div class="empty-state" style="padding:24px 0">
        Nenhum item ${label} nesta nota.
      </div>`;
    }

    return `<div class="itens-card">
      ${lista.map(p => {
        const g = _normalizar(p.grupo);
        const catCls = g === 'Essencial'    ? 'badge-e'
                     : g === 'Superfluo'    ? 'badge-s'
                     : 'badge-c';
        const catLabel = g === 'Superfluo' ? 'Supérfluo' : (p.categoria || g);
        return `
          <div class="item-row">
            <div class="item-left">
              <div class="item-desc">${Fmt.esc(p.descricao)}</div>
              <span class="item-cat ${catCls}">${Fmt.esc(catLabel)}</span>
            </div>
            <div class="item-val">${Fmt.currency(p.valorTotal)}</div>
          </div>`;
      }).join('')}
    </div>`;
  }

  // Normaliza variações de "Supérfluo" / "Superfluo"
  function _normalizar(str) {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function _pct(valor, total) {
    return total > 0 ? Math.round((Number(valor || 0) / total) * 100) : 0;
  }

  return { renderHist, abrirDetalhe, toggleFiltro };
})();

window.HistFeature = HistFeature;
