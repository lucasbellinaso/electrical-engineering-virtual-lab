/*
 * Testes de assets/js/core/riccati.js: casos analíticos 1×1, resíduos das equações
 * (verificados por código independente, com matrix.js), simetria e semidefinição de X,
 * estabilidade da malha fechada, invariância por mudança de coordenadas, comparação com
 * SciPy/python-control reescritos (tests/fixtures/core-riccati.json), casos não estabilizáveis
 * e entradas inválidas.
 *
 * Tolerâncias (relativas a max(1, ‖referência‖∞) salvo indicação):
 *   TOL_ANAL = 1e-10  fórmulas fechadas escalares (erro de arredondamento);
 *   TOL_RES  = 1e-9   resíduo independente da ARE (limite do módulo: 1e-8);
 *   TOL_FIX  = 1e-7   comparação com SciPy (Schur) e com as fórmulas de python-control;
 *   TOL_INV  = 1e-8   invariância por mudança de coordenadas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as RC from '../assets/js/core/riccati.js';
import { eye, zeros, mmul, madd, mscale, transpose, inv, det, norm1, charpoly } from '../assets/js/core/matrix.js';
import { roots } from '../assets/js/core/polynomial.js';

const TOL_ANAL = 1e-10;
const TOL_RES = 1e-9;
const TOL_FIX = 1e-7;
const TOL_INV = 1e-8;

const maxAbs = (M) => Math.max(0, ...M.flat().map(Math.abs));
const scaleOf = (M) => Math.max(1, maxAbs(M));
const eigs = (M) => roots(charpoly(M));
const snapshot = (...mats) => JSON.stringify(mats);

function assertMatClose(actual, expected, tol, label) {
  assert.equal(actual.length, expected.length, `${label}: número de linhas`);
  const s = scaleOf(expected);
  actual.forEach((row, i) => {
    assert.equal(row.length, expected[i].length, `${label}: colunas da linha ${i}`);
    row.forEach((v, j) => {
      assert.ok(Math.abs(v - expected[i][j]) <= tol * s, `${label}[${i}][${j}]: ${v} vs ${expected[i][j]}`);
    });
  });
}

/**
 * Compara autovalores como conjunto: cada esperado casa com o real mais próximo ainda livre.
 * (Ordenar por (re, im) falha para pares conjugados, cujas partes reais diferem só em arredondamento.)
 */
function assertEigClose(actual, expected, tol, label) {
  assert.equal(actual.length, expected.length, `${label}: número de autovalores`);
  const s = Math.max(1, ...expected.map((p) => Math.hypot(p[0], p[1])));
  const used = new Set();
  for (const e of expected) {
    let best = -1;
    let bestD = Infinity;
    actual.forEach((a, i) => {
      if (used.has(i)) return;
      const d = Math.hypot(a[0] - e[0], a[1] - e[1]);
      if (d < bestD) { bestD = d; best = i; }
    });
    assert.ok(best >= 0 && bestD <= tol * s, `${label}: autovalor ${e} sem par próximo (distância ${bestD})`);
    used.add(best);
  }
}

/** Resíduo AᵀX + XA − (XB+N)R⁻¹(XB+N)ᵀ + Q, calculado fora do módulo. */
function careResidual(A, B, Q, R, N, X) {
  const Ri = inv(R);
  const V = madd(mmul(X, B), N);
  const sum = madd(mmul(transpose(A), X), mmul(X, A));
  return madd(madd(sum, mmul(V, mmul(Ri, transpose(V))), -1), Q);
}

/** Resíduo X − [AᵀXA − (AᵀXB+N)(R+BᵀXB)⁻¹(AᵀXB+N)ᵀ + Q], calculado fora do módulo. */
function dareResidual(A, B, Q, R, N, X) {
  const T = madd(mmul(transpose(A), mmul(X, B)), N);
  const S = madd(R, mmul(transpose(B), mmul(X, B)));
  const rhs = madd(madd(mmul(transpose(A), mmul(X, A)), mmul(T, mmul(inv(S), transpose(T))), -1), Q);
  return madd(X, rhs, -1);
}

