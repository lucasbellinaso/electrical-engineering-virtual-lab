import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tfToSS, lsim, step, impulse, initial, stepinfo, defaultTime} from '../assets/js/core/timeresp.js';
import {c2d} from '../assets/js/core/control.js';
import {linspace} from '../assets/js/core/numeric.js';

// Fixture gerada por scripts/reference/gen_timeresp.py (NumPy 2.5.3 / SciPy 1.18.1).
const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-timeresp.json', import.meta.url), 'utf8'));
const dec = (v) => Array.isArray(v) ? v.map(dec)
  : v === 'NaN' ? NaN : v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v;

// Tolerâncias (absolutas), com justificativa:
const TOL = {
  tf: 1e-12,        // tfToSS = control.tf2ss; mesma forma companheira que scipy.tf2ss
  zoh: 1e-9,        // lsim vs SciPy: ambos ZOH exato via expm aumentada; medido ≤ 1e-13 no gerador;
                    // 1e-9 cobre diferenças de expm (Padé(6) vs SciPy) acumuladas em 100 passos
  discrete: 1e-12,  // recorrência idêntica à de scipy.dlsim (mesma aritmética)
  c2d: 1e-12,       // Ad, Bd de c2d vs scipy.cont2discrete(zoh)
  analytic: 1e-9,   // fórmulas fechadas vs expm; erro de expm de ordem 1e-12 nestes casos
  exact: 1e-12,     // casos em que a resposta é exata (integrador, constante)
  stepinfo: 1e-12,  // mesma entrada y do fixture; só diferenças de aritmética de ponto flutuante
};

const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);
const sameNum = (a, b, tol, msg = '') => {
  if (Number.isNaN(b)) return assert.ok(Number.isNaN(a), `${msg} esperado NaN, obtido ${a}`);
  return near(a, b, tol, msg);
};
const flatY = (y) => y.flatMap((v) => (Array.isArray(v) ? v : [v]));
const maxDiff = (a, b) => {
  assert.equal(a.length, b.length, 'comprimentos diferentes');
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};
const sysOf = (key) => {
  const s = FIX.systems[key];
  return { A: s.A, B: s.B, C: s.C, D: s.D, dt: s.dt };
};
const gridOf = () => Array.from({ length: FIX.grid.N }, (_, k) => k * FIX.grid.h);

// Entradas: mesmas fórmulas de scripts/reference/gen_timeresp.py (aritmética na mesma ordem).
function makeInput(spec, N, h) {
  const idx = Array.from({ length: N }, (_, i) => i);
  switch (spec.type) {
    case 'step': return idx.map(() => spec.amp);
    case 'ramp': return idx.map((i) => spec.slope * (i * h));
    case 'sine': return idx.map((i) => spec.amp * Math.sin(2 * Math.PI * spec.freq * (i * h)));
    case 'pulse': return idx.map((i) => (i >= spec.k0 && i < spec.k1 ? spec.amp : 0));
    default: throw new Error(`entrada desconhecida: ${spec.type}`);
  }
}

/* ------------------------- tfToSS ------------------------- */

test('tfToSS reproduz scipy.signal.tf2ss para todos os sistemas da fixture', () => {
  for (const key of ['first_order', 'second_under', 'third_order', 'with_feedthrough', 'discrete_second']) {
    const ref = FIX.systems[key];
    const ss = tfToSS(ref.num, ref.den, ref.dt);
    assert.equal(ss.dt, ref.dt, key);
    assert.ok(maxDiff(ss.A.flat(), ref.A.flat()) <= TOL.tf, `A ${key}`);
    assert.ok(maxDiff(ss.B.flat(), ref.B.flat()) <= TOL.tf, `B ${key}`);
    assert.ok(maxDiff(ss.C.flat(), ref.C.flat()) <= TOL.tf, `C ${key}`);
    near(ss.D, ref.D[0][0], TOL.tf, `D ${key}`);
  }
});

test('tfToSS rejeita entradas inválidas', () => {
  assert.throws(() => tfToSS([1, 0, 0], [1, 1]), RangeError, 'função imprópria');
  assert.throws(() => tfToSS([1], []), RangeError, 'denominador vazio');
  assert.throws(() => tfToSS([1], [0, 0]), RangeError, 'denominador nulo');
  assert.throws(() => tfToSS('1', [1, 1]), TypeError, 'numerador não array');
  assert.throws(() => tfToSS([1], [1, 1], -0.1), RangeError, 'dt negativo');
  assert.throws(() => tfToSS([1], [1, 1], '0.1'), TypeError, 'dt não numérico');
});

/* ------------------------- analíticos (independentes do Python) ------------------------- */

