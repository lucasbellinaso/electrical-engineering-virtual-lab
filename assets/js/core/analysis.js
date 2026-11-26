/**
 * EEVL · Análise SISO numérica (módulo puro: ESM, sem DOM, sem eval, sem dependências externas) · v1.0.0
 *
 * Funções de análise de sistemas lineares SISO com a semântica MATLAB-compatível do
 * python-control 0.10.2 (pole, zero, damp, freqresp, bode, nyquist, margin, evalfr, minreal,
 * rlocus, gangof4) e de SciPy (tf2zpk, zpk2tf, ss2zpk, zpk2ss). Somente numérico: sem gráficos.
 *
 * Formas de sistema aceitas (todas as funções que recebem `sys`):
 * - TF  {num, den}     coeficientes em ordem decrescente: s² + 3s + 2 -> [1, 3, 2]
 * - ZPK {z, p, k}      z, p: listas de pares [re, im]; k: ganho real
 * - SS  {A, B, C, D}   A: n×n, B: n×1, C: 1×n (arrays de linhas); D: escalar ou 1×1
 * Campo opcional `dt` (s) em qualquer forma: dt > 0 => discreto, com z = e^{jωdt};
 * ausente ou 0 => contínuo, com s = jω.
 *
 * Convenções:
 * - ω em rad/s; bode({Hz: true}) devolve omega em Hz;
 * - freqresp: fase em rad, principal (atan2, em (−π, π]), sem desembrulhar;
 *   bode: fase desembrulhada (unwrap) em rad ou em graus ({deg: true});
 * - margin: gm em magnitude absoluta (não dB), pm em graus em (−180, 180], wcg (fase −180°)
 *   e wcp (|L| = 1) em rad/s; sem cruzamento: gm/pm = Infinity e a frequência = NaN;
 * - damp: wn em rad/s, zeta adimensional; polos em s (discreto: s = log(z)/dt).
 *
 * Limites de condicionamento:
 * - Polos e zeros são raízes de polinômios (Aberth, ver polynomial.js). Com grau alto ou
 *   raízes agrupadas, a precisão cai com o condicionamento do polinômio.
 * - Em SS, os polos são os autovalores de A (eigvals, QR de Francis em eigen.js), não as raízes do
 *   polinômio característico. Vale também para A de ordem alta ou com autovalores agrupados.
 * - zero(sys) em SS usa o numerador de ss2tf; é o conceito de zero de transmissão de sistema
 *   SISO. Para MIMO, a função não se aplica.
 * - A ordem das raízes não segue numpy.roots; compare como conjuntos.
 * - zpk2tf, minreal, rlocus (via tfOf) exigem polinômio real: o conjunto de raízes deve ser
 *   simétrico por conjugação, com tolerância relativa CONJ_TOL; caso contrário RangeError.
 * - minreal cancela pares com |z − p| ≤ tol·max(1, |p|); tol padrão = √ε ≈ 1,49e-8.
 *   Cancelamento aproximado pode deixar um resíduo de ordem tol.
 * - margin varre ω numa grade logarítmica de 4000 pontos e refina cada cruzamento por bisseção.
 *   A faixa é [1e-4, 1e4] vezes as magnitudes não nulas de polos e zeros (discreto: [1e-6, π/dt]).
 *   Não reutiliza control.margins: ela soma fases de fatores (makeFR). Verificado com
 *   L = 20(s² − 2s + 5)/((s+1)(s+2)(s+3)): control.margins aponta cruzamento de fase em ω = 2,0,
 *   onde Im(L) = 2,23 (o salto de atan2 do zero 1 ± 2j ocorre exatamente ali); o cruzamento
 *   real está em ω ≈ 1,6255 (Im L ≈ 0, Re L < 0). Aqui |L| e Im(L) são avaliados diretamente.
 * - gangof4 usa aritmética complexa local com pares [re, im] (complex.js usa {re, im}).
 *
 * Erros: TypeError para tipo incorreto; RangeError para valor ou forma inválidos
 * (não finito, den nulo, sistema impróprio quando a função não admite, conjunto não simétrico).
 */

import { ptrim, padd, pscale, polyFromRoots, roots, matchRoots } from './polynomial.js';
import { tf2ss, ss2tf, evalTF, bisect } from './control.js';
import { logspace } from './numeric.js';
import { eigvals } from './eigen.js';

