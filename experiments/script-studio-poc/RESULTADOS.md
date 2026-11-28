# EEVL Script Studio · fase 0 · resultados

Página: `experiments/script-studio-poc/index.html` (abrir por HTTP: `npm start`, depois
`http://localhost:8000/experiments/script-studio-poc/`, ou pelo GitHub Pages). O botão
"Copiar resultados (JSON)" copia navegador, resultados e violações de CSP para colar aqui.

Estado: a página foi escrita e verificada em Node; o autor a executou no Edge 158 (resultados
abaixo, primeira versão da página). Firefox e Safari ainda não foram testados e ficam em branco.

Revisão após o Edge: o teste 3 (Worker criado por URL direta) falhou, e o 3b (Worker criado por
Blob bootstrap) passou. A página agora cria **todos os Workers por Blob bootstrap**
(`import "<URL absoluta de runtime-worker.js>";`, `new Worker(blobURL, {type:'module'})`), e o
teste 3 virou diagnóstico da criação por URL direta. Foi acrescentado o teste 3c, que valida a
arquitetura recomendada. **As colunas do Edge abaixo são da versão anterior da página: o autor
precisa rodar de novo (principalmente 3c e, com Blob bootstrap, os testes 1, 2 e 4 a 8).**

## O que cada teste verifica

| # | Teste | PASS quando |
| --- | --- | --- |
| 1 | Worker de módulo + core | `rt.linspace(0, 1, 5)`, chamado pelo código gerado, devolve `[0, 0.25, 0.5, 0.75, 1]` (importado de `assets/js/core/numeric.js` pelo Worker) |
| 2 | Blob URL sob a CSP | o `import()` do módulo gerado funciona e nenhum evento `securitypolicyviolation` ocorre (página ou Worker) |
| 3 | `eval` bloqueado | `eval('1')`, dentro do código gerado no Worker, lança erro |
| 4 | Capacidades neutralizadas | `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts`, `indexedDB`, `caches`, `postMessage` e `self.postMessage` lançam erro quando chamados pelo código gerado |
| 5 | Modo de depuração | as linhas chegam na ordem 1, 3, 4, 4, 4, 4, 4, 7; em Pause nada avança por 500 ms; Step avança exatamente uma linha; Continue termina com retorno 15 e saída `x = 15` |
| 6 | Stop | `while (true) {}` no modo rápido não responde, `terminate()` o encerra e um Worker novo executa em seguida |
| 7 | Back-edges | laço com `if (++rt.tick > 65535) rt.check(3)` e prazo de 300 ms devolve `LimitError` com a linha 3, sem `terminate()`; o mesmo Worker segue respondendo e executando |
| 8 | Medição | 3 execuções de cada: laço de 10^7 iterações no modo rápido e a versão com `yield` por iteração (consumida pelo condutor sem enviar linhas); o resultado numérico é conferido; PASS só indica que as execuções foram corretas |
| 3 | Diagnóstico: `eval` com Worker por URL direta | mesmo critério do teste 3 original; FAIL indica que a CSP da página não alcança Workers criados por URL |
| 3b | Diagnóstico: `eval` com Worker por Blob bootstrap | `eval('1')` lança erro no Worker criado pelo Blob que só importa o runtime por URL absoluta |
| 3c | Runtime via Blob bootstrap | no Worker criado assim: (a) o core é importado e `rt.linspace` funciona; (b) `eval('1')` lança erro; (c) o código gerado carrega por Blob URL; (d) o Worker envia `ready` e responde `ping` à página, e `postMessage` chamado pelo código gerado é bloqueado |

Ponto a observar no teste 3: a CSP em `<meta>` vale para o documento. Um Worker criado a partir de
URL de rede tem a política da própria resposta do script (no GitHub Pages, sem `script-src`), então é
possível que `eval` seja permitido nele. Se o 3 der FAIL e o 3b der PASS, a proteção contra `eval`
no Worker exigiria criar o Worker por Blob. O resultado real está nas tabelas, não nesta previsão.