test('degrau de 1/(s+1) = 1 - e^{-t} (ZOH é exato para entrada constante)', () => {
  const s = tfToSS([1], [1, 1]);
  const t = linspace(0, 5, 251);
  const r = lsim(s, t.map(() => 1), t);
  for (let k = 0; k < t.length; k++) near(r.y[k], 1 - Math.exp(-t[k]), TOL.analytic, `k=${k}`);
});

test('step() coincide com lsim() de entrada unitária', () => {
  const s = tfToSS([2], [1, 3]);
  const t = linspace(0, 4, 201);
  const a = step(s, t);
  const b = lsim(s, t.map(() => 1), t);
  assert.ok(maxDiff(a.y, b.y) <= 1e-12);
});

test('impulso de 1/(s+1) = e^{-t}, com y(0+) = C·B = 1', () => {
  const s = tfToSS([1], [1, 1]);
  const t = linspace(0, 5, 251);
  const r = impulse(s, t);
  near(r.y[0], 1, TOL.analytic, 'y(0)');
  for (let k = 1; k < t.length; k++) near(r.y[k], Math.exp(-t[k]), TOL.analytic, `k=${k}`);
});

test('degrau de wn²/(s²+2ζwn s+wn²) segue a forma fechada (ζ=0.3, wn=2)', () => {
  const zeta = 0.3, wn = 2, wd = wn * Math.sqrt(1 - zeta * zeta);
  const yRef = (t) => 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
  const s = tfToSS([4], [1, 1.2, 4]);
  const t = linspace(0, 10, 501);
  const r = step(s, t);
  for (let k = 0; k < t.length; k++) near(r.y[k], yRef(t[k]), TOL.analytic, `k=${k}`);
});

test('initial de integrador 1/s: y(t) = x0 para todo t', () => {
  const s = tfToSS([1], [1, 0]);
  const t = linspace(0, 3, 31);
  const r = initial(s, [2], t);
  for (const v of r.y) near(v, 2, TOL.exact);
  assert.deepEqual(r.x[0], [2]);
});

test('discreto: impulso de 1/(z-0.5) = sequência 0, 1, 0.5, 0.25, ...', () => {
  const s = tfToSS([1], [1, -0.5], 0.1);
  const t = Array.from({ length: 11 }, (_, k) => k * 0.1);
  const r = impulse(s, t);
  assert.equal(r.y[0], 0);
  for (let k = 1; k < 11; k++) near(r.y[k], 0.5 ** (k - 1), TOL.exact, `k=${k}`);
});

test('discreto: degrau de 1/(z-0.5) = 2(1 - 0.5^k)', () => {
  const s = tfToSS([1], [1, -0.5], 0.1);
  const t = Array.from({ length: 11 }, (_, k) => k * 0.1);
  const r = step(s, t);
  for (let k = 0; k < 11; k++) near(r.y[k], 2 * (1 - 0.5 ** k), TOL.exact, `k=${k}`);
});

/* ------------------------- comparação com SciPy (fixture) ------------------------- */

for (const run of FIX.lsim) {
  test(`lsim ${run.id} coincide com SciPy (ZOH / dlsim)`, () => {
    const sys = sysOf(run.system);
    const t = gridOf();
    const u = run.inputs.length === 1
      ? makeInput(run.inputs[0], FIX.grid.N, FIX.grid.h)
      : t.map((_, k) => run.inputs.map((sp) => makeInput(sp, FIX.grid.N, FIX.grid.h)[k]));
    const x0 = run.x0 ? dec(run.x0) : 0;
    const r = lsim(sys, u, t, x0);
    const tol = sys.dt > 0 ? TOL.discrete : TOL.zoh;
    const ref = flatY(dec(run.y));
    const got = flatY(r.y);
    assert.ok(maxDiff(got, ref) <= tol, `divergência máxima ${maxDiff(got, ref)} > ${tol}`);
    assert.equal(r.x.length, FIX.grid.N);
    assert.equal(r.x[0].length, sys.A.length);
  });
}

for (const imp of FIX.impulse) {
  test(`impulse ${imp.id} coincide com referência SciPy`, () => {
    const sys = sysOf(imp.system);
    const r = impulse(sys, gridOf(), imp.input);
    const tol = sys.dt > 0 ? TOL.discrete : TOL.zoh;
    assert.ok(maxDiff(flatY(r.y), flatY(dec(imp.y))) <= tol);
  });
}

test('initial second_under coincide com scipy.lsim(U=0)', () => {
  const ref = FIX.initial[0];
  const r = initial(sysOf(ref.system), dec(ref.x0), gridOf());
  assert.ok(maxDiff(r.y, dec(ref.y)) <= TOL.zoh);
});

