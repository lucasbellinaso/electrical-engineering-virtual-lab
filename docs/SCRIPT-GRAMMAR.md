# EEVL Script Studio — Gramática (fase 1)

**Estado: em desenvolvimento.** Este documento descreve o lexer, o parser e a AST da fase 1 (`assets/js/script/`). Não há tradutor, runtime nem execução ainda; o Script Studio não está disponível no site. A referência de linguagem é a seção 8 de [SCRIPT-STUDIO.md](SCRIPT-STUDIO.md) (contrato semântico aprovado), com as seções 1.1, 6.1 e 7.2; em conflito, vale a seção 8. A sintaxe futura de modelagem está em [LANGUAGE.md](LANGUAGE.md) e não é implementada aqui.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `assets/js/script/lexer.js` | `tokenize(fonte, opções)`, listas de palavras-chave, `createLocator` |
| `assets/js/script/parser.js` | `parse(fonte, opções)` devolve `{ast, errors, ok}` |
| `assets/js/script/ast.js` | `NODE_TYPES` e `walk` |
| `assets/js/script/errors.js` | códigos de erro, parâmetros e mensagens em pt-BR |
| `assets/js/script/format.js` | `formatIndentation(fonte, opções)` (formatador de indentação, ver abaixo) |
| `tests/script-lexer.test.mjs`, `tests/script-parser.test.mjs`, `tests/script-format.test.mjs` | testes |
| `tests/script-studio/corpus/*.m`, `tests/script-studio/ast/*.json` | corpus e snapshots (`UPDATE_SNAPSHOTS=1` regrava) |

Módulos ESM puros, sem DOM e sem dependências; funcionam no navegador e no Node.

## Posições, display e erros

- Todo nó tem `loc = {line, col, endLine, endCol, start, end}`. Linhas e colunas começam em 1; `start`/`end` são deslocamentos em unidades UTF-16 e `end`, `endCol` são exclusivos. A `loc` de uma instrução inclui o `;` ou `,` final, mas não a quebra de linha.
- Instruções (`ExprStmt`, `Assign`, `Decl`) têm `display`: `false` se terminam em `;`; `true` se terminam em `,`, quebra de linha ou fim do arquivo. `a = 1, b = 2; c = 3` gera três nós.
- Erros são `{code, params, loc, message}`. `code` e `params` são estáveis e independentes de idioma (símbolos especiais `<eol>`, `<eof>`, `<identifier>`, `<expression>`); `message` é gerada em pt-BR por `errors.js`. O parser se recupera na linha seguinte e continua, então pode devolver vários erros; o `ast` devolvido é parcial nesse caso.
- A AST serializa sem ciclos e com ordem de chaves fixa (`type`, campos do nó, `loc`).

## Gramática (EBNF)

Notação: `{ x }` zero ou mais, `[ x ]` opcional, `( a | b )` alternativa, `'x'` terminal. `sep` é `;`, `,` ou quebra de linha. Os comentários e a continuação `...` são removidos pelo lexer.

