#!/usr/bin/env python3
"""Gera tests/fixtures/core-analysis.json: referência NumPy/SciPy para assets/js/core/analysis.js.

Uso: python3 -I gen_analysis.py <saida.json>

Determinístico: não usa aleatoriedade. NaN e ±Infinity são gravados como strings
"NaN", "Infinity" e "-Infinity" (JSON não tem esses valores).

Definições de python-control 0.10.2 reproduzidas em NumPy (python-control é usado só em
scripts/reference/check_control.py, que confere estas definições contra control 0.10.2):
- damp: poles = polos do sistema (raízes de den em TF; eigvals(A) em SS);
  s = poles (contínuo) ou log(poles)/Ts (discreto);
  wn = |s|, zeta = -Re(s)/wn.
- margin (stability_margins): gm = 1/|L| (magnitude absoluta, não dB) no cruzamento de
  fase (arg L = -180 mod 360, Re L < 0); pm = 180 + arg L em graus no cruzamento de
  ganho (|L| = 1), reduzido a (-180, 180]; wcg e wcp são as frequências desses cruzamentos.
  Quando há vários cruzamentos, escolhe-se o de gm mais próximo de 1 (|log gm| mínimo)
  e o de pm de |pm| mínimo. Sem cruzamento: gm = pm = Infinity e wcg = wcp = NaN.
  Os cruzamentos são localizados por varredura logarítmica densa + brentq.

Frequências: rad/s para sistemas contínuos; rad/s com z = exp(j w Ts) para discretos.
"""
import sys
import json
import math

import numpy as np
import scipy
from scipy import signal, optimize

GENERATED_ON = "2026-11-26"
N_FREQ = 60

SYSTEMS = [
    dict(name="primeira_ordem", kind="tf", num=[2.0], den=[1.0, 3.0], dt=0.0),
    dict(name="segunda_ordem_subamortecida", kind="tf", num=[4.0], den=[1.0, 1.2, 4.0], dt=0.0),
    dict(name="terceira_ordem_com_zero", kind="tf", num=[1.0, 2.0], den=[1.0, 6.0, 11.0, 6.0], dt=0.0),
    dict(name="polo_na_origem", kind="tf", num=[5.0], den=[1.0, 2.0, 0.0], dt=0.0),
    dict(name="discreto_Ts_0_1", kind="tf", num=[0.1, 0.05], den=[1.0, -1.5, 0.7], dt=0.1),
    dict(name="nao_minima_fase", kind="tf", num=[-1.0, 1.0], den=[1.0, 3.0, 2.0], dt=0.0),
    dict(name="ss_3x3", kind="ss",
         A=[[-1.0, 2.0, 0.0], [0.0, -3.0, 1.0], [1.0, 0.0, -2.0]],
         B=[[1.0], [0.0], [1.0]], C=[[1.0, 0.0, 1.0]], D=[[0.5]], dt=0.0),
    # L = K/(s(s+1)(s+2)) com K = sqrt(10): |L| = 1 em w = 1; cruzamento de fase em w = sqrt(2).
    dict(name="margem_L_K_raiz10", kind="tf", num=[math.sqrt(10.0)], den=[1.0, 3.0, 2.0, 0.0], dt=0.0),
]


def pairs(z):
    """Lista de complexos -> lista de pares [re, im]."""
    return [[float(np.real(v)), float(np.imag(v))] for v in np.asarray(z, dtype=complex).ravel()]


