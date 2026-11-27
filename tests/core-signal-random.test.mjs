import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fft,ifft,lfilter,filter} from '../assets/js/core/signal.js';
import {mulberry32,createRandom} from '../assets/js/core/random.js';

const ref=JSON.parse(await readFile(new URL('./fixtures/core-extensions-python.json',import.meta.url),'utf8'));
const close=(a,b,tol=2e-11)=>{assert.ok(Math.abs(a.re-b.re)<=tol*Math.max(1,Math.abs(b.re)),`${a.re} != ${b.re}`);assert.ok(Math.abs(a.im-b.im)<=tol*Math.max(1,Math.abs(b.im)),`${a.im} != ${b.im}`);};
const complexArray=a=>a.map(x=>typeof x==='number'?{re:x,im:0}:x);

test('FFT and IFFT match NumPy for radix-2, arbitrary-length and complex vectors',()=>{
  for(const [input,expected,inverseRef] of [[ref.signal.fft_real,ref.signal.fft_real_ref,ref.signal.ifft_real_ref],[ref.signal.fft_nonpow,ref.signal.fft_nonpow_ref,ref.signal.ifft_nonpow_ref],[ref.signal.fft_complex,ref.signal.fft_complex_ref,ref.signal.ifft_complex_ref]]){
    const got=fft(input);assert.equal(got.length,expected.length);got.forEach((z,i)=>close(z,expected[i]));
    ifft(input).forEach((z,i)=>close(z,inverseRef[i]));
    const back=ifft(got);back.forEach((z,i)=>close(z,complexArray(input)[i]));
  }
  assert.deepEqual(fft([]),[]);assert.deepEqual(ifft([]),[]);
  for(const input of [[7],[1,2],[1,2,3,4],[1,2,3,4,5,6,7,8]]){
    const got=fft(input),back=ifft(got);
    back.forEach((z,i)=>close(z,{re:input[i],im:0}));
  }
  assert.throws(()=>fft([1,Infinity]),TypeError);
  assert.throws(()=>ifft([{re:1,im:NaN}]),TypeError);
});

test('FFT of 4095 complex samples matches independent SciPy reference',()=>{
  const n=4095,input=Array.from({length:n},(_,j)=>({re:Math.sin(j*.173)+.3*Math.cos(j*.031),im:Math.sin(j*.047)}));
  const expected=[[0,15.613285189020322,36.03107930235905],[1,15.124322281152029,36.463648284582305],[17,25.665048944771847,72.72630134310825],[112,437.7552848412089,428.70227597787414],[500,1.1846346561502443,-1.347554139758147],[1024,.8843902734171152,-.2857315047702942],[2047,.5619787452825549,.3483022941062855],[4094,16.148705929963434,35.67462092644373]];
  const got=fft(input);
  for(const [k,re,im] of expected)close(got[k],{re,im},2e-10);
  const reconstructed=ifft(got);input.forEach((z,i)=>close(reconstructed[i],z,2e-10));
});

test('lfilter direct-form-II transposed matches SciPy output and final state',()=>{
  const f=ref.signal.filter,got=lfilter(f.b,f.a,f.x,f.zi);
  assert.deepEqual(filter(f.b,f.a,f.x,f.zi),got);
  assert.equal(got.y.length,f.y.length);got.y.forEach((y,i)=>assert.ok(Math.abs(y-f.y[i])<1e-14));
  got.zf.forEach((z,i)=>assert.ok(Math.abs(z-f.zf[i])<1e-14));
  assert.deepEqual(lfilter([2],[1],[1,2,3]),{y:[2,4,6],zf:[]});
  // SciPy's lfilter state is the DF-II-transposed delay vector, carried
  // directly between chunks without a change of convention.
  const whole=lfilter([1,2],[1,-0.5],[1,2,3,4]);
  const first=lfilter([1,2],[1,-0.5],[1,2]);
  const second=lfilter([1,2],[1,-0.5],[3,4],first.zf);
  assert.deepEqual([...first.y,...second.y],whole.y);
  second.zf.forEach((z,i)=>assert.ok(Math.abs(z-whole.zf[i])<1e-14));
  const complex=lfilter([{re:1,im:1}],[1],[{re:2,im:-1}]);
  assert.deepEqual(complex,{y:[{re:3,im:1}],zf:[]});
  const fc=ref.signal.filter_complex,complexRef=lfilter(fc.b,fc.a,fc.x);
  complexRef.y.forEach((z,i)=>close(z,fc.y[i]));
  assert.deepEqual(lfilter([1,2],[1,-0.5],[]),{y:[],zf:[0]});
  assert.throws(()=>lfilter([], [1], [1]),RangeError);
  assert.throws(()=>lfilter([1],[1],[1],[0]),RangeError);
  assert.throws(()=>lfilter([1],[1],[NaN]),TypeError);
  assert.throws(()=>lfilter([1],[0],[1]),RangeError);
});

test('seeded uniform and Gaussian samplers are reproducible and match NumPy distribution statistics',()=>{
  const a=mulberry32(42),b=mulberry32(42);for(let i=0;i<100;i++){const x=a();assert.equal(x,b());assert.ok(x>=0&&x<1);}
  const rng=createRandom(20261127),sample=Array.from({length:ref.random_numpy_stats.size},()=>rng.normal());
  const mean=sample.reduce((s,x)=>s+x,0)/sample.length;
  const variance=sample.reduce((s,x)=>s+x*x,0)/sample.length-mean*mean;
  assert.ok(Math.abs(mean-ref.random_numpy_stats.mean)<0.02,`mean ${mean}`);
  assert.ok(Math.abs(Math.sqrt(variance)-ref.random_numpy_stats.std_population)<0.02,`std ${Math.sqrt(variance)}`);
  const uniform=mulberry32(314),u=Array.from({length:ref.uniform_numpy_stats.size},()=>uniform()),uMean=u.reduce((s,x)=>s+x,0)/u.length,uStd=Math.sqrt(u.reduce((s,x)=>s+x*x,0)/u.length-uMean*uMean);
  assert.ok(Math.abs(uMean-ref.uniform_numpy_stats.mean)<0.01,`uniform mean ${uMean}`);
  assert.ok(Math.abs(uStd-ref.uniform_numpy_stats.std_population)<0.01,`uniform std ${uStd}`);
  assert.equal(createRandom(9).normal(3,0),3);
  assert.throws(()=>createRandom(1).normal(0,-1),RangeError);
  assert.throws(()=>mulberry32(-1),RangeError);
  assert.throws(()=>mulberry32(1.5),TypeError);
  assert.throws(()=>createRandom(1).normal(NaN),TypeError);
  const cached=createRandom(123),fresh=createRandom(123);
  assert.equal(cached.normal(0,0),0);
  assert.equal(cached.normal(),fresh.normal());
});
