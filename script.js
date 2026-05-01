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
processarNota(qrCodeMessage).then(() => {
  window.location.href = "dashboard.html";
});
