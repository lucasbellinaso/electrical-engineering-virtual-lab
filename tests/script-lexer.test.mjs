import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, KEYWORDS, FUTURE_RESERVED } from '../assets/js/script/lexer.js';

// Forma compacta: tipo:valor; vírgula/ponto e vírgula inseridos pelo lexer aparecem como "v,"/"v;".
const show = (src, opts) => tokenize(src, opts).tokens
  .filter((t) => t.type !== 'eof')
  .map((t) => (t.virtual ? `v${t.value}` : t.type === 'op' ? t.value : t.type === 'nl' ? 'NL' : `${t.type}:${t.value}`))
  .join(' ');

test('transposta: logo após valor, sem espaço', () => {
  assert.equal(show("a'"), "ident:a '");
  assert.equal(show("a.'"), "ident:a .'");
  assert.equal(show("a''"), "ident:a ' '");
  assert.equal(show("(a)'"), "( ident:a ) '");
  assert.equal(show("x(1)'"), "ident:x ( num:1 ) '");
  assert.equal(show("[1 2]'"), "[ num:1 v, num:2 ] '");
  assert.equal(show("3'"), "num:3 '");
});

test('aspas: abre string depois de operador, vírgula, parêntese, palavra-chave ou espaço dentro de colchetes', () => {
  assert.equal(show("x = 'abc'"), "ident:x = str:abc");
  assert.equal(show("disp('oi')"), "ident:disp ( str:oi )");
  assert.equal(show("a == 'x'"), "ident:a == str:x");
  assert.equal(show("case 'a'"), "kw:case str:a");
  assert.equal(show("a 'x'"), "ident:a ' ident:x '");
  assert.equal(show("x = a ';"), "ident:x = ident:a ' ;");
  assert.equal(show("[a 'x']"), "[ ident:a v, str:x ]");
  assert.equal(show("a .'"), "ident:a .'");
  assert.equal(show("'it''s'"), "str:it's");
  assert.equal(show('"say ""hi"""'), 'str:say "hi"');
});

test('quote de string e valor', () => {
  const t = tokenize(`'a' "b"`).tokens;
  assert.equal(t[0].quote, "'");
  assert.equal(t[1].quote, '"');
});

test('matriz: espaço separa colunas, quebra de linha separa linhas', () => {
  assert.equal(show('[1 2]'), '[ num:1 v, num:2 ]');
  assert.equal(show('[1, 2]'), '[ num:1 , num:2 ]');
  assert.equal(show('[1 2\n3 4]'), '[ num:1 v, num:2 v; num:3 v, num:4 ]');
  assert.equal(show('[1 2;\n3 4]'), '[ num:1 v, num:2 ; num:3 v, num:4 ]');
});

test('matriz: sinais binários e unários', () => {
  assert.equal(show('[1 -2]'), '[ num:1 v, - num:2 ]');
  assert.equal(show('[1 - 2]'), '[ num:1 - num:2 ]');
  assert.equal(show('[1 -  2]'), '[ num:1 - num:2 ]');
  assert.equal(show('[a -b]'), '[ ident:a v, - ident:b ]');
  assert.equal(show('[a - b]'), '[ ident:a - ident:b ]');
  assert.equal(show('[a- b]'), '[ ident:a - ident:b ]');
  assert.equal(show('[a-b]'), '[ ident:a - ident:b ]');
  assert.equal(show('[1 +2]'), '[ num:1 v, + num:2 ]');
  assert.equal(show('[a, -b]'), '[ ident:a , - ident:b ]');
});

test('matriz: chamada com espaço antes do parêntese são dois elementos', () => {
  assert.equal(show('[f (1)]'), '[ ident:f v, ( num:1 ) ]');
  assert.equal(show('[f(1)]'), '[ ident:f ( num:1 ) ]');
});

test('matriz: transpostas e strings', () => {
  assert.equal(show("[a' b']"), "[ ident:a ' v, ident:b ' ]");
  assert.equal(show("[a 'b']"), "[ ident:a v, str:b ]");
  assert.equal(show("['x' 'y']"), "[ str:x v, str:y ]");
});

test('matriz: negação e operadores relacionais', () => {
  assert.equal(show('[~a b]'), '[ ~ ident:a v, ident:b ]');
  assert.equal(show('[a ~= b]'), '[ ident:a ~= ident:b ]');
  assert.equal(show('[a == b]'), '[ ident:a == ident:b ]');
  assert.equal(show('[a .* b]'), '[ ident:a .* ident:b ]');
});

