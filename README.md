# Electrical Engineering Virtual Lab · EEVL

**Explore. Simulate. Understand. / Explore. Simule. Compreenda.**

Portal educacional gratuito em HTML5, CSS3 e JavaScript nativo. Sem backend,
autenticação, banco de dados, chaves de API ou build de produção. Cálculos no navegador.

## Executar localmente

Na raiz do projeto, com Python 3 instalado:

```sh
python -m http.server 8000
```

Abra **http://localhost:8000**. Não abra `index.html` por `file://`: módulos,
fetch e Service Worker exigem HTTP/HTTPS. No Windows use `npm.cmd start` como
alternativa, quando a política do PowerShell impedir `npm.ps1`.

## Verificar

Node.js 22 ou superior; nenhuma instalação de pacotes necessária:

```sh
npm test
# Windows PowerShell:
npm.cmd test
```

Verifica sintaxe JS (inclusive scripts inline herdados), JSON, metadados,
identificadores, caminhos, links internos, paridade das traduções, ícones,
preservação dos originais e modelo RC. Consulte [validação](docs/VALIDATION.md).

## Conteúdo disponível

| Simulador | Idioma do aplicativo | Validação |
|---|---|---|
| Projeto de Controladores SISO | PT-BR | Experimental |
| Buck: regime permanente, CCM/DCM e partida | PT-BR | Experimental |
| DAB: interface dinâmica com bateria | PT-BR | Experimental |
| Amplificadores operacionais | PT-BR | Experimental |
| Buck com PID digital | PT-BR | Experimental |

As páginas de apresentação, catálogo e navegação são EN/PT-BR. Os aplicativos
legados mantêm sua interface original em português. Um laboratório dedicado ao
**degrau de razão cíclica** permanece planejado: o transitório de partida do Buck
e o Buck com PID não foram apresentados como esse simulador ausente.

O [template RC](templates/simulator/index.html) é um exemplo funcional para
colaboradores, fora do catálogo. Tem algoritmo separado, gráfico SVG, tabela
acessível, parâmetros na URL, métricas e exportação CSV/SVG/PNG. Seus testes
analíticos não validam os modelos herdados.

## Estrutura

```text
index.html / about.html / contribute.html
assets/branding/       SVGs de marca e favicon
assets/icons/          ícones PNG 192 e 512
assets/images/         ilustrações SVG conceituais
assets/css/            tema e responsividade
assets/js/             catálogo, i18n, PWA, páginas e apresentação de laboratórios
assets/vendor/         Plotly 2.35.2 e licença MIT
data/                  config.json, categories.json, simulators.json
locales/               en.json, pt-BR.json
simulators/            cópias integradas e apresentações bilíngues
templates/simulator/   exemplo RC: index.html, model.js, ui.js
tests/                 comparação analítica RC e preservação dos originais
scripts/               verificações e geração reproduzível de assets/integrações
docs/                  especificação, validação, integração e hashes de origem
.github/workflows/     verificações de push e pull request
Control Systems/       arquivos fornecidos preservados
Power Electronics/     arquivos fornecidos preservados
Fundamental Eletronics and Electrical Circuits/  arquivos fornecidos preservados
logoEEVL.svg           logotipo original preservado
```

## Publicar no GitHub Pages

Repositório: https://github.com/lucasbellinaso/electrical-engineering-virtual-lab.
Esta implementação **não faz push nem publica automaticamente**.

1. Revise os arquivos e envie um commit para a branch `main` quando desejar.
2. Em **Settings → Pages**, selecione **Deploy from a branch**.
3. Escolha **main** e **/ (root)**, depois **Save**.
4. O endereço esperado é
   https://lucasbellinaso.github.io/electrical-engineering-virtual-lab/.

Não é necessário workflow de deploy. `.nojekyll`, caminhos relativos, manifesto
com escopo `./` e Service Worker relativo permitem a hospedagem em subdiretório.
O workflow fornecido somente verifica o projeto; não publica.

## Adicionar um simulador

Copie `templates/simulator/` para `simulators/<categoria>/<id>/`, ajuste os imports
relativos (de `../../assets/` para `../../../assets/` nessa profundidade), substitua
o modelo, documente e teste. Adicione um registro em `data/simulators.json` e, se
necessário, uma categoria em `data/categories.json`. A página inicial não precisa
de alterações. Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para contrato completo.

## PWA e preferências

Idioma inicial pelo navegador (português → PT-BR; demais → EN), persistido em
localStorage. Tema claro, escuro ou sistema, também persistido. O link GitHub é
controlado por `data/config.json`; use `null` para ocultar.

O Service Worker armazena somente o portal essencial na instalação. Recursos de
simuladores e Plotly são armazenados quando solicitados por uma visita, com o
Service Worker já ativo. Na primeira visita, aguarde a instalação e recarregue.
Abra o laboratório online antes de testar offline. O cache não garante retenção
permanente: o navegador pode remover dados por quota ou política de armazenamento.
A instalação é oferecida pela interface nativa de navegadores compatíveis.

Para atualizar, incremente `VERSION` em `service-worker.js` junto com a mudança.
O portal mostra uma mensagem quando a nova versão aguarda ativação; o botão
Atualizar ativa o worker e recarrega. Caches de laboratórios visitados migram
entre versões e são atualizados pela rede nas próximas visitas. Remova caches
deliberadamente quando uma mudança incompatível de modelo exigir nova simulação.

## Dependências e licenças

O portal novo não depende de CDN. Plotly 2.35.2 foi incluído localmente para
preservar o SISO, com licença MIT em `assets/vendor/plotly-LICENSE`. As duas
referências a fontes Google foram removidas **somente na cópia** de Buck com PID;
o fallback CSS original se aplica. Veja [INTEGRATION.md](docs/INTEGRATION.md).

Pillow só é necessário para regenerar ícones (`python scripts/generate-assets.py`),
não para executar ou verificar o portal. Integrações são reproduzíveis com
`python scripts/integrate-simulators.py`. Não execute esse script para aprovar
mudanças desconhecidas nos originais: revise primeiro os modelos e o diff.

MIT para o código original do portal; [LICENSE](LICENSE) preservada do repositório.
Atribuições fornecidas foram mantidas. A ausência de autoria/licença explícita em
um arquivo herdado deve ser esclarecida antes de redistribuir contribuições externas.

## English quick start

Serve the repository with `python -m http.server 8000`, then open localhost:8000.
Run `npm test` with Node 22+. No dependency installation or production build is
required. Enable GitHub Pages from **main / root** after reviewing and pushing.
The portal is bilingual; imported simulators are Portuguese-only, clearly labeled,
and retain their numerical scripts. Add labs through JSON metadata and static files.
See the bilingual integration and validation documents for scientific limitations.
