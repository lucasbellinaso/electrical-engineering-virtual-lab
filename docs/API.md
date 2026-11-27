# API disponível

Inventário inspecionado em 26/11/2026. Somente código existente e importável é
descrito como API aqui; `assets/js/core/` existe (abaixo), mas não há API MATLAB/Octave genérica.
Propostas estão em [ROADMAP.md](../ROADMAP.md). Caminhos abaixo são relativos à raiz;
imports do consumidor devem ajustar a profundidade. Modelos numéricos não dependem do DOM.

## Portal: assets/js/i18n.js

| Exportação | Contrato e limites |
|---|---|
| SUPPORTED_LANGUAGES | lista imutável pt-BR/en/es |
| language | binding vivo do idioma atual |
| storage.get(key), storage.set(key,value) | localStorage opcional; falha de permissão não impede uso |
| resolveLanguage(saved,browserLanguage='en') | preferência válida, depois pt/es/outros; função pura |
| setLanguage(code) | Promise; carrega inglês e idioma, traduz DOM, persiste, atualiza lang e emite languagechange; última solicitação vence |
| t(key,values={}) | string com substituição de `{nome}`; fallback inglês, depois chave |
| localized(value) | string ou metadado por idioma com fallback `.en` |
| formatNumber(value,options={}) | Intl.NumberFormat no idioma atual; somente apresentação |
| languageLabel(code) | PT-BR/EN/ES; preserva código desconhecido |
| languageAvailability(languages) | aviso localizado de idiomas reais do aplicativo |
| configureLanguagePicker(picker?) | preenche seletor compartilhado; usa #language por padrão |
| translate(container=document) | atualiza data-i18n, -html, -placeholder e -aria; não toca valores numéricos |

Requer ambiente navegador para o módulo completo (document, navigator, fetch). Regras,
cobertura e limitações em [I18N.md](I18N.md). Não converter resultado de formatNumber
de volta para entrada matemática.

```js
import {setLanguage, t, localized, formatNumber} from './assets/js/i18n.js';
await setLanguage('es');
const caption = t('resultCount', {count: formatNumber(2), total: formatNumber(10)});
const name = localized({en: 'Circuit', 'pt-BR': 'Circuito', es: 'Circuito'});
```

`assets/js/common.js` exporta `initialize()` (Promise: tema, seletor/idioma, config,
repositório e PWA), `siteRoot` (URL relativa da raiz) e `config` (binding carregado de
data/config.json). Os entrypoints app/document/lab montam páginas; não são biblioteca
matemática. Eventos e DOM pertencem a essa camada.

## Circuitos dinâmicos: simulators/electrical-circuits/shared/model.js

API local de laboratório, versão 1.0.0, não motor genérico de simulação.

`presets`: objetos rc, rl, series, parallel; `VERSION`; `MAX_STEPS = 80000`;
`CircuitError(code)` com códigos parameters, resolution ou nonfinite.

Entrada `p`: `{topology, excitation, resistance, inductance, capacitance, source,
v0, i0, duration}`. UI: Ω, mH, µF, V, mA, ms. `source` usa **mA no paralelo** e V
nas demais topologias. `excitation`: step/natural. Todas as propriedades são validadas,
inclusive valores de campos inativos. Estados internos `[vC, iL]` em V/A.

| Função | Resultado |
|---|---|
| validate(p) | objeto validado; erro de limites/tipo |
| characteristics(p) | R/L/C em SI, tau ou omega0/alpha/zeta, regime e taxas |
| recommendedDuration(p) | duração sugerida em ms; ainda depende da validação e orçamento |
| input(p) | fonte efetiva em SI; zero na resposta natural |
| initialState(p) | vetor de estados SI |
| derivative(p,state) | derivadas SI da topologia |
| rk4Step(state,h,f) | novo estado; h em segundos, f recebe vetor; RK4 fixo |
| homogeneous(y0,d0,alpha,omega0,time) | [y,dy/dt] para a equação homogênea de segunda ordem |
| analyticalState(p,time) | estados em forma fechada; time em segundos |
| simulate(p,options={}) | parâmetros, características, samples, step, errorV/I, work, heat, energyResidual e version |

`options.refinement`: inteiro 1…8. `samples` contém time, vc, il, vR, vL, iR, iC,
source, energy, power, loss, exactVC e exactIL em SI. O passo atende à taxa mais rápida;
orçamento excedido é rejeitado. Comparação analítica não é validação experimental.

```js
import {presets, simulate} from './simulators/electrical-circuits/shared/model.js';
const result = simulate({...presets.rc, source: 5, duration: 500});
const finalVoltage = result.samples.at(-1).vc; // aproximadamente 4.966 V
```

