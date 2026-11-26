import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fsolve, numjac} from '../assets/js/core/solvers.js';

// Fixture gerada por scripts/reference/gen_solvers.py (scipy.optimize.root, hybr, tol 1e-14).
const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-solvers.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(FIX.problemas.map((p) => [p.id, p]));

// Tolerâncias, com justificativa:
const TOL = {
  x: 1e-9,          // x vs SciPy: Newton para em ‖F‖∞ ≤ 1e-12; erro em x ≈ ‖J⁻¹‖·1e-12, medido ≤ 1e-12 nestes casos
  jacFwd: 1e-6,     // Jacobiano por diferença avançada: erro O(√ε) ≈ 1e-8 relativo, folga para curvatura
  jacCen: 1e-8,     // diferença central: erro O(ε^(2/3)) ≈ 4e-11 relativo
  res: 1e-12,       // resíduo final pedido nos testes (tolFun)
};
const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);
const nearVec = (a, b, tol, msg = '') => { assert.equal(a.length, b.length, `${msg} tamanhos`); a.forEach((v, i) => near(v, b[i], tol, `${msg}[${i}]`)); };

// Problemas (mesmas definições do gerador), com Jacobiano analítico.
const fluxo = (() => {
  const { g, b, Pesp, Qesp } = byId.fluxo_2_barras.params;
  return {
    f: ([th, v]) => [v * (-g * Math.cos(th) + b * Math.sin(th)) + g * v * v - Pesp,
                     v * (-g * Math.sin(th) - b * Math.cos(th)) + b * v * v - Qesp],
    J: ([th, v]) => [[v * (g * Math.sin(th) + b * Math.cos(th)), -g * Math.cos(th) + b * Math.sin(th) + 2 * g * v],
                     [v * (-g * Math.cos(th) + b * Math.sin(th)), -g * Math.sin(th) - b * Math.cos(th) + 2 * b * v]],
  };
})();
const P = {
  cos_menos_x: { f: (x) => [Math.cos(x[0]) - x[0]], J: (x) => [[-Math.sin(x[0]) - 1]] },
  raiz_de_2: { f: (x) => [x[0] ** 2 - 2], J: (x) => [[2 * x[0]]] },
  matlab_exp_2x2: {
    f: (x) => [2 * x[0] - x[1] - Math.exp(-x[0]), -x[0] + 2 * x[1] - Math.exp(-x[1])],
    J: (x) => [[2 + Math.exp(-x[0]), -1], [-1, 2 + Math.exp(-x[1])]],
  },
  circulo_hiperbole: { f: (x) => [x[0] ** 2 + x[1] ** 2 - 4, x[0] * x[1] - 1], J: (x) => [[2 * x[0], 2 * x[1]], [x[1], x[0]]] },
  rosenbrock_sistema: { f: (x) => [10 * (x[1] - x[0] ** 2), 1 - x[0]], J: (x) => [[-20 * x[0], 10], [-1, 0]] },
  tres_equacoes: {
    f: ([x, y, z]) => [x + y + z - 6, x * y + y * z + z * x - 11, x * y * z - 6],
    J: ([x, y, z]) => [[1, 1, 1], [y + z, x + z, x + y], [y * z, x * z, x * y]],
  },
  fluxo_2_barras: fluxo,
};
const expected = (id) => { const e = byId[id].expected; return e; };
const sorted = (x, id) => (byId[id].ordenar ? x.slice().sort((a, b) => a - b) : x);

/* ------------------------- contra SciPy ------------------------- */

for (const id of Object.keys(P)) {
  const fx = byId[id];
  for (const [rotulo, opt] of [
    ['Jacobiano analítico', { jacobian: P[id].J }],
    ['diferenças finitas (forward)', {}],
    ['diferenças finitas (central)', { diffType: 'central' }],
  ]) {
    test(`fsolve ${id} (${rotulo}) coincide com scipy.optimize.root`, () => {
      const r = fsolve(P[id].f, fx.x0, { tolFun: TOL.res, ...opt });
      assert.equal(r.exitflag, 1, `exitflag ${r.exitflag}: ${r.output.message}`);
      nearVec(sorted(r.x, id), expected(id), TOL.x, 'x');
      assert.ok(Math.max(...r.fval.map(Math.abs)) <= TOL.res, 'resíduo');
      assert.equal(r.output.firstOrderOpt, Math.max(...r.fval.map(Math.abs)));
    });
  }
}

