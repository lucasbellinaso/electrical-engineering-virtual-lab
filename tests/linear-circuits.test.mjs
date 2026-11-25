import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate,presets,validate,characteristics,recommendedDuration,analyticalState,homogeneous,rk4Step,CircuitError,MAX_STEPS} from '../simulators/electrical-circuits/shared/model.js';
import {equations} from '../simulators/electrical-circuits/shared/equations.js';
import katex from '../assets/vendor/katex/katex.mjs';

const topologies=['rc','rl','series','parallel'];
const near=(a,b,tol,message)=>assert.ok(Math.abs(a-b)<=tol,`${message??''} ${a} vs ${b} (tol ${tol})`);
const rel=(a,b,tol,message)=>near(a,b,tol*Math.max(1e-12,Math.abs(b)),message);
const regimeCase=(topology,zeta)=>{ // choose R giving the requested damping ratio from the preset L and C
 const p={...presets[topology]},L=p.inductance*1e-3,C=p.capacitance*1e-6;
 p.resistance=topology==='series'?2*zeta*Math.sqrt(L/C):.5*Math.sqrt(L/C)/zeta;
 p.duration=recommendedDuration(p);return p;
};
const exactRC=(p,t)=>p.source+(p.v0-p.source)*Math.exp(-t/(p.resistance*p.capacitance*1e-6));

test('Presets reproduce their documented regimes',()=>{
 assert.equal(characteristics(presets.rc).regime,'firstOrder');
 assert.equal(characteristics(presets.rl).regime,'firstOrder');
 assert.equal(characteristics(presets.series).regime,'underdamped');
 assert.equal(characteristics(presets.parallel).regime,'underdamped');
 assert.equal(characteristics(regimeCase('series',1)).regime,'critical');
 assert.equal(characteristics(regimeCase('parallel',1)).regime,'critical');
 assert.equal(characteristics(regimeCase('series',2)).regime,'overdamped');
 assert.equal(characteristics(regimeCase('parallel',2)).regime,'overdamped');
 assert.equal(characteristics({...presets.series,resistance:0}).regime,'undamped');
});

test('RK4 matches the closed form for every topology, regime and excitation',()=>{
 const cases=[];
 for(const topology of ['rc','rl'])cases.push(presets[topology],{...presets[topology],excitation:'natural',v0:3,i0:40});
 for(const topology of ['series','parallel'])for(const zeta of [.25,1,2])for(const excitation of ['step','natural'])cases.push({...regimeCase(topology,zeta),excitation,v0:2,i0:30});
 for(const p of cases){
  const r=simulate(p);
  assert.ok(r.errorV<1e-6,`${p.topology} voltage error ${r.errorV}`);
  assert.ok(r.errorI<1e-9,`${p.topology} current error ${r.errorI}`);
  assert.ok(r.samples.every(s=>Object.values(s).every(Number.isFinite)));
 }
});

test('Independent closed forms: RC time constant, RL steady state, series underdamped step',()=>{
 const rc=simulate(presets.rc),tau=presets.rc.resistance*presets.rc.capacitance*1e-6;
 const atTau=rc.samples.find(s=>Math.abs(s.time-tau)<rc.step/2);
 near(atTau.vc,5*(1-Math.exp(-1)),1e-8,'RC at τ');
 near(rc.samples.at(-1).vc,exactRC(presets.rc,rc.samples.at(-1).time),1e-8);
 const rl=simulate({...presets.rl,duration:50}); // 50 ms = 100 τ
 near(rl.samples.at(-1).il,presets.rl.source/presets.rl.resistance,1e-9,'RL steady current');
 near(rl.samples.at(-1).vL,0,1e-6,'RL steady inductor voltage');
 const p=presets.series,c=characteristics(p),r=simulate(p);
 for(const index of [0,100,400,r.samples.length-1]){
  const s=r.samples[index],t=s.time;
  const v=p.source*(1-Math.exp(-c.alpha*t)*(Math.cos(c.omegaD*t)+c.alpha/c.omegaD*Math.sin(c.omegaD*t)));
  near(s.vc,v,1e-7,'series closed form vC');
 }
});

