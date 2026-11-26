/*
 * Autovalores e autovetores de matriz real — módulo puro (ESM, sem DOM). Nomes no estilo do MATLAB.
 *
 *   eigvals(A) → [[re, im], …]                    ≈ e = eig(A)
 *   eig(A)     → { values, vectors }              ≈ [V, D] = eig(A), com D = diag(values)
 *
 * Convenções do núcleo: matriz = array de linhas; número complexo = [re, im].
 *   values[k]     = [re, im] do k-ésimo autovalor;
 *   vectors[i][k] = [re, im] da componente i do autovetor k (coluna k de V), de modo que A·V = V·D.
 *
 * Algoritmo (A real n×n, como em LAPACK dgeev / EISPACK balanc-orthes-hqr2):
 *   1. Balanceamento por escalas de potência de 2 (D⁻¹AD), que não introduz erro de arredondamento;
 *   2. Redução a Hessenberg por Householder, acumulando Q;
 *   3. QR de Francis com deslocamento duplo, acumulando Z: forma de Schur real A = Z·T·Zᵀ
 *      (T quase triangular superior; blocos 2×2 ↔ pares de autovalores complexos conjugados);
 *   4. Autovetores: cada bloco 2×2 é triangularizado por uma rotação unitária complexa (forma de Schur
 *      complexa) e a substituição regressiva em T dá os vetores no espaço de Schur; V = D·Z·X.
 *
 * Ordem: a ordem das posições na diagonal de T (como o LAPACK), não ordenada. Matrizes simétricas
 * (exatamente) usam o caminho simétrico: autovalores reais em ordem crescente e autovetores ortonormais.
 *
 * Normalização dos autovetores (como o LAPACK): norma-2 unitária e componente de maior módulo real e
 * positiva (a fase e o sinal no MATLAB/SciPy podem diferir; a propriedade A·v = λ·v não). Autovalor real →
 * autovetor real. Pares conjugados têm autovetores conjugados exatos.
 *
 * Precisão: erro de ordem ε·‖A‖ para autovalores simples e bem condicionados. Autovalores múltiplos de matriz
 * defeituosa (bloco de Jordan de ordem m) são calculados com erro de ordem ε^(1/m)·‖A‖ (≈ 1e-8 para m = 2),
 * propriedade do problema, não do método; seus autovetores são quase paralelos, como no MATLAB. Em autovalores
 * repetidos de matriz diagonalizável, os autovetores saem linearmente independentes, mas não necessariamente
 * ortogonais (use matriz simétrica para vetores ortonormais).
 *
 * Erros: TypeError para tipo inválido; RangeError para matriz não quadrada, entrada não finita ou QR sem
 * convergência (mais de 300 iterações em um autovalor).
 */
import { norm1 } from './matrix.js';

const EPS = Number.EPSILON;
const MAX_ITER = 300;

/* ------------------------- validação ------------------------- */

function validaQuadrada(A) {
  if (!Array.isArray(A)) throw new TypeError('A deve ser um array de linhas');
  if (A.length === 0) return 0;
  norm1(A);   // valida retangularidade, tipos e valores finitos (TypeError/RangeError)
  if (A[0].length !== A.length) throw new RangeError(`A deve ser quadrada (recebido ${A.length}x${A[0].length})`);
  return A.length;
}

const copia = (A) => A.map((r) => r.slice());
const identidade = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

/* ------------------------- etapas reais ------------------------- */

// Balanceamento (Parlett–Reinsch, só escalas, radix 2). Devolve B = D⁻¹AD e d (diagonal de D).
function balanceia(A, n) {
  const B = copia(A);
  const d = new Array(n).fill(1);
  const radix = 2, sqrdx = 4;
  let ok = false;
  while (!ok) {
    ok = true;
    for (let i = 0; i < n; i++) {
      let c = 0, r = 0;
      for (let j = 0; j < n; j++) if (j !== i) { c += Math.abs(B[j][i]); r += Math.abs(B[i][j]); }
      if (c === 0 || r === 0) continue;
      let g = r / radix, f = 1;
      const s = c + r;
      while (c < g) { f *= radix; c *= sqrdx; }
      g = r * radix;
      while (c > g) { f /= radix; c /= sqrdx; }
      if ((c + r) / f < 0.95 * s) {
        ok = false;
        d[i] *= f;
        for (let j = 0; j < n; j++) B[i][j] /= f;
        for (let j = 0; j < n; j++) B[j][i] *= f;
      }
    }
  }
  return { B, d };
}