/* ------------------------- Newton puro: convergência quadrática ------------------------- */

test('Newton puro com Jacobiano analítico converge quadraticamente (raiz de 2 em ≤ 6 iterações)', () => {
  const r = fsolve(P.raiz_de_2.f, [1], { jacobian: P.raiz_de_2.J, tolFun: 1e-14 });
  assert.equal(r.exitflag, 1);
  assert.ok(r.output.iterations <= 6, `iterações ${r.output.iterations}`);
  // erro do passo seguinte ≈ e² / (2√2): em x, e_{k+1} ≤ e_k² enquanto e_k < 0,3
  const h = r.output.history;
  assert.equal(h.length, r.output.iterations + 1);
  assert.ok(h[2] < h[1] ** 2 * 1.5 && h[3] < h[2] ** 2 * 1.5 + 1e-15, `history ${h}`);
  assert.equal(r.output.algorithm, 'Newton-Raphson');
});

test('Fluxo de potência de 2 barras (partida plana): converge em ≤ 5 iterações com mismatch ≤ 1e-8 pu', () => {
  const r = fsolve(P.fluxo_2_barras.f, [0, 1], { jacobian: P.fluxo_2_barras.J });
  assert.equal(r.exitflag, 1);
  assert.ok(r.output.iterations <= 5, `iterações ${r.output.iterations}`);
  assert.ok(r.output.firstOrderOpt <= 1e-8);
  const [th, v] = r.x;
  assert.ok(th < 0 && v < 1 && v > 0.9, `θ2=${th} V2=${v}`);   // carga atrasa o ângulo e derruba a tensão
});

test('contagens: Jacobiano analítico não gasta avaliações de F; diferenças finitas gastam n por iteração', () => {
  const a = fsolve(P.matlab_exp_2x2.f, [0, 0], { jacobian: P.matlab_exp_2x2.J });
  assert.equal(a.output.funcCount, a.output.iterations + 1);
  assert.equal(a.output.jacCount, a.output.iterations);
  const d = fsolve(P.matlab_exp_2x2.f, [0, 0]);
  assert.equal(d.output.funcCount, (d.output.iterations + 1) + 2 * d.output.iterations);
});

/* ------------------------- numjac ------------------------- */

for (const id of Object.keys(P)) {
  test(`numjac ${id}: forward e central batem com o Jacobiano analítico`, () => {
    const x = byId[id].x0.map((v, i) => v + 0.1 * (i + 1));
    const Ja = P[id].J(x);
    for (const [tipo, tol] of [['forward', TOL.jacFwd], ['central', TOL.jacCen]]) {
      const Jn = numjac(P[id].f, x, { diffType: tipo });
      Ja.forEach((row, i) => row.forEach((v, j) => near(Jn[i][j], v, tol * Math.max(1, Math.abs(v)), `${tipo} J[${i}][${j}]`)));
    }
  });
}

test('numjac aceita F não quadrada (m×n) e f0 pré-calculado', () => {
  const f = (x) => [x[0] + 2 * x[1], x[0] * x[1], Math.sin(x[1])];
  const x = [1, 2];
  const J = numjac(f, x, { f0: f(x), diffType: 'central' });
  assert.equal(J.length, 3); assert.equal(J[0].length, 2);
  nearVec(J[0], [1, 2], 1e-8); nearVec(J[1], [2, 1], 1e-8); nearVec(J[2], [0, Math.cos(2)], 1e-8);
});

/* ------------------------- exitflags e opções ------------------------- */

test('exitflag 0: maxIter atingido (sem convergir)', () => {
  const r = fsolve(P.raiz_de_2.f, [10], { jacobian: P.raiz_de_2.J, maxIter: 2, tolFun: 1e-14 });
  assert.equal(r.exitflag, 0);
  assert.equal(r.output.iterations, 2);
});

test('exitflag 1 imediato quando x0 já é raiz (0 iterações)', () => {
  const r = fsolve(P.raiz_de_2.f, [Math.SQRT2], { tolFun: 1e-12 });
  assert.equal(r.exitflag, 1); assert.equal(r.output.iterations, 0);
});

