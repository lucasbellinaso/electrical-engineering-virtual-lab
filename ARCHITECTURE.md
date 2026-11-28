# Arquitetura do EEVL

Referência normativa de princípios, decisões e contratos. Estado inspecionado em
27/11/2026; evolução proposta em [ROADMAP.md](ROADMAP.md).

## Propósito e limites

Plataforma aberta de aplicativos educacionais de Engenharia Elétrica para graduação,
pós-graduação, experimentação e projeto/teste de controle de baixa e média complexidade.
Não pretende substituir integralmente MATLAB, Simulink, PLECS ou outros ambientes
científicos. Seus pilares são **simplicidade de utilização**, **transparência matemática**
e **modularidade de desenvolvimento**.

O uso normal acontece exclusivamente no navegador: HTML, CSS e módulos JavaScript,
sem backend, servidor de processamento, cadastro ou instalação obrigatória. GitHub
Pages serve arquivos estáticos, inclusive em subdiretório. A instalação da PWA é opcional.
Node, Python, NumPy, SciPy, Python Control e Octave podem apoiar desenvolvimento e
validação; não integram os requisitos de execução dos aplicativos.

## Estado implementado

| Camada | Implementação atual |
|---|---|
| Portal | index/about/contribute; CSS e temas compartilhados |
| Catálogo | JSON de simuladores/categorias, busca, dificuldade, estado e ordenação |
| Idiomas | pt-BR, en, es no portal; fallback inglês; idiomas reais por aplicativo |
| Navegação de legados | apresentações com iframe; arquivo de execução separado |
| Modelos puros | template RC, RC/RL/RLC, análise nodal resistiva e fasorial, magnetostática (fios, espira e solenoide em `simulators/electromagnetics/magnetostatics/`), eletrostática (cargas, esfera, fio e placas em `simulators/electromagnetics/electrostatics/`) |
| Núcleo matemático | `assets/js/core/`: polynomial, matrix, cmatrix, control, numeric, complex, residue, timeresp, design, riccati, analysis, solvers, eigen, models; LT consome complex/cmatrix/numeric; DC nodal analysis uses shared `msolve`; AC nodal analysis uses shared `complex`/`csolve`; fixtures SciPy |
| Compartilhamento | modelo, Worker, gráficos e deduções em electrical-circuits/shared |
| PWA | manifesto, cache versionado, shell pela rede com fallback offline e labs sob demanda |
| Validação | verificações de integridade, testes analíticos específicos e preservação por hash |

Há 17 entradas disponíveis no catálogo desta base; nos legados a tradução é parcial e o original segue em português. O espanhol das descrições, sozinho, **não** muda
essa classificação; vale o campo `languages` de cada entrada.
O template RC fica fora do catálogo. A lista atualizável de arquivos e metadados é
[data/simulators.json](data/simulators.json), não este inventário datado.

O laboratório de [LT como quadripolo](docs/TRANSMISSION-LINE.md), em Sistemas
Elétricos de Potência, usa modelo puro por fase RMS e é o primeiro consumidor
do núcleo matemático nos aplicativos. O núcleo também é armazenado sob demanda
para manter o laboratório disponível offline depois da primeira visita.

O núcleo já oferece otimização local e ajuste de curvas. Não existem ainda interpretador MATLAB/Octave compartilhado, gerenciador completo de
projetos ou motor genérico de blocos. A análise nodal atual
não equivale a um editor simbólico/multifísico completo.

## Organização dos aplicativos

As áreas técnicas atuais continuam em `data/categories.json`. Uma segunda dimensão
conceitual orienta projeto e documentação, sem novos filtros obrigatórios nesta entrega:

| Finalidade | Atividade e interface |
|---|---|
| Concept Labs / Laboratórios Conceituais | modelos predefinidos, poucos parâmetros, gráficos e deduções; sem programação obrigatória; projetos opcionais |
| Engineering Labs / Laboratórios de Engenharia | plantas físicas configuráveis, estados iniciais, referências e perturbações; futuramente controle programável, múltiplas taxas e projetos |
| Modeling & Simulation / Modelagem e Simulação | futuro ambiente genérico de plantas, blocos, sistemas contínuos/discretos/híbridos, ODE não linear e subsistemas |
| Analysis & Design Tools / Análise e Projeto | SISO existente; evolução para MIMO, identificação, otimização, sinais e programação matemática |

Aplicativos conceituais devem permanecer simples mesmo que outros módulos ganhem
capacidades avançadas. 3D só deve entrar quando contribuir para a atividade; associação
de variáveis a objetos 3D é planejamento, não requisito de todo laboratório.

## Estrutura e dependências