// Redução a Hessenberg por Householder (EISPACK orthes/ortran). H é alterada; devolve Q acumulada em V.
function hessenberg(H, n) {
  const V = identidade(n);
  const ort = new Array(n).fill(0);
  for (let m = 1; m <= n - 2; m++) {
    let scale = 0;
    for (let i = m; i < n; i++) scale += Math.abs(H[i][m - 1]);
    if (scale === 0) continue;
    let h = 0;
    for (let i = n - 1; i >= m; i--) { ort[i] = H[i][m - 1] / scale; h += ort[i] * ort[i]; }
    let g = Math.sqrt(h);
    if (ort[m] > 0) g = -g;
    h -= ort[m] * g;
    ort[m] -= g;
    for (let j = m; j < n; j++) {
      let f = 0;
      for (let i = n - 1; i >= m; i--) f += ort[i] * H[i][j];
      f /= h;
      for (let i = m; i < n; i++) H[i][j] -= f * ort[i];
    }
    for (let i = 0; i < n; i++) {
      let f = 0;
      for (let j = n - 1; j >= m; j--) f += ort[j] * H[i][j];
      f /= h;
      for (let j = m; j < n; j++) H[i][j] -= f * ort[j];
    }
    ort[m] = scale * ort[m];
    H[m][m - 1] = scale * g;
  }
  for (let m = n - 2; m >= 1; m--) {
    if (H[m][m - 1] !== 0) {
      for (let i = m + 1; i < n; i++) ort[i] = H[i][m - 1];
      for (let j = m; j < n; j++) {
        let g = 0;
        for (let i = m; i < n; i++) g += ort[i] * V[i][j];
        g = (g / ort[m]) / H[m][m - 1];   // divisão dupla evita underflow
        for (let i = m; i < n; i++) V[i][j] += g * ort[i];
      }
    }
  }
  for (let i = 2; i < n; i++) for (let j = 0; j < i - 1; j++) H[i][j] = 0;   // restos dos refletores
  return V;
}

