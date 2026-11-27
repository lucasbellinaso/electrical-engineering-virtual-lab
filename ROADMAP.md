# Roadmap do EEVL

Planejamento flexível, não promessa de funcionalidades disponíveis. Estado real:
[ARCHITECTURE.md](ARCHITECTURE.md) e [docs/API.md](docs/API.md). Não criar placeholders
ou implementar toda esta lista antecipadamente.

## 0. Consolidar o que existe

**Estado em 26/11/2026:** documentação consolidada; portal com seleção de idioma,
fallback, metadados localizados do catálogo e cache; textos gerais disponíveis em
pt-BR/en/es. Os aplicativos de circuito RC/RL/RLC, nodal DC/AC, LT, magnetostática e
eletrostática têm interface, ajuda e conteúdo documentado em pt-BR/en/es. Os seis
aplicativos legados têm tradução parcial em seus wrappers; o conteúdo original continua
em português. Os aplicativos não estão integrados entre si. Contratos e cobertura:
[docs/API.md](docs/API.md) e [docs/I18N.md](docs/I18N.md).

Próximos passos opcionais: revisar traduções próprias dos aplicativos, melhorar testes
de UI e incluir comparações numéricas reproduzíveis, sem inventar certificações.

## 1. Reutilização e contratos

**Status: em andamento.** `assets/js/core/` já oferece módulos importáveis para matemática,
complexos, matrizes reais e complexas, polinômios, sistemas e análise de controle, resposta
temporal, projeto, cálculo de polos e zeros e solvers não lineares. Há testes e fixtures;
contratos, convenções e limites estão em [docs/API.md](docs/API.md). O laboratório de LT foi o
primeiro consumidor do núcleo; os modelos nodais DC e AC também passaram a usar os
solucionadores compartilhados. A extração de funções legadas do SISO e a migração dos modelos
RC/RL/RLC para o núcleo continuam pendentes; funções equivalentes no núcleo não significam
que esses aplicativos já as importem.

### Inventário de extração

Inventário de funções legadas e de funcionalidades relacionadas já disponíveis no núcleo.
Uma equivalência indicada não significa que o aplicativo legado já importe essa função;
compare algoritmos, contratos e convenções antes de cada migração.

| Origem | Funções numéricas independentes de DOM | Disponibilidade no núcleo / situação |
|---|---|---|
| `nodal-analysis/model.js` | DC MNA solve | Migrated to `matrix.js` `msolve(A,B,{absTol: LIMITS.singularPivotTol, relTol: 0})`; public `SINGULAR_SYSTEM` is preserved. |
| `nodal-analysis-ac/model.js` | `cx` (aritmética complexa), `solveComplexSystem` | Migrados para `complex.js` e `cmatrix.js` (`csolve`, com tolerância relativa). O adaptador preserva ângulos em graus, fasores de pico e erros públicos; divisão complexa estável e validação vêm do núcleo. |
| `electrical-circuits/shared/model.js` | RK4 e solução analítica de RC/RL/RLC | O próprio modelo já exporta `rk4Step` e soluções locais; `timeresp.js` oferece resposta de sistemas LTI, não substituto direto do modelo de circuito. |
| `siso/app.html` (protegido) | polinômios e raízes (`pmul`, `roots`, `aberth`, `matchRoots`) | Equivalentes em `polynomial.js`; o SISO integrado mantém as funções internas. |
| `siso/app.html` | matrizes (`msolve`, `expm`, `charpoly`) | Equivalentes em `matrix.js`; o SISO integrado mantém as funções internas. |
| `siso/app.html` | `tf2ss`, `c2d`, `pade`, `makeFR`, `bisect`, `margins` | Equivalentes em `control.js`; o SISO integrado mantém as funções internas. |
| `siso/app.html` | `logspace` | `numeric.js`; verificar a ordem dos argumentos antes de adaptar consumidores. |
| `siso/app.html` | `charFreq`, `stepResponse`, `distResponse`, `computeLocus`, `factorPoly` | Há funções relacionadas em `timeresp.js`, `analysis.js` e `polynomial.js`; não são equivalências exatas comprovadas. Comparar contratos e resultados antes de migrar. |
| `magnetostatics/model.js`, `electrostatics/model.js` | campo, linhas de campo, contornos | Sem equivalente no núcleo; são específicos de eletromagnetismo. |

