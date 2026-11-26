import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { residue, residuez, invres, invresz } from '../assets/js/core/residue.js';

// Fixtures geradas por scripts/reference/gen_residue.py a partir de scipy.signal (ver meta).
const FIX = decodificar(JSON.parse(readFileSync(new URL('./fixtures/core-residue.json', import.meta.url), 'utf8')));

function decodificar(x) {
  if (Array.isArray(x)) return x.map(decodificar);
  if (x === 'NaN') return NaN;
  if (x === 'Infinity') return Infinity;
  if (x === '-Infinity') return -Infinity;
  return x;
}

/*
 * Tolerâncias pela multiplicidade máxima do caso, medidas contra o SciPy (ver cabeçalho
 * de residue.js): polo simples ~1e-15; duplo ~1e-8; triplo ~3e-6 no polo e ~2e-5 relativo
 * nos resíduos. Os limites têm margem de ~10 a 30 vezes sobre o erro medido.
 */
const tolPorMult = (m) => (m === 1 ? 1e-10 : m === 2 ? 1e-7 : 1e-4);

function multMax(polos) {
  let melhor = 1, atual = 1;
  for (let i = 1; i < polos.length; i++) {
    atual = polos[i][0] === polos[i - 1][0] && polos[i][1] === polos[i - 1][1] ? atual + 1 : 1;
    melhor = Math.max(melhor, atual);
  }
  return melhor;
}

/** Agrupa a lista expandida em blocos de polos iguais consecutivos. */
function blocos(p, r) {
  const out = [];
  let i = 0;
  while (i < p.length) {
    let j = i;
    while (j + 1 < p.length && p[j + 1][0] === p[i][0] && p[j + 1][1] === p[i][1]) j++;
    out.push({ polo: p[i], res: r.slice(i, j + 1) });
    i = j + 1;
  }
  return out;
}

/** Compara resultado e SciPy por casamento de blocos: a ordem dos polos de mesmo módulo não é comparada. */
function assertMesmosPolosEResiduos(obtido, esperado, msg) {
  assert.equal(obtido.p.length, esperado.p.length, `${msg}: número de polos`);
  const E = blocos(esperado.p, esperado.r), O = blocos(obtido.p, obtido.r);
  assert.equal(O.length, E.length, `${msg}: número de polos distintos`);
  // O erro de um polo propaga-se aos resíduos dos demais: a tolerância é a do caso inteiro.
  const tol = tolPorMult(multMax(esperado.p));
  const usados = new Set();
  for (const e of E) {
    const m = e.res.length;
    let melhor = -1, dmin = Infinity;
    O.forEach((o, j) => {
      if (usados.has(j) || o.res.length !== m) return;
      const d = Math.hypot(o.polo[0] - e.polo[0], o.polo[1] - e.polo[1]);
      if (d < dmin) { dmin = d; melhor = j; }
    });
    assert.ok(melhor >= 0 && dmin <= tol, `${msg}: polo ${e.polo} sem correspondência (distância ${dmin})`);
    usados.add(melhor);
    O[melhor].res.forEach((z, k) => {
      const d = Math.hypot(z[0] - e.res[k][0], z[1] - e.res[k][1]);
      const escala = Math.max(1, Math.hypot(e.res[k][0], e.res[k][1]));
      assert.ok(d <= tol * escala, `${msg}: resíduo ${k} do polo ${e.polo}: diferença ${d}`);
    });
  }
}

function assertArrayClose(obtido, esperado, tol, msg = '') {
  assert.equal(obtido.length, esperado.length, `${msg}: comprimento`);
  obtido.forEach((v, i) => {
    const escala = Math.max(1, Math.abs(esperado[i]));
    assert.ok(Math.abs(v - esperado[i]) <= tol * escala, `${msg}[${i}]: ${v} vs ${esperado[i]}`);
  });
}

/* ---------- avaliação independente (aritmética complexa local ao teste) ---------- */
const cm = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const ca = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const cd = (a, b) => {
  const den = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / den, im: (a.im * b.re - a.re * b.im) / den };
};
const cabs = (z) => Math.hypot(z.re, z.im);
const C = (re, im = 0) => ({ re, im });

