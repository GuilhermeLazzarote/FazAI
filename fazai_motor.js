// fazai_motor.js — MOTOR DE CÁLCULO DETERMINÍSTICO (LiquidaAI)
// Lê tudo de FAZAI_BASE (camada de dados isolada). Não embute números de base.
// Depende de: fazai_base_dados.js
(function (global) {
  const B = global.FAZAI_BASE || (typeof require !== 'undefined' ? require('./fazai_base_dados').FAZAI_BASE : null);

  // ───────────────────────── util de competência ─────────────────────────
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const mkDate = (s) => { const [y, m] = s.split('-').map(Number); return new Date(y, m - 1, 1); };
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const diasNoMes = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const mesesEntre = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

  function competencias(ini, fim) {
    const out = []; let d = new Date(ini.getFullYear(), ini.getMonth(), 1);
    while (d <= fim) { out.push(new Date(d)); d = addMonths(d, 1); }
    return out;
  }

  // lookup "≤ data" (VLOOKUP aproximado): pega a chave mais recente que não passa de comp
  function lookupSerie(serie, comp) {
    const k = ym(comp);
    if (serie[k] != null) return { valor: serie[k], exato: true };
    const chaves = Object.keys(serie).sort();
    let escolhida = null;
    for (const c of chaves) { if (c <= k) escolhida = c; else break; }
    if (escolhida == null) return { valor: null, foraDoInicio: true };
    return { valor: serie[escolhida], exato: false, foraDoFim: k > chaves[chaves.length - 1] };
  }

  // ───────────────────────── acessores de base ─────────────────────────
  // Fator de correção IPCA-E de `comp` até `dataRef` (ADC 58: IPCA-E até citação/distribuição).
  function indiceCorrecaoIPCAE(comp, dataRef, avisos) {
    const a = lookupSerie(B.ipcae, comp), b = lookupSerie(B.ipcae, dataRef);
    if (a.valor == null || b.valor == null) { avisos && avisos.push(`IPCA-E ausente p/ ${ym(comp)}→${ym(dataRef)}`); return 1; }
    if (a.foraDoFim || b.foraDoFim) avisos && avisos.push(`IPCA-E extrapolado após fim da base em ${ym(comp)}`);
    return b.valor / a.valor;
  }
  // Fator SELIC (juros) do período judicial: de distribuição até atualização.
  function fatorSelic(dataDistrib, dataAtual, avisos) {
    const a = lookupSerie(B.selic, dataDistrib), b = lookupSerie(B.selic, dataAtual);
    if (a.valor == null || b.valor == null) { avisos && avisos.push('SELIC ausente'); return 0; }
    return b.valor / a.valor - 1; // taxa acumulada no período
  }
  function duDsr(comp, comSabado) {
    const r = B.duDsr[ym(comp)] || {};
    return comSabado ? { du: r.duSab, dsr: r.dsrSab, dias: r.dias } : { du: r.duSeg, dsr: r.dsrSeg, dias: r.dias };
  }
  function salarioMinimo(comp) { const r = lookupSerie(seriaSM(), comp); return r.valor || 0; }
  let _sm = null; function seriaSM() { if (!_sm) { _sm = {}; B.salarioMinimo.forEach(x => _sm[x.vigencia] = x.valor); } return _sm; }

  // ───────────────────────── motor de reflexos ─────────────────────────
  // Reflexos lançados NA competência devida (não todo mês).
  function reflexosAdicional(cfg, comp, ultimoMes, caso, valorApurado, valorDevido) {
    // FÉRIAS+1/3: vence a cada 12 meses APÓS a admissão (não no mês de admissão).
    // No último mês, se o período aquisitivo está incompleto, lança proporcional.
    const mesesContrato = mesesEntre(caso.dataAdmissao, comp);
    const ehAniversarioAquisitivo = mesesContrato > 0 && mesesContrato % 12 === 0;
    let ferias = 0;
    if (ehAniversarioAquisitivo) ferias = valorApurado * (4 / 3);
    else if (ultimoMes) ferias = valorApurado * (4 / 3) * ((mesesContrato % 12) / 12);

    // 13º: proporcional aos meses trabalhados NO ANO (lançado em dezembro ou no último mês).
    let mesesNoAno;
    if (comp.getFullYear() === caso.dataAdmissao.getFullYear())
      mesesNoAno = comp.getMonth() - caso.dataAdmissao.getMonth() + 1;
    else mesesNoAno = comp.getMonth() + 1;
    const decimo = (comp.getMonth() === 11 || ultimoMes) ? valorDevido / 12 * mesesNoAno : 0;

    let aviso = 0;
    if (ultimoMes && caso.motivoDemissao === 'Sem Justa Causa') {
      const anos = Math.floor(mesesEntre(caso.dataAdmissao, caso.dataDemissao) / 12);
      aviso = valorDevido / 30 * (30 + anos * 3); // Lei 12.506
    }
    return { avisoPrevio: aviso, decimoTerceiro: decimo, feriasMaisUmTerco: ferias };
  }

  // ───────────────────────── Família A — Adicionais ─────────────────────────
  // caso: { dataAdmissao, dataDemissao, dataDistribuicao, dataAtualizacao, motivoDemissao,
  //         percentualFgts, dsrComSabado, salariosMensais:{'YYYY-MM':valor}, faltas:{'YYYY-MM':n} }
  function calcularAdicional(cfg, caso) {
    const avisos = [];
    const ini = caso.dataPrescricao || caso.dataAdmissao;
    const meses = competencias(ini, caso.dataDemissao);

    const memoria = meses.map((comp, i) => {
      const ultimoMes = i === meses.length - 1;
      const base = obterBase(cfg, comp, caso, avisos);
      const valorApurado = base * cfg.percentual;
      const dias = diasNoMes(comp);
      const faltas = (caso.faltas && caso.faltas[ym(comp)]) || 0;
      const diasProporcionais = dias - faltas;
      const valorDevido = cfg.proporcionalDias ? valorApurado / dias * diasProporcionais : valorApurado;

      const refl = cfg.temReflexos ? reflexosAdicional(cfg, comp, ultimoMes, caso, valorApurado, valorDevido)
                                   : { avisoPrevio: 0, decimoTerceiro: 0, feriasMaisUmTerco: 0 };
      const totalApurado = valorDevido + refl.avisoPrevio + refl.decimoTerceiro + refl.feriasMaisUmTerco;
      const fgts = cfg.geraFgts ? (valorDevido + refl.decimoTerceiro + refl.feriasMaisUmTerco) * caso.percentualFgts : 0;
      const indice = indiceCorrecaoIPCAE(comp, caso.dataDistribuicao, avisos);

      return {
        competencia: ym(comp), base: round(base), percentual: cfg.percentual, valorApurado: round(valorApurado),
        dias, faltas, diasProporcionais, valorDevido: round(valorDevido),
        avisoPrevio: round(refl.avisoPrevio), decimoTerceiro: round(refl.decimoTerceiro), feriasMaisUmTerco: round(refl.feriasMaisUmTerco),
        totalApurado: round(totalApurado), fgts: round(fgts),
        indiceCorrecao: round(indice, 6), corrigido: round(totalApurado * indice), fgtsCorrigido: round(fgts * indice),
      };
    });

    const soma = (k) => round(memoria.reduce((s, l) => s + l[k], 0));
    return {
      id: cfg.id, descricao: cfg.nome, natureza: cfg.natureza,
      metodologia: `${cfg.nome}: base × ${(cfg.percentual * 100).toFixed(0)}%, proporcional aos dias, reflexos na competência devida, FGTS ${(caso.percentualFgts * 100).toFixed(2)}%, correção IPCA-E.`,
      memoriaMensal: memoria,
      principal: soma('totalApurado'), fgts: soma('fgts'), valorCorrigido: soma('corrigido'),
      avisos: [...new Set(avisos)],
    };
  }

  function obterBase(cfg, comp, caso, avisos) {
    if (cfg.fonteBase === 'salarioMinimo') return salarioMinimo(comp);
    // 'salario': salário do mês (EVOLUÇÃO). Usa o do mês; se faltar, o último conhecido.
    const sm = caso.salariosMensais || {};
    if (sm[ym(comp)] != null) return sm[ym(comp)];
    const chaves = Object.keys(sm).sort(); let ult = null;
    for (const c of chaves) { if (c <= ym(comp)) ult = c; }
    if (ult == null) { avisos && avisos.push(`Salário ausente p/ ${ym(comp)}`); return 0; }
    return sm[ult];
  }

  // ───────────────────────── config das verbas (Família A) ─────────────────────────
  const CONFIG_FAMILIA_A = {
    periculosidade: { id: 'periculosidade', nome: 'ADICIONAL DE PERICULOSIDADE E REFLEXOS', familia: 'adicional', natureza: 'salarial', fonteBase: 'salario', percentual: 0.30, proporcionalDias: true, temReflexos: true, geraFgts: true },
    transferencia:  { id: 'transferencia',  nome: 'ADICIONAL DE TRANSFERÊNCIA E REFLEXOS',  familia: 'adicional', natureza: 'salarial', fonteBase: 'salario', percentual: 0.25, proporcionalDias: true, temReflexos: true, geraFgts: true },
    acumuloFuncao:  { id: 'acumuloFuncao',  nome: 'ACÚMULO DE FUNÇÃO E REFLEXOS',           familia: 'adicional', natureza: 'salarial', fonteBase: 'salario', percentual: 0.15, proporcionalDias: true, temReflexos: true, geraFgts: true },
    // insalubridade: grau define o %; base pode ser salário mínimo ou salário (parâmetro do caso)
    insalubridade:  { id: 'insalubridade',  nome: 'ADICIONAL DE INSALUBRIDADE E REFLEXOS',  familia: 'adicional', natureza: 'salarial', fonteBase: 'salarioMinimo', percentual: 0.20, proporcionalDias: true, temReflexos: true, geraFgts: true },
  };

  // ───────────────────────── Família C — Auxílios com abatimento ─────────────────────────
  // Sem reflexos, sem FGTS. Estreia o "pago" por competência: apurado = MAX(devido − pago, 0).
  // caso.valoresDevidos[verbaId] = { 'YYYY-MM': valorDevidoNoMes }  (ou usa cfg.valorMensalPadrao)
  // caso.pagos[verbaId]          = { 'YYYY-MM': valorPagoNoMes }
  function calcularAuxilio(cfg, caso) {
    const avisos = [];
    const ini = caso.dataPrescricao || caso.dataAdmissao;
    const meses = competencias(ini, caso.dataDemissao);
    const devidos = (caso.valoresDevidos && caso.valoresDevidos[cfg.id]) || {};
    const pagos = (caso.pagos && caso.pagos[cfg.id]) || {};

    const memoria = meses.map((comp) => {
      const k = ym(comp);
      const devido = devidos[k] != null ? devidos[k] : (cfg.valorMensalPadrao || 0);
      const pago = pagos[k] || 0;
      const apurado = Math.max(devido - pago, 0);
      const indice = indiceCorrecaoIPCAE(comp, caso.dataDistribuicao, avisos);
      return {
        competencia: k, valorDevido: round(devido), pago: round(pago), origemPago: pagos[k] != null ? 'manual' : null,
        apurado: round(apurado), totalApurado: round(apurado),
        indiceCorrecao: round(indice, 6), corrigido: round(apurado * indice),
      };
    });
    const soma = (key) => round(memoria.reduce((s, l) => s + l[key], 0));
    return {
      id: cfg.id, descricao: cfg.nome, natureza: cfg.natureza,
      metodologia: `${cfg.nome}: valor devido por competência − valor pago (abatimento mês a mês), correção IPCA-E. Sem reflexos.`,
      memoriaMensal: memoria, principal: soma('totalApurado'), fgts: 0, valorCorrigido: soma('corrigido'),
      avisos: [...new Set(avisos)],
    };
  }

  const CONFIG_FAMILIA_C = {
    vr: { id: 'vr', nome: 'AUXÍLIO REFEIÇÃO (VR) — DIFERENÇAS', familia: 'auxilio', natureza: 'indenizatoria', admitePago: true },
    va: { id: 'va', nome: 'AUXÍLIO ALIMENTAÇÃO (VA) — DIFERENÇAS', familia: 'auxilio', natureza: 'indenizatoria', admitePago: true },
  };

  // ───────────────────────── Família B — Horas extras e equiparados ─────────────────────────
  // Consome quantidades mensais (input editável; vêm do motor de jornada, PontoAI ou manual).
  // caso.qtdHoras[verbaId] = { 'YYYY-MM': horas } ; caso.pagos[verbaId] = { 'YYYY-MM': pago }
  // caso.divisor (200|220). Reflexos por MÉDIA FÍSICA (Súmula 347 TST).
  function calcularHE(cfg, caso) {
    const avisos = [];
    const ini = caso.dataPrescricao || caso.dataAdmissao;
    const meses = competencias(ini, caso.dataDemissao);
    const qtdMap = (caso.qtdHoras && caso.qtdHoras[cfg.id]) || {};
    const pagos = (caso.pagos && caso.pagos[cfg.id]) || {};
    const divisor = caso.divisor || 220;
    const reformaArt71 = caso.regimeArt71 === 'Misto Reforma Trabalhista';

    // PASSO 1 — diferença, DSR e base de reflexos por mês
    const linhas = meses.map((comp) => {
      const k = ym(comp);
      const qtd = qtdMap[k] || 0;
      const salarioMes = obterBase({ fonteBase: 'salario' }, comp, caso, avisos);
      const salarioHora = salarioMes / divisor;
      const horasExtras = qtd * cfg.adicional;
      const valorDevido = horasExtras * salarioHora;
      const pago = pagos[k] || 0;
      const diferenca = Math.max(valorDevido - pago, 0);

      const { du, dsr: dsrs } = duDsr(comp, caso.dsrComSabado);
      let dsr = (du && diferenca) ? diferenca / du * dsrs : 0;
      let baseReflexos = caso.dsrCompoeBaseReflexos ? diferenca + dsr : diferenca;

      // REGRA ART. 71 pós-reforma: indenizatório, sem DSR e sem reflexos
      const zeraReflexos = cfg.id === 'heArt71' && reformaArt71 && comp > new Date(2017, 9, 11);
      if (zeraReflexos) { dsr = 0; baseReflexos = 0; }

      return { comp, k, qtd, salarioHora, horasExtras, valorDevido, pago,
               origemPago: pagos[k] != null ? 'manual' : null, diferenca, du, dsrs, dsr, baseReflexos, zeraReflexos };
    });

    // MÉDIA FÍSICA: média da base de reflexos sobre os meses com movimento (qtd > 0)
    const comMov = linhas.filter(l => l.qtd > 0 && !l.zeraReflexos);
    const mediaBaseReflexos = comMov.length ? comMov.reduce((s, l) => s + l.baseReflexos, 0) / comMov.length : 0;

    // PASSO 2 — reflexos lançados na competência devida, sobre a MÉDIA
    const anos = Math.floor(mesesEntre(caso.dataAdmissao, caso.dataDemissao) / 12);
    const memoria = linhas.map((l, i) => {
      const ultimoMes = i === linhas.length - 1;
      let aviso = 0, decimo = 0, ferias = 0;
      if (cfg.temReflexos && !l.zeraReflexos && mediaBaseReflexos > 0) {
        const mesesContrato = mesesEntre(caso.dataAdmissao, l.comp);
        if (mesesContrato > 0 && mesesContrato % 12 === 0) ferias = mediaBaseReflexos * (4 / 3);
        else if (ultimoMes) ferias = mediaBaseReflexos * (4 / 3) * ((mesesContrato % 12) / 12);
        let mesesNoAno = (l.comp.getFullYear() === caso.dataAdmissao.getFullYear())
          ? l.comp.getMonth() - caso.dataAdmissao.getMonth() + 1 : l.comp.getMonth() + 1;
        if (l.comp.getMonth() === 11 || ultimoMes) decimo = mediaBaseReflexos / 12 * mesesNoAno;
        if (ultimoMes && caso.motivoDemissao === 'Sem Justa Causa') aviso = mediaBaseReflexos / 30 * (30 + anos * 3);
      }
      const fgts = cfg.geraFgts ? (l.baseReflexos + decimo + ferias) * caso.percentualFgts : 0;
      const totalDevido = l.diferenca + l.dsr + aviso + decimo + ferias;
      const indice = indiceCorrecaoIPCAE(l.comp, caso.dataDistribuicao, avisos);
      return {
        competencia: l.k, qtd: l.qtd, salarioHora: round(l.salarioHora, 4), horasExtras: round(l.horasExtras),
        valorDevido: round(l.valorDevido), pago: round(l.pago), origemPago: l.origemPago, diferenca: round(l.diferenca),
        du: l.du, dsrs: l.dsrs, dsr: round(l.dsr), baseReflexos: round(l.baseReflexos),
        avisoPrevio: round(aviso), decimoTerceiro: round(decimo), feriasMaisUmTerco: round(ferias),
        fgts: round(fgts), totalDevido: round(totalDevido),
        indiceCorrecao: round(indice, 6), corrigido: round(totalDevido * indice),
      };
    });
    const soma = (key) => round(memoria.reduce((s, l) => s + l[key], 0));
    return {
      id: cfg.id, descricao: cfg.nome, natureza: cfg.natureza,
      metodologia: `${cfg.nome}: qtd × ${cfg.adicional} × salário-hora (÷${divisor}) − pago; DSR; reflexos por média física (Súmula 347); FGTS ${(caso.percentualFgts * 100).toFixed(2)}%; correção IPCA-E.`,
      mediaBaseReflexos: round(mediaBaseReflexos),
      memoriaMensal: memoria, principal: soma('totalDevido'), fgts: soma('fgts'), valorCorrigido: soma('corrigido'),
      avisos: [...new Set(avisos)],
    };
  }

  const CONFIG_FAMILIA_B = {
    heTotais:         { id: 'heTotais',         nome: 'HORAS EXTRAS 50% E REFLEXOS',        familia: 'horasExtras', natureza: 'salarial', adicional: 1.5, temReflexos: true, geraFgts: true },
    he100:            { id: 'he100',            nome: 'HORAS EXTRAS 100% E REFLEXOS',       familia: 'horasExtras', natureza: 'salarial', adicional: 2.0, temReflexos: true, geraFgts: true },
    heArt71:          { id: 'heArt71',          nome: 'INTERVALO INTRAJORNADA (ART. 71)',   familia: 'horasExtras', natureza: 'salarial', adicional: 1.5, temReflexos: true, geraFgts: true },
    adicionalNoturno: { id: 'adicionalNoturno', nome: 'ADICIONAL NOTURNO E REFLEXOS',       familia: 'horasExtras', natureza: 'salarial', adicional: 0.2, temReflexos: true, geraFgts: true },
  };

  // ───────────────────────── Agregação (RESUMO) ─────────────────────────
  // Aplica juros SELIC sobre o corrigido (passagem final) e soma os totais gerais.
  function agregar(resultados, caso) {
    const avisos = [];
    const fator = fatorSelic(caso.dataDistribuicao, caso.dataAtualizacao, avisos);
    const verbas = resultados.map((r) => {
      const juros = round(r.valorCorrigido * fator);
      return { ...r, juros, total: round(r.valorCorrigido + juros) };
    });
    const s = (k) => round(verbas.reduce((a, v) => a + (v[k] || 0), 0));
    return {
      verbas,
      principal: s('principal'),
      correcao: round(s('valorCorrigido') - s('principal')),
      juros: s('juros'),
      fgts: s('fgts'),
      valorCorrigido: s('valorCorrigido'),
      total: s('total'),
      fatorSelic: round(fator, 6),
      _meta: { base: (B && B._meta) || null, avisos: [...new Set([...avisos, ...verbas.flatMap(v => v.avisos || [])])] },
    };
  }

  // ───────────────────────── Família D — Especiais (INSS, Honorários) ─────────────────────────
  // INSS reclamante (método da planilha): MIN(alíquota_da_faixa × base, teto), mês a mês.
  // ⚠️ VALIDAR: método antigo (alíquota única por faixa). Pós-2020 o INSS é progressivo por faixas.
  function tabelaInssDoMes(comp) {
    const chave = ym(comp); const chaves = Object.keys(B.inss).sort();
    let esc = null; for (const c of chaves) { if (c <= chave) esc = c; else break; }
    return esc ? B.inss[esc] : null;
  }
  function inssDevido(base, comp) {
    const t = tabelaInssDoMes(comp); if (!t) return 0;
    let aliq = 0; for (const f of t.faixas) { if (base >= f.de) aliq = f.aliquota; }
    const devido = aliq * base;
    return t.teto != null ? Math.min(devido, t.teto) : devido;
  }
  // resultadosSalariais: array de resultados de verbas salariais (p/ somar base mês a mês)
  function calcularINSS(caso, resultadosSalariais) {
    const avisos = [];
    const ini = caso.dataPrescricao || caso.dataAdmissao;
    const meses = competencias(ini, caso.dataDemissao);
    const recolhido = caso.inssRecolhido || {};
    const sm = caso.salariosMensais || {};

    const memoria = meses.map((comp) => {
      const k = ym(comp);
      const remuneracao = sm[k] != null ? sm[k] : obterBase({ fonteBase: 'salario' }, comp, caso, []);
      let baseVerbas = 0;
      (resultadosSalariais || []).forEach(r => {
        if (r.natureza !== 'salarial') return;
        const linha = r.memoriaMensal.find(l => l.competencia === k);
        if (linha) baseVerbas += (linha.totalDevido != null ? linha.totalDevido : linha.totalApurado) || 0;
      });
      const baseTotal = remuneracao + baseVerbas;
      const devido = inssDevido(baseTotal, comp);
      const rec = recolhido[k] || 0;
      const diferenca = Math.max(devido - rec, 0);
      const indice = indiceCorrecaoIPCAE(comp, caso.dataDistribuicao, avisos);
      return { competencia: k, remuneracao: round(remuneracao), baseVerbas: round(baseVerbas),
        baseTotal: round(baseTotal), devido: round(devido), recolhido: round(rec),
        totalApurado: round(diferenca), indiceCorrecao: round(indice, 6), corrigido: round(diferenca * indice) };
    });
    const soma = (key) => round(memoria.reduce((s, l) => s + l[key], 0));
    return { id: 'inss', descricao: 'INSS — DIFERENÇAS (RECLAMANTE)', natureza: 'previdenciaria',
      metodologia: 'INSS mês a mês: MIN(alíquota da faixa × base, teto) sobre (remuneração + verbas salariais), menos recolhido. Correção IPCA-E. ⚠️ método antigo — validar contra regime progressivo pós-2020.',
      memoriaMensal: memoria, principal: soma('totalApurado'), fgts: 0, valorCorrigido: soma('corrigido'), avisos: [...new Set(avisos)] };
  }

  // Honorários sucumbenciais do reclamante: % × pedidos improcedentes − pago.
  // caso.honorarios = { somaPedidosImprocedentes, percentual (0..1), pago, dataBase: Date }
  function calcularHonorarios(caso) {
    const avisos = [];
    const h = caso.honorarios || {};
    const pct = h.percentual != null ? h.percentual : 0.10;
    const devido = (h.somaPedidosImprocedentes || 0) * pct;
    const apurado = Math.max(devido - (h.pago || 0), 0);
    const dataBase = h.dataBase || caso.dataDistribuicao;
    const indice = indiceCorrecaoIPCAE(dataBase, caso.dataDistribuicao, avisos);
    return { id: 'honorariosSucumbencia', descricao: 'HONORÁRIOS SUCUMBENCIAIS (RECLAMANTE)', natureza: 'indenizatoria',
      metodologia: `${(pct * 100).toFixed(0)}% sobre os pedidos improcedentes (R$ ${round(h.somaPedidosImprocedentes || 0)}), menos pago. Correção IPCA-E.`,
      memoriaMensal: [{ competencia: ym(dataBase), valorDevido: round(devido), pago: round(h.pago || 0),
        totalApurado: round(apurado), indiceCorrecao: round(indice, 6), corrigido: round(apurado * indice) }],
      principal: round(apurado), fgts: 0, valorCorrigido: round(apurado * indice), avisos: [...new Set(avisos)] };
  }

  const round = (n, c = 2) => { const f = Math.pow(10, c); return Math.round((Number(n) || 0) * f) / f; };

  global.FazAIMotor = {
    calcularAdicional, CONFIG_FAMILIA_A,
    calcularAuxilio, CONFIG_FAMILIA_C,
    calcularHE, CONFIG_FAMILIA_B,
    calcularINSS, calcularHonorarios,
    agregar,
    _base: { indiceCorrecaoIPCAE, fatorSelic, duDsr, salarioMinimo, inssDevido, competencias, ym, mkDate },
  };
  if (typeof module !== 'undefined') module.exports = global.FazAIMotor;
})(typeof window !== 'undefined' ? window : globalThis);
