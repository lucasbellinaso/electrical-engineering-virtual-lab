# Analytical Verification · First- and Second-Order Circuits

**Simulators**: `rc-rl-first-order` (RC & RL) and `rlc-second-order` (series and parallel RLC)
**Code**: `simulators/electrical-circuits/shared/` (`model.js` pure model, `worker.js`, `equations.js`, UI separate)
**Model version**: `1.0.0`; presentation UI `1.1.0`
**Verification level claimed**: `analytically-verified` — and nothing higher.
**Tests**: `tests/linear-circuits.test.mjs` (`npm test`, Windows: `npm.cmd test`)

> **EN.** The numerical solution is compared with closed-form solutions derived by hand
> (see the in-app derivation). There is **no** comparison with SPICE, another simulator or
> measurements, so the levels *numerically-validated* and *experimentally-validated* are
> **not** claimed.
>
> **PT-BR.** A solução numérica é comparada com soluções em forma fechada deduzidas
> analiticamente (ver a dedução no aplicativo). **Não** há comparação com SPICE, outro
> simulador ou medições; portanto os níveis *numericamente validado* e *experimentalmente
> validado* **não** são declarados.

## Model, units and assumptions · Modelo, unidades e hipóteses

Ideal linear R, L, C and ideal constant sources; no parasitics, saturation or tolerance.
Public parameters: Ω, mH, µF, V, mA, ms. Internal states are SI (V, A, s). A constant source
is applied at t = 0⁺ and **no pre-switch equilibrium is assumed**: `v0` and `i0` are
independent initial states.

| Topology | States | Equations | Source |
|---|---|---|---|
| RC | v_C | RC·v̇_C + v_C = V_s | voltage |
| RL | i_L | L·i̇_L + R·i_L = V_s | voltage |
| Series RLC | v_C, i_L | v̇_C = i_L/C, i̇_L = (V_s − R i_L − v_C)/L | voltage |
| Parallel RLC | v, i_L | v̇ = (I_s − v/R − i_L)/C, i̇_L = v/L | current |

Second order: ω₀ = 1/√(LC); α = R/(2L) (series) or 1/(2RC) (parallel); ζ = α/ω₀.
Homogeneous solution of ÿ + 2α ẏ + ω₀² y = 0 for the three regimes
(underdamped, critically damped `|ζ−1| ≤ 10⁻¹²`, overdamped); the overdamped slow root is
computed as `−ω₀²/(α+√(α²−ω₀²))` to avoid cancellation.

Numerical method: classical fixed-step RK4 in a Web Worker, h = T/N,
N = max(800, ⌈60·T·r⌉)·refinement, where r is the fastest rate. Runs with N > 80 000 are
**rejected** (`resolution`), never silently coarsened.

## Reproducible results · Resultados reproduzíveis

Obtained with `node` (v26) and the default presets; durations from `recommendedDuration`.
Errors are the maximum |RK4 − closed form| over all samples of the voltages (V) and currents (A).
The energy residual is the trapezoidal-quadrature residual of the balance
ΔE = ∫p_source dt − ∫R·i_R² dt (J).

| Case | Steps | max err. V (V) | max err. I (A) | Energy residual (J) |
|---|---:|---:|---:|---:|
| RC preset | 800 | 2.35e-11 | 2.35e-14 | 8.2e-9 |
| RL preset | 800 | 2.35e-11 | 2.35e-13 | 8.2e-10 |
| Series ζ = 0.25 | 1920 | 4.90e-9 | 4.73e-11 | 5.8e-9 |
| Series ζ = 1 | 800 | 1.27e-9 | 6.36e-12 | 2.1e-9 |
| Series ζ = 2 | 6686 | 1.38e-9 | 3.46e-12 | 4.2e-10 |
| Parallel ζ = 0.25 | 1920 | 2.37e-9 | 2.45e-11 | 1.5e-9 |
| Parallel ζ = 1 | 800 | 3.18e-10 | 6.36e-12 | 5.2e-10 |
| Parallel ζ = 2 | 6686 | 1.73e-10 | 6.92e-12 | 1.0e-10 |

These values are outputs of the test environment, not experimental data.

## What the test suite checks · O que os testes verificam

1. **Regimes**: presets are underdamped; `R = R_crit` gives critical; ζ = 2 overdamped; R = 0 (series) undamped.
2. **Closed form for every topology/regime**, step and natural response, non-zero initial
   states: voltage error < 10⁻⁶ V, current error < 10⁻⁹ A (observed values above are far smaller).
3. **Independent closed forms** (not reusing `homogeneous`): RC at t = τ gives
   5(1 − e⁻¹) V; RL final current V_s/R; series underdamped step
   v_C = V_s[1 − e^{−αt}(cos ω_d t + (α/ω_d) sin ω_d t)].
4. **Initial conditions** at t = 0 and **equilibrium** initial states staying constant.
5. **KVL** (series, RC, RL) and **KCL** (parallel) at every sample, tolerance 10⁻⁹.
6. **Energy**: balance residual < 10⁻⁴ of the dominant energy scale; the residual falls by
   ≈4× when h is halved (second-order trapezoid); lossless LC conserves E within 10⁻⁶.
7. **Convergence**: series ζ = 0.25, T = 10 ms, refinement 1/2/4 →
   max error 1.55e-9, 9.67e-11, 6.04e-12 V (ratios ≈ 16, i.e. fourth order).
8. **Continuity at critical damping** and exact value at t = 0.
9. **Dimensional scaling**: (R, C) = (1 kΩ, 100 µF) and (2 kΩ, 50 µF) give the same trajectory.
10. **Invalid inputs**: NaN/∞, strings, out-of-range values, unknown topology/excitation,
    R = 0 for RC/RL/parallel, resolution above the cap, invalid refinement.
11. **Derivations** render with the local KaTeX build (MathML present) for every topology, and
    all EN/PT-BR translation keys (static and dynamic) exist.

## Limits · Limites

- Verified only against its own analytical derivations; an independent implementation or SPICE
  comparison would be required for *numerically-validated*.
- Parameter ranges are those in `validate()`; duration up to 10⁷ ms is accepted only if the step
  budget allows it.
- Browser behaviour (Worker, exports, responsiveness) is covered by manual checks reported in
  `docs/IMPLEMENTATION-REPORT.md`, not by this suite.

## Presentation verification · Interface 1.1.0 (26/11/2026)

The mathematical model and Worker are unchanged. New checks in
[electrical-circuit-presentation.test.mjs](../../tests/electrical-circuit-presentation.test.mjs)
verify that the four complete nominal responses fit fixed Y envelopes, parameter
excursions are flagged and clipped without changing the limits, localized decimal
and scientific LaTeX numbers render, inline formulas render in all three languages,
and parallel/source-current labels use the correct symbol. These are presentation
checks, not additional physical validation.

Edge 158.0.4370.45 headless: four topologies, source changes, fixed limits, explicit
Adjust/Restore, resetting parameters without changing the selected scale, curve
visibility, analytical overlay, PT-BR/EN/ES, keyboard, 390 px viewport, dark theme,
CSV/SVG/PNG downloads and offline reload under `/EEVL/` were exercised. Screenshots
were inspected for math layout and prose. Node.js v26.13.1: `npm.cmd test` passed
792 tests, zero failures, one pre-existing skipped test (SISO MIMO reference).
No physical touch device or screen-reader verification was performed.

## References · Referências

General background only (no endorsement of this implementation): MIT OpenCourseWare 6.002
(Circuits and Electronics) and 6.071J lecture notes, linked in each simulator page.
