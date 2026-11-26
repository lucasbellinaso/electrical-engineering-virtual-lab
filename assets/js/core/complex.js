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
