/**
 * Pure Modified Nodal Analysis (MNA) solver for linear DC resistive circuits.
 * Internal units are strictly SI: ohms (Ω), siemens (S), amperes (A), volts (V), watts (W).
 */

export const LIMITS = Object.freeze({
  minNodes: 2,
  maxNodes: 5,
  maxComponents: 24,
  minResistance: 1e-3,
  maxResistance: 1e9,
  maxCurrent: 1e4,
  maxVoltage: 1e4,
  singularPivotTol: 1e-12
});

export const PRESETS = Object.freeze([
  {
    id: 'two-node-current',
    nodeCount: 2,
    components: [
      { id: 'I1', type: 'I', from: 0, to: 1, value: 2 },
      { id: 'R1', type: 'R', from: 1, to: 0, value: 10 },
      { id: 'R2', type: 'R', from: 1, to: 2, value: 5 },
      { id: 'R3', type: 'R', from: 2, to: 0, value: 20 },
      { id: 'I2', type: 'I', from: 2, to: 0, value: 0.5 }
    ]
  },
  {
    id: 'wheatstone-bridge',
    nodeCount: 3,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 12 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 100 },
      { id: 'R2', type: 'R', from: 2, to: 0, value: 200 },
      { id: 'R3', type: 'R', from: 1, to: 3, value: 150 },
      { id: 'R4', type: 'R', from: 3, to: 0, value: 300 },
      { id: 'R5', type: 'R', from: 2, to: 3, value: 120 }
    ]
  },
  {
    id: 'supernode-dc',
    nodeCount: 3,
    components: [
      { id: 'I1', type: 'I', from: 0, to: 1, value: 3 },
      { id: 'R1', type: 'R', from: 1, to: 0, value: 4 },
      { id: 'V1', type: 'V', from: 2, to: 1, value: 6 },
      { id: 'R2', type: 'R', from: 2, to: 0, value: 6 },
      { id: 'R3', type: 'R', from: 2, to: 3, value: 3 },
      { id: 'R4', type: 'R', from: 3, to: 0, value: 6 },
      { id: 'I2', type: 'I', from: 0, to: 3, value: 1 }
    ]
  },
  {
    id: 'ladder-4node',
    nodeCount: 4,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 16 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 1000 },
      { id: 'R2', type: 'R', from: 2, to: 0, value: 2000 },
      { id: 'R3', type: 'R', from: 2, to: 3, value: 1000 },
      { id: 'R4', type: 'R', from: 3, to: 0, value: 2000 },
      { id: 'R5', type: 'R', from: 3, to: 4, value: 1000 },
      { id: 'R6', type: 'R', from: 4, to: 0, value: 2000 }
    ]
  },
  {
    id: 'voltage-divider',
    nodeCount: 2,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 10 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 1000 },
      { id: 'R2', type: 'R', from: 2, to: 0, value: 3000 }
    ]
  },
  {
    id: 'current-divider',
    nodeCount: 2,
    components: [
      { id: 'I1', type: 'I', from: 0, to: 1, value: 3 },
      { id: 'R1', type: 'R', from: 1, to: 0, value: 6 },
      { id: 'R2', type: 'R', from: 1, to: 0, value: 3 },
      { id: 'R3', type: 'R', from: 2, to: 0, value: 10 },
      { id: 'R4', type: 'R', from: 1, to: 2, value: 10 }
    ]
  },
  {
    id: 'mixed-sources',
    nodeCount: 2,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 10 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 100 },
      { id: 'R2', type: 'R', from: 2, to: 0, value: 100 },
      { id: 'I1', type: 'I', from: 0, to: 2, value: 0.05 }
    ]
  },
  {
    id: 'ring-5node',
    nodeCount: 5,
    components: [
      { id: 'V1', type: 'V', from: 1, to: 0, value: 12 },
      { id: 'R1', type: 'R', from: 1, to: 2, value: 100 },
      { id: 'R2', type: 'R', from: 2, to: 3, value: 100 },
      { id: 'R3', type: 'R', from: 3, to: 4, value: 100 },
      { id: 'R4', type: 'R', from: 4, to: 5, value: 100 },
      { id: 'R5', type: 'R', from: 5, to: 0, value: 100 },
      { id: 'R6', type: 'R', from: 2, to: 4, value: 200 },
      { id: 'R7', type: 'R', from: 3, to: 0, value: 220 }
    ]
  }
]);

export const defaults = structuredClone(PRESETS[0]);

function createModelError(code, detail = '') {
  const err = new Error(detail ? `${code}: ${detail}` : code);
  err.code = code;
  err.detail = detail;
  return err;
}

/**
 * Validates circuit topology, parameter types, and numerical bounds.
 * @param {{ nodeCount: number, components: Array<{id?: string, type: string, from: number, to: number, value: number}> }} circuit
 */
