# Integração do SISO / SISO integration

Este documento mantém a descrição da integração e o inventário confirmado abaixo.
Diretrizes atuais: [arquitetura](../ARCHITECTURE.md); API pública: [API.md](API.md).

## Português
O arquivo fornecido `Control Systems/SisoApp - projeto de controladores.html` permanece intacto.
O programa se identifica como SISO Design App, baseado no PythonSisoDesignApp,
Prof. Lucas V. Bellinaso, UFSM. A atribuição foi preservada, sem usar marcas institucionais.

`simulators/control-systems/siso/app.html` é uma cópia com **uma única substituição**:
Plotly 2.35.2 via CDN → `../../../assets/vendor/plotly-2.35.2.min.js`.
Os métodos numéricos, equações, parâmetros, hipóteses, estilos e interface do
programa fornecido não foram alterados. A página `index.html` ao lado é uma
apresentação bilíngue independente, com um iframe e abertura em página inteira.
O aplicativo original continua em português; isso está identificado no catálogo.

O fonte contém representação em espaço de estados, discretização ZOH por
exponencial matricial (Padé), busca de raízes, Bode, lugar das raízes e respostas
temporais. Essa descrição foi obtida por inspeção, não é validação dos algoritmos.
As hipóteses, controles e resultados devem ser consultados no aplicativo original.
Não foram fornecidas comparações analíticas, numéricas independentes ou medições
experimentais. Classificação atual: **experimental**. Não usar os testes de
preservação ou testes RC como evidência de validação do SISO.

Recrie a cópia com `python scripts/integrate-simulators.py`. Os hashes e a alteração
exata estão registrados em `docs/provenance.json`. A verificação automática desfaz
a substituição em memória e compara todos os bytes com o original.

Plotly é uma dependência herdada necessária aos gráficos existentes; sua licença
MIT está em `assets/vendor/plotly-LICENSE`. Não é carregada no catálogo. Uma visita
ao SISO com Service Worker ativo armazena a página e Plotly para acesso offline.
Na primeira visita ao site, aguarde a instalação do Service Worker e recarregue
antes de abrir o simulador. O armazenamento depende da quota e política do navegador.

## English
The supplied source is preserved byte for byte. The integrated `app.html` changes
only the Plotly 2.35.2 script URL from CDN to the local copy of the same version.
No mathematical model, algorithm, parameter or interface was changed. The bilingual
wrapper is independent; the original application is Portuguese only.

Source inspection identifies state-space models, ZOH discretization with a matrix
exponential (Padé), root finding, Bode, root locus and time responses. This is a
description of the source, not validation. Independent scientific evidence has not
been provided; the laboratory remains **experimental**. Source-preservation and RC
tests do not validate SISO. Author attribution is preserved from the supplied source.

See the provenance JSON for original, integrated and dependency SHA-256 hashes.
Plotly is vendored with its MIT license. Open the simulator online with the Service
Worker active to cache its resources; offline availability depends on browser storage.

## Inventário confirmado por inspeção (26/11/2026)

Todas as funções abaixo foram localizadas em `simulators/control-systems/siso/app.html`.
São funções internas de um script HTML, **não módulos exportados**, nem uma API
MATLAB/Octave pronta. Assinaturas documentam o estado atual; não devem ser tomadas
como convenções definitivas para uma extração.

| Função existente | Papel e acoplamento a revisar |
|---|---|
| pmul(a,b), padd(a,b) | produto e soma de polinômios; coeficientes em ordem decrescente |
| polyFromRoots(rs) | coeficientes a partir de raízes, usa representação complexa interna |
| roots(pIn,init), aberth(c,n,init) | busca de raízes e iteração de Aberth; revisar escalas, condicionamento, convergência e inicialização |
| mmul(A,B), msolve(A,B) | matrizes por linhas; msolve resolve A·X=B com RHS matricial e pivotamento |
| expm(A) | escalonamento, quadratura e aproximação Padé de ordem 6 |
| charpoly(A) | polinômio característico por Faddeev–LeVerrier |
| tf2ss(num,den) | forma canônica controlável, retorna A/B/C/D/n; num/den em ordem decrescente |
| c2d(A,B,dt) | ZOH por exponencial da matriz aumentada; retorna Ad/Bd, não a API MATLAB completa |
| closedLoopSS(Gc,Gp,Gf) | constrói malha específica; entradas r/du/dy/dm, saídas y/uc; verifica denominador algébrico específico |
| simulate(sys,U,dt,discrete) | estado inicial zero, entradas por canais Float64Array; saídas por canal; não é motor híbrido genérico |
| pade(T,N) | aproximação de atraso, retorna num/den |
| makeFR(zeros,poles,k,discrete,Ts,delay=0) | cria avaliador de resposta em frequência |
| margins(fr,w0,w1) | análise de margens no intervalo fornecido; revisar cruzamentos múltiplos e tolerâncias |
| computeLocus() | lugar das raízes dependente do estado global do app; requer desacoplamento |
| stepResponse(sys,Gp,tf,discrete,Ts,wfast=0) | cálculo temporal ligado a configurações internas; revisar dependências antes de extrair |

Há helpers adicionais (normalização polinomial, representação complexa, análise e
formatação) que deverão entrar numa auditoria de dependências antes de reutilização.
Parsers de campos não constituem interpretador MATLAB/Octave genérico. O inventário
não altera classificação experimental, proveniência ou evidências científicas.

## Estratégia gradual de reutilização

1. Inventariar dependências numéricas e de UI, unidades, formatos, índices e tolerâncias.
2. Selecionar uma função independente com necessidade real de outro consumidor.
3. Criar módulo puro com contrato explícito e adaptador, preservando a referência original.
4. Padronizar nomes e comportamento conforme MATLAB/GNU Octave; documentar diferenças
   de assinatura, forma de vetor/matriz, complexos, amostragem, atrasos e convenções de sinal.
5. Testar casos analíticos e referências numéricas reproduzíveis; controlar condicionamento,
   resíduos, entradas inválidas e convergência.
6. Migrar um consumidor por vez e comparar respostas/margens/raízes antes e depois,
   com parâmetros e tolerâncias registrados; preservar exportações/configurações existentes.
7. Só ampliar a API depois de regressão e revisão. Não duplicar o aplicativo SISO.

Nenhuma extração ou mudança de algoritmo foi realizada nesta consolidação documental.
