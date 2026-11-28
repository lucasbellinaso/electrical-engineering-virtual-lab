import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '../assets/js/script/parser.js';
import { NODE_TYPES, walk } from '../assets/js/script/ast.js';
import { stableJson, sx } from './helpers/script-studio.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const corpusDir = `${here}script-studio/corpus/`;
const astDir = `${here}script-studio/ast/`;

const ok = (src, opts) => {
  const r = parse(src, opts);
  assert.deepEqual(r.errors.map((e) => `${e.code}@${e.loc.line}:${e.loc.col}`), [], `erros inesperados em: ${src}`);
  return r.ast;
};
// Expressão em `x = <src>`.
const ex = (src) => ok(`x = ${src}`).body[0].value;

// ---- corpus e snapshots -----------------------------------------------------------------
const corpus = readdirSync(corpusDir).filter((f) => f.endsWith('.m')).sort();

test('corpus tem cerca de 50 scripts', () => {
  assert.ok(corpus.length >= 50, `só ${corpus.length}`);
});

for (const file of corpus) {
  test(`snapshot da AST: ${file}`, () => {
    const source = readFileSync(corpusDir + file, 'utf8');
    const { ast, errors } = parse(source);
    assert.deepEqual(errors.map((e) => `${e.code}@${e.loc.line}:${e.loc.col}`), []);
    const json = `${stableJson(ast)}\n`;
    const path = `${astDir}${file.replace(/\.m$/, '.json')}`;
    if (process.env.UPDATE_SNAPSHOTS === '1') {
      writeFileSync(path, json, 'utf8');
      return;
    }
    assert.ok(existsSync(path), `snapshot ausente: ${path} (rode com UPDATE_SNAPSHOTS=1)`);
    assert.equal(json, readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
  });

  test(`AST estável, sem ciclos e com loc em todo nó: ${file}`, () => {
    const source = readFileSync(corpusDir + file, 'utf8');
    const { ast } = parse(source);
    assert.equal(JSON.stringify(ast), JSON.stringify(parse(source).ast));
    walk(ast, (n) => {
      assert.ok(NODE_TYPES.includes(n.type), `tipo desconhecido ${n.type}`);
      const l = n.loc;
      assert.ok(l && l.line >= 1 && l.col >= 1 && l.endLine >= l.line && l.end >= l.start, `loc inválida em ${n.type}`);
    });
  });
}

test('mesma AST (exceto posições) com quebras CRLF', () => {
  const strip = (n) => JSON.stringify(n, (k, v) => (k === 'loc' ? undefined : v));
  for (const file of corpus) {
    const lf = readFileSync(corpusDir + file, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(strip(parse(lf.replace(/\n/g, '\r\n')).ast), strip(parse(lf).ast), file);
  }
});

// ---- precedência e associatividade -----------------------------------------------------------
const exprCases = [
  ['-2^2', '(u- (^ 2 2))'],
  ['2^-1', '(^ 2 (u- 1))'],
  ['2^3^2', '(^ (^ 2 3) 2)'],
  ['2.^3.^2', '(.^ (.^ 2 3) 2)'],
  ['2^-3^2', '(^ (^ 2 (u- 3)) 2)'],
  ["a^b'", "(post' (^ a b))"],
  ["a'^b", "(^ (post' a) b)"],
  ["a'*b", "(* (post' a) b)"],
  ["-a'", "(u- (post' a))"],
  ["x.'", "(post.' x)"],
  ['a:b:c+1', '(range a b (+ c 1))'],
  ['a:b+1', '(range a (+ b 1))'],
  ['1:2:3:4', '(range (range 1 2 3) 4)'],
  ['~a == b', '(== (u~ a) b)'],
  ['a || b && c', '(|| a (&& b c))'],
  ['a && b || c', '(|| (&& a b) c)'],
  ['a | b & c', '(| a (& b c))'],
  ['a & b == c', '(& a (== b c))'],
  ['a == b == c', '(== (== a b) c)'],
  ['a + b * c', '(+ a (* b c))'],
  ['a - b - c', '(- (- a b) c)'],
  ['a / b * c', '(* (/ a b) c)'],
  ['-a * b', '(* (u- a) b)'],
  ['a * -b', '(* a (u- b))'],
  ['a - -b', '(- a (u- b))'],
  ['~~a', '(u~ (u~ a))'],
  ['a + b:c', '(range (+ a b) c)'],
  ['a < b:c', '(< a (range b c))'],
  ['(a + b) * c', '(* (paren (+ a b)) c)'],
  ['a.*b.^2', '(.* a (.^ b 2))'],
  ['a\\b', '(\\ a b)'],
];
for (const [src, want] of exprCases) test(`expressão: ${src}`, () => assert.equal(sx(ex(src)), want));

test('&& e || ficam como Binary com operador (curto-circuito é do tradutor)', () => {
  assert.deepEqual([ex('a && b').type, ex('a && b').operator], ['Binary', '&&']);
  assert.equal(ex('a || b').operator, '||');
});

// ---- end, dois-pontos, chamadas, campos, argumentos nomeados ---------------------------------
const indexCases = [
  ['A(end, end-1)', '(call A end (- end 1))'],
  ['A(end/2)', '(call A (/ end 2))'],
  ['A(1:end-1)', '(call A (range 1 (- end 1)))'],
  ['A(B(end))', '(call A (call B end))'],
  ['A([1 end])', '(call A [1 end])'],
  ['A(:, 1)', '(call A : 1)'],
  ['A(1, :)', '(call A 1 :)'],
  ["A(1, :)'", "(post' (call A 1 :))"],
  ['A(:)', '(call A :)'],
  ['A(1, 2, 3)', '(call A 1 2 3)'],
  ['f()', '(call f)'],
  ['f(a, Name=v)', '(call f a Name=v)'],
  ['Resistor(p=n1, R=10)', '(call Resistor p=n1 R=10)'],
  ['f(1)(2)', '(call (call f 1) 2)'],
  ['G.num', '(. G num)'],
  ['s.a(2).b', '(. (call (. s a) 2) b)'],
  ['G.num(1)', '(call (. G num) 1)'],
  ['s.next', '(. s next)'],
];
for (const [src, want] of indexCases) test(`índice/campo: ${src}`, () => assert.equal(sx(ex(src)), want));

test('NamedArg tem nome e valor; Colon e End são nós próprios', () => {
  const call = ex('f(:, end, Name=3)');
  assert.deepEqual(call.args.map((a) => a.type), ['Colon', 'End', 'NamedArg']);
  assert.equal(call.args[2].name, 'Name');
});

// ---- matrizes: regra do MATLAB -----------------------------------------------------------------
const matrixCases = [
  ['[1 -2]', '[1 (u- 2)]'],
  ['[1 - 2]', '[(- 1 2)]'],
  ['[1 -  2]', '[(- 1 2)]'],
  ['[a -b]', '[a (u- b)]'],
  ['[a - b]', '[(- a b)]'],
  ['[a-b]', '[(- a b)]'],
  ['[a - b, -a]', '[(- a b) (u- a)]'],
  ['[1 +2]', '[1 (u+ 2)]'],
  ['[f (1)]', '[f (paren 1)]'],
  ['[f(1)]', '[(call f 1)]'],
  ["[a' b']", "[(post' a) (post' b)]"],
  ["[a ' b']", "[a ' b']"],
  ["['x' 'y']", "['x' 'y']"],
  ['[1, 2, 3]', '[1 2 3]'],
  ['[1 2; 3 4]', '[1 2 ; 3 4]'],
  ['[1 2\n3 4]', '[1 2 ; 3 4]'],
  ['[1 2;\n3 4;]', '[1 2 ; 3 4]'],
  ['[1 2 ...\n3]', '[1 2 3]'],
  ['[~a b]', '[(u~ a) b]'],
  ['[a ~= b]', '[(~= a b)]'],
  ['[a(1) -a(2)]', '[(call a 1) (u- (call a 2))]'],
  ['[[1 2]; [3 4]]', '[[1 2] ; [3 4]]'],
  ['[]', '[]'],
  ['[1:3]', '[(range 1 3)]'],
  ['[1:3 5]', '[(range 1 3) 5]'],
  ['[x.y -z]', '[(. x y) (u- z)]'],
];
for (const [src, want] of matrixCases) test(`matriz: ${JSON.stringify(src)}`, () => assert.equal(sx(ex(src)), want));

// ---- literais ---------------------------------------------------------------------------------------
test('números, imaginários e strings', () => {
  const n = (s) => { const e = ex(s); return [e.raw, e.value, e.imaginary]; };
  assert.deepEqual(n('42'), ['42', 42, false]);
  assert.deepEqual(n('.5'), ['.5', 0.5, false]);
  assert.deepEqual(n('5.'), ['5.', 5, false]);
  assert.deepEqual(n('1e-3'), ['1e-3', 0.001, false]);
  assert.deepEqual(n('2.5E+4'), ['2.5E+4', 25000, false]);
  assert.deepEqual(n('3i'), ['3i', 3, true]);
  assert.deepEqual(n('2.5e3j'), ['2.5e3j', 2500, true]);
  assert.deepEqual(n('1j'), ['1j', 1, true]);
  const s1 = ex("'it''s'");
  const s2 = ex('"say ""hi"""');
  assert.deepEqual([s1.type, s1.value, s1.quote], ['String', "it's", "'"]);
  assert.deepEqual([s2.value, s2.quote], ['say "hi"', '"']);
  assert.equal(ex("''").value, '');
});

test('1./x e 2.*x não confundem ponto de número com operador', () => {
  assert.equal(sx(ex('1./x')), '(./ 1 x)');
  assert.equal(sx(ex('2.*x')), '(.* 2 x)');
  assert.equal(sx(ex('5.^2')), '(.^ 5 2)');
});

test('funções anônimas e handles', () => {
  assert.equal(sx(ex('@(x, y) x + y')), '(@ (x y) (+ x y))');
  assert.equal(sx(ex('@() 42')), '(@ () 42)');
  assert.equal(sx(ex('@(~, y) y')), '(@ (~ y) y)');
  assert.equal(sx(ex('@sin')), '@sin');
  assert.equal(sx(ex('f(@(t) sin(t), 0)')), '(call f (@ (t) (call sin t)) 0)');
  assert.equal(ex('@(~, y) y').params[0].ignored, true);
});

// ---- instruções: display e posições ---------------------------------------------------------------------
test('display: ; suprime, vírgula/linha/fim de arquivo exibem; várias instruções por linha', () => {
  const body = ok('a = 1, b = 2; c = 3').body;
  assert.deepEqual(body.map((s) => [s.type, s.display]), [['Assign', true], ['Assign', false], ['Assign', true]]);
  assert.deepEqual(body.map((s) => s.loc.col), [1, 8, 15]);
  assert.deepEqual(ok('x\nx;\ndisp(x)').body.map((s) => s.display), [true, false, true]);
  assert.deepEqual(ok('x = 1;;\ny = 2').body.map((s) => s.display), [false, true]);
  assert.equal(ok('x = 1;').body[0].display, false);
  assert.equal(ok('x = 1').body[0].display, true);
  assert.equal(ok('x = 1 % c').body[0].display, true);
  assert.equal(ok('x = 1; % c').body[0].display, false);
  assert.equal(ok('x = 1  ...\n  + 2;').body[0].display, false);
});

test('loc da instrução inclui o ponto e vírgula e usa fim exclusivo', () => {
  const [a, b] = ok('ab = 1;\n  cd = [1 2\n3 4]').body;
  assert.deepEqual(a.loc, { line: 1, col: 1, endLine: 1, endCol: 8, start: 0, end: 7 });
  assert.deepEqual([b.loc.line, b.loc.col, b.loc.endLine, b.loc.endCol], [2, 3, 3, 5]);
  assert.deepEqual(b.value.loc.line, 2);
});

test('loc do Program cobre o arquivo', () => {
  const src = 'a = 1\nb = 2\n';
  const { ast } = parse(src);
  assert.deepEqual(ast.loc, { line: 1, col: 1, endLine: 3, endCol: 1, start: 0, end: src.length });
});

test('seções viram nós Section com título', () => {
  const body = ok('%% INITIAL_SCRIPT\na = 1;\n%% NETLIST\n%%\nb = 2;').body;
  assert.deepEqual(body.map((s) => s.type), ['Section', 'Assign', 'Section', 'Section', 'Assign']);
  assert.deepEqual(body.filter((s) => s.type === 'Section').map((s) => s.title), ['INITIAL_SCRIPT', 'NETLIST', '']);
  assert.equal(body[0].loc.line, 1);
});

test('comentário de bloco e continuação não geram nós', () => {
  const ast = ok('a = 1;\n%{\nb = 2\n%}\nc = 1 + ...\n 2;');
  assert.equal(ast.body.length, 2);
  assert.equal(sx(ast.body[1].value), '(+ 1 2)');
});

// ---- atribuição ----------------------------------------------------------------------------------------------
test('atribuições simples, indexadas, com campo e múltiplas', () => {
  const a = ok('x(end+1) = 5;\ns.v(2) = 3;\n[q, r] = f(1)\n[~, i] = max(v);\n[a b] = size(X);\n[x(1), y.z] = g();').body;
  assert.deepEqual(a.map((s) => [s.type, s.bracket, s.targets.length]), [
    ['Assign', false, 1], ['Assign', false, 1], ['Assign', true, 2], ['Assign', true, 2], ['Assign', true, 2], ['Assign', true, 2]]);
  assert.equal(sx(a[0].targets[0]), '(call x (+ end 1))');
  assert.equal(sx(a[1].targets[0]), '(call (. s v) 2)');
  assert.equal(sx(a[3].targets), '~ i');
  assert.equal(a[3].targets[0].type, 'Ignore');
  assert.equal(a[2].display, true);
  assert.equal(a[3].display, false);
  assert.equal(sx(a[5].targets), '(call x 1) (. y z)');
});

test('x(2) = [] guarda a matriz vazia como valor', () => {
  assert.equal(sx(ok('x(2) = [];').body[0].value), '[]');
});

test('o parser aceita mais de duas dimensões (o erro é semântico)', () => {
  assert.equal(sx(ex('X(1, 2, 3, 4)')), '(call X 1 2 3 4)');
});

// ---- declarações ----------------------------------------------------------------------------------------------
test('declaração com lista e inicialização', () => {
  const d = ok('real x = 0, y = 1, z').body[0];
  assert.deepEqual([d.type, d.typeName, d.varsize, d.display], ['Decl', 'real', false, true]);
  assert.deepEqual(d.declarators.map((x) => [x.name, x.init && sx(x.init)]), [['x', '0'], ['y', '1'], ['z', null]]);
});

test('declaração sem inicialização aceita espaços', () => {
  const d = ok('real x y z;').body[0];
  assert.equal(d.type, 'Decl');
  assert.deepEqual(d.declarators.map((x) => x.name), ['x', 'y', 'z']);
  assert.equal(d.display, false);
  assert.deepEqual(ok('int i, j, k').body[0].declarators.map((x) => x.name), ['i', 'j', 'k']);
});

test('todas as palavras de tipo e varsize', () => {
  for (const t of ['int', 'real', 'complex', 'bool', 'char', 'sys']) {
    const d = ok(`${t} v = 1`).body[0];
    assert.deepEqual([d.type, d.typeName], ['Decl', t]);
  }
  const v = ok('varsize real y = zeros(1, 10)').body[0];
  assert.deepEqual([v.varsize, v.typeName, v.declarators[0].name], [true, 'real', 'y']);
  assert.equal(ok('varsize int c = 0, t').body[0].declarators.length, 2);
});

test('declaração não confunde com chamada, atribuição ou função', () => {
  const kinds = (src) => ok(src).body.map((s) => s.type).join(',');
  assert.equal(kinds('real(z)'), 'ExprStmt');
  assert.equal(kinds('y = real(z)'), 'Assign');
  assert.equal(kinds('real = 3'), 'Assign');
  assert.equal(kinds('complex(1, 2)'), 'ExprStmt');
  assert.equal(kinds('imag(z);'), 'ExprStmt');
  assert.equal(kinds('char(65)'), 'ExprStmt');
  assert.equal(kinds('int = 5; bool = true'), 'Assign,Assign');
  assert.equal(kinds('x = [real(z) imag(z)]'), 'Assign');
  assert.equal(kinds('varsize = 3'), 'Assign');
});

test('na declaração a vírgula separa declaradores; instruções são separadas por ; ou linha', () => {
  const body = ok('real x = 1, y = 2; z = 3').body;
  assert.deepEqual(body.map((s) => s.type), ['Decl', 'Assign']);
  assert.equal(body[0].declarators.length, 2);
  assert.equal(ok('sys P = ss(A, B, C, D)').body[0].declarators[0].name, 'P');
});

// ---- controle de fluxo -----------------------------------------------------------------------------------------
test('if/elseif/else', () => {
  const s = ok('if a\n x = 1;\nelseif b\n x = 2;\nelseif c, x = 3, else x = 4, end').body[0];
  assert.equal(s.type, 'If');
  assert.equal(s.body.length, 1);
  assert.equal(s.elseifs.length, 2);
  assert.equal(s.elseBody.length, 1);
  assert.equal(sx(s.elseifs[1].condition), 'c');
  assert.equal(ok('if (x == 1) y = 2; end').body[0].body.length, 1);
});

test('for, while, break, continue, return', () => {
  const f = ok('for k = 1:2:10\n s = s + k;\nend').body[0];
  assert.deepEqual([f.type, f.variable.name, sx(f.iterable)], ['For', 'k', '(range 1 2 10)']);
  assert.equal(sx(ok('for (k = 1:3), end').body[0].iterable), '(range 1 3)');
  const w = ok('while k > 0\n if k == 3, break, end\n continue;\n return\nend').body[0];
  assert.equal(w.type, 'While');
  assert.deepEqual(w.body.map((s) => s.type), ['If', 'Continue', 'Return']);
  assert.equal(w.body[0].body[0].type, 'Break');
});

test('switch com case simples, string, lista e otherwise', () => {
  const s = ok("switch n\n case 1\n a = 1;\n case 'x'\n a = 2;\n case {3, 4 5}\n a = 3;\n otherwise\n a = 0;\nend").body[0];
  assert.equal(s.type, 'Switch');
  assert.deepEqual(s.cases.map((c) => [c.cell, sx(c.values)]), [[false, '1'], [false, "'x'"], [true, '3 4 5']]);
  assert.equal(s.otherwise.body.length, 1);
});

test('blocos aninhados e fechados por end', () => {
  const s = ok('for i = 1:3\n for j = 1:3\n if i == j, x(i, j) = 1; else, x(i, j) = 0; end\n end\nend').body[0];
  assert.equal(s.body[0].body[0].type, 'If');
});

// ---- funções -----------------------------------------------------------------------------------------------------
test('funções locais, múltiplas saídas e bloco arguments', () => {
  const src = [
    'y = f(1);',
    'function [s, p] = somaprod(a, b, ~)',
    '  s = a + b; p = a * b;',
    'end',
    'function y = f(x)',
    '  arguments',
    '    x (1,:) double {mustBeReal, mustBePositive} = 10',
    '    n (1,1) double',
    '    opts.nome char = "a"',
    '  end',
    '  y = x;',
    'end',
    'function g',
    'end',
  ].join('\n');
  const ast = ok(src);
  assert.equal(ast.body.length, 1);
  assert.deepEqual(ast.functions.map((f) => f.name), ['somaprod', 'f', 'g']);
  const [sp, f, g] = ast.functions;
  assert.deepEqual(sp.outputs.map((o) => o.name), ['s', 'p']);
  assert.deepEqual(sp.params.map((p) => [p.name, p.ignored]), [['a', false], ['b', false], ['~', true]]);
  assert.equal(sp.body.length, 2);
  assert.deepEqual(f.outputs.map((o) => o.name), ['y']);
  assert.deepEqual([g.outputs.length, g.params.length], [0, 0]);
  const entries = f.argumentBlocks[0].entries;
  assert.deepEqual(entries.map((e) => e.name), ['x', 'n', 'opts.nome']);
  assert.equal(sx(entries[0].dims), '1 :');
  assert.equal(entries[0].className, 'double');
  assert.equal(sx(entries[0].validators), 'mustBeReal mustBePositive');
  assert.equal(sx(entries[0].defaultValue), '10');
  assert.equal(entries[1].defaultValue, null);
  assert.equal(entries[2].className, 'char');
  assert.equal(f.body.length, 1);
});

test('uma variável chamada arguments continua sendo variável', () => {
  assert.equal(ok('arguments = 3;').body[0].type, 'Assign');
  assert.equal(ok('arguments(1) = 3;').body[0].type, 'Assign');
});

// ---- erros ---------------------------------------------------------------------------------------------------------
const err1 = (src, opts) => {
  const r = parse(src, opts);
  assert.ok(r.errors.length > 0, `esperava erro em: ${JSON.stringify(src)}`);
  const e = r.errors[0];
  return [e.code, e.loc.line, e.loc.col];
};

const errorCases = [
  // [fonte, código, linha, coluna]
  ['hold on', 'commandSyntax', 1, 1],
  ['x = 1\nformat long', 'commandSyntax', 2, 1],
  ['clear all;', 'commandSyntax', 1, 1],
  ["hold 'on'", 'expectedStatementEnd', 1, 7],
  ['real 3', 'commandSyntax', 1, 1],
  ['model = 3', 'reservedWord', 1, 1],
  ['classdef = 1', 'reservedWord', 1, 1],
  ['classdef Foo', 'reservedWord', 1, 1],
  ['try\nx = 1\ncatch\nend', 'unsupportedKeyword', 1, 1],
  ['global g', 'unsupportedKeyword', 1, 1],
  ['persistent p', 'unsupportedKeyword', 1, 1],
  ['parfor k = 1:3\nend', 'unsupportedKeyword', 1, 1],
  ['c = {1, 2}', 'cellNotSupported', 1, 5],
  ['c{1}', 'cellNotSupported', 1, 2],
  ['x = 1 +', 'unexpectedToken', 1, 8],
  ['x = (1 + 2', 'unexpectedToken', 1, 11],
  ['x = (1]', 'unexpectedToken', 1, 7],
  ['x = [1 2', 'unclosedBracket', 1, 5],
  ['if x\n y = 1\n', 'missingEnd', 1, 1],
  ['for k = 1:3\n y = 1\n', 'missingEnd', 1, 1],
  ['while 1\n', 'missingEnd', 1, 1],
  ['switch x\n case 1\n', 'missingEnd', 1, 1],
  ['end', 'strayKeyword', 1, 1],
  ['else', 'strayKeyword', 1, 1],
  ['x = 1\ncase 2', 'strayKeyword', 2, 1],
  ['x = 5 y = 6', 'expectedStatementEnd', 1, 7],
  ['x = a b', 'expectedStatementEnd', 1, 7],
  ['x = [1 2]]', 'expectedStatementEnd', 1, 10],
  ['1 = 2', 'invalidAssignTarget', 1, 1],
  ['a + b = 3', 'invalidAssignTarget', 1, 1],
  ["'abc' = 1", 'invalidAssignTarget', 1, 1],
  ['[a, 1] = f()', 'invalidAssignTarget', 1, 5],
  ['x = end', 'endOutsideIndex', 1, 5],
  ['if x\nfunction f()\nend\nend', 'functionInBlock', 2, 1],
  ['function f()\nfunction g()\nend\nend', 'nestedFunction', 2, 1],
  ['function f()\nend\nx = 1', 'statementAfterFunction', 3, 1],
  ['function f()\nx = 1', 'missingEnd', 1, 1],
  ['x = 1;\ny = a.(b)', 'dynamicFieldNotSupported', 2, 6],
  ['real x, 3', 'declExpectedName', 1, 9],
  ['for k 1:3\nend', 'unexpectedToken', 1, 7],
  ['x(1,) = 2', 'unexpectedToken', 1, 5],
  ['y = f(1 2)', 'unexpectedToken', 1, 9],
  ['switch x\nfoo\nend', 'unexpectedToken', 2, 1],
  ['f = @', 'unexpectedToken', 1, 6],
  ['x = 1:', 'unexpectedToken', 1, 7],
  ['x = ;', 'unexpectedToken', 1, 5],
  ['x = 1x', 'invalidNumber', 1, 5],
  ['x = $', 'unexpectedChar', 1, 5],
  ["x = 'abc", 'unterminatedString', 1, 5],
  ['%{\nabc', 'unterminatedBlockComment', 1, 1],
  // Sintaxe exclusiva do Octave (regra confirmada)
  ['# comentario', 'octaveComment', 1, 1],
  ['x = 1 # c', 'octaveComment', 1, 7],
  ['if x\n y = 1\nendif', 'octaveEnd', 3, 1],
  ['for k = 1:2\nendfor', 'octaveEnd', 2, 1],
  ['while 1\nendwhile', 'octaveEnd', 2, 1],
  ['function f()\nendfunction', 'octaveEnd', 2, 1],
  ['a != b', 'octaveNotEqual', 1, 3],
  ['x = !a', 'octaveNot', 1, 5],
  ['a += 1', 'octaveCompoundAssign', 1, 3],
  ['a++', 'octaveIncrement', 1, 2],
  ['printf("x")', 'octavePrintf', 1, 1],
];
for (const [src, code, line, col] of errorCases) {
  test(`erro ${code} em ${JSON.stringify(src)}`, () => assert.deepEqual(err1(src), [code, line, col]));
}

test('só classdef e model são reservadas; as demais palavras de modelagem são nomes comuns', () => {
  for (const w of ['classdef', 'model']) {
    const r = parse(`${w} = 1`);
    assert.equal(r.errors[0].code, 'reservedWord', w);
    assert.match(r.errors[0].message, /reservada/);
    assert.equal(r.errors[0].params.word, w);
  }
  for (const w of ['try', 'catch', 'global', 'persistent', 'parfor']) {
    assert.equal(parse(`${w} = 1`).errors[0].code, 'unsupportedKeyword', w);
  }
  const body = ok('state = 1\nnext = state + 1\nblock(2)\nder = 3\nport = 1; parameter = 2;\nfunction r = port2(state)\n r = state;\nend').body;
  assert.deepEqual(body.map((s) => s.type), ['Assign', 'Assign', 'ExprStmt', 'Assign', 'Assign', 'Assign']);
  assert.equal(sx(body[1].value), '(+ state 1)');
  assert.equal(sx(body[2].expression), '(call block 2)');
});

test('transposta com espaço fora de colchetes; string dentro de colchetes', () => {
  assert.equal(sx(ex("a '")), "(post' a)");
  assert.equal(sx(ex("a ' * b '")), "(* (post' a) (post' b))");
  assert.equal(sx(ex("f(a ')")), "(call f (post' a))");
  assert.equal(sx(ex("[a 'b']")), "[a 'b']");
  assert.equal(sx(ex("[a' b']")), "[(post' a) (post' b)]");
  assert.equal(sx(ok("x = a ';").body[0].value), "(post' a)");
});

test('mensagens em pt-BR geradas a partir do código; params estáveis', () => {
  const e = parse('hold on').errors[0];
  assert.deepEqual(e.params, { name: 'hold', args: ['on'], suggestion: 'hold("on")' });
  assert.match(e.message, /hold\("on"\)/);
  assert.match(parse('a != b').errors[0].message, /~=/);
  assert.match(parse('x = 1 +\n').errors[0].message, /fim da linha/);
  assert.match(parse('x = (1\n').errors[0].message, /'\)'/);
  assert.deepEqual(parse('format long g').errors[0].params.args, ['long', 'g']);
});

test('a regra Octave pode ser desligada sem afetar o resto', () => {
  assert.equal(err1('a != b', { octave: false })[0], 'unexpectedChar');
  assert.equal(parse('x = 1 +\n').errors[0].code, 'unexpectedToken');
});

test('recuperação: vários erros e instruções válidas preservadas', () => {
  const r = parse('a = 1 +\nb = 2;\nc = 3 *\nd = 4;');
  assert.deepEqual(r.errors.map((e) => [e.code, e.loc.line]), [['unexpectedToken', 1], ['unexpectedToken', 3]]);
  assert.deepEqual(r.ast.body.map((s) => s.targets[0].name), ['b', 'd']);
  assert.equal(r.ok, false);
});

test('erro dentro de bloco não derruba o resto do bloco', () => {
  const r = parse('if x\n y = 1 +\n z = 2;\nend\nw = 3;');
  assert.equal(r.errors.length, 1);
  assert.equal(r.ast.body[0].body.length, 1);
  assert.equal(r.ast.body[1].targets[0].name, 'w');
});

test('erros têm code, params, loc e message', () => {
  const e = parse('x = (').errors[0];
  assert.deepEqual(Object.keys(e), ['code', 'params', 'loc', 'message']);
  assert.deepEqual(Object.keys(e.loc), ['line', 'col', 'endLine', 'endCol', 'start', 'end']);
});

// ---- desempenho --------------------------------------------------------------------------------------------------------
test('desempenho: ~10.000 linhas', () => {
  const block = [
    '% bloco de teste',
    'R = 10e3; C = 100e-6; tau = R * C;',
    'A = [1 2 3; 4 5 6; 7 8 9];',
    'for k = 1:100',
    '    x(k) = sin(2*pi*k/100) + 0.5*cos(k)^2;',
    "    if x(k) > 0.5 && k ~= 3, y = x(k)'; else, y = -x(k); end",
    'end',
    'real v = zeros(1, 10), w = 1;',
    '[q, r] = size(A(2:end, :));',
    "s = sprintf('%d', numel(A)); t = @(u) u.^2 + 1;",
  ];
  const lines = [];
  while (lines.length < 10000) lines.push(...block);
  const src = `${lines.slice(0, 10000).join('\n')}\n`;
  const times = [];
  let last;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    last = parse(src);
    times.push(performance.now() - t0);
  }
  assert.deepEqual(last.errors, []);
  times.sort((a, b) => a - b);
  console.log(`# parse de ${src.split('\n').length - 1} linhas: mediana ${times[2].toFixed(1)} ms (min ${times[0].toFixed(1)}, max ${times[4].toFixed(1)})`);
  assert.ok(times[2] < 1000, `parse lento: ${times[2]} ms`);
});
