// ════════════════════════════════════════════════════════════════
// NOTAFÁCIL — script.js
// Substitua o valor abaixo pela URL do seu Apps Script
// ════════════════════════════════════════════════════════════════

const API = "https://script.google.com/macros/s/AKfycbywxAftJ711lOTeagCSyIpzVKK0394m4F4VmzmXEzmvXHgdpKj55ZAj7_Ucz4jrIpc-kQ/exec";

// ── ESTADO ─────────────────────────────────────────────────────
let chartInst  = null;
let camStream  = null;
let jsQrLoaded = false;

// ── NAVEGAÇÃO ──────────────────────────────────────────────────
function navTo(s) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const map = { home: 's-home', scan: 's-scan', hist: 's-hist', detalhe: 's-detalhe' };
  const screen = document.getElementById(map[s]);
  if (screen) screen.classList.add('active');

  if (s !== 'scan') stopCam();
  if (s === 'home')    renderHome();
  if (s === 'hist')    renderHistFull();

  // Scroll pro topo sempre que trocar de tela
  window.scrollTo(0, 0);
}

// ── STORAGE ────────────────────────────────────────────────────
function lerDados() {
  try {
    return JSON.parse(localStorage.getItem('nfce_notas') || '[]');
  } catch(e) {
    return [];
  }
}

function salvarDados(lista) {
  localStorage.setItem('nfce_notas', JSON.stringify(lista));
}

// ── CÁLCULOS ───────────────────────────────────────────────────
function calcTotais() {
  const notas = lerDados();
  let ess = 0, comp = 0, sup = 0;

  notas.forEach(n => {
    ess  += Number(n.essencial     || 0);
    comp += Number(n.complementar  || 0);
    sup  += Number(n.superfluo     || 0);
  });

  const total  = ess + comp + sup;
  const pctSup = total > 0 ? (sup / total) * 100 : 0;
  const score  = Math.max(0, Math.round(100 - pctSup * 1.5));

  return { ess, comp, sup, total, score, notas };
}

// ── FORMATADORES ───────────────────────────────────────────────
function fmt(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtShort(v) {
  v = Number(v || 0);
  if (v >= 1000) return 'R$' + (v / 1000).toFixed(1) + 'k';
  return 'R$' + v.toFixed(0);
}

// ── RENDER: HOME ───────────────────────────────────────────────
function renderHome() {
  const d = calcTotais();

  // Hero
  document.getElementById('h-total').textContent = fmt(d.total);
  document.getElementById('h-notas').textContent =
    d.notas.length + (d.notas.length === 1 ? ' nota registrada' : ' notas registradas');
  document.getElementById('h-ess').textContent  = 'Ess. '  + fmtShort(d.ess);
  document.getElementById('h-comp').textContent = 'Comp. ' + fmtShort(d.comp);
  document.getElementById('h-sup').textContent  = 'Sup. '  + fmtShort(d.sup);

  // Score
  const sc = d.score;
  const scoreEl = document.getElementById('h-score');
  scoreEl.textContent = sc;
  scoreEl.style.color = sc > 70 ? 'var(--green)' : sc > 40 ? 'var(--yellow)' : 'var(--red)';
  document.getElementById('score-fill').style.width = sc + '%';

  // Mini cards
  document.getElementById('mc-ess').textContent  = fmtShort(d.ess);
  document.getElementById('mc-comp').textContent = fmtShort(d.comp);
  document.getElementById('mc-sup').textContent  = fmtShort(d.sup);

  renderDonut(d.ess, d.comp, d.sup);
  renderHistList(d.notas.slice(-5).reverse());
}

// ── RENDER: DONUT CHART ────────────────────────────────────────
function renderDonut(ess, comp, sup) {
  const ctx   = document.getElementById('donutChart').getContext('2d');
  const total = ess + comp + sup;
  const data  = total > 0 ? [ess, comp, sup] : [1, 1, 1];
  const cores  = total > 0
    ? ['#00e676', '#ffd600', '#ff5252']
    : ['#1a1f2e', '#1a1f2e', '#1a1f2e'];

  if (chartInst) chartInst.destroy();

  chartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Essencial', 'Complementar', 'Supérfluo'],
      datasets: [{
        data,
        backgroundColor: cores,
        borderWidth: 2,
        borderColor: '#07080f',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt(ctx.raw) +
              (total > 0 ? ' (' + ((ctx.raw / total) * 100).toFixed(1) + '%)' : '')
          }
        }
      }
    }
  });
}

