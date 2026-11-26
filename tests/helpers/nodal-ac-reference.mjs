// Frozen pre-migration complex Gaussian elimination, independent of cmatrix and the AC model.
export function solveComplexSystem(matrix, rhs, singularRelTol = 1e-12) {
  const n = rhs.length;
  const A = matrix.map((row, i) => [...row.map(z => ({ ...z })), { ...rhs[i] }]);
  let scale = 0;
  for (const row of matrix) for (const z of row) scale = Math.max(scale, Math.hypot(z.re, z.im));
  const tolerance = singularRelTol * scale;
  const div = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  };
  const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const sub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let best = Math.hypot(A[col][col].re, A[col][col].im);
    for (let row = col + 1; row < n; row++) {
      const v = Math.hypot(A[row][col].re, A[row][col].im);
      if (v > best) { best = v; pivotRow = row; }
    }
    if (!(best > tolerance)) {
      const error = new Error('SINGULAR_SYSTEM'); error.code = 'SINGULAR_SYSTEM'; throw error;
    }
    if (pivotRow !== col) [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = div(A[row][col], A[col][col]);
      if (factor.re === 0 && factor.im === 0) continue;
      for (let j = col; j <= n; j++) A[row][j] = sub(A[row][j], mul(factor, A[col][j]));
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = A[i][n];
    for (let j = i + 1; j < n; j++) sum = sub(sum, mul(A[i][j], x[j]));
    x[i] = div(sum, A[i][i]);
  }
  return x;
}
