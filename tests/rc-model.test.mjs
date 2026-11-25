import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,defaults,rk4,validate} from '../templates/simulator/model.js';
test('Initial condition, known analytic transient and 5τ steady state',()=>{
 const r=simulate();assert.equal(r.samples[0].voltage,0);
 assert.ok(r.maxError<2e-9);
 assert.ok(Math.abs(r.samples.at(-1).voltage-5*(1-Math.exp(-5)))<2e-9);
 assert.ok(Math.abs(r.samples.find(s=>Math.abs(s.time-r.tau)<r.step/2).voltage-5*(1-Math.exp(-1)))<2e-9);
});
test('Nonzero initial condition, negative source and equilibrium',()=>{
 for(const p of [{...defaults,initialVoltage:10},{...defaults,voltage:-5},{...defaults,initialVoltage:5}]){
  const r=simulate(p);assert.equal(r.samples[0].voltage,p.initialVoltage);assert.ok(r.maxError<1e-8);assert.ok(r.samples.every(s=>Number.isFinite(s.voltage)));
 }
 assert.ok(simulate({...defaults,initialVoltage:5}).samples.every(s=>s.voltage===5));
});
test('RC scaling is dimensionally consistent and endpoints are exact',()=>{
 const a=simulate(),b=simulate({...defaults,resistance:2000,capacitance:50});assert.equal(a.tau,b.tau);assert.deepEqual(a.samples,b.samples);
 assert.equal(a.samples.at(-1).time,defaults.duration/1000);
});
test('RK4 convergence is fourth order',()=>{
 const error=n=>{let y=1;for(let i=0;i<n;i++)y=rk4(y,1/n,x=>-x);return Math.abs(y-Math.exp(-1));};
 const ratio=error(10)/error(20);assert.ok(ratio>15&&ratio<18);
});
test('Monotonic ideal charging and energy balance',()=>{
 const r=simulate(),C=defaults.capacitance*1e-6,R=defaults.resistance,Vs=defaults.voltage;let source=0,loss=0;
 for(let i=1;i<r.samples.length;i++){const a=r.samples[i-1],b=r.samples[i],ia=(Vs-a.voltage)/R,ib=(Vs-b.voltage)/R;assert.ok(b.voltage>=a.voltage&&b.voltage<=Vs);source+=Vs*(ia+ib)/2*r.step;loss+=R*(ia*ia+ib*ib)/2*r.step;}
 const stored=.5*C*r.samples.at(-1).voltage**2;assert.ok(Math.abs(source-loss-stored)/source<2e-5);
});
test('Bounds, non-finite values and computational limit',()=>{
 for(const p of [{resistance:0},{capacitance:-1},{duration:0},{voltage:NaN},{initialVoltage:Infinity},{voltage:'5'},{resistance:1,capacitance:.001,duration:500}])assert.throws(()=>simulate({...defaults,...p}));
 assert.throws(()=>validate({...defaults,duration:10001}));
 const r=simulate({...defaults,duration:10000});assert.ok(r.samples.length<=5002);assert.ok(r.step/r.tau<=.0200000001);assert.ok(r.maxError<3e-8);
});
