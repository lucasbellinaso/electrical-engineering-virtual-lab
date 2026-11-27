# Instruções permanentes para agentes

## Antes de editar

- Leia [ARCHITECTURE.md](ARCHITECTURE.md), [CONTRIBUTING.md](CONTRIBUTING.md),
  [ROADMAP.md](ROADMAP.md) e a documentação do módulo afetado. A especificação e
  os relatórios antigos em docs são registros históricos, não regras concorrentes.
- Inspecione árvore, branch, diff, catálogo, módulos e testes. Preserve alterações
  existentes e trabalho concorrente; use branch/checkout isolado quando necessário.
- Distinga recursos implementados em [docs/API.md](docs/API.md) de propostas em
  [docs/LANGUAGE.md](docs/LANGUAGE.md) e ROADMAP. Não anuncie planejamento como pronto.

## Aplicativos e biblioteca compartilhada

- Ao criar ou modificar um aplicativo, consulte a skill [eevl-simulator](.agents/skills/eevl-simulator/SKILL.md) e siga [CONTRIBUTING.md](CONTRIBUTING.md). A skill aponta para as fontes do projeto; não substitui suas regras.
- Antes de implementar cálculos, consulte [docs/API.md](docs/API.md) e `assets/js/core/`. Reutilize funções adequadas e proponha na PR a inclusão de funções gerais ausentes, conforme o guia de contribuição.
- Leia e grave textos em UTF-8; preserve acentos, símbolos e traduções. Confira o conteúdo gravado ao usar ferramentas ou shells com codificação diferente.

## Implementação e experiência

- Mantenha execução normal no navegador, hospedagem estática e caminhos relativos.
  Node/Python são ferramentas de desenvolvimento, nunca requisitos de execução.
- Reutilize algoritmos e componentes antes de criar outros. Não duplique o SISO.
  Extrações devem ser graduais, justificadas e acompanhadas de regressão.
- Preserve identidade azul, tokens de tema, componentes, simplicidade, teclado,
  foco visível, toque e contraste. A complexidade da UI deve acompanhar a tarefa.
- Separe matemática e traduções da interface. Novos aplicativos devem prever
  pt-BR, en e es desde o início, usando [docs/I18N.md](docs/I18N.md). Declare
  somente os idiomas realmente disponíveis e revisados. Preserve legados monolíngues.
- Mantenha identificadores, variáveis, unidades e LaTeX independentes do idioma.
  Use Intl para apresentação; não interprete números por remoção de separadores.
- Documente equações, deduções, hipóteses, unidades, coordenadas, sinais, método,
  condições iniciais, limitações, normalizações e singularidades pertinentes.
  Use LaTeX com recursos locais sem sobrecarregar a interface principal.
- Evite frameworks, compiladores e dependências desnecessárias. Avalie licença,
  tamanho, manutenção e confiabilidade de bibliotecas antes de incorporá-las.
- Preserve PWA, módulos offline e cache sob demanda. Atualize VERSION ao mudar
  recursos publicados. Não precacheie todos os aplicativos.
- Nunca use eval ou Function para executar código matemático do usuário.
  O interpretador MATLAB/Octave é planejamento, não licença para executar JavaScript.
- Não envie arquivos pessoais automaticamente ao GitHub. Acesso a pastas é opcional;
  formatos de projeto e armazenamento devem seguir as decisões da arquitetura.

## Ciência, preservação e entrega

- Não invente resultados, evidências, referências, autoria ou validação.
  [docs/VALIDATION.md](docs/VALIDATION.md) define os critérios.
- Não altere equações, parâmetros, hipóteses ou métodos existentes silenciosamente.
  Justifique mudanças e compare o comportamento antes/depois.
- Preserve originais, autoria, licenças e hashes de proveniência. Nunca regenere
  hashes para encobrir modificações; mantenha uma referência SISO para regressão.
- Crie testes relevantes: casos analíticos, resíduos, convergência, estabilidade,
  limites, entradas inválidas e condicionamento conforme o modelo.
- Atualize catálogo e documentação ao mudar contratos. Mantenha os documentos de
  referência ligados por links, sem copiar regras que possam divergir.
- Execute npm test (Windows: npm.cmd test) e verificações dos fluxos afetados.
  Informe versões, tolerâncias, limitações e testes não executados.
- Push, publicação e alterações destrutivas exigem autorização do usuário.
  Quando a entrega for PR, não faça merge automaticamente.
