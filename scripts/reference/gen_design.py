#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera a referência NumPy/SciPy para assets/js/core/design.js.

Casos: ctrb, obsv (posto e matrizes), acker (SISO, pólos reais e complexos),
lyap (AX + XAᵀ + Q = 0) e dlyap (AXAᵀ − X + Q = 0).

Convenções (registradas em meta.convencoes):
- Matrizes por linhas. Pólos como pares [re, im].
- lyap(A,Q) = scipy.linalg.solve_continuous_lyapunov(A, -Q), pois SciPy resolve A X + X Aᴴ = Q.
- dlyap(A,Q) = scipy.linalg.solve_discrete_lyapunov(A, Q), pois SciPy resolve A X Aᴴ − X = −Q.
- Ackermann: K = e_nᵀ C⁻¹ φ(A), com u = −Kx; referência cruzada com scipy.signal.place_poles.

Uso: python3 -I scripts/reference/gen_design.py <arquivo_saida.json>
NaN/Inf são codificados como "NaN", "Infinity" e "-Infinity".
"""
import datetime
import json
import math
import sys

import numpy as np
import scipy
from scipy import linalg, signal


def enc(x):
    """Converte estruturas NumPy/Python para JSON, codificando NaN e Inf como strings."""
    if isinstance(x, np.ndarray):
        return enc(x.tolist())
    if isinstance(x, (list, tuple)):
        return [enc(v) for v in x]
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        v = float(x)
        if math.isnan(v):
            return "NaN"
        if math.isinf(v):
            return "Infinity" if v > 0 else "-Infinity"
        return v
    return x


def ctrb_ref(A, B):
    """[B, AB, ..., A^(n-1) B] em NumPy."""
    n = A.shape[0]
    blocos, M = [], B.astype(float)
    for _ in range(n):
        blocos.append(M)
        M = A @ M
    return np.hstack(blocos)


def obsv_ref(A, C):
    """[C; CA; ...; CA^(n-1)] em NumPy."""
    n = A.shape[0]
    blocos, M = [], C.astype(float)
    for _ in range(n):
        blocos.append(M)
        M = M @ A
    return np.vstack(blocos)


def acker_ref(A, B, p):
    """Fórmula de Ackermann em NumPy, independente de scipy.signal.place_poles."""
    n = A.shape[0]
    c = np.poly(p)  # [1, a1, ..., an]; real porque p é fechado sob conjugação
    check(np.max(np.abs(np.imag(c))) < 1e-12, "pólos não fechados sob conjugação")
    c = np.real(c)
    phi = sum(c[k] * np.linalg.matrix_power(A, n - k) for k in range(n + 1))
    en = np.zeros((1, n))
    en[0, -1] = 1.0
    return en @ np.linalg.inv(ctrb_ref(A, B)) @ phi


def lyap_kron(A, Q):
    """Solução de AX + XAᵀ + Q = 0 por Kronecker (vec por linhas), para cruzar convenções."""
    n = A.shape[0]
    I = np.eye(n)
    M = np.kron(A, I) + np.kron(I, A)
    return np.linalg.solve(M, -Q.reshape(-1)).reshape(n, n)


def dlyap_kron(A, Q):
    """Solução de AXAᵀ − X + Q = 0 por Kronecker (vec por linhas)."""
    n = A.shape[0]
    M = np.kron(A, A) - np.eye(n * n)
    return np.linalg.solve(M, -Q.reshape(-1)).reshape(n, n)


def ordena(z):
    z = np.asarray(z, dtype=complex)
    return z[np.lexsort((z.imag, z.real))]


def check(cond, msg):
    if not cond:
        raise SystemExit("FALHA NA GERAÇÃO: " + msg)


def main(saida):
    np.set_printoptions(precision=17)
    out = {
        "meta": {
            "gerado_em": datetime.date(2026, 11, 26).isoformat(),
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "python": sys.version.split()[0],
            "gerador": "scripts/reference/gen_design.py",
            "convencoes": {
                "lyap": "AX + XAᵀ + Q = 0 (scipy.linalg.solve_continuous_lyapunov(A, -Q))",
                "dlyap": "AXAᵀ − X + Q = 0 (scipy.linalg.solve_discrete_lyapunov(A, Q))",
                "acker": "K = e_nᵀ C⁻¹ φ(A), u = −Kx, referência cruzada com scipy.signal.place_poles",
                "pólos": "pares [re, im]; pares complexos conjugados",
            },
        },
        "ctrb": [],
        "obsv": [],
        "acker": [],
        "lyap": [],
        "dlyap": [],
    }

    # ----- ctrb / obsv -----
    sistemas_ctrb = [
        ("2x2_siso", [[0, 1], [-2, -3]], [[0], [1]], [[1, 0]]),
        ("3x3_mimo", [[0, 1, 0], [0, 0, 1], [-6, -11, -6]],
         [[0, 0], [1, 0], [0, 1]], [[1, 0, 0], [0, 0, 1]]),
        ("4x4_nao_controlavel", [[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, -1, 0], [0, 0, 0, -3]],
         [[1], [1], [0], [0]], [[1, 0, 1, 0]]),
        ("4x4_misto", [[0, 1, 0, 0], [1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, -1]],
         [[1, 0], [0, 0], [0, 0], [0, 1]], [[1, 0, 0, 0], [0, 0, 0, 1]]),
    ]
    for nome, A, B, C in sistemas_ctrb:
        A, B, C = np.array(A, float), np.array(B, float), np.array(C, float)
        Cm, Om = ctrb_ref(A, B), obsv_ref(A, C)
        out["ctrb"].append({"nome": nome, "A": enc(A), "B": enc(B),
                            "esperado": enc(Cm), "posto": int(np.linalg.matrix_rank(Cm))})
        out["obsv"].append({"nome": nome, "A": enc(A), "C": enc(C),
                            "esperado": enc(Om), "posto": int(np.linalg.matrix_rank(Om))})

    # ----- acker (SISO) -----
    casos_acker = [
        ("2x2_reais", [[0, 1], [-2, -3]], [[0], [1]], [[-3, 0], [-4, 0]]),
        ("2x2_complexos", [[0, 1], [-2, -3]], [[0], [1]], [[-1, 2], [-1, -2]]),
        ("3x3_companheira_complexos", [[0, 1, 0], [0, 0, 1], [-6, -11, -6]],
         [[0], [0], [1]], [[-2, 0], [-3, 1], [-3, -1]]),
        ("3x3_geral", [[1, 2, 0], [0, -1, 1], [1, 0, 2]], [[0], [1], [1]],
         [[-1, 0], [-2, 0], [-4, 0]]),
        ("4x4_misto", [[0, 1, 0, 0], [1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, -1]],
         [[0], [0], [0], [1]], [[-1, 0], [-2, 0.5], [-2, -0.5], [-3, 0]]),
        ("4x4_instavel_malha_aberta", [[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, -1, 1], [0, 0, 0, -1]],
         [[1], [1], [1], [1]], [[-1, 0], [-2, 0], [-3, 1], [-3, -1]]),
    ]
    for nome, A, B, p in casos_acker:
        A, B = np.array(A, float), np.array(B, float)
        pc = [complex(a, b) for a, b in p]
        n = A.shape[0]
        check(np.linalg.matrix_rank(ctrb_ref(A, B)) == n, f"{nome} não controlável")
        K_sp = signal.place_poles(A, B, pc).gain_matrix
        K_np = acker_ref(A, B, pc)
        check(np.allclose(K_sp, K_np, rtol=1e-8, atol=1e-10), f"{nome}: Ackermann diverge do SciPy")
        eig = np.linalg.eigvals(A - B @ K_sp)
        check(np.allclose(ordena(eig), ordena(pc), atol=1e-8), f"{nome}: pólos não alocados")
        out["acker"].append({"nome": nome, "A": enc(A), "B": enc(B), "p": enc(p),
                             "K_esperado": enc(K_sp), "posto_ctrb": n})

    # ----- lyap / dlyap -----
    casos_lyap = [
        ("2x2", [[-1, 2], [0, -3]], [[1, 0], [0, 2]]),
        ("3x3_triangular", [[-2, 1, 0], [0, -1, 3], [0, 0, -4]],
         [[2, 1, 0], [1, 3, 0.5], [0, 0.5, 1]]),
        ("4x4_complexos", [[-1, 4, 0, 0], [-4, -1, 0, 0], [0, 0, -2, 1], [0, 0, -3, -2]],
         [[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, 1, 0.25], [0, 0, 0.25, 3]]),
    ]
    for nome, A, Q in casos_lyap:
        A, Q = np.array(A, float), np.array(Q, float)
        check(np.max(np.linalg.eigvals(A).real) < 0, f"lyap {nome}: A não estável")
        X = linalg.solve_continuous_lyapunov(A, -Q)
        check(np.allclose(X, lyap_kron(A, Q), rtol=1e-10, atol=1e-12), f"lyap {nome}: convenção")
        out["lyap"].append({"nome": nome, "A": enc(A), "Q": enc(Q), "X_esperado": enc(X),
                            "residuo": float(np.linalg.norm(A @ X + X @ A.T + Q))})

    casos_dlyap = [
        ("2x2", [[0.5, 0.2], [0, -0.3]], [[1, 0], [0, 1]]),
        ("3x3", [[0.2, 0.5, 0], [-0.3, 0.4, 0.1], [0, 0.2, -0.5]], [[1, 0.5, 0], [0.5, 2, 0], [0, 0, 1]]),
        ("4x4_complexos", [[0.6, 0.3, 0, 0], [-0.3, 0.6, 0, 0], [0, 0, 0.5, 0.2], [0, 0, 0, -0.4]],
         [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]),
    ]
    for nome, A, Q in casos_dlyap:
        A, Q = np.array(A, float), np.array(Q, float)
        check(np.max(np.abs(np.linalg.eigvals(A))) < 1, f"dlyap {nome}: A não é Schur")
        X = linalg.solve_discrete_lyapunov(A, Q)
        check(np.allclose(X, dlyap_kron(A, Q), rtol=1e-10, atol=1e-12), f"dlyap {nome}: convenção")
        out["dlyap"].append({"nome": nome, "A": enc(A), "Q": enc(Q), "X_esperado": enc(X),
                             "residuo": float(np.linalg.norm(A @ X @ A.T - X + Q))})

    with open(saida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("OK", saida)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("uso: python3 -I scripts/reference/gen_design.py <saida.json>")
    main(sys.argv[1])