// QR de Francis com deslocamento duplo (EISPACK hqr2, parte da forma de Schur). H (Hessenberg) vira a forma
// de Schur real T e V acumula Z. Devolve autovalores {d, e} (partes real e imaginária) por posição.
function schurReal(H, V, n) {
  const d = new Array(n).fill(0), e = new Array(n).fill(0);
  let norm = 0;
  for (let i = 0; i < n; i++) for (let j = Math.max(i - 1, 0); j < n; j++) norm += Math.abs(H[i][j]);
  let nn = n - 1, exshift = 0, iter = 0;
  let p = 0, q = 0, r = 0, s = 0, z = 0, t, w, x, y;
  while (nn >= 0) {
    let l = nn;
    while (l > 0) {
      s = Math.abs(H[l - 1][l - 1]) + Math.abs(H[l][l]);
      if (s === 0) s = norm;
      if (Math.abs(H[l][l - 1]) <= EPS * s) break;
      l--;
    }
    if (l === nn) {                                   // uma raiz
      H[nn][nn] += exshift; d[nn] = H[nn][nn]; e[nn] = 0;
      if (nn > 0) H[nn][nn - 1] = 0;
      nn--; iter = 0;
    } else if (l === nn - 1) {                        // duas raízes
      w = H[nn][nn - 1] * H[nn - 1][nn];
      p = (H[nn - 1][nn - 1] - H[nn][nn]) / 2;
      q = p * p + w;
      z = Math.sqrt(Math.abs(q));
      H[nn][nn] += exshift;
      H[nn - 1][nn - 1] += exshift;
      x = H[nn][nn];
      if (q >= 0) {                                   // par real: triangulariza por rotação
        z = p >= 0 ? p + z : p - z;
        d[nn - 1] = x + z;
        d[nn] = d[nn - 1];
        if (z !== 0) d[nn] = x - w / z;
        e[nn - 1] = 0; e[nn] = 0;
        x = H[nn][nn - 1];
        s = Math.abs(x) + Math.abs(z);
        p = x / s; q = z / s;
        r = Math.sqrt(p * p + q * q);
        p /= r; q /= r;
        for (let j = nn - 1; j < n; j++) { z = H[nn - 1][j]; H[nn - 1][j] = q * z + p * H[nn][j]; H[nn][j] = q * H[nn][j] - p * z; }
        for (let i = 0; i <= nn; i++) { z = H[i][nn - 1]; H[i][nn - 1] = q * z + p * H[i][nn]; H[i][nn] = q * H[i][nn] - p * z; }
        for (let i = 0; i < n; i++) { z = V[i][nn - 1]; V[i][nn - 1] = q * z + p * V[i][nn]; V[i][nn] = q * V[i][nn] - p * z; }
        H[nn][nn - 1] = 0;
      } else {                                        // par complexo conjugado
        d[nn - 1] = x + p; d[nn] = x + p; e[nn - 1] = z; e[nn] = -z;
      }
      if (nn > 1) H[nn - 1][nn - 2] = 0;
      nn -= 2; iter = 0;
    } else {                                          // sem convergência: passo QR duplo
      x = H[nn][nn]; y = 0; w = 0;
      if (l < nn) { y = H[nn - 1][nn - 1]; w = H[nn][nn - 1] * H[nn - 1][nn]; }
      if (iter === 10) {                              // deslocamento excepcional (Wilkinson)
        exshift += x;
        for (let i = 0; i <= nn; i++) H[i][i] -= x;
        s = Math.abs(H[nn][nn - 1]) + Math.abs(H[nn - 1][nn - 2]);
        x = y = 0.75 * s;
        w = -0.4375 * s * s;
      }
      if (iter === 30) {                              // deslocamento excepcional (MATLAB)
        s = (y - x) / 2;
        s = s * s + w;
        if (s > 0) {
          s = Math.sqrt(s);
          if (y < x) s = -s;
          s = x - w / ((y - x) / 2 + s);
          for (let i = 0; i <= nn; i++) H[i][i] -= s;
          exshift += s;
          x = y = w = 0.964;
        }
      }
      if (++iter > MAX_ITER) throw new RangeError('eig: QR não convergiu');
      let m = nn - 2;
      while (m >= l) {
        z = H[m][m];
        r = x - z; s = y - z;
        p = (r * s - w) / H[m + 1][m] + H[m][m + 1];
        q = H[m + 1][m + 1] - z - r - s;
        r = H[m + 2][m + 1];
        s = Math.abs(p) + Math.abs(q) + Math.abs(r);
        p /= s; q /= s; r /= s;
        if (m === l) break;
        if (Math.abs(H[m][m - 1]) * (Math.abs(q) + Math.abs(r)) <
            EPS * (Math.abs(p) * (Math.abs(H[m - 1][m - 1]) + Math.abs(z) + Math.abs(H[m + 1][m + 1])))) break;
        m--;
      }
      for (let i = m + 2; i <= nn; i++) { H[i][i - 2] = 0; if (i > m + 2) H[i][i - 3] = 0; }
      for (let k = m; k <= nn - 1; k++) {
        const notlast = k !== nn - 1;
        if (k !== m) {
          p = H[k][k - 1]; q = H[k + 1][k - 1]; r = notlast ? H[k + 2][k - 1] : 0;
          x = Math.abs(p) + Math.abs(q) + Math.abs(r);
          if (x === 0) continue;
          p /= x; q /= x; r /= x;
        }
        s = Math.sqrt(p * p + q * q + r * r);
        if (p < 0) s = -s;
        if (s !== 0) {
          if (k !== m) H[k][k - 1] = -s * x;
          else if (l !== m) H[k][k - 1] = -H[k][k - 1];
          p += s; x = p / s; y = q / s; z = r / s; q /= p; r /= p;
          for (let j = k; j < n; j++) {
            t = H[k][j] + q * H[k + 1][j];
            if (notlast) { t += r * H[k + 2][j]; H[k + 2][j] -= t * z; }
            H[k][j] -= t * x; H[k + 1][j] -= t * y;
          }
          for (let i = 0; i <= Math.min(nn, k + 3); i++) {
            t = x * H[i][k] + y * H[i][k + 1];
            if (notlast) { t += z * H[i][k + 2]; H[i][k + 2] -= t * r; }
            H[i][k] -= t; H[i][k + 1] -= t * q;
          }
          for (let i = 0; i < n; i++) {
            t = x * V[i][k] + y * V[i][k + 1];
            if (notlast) { t += z * V[i][k + 2]; V[i][k + 2] -= t * r; }
            V[i][k] -= t; V[i][k + 1] -= t * q;
          }
        }
      }
    }
  }
  return { d, e };
}

