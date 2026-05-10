// ════════════════════════════════════════════════════════════════
// NotaFácil — data/cesta.js
// Itens da cesta básica com 3 perfis de preço
// Fonte: DIEESE Cesta Básica Nacional + ANVISA 2024
// ════════════════════════════════════════════════════════════════

const CestaData = (() => {
  const ITENS = [
    // ── Grãos & Cereais ────────────────────────────────────────
    { nome: 'Arroz (5kg)',              categ: '🌾 Grãos',      qtd: 0.6,  eco: 18.90, medio: 24.90, premium: 31.90 },
    { nome: 'Feijão carioca (1kg)',     categ: '🌾 Grãos',      qtd: 1.2,  eco: 5.90,  medio: 7.50,  premium: 9.80  },
    { nome: 'Açúcar refinado (1kg)',    categ: '🌾 Grãos',      qtd: 1.5,  eco: 3.50,  medio: 4.20,  premium: 5.80  },
    { nome: 'Farinha de trigo (1kg)',   categ: '🌾 Grãos',      qtd: 0.8,  eco: 2.90,  medio: 3.90,  premium: 5.50  },
    { nome: 'Macarrão (500g)',          categ: '🌾 Grãos',      qtd: 0.6,  eco: 2.80,  medio: 4.50,  premium: 6.90  },
    // ── Óleos & Condimentos ────────────────────────────────────
    { nome: 'Óleo de soja (900ml)',     categ: '🫙 Óleos',      qtd: 0.9,  eco: 5.90,  medio: 7.80,  premium: 10.50 },
    { nome: 'Sal refinado (1kg)',       categ: '🫙 Óleos',      qtd: 0.3,  eco: 1.80,  medio: 2.50,  premium: 3.90  },
    { nome: 'Extrato de tomate',        categ: '🫙 Óleos',      qtd: 0.5,  eco: 2.50,  medio: 3.80,  premium: 5.20  },
    // ── Bebidas ────────────────────────────────────────────────
    { nome: 'Café torrado (500g)',      categ: '☕ Bebidas',    qtd: 0.3,  eco: 16.90, medio: 28.00, premium: 38.90 },
    // ── Laticínios ─────────────────────────────────────────────
    { nome: 'Leite UHT integral (1L)',  categ: '🥛 Laticínios', qtd: 6.0,  eco: 3.40,  medio: 4.20,  premium: 5.80  },
    { nome: 'Manteiga (200g)',          categ: '🥛 Laticínios', qtd: 0.2,  eco: 7.90,  medio: 12.50, premium: 18.90 },
    { nome: 'Queijo mussarela (kg)',    categ: '🥛 Laticínios', qtd: 0.3,  eco: 28.90, medio: 38.90, premium: 52.00 },
    // ── Proteínas ──────────────────────────────────────────────
    { nome: 'Frango inteiro (kg)',      categ: '🥩 Proteínas',  qtd: 1.8,  eco: 8.90,  medio: 11.50, premium: 15.90 },
    { nome: 'Carne bovina (kg)',        categ: '🥩 Proteínas',  qtd: 1.5,  eco: 22.90, medio: 29.00, premium: 42.00 },
    { nome: 'Ovos (dúzia)',             categ: '🥩 Proteínas',  qtd: 1.5,  eco: 9.90,  medio: 12.00, premium: 16.90 },
    { nome: 'Salsicha (500g)',          categ: '🥩 Proteínas',  qtd: 0.5,  eco: 5.90,  medio: 8.90,  premium: 13.90 },
    // ── Hortifruti ─────────────────────────────────────────────
    { nome: 'Tomate (kg)',              categ: '🥦 Hortifruti', qtd: 1.2,  eco: 3.90,  medio: 5.50,  premium: 7.90  },
    { nome: 'Batata (kg)',              categ: '🥦 Hortifruti', qtd: 1.5,  eco: 3.50,  medio: 4.80,  premium: 6.50  },
    { nome: 'Banana (kg)',              categ: '🥦 Hortifruti', qtd: 1.5,  eco: 2.80,  medio: 3.50,  premium: 5.00  },
    { nome: 'Cebola (kg)',              categ: '🥦 Hortifruti', qtd: 0.8,  eco: 3.20,  medio: 4.50,  premium: 6.00  },
    // ── Limpeza ────────────────────────────────────────────────
    { nome: 'Detergente líquido',       categ: '🧹 Limpeza',   qtd: 0.5,  eco: 1.90,  medio: 2.80,  premium: 4.50  },
    { nome: 'Sabão em pó (1kg)',        categ: '🧹 Limpeza',   qtd: 0.8,  eco: 8.90,  medio: 12.00, premium: 18.90 },
    { nome: 'Água sanitária (1L)',      categ: '🧹 Limpeza',   qtd: 0.5,  eco: 2.90,  medio: 4.50,  premium: 6.50  },
    { nome: 'Desinfetante (500ml)',     categ: '🧹 Limpeza',   qtd: 0.5,  eco: 3.20,  medio: 5.00,  premium: 7.90  },
    { nome: 'Esponja de cozinha',       categ: '🧹 Limpeza',   qtd: 0.5,  eco: 1.50,  medio: 2.50,  premium: 4.00  },
    // ── Higiene ────────────────────────────────────────────────
    { nome: 'Sabonete (un)',            categ: '🧴 Higiene',   qtd: 1.0,  eco: 1.80,  medio: 2.50,  premium: 4.90  },
    { nome: 'Creme dental (un)',        categ: '🧴 Higiene',   qtd: 0.5,  eco: 3.50,  medio: 4.80,  premium: 8.90  },
    { nome: 'Shampoo (350ml)',          categ: '🧴 Higiene',   qtd: 0.3,  eco: 5.90,  medio: 9.00,  premium: 18.90 },
    { nome: 'Papel higiênico (4un)',    categ: '🧴 Higiene',   qtd: 0.5,  eco: 5.90,  medio: 8.90,  premium: 14.90 },
    { nome: 'Desodorante (un)',         categ: '🧴 Higiene',   qtd: 0.5,  eco: 6.90,  medio: 11.90, premium: 22.90 },
  ];

  const PERFIS = {
    eco:     { id: 'eco',     label: 'Econômico', emoji: '💚', cor: '#10b981', desc: 'Marca própria · granel · segunda linha' },
    medio:   { id: 'medio',   label: 'Médio',     emoji: '🔵', cor: '#3b82f6', desc: 'Tio João · Italac · Kicaldo · Soya'    },
    premium: { id: 'premium', label: 'Premium',   emoji: '👑', cor: '#f59e0b', desc: 'Camil · Nestlé · Friboi · Etti'        },
  };

  const FAMILIAS = [
    { pessoas: 2, emoji: '👫',    label: '2 pessoas', cor: '#3b82f6' },
    { pessoas: 4, emoji: '👨‍👩‍👧‍👦', label: '4 pessoas', cor: '#00e676' },
    { pessoas: 5, emoji: '👨‍👩‍👧‍👧', label: '5 pessoas', cor: '#f97316' },
  ];

  /**
   * Calcula custo mensal da cesta para N pessoas
   * @param {number} pessoas
   * @param {'eco'|'medio'|'premium'} perfil
   * @param {number} multMercado - multiplicador do mercado escolhido
   * @param {number} ajusteRegional - ajuste IPCA do estado
   */
  function calcular(pessoas, perfil, multMercado, ajusteRegional = 1.0) {
    const base = ITENS.reduce((s, item) => s + item.qtd * item[perfil], 0);
    return base * pessoas * multMercado * ajusteRegional;
  }

  /**
   * Agrupa itens por categoria para exibição
   */
  function itensPorCategoria() {
    return ITENS.reduce((acc, item) => {
      if (!acc[item.categ]) acc[item.categ] = [];
      acc[item.categ].push(item);
      return acc;
    }, {});
  }

  return { ITENS, PERFIS, FAMILIAS, calcular, itensPorCategoria };
})();

window.CestaData = CestaData;
