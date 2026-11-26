import test from 'node:test';
import assert from 'node:assert/strict';
import {siso as sisoVm} from './helpers/siso-reference.mjs';
// Objetos e arrays criados no vm têm outro realm; copia para o realm atual antes de comparar.
const plain = (v) => Array.isArray(v) ? Array.from(v, plain) : (v !== null && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])) : v;
const wrap = (r) => typeof r === 'function' ? (...a) => plain(r(...a)) : plain(r);
const siso = Object.fromEntries(Object.entries(sisoVm).map(([k, f]) => [k, (...args) => wrap(f(...args))]));
import * as C from '../assets/js/core/control.js';

const R2D = 180 / Math.PI;
const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);
const nearArr = (a, b, tol) => {
  assert.equal(a.length, b.length, `comprimento ${a.length} vs ${b.length}`);
  a.forEach((v, i) => near(v, b[i], tol, `[${i}]`));
};
// Remove zeros líderes (relativos) e normaliza pelo coeficiente líder do denominador.
const strip = (p) => { const mx = Math.max(...p.map(Math.abs)); let i = 0; while (i < p.length - 1 && Math.abs(p[i]) <= 1e-12 * mx) i++; return p.slice(i); };
const normTF = (n, d) => ({ num: strip(n).map(v => v / d[0]), den: strip(d).map(v => v / d[0]) });

const plants = [
  {num: [1, 2], den: [1, 3, 2]},
  {num: [2, 0, 1], den: [1, 4, 5, 6]},
  {num: [3], den: [2, 1, 4]},
];
const frCases = [
  {name: 'contínuo com atraso', z: [[-2, 0]], p: [[-1, 0], [-3, 0]], k: 5, disc: false, Ts: undefined, delay: 0.1},
  {name: 'discreto', z: [[0.5, 0.5], [0.5, -0.5]], p: [[0.8, 0]], k: -0.3, disc: true, Ts: 0.1, delay: 0},
  {name: 'pólos complexos', z: [], p: [[-1, 2], [-1, -2]], k: 2, disc: false, Ts: undefined, delay: 0},
];
const W = [0.01, 0.3, 1, 3, 10, 50];

/* ---------- 1. regressão exata contra o original ---------- */
test('tf2ss idêntico ao original', () => {
  for (const p of plants) assert.deepEqual(C.tf2ss(p.num, p.den), siso.tf2ss(p.num, p.den));
});

test('c2d idêntico ao original', () => {
  for (const p of plants) {
    const ss = siso.tf2ss(p.num, p.den);
    for (const dt of [0.01, 0.1, 0.5]) assert.deepEqual(C.c2d(ss.A, ss.B, dt), siso.c2d(ss.A, ss.B, dt));
  }
  const A = [[0, 1], [-2, -3]], B = [[0], [1]];
  assert.deepEqual(C.c2d(A, B, 0.2), siso.c2d(A, B, 0.2));
});

test('pade idêntico ao original', () => {
  for (const T of [0.05, 0.5, 2]) for (const N of [1, 2, 3, 4]) assert.deepEqual(C.pade(T, N), siso.pade(T, N));
});

test('makeFR idêntico ao original (contínuo e discreto)', () => {
  for (const c of frCases) {
    const ref = siso.makeFR(c.z, c.p, c.k, c.disc, c.Ts, c.delay);
    const got = C.makeFR(c.z, c.p, c.k, c.disc, c.Ts, c.delay);
    for (const w of W) assert.deepEqual(got(w), ref(w), `${c.name} w=${w}`);
  }
});

test('margins idêntico ao original (contínuo e discreto)', () => {
  const cases = [
    {z: [], p: [[0, 0], [-1, 0]], k: 1, disc: false, Ts: undefined, w: [1e-3, 1e3]},
    {z: [], p: [[0, 0], [-1, 0], [-2, 0]], k: 10, disc: false, Ts: undefined, w: [1e-3, 1e3]},
    {z: [], p: [[0.9, 0], [0.5, 0]], k: 0.2, disc: true, Ts: 0.1, w: [1e-2, 30]},
  ];
  for (const c of cases) {
    const got = C.margins(C.makeFR(c.z, c.p, c.k, c.disc, c.Ts), c.w[0], c.w[1]);
    const ref = siso.margins(siso.makeFR(c.z, c.p, c.k, c.disc, c.Ts), c.w[0], c.w[1]);
    assert.deepEqual(got, ref);
  }
});

/* ---------- 2. analíticos ---------- */
test('c2d de integrador: Ad = 1, Bd = dt', () => {
  const dt = 0.1;
  const {Ad, Bd} = C.c2d([[0]], [[1]], dt);
  near(Ad[0][0], 1, 1e-12);
  near(Bd[0][0], dt, 1e-12);
});

test('c2d de A=-1: Ad = e^{-dt}, Bd = 1 - e^{-dt}', () => {
  const dt = 0.3, e = Math.exp(-dt);
  const {Ad, Bd} = C.c2d([[-1]], [[1]], dt);
  near(Ad[0][0], e, 1e-12);
  near(Bd[0][0], 1 - e, 1e-12);
});

test('pade(T,1) = [-T/2, 1] / [T/2, 1]', () => {
  const T = 0.8;
  const {num, den} = C.pade(T, 1);
  nearArr(num, [-T / 2, 1], 1e-12);
  nearArr(den, [T / 2, 1], 1e-12);
});

