// ============================================================
// NotaFácil — Apps Script v5
// 3 grupos: Essenciais, Complementares, Supérfluos
// Alertas inteligentes + detalhes por mês
// ============================================================

const CONFIG = {
  PLANILHA_ID: '1xb-lq6R1TLBtkXcD72dwcYJNQpTUNhvjEvC0IYaKxKQ',
  ABA_NOTAS:   '1_NOTAS',
  ABA_ITENS:   '2_ITENS',
  ABA_LOG:     'LOG',
};

// ── GRUPOS ────────────────────────────────────────────────────
const GRUPOS = {
  'Essencial': {
    cor: '#22c55e',
    categorias: {
      'Hortifruti':       ['banana','maca','laranja','uva','tomate','alface','cebola','alho','batata','cenoura','brocolis','abobrinha','pepino','limao','mamao','abacaxi','melancia','melao','manga','morango','pera','uva','kiwi','couve','espinafre','repolho','beterraba','inhame','mandioca','aipim','chuchu','vagem','ervilha','milho verde','pimentao','berinjela','jiló','quiabo','acelga','rucula'],
      'Açougue':          ['carne','frango','bovina','suina','peixe','file','costela','picanha','alcatra','patinho','contrafile','linguica','salsicha','presunto','bacon','atum','sardinha','tilapia','salmao','camarao','fraldinha','maminha','acem','paleta','pernil','lombo','peito frango','coxa','sobrecoxa','musculo','mocoto','bucho','figado','coracao'],
      'Laticínios':       ['leite','queijo','iogurte','manteiga','creme de leite','requeijao','nata','margarina','ovo','ovos','mussarela','prato','coalho','ricota','cottage'],
      'Mercearia Básica': ['arroz','feijao','oleo','sal','acucar','fuba','farinha','tapioca','macarrao','macarro','espaguete','fideo','lentilha','grao de bico','canjica','farinha de mandioca','flocao'],
      'Água':             ['agua mineral','agua com gas','agua s/gas','gelo'],
    }
  },
  'Complementar': {
    cor: '#f59e0b',
    categorias: {
      'Padaria':          ['pao','bolo','torta','croissant','brioche','baguete','panetone','waffle','panqueca','bisnaguinha','pao de forma','pao frances','cuca'],
      'Congelados':       ['pizza','nugget','lasanha','hamburguer','empanado','congelado','steak','batata frita','pao de queijo congelado','salgado congelado'],
      'Enlatados':        ['lata','conserva','palmito','milho lata','ervilha lata','azeitona','extrato de tomate','molho de tomate','creme de coco','leite de coco','cogumelo'],
      'Temperos e Molhos':['ketchup','mostarda','maionese','molho shoyu','molho inglês','vinagre','azeite','tempero','oregano','pimenta','curry','colorau','cominho','louro','canela','cravo','noz moscada','caldo knorr','sazon'],
      'Bebidas':          ['suco','néctar','cha','cafe','achocolatado','leite condensado','creme','capuccino','nescau','toddy'],
      'Saudáveis':        ['integral','organico','sem gluten','proteina','whey','granola','aveia','quinoa','chia','linhaça','amaranto','castanha','amendoim','pasta de amendoim','mel','geleia'],
    }
  },
  'Supérfluo': {
    cor: '#ef4444',
    categorias: {
      'Doces':            ['chocolate','bala','chiclete','sorvete','gelatina','pudim','brigadeiro','docinho','pirulito','marshmallow','wafer','flocos','bombom','trufa','kit kat','bis','diamante negro','lacta','nestle'],
      'Snacks':           ['salgadinho','chips','batata chips','ruffles','doritos','cheetos','forno de minas','pipoca','amendoim torrado','castanha de caju','nozes'],
      'Refrigerantes':    ['refrigerante','coca cola','pepsi','guarana','fanta','sprite','schweppes','tonica','ginger','soda'],
      'Energéticos':      ['energetico','red bull','monster','burn','fusion','shark','TNT'],
      'Bebidas Alcoólicas':['cerveja','vinho','vodka','whisky','cachaca','rum','gin','espumante','chopp','long neck','skol','brahma','antartica','heineken','corona'],
    }
  }
};