`shared/worker.js` recebe `{id, parameters}` e responde `{id,result}` ou `{id,error}`.
O chamador gerencia cancelamento e respostas obsoletas. `shared/equations.js` exporta
`equations(topology)` como pares [chave de tradução, LaTeX]. diagram/chart são helpers
de UI/DOM, não algoritmos de controle nem interpretador simbólico genérico.

Na UI 1.1.0 desses dois aplicativos, `chart.js` expõe `referenceRange(topology,quantity)`
e `dataRange(result,quantity,visible)` para limites Y de apresentação. `chart` recebe
uma faixa opcional `[low,high]`; retorna geometria com limites e indicação `outside`.
Os SVGs expõem `data-y-min`, `data-y-max` e `data-out-of-range`. As faixas são mantidas
ao recalcular, trocar idioma, ocultar curvas ou restaurar os parâmetros da mesma
topologia. Ajustar/restaurar escala são ações explícitas; trocar topologia aplica
a faixa de referência correspondente. Nada disso altera os dados da simulação.

## Template RC: templates/simulator/model.js

`defaults`, `limits`, `validate(p)`, `rk4(value,step,derivative)` e `simulate(p=defaults)`.
Parâmetros `{voltage,resistance,capacitance,initialVoltage,duration}` em V/Ω/µF/V/ms.
Resultado `{parameters,samples,tau,step,maxError}`; samples têm time/voltage/exact em
s/V/V. Duração ≤100τ, bounds próprios e integração de primeira ordem. O formato **não
é o mesmo** de shared/model.js; use adaptador explícito se for compartilhar consumidores.

## Análise nodal DC: simulators/electrical-circuits/nodal-analysis/model.js

Exporta LIMITS, PRESETS, defaults, `validateCircuit(circuit)`,
`solveLinearSystem(matrix,rhs)`, `solveNodalCircuit(input=defaults)` e
`symbolicTerms(circuit)`. Matrizes: arrays de linhas; rhs: vetor. `solveLinearSystem`
adapta rhs para a forma de coluna de `msolve` em `assets/js/core/matrix.js`, com
`{absTol: LIMITS.singularPivotTol, relTol: 0}`. `SINGULAR_MATRIX` é convertido no
erro público `SINGULAR_SYSTEM` com a mensagem de circuito. Outros erros do núcleo
são propagados, incluindo validações de forma e valores finitos.

Circuito: `{nodeCount, components}`; componente `{id,type,from,to,value}`, tipos R/I/V,
nó 0 de referência; demais nós numerados conforme nodeCount. Valores em SI. Resultado:
nodeVoltages (inclui referência 0), vCurrents, branches, totalDissipated/totalSupplied,
powerBalanceError, kclResiduals/maxKclResidual e matrix (A,b,solution, G/B/i/e).
symbolicTerms retorna termos de estampa de elementos, não expressões simbólicas arbitrárias.
LIMITS impõe 2…5 nós não referência, até 24 componentes e demais bounds do fonte.

## Análise fasorial: simulators/electrical-circuits/nodal-analysis-ac/model.js

Exporta LIMITS, TYPES, PRESETS, defaults, `validateCircuit(circuit)`, `omegaOf(frequency)`,
`admittance(component,omega)`, `sourcePhasor(component)`, `solveComplexSystem(matrix,rhs)`,
`solvePhasorCircuit(input=defaults)`, `symbolicTerms(circuit)` e `evaluateTerm(term,omega)`.

Complexos são `{re,im}`. `cx` exporta make(re=0,im=0), add/sub/mul/div(a,b), conj(a),
scale(a,k), abs(a), fromPolar(magnitude,degrees). `polar(z)` retorna `{mag,phase}`,
fase em graus (zero para fasor exatamente zero). Helpers de baixo nível não validam
todas as operações isoladas; por exemplo divisão por zero requer tratamento do chamador.

Circuito acrescenta `frequency` em Hz; tipos R/L/C/I/V. Valores R em Ω, L em mH,
C em µF, fontes em A/V e fase em graus. Fasores são valores de **pico**, não RMS;
uma única frequência e regime permanente senoidal. Resultado: nodeVoltages/vCurrents
complexos, branches com voltageDrop/current/power, activePowerLoads, reactiveInductors,
reactiveCapacitors, suppliedPower, resíduos KCL/potência e matrix A/b/solution.
Não é integração transitória nem solução não linear.