/** Horner com coeficientes da maior para a menor potência. */
function horner(p, x) {
  let y = C(0);
  for (const c of p) y = ca(cm(y, x), C(c));
  return y;
}
/** Soma Σ cₙ xⁿ com coeficientes em ordem crescente. */
function somaCrescente(p, x) {
  let y = C(0), pot = C(1);
  for (const c of p) { y = ca(y, cm(C(c), pot)); pot = cm(pot, x); }
  return y;
}
function potencia(z, n) {
  let out = C(1);
  for (let i = 0; i < n; i++) out = cm(out, z);
  return out;
}

/** Expansão de frações parciais em s: Σ rₙ/(s − pₙ)^j + k(s), com j = posição no bloco. */
function reconstruirS(out, s) {
  let soma = C(0), j = 0;
  out.p.forEach((p, n) => {
    j = n > 0 && out.p[n - 1][0] === p[0] && out.p[n - 1][1] === p[1] ? j + 1 : 1;
    const termo = cd(C(out.r[n][0], out.r[n][1]), potencia(ca(s, C(-p[0], -p[1])), j));
    soma = ca(soma, termo);
  });
  return ca(soma, horner(out.k, s));
}

/** Expansão em z⁻¹ (x = z⁻¹): Σ rₙ/(1 − pₙ x)^j + k(x), com k crescente. */
function reconstruirX(out, x) {
  let soma = C(0), j = 0;
  out.p.forEach((p, n) => {
    j = n > 0 && out.p[n - 1][0] === p[0] && out.p[n - 1][1] === p[1] ? j + 1 : 1;
    const termo = cd(C(out.r[n][0], out.r[n][1]), potencia(ca(C(1), cm(C(-p[0], -p[1]), x)), j));
    soma = ca(soma, termo);
  });
  return ca(soma, somaCrescente(out.k, x));
}

const PONTOS_S = [C(0.3, 0.7), C(-0.5, 2), C(1.7, -0.4), C(0.05, 0.01), C(-3, 0.2)];
const PONTOS_X = [C(0.3, 0.2), C(-0.7, 0.1), C(0.9, -0.4), C(0.05, 0.01), C(-1.3, 0.2)];

/* ---------- fixtures SciPy ---------- */

for (const c of FIX.cases.filter((x) => x.fn === 'residue' || x.fn === 'residuez')) {
  test(`SciPy ${c.fn}: ${c.id}`, () => {
    const i = c.input;
    const obtido = c.fn === 'residue'
      ? residue(i.b, i.a, i.tol, i.rtype)
      : residuez(i.b, i.a, i.tol, i.rtype);
    assertMesmosPolosEResiduos(obtido, c.expected, c.id);
    assertArrayClose(obtido.k, c.expected.k, 1e-9, `${c.id} k`);
  });
}

for (const c of FIX.cases.filter((x) => x.fn === 'invres' || x.fn === 'invresz')) {
  test(`SciPy ${c.fn}: ${c.id}`, () => {
    const i = c.input;
    const fn = c.fn === 'invres' ? invres : invresz;
    const obtido = fn(i.r, i.p, i.k, i.tol, i.rtype);
    assertArrayClose(obtido.b, c.expected.b, 1e-12, `${c.id} b`);
    assertArrayClose(obtido.a, c.expected.a, 1e-12, `${c.id} a`);
  });
}

for (const c of FIX.roundtrip) {
  test(`SciPy round-trip ${c.id}: invres(residue(b, a)) = b/a0, a/a0`, () => {
    const r = residue(c.input.b, c.input.a);
    const inv = invres(r.r, r.p, r.k);
    assertArrayClose(inv.b, c.expected.b, 1e-9, `${c.id} b`);
    assertArrayClose(inv.a, c.expected.a, 1e-9, `${c.id} a`);
  });
}

/* ---------- identidade analítica: reconstrução da função de transferência ---------- */

