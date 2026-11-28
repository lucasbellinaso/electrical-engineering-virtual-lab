/*
 * Álgebra linear densa e pura (sem DOM, sem dependências) do laboratório EEVL.
 *
 * Convenções:
 * - Matriz = array de linhas: [[a, b], [c, d]] representa a matriz 2x2 com linha 0 = [a, b].
 *   Índices são A[linha][coluna], base 0. Vetores não são tipo próprio: usa-se matriz coluna n x 1.
 * - Grandezas em unidades do SI; a álgebra é adimensional, cabe ao chamador manter a coerência.
 * - Matriz vazia [] é a matriz 0x0. det([]) = 1, expm([]) = [], inv([]) = [].
 * - Erros: TypeError se o tipo de entrada não é array/número; RangeError se a forma
 *   (não retangular, dimensões incompatíveis, não quadrada onde exigido) ou o valor
 *   (não finito, dimensão negativa ou não inteira) é inválido. msolve/inv lançam
 *   Error('Matriz singular') para sistemas singulares; o erro traz code = 'SINGULAR_MATRIX'.
 *   Por padrão só o pivô exatamente nulo é singular; o chamador pode exigir mais com a opção
 *   { absTol, relTol } de msolve/inv (singular se o maior pivô ≤ max(absTol, relTol·máx|aᵢⱼ|)).
 * - A validação só rejeita entradas inválidas; não altera a aritmética dos algoritmos
 *   portados de simulators/control-systems/siso/app.html (expm, charpoly, msolve, mmul).
 */

/* ------------------------- validação interna ------------------------- */

