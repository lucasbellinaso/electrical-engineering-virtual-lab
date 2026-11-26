#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera tests/fixtures/core-models.json: referência para tf, ss, zpk, negate, append e modred
(assets/js/core/models.js), calculada com o python-control de verdade.

Uso: python3 scripts/reference/gen_models.py <saida.json>

- ss/tf/zpk: ct.ss, ct.tf, ct.zpk (dimensões, D matricial, remoção de zeros à esquerda).
- negate: -sys (ct.negate) em SS, TF e ZPK.
- append: ct.append sobre sistemas SS (matrizes em blocos diagonais, comparação exata).
- modred: ct.model_reduction(sys, elim_states=..., method=...) em 'matchdc' e 'truncate'.
  'matchdc' discreto não existe no python-control 0.10.2 (NotImplementedError): esses casos não
  entram aqui; o teste JS confere o ganho em z = 1.
"""
import json
import sys
import warnings

import numpy as np
import scipy
import control as ct

warnings.simplefilter("ignore")
lst = lambda M: np.asarray(M, dtype=float).tolist()


def ssd(s):
    return dict(A=lst(s.A), B=lst(s.B), C=lst(s.C), D=lst(s.D))


SIST = {
    "siso_2": dict(A=[[0, 1], [-2, -3]], B=[[0], [1]], C=[[1, 0]], D=[[0]]),
    "siso_4_com_D": dict(A=[[-1, 1, 0, 0], [0, -2, 1, 0], [0, 0, -5, 2], [1, 0, 0, -8.0]],
                         B=[[0], [0], [0], [1]], C=[[1, 0, 2, 0]], D=[[0.5]]),
    "mimo_3x2x2": dict(A=[[-1, 0.5, 0], [0, -2, 1], [0.3, 0, -4.0]],
                       B=[[1, 0], [0, 1], [1, 1]], C=[[1, 0, 0], [0, 1, 1]], D=[[0, 0.1], [0.2, 0]]),
    "mimo_5": dict(A=(np.diag([-1, -2, -3, -4, -6.0]) + 0.3 * np.eye(5, k=1) - 0.2 * np.eye(5, k=-1)).tolist(),
                   B=[[1, 0], [0, 0], [0, 1], [1, 0], [0, 1]], C=[[1, 0, 0, 1, 0], [0, 1, 0, 0, 1], [1, 1, 1, 0, 0]],
                   D=[[0, 0], [0, 0], [0, 0.5]]),
}


def mk(d, dt=0):
    return ct.ss(np.array(d["A"]), np.array(d["B"]), np.array(d["C"]), np.array(d["D"]), dt)


def run_modred():
    casos = [("siso_2", [1]), ("siso_4_com_D", [2, 3]), ("siso_4_com_D", [0]), ("mimo_3x2x2", [2]),
             ("mimo_5", [3, 4]), ("mimo_5", [1, 3]), ("mimo_5", [0, 1, 2, 3])]
    out = []
    for nome, elim in casos:
        d = SIST[nome]
        for metodo in ("matchdc", "truncate"):
            r = ct.model_reduction(mk(d), elim_states=elim, method=metodo, warn_unstable=False)
            out.append(dict(id=f"{nome}_elim{''.join(map(str, elim))}_{metodo}", sys=d, elim=elim,
                            method=metodo, expected=ssd(r)))
    return out


def run_negate():
    out = []
    for nome, d in SIST.items():
        out.append(dict(id=f"ss_{nome}", sys=d, expected=ssd(-mk(d))))
    tfs = [([1.0], [1, 2.0]), ([1, 0, 4.0], [1, 3, 2.0]), ([2.0], [1.0])]
    for i, (n, dd) in enumerate(tfs):
        e = -ct.tf(n, dd)
        out.append(dict(id=f"tf_{i}", num=n, den=dd, expected=dict(num=lst(e.num[0][0]), den=lst(e.den[0][0]))))
    return out


def run_append():
    out = []
    comb = [("siso_2",), ("siso_2", "siso_4_com_D"), ("mimo_3x2x2", "siso_2"), ("siso_2", "mimo_5", "mimo_3x2x2")]
    for nomes in comb:
        s = ct.append(*[mk(SIST[n]) for n in nomes])
        out.append(dict(id="+".join(nomes), sistemas=[SIST[n] for n in nomes], expected=ssd(s)))
    sd = ct.append(mk(SIST["siso_2"], 0.1), mk(SIST["siso_4_com_D"], 0.1))
    out.append(dict(id="discreto_dt0p1", dt=0.1, sistemas=[SIST["siso_2"], SIST["siso_4_com_D"]], expected=ssd(sd)))
    return out


def run_construtores():
    ss_ = []
    for nome, d in SIST.items():
        s = mk(d)
        ss_.append(dict(id=nome, args=d, expected=ssd(s)))
    tf_ = []
    for n, dd in [([0, 0, 1.0], [1, 2.0, 5.0]), ([1.0, 2.0], [0, 3.0, 1.0]), ([4.0], [2.0])]:
        t = ct.tf(n, dd)
        tf_.append(dict(num=n, den=dd, expected=dict(num=lst(t.num[0][0]), den=lst(t.den[0][0]))))
    zp = []
    for z, p, k in [([-1.0], [-2.0, -3.0], 2.0), ([], [-1.0, -5.0], 1.0), ([-0.5 + 1j, -0.5 - 1j], [-1.0, -2.0, -3.0], -4.0)]:
        zp.append(dict(z=[[x.real, x.imag] for x in map(complex, z)],
                       p=[[x.real, x.imag] for x in map(complex, p)], k=k,
                       expected_tf=(lambda t: dict(num=lst(t.num[0][0]), den=lst(t.den[0][0])))(
                           ct.tf(np.real(np.poly(z)) * k if len(z) else [k], np.real(np.poly(p))))))
    return ss_, tf_, zp


def main(saida):
    ss_, tf_, zp = run_construtores()
    out = dict(meta=dict(gerador="scripts/reference/gen_models.py", numpy=np.__version__, scipy=scipy.__version__,
                         python_control="control " + ct.__version__, python=sys.version.split()[0]),
               ss=ss_, tf=tf_, zpk=zp, negate=run_negate(), append=run_append(), modred=run_modred())
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write("\n")
    print("OK", saida, {k: len(v) for k, v in out.items() if isinstance(v, list)})


if __name__ == "__main__":
    if len(sys.argv) != 2: raise SystemExit("uso: python3 scripts/reference/gen_models.py <saida.json>")
    main(sys.argv[1])