// ── RENDER: HISTÓRICO (HOME) ───────────────────────────────────
const ICONS = ['🛒', '🏪', '🛍', '🧺', '🏬', '🍳', '🥩', '🥦'];

function badgeInfo(nota) {
  const total = Number(nota.essencial||0) + Number(nota.complementar||0) + Number(nota.superfluo||0);
  const pct   = total > 0 ? (Number(nota.superfluo||0) / total) * 100 : 0;
  if (pct < 15) return ['badge-e', 'Econômico'];
  if (pct < 30) return ['badge-c', 'Moderado'];
  return ['badge-s', 'Supérfluo'];
}

function renderHistList(notas) {
  const el = document.getElementById('hist-list');
  if (!notas.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma nota ainda.<br>Toque em Escanear para começar.</div>';
    return;
  }

  const allNotas = lerDados();
  el.innerHTML = notas.map((n, i) => {
    const total  = Number(n.essencial||0) + Number(n.complementar||0) + Number(n.superfluo||0);
    const [cls, label] = badgeInfo(n);
    const realIdx = allNotas.length - 1 - i;
    return itemHTML(n, total, cls, label, realIdx, i);
  }).join('');
}

function renderHistFull() {
  const notas = lerDados().slice().reverse();
  const el    = document.getElementById('hist-full');

  if (!notas.length) {
    el.innerHTML = '<div class="empty-state" style="padding-top:48px">Nenhuma nota registrada ainda.</div>';
    return;
  }

  const allLen = notas.length;
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding:8px 16px 0">' +
    notas.map((n, i) => {
      const total  = Number(n.essencial||0) + Number(n.complementar||0) + Number(n.superfluo||0);
      const [cls, label] = badgeInfo(n);
      const realIdx = allLen - 1 - i;
      return itemHTML(n, total, cls, label, realIdx, i);
    }).join('') + '</div>';
}

function itemHTML(n, total, cls, label, idx, i) {
  const data  = n.data ? new Date(n.data).toLocaleDateString('pt-BR') : '--';
  const itens = n.itens ? ' · ' + n.itens + ' itens' : '';
  return `<div class="hist-item" onclick="verDetalhe(${idx})">
    <div class="hist-icon">${ICONS[i % ICONS.length]}</div>
    <div class="hist-info">
      <div class="hist-name">${esc(n.emitente || 'Mercado')}</div>
      <div class="hist-date">${data}${itens}</div>
    </div>
    <div class="hist-right">
      <div class="hist-val">${fmt(total)}</div>
      <span class="hist-badge ${cls}">${label}</span>
    </div>
  </div>`;
}

// ── RENDER: DETALHE ────────────────────────────────────────────
function verDetalhe(idx) {
  const notas = lerDados();
  const n = notas[idx];
  if (!n) return;

  const total = Number(n.essencial||0) + Number(n.complementar||0) + Number(n.superfluo||0);
  const data  = n.data ? new Date(n.data).toLocaleString('pt-BR') : '--';
  const [cls, label] = badgeInfo(n);

  let itensHTML = '<div class="empty-state">Itens não disponíveis nesta nota.</div>';
  if (n.produtos && n.produtos.length) {
    itensHTML = '<div class="section-title" style="padding-left:0;margin-bottom:8px">Itens</div><div class="itens-card">' +
      n.produtos.map(p => {
        const catCls = p.grupo === 'Essencial' ? 'badge-e' : p.grupo === 'Superfluo' ? 'badge-s' : 'badge-c';
        return `<div class="item-row">
          <div class="item-left">
            <div class="item-desc">${esc(p.descricao)}</div>
            <span class="item-cat ${catCls}">${esc(p.categoria || p.grupo || '')}</span>
          </div>
          <div class="item-val">${fmt(p.valorTotal)}</div>
        </div>`;
      }).join('') + '</div>';
  }

  document.getElementById('detalhe-content').innerHTML = `
    <div style="padding:16px 16px 0">
      <button class="back-btn" onclick="navTo('hist')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15,18 9,12 15,6"/></svg>
        Histórico
      </button>
      <div class="detalhe-header">
        <div class="detalhe-loja">${esc(n.emitente || 'Mercado')}</div>
        <div class="detalhe-data">${data}</div>
        <div class="detalhe-total">${fmt(total)}</div>
        <span class="hist-badge ${cls}" style="margin-top:8px;display:inline-block">${label}</span>
      </div>
      <div class="resumo-card">
        <div class="resumo-row">
          <span class="resumo-lbl">🟢 Essencial</span>
          <span class="resumo-val" style="color:var(--green)">${fmt(n.essencial)}</span>
        </div>
        <div class="resumo-row">
          <span class="resumo-lbl">🟡 Complementar</span>
          <span class="resumo-val" style="color:var(--yellow)">${fmt(n.complementar)}</span>
        </div>
        <div class="resumo-row">
          <span class="resumo-lbl">🔴 Supérfluo</span>
          <span class="resumo-val" style="color:var(--red)">${fmt(n.superfluo)}</span>
        </div>
      </div>
      ${itensHTML}
    </div>`;

  navTo('detalhe');
}

