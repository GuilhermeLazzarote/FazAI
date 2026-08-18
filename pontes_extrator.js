// ============================================================================
// FazAI — PONTES DE IMPORTAÇÃO DO EXTRATOR
// Cola este bloco dentro do <script> da analise-processo.html.
// Depende da lib XLSX (SheetJS), que o app já carrega.
// NÃO toca no motor de cálculo. Só traduz a saída dos extratores para
// as estruturas que a tela já entende (jornada + premissas + salário).
// ============================================================================

// ---------- utilitários ----------
function _hhmmParaDecimal(s){                 // "07:46" -> 7.766...
  if(!s || typeof s!=='string' || s.indexOf(':')<0) return null;
  const [h,m]=s.split(':').map(x=>parseInt(x,10));
  if(isNaN(h)||isNaN(m)) return null;
  return h + m/60;
}
function _brToNum(v){                          // "1.234,56" ou "1234.56" -> 1234.56
  if(typeof v==='number') return v;
  if(!v) return 0;
  let s=String(v).trim().replace(/\s/g,'');
  if(s.indexOf(',')>=0){ s=s.replace(/\./g,'').replace(',', '.'); } // formato BR
  const n=parseFloat(s); return isNaN(n)?0:n;
}
function _diaSemanaDe(dataBR){                 // "16/01/2023" -> 0..6 (0=domingo)
  const [d,m,a]=dataBR.split('/').map(x=>parseInt(x,10));
  return new Date(a, m-1, d).getDay();
}
async function _lerPlanilha(file){             // File -> workbook XLSX
  const buf=await file.arrayBuffer();
  return XLSX.read(buf, {type:'array'});
}

// ============================================================================
// PONTE 1 — PONTO (CSV PJe-Calc ou Excel de auditoria)
// Produz: { jornada (p/ conferência) , resumoDias , diasComMarca }
// A jornada resumida por dia-da-semana preenche a tabela montarJornada.
// ============================================================================
async function pontoParaCalculo(file){
  const nome=(file.name||'').toLowerCase();
  let linhas=[]; // cada item: { data:'dd/mm/aaaa', pares:[[ent,sai],...] }

  if(nome.endsWith('.csv')){
    const txt=await file.text();
    const rows=txt.split(/\r?\n/).filter(r=>r.trim());
    rows.shift(); // cabeçalho Data,Entrada1,Saída1,...
    rows.forEach(r=>{
      const c=r.split(',');
      const data=c[0]; if(!data) return;
      const pares=[];
      for(let i=1;i<c.length;i+=2){
        const ent=_hhmmParaDecimal(c[i]), sai=_hhmmParaDecimal(c[i+1]);
        if(ent!=null && sai!=null) pares.push([ent,sai]);
      }
      linhas.push({data, pares});
    });
  } else { // Excel de auditoria (aba "Jornada")
    const wb=await _lerPlanilha(file);
    const ws=wb.Sheets['Jornada']||wb.Sheets[wb.SheetNames[0]];
    const arr=XLSX.utils.sheet_to_json(ws, {header:1});
    arr.shift(); // cabeçalho Data|Entrada1|Saída1|Entrada2|Saída2|Origem
    arr.forEach(c=>{
      const data=c[0]; if(!data) return;
      const pares=[];
      for(let i=1;i<5;i+=2){
        const ent=_hhmmParaDecimal(c[i]), sai=_hhmmParaDecimal(c[i+1]);
        if(ent!=null && sai!=null) pares.push([ent,sai]);
      }
      linhas.push({data:String(data), pares});
    });
  }

  // resume por dia-da-semana: pega o padrão mais frequente de cada dia
  const porDia={}; // 0..6 -> array de {ent,sai,iv}
  linhas.forEach(l=>{
    if(!l.pares.length) return;
    const wd=_diaSemanaDe(l.data);
    const ent=l.pares[0][0];
    const sai=l.pares[l.pares.length-1][1];
    // intervalo = soma dos gaps entre turnos (ex.: saída1->entrada2)
    let iv=0;
    for(let i=0;i<l.pares.length-1;i++){ iv += (l.pares[i+1][0]-l.pares[i][1]); }
    (porDia[wd]=porDia[wd]||[]).push({ent, sai, iv:Math.round(iv*60)});
  });

  // moda simples: horário que mais aparece por dia
  const dias={};
  Object.keys(porDia).forEach(wd=>{
    const reg=porDia[wd];
    const cont={};
    reg.forEach(r=>{ const k=r.ent+'|'+r.sai+'|'+r.iv; cont[k]=(cont[k]||0)+1; });
    const top=Object.keys(cont).sort((a,b)=>cont[b]-cont[a])[0].split('|').map(Number);
    dias[wd]={ entrada:top[0], saida:top[1], intervMin:top[2] };
  });

  // formato que a tabela de jornada (montarJornada) já entende
  const jornada={ tipo:'fixa', descricao:'jornada resumida do espelho de ponto — confira', dias:{} };
  // montarJornada usa chaves '1'..'5','6','0'
  const mapWd={0:'0',1:'1',2:'2',3:'3',4:'4',5:'5',6:'6'};
  Object.keys(dias).forEach(wd=>{ jornada.dias[mapWd[wd]]=dias[wd]; });

  return { jornada, diasComMarca:linhas.filter(l=>l.pares.length).length, totalDias:linhas.length };
}