test('Initial conditions are honored at t = 0⁺ and with non-zero values',()=>{
 for(const topology of topologies){
  const p={...presets[topology],v0:3,i0:25},r=simulate(p),first=r.samples[0];
  if(topology!=='rl')assert.equal(first.vc,3);
  if(topology!=='rc')assert.equal(first.il,25e-3);
  assert.equal(first.time,0);near(r.samples.at(-1).time,p.duration*1e-3,1e-15);
 }
});

test('Equilibrium initial state stays constant',()=>{
 const rc={...presets.rc,v0:5},r=simulate(rc);assert.ok(r.samples.every(s=>Math.abs(s.vc-5)<1e-12));
 const rl={...presets.rl,i0:50},q=simulate(rl);assert.ok(q.samples.every(s=>Math.abs(s.il-.05)<1e-12));
 const par={...presets.parallel,v0:0,i0:25},w=simulate(par);assert.ok(w.samples.every(s=>Math.abs(s.il-.025)<1e-9&&Math.abs(s.vc)<1e-9));
});

test('KVL and KCL hold at every sample',()=>{
 for(const topology of topologies)for(const excitation of ['step','natural']){
  const p={...presets[topology],excitation,v0:2,i0:30},r=simulate(p);
  for(const s of r.samples){
   if(topology==='parallel')near(s.source,s.iR+s.iC+s.il,1e-9,'KCL');
   else near(s.source,s.vR+s.vL+s.vc,1e-9,'KVL');
  }
 }
});

test('Energy balance closes: ΔE = ∫p_source dt − ∫R·iR² dt',()=>{
 for(const topology of topologies){
  const p={...presets[topology],v0:1,i0:10},r=simulate(p),scale=Math.max(Math.abs(r.work),r.heat,r.samples[0].energy,1e-12);
  assert.ok(Math.abs(r.energyResidual)<1e-4*scale,`${topology} residual ${r.energyResidual}`);
 }
 // The residual is the O(h²) trapezoidal quadrature error, so halving h divides it by about four.
 const q1=Math.abs(simulate(presets.series,{refinement:1}).energyResidual),q2=Math.abs(simulate(presets.series,{refinement:2}).energyResidual);
 assert.ok(q1/q2>3&&q1/q2<5,`quadrature order ${q1/q2}`);
 const lossless=simulate({...presets.series,resistance:0,excitation:'natural',v0:5,i0:0,duration:20}); // undamped LC
 const e0=lossless.samples[0].energy;assert.ok(lossless.samples.every(s=>Math.abs(s.energy-e0)<1e-6*e0));
 assert.equal(lossless.heat,0);
});

test('Underdamped response oscillates at ω_d and overdamped response does not overshoot',()=>{
 const p=regimeCase('series',.25),c=characteristics(p),r=simulate(p);
 assert.ok(Math.max(...r.samples.map(s=>s.vc))>p.source*1.3,'overshoot expected');
 const crossings=r.samples.slice(1).filter((s,j)=>(r.samples[j].vc-p.source)*(s.vc-p.source)<0).length;assert.ok(crossings>=2);
 const over=simulate(regimeCase('series',2));assert.ok(over.samples.every(s=>s.vc<=presets.series.source+1e-9));
 near(c.omegaD,c.omega0*Math.sqrt(1-.0625),1e-6*c.omega0);
});

test('Solution is continuous across the critical-damping boundary',()=>{
 const make=zeta=>homogeneous(1,0,zeta*1000,1000,.003)[0];
 near(make(1-1e-9),make(1),1e-6);near(make(1+1e-9),make(1),1e-6);
 const [y,d]=homogeneous(2,-3,1000,1000,0);assert.equal(y,2);assert.equal(d,-3);
});