```js
import {defaults, solvePhasorCircuit} from './simulators/electrical-circuits/nodal-analysis-ac/model.js';
const result = solvePhasorCircuit(structuredClone(defaults));
console.log(result.frequency, result.nodeVoltages, result.maxKclResidual);
```

Helpers KaTeX em nodal-analysis-ac/latex.js (latexComplex, idLatex, phasorLatex,
sumLatex, unknownsLatex, symbolicSystemLatex, numericSystemLatex, kclRowsLatex)
formatam dados do solver; não calculam nem validam o circuito.

## Núcleo matemático: assets/js/core/

Módulos ESM puros (sem DOM, sem dependências, importáveis em Node e no navegador),
extraídos gradualmente do SISO. O laboratório de LT consome complex.js, cmatrix.js e numeric.js; o SISO integrado
continua usando suas funções internas, intactas. As funções portadas mantêm a aritmética
original e são comparadas por igualdade exata com `app.html` (tests/helpers/siso-reference.mjs).
Convenções: polinômios em ordem decrescente, matrizes por linhas, raízes e pontos `s`
como `[re, im]`, frequências em rad/s, fase em graus. Entradas inválidas lançam
TypeError/RangeError; os kernels portados não validam resultados intermediários
(podem produzir Infinity/NaN como o original).

## LT: simulators/power-systems/transmission-line/model.js

`defaults`, `presets`, `bounds`, `validate(input)`, `lineParameters(input)` e
`solve(input=defaults)`. Consumidor do núcleo matemático, sem DOM ou dependências externas.
Entradas: `lengthKm`, `frequencyHz`, `resistanceOhmKm`, `inductanceMhKm`,
`capacitanceNfKm`, `voltageKv` (linha RMS), `apparentMva` (trifásica),
`powerFactor`, `loadType` (`inductive`/`capacitive`) e `mode`
(`receiving`/`sending-open`). Em vazio exige `apparentMva=0`.

`lineParameters` retorna `p,z,y,gamma,zc,exact,nominal,pi`; ABCD em
`{A,B,C,D}` complexos `{re,im}`, `pi={series,shunt}` com admitância **por ramo**,
ou `null` próximo de meia onda. `solve` acrescenta `vs,is,vr,ir` RMS por fase,
`comparison`, 401 `samples` com `{x,voltage,current}`, `sendingPower` e
`receivingPower` trifásicas em VA, `losses`/`integratedLosses` em W,
`determinantResidual`, `errorPercent` (fasor V_S ou V_R) e `contributions`.
`gamma` usa /km; `samples.x` usa km. Não altera entradas. Erros `RangeError`
com `code`: `invalid`, `openLoad`, `resonance`. O consumidor usa o auxiliar
`sinhc`, ainda com API instável, protegido por testes locais. Equações, ramos,
domínio e limiares em [TRANSMISSION-LINE.md](TRANSMISSION-LINE.md).

## Modulação Digital: simulators/digital-communications/digital-modulation/model.js

`MODULATIONS`, `bounds`, `defaults`, `presets`, `SWEEP_EBN0_DB`, `validate(input)`,
`erfc(x)`, `qfunc(z)`, `constellationSpec(modulation)`,
`theoreticalErrorRates(modulation, ebN0Db)`,
`impairedTheoreticalErrorRates(modulation, ebN0Db, phaseOffsetDeg)` e
`simulate(input=defaults)`. Módulo ESM puro sem DOM. Entradas: `modulation`
(`'BPSK'`, `'QPSK'`, `'8-PSK'`, `'16-QAM'`, `'64-QAM'`), `ebN0Db` (`[0, 24]`),
`symbolCount` inteiro (`[100, 20000]`), `phaseOffsetDeg` (`[-45, 45]`) e
`seed` inteiro (`[1, 2147483647]`). Normalização $E_s = 1$, $E_b = E_s / k$,
ruído AWGN complexo com $\sigma^2 = N_0 / 2$ e PRNG determinístico Mulberry32.
Equações, mapeamento Gray e limites em [DIGITAL-MODULATION.md](DIGITAL-MODULATION.md).

Tolerância de singularidade: `msolve`, `inv`, `csolve` e `cinv` aceitam um último argumento opcional
`{ absTol, relTol }` (ambos finitos e ≥ 0, padrão 0). A matriz é singular se o maior módulo de pivô de
alguma coluna for ≤ `max(absTol, relTol · máx|aᵢⱼ|)`. Sem a opção vale a regra original: só o pivô
exatamente nulo. A singularidade lança `Error('Matriz singular')` com `code = 'SINGULAR_MATRIX'`, para
o chamador distingui-la de outros erros e mapeá-la para a sua própria mensagem. Opção inválida lança
TypeError/RangeError. `det` e `cdet` não têm a opção (devolvem 0 só para pivô exatamente nulo).