test('exitflag −2: Jacobiano singular (J = 0 em x0)', () => {
  const r = fsolve((x) => [x[0] ** 2 + 1], [0], { jacobian: () => [[0]] });
  assert.equal(r.exitflag, -2);
  assert.match(r.output.message, /singular/i);
});

test('Newton puro diverge para atan(x) com x0 = 2 e com lineSearch converge para 0', () => {
  const f = (x) => [Math.atan(x[0])], J = (x) => [[1 / (1 + x[0] ** 2)]];
  const puro = fsolve(f, [2], { jacobian: J, tolFun: 1e-12 });
  // |x| cresce (≈ x³ por iteração) até x² estourar: J = 1/(1 + ∞) = 0 exato → Jacobiano singular
  assert.equal(puro.exitflag, -2, puro.output.message);
  assert.ok(Math.abs(puro.x[0]) > 1e100, `x = ${puro.x[0]}`);
  const amort = fsolve(f, [2], { jacobian: J, tolFun: 1e-12, lineSearch: true });
  assert.equal(amort.exitflag, 1);
  near(amort.x[0], 0, 1e-12);
  assert.equal(amort.output.algorithm, 'Newton-Raphson com backtracking');
});

test('exitflag −3: F(x) = ∛x faz Newton dobrar |x| a cada passo até estourar o double', () => {
  const f = (x) => [Math.cbrt(x[0])], J = (x) => [[1 / (3 * Math.cbrt(x[0]) ** 2)]];
  const r = fsolve(f, [1], { jacobian: J, tolFun: 1e-12, maxIter: 5000 });
  assert.equal(r.exitflag, -3, r.output.message);
  assert.ok(Number.isFinite(r.x[0]) && Math.abs(r.x[0]) > 1e300, `x devolvido é a última iteração finita: ${r.x[0]}`);
  assert.ok(r.output.iterations > 1000, `iterações ${r.output.iterations}`);
});

test('lineSearch mantém o passo de Newton quando ele já reduz ‖F‖ (mesmas iterações do Newton puro)', () => {
  const a = fsolve(P.raiz_de_2.f, [1], { jacobian: P.raiz_de_2.J });
  const b = fsolve(P.raiz_de_2.f, [1], { jacobian: P.raiz_de_2.J, lineSearch: true });
  assert.deepEqual(b.output.history, a.output.history);
});

test('fun e jacobian recebem cópias: alterar o argumento não afeta o iterando', () => {
  const r = fsolve((x) => { const v = x[0]; x[0] = 999; return [v ** 2 - 2]; }, [1], { jacobian: (x) => { const v = x[0]; x[0] = -5; return [[2 * v]]; }, tolFun: 1e-12 });
  assert.equal(r.exitflag, 1); near(r.x[0], Math.SQRT2, 1e-9);
});

/* ------------------------- validação ------------------------- */

test('fsolve valida entradas', () => {
  const f = (x) => [x[0]];
  assert.throws(() => fsolve('x', [1]), TypeError, 'fun não é função');
  assert.throws(() => fsolve(f, 1), TypeError, 'x0 não é array');
  assert.throws(() => fsolve(f, []), RangeError, 'x0 vazio');
  assert.throws(() => fsolve(f, [NaN]), RangeError, 'x0 não finito');
  assert.throws(() => fsolve(f, ['a']), TypeError, 'x0 com string');
  assert.throws(() => fsolve(() => [1, 2], [1]), RangeError, 'F com dimensão ≠ n');
  assert.throws(() => fsolve(() => 5, [1]), TypeError, 'F não é array');
  assert.throws(() => fsolve(() => [NaN], [1]), RangeError, 'F(x0) não finita');
  assert.throws(() => fsolve(f, [1], { tolFun: 0 }), RangeError, 'tolFun');
  assert.throws(() => fsolve(f, [1], { tolX: -1 }), RangeError, 'tolX');
  assert.throws(() => fsolve(f, [1], { maxIter: 1.5 }), RangeError, 'maxIter');
  assert.throws(() => fsolve(f, [1], { diffType: 'x' }), RangeError, 'diffType');
  assert.throws(() => fsolve(f, [1], { jacobian: 3 }), TypeError, 'jacobian');
  assert.throws(() => fsolve(f, [1], { jacobian: () => [[1, 2]] }), RangeError, 'jacobian com forma errada');
  assert.throws(() => fsolve(f, [1], null), TypeError, 'options nulo');
});