for (const c of FIX.cases.filter((x) => x.fn === 'residue' || x.fn === 'residuez')) {
  test(`identidade analítica ${c.fn}: ${c.id}`, () => {
    const i = c.input;
    const obtido = c.fn === 'residue'
      ? residue(i.b, i.a, i.tol, i.rtype)
      : residuez(i.b, i.a, i.tol, i.rtype);
    const m = multMax(obtido.p), tol = tolPorMult(m) * 10;
    if (c.fn === 'residue') {
      const b = i.b.slice(), a = i.a.slice();
      // Remove zeros à esquerda para avaliar b(s)/a(s) como o módulo faz.
      while (b.length > 1 && b[0] === 0) b.shift();
      while (a.length > 1 && a[0] === 0) a.shift();
      for (const s of PONTOS_S) {
        const verdade = cd(horner(b, s), horner(a, s));
        const recon = reconstruirS(obtido, s);
        const erro = cabs({ re: recon.re - verdade.re, im: recon.im - verdade.im });
        assert.ok(erro <= tol * Math.max(1, cabs(verdade)), `${c.id} em s=${s.re},${s.im}: erro ${erro}`);
      }
    } else {
      const b = i.b.slice(), a = i.a.slice();
      for (const x of PONTOS_X) {
        const verdade = cd(somaCrescente(b, x), somaCrescente(a, x));
        const recon = reconstruirX(obtido, x);
        const erro = cabs({ re: recon.re - verdade.re, im: recon.im - verdade.im });
        assert.ok(erro <= tol * Math.max(1, cabs(verdade)), `${c.id} em x=${x.re},${x.im}: erro ${erro}`);
      }
    }
  });
}

/* ---------- casos analíticos independentes do Python ---------- */

/** Resíduo do polo p (aproximado) no resultado, ou undefined. */
const resAt = (out, re, im) => {
  const n = out.p.findIndex((p) => Math.hypot(p[0] - re, p[1] - im) < 1e-9);
  return n < 0 ? undefined : out.r[n];
};

test('residue: 1/((s+1)(s+2)) = 1/(s+1) − 1/(s+2)', () => {
  const out = residue([1], [1, 3, 2]);
  assertArrayClose(resAt(out, -1, 0), [1, 0], 1e-12);
  assertArrayClose(resAt(out, -2, 0), [-1, 0], 1e-12);
  assert.deepEqual(out.k, []);
  // Polos ordenados por módulo crescente.
  assert.deepEqual(out.p.map((p) => p[0]), [-1, -2]);
});

test('residue: 1/(s²+2s+5) tem resíduos ∓j/4 nos polos −1 ± 2j', () => {
  const out = residue([1], [1, 2, 5]);
  assertArrayClose(resAt(out, -1, 2), [0, -0.25], 1e-12);
  assertArrayClose(resAt(out, -1, -2), [0, 0.25], 1e-12);
});

test('residue: 1/(s+1)² tem resíduos [0, 1] (j = 1, 2) em −1', () => {
  const out = residue([1], [1, 2, 1]);
  assert.equal(out.p.length, 2);
  assertArrayClose(out.r[0], [0, 0], 1e-12);
  assertArrayClose(out.r[1], [1, 0], 1e-12);
});

test('residue: 1/s³ tem polo triplo na origem com resíduos [0, 0, 1]', () => {
  const out = residue([1], [1, 0, 0, 0]);
  assert.deepEqual(out.p, [[0, 0], [0, 0], [0, 0]]);
  assertArrayClose(out.r[0], [0, 0], 1e-12);
  assertArrayClose(out.r[1], [0, 0], 1e-12);
  assertArrayClose(out.r[2], [1, 0], 1e-12);
});

test('residue: s²/(s+1) = (s − 1) + 1/(s+1): termo direto k = [1, −1]', () => {
  const out = residue([1, 0, 0], [1, 1]);
  assertArrayClose(out.k, [1, -1], 1e-12);
  assertArrayClose(resAt(out, -1, 0), [1, 0], 1e-12);
});

test('residue: polo triplo com erro medido (ver cabeçalho): (s+3)/(s+2)³ = 1/(s+2)² + 1/(s+2)³', () => {
  // Tolerância de polo triplo: as raízes de Aberth têm erro ~3e-6 (ver residue.js).
  const out = residue([1, 3], [1, 6, 12, 8]);
  assertArrayClose(out.r[0], [0, 0], 1e-4);
  assertArrayClose(out.r[1], [1, 0], 1e-4);
  assertArrayClose(out.r[2], [1, 0], 1e-4);
  out.p.forEach((p) => assert.ok(Math.hypot(p[0] + 2, p[1]) < 1e-4));
});

