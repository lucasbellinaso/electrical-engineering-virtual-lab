import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../assets/js/core/cmatrix.js';
import * as M from '../assets/js/core/matrix.js';

// Fixture gerada por scripts/reference/gen_cmatrix.py (numpy.linalg / LAPACK).
const FIX = JSON.parse(readFileSync(new URL('./fixtures/core-cmatrix.json', import.meta.url), 'utf8'));
const EPS = FIX.meta.eps; // precisão de dupla (2^-52)

// Tolerâncias, com justificativa. Erros medidos na fixture estão nos comentários de cada uso.
const TOL = {
  // solve e inv: erro direto relativo (Frobenius) ≤ c.tol = 64·ε·cond₂(A), gerado pelo NumPy.
  // Gauss com pivotamento parcial é estável para trás (erro ~ n·ε·crescimento); o erro direto é
  // então limitado por cond·(erro para trás). O fator 64 cobre n ≤ 6 e crescimento moderado.
  residuo: (n) => 64 * n * EPS,            // ‖AX − B‖∞ / (‖A‖∞‖X‖∞ + ‖B‖∞): estabilidade para trás
  inversa: (c) => 64 * c.n * EPS * c.cond, // ‖A·A⁻¹ − I‖∞: a identidade degrada com cond(A)
  produto: (k, A, B) => 2 * k * EPS * normInfC(A) * normInfC(B), // γ_k = kε por entrada; ‖|A||B|‖∞ ≤ ‖A‖∞‖B‖∞
  norma: (r, c) => 16 * Math.max(r, c) * EPS,                    // normas e traço: erro relativo
  // det: |Δdet| ≤ 64·n·ε·H, com H = ∏ᵢ ‖linha_i‖₂ (cota de Hadamard, escala natural do determinante).
  det: (n, H) => 64 * n * EPS * H,
  // identidade det(AB) = det(A)det(B): erro relativo, medido em ~1e-14 para estes casos
  detProduto: 1e-12,
  // comparação com matrix.js nos casos reais: mesma aritmética, só difere pela representação
  cruzadoReal: (n) => 16 * n * EPS,
};

/* ------------------------- utilidades independentes do módulo ------------------------- */

const toM = (P) => P.map((row) => row.map(([re, im]) => ({ re, im })));
const toP = (A) => A.map((row) => row.map((z) => [z.re, z.im]));
const modz = (z) => Math.hypot(z.re, z.im);
const normInfC = (A) => Math.max(0, ...A.map((row) => row.reduce((s, z) => s + modz(z), 0)));
const normFroC = (A) => Math.sqrt(A.reduce((s, row) => s + row.reduce((t, z) => t + z.re * z.re + z.im * z.im, 0), 0));
const dif = (A, B) => {
  assert.equal(A.length, B.length, 'linhas');
  return A.map((row, i) => {
    assert.equal(row.length, B[i].length, `colunas da linha ${i}`);
    return row.map((z, j) => ({ re: z.re - B[i][j].re, im: z.im - B[i][j].im }));
  });
};
const iguais = (A, B) => {   // igualdade exata elemento a elemento (=== trata −0 e +0 como iguais)
  assert.equal(A.length, B.length, 'linhas');
  A.forEach((row, i) => {
    assert.equal(row.length, B[i].length, `colunas da linha ${i}`);
    row.forEach((z, j) => assert.ok(z.re === B[i][j].re && z.im === B[i][j].im, `[${i}][${j}]: ${JSON.stringify(z)} vs ${JSON.stringify(B[i][j])}`));
  });
};
const identidade = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 })));
const hadamard = (A) => A.reduce((h, row) => h * Math.sqrt(row.reduce((s, z) => s + z.re * z.re + z.im * z.im, 0)), 1);
const somaDiagAbs = (A) => A.reduce((s, row, i) => s + modz(row[i]), 0);
const reais = (A) => A.map((row) => row.map((z) => z.re));
const mesmaSoma = (x, y, tol, msg) => assert.ok(Math.abs(x - y) <= tol, `${msg}: |${x} − ${y}| = ${Math.abs(x - y)} > ${tol}`);

/* ------------------------- contra NumPy: por caso ------------------------- */