test('numjac valida entradas', () => {
  assert.throws(() => numjac(3, [1]), TypeError);
  assert.throws(() => numjac((x) => x, []), RangeError);
  assert.throws(() => numjac((x) => x, [1], { diffType: 'y' }), RangeError);
});

/* ------------------------- Gauss–Seidel ------------------------- */

const GS = FIX.gauss_seidel_linear;
const linF = (A, b) => (x) => A.map((row, i) => row.reduce((s, a, j) => s + a * x[j], 0) - b[i]);
const linJ = (A) => () => A;
const linUpdate = (A, b) => (x, i) => (b[i] - A[i].reduce((s, a, j) => (j === i ? s : s + a * x[j]), 0)) / A[i][i];
const gsOpts = { algorithm: 'gauss-seidel', tolFun: GS.tolFun };
// ‖Ax − b‖∞ é diferença de termos O(10): ruído absoluto ≈ 1e-15, não proporcional ao resíduo; daí 5e-14 absoluto + 1e-9 relativo
const histClose = (a, b, rel, msg) => {
  assert.equal(a.length, b.length, `${msg}: número de varreduras ${a.length - 1} vs ${b.length - 1}`);
  a.forEach((v, i) => near(v, b[i], rel * Math.abs(b[i]) + 5e-14, `${msg} history[${i}]`));
};

for (const caso of GS.casos) {
  const rot = caso.accel === 1 ? 'Gauss–Seidel' : `SOR ω = ${caso.accel}`;
  test(`${rot} em Ax = b: mesmas varreduras e histórico do NumPy (Jacobiano analítico)`, () => {
    const r = fsolve(linF(GS.A, GS.b), GS.x0, { ...gsOpts, accel: caso.accel, jacobian: linJ(GS.A) });
    assert.equal(r.exitflag, 1, r.output.message);
    assert.equal(r.output.iterations, caso.iteracoes);
    histClose(r.output.history, caso.history, 1e-9, rot);
    nearVec(r.x, GS.x_exato, 1e-9, 'x');
    assert.equal(r.output.algorithm, caso.accel === 1 ? 'Gauss-Seidel' : `Gauss-Seidel com aceleração ${caso.accel}`);
  });
  test(`${rot} em Ax = b: com diferenças finitas a contagem de varreduras é a mesma`, () => {
    const r = fsolve(linF(GS.A, GS.b), GS.x0, { ...gsOpts, accel: caso.accel });
    assert.equal(r.exitflag, 1, r.output.message);
    assert.equal(r.output.iterations, caso.iteracoes);
    nearVec(r.x, GS.x_exato, 1e-8, 'x');
  });
  test(`${rot} em Ax = b: forma de ponto fixo (update) reproduz o histórico`, () => {
    const r = fsolve(linF(GS.A, GS.b), GS.x0, { ...gsOpts, accel: caso.accel, update: linUpdate(GS.A, GS.b) });
    assert.equal(r.exitflag, 1, r.output.message);
    assert.equal(r.output.iterations, caso.iteracoes);
    histClose(r.output.history, caso.history, 1e-9, `${rot} update`);
  });
}

for (const id of ['cos_menos_x', 'raiz_de_2', 'matlab_exp_2x2', 'circulo_hiperbole', 'fluxo_2_barras']) {
  test(`Gauss–Seidel não linear (Newton escalar por componente) ${id} converge para a mesma raiz`, () => {
    const fx = byId[id];
    const r = fsolve(P[id].f, fx.x0, { algorithm: 'gauss-seidel', tolFun: 1e-10, jacobian: P[id].J });
    assert.equal(r.exitflag, 1, r.output.message);
    nearVec(r.x, expected(id), 1e-8, 'x');
    const n = fsolve(P[id].f, fx.x0, { jacobian: P[id].J, tolFun: 1e-10 });
    assert.ok(r.output.iterations >= n.output.iterations, `GS ${r.output.iterations} vs Newton ${n.output.iterations}`);
  });
}

