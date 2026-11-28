import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatIndentation, lowerMedian } from '../assets/js/script/format.js';
import { parse } from '../assets/js/script/parser.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const corpusDir = `${here}script-studio/corpus/`;

const fmt = (src, opts) => formatIndentation(src, opts);
const text = (src, opts) => {
  const r = fmt(src, opts);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.text;
};
const L = (...lines) => `${lines.join('\n')}\n`;
const stripLoc = (ast) => JSON.stringify(ast, (k, v) => (k === 'loc' ? undefined : v));
const dedent = (s) => s.split(/\n/).map((l) => l.replace(/^[ \t]+/, '').replace(/[ \t]+$/, ''));

test('exemplo 1: if com corpo em 6, 6 e 2 vira 6, 6, 6', () => {
  const r = fmt(L('if x > 0', '      a = 1;', '      b = 2;', '  c = 3;', 'end'));
  assert.equal(r.text, L('if x > 0', '      a = 1;', '      b = 2;', '      c = 3;', 'end'));
  assert.deepEqual(r.edits, [{ line: 4, oldIndent: '  ', newIndent: '      ' }]);
  assert.equal(r.changedLines, 1);
});

test('exemplo 2: for com corpo na margem vai para 4', () => {
  assert.equal(text(L('for i = 1:3', 'x = i;', 'y = x;', 'end')), L('for i = 1:3', '    x = i;', '    y = x;', 'end'));
});

test('mediana com número par de linhas usa a inferior', () => {
  assert.equal(lowerMedian([8, 6]), 6);
  assert.equal(lowerMedian([4, 10, 6, 8]), 6);
  assert.equal(lowerMedian([]), null);
  assert.equal(text(L('if x', '        a = 1;', '      b = 2;', 'end')), L('if x', '      a = 1;', '      b = 2;', 'end'));
  // nunca abaixo do mínimo: mediana inferior 2 < 4
  assert.equal(text(L('if x', '  a = 1;', '      b = 2;', 'end')), L('if x', '    a = 1;', '    b = 2;', 'end'));
});

test('aninhamento: if dentro de for dentro de function', () => {
  const src = L('x = 1;', 'function f(n)', 'for k = 1:n', 'if k > 1', 'disp(k)', 'end', 'end', 'end');
  assert.equal(text(src), L('x = 1;', 'function f(n)', '    for k = 1:n', '        if k > 1', '            disp(k)', '        end', '    end', 'end'));
});

test('aninhamento usa o alvo já corrigido do pai', () => {
  const src = L('for k = 1:3', '      if k', ' a = 1;', ' end', '      b = 2;', 'end');
  // corpo do for em 6; o if, já em 6, tem corpo com mínimo 6 + 4 = 10
  assert.equal(text(src), L('for k = 1:3', '      if k', '          a = 1;', '      end', '      b = 2;', 'end'));
});

test('switch/case/otherwise', () => {
  const src = L('switch x', 'case 1', 'a = 1;', 'case {2, 3}', 'a = 2;', 'otherwise', 'a = 0;', 'end');
  assert.equal(text(src), L('switch x', '    case 1', '        a = 1;', '    case {2, 3}', '        a = 2;', '    otherwise', '        a = 0;', 'end'));
});

test('elseif e else alinhados com o if', () => {
  const src = L('  if a', 'x = 1;', '       elseif b', '   x = 2;', 'else', 'x = 3;', '   end');
  assert.equal(text(src), L('if a', '    x = 1;', 'elseif b', '    x = 2;', 'else', '    x = 3;', 'end'));
});

test('bloco arguments e function', () => {
  const src = L('function r = g(a, b)', 'arguments', 'a double', 'b (1,1) double = 2', 'end', 'r = a + b;', 'end');
  assert.equal(text(src), L('function r = g(a, b)', '    arguments', '        a double', '        b (1,1) double = 2', '    end', '    r = a + b;', 'end'));
});

test('function vai para a margem', () => {
  assert.equal(text(L('x = 1;', '    function f()', 'y = 2;', '    end')), L('x = 1;', 'function f()', '    y = 2;', 'end'));
});

test('continuação com ... mantém a distância relativa', () => {
  const src = L('if a', '  x = 1 + ...', '        2 + ...', '    3;', 'end');
  assert.equal(text(src), L('if a', '    x = 1 + ...', '          2 + ...', '      3;', 'end'));
});

test('matriz em várias linhas anda junto com a primeira linha', () => {
  const src = L('for i = 1:2', 'A = [1 2 3;', '     4 5 6;', '     7 8 9];', 'end');
  assert.equal(text(src), L('for i = 1:2', '    A = [1 2 3;', '         4 5 6;', '         7 8 9];', 'end'));
});

