import test from 'node:test';
import assert from 'node:assert/strict';
import {fzero} from '../assets/js/core/solvers.js';

// Raízes de referência (conhecidas com ≥ 15 dígitos):
const DOTTIE = 0.7390851332151607;               // cos(x) = x
const CUBICA = 2.0945514815423265;               // x³ − 2x − 5 = 0 (raiz real, Wallis)
const TOL = 1e-14;                                // TolX padrão = eps → erro em x ≈ poucos ulps

test('cos(x) − x: x0 escalar e intervalo', () => {
  const f = (x) => Math.cos(x) - x;
  for (const x0 of [0, 1, -3, [0, 1], [1, 0]]) {
    const r = fzero(f, x0);
    assert.ok(Math.abs(r.x - DOTTIE) < TOL, `x0=${x0}: ${r.x}`);
    assert.ok(Math.abs(r.fval) < 1e-15);
    assert.equal(r.exitflag, 1);
    assert.ok(r.output.iterations >= 0 && r.output.funcCount >= 2);
    assert.equal(typeof r.output.message, 'string');
  }
});

test('x³ − 2x − 5', () => {
  const f = (x) => x ** 3 - 2 * x - 5;
  for (const x0 of [2, [2, 3], [-10, 10]]) {
    const r = fzero(f, x0);
    assert.ok(Math.abs(r.x - CUBICA) < TOL, `${r.x}`);
    assert.equal(r.exitflag, 1);
  }
});

test('polinômio com raízes 1, 2, 3: o intervalo escolhe a raiz', () => {
  const p = (x) => (x - 1) * (x - 2) * (x - 3);
  assert.ok(Math.abs(fzero(p, [0.5, 1.5]).x - 1) < TOL);
  assert.ok(Math.abs(fzero(p, [1.5, 2.5]).x - 2) < TOL);
  assert.ok(Math.abs(fzero(p, [2.5, 3.5]).x - 3) < TOL);
  const q = (x) => x ** 3 - 6 * x * x + 11 * x - 6;
  assert.ok(Math.abs(fzero(q, [2.5, 3.5]).x - 3) < 1e-13);
});

test('raiz no extremo do intervalo e f(x0) = 0 devolvem imediatamente', () => {
  const a = fzero((x) => x - 1, [1, 5]);
  assert.equal(a.x, 1); assert.equal(a.fval, 0); assert.equal(a.exitflag, 1);
  const b = fzero((x) => x - 1, [-5, 1]);
  assert.equal(b.x, 1);
  const c = fzero((x) => x - 7, 7);
  assert.equal(c.x, 7); assert.equal(c.output.funcCount, 1); assert.equal(c.output.iterations, 0);
});

test('busca de intervalo expande a partir de x0 longe da raiz', () => {
  const r = fzero((x) => x - 1e6, 0);
  assert.ok(Math.abs(r.x - 1e6) < 1e-8);
  const s = fzero((x) => Math.exp(x) - 1e5, 0);
  assert.ok(Math.abs(s.x - Math.log(1e5)) < 1e-13);
  const t = fzero((x) => x * x - 4, 10);   // acha uma das raízes ±2
  assert.ok(Math.abs(Math.abs(t.x) - 2) < 1e-13);
});

test('funções com derivada nula na raiz (multiplicidade ímpar)', () => {
  const r = fzero((x) => (x - 1) ** 3, [0, 3]);
  assert.ok(Math.abs(r.x - 1) < 1e-5);   // f ≈ (Δx)³: Δx ~ 1e-5 ⇒ f ~ 1e-15; limitado pelo condicionamento
  assert.equal(r.exitflag, 1);
});

test('tan perto de π/2: retorna o ponto de descontinuidade (exitflag −5)', () => {
  const r = fzero(Math.tan, [1, 2]);
  assert.ok(Math.abs(r.x - Math.PI / 2) < 1e-12);
  assert.equal(r.exitflag, -5);
  assert.ok(Math.abs(r.fval) > 1e10);
  // mesmo intervalo com raiz verdadeira de tan em π: exitflag 1
  const s = fzero(Math.tan, [3, 3.5]);
  assert.ok(Math.abs(s.x - Math.PI) < 1e-14);
  assert.equal(s.exitflag, 1);
});

test('TolX, MaxIter e MaxFunEvals', () => {
  const f = (x) => Math.cos(x) - x;
  const grosso = fzero(f, [0, 1], {TolX: 1e-3});
  const fino = fzero(f, [0, 1]);
  assert.ok(Math.abs(grosso.x - DOTTIE) < 2e-3 * 1.1);
  assert.ok(grosso.output.iterations < fino.output.iterations);
  const lim = fzero(f, [0, 1], {MaxIter: 2});
  assert.equal(lim.exitflag, 0); assert.equal(lim.output.iterations, 2);
  const lim2 = fzero(f, [0, 1], {MaxFunEvals: 4});
  assert.equal(lim2.exitflag, 0); assert.ok(lim2.output.funcCount <= 4);
});

test('contagem de avaliações coerente com a função chamada', () => {
  let n = 0;
  const r = fzero((x) => { n++; return Math.cos(x) - x; }, [0, 1]);
  assert.equal(r.output.funcCount, n);
});

test('intervalo sem mudança de sinal lança RangeError', () => {
  assert.throws(() => fzero((x) => x * x + 1, [0, 1]), /sinais opostos/);
  assert.throws(() => fzero((x) => x * x + 1, [0, 1]), RangeError);
});

test('x0 escalar sem raiz: RangeError (não acha mudança de sinal)', () => {
  assert.throws(() => fzero((x) => x * x + 1, 0), RangeError);
  assert.throws(() => fzero((x) => 1 + Math.exp(x), 0), /intervalo/);
});

test('entradas inválidas', () => {
  const f = (x) => x - 1;
  assert.throws(() => fzero('f', 0), TypeError);
  assert.throws(() => fzero(f, 'a'), TypeError);
  assert.throws(() => fzero(f, [0]), TypeError);
  assert.throws(() => fzero(f, [0, 1, 2]), TypeError);
  assert.throws(() => fzero(f, ['0', 1]), TypeError);
  assert.throws(() => fzero(f, NaN), RangeError);
  assert.throws(() => fzero(f, [0, Infinity]), RangeError);
  assert.throws(() => fzero(f, 0, null), TypeError);
  assert.throws(() => fzero(f, 0, {TolX: 0}), RangeError);
  assert.throws(() => fzero(f, 0, {MaxIter: -1}), RangeError);
  assert.throws(() => fzero(f, 0, {MaxFunEvals: 'x'}), RangeError);
  assert.throws(() => fzero(() => 'a', 0), TypeError);
  assert.throws(() => fzero(() => NaN, 0), RangeError);
  assert.throws(() => fzero(() => Infinity, [0, 1]), RangeError);
});

test('aplicação: tensão no diodo (Shockley) com resistor em série', () => {
  // (Vs − v)/R = Is·(e^{v/(n·Vt)} − 1)
  const Vs = 5, R = 1e3, Is = 1e-12, nVt = 0.02585;
  const g = (v) => (Vs - v) / R - Is * (Math.exp(v / nVt) - 1);
  const r = fzero(g, [0, 1]);
  assert.ok(Math.abs(g(r.x)) < 1e-15);
  assert.ok(r.x > 0.5 && r.x < 0.8);
});
