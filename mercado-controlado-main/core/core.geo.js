// ════════════════════════════════════════════════════════════════
// NotaFácil — core/geo.js
// Geolocalização + Geocoding reverso (Nominatim/OpenStreetMap)
// ════════════════════════════════════════════════════════════════

const Geo = (() => {
  // Ajuste de custo de vida por estado (IPCA regional IBGE)
  const AJUSTE_ESTADO = {
    SP: 1.00, RJ: 1.05, MG: 0.95, RS: 0.93, PR: 0.94, SC: 0.96,
    BA: 0.91, PE: 0.90, CE: 0.89, GO: 0.92, DF: 1.08, AM: 1.06,
    PA: 0.92, MT: 0.94, MS: 0.93, ES: 0.97, RN: 0.90, PB: 0.89,
    AL: 0.88, SE: 0.90, PI: 0.88, MA: 0.89, TO: 0.91, RO: 0.94,
    AC: 1.02, AP: 1.03, RR: 1.04,
  };

  // Estado atual (singleton por sessão)
  let _state = {
    lat:    null,
    lng:    null,
    cidade: 'Itapetininga',
    estado: 'SP',
    ajuste: 1.00,
    feito:  false,   // tentou ao menos uma vez
    gpsOk:  false,   // GPS foi concedido
  };

  /**
   * Distância entre dois pontos em km (Haversine)
   */
  function distKm(la1, lo1, la2, lo2) {
    const R = 6371;
    const dL = (la2 - la1) * Math.PI / 180;
    const dG = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dL / 2) ** 2 +
      Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
      Math.sin(dG / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Obtém localização do dispositivo e faz geocoding reverso.
   * Resolve sempre (nunca rejeita) — fallback para Itapetininga/SP.
   * @returns {Promise<object>} estado de geolocalização
   */
  async function detectar() {
    // Só rebusca se GPS foi negado anteriormente (permite tentar de novo)
    // ou se ainda não tentou
    if (_state.feito && _state.gpsOk) return _state;

    return new Promise(resolve => {
      if (!navigator.geolocation) {
        _state.feito = true;
        resolve(_state);
        return;
      }

      // Timeout de segurança: se o usuário não responder ao popup em 5s
      const fallback = setTimeout(() => {
        _state.feito = true;
        resolve(_state);
      }, 5500);

      navigator.geolocation.getCurrentPosition(
        async pos => {
          clearTimeout(fallback);
          _state.lat   = pos.coords.latitude;
          _state.lng   = pos.coords.longitude;
          _state.gpsOk = true;
          _state.feito = true;

          // Geocoding reverso
          try {
            const url = `https://nominatim.openstreetmap.org/reverse` +
              `?lat=${_state.lat}&lon=${_state.lng}&format=json&accept-language=pt-BR`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res  = await fetch(url, {
              headers:  { 'User-Agent': 'NotaFacil/1.0' },
              signal:   controller.signal,
            });
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              _state.cidade = addr.city || addr.town || addr.village ||
                              addr.county || 'Sua cidade';
              _state.estado = (addr['ISO3166-2-lvl4'] || 'BR-SP').replace('BR-', '');
              _state.ajuste = AJUSTE_ESTADO[_state.estado] || 1.00;
            }
          } catch {
            // Mantém fallback SP
          }

          resolve(_state);
        },
        () => {
          clearTimeout(fallback);
          _state.feito = true;
          _state.gpsOk = false;
          resolve(_state);
        },
        { timeout: 5000, maximumAge: 300_000, enableHighAccuracy: false }
      );
    });
  }

  function getState()  { return { ..._state }; }
  function resetar()   { _state.feito = false; _state.gpsOk = false; }

  return { detectar, getState, distKm, resetar };
})();

window.Geo = Geo;
