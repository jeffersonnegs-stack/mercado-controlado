const API = "https://script.google.com/macros/s/AKfycbywxAftJ711lOTeagCSyIpzVKK0394m4F4VmzmXEzmvXHgdpKj55ZAj7_Ucz4jrIpc-kQ/exec";

function enviar() {
  const url = document.getElementById("url").value;

  fetch(`${API}?url=${encodeURIComponent(url)}`)
    .then(r => r.json())
    .then(d => {
      if (d.status === "ok") {
        alert("Nota salva!");
      } else {
        alert("Erro ou duplicado");
      }
    });
}

function irDashboard() {
  window.location.href = "dashboard.html";
}

function voltar() {
  window.location.href = "index.html";
}

// DASHBOARD REAL
function carregarDashboard() {
  fetch(`${API}?acao=relatorio`)
    .then(r => r.json())
    .then(d => {
      document.getElementById("total").innerText =
        "Total: R$ " + d.totalMesAtual;

      document.getElementById("essencial").innerText =
        "Essencial: R$ " + d.grupos.Essencial;

      document.getElementById("superfluo").innerText =
        "Supérfluo: R$ " + d.grupos['Supérfluo'];
    });
}
