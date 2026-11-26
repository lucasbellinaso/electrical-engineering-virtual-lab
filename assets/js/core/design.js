/**
 * Projeto de sistemas lineares em espaço de estados: módulo puro (ESM, sem DOM, sem dependências).
 *
 * Convenções:
 * - Matrizes por linhas (A[i][j]), como em matrix.js. Vetor coluna = matriz n×1.
 * - Planta contínua: ẋ = Ax + Bu, y = Cx. Discreta: x[k+1] = Ax[k] + Bu[k].
 * - Realimentação de estados u = −Kx; malha fechada A − BK.
 * - Pólos desejados: lista de pares [re, im]. Pólos complexos devem vir em pares conjugados.
 * - Equações de Lyapunov: lyap(A,Q) resolve AX + XAᵀ + Q = 0 (python-control lyap);
 *   dlyap(A,Q) resolve AXAᵀ − X + Q = 0 (python-control dlyap).
 *
 * Funções:
 * - ctrb(A,B): matriz de controlabilidade [B, AB, …, A^(n−1)B].
 * - obsv(A,C): matriz de observabilidade [C; CA; …; CA^(n−1)].
 * - acker(A,B,p): ganho K por Ackermann (SISO). Com φ(s) = ∏(s − pₖ) = sⁿ + a₁sⁿ⁻¹ + … + aₙ,
 *   K = e_nᵀ C⁻¹ φ(A), C = ctrb(A,B). Exige (A,B) controlável. Retorna K como matriz 1×n.
 * - place(A,B,p): SISO delega a acker. Multi-entrada NÃO suportado: lança RangeError.
 *   KNV0 (Kautsky–Nichols–Van Dooren, como scipy.signal.place_poles) não foi implementado.
 * - lyap(A,Q), dlyap(A,Q): soluções X das equações acima, por sistema de Kronecker.
 *
 * Limites de condicionamento:
 * - ctrb/obsv e Ackermann: a potência A^k cresce com ‖A‖^k; para n grande ou estados com escalas
 *   muito diferentes, Ackermann perde precisão rapidamente. Prefira escalas de tempo razoáveis.
 * - Posto (controlabilidade) por eliminação de Gauss com pivotamento parcial e tolerância
 *   10·max(r,c)·ε·max|M|. Pode subestimar o posto se as colunas tiverem escalas muito diferentes.
 * - lyap/dlyap montam um sistema denso de ordem n² e custo O(n⁶). Limite n ≤ MAX_N_KRON (12).
 *   Equação singular quando λᵢ + λⱼ = 0 (lyap) ou λᵢλⱼ = 1 (dlyap), com erro RangeError.
 *
 * Erros: TypeError para tipo incorreto. RangeError para forma ou valor inválido, (A,B) não
 * controlável, pólos incompatíveis com a forma (sem par conjugado),
 * equação singular ou multi-entrada em place.
 */
import { eye, zeros, mmul, transpose, msolve } from './matrix.js';
import { polyFromRoots } from './polynomial.js';

const EPS = 2.220446049250313e-16;
/** Tolerância relativa para tratar um pólo como real e para casar pares conjugados. */
const TOL_POLO = 1e-9;
/** Ordem máxima para lyap/dlyap (sistema de Kronecker de ordem n²). */
export const MAX_N_KRON = 12;

/* ------------------------- validação ------------------------- */

/**
 * Valida matriz retangular com elementos finitos e devolve dimensões.
 * @param {unknown} M @param {string} name @returns {{r:number,c:number}}
 */
function dims(M, name) {
  if (!Array.isArray(M)) throw new TypeError(`${name} deve ser um array de linhas`);
  const r = M.length;
  if (r === 0) return { r: 0, c: 0 };
  if (!Array.isArray(M[0])) throw new TypeError(`${name}[0] deve ser um array`);
  const c = M[0].length;
  for (let i = 0; i < r; i++) {
    const row = M[i];
    if (!Array.isArray(row)) throw new TypeError(`${name}[${i}] deve ser um array`);
    if (row.length !== c) throw new RangeError(`${name} não é retangular (linha ${i} tem ${row.length} colunas, esperado ${c})`);
    for (let j = 0; j < c; j++) {
      const v = row[j];
      if (typeof v !== 'number') throw new TypeError(`${name}[${i}][${j}] deve ser um número`);
      if (!Number.isFinite(v)) throw new RangeError(`${name}[${i}][${j}] deve ser finito (recebido ${v})`);
    }
  }
  return { r, c };
}

