import test from 'node:test';
import assert from 'node:assert/strict';
import {qr,lu,chol,cholp,cond,lstsq,mldivide,mmul,transpose,eye,msolve,svdvals} from '../assets/js/core/matrix.js';

const EPS=Number.EPSILON;
const maxAbs=A=>A.reduce((a,row)=>row.reduce((b,v)=>Math.max(b,Math.abs(v)),a),0);
const sub=(A,B)=>A.map((row,i)=>row.map((v,j)=>v-B[i][j]));
// Erro relativo máximo ||A-B||max / max(||B||max, 1e-300), comparado a c·max(m,n)·eps (erro de retroavanço de Householder/LU/Cholesky: O(n·eps)).
function assertClose(A,B,c=50,msg=''){
  assert.equal(A.length,B.length,msg);
  if(!A.length)return;
  assert.equal(A[0].length,B[0].length,msg);
  const n=Math.max(A.length,A[0].length),err=maxAbs(sub(A,B)),esc=Math.max(maxAbs(B),1e-300);
  assert.ok(err<=c*n*EPS*esc,`${msg} erro ${err} > ${c*n*EPS*esc}`);
}
const isUpper=R=>R.every((row,i)=>row.every((v,j)=>j>=i||v===0));
const isLower=L=>L.every((row,i)=>row.every((v,j)=>j<=i||v===0));
const hilbert=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>1/(i+j+1)));
const permCols=(A,perm)=>A.map(row=>perm.map(j=>row[j]));

const casos={
  quadrada:[[4,-2,1],[3,6,-4],[2,1,8]],
  alta:[[1,2],[3,4],[5,6],[7,8.5]],
  larga:[[1,2,3,4],[-2,0.5,1,7]],
  'posto deficiente':[[1,2,3],[2,4,6],[1,0,1],[0,1,1]],
  '1x1':[[-3]],
  'Hilbert 8':hilbert(8),
};

for(const [nome,A] of Object.entries(casos)){
  const m=A.length,n=A[0].length,k=Math.min(m,n);
  test(`qr: ${nome}`,()=>{
    const {Q,R}=qr(A);
    assert.equal(Q.length,m);assert.equal(Q[0].length,m);assert.equal(R.length,m);assert.equal(R[0].length,n);
    assertClose(mmul(Q,R),A,50,'QR=A');
    assertClose(mmul(transpose(Q),Q),eye(m),50,'QtQ=I');
    assert.ok(isUpper(R));
    const e=qr(A,{econ:true});
    assert.equal(e.Q[0].length,k);assert.equal(e.R.length,k);assert.equal(e.R[0].length,n);
    assertClose(mmul(e.Q,e.R),A,50,'QR=A econ');
    assertClose(mmul(transpose(e.Q),e.Q),eye(k),50,'QtQ=I econ');
    assert.ok(isUpper(e.R));
  });
  test(`qr com pivotamento: ${nome}`,()=>{
    const {Q,R,P,perm}=qr(A,{pivot:true});
    assertClose(mmul(Q,R),permCols(A,perm),50,'A[:,perm]=QR');
    assertClose(mmul(A,P),mmul(Q,R),50,'AP=QR');
    assertClose(mmul(transpose(Q),Q),eye(m),50,'QtQ=I');
    assert.ok(isUpper(R));assert.deepEqual([...perm].sort((a,b)=>a-b),Array.from({length:n},(_,j)=>j));
    for(let i=0;i+1<k;i++)assert.ok(Math.abs(R[i][i])>=Math.abs(R[i+1][i+1])*(1-1e-12),'diagonal decrescente');
  });
  test(`lu: ${nome}`,()=>{
    const {L,U,P,perm}=lu(A);
    assert.equal(L.length,m);assert.equal(U.length,k);
    assertClose(mmul(P,A),mmul(L,U),50,'PA=LU');
    assert.ok(isLower(L));assert.ok(isUpper(U));
    for(let i=0;i<k;i++)assert.equal(L[i][i],1);
    assert.deepEqual(P.map((row,i)=>row.indexOf(1)),perm);
    for(const row of P)assert.equal(row.reduce((a,b)=>a+b,0),1);
  });
}

