import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {median,quantile,percentile,histogram,simpson,quad} from '../assets/js/core/numeric.js';

const ref=JSON.parse(await readFile(new URL('./fixtures/core-extensions-python.json',import.meta.url),'utf8')).numeric;
const near=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('median, quantile and percentile match NumPy linear convention',()=>{
  assert.equal(median(ref.v),ref.median);
  ref.q.forEach((q,i)=>near(quantile(ref.v,q),ref.quantile[i]));
  ref.q.forEach((q,i)=>near(percentile(ref.v,q*100),ref.percentile[i]));
  assert.deepEqual(quantile(ref.v,ref.q),ref.quantile);
  assert.deepEqual(percentile(ref.v,[10,25,50,90]),ref.percentile);
  assert.throws(()=>quantile([],0.5),RangeError);assert.throws(()=>percentile(ref.v,101),RangeError);
});

test('histogram counts and edges match NumPy including rightmost edge',()=>{
  const got=histogram(ref.hist_v,ref.hist_edges);
  assert.deepEqual(got.counts,ref.hist_counts);assert.deepEqual(got.edges,ref.hist_edges);
  assert.deepEqual(histogram([2,2,2],4).counts,[0,0,3,0]);
  assert.deepEqual(histogram([2,2,2],4),{counts:ref.hist_const_counts,edges:ref.hist_const_edges});
  assert.deepEqual(histogram(new Float64Array([2,2,2]),4).edges,[1.5,1.75,2,2.25,2.5]);
  assert.deepEqual(histogram(new Float64Array(40000).fill(7),4).counts,[0,0,40000,0]);
  assert.deepEqual(histogram([1,2,3],2,[0,4]).counts,[1,2]);
  assert.deepEqual(histogram([],3),{counts:[0,0,0],edges:[0,1/3,2/3,1]});
  assert.throws(()=>histogram([1,2],0),RangeError);assert.throws(()=>histogram([1], [0,2,1]),RangeError);
});

test('composite Simpson integration matches SciPy for odd/even samples and nonuniform x',()=>{
  near(simpson(ref.simpson_x,ref.simpson_y),ref.simpson,1e-12);
  near(simpson(ref.simpson_even_x,ref.simpson_even_y),ref.simpson_even,1e-12);
  near(simpson([0,1,2],[0,1,8]),4);
  assert.throws(()=>simpson([0,1,1],[1,2,3]),RangeError);
});

test('adaptive Simpson quadrature matches SciPy quad fixtures and reports an error estimate',()=>{
  const a=quad(x=>Math.sin(x*x),0,2,{epsAbs:1e-12,epsRel:1e-12});
  const b=quad(x=>Math.exp(-x*x),-3,4,{epsAbs:1e-12,epsRel:1e-12});
  near(a.value,ref.quad_sin_square,2e-11);near(b.value,ref.quad_gaussian,2e-11);
  assert.ok(a.error>=0&&a.evaluations>5);
  const reversed=quad(x=>x*x,2,0);near(reversed.value,-8/3);
  assert.deepEqual(quad(()=>0,1,1),{value:0,error:0,evaluations:0,converged:true});
  assert.equal(quad(Math.exp,0,4,{epsAbs:1e-15,epsRel:0,maxDepth:0}).converged,false);
  assert.throws(()=>quad(2,0,1),TypeError);assert.throws(()=>quad(()=>1,0,1,{epsAbs:0,epsRel:0}),RangeError);
});
