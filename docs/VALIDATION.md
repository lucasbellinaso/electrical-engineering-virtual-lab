# Validação e verificação / Validation and verification

## O que cada teste demonstra

`npm test` usa apenas Node.js (22+). `scripts/check.mjs` verifica sintaxe JS e
scripts inline, JSON, chaves e placeholders de tradução, metadados, arquivos,
identificadores únicos, categorias, links locais e dimensões dos PNGs.
`tests/preservation.test.mjs` compara hashes dos originais e dependência Plotly e
confirma que todo script inline dos cinco simuladores permanece idêntico.
**Esses testes não validam cientificamente os simuladores herdados.**

`tests/service-worker.test.mjs` exercita escopo em subdiretório, cache essencial,
armazenamento seletivo, acesso offline, parâmetros na URL e migração de cache.
O relatório `IMPLEMENTATION-REPORT.md` registra as verificações em Edge real.

## Template RC 1.0.0: evidência analítica reproduzível

Modelo: circuito série RC ideal, fonte CC constante, sem carga. KVL e relação
constitutiva do capacitor resultam em `dv/dt = (Vs − v)/(R C)` e solução exata
`v(t) = Vs + (v0 − Vs) exp(−t/(R C))`.

Método: RK4 clássico, `h ≤ RC/50` e pelo menos 600 passos. Duração limitada a
100 constantes de tempo para custo e estabilidade. SI interno: Ω, F, s e V.
Entradas em µF e ms são convertidas explicitamente.

Execute `node --test tests/rc-model.test.mjs` ou `npm test`. Casos:

| Caso | Parâmetros / critério |
|---|---|
| Condição inicial e transitório | Vs=5 V, R=1 kΩ, C=100 µF, v0=0 V, T=500 ms; erro máximo <2 nV |
| Uma constante de tempo | v(100 ms) comparada a 5(1−exp(−1)) |
| Regime em 5τ | v(500 ms) comparada a 5(1−exp(−5)), sem fingir equilíbrio exato |
| Condições não nulas / fonte negativa | v0=10 V, Vs=−5 V e equilíbrio v0=Vs; erro <10 nV |
| Consistência dimensional | R duplicada e C dividida por dois: trajetória idêntica |
| Convergência | y′=−y, y(0)=1, h=0.1 e h=0.05; razão de erro entre 15 e 18 |
| Energia | integral trapezoidal de Vs·i e R·i²; erro relativo de balanço <2×10⁻⁵ |
| Monotonicidade | carga padrão limitada a [0, Vs] |
| Estabilidade/limites | 100τ com h/τ≤0.02; dados finitos e erro <30 nV |
| Entradas inválidas | R≤0, C≤0, T≤0, NaN, infinito, tipo string e duração excessiva rejeitados |

Essa evidência sustenta apenas **comparação analítica do template RC**, não uma
comparação com SPICE ou dados experimentais, e não se transfere aos outros modelos.
Os critérios numéricos são tolerâncias de teste, não especificações de componentes.
Novos modelos precisam de relatórios próprios e testes relevantes às suas hipóteses.

## English

Run `npm test` with Node 22+. Integrity checks verify structure, syntax, translations,
paths and preservation of supplied numerical code. They do not establish scientific
validity of any imported application. The ideal RC template is compared with the
closed-form first-order solution, including initial conditions, transients, 5τ,
negative inputs, equilibrium, dimensional scaling, RK4 convergence, energy balance,
bounds and invalid values. Parameters and numerical tolerances are listed above.
No independent simulator comparison or experimental validation is claimed.
