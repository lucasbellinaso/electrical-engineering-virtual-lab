/**
 * EEVL · Nodal analysis in sinusoidal steady state (phasors) · model v1.0.0
 *
 * Linear circuit with resistors (R), inductors (L), capacitors (C), independent current sources (I)
 * and independent voltage sources (V), all at ONE angular frequency ω = 2πf.
 *
 * Public units (documented, converted to SI inside this module):
 *   R in Ω · L in mH · C in µF · I in A (peak) · V in V (peak) · phase in degrees · f in Hz.
 * Phasors use the PEAK (amplitude) convention: x(t) = Re{ X·e^{jωt} }, X = |X|∠φ.
 * Complex power absorbed by a two-terminal element: S = ½·ΔV·conj(I) (ΔV = V_from − V_to,
 * I flowing From → To), so P = Re S in W and Q = Im S in var.
 *
 * Element admittances: R → 1/R · L → 1/(jωL) · C → jωC.
 * Modified Nodal Analysis (complex):  [ Y  B ] [ v  ]   [ i ]
 *                                     [ Bᵀ 0 ] [ iV ] = [ e ]
 * The linear system is solved with Gaussian elimination with partial pivoting in IEEE-754 double
 * precision. A pivot below 1e-12 × max|A| is reported as singular (voltage-source loops, nodes held
 * only by current sources, etc.).
 *
 * This module is DOM-free and has no side effects.
 */
import { csolve } from '../../../assets/js/core/cmatrix.js';
import * as complex from '../../../assets/js/core/complex.js';

export const LIMITS = Object.freeze({
  minNodes: 2,
  maxNodes: 5,
  maxComponents: 24,
  minResistance: 1e-3,        // Ω
  maxResistance: 1e9,
  minInductance: 1e-3,        // mH
  maxInductance: 1e6,
  minCapacitance: 1e-3,       // µF
  maxCapacitance: 1e6,
  maxCurrent: 1e4,            // A peak
  maxVoltage: 1e4,            // V peak
  minFrequency: 1e-3,         // Hz
  maxFrequency: 1e9,
  singularRelTol: 1e-12
});

export const TYPES = Object.freeze(['R', 'L', 'C', 'I', 'V']);

/* ------------------------------------------------------------------ complex helpers */
export const cx = Object.freeze({
  make: complex.make, add: complex.add, sub: complex.sub, mul: complex.mul,
  div: complex.div, conj: complex.conj, scale: complex.scale, abs: complex.abs,
  fromPolar: complex.fromPolarDeg
});

/** Magnitude and phase in degrees (phase 0 for an exactly zero phasor). */
export function polar(z) {
  const mag = Math.hypot(z.re, z.im);
  return { mag, phase: mag === 0 ? 0 : (Math.atan2(z.im, z.re) * 180) / Math.PI };
}

/* ------------------------------------------------------------------ examples */
// Frequencies are chosen so that hand calculation is easy (see docs/validation/nodal-analysis-ac.md).
export const PRESETS = Object.freeze([
  {
    id: 'rc-lowpass',
    nodeCount: 2,
    frequency: 1000,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 10, phase: 0 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 1000, phase: 0 },
      { id: 'C1', type: 'C', from: 2, to: 0, value: 0.15915494309189535, phase: 0 }
    ]
  },
  {
    id: 'rl-highpass',
    nodeCount: 2,
    frequency: 1000,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 10, phase: 0 },
      { id: 'L1', type: 'L', from: 1, to: 2, value: 159.15494309189535, phase: 0 },
      { id: 'R1', type: 'R', from: 2, to: 0, value: 1000, phase: 0 }
    ]
  },
  {
    id: 'series-resonance',
    nodeCount: 3,
    frequency: 1000,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 10, phase: 0 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 10, phase: 0 },
      { id: 'L1', type: 'L', from: 2, to: 3, value: 10, phase: 0 },
      { id: 'C1', type: 'C', from: 3, to: 0, value: 2.5330295910584444, phase: 0 }
    ]
  },
  {
    id: 'parallel-resonance',
    nodeCount: 2,
    frequency: 1000,
    components: [
      { id: 'I1', type: 'I', from: 0, to: 1, value: 0.01, phase: 0 },
      { id: 'R1', type: 'R', from: 1, to: 0, value: 1000, phase: 0 },
      { id: 'L1', type: 'L', from: 1, to: 0, value: 10, phase: 0 },
      { id: 'C1', type: 'C', from: 1, to: 0, value: 2.5330295910584444, phase: 0 },
      { id: 'R2', type: 'R', from: 2, to: 0, value: 500, phase: 0 },
      { id: 'R3', type: 'R', from: 1, to: 2, value: 1000, phase: 0 }
    ]
  },
  {
    id: 'rc-two-stage',
    nodeCount: 3,
    frequency: 1000,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 5, phase: 0 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 1000, phase: 0 },
      { id: 'C1', type: 'C', from: 2, to: 0, value: 0.1, phase: 0 },
      { id: 'R2', type: 'R', from: 2, to: 3, value: 1000, phase: 0 },
      { id: 'C2', type: 'C', from: 3, to: 0, value: 0.1, phase: 0 }
    ]
  },
  {
    id: 'two-sources-phase',
    nodeCount: 3,
    frequency: 60,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 120, phase: 0 },
      { id: 'V2', type: 'V', from: 3, to: 0, value: 120, phase: -30 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 10, phase: 0 },
      { id: 'L1', type: 'L', from: 2, to: 0, value: 26.5, phase: 0 },
      { id: 'R2', type: 'R', from: 3, to: 2, value: 10, phase: 0 }
    ]
  }
]);

