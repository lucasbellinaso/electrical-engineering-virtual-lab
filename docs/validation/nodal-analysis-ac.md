# Analytical Verification · Phasor Nodal Analysis (`nodal-analysis-ac`)

- **Simulator**: `simulators/electrical-circuits/nodal-analysis-ac/`
- **Model**: `model.js` (pure, DOM-free) · LaTeX builders: `latex.js` · UI: `ui.js`
- **Version**: `1.0.0`
- **Validation level claimed**: `analytically-verified` — nothing higher.
- **Tests**: `tests/nodal-analysis-ac.test.mjs` (`npm test`, Windows: `npm.cmd test`)

> **EN.** Results are compared with closed-form solutions derived by hand (RC/RL dividers,
> resonance, superposition) and with invariants (Tellegen, KCL, scaling, reduction to the
> resistive case). There is **no** comparison with SPICE, another simulator or measurements.
>
> **PT-BR.** Os resultados são comparados com soluções em forma fechada deduzidas à mão
> (divisores RC/RL, ressonância, superposição) e com invariantes (Tellegen, LKC, escala,
> redução ao caso resistivo). **Não** há comparação com SPICE, outro simulador ou medições.

## Model, units and conventions · Modelo, unidades e convenções

Linear time-invariant circuit, ideal R, L, C and independent sources, **one** frequency f
(0.001 Hz – 1 GHz), ω = 2πf. Public units: Ω, mH, µF, V (peak), A (peak), degrees, Hz; the module
converts to SI internally. Phasors are **peak** values: x(t) = Re{X e^{jωt}}.

| Element | Admittance | Stamp |
|---|---|---|
| R | 1/R | conductance stamp in Y |
| L | 1/(jωL) = −j/(ωL) | same |
| C | jωC | same |
| I (From → To) | — | b[from] −= I, b[to] += I |
| V (+ at From) | — | B[from] += 1, B[to] −= 1, e = V∠φ |

Complex MNA system  [Y B; Bᵀ 0][V; I_V] = [I; E], solved by Gaussian elimination with partial
pivoting in double precision; a pivot below 10⁻¹² · max|A| raises `SINGULAR_SYSTEM`.
Absorbed complex power of an element: S = ½·ΔV·I* (ΔV = V_from − V_to, I From → To); P = Re S, Q = Im S.

## Reproducible analytical cases · Casos analíticos reproduzíveis

All at f = 1 kHz unless stated. Values are outputs of the test environment (Node), not measurements.

| Example (preset id) | Closed form | Computed (node V) |
|---|---|---|
| `rc-lowpass` (R = 1 kΩ, C = 1/(2π·10⁶) F, V = 10∠0° V) | V₂ = V/(1 + jωRC) → 7.0711∠−45° V | 7.0711∠−45.00° |
| `rl-highpass` (L = R/ω, R = 1 kΩ) | V_R = V·R/(R + jωL) → 7.0711∠−45° V; V_L = 7.0711∠+45° V | 7.0711∠−45.00° |
| `series-resonance` (L = 10 mH, C = 1/(ω₀²L), R = 10 Ω) | I = V/R = 1∠0° A; V_C = Q·V∠−90°, Q = ω₀L/R | 62.8319∠−90.00° V |
| `parallel-resonance` (same L, C, I = 10 mA) | I_L + I_C = 0; tank open → R₁ ∥ (R₃+R₂) = 600 Ω → 6 V | 6.0000∠0.00° V, 2.0000∠0.00° V |
| `two-sources-phase` (60 Hz, 120∠0° and 120∠−30° V) | V₂ = 0.1·(V₁+V₃) / (0.2 + 1/(jωL)) from the node equation (see test) | 103.6538∠11.59° V |

The two-source expectation is evaluated in the test from the node equation
(V₂−V₁)/R + (V₂−V₃)/R + V₂/(jωL) = 0, independent of the solver.

## Invariants checked for every example · Invariantes verificados em todos os exemplos

| Check | Observed (all presets) |
|---|---|
| Max KCL residual per node | ≤ 9.2·10⁻¹⁶ A (test tolerance 10⁻¹¹ of the largest branch current) |
| Tellegen balance, |ΣS| over all elements | ≤ 5.7·10⁻¹⁴ VA (test tolerance 10⁻¹¹ of the power scale) |
| Source P and Q equal Σ P_R and Σ(Q_L + Q_C) | within 10⁻⁹ of the power scale |

Other tests: scaling (f → 2f with C → C/2 for RC; f → 4f with L → L/4 for RL) leaves all phasors
unchanged; adding a phase φ to the only source rotates every node phasor by φ and keeps magnitudes;
a circuit with only R and sources reproduces the resistive solver (`nodal-analysis`) for all its
presets; the symbolic element-based matrix (1/R, 1/(jωL), jωC, ±1, I, V) evaluates to the numeric
matrix; the LaTeX of every preset renders with the local KaTeX build; a hand-made 2×2 complex system
is solved exactly and a singular one is rejected.

## Invalid inputs · Entradas inválidas

Rejected with explicit codes: frequency ≤ 0, NaN or > 1 GHz; node count outside 2–5; R, L, C out of
range (including zero and negatives); source amplitude above limits; phase beyond ±360°; self loops;
invalid nodes or types; non-finite values; empty component list; a node with no path to ground through
R/L/C/V (including nodes held only by current sources); parallel voltage sources with different values
(`SINGULAR_SYSTEM`). Extreme valid values (1 GHz, 0.001 µF) stay finite.

## Limits · Limites

- Verified only against hand-derived analytical results; SPICE or experimental comparison would be
  needed for *numerically-* or *experimentally-validated*.
- Single frequency; no transients, mutual inductance, dependent sources, nonlinear or lossy components.
- Browser behaviour (rendering, exports, layout) was not covered by this suite.
