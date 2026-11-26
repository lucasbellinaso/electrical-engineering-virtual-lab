#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera tests/fixtures/core-timeresp.json: referência SciPy/NumPy para assets/js/core/timeresp.js.

Uso (determinístico, sem aleatoriedade):
    python3 -I scripts/reference/gen_timeresp.py > tests/fixtures/core-timeresp.json

Hipóteses e convenções (espelhadas em timeresp.js):
- Tempo: t_k = k·h, k = 0..N-1, com h = 0.1 e N = 101 (contínuo e discreto, dt = 0.1).
- lsim contínuo: ZOH, u constante em [t_k, t_{k+1}). Referência = scipy.signal.lsim(...,
  interp=False), conferida contra recorrência manual com expm aumentada neste script.
- Discreto: x[k+1] = A x[k] + B u[k]; y[k] = C x[k] + D u[k] (scipy.signal.dlsim).
- impulse contínuo: y(t) = C e^{At} B (D·δ ignorado); discreto: sequência unitária u[0] = 1.
- initial: u = 0 com condição inicial x0.
- stepinfo: gerado diretamente por control.step_info (python-control, versão gravada em meta).
  step_info_ref é uma reprodução NumPy usada só como verificação cruzada das demais chaves.
  Atenção: no control, SettlingMin/SettlingMax são min/max de y a partir do índice de 90% da
  subida (tr_upper_index), limitados por yfinal; NÃO a partir do instante de acomodação.
