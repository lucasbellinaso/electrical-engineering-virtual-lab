import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linspace, logspace, trapz, cumtrapz, cumsum, sum, mean, std, norm, diff, interp1
} from '../assets/js/core/numeric.js';
import {siso} from './helpers/siso-reference.mjs';

const near = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (tol ${tol})`);
const nearVec = (v, w, tol = 1e-12) => {
  assert.equal(v.length, w.length);
  v.forEach((x, i) => near(x, w[i], tol));
};

test('linspace: extremos exatos, n = 1 devolve [b] e entradas inválidas', () => {
  assert.deepEqual(linspace(0, 1, 5), [0, 0.25, 0.5, 0.75, 1]);
  const v = linspace(-3, 7, 11);
  assert.equal(v.length, 11);
  assert.equal(v[0], -3);
  assert.equal(v[10], 7);
  assert.deepEqual(linspace(1, 5, 2), [1, 5]);
  assert.deepEqual(linspace(4, 9, 1), [9]);
  assert.throws(() => linspace(0, 1, 0), RangeError);
  assert.throws(() => linspace(0, 1, 2.5), TypeError);
  assert.throws(() => linspace(NaN, 1, 3), TypeError);
  assert.throws(() => linspace(0, '3', 3), TypeError);
});

test('logspace: regressão exata contra o SISO original', () => {
  const casos = [[0, 3, 4], [-2, 2, 401], [-1.3, 4.7, 3000], [0.5, -0.5, 7], [1, 1, 2]];
  for (const [a, b, n] of casos) {
    assert.deepEqual(logspace(a, b, n), Array.from(siso.logspace(a, b, n)));
  }
});

test('logspace: valores analíticos, n = 1 e entradas inválidas', () => {
  nearVec(logspace(0, 3, 4), [1, 10, 100, 1000], 1e-9);
  assert.deepEqual(logspace(2, 5, 1), [1e5]);
  assert.throws(() => logspace(0, 1, 0), RangeError);
  assert.throws(() => logspace(0, 1, 1.5), TypeError);
  assert.throws(() => logspace(Infinity, 1, 3), TypeError);
});

test('trapz: x² em [0,1] e exatidão para funções lineares', () => {
  const x = linspace(0, 1, 1001);
  // Erro do trapézio = (b−a)h²f''/12 = 1.67e-7 para h = 1e-3
  near(trapz(x, x.map((t) => t * t)), 1 / 3, 1e-6);
  // Linear em malha não uniforme: exato
  near(trapz([0, 0.5, 2, 3], [1, 2, 5, 7]), 12, 1e-12);
  assert.equal(trapz([1, 2, 3, 4]), 7.5);
  assert.equal(trapz([5]), 0);
  assert.equal(trapz([]), 0);
  assert.equal(trapz([1, 0], [2, 2]), -2);
  assert.throws(() => trapz([1, 2], [1, 2, 3]), RangeError);
  assert.throws(() => trapz([1, NaN], [1, 2]), TypeError);
});

test('cumtrapz: primeiro zero, último igual a trapz e valores analíticos', () => {
  const x = [0, 0.5, 2, 3];
  assert.equal(cumtrapz(x, x.map((t) => t * t + t))[0], 0);
  // y = 2x + 1 é linear: a integral acumulada é exata nos nós (F = x² + x)
  const yl = x.map((t) => 2 * t + 1);
  nearVec(cumtrapz(x, yl), [0, 0.75, 6, 12], 1e-12);
  near(cumtrapz(x, yl).at(-1), trapz(x, yl), 1e-12);
  assert.deepEqual(cumtrapz([1, 2, 3, 4]), [0, 1.5, 4, 7.5]);
  assert.deepEqual(cumtrapz([]), []);
});

test('cumsum, sum e mean', () => {
  assert.deepEqual(cumsum([1, 2, 3]), [1, 3, 6]);
  assert.deepEqual(cumsum([]), []);
  assert.equal(sum([0.5, 0.25]), 0.75);
  assert.equal(sum([]), 0);
  assert.equal(mean([1, 2, 3, 4]), 2.5);
  assert.throws(() => mean([]), RangeError);
});

test('std: normalização N − 1 (não N)', () => {
  near(std([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7), 1e-12);
  assert.ok(Math.abs(std([2, 4, 4, 4, 5, 5, 7, 9]) - 2) > 0.1); // a normalização N daria 2
  assert.equal(std([1]), 0);
  assert.throws(() => std([]), RangeError);
});

test('norm: p = 1, 2 e Infinity; p inválido', () => {
  const v = [3, -4];
  assert.equal(norm(v, 1), 7);
  assert.equal(norm(v), 5);
  assert.equal(norm(v, 2), 5);
  assert.equal(norm(v, Infinity), 4);
  assert.equal(norm([]), 0);
  assert.throws(() => norm(v, 3), RangeError);
});

test('diff: comprimento N − 1', () => {
  assert.deepEqual(diff([1, 4, 9, 16]), [3, 5, 7]);
  assert.deepEqual(diff([1]), []);
  assert.deepEqual(diff([]), []);
});

test('interp1: nós, ponto médio, fora do intervalo e validação', () => {
  const x = [0, 1, 3], y = [0, 10, 30];
  assert.deepEqual(interp1(x, y, [0, 1, 3]), [0, 10, 30]);
  assert.equal(interp1(x, y, 2), 20);
  assert.equal(interp1(x, y, 0.5), 5);
  assert.equal(interp1(x, y, 1.5), 15);
  assert.ok(Number.isNaN(interp1(x, y, -0.1)));
  assert.ok(Number.isNaN(interp1(x, y, 3.1)));
  assert.ok(Number.isNaN(interp1(x, y, NaN)));
  const mix = interp1(x, y, [-1, 0.5, 4]);
  assert.ok(Number.isNaN(mix[0]));
  assert.equal(mix[1], 5);
  assert.ok(Number.isNaN(mix[2]));
  assert.throws(() => interp1([0, 2, 1], [0, 1, 2], 0.5), RangeError);
  assert.throws(() => interp1([0, 1, 1], [0, 1, 2], 0.5), RangeError);
  assert.throws(() => interp1(x, y, '1'), TypeError);
  assert.throws(() => interp1([0, 1], [0, 1, 2], 0.5), RangeError);
});