test('dentro de parênteses de uma matriz o espaço não separa', () => {
  assert.equal(show('[f(1 2) 3]'), '[ ident:f ( num:1 num:2 ) v, num:3 ]');
  assert.equal(show('[(1 - 2) 3]'), '[ ( num:1 - num:2 ) v, num:3 ]');
});

test('fora de matriz espaços não inserem separadores', () => {
  assert.equal(show('a -b'), 'ident:a - ident:b');
  assert.equal(show('f (1)'), 'ident:f ( num:1 )');
});

test('números', () => {
  const nums = (s) => tokenize(s).tokens.filter((t) => t.type === 'num').map((t) => t.value + (t.imag ? '*' : ''));
  assert.deepEqual(nums('42 3.14 .5 5. 1e-3 2.5E+4 1e5'), ['42', '3.14', '.5', '5.', '1e-3', '2.5E+4', '1e5']);
  assert.deepEqual(nums('3i 2.5e3j 1j'), ['3i*', '2.5e3j*', '1j*']);
  assert.equal(show('1./x'), 'num:1 ./ ident:x');
  assert.equal(show('1.*x'), 'num:1 .* ident:x');
  assert.equal(show('2.^x'), 'num:2 .^ ident:x');
  assert.equal(show("1.'"), "num:1 .'");
  assert.equal(show('x.*.5'), 'ident:x .* num:.5');
  assert.equal(show('1:3'), 'num:1 : num:3');
});

test('número malformado dá erro', () => {
  const r = tokenize('x = 12abc');
  assert.equal(r.errors[0].code, 'invalidNumber');
  assert.equal(r.errors[0].loc.col, 5);
});

test('continuação ...: o resto da linha é comentário e não gera quebra de linha', () => {
  assert.equal(show('a = 1 + ... soma\n 2'), 'ident:a = num:1 + num:2');
  assert.equal(show('[1 2 ...\n 3]'), '[ num:1 v, num:2 v, num:3 ]');
});

test('comentários, blocos e seções', () => {
  assert.equal(show('a % x\nb'), 'ident:a NL ident:b');
  assert.equal(show('%{\nignorado = 1\n%{\naninhado\n%}\nainda\n%}\nb'), 'NL ident:b');
  assert.equal(show('%% NETLIST\na'), 'section:NETLIST NL ident:a');
  assert.equal(show('  %% Parte 2\n'), 'section:Parte 2 NL');
  assert.equal(show('a %% nao e secao'), 'ident:a');
  assert.equal(show('%%\n'), 'section: NL');
  assert.equal(show('x = [1 %% c\n2]'), 'ident:x = [ num:1 v; num:2 ]');
});

test('bloco de comentário só vale com %{ sozinho na linha', () => {
  assert.equal(show('a %{ x\nb'), 'ident:a NL ident:b');
  assert.equal(tokenize('%{\nabc').errors[0].code, 'unterminatedBlockComment');
});

test('# não é comentário', () => {
  const r = tokenize('a = 1 # nao\nb = 2');
  assert.equal(r.errors[0].code, 'octaveComment');
  assert.equal(r.errors[0].loc.line, 1);
  assert.equal(r.errors[0].loc.col, 7);
});

test('palavras-chave, reservadas e depois do ponto', () => {
  for (const w of ['if', 'end', 'function', 'classdef', 'model', 'try', 'catch', 'global', 'persistent', 'parfor']) {
    assert.ok(KEYWORDS.has(w), w);
    assert.equal(tokenize(w).tokens[0].type, 'kw', w);
  }
  for (const w of ['real', 'int', 'complex', 'bool', 'char', 'sys', 'varsize', 'arguments', 'block', 'port', 'parameter', 'state', 'der', 'next']) assert.equal(tokenize(w).tokens[0].type, 'ident', w);
  assert.ok(FUTURE_RESERVED.has('model') && !FUTURE_RESERVED.has('der'));
  assert.equal(show('s.next'), 'ident:s . ident:next');
  assert.equal(show('x.end'), 'ident:x . ident:end');
});

test('operadores de dois caracteres', () => {
  assert.equal(show('a<=b>=c==d~=e&&f||g'), 'ident:a <= ident:b >= ident:c == ident:d ~= ident:e && ident:f || ident:g');
  assert.equal(show('a.*b./c.\\d.^e'), 'ident:a .* ident:b ./ ident:c .\\ ident:d .^ ident:e');
});