export const defaults = structuredClone(PRESETS[0]);

/* ------------------------------------------------------------------ validation */
function modelError(code, detail = '') {
  const err = new Error(detail ? `${code}: ${detail}` : code);
  err.code = code;
  err.detail = detail;
  return err;
}

/**
 * @param {{nodeCount:number, frequency:number, components:Array<{id?:string,type:string,from:number,to:number,value:number,phase?:number}>}} circuit
 * @returns {{nodeCount:number, frequency:number, components:Array}} normalized circuit
 */
export function validateCircuit(circuit) {
  if (!circuit || typeof circuit !== 'object') throw modelError('INVALID_CIRCUIT');
  const { nodeCount, frequency, components } = circuit;
  if (!Number.isInteger(nodeCount) || nodeCount < LIMITS.minNodes || nodeCount > LIMITS.maxNodes) {
    throw modelError('INVALID_NODE_COUNT');
  }
  if (typeof frequency !== 'number' || !Number.isFinite(frequency)
    || frequency < LIMITS.minFrequency || frequency > LIMITS.maxFrequency) {
    throw modelError('INVALID_FREQUENCY');
  }
  if (!Array.isArray(components) || components.length === 0 || components.length > LIMITS.maxComponents) {
    throw modelError('INVALID_COMPONENT_COUNT');
  }
  const normalized = components.map((comp, index) => {
    if (!comp || typeof comp !== 'object') throw modelError('INVALID_COMPONENT', `#${index + 1}`);
    const { type, from, to, value } = comp;
    if (!TYPES.includes(type)) throw modelError('INVALID_TYPE', `#${index + 1}`);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > nodeCount || to < 0 || to > nodeCount) {
      throw modelError('INVALID_NODE', `#${index + 1}`);
    }
    if (from === to) throw modelError('SELF_LOOP', `#${index + 1}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw modelError('NON_FINITE_VALUE', `#${index + 1}`);
    const inRange = (low, high) => value >= low && value <= high;
    if (type === 'R' && !inRange(LIMITS.minResistance, LIMITS.maxResistance)) throw modelError('RESISTANCE_RANGE', `#${index + 1}`);
    if (type === 'L' && !inRange(LIMITS.minInductance, LIMITS.maxInductance)) throw modelError('INDUCTANCE_RANGE', `#${index + 1}`);
    if (type === 'C' && !inRange(LIMITS.minCapacitance, LIMITS.maxCapacitance)) throw modelError('CAPACITANCE_RANGE', `#${index + 1}`);
    if (type === 'I' && Math.abs(value) > LIMITS.maxCurrent) throw modelError('CURRENT_RANGE', `#${index + 1}`);
    if (type === 'V' && Math.abs(value) > LIMITS.maxVoltage) throw modelError('VOLTAGE_RANGE', `#${index + 1}`);
    const rawPhase = comp.phase ?? 0;
    if (typeof rawPhase !== 'number' || !Number.isFinite(rawPhase) || Math.abs(rawPhase) > 360) {
      throw modelError('INVALID_PHASE', `#${index + 1}`);
    }
    const id = typeof comp.id === 'string' && comp.id.trim() ? comp.id.trim() : `${type}${index + 1}`;
    return { id, type, from, to, value, phase: type === 'I' || type === 'V' ? rawPhase : 0 };
  });

  // Every node needs a path to ground through elements that are not current sources.
  const adjacency = Array.from({ length: nodeCount + 1 }, () => []);
  for (const c of normalized) {
    if (c.type === 'I') continue;
    adjacency[c.from].push(c.to);
    adjacency[c.to].push(c.from);
  }
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    for (const next of adjacency[queue.shift()]) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  for (let node = 1; node <= nodeCount; node++) {
    if (!seen.has(node)) throw modelError('DISCONNECTED_NODE', `node ${node}`);
  }
  return { nodeCount, frequency, components: normalized };
}

