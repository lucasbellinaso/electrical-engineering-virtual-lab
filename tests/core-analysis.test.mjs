// Testes de assets/js/core/analysis.js: casos analíticos independentes e comparação com a
// referência NumPy/SciPy (tests/fixtures/core-analysis.json, gerada por scripts/reference/gen_analysis.py).
// Tolerâncias: 1e-9 (relativa, com piso 1 em módulo) para respostas em frequência e polinômios de
// ordem baixa; 1e-7 para SS (polinômio característico); 1e-6 para margens (bisseção vs brentq).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as A from '../assets/js/core/analysis.js';
import { tf2ss, evalTF } from '../assets/js/core/control.js';
import { polyFromRoots, polyvalComplex } from '../assets/js/core/polynomial.js';
import { logspace } from '../assets/js/core/numeric.js';

const fx = JSON.parse(
  readFileSync(new URL('./fixtures/core-analysis.json', import.meta.url), 'utf8'),
  (k, v) => (v === 'NaN' ? NaN : v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v),
);
const R2D = 180 / Math.PI;
const SQ2 = Math.SQRT2;

/* ------------------------- utilitários de comparação ------------------------- */

function near(a, b, tol, msg = '') {
  if (Number.isNaN(b)) { assert.ok(Number.isNaN(a), `${msg} esperado NaN, obtido ${a}`); return; }
  if (!Number.isFinite(b)) { assert.equal(a, b, msg); return; }
  assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);
}
const nearRel = (a, b, rel, msg = '') => near(a, b, rel * Math.max(1, Math.abs(b)), msg);
const wrapRad = (x) => Math.atan2(Math.sin(x), Math.cos(x));
const nearAngle = (a, b, tol, msg = '') => near(wrapRad(a - b), 0, tol, msg);

// Associa cada raiz de `ours` a uma de `ref` (guloso, pela menor distância). Devolve índices de ref.
function pairOrder(ours, ref, tol, msg) {
  assert.equal(ours.length, ref.length, `${msg}: comprimento ${ours.length} vs ${ref.length}`);
  const used = new Array(ref.length).fill(false);
  return ours.map((z) => {
    let best = -1, bd = Infinity;
    ref.forEach((r, j) => {
      if (used[j]) return;
      const d = Math.hypot(z[0] - r[0], z[1] - r[1]);
      if (d < bd) { bd = d; best = j; }
    });
    assert.ok(bd <= tol, `${msg}: raiz ${JSON.stringify(z)} sem par (distância ${bd})`);
    used[best] = true;
    return best;
  });
}
const sameSet = (ours, ref, tol, msg) => { pairOrder(ours, ref, tol, msg); };

// Sistema no formato de entrada da API (TF ou SS, conforme a referência).
const sysFor = (s) => (s.kind === 'ss'
  ? { A: s.ss.A, B: s.ss.B, C: s.ss.C, D: s.ss.D, dt: s.dt }
  : { num: s.num, den: s.den, dt: s.dt });
const tolPoles = (s) => (s.kind === 'ss' ? 1e-7 : 1e-9);

/* ------------------------- casos analíticos ------------------------- */

test('pole/zero/tfdata: mesma G = (s+2)/((s+1)(s+3)) em TF, ZPK e SS', () => {
  const tf = { num: [1, 2], den: [1, 4, 3] };
  const zpk = { z: [[-2, 0]], p: [[-1, 0], [-3, 0]], k: 1 };
  const ss = tf2ss([1, 2], [1, 4, 3]);
  const ssSys = { A: ss.A, B: ss.B, C: ss.C, D: ss.D };
  for (const sys of [tf, zpk, ssSys]) {
    sameSet(A.pole(sys), [[-1, 0], [-3, 0]], 1e-12, 'polos');
    sameSet(A.zero(sys), [[-2, 0]], 1e-12, 'zeros');
  }
  assert.deepEqual(A.tfdata(zpk), { num: [1, 2], den: [1, 4, 3] });
  nearRel(A.tfdata(ssSys).num[1], 2, 1e-12, 'tfdata(SS) num');
});

