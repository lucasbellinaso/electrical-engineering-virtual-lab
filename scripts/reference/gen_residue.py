#!/usr/bin/env python3
"""
Gera tests/fixtures/core-residue.json: referência scipy.signal para assets/js/core/residue.js.

Funções cobertas: residue, residuez, invres, invresz (com tol e rtype explícitos).
Convenções: coeficientes de b e a em ordem decrescente para residue/invres (polinômios em s)
e em ordem crescente de potências de z^-1 para residuez/invresz, como no SciPy.
Complexos são pares [re, im]. NaN/Inf são codificados como strings "NaN", "Infinity", "-Infinity".

Determinístico: nenhum sorteio; todos os casos são listas fixas.
Uso: python3 gen_residue.py <arquivo_saida.json>
"""
import datetime
import json
import math
import sys

import numpy as np
import scipy
from scipy import signal


def enc(x):
    """Converte escalar/array para JSON, codificando não finitos como strings."""
    if isinstance(x, (list, tuple)):
        return [enc(v) for v in x]
    if isinstance(x, np.ndarray):
        return [enc(v) for v in x.tolist()]
    if isinstance(x, (complex, np.complexfloating)):
        return [enc(float(x.real)), enc(float(x.imag))]
    x = float(x)
    if math.isnan(x):
        return "NaN"
    if math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    return x


def pairs(z):
    return [[float(v.real), float(v.imag)] for v in np.asarray(z, dtype=complex)]


def real_or_fail(c, label):
    """Coeficientes de saída de invres/invresz devem ser reais (parte imaginária desprezível)."""
    c = np.asarray(c, dtype=complex)
    scale = max(1.0, float(np.max(np.abs(c)))) if c.size else 1.0
    if c.size and float(np.max(np.abs(c.imag))) > 1e-10 * scale:
        raise SystemExit(f"{label}: saída do SciPy não é real; caso inadequado para o módulo")
    return [float(v) for v in c.real]


cases = []


def add_res(cid, fn, b, a, tol=1e-3, rtype="avg", note=""):
    fnc = signal.residue if fn == "residue" else signal.residuez
    r, p, k = fnc(b, a, tol=tol, rtype=rtype)
    cases.append({
        "id": cid, "fn": fn, "note": note,
        "input": {"b": enc(b), "a": enc(a), "tol": tol, "rtype": rtype},
        "expected": {"r": pairs(r), "p": pairs(p), "k": [float(v) for v in np.asarray(k).real]},
    })


def to_c(v):
    """Aceita escalar real ou par [re, im]."""
    if isinstance(v, (list, tuple)):
        return complex(v[0], v[1])
    return complex(v)


def add_inv(cid, fn, r, p, k, tol=1e-3, rtype="avg", note=""):
    fnc = signal.invres if fn == "invres" else signal.invresz
    r = [to_c(v) for v in r]
    p = [to_c(v) for v in p]
    b, a = fnc(np.asarray(r, dtype=complex), np.asarray(p, dtype=complex),
               np.asarray(k, dtype=float), tol=tol, rtype=rtype)
    cases.append({
        "id": cid, "fn": fn, "note": note,
        "input": {"r": pairs(r), "p": pairs(p), "k": enc(k), "tol": tol, "rtype": rtype},
        "expected": {"b": real_or_fail(b, cid), "a": real_or_fail(a, cid)},
    })


P = np.polymul
Q = np.poly  # polinômio mônico com raízes dadas (s)

# ---------------- residue (polinômios em s) ----------------
add_res("res_real_distintos", "residue", [1, 2], Q([-1, -2, -3]),
        note="polos reais distintos")
add_res("res_complexos_conjugados", "residue", [1, 0, 4], P([1, 2, 5], [1, 1]),
        note="par complexo conjugado mais polo real")
add_res("res_polo_duplo", "residue", [1], P(P([1, 1], [1, 1]), [1, 3]),
        note="polo real duplo em -1")
add_res("res_polo_triplo_estrito", "residue", [1, 3], [1, 6, 12, 8],
        note="polo triplo em -2, grau do numerador < denominador")
add_res("res_polo_triplo_impropria", "residue", [1, 3, 5, 7], [1, 6, 12, 8],
        note="polo triplo com grau do numerador igual ao do denominador (termo direto)")
add_res("res_impropria", "residue", [1, 0, 3, 2, 1], [1, 3, 2],
        note="grau do numerador 4 > denominador 2: termo direto k")
add_res("res_polo_origem", "residue", [1, 2], [1, 5, 4, 0],
        note="polo na origem")
add_res("res_complexo_duplo", "residue", [2, 1], P([1, 2, 5], [1, 2, 5]),
        note="par complexo conjugado com multiplicidade 2")
add_res("res_zeros_a_esquerda_b", "residue", [0, 0, 1, 2], [1, 4, 3],
        note="zeros à esquerda em b (trim) e grau b < grau a")
add_res("res_rtype_max", "residue", [1, 1], P([1, 2, 1], [1, 4]), tol=1e-3, rtype="max",
        note="polo duplo numérico agrupado com rtype max")
