// ════════════════════════════════════════════════════════════════
// NotaFácil — features/scan.js
// Escâner de QR Code + Processamento de URL NFC-e
// Otimizado para Samsung Android 12+
// ════════════════════════════════════════════════════════════════

const ScanFeature = (() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbywxAftJ711lOTeagCSyIpzVKK0394m4F4VmzmXEzmvXHgdpKj55ZAj7_Ucz4jrIpc-kQ/exec';

  let _stream    = null;
  let _scanAtivo = false;

  // ── GARANTE jsQR CARREGADO ────────────────────────────────────
  function _garantirJsQR() {
    return new Promise(resolve => {
      if (typeof window.jsQR === 'function') { resolve(true); return; }

      const cdns = [
        'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js',
      ];

      function tentarCDN(idx) {
        if (idx >= cdns.length) { resolve(false); return; }
        const s = document.createElement('script');
        s.src = cdns[idx];
        s.onload = () => {
          if (typeof window.jsQR === 'function') { resolve(true); }
          else { tentarCDN(idx + 1); }
        };
        s.onerror = () => tentarCDN(idx + 1);
        document.head.appendChild(s);
      }

      tentarCDN(0);
    });
  }

  // ── CÂMERA ───────────────────────────────────────────────────
  async function toggleCam() {
    if (_stream) { pararCam(); return; }

    _setStatus('⏳ Carregando leitor de QR Code...');
    const jsQROk = await _garantirJsQR();
    if (!jsQROk) {
      _setStatus('❌ Leitor de QR indisponível. Use "Cole a URL" abaixo.');
      return;
    }

    _setStatus('📷 Abrindo câmera...');

    // Samsung Android 12+: resolução 640x480 é mais rápida para jsQR processar
    // do que 1080p — menos dados para analisar por frame
    const tentativas = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } },
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } },
      { video: { facingMode: 'environment' } },
      { video: { facingMode: 'user' } },
      { video: true },
    ];

    for (const c of tentativas) {
      try { _stream = await navigator.mediaDevices.getUserMedia(c); break; }
      catch { _stream = null; }
    }

    if (!_stream) {
      _setStatus('❌ Câmera bloqueada. Permita nas configurações do Chrome.');
      return;
    }

    const video = _getEl('scan-video');
    if (!video) return;

    video.srcObject     = _stream;
    video.style.display = 'block';
    video.setAttribute('playsinline', true); // essencial para iOS/Samsung
    video.setAttribute('muted', true);

    const icon = _getEl('scan-icon');
    const line = _getEl('scan-line');
    const btn  = _getEl('btn-cam');
    if (icon) icon.style.display = 'none';
    if (line) line.style.display = 'block';
    if (btn)  btn.textContent    = 'Fechar câmera';

    _setStatus('🔍 Aponte para o QR Code da NFC-e...');

    // Aguarda vídeo estar realmente pronto (readyState >= 2)
    await new Promise(resolve => {
      const verificar = () => {
        if (video.readyState >= 2) { resolve(); return; }
        requestAnimationFrame(verificar);
      };
      video.onloadedmetadata = () => {
        video.play().catch(() => {}).then(verificar);
      };
      // Fallback: inicia mesmo sem evento após 4s
      setTimeout(resolve, 4000);
    });

    // Extra 1s para Samsung estabilizar autofoco
    await new Promise(r => setTimeout(r, 1000));

    if (!_scanAtivo) {
      _scanAtivo = true;
      _scanLoop(video);
    }
  }

  function pararCam() {
    _scanAtivo = false;
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    const video = _getEl('scan-video');
    if (video) { video.srcObject = null; video.style.display = 'none'; }
    const icon = _getEl('scan-icon');
    const line = _getEl('scan-line');
    const btn  = _getEl('btn-cam');
    if (icon) icon.style.display = 'block';
    if (line) line.style.display = 'none';
    if (btn)  btn.textContent    = 'Abrir câmera';
  }

  // ── SCAN LOOP ────────────────────────────────────────────────
  // Otimizações para Samsung Android 12+:
  // 1. Canvas fixo em 640x480 (downscale se câmera for maior)
  // 2. Tenta com e sem inversão de cores
  // 3. Processa todo frame (sem skip) para máxima responsividade
  function _scanLoop(video) {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d', { willReadFrequently: true });

    // Canvas fixo 640x480 — melhor performance para jsQR
    canvas.width  = 640;
    canvas.height = 480;

    const tick = () => {
      if (!_scanAtivo || !_stream) { _scanAtivo = false; return; }

      // Só processa se vídeo tem dados reais
      if (video.readyState < 2 || video.videoWidth === 0) {
        requestAnimationFrame(tick);
        return;
      }

      // Desenha frame do vídeo no canvas (faz downscale automático)
      ctx.drawImage(video, 0, 0, 640, 480);
      const imgData = ctx.getImageData(0, 0, 640, 480);

      // Tenta sem inversão primeiro (QR preto no branco)
      let code = window.jsQR(imgData.data, 640, 480, {
        inversionAttempts: 'dontInvert',
      });

      // Se não leu, tenta com inversão (QR branco no preto — raro em NFC-e)
      if (!code) {
        code = window.jsQR(imgData.data, 640, 480, {
          inversionAttempts: 'onlyInvert',
        });
      }

      if (code?.data && code.data.length > 10) {
        pararCam();
        const input = _getEl('url-input');
        if (input) input.value = code.data.trim();
        _setStatus('✅ QR Code lido! Processando...');
        processarURL();
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  // ── PROCESSAR URL ────────────────────────────────────────────
  async function processarURL() {
    const input = _getEl('url-input');
    const url   = (input?.value || '').trim();

    if (!url) { _setStatus('⚠️ Cole a URL da NFC-e primeiro.'); return; }
    if (!url.startsWith('http')) { _setStatus('⚠️ URL inválida. Deve começar com https://'); return; }

    _setStatus('⏳ Processando nota fiscal...');
    _setBtnProcessar(true);

    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      const res   = await fetch(`${API_URL}?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
      clearTimeout(timer);

      if (!res.ok) { _setStatus('❌ Erro ao acessar o servidor. Tente novamente.'); return; }

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch {
        console.error('[Scan] Resposta não-JSON:', text.slice(0, 300));
        _setStatus('❌ Resposta inválida do servidor.');
        return;
      }

      if (data.status === 'duplicado') { _setStatus('⚠️ Esta nota já foi registrada!'); return; }
      if (data.status === 'erro')      { _setStatus('❌ ' + (data.mensagem || 'Erro no servidor.')); return; }

      console.log('[Scan] Servidor retornou:', JSON.stringify(data.dados || data, null, 2));

      const notaSalva = _salvarNota(data);
      if (input) input.value = '';
      _setStatus('✅ Nota salva! Abrindo comparação...');
      setTimeout(() => App.abrirComparacao(notaSalva), 800);

    } catch (e) {
      if (e.name === 'AbortError') {
        _setStatus('❌ Servidor demorou demais. Verifique sua internet.');
      } else {
        console.error('[Scan] Erro:', e);
        _setStatus('❌ Erro: ' + e.message);
      }
    } finally {
      _setBtnProcessar(false);
    }
  }

  // ── SALVAR NOTA ───────────────────────────────────────────────
  function _salvarNota(data) {
    const d = data.dados || data || {};
    const dataFinal = _parsarData(d.dataEmissao || d.dhEmi || d.dhRecbto || d.data)
                    || new Date().toISOString();

    const nota = {
      data:             dataFinal,
      dataEscaneamento: new Date().toISOString(),
      emitente:         d.emitente     || 'Mercado',
      itens:            Number(d.itens || 0),
      essencial:        Number(d.essencial    || 0),
      complementar:     Number(d.complementar || 0),
      superfluo:        Number(d.superfluo    || 0),
      produtos:         Array.isArray(d.produtos) ? d.produtos : [],
    };

    const ok = Storage.adicionarNota(nota);
    if (!ok) console.error('[Scan] Falha ao salvar nota');
    return nota;
  }

  function _parsarData(str) {
    if (!str) return null;
    try {
      // "25/12/2024 14:30:00"
      const br = String(str).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (br) {
        const dt = new Date(`${br[3]}-${br[2]}-${br[1]}T${br[4]}:${br[5]}:${br[6]}`);
        if (!isNaN(dt.getTime())) return dt.toISOString();
      }
      // "20241225143000"
      const cp = String(str).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      if (cp) {
        const dt = new Date(`${cp[1]}-${cp[2]}-${cp[3]}T${cp[4]}:${cp[5]}:${cp[6]}`);
        if (!isNaN(dt.getTime())) return dt.toISOString();
      }
      const dt = new Date(str);
      return isNaN(dt.getTime()) ? null : dt.toISOString();
    } catch { return null; }
  }

  // ── HELPERS ──────────────────────────────────────────────────
  function _setStatus(msg) {
    const el = document.getElementById('scan-status');
    if (el) el.textContent = msg;
  }

  function _setBtnProcessar(disabled) {
    const btn = document.getElementById('btn-processar');
    if (btn) btn.disabled = disabled;
  }

  function _getEl(id) { return document.getElementById(id); }

  function abrirEmNovaAba() {
    const input = _getEl('url-input');
    const url   = (input?.value || '').trim();
    if (!url || !url.startsWith('http')) { _setStatus('⚠️ Cole uma URL válida primeiro.'); return; }
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) { _setStatus('❌ O navegador bloqueou a nova aba.'); return; }
    _setStatus('✅ Abrindo URL em nova aba...');
    w.focus();
  }

  return { toggleCam, pararCam, processarURL, abrirEmNovaAba };
})();

window.ScanFeature = ScanFeature;
