/** Octave-style rounding for real/complex scalars, vectors and matrices. */
function apply(value, fn) {
  if (typeof value === 'number') return fn(value);
  if (Array.isArray(value) || value instanceof Float64Array) return Array.from(value, item => apply(item, fn));
  if (value !== null && typeof value === 'object' && typeof value.re === 'number' && typeof value.im === 'number') return {re:fn(value.re),im:fn(value.im)};
  throw new TypeError('Expected a real or complex number, or an array of numbers.');
}
/** Round to nearest integer, with halfway values away from zero. */
export function round(value) { return apply(value, x => x < 0 || Object.is(x,-0) ? -Math.round(-x) : Math.round(x)); }
/** Round toward negative infinity. */
export function floor(value) { return apply(value, Math.floor); }
/** Round toward positive infinity. */
export function ceil(value) { return apply(value, Math.ceil); }
/** Round toward zero. */
export function fix(value) { return apply(value, Math.trunc); }