test('Gauss–Seidel: convergência linear (razão de ‖F‖ ≈ constante) contra quadrática do Newton', () => {
  const gs = fsolve(P.fluxo_2_barras.f, [0, 1], { algorithm: 'gauss-seidel', tolFun: 1e-12 });
  const h = gs.output.history;
  const r1 = h[4] / h[3], r2 = h[5] / h[4];
  assert.ok(r1 > 1e-3 && r1 < 0.9 && Math.abs(r1 - r2) / r2 < 0.05, `razões ${r1} ${r2}`);   // linear: razão ≈ constante (~0,03 aqui)
  const nw = fsolve(P.fluxo_2_barras.f, [0, 1], { jacobian: P.fluxo_2_barras.J, tolFun: 1e-12 });
  assert.ok(nw.output.iterations < gs.output.iterations, `Newton ${nw.output.iterations} vs GS ${gs.output.iterations}`);
});

test('Gauss–Seidel: maxIter padrão é 1000 (Newton: 100); exitflag 0 ao esgotar', () => {
  // A quase singular: ρ_GS = 0,99² ≈ 0,98 → ‖F‖∞ ≈ 1e-9 após 1000 varreduras, longe de tolFun = 1e-15
  const A = [[1, 0.99], [0.99, 1]], b = [1, 1];
  const lento = fsolve(linF(A, b), [0, 0], { algorithm: 'gauss-seidel', tolFun: 1e-15, jacobian: linJ(A) });
  assert.equal(lento.exitflag, 0);
  assert.equal(lento.output.iterations, 1000);
  const curto = fsolve(linF(A, b), [0, 0], { algorithm: 'gauss-seidel', tolFun: 1e-15, maxIter: 7, jacobian: linJ(A) });
  assert.equal(curto.output.iterations, 7);
  const newton = fsolve(P.raiz_de_2.f, [1], { tolFun: 1e-300, maxIter: undefined });
  assert.ok(newton.output.iterations <= 100, 'padrão do Newton continua 100');
});

test('Gauss–Seidel diverge (ρ = 6): exitflag −3 e x é a última varredura finita', () => {
  const d = FIX.gauss_seidel_divergente;
  const r = fsolve(linF(d.A, d.b), d.x0, { algorithm: 'gauss-seidel', jacobian: linJ(d.A) });
  assert.equal(r.exitflag, -3, r.output.message);
  assert.ok(r.x.every(Number.isFinite));
});

test('Gauss–Seidel: derivada diagonal nula (F₂ não depende de x₂) → exitflag −2', () => {
  const r = fsolve(P.rosenbrock_sistema.f, [-1.2, 1], { algorithm: 'gauss-seidel' });
  assert.equal(r.exitflag, -2);
  assert.match(r.output.message, /∂F1\/∂x1 = 0/);
});

test('Gauss–Seidel valida algorithm, accel e update', () => {
  const f = (x) => [x[0] - 1];
  assert.throws(() => fsolve(f, [0], { algorithm: 'jacobi' }), RangeError, 'algorithm');
  assert.throws(() => fsolve(f, [0], { algorithm: 'gauss-seidel', accel: 0 }), RangeError, 'accel = 0');
  assert.throws(() => fsolve(f, [0], { algorithm: 'gauss-seidel', accel: 2 }), RangeError, 'accel = 2');
  assert.throws(() => fsolve(f, [0], { algorithm: 'gauss-seidel', update: 1 }), TypeError, 'update');
  assert.throws(() => fsolve(f, [0], { algorithm: 'gauss-seidel', update: () => 'x' }), TypeError, 'update devolve texto');
});

test('Gauss–Seidel: update recebe cópia de x já com as componentes anteriores atualizadas', () => {
  const vistos = [];
  fsolve(linF(GS.A, GS.b), GS.x0, { ...gsOpts, maxIter: 1, update: (x, i) => { vistos.push(x.slice()); x[i] = 1e9; return linUpdate(GS.A, GS.b)(x, i); } });
  // na 1ª varredura o update i=1 vê x[0] já atualizado (≠ 0) e x[1] original (0, apesar da escrita 1e9 em cópia)
  assert.equal(vistos.length, 3);
  assert.equal(vistos[0][0], 0); assert.ok(vistos[1][0] !== 0); assert.equal(vistos[1][1], 0);
});
