/**
 * EEVL · Construtores e manipulação de modelos lineares (módulo puro: ESM, sem DOM, sem eval) · v1.0.0
 *
 * tf, ss, zpk   construtores (python-control / MATLAB): validam e devolvem objetos simples
 * negate        −sys (python-control negate; MATLAB −sys)
 * append        agrupa entradas e saídas em um único sistema SS (python-control append / MATLAB append)
 * modred        redução de ordem por eliminação de estados (python-control model_reduction, MATLAB modred)
 *
 * Formas de sistema (as mesmas de analysis.js):
 * - TF  {num, den}    coeficientes em ordem decrescente
 * - ZPK {z, p, k}     z, p: pares [re, im]; k real
 * - SS  {A, B, C, D}  matrizes como arrays de linhas; D escalar ou matriz p×m
 * Campo opcional `dt` > 0 => discreto; ausente => contínuo (os construtores só gravam `dt` se for > 0).
 *
 * Convenções e diferenças em relação ao python-control 0.10.2:
 * - ss() devolve sempre D como matriz p×m; sistema sem estados tem A = B = C = [] e D p×m.
 * - negate: TF nega num; ZPK nega k; SS nega C e D (igual a −sys do python-control). Preserva a forma e o dt.
 * - append: sempre devolve SS (blocos diagonais). TF e ZPK são convertidos pela forma canônica
 *   controlável (tf2ss); exige o mesmo dt em todos os sistemas e TF/ZPK próprios.
 *   (python-control devolve o tipo do primeiro argumento.)
 * - modred: elim = índices dos estados a eliminar (base 0) ou máscara booleana de comprimento n, como
 *   no MATLAB. 'matchdc' (padrão) substitui os estados eliminados pelo equilíbrio, preservando o ganho
 *   DC; 'truncate' apenas os remove. Em sistema discreto, 'matchdc' usa x₂ = (I − A₂₂)⁻¹(A₂₁x₁ + B₂u),
 *   que preserva o ganho em z = 1; o python-control 0.10.2 não implementa esse caso (NotImplementedError).
 *   Preserva dt. Sem aviso de instabilidade: o chamador decide.
 *
 * Erros: TypeError para tipo inválido; RangeError para valor ou dimensão inválidos
 * (não finito, den nulo, A22 singular, dt diferentes, sistema impróprio).
 */

import { ptrim } from './polynomial.js';
import { tf2ss } from './control.js';
import { zpk2tf } from './analysis.js';
import { zeros, mmul, madd, msolve, eye } from './matrix.js';

/* ------------------------- validação ------------------------- */

function num(x, name) {
  if (typeof x !== 'number') throw new TypeError(`${name} deve ser número`);
  if (!Number.isFinite(x)) throw new RangeError(`${name} deve ser finito`);
  return x;
}

function poly(p, name) {
  if (!Array.isArray(p)) throw new TypeError(`${name} deve ser array de coeficientes`);
  if (p.length === 0) throw new RangeError(`${name} não pode ser vazio`);
  return p.map((x, i) => num(x, `${name}[${i}]`));
}

function dtArg(dt) {
  if (dt === undefined) return 0;
  num(dt, 'dt');
  if (dt < 0) throw new RangeError('dt deve ser ≥ 0');
  return dt;
}

// Acrescenta dt somente se > 0 (contínuo = sem campo).
function withDt(obj, dt) {
  if (dt > 0) obj.dt = dt;
  return obj;
}

// Valida matriz retangular r×c (r = 0 permitido: []) e devolve cópia.
function matrix(M, name) {
  if (!Array.isArray(M)) throw new TypeError(`${name} deve ser matriz (array de linhas)`);
  const c = M.length ? (Array.isArray(M[0]) ? M[0].length : -1) : 0;
  if (c < 0) throw new TypeError(`${name} deve ser matriz (array de linhas)`);
  return M.map((row, i) => {
    if (!Array.isArray(row)) throw new TypeError(`${name}[${i}] deve ser array`);
    if (row.length !== c) throw new RangeError(`${name} não é retangular (linha ${i})`);
    return row.map((v, j) => num(v, `${name}[${i}][${j}]`));
  });
}

