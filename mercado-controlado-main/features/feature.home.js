// ════════════════════════════════════════════════════════════════
// NotaFácil — features/home.js
// Renderização da tela Home:
//  • Score e totais FILTRADOS pelo mês atual
//  • Donut Chart com update (sem destroy desnecessário)
//  • Histórico das últimas 5 notas com índices corretos
// ════════════════════════════════════════════════════════════════

const HomeFeature = (() => {
  let _chartInst = null;

  const ICONS = ['🛒', '🏪', '🛍', '🧺', '🏬', '🍳', '🥩', '🥦'];

  // ── RENDER PRINCIPAL ─────────────────────────────────────────
  function render() {
    const d = Storage.totaisDoMes();
    _renderHero(d);
    _renderScore(d);
    _renderMiniCards(d);
    _renderDonut(d.ess, d.comp, d.sup);
    _renderHistList();
  }

  function _renderHero(d) {
    const mesLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    _set('h-total', Fmt.currency(d.total));
    _set('h-mes',   mesLabel);   // label do mês (elemento opcional)
    _set('h-notas', d.notas.length + (d.notas.length === 1
      ? ' nota registrada'
      : ' notas registradas'));
    _set('h-ess',  'Ess. '  + Fmt.short(d.ess));
    _set('h-comp', 'Comp. ' + Fmt.short(d.comp));
    _set('h-sup',  'Sup. '  + Fmt.short(d.sup));
  }

  function _renderScore(d) {
    const el = document.getElementById('h-score');
    if (!el) return;
    el.textContent = d.score;
    el.style.color = d.score > 70 ? 'var(--green)'
                   : d.score > 40 ? 'var(--yellow)'
                   : 'var(--red)';
    const fill = document.getElementById('score-fill');
    if (fill) fill.style.width = d.score + '%';
  }

  function _renderMiniCards(d) {
    _set('mc-ess',  Fmt.short(d.ess));
    _set('mc-comp', Fmt.short(d.comp));
    _set('mc-sup',  Fmt.short(d.sup));
  }

  // ── DONUT COM UPDATE (não destrói o canvas desnecessariamente) ─
  function _renderDonut(ess, comp, sup) {
    const canvas = document.getElementById('donutChart');
    if (!canvas) return;

    const total = ess + comp + sup;
    const data  = total > 0 ? [ess, comp, sup] : [1, 1, 1];
    const cores = total > 0
      ? ['#00e676', '#ffd600', '#ff5252']
      : ['#1a1f2e', '#1a1f2e', '#1a1f2e'];

    // Reutiliza instância existente para melhor performance
    if (_chartInst) {
      _chartInst.data.datasets[0].data            = data;
      _chartInst.data.datasets[0].backgroundColor = cores;
      _chartInst.update('none'); // 'none' = sem animação no update
      return;
    }

    if (typeof window.Chart === 'undefined') {
      console.warn('[HomeFeature] Chart.js não está disponível; gráfico ignorado.');
      return;
    }

    const ctx = canvas.getContext('2d');
    _chartInst = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   ['Essencial', 'Complementar', 'Supérfluo'],
        datasets: [{ data, backgroundColor: cores, borderWidth: 2, borderColor: '#07080f', hoverOffset: 6 }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '72%',
        animation:           { duration: 600 },
        plugins: {
          legend:  { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' ' + Fmt.currency(ctx.raw) +
                (total > 0 ? ` (${((ctx.raw / total) * 100).toFixed(1)}%)` : ''),
            },
          },
        },
      },
    });
  }

  // ── HISTÓRICO (últimas 5 notas) ──────────────────────────────
  function _renderHistList() {
    const el = document.getElementById('hist-list');
    if (!el) return;

    // Pega TODAS as notas para ter os índices reais corretos
    const todasNotas = Storage.lerNotas();
    if (!todasNotas.length) {
      el.innerHTML = '<div class="empty-state">Nenhuma nota ainda.<br>Toque em Escanear para começar.</div>';
      return;
    }

    // Últimas 5: fatia do final e guarda o índice real de cada uma
    const ultimas = todasNotas
      .map((n, realIdx) => ({ n, realIdx }))   // preserva índice real
      .slice(-5)
      .reverse();

    el.innerHTML = ultimas.map(({ n, realIdx }, i) => {
      const total = _totalNota(n);
      const [cls, label] = _badgeInfo(n);
      return _itemHTML(n, total, cls, label, realIdx, i);
    }).join('');
  }

  // ── HELPERS ──────────────────────────────────────────────────
  function _set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function _totalNota(n) {
    return Number(n.essencial || 0) +
           Number(n.complementar || 0) +
           Number(n.superfluo || 0);
  }

  function _badgeInfo(nota) {
    const total = _totalNota(nota);
    const pct   = total > 0 ? (Number(nota.superfluo || 0) / total) * 100 : 0;
    if (pct < 15) return ['badge-e', 'Econômico'];
    if (pct < 30) return ['badge-c', 'Moderado'];
    return ['badge-s', 'Supérfluo'];
  }

  function _itemHTML(n, total, cls, label, realIdx, iconIdx) {
    const dataStr = Fmt.date(n.data);
    const itens   = n.itens ? ` · ${n.itens} itens` : '';
    return `
      <div class="hist-item" onclick="App.irParaDetalhe(${realIdx})">
        <div class="hist-icon">${ICONS[iconIdx % ICONS.length]}</div>
        <div class="hist-info">
          <div class="hist-name">${Fmt.esc(n.emitente || 'Mercado')}</div>
          <div class="hist-date">${dataStr}${itens}</div>
        </div>
        <div class="hist-right">
          <div class="hist-val">${Fmt.currency(total)}</div>
          <span class="hist-badge ${cls}">${label}</span>
        </div>
      </div>`;
  }

  // Expõe para uso externo (Histórico completo usa as mesmas funções)
  return { render, ICONS, badgeInfo: _badgeInfo, totalNota: _totalNota, itemHTML: _itemHTML };
})();

window.HomeFeature = HomeFeature;
