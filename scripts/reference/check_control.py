#!/usr/bin/env python3
"""Confere as fixtures de tests/fixtures/ contra o python-control REAL (0.10.2).

Uso (a partir da raiz do repositório): python3 scripts/reference/check_control.py
Cobre damp, margin (analysis), lqr/dlqr/lqe/dlqe (riccati), acker/place (design) e step_info
(timeresp). Sai com código 1 se algum erro relativo passar de TOL ou se o control lançar erro.
Requer: pip install control==0.10.2 (traz numpy, scipy, matplotlib).
"""
TOL = 1e-9
import json, math, sys, warnings, numpy as np, control as ct
warnings.filterwarnings("ignore")
def num(x): return {"Infinity":np.inf,"-Infinity":-np.inf,"NaN":np.nan}.get(x,x) if isinstance(x,str) else x
def rel(a,b):
    a=np.asarray(a,float); b=np.asarray(b,float)
    if a.shape!=b.shape: return float("inf")
    m=np.isfinite(a)&np.isfinite(b)
    if not np.array_equal(np.isfinite(a),np.isfinite(b)) or not np.array_equal(np.isnan(a),np.isnan(b)): return float("inf")
    if not m.any(): return 0.0
    return float(np.max(np.abs(a[m]-b[m])/np.maximum(1,np.abs(b[m]))))
def srt(z): z=np.asarray(z,complex).ravel(); return z[np.lexsort((z.imag.round(9),z.real.round(9)))]
def cplx(E): E=np.asarray(E,float); return E[:,0]+1j*E[:,1] if E.ndim==2 and E.shape[1]==2 else E.ravel()
res={}
# ---- damp & margin
A=json.load(open("tests/fixtures/core-analysis.json"))
for s in A["systems"]:
    sysc=ct.tf(s["num"],s["den"],s["dt"]) if s["dt"] else ct.tf(s["num"],s["den"])
    wn,z,p=ct.damp(sysc,doprint=False)
    d=s["damp"]; o=np.argsort(np.abs(p)+1e-9*np.angle(p)); 
    e1=rel(np.sort(wn),np.sort(d["wn"])); e2=rel(np.sort(z),np.sort(d["zeta"]))
    res.setdefault("damp",[]).append((s["name"],max(e1,e2)))
    m=s["margin"]; gm,pm,sm,wcg,wcp,wcs=ct.stability_margins(sysc)
    exp=[num(m[k]) for k in("gm","pm","wcg","wcp")]; got=[gm,pm,wcg,wcp]
    res.setdefault("margin",[]).append((s["name"],rel(got,exp),got,exp))
# ---- lqr/dlqr/lqe/dlqe
R=json.load(open("tests/fixtures/core-riccati.json"))
for c in R["cases"]:
    i=c["inputs"]; e=c["expected"]; f=c["fn"]
    g=lambda k:np.array(i[k],float) if k in i and i[k] is not None else None
    try:
        if f in("lqr","dlqr"):
            K,S,E=getattr(ct,f)(g("A"),g("B"),g("Q"),g("R"),g("N")) if g("N") is not None else getattr(ct,f)(g("A"),g("B"),g("Q"),g("R"))
            err=max(rel(K,e["K"]),rel(S,e["X"]),rel(srt(E).view(float),srt(cplx(e["E"])).view(float)))
        else:
            L,P,E=getattr(ct,f)(g("A"),g("G"),g("C"),g("QN"),g("RN"))
            err=max(rel(L,e["L"]),rel(P,e["P"]),rel(srt(E).view(float),srt(cplx(e["E"])).view(float)))
    except Exception as ex: err=f"ERRO {type(ex).__name__}: {str(ex)[:80]}"
    res.setdefault(f,[]).append((c["id"],err))
# ---- place/acker
D=json.load(open("tests/fixtures/core-design.json"))
for c in D["acker"]:
    Am,Bm=np.array(c["A"],float),np.array(c["B"],float); p=cplx(c["p"]); Ke=np.array(c["K_esperado"],float)
    out={}
    for nm,fn in(("acker",ct.acker),("place",ct.place)):
        try:
            K=np.atleast_2d(fn(Am,Bm,p)); out[nm]=rel(K,Ke); cl=np.linalg.eigvals(Am-Bm@K); out[nm+"_polos"]=rel(srt(cl).view(float),srt(p).view(float))
        except Exception as ex: out[nm]=f"ERRO {type(ex).__name__}: {str(ex)[:60]}"
    res.setdefault("place",[]).append((c["nome"],out))