test('damp: s² + 1,2s + 4 -> wn = 2, zeta = 0,3', () => {
  const d = A.damp({ num: [4], den: [1, 1.2, 4] });
  for (const w of d.wn) near(w, 2, 1e-9, 'wn');
  for (const z of d.zeta) near(z, 0.3, 1e-9, 'zeta');
});

test('damp discreto: polos z = e^{(-1 ± j2)·Ts} recuperam wn = √5 e zeta = 1/√5', () => {
  const Ts = 0.1;
  const z = [Math.exp(-Ts) * Math.cos(2 * Ts), Math.exp(-Ts) * Math.sin(2 * Ts)];
  const den = polyFromRoots([[z[0], z[1]], [z[0], -z[1]]]);
  const d = A.damp({ num: [1], den, dt: Ts });
  for (const w of d.wn) near(w, Math.sqrt(5), 1e-9, 'wn discreto');
  for (const zt of d.zeta) near(zt, 1 / Math.sqrt(5), 1e-9, 'zeta discreto');
});

test('damp: polo na origem tem wn = 0 e zeta = NaN', () => {
  const d = A.damp({ num: [1], den: [1, 0] });
  near(d.wn[0], 0, 0, 'wn');
  assert.ok(Number.isNaN(d.zeta[0]));
});

test('tf2zpk: normaliza pelo coeficiente líder (3s+6)/(3s²+9s+6) -> z = -2, p = {-1,-2}, k = 1', () => {
  const r = A.tf2zpk([3, 6], [3, 9, 6]);
  sameSet(r.z, [[-2, 0]], 1e-12, 'z');
  sameSet(r.p, [[-1, 0], [-2, 0]], 1e-12, 'p');
  near(r.k, 1, 1e-12, 'k');
});

test('tf2zpk: numerador nulo dá z = [] e k = 0', () => {
  const r = A.tf2zpk([0], [1, 2]);
  assert.deepEqual(r.z, []);
  assert.equal(r.k, 0);
  sameSet(r.p, [[-2, 0]], 1e-12, 'p');
});

test('zpk2tf: pares complexos conjugados dão den = s² + 2s + 5 e num = 5', () => {
  const r = A.zpk2tf([], [[-1, 2], [-1, -2]], 5);
  assert.deepEqual(r.num, [5]);
  near(r.den[0], 1, 0, 'den0'); near(r.den[1], 2, 1e-12, 'den1'); near(r.den[2], 5, 1e-12, 'den2');
});

test('zpk2tf: zeros e polos reais formam G = (s+2)/((s+1)(s+3))', () => {
  const r = A.zpk2tf([[-2, 0]], [[-1, 0], [-3, 0]], 1);
  assert.deepEqual(r.num, [1, 2]);
  assert.deepEqual(r.den, [1, 4, 3]);
});

test('zpk2ss -> ss2zpk e ss2tf reproduzem zeros, polos, ganho e a TF', () => {
  const z = [[-2, 0]], p = [[-1, 0], [-3, 0]], k = 1;
  const { A: Am, B, C, D } = A.zpk2ss(z, p, k);
  const back = A.ss2zpk(Am, B, C, D);
  sameSet(back.z, z, 1e-9, 'z');
  sameSet(back.p, p, 1e-9, 'p');
  near(back.k, k, 1e-9, 'k');
  const tf = A.tfdata({ A: Am, B, C, D });
  nearRel(tf.num[0], 1, 1e-9, 'num lider'); nearRel(tf.num[1], 2, 1e-9, 'num s');
  assert.equal(tf.den.length, 3);
});

test('zpk2ss sem polos: A, B, C vazios e D = k', () => {
  const r = A.zpk2ss([], [], 3);
  assert.deepEqual(r, { A: [], B: [], C: [], D: 3 });
});

