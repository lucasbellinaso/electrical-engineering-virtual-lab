"""Generate independent SciPy references for the optimization core."""
import json
from pathlib import Path
import numpy as np
from scipy.optimize import minimize, least_squares, curve_fit

f = lambda z: 100 * (z[1] - z[0]**2)**2 + (1 - z[0])**2
residual = lambda z: np.array([z[0] + z[1] - 3, 2*z[0] - z[1], z[0] - 1.2])
x = np.array([0., 0.5, 1., 1.5, 2.])
y = np.array([2.03, 1.56, 1.24, 0.91, 0.77])
model = lambda t, a, b: a*np.exp(b*t)
a = minimize(f, [-1.2, 1.], method='BFGS', options={'gtol': 1e-9})
b = least_squares(residual, [0., 0.], xtol=1e-14, ftol=1e-14, gtol=1e-14)
c, covariance = curve_fit(model, x, y, p0=[2., -0.5], method='lm')
out = {'minimize': {'x': a.x.tolist(), 'fun': float(a.fun)}, 'leastSquares': {'x': b.x.tolist(), 'cost': float(b.cost)}, 'curveFit': {'x': x.tolist(), 'y': y.tolist(), 'params': c.tolist(), 'covariance': covariance.tolist()}}
Path('tests/fixtures/optimize-scipy.json').write_text(json.dumps(out, indent=2)+'\n', encoding='utf-8')
