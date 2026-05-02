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
  const res = await fetch(API + "?acao=relatorio");
  const dados = await res.json();

  const total = Number(dados.totalMesAtual || 0);
  const grupos = dados.grupos || {};

  const essencial = Number(grupos.Essencial || 0);
  const complementar = Number(grupos.Complementar || 0);
  const superfluo = Number(grupos.Superfluo || 0);

  document.getElementById("totalMes").textContent = formatarMoeda(total);
  document.getElementById("valorEssencial").textContent = formatarMoeda(essencial);
  document.getElementById("valorComplementar").textContent = formatarMoeda(complementar);
  document.getElementById("valorSuperfluo").textContent = formatarMoeda(superfluo);

  document.getElementById("pctEssencial").textContent = calcularPercentual(essencial, total) + "% do total";
  document.getElementById("pctComplementar").textContent = calcularPercentual(complementar, total) + "% do total";
  document.getElementById("pctSuperfluo").textContent = calcularPercentual(superfluo, total) + "% do total";

  document.getElementById("score").textContent = dados.score || 0;

  const dia = new Date().getDate();
  const previsao = total > 0 ? (total / dia) * 30 : 0;
  document.getElementById("previsaoMes").textContent = formatarMoeda(previsao);
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


