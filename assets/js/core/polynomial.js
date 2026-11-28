/**
 * Polinômios reais e complexos — módulo puro (ESM, sem DOM, sem dependências).
 *
 * Convenção: coeficientes da MAIOR para a MENOR potência, como no MATLAB
 * (polyval, roots, polyder, polyint, conv, deconv).
 * Ex.: [1, -3, 2] representa x² − 3x + 2.
 * Um polinômio é um array não vazio de números finitos.
 * Raízes são listas de pares [re, im].
 *
 * Origem: ptrim … matchRoots foram portadas verbatim de
 * simulators/control-systems/siso/app.html (aritmética, ordem de operações e
 * tolerâncias preservadas). As guardas de validação no início de cada função
 * apenas lançam erro para entradas inválidas e não alteram resultados numéricos.
 *
 * Atenção: polyFromRoots retorna somente a PARTE REAL de ∏(x − rₖ). Para um
 * conjunto de raízes fechado sob conjugação (polinômio real), a parte imaginária
 * se cancela e a parte real é o polinômio; sem essa simetria, o resultado é só
 * a parte real.
 *
 * Erros: TypeError para tipo incorreto; RangeError para array vazio, valor não
 * finito, tamanho inconsistente ou divisor nulo.
 */

import { qr } from './matrix.js';

const TWO_PI = 2 * Math.PI;

/* ------------------------- validação ------------------------- */

function assertNumber(x, name) {
  if (typeof x !== 'number') throw new TypeError(`${name} deve ser um número`);
  if (!Number.isFinite(x)) throw new RangeError(`${name} deve ser finito`);
}

function assertPoly(p, name = 'p') {
  if (!Array.isArray(p)) throw new TypeError(`${name} deve ser um array de coeficientes`);
  if (p.length === 0) throw new RangeError(`${name} não pode ser vazio`);
  for (let i = 0; i < p.length; i++) assertNumber(p[i], `${name}[${i}]`);
}

function assertPair(z, name) {
  if (!Array.isArray(z) || z.length !== 2) throw new TypeError(`${name} deve ser um par [re, im]`);
  assertNumber(z[0], `${name}[0]`);
  assertNumber(z[1], `${name}[1]`);
}

function assertPairs(list, name) {
  if (!Array.isArray(list)) throw new TypeError(`${name} deve ser uma lista de pares [re, im]`);
  for (let i = 0; i < list.length; i++) assertPair(list[i], `${name}[${i}]`);
}

/* ------------------------- aritmética de polinômios (portado) ------------------------- */

/**
 * Remove zeros à esquerda com tolerância relativa ao maior coeficiente.
 * @param {number[]} p
 * @param {number} [rel=1e-14]
 * @returns {number[]}
 */
export function ptrim(p, rel = 1e-14) {
  assertPoly(p, 'p');
  const mx = Math.max(...p.map(Math.abs));
  if (mx === 0) return [0];
  let i = 0;
  while (i < p.length - 1 && Math.abs(p[i]) <= rel * mx) i++;
  return p.slice(i);
}

/**
 * Produto (convolução) de dois polinômios.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function pmul(a, b) {
  assertPoly(a, 'a');
  assertPoly(b, 'b');
  const r = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j];
  return r;
}

/**
 * Soma de dois polinômios, alinhados pela direita (menor potência).
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function padd(a, b) {
  assertPoly(a, 'a');
  assertPoly(b, 'b');
  const n = Math.max(a.length, b.length), r = new Array(n).fill(0);
  a.forEach((v, i) => r[n - a.length + i] += v);
  b.forEach((v, i) => r[n - b.length + i] += v);
  return r;
}

/**
 * Multiplica todos os coeficientes por um escalar.
 * @param {number[]} a
 * @param {number} k
 * @returns {number[]}
 */
export function pscale(a, k) {
  assertPoly(a, 'a');
  assertNumber(k, 'k');
  return a.map(v => v * k);
}

/**
 * Grau efetivo (após ptrim).
 * @param {number[]} p
 * @returns {number}
 */
export function pdeg(p) {
  return ptrim(p).length - 1;
}

/**
 * Coeficiente líder efetivo (após ptrim).
 * @param {number[]} p
 * @returns {number}
 */
