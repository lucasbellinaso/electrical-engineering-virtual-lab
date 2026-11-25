import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS, LIMITS, cx, polar, solvePhasorCircuit, symbolicTerms, evaluateTerm, validateCircuit, omegaOf, solveComplexSystem} from '../simulators/electrical-circuits/nodal-analysis-ac/model.js';
import katex from '../assets/vendor/katex/katex.mjs';
import {symbolicSystemLatex, numericSystemLatex, kclRowsLatex, latexComplex} from '../simulators/electrical-circuits/nodal-analysis-ac/latex.js';
import {PRESETS as DC_PRESETS, solveNodalCircuit} from '../simulators/electrical-circuits/nodal-analysis/model.js';

const preset = id => structuredClone(PRESETS.find(p => p.id === id));
const closeC = (z, w, tol, message = '') => assert.ok(cx.abs(cx.sub(z, w)) <= tol, `${message} ${JSON.stringify(z)} vs ${JSON.stringify(w)} (tol ${tol})`);
const near = (a, b, tol, message = '') => assert.ok(Math.abs(a - b) <= tol, `${message} ${a} vs ${b} (tol ${tol})`);
const comp = (circuit, id) => circuit.components.find(c => c.id === id);

test('RC low-pass equals V/(1 + jωRC) (corner frequency: |H| = 1/√2, −45°)', () => {
  const c = preset('rc-lowpass'), s = solvePhasorCircuit(c);
  const w = omegaOf(c.frequency), R = 1000, C = 0.15915494309189535e-6;
  const expected = cx.div({re: 10, im: 0}, {re: 1, im: w * R * C});
  closeC(s.nodeVoltages[2], expected, 1e-12);
  const p = polar(s.nodeVoltages[2]);
  near(p.mag, 10 / Math.SQRT2, 1e-9); near(p.phase, -45, 1e-9);
  closeC(s.nodeVoltages[1], {re: 10, im: 0}, 1e-12);
});

test('RL high-pass equals V·jωL/(R + jωL) (+45° at the corner)', () => {
  const c = preset('rl-highpass'), s = solvePhasorCircuit(c);
  const polarOut = polar(s.nodeVoltages[2]);
  near(polarOut.mag, 10 / Math.SQRT2, 1e-9); near(polarOut.phase, -45, 1e-9); // R across the output
  const iL = s.branches.find(b => b.id === 'L1').current;
  near(polar(iL).phase, -45, 1e-9);
  const vL = s.branches.find(b => b.id === 'L1').voltageDrop;
  near(polar(vL).mag, 10 / Math.SQRT2, 1e-9); near(polar(vL).phase, 45, 1e-9);
});

test('Series resonance: current = V/R in phase, |V_C| = |V_L| = Q·V with ∓90° phases', () => {
  const c = preset('series-resonance'), s = solvePhasorCircuit(c);
  const L = 0.01, R = 10, w = omegaOf(c.frequency), Q = w * L / R;
  const I = s.branches.find(b => b.id === 'R1').current;
  closeC(I, {re: 1, im: 0}, 1e-9, 'I = V/R');
  const vC = s.nodeVoltages[3], vL = s.branches.find(b => b.id === 'L1').voltageDrop;
  near(polar(vC).mag, Q * 10, 1e-6); near(polar(vC).phase, -90, 1e-6);
  near(polar(vL).mag, Q * 10, 1e-6); near(polar(vL).phase, 90, 1e-6);
  near(s.reactiveInductors + s.reactiveCapacitors, 0, 1e-9, 'Q cancels at resonance');
});

test('Parallel resonance: I_L + I_C = 0 and the tank is an open circuit', () => {
  const c = preset('parallel-resonance'), s = solvePhasorCircuit(c);
  const iL = s.branches.find(b => b.id === 'L1').current, iC = s.branches.find(b => b.id === 'C1').current;
  closeC(cx.add(iL, iC), {re: 0, im: 0}, 1e-12);
  // The tank is open, so the source sees R1 ∥ (R3 + R2) = 1000 ∥ 1500 = 600 Ω → 6 V.
  closeC(s.nodeVoltages[1], {re: 6, im: 0}, 1e-9);
  closeC(s.nodeVoltages[2], {re: 2, im: 0}, 1e-9);
});

test('Two sources with phase: superposition and hand calculation', () => {
  const c = preset('two-sources-phase'), s = solvePhasorCircuit(c);
  const w = omegaOf(60), ZL = {re: 0, im: w * 26.5e-3};
  const V1 = cx.fromPolar(120, 0), V3 = cx.fromPolar(120, -30);
  // Node 2: (V2−V1)/10 + (V2−V3)/10 + V2/(jωL) = 0
  const yL = cx.div({re: 1, im: 0}, ZL);
  const V2 = cx.div(cx.scale(cx.add(V1, V3), 0.1), cx.add({re: 0.2, im: 0}, yL));
  closeC(s.nodeVoltages[2], V2, 1e-9);
});

