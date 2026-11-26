/**
 * EEVL · Aritmética de números complexos · v1.0.0
 *
 * Complexo = objeto { re, im } com componentes reais finitas (mesmo formato de `cx` em
 * simulators/electrical-circuits/nodal-analysis-ac/model.js). Este módulo é independente:
 * não importa nem altera aquele modelo.
 *
 * Convenções deliberadas e diferentes do modelo de circuitos:
 * - Ângulos são RADIANOS em fromPolar, arg e toPolar. As variantes *Deg usam graus.
 *   No modelo de circuitos, fromPolar(mag, deg) e polar(z) usam graus.
 * - Ramo principal de sqrt: arg ∈ (−π, π]. Exp e potências inteiras não têm ramo.
 * - Divisão pelo algoritmo de Smith, que evita overflow intermediário de |b|².
 * - Raízes do SISO são pares [re, im]: use fromPair e toPair para convertê-las.
 *
 * Módulo sem DOM, sem efeitos colaterais e sem dependências.
 */

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

function num(x, nome) {
  if (!isNum(x)) throw new TypeError(`${nome} deve ser um número finito.`);
  return x;
}

function complexo(z, nome) {
  if (z === null || typeof z !== 'object' || !isNum(z.re) || !isNum(z.im)) {
    throw new TypeError(`${nome} deve ser um objeto {re, im} com componentes finitas.`);
  }
  return z;
}

/** @returns {{re:number, im:number}} */
export function make(re = 0, im = 0) {
  return { re: num(re, 're'), im: num(im, 'im') };
}

export function add(a, b) {
  complexo(a, 'a'); complexo(b, 'b');
  return { re: a.re + b.re, im: a.im + b.im };
}

export function sub(a, b) {
  complexo(a, 'a'); complexo(b, 'b');
  return { re: a.re - b.re, im: a.im - b.im };
}

export function mul(a, b) {
  complexo(a, 'a'); complexo(b, 'b');
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

/** Divisão; b = 0 gera RangeError. */
export function div(a, b) {
  complexo(a, 'a'); complexo(b, 'b');
  if (b.re === 0 && b.im === 0) throw new RangeError('Divisão por zero complexo.');
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re, den = b.re + b.im * r;
    return { re: (a.re + a.im * r) / den, im: (a.im - a.re * r) / den };
  }
  const r = b.re / b.im, den = b.im + b.re * r;
  return { re: (a.re * r + a.im) / den, im: (a.im * r - a.re) / den };
}

export function conj(z) {
  complexo(z, 'z');
  return { re: z.re, im: -z.im };
}

/** Multiplicação por escalar real k. */
export function scale(a, k) {
  complexo(a, 'a');
  num(k, 'k');
  return { re: a.re * k, im: a.im * k };
}

/** Módulo |z|. */
export function abs(z) {
  complexo(z, 'z');
  return Math.hypot(z.re, z.im);
}

/** Argumento em radianos, em (−π, π]. */
export function arg(z) {
  complexo(z, 'z');
  return Math.atan2(z.im, z.re);
}

/** Forma polar com ângulo em radianos. */
export function fromPolar(mag, rad) {
  num(mag, 'mag'); num(rad, 'rad');
  return { re: mag * Math.cos(rad), im: mag * Math.sin(rad) };
}

/** Forma polar com ângulo em graus. */
export function fromPolarDeg(mag, deg) {
  num(mag, 'mag'); num(deg, 'deg');
  return fromPolar(mag, (deg * Math.PI) / 180);
}

/** @returns {{mag:number, phase:number}} fase em radianos */
export function toPolar(z) {
  return { mag: abs(z), phase: arg(z) };
}

/** @returns {{mag:number, phase:number}} fase em graus */
export function toPolarDeg(z) {
  return { mag: abs(z), phase: (arg(z) * 180) / Math.PI };
}

/** Exponencial e^z = e^re·(cos im + j·sen im). */
export function exp(z) {
  complexo(z, 'z');
  const m = Math.exp(z.re);
  return { re: m * Math.cos(z.im), im: m * Math.sin(z.im) };
}

