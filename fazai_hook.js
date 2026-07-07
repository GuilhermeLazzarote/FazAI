/* FazAI — HOOK de export FORMULADO (v2)
 * Lê o objeto `caso` que o app já monta (window._fazaiCasoAtual) — params LIMPOS,
 * sem heurística. Gera o Excel v7 com FÓRMULAS VIVAS via fazai_engine.js.
 * Caminho SEPARADO: NÃO toca no fazai_motor.js (que segue mandando na tela).
 * Botão: onclick="exportLiquidaXLSXFormulado()"
 */
(function(){
  "use strict";
  const num=x=>{const n=parseFloat(x);return isNaN(n)?0:n;};
  const ymOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

  function casoToParams(caso){
    const ini={y:caso.dataAdmissao.getFullYear(), m:caso.dataAdmissao.getMonth()+1};
    const fim={y:caso.dataDemissao.getFullYear(),  m:caso.dataDemissao.getMonth()+1};
    const dataBase = caso.dataAtualizacao ? ymOf(caso.dataAtualizacao) : undefined;
    const salVals=Object.entries(caso.salariosMensais||{}).sort();
    const salarioBase = salVals.length ? num(salVals[0][1]) : 0;
    const sumH=id=>{const o=(caso.qtdHoras||{})[id]; return o?Object.values(o).reduce((s,x)=>s+num(x),0):0;};
    const va=caso.verbasAtivas||[], has=id=>va.indexOf(id)>=0, ov=caso.overrides||{};
    const T=window._FAZAI_TAB||{}; let selicPos=0;
    if(caso.dataDistribuicao && T.T_SELIC){ selicPos = num(T.T_SELIC[ymOf(caso.dataDistribuicao)]); }
    const diasNoMes=(y,m)=>new Date(y,m,0).getDate();
    const diasBordaIni = diasNoMes(ini.y,ini.m) - caso.dataAdmissao.getDate() + 1;
    const diasBordaFim = caso.dataDemissao.getDate();
    return {
      reclamante:caso.reclamante||"", reclamada:caso.reclamada||"", processo:caso.numeroProcesso||"",
      ini, fim, dataBase, diasBordaIni, diasBordaFim,
      salarioBase, valeRefeicao:num((caso.auxiliosPadrao||{}).vr), vrIntegra: has("vr")?"Sim":"Nao",
      divisor:num(caso.divisor)||220,
      aplicaDsrHe: caso.dsrCompoeBaseReflexos?"Sim":"Nao",
      aplicaPeric: has("periculosidade")?"Sim":"Nao", pctPeric:num((ov.periculosidade||{}).percentual)||0.30,
      aplicaInsal: has("insalubridade")?"Sim":"Nao", grauInsal:num((ov.insalubridade||{}).percentual)||0.40,
      baseInsal:"Salario Minimo", aplicaCumulacao:(has("periculosidade")&&has("insalubridade"))?"Sim":"Nao",
      avisoDias:39, aplicaCorrecao:"Sim", selicPos,
      pctHon:(caso.honorarios&&caso.honorarios.percentual)?num(caso.honorarios.percentual)/100:0.15,
      inssPatronal:0.23, pctFgts:0.08, aplicaMulta:"Sim", pctMulta:0.40,
      fgtsDiferencaSalario: caso.fgtsDiferencaSalario || "Nao",
      qHE50:sumH("heTotais"), qDom:sumH("he100"), qInt:sumH("heArt71"),
      jornada: caso.jornada || null,   // {he50:{wd:h},he100:{wd:h},art71:{wd:h}} — dias 0=dom..6=sáb
      danoMoral:0,
      verbasIA:(caso.verbasIA||[]).map(v=>({descricao:v.descricao||"Verba complementar",
        valor: v.formato==="mensal" ? (v.memoria||[]).reduce((s,m)=>s+num(m.valorDevido),0) : num(v.valor)})),
      _semSalario:salarioBase===0, _semHoras:(sumH("heTotais")+sumH("he100")+sumH("heArt71"))===0
    };
  }

  window.exportLiquidaXLSXFormulado=function(){
    if(!window.FazAIEngine){alert("Motor de fórmulas não carregado (inclua fazai_tabelas.js e fazai_engine.js).");return;}
    const caso=window._fazaiCasoAtual;
    if(!caso){alert("Rode a liquidação primeiro (não há cálculo em memória).");return;}
    const p=casoToParams(caso);
    if(p._semSalario) console.warn("[FazAI] salário base 0 — fórmulas vão zerar.");
    if(p._semHoras)   console.warn("[FazAI] nenhuma hora no caso — confira as verbas de HE.");
    console.log("[FazAI] params p/ Excel formulado:",p);
    const wb=window.FazAIEngine.buildWorkbook(p);
    const nome=(p.reclamante||"calculo").replace(/[^\wÀ-ÿ]+/g,"_");
    XLSX.writeFile(wb,"Calculo_"+nome+".xlsx");
  };
  window.FazAI_casoToParams=casoToParams;
})();
