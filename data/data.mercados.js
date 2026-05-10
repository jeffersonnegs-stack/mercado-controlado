// ════════════════════════════════════════════════════════════════
// NotaFácil — data/mercados.js
// • Base local Itapetininga (fallback)
// • Busca OpenStreetMap Overpass (raio 15km)
// • Multiplicadores DETERMINÍSTICOS (sem Math.random)
// • Cache de 24h via Storage
// ════════════════════════════════════════════════════════════════

const Mercados = (() => {
  // ── MULTIPLICADORES FIXOS POR TIPO ───────────────────────────
  // Fonte: pesquisa PROCON-SP + DIEESE 2024
  const MULT = {
    atacarejo:    0.80,
    supermercado: 0.94,
    mercadinho:   1.12,
    mercearia:    1.08,
  };

  const PALAVRAS_ATACAREJO  = [
    'atacad', 'assai', 'assaí', 'spani', 'tenda', 'makro',
    "sam's", 'sams', 'maxxi', 'roldão', 'mart minas', 'atacarejo',
  ];
  const PALAVRAS_MERCADINHO = [
    'mercadinho', 'mini merca', 'conveniên', 'padaria', 'empório',
    'emporio', 'minimercado',
  ];

  function multPorNome(nome, tipoOSM) {
    const n = (nome || '').toLowerCase();
    if (PALAVRAS_ATACAREJO.some(p  => n.includes(p))) return MULT.atacarejo;
    if (PALAVRAS_MERCADINHO.some(p => n.includes(p))) return MULT.mercadinho;
    if (tipoOSM === 'convenience')                    return MULT.mercadinho;
    if (tipoOSM === 'grocery')                        return MULT.mercearia;
    return MULT.supermercado;
  }

  // ── PALETA FIXA (sem Math.random) ────────────────────────────
  const CORES = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
    '#6366f1', '#a78bfa',
  ];
  const EMOJI_OSM = { supermarket: '🏪', convenience: '🛒', grocery: '🧺' };

  // ── FALLBACK ITAPETININGA ─────────────────────────────────────
  const ITAPETININGA = [
    { id: 'spani',      nome: 'Spani Atacadista',     emoji: '🏭', multiplicador: 0.76, cor: '#f97316', tipo: 'Atacarejo',    lat: -23.5914, lng: -48.0528 },
    { id: 'tenda',      nome: 'Tenda Atacado',         emoji: '🏬', multiplicador: 0.80, cor: '#ef4444', tipo: 'Atacarejo',    lat: -23.5923, lng: -48.0556 },
    { id: 'cofesa',     nome: 'Cofesa',                emoji: '🛒', multiplicador: 0.88, cor: '#06b6d4', tipo: 'Supermercado', lat: -23.5867, lng: -48.0534 },
    { id: 'lm',         nome: 'LM Supermercados',      emoji: '🏪', multiplicador: 0.91, cor: '#8b5cf6', tipo: 'Supermercado', lat: -23.5889, lng: -48.0512 },
    { id: 'vencedor',   nome: 'Vencedor',              emoji: '🏆', multiplicador: 0.94, cor: '#f59e0b', tipo: 'Supermercado', lat: -23.5901, lng: -48.0501 },
    { id: 'roberto',    nome: 'Roberto Supermercados', emoji: '🛍', multiplicador: 0.97, cor: '#10b981', tipo: 'Supermercado', lat: -23.5878, lng: -48.0489 },
    { id: 'mercadinho', nome: 'Mercadinho do Bairro',  emoji: '🏠', multiplicador: 1.12, cor: '#a78bfa', tipo: 'Mercadinho',   lat: -23.5850, lng: -48.0470 },
  ];

  // ── BUSCA OSM ─────────────────────────────────────────────────
  async function buscarOSM(lat, lng) {
    const query = `
      [out:json][timeout:15];
      (
        node["shop"="supermarket"](around:15000,${lat},${lng});
        node["shop"="convenience"](around:15000,${lat},${lng});
        node["shop"="grocery"](around:15000,${lat},${lng});
        way["shop"="supermarket"](around:15000,${lat},${lng});
      );
      out center 20;`;

    const res  = await fetch('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      body:    'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  AbortSignal.timeout(18_000),
    });

    if (!res.ok) throw new Error(`OSM HTTP ${res.status}`);
    const data = await res.json();
    return data.elements || [];
  }

  function elementosParaMercados(elementos, userLat, userLng) {
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

        return {
          id:            `osm_${e.id || i}`,
          nome,
          emoji:         EMOJI_OSM[tipo] || '🏪',
          multiplicador: multPorNome(nome, tipo),  // DETERMINÍSTICO
          cor:           CORES[i % CORES.length],  // FIXO por índice
          tipo:          tipo === 'supermarket' ? 'Supermercado'
                       : tipo === 'convenience' ? 'Mercadinho'
                       : 'Mercearia',
          lat, lng, distancia: dist,
        };
      })
      .filter(m => m.distancia <= 15)
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, 12);
  }

  /**
   * Retorna lista de mercados no raio de 15km.
   * Usa cache de 24h; fallback para Itapetininga se GPS negado ou OSM falhar.
   */
  async function obter(geoState) {
    const { lat, lng, gpsOk } = geoState;

    // Sem GPS: retorna fallback com distância null
    if (!gpsOk || lat === null) {
      return ITAPETININGA.map(m => ({ ...m, distancia: null }));
    }

    // Tenta cache primeiro
    const cached = Storage.lerCacheMercados(lat, lng);
    if (cached && cached.length >= 2) {
      console.log(`[Mercados] ${cached.length} mercados do cache`);
      return cached;
    }

    // Busca OSM
    try {
      const elementos = await buscarOSM(lat, lng);
      const mercados  = elementosParaMercados(elementos, lat, lng);

      if (mercados.length >= 2) {
        Storage.salvarCacheMercados(lat, lng, geoState.cidade, mercados);
        console.log(`[Mercados] ${mercados.length} mercados OSM salvos no cache`);
        return mercados;
      }
    } catch (e) {
      console.warn('[Mercados] OSM falhou:', e.message);
    }

    // Fallback: base Itapetininga com distâncias calculadas
    return ITAPETININGA.map(m => ({
      ...m,
      distancia: Geo.distKm(lat, lng, m.lat, m.lng),
    }));
  }

  return { obter, ITAPETININGA };
})();

window.Mercados = Mercados;
