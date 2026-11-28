// Formatador de indentação do Script Studio (em desenvolvimento).
// Módulo ESM puro, sem DOM. Regras: docs/SCRIPT-GRAMMAR.md, seção "Formatador de indentação".
//
// formatIndentation(source, options) -> { text, edits, changedLines, ok, errors }
//  - edits: [{line, oldIndent, newIndent}] (line 1-based; indentações como texto)
//  - changedLines: número de linhas alteradas (edits.length)
// Só mexe nos espaços/tabulações no começo de cada linha (e nos espaços de linhas em branco).

import { parse, tokenize } from './parser.js';
import { walk } from './ast.js';

const DEFAULT_UNIT = 4;
const DEFAULT_TAB = 4;

// Largura de uma indentação (espaços e tabulações) em colunas, com paradas de tabulação.
function widthOf(indent, tabSize) {
  let w = 0;
  for (const c of indent) w = c === '\t' ? (Math.floor(w / tabSize) + 1) * tabSize : w + 1;
  return w;
}

function toWidth(value, fallback, tabSize) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  if (typeof value === 'string') return widthOf(value, tabSize);
  return fallback;
}

// Mediana inferior: com número par de valores, o menor dos dois centrais.
export function lowerMedian(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
}

function splitLines(source) {
  const lines = [];
  const re = /\r\n|\n/g;
  let last = 0;
  let m;
  while ((m = re.exec(source))) {
    lines.push({ text: source.slice(last, m.index), eol: m[0] });
    last = m.index + m[0].length;
  }
  lines.push({ text: source.slice(last), eol: '' });
  return lines;
}

const OPEN = new Set(['[', '(', '{']);
const CLOSE = new Set([']', ')', '}']);
const BODY_KW = new Set(['if', 'for', 'while', 'function']);

