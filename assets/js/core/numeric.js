/**
 * EEVL · Núcleo numérico puro (vetores de números reais) · v1.0.0
 *
 * Funções elementares de análise numérica com semântica de MATLAB/GNU Octave quando há nome
 * equivalente. Vetores são Array ou Float64Array de números finitos, em unidades SI.
 * Índices são 0-based no código (MATLAB/Octave documentam em 1-based).
 *
 * Hipóteses e normalizações:
 * - trapz/cumtrapz: regra do trapézio composta, ∫y dx ≈ Σ (x[i+1] − x[i])·(y[i] + y[i+1])/2.
 *   Com um único vetor de argumento, o espaçamento é unitário (Δx = 1). x não precisa ser
 *   crescente (o resultado é então orientado, como em MATLAB).
 * - std: desvio-padrão amostral, normalização N − 1 (padrão de MATLAB/Octave).
 * - interp1: interpolação linear por partes. x deve ser estritamente crescente; fora de
 *   [x₀, x_{N−1}] o resultado é NaN.
 * - logspace(a, b, n): 10^linspace(a, b, n); a e b são expoentes decimais, não frequências.
 *   A aritmética de logspace é a mesma do SISO (app.html), que foi preservado sem alteração.
 *
 * Módulo sem DOM, sem efeitos colaterais e sem dependências.
 */

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isVec = (v) => Array.isArray(v) || v instanceof Float64Array;

function num(x, nome) {
  if (!isNum(x)) throw new TypeError(`${nome} deve ser um número finito.`);
  return x;
}

function inteiro(x, nome, min) {
  if (!Number.isInteger(x)) throw new TypeError(`${nome} deve ser inteiro.`);
  if (x < min) throw new RangeError(`${nome} deve ser ≥ ${min}.`);
  return x;
}

function vetor(v, nome) {
  if (!isVec(v)) throw new TypeError(`${nome} deve ser Array ou Float64Array.`);
  for (let i = 0; i < v.length; i++) {
    if (!isNum(v[i])) throw new TypeError(`${nome}[${i}] deve ser um número finito.`);
  }
  return v;
}

function mesmoTamanho(x, y) {
  if (x.length !== y.length) {
    throw new RangeError(`x e y devem ter o mesmo comprimento (${x.length} ≠ ${y.length}).`);
  }
}

/** Aceita (x, y) ou somente (y), com espaçamento unitário. */
function pares(x, y) {
  if (y === undefined) return [null, vetor(x, 'y')];
  vetor(x, 'x');
  vetor(y, 'y');
  mesmoTamanho(x, y);
  return [x, y];
}

const passo = (xs, i) => (xs === null ? 1 : xs[i + 1] - xs[i]);

/**
 * n pontos igualmente espaçados de a até b (inclusive). Como no MATLAB, n = 1 devolve [b].
 * @param {number} a @param {number} b @param {number} n inteiro ≥ 1
 * @returns {number[]}
 */
export function linspace(a, b, n) {
  num(a, 'a');
  num(b, 'b');
  inteiro(n, 'n', 1);
  if (n === 1) return [b];
  const out = Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  out[n - 1] = b; // extremo exato
  return out;
}

/**
 * n pontos logaritmicamente espaçados: 10^a … 10^b. Porte verbatim de logspace do SISO
 * (app.html, linha ~862); a única diferença é a validação e o caso n = 1 (devolve [10^b]).
 * @param {number} a expoente inicial @param {number} b expoente final @param {number} n inteiro ≥ 1
 * @returns {number[]}
 */
export function logspace(a, b, n) {
  num(a, 'a');
  num(b, 'b');
  inteiro(n, 'n', 1);
  if (n === 1) return [Math.pow(10, b)];
  return Array.from({ length: n }, (_, i) => Math.pow(10, a + (b - a) * i / (n - 1)));
}

/**
 * Integral pela regra do trapézio composta. trapz(y) usa Δx = 1.
 * @param {number[]|Float64Array} x @param {number[]|Float64Array} [y]
 * @returns {number} 0 para vetores com menos de 2 pontos
 */
export function trapz(x, y) {
  const [xs, ys] = pares(x, y);
  let acc = 0;
  for (let i = 0; i < ys.length - 1; i++) acc += passo(xs, i) * (ys[i] + ys[i + 1]) / 2;
  return acc;
}

/**
 * Integral acumulada pela regra do trapézio. Resultado[0] = 0 e o último elemento é trapz(x, y).
 * @param {number[]|Float64Array} x @param {number[]|Float64Array} [y]
 * @returns {number[]}
 */
