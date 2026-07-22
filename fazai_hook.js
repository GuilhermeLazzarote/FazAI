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

    // --- RESCISÓRIAS: cálculos corretos a partir das datas ---
    const adm=caso.dataAdmissao, dem=caso.dataDemissao;
    // (1) Saldo de salário = dias trabalhados no mês da demissão
    const diasSaldo = dem.getDate();
    // (4) Aviso prévio proporcional: 30 dias + 3 por ano completo de casa (Lei 12.506), teto 90
    const anosCasa = Math.floor((dem - adm)/(365.25*24*3600*1000));
    const avisoDias = Math.min(30 + 3*anosCasa, 90);
    // (2) Avos proporcionais de 13º e férias: meses com >=15 dias trabalhados
    //     13º conta no ano da demissão; férias contam no período aquisitivo em curso.
    const avos13 = (function(){
      let m = dem.getDate()>=15 ? dem.getMonth()+1 : dem.getMonth(); // meses jan..demissão
      // se admitido no mesmo ano, começa do mês de admissão
      if(adm.getFullYear()===dem.getFullYear()){
        const inicioAvo = adm.getDate()<=15 ? adm.getMonth()+1 : adm.getMonth()+2;
        m = (dem.getDate()>=15 ? dem.getMonth()+1 : dem.getMonth()) - inicioAvo + 1;
      }
      return Math.max(0, Math.min(12, m));
    })();
    // férias proporcionais: avos desde o último aniversário de admissão
    const avosFerias = (function(){
      const ultAniv = new Date(dem.getFullYear(), adm.getMonth(), adm.getDate());
      const base = ultAniv>dem ? new Date(dem.getFullYear()-1, adm.getMonth(), adm.getDate()) : ultAniv;
      let meses = (dem.getFullYear()-base.getFullYear())*12 + (dem.getMonth()-base.getMonth());
      if(dem.getDate()>=15) meses+=1; // fração >=15 dias conta
      return Math.max(0, Math.min(12, meses));
    })();
    // (3) férias vencidas: só se houver pedido explícito; nunca em dobro automático
    const temFeriasVencidas = has("feriasVencidas") || has("ferias_vencidas");
    // (5) adicional noturno como verba própria só se pedido
    const temAdicNoturno = has("adicionalNoturno") || has("adic_noturno");
    return {
      reclamante:caso.reclamante||"", reclamada:caso.reclamada||"", processo:caso.numeroProcesso||"",
      ini, fim, dataBase, diasBordaIni, diasBordaFim,
      diasSaldo, avosFerias, avos13, temFeriasVencidas, temAdicNoturno,
      salarioBase, valeRefeicao:num((caso.auxiliosPadrao||{}).vr), vrIntegra: has("vr")?"Sim":"Nao",
      divisor:num(caso.divisor)||220,
      aplicaDsrHe: caso.dsrCompoeBaseReflexos?"Sim":"Nao",
      aplicaPeric: has("periculosidade")?"Sim":"Nao", pctPeric:num((ov.periculosidade||{}).percentual)||0.30,
      aplicaInsal: has("insalubridade")?"Sim":"Nao", grauInsal:num((ov.insalubridade||{}).percentual)||0.40,
      baseInsal:"Salario Minimo", aplicaCumulacao:(has("periculosidade")&&has("insalubridade"))?"Sim":"Nao",
      avisoDias, aplicaCorrecao:"Sim", selicPos,
      ajuizamento: caso.dataDistribuicao ? ymOf(caso.dataDistribuicao) : undefined,
      pctHon:(caso.honorarios&&caso.honorarios.percentual)?num(caso.honorarios.percentual)/100:0.15,
      inssPatronal:0.23, pctFgts:0.08, aplicaMulta:"Sim", pctMulta:0.40,
      fgtsDiferencaSalario: caso.fgtsDiferencaSalario || "Nao",
      qHE50:sumH("heTotais"), qDom:sumH("he100"), qInt:sumH("heArt71"),
      jornada: caso.jornada && caso.jornada.dias ? caso.jornada : null,   // {dias:{0..6:{entrada,saida,interv,base,tipo}}}
      danoMoral:0,
      verbasIA:(caso.verbasIA||[]).map(v=>({descricao:v.descricao||"Verba complementar",
        valor: v.formato==="mensal" ? (v.memoria||[]).reduce((s,m)=>s+num(m.valorDevido),0) : num(v.valor)})),
      _semSalario:salarioBase===0, _semHoras:(sumH("heTotais")+sumH("he100")+sumH("heArt71"))===0
    };
  }

  window.exportLiquidaXLSXFormulado=async function(){
    if(!window.FazAIEngine){alert("Motor de fórmulas não carregado (inclua fazai_tabelas.js e fazai_engine.js).");return;}
    const caso=window._fazaiCasoAtual;
    if(!caso){alert("Rode a liquidação primeiro (não há cálculo em memória).");return;}
    const p=casoToParams(caso);
    if(p._semSalario) console.warn("[FazAI] salário base 0 — fórmulas vão zerar.");
    if(p._semHoras)   console.warn("[FazAI] nenhuma hora no caso — confira as verbas de HE.");
    console.log("[FazAI] params p/ Excel formulado:",p);
    const wb=window.FazAIEngine.buildWorkbook(p);
    const nome=(p.reclamante||"calculo").replace(/[^\wÀ-ÿ]+/g,"_");
    // gera buffer (SheetJS) e aplica estilo PJe-Calc (exceljs), se disponível
    try{
      if(window.ExcelJS && window.aplicarEstiloPjeCalc){
        const buf=XLSX.write(wb,{type:"array",bookType:"xlsx"});
        const styled=await window.aplicarEstiloPjeCalc(buf,window.ExcelJS);
        const blob=new Blob([styled],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        const url=URL.createObjectURL(blob), a=document.createElement("a");
        a.href=url; a.download="Calculo_"+nome+".xlsx"; a.click(); URL.revokeObjectURL(url);
        return;
      }
    }catch(e){
      console.warn("[FazAI] estilo PJe-Calc falhou, baixando sem estilo:",e);
      alert("Aviso: não foi possível aplicar o layout PJe-Calc. O arquivo será baixado sem formatação, mas com os cálculos corretos.");
    }
    try{
      XLSX.writeFile(wb,"Calculo_"+nome+".xlsx"); // fallback sem estilo
    }catch(err){
      console.error("[FazAI] falha ao gerar Excel:",err);
      alert("Erro ao gerar o Excel. Recarregue a página e rode a liquidação novamente. Se persistir, avise o suporte.");
    }
  };
  window.FazAI_casoToParams=casoToParams;
})();