const R2D = 180 / Math.PI;
const SQRT_EPS = Math.sqrt(Number.EPSILON);
const CONJ_TOL = 1e-9;
const MARGIN_GRID = 4000;

/* ------------------------- validação ------------------------- */

function num(x, name) {
  if (typeof x !== 'number') throw new TypeError(`${name} deve ser número`);
  if (!Number.isFinite(x)) throw new RangeError(`${name} deve ser finito`);
  return x;
}

function vec(v, name) {
  if (!Array.isArray(v) && !(v instanceof Float64Array)) throw new TypeError(`${name} deve ser array de números`);
  if (v.length === 0) throw new RangeError(`${name} não pode ser vazio`);
  return Array.from(v, (x, i) => num(x, `${name}[${i}]`));
}

function poly(p, name) {
  if (!Array.isArray(p)) throw new TypeError(`${name} deve ser array de coeficientes`);
  if (p.length === 0) throw new RangeError(`${name} não pode ser vazio`);
  return p.map((x, i) => num(x, `${name}[${i}]`));
}

function pair(z, name) {
  if (!Array.isArray(z) || z.length !== 2) throw new TypeError(`${name} deve ser par [re, im]`);
  return [num(z[0], `${name}[0]`), num(z[1], `${name}[1]`)];
}

function pairs(list, name) {
  if (!Array.isArray(list)) throw new TypeError(`${name} deve ser lista de pares [re, im]`);
  return list.map((z, i) => pair(z, `${name}[${i}]`));
}

function bool(x, name) {
  if (typeof x !== 'boolean') throw new TypeError(`${name} deve ser booleano`);
  return x;
}

/* ------------------------- formas de sistema ------------------------- */

// Identifica a forma do sistema e valida o campo dt (todas as funções que recebem sys passam por aqui).
function kindOf(sys) {
  if (sys === null || typeof sys !== 'object') {
    throw new TypeError('sistema deve ser objeto {num, den}, {z, p, k} ou {A, B, C, D}');
  }
  let kind;
  if ('num' in sys && 'den' in sys) kind = 'tf';
  else if ('z' in sys && 'p' in sys && 'k' in sys) kind = 'zpk';
  else if ('A' in sys && 'B' in sys && 'C' in sys && 'D' in sys) kind = 'ss';
  else throw new TypeError('sistema não reconhecido: use {num, den}, {z, p, k} ou {A, B, C, D}');
  dtOf(sys);
  return kind;
}

// dt = 0 (ausente ou 0) é contínuo; dt > 0 é discreto.
function dtOf(sys) {
  const dt = sys.dt === undefined ? 0 : num(sys.dt, 'dt');
  if (dt < 0) throw new RangeError('dt deve ser ≥ 0');
  return dt;
}

// dt explícito tem precedência; 0 usa o dt do sistema.
function effectiveDt(sys, dt) {
  num(dt, 'dt');
  if (dt < 0) throw new RangeError('dt deve ser ≥ 0');
  return dt > 0 ? dt : dtOf(sys);
}

function tfData(n, d) {
  const nn = poly(n, 'num'), dd = ptrim(poly(d, 'den'));
  if (dd[0] === 0) throw new RangeError('den identicamente nulo');
  return { num: ptrim(nn), den: dd };
}

// Forma TF de qualquer sistema aceito.
function tfOf(sys) {
  const kind = kindOf(sys);
  if (kind === 'tf') return tfData(sys.num, sys.den);
  if (kind === 'zpk') return zpk2tf(sys.z, sys.p, sys.k);
  return ss2tf(sys.A, sys.B, sys.C, sys.D);
}

// Forma ZPK de qualquer sistema aceito (ss2zpk = tf2zpk(ss2tf)).
function zpkOf(sys) {
  if (kindOf(sys) === 'zpk') return { z: pairs(sys.z, 'z'), p: pairs(sys.p, 'p'), k: num(sys.k, 'k') };
  const { num: n, den: d } = tfOf(sys);
  return tf2zpk(n, d);
}

// Ponto de avaliação: s = jω (contínuo) ou z = e^{jωT} (discreto).
function evalPoint(w, T) {
  return T > 0 ? [Math.cos(w * T), Math.sin(w * T)] : [0, w];
}

