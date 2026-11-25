# Contribuir / Contributing

## Português

1. Faça um fork e crie uma branch. Sirva a raiz com `python -m http.server 8000`.
2. Copie `templates/simulator/` para `simulators/<categoria>/<id>/`. Ajuste os
   caminhos relativos à nova profundidade. O exemplo RC é código executável de
   referência; remova suas equações e metadados quando mudar de modelo.
3. Separe o algoritmo puro (`model.js`) da interface (`ui.js`). Use unidades SI
   internamente e conversões explícitas na fronteira. Valide entradas, limites,
   passo numérico e custo computacional. Use Web Worker se houver trabalho intenso;
   não execute grandes integrações síncronas em eventos de entrada.
4. Documente equações, hipóteses, unidades, padrões, condições iniciais, método,
   estabilidade, limitações e referências bibliográficas em EN e PT-BR. Identifique
   autores, colaboradores, licença e versão. Cite edição/páginas ou DOI quando aplicável.
5. Use `assets/js/i18n.js`: `setLanguage`, `t`, `localized`, `translate` e evento
   `languagechange`. `common.js.initialize()` configura idioma, tema, repositório
   e Service Worker. Traduções compartilhadas em `locales/en.json` e `pt-BR.json`,
   com as mesmas chaves e placeholders. Não insira entradas do usuário em innerHTML.
   Bibliotecas de traduções próprias são permitidas em aplicativos autocontidos.
6. Inclua diagrama SVG, parâmetros com unidades e limites, restaurar/executar,
   gráfico com eixos e legenda, métricas, tabela ou outra alternativa acessível,
   exportação CSV e imagem. Use URL para compartilhar configurações quando viável.
7. Crie testes em `tests/*.test.mjs` com `node:test`. Compare soluções analíticas,
   condições iniciais, equilíbrio, transitório, energia, convergência, limites,
   estabilidade, entradas inválidas e consistência dimensional conforme o modelo.
8. Registre em `data/simulators.json`:

```json
{
  "id": "unique-id",
  "title": {"en": "Title", "pt-BR": "Título"},
  "description": {"en": "Description", "pt-BR": "Descrição"},
  "category": "electrical-circuits",
  "keywords": {"en": ["circuit"], "pt-BR": ["circuito"]},
  "path": "simulators/electrical-circuits/unique-id/index.html",
  "thumbnail": "assets/images/unique-id.svg",
  "authors": ["Nome"], "contributors": [], "version": "1.0.0",
  "created": "2026-11-25", "updated": "2026-11-25",
  "difficulty": "beginner", "languages": ["en", "pt-BR"],
  "status": "available", "validation": ["experimental"],
  "validationEvidence": [], "references": []
}
```

Níveis: `beginner`, `intermediate`, `advanced`. Estados: `available` e `planned`.
Planejados devem ter `path: null`, versão null e validação vazia; não anuncie
funcionalidade inexistente. Idiomas devem refletir o aplicativo, não apenas sua
página de abertura. Se integrar um legado monolíngue, informe isso explicitamente.
Novas categorias exigem somente registro em `data/categories.json` com id, icon e
name EN/PT-BR. Inclua arquivo real no caminho registrado. Não use URLs absolutas
para assets ou dependências de execução.

## Evidências científicas

`experimental` indica ausência de verificação suficiente. Para outros níveis,
inclua um relatório versionado e `validationEvidence` com `level` e `path` relativo:

```json
[{"level":"analytically-verified","path":"docs/validation/unique-id.md"}]
```

Níveis aceitos: `analytically-verified`, `numerically-validated`,
`experimentally-validated`. Vários são permitidos. O relatório deve identificar
versão, caso de teste, equações/ferramenta/medição, parâmetros, unidades, condições
iniciais, tolerâncias e resultados reproduzíveis. Testar integridade ou aparência
não é validação científica. Não classifique por intenção ou reputação do autor.

## Antes do pull request

- Execute `npm test` (`npm.cmd test` no PowerShell restrito).
- Verifique EN/PT-BR, teclado, mobile, temas, exportações e URL.
- Teste caminhos em subdiretório e offline após visita online.
- Incremente `VERSION` do Service Worker se recursos publicados mudaram.
- Atualize catálogo e documentação; preserve autoria e licenças.
- Descreva no PR problema, comportamento, equações afetadas, hipóteses, testes e
  evidências. Toda mudança de modelo existente exige justificativa e revisão.

Não introduza backend, autenticação, telemetria, serviços pagos ou dependências
desnecessárias. Não edite os originais herdados para padronizar aparência.

## English

Fork, create a branch, and serve the root over HTTP. Copy the working RC template
into a category directory and adjust relative imports. Separate the numerical model
from UI. Document equations, units, defaults, initial conditions, method, limitations,
references, authors and license in both languages. Add analytical and convergence
tests, bounds checks and model-appropriate energy/stability tests.

Register metadata using the example above; categories are data-driven. Available
entries must point to real files. Planned entries have null paths and no claimed
validation. Existing single-language HTML applications are allowed when their actual
languages are clearly listed and their numerical code is preserved.

Use the shared i18n helper and matching translation keys. Provide accessible plots,
units, legends, metrics, exports and configuration URLs when feasible. Use Workers
for heavy computations. Never assign validation without versioned evidence; include
`level` and `path` in `validationEvidence`. Run `npm test`, check both languages,
responsive layouts, themes and offline behavior. Submit a PR describing the final
behavior, model changes and evidence. Keep GitHub Pages compatibility, preserve
attribution and avoid unnecessary runtime dependencies.
