import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import katex from '../assets/vendor/katex/katex.mjs';
import {
  MODULATIONS,
  bounds,
  defaults,
  presets,
  validate,
  erfc,
  qfunc,
  constellationSpec,
  theoreticalErrorRates,
  impairedTheoreticalErrorRates,
  simulate
} from '../simulators/digital-communications/digital-modulation/model.js';
import { steps } from '../simulators/digital-communications/digital-modulation/equations.js';

const near = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (tol=${tol})`);
const relNear = (a, b, tol = 1e-12) => {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-300);
  assert.ok(Math.abs(a - b) / denom <= tol, `${a} != ${b} (rel=${Math.abs(a - b) / denom} > ${tol})`);
};

function simpsonIntegral(fn, a, b, n = 400) {
  const h = (b - a) / n;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * fn(a + i * h);
  }
  return (h / 3) * sum;
}

function hamming(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++;
  return count;
}

test('Digital Modulation: erfc and Q-function match reference values and quadrature', () => {
  const refs = [
    [0, 1],
    [0.5, 0.4795001221869535],
    [1, 0.15729920705028513],
    [2, 0.004677734981047266],
    [3, 0.00002209049699858544],
    [4, 1.541725790028002e-8],
    [5, 1.537459794428035e-12]
  ];
  for (const [x, expected] of refs) {
    relNear(erfc(x), expected, 1e-13);
    near(erfc(x) + erfc(-x), 2, 1e-14);
  }
  // Independent quadrature for Q(z) = 0.5 - (1/sqrt(2*pi)) * int_0^z exp(-t^2/2) dt
  for (const z of [0.3, 1.2, 2.5, 3.8]) {
    const quad = 0.5 - simpsonIntegral(t => Math.exp(-0.5 * t * t), 0, z, 600) / Math.sqrt(2 * Math.PI);
    near(qfunc(z), quad, 1e-11);
  }
});

test('Digital Modulation: unit average symbol energy, zero centroid, d_min and Gray adjacency', () => {
  for (const mod of MODULATIONS) {
    const spec = constellationSpec(mod);
    const avgEnergy = spec.points.reduce((acc, pt) => acc + pt.i * pt.i + pt.q * pt.q, 0) / spec.M;
    near(avgEnergy, 1, 1e-14);

    const meanI = spec.points.reduce((acc, pt) => acc + pt.i, 0) / spec.M;
    const meanQ = spec.points.reduce((acc, pt) => acc + pt.q, 0) / spec.M;
    near(meanI, 0, 1e-14);
    near(meanQ, 0, 1e-14);

    let minDist = Infinity;
    for (let i = 0; i < spec.points.length; i++) {
      for (let j = i + 1; j < spec.points.length; j++) {
        const d = Math.hypot(spec.points[i].i - spec.points[j].i, spec.points[i].q - spec.points[j].q);
        if (d < minDist) minDist = d;
      }
    }
    near(minDist, spec.dMin, 1e-14);

    // Every nearest-neighbor pair must have Hamming distance = 1 (Gray coding).
    for (let i = 0; i < spec.points.length; i++) {
      for (let j = i + 1; j < spec.points.length; j++) {
        const d = Math.hypot(spec.points[i].i - spec.points[j].i, spec.points[i].q - spec.points[j].q);
        if (Math.abs(d - minDist) < 1e-11) {
          assert.equal(hamming(spec.points[i].bits, spec.points[j].bits), 1, `${mod} pair ${i}-${j}`);
        }
      }
    }
  }
});

test('Digital Modulation: BPSK/QPSK identity, Craig integral check and Cho-Yoon vs direct cell summation', () => {
  for (let db = 0; db <= 20; db += 2) {
    const bpsk = theoreticalErrorRates('BPSK', db);
    const qpsk = theoreticalErrorRates('QPSK', db);
    near(bpsk.ber, bpsk.ser, 1e-15);
    near(bpsk.ber, qpsk.ber, 1e-15);
    near(qpsk.ser, 2 * qpsk.ber - qpsk.ber ** 2, 1e-15);

    // Craig integral for M=2 and M=4 matches closed-form SER.
    const craigBpsk = simpsonIntegral(
      t => (t <= 1e-12 ? 0 : Math.exp(-(bpsk.gammaS * Math.sin(Math.PI / 2) ** 2) / Math.sin(t) ** 2)),
      0, Math.PI / 2, 512
    ) / Math.PI;
    near(craigBpsk, bpsk.ser, 1e-11);

    const craigQpsk = simpsonIntegral(
      t => (t <= 1e-12 ? 0 : Math.exp(-(qpsk.gammaS * Math.sin(Math.PI / 4) ** 2) / Math.sin(t) ** 2)),
      0, (3 * Math.PI) / 4, 512
    ) / Math.PI;
    near(craigQpsk, qpsk.ser, 1e-11);
  }

  // Cho-Yoon closed form for QPSK, 16-QAM and 64-QAM equals direct M^2 rectangular probability summation (deltaPhi -> 0).
  for (const mod of ['QPSK', '16-QAM', '64-QAM']) {
    for (const db of [2, 8, 14, 18]) {
      const closed = theoreticalErrorRates(mod, db);
      const cellSum = impairedTheoreticalErrorRates(mod, db, 1e-16);
      relNear(closed.ber, cellSum.ber, 1e-11);
      relNear(closed.ser, cellSum.ser, 1e-11);
    }
  }
});

test('Digital Modulation: carrier phase offset analytical identities', () => {
  for (const mod of MODULATIONS) {
    const base = theoreticalErrorRates(mod, 10);
    const zeroPhi = impairedTheoreticalErrorRates(mod, 10, 0);
    near(zeroPhi.ber, base.ber, 1e-15);
    near(zeroPhi.ser, base.ser, 1e-15);
  }
  const phi = 15;
  const bpskPhi = impairedTheoreticalErrorRates('BPSK', 8, phi);
  const expectedBpsk = qfunc(Math.sqrt(2 * 10 ** 0.8) * Math.cos((phi * Math.PI) / 180));
  near(bpskPhi.ber, expectedBpsk, 1e-14);
  assert.ok(bpskPhi.ber > theoreticalErrorRates('BPSK', 8).ber);
});

test('Digital Modulation: Monte Carlo consistency with analytical BER/SER (ideal and phase-impaired)', () => {
  const cases = [
    { modulation: 'BPSK', ebN0Db: 4, phaseOffsetDeg: 0 },
    { modulation: 'QPSK', ebN0Db: 6, phaseOffsetDeg: 0 },
    { modulation: '8-PSK', ebN0Db: 10, phaseOffsetDeg: 0 },
    { modulation: '16-QAM', ebN0Db: 10, phaseOffsetDeg: 0 },
    { modulation: '64-QAM', ebN0Db: 14, phaseOffsetDeg: 8 }
  ];

  for (const cfg of cases) {
    const res = simulate({ ...defaults, ...cfg, symbolCount: 20000, seed: 4242 });
    const esTol = cfg.modulation.includes('QAM') ? 0.025 : 1e-13;
    near(res.operating.measuredEs, 1, esTol);
    relNear(res.operating.measuredN0, res.n0, 0.03);

    const ref = cfg.phaseOffsetDeg === 0 ? res.theory : res.impairedTheory;
    const sigmaSer = Math.sqrt((ref.ser * (1 - ref.ser)) / res.operating.symbolCount);
    assert.ok(
      Math.abs(res.operating.ser - ref.ser) <= 4 * sigmaSer + 1e-4,
      `${cfg.modulation} SER ${res.operating.ser} vs ${ref.ser}`
    );
    if (ref.ber !== null) {
      const sigmaBer = Math.sqrt((ref.ber * (1 - ref.ber)) / res.operating.totalBits);
      assert.ok(
        Math.abs(res.operating.ber - ref.ber) <= 4.5 * sigmaBer + 1e-4,
        `${cfg.modulation} BER ${res.operating.ber} vs ${ref.ber}`
      );
    }
  }
});

test('Digital Modulation: determinism, immutability, presets and invalid input rejection', () => {
  const input = { ...defaults };
  const snapshot = JSON.stringify(input);
  const a = simulate(input);
  const b = simulate(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(a.operating.bitErrors, b.operating.bitErrors);
  assert.deepEqual(a.operating.inspector, b.operating.inspector);

  for (const preset of Object.values(presets)) {
    validate(preset);
    const out = simulate(preset);
    assert.ok(Number.isFinite(out.theory.ber));
    assert.ok(Number.isFinite(out.operating.ber));
  }

  for (const [key, [min, max]] of Object.entries(bounds)) {
    for (const bad of [NaN, Infinity, -Infinity, '5', min - 1, max + 1]) {
      assert.throws(() => simulate({ ...defaults, [key]: bad }), { name: 'RangeError', code: 'invalid' });
    }
  }
  assert.throws(() => simulate({ ...defaults, symbolCount: 100.5 }), { name: 'RangeError', code: 'invalid' });
  assert.throws(() => simulate({ ...defaults, seed: 10.2 }), { name: 'RangeError', code: 'invalid' });
  assert.throws(() => simulate({ ...defaults, modulation: '32-QAM' }), { name: 'RangeError', code: 'invalid' });
  assert.throws(() => simulate(null), { name: 'RangeError', code: 'invalid' });
});

test('Digital Modulation: local equations render in KaTeX and UI translations have complete parity', async () => {
  const base = new URL('../simulators/digital-communications/digital-modulation/', import.meta.url);
  const dictionary = JSON.parse(await readFile(new URL('locales.json', base), 'utf8'));
  const keys = Object.keys(dictionary.en).sort();
  assert.deepEqual(Object.keys(dictionary).sort(), ['en', 'es', 'pt-BR']);

  for (const lang of Object.keys(dictionary)) {
    assert.deepEqual(Object.keys(dictionary[lang]).sort(), keys);
    for (const key of keys) {
      assert.ok(dictionary[lang][key].trim(), `${lang}.${key}`);
      assert.deepEqual(
        dictionary[lang][key].match(/\{\w+\}/g),
        dictionary.en[key].match(/\{\w+\}/g),
        `${lang}.${key}`
      );
    }
  }

  for (const file of ['index.html', 'ui.js']) {
    const source = await readFile(new URL(file, base), 'utf8');
    for (const [, a, b] of source.matchAll(/data-m(?:-aria)?="([\w]+)"|\btr\('([\w]+)'/g)) {
      const key = a || b;
      assert.ok(dictionary.en[key], `${file}: missing key ${key}`);
    }
  }

  for (const group of steps) {
    for (const eq of group) {
      assert.match(katex.renderToString(eq, { throwOnError: true, trust: false, output: 'htmlAndMathml' }), /<math/);
    }
  }

  const catalog = JSON.parse(await readFile(new URL('../data/simulators.json', import.meta.url), 'utf8'));
  const entry = catalog.find(s => s.id === 'digital-modulation');
  assert.ok(entry);
  assert.equal(entry.category, 'digital-communications');
});
