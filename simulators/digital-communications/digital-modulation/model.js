/**
 * M-ary digital modulation over memoryless baseband AWGN channel.
 *
 * Conventions and normalizations:
 * - Unit average symbol energy: E_s = (1/M) sum |s_m|^2 = 1.
 * - Energy per bit: E_b = E_s / k, where k = log2(M) bits/symbol.
 * - Complex baseband AWGN: n = n_I + j n_Q with n_I, n_Q ~ N(0, sigma^2),
 *   sigma^2 = N_0 / 2 = E_s / (2 * k * 10^(EbN0_dB / 10)), so E[|n|^2] = N_0.
 * - Carrier phase offset DeltaPhi (deg) rotates the transmitted symbol counter-clockwise
 *   prior to AWGN addition; the receiver uses ideal coherent ML boundaries (DeltaPhi = 0).
 * - Pure ES module with deterministic seeded Mulberry32 PRNG and Box-Muller Gaussian samples.
 */

export const MODULATIONS = Object.freeze(['BPSK', 'QPSK', '8-PSK', '16-QAM', '64-QAM']);

export const bounds = Object.freeze({
  ebN0Db: [0, 24],
  symbolCount: [100, 20000],
  phaseOffsetDeg: [-45, 45],
  seed: [1, 2147483647]
});

export const defaults = Object.freeze({
  modulation: 'QPSK',
  ebN0Db: 8,
  symbolCount: 2000,
  phaseOffsetDeg: 0,
  seed: 2026
});

export const presets = Object.freeze({
  qpsk: { ...defaults },
  bpsk: { ...defaults, modulation: 'BPSK', ebN0Db: 4 },
  qam16: { ...defaults, modulation: '16-QAM', ebN0Db: 12 },
  qam64Phase: { ...defaults, modulation: '64-QAM', ebN0Db: 18, phaseOffsetDeg: 8 }
});

export const SWEEP_EBN0_DB = Object.freeze([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
const MAX_SCATTER_POINTS = 2000;
const INSPECTOR_COUNT = 12;

function fail(code) {
  const error = new RangeError(code);
  error.code = code;
  return error;
}

/**
 * Validates simulation parameters without mutating the input object.
 * @param {object} input
 */
export function validate(input) {
  if (!input || typeof input !== 'object') throw fail('invalid');
  if (!MODULATIONS.includes(input.modulation)) throw fail('invalid');
  const p = { modulation: input.modulation };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw fail('invalid');
    }
    if ((key === 'symbolCount' || key === 'seed') && !Number.isInteger(value)) {
      throw fail('invalid');
    }
    p[key] = value;
  }
  return p;
}

/**
 * Complementary error function erfc(x) with ~1e-15 relative accuracy (Cody 1969).
 * @param {number} x
 * @returns {number}
 */