test('residuez: 1/(1 − 0.5 z⁻¹) tem r = 1 em p = 0.5', () => {
  const out = residuez([1], [1, -0.5]);
  assert.deepEqual(out.k, []);
  assertArrayClose(out.p[0], [0.5, 0], 1e-12);
  assertArrayClose(out.r[0], [1, 0], 1e-12);
});

test('residuez: 1/(1 − 0.5 z⁻¹)² tem resíduos [0, 1] no polo 0.5 (j = 1, 2)', () => {
  const out = residuez([1], [1, -1, 0.25]);
  assertArrayClose(out.p[0], [0.5, 0], 1e-12);
  assertArrayClose(out.p[1], [0.5, 0], 1e-12);
  assertArrayClose(out.r[0], [0, 0], 1e-12);
  assertArrayClose(out.r[1], [1, 0], 1e-12);
});

test('residuez: zeros em b com grau igual ao de a geram termo direto em z⁻¹', () => {
  // (1 + z⁻¹)/(1 − 0.5 z⁻¹) = −2 + 3/(1 − 0.5 z⁻¹) em ordem crescente de z⁻¹: k = [−2]
  const out = residuez([1, 1], [1, -0.5]);
  assertArrayClose(out.k, [-2], 1e-12);
  assertArrayClose(out.r[0], [3, 0], 1e-12);
});

test('agrupamento é absoluto (como o SciPy): polos a 0.01 de distância ficam separados com tol = 1e-3', () => {
  // (s + 1000)(s + 1000.01): distância 0.01 > tol; com tol relativa (1e-3·1000 = 1) agruparia.
  const out = residue([1], [1, 2000.01, 1000010]);
  assert.equal(out.p.length, 2);
  assert.notEqual(out.p[0][0], out.p[1][0]);
});

test('agrupamento com tol maior junta polos próximos num polo de multiplicidade 2', () => {
  const out = residue([1], [1, 2000.01, 1000010], 0.05);
  assert.equal(out.p.length, 2);
  assert.equal(out.p[0][0], out.p[1][0]);
  assert.equal(out.p[0][1], 0);
});

test('invres: grupo de polos consecutivos usa o primeiro polo, como _group_poles do SciPy', () => {
  // Limitação reproduzida: a média (-1.0002) não é usada; o denominador fica (s+1)².
  const { a } = invres([[1, 0], [1, 0]], [[-1, 0], [-1.0004, 0]], []);
  assertArrayClose(a, [1, 2, 1], 1e-12);
});

test('invres/invresz: reconstroem 1/(s+1)² + 2/(s+1) + 3 (com termo direto)', () => {
  const { b, a } = invres([[1, 0], [2, 0]], [[-1, 0], [-1, 0]], [3]);
  // b/a = [3(s+1)² + (s+1) + 2]/(s+1)²: b = [3, 7, 6], a = [1, 2, 1]
  assertArrayClose(b, [3, 7, 6], 1e-12);
  assertArrayClose(a, [1, 2, 1], 1e-12);
});

test('residue → invres: round-trip com termo direto e polo duplo (a0 ≠ 1)', () => {
  // b/a = (s⁴ + 3s² + 2s + 1)/(2(s+1)²): o módulo devolve b/a0 e a/a0.
  const r = residue([1, 0, 3, 2, 1], [2, 6, 4]);
  const inv = invres(r.r, r.p, r.k);
  assertArrayClose(inv.b, [0.5, 0, 1.5, 1, 0.5], 1e-9, 'b');
  assertArrayClose(inv.a, [1, 3, 2], 1e-9, 'a');
});

test('residue → invres: round-trip com par complexo conjugado (a0 ≠ 1)', () => {
  // b/a = (s² + 4)/(2(s² + 2s + 5)): polos −1 ± 2j.
  const r = residue([1, 0, 4], [2, 4, 10]);
  const inv = invres(r.r, r.p, r.k);
  assertArrayClose(inv.b, [0.5, 0, 2], 1e-9, 'b');
  assertArrayClose(inv.a, [1, 2, 5], 1e-9, 'a');
});

