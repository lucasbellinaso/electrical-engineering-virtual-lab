import test from 'node:test';
import assert from 'node:assert/strict';
import {polyfit,polyval} from '../assets/js/core/polynomial.js';

const near=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const nearAll=(a,b,tol)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],tol));};

test('polyfit recupera os coeficientes de dados polinomiais exatos',()=>{
  const c=[2,-3,0.5,4];
  const x=[-2,-1,0,1,2,3,4];
  const {p,S,mu}=polyfit(x,x.map(v=>polyval(c,v)),3);
  nearAll(p,c,1e-12);
  assert.ok(S.normr<1e-12);
  assert.equal(S.df,3);
  assert.equal(mu,null);
  assert.equal(S.R.length,4);
  assert.equal(S.R[3][0],0);
  assert.equal(S.illConditioned,false);
  // interpolação exata: n+1 pontos, df = 0
  const q=polyfit([0,1,2],[1,4,9],2);
  nearAll(q.p,[1,2,1],1e-13);
  assert.equal(q.S.df,0);
});

test('polyfit de grau 1 coincide com a reta de mínimos quadrados analítica',()=>{
  const x=[0,1,2,3],y=[1,3,5,7.5];
  // inclinação Sxy/Sxx = 10,75/5; intercepto ȳ − a·x̄
  const a=2.15,b=4.125-a*1.5;
  const {p,S}=polyfit(x,y,1);
  nearAll(p,[a,b],1e-13);
  const r=y.map((v,i)=>v-(a*x[i]+b));
  near(S.normr,Math.hypot(...r),1e-12);
  assert.equal(S.df,2);
  // grau 0 = média
  nearAll(polyfit(x,y,0).p,[(1+3+5+7.5)/4],1e-14);
  // o resíduo é ortogonal às colunas de V
  near(r.reduce((s,v)=>s+v,0),0,1e-12);
  near(r.reduce((s,v,i)=>s+v*x[i],0),0,1e-12);
});

test('polyfit com centralização e escala concorda com o ajuste direto',()=>{
  const x=Array.from({length:21},(_,i)=>1900+5*i);
  const truth=t=>0.002*(t-1950)**3-0.1*(t-1950)**2+3*(t-1950)+7;
  const y=x.map((t,i)=>truth(t)+0.3*Math.sin(i*1.7));
  const norm=polyfit(x,y,3,{normalize:true});
  const [m,s]=norm.mu;
  near(m,1950,1e-12);
  near(s,Math.sqrt(x.reduce((a,v)=>a+(v-1950)**2,0)/20),1e-12);
  // a curva ajustada é a mesma nas duas formas (quando a direta é resolvível)
  const direct=polyfit(x,y,3);
  for(const t of [1900,1951,2000,2100]){
    near(polyval(norm.p,(t-m)/s),polyval(direct.p,t),1e-5);
  }
  near(norm.S.normr,direct.S.normr,1e-6);
  assert.equal(norm.S.illConditioned,false);
  // grau alto em intervalo largo: sem normalizar fica mal condicionado, normalizado não
  const xl=Array.from({length:30},(_,i)=>1000+i*100);
  const yl=xl.map(t=>Math.sin(t/900));
  const bad=polyfit(xl,yl,9),good=polyfit(xl,yl,9,{normalize:true});
  assert.equal(bad.S.illConditioned,true);
  assert.ok(bad.S.rcond<2.3e-16);
  assert.equal(good.S.illConditioned,false);
  assert.ok(good.S.normr<1e-3);
  // normalizado reproduz exatamente um polinômio no intervalo largo
  const c=[1e-9,-2e-6,3e-3,1];
  const ex=polyfit(xl,xl.map(t=>polyval(c,t)),3,{normalize:true});
  assert.ok(ex.S.normr<1e-5);
  xl.forEach(t=>near(polyval(ex.p,(t-ex.mu[0])/ex.mu[1]),polyval(c,t),1e-9));
});

test('polyfit com pontos repetidos e grau excessivo',()=>{
  // x repetido, mas com 2 valores distintos: reta é possível
  const x=[1,1,3,3],y=[1,3,5,7];
  const {p,S}=polyfit(x,y,1);
  nearAll(p,[2,0],1e-13);
  near(S.normr,2,1e-12);
  assert.equal(S.df,2);
  // grau 2 com apenas 2 valores distintos: não único
  assert.throws(()=>polyfit(x,y,2),RangeError);
  assert.throws(()=>polyfit([0,1,2],[1,2,3],3),/distintos/);
  assert.throws(()=>polyfit([0,1,2],[1,2,3],3),RangeError);
  // todos iguais com normalize
  assert.throws(()=>polyfit([2,2,2],[1,2,3],0,{normalize:true}),RangeError);
  nearAll(polyfit([2,2,2],[1,2,3],0).p,[2],1e-14);
});

test('polyfit valida entradas',()=>{
  assert.throws(()=>polyfit('a',[1],0),TypeError);
  assert.throws(()=>polyfit([1,2],'a',1),TypeError);
  assert.throws(()=>polyfit([],[],0),RangeError);
  assert.throws(()=>polyfit([1,2,3],[1,2],1),RangeError);
  assert.throws(()=>polyfit([1,NaN],[1,2],1),RangeError);
  assert.throws(()=>polyfit([1,2],[1,Infinity],1),RangeError);
  assert.throws(()=>polyfit([1,'2'],[1,2],1),TypeError);
  assert.throws(()=>polyfit([1,2],[1,2],-1),RangeError);
  assert.throws(()=>polyfit([1,2,3],[1,2,3],1.5),RangeError);
  assert.throws(()=>polyfit([1,2,3],[1,2,3],'1'),TypeError);
  assert.throws(()=>polyfit([1,2,3],[1,2,3],NaN),RangeError);
  assert.throws(()=>polyfit([1,2,3],[1,2,3],1,{normalize:'sim'}),TypeError);
  assert.throws(()=>polyfit([1,2,3],[1,2,3],1,5),TypeError);
});