export function cumtrapz(x, y) {
  const [xs, ys] = pares(x, y);
  const out = new Array(ys.length);
  if (ys.length === 0) return out;
  out[0] = 0;
  for (let i = 0; i < ys.length - 1; i++) {
    out[i + 1] = out[i] + passo(xs, i) * (ys[i] + ys[i + 1]) / 2;
  }
  return out;
}

/**
 * Soma acumulada: out[i] = Σ v[0..i].
 * @param {number[]|Float64Array} v @returns {number[]}
 */
export function cumsum(v) {
  vetor(v, 'v');
  const out = new Array(v.length);
  let acc = 0;
  for (let i = 0; i < v.length; i++) out[i] = (acc += v[i]);
  return out;
}

/** Soma de todos os elementos (0 para vetor vazio). @returns {number} */
export function sum(v) {
  vetor(v, 'v');
  let acc = 0;
  for (let i = 0; i < v.length; i++) acc += v[i];
  return acc;
}

/**
 * Média aritmética. Vetor vazio gera RangeError (MATLAB devolveria NaN).
 * @returns {number}
 */
export function mean(v) {
  vetor(v, 'v');
  if (v.length === 0) throw new RangeError('mean exige pelo menos 1 elemento.');
  return sum(v) / v.length;
}

/**
 * Desvio-padrão amostral: sqrt(Σ(v − média)² / (N − 1)), como std do MATLAB.
 * N = 1 devolve 0. Vetor vazio gera RangeError.
 * @returns {number}
 */
export function std(v) {
  vetor(v, 'v');
  const n = v.length;
  if (n === 0) throw new RangeError('std exige pelo menos 1 elemento.');
  if (n === 1) return 0;
  const m = mean(v);
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (v[i] - m) * (v[i] - m);
  return Math.sqrt(ss / (n - 1));
}

/**
 * Norma vetorial p-ésima. p ∈ {1, 2, Infinity}; padrão 2 (euclidiana).
 * @param {number[]|Float64Array} v @param {1|2|number} [p=2]
 * @returns {number}
 */
export function norm(v, p = 2) {
  vetor(v, 'v');
  if (p === 1) {
    let acc = 0;
    for (let i = 0; i < v.length; i++) acc += Math.abs(v[i]);
    return acc;
  }
  if (p === 2) return Math.hypot(...v);
  if (p === Infinity) {
    let mx = 0;
    for (let i = 0; i < v.length; i++) mx = Math.max(mx, Math.abs(v[i]));
    return mx;
  }
  throw new RangeError('norm: p deve ser 1, 2 ou Infinity.');
}

/**
 * Diferenças sucessivas: out[i] = v[i+1] − v[i]; comprimento N − 1 (vazio se N < 2).
 * @returns {number[]}
 */
export function diff(v) {
  vetor(v, 'v');
  const out = new Array(Math.max(v.length - 1, 0));
  for (let i = 0; i < out.length; i++) out[i] = v[i + 1] - v[i];
  return out;
}

function avalia(x, y, q) {
  const n = x.length;
  if (!(q >= x[0] && q <= x[n - 1])) return NaN; // fora do intervalo ou NaN
  // Invariante: x[lo] ≤ q ≤ x[hi]
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (x[mid] <= q) lo = mid;
    else hi = mid;
  }
  if (q === x[lo]) return y[lo];
  return y[lo] + (q - x[lo]) * (y[hi] - y[lo]) / (x[hi] - x[lo]);
}

/**
 * Interpolação linear 1-D. x deve ser estritamente crescente; fora do intervalo → NaN.
 * @param {number[]|Float64Array} x @param {number[]|Float64Array} y
 * @param {number|number[]|Float64Array} xq escalar ou vetor de consulta
 * @returns {number|number[]}
 */
export function interp1(x, y, xq) {
  vetor(x, 'x');
  vetor(y, 'y');
  mesmoTamanho(x, y);
  if (x.length < 2) throw new RangeError('interp1 exige pelo menos 2 pontos.');
  for (let i = 1; i < x.length; i++) {
    if (!(x[i] > x[i - 1])) throw new RangeError(`x deve ser estritamente crescente (falha em x[${i}]).`);
  }
  if (typeof xq === 'number') return avalia(x, y, xq);
  if (!isVec(xq)) throw new TypeError('xq deve ser um número ou um vetor.');
  const out = new Array(xq.length);
  for (let i = 0; i < xq.length; i++) {
    if (typeof xq[i] !== 'number') throw new TypeError(`xq[${i}] deve ser número.`);
    out[i] = avalia(x, y, xq[i]);
  }
  return out;
}