const relRes = (Res, X) => norm1(Res) / Math.max(norm1(X), 1);

/** Semidefinição por menores principais (todos os menores ≥ −tol). */
function isPsdByMinors(M) {
  const n = M.length;
  const s = scaleOf(M);
  for (let mask = 1; mask < (1 << n); mask++) {
    const idx = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) idx.push(i);
    const sub = idx.map((i) => idx.map((j) => M[i][j]));
    if (det(sub) < -1e-9 * Math.pow(s, idx.length)) return false;
  }
  return true;
}

const assertSymmetric = (M, label) => {
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M.length; j++) {
      assert.ok(Math.abs(M[i][j] - M[j][i]) <= 1e-12 * scaleOf(M), `${label} não simétrica em [${i}][${j}]`);
    }
  }
};

/* Fórmulas fechadas escalares (deduzidas no cabeçalho do teste; verificadas abaixo).
 *   CARE 1×1: 2aX − (b²/r)X² + q = 0  ⇒  X = (a + √(a² + b²q/r))·r/b².
 *   DARE 1×1: X = a²X − a²b²X²/(r + b²X) + q  ⇒  b²X² + (r(1−a²) − qb²)X − qr = 0,
 *             raiz positiva X = (qb² − r(1−a²) + √(c² + 4b²qr))/(2b²), c = r(1−a²) − qb².
 */
const careScalar = (a, b, q, r) => ((a + Math.sqrt(a * a + (b * b * q) / r)) * r) / (b * b);
const dareScalar = (a, b, q, r) => {
  const c = r * (1 - a * a) - q * b * b;
  return (-c + Math.sqrt(c * c + 4 * b * b * q * r)) / (2 * b * b);
};

/* ------------------------- casos de referência ------------------------- */

const PEND_A = [[0, 1, 0, 0], [0, 0, -0.981, 0], [0, 0, 0, 1], [0, 0, 21.582, 0]];
const PEND_B = [[0], [1], [0], [-2]];
const MIMO_A = [[-1, 2], [0, -3]];
const MIMO_B = [[1, 0], [0.5, 1]];
const MIMO_Q = [[2, 0], [0, 1]];
const MIMO_R = [[2, 0.5], [0.5, 1]];
const CROSS_A = [[0.5, 1], [0, -2]];
const CROSS_B = [[0, 1], [1, 0.5]];
const CROSS_Q = [[2, 0], [0, 1]];
const CROSS_R = [[1, 0.2], [0.2, 1]];
const CROSS_N = [[0.3, 0], [0.1, 0.2]];

/* ------------------------- analíticos 1×1 ------------------------- */

test('care 1×1: X = (a + √(a² + b²q/r))·r/b², K = bX/r, E = −√(a² + b²q/r)', () => {
  for (const [a, b, q, r] of [[1, 1, 1, 1], [-0.5, 2, 3, 0.7], [2, 0.3, 0.1, 4], [-3, 1.5, 0, 2]]) {
    const X = careScalar(a, b, q, r);
    const res = RC.care([[a]], [[b]], [[q]], [[r]]);
    assert.ok(Math.abs(res.X[0][0] - X) <= TOL_ANAL * Math.max(1, X), `X para (${a},${b},${q},${r})`);
    assert.ok(Math.abs(res.K[0][0] - (b * X) / r) <= TOL_ANAL * Math.max(1, X));
    const E = -Math.sqrt(a * a + (b * b * q) / r);
    assert.ok(Math.abs(res.E[0][0] - E) <= TOL_ANAL * Math.max(1, Math.abs(E)));
    assert.ok(Math.abs(res.E[0][1]) <= TOL_ANAL);
  }
});

