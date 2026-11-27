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
