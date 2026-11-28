---
name: script-studio-fase0
description: Fase 0 do EEVL Script Studio — prova de conceito da execução de JavaScript gerado num Web Worker sob CSP, com pausa e retomada por gerador e cancelamento. Use para construir ou ajustar a página de prova de conceito e seu relatório; não implementa parser, runtime ou tradutor.
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
---

Você implementa a **fase 0** do EEVL Script Studio: uma prova de conceito que decide como o código JavaScript gerado pelo futuro tradutor será carregado e executado no navegador. Não implemente parser, runtime de valores nem tradutor; o código "gerado" desta fase é escrito à mão, imitando o que o tradutor produzirá.

## Leia antes de começar

1. `AGENTS.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md` — regras permanentes do repositório. Elas prevalecem sobre este arquivo, exceto no ponto indicado em "Regra de execução de código" abaixo.
2. `docs/SCRIPT-STUDIO.md`, em especial as seções 3 (execução segura), 4 (Worker, cancelamento, watchdog), 5 (os dois modos) e 11 (fase 0 no plano). A terminologia está no início da seção 1.

## Regra de execução de código

A seção 3 de `docs/SCRIPT-STUDIO.md` substitui a regra "nunca use eval ou Function" por: executar somente JavaScript emitido pelo tradutor a partir de AST validada, carregado num Worker por Blob URL, sob CSP sem `unsafe-eval`. **Só prossiga se o `AGENTS.md` já tiver sido atualizado com essa regra pelo autor.** Se ainda contiver a proibição antiga, pare e informe; não edite o `AGENTS.md` por conta própria. Mesmo com a regra nova: não use `eval` nem `new Function` em nenhum arquivo desta fase.

## Onde trabalhar

- Pasta nova `experiments/script-studio-poc/` (crie). Não registre no catálogo de aplicativos, no menu do site nem no manifesto offline; não altere `VERSION`.
- Não altere `assets/js/core/` nem nenhum simulador.
- Caminhos relativos, sem dependências externas, sem etapa de build, textos em UTF-8.

## O que construir

1. **`index.html`** com a CSP em `<meta>` exatamente como na seção 3, item 5: `default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'`. Interface mínima: botões para cada teste, área de log, tabela de resultados PASS/FAIL e o `navigator.userAgent`.
2. **`runtime-worker.js`**: Worker de módulo carregado do próprio site (`new Worker(url, {type: 'module'})`). Ele:
   - importa pelo menos um módulo do core por caminho relativo (por exemplo `linspace` de `assets/js/core/numeric.js`) e o usa a partir do código gerado, via objeto `rt`;
   - antes de carregar código gerado, neutraliza `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts`, `indexedDB` e `caches`, e guarda `postMessage` numa closure privada (seção 3, item 4);
   - recebe o texto do módulo gerado, cria um Blob URL (`type: 'text/javascript'`) e faz `import()` dele.
3. **Exemplos de código "gerado"**, como strings, seguindo os dois formatos da seção 5:
   - modo rápido: `export function main(rt) { ... }`, com um laço escalar de 10⁷ iterações;
   - modo de depuração: `export function* main(env, rt) { ... }` com `yield <linha>` antes de cada instrução, usando o exemplo de laço da seção 5.
4. **Condutor** do modo de depuração no Worker: consome o gerador; a cada `yield` envia a linha atual em lotes (não uma mensagem por instrução); aceita as mensagens `pause`, `step` e `continue` vindas da página e, em pausa, para de consumir até a próxima mensagem.

## Testes que a página deve executar e reportar

| # | Teste | PASS quando |
|---|---|---|
| 1 | Worker de módulo carrega e importa o core | `rt.linspace` funciona dentro do código gerado |
| 2 | Módulo gerado por Blob URL sob a CSP | o `import()` funciona sem violação de CSP no console |
| 3 | CSP bloqueia `eval` | `eval('1')` dentro do Worker lança erro |
| 4 | Capacidades neutralizadas | código gerado que tenta `fetch` recebe erro |
| 5 | Modo de depuração | a linha atual chega à página na ordem certa; Pause, Step e Continue funcionam |
| 6 | Stop | `while (true) {}` no modo rápido é encerrado por `worker.terminate()`; um novo Worker roda em seguida |
| 7 | Verificação nos *back-edges* | laço com `if (++rt.tick > 65535) rt.check(linha)` respeita um prazo e devolve erro com a linha, sem `terminate()` |
| 8 | Medição | tempo do laço de 10⁷ iterações no modo rápido e da versão com `yield` por iteração; reportar os dois, sem conclusões além dos números |

## Verificação e entrega

- Rode `npm test` (Windows: `npm.cmd test`) e confirme que nada quebrou.
- Teste localmente com `npm start` num navegador, se disponível. Você provavelmente não consegue testar Firefox e Safari: deixe a página pronta para o autor abrir em cada navegador, inclusive publicada no GitHub Pages.
- Escreva `experiments/script-studio-poc/RESULTADOS.md`: o que foi testado, onde, versão do navegador, PASS/FAIL por teste, mensagens de CSP observadas, e uma tabela vazia para o autor preencher com Chrome, Firefox e Safari. Não invente resultados de navegadores que não testou.
- Não faça commit, push nem PR sem autorização do autor. Ao terminar, informe arquivos criados, testes executados e o que ficou para o autor verificar.
