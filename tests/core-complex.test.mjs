import test from 'node:test';
import assert from 'node:assert/strict';
import {
  make, add, sub, mul, div, conj, scale, abs, arg, fromPolar, fromPolarDeg,
  toPolar, toPolarDeg, exp, sqrt, pow, fromPair, toPair, equalsWithin
} from '../assets/js/core/complex.js';
import {sinh, cosh, tanh, sinhc} from '../assets/js/core/complex.js';
import {readFileSync} from 'node:fs';

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

/* ---------- Funções hiperbólicas de argumento complexo (sinh, cosh, tanh, sinhc) ---------- */

/*
 * Tolerâncias. O erro de cada caso é |g − r| / |r|, com |r| o MÓDULO do resultado de referência
 * (não o módulo de cada componente): uma componente muito menor que o módulo é julgada pelo módulo.
 * Maiores erros medidos contra o mpmath (80 dígitos): sinh 2,1e-16; cosh 2,3e-16; tanh 3,0e-16;
 * sinhc 2,6e-16 (ulp(1) = 2,2e-16, ou seja, cerca de 1 a 1,4 ulp). TOL = 1e-15 é 3 a 5 vezes
 * o pior caso medido, e não afrouxa a ordem de grandeza.
 */
const TOL = {sinh: 1e-15, cosh: 1e-15, tanh: 1e-15, sinhc: 1e-15};

const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-complex-hyperbolic.json', import.meta.url), 'utf8'));
const erroRel = (g, r) => {
  const mod = Math.hypot(r.re, r.im);
  const d = Math.hypot(g.re - r.re, g.im - r.im);
  return mod > 0 ? d / mod : d;
};
const FUNCOES = {sinh, cosh, tanh, sinhc};

for (const nome of Object.keys(FUNCOES)) {
  test(`${nome}: casos da fixture mpmath (tolerância ${TOL[nome]} no módulo)`, () => {
    const falhas = [];
    let pior = {e: 0, id: null};
    for (const c of FIX.casos) {
      const e = erroRel(FUNCOES[nome](z(c.z[0], c.z[1])), z(c[nome][0], c[nome][1]));
      if (!(e <= TOL[nome])) falhas.push(`${c.id}: erro ${e}`);
      if (e > pior.e) pior = {e, id: c.id};
    }
    assert.deepEqual(falhas, [], `pior caso medido: ${pior.id} (${pior.e})`);
  });
}

test('identidade cosh²z − sinh²z = 1 (erro normalizado por |cosh z|² + |sinh z|²)', () => {
  let pior = 0;
  for (const c of FIX.casos) {
    const q = z(c.z[0], c.z[1]);
    const s = sinh(q), ch = cosh(q);
    if (![s.re, s.im, ch.re, ch.im].every(Number.isFinite)) continue; // estouro: fora do escopo da identidade
    const escala = abs(ch) ** 2 + abs(s) ** 2;
    if (!Number.isFinite(escala)) continue;
    const df = sub(mul(ch, ch), mul(s, s));
    pior = Math.max(pior, Math.hypot(df.re - 1, df.im) / escala);
  }
  assert.ok(pior <= TOL.cosh, `erro normalizado máximo ${pior}`);
});

test('tanh = sinh/cosh onde a razão é segura (|x| ≤ 5 e |cosh z| ≥ 0,5)', () => {
  let pior = 0;
  for (const c of FIX.casos) {
    const q = z(c.z[0], c.z[1]);
    if (Math.abs(q.re) > 5) continue;
    const ch = cosh(q);
    if (abs(ch) < 0.5) continue;
    pior = Math.max(pior, erroRel(tanh(q), div(sinh(q), ch)));
  }
  assert.ok(pior <= TOL.tanh, `erro máximo ${pior}`);
});

test('eixo imaginário: sinh(iy) = i·sen y e cosh(iy) = cos y, exatos', () => {
  for (let i = -100; i <= 100; i++) {
    const y = i * 0.13;
    const s = sinh(z(0, y)), ch = cosh(z(0, y));
    assert.equal(s.re, 0);
    assert.equal(s.im, Math.sin(y));
    assert.equal(ch.re, Math.cos(y));
    assert.equal(ch.im, 0);
  }
});

test('simetrias exatas: sinh é ímpar, cosh é par, conj(sinh z) = sinh(conj z)', () => {
  for (const c of FIX.casos) {
    const q = z(c.z[0], c.z[1]), nq = z(-c.z[0], -c.z[1]);
    const sq = sinh(q);
    assert.ok(equalsWithin(sinh(nq), scale(sq, -1), 0), `sinh ímpar em ${c.id}`);
    assert.ok(equalsWithin(cosh(nq), cosh(q), 0), `cosh par em ${c.id}`);
    assert.ok(equalsWithin(conj(sq), sinh(conj(q)), 0), `conj em ${c.id}`);
  }
});

