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
      margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.2,footer:0.2}
    };
    // garante que a orientação não seja sobrescrita pelo scale automático
    ws.pageSetup.scale = undefined; // deixa o fitToPage mandar

    ws.eachRow({includeEmpty:false},(row,rn)=>{
      const cells=[]; row.eachCell({includeEmpty:false},(c,cn)=>cells.push({c,cn}));
      const vals=cells.map(x=>x.c.value);
      const allStr=vals.length>0 && vals.every(v=>typeof v==='string');
      const isTitle=allStr && vals.length===1 && rn<=2;
      const isHeader=allStr && vals.length>=2;

      // ---- linhas especiais do RESUMO (destaque) ----
      const rotuloLinha = (typeof vals[0]==='string') ? vals[0].trim().toUpperCase() : '';
      const ehSubtotal = ehResumo && (/→\s*SUBTOTAL/.test(rotuloLinha) || rotuloLinha==='SUBTOTAL CRÉDITO' || rotuloLinha.startsWith('SUBTOTAL'));
      const ehTotalExec = ehResumo && rotuloLinha.startsWith('TOTAL DA EXECUÇÃO');
      const ehLiquido = ehResumo && rotuloLinha.startsWith('LÍQUIDO DO AUTOR');

      cells.forEach(({c,cn})=>{
        // sanitiza valor inválido que corromperia o arquivo
        if(typeof c.value==='number' && (isNaN(c.value)||!isFinite(c.value))) c.value=0;

        // ---- formato numérico: % em percentual, resto em numeral ----
        if(typeof c.value==='number' || (c.value && c.value.formula)){
          const jaTemFmt = c.numFmt && String(c.numFmt).length>0;
          const rotulo = (typeof vals[0]==='string') ? vals[0].toLowerCase() : '';
          const ehLinhaPct = /pct_|percent|%|grau|aliquota|alíquota|patronal|honorario|honorário|multa_fgts|pct_fgts|adicional 20|adic_he/.test(rotulo);
          const valNum = (typeof c.value==='number') ? c.value : null;
          if(!jaTemFmt){
            if(ehLinhaPct && cn>1 && (valNum===null || (valNum>0 && valNum<1))) c.numFmt=FMT_PCT;
            else c.numFmt=FMT_NUM;
          }
        }

        // ---- fonte e cor (base) ----
        c.font={name:'Arial',size:isTitle?12:(isHeader?11:10),bold:(isTitle||isHeader),color:(isTitle||isHeader)?BRANCO:undefined};
        c.border=BORDA;
        if(isTitle||isHeader) c.fill=AZUL;

        // ---- destaques do RESUMO ----
        if(ehSubtotal){
          c.fill=AZUL;
          c.font={name:'Arial',size:11,bold:true,color:BRANCO};
        }
        if(ehTotalExec){
          c.fill=AZUL;
          c.font={name:'Arial',size:14,bold:true,color:BRANCO};   // maior, para evidência
        }
        if(ehLiquido){
          c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2C5F2D'}}; // verde escuro p/ o líquido
          c.font={name:'Arial',size:13,bold:true,color:BRANCO};
        }

        // ---- alinhamento: TUDO centralizado ----
        c.alignment={vertical:'middle',horizontal:'center',wrapText:false};
      });

      // altura das linhas de destaque
      if(ehTotalExec) row.height=26;
      else if(ehLiquido) row.height=24;
      else if(ehSubtotal) row.height=18;
      else row.height=isTitle?22:(isHeader?18:15);
    });

    // largura de coluna razoável para caber em retrato (sem estourar)
    ws.columns.forEach(col=>{ if(!col.width || col.width>18) col.width=14; if(col.width<9) col.width=9; });
  });
  return await wb.xlsx.writeBuffer();
}
if(typeof module!=='undefined') module.exports={aplicarEstiloPjeCalc};
if(typeof window!=='undefined') window.aplicarEstiloPjeCalc=aplicarEstiloPjeCalc;
