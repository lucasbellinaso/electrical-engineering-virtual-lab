import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {d2c, c2d, ss2tf} from '../assets/js/core/control.js';
import {logm, expm} from '../assets/js/core/matrix.js';

// Fixture gerada por scripts/reference/gen_d2c.py. Referência = d2c do autor (python-control não tem d2c),
// validada no gerador por c2d(d2c(sys)) = sys (ZOH) e FT recuperada = FT do protótipo (Tustin).
const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-d2c.json', import.meta.url), 'utf8'));

// Tolerâncias (absolutas), com justificativa:
const TOL = {
  logm: 1e-10,    // logm vs scipy.linalg.logm; medido ~1e-14 (raízes quadradas + série, 2^(k+1) amplifica o erro)
  ss: 1e-9,       // A,B,C,D vs referência Python; erro medido ≤ 1e-12 (logm/expm/solve em dupla precisão)
  tf: 1e-8,       // coeficientes de num/den após ss2tf (Faddeev–LeVerrier amplifica um pouco o erro)
  roundtrip: 1e-9 // c2d(d2c(sys)) vs sys
};

const flat = (M) => M.flat();
const maxDiff = (a, b) => {
  const x = flat(a), y = flat(b);
  assert.equal(x.length, y.length, 'tamanhos diferentes');
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i]));
  return m;
};
const asMat = (D) => (Array.isArray(D) ? D : [[D]]);
// remove coeficientes líderes desprezíveis (ruído de ponto flutuante) para comparar polinômios
const trim = (p) => { const m = Math.max(...p.map(Math.abs)); const i = p.findIndex((c) => Math.abs(c) > 1e-9 * m); return p.slice(i); };
const samePoly = (a, b, tol, msg) => {
  const x = trim(a), y = trim(b);
  assert.equal(x.length, y.length, `${msg}: graus diferentes ${x.length} vs ${y.length}`);
  x.forEach((v, i) => assert.ok(Math.abs(v - y[i]) <= tol, `${msg}[${i}]: ${v} vs ${y[i]}`));
};
const norm = (t) => ({ num: trim(t.num).map((c) => c / trim(t.den)[0]), den: trim(t.den).map((c) => c / trim(t.den)[0]) });
const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);

/* ------------------------- logm ------------------------- */

for (const c of FIX.logm) {
  test(`logm ${c.id} coincide com scipy.linalg.logm`, () => {
    assert.ok(maxDiff(logm(c.A), c.expected) <= TOL.logm);
  });
}

test('logm: expm(logm(A)) = A e logm(expm(L)) = L para L pequeno', () => {
  const A = [[2, 1, 0], [0.5, 3, 1], [0, 0.2, 1.5]];
  assert.ok(maxDiff(expm(logm(A)), A) <= 1e-12);
  const L = [[-1, 2, 0], [0, -3, 1], [0.5, 0, -2]];
  assert.ok(maxDiff(logm(expm(L)), L) <= 1e-11);
});

test('logm analítico: rotação de θ → [[0,−θ],[θ,0]]; identidade → 0; matriz vazia → []', () => {
  const th = 1.1;
  const R = [[Math.cos(th), -Math.sin(th)], [Math.sin(th), Math.cos(th)]];
  assert.ok(maxDiff(logm(R), [[0, -th], [th, 0]]) <= 1e-12);
  assert.deepEqual(logm([[1, 0], [0, 1]]), [[0, 0], [0, 0]]);
  assert.deepEqual(logm([]), []);
});

test('logm: autovalor real ≤ 0, singular, não quadrada e não finita lançam erro', () => {
  assert.throws(() => logm([[-1]]), RangeError, 'autovalor −1');
  assert.throws(() => logm([[0]]), RangeError, 'singular');
  assert.throws(() => logm([[-1, 0], [0, 2]]), RangeError, 'autovalor negativo misto');
  assert.throws(() => logm([[-1, 0], [0, -1]]), RangeError, '−I (autovalor −1 duplo)');
  assert.throws(() => logm([[1, 2, 3], [4, 5, 6]]), RangeError, 'não quadrada');
  assert.throws(() => logm([[NaN]]), RangeError, 'NaN');
  assert.throws(() => logm('x'), TypeError, 'tipo');
});

/* ------------------------- d2c (espaço de estados) ------------------------- */

const sysOf = (c) => ({ A: c.disc.A, B: c.disc.B, C: c.disc.C, D: c.disc.D, dt: c.Ts });
const siso = (S) => S.A.length >= 1 && S.B[0].length === 1 && S.C.length === 1;

for (const c of FIX.zoh_ss) {
  test(`d2c zoh ${c.id} coincide com a referência (${c.referencia}) e recupera o protótipo`, () => {
    const r = d2c(sysOf(c), 'zoh');
    assert.equal(r.dt, 0);
    for (const k of ['A', 'B', 'C']) assert.ok(maxDiff(r[k], c.expected[k]) <= TOL.ss, `${k}`);
    assert.ok(maxDiff(asMat(r.D), c.expected.D) <= TOL.ss, 'D');
    for (const k of ['A', 'B', 'C']) assert.ok(maxDiff(r[k], c.proto[k]) <= TOL.ss, `protótipo ${k}`);
  });
  test(`d2c zoh ${c.id}: c2d(d2c(sys)) devolve o sistema discreto`, () => {
    const r = d2c(sysOf(c), 'zoh');
    const { Ad, Bd } = c2d(r.A, r.B, c.Ts);
    assert.ok(maxDiff(Ad, c.disc.A) <= TOL.roundtrip, 'Ad');
    assert.ok(maxDiff(Bd, c.disc.B) <= TOL.roundtrip, 'Bd');
  });
}

