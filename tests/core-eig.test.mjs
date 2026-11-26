import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eig, eigvals} from '../assets/js/core/eigen.js';
import {det, norm1} from '../assets/js/core/matrix.js';

// Fixture gerada por scripts/reference/gen_eig.py (scipy.linalg.eig / eigh, LAPACK).
const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-eig.json', import.meta.url), 'utf8'));

// Tolerâncias, com justificativa:
const TOL = {
  residuo: 1e-10,   // ‖A v − λ v‖₂ / max(1, ‖A‖₁): a decomposição é estável por retroação; medido ≤ 1e-14 nos casos bem escalados
  norma: 1e-12,     // |‖v‖₂ − 1|
  alinhamento: 1e-8,// 1 − |vᴴw| entre o autovetor calculado e o do LAPACK (autovalores distintos)
  ortogonal: 1e-12, // VᵀV = I no caso simétrico
  tracoDet: 1e-9,   // Σλ = tr(A) e Πλ = det(A), relativos
};

const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);
const dist = (z, w) => Math.hypot(z[0] - w[0], z[1] - w[1]);

// Associação gulosa de autovalores calculados com esperados (independe da ordem e de empates).
function casa(calc, esperado, tol, msg) {
  assert.equal(calc.length, esperado.length, `${msg}: quantidade de autovalores`);
  const livres = calc.slice();
  let pior = 0;
  for (const w of esperado) {
    let melhor = 0;
    for (let i = 1; i < livres.length; i++) if (dist(livres[i], w) < dist(livres[melhor], w)) melhor = i;
    pior = Math.max(pior, dist(livres[melhor], w));
    livres.splice(melhor, 1);
  }
  assert.ok(pior <= tol, `${msg}: pior desvio ${pior} > ${tol}`);
}

// ‖A v − λ v‖₂ para v complexo (vectors[i][k] = [re, im])
function residuo(A, values, vectors) {
  const n = A.length, out = [];
  for (let k = 0; k < n; k++) {
    const [lr, li] = values[k];
    let s = 0;
    for (let i = 0; i < n; i++) {
      let ar = 0, ai = 0;
      for (let j = 0; j < n; j++) { ar += A[i][j] * vectors[j][k][0]; ai += A[i][j] * vectors[j][k][1]; }
      const [vr, vi] = vectors[i][k];
      s += (ar - (lr * vr - li * vi)) ** 2 + (ai - (lr * vi + li * vr)) ** 2;
    }
    out.push(Math.sqrt(s));
  }
  return out;
}
const normaVetor = (V, k) => Math.sqrt(V.reduce((s, row) => s + row[k][0] ** 2 + row[k][1] ** 2, 0));
const produtoInterno = (V, k, W, l) => V.reduce((acc, row, i) => {   // vᴴ w
  const [a, b] = row[k], [c, d] = W[i][l];
  return [acc[0] + a * c + b * d, acc[1] + a * d - b * c];
}, [0, 0]);

/* ------------------------- contra SciPy/LAPACK ------------------------- */

for (const c of FIX.casos) {
  test(`eigvals ${c.id}: autovalores coincidem com scipy.linalg.eig`, () => {
    casa(eigvals(c.A), c.values, c.tol * Math.max(1, norm1(c.A)), c.id);
  });

  test(`eig ${c.id}: A·V = V·D, vetores com norma 1, reais para autovalor real e conjugados em pares`, () => {
    const { values, vectors } = eig(c.A);
    const res = residuo(c.A, values, vectors);
    const escala = Math.max(1, norm1(c.A));
    res.forEach((r, k) => assert.ok(r <= TOL.residuo * escala, `resíduo do autovetor ${k}: ${r}`));
    values.forEach((_, k) => near(normaVetor(vectors, k), 1, TOL.norma, `norma ${k}`));
    values.forEach((v, k) => {
      if (v[1] === 0) vectors.forEach((row) => assert.equal(row[k][1], 0, 'autovetor real'));
      else if (v[1] > 0) {                      // conjugado exato no vizinho k+1
        near(values[k + 1][0], v[0], 1e-12 * Math.max(1, Math.abs(v[0])), 'par: re');
        near(values[k + 1][1], -v[1], 1e-12 * Math.max(1, Math.abs(v[1])), 'par: im');
        vectors.forEach((row) => { assert.equal(row[k + 1][0], row[k][0]); assert.equal(row[k + 1][1], -row[k][1]); });
      }
    });
  });

  if (c.vetores_unicos) {
    test(`eig ${c.id}: autovetores alinham com os do LAPACK (autovalores distintos)`, () => {
      const { values, vectors } = eig(c.A);
      values.forEach((v, k) => {
        const l = c.values_vec.reduce((m, w, i) => (dist(w, v) < dist(c.values_vec[m], v) ? i : m), 0);
        const [pr, pi] = produtoInterno(vectors, k, c.vectors, l);
        const alinha = Math.hypot(pr, pi);
        assert.ok(1 - alinha <= TOL.alinhamento, `|vᴴw| = ${alinha} (autovalor ${k})`);
      });
    });
  }

  if (c.simetrica) {
    test(`eig ${c.id}: simétrica → autovalores reais crescentes e V ortonormal`, () => {
      const { values, vectors } = eig(c.A);
      const n = c.A.length;
      values.forEach((v, k) => { assert.equal(v[1], 0); if (k > 0) assert.ok(v[0] >= values[k - 1][0], 'crescente'); });
      c.values.forEach((w, k) => near(values[k][0], w[0], 1e-10 * Math.max(1, norm1(c.A)), `λ${k} vs eigh`));
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const [pr] = produtoInterno(vectors, a, vectors, b);
        near(pr, a === b ? 1 : 0, TOL.ortogonal, `VᵀV[${a}][${b}]`);
      }
    });
  }
}