/** @returns {number} ordem n de A quadrada e não vazia */
function ordemQuadrada(M, name) {
  const { r, c } = dims(M, name);
  if (r === 0) throw new RangeError(`${name} deve ter ao menos uma linha`);
  if (r !== c) throw new RangeError(`${name} deve ser quadrada (recebido ${r}x${c})`);
  return r;
}

/* ------------------------- montagem de matrizes ------------------------- */

/** Concatena blocos lado a lado (todos com r linhas). */
function hcat(blocos, r) {
  const cols = blocos.reduce((s, b) => s + b[0].length, 0);
  const out = zeros(r, cols);
  let off = 0;
  for (const b of blocos) {
    for (let i = 0; i < r; i++) for (let j = 0; j < b[0].length; j++) out[i][off + j] = b[i][j];
    off += b[0].length;
  }
  return out;
}

/** Empilha blocos um sobre o outro (todos com c colunas). */
function vcat(blocos, c) {
  const rows = blocos.reduce((s, b) => s + b.length, 0);
  const out = zeros(rows, c);
  let off = 0;
  for (const b of blocos) {
    for (let i = 0; i < b.length; i++) for (let j = 0; j < c; j++) out[off + i][j] = b[i][j];
    off += b.length;
  }
  return out;
}

/** Produto de Kronecker A ⊗ B (blocos A[i][j]·B). */
function kron(A, B) {
  const m = A.length, n = A[0].length, p = B.length, q = B[0].length;
  const out = zeros(m * p, n * q);
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++)
    for (let k = 0; k < p; k++) for (let l = 0; l < q; l++)
      out[i * p + k][j * q + l] = A[i][j] * B[k][l];
  return out;
}

/** X + s·Y (mesma forma). */
function soma(X, Y, s = 1) {
  return X.map((row, i) => row.map((v, j) => v + s * Y[i][j]));
}

/* ------------------------- posto ------------------------- */

/**
 * Posto numérico por eliminação de Gauss com pivotamento parcial.
 * Tolerância: 10·max(r,c)·ε·max|M| (ver limites no cabeçalho).
 * @param {number[][]} M @returns {number}
 */
function postoNumerico(M) {
  const { r, c } = dims(M, 'M');
  const W = M.map(row => row.slice());
  let maxAbs = 0;
  for (const row of W) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v));
  const tol = 10 * Math.max(r, c) * EPS * maxAbs;
  let rank = 0;
  for (let j = 0; j < c && rank < r; j++) {
    let p = rank;
    for (let i = rank + 1; i < r; i++) if (Math.abs(W[i][j]) > Math.abs(W[p][j])) p = i;
    if (Math.abs(W[p][j]) <= tol) continue;
    [W[rank], W[p]] = [W[p], W[rank]];
    for (let i = rank + 1; i < r; i++) {
      const f = W[i][j] / W[rank][j];
      for (let k = j; k < c; k++) W[i][k] -= f * W[rank][k];
    }
    rank++;
  }
  return rank;
}

/* ------------------------- controlabilidade e observabilidade ------------------------- */

/**
 * Matriz de controlabilidade [B, AB, …, A^(n−1)B].
 * @param {number[][]} A n×n @param {number[][]} B n×m (m ≥ 1) @returns {number[][]} n×(n·m)
 */
export function ctrb(A, B) {
  const n = ordemQuadrada(A, 'A');
  const { r, c } = dims(B, 'B');
  if (r !== n) throw new RangeError(`B deve ter ${n} linhas (recebido ${r})`);
  if (c === 0) throw new RangeError('B deve ter ao menos uma coluna');
  const blocos = [];
  let M = B;
  for (let k = 0; k < n; k++) {
    blocos.push(M);
    M = mmul(A, M);
  }
  return hcat(blocos, n);
}