test('qr: pivotamento ordena colunas por norma e dá posto 2 em A de posto deficiente',()=>{
  const A=casos['posto deficiente'];
  const {R}=qr(A,{pivot:true});
  const tol=4*3*EPS*Math.abs(R[0][0]);
  assert.equal(R.slice(0,3).filter((row,i)=>Math.abs(row[i])>tol).length,2);
  // Coluna de maior norma (a 3a, norma sqrt(1+36+1+... )) vai primeiro.
  assert.equal(qr(A,{pivot:true}).perm[0],2);
});

test('qr: A = diag com sinais conhecidos e coluna nula',()=>{
  const {Q,R}=qr([[0,0],[0,0]]);
  assert.deepEqual(R,[[0,0],[0,0]]);assert.deepEqual(Q,eye(2));
  const x=qr([[3],[4]]);
  assertClose(x.R,[[-5],[0]],10); // alfa = -sinal(x0)·||x||
});

test('matriz vazia e dimensões degeneradas',()=>{
  assert.deepEqual(qr([]),{Q:[],R:[]});
  assert.deepEqual(qr([],{pivot:true}).perm,[]);
  const l=lu([]);assert.deepEqual([l.L,l.U,l.P,l.perm],[[],[],[],[]]);
  assert.deepEqual(chol([]),[]);assert.deepEqual(cholp([]),{R:[],p:0});
  assert.equal(cond([]),0);
  assert.deepEqual(mldivide([],[]),[]);
  const r=qr([[],[]]);assert.equal(r.Q.length,2);assert.deepEqual(r.R,[[],[]]);
  assert.deepEqual(lstsq([[],[]],[[1],[2]]).X,[]);
});

test('lu: matriz singular não lança; pivô nulo em U',()=>{
  const A=[[1,2,3],[2,4,6],[1,0,1]];
  const {L,U,P}=lu(A);
  assertClose(mmul(P,A),mmul(L,U),50);
  assert.ok(U.some((row,i)=>row[i]===0));
  const Z=lu([[0,0],[0,0]]);
  assert.deepEqual(Z.U,[[0,0],[0,0]]);assert.deepEqual(Z.L,eye(2));
});

test('lu: caso analítico com troca de linhas',()=>{
  const {L,U,P,perm}=lu([[1,2],[3,4]]);
  assert.deepEqual(perm,[1,0]);assert.deepEqual(P,[[0,1],[1,0]]);
  assertClose(L,[[1,0],[1/3,1]],10);assertClose(U,[[3,4],[0,2-4/3]],10);
});

test('chol: RtR = A, R triangular superior com diagonal positiva',()=>{
  for(const A of [[[4,12,-16],[12,37,-43],[-16,-43,98]],hilbert(8),[[9]]]){
    const R=chol(A);
    assert.ok(isUpper(R));R.forEach((row,i)=>assert.ok(row[i]>0));
    assertClose(mmul(transpose(R),R),A,50,'RtR=A');
  }
  assert.deepEqual(chol([[4,12,-16],[12,37,-43],[-16,-43,98]]),[[2,6,-8],[0,1,5],[0,0,3]]);
});

test('chol: matriz não definida positiva lança NOT_POSITIVE_DEFINITE; cholp devolve p',()=>{
  for(const A of [[[1,2],[2,1]],[[0,0],[0,0]],[[1,1],[1,1]],[[-1]]]){
    assert.throws(()=>chol(A),e=>e.code==='NOT_POSITIVE_DEFINITE'&&e instanceof Error);
  }
  const r=cholp([[1,2],[2,1]]);assert.equal(r.p,2);assert.deepEqual(r.R,[[1]]);
  const r0=cholp([[-1]]);assert.equal(r0.p,1);assert.deepEqual(r0.R,[]);
  assert.equal(cholp([[2,1],[1,2]]).p,0);
  try{chol([[1,2],[2,1]]);}catch(e){assert.equal(e.p,2);}
});