/** Raiz quadrada principal: parte real ≥ 0. */
export function sqrt(z) {
  complexo(z, 'z');
  const r = Math.hypot(z.re, z.im);
  if (r === 0) return { re: 0, im: 0 };
  if (z.re >= 0) {
    const re = Math.sqrt((r + z.re) / 2);
    return { re, im: z.im / (2 * re) };
  }
  const im = Math.sqrt((r - z.re) / 2) * (z.im < 0 ? -1 : 1);
  return { re: Math.abs(z.im) / (2 * Math.abs(im)), im };
}

/**
 * Potência com expoente inteiro (positivo, zero ou negativo), por quadrados sucessivos.
 * 0 elevado a expoente negativo gera RangeError; expoente não inteiro gera TypeError.
 */
export function pow(z, n) {
  complexo(z, 'z');
  if (!Number.isInteger(n)) throw new TypeError('pow: n deve ser inteiro.');
  if (n === 0) return { re: 1, im: 0 };
  if (n < 0 && z.re === 0 && z.im === 0) throw new RangeError('0 elevado a expoente negativo.');
  let k = Math.abs(n);
  let base = { re: z.re, im: z.im };
  let res = { re: 1, im: 0 };
  while (k > 0) {
    if (k % 2 === 1) res = mul(res, base);
    k = Math.floor(k / 2);
    if (k > 0) base = mul(base, base);
  }
  return n < 0 ? div({ re: 1, im: 0 }, res) : res;
}

/** Converte o par [re, im] (formato das raízes do SISO) em complexo. */
export function fromPair(p) {
  if (!Array.isArray(p) || p.length !== 2) throw new TypeError('fromPair exige um par [re, im].');
  return make(p[0], p[1]);
}

/** Converte complexo em par [re, im]. */
export function toPair(z) {
  complexo(z, 'z');
  return [z.re, z.im];
}

/**
 * Igualdade aproximada: |a − b| ≤ tol (distância euclidiana entre as componentes).
 * @returns {boolean}
 */
export function equalsWithin(a, b, tol) {
  complexo(a, 'a'); complexo(b, 'b');
  num(tol, 'tol');
  if (tol < 0) throw new RangeError('tol deve ser ≥ 0.');
  return Math.hypot(a.re - b.re, a.im - b.im) <= tol;
}

/* ---------- Funções hiperbólicas de argumento complexo ---------- */

/**
 * Produto que devolve 0 quando um dos fatores é 0. Evita 0·∞ = NaN quando sinh ou cosh estouram
 * e a outra componente é exatamente nula (por exemplo, sen y = 0 em z real grande).
 */
const prod = (a, b) => (a === 0 || b === 0 ? 0 : a * b);

/** Garante +0 no lugar de −0 nas componentes devolvidas. */
const norm = (z) => ({ re: z.re + 0, im: z.im + 0 });

/**
 * sinh(x+iy) = sinh x·cos y + i·cosh x·sen y.
 * Estouro (|x| ≳ 710): as componentes viram ±Infinity, como exp, sem lançar erro. Diferente de
 * exp (que pode gerar NaN quando sen y = 0), a componente com seno nulo sai exatamente 0.
 */
export function sinh(z) {
  complexo(z, 'z');
  const c = Math.cos(z.im), s = Math.sin(z.im);
  return { re: prod(Math.sinh(z.re), c), im: prod(Math.cosh(z.re), s) };
}

/**
 * cosh(x+iy) = cosh x·cos y + i·sinh x·sen y.
 * Mesma convenção de estouro de sinh (±Infinity, sem NaN).
 */
export function cosh(z) {
  complexo(z, 'z');
  const c = Math.cos(z.im), s = Math.sin(z.im);
  return { re: prod(Math.cosh(z.re), c), im: prod(Math.sinh(z.re), s) };
}

/** Limite de |x| acima do qual tanh usa a forma assintótica (ver JSDoc de tanh). */
const LIMITE_ASSINTOTICO_TANH = 20;

