/**
 * EEVL · Frações parciais (resíduos) — módulo puro (ESM, sem DOM, sem dependências).
 *
 * Porte do algoritmo de scipy.signal (SciPy 1.18.1, licença BSD-3-Clause): residue,
 * residuez, invres e invresz, com a mesma ordem dos polos, o mesmo agrupamento de polos
 * repetidos e o mesmo termo direto k. Polos e resíduos são pares [re, im].
 *
 * Convenções:
 * - residue / invres (variável s): coeficientes da MAIOR para a MENOR potência.
 *     B(s)/A(s) = k(s) + Σᵢ rᵢ / (s − pᵢ)^jᵢ
 * - residuez / invresz (variável z⁻¹): coeficientes b e a na ordem CRESCENTE de potências
 *   de z⁻¹ (b[0] + b[1] z⁻¹ + …). k também cresce em z⁻¹.
 *     B/A = k(z⁻¹) + Σᵢ rᵢ / (1 − pᵢ z⁻¹)^jᵢ
 * - Polo repetido m vezes aparece m vezes consecutivas; dentro do bloco jᵢ = 1, 2, …, m.
 * - residue e residuez devolvem polos por módulo crescente. Empates de módulo (ex.: par
 *   conjugado) são desempatados por parte real e depois imaginária. O SciPy usa a ordem de
 *   np.roots, que não é reproduzível aqui: a comparação com o SciPy é feita por casamento de polos.
 *
 * Agrupamento (unique_roots do SciPy, usado por residue e residuez): guloso, na ordem de
 * entrada, com distância euclidiana ABSOLUTA ≤ tol (não relativa). O valor do grupo é a média,
 * o mínimo ou o máximo (mínimo/máximo lexicográficos: parte real e depois imaginária).
 *
 * invres e invresz agrupam polos iguais apenas CONSECUTIVOS (_group_poles do SciPy).
 * Reprodução deliberada de um comportamento do SciPy 1.18.1: o valor do grupo é o PRIMEIRO
 * polo do grupo, e rtype é validado mas não altera o resultado. Ver o caso
 * inv_agrupamento_avg_quirk em tests/fixtures/core-residue.json.
 *
 * Limitações:
 * - Os polos vêm de roots() de polynomial.js (Aberth), e não de autovalores como em np.roots.
 *   Medido contra o SciPy (tests/fixtures/core-residue.json): polos simples ~1e-15; polos
 *   duplos ~1e-8 no polo e ~5e-9 relativo nos resíduos; polo triplo ~3e-6 no polo e ~2e-5
 *   relativo nos resíduos. A raiz de multiplicidade m é conhecida com erro ~ε^(1/m) e o
 *   agrupamento pela média não cancela esse erro por completo.
 * - Polos separados por menos de tol são tratados como um único polo repetido.
 * - Frações parciais com polos próximos ou de alta multiplicidade são mal condicionadas.
 * - invres e invresz devolvem b e a reais: RangeError se algum coeficiente tiver parte
 *   imaginária não desprezível (polos ou resíduos não conjugados).
 * - Coeficientes de invres podem conter zeros à esquerda, como no SciPy.
 * - roots() remove, pelo critério relativo de ptrim, coeficientes líderes minúsculos de a.
 *
 * Erros: TypeError para tipo incorreto; RangeError para lista vazia onde não é aceita,
 * valor não finito, tol < 0, rtype desconhecido, denominador nulo, a[0] = 0 em residuez,
 * e para r e p de tamanhos diferentes.
 */

import { roots } from './polynomial.js';
import { add, sub, mul, div } from './complex.js';

const RTYPES = new Set(['max', 'maximum', 'min', 'minimum', 'avg', 'mean']);
/** atol de np.allclose(r[0], 0, rtol=1e-14), usado por np.polydiv para aparar o resto. */
const POLYDIV_ATOL = 1e-8;
/** Parte imaginária relativa aceita nos coeficientes de saída de invres/invresz. */
const IMAG_TOL = 1e-9;

/* ------------------------- validação ------------------------- */

function assertNum(x, nome) {
  if (typeof x !== 'number') throw new TypeError(`${nome} deve ser um número`);
  if (!Number.isFinite(x)) throw new RangeError(`${nome} deve ser finito`);
}