// Valida {A, B, C, D} e devolve cópias com D matricial e as dimensões n, m, p.
function ssParts(A, B, C, D) {
  const Am = matrix(A, 'A'), Bm = matrix(B, 'B'), Cm = matrix(C, 'C');
  const n = Am.length;
  if (n > 0 && Am[0].length !== n) throw new RangeError('A deve ser quadrada');
  let m, p;
  if (n === 0) {
    if (Bm.length || Cm.length) throw new RangeError('sem estados: B e C devem ser vazios');
    if (D === undefined) throw new RangeError('sem estados: informe D');
    if (typeof D === 'number') { m = 1; p = 1; } else {
      const Dm = matrix(D, 'D');
      p = Dm.length;
      m = p ? Dm[0].length : 0;
    }
  } else {
    if (Bm.length !== n) throw new RangeError('B deve ter n linhas');
    m = Bm[0].length;
    p = Cm.length;
    if (m === 0 || p === 0) throw new RangeError('B e C não podem ter zero colunas/linhas');
    if (Cm[0].length !== n) throw new RangeError('C deve ter n colunas');
  }
  let Dm;
  if (D === undefined) Dm = zeros(p, m);
  else if (typeof D === 'number') {
    num(D, 'D');
    if (p !== 1 || m !== 1) throw new RangeError('D escalar só vale para sistema 1×1');
    Dm = [[D]];
  } else {
    Dm = matrix(D, 'D');
    if (Dm.length !== p || (p > 0 && Dm[0].length !== m)) throw new RangeError(`D deve ser ${p}×${m}`);
  }
  return { A: Am, B: Bm, C: Cm, D: Dm, n, m, p };
}

/* ------------------------- construtores ------------------------- */

/**
 * Função de transferência SISO (python-control tf). Remove zeros à esquerda; den não pode ser nulo.
 * @param {number[]} numIn @param {number[]} denIn @param {number} [dt=0] dt > 0 => discreto
 * @returns {{num: number[], den: number[], dt?: number}}
 */
export function tf(numIn, denIn, dt = 0) {
  const n = ptrim(poly(numIn, 'num')), d = ptrim(poly(denIn, 'den'));
  if (d[0] === 0) throw new RangeError('den identicamente nulo');
  return withDt({ num: n, den: d }, dtArg(dt));
}

/**
 * Espaço de estados (python-control ss). D omitido => zeros; D sempre devolvido como matriz p×m.
 * @param {number[][]} A n×n @param {number[][]} B n×m @param {number[][]} C p×n
 * @param {number|number[][]} [D] @param {number} [dt=0]
 * @returns {{A: number[][], B: number[][], C: number[][], D: number[][], dt?: number}}
 */
export function ss(A, B, C, D, dt = 0) {
  const s = ssParts(A, B, C, D);
  return withDt({ A: s.A, B: s.B, C: s.C, D: s.D }, dtArg(dt));
}

/**
 * Zeros, polos e ganho (python-control zpk). Raízes como [re, im] ou como número real; o conjunto
 * deve ser simétrico por conjugação (o polinômio tem de ser real), senão RangeError.
 * @param {Array<number|number[]>} z @param {Array<number|number[]>} p @param {number} k
 * @param {number} [dt=0]
 * @returns {{z: number[][], p: number[][], k: number, dt?: number}}
 */
export function zpk(z, p, k, dt = 0) {
  const toPairs = (list, name) => {
    if (!Array.isArray(list)) throw new TypeError(`${name} deve ser lista de raízes`);
    return list.map((r, i) => {
      if (typeof r === 'number') return [num(r, `${name}[${i}]`), 0];
      if (!Array.isArray(r) || r.length !== 2) throw new TypeError(`${name}[${i}] deve ser número ou [re, im]`);
      return [num(r[0], `${name}[${i}][0]`), num(r[1], `${name}[${i}][1]`)];
    });
  };
  const zz = toPairs(z, 'z'), pp = toPairs(p, 'p'), kk = num(k, 'k');
  zpk2tf(zz, pp, kk); // valida simetria por conjugação
  return withDt({ z: zz, p: pp, k: kk }, dtArg(dt));
}

