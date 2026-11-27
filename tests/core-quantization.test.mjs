import test from 'node:test';
import assert from 'node:assert/strict';
import {quantize} from '../assets/js/core/quantization.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);
test('uniform levels, modes, saturation and errors',()=>{
 const input=[-1,3,3.2,12], base={min:0,max:10,levels:6};
 assert.deepEqual(quantize(input,base).values,[0,4,4,10]);
 assert.deepEqual(quantize(input,{...base,rounding:'floor'}).values,[0,2,2,10]);
 assert.deepEqual(quantize(input,{...base,rounding:'ceil'}).values,[0,4,4,10]);
 const r=quantize(input,base); assert.deepEqual(r.indices,[0,2,2,5]);near(r.error[0],1);near(r.error[3],-2);assert.equal(r.step,2);
});
test('8-bit 0-5 V conversion includes endpoints and saturates',()=>{
 const r=quantize([0,2.5,5,-1,6],{min:0,max:5,bits:8});
 assert.deepEqual(r.indices,[0,128,255,0,255]);near(r.step,5/255);near(r.values[1],128*5/255);
 assert.deepEqual(quantize([[0,5]],{min:0,max:5,levels:256}).values,[[0,5]]);
});
test('ties select upper level even in negative ranges',()=>{
 assert.equal(quantize(-3,{min:-10,max:0,levels:6}).values,-2);
 assert.equal(quantize(-2,{min:-1,max:1,levels:2}).values,-1);
});
test('invalid configurations and nonfinite inputs are rejected',()=>{
 for (const options of [{min:0,max:1},{min:1,max:0,bits:8},{min:0,max:1,bits:0},{min:0,max:1,levels:1},{min:0,max:1,bits:8,levels:256},{min:0,max:1,bits:8,rounding:'fix'}]) assert.throws(()=>quantize(0,options));
 assert.throws(()=>quantize(NaN,{min:0,max:1,bits:8}));
});