// Retorna { categoria, grupo }
function classificarProduto(descricao) {
  const desc = descricao.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [grupo, info] of Object.entries(GRUPOS)) {
    for (const [categoria, palavras] of Object.entries(info.categorias)) {
      if (palavras.some(p => desc.includes(p))) {
        return { categoria, grupo };
      }
    }
  }
  return { categoria: 'Outros', grupo: 'Complementar' };
}

// ── MENU ────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧾 NotaFácil')
    .addItem('Consultar nota selecionada', 'consultarNotaSelecionada')
    .addItem('Consultar todas pendentes',  'consultarTodasPendentes')
    .addSeparator()
    .addItem('Criar estrutura das abas',   'criarEstrutura')
    .addItem('Limpar log',                 'limparLog')
    .addToUi();
}

// ── WEB APP ──────────────────────────────────────────────────
function doGet(e) {
  try {
    const acao = (e.parameter.acao || 'salvar').toString().trim();
    if (acao === 'relatorio') return getRelatorio(e);
    if (acao === 'historico') return getHistorico(e);
    if (acao === 'insights')  return getInsights(e);
    if (acao === 'detalhe')   return getDetalheMes(e);

    // salvar nota
    const url = (e.parameter.url || '').toString().trim();
    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const log   = ss.getSheetByName(CONFIG.ABA_LOG);
    log.appendRow([new Date(), 'GET', 'URL recebida', url]);

    if (!url || url.length < 10) return jsonOut({ status: 'erro', mensagem: 'URL vazia' });

    // Verificar duplicata
    const chave = extrairChave(url);
    const dados = notas.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][0] && extrairChave(dados[i][0].toString()) === chave) {
        return jsonOut({ status: 'duplicado', mensagem: 'Nota já registrada' });
      }
    }

    const linha = notas.getLastRow() + 1;
    notas.getRange(linha, 1).setValue(url);
    const resultado = processarURL(url, linha);
    return jsonOut({ status: 'ok', mensagem: 'Nota salva!', dados: resultado });

  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

function doPost(e) { return doGet(e); }

// ── RELATÓRIO ─────────────────────────────────────────────────
function getRelatorio(e) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const itens = ss.getSheetByName(CONFIG.ABA_ITENS);
    const dadosNotas = notas.getDataRange().getValues();
    const dadosItens = itens.getDataRange().getValues();

    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;

    // Mapa chave → data da nota
    const mapaData = {};
    for (let i = 1; i < dadosNotas.length; i++) {
      if (!dadosNotas[i][0]) continue;
      const ch = extrairChave(dadosNotas[i][0].toString());
      mapaData[ch] = dadosNotas[i][1];
    }

    // Agrupa notas por mês
    const meses = {};
    for (let i = 1; i < dadosNotas.length; i++) {
      const row = dadosNotas[i];
      if (!row[1]) continue;
      const data = new Date(row[1]);
      if (isNaN(data)) continue;
      const chave = `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}`;
      if (!meses[chave]) meses[chave] = { total: 0, notas: 0 };
      meses[chave].total += parseFloat(row[5]) || 0;
      meses[chave].notas++;
    }

    // Grupos do mês atual
    const grupos = { Essencial: 0, Complementar: 0, 'Supérfluo': 0 };

    for (let i = 1; i < dadosItens.length; i++) {
      const row = dadosItens[i];
      if (!row[0]) continue;
      const ch = row[0].toString();
      const dataNota = mapaData[ch] ? new Date(mapaData[ch]) : null;
      if (!dataNota || isNaN(dataNota)) continue;
      const mesItem = `${dataNota.getFullYear()}-${String(dataNota.getMonth()+1).padStart(2,'0')}`;
      if (mesItem !== mesAtual) continue;

      const grupo = row[4] || classificarProduto(row[2] || '').grupo;
      const val = parseFloat(row[7]) || 0;
      if (grupos[grupo] !== undefined) grupos[grupo] += val;
      else grupos['Complementar'] += val;
    }

    return jsonOut({
      status: 'ok',
      mesAtual,
      totalMesAtual: meses[mesAtual] ? meses[mesAtual].total : 0,
      notasMesAtual: meses[mesAtual] ? meses[mesAtual].notas : 0,
      historico: meses,
      grupos,
    });
  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