test('cond: diagonal, identidade e singular',()=>{
  assert.equal(cond([[10,0],[0,0.5]]),20);
  assert.equal(cond([[2,0,0],[0,-8,0],[0,0,4]]),4);
  assert.equal(cond(eye(4)),1);
  assert.equal(cond([[1,2],[2,4]]),Infinity);
  assert.equal(cond([[1,2],[2,4]],1),Infinity);
  assert.equal(cond([[1,2],[2,4]],Infinity),Infinity);
  assert.equal(cond([[1,2],[2,4]],'fro'),Infinity);
  assert.equal(cond([[10,0],[0,0.5]],1),20);
  assert.equal(cond([[10,0],[0,0.5]],Infinity),20);
  assert.ok(Math.abs(cond([[10,0],[0,0.5]],'fro')-(Math.sqrt(100.25)*Math.sqrt(4+0.01))) < 1e-12);
  // Retangular, p = 2: razão dos valores singulares.
  const s=svdvals(casos.alta);assert.equal(cond(casos.alta),s[0]/s[s.length-1]);
  // [[1,1],[0,1]] tem cond1 = 4 (norma-1 = 2, inversa [[1,-1],[0,1]] norma-1 = 2).
  assert.equal(cond([[1,1],[0,1]],1),4);
  assert.equal(cond([[1,1],[0,1]],Infinity),4);
});

test('cond: Hilbert 8x8 tem cond2 ≈ 1.5258e10; QR, LU e Cholesky continuam consistentes',()=>{
  const c=cond(hilbert(8));
  assert.ok(Math.abs(c/1.5258e10-1)<1e-3,`cond=${c}`);
  assert.ok(cond(hilbert(8),1)>c);   // κ1 ≥ κ2/n
});

test('mldivide: sistema quadrado compatível = msolve (igualdade exata)',()=>{
  const A=casos.quadrada,B=[[1,0],[2,1],[3,-1]];
  assert.deepEqual(mldivide(A,B),msolve(A,B));
  const X=mldivide(A,B);assertClose(mmul(A,X),B,50);
  const d=mldivide(A,B,{details:true});assert.equal(d.method,'gauss');assert.deepEqual(d.X,X);
  assert.throws(()=>mldivide([[1,2],[2,4]],[[1],[1]]),e=>e.code==='SINGULAR_MATRIX');
});

test('mldivide: reta de mínimos quadrados com solução analítica',()=>{
  // Pontos (0,1),(1,3),(2,5),(3,7.5): ajuste y = a + b x. Equações normais: n=4, Σx=6, Σx²=14, Σy=16.5, Σxy=35.5
  // b = (4·35.5 − 6·16.5)/(4·14 − 36) = 43/20 = 2.15, a = (16.5 − 6·2.15)/4 = 0.9
  const A=[[1,0],[1,1],[1,2],[1,3]],y=[[1],[3],[5],[7.5]];
  const d=mldivide(A,y,{details:true});
  assert.equal(d.method,'qr-pivot');assert.equal(d.rank,2);assert.equal(d.rankDeficient,false);
  assertClose(d.X,[[0.9],[2.15]],50);
  // Pontos colineares: ajuste exato (resíduo nulo).
  const ex=mldivide(A,[[2],[5],[8],[11]]);assertClose(ex,[[2],[3]],50);
});

test('mldivide: concorda com as equações normais em caso bem condicionado; várias colunas',()=>{
  const A=[[2,-1],[0,3],[1,1],[4,0.5],[-1,2]],B=[[1,0],[2,1],[0,-1],[3,2],[1,1]];
  const At=transpose(A),Xn=msolve(mmul(At,A),mmul(At,B));
  const X=mldivide(A,B);
  assert.equal(X.length,2);assert.equal(X[0].length,2);
  assertClose(X,Xn,1e3);   // equações normais têm erro ~cond(A)²·eps, daí a tolerância maior
  // Ortogonalidade do resíduo: At·(AX−B) ≈ 0.
  const res=sub(mmul(A,X),B),g=mmul(At,res);assert.ok(maxAbs(g)<1e-12*maxAbs(B)*5);
});

test('mldivide: sistema subdeterminado devolve solução básica (no máx. m componentes não nulas)',()=>{
  const A=[[1,2,3],[0,1,1]],B=[[6],[2]];
  const {X,rank}=mldivide(A,B,{details:true});
  assert.equal(rank,2);
  assertClose(mmul(A,X),B,50);
  assert.ok(X.filter(r=>r[0]!==0).length<=2);
});

