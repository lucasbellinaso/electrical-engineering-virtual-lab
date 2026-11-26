import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../assets/js/core/matrix.js';
import { siso } from './helpers/siso-reference.mjs';

const { zeros, eye, mmul, madd, mscale, msolve, expm, charpoly, transpose, trace, det, inv, norm1, normInf, isSquare } = M;

/** Compara elemento a elemento com tolerância absoluta e exige mesma forma. */
function assertClose(actual, expected, tol) {
  assert.equal(actual.length, expected.length, 'número de linhas');
  actual.forEach((row, i) => {
    assert.equal(row.length, expected[i].length, `colunas da linha ${i}`);
    row.forEach((v, j) => assert.ok(Math.abs(v - expected[i][j]) <= tol, `[${i}][${j}]: ${v} vs ${expected[i][j]}`));
  });
}

const A2 = [[1, 2], [3, 4]];
const B2 = [[0.5, -1.25], [2, 0.75]];
const A3 = [[2, -1, 0], [1, 3, 4], [0, -2, 5]];
const Z3 = [[0, 0, 1], [0, 2, 0], [3, 0, 0]];
const A4 = [[1e6, 2e-3, 0, 5], [0, 1, -7, 2], [3e-8, 4, 0, 1], [2, 0, 1, -3]];
const R23 = [[1, 2, 3], [4, 5, 6]];
const R32 = [[7, 8], [9, 10], [11, 12]];

test('regressão exata: construtores e operações básicas iguais ao SISO original', () => {
  for (const [r, c] of [[0, 0], [1, 3], [2, 2], [4, 1]]) assert.deepEqual(zeros(r, c), siso.zeros2(r, c));
  for (const n of [1, 2, 3, 4]) assert.deepEqual(eye(n), siso.eye(n));
  const pairs = [[A2, B2], [A3, Z3], [A4, A4], [R23, R32], [R32, R23]];
  for (const [A, B] of pairs) assert.deepEqual(mmul(A, B), siso.mmul(A, B));
  assert.deepEqual(madd(A2, B2), siso.madd(A2, B2));
  assert.deepEqual(madd(A3, Z3, -0.5), siso.madd(A3, Z3, -0.5));
  assert.deepEqual(madd(A4, A4, 1e-9), siso.madd(A4, A4, 1e-9));
  assert.deepEqual(mscale(A3, 0.1), siso.mscale(A3, 0.1));
  assert.deepEqual(mscale(A4, 1e-12), siso.mscale(A4, 1e-12));
});

test('regressão exata: msolve e expm iguais ao SISO original', () => {
  const rhs3 = [[1, 0], [0, 1], [2, -3]];
  const rhs4 = [[1], [2], [3], [4]];
  assert.deepEqual(msolve(A2, B2), siso.msolve(A2, B2));
  assert.deepEqual(msolve(A3, rhs3), siso.msolve(A3, rhs3));
  assert.deepEqual(msolve(A4, rhs4), siso.msolve(A4, rhs4));
  assert.deepEqual(msolve(Z3, eye(3)), siso.msolve(Z3, eye(3)));
  const mats = [A2, B2, A3, Z3, A4, mscale(A4, 1e-6), mscale(A4, 25), [[0, -0.7], [0.7, 0]], [[0, 0], [0, 0]]];
  for (const A of mats) assert.deepEqual(expm(A), siso.expm(A));
});

test('regressão exata: charpoly igual ao SISO original', () => {
  for (const A of [A2, B2, A3, Z3, A4, mscale(A4, 1e-8), [[5]]]) assert.deepEqual(charpoly(A), siso.charpoly(A));
});

test('expm(0) = I', () => {
  assertClose(expm(zeros(3, 3)), eye(3), 1e-12);
});

test('expm de matriz diagonal é diagonal com exponenciais', () => {
  const a = 1, b = -2;
  assertClose(expm([[a, 0], [0, b]]), [[Math.E, 0], [0, Math.exp(-2)]], 1e-12);
});

test('expm([[0,-t],[t,0]]) é a rotação de ângulo t', () => {
  const t = 0.7;
  assertClose(expm([[0, -t], [t, 0]]), [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]], 1e-12);
});

test('expm(A)·expm(-A) = I', () => {
  const A = [[0.3, -1.2], [2.1, 0.5]];
  assertClose(mmul(expm(A), expm(mscale(A, -1))), eye(2), 1e-12);
});

test('charpoly([[2,0],[0,3]]) = [1,-5,6]', () => {
  assert.deepEqual(charpoly([[2, 0], [0, 3]]), [1, -5, 6]);
});

