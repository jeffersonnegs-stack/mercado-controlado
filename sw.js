// ============================================================
// NotaFacil — Apps Script v6
// Performance + Score Financeiro + Previsao + Cache
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
      'Hortifruti':       ['banana','maca','laranja','uva','tomate','alface','cebola','alho','batata','cenoura','brocolis','abobrinha','pepino','limao','mamao','abacaxi','melancia','melao','manga','morango','pera','kiwi','couve','espinafre','repolho','beterraba','inhame','mandioca','aipim','chuchu','vagem','ervilha','pimentao','berinjela','quiabo','acelga','rucula','jiló'],
      'Acougue':          ['carne','frango','bovina','suina','peixe','file','costela','picanha','alcatra','patinho','contrafile','linguica','salsicha','presunto','bacon','atum','sardinha','tilapia','salmao','camarao','fraldinha','maminha','acem','paleta','pernil','lombo','coxa','sobrecoxa','musculo','mocoto','figado','coracao'],
      'Laticinios':       ['leite','queijo','iogurte','manteiga','requeijao','nata','margarina','ovo','ovos','mussarela','coalho','ricota','cottage'],
      'Mercearia Basica': ['arroz','feijao','oleo','sal','acucar','fuba','farinha','tapioca','macarrao','espaguete','fideo','lentilha','canjica','flocao'],
      'Agua':             ['agua mineral','agua com gas','agua s','gelo'],
    }
  },
  'Complementar': {
    cor: '#f59e0b',
    categorias: {
      'Padaria':          ['pao','bolo','torta','croissant','baguete','panetone','waffle','panqueca','bisnaguinha'],
      'Congelados':       ['pizza','nugget','lasanha','hamburguer','empanado','congelado','steak','batata frita'],
      'Enlatados':        ['palmito','azeitona','extrato de tomate','molho de tomate','creme de coco','leite de coco','cogumelo'],
      'Temperos':         ['ketchup','mostarda','maionese','shoyu','vinagre','azeite','tempero','oregano','pimenta','curry','colorau','cominho','louro','canela','cravo','caldo','sazon'],
      'Bebidas':          ['suco','nectar','cha','cafe','achocolatado','leite condensado','capuccino','nescau','toddy'],
      'Saudaveis':        ['integral','organico','proteina','whey','granola','aveia','quinoa','chia','linhaca','amaranto','mel','geleia'],
    }
  },
  'Superfluo': {
    cor: '#ef4444',
    categorias: {
      'Doces':            ['chocolate','bala','chiclete','sorvete','gelatina','pudim','brigadeiro','pirulito','marshmallow','wafer','bombom','trufa','bis','lacta','nestle'],
      'Snacks':           ['salgadinho','chips','ruffles','doritos','cheetos','pipoca'],
      'Refrigerantes':    ['refrigerante','coca cola','pepsi','guarana','fanta','sprite','schweppes','tonica','soda'],
      'Energeticos':      ['energetico','red bull','monster','burn','fusion','shark'],
      'Bebidas Alcoolicas':['cerveja','vinho','vodka','whisky','cachaca','rum','gin','espumante','chopp','skol','brahma','heineken','corona'],
    }
  }
};

// ── CLASSIFICACAO MELHORADA ───────────────────────────────────
function classificarProduto(descricao) {
  const desc = descricao.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const palavrasDesc = desc.split(/\s+/);

  for (const [grupo, info] of Object.entries(GRUPOS)) {
    for (const [categoria, palavras] of Object.entries(info.categorias)) {
      if (palavras.some(p => palavrasDesc.includes(p))) {
        return { categoria, grupo };
      }
    }
  }
  return { categoria: 'Outros', grupo: 'Complementar' };
}

// ── SCORE FINANCEIRO ─────────────────────────────────────────
function calcularScore(grupoAtual) {
  const total = Object.values(grupoAtual).reduce((a,b)=>a+b, 0);
  if (total === 0) return 100;
  const pctSup = (grupoAtual['Superfluo'] / total) * 100;
  const score = 100 - (pctSup * 1.5);
  return Math.max(0, Math.round(score));
}

// ── CACHE DE DUPLICIDADE ─────────────────────────────────────
function jaExisteChave(chave) {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get(chave)) return true;
  } catch(e) {}

  const ss = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
  const lastRow = notas.getLastRow();
  const dados = lastRow > 1
    ? notas.getRange(2, 1, lastRow - 1, 1).getValues()
    : [];

  for (let i = 0; i < dados.length; i++) {
    if (extrairChave(dados[i][0].toString()) === chave) {
      try { CacheService.getScriptCache().put(chave, '1', 21600); } catch(e) {}
      return true;
    }
  }
  return false;
}

