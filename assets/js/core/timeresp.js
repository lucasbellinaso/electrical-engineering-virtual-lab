/*
 * EEVL · Resposta temporal de sistemas lineares em espaço de estados · núcleo puro (ESM, sem DOM).
 *
 * Sistema: objeto { A, B, C, D, dt } com matrizes em arrays de linhas (convenção de matrix.js):
 * A (n×n), B (n×m), C (p×n), D (p×m). D pode ser omitido (zeros) ou escalar quando p = m = 1.
 * - dt ausente ou 0: tempo contínuo, ẋ = Ax + Bu, y = Cx + Du.
 * - dt > 0: tempo discreto, x[k+1] = Ax[k] + Bu[k], y[k] = Cx[k] + Du[k].
 *
 * Retorno: { t, y, x }. t: instantes; x[k]: vetor de n estados; y[k]: escalar se p = 1,
 * array de p saídas caso contrário. Entrada u: N números (m = 1) ou N arrays de m números.
 *
 * Hipóteses e convenções:
 * - Contínuo com entrada ZOH: u é mantido constante em [t_k, t_{k+1}) com passo uniforme h.
 *   A discretização é exata (c2d de control.js: Ad = e^{Ah}, Bd = ∫₀ʰ e^{As} ds · B).
 *   Equivale a scipy.signal.lsim(..., interp=False). Não há interpolação linear da entrada.
 * - Impulso contínuo: resposta à condição inicial x0 = B·e_j com u = 0, isto é y(t) = C e^{At} B.
 *   O termo D·δ(t) é ignorado; portanto y(0) = C·B, sem parcela de D.
 * - Impulso discreto: sequência unitária, u[0] = e_j (sem divisão por dt).
 * - step, impulse: 'input' escolhe o canal j de entrada (0-based); os demais canais valem zero.
 * - Grade automática (t omitido), ver defaultTime:
 *   contínuo: 501 pontos em [0, 5τ], τ = maior 1/|Re λ| entre polos estáveis (Re λ < 0), τ = 1 sem polos estáveis;
 *   discreto: t_k = k·dt, k = 0..K, K = min(1000, max(10, ⌈5τ_d⌉)), τ_d = maior 1/(−ln|z|) com 0 < |z| < 1.
 * - stepinfo: segue a definição de control.step_info (python-control), ver a função.
 *
 * Erros: TypeError para tipo inválido; RangeError para dimensão incompatível, valor não finito,
 * passo de t não uniforme ou fora da faixa permitida.
 */
import {tf2ss, c2d} from './control.js';
import {eigvals} from './eigen.js';
import {linspace} from './numeric.js';

/* ------------------------- validação ------------------------- */

function numero(x, nome) {
  if (typeof x !== 'number') throw new TypeError(`${nome} deve ser número`);
  if (!Number.isFinite(x)) throw new RangeError(`${nome} deve ser finito`);
  return x;
}

function checkDt(dt) {
  if (typeof dt !== 'number') throw new TypeError('dt deve ser número');
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt deve ser finito e ≥ 0 (0 = contínuo)');
  return dt;
}

function dimsOf(M, nome) {
  if (!Array.isArray(M)) throw new TypeError(`${nome} deve ser array de linhas`);
  if (M.length === 0) throw new RangeError(`${nome} não pode ser vazio`);
  if (!Array.isArray(M[0])) throw new TypeError(`${nome}[0] deve ser array`);
  if (M[0].length === 0) throw new RangeError(`${nome} deve ter ao menos uma coluna`);
  return { r: M.length, c: M[0].length };
}

function copyMatrix(M, nome, r, c) {
  if (!Array.isArray(M)) throw new TypeError(`${nome} deve ser array de linhas`);
  if (M.length !== r) throw new RangeError(`${nome} deve ter ${r} linha(s) (recebido ${M.length})`);
  return M.map((row, i) => {
    if (!Array.isArray(row)) throw new TypeError(`${nome}[${i}] deve ser array`);
    if (row.length !== c) throw new RangeError(`${nome}[${i}] deve ter ${c} coluna(s) (recebido ${row.length})`);
    return row.map((v, j) => numero(v, `${nome}[${i}][${j}]`));
  });
}