test('freqresp: 1/(s+1) em ω = 1 -> |H| = 1/√2, fase = -45°, H = (1 - j)/2', () => {
  const fr = A.freqresp({ num: [1], den: [1, 1] }, [1]);
  near(fr.mag[0], 1 / SQ2, 1e-12, 'mag');
  near(fr.phase[0], -Math.PI / 4, 1e-12, 'fase');
  near(fr.re[0], 0.5, 1e-12, 're'); near(fr.im[0], -0.5, 1e-12, 'im');
});

test('freqresp discreto: H(z) = 1/(z - 0.5), Ts = 0.1 -> H(1) = 2 e H(-1) = 2/3', () => {
  const sys = { num: [1], den: [1, -0.5], dt: 0.1 };
  const fr = A.freqresp(sys, [0, Math.PI / 0.1]);
  near(fr.mag[0], 2, 1e-12, 'mag em z = 1');
  near(fr.mag[1], 2 / 3, 1e-12, 'mag em z = -1');
  near(fr.re[1], -2 / 3, 1e-12, 're em z = -1');
});

test('freqresp: dt explícito e dt do sistema dão o mesmo resultado', () => {
  const w = logspace(-1, 1, 7);
  const a = A.freqresp({ num: [0.1, 0.05], den: [1, -1.5, 0.7] }, w, 0.1);
  const b = A.freqresp({ num: [0.1, 0.05], den: [1, -1.5, 0.7], dt: 0.1 }, w);
  assert.deepEqual(a, b);
});

test('bode: G = 1/(s(s+1)(s+10)) tem fase contínua -90 - atan ω - atan(ω/10) (graus)', () => {
  const sys = { num: [1], den: [1, 11, 10, 0] };
  const w = logspace(-3, 4, 300);
  const b = A.bode(sys, w, { deg: true });
  for (let i = 0; i < w.length; i++) {
    const ref = -90 - Math.atan(w[i]) * R2D - Math.atan(w[i] / 10) * R2D;
    near(b.phase[i], ref, 1e-6, `fase em ω = ${w[i]}`);
    const magDb = -20 * Math.log10(w[i] * Math.hypot(1, w[i]) * Math.hypot(10, w[i]));
    near(A.mag2db(b.mag[i]), magDb, 1e-9, `mag dB em ω = ${w[i]}`);
  }
  // Fase desembrulhada: nenhum salto maior que 180° entre pontos consecutivos.
  for (let i = 1; i < w.length; i++) assert.ok(Math.abs(b.phase[i] - b.phase[i - 1]) < 180);
  assert.ok(b.phase[w.length - 1] < -260, 'fase final perto de -270°');
});

test('bode: opções dB, Hz e rad (padrão)', () => {
  const sys = { num: [1], den: [1, 1] };
  const r = A.bode(sys, [1], { dB: true, Hz: true });
  near(r.mag[0], -10 * Math.log10(2), 1e-12, 'mag dB');
  near(r.omega[0], 1 / (2 * Math.PI), 1e-15, 'omega em Hz');
  const rad = A.bode(sys, [1]);
  near(rad.phase[0], -Math.PI / 4, 1e-12, 'fase em rad');
  near(rad.mag[0], 1 / SQ2, 1e-12, 'mag linear');
});

test('unwrap: exemplo de numpy.unwrap com period = 4 -> [0, 1, 2, 3, 4]', () => {
  assert.deepEqual(A.unwrap([0, 1, 2, -1, 0], 4), [0, 1, 2, 3, 4]);
});

test('unwrap: rampa 0,5k envolvida em (-π, π] volta a 0,5k', () => {
  const wrapped = Array.from({ length: 50 }, (_, k) => wrapRad(0.5 * k));
  const u = A.unwrap(wrapped);
  u.forEach((v, k) => near(v, 0.5 * k, 1e-12, `k=${k}`));
});

test('mag2db e db2mag são inversos; mag2db(0) = -Infinity', () => {
  near(A.mag2db(10), 20, 1e-12, 'mag2db(10)');
  near(A.db2mag(20), 10, 1e-12, 'db2mag(20)');
  near(A.db2mag(A.mag2db(0.37)), 0.37, 1e-12, 'ida e volta');
  assert.equal(A.mag2db(0), -Infinity);
});

