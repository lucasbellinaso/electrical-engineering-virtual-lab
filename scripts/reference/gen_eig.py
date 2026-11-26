#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera tests/fixtures/core-eig.json: referência para eig/eigvals (assets/js/core/eigen.js).

Uso: python3 scripts/reference/gen_eig.py <saida.json>

Referência: scipy.linalg.eig (LAPACK dgeev) e, para matrizes simétricas, scipy.linalg.eigh.
Matrizes aleatórias usam numpy.random.RandomState(20261126) (determinístico).

Por caso: A, values (pares [re, im], ordenados por (re, im)), `vetores_unicos` (True se os autovalores são
distintos: só então os autovetores são únicos a menos de escala/fase e podem ser comparados com os do
LAPACK) e `vectors` (colunas de scipy, norma 2 unitária) com a lista `values_vec` na mesma ordem das colunas,
`defeituosa` (True se A não é diagonalizável: precisão dos autovalores cai para ~ε^(1/m)) e `tol` sugerida
para os autovalores.
"""
import json
import sys

import numpy as np
import scipy
from scipy import linalg


def par(z): return [float(np.real(z)), float(np.imag(z))]


def ordena(w):
    idx = sorted(range(len(w)), key=lambda i: (round(float(np.real(w[i])), 9), round(float(np.imag(w[i])), 9)))
    return idx


def caso(cid, A, defeituosa=False, tol=1e-9, simetrica=False):
    A = np.array(A, float)
    n = A.shape[0]
    if simetrica:
        w, V = linalg.eigh(A)
    else:
        w, V = linalg.eig(A)
    idx = ordena(w)
    ws = [w[i] for i in idx]
    distintos = all(abs(ws[i] - ws[j]) > 1e-6 * max(1.0, np.max(np.abs(w))) for i in range(n) for j in range(i + 1, n))
    item = dict(id=cid, A=A.tolist(), values=[par(z) for z in ws], simetrica=bool(simetrica), vetores_unicos=bool(distintos),
                defeituosa=bool(defeituosa), tol=tol)
    if distintos:
        item["values_vec"] = [par(w[i]) for i in range(n)]
        item["vectors"] = [[par(V[r, c]) for c in range(n)] for r in range(n)]
    return item


def companheira(coef):
    coef = np.array(coef, float); n = len(coef) - 1
    C = np.zeros((n, n)); C[0, :] = -coef[1:] / coef[0]; C[1:, :-1] = np.eye(n - 1)
    return C


def main(saida):
    rs = np.random.RandomState(20261126)
    casos = []
    casos.append(caso("escalar", [[3.5]]))
    casos.append(caso("diagonal", np.diag([3.0, -1.0, 2.0, 0.5])))
    casos.append(caso("triangular_superior", [[1, 2, 3], [0, 4, 5], [0, 0, 6]]))
    casos.append(caso("rotacao_2x2", [[np.cos(0.7), -np.sin(0.7)], [np.sin(0.7), np.cos(0.7)]]))
    casos.append(caso("real_2x2", [[2, 1], [0.5, 3]]))
    casos.append(caso("integrador_duplo", [[0, 1], [0, 0]], defeituosa=True, tol=1e-7))
    casos.append(caso("jordan_3x3", [[2, 1, 0], [0, 2, 1], [0, 0, 2]], defeituosa=True, tol=1e-4))
    casos.append(caso("identidade_3x3", np.eye(3)))
    casos.append(caso("repetido_nao_defeituoso", np.diag([2.0, 2.0, 3.0])))
    casos.append(caso("zero_3x3", np.zeros((3, 3))))
    casos.append(caso("circulante_3x3", [[0, 1, 0], [0, 0, 1], [1, 0, 0]]))
    casos.append(caso("companheira_grau_3", companheira([1, 6, 11, 6])))
    casos.append(caso("companheira_grau_7", companheira([1, -28, 322, -1960, 6769, -13132, 13068, -5040])))
    casos.append(caso("pendulo_invertido_4x4", [[0, 1, 0, 0], [0, -0.1818, 2.6727, 0], [0, 0, 0, 1], [0, -0.4545, 31.1818, 0]]))
    casos.append(caso("mal_escalada_3x3", [[1, 1e4, 0], [1e-4, 2, 1e3], [0, 1e-3, 3]]))
    casos.append(caso("hamiltoniana_4x4", [[0, 1, 0, 0], [0, 0, 0, -1], [-1, 0, 0, 0], [0, 0, -1, 0]]))
    for n in (2, 3, 4, 5, 6, 8, 10):
        casos.append(caso(f"aleatoria_{n}x{n}", rs.randn(n, n)))
    for n in (3, 5, 7):
        M = rs.randn(n, n); S = M + M.T
        casos.append(caso(f"simetrica_{n}x{n}", S, simetrica=True))
    S = np.diag([1.0, 1.0, 4.0]) + 0.0
    Q, _ = np.linalg.qr(rs.randn(3, 3))
    casos.append(caso("simetrica_autovalor_repetido", Q @ S @ Q.T, simetrica=True))
    out = dict(meta=dict(gerador="scripts/reference/gen_eig.py", numpy=np.__version__, scipy=scipy.__version__,
                         referencia="scipy.linalg.eig / eigh (LAPACK)"), casos=casos)
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write("\n")
    print("OK", saida, len(casos), "casos")


if __name__ == "__main__":
    if len(sys.argv) != 2: raise SystemExit("uso: python3 scripts/reference/gen_eig.py <saida.json>")
    main(sys.argv[1])
