import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import katex from '../assets/vendor/katex/katex.mjs';
import {MU0,defaults,validate,fieldAt,createEvaluator,sources,loopAxis,continuousSolenoidAxis,coordinates,sampleMap,traceLine} from '../simulators/electromagnetics/magnetostatics/model.js';
import {parseState,serializeState,defaultView} from '../simulators/electromagnetics/magnetostatics/state.js';
import {equations} from '../simulators/electromagnetics/magnetostatics/equations.js';
const near=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}; tolerance ${tol}`);
function independentLoop(x,z,p,n=16384){
 let bx=0,bz=0;const dphi=2*Math.PI/n;
 for(let j=0;j<n;j++){
  const phi=(j+.5)*dphi,point=[p.radius*Math.cos(phi),p.radius*Math.sin(phi),0],dl=[-p.radius*Math.sin(phi)*dphi,p.radius*Math.cos(phi)*dphi,0],r=[x-point[0],-point[1],z];
  const factor=MU0*p.muR*p.current/(4*Math.PI*Math.hypot(...r)**3);
  bx+=factor*(dl[1]*r[2]-dl[2]*r[1]);bz+=factor*(dl[0]*r[1]-dl[1]*r[0]);
 }return {bx,bz};
}
test('Infinite wire obeys Ampère, the right-hand rule and SI scale',()=>{
 const p={...defaults,current:10},r=.2,f=fieldAt(r,0,p);near(f.bx,0);near(f.by,MU0*10/(2*Math.PI*r),1e-18);near(f.hMagnitude,10/(2*Math.PI*r),1e-12);assert.equal(f.bz,0);
 const reversed=fieldAt(r,0,{...p,current:-10});near(reversed.by,-f.by,1e-18);
});
test('Uniform current density: finite centre, continuous surface and enclosed current',()=>{
 const p={...defaults},evaluate=createEvaluator(p),b=p.wireRadius;
 assert.equal(evaluate(0,0).magnitude,0);near(evaluate(b/2,0).by,MU0*p.current/(4*Math.PI*b),1e-18);
 near(evaluate(b*(1-1e-8),0).by,evaluate(b*(1+1e-8),0).by,1e-17);
 for(const radius of [b/2,b*2]){
  let circulation=0;const n=360;
  for(let j=0;j<n;j++){const a=(j+.5)*2*Math.PI/n,f=evaluate(radius*Math.cos(a),radius*Math.sin(a));circulation+=(-f.hx*Math.sin(a)+f.hy*Math.cos(a))*radius*2*Math.PI/n;}
  near(circulation,p.current*Math.min(1,(radius/b)**2),1e-10);
 }
});
test('Two-wire superposition cancels or reinforces at the midpoint as expected',()=>{
 const parallel=fieldAt(0,0,{...defaults,arrangement:'parallel'}),opposed=fieldAt(0,0,{...defaults,arrangement:'opposed'});
 near(parallel.magnitude,0,1e-19);near(opposed.by,2*MU0*defaults.current/(Math.PI*defaults.separation),1e-18);assert.ok(opposed.by>0);
 const p={...defaults,arrangement:'opposed'},sum=sources(p).map(w=>fieldAt(.3-w.x,.2-w.y,{...defaults,current:w.current}));const f=fieldAt(.3,.2,p);near(f.bx,sum[0].bx+sum[1].bx,1e-18);near(f.by,sum[0].by+sum[1].by,1e-18);
});
test('Circular loop axis matches the analytical solution at centre and off-centre',()=>{
 for(const z of [-1,-.3,0,.2,1]){
  const p={...defaults,mode:'loop'},f=fieldAt(0,z,p);near(f.bz,loopAxis(z,p.radius,p.current,p.muR),1e-17);near(f.bx,0,1e-18);assert.equal(f.by,0);
 }
 const p={...defaults,mode:'loop'};near(fieldAt(0,0,p).bz,MU0*p.current/(2*p.radius),1e-17);
});
test('Off-axis Biot–Savart agrees with an independently evaluated vector integral',()=>{
 const p={...defaults,mode:'loop',segments:128},f=fieldAt(.22,.34,p),ref=independentLoop(.22,.34,p);near(f.bx,ref.bx,1e-16);near(f.bz,ref.bz,1e-16);
});
test('Refinement improves the loop quadrature near the excluded region',()=>{
 const p={...defaults,mode:'loop',wireRadius:.02},x=.43,z=.05,ref=independentLoop(x,z,p);
 const errors=[64,128,256].map(segments=>{const f=fieldAt(x,z,{...p,segments});return Math.hypot(f.bx-ref.bx,f.bz-ref.bz);});
 assert.ok(errors[1]<errors[0]/10);assert.ok(errors[2]<errors[1]/10);
});
test('Meridional symmetry holds for loop and finite coil',()=>{
 for(const mode of ['loop','solenoid']){
  const p={...defaults,mode},f=fieldAt(.2,.3,p),left=fieldAt(-.2,.3,p),bottom=fieldAt(.2,-.3,p);
  near(f.bx,-left.bx,1e-16);near(f.bz,left.bz,1e-16);near(f.bx,-bottom.bx,1e-16);near(f.bz,bottom.bz,1e-16);
 }
});
test('Finite solenoid axis equals the sum of analytical discrete-loop fields',()=>{
 const p={...defaults,mode:'solenoid'};
 for(const z of [-.5,0,.8]){const expected=sources(p).reduce((sum,s)=>sum+loopAxis(z-s.z,p.radius,p.current,p.muR),0);near(fieldAt(0,z,p).bz,expected,1e-16);}
 const one={...p,turns:1};near(fieldAt(.2,.3,one).bz,fieldAt(.2,.3,{...one,mode:'loop'}).bz,1e-17);
});
test('Discrete winding converges towards the continuous-winding axis limit',()=>{
 const errors=[8,16,32,64].map(turns=>{const p={...defaults,mode:'solenoid',turns,current:100/turns};return Math.abs(fieldAt(0,.17,p).bz-continuousSolenoidAxis(.17,p));});
 for(let j=1;j<errors.length;j++)assert.ok(errors[j]<errors[j-1]/3.8);
});
test('Source current and homogeneous permeability scale B linearly; H is independent of μr',()=>{
 for(const mode of ['wires','loop','solenoid']){
  const p={...defaults,mode},f=fieldAt(.2,.3,p),scaled=fieldAt(.2,.3,{...p,current:p.current*2,muR:3}),mu=fieldAt(.2,.3,{...p,muR:3});near(scaled.magnitude,6*f.magnitude,1e-15);near(mu.hMagnitude,f.hMagnitude,1e-10);near(fieldAt(.2,.3,{...p,current:0}).magnitude,0);
 }
});
test('Excluded loop region is explicitly invalid, never softened or returned as zero field',()=>{
 const p={...defaults,mode:'loop'},f=fieldAt(p.radius,0,p);assert.equal(f.excluded,true);assert.ok(Number.isNaN(f.magnitude));assert.equal(fieldAt(p.radius,p.wireRadius*1.1,p).excluded,false);
});
test('Coordinates preserve Cartesian position and distinguish components from basis',()=>{
 const p={...defaults},f=fieldAt(.3,.4,p),c=coordinates(.3,.4,p,f);near(c.rho,.5);near(c.radial,0,1e-18);near(c.azimuthal,f.magnitude,1e-18);assert.equal(c.z,0);
 const loop={...p,mode:'loop'},left=fieldAt(-.2,.3,loop),l=coordinates(-.2,.3,loop,left);assert.equal(l.x,-.2);assert.equal(l.y,0);assert.equal(l.z,.3);near(l.phi,Math.PI);near(l.radial,-left.bx,1e-18);
});
test('Map samples and spatial field lines are finite, bounded and use the same evaluator',()=>{
 const r=sampleMap(defaults,{size:17,lines:true});assert.equal(r.grid.length,289);assert.ok(r.maximum>0);assert.ok(r.fieldLines.length>0);
 const f=r.grid[123],direct=fieldAt(f.x,f.y,defaults);near(f.bx,direct.bx,1e-18);
 for(const line of r.fieldLines)for(const [x,y]of line)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=defaults.extent/2&&Math.abs(y)<=defaults.extent/2);
 const zero=sampleMap({...defaults,current:0},{size:9});assert.equal(zero.maximum,0);assert.equal(zero.fieldLines.length,0);
});
test('Inputs, model bounds and computational options reject invalid values',()=>{
 for(const change of [{current:NaN},{muR:0},{radius:0},{wireRadius:0},{turns:2.2},{turns:81},{extent:Infinity},{segments:100},{mode:'invalid'}])assert.throws(()=>validate({...defaults,...change}));
 assert.throws(()=>validate({...defaults,mode:'loop',radius:.1,wireRadius:.04}),/thinWire/);assert.throws(()=>validate({...defaults,arrangement:'parallel',wireRadius:.15,separation:.2}),/overlap/);assert.throws(()=>fieldAt(Infinity,0));assert.throws(()=>sampleMap(defaults,{size:100}));assert.throws(()=>traceLine(createEvaluator(defaults),defaults,[.1,0],{step:-1}));
});
test('Configuration URLs round-trip all parameters, probe and view without locale-dependent parsing',()=>{
 const p={...defaults,mode:'loop',current:-12.5},probe={x:.123,y:-.234},view={...defaultView,heat:false,coordinates:'cylindrical'},q=serializeState(p,probe,view),state=parseState(q);
 assert.deepEqual(state,{parameters:p,probe,view});assert.ok(q.includes('current=-12.5'));assert.throws(()=>parseState('current=12,5'));assert.throws(()=>parseState('current='));assert.throws(()=>parseState('probex=NaN'));assert.throws(()=>parseState('lines=false'));
});
test('All UI translations, placeholders and LaTeX derivations are complete in PT/EN/ES',async()=>{
 const base=new URL('../simulators/electromagnetics/magnetostatics/',import.meta.url),d=JSON.parse(await readFile(new URL('locales.json',base),'utf8')),html=await readFile(new URL('index.html',base),'utf8');
 for(const language of ['pt-BR','en','es']){assert.deepEqual(Object.keys(d[language]).sort(),Object.keys(d.en).sort());for(const key of Object.keys(d.en)){assert.ok(d[language][key]);assert.deepEqual((d[language][key].match(/\{\w+\}/g)||[]).sort(),(d.en[key].match(/\{\w+\}/g)||[]).sort());}for(const match of html.matchAll(/data-m(?:-aria)?="([^"]+)"/g))assert.ok(d[language][match[1]],match[1]);}
 for(const mode of ['wires','loop','solenoid'])for(const [key,latex]of equations(mode)){assert.ok(d.en[key]&&d.es[key]&&d['pt-BR'][key]);assert.match(katex.renderToString(latex,{throwOnError:true,displayMode:true,output:'htmlAndMathml'}),/<math/);}
});
