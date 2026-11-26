/*
 * Equações algébricas de Riccati e reguladores/estimadores LQ — módulo puro
 * (ESM, sem DOM, sem dependências). Convenção de python-control, com termo cruzado N opcional.
 *
 * Problemas
 *   ARE contínua : AᵀX + XA − (XB + N)R⁻¹(BᵀX + Nᵀ) + Q = 0
 *     care → {X, K, E};  lqr → {K, S = X, E};  K = R⁻¹(BᵀX + Nᵀ);  E = eig(A − BK)
 *   ARE discreta : X = AᵀXA − (AᵀXB + N)(R + BᵀXB)⁻¹(BᵀXA + Nᵀ) + Q
 *     dare → {X, K, E};  dlqr → {K, S = X, E};  K = (R + BᵀXB)⁻¹(BᵀXA + Nᵀ)
 *   Estimadores (dualidade):
 *     lqe(A,G,C,QN,RN)  → {L, P, E}: P = ARE_c(Aᵀ, Cᵀ, GQNGᵀ, RN), L = PCᵀRN⁻¹, E = eig(A − LC)
 *     dlqe(A,G,C,QN,RN) → {L, P, E}: P = ARE_d(Aᵀ, Cᵀ, GQNGᵀ, RN) (a priori),
 *                         L = APCᵀ(CPCᵀ + RN)⁻¹, previsor x̂[k+1] = Ax̂ + Bu + L(y − Cx̂)
 *
 * Métodos
 *   care: função sinal matricial sobre a Hamiltoniana H = [[Ã, −BR⁻¹Bᵀ], [−Q̃, −Ãᵀ]],
 *     com Ã = A − BR⁻¹Nᵀ e Q̃ = Q − NR⁻¹Nᵀ (redução do termo cruzado).
 *     Newton escalonado por determinante (Byers): Z ← ½(μZ + μ⁻¹Z⁻¹), μ = |det Z|^(−1/2n).
 *     Parada: ‖Z_{k+1} − Z_k‖₁ ≤ 1e-13·‖Z_{k+1}‖₁; máximo de 100 iterações (convergência quadrática).
 *     Com Z = sign(H), W = I − Z é o dobro da projeção sobre o subespaço estável de H, gerado
 *     por [I; X]. Logo W = [W11; W21] e X = W21·W11⁻¹, resolvido por eliminação (msolve).
 *   dare: dobramento estrutural (SDA, Chu–Fan–Lin), também quadrático. Com A₀ = Ã,
 *     G₀ = BR⁻¹Bᵀ, H₀ = Q̃ e W = I + GH:  A ← AW⁻¹A;  G ← G + AW⁻¹GAᵀ;  H ← H + AᵀHW⁻¹A.
 *     Parada: ‖H_{k+1} − H_k‖₁ ≤ 1e-13·‖H_{k+1}‖₁; máximo de 200 iterações. Então H → X.
 *   Autovalores de malha fechada: eigvals (QR de Francis, eigen.js), precisos também para n grande.
 *
 * Verificações finais (falha → RangeError)
 *   - Resíduo relativo ‖res‖₁ ≤ 1e-8·max(‖X‖₁, 1) na equação com termo cruzado.
 *   - care: Re(E) < 0; dare: |E| < 1 (estabilidade da malha fechada).
 *   - X é simetrizada: (X + Xᵀ)/2.
 *
 * Condicionamento e falhas
 *   - R deve ser simétrica definida positiva; Q e QN simétricas semidefinidas positivas
 *     (LDLᵀ com pivotação diagonal, tolerância relativa 1e-10).
 *   - A solução estabilizadora existe e é única se (A,B) é estabilizável e (Q,A) é detectável
 *     (lqe/dlqe: as condições duais). Para par não estabilizável o método falha: no care, W11
 *     torna-se singular ou a malha fechada tem modo instável; no dare, o SDA diverge
 *     (‖A_k‖ → ∞) ou não converge (modo sobre o círculo unitário). Lança RangeError.
 *   - Hamiltoniana com autovalores no eixo imaginário (modo marginal não detectável por Q)
 *     impede a convergência da função sinal → RangeError.
 *   - Custo: O(n³) por iteração; care trabalha com matrizes 2n × 2n.
 *   - Entradas: TypeError para tipo incorreto; RangeError para forma, simetria, definição ou
 *     valor não finito. Matrizes de entrada não são alteradas.
 */