// ── SCAN: CÂMERA ───────────────────────────────────────────────
async function toggleCam() {
  if (camStream) { stopCam(); return; }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('❌ Câmera não disponível. Use HTTPS ou cole a URL manualmente.');
    return;
  }

  try {
    setStatus('Solicitando acesso à câmera...');
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    const video = document.getElementById('scan-video');
    video.srcObject = camStream;
    await video.play();
    video.style.display = 'block';
    document.getElementById('scan-icon').style.display  = 'none';
    document.getElementById('scan-line').style.display  = 'block';
    document.getElementById('btn-cam').textContent = 'Fechar câmera';
    setStatus('Aponte para o QR Code da NFC-e...');

    if (!jsQrLoaded) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js');
      jsQrLoaded = true;
    }
    scanLoop(video);

  } catch(e) {
    camStream = null;
    setStatus('❌ Permissão negada. Cole a URL da nota manualmente.');
  }
}

function stopCam() {
  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
  const video = document.getElementById('scan-video');
  if (!video) return;
  video.style.display = 'none';
  video.srcObject = null;
  const icon = document.getElementById('scan-icon');
  const line = document.getElementById('scan-line');
  const btn  = document.getElementById('btn-cam');
  if (icon) icon.style.display = 'block';
  if (line) line.style.display = 'none';
  if (btn)  btn.textContent = 'Abrir câmera';
}

function scanLoop(video) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');

  const tick = () => {
    if (!camStream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      if (window.jsQR) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imageData.data, canvas.width, canvas.height);
        if (code && code.data && (code.data.includes('nfce') || code.data.includes('sefaz') || code.data.includes('fazenda'))) {
          stopCam();
          document.getElementById('url-input').value = code.data;
          setStatus('✅ QR Code lido! Processando...');
          processarManual();
          return;
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── PROCESSAR URL MANUAL ───────────────────────────────────────
async function processarManual() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) {
    setStatus('⚠️ Cole a URL da NFC-e primeiro.');
    return;
  }
  if (!url.startsWith('http')) {
    setStatus('⚠️ URL inválida. Deve começar com https://');
    return;
  }

  setStatus('⏳ Enviando para o servidor...');
  document.querySelector('.btn-secondary').disabled = true;

  try {
    const res  = await fetch(API + '?url=' + encodeURIComponent(url));
    const data = await res.json();

    if (data.status === 'duplicado') {
      setStatus('⚠️ Nota já registrada anteriormente!');
      return;
    }
    if (data.status === 'erro') {
      setStatus('❌ Erro: ' + (data.mensagem || 'Falha no servidor'));
      return;
    }

    salvarLocal(data);
    document.getElementById('url-input').value = '';
    setStatus('✅ Nota salva! ' + (data.dados?.itens || 0) + ' itens registrados.');

  } catch(e) {
    setStatus('❌ Falha na conexão. Verifique sua internet.');
  } finally {
    document.querySelector('.btn-secondary').disabled = false;
  }
}

function salvarLocal(data) {
  const notas = lerDados();
  const d = data.dados || data || {};
  notas.push({
    data:          new Date().toISOString(),
    emitente:      d.emitente     || 'Mercado',
    itens:         d.itens        || 0,
    essencial:     d.essencial    || 0,
    complementar:  d.complementar || 0,
    superfluo:     d.superfluo    || 0,
    produtos:      d.produtos     || []
  });
  salvarDados(notas);
}

function setStatus(msg) {
  const el = document.getElementById('scan-status');
  if (el) el.textContent = msg;
}

// ── HELPERS ────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  renderHome();
});
