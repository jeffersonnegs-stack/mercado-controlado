// ════════════════════════════════════════════════════════════════
// NotaFácil — core/formatter.js
// Utilitários de formatação compartilhados por todos os módulos
// ════════════════════════════════════════════════════════════════

const Formatter = (() => {
  /**
   * Formata valor como moeda BRL
   * @param {number} v
   * @returns {string} "R$ 1.234,56"
   */
  function currency(v) {
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Formata valor abreviado (para espaços pequenos)
   * @param {number} v
   * @returns {string} "R$1,2k" ou "R$123"
   */
  function short(v) {
    v = Number(v || 0);
    if (v >= 1000) return 'R$' + (v / 1000).toFixed(1) + 'k';
    return 'R$' + v.toFixed(0);
  }

  /**
   * Escapa HTML para prevenção de XSS
   * @param {*} str
   * @returns {string}
   */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Formata data ISO para pt-BR
   * @param {string} iso
   * @param {boolean} full - incluir horário
   * @returns {string}
   */
  function date(iso, full = false) {
    if (!iso) return '--';
    try {
      const d = new Date(iso);
      return full ? d.toLocaleString('pt-BR') : d.toLocaleDateString('pt-BR');
    } catch {
      return '--';
    }
  }

  return { currency, short, esc, date };
})();

// Exporta globalmente (sem módulos ES para compatibilidade com SW e CDN)
window.Fmt = Formatter;