test('RK4 convergence is fourth order on the RLC system',()=>{
 const p={...regimeCase('series',.25),duration:10};
 const error=n=>simulate(p,{refinement:n}).errorV;
 const e1=error(1),e2=error(2),e4=error(4);
 assert.ok(e1>e2&&e2>e4,'errors decrease monotonically');
 assert.ok(e1/e2>10&&e1/e2<22,`order ratio ${e1/e2}`);
 assert.ok(e2/e4>10&&e2/e4<22,`order ratio ${e2/e4}`);
 const f=([y])=>[-y];let y=[1];for(let i=0;i<20;i++)y=rk4Step(y,.05,f);near(y[0],Math.exp(-1),1e-6);
});

test('Time-scale scaling is dimensionally consistent',()=>{
 const a=simulate(presets.rc),b=simulate({...presets.rc,resistance:2000,capacitance:50});
 assert.equal(a.samples.length,b.samples.length);
 for(let i=0;i<a.samples.length;i+=97)near(a.samples[i].vc,b.samples[i].vc,1e-12);
});

test('Invalid inputs and resolution limits are rejected, never altered silently',()=>{
 const bad=[{resistance:0,topology:'rc'},{resistance:-1},{capacitance:0},{inductance:1e7},{duration:0},{source:NaN},{v0:Infinity},{i0:'5'},{topology:'delta'},{excitation:'ramp'},{duration:undefined}];
 for(const change of bad)assert.throws(()=>simulate({...presets.rc,...change}),CircuitError);
 assert.throws(()=>validate(null),CircuitError);
 assert.doesNotThrow(()=>validate({...presets.series,resistance:0}));
 assert.throws(()=>validate({...presets.parallel,resistance:0}),CircuitError);
 assert.throws(()=>simulate({...presets.rc,resistance:1,capacitance:.001,duration:500}),e=>e.code==='resolution');
 assert.throws(()=>simulate(presets.rc,{refinement:0}),CircuitError);
 assert.throws(()=>simulate(presets.rc,{refinement:1.5}),CircuitError);
 assert.throws(()=>simulate({...presets.rc,duration:1e7}),e=>e.code==='resolution');
 const huge=simulate({...presets.rc,duration:5*100}); // 5 s = 10 τ stays within budget
 assert.ok(huge.samples.length-1<=MAX_STEPS);
});

test('Analytical state is exact at t = 0 and respects the input convention',()=>{
 for(const topology of topologies){
  const p={...presets[topology],v0:1,i0:5},[v,i]=analyticalState(p,0);near(v,1,1e-15);near(i,.005,1e-15);
 }
 const p={...presets.parallel,excitation:'natural'};near(simulate(p).samples[0].source,0,0);
});

test('Derivations render with local KaTeX for every topology',()=>{
 for(const topology of topologies){
  const list=equations(topology);assert.ok(list.length>=6);
  for(const [key,latex] of list){
   assert.ok(key.startsWith('circuit_'));
   const html=katex.renderToString(latex,{displayMode:true,throwOnError:true,trust:false,output:'htmlAndMathml'});
   assert.ok(html.includes('<math'),'MathML output present');
  }
 }
});

test('Every circuit translation key used statically or dynamically exists in EN and PT-BR',()=>{
 const en=JSON.parse(readFileSync(new URL('../locales/en.json',import.meta.url),'utf8')),pt=JSON.parse(readFileSync(new URL('../locales/pt-BR.json',import.meta.url),'utf8'));
 const keys=['firstOrder','undamped','critical','underdamped','overdamped','stepPreset','naturalPreset','rcTitle','rlTitle','seriesTitle','parallelTitle','vc','vR','vL','il','iR','iC','currentSource','voltageSource','finalVL','finalVC','finalIC','finalIL','error_parameters','error_resolution','error_nonfinite','error_worker','error_load'].map(k=>'circuit_'+k);
 for(const topology of topologies)for(const [key] of equations(topology))keys.push(key);
 for(const key of keys){assert.ok(en[key]&&pt[key],`missing ${key}`);}
 for(const key of ['voltage','timeConstant','capacitance','resistance','initialVoltage'])assert.ok(en[key]&&pt[key],key);
});