for (const c of FIX.casos) {
  test(`[${c.id}] transposta, hermitiana e normas contra NumPy`, () => {
    const A = toM(c.A);
    iguais(C.ctranspose(A), toM(c.transpose));
    iguais(C.chermitian(A), toM(c.hermitian));
    mesmaSoma(C.cnorm1(A), c.norm1, TOL.norma(c.r, c.c) * c.norm1, 'norm1');
    mesmaSoma(C.cnormInf(A), c.normInf, TOL.norma(c.r, c.c) * c.normInf, 'normInf');
    mesmaSoma(C.cnormFro(A), c.normFro, TOL.norma(c.r, c.c) * c.normFro, 'normFro');
  });

  test(`[${c.id}] produtos AB e BA contra NumPy`, () => {
    const A = toM(c.A), B = toM(c.B);
    if (c.AB) {
      const k = A[0].length;
      const err = normInfC(dif(C.cmmul(A, B), toM(c.AB)));
      assert.ok(err <= TOL.produto(k, A, B), `AB: erro ${err} > ${TOL.produto(k, A, B)}`);
    } else {
      assert.throws(() => C.cmmul(A, B), RangeError);
    }
    if (c.BA) {
      const k = B[0].length;
      const err = normInfC(dif(C.cmmul(B, A), toM(c.BA)));
      assert.ok(err <= TOL.produto(k, B, A), `BA: erro ${err} > ${TOL.produto(k, B, A)}`);
    }
  });

  if (c.n !== null) {
    test(`[${c.id}] traço e determinante contra NumPy`, () => {
      const A = toM(c.A);
      const t = C.ctrace(A);
      mesmaSoma(t.re, c.trace[0], TOL.norma(c.n, c.n) * somaDiagAbs(A), 'traço re');
      mesmaSoma(t.im, c.trace[1], TOL.norma(c.n, c.n) * somaDiagAbs(A), 'traço im');
      const d = C.cdet(A);
      const bound = TOL.det(c.n, hadamard(A));
      mesmaSoma(d.re, c.det[0], bound, 'det re');
      mesmaSoma(d.im, c.det[1], bound, 'det im');
    });
  } else {
    test(`[${c.id}] operações quadradas rejeitam matriz não quadrada`, () => {
      const A = toM(c.A), B = toM(c.B);
      assert.throws(() => C.cdet(A), RangeError);
      assert.throws(() => C.cinv(A), RangeError);
      assert.throws(() => C.csolve(A, B), RangeError);
    });
  }

  if (c.n !== null && !c.singular) {
    test(`[${c.id}] solve e inv contra NumPy (erro direto ≤ tol cond-based)`, () => {
      const A = toM(c.A), B = toM(c.B);
      const X = C.csolve(A, B), Xr = toM(c.solve);
      assert.equal(X.length, c.n);
      const relX = normFroC(dif(X, Xr)) / normFroC(Xr);
      assert.ok(relX <= c.tol, `solve: erro relativo ${relX} > ${c.tol}`);
      const Ai = C.cinv(A), Air = toM(c.inv);
      const relI = normFroC(dif(Ai, Air)) / normFroC(Air);
      assert.ok(relI <= c.tol, `inv: erro relativo ${relI} > ${c.tol}`);
    });
  }

  if (c.singular) {
    test(`[${c.id}] singular: csolve e cinv lançam 'Matriz singular'; cdet é zero`, () => {
      const A = toM(c.A), B = toM(c.B);
      assert.throws(() => C.csolve(A, B), { message: 'Matriz singular' });
      assert.throws(() => C.cinv(A), { message: 'Matriz singular' });
      const d = C.cdet(A);
      assert.equal(d.re, 0);
      assert.equal(d.im, 0);
    });
  }

  if (c.real) {
    test(`[${c.id}] caso real coincide com msolve/det/inv de matrix.js`, () => {
      const A = toM(c.A), B = toM(c.B);
      const Ar = reais(A), Br = reais(B), n = c.n;
      const Xc = C.csolve(A, B);
      const Xr = M.msolve(Ar, Br);
      const relX = normFroC(dif(Xc, Xr.map((row) => row.map((v) => ({ re: v, im: 0 }))))) / normFroC(Xr.map((row) => row.map((v) => ({ re: v, im: 0 }))));
      assert.ok(relX <= TOL.cruzadoReal(n), `solve real: ${relX}`);
      for (const row of C.realPart(C.csolve(A, B))) assert.ok(row.every(Number.isFinite));
      assert.ok(C.imagPart(Xc).every((row) => row.every((v) => v === 0)), 'parte imaginária deve ser zero');
      const Ai = C.cinv(A), Air = M.inv(Ar);
      const relI = normFroC(dif(Ai, Air.map((row) => row.map((v) => ({ re: v, im: 0 }))))) / normFroC(Air.map((row) => row.map((v) => ({ re: v, im: 0 }))));
      assert.ok(relI <= TOL.cruzadoReal(n), `inv real: ${relI}`);
      const d = C.cdet(A), dr = M.det(Ar);
      mesmaSoma(d.re, dr, TOL.cruzadoReal(n) * Math.abs(dr) + TOL.det(n, hadamard(A)), 'det real');
      assert.equal(d.im, 0);
    });
  }
}

