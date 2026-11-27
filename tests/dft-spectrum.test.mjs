import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import katex from '../assets/vendor/katex/katex.mjs';
import {fft} from '../assets/js/core/signal.js';
import {proseParts} from '../simulators/electrical-circuits/shared/presentation.js';
import {validate, synthesize, simulate, analyze, dftTerms, spectrum, evaluateCosines, describeComponents, aliasFrequency, parseSamples, sampleTimes, wrapPhase, MAX_COMPONENTS} from '../simulators/signal-processing/dft-spectrum/model.js';
import {presets, presetOrder, defaultPreset} from '../simulators/signal-processing/dft-spectrum/presets.js';

const dir = '../simulators/signal-processing/dft-spectrum/';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ref = JSON.parse(read('./fixtures/dft-spectrum-numpy.json'));
const near = (actual, expected, tol = 1e-10, scale = 1) => assert.ok(Math.abs(actual - expected) <= tol * Math.max(scale, Math.abs(expected)), `${actual} != ${expected} (tol ${tol})`);
const base = (over = {}) => ({samples: 64, duration: 1, components: [{amplitude: 2, frequency: 5, phase: 30}], noise: 0, seed: 1, threshold: 0, ...over});

test('spectrum, threshold filter and inverse match independent NumPy references', () => {
  for (const c of ref.cases) {
    const a = analyze(c.x, c.duration, c.threshold), peak = Math.max(...a.bins.map(b => b.magnitude));
    a.F.forEach((z, k) => { near(z.re, c.re[k], 1e-11, peak); near(z.im, c.im[k], 1e-11, peak); });
    c.amplitude.forEach((v, k) => { near(a.bins[k].amplitude, v, 1e-11, peak); near(a.bins[k].frequency, c.frequency[k], 1e-12); });
    assert.deepEqual(a.components.map(x => x.k), c.kept, c.name);
    a.filtered.forEach((v, n) => near(v, c.filtered[n], 1e-10, peak / c.x.length));
  }
});

test('lesson Example 1 recovers A = 3, 1, 0.5 at k = 1, 4, 7 with sine phase −π/2', () => {
  const r = simulate(presets.example1), a = r.analysis;
  assert.deepEqual(a.components.map(c => c.k), [1, 4, 7]);
  a.components.forEach((c, i) => { near(c.amplitude, [3, 1, 0.5][i], 1e-12); near(c.phase, -Math.PI / 2, 1e-10); });
  // Full lesson view mirrors the peaks at N − k with the same 2|F_k|/N.
  for (const k of [1, 4, 7]) near(a.bins[100 - k].lessonAmplitude, a.bins[k].lessonAmplitude, 1e-12);
  r.reference.forEach((c, i) => { assert.equal(c.bin, [1, 4, 7][i]); assert.equal(c.leakage, false); assert.equal(c.aliased, false); near(c.cosinePhase, -Math.PI / 2, 1e-15); });
});

test('pure tones: amplitude, phase relation φ − 90°, DC and Nyquist normalisation', () => {
  for (const [phase, samples] of [[30, 64], [-60, 100], [90, 63], [170, 128]]) {
    const r = simulate(base({samples, components: [{amplitude: 2, frequency: 5, phase}]})), bin = r.analysis.bins[5];
    near(bin.amplitude, 2, 1e-12); near(bin.phase, wrapPhase((phase - 90) * Math.PI / 180), 1e-10);
    near(r.reference[0].cosinePhase, bin.phase, 1e-10);
  }
  const n = 64, t = sampleTimes(n, 1), x = t.map(v => 0.7 + 1.5 * Math.cos(2 * Math.PI * 32 * v));
  const a = analyze(x, 1, 0.1);
  near(a.bins[0].amplitude, 0.7, 1e-12); near(a.bins[32].amplitude, 1.5, 1e-12);
  near(a.bins[0].lessonAmplitude, 1.4, 1e-12); near(a.bins[32].lessonAmplitude, 3, 1e-12);
  assert.equal(a.bins[33].amplitude, null);
});

test('step-by-step formula equals the shared FFT for radix-2 and other lengths; partial sums reach F_k', () => {
  for (const n of [8, 64, 100, 63]) {
    const x = Array.from({length: n}, (_, i) => Math.sin(1.3 * i) + 0.1 * i), F = fft(x);
    const scale = Math.max(...F.map(z => Math.hypot(z.re, z.im)));
    for (let k = 0; k < n; k++) {
      const s = dftTerms(x, k);
      near(s.sum.re, F[k].re, 1e-11, scale); near(s.sum.im, F[k].im, 1e-11, scale);
      assert.deepEqual(s.partial.at(-1), s.sum); assert.equal(s.terms.length, n);
      near(s.terms[1].angle, -2 * Math.PI * k / n, 1e-15);
    }
  }
  assert.throws(() => dftTerms(new Array(8).fill(0), 8), RangeError);
});