test('continuação nunca fica com indentação negativa', () => {
  const src = L('if a', '    y = 0;', '    z = 0;', '          x = [1 2', ' 3 4];', 'end');
  assert.equal(text(src), L('if a', '    y = 0;', '    z = 0;', '    x = [1 2', '3 4];', 'end'));
});

test('comentário em bloco não é tocado', () => {
  const src = L('if a', '      %{', '   texto   ', '  %}', 'x = 1;', 'end');
  assert.equal(text(src), L('if a', '      %{', '   texto   ', '  %}', '    x = 1;', 'end'));
});

test('comentários de linha seguem o bloco; %% fica na margem', () => {
  const src = L('    %% Seção', '      % topo', 'for i = 1:2', '% dentro', 'x = i;', '        % fim', 'end', '  % depois');
  assert.equal(text(src), L('%% Seção', '% topo', 'for i = 1:2', '    % dentro', '    x = i;', '    % fim', 'end', '% depois'));
});

test('linhas em branco ficam vazias; texto após a indentação não muda', () => {
  const src = 'if a\n    \n  x = 1;   \n\t\nend\n';
  assert.equal(text(src), 'if a\n\n    x = 1;   \n\nend\n');
});

test('tabulações na indentação viram espaços', () => {
  assert.equal(text('for i = 1:2\n\tx = i;\n\t\ty = 1;\nend\n', { tabSize: 4 }), L('for i = 1:2', '    x = i;', '    y = 1;', 'end'));
  assert.equal(text('for i = 1:2\n\tx = i;\nend\n', { tabSize: 2 }), L('for i = 1:2', '    x = i;', 'end'));
  assert.equal(text('for i = 1:2\n\t\tx = i;\nend\n', { tabSize: 2 }), L('for i = 1:2', '    x = i;', 'end'));
});

test('indentUnit configurável', () => {
  assert.equal(text(L('if a', 'x = 1;', 'end'), { indentUnit: 2 }), L('if a', '  x = 1;', 'end'));
  assert.equal(text(L('if a', 'x = 1;', 'end'), { indentUnit: '  ' }), L('if a', '  x = 1;', 'end'));
});

test('CRLF é preservado', () => {
  const r = fmt('if a\r\nx = 1;\r\n\r\nend\r\n');
  assert.equal(r.text, 'if a\r\n    x = 1;\r\n\r\nend\r\n');
});

test('script com erro de sintaxe não é reformatado', () => {
  const src = 'if a\n  x = 1;\n';
  const r = fmt(src);
  assert.equal(r.ok, false);
  assert.equal(r.text, src);
  assert.deepEqual(r.edits, []);
  assert.equal(r.changedLines, 0);
  assert.ok(r.errors.length > 0);
});

test('entrada vazia e sem quebra final', () => {
  assert.equal(text(''), '');
  assert.equal(text('  x = 1;'), 'x = 1;');
});

// ---- garantias sobre o corpus -----------------------------------------------------------
const corpus = readdirSync(corpusDir).filter((f) => f.endsWith('.m')).sort();

test('corpus tem os 56 scripts', () => {
  assert.equal(corpus.length, 56);
});

for (const file of corpus) {
  test(`garantias do formatador: ${file}`, () => {
    const src = readFileSync(corpusDir + file, 'utf8');
    const r = fmt(src);
    assert.equal(r.ok, true);
    // mesmo número de linhas e conteúdo sem indentação idêntico
    const a = src.split('\n');
    const b = r.text.split('\n');
    assert.equal(b.length, a.length);
    const inBlock = (() => { let d = 0; return (s) => { const t = s.trim(); if (d) { if (t === '%{') d++; else if (t === '%}') d--; return true; } if (t === '%{') { d = 1; return true; } return false; }; })();
    for (let i = 0; i < a.length; i++) {
      if (inBlock(a[i])) assert.equal(b[i], a[i], `linha ${i + 1} (comentário em bloco)`);
      else assert.equal(b[i].replace(/^[ \t]+/, ''), a[i].replace(/^[ \t]+/, '').replace(/^$/, ''), `linha ${i + 1}`);
    }
    assert.deepEqual(dedent(r.text).length, dedent(src).length);
    // idempotência
    const r2 = fmt(r.text);
    assert.equal(r2.text, r.text);
    assert.deepEqual(r2.edits, []);
    // AST equivalente (sem posições)
    const p0 = parse(src);
    const p1 = parse(r.text);
    assert.equal(p1.ok, true);
    assert.equal(stripLoc(p1.ast), stripLoc(p0.ast));
  });
}
