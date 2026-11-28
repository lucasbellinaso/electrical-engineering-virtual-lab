import test from 'node:test';
import assert from 'node:assert/strict';
import {ode45, ode23} from '../assets/js/core/ode.js';

// Sem Octave/SciPy: todas as referências são soluções analíticas.
// Tolerância de erro global: o controle de passo limita o erro LOCAL (≈ RelTol·|y| + AbsTol por passo);
// o erro global acumulado fica de 1 a 2 ordens abaixo/acima conforme o método. Os limites abaixo foram
// medidos e arredondados com folga ≈ 3×; o que se afirma de forma estrutural é que o erro DIMINUI ao apertar a tolerância.
const maxErr = (r, exata) => r.t.reduce((m, t, k) => Math.max(m, Math.abs(r.y[k][0] - exata(t))), 0);
const solvers = [['ode45', ode45], ['ode23', ode23]];

for (const [nome, ode] of solvers) {
  test(`${nome}: y' = −y, y(0)=1 em [0, 5]; erro diminui com a tolerância`, () => {
    const exata = (t) => Math.exp(-t);
    const casos = [[1e-3, 1e-6], [1e-6, 1e-9], [1e-9, 1e-12]];
    const erros = casos.map(([rel, abs]) => {
      const r = ode((t, y) => [-y[0]], [0, 5], [1], {RelTol: rel, AbsTol: abs});
      assert.equal(r.t[0], 0); assert.equal(r.t.at(-1), 5);
      assert.equal(r.t.length, r.y.length);
      assert.ok(r.stats.nsteps > 0 && r.stats.nfevals > 0 && r.stats.nfailed >= 0);
      const e = maxErr(r, exata);
      assert.ok(e <= 20 * (rel + abs), `${nome} RelTol ${rel}: erro ${e}`);   // global ≲ 20×tolerância local
      return e;
    });
    assert.ok(erros[1] < erros[0] / 10 && erros[2] < erros[1] / 10, `erros não decrescem: ${erros}`);
  });

  test(`${nome}: y0 escalar e f devolvendo número`, () => {
    const r = ode((t, y) => -2 * y[0], [0, 1], 3, {RelTol: 1e-8, AbsTol: 1e-10});
    assert.ok(Array.isArray(r.y[0]) && r.y[0].length === 1);
    assert.ok(Math.abs(r.y.at(-1)[0] - 3 * Math.exp(-2)) < 1e-6);
  });

  test(`${nome}: oscilador harmônico (2 estados), cos/sin e energia`, () => {
    const r = ode((t, y) => [y[1], -y[0]], [0, 10], [1, 0], {RelTol: 1e-8, AbsTol: 1e-10});
    let e = 0, dE = 0;
    r.t.forEach((t, k) => {
      e = Math.max(e, Math.abs(r.y[k][0] - Math.cos(t)), Math.abs(r.y[k][1] + Math.sin(t)));
      dE = Math.max(dE, Math.abs(0.5 * (r.y[k][0] ** 2 + r.y[k][1] ** 2) - 0.5));
    });
    assert.ok(e < 1e-6, `erro ${e}`);
    assert.ok(dE < 1e-6, `deriva de energia ${dE}`);
  });

  test(`${nome}: circuito RC com degrau`, () => {
    const R = 1e3, C = 1e-6, V = 5, tau = R * C;
    const r = ode((t, y) => [(V - y[0]) / tau], [0, 5 * tau], [0], {RelTol: 1e-6, AbsTol: 1e-9});
    const e = maxErr(r, (t) => V * (1 - Math.exp(-t / tau)));
    assert.ok(e < 1e-4, `erro ${e} V`);
  });

  test(`${nome}: RLC série subamortecido`, () => {
    const R = 20, L = 1e-3, C = 1e-6, V = 10;
    const a = R / (2 * L), w0 = 1 / Math.sqrt(L * C), wd = Math.sqrt(w0 * w0 - a * a);
    const vc = (t) => V * (1 - Math.exp(-a * t) * (Math.cos(wd * t) + a / wd * Math.sin(wd * t)));
    const ic = (t) => (V / (wd * L)) * Math.exp(-a * t) * Math.sin(wd * t);
    const r = ode((t, y) => [(V - R * y[0] - y[1]) / L, y[0] / C], [0, 1e-3], [0, 0],
      {RelTol: 1e-7, AbsTol: [1e-10, 1e-8]});
    let ev = 0, ei = 0;
    r.t.forEach((t, k) => { ev = Math.max(ev, Math.abs(r.y[k][1] - vc(t))); ei = Math.max(ei, Math.abs(r.y[k][0] - ic(t))); });
    assert.ok(ev < 1e-4, `erro vc ${ev} V`);
    assert.ok(ei < 1e-6, `erro i ${ei} A`);
  });

  test(`${nome}: problema moderadamente rígido y' = −50(y − cos t) termina e respeita a tolerância`, () => {
    // solução: y = (2500 cos t + 50 sin t)/2501 + (y0 − 2500/2501) e^{−50 t}
    const y0 = 0;
    const exata = (t) => (2500 * Math.cos(t) + 50 * Math.sin(t)) / 2501 + (y0 - 2500 / 2501) * Math.exp(-50 * t);
    const r = ode((t, y) => [-50 * (y[0] - Math.cos(t))], [0, 5], [y0], {RelTol: 1e-6, AbsTol: 1e-9});
    assert.ok(maxErr(r, exata) < 1e-4, `erro ${maxErr(r, exata)}`);
    assert.equal(r.t.at(-1), 5);
  });

  test(`${nome}: tspan com vários pontos devolve exatamente esses instantes`, () => {
    const ts = [0, 0.1, 0.35, 1, 2.5, 4];
    const r = ode((t, y) => [-y[0]], ts, [1], {RelTol: 1e-8, AbsTol: 1e-10});
    assert.deepEqual(r.t, ts);
    assert.equal(r.y.length, ts.length);
    assert.equal(r.y[0][0], 1);
    assert.ok(maxErr(r, (t) => Math.exp(-t)) < 1e-6);
  });

  test(`${nome}: integração para trás (tf < t0), com tspan de 2 e de vários elementos`, () => {
    const r = ode((t, y) => [-y[0]], [5, 0], [Math.exp(-5)], {RelTol: 1e-8, AbsTol: 1e-12});
    assert.equal(r.t[0], 5); assert.equal(r.t.at(-1), 0);
    assert.ok(r.t.every((t, k) => k === 0 || t < r.t[k - 1]));
    assert.ok(Math.abs(r.y.at(-1)[0] - 1) < 1e-5);
    const ts = [5, 3.3, 1, 0];
    const q = ode((t, y) => [-y[0]], ts, [Math.exp(-5)], {RelTol: 1e-8, AbsTol: 1e-12});
    assert.deepEqual(q.t, ts);
    assert.ok(maxErr(q, (t) => Math.exp(-t)) < 1e-5);
  });

  test(`${nome}: Refine controla o número de pontos; MaxStep e InitialStep são respeitados`, () => {
    const f = (t, y) => [-y[0]];
    const a = ode(f, [0, 5], [1], {Refine: 1}), b = ode(f, [0, 5], [1], {Refine: 3});
    assert.equal(a.t.length, a.stats.nsteps + 1);
    assert.equal(b.t.length, 3 * b.stats.nsteps + 1);
    const c = ode(f, [0, 5], [1], {MaxStep: 0.01, Refine: 1});
    const maxh = c.t.reduce((m, t, k) => (k ? Math.max(m, t - c.t[k - 1]) : m), 0);
    assert.ok(maxh <= 0.01 * (1 + 1e-9));
    const d = ode(f, [0, 5], [1], {InitialStep: 1e-4, Refine: 1});
    assert.ok(Math.abs(d.t[1] - 1e-4) < 1e-15);
  });

  test(`${nome}: AbsTol vetorial e f(t) pura no tempo (integral de sin)`, () => {
    const r = ode((t) => [Math.sin(t), Math.cos(t)], [0, Math.PI], [0, 0], {RelTol: 1e-8, AbsTol: [1e-10, 1e-10]});
    assert.ok(Math.abs(r.y.at(-1)[0] - 2) < 1e-6);
    assert.ok(Math.abs(r.y.at(-1)[1]) < 1e-6);
  });

  test(`${nome}: falha de integração (singularidade em tempo finito) lança Error com o instante`, () => {
    // y' = y², y(0)=1 explode em t = 1
    assert.throws(() => ode((t, y) => [y[0] * y[0]], [0, 2], [1], {RelTol: 1e-6}), /falha de integração em t = 1\.0/);
  });

  test(`${nome}: entradas inválidas`, () => {
    const f = (t, y) => [-y[0]];
    assert.throws(() => ode('x', [0, 1], [1]), TypeError);
    assert.throws(() => ode(f, 'x', [1]), TypeError);
    assert.throws(() => ode(f, [0], [1]), RangeError);
    assert.throws(() => ode(f, [0, 0], [1]), RangeError);
    assert.throws(() => ode(f, [0, 2, 1], [1]), RangeError);
    assert.throws(() => ode(f, [0, NaN], [1]), RangeError);
    assert.throws(() => ode(f, ['0', 1], [1]), TypeError);
    assert.throws(() => ode(f, [0, 1], []), RangeError);
    assert.throws(() => ode(f, [0, 1], 'a'), TypeError);
    assert.throws(() => ode(f, [0, 1], [NaN]), RangeError);
    assert.throws(() => ode(f, [0, 1], [1], {RelTol: 0}), RangeError);
    assert.throws(() => ode(f, [0, 1], [1], {AbsTol: [1, 2]}), RangeError);
    assert.throws(() => ode(f, [0, 1], [1], {AbsTol: -1}), RangeError);
    assert.throws(() => ode(f, [0, 1], [1], {InitialStep: -1}), RangeError);
    assert.throws(() => ode(f, [0, 1], [1], {MaxStep: 0}), RangeError);
    assert.throws(() => ode(f, [0, 1], [1], {Refine: 0.5}), RangeError);
    assert.throws(() => ode(f, [0, 1], [1], {Events: () => 0}), /Events/);
    assert.throws(() => ode(() => [1, 2], [0, 1], [1]), RangeError);   // dimensão de f
    assert.throws(() => ode(() => 'a', [0, 1], [1]), TypeError);
    assert.throws(() => ode(() => [NaN], [0, 1], [1]), RangeError);    // f(t0, y0) não finita
  });
}

test('f recebe cópia de y (alterá-la não corrompe a integração)', () => {
  const r = ode45((t, y) => { const d = [-y[0]]; y[0] = 1e9; return d; }, [0, 1], [1], {RelTol: 1e-8, AbsTol: 1e-10});
  assert.ok(Math.abs(r.y.at(-1)[0] - Math.exp(-1)) < 1e-6);
});

test('ode45 é mais eficiente que ode23 em tolerância apertada (nfevals)', () => {
  const f = (t, y) => [y[1], -y[0]];
  const a = ode45(f, [0, 10], [1, 0], {RelTol: 1e-8, AbsTol: 1e-10});
  const b = ode23(f, [0, 10], [1, 0], {RelTol: 1e-8, AbsTol: 1e-10});
  assert.ok(a.stats.nfevals < b.stats.nfevals, `${a.stats.nfevals} vs ${b.stats.nfevals}`);
});

test('interpolação contínua do ode45 é de ordem 4: erro em pontos intermediários coerente', () => {
  const r = ode45((t, y) => [-y[0]], [0, 5], [1], {RelTol: 1e-8, AbsTol: 1e-12, Refine: 4});
  assert.ok(maxErr(r, (t) => Math.exp(-t)) < 1e-6);
});