test('Tellegen: complex power of all elements sums to zero for every preset', () => {
  for (const p of PRESETS) {
    const s = solvePhasorCircuit(p), scale = Math.max(1e-12, s.activePowerLoads, cx.abs(s.suppliedPower));
    assert.ok(s.powerBalanceError <= 1e-11 * scale, `${p.id} balance ${s.powerBalanceError}`);
    near(s.suppliedPower.re, s.activePowerLoads, 1e-9 * scale, `${p.id} P`);
    near(s.suppliedPower.im, s.reactiveInductors + s.reactiveCapacitors, 1e-9 * scale, `${p.id} Q`);
  }
});

test('KCL residual is zero at every node for every preset', () => {
  for (const p of PRESETS) {
    const s = solvePhasorCircuit(p);
    const scale = Math.max(...s.branches.map(b => cx.abs(b.current)), 1e-12);
    assert.ok(s.maxKclResidual <= 1e-11 * scale, `${p.id} kcl ${s.maxKclResidual}`);
  }
});

test('Scaling f → 2f, L → L/2, C → C/2 leaves every phasor unchanged', () => {
  const a = preset('series-resonance'), b = structuredClone(a);
  b.frequency *= 2; comp(b, 'L1').value /= 2; comp(b, 'C1').value /= 2;
  // Z_L = jωL and Z_C = 1/(jωC) scale by 1 and 4 respectively, so only L is invariant; use the RC case.
  const c = preset('rc-lowpass'), d = structuredClone(c);
  d.frequency *= 2; comp(d, 'C1').value /= 2;
  const sc = solvePhasorCircuit(c), sd = solvePhasorCircuit(d);
  for (let k = 0; k <= c.nodeCount; k++) closeC(sc.nodeVoltages[k], sd.nodeVoltages[k], 1e-12);
  const l1 = preset('rl-highpass'), l2 = structuredClone(l1);
  l2.frequency *= 4; comp(l2, 'L1').value /= 4;
  const s1 = solvePhasorCircuit(l1), s2 = solvePhasorCircuit(l2);
  for (let k = 0; k <= l1.nodeCount; k++) closeC(s1.nodeVoltages[k], s2.nodeVoltages[k], 1e-12);
});

test('Circuits with only R and sources reduce to the resistive nodal solver (phase 0, imaginary part 0)', () => {
  for (const p of DC_PRESETS) {
    const ac = solvePhasorCircuit({nodeCount: p.nodeCount, frequency: 50, components: p.components.map(c => ({...c, phase: 0}))});
    const dc = solveNodalCircuit(p);
    dc.nodeVoltages.forEach((v, k) => { near(ac.nodeVoltages[k].re, v, 1e-9 * Math.max(1, Math.abs(v)), `${p.id} v${k}`); near(ac.nodeVoltages[k].im, 0, 1e-12); });
  }
});

test('Source phase rotates the whole solution and keeps magnitudes', () => {
  const a = preset('rc-two-stage'), b = structuredClone(a);
  comp(b, 'V1').phase = 60;
  const sa = solvePhasorCircuit(a), sb = solvePhasorCircuit(b);
  for (let k = 1; k <= a.nodeCount; k++) {
    near(polar(sb.nodeVoltages[k]).mag, polar(sa.nodeVoltages[k]).mag, 1e-12);
    near(polar(sb.nodeVoltages[k]).phase - polar(sa.nodeVoltages[k]).phase, 60, 1e-9);
  }
});

test('Symbolic element-based terms evaluate to the numeric complex MNA matrix for every preset', () => {
  for (const p of PRESETS) {
    const sym = symbolicTerms(p), num = solvePhasorCircuit(p), w = omegaOf(p.frequency);
    const sum = list => list.reduce((acc, t) => cx.add(acc, evaluateTerm(t, w)), {re: 0, im: 0});
    sym.A.forEach((row, r) => row.forEach((cell, c) => closeC(sum(cell), num.matrix.A[r][c], 1e-9 * Math.max(1, cx.abs(num.matrix.A[r][c])), `${p.id} A[${r}][${c}]`)));
    sym.b.forEach((cell, r) => closeC(sum(cell), num.matrix.b[r], 1e-12 * Math.max(1, cx.abs(num.matrix.b[r])), `${p.id} b[${r}]`));
  }
});

test('Complex solver agrees with a known 2×2 system and rejects a singular one', () => {
  const x = solveComplexSystem([[{re: 1, im: 1}, {re: 0, im: 0}], [{re: 0, im: 0}, {re: 2, im: 0}]], [{re: 2, im: 0}, {re: 4, im: 0}]);
  closeC(x[0], {re: 1, im: -1}, 1e-15); closeC(x[1], {re: 2, im: 0}, 1e-15);
  assert.throws(() => solveComplexSystem([[{re: 1, im: 0}, {re: 1, im: 0}], [{re: 1, im: 0}, {re: 1, im: 0}]], [{re: 1, im: 0}, {re: 2, im: 0}]), e => e.code === 'SINGULAR_SYSTEM');
});