function assertRealList(lista, nome, vazioOk) {
  if (!Array.isArray(lista)) throw new TypeError(`${nome} deve ser um array de números`);
  if (!vazioOk && lista.length === 0) throw new RangeError(`${nome} não pode ser vazio`);
  lista.forEach((x, i) => assertNum(x, `${nome}[${i}]`));
}

function assertPairList(lista, nome) {
  if (!Array.isArray(lista)) throw new TypeError(`${nome} deve ser uma lista de pares [re, im]`);
  lista.forEach((z, i) => {
    if (!Array.isArray(z) || z.length !== 2) throw new TypeError(`${nome}[${i}] deve ser um par [re, im]`);
    assertNum(z[0], `${nome}[${i}][0]`);
    assertNum(z[1], `${nome}[${i}][1]`);
  });
}

function assertTolRtype(tol, rtype) {
  assertNum(tol, 'tol');
  if (tol < 0) throw new RangeError('tol deve ser ≥ 0');
  if (typeof rtype !== 'string' || !RTYPES.has(rtype)) {
    throw new RangeError(`rtype deve ser um de: ${[...RTYPES].join(', ')}`);
  }
}

/* ------------------------- complexos e listas ------------------------- */

const C = (re, im = 0) => ({ re, im });
const neg = (z) => C(-z.re, -z.im);
const toC = (lista) => lista.map((x) => C(x, 0));
const pairsToC = (lista) => lista.map(([re, im]) => C(re, im));
const toPairs = (lista) => lista.map((z) => [z.re, z.im]);
const modulo = (z) => Math.hypot(z.re, z.im);

/** np.trim_zeros(x, 'f'): remove zeros exatos à esquerda. */
function trimFront(lista) {
  let s = 0;
  while (s < lista.length && lista[s] === 0) s++;
  return lista.slice(s);
}

/** np.trim_zeros(x, 'b'): remove zeros exatos à direita. */
function trimBack(lista) {
  let e = lista.length;
  while (e > 0 && lista[e - 1] === 0) e--;
  return lista.slice(0, e);
}

function lexCmp(a, b) {
  if (a.re !== b.re) return a.re < b.re ? -1 : 1;
  if (a.im !== b.im) return a.im < b.im ? -1 : 1;
  return 0;
}

/** Ordena por módulo; empates por parte real e depois imaginária. Devolve a permutação. */
function ordenarPorModulo(lista) {
  const chave = lista.map(modulo);
  const order = lista.map((_, i) => i);
  order.sort((i, j) => (chave[i] - chave[j]) || lexCmp(lista[i], lista[j]));
  return { sorted: order.map((i) => lista[i]), order };
}

/** Repete cada polo unico tantas vezes quanto sua multiplicidade. */
function expandir(unicos, mult) {
  const out = [];
  unicos.forEach((z, i) => { for (let t = 0; t < mult[i]; t++) out.push(z); });
  return out;
}

/* ------------------------- polinômios complexos (descendentes) ------------------------- */

function pPad(p, n) {
  if (p.length >= n) return p;
  return [...Array.from({ length: n - p.length }, () => C(0)), ...p];
}

function pMul(p, q) {
  const out = Array.from({ length: p.length + q.length - 1 }, () => C(0));
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) out[i + j] = add(out[i + j], mul(p[i], q[j]));
  }
  return out;
}

/** Soma alinhada à direita (np.polyadd). */
function pAdd(p, q) {
  const n = Math.max(p.length, q.length);
  const a = pPad(p, n), b = pPad(q, n);
  return a.map((z, i) => add(z, b[i]));
}

/** Subtração alinhada à direita (np.polysub). */
function pSub(p, q) {
  const n = Math.max(p.length, q.length);
  const a = pPad(p, n), b = pPad(q, n);
  return a.map((z, i) => sub(z, b[i]));
}

const pScale = (p, z) => p.map((c) => mul(c, z));

/** Avaliação de Horner (np.polyval). */
function pVal(p, x) {
  let y = C(0);
  for (const c of p) y = add(mul(y, x), c);
  return y;
}

/**
 * Divisão polinomial de np.polydiv: u = q·v + r.
 * Como no NumPy, o resto perde zeros à esquerda com |r₀| ≤ 1e-8 (mantendo ao menos 1 coeficiente).
 */
