import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import katex from '../assets/vendor/katex/katex.mjs';
import {EPS0,KE,MODES,MAX_CHARGES,presets,createDefaults,validate,fieldAt,coordinates,seeds,traceLine,logRange,equipotentialLevels,contourSegments} from '../simulators/electromagnetics/electrostatics/model.js';
import {blocks} from '../simulators/electromagnetics/electrostatics/equations.js';
const near=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}; relative tolerance ${tol}`);
const base=(over={})=>({...createDefaults(),...over});
const gradient=(s,x,y,h=1e-6)=>{const vx=(fieldAt(x+h,y,s).v-fieldAt(x-h,y,s).v)/(2*h),vy=(fieldAt(x,y+h,s).v-fieldAt(x,y-h,s).v)/(2*h);return {ex:-vx,ey:-vy};};

test('Constants follow CODATA 2022 and Coulomb constant is 1/(4πε0)',()=>{
 assert.equal(EPS0,8.8541878188e-12);near(KE,8.98755179e9,1e-9);
});
test('Point charge obeys Coulomb law and the right sign convention',()=>{
 const s=base({charges:[{x:0,y:0,q:2}]}),r=.5,f=fieldAt(r,0,s);
 near(f.ex,2e-9/(4*Math.PI*EPS0*r*r),1e-14);near(f.ey,0,1e-14);near(f.v,2e-9/(4*Math.PI*EPS0*r),1e-14);
 const neg=fieldAt(r,0,base({charges:[{x:0,y:0,q:-2}]}));near(neg.ex,-f.ex,1e-14);near(neg.v,-f.v,1e-14);
 const diag=fieldAt(.3,.4,s);near(diag.magnitude,2e-9/(4*Math.PI*EPS0*.25),1e-14);near(diag.ey/diag.ex,4/3,1e-12);
});
test('Superposition adds vectors; dipole midpoint field and pair midpoint cancellation',()=>{
 const dipole=fieldAt(0,0,base({charges:presets.dipole})),pair=fieldAt(0,0,base({charges:presets.pair}));
 near(dipole.ex,2*KE*2e-9/.64,1e-12);near(dipole.ey,0,1e-12);near(dipole.v,0,1e-12);
 near(pair.ex,0,1e-12);near(pair.v,2*KE*2e-9/.8,1e-12);
 const s=base({charges:presets.quadrupole}),sum=s.charges.map(c=>fieldAt(.31-c.x,.17-c.y,{...base(),charges:[{x:0,y:0,q:c.q}]})),f=fieldAt(.31,.17,s);
 near(f.ex,sum.reduce((a,b)=>a+b.ex,0),1e-12);near(f.ey,sum.reduce((a,b)=>a+b.ey,0),1e-12);near(f.v,sum.reduce((a,b)=>a+b.v,0),1e-12);
 const zero=fieldAt(.2,.1,base({charges:[{x:0,y:0,q:0}]}));assert.equal(zero.ex,0);assert.equal(zero.ey,0);assert.equal(zero.v,0);
});
test('E = −∇V for every geometry away from singularities and surfaces',()=>{
 const cases=[[base({charges:presets.quadrupole}),.31,.17],[base({mode:'sphere',material:'conductor',strength:3}),1.1,.4],[base({mode:'sphere',material:'insulator',strength:3}),.2,.3],[base({mode:'sphere',material:'insulator',strength:-3}),1.2,-.5],[base({mode:'wire',strength:-4,rref:2}),.6,-.8],[base({mode:'plates',strength:5}),.2,.7],[base({mode:'plates',strength:5}),1.4,.7]];
 for(const [s,x,y] of cases){const f=fieldAt(x,y,s),g=gradient(s,x,y);near(f.ex,g.ex,1e-5);near(f.ey,g.ey,1e-5);}
});
test('Conducting sphere: zero interior field, Gauss exterior, continuous V, jump σ/ε0',()=>{
 const s=base({mode:'sphere',material:'conductor',radius:.7,strength:2}),Q=2e-9,R=.7;
 assert.equal(fieldAt(.3,.2,s).magnitude,0);near(fieldAt(.3,.2,s).v,KE*Q/R,1e-14);
 for(const r of [.8,1.5,3]){const f=fieldAt(r,0,s);near(f.ex,KE*Q/(r*r),1e-14);near(f.v,KE*Q/r,1e-14);
  // Gauss on a concentric sphere: E_r 4πr² ε0 = Q, and the field is purely radial with the same magnitude at every angle.
  near(f.ex*4*Math.PI*r*r*EPS0,Q,1e-12);
  for(let j=0;j<12;j++){const a=j*Math.PI/6,g=fieldAt(r*Math.cos(a),r*Math.sin(a),s);near(g.ex*Math.cos(a)+g.ey*Math.sin(a),f.ex,1e-12);near(-g.ex*Math.sin(a)+g.ey*Math.cos(a),0,1e-12);}
 }
 const out=fieldAt(R*(1+1e-9),0,s),inn=fieldAt(R*(1-1e-9),0,s);near(out.v,inn.v,1e-8);
 near(out.ex-inn.ex,(Q/(4*Math.PI*R*R))/EPS0,1e-8);
 assert.equal(fieldAt(R,0,s).boundary,true);assert.equal(fieldAt(R,0,s).ex>0,true);
});
test('Insulating sphere: Gauss with enclosed charge, continuous E and V, centre finite',()=>{
 const s=base({mode:'sphere',material:'insulator',radius:.7,strength:2}),Q=2e-9,R=.7;
 near(fieldAt(.35,0,s).ex,KE*Q*.35/R**3,1e-14);near(fieldAt(.35,0,s).v,KE*Q*(3*R*R-.35**2)/(2*R**3),1e-14);
 near(fieldAt(R*(1-1e-9),0,s).ex,fieldAt(R*(1+1e-9),0,s).ex,1e-8);near(fieldAt(R*(1-1e-9),0,s).v,fieldAt(R*(1+1e-9),0,s).v,1e-8);
 const centre=fieldAt(0,0,s);assert.equal(centre.magnitude,0);near(centre.v,KE*Q*3/(2*R),1e-14);assert.equal(centre.singular,false);
 for(const r of [.2,.5,.69]){const g=fieldAt(r,0,s),enclosed=Q*(r/R)**3;near(g.ex*4*Math.PI*r*r*EPS0,enclosed,1e-12);}
});
test('Infinite wire: E ρ is constant, V depends on reference only by an additive constant',()=>{
 const s=base({mode:'wire',strength:3,rref:1}),lambda=3e-9;
 for(const r of [.2,.5,2]){const f=fieldAt(r*Math.cos(.7),r*Math.sin(.7),s);near(f.magnitude*2*Math.PI*EPS0*r,lambda,1e-12);}
 near(fieldAt(1,0,s).v,0,1e-12);near(fieldAt(2,0,s).v,-lambda/(2*Math.PI*EPS0)*Math.log(2),1e-12);
 const other=base({mode:'wire',strength:3,rref:4}),a=fieldAt(.6,.2,s),b=fieldAt(.6,.2,other);near(a.ex,b.ex,1e-14);near(a.ey,b.ey,1e-14);
 near(b.v-a.v,lambda/(2*Math.PI*EPS0)*Math.log(4),1e-12);
 const axis=fieldAt(0,0,s);assert.equal(axis.singular,true);assert.ok(Number.isNaN(axis.ex));
 const neutral=fieldAt(0,0,base({mode:'wire',strength:0}));assert.equal(neutral.singular,false);assert.equal(neutral.ex,0);
});
test('Parallel plates: uniform field between, zero outside, V drop σd/ε0, symmetry and sign',()=>{
 const s=base({mode:'plates',strength:5,separation:1.5}),sigma=5e-9,d=1.5;
 for(const [x,y] of [[-.7,0],[0,3],[.7,-2]]){const f=fieldAt(x,y,s);near(f.ex,sigma/EPS0,1e-12);assert.equal(f.ey,0);}
 for(const x of [-2,-.76,.76,3])assert.equal(fieldAt(x,.3,s).ex,0);
 near(fieldAt(-d/2,0,s).v-fieldAt(d/2,0,s).v,sigma*d/EPS0,1e-12);near(fieldAt(0,0,s).v,0,1e-12);
 near(fieldAt(-d/2,0,s).ex,sigma/(2*EPS0),1e-12);assert.equal(fieldAt(-d/2,0,s).boundary,true);
 const reversed=fieldAt(0,0,base({mode:'plates',strength:-5,separation:1.5}));near(reversed.ex,-sigma/EPS0,1e-12);
 near(fieldAt(.5,1,s).ex,fieldAt(-.5,-4,s).ex,1e-14);
});
test('Singular points of ideal charges are flagged, never softened',()=>{
 const f=fieldAt(.8,0,base({charges:presets.dipole}));assert.equal(f.singular,true);assert.ok(Number.isNaN(f.ex)&&Number.isNaN(f.v)&&Number.isNaN(f.magnitude));
 assert.equal(fieldAt(.8,1e-3,base({charges:presets.dipole})).singular,false);
});
test('Coordinates: cylindrical and spherical components match rotation of Cartesian components',()=>{
 const s=base({charges:presets.dipole}),f=fieldAt(.3,.9,s),c=coordinates(.3,.9,f);
 near(c.rho,Math.hypot(.3,.9),1e-14);near(c.phiDegrees,Math.atan2(.9,.3)*180/Math.PI,1e-12);
 near(Math.hypot(c.radial,c.azimuthal),f.magnitude,1e-12);
 near(c.radial,f.ex*Math.cos(c.phi)+f.ey*Math.sin(c.phi),1e-12);near(c.azimuthal,-f.ex*Math.sin(c.phi)+f.ey*Math.cos(c.phi),1e-12);
 const left=coordinates(-.5,-.5,{ex:1,ey:0});near(left.phiDegrees,225,1e-12);
 const origin=coordinates(0,0,{ex:1,ey:2});assert.ok(Number.isNaN(origin.phi)&&Number.isNaN(origin.radial)&&Number.isNaN(origin.theta));
 const wire=base({mode:'wire',strength:2}),g=fieldAt(.4,.3,wire),h=coordinates(.4,.3,g);near(h.azimuthal,0,1e-9*g.magnitude);near(h.radial,g.magnitude,1e-12);
});
test('Field lines follow E, start/end properly and stay inside the window',()=>{
 const s=base({charges:presets.dipole});
 const lines=seeds(s,s.extent*.35).map(seed=>traceLine(seed,s));
 assert.equal(lines.length,24);
 for(const points of lines){assert.ok(points.length>2);for(const [x,y] of points){assert.ok(Math.abs(x)<=3+1e-9&&Math.abs(y)<=3+1e-9);}}
 const plates=base({mode:'plates',strength:5}),line=traceLine({x:0,y:0,dir:1},plates);
 assert.ok(line.every(([x,y],j)=>Math.abs(y)<1e-12&&(j===0||x>line[j-1][0])));near(line.at(-1)[0],plates.separation/2,.03);
 const wire=base({mode:'wire',strength:2}),ray=traceLine({x:.04,y:0,dir:1},wire);assert.ok(ray.every(([,y])=>Math.abs(y)<1e-12));assert.ok(ray.at(-1)[0]>ray[0][0]);
 const inward=traceLine({x:.04,y:0,dir:-1},wire);assert.ok(inward[1][0]<inward[0][0]);
});
test('Colour range and equipotential helpers are robust to empty, flat and non-finite data',()=>{
 assert.deepEqual(logRange([]),{low:-2,high:2});
 const r=logRange([1,10,100,1000,NaN,0,Infinity]);assert.ok(r.high-r.low>=1);
 assert.deepEqual(equipotentialLevels([1,1,1,1]),[]);assert.deepEqual(equipotentialLevels([NaN]),[]);assert.deepEqual(equipotentialLevels([]),[]);
 const levels=equipotentialLevels(Array.from({length:101},(_,j)=>j),11);assert.equal(levels.length,11);assert.ok(levels.every((v,j)=>j===0||v>levels[j-1]));
});
test('Contour segments locate level sets by linear interpolation',()=>{
 const grid=[0,1,2].map(()=>[0,1,2,3]);const segments=contourSegments(grid,1.5);
 assert.equal(segments.length,2);for(const seg of segments)for(const [i] of seg)near(i,1.5,1e-12);
 assert.equal(contourSegments(grid,10).length,0);
 const withNaN=[[0,NaN],[1,1]];assert.equal(contourSegments(withNaN,.5).length,0);
});
test('Validation accepts defaults and rejects every out-of-range or malformed input',()=>{
 for(const mode of MODES)assert.equal(validate(base({mode})).mode,mode);
 const bad=[null,{},base({mode:'x'}),base({material:'y'}),base({charges:'no'}),base({radius:.1}),base({radius:2}),base({strength:11}),base({strength:NaN}),base({rref:0}),base({separation:5}),base({extent:0}),
  base({charges:Array.from({length:MAX_CHARGES+1},()=>({x:0,y:0,q:1}))}),base({charges:[{x:0,y:0,q:21}]}),base({charges:[{x:NaN,y:0,q:1}]}),base({charges:[null]}),base({charges:[{x:2e6,y:0,q:1}]})];
 for(const input of bad)assert.throws(()=>validate(input),RangeError);
 const original=base(),copy=validate(original);copy.charges[0].q=99;assert.notEqual(original.charges[0].q,99);
});
test('Presets are within limits and createDefaults returns independent copies',()=>{
 for(const [name,charges] of Object.entries(presets)){assert.ok(charges.length<=MAX_CHARGES,name);validate(base({charges}));}
 const a=createDefaults(),b=createDefaults();a.charges[0].q=7;assert.notEqual(b.charges[0].q,7);
 near(presets.dipole.reduce((sum,c)=>sum+c.q,0),0);near(presets.quadrupole.reduce((sum,c)=>sum+c.q,0),0);
});
test('Derivation blocks exist for each geometry, include required equations and render with KaTeX/MathML',async()=>{
 const dictionary=JSON.parse(await readFile(new URL('../simulators/electromagnetics/electrostatics/locales.json',import.meta.url),'utf8'));
 const variants=[base(),base({mode:'sphere',material:'conductor'}),base({mode:'sphere',material:'insulator'}),base({mode:'wire'}),base({mode:'plates'})];
 const signatures=new Set();
 for(const s of variants){
  const list=blocks(s);signatures.add(JSON.stringify(list));
  assert.ok(list.filter(([k])=>k==='eq').length>=6);assert.ok(list.some(([k])=>k==='h'));
  for(const [kind,value] of list){
   if(kind==='eq'){const html=katex.renderToString(value,{displayMode:true,throwOnError:true,trust:false,output:'htmlAndMathml'});assert.match(html,/<math/);assert.match(html,/<annotation encoding="application\/x-tex">/);}
   else for(const language of Object.keys(dictionary))assert.ok(dictionary[language][value],`${language}.${value}`);
  }
 }
 assert.equal(signatures.size,variants.length);
});
test('PT-BR, EN and ES dictionaries cover the same keys, placeholders and every key used by the page and UI code',async()=>{
 const dictionary=JSON.parse(await readFile(new URL('../simulators/electromagnetics/electrostatics/locales.json',import.meta.url),'utf8'));
 const keys=Object.keys(dictionary.en).sort();
 assert.deepEqual(Object.keys(dictionary).sort(),['en','es','pt-BR']);
 for(const language of ['pt-BR','es']){assert.deepEqual(Object.keys(dictionary[language]).sort(),keys,language);}
 for(const language of Object.keys(dictionary))for(const key of keys){
  const value=dictionary[language][key];assert.equal(typeof value,'string',`${language}.${key}`);assert.ok(value.trim().length,`${language}.${key}`);
  assert.doesNotMatch(value,/�|[A-Za-zÁÉÍÓÚáéíóúñã]\?[A-Za-z]/,`${language}.${key}`);
  assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(dictionary.en[key].match(/\{\w+\}/g)||[]).sort(),`${language}.${key}`);
 }
 for(const key of keys.filter(k=>!/^(eyebrow|wireMarker|chargeAria|removeCharge)$/.test(k)&&dictionary.en[k].length>25))assert.notEqual(dictionary.es[key],dictionary.en[key],`es.${key} is untranslated`);
 const html=await readFile(new URL('../simulators/electromagnetics/electrostatics/index.html',import.meta.url),'utf8');
 for(const [,key] of html.matchAll(/data-m(?:-aria)?="([\w]+)"/g))assert.ok(dictionary.en[key],`index.html: ${key}`);
 const shared=JSON.parse(await readFile(new URL('../locales/es.json',import.meta.url),'utf8'));
 for(const [,key] of html.matchAll(/data-i18n(?:-aria)?="([\w-]+)"/g))assert.ok(shared[key],`shared es: ${key}`);
 const ui=await readFile(new URL('../simulators/electromagnetics/electrostatics/ui.js',import.meta.url),'utf8');
 for(const [,key] of ui.matchAll(/\btr\('([\w]+)'/g))assert.ok(dictionary.en[key],`ui.js: ${key}`);
 for(const key of ['lambda','sigma','q','cart','cyl','sph','scale','selected','basis','singular','boundary','clipped','zero','invalid','exportError'])assert.ok(dictionary.es[key],key);
});
test('Source files are DOM-free where required and the catalogue entry is consistent',async()=>{
 const model=await readFile(new URL('../simulators/electromagnetics/electrostatics/model.js',import.meta.url),'utf8');
 assert.doesNotMatch(model,/\b(document\.|window\.|localStorage|fetch\(|getContext|addEventListener)/);
 const catalog=JSON.parse(await readFile(new URL('../data/simulators.json',import.meta.url),'utf8')),entry=catalog.find(item=>item.id==='electrostatics');
 assert.ok(entry);assert.deepEqual([...entry.languages].sort(),['en','es','pt-BR']);assert.equal(entry.category,'electromagnetics');
 for(const language of ['en','pt-BR','es']){assert.ok(entry.title[language]);assert.ok(entry.description[language]);assert.ok(entry.keywords[language].length);}
 for(const path of [entry.path,entry.thumbnail,...entry.validationEvidence.map(e=>e.path)])await readFile(new URL('../'+path,import.meta.url));
});