/**
 * Matriz de observabilidade [C; CA; …; CA^(n−1)].
 * @param {number[][]} A n×n @param {number[][]} C p×n (p ≥ 1) @returns {number[][]} (n·p)×n
 */
export function obsv(A, C) {
  const n = ordemQuadrada(A, 'A');
  const { r, c } = dims(C, 'C');
  if (c !== n) throw new RangeError(`C deve ter ${n} colunas (recebido ${c})`);
  if (r === 0) throw new RangeError('C deve ter ao menos uma linha');
  const blocos = [];
  let M = C;
  for (let k = 0; k < n; k++) {
    blocos.push(M);
    M = mmul(M, A);
  }
  return vcat(blocos, n);
}

/* ------------------------- alocação de pólos ------------------------- */

/**
 * Valida a lista de pólos desejados: n pares [re, im], finitos. Pólos com |im| ≤ TOL_POLO·max(1,|z|)
 * são tratados como reais (im = 0). Cada pólo complexo precisa de um conjugado na lista.
 * @returns {number[][]} pares normalizados
 */
function normalizaPolos(p, n) {
  if (!Array.isArray(p)) throw new TypeError('p deve ser uma lista de pares [re, im]');
  if (p.length !== n) throw new RangeError(`são necessários ${n} pólos (recebido ${p.length})`);
  const out = p.map((z, i) => {
    if (!Array.isArray(z) || z.length !== 2) throw new TypeError(`p[${i}] deve ser um par [re, im]`);
    for (const v of z) {
      if (typeof v !== 'number') throw new TypeError(`p[${i}] deve conter números`);
      if (!Number.isFinite(v)) throw new RangeError(`p[${i}] deve ser finito`);
    }
    const tol = TOL_POLO * Math.max(1, Math.hypot(z[0], z[1]));
    return Math.abs(z[1]) <= tol ? [z[0], 0] : [z[0], z[1]];
  });
  const usado = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (usado[i] || out[i][1] === 0) continue;
    const [re, im] = out[i];
    const tol = TOL_POLO * Math.max(1, Math.hypot(re, im));
    let j = -1;
    for (let k = 0; k < n && j < 0; k++) {
      if (k !== i && !usado[k] && Math.abs(out[k][0] - re) <= tol && Math.abs(out[k][1] + im) <= tol) j = k;
    }
    if (j < 0) throw new RangeError(`pólo complexo p[${i}] = ${re} + ${im}j não tem conjugado em p`);
    usado[i] = usado[j] = true;
  }
  return out;
}

/**
 * Ganho de realimentação de estados por Ackermann (SISO): u = −Kx, com A − BK com pólos em p.
 * K = e_nᵀ C⁻¹ φ(A), onde C = ctrb(A,B) e φ(s) = ∏(s − pₖ). φ(A) é avaliado por Horner.
 * Condicionamento: ver limites no cabeçalho do módulo.
 * @param {number[][]} A n×n @param {number[][]} B n×1 @param {number[][]} p n pares [re, im]
 * @returns {number[][]} K como matriz 1×n
 * @throws {RangeError} se B não é n×1, (A,B) não é controlável ou p é inválido
 */
export function acker(A, B, p) {
  const n = ordemQuadrada(A, 'A');
  const { r, c } = dims(B, 'B');
  if (r !== n) throw new RangeError(`B deve ter ${n} linhas (recebido ${r})`);
  if (c !== 1) throw new RangeError(`acker é SISO: B deve ser ${n}x1 (recebido ${r}x${c})`);
  const polos = normalizaPolos(p, n);
  const C = ctrb(A, B);
  if (postoNumerico(C) < n) throw new RangeError('(A,B) não é controlável: posto(ctrb) < n');
  const coef = polyFromRoots(polos);   // [1, a1, …, an]; parte real, exata pela simetria de conjugação
  let P = eye(n);
  for (let k = 1; k <= n; k++) {
    const AP = mmul(A, P);
    for (let i = 0; i < n; i++) AP[i][i] += coef[k];
    P = AP;
  }
  const en = zeros(n, 1);
  en[n - 1][0] = 1;
  const y = msolve(transpose(C), en);   // y = C⁻ᵀ e_n
  const K = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) K[j] += y[i][0] * P[i][j];
  return [K];
}

