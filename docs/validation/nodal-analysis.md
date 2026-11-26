# Analytical Validation · Nodal Analysis (`nodal-analysis`)

- **Simulator**: `simulators/electrical-circuits/nodal-analysis/`
- **Model**: `simulators/electrical-circuits/nodal-analysis/model.js`
- **Version**: `1.0.0`
- **Validation level**: `analytically-verified`
- **Test suite**: `tests/nodal-analysis.test.mjs` (`npm test` / `npm.cmd test`)

## Equations & Numerical Method

For a linear DC circuit with $N$ non-reference nodes (excluding reference node `0` = GND) and $M$ independent voltage sources, the solver assembles the Modified Nodal Analysis (MNA) system in SI units ($\Omega$, $\text{S}$, $\text{A}$, $\text{V}$, $\text{W}$):

$$
\begin{bmatrix} \mathbf{G} & \mathbf{B} \\ \mathbf{B}^T & \mathbf{0} \end{bmatrix}
\begin{bmatrix} \mathbf{v} \\ \mathbf{i}_V \end{bmatrix}
=
\begin{bmatrix} \mathbf{i} \\ \mathbf{e} \end{bmatrix}
$$

When $M = 0$, the system reduces to pure nodal analysis $\mathbf{G}\mathbf{v} = \mathbf{i}$. The assembled system is solved by the shared `msolve` kernel using Gauss-Jordan elimination with partial pivoting in IEEE-754 double precision. The DC model passes `{absTol: LIMITS.singularPivotTol, relTol: 0}` (`singularPivotTol = 1e-12`) and maps only the kernel's `SINGULAR_MATRIX` error to its public `SINGULAR_SYSTEM` error. The previous solver used forward Gaussian elimination followed by back substitution; the different operation order can change floating-point rounding, so results are compared within tolerances rather than bitwise.

## Analytical Test Cases

1. **Two-node current-source network (`two-node-current`)**:
   - $I_1 = 2\,\text{A}$ ($0 \to 1$), $R_1 = 10\,\Omega$ ($1 \leftrightarrow 0$), $R_2 = 5\,\Omega$ ($1 \leftrightarrow 2$), $R_3 = 20\,\Omega$ ($2 \leftrightarrow 0$), $I_2 = 0.5\,\text{A}$ ($2 \to 0$).
   - Exact solution: $v_1 = \frac{80}{7}\,\text{V}$, $v_2 = \frac{50}{7}\,\text{V}$.
   - Verified within $< 10^{-12}\,\text{V}$.

2. **Balanced Wheatstone bridge (`wheatstone-bridge`)**:
   - $V_1 = 12\,\text{V}$ ($1 \to 0$), $R_1 = 100\,\Omega$, $R_2 = 200\,\Omega$, $R_3 = 150\,\Omega$, $R_4 = 300\,\Omega$, bridge $R_5 = 120\,\Omega$.
   - Exact solution: $v_1 = 12\,\text{V}$, $v_2 = 8\,\text{V}$, $v_3 = 8\,\text{V}$, bridge current $I_{R5} = 0\,\text{A}$.
   - Verified within $< 10^{-12}\,\text{V}$ and $< 10^{-13}\,\text{A}$.

3. **Supernode with floating voltage source (`supernode-dc`)**:
   - $I_1 = 3\,\text{A}$ ($0 \to 1$), $R_1 = 4\,\Omega$ ($1 \leftrightarrow 0$), $V_1 = 6\,\text{V}$ ($+2, -1$), $R_2 = 6\,\Omega$ ($2 \leftrightarrow 0$), $R_3 = 3\,\Omega$ ($2 \leftrightarrow 3$), $R_4 = 6\,\Omega$ ($3 \leftrightarrow 0$), $I_2 = 1\,\text{A}$ ($0 \to 3$).
   - Exact solution: $v_1 = \frac{72}{19}\,\text{V}$, $v_2 = \frac{186}{19}\,\text{V}$, $v_3 = \frac{162}{19}\,\text{V}$.
   - Verified within $< 10^{-12}\,\text{V}$.

4. **Conservation, linearity & boundary checks**:
   - Maximum KCL residual across all non-reference nodes: $< 10^{-12}\,\text{A}$.
   - Power balance $|P_{\text{supplied}} - P_{\text{dissipated}}|$: $< 10^{-11}\,\text{W}$.
   - Source scaling linearity ($3\times$ sources $\implies 3\times$ voltages, $9\times$ power) and rejection of out-of-bounds, disconnected, self-loop, and singular topologies.