export function erfc(x) {
  if (!Number.isFinite(x)) {
    if (x === Infinity) return 0;
    if (x === -Infinity) return 2;
    return NaN;
  }
  if (x < 0) return 2 - erfc(-x);
  if (x === 0) return 1;
  if (x > 27) return 0;

  // Rational Chebyshev approximations from Cody (1969), Math. Comp. 23, 631-637.
  if (x < 0.46875) {
    const a = [
      3.16112374387056560e0, 1.13864154151050156e2, 3.77485237685302021e2,
      3.20937758913846947e3, 1.85777706184603153e-1
    ];
    const b = [
      2.36012909523441209e1, 2.44024637934444173e2, 1.28261652607737228e3,
      2.84423683343917062e3
    ];
    const y = x * x;
    const xnum = (((a[4] * y + a[0]) * y + a[1]) * y + a[2]) * y + a[3];
    const xden = (((y + b[0]) * y + b[1]) * y + b[2]) * y + b[3];
    return 1 - (x * xnum) / xden;
  }

  if (x <= 4.0) {
    const c = [
      5.64188496988670089e-1, 8.88314979438837594e0, 6.61191906371416295e1,
      2.98635138197400131e2, 8.81952221241769090e2, 1.71204761263407058e3,
      2.05107837782607147e3, 1.23033935479799725e3, 2.15311535474403846e-8
    ];
    const d = [
      1.57449261107098347e1, 1.17693950891312499e2, 5.37181101862009858e2,
      1.62138957456669019e3, 3.29079923573345963e3, 4.36261909014324716e3,
      3.43936767414372164e3, 1.23033935480374942e3
    ];
    let xnum = c[8] * x;
    let xden = x;
    for (let i = 0; i < 7; i++) {
      xnum = (xnum + c[i]) * x;
      xden = (xden + d[i]) * x;
    }
    const res = (xnum + c[7]) / (xden + d[7]);
    const ysq = Math.trunc(x * 16) / 16;
    const del = (x - ysq) * (x + ysq);
    return Math.exp(-ysq * ysq) * Math.exp(-del) * res;
  }

  const p = [
    3.05326634961232344e-1, 3.60344899949804439e-1, 1.25781726111229246e-1,
    1.60837851487422766e-2, 6.58749161529837803e-4, 1.63153871373020978e-2
  ];
  const q = [
    2.56852019228982232e0, 1.87295284992346047e0, 5.27905102951428412e-1,
    6.05183413124413191e-2, 2.33520497626869185e-3
  ];
  const y = 1 / (x * x);
  let xnum = p[5] * y;
  let xden = y;
  for (let i = 0; i < 4; i++) {
    xnum = (xnum + p[i]) * y;
    xden = (xden + q[i]) * y;
  }
  const res = (y * (xnum + p[4])) / (xden + q[4]);
  const corr = (1 / Math.sqrt(Math.PI) - res) / x;
  const ysq = Math.trunc(x * 16) / 16;
  const del = (x - ysq) * (x + ysq);
  return Math.exp(-ysq * ysq) * Math.exp(-del) * corr;
}

/**
 * Gaussian Q-function Q(z) = P(Z > z) for Z ~ N(0, 1).
 * @param {number} z
 * @returns {number}
 */
export function qfunc(z) {
  return 0.5 * erfc(z / Math.SQRT2);
}

/**
 * Probability P(a < Z <= b) for Z ~ N(0, 1) without catastrophic cancellation in tails.
 */
function normalInterval(a, b) {
  if (a >= b) return 0;
  if (a >= 0) return qfunc(a) - (b === Infinity ? 0 : qfunc(b));
  if (b <= 0) return qfunc(-b) - (a === -Infinity ? 0 : qfunc(-a));
  return 1 - (a === -Infinity ? 0 : qfunc(-a)) - (b === Infinity ? 0 : qfunc(b));
}

function toBits(value, width) {
  return value.toString(2).padStart(width, '0');
}

function grayEncode(n) {
  return n ^ (n >> 1);
}

function hammingDistance(a, b) {
  let x = a ^ b, count = 0;
  while (x > 0) {
    count += x & 1;
    x >>= 1;
  }
  return count;
}

/**
 * Returns normalized constellation specification (E_s = 1) for a modulation scheme.
 * @param {string} modulation
 */