/** Valida o sistema e devolve cópias normalizadas (D sempre matriz p×m). */
function normSys(sys) {
  if (sys === null || typeof sys !== 'object') throw new TypeError('sys deve ser objeto { A, B, C, D, dt }');
  const { r: n, c: cA } = dimsOf(sys.A, 'A');
  if (cA !== n) throw new RangeError('A deve ser quadrada');
  const A = copyMatrix(sys.A, 'A', n, n);
  const { r: nb, c: m } = dimsOf(sys.B, 'B');
  if (nb !== n) throw new RangeError(`B deve ter ${n} linha(s)`);
  const B = copyMatrix(sys.B, 'B', n, m);
  const { r: p, c: cC } = dimsOf(sys.C, 'C');
  if (cC !== n) throw new RangeError(`C deve ter ${n} coluna(s)`);
  const C = copyMatrix(sys.C, 'C', p, n);
  let D;
  if (sys.D === undefined) {
    D = Array.from({ length: p }, () => new Array(m).fill(0));
  } else if (typeof sys.D === 'number') {
    if (p !== 1 || m !== 1) throw new RangeError('D escalar só é aceito quando p = m = 1');
    D = [[numero(sys.D, 'D')]];
  } else {
    D = copyMatrix(sys.D, 'D', p, m);
  }
  const dt = checkDt(sys.dt === undefined ? 0 : sys.dt);
  return { A, B, C, D, n, m, p, dt };
}

function timeVector(t) {
  if (!Array.isArray(t)) throw new TypeError('t deve ser array de instantes');
  if (t.length < 2) throw new RangeError('t deve ter ao menos 2 amostras');
  return t.map((v, k) => numero(v, `t[${k}]`));
}

/** Valida t (ou gera a grade automática) e devolve {tv, h}: passo uniforme obrigatório. */
function resolveTime(s, t) {
  const tv = t === undefined ? defaultTime(s) : timeVector(t);
  const h = tv[1] - tv[0];
  if (!(h > 0)) throw new RangeError('t deve ser estritamente crescente');
  for (let k = 1; k < tv.length; k++) {
    if (Math.abs(tv[k] - tv[k - 1] - h) > 1e-9 * h) throw new RangeError(`passo de t não uniforme na amostra ${k}`);
  }
  if (s.dt > 0 && Math.abs(h - s.dt) > 1e-9 * s.dt) {
    throw new RangeError(`passo de t (${h}) deve ser igual a dt (${s.dt}) em sistema discreto`);
  }
  return { tv, h };
}

function inputSeq(u, N, m) {
  if (!Array.isArray(u)) throw new TypeError('u deve ser array de amostras');
  if (u.length !== N) throw new RangeError(`u deve ter ${N} amostras (recebido ${u.length})`);
  return u.map((uk, k) => {
    if (m === 1 && typeof uk === 'number') return [numero(uk, `u[${k}]`)];
    if (!Array.isArray(uk)) throw new TypeError(`u[${k}] deve ser array de ${m} entrada(s)`);
    if (uk.length !== m) throw new RangeError(`u[${k}] deve ter ${m} entrada(s) (recebido ${uk.length})`);
    return uk.map((v, j) => numero(v, `u[${k}][${j}]`));
  });
}

function initialState(x0, n) {
  if (x0 === 0) return new Array(n).fill(0);
  if (!Array.isArray(x0)) throw new TypeError('x0 deve ser array de n estados (ou 0 para estado nulo)');
  if (x0.length !== n) throw new RangeError(`x0 deve ter ${n} elemento(s) (recebido ${x0.length})`);
  return x0.map((v, i) => numero(v, `x0[${i}]`));
}

function inputIndex(input, m) {
  if (!Number.isInteger(input)) throw new TypeError('input deve ser inteiro (índice do canal, 0-based)');
  if (input < 0 || input >= m) throw new RangeError(`input fora da faixa 0..${m - 1}`);
  return input;
}

/* ------------------------- núcleo ------------------------- */

/**
 * Simulação com entrada U (N vetores de m entradas) e estado inicial x0 (n).
 * Contínuo: Ad, Bd = ZOH(h); discreto: A, B. Retorna {x, y} sem alterar s.
 */
function simulate(s, h, U, x0) {
  const { A, B, C, D, n, m, p, dt } = s;
  const { Ad, Bd } = dt === 0 ? c2d(A, B, h) : { Ad: A, Bd: B };
  const N = U.length;
  const x = new Array(N);
  const y = new Array(N);
  let xk = x0.slice();
  for (let k = 0; k < N; k++) {
    const uk = U[k];
    x[k] = xk.slice();
    const yk = new Array(p);
    for (let i = 0; i < p; i++) {
      let acc = 0;
      for (let j = 0; j < n; j++) acc += C[i][j] * xk[j];
      for (let j = 0; j < m; j++) acc += D[i][j] * uk[j];
      yk[i] = acc;
    }
    y[k] = p === 1 ? yk[0] : yk;
    if (k < N - 1) {
      const nx = new Array(n);
      for (let i = 0; i < n; i++) {
        let acc = 0;
        for (let j = 0; j < n; j++) acc += Ad[i][j] * xk[j];
        for (let j = 0; j < m; j++) acc += Bd[i][j] * uk[j];
        nx[i] = acc;
      }
      xk = nx;
    }
  }
  return { x, y };
}