// ── DETALHE DO MÊS ───────────────────────────────────────────
function getDetalheMes(e) {
  try {
    const mes = (e.parameter.mes || '').toString().trim(); // ex: 2026-04
    if (!mes) return jsonOut({ status: 'erro', mensagem: 'Mês não informado' });

    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const itens = ss.getSheetByName(CONFIG.ABA_ITENS);
    const dadosNotas = notas.getDataRange().getValues();
    const dadosItens = itens.getDataRange().getValues();

    // Mapa chave → data
    const mapaData = {};
    for (let i = 1; i < dadosNotas.length; i++) {
      if (!dadosNotas[i][0]) continue;
      const ch = extrairChave(dadosNotas[i][0].toString());
      mapaData[ch] = dadosNotas[i][1];
    }

    // Agrupa por grupo → categoria → total
    const resultado = {
      Essencial:     { total: 0, categorias: {} },
      Complementar:  { total: 0, categorias: {} },
      'Supérfluo':   { total: 0, categorias: {} },
    };

    for (let i = 1; i < dadosItens.length; i++) {
      const row = dadosItens[i];
      if (!row[0]) continue;
      const ch = row[0].toString();
      const dataNota = mapaData[ch] ? new Date(mapaData[ch]) : null;
      if (!dataNota || isNaN(dataNota)) continue;
      const mesItem = `${dataNota.getFullYear()}-${String(dataNota.getMonth()+1).padStart(2,'0')}`;
      if (mesItem !== mes) continue;

      const classif = classificarProduto(row[2] || '');
      const grupo = row[4] || classif.grupo;
      const cat   = row[3] || classif.categoria;
      const val   = parseFloat(row[7]) || 0;

      if (!resultado[grupo]) resultado['Complementar'].total += val;
      else {
        resultado[grupo].total += val;
        resultado[grupo].categorias[cat] = (resultado[grupo].categorias[cat] || 0) + val;
      }
    }

    return jsonOut({ status: 'ok', mes, grupos: resultado });
  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

// ── HISTÓRICO ────────────────────────────────────────────────
function getHistorico(e) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const itens = ss.getSheetByName(CONFIG.ABA_ITENS);
    const dadosNotas = notas.getDataRange().getValues();
    const dadosItens = itens.getDataRange().getValues();

    const resultado = [];
    for (let i = dadosNotas.length - 1; i >= 1; i--) {
      const row = dadosNotas[i];
      if (!row[0]) continue;
      const chave = extrairChave(row[0].toString());

      const itensDaNota = [];
      for (let j = 1; j < dadosItens.length; j++) {
        if (dadosItens[j][0] === chave) {
          const classif = classificarProduto(dadosItens[j][2] || '');
          itensDaNota.push({
            descricao:  dadosItens[j][2],
            categoria:  dadosItens[j][3] || classif.categoria,
            grupo:      dadosItens[j][4] || classif.grupo,
            qtd:        dadosItens[j][5],
            valorUnit:  dadosItens[j][6],
            valorTotal: dadosItens[j][7],
          });
        }
      }

      resultado.push({
        chave, data: row[1], cnpj: row[2],
        emitente: row[3], uf: row[4], total: row[5], status: row[6],
        itens: itensDaNota,
      });
      if (resultado.length >= 30) break;
    }

    return jsonOut({ status: 'ok', notas: resultado });
  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

// ── INSIGHTS ─────────────────────────────────────────────────
function getInsights(e) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const itens = ss.getSheetByName(CONFIG.ABA_ITENS);
    const dadosNotas = notas.getDataRange().getValues();
    const dadosItens = itens.getDataRange().getValues();

    const agora = new Date();
    const mesAtual   = agora.getMonth();
    const anoAtual   = agora.getFullYear();
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

    const mapaData = {};
    for (let i = 1; i < dadosNotas.length; i++) {
      if (!dadosNotas[i][0]) continue;
      const ch = extrairChave(dadosNotas[i][0].toString());
      mapaData[ch] = dadosNotas[i][1];
    }

    const grupoAtual    = { Essencial: 0, Complementar: 0, 'Supérfluo': 0 };
    const grupoAnterior = { Essencial: 0, Complementar: 0, 'Supérfluo': 0 };
    const catAtual    = {};
    const catAnterior = {};

    for (let i = 1; i < dadosItens.length; i++) {
      const row = dadosItens[i];
      if (!row[0]) continue;
      const ch = row[0].toString();
      const dataNota = mapaData[ch] ? new Date(mapaData[ch]) : null;
      if (!dataNota || isNaN(dataNota)) continue;

      const classif = classificarProduto(row[2] || '');
      const grupo = row[4] || classif.grupo;
      const cat   = row[3] || classif.categoria;
      const val   = parseFloat(row[7]) || 0;

      if (dataNota.getMonth() === mesAtual && dataNota.getFullYear() === anoAtual) {
        if (grupoAtual[grupo] !== undefined) grupoAtual[grupo] += val;
        catAtual[cat] = (catAtual[cat] || 0) + val;
      } else if (dataNota.getMonth() === mesAnterior && dataNota.getFullYear() === anoAnterior) {
        if (grupoAnterior[grupo] !== undefined) grupoAnterior[grupo] += val;
        catAnterior[cat] = (catAnterior[cat] || 0) + val;
      }
    }

    const insights = [];
    const totalAtual = Object.values(grupoAtual).reduce((a,b) => a+b, 0);

    // Alerta supérfluos
    if (totalAtual > 0) {
      const pctSuperfluo = (grupoAtual['Supérfluo'] / totalAtual) * 100;
      if (pctSuperfluo >= 25) {
        insights.push({
          tipo: 'alerta',
          icone: '🚨',
          mensagem: `Atenção! ${pctSuperfluo.toFixed(0)}% dos seus gastos este mês são com itens supérfluos — R$ ${grupoAtual['Supérfluo'].toFixed(2).replace('.',',')}`,
        });
      } else if (pctSuperfluo >= 15) {
        insights.push({
          tipo: 'alerta',
          icone: '⚠️',
          mensagem: `Você gastou ${pctSuperfluo.toFixed(0)}% com supérfluos este mês. Fique de olho para não extrapolar!`,
        });
      }

      // Parabéns se supérfluos < 10%
      if (pctSuperfluo < 10 && totalAtual > 50) {
        insights.push({
          tipo: 'economia',
          icone: '🏆',
          mensagem: `Ótimo controle! Apenas ${pctSuperfluo.toFixed(0)}% dos gastos foram com itens supérfluos este mês.`,
        });
      }
    }

    // Comparação mês anterior por grupo
    for (const grupo of ['Essencial', 'Complementar', 'Supérfluo']) {
      const atual = grupoAtual[grupo];
      const anterior = grupoAnterior[grupo];
      if (anterior > 0 && atual > 0) {
        const diff = ((atual - anterior) / anterior) * 100;
        if (diff > 25) {
          insights.push({
            tipo: 'alerta',
            icone: '📈',
            mensagem: `Gastos com ${grupo === 'Supérfluo' ? 'supérfluos' : grupo.toLowerCase()} subiram ${diff.toFixed(0)}% em relação ao mês passado`,
          });
        } else if (diff < -15) {
          insights.push({
            tipo: 'economia',
            icone: '💚',
            mensagem: `Você economizou ${Math.abs(diff).toFixed(0)}% em ${grupo === 'Supérfluo' ? 'supérfluos' : grupo.toLowerCase()} comparado ao mês passado!`,
          });
        }
      }
    }

    // Maior categoria
    const maiorCat = Object.entries(catAtual).sort((a,b) => b[1]-a[1])[0];
    if (maiorCat) {
      insights.push({
        tipo: 'info',
        icone: '📊',
        mensagem: `Seu maior gasto este mês é ${maiorCat[0]}: R$ ${maiorCat[1].toFixed(2).replace('.',',')}`,
      });
    }

    if (!insights.length) {
      insights.push({
        tipo: 'info',
        icone: '📱',
        mensagem: 'Continue escaneando suas notas para ver análises do seu consumo!',
      });
    }

    return jsonOut({ status: 'ok', insights, grupoAtual, grupoAnterior, totalAtual });
  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

// ── PROCESSAR NOTA ───────────────────────────────────────────
function processarURL(url, linhaNotas) {
  const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
  const itens = ss.getSheetByName(CONFIG.ABA_ITENS);

  try {
    const urlCodificada = url.replace(/\|/g, '%7C');
    const resp = UrlFetchApp.fetch(urlCodificada, {
      muteHttpExceptions: true, followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Android 13; Mobile) AppleWebKit/537.36' }
    });
    const html = resp.getContentText('UTF-8');
    const code = resp.getResponseCode();

    if (code !== 200) {
      gravarLog(url, 'ERRO', `HTTP ${code}`);
      notas.getRange(linhaNotas, 7).setValue('❌ Erro HTTP');
      return null;
    }

    const chave = extrairChave(url);
    const cnpj  = extrairRegex(html, /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    const nomeEmitente =
      extrairRegex(html, /class="NomeEmit"[^>]*>\s*([^<]+)/, 1) ||
      extrairRegex(html, /id="u20"[^>]*>\s*([^<]+)/, 1)         ||
      extrairRegex(html, /<h2[^>]*>\s*([^<]{5,60})<\/h2>/, 1)   || '';

    const dataRaw = extrairRegex(html, /(\d{2}\/\d{2}\/\d{4}[ T]\d{2}:\d{2}(:\d{2})?)/, 1) || '';
    let dataEmissao = '';
    if (dataRaw) {
      const partes = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})[T ](\d{2}):(\d{2})/);
      if (partes) dataEmissao = new Date(`${partes[3]}-${partes[2]}-${partes[1]}T${partes[4]}:${partes[5]}:00`);
    }

    const valorTotal =
      extrairRegex(html, /class="totalNumb txtMax">([\d,\.]+)<\/span>/, 1) ||
      extrairRegex(html, /Valor Total[^R]*R\$\s*([\d,\.]+)/, 1) || '0';

    const produtos = extrairProdutos(html);
    if (!produtos.length) {
      gravarLog(url, 'ERRO', 'Nenhum produto encontrado.');
      notas.getRange(linhaNotas, 7).setValue('❌ Sem itens');
      return null;
    }

    notas.getRange(linhaNotas, 2, 1, 6).setValues([[
      dataEmissao || '', cnpj || '', nomeEmitente || '', 'SP',
      parseFloat((valorTotal||'0').replace(',','.')) || 0, '✅ OK',
    ]]);

    // Salva com categoria + grupo na coluna 4 e 5
    const linhasItens = produtos.map(p => {
      const classif = classificarProduto(p.descricao);
      return [chave, p.codigo, p.descricao, classif.categoria, classif.grupo, p.qtd, p.valorUnit, p.valorTotal, p.unidade, '', ''];
    });

    itens.getRange(itens.getLastRow()+1, 1, linhasItens.length, linhasItens[0].length).setValues(linhasItens);
    gravarLog(chave, 'OK', `${produtos.length} itens · R$ ${valorTotal}`);
    return { chave, emitente: nomeEmitente, total: valorTotal, itens: produtos.length };

  } catch(err) {
    gravarLog(url, 'EXCEÇÃO', err.message);
    notas.getRange(linhaNotas, 7).setValue('❌ Exceção');
    return null;
  }
}

