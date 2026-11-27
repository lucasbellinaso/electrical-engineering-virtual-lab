/**
 * Experiments from "Matemática Computacional IV — 4. Transformada discreta de Fourier"
 * (T. M. Buriol, github.com/tiagoburiol/MatComp_IV). Components: A sin(2π f t + φ), φ in degrees.
 * The lesson uses unseeded numpy noise; here the seed only makes the run reproducible.
 * view: 'full' (0 ≤ k < N) or 'half' (0 ≤ k ≤ N/2); maxFrequency limits the half view (Hz).
 */
const c = (amplitude, frequency, phase = 0) => ({amplitude, frequency, phase});
export const presets = Object.freeze({
  example1: {samples: 100, duration: 1, components: [c(3, 1), c(1, 4), c(0.5, 7)], noise: 0, seed: 1, threshold: 0.3, view: 'full', maxFrequency: 50},
  example2: {samples: 1000, duration: 1, components: [c(1, 10)], noise: 0.5, seed: 1, threshold: 0.5, view: 'half', maxFrequency: 50},
  example3: {samples: 1000, duration: 1, components: [c(1, 50), c(1, 120)], noise: 2.5, seed: 1, threshold: 0.5, view: 'half', maxFrequency: 500},
  example4: {samples: 1000, duration: 1, components: [c(5, 10), c(3, 15, -60), c(1, 30, 90)], noise: 2.5, seed: 1, threshold: 0.5, view: 'half', maxFrequency: 50},
  leakage: {samples: 64, duration: 1, components: [c(1, 4.5)], noise: 0, seed: 1, threshold: 0.1, view: 'half', maxFrequency: 32},
  aliasing: {samples: 100, duration: 1, components: [c(1, 60)], noise: 0, seed: 1, threshold: 0.3, view: 'full', maxFrequency: 50}
});
export const presetOrder = Object.freeze(['example1', 'example2', 'example3', 'example4', 'leakage', 'aliasing']);
export const defaultPreset = 'example1';