/* ------------------------- identidades independentes da referência ------------------------- */

const quadrados = FIX.casos.filter((c) => c.n !== null && !c.singular);

test('resíduo do solve: ‖AX − B‖∞ / (‖A‖∞‖X‖∞ + ‖B‖∞) ≤ 64·n·ε', () => {
  for (const c of quadrados) {
    const A = toM(c.A), B = toM(c.B), X = C.csolve(A, B);
    const res = normInfC(dif(C.cmmul(A, X), B));
    const escala = normInfC(A) * normInfC(X) + normInfC(B);
    assert.ok(res / escala <= TOL.residuo(c.n), `${c.id}: resíduo ${res / escala}`);
  }
});

test('A·inv(A) ≈ I e inv(A)·A ≈ I, com tolerância 64·n·ε·cond(A)', () => {
  for (const c of quadrados) {
    const A = toM(c.A), Ai = C.cinv(A), I = identidade(c.n);
    const e1 = normInfC(dif(C.cmmul(A, Ai), I));
    const e2 = normInfC(dif(C.cmmul(Ai, A), I));
    assert.ok(e1 <= TOL.inversa(c), `${c.id}: A·inv(A) − I = ${e1}`);
    assert.ok(e2 <= TOL.inversa(c), `${c.id}: inv(A)·A − I = ${e2}`);
  }
});

test('det(AB) = det(A)·det(B) para pares 4x4 da fixture', () => {
  const A = toM(FIX.casos.find((c) => c.id === 'hermitiana_4x4').A);
  const B = toM(FIX.casos.find((c) => c.id === 'real_4x4').A);
  const dA = C.cdet(A), dB = C.cdet(B), dAB = C.cdet(C.cmmul(A, B));
  const prodRe = dA.re * dB.re - dA.im * dB.im, prodIm = dA.re * dB.im + dA.im * dB.re;
  const escala = Math.hypot(dA.re, dA.im) * Math.hypot(dB.re, dB.im);
  assert.ok(Math.hypot(dAB.re - prodRe, dAB.im - prodIm) <= TOL.detProduto * escala, 'det(AB) ≠ det(A)det(B)');
});

test('ctrace(AB) = ctrace(BA) em pares retangulares (2x3 · 3x2) e quadrados', () => {
  const pares = [
    [toM(FIX.casos.find((c) => c.id === 'retangular_2x3_por_3x2').A), toM(FIX.casos.find((c) => c.id === 'retangular_2x3_por_3x2').B)],
    [toM(FIX.casos.find((c) => c.id === 'hermitiana_4x4').A), toM(FIX.casos.find((c) => c.id === 'real_4x4').A)],
  ];
  for (const [A, B] of pares) {
    const t1 = C.ctrace(C.cmmul(A, B)), t2 = C.ctrace(C.cmmul(B, A));
    const bound = A.length * TOL.produto(A[0].length, A, B);
    assert.ok(Math.hypot(t1.re - t2.re, t1.im - t2.im) <= bound, `tr(AB) ≠ tr(BA): ${JSON.stringify(t1)} vs ${JSON.stringify(t2)}`);
  }
});

test('hermitiana: chermitian(A^H·B) = B^H·A^H; hermitiana de matriz hermitiana é ela mesma', () => {
  const A = toM(FIX.casos.find((c) => c.id === 'real_4x4').A);
  const H = toM(FIX.casos.find((c) => c.id === 'hermitiana_4x4').A);
  const esq = C.chermitian(C.cmmul(A, H));
  const dir = C.cmmul(C.chermitian(H), C.chermitian(A));
  assert.ok(normInfC(dif(esq, dir)) <= TOL.produto(4, A, H), 'propriedade do produto hermitiano');
  iguais(C.chermitian(H), H);
});