import { zeros, eye, mmul, madd, mscale, transpose, inv, msolve, norm1, normInf } from './matrix.js';
import { eigvals } from './eigen.js';

const SIGN_MAXIT = 100;
const SIGN_TOL = 1e-13;
const SDA_MAXIT = 200;
const SDA_TOL = 1e-13;
const RES_TOL = 1e-8;
const DIVERGE = 1e100;

/* ------------------------- validação ------------------------- */

/**
 * Valida matriz retangular com elementos finitos e devolve suas dimensões.
 * @param {unknown} M @param {string} name @returns {{r:number,c:number}}
 */
function dimsOf(M, name) {
  if (!Array.isArray(M)) throw new TypeError(`${name} deve ser um array de linhas`);
  const r = M.length;
  if (r === 0) throw new RangeError(`${name} não pode ser vazia`);
  if (!Array.isArray(M[0])) throw new TypeError(`${name}[0] deve ser um array`);
  const c = M[0].length;
  if (c === 0) throw new RangeError(`${name} não pode ter zero colunas`);
  for (let i = 0; i < r; i++) {
    const row = M[i];
    if (!Array.isArray(row)) throw new TypeError(`${name}[${i}] deve ser um array`);
    if (row.length !== c) throw new RangeError(`${name} não é retangular (linha ${i})`);
    for (let j = 0; j < c; j++) {
      const v = row[j];
      if (typeof v !== 'number') throw new TypeError(`${name}[${i}][${j}] deve ser um número`);
      if (!Number.isFinite(v)) throw new RangeError(`${name}[${i}][${j}] deve ser finito`);
    }
  }
  return { r, c };
}

/** @param {unknown} M @param {string} name @param {number} r @param {number} c */
function checkShape(M, name, r, c) {
  const d = dimsOf(M, name);
  if (d.r !== r || d.c !== c) throw new RangeError(`${name} deve ser ${r}x${c} (recebido ${d.r}x${d.c})`);
}

function maxAbs(M) {
  let s = 0;
  for (const row of M) for (const v of row) s = Math.max(s, Math.abs(v));
  return s;
}

/** Simetria relativa (tolerância 1e-10·max|M|). */
function checkSym(M, name) {
  const n = M.length;
  const tol = 1e-10 * (maxAbs(M) || 1);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(M[i][j] - M[j][i]) > tol) throw new RangeError(`${name} deve ser simétrica`);
    }
  }
}

/**
 * Definição (semi)positiva por LDLᵀ com pivotação diagonal.
 * strict = true exige definida positiva; false admite semidefinida positiva.
 */
function checkDefinite(M, name, strict) {
  const n = M.length;
  const A = M.map((row) => row.slice());
  const tol = 1e-10 * (maxAbs(M) || 1);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (A[i][i] > A[p][p]) p = i;
    [A[k], A[p]] = [A[p], A[k]];
    for (const row of A) [row[k], row[p]] = [row[p], row[k]];
    const d = A[k][k];
    if (strict ? d <= tol : d < -tol) {
      throw new RangeError(strict ? `${name} deve ser definida positiva` : `${name} deve ser semidefinida positiva`);
    }
    if (d <= tol) {
      for (let j = k + 1; j < n; j++) {
        if (Math.abs(A[k][j]) > tol) throw new RangeError(`${name} não é semidefinida positiva`);
      }
      continue;
    }
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) A[i][j] -= (A[i][k] * A[k][j]) / d;
    }
  }
}