/* ------------------------------------------------------------------ element helpers */
export const omegaOf = frequency => 2 * Math.PI * frequency;

/** Admittance of an R, L or C element in siemens. */
export function admittance(comp, omega) {
  switch (comp.type) {
    case 'R': return { re: 1 / comp.value, im: 0 };
    case 'L': return { re: 0, im: -1 / (omega * comp.value * 1e-3) };   // 1/(jωL) = −j/(ωL)
    case 'C': return { re: 0, im: omega * comp.value * 1e-6 };          // jωC
    default: throw modelError('INVALID_TYPE');
  }
}

/** Source phasor (peak) of an I or V element. */
export const sourcePhasor = comp => cx.fromPolar(comp.value, comp.phase);

/* ------------------------------------------------------------------ complex linear solver */
export function solveComplexSystem(matrix, rhs) {
  try {
    return csolve(matrix, rhs.map(z => [z]), { absTol: 0, relTol: LIMITS.singularRelTol }).map(row => row[0]);
  } catch (error) {
    if (error?.code !== 'SINGULAR_MATRIX') throw error;
    throw modelError('SINGULAR_SYSTEM');
  }
}

/* ------------------------------------------------------------------ main solver */
export function solvePhasorCircuit(input = defaults) {
  const { nodeCount, frequency, components } = validateCircuit(input);
  const omega = omegaOf(frequency);
  const vSources = components.filter(c => c.type === 'V');
  const dim = nodeCount + vSources.length;
  const zero = () => ({ re: 0, im: 0 });
  const A = Array.from({ length: dim }, () => Array.from({ length: dim }, zero));
  const b = Array.from({ length: dim }, zero);

  let k = 0;
  const vIndex = new Map();
  for (const comp of components) {
    const a = comp.from;
    const z = comp.to;
    if (comp.type === 'I') {
      const phasor = sourcePhasor(comp);
      if (a > 0) b[a - 1] = cx.sub(b[a - 1], phasor);
      if (z > 0) b[z - 1] = cx.add(b[z - 1], phasor);
    } else if (comp.type === 'V') {
      const col = nodeCount + k;
      if (a > 0) { A[a - 1][col].re += 1; A[col][a - 1].re += 1; }
      if (z > 0) { A[z - 1][col].re -= 1; A[col][z - 1].re -= 1; }
      b[col] = sourcePhasor(comp);
      vIndex.set(comp, k++);
    } else {
      const y = admittance(comp, omega);
      if (a > 0) A[a - 1][a - 1] = cx.add(A[a - 1][a - 1], y);
      if (z > 0) A[z - 1][z - 1] = cx.add(A[z - 1][z - 1], y);
      if (a > 0 && z > 0) {
        A[a - 1][z - 1] = cx.sub(A[a - 1][z - 1], y);
        A[z - 1][a - 1] = cx.sub(A[z - 1][a - 1], y);
      }
    }
  }

  const x = solveComplexSystem(A, b);
  const nodeVoltages = [zero(), ...x.slice(0, nodeCount)];
  const vCurrents = x.slice(nodeCount);

  const kcl = Array.from({ length: nodeCount }, zero);
  let activePowerLoads = 0;      // Σ P over resistors (W)
  let reactiveInductors = 0;     // Σ Q over inductors (var, > 0)
  let reactiveCapacitors = 0;    // Σ Q over capacitors (var, < 0)
  let suppliedPower = zero();    // complex power delivered by all sources
  let balance = zero();          // Σ S over ALL elements (must be 0: Tellegen)

  const branches = components.map(comp => {
    const drop = cx.sub(nodeVoltages[comp.from], nodeVoltages[comp.to]);
    let current;
    if (comp.type === 'I') current = sourcePhasor(comp);
    else if (comp.type === 'V') current = vCurrents[vIndex.get(comp)];   // From → To through the source
    else current = cx.mul(admittance(comp, omega), drop);
    const S = cx.scale(cx.mul(drop, cx.conj(current)), 0.5);             // absorbed
    balance = cx.add(balance, S);
    if (comp.type === 'R') activePowerLoads += S.re;
    if (comp.type === 'L') reactiveInductors += S.im;
    if (comp.type === 'C') reactiveCapacitors += S.im;
    if (comp.type === 'I' || comp.type === 'V') suppliedPower = cx.sub(suppliedPower, S);
    if (comp.from > 0) kcl[comp.from - 1] = cx.add(kcl[comp.from - 1], current);
    if (comp.to > 0) kcl[comp.to - 1] = cx.sub(kcl[comp.to - 1], current);
    return { ...comp, voltageDrop: drop, current, power: S };
  });

  return {
    nodeCount,
    frequency,
    omega,
    nodeVoltages,
    vCurrents,
    branches,
    activePowerLoads,
    reactiveInductors,
    reactiveCapacitors,
    suppliedPower,
    powerBalanceError: cx.abs(balance),
    kclResiduals: kcl,
    maxKclResidual: kcl.reduce((m, r) => Math.max(m, cx.abs(r)), 0),
    matrix: { A, b, solution: x, voltageSourceIds: vSources.map(c => c.id) }
  };
}