def enc(x):
    """Codifica para JSON: NaN/Inf viram strings; arrays viram listas."""
    if isinstance(x, dict):
        return {k: enc(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [enc(v) for v in x]
    if isinstance(x, np.ndarray):
        return [enc(v) for v in x.tolist()]
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        f = float(x)
        if math.isnan(f):
            return "NaN"
        if math.isinf(f):
            return "Infinity" if f > 0 else "-Infinity"
        return f
    return x


def pm_of_arg_deg(arg_deg):
    """Margem de fase (graus) a partir de arg L em graus: 180 + arg L reduzido a [-180, 180)."""
    return ((arg_deg + 360.0) % 360.0) - 180.0


def polys_of(sysd):
    """Retorna (num, den, A, B, C, D) em NumPy, a partir de TF ou SS da especificação."""
    if sysd["kind"] == "tf":
        num = np.asarray(sysd["num"], float)
        den = np.asarray(sysd["den"], float)
        A, B, C, D = signal.tf2ss(num, den)
        return num, den, A, B, C, D
    A = np.asarray(sysd["A"], float)
    B = np.asarray(sysd["B"], float)
    C = np.asarray(sysd["C"], float)
    D = np.asarray(sysd["D"], float)
    num, den = signal.ss2tf(A, B, C, D)
    return np.trim_zeros(num[0], "f"), den, A, B, C, D


def poles_pc(sysd, num, den, A):
    """Polos no sentido de python-control: raízes de den (TF) ou eigvals(A) (SS)."""
    if sysd["kind"] == "tf":
        return np.roots(den)
    return np.linalg.eigvals(A)


def damp_ref(poles, dt):
    s = np.log(poles.astype(complex)) / dt if dt > 0 else poles.astype(complex)
    wn = np.abs(s)
    with np.errstate(divide="ignore", invalid="ignore"):
        zeta = -np.real(s) / wn
    return wn, zeta


def freq_points(dt, n=N_FREQ):
    if dt > 0:
        return np.logspace(-1.0, math.log10(0.99 * math.pi / dt), n)
    return np.logspace(-2.0, 2.0, n)


def h_of_w(num, den, w, dt):
    """H(jw) ou H(e^{jwT}) para TF com coeficientes decrescentes (num, den)."""
    if dt > 0:
        L = max(len(num), len(den))
        nn = np.concatenate([np.zeros(L - len(num)), num])
        dd = np.concatenate([np.zeros(L - len(den)), den])
        _, h = signal.freqz(nn, dd, worN=w * dt)
        return h
    _, h = signal.freqs(num, den, worN=w)
    return h


def margin_ref(num, den, dt):
    """Margens (gm absoluta, pm em graus, wcg, wcp) com varredura densa + brentq."""
    if dt > 0:
        wgrid = np.logspace(-6.0, math.log10(math.pi / dt * (1 - 1e-9)), 200001)
        s_of = lambda w: np.exp(1j * w * dt)
    else:
        wgrid = np.logspace(-6.0, 6.0, 200001)
        s_of = lambda w: 1j * w

    def L(w):
        s = s_of(np.asarray(w, float))
        return np.polyval(num, s) / np.polyval(den, s)

    Lg = L(wgrid)
    mag = np.abs(Lg)
    gc = []  # (wc, pm)
    f = mag - 1.0
    for i in np.where(f[:-1] * f[1:] <= 0)[0]:
        if np.isfinite(f[i]) and np.isfinite(f[i + 1]):
            wc = optimize.brentq(lambda w: float(np.abs(L(w))) - 1.0, wgrid[i], wgrid[i + 1], xtol=1e-15, rtol=1e-15)
            Lc = complex(L(wc))
            gc.append((wc, pm_of_arg_deg(math.degrees(math.atan2(Lc.imag, Lc.real)))))
    pcs = []  # (wp, gm)
    im = Lg.imag
    for i in np.where(im[:-1] * im[1:] <= 0)[0]:
        if np.isfinite(im[i]) and np.isfinite(im[i + 1]):
            wp = optimize.brentq(lambda w: float(complex(L(w)).imag), wgrid[i], wgrid[i + 1], xtol=1e-15, rtol=1e-15)
            Lp = complex(L(wp))
            if Lp.real < 0:
                pcs.append((wp, 1.0 / abs(Lp)))
    if pcs:
        wcg, gm = min(pcs, key=lambda t: abs(math.log(t[1])))
    else:
        wcg, gm = float("nan"), float("inf")
    if gc:
        wcp, pm = min(gc, key=lambda t: abs(t[1]))
    else:
        wcp, pm = float("nan"), float("inf")
    return dict(gm=gm, pm=pm, wcg=wcg, wcp=wcp)


def build_system(sysd):
    num, den, A, B, C, D = polys_of(sysd)
    z, p, k = signal.tf2zpk(num, den)
    z_ss, p_ss, k_ss = signal.ss2zpk(A, B, C, D)
    Az, Bz, Cz, Dz = signal.zpk2ss(z, p, k)
    w = freq_points(sysd["dt"])
    H = h_of_w(num, den, w, sysd["dt"])
    poles = poles_pc(sysd, num, den, A)
    zeros = np.roots(num)
    wn, zeta = damp_ref(poles, sysd["dt"])
    s_test = complex(0.3, 1.7)
    evalfr_val = np.polyval(num, s_test) / np.polyval(den, s_test)
    out = dict(
        name=sysd["name"],
        kind=sysd["kind"],
        dt=sysd["dt"],
        num=num, den=den,
        ss=dict(A=A, B=B, C=C, D=float(D[0, 0])),
        w=w,
        pole=pairs(poles),
        zero=pairs(zeros),
        damp=dict(wn=wn, zeta=zeta),
        tf2zpk=dict(z=pairs(z), p=pairs(p), k=float(k)),
        ss2zpk=dict(z=pairs(z_ss), p=pairs(p_ss), k=float(k_ss)),
        zpk2ss=dict(A=Az, B=Bz, C=Cz, D=float(Dz[0, 0])),
        freqresp=dict(mag=np.abs(H), phase=np.angle(H), re=H.real, im=H.imag),
        bode_deg=dict(mag_db=20.0 * np.log10(np.abs(H)),
                      phase_deg=np.degrees(np.unwrap(np.angle(H)))),
        evalfr=dict(s=[s_test.real, s_test.imag], value=[evalfr_val.real, evalfr_val.imag]),
        margin=margin_ref(num, den, sysd["dt"]),
    )
    return out


def main(out_path):
    systems = [build_system(s) for s in SYSTEMS]

    # rlocus: raízes de den + K*num, para o sistema não mínimo de fase.
    nmp = next(s for s in SYSTEMS if s["name"] == "nao_minima_fase")
    gains = np.linspace(0.0, 4.0, 17)
    rl_roots = []
    for K in gains:
        cl = np.polyadd(np.asarray(nmp["den"], float), K * np.asarray(nmp["num"], float))
        rl_roots.append(pairs(np.roots(cl)))

    # unwrap: exemplo da documentação do numpy e uma rampa envolvida em (-pi, pi].
    ramp = np.angle(np.exp(1j * 0.7 * np.arange(40)))
    unwrap_cases = [
        dict(input=[0.0, 1.0, 2.0, -1.0, 0.0], period=4.0, output=np.unwrap(np.array([0.0, 1.0, 2.0, -1.0, 0.0]), period=4.0)),
        dict(input=ramp, period=2 * math.pi, output=np.unwrap(ramp)),
    ]

    doc = dict(
        meta=dict(
            numpy=np.__version__,
            scipy=scipy.__version__,
            data=GENERATED_ON,
            gerador="scripts/reference/gen_analysis.py",
            python_control="control 0.10.2; definicoes em NumPy conferidas por scripts/reference/check_control.py",
            n_freq=N_FREQ,
        ),
        systems=systems,
        rlocus=dict(system="nao_minima_fase", gains=gains, roots=rl_roots),
        unwrap=unwrap_cases,
    )
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(enc(doc), fh, ensure_ascii=False, indent=1)
        fh.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: gen_analysis.py <saida.json>")
    main(sys.argv[1])