test('transposições: ctranspose(ctranspose(A)) = A, chermitian = conj(ctranspose(A))', () => {
  const A = toM(FIX.casos.find((c) => c.id === 'retangular_2x3_por_3x2').A);
  iguais(C.ctranspose(C.ctranspose(A)), A);
  iguais(C.chermitian(C.chermitian(A)), A);
  const conjT = C.ctranspose(A).map((row) => row.map((z) => ({ re: z.re, im: -z.im })));
  iguais(C.chermitian(A), conjT);
});

test('escalares, soma e fatoração de partes são exatos', () => {
  const A = toM(FIX.casos.find((c) => c.id === 'aleatoria_3x3').A);
  const B = C.cscale(A, { re: 0.5, im: -2 });
  iguais(C.cscale(A, 2), C.cadd(A, A));
  iguais(C.cscale(A, { re: 0, im: 1 }), A.map((row) => row.map((z) => ({ re: -z.im, im: z.re }))));
  iguais(C.csub(A, B), C.cadd(A, C.cscale(B, -1)));
  iguais(C.fromParts(C.realPart(A), C.imagPart(A)), A);
  assert.deepEqual(C.realPart(C.fromReal([[1, -2], [0.5, 3]])), [[1, -2], [0.5, 3]]);
});

/* ------------------------- casos conhecidos à mão ------------------------- */

test('2x2 à mão: det = 3, inv = [[2/3, −j/3], [j/3, 2/3]], solve X = [[1−j], [2]]', () => {
  const A = [[{ re: 2, im: 0 }, { re: 0, im: 1 }], [{ re: 0, im: -1 }, { re: 2, im: 0 }]];
  const B = [[{ re: 2, im: 0 }], [{ re: 3, im: -1 }]];
  const d = C.cdet(A);
  assert.ok(Math.abs(d.re - 3) < 1e-15 && Math.abs(d.im) < 1e-15, `det ${JSON.stringify(d)}`);
  const Ai = C.cinv(A);
  const esperada = [[{ re: 2 / 3, im: 0 }, { re: 0, im: -1 / 3 }], [{ re: 0, im: 1 / 3 }, { re: 2 / 3, im: 0 }]];
  assert.ok(normInfC(dif(Ai, esperada)) < 1e-15, 'inversa');
  const X = C.csolve(A, B);
  assert.ok(normInfC(dif(X, [[{ re: 1, im: -1 }], [{ re: 2, im: 0 }]])) < 1e-15, 'solve');
});

test('1x1 à mão: det(2−j) = 2−j, inv = (2+j)/5', () => {
  const A = [[{ re: 2, im: -1 }]];
  assert.deepEqual(C.cdet(A), { re: 2, im: -1 });
  const Ai = C.cinv(A);
  assert.ok(Math.abs(Ai[0][0].re - 0.4) < 1e-15 && Math.abs(Ai[0][0].im - 0.2) < 1e-15);
});

