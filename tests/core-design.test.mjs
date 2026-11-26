import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../assets/js/core/design.js';
import { charpoly, mmul, transpose, eye, mscale } from '../assets/js/core/matrix.js';
import { roots } from '../assets/js/core/polynomial.js';

const { ctrb, obsv, acker, place, lyap, dlyap, MAX_N_KRON } = D;

/* ------------------------- fixture SciPy/NumPy ------------------------- */

// Gerada por scripts/reference/gen_design.py (numpy 2.5.3, scipy 1.18.1). NaN/Inf codificados como strings.
const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-design.json', import.meta.url), 'utf8'));
const dec = x => Array.isArray(x) ? x.map(dec)
  : x === 'NaN' ? NaN : x === 'Infinity' ? Infinity : x === '-Infinity' ? -Infinity : x;

/* ------------------------- auxiliares ------------------------- */

/** Compara matrizes elemento a elemento: mesma forma e |a − b| ≤ tol·max(1, |b|). */
function assertMatClose(actual, expected, tol, msg = '') {
  assert.equal(actual.length, expected.length, `${msg} linhas`);
  actual.forEach((row, i) => {
    assert.equal(row.length, expected[i].length, `${msg} colunas da linha ${i}`);
    row.forEach((v, j) => {
      const e = expected[i][j];
      assert.ok(Math.abs(v - e) <= tol * Math.max(1, Math.abs(e)), `${msg}[${i}][${j}]: ${v} vs ${e}`);
    });
  });
}

/** Casa cada pólo de `esperado` com o mais próximo de `obtido` (sem repetição); tol absoluta. */
function assertPolesMatch(obtido, esperado, tol) {
  assert.equal(obtido.length, esperado.length, 'número de pólos');
  const usado = new Array(obtido.length).fill(false);
  for (const [re, im] of esperado) {
    let best = -1, bd = Infinity;
    obtido.forEach(([a, b], j) => {
      if (usado[j]) return;
      const d = Math.hypot(a - re, b - im);
      if (d < bd) { bd = d; best = j; }
    });
    assert.ok(bd <= tol * Math.max(1, Math.hypot(re, im)), `pólo ${re}+${im}j sem correspondência (dist ${bd})`);
    usado[best] = true;
  }
}

/** Norma de Frobenius de AX + XAᵀ + Q, para conferir a equação resolvida. */
function resLyap(A, X, Q) {
  const AX = mmul(A, X), XAt = mmul(X, transpose(A));
  const R = AX.map((row, i) => row.map((v, j) => v + XAt[i][j] + Q[i][j]));
  return Math.hypot(...R.flat());
}

/** Resíduo de AXAᵀ − X + Q. */
function resDlyap(A, X, Q) {
  const AX = mmul(mmul(A, X), transpose(A));
  return Math.hypot(...AX.map((row, i) => row.map((v, j) => v - X[i][j] + Q[i][j])).flat());
}

const A2 = [[0, 1], [-2, -3]];
const B2 = [[0], [1]];

/* ------------------------- ctrb / obsv ------------------------- */

test('ctrb analítica 2x2 SISO: [B, AB] = [[0,1],[1,-3]]', () => {
  assert.deepEqual(ctrb(A2, B2), [[0, 1], [1, -3]]);
});

test('obsv analítica 2x2: [C; CA] com C = [1 0] resulta em I', () => {
  assert.deepEqual(obsv(A2, [[1, 0]]), [[1, 0], [0, 1]]);
});

test('ctrb e obsv contra NumPy (matrizes e posto), incluindo caso não controlável', () => {
  for (const c of FIX.ctrb) {
    const M = ctrb(dec(c.A), dec(c.B));
    assertMatClose(M, dec(c.esperado), 1e-12, `ctrb ${c.nome}`);
  }
  for (const c of FIX.obsv) {
    assertMatClose(obsv(dec(c.A), dec(c.C)), dec(c.esperado), 1e-12, `obsv ${c.nome}`);
  }
});

test('posto: caso não controlável do fixture (posto 2 < n = 4) é rejeitado por acker', () => {
  const c = FIX.ctrb.find(x => x.nome === '4x4_nao_controlavel');
  assert.equal(c.posto, 2);
  assert.throws(() => acker(dec(c.A), dec(c.B), [[-1, 0], [-2, 0], [-3, 0], [-4, 0]]), /não é controlável/);
});

test('ctrb e obsv: forma MIMO (n × n·m e n·p × n)', () => {
  const A = [[0, 1, 0], [0, 0, 1], [-6, -11, -6]];
  const B = [[0, 0], [1, 0], [0, 1]];
  const C = [[1, 0, 0], [0, 0, 1]];
  assert.equal(ctrb(A, B).length, 3);
  assert.equal(ctrb(A, B)[0].length, 6);
  assert.equal(obsv(A, C).length, 6);
  assert.equal(obsv(A, C)[0].length, 3);
});