test('real signals give conjugate-symmetric spectra; zero threshold reconstructs exactly', () => {
  const r = simulate(base({samples: 100, components: [{amplitude: 1, frequency: 3, phase: 10}, {amplitude: 0.4, frequency: 11.2, phase: -45}], noise: 0.3, seed: 9}));
  const {F, filtered} = r.analysis, n = F.length;
  for (let k = 1; k < n; k++) { near(F[n - k].re, F[k].re, 1e-10, 10); near(F[n - k].im, -F[k].im, 1e-10, 10); }
  filtered.forEach((v, i) => near(v, r.noisy[i], 1e-11, 1));
  assert.equal(r.analysis.components.length, n / 2 + 1);
});

test('threshold reconstruction equals the sum of kept cosines at the samples', () => {
  for (const key of ['example2', 'example4']) {
    const p = presets[key], r = simulate(p), a = r.analysis;
    const sum = evaluateCosines(a.components, r.time);
    sum.forEach((v, i) => near(v, a.filtered[i], 1e-10, 5));
    const rms = Math.sqrt(a.filtered.reduce((s, v, i) => s + (v - r.clean[i]) ** 2, 0) / p.samples);
    const noiseRms = Math.sqrt(r.noisy.reduce((s, v, i) => s + (v - r.clean[i]) ** 2, 0) / p.samples);
    assert.ok(rms < 0.35 * noiseRms, `${key}: filtering must reduce the error (${rms} vs ${noiseRms})`);
  }
});

test('lesson Example 4 detects 10, 15 and 30 Hz with amplitudes near 5, 3 and 1', () => {
  const r = simulate(presets.example4), a = r.analysis;
  assert.deepEqual(a.components.map(c => c.k), [10, 15, 30]);
  a.components.forEach((c, i) => {
    assert.ok(Math.abs(c.amplitude - [5, 3, 1][i]) < 0.25, `A_${c.k} = ${c.amplitude}`);
    assert.ok(Math.abs(wrapPhase(c.phase - r.reference[i].cosinePhase)) < 0.25, `phase ${c.k}`);
  });
});

test('leakage and aliasing are flagged and folded correctly', () => {
  const leak = simulate(presets.leakage), d = leak.reference[0];
  assert.equal(d.leakage, true); assert.equal(d.aliased, false);
  assert.ok(Math.max(...leak.analysis.bins.slice(0, 33).map(b => b.amplitude)) < 0.7);
  const alias = simulate(presets.aliasing), q = alias.reference[0];
  assert.equal(q.aliased, true); near(q.alias, 40, 1e-12); assert.equal(q.bin, 40);
  near(alias.analysis.bins[40].amplitude, 1, 1e-10);
  near(aliasFrequency(130, 100), 30, 1e-12); near(aliasFrequency(50, 100), 50, 1e-12); near(aliasFrequency(0, 100), 0, 1e-12);
  assert.equal(describeComponents([{amplitude: 0, frequency: 7, phase: 0}], 64, 1).length, 0);
});

test('noise is reproducible by seed and absent when σ = 0', () => {
  const a = synthesize(base({noise: 0.5, seed: 42})), b = synthesize(base({noise: 0.5, seed: 42})), c = synthesize(base({noise: 0.5, seed: 43}));
  assert.deepEqual(a.noisy, b.noisy); assert.notDeepEqual(a.noisy, c.noisy);
  assert.deepEqual(synthesize(base()).noisy, synthesize(base()).clean);
  const n = synthesize(base({samples: 4096, noise: 2, seed: 7})), e = n.noisy.map((v, i) => v - n.clean[i]);
  const mean = e.reduce((s, v) => s + v, 0) / e.length, sd = Math.sqrt(e.reduce((s, v) => s + (v - mean) ** 2, 0) / e.length);
  assert.ok(Math.abs(mean) < 0.1 && Math.abs(sd - 2) < 0.1, `${mean} ${sd}`);
});

test('invalid parameters are rejected', () => {
  for (const over of [{samples: 7}, {samples: 4097}, {samples: 10.5}, {duration: 0}, {duration: NaN}, {noise: -1}, {seed: 1.5}, {seed: -1}, {threshold: -0.1},
    {components: [{amplitude: -1, frequency: 1, phase: 0}]}, {components: [{amplitude: 1, frequency: -1, phase: 0}]}, {components: [{amplitude: 1, frequency: 1, phase: 400}]},
    {components: Array(MAX_COMPONENTS + 1).fill({amplitude: 1, frequency: 1, phase: 0})}, {components: [{amplitude: '1', frequency: 1, phase: 0}]}])
    assert.throws(() => validate(base(over)), RangeError, JSON.stringify(over));
  assert.throws(() => analyze([1, 2, 3], 1), RangeError);
  assert.throws(() => analyze(new Array(8).fill(Infinity), 1), RangeError);
  assert.throws(() => validate(null), TypeError);
});

