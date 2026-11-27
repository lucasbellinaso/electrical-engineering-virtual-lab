import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {erf,erfc,qfunc,ndtr,ndtri,normalInterval} from '../assets/js/core/special.js';

const ref=JSON.parse(await readFile(new URL('./fixtures/core-extensions-python.json',import.meta.url),'utf8')).special;
const close=(a,b,tol=2e-14)=>{if(Object.is(a,b))return;assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);};

test('special functions: erf, erfc, normal CDF and Q match SciPy',()=>{
  for(let i=0;i<ref.x.length;i++){
    close(erf(ref.x[i]),ref.erf[i]);close(erfc(ref.x[i]),ref.erfc[i],2e-13);
    close(ndtr(ref.x[i]),ref.ndtr[i]);close(qfunc(ref.x[i]),ref.qfunc[i]);
  }
  assert.equal(erf(Infinity),1);assert.equal(erf(-Infinity),-1);assert.equal(erfc(Infinity),0);assert.equal(erfc(-Infinity),2);
  const tiny=erf(1e-20),tinyRef=2e-20/Math.sqrt(Math.PI);assert.ok(Math.abs(tiny-tinyRef)<tinyRef*2e-15);assert.ok(Object.is(erf(-0),-0));
  assert.throws(()=>erfc(NaN),TypeError);assert.throws(()=>qfunc('1'),TypeError);
});

test('inverse normal CDF and Gaussian interval probability match SciPy quadrature',()=>{
  for(let i=0;i<ref.p.length;i++)close(ndtri(ref.p[i]),ref.ndtri[i],2e-9);
  close(ndtri(0),-Infinity);close(ndtri(1),Infinity);close(ndtri(.5),0);
  for(const row of ref.intervals)close(normalInterval(row.a,row.b),row.value,1e-12);
  assert.equal(normalInterval(2,1),0);assert.throws(()=>ndtri(1.1),RangeError);
});
