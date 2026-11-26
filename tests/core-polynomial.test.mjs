import test from 'node:test';
import assert from 'node:assert/strict';
import {siso} from './helpers/siso-reference.mjs';
import * as P from '../assets/js/core/polynomial.js';

// Arrays criados dentro do vm têm outro realm: copiá-los para comparação estrita.
const plain = (x) => (Array.isArray(x) ? Array.from(x, plain) : x);

// Gerador LCG determinístico (sem Math.random).
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
// Polinômio aleatório de grau deg, coeficiente líder em [1, 3), demais em [-5, 5).
function randPoly(rnd, deg) {
  const p = [1 + 2 * rnd()];
  for (let i = 1; i <= deg; i++) p.push(10 * rnd() - 5);
  return p;
}
const sortRoots = (rs) => rs.map((r) => [...r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const flat = (rs) => rs.flat();
function assertClose(actual, expected, tol, msg = '') {
  assert.equal(actual.length, expected.length, `${msg} (comprimento)`);
  actual.forEach((v, i) => {
    assert.ok(Math.abs(v - expected[i]) <= tol, `${msg} [${i}]: ${v} vs ${expected[i]}`);
  });
}

/* ------------------------- 1. regressão exata contra o original ------------------------- */

test('regressão exata: ptrim, pmul, padd, pscale, pdeg, plead, pprod (casos fixos)', () => {
  const cases = [[1, -3, 2], [0, 0, 1e-20, 1, 2], [0, 0, 0], [1e-16, 1, 2], [0, 0, 0, 5], [2, 0, 0, 0], [7]];
  for (const p of cases) {
    assert.deepEqual(plain(P.ptrim(p)), plain(siso.ptrim(p)));
    assert.deepEqual(plain(P.ptrim(p, 1e-3)), plain(siso.ptrim(p, 1e-3)));
    assert.deepEqual(P.pdeg(p), siso.pdeg(p));
    assert.deepEqual(P.plead(p), siso.plead(p));
  }
  assert.deepEqual(plain(P.pmul([1, 2], [3, -1, 4])), plain(siso.pmul([1, 2], [3, -1, 4])));
  assert.deepEqual(plain(P.padd([1, 2, 3], [4, 5])), plain(siso.padd([1, 2, 3], [4, 5])));
  assert.deepEqual(plain(P.padd([1], [2, 0, -1])), plain(siso.padd([1], [2, 0, -1])));
  assert.deepEqual(plain(P.pscale([1, 2, 3], -0.5)), plain(siso.pscale([1, 2, 3], -0.5)));
  assert.deepEqual(plain(P.pprod([[1, 1], [1, 2], [1, -3]])), plain(siso.pprod([[1, 1], [1, 2], [1, -3]])));
  assert.deepEqual(plain(P.pprod([])), plain(siso.pprod([])));
});

test('regressão exata: ptrim, pmul, padd, pprod (polinômios aleatórios)', () => {
  const rnd = lcg(7);
  for (let i = 0; i < 40; i++) {
    const a = randPoly(rnd, 1 + (i % 5)), b = randPoly(rnd, 1 + ((i * 3) % 4));
    assert.deepEqual(plain(P.pmul(a, b)), plain(siso.pmul(a, b)));
    assert.deepEqual(plain(P.padd(a, b)), plain(siso.padd(a, b)));
    assert.deepEqual(plain(P.pprod([a, b])), plain(siso.pprod([a, b])));
    assert.deepEqual(plain(P.ptrim(a)), plain(siso.ptrim(a)));
  }
});

test('regressão exata: polyFromRoots', () => {
  const sets = [
    [[1, 0], [2, 0], [3, 0]],
    [[-1, 2], [-1, -2]],
    [[0, 0], [0, 0], [1, 1], [1, -1]],
    [[0.5, 0.25], [0.5, -0.25], [-2, 0]],
    [],
  ];
  for (const rs of sets) assert.deepEqual(plain(P.polyFromRoots(rs)), plain(siso.polyFromRoots(rs)));
});

test('regressão exata: roots nos graus 1, 2, 3, 5, 8 e casos especiais', () => {
  const cases = [
    [2, -6],                               // grau 1
    [1, -3, 2], [1, 2, 5], [1, 0, -1],     // grau 2 (real, complexo, sem termo linear)
    [1, -6, 11, -6],                       // grau 3
    [1, -15, 85, -225, 274, -120],         // grau 5
    [1, -3, 2, 0, 0],                      // raiz nula múltipla
    [1e-13, 1, -2, 3, 4],                  // coeficiente líder pequeno (não removido)
    [1e-16, 1, 2],                         // coeficiente líder removido por ptrim
    [0, 0, 0],                             // identicamente nulo
    [5],                                   // constante
  ];
  const rnd = lcg(99);
  for (let deg = 3; deg <= 8; deg++) for (let t = 0; t < 3; t++) cases.push(randPoly(rnd, deg));
  for (const p of cases) assert.deepEqual(plain(P.roots(p)), plain(siso.roots(p)), `p=${p}`);
});

test('regressão exata: roots e aberth com init', () => {
  const rnd = lcg(2024);
  for (const deg of [3, 4, 5, 6]) {
    const p = randPoly(rnd, deg);
    const good = siso.roots(p);
    const inits = [
      good.map(([a, b]) => [a + 0.05, b - 0.03]),           // aproximações próximas
      good.map((_, i) => [0.3 * i, 0.2 * (i + 1)]),         // aproximações arbitrárias
      good.slice(0, -1),                                     // comprimento errado: ignorado
    ];
    for (const init of inits) {
      assert.deepEqual(plain(P.roots(p, init)), plain(siso.roots(p, init)), `deg=${deg}`);
    }
  }
  // aberth direto, coeficientes normalizados (c[0] = 1)
  const c = [1, -6, 11, -6];
  const init = [[1, 0.1], [2, 0.1], [3, -0.1]];
  assert.deepEqual(plain(P.aberth(c, 3, init)), plain(siso.aberth(c, 3, init)));
  assert.deepEqual(plain(P.aberth(c, 3, null)), plain(siso.aberth(c, 3, null)));
});

test('regressão exata: matchRoots', () => {
  const prev = [[1, 0], [0, 1], [-1, 0]];
  const next = [[-0.9, 0.05], [1.1, 0], [0.05, 0.95]];
  assert.deepEqual(plain(P.matchRoots(prev, next)), plain(siso.matchRoots(prev, next)));
  assert.deepEqual(plain(P.matchRoots(null, next)), plain(siso.matchRoots(null, next)));
  assert.deepEqual(plain(P.matchRoots(prev, [[2, 0]])), plain(siso.matchRoots(prev, [[2, 0]])));
});

/* ------------------------- 2. analíticos ------------------------- */

test('roots([1,-3,2]) → raízes 1 e 2', () => {
  assertClose(flat(sortRoots(P.roots([1, -3, 2]))), [1, 0, 2, 0], 1e-12);
});

test('roots de (x-1)(x-2)(x-3)(x-4)(x-5) (grau 5) → 1..5', () => {
  const p = [1, -15, 85, -225, 274, -120];
  assertClose(flat(sortRoots(P.roots(p))), [1, 0, 2, 0, 3, 0, 4, 0, 5, 0], 1e-6);
});

test('par complexo: x² + 2x + 5 → −1 ± 2j', () => {
  assertClose(flat(sortRoots(P.roots([1, 2, 5]))), [-1, -2, -1, 2], 1e-12);
});

test('resíduo |p(r)| < 1e-8 em polinômios aleatórios determinísticos (graus 2 a 8)', () => {
  const rnd = lcg(12345);
  for (let deg = 2; deg <= 8; deg++) {
    for (let t = 0; t < 10; t++) {
      const p = randPoly(rnd, deg);
      const rs = P.roots(p);
      assert.equal(rs.length, deg, `contagem: grau ${deg}`);
      for (const r of rs) {
        const [vr, vi] = P.polyvalComplex(p, r);
        assert.ok(Math.hypot(vr, vi) < 1e-8, `grau ${deg}, p=${p}, r=${r}, |p(r)|=${Math.hypot(vr, vi)}`);
      }
    }
  }
});

test('ida e volta: polyFromRoots(roots(p)) ≈ p/p[0]', () => {
  const rnd = lcg(31337);
  const polys = [[1, -6, 11, -6], [1, 2, 5], [1, -3, 2]];
  for (let deg = 2; deg <= 6; deg++) for (let t = 0; t < 5; t++) polys.push(randPoly(rnd, deg));
  for (const p of polys) {
    const back = P.polyFromRoots(P.roots(p));
    const expected = p.map((c) => c / p[0]);
    assert.equal(back.length, expected.length, `p=${p}`);
    back.forEach((v, i) => {
      assert.ok(Math.abs(v - expected[i]) <= 1e-8 * Math.max(1, Math.abs(expected[i])), `p=${p} [${i}]: ${v} vs ${expected[i]}`);
    });
  }
});

test('polyder e polyint são inversos (MATLAB)', () => {
  assert.deepEqual(P.polyder([3, 2, 1]), [6, 2]);
  assert.deepEqual(P.polyder([5]), [0]);
  assert.deepEqual(P.polyder([1, 0]), [1]);
  assert.deepEqual(P.polyint([3, 2, 1]), [1, 1, 1, 0]);
  assert.deepEqual(P.polyint([3, 2, 1], 5), [1, 1, 1, 5]);
  const rnd = lcg(4242);
  const polys = [[2, 3, 4], [1, 0, 0, -7]];
  for (let t = 0; t < 10; t++) polys.push(randPoly(rnd, 1 + (t % 5)));
  for (const p of polys) {
    assertClose(P.polyint(P.polyder(p), p[p.length - 1]), p, 1e-12, `polyint(polyder(p)) p=${p}`);
    assertClose(P.polyder(P.polyint(p, 7)), p, 1e-12, `polyder(polyint(p)) p=${p}`);
  }
});

test('deconv(conv(a,b), a) → q ≈ b e r ≈ 0', () => {
  const a = [1, 2], b = [3, -1, 4];
  const {q, r} = P.deconv(P.conv(a, b), a);
  assertClose(q, b, 1e-12, 'q');
  assertClose(r, [0], 1e-12, 'r');
});

test('deconv com resto não nulo: [1,2,3,4] ÷ [1,1] → q=[1,1,2], r=[2]', () => {
  const {q, r} = P.deconv([1, 2, 3, 4], [1, 1]);
  assertClose(q, [1, 1, 2], 1e-12, 'q');
  assertClose(r, [2], 1e-12, 'r');
});

test('deconv com dividendo de grau menor que o divisor devolve o próprio dividendo', () => {
  const {q, r} = P.deconv([2, 1], [1, 0, 0]);
  assert.deepEqual(q, [0]);
  assert.deepEqual(r, [2, 1]);
});

test('polyval (MATLAB): polyval([1 -3 2],5)=12; polyval([3 2 1],2)=17; polyval([1 -3 2],1)=0', () => {
  assert.equal(P.polyval([1, -3, 2], 5), 12);
  assert.equal(P.polyval([3, 2, 1], 2), 17);
  assert.equal(P.polyval([1, -3, 2], 1), 0);
  assert.equal(P.polyval([7], -3), 7);
});

test('polyvalComplex: z²+2z+5 em z = −1+2j é zero; z²+1 em j é zero', () => {
  const [r1, i1] = P.polyvalComplex([1, 2, 5], [-1, 2]);
  assert.ok(Math.hypot(r1, i1) < 1e-12);
  const [r2, i2] = P.polyvalComplex([1, 0, 1], [0, 1]);
  assert.ok(Math.hypot(r2, i2) < 1e-12);
  assert.deepEqual(P.polyvalComplex([2, 0, 0], [0, 0]), [0, 0]);
});

test('entradas inválidas lançam TypeError/RangeError', () => {
  assert.throws(() => P.polyval(null, 1), TypeError);
  assert.throws(() => P.polyval([], 1), RangeError);
  assert.throws(() => P.polyval([1, NaN], 1), RangeError);
  assert.throws(() => P.polyval([1], Infinity), RangeError);
  assert.throws(() => P.polyval([1], '2'), TypeError);
  assert.throws(() => P.polyvalComplex([1], [1]), TypeError);
  assert.throws(() => P.polyvalComplex([1], [1, Infinity]), RangeError);
  assert.throws(() => P.ptrim('abc'), TypeError);
  assert.throws(() => P.ptrim([]), RangeError);
  assert.throws(() => P.ptrim([1, Infinity]), RangeError);
  assert.throws(() => P.roots([1, 'a']), TypeError);
  assert.throws(() => P.roots([]), RangeError);
  assert.throws(() => P.roots([1, 2], [[1, NaN]]), RangeError);
  assert.throws(() => P.polyFromRoots([[1]]), TypeError);
  assert.throws(() => P.polyder([]), RangeError);
  assert.throws(() => P.polyint([1], NaN), RangeError);
  assert.throws(() => P.polyint(5, 0), TypeError);
  assert.throws(() => P.pscale([1, 2], Infinity), RangeError);
  assert.throws(() => P.pmul([1], null), TypeError);
  assert.throws(() => P.conv([], [1]), RangeError);
  assert.throws(() => P.deconv([1, 2], [0, 0]), RangeError);
  assert.throws(() => P.deconv([1, 2], []), RangeError);
  assert.throws(() => P.aberth([1, 0, 1], 3), RangeError);
  assert.throws(() => P.matchRoots([[1, 0]], null), TypeError);
});
