// ════════════════════════════════════════════════════════════════
// NotaFácil — data/mercados.js
// • Base local Itapetininga (fallback)
// • Busca OpenStreetMap Overpass (raio 15km) com cache 24h
// • Multiplicadores ÚNICOS por mercado via hash do nome
//   → cada mercado tem valor diferente, estável entre sessões
// • Preços reais quando há histórico de compras (Storage)
// ════════════════════════════════════════════════════════════════

const Mercados = (() => {

  // ── FAIXAS DE MULTIPLICADOR POR TIPO ─────────────────────────
  // Cada tipo tem uma faixa. O hash do nome determina onde
  // dentro da faixa o mercado cai — único e estável.
  const FAIXAS = {
    atacarejo:    { min: 0.72, max: 0.84 }, // atacarejo é sempre mais barato
    supermercado: { min: 0.86, max: 1.05 }, // supermercados variam bastante
    mercadinho:   { min: 1.05, max: 1.20 }, // mercadinhos são mais caros
    mercearia:    { min: 1.00, max: 1.15 },
  };

  const PALAVRAS_ATACAREJO = [
    'atacad', 'assai', 'assaí', 'spani', 'tenda', 'makro',
    "sam's", 'sams', 'maxxi', 'roldão', 'mart minas', 'atacarejo',
    'armazem', 'armazém', 'distribuidor',
  ];
  const PALAVRAS_MERCADINHO = [
    'mercadinho', 'mini merca', 'mini-merca', 'padaria', 'empório',
    'emporio', 'minimercado', 'mercearia', 'quitanda', 'hortifruti',
  ];

  /**
   * Hash numérico determinístico de uma string.
   * Sempre retorna o mesmo número para o mesmo nome.
   * Retorna valor entre 0 e 1.
   */
  function _hashNome(nome) {
    const s = String(nome || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    // Converte para 0..1
    return Math.abs(h) / 2147483647;
  }

  /**
   * Retorna multiplicador ÚNICO e ESTÁVEL para um mercado.
   * Determinístico: mesmo mercado = mesmo valor sempre.
   * Diferenciado: cada mercado tem seu próprio valor dentro da faixa.
   */
  function _multUnico(nome, tipoOSM) {
    const n = (nome || '').toLowerCase();

    let faixa;
    if (PALAVRAS_ATACAREJO.some(p  => n.includes(p)))  faixa = FAIXAS.atacarejo;
    else if (PALAVRAS_MERCADINHO.some(p => n.includes(p))) faixa = FAIXAS.mercadinho;
    else if (tipoOSM === 'convenience')                    faixa = FAIXAS.mercadinho;
    else if (tipoOSM === 'grocery')                        faixa = FAIXAS.mercearia;
    else                                                    faixa = FAIXAS.supermercado;

    // Posiciona o mercado dentro da faixa usando o hash do nome
    const pos  = _hashNome(nome);
    const mult = faixa.min + (pos * (faixa.max - faixa.min));

    // Arredonda para 4 casas para evitar valores muito longos
    return Math.round(mult * 10000) / 10000;
  }

  // ── PALETA FIXA ───────────────────────────────────────────────
  const CORES = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
    '#6366f1', '#a78bfa',
  ];
  const EMOJI_OSM = { supermarket: '🏪', convenience: '🛒', grocery: '🧺' };

  // ── FALLBACK ITAPETININGA ─────────────────────────────────────
  // Valores reais pesquisados localmente
  const ITAPETININGA = [
    { id: 'spani',      nome: 'Spani Atacadista',     emoji: '🏭', multiplicador: 0.76, cor: '#f97316', tipo: 'Atacarejo',    lat: -23.5914, lng: -48.0528 },
    { id: 'tenda',      nome: 'Tenda Atacado',         emoji: '🏬', multiplicador: 0.80, cor: '#ef4444', tipo: 'Atacarejo',    lat: -23.5923, lng: -48.0556 },
    { id: 'cofesa',     nome: 'Cofesa',                emoji: '🛒', multiplicador: 0.88, cor: '#06b6d4', tipo: 'Supermercado', lat: -23.5867, lng: -48.0534 },
    { id: 'lm',         nome: 'LM Supermercados',      emoji: '🏪', multiplicador: 0.91, cor: '#8b5cf6', tipo: 'Supermercado', lat: -23.5889, lng: -48.0512 },
    { id: 'vencedor',   nome: 'Vencedor',              emoji: '🏆', multiplicador: 0.94, cor: '#f59e0b', tipo: 'Supermercado', lat: -23.5901, lng: -48.0501 },
    { id: 'roberto',    nome: 'Roberto Supermercados', emoji: '🛍', multiplicador: 0.97, cor: '#10b981', tipo: 'Supermercado', lat: -23.5878, lng: -48.0489 },
    { id: 'mercadinho', nome: 'Mercadinho do Bairro',  emoji: '🏠', multiplicador: 1.12, cor: '#a78bfa', tipo: 'Mercadinho',   lat: -23.5850, lng: -48.0470 },
  ];

  // ── APLICA PREÇO REAL SE DISPONÍVEL ──────────────────────────
  // Se o usuário já comprou nesse mercado 2+ vezes, usa o ticket
  // médio real. Caso contrário usa o multiplicador estimado pelo hash.
  function _resolverMultiplicador(nome, tipoOSM, multBase) {
    // Tenta preço real do histórico de compras
    if (Storage && typeof Storage.multiplicadorReal === 'function') {
      const real = Storage.multiplicadorReal(nome);
      if (real !== null) {
        return { multiplicador: real, temPrecoReal: true };
      }
    }
    // Usa estimativa única por hash
    const estimado = multBase !== undefined
      ? multBase  // fallback Itapetininga tem valor fixo já pesquisado
      : _multUnico(nome, tipoOSM);
    return { multiplicador: estimado, temPrecoReal: false };
  }

  // ── BUSCA OSM ─────────────────────────────────────────────────
  async function _buscarOSM(lat, lng) {
    const query = `
      [out:json][timeout:15];
      (
        node["shop"="supermarket"](around:15000,${lat},${lng});
        node["shop"="convenience"](around:15000,${lat},${lng});
        node["shop"="grocery"](around:15000,${lat},${lng});
        way["shop"="supermarket"](around:15000,${lat},${lng});
      );
      out center 20;`;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      body:    'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  AbortSignal.timeout(18_000),
    });

    if (!res.ok) throw new Error(`OSM HTTP ${res.status}`);
    const data = await res.json();
    return data.elements || [];
  }

  function _elementosParaMercados(elementos, userLat, userLng) {
    const vistos = new Set();
    return elementos
      .filter(e => {
        const nome = e.tags?.name;
        if (!nome || vistos.has(nome.toLowerCase())) return false;
        vistos.add(nome.toLowerCase());
        return true;
      })
      .map((e, i) => {
        const lat  = e.lat ?? e.center?.lat;
        const lng  = e.lon ?? e.center?.lon;
        const tipo = e.tags?.shop || 'supermarket';
        const nome = e.tags?.name || 'Supermercado';
        const dist = (lat != null && lng != null)
          ? Geo.distKm(userLat, userLng, lat, lng)
          : 99;

        const tipoLabel = tipo === 'supermarket' ? 'Supermercado'
                        : tipo === 'convenience' ? 'Mercadinho'
                        : 'Mercearia';

        // Multiplicador único por nome (hash determinístico)
        const { multiplicador, temPrecoReal } = _resolverMultiplicador(nome, tipo);

        return {
          id:            `osm_${e.id || i}`,
          nome,
          emoji:         EMOJI_OSM[tipo] || '🏪',
          multiplicador,
          temPrecoReal,
          cor:           CORES[i % CORES.length],
          tipo:          tipoLabel,
          lat, lng,
          distancia:     dist,
        };
      })
      .filter(m => m.distancia <= 15)
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, 12);
  }

  /**
   * Ponto de entrada principal.
   * Retorna mercados com multiplicadores únicos, estáveis e diferenciados.
   */
  async function obter(geoState) {
    const { lat, lng, gpsOk } = geoState;

    // Sem GPS — retorna fallback Itapetininga
    if (!gpsOk || lat === null) {
      return ITAPETININGA.map(m => {
        const { multiplicador, temPrecoReal } = _resolverMultiplicador(m.nome, null, m.multiplicador);
        return { ...m, multiplicador, temPrecoReal, distancia: null };
      });
    }

    // Tenta cache OSM (24h)
    const cached = Storage.lerCacheMercados(lat, lng);
    if (cached && cached.length >= 2) {
      console.log(`[Mercados] ${cached.length} mercados do cache (24h)`);
      // Recalcula multiplicadores com dados reais mais recentes
      return cached.map(m => {
        const { multiplicador, temPrecoReal } = _resolverMultiplicador(
          m.nome, null, m.multiplicador
        );
        return { ...m, multiplicador, temPrecoReal };
      });
    }

    // Busca no OSM
    try {
      const elementos = await _buscarOSM(lat, lng);
      const mercados  = _elementosParaMercados(elementos, lat, lng);

      if (mercados.length >= 2) {
        // Salva no cache sem a flag temPrecoReal (recalcula sempre)
        const paraCache = mercados.map(({ temPrecoReal, ...m }) => m);
        Storage.salvarCacheMercados(lat, lng, geoState.cidade, paraCache);
        console.log(`[Mercados] ${mercados.length} mercados OSM cacheados`);
        return mercados;
      }
    } catch (e) {
      console.warn('[Mercados] OSM falhou:', e.message);
    }

    // Fallback Itapetininga com distâncias
    return ITAPETININGA.map(m => {
      const { multiplicador, temPrecoReal } = _resolverMultiplicador(m.nome, null, m.multiplicador);
      return {
        ...m,
        multiplicador,
        temPrecoReal,
        distancia: Geo.distKm(lat, lng, m.lat, m.lng),
      };
    });
  }

  return { obter, ITAPETININGA };
})();

window.Mercados = Mercados;
