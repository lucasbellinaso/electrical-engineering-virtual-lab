# Electrostatics validation evidence

Version 1.0.0 · 2026-11-26 · level: `analytically-verified`.

Reproduce from the repository root with `node --test tests/electrostatics.test.mjs`.
This evidence covers the specified ideal models and selected points; it is not
experimental validation or a general error bound for every map.

## Models and checks

- Point charge: with q = 2 nC, E and V match q/(4πε₀r²) and q/(4πε₀r) at on-axis and
  diagonal points (relative tolerance 10⁻¹⁴); reversing q reverses E and V.
- Superposition: the dipole midpoint field is twice a single contribution; equal charges
  cancel at the midpoint; a four-charge quadrupole equals the sum of four independently
  evaluated single charges (10⁻¹²). Zero charges contribute nothing.
- E = −∇V: central finite differences of the potential reproduce the field for charges,
  conducting and insulating spheres (inside and outside), a wire and plates (inside and
  outside), relative tolerance 10⁻⁵.
- Conducting sphere: zero interior field, uniform interior potential kQ/R, Gauss exterior
  E·4πr²ε₀ = Q at several radii and angles with a purely radial field, continuous V at the
  surface and a normal-field jump σ/ε₀ with σ = Q/(4πR²) (10⁻⁸ across a 10⁻⁹ relative gap).
- Insulating sphere: E·4πr²ε₀ equals the enclosed charge Q r³/R³ inside; E and V are
  continuous at r = R; the centre is finite, with E = 0 and V = 3kQ/(2R).
- Infinite wire: E·2πε₀ρ = λ at several radii and angles; V(ρ₀) = 0; changing ρ₀ shifts V
  by (λ/2πε₀) ln(ρ₀′/ρ₀) and leaves E unchanged; the axis is flagged singular for λ ≠ 0
  and finite for λ = 0.
- Parallel plates: uniform E = σ/ε₀ between the plates and 0 outside, V(−d/2) − V(d/2) =
  σd/ε₀, V(0) = 0, mid-sheet value σ/(2ε₀) with the boundary flag, sign reversal with σ,
  and independence from y.
- Ideal singularities return NaN field and potential with `singular = true`; nearby
  points are finite. No softened or zero substitute is provided.
- Coordinate transformations: ρ, φ (0–360°), radial and azimuthal components rotate the
  Cartesian components consistently and preserve |E|; φ, θ and basis components are
  undefined at the origin; a wire has only a radial component.
- Visual helpers: field lines follow E (straight lines for plates and the wire), stay
  inside the window and stop at singularities; the log-range and equipotential-level
  helpers handle empty, flat and non-finite data; marching squares locates a linear
  level set exactly and ignores cells with non-finite corners.
- Input validation rejects out-of-range, non-finite and malformed parameters and returns
  independent copies. Presets are within limits and neutral where expected.
- Interface text: PT-BR, EN and ES dictionaries have the same keys and placeholders;
  every key used by the page and by the UI code exists; derivations render through
  KaTeX with MathML for each geometry; the catalogue entry declares the three languages.

## Interpretation and limits

The map is a two-dimensional slice of ideal three-dimensional models in vacuum. Field
lines are geometric curves, not particle paths, and their spacing is not a flux
measure. Equipotentials come from a grid and may omit detail near sources. The colour
scale is relative to the current window. No comparison with finite-element results or
measurements is made.

See [model, derivations and primary references](../ELECTROSTATICS.md).
