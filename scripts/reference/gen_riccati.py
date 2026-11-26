#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Referência para tests/core-riccati.test.mjs (assets/js/core/riccati.js).

Uso (determinístico, sem rede):
    python3 -I scripts/reference/gen_riccati.py <saida.json>

Os casos usam solve_continuous_are / solve_discrete_are do SciPy e as fórmulas de
python-control (lqr, dlqr, lqe, dlqe) reescritas em NumPy/SciPy:

  lqr  : X = care(A,B,Q,R,s=N);     K = R^-1 (B'X + N');            E = eig(A - BK)
  dlqr : X = dare(A,B,Q,R,s=N);     K = (R + B'XB)^-1 (B'XA + N');  E = eig(A - BK)
  lqe  : P = care(A',C',GQN G',RN); L = P C' RN^-1;                 E = eig(A - LC)
  dlqe : P = dare(A',C',GQN G',RN) (a priori); L = A P C' (C P C' + RN)^-1; E = eig(A - LC)

As fórmulas são conferidas contra control 0.10.2 por scripts/reference/check_control.py.
NaN/Infinity são gravados como strings "NaN", "Infinity", "-Infinity".
"""
import json
import math
import sys

import numpy as np
import scipy
from scipy import linalg

GERADO_EM = "2026-11-26"


def enc(v):
    if isinstance(v, dict):
        return {k: enc(x) for k, x in v.items()}
    if isinstance(v, np.ndarray):
        v = v.tolist()
    if isinstance(v, (list, tuple)):
        return [enc(x) for x in v]
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, (float, np.floating)):
        f = float(v)
        if math.isnan(f):
            return "NaN"
        if math.isinf(f):
            return "Infinity" if f > 0 else "-Infinity"
        return f
    if isinstance(v, (int, np.integer)):
        return int(v)
    return v


def mat(rows):
    return np.array(rows, dtype=float)


def eig_pairs(M):
    return sorted([float(z.real), float(z.imag)] for z in np.linalg.eigvals(M))


def lqr_case(cid, A, B, Q, R, N=None):
    A, B, Q, R = mat(A), mat(B), mat(Q), mat(R)
    N = np.zeros_like(B) if N is None else mat(N)
    X = linalg.solve_continuous_are(A, B, Q, R, s=N)
    K = linalg.solve(R, B.T @ X + N.T)
    E = eig_pairs(A - B @ K)
    return {"id": cid, "fn": "lqr",
            "inputs": {"A": A, "B": B, "Q": Q, "R": R, "N": N},
            "expected": {"X": X, "K": K, "E": E}}


def dlqr_case(cid, A, B, Q, R, N=None):
    A, B, Q, R = mat(A), mat(B), mat(Q), mat(R)
    N = np.zeros_like(B) if N is None else mat(N)
    X = linalg.solve_discrete_are(A, B, Q, R, s=N)
    K = linalg.solve(R + B.T @ X @ B, B.T @ X @ A + N.T)
    E = eig_pairs(A - B @ K)
    return {"id": cid, "fn": "dlqr",
            "inputs": {"A": A, "B": B, "Q": Q, "R": R, "N": N},
            "expected": {"X": X, "K": K, "E": E}}


def lqe_case(cid, A, G, C, QN, RN):
    A, G, C, QN, RN = mat(A), mat(G), mat(C), mat(QN), mat(RN)
    P = linalg.solve_continuous_are(A.T, C.T, G @ QN @ G.T, RN)
    L = P @ C.T @ np.linalg.inv(RN)
    E = eig_pairs(A - L @ C)
    return {"id": cid, "fn": "lqe",
            "inputs": {"A": A, "G": G, "C": C, "QN": QN, "RN": RN},
            "expected": {"P": P, "L": L, "E": E}}


def dlqe_case(cid, A, G, C, QN, RN):
    A, G, C, QN, RN = mat(A), mat(G), mat(C), mat(QN), mat(RN)
    P = linalg.solve_discrete_are(A.T, C.T, G @ QN @ G.T, RN)
    L = A @ P @ C.T @ np.linalg.inv(C @ P @ C.T + RN)
    E = eig_pairs(A - L @ C)
    return {"id": cid, "fn": "dlqe",
            "inputs": {"A": A, "G": G, "C": C, "QN": QN, "RN": RN},
            "expected": {"P": P, "L": L, "E": E}}


def zoh(Ac, Bc, Ts):
    """Discretização ZOH exata por expm da matriz aumentada."""
    n, m = Bc.shape
    M = np.zeros((n + m, n + m))
    M[:n, :n] = Ac
    M[:n, n:] = Bc
    Phi = linalg.expm(M * Ts)
    return Phi[:n, :n], Phi[:n, n:]


# Motor CC, estados [corrente, velocidade], entradas [tensão, torque de carga]
MOTOR_L, MOTOR_R, MOTOR_KE, MOTOR_KT, MOTOR_J, MOTOR_B = 0.5, 1.0, 0.01, 0.01, 0.01, 0.001
MOTOR_A = [[-MOTOR_R / MOTOR_L, -MOTOR_KE / MOTOR_L], [MOTOR_KT / MOTOR_J, -MOTOR_B / MOTOR_J]]
MOTOR_B_IN = [[1 / MOTOR_L, 0.0], [0.0, -1 / MOTOR_J]]

# Pêndulo invertido linearizado (carro + haste), estados [x, x', theta, theta']
PEND_M, PEND_m, PEND_l, PEND_g = 1.0, 0.1, 0.5, 9.81
PEND_A = [[0, 1, 0, 0],
          [0, 0, -PEND_m * PEND_g / PEND_M, 0],
          [0, 0, 0, 1],
          [0, 0, (PEND_M + PEND_m) * PEND_g / (PEND_M * PEND_l), 0]]
PEND_B = [[0], [1 / PEND_M], [0], [-1 / (PEND_M * PEND_l)]]


def build_cases():
    cases = []
    # Contínuo: ARE / lqr (6 casos)
    cases.append(lqr_case("lqr_integrador_duplo", [[0, 1], [0, 0]], [[0], [1]],
                          np.eye(2), [[1.0]]))
    cases.append(lqr_case("lqr_motor_cc_2x2", MOTOR_A, MOTOR_B_IN,
                          [[1, 0], [0, 0.1]], [[1, 0], [0, 0.01]]))
    cases.append(lqr_case("lqr_pendulo_invertido_4x4", PEND_A, PEND_B,
                          np.diag([1, 0.1, 10, 0.1]), [[1.0]]))
    cases.append(lqr_case("lqr_siso_1x1_instavel", [[0.7]], [[1.3]], [[2.0]], [[0.5]]))
    cases.append(lqr_case("lqr_mimo_R_nao_identidade", [[-1, 2], [0, -3]],
                          [[1, 0], [0.5, 1]], [[2, 0], [0, 1]], [[2, 0.5], [0.5, 1]]))
    cases.append(lqr_case("lqr_mimo_com_termo_cruzado_N", [[0.5, 1], [0, -2]],
                          [[0, 1], [1, 0.5]], [[2, 0], [0, 1]], [[1, 0.2], [0.2, 1]],
                          [[0.3, 0], [0.1, 0.2]]))
    # Contínuo: estimador (dualidade) lqe (1 caso)
    cases.append(lqe_case("lqe_2x2_saida_escalar", [[0.5, 1], [0, -1]], np.eye(2),
                          [[1, 0]], np.diag([0.5, 0.1]), [[0.01]]))
    # Discreto: DARE / dlqr (6 casos)
    Ts = 0.1
    cases.append(dlqr_case("dlqr_integrador_duplo_Ts0p1", [[1, Ts], [0, 1]],
                           [[Ts ** 2 / 2], [Ts]], np.eye(2), [[1.0]]))
    Ad, Bd = zoh(mat(MOTOR_A), mat(MOTOR_B_IN), 0.01)
    cases.append(dlqr_case("dlqr_motor_cc_Ts0p01", Ad, Bd,
                           [[1, 0], [0, 0.1]], [[1, 0], [0, 0.01]]))
    Ad, Bd = zoh(mat(PEND_A), mat(PEND_B), 0.02)
    cases.append(dlqr_case("dlqr_pendulo_invertido_Ts0p02", Ad, Bd,
                           np.diag([1, 0.1, 10, 0.1]), [[1.0]]))
    cases.append(dlqr_case("dlqr_siso_1x1_instavel", [[2.0]], [[1.0]], [[1.0]], [[1.0]]))
    cases.append(dlqr_case("dlqr_mimo_R_nao_identidade", [[0.9, 0.2], [0.1, 1.1]],
                           [[1, 0.5], [0, 1]], [[1, 0], [0, 2]], [[2, 0.5], [0.5, 1]]))
    cases.append(dlqr_case("dlqr_mimo_com_termo_cruzado_N", [[1.2, 0.5], [0, 0.8]],
                           [[0, 1], [1, 0.5]], [[2, 0], [0, 1]], [[1, 0.2], [0.2, 1]],
                           [[0.3, 0], [0.1, 0.2]]))
    # Discreto: estimador dlqe (2 casos)
    cases.append(dlqe_case("dlqe_siso_1x1_instavel", [[2.0]], [[1.0]], [[1.0]],
                           [[1.0]], [[1.0]]))
    cases.append(dlqe_case("dlqe_2x2_saida_escalar", [[1.1, 0.3], [0, 0.8]], [[1.0], [0.5]],
                           [[1, 0]], [[0.2]], [[0.1]]))
    return cases


def main(argv):
    if len(argv) != 2:
        sys.stderr.write("uso: gen_riccati.py <saida.json>\n")
        return 2
    doc = {
        "meta": {
            "gerado_em": GERADO_EM,
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "python": sys.version.split()[0],
            "referencia": "scipy.linalg.solve_continuous_are / solve_discrete_are; "
                          "fórmulas de python-control reescritas em NumPy/SciPy",
            "python_control": "control 0.10.2; conferido por scripts/reference/check_control.py",
            "codificacao": "NaN/Infinity como strings",
        },
        "cases": build_cases(),
    }
    with open(argv[1], "w", encoding="utf-8") as fh:
        json.dump(enc(doc), fh, ensure_ascii=False, indent=1, allow_nan=False)
        fh.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