export function formatIndentation(source, options = {}) {
  const tabSize = toWidth(options.tabSize, DEFAULT_TAB, DEFAULT_TAB) || DEFAULT_TAB;
  const unit = toWidth(options.indentUnit, DEFAULT_UNIT, tabSize);

  const { ast, errors, ok } = parse(source);
  if (!ok) return { text: source, edits: [], changedLines: 0, ok: false, errors };

  const argStarts = new Set();
  walk(ast, (n) => { if (n.type === 'ArgumentsBlock') argStarts.add(n.loc.start); });

  const { tokens } = tokenize(source);
  const lines = splitLines(source);
  const starts = [];
  let off = 0;
  for (const l of lines) { starts.push(off); off += l.text.length + l.eol.length; }

  // Tokens reais agrupados por linha.
  const byLine = lines.map(() => []);
  {
    let li = 0;
    for (const t of tokens) {
      if (t.type === 'nl' || t.type === 'eof' || t.virtual) continue;
      while (li + 1 < lines.length && starts[li + 1] <= t.start) li++;
      byLine[li].push(t);
    }
  }

  // ---- estrutura de blocos ------------------------------------------------------------
  const blocks = [];
  const newBlock = (parent) => { const b = { parent, stmts: [], target: 0 }; blocks.push(b); return b; };
  const root = newBlock(null);
  let cur = root;
  const stack = []; // construtos abertos: {kind, container, caseLevel}
  let depth = 0;

  const recs = new Array(lines.length).fill(null); // por linha: {block, count, oldW} | {anchor} | null
  const oldW = new Array(lines.length).fill(0);
  const contAfter = new Array(lines.length).fill(false);
  let anchor = -1;
  let inBlockComment = 0;

  const top = () => stack[stack.length - 1];

  // Efeito de uma palavra de controle sobre a pilha; devolve o registro de alinhamento da linha
  // quando a palavra é a primeira da linha.
  function keyword(t, first, li) {
    const v = t.value;
    let rec = null;
    const stmt = (block) => ({ block, count: true });
    const align = (block) => ({ block, count: false });
    if (t.type === 'ident' && argStarts.has(t.start)) {
      if (first) rec = stmt(cur);
      stack.push({ kind: 'arguments', container: cur, caseLevel: null });
      cur = newBlock(cur);
    } else if (t.type !== 'kw' || t.inBracket) {
      return first ? stmt(cur) : null;
    } else if (v === 'switch') {
      if (first) rec = stmt(cur);
      const c = { kind: 'switch', container: cur, caseLevel: newBlock(cur) };
      stack.push(c);
      cur = c.caseLevel;
    } else if (BODY_KW.has(v)) {
      if (first) rec = stmt(cur);
      stack.push({ kind: v, container: cur, caseLevel: null });
      cur = newBlock(cur);
    } else if (v === 'elseif' || v === 'else') {
      const c = top();
      if (c && c.kind === 'if') {
        if (first) rec = align(c.container);
        cur = newBlock(c.container);
      } else if (first) rec = stmt(cur);
    } else if (v === 'case' || v === 'otherwise') {
      const c = top();
      if (c && c.kind === 'switch') {
        if (first) rec = stmt(c.caseLevel);
        cur = newBlock(c.caseLevel);
      } else if (first) rec = stmt(cur);
    } else if (v === 'end') {
      const c = stack.pop();
      if (c) {
        if (first) rec = align(c.container);
        cur = c.container;
      } else if (first) rec = stmt(cur);
    } else if (first) rec = stmt(cur);
    return rec;
  }

  for (let li = 0; li < lines.length; li++) {
    const { text } = lines[li];
    const trimmed = text.trim();

    // Comentário em bloco: não é tocado.
    if (inBlockComment) {
      if (trimmed === '%{') inBlockComment++;
      else if (trimmed === '%}') inBlockComment--;
      continue;
    }
    const contBefore = li > 0 && contAfter[li - 1];
    if (trimmed === '%{' && !contBefore) { inBlockComment = 1; continue; }

    const indent = /^[ \t]*/.exec(text)[0];
    const rest = text.slice(indent.length);
    oldW[li] = widthOf(indent, tabSize);
    const toks = byLine[li];

    // `...` ao fim da linha (depois do último token): a próxima linha é continuação.
    {
      const lineEnd = starts[li] + text.length;
      const afterTok = toks.length ? toks[toks.length - 1].end : starts[li];
      contAfter[li] = source.slice(afterTok, lineEnd).trim().startsWith('...');
    }

    const blank = rest === '';
    const inner = contBefore || depth > 0;
    if (blank) recs[li] = { blank: true };
    else if (inner) recs[li] = { anchor };
    else if (rest[0] === '%') recs[li] = { block: cur, count: false };
    else if (toks.length) {
      anchor = li;
      recs[li] = null; // definido pelo primeiro token abaixo
    }

    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      const first = k === 0 && !blank && !inner && rest[0] !== '%';
      if (t.type === 'op' && !t.virtual) {
        if (OPEN.has(t.value)) depth++;
        else if (CLOSE.has(t.value)) depth = Math.max(0, depth - 1);
        if (first) recs[li] = { block: cur, count: true };
        continue;
      }
      const rec = keyword(t, first, li);
      if (first) recs[li] = rec || { block: cur, count: true };
    }
    if (recs[li] && recs[li].block && recs[li].count) recs[li].block.stmts.push(oldW[li]);
  }

  // ---- alvos dos blocos (pais antes dos filhos) ------------------------------------------
  root.target = 0;
  for (const b of blocks) {
    if (!b.parent) continue;
    const min = b.parent.target + unit;
    const med = lowerMedian(b.stmts);
    b.target = med === null ? min : Math.max(min, med);
  }

  // ---- aplicação ---------------------------------------------------------------------
  const edits = [];
  const out = [];
  const newW = oldW.slice();
  for (let li = 0; li < lines.length; li++) {
    const { text, eol } = lines[li];
    const rec = recs[li];
    if (!rec) { out.push(text + eol); continue; }
    const indent = /^[ \t]*/.exec(text)[0];
    let line;
    let newIndent;
    if (rec.blank) {
      newIndent = '';
      line = '';
    } else {
      if (rec.block) newW[li] = rec.block.target;
      else newW[li] = Math.max(0, oldW[li] + (rec.anchor >= 0 ? newW[rec.anchor] - oldW[rec.anchor] : 0));
      newIndent = ' '.repeat(newW[li]);
      line = newIndent + text.slice(indent.length);
    }
    if (newIndent !== indent) edits.push({ line: li + 1, oldIndent: indent, newIndent });
    out.push(line + eol);
  }
  return { text: out.join(''), edits, changedLines: edits.length, ok: true, errors: [] };
}
