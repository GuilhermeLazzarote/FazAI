// ============================================================================
// FazAI — MÓDULO DE IMPUGNAÇÃO ao cálculo da parte contrária
// Encaixa no analise-processo.html (aba nova). Reusa ultimoJson (parecer/decisão
// já analisada) + PDF do cálculo adversário → /api/claude → impugnações sugeridas
// → calculista escolhe/edita → gera Word no estilo dele.
// ============================================================================
(function(){
'use strict';

// catálogo condensado das 44 teses (vai no prompt como memória de teses)
const CATALOGO = `CATÁLOGO DE 44 TESES (varra o cálculo do adversário contra TODAS; sugira as que baterem):
CORREÇÃO/JUROS: Índice divergente ADC 58/59 [alta]; SELIC como correção E juros/bis in idem [alta]; TRD/TR pré-judicial [alta]; data de atualização do laudo posterior à devida [conferir].
HORAS EXTRAS: adicional incorreto [média]; base de cálculo HE divergente [média]; cumulação de adicionais na base em cascata [alta]; adic. noturno na base HE [média]; auxílio-condutor/verba indenizatória na base [média]; Súmula 340/OJ 397 comissionista misto - divisor fixo 180 em variável ou hora+adicional onde só cabe adicional [alta - tese de ouro]; quantidade de HE sem cartão de ponto/lastro [média]; feriados/sábado/domingo computados com jornada seg-sex [alta]; HE intervalar art.71 divergente [média]; art.67/art.66 DSR/interjornada não deferido [média]; horas em dobro ignorando compensação [média].
ADICIONAIS: insalubridade base/grau divergente [média]; periculosidade base (deve ser salário-base) ou % divergente [média]; periculosidade sem deduzir insalubridade já paga [alta].
FGTS/REFLEXOS: FGTS sobre reflexos/bis in idem [alta - clássica]; reflexo sobre reflexo [alta]; reflexo sobre integralidade sem abater pago [média]; reflexo em aviso prévio indenizado/dias errados [média].
DEDUÇÕES: abatimento de valores pagos OJ 415 - verba cheia sem deduzir pagamentos [alta]; dedução aviso prévio em pedido de demissão [alta]; HE 60% sem deduzir folgas quitadas [média]; incentivo variável/comissões pagas não deduzidos [média]; médias já pagas não deduzidas das rescisórias [média].
RESCISÓRIAS/MULTAS: modalidade de rescisão apurada ≠ reconhecida [alta]; multa art.477 base divergente [média]; multa obrigação de fazer sem lastro [conferir]; base da estabilidade divergente [média].
CONTRIBUIÇÕES/HONORÁRIOS: INSS patronal/SAT alíquota divergente da atividade [média]; honorários sucumbenciais período/base [média]; sucumbência recíproca não apurada contra o autor [média]; honorário pericial à parte errada [conferir].
LIMITES: limitação aos valores da inicial - apuração acima da exordial [alta]; inovação recursal do reclamante [conferir]; nulidade da homologação sem contraditório [conferir]; indenização suplementar sem critério/lastro [conferir].`;

const PROMPT_IMPUGNACAO = `Você é um assistente técnico de calculista trabalhista. Sua função é redigir uma IMPUGNAÇÃO ao cálculo de liquidação apresentado pela parte contrária, confrontando cada erro do cálculo dela com os PARÂMETROS EXPRESSAMENTE DEFERIDOS na decisão.

REGRAS ABSOLUTAS:
- Você NÃO calcula e NÃO decide o mérito. Você CONFRONTA o que foi deferido com o que a parte contrária fez, e redige a impugnação técnica.
- Cada ponto de impugnação SEMPRE segue esta estrutura de 4 movimentos:
  1) O QUE FOI DEFERIDO — cite o comando expresso da decisão (com fl./súmula/OJ/tese). Use "A R. Sentença determinou, de forma EXPRESSA, ..." / "autorizou EXPRESSAMENTE ...".
  2) O QUE A PARTE CONTRÁRIA FEZ — aponte o desvio ("O cálculo da Autora não observou...", "computou X", "NÃO procedeu a qualquer dedução...").
  3) A PROVA — introduza com "Vejamos" e referencie o dado concreto (índice usado, valor apurado, dia computado).
  4) A CONCLUSÃO — feche o ponto ("Resta impugnado o cálculo obreiro." / "imprestáveis os cálculos apresentados").
- Fundamente na COISA JULGADA sempre que o desvio contrarie o deferido.
- Só impugne o que tiver base no parecer/decisão. Ponto que exija conferência humana (norma coletiva, interpretação) → confianca "conferir" e NÃO afirme.
- ESTILO: se um MODELO-BASE do calculista for fornecido, reproduza o tom, jargões e estrutura dele. Se não, use tom técnico-formal padrão.
- Além dos erros que detectar diretamente, VARRA o cálculo do adversário contra o CATÁLOGO DE TESES. Para cada tese cujo gatilho esteja presente, SUGIRA-A com a confiança correspondente. Seja a MEMÓRIA DE TESES do calculista — lembre-o de tudo que cabe. Ele decide o que entra.

`+CATALOGO+`

Responda SÓ JSON puro (começa { termina }), SEM markdown:
{"impugnacoes":[{"id":"correcao_adc58","titulo":"Índice de correção incorreto — inobservância da ADC 58/59","deferido":"o que foi deferido, com citação","o_que_fez":"o desvio do adversário","prova":"o dado concreto (índice X vs Y deferido)","conclusao":"Resta impugnado...","confianca":"certo|provavel|conferir","fundamento":"ADC 58/59, coisa julgada"}],"conclusao":"síntese dos pontos (i, ii, iii...)"}`;

// DICIONÁRIO DE NOMENCLATURA DO PJe-CALC (destilado de cálculos reais).
// O PJe-Calc gera os nomes de rubrica sempre nos mesmos padrões — este bloco
// ensina a IA a reconhecê-los ao ler QUALQUER cálculo (PJC ou PDF impresso),
// pra casar rubrica↔verba deferida por natureza e não errar como "não apurada/sem deferimento".
const DICIONARIO_PJECALC = `DICIONÁRIO DO PJe-CALC (como o PJe-Calc nomeia as rubricas — use pra casar com a verba deferida):

VERBAS PRINCIPAIS → como a decisão chama vs como o cálculo nomeia:
- Horas extras (excedentes 6ª/8ª/44ª, sobrejornada, turnos de revezamento) → "HORAS EXTRAS 50%/70%/100%/110%", quase sempre DESDOBRADAS em "... - DIURNAS", "... - NOTURNAS", "... - OJ 394". O NÚMERO (50/70/100/110%) é o ADICIONAL aplicado (legal ou da CCT) — NÃO é verba estranha, é a MESMA HE deferida. "HORAS REDUZIDAS" = hora noturna reduzida, ligada à HE noturna.
- Intervalo intrajornada (art.71 §4º) → "INTERVALO INTRAJORNADA".
- Adicional de periculosidade → "ADICIONAL DE PERICULOSIDADE 30%". Insalubridade → "ADICIONAL DE INSALUBRIDADE 40%/20%/10%".
- Indenização em dobro / dispensa discriminatória (Lei 9.029) → "DISPENSA DISCRIMINATORIA - REM EM DOBRO".
- Dano moral → "DANO MORAL". Verbas rescisórias → "SALDO DE SALÁRIO", "AVISO PRÉVIO", "FÉRIAS + 1/3", "13º SALÁRIO".
- Multas → "MULTA DO ARTIGO 477 DA CLT", "MULTA DO ARTIGO 467 DA CLT". Honorários → "HONORÁRIOS ADVOCATÍCIOS".

REFLEXOS (fórmula fixa: "<TIPO> SOBRE <VERBA-MÃE>") — são reflexos da verba-mãe citada após "SOBRE", NÃO verbas autônomas. TIPOS: "13º SALÁRIO SOBRE ...", "FÉRIAS + 1/3 SOBRE ...", "AVISO PRÉVIO SOBRE ...", "REPOUSO SEMANAL REMUNERADO E FERIADO SOBRE ..." (=DSR), "MULTA DO ARTIGO 477/467 SOBRE ...", "FGTS SOBRE ...". Se a verba-mãe foi deferida COM aquele reflexo, o reflexo está correto — NUNCA marque reflexo como "sem deferimento".

DEDUÇÕES (sufixo "PAGO"/"PAGA"): "ADICIONAL DE PERICULOSIDADE PAGO", "ADICIONAL DE INSALUBRIDADE PAGO", "ADICIONAL NOTURNO PAGO", "ADICIONAL DE REVEZAMENTO" (quando pago) = valores que o cálculo está DEDUZINDO (abatimento sob mesmo título). Presença é CORRETA quando a decisão mandou deduzir — NÃO marque "sem deferimento".

NÃO-VERBAS (aparecem como linha mas não são verba de valor a conferir): "BASE INSS", "SALARIO BASE"/"SALÁRIO BASE" (é base, não verba), nomes das PARTES (reclamante/reclamada aparecem como <nome>).`;

let impugnacoes=[], calcAdvTexto='', calcAdvB64='', modeloBase='', modoImp='impugnar';



// PROMPT de CONFERÊNCIA do próprio cálculo (mesma comparação, tom de correção)
const PROMPT_CONFERENCIA = `Você é um assistente técnico de conferência de cálculos trabalhistas. Sua função é AUDITAR um cálculo de liquidação (feito pelo PRÓPRIO calculista, do NOSSO lado) contra os PARÂMETROS EXPRESSAMENTE DEFERIDOS na decisão, ANTES de protocolar. O objetivo é PEGAR ERROS antes que a outra parte pegue.

════════════════════════════════════════════════════════════════
PASSO 0 (OBRIGATÓRIO, ANTES DE QUALQUER JULGAMENTO) — CASAR VERBA DEFERIDA ↔ RUBRICA DO CÁLCULO POR NATUREZA, NÃO POR NOME.
O cálculo é gerado no PJe-Calc, que usa NOMES DE RUBRICA DIFERENTES dos nomes que a decisão usa. NUNCA conclua "não apurada" ou "sem deferimento" por não achar o nome igual. Você DEVE mapear pela NATUREZA JURÍDICA. Regras de mapeamento (aplique TODAS):

1) DESDOBRAMENTO: uma única verba deferida vira VÁRIAS rubricas no cálculo. Some/agrupe antes de julgar. Exemplos:
   - "horas extras excedentes da 6ª/36ª" (decisão) = no cálculo aparece como "HORAS EXTRAS 70% - DIURNAS", "HORAS EXTRAS 70% - NOTURNAS", "HORAS EXTRAS 70% ... OJ 394", "HORAS EXTRAS 110%", "HORAS REDUZIDAS" etc. O percentual (70%, 110%) é o ADICIONAL DA CCT aplicado — é a MESMA verba de HE deferida, NÃO uma verba estranha. Diurna/noturna/OJ394 são recortes da mesma HE.
   - "intervalo intrajornada" (decisão) = "INTERVALO INTRAJORNADA" e seus reflexos no cálculo.
   - "indenização em dobro / dispensa discriminatória" (decisão) = "DISPENSA DISCRIMINATORIA - REM EM DOBRO" no cálculo.
   - "adicional de periculosidade" = "ADICIONAL DE PERICULOSIDADE 30%"; "dano moral" = "DANO MORAL".

2) REFLEXOS NÃO SÃO VERBAS ÓRFÃS. Rubricas que começam com "13º SALÁRIO SOBRE ...", "FÉRIAS + 1/3 SOBRE ...", "AVISO PRÉVIO SOBRE ...", "REPOUSO SEMANAL REMUNERADO E FERIADO SOBRE ...", "MULTA DO ARTIGO 477 SOBRE ...", "FGTS SOBRE ..." são REFLEXOS da verba-mãe citada depois do "SOBRE". Se a verba-mãe foi deferida com aquele reflexo, o reflexo ESTÁ CORRETO — jamais marque "sem deferimento". Só é problema se o reflexo existir SEM a verba-mãe ter reflexo deferido, ou faltar um reflexo que foi deferido.

3) "PAGO" = DEDUÇÃO, não deferimento. Rubricas "ADICIONAL DE PERICULOSIDADE PAGO", "ADICIONAL NOTURNO PAGO", "ADICIONAL DE INSALUBRIDADE PAGO", "ADICIONAL DE REVEZAMENTO" (pago) são VALORES QUE O CÁLCULO ESTÁ DEDUZINDO (abatimento de valores pagos sob mesmo título). Presença delas é CORRETA quando a decisão mandou deduzir. NÃO as marque "sem deferimento".

4) NEM TUDO QUE FOI DEFERIDO É LINHA DE VALOR. Obrigações de fazer (retificar PPP), declarações (nulidade de compensação, dispensa discriminatória em si), e comandos de dedução/parâmetro (dedução do adicional de turno, opção insalubridade×periculosidade) NÃO são "verbas a apurar". NÃO as marque "não apurada" — elas não geram rubrica de valor. Trate-as como parâmetro/comando, não como pendência de apuração.

5) SÓ conclua "NÃO APURADA" se, DEPOIS de casar por natureza, desdobramento e reflexo, a verba deferida (que gera valor) realmente não tiver NENHUMA rubrica correspondente no cálculo. SÓ conclua "SEM DEFERIMENTO" se uma rubrica de valor não corresponder a NENHUMA verba deferida NEM for reflexo/dedução de uma. Antes de afirmar qualquer um dos dois, releia o mapeamento — esses dois erros normalmente são o MESMO item mal casado, contado dos dois lados.
════════════════════════════════════════════════════════════════

REGRAS ABSOLUTAS:
- Você NÃO calcula e NÃO refaz a conta. Você CONFERE CRITÉRIOS: se o cálculo respeitou o índice de correção deferido, a base, o período, as deduções, a limitação, os reflexos — os PARÂMETROS da decisão. NÃO valida a aritmética (isso é do Excel).
- Você APONTA possíveis problemas, NÃO garante que o cálculo está certo. Um item não apontado NÃO significa que está correto — significa que você não encontrou divergência de critério legível. Deixe isso claro.
- Para cada possível problema encontrado, use esta estrutura:
  1) PARÂMETRO DEFERIDO — o que a decisão determinou (com fl./súmula/OJ).
  2) O QUE O CÁLCULO FEZ — o que você observou no cálculo conferido (cite a rubrica do PJe-Calc pelo nome que ela tem no cálculo).
  3) DIVERGÊNCIA — em que ponto diverge, e o risco (a outra parte pode impugnar isto).
  4) SUGESTÃO — o que revisar/corrigir antes de protocolar.
- Varra o cálculo contra o CATÁLOGO DE TESES (abaixo): se um gatilho estiver presente NO NOSSO cálculo, é um ponto que a parte contrária poderia impugnar — sinalize para o calculista blindar antes.
- Confiança: "erro claro" (divergência nítida de critério, com verba corretamente casada), "provável" (indício, conferir), "conferir" (depende do processo, só lembrete).
- NÃO invente problema. Se o cálculo parece respeitar o parâmetro, não force um alerta. Falso alarme faz o calculista perder confiança na ferramenta. ERRO DE CASAMENTO (marcar como divergência algo que é a mesma verba com outro nome) é o PIOR falso alarme — evite-o com o PASSO 0.

`;



// chamado quando o usuário sobe o PDF do cálculo adversário
// extrai rubricas estruturadas do XML do PJe-Calc (.PJC) — texto limpo pra IA casar
function extrairRubricasPJC(xml){
  // Lê o XML do PJe-Calc como árvore (DOMParser nativo do navegador).
  // REGRA DE OURO do PJe-Calc: rubrica com <ativo>true</ativo> está sendo APURADA;
  // <ativo>false</ativo> é esqueleto desligado (não conta). Só as ativas vão pra IA.
  // Captura também as incidências (FGTS/INSS/IRPF) — é assim que o FGTS aparece no PJC
  // (não é rubrica com nome, é incidência marcada em cada verba).
  const ativas=[]; const partes=[];
  try{
    const doc=new DOMParser().parseFromString(xml,'text/xml');
    if(doc.querySelector('parsererror')) throw new Error('xml inválido');
    // varre todo elemento que tenha um filho <nome> direto
    const todos=doc.getElementsByTagName('*');
    const vistos={};
    for(let i=0;i<todos.length;i++){
      const el=todos[i];
      // filho <nome> direto?
      let nomeEl=null, ativoEl=null;
      for(let j=0;j<el.children.length;j++){
        const c=el.children[j];
        if(c.tagName==='nome' && !nomeEl) nomeEl=c;
        if(c.tagName==='ativo' && !ativoEl) ativoEl=c;
      }
      if(!nomeEl || !nomeEl.textContent) continue;
      const nome=nomeEl.textContent.trim();
      if(nome.length<3 || vistos[nome]) continue;
      // partes (reclamante/reclamada) não são rubricas — geralmente sem <ativo>
      if(!ativoEl){ 
        // pode ser nome de parte — guarda separado, não polui a lista de verbas
        if(nome===nome.toUpperCase() && /LTDA|S\.?A\.?|EIRELI|ME$|LUCINDO|SILVA|SANTOS/.test(nome)) partes.push(nome);
        continue;
      }
      vistos[nome]=1;
      // SÓ conta se ativo=true (apurada)
      if(ativoEl.textContent.trim()!=='true') continue;
      const inc=[];
      for(let j=0;j<el.children.length;j++){
        const c=el.children[j];
        if(c.tagName==='incidenciaFGTS' && c.textContent==='true') inc.push('FGTS');
        if(c.tagName==='incidenciaINSS' && c.textContent==='true') inc.push('INSS');
        if(c.tagName==='incidenciaIRPF' && c.textContent==='true') inc.push('IRPF');
      }
      ativas.push(inc.length ? nome+' [incide: '+inc.join(', ')+']' : nome);
    }
  }catch(e){
    // fallback: se o DOMParser falhar, usa o regex antigo (pega tudo, sem filtro de ativo)
    const re=/<(?:nome|descricao)>([^<]{3,70})<\/(?:nome|descricao)>/g;
    let m, vistos={};
    while((m=re.exec(xml))){
      let v=m[1].trim().replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&amp;/g,'&');
      if(v===v.toUpperCase() && v.length>3 && !vistos[v]){ vistos[v]=1; ativas.push(v); }
    }
  }
  return ativas;
}

async function onCalcAdversario(input){
  const f=input.files[0]; if(!f) return;
  const st=document.getElementById('imp-status');
  st.innerHTML='Lendo o cálculo…';
  try{
    const ab=await f.arrayBuffer();
    const nome=(f.name||'').toLowerCase();
    calcAdvTexto=''; calcAdvB64='';

    // --- É .PJC (formato nativo do PJe-Calc)? ---
    if(nome.endsWith('.pjc') || nome.endsWith('.xml')){
      const bytes=new Uint8Array(ab);
      let xml='';
      // Detecção robusta: primeiro tenta ler como texto e ver se JÁ é XML (caso mais comum do PJe-Calc).
      // Só usa a fflate se for REALMENTE um zip (magic PK) E o conteúdo não for XML legível.
      const cab=new TextDecoder('utf-8',{fatal:false}).decode(bytes.slice(0,200));
      const pareceXml = /<\?xml|<Calculo|<calculo/i.test(cab);
      const ehZip = (bytes[0]===0x50 && bytes[1]===0x4B) && !pareceXml;
      if(ehZip){
        if(!window.fflate){ st.innerHTML='<span style="color:#a11">Este .PJC está compactado e a biblioteca de leitura não carregou. Recarregue a página e tente de novo.</span>'; return; }
        try{
          const files=window.fflate.unzipSync(bytes);
          const chave=Object.keys(files)[0];
          xml=window.fflate.strFromU8(files[chave]);
        }catch(e){ st.innerHTML='<span style="color:#a11">Não consegui descompactar o .PJC: '+e.message+'</span>'; return; }
      } else {
        // XML direto (caso mais comum) — respeita o encoding declarado (PJe-Calc às vezes usa ISO-8859-1)
        const enc=/ISO-8859-1|iso-8859-1|latin1/i.test(cab)?'iso-8859-1':'utf-8';
        try{ xml=new TextDecoder(enc).decode(bytes); }
        catch(e){ xml=new TextDecoder('utf-8').decode(bytes); }
      }
      const rubricas=extrairRubricasPJC(xml);
      if(rubricas.length){
        calcAdvTexto='CÁLCULO DO PJe-CALC — SOMENTE as rubricas EFETIVAMENTE APURADAS (ativo=true no XML; as zeradas/desligadas já foram excluídas). Estas são as verbas que o cálculo REALMENTE gerou:\n- '+rubricas.join('\n- ')+'\n\nOBSERVAÇÕES IMPORTANTES SOBRE ESTA LISTA (para não gerar falso positivo):\n1. Esta lista já contém APENAS o que está sendo apurado. Se uma rubrica/reflexo NÃO aparece aqui, é porque NÃO está sendo calculada — NÃO aponte como "reflexo indevido presente" algo que não está na lista.\n2. O FGTS no PJe-Calc NÃO é uma rubrica com nome próprio — ele é uma INCIDÊNCIA marcada em cada verba (aparece como "[incide: FGTS]" ao lado da rubrica). Se uma verba tem "[incide: FGTS]", o FGTS ESTÁ sendo apurado sobre ela. NUNCA aponte "falta FGTS" — verifique as incidências ao lado de cada rubrica.\n3. Os reflexos que aparecem na lista (13º SOBRE, FÉRIAS SOBRE, AVISO SOBRE, RSR SOBRE) são os que ESTÃO sendo apurados. Confira se cada um tem amparo na decisão. Reflexo que NÃO está na lista = não apurado = não é problema.';
        st.innerHTML='<span class="okmsg">✓ '+f.name+' lido (.PJC estruturado) — '+rubricas.length+' rubricas.</span> Clique no botão para gerar.';
        document.getElementById('imp-gerar').disabled=false;
        input.value=''; return;
      }
      st.innerHTML='<span style="color:#a11">Li o .PJC mas não encontrei rubricas reconhecíveis. Tente subir o cálculo em PDF.</span>'; input.value=''; return;
    }

    // --- PDF (padrão, e único caminho pra cálculo do adversário) ---
    let texto='';
    try{
      const pdf=await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
      for(let i=1;i<=pdf.numPages;i++){ const pg=await pdf.getPage(i); const c=await pg.getTextContent(); texto+=c.items.map(x=>x.str).join(' ')+'\n'; }
    }catch(e){ texto=''; }
    calcAdvTexto=texto.trim();
    const bytes=new Uint8Array(ab); let bin=''; for(let i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]);
    calcAdvB64=btoa(bin);
    const md = calcAdvTexto.length>200 ? 'texto' : 'imagem (escaneado)';
    st.innerHTML='<span class="okmsg">✓ '+f.name+' carregado</span> — leitura por '+md+'. Clique no botão para gerar.';
    document.getElementById('imp-gerar').disabled=false;
  }catch(e){ st.innerHTML='<span style="color:#a11">Erro ao ler: '+e.message+'</span>'; }
  input.value='';
}