test('ctrb/obsv: entradas inválidas', () => {
  assert.throws(() => ctrb([[1, 2]], [[1]]), RangeError, 'A não quadrada');
  assert.throws(() => ctrb([], [[1]]), RangeError, 'A vazia');
  assert.throws(() => ctrb(A2, [[1]]), RangeError, 'B com linhas erradas');
  assert.throws(() => ctrb(A2, [[]]), RangeError, 'B sem colunas');
  assert.throws(() => ctrb(A2, [[NaN], [1]]), RangeError, 'NaN em B');
  assert.throws(() => ctrb('A', B2), TypeError, 'A não é array');
  assert.throws(() => ctrb(A2, [[1, 2], [3]]), RangeError, 'B não retangular');
  assert.throws(() => obsv(A2, [[1, 0, 0]]), RangeError, 'C com colunas erradas');
  assert.throws(() => obsv(A2, []), RangeError, 'C vazia');
  assert.throws(() => obsv(A2, [['1', 0]]), TypeError, 'C com string');
});

/* ------------------------- acker / place (SISO) ------------------------- */

test('acker analítica 2x2: pólos −3, −4 dão K = [10, 4]', () => {
  // A − BK = [[0,1],[−2−k1, −3−k2]]: s² + (3+k2)s + (2+k1) = s² + 7s + 12
  const K = acker(A2, B2, [[-3, 0], [-4, 0]]);
  assertMatClose(K, [[10, 4]], 1e-12);
});

test('acker analítica 2x2: pólos complexos −1 ± 2j dão K = [3, −1]', () => {
  // s² + 2s + 5 = s² + (3+k2)s + (2+k1)  =>  k2 = −1, k1 = 3
  assertMatClose(acker(A2, B2, [[-1, 2], [-1, -2]]), [[3, -1]], 1e-12);
});

test('acker analítica: pólos já da planta (−1, −2) dão K = 0', () => {
  assertMatClose(acker(A2, B2, [[-1, 0], [-2, 0]]), [[0, 0]], 1e-12);
});

test('acker contra SciPy (place_poles) para 2x2, 3x3 e 4x4, pólos reais e complexos', () => {
  for (const c of FIX.acker) {
    const A = dec(c.A), B = dec(c.B), p = dec(c.p);
    // Ackermann perde ~ε·‖K‖·cond(C) de precisão: tolerância relativa 1e-9 em K é ~10⁴× acima do erro observado.
    assertMatClose(acker(A, B, p), dec(c.K_esperado), 1e-9, `acker ${c.nome}`);
  }
});

test('acker: A − BK tem pólos p (roots(charpoly(A − BK)) vs p)', () => {
  for (const c of FIX.acker) {
    const A = dec(c.A), B = dec(c.B), p = dec(c.p);
    const K = acker(A, B, p)[0];
    const F = A.map((row, i) => row.map((v, j) => v - B[i][0] * K[j]));
    // Raízes de polinômio de grau ≤ 4 por Aberth: erro ~ 1e-7·max(1,|p|) com coeficientes desta escala.
    assertPolesMatch(roots(charpoly(F)), p, 1e-6);
  }
});

test('place SISO delega a acker (mesmo resultado)', () => {
  for (const c of FIX.acker) {
    const A = dec(c.A), B = dec(c.B), p = dec(c.p);
    assert.deepEqual(place(A, B, p), acker(A, B, p));
  }
});

test('place multi-entrada: não suportado, lança RangeError', () => {
  const A = [[0, 1, 0], [0, 0, 1], [-6, -11, -6]];
  const B = [[0, 0], [1, 0], [0, 1]];
  assert.throws(() => place(A, B, [[-1, 0], [-2, 0], [-3, 0]]), /multi-entrada não suportado/);
});

test('acker: (A,B) não controlável lança RangeError', () => {
  const A = [[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, -1, 0], [0, 0, 0, -3]];
  const B = [[1], [1], [0], [0]];
  assert.throws(() => acker(A, B, [[-1, 0], [-2, 0], [-3, 0], [-4, 0]]), /não é controlável/);
});