```ebnf
programa     = { sep | secao | instrucao } { sep | secao | funcao } ;
secao        = '%%' texto ;                 (* só no início da linha, fora de colchetes *)
bloco        = { sep | instrucao } ;

instrucao    = declaracao | atribuicao | if | for | while | switch
             | 'break' | 'continue' | 'return' | expressao ;

declaracao   = [ 'varsize' ] tipo declarador { ',' declarador }
             | [ 'varsize' ] tipo ident ident { ident } ;   (* forma com espaços: nenhum inicializado *)
tipo         = 'int' | 'real' | 'complex' | 'bool' | 'char' | 'sys' ;
declarador   = ident [ '=' expressao ] ;

atribuicao   = alvo '=' expressao
             | '[' alvo_ou_til { ',' alvo_ou_til } ']' '=' expressao ;
alvo_ou_til  = alvo | '~' ;
alvo         = ident { '(' args ')' | '.' ident } ;

if           = 'if' expressao bloco { 'elseif' expressao bloco } [ 'else' bloco ] 'end' ;
for          = 'for' ( ident '=' expressao | '(' ident '=' expressao ')' ) bloco 'end' ;
while        = 'while' expressao bloco 'end' ;
switch       = 'switch' expressao { 'case' ( expressao | lista_chaves ) bloco }
               [ 'otherwise' bloco ] 'end' ;
lista_chaves = '{' expressao { ',' expressao } '}' ;     (* só em case e em validadores *)

funcao       = 'function' [ saidas '=' ] ident [ '(' [ parametro { ',' parametro } ] ')' ]
               { bloco_arguments } bloco 'end' ;
saidas       = ident | '[' ident { ',' ident } ']' ;
parametro    = ident | '~' ;
bloco_arguments = 'arguments' [ '(' ident ')' ] { decl_arg } 'end' ;
decl_arg     = ident { '.' ident } [ '(' args ')' ] [ ident ] [ lista_chaves ] [ '=' expressao ] ;

expressao    = ou_ou ;
ou_ou        = e_e { '||' e_e } ;
e_e          = ou { '&&' ou } ;
ou           = e { '|' e } ;
e            = comparacao { '&' comparacao } ;
comparacao   = intervalo { ( '==' | '~=' | '<' | '<=' | '>' | '>=' ) intervalo } ;
intervalo    = soma { ':' soma [ ':' soma ] } ;           (* a:b ou a:passo:b; encadeia à esquerda *)
soma         = produto { ( '+' | '-' ) produto } ;
produto      = unario { ( '*' | '/' | '\' | '.*' | './' | '.\' ) unario } ;
unario       = ( '-' | '+' | '~' ) unario | potencia ;
potencia     = posfixo { ( '^' | '.^' ) operando_exp | '\'' | '.\'' } ;
operando_exp = ( '-' | '+' | '~' ) operando_exp | posfixo ;
posfixo      = primario { '(' args ')' | '.' ident } ;
primario     = numero | texto | ident | 'end' | '(' expressao ')' | matriz | anonima | handle ;
matriz       = '[' [ linha { ';' linha } ] ']' ;
linha        = expressao { ',' expressao } ;              (* ',' pode ser espaço; ';' pode ser quebra de linha *)
anonima      = '@' '(' [ parametro { ',' parametro } ] ')' expressao ;
handle       = '@' ident { '.' ident } ;
args         = [ arg { ',' arg } ] ;
arg          = ':' | ident '=' expressao | expressao ;
```

## Regras de desambiguação