export function validateCircuit(circuit) {
  if (!circuit || typeof circuit !== 'object') {
    throw createModelError('INVALID_CIRCUIT', 'Circuit object is required.');
  }

  const { nodeCount, components } = circuit;
  if (!Number.isInteger(nodeCount) || nodeCount < LIMITS.minNodes || nodeCount > LIMITS.maxNodes) {
    throw createModelError('INVALID_NODE_COUNT', `nodeCount must be an integer in [${LIMITS.minNodes}, ${LIMITS.maxNodes}].`);
  }

  if (!Array.isArray(components) || components.length === 0 || components.length > LIMITS.maxComponents) {
    throw createModelError('INVALID_COMPONENT_COUNT', `components must have 1 to ${LIMITS.maxComponents} entries.`);
  }

  const normalized = components.map((comp, index) => {
    if (!comp || typeof comp !== 'object') {
      throw createModelError('INVALID_COMPONENT', `Component #${index + 1} is invalid.`);
    }
    const type = comp.type;
    if (!['R', 'I', 'V'].includes(type)) {
      throw createModelError('INVALID_TYPE', `Component #${index + 1} has unsupported type.`);
    }
    const from = comp.from;
    const to = comp.to;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > nodeCount || to < 0 || to > nodeCount) {
      throw createModelError('INVALID_NODE', `Component #${index + 1} references an out-of-range node.`);
    }
    if (from === to) {
      throw createModelError('SELF_LOOP', `Component #${index + 1} cannot connect node ${from} to itself.`);
    }
    const value = comp.value;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw createModelError('NON_FINITE_VALUE', `Component #${index + 1} has a non-finite value.`);
    }
    if (type === 'R' && (value < LIMITS.minResistance || value > LIMITS.maxResistance)) {
      throw createModelError('RESISTANCE_RANGE', `Resistor #${index + 1} must be in [${LIMITS.minResistance}, ${LIMITS.maxResistance}] Ω.`);
    }
    if (type === 'I' && Math.abs(value) > LIMITS.maxCurrent) {
      throw createModelError('CURRENT_RANGE', `Current source #${index + 1} must be in [-${LIMITS.maxCurrent}, ${LIMITS.maxCurrent}] A.`);
    }
    if (type === 'V' && Math.abs(value) > LIMITS.maxVoltage) {
      throw createModelError('VOLTAGE_RANGE', `Voltage source #${index + 1} must be in [-${LIMITS.maxVoltage}, ${LIMITS.maxVoltage}] V.`);
    }
    const id = typeof comp.id === 'string' && comp.id.trim() ? comp.id.trim() : `${type}${index + 1}`;
    return { id, type, from, to, value };
  });

  // Verify every non-reference node 1..nodeCount is connected to ground (node 0)
  const adj = Array.from({ length: nodeCount + 1 }, () => []);
  for (const c of normalized) {
    adj[c.from].push(c.to);
    adj[c.to].push(c.from);
  }
  const visited = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const curr = queue.shift();
    for (const next of adj[curr]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  for (let node = 1; node <= nodeCount; node++) {
    if (!visited.has(node)) {
      throw createModelError('DISCONNECTED_NODE', `Node ${node} has no path to reference node 0 (GND).`);
    }
  }

  return { nodeCount, components: normalized };
}

/**
 * Solves A * x = b using Gaussian elimination with partial pivoting.
 * Throws SINGULAR_SYSTEM if the matrix is singular or ill-conditioned.
 * @param {number[][]} matrix
 * @param {number[]} rhs
 * @returns {number[]}
 */
export function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const A = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col]);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = row;
      }
    }

    if (maxVal <= LIMITS.singularPivotTol) {
      throw createModelError('SINGULAR_SYSTEM', 'Circuit matrix is singular (check for voltage source loops or floating subcircuits).');
    }

    if (pivotRow !== col) {
      const tmp = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmp;
    }

    const pivot = A[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / pivot;
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) {
        A[row][j] -= factor * A[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = A[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * x[j];
    }
    x[i] = sum / A[i][i];
  }
  return x;
}

/**
 * Assembles and solves the nodal / MNA system for the given resistive circuit.
 * @param {{ nodeCount: number, components: Array<{id?: string, type: string, from: number, to: number, value: number}> }} input
 */
