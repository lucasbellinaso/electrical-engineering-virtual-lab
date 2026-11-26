/*
 * Álgebra linear densa com MATRIZES COMPLEXAS (sem DOM, sem dependências) do laboratório EEVL.
 *
 * Convenções:
 * - Matriz complexa = array de linhas de complexos: A[linha][coluna] = {re, im}, base 0. É o mesmo
 *   formato escalar de ./complex.js; a aritmética escalar é importada desse módulo, não reimplementada.
 * - Matriz real (fromReal, fromParts, realPart, imagPart) = array de linhas de números, como em matrix.js.
 * - Matriz vazia [] é a matriz 0x0. cdet([]) = {re:1, im:0}; ctrace([]) = {re:0, im:0}.
 * - ctranspose NÃO conjuga; chermitian é a transposta conjugada A^H.
 * - Erros: TypeError se o tipo de entrada não é array, objeto {re, im} ou número; RangeError se a forma
 *   (não retangular, dimensões incompatíveis, não quadrada onde exigido) ou o valor (não finito, dimensão
 *   não inteira ou negativa) é inválido. csolve e cinv lançam Error('Matriz singular') com a mesma regra
 *   de msolve em matrix.js: singular quando o maior módulo do pivô de alguma coluna é exatamente zero.
 * - Pivotamento parcial pelo módulo (abs de complex.js). Não se altera a entrada.
 * - Complexidade: cmmul, csolve, cinv e cdet são O(n³) (acumulação direta, sem blocagem).
 *   cnorm1, cnormInf e cnormFro são O(r·c).
 * - Limitação herdada de complex.js: um resultado intermediário que estoure para Infinity faz a operação
 *   seguinte lançar TypeError (complex.js exige componentes finitas). Entradas de ordem de 1e150 ou maior
 *   não são suportadas.
 *
 * Fora desta primeira versão: autovalores, expm, decomposições QR/SVD/LU expostas.
 */

import { add, sub, mul, div, conj, scale, abs } from './complex.js';

/* ------------------------- validação interna ------------------------- */