`assets/js/{i18n,common,app,document,lab}.js` cuida do portal. Modelos reutilizáveis
já estão separados da UI nos aplicativos originais. Consulte as interfaces reais em
[docs/API.md](docs/API.md) antes de implementar matemática semelhante.

`assets/js/core/` já contém os módulos listados em “Estado implementado”; podem vir
simulation, identification, symbolic e interpreter; `optimize.js` e `signal.js` já existem.
Não criar arquivos vazios.
Extrair quando houver necessidade real e contrato testável. Dependências de UI não
podem contaminar o modelo puro. Gráficos e 3D também devem ter interfaces próprias.

Plotly 2.35.2 é uma dependência local herdada do SISO; KaTeX 0.16.22 renderiza equações
localmente nos aplicativos originais. Licenças estão em `assets/vendor/`. A inclusão
de Math.js, ml-matrix ou Nerdamer exigirá avaliação de licença, tamanho, manutenção,
confiabilidade, compatibilidade offline e ganho efetivo. Nada foi incluído automaticamente.

## Contratos atuais e evolução

### Catálogo e idioma

Títulos, descrições e palavras-chave do catálogo e nomes de categorias têm en/pt-BR/es.
`languages` informa a interface e documentação realmente disponíveis no **aplicativo**.
Identificador, caminho relativo, autores, colaboradores, versão, datas, dificuldade,
estado, referências, validação e evidência são preservados. `planned` exige caminho
nulo e não pode simular disponibilidade. Não inferir validação pela aparência.

A seleção e fallback estão definidos em [docs/I18N.md](docs/I18N.md). O modelo matemático
é único para todos os idiomas; número formatado não deve voltar ao algoritmo como string.

### Matemática e dados

Os modelos atuais têm formatos diferentes; não há contrato universal já implantado.
Matrizes numéricas são arrays de linhas, polinômios do SISO usam coeficientes em ordem
decrescente, e a análise fasorial usa complexos `{re, im}`. Esses detalhes estão na API.
Priorizar comportamento MATLAB/GNU Octave em futuras interfaces, com adaptadores
explícitos para evitar mudanças silenciosas de orientação, unidades, índices e sinais.

Proposta futura: envelopes JSON com `kind`, `schemaVersion`, identificação, unidades,
parâmetros e dados. Plantas terão representação TF/SS/ZPK, discreta ou ODE; sinais terão
tempo, canais, unidades e amostragem; controladores terão portas, parâmetros, memória,
inicialização e tarefas. Os esquemas não estão congelados nem implementados. Separar
versão do formato, versão do modelo e identificação do aplicativo. Validar e migrar
formatos explicitamente antes de consumi-los; rejeitar versões desconhecidas.

### Simulação futura

Plantas não lineares devem separar entradas, saídas, parâmetros, estados contínuos,
condições iniciais, derivadas e equações de saída. O motor integra estados; a interface
apenas configura e apresenta. Deve poder acomodar TF, SS, ZPK, sistemas discretos,
modelos identificados, circuitos e blocos sem obrigar cada app a implementar tudo.

Editor futuro: fontes, álgebra, saturação, integrador, atraso discreto, TF/SS, plantas
e controladores programáveis, subsistemas, osciloscópios e 3D pertinente. Ordenar
dependências, distinguir integração e eventos, detectar laços algébricos e informar
quais podem ser resolvidos. Não alegar suporte genérico a DAE por existir uma solução
específica de MNA ou realimentação no SISO.

### Controladores programáveis futuros

Campos separados: entradas, saídas, parâmetros/constantes, memória explícita,
inicialização, código periódico e período. Entradas vêm da planta ou de outros blocos;
parâmetros ficam constantes durante a execução normal. Memória persiste, locais vivem
só na chamada atual, e saídas mantêm valor entre atualizações (ZOH).

Múltiplas tarefas devem operar no **tempo virtual**, não por `setInterval` físico.
Proposta de política: eventos simultâneos ordenados por prioridade declarada e ID
estável; definir se leituras veem o snapshot anterior ou atualizações já confirmadas,
antes de oferecer acoplamentos diretos. Controladores em cascata exigirão dependência
explícita. Monitorar memória/variáveis internas e registrar ordem no resultado.
A memória explícita tem finalidade didática. Sintaxe e exemplo PI em
[docs/LANGUAGE.md](docs/LANGUAGE.md); nada desse runtime foi implementado nesta tarefa.

### Projetos e armazenamento

O piloto de busca de mínimo abre e salva configurações JSON por `assets/js/project-files.js`,
valida aplicativo e versão e avisa sobre alterações não salvas. O navegador pode oferecer
File System Access API ou abertura/download convencional. Cada aplicativo valida seus dados;
não se enviam arquivos ao GitHub. Documentação e limites em [docs/API.md](docs/API.md).

