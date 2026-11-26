import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tf, ss, zpk, negate, append, modred} from '../assets/js/core/models.js';
import {zpk2tf, evalfr, pole} from '../assets/js/core/analysis.js';
import {mmul, msolve, eye, madd} from '../assets/js/core/matrix.js';

// Fixture de scripts/reference/gen_models.py: referência = python-control 0.10.2 (ct.ss/tf/zpk, -sys,
// ct.append, ct.model_reduction). 'matchdc' discreto não existe no python-control: testado por propriedade.
const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-models.json', import.meta.url), 'utf8'));

const TOL = 1e-12; // só soma, produto e uma resolução linear pequena; erro medido ≤ 1e-15

const maxDiff = (a, b) => {
  const x = a.flat(), y = b.flat();
  assert.equal(x.length, y.length, 'tamanhos diferentes');
  return x.reduce((m, v, i) => Math.max(m, Math.abs(v - y[i])), 0);
};
const sameSS = (got, exp, msg) => {
  for (const k of ['A', 'B', 'C', 'D']) {
    assert.ok(maxDiff(got[k], exp[k]) <= TOL, `${msg}: ${k} difere ${maxDiff(got[k], exp[k])}`);
  }
};
// ganho em s0 (ou z0): C (s0 I − A)⁻¹ B + D, caso MIMO/estático
const gain = (s, s0) => {
  if (s.A.length === 0) return s.D;
  const M = madd(eye(s.A.length).map(r => r.map(v => v * s0)), s.A, -1);
  return madd(mmul(s.C, msolve(M, s.B)), s.D);
};

test('ss, tf e zpk reproduzem o python-control', () => {
  for (const c of FIX.ss) sameSS(ss(c.args.A, c.args.B, c.args.C, c.args.D), c.expected, c.id);
  for (const c of FIX.tf) assert.deepEqual(tf(c.num, c.den), c.expected);
  for (const c of FIX.zpk) {
    const s = zpk(c.z, c.p, c.k);
    const t = zpk2tf(s.z, s.p, s.k);
    assert.ok(maxDiff([t.num], [c.expected_tf.num]) <= 1e-12 && maxDiff([t.den], [c.expected_tf.den]) <= 1e-12);
  }
});

test('construtores: dt só gravado se > 0; D vira matriz; tf remove zeros à esquerda', () => {
  assert.equal('dt' in tf([1], [1, 1]), false);
  assert.equal(tf([1], [1, 1], 0.1).dt, 0.1);
  assert.deepEqual(ss([[-1]], [[1]], [[1]], 2).D, [[2]]);
  assert.deepEqual(ss([[-1]], [[1]], [[1]]).D, [[0]]);
  assert.deepEqual(tf([0, 0, 3], [0, 1, 2]), {num: [3], den: [1, 2]});
  assert.deepEqual(zpk([-1, 2], [[0, 1], [0, -1]], 3).z, [[-1, 0], [2, 0]]);
  const st = ss([], [], [], [[1, 2], [3, 4]]);
  assert.deepEqual(st.D, [[1, 2], [3, 4]]);
  assert.equal(ss([], [], [], 5).D[0][0], 5);
});

test('construtores: erros', () => {
  assert.throws(() => tf([1], [0, 0]), RangeError);
  assert.throws(() => tf('a', [1]), TypeError);
  assert.throws(() => tf([1], [1, NaN]), RangeError);
  assert.throws(() => tf([1], [1, 1], -1), RangeError);
  assert.throws(() => ss([[1, 2]], [[1]], [[1]], 0), RangeError);
  assert.throws(() => ss([[1]], [[1], [2]], [[1]], 0), RangeError);
  assert.throws(() => ss([[1]], [[1]], [[1, 2]], 0), RangeError);
  assert.throws(() => ss([[1]], [[1]], [[1]], [[1, 2]]), RangeError);
  assert.throws(() => ss([[1, 0], [0, 1]], [[1, 0], [0, 1]], [[1, 0]], 5), RangeError);
  assert.throws(() => ss([], [], []), RangeError);
  assert.throws(() => zpk([[0, 1]], [-1], 1), RangeError); // z = j sem conjugado
  assert.throws(() => zpk([-1], [-2], Infinity), RangeError);
  assert.throws(() => zpk('x', [], 1), TypeError);
  assert.throws(() => zpk([[1, 2, 3]], [], 1), TypeError);
});

