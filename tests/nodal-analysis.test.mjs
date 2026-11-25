import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, defaults, solveNodalCircuit, validateCircuit, symbolicTerms } from '../simulators/electrical-circuits/nodal-analysis/model.js';

test('Two-node current-source circuit matches exact analytical solution', () => {
  const res = solveNodalCircuit(defaults);
  assert.ok(res.matrix.pureNodal);
  assert.ok(Math.abs(res.nodeVoltages[1] - 80 / 7) < 1e-12);
  assert.ok(Math.abs(res.nodeVoltages[2] - 50 / 7) < 1e-12);
  assert.ok(res.maxKclResidual < 1e-12);
  assert.ok(res.powerBalanceError < 1e-12);
});

test('Balanced Wheatstone bridge yields zero bridge current and exact divider voltages', () => {
  const wheatstone = PRESETS.find(p => p.id === 'wheatstone-bridge');
  const res = solveNodalCircuit(wheatstone);
  assert.equal(res.matrix.pureNodal, false);
  assert.ok(Math.abs(res.nodeVoltages[1] - 12) < 1e-12);
  assert.ok(Math.abs(res.nodeVoltages[2] - 8) < 1e-12);
  assert.ok(Math.abs(res.nodeVoltages[3] - 8) < 1e-12);
  const r5 = res.branches.find(b => b.id === 'R5');
  assert.ok(Math.abs(r5.current) < 1e-13);
  assert.ok(res.maxKclResidual < 1e-12);
  assert.ok(res.powerBalanceError < 1e-12);
});

test('Supernode circuit with floating voltage source matches exact rational solution', () => {
  const supernode = PRESETS.find(p => p.id === 'supernode-dc');
  const res = solveNodalCircuit(supernode);
  assert.ok(Math.abs(res.nodeVoltages[1] - 72 / 19) < 1e-12);
  assert.ok(Math.abs(res.nodeVoltages[2] - 186 / 19) < 1e-12);
  assert.ok(Math.abs(res.nodeVoltages[3] - 162 / 19) < 1e-12);
  assert.ok(Math.abs((res.nodeVoltages[2] - res.nodeVoltages[1]) - 6) < 1e-12);
  assert.ok(res.maxKclResidual < 1e-12);
  assert.ok(res.powerBalanceError < 1e-12);
});

test('All presets satisfy KCL conservation and power balance', () => {
  for (const preset of PRESETS) {
    const res = solveNodalCircuit(preset);
    assert.ok(res.maxKclResidual < 1e-12, `${preset.id} KCL residual too high`);
    assert.ok(res.powerBalanceError < 1e-11, `${preset.id} power balance error too high`);
    assert.ok(res.totalDissipated > 0);
  }
});

test('Linearity: scaling all independent sources scales voltages and currents linearly', () => {
  const base = solveNodalCircuit(PRESETS[2]);
  const scaledCircuit = {
    nodeCount: PRESETS[2].nodeCount,
    components: PRESETS[2].components.map(c =>
      c.type === 'R' ? { ...c } : { ...c, value: c.value * 3 }
    )
  };
  const scaled = solveNodalCircuit(scaledCircuit);
  for (let k = 1; k <= base.nodeCount; k++) {
    assert.ok(Math.abs(scaled.nodeVoltages[k] - 3 * base.nodeVoltages[k]) < 1e-11);
  }
  assert.ok(Math.abs(scaled.totalDissipated - 9 * base.totalDissipated) < 1e-10);
});

test('Invalid inputs, disconnected nodes and singular voltage loops are rejected', () => {
  assert.throws(() => validateCircuit({ nodeCount: 1, components: defaults.components }), { code: 'INVALID_NODE_COUNT' });
  assert.throws(() => validateCircuit({ nodeCount: 6, components: defaults.components }), { code: 'INVALID_NODE_COUNT' });
  assert.throws(() => validateCircuit({ nodeCount: 2, components: [] }), { code: 'INVALID_COMPONENT_COUNT' });
  assert.throws(() => validateCircuit({
    nodeCount: 2,
    components: [{ id: 'R1', type: 'R', from: 1, to: 1, value: 10 }]
  }), { code: 'SELF_LOOP' });
  assert.throws(() => validateCircuit({
    nodeCount: 2,
    components: [{ id: 'R1', type: 'R', from: 1, to: 0, value: 0 }]
  }), { code: 'RESISTANCE_RANGE' });
  assert.throws(() => validateCircuit({
    nodeCount: 2,
    components: [{ id: 'R1', type: 'R', from: 1, to: 0, value: NaN }]
  }), { code: 'NON_FINITE_VALUE' });
  assert.throws(() => validateCircuit({
    nodeCount: 2,
    components: [
      { id: 'R1', type: 'R', from: 1, to: 0, value: 10 },
      { id: 'R2', type: 'R', from: 2, to: 2, value: 10 }
    ]
  }), { code: 'SELF_LOOP' });
  assert.throws(() => validateCircuit({
    nodeCount: 2,
    components: [
      { id: 'R1', type: 'R', from: 1, to: 0, value: 10 }
    ]
  }), { code: 'DISCONNECTED_NODE' });
  assert.throws(() => solveNodalCircuit({
    nodeCount: 2,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 5 },
      { id: 'V2', type: 'V', from: 1, to: 0, value: 10 },
      { id: 'R1', type: 'R', from: 2, to: 0, value: 10 },
      { id: 'R2', type: 'R', from: 1, to: 2, value: 10 }
    ]
  }), { code: 'SINGULAR_SYSTEM' });
});

test('Additional presets match hand-derived node voltages', () => {
  const solve = id => solveNodalCircuit(PRESETS.find(p => p.id === id)).nodeVoltages;
  const divider = solve('voltage-divider');
  assert.ok(Math.abs(divider[1] - 10) < 1e-12 && Math.abs(divider[2] - 7.5) < 1e-12);
  const current = solve('current-divider');
  assert.ok(Math.abs(current[1] - 60 / 11) < 1e-12 && Math.abs(current[2] - 30 / 11) < 1e-12);
  const mixed = solve('mixed-sources');
  assert.ok(Math.abs(mixed[2] - 7.5) < 1e-12);
  const ring = solve('ring-5node');
  assert.equal(ring.length, 6);
  assert.ok(ring.every(Number.isFinite) && Math.abs(ring[1] - 12) < 1e-12);
});

test('Symbolic element-based system evaluates to the numeric MNA matrix for every preset', () => {
  const value = t => t.sign * (t.kind === 'invR' ? 1 / t.value : t.kind === 'unit' ? 1 : t.value);
  const sum = list => list.reduce((acc, t) => acc + value(t), 0);
  for (const preset of PRESETS) {
    const sym = symbolicTerms(preset);
    const num = solveNodalCircuit(preset).matrix;
    assert.equal(sym.A.length, num.A.length);
    sym.A.forEach((row, r) => row.forEach((cell, c) => assert.ok(Math.abs(sum(cell) - num.A[r][c]) < 1e-12, `${preset.id} A[${r}][${c}]`)));
    sym.b.forEach((cell, r) => assert.ok(Math.abs(sum(cell) - num.b[r]) < 1e-12, `${preset.id} b[${r}]`));
  }
});
