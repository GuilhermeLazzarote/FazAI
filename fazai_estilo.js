// Camada de estilo PJe-Calc via exceljs (aplicada sobre o arquivo do engine, sem tocar no cálculo)
async function aplicarEstiloPjeCalc(buffer, ExcelJS){
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const AZUL={type:'pattern',pattern:'solid',fgColor:{argb:'FF1B365D'}};
  const BRANCO={argb:'FFFFFFFF'};
  const LINHA={style:'thin',color:{argb:'FFD3D3D3'}};
  const BORDA={top:LINHA,left:LINHA,bottom:LINHA,right:LINHA};
  wb.eachSheet(ws=>{
    // RESUMO em paisagem; todas as outras abas em RETRATO, colunas cabendo em 1 página de largura.
    const ehResumo = ws.name==='RESUMO';
    ws.pageSetup={
      paperSize:9,                          // A4
      orientation: ehResumo?'landscape':'portrait',
      fitToPage:true,
      fitToWidth:1,                         // todas as colunas numa página de largura
      fitToHeight:0,                        // quantas páginas de altura precisar
      horizontalCentered:true,
      margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.2,footer:0.2}
    };
    ws.eachRow({includeEmpty:false},(row,rn)=>{
      const cells=[]; row.eachCell({includeEmpty:false},(c,cn)=>cells.push({c,cn}));
      const vals=cells.map(x=>x.c.value);
      const allStr=vals.length>0 && vals.every(v=>typeof v==='string');
      const isTitle=allStr && vals.length===1 && rn<=2;
      const isHeader=allStr && vals.length>=2;
      cells.forEach(({c,cn})=>{
        // sanitiza valor inválido que corromperia o arquivo
        if(typeof c.value==='number' && (isNaN(c.value)||!isFinite(c.value))) c.value=0;
        const isMoney=c.numFmt && String(c.numFmt).includes('R$');
        c.font={name:'Arial',size:isTitle?12:(isHeader?11:10),bold:(isTitle||isHeader),color:(isTitle||isHeader)?BRANCO:undefined};
        c.border=BORDA;
        if(isTitle||isHeader) c.fill=AZUL;
        c.alignment={vertical:'middle',horizontal:(isHeader&&cn===1)?'left':(isTitle||isHeader)?'center':(isMoney?'right':'left'),wrapText:false};
      });
      row.height=isTitle?22:(isHeader?18:15);
    });
  });
  return await wb.xlsx.writeBuffer();
}
if(typeof module!=='undefined') module.exports={aplicarEstiloPjeCalc};
if(typeof window!=='undefined') window.aplicarEstiloPjeCalc=aplicarEstiloPjeCalc;