test('negate reproduz −sys do python-control', () => {
  for (const c of FIX.negate) {
    if (c.sys) sameSS(negate(c.sys), c.expected, c.id);
    else {
      const r = negate({num: c.num, den: c.den});
      assert.ok(maxDiff([r.num], [c.expected.num]) <= TOL && maxDiff([r.den], [c.expected.den]) <= TOL, c.id); // +0 vs −0 do numpy
    }
  }
});

test('negate: forma e dt preservados, sem −0, entrada intacta', () => {
  const z = {z: [[-1, 0]], p: [[-2, 0]], k: 3, dt: 0.5};
  const nz = negate(z);
  assert.deepEqual(nz, {z: [[-1, 0]], p: [[-2, 0]], k: -3, dt: 0.5});
  assert.equal(z.k, 3);
  const n = negate({num: [0], den: [1, 1]});
  assert.ok(Object.is(n.num[0], 0));
  const s = negate({A: [[-1]], B: [[1]], C: [[2]], D: 0});
  assert.deepEqual(s, {A: [[-1]], B: [[1]], C: [[-2]], D: [[0]]});
  assert.ok(Object.is(s.D[0][0], 0));
  // −G(s) em um ponto
  const G = {num: [1, 3], den: [1, 2, 5]};
  const a = evalfr(G, [0.3, 1.1]), b = evalfr(negate(G), [0.3, 1.1]);
  assert.ok(Math.hypot(a[0] + b[0], a[1] + b[1]) < 1e-14);
  assert.throws(() => negate(5), TypeError);
  assert.throws(() => negate({foo: 1}), TypeError);
});

test('append reproduz ct.append (SS) e discreto', () => {
  for (const c of FIX.append) {
    const dt = c.dt;
    const r = append(...c.sistemas.map(s => (dt ? {...s, dt} : s)));
    sameSS(r, c.expected, c.id);
    assert.equal(r.dt, dt);
  }
});

test('append de TF/ZPK/SS: blocos diagonais com as FTs corretas', () => {
  const g1 = {num: [1], den: [1, 1]};
  const g2 = {z: [[-1, 0]], p: [[-2, 0], [-3, 0]], k: 2};
  const g3 = {A: [[0, 1], [-2, -3]], B: [[0], [1]], C: [[1, 0]], D: 0};
  const r = append(g1, g2, g3);
  assert.equal(r.A.length, 1 + 2 + 2);
  assert.equal(r.B[0].length, 3);
  assert.equal(r.C.length, 3);
  // ganho DC diagonal: g1(0) = 1, g2(0) = 2·1/6 = 1/3, g3(0) = 1/2; fora da diagonal = 0
  const G = gain(r, 0);
  const esp = [[1, 0, 0], [0, 1 / 3, 0], [0, 0, 0.5]];
  assert.ok(maxDiff(G, esp) < 1e-13);
  // estático + dinâmico
  const e = append({num: [4], den: [2]}, g1);
  assert.deepEqual(e.D, [[2, 0], [0, 0]]);
  assert.equal(e.A.length, 1);
  assert.deepEqual(append(g1), {A: [[-1]], B: [[1]], C: [[1]], D: [[0]]});
  // só estáticos
  const st = append({num: [2], den: [1]}, {num: [3], den: [1]});
  assert.deepEqual(st, {A: [], B: [], C: [], D: [[2, 0], [0, 3]]});
});

