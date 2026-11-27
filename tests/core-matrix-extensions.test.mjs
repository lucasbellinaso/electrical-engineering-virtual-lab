import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ones,diag,reshape,svd,svdvals,rank,pinv,mmul,transpose} from '../assets/js/core/matrix.js';

const ref=JSON.parse(await readFile(new URL('./fixtures/core-extensions-python.json',import.meta.url),'utf8'));
function near(a,b,tol=1e-11){assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);}
function matrixNear(A,B,tol=1e-11){assert.equal(A.length,B.length);for(let i=0;i<A.length;i++){assert.equal(A[i].length,B[i].length);for(let j=0;j<A[i].length;j++)near(A[i][j],B[i][j],tol);}}
function reconstruct({U,s,Vh}){const US=U.map(row=>row.map((v,k)=>v*s[k]));return mmul(US,Vh);}

test('matrix constructors match NumPy ones, diag and row-major reshape',()=>{
  assert.deepEqual(ones(2,3),ref.constructors.ones);
  assert.deepEqual(diag([2,-1,4],1),ref.constructors.diag_matrix);
  assert.deepEqual(diag([[1,2,3],[4,5,6],[7,8,9]],-1),ref.constructors.diag_vector);
  assert.deepEqual(reshape([1,2,3,4,5,6],3,2),ref.constructors.reshape);
  assert.deepEqual(reshape([[1,2,3],[4,5,6]],2,3),[[1,2,3],[4,5,6]]);
  assert.deepEqual(reshape([new Float64Array([1,2]),new Float64Array([3,4])],1,4),[[1,2,3,4]]);
  assert.deepEqual(diag([new Float64Array([1,2]),new Float64Array([3,4])]),[1,4]);
  assert.throws(()=>ones(-1,2),RangeError);assert.throws(()=>reshape([1,2],2,2),RangeError);
});

test('reduced real SVD, singular values, rank and pseudoinverse match NumPy/SciPy',()=>{
  for(const {A,s,pinv:P,rank:r} of ref.matrices){
    const d=svd(A);matrixNear(reconstruct(d),A,2e-11);
    assert.equal(d.s.length,Math.min(A.length,A[0].length));
    d.s.forEach((v,i)=>near(v,s[i],2e-11));
    assert.deepEqual(svdvals(A),d.s);assert.equal(rank(A),r);matrixNear(pinv(A),P,2e-10);
    const Aplus=pinv(A);
    matrixNear(mmul(mmul(A,Aplus),A),A,3e-10);
    matrixNear(mmul(mmul(Aplus,A),Aplus),Aplus,3e-10);
  }
});

test('Float64Array inputs and scaled SVD stay stable at large magnitudes',()=>{
  const A=[new Float64Array([3e200,0]),new Float64Array([0,4e200])];
  const d=svd(A);assert.deepEqual(d.s,[4e200,3e200]);
  assert.equal(rank(A),2);matrixNear(pinv(A).map(row=>row.map(x=>x*1e200)),[[1/3,0],[0,1/4]],2e-14);
  matrixNear(reconstruct(d).map(row=>row.map(x=>x/1e200)),[[3,0],[0,4]],2e-14);
  assert.deepEqual(reshape(new Float64Array([1,2,3,4]),2,2),[[1,2],[3,4]]);
  assert.deepEqual(diag(new Float64Array([2,3])),[[2,0],[0,3]]);
  assert.deepEqual(svd([[],[]]),{U:[[],[]],s:[],Vh:[]});
});

test('rank and pinv use a strict absolute singular-value cutoff',()=>{
  const A=[[2,0,0],[0,1e-4,0],[0,0,1e-8]];
  assert.equal(rank(A,1e-4),1); // singular values equal to tol are discarded
  assert.equal(rank(A,1e-5),2);
  matrixNear(pinv(A,1e-4),[[0.5,0,0],[0,0,0],[0,0,0]],1e-12);
  matrixNear(pinv(A,1e-5),[[0.5,0,0],[0,1e4,0],[0,0,0]],1e-12);
  assert.equal(rank([[0,0],[0,0]]),0);
  assert.deepEqual(pinv([[0,0],[0,0]]),[[0,0],[0,0]]);
  assert.equal(rank([]),0);
  assert.deepEqual(pinv([]),[]);
});

test('SVD family rejects malformed, non-finite and invalid cutoff inputs',()=>{
  for(const fn of [svd,svdvals,rank,pinv]){
    assert.throws(()=>fn([[1,2],[3]]),RangeError);
    assert.throws(()=>fn([[1,Infinity]]),RangeError);
  }
  for(const tol of [-1,Infinity,NaN]){
    assert.throws(()=>rank([[1]],tol),RangeError);
    assert.throws(()=>pinv([[1]],tol),RangeError);
  }
});

test('rank and pinv use NumPy rank and SciPy pinv singular-value cutoffs',()=>{
  const A=[[1,0],[0,1e-16]];
  // Default relative cutoff is max(shape) * machine epsilon * largest singular value.
  assert.equal(rank(A),1);
  matrixNear(pinv(A),[[1,0],[0,0]]);
  // An explicit tol is an absolute singular-value cutoff and values equal to it are dropped.
  assert.equal(rank(A,1e-16),1);
  matrixNear(pinv(A,1e-16),[[1,0],[0,0]]);
  assert.equal(rank(A,5e-17),2);
  matrixNear(pinv(A,5e-17),[[1,0],[0,1e16]],2e-15);
  assert.throws(()=>rank(A,-1),RangeError);
  assert.throws(()=>pinv(A,Infinity),RangeError);
});
