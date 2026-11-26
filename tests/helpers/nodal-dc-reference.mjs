// Frozen pre-migration Gaussian elimination for independent compatibility checks.
export function solveLinearSystem(matrix, rhs, singularPivotTol = 1e-12) {
  const n = rhs.length;
  const A = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col]);
      if (val > maxVal) { maxVal = val; pivotRow = row; }
    }
    if (maxVal <= singularPivotTol) {
      const error = new Error('SINGULAR_SYSTEM: Circuit matrix is singular');
      error.code = 'SINGULAR_SYSTEM';
      throw error;
    }
    if (pivotRow !== col) [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
    const pivot = A[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / pivot;
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) A[row][j] -= factor * A[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = A[i][n];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }
  return x;
}