| Módulo | Exportações (★ = nova, não existe no SISO) |
|---|---|
| polynomial.js | ptrim, pmul, padd, pscale, pdeg, plead, pprod, polyFromRoots (só parte real), roots, aberth, matchRoots; ★polyval, polyvalComplex, polyder, polyint, conv, deconv→{q,r} |
| matrix.js | zeros, eye, mmul, madd, mscale, msolve(A, B, opts) (lança em singular; `opts = { absTol, relTol }` opcional, ver abaixo), expm (Padé 6), charpoly; ★transpose, trace, det, inv(A, opts), norm1, normInf, isSquare, logm (log principal real; lança RangeError com autovalor real ≤ 0) |
| control.js | tf2ss, c2d (ZOH), pade, makeFR, bisect, margins; ★ss2tf, series, parallel, feedback, dcgain, evalTF, d2c (`d2c(sys, 'zoh'\|'tustin')`, `sys` = `{A,B,C,D,dt}` MIMO ou `{num,den,dt}` SISO, `dt > 0`; ZOH usa Γ = ∫e^{Aτ}dτ e funciona com integrador) |
| numeric.js | logspace (n≥2, como o SISO); ★linspace, trapz, cumtrapz, cumsum, sum, mean, std (N−1), norm, diff, interp1 (NaN fora do intervalo) |
| complex.js | ★objetos `{re,im}`: make, add, sub, mul, div, conj, scale, abs, arg, fromPolar/fromPolarDeg, toPolar/toPolarDeg, exp, sqrt, pow, fromPair/toPair, equalsWithin; ★sinh, cosh, tanh (estouro: componentes ±Infinity, sem lançar; tanh estável perto dos polos e assintótico para \|x\| > 20); ★sinhc (auxiliar, API ainda instável: sinh(z)/z, sinhc(0) = 1) |
| cmatrix.js | ★matrizes complexas: array de linhas de `{re,im}` (mesmo formato de complex.js; aritmética importada dele). czeros, ceye, fromReal, fromParts(Re, Im), realPart, imagPart, cadd, csub, cscale(A, z) (z real ou `{re,im}`), cmmul (retangulares), ctranspose (sem conjugar), chermitian (conjugada), ctrace, cdet, cinv(A, opts), csolve(A, B, opts) (lança `Error('Matriz singular')`, `code = 'SINGULAR_MATRIX'`), cnorm1, cnormInf, cnormFro |

| residue.js | ★residue, residuez, invres, invresz (porte de scipy.signal 1.18.1; polos agrupados por distância absoluta como o SciPy; precisão de resíduos cai com multiplicidade: ~1e-8 duplo, ~3e-6 triplo) |
| timeresp.js | ★tfToSS, lsim (entrada ZOH, passo uniforme; discreto = dlsim), step, impulse (C·e^{At}·B; D·δ ignorado), initial, stepinfo, defaultTime |
| design.js | ★ctrb, obsv, acker, place (**só entrada única**; multi-entrada lança RangeError), lyap, dlyap (n ≤ 12, Kronecker) |
| solvers.js | ★fsolve (F(x) = 0, n×n, retorno `{x, fval, exitflag, output}` como o MATLAB; `algorithm: 'newton-raphson'` (padrão; Jacobiano analítico via `options.jacobian` ou diferenças finitas; `lineSearch` opcional) ou `'gauss-seidel'` (Newton escalar por componente, ou forma de ponto fixo via `options.update(x, i)`; `accel` = fator de aceleração/SOR; convergência linear, só condicional); `output.history` guarda ‖F‖∞ por iteração), numjac |
| eigen.js | ★eig (`{values, vectors}`, como `[V,D] = eig(A)`), eigvals (como `e = eig(A)`). A real n×n; autovalores `[re, im]` e `vectors[i][k] = [re, im]`. Balanceamento + Hessenberg + QR de Francis (forma de Schur real) + autovetores por Schur complexa; simétrica → autovalores crescentes e V ortonormal; autovetores com norma 1 e maior componente real positiva. Autovalores múltiplos de matriz defeituosa perdem precisão (ε^(1/m)) |
| riccati.js | ★care (função sinal matricial), dare (dobramento SDA), lqr, dlqr (com N), lqe, dlqe; autovalores de E via eigvals (eigen.js), precisos também para n ≥ 5 |
| analysis.js | ★pole, zero (SS só SISO), damp, tfdata, tf2zpk, zpk2tf, zpk2ss, ss2zpk, freqresp, bode, nyquist, evalfr, margin, minreal, rlocus, gangof4, mag2db, db2mag, unwrap |
| models.js | ★tf, ss, zpk (construtores: validam e devolvem `{num,den}`, `{A,B,C,D}` com D matricial, `{z,p,k}`; `dt` só gravado se > 0; zpk aceita raiz como número ou `[re, im]`), negate (−sys: TF nega num, ZPK nega k, SS nega C e D), append (sempre devolve SS em blocos diagonais, MIMO; exige mesmo dt), modred (`elim` = índices base 0 ou máscara; `'matchdc'` padrão ou `'truncate'`; matchdc discreto usa (I − A₂₂)⁻¹, que o python-control 0.10.2 não implementa) |