// ── PARSER DE PRODUTOS ───────────────────────────────────────
function extrairProdutos(html) {
  const produtos = [];
  const blocos = html.split('class="txtTit"');
  for (let i = 1; i < blocos.length; i++) {
    const bloco = blocos[i].substring(0, 1000);
    const desc   = (bloco.match(/^>([^<]+)<\/span>/) || [])[1] || '';
    const cod    = (bloco.match(/C[oó]digo:\s*\n\s*(\d+)/) || [])[1] || '';
    const qtd    = (bloco.match(/<strong>Qtde\.:<\/strong>([\d,\.]+)/) || [])[1] || '1';
    const un     = (bloco.match(/<strong>UN:\s*<\/strong>([A-Z]+)/) || [])[1] || 'UN';
    const vUnit  = (bloco.match(/<strong>Vl\. Unit\.:<\/strong>\s*[\r\n\s]+([\d,\.]+)/) || [])[1] || '0';
    const vTotal = (bloco.match(/class="valor">([\d,\.]+)<\/span>/) || [])[1] || '0';
    if (desc.trim().length > 1) {
      produtos.push({
        descricao: desc.trim(), codigo: cod.trim(),
        qtd: parseFloat(qtd.replace(',','.')) || 1,
        unidade: un.trim(),
        valorUnit:  parseFloat(vUnit.replace(',','.')) || 0,
        valorTotal: parseFloat(vTotal.replace(',','.')) || 0,
      });
    }
  }
  return produtos;
}

