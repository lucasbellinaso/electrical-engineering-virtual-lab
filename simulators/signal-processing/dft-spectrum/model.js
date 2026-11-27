/**
 * Discrete Fourier transform laboratory: pure model, no DOM.
 *
 * Conventions (see docs/DFT-SPECTRUM.md):
 *  - N samples over a window of T seconds, t_n = nT/N, n = 0 … N−1 (no endpoint).
 *  - F_k = Σ_n x_n e^{−i2πkn/N}; bin k corresponds to f_k = k/T (Hz); f_s = N/T.
 *  - Synthetic components are x_i(t) = A_i sin(2π f_i t + φ_i), φ_i in degrees.
 *  - One-sided amplitude: A_0 = |F_0|/N, A_k = 2|F_k|/N (0 < k < N/2), A_{N/2} = |F_{N/2}|/N.
 *  - Detected phase arg(F_k) is the phase of the cosine A_k cos(2π f_k t + arg F_k).
 */
import {fft, ifft} from '../../../assets/js/core/signal.js';
import {createRandom} from '../../../assets/js/core/random.js';

export const MAX_COMPONENTS = 4;
export const MAX_SAMPLES = 4096;
export const MIN_SAMPLES = 8;
export const limits = Object.freeze({
  samples: [MIN_SAMPLES, MAX_SAMPLES],
  duration: [1e-3, 1e3],
  amplitude: [0, 1e3],
  frequency: [0, 1e6],
  phase: [-360, 360],
  noise: [0, 1e3],
  seed: [0, 0xffffffff],
  threshold: [0, 1e6]
});

const finite = value => typeof value === 'number' && Number.isFinite(value);
function inRange(value, key, name = key) {
  const [min, max] = limits[key];
  if (!finite(value) || value < min || value > max) throw new RangeError(`Invalid ${name}`);
  return value;
}

/** Validate synthetic-signal parameters; returns a normalized copy. */
export function validate(p) {
  if (!p || typeof p !== 'object') throw new TypeError('Parameters must be an object');
  const samples = inRange(p.samples, 'samples');
  if (!Number.isInteger(samples)) throw new RangeError('Invalid samples');
  const duration = inRange(p.duration, 'duration');
  if (!Array.isArray(p.components) || p.components.length > MAX_COMPONENTS) throw new RangeError('Invalid components');
  const components = p.components.map((c, i) => ({
    amplitude: inRange(c?.amplitude, 'amplitude', `amplitude ${i + 1}`),
    frequency: inRange(c?.frequency, 'frequency', `frequency ${i + 1}`),
    phase: inRange(c?.phase, 'phase', `phase ${i + 1}`)
  }));
  const noise = inRange(p.noise ?? 0, 'noise');
  const seed = inRange(p.seed ?? 1, 'seed');
  if (!Number.isInteger(seed)) throw new RangeError('Invalid seed');
  const threshold = inRange(p.threshold ?? 0, 'threshold');
  return {samples, duration, components, noise, seed, threshold};
}

/** Sample instants t_n = nT/N (endpoint excluded, as numpy.linspace(..., endpoint=False)). */
export function sampleTimes(samples, duration) {
  return Array.from({length: samples}, (_, n) => n * duration / samples);
}