const magOf = (v) => Math.hypot(v[0], v[1]);

/* ------------------------- polos, zeros, amortecimento ------------------------- */

/**
 * Polos do sistema (MATLAB pole). TF: raízes do denominador. SS: autovalores de A (eigvals).
 * ZPK: lista p.
 * @param {object} sys @returns {number[][]} pares [re, im]
 */
export function pole(sys) {
  const kind = kindOf(sys);
  if (kind === 'zpk') return pairs(sys.p, 'p');
  if (kind === 'ss') return eigvals(sys.A);
  return roots(tfOf(sys).den);
}

/**
 * Zeros do sistema (MATLAB zero). TF: raízes do numerador. SS: zeros de transmissão via ss2tf
 * (SISO). ZPK: lista z.
 * @param {object} sys @returns {number[][]} pares [re, im]
 */
export function zero(sys) {
  if (kindOf(sys) === 'zpk') return pairs(sys.z, 'z');
  return roots(tfOf(sys).num);
}

/**
 * Frequência natural, amortecimento e polos (python-control damp). Discreto: s = log(z)/dt.
 * Polo na origem: wn = 0 e zeta = NaN.
 * @param {object} sys @returns {{wn: number[], zeta: number[], poles: number[][]}}
 */
export function damp(sys) {
  const dt = dtOf(sys);
  const poles = pole(sys);
  const s = dt > 0
    ? poles.map(([re, im]) => [Math.log(magOf([re, im])) / dt, Math.atan2(im, re) / dt])
    : poles;
  const wn = s.map(magOf);
  const zeta = s.map(([re], i) => -re / wn[i]);
  return { wn, zeta, poles };
}

/**
 * Coeficientes TF do sistema (MATLAB tfdata, SISO).
 * @param {object} sys @returns {{num: number[], den: number[]}}
 */
export function tfdata(sys) {
  const { num: n, den: d } = tfOf(sys);
  return { num: n, den: d };
}

/* ------------------------- conversões (SciPy) ------------------------- */

/**
 * Zeros, polos e ganho de num/den (SciPy tf2zpk). Numerador nulo => z = [] e k = 0.
 * @param {number[]} numIn @param {number[]} denIn
 * @returns {{z: number[][], p: number[][], k: number}}
 */
export function tf2zpk(numIn, denIn) {
  const { num: n0, den: d0 } = tfData(numIn, denIn);
  const lead = d0[0];
  const n = n0.map(v => v / lead), d = d0.map(v => v / lead);
  return { z: roots(n), p: roots(d), k: n[0] };
}

// Polinômio real mônico a partir de raízes; exige conjuntos simétricos por conjugação.
function checkConjugate(rs, name) {
  const used = new Array(rs.length).fill(false);
  for (let i = 0; i < rs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const [a, b] = rs[i];
    const scale = 1 + Math.hypot(a, b);
    if (Math.abs(b) <= CONJ_TOL * scale) continue;
    let best = -1, bd = Infinity;
    for (let j = i + 1; j < rs.length; j++) {
      if (used[j]) continue;
      const d = Math.hypot(rs[j][0] - a, rs[j][1] + b);
      if (d < bd) { bd = d; best = j; }
    }
    if (best < 0 || bd > CONJ_TOL * scale) {
      throw new RangeError(`${name} não é simétrico por conjugação: o polinômio resultante não é real`);
    }
    used[best] = true;
  }
}

function realPoly(rs, name) {
  checkConjugate(rs, name);
  return polyFromRoots(rs);
}

/**
 * Numerador e denominador a partir de zeros, polos e ganho (SciPy zpk2tf).
 * Denominador mônico; numerador = k·∏(s − zᵢ).
 * @param {number[][]} zIn @param {number[][]} pIn @param {number} kIn
 * @returns {{num: number[], den: number[]}}
 */
export function zpk2tf(zIn, pIn, kIn) {
  const z = pairs(zIn, 'z'), p = pairs(pIn, 'p'), k = num(kIn, 'k');
  const den = realPoly(p, 'p');
  const numer = realPoly(z, 'z').map(v => v * k);
  return { num: ptrim(numer), den };
}