/** @param {unknown} v @param {string} name */
function checkDim(v, name) {
  if (typeof v !== 'number') throw new TypeError(`${name} deve ser um número inteiro`);
  if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} deve ser inteiro não negativo (recebido ${v})`);
}

/** @param {unknown} v @param {string} name */
function checkFinite(v, name) {
  if (typeof v !== 'number') throw new TypeError(`${name} deve ser um número`);
  if (!Number.isFinite(v)) throw new RangeError(`${name} deve ser finito (recebido ${v})`);
}

/**
 * Valida matriz retangular com elementos finitos e devolve suas dimensões.
 * @param {unknown} A @param {string} name @returns {{r:number,c:number}}
 */
function assertMatrix(A, name) {
  if (!Array.isArray(A)) throw new TypeError(`${name} deve ser um array de linhas`);
  const r = A.length;
  if (r === 0) return { r: 0, c: 0 };
  if (!Array.isArray(A[0])) throw new TypeError(`${name}[0] deve ser um array`);
  const c = A[0].length;
  for (let i = 0; i < r; i++) {
    const row = A[i];
    if (!Array.isArray(row)) throw new TypeError(`${name}[${i}] deve ser um array`);
    if (row.length !== c) throw new RangeError(`${name} não é retangular (linha ${i} tem ${row.length} colunas, esperado ${c})`);
    for (let j = 0; j < c; j++) checkFinite(row[j], `${name}[${i}][${j}]`);
  }
  return { r, c };
}

/** @param {unknown} A @param {string} name @returns {number} ordem n */
function assertSquare(A, name) {
  const { r, c } = assertMatrix(A, name);
  if (r !== c) throw new RangeError(`${name} deve ser quadrada (recebido ${r}x${c})`);
  return r;
}

/* ------------------------- kernels sem validação ------------------------- */
// Usados internamente pelos algoritmos portados: a validação só ocorre na entrada,
// pois resultados intermediários podem legitimamente sobrepor (Infinity/NaN) como no original.

const kzeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
const keye = (n) => { const I = kzeros(n, n); for (let i = 0; i < n; i++) I[i][i] = 1; return I; };
function kmmul(A, B) {
  const r = A.length, c = B[0] ? B[0].length : 0, k = B.length, C = kzeros(r, c);
  for (let i = 0; i < r; i++) for (let l = 0; l < k; l++) { const a = A[i][l]; if (a === 0) continue; for (let j = 0; j < c; j++) C[i][j] += a * B[l][j]; }
  return C;
}
const kmadd = (A, B, kb = 1) => A.map((row, i) => row.map((v, j) => v + kb * B[i][j]));
const kmscale = (A, k) => A.map(row => row.map(v => v * k));
/** Erro de matriz singular, com code para o chamador distinguir de outros erros. */
function erroSingular() {
  const e = new Error('Matriz singular');
  e.code = 'SINGULAR_MATRIX';
  return e;
}

/**
 * Limite de pivô abaixo do qual a matriz é tratada como singular. Sem opts: 0 (só o pivô exatamente nulo).
 * Com opts: max(absTol, relTol·máx|aᵢⱼ|), com absTol e relTol finitos e ≥ 0 (padrão 0).
 * @param {number[][]} A já validada @param {{absTol?:number, relTol?:number}} [opts]
 */
function limiteSingular(A, opts) {
  if (opts === undefined) return 0;
  if (opts === null || typeof opts !== 'object') throw new TypeError('opts deve ser um objeto { absTol, relTol }');
  const { absTol = 0, relTol = 0 } = opts;
  for (const [nome, v] of [['absTol', absTol], ['relTol', relTol]]) {
    checkFinite(v, `opts.${nome}`);
    if (v < 0) throw new RangeError(`opts.${nome} deve ser não negativo (recebido ${v})`);
  }
  let escala = 0;
  if (relTol > 0) for (const row of A) for (const v of row) escala = Math.max(escala, Math.abs(v));
  return Math.max(absTol, relTol * escala);
}

function kmsolve(A, B, tol = 0) {
  const n = A.length, m = B[0].length;
  const M = A.map((row, i) => row.concat(B[i]));
  for (let col = 0; col < n; col++) {
    let piv = col, mx = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > mx) { mx = Math.abs(M[r][col]); piv = r; }
    if (mx <= tol) throw erroSingular();   // tol = 0: equivale a mx === 0 (mx ≥ 0)
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let j = col; j < n + m; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row, i) => row.slice(n).map(v => v / M[i][i]));
}

/* ------------------------- construtores ------------------------- */

/**
 * Matriz r x c preenchida com zeros.
 * @param {number} r @param {number} c @returns {number[][]}
 */
export function zeros(r, c) {
  checkDim(r, 'r'); checkDim(c, 'c');
  return kzeros(r, c);
}

/** Matriz r x c preenchida com uns. */
export function ones(r,c) {
  checkDim(r,'r');checkDim(c,'c');
  return Array.from({length:r},()=>new Array(c).fill(1));
}

/**
 * Matriz identidade n x n.
 * @param {number} n @returns {number[][]}
 */
export function eye(n) {
  checkDim(n, 'n');
  return keye(n);
}

/** Diagonal de um vetor (matriz) ou vetor diagonal de uma matriz; k > 0 acima. */
export function diag(value,k=0) {
  if(!Number.isInteger(k))throw new TypeError('k deve ser inteiro.');
  if((Array.isArray(value)||value instanceof Float64Array)&&(!value.length||!(Array.isArray(value[0])||value[0] instanceof Float64Array))) {
    for(let i=0;i<value.length;i++)checkFinite(value[i],`v[${i}]`);
    const n=value.length+Math.abs(k),out=kzeros(n,n),r=k<0?-k:0,c=k>0?k:0;
    for(let i=0;i<value.length;i++)out[r+i][c+i]=value[i];
    return out;
  }
  const A=matrixForExtensions(value),{r,c}=assertMatrix(A,'A'),out=[];
  let i=Math.max(0,-k),j=Math.max(0,k);
  while(i<r&&j<c){out.push(A[i][j]);i++;j++;}
  return out;
}

/** Redimensiona vetor/matriz preservando ordem por linhas (NumPy C order). */
export function reshape(value,r,c) {
  checkDim(r,'r');checkDim(c,'c');
  let flat;
  if(!(Array.isArray(value)||value instanceof Float64Array))throw new TypeError('A deve ser um array.');
  if(!value.length)flat=[];
  else if(Array.isArray(value[0])||value[0] instanceof Float64Array){
    const A=matrixForExtensions(value),{r:rows}=assertMatrix(A,'A');flat=[];
    for(let i=0;i<rows;i++)for(const x of A[i])flat.push(x);
  }else{
    flat=Array.from(value);for(let i=0;i<flat.length;i++)checkFinite(flat[i],`A[${i}]`);
  }
  if(flat.length!==r*c)throw new RangeError(`reshape: ${flat.length} elementos não cabem em ${r}x${c}.`);
  return Array.from({length:r},(_,i)=>flat.slice(i*c,(i+1)*c));
}

/* ------------------------- operações básicas ------------------------- */

/**
 * Produto matricial A (r x k) por B (k x c).
 * @param {number[][]} A @param {number[][]} B @returns {number[][]}
 */
export function mmul(A, B) {
  const ma = assertMatrix(A, 'A'), mb = assertMatrix(B, 'B');
  if (ma.c !== mb.r) throw new RangeError(`mmul: dimensões incompatíveis (${ma.r}x${ma.c} por ${mb.r}x${mb.c})`);
  return kmmul(A, B);
}

/**
 * Soma A + kb*B, elemento a elemento.
 * @param {number[][]} A @param {number[][]} B @param {number} [kb=1] @returns {number[][]}
 */
export function madd(A, B, kb = 1) {
  const ma = assertMatrix(A, 'A'), mb = assertMatrix(B, 'B');
  if (ma.r !== mb.r || ma.c !== mb.c) throw new RangeError(`madd: dimensões incompatíveis (${ma.r}x${ma.c} e ${mb.r}x${mb.c})`);
  checkFinite(kb, 'kb');
  return kmadd(A, B, kb);
}

/**
 * Multiplicação de A por escalar k.
 * @param {number[][]} A @param {number} k @returns {number[][]}
 */
export function mscale(A, k) {
  assertMatrix(A, 'A');
  checkFinite(k, 'k');
  return kmscale(A, k);
}

/**
 * Transposta de A.
 * @param {number[][]} A @returns {number[][]}
 */
export function transpose(A) {
  const { r, c } = assertMatrix(A, 'A');
  if (r === 0 || c === 0) return [];
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => A[i][j]));
}

/**
 * Traço (soma da diagonal) de A quadrada.
 * @param {number[][]} A @returns {number}
 */
export function trace(A) {
  const n = assertSquare(A, 'A');
  let t = 0;
  for (let i = 0; i < n; i++) t += A[i][i];
  return t;
}

/**
 * Determinante por eliminação de Gauss com pivotamento parcial.
 * @param {number[][]} A quadrada @returns {number}
 */
export function det(A) {
  const n = assertSquare(A, 'A');
  const M = A.map(row => row.slice());
  let d = 1;
  for (let col = 0; col < n; col++) {
    let piv = col, mx = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > mx) { mx = Math.abs(M[r][col]); piv = r; }
    if (mx === 0) return 0;
    if (piv !== col) { [M[col], M[piv]] = [M[piv], M[col]]; d = -d; }
    d *= M[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let j = col; j < n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return d;
}

/**
 * Norma-1: maior soma absoluta de coluna.
 * @param {number[][]} A @returns {number}
 */
export function norm1(A) {
  const { r, c } = assertMatrix(A, 'A');
  let best = 0;
  for (let j = 0; j < c; j++) {
    let s = 0;
    for (let i = 0; i < r; i++) s += Math.abs(A[i][j]);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Norma-infinito: maior soma absoluta de linha.
 * @param {number[][]} A @returns {number}
 */
export function normInf(A) {
  const { r, c } = assertMatrix(A, 'A');
  let best = 0;
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < c; j++) s += Math.abs(A[i][j]);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Indica se A é quadrada (sem lançar erro). Matriz vazia é quadrada.
 * @param {unknown} A @returns {boolean}
 */
export function isSquare(A) {
  return Array.isArray(A) && A.every(row => Array.isArray(row) && row.length === A.length);
}

/* ------------------------- sistemas e funções de matriz ------------------------- */

/**
 * Resolve A X = B (eliminação de Gauss com pivotamento parcial).
 * @param {number[][]} A quadrada n x n @param {number[][]} B n x m @returns {number[][]}
 * @param {{absTol?:number, relTol?:number}} [opts] tolerância de singularidade (padrão 0 e 0): A é singular
 *   se o maior módulo de pivô de alguma coluna ≤ max(absTol, relTol·máx|aᵢⱼ|). TypeError/RangeError se inválida.
 * @throws {Error} 'Matriz singular' (code 'SINGULAR_MATRIX') se A é singular
 */
export function msolve(A, B, opts) {   // resolve A X = B (eliminação de Gauss com pivotamento parcial)
  const n = assertSquare(A, 'A');
  const mb = assertMatrix(B, 'B');
  if (mb.r !== n) throw new RangeError(`msolve: B deve ter ${n} linhas (recebido ${mb.r})`);
  const tol = limiteSingular(A, opts);
  if (n === 0) return [];
  return kmsolve(A, B, tol);
}

/**
 * Inversa de A quadrada, via msolve(A, I).
 * @param {number[][]} A @param {{absTol?:number, relTol?:number}} [opts] como em msolve @returns {number[][]}
 * @throws {Error} 'Matriz singular' (code 'SINGULAR_MATRIX') se A é singular
 */
export function inv(A, opts) {
  const n = assertSquare(A, 'A');
  return msolve(A, eye(n), opts);
}

/**
 * Exponencial de matriz por escalonamento e quadratura + Padé(6).
 * @param {number[][]} A quadrada @returns {number[][]}
 */
export function expm(A) {   // escalonamento e quadratura + Padé(6)
  const n = assertSquare(A, 'A');
  if (n === 0) return [];
  const nrm = Math.max(...A.map(r => r.reduce((s, v) => s + Math.abs(v), 0)));
  const s = Math.max(0, Math.ceil(Math.log2(nrm / 0.5)) + 1);
  const X = kmscale(A, Math.pow(2, -s));
  const q = 6;
  let c = 1, Xk = keye(n), N = keye(n), D = keye(n);
  for (let k = 1; k <= q; k++) {
    c = c * (q - k + 1) / (k * (2 * q - k + 1));
    Xk = kmmul(Xk, X);
    N = kmadd(N, Xk, c);
    D = kmadd(D, Xk, (k % 2 ? -1 : 1) * c);
  }
  let E = kmsolve(D, N);
  for (let k = 0; k < s; k++) E = kmmul(E, E);
  return E;
}

/**
 * Coeficientes do polinômio característico det(λI - A), do termo de maior grau ao termo constante
 * (Faddeev–LeVerrier). Para n = 2: [1, -tr(A), det(A)].
 * @param {number[][]} A quadrada @returns {number[]} n+1 coeficientes, o primeiro é 1
 */
export function charpoly(A) {   // Faddeev–LeVerrier
  const n = assertSquare(A, 'A');
  const coef = new Array(n + 1).fill(0); coef[0] = 1;
  let M = kzeros(n, n);
  for (let k = 1; k <= n; k++) {
    M = kmadd(kmmul(A, M), keye(n), coef[k - 1]);
    const AM = kmmul(A, M);
    let tr = 0; for (let i = 0; i < n; i++) tr += AM[i][i];
    coef[k] = -tr / k;
  }
  return coef;
}

/**
 * Logaritmo principal de matriz real: L tal que expm(L) = A.
 * Método: redução de escala inversa (raízes quadradas de Denman–Beavers até ‖X − I‖₁ ≤ 0,05) e
 * log(X) = 2·atanh((X + I)⁻¹(X − I)) por série; resultado = 2^(k+1)·série (k = nº de raízes).
 * Existe resultado real se A não tem autovalor real ≤ 0 (A singular ou com autovalor real negativo
 * tem logaritmo complexo/inexistente). Para detectar isso de forma robusta o resultado é verificado
 * por expm(L) ≈ A (tolerância relativa 1e-8).
 * @param {number[][]} A quadrada @returns {number[][]}
 * @throws {RangeError} se não existe logaritmo real ou o cálculo não converge
 */
export function logm(A) {
  const n = assertSquare(A, 'A');
  if (n === 0) return [];
  const I = keye(n);
  const n1 = (X) => { let best = 0; for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < n; i++) s += Math.abs(X[i][j]); if (s > best) best = s; } return best; };
  const falha = () => new RangeError('logm: A tem autovalor real ≤ 0 (logaritmo real inexistente) ou o cálculo não convergiu');
  const sqrtDB = (X) => {
    let Y = X, Z = I;
    for (let it = 0; it < 100; it++) {
      const Yn = kmscale(kmadd(Y, kmsolve(Z, I)), 0.5);
      const Zn = kmscale(kmadd(Z, kmsolve(Y, I)), 0.5);
      const d = n1(kmadd(Yn, Y, -1));
      Y = Yn; Z = Zn;
      if (!Number.isFinite(d)) throw falha();
      if (d <= 1e-15 * Math.max(1, n1(Y))) return Y;
    }
    throw falha();
  };
  let X = A.map(r => r.slice());
  let k = 0;
  let S;
  try {
    while (n1(kmadd(X, I, -1)) > 0.05) {
      if (++k > 64) throw falha();
      X = sqrtDB(X);
    }
    const Y = kmsolve(kmadd(X, I, 1), kmadd(X, I, -1));
    const Y2 = kmmul(Y, Y);
    S = Y;
    let termo = Y;
    for (let j = 1; j < 200; j++) {
      termo = kmmul(termo, Y2);
      const t = kmscale(termo, 1 / (2 * j + 1));
      S = kmadd(S, t);
      if (n1(t) <= 1e-18 * n1(S)) break;
    }
  } catch (e) {
    if (e instanceof RangeError) throw e;
    throw falha();   // 'Matriz singular' nas raízes/solução: A singular ou autovalor ≤ 0
  }
  const L = kmscale(S, Math.pow(2, k + 1));
  const E = expm(L);
  if (!Number.isFinite(n1(E)) || n1(kmadd(E, A, -1)) > 1e-8 * Math.max(1, n1(A))) throw falha();
  return L;
}

/* ------------------------- decomposição em valores singulares ------------------------- */

function matrixForExtensions(A) {
  if (!Array.isArray(A)) throw new TypeError('A deve ser um array de linhas');
  return A.map(row => { if (!(Array.isArray(row) || row instanceof Float64Array)) throw new TypeError('cada linha deve ser um array'); return Array.from(row); });
}

function transposeUnchecked(A) {
  if(!A.length||!A[0].length)return [];
  return Array.from({length:A[0].length},(_,j)=>A.map(row=>row[j]));
}

/** One-sided Jacobi SVD for a tall matrix; returns reduced U, s and Vh. */
function jacobiTall(A) {
  const m=A.length,n=m?A[0].length:0;
  let scale=0; for(const row of A) for(const x of row) scale=Math.max(scale,Math.abs(x));
  const B=A.map(row=>row.map(x=>scale===0?0:x/scale)),V=keye(n);
  for(let sweep=0;sweep<100;sweep++){
    let changed=false;
    for(let p=0;p<n-1;p++)for(let q=p+1;q<n;q++){
      let alpha=0,beta=0,gamma=0;
      for(let i=0;i<m;i++){const x=B[i][p],y=B[i][q];alpha+=x*x;beta+=y*y;gamma+=x*y;}
      const scale=Math.sqrt(alpha)*Math.sqrt(beta);
      if(gamma===0||Math.abs(gamma)<=4*Number.EPSILON*scale)continue;
      const tau=(beta-alpha)/(2*gamma);
      const t=tau===0?1:Math.sign(tau)/(Math.abs(tau)+Math.hypot(1,tau));
      const c=1/Math.sqrt(1+t*t),s=c*t;
      for(let i=0;i<m;i++){const x=B[i][p],y=B[i][q];B[i][p]=c*x-s*y;B[i][q]=s*x+c*y;}
      for(let i=0;i<n;i++){const x=V[i][p],y=V[i][q];V[i][p]=c*x-s*y;V[i][q]=s*x+c*y;}
      changed=true;
    }
    if(!changed)break;
  }
  const cols=Array.from({length:n},(_,j)=>{let norm=0;for(let i=0;i<m;i++)norm=Math.hypot(norm,B[i][j]);return {j,norm};}).sort((a,b)=>b.norm-a.norm);
  const Ucols=[],svals=[],Vcols=[];
  for(const item of cols){
    svals.push(item.norm*scale);Vcols.push(V.map(row=>row[item.j]));
    if(item.norm>0)Ucols.push(B.map(row=>row[item.j]/item.norm));
    else Ucols.push(null);
  }
  // Complete left singular vectors for zero singular values with deterministic orthonormal vectors.
  for(let k=0;k<Ucols.length;k++)if(Ucols[k]===null){
    let found=null;
    for(let basis=0;basis<m&&!found;basis++){
      const v=new Array(m).fill(0);v[basis]=1;
      for(const prior of Ucols){if(!prior)continue;let dot=0;for(let i=0;i<m;i++)dot+=v[i]*prior[i];for(let i=0;i<m;i++)v[i]-=dot*prior[i];}
      const norm=Math.hypot(...v);if(norm>1e-12)found=v.map(x=>x/norm);
    }
    Ucols[k]=found||new Array(m).fill(0);
  }
  const U=Array.from({length:m},(_,i)=>Ucols.map(col=>col[i]));
  const Vh=Vcols.map(col=>col.slice());
  return {U,s:svals,Vh};
}

/**
 * Reduced real SVD A = U diag(s) Vh using one-sided Jacobi rotations.
 * Singular values are descending; U is m×k and Vh is k×n, k=min(m,n).
 */
export function svd(A) {
  A=matrixForExtensions(A);
  const {r:m,c:n}=assertMatrix(A,'A');
  if(m===0||n===0)return {U:Array.from({length:m},()=>[]),s:[],Vh:[]};
  if(m>=n)return jacobiTall(A);
  const t=jacobiTall(transposeUnchecked(A));
  return {U:transposeUnchecked(t.Vh),s:t.s,Vh:transposeUnchecked(t.U)};
}

/** Descending singular values of a real matrix. */
export function svdvals(A) { return svd(A).s; }

function singularCutoff(s,m,n,tol) {
  if(tol===undefined)return Math.max(m,n)*Number.EPSILON*(s[0]||0);
  checkFinite(tol,'tol');if(tol<0)throw new RangeError('tol deve ser não negativo.');return tol;
}

/** Numerical rank, with NumPy-style default cutoff max(m,n)*eps*smax. */
export function rank(A,tol) {
  A=matrixForExtensions(A);
  const {r:m,c:n}=assertMatrix(A,'A'),s=svd(A).s,cut=singularCutoff(s,m,n,tol);
  return s.filter(x=>x>cut).length;
}

/** Moore-Penrose pseudoinverse; tol is an optional absolute singular-value cutoff. */
export function pinv(A,tol) {
  A=matrixForExtensions(A);
  const {r:m,c:n}=assertMatrix(A,'A'),{U,s,Vh}=svd(A),cut=singularCutoff(s,m,n,tol),out=kzeros(n,m);
  for(let k=0;k<s.length;k++)if(s[k]>cut){
    const invs=1/s[k];
    for(let i=0;i<n;i++)for(let j=0;j<m;j++)out[i][j]+=Vh[k][i]*invs*U[j][k];
  }
  return out;
}

/* ------------------------- fatorações: QR, LU, Cholesky; cond e mldivide ------------------------- */
// Funções acrescentadas depois das portadas do SISO; não alteram a aritmética de nenhuma delas.
// Todas validam a entrada com assertMatrix (TypeError/RangeError) e não modificam os argumentos.

/** Aplica o refletor H = I - beta·v·vᵀ (v ocupa as linhas k.. de M) às colunas j0..j1-1 de M, no lugar. */
function aplicaRefletor(M, v, beta, k, j0, j1) {
  for (let j = j0; j < j1; j++) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * M[k + i][j];
    s *= beta;
    if (s === 0) continue;
    for (let i = 0; i < v.length; i++) M[k + i][j] -= s * v[i];
  }
}

/**
 * Núcleo de QR por Householder (A já validada). Devolve R completa (m x n, com zeros abaixo da diagonal),
 * os refletores e a permutação de colunas (A[:, perm] = Q·R; identidade se !pivot).
 */
function qrNucleo(A, m, n, pivot) {
  const R = A.map(row => row.slice());
  const perm = Array.from({ length: n }, (_, j) => j);
  const refletores = [];
  const kmax = Math.min(m, n);
  for (let k = 0; k < kmax; k++) {
    if (pivot) {
      // Coluna restante de maior norma euclidiana (empate: a primeira). Recalculada a cada passo: O(m·n²) no total.
      let melhor = k, nmax = -1;
      for (let j = k; j < n; j++) {
        let s = 0;
        for (let i = k; i < m; i++) s = Math.hypot(s, R[i][j]);
        if (s > nmax) { nmax = s; melhor = j; }
      }
      if (melhor !== k) {
        for (let i = 0; i < m; i++) { const t = R[i][k]; R[i][k] = R[i][melhor]; R[i][melhor] = t; }
        const t = perm[k]; perm[k] = perm[melhor]; perm[melhor] = t;
      }
    }
    // Refletor de x = R[k:, k]. Se a cauda de x é nula (inclui o último elemento quando m-k = 1), H = I (como o LAPACK).
    let cauda = 0;
    for (let i = k + 1; i < m; i++) cauda = Math.hypot(cauda, R[i][k]);
    if (cauda === 0) { refletores.push(null); continue; }
    const nx = Math.hypot(R[k][k], cauda);
    const alfa = R[k][k] >= 0 ? -nx : nx;          // sinal oposto a x0: evita cancelamento
    const v = new Array(m - k);
    v[0] = R[k][k] - alfa;
    for (let i = 1; i < m - k; i++) v[i] = R[k + i][k];
    let vv = 0;
    for (let i = 0; i < v.length; i++) vv += v[i] * v[i];
    const beta = 2 / vv;
    aplicaRefletor(R, v, beta, k, k + 1, n);
    R[k][k] = alfa;
    for (let i = k + 1; i < m; i++) R[i][k] = 0;
    refletores.push({ v, beta });
  }
  return { R, refletores, perm };
}

/** Matriz de permutação P (n x n) com P[i][perm[i]] = 1, isto é, (P·X)[i] = X[perm[i]] (usada por lu). */
function matrizPermutacao(perm) {
  const n = perm.length, P = kzeros(n, n);
  for (let i = 0; i < n; i++) P[i][perm[i]] = 1;
  return P;
}

/**
 * Fatoração QR por refletores de Householder: A = Q·R (ou A·P = Q·R com pivotamento de colunas).
 *
 * Algoritmo: para cada coluna k < min(m,n) escolhe-se o refletor H = I − β·v·vᵀ que anula R[k+1:, k], com
 * α = −sinal(x₀)·‖x‖₂ (sem cancelamento); se a cauda da coluna já é nula, H = I (como o LAPACK, de modo que
 * o último elemento diagonal de uma matriz larga/quadrada mantém o seu sinal). Q = H₀·H₁·…·H_{k−1} é formada
 * aplicando os refletores à identidade em ordem inversa. Custo O(m·n·min(m,n)); estável por construção
 * (‖A − Q·R‖ e ‖QᵀQ − I‖ da ordem de max(m,n)·ε).
 * Convenções: sem unicidade de sinais: as diagonais de R podem ser negativas (como no MATLAB).
 * Pivotamento (opts.pivot): a cada passo troca-se a coluna restante de maior norma, como [Q,R,P] = qr(A) do
 * MATLAB; garante |R₀₀| ≥ |R₁₁| ≥ … e é a base da estimativa de posto de mldivide.
 *
 * @param {number[][]} A m x n (matriz vazia [] = 0x0)
 * @param {{econ?:boolean, pivot?:boolean}} [opts] econ: forma econômica (Q m x k, R k x n, k = min(m,n));
 *   padrão Q m x m e R m x n. pivot: pivotamento de colunas, devolve também P e perm.
 * @returns {{Q:number[][], R:number[][], P?:number[][], perm?:number[]}} R triangular superior. Com pivot:
 *   perm (base 0) tal que A[:, perm] = Q·R, e P (n x n) com A·P = Q·R, isto é, P[perm[j]][j] = 1.
 * @throws {TypeError|RangeError} A inválida ou opts inválido
 */
export function qr(A, opts) {
  const { r: m, c: n } = assertMatrix(A, 'A');
  if (opts !== undefined && (opts === null || typeof opts !== 'object')) throw new TypeError('opts deve ser um objeto { econ, pivot }');
  const { econ = false, pivot = false } = opts || {};
  if (typeof econ !== 'boolean') throw new TypeError('opts.econ deve ser booleano');
  if (typeof pivot !== 'boolean') throw new TypeError('opts.pivot deve ser booleano');
  const k = Math.min(m, n);
  const { R, refletores, perm } = qrNucleo(A, m, n, pivot);
  const qc = econ ? k : m;                         // colunas de Q
  const Q = kzeros(m, qc);
  for (let i = 0; i < qc; i++) Q[i][i] = 1;
  for (let j = refletores.length - 1; j >= 0; j--) {
    const h = refletores[j];
    if (h) aplicaRefletor(Q, h.v, h.beta, j, 0, qc);
  }
  const out = { Q, R: econ ? R.slice(0, k) : R };
  if (pivot) {
    // P com A·P = Q·R: coluna j de A·P é a coluna perm[j] de A, logo P[perm[j]][j] = 1.
    const P = kzeros(n, n);
    for (let j = 0; j < n; j++) P[perm[j]][j] = 1;
    out.P = P; out.perm = perm;
  }
  return out;
}

/**
 * Fatoração LU com pivotamento parcial (por linhas): P·A = L·U. Aceita A retangular m x n (k = min(m,n)).
 *
 * Algoritmo: eliminação de Gauss (Doolittle) escolhendo, em cada coluna, a linha de maior módulo; multiplicadores
 * armazenados em L (diagonal unitária). Matriz singular NÃO é erro: com a coluna restante toda nula não há
 * eliminação e U fica com pivô exatamente nulo (como no MATLAB); o chamador decide o que fazer.
 *
 * @param {number[][]} A m x n (matriz vazia [] = 0x0)
 * @returns {{L:number[][], U:number[][], P:number[][], perm:number[]}} L m x k triangular inferior com diagonal
 *   unitária, U k x n triangular superior, P m x m de permutação e perm (base 0) o mesmo em vetor:
 *   (P·A)[i] = A[perm[i]], P[i][perm[i]] = 1.
 * @throws {TypeError|RangeError} A inválida
 */
export function lu(A) {
  const { r: m, c: n } = assertMatrix(A, 'A');
  const M = A.map(row => row.slice());
  const perm = Array.from({ length: m }, (_, i) => i);
  const k = Math.min(m, n);
  for (let c = 0; c < k; c++) {
    let piv = c, mx = Math.abs(M[c][c]);
    for (let i = c + 1; i < m; i++) if (Math.abs(M[i][c]) > mx) { mx = Math.abs(M[i][c]); piv = i; }
    if (mx === 0) continue;
    if (piv !== c) { [M[c], M[piv]] = [M[piv], M[c]]; [perm[c], perm[piv]] = [perm[piv], perm[c]]; }
    for (let i = c + 1; i < m; i++) {
      const f = M[i][c] / M[c][c];
      M[i][c] = f;
      if (f === 0) continue;
      for (let j = c + 1; j < n; j++) M[i][j] -= f * M[c][j];
    }
  }
  const L = kzeros(m, k), U = kzeros(k, n);
  for (let i = 0; i < m; i++) for (let j = 0; j < k; j++) L[i][j] = i === j ? 1 : (i > j ? M[i][j] : 0);
  for (let i = 0; i < k; i++) for (let j = i; j < n; j++) U[i][j] = M[i][j];
  return { L, U, P: matrizPermutacao(perm), perm };
}

/** Núcleo de Cholesky: devolve {R, p} (p = 0 se completou; senão p = índice base 1 do primeiro pivô não positivo). */
function cholNucleo(A, n) {
  const R = kzeros(n, n);
  for (let j = 0; j < n; j++) {
    let s = A[j][j];
    for (let k = 0; k < j; k++) s -= R[k][j] * R[k][j];
    if (!(s > 0)) return { R: R.slice(0, j).map(row => row.slice(0, j)), p: j + 1 };
    const d = Math.sqrt(s);
    R[j][j] = d;
    for (let l = j + 1; l < n; l++) {
      let t = A[j][l];
      for (let k = 0; k < j; k++) t -= R[k][j] * R[k][l];
      R[j][l] = t / d;
    }
  }
  return { R, p: 0 };
}

/** Exige A quadrada e simétrica: |aᵢⱼ − aⱼᵢ| ≤ 1e-12·máx|aᵢⱼ| (RangeError caso contrário). */
function assertSimetrica(A, nome) {
  const n = assertSquare(A, nome);
  let escala = 0;
  for (const row of A) for (const v of row) escala = Math.max(escala, Math.abs(v));
  const lim = 1e-12 * escala;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.abs(A[i][j] - A[j][i]) > lim) throw new RangeError(`${nome} deve ser simétrica (${nome}[${i}][${j}] ≠ ${nome}[${j}][${i}])`);
  }
  return n;
}

/**
 * Fatoração de Cholesky A = Rᵀ·R, R triangular superior com diagonal positiva, para A simétrica definida positiva.
 *
 * Algoritmo: por colunas, Rⱼⱼ = √(aⱼⱼ − Σₖ<ⱼ Rₖⱼ²) e Rⱼₗ = (aⱼₗ − Σₖ<ⱼ RₖⱼRₖₗ)/Rⱼⱼ. Só o triângulo superior de A
 * é lido (como no MATLAB), mas A deve ser simétrica: |aᵢⱼ − aⱼᵢ| ≤ 1e-12·máx|aᵢⱼ|, senão RangeError.
 * Definida positiva = todos os radicandos > 0 (sem tolerância); matriz semidefinida/singular também falha.
 *
 * @param {number[][]} A n x n simétrica ([] = 0x0 devolve [])
 * @returns {number[][]} R
 * @throws {Error} 'Matriz não definida positiva' com code = 'NOT_POSITIVE_DEFINITE' e p (base 1, como o MATLAB)
 * @throws {TypeError|RangeError} A inválida, não quadrada ou não simétrica
 */
export function chol(A) {
  const n = assertSimetrica(A, 'A');
  const { R, p } = cholNucleo(A, n);
  if (p !== 0) {
    const e = new Error('Matriz não definida positiva');
    e.code = 'NOT_POSITIVE_DEFINITE';
    e.p = p;
    throw e;
  }
  return R;
}

/**
 * Variante de chol que não lança por perda de definição positiva: [R, p] = chol(A) do MATLAB.
 * @param {number[][]} A n x n simétrica
 * @returns {{R:number[][], p:number}} p = 0 e R n x n se A é definida positiva; senão p é o índice (base 1) do
 *   primeiro pivô não positivo e R é o fator (p−1) x (p−1) da submatriz principal, que satisfaz RᵀR = A[0:p−1, 0:p−1].
 * @throws {TypeError|RangeError} A inválida, não quadrada ou não simétrica
 */
export function cholp(A) {
  const n = assertSimetrica(A, 'A');
  return cholNucleo(A, n);
}

/**
 * Número de condição de A na norma p, κₚ(A) = ‖A‖ₚ·‖A⁻¹‖ₚ.
 * p = 2 (padrão): razão σ_max/σ_min via svdvals (aceita retangular; Infinity se σ_min = 0, isto é, posto
 * deficiente); cond([]) = 0 como no MATLAB. p = 1, Infinity ou 'fro': exige A quadrada e usa ‖A‖ₚ·‖inv(A)‖ₚ;
 * se inv lança SINGULAR_MATRIX (pivô exatamente nulo) devolve Infinity. Não use o valor como teste de
 * singularidade exato: matrizes singulares em ponto flutuante dão valores enormes, não necessariamente Infinity.
 * @param {number[][]} A @param {2|1|number|'fro'} [p=2] 2, 1, Infinity ou 'fro'
 * @returns {number} ≥ 1 (ou 0 para a matriz vazia)
 * @throws {TypeError|RangeError} A inválida, p não suportado ou A não quadrada com p ≠ 2
 */
export function cond(A, p = 2) {
  const { r, c } = assertMatrix(A, 'A');
  if (!(p === 2 || p === 1 || p === Infinity || p === 'fro')) throw new RangeError("p deve ser 2, 1, Infinity ou 'fro'");
  if (r === 0 || c === 0) return 0;
  if (p === 2) {
    const s = svdvals(A);
    const smax = s[0], smin = s[s.length - 1];
    if (smin === 0) return Infinity;
    return smax / smin;
  }
  if (r !== c) throw new RangeError(`cond: p = ${p} exige matriz quadrada (recebido ${r}x${c})`);
  const nrm = p === 1 ? norm1 : p === Infinity ? normInf : (X) => Math.sqrt(X.reduce((a, row) => row.reduce((b, v) => b + v * v, a), 0));
  let Ai;
  try { Ai = inv(A); } catch (e) { if (e.code === 'SINGULAR_MATRIX') return Infinity; throw e; }
  return nrm(A) * nrm(Ai);
}

/**
 * Mínimos quadrados por QR com pivotamento de colunas: minimiza ‖A·X − B‖₂ coluna a coluna, devolvendo a solução
 * básica (no máximo `rank` componentes não nulas por coluna), como o operador \ do MATLAB para A retangular
 * ou de posto deficiente. NÃO é a solução de norma mínima (essa é pinv(A)·B).
 *
 * Algoritmo: A·P = Q·R (qr com pivot); posto estimado r = #{ |Rᵢᵢ| > tol }, tol = max(m,n)·ε·|R₀₀| (opts.tol
 * substitui por um valor absoluto ≥ 0); resolve-se R₁₁·y = (QᵀB)[0:r] por substituição regressiva e
 * X[perm[0:r]] = y, demais componentes 0. Custo O(m·n·min(m,n)).
 *
 * @param {number[][]} A m x n @param {number[][]} B m x q
 * @param {{tol?:number}} [opts]
 * @returns {{X:number[][], rank:number, rankDeficient:boolean, perm:number[]}} X n x q; rankDeficient = rank < min(m,n)
 * @throws {TypeError|RangeError} entradas inválidas ou B com número de linhas ≠ m
 */
export function lstsq(A, B, opts) {
  const { r: m, c: n } = assertMatrix(A, 'A');
  const mb = assertMatrix(B, 'B');
  if (mb.r !== m) throw new RangeError(`lstsq: B deve ter ${m} linhas (recebido ${mb.r})`);
  if (opts !== undefined && (opts === null || typeof opts !== 'object')) throw new TypeError('opts deve ser um objeto { tol }');
  if (opts && opts.tol !== undefined) { checkFinite(opts.tol, 'opts.tol'); if (opts.tol < 0) throw new RangeError('opts.tol deve ser não negativo'); }
  const q = mb.c;
  const k = Math.min(m, n);
  const { Q, R, perm } = qr(A, { econ: true, pivot: true });
  const tol = opts && opts.tol !== undefined ? opts.tol : Math.max(m, n) * Number.EPSILON * (k > 0 ? Math.abs(R[0][0]) : 0);
  let rk = 0;
  while (rk < k && Math.abs(R[rk][rk]) > tol) rk++;
  const X = kzeros(n, q);
  for (let col = 0; col < q; col++) {
    const y = new Array(rk);
    for (let i = 0; i < rk; i++) { let s = 0; for (let l = 0; l < m; l++) s += Q[l][i] * B[l][col]; y[i] = s; }
    for (let i = rk - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < rk; j++) s -= R[i][j] * y[j];
      y[i] = s / R[i][i];
    }
    for (let i = 0; i < rk; i++) X[perm[i]][col] = y[i];
  }
  return { X, rank: rk, rankDeficient: rk < k, perm };
}

/**
 * Operador \ do MATLAB: X = A \ B, com B de várias colunas permitido.
 * Quadrada (m = n): msolve(A, B), isto é, eliminação de Gauss com pivotamento parcial; singularidade lança
 * 'Matriz singular' (code 'SINGULAR_MATRIX') como msolve (o MATLAB só avisa e devolve Inf; aqui o erro é mantido).
 * Retangular (m ≠ n): lstsq, mínimos quadrados por QR com pivotamento de colunas e solução básica em posto deficiente.
 * @param {number[][]} A m x n @param {number[][]} B m x q
 * @param {{details?:boolean, tol?:number}} [opts] details: devolve {X, rank, rankDeficient, method}
 *   em vez de só X; method = 'gauss' (quadrada) ou 'qr-pivot' (retangular); tol só vale no caso retangular.
 * @returns {number[][]|{X:number[][], rank:number|null, rankDeficient:boolean|null, method:string}} X n x q.
 *   No caso quadrado rank e rankDeficient são null (não estimados: A é não singular ou lança erro).
 * @throws {Error} SINGULAR_MATRIX (quadrada) @throws {TypeError|RangeError} entradas inválidas
 */
export function mldivide(A, B, opts) {
  const { r: m, c: n } = assertMatrix(A, 'A');
  const mb = assertMatrix(B, 'B');
  if (mb.r !== m) throw new RangeError(`mldivide: B deve ter ${m} linhas (recebido ${mb.r})`);
  if (opts !== undefined && (opts === null || typeof opts !== 'object')) throw new TypeError('opts deve ser um objeto { details, tol }');
  const details = !!(opts && opts.details);
  if (m === n) {
    const X = msolve(A, B);
    return details ? { X, rank: null, rankDeficient: null, method: 'gauss' } : X;
  }
  const res = lstsq(A, B, opts && opts.tol !== undefined ? { tol: opts.tol } : undefined);
  return details ? { X: res.X, rank: res.rank, rankDeficient: res.rankDeficient, method: 'qr-pivot' } : res.X;
}