Sem sobreposição com o núcleo: parsers de expressão do SISO e todo o código de apresentação.
Os cinco legados restantes (`buck`, `buck-step`, `dab`, `opamp`, `buck-pid`) não têm nenhuma
função cujo nome e corpo coincidam com o núcleo. Quatro deles são minificados em poucas linhas
e só o `buck-pid` é formatado. O padrão que se repete é o integrador RK4 (`buck`, `buck-step` e
`dab`, sem cópia literal; o `buck-pid` usa ponto médio), e o núcleo ainda não exporta um RK4.
Só `simulate` do `buck-step` e do `dab` são puras; as do `buck` e do `buck-pid` leem estado
global ou escrevem no DOM e precisam ser separadas antes de qualquer extração.

### Nodal solver compatibility with the shared core

The DC and AC nodal models now call the shared `msolve` and `csolve` kernels, respectively.
The DC adapter preserves the existing `SINGULAR_SYSTEM` error and maps only `SINGULAR_MATRIX`.
The former DC elimination routine is frozen in `tests/helpers/nodal-dc-reference.mjs` for
compatibility checks. `solveLinearSystem` also inherits shared input shape and finite-value
validation.

| Aspect | Nodal DC | Shared core |
|---|---|---|
| Algorithm | Gauss-Jordan via `msolve` | Gauss-Jordan with partial pivoting |
| Singularity | `{absTol: LIMITS.singularPivotTol, relTol: 0}` | Optional `{absTol, relTol}` |
| Error | `SINGULAR_SYSTEM` | `SINGULAR_MATRIX`, adapted by the DC model |

`tests/core-singular-tolerance.test.mjs` compares both adapters with frozen independent
references and checks threshold behavior. The AC adapter uses `{absTol: 0, relTol: 1e-12}`,
maps only `SINGULAR_MATRIX`, and preserves degrees and peak phasors. Shared complex division
uses Smith scaling instead of the former naive formula; low-level validation can differ.

Later steps can evaluate shared RC/RL/RLC
models, SISO functions and suitable legacy consumers with regression tests for each migration.

## 2. Arquivos e projetos locais

Prioridade de infraestrutura: gerenciador compartilhado de arquivos e configurações,
independente da futura linguagem. Abrir, salvar, salvar como, abrir pasta, recentes,
autosave, recuperação, duplicar, renomear e excluir com confirmação. Cada aplicativo
define seu estado serializável; a infraestrutura valida e migra o envelope versionado
(appId, tipo de conteúdo, versão do esquema e dados). Usar formatos convencionais
JSON, CSV e ZIP; não criar extensões distintas para plantas, controladores ou projetos.
A extensão de código da futura linguagem permanece em discussão.

IndexedDB para recuperação e referências a arquivos; File System Access API opcional,
com autorização explícita e verificação de permissões. Oferecer importação/download
convencional quando indisponível. Não sobrescrever arquivos pessoais sem autorização
nem enviá-los automaticamente ao GitHub. Projetos são opcionais para labs simples.
Validar inicialmente em um aplicativo existente, incluindo migração, recuperação,
permissões revogadas e funcionamento sem pasta.

### Infraestrutura transversal (proposta)

- Componentes de UI compartilhados: campos com unidades, menus, gráficos e editores.
- Gerenciador de tarefas: Web Workers reutilizáveis, fila, progresso, cancelamento,
  limites de memória e erros; paralelizar apenas tarefas independentes.
- Registro de modelos: contratos de entradas, saídas, estados, parâmetros, unidades,
  referenciais, versões e documentação.