test('permutação 4x4 com fases: det = 2 − 2j (ciclo de 4 é ímpar, sinal −1)', () => {
  const P = [
    [{ re: 0, im: 0 }, { re: 0, im: 1 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 1 }],
    [{ re: 2, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
  ];
  const d = C.cdet(P);
  assert.ok(Math.abs(d.re - 2) < 1e-14 && Math.abs(d.im + 2) < 1e-14, JSON.stringify(d));
});

/* ------------------------- validação e erros ------------------------- */

const z = (re, im = 0) => ({ re, im });

test('tipos errados lançam TypeError', () => {
  assert.throws(() => C.cdet(5), TypeError);
  assert.throws(() => C.cdet([[1]]), TypeError);                 // elemento real, não {re, im}
  assert.throws(() => C.cdet([[{ re: 1 }]]), TypeError);         // falta im
  assert.throws(() => C.cdet({}), TypeError);
  assert.throws(() => C.cinv('x'), TypeError);
  assert.throws(() => C.csolve([[z(1)]], 3), TypeError);
  assert.throws(() => C.cmmul([[z(1)]], null), TypeError);
  assert.throws(() => C.ctranspose([null]), TypeError);
  assert.throws(() => C.fromReal([['a']]), TypeError);
  assert.throws(() => C.cscale([[z(1)]], { re: 1 }), TypeError);
  assert.throws(() => C.czeros('2', 2), TypeError);
  assert.throws(() => C.ceye(null), TypeError);
});

test('valores não finitos e dimensões inválidas lançam RangeError', () => {
  assert.throws(() => C.cdet([[z(NaN)]]), RangeError);
  assert.throws(() => C.cdet([[z(1, Infinity)]]), RangeError);
  assert.throws(() => C.cnorm1([[z(-Infinity)]]), RangeError);
  assert.throws(() => C.fromReal([[NaN]]), RangeError);
  assert.throws(() => C.cscale([[z(1)]], NaN), RangeError);
  assert.throws(() => C.czeros(-1, 2), RangeError);
  assert.throws(() => C.czeros(1.5, 2), RangeError);
  assert.throws(() => C.ceye(NaN), RangeError);
});

test('matrizes não retangulares lançam RangeError', () => {
  const R = [[z(1), z(0)], [z(1)]];
  assert.throws(() => C.cdet(R), RangeError);
  assert.throws(() => C.cnormFro(R), RangeError);
  assert.throws(() => C.ctranspose(R), RangeError);
  assert.throws(() => C.fromReal([[1, 2], [3]]), RangeError);
});

test('dimensões incompatíveis lançam RangeError', () => {
  const A23 = [[z(1), z(2), z(3)], [z(4), z(5), z(6)]];
  const A22 = [[z(1), z(0)], [z(0), z(1)]];
  assert.throws(() => C.cmmul(A23, A22), RangeError);
  assert.throws(() => C.cadd(A23, A22), RangeError);
  assert.throws(() => C.csub(A23, A22), RangeError);
  assert.throws(() => C.csolve(A23, A22), RangeError);   // A não quadrada
  assert.throws(() => C.csolve(A22, [[z(1)]]), RangeError); // B com 1 linha, n = 2
  assert.throws(() => C.fromParts([[1, 2]], [[1]]), RangeError);
});

test('não quadrada para det/inv/csolve', () => {
  const A23 = [[z(1), z(2), z(3)], [z(4), z(5), z(6)]];
  assert.throws(() => C.cdet(A23), RangeError);
  assert.throws(() => C.cinv(A23), RangeError);
  assert.throws(() => C.ctrace(A23), RangeError);
});

test('matrizes vazias são 0x0', () => {
  assert.deepEqual(C.cdet([]), { re: 1, im: 0 });
  assert.deepEqual(C.ctrace([]), { re: 0, im: 0 });
  assert.deepEqual(C.cinv([]), []);
  assert.deepEqual(C.csolve([], []), []);
  assert.deepEqual(C.ctranspose([]), []);
  assert.deepEqual(C.chermitian([]), []);
  assert.deepEqual(C.cmmul([], []), []);
  assert.deepEqual(C.czeros(0, 0), []);
  assert.deepEqual(C.ceye(0), []);
  assert.deepEqual(C.fromReal([]), []);
  assert.equal(C.cnorm1([]), 0);
  assert.equal(C.cnormInf([]), 0);
  assert.equal(C.cnormFro([]), 0);
});

test('construtores e cscale: zeros, identidade e escalar complexo', () => {
  iguais(C.czeros(2, 3), [[z(0), z(0), z(0)], [z(0), z(0), z(0)]]);
  iguais(C.ceye(2), [[z(1), z(0)], [z(0), z(1)]]);
  const A = [[z(1, 2)]];
  iguais(C.cscale(A, z(0, 1)), [[z(-2, 1)]]);
});

test('singular real: csolve e msolve lançam a mesma mensagem', () => {
  const R = [[1, 2], [2, 4]];
  assert.throws(() => M.msolve(R, M.eye(2)), { message: 'Matriz singular' });
  assert.throws(() => C.csolve(C.fromReal(R), C.ceye(2)), { message: 'Matriz singular' });
  assert.throws(() => C.cinv(C.fromReal(R)), { message: 'Matriz singular' });
});

test('módulo sem DOM, sem storage e sem rede, e só importa ./complex.js', () => {
  const src = readFileSync(new URL('../assets/js/core/cmatrix.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(document\.|window\.|localStorage|fetch\()/);
  const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./complex.js']);
});
