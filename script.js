// script.js — VERSÃO CORRIGIDA
const API = "https://script.google.com/macros/s/AKfycbywxAftJ711lOTeagCSyIpzVKK0394m4F4VmzmXEzmvXHgdpKj55ZAj7_Ucz4jrIpc-kQ/exec";

async function processarNota(url) {
  try {
    const res = await fetch(API + "?url=" + encodeURIComponent(url));
    if (!res.ok) throw new Error("Erro HTTP " + res.status);
    const data = await res.json();
    if (data.status === "erro") throw new Error(data.mensagem);
    salvarDados(data.dados || data);
    return data;
  } catch (e) {
    alert("Erro ao processar nota: " + e.message);
    return null;
  }
}

function salvarDados(dados) {
  let historico = JSON.parse(localStorage.getItem("notas")) || [];
  historico.push({ data: new Date().toISOString(), ...dados });
  localStorage.setItem("notas", JSON.stringify(historico));
}

function voltar() {
  window.location.href = "index.html";
}