// ── HELPERS ──────────────────────────────────────────────────
function extrairChave(url) {
  const m = url.match(/p=(\d{44})/);
  return m ? m[1] : url.substring(0, 44);
}
function extrairRegex(html, regex, grupo) {
  const m = html.match(regex);
  return m ? (m[grupo||0]||'').trim() : '';
}
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function gravarLog(ref, status, msg) {
  const ss  = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const log = ss.getSheetByName(CONFIG.ABA_LOG);
  if (log) log.appendRow([new Date(), ref, status, msg]);
}
function limparLog() {
  const ss  = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const log = ss.getSheetByName(CONFIG.ABA_LOG);
  if (log && log.getLastRow() > 1) log.deleteRows(2, log.getLastRow()-1);
}
function consultarNotaSelecionada() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const linha = sheet.getActiveRange().getRow();
  const url   = sheet.getRange(linha, 1).getValue().toString().trim();
  if (!url.includes('nfce.fazenda') && !url.includes('sefaz')) {
    SpreadsheetApp.getUi().alert('Cole a URL completa do QR Code na coluna A.');
    return;
  }
  processarURL(url, linha);
}
function consultarTodasPendentes() {
  const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
  const dados = notas.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < dados.length; i++) {
    const url    = dados[i][0].toString().trim();
    const status = dados[i][6].toString().trim();
    if (url.includes('nfce.fazenda') && status !== '✅ OK') {
      processarURL(url, i+1);
      Utilities.sleep(2000);
      count++;
    }
  }
  SpreadsheetApp.getUi().alert(`${count} nota(s) consultada(s).`);
}
function criarEstrutura() {
  const ss = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const abas = {
    '1_NOTAS': ['url_qrcode','data_emissao','cnpj_emitente','razao_social','uf','total_nf','status'],
    '2_ITENS': ['chave_acesso','codigo','descricao','categoria','grupo','quantidade','valor_unit','valor_total','unidade','ean','obs'],
    'LOG':     ['timestamp','referencia','status','mensagem'],
  };
  Object.entries(abas).forEach(([nome, cols]) => {
    let aba = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (aba.getLastRow() === 0) {
      const hdr = aba.getRange(1, 1, 1, cols.length);
      hdr.setValues([cols]).setFontWeight('bold').setBackground('#e8f0fe');
      aba.setFrozenRows(1);
    }
  });
  SpreadsheetApp.getUi().alert('Estrutura criada!');
}