export function plead(p) {
  return ptrim(p)[0];
}

/**
 * Produto de uma lista de polinômios; lista vazia resulta em [1].
 * @param {number[][]} list
 * @returns {number[]}
 */
export function pprod(list) {
  if (!Array.isArray(list)) throw new TypeError('list deve ser um array de polinômios');
  list.forEach((p, i) => assertPoly(p, `list[${i}]`));
  return list.reduce((acc, p) => pmul(acc, p), [1]);
}

/**
 * Polinômio mônico cujas raízes são dadas. Retorna somente a PARTE REAL
 * (ver cabeçalho do módulo).
 * @param {number[][]} rs lista de pares [re, im]; lista vazia resulta em [1]
 * @returns {number[]}
 */
export function polyFromRoots(rs) {
  assertPairs(rs, 'rs');
  let re = [1], im = [0];
  for (const [a, b] of rs) {   // multiplica por (x - (a+jb))
    const nr = new Array(re.length + 1).fill(0), ni = new Array(re.length + 1).fill(0);
    for (let i = 0; i < re.length; i++) {
      nr[i] += re[i]; ni[i] += im[i];
      nr[i + 1] += -(re[i] * a - im[i] * b); ni[i + 1] += -(re[i] * b + im[i] * a);
    }
    re = nr; im = ni;
  }
  return re;
}

/* ------------------------- raízes (Aberth–Ehrlich, portado) ------------------------- */

/**
 * Raízes de um polinômio real. Graus 1 e 2 em forma fechada; graus ≥ 3 por Aberth.
 * Zeros na cauda (raízes nulas) são extraídos primeiro.
 * @param {number[]} pIn
 * @param {number[][]} [init] aproximações iniciais (pares [re, im]), usadas só se
 *   tiverem comprimento igual ao número de raízes restantes após as nulas
 * @returns {number[][]} pares [re, im]
 */
export function roots(pIn, init) {
  assertPoly(pIn, 'p');
  if (init != null) assertPairs(init, 'init');
  let p = ptrim(pIn.slice());
  const res = [];
  if (p.length <= 1) return res;
  while (p.length > 1 && p[p.length - 1] === 0) { res.push([0, 0]); p.pop(); }
  const n = p.length - 1;
  if (n === 0) return res;
  const c = p.map(v => v / p[0]);
  if (n === 1) { res.push([-c[1], 0]); return res; }
  if (n === 2) {
    const b = c[1], cc = c[2], disc = b * b - 4 * cc;
    if (disc >= 0) {
      const q = -(b + (b >= 0 ? 1 : -1) * Math.sqrt(disc)) / 2;
      const r1 = q, r2 = q !== 0 ? cc / q : 0;
      res.push([r1, 0], [r2, 0]);
    } else {
      res.push([-b / 2, Math.sqrt(-disc) / 2], [-b / 2, -Math.sqrt(-disc) / 2]);
    }
    return res;
  }
  return res.concat(aberth(c, n, init && init.length === n + res.length ? init.slice(res.length) : null));
}

/**
 * Método de Aberth–Ehrlich sobre coeficientes normalizados (c[0] = 1 quando
 * chamado por roots). Uso direto: c.length deve ser n + 1 e n ≥ 1.
 * @param {number[]} c coeficientes, maior potência primeiro
 * @param {number} n grau
 * @param {number[][]|null} [init] aproximações iniciais de comprimento n
 * @returns {number[][]} pares [re, im]
 */
