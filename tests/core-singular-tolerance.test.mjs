import test from 'node:test';
import assert from 'node:assert/strict';
import {msolve, inv} from '../assets/js/core/matrix.js';
import {csolve, cinv, fromReal} from '../assets/js/core/cmatrix.js';
import {solveLinearSystem, LIMITS as LIM_DC} from '../simulators/electrical-circuits/nodal-analysis/model.js';
import {solveComplexSystem, LIMITS as LIM_AC} from '../simulators/electrical-circuits/nodal-analysis-ac/model.js';

// Opção de singularidade { absTol, relTol } de msolve/inv/csolve/cinv.
// Singular se o maior módulo de pivô de alguma coluna ≤ max(absTol, relTol·máx|aᵢⱼ|); padrão 0 e 0 (pivô exatamente nulo).

const I2 = [[1, 0], [0, 1]];
const cI2 = fromReal(I2);
const B2 = [[1], [1]];
const cB2 = fromReal(B2);
const singular = {message: 'Matriz singular', code: 'SINGULAR_MATRIX'};

// Gerador congruencial determinístico (sem Math.random: os testes têm de ser reprodutíveis).
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
}

/* ------------------------- comportamento padrão inalterado ------------------------- */

test('sem opções, só o pivô exatamente nulo é singular (comportamento anterior preservado)', () => {
  const quase = [[1, 0], [0, 1e-20]];
  assert.doesNotThrow(() => msolve(quase, B2));
  assert.doesNotThrow(() => csolve(fromReal(quase), cB2));
  assert.throws(() => msolve([[1, 0], [0, 0]], B2), singular);
  assert.throws(() => csolve(fromReal([[1, 0], [0, 0]]), cB2), singular);
  for (const opts of [undefined, {}, {absTol: 0, relTol: 0}]) {
    assert.deepEqual(msolve(quase, B2, opts), msolve(quase, B2));
    assert.deepEqual(csolve(fromReal(quase), cB2, opts), csolve(fromReal(quase), cB2));
  }
});

/* ------------------------- tolerância absoluta e relativa ------------------------- */

test('absTol: singular quando o pivô é ≤ absTol (inclusive no limite) e regular acima', () => {
  const A = [[1, 0], [0, 1e-13]];
  assert.throws(() => msolve(A, B2, {absTol: 1e-12}), singular);
  assert.throws(() => msolve(A, B2, {absTol: 1e-13}), singular);   // pivô == tol → singular (≤)
  assert.doesNotThrow(() => msolve(A, B2, {absTol: 1e-14}));
  assert.throws(() => csolve(fromReal(A), cB2, {absTol: 1e-12}), singular);
  assert.throws(() => csolve(fromReal(A), cB2, {absTol: 1e-13}), singular);
  assert.doesNotThrow(() => csolve(fromReal(A), cB2, {absTol: 1e-14}));
});

test('relTol é relativa ao maior módulo da matriz; o limite final é o maior entre absTol e relTol·escala', () => {
  const A = [[1e6, 0], [0, 1e-7]];   // escala 1e6
  assert.doesNotThrow(() => msolve(A, B2, {absTol: 1e-12}));          // absoluta: 1e-7 > 1e-12
  assert.throws(() => msolve(A, B2, {relTol: 1e-12}), singular);      // relativa: 1e-12·1e6 = 1e-6 ≥ 1e-7
  assert.doesNotThrow(() => msolve(A, B2, {relTol: 1e-14}));          // 1e-14·1e6 = 1e-8 < 1e-7
  assert.throws(() => msolve(A, B2, {absTol: 1e-6, relTol: 1e-14}), singular);   // max(1e-6, 1e-8)
  assert.throws(() => csolve(fromReal(A), cB2, {relTol: 1e-12}), singular);
  assert.doesNotThrow(() => csolve(fromReal(A), cB2, {relTol: 1e-14}));
});

test('a tolerância vale para a inversa e a escala complexa usa o módulo', () => {
  assert.throws(() => inv([[1, 0], [0, 1e-13]], {absTol: 1e-12}), singular);
  assert.throws(() => cinv(fromReal([[1, 0], [0, 1e-13]]), {absTol: 1e-12}), singular);
  assert.deepEqual(inv(I2, {absTol: 1e-12, relTol: 1e-12}), I2);
  // Elemento imaginário puro 5i: a escala é o módulo (5), não a parte real (0). Com relTol 1e-12 o limite é 5e-12 ≥ pivô 1e-13
  // (singular); com 1e-14 é 5e-14 < 1e-13. Um 3 + 4i daria escala 5 pelo módulo e 3 pela parte real, sem distinguir os dois.
  const Z = [[{re: 0, im: 5}, {re: 0, im: 0}], [{re: 0, im: 0}, {re: 1e-13, im: 0}]];
  assert.throws(() => csolve(Z, cB2, {relTol: 1e-12}), singular);
  assert.doesNotThrow(() => csolve(Z, cB2, {relTol: 1e-14}));
});

test('matriz vazia não é afetada pela opção, mas a opção inválida ainda é rejeitada', () => {
  assert.deepEqual(msolve([], [], {absTol: 1e-12}), []);
  assert.deepEqual(csolve([], [], {relTol: 1e-12}), []);
  assert.throws(() => msolve([], [], {absTol: -1}), RangeError);
});

/* ------------------------- erro e validação ------------------------- */

