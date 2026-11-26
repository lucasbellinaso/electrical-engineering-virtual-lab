#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera tests/fixtures/core-solvers.json: referência para fsolve/numjac (assets/js/core/solvers.js).

Uso: python3 scripts/reference/gen_solvers.py <saida.json>

Cada problema F(x) = 0 é resolvido por scipy.optimize.root (hybr, tol 1e-14) e o resíduo é verificado
(‖F‖∞ ≤ 1e-12). Os problemas são redefinidos em JS no teste, indexados por `id`. Para sistemas com
várias raízes (permutações de (1,2,3)) a comparação é feita com as componentes ordenadas.

Fluxo de potência de 2 barras (barra 1 = referência V1 = 1∠0; barra 2 = PQ), incógnitas x = [θ2, V2]:
  y = 1/(r + jx) = g − jb;  P2 = V2(−g cosθ + b sinθ) + g V2²;  Q2 = V2(−g sinθ − b cosθ) + b V2²;
  F = [P2 − Pesp, Q2 − Qesp]  (cargas com sinal negativo: Pesp, Qesp < 0).

Gauss–Seidel / SOR (sistema linear A x = b, F(x) = A x − b): varredura xᵢ ← xᵢ + ω((bᵢ − Σⱼ≠ᵢ aᵢⱼxⱼ)/aᵢᵢ − xᵢ),
com os valores mais recentes; ‖F‖∞ medido após cada varredura. O número de varreduras e o histórico
servem de referência exata para fsolve(..., {algorithm: 'gauss-seidel'}).
"""
import json
import sys

import numpy as np
import scipy
from scipy.optimize import root

R_LINHA, X_LINHA = 0.02, 0.1
Y = 1.0 / complex(R_LINHA, X_LINHA)
G, B = Y.real, -Y.imag
P_ESP, Q_ESP = -0.8, -0.4


def fluxo(x):
    th, v = x
    return [v * (-G * np.cos(th) + B * np.sin(th)) + G * v * v - P_ESP,
            v * (-G * np.sin(th) - B * np.cos(th)) + B * v * v - Q_ESP]


PROBLEMAS = [
    dict(id="cos_menos_x", x0=[1.0], f=lambda x: [np.cos(x[0]) - x[0]], ordenar=False),
    dict(id="raiz_de_2", x0=[1.0], f=lambda x: [x[0] ** 2 - 2], ordenar=False),
    dict(id="matlab_exp_2x2", x0=[-5.0, -5.0],
         f=lambda x: [2 * x[0] - x[1] - np.exp(-x[0]), -x[0] + 2 * x[1] - np.exp(-x[1])], ordenar=False),
    dict(id="circulo_hiperbole", x0=[2.0, 0.5],
         f=lambda x: [x[0] ** 2 + x[1] ** 2 - 4, x[0] * x[1] - 1], ordenar=False),
    dict(id="rosenbrock_sistema", x0=[-1.2, 1.0],
         f=lambda x: [10 * (x[1] - x[0] ** 2), 1 - x[0]], ordenar=False),
    dict(id="tres_equacoes", x0=[0.5, 2.5, 3.5],
         f=lambda x: [x[0] + x[1] + x[2] - 6, x[0] * x[1] + x[1] * x[2] + x[2] * x[0] - 11, x[0] * x[1] * x[2] - 6],
         ordenar=True),
    dict(id="fluxo_2_barras", x0=[0.0, 1.0], f=fluxo, ordenar=False,
         params=dict(g=G, b=B, Pesp=P_ESP, Qesp=Q_ESP, r=R_LINHA, x=X_LINHA)),
]


def gauss_seidel_linear(A, b, x0, omega, tol, max_iter):
    A, b, x = np.array(A, float), np.array(b, float), np.array(x0, float)
    hist = [float(np.max(np.abs(A @ x - b)))]
    while hist[-1] > tol and len(hist) - 1 < max_iter:
        for i in range(len(b)):
            novo = (b[i] - A[i] @ x + A[i, i] * x[i]) / A[i, i]
            x[i] = x[i] + omega * (novo - x[i])
        hist.append(float(np.max(np.abs(A @ x - b))))
    return x, hist


def main(saida):
    out = dict(meta=dict(gerador="scripts/reference/gen_solvers.py", numpy=np.__version__, scipy=scipy.__version__,
                         metodo="scipy.optimize.root(method='hybr', tol=1e-14)"), problemas=[])
    for p in PROBLEMAS:
        r = root(p["f"], p["x0"], method="hybr", tol=1e-14)
        res = float(np.max(np.abs(p["f"](r.x))))
        if res > 1e-12:
            raise SystemExit(f"FALHA: {p['id']} não convergiu (resíduo {res})")
        x = np.sort(r.x) if p["ordenar"] else r.x
        item = dict(id=p["id"], x0=p["x0"], expected=[float(v) for v in x], ordenar=p["ordenar"], residuo=res)
        if "params" in p: item["params"] = p["params"]
        out["problemas"].append(item)
    A = [[4.0, 1.0, 1.0], [1.0, 5.0, 2.0], [0.0, 2.0, 6.0]]
    x_ex = np.array([1.0, 2.0, 3.0]); b = (np.array(A) @ x_ex).tolist()
    gs = dict(A=A, b=b, x_exato=x_ex.tolist(), x0=[0.0, 0.0, 0.0], tolFun=1e-10, casos=[])
    for omega in (1.0, 1.2):
        x, hist = gauss_seidel_linear(A, b, gs["x0"], omega, 1e-10, 200)
        if not np.allclose(x, x_ex, atol=1e-9): raise SystemExit(f"FALHA: GS ω={omega} não convergiu")
        gs["casos"].append(dict(accel=omega, iteracoes=len(hist) - 1, history=hist, x=x.tolist()))
    out["gauss_seidel_linear"] = gs
    # sistema com raio espectral de Gauss–Seidel > 1 (diverge): A = [[1,3],[2,1]] → ρ = 6
    out["gauss_seidel_divergente"] = dict(A=[[1.0, 3.0], [2.0, 1.0]], b=[1.0, 1.0], x0=[0.0, 0.0])

    with open(saida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write("\n")
    print("OK", saida, [p["id"] for p in out["problemas"]])


if __name__ == "__main__":
    if len(sys.argv) != 2: raise SystemExit("uso: python3 scripts/reference/gen_solvers.py <saida.json>")
    main(sys.argv[1])