function pDiv(u, v) {
  const m = u.length - 1, n = v.length - 1;
  const escala = div(C(1), v[0]);
  const q = Array.from({ length: Math.max(m - n + 1, 1) }, () => C(0));
  const r = u.map((z) => C(z.re, z.im));
  for (let k = 0; k <= m - n; k++) {
    const d = mul(escala, r[k]);
    q[k] = d;
    for (let j = 0; j <= n; j++) r[k + j] = sub(r[k + j], mul(d, v[j]));
  }
  while (r.length > 1 && modulo(r[0]) <= POLYDIV_ATOL) r.shift();
  return { q, r };
}

function potInteira(z, n) {
  let out = C(1);
  for (let i = 0; i < n; i++) out = mul(out, z);
  return out;
}

/* ------------------------- agrupamento e resíduos (porte do SciPy) ------------------------- */

/** Redutor do grupo (np.min/np.max lexicográficos ou np.mean), como em unique_roots. */
function redutor(rtype) {
  if (rtype === 'max' || rtype === 'maximum') {
    return (g) => g.reduce((m, z) => (lexCmp(z, m) > 0 ? z : m));
  }
  if (rtype === 'min' || rtype === 'minimum') {
    return (g) => g.reduce((m, z) => (lexCmp(z, m) < 0 ? z : m));
  }
  return (g) => {
    let sr = 0, si = 0;
    for (const z of g) { sr += z.re; si += z.im; }
    return C(sr / g.length, si / g.length);
  };
}

/** unique_roots: agrupamento guloso na ordem de entrada, distância absoluta ≤ tol. */
function raizesUnicas(pontos, tol, rtype) {
  const red = redutor(rtype);
  const usado = pontos.map(() => false);
  const unicos = [], mult = [];
  for (let i = 0; i < pontos.length; i++) {
    if (usado[i]) continue;
    const grupo = [];
    for (let j = 0; j < pontos.length; j++) {
      if (!usado[j] && Math.hypot(pontos[j].re - pontos[i].re, pontos[j].im - pontos[i].im) <= tol) {
        grupo.push(j);
      }
    }
    unicos.push(red(grupo.map((j) => pontos[j])));
    mult.push(grupo.length);
    for (const j of grupo) usado[j] = true;
  }
  return { unicos, mult };
}

/** _group_poles: agrupa polos CONSECUTIVOS; o valor do grupo é o primeiro polo (ver cabeçalho). */
function agruparConsecutivos(p, tol, rtype) {
  const red = redutor(rtype);
  const unicos = [], mult = [];
  let polo = p[0];
  let bloco = [polo];
  for (let i = 1; i < p.length; i++) {
    if (Math.hypot(p[i].re - polo.re, p[i].im - polo.im) <= tol) {
      bloco.push(polo);
    } else {
      unicos.push(red(bloco));
      mult.push(bloco.length);
      polo = p[i];
      bloco = [polo];
    }
  }
  unicos.push(red(bloco));
  mult.push(bloco.length);
  return { unicos, mult };
}

/**
 * _compute_factors: fatores do denominador por polo. Sem potências: um fator por polo (D/(s−p)^m).
 * Com potências: m fatores por polo, D/(s−p)^j para j = 1..m, na ordem de residuos.
 * Devolve também D = Π(s − pᵢ)^mᵢ.
 */
function fatores(rts, mult, comPotencias) {
  const n = rts.length;
  const pre = [[C(1)]];
  let cur = [C(1)];
  for (let i = n - 1; i >= 1; i--) {
    const mono = [C(1), neg(rts[i])];
    for (let t = 0; t < mult[i]; t++) cur = pMul(cur, mono);
    pre.push(cur);
  }
  const suf = pre.reverse(); // suf[i] = Π_{j>i} (s − pⱼ)^mⱼ
  const out = [];
  cur = [C(1)];
  for (let i = 0; i < n; i++) {
    const mono = [C(1), neg(rts[i])];
    const bloco = [];
    for (let t = 0; t < mult[i]; t++) {
      if (t === 0 || comPotencias) bloco.push(pMul(cur, suf[i]));
      cur = pMul(cur, mono);
    }
    out.push(...bloco.reverse());
  }
  return { fatores: out, denom: cur };
}