// ── MENU ────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('NotaFacil')
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

    const url = (e.parameter.url || '').toString().trim();
    const ss  = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const log = ss.getSheetByName(CONFIG.ABA_LOG);
    log.appendRow([new Date(), 'GET', 'URL recebida', url]);

    if (!url || url.length < 10) return jsonOut({ status: 'erro', mensagem: 'URL vazia' });

    const chave = extrairChave(url);
    if (jaExisteChave(chave)) return jsonOut({ status: 'duplicado', mensagem: 'Nota ja registrada' });

    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const linha = notas.getLastRow() + 1;
    notas.getRange(linha, 1).setValue(url);
    const resultado = processarURL(url, linha);
    return jsonOut({ status: 'ok', mensagem: 'Nota salva!', dados: resultado });

  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

function doPost(e) { return doGet(e); }

// ── RELATORIO ────────────────────────────────────────────────
function getRelatorio(e) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const itens = ss.getSheetByName(CONFIG.ABA_ITENS);

    const lrNotas = notas.getLastRow();
    const lrItens = itens.getLastRow();
    const dadosNotas = lrNotas > 1 ? notas.getRange(2, 1, lrNotas - 1, 7).getValues() : [];
    const dadosItens = lrItens > 1 ? itens.getRange(2, 1, lrItens - 1, 9).getValues() : [];

    const agora = new Date();
    const mesAtual = agora.getFullYear() + '-' + String(agora.getMonth()+1).padStart(2,'0');

    const mapaData = {};
    for (let i = 0; i < dadosNotas.length; i++) {
      if (!dadosNotas[i][0]) continue;
      const ch = extrairChave(dadosNotas[i][0].toString());
      mapaData[ch] = dadosNotas[i][1];
    }

    const meses = {};
    for (let i = 0; i < dadosNotas.length; i++) {
      const row = dadosNotas[i];
      if (!row[1]) continue;
      const data = new Date(row[1]);
      if (isNaN(data)) continue;
      const chave = data.getFullYear() + '-' + String(data.getMonth()+1).padStart(2,'0');
      if (!meses[chave]) meses[chave] = { total: 0, notas: 0 };
      meses[chave].total += parseFloat(row[5]) || 0;
      meses[chave].notas++;
    }

    const grupos = { Essencial: 0, Complementar: 0, Superfluo: 0 };
    for (let i = 0; i < dadosItens.length; i++) {
      const row = dadosItens[i];
      if (!row[0]) continue;
      const dataNota = mapaData[row[0].toString()] ? new Date(mapaData[row[0].toString()]) : null;
      if (!dataNota || isNaN(dataNota)) continue;
      const mesItem = dataNota.getFullYear() + '-' + String(dataNota.getMonth()+1).padStart(2,'0');
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
      score: calcularScore(grupos),
    });
  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

// ── DETALHE DO MES ───────────────────────────────────────────
function getDetalheMes(e) {
  try {
    const mes = (e.parameter.mes || '').toString().trim();
    if (!mes) return jsonOut({ status: 'erro', mensagem: 'Mes nao informado' });

    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const itens = ss.getSheetByName(CONFIG.ABA_ITENS);

    const lrNotas = notas.getLastRow();
    const lrItens = itens.getLastRow();
    const dadosNotas = lrNotas > 1 ? notas.getRange(2, 1, lrNotas - 1, 7).getValues() : [];
    const dadosItens = lrItens > 1 ? itens.getRange(2, 1, lrItens - 1, 9).getValues() : [];

    const mapaData = {};
    for (let i = 0; i < dadosNotas.length; i++) {
      if (!dadosNotas[i][0]) continue;
      const ch = extrairChave(dadosNotas[i][0].toString());
      mapaData[ch] = dadosNotas[i][1];
    }

    const resultado = {
      Essencial:    { total: 0, categorias: {} },
      Complementar: { total: 0, categorias: {} },
      Superfluo:    { total: 0, categorias: {} },
    };

    for (let i = 0; i < dadosItens.length; i++) {
      const row = dadosItens[i];
      if (!row[0]) continue;
      const dataNota = mapaData[row[0].toString()] ? new Date(mapaData[row[0].toString()]) : null;
      if (!dataNota || isNaN(dataNota)) continue;
      const mesItem = dataNota.getFullYear() + '-' + String(dataNota.getMonth()+1).padStart(2,'0');
      if (mesItem !== mes) continue;

      const classif = classificarProduto(row[2] || '');
      const grupo = row[4] || classif.grupo;
      const cat   = row[3] || classif.categoria;
      const val   = parseFloat(row[7]) || 0;

      if (resultado[grupo]) {
        resultado[grupo].total += val;
        resultado[grupo].categorias[cat] = (resultado[grupo].categorias[cat] || 0) + val;
      } else {
        resultado['Complementar'].total += val;
        resultado['Complementar'].categorias[cat] = (resultado['Complementar'].categorias[cat] || 0) + val;
      }
    }

    return jsonOut({ status: 'ok', mes, grupos: resultado });
  } catch(err) {
    return jsonOut({ status: 'erro', mensagem: err.message });
  }
}

