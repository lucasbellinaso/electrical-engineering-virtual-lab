# Magnetostatics validation evidence

Version 1.0.0 · 2026-11-26 · level: `analytically-verified`.

Reproduce from the repository root with `node --test tests/magnetostatics.test.mjs`.
All 16 tests pass. This evidence covers the specified ideal models and selected
points; it is not experimental validation or a general error bound for every map.

## Models and checks

- Infinite cylindrical conductor: Ampère's law outside and inside a conductor
  with uniform current density, right-hand rule and reversed current. With
  I = 10 A at r = 0.2 m, compare B to μ₀ I/(2πr), tolerance 10⁻¹⁸ T.
  The centre is finite and zero, the surface is continuous, and numerical
  circulation of H matches enclosed current to 10⁻¹⁰ A.
- Two conductors: equal currents cancel at the midpoint; opposite currents add.
  An off-centre result matches the sum of two independently evaluated wires
  to 10⁻¹⁸ T per component.
- Circular loop: radius 0.45 m, I = 10 A, 128 quadrature points. Compare the
  axis with μ₀Ia²/[2(a²+z²)^(3/2)] at z = −1, −0.3, 0, 0.2, 1 m,
  tolerance 10⁻¹⁷ T. At x = 0.22 m, z = 0.34 m, compare the reduced
  meridional integral against an independently written 3D cross-product
  integral with 16,384 points, tolerance 10⁻¹⁶ T per component.
- Quadrature refinement: at x = 0.43 m, z = 0.05 m with exclusion radius
  0.02 m, increasing 64 → 128 → 256 points reduces the vector error against
  the 16,384-point reference by more than tenfold at each step. This selected
  case does not imply uniform precision close to every excluded tube.
- Finite solenoid: 20 loops, radius 0.45 m, length 1.4 m, I = 10 A.
  At z = −0.5, 0, 0.8 m on the axis, the numerical result agrees with the
  sum of analytical loop fields within 10⁻¹⁶ T. One turn reduces to one loop.
  For fixed NI = 100 A-turn at z = 0.17 m, refining N = 8, 16, 32, 64
  reduces error against the continuous-winding axis expression by a factor
  greater than 3.8 each time. The discrete and continuous models differ at
  finite N; the latter is used as a convergence reference only.
- Reflection symmetry, linearity in current/permeability and H = B/μ are
  checked for loop, solenoid and wires. Thin-filament exclusion returns an
  explicit invalid flag and NaNs, never a softened or zero substitute.
- Coordinate transforms, bounded spatial field-line tracing, map consistency,
  zero current, rejected invalid inputs, share-URL round trips, complete
  PT-BR/EN/ES strings and KaTeX/MathML rendering are also checked.

## Interpretation and limits

O mapa mostra uma seção 2D de modelos tridimensionais ideais. Os fios são
infinitos; a espira é filamentar; o solenoide soma espiras discretas e não modela
a hélice real. A região tubular da espira é excluída, sem solução para o interior
do condutor. μr é constante no espaço inteiro: não representa um núcleo limitado,
saturação ou histerese. O valor máximo da legenda é amostrado na malha, não um
máximo analítico. As linhas são trajetórias espaciais normalizadas e seu espaçamento
não mede fluxo. Não há comparação com FEM ou medidas experimentais.

See [model, derivations and primary references](../MAGNETOSTATICS.md).

## Browser integration check

Checked over local HTTP: wires, loop and finite solenoid complete their Worker
calculations and show probe values; switching PT-BR/EN/ES updates the interface
and rendered equations. Cartesian/cylindrical probe coordinates and downloaded
CSV/PNG were exercised. Layouts at 1366 and 390 px had no horizontal page overflow.
The full repository check (`npm test`) passes.
