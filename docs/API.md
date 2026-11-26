# API disponível

Inventário inspecionado em 26/11/2026. Somente código existente e importável é
descrito como API aqui; não há ainda `assets/js/core/` nem API MATLAB/Octave genérica.
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

## Template RC: templates/simulator/model.js

`defaults`, `limits`, `validate(p)`, `rk4(value,step,derivative)` e `simulate(p=defaults)`.
Parâmetros `{voltage,resistance,capacitance,initialVoltage,duration}` em V/Ω/µF/V/ms.
Resultado `{parameters,samples,tau,step,maxError}`; samples têm time/voltage/exact em
s/V/V. Duração ≤100τ, bounds próprios e integração de primeira ordem. O formato **não
é o mesmo** de shared/model.js; use adaptador explícito se for compartilhar consumidores.

## Análise nodal DC: simulators/electrical-circuits/nodal-analysis/model.js

Exporta LIMITS, PRESETS, defaults, `validateCircuit(circuit)`,
`solveLinearSystem(matrix,rhs)`, `solveNodalCircuit(input=defaults)` e
`symbolicTerms(circuit)`. Matrizes: arrays de linhas; rhs: vetor. A solução linear
é Gauss com pivotamento e detecção de singularidade, não uma biblioteca matricial geral.

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

## Legados encapsulados

SISO, Buck, DAB, amp-ops e Buck PID não exportam módulos numéricos públicos. Funções
com nomes conhecidos no HTML não são imports de uma API geral. Inventário, assinatura
e estratégia de extração em [SISO.md](SISO.md). Modelos, convenções e testes de cada
aplicativo ficam em seus relatórios, sem promessa de compatibilidade MATLAB completa.
