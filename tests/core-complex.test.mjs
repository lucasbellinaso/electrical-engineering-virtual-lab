import test from 'node:test';
import assert from 'node:assert/strict';
import {
  make, add, sub, mul, div, conj, scale, abs, arg, fromPolar, fromPolarDeg,
  toPolar, toPolarDeg, exp, sqrt, pow, fromPair, toPair, equalsWithin
} from '../assets/js/core/complex.js';

const z = (re, im) => ({re, im});
const close = (a, b, tol = 1e-12) =>
  assert.ok(equalsWithin(a, b, tol), `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

test('make: padrões e entradas inválidas', () => {
  assert.deepEqual(make(), z(0, 0));
  assert.deepEqual(make(1, -2), z(1, -2));
  assert.throws(() => make(NaN), TypeError);
  assert.throws(() => make('1'), TypeError);
});

test('soma, subtração e produto analíticos', () => {
  assert.deepEqual(add(z(1, 2), z(3, -1)), z(4, 1));
  assert.deepEqual(sub(z(1, 2), z(3, -1)), z(-2, 3));
  assert.deepEqual(mul(z(1, 2), z(3, -1)), z(5, 5));
  assert.deepEqual(mul(z(0, 1), z(0, 1)), z(-1, 0));
  assert.throws(() => add(z(1, 2), {re: 1}), TypeError);
});

test('divisão: valor analítico, ramos do Smith, ida e volta e divisão por zero', () => {
  close(div(z(1, 2), z(3, -1)), z(0.1, 0.7)); // (1+2j)(3+1j)/10
  close(div(z(1, 0), z(0, 2)), z(0, -0.5));   // |b.im| > |b.re|
  const a = z(2, -5), b = z(0.3, -1.7);
  close(mul(div(a, b), b), a);
  assert.throws(() => div(z(1, 1), z(0, 0)), RangeError);
});

test('conj, escala, módulo e argumento', () => {
  assert.deepEqual(conj(z(3, 4)), z(3, -4));
  const w = z(1, 2);
  assert.deepEqual(mul(w, conj(w)), z(5, 0));     // z·conj(z) = |z|²
  assert.equal(abs(z(3, 4)), 5);
  assert.deepEqual(scale(z(1, -2), 3), z(3, -6));
  assert.equal(arg(z(-1, 0)), Math.PI);
  assert.equal(arg(z(0, 1)), Math.PI / 2);
});

test('exp: e^{jπ} = −1 e e^1 real', () => {
  close(exp(z(0, Math.PI)), z(-1, 0), 1e-15);
  close(exp(z(1, 0)), z(Math.E, 0));
});

test('sqrt: ramo principal, valores analíticos e quadrado de volta', () => {
  close(sqrt(z(-1, 0)), z(0, 1));
  close(sqrt(z(-4, 0)), z(0, 2));
  close(sqrt(z(3, 4)), z(2, 1));
  close(sqrt(z(-3, -4)), z(1, -2)); // ramo principal: parte real ≥ 0
  assert.deepEqual(sqrt(z(0, 0)), z(0, 0));
  const w = z(-2.5, 0.75);
  close(mul(sqrt(w), sqrt(w)), w, 1e-12);
});

test('pow: expoentes inteiros, incluindo negativo', () => {
  const w = z(1, 2);
  close(mul(pow(w, -2), pow(w, 2)), z(1, 0));
  assert.deepEqual(pow(w, 0), z(1, 0));
  close(pow(w, 3), mul(w, mul(w, w)));
  close(pow(z(0, 2), 2), z(-4, 0));
  assert.throws(() => pow(z(0, 0), -1), RangeError);
  assert.throws(() => pow(w, 1.5), TypeError);
});

test('forma polar: ida e volta, radianos e graus', () => {
  const w = z(3, -4);
  const p = toPolar(w);
  assert.equal(p.mag, 5);
  close(fromPolar(p.mag, p.phase), w);
  assert.ok(Math.abs(toPolarDeg(z(0, 1)).phase - 90) < 1e-12);
  assert.ok(Math.abs(toPolarDeg(z(-1, 0)).phase - 180) < 1e-12);
  close(fromPolarDeg(2, 90), z(0, 2));
  close(fromPolarDeg(1, 180), z(-1, 0));
  close(fromPolarDeg(10, -45), z(7.0710678118654755, -7.0710678118654755));
  close(fromPolar(1, Math.PI / 2), fromPolarDeg(1, 90));
  assert.throws(() => fromPolar(NaN, 0), TypeError);
});

test('pares [re, im] das raízes do SISO', () => {
  assert.deepEqual(fromPair([1, -2]), z(1, -2));
  assert.deepEqual(toPair(z(3, 4)), [3, 4]);
  assert.throws(() => fromPair([1]), TypeError);
  assert.throws(() => fromPair('ab'), TypeError);
  assert.throws(() => fromPair([1, NaN]), TypeError);
});

test('equalsWithin: tolerância e validação', () => {
  assert.equal(equalsWithin(z(1, 1), z(1, 1 + 1e-9), 1e-8), true);
  assert.equal(equalsWithin(z(1, 1), z(1, 1 + 1e-9), 1e-10), false);
  assert.throws(() => equalsWithin(z(0, 0), z(0, 0), -1), RangeError);
});
