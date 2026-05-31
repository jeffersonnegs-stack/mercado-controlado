// ════════════════════════════════════════════════════════════════
// NotaFácil — features/scan.js
// Escâner de QR Code + Processamento de URL NFC-e
//  • jsQR carregado diretamente aqui (sem depender do stub)
//  • scanLoop só inicia após jsQR confirmado
//  • Câmera com fallback triplo
//  • Timeout de 30s na API com AbortController
// ════════════════════════════════════════════════════════════════

const ScanFeature = (() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbywxAftJ711lOTeagCSyIpzVKK0394m4F4VmzmXEzmvXHgdpKj55ZAj7_Ucz4jrIpc-kQ/exec';

  let _stream    = null;
  let _scanAtivo = false;
  let _jsQRPronto = false; // flag local — jsQR confirmado carregado

  // ── GARANTE jsQR CARREGADO ────────────────────────────────────
  // Tenta 3 fontes em ordem: window.jsQR já existe → CDN 1 → CDN 2
  function _garantirJsQR() {
    return new Promise(resolve => {
      // Já está disponível
      if (typeof window.jsQR === 'function') {
        _jsQRPronto = true;
        resolve(true);
        return;
      }

      let tentativas = 0;
      const cdns = [
        'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js',
      ];

      function tentarCDN(idx) {
        if (idx >= cdns.length) {
          console.error('[Scan] jsQR não disponível em nenhuma fonte');
          resolve(false);
          return;
        }

        const s = document.createElement('script');
        s.src = cdns[idx];
        s.onload = () => {
          if (typeof window.jsQR === 'function') {
            _jsQRPronto = true;
            console.log('[Scan] jsQR carregado do CDN:', cdns[idx]);
            resolve(true);
          } else {
            tentarCDN(idx + 1);
          }
        };
        s.onerror = () => {
          console.warn('[Scan] CDN falhou:', cdns[idx]);
          tentarCDN(idx + 1);
        };
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

    const constraints = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'user' } },
      { video: true },
    ];

    for (const c of constraints) {
      try {
        _stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch {
        _stream = null;
      }
    }

    if (!_stream) {
      _setStatus('❌ Câmera bloqueada. Permita o acesso nas configurações do navegador.');
      return;
    }

    const video = _getEl('scan-video');
    if (!video) return;

    video.srcObject     = _stream;
    video.style.display = 'block';

    const icon = _getEl('scan-icon');
    const line = _getEl('scan-line');
    const btn  = _getEl('btn-cam');
    if (icon) icon.style.display = 'none';
    if (line) line.style.display = 'block';
    if (btn)  btn.textContent    = 'Fechar câmera';

    _setStatus('🔍 Aponte para o QR Code da NFC-e...');

    // Aguarda vídeo pronto
    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
      setTimeout(resolve, 3000);
    });

    try { await video.play(); } catch { /* autoplay bloqueado em alguns browsers */ }

    // Inicia scan apenas se ainda não ativo
    if (!_scanAtivo) {
      _scanAtivo = true;
      // Pequeno delay para câmera estabilizar
      setTimeout(() => _scanLoop(video), 600);
    }
  }

  function pararCam() {
    _scanAtivo = false;
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    const video = _getEl('scan-video');
    if (video) {
      video.srcObject     = null;
      video.style.display = 'none';
    }
    const icon = _getEl('scan-icon');
    const line = _getEl('scan-line');
    const btn  = _getEl('btn-cam');
    if (icon) icon.style.display = 'block';
    if (line) line.style.display = 'none';
    if (btn)  btn.textContent    = 'Abrir câmera';
  }

  function _scanLoop(video) {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    let frameCount = 0;

    const tick = () => {
      // Para imediatamente se câmera foi encerrada
      if (!_scanAtivo || !_stream) {
        _scanAtivo = false;
        return;
      }

      // Processa 1 de cada 3 frames para não sobrecarregar CPU
      frameCount++;
      if (frameCount % 3 !== 0) {
        requestAnimationFrame(tick);
        return;
      }

      if (video.readyState >= 2 && typeof window.jsQR === 'function') {
        const w = video.videoWidth  || 640;
        const h = video.videoHeight || 480;

        // Só redimensiona o canvas se necessário
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width  = w;
          canvas.height = h;
        }

        ctx.drawImage(video, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);

        // Tenta primeiro sem inversão (mais rápido)
        let code = window.jsQR(imgData.data, w, h, {
          inversionAttempts: 'dontInvert',
        });

        // Se não encontrou, tenta com inversão (QR codes claros em fundo escuro)
        if (!code) {
          code = window.jsQR(imgData.data, w, h, {
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
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  // ── PROCESSAR URL ────────────────────────────────────────────
  async function processarURL() {
    const input = _getEl('url-input');
    const url   = (input?.value || '').trim();

    if (!url) {
      _setStatus('⚠️ Cole a URL da NFC-e primeiro.');
      return;
    }
    if (!url.startsWith('http')) {
      _setStatus('⚠️ URL inválida. Deve começar com https://');
      return;
    }

    _setStatus('⏳ Processando nota fiscal...');
    _setBtnProcessar(true);

    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);

      const res = await fetch(`${API_URL}?url=${encodeURIComponent(url)}`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        _setStatus('❌ Erro ao acessar o servidor. Tente novamente.');
        return;
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[Scan] Resposta não-JSON:', text.slice(0, 300));
        _setStatus('❌ Resposta inválida do servidor. Tente novamente.');
        return;
      }

      if (data.status === 'duplicado') {
        _setStatus('⚠️ Esta nota já foi registrada anteriormente!');
        return;
      }
      if (data.status === 'erro') {
        _setStatus('❌ ' + (data.mensagem || 'Erro no servidor.'));
        return;
      }

      console.log('[Scan] Resposta do servidor:', JSON.stringify(data.dados || data, null, 2));

      const notaSalva = _salvarNota(data);
      if (input) input.value = '';
      _setStatus('✅ Nota salva! Abrindo comparação...');

      setTimeout(() => App.abrirComparacao(notaSalva), 800);

    } catch (e) {
      if (e.name === 'AbortError') {
        _setStatus('❌ Servidor demorou demais. Verifique sua internet.');
      } else {
        console.error('[Scan] Erro:', e);
        _setStatus('❌ Erro de conexão: ' + e.message);
      }
    } finally {
      _setBtnProcessar(false);
    }
  }

  function _salvarNota(data) {
    const d = data.dados || data || {};
    const dataServidor = d.dataEmissao || d.dhEmi || d.dhRecbto || d.data || null;
    const dataFinal    = _parsarData(dataServidor) || new Date().toISOString();

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
      // ISO ou qualquer outro formato
      const dt = new Date(str);
      if (!isNaN(dt.getTime())) return dt.toISOString();
      return null;
    } catch { return null; }
  }

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
    if (!url || !url.startsWith('http')) {
      _setStatus('⚠️ Cole uma URL válida primeiro.');
      return;
    }
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) { _setStatus('❌ O navegador bloqueou a nova aba.'); return; }
    _setStatus('✅ Abrindo URL em nova aba...');
    w.focus();
  }

  return { toggleCam, pararCam, processarURL, abrirEmNovaAba };
})();

window.ScanFeature = ScanFeature;