/** _compute_residues: resíduos de Laurent por polo; blocos de polo repetido na ordem j = 1..m. */
function residuos(rts, mult, numerador) {
  const { fatores: fs } = fatores(rts, mult, false);
  const res = [];
  rts.forEach((polo, i) => {
    const m = mult[i];
    if (m === 1) {
      res.push(div(pVal(numerador, polo), pVal(fs[i], polo)));
      return;
    }
    let numer = numerador.map((z) => C(z.re, z.im)); // cópia por polo, como no SciPy
    const mono = [C(1), neg(polo)];
    const { q: fator, r: d } = pDiv(fs[i], mono);
    const bloco = [];
    for (let t = 0; t < m; t++) {
      const { q, r: nr } = pDiv(numer, mono);
      numer = q;
      const rr = div(nr[0], d[0]);
      numer = pSub(numer, pScale(fator, rr));
      bloco.push(rr);
    }
    res.push(...bloco.reverse());
  });
  return res;
}

/** Converte polinômio complexo em reais; falha se a parte imaginária não for desprezível. */
function reaisOuErro(p, nome) {
  let escala = 1;
  for (const z of p) escala = Math.max(escala, Math.abs(z.re));
  for (const z of p) {
    if (Math.abs(z.im) > IMAG_TOL * escala) {
      throw new RangeError(`${nome} complexo: polos e resíduos devem formar pares conjugados`);
    }
  }
  return p.map((z) => z.re);
}

/* ------------------------- API ------------------------- */

/**
 * Frações parciais de B(s)/A(s) (scipy.signal.residue).
 * @param {number[]} b numerador, da maior para a menor potência de s (pode ser vazio)
 * @param {number[]} a denominador, da maior para a menor potência de s
 * @param {number} [tol=1e-3] tolerância absoluta para agrupar polos repetidos
 * @param {'avg'|'min'|'max'|'mean'|'minimum'|'maximum'} [rtype='avg'] valor do grupo
 * @returns {{r: number[][], p: number[][], k: number[]}} resíduos, polos (repetidos) e termo direto
 */
export function residue(b, a, tol = 1e-3, rtype = 'avg') {
  assertRealList(b, 'b', true);
  assertRealList(a, 'a', true);
  assertTolRtype(tol, rtype);
  const bb = trimFront(b), aa = trimFront(a);
  if (aa.length === 0) throw new RangeError('Denominador a é zero.');
  const polos = pairsToC(roots(aa));
  if (bb.length === 0) {
    const { sorted } = ordenarPorModulo(polos);
    return { r: sorted.map(() => [0, 0]), p: toPairs(sorted), k: [] };
  }
  const A = toC(aa);
  let resto = toC(bb);
  let k = [];
  if (resto.length >= A.length) ({ q: k, r: resto } = pDiv(resto, A));
  const { unicos, mult } = raizesUnicas(polos, tol, rtype);
  const { sorted, order } = ordenarPorModulo(unicos);
  const multOrd = order.map((i) => mult[i]);
  const res = residuos(sorted, multOrd, resto);
  const a0 = aa[0];
  return {
    r: res.map((z) => [z.re / a0, z.im / a0]),
    p: toPairs(expandir(sorted, multOrd)),
    k: k.map((z) => z.re),
  };
}

/**
 * Frações parciais em z⁻¹ (scipy.signal.residuez): B/A = k(z⁻¹) + Σ rᵢ/(1 − pᵢ z⁻¹)^jᵢ.
 * @param {number[]} b numerador em ordem crescente de z⁻¹ (pode ser vazio)
 * @param {number[]} a denominador em ordem crescente de z⁻¹; a[0] ≠ 0
 * @param {number} [tol=1e-3] tolerância absoluta para agrupar polos repetidos
 * @param {string} [rtype='avg'] valor do grupo
 * @returns {{r: number[][], p: number[][], k: number[]}} k em ordem crescente de z⁻¹
 */
