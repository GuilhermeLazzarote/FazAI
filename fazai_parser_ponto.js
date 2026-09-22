// ============================================================================
// FazAI — Parser Universal de Cartão de Ponto (JS, roda no navegador, CUSTO ZERO)
// Regra universal: 1a batida = entrada do dia, última = saída, o meio = intervalos
// (sempre em par). Remove escala/horário previsto e texto de status.
// Uso: window.FazAIParserPonto.parsear(textoDoServidor, {ano, regras})
//   → {dias:[{data,turnos:[[e,s]],obs}], reconhecido:bool, diasComData:int}
// Se reconhecido=false (achou poucos dias), o app cai pra IA (plano B pago).
// ============================================================================
(function(global){
'use strict';

function _hm(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function _fmt(n){ n=Math.round(n); return String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(((n%60)+60)%60).padStart(2,'0'); }

// separa as batidas de UMA linha em turnos [[e,s],...]
function _batidasParaTurnos(tokens){
  const turnos=[];
  for(let i=0;i<tokens.length;i+=2){
    const e = tokens[i]==='FM' ? '' : tokens[i];
    const s = (i+1>=tokens.length || tokens[i+1]==='FM') ? '' : tokens[i+1];
    turnos.push([e,s]);
  }
  return turnos;
}

function parsear(texto, opts){
  opts=opts||{};
  const linhas=String(texto).split('\n');
  let ano=opts.ano||'';
  if(!ano){ const m=texto.match(/\d{2}\/\d{2}\/(\d{4})/); if(m) ano=m[1]; }
  const dias=[];
  let diasComData=0;

  for(const linha of linhas){
    // linha de dia: começa com DD/MM (aceita "DD/MM", "DD/MM/AAAA", "DD/MM - Ter")
    const mData=linha.match(/^\s*(\d{2}\/\d{2})(?:\/(\d{4}))?\s*(?:[-–]\s*\w{3,})?\s+(.*)$/);
    if(!mData) continue;
    diasComData++;
    const dm=mData[1], anoLinha=mData[2]||ano;
    const resto=mData[3]||'';
    const data=dm+(anoLinha?'/'+anoLinha:'');
    const restoLower=resto.toLowerCase();
    const temHorario=/\d{1,2}:\d{2}/.test(resto);

    // status de dia sem batida
    if(!temHorario){
      if(/descanso semanal|\bdsr\b|repouso/.test(restoLower)){ dias.push({data,turnos:[],obs:'DSR'}); continue; }
      if(/compensad/.test(restoLower)){ dias.push({data,turnos:[],obs:'Compensado'}); continue; }
      if(/feriado/.test(restoLower)){ dias.push({data,turnos:[],obs:'Feriado'}); continue; }
      if(/f[ée]rias/.test(restoLower)){ dias.push({data,turnos:[],obs:'Férias'}); continue; }
      if(/falta|ausen/.test(restoLower)){ dias.push({data,turnos:[],obs:'Falta'}); continue; }
      dias.push({data,turnos:[],obs:'Sem marcação'}); continue;
    }

    // 1) remove ESCALA/previsto: "HH:MM / HH:MM"
    let limpo=resto.replace(/\d{1,2}:\d{2}\s*[\/–-]\s*\d{1,2}:\d{2}/g,' ');
    // 2) corta texto de status/HE após as batidas
    limpo=limpo.split(/hora extra|jornada incompleta|lançar|pagar|banco de horas|adicional|intervalo/i)[0];
    // 3) pega batidas HH:MM e FM
    const tokens=(limpo.match(/\d{1,2}:\d{2}|FM/gi)||[]).map(t=>t.toUpperCase());

    let obs='';
    if(/feriado/.test(restoLower)) obs='Feriado';
    else if(/compensad/.test(restoLower)) obs='Compensado';
    if(tokens.includes('FM')) obs=(obs?obs+' · ':'')+'FM (falta marcação)';

    dias.push({data, turnos:_batidasParaTurnos(tokens), obs});
  }

  // aplica regras opcionais
  const regras=opts.regras||{};
  if(regras.intervalo){ dias.forEach(d=>_aplicarIntervalo(d, regras.intervalo, regras.minJornadaMin||360)); }

  // "reconhecido" = achou uma quantidade razoável de dias com batida
  const comBatida=dias.filter(d=>d.turnos.some(t=>t[0]||t[1])).length;
  const reconhecido = diasComData>=3 && comBatida>=2;
  return {dias, reconhecido, diasComData, comBatida};
}

// REGRA: intervalo pré-assinalado (divide um turno único em 2, com o intervalo no meio)
function _aplicarIntervalo(dia, minutosInt, minJornadaMin){
  if(dia.turnos.length!==1) return;
  const [e,s]=dia.turnos[0];
  if(!e||!s) return;
  let te=_hm(e), ts=_hm(s); if(ts<te) ts+=1440;
  if(ts-te<=minJornadaMin) return; // jornada curta, sem intervalo
  const meio=te+(ts-te)/2;
  dia.turnos=[[e,_fmt(meio-minutosInt/2)],[_fmt(meio+minutosInt/2),s]];
  dia.obs=(dia.obs?dia.obs+' · ':'')+'intervalo '+minutosInt+'min pré-assinalado';
}

global.FazAIParserPonto={ parsear };

})(typeof window!=='undefined'?window:this);