**Referências numéricas.** Os módulos novos são comparados com fixtures JSON em
`tests/fixtures/core-*.json`, geradas por `scripts/reference/gen_*.py` (Python 3.10, NumPy 2.2.6,
SciPy 1.15.1, 26/11/2026) e conferidas contra o **python-control 0.10.2** real por
`scripts/reference/check_control.py` (`pip install control==0.10.2`; rode
`python3 scripts/reference/check_control.py` na raiz; sai com código 1 se algo passar de 1e-9).
Conferidos: `damp`, `margin`, `pole`, `zero`, `tf2zpk`, `ss2zpk`, `zpk2ss`, `freqresp`, `bode`,
`evalfr`, `rlocus`, `lqr/dlqr/lqe/dlqe`, `acker`, `place` (só casos de entrada única), `ctrb`, `obsv`,
`lyap`, `dlyap`, `stepinfo`, `lsim`, `impulse`, `initial` e `c2d`. Sem equivalente no control (SciPy/NumPy):
`residue*`, `invres*`, `unwrap`. Sem fixture contra o control: `minreal` e `gangof4` (testes analíticos).
`d2c` não existe no python-control: a referência é a função do autor (`scripts/reference/gen_d2c.py`),
validada por `c2d(d2c(sys)) = sys` (ZOH) e pela FT do protótipo (Tustin), e conferida de novo contra `ct.c2d`.
`fsolve` é comparado com `scipy.optimize.root` (`scripts/reference/gen_solvers.py`), inclusive um fluxo de
potência de 2 barras com Jacobiano analítico; o Gauss–Seidel/SOR é comparado varredura a varredura com um
laço NumPy em Ax = b; `numjac` é conferido contra o Jacobiano analítico de cada problema.
`eig`/`eigvals` são comparados com `scipy.linalg.eig`/`eigh` (`scripts/reference/gen_eig.py`: 27 matrizes, incluindo
defeituosas, repetidas, mal escaladas e simétricas) e por propriedades (A·V = V·D, Σλ = tr A, Πλ = det A, n até 30).
Convenções que diferem do control de propósito: `lsim` contínuo usa ZOH (o control interpola a entrada
linearmente, FOH; coincide com `scipy.signal.lsim(interp=True)`); `impulse` discreto usa delta de
Kronecker (o control usa impulso de área unitária, `u[0] = 1/dt`); em `stepinfo`, `settlingMin/Max` seguem
o control (mínimo e máximo de y a partir do fim da subida, limitados por yfinal). `margin` não reutiliza
`control.margins`, porque este, portado verbatim do SISO, acusa cruzamento de fase espúrio
quando o atan2 salta (zero de fase não mínima); o caso está coberto por teste e a função do
SISO original permanece intacta.

Diferenças deliberadas: `logspace(a,b,1)` devolve `[10^b]` (o SISO devolve NaN);
`mean`/`std` de vetor vazio lançam erro (MATLAB devolve NaN); `dcgain` devolve ±Infinity
ou NaN conforme o sinal do numerador em s=0; `complex.fromPolar` usa **radianos**, ao passo
que `cx.fromPolar` de nodal-analysis-ac usa graus. Ainda **não extraídos** do SISO: closedLoopSS,
simulate, computeLocus, stepResponse (acoplados ao estado/UI do SISO). Testes:
tests/core-*.test.mjs. Comparações analíticas e de regressão não validam o SISO
cientificamente (classificação continua experimental).

## Legados encapsulados

SISO, Buck, DAB, amp-ops e Buck PID não exportam módulos numéricos públicos. Funções
com nomes conhecidos no HTML não são imports de uma API geral. Inventário, assinatura
e estratégia de extração em [SISO.md](SISO.md). Modelos, convenções e testes de cada
aplicativo ficam em seus relatórios, sem promessa de compatibilidade MATLAB completa.
