// fazai_liquida_integracao.js — CAMADA DE INTEGRAÇÃO (motor determinístico ↔ app)
// Depende de: fazai_base_dados.js, fazai_motor.js
(function (global) {
  const M = global.FazAIMotor || (typeof require !== 'undefined' ? require('./fazai_motor') : null);

  // Registro: verbaId → { familia, fn, cfg }
  function registro() {
    const reg = {};
    Object.values(M.CONFIG_FAMILIA_A).forEach(c => reg[c.id] = { tipo: 'adicional', cfg: c });
    Object.values(M.CONFIG_FAMILIA_B).forEach(c => reg[c.id] = { tipo: 'he', cfg: c });
    Object.values(M.CONFIG_FAMILIA_C).forEach(c => reg[c.id] = { tipo: 'auxilio', cfg: c });
    return reg;
  }

  // ─────────── ponto de entrada único ───────────
  // caso: ver specs. caso.verbasAtivas = ['periculosidade','heTotais','vr',...]
  //       caso.incluirINSS (bool), caso.honorarios (obj) → liga Família D.
  function calcularLiquidacaoDeterministica(caso) {
    const reg = registro();
    const resultados = [];
    (caso.verbasAtivas || []).forEach(id => {
      const r = reg[id];
      if (!r) { console.warn('verba desconhecida:', id); return; }
      const ov = (caso.overrides && caso.overrides[id]) || {};
      const cfg = { ...r.cfg, ...ov };
      let x = null;
      if (r.tipo === 'adicional') x = M.calcularAdicional(cfg, caso);
      else if (r.tipo === 'he') x = M.calcularHE(cfg, caso);
      else if (r.tipo === 'auxilio') { cfg.valorMensalPadrao = (caso.auxiliosPadrao && caso.auxiliosPadrao[id]) || 0; x = M.calcularAuxilio(cfg, caso); }
      if (x) { x._tipo = r.tipo; resultados.push(x); }
    });
    // Família D depois das salariais (INSS depende delas)
    if (caso.incluirINSS) { const x = M.calcularINSS(caso, resultados); x._tipo = 'inss'; resultados.push(x); }
    if (caso.honorarios) { const x = M.calcularHonorarios(caso); x._tipo = 'honorarios'; resultados.push(x); }

    // Verbas calculadas pela IA (metodologia LiquidaAI) — correção aplicada PELO MOTOR
    (caso.verbasIA || []).forEach(v => resultados.push(incorporarVerbaIA(v, caso)));

    const agg = M.agregar(resultados, caso);
    return { agregado: agg, liquidaResult: engineToLiquidaResult(agg, caso) };
  }

  // Converte uma verba calculada pela IA no formato de resultado do motor.
  // A IA fornece a ESTRUTURA (competência + valor devido); a CORREÇÃO é do motor (mesma régua IPCA-E).
  // v: { descricao, natureza, formato:'mensal'|'bloco', memoria:[{competencia:'YYYY-MM', valorDevido}], valor, dataBase:'YYYY-MM' }
  function incorporarVerbaIA(v, caso) {
    const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const idx = (compStr) => M._base.indiceCorrecaoIPCAE(M._base.mkDate(compStr), caso.dataDistribuicao, []);
    if (v.formato === 'mensal' && Array.isArray(v.memoria) && v.memoria.length) {
      const mem = v.memoria.map(l => {
        const devido = Number(l.valorDevido || l.valor || 0);
        const indice = idx(l.competencia);
        return { competencia: l.competencia, valorDevido: round(devido), totalApurado: round(devido),
          indiceCorrecao: Math.round(indice * 1e6) / 1e6, corrigido: round(devido * indice) };
      });
      const principal = round(mem.reduce((s, l) => s + l.totalApurado, 0));
      const valorCorrigido = round(mem.reduce((s, l) => s + l.corrigido, 0));
      return { id: v.descricao, descricao: v.descricao, natureza: v.natureza || 'salarial',
        metodologia: v.metodologia || '', memoriaMensal: mem, principal, fgts: 0, valorCorrigido,
        origem: 'ia', formato: 'mensal', _tipo: 'ia', avisos: [] };
    }
    // bloco (valor fechado)
    const valor = Number(v.valor || 0);
    const compBase = v.dataBase || M._base.ym(caso.dataDistribuicao || caso.dataDemissao);
    const indice = idx(compBase);
    return { id: v.descricao, descricao: v.descricao, natureza: v.natureza || 'indenizatoria',
      metodologia: v.metodologia || '', memoriaMensal: [], principal: round(valor), fgts: 0,
      valorCorrigido: round(valor * indice), origem: 'ia', formato: 'bloco', _tipo: 'ia', avisos: [] };
  }

  // ─────────── mapeia p/ o formato liquidaResult existente ───────────
  function engineToLiquidaResult(agg, caso) {
    const fmtComp = (d) => d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';
    const fgtsTotal = agg.fgts;
    return {
      reclamante: caso.reclamante || '', reclamada: caso.reclamada || '', numeroProcesso: caso.numeroProcesso || '',
      periodoCalculoInicio: fmtComp(caso.dataPrescricao || caso.dataAdmissao),
      periodoCalculoFim: fmtComp(caso.dataDemissao),
      verbas: agg.verbas.map(v => ({
        id: v.id, _tipo: v._tipo || 'motor',
        descricao: v.descricao, metodologia: v.metodologia, natureza: v.natureza,
        valor: v.principal, valorCorrigido: v.valorCorrigido, juros: v.juros, total: v.total,
        status: 'normal', _memoria: v.memoriaMensal,
        origem: v.origem || 'motor',
        formato: v.formato || ((v.memoriaMensal && v.memoriaMensal.length) ? 'mensal' : 'bloco'),
      })),
      totalBruto: agg.principal, fgts: fgtsTotal,
      inss: 0, irrf: 0, totalLiquido: agg.principal,
      valorFinalCorrigido: agg.valorCorrigido, valorTotalGeral: agg.total,
      observation: `Cálculo determinístico (motor FazAI). Correção IPCA-E + juros SELIC (fator ${agg.fatorSelic}). ` +
        `Base: ${(agg._meta.base && agg._meta.base.status) || 'n/d'}. ` +
        (agg._meta.avisos.length ? `Avisos: ${agg._meta.avisos.join('; ')}` : 'Sem avisos.'),
      _deterministico: true, _agregado: agg,
    };
  }

  // ─────────── render da memória mensal REAL (substitui a fabricada) ───────────
  // Monta uma tabela por verba ativa, com a memória mês a mês de verdade.
  // Layout unificado de apuração: aceita verbas do motor (determinísticas) e da IA.
  // Cada verba: { descricao, natureza, valor, valorCorrigido, juros, total, metodologia,
  //               origem:'motor'|'ia', formato:'mensal'|'bloco', _memoria:[...] }
  function renderMemoriaReal(liquidaResult, containerEl) {
    if (!containerEl) return;
    const fb = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const COLS = [
      ['competencia', 'Compet.'], ['base', 'Base'], ['valorDevido', 'Devido'], ['pago', 'Pago'],
      ['avisoPrevio', 'Aviso'], ['decimoTerceiro', '13º'], ['feriasMaisUmTerco', 'Férias+1/3'],
      ['dsr', 'DSR'], ['totalApurado', 'Apurado'], ['totalDevido', 'Apurado'], ['fgts', 'FGTS'],
      ['indiceCorrecao', 'Índice'], ['corrigido', 'Corrigido'],
    ];
    const badge = (origem) => origem === 'ia'
      ? '<span style="font-size:10px;background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:4px">estimativa IA</span>'
      : '<span style="font-size:10px;background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px">apuração determinística</span>';

    // Qual coluna é INPUT editável conforme a natureza da verba
    function campoEditavel(tipo, key) {
      if (tipo === 'ia') return key === 'valorDevido' ? 'iaValor' : null;
      if (tipo === 'adicional') return key === 'base' ? 'salario' : null;
      if (tipo === 'he') return key === 'qtd' ? 'qtd' : (key === 'pago' ? 'pago' : null);
      if (tipo === 'auxilio') return key === 'valorDevido' ? 'devidoAux' : (key === 'pago' ? 'pago' : null);
      return null;
    }

    function tabelaMensal(v) {
      const mem = v._memoria || [];
      const cols = COLS.filter(([k]) => mem.some(l => l[k] != null));
      const head = cols.map(([, lbl]) => `<th style="text-align:right">${lbl}</th>`).join('');
      const rows = mem.map(l => `<tr>${cols.map(([k]) => {
        const val = l[k]; const num = typeof val === 'number';
        const campo = campoEditavel(v._tipo, k);
        if (campo) {
          return `<td style="text-align:right"><input class="fd-edit" data-verba="${encodeURIComponent(v.id)}" data-comp="${l.competencia}" data-campo="${campo}" value="${Number(val) || 0}" style="width:78px;text-align:right;border:1px solid #f0b27a;border-radius:4px;padding:2px 4px;background:#fff7ed"></td>`;
        }
        return `<td style="text-align:${num ? 'right' : 'left'}">${num ? (k === 'indiceCorrecao' ? val.toFixed(6) : fb(val)) : (val ?? '')}</td>`;
      }).join('')}</tr>`).join('');
      return `<div style="overflow:auto"><table class="pjc-table" style="font-size:11px;min-width:680px">
        <thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function bloco(v) {
      const editavel = v._tipo === 'ia';
      const valHtml = editavel
        ? `<input class="fd-edit" data-verba="${encodeURIComponent(v.id)}" data-comp="__bloco__" data-campo="iaBloco" value="${Number(v.valor) || 0}" style="width:120px;text-align:right;border:1px solid #f0b27a;border-radius:4px;padding:3px 6px;background:#fff7ed">`
        : `<b>${fb(v.valor)}</b>`;
      return `<div style="font-size:13px;color:#444;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:10px">
        ${v.metodologia ? `<div style="color:#6e6e6e;margin-bottom:4px">${v.metodologia}</div>` : ''}
        <div>Valor: ${valHtml}</div></div>`;
    }

    const verbas = liquidaResult.verbas || [];
    const blocos = verbas.map(v => {
      const ehMensal = v.formato === 'mensal' || (v._memoria && v._memoria.length);
      const corpo = ehMensal ? tabelaMensal(v) : bloco(v);
      return `<div style="margin:16px 0;border-top:1px solid #eee;padding-top:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-weight:700;color:#EA580C">${v.descricao}</span> ${badge(v.origem || 'motor')}
        </div>
        ${corpo}
        <div style="font-size:11px;color:#6e6e6e;margin-top:4px">Principal ${fb(v.valor)} · Corrigido ${fb(v.valorCorrigido)} · Juros ${fb(v.juros)} · <b>Total ${fb(v.total)}</b></div>
      </div>`;
    }).join('');

    const tot = liquidaResult.valorTotalGeral != null ? liquidaResult.valorTotalGeral
      : verbas.reduce((s, v) => s + (v.total || 0), 0);
    const rodape = `<div style="margin-top:14px;padding:12px;background:#1f2937;color:#fff;border-radius:8px;display:flex;justify-content:space-between;font-weight:700">
      <span>TOTAL GERAL DA APURAÇÃO</span><span>${fb(tot)}</span></div>`;
    containerEl.innerHTML = (blocos || '<div style="color:#6e6e6e">Sem verbas.</div>') + (verbas.length ? rodape : '');

    // estado p/ reapuração e binding do listener (uma vez por container)
    _estado.containerEl = containerEl;
    if (!containerEl.__fazaiBound) {
      containerEl.__fazaiBound = true;
      containerEl.addEventListener('focusout', (ev) => {
        const el = ev.target;
        if (!el || !el.classList || !el.classList.contains('fd-edit')) return;
        const caso = window._fazaiCasoAtual; if (!caso) return;
        const verba = decodeURIComponent(el.dataset.verba);
        const comp = el.dataset.comp, campo = el.dataset.campo;
        const valor = parseFloat(String(el.value).replace(',', '.')) || 0;
        aplicarEdicao(caso, { verba, comp, campo, valor });
        reapurar();
      });
    }
  }

  function aplicarEdicao(caso, e) {
    const ensure = (obj, k) => (obj[k] = obj[k] || {});
    if (e.campo === 'salario') { ensure(caso, 'salariosMensais')[e.comp] = e.valor; }
    else if (e.campo === 'qtd') { ensure(ensure(caso, 'qtdHoras'), e.verba)[e.comp] = e.valor; }
    else if (e.campo === 'pago') { ensure(ensure(caso, 'pagos'), e.verba)[e.comp] = e.valor; }
    else if (e.campo === 'devidoAux') { ensure(ensure(caso, 'valoresDevidos'), e.verba)[e.comp] = e.valor; }
    else if (e.campo === 'iaValor') {
      const v = (caso.verbasIA || []).find(x => x.descricao === e.verba);
      if (v && Array.isArray(v.memoria)) { const l = v.memoria.find(m => m.competencia === e.comp); if (l) l.valorDevido = e.valor; }
    } else if (e.campo === 'iaBloco') {
      const v = (caso.verbasIA || []).find(x => x.descricao === e.verba); if (v) v.valor = e.valor;
    }
  }

  // Reapura o caso inteiro e redesenha, preservando a rolagem.
  function reapurar() {
    const caso = window._fazaiCasoAtual; const cont = _estado.containerEl;
    if (!caso || !cont) return;
    const sx = window.scrollX, sy = window.scrollY, cs = cont.scrollTop;
    const out = calcularLiquidacaoDeterministica(caso);
    window.liquidaResult = out.liquidaResult;
    renderMemoriaReal(out.liquidaResult, cont);
    cont.scrollTop = cs; window.scrollTo(sx, sy);
    return out;
  }
  const _estado = {};

  global.FazAILiquida = { calcularLiquidacaoDeterministica, engineToLiquidaResult, renderMemoriaReal, reapurar };
  if (typeof module !== 'undefined') module.exports = global.FazAILiquida;
})(typeof window !== 'undefined' ? window : globalThis);
