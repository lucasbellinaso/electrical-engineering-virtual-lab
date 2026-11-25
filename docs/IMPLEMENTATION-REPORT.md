# Entrega e verificação · 25/11/2026

## Implementado

- Portal estático responsivo, identidade SVG derivada do símbolo fornecido e
  ícones PNG 192/512, sem dependências externas para a interface nova.
- Catálogo orientado a JSON, 12 categorias, busca por palavras-chave dos dois
  idiomas, filtros combináveis de área/dificuldade/estado e ordenação.
- Cinco simuladores fornecidos integrados, originais preservados e código numérico
  inline inalterado. Apenas localização de Plotly e remoção de fontes externas nas
  cópias correspondentes; relatório detalhado em `INTEGRATION.md`.
- EN/PT-BR no portal e apresentações, tema claro/escuro/automático persistido.
- Template RC executável: RK4 separado da UI, solução exata, gráfico SVG com
  inspeção por ponteiro/slider/teclado, tabela, métricas, reset, URL e CSV/SVG/PNG.
- PWA com cache essencial, armazenamento de laboratórios visitados, escopo relativo,
  migração de cache, aviso de atualização e ativação pelo usuário.
- Documentação, MIT preservada, orientações a agentes e GitHub Actions de verificação.
- Repositório Git local ligado ao origin informado, branch main acompanhando
  origin/main. Nenhum commit, push ou publicação realizado.

## Verificações automatizadas

Comando: `npm.cmd test` no PowerShell; equivalente a `npm test` no CI.

**10 testes passaram; 0 falhas.** Verificador: **22 scripts JS**, **8 JSONs**,
**93 links locais**, **6 registros** de catálogo e **156 chaves** em cada idioma.

Cobertura: sintaxe inclusive scripts inline herdados, estrutura e metadados,
unicidade, caminhos e referências de catálogo, paridade de traduções/placeholders,
ícones PNG e preservação por SHA-256. Modelo RC: condição inicial, transitório,
regime em 5τ, fonte negativa, equilíbrio, escala dimensional, convergência RK4,
balanço de energia, monotonicidade e entradas inválidas/limites.

Testes do Service Worker em ambiente isolado: escopo em subdiretório, ausência
de simuladores no precache, cache seletivo, queries offline, recurso não visitado,
migração entre versões e preservação de caches de outros projetos. Esses testes
não substituem todos os testes de ciclo de vida em navegadores reais.

## Verificação em navegador real

Microsoft Edge local, servidor HTTP sob `/EEVL/` para exercitar um subdiretório:

- Carregamento do portal, detecção PT-BR e opção nativa de instalar a PWA observada.
- Busca `bateria`: 1 resultado; busca sem correspondência: estado vazio; limpar:
  6 registros. Filtro planejado: 1; planejado + avançado: 0; reset: 6.
- Troca EN/PT-BR e temas escuro/automático; preferências mantidas entre páginas.
- Todos os cinco aplicativos abertos, com controles e resultados renderizados;
  gráficos Bode/lugar das raízes/resposta temporal observados no SISO.
- Template RC: 5 V → resultado final ~4,966 V; entrada alterada para 10 V →
  ~9,933 V; URL com 12 V → ~11,92 V. Inspeção da amostra final mostrou
  t=500 ms e v≈11,9191 V. São observações do teste, não dados experimentais.
- Downloads CSV, SVG e PNG concluídos pelo navegador.
- Emulação de 390 pixels: corrigido overflow de grid; catálogo, busca, filtros e
  cartões conferidos em uma coluna, categorias com rolagem horizontal própria.
- Aviso de nova versão exibido; botão Atualizar ativou a versão e recarregou.
- Rede do DevTools em Offline: página de abertura e aplicativo SISO previamente
  visitados abriram pelo cache. Rede restaurada após o teste.

## Limitações explícitas

- Aplicativos herdados continuam somente em português e com tema próprio.
- Todos os cinco são experimentais. Não foi realizada validação independente
  de seus algoritmos nem comparação com hardware, SPICE ou outro simulador.
- Arquivo dedicado ao degrau de razão cíclica do Buck ausente; permanece planejado,
  sem botão executável. O Buck fornecido oferece regime permanente e partida.
- Modelos herdados preservam o custo computacional e funções de exportação que
  já possuem. Não foram convertidos silenciosamente a Workers.
- Offline exige visita com Service Worker ativo e depende da quota do navegador.
- Não foi feita uma matriz de testes de Safari, Firefox, iOS ou Android físicos.
- GitHub Actions e a publicação remota não foram executados; arquivos locais
  estão preparados para revisão e posterior envio autorizado.

## Próximos usos

Executar e ativar GitHub Pages: `README.md`. Adicionar simuladores e traduções:
`CONTRIBUTING.md`. Requisitos e decisões: `SPECIFICATION.md`. Evidência analítica
do template e critérios de teste: `VALIDATION.md`.