for (const c of FIX.tustin_ss) {
  test(`d2c tustin ${c.id} coincide com a referência`, () => {
    const r = d2c(sysOf(c), 'tustin');
    for (const k of ['A', 'B', 'C']) assert.ok(maxDiff(r[k], c.expected[k]) <= TOL.ss, `${k}`);
    assert.ok(maxDiff(asMat(r.D), c.expected.D) <= TOL.ss, 'D');
  });
  test(`d2c tustin ${c.id}: mesma função de transferência do protótipo (SISO)`, (t) => {
    if (!siso(c.proto)) return t.skip('MIMO: sem ss2tf');
    const r = d2c(sysOf(c), 'tustin');
    const a = norm(ss2tf(r.A, r.B, r.C, r.D)), b = norm(ss2tf(c.proto.A, c.proto.B, c.proto.C, asMat(c.proto.D)[0][0]));
    samePoly(a.num, b.num, TOL.tf, 'num'); samePoly(a.den, b.den, TOL.tf, 'den');
  });
}

/* ------------------------- d2c (função de transferência) ------------------------- */

for (const method of ['zoh', 'tustin']) {
  for (const c of FIX[`${method}_tf`]) {
    test(`d2c ${method} ${c.id} coincide com a referência e recupera a FT do protótipo`, () => {
      const r = d2c({ num: c.disc.num, den: c.disc.den, dt: c.Ts }, method);
      assert.equal(r.dt, 0);
      const n = norm(r);
      samePoly(n.num, c.expected.num, TOL.tf, 'num'); samePoly(n.den, c.expected.den, TOL.tf, 'den');
      samePoly(n.num, c.proto.num, TOL.tf, 'num protótipo'); samePoly(n.den, c.proto.den, TOL.tf, 'den protótipo');
    });
  }
}

/* ------------------------- casos analíticos ------------------------- */

test('d2c zoh escalar: Ad = e^{−aT}, Bd = (1 − e^{−aT})·b/a → A = −a, B = b', () => {
  const a = 3, b = 2, T = 0.1, ad = Math.exp(-a * T);
  const r = d2c({ A: [[ad]], B: [[(1 - ad) * b / a]], C: [[1]], D: 0, dt: T }, 'zoh');
  near(r.A[0][0], -a, 1e-12, 'A'); near(r.B[0][0], b, 1e-12, 'B'); assert.equal(r.D, 0);
});

test('d2c zoh integrador duplo (Ad − I singular): A = [[0,1],[0,0]], B = [0,1]', () => {
  const T = 0.1;
  const r = d2c({ A: [[1, T], [0, 1]], B: [[T * T / 2], [T]], C: [[1, 0]], D: 0, dt: T }, 'zoh');
  assert.ok(maxDiff(r.A, [[0, 1], [0, 0]]) <= 1e-12, 'A');
  assert.ok(maxDiff(r.B, [[0], [1]]) <= 1e-12, 'B');
});

test('d2c tustin escalar: Ad = (1 − aT/2)/(1 + aT/2) com A = −a recupera a = 4', () => {
  const a = 4, T = 0.05, ad = (1 - a * T / 2) / (1 + a * T / 2), bd = T / (1 + a * T / 2);
  const r = d2c({ A: [[ad]], B: [[bd]], C: [[1]], D: 0, dt: T }, 'tustin');
  near(r.A[0][0], -a, 1e-12, 'A');
  const g = ss2tf(r.A, r.B, r.C, r.D);       // FT contínua 1/(s + a)
  near(g.num[g.num.length - 1] / g.den[g.den.length - 1], 1 / a, 1e-12, 'ganho DC');
});

/* ------------------------- erros ------------------------- */

test('d2c rejeita sistema contínuo, método inválido e entradas malformadas', () => {
  const ok = { A: [[0.5]], B: [[1]], C: [[1]], D: 0, dt: 0.1 };
  assert.throws(() => d2c({ ...ok, dt: 0 }), RangeError, 'dt = 0 (já contínuo)');
  assert.throws(() => d2c({ A: ok.A, B: ok.B, C: ok.C, D: 0 }), RangeError, 'sem dt');
  assert.throws(() => d2c(ok, 'foh'), RangeError, 'método');
  assert.throws(() => d2c(null), TypeError, 'sys nulo');
  assert.throws(() => d2c({ ...ok, A: [[0.5, 1]] }), RangeError, 'A não quadrada');
  assert.throws(() => d2c({ ...ok, B: [[1], [2]] }), RangeError, 'B com linhas erradas');
  assert.throws(() => d2c({ ...ok, C: [[1, 2]] }), RangeError, 'C com colunas erradas');
  assert.throws(() => d2c({ ...ok, D: [[1, 2]] }), RangeError, 'D com forma errada');
  assert.throws(() => d2c({ num: [1, 0, 0], den: [1, 1], dt: 0.1 }), RangeError, 'FT imprópria');
});

test('d2c zoh: autovalor real ≤ 0 (z = 0 ou eixo real negativo) lança RangeError', () => {
  const sys = (a) => ({ A: [[a]], B: [[1]], C: [[1]], D: 0, dt: 0.1 });
  assert.throws(() => d2c(sys(0), 'zoh'), /autovalor real/);
  assert.throws(() => d2c(sys(-0.5), 'zoh'), /autovalor real/);
});

test('d2c tustin: autovalor em z = −1 lança RangeError', () => {
  assert.throws(() => d2c({ A: [[-1]], B: [[1]], C: [[1]], D: 0, dt: 0.1 }, 'tustin'), /z = −1/);
});