export function aberth(c, n, init) {
  assertPoly(c, 'c');
  if (!Number.isInteger(n) || n < 1 || c.length !== n + 1) {
    throw new RangeError('aberth: n deve ser inteiro ≥ 1 com c.length === n + 1');
  }
  if (init != null) assertPairs(init, 'init');
  const d = []; for (let i = 0; i < n; i++) d.push(c[i] * (n - i));
  const zr = new Float64Array(n), zi = new Float64Array(n);
  if (init && init.length === n) {
    for (let i = 0; i < n; i++) {
      const m = 1 + Math.hypot(init[i][0], init[i][1]);
      zr[i] = init[i][0] + 1e-7 * m * Math.cos(i * 2.1);
      zi[i] = init[i][1] + 1e-7 * m * Math.sin(i * 2.1 + 0.3);
    }
  } else {
    let r0 = Math.pow(Math.abs(c[n]), 1 / n);
    let R = 0; for (let i = 1; i <= n; i++) R = Math.max(R, Math.pow(Math.abs(c[i]), 1 / i));
    if (!(r0 > 0) || !isFinite(r0)) r0 = R > 0 ? R : 1;
    for (let k = 0; k < n; k++) { const th = TWO_PI * k / n + 0.4; zr[k] = r0 * Math.cos(th); zi[k] = r0 * Math.sin(th); }
  }
  for (let it = 0; it < 400; it++) {
    let maxStep = 0;
    for (let i = 0; i < n; i++) {
      const x = zr[i], y = zi[i];
      let pr = 1, pi = 0;
      for (let k = 1; k <= n; k++) { const t = pr * x - pi * y + c[k]; pi = pr * y + pi * x; pr = t; }
      if (pr === 0 && pi === 0) continue;
      let dr = d[0], di = 0;
      for (let k = 1; k < n; k++) { const t = dr * x - di * y + d[k]; di = dr * y + di * x; dr = t; }
      const dm = dr * dr + di * di;
      let rr, ri;
      if (dm === 0) { rr = 1e-6 * (1 + Math.hypot(x, y)); ri = 0; }
      else { rr = (pr * dr + pi * di) / dm; ri = (pi * dr - pr * di) / dm; }
      let sr = 0, si = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = x - zr[j], dy = y - zi[j], m = dx * dx + dy * dy;
        if (m === 0) continue;
        sr += dx / m; si -= dy / m;
      }
      const tr = 1 - (rr * sr - ri * si), ti = -(rr * si + ri * sr), tm = tr * tr + ti * ti;
      if (tm === 0) continue;
      const wr = (rr * tr + ri * ti) / tm, wi = (ri * tr - rr * ti) / tm;
      if (!isFinite(wr) || !isFinite(wi)) continue;
      zr[i] -= wr; zi[i] -= wi;
      const st = Math.hypot(wr, wi) / (1 + Math.hypot(zr[i], zi[i]));
      if (st > maxStep) maxStep = st;
    }
    if (maxStep < 1e-14) break;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    let im = zi[i];
    if (Math.abs(im) < 1e-7 * (1 + Math.abs(zr[i]))) im = 0;
    out.push([zr[i], im]);
  }
  return out;
}

/**
 * Reordena `next` para casar, por proximidade, com a ordem de `prev`
 * (útil para acompanhar raízes entre passos). Sem `prev` compatível, devolve `next`.
 * @param {number[][]|null} prev
 * @param {number[][]} next
 * @returns {number[][]}
 */
export function matchRoots(prev, next) {
  assertPairs(next, 'next');
  if (prev != null) assertPairs(prev, 'prev');
  if (!prev || prev.length !== next.length) return next;
  const used = new Array(next.length).fill(false), out = [];
  for (const p of prev) {
    let best = -1, bd = Infinity;
    for (let j = 0; j < next.length; j++) {
      if (used[j]) continue;
      const dd = Math.hypot(p[0] - next[j][0], p[1] - next[j][1]);
      if (dd < bd) { bd = dd; best = j; }
    }
    used[best] = true; out.push(next[best]);
  }
  return out;
}

/* ------------------------- novas funções (semântica MATLAB) ------------------------- */

/**
 * Avalia p(x) para x real (Horner), como MATLAB polyval.
 * @param {number[]} p
 * @param {number} x
 * @returns {number}
 */
export function polyval(p, x) {
  assertPoly(p, 'p');
  assertNumber(x, 'x');
  let y = p[0];
  for (let i = 1; i < p.length; i++) y = y * x + p[i];
  return y;
}

/**
 * Avalia p(z) para z complexo (Horner complexo).
 * @param {number[]} p
 * @param {number[]} z par [re, im]
 * @returns {number[]} par [re, im]
 */
export function polyvalComplex(p, z) {
  assertPoly(p, 'p');
  assertPair(z, 'z');
  const x = z[0], y = z[1];
  let pr = p[0], pi = 0;
  for (let k = 1; k < p.length; k++) { const t = pr * x - pi * y + p[k]; pi = pr * y + pi * x; pr = t; }
  return [pr, pi];
}