/** Valida (A, B, Q, R, N) de care/dare/lqr/dlqr; R e N opcionais (R = I, N = 0). */
function prepareLQ(A, B, Q, R, N) {
  const { r: n, c: ca } = dimsOf(A, 'A');
  if (n !== ca) throw new RangeError(`A deve ser quadrada (recebido ${n}x${ca})`);
  const { r: rb, c: m } = dimsOf(B, 'B');
  if (rb !== n) throw new RangeError(`B deve ter ${n} linhas (recebido ${rb})`);
  checkShape(Q, 'Q', n, n);
  checkSym(Q, 'Q');
  checkDefinite(Q, 'Q', false);
  const Rm = R === undefined ? eye(m) : R;
  checkShape(Rm, 'R', m, m);
  checkSym(Rm, 'R');
  checkDefinite(Rm, 'R', true);
  const Nm = N === undefined ? zeros(n, m) : N;
  checkShape(Nm, 'N', n, m);
  return { A, B, Q, R: Rm, N: Nm };
}

/** Valida (A, G, C, QN, RN) de lqe/dlqe. */
function prepareEst(A, G, C, QN, RN) {
  const { r: n, c: ca } = dimsOf(A, 'A');
  if (n !== ca) throw new RangeError(`A deve ser quadrada (recebido ${n}x${ca})`);
  const { c: w } = dimsOf(G, 'G');
  checkShape(G, 'G', n, w);
  const { r: q } = dimsOf(C, 'C');
  checkShape(C, 'C', q, n);
  checkShape(QN, 'QN', w, w);
  checkSym(QN, 'QN');
  checkDefinite(QN, 'QN', false);
  checkShape(RN, 'RN', q, q);
  checkSym(RN, 'RN');
  checkDefinite(RN, 'RN', true);
  return { n, q };
}

/* ------------------------- álgebra auxiliar ------------------------- */

const symm = (M) => mscale(madd(M, transpose(M)), 0.5);
const eigsOf = (M) => eigvals(M);

function invOr(M, msg) {
  try {
    return inv(M);
  } catch (e) {
    throw new RangeError(msg);
  }
}

function solveOr(A, B, msg) {
  try {
    return msolve(A, B);
  } catch (e) {
    throw new RangeError(msg);
  }
}

/** log|det M| por eliminação com pivotação parcial (−∞ se singular). */
function logAbsDet(M) {
  const n = M.length;
  const A = M.map((row) => row.slice());
  let s = 0;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    if (A[p][k] === 0) return -Infinity;
    [A[k], A[p]] = [A[p], A[k]];
    s += Math.log(Math.abs(A[k][k]));
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k];
      for (let j = k + 1; j < n; j++) A[i][j] -= f * A[k][j];
    }
  }
  return s;
}

/**
 * Função sinal de matriz sem autovalores no eixo imaginário, por Newton escalonado (Byers).
 * @param {number[][]} H @returns {number[][]} sign(H)
 */
function matrixSign(H) {
  const m = H.length;
  let Z = H;
  for (let it = 0; it < SIGN_MAXIT; it++) {
    const mu = Math.exp(-logAbsDet(Z) / m);
    const Zi = invOr(Z, 'Hamiltoniana singular: autovalor nulo ou par não estabilizável');
    const Zn = mscale(madd(mscale(Z, mu), Zi, 1 / mu), 0.5);
    if (!Number.isFinite(norm1(Zn))) throw new RangeError('função sinal divergiu');
    if (norm1(madd(Zn, Z, -1)) <= SIGN_TOL * norm1(Zn)) return Zn;
    Z = Zn;
  }
  throw new RangeError('função sinal não convergiu em 100 iterações (autovalores no eixo imaginário?)');
}

/* ------------------------- núcleos ------------------------- */

/**
 * ARE contínua com termo cruzado, entradas já validadas.
 * @returns {{X:number[][], K:number[][], E:number[][]}}
 */
