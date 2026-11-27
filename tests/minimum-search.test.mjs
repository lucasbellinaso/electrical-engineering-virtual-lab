import test from 'node:test';
import assert from 'node:assert/strict';
import {functions,solve,gradientArrow} from '../simulators/numerical-methods/minimum-search/model.js';
for (const [id,spec] of Object.entries(functions)) test(`minimum search ${id} converges and records steps`,()=>{
 const result=solve(id,spec.initial,{tol:1e-6,maxIter:300,maxEval:3000});
 assert.equal(result.success,true, result.status);assert.ok(result.fun < spec.fn(spec.initial));
 assert.equal(result.history.length,result.iterations+1);
 for (let i=1;i<result.history.length;i++){
  const prev=result.history[i-1],step=result.history[i];assert.ok(step.evaluations>=prev.evaluations);assert.ok(step.stepSize>0);assert.equal(step.direction.length,spec.dimension);
  step.x.forEach((v,j)=>assert.ok(Math.abs(v-prev.x[j]-step.stepSize*step.direction[j])<1e-10));
 }
});
test('invalid function or initial dimensions are rejected',()=>{assert.throws(()=>solve('unknown',[0]));assert.throws(()=>solve('bowl',[0]));});

test('documented global minima are inside the graph and achieve the known minimum',()=>{
 for(const [id,spec] of Object.entries(functions)){
  for(const point of spec.minima){
   assert.equal(point.length,spec.dimension);
   assert.ok(point.every(v=>v>=spec.range[0]&&v<=spec.range[1]));
   assert.ok(Math.abs(spec.fn(point)-(id==='shifted'?1:id==='doublewell'?-0.30542848374391596:0))<1e-8);
   assert.ok(Math.hypot(...spec.initial.map((v,i)=>v-point[i]))>0.5);
  }
 }
});

test('gradient arrow follows the selected gradient with a fixed visual length',()=>{
 const arrow=gradientArrow([3,4],[-5,5]);assert.ok(Math.abs(Math.hypot(...arrow)-0.8)<1e-12);
 assert.ok(Math.abs(arrow[0]/arrow[1]-0.75)<1e-12);
 assert.equal(gradientArrow([0,0],[-5,5]),null);assert.equal(gradientArrow(null,[-5,5]),null);
});

test('double-well function has a higher local minimum',()=>{
 const spec=functions.doublewell;const global=spec.minima[0],local=spec.localMinima[0];
 assert.equal(spec.localMinima.length,1);assert.ok(spec.fn(local)>spec.fn(global));
 assert.ok(Math.hypot(...spec.gradient(local))<1e-9);assert.ok(Math.hypot(...spec.gradient(global))<1e-9);
 const result=solve('doublewell',spec.initial,{tol:1e-6,maxIter:300,maxEval:3000});
 assert.equal(result.success,true);assert.ok(Math.abs(result.fun-spec.fn(local))<1e-8);
});