test('tanh assintótico (|x| > 20) coincide com a forma exata da definição', () => {
  const exata = (x, y) => {
    const sh = Math.sinh(x), ch = Math.cosh(x), cy = Math.cos(y), sy = Math.sin(y);
    const den = sh * sh + cy * cy;
    return z((sh * ch) / den, (sy * cy) / den);
  };
  for (const y of [0, 0.3, 1, Math.PI / 4, Math.PI / 2, 2, -1.3, 3]) {
    for (const x of [20, 20.000001, 20.5, 25, 40]) {
      const e = erroRel(tanh(z(x, y)), exata(x, y));
      assert.ok(e <= TOL.tanh, `x=${x} y=${y}: erro ${e}`);
    }
  }
});

test('tanh no polo z = i·fl(π/2): finito, grande e igual a tan(fl(π/2)) na parte imaginária', () => {
  const t = tanh(z(0, Math.PI / 2));
  assert.equal(t.re, 0);
  assert.ok(Number.isFinite(t.im) && t.im > 1e15);
  assert.ok(Math.abs(t.im - Math.tan(Math.PI / 2)) <= TOL.tanh * t.im);
});

test('sinhc(0) = {1, 0} e sinhc(1e-300) = 1 exato', () => {
  assert.deepStrictEqual(sinhc(z(0, 0)), z(1, 0));
  assert.deepStrictEqual(sinhc(z(1e-300, 0)), z(1, 0));
  assert.deepStrictEqual(sinhc(z(1e-300, 1e-300)), z(1, 0));
});

test('sinhc: parte imaginária exatamente 0 em eixos real e imaginário', () => {
  for (const x of [0.1, 0.5, 2, -3, 10, -0.99, 1.01]) {
    const r = sinhc(z(x, 0));
    assert.equal(r.im, 0);
    assert.ok(Math.abs(r.re - Math.sinh(x) / x) <= TOL.sinhc * Math.abs(r.re), `x=${x}`);
  }
  for (const y of [0.1, 0.5, 2, -7, 1.01, -0.99]) {
    const r = sinhc(z(0, y));
    assert.equal(r.im, 0);
    assert.ok(Math.abs(r.re - Math.sin(y) / y) <= TOL.sinhc * Math.abs(r.re), `y=${y}`);
  }
});

test('sinhc·z = sinh z para |z| ≥ 1e-3 (todos os casos com sinh finito)', () => {
  let pior = 0;
  for (const c of FIX.casos) {
    const q = z(c.z[0], c.z[1]);
    if (Math.hypot(q.re, q.im) < 1e-3) continue;
    const s = sinh(q);
    if (!Number.isFinite(s.re) || !Number.isFinite(s.im)) continue;
    pior = Math.max(pior, erroRel(mul(sinhc(q), q), s));
  }
  assert.ok(pior <= TOL.sinhc, `erro máximo ${pior}`);
});

test('sinhc: continuidade na fronteira |z| = 1 (série × sinh/z pela divisão)', () => {
  // Abaixo de |z| = 1 usa-se a série; a referência é sinh(z)/z pela divisão de Smith (div).
  let pior = 0;
  for (const th of [0, 0.3, 1.0, 2.0, Math.PI / 2, 2.9, -0.7, -2.5]) {
    for (const r of [1 - 1e-3, 1 - 1e-6, 1 - 1e-9, 1 - 1e-12, 1 + 1e-12, 1 + 1e-9]) {
      const q = z(r * Math.cos(th), r * Math.sin(th));
      pior = Math.max(pior, erroRel(sinhc(q), div(sinh(q), q)));
    }
  }
  assert.ok(pior <= TOL.sinhc, `erro máximo na fronteira ${pior}`);
});

test('sinhc é par: sinhc(−z) = sinhc(z) exatamente', () => {
  for (const c of FIX.casos) {
    const q = z(c.z[0], c.z[1]), nq = z(-c.z[0], -c.z[1]);
    assert.ok(equalsWithin(sinhc(nq), sinhc(q), 0), `em ${c.id}`);
  }
});

test('estouro: sinh, cosh e sinhc devolvem ±Infinity sem NaN e sem lançar', () => {
  const s1 = sinh(z(1000, 0));
  assert.equal(s1.re, Infinity);
  assert.equal(s1.im, 0);
  const c1 = cosh(z(-1000, 0));
  assert.equal(c1.re, Infinity);
  assert.equal(c1.im, 0);
  const s2 = sinh(z(800, 0.3));
  assert.equal(s2.re, Infinity);
  assert.equal(s2.im, Infinity);
  const k = sinhc(z(800, 0.3));
  assert.equal(k.re, Infinity);
  assert.equal(k.im, Infinity);
  const kn = sinhc(z(-800, -0.3));
  assert.equal(kn.re, k.re);
  assert.equal(kn.im, k.im);
  for (const r of [sinh(z(-900, 2)), cosh(z(900, 2)), tanh(z(900, 2)), sinhc(z(900, 2))]) {
    assert.ok(!Number.isNaN(r.re) && !Number.isNaN(r.im));
  }
});

test('entradas inválidas: sinh, cosh, tanh e sinhc lançam TypeError', () => {
  for (const f of [sinh, cosh, tanh, sinhc]) {
    assert.throws(() => f(z(NaN, 0)), TypeError);
    assert.throws(() => f(z(0, Infinity)), TypeError);
    assert.throws(() => f({re: 1}), TypeError);
    assert.throws(() => f(null), TypeError);
    assert.throws(() => f('1'), TypeError);
  }
});