const zerosIn = (m) => new Array(m).fill(0);
const unitIn = (m, j) => { const e = zerosIn(m); e[j] = 1; return e; };

/* ------------------------- API pública ------------------------- */

/**
 * Função de transferência → espaço de estados (forma companheira de control.tf2ss).
 * @param {number[]} num coeficientes do numerador (maior potência primeiro)
 * @param {number[]} den coeficientes do denominador
 * @param {number} [dt=0] 0 = contínuo; > 0 = discreto
 * @returns {{A:number[][], B:number[][], C:number[][], D:number, dt:number}}
 */
export function tfToSS(num, den, dt = 0) {
  const d = checkDt(dt);
  const ss = tf2ss(num, den);
  return { A: ss.A, B: ss.B, C: ss.C, D: ss.D, dt: d };
}

/**
 * Grade automática de tempo (usada quando t é omitido).
 * Contínuo: 501 pontos em [0, 5τ]; discreto: t_k = k·dt. Regras no cabeçalho do módulo.
 * @param {object} sys sistema {A, B, C, D, dt}
 * @returns {number[]} instantes
 */
export function defaultTime(sys) {
  const s = normSys(sys);
  const lam = eigvals(s.A);
  if (s.dt === 0) {
    let tau = 0;
    for (const [re, im] of lam) {
      const mod = Math.hypot(re, im);
      if (re < -1e-9 * (1 + mod)) tau = Math.max(tau, 1 / -re);
    }
    if (tau === 0) tau = 1;
    return linspace(0, 5 * tau, 501);
  }
  let tauD = 0;
  for (const [re, im] of lam) {
    const mod = Math.hypot(re, im);
    if (mod > 1e-12 && mod < 1) tauD = Math.max(tauD, 1 / -Math.log(mod));
  }
  if (tauD === 0) tauD = 1;
  const K = Math.min(1000, Math.max(10, Math.ceil(5 * tauD)));
  return Array.from({ length: K + 1 }, (_, k) => k * s.dt);
}

/**
 * Simulação com entrada arbitrária. Contínuo: entrada ZOH entre amostras de t (passo uniforme).
 * @param {object} sys sistema {A, B, C, D, dt}
 * @param {number[]|number[][]} u N amostras de entrada
 * @param {number[]} t instantes (uniformes)
 * @param {number|number[]} [x0=0] estado inicial (0 = nulo)
 * @returns {{t:number[], y:number|number[][], x:number[][]}}
 */
export function lsim(sys, u, t, x0 = 0) {
  const s = normSys(sys);
  if (t === undefined) throw new TypeError('lsim exige o vetor de tempo t');
  const { tv, h } = resolveTime(s, t);
  const U = inputSeq(u, tv.length, s.m);
  const { x, y } = simulate(s, h, U, initialState(x0, s.n));
  return { t: tv, y, x };
}

/**
 * Resposta ao degrau unitário no canal 'input' (demais canais nulos).
 * @param {object} sys @param {number[]} [t] @param {number} [input=0]
 * @returns {{t:number[], y:number|number[][], x:number[][]}}
 */
export function step(sys, t, input = 0) {
  const s = normSys(sys);
  const j = inputIndex(input, s.m);
  const { tv, h } = resolveTime(s, t);
  const U = tv.map(() => unitIn(s.m, j));
  const { x, y } = simulate(s, h, U, zerosIn(s.n));
  return { t: tv, y, x };
}

/**
 * Resposta ao impulso no canal 'input'.
 * Contínuo: y(t) = C e^{At} B (x0 = B·e_j, D·δ ignorado). Discreto: sequência unitária u[0] = e_j.
 * @param {object} sys @param {number[]} [t] @param {number} [input=0]
 * @returns {{t:number[], y:number|number[][], x:number[][]}}
 */
export function impulse(sys, t, input = 0) {
  const s = normSys(sys);
  const j = inputIndex(input, s.m);
  const { tv, h } = resolveTime(s, t);
  if (s.dt === 0) {
    const x0 = s.B.map((row) => row[j]);
    const U = tv.map(() => zerosIn(s.m));
    const { x, y } = simulate(s, h, U, x0);
    return { t: tv, y, x };
  }
  const U = tv.map((_, k) => (k === 0 ? unitIn(s.m, j) : zerosIn(s.m)));
  const { x, y } = simulate(s, h, U, zerosIn(s.n));
  return { t: tv, y, x };
}

/**
 * Resposta à condição inicial x0 com entrada nula.
 * @param {object} sys @param {number|number[]} x0 @param {number[]} [t]
 * @returns {{t:number[], y:number|number[][], x:number[][]}}
 */
export function initial(sys, x0, t) {
  const s = normSys(sys);
  if (x0 === undefined) throw new TypeError('initial exige a condição inicial x0');
  const { tv, h } = resolveTime(s, t);
  const U = tv.map(() => zerosIn(s.m));
  const { x, y } = simulate(s, h, U, initialState(x0, s.n));
  return { t: tv, y, x };
}