/** @param {unknown} v @param {string} name */
function checkDim(v, name) {
  if (typeof v !== 'number') throw new TypeError(`${name} deve ser um número inteiro`);
  if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} deve ser inteiro não negativo (recebido ${v})`);
}

/** Número real finito. @param {unknown} v @param {string} name @returns {number} */
function checkReal(v, name) {
  if (typeof v !== 'number') throw new TypeError(`${name} deve ser um número`);
  if (!Number.isFinite(v)) throw new RangeError(`${name} deve ser finito (recebido ${v})`);
  return v;
}

/** Complexo {re, im} com componentes finitas. @param {unknown} z @param {string} name */
function checkComplex(z, name) {
  if (z === null || typeof z !== 'object') throw new TypeError(`${name} deve ser um objeto {re, im}`);
  checkReal(z.re, `${name}.re`);
  checkReal(z.im, `${name}.im`);
  return z;
}

/**
 * Valida a grade (array de linhas retangular) e cada elemento com checkEntry.
 * @param {unknown} A @param {string} name @param {(v:unknown, n:string)=>unknown} checkEntry
 * @returns {{r:number,c:number}}
 */
function assertGrid(A, name, checkEntry) {
  if (!Array.isArray(A)) throw new TypeError(`${name} deve ser um array de linhas`);
  const r = A.length;
  if (r === 0) return { r: 0, c: 0 };
  if (!Array.isArray(A[0])) throw new TypeError(`${name}[0] deve ser um array`);
  const c = A[0].length;
  for (let i = 0; i < r; i++) {
    const row = A[i];
    if (!Array.isArray(row)) throw new TypeError(`${name}[${i}] deve ser um array`);
    if (row.length !== c) throw new RangeError(`${name} não é retangular (linha ${i} tem ${row.length} colunas, esperado ${c})`);
    for (let j = 0; j < c; j++) checkEntry(row[j], `${name}[${i}][${j}]`);
  }
  return { r, c };
}

const assertReal = (A, name) => assertGrid(A, name, checkReal);
const assertComplex = (A, name) => assertGrid(A, name, checkComplex);

/** @returns {number} ordem n */
function assertSquare(A, name) {
  const { r, c } = assertComplex(A, name);
  if (r !== c) throw new RangeError(`${name} deve ser quadrada (recebido ${r}x${c})`);
  return r;
}

function assertSameShape(a, b, op) {
  if (a.r !== b.r || a.c !== b.c) {
    throw new RangeError(`${op}: dimensões incompatíveis (${a.r}x${a.c} e ${b.r}x${b.c})`);
  }
}

/* ------------------------- kernels internos ------------------------- */

const zeroC = () => ({ re: 0, im: 0 });
const copiaC = (z) => ({ re: z.re, im: z.im });
const kzeros = (r, c) => Array.from({ length: r }, () => Array.from({ length: c }, zeroC));

/* ------------------------- construtores e conversões ------------------------- */

/**
 * Matriz complexa r x c de zeros.
 * @param {number} r @param {number} c @returns {{re:number,im:number}[][]}
 */
export function czeros(r, c) {
  checkDim(r, 'r'); checkDim(c, 'c');
  return kzeros(r, c);
}

/**
 * Identidade complexa n x n.
 * @param {number} n @returns {{re:number,im:number}[][]}
 */
export function ceye(n) {
  checkDim(n, 'n');
  const I = kzeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = { re: 1, im: 0 };
  return I;
}

/**
 * Matriz complexa com parte imaginária nula a partir de uma matriz real.
 * @param {number[][]} A real @returns {{re:number,im:number}[][]}
 */
export function fromReal(A) {
  assertReal(A, 'A');
  return A.map((row) => row.map((v) => ({ re: v, im: 0 })));
}

/**
 * Monta a matriz complexa Re + j·Im a partir de duas matrizes reais de mesma forma.
 * @param {number[][]} Re @param {number[][]} Im @returns {{re:number,im:number}[][]}
 */
export function fromParts(Re, Im) {
  assertSameShape(assertReal(Re, 'Re'), assertReal(Im, 'Im'), 'fromParts');
  return Re.map((row, i) => row.map((v, j) => ({ re: v, im: Im[i][j] })));
}

/** @returns {number[][]} parte real de A */
export function realPart(A) {
  assertComplex(A, 'A');
  return A.map((row) => row.map((z) => z.re));
}

/** @returns {number[][]} parte imaginária de A */
export function imagPart(A) {
  assertComplex(A, 'A');
  return A.map((row) => row.map((z) => z.im));
}

/* ------------------------- operações básicas ------------------------- */

/**
 * Soma elemento a elemento A + B.
 * @param {{re:number,im:number}[][]} A @param {{re:number,im:number}[][]} B
 */
export function cadd(A, B) {
  assertSameShape(assertComplex(A, 'A'), assertComplex(B, 'B'), 'cadd');
  return A.map((row, i) => row.map((z, j) => add(z, B[i][j])));
}

/**
 * Diferença elemento a elemento A − B.
 * @param {{re:number,im:number}[][]} A @param {{re:number,im:number}[][]} B
 */
export function csub(A, B) {
  assertSameShape(assertComplex(A, 'A'), assertComplex(B, 'B'), 'csub');
  return A.map((row, i) => row.map((z, j) => sub(z, B[i][j])));
}

/**
 * Multiplicação de A por escalar z: número real ou complexo {re, im}.
 * @param {{re:number,im:number}[][]} A @param {number|{re:number,im:number}} z
 */
export function cscale(A, z) {
  assertComplex(A, 'A');
  if (typeof z === 'number') {
    checkReal(z, 'z');
    return A.map((row) => row.map((a) => scale(a, z)));
  }
  checkComplex(z, 'z');
  return A.map((row) => row.map((a) => mul(a, z)));
}

/**
 * Produto matricial A (r x k) por B (k x c), com A e B complexas. O(r·k·c).
 * @param {{re:number,im:number}[][]} A @param {{re:number,im:number}[][]} B
 */
export function cmmul(A, B) {
  const ma = assertComplex(A, 'A'), mb = assertComplex(B, 'B');
  if (ma.c !== mb.r) throw new RangeError(`cmmul: dimensões incompatíveis (${ma.r}x${ma.c} por ${mb.r}x${mb.c})`);
  const C = kzeros(ma.r, mb.c);
  for (let i = 0; i < ma.r; i++) {
    for (let l = 0; l < ma.c; l++) {
      const a = A[i][l];
      for (let j = 0; j < mb.c; j++) C[i][j] = add(C[i][j], mul(a, B[l][j]));
    }
  }
  return C;
}

/** Transposta sem conjugar: (A^T)[i][j] = A[j][i]. */
function transposta(A, f) {
  const { r, c } = assertComplex(A, 'A');
  if (r === 0 || c === 0) return [];
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => f(A[i][j])));
}

/** @returns {{re:number,im:number}[][]} transposta de A, sem conjugar */
export function ctranspose(A) {
  return transposta(A, copiaC);
}

/** @returns {{re:number,im:number}[][]} transposta conjugada A^H */
export function chermitian(A) {
  return transposta(A, conj);
}

/**
 * Traço (soma da diagonal) de A quadrada.
 * @returns {{re:number,im:number}}
 */
export function ctrace(A) {
  const n = assertSquare(A, 'A');
  let t = zeroC();
  for (let i = 0; i < n; i++) t = add(t, A[i][i]);
  return t;
}

/**
 * Determinante por eliminação de Gauss com pivotamento parcial pelo módulo. O(n³).
 * Pivô nulo em alguma coluna devolve {re:0, im:0}, como det em matrix.js.
 * @returns {{re:number,im:number}}
 */
export function cdet(A) {
  const n = assertSquare(A, 'A');
  if (n === 0) return { re: 1, im: 0 };
  const M = A.map((row) => row.slice());
  let d = { re: 1, im: 0 };
  for (let col = 0; col < n; col++) {
    let piv = col, mx = abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const m = abs(M[r][col]);
      if (m > mx) { mx = m; piv = r; }
    }
    if (mx === 0) return zeroC();
    if (piv !== col) { [M[col], M[piv]] = [M[piv], M[col]]; d = scale(d, -1); }
    d = mul(d, M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const f = div(M[r][col], M[col][col]);
      for (let j = col; j < n; j++) M[r][j] = sub(M[r][j], mul(f, M[col][j]));
    }
  }
  return d;
}

/* ------------------------- sistemas ------------------------- */

/**
 * Resolve A X = B por Gauss–Jordan com pivotamento parcial pelo módulo. O(n³) para n×n com B n×m.
 * @param {{re:number,im:number}[][]} A quadrada n x n @param {{re:number,im:number}[][]} B n x m
 * @returns {{re:number,im:number}[][]} X n x m
 * @throws {Error} 'Matriz singular' se A é singular (mesma regra de msolve)
 */
export function csolve(A, B) {
  const n = assertSquare(A, 'A');
  const mb = assertComplex(B, 'B');
  if (mb.r !== n) throw new RangeError(`csolve: B deve ter ${n} linhas (recebido ${mb.r})`);
  if (n === 0) return [];
  const m = mb.c;
  const M = A.map((row, i) => row.concat(B[i]));
  for (let col = 0; col < n; col++) {
    let piv = col, mx = abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const q = abs(M[r][col]);
      if (q > mx) { mx = q; piv = r; }
    }
    if (mx === 0) throw new Error('Matriz singular');
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = div(M[r][col], M[col][col]);
      if (f.re === 0 && f.im === 0) continue;
      for (let j = col; j < n + m; j++) M[r][j] = sub(M[r][j], mul(f, M[col][j]));
    }
  }
  return M.map((row, i) => row.slice(n).map((v) => div(v, M[i][i])));
}

/**
 * Inversa de A quadrada, via csolve(A, I). O(n³).
 * @throws {Error} 'Matriz singular' se A é singular
 */
export function cinv(A) {
  const n = assertSquare(A, 'A');
  return csolve(A, ceye(n));
}

/* ------------------------- normas ------------------------- */

/** Norma-1: maior soma de módulos de coluna. @returns {number} */
export function cnorm1(A) {
  const { r, c } = assertComplex(A, 'A');
  let best = 0;
  for (let j = 0; j < c; j++) {
    let s = 0;
    for (let i = 0; i < r; i++) s += abs(A[i][j]);
    if (s > best) best = s;
  }
  return best;
}

/** Norma-infinito: maior soma de módulos de linha. @returns {number} */
export function cnormInf(A) {
  const { r, c } = assertComplex(A, 'A');
  let best = 0;
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < c; j++) s += abs(A[i][j]);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Norma de Frobenius: raiz de Σ|a_ij|². Acumula com Math.hypot, sem estouro intermediário de |z|².
 * @returns {number}
 */
export function cnormFro(A) {
  const { r, c } = assertComplex(A, 'A');
  let f = 0;
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) f = Math.hypot(f, abs(A[i][j]));
  return f;
}