- NaN/Inf são codificados como strings "NaN", "Infinity", "-Infinity".
Saída: JSON em stdout; diagnósticos em stderr.
"""
import json
import math
import sys
import datetime

import numpy as np
import scipy
from scipy import signal
from scipy.linalg import expm
import control as ct   # python-control: fonte de verdade para step_info

H = 0.1   # passo de tempo (também dt dos sistemas discretos)
N = 101   # número de amostras: t = 0 .. 10

T = np.arange(N) * H   # t_k = k·h, mesma aritmética de k*h em JavaScript
K = np.arange(N)

# Especificações de entrada: a fixture guarda a especificação, não o vetor.
STEP = {'type': 'step', 'amp': 1.0}
RAMP = {'type': 'ramp', 'slope': 1.0}
SINE = {'type': 'sine', 'amp': 1.0, 'freq': 0.5}          # sen(2π·0.5·t)
PULSE = {'type': 'pulse', 'amp': 1.0, 'k0': 10, 'k1': 30}  # 1 para t ∈ [1, 3)
INPUTS = {'step': STEP, 'ramp': RAMP, 'sine': SINE, 'pulse': PULSE}


def input_vector(spec):
    kind = spec['type']
    if kind == 'step':
        return np.full(N, spec['amp'], dtype=float)
    if kind == 'ramp':
        return spec['slope'] * (K * H)
    if kind == 'sine':
        return spec['amp'] * np.sin(2.0 * np.pi * spec['freq'] * (K * H))
    if kind == 'pulse':
        return np.where((K >= spec['k0']) & (K < spec['k1']), spec['amp'], 0.0).astype(float)
    raise ValueError(kind)


TF_SYSTEMS = {
    'first_order': {'num': [2.0], 'den': [1.0, 3.0], 'dt': 0.0},
    'second_under': {'num': [9.0], 'den': [1.0, 1.2, 9.0], 'dt': 0.0},   # wn = 3, zeta = 0.2
    'third_order': {'num': [2.0, 5.0], 'den': [1.0, 6.0, 11.0, 6.0], 'dt': 0.0},
    'with_feedthrough': {'num': [1.0, 3.0], 'den': [1.0, 2.0], 'dt': 0.0},  # D = 1
    'discrete_second': {'num': [0.2, 0.1], 'den': [1.0, -1.6, 0.8], 'dt': H},
}

MIMO = {
    'A': [[-1.0, 0.5], [-0.3, -2.0]],
    'B': [[1.0, 0.0], [0.0, 1.0]],
    'C': [[1.0, 0.5], [0.0, 1.0]],
    'D': [[0.0, 0.0], [0.2, 0.0]],
    'dt': 0.0,
}


def zoh(A, B, h):
    """Discretização ZOH exata via expm aumentada."""
    n, m = B.shape
    M = np.zeros((n + m, n + m))
    M[:n, :n] = A * h
    M[:n, n:] = B * h
    E = expm(M)
    return E[:n, :n], E[:n, n:]


def ref_lsim(A, B, C, D, U, x0, dt):
    """Referência manual: contínuo com ZOH (Ad, Bd); discreto com A, B. Retorna (N, p)."""
    if dt == 0:
        Ad, Bd = zoh(A, B, H)
    else:
        Ad, Bd = A, B
    x = np.array(x0, dtype=float).reshape(-1).copy()
    Y = []
    for k in range(N):
        u = U[k]
        Y.append(C @ x + D @ u)
        x = Ad @ x + Bd @ u
    return np.array(Y)


def step_info_ref(t, y, yfinal=None, settling_pct=2.0, rise_limits=(0.1, 0.9)):
    """Reprodução NumPy da definição de control.step_info (ver cabeçalho)."""
    t = np.asarray(t, float)
    y = np.asarray(y, float)
    yf = float(y[-1]) if yfinal is None else float(yfinal)
    yn = y / yf  # resposta normalizada: 1 em regime permanente

    def first_ge(level):
        idx = np.nonzero(yn >= level)[0]
        return int(idx[0]) if idx.size else None

    lo, hi = first_ge(rise_limits[0]), first_ge(rise_limits[1])
    rise = float(t[hi] - t[lo]) if (lo is not None and hi is not None) else math.nan

    thr = settling_pct / 100.0
    out = np.nonzero(np.abs(yn - 1.0) > thr)[0]
    if out.size == 0:
        si = 0
    elif out[-1] == len(y) - 1:
        si = None                      # ainda fora da faixa no último instante
    else:
        si = int(out[-1]) + 1
    if si is None:
        ts, smin, smax = math.nan, math.nan, math.nan
    else:
        ts = float(t[si])
        seg = y[si:]
        smin, smax = float(seg.min()), float(seg.max())

    pk = int(np.argmax(np.abs(y)))
    return {
        'riseTime': rise,
        'settlingTime': ts,
        'overshoot': float(100.0 * max(0.0, yn.max() - 1.0)),
        'undershoot': float(100.0 * max(0.0, -yn.min())),
        'peak': float(abs(y[pk])),
        'peakTime': float(t[pk]),
        'settlingMin': smin,
        'settlingMax': smax,
        'steadyStateValue': yf,
    }


def step_info_control(t, y):
    """control.step_info sobre a resposta amostrada, nas chaves camelCase do fixture."""
    g = ct.step_info(np.asarray(y, float), T=np.asarray(t, float))
    keys = {'riseTime': 'RiseTime', 'settlingTime': 'SettlingTime', 'overshoot': 'Overshoot',
            'undershoot': 'Undershoot', 'peak': 'Peak', 'peakTime': 'PeakTime',
            'settlingMin': 'SettlingMin', 'settlingMax': 'SettlingMax',
            'steadyStateValue': 'SteadyStateValue'}
    return {k: float(g[v]) for k, v in keys.items()}


def enc(v):
    """Codifica NaN/Inf como strings; converte arrays NumPy em listas."""
    if isinstance(v, np.ndarray):
        v = v.tolist()
    if isinstance(v, (list, tuple)):
        return [enc(x) for x in v]
    if isinstance(v, dict):
        return {k: enc(x) for k, x in v.items()}
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, (float, np.floating)):
        f = float(v)
        if math.isnan(f):
            return 'NaN'
        if math.isinf(f):
            return 'Infinity' if f > 0 else '-Infinity'
        return f
    if isinstance(v, (int, np.integer)):
        return int(v)
    return v


def check(cond, msg):
    if not cond:
        raise SystemExit('FALHA: ' + msg)


def max_diff(a, b):
    """Diferença máxima absoluta; achata ambos (evita broadcasting (N,1) x (N,))."""
    a = np.asarray(a, float).reshape(-1)
    b = np.asarray(b, float).reshape(-1)
    check(a.size == b.size, f'tamanhos diferentes: {a.size} x {b.size}')
    return float(np.max(np.abs(a - b)))


def main():
    log = lambda s: print(s, file=sys.stderr)
    systems = {}
    for key, s in TF_SYSTEMS.items():
        A, B, C, D = signal.tf2ss(s['num'], s['den'])
        systems[key] = {
            'A': A, 'B': B, 'C': C, 'D': np.atleast_2d(D), 'dt': s['dt'],
            'num': s['num'], 'den': s['den'],
        }
    systems['mimo'] = {
        'A': np.array(MIMO['A']), 'B': np.array(MIMO['B']), 'C': np.array(MIMO['C']),
        'D': np.array(MIMO['D']), 'dt': MIMO['dt'], 'num': None, 'den': None,
    }

    def matrices(sysk):
        s = systems[sysk]
        return (np.asarray(s['A'], float), np.asarray(s['B'], float),
                np.asarray(s['C'], float), np.asarray(s['D'], float), s['dt'])

    # ---- lsim: referência ZOH (manual) confrontada com SciPy ----
    lsim_runs = []
    runs = []
    for sysk in TF_SYSTEMS:
        for name, spec in INPUTS.items():
            runs.append((f'{sysk}/{name}', sysk, [spec], None))
    runs.append(('mimo/step+sine', 'mimo', [STEP, SINE], None))
    runs.append(('mimo/pulse+ramp', 'mimo', [PULSE, RAMP], None))
    runs.append(('second_under/step+x0', 'second_under', [STEP], [1.0, -0.5]))

    for rid, sysk, specs, x0 in runs:
        A, B, C, D, dt = matrices(sysk)
        n = A.shape[0]
        x0v = np.zeros(n) if x0 is None else np.array(x0, float)
        U = np.column_stack([input_vector(sp) for sp in specs])
        Y = ref_lsim(A, B, C, D, U, x0v, dt)
        if dt == 0:
            _, ys, _ = signal.lsim((A, B, C, D), U, T, X0=x0v, interp=False)
            d = max_diff(Y, ys)
            log(f'{rid:28s} lsim manual vs scipy.lsim(interp=False): {d:.3e}')
            check(d < 1e-9, f'ZOH manual diverge do SciPy em {rid}: {d}')
        else:
            _, yd, _ = signal.dlsim((A, B, C, D, dt), U, t=None, x0=x0v)
            d = max_diff(Y, yd)
            log(f'{rid:28s} recorrencia vs scipy.dlsim: {d:.3e}')
            check(d < 1e-12, f'dlsim diverge em {rid}: {d}')
        p = C.shape[0]
        y_out = Y[:, 0] if p == 1 else Y
        lsim_runs.append({'id': rid, 'system': sysk, 'inputs': specs,
                          'x0': x0v, 'y': y_out})

    # ---- stepinfo: definição reproduzida sobre as respostas ao degrau ----
    stepinfo = []
    for r in lsim_runs:
        if r['id'].endswith('/step'):
            info = step_info_control(T, r['y'])
            ref = step_info_ref(T, r['y'])
            for k in info:
                if k in ('settlingMin', 'settlingMax'):
                    continue   # definição diferente de propósito (ver cabeçalho)
                a, b = info[k], ref[k]
                check((math.isnan(a) and math.isnan(b)) or abs(a - b) <= 1e-9 * max(1.0, abs(b)),
                      f'step_info_ref diverge do control em {r["id"]}.{k}: {b} vs {a}')
            stepinfo.append({'id': 'stepinfo:' + r['id'], 'run': r['id'], 'expected': info})

    # ---- impulse ----
    impulse = []
    for sysk, j in [('first_order', 0), ('second_under', 0), ('with_feedthrough', 0),
                    ('mimo', 0), ('mimo', 1)]:
        A, B, C, D, dt = matrices(sysk)
        y = np.array([C @ expm(A * t) @ B[:, j] for t in T])
        # D·δ é ignorado por definição; y(0+) = C·B
        if sysk != 'mimo':
            _, ys = signal.impulse((A, B, C, D), T=T)[:2]
            if np.all(D == 0):
                d = max_diff(y[1:], ys[1:])
                log(f'impulse {sysk} vs scipy.impulse (t>0): {d:.3e}')
                check(d < 1e-8, f'impulse diverge do SciPy em {sysk}: {d}')
        impulse.append({'id': f'impulse/{sysk}/in{j}', 'system': sysk, 'input': j,
                        'y': y if C.shape[0] > 1 else y[:, 0]})
    A, B, C, D, dt = matrices('discrete_second')
    U = np.zeros((N, 1)); U[0, 0] = 1.0
    yd = ref_lsim(A, B, C, D, U, np.zeros(A.shape[0]), dt)
    impulse.append({'id': 'impulse/discrete_second/in0', 'system': 'discrete_second',
                    'input': 0, 'y': yd[:, 0]})

    # ---- initial: C e^{At} x0, conferido com scipy.lsim(U=0) ----
    A, B, C, D, dt = matrices('second_under')
    x0 = np.array([1.0, -0.5])
    y_init = np.array([(C @ expm(A * t) @ x0)[0] for t in T])
    _, ys, _ = signal.lsim((A, B, C, D), np.zeros((N, 1)), T, X0=x0, interp=False)
    d = max_diff(y_init, ys)
    log(f'initial second_under vs scipy.lsim(U=0): {d:.3e}')
    check(d < 1e-9, f'initial diverge: {d}')
    initial = [{'id': 'initial/second_under', 'system': 'second_under', 'x0': x0, 'y': y_init}]

    # ---- discretização ZOH (c2d) ----
    disc = []
    for sysk in ['first_order', 'mimo']:
        A, B, C, D, dt = matrices(sysk)
        Ad_s, Bd_s = signal.cont2discrete((A, B, C, D), H, method='zoh')[:2]
        Ad, Bd = zoh(A, B, H)
        d = max(max_diff(Ad, Ad_s), max_diff(Bd, Bd_s))
        log(f'c2d {sysk} vs scipy.cont2discrete(zoh): {d:.3e}')
        check(d < 1e-12, f'c2d diverge: {d}')
        disc.append({'id': f'c2d/{sysk}', 'system': sysk, 'h': H, 'Ad': Ad, 'Bd': Bd})

    out = {
        'meta': {
            'modulo': 'assets/js/core/timeresp.js',
            'gerador': 'scripts/reference/gen_timeresp.py',
            'python': sys.version.split()[0],
            'numpy': np.__version__,
            'scipy': scipy.__version__,
            'python_control': 'control ' + ct.__version__ + ' (stepinfo gerado por control.step_info)',
            'data': datetime.date.today().isoformat(),
            'tolerancias_documentadas_no_teste': 'ver tests/core-timeresp.test.mjs',
        },
        'grid': {'h': H, 'N': N, 't0': 0.0},
        'inputs': INPUTS,
        'systems': {k: {'A': v['A'], 'B': v['B'], 'C': v['C'], 'D': v['D'], 'dt': v['dt'],
                        'num': v['num'], 'den': v['den']} for k, v in systems.items()},
        'lsim': lsim_runs,
        'impulse': impulse,
        'initial': initial,
        'stepinfo': stepinfo,
        'discretization': disc,
    }
    print(json.dumps(enc(out), ensure_ascii=True, separators=(',', ':')))


if __name__ == '__main__':
    main()