export function constellationSpec(modulation) {
  if (!MODULATIONS.includes(modulation)) throw fail('invalid');
  if (modulation === 'BPSK') {
    const points = [
      { index: 0, gray: 0, bits: '0', i: 1, q: 0 },
      { index: 1, gray: 1, bits: '1', i: -1, q: 0 }
    ];
    return {
      modulation, family: 'psk', M: 2, k: 1, dMin: 2, spectralEfficiency: 1,
      pamLevels: null, scale: 1, points
    };
  }
  if (modulation === 'QPSK') {
    const a = Math.SQRT1_2;
    const points = [
      { index: 0, gray: 0, bits: '00', i: a, q: a },
      { index: 1, gray: 1, bits: '01', i: -a, q: a },
      { index: 2, gray: 3, bits: '11', i: -a, q: -a },
      { index: 3, gray: 2, bits: '10', i: a, q: -a }
    ];
    return {
      modulation, family: 'psk', M: 4, k: 2, dMin: Math.SQRT2, spectralEfficiency: 2,
      pamLevels: 2, scale: a, points
    };
  }
  if (modulation === '8-PSK') {
    const M = 8, k = 3;
    const points = Array.from({ length: M }, (_, m) => {
      const gray = grayEncode(m);
      const angle = (2 * Math.PI * m) / M;
      return {
        index: m,
        gray,
        bits: toBits(gray, k),
        i: Math.cos(angle),
        q: Math.sin(angle)
      };
    });
    return {
      modulation, family: 'psk', M, k,
      dMin: 2 * Math.sin(Math.PI / M),
      spectralEfficiency: k,
      pamLevels: null, scale: 1, points
    };
  }

  // Square M-QAM (16-QAM, 64-QAM) with separable L-PAM Gray mapping.
  const M = modulation === '16-QAM' ? 16 : 64;
  const k = modulation === '16-QAM' ? 4 : 6;
  const L = Math.sqrt(M);
  const mBits = k / 2;
  const scale = Math.sqrt(3 / (2 * (M - 1)));
  const points = [];
  for (let iy = 0; iy < L; iy++) {
    const gq = grayEncode(iy);
    const q = (2 * iy - (L - 1)) * scale;
    for (let ix = 0; ix < L; ix++) {
      const gi = grayEncode(ix);
      const i = (2 * ix - (L - 1)) * scale;
      const index = iy * L + ix;
      const gray = (gi << mBits) | gq;
      points.push({
        index,
        gray,
        bits: toBits(gi, mBits) + toBits(gq, mBits),
        i,
        q,
        ix,
        iy
      });
    }
  }
  return {
    modulation, family: 'qam', M, k,
    dMin: 2 * scale,
    spectralEfficiency: k,
    pamLevels: L,
    scale,
    points
  };
}

/**
 * Computes Craig's exact M-PSK SER integral over [0, pi - psi]:
 * (1/pi) * int_0^(pi - psi) exp(-gamma_s * sin^2(psi) / sin^2(theta)) dtheta
 * using composite Simpson's rule (256 subintervals). Smooth integrand vanishes at theta -> 0.
 */
function craigWedgeIntegral(gammaS, psi) {
  if (psi <= 0) return 0.5;
  if (psi >= Math.PI) return 0;
  const b = Math.PI - psi;
  const n = 512;
  const h = b / n;
  const c = gammaS * Math.sin(psi) ** 2;
  const f = theta => {
    if (theta <= 1e-12) return 0;
    const s = Math.sin(theta);
    return Math.exp(-c / (s * s));
  };
  let sum = f(0) + f(b);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(i * h);
  }
  return ((h / 3) * sum) / Math.PI;
}

/**
 * Exact theoretical BER and SER over an ideal coherent AWGN channel (DeltaPhi = 0).
 * @param {string} modulation
 * @param {number} ebN0Db
 * @returns {{ser: number, ber: number, gammaB: number, gammaS: number}}
 */
