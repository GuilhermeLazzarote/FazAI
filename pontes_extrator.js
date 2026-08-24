// ============================================================================
// FazAI — PONTES DE IMPORTAÇÃO DO EXTRATOR (ponto + holerite)
// Casado com a estrutura REAL de analise-processo.html:
//   jornada: inputs j_K_ent / j_K_sai / j_K_iv  (K='1'..'6','0')
//   salário: f_sal | evolução: f_evol | premissas: #premissas-box .prem-row
//   usa reaplicarJornada() e XLSX (já carregado). NÃO toca no motor.
// ============================================================================
(function(){
'use strict';
function hhmmDec(s){ if(s==null)return null; if(typeof s==='number')return s;
  s=String(s).trim(); if(s.indexOf(':')<0)return null;
  const p=s.split(':'),h=parseInt(p[0],10),m=parseInt(p[1],10);
  return (isNaN(h)||isNaN(m))?null:h+m/60; }
function brNum(v){ if(typeof v==='number')return v; if(v==null||v==='')return 0;
  let s=String(v).trim().replace(/\s/g,'');
  if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');
  const n=parseFloat(s); return isNaN(n)?0:n; }
function diaSemana(d){ const p=String(d).split('/'); if(p.length!==3)return null;
  const dt=new Date(parseInt(p[2],10),parseInt(p[1],10)-1,parseInt(p[0],10));
  return isNaN(dt.getTime())?null:dt.getDay(); }
async function lerWB(file){ const b=await file.arrayBuffer(); return XLSX.read(b,{type:'array'}); }

async function pontoParaJornada(file){
  const nome=(file.name||'').toLowerCase(); let linhas=[];
  if(nome.endsWith('.csv')){
    const txt=await file.text(); const rows=txt.split(/\r?\n/).filter(r=>r.trim());
    const sep=rows[0].indexOf(';')>=0?';':','; rows.shift();
    rows.forEach(r=>{ const c=r.split(sep),data=c[0]; if(!data)return; const pares=[];
      for(let i=1;i<c.length;i+=2){const e=hhmmDec(c[i]),s=hhmmDec(c[i+1]); if(e!=null&&s!=null)pares.push([e,s]);}
      linhas.push({data,pares}); });
  } else {
    const wb=await lerWB(file); const ws=wb.Sheets['Jornada']||wb.Sheets[wb.SheetNames[0]];
    const arr=XLSX.utils.sheet_to_json(ws,{header:1}); let ini=0;
    for(let i=0;i<Math.min(arr.length,5);i++){ if(String(arr[i][0]||'').toLowerCase().indexOf('data')>=0){ini=i+1;break;} }
    for(let i=ini;i<arr.length;i++){ const c=arr[i],data=c[0]; if(!data)continue; const pares=[];
      for(let j=1;j<9;j+=2){const e=hhmmDec(c[j]),s=hhmmDec(c[j+1]); if(e!=null&&s!=null)pares.push([e,s]);}
      linhas.push({data:String(data),pares}); }
  }
  const porDia={};
  linhas.forEach(l=>{ if(!l.pares.length)return; const wd=diaSemana(l.data); if(wd==null)return;
    const ent=l.pares[0][0],sai=l.pares[l.pares.length-1][1]; let iv=0;
    for(let i=0;i<l.pares.length-1;i++)iv+=(l.pares[i+1][0]-l.pares[i][1]);
    (porDia[wd]=porDia[wd]||[]).push(ent+'|'+sai+'|'+Math.round(iv*60)); });
  const dias={};
  Object.keys(porDia).forEach(wd=>{ const cont={}; porDia[wd].forEach(k=>cont[k]=(cont[k]||0)+1);
    const top=Object.keys(cont).sort((a,b)=>cont[b]-cont[a])[0].split('|').map(Number);
    dias[wd]={entrada:top[0],saida:top[1],intervMin:top[2]}; });
  return {dias,diasComMarca:linhas.filter(l=>l.pares.length).length,totalDias:linhas.length};
}
function aplicarJornadaNaTabela(res){
  const map={0:'0',1:'1',2:'2',3:'3',4:'4',5:'5',6:'6'};
  Object.keys(res.dias).forEach(wd=>{ const k=map[wd],d=res.dias[wd];
    const e=document.getElementById('j_'+k+'_ent'),s=document.getElementById('j_'+k+'_sai'),iv=document.getElementById('j_'+k+'_iv');
    if(e)e.value=(d.entrada!=null?d.entrada:''); if(s)s.value=(d.saida!=null?d.saida:''); if(iv)iv.value=(d.intervMin!=null?d.intervMin:''); });
  if(typeof reaplicarJornada==='function')reaplicarJornada();
}
async function pontoHorasApuradas(file){
  const nome=(file.name||'').toLowerCase(); if(nome.endsWith('.csv'))return null;
  const wb=await lerWB(file); const ws=wb.Sheets['Totais']||wb.Sheets['Apuracao']||wb.Sheets['Apuração'];
  if(!ws)return null; const arr=XLSX.utils.sheet_to_json(ws,{header:1});
  const map={'he 50':'heTotais','hora extra 50':'heTotais','extra 50':'heTotais','he 100':'he100',
    'hora extra 100':'he100','domingo':'he100','feriado':'he100','art 71':'heArt71','intervalo':'heArt71',
    'intrajornada':'heArt71','noturn':'adicionalNoturno'}; const found={};
  arr.forEach(r=>{ const desc=String(r[0]||'').toLowerCase().trim(),val=brNum(r[1]); if(!desc||!val)return;
    for(const k in map){ if(desc.indexOf(k)>=0){found[map[k]]=(found[map[k]]||0)+val;break;} } });
  return Object.keys(found).length?found:null;
}
function aplicarHorasApuradas(found){ if(!found)return 0; let n=0;
  document.querySelectorAll('#premissas-box .prem-row:not(.prem-manual)').forEach((row,idx)=>{
    const vid=row.dataset.vid; if(found[vid]!=null){ const inp=document.getElementById('prem_'+idx); if(inp){inp.value=found[vid].toFixed(1);n++;} } });
  return n; }
async function holeriteParaCalculo(file){
  const wb=await lerWB(file); const out={salario:0,evolucaoTexto:'',pagamentos:[]};
  const wsSal=wb.Sheets['Salário Base Fixo']||wb.Sheets['Salario Base Fixo'];
  if(wsSal){ const arr=XLSX.utils.sheet_to_json(wsSal,{header:1}); const evol=[];
    arr.forEach(r=>{ const comp=r[0],val=brNum(r[1]);
      if(comp&&/^\d{2}\/\d{4}$/.test(String(comp).trim())&&val>0)evol.push({comp:String(comp).trim(),val}); });
    if(evol.length){ out.salario=evol[evol.length-1].val; const linhas=[]; let ult=null;
      evol.forEach(e=>{ if(e.val!==ult){linhas.push(e.comp+': R$ '+e.val.toFixed(2).replace('.',','));ult=e.val;} });
      if(linhas.length>1)out.evolucaoTexto=linhas.join('\n'); } }
  const wsBD=wb.Sheets['Base de Dados']||wb.Sheets['Base de dados'];
  if(wsBD){ const arr=XLSX.utils.sheet_to_json(wsBD,{header:1}); arr.shift();
    arr.forEach(r=>{ const comp=r[1],desc=String(r[3]||''),nat=String(r[4]||''),grp=String(r[5]||''),val=brNum(r[6]); if(!val)return;
      if(/vencimento/i.test(nat)&&/mensal/i.test(grp)&&/hora\s*extra|h\.?\s*extra|adic.*not|dsr|repouso/i.test(desc))
        out.pagamentos.push({rubrica:desc,valor:val,competencia:String(comp)}); }); }
  return out;
}
function aplicarHolerite(dados){ const msgs=[];
  if(dados.salario){ const el=document.getElementById('f_sal'); if(el){el.value=dados.salario;msgs.push('salário R$ '+dados.salario.toFixed(2));} }
  if(dados.evolucaoTexto){ const el=document.getElementById('f_evol'); if(el){el.value=dados.evolucaoTexto;msgs.push('evolução salarial');} }
  if(dados.pagamentos&&dados.pagamentos.length){ window._deducoesImportadas=dados.pagamentos; msgs.push(dados.pagamentos.length+' pagamentos p/ dedução'); }
  return msgs; }
async function onImportPonto(input){ const f=input.files[0]; if(!f)return; const st=document.getElementById('f_status');
  try{ const res=await pontoParaJornada(f); aplicarJornadaNaTabela(res); let extra='';
    const horas=await pontoHorasApuradas(f); if(horas){const n=aplicarHorasApuradas(horas); if(n)extra=' + '+n+' verba(s) de horas apuradas';}
    if(st)st.innerHTML='<span class="okmsg">✓ Ponto importado: jornada de '+res.diasComMarca+'/'+res.totalDias+' dias resumida por dia-da-semana'+extra+'. Confira a tabela.</span>';
  }catch(e){ if(st)st.innerHTML='<span style="color:#a11">Erro ao ler o ponto: '+e.message+'</span>'; } input.value=''; }
async function onImportHolerite(input){ const f=input.files[0]; if(!f)return; const st=document.getElementById('f_status');
  try{ const dados=await holeriteParaCalculo(f); const msgs=aplicarHolerite(dados);
    if(st)st.innerHTML='<span class="okmsg">✓ Holerite importado: '+(msgs.join(', ')||'nada encontrado')+'. Confira os campos.</span>';
  }catch(e){ if(st)st.innerHTML='<span style="color:#a11">Erro ao ler o holerite: '+e.message+'</span>'; } input.value=''; }
window.onImportPonto=onImportPonto; window.onImportHolerite=onImportHolerite;
window.pontoParaJornada=pontoParaJornada; window.holeriteParaCalculo=holeriteParaCalculo; window.pontoHorasApuradas=pontoHorasApuradas;
})();