test('posições: linha e coluna 1-based, fim exclusivo', () => {
  const { tokens, locate } = tokenize('ab = 1\n  cd');
  assert.deepEqual(locate(tokens[0].start, tokens[0].end), { line: 1, col: 1, endLine: 1, endCol: 3, start: 0, end: 2 });
  const cd = tokens.find((t) => t.value === 'cd');
  assert.deepEqual(locate(cd.start, cd.end), { line: 2, col: 3, endLine: 2, endCol: 5, start: 9, end: 11 });
});

test('CRLF e BOM são tratados como espaço', () => {
  assert.equal(show('﻿a = 1\r\nb = 2\r\n'), 'ident:a = num:1 NL ident:b = num:2 NL');
});

test('string não terminada', () => {
  const r = tokenize("x = 'abc\ny = 1");
  assert.equal(r.errors[0].code, 'unterminatedString');
  assert.deepEqual([r.errors[0].loc.line, r.errors[0].loc.col], [1, 5]);
});

test('caractere inesperado', () => {
  const r = tokenize('a = 1 $ 2');
  assert.equal(r.errors[0].code, 'unexpectedChar');
  assert.deepEqual([r.errors[0].loc.line, r.errors[0].loc.col], [1, 7]);
});

test('regra Octave: erros com recuperação, desligável por opção', () => {
  const code = (s, o) => tokenize(s, o).errors.map((e) => e.code);
  assert.deepEqual(code('endif'), ['octaveEnd']);
  assert.deepEqual(code('a != b'), ['octaveNotEqual']);
  assert.deepEqual(code('!a'), ['octaveNot']);
  assert.deepEqual(code('a += 1'), ['octaveCompoundAssign']);
  assert.deepEqual(code('a++'), ['octaveIncrement']);
  assert.deepEqual(code('printf("x")'), ['octavePrintf']);
  assert.deepEqual(code('a - -b'), []);
  assert.deepEqual(code('a ++b'), []);
  assert.deepEqual(code('a ~= b'), []);
  assert.deepEqual(code('a != b', { octave: false }), ['unexpectedChar']);
});

// ---- letras gregas (SCRIPT-STUDIO.md seção 8; SCRIPT-GRAMMAR.md regra 10) ----------------
const codes = (src) => tokenize(src).errors.map((e) => `${e.code}@${e.loc.col}`);

test('letras gregas: identificadores no início, no meio e misturados com ASCII', () => {
  assert.equal(show('ω = 2*π*f'), 'ident:ω = num:2 * ident:π * ident:f');
  assert.equal(show('ωn Δt θ_1 R_θ Ω λ2'), 'ident:ωn ident:Δt ident:θ_1 ident:R_θ ident:Ω ident:λ2');
  assert.equal(show('[α β; γ -δ]'), '[ ident:α v, ident:β ; ident:γ v, - ident:δ ]');
  assert.equal(show("α'"), "ident:α '");
  assert.deepEqual(codes('αβγδεζηθικλμνξπρστυφχψω ΓΔΘΛΞΠΣΦΨΩ'), []);
});

test('letras gregas: variantes viram a forma comum, com as posições do texto original', () => {
  const t = tokenize('µ0 ϕ ϑ ϵ ς ϖ ϰ ϱ').tokens.filter((x) => x.type === 'ident');
  assert.deepEqual(t.map((x) => x.value), ['μ0', 'φ', 'θ', 'ε', 'σ', 'π', 'κ', 'ρ']);
  assert.deepEqual([t[0].start, t[0].end, t[1].start], [0, 2, 3]);
  assert.deepEqual(codes('µ0 ϕ'), []);
});

test('letras gregas iguais às latinas: erro com a sugestão, e a análise continua', () => {
  for (const [g, l] of Object.entries({ 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', 'ο': 'o' })) {
    const r = tokenize(`x${g}1`);
    assert.deepEqual(r.errors.map((e) => [e.code, e.params.char, e.params.latin, e.loc.col]), [['greekLookalike', g, l, 2]]);
    assert.equal(r.tokens[0].value, `x${l}1`);
  }
});

test('letras gregas: acentuadas não são aceitas; número colado a letra grega é inválido', () => {
  assert.deepEqual(codes('x = ά'), ['unexpectedChar@5']);
  assert.deepEqual(codes('x = 2ω'), ['invalidNumber@5']);
  assert.equal(show("s = 'αβ' % θ"), 'ident:s = str:αβ');
});