/* ------------------------- formas ------------------------- */

function kindOf(sys) {
  if (sys === null || typeof sys !== 'object') {
    throw new TypeError('sistema deve ser objeto {num, den}, {z, p, k} ou {A, B, C, D}');
  }
  if ('num' in sys && 'den' in sys) return 'tf';
  if ('z' in sys && 'p' in sys && 'k' in sys) return 'zpk';
  if ('A' in sys && 'B' in sys && 'C' in sys && 'D' in sys) return 'ss';
  throw new TypeError('sistema não reconhecido: use {num, den}, {z, p, k} ou {A, B, C, D}');
}

function dtOf(sys) {
  return dtArg(sys.dt);
}

// Qualquer forma -> SS (cópia validada, D matricial).
function toSS(sys) {
  const kind = kindOf(sys);
  if (kind === 'ss') return ssParts(sys.A, sys.B, sys.C, sys.D);
  const { num: n, den: d } = kind === 'tf'
    ? { num: ptrim(poly(sys.num, 'num')), den: ptrim(poly(sys.den, 'den')) }
    : zpk2tf(sys.z, sys.p, num(sys.k, 'k'));
  if (d[0] === 0) throw new RangeError('den identicamente nulo');
  if (n.length > d.length) throw new RangeError('função imprópria (mais zeros que polos)');
  if (d.length === 1) return { A: [], B: [], C: [], D: [[n[0] / d[0]]], n: 0, m: 1, p: 1 };
  const r = tf2ss(n, d);
  return { A: r.A, B: r.B, C: r.C, D: [[r.D]], n: r.n, m: 1, p: 1 };
}

/* ------------------------- negate ------------------------- */

const neg = (v) => (v === 0 ? 0 : -v);

/**
 * −sys. TF: nega num; ZPK: nega k; SS: nega C e D. Preserva forma e dt.
 * @param {object} sys @returns {object}
 */
export function negate(sys) {
  const kind = kindOf(sys);
  const dt = dtOf(sys);
  if (kind === 'tf') {
    const t = tf(sys.num, sys.den);
    return withDt({ num: t.num.map(neg), den: t.den }, dt);
  }
  if (kind === 'zpk') {
    const z = zpk(sys.z, sys.p, sys.k);
    return withDt({ z: z.z, p: z.p, k: neg(z.k) }, dt);
  }
  const s = ssParts(sys.A, sys.B, sys.C, sys.D);
  return withDt({ A: s.A, B: s.B, C: s.C.map(r => r.map(neg)), D: s.D.map(r => r.map(neg)) }, dt);
}

/* ------------------------- append ------------------------- */

/**
 * Agrupa sistemas em um só, com entradas e saídas empilhadas (matrizes em blocos diagonais).
 * @param {...object} systems pelo menos um; todos com o mesmo dt
 * @returns {{A: number[][], B: number[][], C: number[][], D: number[][], dt?: number}}
 */
export function append(...systems) {
  if (systems.length === 0) throw new RangeError('informe ao menos um sistema');
  const dt = dtOf(systems[0]);
  const parts = systems.map((s, i) => {
    if (dtOf(s) !== dt) throw new RangeError(`sistema ${i + 1}: dt diferente do primeiro`);
    return toSS(s);
  });
  const N = parts.reduce((a, s) => a + s.n, 0);
  const M = parts.reduce((a, s) => a + s.m, 0);
  const P = parts.reduce((a, s) => a + s.p, 0);
  const A = zeros(N, N), B = zeros(N, M), C = zeros(P, N), D = zeros(P, M);
  let n0 = 0, m0 = 0, p0 = 0;
  for (const s of parts) {
    for (let i = 0; i < s.n; i++) {
      for (let j = 0; j < s.n; j++) A[n0 + i][n0 + j] = s.A[i][j];
      for (let j = 0; j < s.m; j++) B[n0 + i][m0 + j] = s.B[i][j];
    }
    for (let i = 0; i < s.p; i++) {
      for (let j = 0; j < s.n; j++) C[p0 + i][n0 + j] = s.C[i][j];
      for (let j = 0; j < s.m; j++) D[p0 + i][m0 + j] = s.D[i][j];
    }
    n0 += s.n; m0 += s.m; p0 += s.p;
  }
  return withDt({ A: N ? A : [], B: N ? B : [], C: N ? C : [], D }, dt);
}

