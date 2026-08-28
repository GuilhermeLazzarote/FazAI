/* ============================================================
   FazAI — Leitor de arquivo .PJC (export do PJe-Calc)
   ------------------------------------------------------------
   O .PJC é um ZIP com um único XML (ISO-8859-1) contendo o
   cálculo inteiro: parâmetros, verbas, ocorrências mês a mês,
   cartão de ponto dia a dia, FGTS, INSS, honorários.

   Por que importa: lendo o .PJC não há leitura de PDF por IA —
   a extração passa a ser exata e de custo zero. A IA só entra
   no confronto com o que foi deferido.
   ============================================================ */
(function(){
'use strict';

/* ---------- ZIP: lê pela central directory (sem biblioteca) ---------- */
function u16(d,o){ return d[o]|(d[o+1]<<8); }
function u32(d,o){ return (d[o]|(d[o+1]<<8)|(d[o+2]<<16)|(d[o+3]<<24))>>>0; }

function acharEOCD(d){
  for(let i=d.length-22;i>=0 && i>d.length-66000;i--)
    if(d[i]===0x50&&d[i+1]===0x4b&&d[i+2]===0x05&&d[i+3]===0x06) return i;
  return -1;
}
function entradasZip(d){
  const eocd=acharEOCD(d);
  if(eocd<0) throw new Error('arquivo .PJC inválido: não parece um ZIP.');
  const n=u16(d,eocd+10), ini=u32(d,eocd+16);
  const out=[]; let p=ini;
  for(let i=0;i<n;i++){
    if(u32(d,p)!==0x02014b50) break;
    const metodo=u16(d,p+10), tam=u32(d,p+20), tamOrig=u32(d,p+24);
    const nl=u16(d,p+28), el=u16(d,p+30), cl=u16(d,p+32), off=u32(d,p+42);
    const nome=new TextDecoder('utf-8').decode(d.slice(p+46,p+46+nl));
    out.push({nome,metodo,tam,tamOrig,off});
    p+=46+nl+el+cl;
  }
  return out;
}
async function inflar(bytes, metodo){
  if(metodo===0) return bytes;
  if(metodo!==8) throw new Error('compressão não suportada no .PJC (método '+metodo+').');
  if(typeof DecompressionStream==='undefined')
    throw new Error('este navegador não descompacta o .PJC — use Chrome, Edge ou Safari atualizados.');
  const ds=new DecompressionStream('deflate-raw');
  const buf=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}
async function extrairXml(arrayBuffer, comNome){
  const d=new Uint8Array(arrayBuffer);
  const ents=entradasZip(d);
  if(!ents.length) throw new Error('o .PJC está vazio.');
  const e=ents[0];
  // cabeçalho local: nome e extra podem ter tamanhos próprios
  if(u32(d,e.off)!==0x04034b50) throw new Error('cabeçalho do .PJC corrompido.');
  const nl=u16(d,e.off+26), el=u16(d,e.off+28);
  const ini=e.off+30+nl+el;
  const bruto=d.slice(ini, ini+(e.tam||d.length-ini));
  const puro=await inflar(bruto, e.metodo);
  const txt=new TextDecoder('iso-8859-1').decode(puro);
  return comNome?{xml:txt, nome:e.nome}:txt;
}

/* ---------- utilidades ---------- */
const T=(e,tag)=>{ if(!e) return null; const c=e.querySelector(':scope > '+tag); return c?(c.textContent||'').trim():null; };
function nulo(v){ return v==null||v===''||v==='null'; }
function n(v){ if(nulo(v)) return null; const x=parseFloat(String(v).replace(',','.')); return isNaN(x)?null:x; }
function data(v){
  if(nulo(v)) return null;
  const ms=parseInt(v,10); if(isNaN(ms)) return null;
  const d=new Date(ms);
  const p=x=>String(x).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
}
function moeda(x){ return x==null?null:Math.round(x*100)/100; }

/* ============================================================
   FERIADOS — calendario nacional (fixos + moveis pela Pascoa).
   Estadual e municipal variam por comarca: quando o usuario nao
   informa, dizemos isso na propria saida em vez de fingir que
   cobrimos tudo.
   ============================================================ */
function pascoa(ano){
  const a=ano%19, b=Math.floor(ano/100), c=ano%100;
  const d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4;
  const l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const mes=Math.floor((h+l-7*m+114)/31), dia=((h+l-7*m+114)%31)+1;
  return new Date(Date.UTC(ano,mes-1,dia));
}
function iso(d){ return d.toISOString().slice(0,10); }
function feriadosNacionais(anoIni,anoFim){
  const out={};
  for(var y=anoIni;y<=anoFim;y++){
    [['01-01','Confraternização Universal'],['04-21','Tiradentes'],['05-01','Dia do Trabalho'],
     ['09-07','Independência'],['10-12','N. Sra. Aparecida'],['11-02','Finados'],
     ['11-15','Proclamação da República'],['11-20','Consciência Negra'],['12-25','Natal']
    ].forEach(function(f){ out[y+'-'+f[0]]=f[1]; });
    const p=pascoa(y), dia=86400000;
    out[iso(new Date(+p-48*dia))]='Carnaval';
    out[iso(new Date(+p-47*dia))]='Carnaval';
    out[iso(new Date(+p-2*dia))]='Sexta-feira Santa';
    out[iso(new Date(+p+60*dia))]='Corpus Christi';
  }
  return out;
}

/* ============================================================
   JORNADA LANCADA — padrao por dia da semana, aderencia e mes a mes.
   A aderencia responde a pergunta que decide a impugnacao:
   "o cara lancou o cartao de ponto, ou repetiu o mesmo horario?"
   ============================================================ */
const DIA_SEMANA=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
function montarJornadaDetalhada(j, dias){
  const L=[];
  dias.forEach(function(d){
    const ms=T(d,'dataOcorrencia'); if(!ms) return;
    const dt=new Date(parseInt(ms,10));
    L.push({
      iso:iso(dt), dow:dt.getUTCDay(),
      marca:String(T(d,'frequenciaDiaria')||'').replace(/\s+/g,' ').trim(),
      ht:n(T(d,'horasTrabalhadas'))||0, he:n(T(d,'horasExtrasDiaria'))||0,
      hn:n(T(d,'horasNoturnas'))||0, hfer:n(T(d,'horasFeriado'))||0
    });
  });
  L.sort(function(a,b){ return a.iso<b.iso?-1:1; });
  if(!L.length) return;
  j.inicio=L[0].iso; j.fim=L[L.length-1].iso;
  const comLabor=L.filter(function(x){ return x.ht>0; });
  j.diasComLabor=comLabor.length;
  j.primeiroDiaComHoras=comLabor.length?comLabor[0].iso:null;
  j.ultimoDiaComHoras=comLabor.length?comLabor[comLabor.length-1].iso:null;

  /* padrão por dia da semana */
  const porDow={};
  comLabor.forEach(function(x){
    const b=porDow[x.dow]||(porDow[x.dow]={dia:x.dow,nome:DIA_SEMANA[x.dow],total:0,cont:{}});
    b.total++; b.cont[x.marca]=(b.cont[x.marca]||0)+1;
  });
  j.porDiaSemana=Object.keys(porDow).map(function(k){
    const b=porDow[k];
    const chaves=Object.keys(b.cont).sort(function(p,q){ return b.cont[q]-b.cont[p]; });
    return { dia:b.dia, nome:b.nome, diasComLabor:b.total,
             marcacaoModal:chaves[0]||'', repeticoes:b.cont[chaves[0]]||0,
             variantes:chaves.length,
             aderencia:b.total?Math.round((b.cont[chaves[0]]/b.total)*1000)/1000:0 };
  }).sort(function(a,b){ return a.dia-b.dia; });
  const somaDias=j.porDiaSemana.reduce(function(a,b){ return a+b.diasComLabor; },0);
  const somaMod=j.porDiaSemana.reduce(function(a,b){ return a+b.repeticoes; },0);
  j.repetitividade = somaDias?Math.round((somaMod/somaDias)*1000)/1000:0;
  j.variantesDistintas = j.porDiaSemana.reduce(function(a,b){ return a+b.variantes; },0);
  /* britânica: 20+ dias e praticamente sempre o mesmo horário no mesmo dia da semana */
  j.britanica = comLabor.length>=20 && j.repetitividade>=0.9;

  /* mês a mês */
  const mm={};
  L.forEach(function(x){
    const k=x.iso.slice(0,7);
    const b=mm[k]||(mm[k]={mes:k,dias:0,diasComLabor:0,horas:0,he:0,hn:0});
    b.dias++; if(x.ht>0) b.diasComLabor++;
    b.horas+=x.ht; b.he+=x.he; b.hn+=x.hn;
  });
  j.porMes=Object.keys(mm).sort().map(function(k){
    const b=mm[k];
    return {mes:k,dias:b.dias,diasComLabor:b.diasComLabor,
      horas:Math.round(b.horas*100)/100, he:Math.round(b.he*100)/100, hn:Math.round(b.hn*100)/100};
  });

  /* feriados nacionais com jornada lançada */
  const y1=parseInt(j.inicio.slice(0,4),10), y2=parseInt(j.fim.slice(0,4),10);
  const FER=feriadosNacionais(y1,y2);
  j.feriadosComJornada=comLabor.filter(function(x){ return FER[x.iso]; })
    .map(function(x){ return {data:x.iso, nome:FER[x.iso], dia:DIA_SEMANA[x.dow], horas:x.ht, he:x.he}; });
  j.heEmFeriado=Math.round(j.feriadosComJornada.reduce(function(a,b){ return a+b.he; },0)*100)/100;
  j.observacaoFeriados='calendário nacional (fixos + móveis). Feriados estaduais e municipais não entram nesta conferência.';
}


/* ---------- classificação da verba ---------- */
const CARAC={DECIMO_TERCEIRO_SALARIO:'outro',FERIAS:'outro',AVISO_PREVIO:'outro',SALDO_SALARIO:'outro'};
function classificar(nome, caracteristica, multiplicador){
  // em reflexo ("13º SOBRE HORAS EXTRAS"), o que classifica é a parte ANTES de SOBRE
  const base=String(nome||'').split(/\s+SOBRE\s+/i)[0];
  if(CARAC[caracteristica]) return {motorId:CARAC[caracteristica],subtipo:null};
  const s=base.toLowerCase();
  if(/interjornada|inter\s*jornada|art\.?\s*66/.test(s)) return {motorId:'heArt71',subtipo:'interjornada'};
  if(/intrajornada|intra\s*jornada|intervalo.*(refei|almo)|art\.?\s*71/.test(s)) return {motorId:'heArt71',subtipo:'intrajornada'};
  if(/art\.?\s*384/.test(s)) return {motorId:'heArt71',subtipo:'art384'};
  if(/art\.?\s*253/.test(s)) return {motorId:'heArt71',subtipo:'indefinido'};
  if(/intervalo/.test(s)) return {motorId:'heArt71',subtipo:'indefinido'};
  if(/noturn/.test(s)) return {motorId:'adicionalNoturno',subtipo:null};
  if(/periculosidade/.test(s)) return {motorId:'periculosidade',subtipo:null};
  if(/insalubridade/.test(s)) return {motorId:'insalubridade',subtipo:null};
  if(/vale.?(refei|aliment)|\bvr\b|\bva\b/.test(s)) return {motorId:'vr',subtipo:null};
  if(/hora.?s?\s*extra|sobrejornada/.test(s)) return {motorId:(multiplicador&&multiplicador>=2)?'he100':'heTotais',subtipo:null};
  if(/domingo|feriado|repouso|dsr|rsr|folga/.test(s)) return {motorId:'he100',subtipo:null};
  if(/f[ée]rias/.test(s) && /vencid|dobr/.test(s)) return {motorId:'feriasVencidas',subtipo:null};
  return {motorId:'outro',subtipo:null};
}

/* ---------- índices e juros em linguagem de peça ---------- */
const IDX={IPCAE:'IPCA-E',IPCA:'IPCA',SELIC:'SELIC',TR:'TR',TRD:'TRD',INPC:'INPC',SEM_CORRECAO:'sem correção'};
const JUR={TRD_SIMPLES:'TRD simples (art. 39 da Lei 8.177/91)',JUROS_1_AO_MES:'1% ao mês',SELIC:'SELIC',SEM_JUROS:'sem juros'};
const rot=(m,v)=>nulo(v)?null:(m[v]||v);

/* ---------- parser principal ---------- */
function parse(xmlText){
  const doc=new DOMParser().parseFromString(xmlText,'text/xml');
  const err=doc.querySelector('parsererror');
  if(err) throw new Error('não consegui ler o XML do .PJC.');
  const raiz=doc.documentElement;
  if(raiz.tagName!=='Calculo') throw new Error('o arquivo não é um cálculo do PJe-Calc (raiz: '+raiz.tagName+').');

  /* índice de nós por id, para resolver <internalRef> */
  const porId={};
  ['Calculada','Reflexo','Informada'].forEach(tag=>{
    doc.querySelectorAll(tag).forEach(e=>{
      const id=T(e,'id'); const nm=T(e,'nome');
      if(id&&nm&&!porId[id]) porId[id]=e;
    });
  });
  function resolver(e){
    if(T(e,'nome')) return e;
    const ref=T(e,'internalRef')||(e.tagName==='internalRef'?(e.textContent||'').trim():null);
    return ref&&porId[ref]?porId[ref]:null;
  }

  /* -------- processo -------- */
  const pid=raiz.querySelector('processo > Processo > identificador > IdentificadorDoProcesso');
  const numero=pid?[T(pid,'numero'),T(pid,'ano'),T(pid,'justica'),T(pid,'regiao'),T(pid,'vara'),T(pid,'digito')]:null;
  const numeroFmt=numero&&numero[0]?(String(numero[0]).padStart(7,'0')+'-'+String(numero[5]||'').padStart(2,'0')+'.'+numero[1]+'.'+numero[2]+'.'+String(numero[3]).padStart(2,'0')+'.'+String(numero[4]).padStart(4,'0')):null;
  const proc={
    numero:numeroFmt,
    reclamante:T(raiz.querySelector('processo > Processo > reclamante > Reclamante'),'nome'),
    reclamada:T(raiz.querySelector('processo > Processo > reclamado > Reclamado'),'nome'),
    regiao:numero?numero[3]:null, vara:numero?numero[4]:null
  };

  /* -------- parâmetros de atualização -------- */
  const pa=raiz.querySelector('parametrosDeAtualizacao > ParametrosDeAtualizacao');
  const idxPrinc=rot(IDX,T(pa,'indiceTrabalhista'));
  const idxOutro=rot(IDX,T(pa,'outroIndiceTrabalhista'));
  const combinar=T(pa,'combinarOutroIndice')==='true';
  const apartir=data(T(pa,'apartirDeOutroIndice'));
  const juros=rot(JUR,T(pa,'juros'));
  const jurosPre=T(pa,'aplicarJurosFasePreJudicial')==='true';
  const fases=[];
  if(idxPrinc) fases.push({desde:null, indice:idxPrinc});
  Array.from(raiz.querySelectorAll('parametrosDeAtualizacao > ParametrosDeAtualizacao > listaDeCombinacaoDeIndices > Set > CombinacaoDeIndice'))
    .map(c=>({desde:T(c,'apartirDeOutroIndice'), indice:rot(IDX,T(c,'outroIndiceTrabalhista'))}))
    .sort((a2,b2)=>(+a2.desde||0)-(+b2.desde||0))
    .forEach(c=>fases.push({desde:data(c.desde), indice:c.indice}));
  const fasesJuros=[];
  if(juros) fasesJuros.push({desde:null, juros:juros});
  Array.from(raiz.querySelectorAll('parametrosDeAtualizacao > ParametrosDeAtualizacao > listaDeCombinacaoDeJuros > Set > CombinacaoDeJuros'))
    .map(c=>({desde:T(c,'apartirDeOutroJuros'), juros:rot(JUR,T(c,'outroJuros'))}))
    .sort((a2,b2)=>(+a2.desde||0)-(+b2.desde||0))
    .forEach(c=>fasesJuros.push({desde:data(c.desde), juros:c.juros}));
  const linha=fases.map(f=>(f.desde?'a partir de '+f.desde+': ':'')+f.indice).join(' → ');
  const linhaJ=fasesJuros.map(f=>(f.desde?'a partir de '+f.desde+': ':'')+f.juros).join(' → ');
  const indice={
    preJudicial:idxPrinc,
    judicial:fases.length>1?fases[fases.length-1].indice:idxPrinc,
    fases, fasesJuros, linhaDoTempo:linha, linhaDoTempoJuros:linhaJ,
    trocaEm:combinar?apartir:null,
    juros:juros,
    aplicarJurosFasePreJudicial:jurosPre,
    baseDeJuros:T(pa,'baseDeJurosDasVerbas'),
    observacao:[linha?'correção: '+linha:'', linhaJ?'juros: '+linhaJ:'', jurosPre?'juros aplicados também na fase pré-judicial':''].filter(Boolean).join(' · '),
    ultimoIndice:T(pa,'informacaoUltimoIndice')
  };

  /* -------- verbas -------- */
  const verbas=[], inativas=[];
  let totalDevido=0, totalPago=0;
  // ATENÇÃO: no export do PJe-Calc as verbas PRINCIPAIS (horas extras, intervalo)
  // aparecem no Set como <internalRef> vazio — a definição real fica dentro do
  // baseVerba dos reflexos. Por isso varremos o documento inteiro e deduplicamos por id.
  const todas=[];
  ['Calculada','Reflexo','Informada'].forEach(tag=>{
    doc.querySelectorAll(tag).forEach(e=>{ if(T(e,'nome')) todas.push(e); });
  });
  const vistos=new Set();
  todas.forEach(v=>{
    const id=T(v,'id'); if(id&&vistos.has(id)) return; if(id) vistos.add(id);
    const nome=T(v,'nome')||'';
    const ativo=T(v,'ativo')==='true';
    const carac=T(v,'caracteristica');
    const ocs=Array.from(v.querySelectorAll(':scope > ocorrencias > List > OcorrenciaDeVerba'));
    let qtd=0, dev=0, pago=0, div=null, mult=null, base=null, ini=null, fim=null;
    const mensal=[];   /* mes a mes: e o que permite cruzar com o cartao de ponto */
    ocs.forEach(o=>{
      if(T(o,'ativo')==='false') return;
      const dIni=T(o,'dataInicial');
      if(dIni) mensal.push({
        mes:new Date(parseInt(dIni,10)).toISOString().slice(0,7),
        quantidade:Math.round((n(T(o,'quantidade'))||0)*10000)/10000,
        devido:moeda(n(T(o,'devido'))||0), pago:moeda(n(T(o,'pago'))||0)
      });
      qtd+=n(T(o,'quantidade'))||0;
      dev+=n(T(o,'devido'))||0;
      pago+=n(T(o,'pago'))||0;
      if(div==null) div=n(T(o,'divisor'));
      if(mult==null) mult=n(T(o,'multiplicador'));
      if(base==null) base=n(T(o,'base'));
      const di=T(o,'dataInicial'), df=T(o,'dataFinal');
      if(di&&(ini==null||+di<+ini)) ini=di;
      if(df&&(fim==null||+df>+fim)) fim=df;
    });
    const cls=classificar(nome,carac,mult);
    const ehReflexo = v.tagName==='Reflexo' || /\sSOBRE\s/i.test(nome);
    const item={
      descricao:nome, tipo:v.tagName, ehReflexo, caracteristica:carac, ativo,
      motorId:cls.motorId, subtipo:cls.subtipo,
      periodo:(ini||fim)?((data(ini)||'?')+' a '+(data(fim)||'?')):((data(T(v,'periodoInicial'))||'?')+' a '+(data(T(v,'periodoFinal'))||'?')),
      divisor:div, multiplicador:mult, quantidade:qtd?Math.round(qtd*10000)/10000:null,
      baseCalculo:base!=null?('R$ '+moeda(base)):null,
      percentual:mult!=null?(mult>=2?'100%':(mult>1?Math.round((mult-1)*100)+'%':null)):null,
      valorPrincipal:moeda(dev), valorPago:moeda(pago),
      ocorrencias:ocs.length, mensal:mensal,
      incidenciaFGTS:T(v,'incidenciaFGTS')==='true',
      incidenciaINSS:T(v,'incidenciaINSS')==='true',
      trecho:'PJe-Calc: '+nome+(div?' · divisor '+div:'')+(mult?' · mult. '+mult:'')+(qtd?' · '+Math.round(qtd*100)/100+' un.':'')
    };
    if(ativo){ verbas.push(item); if(!ehReflexo){} totalDevido+=dev; totalPago+=pago; }
    else inativas.push(item);
  });

  /* -------- honorários -------- */
  const h=raiz.querySelector('honorarios > Set > Honorario');
  const honorarios=h?{
    percentual:n(T(h,'aliquota')), base:T(h,'baseParaApuracao'),
    baseValor:moeda(n(T(h,'baseHonorario'))), valor:moeda(n(T(h,'valor'))),
    aCargoDe:T(h,'tipoDeDevedor'), descricao:T(h,'descricao')
  }:{};

  /* -------- FGTS / INSS -------- */
  const fg=raiz.querySelector('fgts > Fgts');
  const fgts=fg?{
    incidiuSobre:T(fg,'incidenciaDoFgts'), multa:T(fg,'multa')==='true',
    percentualMulta:T(fg,'multaDoFgts'), aliquota:T(fg,'aliquota'),
    excluirAvisoDaMulta:T(fg,'excluirAvisoDaMulta')==='true',
    observacao:'incidência: '+(T(fg,'incidenciaDoFgts')||'—')
  }:{};
  const ins=raiz.querySelector('inss > Inss');
  const contribuicoes=ins?{
    previdenciaria:(T(ins,'aliquotaEmpresaFixa')?n(T(ins,'aliquotaEmpresaFixa'))+'%':null),
    sat:(T(ins,'aliquotaRATFixa')?n(T(ins,'aliquotaRATFixa'))+'%':null),
    fiscal:(raiz.querySelector('irpf > Irpf')&&T(raiz.querySelector('irpf > Irpf'),'apurarImpostoRenda')==='true')?'IRPF apurado':'IRPF não apurado'
  }:{};

  /* -------- deduções -------- */
  const deducoes=[];
  if(totalPago>0) deducoes.push({descricao:'valores pagos lançados nas verbas',valor:moeda(totalPago)});
  const pgs=Array.from(raiz.querySelectorAll('pagamentos > Set > *'));
  pgs.forEach(p=>{ const v=n(T(p,'valor')); if(v) deducoes.push({descricao:T(p,'descricao')||'pagamento',valor:moeda(v)}); });

  /* -------- cartão de ponto --------
     Aqui não basta somar. O que decide uma impugnação é COMO a jornada
     foi lançada: se bate com o horário fixado na decisão, e se — quando
     a apuração deveria seguir o cartão de ponto — o lançamento é
     britânico (o mesmo horário todo santo dia), sinal de que o cartão
     não foi seguido. Por isso guardamos o padrão por dia da semana,
     a aderência a esse padrão e o mês a mês. */
  const dias=Array.from(raiz.querySelectorAll('apuracoesDiariasCartaoDePonto > Set > ApuracaoDiariaCartao'));
  const jornada={ dias:dias.length, resumo:null };
  if(dias.length){
    const soma=t=>dias.reduce((a,d)=>a+(n(T(d,t))||0),0);
    jornada.resumo={
      horasTrabalhadas:Math.round(soma('horasTrabalhadas')*100)/100,
      horasExtrasDiaria:Math.round(soma('horasExtrasDiaria')*100)/100,
      horasNoturnas:Math.round(soma('horasNoturnas')*100)/100,
      horasIntraJornada:Math.round(soma('horasIntraJornada')*100)/100,
      horasInterJornadas:Math.round(soma('horasInterJornadas')*100)/100,
      horasDomingo:Math.round(soma('horasDomingo')*100)/100,
      horasFeriado:Math.round(soma('horasFeriado')*100)/100
    };
    montarJornadaDetalhada(jornada, dias);
  }

  /* -------- férias -------- */
  const ferias=Array.from(raiz.querySelectorAll('listaDeFerias > Set > Ferias')).map(f=>({
    relativa:T(f,'relativa'), situacao:T(f,'situacao'), dobra:T(f,'dobraGeral')==='true', abono:T(f,'abono')==='true'
  }));

  return {
    origem:'pjc',
    versaoSistema:T(raiz,'versaoDoSistema'),
    autorDoCalculo:'PJe-Calc ('+(T(raiz,'tipoCalculo')||'—')+')',
    dataAtualizacao:data(T(raiz,'dataDeLiquidacao')),
    processo:proc,
    contrato:{
      admissao:data(T(raiz,'dataAdmissao')), demissao:data(T(raiz,'dataDemissao')),
      ajuizamento:data(T(raiz,'dataAjuizamento')),
      inicioCalculo:data(T(raiz,'dataInicioCalculo')), terminoCalculo:data(T(raiz,'dataTerminoCalculo')),
      cargaHoraria:n(T(raiz,'valorCargaHorariaPadrao')), regime:T(raiz,'regimeDoContrato')
    },
    flags:{
      prescricaoQuinquenal:T(raiz,'prescricaoQuinquenal')==='true',
      prescricaoFgts:T(raiz,'prescricaoFgts')==='true',
      sabadoDiaUtil:T(raiz,'sabadoDiaUtil')==='true',
      projetaAvisoIndenizado:T(raiz,'projetaAvisoIndenizado')==='true',
      limitarAvosAoPeriodo:T(raiz,'limitarAvosAoPeriodoDoCalculo')==='true'
    },
    indiceCorrecao:indice,
    verbas, verbasInativas:inativas,
    deducoes, fgts, honorarios, contribuicoes, ferias, jornada,
    totalGeral:moeda(totalDevido),
    totalPago:moeda(totalPago),
    baseBrutaPJC:h?moeda(n(T(h,'baseHonorario'))):null,
    diasEspeciais:{ feriados:jornada.resumo?jornada.resumo.horasFeriado+'h':null, domingos:jornada.resumo?jornada.resumo.horasDomingo+'h':null, sabados:null },
    observacoes:[]
  };
}

/* ============================================================
   ESCRITA DO .PJC
   ------------------------------------------------------------
   Estrategia deliberada: NAO montamos o XML do zero. Partimos de
   um .PJC real como MOLDE e reescrevemos so o que muda. O schema
   do PJe-Calc tem 636 tags e campos internos (ids, versoes,
   hashes) que nao temos como inventar com seguranca.
   ============================================================ */

/* --- CRC32, exigido pelo cabecalho do ZIP --- */
var TCRC=(function(){ var t=new Uint32Array(256),c,i,k;
  for(i=0;i<256;i++){ c=i; for(k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[i]=c>>>0; }
  return t; })();
function crc32(b){ var c=0xFFFFFFFF; for(var i=0;i<b.length;i++) c=TCRC[(c^b[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }

/* --- texto -> bytes ISO-8859-1; o que nao couber vira entidade --- */
function paraLatin1(txt){
  var out=[];
  for(var i=0;i<txt.length;i++){
    var c=txt.charCodeAt(i);
    if(c<256) out.push(c);
    else { var ent='&#'+c+';'; for(var j=0;j<ent.length;j++) out.push(ent.charCodeAt(j)); }
  }
  return new Uint8Array(out);
}
async function deflar(bytes){
  if(typeof CompressionStream==='undefined') return null;
  var cs=new CompressionStream('deflate-raw');
  var buf=await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}
function p16(v){ return [v&0xFF,(v>>8)&0xFF]; }
function p32(v){ return [v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>>24)&0xFF]; }

/* O PJe-Calc grava o ZIP com o Java (ZipOutputStream): data e hora validas,
   flag 0x8 (data descriptor) e o nome da entrada IGUAL ao nome do arquivo.
   Reproduzimos isso — arquivo gerado por nos tem que ser indistinguivel. */
function dosDataHora(d){
  var dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  var tm=(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2);
  return {data:dt&0xFFFF, hora:tm&0xFFFF};
}
async function montarZip(nomeArquivo, conteudo, op){
  op=op||{};
  var dh=op.quando?dosDataHora(op.quando):{data:0x5D1B, hora:0x7CCB};
  var descritor = op.dataDescriptor!==false;   // igual ao Java por padrao
  var nome=[]; for(var i=0;i<nomeArquivo.length;i++) nome.push(nomeArquivo.charCodeAt(i)&0xFF);
  var crc=crc32(conteudo);
  var comp=await deflar(conteudo);
  var metodo=8;
  if(!comp || comp.length>=conteudo.length){ comp=conteudo; metodo=0; }
  var flag = descritor?8:0;
  // com data descriptor, o cabecalho local vai com zeros e os valores reais vem depois
  var lfh=[].concat([0x50,0x4b,0x03,0x04], p16(20), p16(flag), p16(metodo), p16(dh.hora), p16(dh.data),
                    p32(descritor?0:crc), p32(descritor?0:comp.length), p32(descritor?0:conteudo.length),
                    p16(nome.length), p16(0), nome);
  var dados=Array.prototype.slice.call(comp);
  var dd = descritor ? [].concat([0x50,0x4b,0x07,0x08], p32(crc), p32(comp.length), p32(conteudo.length)) : [];
  var off=0;
  var cd=[].concat([0x50,0x4b,0x01,0x02], p16(20), p16(20), p16(flag), p16(metodo), p16(dh.hora), p16(dh.data),
                   p32(crc), p32(comp.length), p32(conteudo.length), p16(nome.length),
                   p16(0), p16(0), p16(0), p16(0), p32(0), p32(off), nome);
  var iniCd=lfh.length+dados.length+dd.length;
  var eocd=[].concat([0x50,0x4b,0x05,0x06], p16(0), p16(0), p16(1), p16(1),
                     p32(cd.length), p32(iniCd), p16(0));
  return new Uint8Array(lfh.concat(dados, dd, cd, eocd));
}

/* --- serializa o XML de volta, preservando o cabecalho ISO-8859-1 --- */
function serializar(doc){
  var xml=new XMLSerializer().serializeToString(doc);
  xml=xml.replace(/^<\?xml[^>]*\?>/,'');
  return '<?xml version="1.0" encoding="ISO-8859-1"?>'+xml;
}

/* --- edicao por TEXTO: troca so o valor, sem passar por DOM.
       Passar pelo DOMParser+XMLSerializer reescreve o documento inteiro
       (tags vazias, entidades, espacos) e isso pode ser o que o PJe-Calc
       recusa. Aqui o resto do arquivo fica identico. --- */
function trocarTexto(xml, tag, valor, ancora){
  var re;
  if(ancora){
    re=new RegExp('(<'+ancora+'>[\\s\\S]{0,4000}?<'+tag+'>)([\\s\\S]*?)(<\\/'+tag+'>)');
  }else{
    re=new RegExp('(<'+tag+'>)([\\s\\S]*?)(<\\/'+tag+'>)');
  }
  var achou=false;
  var novo=xml.replace(re, function(m,a,b,c){ achou=true; return a+String(valor)+c; });
  return {xml:novo, achou:achou};
}
function editarTexto(xml, edicoes){
  var mudou=[], faltou=[];
  (edicoes||[]).forEach(function(ed){
    var r=trocarTexto(xml, ed.tag, ed.valor, ed.ancora);
    xml=r.xml;
    (r.achou?mudou:faltou).push((ed.ancora?ed.ancora+' > ':'')+ed.tag);
  });
  return {xml:xml, mudou:mudou, faltou:faltou};
}

/* --- aplica alteracoes simples no XML: {caminho: valor} --- */
function aplicarPatch(doc, patch){
  var mudou=[], faltou=[];
  Object.keys(patch||{}).forEach(function(sel){
    var alvo=doc.querySelector(sel);
    if(!alvo){ faltou.push(sel); return; }
    alvo.textContent=String(patch[sel]);
    mudou.push(sel);
  });
  return {mudou:mudou, faltou:faltou};
}

window.FazAIPJC={
  async ler(arrayBuffer){ return parse(await extrairXml(arrayBuffer)); },
  parse, extrairXml,

  /* le o XML cru, para servir de molde */
  async lerXml(arrayBuffer){ return extrairXml(arrayBuffer); },
  async lerXmlComNome(arrayBuffer){ return extrairXml(arrayBuffer, true); },

  /* gera um .PJC a partir de um XML (molde ja alterado, ou identico) */
  async gerar(xmlText, nomeArquivo, op){
    if(typeof CompressionStream==='undefined' && typeof Blob==='undefined')
      throw new Error('este navegador nao consegue montar o arquivo .PJC.');
    var nome=nomeArquivo||('CALCULO_'+Date.now()+'.PJC');
    var bytes=paraLatin1(xmlText);
    var zip=await montarZip(nome, bytes, op);
    return {bytes:zip, nome:nome};
  },

  /* caminho recomendado: molde + edicao por texto, mantendo o nome da entrada */
  async gerarPorTexto(arrayBufferMolde, edicoes, op){
    var r=await extrairXml(arrayBufferMolde, true);
    var e=editarTexto(r.xml, edicoes||[]);
    var saida=await this.gerar(e.xml, (op&&op.nome)||r.nome, op);
    saida.alterados=e.mudou; saida.naoEncontrados=e.faltou; saida.nomeEntrada=(op&&op.nome)||r.nome;
    return saida;
  },

  /* molde + alteracoes -> novo .PJC */
  async gerarDeMolde(arrayBufferMolde, patch, nomeArquivo){
    var xml=await extrairXml(arrayBufferMolde);
    var doc=new DOMParser().parseFromString(xml,'text/xml');
    var r=aplicarPatch(doc, patch);
    var novo=serializar(doc);
    var saida=await this.gerar(novo, nomeArquivo);
    saida.alterados=r.mudou; saida.naoEncontrados=r.faltou;
    return saida;
  },

  crc32, paraLatin1, montarZip, serializar, aplicarPatch, editarTexto, trocarTexto, dosDataHora
};
})();