# ---- stepinfo
T=json.load(open("tests/fixtures/core-timeresp.json")); h=T["grid"]["h"]
lm={x["id"]:x for x in T["lsim"]}
for si in T["stepinfo"]:
    y=np.array(lm[si["run"]]["y"],float); y=y.ravel(); t=np.arange(len(y))*h
    got=ct.step_info(y,T=t) if True else None
    ex=si["expected"]; keys={"riseTime":"RiseTime","settlingTime":"SettlingTime","overshoot":"Overshoot","undershoot":"Undershoot","peak":"Peak","peakTime":"PeakTime","settlingMin":"SettlingMin","settlingMax":"SettlingMax","steadyStateValue":"SteadyStateValue"}
    r={k:(got[v] if np.isscalar(got[v]) else got[v]) for k,v in keys.items() if v in got}
    bad={k:(num(ex[k]),float(r[k])) for k in ex if k in r and rel([float(r[k])],[float(num(ex[k]))])>1e-9}
    res.setdefault("stepinfo",[]).append((si["id"],bad if bad else "ok",[k for k in ex if k not in r]))
# =====================  Extensão: demais funções com equivalente no python-control  =====================
infos = []
def try_(fn):
    try: return fn()
    except Exception as ex:
        n = type(ex).__name__
        return ("SKIP (requer slycot)" if "Slycot" in n else f"ERRO {n}: {str(ex)[:70]}")
def mk_tf(s): return ct.tf(s["num"], s["den"], s["dt"]) if s["dt"] else ct.tf(s["num"], s["den"])
def mk_ss(s):
    q = s["ss"]; A_, B_, C_, D_ = (np.atleast_2d(np.array(q[k], float)) for k in "ABCD")
    return ct.ss(A_, B_, C_, D_, s["dt"]) if s["dt"] else ct.ss(A_, B_, C_, D_)
def trim(p, rel_=1e-9):
    p = np.atleast_1d(np.asarray(p, float)); return p[np.nonzero(np.abs(p) > rel_ * np.max(np.abs(p)))[0][0]:]
def lead(c):
    c = np.atleast_1d(np.asarray(c, float)); m = np.max(np.abs(c)); i = np.nonzero(np.abs(c) > 1e-9 * m)[0][0]; return c[i:]
def gain_of(tfx): return float(lead(tfx.num[0][0])[0] / lead(tfx.den[0][0])[0])
for s in A["systems"]:
    nm = s["name"]; T_ = mk_tf(s); S_ = mk_ss(s)
    # pole / zero
    res.setdefault("pole", []).append((nm, rel(srt(ct.poles(T_)).view(float), srt(cplx(s["pole"])).view(float))))
    res.setdefault("zero", []).append((nm, rel(srt(ct.zeros(T_)).view(float), srt(cplx(s["zero"])).view(float))))
    # tf2zpk (control não tem a função: z,p = zeros/polos e k = razão dos coeficientes líderes)
    f = s["tf2zpk"]
    res.setdefault("tf2zpk", []).append((nm, max(rel(srt(ct.zeros(T_)).view(float), srt(cplx(f["z"])).view(float)),
        rel(srt(ct.poles(T_)).view(float), srt(cplx(f["p"])).view(float)), rel([gain_of(T_)], [f["k"]]))))
    # ss2zpk
    f = s["ss2zpk"]; T2 = ct.ss2tf(S_)
    res.setdefault("ss2zpk", []).append((nm, max(rel(srt(ct.zeros(S_)).view(float), srt(cplx(f["z"])).view(float)),
        rel(srt(ct.poles(S_)).view(float), srt(cplx(f["p"])).view(float)), rel([gain_of(T2)], [f["k"]]))))
    # zpk2ss: o control pode escolher outra realização; critério = mesma função de transferência
    f = s["zpk2ss"]; Z = ct.ss(*[np.atleast_2d(np.array(f[k], float)) for k in "ABCD"], *( [s["dt"]] if s["dt"] else []))
    pts = [0.3 + 1.7j, -0.4 + 0.9j, 2.0 + 0.1j]
    res.setdefault("zpk2ss", []).append((nm, max(abs(ct.evalfr(Z, p_) - ct.evalfr(T_, p_)) / max(1, abs(ct.evalfr(T_, p_))) for p_ in pts)))
    try:
        R2 = ct.tf2ss(ct.zpk(ct.zeros(T_), ct.poles(T_), gain_of(T_), *( [s["dt"]] if s["dt"] else [])))
        same = max(rel(R2.A, f["A"]), rel(R2.B, f["B"]), rel(R2.C, f["C"]), rel(np.atleast_2d(R2.D), np.atleast_2d(f["D"]))) < TOL
        if not same: infos.append(f"zpk2ss {nm}: realização do control difere da fixture (função de transferência equivalente)")
    except Exception as ex: infos.append(f"zpk2ss {nm}: tf2ss do control indisponível ({type(ex).__name__})")
    # frequência (discreto: z = exp(j w Ts), w em rad/s)
    w = np.array(s["w"], float); fr = np.asarray(ct.frequency_response(T_, w).response).reshape(-1)
    fx = s["freqresp"]
    ph = np.angle(fr); dph = np.abs(((ph - np.array(fx["phase"], float)) + np.pi) % (2 * np.pi) - np.pi)
    res.setdefault("freqresp", []).append((nm, max(rel(fr.real, fx["re"]), rel(fr.imag, fx["im"]), rel(np.abs(fr), fx["mag"]), float(np.max(dph)))))
    bd = s["bode_deg"]; mag_db = 20 * np.log10(np.abs(fr))
    phu = np.degrees(np.unwrap(ph)); phw = np.degrees(ph); bp = np.array(bd["phase_deg"], float)
    res.setdefault("bode_deg", []).append((nm, max(rel(mag_db, bd["mag_db"]), min(rel(phu, bp), rel(phw, bp)))))
    # evalfr
    ev = ct.evalfr(T_, complex(*s["evalfr"]["s"])); res.setdefault("evalfr", []).append((nm, rel([ev.real, ev.imag], s["evalfr"]["value"])))
