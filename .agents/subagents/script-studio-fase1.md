---
name: script-studio-fase1
description: Fase 1 do EEVL Script Studio — lexer, parser e AST da linguagem MATLAB-like, com posições, marcação de ponto e vírgula e testes por snapshots. Use para implementar ou corrigir a análise sintática; não implementa análise de tipos, runtime nem tradutor.
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
---

Você implementa a **fase 1** do EEVL Script Studio: lexer, parser e AST. O resultado será usado pelo tradutor nos dois modos (depuração e rápido), então a AST precisa carregar tudo o que eles vão precisar: posições exatas e a presença ou ausência de ponto e vírgula em cada instrução. Não implemente resolução de nomes, análise de tipos, runtime nem geração de JavaScript.

## Leia antes de começar

1. `AGENTS.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md` — regras permanentes do repositório; prevalecem sobre este arquivo.
2. `docs/SCRIPT-STUDIO.md`: seção 1.1 (requisitos, em especial o 8, sem ambiguidade sintática), seção 6.1 (declarações), seção 7.2 (palavras reservadas e tipo `sys`) e **seção 8 (contrato semântico, aprovado pelo autor)**. A seção 8 é a referência de sintaxe; em conflito com outro trecho, siga a seção 8 e reporte o conflito.
3. `docs/LANGUAGE.md`: proposta da futura linguagem de modelagem (seções `%% NETLIST` etc. e argumentos nomeados). O parser não implementa a modelagem, mas não pode tornar essa sintaxe impossível depois.

## Onde trabalhar

- Módulos ESM puros, sem DOM e sem dependências, em `assets/js/script/`: `lexer.js`, `parser.js` e, se útil, `ast.js` (construtores e lista de tipos de nó). Devem funcionar no navegador e no Node.
- Testes em `tests/script-lexer.test.mjs` e `tests/script-parser.test.mjs` (o `npm test` roda `tests/*.test.mjs`).
- Corpus em `tests/script-studio/corpus/*.m` e snapshots da AST em `tests/script-studio/ast/*.json`.
- Gramática documentada em `docs/SCRIPT-GRAMMAR.md` (EBNF mais as regras de desambiguação em prosa), ligada a partir de `docs/SCRIPT-STUDIO.md`. Marque como "em desenvolvimento"; não anuncie o Script Studio como pronto em `API.md`, `ROADMAP.md` ou no site.
- Não altere `assets/js/core/` nem simuladores. Caminhos relativos, UTF-8, sem build.

## Requisitos da AST

- **Posições em todo nó:** `loc = {line, col, endLine, endCol}`, 1-based, além do deslocamento em caracteres.
- **Instruções** registram `display: true|false`: `false` quando terminam em `;`, `true` quando terminam em `,`, quebra de linha ou fim de arquivo. Várias instruções na mesma linha (`a = 1, b = 2; c = 3`) geram nós separados, cada um com seu `display`.
- **Erros de sintaxe** como objeto `{code, params, loc}`, com mensagem em pt-BR gerada a partir do código. O código estável permite traduzir depois para en e es (`docs/I18N.md`). Reporte ao menos o primeiro erro com linha e coluna corretas; recuperação para continuar após erros é desejável, não obrigatória.
- **JSON estável:** a AST serializa sem ciclos e com ordem de chaves determinística, para os snapshots.

Tipos de nó sugeridos (ajuste se precisar, documentando): `Program` (instruções do script mais funções locais e marcadores de seção), `ExprStmt`, `Assign` (alvos múltiplos em `[a, ~] = f(x)`, com `~` como marcador de saída ignorada), `Decl`, `If`, `For`, `While`, `Switch`, `Break`, `Continue`, `Return`, `Function`, `ArgumentsBlock`, `Section`; expressões `Number` (com flag imaginária), `String` (com o tipo de aspas), `Ident`, `Colon` (o `:` sozinho num índice), `End` (o `end` dentro de índice), `Range`, `Binary`, `Unary`, `Postfix` (`'` e `.'`), `CallOrIndex` (o parser não decide entre chamada e indexação; isso é da análise semântica), `Field` (`G.num`), `Matrix` (linhas e elementos), `AnonFn`, `FuncHandle`, `NamedArg`.

## Regras de sintaxe a implementar

Todas vêm da seção 8, salvo indicação.

