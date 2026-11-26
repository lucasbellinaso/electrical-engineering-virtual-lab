// Controle SISO: modelos (TF <-> espaço de estados), discretização ZOH, aproximação de Padé,
// resposta em frequência, margens de estabilidade e álgebra de blocos. ESM puro, sem DOM, sem eval.
//
// Convenções:
// - polinômios: arrays de coeficientes em ordem decrescente de potência (s²+3s+2 -> [1,3,2]);
// - matrizes: arrays de linhas (ex.: [[a,b],[c,d]]);
// - números complexos (raízes, pontos s): [re, im];
// - frequências em rad/s; fase em graus; módulo em dB (20·log10|G|).
//
// Erros: TypeError para tipo inválido; RangeError para valor inválido (não finito, dimensão, nulo indevido).
import {ptrim, pmul, padd, pscale} from './polynomial.js';
import {zeros as zerosMat, eye as eyeMat, mmul, madd, mscale, expm, charpoly, logm, msolve} from './matrix.js';
import {logspace} from './numeric.js';
import {eigvals} from './eigen.js';

const R2D = 180 / Math.PI;

/* ------------------------- validação ------------------------- */
function finite(x, name) {
  if (typeof x !== 'number') throw new TypeError(`${name} deve ser número`);
  if (!Number.isFinite(x)) throw new RangeError(`${name} deve ser finito`);
  return x;
}
function finitePos(x, name) {
  finite(x, name);
  if (x <= 0) throw new RangeError(`${name} deve ser > 0`);
  return x;
}
function poly(p, name) {
  if (!Array.isArray(p)) throw new TypeError(`${name} deve ser array de coeficientes`);
  if (p.length === 0) throw new RangeError(`${name} vazio`);
  p.forEach((v, i) => finite(v, `${name}[${i}]`));
  return p;
}
function nonZeroPoly(p, name) {
  poly(p, name);
  if (ptrim(p)[0] === 0) throw new RangeError(`${name} identicamente nulo`);
  return p;
}
function complex(z, name) {
  if (!Array.isArray(z) || z.length !== 2) throw new TypeError(`${name} deve ser [re, im]`);
  finite(z[0], `${name}[0]`);
  finite(z[1], `${name}[1]`);
  return z;
}
// Valida matriz retangular (array de linhas) e devolve [linhas, colunas]; matriz vazia -> [0, 0].
function mat(M, name) {
  if (!Array.isArray(M)) throw new TypeError(`${name} deve ser matriz (array de linhas)`);
  const c = M.length ? (Array.isArray(M[0]) ? M[0].length : -1) : 0;
  if (c < 0) throw new TypeError(`${name} deve ser matriz (array de linhas)`);
  M.forEach((row, i) => {
    if (!Array.isArray(row)) throw new TypeError(`${name}[${i}] deve ser array`);
    if (row.length !== c) throw new RangeError(`${name} não é retangular (linha ${i})`);
    row.forEach((v, j) => finite(v, `${name}[${i}][${j}]`));
  });
  return [M.length, c];
}

/* ------------------------- espaço de estados ------------------------- */
// Forma canônica controlável.
export function tf2ss(numIn, denIn) {
  poly(numIn, 'num');
  nonZeroPoly(denIn, 'den');
  let den = ptrim(denIn);
  const numT = ptrim(numIn);
  if (numT.length > den.length) throw new RangeError('função imprópria (grau do numerador > grau do denominador)');
  const n = den.length - 1;
  const a = den.map(v => v / den[0]);
  const b = new Array(n + 1).fill(0);
  numT.forEach((v, i) => b[n + 1 - numT.length + i] = v / den[0]);
  const D = b[0];
  const A = zerosMat(n, n), B = zerosMat(n, 1), C = zerosMat(1, n);
  for (let j = 0; j < n; j++) A[0][j] = -a[j + 1];
  for (let i = 1; i < n; i++) A[i][i - 1] = 1;
  if (n > 0) B[0][0] = 1;
  for (let j = 0; j < n; j++) C[0][j] = b[j + 1] - D * a[j + 1];
  return { A, B, C, D, n };
}

