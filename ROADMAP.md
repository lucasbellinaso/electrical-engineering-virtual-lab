# Roadmap do EEVL

Planejamento flexível, não promessa de funcionalidades disponíveis. Estado real:
[ARCHITECTURE.md](ARCHITECTURE.md) e [docs/API.md](docs/API.md). Não criar placeholders
ou implementar toda esta lista antecipadamente.

## 0. Consolidar o que existe

- Esta entrega consolida documentos e adiciona espanhol aos textos gerais, seleção,
  fallback, metadados do catálogo e cache. Não traduz integralmente nem integra aplicativos.
- Próximos passos opcionais: revisar traduções próprias dos aplicativos, melhorar
  testes de UI e incluir comparações numéricas reproduzíveis, sem inventar certificações.

## 1. Reutilização e contratos

**Status: em andamento.** O núcleo numérico em `assets/js/core/` já cobre matemática,
complexos, matrizes, polinômios e controle, com testes e fixtures, ainda sem consumidores
nos aplicativos. A extração das funções do SISO e dos modelos nodais/RC/RLC continua pendente.

Inventariar SISO e modelos nodais/RC/RLC; extrair funções independentes quando outro
consumidor justificar. Priorizar matemática, complexos, matrizes, polinômios e controle;
uniformizar convenções MATLAB/Octave por adaptadores e testes, preservando referência.
Avaliar bibliotecas existentes antes de reimplementar. Não duplicar o SISO.

Porta de saída: contratos documentados, módulos importáveis sem DOM, testes de regressão,
licenças avaliadas e nenhuma alteração silenciosa de método ou convenção.

## 2. Arquivos e projetos locais

Formatos JSON versionados para plantas, controladores, sinais e projetos; gerenciador
com abrir/salvar, duplicar, renomear/excluir, importação/exportação, recentes, autosave
e alterações não salvas. `.eevl`, `.eevlc` e `.eevlp` são nomes propostos. IndexedDB e
downloads como base; pasta opcional via File System Access API e permissões renováveis.
Não transmitir arquivos pessoais automaticamente ao repositório.

Porta de saída: migrações de formato, recuperação de falhas, testes sem acesso a pastas
e exportação interoperável. Projetos são opcionais para laboratórios conceituais.

## 3. Subconjunto matemático e controladores

Interpretador controlado MATLAB/Octave: parser/AST, matrizes e complexos, operações
matriciais/elementares, indexação 1-based, sequências e fluxo limitado. Somente comentários
de linha `%`, inclusive após `;`. Nunca eval/Function. Especificação em
[docs/LANGUAGE.md](docs/LANGUAGE.md); nenhuma linguagem genérica está disponível hoje.

Controladores com portas, parâmetros, memória explícita, inicialização, execução
periódica e monitoramento. Scheduler de tempo virtual determinístico, múltiplos períodos
e ZOH. Implantar primeiro em uma planta simples; documentar ordem de eventos e limites.

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

## Biblioteca planejada

Os nomes abaixo indicam convenções pretendidas; **não são uma API disponível**:

| Família | Nomes previstos |
|---|---|
| Matemática | zeros, ones, eye, diag, linspace, logspace, reshape, sum, mean, std, diff, norm, eig, svd, rank, inv, pinv, expm |
| Sistemas | tf, ss, zpk, tf2ss, ss2tf, c2d, d2c, feedback, series, parallel, ctrb, obsv |
| Análise | step, impulse, lsim, bode, nyquist, margin, rlocus, pole, zero |
| Projeto | place, acker, lqr, dlqr, care, dare, lyap, dlyap, lqi, kalman |
| Identificação | iddata, arx, tfest, ssest, compare |
| Otimização | fminsearch, fminunc, fmincon, lsqnonlin |
| Sinais | fft, ifft, filter, conv |
| Integração | trapz, cumtrapz, ode45 |
| Simbólico | sym, diff (sobre `sym`), jacobian, simplify, solve |

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
não foi implementado nesta entrega. Prioridades podem mudar conforme uso didático real.
