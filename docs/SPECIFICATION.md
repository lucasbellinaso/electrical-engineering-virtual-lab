# EEVL — especificação e plano · HISTÓRICO

> Registro histórico da implementação e de extensões anteriores. Descrições,
> contagens de testes, disponibilidade e restrições de publicação refletem a etapa
> narrada. Não são o estado atual nem diretrizes concorrentes. Consulte
> [ARCHITECTURE.md](../ARCHITECTURE.md), [ROADMAP.md](../ROADMAP.md),
> [API.md](API.md) e [VALIDATION.md](VALIDATION.md).

## Escopo
Portal educacional estático em HTML5, CSS3 e JavaScript nativo, sem backend,
autenticação, chaves ou processamento externo. Hospedagem na raiz ou em subdiretório
do GitHub Pages. Repositório: https://github.com/lucasbellinaso/electrical-engineering-virtual-lab.

## Inspeção inicial (25/11/2026)
- Diretório local sem Git: `logoEEVL.svg` e `SisoApp - projeto de controladores.html`.
- Repositório remoto na branch main contém somente LICENSE. Preservar essa licença.
- SISO em português, com dependência Plotly 2.35.2 via CDN. Preservar integralmente
  seus algoritmos, parâmetros e interface original. Integrar uma cópia com Plotly
  local e navegação adicional, documentando essas alterações. Manter os originais.
- Não há arquivos Buck, DAB ou amplificadores operacionais. Registrar como
  planejados, sem caminhos executáveis nem validação alegada.

## Plano de implementação
1. Criar estrutura modular, identidade SVG baseada no símbolo fornecido e ícones PNG.
2. Implementar catálogo responsivo com JSON de simuladores/categorias, busca,
   filtros combináveis, ordenação, estados vazios e seção de novidades.
3. Centralizar traduções EN/PT-BR; detectar idioma e persistir idioma/tema.
4. Integrar SISO preservando modelo e atribuição; armazenar sua dependência local.
5. Criar template bilíngue executável de circuito RC, com algoritmo separado,
   gráfico SVG acessível, exportações, URL, documentação e testes analíticos.
   O template não será anunciado como um dos simuladores pedidos.
6. Implementar PWA com cache versionado, atualização informada e cache dos
   recursos de simuladores somente quando acessados.
7. Documentar contribuição, validação, limitações, execução e GitHub Pages.
8. Verificar sintaxe, JSON, catálogo, traduções, links e métodos numéricos via
   Node sem dependências. Validar navegação e responsividade em navegador local.

## Contratos
- Catálogo: id, títulos/descrições bilíngues, categoria, palavras-chave, path,
  thumbnail, autores, colaboradores, versão, datas, dificuldade, idiomas, status,
  validation (lista), validationEvidence e referências. Planejados: path null.
- Categorias em JSON; adicionar categoria não exige alterar lógica.
- Idioma: pt-BR para navegador português, en nos demais casos; localStorage.
- Temas light/dark/auto; preferência persistida e respeito ao sistema.
- Integrados monolíngues identificados no catálogo e na página de abertura.
- Validação científica somente com evidência. SISO: experimental, sem evidência
  independente disponível. Testes de integração não certificam seu modelo.
- Template RC: RK4, tensão no capacitor, fonte CC ideal; teste comparado à solução
  analítica. Não representa circuitos com comutação nem o simulador Buck ausente.
- Acessibilidade: HTML semântico, foco visível, labels, mensagens de estado,
  navegação por teclado, contraste e respeito a prefers-reduced-motion.
- Todos os recursos de execução locais e relativos. Sem publicação ou push nesta tarefa.

## Critérios de aceite
Filtros e busca refletem metadados; nenhum planejado abre simulador. SISO abre
com dependência local. Template calcula/exporta dados reais. Interface EN/PT-BR,
PWA em subdiretório, documentação e CI utilizáveis sem build de produção.
Relatar explicitamente limites de testes e validação técnica.

## Atualização durante a implementação
O usuário reorganizou o SISO em Control Systems e adicionou Buck, DAB, amp-ops e Buck PID. Os cinco foram integrados com originais preservados. O degrau dedicado de razão cíclica (`buck-step`) foi fornecido depois e integrado sem alterações. Consulte INTEGRATION.md e provenance.json para caminhos, hashes e alterações exatas.
