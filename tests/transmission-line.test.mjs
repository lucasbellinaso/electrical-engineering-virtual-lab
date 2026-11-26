import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as c from '../assets/js/core/complex.js';
import {cmmul} from '../assets/js/core/cmatrix.js';
import {defaults, presets, bounds, validate, lineParameters, solve} from '../simulators/power-systems/transmission-line/model.js';
import {steps} from '../simulators/power-systems/transmission-line/equations.js';
import katex from '../assets/vendor/katex/katex.mjs';
const near = (a,b,tol=1e-10) => assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (${tol})`);
const close = (a,b,tol=1e-9) => near(c.abs(c.sub(a,b)),0,tol);
const p = changes => ({...defaults,...changes});
const matrix = m => [[m.A,m.B],[m.C,m.D]];

test('LT: lecture parameters and terminal calculation (rounded independent lecture values)', () => {
  const r=solve();near(r.zc.re,237.59,.01);near(r.zc.im,-10.029,.001);
  near(r.gamma.re,53.8753e-6,1e-10);near(r.gamma.im,1.2763e-3,1e-7);
  near(c.abs(r.vr),500e3/Math.sqrt(3),1e-8);near(c.abs(r.ir),692.82,.01);
  near(c.toPolarDeg(r.ir).phase,-25.84,.01);
  near(c.abs(r.vs)*Math.sqrt(3)/1000,522.419,.02);
  near(c.toPolarDeg(r.vs).phase,13.90,.01);
  near(c.abs(r.is),640.763,.05);near(c.toPolarDeg(r.is).phase,31.70,.01);
  near(r.receivingPower.re,540e6,1e-6);near(c.abs(r.receivingPower),600e6,1e-6);
});
test('LT: zero length is identity; very short lines approach lumped parameters', () => {
  const r=solve(p({lengthKm:0}));close(r.exact.A,c.make(1));close(r.exact.B,c.make());close(r.exact.C,c.make());
  close(r.vs,r.vr);close(r.is,r.ir);close(r.pi.series,c.make());close(r.pi.shunt,c.make());
  near(r.losses,0,1e-6);near(r.errorPercent,0);assert.ok(r.samples.every(s=>s.x===0));
  const s=lineParameters(p({lengthKm:1e-7}));
  close(c.scale(s.exact.B,1e7),s.z,1e-12);close(c.scale(s.exact.C,1e7),s.y,1e-16);
  close(c.scale(s.pi.shunt,2e7),s.y,1e-16);
});
test('LT: lossless analytical trigonometric ABCD and matched load', () => {
  const input=p({resistanceOhmKm:0}),r=solve(input);
  const L=input.inductanceMhKm*1e-3,C=input.capacitanceNfKm*1e-9;
  const z0=Math.sqrt(L/C),beta=2*Math.PI*input.frequencyHz*Math.sqrt(L*C),theta=beta*input.lengthKm;
  close(r.zc,c.make(z0),1e-10);near(r.gamma.re,0);near(r.gamma.im,beta,1e-15);
  close(r.exact.A,c.make(Math.cos(theta)));close(r.exact.B,c.make(0,z0*Math.sin(theta)));
  close(r.exact.C,c.make(0,Math.sin(theta)/z0),1e-14);near(r.losses,0,1e-6);
  const matched=solve({...input,powerFactor:1,apparentMva:(input.voltageKv*1000)**2/z0/1e6});
  near(c.abs(matched.vs),c.abs(matched.vr),1e-8);near(c.abs(matched.is),c.abs(matched.ir),1e-10);
  for(const s of matched.samples)near(c.abs(s.voltage),c.abs(matched.vr),1e-8);
});
test('LT: open circuit holds sending voltage and reproduces Ferranti closed form', () => {
  const r=solve({...presets.ferranti,resistanceOhmKm:0});
  close(r.ir,c.make());near(c.abs(r.vs),500e3/Math.sqrt(3),1e-8);
  near(c.abs(r.vr),c.abs(r.vs)/Math.cos(r.gamma.im*r.p.lengthKm),1e-8);
  assert.ok(c.abs(r.vr)>c.abs(r.vs));near(r.receivingPower.re,0);near(r.losses,0,1e-6);
});
test('LT: exact pi reconstructs ABCD, reciprocity and cascading sections', () => {
  for(const input of Object.values(presets)) {
    const r=solve(input),{series:Z,shunt:Y}=r.pi,one=c.make(1),zero=c.make();
    const T=cmmul(cmmul([[one,zero],[Y,one]],[[one,Z],[zero,one]]),[[one,zero],[Y,one]]);
    const half=lineParameters({...input,lengthKm:input.lengthKm/2}).exact;
    const cascade=cmmul(matrix(half),matrix(half));
    for(let i=0;i<2;i++)for(let j=0;j<2;j++){close(T[i][j],matrix(r.exact)[i][j],1e-10);close(cascade[i][j],matrix(r.exact)[i][j],1e-10);}
    near(r.determinantResidual,0,2e-14);
  }
});
test('LT: spatial boundaries, telegrapher residual and active-energy balance', () => {
  for(const input of Object.values(presets)){
    const r=solve(input),s=r.samples;
    close(s[0].voltage,r.vs,1e-8);close(s[0].current,r.is,1e-9);
    close(s.at(-1).voltage,r.vr,1e-8);close(s.at(-1).current,r.ir,1e-9);
    const dx=s[201].x-s[199].x;
    close(c.scale(c.sub(s[201].voltage,s[199].voltage),1/dx),c.scale(c.mul(r.z,s[200].current),-1),.001);
    close(c.scale(c.sub(s[201].current,s[199].current),1/dx),c.scale(c.mul(r.y,s[200].voltage),-1),1e-5);
    assert.ok(r.losses>0);near(r.integratedLosses/r.losses,1,2e-5);
  }
});
test('LT: reactive-power signs, linearity and nominal-pi convergence', () => {
  const inductive=solve(),capacitive=solve(p({loadType:'capacitive'}));
  assert.ok(inductive.receivingPower.im>0&&capacitive.receivingPower.im<0);
  near(c.abs(inductive.ir),c.abs(capacitive.ir));
  const scaled=solve(p({voltageKv:1000,apparentMva:2400}));
  close(scaled.vs,c.scale(inductive.vs,2),1e-8);close(scaled.is,c.scale(inductive.is,2),1e-8);
  const a=solve(p({lengthKm:20})),b=solve(p({lengthKm:10}));
  assert.ok(a.errorPercent/b.errorPercent>7&&a.errorPercent/b.errorPercent<9);
});
test('LT: invalid inputs, exact/nominal resonances and pi singularity', () => {
  for(const [key,[min,max]] of Object.entries(bounds))for(const value of [NaN,Infinity,'1',min-1,max+1])assert.throws(()=>solve(p({[key]:value})),RangeError);
  for(const input of [null,{},p({mode:'x'}),p({loadType:'x'}),p({mode:'sending-open'})])assert.throws(()=>solve(input),RangeError);
  const input={...presets.ferranti,resistanceOhmKm:0,inductanceMhKm:5,capacitanceNfKm:50};
  const beta=2*Math.PI*input.frequencyHz*Math.sqrt(5e-3*50e-9);
  assert.throws(()=>solve({...input,lengthKm:Math.PI/(2*beta)}),{code:'resonance'});
  assert.throws(()=>solve({...input,lengthKm:Math.sqrt(2)/beta}),{code:'resonance'});
  const halfWave=lineParameters({...input,lengthKm:Math.PI/beta});assert.equal(halfWave.pi,null);
  assert.ok(Number.isFinite(solve({...input,lengthKm:Math.PI/beta}).vs.re));
});
test('LT: presets and extreme parameters remain finite without input mutation', () => {
  const input=p(),before=JSON.stringify(input);solve(input);assert.equal(JSON.stringify(input),before);
  for(const preset of Object.values(presets))validate(preset);
  for(const resistanceOhmKm of [0,1])for(const loadType of ['inductive','capacitive']) {
    const r=solve(p({lengthKm:1000,frequencyHz:70,resistanceOhmKm,inductanceMhKm:5,capacitanceNfKm:50,voltageKv:1,apparentMva:3000,powerFactor:.1,loadType}));
    assert.ok(r.samples.every(s=>[s.voltage,s.current].every(z=>Number.isFinite(z.re)&&Number.isFinite(z.im))));
    assert.ok(Number.isFinite(r.errorPercent));
  }
});
test('LT: local equations render and all UI/help translations are complete', async () => {
  const base=new URL('../simulators/power-systems/transmission-line/',import.meta.url);
  const dictionary=JSON.parse(await readFile(new URL('locales.json',base),'utf8')),keys=Object.keys(dictionary.en).sort();
  assert.deepEqual(Object.keys(dictionary).sort(),['en','es','pt-BR']);
  for(const lang of Object.keys(dictionary)){
    assert.deepEqual(Object.keys(dictionary[lang]).sort(),keys);
    for(const key of keys){assert.ok(dictionary[lang][key].trim());assert.deepEqual(dictionary[lang][key].match(/\{\w+\}/g),dictionary.en[key].match(/\{\w+\}/g));}
  }
  for(const file of ['index.html','ui.js']){
    const source=await readFile(new URL(file,base),'utf8');
    for(const [,a,b] of source.matchAll(/data-m(?:-aria)?="([\w]+)"|\btr\('([\w]+)'/g))assert.ok(dictionary.en[a||b],`${file}: ${a||b}`);
  }
  for(const group of steps)for(const eq of group)assert.match(katex.renderToString(eq,{throwOnError:true,trust:false,output:'htmlAndMathml'}),/<math/);
  const catalog=JSON.parse(await readFile(new URL('../data/simulators.json',import.meta.url),'utf8'));
  assert.equal(catalog.find(s=>s.id==='transmission-line').category,'power-systems');
});