test('care 1×1 com q = 0 e a < 0: X = 0 e malha fechada igual a a', () => {
  const res = RC.care([[-3]], [[1.5]], [[0]], [[2]]);
  assert.ok(Math.abs(res.X[0][0]) <= TOL_ANAL);
  assert.ok(Math.abs(res.E[0][0] + 3) <= TOL_ANAL);
});

test('dare 1×1: X é a raiz positiva de b²X² + (r(1−a²) − qb²)X − qr = 0', () => {
  for (const [a, b, q, r] of [[2, 1, 1, 1], [0.5, 2, 3, 0.7], [1.5, 0.5, 1, 2]]) {
    const X = dareScalar(a, b, q, r);
    const c = r * (1 - a * a) - q * b * b;
    assert.ok(Math.abs(b * b * X * X + c * X - q * r) <= 1e-9 * Math.max(1, X * X), `quadrática em (${a},${b},${q},${r})`);
    const res = RC.dare([[a]], [[b]], [[q]], [[r]]);
    assert.ok(Math.abs(res.X[0][0] - X) <= TOL_ANAL * Math.max(1, X), `X para (${a},${b},${q},${r})`);
  }
});

test('dare 1×1 conhecido: a = 2, b = q = r = 1 dá X = 2 + √5 (ponto fixo de x = 4x − 4x²/(1+x) + 1)', () => {
  const res = RC.dare([[2]], [[1]], [[1]], [[1]]);
  assert.ok(Math.abs(res.X[0][0] - (2 + Math.sqrt(5))) <= TOL_ANAL);
});

test('dare 1×1: K = abX/(r + b²X) e |E| = |a·r/(r + b²X)| < 1', () => {
  const [a, b, q, r] = [1.5, 0.5, 1, 2];
  const X = dareScalar(a, b, q, r);
  const res = RC.dare([[a]], [[b]], [[q]], [[r]]);
  assert.ok(Math.abs(res.K[0][0] - (a * b * X) / (r + b * b * X)) <= TOL_ANAL * Math.max(1, X));
  const Ecl = a * r / (r + b * b * X);
  assert.ok(Math.abs(res.E[0][0] - Ecl) <= TOL_ANAL);
  assert.ok(Math.abs(Ecl) < 1);
});

test('lqe 1×1 analítico por dualidade: P = care(a, c, g²qn, rn), L = Pc/rn, E = −√(a² + c²g²qn/rn)', () => {
  const [a, c, g, qn, rn] = [0.5, 1, 1, 2, 0.5];
  const P = careScalar(a, c, g * g * qn, rn);
  const res = RC.lqe([[a]], [[g]], [[c]], [[qn]], [[rn]]);
  assert.ok(Math.abs(res.P[0][0] - P) <= TOL_ANAL * Math.max(1, P));
  assert.ok(Math.abs(res.L[0][0] - (P * c) / rn) <= TOL_ANAL * Math.max(1, P));
  const E = -Math.sqrt(a * a + (c * c * g * g * qn) / rn);
  assert.ok(Math.abs(res.E[0][0] - E) <= TOL_ANAL * Math.max(1, Math.abs(E)));
});

test('dlqe 1×1 analítico: P = dare(a, c, g²qn, rn) a priori; L = a P c/(c²P + rn)', () => {
  const [a, c, g, qn, rn] = [2, 1, 1, 1, 1];
  const P = dareScalar(a, c, g * g * qn, rn);
  const res = RC.dlqe([[a]], [[g]], [[c]], [[qn]], [[rn]]);
  assert.ok(Math.abs(res.P[0][0] - P) <= TOL_ANAL * Math.max(1, P));
  assert.ok(Math.abs(res.L[0][0] - (a * P * c) / (c * c * P + rn)) <= TOL_ANAL * Math.max(1, P));
  assert.ok(Math.abs(res.E[0][0] - (a - res.L[0][0] * c)) <= TOL_ANAL);
  assert.ok(Math.abs(res.E[0][0]) < 1);
});

