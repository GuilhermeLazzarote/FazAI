// fazai_form.js — FORMULÁRIO DE PARAMETRIZAÇÃO (cálculo determinístico)
// Self-contained: injeta um botão e um painel. Não depende do layout do app.
// Depende de: fazai_base_dados.js, fazai_motor.js, fazai_liquida_integracao.js
(function () {
  const OR = '#EA580C';
  const M = () => window.FazAIMotor;
  const L = () => window.FazAILiquida;

  const verbasDisponiveis = () => {
    const m = M(); if (!m) return [];
    const out = [];
    Object.values(m.CONFIG_FAMILIA_A).forEach(c => out.push({ id: c.id, nome: c.nome, tipo: 'adicional' }));
    Object.values(m.CONFIG_FAMILIA_B).forEach(c => out.push({ id: c.id, nome: c.nome, tipo: 'he' }));
    Object.values(m.CONFIG_FAMILIA_C).forEach(c => out.push({ id: c.id, nome: c.nome, tipo: 'auxilio' }));
    return out;
  };

  function painelHTML() {
    const verbas = verbasDisponiveis().map(v => `
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin:3px 0">
        <input type="checkbox" class="fd-verba" data-id="${v.id}" data-tipo="${v.tipo}">
        <span style="flex:1">${v.nome}</span>
        ${v.tipo === 'he' ? `<input type="number" class="fd-extra" data-id="${v.id}" placeholder="h/mês" style="width:70px">` : ''}
        ${v.tipo === 'auxilio' ? `<input type="number" class="fd-extra" data-id="${v.id}" placeholder="R$/mês" style="width:80px">` : ''}
      </label>`).join('');
    const inp = (id, ph, type = 'text') => `<input id="fd-${id}" type="${type}" placeholder="${ph}" style="width:100%;padding:6px;margin:2px 0;border:1px solid #ccc;border-radius:5px">`;
    return `
    <div id="fd-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998"></div>
    <div id="fd-panel" style="display:none;position:fixed;top:3%;left:50%;transform:translateX(-50%);width:min(920px,94vw);max-height:94vh;overflow:auto;background:#fff;border-radius:12px;z-index:99999;box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <div style="background:${OR};color:#fff;padding:12px 18px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">
        <strong>Cálculo Determinístico — Parametrização <span style="font-weight:400;opacity:.85">(base de homologação · não oficial)</span></strong>
        <button onclick="document.getElementById('fd-panel').style.display='none';document.getElementById('fd-overlay').style.display='none'" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer">×</button>
      </div>
      <div style="padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div>
          <div style="font-weight:700;color:${OR};margin-bottom:6px">Partes & processo</div>
          ${inp('reclamante', 'Reclamante')}${inp('reclamada', 'Reclamada')}${inp('proc', 'Nº do processo')}
          <div style="font-weight:700;color:${OR};margin:12px 0 6px">Datas</div>
          <label style="font-size:12px">Admissão ${inp('adm', '', 'date')}</label>
          <label style="font-size:12px">Demissão ${inp('dem', '', 'date')}</label>
          <label style="font-size:12px">Distribuição/ajuizamento ${inp('dist', '', 'date')}</label>
          <label style="font-size:12px">Atualização ${inp('atual', '', 'date')}</label>
        </div>
        <div>
          <div style="font-weight:700;color:${OR};margin-bottom:6px">Parâmetros</div>
          <label style="font-size:12px">Salário base (R$) ${inp('salario', '0,00', 'number')}</label>
          <label style="font-size:12px">Motivo da demissão
            <select id="fd-motivo" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:5px">
              <option>Sem Justa Causa</option><option>Pedido de Demissão</option><option>Justa Causa</option><option>Outros</option>
            </select></label>
          <label style="font-size:12px">Divisor
            <select id="fd-divisor" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:5px"><option>220</option><option>200</option></select></label>
          <label style="font-size:12px">% FGTS ${inp('fgts', '0.112', 'number')}</label>
          <label style="display:flex;gap:6px;font-size:12px;margin-top:4px"><input type="checkbox" id="fd-dsrsab">DSR com sábado</label>
          <label style="display:flex;gap:6px;font-size:12px"><input type="checkbox" id="fd-dsrrefl">DSR compõe base de reflexos</label>
          <label style="display:flex;gap:6px;font-size:12px"><input type="checkbox" id="fd-inss">Incluir INSS</label>
        </div>
      </div>
      <div style="padding:0 18px 8px"><div style="font-weight:700;color:${OR};margin-bottom:6px">Verbas ativas</div>${verbas}</div>
      <div style="padding:0 18px 18px;display:flex;gap:10px;align-items:center">
        <button id="fd-calc" style="background:${OR};color:#fff;border:none;padding:10px 22px;border-radius:8px;font-weight:700;cursor:pointer">Calcular</button>
        <span style="font-size:12px;color:#888">Salário e horas são aplicados a todos os meses (edite depois por competência).</span>
      </div>
      <div id="fd-result" style="padding:0 18px 24px"></div>
    </div>
    <button id="fd-launch" style="position:fixed;bottom:20px;right:20px;background:${OR};color:#fff;border:none;padding:12px 18px;border-radius:30px;font-weight:700;cursor:pointer;z-index:99997;box-shadow:0 4px 14px rgba(0,0,0,.25)">⚙ Cálculo determinístico</button>`;
  }

  function build() {
    const d = (id) => { const e = document.getElementById('fd-' + id); return e ? e.value : ''; };
    const dt = (id) => { const v = d(id); if (!v) return null; const [y, m, dd] = v.split('-').map(Number); return new Date(y, (m || 1) - 1, dd || 1); };
    const ym = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const adm = dt('adm'), dem = dt('dem');
    if (!adm || !dem) { alert('Informe admissão e demissão.'); return null; }
    const salario = parseFloat(d('salario')) || 0;

    const verbasAtivas = [], qtdHoras = {}, auxiliosPadrao = {};
    document.querySelectorAll('.fd-verba:checked').forEach(cb => {
      const id = cb.dataset.id; verbasAtivas.push(id);
      const extra = document.querySelector('.fd-extra[data-id="' + id + '"]');
      if (cb.dataset.tipo === 'he') { qtdHoras[id] = {}; }
      if (cb.dataset.tipo === 'auxilio') auxiliosPadrao[id] = parseFloat(extra && extra.value) || 0;
      cb._extra = extra ? parseFloat(extra.value) || 0 : 0;
    });

    const caso = {
      reclamante: d('reclamante'), reclamada: d('reclamada'), numeroProcesso: d('proc'),
      dataAdmissao: adm, dataDemissao: dem, dataPrescricao: adm,
      dataDistribuicao: dt('dist') || dem, dataAtualizacao: dt('atual') || new Date(),
      motivoDemissao: d('motivo'), percentualFgts: parseFloat(d('fgts')) || 0.112,
      divisor: parseInt(d('divisor')) || 220,
      dsrComSabado: document.getElementById('fd-dsrsab').checked,
      dsrCompoeBaseReflexos: document.getElementById('fd-dsrrefl').checked,
      incluirINSS: document.getElementById('fd-inss').checked,
      salariosMensais: { [ym(adm)]: salario },
      verbasAtivas, auxiliosPadrao, qtdHoras, pagos: {},
    };
    // aplica horas/mês a todas as competências
    let cur = new Date(adm.getFullYear(), adm.getMonth(), 1);
    while (cur <= dem) {
      document.querySelectorAll('.fd-verba:checked').forEach(cb => {
        if (cb.dataset.tipo === 'he') qtdHoras[cb.dataset.id][ym(cur)] = cb._extra || 0;
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return caso;
  }

  function calcular() {
    const caso = build(); if (!caso) return;
    const out = L().calcularLiquidacaoDeterministica(caso);
    const r = out.liquidaResult, agg = out.agregado;
    const fb = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const box = document.getElementById('fd-result');
    const avisos = (agg._meta.avisos || []);
    box.innerHTML = `
      <div style="border-top:2px solid ${OR};margin-top:8px;padding-top:12px">
        <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;margin-bottom:10px">
          <div><b>Principal</b><br>${fb(agg.principal)}</div>
          <div><b>Correção</b><br>${fb(agg.correcao)}</div>
          <div><b>Juros (SELIC)</b><br>${fb(agg.juros)}</div>
          <div><b>FGTS</b><br>${fb(agg.fgts)}</div>
          <div style="color:${OR}"><b>TOTAL GERAL</b><br>${fb(agg.total)}</div>
        </div>
        ${avisos.length ? `<div style="background:#fff3cd;border:1px solid #ffe69c;padding:8px;border-radius:6px;font-size:12px;margin-bottom:10px">⚠ ${avisos.join(' · ')}</div>` : ''}
        <div id="fd-memoria"></div>
      </div>`;
    L().renderMemoriaReal(r, document.getElementById('fd-memoria'));
  }

  function init() {
    if (!window.FazAILiquida) { console.warn('[fazai_form] motor não carregado'); return; }
    const wrap = document.createElement('div'); wrap.innerHTML = painelHTML(); document.body.appendChild(wrap);
    document.getElementById('fd-launch').onclick = () => {
      document.getElementById('fd-panel').style.display = 'block';
      document.getElementById('fd-overlay').style.display = 'block';
    };
    document.getElementById('fd-overlay').onclick = () => {
      document.getElementById('fd-panel').style.display = 'none';
      document.getElementById('fd-overlay').style.display = 'none';
    };
    document.getElementById('fd-calc').onclick = calcular;
    // expõe pré-preenchimento (a extração do processo vai chamar isto na etapa seguinte)
    window.FazAIFormPreencher = (p) => {
      const set = (id, v) => { const e = document.getElementById('fd-' + id); if (e && v != null) e.value = v; };
      set('reclamante', p.reclamante); set('reclamada', p.reclamada); set('proc', p.numeroProcesso);
      set('adm', p.dataAdmissao); set('dem', p.dataDemissao); set('dist', p.dataDistribuicao);
      set('salario', p.salario);
      (p.verbasAtivas || []).forEach(id => { const cb = document.querySelector('.fd-verba[data-id="' + id + '"]'); if (cb) cb.checked = true; });
      document.getElementById('fd-panel').style.display = 'block';
      document.getElementById('fd-overlay').style.display = 'block';
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