test('append: erros', () => {
  assert.throws(() => append(), RangeError);
  assert.throws(() => append({num: [1], den: [1, 1]}, {num: [1], den: [1, 1], dt: 0.1}), RangeError);
  assert.throws(() => append({num: [1, 0, 0], den: [1, 1]}), RangeError); // imprópria
  assert.throws(() => append({num: [1], den: [0]}), RangeError);
  assert.throws(() => append(3), TypeError);
});

test('modred reproduz ct.model_reduction (matchdc e truncate)', () => {
  for (const c of FIX.modred) sameSS(modred(c.sys, c.elim, c.method), c.expected, c.id);
});

test('modred: máscara booleana = índices; ordem dos índices não importa; entrada intacta', () => {
  const s = FIX.modred.find(c => c.id === 'mimo_5_elim13_matchdc').sys;
  const copia = JSON.stringify(s);
  const a = modred(s, [1, 3]);
  const b = modred(s, [3, 1]);
  const c = modred(s, [false, true, false, true, false]);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.equal(JSON.stringify(s), copia);
});

test('modred matchdc preserva o ganho DC (contínuo) e o ganho em z = 1 (discreto)', () => {
  const s = FIX.modred.find(c => c.id === 'mimo_5_elim34_matchdc').sys;
  const full = gain(s, 0);
  const red = modred(s, [3, 4]);
  assert.ok(maxDiff(gain(red, 0), full) < 1e-12);
  // truncate NÃO preserva
  assert.ok(maxDiff(gain(modred(s, [3, 4], 'truncate'), 0), full) > 1e-3);
  // discreto: sistema estável com A pequeno; DC = C (I − A)⁻¹ B + D
  const d = {A: [[0.5, 0.1, 0], [0, 0.3, 0.2], [0.1, 0, 0.2]], B: [[1], [0], [1]], C: [[1, 1, 0]], D: [[0.2]], dt: 0.1};
  const g1 = gain(d, 1);
  const rd = modred(d, [1, 2]);
  assert.equal(rd.dt, 0.1);
  assert.equal(rd.A.length, 1);
  assert.ok(maxDiff(gain(rd, 1), g1) < 1e-12);
});

test('modred: TF como entrada, eliminar todos os estados, sem eliminar', () => {
  const g = {num: [1], den: [1, 3, 2]};
  const todos = modred(g, [0, 1]);
  assert.deepEqual(todos.A, []);
  assert.ok(Math.abs(todos.D[0][0] - 0.5) < 1e-14); // G(0) = 1/2
  const nenhum = modred(g, []);
  assert.equal(nenhum.A.length, 2);
  const p = pole(modred(g, [1], 'truncate'));
  assert.equal(p.length, 1);
});

test('modred: erros', () => {
  const s = {A: [[0, 1], [0, 0]], B: [[0], [1]], C: [[1, 0]], D: 0};
  assert.throws(() => modred(s, [1]), RangeError);            // A22 = 0 singular
  assert.throws(() => modred({A: [[0.5, 0], [0, 1]], B: [[0], [1]], C: [[1, 0]], D: 0, dt: 1}, [1]), RangeError); // I − A22 = 0
  assert.doesNotThrow(() => modred({...s, dt: 1}, [1])); // discreto com A22 = 0: I − A22 = 1
  assert.doesNotThrow(() => modred(s, [1], 'truncate')); // truncate não inverte nada
  assert.throws(() => modred(s, [1], 'foo'), RangeError);
  assert.throws(() => modred(s, [2]), RangeError);
  assert.throws(() => modred(s, [-1]), RangeError);
  assert.throws(() => modred(s, [0, 0]), RangeError);
  assert.throws(() => modred(s, [0.5]), TypeError);
  assert.throws(() => modred(s, [true]), RangeError);   // máscara com comprimento errado
  assert.throws(() => modred(s, 1), TypeError);
});
