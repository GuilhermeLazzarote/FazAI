/* FazAI ENGINE — port completo do v7 (browser + Node). Fórmulas vivas.
 * Motores: Evolução, HE 50/100/intervalo, Peric, Insal, Rescisórias,
 *          FGTS mensal, INSS empregado, INSS patronal (Súm.368), IRRF/RRA, Resumo B/C/D/E.
 * Uso Node:  const {buildWorkbook}=require('./fazai_engine.js'); const wb=buildWorkbook(params);
 * Uso browser: <script src="fazai_engine.js"></script> -> window.FazAIEngine.buildWorkbook(params)
 */
(function(root){
  "use strict";
  const XLSX = (typeof require!=="undefined") ? require("xlsx") : root.XLSX;
  // ---- tabelas embutidas ----
  const TAB = (typeof require!=="undefined") ? require("./_tabjs_module.js") : root._FAZAI_TAB;

  const F=f=>({f});
  const diasMes=(y,m)=>new Date(y,m,0).getDate();
  const domingos=(y,m)=>{let c=0,d=diasMes(y,m);for(let i=1;i<=d;i++)if(new Date(y,m-1,i).getDay()===0)c++;return c;};
  function listaComp(ini,fim){const o=[];let y=ini.y,m=ini.m;while(y<fim.y||(y===fim.y&&m<=fim.m)){o.push({y,m,k:`${y}-${String(m).padStart(2,"0")}`});m++;if(m>12){m=1;y++;}if(o.length>600)break;}return o;}
  function mkSheet(mat){const ws={};let mr=0,mc=0;mat.forEach((row,r)=>row.forEach((cell,c)=>{if(cell==null||cell==="")return;const a=XLSX.utils.encode_cell({r,c});if(typeof cell==="object"&&cell.f!=null){let ff=String(cell.f);if(ff.charAt(0)==="=")ff=ff.slice(1);if(ff!=="")ws[a]={t:"n",f:ff,v:""};}else if(typeof cell==="number")ws[a]={t:"n",v:cell};else ws[a]={t:"s",v:String(cell)};mr=Math.max(mr,r);mc=Math.max(mc,c);}));ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:mr,c:mc}});return ws;}

  function buildWorkbook(p){
    const C=listaComp(p.ini,p.fim), n=C.length, last=n-1;
    const dt={}; C.forEach(c=>dt[c.k]=diasMes(c.y,c.m)); if(p.diasBordaIni)dt[C[0].k]=p.diasBordaIni; if(p.diasBordaFim)dt[C[last].k]=p.diasBordaFim;
    const totd=Object.values(dt).reduce((a,b)=>a+b,0);
    const dist=t=>{const o={};C.forEach(c=>o[c.k]=Math.round((t||0)*dt[c.k]/totd*100)/100);return o;};
    const q50=dist(p.qHE50),qdom=dist(p.qDom),qint=dist(p.qInt);

    // ---- JORNADA: conta dias-da-semana trabalhados por competência (JS conta, Excel multiplica) ----
    const JOR=(p.jornada&&(p.jornada.he50||p.jornada.he100||p.jornada.art71))?p.jornada:null;
    function contaWd(i){
      const c=C[i], dim=diasMes(c.y,c.m); let sd=1, ed=dim;
      if(i===0 && p.diasBordaIni) sd=dim-p.diasBordaIni+1;
      if(i===last && p.diasBordaFim) ed=p.diasBordaFim;
      const cnt=[0,0,0,0,0,0,0];
      for(let d=sd;d<=ed;d++) cnt[new Date(c.y,c.m-1,d).getDay()]++;
      return cnt;
    }
    let jrRow = JOR ? (i=>i+3) : null; // linha excel da competência i na JORNADA (título+cabeçalho 1-2)
    const jrData = JOR ? (()=>{const JR=[["JORNADA — dias da semana trabalhados por competência (base das horas extras)"],
                ["Comp","Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]];
      C.forEach((c,i)=>JR.push([c.k,...contaWd(i)])); return JR;})() : null;
    // monta a fórmula de Qtd a partir da jornada do tipo: Σ he/dia × contagem do dia-da-semana
    // colunas JORNADA: Dom=B(wd0) Seg=C(wd1) Ter=D Qua=E Qui=F Sex=G Sáb=H(wd6)
    function qtdFormula(tipoMap,i){
      if(!JOR||!tipoMap) return null;
      const rj=jrRow(i), termos=[];
      for(let wd=0;wd<=6;wd++){const h=tipoMap[wd];if(h){const col=String.fromCharCode(66+wd);termos.push(`${h}*JORNADA!${col}${rj}`);}}
      return termos.length?termos.join("+"):"0";
    }
    const dataBaseRaw = p.dataBase || TAB.DATA_BASE;
    const idx = k => (TAB.T_IPCAE||{})[k];
    const dataBase = idx(dataBaseRaw) ? dataBaseRaw : TAB.DATA_BASE;   // clampa p/ última competência disponível
    const fatFn = p.fatorFn || ((y,m)=>{const k=`${y}-${String(m).padStart(2,"0")}`;const ic=idx(k),ib=idx(dataBase);return (ic&&ib)?ic/ib:1;});
    const wb=XLSX.utils.book_new();
    const R=i=>i+2;             // linha excel na TABELAS/EVOLUCAO
    const rh=i=>4+i;            // linha excel nos motores (dados começam na 4)

    // ---- TABELAS ---- A comp B SM C fator D SELIC  E..L INSS[f1,a1,f2,a2,f3,a3,teto,a4]
    const T=[["Comp","SM","Fator","SELIC","f1","a1","f2","a2","f3","a3","teto","a4"]];
    C.forEach(c=>{const inss=TAB.T_INSS[c.k]||[0,0,0,0,0,0,0,0];
      T.push([c.k, TAB.T_SM[c.k]||0, Math.round(fatFn(c.y,c.m)*1e6)/1e6, TAB.T_SELIC[c.k]||0, ...inss]);});
    XLSX.utils.book_append_sheet(wb,mkSheet(T),"TABELAS");
    const TIR=[["Comp"]]; C.forEach(c=>TIR.push([c.k,...(TAB.T_IRRF[c.k]||[])])); XLSX.utils.book_append_sheet(wb,mkSheet(TIR),"TAB_IRRF");

    // ---- PREMISSAS ----
    const PREM=[["salario_base",p.salarioBase],["vale_refeicao",p.valeRefeicao||0],["vr_integra_base",p.vrIntegra||"Sim"],
      ["divisor",p.divisor||220],["adic_he_50",p.adicHe50||0.5],["adic_he_100",p.adicHe100||1.0],["aplica_dsr_he",p.aplicaDsrHe||"Nao"],
      ["aplica_periculosidade",p.aplicaPeric||"Nao"],["pct_periculosidade",p.pctPeric||0.30],
      ["aplica_insalubridade",p.aplicaInsal||"Nao"],["grau_insalubridade",p.grauInsal||0.40],["base_insalubridade",p.baseInsal||"Salario Minimo"],
      ["aplica_cumulacao",p.aplicaCumulacao||"Sim"],["pct_fgts",p.pctFgts||0.08],["aplica_multa_fgts",p.aplicaMulta||"Sim"],["pct_multa_fgts",p.pctMulta||0.40],
      ["fgts_diferenca_salario",p.fgtsDiferencaSalario||"Nao"],
      ["aviso_dias",p.avisoDias||39],["aplica_correcao",p.aplicaCorrecao||"Sim"],["selic_pos_ajuiz",p.selicPos||0],
      ["pct_honorarios",p.pctHon||0.15],["inss_patronal",p.inssPatronal||0.23],["dependentes",p.dependentes||0],["irrf_meses_rra",p.irrfMeses||n]];
    const K={}; const PR=[["Parâmetro","Valor"]]; PREM.forEach(([k,v],i)=>{K[k]=i+2;PR.push([k,v]);});
    XLSX.utils.book_append_sheet(wb,mkSheet(PR),"PREMISSAS");
    const pp=k=>`PREMISSAS!$B$${K[k]}`;

    // ---- EVOLUCAO ----
    const EV=[["Comp","Sal.Base","VR","Peric","Insal","BASE CHEIA","Divisor","SAL-HORA"]];
    C.forEach((c,i)=>{const r=R(i);
      const ins=`IF(${pp("base_insalubridade")}="Salario Minimo",TABELAS!B${r},${pp("salario_base")})*${pp("grau_insalubridade")}`;
      EV.push([c.k,F(`=${pp("salario_base")}`),F(`=IF(${pp("vr_integra_base")}="Sim",${pp("vale_refeicao")},0)`),
        F(`=IF(${pp("aplica_periculosidade")}="Sim",${pp("salario_base")}*${pp("pct_periculosidade")},0)`),
        F(`=IF(${pp("aplica_insalubridade")}="Sim",IF(${pp("aplica_cumulacao")}="Sim",${ins},IF(${pp("aplica_periculosidade")}="Sim",0,${ins})),0)`),
        F(`=B${r}+C${r}+D${r}+E${r}`),F(`=${pp("divisor")}`),F(`=F${r}/G${r}`)]);});
    XLSX.utils.book_append_sheet(wb,mkSheet(EV),"EVOLUCAO");
    if(jrData) XLSX.utils.book_append_sheet(wb,mkSheet(jrData),"JORNADA");

    // ---- motor HE ----
    function motorHE(nome,adicKey,qtd,comRef,tipoMap){
      const M=[[nome],[],["Comp","Qtd","Sal-Hora","Adic","Devido","DSR","Aviso","13º","Férias","SUBTOTAL","Fator","CORRIGIDO","SELIC%","Juros","TOTAL"]];
      const r0=4;
      C.forEach((c,i)=>{const r=r0+i,er=R(i);let av="0",d13="0",fer="0";const pi=Math.max(0,i-12);
        if(comRef){
          if(i===last&&i>0)av=`AVERAGE(E${r0+pi}:E${r-1})*${pp("aviso_dias")}/30`;
          if(c.m===12||i===last){const rows=C.map((x,j)=>x.y===c.y?r0+j:null).filter(x=>x!=null);d13=`SUM(E${rows[0]}:E${rows[rows.length-1]})/12`;}
          if(((c.m===1&&i>=11)||i===last)&&i>0){const b=`AVERAGE(E${r0+pi}:E${r-1})*1.3333`;fer=(i===last)?`${b}*(1+1/12)`:b;}
        }
        const qtdCell = (JOR&&tipoMap) ? F(`=${qtdFormula(tipoMap,i)}`) : qtd[c.k];
        M.push([c.k,qtdCell,F(`=EVOLUCAO!H${er}`),F(`=${pp(adicKey)}`),F(`=B${r}*C${r}*(1+D${r})`),
          F(`=IF(${pp("aplica_dsr_he")}="Sim",E${r}/${diasMes(c.y,c.m)-domingos(c.y,c.m)}*${domingos(c.y,c.m)},0)`),
          F(`=${av}`),F(`=${d13}`),F(`=${fer}`),F(`=E${r}+F${r}+G${r}+H${r}+I${r}`),F(`=TABELAS!C${er}`),
          F(`=IF(${pp("aplica_correcao")}="Sim",J${r}*K${r},J${r})`),F(`=${pp("selic_pos_ajuiz")}`),F(`=L${r}*M${r}`),F(`=L${r}+N${r}`)]);
      });
      const tr=r0+n;
      M.push(["TOTAL","","","",F(`=SUM(E${r0}:E${r0+n-1})`),F(`=SUM(F${r0}:F${r0+n-1})`),F(`=SUM(G${r0}:G${r0+n-1})`),F(`=SUM(H${r0}:H${r0+n-1})`),F(`=SUM(I${r0}:I${r0+n-1})`),F(`=SUM(J${r0}:J${r0+n-1})`),"",F(`=SUM(L${r0}:L${r0+n-1})`),"",F(`=SUM(N${r0}:N${r0+n-1})`),F(`=SUM(O${r0}:O${r0+n-1})`)]);
      XLSX.utils.book_append_sheet(wb,mkSheet(M),nome);return tr;
    }
    const t50=motorHE("HE_50","adic_he_50",q50,true,JOR?JOR.he50:null), tdom=motorHE("HE_100_DOM","adic_he_100",qdom,true,JOR?JOR.he100:null), tint=motorHE("HE_ART71","adic_he_50",qint,false,JOR?JOR.art71:null);

    // ---- motor adicional (peric/insal) ----
    function motorAd(nome,baseFx,pctKey,aplicaKey){
      const M=[[nome],[],["Comp","Base","%/Grau","Valor Mês","Aviso","13º","Férias","SUBTOTAL","Fator","CORRIGIDO","SELIC%","Juros","TOTAL"]];
      const r0=4;
      C.forEach((c,i)=>{const r=r0+i,er=R(i);const prop=i===0?diasMes(c.y,c.m)/31:(i===last?23/31:1);
        let av="0",d13="0",fer="0";const pi=Math.max(0,i-12);
        if(i===last&&i>0)av=`AVERAGE(D${r0+pi}:D${r-1})*${pp("aviso_dias")}/30`;
        if(c.m===12||i===last){const rows=C.map((x,j)=>x.y===c.y?r0+j:null).filter(x=>x!=null);d13=`SUM(D${rows[0]}:D${rows[rows.length-1]})/12`;}
        if(((c.m===1&&i>=11)||i===last)&&i>0)fer=`AVERAGE(D${r0+pi}:D${r-1})*1.3333`;
        M.push([c.k,F(`=${baseFx(er)}`),F(`=${pp(pctKey)}`),F(`=IF(${pp(aplicaKey)}="Sim",B${r}*C${r}*${prop.toFixed(4)},0)`),
          F(`=${av}`),F(`=${d13}`),F(`=${fer}`),F(`=D${r}+E${r}+F${r}+G${r}`),F(`=TABELAS!C${er}`),
          F(`=IF(${pp("aplica_correcao")}="Sim",H${r}*I${r},H${r})`),F(`=${pp("selic_pos_ajuiz")}`),F(`=J${r}*K${r}`),F(`=J${r}+L${r}`)]);
      });
      const tr=r0+n;
      M.push(["TOTAL","","",F(`=SUM(D${r0}:D${r0+n-1})`),F(`=SUM(E${r0}:E${r0+n-1})`),F(`=SUM(F${r0}:F${r0+n-1})`),F(`=SUM(G${r0}:G${r0+n-1})`),F(`=SUM(H${r0}:H${r0+n-1})`),"",F(`=SUM(J${r0}:J${r0+n-1})`),"",F(`=SUM(L${r0}:L${r0+n-1})`),F(`=SUM(M${r0}:M${r0+n-1})`)]);
      XLSX.utils.book_append_sheet(wb,mkSheet(M),nome);return tr;
    }
    const tper=motorAd("PERICULOSIDADE",er=>`EVOLUCAO!B${er}`,"pct_periculosidade","aplica_periculosidade");
    const tins=motorAd("INSALUBRIDADE",er=>`IF(${pp("base_insalubridade")}="Salario Minimo",TABELAS!B${er},${pp("salario_base")})`,"grau_insalubridade","aplica_insalubridade");

    // ---- RESCISORIAS ----
    const brf=`EVOLUCAO!I${R(last)}`; // não existe col I em EVOLUCAO aqui; base rescisória = salário+VR
    const baseResc=`(${pp("salario_base")}+${pp("vale_refeicao")})`;
    const RS=[["RESCISÓRIAS"],[],["Verba","Valor"]];
    const Lr=[["Saldo de salário 24d",`=${pp("salario_base")}/30*24`],["Aviso 39d",`=${baseResc}/30*${pp("aviso_dias")}`],
      ["13º prop 2/12",`=${baseResc}/12*2`],["Férias prop 2/12 +1/3",`=${baseResc}/12*2*1.3333`],
      ["Férias vencidas 2(dobro)+1/3",`=${baseResc}*3*1.3333`],["13º vencidos 2",`=${baseResc}*2`]];
    Lr.forEach(([a,f])=>RS.push([a,F(f)]));
    const trs=RS.length+1; RS.push(["TOTAL",F(`=SUM(B4:B${trs-1})`)]);
    XLSX.utils.book_append_sheet(wb,mkSheet(RS),"RESCISORIAS");

    // ---- FGTS MENSAL ----
    const FG=[["FGTS MÊS A MÊS + MULTA 40%"],[],["Comp","Base Salarial","FGTS 8%","Fator","FGTS Corrigido"]];
    const r0f=4;
    C.forEach((c,i)=>{const r=r0f+i,er=R(i),h=rh(i);
      const base=`=IF(${pp("fgts_diferenca_salario")}="Sim",EVOLUCAO!B${er},0)+PERICULOSIDADE!D${h}+INSALUBRIDADE!D${h}+HE_50!E${h}+HE_100_DOM!E${h}+HE_50!G${h}+HE_50!H${h}+HE_100_DOM!G${h}+HE_100_DOM!H${h}+PERICULOSIDADE!E${h}+PERICULOSIDADE!F${h}+INSALUBRIDADE!E${h}+INSALUBRIDADE!F${h}`;
      FG.push([c.k,F(base),F(`=B${r}*${pp("pct_fgts")}`),F(`=TABELAS!C${er}`),F(`=IF(${pp("aplica_correcao")}="Sim",C${r}*D${r},C${r})`)]);
    });
    const dataLast=3+n, rResc=dataLast+1, tfg=dataLast+2, tmul=dataLast+3;
    FG.push(["FGTS s/ rescisórias (saldo+aviso+13)","",F(`=(RESCISORIAS!B4+RESCISORIAS!B5+RESCISORIAS!B6+RESCISORIAS!B9)*${pp("pct_fgts")}`),"",F(`=C${rResc}`)]);
    FG.push(["TOTAL FGTS","",F(`=SUM(C${r0f}:C${rResc})`),"",F(`=SUM(E${r0f}:E${rResc})`)]);
    FG.push(["MULTA 40%","","","",F(`=IF(${pp("aplica_multa_fgts")}="Sim",E${tfg}*${pp("pct_multa_fgts")},0)`)]);
    XLSX.utils.book_append_sheet(wb,mkSheet(FG),"FGTS_MENSAL");

    // ---- INSS RECLAMANTE (progressivo c/ teto, diferença) ----
    const prog=(B,er)=>`TABELAS!F${er}*MIN(${B},TABELAS!E${er})+TABELAS!H${er}*MAX(MIN(${B},TABELAS!G${er})-TABELAS!E${er},0)+TABELAS!J${er}*MAX(MIN(${B},TABELAS!I${er})-TABELAS!G${er},0)+TABELAS!L${er}*MAX(MIN(${B},TABELAS!K${er})-TABELAS!I${er},0)`;
    const IE=[["INSS RECLAMANTE (empregado)"],[],["Comp","Sal.Contrib","Verbas","Base Total","INSS Total","INSS Salário","DIFERENÇA"]];
    C.forEach((c,i)=>{const r=4+i,er=R(i),h=rh(i);
      IE.push([c.k,F(`=EVOLUCAO!B${er}+EVOLUCAO!D${er}+EVOLUCAO!E${er}`),F(`=HE_50!E${h}+HE_100_DOM!E${h}`),F(`=B${r}+C${r}`),
        F(`=${prog(`D${r}`,er)}`),F(`=${prog(`B${r}`,er)}`),F(`=MAX(E${r}-F${r},0)`)]);});
    const tie=4+n; IE.push(["TOTAL","","","","","",F(`=SUM(G4:G${4+n-1})`)]);
    XLSX.utils.book_append_sheet(wb,mkSheet(IE),"INSS_RECLAMANTE");

    // ---- INSS RECLAMADA (patronal + SELIC época própria Súm.368) ----
    const IR=[["INSS RECLAMADA (patronal + SELIC Súm.368)"],[],["Comp","Verbas","Alíquota","Patronal","SELIC Época","SELIC Dev.","TOTAL"]];
    C.forEach((c,i)=>{const r=4+i,er=R(i),h=rh(i);
      IR.push([c.k,F(`=HE_50!E${h}+HE_100_DOM!E${h}+PERICULOSIDADE!D${h}+INSALUBRIDADE!D${h}`),F(`=${pp("inss_patronal")}`),
        F(`=B${r}*C${r}`),F(`=TABELAS!D${er}`),F(`=D${r}*E${r}`),F(`=D${r}+F${r}`)]);});
    const tir2=4+n; IR.push(["TOTAL","","",F(`=SUM(D4:D${4+n-1})`),"",F(`=SUM(F4:F${4+n-1})`),F(`=SUM(G4:G${4+n-1})`)]);
    XLSX.utils.book_append_sheet(wb,mkSheet(IR),"INSS_RECLAMADA");

    // ---- IRRF/RRA ----
    const ib=TAB.T_IRRF[C[last].k];
    const IX=[["IRRF por RRA (férias indeniz./juros isentos — Súm.63 STJ)"],
      ["Base tributável",F(`=(HE_50!J${t50}-HE_50!I${t50})+(HE_100_DOM!J${tdom}-HE_100_DOM!I${tdom})+(PERICULOSIDADE!H${tper}-PERICULOSIDADE!G${tper})+(INSALUBRIDADE!H${tins}-INSALUBRIDADE!G${tins})+RESCISORIAS!B4+RESCISORIAS!B5+RESCISORIAS!B6+RESCISORIAS!B9-INSS_RECLAMANTE!G${tie}`)],
      ["Meses RRA",F(`=${pp("irrf_meses_rra")}`)],["Dependentes",F(`=${pp("dependentes")}`)],
      ["Base média mensal",F(`=B2/B3-B4*${ib[13]}`)],
      ["IRRF mensal",F(`=MAX(IF(B5<=${ib[0]},B5*${ib[1]}-${ib[2]},IF(B5<=${ib[3]},B5*${ib[4]}-${ib[5]},IF(B5<=${ib[6]},B5*${ib[7]}-${ib[8]},IF(B5<=${ib[9]},B5*${ib[10]}-${ib[11]},B5*${ib[10]}-${ib[11]})))),0)`)],
      ["IRRF TOTAL",F(`=B6*B3`)]];
    XLSX.utils.book_append_sheet(wb,mkSheet(IX),"IRRF_RRA");

    // ---- RESUMO B/C/D/E ----
    const selfac=`IF(${pp("aplica_correcao")}="Sim",${pp("selic_pos_ajuiz")},0)`;
    const fatr=`IF(${pp("aplica_correcao")}="Sim",TABELAS!C${R(last)},1)`;
    const RZ=[[`RESUMO ANALÍTICO — ${p.reclamante||""} · ${p.processo||""}`],[],["Verba / Reflexo","Principal","Correção","SELIC","TOTAL"]];
    const sub=[]; const push=row=>{RZ.push(row);return RZ.length;};
    function blocoHE(t,tot,sh){push([t,"","","",""]);push(["  Principal",F(`=${sh}!E${tot}`),"","",""]);push(["  Reflexo 13º",F(`=${sh}!H${tot}`),"","",""]);push(["  Reflexo Férias+1/3",F(`=${sh}!I${tot}`),"","",""]);push(["  Reflexo Aviso",F(`=${sh}!G${tot}`),"","",""]);push(["  Reflexo DSR",F(`=${sh}!F${tot}`),"","",""]);sub.push(push(["  → SUBTOTAL",F(`=${sh}!J${tot}`),F(`=${sh}!L${tot}-${sh}!J${tot}`),F(`=${sh}!O${tot}-${sh}!L${tot}`),F(`=${sh}!O${tot}`)]));}
    function blocoAd(t,tot,sh){push([t,"","","",""]);push(["  Principal",F(`=${sh}!D${tot}`),"","",""]);push(["  Reflexo 13º",F(`=${sh}!F${tot}`),"","",""]);push(["  Reflexo Férias+1/3",F(`=${sh}!G${tot}`),"","",""]);push(["  Reflexo Aviso",F(`=${sh}!E${tot}`),"","",""]);sub.push(push(["  → SUBTOTAL",F(`=${sh}!H${tot}`),F(`=${sh}!J${tot}-${sh}!H${tot}`),F(`=${sh}!M${tot}-${sh}!J${tot}`),F(`=${sh}!M${tot}`)]));}
    blocoHE("HORAS EXTRAS 50%",t50,"HE_50"); blocoHE("DOMINGOS 100%",tdom,"HE_100_DOM");
    push(["INTERVALO ART.71 (indenizatório)","","","",""]);push(["  Principal (sem reflexos)",F(`=HE_ART71!E${tint}`),"","",""]);
    sub.push(push(["  → SUBTOTAL",F(`=HE_ART71!J${tint}`),F(`=HE_ART71!L${tint}-HE_ART71!J${tint}`),F(`=HE_ART71!O${tint}-HE_ART71!L${tint}`),F(`=HE_ART71!O${tint}`)]));
    blocoAd("PERICULOSIDADE",tper,"PERICULOSIDADE"); blocoAd("INSALUBRIDADE",tins,"INSALUBRIDADE");
    push(["VERBAS RESCISÓRIAS","","","",""]);
    ["Saldo de salário","Aviso prévio indenizado","13º proporcional","Férias proporcionais +1/3","Férias vencidas (dobro)+1/3","13º vencidos"].forEach((nm,j)=>push(["  "+nm,F(`=RESCISORIAS!B${4+j}`),"","",""]));
    const rc=`RESCISORIAS!B${trs}`; sub.push(push(["  → SUBTOTAL",F(`=${rc}`),F(`=${rc}*${fatr}-${rc}`),F(`=${rc}*${fatr}*${selfac}`),F(`=${rc}*${fatr}*(1+${selfac})`)]));
    const fh=`FGTS_MENSAL!C${tfg}`,fi=`FGTS_MENSAL!E${tfg}`;
    sub.push(push(["FGTS 8% (mês a mês)",F(`=${fh}`),F(`=${fi}-${fh}`),F(`=${fi}*${selfac}`),F(`=${fi}*(1+${selfac})`)]));
    const mh=`IF(${pp("aplica_multa_fgts")}="Sim",${fh}*${pp("pct_multa_fgts")},0)`,mi=`FGTS_MENSAL!E${tmul}`;
    sub.push(push(["MULTA 40% FGTS",F(`=${mh}`),F(`=${mi}-${mh}`),F(`=${mi}*${selfac}`),F(`=${mi}*(1+${selfac})`)]));
    if(p.aplicaSeguro!=="Nao"){const sg=(p.parcelasSeguro||5)+"*"+"MIN(1711.01+MAX("+pp("salario_base")+"-2138.76,0)*0.5,2424.11)";
      sub.push(push(["SEGURO-DESEMPREGO",F(`=${sg}`),F(`=(${sg})*${fatr}-(${sg})`),F(`=(${sg})*${fatr}*${selfac}`),F(`=(${sg})*${fatr}*(1+${selfac})`)]));}
    if(p.danoMoral){const dh=`${p.danoMoral}`;sub.push(push(["DANO MORAL (correção + juros)",F(`=${dh}`),F(`=${dh}*${fatr}-${dh}`),F(`=${dh}*${fatr}*${selfac}`),F(`=${dh}*${fatr}*(1+${selfac})`)]));}
    // verbas complementares (extraídas/apuradas pela IA — o motor não cobre; passam nominais + correção)
    (p.verbasIA||[]).forEach(v=>{const val=v.valor||0; if(!val)return;
      sub.push(push([(v.descricao||"Verba complementar")+" (IA)",F(`=${val}`),F(`=${val}*${fatr}-${val}`),F(`=${val}*${fatr}*${selfac}`),F(`=${val}*${fatr}*(1+${selfac})`)]));});
    const B=sub.map(r=>`B${r}`).join("+"),Cc=sub.map(r=>`C${r}`).join("+"),D=sub.map(r=>`D${r}`).join("+"),E=sub.map(r=>`E${r}`).join("+");
    const s=push(["SUBTOTAL CRÉDITO",F(`=${B}`),F(`=${Cc}`),F(`=${D}`),F(`=${E}`)]);
    const hon=push(["Honorários",F(""),"","",F(`=E${s}*${pp("pct_honorarios")}`)]);
    const inr=push(["INSS Reclamada + SELIC (Súm.368)","","","",F(`=INSS_RECLAMADA!G${tir2}`)]);
    push(["TOTAL DA EXECUÇÃO (crédito + honorários + INSS reclamada)","","","",F(`=E${s}+E${hon}+E${inr}`)]);
    push(["",""]);
    const d1=push(["(−) INSS Reclamante","","","",F(`=INSS_RECLAMANTE!G${tie}`)]);
    const d2=push(["(−) IRRF/RRA","","","",F(`=IRRF_RRA!B7`)]);
    push(["LÍQUIDO DO AUTOR (crédito − INSS empregado − IRRF)","","","",F(`=E${s}-E${d1}-E${d2}`)]);
    XLSX.utils.book_append_sheet(wb,mkSheet(RZ),"RESUMO");

    // ---- FORMATAÇÃO (SheetJS free: número + largura; sem negrito/cor) ----
    const MONEY='"R$" #,##0.00;[Red]-"R$" #,##0.00';
    const moneyCols={ // colunas de VALOR por aba (0-based); demais ficam sem moeda (comp/qtd/%/fator/selic%)
      RESUMO:[1,2,3,4], EVOLUCAO:[1,2,3,4,5,7],
      HE_50:[2,4,5,6,7,8,9,11,13,14], HE_100_DOM:[2,4,5,6,7,8,9,11,13,14], HE_ART71:[2,4,5,6,7,8,9,11,13,14],
      PERICULOSIDADE:[1,3,4,5,6,7,9,11,12], INSALUBRIDADE:[1,3,4,5,6,7,9,11,12],
      RESCISORIAS:[1], FGTS_MENSAL:[1,2,4], SEGURO:[1],
      INSS_RECLAMANTE:[1,2,3,4,5,6], INSS_RECLAMADA:[1,3,5,6], IRRF_RRA:[1] };
    Object.keys(wb.Sheets).forEach(name=>{
      const ws=wb.Sheets[name]; if(!ws['!ref'])return;
      const ref=XLSX.utils.decode_range(ws['!ref']);
      const mc=new Set(moneyCols[name]||[]);
      const widths=[];
      for(let c=ref.s.c;c<=ref.e.c;c++){
        let w=9;
        for(let r=ref.s.r;r<=ref.e.r;r++){
          const cell=ws[XLSX.utils.encode_cell({r,c})]; if(!cell)continue;
          if(mc.has(c) && (cell.f!=null || typeof cell.v==="number")) cell.z=MONEY;
          const txt=String(cell.v!==undefined&&cell.v!==""?cell.v:(cell.f||""));
          w=Math.min(Math.max(w, txt.length+ (mc.has(c)?4:2)), 46);
        }
        widths.push({wch: mc.has(c)?Math.max(w,14):w});
      }
      ws['!cols']=widths;
    });
    wb.Workbook={CalcPr:{fullCalcOnLoad:true}};
    wb.SheetNames=["RESUMO","EVOLUCAO","JORNADA","HE_50","HE_100_DOM","HE_ART71","PERICULOSIDADE","INSALUBRIDADE","RESCISORIAS","FGTS_MENSAL","INSS_RECLAMANTE","INSS_RECLAMADA","IRRF_RRA","PREMISSAS","TABELAS","TAB_IRRF"].filter(n=>wb.Sheets[n]);
    return wb;
  }

  const api={buildWorkbook};
  if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.FazAIEngine=api;
})(typeof window!=="undefined"?window:this);
