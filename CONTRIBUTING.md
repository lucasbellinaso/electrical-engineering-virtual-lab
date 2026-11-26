# Contribuir / Contributing

Este guia resume o fluxo de contribuição. As regras completas de arquitetura, idioma, APIs e validação estão em [ARCHITECTURE.md](ARCHITECTURE.md), [docs/I18N.md](docs/I18N.md), [docs/API.md](docs/API.md) e [docs/VALIDATION.md](docs/VALIDATION.md).

Para apresentação matemática e gráficos, seguir as [convenções de interface](docs/UI-CONVENTIONS.md):
LaTeX em equações e variáveis de toda a UI e limites Y estáveis durante atualização contínua.

> **EN:** Keep numerical models reusable and separate from UI, document assumptions, and provide reproducible tests and evidence.
>
> **ES:** Mantenga los modelos numéricos reutilizables y separados de la interfaz; documente hipótesis y aporte pruebas y evidencias reproducibles.

## Criar ou modificar um aplicativo

1. Inspecione os módulos existentes e reutilize-os quando adequado. Comece por uma cópia de `templates/simulator/`; ajuste imports e referências para caminhos relativos compatíveis com GitHub Pages.
2. Mantenha o modelo matemático separado da UI. Documente equações e deduções, unidades, convenções, condições iniciais, hipóteses, método numérico, limites e singularidades pertinentes. Preserve parâmetros e algoritmos existentes; justifique alterações.
3. Preveja **EN, PT-BR e ES** para novos aplicativos. Metadados de `languages` devem listar somente idiomas realmente implementados e revisados no aplicativo, não os idiomas disponíveis nas descrições do catálogo. Preserve aplicativos legados no idioma original e declare seus idiomas reais.
4. Valide entradas e custos; inclua testes apropriados ao modelo: casos analíticos, convergência, limites, equilíbrio, estabilidade, resíduos e entradas inválidas, conforme aplicável. Afirmações de validação científica exigem evidência versionada e reproduzível; ver [docs/VALIDATION.md](docs/VALIDATION.md).
5. Registre o aplicativo em `data/simulators.json` e categorias novas em `data/categories.json`. Inclua os arquivos no caminho indicado. Não altere os originais fornecidos; preserve autoria, licenças e hashes de proveniência.
6. Atualize `VERSION` em `service-worker.js` quando mudar recursos publicados. Evite dependências de execução externas e mantenha caminhos relativos.

## Exemplo de registro no catálogo

Os textos abaixo ilustram o formato completo. Ajuste `languages` à implementação real: neste exemplo, a interface está disponível em EN/PT-BR, sem espanhol.

```json
{
  "id": "unique-id",
  "title": {
    "en": "Circuit response",
    "pt-BR": "Resposta do circuito",
    "es": "Respuesta del circuito"
  },
  "description": {
    "en": "Explore the circuit response.",
    "pt-BR": "Explore a resposta do circuito.",
    "es": "Explore la respuesta del circuito."
  },
  "category": "electrical-circuits",
  "keywords": {
    "en": ["circuit", "response"],
    "pt-BR": ["circuito", "resposta"],
    "es": ["circuito", "respuesta"]
  },
  "path": "simulators/electrical-circuits/unique-id/index.html",
  "thumbnail": "assets/images/unique-id.svg",
  "authors": ["Nome"],
  "contributors": [],
  "version": "1.0.0",
  "created": "2026-11-26",
  "updated": "2026-11-26",
  "difficulty": "beginner",
  "languages": ["en", "pt-BR"],
  "status": "available",
  "validation": ["experimental"],
  "validationEvidence": [],
  "references": []
}
```

Para registros `planned`, use `path: null`, versão nula e validação vazia; não apresente recursos planejados como disponíveis. Títulos, descrições e palavras-chave do catálogo podem ter traduções em espanhol independentemente dos idiomas efetivos do app. Consulte o contrato vigente em [ARCHITECTURE.md](ARCHITECTURE.md) e [docs/I18N.md](docs/I18N.md).

## Testes e pull request

Execute `npm.cmd test` no Windows (ou `npm test`), com Node.js 22 ou superior; não é necessária instalação de pacotes. Verifique os fluxos afetados, idiomas, teclado, responsividade e paths em subdiretório. Relate testes não executados e limites conhecidos.

Abra um pull request descrevendo o comportamento, mudanças no modelo, hipóteses, testes e evidências. O fluxo de revisão **não faz merge automático**. Não faça push, publicação ou alterações destrutivas sem autorização. Não edite arquivos originais fornecidos para padronizar aparência ou código; integrações preservam proveniência conforme `docs/provenance.json`.

> **EN:** Fork or branch the repository, implement and document the model, update catalog metadata, run `npm.cmd test`, and open a pull request with reproducible evidence. Review does not merge automatically.
>
> **ES:** Trabaje en una rama, documente el modelo, actualice los metadatos, ejecute `npm.cmd test` y abra una solicitud de cambios con evidencias reproducibles. La revisión no realiza la integración automáticamente.