test('residuez → invresz: round-trip devolve b e a originais (a0 = 1)', () => {
  const b = [1, 0.5, 0.2], a = [1, -0.9, 0.81];
  const out = residuez(b, a);
  const inv = invresz(out.r, out.p, out.k);
  for (const x of PONTOS_X) {
    const verdade = cd(somaCrescente(b, x), somaCrescente(a, x));
    const recon = cd(somaCrescente(inv.b, x), somaCrescente(inv.a, x));
    assert.ok(cabs({ re: recon.re - verdade.re, im: recon.im - verdade.im }) <= 1e-9);
  }
});

test('p de residue e residuez vem ordenado por módulo crescente', () => {
  for (const c of FIX.cases.filter((x) => x.fn === 'residue' || x.fn === 'residuez')) {
    const i = c.input;
    const out = c.fn === 'residue' ? residue(i.b, i.a, i.tol, i.rtype) : residuez(i.b, i.a, i.tol, i.rtype);
    for (let n = 1; n < out.p.length; n++) {
      const m0 = Math.hypot(out.p[n - 1][0], out.p[n - 1][1]);
      const m1 = Math.hypot(out.p[n][0], out.p[n][1]);
      assert.ok(m1 >= m0 - 1e-15, `${c.id}: módulos fora de ordem em ${n}`);
    }
  }
});

test('numerador nulo: residue devolve zeros e polos ordenados sem termo direto', () => {
  const out = residue([0, 0], [1, 3, 2]);
  assert.deepEqual(out.r, [[0, 0], [0, 0]]);
  assert.deepEqual(out.p, [[-1, 0], [-2, 0]]);
  assert.deepEqual(out.k, []);
});

/* ---------- entradas inválidas ---------- */

test('residue: tipos e valores inválidos', () => {
  assert.throws(() => residue('abc', [1, 2]), TypeError);
  assert.throws(() => residue([1], [1, 'x']), TypeError);
  assert.throws(() => residue([1], [1, NaN]), RangeError);
  assert.throws(() => residue([1, Infinity], [1, 2]), RangeError);
  assert.throws(() => residue([1], []), RangeError);
  assert.throws(() => residue([1], [0, 0]), RangeError);
  assert.throws(() => residue([1], [1, 2], -1), RangeError);
  assert.throws(() => residue([1], [1, 2], NaN), RangeError);
  assert.throws(() => residue([1], [1, 2], 1e-3, 'mediana'), RangeError);
});

test('residuez: a[0] = 0, a vazio e rtype inválido', () => {
  assert.throws(() => residuez([1], [0, 1]), RangeError);
  assert.throws(() => residuez([1], [0, 0]), RangeError);
  assert.throws(() => residuez([1], []), RangeError);
  assert.throws(() => residuez([1], [1, -0.5], 1e-3, 'x'), RangeError);
});

test('invres / invresz: tamanhos, pares e conjugação', () => {
  assert.throws(() => invres([[1, 0]], [[-1, 0], [-2, 0]], []), RangeError);
  assert.throws(() => invres([], [], []), RangeError);
  assert.throws(() => invres([1], [[-1, 0]], []), TypeError);
  assert.throws(() => invresz([[1, 0]], [[0.5, 0], [0.2]], []), TypeError);
  // Resíduo complexo sem conjugado: b e a não são reais.
  assert.throws(() => invres([[0, 1]], [[-1, 0]], []), RangeError);
  assert.throws(() => invresz([[1, 1]], [[0.5, 0]], []), RangeError);
  assert.throws(() => invres([[1, 0]], [[-1, 0]], [1], -1), RangeError);
});

test('invres/invresz devolvem coeficientes reais quando os pares são conjugados', () => {
  const out = invres([[0, 0.25], [0, -0.25]], [[-1, 2], [-1, -2]], []);
  for (const v of [...out.b, ...out.a]) assert.equal(typeof v, 'number');
  assertArrayClose(out.a, [1, 2, 5], 1e-12);
});