/* ------------------------- resíduos, simetria, estabilidade ------------------------- */

test('care: resíduo independente ≤ 1e-9 em MIMO, termo cruzado e pêndulo 4×4', () => {
  const cases = [
    [MIMO_A, MIMO_B, MIMO_Q, MIMO_R, zeros(2, 2)],
    [CROSS_A, CROSS_B, CROSS_Q, CROSS_R, CROSS_N],
    [PEND_A, PEND_B, [[1, 0, 0, 0], [0, 0.1, 0, 0], [0, 0, 10, 0], [0, 0, 0, 0.1]], [[1]], zeros(4, 1)],
  ];
  for (const [A, B, Q, R, N] of cases) {
    const { S: X } = RC.lqr(A, B, Q, R, N);
    assert.ok(relRes(careResidual(A, B, Q, R, N, X), X) <= TOL_RES);
  }
});

test('lqr com N: X satisfaz a ARE com termo cruzado e K = R⁻¹(BᵀX + Nᵀ)', () => {
  const { K, S } = RC.lqr(CROSS_A, CROSS_B, CROSS_Q, CROSS_R, CROSS_N);
  assert.ok(relRes(careResidual(CROSS_A, CROSS_B, CROSS_Q, CROSS_R, CROSS_N, S), S) <= TOL_RES);
  const Kref = mmul(inv(CROSS_R), madd(mmul(transpose(CROSS_B), S), transpose(CROSS_N)));
  assertMatClose(K, Kref, TOL_ANAL, 'K');
});

test('dare: resíduo independente ≤ 1e-9 (sem N e com termo cruzado)', () => {
  const A = [[0.9, 0.2], [0.1, 1.1]];
  const B = [[1, 0.5], [0, 1]];
  const Q = [[1, 0], [0, 2]];
  const R = [[2, 0.5], [0.5, 1]];
  const { X } = RC.dare(A, B, Q, R);
  assert.ok(relRes(dareResidual(A, B, Q, R, zeros(2, 2), X), X) <= TOL_RES);
  const Xn = RC.dlqr(A, B, Q, R, zeros(2, 2)).S;
  assert.ok(relRes(dareResidual(A, B, Q, R, zeros(2, 2), Xn), Xn) <= TOL_RES);
  const Xc = RC.dlqr(CROSS_A, CROSS_B, CROSS_Q, CROSS_R, CROSS_N).S;
  assert.ok(relRes(dareResidual(CROSS_A, CROSS_B, CROSS_Q, CROSS_R, CROSS_N, Xc), Xc) <= TOL_RES);
});

test('lqe e dlqe: resíduos das equações de estimação (contínua e a priori) ≤ 1e-9', () => {
  const A = [[0.5, 1], [0, -1]];
  const G = eye(2);
  const C = [[1, 0]];
  const QN = [[0.5, 0], [0, 0.1]];
  const RN = [[0.01]];
  const { P, L } = RC.lqe(A, G, C, QN, RN);
  const GQG = mmul(G, mmul(QN, transpose(G)));
  // A P + P Aᵀ − P Cᵀ RN⁻¹ C P + GQNGᵀ = 0
  const Rc = madd(madd(mmul(A, P), mmul(P, transpose(A))), mmul(mmul(P, transpose(C)), mmul(inv(RN), mmul(C, P))), -1);
  assert.ok(relRes(madd(Rc, GQG), P) <= TOL_RES);
  assert.equal(L.length, 2);
  assert.equal(L[0].length, 1);

  const Ad = [[1.1, 0.3], [0, 0.8]];
  const Gd = [[1], [0.5]];
  const Cd = [[1, 0]];
  const QNd = [[0.2]];
  const RNd = [[0.1]];
  const d = RC.dlqe(Ad, Gd, Cd, QNd, RNd);
  // P = A P Aᵀ − A P Cᵀ(CPCᵀ + RN)⁻¹ C P Aᵀ + GQNGᵀ
  const Pd = d.P;
  const S = madd(mmul(Cd, mmul(Pd, transpose(Cd))), RNd);
  const term = mmul(mmul(mmul(Ad, mmul(Pd, transpose(Cd))), inv(S)), mmul(Cd, mmul(Pd, transpose(Ad))));
  const rhs = madd(madd(mmul(Ad, mmul(Pd, transpose(Ad))), term, -1), mmul(Gd, mmul(QNd, transpose(Gd))));
  assert.ok(norm1(madd(Pd, rhs, -1)) <= TOL_RES * Math.max(norm1(Pd), 1));
  // L = A P Cᵀ (CPCᵀ + RN)⁻¹
  assertMatClose(d.L, mmul(mmul(Ad, mmul(Pd, transpose(Cd))), inv(S)), TOL_ANAL, 'L dlqe');
});

