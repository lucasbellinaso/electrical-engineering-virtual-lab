"""Generate NumPy/SciPy reference fixtures for the expanded JavaScript core."""
import json
from pathlib import Path

import numpy as np
from scipy import integrate, linalg, signal, special

ROOT = Path(__file__).resolve().parents[2]

def plain(x):
    if isinstance(x, np.ndarray):
        return plain(x.tolist())
    if isinstance(x, (np.floating, np.integer)):
        return x.item()
    if isinstance(x, complex):
        return {"re": x.real, "im": x.imag}
    if isinstance(x, list):
        return [plain(v) for v in x]
    return x

special_x = np.array([-10., -5., -3., -1., -.5, 0., .5, 1., 3., 5., 10., 26.])
ps = np.array([1e-12, 1e-9, .001, .025, .1, .5, .9, .975, .999, 1-1e-9, 1-1e-12])
intervals = [(-8., -7.), (-1., 1.), (0., 2.), (7., 8.), (-10., 0.), (0., 10.)]

matrices = [
    [[1., 2., -1.], [2., -1., 3.], [0., 1., 2.], [3., 0., 1.]],
    [[1., 2., 0., -1.], [0., 1., 3., 2.], [2., -1., 1., 0.]],
    [[1., 2., 3.], [2., 4., 6.], [1., 1., 1.]],
    [[1., 2.], [3., 4.], [5., 6.], [7., 8.]],
]
matrix_refs = []
for A0 in matrices:
    A = np.asarray(A0, dtype=float)
    matrix_refs.append({"A": A0, "s": linalg.svdvals(A).tolist(), "pinv": linalg.pinv(A).tolist(), "rank": int(np.linalg.matrix_rank(A))})

v = np.array([3., -1., 7., 2., 2., 10., 0.])
hist_v = np.array([-1., 0., .2, .5, 1., 1.5, 2., 3., 4., 5.])
hist_edges = np.array([0., 1., 2., 4.])
hist_const_counts, hist_const_edges = np.histogram(np.full(3, 2.), bins=4)
sx = np.array([0., .4, 1.4, 2., 3.])
sy = sx**3 - 2*sx + 1
ex = np.array([0., .4, 1.4, 2.])
ey = np.exp(-ex)

fft_real = [0.2, -1.0, 3.5, 2.2, 0.0, -0.5, 1.1, 4.0]
fft_nonpow = [1., 2., -1., .5, 3.]
fft_complex = [1+2j, -2+.5j, .25-1j, 3+0j]
fb, fa, fx, zi = [0.25, 0.25], [1., -0.5], [1., 0., 0., 0., 0., 0.], [.125]
fb_c, fa_c, fx_c = [1+.5j, .25-.2j], [1., -.3+.1j], [1-1j, .5+2j, -1+.2j]

rng = np.random.default_rng(20261127)
normal_sample = rng.normal(size=40000)
uniform_sample = np.random.default_rng(314).random(40000)

data = {
    "source": {"numpy": np.__version__, "scipy": __import__("scipy").__version__},
    "special": {
        "x": special_x.tolist(), "erf": special.erf(special_x).tolist(), "erfc": special.erfc(special_x).tolist(),
        "ndtr": special.ndtr(special_x).tolist(), "qfunc": special.ndtr(-special_x).tolist(),
        "p": ps.tolist(), "ndtri": special.ndtri(ps).tolist(),
        "intervals": [{"a": a, "b": b, "value": float(integrate.quad(lambda t: np.exp(-t*t/2)/np.sqrt(2*np.pi), a, b, epsabs=1e-14)[0])} for a,b in intervals],
    },
    "matrices": matrix_refs,
    "constructors": {
        "ones": np.ones((2,3)).tolist(),
        "diag_matrix": np.diag([2.,-1.,4.], k=1).tolist(),
        "diag_vector": np.diag(np.asarray([[1.,2.,3.],[4.,5.,6.],[7.,8.,9.]]), k=-1).tolist(),
        "reshape": np.reshape(np.arange(1.,7.), (3,2), order="C").tolist(),
    },
    "numeric": {
        "v": v.tolist(), "q": [.1, .25, .5, .9], "quantile": np.quantile(v, [.1,.25,.5,.9]).tolist(),
        "percentile": np.percentile(v, [10,25,50,90]).tolist(), "median": float(np.median(v)),
        "hist_v": hist_v.tolist(), "hist_edges": hist_edges.tolist(), "hist_counts": np.histogram(hist_v, bins=hist_edges)[0].tolist(),
        "hist_const_counts": hist_const_counts.tolist(), "hist_const_edges": hist_const_edges.tolist(),
        "simpson_x": sx.tolist(), "simpson_y": sy.tolist(), "simpson": float(integrate.simpson(sy, x=sx)),
        "simpson_even_x": ex.tolist(), "simpson_even_y": ey.tolist(), "simpson_even": float(integrate.simpson(ey, x=ex)),
        "quad_sin_square": float(integrate.quad(lambda t: np.sin(t*t), 0, 2, epsabs=1e-12)[0]),
        "quad_gaussian": float(integrate.quad(lambda t: np.exp(-t*t), -3, 4, epsabs=1e-12)[0]),
    },
    "signal": {
        "fft_real": fft_real, "fft_real_ref": plain(np.fft.fft(fft_real)),
        "ifft_real_ref": plain(np.fft.ifft(fft_real)),
        "fft_nonpow": fft_nonpow, "fft_nonpow_ref": plain(np.fft.fft(fft_nonpow)),
        "ifft_nonpow_ref": plain(np.fft.ifft(fft_nonpow)),
        "fft_complex": plain(fft_complex), "fft_complex_ref": plain(np.fft.fft(fft_complex)),
        "ifft_complex_ref": plain(np.fft.ifft(fft_complex)),
        "filter": {"b":fb,"a":fa,"x":fx,"zi":zi,"y":plain(signal.lfilter(fb,fa,fx,zi=zi)[0]),"zf":plain(signal.lfilter(fb,fa,fx,zi=zi)[1])},
        "filter_complex": {"b":plain(fb_c),"a":plain(fa_c),"x":plain(fx_c),"y":plain(signal.lfilter(fb_c,fa_c,fx_c))},
    },
    "random_numpy_stats": {"size": int(normal_sample.size), "mean": float(normal_sample.mean()), "std_population": float(normal_sample.std()), "q": np.quantile(normal_sample,[.01,.5,.99]).tolist()},
    "uniform_numpy_stats": {"size": int(uniform_sample.size), "mean": float(uniform_sample.mean()), "std_population": float(uniform_sample.std())},
}
(ROOT / "tests/fixtures/core-extensions-python.json").write_text(json.dumps(data, indent=2, allow_nan=False)+"\n", encoding="utf-8")
print(f"Wrote core extension references: NumPy {data['source']['numpy']}, SciPy {data['source']['scipy']}")
