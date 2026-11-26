# Consolidação documental e espanhol · 26/11/2026

## Escopo e preservação

Base inspecionada: `78f7f9b`. Branch `docs/architecture-spanish`, checkout separado
para preservar alterações presentes na pasta de trabalho original. A entrega é por
pull request; não inclui merge, integração de aplicativos ou novos modelos numéricos.

Reutilizados: i18n/common, entrypoints do portal, JSON de catálogo/categorias, cache
PWA e verificadores Node existentes. Nenhuma biblioteca nova. Originais, autoria,
licenças, algoritmos de aplicativos e `docs/provenance.json` não foram alterados.

## Mudanças

- AGENTS, ARCHITECTURE, ROADMAP, API, LANGUAGE, I18N e VALIDATION passam a distinguir
  regras operacionais, contratos atuais, evidência e planejamento.
- Inventário SISO confirmado por inspeção e estratégia de extração gradual,
  sem copiar algoritmos nem afirmar validação completa.
- SPECIFICATION e IMPLEMENTATION-REPORT marcados como históricos; README e
  CONTRIBUTING ligados às referências atuais. Corrigidas contagens desatualizadas
  da integração, sem alterar os registros de preservação.
- Espanhol no seletor compartilhado, nas descrições do catálogo, categorias e
  textos gerais. Preferência válida vence; navegador pt/es/outros detectado; fallback
  por chave para inglês; lang e formatação atualizados sem traduzir valores numéricos.
- Idiomas efetivos de cada aplicativo preservados. Aviso agora lista os idiomas
  reais. Espanhol parcial de textos específicos de aplicativos não é anunciado
  como tradução completa; cobertura descrita em I18N.md.
- Validadores aceitam os três idiomas e verificam chaves/placeholders e links Markdown.
  es.json está no shell; cache e módulos de labs continuam sob demanda. Cache 1.1.0.

## Planejamento mantido sem implementação

Biblioteca genérica, interpretador MATLAB/Octave, controle programável multirrate,
gerenciador de projetos, identificação, otimização, editor de blocos, modelagem
simbólica/multifísica e 3D integrado. Nomes e exemplos desses recursos não são APIs
executáveis. Não foram criados arquivos core vazios ou placeholders.

## Verificações

- `npm.cmd test`, Node 26.13.1: **61 testes passaram**, zero falhas. Inclui os
  51 testes da base e 10 novos testes de idioma/cache. CI usa Node 22.
- Integridade: sintaxe JS, JSON, catálogo, categorias, caminhos, placeholders,
  chaves e links HTML/Markdown. Os três dicionários têm 257 chaves cada.
- Módulo real de i18n em DOM/storage/fetch controlados: detecção, prioridade,
  persistência, storage bloqueado, idioma inválido, dicionário indisponível,
  fallback, concorrência de requisições, seletor, nomes acessíveis, lang e números.
- Service Worker em ambiente isolado: espanhol e módulos offline, subdiretório,
  cache seletivo, atualização/migração e fallback trilingue de recurso não visitado.
- Servidor HTTP sob `/EEVL-architecture-es/`: 14 recursos de página, scripts,
  metadados, traduções, manifesto e worker retornaram 200; JSON decodificado.
- Preservação por hashes e todos os testes científicos existentes continuam passando.

## Limitações e testes não executados

O host de acesso ao navegador estava indisponível. Não foi possível fazer nova
verificação visual de responsividade, toque, teclado ou leitor de tela em navegador
real nesta entrega. Os testes de nomes acessíveis/DOM e cache são automatizados e
não substituem essa conferência. O CSS responsivo foi preservado; o seletor ganhou
opções via mecanismo comum. Não foi feita matriz de navegadores, dispositivos
físicos ou instalação PWA real. Há textos específicos de apps ainda em inglês
quando o portal usa es; metadados de idioma não foram promovidos.

Esta tarefa não faz validação numérica independente ou experimental dos modelos.
Os relatórios analíticos já existentes conservam seu próprio escopo e limitações.