add_res("res_rtype_min", "residue", [1, 1], P([1, 2, 1], [1, 4]), tol=1e-3, rtype="min",
        note="polo duplo numérico agrupado com rtype min")
add_res("res_agrupamento_tol", "residue", [1], P([1, 1], [1, 1.0001]), tol=1e-3,
        note="polos separados por 1e-4 < tol: agrupados num polo duplo")
add_res("res_sem_agrupamento_tol", "residue", [1], P([1, 1], [1, 1.01]), tol=1e-3,
        note="polos separados por 1e-2 > tol: não agrupados")
add_res("res_misto", "residue", [1, 1, 1], P(P([1, 2, 5], [1, 3]), [1, 3]),
        note="complexo, real simples e real duplo juntos")
add_res("res_numerador_zero", "residue", [0, 0], [1, 3, 2],
        note="numerador nulo: resíduos zero e polos ordenados por módulo")

# ---------------- residuez (polinômios em z^-1) ----------------
add_res("resz_real_distintos", "residuez", [1, 0.5], P([1, -0.5], [1, -0.25]),
        note="polos reais distintos em z")
add_res("resz_complexos", "residuez", [1, 0.3], [1, -0.9, 0.81],
        note="polos complexos conjugados |p|=0.9")
add_res("resz_polo_duplo", "residuez", [1], P([1, -0.5], [1, -0.5]),
        note="polo duplo real")
add_res("resz_polo_triplo_impropria", "residuez", [2, -1, 0.5, 0.3, 1], P(P([1, -0.5], [1, -0.5]), [1, -0.5]),
        note="polo triplo com termo direto em z")
add_res("resz_misto", "residuez", [1, 0, 0.2], P(P([1, -0.9, 0.81], [1, -0.3]), [1, -0.3]),
        note="complexo, real simples e real duplo")
add_res("resz_zero_final_a", "residuez", [1, 1], [1, -0.5, 0],
        note="zero final em a é removido (trim 'b') antes de roots")
add_res("resz_numerador_zero", "residuez", [0, 0], [1, -0.5],
        note="numerador nulo")

# ---------------- invres / invresz (direto de r, p, k) ----------------
add_inv("inv_real_distintos", "invres", [1, 2, 3], [-1, -2, -3], [])
add_inv("inv_complexo", "invres", [[1, 0], [0.5, 0.25], [0.5, -0.25]], [[-1, 0], [-1, 2], [-1, -2]], [])
add_inv("inv_duplo", "invres", [1, 2], [-1, -1], [3], note="1/(s+1) e 2/(s+1)^2 com termo direto 3")
add_inv("inv_k_trim_zeros", "invres", [1, 4], [-2, -3], [0, 0, 1, 2], note="k com zeros à esquerda")
add_inv("inv_polo_origem", "invres", [2, 1], [0, -1], [1], note="polo na origem")
add_inv("inv_agrupamento_rtype_max", "invres", [1, 1], [-1, -1.0001], [], tol=1e-3, rtype="max")
add_inv("inv_agrupamento_avg_quirk", "invres", [1, 1], [-1, -1.0004], [], tol=1e-3, rtype="avg",
        note="invres usa _group_poles: o polo do grupo é o PRIMEIRO da lista, não a média (rtype ignorado)")
add_inv("inv_agrupamento_rtype_min", "invres", [1, 1], [-1, -1.0001], [], tol=1e-3, rtype="min")

add_inv("invz_real", "invresz", [1, 2], [0.5, 0.25], [1, 2], note="termo direto em z")
add_inv("invz_complexo", "invresz", [[0.5, 0.25], [0.5, -0.25], [1, 0]],
        [[0.9 * math.cos(math.pi / 3), 0.9 * math.sin(math.pi / 3)],
         [0.9 * math.cos(math.pi / 3), -0.9 * math.sin(math.pi / 3)], [0.3, 0]], [])
add_inv("invz_duplo", "invresz", [1, 2], [0.5, 0.5], [0, 2, 1, 0], note="k com zeros finais")

# Round-trip SciPy: invres(residue(b, a)) e invresz(residuez(b, a)) para uso no teste JS.
rt = []
for cid, fn, b, a in [
    ("rt_residue_misto", "residue", [1, 1, 1], P(P([1, 2, 5], [1, 3]), [1, 3])),
    ("rt_residue_impropria", "residue", [1, 0, 3, 2, 1], [1, 3, 2]),
]:
    r, p, k = signal.residue(b, a)
    bb, aa = signal.invres(r, p, k)
    rt.append({"id": cid, "fn": "residue->invres", "input": {"b": enc(b), "a": enc(a)},
               "expected": {"b": real_or_fail(bb, cid), "a": real_or_fail(aa, cid)}})

doc = {
    "meta": {
        "gerado_por": "scripts/reference/gen_residue.py",
        "numpy": np.__version__,
        "scipy": scipy.__version__,
        "data": datetime.date.today().isoformat(),
        "convencao_nan": "NaN, Infinity e -Infinity como strings",
        "complexos": "pares [re, im]",
    },
    "cases": cases,
    "roundtrip": rt,
}

out = sys.argv[1]
with open(out, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1, allow_nan=False)
    f.write("\n")
print(out, len(cases), "casos", len(rt), "round-trip")
