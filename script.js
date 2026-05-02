const API = "https://script.google.com/macros/s/AKfycbywxAftJ711lOTeagCSyIpzVKK0394m4F4VmzmXEzmvXHgdpKj55ZAj7_Ucz4jrIpc-kQ/exec";

async function processarNota(url) {
  const res = await fetch(API + "?url=" + encodeURIComponent(url), {
    method: "POST"
  });

  const data = await res.json();

  salvarDados(data);
  return data;
}

function salvarDados(dados) {
  let historico = JSON.parse(localStorage.getItem("notas")) || [];
  
  historico.push({
    data: new Date().toISOString(),
    ...dados
  });

  localStorage.setItem("notas", JSON.stringify(historico));
}

async function carregarDashboard() {
  try {
    const res = await fetch(API + "?acao=relatorio");
    const dados = await res.json();

    console.log("RELATORIO:", dados);

    if (dados.status !== "ok") {
      console.error("Erro no relatório:", dados.mensagem || dados);
      return;
    }

    const total = Number(dados.totalMesAtual || 0);
    const grupos = dados.grupos || {};

    const essencial = Number(grupos.Essencial || 0);
    const complementar = Number(grupos.Complementar || 0);
    const superfluo = Number(grupos.Superfluo || 0);

    atualizarTexto("totalMes", formatarMoeda(total));

    atualizarTexto("valorEssencial", formatarMoeda(essencial));
    atualizarTexto("valorComplementar", formatarMoeda(complementar));
    atualizarTexto("valorSuperfluo", formatarMoeda(superfluo));

    atualizarTexto("pctEssencial", calcularPercentual(essencial, total) + "% do total");
    atualizarTexto("pctComplementar", calcularPercentual(complementar, total) + "% do total");
    atualizarTexto("pctSuperfluo", calcularPercentual(superfluo, total) + "% do total");

    atualizarTexto("score", dados.score || 0);

    const dia = new Date().getDate();
    const previsao = total > 0 ? (total / dia) * 30 : 0;
    atualizarTexto("previsaoMes", formatarMoeda(previsao));

  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
  }
}

function atualizarTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = valor;
  } else {
    console.warn("Elemento não encontrado:", id);
  }
}

function calcularPercentual(valor, total) {
  if (!total) return 0;
  return Math.round((valor / total) * 100);
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

