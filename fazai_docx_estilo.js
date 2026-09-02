// ============================================================================
// FazAI — CASCA VISUAL ÚNICA para todos os documentos Word (parecer, conferência,
// impugnação). Esqueleto e formato FIXOS (identidade FazAI); conteúdo é de cada doc.
// Paleta extraída do template real: azul 16213D / escuro 0F1830 / laranja E8590C /
// fundo F4F5F7 / textos cinza. Fonte Calibri. Pronto para white-label (troque MARCA).
// REGRA DE OURO: se faltar dado, PULA o tópico — nunca deixa seção em branco.
// ============================================================================
(function(global){
'use strict';

// ---- MARCA (troque para white-label) ----
const MARCA = {
  nome:'FazAI Tech',
  tagline:'Cálculos Judiciais Trabalhistas',
  site:'fazai.tech',
  rodape:'FazAI Tech · Cálculos Judiciais Trabalhistas · fazai.tech',
  azul:'16213D', azulEscuro:'0F1830', laranja:'E8590C',
  fundo:'F4F5F7', linha:'D7DCE6',
  txt:'2B2B2B', txtSuave:'4A4A4A', txtFraco:'7A7A7A', branco:'FFFFFF'
};

// helpers dependem da lib docx (window.docx) já carregada
function D(){ return global.docx; }
function temValor(v){
  if(v==null) return false;
  if(typeof v==='string') return v.trim()!=='' && v.trim()!=='—' && v.trim()!=='-';
  if(Array.isArray(v)) return v.length>0;
  return true;
}

// —— blocos reutilizáveis da casca ——

// título de documento (topo)
function titulo(texto, subtitulo){
  const d=D(); const out=[];
  out.push(new d.Paragraph({spacing:{after:subtitulo?40:120},children:[new d.TextRun({text:texto,bold:true,color:MARCA.azul,size:34,font:'Calibri'})]}));
  if(temValor(subtitulo)) out.push(new d.Paragraph({spacing:{after:160},children:[new d.TextRun({text:subtitulo,italics:true,color:MARCA.txtFraco,size:20,font:'Calibri'})]}));
  return out;
}

// cabeçalho de seção numerada: "01 · Identificação"
function secao(num, nome){
  const d=D();
  return new d.Paragraph({spacing:{before:260,after:120},children:[
    new d.TextRun({text:(num?String(num).padStart(2,'0')+'  ·  ':''),bold:true,color:MARCA.laranja,size:22,font:'Calibri'}),
    new d.TextRun({text:nome,bold:true,color:MARCA.azul,size:22,font:'Calibri'})
  ]});
}

// tabela 2 colunas (rótulo | valor) — PULA linhas sem valor
function tabela2col(pares, larguras){
  const d=D();
  const rows=(pares||[]).filter(p=>temValor(p[1])).map(p=>new d.TableRow({children:[
    celula(p[0],{w:(larguras&&larguras[0])||2800,bold:true,fill:MARCA.fundo}),
    celula(p[1],{w:(larguras&&larguras[1])||6200})
  ]}));
  if(!rows.length) return null; // seção inteira sem dado → pula
  return new d.Table({columnWidths:[(larguras&&larguras[0])||2800,(larguras&&larguras[1])||6200],width:{size:9000,type:d.WidthType.DXA},rows});
}

// tabela com cabeçalho colorido (para síntese/memória/segregação)
function tabelaCab(cabecalhos, linhas, larguras){
  const d=D();
  if(!linhas || !linhas.length) return null; // sem linhas → pula
  const head=new d.TableRow({tableHeader:true,children:cabecalhos.map((c,i)=>celula(c,{head:true,w:larguras[i]}))});
  const rows=[head];
  linhas.forEach(ln=>{
    rows.push(new d.TableRow({children:ln.map((v,i)=>{
      // permite [texto, {fill}] por célula
      if(Array.isArray(v)) return celula(v[0],Object.assign({w:larguras[i]},v[1]||{}));
      return celula(v,{w:larguras[i]});
    })}));
  });
  return new d.Table({columnWidths:larguras,width:{size:larguras.reduce((a,b)=>a+b,0),type:d.WidthType.DXA},rows});
}

function celula(txt,opts){
  opts=opts||{}; const d=D();
  const fill = opts.head?MARCA.azul:(opts.fill||undefined);
  return new d.TableCell({
    width:{size:opts.w||2000,type:d.WidthType.DXA},
    shading: fill?{type:d.ShadingType.CLEAR,color:'auto',fill}:undefined,
    margins:{top:60,bottom:60,left:100,right:100},
    children:[new d.Paragraph({children:[new d.TextRun({
      text:String(txt==null?'':txt),
      bold:!!opts.head||!!opts.bold,
      color:opts.head?MARCA.branco:(opts.color||MARCA.txt),
      size:opts.size||18, font:'Calibri'
    })]})]
  });
}

// parágrafo simples
function par(txt,opts){
  opts=opts||{}; const d=D();
  if(!temValor(txt)) return null;
  return new d.Paragraph({spacing:{after:opts.after==null?100:opts.after},
    children:[new d.TextRun({text:txt,bold:opts.bold,italics:opts.ital,color:opts.color||MARCA.txt,size:opts.size||20,font:'Calibri'})]});
}

// bloco numerado (para "Premissas de cálculo": 01 título + corpo)
function blocoNum(num, tituloB, corpo){
  const d=D();
  if(!temValor(corpo) && !temValor(tituloB)) return null;
  const kids=[];
  if(temValor(tituloB)) kids.push(new d.TextRun({text:tituloB,bold:true,color:MARCA.azul,size:19,font:'Calibri'}));
  if(temValor(tituloB) && temValor(corpo)) kids.push(new d.TextRun({text:'  —  ',color:MARCA.txtFraco,size:19,font:'Calibri'}));
  if(temValor(corpo)) kids.push(new d.TextRun({text:corpo,color:MARCA.txt,size:19,font:'Calibri'}));
  return new d.Paragraph({spacing:{after:100},children:[
    new d.TextRun({text:(num?String(num).padStart(2,'0')+'  ':''),bold:true,color:MARCA.laranja,size:19,font:'Calibri'}),
    ...kids
  ]});
}

// box de destaque no topo (ex.: valores do crédito) — tabela sombreada
function boxDestaque(pares){
  const d=D();
  const validos=(pares||[]).filter(p=>temValor(p[1]));
  if(!validos.length) return null;
  const rows=validos.map(p=>new d.TableRow({children:[
    new d.TableCell({width:{size:3400,type:d.WidthType.DXA},shading:{type:d.ShadingType.CLEAR,color:'auto',fill:MARCA.azul},margins:{top:80,bottom:80,left:140,right:100},
      children:[new d.Paragraph({children:[new d.TextRun({text:String(p[0]),bold:true,color:MARCA.branco,size:18,font:'Calibri'})]})]}),
    new d.TableCell({width:{size:5600,type:d.WidthType.DXA},shading:{type:d.ShadingType.CLEAR,color:'auto',fill:MARCA.fundo},margins:{top:80,bottom:80,left:140,right:100},
      children:[new d.Paragraph({children:[new d.TextRun({text:String(p[1]),bold:true,color:MARCA.azul,size:20,font:'Calibri'})]})]})
  ]}));
  return new d.Table({columnWidths:[3400,5600],width:{size:9000,type:d.WidthType.DXA},rows});
}

// espaçador
function esp(depois){ const d=D(); return new d.Paragraph({spacing:{after:depois||120},children:[new d.TextRun({text:'',font:'Calibri'})]}); }

// monta cabeçalho/rodapé FazAI (para o Document)
function headerFooter(){
  const d=D();
  return {
    headers:{default:new d.Header({children:[new d.Paragraph({alignment:d.AlignmentType.RIGHT,children:[
      new d.TextRun({text:MARCA.nome,bold:true,color:MARCA.azul,size:16,font:'Calibri'}),
      new d.TextRun({text:'  ·  '+MARCA.tagline,color:MARCA.txtFraco,size:14,font:'Calibri'})
    ]})]})},
    footers:{default:new d.Footer({children:[new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[
      new d.TextRun({text:MARCA.rodape,color:MARCA.txtFraco,size:14,font:'Calibri'})
    ]})]})}
  };
}

// monta o Document final a partir de uma lista de blocos (já filtrados de nulos)
async function montarDoc(blocos){
  const d=D();
  const kids=(blocos||[]).filter(Boolean); // REGRA: nulos (seções vazias) somem
  const hf=headerFooter();
  const doc=new d.Document({sections:[{
    properties:{page:{margin:{top:1100,bottom:1100,left:1000,right:1000}}},
    headers:hf.headers, footers:hf.footers,
    children:kids
  }]});
  return await d.Packer.toBlob(doc);
}

// dispara download
function baixar(blob, nome){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=nome; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

// checagem amigável da lib (mensagem clara, não "falta de modelo")
function libOk(){
  if(!D()){ return false; }
  return true;
}

// expõe a casca
global.FazAIDocx = {
  MARCA, temValor, titulo, secao, tabela2col, tabelaCab, celula, par, blocoNum,
  boxDestaque, esp, montarDoc, baixar, libOk
};

})(typeof window!=='undefined'?window:this);
