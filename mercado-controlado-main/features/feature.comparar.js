// ════════════════════════════════════════════════════════════════
// NotaFácil — features/comparar.js
// Tela de comparação exibida APÓS escanear uma nota
//  • Reutiliza geo/mercados já carregados pela CestaFeature
//  • Mostra comparação da nota + cesta básica
//  • Perfil selecionável
// ════════════════════════════════════════════════════════════════

const CompararFeature = (() => {
  let _nota        = null;
  let _mercados    = [];
  let _geoState    = {};
  let _perfilAtivo = 'medio';

  // ── PONTO DE ENTRADA ─────────────────────────────────────────
  async function abrir(nota) {
    _nota = nota;

    const el = document.getElementById('comp-content');
    if (!el) return;

    el.innerHTML = `
      <div style="padding:16px;text-align:center;padding-top:60px">
        <div style="font-size:36px;margin-bottom:12px">🔍</div>
        <div style="font-size:15px;color:var(--muted2)">
          Buscando mercados próximos...
        </div>
      </div>`;
    App.navTo('comparar');

    // Reutiliza dados da CestaFeature se já foram carregados
    const cestaMercados = CestaFeature.getMercados();
    if (cestaMercados.length >= 2) {
      _mercados  = cestaMercados;
      _geoState  = CestaFeature.getGeoState();
    } else {
      _geoState = await Geo.detectar();
      _mercados = await Mercados.obter(_geoState);
    }

    _perfilAtivo = CestaFeature.getPerfil(); // herda perfil da aba Cesta
    _render();
  }

  // ── RENDER ───────────────────────────────────────────────────
  function _render() {
    if (!_nota) return;
    const el = document.getElementById('comp-content');
    if (!el) return;

    const totalNota   = _totalNota(_nota);
    const comparacoes = _mercados
      .map(m => ({
        ...m,
        estimado:  totalNota * m.multiplicador * (_geoState.ajuste || 1),
        diferenca: (totalNota * m.multiplicador * (_geoState.ajuste || 1)) - totalNota,
      }))
      .sort((a, b) => a.estimado - b.estimado);

    const melhor    = comparacoes[0];
    const maxEst    = comparacoes[comparacoes.length - 1].estimado;
    const economia  = totalNota - melhor.estimado;
    const multMedio = _mercados.reduce((s, m) => s + m.multiplicador, 0) /
                      (_mercados.length || 1);

    el.innerHTML = `
      <div class="comp-wrap">

        <div class="comp-header">
          <button class="back-btn" onclick="App.navTo('home')"
                  style="margin-bottom:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            Início
          </button>
          <div class="comp-title">Comparador de Mercados</div>
          <div class="comp-sub">
            📍 ${Fmt.esc(_geoState.cidade || 'Itapetininga')}
            · ${comparacoes.length} mercados · raio 15km
          </div>
        </div>

        <!-- Nota escaneada -->
        <div class="comp-nota-card">
          <div class="comp-nota-lbl">
            Você pagou em <strong>${Fmt.esc(_nota.emitente || 'Mercado')}</strong>
          </div>
          <div class="comp-nota-val">${Fmt.currency(totalNota)}</div>
          <div class="comp-nota-sub">
            ${_nota.itens || 0} itens ·
            ${Fmt.date(_nota.data)}
          </div>
        </div>

        <!-- Banner economia -->
        ${economia > 0.50 ? `
        <div class="comp-economia-banner">
          <div class="comp-economia-icon">💰</div>
          <div>
            <div class="comp-economia-title">Você poderia economizar até</div>
            <div class="comp-economia-val">${Fmt.currency(economia)}</div>
            <div class="comp-economia-sub">
              comprando no ${Fmt.esc(melhor.nome)}
            </div>
          </div>
        </div>` : `
        <div class="comp-economia-banner comp-economia-ok">
          <div class="comp-economia-icon">✅</div>
          <div>
            <div class="comp-economia-title">Ótima compra!</div>
            <div class="comp-economia-sub">
              Você já comprou no mercado mais em conta da região.
            </div>
          </div>
        </div>`}

        <!-- Pódio top 3 -->
        ${comparacoes.length >= 3 ? `
        <div class="comp-podio">
          ${comparacoes.slice(0, 3).map((m, i) => `
            <div class="podio-item">
              <div class="podio-pos podio-pos-${i + 1}">${i + 1}º</div>
              <div class="podio-emoji">${m.emoji}</div>
              <div class="podio-nome">${Fmt.esc(m.nome.split(' ')[0])}</div>
              <div class="podio-val"
                   style="color:${i === 0 ? 'var(--green)' : 'var(--text)'}">
                ${Fmt.currency(m.estimado)}
              </div>
            </div>`).join('')}
        </div>` : ''}

        <!-- Lista completa -->
        <div class="comp-section-title">Comparação completa</div>
        <div class="comp-lista">
          ${comparacoes.map((m, i) => _htmlMercadoItem(
            m, i, comparacoes.length, maxEst
          )).join('')}
        </div>

        <!-- Cesta básica -->
        <div class="cesta-titulo-secao">🛒 Cesta Básica por Família</div>
        ${_htmlPerfilSelector()}
        <div class="perfil-desc" id="comp-perfil-desc">
          ${CestaData.PERFIS[_perfilAtivo].desc}
        </div>

        <div id="comp-cesta-wrapper">
          ${_htmlFamilias(melhor, multMedio)}
        </div>

        <div class="cesta-detalhe-title" onclick="CompararFeature.toggleItens()">
          Ver itens da cesta
          <span id="comp-cesta-arrow">▼</span>
        </div>
        <div id="comp-cesta-detalhe" style="display:none"></div>

        <div style="margin-top:4px">
          <button class="btn-secondary" onclick="App.navTo('hist')">
            Ver histórico completo
          </button>
        </div>

        <div class="comp-disclaimer">
          ⚠️ Estimativas baseadas em pesquisa de preços regionais e cesta DIEESE.
          Mercados atualizados a cada 24h.
        </div>

      </div>`;

    _animarBarras();
  }

  // ── TROCA PERFIL ─────────────────────────────────────────────
  function trocarPerfil(perfil) {
    _perfilAtivo = perfil;
    const multMedio = _mercados.reduce((s, m) => s + m.multiplicador, 0) /
                      (_mercados.length || 1);
    const melhor = _mercados.slice().sort((a, b) => a.multiplicador - b.multiplicador)[0];

    const fw = document.getElementById('comp-cesta-wrapper');
    const pd = document.getElementById('comp-perfil-desc');
    const cd = document.getElementById('comp-cesta-detalhe');

    if (fw) fw.innerHTML = _htmlFamilias(melhor, multMedio);
    if (pd) pd.textContent = CestaData.PERFIS[perfil].desc;
    if (cd && cd.style.display !== 'none') cd.innerHTML = _htmlItens();

    document.querySelectorAll('.perfil-btn[data-comp-perfil]').forEach(btn => {
      const id  = btn.dataset.compPerfil;
      const cor = CestaData.PERFIS[id]?.cor || '';
      const ativo = id === perfil;
      btn.classList.toggle('perfil-btn-ativo', ativo);
      btn.style.borderColor = ativo ? cor : '';
      btn.style.color       = ativo ? cor : '';
    });
  }

  function toggleItens() {
    const el = document.getElementById('comp-cesta-detalhe');
    const ar = document.getElementById('comp-cesta-arrow');
    if (!el) return;
    const abrindo = el.style.display === 'none';
    el.style.display = abrindo ? 'block' : 'none';
    if (ar) ar.textContent = abrindo ? '▲' : '▼';
    if (abrindo) el.innerHTML = _htmlItens();
  }

  // ── HTML HELPERS ─────────────────────────────────────────────
  function _htmlMercadoItem(m, i, total, maxEst) {
    const isMelhor = i === 0;
    const isPior   = i === total - 1;
    const sinal    = m.diferenca > 0 ? '+' : '';
    const corDif   = m.diferenca < -0.50 ? 'var(--green)'
                   : m.diferenca > 0.50  ? 'var(--red)'
                   : 'var(--muted2)';
    const bar      = maxEst > 0 ? Math.round((m.estimado / maxEst) * 100) : 100;
    const dist     = m.distancia != null ? ` · 📍 ${m.distancia.toFixed(1)}km` : '';

    return `
      <div class="comp-item ${isMelhor ? 'comp-item-melhor' : ''}">
        <div class="comp-item-top">
          <div class="comp-item-left">
            <span class="comp-emoji">${m.emoji}</span>
            <div style="flex:1;min-width:0">
              <div class="comp-item-nome">
                ${Fmt.esc(m.nome)}
                ${isMelhor ? '<span class="comp-tag-melhor">Mais barato</span>' : ''}
                ${isPior   ? '<span class="comp-tag-pior">Mais caro</span>'    : ''}
              </div>
              <div class="comp-item-desc">${Fmt.esc(m.tipo)}${dist}</div>
            </div>
          </div>
          <div class="comp-item-right">
            <div class="comp-item-val">${Fmt.currency(m.estimado)}</div>
            <div class="comp-item-dif" style="color:${corDif}">
              ${sinal}${Fmt.currency(Math.abs(m.diferenca))}
            </div>
          </div>
        </div>
        <div class="comp-bar-track">
          <div class="comp-bar-fill" data-width="${bar}"
               style="width:0%;background:${m.cor}"></div>
        </div>
      </div>`;
  }

  function _htmlPerfilSelector() {
    return `<div class="perfil-selector">
      ${Object.values(CestaData.PERFIS).map(p => `
        <div class="perfil-btn ${_perfilAtivo === p.id ? 'perfil-btn-ativo' : ''}"
             data-comp-perfil="${p.id}"
             style="${_perfilAtivo === p.id ? `border-color:${p.cor};color:${p.cor}` : ''}"
             onclick="CompararFeature.trocarPerfil('${p.id}')">
          <span>${p.emoji}</span>
          <span class="perfil-btn-label">${p.label}</span>
        </div>`).join('')}
    </div>`;
  }

  function _htmlFamilias(melhor, multMedio) {
    return CestaData.FAMILIAS.map(f => {
      const custoBest = CestaData.calcular(f.pessoas, _perfilAtivo,
                                           melhor.multiplicador, _geoState.ajuste || 1);
      const custoMed  = CestaData.calcular(f.pessoas, _perfilAtivo,
                                           multMedio, _geoState.ajuste || 1);
      const economia  = custoMed - custoBest;
      const perfil    = CestaData.PERFIS[_perfilAtivo];
      return `
        <div class="cesta-card"
             style="border-color:${f.cor};background:${f.cor}18;margin-bottom:10px">
          <div class="cesta-card-top">
            <span class="cesta-emoji">${f.emoji}</span>
            <div>
              <div class="cesta-familia-label">${f.label}</div>
              <div class="cesta-perfil-tag" style="color:${perfil.cor}">
                ${perfil.emoji} ${perfil.label}
              </div>
            </div>
          </div>
          <div class="cesta-valor-principal" style="color:${f.cor}">
            ${Fmt.currency(custoBest)}
          </div>
          <div class="cesta-valor-sub">
            /mês no ${Fmt.esc(melhor.nome.split(' ')[0])}
          </div>
          <div class="cesta-linhas">
            <div class="cesta-linha">
              <span class="cesta-linha-lbl">Média da região</span>
              <span class="cesta-linha-val">${Fmt.currency(custoMed)}</span>
            </div>
            <div class="cesta-linha">
              <span class="cesta-linha-lbl">Economia possível</span>
              <span class="cesta-linha-val" style="color:var(--green)">
                -${Fmt.currency(economia)}
              </span>
            </div>
            <div class="cesta-linha">
              <span class="cesta-linha-lbl">Custo por dia</span>
              <span class="cesta-linha-val">
                ${Fmt.currency(custoBest / 30)}
              </span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function _htmlItens() {
    const perfil = CestaData.PERFIS[_perfilAtivo];
    const cats   = CestaData.itensPorCategoria();
    return `<div class="cesta-itens-wrap">
      <div class="cesta-itens-perfil-badge" style="color:${perfil.cor}">
        ${perfil.emoji} Perfil ${perfil.label} — ${perfil.desc}
      </div>
      ${Object.entries(cats).map(([cat, itens]) => `
        <div class="cesta-cat-title">${cat}</div>
        ${itens.map(item => `
          <div class="cesta-item-row">
            <span class="cesta-item-nome">${item.nome}</span>
            <span class="cesta-item-qtd">${item.qtd}/p</span>
            <span class="cesta-item-preco" style="color:${perfil.cor}">
              ${Fmt.currency(item[_perfilAtivo])}
            </span>
          </div>`).join('')}
      `).join('')}
    </div>`;
  }

  function _totalNota(n) {
    return Number(n.essencial || 0) +
           Number(n.complementar || 0) +
           Number(n.superfluo || 0);
  }

  function _animarBarras() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.comp-bar-fill[data-width]').forEach(b => {
        b.style.width = b.dataset.width + '%';
      });
    });
  }

  return { abrir, trocarPerfil, toggleItens };
})();

window.CompararFeature = CompararFeature;