test('charpoly de matriz companheira reproduz o polinômio', () => {
  // p(x) = x^3 + 2x^2 + 3x + 4
  const C = [[-2, -3, -4], [1, 0, 0], [0, 1, 0]];
  assertClose([charpoly(C)], [[1, 2, 3, 4]], 1e-12);
});

test('Cayley–Hamilton: p(A) = 0', () => {
  for (const A of [A3, Z3, A4]) {
    const coef = charpoly(A);
    const n = A.length;
    let P = zeros(n, n);
    for (let k = 0; k <= n; k++) {
      let Ak = eye(n);
      for (let i = 0; i < n - k; i++) Ak = mmul(Ak, A);
      P = madd(P, Ak, coef[k]);
    }
    const scale = Math.max(1, normInf(A) ** n);
    assert.ok(normInf(P) / scale < 1e-9, `resíduo ${normInf(P)}`);
  }
});

test('msolve: resíduo ‖AX − B‖ pequeno', () => {
  const X = msolve(A4, R32.length === 4 ? R32 : [[1, 2], [3, 4], [5, 6], [7, 8]]);
  const B = [[1, 2], [3, 4], [5, 6], [7, 8]];
  const res = madd(mmul(A4, X), B, -1);
  assert.ok(normInf(res) < 1e-9 * Math.max(1, normInf(B)), `resíduo ${normInf(res)}`);
});

test('msolve lança para matriz singular', () => {
  assert.throws(() => msolve([[1, 2], [2, 4]], eye(2)), { message: 'Matriz singular' });
  assert.throws(() => inv([[1, 2], [2, 4]]), { message: 'Matriz singular' });
});

test('det com casos conhecidos', () => {
  assert.equal(det([]), 1);
  assert.ok(Math.abs(det(A2) - -2) < 1e-12);
  assert.ok(Math.abs(det([[6, 1, 1], [4, -2, 5], [2, 8, 7]]) - -306) < 1e-9);
  assert.equal(det([[0, 1], [1, 0]]), -1);
  assert.equal(det([[1, 2], [2, 4]]), 0);
});

test('inv com caso conhecido e A·inv(A) = I', () => {
  const A = [[4, 7], [2, 6]];
  assertClose(inv(A), [[0.6, -0.7], [-0.2, 0.4]], 1e-12);
  assertClose(mmul(A, inv(A)), eye(2), 1e-12);
  assertClose(mmul(A3, inv(A3)), eye(3), 1e-12);
  assert.deepEqual(inv([]), []);
});

test('transpose, trace e normas', () => {
  assert.deepEqual(transpose(R23), [[1, 4], [2, 5], [3, 6]]);
  assert.equal(trace(A2), 5);
  assert.equal(norm1([[1, -2], [3, 4]]), 6);
  assert.equal(normInf([[1, -2], [3, 4]]), 7);
  assert.equal(norm1([]), 0);
});

test('isSquare', () => {
  assert.equal(isSquare(A2), true);
  assert.equal(isSquare([]), true);
  assert.equal(isSquare([[1, 2]]), false);
  assert.equal(isSquare([[1], [2, 3]]), false);
  assert.equal(isSquare('x'), false);
});

test('entradas inválidas lançam TypeError ou RangeError', () => {
  assert.throws(() => mmul([[1, 2]], [[1, 2]]), RangeError);
  assert.throws(() => madd([[1, 2]], [[1], [2]]), RangeError);
  assert.throws(() => transpose([[1, 2], [3]]), RangeError);
  assert.throws(() => det([[1, 2]]), RangeError);
  assert.throws(() => trace([[1, 2]]), RangeError);
  assert.throws(() => expm([[1, 2]]), RangeError);
  assert.throws(() => charpoly([[1, 2]]), RangeError);
  assert.throws(() => inv([[1, 2]]), RangeError);
  assert.throws(() => msolve(eye(2), [[1], [2], [3]]), RangeError);
  assert.throws(() => madd([[1]], [[NaN]]), RangeError);
  assert.throws(() => mscale([[1]], Infinity), RangeError);
  assert.throws(() => madd([[1]], [[1]], NaN), RangeError);
  assert.throws(() => zeros(-1, 2), RangeError);
  assert.throws(() => zeros(1.5, 2), RangeError);
  assert.throws(() => eye(-1), RangeError);
  assert.throws(() => mmul(null, eye(2)), TypeError);
  assert.throws(() => mmul([1, 2], [[1]]), TypeError);
  assert.throws(() => zeros('2', 2), TypeError);
  assert.throws(() => det([[1, 'a'], [0, 1]]), TypeError);
});