// campo de modelo-base (estilo do calculista) — opcional
function setModeloBase(txt){ modeloBase=txt||''; }

async function gerarImpugnacao(){
  const st=document.getElementById('imp-status');
  const ehConf = modoImp==='conferir';
  if(typeof ultimoJson==='undefined' || !ultimoJson){ st.innerHTML='<span style="color:#a11">Analise a decisão primeiro (aba Resumo).</span>'; return; }
  if(!calcAdvTexto && !calcAdvB64){ st.innerHTML='<span style="color:#a11">Suba o PDF do cálculo'+(ehConf?' que você fez':' da parte contrária')+'.</span>'; return; }
  document.getElementById('imp-gerar').disabled=true;
  st.innerHTML='<span class="hint">'+(ehConf?'Conferindo seu cálculo contra os parâmetros deferidos':'Confrontando o cálculo da parte contrária com os parâmetros deferidos')+'… pode levar até 1 minuto.</span>';
  try{
    // monta o parecer (parâmetros deferidos) a partir do ultimoJson
    const parecer = JSON.stringify({
      processo: ultimoJson.processo,
      verbas: (ultimoJson.verbas||[]).filter(v=>v.statusFinal==='DEFERIDA'),
      parametrosGlobais: ultimoJson.parametrosGlobais,
      dadosContratuais: ultimoJson.dadosContratuais
    });
    const partes=[];
    partes.push({type:'text', text:'PARÂMETROS DEFERIDOS NA DECISÃO (do parecer):\n'+parecer});
    if(!ehConf && modeloBase) partes.push({type:'text', text:'\n\nMODELO-BASE DO CALCULISTA (siga este estilo):\n'+modeloBase});
    const rotuloCalc = ehConf ? 'CÁLCULO A CONFERIR (feito pelo próprio calculista)' : 'CÁLCULO DA PARTE CONTRÁRIA';
    if(calcAdvTexto && calcAdvTexto.length>200){
      partes.push({type:'text', text:'\n\n'+rotuloCalc+' (texto extraído):\n'+calcAdvTexto});
    } else {
      partes.push({type:'document', source:{type:'base64',media_type:'application/pdf',data:calcAdvB64}});
      partes.push({type:'text', text:'\n\n(acima: PDF do '+rotuloCalc.toLowerCase()+')'});
    }
    const PROMPT = (ehConf ? (PROMPT_CONFERENCIA+CATALOGO+'\n\nResponda SÓ JSON puro (começa { termina }), SEM markdown:\n{"impugnacoes":[{"id":"correcao_adc58","titulo":"...","deferido":"parâmetro deferido","o_que_fez":"o que o cálculo fez","prova":"a divergência e o risco","conclusao":"sugestão de correção","confianca":"certo|provavel|conferir","fundamento":"..."}],"conclusao":"síntese dos pontos a revisar"}') : PROMPT_IMPUGNACAO) + '\n\n' + DICIONARIO_PJECALC;
    partes.push({type:'text', text:'\n\n---\n'+PROMPT});

    const res=await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-5',max_tokens:16000,messages:[{role:'user',content:partes}]})});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Erro na API');
    const txt=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
    const obj=extrairJsonImp(txt);
    if(!obj||!obj.impugnacoes) throw new Error('Não consegui montar as sugestões. Tente um PDF mais legível.');
    impugnacoes=obj.impugnacoes.map((im,i)=>Object.assign({incluir:im.confianca==='certo', _i:i}, im));
    window._impConclusao=obj.conclusao||'';
    renderImpugnacoes();
    st.innerHTML='<span class="okmsg">✓ '+impugnacoes.length+' pontos sugeridos. Marque os que quer incluir, edite o texto, e gere o documento.</span>';
  }catch(e){ st.innerHTML='<span style="color:#a11">'+e.message+'</span>'; document.getElementById('imp-gerar').disabled=false; }
}