export function solveNodalCircuit(input = defaults) {
  const { nodeCount, components } = validateCircuit(input);

  const G = Array.from({ length: nodeCount }, () => new Array(nodeCount).fill(0));
  const iVec = new Array(nodeCount).fill(0);
  const vSources = components.filter(c => c.type === 'V');
  const numV = vSources.length;
  const B = Array.from({ length: nodeCount }, () => new Array(numV).fill(0));
  const eVec = new Array(numV).fill(0);

  let vIndex = 0;
  const vIndexMap = new Map();

  for (const comp of components) {
    const a = comp.from;
    const b = comp.to;
    if (comp.type === 'R') {
      const g = 1 / comp.value;
      if (a > 0) G[a - 1][a - 1] += g;
      if (b > 0) G[b - 1][b - 1] += g;
      if (a > 0 && b > 0) {
        G[a - 1][b - 1] -= g;
        G[b - 1][a - 1] -= g;
      }
    } else if (comp.type === 'I') {
      // Current flows from `from` (leaves node `from`) to `to` (enters node `to`)
      if (a > 0) iVec[a - 1] -= comp.value;
      if (b > 0) iVec[b - 1] += comp.value;
    } else if (comp.type === 'V') {
      if (a > 0) B[a - 1][vIndex] += 1;
      if (b > 0) B[b - 1][vIndex] -= 1;
      eVec[vIndex] = comp.value;
      vIndexMap.set(comp, vIndex);
      vIndex++;
    }
  }

  const dim = nodeCount + numV;
  const A = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const rhs = new Array(dim).fill(0);

  for (let r = 0; r < nodeCount; r++) {
    rhs[r] = iVec[r];
    for (let c = 0; c < nodeCount; c++) {
      A[r][c] = G[r][c];
    }
    for (let k = 0; k < numV; k++) {
      A[r][nodeCount + k] = B[r][k];
      A[nodeCount + k][r] = B[r][k];
    }
  }
  for (let k = 0; k < numV; k++) {
    rhs[nodeCount + k] = eVec[k];
  }

  const solution = solveLinearSystem(A, rhs);
  const nodeVoltages = [0, ...solution.slice(0, nodeCount)];
  const vCurrents = solution.slice(nodeCount);

  let totalDissipated = 0;
  let totalSupplied = 0;
  const kclResiduals = new Array(nodeCount).fill(0);

  const branches = components.map(comp => {
    const va = nodeVoltages[comp.from];
    const vb = nodeVoltages[comp.to];
    const voltageDrop = va - vb;
    let current = 0; // Directed from `from` to `to`
    let powerDissipated = 0;
    let powerSupplied = 0;

    if (comp.type === 'R') {
      current = voltageDrop / comp.value;
      powerDissipated = current * voltageDrop;
      totalDissipated += powerDissipated;
    } else if (comp.type === 'I') {
      current = comp.value;
      // Current is pushed from `from` to `to`, rising by (vb - va)
      powerSupplied = comp.value * (vb - va);
      totalSupplied += powerSupplied;
    } else if (comp.type === 'V') {
      const k = vIndexMap.get(comp);
      // In MNA, x[nodeCount + k] is current entering `+` (`from`) and leaving `-` (`to`)
      current = vCurrents[k];
      powerSupplied = -comp.value * current;
      totalSupplied += powerSupplied;
    }

    if (comp.from > 0) kclResiduals[comp.from - 1] += current;
    if (comp.to > 0) kclResiduals[comp.to - 1] -= current;

    return {
      ...comp,
      voltageDrop,
      current,
      powerDissipated,
      powerSupplied
    };
  });

  const maxKclResidual = kclResiduals.reduce((m, r) => Math.max(m, Math.abs(r)), 0);
  const powerBalanceError = Math.abs(totalSupplied - totalDissipated);

  return {
    nodeCount,
    nodeVoltages,
    vCurrents,
    branches,
    totalDissipated,
    totalSupplied,
    powerBalanceError,
    kclResiduals,
    maxKclResidual,
    matrix: {
      pureNodal: numV === 0,
      G,
      B,
      i: iVec,
      e: eVec,
      A,
      b: rhs,
      solution
    }
  };
}

/**
 * Symbolic form of the MNA system in terms of circuit elements (not G/B): every matrix and
 * right-hand-side entry is a list of signed terms. kind 'invR' = 1/R, 'unit' = ±1 (voltage-source
 * incidence), 'I' = current-source value, 'V' = voltage-source value. Mirrors solveNodalCircuit's
 * stamps exactly; tests evaluate the terms and compare with the numeric matrix.
 */
export function symbolicTerms(circuit) {
  const { nodeCount, components } = validateCircuit(circuit);
  const vSources = components.filter(c => c.type === 'V');
  const dim = nodeCount + vSources.length;
  const A = Array.from({ length: dim }, () => Array.from({ length: dim }, () => []));
  const b = Array.from({ length: dim }, () => []);
  const term = (sign, kind, comp) => ({ sign, kind, id: comp.id, value: comp.value });
  let k = 0;
  for (const comp of components) {
    const a = comp.from;
    const z = comp.to;
    if (comp.type === 'R') {
      if (a > 0) A[a - 1][a - 1].push(term(1, 'invR', comp));
      if (z > 0) A[z - 1][z - 1].push(term(1, 'invR', comp));
      if (a > 0 && z > 0) {
        A[a - 1][z - 1].push(term(-1, 'invR', comp));
        A[z - 1][a - 1].push(term(-1, 'invR', comp));
      }
    } else if (comp.type === 'I') {
      if (a > 0) b[a - 1].push(term(-1, 'I', comp));
      if (z > 0) b[z - 1].push(term(1, 'I', comp));
    } else {
      const col = nodeCount + k;
      if (a > 0) { A[a - 1][col].push(term(1, 'unit', comp)); A[col][a - 1].push(term(1, 'unit', comp)); }
      if (z > 0) { A[z - 1][col].push(term(-1, 'unit', comp)); A[col][z - 1].push(term(-1, 'unit', comp)); }
      b[col].push(term(1, 'V', comp));
      k++;
    }
  }
  return { nodeCount, voltageSourceIds: vSources.map(c => c.id), A, b };
}