test('X de care/dare é simétrica e semidefinida positiva (menores principais)', () => {
  const sets = [
    RC.care(MIMO_A, MIMO_B, MIMO_Q, MIMO_R).X,
    RC.care(PEND_A, PEND_B, [[1, 0, 0, 0], [0, 0.1, 0, 0], [0, 0, 10, 0], [0, 0, 0, 0.1]], [[1]]).X,
    RC.dare([[0.9, 0.2], [0.1, 1.1]], [[1, 0.5], [0, 1]], [[1, 0], [0, 2]], [[2, 0.5], [0.5, 1]]).X,
  ];
  for (const X of sets) {
    assertSymmetric(X, 'X');
    assert.ok(isPsdByMinors(X), 'X deve ser semidefinida positiva');
  }
});

test('malha fechada: Re(A − BK) < 0 (care) e |λ(A − BK)| < 1 (dare)', () => {
  const c = RC.lqr(CROSS_A, CROSS_B, CROSS_Q, CROSS_R, CROSS_N);
  for (const [re, im] of eigs(madd(CROSS_A, mmul(CROSS_B, c.K), -1))) {
    assert.ok(re < 0, `Re ${re} + ${im}i`);
  }
  const d = RC.dlqr([[1.2, 0.5], [0, 0.8]], [[0, 1], [1, 0.5]], [[2, 0], [0, 1]], [[1, 0.2], [0.2, 1]], [[0.3, 0], [0.1, 0.2]]);
  const Acl = madd([[1.2, 0.5], [0, 0.8]], mmul([[0, 1], [1, 0.5]], d.K), -1);
  for (const [re, im] of eigs(Acl)) assert.ok(Math.hypot(re, im) < 1);
});

test('escala rígida (autovalores −1e4 e +1e-3): resíduo continua ≤ 1e-9', () => {
  const A = [[-1e4, 0], [0, 1e-3]];
  const B = [[1, 0], [0, 1]];
  const Q = [[1, 0], [0, 1]];
  const R = [[1, 0], [0, 1]];
  const { X } = RC.care(A, B, Q, R);
  assert.ok(relRes(careResidual(A, B, Q, R, zeros(2, 2), X), X) <= TOL_RES);
});

test('invariância por mudança de coordenadas: x = Tx′ ⇒ X′ = TᵀXT', () => {
  const T = [[1, 2], [0, 1]];
  const Ti = inv(T);
  const A2 = mmul(Ti, mmul(MIMO_A, T));
  const B2 = mmul(Ti, MIMO_B);
  const Q2 = mmul(transpose(T), mmul(MIMO_Q, T));
  const X = RC.care(MIMO_A, MIMO_B, MIMO_Q, MIMO_R).X;
  const X2 = RC.care(A2, B2, Q2, MIMO_R).X;
  assertMatClose(X2, mmul(transpose(T), mmul(X, T)), TOL_INV, 'X′');
});