test('evalfr: H = (s+2)/(s+1) em s = j -> (3 - j)/2', () => {
  const v = A.evalfr({ num: [1, 2], den: [1, 1] }, [0, 1]);
  near(v[0], 1.5, 1e-12, 're'); near(v[1], -0.5, 1e-12, 'im');
});

test('nyquist: partes real e imaginária iguais às de freqresp (ω > 0)', () => {
  const sys = { num: [4], den: [1, 1.2, 4] };
  const w = logspace(-1, 1, 9);
  const n = A.nyquist(sys, w), fr = A.freqresp(sys, w);
  assert.deepEqual(n.re, fr.re);
  assert.deepEqual(n.im, fr.im);
  assert.deepEqual(n.w, w);
});

test('minreal: (s+1)(s+2)/((s+1)(s+3)) -> (s+2)/(s+3)', () => {
  const r = A.minreal({ num: [1, 3, 2], den: [1, 4, 3] });
  assert.deepEqual(r.num, [1, 2]);
  assert.deepEqual(r.den, [1, 3]);
});

test('minreal: s/(s(s+1)) -> 1/(s+1) (cancela o polo e o zero na origem)', () => {
  const r = A.minreal({ num: [1, 0], den: [1, 1, 0] });
  assert.deepEqual(r.num, [1]);
  assert.deepEqual(r.den, [1, 1]);
});

test('minreal: tolerância controla o cancelamento de par quase coincidente (δ = 1e-9)', () => {
  const num = [1, 3, 2];                              // (s+1)(s+2)
  const den = polyFromRoots([[-1, 0], [-2 - 1e-9, 0]]); // (s+1)(s+2+δ)
  assert.equal(A.minreal({ num, den }).num.length, 1, 'padrão cancela');
  assert.equal(A.minreal({ num, den }, 1e-12).num.length, 2, 'tol 1e-12 não cancela o par');
});

test('rlocus: L = 1/(s(s+1)(s+2)) — K = 0: {0,-1,-2}; K = 6: {-3, ±j√2}', () => {
  const sys = { num: [1], den: [1, 3, 2, 0] };
  const r = A.rlocus(sys, [0, 6]);
  sameSet(r.roots[0], [[0, 0], [-1, 0], [-2, 0]], 1e-9, 'K=0');
  sameSet(r.roots[1], [[-3, 0], [0, SQ2], [0, -SQ2]], 1e-9, 'K=6');
});

test('rlocus: cada raiz satisfaz den(s) + K·num(s) = 0 em toda a grade de ganhos', () => {
  const sys = { num: [-1, 1], den: [1, 3, 2] };
  const gains = logspace(-2, 1, 25).map(x => x - 0.01);
  const r = A.rlocus(sys, gains);
  r.roots.forEach((rs, i) => {
    for (const s of rs) {
      const d = polyvalComplex([1, 3, 2], s), n = polyvalComplex([-1, 1], s);
      const res = Math.hypot(d[0] + gains[i] * n[0], d[1] + gains[i] * n[1]);
      assert.ok(res < 1e-8, `resíduo ${res} em K = ${gains[i]}`);
    }
  });
});

test('gangof4: P = 1/(s+1), C = 2 em ω = 1 -> S = (2+j)/5, T = (3-j)/5, S + T = 1', () => {
  const g = A.gangof4({ num: [1], den: [1, 1] }, { num: [2], den: [1] }, [1]);
  near(g.S[0][0], 0.4, 1e-12, 'S re'); near(g.S[0][1], 0.2, 1e-12, 'S im');
  near(g.T[0][0], 0.6, 1e-12, 'T re'); near(g.T[0][1], -0.2, 1e-12, 'T im');
  near(g.PS[0][0], 0.3, 1e-12, 'PS re'); near(g.PS[0][1], -0.1, 1e-12, 'PS im');
  near(g.CS[0][0], 0.8, 1e-12, 'CS re'); near(g.CS[0][1], 0.4, 1e-12, 'CS im');
  near(g.S[0][0] + g.T[0][0], 1, 1e-12, 'S + T (re)');
  near(g.S[0][1] + g.T[0][1], 0, 1e-12, 'S + T (im)');
});