// ── HISTORICO ────────────────────────────────────────────────
function getHistorico(e) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    const notas = ss.getSheetByName(CONFIG.ABA_NOTAS);
    const itens = ss.getSheetByName(CONFIG.ABA_ITENS);

    const lrNotas = notas.getLastRow();
    const lrItens = itens.getLastRow();
    const dadosNotas = lrNotas > 1 ? notas.getRange(2, 1, lrNotas - 1, 7).getValues() : [];
    const dadosItens = lrItens > 1 ? itens.getRange(2, 1, lrItens - 1, 9).getValues() : [];

    const resultado = [];
    for (let i = dadosNotas.length - 1; i >= 0; i--) {
      const row = dadosNotas[i];
      if (!row[0]) continue;
      const chave = extrairChave(row[0].toString());
      const itensDaNota = [];
      for (let j = 0; j < dadosItens.length; j++) {
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
      resultado.push({ chave, data: row[1], cnpj: row[2], emitente: row[3], uf: row[4], total: row[5], status: row[6], itens: itensDaNota });
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

    const lrNotas = notas.getLastRow();
    const lrItens = itens.getLastRow();
    const dadosNotas = lrNotas > 1 ? notas.getRange(2, 1, lrNotas - 1, 7).getValues() : [];
    const dadosItens = lrItens > 1 ? itens.getRange(2, 1, lrItens - 1, 9).getValues() : [];

    const agora = new Date();
    const mesAtual    = agora.getMonth();
    const anoAtual    = agora.getFullYear();
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

    const mapaData = {};
    for (let i = 0; i < dadosNotas.length; i++) {
      if (!dadosNotas[i][0]) continue;
      const ch = extrairChave(dadosNotas[i][0].toString());
      mapaData[ch] = dadosNotas[i][1];
    }

    const grupoAtual    = { Essencial: 0, Complementar: 0, Superfluo: 0 };
    const grupoAnterior = { Essencial: 0, Complementar: 0, Superfluo: 0 };
    const catAtual      = {};
    const catAnterior   = {};

    for (let i = 0; i < dadosItens.length; i++) {
      const row = dadosItens[i];
      if (!row[0]) continue;
      const dataNota = mapaData[row[0].toString()] ? new Date(mapaData[row[0].toString()]) : null;
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

    // Alerta superfluo
    if (totalAtual > 0) {
      const pctSup = (grupoAtual['Superfluo'] / totalAtual) * 100;
      if (pctSup >= 25) {
        insights.push({ tipo: 'alerta', icone: '🚨', mensagem: 'Atencao! ' + pctSup.toFixed(0) + '% dos seus gastos este mes sao com itens superfluous — R$ ' + grupoAtual['Superfluo'].toFixed(2) });
      } else if (pctSup >= 15) {
        insights.push({ tipo: 'alerta', icone: '⚠️', mensagem: 'Voce gastou ' + pctSup.toFixed(0) + '% com supérfluos este mes. Fique de olho!' });
      } else if (pctSup < 10 && totalAtual > 50) {
        insights.push({ tipo: 'economia', icone: '🏆', mensagem: 'Otimo controle! Apenas ' + pctSup.toFixed(0) + '% dos gastos foram com supérfluos.' });
      }
    }

    // Score financeiro
    const score = calcularScore(grupoAtual);
    insights.push({ tipo: 'info', icone: '🎯', mensagem: 'Seu score financeiro e ' + score + '/100' });

    // Previsao de gasto
    const hoje = agora.getDate();
    if (totalAtual > 0 && hoje > 0) {
      const gastoMedio = totalAtual / hoje;
      const previsao = gastoMedio * 30;
      insights.push({ tipo: 'info', icone: '📊', mensagem: 'Se continuar assim, voce gastara cerca de R$ ' + previsao.toFixed(2) + ' este mes' });
    }

    // Comparacao mes anterior
    for (const grupo of ['Essencial', 'Complementar', 'Superfluo']) {
      const atual = grupoAtual[grupo];
      const anterior = grupoAnterior[grupo];
      if (anterior > 0 && atual > 0) {
        const diff = ((atual - anterior) / anterior) * 100;
        if (diff > 25) {
          insights.push({ tipo: 'alerta', icone: '📈', mensagem: 'Gastos com ' + grupo.toLowerCase() + ' subiram ' + diff.toFixed(0) + '% em relacao ao mes passado' });
        } else if (diff < -15) {
          insights.push({ tipo: 'economia', icone: '💚', mensagem: 'Voce economizou ' + Math.abs(diff).toFixed(0) + '% em ' + grupo.toLowerCase() + ' comparado ao mes passado!' });
        }
      }
    }

    // Vilao do mes
    const maior = Object.entries(catAtual).sort((a,b)=>b[1]-a[1])[0];
    if (maior) {
      insights.push({ tipo: 'alerta', icone: '🔥', mensagem: 'Seu maior gasto esta em ' + maior[0] + ': R$ ' + maior[1].toFixed(2) });
    }

    if (!insights.length) {
      insights.push({ tipo: 'info', icone: '📱', mensagem: 'Continue escaneando suas notas para ver analises do seu consumo!' });
    }

    return jsonOut({ status: 'ok', insights, grupoAtual, grupoAnterior, totalAtual, score });
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
      gravarLog(url, 'ERRO', 'HTTP ' + code);
      notas.getRange(linhaNotas, 7).setValue('Erro HTTP');
      return null;
    }

    const chave = extrairChave(url);
    const cnpj  = extrairRegex(html, /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    const nomeEmitente =
      extrairRegex(html, /class="NomeEmit"[^>]*>\s*([^<]+)/, 1) ||
      extrairRegex(html, /id="u20"[^>]*>\s*([^<]+)/, 1) ||
      extrairRegex(html, /<h2[^>]*>\s*([^<]{5,60})<\/h2>/, 1) || '';

    const dataRaw = extrairRegex(html, /(\d{2}\/\d{2}\/\d{4}[ T]\d{2}:\d{2}(:\d{2})?)/, 1) || '';
    let dataEmissao = '';
    if (dataRaw) {
      const partes = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})[T ](\d{2}):(\d{2})/);
      if (partes) dataEmissao = new Date(partes[3]+'-'+partes[2]+'-'+partes[1]+'T'+partes[4]+':'+partes[5]+':00');
    }

    const valorTotal =
      extrairRegex(html, /class="totalNumb txtMax">([\d,\.]+)<\/span>/, 1) ||
      extrairRegex(html, /Valor Total[^R]*R\$\s*([\d,\.]+)/, 1) || '0';

    const produtos = extrairProdutos(html);
    if (!produtos.length) {
      gravarLog(url, 'ERRO', 'Nenhum produto encontrado.');
      notas.getRange(linhaNotas, 7).setValue('Sem itens');
      return null;
    }

    notas.getRange(linhaNotas, 2, 1, 6).setValues([[
      dataEmissao || '', cnpj || '', nomeEmitente || '', 'SP',
      parseFloat((valorTotal||'0').replace(',','.')) || 0, 'OK',
    ]]);

    const linhasItens = produtos.map(p => {
      const classif = classificarProduto(p.descricao);
      return [chave, p.codigo, p.descricao, classif.categoria, classif.grupo, p.qtd, p.valorUnit, p.valorTotal, p.unidade];
    });

    itens.getRange(itens.getLastRow()+1, 1, linhasItens.length, linhasItens[0].length).setValues(linhasItens);

    // Salva chave no cache
    try { CacheService.getScriptCache().put(chave, '1', 21600); } catch(e) {}

    gravarLog(chave, 'OK', produtos.length + ' itens R$ ' + valorTotal);
    return { chave, emitente: nomeEmitente, total: valorTotal, itens: produtos.length };

  } catch(err) {
    gravarLog(url, 'EXCECAO', err.message);
    notas.getRange(linhaNotas, 7).setValue('Excecao');
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
  const lrNotas = notas.getLastRow();
  const dados = lrNotas > 1 ? notas.getRange(2, 1, lrNotas - 1, 7).getValues() : [];
  let count = 0;
  for (let i = 0; i < dados.length; i++) {
    const url    = dados[i][0].toString().trim();
    const status = dados[i][6].toString().trim();
    if (url.includes('nfce.fazenda') && status !== 'OK') {
      processarURL(url, i + 2);
      Utilities.sleep(2000);
      count++;
    }
  }
  SpreadsheetApp.getUi().alert(count + ' nota(s) consultada(s).');
}
function criarEstrutura() {
  const ss = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const abas = {
    '1_NOTAS': ['url_qrcode','data_emissao','cnpj_emitente','razao_social','uf','total_nf','status'],
    '2_ITENS': ['chave_acesso','codigo','descricao','categoria','grupo','quantidade','valor_unit','valor_total','unidade'],
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