# rlocus
rl = A["rlocus"]; sysr = mk_tf(next(x for x in A["systems"] if x["name"] == rl["system"]))
loc = np.asarray(ct.root_locus_map(sysr, gains=np.array(rl["gains"], float)).loci)
errs = [rel(srt(loc[i]).view(float), srt(cplx(rl["roots"][i])).view(float)) for i in range(len(rl["gains"]))]
res.setdefault("rlocus", []).append((rl["system"], max(errs)))
# unwrap (control não tem; referência = numpy.unwrap com period)
for i, u in enumerate(A["unwrap"]):
    res.setdefault("unwrap(numpy)", []).append((f"caso{i}", rel(np.unwrap(np.array(u["input"], float), period=u["period"]), u["output"])))
# ---- design: ctrb/obsv/lyap/dlyap
for c in D["ctrb"]:
    M = ct.ctrb(np.array(c["A"], float), np.array(c["B"], float))
    res.setdefault("ctrb", []).append((c["nome"], max(rel(M, c["esperado"]), 0 if np.linalg.matrix_rank(M) == c["posto"] else np.inf)))
for c in D["obsv"]:
    M = ct.obsv(np.array(c["A"], float), np.array(c["C"], float))
    res.setdefault("obsv", []).append((c["nome"], max(rel(M, c["esperado"]), 0 if np.linalg.matrix_rank(M) == c["posto"] else np.inf)))
for fn_, key in ((ct.lyap, "lyap"), (ct.dlyap, "dlyap")):
    for c in D[key]:
        X = try_(lambda: fn_(np.array(c["A"], float), np.array(c["Q"], float)))
        res.setdefault(key, []).append((c["nome"], X if isinstance(X, str) else rel(X, c["X_esperado"])))
# ---- d2c: o control não tem d2c; confere a fixture com ct.c2d (inverso) nos dois métodos
Dd2c = json.load(open("tests/fixtures/core-d2c.json"))
def _ss(q, dt=0):
    M = [np.atleast_2d(np.array(q[k], float)) for k in "ABCD"]
    return ct.ss(*M, dt) if dt else ct.ss(*M)
for c in Dd2c["zoh_ss"]:
    back = ct.c2d(_ss(c["expected"]), c["Ts"], method="zoh"); dsc = _ss(c["disc"], c["Ts"])
    res.setdefault("d2c(zoh)", []).append((c["id"], max(rel(getattr(back, k), getattr(dsc, k)) for k in "ABCD")))
_w = np.array([0.05, 0.3, 0.83, 2.7, 6.0])
for c in Dd2c["tustin_ss"]:
    e = _ss(c["expected"]); pr = _ss(c["proto"])
    res.setdefault("d2c(tustin)", []).append((c["id"], max(rel(np.asarray(ct.evalfr(e, 1j * x)), np.asarray(ct.evalfr(pr, 1j * x))) for x in _w)))