function extrairJsonImp(txt){
  if(!txt) return null;
  const t=[]; let m=txt.match(/```json\s*([\s\S]*?)```/i); if(m)t.push(m[1]);
  m=txt.match(/```\s*([\s\S]*?)```/); if(m)t.push(m[1]);
  const a=txt.indexOf('{'),b=txt.lastIndexOf('}'); if(a>=0&&b>a)t.push(txt.slice(a,b+1)); t.push(txt);
  for(const c of t){ try{ return JSON.parse(c.trim()); }catch(e){} } return null;
}
function escImp(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function renderImpugnacoes(){
  const box=document.getElementById('imp-lista'); if(!box) return;
  const ehConf = modoImp==='conferir';
  const cor={certo:'#1B7A3D',provavel:'#c9820a',conferir:'#8a5a1a'};
  const lbl={certo:'erro claro',provavel:'provável',conferir:'conferir'};
  // rótulos dos 4 campos mudam entre impugnar e conferir
  const R = ehConf
    ? {deferido:'Parâmetro deferido', o_que_fez:'O que seu cálculo fez', prova:'Divergência / risco', conclusao:'Sugestão de correção'}
    : {deferido:'Deferido', o_que_fez:'O que fez', prova:'Prova', conclusao:'Conclusão'};
  let h='';
  impugnacoes.forEach((im,i)=>{
    const c=cor[im.confianca]||'#666';
    h+='<div class="imp-card" style="border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px;background:'+(im.incluir?'#fff':'#f7f9fc')+'">';
    h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
    h+='<input type="checkbox" '+(im.incluir?'checked':'')+' onchange="_impToggle('+i+',this.checked)" style="width:18px;height:18px">';
    h+='<b style="flex:1">'+escImp(im.titulo)+'</b>';
    h+='<span style="font-size:11px;font-weight:700;color:'+c+';border:1px solid '+c+';border-radius:10px;padding:2px 8px">'+(lbl[im.confianca]||im.confianca)+'</span>';
    h+='</div>';
    h+='<div style="font-size:13px;color:#444;display:grid;gap:6px">';
    h+='<div><b style="color:var(--navy)">'+R.deferido+':</b> <span contenteditable oninput="_impEdit('+i+',\'deferido\',this.textContent)">'+escImp(im.deferido)+'</span></div>';
    h+='<div><b style="color:var(--navy)">'+R.o_que_fez+':</b> <span contenteditable oninput="_impEdit('+i+',\'o_que_fez\',this.textContent)">'+escImp(im.o_que_fez)+'</span></div>';
    h+='<div><b style="color:var(--navy)">'+R.prova+':</b> <span contenteditable oninput="_impEdit('+i+',\'prova\',this.textContent)">'+escImp(im.prova)+'</span></div>';
    h+='<div><b style="color:var(--navy)">'+R.conclusao+':</b> <span contenteditable oninput="_impEdit('+i+',\'conclusao\',this.textContent)">'+escImp(im.conclusao)+'</span></div>';
    if(im.fundamento) h+='<div style="font-size:12px;color:var(--muted)">Fundamento: '+escImp(im.fundamento)+'</div>';
    h+='</div></div>';
  });
  box.innerHTML=h;
  document.getElementById('imp-acoes').style.display='block';
}
function _impToggle(i,v){ impugnacoes[i].incluir=v; renderImpugnacoes(); }
function _impEdit(i,campo,val){ impugnacoes[i][campo]=val; }

// gera o documento Word (usa a lib docx já carregada no app)
async function gerarWordImpugnacao(){
  const st=document.getElementById('imp-status');
  const sel=impugnacoes.filter(im=>im.incluir);
  if(!sel.length){ st.innerHTML='<span style="color:#a11">Marque ao menos um ponto para incluir.</span>'; return; }
  const ehConf = modoImp==='conferir';
  const proc=(ultimoJson&&ultimoJson.processo)||{};
  const nomeArq=(ehConf?'Conferencia_':'Impugnacao_')+((proc.numero||'caso').replace(/[^\w]/g,'_').slice(0,30))+'.docx';

  // ---- CAMINHO NOVO: casca visual FazAI (esqueleto profissional) ----
  if(window.FazAIDocx && window.docx){
    try{
      const F=window.FazAIDocx;
      const tituloDoc = ehConf ? 'Laudo de Conferência do Cálculo' : 'Impugnação aos Cálculos de Liquidação';
      const subtitulo = ehConf ? 'Conferência interna — pontos a revisar antes de protocolar' : 'Confronto do cálculo apresentado com os parâmetros deferidos';
      const blocos=[];
      // título + subtítulo (casca)
      blocos.push(...F.titulo(tituloDoc, subtitulo));
      // aviso de não-validação (só na conferência)
      if(ehConf) blocos.push(F.par('Documento interno. NÃO é validação: itens não apontados não estão automaticamente corretos. Nenhuma aritmética foi verificada — apenas critérios e enquadramento das rubricas frente aos parâmetros deferidos.',{ital:true,color:F.MARCA.txtFraco,size:17}));
      blocos.push(F.esp(60));
      // 1. Identificação (tabela 2 colunas — pula linha sem valor)
      blocos.push(F.secao(1,'Identificação'));
      blocos.push(F.tabela2col([
        ['Nº do processo', proc.numero],
        ['Reclamante', proc.reclamante],
        ['Reclamada(s)', (proc.reclamadas||[]).join(', ')],
        ['Vara / Tribunal', proc.vara],
        ['Objeto', ehConf?'Conferência interna do cálculo':'Impugnação ao cálculo da parte contrária']
      ]));
      blocos.push(F.esp(80));
      // 2. Pontos (cada um como bloco numerado, no esqueleto)
      blocos.push(F.secao(2, ehConf?'Pontos a revisar':'Pontos de impugnação'));
      sel.forEach((im,idx)=>{
        // título do ponto + badge de confiança embutido no texto
        const conf = im.confianca==='certo'?'erro claro':(im.confianca==='provavel'?'provável':'conferir');
        blocos.push(F.blocoNum(idx+1, im.titulo+'  ('+conf+')', ''));
        if(F.temValor(im.deferido))  blocos.push(F.par((ehConf?'Parâmetro deferido: ':'Deferido: ')+im.deferido,{size:19}));
        if(F.temValor(im.o_que_fez)) blocos.push(F.par((ehConf?'O que o cálculo fez: ':'O que fez: ')+im.o_que_fez,{size:19}));
        if(F.temValor(im.prova))     blocos.push(F.par((ehConf?'Divergência / risco: ':'Prova: ')+im.prova,{size:19}));
        if(F.temValor(im.conclusao)) blocos.push(F.par((ehConf?'Sugestão de correção: ':'Conclusão: ')+im.conclusao,{bold:true,size:19}));
        if(F.temValor(im.fundamento))blocos.push(F.par('Fundamento: '+im.fundamento,{ital:true,color:F.MARCA.txtFraco,size:17}));
        blocos.push(F.esp(60));
      });
      // 3. Conclusão (se houver)
      if(window._impConclusao){
        blocos.push(F.secao(3,'Conclusão'));
        blocos.push(F.par(window._impConclusao,{size:19}));
      }
      const blob=await F.montarDoc(blocos);
      F.baixar(blob, nomeArq);
      st.innerHTML='<span class="okmsg">✓ '+(ehConf?'Laudo de conferência gerado':'Impugnação gerada')+' ('+sel.length+' pontos), no modelo FazAI. '+(ehConf?'Revise e corrija antes de protocolar.':'Confira e ajuste antes de protocolar.')+'</span>';
      return;
    }catch(e){ /* se a casca falhar, cai no gerador simples abaixo */ console.warn('casca falhou, usando gerador simples:',e); }
  }

  // ---- FALLBACK: gerador simples (caso a casca não carregue) ----
  try{
    const D=window.docx; if(!D) throw new Error('A biblioteca que gera o Word não carregou. Recarregue a página (Ctrl+Shift+R).');
    const paras=[];
    const P=(txt,o)=>new D.Paragraph(Object.assign({children:[new D.TextRun(txt)]},o||{}));
    const tituloDoc = ehConf ? 'LAUDO DE CONFERÊNCIA DO CÁLCULO' : 'IMPUGNAÇÃO AOS CÁLCULOS DE LIQUIDAÇÃO';
    paras.push(new D.Paragraph({alignment:D.AlignmentType.CENTER,children:[new D.TextRun({text:tituloDoc,bold:true,size:28})]}));
    paras.push(P(''));
    if(ehConf) paras.push(P('Documento interno de conferência — pontos a revisar antes de protocolar. NÃO é validação: itens não apontados não estão automaticamente corretos.',{spacing:{after:160}}));
    if(proc.numero) paras.push(P('Processo nº '+proc.numero,{spacing:{after:120}}));
    if(proc.vara) paras.push(P(proc.vara,{spacing:{after:200}}));
    sel.forEach((im,idx)=>{
      paras.push(new D.Paragraph({spacing:{before:200,after:80},children:[new D.TextRun({text:(idx+1)+'. '+im.titulo,bold:true})]}));
      if(im.deferido) paras.push(P(im.deferido,{spacing:{after:80},alignment:D.AlignmentType.JUSTIFIED}));
      if(im.o_que_fez) paras.push(P(im.o_que_fez,{spacing:{after:80},alignment:D.AlignmentType.JUSTIFIED}));
      if(im.prova) paras.push(P(im.prova,{spacing:{after:80},alignment:D.AlignmentType.JUSTIFIED}));
      if(im.conclusao) paras.push(new D.Paragraph({spacing:{after:120},alignment:D.AlignmentType.JUSTIFIED,children:[new D.TextRun({text:im.conclusao,bold:true})]}));
    });
    if(window._impConclusao){
      paras.push(new D.Paragraph({spacing:{before:200,after:80},children:[new D.TextRun({text:'CONCLUSÃO',bold:true})]}));
      paras.push(P(window._impConclusao,{alignment:D.AlignmentType.JUSTIFIED}));
    }
    const doc=new D.Document({sections:[{properties:{},children:paras}]});
    const blob=await D.Packer.toBlob(doc);
    const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=nomeArq; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
    st.innerHTML='<span class="okmsg">✓ '+(ehConf?'Laudo de conferência gerado':'Impugnação gerada')+' ('+sel.length+' pontos).</span>';
  }catch(e){ st.innerHTML='<span style="color:#a11">Erro ao gerar Word: '+e.message+'</span>'; }
}

// troca o modo (impugnar/conferir) e atualiza a UI
function setModo(m){
  modoImp = (m==='conferir') ? 'conferir' : 'impugnar';
  const ehConf = modoImp==='conferir';
  // botões do seletor
  const b1=document.getElementById('imp-modo-impugnar'), b2=document.getElementById('imp-modo-conferir');
  if(b1&&b2){ b1.className='seg-btn'+(ehConf?'':' on'); b2.className='seg-btn'+(ehConf?' on':''); }
  // rótulo do upload
  const lu=document.getElementById('imp-label-upload'); if(lu) lu.textContent = ehConf ? '1. Seu cálculo, o que você fez (PDF)' : '1. Cálculo da parte contrária (PDF)';
  const bu=document.getElementById('imp-btn-upload'); if(bu) bu.innerHTML = (ehConf?'📄 Selecionar seu cálculo (.PJC ou PDF)':'📄 Selecionar cálculo adversário (PDF)')+bu.querySelector('input').outerHTML;
  // campo modelo-base só faz sentido na impugnação
  const bm=document.getElementById('imp-bloco-modelo'); if(bm) bm.style.display = ehConf ? 'none' : 'block';
  // texto do botão gerar e do subtítulo
  const bg=document.getElementById('imp-gerar'); if(bg) bg.textContent = ehConf ? 'Conferir meu cálculo' : 'Gerar sugestões de impugnação';
  const sub=document.getElementById('imp-subtitulo'); if(sub) sub.innerHTML = ehConf
    ? 'Suba <b>o cálculo que você mesmo fez</b>. O sistema confere se ele respeitou os parâmetros deferidos e aponta pontos a revisar <b>antes de protocolar</b> — para você blindar contra a impugnação da outra parte. <b>Aponta possíveis problemas; não é validação nem recálculo.</b>'
    : 'Suba o <b>PDF do cálculo da parte contrária</b>. O sistema confronta cada parâmetro deferido com o que ela fez, varre o catálogo de 44 teses, e sugere os pontos de impugnação — você escolhe, edita e gera o documento no seu estilo. <b>O sistema sugere; você decide.</b>';
  // limpa resultados ao trocar de modo
  impugnacoes=[]; const box=document.getElementById('imp-lista'); if(box) box.innerHTML='';
  const ac=document.getElementById('imp-acoes'); if(ac) ac.style.display='none';
  const stt=document.getElementById('imp-status'); if(stt) stt.innerHTML='';
}

// expõe no window
window.onCalcAdversario=onCalcAdversario;
window.gerarImpugnacao=gerarImpugnacao;
window.gerarWordImpugnacao=gerarWordImpugnacao;
window.setModeloBase=setModeloBase;
window.setModo=setModo;
window._impToggle=_impToggle;
window._impEdit=_impEdit;
window.renderImpugnacoesAba=function(){ /* placeholder pro HTML montar a aba */ };

})();
