#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera tests/fixtures/core-d2c.json: referência para d2c (assets/js/core/control.js) e logm
(assets/js/core/matrix.js).

Uso: python3 scripts/reference/gen_d2c.py <saida.json>

O python-control NÃO tem d2c. A referência é a função d2c do autor (`d2c_usuario`, copiada sem
alterações de lógica; já validada por ele). Cada resultado é conferido de duas formas independentes:
- ZOH: ct.c2d(d2c(sys), Ts, 'zoh') reproduz o sistema discreto, e o sistema contínuo recuperado
  coincide com o protótipo de que o discreto saiu.
- Tustin: a função de transferência de d2c(sys) coincide com a do protótipo (a realização em
  espaço de estados de d2c_usuario/tustin difere de scipy/control por um reescalonamento de estados
  B,C; por isso o critério é a função de transferência).

ZOH com integrador (autovalor de Ad em 1): Ad − I é singular e a fórmula B = (Ad−I)⁻¹·A·Bd do autor
falha (LinAlgError). Nesses casos usa-se `d2c_gamma`, que calcula B = Γ⁻¹·Bd com
Γ = ∫₀ᵀ e^{Aτ}dτ (bloco superior direito de expm([[A, I],[0, 0]]·Ts)); é a mesma conta quando
Ad − I é invertível, o que o gerador verifica em todos os casos onde a fórmula do autor roda.
"""
import json
import sys

import numpy as np
import scipy
import control as ct
from scipy.linalg import logm, inv, expm, solve
from control import tf2ss, ss2tf, ss, TransferFunction


def d2c_usuario(sys, method='zoh'):
    """Função do autor (lógica original). Discrete to continuous-time system conversion."""
    if (sys.dt == 0 or method not in ['zoh', 'tustin']):
        return 0
    sysss = tf2ss(sys) if (type(sys) == TransferFunction) else sys
    Ad, Bd, Cd, Dd, Ts = sysss.A, sysss.B, sysss.C, sysss.D, sysss.dt
    n = Ad.shape[0]
    if (method == 'zoh'):
        A = logm(Ad) / Ts
        B = inv(Ad - np.eye(n)) @ A @ Bd
        sysc = ss(A, B, Cd, Dd)
        return ss2tf(sysc) if (type(sys) == TransferFunction) else sysc
    if (method == 'tustin'):
        alfa = 2 / Ts
        A = alfa * inv(Ad + np.eye(n)) @ (Ad - np.eye(n))
        B = (alfa * np.eye(n) - A) @ Bd
        C = Cd @ inv(Ad + np.eye(n))
        D = Dd - C @ Bd
        sysc = ss(A, B, C, D)
        return ss2tf(sysc) if (type(sys) == TransferFunction) else sysc


def d2c_gamma(sys, method='zoh'):
    """Igual a d2c_usuario, mas B (ZOH) = Γ⁻¹·Bd; vale também quando Ad − I é singular."""
    if method != 'zoh':
        return d2c_usuario(sys, method)
    sysss = tf2ss(sys) if (type(sys) == TransferFunction) else sys
    Ad, Bd, Cd, Dd, Ts = sysss.A, sysss.B, sysss.C, sysss.D, sysss.dt
    n = Ad.shape[0]
    A = logm(Ad) / Ts
    M = np.zeros((2 * n, 2 * n)); M[:n, :n] = A * Ts; M[:n, n:] = np.eye(n) * Ts
    Gam = expm(M)[:n, n:]
    B = solve(Gam, Bd)
    sysc = ss(A, B, Cd, Dd)
    return ss2tf(sysc) if (type(sys) == TransferFunction) else sysc


def mat(x): return np.atleast_2d(np.array(x, float))
def lst(x): return np.asarray(x, float).tolist()
def trim(p, rel=1e-9):
    p = np.atleast_1d(np.asarray(p, float)); m = np.max(np.abs(p))
    return p[np.nonzero(np.abs(p) > rel * m)[0][0]:]
def tfnorm(t):
    num, den = trim(t.num[0][0]), trim(t.den[0][0])
    return (num / den[0]), (den / den[0])
def ssd(A, B, C, D): return dict(A=lst(mat(A)), B=lst(mat(B)), C=lst(mat(C)), D=lst(mat(D)))
def close(a, b, tol=1e-8): return np.allclose(np.asarray(a, float), np.asarray(b, float), rtol=tol, atol=tol)
def check(c, msg):
    if not c: raise SystemExit("FALHA: " + msg)

W = np.array([0.05, 0.3, 0.83, 2.7, 6.0])   # rad/s para comparar funções de transferência


def fr(sysx, w):
    return np.array([np.asarray(ct.evalfr(sysx, 1j * x)) for x in w])


# protótipos contínuos (id, A, B, C, D, Ts)
PROTOS = [
    ("primeira_ordem", [[-3.0]], [[2.0]], [[1.0]], [[0.0]], 0.1),
    ("segunda_ordem_subamortecida", [[0, 1], [-4, -1.2]], [[0], [1]], [[1, 0]], [[0]], 0.1),
    ("terceira_ordem_com_feedthrough", [[-6, -11, -6], [1, 0, 0], [0, 1, 0]], [[1], [0], [0]], [[0, 2, 5]], [[0.5]], 0.05),
    ("integrador_duplo", [[0, 1], [0, 0]], [[0], [1]], [[1, 0]], [[0]], 0.1),
    ("mimo_2x2", [[-1, 0.5], [-0.3, -2]], [[1, 0], [0, 1]], [[1, 0.5], [0, 1]], [[0, 0], [0.2, 0]], 0.2),
    ("instavel_escalar", [[0.7]], [[1.3]], [[1.0]], [[0.0]], 0.1),
    ("oscilador_marginal", [[0, 1], [-1, 0]], [[0], [1]], [[1, 0]], [[0]], 0.1),
]
TF_PROTOS = [
    ("tf_primeira_ordem", [2.0], [1.0, 3.0], 0.1),
    ("tf_segunda_ordem", [4.0], [1.0, 1.2, 4.0], 0.1),
    ("tf_terceira_ordem_com_zero", [1.0, 2.0], [1.0, 6.0, 11.0, 6.0], 0.05),
    ("tf_duplo_integrador", [1.0], [1.0, 0.0, 0.0], 0.1),
]


def run_ss(method):
    out = []
    for nome, A, B, C, D, Ts in PROTOS:
        proto = ct.ss(mat(A), mat(B), mat(C), mat(D))
        disc = ct.c2d(proto, Ts, method='zoh' if method == 'zoh' else 'tustin')
        ref, nome_ref = None, "usuario"
        try:
            ref = d2c_usuario(disc, method)
        except np.linalg.LinAlgError:
            check(method == 'zoh', f"{nome}: fórmula do autor falhou em tustin")
            ref, nome_ref = d2c_gamma(disc, method), "gamma"
        if nome_ref == "usuario" and method == 'zoh':
            g = d2c_gamma(disc, method)       # mesma conta com Γ: confere a equivalência
            for k in "ABCD": check(close(getattr(g, k), getattr(ref, k), 1e-9), f"{nome}: gamma != usuario em {k}")
        if method == 'zoh':
            for k in "ABCD": check(close(getattr(ref, k), getattr(proto, k)), f"{nome}: ZOH não recupera o protótipo ({k})")
            back = ct.c2d(ref, Ts, method='zoh')
            for k in "ABCD": check(close(getattr(back, k), getattr(disc, k)), f"{nome}: c2d(d2c) != discreto ({k})")
        else:
            check(np.allclose(fr(ref, W), fr(proto, W), rtol=1e-8, atol=1e-10), f"{nome}: Tustin não recupera a FT do protótipo")
        out.append(dict(id=f"{method}/{nome}", Ts=Ts, referencia=nome_ref,
                        disc=ssd(disc.A, disc.B, disc.C, disc.D),
                        expected=ssd(ref.A, ref.B, ref.C, ref.D),
                        proto=ssd(proto.A, proto.B, proto.C, proto.D)))
    return out


def run_tf(method):
    out = []
    for nome, num, den, Ts in TF_PROTOS:
        proto = ct.tf(num, den)
        disc = ct.c2d(proto, Ts, method='zoh' if method == 'zoh' else 'tustin')
        nd, dd = tfnorm(disc)
        ref, nome_ref = None, "usuario"
        try:
            ref = d2c_usuario(disc, method)
        except np.linalg.LinAlgError:
            check(method == 'zoh', f"{nome}: fórmula do autor falhou em tustin")
            ref, nome_ref = d2c_gamma(disc, method), "gamma"
        pn, pd = tfnorm(proto); rn, rd = tfnorm(ref)
        check(len(pn) == len(rn) and len(pd) == len(rd) and close(pn, rn) and close(pd, rd),
              f"{nome} ({method}): FT recuperada difere do protótipo: {rn}/{rd} vs {pn}/{pd}")
        out.append(dict(id=f"{method}/{nome}", Ts=Ts, referencia=nome_ref,
                        disc=dict(num=lst(nd), den=lst(dd)), expected=dict(num=lst(rn), den=lst(rd)),
                        proto=dict(num=lst(pn), den=lst(pd))))
    return out


def run_logm():
    cases = [("identidade_3x3", np.eye(3)), ("diagonal", np.diag([np.e, np.e ** 2, 0.5])),
             ("rotacao_0p7", [[np.cos(0.7), -np.sin(0.7)], [np.sin(0.7), np.cos(0.7)]]),
             ("jordan_1", [[1, 1], [0, 1]]), ("geral_2x2", [[2, 1], [0.5, 3]]),
             ("expm_de_A3", expm(np.array([[-1, 2, 0], [0, -3, 1], [0.5, 0, -2.0]]))),
             ("proximo_da_identidade", np.eye(2) + 1e-3 * np.array([[1, 2], [3, 4.0]]))]
    return [dict(id=n, A=lst(mat(A)), expected=lst(logm(mat(A)).real)) for n, A in cases]


def main(saida):
    out = dict(
        meta=dict(gerador="scripts/reference/gen_d2c.py", numpy=np.__version__, scipy=scipy.__version__,
                  python_control=ct.__version__, python=sys.version.split()[0],
                  referencia="d2c_usuario (função do autor); validada por c2d(d2c) = discreto (ZOH) e "
                             "FT recuperada = FT do protótipo (Tustin)",
                  nota_zoh_integrador="Ad − I singular com integrador: referência = d2c_gamma (B = Γ⁻¹·Bd)"),
        zoh_ss=run_ss('zoh'), tustin_ss=run_ss('tustin'),
        zoh_tf=run_tf('zoh'), tustin_tf=run_tf('tustin'), logm=run_logm())
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write("\n")
    print("OK", saida, {k: len(v) for k, v in out.items() if isinstance(v, list)})
    print("referencia gamma em:", [c["id"] for k in ("zoh_ss", "zoh_tf") for c in out[k] if c["referencia"] == "gamma"])


if __name__ == "__main__":
    if len(sys.argv) != 2: raise SystemExit("uso: python3 scripts/reference/gen_d2c.py <saida.json>")
    main(sys.argv[1])