function careCore(A, B, Q, R, N) {
  const n = A.length;
  const Ri = invOr(R, 'R singular');
  const BRi = mmul(B, Ri);
  const At = madd(A, mmul(BRi, transpose(N)), -1);
  const Qt = madd(Q, mmul(N, mmul(Ri, transpose(N))), -1);
  const G = mmul(BRi, transpose(B));
  const AtT = transpose(At);
  const H = At.map((row, i) => row.concat(G[i].map((v) => -v)))
    .concat(Qt.map((row, i) => row.map((v) => -v).concat(AtT[i].map((v) => -v))));
  const Z = matrixSign(H);
  const W = madd(eye(2 * n), Z, -1);
  const W11 = W.slice(0, n).map((row) => row.slice(0, n));
  const W21 = W.slice(n).map((row) => row.slice(0, n));
  const Xt = solveOr(transpose(W11), transpose(W21),
    'par não estabilizável: bloco W11 singular (subespaço estável não é gráfico)');
  const X = symm(transpose(Xt));
  const K = mmul(Ri, madd(mmul(transpose(B), X), transpose(N)));
  const E = eigsOf(madd(A, mmul(B, K), -1));
  const V = madd(mmul(X, B), N);
  const rhs = madd(madd(mmul(transpose(A), X), mmul(X, A)), mmul(V, mmul(Ri, transpose(V))), -1);
  const Res = madd(rhs, Q);
  if (!(norm1(Res) <= RES_TOL * Math.max(norm1(X), 1))) {
    throw new RangeError('resíduo da ARE contínua acima da tolerância: par não estabilizável');
  }
  if (!E.every(([re]) => re < 0)) {
    throw new RangeError('malha fechada não estável: par não estabilizável ou não detectável');
  }
  return { X, K, E };
}

/**
 * ARE discreta com termo cruzado por dobramento estrutural (SDA), entradas validadas.
 * @returns {{X:number[][], K:number[][], E:number[][]}}
 */
function dareCore(A, B, Q, R, N) {
  const n = A.length;
  const Ri = invOr(R, 'R singular');
  const BRi = mmul(B, Ri);
  let Ak = madd(A, mmul(BRi, transpose(N)), -1);
  let G = symm(mmul(BRi, transpose(B)));
  let H = symm(madd(Q, mmul(N, mmul(Ri, transpose(N))), -1));
  let X = null;
  for (let it = 0; it < SDA_MAXIT && X === null; it++) {
    const Wi = invOr(madd(eye(n), mmul(G, H)), 'I + GH singular');
    const AWi = mmul(Ak, Wi);
    const An = mmul(AWi, Ak);
    const Gn = symm(madd(G, mmul(mmul(AWi, G), transpose(Ak))));
    const Hn = symm(madd(H, mmul(transpose(Ak), mmul(mmul(H, Wi), Ak))));
    if (!(normInf(An) <= DIVERGE) || !(norm1(Hn) <= DIVERGE)) {
      throw new RangeError('SDA divergiu: par não estabilizável');
    }
    if (norm1(madd(Hn, H, -1)) <= SDA_TOL * norm1(Hn)) X = Hn;
    Ak = An;
    G = Gn;
    H = Hn;
  }
  if (X === null) {
    throw new RangeError('SDA não convergiu em 200 iterações: par não estabilizável ou modo sobre o círculo unitário');
  }
  X = symm(X);
  const S = madd(R, mmul(transpose(B), mmul(X, B)));
  const Si = invOr(S, 'R + BᵀXB singular');
  const T = madd(mmul(transpose(A), mmul(X, B)), N);
  const K = mmul(Si, transpose(T));
  const E = eigsOf(madd(A, mmul(B, K), -1));
  const rhs = madd(madd(mmul(transpose(A), mmul(X, A)), mmul(T, mmul(Si, transpose(T))), -1), Q);
  const Res = madd(X, rhs, -1);
  if (!(norm1(Res) <= RES_TOL * Math.max(norm1(X), 1))) {
    throw new RangeError('resíduo da ARE discreta acima da tolerância: par não estabilizável');
  }
  if (!E.every(([re, im]) => Math.hypot(re, im) < 1)) {
    throw new RangeError('malha fechada não estável em tempo discreto: par não estabilizável');
  }
  return { X, K, E };
}