export function residuez(b, a, tol = 1e-3, rtype = 'avg') {
  assertRealList(b, 'b', true);
  assertRealList(a, 'a', true);
  assertTolRtype(tol, rtype);
  const bb = trimBack(b), aa = trimBack(a);
  if (aa.length === 0) throw new RangeError('Denominador a é zero.');
  if (aa[0] === 0) throw new RangeError('Primeiro coeficiente de a deve ser não nulo.');
  const polos = pairsToC(roots(aa));
  if (bb.length === 0) {
    const { sorted } = ordenarPorModulo(polos);
    return { r: sorted.map(() => [0, 0]), p: toPairs(sorted), k: [] };
  }
  const bRev = toC(bb).reverse(), aRev = toC(aa).reverse();
  let resto = bRev;
  let kRev = [];
  if (bRev.length >= aRev.length) ({ q: kRev, r: resto } = pDiv(bRev, aRev));
  const { unicos, mult } = raizesUnicas(polos, tol, rtype);
  const { sorted, order } = ordenarPorModulo(unicos);
  const multOrd = order.map((i) => mult[i]);
  const res = residuos(sorted.map((z) => div(C(1), z)), multOrd, resto);
  const pExp = expandir(sorted, multOrd);
  const potencias = [];
  for (const m of multOrd) for (let t = 1; t <= m; t++) potencias.push(t);
  const a0 = aRev[0].re;
  const r = res.map((z, i) => mul(z, div(potInteira(neg(pExp[i]), potencias[i]), C(a0))));
  return {
    r: toPairs(r),
    p: toPairs(pExp),
    k: kRev.slice().reverse().map((z) => z.re),
  };
}

/**
 * Reconstrói B(s)/A(s) a partir de resíduos (scipy.signal.invres). A é mônico.
 * Polos repetidos devem vir consecutivos, como na saída de residue.
 * @param {number[][]} r resíduos [re, im]
 * @param {number[][]} p polos [re, im], mesmo tamanho de r
 * @param {number[]} k termo direto (zeros à esquerda são ignorados)
 * @param {number} [tol=1e-3] tolerância absoluta para agrupar polos consecutivos
 * @param {string} [rtype='avg'] validado; ver limitação sobre o valor do grupo
 * @returns {{b: number[], a: number[]}} b e a reais, da maior para a menor potência de s
 */
export function invres(r, p, k, tol = 1e-3, rtype = 'avg') {
  assertPairList(r, 'r');
  assertPairList(p, 'p');
  assertRealList(k, 'k', true);
  assertTolRtype(tol, rtype);
  if (p.length === 0) throw new RangeError('p não pode ser vazio');
  if (r.length !== p.length) throw new RangeError('r e p devem ter o mesmo tamanho');
  const rc = pairsToC(r), pc = pairsToC(p);
  const kk = trimFront(k);
  const { unicos, mult } = agruparConsecutivos(pc, tol, rtype);
  const { fatores: fs, denom } = fatores(unicos, mult, true);
  let num = kk.length === 0 ? [C(0)] : pMul(toC(kk), denom);
  rc.forEach((res, i) => { num = pAdd(num, pScale(fs[i], res)); });
  return { b: reaisOuErro(num, 'b'), a: reaisOuErro(denom, 'a') };
}

/**
 * Reconstrói B/A em z⁻¹ a partir de resíduos (scipy.signal.invresz). Convenção de residuez.
 * @param {number[][]} r resíduos [re, im]
 * @param {number[][]} p polos [re, im], mesmo tamanho de r
 * @param {number[]} k termo direto em ordem crescente de z⁻¹ (zeros finais são ignorados)
 * @param {number} [tol=1e-3] tolerância absoluta para agrupar polos consecutivos
 * @param {string} [rtype='avg'] validado; ver limitação sobre o valor do grupo
 * @returns {{b: number[], a: number[]}} b e a reais, em ordem crescente de z⁻¹
 */
export function invresz(r, p, k, tol = 1e-3, rtype = 'avg') {
  assertPairList(r, 'r');
  assertPairList(p, 'p');
  assertRealList(k, 'k', true);
  assertTolRtype(tol, rtype);
  if (p.length === 0) throw new RangeError('p não pode ser vazio');
  if (r.length !== p.length) throw new RangeError('r e p devem ter o mesmo tamanho');
  const rc = pairsToC(r), pc = pairsToC(p);
  const kk = trimBack(k);
  const { unicos, mult } = agruparConsecutivos(pc, tol, rtype);
  const { fatores: fs, denom } = fatores(unicos, mult, true);
  let num = kk.length === 0 ? [C(0)] : pMul(toC(kk).reverse(), denom.slice().reverse());
  rc.forEach((res, i) => { num = pAdd(num, pScale(fs[i].slice().reverse(), res)); });
  return { b: reaisOuErro(num.slice().reverse(), 'b'), a: reaisOuErro(denom, 'a') };
}
