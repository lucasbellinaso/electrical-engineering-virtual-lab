/**
 * Uniform balanced transmission line, sinusoidal steady state, per-phase RMS.
 * UI units: km, Hz, ohm/km, mH/km, nF/km, kV line-to-line, MVA three-phase.
 * G'=0. Coordinates x=0 at sending end, x=lengthKm at receiving end.
 * Both currents point from source to load; S=3 V conj(I). No transient model.
 * Uses the shared complex core; sinhc is currently an auxiliary unstable API.
 */
import * as c from '../../../assets/js/core/complex.js';
import {cmmul} from '../../../assets/js/core/cmatrix.js';
import {linspace, trapz} from '../../../assets/js/core/numeric.js';

export const bounds = Object.freeze({
  lengthKm: [0, 1000], frequencyHz: [40, 70], resistanceOhmKm: [0, 1],
  inductanceMhKm: [.1, 5], capacitanceNfKm: [1, 50], voltageKv: [1, 1000],
  apparentMva: [0, 3000], powerFactor: [.1, 1]
});
export const defaults = Object.freeze({
  lengthKm: 400, frequencyHz: 60, resistanceOhmKm: .0256,
  inductanceMhKm: .3027 / (2 * Math.PI * 60) * 1000,
  capacitanceNfKm: 14.25, voltageKv: 500, apparentMva: 600,
  powerFactor: .9, loadType: 'inductive', mode: 'receiving'
});
export const presets = Object.freeze({
  lesson: {...defaults},
  ferranti: {...defaults, mode: 'sending-open', apparentMva: 0},
  capacitive: {...defaults, loadType: 'capacitive'},
  long: {...defaults, lengthKm: 800}
});
const one = () => c.make(1);
function fail(code) { const error = new RangeError(code); error.code = code; throw error; }
export function validate(input) {
  if (!input || typeof input !== 'object') fail('invalid');
  const p = {};
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('invalid');
    p[key] = value;
  }
  if (!['inductive', 'capacitive'].includes(input.loadType) || !['receiving', 'sending-open'].includes(input.mode)) fail('invalid');
  p.loadType = input.loadType; p.mode = input.mode;
  if (p.mode === 'sending-open' && p.apparentMva !== 0) fail('openLoad');
  return p;
}
function coefficients(z, y, gamma, distance) {
  const u = c.scale(gamma, distance), h = c.sinhc(u);
  const A = c.cosh(u), B = c.mul(c.scale(z, distance), h), C = c.mul(c.scale(y, distance), h);
  return {A, B, C, D: {...A}};
}
export function lineParameters(input) {
  const p = validate(input), omega = 2 * Math.PI * p.frequencyHz;
  const z = c.make(p.resistanceOhmKm, omega * p.inductanceMhKm * 1e-3);
  const y = c.make(0, omega * p.capacitanceNfKm * 1e-9);
  const gamma = c.sqrt(c.mul(z, y)), zc = c.div(z, gamma);
  const exact = coefficients(z, y, gamma, p.lengthKm);
  const Z = c.scale(z, p.lengthKm), Y = c.scale(y, p.lengthKm);
  const A = c.add(one(), c.scale(c.mul(Z, Y), .5));
  const nominal = {A, B: Z, C: c.mul(Y, c.add(one(), c.scale(c.mul(Z, Y), .25))), D: {...A}};
  const halfU = c.scale(gamma, p.lengthKm / 2), halfCosh = c.cosh(halfU);
  // This exact symmetric pi cannot represent a half-wave resonance with finite shunts.
  const pi = c.abs(halfCosh) < 1e-10 ? null : {
    series: exact.B,
    shunt: c.div(c.mul(c.scale(y, p.lengthKm / 2), c.sinhc(halfU)), halfCosh)
  };
  return {p, z, y, gamma, zc, exact, nominal, pi};
}
function terminal(m, vr, ir) {
  const out = cmmul([[m.A, m.B], [m.C, m.D]], [[vr], [ir]]);
  return {vs: out[0][0], is: out[1][0]};
}
export function solve(input = defaults) {
  const line = lineParameters(input), {p, exact, nominal} = line;
  const fixedV = c.make(p.voltageKv * 1000 / Math.sqrt(3));
  let vr, ir, vs, is, comparison;
  if (p.mode === 'sending-open') {
    if (c.abs(exact.A) < 1e-10 || c.abs(nominal.A) < 1e-10) fail('resonance');
    vs = fixedV; vr = c.div(vs, exact.A); ir = c.make();
    is = c.mul(exact.C, vr);
    const nominalVr = c.div(vs, nominal.A);
    comparison = {vr: nominalVr, ir: c.make(), vs, is: c.mul(nominal.C, nominalVr)};
  } else {
    vr = fixedV;
    const s = c.fromPolar(p.apparentMva * 1e6, (p.loadType === 'inductive' ? 1 : -1) * Math.acos(p.powerFactor));
    ir = c.conj(c.div(s, c.scale(vr, 3)));
    ({vs, is} = terminal(exact, vr, ir));
    comparison = {vr, ir, ...terminal(nominal, vr, ir)};
  }
  const samples = linspace(0, p.lengthKm, 401).map(x => {
    const v = terminal(coefficients(line.z, line.y, line.gamma, p.lengthKm - x), vr, ir);
    return {x, voltage: v.vs, current: v.is};
  });
  const receivingPower = c.scale(c.mul(vr, c.conj(ir)), 3);
  const sendingPower = c.scale(c.mul(vs, c.conj(is)), 3);
  const losses = sendingPower.re - receivingPower.re;
  const integratedLosses = 3 * p.resistanceOhmKm * trapz(samples.map(s => s.x), samples.map(s => c.abs(s.current) ** 2));
  const determinant = c.sub(c.mul(exact.A, exact.D), c.mul(exact.B, exact.C));
  const target = p.mode === 'sending-open' ? 'vr' : 'vs';
  const ref = target === 'vr' ? vr : vs;
  const errorPercent = 100 * c.abs(c.sub(comparison[target], ref)) / c.abs(ref);
  return {...line, vr, ir, vs, is, comparison, samples, sendingPower, receivingPower,
    losses, integratedLosses, determinantResidual: c.abs(c.sub(determinant, one())), errorPercent,
    contributions: {av: c.mul(exact.A, vr), bi: c.mul(exact.B, ir), cv: c.mul(exact.C, vr), di: c.mul(exact.D, ir)}};
}