/**
 * Derivada de p. Zeros à esquerda são removidos antes; derivada de constante é [0].
 * @param {number[]} p
 * @returns {number[]}
 */
export function polyder(p) {
  assertPoly(p, 'p');
  let s = 0;
  while (s < p.length - 1 && p[s] === 0) s++;
  const q = p.slice(s), n = q.length - 1;
  if (n === 0) return [0];
  const d = new Array(n);
  for (let i = 0; i < n; i++) d[i] = q[i] * (n - i);
  return d;
}

/**
 * Primitiva de p com constante de integração k (MATLAB polyint).
 * @param {number[]} p
 * @param {number} [k=0]
 * @returns {number[]}
 */
export function polyint(p, k = 0) {
  assertPoly(p, 'p');
  assertNumber(k, 'k');
  const n = p.length - 1, r = new Array(n + 2);
  for (let i = 0; i <= n; i++) r[i] = p[i] / (n - i + 1);
  r[n + 1] = k;
  return r;
}

/**
 * Convolução de coeficientes (igual a pmul).
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function conv(a, b) {
  return pmul(a, b);
}

/**
 * Divisão polinomial: b = conv(a, q) + r (MATLAB deconv).
 * `b` é o dividendo e `a` o divisor. Zeros à esquerda do divisor são removidos
 * (igualdade exata com zero); divisor nulo lança RangeError.
 * @param {number[]} b dividendo
 * @param {number[]} a divisor
 * @returns {{q: number[], r: number[]}} quociente e resto (resto de comprimento ≥ 1)
 */
export function deconv(b, a) {
  assertPoly(b, 'b');
  assertPoly(a, 'a');
  let s = 0;
  while (s < a.length && a[s] === 0) s++;
  if (s === a.length) throw new RangeError('deconv: divisor nulo');
  const d = a.slice(s);
  const r = b.slice();
  const m = d.length, n = r.length;
  if (n < m) return { q: [0], r: b.slice() };
  const nq = n - m + 1, q = new Array(nq);
  for (let i = 0; i < nq; i++) {
    const c = r[i] / d[0];
    q[i] = c;
    for (let j = 0; j < m; j++) r[i + j] -= c * d[j];
  }
  const rem = r.slice(nq);
  return { q, r: rem.length ? rem : [0] };
}

/* ------------------------- polyfit (mínimos quadrados) ------------------------- */

/**
 * Ajuste polinomial por mínimos quadrados, como `[p,S,mu] = polyfit(x,y,n)` do MATLAB.
 *
 * Resolve min ‖V·p − y‖₂ com V = Vandermonde (colunas xⁿ … x⁰) por QR de Householder
 * (sem equações normais, portanto sem elevar o condicionamento ao quadrado).
 * Coeficientes em ordem decrescente, como em polyval.
 *
 * Opções (4º argumento, objeto): `{ normalize: true }` centraliza e escala x como o
 * MATLAB: usa x̂ = (x − μ₁)/μ₂ com μ = [média(x), desvio(x) (N−1)]; os coeficientes
 * retornados valem na variável x̂ (avalie com polyval(p, (x − mu[0]) / mu[1])).
 *
 * Retorno `{ p, S, mu }`:
 *  - p: n+1 coeficientes.
 *  - S.R: fator triangular superior (n+1)×(n+1) da QR de V. O sinal das linhas pode
 *    diferir do MATLAB (convenção de Householder); R'R = V'V vale igualmente.
 *  - S.df: graus de liberdade do resíduo, max(0, N − (n+1)).
 *  - S.normr: norma 2 do resíduo y − V·p.
 *  - S.rcond: 1/cond₁(R), com R⁻¹ calculada explicitamente.
 *  - S.illConditioned: true quando rcond < eps; é o aviso "mal condicionado" do
 *    MATLAB (neste caso, tente `normalize: true`). Não lança erro.
 *  - mu: [média, desvio] com normalize; null caso contrário.
 *
 * Erros: TypeError (tipos); RangeError se x e y diferem em tamanho, n não é inteiro ≥ 0,
 * n ≥ número de valores distintos de x (solução não única), ou, com normalize, x
 * tem desvio nulo.
 *
 * @param {number[]} x abscissas
 * @param {number[]} y ordenadas
 * @param {number} n grau
 * @param {{normalize?: boolean}} [options]
 * @returns {{p: number[], S: {R: number[][], df: number, normr: number, rcond: number, illConditioned: boolean}, mu: (number[]|null)}}
 */