test('Invalid inputs are rejected with explicit error codes', () => {
  const base = () => preset('rc-lowpass');
  const fails = (mutate, code) => { const c = base(); mutate(c); assert.throws(() => solvePhasorCircuit(c), e => e.code === code, code); };
  fails(c => { c.frequency = 0; }, 'INVALID_FREQUENCY');
  fails(c => { c.frequency = NaN; }, 'INVALID_FREQUENCY');
  fails(c => { c.frequency = LIMITS.maxFrequency * 2; }, 'INVALID_FREQUENCY');
  fails(c => { c.nodeCount = 1; }, 'INVALID_NODE_COUNT');
  fails(c => { comp(c, 'R1').value = 0; }, 'RESISTANCE_RANGE');
  fails(c => { comp(c, 'C1').value = -1; }, 'CAPACITANCE_RANGE');
  fails(c => { comp(c, 'C1').value = 0; }, 'CAPACITANCE_RANGE');
  fails(c => { c.components.push({id: 'L9', type: 'L', from: 1, to: 2, value: 0, phase: 0}); }, 'INDUCTANCE_RANGE');
  fails(c => { comp(c, 'V1').value = 1e9; }, 'VOLTAGE_RANGE');
  fails(c => { comp(c, 'V1').phase = 400; }, 'INVALID_PHASE');
  fails(c => { comp(c, 'R1').to = 1; }, 'SELF_LOOP');
  fails(c => { comp(c, 'R1').to = 9; }, 'INVALID_NODE');
  fails(c => { comp(c, 'R1').type = 'X'; }, 'INVALID_TYPE');
  fails(c => { comp(c, 'R1').value = Infinity; }, 'NON_FINITE_VALUE');
  fails(c => { c.components = []; }, 'INVALID_COMPONENT_COUNT');
  fails(c => { c.components = c.components.filter(x => x.id === 'V1'); }, 'DISCONNECTED_NODE'); // node 2 has no element
  // A node held only by a current source has no path to ground.
  fails(c => { c.components = [{id: 'V1', type: 'V', from: 1, to: 0, value: 1, phase: 0}, {id: 'I1', type: 'I', from: 1, to: 2, value: 1, phase: 0}]; }, 'DISCONNECTED_NODE');
  // Two ideal voltage sources in parallel with different values → singular matrix.
  fails(c => { c.components.push({id: 'V2', type: 'V', from: 1, to: 0, value: 5, phase: 0}); }, 'SINGULAR_SYSTEM');
  assert.throws(() => validateCircuit(null), e => e.code === 'INVALID_CIRCUIT');
});

test('Source phase is ignored for passive elements and defaults to 0', () => {
  const c = preset('rc-lowpass'); delete comp(c, 'V1').phase; comp(c, 'R1').phase = 123;
  const v = validateCircuit(c);
  assert.equal(v.components[0].phase, 0); assert.equal(v.components[1].phase, 0);
});

test('Extreme but valid values stay finite', () => {
  const c = preset('series-resonance'); c.frequency = LIMITS.maxFrequency; comp(c, 'C1').value = LIMITS.minCapacitance;
  const s = solvePhasorCircuit(c);
  assert.ok(s.nodeVoltages.every(v => Number.isFinite(v.re) && Number.isFinite(v.im)));
});

test('Complex number formatting and KaTeX rendering of every preset (symbolic, numeric, KCL rows)', () => {
  assert.equal(latexComplex({re: 0, im: 0}), '0');
  assert.equal(latexComplex({re: 1.5, im: 0}), '1.5');
  assert.equal(latexComplex({re: 0, im: -2}), '-2j');
  assert.equal(latexComplex({re: 1, im: -0.5}), '1 - 0.5j');
  assert.equal(latexComplex({re: 2, im: 3}), '2 + 3j');
  for (const p of PRESETS) {
    const sc = symbolicTerms(p), s = solvePhasorCircuit(p);
    const all = [symbolicSystemLatex(sc), numericSystemLatex(s, sc.voltageSourceIds), ...kclRowsLatex(s, sc.voltageSourceIds)];
    for (const tex of all) katex.renderToString(tex, {displayMode: true, throwOnError: true, trust: false, output: 'htmlAndMathml'});
    assert.equal(kclRowsLatex(s, sc.voltageSourceIds).length, p.nodeCount);
    assert.ok(symbolicSystemLatex(sc).includes(String.raw`j\omega`) || !p.components.some(c => c.type === 'L' || c.type === 'C'));
  }
});

test('Phasor symbols are plain (no dot, which means time derivative, and no bar)', () => {
  for (const p of PRESETS) {
    const sc = symbolicTerms(p), s = solvePhasorCircuit(p);
    const all = [symbolicSystemLatex(sc), numericSystemLatex(s, sc.voltageSourceIds), ...kclRowsLatex(s, sc.voltageSourceIds)].join('\n');
    assert.ok(!all.includes(String.raw`\dot`) && !all.includes(String.raw`\underline`) && !all.includes(String.raw`\overline`), p.id);
    assert.ok(all.includes('V_{1}'), p.id);
  }
});