- **Comentários:** `%` até o fim da linha; blocos `%{` ... `%}` em linhas próprias; `%%` marca seção. Guarde o título da seção (`%% NETLIST`, `%% Parte 2`) num nó `Section`. `#` **não** é comentário.
- **Continuação:** `...` no fim da linha; o resto da linha após `...` é comentário.
- **Strings:** `'...'` e `"..."`, com aspas duplicadas como escape (`'it''s'`). Os dois produzem o mesmo tipo, mas registre o tipo de aspas no nó.
- **Transposta ou aspas:** `'` é transposta logo após identificador, `)`, `]`, `}`, número, `'` ou `.'`, sem espaço entre eles; caso contrário, abre string. Dentro de `[...]`, `[a' b']` são duas transpostas.
- **Literais de matriz:** espaço ou vírgula separam colunas; `;` ou quebra de linha separam linhas. `[1 -2]` tem dois elementos e `[1 - 2]` tem um; `[a -b]` tem dois e `[a - b]` tem um; `[f (1)]` tem dois elementos. Siga exatamente a regra do MATLAB.
- **Números:** inteiros, decimais (`.5`, `5.`), notação científica (`1e-3`, `2.5E+4`) e sufixo imaginário `i`/`j` (`3i`, `2.5e3j`).
- **Precedência e associatividade:** iguais ao MATLAB. Exemplos que precisam estar nos testes: `-2^2` é `-(2^2)`; `2^-1` é válido; `^` é associativo à esquerda (`2^3^2` é `(2^3)^2`); `'` e `.'` são pós-fixos de maior precedência; `a:b:c+1` é intervalo com `c+1` como fim; `~a == b` é `(~a) == b`; `&&` e `||` com curto-circuito.
- **`end`:** termina blocos, mas dentro dos parênteses de um `CallOrIndex` vira o nó `End` (`A(end, end-1)`).
- **Funções:** funções locais com `function ... end` no fim do script; múltiplas saídas `function [a, b] = f(x, y)`; bloco `arguments` (forma, classe, validadores, valor padrão), como na seção 6.1. Funções anônimas `@(x, y) expr` e handles `@sin`. `function` dentro de `if` ou laço é erro.
- **Controle de fluxo:** `if`/`elseif`/`else`, `for`, `while`, `switch`/`case`/`otherwise` (com `case {1, 2}`), `break`, `continue`, `return`. Tudo fechado por `end`.
- **Declarações** (seção 6.1): instrução que começa por `int`, `real`, `complex`, `bool`, `char` ou `sys`, **seguida de um identificador**, opcionalmente precedida de `varsize`. Declaradores separados por vírgula, cada um com inicialização opcional (`real x = 0, y = 1, z`). Sem nenhuma inicialização, também aceita espaços (`real x y z`). Essas palavras só são palavras-chave nessa posição: `real(z)`, `y = real(z)` e `real = 3` continuam sendo chamada, chamada e atribuição. Dentro de uma declaração, a vírgula separa declaradores, não instruções.
- **Sintaxe de comando** (`hold on`, `format long`, `clear all`) **não é suportada**: gere erro com a sugestão da forma de função (`hold("on")`).
- **Palavras reservadas:** as palavras-chave do MATLAB, mais `classdef`, `model`, `block`, `port`, `parameter`, `state`, `der`, `next` (seção 7.2). Também `try`, `catch`, `global`, `persistent`, `parfor`, que existem no MATLAB mas não na v1. Usar qualquer uma como nome de variável ou função dá erro claro ("palavra reservada" ou "ainda não suportado").
- **Argumentos nomeados:** aceite `f(a, Name=value)` na forma de argumento do MATLAB (R2021a+), produzindo `NamedArg`. É sintaxe MATLAB válida e é a forma usada em `docs/LANGUAGE.md`.
- **Mais de duas dimensões:** o parser aceita qualquer número de índices. O erro de "mais de 2 dimensões" é da análise semântica, não do parser.
- **Sintaxe exclusiva do Octave** (`endif`, `endfor`, `endwhile`, `endfunction`, `!`, `!=`, `+=`, `++`, `#` como comentário, `printf`): gere erro com sugestão da forma MATLAB. **Esta regra é uma proposta ainda não confirmada pelo autor:** isole-a para ser fácil de mudar e cite-a no relatório final.
- **Células e structs** (`{...}`, `c{1}`) estão fora da v1: erro claro. O acesso a campo `x.y` é aceito, porque o tipo `sys` usa `G.num`.

## Testes

- **Corpus de cerca de 50 scripts**, cobrindo todas as regras acima. Inclua todos os casos ambíguos citados (transposta ou aspas, espaços em matrizes, `end`, declaração contra chamada, precedência) e pelo menos um script realista de engenharia elétrica (circuito RC, `tf`, `step`, laço com `fprintf`).
- **Snapshots:** um JSON de AST por script. Se a variável de ambiente `UPDATE_SNAPSHOTS=1` estiver definida, regrave os arquivos; sem ela, compare.
- **Testes de erro:** script, código do erro e linha/coluna esperadas, para cada erro definido.
- **Testes do lexer**, separados, para os tokens ambíguos.
- **Desempenho:** meça o tempo de parse de um arquivo gerado com cerca de 10.000 linhas e reporte. O alvo é ficar abaixo de 100 ms no Node; não otimize prematuramente se já estiver abaixo.

## Verificação e entrega

- Rode `npm test` (Windows: `npm.cmd test`); tudo deve passar, inclusive `scripts/check.mjs` (links de Markdown e sintaxe JS).
- Ao final, informe: arquivos criados, quantos scripts e testes, tempo de parse medido, regras que ficaram ambíguas ou conflitantes com a seção 8, e decisões que você teve de tomar (para o autor confirmar).
- Não faça commit, push nem PR sem autorização do autor.