test('margin: L = √10/(s(s+1)(s+2)) -> gm = 6/√10, pm = 45° - atan(1/2), wcg = √2, wcp = 1', () => {
  const m = A.margin({ num: [Math.sqrt(10)], den: [1, 3, 2, 0] });
  nearRel(m.gm, 6 / Math.sqrt(10), 1e-9, 'gm');
  near(m.pm, 45 - Math.atan(0.5) * R2D, 1e-7, 'pm');
  nearRel(m.wcg, SQ2, 1e-9, 'wcg');
  nearRel(m.wcp, 1, 1e-9, 'wcp');
});

test('margin: não mínima fase, L = (1-s)/((s+1)(s+2)) -> gm = 3 em ω = √5 e sem cruzamento de ganho', () => {
  const m = A.margin({ num: [-1, 1], den: [1, 3, 2] });
  nearRel(m.gm, 3, 1e-9, 'gm');
  nearRel(m.wcg, Math.sqrt(5), 1e-9, 'wcg');
  assert.equal(m.pm, Infinity);
  assert.ok(Number.isNaN(m.wcp));
});

test('margin: zero complexo no semiplano direito, L = 20(s²-2s+5)/((s+1)(s+2)(s+3))', () => {
  // Propriedades independentes: no cruzamento de fase Im L = 0 e Re L < 0, e gm = 1/|L|.
  // Regressão: o cruzamento em ω = 2 (salto de fase do zero 1 ± 2j) não é um cruzamento real,
  // pois Im L(2) ≠ 0.
  const num = [20, -40, 100], den = [1, 6, 11, 6];
  const m = A.margin({ num, den });
  const v = evalTF(num, den, [0, m.wcg]);
  near(v[1], 0, 1e-9, 'Im L(wcg)');
  assert.ok(v[0] < 0, 'Re L(wcg) < 0');
  nearRel(m.gm, 1 / Math.hypot(v[0], v[1]), 1e-9, 'gm = 1/|L|');
  assert.ok(Math.abs(m.wcg - 2) > 0.1, 'cruzamento não está em ω = 2');
  const v2 = evalTF(num, den, [0, 2]);
  assert.ok(Math.abs(v2[1]) > 1, 'Im L(2) ≠ 0');
});

test('margin: sem cruzamento (L = 1/(s+1)) -> gm = pm = Infinity e frequências NaN', () => {
  const m = A.margin({ num: [1], den: [1, 1] });
  assert.equal(m.gm, Infinity); assert.equal(m.pm, Infinity);
  assert.ok(Number.isNaN(m.wcg) && Number.isNaN(m.wcp));
});

test('ss2zpk: SS de três estados com D = 0,5 — ganho k = 0,5 e zeros = raízes do numerador', () => {
  const Am = [[-1, 2, 0], [0, -3, 1], [1, 0, -2]];
  const B = [[1], [0], [1]], C = [[1, 0, 1]];
  const r = A.ss2zpk(Am, B, C, [[0.5]]);
  near(r.k, 0.5, 1e-12, 'k');
  assert.equal(r.z.length, 3);
  assert.equal(r.p.length, 3);
});

test('entradas de SS e TF equivalentes dão a mesma resposta em frequência', () => {
  const tf = tf2ss([1, 2], [1, 4, 3]);
  const w = logspace(-2, 2, 15);
  const a = A.freqresp({ num: [1, 2], den: [1, 4, 3] }, w);
  const b = A.freqresp({ A: tf.A, B: tf.B, C: tf.C, D: tf.D }, w);
  w.forEach((_, i) => nearRel(b.mag[i], a.mag[i], 1e-9, `mag ${i}`));
});