test('mldivide: posto deficiente dá solução básica (não a de norma mínima) e expõe o posto',()=>{
  // Colunas 0 e 1 iguais; A·x = b com b = 2·coluna: solução básica usa uma só coluna: x = [2,0] ou [0,2]. pinv daria [1,1].
  const A=[[1,1],[2,2],[3,3]],B=[[2],[4],[6]];
  const d=mldivide(A,B,{details:true});
  assert.equal(d.rank,1);assert.equal(d.rankDeficient,true);
  assert.equal(d.X.filter(r=>r[0]!==0).length,1);
  assertClose([[d.X[0][0]+d.X[1][0]]],[[2]],50);
  assertClose(mmul(A,d.X),B,50);
  // Posto deficiente com b fora da imagem: resíduo ortogonal à imagem de A.
  const b2=[[1],[0],[0]],x=mldivide(A,b2),res=sub(mmul(A,x),b2);
  assert.ok(Math.abs(res[0][0]+2*res[1][0]+3*res[2][0])<1e-13);
  assert.equal(lstsq(casos['posto deficiente'],[[1],[2],[3],[4]]).rank,2);
  assert.equal(lstsq([[0,0],[0,0],[0,0]],[[1],[1],[1]]).rank,0);
  assert.deepEqual(lstsq([[0,0],[0,0],[0,0]],[[1],[1],[1]]).X,[[0],[0]]);
});

test('mldivide: Hilbert alta 8x4 e QR comparável à resolução quadrada',()=>{
  const H=hilbert(8),xv=[[1],[-2],[3],[0.5],[1],[1],[2],[-1]],b=mmul(H,xv);
  const xq=mldivide(H,b),xg=msolve(H,b);
  // erro relativo da ordem cond·eps ≈ 1.5e10·2.2e-16 ≈ 3e-6: tolerância 1e-4
  for(let i=0;i<8;i++)assert.ok(Math.abs(xq[i][0]-xv[i][0])<1e-4*Math.max(1,Math.abs(xv[i][0])),`i=${i}`);
  assert.ok(xg.length===8);
  const H48=H.slice(0,8).map(r=>r.slice(0,4)),x4=[[1],[2],[3],[4]],X=mldivide(H48,mmul(H48,x4));
  assertClose(X,x4,1e5);
});

test('entradas inválidas',()=>{
  assert.throws(()=>qr('x'),TypeError);assert.throws(()=>qr([1,2]),TypeError);
  assert.throws(()=>qr([[1,2],[3]]),RangeError);assert.throws(()=>qr([[1,NaN]]),RangeError);
  assert.throws(()=>qr([[1]],null),TypeError);assert.throws(()=>qr([[1]],{econ:1}),TypeError);assert.throws(()=>qr([[1]],{pivot:'sim'}),TypeError);
  assert.throws(()=>lu(5),TypeError);assert.throws(()=>lu([[1,Infinity]]),RangeError);
  assert.throws(()=>chol([[1,2,3],[4,5,6]]),RangeError);assert.throws(()=>chol([[1,2],[3,4]]),RangeError);assert.throws(()=>chol(null),TypeError);
  assert.throws(()=>cholp([[1,2],[3,4]]),RangeError);
  assert.throws(()=>cond([[1]],3),RangeError);assert.throws(()=>cond([[1,2,3],[4,5,6]],1),RangeError);assert.throws(()=>cond('a'),TypeError);
  assert.throws(()=>mldivide([[1,2],[3,4],[5,6]],[[1],[2]]),RangeError);
  assert.throws(()=>mldivide([[1]],'b'),TypeError);assert.throws(()=>mldivide([[1,2]],[[1]],5),TypeError);
  assert.throws(()=>lstsq([[1,2]],[[1]],{tol:-1}),RangeError);assert.throws(()=>lstsq([[1,2]],[[1]],{tol:NaN}),RangeError);
});

test('as entradas não são modificadas',()=>{
  const A=[[4,1],[1,3],[2,2]],c=JSON.stringify(A);
  qr(A,{pivot:true});lu(A);lstsq(A,[[1],[2],[3]]);cond(A);
  assert.equal(JSON.stringify(A),c);
});
