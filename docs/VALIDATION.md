# Validação e verificação / Validation and verification

Referência atual de critérios. As evidências específicas ficam nos relatórios
versionados abaixo; o histórico de interface não é validação científica.

## Critérios gerais

- Experimental: sem verificação suficiente. Verificação analítica exige comparação
  com solução conhecida; validação numérica exige ferramenta/referência independente;
  validação experimental exige medições e dados reproduzíveis. Vários níveis só com
  evidência para cada um. Não inferir nível pela presença de testes ou pela autoria.
- Registrar versão/commit, ambiente/ferramentas, parâmetros, unidades, condições
  iniciais, hipóteses, tolerâncias, resultados, limitações e testes não executados.
- Cobrir, conforme aplicável: casos analíticos, extremos, entradas inválidas,
  resíduos, convergência, estabilidade, conservação de energia e condicionamento.
- NumPy/SciPy/Python Control e GNU Octave são referências de desenvolvimento,
  não dependências de execução. Python Control e SciPy podem compartilhar rotinas:
  não contá-los automaticamente como duas referências totalmente independentes.
- Criar progressivamente testes para matrizes, polinômios/raízes, autovalores,
  exponencial matricial, discretização, respostas temporais/frequência, margens,
  lugar das raízes, Riccati, integração, identificação e otimização quando existirem
  módulos correspondentes. A lista não implica implementação atual.

## Evidências atuais

| Modelo | Relatório | Limite da evidência |
|---|---|---|
| Template RC | seção abaixo | solução analítica de primeira ordem |
| RC/RL/RLC | [linear-circuits.md](validation/linear-circuits.md) | comparação analítica, energia e convergência |
| Nodal resistivo | [nodal-analysis.md](validation/nodal-analysis.md) | soluções conhecidas, KCL e potência |
| Nodal fasorial | [nodal-analysis-ac.md](validation/nodal-analysis-ac.md) | fasores analíticos, ressonância e potência complexa |
| Legados | [INTEGRATION.md](INTEGRATION.md) e [SISO.md](SISO.md) | preservação; classificação experimental |

Não transferir a evidência de um modelo a outro. API disponível em [API.md](API.md).

## O que cada teste demonstra

`npm test` usa apenas Node.js (22+). `scripts/check.mjs` verifica sintaxe JS e
scripts inline, JSON, chaves e placeholders de tradução, metadados, arquivos,
identificadores únicos, categorias, links locais e dimensões dos PNGs.
`tests/preservation.test.mjs` compara hashes dos originais e dependência Plotly e
confirma que os scripts inline dos arquivos registrados em provenance.json permanecem idênticos.
**Esses testes não validam cientificamente os simuladores herdados.**

`tests/service-worker.test.mjs` exercita escopo em subdiretório, cache essencial,
armazenamento seletivo, acesso offline, parâmetros na URL e migração de cache.
O relatório `IMPLEMENTATION-REPORT.md` registra as verificações em Edge real.

`tests/i18n.test.mjs` verifica o módulo real de idiomas com DOM/storage/fetch controlados:
seleção, fallback, persistência, paridade, placeholders, formatos e valores numéricos.
Testes de cache exercitam espanhol e módulos em subdiretório. Esses testes não provam
qualidade física dos modelos nem substituem acessibilidade e responsividade em dispositivo real.

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