test('R omitido equivale a R = I', () => {
  const a = RC.care(MIMO_A, MIMO_B, MIMO_Q);
  const b = RC.care(MIMO_A, MIMO_B, MIMO_Q, eye(2));
  assertMatClose(a.X, b.X, TOL_ANAL, 'X');
  const c = RC.dare(CROSS_A, CROSS_B, CROSS_Q);
  const d = RC.dare(CROSS_A, CROSS_B, CROSS_Q, eye(2));
  assertMatClose(c.X, d.X, TOL_ANAL, 'X dare');
});

test('lqr sem N coincide com care (K e S = X)', () => {
  const c = RC.care(MIMO_A, MIMO_B, MIMO_Q, MIMO_R);
  const l = RC.lqr(MIMO_A, MIMO_B, MIMO_Q, MIMO_R);
  assertMatClose(l.S, c.X, TOL_ANAL, 'S');
  assertMatClose(l.K, c.K, TOL_ANAL, 'K');
  assertEigClose(l.E, c.E, TOL_ANAL, 'E');
});

test('entradas não são alteradas pelas funções', () => {
  const A = [[0.5, 1], [0, -2]];
  const B = [[0, 1], [1, 0.5]];
  const Q = [[2, 0], [0, 1]];
  const R = [[1, 0.2], [0.2, 1]];
  const N = [[0.3, 0], [0.1, 0.2]];
  const before = snapshot(A, B, Q, R, N);
  RC.lqr(A, B, Q, R, N);
  RC.dlqr([[1.2, 0.5], [0, 0.8]], B, Q, R, N);
  RC.lqe(A, eye(2), [[1, 0]], Q, [[0.5]]);
  assert.equal(snapshot(A, B, Q, R, N), before);
});

/* ------------------------- comparação com SciPy (fixture) ------------------------- */

const dec = (v) => {
  if (Array.isArray(v)) return v.map(dec);
  if (v === 'NaN') return NaN;
  if (v === 'Infinity') return Infinity;
  if (v === '-Infinity') return -Infinity;
  return v;
};

const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-riccati.json', import.meta.url), 'utf8'));

test('fixture: cobertura mínima (≥6 lqr, ≥6 dlqr, lqe e dlqe presentes)', () => {
  const count = (fn) => FIX.cases.filter((c) => c.fn === fn).length;
  assert.ok(count('lqr') >= 6);
  assert.ok(count('dlqr') >= 6);
  assert.ok(count('lqe') >= 1);
  assert.ok(count('dlqe') >= 2);
  assert.equal(typeof FIX.meta.numpy, 'string');
  assert.equal(typeof FIX.meta.scipy, 'string');
});

for (const c of FIX.cases) {
  test(`SciPy/python-control: ${c.id}`, () => {
    const I = dec(c.inputs);
    const E = dec(c.expected);
    if (c.fn === 'lqr' || c.fn === 'dlqr') {
      const r = c.fn === 'lqr' ? RC.lqr(I.A, I.B, I.Q, I.R, I.N) : RC.dlqr(I.A, I.B, I.Q, I.R, I.N);
      assertMatClose(r.S, E.X, TOL_FIX, 'X');
      assertMatClose(r.K, E.K, TOL_FIX, 'K');
      assertEigClose(r.E, E.E, TOL_FIX, 'E');
    } else {
      const r = c.fn === 'lqe' ? RC.lqe(I.A, I.G, I.C, I.QN, I.RN) : RC.dlqe(I.A, I.G, I.C, I.QN, I.RN);
      assertMatClose(r.P, E.P, TOL_FIX, 'P');
      assertMatClose(r.L, E.L, TOL_FIX, 'L');
      assertEigClose(r.E, E.E, TOL_FIX, 'E');
    }
  });
}

/* ------------------------- não estabilizável ------------------------- */

test('care: modo instável não controlável → RangeError', () => {
  assert.throws(() => RC.care([[1, 0], [0, -1]], [[0], [1]], eye(2)), RangeError);
});