/* ------------------------- API pública ------------------------- */

/**
 * ARE contínua AᵀX + XA − XBR⁻¹BᵀX + Q = 0 (solução estabilizadora).
 * @param {number[][]} A n×n @param {number[][]} B n×m @param {number[][]} Q n×n
 * @param {number[][]} [R=I] m×m
 * @returns {{X:number[][], K:number[][], E:number[][]}} K = R⁻¹BᵀX; E = autovalores [re, im] de A − BK
 * @throws {RangeError} par não estabilizável, entradas com forma/definição inválidas
 */
export function care(A, B, Q, R) {
  const p = prepareLQ(A, B, Q, R, undefined);
  return careCore(p.A, p.B, p.Q, p.R, p.N);
}

/**
 * Regulador LQ contínuo, com termo cruzado N opcional (python-control).
 * @returns {{K:number[][], S:number[][], E:number[][]}} S = X
 */
export function lqr(A, B, Q, R, N) {
  const p = prepareLQ(A, B, Q, R, N);
  const r = careCore(p.A, p.B, p.Q, p.R, p.N);
  return { K: r.K, S: r.X, E: r.E };
}

/**
 * ARE discreta X = AᵀXA − XB(R + BᵀXB)⁻¹BᵀXA + Q (solução estabilizadora).
 * @returns {{X:number[][], K:number[][], E:number[][]}} K = (R + BᵀXB)⁻¹BᵀXA
 * @throws {RangeError} par não estabilizável ou entradas inválidas
 */
export function dare(A, B, Q, R) {
  const p = prepareLQ(A, B, Q, R, undefined);
  return dareCore(p.A, p.B, p.Q, p.R, p.N);
}

/**
 * Regulador LQ discreto, com termo cruzado N opcional (python-control).
 * @returns {{K:number[][], S:number[][], E:number[][]}} S = X
 */
export function dlqr(A, B, Q, R, N) {
  const p = prepareLQ(A, B, Q, R, N);
  const r = dareCore(p.A, p.B, p.Q, p.R, p.N);
  return { K: r.K, S: r.X, E: r.E };
}

/**
 * Estimador de Kalman contínuo (dualidade com lqr). Planta ẋ = Ax + Gw, y = Cx + v.
 * @returns {{L:number[][], P:number[][], E:number[][]}} L = PCᵀRN⁻¹; E = autovalores de A − LC
 */
export function lqe(A, G, C, QN, RN) {
  const { n, q } = prepareEst(A, G, C, QN, RN);
  const Q = symm(mmul(G, mmul(QN, transpose(G))));
  const r = careCore(transpose(A), transpose(C), Q, RN, zeros(n, q));
  const L = transpose(r.K);
  return { L, P: r.X, E: eigsOf(madd(A, mmul(L, C), -1)) };
}

/**
 * Filtro de Kalman discreto a priori (python-control dlqe).
 * P = ARE_d(Aᵀ, Cᵀ, GQNGᵀ, RN); L = APCᵀ(CPCᵀ + RN)⁻¹; previsor x̂[k+1] = Ax̂ + Bu + L(y − Cx̂).
 * @returns {{L:number[][], P:number[][], E:number[][]}} E = autovalores de A − LC
 */
export function dlqe(A, G, C, QN, RN) {
  const { n, q } = prepareEst(A, G, C, QN, RN);
  const Q = symm(mmul(G, mmul(QN, transpose(G))));
  const r = dareCore(transpose(A), transpose(C), Q, RN, zeros(n, q));
  const P = r.X;
  const Si = invOr(madd(mmul(C, mmul(P, transpose(C))), RN), 'CPCᵀ + RN singular');
  const L = mmul(A, mmul(P, mmul(transpose(C), Si)));
  return { L, P, E: eigsOf(madd(A, mmul(L, C), -1)) };
}