/* ------------------------- autovetores (Schur complexa) ------------------------- */

function autovetoresDeSchur(T, Z, d, e, n) {
  // Tc, Zc complexas como pares de matrizes reais
  const tr = copia(T), ti = T.map((r) => r.map(() => 0));
  const zr = copia(Z), zi = Z.map((r) => r.map(() => 0));
  for (let k = 0; k < n - 1; k++) {
    if (!(e[k] > 0 && e[k + 1] < 0)) continue;       // bloco 2×2 de par complexo em (k, k+1)
    const a = T[k][k], b = T[k][k + 1], c = T[k + 1][k], dd = T[k + 1][k + 1];
    const mu = (a + dd) / 2, om = Math.sqrt(Math.max(0, -(((a - dd) / 2) ** 2 + b * c)));
    // v = autovetor de [[a,b],[c,dd]] para λ = mu + i·om:  (λ − a, c) ou (b, λ − dd)
    let v1r, v1i, v2r, v2i;
    if (Math.abs(b) >= Math.abs(c)) { v1r = b; v1i = 0; v2r = mu - a; v2i = om; }
    else { v1r = mu - dd; v1i = om; v2r = c; v2i = 0; }
    const nv = Math.hypot(v1r, v1i, v2r, v2i);
    v1r /= nv; v1i /= nv; v2r /= nv; v2i /= nv;
    // U = [v, w], w = (−conj(v2), conj(v1)); colunas k, k+1
    const u11r = v1r, u11i = v1i, u21r = v2r, u21i = v2i;
    const u12r = -v2r, u12i = v2i, u22r = v1r, u22i = -v1i;
    for (let j = 0; j < n; j++) {                     // linhas: Tc ← Uᴴ Tc
      const ar = tr[k][j], ai = ti[k][j], br = tr[k + 1][j], bi = ti[k + 1][j];
      tr[k][j] = u11r * ar + u11i * ai + u21r * br + u21i * bi;
      ti[k][j] = u11r * ai - u11i * ar + u21r * bi - u21i * br;
      tr[k + 1][j] = u12r * ar + u12i * ai + u22r * br + u22i * bi;
      ti[k + 1][j] = u12r * ai - u12i * ar + u22r * bi - u22i * br;
    }
    for (let i = 0; i < n; i++) {                     // colunas: Tc ← Tc U e Zc ← Zc U
      for (const [Mr, Mi] of [[tr, ti], [zr, zi]]) {
        const ar = Mr[i][k], ai = Mi[i][k], br = Mr[i][k + 1], bi = Mi[i][k + 1];
        Mr[i][k] = ar * u11r - ai * u11i + br * u21r - bi * u21i;
        Mi[i][k] = ar * u11i + ai * u11r + br * u21i + bi * u21r;
        Mr[i][k + 1] = ar * u12r - ai * u12i + br * u22r - bi * u22i;
        Mi[i][k + 1] = ar * u12i + ai * u12r + br * u22i + bi * u22r;
      }
    }
    tr[k + 1][k] = 0; ti[k + 1][k] = 0;
    tr[k][k] = mu; ti[k][k] = om; tr[k + 1][k + 1] = mu; ti[k + 1][k + 1] = -om;
  }
  let tnorm = 0;
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) tnorm = Math.max(tnorm, Math.hypot(tr[i][j], ti[i][j]));
  const pequeno = Math.max(EPS * tnorm, Number.MIN_VALUE * 1e10);
  // substituição regressiva: (T − λₖI)·x = 0 com x[k] = 1; X triangular superior complexa
  const xr = Array.from({ length: n }, () => new Array(n).fill(0));
  const xi = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let k = 0; k < n; k++) {
    const lr = tr[k][k], li = ti[k][k];
    xr[k][k] = 1;
    for (let i = k - 1; i >= 0; i--) {
      let sr = 0, si = 0;
      for (let j = i + 1; j <= k; j++) {
        sr += tr[i][j] * xr[j][k] - ti[i][j] * xi[j][k];
        si += tr[i][j] * xi[j][k] + ti[i][j] * xr[j][k];
      }
      let dr = tr[i][i] - lr, di = ti[i][i] - li;
      if (Math.hypot(dr, di) < pequeno) { dr = pequeno; di = 0; }
      const den = dr * dr + di * di;
      xr[i][k] = -(sr * dr + si * di) / den;
      xi[i][k] = -(si * dr - sr * di) / den;
    }
  }
  // V = Zc · X
  const vr = Array.from({ length: n }, () => new Array(n).fill(0));
  const vi = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    let sr = 0, si = 0;
    for (let j = 0; j <= k; j++) {
      sr += zr[i][j] * xr[j][k] - zi[i][j] * xi[j][k];
      si += zr[i][j] * xi[j][k] + zi[i][j] * xr[j][k];
    }
    vr[i][k] = sr; vi[i][k] = si;
  }
  return { vr, vi };
}