test('o erro de singularidade traz code SINGULAR_MATRIX, com e sem opções', () => {
  const sing = [[1, 2], [2, 4]];
  for (const f of [
    () => msolve(sing, B2), () => inv(sing), () => csolve(fromReal(sing), cB2), () => cinv(fromReal(sing)),
    () => msolve(sing, B2, {absTol: 1e-12}), () => inv(sing, {relTol: 1e-12}),
    () => csolve(fromReal(sing), cB2, {absTol: 1e-12}), () => cinv(fromReal(sing), {relTol: 1e-12}),
  ]) {
    assert.throws(f, (e) => e instanceof Error && e.message === 'Matriz singular' && e.code === 'SINGULAR_MATRIX');
  }
  // erros de outro tipo não recebem esse code
  assert.throws(() => msolve([[1, 2]], B2), (e) => e instanceof RangeError && e.code === undefined);
});

test('opções inválidas lançam TypeError ou RangeError', () => {
  for (const f of [(o) => msolve(I2, B2, o), (o) => inv(I2, o), (o) => csolve(cI2, cB2, o), (o) => cinv(cI2, o)]) {
    assert.throws(() => f(null), TypeError);
    assert.throws(() => f('1e-12'), TypeError);
    assert.throws(() => f(1e-12), TypeError);
    assert.throws(() => f({absTol: '1e-12'}), TypeError);
    assert.throws(() => f({relTol: {}}), TypeError);
    assert.throws(() => f({absTol: -1e-12}), RangeError);
    assert.throws(() => f({relTol: -1}), RangeError);
    assert.throws(() => f({absTol: NaN}), RangeError);
    assert.throws(() => f({relTol: Infinity}), RangeError);
  }
});

/* ------------------------- equivalência com os solucionadores do nodal ------------------------- */
// Os dois solucionadores do modelo nodal usam o mesmo pivotamento parcial por módulo. A eliminação de Gauss–Jordan
// do núcleo não altera os pivôs das colunas seguintes, então a classificação de singularidade coincide e os
// valores diferem só por arredondamento.

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * (1 + Math.abs(b)), `${msg}: ${a} vs ${b}`);

test('nodal DC: msolve com absTol igual ao limite do modelo reproduz solveLinearSystem', () => {
  assert.equal(LIM_DC.singularPivotTol, 1e-12);
  const rnd = rng(20261126);
  for (let n = 2; n <= 8; n++) {
    for (let rep = 0; rep < 20; rep++) {
      const A = Array.from({length: n}, (_, i) => Array.from({length: n}, (_, j) => rnd() + (i === j ? n : 0)));
      const b = Array.from({length: n}, () => rnd());
      const antigo = solveLinearSystem(A, b);
      const novo = msolve(A, b.map((v) => [v]), {absTol: LIM_DC.singularPivotTol}).map((r) => r[0]);
      for (let i = 0; i < n; i++) near(novo[i], antigo[i], 1e-12, `n=${n} rep=${rep} x[${i}]`);
    }
  }
});

test('nodal DC: a classificação de singularidade coincide, inclusive para pivôs entre 0 e o limite', () => {
  const lim = LIM_DC.singularPivotTol;
  for (const pivo of [0, lim / 10, lim / 2, lim, lim * 10, lim * 1000]) {
    const A = [[2, 1, 0], [1, 3, 0], [0, 0, pivo]];
    const b = [1, 2, 3];
    const nodalLanca = (() => { try { solveLinearSystem(A, b); return false; } catch { return true; } })();
    const nucleoLanca = (() => { try { msolve(A, b.map((v) => [v]), {absTol: lim}); return false; } catch (e) { return e.code === 'SINGULAR_MATRIX'; } })();
    assert.equal(nucleoLanca, nodalLanca, `pivô ${pivo}`);
  }
  // sem a opção, o núcleo aceitaria o pivô pequeno: é exatamente o que a opção evita
  assert.doesNotThrow(() => msolve([[2, 1, 0], [1, 3, 0], [0, 0, lim / 10]], [[1], [2], [3]]));
});

test('nodal AC: csolve com relTol igual ao limite do modelo reproduz solveComplexSystem', () => {
  assert.equal(LIM_AC.singularRelTol, 1e-12);
  const rnd = rng(20261127);
  for (let n = 2; n <= 6; n++) {
    for (let rep = 0; rep < 20; rep++) {
      const A = Array.from({length: n}, (_, i) => Array.from({length: n}, (_, j) => ({re: rnd() + (i === j ? n : 0), im: rnd()})));
      const b = Array.from({length: n}, () => ({re: rnd(), im: rnd()}));
      const antigo = solveComplexSystem(A, b);
      const novo = csolve(A, b.map((z) => [z]), {relTol: LIM_AC.singularRelTol}).map((r) => r[0]);
      for (let i = 0; i < n; i++) {
        near(novo[i].re, antigo[i].re, 1e-12, `n=${n} rep=${rep} re[${i}]`);
        near(novo[i].im, antigo[i].im, 1e-12, `n=${n} rep=${rep} im[${i}]`);
      }
    }
  }
});

test('nodal AC: a classificação de singularidade coincide para pivôs relativos ao maior módulo', () => {
  const rel = LIM_AC.singularRelTol;
  const escala = 1e3;   // maior módulo da matriz
  for (const frac of [0, rel / 10, rel / 2, rel, rel * 10, rel * 1000]) {
    const A = [
      [{re: escala, im: 0}, {re: 0, im: 0}],
      [{re: 0, im: 0}, {re: frac * escala, im: 0}],
    ];
    const b = [{re: 1, im: 0}, {re: 1, im: 0}];
    const nodalLanca = (() => { try { solveComplexSystem(A, b); return false; } catch { return true; } })();
    const nucleoLanca = (() => { try { csolve(A, b.map((z) => [z]), {relTol: rel}); return false; } catch (e) { return e.code === 'SINGULAR_MATRIX'; } })();
    assert.equal(nucleoLanca, nodalLanca, `pivô relativo ${frac}`);
  }
});