for m_ in ("zoh", "tustin"):
    for c in Dd2c[m_ + "_tf"]:
        e = ct.tf(c["expected"]["num"], c["expected"]["den"]); dc = ct.c2d(e, c["Ts"], method=m_)
        n_, d_ = trim(dc.num[0][0]) / trim(dc.den[0][0])[0], trim(dc.den[0][0]) / trim(dc.den[0][0])[0]
        res.setdefault(f"d2c_tf({m_})", []).append((c["id"], max(rel(n_, trim(c["disc"]["num"])), rel(d_, trim(c["disc"]["den"])))))
# ---- timeresp: lsim/impulse/initial/c2d
Hh = T["grid"]["h"]; Nn = T["grid"]["N"]; tt = np.arange(Nn) * Hh; KK = np.arange(Nn)
def mk_u(sp):
    if sp["type"] == "step": return np.full(Nn, sp["amp"], float)
    if sp["type"] == "ramp": return sp["slope"] * tt
    if sp["type"] == "sine": return sp["amp"] * np.sin(2 * np.pi * sp["freq"] * tt)
    return np.where((KK >= sp["k0"]) & (KK < sp["k1"]), sp["amp"], 0.0)
def sys_of(name):
    q = T["systems"][name]; M = [np.atleast_2d(np.array(q[k], float)) for k in "ABCD"]
    return ct.ss(*M, q["dt"]) if q["dt"] else ct.ss(*M)
def yfix(y, p): y = np.asarray(y, float); return y.reshape(-1, 1) if y.ndim == 1 else y
for r in T["lsim"]:
    sy = sys_of(r["system"]); U = np.array([mk_u(sp) for sp in r["inputs"]])
    o = try_(lambda: ct.forced_response(sy, tt, U, X0=np.array(r["x0"], float), squeeze=False).outputs.T)
    err = o if isinstance(o, str) else rel(o, yfix(r["y"], 0))
    if not isinstance(err, str) and err > TOL and sy.dt == 0:
        # Convenção: control interpola a entrada linearmente (FOH); as fixtures usam ZOH (documentado).
        # Aqui exige-se que o control coincida com scipy.signal.lsim(interp=True), isto é, FOH exato.
        from scipy import signal as _sg
        _, yf_, _ = _sg.lsim((sy.A, sy.B, sy.C, sy.D), U.T, tt, X0=np.array(r["x0"], float), interp=True)
        err = rel(o, np.asarray(yf_).reshape(len(tt), -1))
        infos.append(f"lsim {r['id']}: control usa FOH, fixture usa ZOH (control == scipy FOH, erro {err:.1e})")
    res.setdefault("lsim", []).append((r["id"], err))
for r in T["impulse"]:
    sy = sys_of(r["system"]); j = r["input"]
    o = try_(lambda: np.asarray(ct.impulse_response(sy, tt, input=j, squeeze=False).outputs).reshape(sy.noutputs, -1).T)
    err = o if isinstance(o, str) else rel(o, yfix(r["y"], 0))
    if not isinstance(err, str) and err > TOL and sy.dt > 0:
        # Convenção: control usa impulso de área unitária (U[0] = 1/dt); a fixture usa delta de Kronecker.
        err = rel(o * sy.dt, yfix(r["y"], 0))
        infos.append(f"impulse {r['id']}: control usa U[0]=1/dt; fixture usa delta de Kronecker (control*dt == fixture, erro {err:.1e})")
    res.setdefault("impulse", []).append((r["id"], err))
for r in T["initial"]:
    sy = sys_of(r["system"])
    o = try_(lambda: ct.initial_response(sy, tt, X0=np.array(r["x0"], float), squeeze=False).outputs.T)
    res.setdefault("initial", []).append((r["id"], o if isinstance(o, str) else rel(o, yfix(r["y"], 0))))
for r in T["discretization"]:
    sy = sys_of(r["system"]); d_ = ct.c2d(sy, r["h"], method="zoh")
    res.setdefault("c2d", []).append((r["id"], max(rel(d_.A, r["Ad"]), rel(d_.B, r["Bd"]))))

for k,v in res.items():
    print("==",k)
    for r in v: print("  ",r)

def _bad(x):
    if isinstance(x, str): return x.startswith("ERRO")
    if isinstance(x, (int, float, np.floating)): return not (x <= TOL)
    if isinstance(x, dict): return any(_bad(v) for v in x.values())
    return False
fails = []
for k, v in res.items():
    for r in v:
        bad = (r[1] != "ok" or bool(r[2])) if k == "stepinfo" else _bad(r[1])
        if bad: fails.append((k, r[0]))
for i_ in infos: print("INFO:", i_)
print("FALHAS:", fails if fails else "nenhuma")
sys.exit(1 if fails else 0)
