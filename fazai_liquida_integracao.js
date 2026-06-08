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
      if (r.tipo === 'adicional') resultados.push(M.calcularAdicional(r.cfg, caso));
      else if (r.tipo === 'he') resultados.push(M.calcularHE(r.cfg, caso));
      else if (r.tipo === 'auxilio') {
        const cfg = { ...r.cfg, valorMensalPadrao: (caso.auxiliosPadrao && caso.auxiliosPadrao[id]) || 0 };
        resultados.push(M.calcularAuxilio(cfg, caso));
      }
    });
    // Família D depois das salariais (INSS depende delas)
    if (caso.incluirINSS) resultados.push(M.calcularINSS(caso, resultados));
    if (caso.honorarios) resultados.push(M.calcularHonorarios(caso));

    const agg = M.agregar(resultados, caso);
    return { agregado: agg, liquidaResult: engineToLiquidaResult(agg, caso) };
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
        descricao: v.descricao, metodologia: v.metodologia, natureza: v.natureza,
        valor: v.principal, valorCorrigido: v.valorCorrigido, juros: v.juros, total: v.total,
        status: 'normal', _memoria: v.memoriaMensal,   // memória real anexada
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
  function renderMemoriaReal(liquidaResult, containerEl) {
    if (!containerEl) return;
    const fb = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const blocos = (liquidaResult.verbas || []).filter(v => v._memoria && v._memoria.length).map(v => {
      const cols = Object.keys(v._memoria[0]);
      const head = cols.map(c => `<th>${c}</th>`).join('');
      const rows = v._memoria.map(l => `<tr>${cols.map(c => {
        const val = l[c]; const num = typeof val === 'number';
        return `<td style="text-align:${num ? 'right' : 'left'}">${num ? fb(val) : (val ?? '')}</td>`;
      }).join('')}</tr>`).join('');
      return `<div style="margin:14px 0">
        <div style="font-weight:700;color:#EA580C;margin-bottom:6px">${v.descricao}</div>
        <div style="overflow:auto"><table class="pjc-table" style="font-size:11px;min-width:700px">
          <thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
        <div style="font-size:11px;color:#6e6e6e;margin-top:4px">Principal ${fb(v.valor)} · Corrigido ${fb(v.valorCorrigido)} · Juros ${fb(v.juros)} · Total ${fb(v.total)}</div>
      </div>`;
    }).join('');
    containerEl.innerHTML = blocos || '<div style="color:#6e6e6e">Sem verbas com memória.</div>';
  }

  global.FazAILiquida = { calcularLiquidacaoDeterministica, engineToLiquidaResult, renderMemoriaReal };
  if (typeof module !== 'undefined') module.exports = global.FazAILiquida;
})(typeof window !== 'undefined' ? window : globalThis);