/* ------------------------------------------------------------------ symbolic form */
/**
 * Symbolic MNA entries written with the circuit's own elements. Each entry is a list of signed
 * terms { sign, kind, id, value }: 'invR' = 1/R · 'invL' = 1/(jωL) · 'capC' = jωC ·
 * 'unit' = ±1 (voltage-source incidence) · 'I' / 'V' = source phasor. Mirrors the stamps above;
 * tests evaluate the terms and compare with the numeric matrix.
 */
export function symbolicTerms(circuit) {
  const { nodeCount, components } = validateCircuit(circuit);
  const vSources = components.filter(c => c.type === 'V');
  const dim = nodeCount + vSources.length;
  const A = Array.from({ length: dim }, () => Array.from({ length: dim }, () => []));
  const b = Array.from({ length: dim }, () => []);
  const term = (sign, kind, c) => ({ sign, kind, id: c.id, value: c.value, phase: c.phase });
  const kindOf = { R: 'invR', L: 'invL', C: 'capC' };
  let k = 0;
  for (const comp of components) {
    const a = comp.from;
    const z = comp.to;
    if (comp.type === 'I') {
      if (a > 0) b[a - 1].push(term(-1, 'I', comp));
      if (z > 0) b[z - 1].push(term(1, 'I', comp));
    } else if (comp.type === 'V') {
      const col = nodeCount + k;
      if (a > 0) { A[a - 1][col].push(term(1, 'unit', comp)); A[col][a - 1].push(term(1, 'unit', comp)); }
      if (z > 0) { A[z - 1][col].push(term(-1, 'unit', comp)); A[col][z - 1].push(term(-1, 'unit', comp)); }
      b[col].push(term(1, 'V', comp));
      k++;
    } else {
      const kind = kindOf[comp.type];
      if (a > 0) A[a - 1][a - 1].push(term(1, kind, comp));
      if (z > 0) A[z - 1][z - 1].push(term(1, kind, comp));
      if (a > 0 && z > 0) {
        A[a - 1][z - 1].push(term(-1, kind, comp));
        A[z - 1][a - 1].push(term(-1, kind, comp));
      }
    }
  }
  return { nodeCount, voltageSourceIds: vSources.map(c => c.id), A, b };
}

/** Numeric value of one symbolic term at angular frequency ω (used by tests). */
export function evaluateTerm(t, omega) {
  let value;
  if (t.kind === 'invR') value = { re: 1 / t.value, im: 0 };
  else if (t.kind === 'invL') value = { re: 0, im: -1 / (omega * t.value * 1e-3) };
  else if (t.kind === 'capC') value = { re: 0, im: omega * t.value * 1e-6 };
  else if (t.kind === 'unit') value = { re: 1, im: 0 };
  else value = cx.fromPolar(t.value, t.phase);
  return cx.scale(value, t.sign);
}