// Forma SISO: num = charpoly(A−B·C) + (D−1)·charpoly(A), den = charpoly(A).
export function ss2tf(A, B, C, D) {
  const [n, c] = mat(A, 'A');
  if (n === 0 || n !== c) throw new RangeError('A deve ser quadrada e não vazia');
  const [nb, mb] = mat(B, 'B');
  if (nb !== n || mb !== 1) throw new RangeError('B deve ser n×1');
  const [nc, cc] = mat(C, 'C');
  if (nc !== 1 || cc !== n) throw new RangeError('C deve ser 1×n');
  let d = D;
  if (Array.isArray(D)) {
    const [dr, dc] = mat(D, 'D');
    if (dr !== 1 || dc !== 1) throw new RangeError('D deve ser escalar ou 1×1');
    d = D[0][0];
  }
  finite(d, 'D');
  const ABC = madd(A, mscale(mmul(B, C), -1));
  const num = padd(charpoly(ABC), pscale(charpoly(A), d - 1));
  const den = charpoly(A);
  return { num: ptrim(num), den: ptrim(den) };
}

// ZOH exato via exponencial da matriz aumentada.
export function c2d(A, B, dt) {
  finitePos(dt, 'dt');
  const [n, c] = mat(A, 'A');
  if (n !== c) throw new RangeError('A deve ser quadrada');
  const [nb, m] = mat(B, 'B');
  if (n === 0) return { Ad: [], Bd: [] };
  if (nb !== n) throw new RangeError('B deve ter n linhas');
  const M = zerosMat(n + m, n + m);
  for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] = A[i][j] * dt; for (let j = 0; j < m; j++) M[i][n + j] = B[i][j] * dt; }
  const E = expm(M);
  return { Ad: E.slice(0, n).map(r => r.slice(0, n)), Bd: E.slice(0, n).map(r => r.slice(n)) };
}

/* ------------------------- discreto → contínuo ------------------------- */
// Conversão discreto → contínuo, inversa de c2d (ZOH) e da transformação bilinear (Tustin).
// sys: {A,B,C,D,dt} (D escalar ou matriz; MIMO permitido) ou {num,den,dt} (SISO), com dt > 0.
// method 'zoh':    A = logm(Ad)/Ts;  B = Γ⁻¹·Bd, Γ = ∫₀^Ts e^{Aτ}dτ = bloco superior direito de
//                  expm([[A, I],[0, 0]]·Ts);  C = Cd;  D = Dd.
//                  Γ⁻¹·Bd = (Ad − I)⁻¹·A·Bd quando Ad − I é invertível; Γ vale também com integrador
//                  (autovalor de Ad em 1). Exige Ad sem autovalor real ≤ 0 (logaritmo real).
// method 'tustin': α = 2/Ts; A = α(Ad + I)⁻¹(Ad − I);  B = (αI − A)·Bd;  C = Cd(Ad + I)⁻¹;
//                  D = Dd − C·Bd. Exige Ad sem autovalor em −1. Mesma função de transferência da
//                  inversa de c2d(...,'tustin'); a realização em estados pode diferir por reescalonamento.
// Retorna {A,B,C,D,dt:0} ({num,den,dt:0} se a entrada era função de transferência).
// Frequências além de Nyquist não são recuperáveis (logaritmo principal).
export function d2c(sys, method = 'zoh') {
  if (method !== 'zoh' && method !== 'tustin') throw new RangeError("method deve ser 'zoh' ou 'tustin'");
  if (!sys || typeof sys !== 'object') throw new TypeError('sys deve ser um objeto {A,B,C,D,dt} ou {num,den,dt}');
  const Ts = finitePos(sys.dt === undefined ? 0 : sys.dt, 'sys.dt (sistema deve ser discreto: dt > 0)');
  const isTF = sys.A === undefined && Array.isArray(sys.num) && Array.isArray(sys.den);
  const base = isTF ? tf2ss(sys.num, sys.den) : sys;
  const Ad = base.A, Bd = base.B, Cd = base.C;
  const [n, nc] = mat(Ad, 'A');
  if (n === 0 || n !== nc) throw new RangeError('A deve ser quadrada e não vazia');
  const [nb, m] = mat(Bd, 'B');
  if (nb !== n) throw new RangeError('B deve ter n linhas');
  const [p, cn] = mat(Cd, 'C');
  if (cn !== n) throw new RangeError('C deve ter n colunas');
  const Dscalar = !Array.isArray(base.D);
  let Dd = Dscalar ? [[finite(base.D, 'D')]] : base.D;
  const [dr, dc] = mat(Dd, 'D');
  if (dr !== p || dc !== m) throw new RangeError('D deve ser p×m');
  const I = eyeMat(n);
  const falhaSing = (msg) => new RangeError(msg);
  let A, B, C, D;
  if (method === 'zoh') {
    const polos = eigvals(Ad);
    if (polos.some(([re, im]) => re <= 0 && Math.abs(im) <= 1e-7 * (1 + Math.abs(re)))) {
      throw falhaSing('d2c zoh: Ad tem autovalor real ≤ 0 (logaritmo real inexistente)');
    }
    A = mscale(logm(Ad), 1 / Ts);
    const M = zerosMat(2 * n, 2 * n);
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] = A[i][j] * Ts; M[i][n + i] = Ts; }
    const E = expm(M);
    const Gam = E.slice(0, n).map(r => r.slice(n));
    try { B = msolve(Gam, Bd); } catch (e) { throw falhaSing('d2c zoh: Γ singular (frequência além de Nyquist)'); }
    C = Cd.map(r => r.slice());
    D = Dd.map(r => r.slice());
  } else {
    const alfa = 2 / Ts;
    const ApI = madd(Ad, I, 1);
    let P;
    try { P = msolve(ApI, I); } catch (e) { throw falhaSing('d2c tustin: Ad + I singular (autovalor em z = −1)'); }
    A = mscale(mmul(P, madd(Ad, I, -1)), alfa);
    B = mmul(madd(mscale(I, alfa), A, -1), Bd);
    C = mmul(Cd, P);
    D = madd(Dd, mmul(C, Bd), -1);
  }
  if (isTF) return { ...ss2tf(A, B, C, D[0][0]), dt: 0 };
  return { A, B, C, D: Dscalar ? D[0][0] : D, dt: 0 };
}