export function theoreticalErrorRates(modulation, ebN0Db) {
  const spec = constellationSpec(modulation);
  const gammaB = 10 ** (ebN0Db / 10);
  const gammaS = spec.k * gammaB;

  if (modulation === 'BPSK') {
    const p = qfunc(Math.sqrt(2 * gammaB));
    return { ser: p, ber: p, gammaB, gammaS };
  }
  if (modulation === 'QPSK') {
    const p = qfunc(Math.sqrt(2 * gammaB));
    return { ser: 2 * p - p * p, ber: p, gammaB, gammaS };
  }
  if (modulation === '8-PSK') {
    const ser = craigWedgeIntegral(gammaS, Math.PI / 8);
    // Exact Gray-coded 8-PSK BER (Irshid & Salous / Lee).
    const p1 = qfunc(Math.sqrt(2 * gammaS) * Math.sin(Math.PI / 8));
    const p2 = qfunc(Math.sqrt(2 * gammaS) * Math.sin((3 * Math.PI) / 8));
    const ber = (2 / 3) * (p1 + p2 - p1 * p2);
    return { ser, ber, gammaB, gammaS };
  }

  // Square M-QAM (16-QAM, 64-QAM): exact SER and Cho & Yoon (2002) exact Gray BER.
  const M = spec.M;
  const L = spec.pamLevels;
  const m = spec.k / 2;
  const alpha = Math.sqrt((3 * gammaS) / (M - 1));
  const pPam = 2 * (1 - 1 / L) * qfunc(alpha);
  const ser = 2 * pPam - pPam * pPam;

  let berSum = 0;
  for (let j = 1; j <= m; j++) {
    const step = 2 ** (j - 1);
    const limit = Math.round((1 - 2 ** -j) * L) - 1;
    let pbj = 0;
    for (let i = 0; i <= limit; i++) {
      const sign = Math.floor((i * step) / L) % 2 === 0 ? 1 : -1;
      const weight = step - Math.floor((i * step) / L + 0.5);
      pbj += sign * weight * 2 * qfunc((2 * i + 1) * alpha);
    }
    berSum += pbj / L;
  }
  return { ser, ber: berSum / m, gammaB, gammaS };
}

/**
 * Exact analytical SER and BER under a constant carrier phase offset DeltaPhi (deg).
 * Available in closed rectangular Gaussian form for BPSK, QPSK, 16-QAM, 64-QAM,
 * and Craig wedge form for 8-PSK SER (when |DeltaPhi| < 22.5 deg).
 */
export function impairedTheoreticalErrorRates(modulation, ebN0Db, phaseOffsetDeg) {
  if (phaseOffsetDeg === 0) return theoreticalErrorRates(modulation, ebN0Db);
  const spec = constellationSpec(modulation);
  const gammaB = 10 ** (ebN0Db / 10);
  const gammaS = spec.k * gammaB;
  const sigma = 1 / Math.sqrt(2 * gammaS);
  const phi = (phaseOffsetDeg * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);

  if (modulation === 'BPSK') {
    const ser = qfunc(cosP / sigma);
    return { ser, ber: ser, gammaB, gammaS };
  }

  if (modulation === 'QPSK' || modulation === '16-QAM' || modulation === '64-QAM') {
    const L = spec.pamLevels;
    const scale = spec.scale;
    const edges = [-Infinity];
    for (let idx = 0; idx < L - 1; idx++) {
      edges.push((2 * idx - L + 2) * scale);
    }
    edges.push(Infinity);

    let totalSer = 0;
    let totalBer = 0;
    for (const tx of spec.points) {
      const rxMeanI = tx.i * cosP - tx.q * sinP;
      const rxMeanQ = tx.i * sinP + tx.q * cosP;
      const px = [];
      const py = [];
      for (let ix = 0; ix < L; ix++) {
        px.push(normalInterval((edges[ix] - rxMeanI) / sigma, (edges[ix + 1] - rxMeanI) / sigma));
      }
      for (let iy = 0; iy < L; iy++) {
        py.push(normalInterval((edges[iy] - rxMeanQ) / sigma, (edges[iy + 1] - rxMeanQ) / sigma));
      }
      for (const rx of spec.points) {
        const prob = px[rx.ix ?? (rx.i < 0 ? 0 : 1)] * py[rx.iy ?? (rx.q < 0 ? 0 : 1)];
        if (rx.index !== tx.index) {
          totalSer += prob;
          totalBer += prob * (hammingDistance(tx.gray, rx.gray) / spec.k);
        }
      }
    }
    return { ser: totalSer / spec.M, ber: totalBer / spec.M, gammaB, gammaS };
  }

  // 8-PSK with phase offset: exact SER via asymmetric Craig wedges when |phi| < pi/8.
  if (Math.abs(phi) < Math.PI / 8) {
    const ser = 0.5 * (craigWedgeIntegral(gammaS, Math.PI / 8 - phi) + craigWedgeIntegral(gammaS, Math.PI / 8 + phi));
    return { ser, ber: null, gammaB, gammaS };
  }
  return { ser: null, ber: null, gammaB, gammaS };
}