for (const d of FIX.discretization) {
  test(`c2d ${d.id} coincide com scipy.cont2discrete(zoh)`, () => {
    const sys = sysOf(d.system);
    const { Ad, Bd } = c2d(sys.A, sys.B, d.h);
    assert.ok(maxDiff(Ad.flat(), dec(d.Ad).flat()) <= TOL.c2d);
    assert.ok(maxDiff(Bd.flat(), dec(d.Bd).flat()) <= TOL.c2d);
  });
}

for (const si of FIX.stepinfo) {
  test(`stepinfo ${si.run} coincide com a definição de control.step_info`, () => {
    const run = FIX.lsim.find((r) => r.id === si.run);
    const y = dec(run.y);
    const e = dec(si.expected);
    const r = stepinfo(flatY(y), gridOf());
    for (const key of Object.keys(e)) sameNum(r[key], e[key], TOL.stepinfo, `${key}`);
  });
}

/* ------------------------- stepinfo analítico ------------------------- */

test('stepinfo de 1ª ordem: riseTime ≈ ln9·τ, settling 2% ≈ ln50·τ (τ = 1)', () => {
  const h = 1e-3;
  const t = Array.from({ length: 10001 }, (_, k) => k * h);
  const y = t.map((v) => 1 - Math.exp(-v));
  const r = stepinfo(y, t, 1);
  // Índices inteiros: erro máximo de uma amostra em cada instante (2h de folga).
  near(r.riseTime, Math.log(9), 2 * h, 'riseTime');
  near(r.settlingTime, Math.log(50), 2 * h, 'settlingTime');
  near(r.overshoot, 0, TOL.exact, 'overshoot');
  near(r.undershoot, 0, TOL.exact, 'undershoot');
  near(r.steadyStateValue, 1, TOL.exact, 'yfinal');
});

test('stepinfo de 2ª ordem subamortecida: overshoot = 100·exp(-πζ/√(1-ζ²)) e tp = π/wd', () => {
  const zeta = 0.3, wn = 2, wd = wn * Math.sqrt(1 - zeta * zeta);
  const h = 1e-3;
  const t = Array.from({ length: 10001 }, (_, k) => k * h);
  const y = t.map((v) => 1 - Math.exp(-zeta * wn * v) * (Math.cos(wd * v) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * v)));
  const r = stepinfo(y, t, 1);
  const mp = 100 * Math.exp(-Math.PI * zeta / Math.sqrt(1 - zeta * zeta));
  near(r.overshoot, mp, 1e-2, 'overshoot (pontos percentuais)');
  near(r.peakTime, Math.PI / wd, 2 * h, 'peakTime');
});

test('stepinfo usa a última amostra como yfinal por padrão', () => {
  const t = [0, 1, 2, 3, 4];
  const y = [0, 0.5, 1, 1, 1];
  const r = stepinfo(y, t);
  near(r.steadyStateValue, 1, 0, 'steadyStateValue');
  near(r.riseTime, 1, 0, 'riseTime (0.1→0.9 cai entre t=1 e t=2)');
});

/* ------------------------- formato e grade ------------------------- */

test('SISO devolve y escalar; MIMO devolve array de p saídas; x tem n estados', () => {
  const siso = step(tfToSS([1], [1, 1]), linspace(0, 1, 5));
  assert.equal(typeof siso.y[0], 'number');
  assert.equal(siso.x[0].length, 1);
  const mimo = step(sysOf('mimo'), linspace(0, 1, 5), 0);
  assert.equal(mimo.y[0].length, 2);
  assert.equal(mimo.x[0].length, 2);
  // D e_0 = [0, 0.2] (D[1][0] = 0.2), com x0 = 0
  assert.deepEqual(mimo.y[0], [0, 0.2]);
});

test('defaultTime contínuo: 501 pontos em [0, 5τ] com τ = 1/3 para polo em -3', () => {
  const t = defaultTime(tfToSS([2], [1, 3]));
  assert.equal(t.length, 501);
  near(t[0], 0, TOL.exact);
  near(t[500], 5 / 3, TOL.exact, 'último instante');
});

test('defaultTime discreto: t_k = k·dt com K = 10 (mínimo) para polo em 0.5', () => {
  const t = defaultTime(tfToSS([1], [1, -0.5], 0.1));
  assert.equal(t.length, 11);
  near(t[10], 1.0, 1e-12);
});

test('lsim com x0 omitido equivale a x0 nulo', () => {
  const s = tfToSS([9], [1, 1.2, 9]);
  const t = linspace(0, 3, 31);
  const u = t.map(() => 1);
  assert.deepEqual(lsim(s, u, t).y, lsim(s, u, t, 0).y);
});

/* ------------------------- entradas inválidas ------------------------- */