1. **Transposta ou aspas** (como no MATLAB). `'` é transposta quando o token anterior termina um valor: identificador, número, string, `)`, `]`, `}`, outra transposta (`'` ou `.'`) ou `end` de índice. Fora de `[...]` e `{...}` isso vale mesmo com espaços antes (`a '`, `x = a ';`). Dentro de `[...]` e `{...}` o espaço antes de `'` abre string (`[a 'b']` tem dois elementos) e, sem espaço, é transposta (`[a' b']`). Em qualquer outro caso (depois de operador, vírgula, `(`, palavra-chave) abre string. Consequência: `hold 'on'` não é reconhecido como sintaxe de comando, e sim como transposta seguida de identificador (erro `expectedStatementEnd`). `"..."` é sempre string. Em ambas, aspas duplicadas são o escape (`'it''s'`); o nó `String` guarda `quote`.
2. **Literais de matriz.** O lexer insere separadores dentro de `[...]` e `{...}`: espaço entre dois elementos vira vírgula, quebra de linha vira `;`. Há um novo elemento quando o token anterior termina um valor, há espaço antes e o próximo token começa um valor. `+` e `-` começam valor (sinal unário) só se o caractere seguinte não for espaço: `[1 -2]` tem dois elementos, `[1 - 2]` e `[a-b]` um; `[a -b]` dois, `[a - b]` um. `[f (1)]` tem dois elementos e `[f(1)]` um. `~` começa valor, exceto em `~=`. Dentro de parênteses aninhados o espaço não separa. Quebra de linha logo após `,` ou `;` não gera linha nova (decisão do lexer, ver relatório).
3. **Precedência** (da menor para a maior): `||`, `&&`, `|`, `&`, comparações, intervalo `:`, `+ -`, `* / \ .* ./ .\`, unários `+ - ~`, depois `^ .^ ' .'`. Decisão do autor: `^`, `.^`, `'` e `.'` ficam no **mesmo nível** e associam à esquerda, como na documentação do MATLAB (a transposta não é "de maior precedência" que a potência): `2^3^2` é `(2^3)^2`, `-2^2` é `-(2^2)`, `a^b'` é `(a^b)'`. O expoente aceita sinais (`2^-1`). `~a == b` é `(~a) == b`. `a:b:c+1` é um intervalo com fim `c+1`.
4. **`end`.** Termina blocos. Dentro dos parênteses de `CallOrIndex` (em qualquer profundidade, inclusive dentro de `[...]` ali) vira o nó `End`; em outro lugar dentro de uma expressão é erro `endOutsideIndex`.
5. **Chamada ou índice.** O parser sempre produz `CallOrIndex`; quem decide é a análise semântica. `(` só continua uma chamada depois de identificador, campo, outra chamada ou parênteses (não depois de número, string ou matriz). Qualquer quantidade de índices é aceita (o limite de duas dimensões é semântico). `:` sozinho como argumento vira `Colon`. `nome=valor` dentro de uma chamada vira `NamedArg`.
6. **Declarações.** Uma instrução é declaração se começa por `int`, `real`, `complex`, `bool`, `char` ou `sys` (precedido ou não de `varsize`) **e o token seguinte é um identificador**. Caso contrário essas palavras são identificadores comuns (`real(z)`, `y = real(z)`, `real = 3`, `char(65)`). Dentro da declaração a vírgula separa declaradores, então uma declaração só termina em `;`, quebra de linha ou fim do arquivo. Sem nenhuma inicialização vale também a lista com espaços (`real x y z`).
7. **Sintaxe de comando** (`hold on`, `format long`, `clear all`, `hold 'on'`): identificador seguido de identificador, número ou string na mesma instrução é o erro `commandSyntax`, com a sugestão `hold("on")` em `params.suggestion`.
8. **Funções.** Só no nível do arquivo, depois de todo o código do script; um comando depois da primeira função é o erro `statementAfterFunction`. Precisam de `end`. `function` dentro de `if`, laço ou outra função é erro. O bloco `arguments` deve vir logo depois do cabeçalho. `arguments` só é palavra especial nesse ponto, seguido de quebra de linha, `;` ou `(Atributo)`.
9. **Palavras-chave e reservadas.** `if elseif else for while switch case otherwise break continue return function end` funcionam. Só `classdef` e `model` são reservadas (`reservedWord`). `state`, `next`, `block`, `port`, `parameter` e `der` são identificadores comuns. `try catch global persistent parfor spmd` dão `unsupportedKeyword`. Depois de um ponto (`s.next`, `G.end`) a palavra é nome de campo.

    *Nota de evolução:* `state`, `next`, `block`, `port`, `parameter` e `der` deverão virar palavras-chave contextuais, válidas só dentro de um bloco `model` (com realce próprio no editor). Fora dele continuarão sendo nomes comuns, então scripts da v1 que os usam como variáveis não quebram.
10. **Letras gregas.** `ident` é uma letra latina, `_` ou letra grega do alfabeto básico, seguida de letras, dígitos ou `_` (seção 8 de SCRIPT-STUDIO.md). O lexer guarda em `value` o nome canônico: variantes viram a forma comum (`µ` → `μ`, `ϕ` → `φ`, `ϑ` → `θ`, `ϵ` → `ε`, `ς` → `σ`, `ϖ` → `π`, `ϰ` → `κ`, `ϱ` → `ρ`), e as posições continuam as do texto original (todas essas letras ocupam uma unidade UTF-16). Letras iguais às latinas (`Α Β Ε Ζ Η Ι Κ Μ Ν Ο Ρ Τ Υ Χ ο`) dão `greekLookalike` e são trocadas pela latina para a análise continuar. Letras acentuadas (`ά`) dão `unexpectedChar`. Número colado a letra grega (`2ω`) dá `invalidNumber`, como `2x`. `π` como alvo de atribuição (também `π(1) = …` e `[a, π] = …`), declarador, variável de `for`, parâmetro, saída ou nome de função dá `constantAssignment`; como nome de campo (`s.π`) é permitido.
11. **Fora da v1.** Células e chaves (`{...}`, `c{1}`) dão `cellNotSupported` (exceto em `case {..}` e validadores de `arguments`); campo dinâmico `x.(nome)` dá `dynamicFieldNotSupported`.

## Sintaxe exclusiva do Octave

Regra confirmada pelo autor. Gera erro com sugestão da forma MATLAB, mas o lexer se recupera e continua: `#` como comentário (`octaveComment`), `endif`/`endfor`/`endwhile`/`endfunction`/`endswitch`/`end_try_catch`/`endparfor` (`octaveEnd`, tratado como `end`), `!` e `!=` (`octaveNot`, `octaveNotEqual`), `+=` `-=` `*=` `/=` `^=` (`octaveCompoundAssign`), `x++`/`x--` no fim de instrução (`octaveIncrement`) e `printf` (`octavePrintf`). Está isolada em `octaveStep` e `OCTAVE_END_WORDS` no lexer; `parse(src, {octave: false})` a desliga.

## Tipos de nó

`Program {body, functions}`, `Section {title, raw}`, `Function {name, outputs, params, argumentBlocks, body}`, `Param {name, ignored}`, `ArgumentsBlock {attributes, entries}`, `ArgumentDecl {name, dims, className, validators, defaultValue}`; instruções `ExprStmt {expression, display}`, `Assign {targets, bracket, value, display}` (alvos podem ser `Ignore` para `~`), `Decl {varsize, typeName, declarators, display}`, `Declarator {name, init}`, `If {condition, body, elseifs, elseBody}`, `ElseIf`, `For {variable, iterable, body}`, `While`, `Switch {subject, cases, otherwise}`, `Case {values, cell, body}`, `Otherwise`, `Break`, `Continue`, `Return`; expressões `Number {value, raw, imaginary}`, `String {value, quote}`, `Ident {name}`, `Colon`, `End`, `Range {start, step, stop}`, `Binary {operator, left, right}`, `Unary`, `Postfix`, `CallOrIndex {callee, args}`, `Field {object, name}`, `Matrix {rows}`, `AnonFn {params, body}`, `FuncHandle {name}`, `NamedArg {name, value}`, `Paren {expression}`. `Paren` e `Section` são acréscimos à lista sugerida: `Paren` preserva os parênteses da fonte, e `Section` guarda `%%`.

## Formatador de indentação

**Estado: em desenvolvimento** (`assets/js/script/format.js`, ainda não ligado ao editor).

`formatIndentation(fonte, {indentUnit = 4, tabSize = 4})` devolve `{text, edits, changedLines, ok, errors}`. `indentUnit` e `tabSize` aceitam número (colunas); `indentUnit` aceita também texto (`'  '`). `edits` é a lista `{line, oldIndent, newIndent}` (linha 1-based; indentações como texto), para o editor aplicar numa única ação de desfazer; `changedLines` é `edits.length`. Se o parse tiver erros, devolve `ok: false`, `text` igual à entrada, `edits` vazio e os `errors`: script com erro de sintaxe não é reformatado. O módulo usa `parse` (erros e blocos `arguments`) e os tokens do lexer; não exige campos novos na AST.

**Regra por bloco** (corpo de `function`, `if`/`elseif`/`else`, `for`, `while`, cada `case`/`otherwise` e `arguments`):

1. Mínimo = alvo do bloco pai + `indentUnit`. O nível do script é fixo em 0: instruções de nível superior, `function` e marcadores `%%` vão para a margem (decisão do autor; não se usa a mediana no nível superior).
2. Alvo = mediana das indentações atuais (tabulações expandidas por `tabSize`) das linhas que começam uma instrução diretamente no bloco, nunca abaixo do mínimo. Com número par de linhas usa-se a **mediana inferior** (o menor dos dois valores centrais). Linhas de abertura de blocos aninhados (`if`, `for`, `arguments`...) contam como instruções do bloco que as contém; `elseif`, `else`, `end`, comentários e continuações não contam.
3. Linhas que começam instrução são realinhadas ao alvo; blocos aninhados usam o alvo já corrigido do pai.
4. `if`/`elseif`/`else`/`end`, `for`, `while`, `switch` e `function` ficam no alvo do bloco que os contém. `switch` tem um nível próprio para `case`/`otherwise` (alvo = mediana das linhas `case`/`otherwise`, com mínimo = alvo do `switch` + `indentUnit`); o corpo de cada `case` fica um nível dentro dele e o `end` do `switch` alinha com o `switch`.

**Casos especiais**

- Só muda espaços/tabulações no começo da linha; o resto da linha e o número de linhas não mudam. Linhas totalmente em branco perdem os espaços.
- Continuações (`...`) e linhas internas de `[...]` mantêm a distância relativa à primeira linha da instrução (se ela andou N colunas, elas andam N, com piso em 0).
- Comentários em bloco `%{ ... %}`, com as linhas `%{` e `%}`, não são tocados.
- Comentários de linha inteira seguem o alvo do bloco em que estão no ponto do texto (um comentário logo antes de `else`, `end` ou `case` fica no nível do corpo anterior). Dentro de uma instrução de várias linhas, comportam-se como continuação.
- Tabulações viram espaços; o estilo de fim de linha (LF/CRLF) de cada linha é preservado.
- Idempotente: formatar o resultado não gera novas edições. Teste: `tests/script-format.test.mjs` (garantias sobre os 55 scripts do corpus: mesmas linhas, mesmo conteúdo sem indentação, idempotência e AST equivalente sem posições).
