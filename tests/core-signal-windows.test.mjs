import test from 'node:test';
import assert from 'node:assert/strict';
import {fftshift,ifftshift,hamming,hann,blackman} from '../assets/js/core/signal.js';

const nearAll=(a,b,tol=1e-14)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=tol,`[${i}] ${v} != ${b[i]}`));};

test('fftshift e ifftshift: comprimentos par e ímpar como no MATLAB',()=>{
  assert.deepEqual(fftshift([0,1,2,3]),[2,3,0,1]);
  assert.deepEqual(ifftshift([0,1,2,3]),[2,3,0,1]);
  assert.deepEqual(fftshift([0,1,2,3,4]),[3,4,0,1,2]);
  assert.deepEqual(ifftshift([0,1,2,3,4]),[2,3,4,0,1]);
  assert.deepEqual(fftshift([7]),[7]);
  assert.deepEqual(ifftshift([7]),[7]);
  assert.deepEqual(fftshift([]),[]);
  assert.deepEqual(ifftshift([]),[]);
  assert.deepEqual(fftshift([1,2]),[2,1]);
});

test('fftshift e ifftshift com complexos, sem alterar a entrada',()=>{
  const x=[{re:0,im:1},{re:1,im:-1},{re:2,im:0},{re:3,im:3},{re:4,im:4}];
  const copy=JSON.parse(JSON.stringify(x));
  const s=fftshift(x);
  assert.deepEqual(s.map(z=>z.re),[3,4,0,1,2]);
  assert.deepEqual(s.map(z=>z.im),[3,4,1,-1,0]);
  assert.deepEqual(x,copy);
  assert.notEqual(s[2],x[0]);
  assert.deepEqual(ifftshift(s),x);
  // misto real/complexo preserva o tipo de cada elemento
  assert.deepEqual(fftshift([1,{re:2,im:5},3,4]),[3,4,1,{re:2,im:5}]);
});

test('ifftshift(fftshift(x)) devolve x e vice-versa',()=>{
  for(let n=0;n<=9;n++){
    const x=Array.from({length:n},(_,i)=>i*i-3);
    assert.deepEqual(ifftshift(fftshift(x)),x);
    assert.deepEqual(fftshift(ifftshift(x)),x);
  }
  assert.throws(()=>fftshift('abc'),TypeError);
  assert.throws(()=>ifftshift([1,NaN]),TypeError);
});

test('janelas simétricas: valores de referência pelas fórmulas do MATLAB',()=>{
  // L = 4: n/(L-1) = 0, 1/3, 2/3, 1
  nearAll(hamming(4),[0.08,0.77,0.77,0.08]);
  nearAll(hann(4),[0,0.75,0.75,0]);
  nearAll(blackman(4),[0,0.63,0.63,0]);
  // L = 5: n/(L-1) = 0, 1/4, 1/2, 3/4, 1
  nearAll(hamming(5),[0.08,0.54,1,0.54,0.08]);
  nearAll(hann(5),[0,0.5,1,0.5,0]);
  nearAll(blackman(5),[0,0.34,1,0.34,0]);
  // L = 8: valores clássicos
  const h8=hann(8);
  nearAll(h8,Array.from({length:8},(_,n)=>0.5*(1-Math.cos(2*Math.PI*n/7))));
  nearAll(hamming(8),Array.from({length:8},(_,n)=>0.54-0.46*Math.cos(2*Math.PI*n/7)));
  nearAll(blackman(8),Array.from({length:8},(_,n)=>0.42-0.5*Math.cos(2*Math.PI*n/7)+0.08*Math.cos(4*Math.PI*n/7)));
  assert.equal(h8[0],0);
  assert.equal(h8[7],0);
  // hamming(8) do MATLAB: 0.0800 0.2532 0.6424 0.9544 ...
  nearAll(hamming(8).slice(0,4),[0.08,0.25319469114498255,0.6423596296199047,0.9544456792350121],1e-12);
  // hann inclui zeros nas pontas (diferente de hanning): hann(5)(2:4) = hanning(3)
  nearAll(hann(5).slice(1,4),[0.5,1,0.5]);
});

test('janelas são exatamente simétricas',()=>{
  for(const f of [hamming,hann,blackman]){
    for(const L of [2,3,4,5,8,9,16,51,100]){
      const w=f(L);
      assert.equal(w.length,L);
      for(let i=0;i<L;i++)assert.equal(w[i],w[L-1-i],`${f.name}(${L})[${i}]`);
    }
  }
  // blackman: pontas ~ 0 apenas dentro do erro de arredondamento
  assert.ok(Math.abs(blackman(64)[0])<1e-15);
});

test('janela periódica = simétrica de L+1 sem a última amostra',()=>{
  for(const f of [hamming,hann,blackman]){
    for(const L of [2,3,4,5,8,13]){
      assert.deepEqual(f(L,'periodic'),f(L+1,'symmetric').slice(0,L));
      assert.deepEqual(f(L,'symmetric'),f(L));
    }
  }
  nearAll(hann(4,'periodic'),[0,0.5,1,0.5]);
  nearAll(hamming(4,'periodic'),[0.08,0.54,1,0.54]);
  assert.deepEqual(hann(3,'PERIODIC'),hann(3,'periodic'));
});

test('janelas: L = 0, L = 1 e entradas inválidas',()=>{
  for(const f of [hamming,hann,blackman]){
    assert.deepEqual(f(0),[]);
    assert.deepEqual(f(0,'periodic'),[]);
    assert.deepEqual(f(1),[1]);
    assert.deepEqual(f(1,'periodic'),[1]);
    assert.throws(()=>f(-1),RangeError);
    assert.throws(()=>f(2.5),RangeError);
    assert.throws(()=>f(NaN),TypeError);
    assert.throws(()=>f('8'),TypeError);
    assert.throws(()=>f(4,'foo'),RangeError);
    assert.throws(()=>f(4,1),RangeError);
  }
  assert.equal(hann(2).length,2);
  nearAll(hann(2),[0,0]);
  nearAll(hamming(2),[0.08,0.08]);
});
