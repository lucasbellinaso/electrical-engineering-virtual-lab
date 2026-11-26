#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera tests/fixtures/core-complex-hyperbolic.json: referência para sinh, cosh, tanh e sinhc
(assets/js/core/complex.js).

Uso: python3 scripts/reference/gen_complex_hyperbolic.py <saida.json>

Referência: mpmath com 80 dígitos decimais, independente do algoritmo do JS. sinh, cosh e tanh são
as funções complexas do próprio mpmath; sinhc = sinh(z)/z, com sinhc(0) = 1. O resultado é
arredondado para double (mpmath.mpf -> float). Casos cujo valor não cabe em double são omitidos e
listados em meta.omitidos.

Comparação com NumPy: numpy.sinh/cosh/tanh em complex128. Registra-se, por função, o maior erro
relativo ao módulo do resultado do NumPy contra a referência de alta precisão. Isso documenta que o
NumPy NÃO é a verdade nos casos difíceis (sinhc não existe no NumPy e é comparado apenas com a referência).

Pontos aleatórios: numpy.random.RandomState(20261126) (determinístico).
"""
import json
import math
import sys

import mpmath
import numpy as np
from mpmath import mp

mp.dps = 80
SEMENTE = 20261126


def ref(x, y):
    z = mpmath.mpc(x, y)
    zero = (x == 0 and y == 0)
    return {
        "sinh": mpmath.sinh(z),
        "cosh": mpmath.cosh(z),
        "tanh": mpmath.tanh(z),
        "sinhc": mpmath.mpc(1, 0) if zero else mpmath.sinh(z) / z,
    }


def par(w):
    return [float(mpmath.re(w)), float(mpmath.im(w))]


def numpy_val(f, x, y):
    z = np.complex128(complex(x, y))
    fn = {"sinh": np.sinh, "cosh": np.cosh, "tanh": np.tanh}[f]
    return complex(fn(z))


def pontos():
    pts = []
    def add(id_, x, y):
        pts.append((id_, float(x), float(y)))
    add("zero", 0.0, 0.0)
    for m in (1e-300, 1e-17, 1e-8, 1e-3, 0.1, 0.5, 0.99, 1.01, 2.0, 10.0):
        add(f"mod_{m:g}_real", m, 0.0)
        add(f"mod_{m:g}_imag", 0.0, m)
        add(f"mod_{m:g}_diag", m, m)
        add(f"mod_{m:g}_neg", -m, -m)
    for x in (1.0, 3.0, -2.5):
        add(f"real_{x:g}", x, 0.0)
    for y in (0.5, math.pi / 3, -2.2, 7.0):
        add(f"imag_{y:.6g}", 0.0, y)
    for k in (-2, -1, 0, 1, 2):
        yp = math.pi / 2 + k * math.pi
        for x in (0.0, 1e-8, -1e-8, 1e-4, -1e-4):
            add(f"polo_tanh_k{k}_x{x:g}", x, yp)
    for x in (15.0, 20.0, 21.0, 30.0, 100.0, 300.0, 700.0):
        for sx in (1.0, -1.0):
            for y in (0.0, 0.5, math.pi / 4, math.pi / 2, 2.0, -1.3):
                add(f"grande_x{sx * x:g}_y{y:.6g}", sx * x, y)
    rs = np.random.RandomState(SEMENTE)
    for i, (x, y) in enumerate(zip(rs.uniform(-3, 3, 40), rs.uniform(-4, 4, 40))):
        add(f"aleatorio_{i:02d}", x, y)
    for i, (x, y) in enumerate(zip(rs.uniform(-25, 25, 10), rs.uniform(-4, 4, 10))):
        add(f"aleatorio_grande_{i:02d}", x, y)
    return pts


def main(saida):
    casos, omitidos = [], []
    maior = {f: {"erro_relativo_modulo": 0.0, "id": None} for f in ("sinh", "cosh", "tanh")}
    for id_, x, y in pontos():
        r = ref(x, y)
        item = {"id": id_, "z": [x, y]}
        ok = True
        for f in ("sinh", "cosh", "tanh", "sinhc"):
            p = par(r[f])
            if not all(math.isfinite(v) for v in p):
                omitidos.append({"id": id_, "funcao": f, "motivo": "valor fora da faixa de double"})
                ok = False
                break
            item[f] = p
        if not ok:
            continue
        casos.append(item)
        for f in ("sinh", "cosh", "tanh"):
            ref_c = complex(*item[f])
            nv = numpy_val(f, x, y)
            mod = abs(ref_c)
            erro = abs(nv - ref_c) / mod if mod > 0 else abs(nv - ref_c)
            if erro > maior[f]["erro_relativo_modulo"]:
                maior[f] = {"erro_relativo_modulo": float(erro), "id": id_}
    meta = dict(
        gerador="scripts/reference/gen_complex_hyperbolic.py",
        python=sys.version.split()[0],
        numpy=np.__version__,
        mpmath=mpmath.__version__,
        precisao_dps=80,
        semente=SEMENTE,
        referencia="mpmath (sinh, cosh, tanh complexos; sinhc = sinh(z)/z, sinhc(0) = 1)",
        maior_erro_numpy=maior,
        omitidos=omitidos,
    )
    out = dict(meta=meta, casos=casos)
    with open(saida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1, allow_nan=False)
        f.write("\n")
    print("OK", saida, len(casos), "casos,", len(omitidos), "omitidos")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("uso: python3 scripts/reference/gen_complex_hyperbolic.py <saida.json>")
    main(sys.argv[1])
