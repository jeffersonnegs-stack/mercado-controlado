// ════════════════════════════════════════════════════════════════
// NotaFácil — core/storage.js
// Camada de persistência com:
//  • Proteção de QuotaExceededError
//  • Filtro de notas por mês atual
//  • Cache em memória para leituras repetidas
// ════════════════════════════════════════════════════════════════

const Storage = (() => {
  const KEY_NOTAS   = 'nfce_notas';
  const MAX_NOTAS   = 500;        // limite de notas armazenadas
  const PURGE_COUNT = 50;         // quantas remover quando cheio

  // Cache em memória — evita leituras repetidas do localStorage
  let _cache = null;

  // ── LEITURA ──────────────────────────────────────────────────
  function lerNotas() {
    if (_cache !== null) return _cache;
    try {
      _cache = JSON.parse(localStorage.getItem(KEY_NOTAS) || '[]');
      if (!Array.isArray(_cache)) _cache = [];
    } catch {
      _cache = [];
    }
    return _cache;
  }

  // ── ESCRITA COM PROTEÇÃO ──────────────────────────────────────
  function salvarNotas(lista) {
    // Garante que nunca ultrapassa o limite
    if (lista.length > MAX_NOTAS) {
      lista = lista.slice(lista.length - MAX_NOTAS);
    }
    try {
      localStorage.setItem(KEY_NOTAS, JSON.stringify(lista));
      _cache = lista;
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // Libera espaço removendo as mais antigas e tenta de novo
        console.warn('[Storage] QuotaExceededError — removendo notas antigas');
        lista = lista.slice(PURGE_COUNT);
        try {
          localStorage.setItem(KEY_NOTAS, JSON.stringify(lista));
          _cache = lista;
          return true;
        } catch {
          console.error('[Storage] Falha crítica ao salvar notas');
          return false;
        }
      }
      return false;
    }
  }

  // ── ADICIONA UMA NOTA ─────────────────────────────────────────
  function adicionarNota(nota) {
    const lista = lerNotas().slice(); // cópia para não mutar o cache direto
    lista.push(nota);
    return salvarNotas(lista);
  }

  // ── NOTAS DO MÊS ATUAL ────────────────────────────────────────
  function notasDoMes() {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    return lerNotas().filter(n => {
      if (!n.data) return false;
      try {
        const d = new Date(n.data);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      } catch {
        return false;
      }
    });
  }

  // ── TOTAIS DO MÊS ─────────────────────────────────────────────
  function totaisDoMes() {
    const notas = notasDoMes();
    let ess = 0, comp = 0, sup = 0;
    notas.forEach(n => {
      ess  += Number(n.essencial    || 0);
      comp += Number(n.complementar || 0);
      sup  += Number(n.superfluo    || 0);
    });
    const total  = ess + comp + sup;
    const pctSup = total > 0 ? (sup / total) * 100 : 0;
    // Score: 100% supérfluo = 0pts; 0% supérfluo = 100pts
    const score  = Math.max(0, Math.round(100 - pctSup * 1.5));
    return { ess, comp, sup, total, score, notas };
  }

  // ── INVALIDA CACHE ────────────────────────────────────────────
  function invalidarCache() {
    _cache = null;
  }

  // ── CACHE DE MERCADOS (OSM) ───────────────────────────────────
  const KEY_CACHE_MERCADOS = 'nf_mercados_cache';
  const TTL_MERCADOS = 24 * 60 * 60 * 1000; // 24h

  function lerCacheMercados(lat, lng) {
    try {
      const raw = localStorage.getItem(KEY_CACHE_MERCADOS);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      if (Date.now() - cache.ts > TTL_MERCADOS) return null;
      // Só invalida por localização se temos GPS válido
      if (lat !== null && lng !== null &&
          cache.lat !== null && cache.lng !== null) {
        const d = _distKm(lat, lng, cache.lat, cache.lng);
        if (d > 2) return null; // mudou mais de 2km
      }
      return Array.isArray(cache.mercados) ? cache.mercados : null;
    } catch {
      return null;
    }
  }

  function salvarCacheMercados(lat, lng, cidade, mercados) {
    try {
      localStorage.setItem(KEY_CACHE_MERCADOS, JSON.stringify({
        lat, lng, cidade, ts: Date.now(), mercados,
      }));
    } catch {
      // Falha silenciosa — cache é opcional
    }
  }

  function _distKm(la1, lo1, la2, lo2) {
    const R = 6371;
    const dL = (la2 - la1) * Math.PI / 180;
    const dG = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dL / 2) ** 2 +
      Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
      Math.sin(dG / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return {
    lerNotas,
    salvarNotas,
    adicionarNota,
    notasDoMes,
    totaisDoMes,
    invalidarCache,
    lerCacheMercados,
    salvarCacheMercados,
  };
})();

window.Storage = Storage;
