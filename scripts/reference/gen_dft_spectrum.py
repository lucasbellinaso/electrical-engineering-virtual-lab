"""Generate independent NumPy data for the DFT spectrum laboratory (development only).

Run from the repository root: python scripts/reference/gen_dft_spectrum.py
The noisy inputs are generated here and stored in the fixture, so the JavaScript tests
analyse exactly the same samples (the EEVL noise generator differs from NumPy's).
"""
import json
from pathlib import Path
import numpy as np


def one_sided(F):
    n = len(F)
    amp = 2 * np.abs(F[: n // 2 + 1]) / n
    amp[0] /= 2
    if n % 2 == 0:
        amp[-1] /= 2
    return amp


def case(name, x, duration, threshold):
    x = np.asarray(x, dtype=float)
    n = len(x)
    F = np.fft.fft(x)
    amp = one_sided(F)
    keep_half = amp >= threshold
    keep = np.zeros(n, dtype=bool)
    for k in np.nonzero(keep_half)[0]:
        keep[k] = True
        keep[(n - k) % n] = True
    filtered = np.fft.ifft(np.where(keep, F, 0)).real
    # rfft/irfft route used in the lesson must agree with the full-spectrum route.
    R = np.fft.rfft(x)
    filtered_rfft = np.fft.irfft(np.where(keep_half, R, 0), n)
    assert np.allclose(filtered, filtered_rfft, atol=1e-10)
    return {
        'name': name, 'duration': duration, 'threshold': threshold, 'x': x.tolist(),
        're': F.real.tolist(), 'im': F.imag.tolist(), 'amplitude': amp.tolist(),
        'kept': [int(k) for k in np.nonzero(keep_half)[0]], 'filtered': filtered.tolist(),
        'frequency': (np.fft.rfftfreq(n, duration / n)).tolist(),
    }


rng = np.random.default_rng(20261127)
cases = []
t = np.linspace(0, 1, 100, endpoint=False)  # Example 1 of the lesson
cases.append(case('example1', 3 * np.sin(2 * np.pi * t) + np.sin(2 * np.pi * 4 * t) + 0.5 * np.sin(2 * np.pi * 7 * t), 1.0, 0.3))
t = np.linspace(0, 1, 256, endpoint=False)  # Example 4 signal, radix-2 length, stored noise
s = 5 * np.sin(2 * np.pi * 10 * t) + 3 * np.sin(2 * np.pi * 15 * t - np.pi / 3) + np.cos(2 * np.pi * 30 * t)
cases.append(case('example4-n256', s + 2.5 * rng.standard_normal(len(t)), 1.0, 0.8))
t = np.linspace(0, 2, 63, endpoint=False)  # odd N, DC offset, T = 2 s
cases.append(case('odd-dc', 0.7 + 2 * np.cos(2 * np.pi * 3 * t + 0.4) + 0.2 * rng.standard_normal(len(t)), 2.0, 0.25))
t = np.linspace(0, 1, 64, endpoint=False)  # Nyquist bin and leakage
cases.append(case('nyquist-leakage', 1.5 * np.cos(np.pi * 64 * t) + np.sin(2 * np.pi * 4.5 * t), 1.0, 0.1))
out = {'numpy': np.__version__, 'cases': cases}
Path('tests/fixtures/dft-spectrum-numpy.json').write_text(json.dumps(out, indent=1) + '\n', encoding='utf-8')