/* ------------------------- comparação com a referência NumPy/SciPy ------------------------- */

for (const s of fx.systems) {
  const sys = () => sysFor(s);
  const tol = tolPoles(s);

  test(`[referência ${s.name}] polos, zeros e damp`, () => {
    const p = A.pole(sys());
    const idx = pairOrder(p, s.pole, tol, 'polos');
    sameSet(A.zero(sys()), s.zero, tol, 'zeros');
    const d = A.damp(sys());
    idx.forEach((j, i) => {
      nearRel(d.wn[i], s.damp.wn[j], 1e-8, `wn[${i}]`);
      near(d.zeta[i], s.damp.zeta[j], 1e-8, `zeta[${i}]`);
    });
  });

  test(`[referência ${s.name}] tf2zpk, ss2zpk e zpk2ss`, () => {
    const tfz = A.tf2zpk(s.num, s.den);
    sameSet(tfz.z, s.tf2zpk.z, tol, 'tf2zpk z');
    sameSet(tfz.p, s.tf2zpk.p, tol, 'tf2zpk p');
    nearRel(tfz.k, s.tf2zpk.k, tol, 'tf2zpk k');
    const sz = A.ss2zpk(s.ss.A, s.ss.B, s.ss.C, s.ss.D);
    sameSet(sz.z, s.ss2zpk.z, tol, 'ss2zpk z');
    sameSet(sz.p, s.ss2zpk.p, tol, 'ss2zpk p');
    nearRel(sz.k, s.ss2zpk.k, tol, 'ss2zpk k');
    const z2 = A.zpk2ss(s.tf2zpk.z, s.tf2zpk.p, s.tf2zpk.k);
    s.zpk2ss.A.forEach((row, i) => row.forEach((v, j) => nearRel(z2.A[i][j], v, 1e-9, `zpk2ss A[${i}][${j}]`)));
    s.zpk2ss.B.forEach((row, i) => near(z2.B[i][0], row[0], 1e-9, `zpk2ss B[${i}]`));
    s.zpk2ss.C[0].forEach((v, j) => nearRel(z2.C[0][j], v, 1e-9, `zpk2ss C[${j}]`));
    near(z2.D, s.zpk2ss.D, 1e-9, 'zpk2ss D');
  });

  test(`[referência ${s.name}] freqresp e bode (graus)`, () => {
    const fr = A.freqresp(sys(), s.w);
    s.w.forEach((_, i) => {
      nearRel(fr.mag[i], s.freqresp.mag[i], 1e-9, `mag[${i}]`);
      nearRel(fr.re[i], s.freqresp.re[i], 1e-9, `re[${i}]`);
      nearRel(fr.im[i], s.freqresp.im[i], 1e-9, `im[${i}]`);
      nearAngle(fr.phase[i], s.freqresp.phase[i], 1e-9, `fase[${i}]`);
    });
    const b = A.bode(sys(), s.w, { deg: true, dB: true });
    s.w.forEach((_, i) => {
      near(b.mag[i], s.bode_deg.mag_db[i], 1e-9, `mag dB[${i}]`);
      near(b.phase[i], s.bode_deg.phase_deg[i], 1e-7, `fase°[${i}]`);
    });
  });

  test(`[referência ${s.name}] evalfr`, () => {
    const v = A.evalfr(sys(), s.evalfr.s);
    nearRel(v[0], s.evalfr.value[0], 1e-9, 'evalfr re');
    nearRel(v[1], s.evalfr.value[1], 1e-9, 'evalfr im');
  });

  test(`[referência ${s.name}] margin (gm absoluta, pm em graus)`, () => {
    const m = A.margin(sys());
    const r = s.margin;
    if (r.gm === Infinity) assert.equal(m.gm, Infinity); else nearRel(m.gm, r.gm, 1e-6, 'gm');
    if (r.pm === Infinity) assert.equal(m.pm, Infinity); else near(m.pm, r.pm, 1e-6, 'pm');
    near(m.wcg, r.wcg, 1e-6 * Math.max(1, Math.abs(r.wcg || 0)), 'wcg');
    near(m.wcp, r.wcp, 1e-6 * Math.max(1, Math.abs(r.wcp || 0)), 'wcp');
  });
}