// ============================================================================
// PONTE 1b — HORAS APURADAS do ponto (se o extrator gerar a aba de totais)
// Se você adicionar uma aba "Totais" no Excel de auditoria com
// colunas: Rubrica | HorasMes (ex.: "HE 50%" | 1564,8), esta ponte lê e
// devolve como PREMISSA direta (a precisão do extrator).
// ============================================================================
async function pontoHorasApuradas(file){
  const wb=await _lerPlanilha(file);
  const ws=wb.Sheets['Totais']||wb.Sheets['Apuracao'];
  if(!ws) return null; // extrator não gerou totais -> usa só a jornada
  const arr=XLSX.utils.sheet_to_json(ws, {header:1}); arr.shift();
  const mapVid={ 'he 50':'heTotais','hora extra 50':'heTotais','he 100':'he100',
    'hora extra 100':'he100','domingo':'he100','art 71':'heArt71','intervalo':'heArt71',
    'adicional noturno':'adicionalNoturno','noturno':'adicionalNoturno' };
  const prem=[];
  arr.forEach(r=>{
    const desc=String(r[0]||'').toLowerCase().trim();
    const val=_brToNum(r[1]);
    if(!desc||!val) return;
    let vid=null;
    for(const k in mapVid){ if(desc.indexOf(k)>=0){ vid=mapVid[k]; break; } }
    if(!vid) return;
    prem.push({ descricao:r[0], vid, tipo:(vid==='adicionalNoturno'?'horasNot':'horas'), valor:val });
  });
  return prem.length?prem:null;
}

// ============================================================================
// PONTE 2 — HOLERITE (Excel do extrator)
// Lê a aba "Base de Dados" (formato longo) + "Salário Base Fixo".
// Produz: { salario, evolucao, pagamentos(deduções), baseINSS }
// ============================================================================
async function holeriteParaCalculo(file){
  const wb=await _lerPlanilha(file);

  // --- salário-base fixo (aba "Salário Base Fixo") ---
  const wsSal=wb.Sheets['Salário Base Fixo'];
  const evolucao=[]; let salarioAtual=0;
  if(wsSal){
    const arr=XLSX.utils.sheet_to_json(wsSal, {header:1});
    arr.forEach(r=>{
      const comp=r[0]; const val=_brToNum(r[1]);
      if(comp && /^\d{2}\/\d{4}$/.test(String(comp)) && val>0){
        const [m,a]=String(comp).split('/');
        evolucao.push({ competencia:a+'-'+m, valor:val });
        salarioAtual=val; // último = mais recente
      }
    });
  }

  // --- rubricas pagas (aba "Base de Dados") p/ deduções ---
  const wsBD=wb.Sheets['Base de Dados'];
  const pagamentos=[]; let baseINSS=0;
  if(wsBD){
    const arr=XLSX.utils.sheet_to_json(wsBD, {header:1}); arr.shift(); // cabeçalho
    // Ordem|Competência|Verba|Descrição|Natureza|Grupo|Valor
    arr.forEach(r=>{
      const comp=r[1], desc=String(r[3]||''), nat=String(r[4]||''), grp=String(r[5]||''), val=_brToNum(r[6]);
      if(!val) return;
      // só proventos mensais entram como "pago a idêntico título" (dedução OJ 415)
      if(nat==='Vencimento' && grp==='Mensal'){
        // filtra rubricas que interessam pra dedução (HE, adicional noturno, DSR)
        if(/hora extra|h\.?\s*extra|adic.*not|dsr|reflexo/i.test(desc)){
          pagamentos.push({ rubrica:desc, valor:val, competencia:String(comp) });
        }
      }
      if(/base.*inss/i.test(desc)) baseINSS+=val;
    });
  }

  return { salario:salarioAtual, evolucao, pagamentos, baseINSS };
}

// ============================================================================
// APLICADORES — despejam o resultado das pontes na tela (sem tocar no motor)
// ============================================================================
function aplicarJornadaImportada(jornada){
  // reusa montarJornada, que já sabe desenhar a tabela editável
  if(!ultimoJson) ultimoJson={};
  ultimoJson.dadosContratuais = ultimoJson.dadosContratuais||{};
  ultimoJson.dadosContratuais.jornada = jornada;
  const box=document.getElementById('jornada-box');
  if(box){ box.innerHTML = montarJornada(ultimoJson); }
}
function aplicarHorasComoPremissa(prem){
  // adiciona cada hora apurada como premissa manual (o cara vê e pode editar)
  if(!prem||!prem.length) return;
  prem.forEach(p=>{
    const id='man_'+(premissasManuais.length);
    premissasManuais.push(id);
    // guarda os valores para coletarPremissas montar (usa dataset na render)
  });
  // remonta a caixa de premissas já com os valores importados
  const box=document.getElementById('premissas-box');
  if(box && ultimoJson){ box.innerHTML=montarPremissas(ultimoJson); }
  // preenche os inputs recém-criados
  prem.forEach((p,i)=>{
    const el=document.getElementById('prem_man_'+i);
    if(el) el.value=p.valor;
  });
}
function aplicarHolerite(dados){
  if(dados.salario){ const el=document.getElementById('f_salario'); if(el) el.value=dados.salario; }
  if(dados.evolucao && dados.evolucao.length){ /* preenche evolução salarial se a tela tiver campo */ }
  // pagamentos viram lista de deduções (OJ 415) — exibir para conferência
  if(dados.pagamentos && dados.pagamentos.length){
    window._deducoesImportadas = dados.pagamentos; // guarda p/ usar na estimativa/impugnação
  }
}
