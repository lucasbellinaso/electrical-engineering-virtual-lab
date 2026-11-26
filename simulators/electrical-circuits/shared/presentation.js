/** Presentation only: localized numbers and trusted inline LaTeX, no model state. */
export function traceLatex(topology, key) {
  if (key === 'source') return topology === 'parallel' ? 'I_s' : 'V_s';
  return {vc:'v_C',vR:'v_R',vL:'v_L',il:'i_L',iR:'i_R',iC:'i_C'}[key];
}

export function numberLatex(value, locale, digits = 5) {
  if (!Number.isFinite(value)) throw new RangeError('A finite presentation value is required.');
  const scientific = value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e6);
  const parts = new Intl.NumberFormat(locale, {maximumSignificantDigits: digits, notation: scientific ? 'scientific' : 'standard'}).formatToParts(Object.is(value,-0) ? 0 : value);
  let exponent = false;
  const latex = parts.map(part => {
    if (part.type === 'group') return '\\,';
    if (part.type === 'decimal') return part.value === ',' ? '{,}' : '.';
    if (part.type === 'exponentSeparator') { exponent = true; return '\\times10^{'; }
    if (part.type === 'minusSign' || part.type === 'exponentMinusSign') return '-';
    return part.value;
  }).join('');
  return latex + (exponent ? '}' : '');
}

/** Delimiters belong to bundled translations, never to numerical input or code. */
export function proseParts(value) {
  const parts = []; let offset = 0;
  for (const match of value.matchAll(/\\\(([\s\S]*?)\\\)/g)) {
    if (match.index > offset) parts.push({text: value.slice(offset, match.index)});
    parts.push({latex: match[1]}); offset = match.index + match[0].length;
  }
  if (offset < value.length) parts.push({text: value.slice(offset)});
  return parts;
}