/* ------------------------- Padé ------------------------- */
// Aproximação de Padé de ordem N para atraso T (num/den em ordem decrescente).
export function pade(T, N) {
  finite(T, 'T');
  if (T < 0) throw new RangeError('T deve ser ≥ 0');
  if (!Number.isInteger(N) || N < 0) throw new RangeError('N deve ser inteiro ≥ 0');
  const fact = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };
  const num = [], den = [];
  for (let k = N; k >= 0; k--) {
    const ck = fact(2 * N - k) * fact(N) / (fact(2 * N) * fact(k) * fact(N - k)) * Math.pow(T, k);
    num.push((k % 2 ? -1 : 1) * ck); den.push(ck);
  }
  return { num, den };
}

/* ------------------------- resposta em frequência ------------------------- */
// Fase calculada como soma de ângulos dos fatores → contínua, sem "unwrap".
export function makeFR(zeros, poles, k, discrete, Ts, delay = 0) {
  if (!Array.isArray(zeros)) throw new TypeError('zeros deve ser array de [re, im]');
  if (!Array.isArray(poles)) throw new TypeError('poles deve ser array de [re, im]');
  zeros.forEach((z, i) => complex(z, `zeros[${i}]`));
  poles.forEach((p, i) => complex(p, `poles[${i}]`));
  finite(k, 'k');
  if (k === 0) throw new RangeError('ganho k nulo');
  if (typeof discrete !== 'boolean') throw new TypeError('discrete deve ser booleano');
  if (discrete) finitePos(Ts, 'Ts');
  finite(delay, 'delay');
  if (delay < 0) throw new RangeError('delay deve ser ≥ 0');
  const lk = Math.log10(Math.abs(k)), phk = k < 0 ? -180 : 0;
  return function (w) {
    let lm = lk, ph = 0;
    let xr, xi;
    if (discrete) { xr = Math.cos(w * Ts); xi = Math.sin(w * Ts); } else { xr = 0; xi = w; }
    for (const z of zeros) { const a = xr - z[0], b = xi - z[1]; lm += 0.5 * Math.log10(a * a + b * b); ph += Math.atan2(b, a); }
    for (const p of poles) { const a = xr - p[0], b = xi - p[1]; lm -= 0.5 * Math.log10(a * a + b * b); ph -= Math.atan2(b, a); }
    return { db: 20 * lm, ph: phk + ph * R2D - (discrete ? 0 : w * delay * R2D) };
  };
}

// Bisseção geométrica em [a, b] (a, b > 0) para o sinal de f.
export function bisect(f, a, b, it = 50) {
  if (typeof f !== 'function') throw new TypeError('f deve ser função');
  finitePos(a, 'a');
  finitePos(b, 'b');
  if (!Number.isInteger(it) || it < 0) throw new RangeError('it deve ser inteiro ≥ 0');
  let fa = f(a);
  for (let i = 0; i < it; i++) {
    const m = Math.sqrt(a * b), fm = f(m);
    if ((fm <= 0) === (fa <= 0)) { a = m; fa = fm; } else b = m;
  }
  return Math.sqrt(a * b);
}