/**
 * Espaço de estados na forma controlável a partir de zeros, polos e ganho (SciPy zpk2ss).
 * D é escalar (como em control.tf2ss). Sem polos: A, B, C vazios e D = k.
 * @param {number[][]} zIn @param {number[][]} pIn @param {number} kIn
 * @returns {{A: number[][], B: number[][], C: number[][], D: number}}
 */
export function zpk2ss(zIn, pIn, kIn) {
  const { num: n, den: d } = zpk2tf(zIn, pIn, kIn);
  if (n.length > d.length) throw new RangeError('função imprópria (mais zeros que polos)');
  if (d.length === 1) return { A: [], B: [], C: [], D: n[0] };
  const { A, B, C, D } = tf2ss(n, d);
  return { A, B, C, D };
}

/**
 * Zeros, polos e ganho a partir de espaço de estados SISO (SciPy ss2zpk).
 * @param {number[][]} A n×n @param {number[][]} B n×1 @param {number[][]} C 1×n
 * @param {number|number[][]} D escalar ou 1×1
 * @returns {{z: number[][], p: number[][], k: number}}
 */
export function ss2zpk(A, B, C, D) {
  const { num: n, den: d } = ss2tf(A, B, C, D);
  return tf2zpk(n, d);
}

/* ------------------------- resposta em frequência ------------------------- */

/**
 * Resposta em frequência H(jω) (ou H(e^{jωT})) em ω ∈ w (rad/s).
 * Fase principal em rad: atan2, em (−π, π]. Use bode para fase desembrulhada.
 * @param {object} sys @param {number[]} w @param {number} [dt=0] dt > 0 força discreto; 0 usa sys.dt
 * @returns {{mag: number[], phase: number[], re: number[], im: number[]}}
 */
export function freqresp(sys, w, dt = 0) {
  const ws = vec(w, 'w');
  const T = effectiveDt(sys, dt);
  const { num: n, den: d } = tfOf(sys);
  const H = ws.map(x => evalTF(n, d, evalPoint(x, T)));
  return {
    mag: H.map(magOf),
    phase: H.map(h => Math.atan2(h[1], h[0])),
    re: H.map(h => h[0]),
    im: H.map(h => h[1]),
  };
}

/**
 * Diagrama de Bode (MATLAB bode / python-control bode_plot sem gráfico).
 * Fase desembrulhada (unwrap) antes da conversão para graus.
 * @param {object} sys @param {number[]} w rad/s
 * @param {{deg?: boolean, dB?: boolean, Hz?: boolean}} [opts] deg: fase em graus; dB: magnitude
 *   em dB; Hz: omega devolvido em Hz (ω/2π)
 * @returns {{mag: number[], phase: number[], omega: number[]}}
 */
export function bode(sys, w, opts = {}) {
  if (opts === null || typeof opts !== 'object') throw new TypeError('opts deve ser objeto');
  const deg = opts.deg === undefined ? false : bool(opts.deg, 'deg');
  const dB = opts.dB === undefined ? false : bool(opts.dB, 'dB');
  const Hz = opts.Hz === undefined ? false : bool(opts.Hz, 'Hz');
  const ws = vec(w, 'w');
  const fr = freqresp(sys, ws);
  const phase = unwrap(fr.phase);
  return {
    mag: dB ? fr.mag.map(m => 20 * Math.log10(m)) : fr.mag,
    phase: deg ? phase.map(p => p * R2D) : phase,
    omega: Hz ? ws.map(x => x / (2 * Math.PI)) : ws,
  };
}

/**
 * Dados do diagrama de Nyquist em ω > 0 (sem o ramo espelhado em −ω, que é (re, −im)).
 * @param {object} sys @param {number[]} w @returns {{re: number[], im: number[], w: number[]}}
 */
export function nyquist(sys, w) {
  const ws = vec(w, 'w');
  const fr = freqresp(sys, ws);
  return { re: fr.re, im: fr.im, w: ws };
}

/**
 * Valor de H no ponto s (complexo [re, im]). Não aplica dt: s é a variável do sistema.
 * @param {object} sys @param {number[]} s par [re, im] @returns {number[]}
 */
export function evalfr(sys, s) {
  const pt = pair(s, 's');
  const { num: n, den: d } = tfOf(sys);
  return evalTF(n, d, pt);
}

