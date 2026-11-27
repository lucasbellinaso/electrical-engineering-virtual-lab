import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {modulePresets,presetFields} from '../simulators/renewable-energy/photovoltaic/presets.js';
import {defaults,validate,fitModule,simulate,simulateIEC,compareCatalog,iecConstants,iecParameters,iecCurrentAtVoltage,iecVoltageAtCurrent} from '../simulators/renewable-energy/photovoltaic/model.js';
const ref=JSON.parse(readFileSync(new URL('./fixtures/photovoltaic-pvlib.json',import.meta.url),'utf8'));
const near=(actual,expected,relative=1e-6,absolute=1e-8)=>assert.ok(Math.abs(actual-expected)<=absolute+relative*Math.abs(expected),`${actual} != ${expected}`);
test('De Soto fit and curves match independent pvlib 0.16.1',()=>{
 const fit=fitModule(defaults);for(const [a,b] of [['il','I_L_ref'],['io','I_o_ref'],['rs','R_s'],['rsh','R_sh_ref'],['a','a_ref']])near(fit[a],ref.fit[b],2e-6,1e-14);
 for(const c of ref.cases){const r=simulate({...defaults,irradiance:c.irradiance,temperature:c.temperature},fit);
  for(const key of ['isc','voc','imp','vmp','pmp'])near(r[key],c[key],1e-6,1e-6);
  c.points.forEach((point,i)=>{const actual=r.points[[0,50,100,150,190,200][i]];near(actual.v,point.v);near(actual.i,point.i,2e-6,1e-7);});
 }
});
test('array series and parallel scaling is exact for both models',()=>{
 const a={...defaults,series:3,parallel:2};
 for(const fn of [simulate,simulateIEC]){const base=fn(defaults),array=fn(a);near(array.voc,base.voc*3);near(array.isc,base.isc*2);near(array.pmp,base.pmp*6);near(array.points[75].v,base.points[75].v*3);near(array.points[75].i,base.points[75].i*2);}
});
test('provided IEC equations agree with direct calculation and inverse',()=>{
 for(const [irradiance,temperature] of [[1000,25],[300,45],[1400,-10]]){
  const p={...defaults,irradiance,temperature},q=iecParameters(p),G=irradiance;
  const isc=p.isc*G/1000*(1+p.alpha/100*(temperature-25));near(q.isc,isc);
  const scale=p.voc*(1+p.beta/100*(temperature-25))*(Math.log(G/0.002514+1)*0.08593-0.0001088*G);near(q.voltageScale,scale);
  const result=simulateIEC(p);near(iecCurrentAtVoltage(result.voc,p),0,0,1e-10);
  for(const frac of [0,.2,.8,1]){const v=result.voc*frac,i=iecCurrentAtVoltage(v,p);near(iecVoltageAtCurrent(Math.min(i,q.isc),p),v,1e-7,1e-7);}
  near(iecCurrentAtVoltage(-2,p,4),q.isc+0.5);near(iecVoltageAtCurrent(q.isc+0.5,p,4),-2);
 }
});
test('zero irradiance, temperature trends, invalid data and finite outputs',()=>{
 for(const fn of [simulate,simulateIEC]){const zero=fn({...defaults,irradiance:0});assert.equal(zero.pmp,0);assert.equal(zero.voc,0);
  const cold=fn({...defaults,temperature:0}),hot=fn({...defaults,temperature:60});assert.ok(cold.voc>hot.voc);assert.ok(cold.pmp>hot.pmp);assert.ok(fn({...defaults,irradiance:400}).isc<fn(defaults).isc);
  assert.throws(()=>fn({...defaults,vmp:60}),RangeError);assert.throws(()=>fn({...defaults,series:1.5}),RangeError);
 }
 assert.throws(()=>validate({...defaults,beta:0}),RangeError);
});

test('initial form values satisfy the HTML numeric constraints',()=>{
 const html=readFileSync(new URL('../simulators/renewable-energy/photovoltaic/index.html',import.meta.url),'utf8');
 for(const [key,value] of Object.entries(defaults)){
  const match=html.match(new RegExp(`<input\\b[^>]*\\bid="${key}"[^>]*>`));assert.ok(match,`missing ${key}`);
  const attrs=Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  assert.equal(Number(attrs.value),value,`${key} initial value`);
  assert.ok(value>=Number(attrs.min)&&value<=Number(attrs.max),`${key} bounds`);
  if(attrs.step&&attrs.step!=='any'){const q=(value-Number(attrs.min))/Number(attrs.step);assert.ok(Math.abs(q-Math.round(q))<1e-8,`${key} step mismatch`);}
 }
});

test('catalog comparison scales the STC reference to the array',()=>{
 const input={...defaults,series:3,parallel:2},base=simulate(input),comparison=compareCatalog(input,base);
 near(comparison.voc.reference,defaults.voc*3);near(comparison.isc.reference,defaults.isc*2);
 near(comparison.pmp.reference,defaults.vmp*defaults.imp*6);
 for(const key of ['voc','isc','vmp','imp','pmp'])near(comparison[key].difference,0,0,1e-5);
 const dark=compareCatalog(input,simulate({...input,irradiance:0}));
 for(const key of ['voc','isc','vmp','imp','pmp'])near(dark[key].percent,-100);
});

test('IEC displayed parameters expose fill factors and fixed constants, including zero irradiance',()=>{
 const p={...defaults,irradiance:0},q=iecParameters(p);
 near(q.ffv,p.vmp/p.voc);near(q.ffi,p.imp/p.isc);near(q.caq,(q.ffv-1)/Math.log1p(-q.ffi));
 assert.equal(q.isc,0);assert.equal(q.io,0);assert.equal(q.voltageScale,0);
 assert.deepEqual(iecConstants,{cg:0.002514,cv:0.08593,cr:0.0001088});
});

test('manufacturer module presets match datasheets and pvlib reference cases',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/photovoltaic-commercial-pvlib.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(modulePresets).sort(),Object.keys(fixture.modules).sort());
 for(const [id,preset] of Object.entries(modulePresets)){
  const expected=fixture.modules[id];for(const field of presetFields)assert.equal(preset[field],expected.datasheet[field],`${id} ${field}`);
  const base={...defaults,...Object.fromEntries(presetFields.map(key=>[key,preset[key]]))},fit=fitModule(base);
  for(const item of expected.cases){const p={...base,irradiance:item.irradiance,temperature:item.temperature},res=simulate(p,fit),iec=simulateIEC(p);
   for(const key of ['voc','isc','vmp','imp','pmp'])near(res[key],item[key],2e-6,1e-6);
   assert.ok(iec.pmp>0);assert.ok(iec.voc>iec.vmp);
  }
 }
});
