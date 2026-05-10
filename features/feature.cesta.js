// ════════════════════════════════════════════════════════════════
// NotaFácil — features/cesta.js
// Tela independente de Comparador de Cesta Básica
//  • Não depende de nota escaneada
//  • Mercados via Geo + Mercados (com cache 24h)
//  • 3 perfis × 3 famílias
//  • Re-render parcial ao trocar perfil (sem refazer tudo)
// ════════════════════════════════════════════════════════════════

const CestaFeature = (() => {
  let _mercados    = [];
  let _geoState    = {};
  let _perfilAtivo = 'medio';
  let _carregado   = false;  // evita rebuscar a cada troca de aba

  // ── PONTO DE ENTRADA ─────────────────────────────────────────
  async function abrir() {
    const el = document.getElementById('cesta-content');
    if (!el) return;

    // Mostra loading apenas na primeira vez
    if (!_carregado) {
      el.innerHTML = _htmlLoading();
      _geoState = await Geo.detectar();
      _mercados = await Mercados.obter(_geoState);
      _carregado = true;
    }

    _render();
  }

  // ── RENDER COMPLETO ──────────────────────────────────────────
  function _render() {
    const el = document.getElementById('cesta-content');
    if (!el) return;

    const { melhor, multMedio, ordenados } = _calcularMercados();
    const cached   = Storage.lerCacheMercados(_geoState.lat, _geoState.lng);
    const cacheTag = cached
      ? ' · <span style="color:var(--green)">cache 24h ✓</span>'
      : '';
    const osmTag   = _mercados.length >= 2 && _geoState.gpsOk
      ? `OpenStreetMap ✓${cacheTag}`
      : 'base local';

    el.innerHTML = `
      <div style="padding:16px 16px 120px">

        <div class="cesta-loc-badge">
          📍 ${Fmt.esc(_geoState.cidade || 'Itapetininga')}
          · ${_mercados.length} mercados · ${osmTag}
        </div>

        <!-- Destaque mercado mais barato -->
        <div class="cesta-melhor-card">
          <div class="cesta-melhor-tag">🏆 Mais barato agora</div>
          <div class="cesta-melhor-nome">${melhor.emoji} ${Fmt.esc(melhor.nome)}</div>
          <div class="cesta-melhor-tipo">
            ${Fmt.esc(melhor.tipo)}
            ${melhor.distancia != null ? ` · 📍 ${melhor.distancia.toFixed(1)}km` : ''}
          </div>
          <div class="cesta-melhor-economia">
            Economia de até
            <strong>${Math.round((1 - melhor.multiplicador) * 100)}%</strong>
            vs média da região
          </div>
        </div>

        <!-- Seletor de perfil -->
        <div class="cesta-titulo-secao">Escolha o perfil de produtos</div>
        ${_htmlPerfilSelector()}
        <div class="perfil-desc" id="cesta-perfil-desc">
          ${CestaData.PERFIS[_perfilAtivo].desc}
        </div>

        <!-- Cards de família (re-renderizáveis) -->
        <div class="cesta-titulo-secao">Custo mensal por família</div>
        <div id="cesta-familias-wrapper">
          ${_htmlFamilias(melhor, multMedio)}
        </div>

        <!-- Ranking de mercados -->
        <div class="cesta-titulo-secao">Ranking — cesta de 4 pessoas</div>
        <div class="comp-lista" id="cesta-ranking">
          ${_htmlRanking(ordenados, melhor)}
        </div>

        <!-- Detalhamento itens -->
        <div class="cesta-detalhe-title" onclick="CestaFeature.toggleItens()">
          Ver todos os itens da cesta
          <span id="cesta-arrow">▼</span>
        </div>
        <div id="cesta-detalhe" style="display:none">
          ${_htmlItens()}
        </div>

        <div style="margin-top:16px">
          <button class="btn-primary" onclick="App.navTo('scan')">
            📷 Escanear nota para comparação detalhada
          </button>
        </div>

        <div class="comp-disclaimer">
          ⚠️ Estimativas baseadas em pesquisa de preços regionais e cesta DIEESE.
          Mercados e preços atualizados a cada 24h.
        </div>

      </div>`;

    _animarBarras();
  }

  // ── TROCA PERFIL (re-render parcial) ─────────────────────────
  function trocarPerfil(perfil) {
    _perfilAtivo = perfil;
    const { melhor, multMedio, ordenados } = _calcularMercados();

    // Atualiza só os elementos que mudam — sem re-render total
    const fw = document.getElementById('cesta-familias-wrapper');
    const rk = document.getElementById('cesta-ranking');
    const pd = document.getElementById('cesta-perfil-desc');
    const cd = document.getElementById('cesta-detalhe');

    if (fw) fw.innerHTML = _htmlFamilias(melhor, multMedio);
    if (rk) { rk.innerHTML = _htmlRanking(ordenados, melhor); _animarBarras(); }
    if (pd) pd.textContent = CestaData.PERFIS[perfil].desc;
    if (cd && cd.style.display !== 'none') cd.innerHTML = _htmlItens();

    // Atualiza estilo dos botões de perfil
    document.querySelectorAll('.perfil-btn[data-perfil]').forEach(btn => {
      const id  = btn.dataset.perfil;
      const cor = CestaData.PERFIS[id]?.cor || '';
      const ativo = id === perfil;
      btn.classList.toggle('perfil-btn-ativo', ativo);
      btn.style.borderColor = ativo ? cor : '';
      btn.style.color       = ativo ? cor : '';
    });
  }

  function toggleItens() {
    const el = document.getElementById('cesta-detalhe');
    const ar = document.getElementById('cesta-arrow');
    if (!el) return;
    const abrindo = el.style.display === 'none';
    el.style.display = abrindo ? 'block' : 'none';
    if (ar) ar.textContent = abrindo ? '▲' : '▼';
    if (abrindo) el.innerHTML = _htmlItens(); // atualiza com perfil atual
  }

  // ── CÁLCULOS ─────────────────────────────────────────────────
  function _calcularMercados() {
    const ordenados = _mercados
      .slice()
      .sort((a, b) => a.multiplicador - b.multiplicador);
    const melhor    = ordenados[0];
    const multMedio = _mercados.reduce((s, m) => s + m.multiplicador, 0) /
                      (_mercados.length || 1);
    return { melhor, multMedio, ordenados };
  }

  // ── HTML HELPERS ─────────────────────────────────────────────
  function _htmlLoading() {
    return `<div style="padding:16px;text-align:center;padding-top:60px">
      <div style="font-size:36px;margin-bottom:12px">📍</div>
      <div style="font-size:15px;color:var(--muted2);margin-bottom:6px">
        Buscando mercados próximos...
      </div>
      <div style="font-size:12px;color:var(--muted)">
        Via OpenStreetMap · raio 15km
      </div>
    </div>`;
  }

  function _htmlPerfilSelector() {
    return `<div class="perfil-selector">
      ${Object.values(CestaData.PERFIS).map(p => `
        <div class="perfil-btn ${_perfilAtivo === p.id ? 'perfil-btn-ativo' : ''}"
             data-perfil="${p.id}"
             style="${_perfilAtivo === p.id ? `border-color:${p.cor};color:${p.cor}` : ''}"
             onclick="CestaFeature.trocarPerfil('${p.id}')">
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
              <span class="cesta-linha-val">${Fmt.currency(custoBest / 30)}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function _htmlRanking(ordenados, melhor) {
    const maxCesta = CestaData.calcular(4, _perfilAtivo,
      ordenados[ordenados.length - 1].multiplicador, _geoState.ajuste || 1);

    return ordenados.map((m, i) => {
      const cesta4  = CestaData.calcular(4, _perfilAtivo, m.multiplicador, _geoState.ajuste || 1);
      const cestaMelhor = CestaData.calcular(4, _perfilAtivo, melhor.multiplicador, _geoState.ajuste || 1);
      const diff    = cesta4 - cestaMelhor;
      const sinal   = diff > 0 ? '+' : '';
      const corDif  = diff < -0.50 ? 'var(--green)' : diff > 0.50 ? 'var(--red)' : 'var(--muted2)';
      const bar     = maxCesta > 0 ? Math.round((cesta4 / maxCesta) * 100) : 100;
      const dist    = m.distancia != null ? ` · 📍 ${m.distancia.toFixed(1)}km` : '';
      const isMelhor = i === 0;
      const isPior   = i === ordenados.length - 1;

      return `
        <div class="comp-item ${isMelhor ? 'comp-item-melhor' : ''}">
          <div class="comp-item-top">
            <div class="comp-item-left">
              <span class="comp-emoji">${m.emoji}</span>
              <div style="flex:1;min-width:0">
                <div class="comp-item-nome">
                  ${i + 1}º ${Fmt.esc(m.nome)}
                  ${isMelhor ? '<span class="comp-tag-melhor">Mais barato</span>' : ''}
                  ${isPior   ? '<span class="comp-tag-pior">Mais caro</span>'    : ''}
                </div>
                <div class="comp-item-desc">${Fmt.esc(m.tipo)}${dist}</div>
              </div>
            </div>
            <div class="comp-item-right">
              <div class="comp-item-val">${Fmt.currency(cesta4)}</div>
              <div class="comp-item-dif" style="color:${corDif}">
                ${sinal}${Fmt.currency(Math.abs(diff))}
              </div>
            </div>
          </div>
          <div class="comp-bar-track">
            <div class="comp-bar-fill" data-width="${bar}"
                 style="width:0%;background:${m.cor}"></div>
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

  function _animarBarras() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.comp-bar-fill[data-width]').forEach(b => {
        b.style.width = b.dataset.width + '%';
      });
    });
  }

  // Expõe estado para CompararFeature reutilizar
  function getMercados()  { return _mercados; }
  function getGeoState()  { return _geoState; }
  function getPerfil()    { return _perfilAtivo; }

  return { abrir, trocarPerfil, toggleItens, getMercados, getGeoState, getPerfil };
})();

window.CestaFeature = CestaFeature;
