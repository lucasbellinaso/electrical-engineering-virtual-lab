#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera tests/fixtures/core-cmatrix.json: referência para assets/js/core/cmatrix.js.

Uso: python3 scripts/reference/gen_cmatrix.py <saida.json>

Referência: numpy.linalg (solve, inv, det, cond, norm) e numpy.matmul; transposta por .T e
hermitiana por .conj().T. Matrizes aleatórias usam numpy.random.RandomState(20261126) (determinístico).

Por caso (números complexos são pares [re, im]; matrizes são listas de linhas de pares):
- A (r x c) e B (pode ser não quadrada); r, c e `n` (ordem, só se quadrada); `real` (True se A e B têm
  parte imaginária nula) e `singular` (True se A é exatamente singular).
- `solve` = A⁻¹B, `inv` = A⁻¹, `det`, `trace` (só quadradas e não singulares, exceto det, que é o valor
  do NumPy mesmo nos singulares). `solve`, `inv`, `cond` e `tol` são None nos singulares e nas não quadradas.
- `AB` = A·B e `BA` = B·A (None se as dimensões não permitem o produto).
- `transpose` = A.T e `hermitian` = A.conj().T.
- `norm1`, `normInf`, `normFro` de A (norma 1, infinito e Frobenius do NumPy).
- `cond` = numpy.linalg.cond (2-norma) de A; `tol` = 64·ε·cond, ordem de grandeza do erro relativo
  esperado em solve/inv (ε = precisão de dupla, numpy.finfo(float).eps).

Casos: 1x1; 2x2 com resultado conhecido à mão (det = 3, X = [[1−j],[2]]); 3x3 e 5x5 aleatórios bem
condicionados; 4x4 com entradas reais; 4x4 puramente imaginária; hermitiana; permutação com fases
que exige pivotamento; Hilbert complexa 6x6 mal condicionada com fase; singular por linha repetida;
singular por coluna nula; retangular 2x3 por 3x2.
"""
import json
import sys

import numpy as np

EPS = float(np.finfo(float).eps)


def par(z):
    return [float(np.real(z)), float(np.imag(z))]


def mat(M):
    return [[par(z) for z in row] for row in np.asarray(M, dtype=complex)]


def caso(cid, A, B, singular=False, real=False):
    A = np.array(A, dtype=complex)
    B = np.array(B, dtype=complex)
    r, c = A.shape
    quadrada = r == c
    item = dict(id=cid, r=r, c=c, real=bool(real), singular=bool(singular),
                A=mat(A), B=mat(B),
                AB=mat(A @ B) if c == B.shape[0] else None,
                BA=mat(B @ A) if B.shape[1] == r else None,
                transpose=mat(A.T), hermitian=mat(A.conj().T),
                norm1=float(np.linalg.norm(A, 1)), normInf=float(np.linalg.norm(A, np.inf)),
                normFro=float(np.linalg.norm(A, "fro")))
    if quadrada:
        item["n"] = r
        item["det"] = par(np.linalg.det(A))
        item["trace"] = par(np.trace(A))
    else:
        item["n"] = None
        item["det"] = None
        item["trace"] = None
    if quadrada and not singular:
        item["solve"] = mat(np.linalg.solve(A, B))
        item["inv"] = mat(np.linalg.inv(A))
        cond = float(np.linalg.cond(A))
        item["cond"] = cond
        item["tol"] = 64 * EPS * cond
    else:
        item["solve"] = None
        item["inv"] = None
        item["cond"] = None
        item["tol"] = None
    return item


def main(saida):
    rs = np.random.RandomState(20261126)
    casos = []

    # 1x1
    casos.append(caso("escalar_1x1", [[2 - 1j]], [[1 + 1j, 3]]))

    # 2x2 com resultado conhecido à mão: det = 2·2 − (1j)(−1j) = 3; X = [[1−j], [2]]; B = A·X = [[2], [3−j]]
    A2 = [[2, 1j], [-1j, 2]]
    B2 = [[2], [3 - 1j]]
    assert abs(np.linalg.det(np.array(A2)) - 3) < 1e-14
    assert np.allclose(np.linalg.solve(np.array(A2), np.array(B2)), [[1 - 1j], [2]], atol=1e-14)
    casos.append(caso("mao_2x2_hermitiana", A2, B2))

    # aleatórias bem condicionadas (diagonal reforçada): 3x3 com 4 colunas em B, 5x5 com 3 colunas
    for n, m in ((3, 4), (5, 3)):
        A = rs.randn(n, n) + 1j * rs.randn(n, n) + n * np.eye(n)
        B = rs.randn(n, m) + 1j * rs.randn(n, m)
        casos.append(caso(f"aleatoria_{n}x{n}", A, B))

    # 4x4 com entradas puramente reais (cruzar com matrix.js)
    casos.append(caso("real_4x4", rs.randn(4, 4) + 2 * np.eye(4), rs.randn(4, 2), real=True))

    # 4x4 puramente imaginária
    casos.append(caso("imaginaria_4x4", 1j * (rs.randn(4, 4) + 2 * np.eye(4)), 1j * rs.randn(4, 2)))

    # hermitiana 4x4
    M = rs.randn(4, 4) + 1j * rs.randn(4, 4)
    casos.append(caso("hermitiana_4x4", M + M.conj().T, rs.randn(4, 2) + 1j * rs.randn(4, 2)))

    # permutação com fases que exige pivotamento (diagonal nula)
    P = np.array([[0, 1j, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1 + 1j], [2, 0, 0, 0]], dtype=complex)
    casos.append(caso("permutacao_pivotamento_4x4", P, rs.randn(4, 2) + 1j * rs.randn(4, 2)))

    # Hilbert complexa 6x6 com fase: mal condicionada
    n = 6
    H = np.array([[np.exp(1j * 0.37 * (i - 2 * j)) / (i + j + 1) for j in range(n)] for i in range(n)])
    casos.append(caso("hilbert_complexa_6x6", H, rs.randn(n, 2) + 1j * rs.randn(n, 2)))

    # singular exata por linha repetida (comprovada por posto)
    S1 = np.array([[1 + 2j, 2, 3j], [0.5, 1 - 1j, 2], [1 + 2j, 2, 3j]], dtype=complex)
    assert np.linalg.matrix_rank(S1) < 3
    casos.append(caso("singular_linha_repetida_3x3", S1, [[1], [2], [3j]], singular=True))

    # singular por coluna nula
    S2 = np.array([[1 + 1j, 0, 2], [3, 0, 1j], [2 - 1j, 0, 4]], dtype=complex)
    assert np.linalg.matrix_rank(S2) < 3
    casos.append(caso("singular_coluna_nula_3x3", S2, [[1, 0], [0, 1], [1j, 1]], singular=True))

    # retangular 2x3 por 3x2 (cmmul)
    R = rs.randn(2, 3) + 1j * rs.randn(2, 3)
    Sr = rs.randn(3, 2) + 1j * rs.randn(3, 2)
    casos.append(caso("retangular_2x3_por_3x2", R, Sr))

    out = dict(meta=dict(gerador="scripts/reference/gen_cmatrix.py",
                         numpy=np.__version__,
                         referencia="numpy.linalg (LAPACK: zgesv, zgetrf) e numpy.matmul",
                         seed=20261126, eps=EPS),
               casos=casos)
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("OK", saida, len(casos), "casos")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("uso: python3 scripts/reference/gen_cmatrix.py <saida.json>")
    main(sys.argv[1])