test('[referência rlocus] nao_minima_fase: raízes por ganho coincidem com numpy.roots', () => {
  const s = fx.systems.find(x => x.name === 'nao_minima_fase');
  const r = A.rlocus({ num: s.num, den: s.den }, fx.rlocus.gains);
  r.roots.forEach((rs, i) => sameSet(rs, fx.rlocus.roots[i], 1e-8, `K=${fx.rlocus.gains[i]}`));
});

test('[referência unwrap] casos do numpy.unwrap', () => {
  for (const c of fx.unwrap) {
    const u = A.unwrap(c.input, c.period);
    c.output.forEach((v, i) => near(u[i], v, 1e-12, `unwrap[${i}]`));
  }
});

/* ------------------------- entradas inválidas ------------------------- */

test('entradas inválidas: TypeError para tipos e RangeError para valores', () => {
  const tf = { num: [1], den: [1, 1] };
  assert.throws(() => A.pole(null), TypeError);
  assert.throws(() => A.pole({ foo: 1 }), TypeError);
  assert.throws(() => A.pole({ num: [1], den: [0] }), RangeError);
  assert.throws(() => A.pole({ num: [1, 'a'], den: [1] }), TypeError);
  assert.throws(() => A.pole({ num: [1], den: [1], dt: -1 }), RangeError);
  assert.throws(() => A.tf2zpk([1], [0]), RangeError);
  assert.throws(() => A.tf2zpk([1], []), RangeError);
  assert.throws(() => A.freqresp(tf, 'a'), TypeError);
  assert.throws(() => A.freqresp(tf, []), RangeError);
  assert.throws(() => A.freqresp(tf, [NaN]), RangeError);
  assert.throws(() => A.freqresp(tf, [1], -1), RangeError);
  assert.throws(() => A.freqresp(tf, [1], 'x'), TypeError);
  assert.throws(() => A.bode(tf, [1], { deg: 'sim' }), TypeError);
  assert.throws(() => A.bode(tf, [1], null), TypeError);
  assert.throws(() => A.zpk2tf([], [], Infinity), RangeError);
  assert.throws(() => A.zpk2tf([], [], 'x'), TypeError);
  assert.throws(() => A.zpk2tf([], [[-1, 2]], 1), RangeError, 'polo complexo sem conjugado');
  assert.throws(() => A.zpk2tf([[0, 1]], [], 1), RangeError, 'zero complexo sem conjugado');
  assert.throws(() => A.zpk2ss([[0, 0], [1, 0]], [], 1), RangeError, 'imprópria');
  assert.throws(() => A.ss2zpk([[1, 2]], [[1]], [[1]], 0), RangeError, 'A não quadrada');
  assert.throws(() => A.margin({ num: [1], den: [0] }), RangeError);
  assert.throws(() => A.minreal(tf, -1), RangeError);
  assert.throws(() => A.minreal(tf, 'x'), TypeError);
  assert.throws(() => A.rlocus(tf, []), RangeError);
  assert.throws(() => A.rlocus({ num: [1, 0, 0], den: [1, 1] }, [1]), RangeError, 'impróprio');
  assert.throws(() => A.unwrap([1, 2], 0), RangeError);
  assert.throws(() => A.unwrap('abc'), TypeError);
  assert.throws(() => A.unwrap([NaN]), RangeError);
  assert.throws(() => A.mag2db(-1), RangeError);
  assert.throws(() => A.mag2db('x'), TypeError);
  assert.throws(() => A.evalfr(tf, [1]), TypeError);
  assert.throws(() => A.gangof4(tf, { num: [1], den: [1, 1], dt: 0.1 }, [1]), RangeError, 'dt diferente');
  assert.throws(() => A.damp({ num: [1], den: [1, 1], dt: -0.1 }), RangeError);
});