/**
 * Alocação de pólos. SISO: acker(A,B,p). Multi-entrada: não suportado (RangeError).
 * @param {number[][]} A n×n @param {number[][]} B n×m @param {number[][]} p n pares [re, im]
 * @returns {number[][]} K como matriz m×n (m = 1 neste caso)
 */
export function place(A, B, p) {
  const n = ordemQuadrada(A, 'A');
  const { r, c } = dims(B, 'B');
  if (r !== n) throw new RangeError(`B deve ter ${n} linhas (recebido ${r})`);
  if (c === 1) return acker(A, B, p);
  throw new RangeError('place multi-entrada não suportado (KNV0 não implementado); use acker para SISO');
}

/* ------------------------- equações de Lyapunov ------------------------- */

/** Limite de ordem para as equações de Lyapunov resolvidas por Kronecker. */
function limiteKron(n, nome) {
  if (n > MAX_N_KRON) throw new RangeError(`${nome}: n ≤ ${MAX_N_KRON} (recebido ${n})`);
}

/** Resolve M·x = rhs (vetor de comprimento n²) e traduz singularidade para RangeError. */
function resolveKron(M, rhs, nome) {
  try {
    return msolve(M, rhs.map(v => [v])).map(row => row[0]);
  } catch (e) {
    if (/singular/i.test(e.message)) throw new RangeError(`${nome}: equação singular (autovalores incompatíveis)`);
    throw e;
  }
}

/** Vetorização por linhas: vec(X)[i·n + j] = X[i][j]. */
function vecLinhas(X) {
  return [].concat(...X);
}

/** Inverso de vecLinhas para matriz n×n. */
function desvecLinhas(v, n) {
  const X = zeros(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) X[i][j] = v[i * n + j];
  return X;
}

/**
 * Equação de Lyapunov contínua AX + XAᵀ + Q = 0 (python-control lyap).
 * Vetorização por linhas: (A⊗I + I⊗A)·vec(X) = −vec(Q).
 * @param {number[][]} A n×n @param {number[][]} Q n×n @returns {number[][]} X n×n
 * @throws {RangeError} se n > MAX_N_KRON ou λᵢ + λⱼ = 0 para algum par
 */
export function lyap(A, Q) {
  const n = ordemQuadrada(A, 'A');
  const q = dims(Q, 'Q');
  if (q.r !== n || q.c !== n) throw new RangeError(`Q deve ser ${n}x${n} (recebido ${q.r}x${q.c})`);
  limiteKron(n, 'lyap');
  const I = eye(n);
  const M = soma(kron(A, I), kron(I, A));
  const rhs = vecLinhas(Q).map(v => -v);
  return desvecLinhas(resolveKron(M, rhs, 'lyap'), n);
}

/**
 * Equação de Lyapunov discreta AXAᵀ − X + Q = 0 (python-control dlyap).
 * Vetorização por linhas: (A⊗A − I)·vec(X) = −vec(Q).
 * @param {number[][]} A n×n @param {number[][]} Q n×n @returns {number[][]} X n×n
 * @throws {RangeError} se n > MAX_N_KRON ou λᵢλⱼ = 1 para algum par
 */
export function dlyap(A, Q) {
  const n = ordemQuadrada(A, 'A');
  const q = dims(Q, 'Q');
  if (q.r !== n || q.c !== n) throw new RangeError(`Q deve ser ${n}x${n} (recebido ${q.r}x${q.c})`);
  limiteKron(n, 'dlyap');
  const M = soma(kron(A, A), eye(n * n), -1);
  const rhs = vecLinhas(Q).map(v => -v);
  return desvecLinhas(resolveKron(M, rhs, 'dlyap'), n);
}