export function polyfit(x, y, n, options) {
  assertPoly(x, 'x');
  assertPoly(y, 'y');
  if (x.length !== y.length) throw new RangeError('polyfit: x e y devem ter o mesmo tamanho');
  assertNumber(n, 'n');
  if (!Number.isInteger(n) || n < 0) throw new RangeError('polyfit: n deve ser inteiro ≥ 0');
  let normalize = false;
  if (options !== undefined && options !== null) {
    if (typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options deve ser um objeto');
    if (options.normalize !== undefined && typeof options.normalize !== 'boolean') throw new TypeError('options.normalize deve ser booleano');
    normalize = options.normalize === true;
  }
  const m = x.length, k = n + 1;
  const distinct = new Set(x).size;
  if (n >= distinct) {
    throw new RangeError(`polyfit: grau ${n} exige pelo menos ${k} valores distintos de x (há ${distinct}); solução não única`);
  }
  let xs = x, mu = null;
  if (normalize) {
    let mean = 0;
    for (let i = 0; i < m; i++) mean += x[i];
    mean /= m;
    let ss = 0;
    for (let i = 0; i < m; i++) ss += (x[i] - mean) * (x[i] - mean);
    const sd = Math.sqrt(ss / (m - 1));
    if (!(sd > 0)) throw new RangeError('polyfit: normalize exige x com desvio padrão não nulo');
    mu = [mean, sd];
    xs = x.map((v) => (v - mean) / sd);
  }
  // A (m×k) Vandermonde, colunas de potência decrescente; b = cópia de y.
  const A = new Array(m);
  for (let i = 0; i < m; i++) {
    const row = new Array(k);
    row[k - 1] = 1;
    for (let j = k - 2; j >= 0; j--) row[j] = row[j + 1] * xs[i];
    A[i] = row;
  }
  // QR econômica de A (Householder, matrix.js): A = Q·R, Q m×k, R k×k.
  const { Q, R } = qr(A, { econ: true });
  for (let i = 0; i < k; i++) {
    if (R[i][i] === 0) throw new RangeError('polyfit: matriz de Vandermonde de posto deficiente; solução não única');
  }
  // Substituição regressiva R p = Qᵀy.
  const qty = new Array(k);
  for (let j = 0; j < k; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += Q[i][j] * y[i];
    qty[j] = s;
  }
  const p = new Array(k);
  for (let i = k - 1; i >= 0; i--) {
    let s = qty[i];
    for (let j = i + 1; j < k; j++) s -= R[i][j] * p[j];
    p[i] = s / R[i][i];
  }
  // Norma do resíduo y − A·p.
  let normr = 0;
  for (let i = 0; i < m; i++) {
    let s = y[i];
    for (let j = 0; j < k; j++) s -= A[i][j] * p[j];
    normr = Math.hypot(normr, s);
  }
  // rcond = 1/(‖R‖₁·‖R⁻¹‖₁), R⁻¹ por substituição regressiva coluna a coluna.
  let normR = 0, normInv = 0;
  for (let j = 0; j < k; j++) {
    let s = 0;
    for (let i = 0; i <= j; i++) s += Math.abs(R[i][j]);
    normR = Math.max(normR, s);
    const col = new Array(k).fill(0);
    for (let i = j; i >= 0; i--) {
      let t = i === j ? 1 : 0;
      for (let l = i + 1; l <= j; l++) t -= R[i][l] * col[l];
      col[i] = t / R[i][i];
    }
    let cs = 0;
    for (let i = 0; i <= j; i++) cs += Math.abs(col[i]);
    normInv = Math.max(normInv, cs);
  }
  const rcond = 1 / (normR * normInv);
  const S = { R, df: Math.max(0, m - k), normr, rcond, illConditioned: !(rcond >= Number.EPSILON) };
  return { p, S, mu };
}
