# Template RC

Exemplo funcional bilíngue para novos simuladores, fora do catálogo principal.
Sirva a raiz do repositório e abra `templates/simulator/index.html`.

- `model.js`: equações puras, validação de parâmetros, RK4 e solução analítica.
- `ui.js`: entradas, conversões de unidade, SVG, tabela, CSV, PNG/SVG e URL.
- `index.html`: estrutura acessível, documentação e mecanismo compartilhado de idioma/tema.

Ao copiar para `simulators/<categoria>/<id>/`, substitua `../../assets/` por
`../../../assets/` nos imports e links e ajuste o link da documentação. Atualize
as chaves de tradução EN/PT-BR, equações, limites, referências e testes. Não
reutilize os níveis de validação do RC para outro modelo.

Contribuições monolíticas também são aceitas: registre o arquivo HTML real,
idiomas e limitações no catálogo sem alterar equações para impor o template.

English: copy the template, update relative paths, replace the model, document
both languages and add model-specific tests. The RC evidence cannot be inherited
by another physical model. See CONTRIBUTING.md for the complete metadata contract.
