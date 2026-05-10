// ════════════════════════════════════════════════════════════════
// NotaFácil — features/scan.js
// Escâner de QR Code + Processamento de URL NFC-e
//  • Câmera com fallback triplo
//  • scanLoop com guarda contra execução dupla
//  • Timeout de 30s na API com AbortController
//  • Botão identificado por ID (não por querySelector genérico)
// ════════════════════════════════════════════════════════════════

const ScanFeature = (() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbywxAftJ711lOTeagCSyIpzVKK0394m4F4VmzmXEzmvXHgdpKj55ZAj7_Ucz4jrIpc-kQ/exec';

  let _stream      = null;   // MediaStream ativo
  let _scanAtivo   = false;  // evita loop duplo

  // ── CÂMERA ───────────────────────────────────────────────────
  async function toggleCam() {
    if (_stream) { pararCam(); return; }

    _setStatus('⏳ Verificando leitor de QR Code...');

    const jsQROk = await _aguardarJsQR(8000);
    if (!jsQROk) {
      _setStatus('❌ Leitor de QR indisponível. Use "Cole a URL" abaixo.');
      return;
    }

    _setStatus('📷 Abrindo câmera...');

    const constraints = [
      { video: { facingMode: { ideal: 'environment' } } },
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
      _setStatus('❌ Câmera bloqueada. Permita o acesso nas configurações.');
      return;
    }

    const video = _getEl('scan-video');
    if (!video) return;

    video.srcObject    = _stream;
    video.style.display = 'block';
    _getEl('scan-icon')?.style && (_getEl('scan-icon').style.display = 'none');
    _getEl('scan-line')?.style && (_getEl('scan-line').style.display = 'block');
    _getEl('btn-cam')  && (_getEl('btn-cam').textContent = 'Fechar câmera');
    _setStatus('🔍 Aponte para o QR Code da NFC-e...');

    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
      setTimeout(resolve, 3000);
    });

    try { await video.play(); } catch { /* ignorado — autoplay pode falhar em alguns browsers */ }

    if (!_scanAtivo) {
      _scanAtivo = true;
      setTimeout(() => _scanLoop(video), 800);
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
      video.srcObject    = null;
      video.style.display = 'none';
    }
    _getEl('scan-icon')?.style && (_getEl('scan-icon').style.display = 'block');
    _getEl('scan-line')?.style && (_getEl('scan-line').style.display = 'none');
    const btn = _getEl('btn-cam');
    if (btn) btn.textContent = 'Abrir câmera';
  }

  function _scanLoop(video) {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');

    const tick = () => {
      // Para se câmera foi encerrada externamente
      if (!_scanAtivo || !_stream) {
        _scanAtivo = false;
        return;
      }

      if (video.readyState >= 2 && window.jsQR) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code    = window.jsQR(imgData.data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert',
        });

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

      // Lê como texto primeiro para tratar respostas não-JSON
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

      // Log para debug — mostra o que o servidor retornou
      console.log('[Scan] Resposta do servidor:', JSON.stringify(data.dados || data, null, 2));

      const notaSalva = _salvarNota(data);
      if (input) input.value = '';
      _setStatus('✅ Nota salva! Abrindo comparação...');

      // Aguarda 800ms para o usuário ler a mensagem de sucesso
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

    // Usa a data de emissão da nota fiscal quando disponível.
    // O backend pode retornar nos campos: dataEmissao, data, dhEmi, dhRecbto
    // Valida se é uma data real antes de usar.
    const dataServidor = d.dataEmissao || d.dhEmi || d.dhRecbto || d.data || null;
    const dataFinal = _parsarData(dataServidor) || new Date().toISOString();

    const nota = {
      data:            dataFinal,
      dataEscaneamento: new Date().toISOString(), // guarda também quando foi escaneado
      emitente:        d.emitente     || 'Mercado',
      itens:           Number(d.itens || 0),
      essencial:       Number(d.essencial    || 0),
      complementar:    Number(d.complementar || 0),
      superfluo:       Number(d.superfluo    || 0),
      produtos:        Array.isArray(d.produtos) ? d.produtos : [],
    };
    const ok = Storage.adicionarNota(nota);
    if (!ok) console.error('[Scan] Falha ao salvar nota no storage');
    return nota;
  }

  // ── HELPERS ──────────────────────────────────────────────────

  /**
   * Tenta converter string de data em ISO string válido.
   * Aceita formatos: ISO 8601, dd/MM/yyyy HH:mm:ss, yyyyMMddHHmmss
   * Retorna null se não conseguir parsear.
   */
  function _parsarData(str) {
    if (!str) return null;
    try {
      // Formato brasileiro: "25/12/2024 14:30:00"
      const brMatch = String(str).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (brMatch) {
        const [, d, m, y, h, mi, s] = brMatch;
        const dt = new Date(`${y}-${m}-${d}T${h}:${mi}:${s}`);
        if (!isNaN(dt.getTime())) return dt.toISOString();
      }

      // Formato NFC-e compacto: "20241225143000" (yyyyMMddHHmmss)
      const compMatch = String(str).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      if (compMatch) {
        const [, y, m, d, h, mi, s] = compMatch;
        const dt = new Date(`${y}-${m}-${d}T${h}:${mi}:${s}`);
        if (!isNaN(dt.getTime())) return dt.toISOString();
      }

      // Tenta direto (ISO 8601 e outros formatos padrão)
      const dt = new Date(str);
      if (!isNaN(dt.getTime())) return dt.toISOString();

      return null;
    } catch {
      return null;
    }
  }

  function _setStatus(msg) {
    const el = document.getElementById('scan-status');
    if (el) el.textContent = msg;
  }

  function _setBtnProcessar(disabled) {
    const btn = document.getElementById('btn-processar'); // ID específico
    if (btn) btn.disabled = disabled;
  }

  function abrirEmNovaAba() {
    const input = _getEl('url-input');
    const url   = (input?.value || '').trim();
    if (!url || !url.startsWith('http')) {
      _setStatus('⚠️ Cole uma URL válida primeiro.');
      return;
    }

    const novaJanela = window.open(url, '_blank', 'noopener');
    if (!novaJanela) {
      _setStatus('❌ O navegador bloqueou a abertura em nova aba.');
      return;
    }
    _setStatus('✅ Abrindo URL em nova aba...');
    novaJanela.focus();
  }

  function _getEl(id) {
    return document.getElementById(id);
  }

  function _aguardarJsQR(ms) {
    return new Promise(resolve => {
      if (window.jsQR)        { resolve(true);  return; }
      if (window._jsQRFailed) { resolve(false); return; }
      const inicio = Date.now();
      const check  = () => {
        if (window.jsQR)        { resolve(true);  return; }
        if (window._jsQRFailed) { resolve(false); return; }
        if (Date.now() - inicio >= ms) { resolve(false); return; }
        setTimeout(check, 100);
      };
      check();
    });
  }

  return { toggleCam, pararCam, processarURL, abrirEmNovaAba };
})();

window.ScanFeature = ScanFeature;
