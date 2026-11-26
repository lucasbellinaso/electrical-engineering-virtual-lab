import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chart,dataRange,referenceRange} from '../simulators/electrical-circuits/shared/chart.js';
import {simulate,presets} from '../simulators/electrical-circuits/shared/model.js';
import {traces} from '../simulators/electrical-circuits/shared/chart.js';
import {numberLatex,proseParts,traceLatex} from '../simulators/electrical-circuits/shared/presentation.js';
import katex from '../assets/vendor/katex/katex.mjs';

const fmt=n=>String(n);
const translate=k=>k;

test('circuit chart reference ranges are fixed by topology and quantity',()=>{
  for(const topology of ['rc','rl','series','parallel']){
    for(const quantity of ['voltage','current']){
      const first=referenceRange(topology,quantity);
      const second=referenceRange(topology,quantity);
      assert.deepEqual(second,first);
      assert.ok(first[0]<0&&first[1]>0);
    }
  }
  assert.ok(referenceRange('rc','voltage')[1]<10,'nominal RC view remains useful for default 5 V response');
});

test('parameter excursions flag clipped chart data without changing fixed limits',()=>{
  const range=referenceRange('rc','voltage'),visible=new Set(['vc']);
  const result={parameters:{topology:'rc',resistance:1000},samples:[{time:0,vc:0,source:0,exactVC:0},{time:1,vc:100,source:5,exactVC:100}]};
  const svg={innerHTML:'',dataset:{}};
  const geometry=chart(svg,result,'voltage',visible,false,translate,fmt,range);
  assert.deepEqual([geometry.low,geometry.high],range);
  assert.equal(geometry.outside,true);
  assert.equal(svg.dataset.outOfRange,'true');
  assert.equal(svg.dataset.yMin,String(range[0]));
  assert.match(svg.innerHTML,/clipPath/);
  const adjusted=dataRange(result,'voltage',visible);
  assert.ok(adjusted[0]<0&&adjusted[1]>100);
});

test('complete nominal responses fit the fixed reference envelopes',()=>{
  for(const p of Object.values(presets)){
    const result=simulate(p);
    for(const quantity of ['voltage','current']){
      const geometry=chart({innerHTML:'',dataset:{}},result,quantity,new Set(traces(p.topology,quantity)),true,translate,fmt);
      assert.equal(geometry.outside,false,`${p.topology}/${quantity} default response must remain visible`);
    }
  }
});

test('number LaTeX preserves localized decimals and scientific exponents',()=>{
  assert.equal(numberLatex(1.25,'en'),'1.25');
  assert.equal(numberLatex(1.25,'pt-BR'),'1{,}25');
  assert.equal(numberLatex(1.25,'es'),'1{,}25');
  assert.equal(numberLatex(1e-10,'pt-BR'),'1\\times10^{-10}');
  assert.equal(numberLatex(-0,'en'),'0');
  for(const locale of ['en','pt-BR','es'])for(const value of [-12345.67,0,1e-15,1e12])assert.match(katex.renderToString(numberLatex(value,locale),{throwOnError:true}),/katex/);
  assert.throws(()=>numberLatex(NaN,'en'),RangeError);
});

test('inline translated expressions render safely and source symbols match the physical source',async()=>{
  assert.deepEqual(proseParts('Text \\(v_C\\) then \\(i_L\\).'),[{text:'Text '},{latex:'v_C'},{text:' then '},{latex:'i_L'},{text:'.'}]);
  assert.equal(traceLatex('parallel','source'),'I_s');
  assert.equal(traceLatex('series','source'),'V_s');
  for(const locale of ['en','pt-BR','es']){
    const messages=JSON.parse(await readFile(new URL(`../locales/${locale}.json`,import.meta.url),'utf8'));
    for(const key of ['circuit_method','circuit_energyText','circuit_limitations','circuit_seriesStates','circuit_parallelODE']){
      const parts=proseParts(messages[key]);assert.ok(parts.some(p=>'latex' in p),`${locale}/${key}`);
      for(const part of parts)if(part.latex)assert.match(katex.renderToString(part.latex,{throwOnError:true,trust:false,output:'htmlAndMathml'}),/<math/);
    }
  }
});

test('local KaTeX renderer keeps MathML accessible and disables trust',async()=>{
  const ui=await readFile(new URL('../simulators/electrical-circuits/shared/ui.js',import.meta.url),'utf8');
  assert.match(ui,/output:'htmlAndMathml'/);
  assert.match(ui,/trust:false/);
  assert.match(ui,/katex\.render\(latex,node/);
  for(const locale of ['en','pt-BR','es']){
    const messages=JSON.parse(await readFile(new URL(`../locales/${locale}.json`,import.meta.url),'utf8'));
    assert.ok(messages.circuit_adjustScale);
    assert.ok(messages.circuit_restoreScale);
    assert.ok(messages.circuit_outOfRange);
    assert.ok(messages.circuit_resistance);
  }
});