test('sistema inválido: TypeError/RangeError', () => {
  const ok = { A: [[-1]], B: [[1]], C: [[1]], D: [[0]] };
  assert.throws(() => lsim(null, [1, 1], [0, 1]), TypeError);
  assert.throws(() => lsim({ ...ok, A: [[-1, 0]] }, [1, 1], [0, 1]), RangeError, 'A não quadrada');
  assert.throws(() => lsim({ ...ok, B: [[1], [1]] }, [1, 1], [0, 1]), RangeError, 'B com linhas erradas');
  assert.throws(() => lsim({ ...ok, A: [[NaN]] }, [1, 1], [0, 1]), RangeError, 'A não finita');
  assert.throws(() => lsim({ ...ok, A: [['-1']] }, [1, 1], [0, 1]), TypeError, 'A não numérica');
  assert.throws(() => lsim({ ...ok, C: [[1, 1]] }, [1, 1], [0, 1]), RangeError, 'C com colunas erradas');
  assert.throws(() => lsim({ ...ok, D: [[0, 0]] }, [1, 1], [0, 1]), RangeError, 'D com dimensão errada');
  assert.throws(() => lsim({ ...ok, dt: -1 }, [1, 1], [0, 1]), RangeError, 'dt negativo');
  assert.throws(() => lsim({ ...ok, dt: 'x' }, [1, 1], [0, 1]), TypeError, 'dt não numérico');
});

test('tempo inválido: passo não uniforme, decrescente, único ou ausente', () => {
  const s = tfToSS([1], [1, 1]);
  assert.throws(() => lsim(s, [1, 1, 1], [0, 0.1, 0.3]), RangeError, 'passo não uniforme');
  assert.throws(() => lsim(s, [1, 1], [1, 0]), RangeError, 'decrescente');
  assert.throws(() => lsim(s, [1], [0]), RangeError, 'uma amostra');
  assert.throws(() => lsim(s, [1, 1], undefined), TypeError, 't obrigatório em lsim');
  assert.throws(() => lsim(s, [1, 1], [0, NaN]), RangeError, 't não finito');
});

test('discreto: t com passo diferente de dt é rejeitado', () => {
  const s = tfToSS([1], [1, -0.5], 0.1);
  assert.throws(() => lsim(s, [1, 1, 1], [0, 0.2, 0.4]), RangeError);
});

test('entradas u e x0 inválidas', () => {
  const s = tfToSS([1], [1, 1]);
  const t = [0, 0.1, 0.2];
  assert.throws(() => lsim(s, [1, 1], t), RangeError, 'número de amostras');
  assert.throws(() => lsim(s, [1, 'a', 1], t), TypeError, 'amostra não numérica');
  assert.throws(() => lsim(s, 1, t), TypeError, 'u não array');
  assert.throws(() => lsim(s, [1, 1, 1], t, 2), TypeError, 'x0 escalar não nulo');
  assert.throws(() => lsim(s, [1, 1, 1], t, [1, 2]), RangeError, 'x0 com tamanho errado');
  assert.throws(() => initial(s, undefined, t), TypeError, 'initial sem x0');
});

test('canal de entrada fora da faixa ou não inteiro', () => {
  const s = sysOf('mimo');
  assert.throws(() => step(s, linspace(0, 1, 3), 2), RangeError);
  assert.throws(() => impulse(s, linspace(0, 1, 3), 0.5), TypeError);
});

test('stepinfo rejeita entradas inválidas', () => {
  const t = [0, 1, 2];
  assert.throws(() => stepinfo([0, 1], t), RangeError, 'comprimentos diferentes');
  assert.throws(() => stepinfo([0], [0]), RangeError, 'amostra única');
  assert.throws(() => stepinfo([0, 1, 1], t, 0), RangeError, 'yfinal nulo');
  assert.throws(() => stepinfo([0, 1, 1], [0, 1, 1]), RangeError, 't não crescente');
  assert.throws(() => stepinfo([0, 1, 1], t, 1, 0), RangeError, 'settlingPct nulo');
  assert.throws(() => stepinfo([0, 1, 1], t, 1, 2, [0.9, 0.1]), RangeError, 'riseLimits invertidos');
  assert.throws(() => stepinfo([0, 1, 1], t, 1, 2, [0.1]), TypeError, 'riseLimits incompleto');
});

test('funções não alteram o sistema de entrada', () => {
  const s = tfToSS([1, 3], [1, 2]);
  const before = JSON.stringify(s);
  step(s, linspace(0, 1, 5));
  impulse(s, linspace(0, 1, 5));
  lsim(s, linspace(0, 1, 5).map(() => 1), linspace(0, 1, 5));
  assert.equal(JSON.stringify(s), before);
});