test('acker: pólos complexos sem conjugado, quantidade errada ou formato inválido', () => {
  assert.throws(() => acker(A2, B2, [[-1, 1], [-2, 0]]), /conjugado/);
  assert.throws(() => acker(A2, B2, [[-1, 1], [-2, 1]]), /conjugado/);
  assert.throws(() => acker(A2, B2, [[-1, 0]]), RangeError, 'pólos a menos');
  assert.throws(() => acker(A2, B2, [[-1, 0], [-2, 0], [-3, 0]]), RangeError, 'pólos a mais');
  assert.throws(() => acker(A2, B2, [[-1], [-2]]), TypeError, 'pólo sem par');
  assert.throws(() => acker(A2, B2, [[-1, Infinity], [-2, 0]]), RangeError, 'pólo infinito');
  assert.throws(() => acker(A2, B2, 'x'), TypeError, 'p não é lista');
});

test('acker: B não é n×1 lança RangeError', () => {
  assert.throws(() => acker(A2, [[1, 0], [0, 1]], [[-1, 0], [-2, 0]]), /SISO/);
  assert.throws(() => acker(A2, [[1]], [[-1, 0], [-2, 0]]), RangeError, 'linhas erradas');
});

/* ------------------------- lyap / dlyap ------------------------- */

test('lyap analítica: A = −diag(1,2), Q = [[1,1],[1,1]] dá X = [[1/2, 1/3], [1/3, 1/4]]', () => {
  const X = lyap([[-1, 0], [0, -2]], [[1, 1], [1, 1]]);
  assertMatClose(X, [[1 / 2, 1 / 3], [1 / 3, 1 / 4]], 1e-12);
});

test('lyap analítica: A = −2I, Q = I dá X = I/4 (X = Q/(2a))', () => {
  assertMatClose(lyap([[-2, 0], [0, -2]], eye(2)), mscale(eye(2), 0.25), 1e-12);
});

test('lyap contra SciPy (solve_continuous_lyapunov) e resíduo pequeno', () => {
  for (const c of FIX.lyap) {
    const A = dec(c.A), Q = dec(c.Q);
    const X = lyap(A, Q);
    assertMatClose(X, dec(c.X_esperado), 1e-10, `lyap ${c.nome}`);
    // Resíduo relativo ao tamanho de Q, com ~ε·n·cond(M) de folga.
    assert.ok(resLyap(A, X, Q) <= 1e-10 * (1 + Math.hypot(...Q.flat())), `resíduo lyap ${c.nome}`);
  }
});

test('lyap: Q não simétrico aceito e resíduo pequeno', () => {
  const A = [[-1, 2], [0, -3]];
  const Q = [[1, 4], [0, 2]];
  const X = lyap(A, Q);
  assert.ok(resLyap(A, X, Q) < 1e-12);
});

test('lyap: λᵢ + λⱼ = 0 (A = diag(1, −1)) lança RangeError', () => {
  assert.throws(() => lyap([[1, 0], [0, -1]], eye(2)), /singular/);
});

test('lyap/dlyap: ordem acima de MAX_N_KRON e Q de forma errada são rejeitadas', () => {
  assert.equal(MAX_N_KRON, 12);
  const n = MAX_N_KRON + 1;
  const A = mscale(eye(n), -1);
  assert.throws(() => lyap(A, eye(n)), RangeError, 'lyap ordem 13');
  assert.throws(() => dlyap(mscale(eye(n), 0.5), eye(n)), RangeError, 'dlyap ordem 13');
  assert.throws(() => lyap(A2, [[1, 0, 0], [0, 1, 0]]), RangeError, 'Q não quadrada');
  assert.throws(() => lyap(A2, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]), RangeError, 'Q de ordem errada');
  assert.throws(() => lyap(A2, [[NaN, 0], [0, 1]]), RangeError, 'Q com NaN');
});

test('dlyap analítica: A = a·I, Q = I dá X = I/(1 − a²)', () => {
  // a²X − X + I = 0  =>  X = I/(1 − a²); a = 0.5 dá 4/3
  assertMatClose(dlyap([[0.5, 0], [0, 0.5]], eye(2)), mscale(eye(2), 4 / 3), 1e-12);
});

test('dlyap contra SciPy (solve_discrete_lyapunov) e resíduo pequeno', () => {
  for (const c of FIX.dlyap) {
    const A = dec(c.A), Q = dec(c.Q);
    const X = dlyap(A, Q);
    assertMatClose(X, dec(c.X_esperado), 1e-10, `dlyap ${c.nome}`);
    assert.ok(resDlyap(A, X, Q) <= 1e-10 * (1 + Math.hypot(...Q.flat())), `resíduo dlyap ${c.nome}`);
  }
});

test('dlyap: λᵢλⱼ = 1 (A = diag(2, 0.5)) lança RangeError', () => {
  assert.throws(() => dlyap([[2, 0], [0, 0.5]], eye(2)), /singular/);
});