// Margens de fase (pm, em graus, em wc) e de ganho (gm, em dB, em wg) numa faixa [w0, w1] rad/s.
export function margins(fr, w0, w1) {
  if (typeof fr !== 'function') throw new TypeError('fr deve ser função de frequência');
  finitePos(w0, 'w0');
  finitePos(w1, 'w1');
  if (w1 <= w0) throw new RangeError('w1 deve ser > w0');
  const ws = logspace(Math.log10(w0), Math.log10(w1), 3000), vals = ws.map(fr);
  const pms = [], gms = [];
  for (let i = 0; i < ws.length - 1; i++) {
    const a = vals[i], b = vals[i + 1];
    if (!isFinite(a.db) || !isFinite(b.db)) continue;
    if ((a.db > 0) !== (b.db > 0)) {
      const wc = bisect(w => fr(w).db, ws[i], ws[i + 1]);
      const ph = fr(wc).ph;
      const pm = ((ph + 180) % 360 + 540) % 360 - 180;
      pms.push({ w: wc, pm });
    }
    const ma = Math.floor((a.ph + 180) / 360), mb = Math.floor((b.ph + 180) / 360);
    if (ma !== mb) {
      const lvl = 360 * Math.max(ma, mb) - 180;
      const wg = bisect(w => fr(w).ph - lvl, ws[i], ws[i + 1]);
      gms.push({ w: wg, gm: -fr(wg).db });
    }
  }
  const pm = pms.length ? pms.reduce((m, x) => Math.abs(x.pm) < Math.abs(m.pm) ? x : m) : { w: NaN, pm: Infinity };
  const gm = gms.length ? gms.reduce((m, x) => Math.abs(x.gm) < Math.abs(m.gm) ? x : m) : { w: NaN, gm: Infinity };
  return { pm, gm };
}

/* ------------------------- álgebra de blocos (SISO) ------------------------- */
// Série: G1·G2.
export function series(n1, d1, n2, d2) {
  nonZeroPoly(d1, 'd1'); poly(n1, 'n1'); poly(n2, 'n2'); nonZeroPoly(d2, 'd2');
  return { num: ptrim(pmul(n1, n2)), den: ptrim(pmul(d1, d2)) };
}

// Paralelo: G1 + G2.
export function parallel(n1, d1, n2, d2) {
  poly(n1, 'n1'); nonZeroPoly(d1, 'd1'); poly(n2, 'n2'); nonZeroPoly(d2, 'd2');
  return { num: ptrim(padd(pmul(n1, d2), pmul(n2, d1))), den: ptrim(pmul(d1, d2)) };
}

// Malha fechada G/(1 − sign·G·H). Com sign = −1 (padrão) é realimentação negativa.
export function feedback(nG, dG, nH = [1], dH = [1], sign = -1) {
  poly(nG, 'nG'); nonZeroPoly(dG, 'dG'); poly(nH, 'nH'); nonZeroPoly(dH, 'dH');
  finite(sign, 'sign');
  const den = ptrim(padd(pmul(dG, dH), pscale(pmul(nG, nH), -sign)));
  if (den[0] === 0) throw new RangeError('laço mal-posto (denominador identicamente nulo)');
  return { num: ptrim(pmul(nG, dH)), den };
}

// Ganho em regime (s = 0): num(0)/den(0). Infinity/-Infinity se den(0) = 0 e num(0) ≠ 0.
export function dcgain(n, d) {
  poly(n, 'num'); poly(d, 'den');
  const n0 = n[n.length - 1], d0 = d[d.length - 1];
  if (d0 === 0) {
    if (n0 === 0) return NaN;
    return n0 > 0 ? Infinity : -Infinity;
  }
  return n0 / d0;
}

// Avalia num(s)/den(s) em s = [re, im] pelo método de Horner complexo; retorna [re, im].
export function evalTF(n, d, s) {
  poly(n, 'num'); poly(d, 'den'); complex(s, 's');
  const horner = (p) => {
    let re = 0, im = 0;
    for (const c of p) { const r = re * s[0] - im * s[1] + c; im = re * s[1] + im * s[0]; re = r; }
    return [re, im];
  };
  const N = horner(n), D = horner(d);
  const m2 = D[0] * D[0] + D[1] * D[1];
  return [(N[0] * D[0] + N[1] * D[1]) / m2, (N[1] * D[0] - N[0] * D[1]) / m2];
}