test('data parser follows its documented grammar', () => {
  const one = parseSamples('# lesson amps.dat\n-7.138259011669534360e-01\n' + Array.from({length: 9}, (_, i) => String(i * 0.5)).join('\n'));
  assert.equal(one.values.length, 10); assert.equal(one.duration, null); near(one.values[0], -0.7138259011669534);
  const two = parseSamples(Array.from({length: 16}, (_, i) => `${(0.25 + i * 0.01).toFixed(2)};\t${Math.sin(i)}`).join('\r\n') + '\n\n% end');
  assert.equal(two.values.length, 16); near(two.duration, 0.16, 1e-12); near(two.values[3], Math.sin(3), 1e-15);
  const csv = parseSamples(Array.from({length: 8}, (_, i) => `${i}, ${i * 2}`).join('\n')); near(csv.duration, 8); assert.equal(csv.values[7], 14);
  assert.throws(() => parseSamples('1\n2\nabc\n4\n5\n6\n7\n8'), SyntaxError);
  assert.throws(() => parseSamples('1 2\n3\n4\n5\n6\n7\n8\n9'), SyntaxError);
  assert.throws(() => parseSamples('1 2 3\n' + '1\n'.repeat(8)), SyntaxError);
  assert.throws(() => parseSamples('1\n2\n3'), RangeError);
  assert.throws(() => parseSamples(Array.from({length: 9}, (_, i) => `${i * i} 1`).join('\n')), RangeError);
  assert.throws(() => parseSamples(Array.from({length: 9}, (_, i) => `${-i} 1`).join('\n')), RangeError);
  assert.throws(() => parseSamples('1e999\n'.repeat(8)), RangeError);
});

test('presets validate and the initial form equals the default preset within HTML limits', () => {
  const html = read(dir + 'index.html'), p = presets[defaultPreset];
  for (const key of presetOrder) { validate(presets[key]); assert.ok(html.includes(`value="${key}"`), key); }
  const attr = (id, name) => { const m = html.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`)); assert.ok(m, id); return m[0].match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]; };
  const expected = {samples: p.samples, duration: p.duration, noise: p.noise, seed: p.seed, threshold: p.threshold, maxFrequency: p.maxFrequency};
  for (let i = 0; i < MAX_COMPONENTS; i++) { const c = p.components[i] ?? {amplitude: 0, frequency: 0, phase: 0}; Object.assign(expected, {['a' + (i + 1)]: c.amplitude, ['f' + (i + 1)]: c.frequency, ['p' + (i + 1)]: c.phase}); }
  for (const [id, value] of Object.entries(expected)) {
    assert.equal(Number(attr(id, 'value')), value, id);
    assert.ok(value >= Number(attr(id, 'min')) && value <= Number(attr(id, 'max')), `${id} limits`);
  }
  for (const key of presetOrder) for (const c of presets[key].components) assert.ok(c.amplitude <= 1000 && c.frequency <= 1e6 && Math.abs(c.phase) <= 360);
});

test('three locales share keys and placeholders, and every used key exists', () => {
  const dictionary = JSON.parse(read(dir + 'locales.json')), en = dictionary.en;
  assert.deepEqual(Object.keys(dictionary).sort(), ['en', 'es', 'pt-BR']);
  for (const code of ['pt-BR', 'es']) {
    assert.deepEqual(Object.keys(dictionary[code]).sort(), Object.keys(en).sort(), code);
    for (const key of Object.keys(en)) {
      assert.ok(dictionary[code][key].trim(), `${code}/${key}`);
      assert.deepEqual((dictionary[code][key].match(/\{\w+\}/g) || []).sort(), (en[key].match(/\{\w+\}/g) || []).sort(), `${code}/${key}`);
    }
  }
  const html = read(dir + 'index.html'), ui = read(dir + 'ui.js');
  const used = new Set([...html.matchAll(/data-m="(\w+)"/g), ...ui.matchAll(/\btr\('(\w+)'/g)].map(m => m[1]).filter(key => !key.endsWith('_')));
  for (const key of [...presetOrder, 'custom']) used.add('presetNote_' + key);
  for (const key of ['noData', 'inputError', 'keptYes', 'keptNo', 'observed', 'observedAlias', 'observedLeakage', 'dataParseError', 'dataColumnsError', 'dataLengthError', 'dataSpacingError']) used.add(key);
  for (const key of used) assert.ok(key in en, `missing ${key}`);
});

test('all LaTeX sources render with KaTeX without errors', () => {
  const render = source => katex.renderToString(source, {throwOnError: true, displayMode: true, trust: false});
  const html = read(dir + 'index.html');
  for (const m of html.matchAll(/data-tex="([^"]+)"/g)) render(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<"));
  const dictionary = JSON.parse(read(dir + 'locales.json'));
  for (const messages of Object.values(dictionary)) for (const value of Object.values(messages)) for (const part of proseParts(value)) if (part.latex) render(part.latex);
});

test('spectrum helper zeroes the phase of numerically empty bins', () => {
  const s = spectrum([{re: 4, im: 0}, {re: 1e-14, im: 1e-14}, {re: 0, im: -2}, {re: 1e-14, im: -1e-14}], 1);
  assert.equal(s.bins[1].phase, 0); near(s.bins[2].phase, -Math.PI / 2, 1e-15); near(s.sampleRate, 4); near(s.nyquist, 2);
});
