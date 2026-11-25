/** Pure LaTeX builders for the phasor nodal-analysis system (no DOM, testable with KaTeX in Node). */

function trimNumber(n, digits = 4) {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1e-12) return '0';
  if (abs >= 1e5 || abs < 1e-3) {
    const [mantissa, exponent] = n.toExponential(3).split('e');
    return `${Number(mantissa)}\\times10^{${Number(exponent)}}`;
  }
  return Number(n.toFixed(digits)).toString();
}

/** Rectangular complex number: a + bj (j = √−1). */
export function latexComplex(z) {
  const re = Math.abs(z.re) < 1e-12 * Math.max(1, Math.abs(z.im)) ? 0 : z.re;
  const im = Math.abs(z.im) < 1e-12 * Math.max(1, Math.abs(z.re)) ? 0 : z.im;
  if (re === 0 && im === 0) return '0';
  if (im === 0) return trimNumber(re);
  const imag = `${trimNumber(Math.abs(im))}j`;
  if (re === 0) return im < 0 ? `-${imag}` : imag;
  return `${trimNumber(re)} ${im < 0 ? '-' : '+'} ${imag}`;
}

/** "R1" → R_{1}; ids that do not follow letters+digits fall back to \mathrm. */
export function idLatex(id) {
  const parts = /^([A-Za-z]+)(\d+)$/.exec(id);
  return parts ? `${parts[1]}_{${parts[2]}}` : `\\mathrm{${id.replace(/[^A-Za-z0-9]/g, '') || 'x'}}`;
}

/** Phasor symbol: plain letter with subscript ("I1" -> I_{1}); no overdot (time derivative) and no bar. */
export function phasorLatex(id) {
  return idLatex(id);
}

function termLatex(t) {
  switch (t.kind) {
    case 'invR': return `\\frac{1}{${idLatex(t.id)}}`;
    case 'invL': return `\\frac{1}{j\\omega ${idLatex(t.id)}}`;
    case 'capC': return `j\\omega ${idLatex(t.id)}`;
    case 'unit': return '1';
    default: return phasorLatex(t.id);
  }
}

export function sumLatex(list) {
  if (!list.length) return '0';
  return list.map((t, i) => `${t.sign < 0 ? '-' : i ? '+' : ''}${termLatex(t)}`).join('');
}

const matrix = rows => `\\begin{bmatrix}${rows.map(row => row.join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
const column = items => `\\begin{bmatrix}${items.join(' \\\\ ')}\\end{bmatrix}`;

export function unknownsLatex(nodeCount, voltageSourceIds) {
  const names = [];
  for (let k = 1; k <= nodeCount; k++) names.push(`V_{${k}}`);
  for (const id of voltageSourceIds) names.push(`I_{${idLatex(id)}}`);
  return column(names);
}

/** Top block: the system written with the circuit elements. */
export function symbolicSystemLatex(sc) {
  return `{\\small ${matrix(sc.A.map(row => row.map(sumLatex)))} ${unknownsLatex(sc.nodeCount, sc.voltageSourceIds)} = ${column(sc.b.map(sumLatex))}}`;
}

/** Bottom block: the same system with numbers and its solution. */
export function numericSystemLatex(solution, voltageSourceIds) {
  const m = solution.matrix;
  const vec = unknownsLatex(solution.nodeCount, voltageSourceIds);
  return `{\\small ${matrix(m.A.map(row => row.map(latexComplex)))} ${vec} = ${column(m.b.map(latexComplex))} \\implies ${vec} = ${column(m.solution.map(latexComplex))}}`;
}

/** One KCL equation per node row, with numeric complex coefficients. */
export function kclRowsLatex(solution, voltageSourceIds) {
  const m = solution.matrix;
  const n = solution.nodeCount;
  const rows = [];
  for (let r = 0; r < n; r++) {
    const terms = [];
    for (let c = 0; c < m.solution.length; c++) {
      const coeff = m.A[r][c];
      if (Math.hypot(coeff.re, coeff.im) < 1e-15) continue;
      const unknown = c < n ? `V_{${c + 1}}` : `I_{${idLatex(voltageSourceIds[c - n])}}`;
      terms.push(`(${latexComplex(coeff)})\\,${unknown}`);
    }
    rows.push(`${r + 1}:\\quad ${terms.length ? terms.join(' + ') : '0'} = ${latexComplex(m.b[r])}`);
  }
  return rows;
}