## Verificado em Node (não é navegador)

`node experiments/script-studio-poc/check-node.mjs`, Node v22.23.5, sem Worker, sem CSP, módulos
gerados carregados por `data:` URL em vez de Blob URL. Passaram:

- código gerado usa `rt.linspace` do core (teste 1, só a lógica);
- verificação nos back-edges lança `LimitError` com a linha 3 após o prazo (teste 7, só a lógica);
- condutor: ordem de linhas 1, 3, 4x5, 7, retorno 15 e saída `x = 15`; Pause sem avanço, Step de exatamente uma linha, Continue; Step além do fim; envio em lotes (50000 yields em 250 mensagens, `seq` crescente); erro com a linha do último `yield`; prazo do condutor;
- medição em Node, laço de 10^7 iterações: modo rápido 10 ms; com `yield` por iteração 205 ms. Valores de Node, não de navegadores.

Não verificado em Node: Worker de módulo, Blob URL, CSP, `eval` bloqueado, neutralização de
capacidades, `terminate()`.

## Resultados no navegador (a preencher pelo autor)

Data, versão do navegador e sistema por coluna; marque PASS/FAIL e cole o detalhe relevante.

| # | Chrome | Firefox | Safari |
| --- | --- | --- | --- |
| Versão / sistema | | | |
| Origem (localhost / GitHub Pages) | | | |
| 1 Worker + core | | | |
| 2 Blob URL + CSP | | | |
| 3 Diag.: eval, Worker por URL | | | |
| 4 Capacidades | | | |
| 5 Depuração | | | |
| 6 Stop | | | |
| 7 Back-edges | | | |
| 8 Medição, modo rápido (ms, mín. de 3) | | | |
| 8 Medição, com yield (ms, mín. de 3) | | | |
| 3b Diag.: eval, Worker via Blob | | | |
| 3c Runtime via Blob bootstrap | | | |
| Depuração manual (Pause/Step/Continue) | | | |

## Edge 158 (Windows), primeira versão da página (Workers por URL direta)

Navegador: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36 Edg/158.0.0.0`. Resultado copiado pela página pelo autor.

| # | Resultado | Detalhe |
| --- | --- | --- |
| 1 Worker + core | PASS | |
| 2 Blob URL + CSP | PASS | nenhum evento de violação (`cspEvents` vazio) |
| 3 eval bloqueado (Worker por URL) | FAIL | `eval` foi permitido no Worker (valor 1): a CSP da página não alcançou este Worker |
| 3b Worker por Blob (apenas `eval`) | PASS | `EvalError` por violar `script-src 'self' blob:` |
| 4 Capacidades | PASS | |
| 5 Depuração | PASS | |
| 6 Stop | PASS | |
| 7 Back-edges | PASS | |
| 8 Medição (3 execuções, 10^7 iterações) | PASS | modo rápido 11 / 11 / 10 ms (mín. 10 ms); com `yield` por iteração 159 / 154 / 149 ms (mín. 149 ms) |
| 3c | não existia nesta versão | rodar de novo |

Conclusão registrada sem extrapolar: no Edge 158, a CSP em `<meta>` não alcança Worker criado por
URL, e alcança Worker criado por Blob bootstrap (3b). Firefox e Safari: sem dados.

## Mensagens de CSP observadas

| Navegador | Local (página / Worker) | Diretiva | Recurso bloqueado / amostra |
| --- | --- | --- | --- |
| | | | |

## Observações

- 

## Edge 158 (Windows) — arquitetura recomendada (Blob bootstrap), 28/11/2026

Executado pelo autor numa janela InPrivate (sem extensões e sem cache), com `npm start` em `localhost:8000`.
User agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36 Edg/158.0.0.0`.