/**
 * Deterministic 32-bit PRNG (Mulberry32).
 */
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fast ML symbol detector using exact constellation decision regions.
 */
function detectSymbol(spec, rI, rQ) {
  if (spec.modulation === 'BPSK') {
    return rI >= 0 ? 0 : 1;
  }
  if (spec.modulation === 'QPSK') {
    if (rI >= 0 && rQ >= 0) return 0;
    if (rI < 0 && rQ >= 0) return 1;
    if (rI < 0 && rQ < 0) return 2;
    return 3;
  }
  if (spec.modulation === '8-PSK') {
    let angle = Math.atan2(rQ, rI);
    if (angle < 0) angle += 2 * Math.PI;
    return Math.round(angle / (Math.PI / 4)) % 8;
  }
  // Square M-QAM separable slicing.
  const L = spec.pamLevels;
  const invStep = 1 / (2 * spec.scale);
  const offset = (L - 1) / 2;
  const ix = Math.max(0, Math.min(L - 1, Math.round(rI * invStep + offset)));
  const iy = Math.max(0, Math.min(L - 1, Math.round(rQ * invStep + offset)));
  return iy * L + ix;
}

/**
 * Runs a single Monte Carlo block at fixed Eb/N0 and phase offset.
 */
function runBlock(spec, ebN0Db, symbolCount, phaseOffsetDeg, seed, collectDetails) {
  const gammaB = 10 ** (ebN0Db / 10);
  const gammaS = spec.k * gammaB;
  const sigma = 1 / Math.sqrt(2 * gammaS);
  const phi = (phaseOffsetDeg * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const rng = createRng(seed);
  const M = spec.M;
  const points = spec.points;

  let symbolErrors = 0;
  let bitErrors = 0;
  let totalNoiseSq = 0;
  let totalTxSq = 0;
  const scatter = collectDetails ? [] : null;
  const inspector = collectDetails ? [] : null;

  for (let n = 0; n < symbolCount; n += 2) {
    const u1 = Math.max(rng(), 1e-15);
    const u2 = rng();
    const u3 = Math.max(rng(), 1e-15);
    const u4 = rng();
    const r1 = Math.sqrt(-2 * Math.log(u1));
    const t1 = 2 * Math.PI * u2;
    const r2 = Math.sqrt(-2 * Math.log(u3));
    const t2 = 2 * Math.PI * u4;
    const gauss = [
      [r1 * Math.cos(t1) * sigma, r1 * Math.sin(t1) * sigma],
      [r2 * Math.cos(t2) * sigma, r2 * Math.sin(t2) * sigma]
    ];

    const pairCount = Math.min(2, symbolCount - n);
    for (let j = 0; j < pairCount; j++) {
      const symIdx = Math.floor(rng() * M);
      const tx = points[symIdx];
      const rotI = tx.i * cosP - tx.q * sinP;
      const rotQ = tx.i * sinP + tx.q * cosP;
      const nI = gauss[j][0], nQ = gauss[j][1];
      const rI = rotI + nI, rQ = rotQ + nQ;

      totalTxSq += tx.i * tx.i + tx.q * tx.q;
      totalNoiseSq += nI * nI + nQ * nQ;

      const rxIdx = detectSymbol(spec, rI, rQ);
      const rx = points[rxIdx];
      const isSymErr = rxIdx !== symIdx;
      const nBitErr = isSymErr ? hammingDistance(tx.gray, rx.gray) : 0;
      if (isSymErr) symbolErrors++;
      bitErrors += nBitErr;

      const globalIdx = n + j;
      if (collectDetails && globalIdx < MAX_SCATTER_POINTS) {
        scatter.push({
          index: globalIdx,
          txIndex: symIdx,
          rxIndex: rxIdx,
          i: rI,
          q: rQ,
          error: isSymErr
        });
      }
      if (collectDetails && globalIdx < INSPECTOR_COUNT) {
        inspector.push({
          index: globalIdx,
          txBits: tx.bits,
          txIndex: symIdx,
          txPoint: { i: tx.i, q: tx.q },
          rotatedPoint: { i: rotI, q: rotQ },
          rxPoint: { i: rI, q: rQ },
          rxIndex: rxIdx,
          rxBits: rx.bits,
          symbolError: isSymErr,
          bitErrors: nBitErr
        });
      }
    }
  }

  const totalBits = symbolCount * spec.k;
  return {
    symbolCount,
    totalBits,
    symbolErrors,
    bitErrors,
    ser: symbolErrors / symbolCount,
    ber: bitErrors / totalBits,
    measuredEs: totalTxSq / symbolCount,
    measuredN0: totalNoiseSq / symbolCount,
    sigma,
    scatter,
    inspector
  };
}

/**
 * Full simulation for UI and analytical comparison.
 * @param {object} [input=defaults]
 */
export function simulate(input = defaults) {
  const p = validate(input);
  const spec = constellationSpec(p.modulation);
  const theory = theoreticalErrorRates(p.modulation, p.ebN0Db);
  const impairedTheory = impairedTheoreticalErrorRates(p.modulation, p.ebN0Db, p.phaseOffsetDeg);
  const operating = runBlock(spec, p.ebN0Db, p.symbolCount, p.phaseOffsetDeg, p.seed, true);

  // Compute smooth theoretical curve (0..24 dB in 0.5 dB steps) and Monte Carlo sweep points.
  const theoryCurve = [];
  for (let db = 0; db <= 24 + 1e-9; db += 0.5) {
    const val = Math.round(db * 10) / 10;
    const t = theoreticalErrorRates(p.modulation, val);
    const imp = p.phaseOffsetDeg === 0 ? t : impairedTheoreticalErrorRates(p.modulation, val, p.phaseOffsetDeg);
    theoryCurve.push({
      ebN0Db: val,
      ser: t.ser,
      ber: t.ber,
      impairedSer: imp.ser,
      impairedBer: imp.ber
    });
  }

  const sweep = SWEEP_EBN0_DB.map((db, idx) => {
    const mc = runBlock(spec, db, p.symbolCount, p.phaseOffsetDeg, (p.seed + (idx + 1) * 9973) % 2147483647, false);
    const t = theoreticalErrorRates(p.modulation, db);
    return {
      ebN0Db: db,
      mcBer: mc.ber,
      mcSer: mc.ser,
      bitErrors: mc.bitErrors,
      symbolErrors: mc.symbolErrors,
      totalBits: mc.totalBits,
      symbolCount: mc.symbolCount,
      theoryBer: t.ber,
      theorySer: t.ser
    };
  });

  // Reference curves for comparison across modulations.
  const comparisons = Object.fromEntries(
    MODULATIONS.map(mod => [
      mod,
      SWEEP_EBN0_DB.map(db => ({ ebN0Db: db, ...theoreticalErrorRates(mod, db) }))
    ])
  );

  return {
    p,
    spec,
    ebN0Linear: theory.gammaB,
    esN0Db: p.ebN0Db + 10 * Math.log10(spec.k),
    esN0Linear: theory.gammaS,
    sigma: operating.sigma,
    n0: 2 * operating.sigma * operating.sigma,
    theory,
    impairedTheory,
    operating,
    theoryCurve,
    sweep,
    comparisons
  };
}