const degrees = radians => radians * 180 / Math.PI;
const radians = deg => deg * Math.PI / 180;
/** Wrap an angle in radians to (−π, π]. */
export function wrapPhase(angle) {
  let a = angle % (2 * Math.PI);
  if (a <= -Math.PI) a += 2 * Math.PI;
  if (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/** Sum of A sin(2π f t + φ) components (φ in degrees) at the instants t. */
export function evaluateSines(components, times) {
  return times.map(t => components.reduce((sum, c) => sum + c.amplitude * Math.sin(2 * Math.PI * c.frequency * t + radians(c.phase)), 0));
}

/** Sum of A cos(2π f t + φ) components (φ in radians) at the instants t: DFT synthesis form. */
export function evaluateCosines(components, times) {
  return times.map(t => components.reduce((sum, c) => sum + c.amplitude * Math.cos(2 * Math.PI * c.frequency * t + c.phase), 0));
}

/** Clean and noisy synthetic signals; noise is Gaussian, σ = noise, reproducible by seed. */
export function synthesize(parameters) {
  const p = validate(parameters);
  const time = sampleTimes(p.samples, p.duration);
  const clean = evaluateSines(p.components, time);
  const random = createRandom(p.seed);
  const noisy = p.noise > 0 ? clean.map(v => v + random.normal(0, p.noise)) : clean.slice();
  return {parameters: p, time, clean, noisy};
}

function checkSignal(x) {
  if (!Array.isArray(x) || x.length < MIN_SAMPLES || x.length > MAX_SAMPLES) throw new RangeError('Invalid signal length');
  for (const v of x) if (!finite(v)) throw new RangeError('Signal values must be finite');
}

/** Largest index of the one-sided spectrum: ⌊N/2⌋. */
export const halfLength = n => Math.floor(n / 2);

/**
 * Amplitude and phase spectra.
 * lessonAmplitude = 2|F_k|/N for every k (normalization of the lesson's full plots);
 * amplitude = one-sided amplitude (k ≤ ⌊N/2⌋) with the DC/Nyquist correction.
 * phase = arg F_k, set to 0 when |F_k| ≤ 1e−9·max|F| (numerical zero).
 */
export function spectrum(F, duration) {
  const n = F.length, magnitude = F.map(z => Math.hypot(z.re, z.im)), peak = Math.max(...magnitude, 0);
  const floor = 1e-9 * peak;
  const bins = F.map((z, k) => {
    const mag = magnitude[k], edge = k === 0 || (n % 2 === 0 && k === n / 2);
    return {
      k,
      frequency: k / duration,
      re: z.re,
      im: z.im,
      magnitude: mag,
      lessonAmplitude: 2 * mag / n,
      amplitude: k <= halfLength(n) ? (edge ? 1 : 2) * mag / n : null,
      phase: mag > floor ? Math.atan2(z.im, z.re) : 0
    };
  });
  return {bins, sampleRate: n / duration, resolution: 1 / duration, nyquist: n / duration / 2};
}

/** Keep bins whose one-sided amplitude is ≥ threshold (and their mirror N−k); zero the rest. */
export function thresholdFilter(F, bins, threshold) {
  if (!finite(threshold) || threshold < 0) throw new RangeError('Invalid threshold');
  const n = F.length, keep = new Array(n).fill(false);
  for (let k = 0; k <= halfLength(n); k++) if (bins[k].amplitude >= threshold) { keep[k] = true; keep[(n - k) % n] = true; }
  return {keep, filtered: F.map((z, k) => keep[k] ? {re: z.re, im: z.im} : {re: 0, im: 0})};
}

/** Real part of the inverse DFT (the imaginary part is round-off for a Hermitian spectrum). */
export function inverseReal(F) {
  return ifft(F).map(z => z.re);
}

/** Components A_k cos(2π f_k t + φ_k) of the kept one-sided bins, sorted by k. */
export function detectedComponents(bins, keep) {
  const n = bins.length, result = [];
  for (let k = 0; k <= halfLength(n); k++) if (keep[k]) result.push({k, frequency: bins[k].frequency, amplitude: bins[k].amplitude, phase: bins[k].phase});
  return result;
}

/** Apparent frequency of a real tone f after sampling at fs (folding into [0, fs/2]). */
export function aliasFrequency(frequency, sampleRate) {
  const r = ((frequency % sampleRate) + sampleRate) % sampleRate;
  return Math.min(r, sampleRate - r);
}

/** Reference description of each true component: cosine phase, bin, leakage and aliasing flags. */
export function describeComponents(components, samples, duration) {
  const fs = samples / duration;
  return components.filter(c => c.amplitude > 0).map(c => {
    const alias = aliasFrequency(c.frequency, fs), cycles = alias * duration, bin = Math.round(cycles);
    return {
      ...c,
      cosinePhase: wrapPhase(radians(c.phase) - Math.PI / 2),
      alias,
      aliased: Math.abs(alias - c.frequency) > 1e-9 * Math.max(1, c.frequency),
      bin,
      leakage: Math.abs(cycles - bin) > 1e-9 * Math.max(1, cycles)
    };
  });
}

/** Full analysis of a real signal x sampled over duration T with a threshold filter. */
export function analyze(x, duration, threshold = 0) {
  checkSignal(x);
  inRange(duration, 'duration');
  inRange(threshold, 'threshold');
  const F = fft(x), spec = spectrum(F, duration), {keep, filtered} = thresholdFilter(F, spec.bins, threshold);
  const components = detectedComponents(spec.bins, keep);
  return {...spec, F, keep, filtered: inverseReal(filtered), components, threshold, duration, samples: x.length};
}

/** Synthetic experiment: synthesis followed by the analysis of the noisy signal. */
export function simulate(parameters) {
  const signal = synthesize(parameters), p = signal.parameters;
  const analysis = analyze(signal.noisy, p.duration, p.threshold);
  return {...signal, analysis, reference: describeComponents(p.components, p.samples, p.duration)};
}

/**
 * Parse sample data. Grammar (independent of the interface language):
 *   - one sample per line; blank lines and lines starting with # or % are ignored;
 *   - a line holds one value x or two values t x, separated by spaces, tabs, ',' or ';';
 *   - numbers use '.' as decimal separator and may use exponents (1.5e-3);
 *   - all lines must have the same number of columns; with two columns, t must be
 *     uniformly spaced and increasing, and T = N·Δt.
 * Returns {values, duration|null}.
 */
export function parseSamples(text) {
  if (typeof text !== 'string') throw new TypeError('Text expected');
  const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('%')) continue;
    const tokens = line.split(/[\s,;]+/).filter(Boolean);
    if (tokens.length < 1 || tokens.length > 2 || !tokens.every(s => numberPattern.test(s))) throw new SyntaxError('parse');
    rows.push(tokens.map(Number));
  }
  if (rows.length < MIN_SAMPLES || rows.length > MAX_SAMPLES) throw new RangeError('length');
  const columns = rows[0].length;
  if (!rows.every(r => r.length === columns)) throw new SyntaxError('columns');
  if (!rows.flat().every(finite)) throw new RangeError('finite');
  if (columns === 1) return {values: rows.map(r => r[0]), duration: null};
  const times = rows.map(r => r[0]), dt = (times.at(-1) - times[0]) / (times.length - 1);
  if (!(dt > 0)) throw new RangeError('spacing');
  for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - times[i - 1] - dt) > 1e-6 * dt + 1e-12 * Math.abs(times[i])) throw new RangeError('spacing');
  return {values: rows.map(r => r[1]), duration: dt * times.length};
}

export const internals = Object.freeze({degrees, radians});
