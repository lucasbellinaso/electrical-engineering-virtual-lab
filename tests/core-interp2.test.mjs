import test from 'node:test';
import assert from 'node:assert/strict';
import {interp2} from '../assets/js/core/numeric.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);
test('bilinear interpolation on an irregular grid matches analytical surface',()=>{
 const x=[-2,1,4],y=[-1,2,6],z=y.map(v=>x.map(u=>2+3*u-4*v+2*u*v));
 for(const [a,b] of [[-2,-1],[4,6],[0,0],[2,4],[-1,3]]) near(interp2(x,y,z,a,b),2+3*a-4*b+2*a*b);
 near(interp2(x,y,z,5,0),14);
 near(interp2(x,y,z,-10,20),-52);
 assert.ok(Number.isNaN(interp2(x,y,z,NaN,0)));
});
test('descending axes and array queries preserve grid values and shape',()=>{
 const x=[2,0,-1],y=[4,1],z=y.map(v=>x.map(u=>u+2*v));
 assert.deepEqual(interp2(x,y,z,[[2,0],[-1,1]],[[4,1],[1,4]]),[[10,2],[1,9]]);
 assert.deepEqual(interp2(x,y,z,[0,1],1),[2,3]);
 assert.equal(interp2(x,y,z,100,-100),4);
});
test('invalid grids and query shapes are rejected',()=>{
 assert.throws(()=>interp2([0,0],[0,1],[[1,2],[3,4]],0,0),RangeError);
 assert.throws(()=>interp2([0,1],[0,1],[[1],[2]],0,0),RangeError);
 assert.throws(()=>interp2([0,1],[0,1],[[1,2],[3,4]],[0,1],[0]),RangeError);
});
