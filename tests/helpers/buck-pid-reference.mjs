/** Exact, reviewable presentation-only transforms allowed on the immutable Buck source. */
export function integrateBuckPid(original) {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  let result = original.replace(/<link[^>]+href="https:\/\/fonts\.googleapis\.com[^>]+>\r?\n?/g,'');
  const replaceOnce = (before, after) => {
    if (result.split(before).length !== 2) throw new Error('Buck presentation anchor must be unique: '+before);
    result = result.replace(before,after);
  };
  replaceOnce('<script>'+eol+'{', '<script src="../../../assets/js/buck-pid-scale.js"></script>'+eol+'<script>'+eol+'{');
  replaceOnce('      <div class="fig"><canvas id="cv"></canvas></div>',
    '      <div class="fig"><canvas id="cv"></canvas></div>'+eol+
    '      <p class="note" id="scalePolicy">Escala acumulada desde Reiniciar: a faixa aumenta com novos extremos e não diminui automaticamente.</p>');
  const block = [
    '// Presentation-only accumulated plot limits. Each period writes NS/DEC samples.',
    'const plotScale=window.buckPidScale={voltage:BuckPidScale.createRange(),current:BuckPidScale.createRange()};',
    'function capturePlotScale(){',
    '  for(let k=NS/DEC;k>0;k--){const idx=(head-k+cap)%cap;',
    '    plotScale.voltage.include(bv[idx]);plotScale.voltage.include(br[idx]);plotScale.current.include(bi[idx]);}',
    '}',
    'function resetPlotScale(){plotScale.voltage.reset();plotScale.current.reset()}',
    '', ''
  ].join(eol);
  replaceOnce('/* ---- desenho ---- */',block+'/* ---- desenho ---- */');
  replaceOnce('pn.fixed||range(pn.a,pn.b)','pn.fixed||(ix===0?plotScale.voltage:plotScale.current).bounds()||[-0.5,0.5]');
  replaceOnce('for(let k=0;k<n;k++)period();','for(let k=0;k<n;k++){period();capturePlotScale()}');
  replaceOnce('if(!isFinite(s.vC)||Math.abs(s.vC)>1e6){resetSim();resetBuf()}',
    'if(!isFinite(s.vC)||Math.abs(s.vC)>1e6){resetSim();resetBuf();resetPlotScale()}');
  replaceOnce('$("bReset").addEventListener("click",()=>{resetSim();resetBuf()});',
    '$("bReset").addEventListener("click",()=>{resetSim();resetBuf();resetPlotScale()});');
  return result;
}