/* ------------------------- casos específicos ------------------------- */

test('eigvals coincide com os values de eig (mesmo caminho numérico)', () => {
  for (const c of FIX.casos) assert.deepEqual(eigvals(c.A), eig(c.A).values, c.id);
});

test('exemplo do MATLAB: A = [[0,1],[-2,-3]] → λ = −1, −2 com vetores ∝ [1,−1] e [1,−2]', () => {
  const { values, vectors } = eig([[0, 1], [-2, -3]]);
  casa(values, [[-1, 0], [-2, 0]], 1e-12, 'λ');
  values.forEach((v, k) => {
    const razao = vectors[1][k][0] / vectors[0][k][0];
    near(razao, v[0], 1e-12, `v${k}[1]/v${k}[0] = λ (forma companheira)`);
  });
});

test('autovalores repetidos de matriz diagonalizável: vetores linearmente independentes', () => {
  for (const id of ['identidade_3x3', 'repetido_nao_defeituoso']) {
    const c = FIX.casos.find((x) => x.id === id);
    const V = eig(c.A).vectors.map((r) => r.map((z) => z[0]));
    near(Math.abs(det(V)), 1, 1e-12, `|det V| ${id}`);
  }
});

test('matriz defeituosa (bloco de Jordan): resíduo pequeno e vetores quase paralelos', () => {
  const { values, vectors } = eig([[0, 1], [0, 0]]);
  casa(values, [[0, 0], [0, 0]], 1e-7, 'λ');
  residuo([[0, 1], [0, 0]], values, vectors).forEach((r) => assert.ok(r < 1e-7));
  const [pr, pi] = produtoInterno(vectors, 0, vectors, 1);
  assert.ok(Math.hypot(pr, pi) > 1 - 1e-6, 'v1 ∥ v2');
});

test('matriz nula, escalar, vazia', () => {
  assert.deepEqual(eigvals([[0, 0], [0, 0]]), [[0, 0], [0, 0]]);
  assert.deepEqual(eig([[7]]), { values: [[7, 0]], vectors: [[[1, 0]]] });
  assert.deepEqual(eig([]), { values: [], vectors: [] });
  assert.deepEqual(eigvals([]), []);
});

/* ------------------------- propriedades em matrizes pseudo-aleatórias ------------------------- */

function gerador(seed) {   // LCG determinístico; valores em (−1, 1)
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s / 2 ** 32) * 2 - 1; };
}

test('propriedades (n = 2…12, 8 matrizes cada): resíduo, Σλ = tr, Πλ = det, espectro fechado por conjugação', () => {
  const rnd = gerador(20261126);
  for (let n = 2; n <= 12; n++) for (let rep = 0; rep < 8; rep++) {
    const A = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
    const { values, vectors } = eig(A);
    const esc = Math.max(1, norm1(A));
    residuo(A, values, vectors).forEach((r, k) => assert.ok(r <= TOL.residuo * esc, `n=${n} resíduo ${k}: ${r}`));
    const soma = values.reduce((s, v) => s + v[0], 0), tr = A.reduce((s, row, i) => s + row[i], 0);
    near(soma, tr, TOL.tracoDet * esc, `traço n=${n}`);
    let pr = 1, pi = 0;
    for (const [a, b] of values) { [pr, pi] = [pr * a - pi * b, pr * b + pi * a]; }
    near(pr, det(A), 1e-7 * Math.max(1, Math.abs(det(A))), `det n=${n}`);
    near(pi, 0, 1e-7 * Math.max(1, Math.abs(det(A))), `Im(Πλ) n=${n}`);
    casa(values, values.map(([a, b]) => [a, -b]), 1e-10 * esc, `conjugação n=${n}`);
  }
});

test('matriz maior (n = 30): resíduo e traço', () => {
  const rnd = gerador(7), n = 30;
  const A = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
  const { values, vectors } = eig(A);
  const esc = norm1(A);
  residuo(A, values, vectors).forEach((r, k) => assert.ok(r <= 1e-9 * esc, `resíduo ${k}: ${r}`));
});

test('matriz mal escalada: o balanceamento mantém autovalores precisos', () => {
  const A = [[1, 1e4, 0], [1e-4, 2, 1e3], [0, 1e-3, 3]];
  const { values, vectors } = eig(A);
  casa(values, FIX.casos.find((c) => c.id === 'mal_escalada_3x3').values, 1e-8, 'λ');
  residuo(A, values, vectors).forEach((r) => assert.ok(r <= 1e-9 * norm1(A)));
});

/* ------------------------- validação ------------------------- */

test('eig/eigvals validam a entrada', () => {
  for (const f of [eig, eigvals]) {
    assert.throws(() => f('x'), TypeError, 'não é array');
    assert.throws(() => f([[1, 2, 3], [4, 5, 6]]), RangeError, 'não quadrada');
    assert.throws(() => f([[1, 2], [3]]), RangeError, 'não retangular');
    assert.throws(() => f([[NaN, 1], [1, 1]]), RangeError, 'NaN');
    assert.throws(() => f([[Infinity]]), RangeError, 'Infinity');
    assert.throws(() => f([['a']]), TypeError, 'texto');
  }
});
