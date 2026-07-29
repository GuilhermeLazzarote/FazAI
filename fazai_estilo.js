// Camada de estilo PJe-Calc via exceljs (aplicada sobre o arquivo do engine, sem tocar no cálculo)
async function aplicarEstiloPjeCalc(buffer, ExcelJS){
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const AZUL={type:'pattern',pattern:'solid',fgColor:{argb:'FF1B365D'}};
  const BRANCO={argb:'FFFFFFFF'};
  const LINHA={style:'thin',color:{argb:'FFD3D3D3'}};
  const BORDA={top:LINHA,left:LINHA,bottom:LINHA,right:LINHA};
  // formatos numéricos
  const FMT_MOEDA='#,##0.00';        // numeral com 2 casas (valores em R$)
  const FMT_PCT='0.00%';             // percentual em %
  const FMT_NUM='#,##0.00';          // número em numeral

  wb.eachSheet(ws=>{
    // Só o RESUMO em paisagem; TODAS as outras em RETRATO.
    const ehResumo = ws.name==='RESUMO';
    ws.pageSetup={
      paperSize:9,                          // A4
      orientation: ehResumo?'landscape':'portrait',
      fitToPage:true,
      fitToWidth:1,                         // cabe numa página de largura
      fitToHeight:0,                        // quantas páginas de altura precisar
      horizontalCentered:true,
      verticalCentered:false,
      margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.2,footer:0.2}
    };

    // Larguras ANTES de pintar as células — senão o estilo de coluna sobrescreve
    // o fill das células de fórmula no writeBuffer do exceljs.
    if(ehResumo){
      ws.getColumn(1).width = 58;   // coluna A: nomes de verbas (longos)
      for(let i=2;i<=ws.columnCount;i++){ ws.getColumn(i).width = 17; }
    } else {
      ws.columns.forEach((col,idx)=>{
        if(idx===0) col.width = 20;
        else { if(!col.width || col.width>16) col.width=12; if(col.width<9) col.width=9; }
      });
    }

    ws.eachRow({includeEmpty:false},(row,rn)=>{
      const cells=[]; row.eachCell({includeEmpty:false},(c,cn)=>cells.push({c,cn}));
      const vals=cells.map(x=>x.c.value);
      // detecção robusta: título e cabeçalho são linhas SÓ com texto (sem fórmula/número)
      const soTexto = vals.length>0 && vals.every(v=>typeof v==='string');
      const isTitle = soTexto && vals.length===1 && rn<=2;
      const isHeader = soTexto && vals.length>=2 && rn<=3;   // cabeçalho de coluna (linha 3)

      // ---- linhas especiais do RESUMO (destaque) ----
      const rotuloLinha = (typeof vals[0]==='string') ? vals[0].trim().toUpperCase() : '';
      const ehSubtotal = ehResumo && (/→\s*SUBTOTAL/.test(rotuloLinha) || rotuloLinha==='SUBTOTAL CRÉDITO' || rotuloLinha.startsWith('SUBTOTAL'));
      const ehTotalExec = ehResumo && rotuloLinha.startsWith('TOTAL DA EXECUÇÃO');
      const ehLiquido = ehResumo && rotuloLinha.startsWith('LÍQUIDO DO AUTOR');

      cells.forEach(({cn})=>{
        const c = row.getCell(cn);   // sempre célula FRESCA

        // sanitiza valor inválido que corromperia o arquivo
        if(typeof c.value==='number' && (isNaN(c.value)||!isFinite(c.value))) c.value=0;

        // ---- formato numérico: % em percentual, resto em numeral ----
        let numFmt = c.numFmt;
        if(typeof c.value==='number' || (c.value && c.value.formula)){
          const jaTemFmt = numFmt && String(numFmt).length>0;
          const rotulo = (typeof vals[0]==='string') ? vals[0].toLowerCase() : '';
          const ehLinhaPct = /pct_|percent|%|grau|aliquota|alíquota|patronal|honorario|honorário|multa_fgts|pct_fgts|adicional 20|adic_he/.test(rotulo);
          const valNum = (typeof c.value==='number') ? c.value : null;
          if(!jaTemFmt){
            numFmt = (ehLinhaPct && cn>1 && (valNum===null || (valNum>0 && valNum<1))) ? FMT_PCT : FMT_NUM;
          }
        }

        // ---- fonte ----
        let font;
        if(ehSubtotal)      font={name:'Arial',size:11,bold:true,color:BRANCO};
        else if(ehTotalExec)font={name:'Arial',size:14,bold:true,color:{argb:'FF16213E'}};
        else if(ehLiquido)  font={name:'Arial',size:13,bold:true,color:{argb:'FF16213E'}};
        else                font={name:'Arial',size:isTitle?12:(isHeader?11:10),bold:(isTitle||isHeader),color:(isTitle||isHeader)?BRANCO:undefined};

        // ---- fundo: azul nos subtotais/título/cabeçalho; BRANCO explícito no resto ----
        const azul = (isTitle||isHeader||ehSubtotal);
        const fill = azul
          ? {type:'pattern',pattern:'solid',fgColor:{argb:'FF1B365D'}}
          : {type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFFFF'}};

        // ---- alinhamento ----
        const alinhaEsq = ehResumo && cn===1 && typeof c.value==='string' && !isTitle && !isHeader;
        const alignment = {vertical:'middle',horizontal: alinhaEsq?'left':'center',wrapText:false,indent: alinhaEsq?1:0};

        // aplica TUDO via c.style completo (objeto próprio por célula — evita herança de fill pela coluna)
        const st = JSON.parse(JSON.stringify(c.style||{}));
        st.font=font; st.border=BORDA; st.fill=fill; st.alignment=alignment;
        if(numFmt) st.numFmt=numFmt;
        c.style=st;
      });

      // altura das linhas de destaque
      if(ehTotalExec) row.height=26;
      else if(ehLiquido) row.height=24;
      else if(ehSubtotal) row.height=18;
      else row.height=isTitle?22:(isHeader?18:15);
    });
  });
  return await wb.xlsx.writeBuffer();
}
if(typeof module!=='undefined') module.exports={aplicarEstiloPjeCalc};
if(typeof window!=='undefined') window.aplicarEstiloPjeCalc=aplicarEstiloPjeCalc;