/* ------------------------- modred ------------------------- */

// Índices (base 0) ou máscara booleana -> lista ordenada, sem repetição.
function elimList(elim, n) {
  if (!Array.isArray(elim)) throw new TypeError('elim deve ser array de índices ou máscara booleana');
  let idx;
  if (elim.length > 0 && elim.every(v => typeof v === 'boolean')) {
    if (elim.length !== n) throw new RangeError(`máscara deve ter comprimento ${n}`);
    idx = elim.flatMap((v, i) => (v ? [i] : []));
  } else {
    idx = elim.map((v, i) => {
      if (!Number.isInteger(v)) throw new TypeError(`elim[${i}] deve ser inteiro`);
      if (v < 0 || v >= n) throw new RangeError(`elim[${i}] fora de 0..${n - 1}`);
      return v;
    });
    if (new Set(idx).size !== idx.length) throw new RangeError('elim tem índices repetidos');
    idx.sort((a, b) => a - b);
  }
  return idx;
}

const sub = (M, rows, cols) => rows.map(i => cols.map(j => M[i][j]));

/**
 * Reduz a ordem eliminando estados. Os estados restantes mantêm a ordem original.
 * @param {object} sys TF, ZPK ou SS (convertido para SS)
 * @param {number[]|boolean[]} elim estados a eliminar (índices base 0 ou máscara)
 * @param {'matchdc'|'truncate'} [method='matchdc']
 * @returns {{A: number[][], B: number[][], C: number[][], D: number[][], dt?: number}}
 * @throws {RangeError} A₂₂ (ou I − A₂₂ no discreto) singular no 'matchdc'
 */
export function modred(sys, elim, method = 'matchdc') {
  if (method !== 'matchdc' && method !== 'truncate') {
    throw new RangeError("method deve ser 'matchdc' ou 'truncate'");
  }
  const dt = dtOf(sys);
  const s = toSS(sys);
  const out = elimList(elim, s.n);
  const keep = [...Array(s.n).keys()].filter(i => !out.includes(i));
  const A11 = sub(s.A, keep, keep), B1 = sub(s.B, keep, [...Array(s.m).keys()]);
  const C1 = sub(s.C, [...Array(s.p).keys()], keep);
  let Ar = A11, Br = B1, Cr = C1, Dr = s.D;
  if (method === 'matchdc' && out.length > 0) {
    const A12 = sub(s.A, keep, out), A21 = sub(s.A, out, keep), A22 = sub(s.A, out, out);
    const B2 = sub(s.B, out, [...Array(s.m).keys()]);
    const C2 = sub(s.C, [...Array(s.p).keys()], out);
    // Contínuo: 0 = A21x1 + A22x2 + B2u. Discreto: x2 = A21x1 + A22x2 + B2u => (I − A22)x2 = ...
    const E = dt > 0 ? madd(eye(out.length), A22, -1) : A22;
    const sinal = dt > 0 ? 1 : -1; // x2 = sinal·E⁻¹(A21x1 + B2u)
    let X;
    try {
      X = msolve(E, joinCols(A21, B2));
    } catch (e) {
      throw new RangeError(dt > 0 ? 'I − A22 é singular' : 'A22 é singular');
    }
    const nk = keep.length;
    const E1 = X.map(r => r.slice(0, nk).map(v => sinal * v)); // x2 = E1·x1 + E2·u
    const E2 = X.map(r => r.slice(nk).map(v => sinal * v));
    if (nk > 0) {
      Ar = madd(A11, mmul(A12, E1));
      Br = madd(B1, mmul(A12, E2));
      Cr = madd(C1, mmul(C2, E1));
    }
    Dr = madd(s.D, mmul(C2, E2));
  }
  const N = keep.length;
  return withDt({ A: N ? Ar : [], B: N ? Br : [], C: N ? Cr : [], D: Dr }, dt);
}

// [X | Y] (mesmo número de linhas).
function joinCols(X, Y) {
  return X.map((r, i) => r.concat(Y[i]));
}