- Visualização 2D/3D e adaptador CesiumJS, independente do interpretador.
- Continuar ampliando o núcleo matemático existente e seus testes de regressão.

Essas frentes podem avançar em paralelo; não são funcionalidades já disponíveis.

## 3. Subconjunto matemático e controladores

Interpretador controlado MATLAB/Octave: parser/AST, matrizes e complexos, operações
matriciais/elementares, indexação 1-based, sequências e fluxo limitado. Somente comentários
de linha `%`, inclusive após `;`. Nunca eval/Function. Especificação em
[docs/LANGUAGE.md](docs/LANGUAGE.md); nenhuma linguagem genérica está disponível hoje.

Controladores com portas, parâmetros, memória explícita, inicialização, execução
periódica e monitoramento. Scheduler de tempo virtual determinístico, múltiplos períodos
e ZOH. Implantar primeiro em uma planta simples; documentar ordem de eventos e limites.

### Evolução conceitual da linguagem EEVL

**Ideia preliminar, não validada nem implementada.** Ver [proposta conceitual](language.html).
Investigar uma extensão da sintaxe MATLAB/Octave com declarações paralelas
`function`, `model` e `netlist`, encerradas por `end`. Modelos podem ser
algorítmicos, contínuos, discretos ou compostos, com portas, parâmetros e estados
nomeados. Estudar `der`, `next`, eventos, portas físicas acausais e equações
implícitas; nenhuma dessas construções está congelada.

Organização textual candidata, com seções opcionais:

```matlab
%% INITIAL_SCRIPT
% imports, parameters, functions and model definitions
%% NETLIST
% components, connections and optional diagram geometry
%% ANALYSIS_SCRIPT
% simulations, analysis, plots and tests
```

Metadados e interfaces ficam fora da linguagem. Interfaces específicas continuam
em JavaScript/HTML/CSS, contribuídas por PR. Um projeto poderá ser reutilizado
como modelo sem executar automaticamente seu script de análise. Netlist generalizada
e editor gráfico devem compartilhar uma representação tipada, com inferência de
tipos, unidades e referenciais, hierarquia e validação de conexões.

Escopo proposto: sistemas de parâmetros concentrados, incluindo circuitos,
controle, potência, sistemas digitais, híbridos e aeroespaciais. Não incluir
solvers gerais de PDE/FEM/CFD/FDTD inicialmente. Caracterização SPICE externa,
com modelos reduzidos e LUTs importáveis, sem ngspice no runtime.
Validar gramática, semântica, inicialização, eventos e casos numéricos antes de
promover a proposta a especificação. Reutilizar as APIs matemáticas existentes;
não executar código arbitrário com eval/Function.

## 4. Motor genérico e Modeling & Simulation

Suportar progressivamente TF, SS, ZPK, sistemas discretos, ODE não linear e modelos
identificados. Editor de blocos com subsistemas, fontes, álgebra, saturação, integradores,
atrasos, TF/SS, controle programável e osciloscópios. Tratar dependências, múltiplas taxas,
eventos e laços algébricos, declarando capacidades e limitações. 3D somente pertinente.

Porta de saída: casos conhecidos contínuos/discretos/híbridos, estabilidade e convergência,
limites de recursos e interrupção do cálculo. Um app simples não deve expor todo o motor.

## 5. Identificação genérica

Importar CSV, escolher sinais/período de amostragem, pré-processar, estimar primeira e
segunda ordem com atrasos, mínimos quadrados, ARX e parâmetros físicos. Comparar dados
medidos/simulados, resíduos e conjunto independente de validação; exportar modelos
compatíveis. ARMAX, OE e métodos de subespaços ficam para expansão posterior.

## 6. Otimização genérica

Variáveis de decisão, chutes, limites, objetivo programável, restrições, algoritmo,
critérios de parada e orçamento de avaliações. Simulações sucessivas podem avaliar
objetivos; não limitar o módulo à sintonia de controle.

Exemplo **proposto**, ainda não executável no EEVL:

```matlab
J = trapz(t, e.^2 + 0.01*u.^2);
c = [max(abs(u))-10; overshoot-5]; % viável quando c <= 0
```

Métodos em ordem de necessidade: grade, mínimos quadrados, Nelder–Mead e gradiente;
futuramente evolução diferencial, PSO e multiobjetivo. Diferenciar mínimos locais,
limites de viabilidade e critérios de parada; não prometer ótimo global.

## 7. Modelagem simbólica e multifísica

A MNA resistiva/fasorial existente é um ponto de partida, não o ambiente completo.
Evoluir de forma incremental e enxuta para equações algébricas/diferenciais, SS/TF,
equilíbrios, linearização e discretização.

Multifísica não exige um motor próprio: tratar os domínios por analogia, com uma variável
de esforço e uma de fluxo (tensão/corrente, temperatura/fluxo de calor, torque/velocidade),
reaproveitando a MNA e o motor da seção 4. Começar por poucos casos didáticos concretos,
como circuito RC térmico, motor CC (elétrico + mecânico) e aquecimento de semicondutores
(perdas → temperatura), com acoplamento simples por entradas e saídas entre blocos.
Jacobianas, modelos médios, sensibilidade e domínios adicionais (magnético, eletroquímico)
só entram quando um caso didático os exigir. Não complicar a implementação inicial para
antecipar todos os domínios.

## API MATLAB/Octave futura

O núcleo já implementa parte dos nomes abaixo; isso não implica compatibilidade integral
com MATLAB/Octave. A coluna de disponibilidade é um resumo: contratos, limites e exceções
estão em [docs/API.md](docs/API.md). Os demais nomes continuam propostas, não uma API
disponível.

| Família | Já disponível em `assets/js/core/` | Ainda proposto |
|---|---|---|
| Matemática | zeros, ones, eye, diag, reshape, linspace, logspace, sum, mean, median, std, quantile, percentile, diff, norm, eig, svd, svdvals, rank, pinv, inv, expm, erf, erfc | — |
| Probabilidade | qfunc, ndtr, ndtri, normalInterval | — |
| Sistemas | tf, ss, zpk, tf2ss, ss2tf, c2d, d2c, feedback, series, parallel, ctrb, obsv | — |
| Análise | step, impulse, lsim, bode, nyquist, margin, rlocus, pole, zero | — |
| Projeto | place, acker, lqr, dlqr, care, dare, lyap, dlyap | lqi, kalman |
| Identificação | — | iddata, arx, tfest, ssest, compare |
| Otimização | — | fminsearch, fminunc, fmincon, lsqnonlin |
| Sinais | `conv` (convolução de vetores/coefs em `polynomial.js`), fft, ifft, filter/lfilter | — |
| Integração | trapz, cumtrapz, simpson, quad (Simpson adaptativo em intervalo finito) | ode45 |
| Estatística | histogram | — |
| Aleatoriedade | gerador com semente (`mulberry32`), amostragem normal (Box–Muller) | — |
| Simbólico | — | sym, diff (sobre `sym`), jacobian, simplify, solve |

Funções com nomes semelhantes existem encapsuladas no SISO, em modelos locais ou em
`assets/js/core/` (ver [docs/API.md](docs/API.md));
isso não significa que a API MATLAB/Octave inteira esteja implementada. Contratos,
compatibilidade, casos não suportados e testes devem preceder cada disponibilização.
Como no MATLAB, `diff` calcula diferenças entre elementos adjacentes de vetores
(numérico, já em `assets/js/core/`); a derivada simbólica só se aplica a objetos `sym`,
ainda não implementados.

## Integração futura entre aplicativos

Importar dados → identificar planta → salvar modelo → projetar controle → programar
implementação discreta → otimizar → simular referências, perturbações, ruído e saturação
→ salvar/compartilhar projeto. Depende de formatos comuns e módulos anteriores;
não está implementado no estado de 26/11/2026. Prioridades podem mudar conforme uso didático real.