/**
 * Magnitude linear para dB: 20·log10(m). m ≥ 0; m = 0 dá −Infinity.
 * @param {number|number[]} m @returns {number|number[]}
 */
export function mag2db(m) {
  if (Array.isArray(m)) return m.map(mag2db);
  if (num(m, 'm') < 0) throw new RangeError('magnitude deve ser ≥ 0');
  return 20 * Math.log10(m);
}

/**
 * dB para magnitude linear: 10^(d/20).
 * @param {number|number[]} d @returns {number|number[]}
 */
export function db2mag(d) {
  if (Array.isArray(d)) return d.map(db2mag);
  return Math.pow(10, num(d, 'd') / 20);
}

// Resto com sinal do divisor (como np.mod).
const modPy = (x, m) => ((x % m) + m) % m;

/**
 * Desembrulha fase, como numpy.unwrap: saltos maiores que period/2 são corrigidos.
 * @param {number[]} angle @param {number} [period=2π] @returns {number[]}
 */
export function unwrap(angle, period = 2 * Math.PI) {
  const a = vec(angle, 'angle');
  num(period, 'period');
  if (period <= 0) throw new RangeError('period deve ser > 0');
  const half = period / 2;
  const out = a.slice();
  let cum = 0;
  for (let i = 1; i < a.length; i++) {
    const dd = a[i] - a[i - 1];
    let ddmod = modPy(dd + half, period) - half;
    if (ddmod === -half && dd > 0) ddmod = half;
    if (Math.abs(dd) >= half) cum += ddmod - dd;
    out[i] = a[i] + cum;
  }
  return out;
}

/* ------------------------- margens ------------------------- */

// Margem de fase em (−180, 180] a partir do argumento de L em graus.
const pmOf = (argDeg) => ((argDeg + 360) % 360) - 180;

// Faixa de busca da margem: [1e-4, 1e4] vezes as magnitudes não nulas de polos e zeros.
function marginRange(tf, dt) {
  if (dt > 0) return [1e-6, Math.PI / dt * (1 - 1e-9)];
  const mags = [...roots(tf.num), ...roots(tf.den)].map(magOf).filter(m => m > 0 && Number.isFinite(m));
  const lo = mags.length ? Math.min(...mags) : 1;
  const hi = mags.length ? Math.max(...mags) : 1;
  return [1e-4 * lo, 1e4 * hi];
}

/**
 * Margens de ganho e de fase (python-control margin / stability_margins, convenção documentada
 * em gen_analysis.py). gm: 1/|L| no cruzamento de fase (Re L < 0, Im L = 0); pm: 180° + arg L
 * no cruzamento de ganho (|L| = 1), em (−180, 180]. Com vários cruzamentos, gm mais próxima de 1
 * e pm de menor |pm|. Sem cruzamento: Infinity e NaN.
 * @param {object} sys
 * @returns {{gm: number, pm: number, wcg: number, wcp: number}}
 */
export function margin(sys) {
  const dt = dtOf(sys);
  const tf = tfOf(sys);
  const { num: n, den: d } = tf;
  if (n.length === 1 && n[0] === 0) return { gm: Infinity, pm: Infinity, wcg: NaN, wcp: NaN };
  const [w0, w1] = marginRange(tf, dt);
  const ws = logspace(Math.log10(w0), Math.log10(w1), MARGIN_GRID);
  const L = (w) => evalTF(n, d, evalPoint(w, dt));
  const Lg = ws.map(L);

  const gc = [];   // cruzamentos de ganho: {w, pm}
  const pc = [];   // cruzamentos de fase: {w, gm}
  for (let i = 0; i < ws.length - 1; i++) {
    const a = Lg[i], b = Lg[i + 1];
    const fa = magOf(a) - 1, fb = magOf(b) - 1;
    if (Number.isFinite(fa) && Number.isFinite(fb) && fa * fb <= 0) {
      const wc = bisect(w => magOf(L(w)) - 1, ws[i], ws[i + 1]);
      const Lc = L(wc);
      gc.push({ w: wc, pm: pmOf(Math.atan2(Lc[1], Lc[0]) * R2D) });
    }
    if (Number.isFinite(a[1]) && Number.isFinite(b[1]) && a[1] * b[1] <= 0) {
      const wp = bisect(w => L(w)[1], ws[i], ws[i + 1]);
      const Lp = L(wp);
      if (Lp[0] < 0) pc.push({ w: wp, gm: 1 / magOf(Lp) });
    }
  }
  const gmBest = pc.length ? pc.reduce((m, x) => Math.abs(Math.log(x.gm)) < Math.abs(Math.log(m.gm)) ? x : m) : null;
  const pmBest = gc.length ? gc.reduce((m, x) => Math.abs(x.pm) < Math.abs(m.pm) ? x : m) : null;
  return {
    gm: gmBest ? gmBest.gm : Infinity,
    pm: pmBest ? pmBest.pm : Infinity,
    wcg: gmBest ? gmBest.w : NaN,
    wcp: pmBest ? pmBest.w : NaN,
  };
}