/**
 * tanh(x+iy) = (sinh x·cosh x + i·sen y·cos y) / (sinh²x + cos²y).
 *
 * Não se usa sinh/cosh: a forma acima tem denominador soma de quadrados não negativos, sem
 * cancelamento, então continua precisa perto dos polos z = i(π/2 + kπ), onde o denominador tende a 0.
 *
 * Para |x| grande: seja t = e^{−2|x|}. Como sinh x·cosh x = sgn(x)·(e^{2|x|}/4)(1 − t²) e
 * sinh²x = (e^{2|x|}/4)(1 − t)², dividindo numerador e denominador por e^{2|x|}/4 obtém-se
 *   re = sgn(x)(1 − t²)/[(1 − t)² + 4t·cos²y],   im = 4t·sen y·cos y/[(1 − t)² + 4t·cos²y].
 * Para |x| > 20, t < e^{−40} ≈ 4,2e-18. Então |re − sgn(x)| ≤ 3t ≈ 1,3e-17 < ulp(1)/2 ≈ 1,1e-16
 * e re arredonda para ±1, e o denominador é 1 + O(t). Logo a forma assintótica
 *   tanh ≈ sgn(x) + i·4·e^{−2|x|}·sen y·cos y
 * tem erro relativo O(e^{−2|x|}) ≤ 1e-17 e não calcula sinh/cosh grandes (sem estouro).
 *
 * Polo exato (denominador nulo) lança RangeError, como div. Com números de dupla precisão o
 * denominador nunca é zero (cos y de um double nunca é exatamente 0), então o guarda é defensivo:
 * tanh(i·fl(π/2)) devolve um valor finito grande (≈1,6e16i).
 */
export function tanh(z) {
  complexo(z, 'z');
  const x = z.re, cy = Math.cos(z.im), sy = Math.sin(z.im);
  if (Math.abs(x) > LIMITE_ASSINTOTICO_TANH) {
    const t = Math.exp(-2 * Math.abs(x));
    return norm({ re: Math.sign(x), im: 4 * t * sy * cy });
  }
  const sh = Math.sinh(x), ch = Math.cosh(x);
  const den = sh * sh + cy * cy;
  if (den === 0) throw new RangeError('tanh: polo exato (denominador nulo).');
  return norm({ re: (sh * ch) / den, im: (sy * cy) / den });
}

/**
 * AUXILIAR, API AINDA INSTÁVEL (exportada só para permitir testes). sinhc(z) = sinh(z)/z, com sinhc(0) = 1.
 *
 * - |z| < 1: série de Taylor Σ_{k≥0} w^k/(2k+1)! com w = z², avaliada por Horner. Trunca em k = 8.
 *   Resto ≤ |w|⁹/19! ≤ 8,2e-18 (|w| < 1). Como |sinhc| ≥ 1 − (sinh 1 − 1) ≈ 0,82 em |z| < 1,
 *   o erro relativo fica ≤ 1e-17 < 1e-16. Os zeros de sinhc são iπk (k ≠ 0), com |iπ| > 1.
 * - |z| ≥ 1: sinh(z)/z pela divisão de Smith (div). Para |x| > ~710 o sinh estoura; então usa-se
 *   sinhc ≈ e^z/(2z), cujas componentes têm sinal de (x·cos y + y·sen y) e (x·sen y − y·cos y) e
 *   magnitude ∞ (±Infinity, sem NaN). Isso também ocorre em alguns |x| ≲ 710 com resultado
 *   finito muito grande, que é a mesma convenção de exp/sinh.
 *
 * Simetria: sinhc é par, então z com x < 0 é tratado como −z.
 * Para z puramente real ou puramente imaginário a parte imaginária é exatamente 0.
 */
const SINHC_COEF = [1, 1 / 6, 1 / 120, 1 / 5040, 1 / 362880, 1 / 39916800,
  1 / 6227020800, 1 / 1307674368000, 1 / 355687428096000];

export function sinhc(z) {
  complexo(z, 'z');
  const r2 = z.re * z.re + z.im * z.im;
  if (r2 < 1) {
    const w = { re: z.re * z.re - z.im * z.im, im: 2 * z.re * z.im };
    let p = { re: SINHC_COEF[8], im: 0 };
    for (let k = 7; k >= 0; k--) p = add(mul(p, w), { re: SINHC_COEF[k], im: 0 });
    return norm(p);
  }
  const x = Math.abs(z.re), y = z.re < 0 ? -z.im : z.im;
  if (!Number.isFinite(Math.sinh(x)) || !Number.isFinite(Math.cosh(x))) {
    const c = Math.cos(y), s = Math.sin(y);
    const sg = (v) => (v === 0 ? 0 : v > 0 ? Infinity : -Infinity);
    return { re: sg(x * c + y * s), im: sg(x * s - y * c) };
  }
  const q = { re: x, im: y };
  return norm(div(sinh(q), q));
}