test('care: Q = 0 com A oscilatória (não detectável) → RangeError', () => {
  assert.throws(() => RC.care([[0, 1], [-1, 0]], [[0], [1]], zeros(2, 2)), RangeError);
});

test('dare: A = 2, B = 0 (divergência do SDA) → RangeError', () => {
  assert.throws(() => RC.dare([[2]], [[0]], [[1]], [[1]]), RangeError);
});

test('dare: modo marginal não controlável (|λ| = 1) → RangeError', () => {
  assert.throws(() => RC.dare([[1, 0], [0, 0.5]], [[0], [1]], eye(2), eye(1)), RangeError);
});

test('lqe: modo instável não observável → RangeError', () => {
  assert.throws(() => RC.lqe([[1, 0], [0, -1]], eye(2), [[0, 1]], eye(2), [[1]]), RangeError);
});

test('dlqe: par (A,C) não detectável (A = 2, C = 0) → RangeError', () => {
  assert.throws(() => RC.dlqe([[2]], [[1]], [[0]], [[1]], [[1]]), RangeError);
});

/* ------------------------- entradas inválidas ------------------------- */

test('entradas inválidas: tipos → TypeError', () => {
  assert.throws(() => RC.care(null, [[1]], [[1]]), TypeError);
  assert.throws(() => RC.care([[1]], [['x']], [[1]]), TypeError);
  assert.throws(() => RC.care([[1]], [[1]], [[1]], 'R'), TypeError);
  assert.throws(() => RC.dlqr([[1]], [[1]], [[1]], [[1]], 'N'), TypeError);
  assert.throws(() => RC.lqe([[1]], [[1]], [[1]], [[1]], [[true]]), TypeError);
});

test('entradas inválidas: forma, simetria, definição e valor → RangeError', () => {
  assert.throws(() => RC.care([[1, 0]], [[1]], [[1]]), RangeError); // A não quadrada
  assert.throws(() => RC.care([], [[1]], [[1]]), RangeError); // vazia
  assert.throws(() => RC.care([[1]], [[1], [1]], [[1]]), RangeError); // B com linhas erradas
  assert.throws(() => RC.care([[1]], [[1]], [[1, 0], [0, 1]]), RangeError); // Q com dimensão errada
  assert.throws(() => RC.care([[1, 0], [0, 1]], [[1], [0]], [[1, 2], [0, 1]]), RangeError); // Q assimétrica
  assert.throws(() => RC.care([[1]], [[1]], [[-1]]), RangeError); // Q negativa
  assert.throws(() => RC.care([[1]], [[1]], [[1]], [[0]]), RangeError); // R nula
  assert.throws(() => RC.care([[1]], [[1]], [[1]], [[-2]]), RangeError); // R negativa
  assert.throws(() => RC.care([[1]], [[1]], [[1]], [[1, 0]]), RangeError); // R não quadrada
  assert.throws(() => RC.care([[NaN]], [[1]], [[1]]), RangeError);
  assert.throws(() => RC.care([[Infinity]], [[1]], [[1]]), RangeError);
  assert.throws(() => RC.dare([[1]], [[1]], [[1]], [[1, 0]]), RangeError);
  assert.throws(() => RC.lqr([[1]], [[1]], [[1]], [[1]], [[1, 2]]), RangeError); // N com forma errada
  assert.throws(() => RC.dlqr([[1]], [[1]], [[1]], [[1]], [[1], [2]]), RangeError);
  assert.throws(() => RC.lqe([[1]], [[1]], [[1]], [[-1]], [[1]]), RangeError); // QN negativa
  assert.throws(() => RC.dlqe([[1]], [[1]], [[1]], [[1]], [[0]]), RangeError); // RN nula
  assert.throws(() => RC.dlqe([[1, 0], [0, 1]], [[1]], [[1, 0, 0]], [[1]], [[1]]), RangeError); // C com forma errada
});