| Teste | Resultado | Observação |
|---|---|---|
| 1 | PASS | `rt.linspace(0,1,5) = [0,0.25,0.5,0.75,1]` |
| 2 | PASS | `import()` do Blob executou; 0 violações de CSP |
| 3 (diagnóstico, Worker por URL direta) | FAIL esperado | `eval` permitido: a CSP da página não alcança Worker carregado por URL |
| 3b (diagnóstico, Worker por Blob) | PASS | `EvalError` por `script-src 'self' blob:` |
| 3c (runtime via Blob bootstrap) | PASS | core, código gerado por Blob, comunicação e `ping` funcionam; `eval` e `postMessage` do código gerado bloqueados |
| 4 | PASS | 8 capacidades bloqueadas |
| 5 | PASS | linhas `[1,3,4,4,4,4,4,7]`; Pause, Step e Continue corretos; retorno 15 |
| 6 | PASS | `terminate()` encerra Worker preso; novo Worker executa |
| 7 | PASS | `LimitError` na linha 3 após 311 ms (prazo 300 ms), sem `terminate()` |
| 8 | PASS | modo rápido 10/10/10 ms; com `yield` por iteração 145/146/146 ms |

Eventos de CSP: apenas o `eval` provocado pelo teste no Worker (`script-src`). Numa execução anterior em janela normal, uma extensão do navegador tentou carregar fontes do Adobe Typekit e foi bloqueada por `font-src`; não vem da página.

**Conclusão para o Edge:** a arquitetura recomendada funciona. O Worker de runtime deve ser criado a partir de um Blob que importa `runtime-worker.js` por URL absoluta; assim ele herda a CSP da página. Chrome, Firefox e Safari ainda não foram testados.

## Firefox 161 (Windows) — arquitetura recomendada (Blob bootstrap), 28/11/2026

Executado pelo autor com `npm start` em `localhost:8000`.
User agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:161.0) Gecko/20100101 Firefox/161.0`.

| Teste | Resultado | Observação |
|---|---|---|
| 1 | PASS | `rt.linspace(0,1,5) = [0,0.25,0.5,0.75,1]` |
| 2 | PASS | `import()` do Blob executou; 0 violações de CSP |
| 3 (diagnóstico, Worker por URL direta) | FAIL esperado | `eval` permitido, como no Edge |
| 3b (diagnóstico, Worker por Blob) | PASS | `EvalError: call to eval() blocked by CSP` |
| 3c (runtime via Blob bootstrap) | PASS | core, código gerado por Blob, comunicação e `ping` funcionam; `eval` e `postMessage` do código gerado bloqueados |
| 4 | PASS | 8 capacidades bloqueadas |
| 5 | PASS | linhas `[1,3,4,4,4,4,4,7]`; Pause, Step e Continue corretos; retorno 15 |
| 6 | PASS | `terminate()` encerra Worker preso; novo Worker executa |
| 7 | PASS | `LimitError` na linha 3 após 308 ms (prazo 300 ms), sem `terminate()` |
| 8 | PASS | modo rápido 11/12/12 ms; com `yield` por iteração 235/231/229 ms |

Eventos de CSP: apenas o `eval` provocado pelo teste no Worker.

Uma segunda execução no Edge 158 deu os mesmos resultados (8: modo rápido 12/12/12 ms; com `yield` 194/199/189 ms), o que dá ideia da variação entre execuções.

## Resumo

| Navegador | Arquitetura recomendada | Modo rápido (10⁷ iter.) | Com `yield` por iteração |
|---|---|---|---|
| Edge 158 | todos os testes PASS | 10 a 12 ms | 145 a 199 ms |
| Firefox 161 | todos os testes PASS | 11 a 12 ms | 229 a 235 ms |
| Chrome | não testado (mesmo motor do Edge) | | |
| Safari | não testado | | |

Os números de tempo dependem da máquina; servem só para comparar os modos no mesmo navegador.