Ainda faltam novo projeto, pasta opcional, recentes, autosave e recuperação, permissões
persistentes e expansão a outros aplicativos. Sem extensões específicas por tipo; usar
JSON, CSV, ZIP, SVG e GLB/glTF conforme o conteúdo. Um projeto poderá guardar planta/parâmetros, estados iniciais,
controladores/memória/código, períodos, referências, perturbações, configuração de
simulação/gráficos e resultados opcionais. CSV e SVG/PNG quando pertinentes.

File System Access API será opcional: escolher pasta por gesto do usuário, guardar
handles em IndexedDB (não cookies), restaurar referências e verificar permissões;
solicitar autorização novamente quando necessário. Sem suporte, usar IndexedDB e
importação/exportação convencional. O aplicativo deve funcionar sem pasta obrigatória.
Nunca enviar arquivos pessoais automaticamente ao GitHub. O gerenciador completo ainda não existe.

## Contratos, diagramas e visualização futuros

O contrato de modelo deve separar matemática da interface e identificar entradas,
saídas, portas físicas acausais, parâmetros, estados, unidades, dimensões, referenciais,
períodos, equações, eventos e versão. Será validado com consumidores reais antes de
qualquer motor universal. Workers existentes são específicos; um futuro gerenciador
poderá oferecer fila, progresso, cancelamento, pool e transferência de buffers, sem
presumir paralelismo em cálculos sequenciais. Tempo virtual é distinto de tempo real.

Diagramas futuros terão layout interno de componentes e conexões, layout externo
do símbolo e portas públicas, e posição/rotação/escala/espelhamento por instância.
Blocos poderão ser gerados pelas portas declaradas ou usar SVG customizado. Geometria
não altera matemática; sinais direcionais e conexões físicas devem ser distintos.
Uma eventual visualização 3D de GLB/glTF, orientação e trajetórias será independente
do modelo e da linguagem; CesiumJS é opção para aplicações georreferenciadas, não
dependência atual. IA será opcional e não recebe credenciais no repositório.

## SISO: referência e reutilização

`simulators/control-systems/siso/app.html` permanece a aplicação integrada; o original
de referência continua em `Control Systems/`, com hashes em `docs/provenance.json`.
O [inventário confirmado](docs/SISO.md) distingue funções numéricas de funções ligadas
à UI. Extrair, generalizar, adaptar convenções, testar e migrar progressivamente,
comparando comportamento antes/depois. Não criar outro app que duplique o SISO.
Interface funcional não prova validação completa; nenhuma extração extensa foi feita.

## PWA, transparência e validação

Cada simulador oferece um botão próximo ao seletor de idioma para preparar seus recursos offline. O inventário `data/offline-manifest.json` é gerado por `npm run offline:manifest`, com dependências estáticas e possíveis adições declaradas em `offlineDependencies`; veja [CONTRIBUTING.md](CONTRIBUTING.md). O service worker baixa os recursos em cache temporário e só confirma a disponibilidade após conferir todos. A confirmação é específica do navegador e da versão do cache; remova ou reprepare dados conforme necessário. Recursos externos, como fichas técnicas em sites de terceiros, não são incluídos.

As [convenções de apresentação](docs/UI-CONVENTIONS.md) exigem equações e variáveis
renderizadas a partir de LaTeX em toda a interface, inclusive controles e desenhos,
e escala Y estável nos gráficos atualizados continuamente, com reenquadramento
explícito e indicação de valores fora da faixa. O documento define o padrão;
a adequação dos aplicativos existentes é progressiva e deve ser verificada.

Preservar manifesto, ícones, escopo relativo, instalação opcional e atualização.
O shell usa rede primeiro com cache offline; módulos, bibliotecas e simuladores são
armazenados quando visitados ou preparados explicitamente. Traduções oficiais fazem parte do shell.
O navegador pode remover dados; offline não é garantia de armazenamento permanente.

Cada gráfico deve declarar unidades, escalas, eixos, referências, normalizações e
convenções. Quando houver coordenadas não cartesianas, mostrar também posição cartesiana;
distinguir posição, componentes vetoriais e vetores unitários. Explicar singularidades
e limites físicos em detalhes acessíveis sem sobrecarregar a tela principal.

Critérios científicos e evidências em [docs/VALIDATION.md](docs/VALIDATION.md).
Registros históricos em SPECIFICATION e IMPLEMENTATION-REPORT não são certificações
atuais. Nesta entrega, nenhuma equação ou algoritmo de aplicativo foi modificado.