/**
 * Métricas de resposta ao degrau, segundo a definição de control.step_info (python-control).
 * Resposta normalizada yn = y / yfinal. Tempos por índice de amostra, sem interpolação.
 * - riseTime: t(yn ≥ r2) − t(yn ≥ r1), primeiros índices; NaN se a faixa não for atingida.
 * - settlingTime: instante seguinte à última amostra com |yn − 1| > settlingPct/100;
 *   0 (t[0]) se nunca sai da faixa; NaN se ainda está fora no último instante.
 * - overshoot = 100·max(0, max(yn) − 1); undershoot = 100·max(0, −min(yn)), em %.
 * - peak = max|y| e peakTime = instante correspondente (primeiro índice em empate).
 * - settlingMin/settlingMax: como em control.step_info, mínimo e máximo de y a partir do índice
 *   em que yn ≥ r2 (fim da subida), limitados por yfinal: min(min(y[hi:]), yfinal) e
 *   max(max(y[hi:]), yfinal). NaN se a faixa de subida não for atingida.
 * - steadyStateValue = yfinal (padrão: última amostra de y).
 * @param {number[]} y resposta (uma saída)
 * @param {number[]} t instantes estritamente crescentes
 * @param {number} [yfinal] valor final (≠ 0)
 * @param {number} [settlingPct=2] faixa de acomodação em %, 0 < settlingPct < 100
 * @param {number[]} [riseLimits=[0.1,0.9]] 0 < r1 < r2
 * @returns {object}
 */
export function stepinfo(y, t, yfinal, settlingPct = 2, riseLimits = [0.1, 0.9]) {
  if (!Array.isArray(y) || !Array.isArray(t)) throw new TypeError('y e t devem ser arrays');
  if (y.length !== t.length) throw new RangeError('y e t devem ter o mesmo comprimento');
  if (y.length < 2) throw new RangeError('stepinfo exige ao menos 2 amostras');
  const Y = y.map((v, k) => numero(v, `y[${k}]`));
  const T = t.map((v, k) => numero(v, `t[${k}]`));
  for (let k = 1; k < T.length; k++) {
    if (!(T[k] > T[k - 1])) throw new RangeError('t deve ser estritamente crescente');
  }
  const yf = yfinal === undefined ? Y[Y.length - 1] : numero(yfinal, 'yfinal');
  if (yf === 0) throw new RangeError('yfinal deve ser diferente de zero');
  const sp = numero(settlingPct, 'settlingPct');
  if (!(sp > 0 && sp < 100)) throw new RangeError('settlingPct deve estar em (0, 100)');
  if (!Array.isArray(riseLimits) || riseLimits.length !== 2) throw new TypeError('riseLimits deve ser [r1, r2]');
  const r1 = numero(riseLimits[0], 'riseLimits[0]');
  const r2 = numero(riseLimits[1], 'riseLimits[1]');
  if (!(0 < r1 && r1 < r2)) throw new RangeError('riseLimits deve satisfazer 0 < r1 < r2');

  const n = Y.length;
  const yn = Y.map((v) => v / yf);
  const firstGe = (lvl) => yn.findIndex((v) => v >= lvl);
  const lo = firstGe(r1);
  const hi = firstGe(r2);
  const riseTime = lo < 0 || hi < 0 ? NaN : T[hi] - T[lo];

  const thr = sp / 100;
  let last = -1;
  for (let k = 0; k < n; k++) if (Math.abs(yn[k] - 1) > thr) last = k;
  let si;
  if (last < 0) si = 0;
  else if (last === n - 1) si = -1;
  else si = last + 1;
  let settlingTime = NaN;
  let settlingMin = NaN;
  let settlingMax = NaN;
  if (si >= 0) settlingTime = T[si];
  if (hi >= 0) {
    settlingMin = yf;
    settlingMax = yf;
    for (let k = hi; k < n; k++) {
      if (Y[k] < settlingMin) settlingMin = Y[k];
      if (Y[k] > settlingMax) settlingMax = Y[k];
    }
  }

  let pk = 0;
  let maxYn = -Infinity;
  let minYn = Infinity;
  for (let k = 0; k < n; k++) {
    if (Math.abs(Y[k]) > Math.abs(Y[pk])) pk = k;
    if (yn[k] > maxYn) maxYn = yn[k];
    if (yn[k] < minYn) minYn = yn[k];
  }

  return {
    riseTime,
    settlingTime,
    overshoot: 100 * Math.max(0, maxYn - 1),
    undershoot: 100 * Math.max(0, -minYn),
    peak: Math.abs(Y[pk]),
    peakTime: T[pk],
    settlingMin,
    settlingMax,
    steadyStateValue: yf,
  };
}