/* ------------------------- minreal e lugar das raízes ------------------------- */

/**
 * Cancelamento polo-zero (MATLAB minreal). Remove pares com |z − p| ≤ tol·max(1, |p|),
 * de modo guloso (cada zero casa com o polo mais próximo). Devolve TF mônica no
 * denominador, com o mesmo ganho k.
 * @param {object} sys @param {number} [tol=√ε] @returns {{num: number[], den: number[]}}
 */
export function minreal(sys, tol = SQRT_EPS) {
  num(tol, 'tol');
  if (tol < 0) throw new RangeError('tol deve ser ≥ 0');
  const { z, p, k } = zpkOf(sys);
  const pr = p.slice();
  const keptZ = [];
  for (const zi of z) {
    let best = -1, bd = Infinity;
    for (let j = 0; j < pr.length; j++) {
      const d = Math.hypot(zi[0] - pr[j][0], zi[1] - pr[j][1]);
      if (d < bd) { bd = d; best = j; }
    }
    if (best >= 0 && bd <= tol * Math.max(1, magOf(pr[best]))) pr.splice(best, 1);
    else keptZ.push(zi);
  }
  return zpk2tf(keptZ, pr, k);
}

/**
 * Lugar geométrico das raízes: raízes de den + K·num para cada K em gains. Raízes são
 * reordenadas por matchRoots entre ganhos consecutivos (associação por proximidade).
 * Sistema impróprio (grau do numerador > grau do denominador) é rejeitado.
 * @param {object} sys @param {number[]} gains @returns {{gains: number[], roots: number[][][]}}
 */
export function rlocus(sys, gains) {
  const ks = vec(gains, 'gains');
  const { num: n, den: d } = tfOf(sys);
  if (n.length > d.length) throw new RangeError('rlocus: sistema impróprio');
  const out = [];
  let prev = null;
  for (const K of ks) {
    const r = roots(padd(d, pscale(n, K)));
    prev = prev ? matchRoots(prev, r) : r;
    out.push(prev);
  }
  return { gains: ks, roots: out };
}

/* ------------------------- álgebra complexa local (pares [re, im]) ------------------------- */

const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => {
  const m = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / m, (a[1] * b[0] - a[0] * b[1]) / m];
};

/**
 * Funções de sensibilidade com realimentação negativa unitária (python-control gangof4):
 * S = 1/(1+PC), PS = P/(1+PC), CS = C/(1+PC), T = PC/(1+PC), avaliadas em s = jω (ou z = e^{jωT}).
 * P e C devem ter o mesmo dt.
 * @param {object} P @param {object} C @param {number[]} w rad/s
 * @returns {{S: number[][], PS: number[][], CS: number[][], T: number[][]}} pares [re, im] por ω
 */
export function gangof4(P, C, w) {
  const ws = vec(w, 'w');
  const tp = tfOf(P), tc = tfOf(C);
  const dt = dtOf(P);
  if (dt !== dtOf(C)) throw new RangeError('P e C devem ter o mesmo dt');
  const S = [], PS = [], CS = [], T = [];
  for (const x of ws) {
    const s = evalPoint(x, dt);
    const p = evalTF(tp.num, tp.den, s), c = evalTF(tc.num, tc.den, s);
    const pc = cmul(p, c);
    const d = [1 + pc[0], pc[1]];
    S.push(cdiv([1, 0], d));
    PS.push(cdiv(p, d));
    CS.push(cdiv(c, d));
    T.push(cdiv(pc, d));
  }
  return { S, PS, CS, T };
}