test('pade é todo-passa: |P(jw)| = 1', () => {
  const {num, den} = C.pade(0.7, 3);
  for (const w of [0.1, 1, 7, 100]) {
    const [re, im] = C.evalTF(num, den, [0, w]);
    near(Math.hypot(re, im), 1, 1e-12, `w=${w}`);
  }
});

test('fase de pade(T,3) ≈ -wT para wT pequeno', () => {
  const T = 0.02, w = 0.5;
  const {num, den} = C.pade(T, 3);
  const [re, im] = C.evalTF(num, den, [0, w]);
  near(Math.atan2(im, re) * R2D, -w * T * R2D, 1e-6);
});

test('makeFR de 1/(s+1) em w=1: -3.0103 dB e -45 graus', () => {
  const fr = C.makeFR([], [[-1, 0]], 1, false, undefined, 0);
  const r = fr(1);
  near(r.db, -3.0103, 1e-4);
  near(r.ph, -45, 1e-9);
});

test('margens de L = 1/(s(s+1)): wc e PM analíticos, GM infinita', () => {
  const fr = C.makeFR([], [[0, 0], [-1, 0]], 1, false, undefined, 0);
  const r = C.margins(fr, 1e-3, 1e3);
  const wcExact = Math.sqrt((Math.sqrt(5) - 1) / 2);
  near(r.pm.w, wcExact, 1e-3, 'wc');
  near(r.pm.pm, 90 - Math.atan(wcExact) * R2D, 1e-3, 'PM');
  assert.equal(r.gm.gm, Infinity);
});

test('ss2tf(tf2ss(n,d)) reproduz n/d normalizado', () => {
  for (const p of plants) {
    const ss = C.tf2ss(p.num, p.den);
    const r = C.ss2tf(ss.A, ss.B, ss.C, ss.D);
    const exp = normTF(p.num, p.den), got = normTF(r.num, r.den);
    nearArr(got.num, exp.num, 1e-9);
    nearArr(got.den, exp.den, 1e-9);
  }
});

test('feedback de 1/(s(s+1)) com H=1 -> num [1], den [1,1,1]', () => {
  assert.deepEqual(C.feedback([1], [1, 1, 0]), {num: [1], den: [1, 1, 1]});
});

test('feedback com sign=+1 (realimentação positiva) de 1/(s+1), H=1 -> 1/s', () => {
  assert.deepEqual(C.feedback([1], [1, 1], [1], [1], 1), {num: [1], den: [1, 0]});
});

test('series, parallel e dcgain em casos simples', () => {
  assert.deepEqual(C.series([1], [1, 1], [2], [1, 2]), {num: [2], den: [1, 3, 2]});
  assert.deepEqual(C.parallel([1], [1, 1], [1], [1, 2]), {num: [2, 3], den: [1, 3, 2]});
  near(C.dcgain([1], [1, 1]), 1, 1e-12);
  near(C.dcgain([2], [1, 3]), 2 / 3, 1e-12);
  assert.equal(C.dcgain([1], [1, 0]), Infinity);
  assert.equal(C.dcgain([-1], [1, 0]), -Infinity);
});

test('evalTF em s=jw coincide com makeFR (módulo e fase)', () => {
  const num = [1, 2], den = [1, 3, 2];
  const fr = C.makeFR([[-2, 0]], [[-1, 0], [-2, 0]], 1, false, undefined, 0);
  for (const w of [0.5, 5, 20]) {
    const [re, im] = C.evalTF(num, den, [0, w]);
    const r = fr(w);
    near(20 * Math.log10(Math.hypot(re, im)), r.db, 1e-9, `db w=${w}`);
    const dph = ((Math.atan2(im, re) * R2D - r.ph) % 360 + 540) % 360 - 180;
    near(dph, 0, 1e-9, `fase w=${w}`);
  }
});

/* ---------- 3. entradas inválidas ---------- */
test('entradas inválidas lançam TypeError/RangeError', () => {
  assert.throws(() => C.tf2ss([1], [0]), RangeError);
  assert.throws(() => C.tf2ss('x', [1, 1]), TypeError);
  assert.throws(() => C.tf2ss([1, 2, 3], [1, 1]), RangeError);
  assert.throws(() => C.c2d([[0]], [[1]], -1), RangeError);
  assert.throws(() => C.c2d([[0, 1]], [[1]], 0.1), RangeError);
  assert.throws(() => C.pade(-1, 2), RangeError);
  assert.throws(() => C.pade(1, 1.5), RangeError);
  assert.throws(() => C.makeFR([], [], 0, false), RangeError);
  assert.throws(() => C.makeFR([], [], 1, true), TypeError);
  assert.throws(() => C.margins(C.makeFR([], [], 1, false), 10, 1), RangeError);
  assert.throws(() => C.ss2tf([[0, 1]], [[1]], [[1, 0]], 0), RangeError);
  assert.throws(() => C.series([1], [0], [1], [1]), RangeError);
  assert.throws(() => C.dcgain([1, 'a'], [1]), TypeError);
  assert.throws(() => C.evalTF([1], [1], 'a'), TypeError);
  assert.throws(() => C.evalTF([1, NaN], [1], [0, 1]), RangeError);
});