// Norma-2 unitária e componente de maior módulo real positiva; imag = 0 se o autovalor é real.
function normaliza(vr, vi, n, k, real) {
  let nrm = 0, pmax = 0, mmax = -1;
  for (let i = 0; i < n; i++) {
    const m = Math.hypot(vr[i][k], vi[i][k]);
    nrm += m * m;
    if (m > mmax) { mmax = m; pmax = i; }
  }
  nrm = Math.sqrt(nrm);
  const cr = vr[pmax][k] / mmax, ci = -vi[pmax][k] / mmax;   // conj(v_p)/|v_p|
  for (let i = 0; i < n; i++) {
    const a = vr[i][k], b = vi[i][k];
    vr[i][k] = (a * cr - b * ci) / nrm;
    vi[i][k] = real ? 0 : (a * ci + b * cr) / nrm;
  }
}

/* ------------------------- API ------------------------- */

function simetrica(A, n) {
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (A[i][j] !== A[j][i]) return false;
  return true;
}

function nucleo(A, n, comVetores) {
  if (n === 0) return { values: [], vectors: [] };
  if (n === 1) return { values: [[A[0][0], 0]], vectors: [[[1, 0]]] };
  const sim = simetrica(A, n);
  const { B, d: escala } = sim ? { B: copia(A), d: new Array(n).fill(1) } : balanceia(A, n);
  const H = B;
  const Z = hessenberg(H, n);
  const { d, e } = schurReal(H, Z, n);
  const values = d.map((re, i) => [re, e[i]]);

  if (sim) {                                          // caminho simétrico: T diagonal, V = Z, ordem crescente
    const idx = d.map((_, i) => i).sort((i, j) => d[i] - d[j]);
    const vals = idx.map((i) => [d[i], 0]);
    if (!comVetores) return { values: vals };
    const vr = Array.from({ length: n }, (_, i) => idx.map((c) => Z[i][c]));
    const vi = vr.map((r) => r.map(() => 0));
    for (let k = 0; k < n; k++) normaliza(vr, vi, n, k, true);
    return { values: vals, vectors: vr.map((r, i) => r.map((v, k) => [v, vi[i][k]])) };
  }
  if (!comVetores) return { values };

  const { vr, vi } = autovetoresDeSchur(H, Z, d, e, n);
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { vr[i][k] *= escala[i]; vi[i][k] *= escala[i]; }
  for (let k = 0; k < n; k++) {
    if (e[k] < 0 && k > 0 && e[k - 1] > 0) continue;   // segundo do par: conjugado exato do primeiro
    normaliza(vr, vi, n, k, e[k] === 0);
    if (e[k] > 0 && k + 1 < n && e[k + 1] < 0) {
      for (let i = 0; i < n; i++) { vr[i][k + 1] = vr[i][k]; vi[i][k + 1] = -vi[i][k]; }
    }
  }
  return { values, vectors: vr.map((r, i) => r.map((v, k) => [v, vi[i][k]])) };
}

/**
 * Autovalores de A (real, quadrada), na ordem das posições da forma de Schur (simétrica: crescente).
 * @param {number[][]} A @returns {number[][]} lista de [re, im]
 */
export function eigvals(A) {
  const n = validaQuadrada(A);
  return nucleo(A, n, false).values;
}

/**
 * Autovalores e autovetores de A (real, quadrada): A·V = V·diag(values).
 * @param {number[][]} A
 * @returns {{values:number[][], vectors:number[][][]}} values[k] = [re, im]; vectors[i][k] = [re, im]
 */
export function eig(A) {
  const n = validaQuadrada(A);
  return nucleo(A, n, true);
}
