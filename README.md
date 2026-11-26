# Electrical Engineering Virtual Lab (EEVL)

O EEVL é um portal aberto de aplicativos educacionais para Engenharia Elétrica, voltado à aprendizagem, experimentação e projeto de controle de baixa e média complexidade. Seus três pilares são **simplicidade de uso**, **transparência matemática** e **modularidade**.

Os aplicativos rodam localmente no navegador, sem backend ou instalação obrigatória. O projeto é estático e compatível com GitHub Pages em subdiretórios; a instalação como PWA é opcional. Não é um substituto completo para MATLAB, Simulink ou outros ambientes científicos.

> **EN:** An open, browser-based collection of electrical engineering learning apps, built around usability, mathematical transparency, and modularity.
>
> **ES:** Colección abierta de aplicaciones educativas de ingeniería eléctrica para navegador, centrada en la facilidad de uso, la transparencia matemática y la modularidad.

## Executar e verificar

Para desenvolvimento local, na raiz do projeto:

```sh
python -m http.server 8000
```

Acesse http://localhost:8000. É necessário servir por HTTP; abrir o arquivo diretamente (`file://`) não permite o funcionamento de módulos e recursos do navegador.

Com Node.js 22 ou superior, execute os testes sem instalar dependências:

```sh
npm.cmd test
```

Não é necessário `npm install` nem build de produção. A suíte inclui verificações de integridade e testes numéricos; critérios e limites estão em [docs/VALIDATION.md](docs/VALIDATION.md).

## Aplicativos disponíveis

Novo laboratório: **[Campos Magnetostáticos](simulators/electromagnetics/magnetostatics/index.html)**, em Eletromagnetismo, disponível em PT-BR, inglês e espanhol. Inclui fios infinitos, espira e solenoide, mapa B/H, sonda e deduções. Consulte [o modelo](docs/MAGNETOSTATICS.md) e [as evidências de validação](docs/validation/magnetostatics.md).

O catálogo contém onze aplicativos: seis legados declarados em PT-BR e cinco aplicativos com interface em português, inglês e espanhol.

| Aplicativo | Idiomas do app |
|---|---|
| Projeto de Controladores SISO | PT-BR (legado) |
| Conversor Buck — Regime Permanente | PT-BR (legado) |
| Conversor Buck — Degrau de Razão Cíclica | PT-BR (legado) |
| DAB — Interface de Bateria | PT-BR (legado) |
| Amplificadores Operacionais | PT-BR (legado) |
| Conversor Buck — Controle PID | PT-BR (legado) |
| Análise Nodal — Circuitos Resistivos | EN, PT-BR, ES |
| RC e RL — Circuitos de 1ª Ordem | EN, PT-BR, ES |
| RLC — Circuitos de 2ª Ordem | EN, PT-BR, ES |
| Análise Nodal Fasorial — R, L, C | EN, PT-BR, ES |
| Campos Magnetostáticos | EN, PT-BR, ES |

O catálogo atualizado está em [data/simulators.json](data/simulators.json). O template RC é um exemplo de contribuição, não um aplicativo listado no catálogo.

## Estrutura principal

- `index.html`, `about.html`, `contribute.html`: portal e páginas informativas.
- `assets/js/`, `assets/css/`, `assets/vendor/`: módulos compartilhados, estilos e bibliotecas locais.
- `data/`, `locales/`: catálogo/configuração e traduções do portal.
- `simulators/`: aplicativos e modelos.
- `templates/simulator/`: template funcional de referência.
- `tests/`, `scripts/`: testes e verificações automatizadas.
- `docs/`: contratos, idioma, validação e decisões do projeto.

## Documentação normativa

Consulte estes documentos antes de propor mudanças:

- [AGENTS.md](AGENTS.md) — instruções de trabalho.
- [ARCHITECTURE.md](ARCHITECTURE.md) — arquitetura, estado implementado e decisões.
- [ROADMAP.md](ROADMAP.md) — propostas futuras, não funcionalidades disponíveis.
- [docs/API.md](docs/API.md) — APIs atuais dos modelos e módulos.
- [docs/LANGUAGE.md](docs/LANGUAGE.md) — proposta de linguagem futura; não há intérprete implementado.
- [docs/I18N.md](docs/I18N.md) — idiomas, seleção e contratos de tradução.
- [docs/VALIDATION.md](docs/VALIDATION.md) — critérios e evidências científicas.
- [CONTRIBUTING.md](CONTRIBUTING.md) — fluxo de contribuição.

## GitHub Pages, PWA e dependências

O site pode ser hospedado como conteúdo estático no GitHub Pages; o fluxo de contribuição não faz merge automaticamente. O Service Worker mantém o shell e armazena recursos visitados sob demanda. A PWA é opcional e o navegador pode remover dados em cache.

Plotly 2.35.2 e KaTeX são distribuídos localmente; veja as licenças em `assets/vendor/`. O código original do portal está sob licença MIT ([LICENSE](LICENSE)); preserve atribuições e licenças dos materiais fornecidos.

Interpretador MATLAB/Octave, sistema genérico de projetos e motor genérico de simulação são propostas futuras, ainda não implementadas. Consulte [ROADMAP.md](ROADMAP.md) para o escopo planejado.

> **EN:** Run `python -m http.server 8000` for local development and `npm.cmd test` with Node.js 22+. No package installation or production build is required. The eleven catalog apps include six legacy apps declared in Portuguese and five apps in EN/PT-BR/ES, including magnetostatics. See the linked architecture and validation documents before contributing.
>
> **ES:** Para desarrollo local, ejecute `python -m http.server 8000`; las pruebas requieren Node.js 22+ (`npm.cmd test`). No hace falta instalar paquetes ni generar una compilación. El catálogo incluye once aplicaciones: seis heredadas declaradas en portugués y cinco en inglés/portugués/español, incluida magnetostática.
