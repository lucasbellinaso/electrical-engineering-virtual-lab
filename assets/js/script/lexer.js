// Lexer do Script Studio (fase 1). Módulo ESM puro, sem DOM e sem dependências.
// Referência: docs/SCRIPT-STUDIO.md seção 8 e docs/SCRIPT-GRAMMAR.md.
//
// Decisões do lexer que o parser pressupõe:
//  - Dentro de [...] e {...} o lexer insere vírgulas e ponto e vírgula "virtuais"
//    (token op com `virtual: true`): espaço entre dois elementos vira ',' e quebra
//    de linha vira ';' (regra do MATLAB para literais de matriz).
//  - `'` é transposta após identificador, número, string, ')', ']', '}', `'`, `.'` ou `end` de
//    índice, como no MATLAB (mesmo com espaços antes); dentro de [...] e {...} o espaço antes
//    de `'` abre string e, sem espaço, é transposta.
//  - Posições: line/col 1-based; col conta unidades de código UTF-16; end é exclusivo.

import { makeError } from './errors.js';

export const MATLAB_KEYWORDS = new Set([
  'break', 'case', 'catch', 'classdef', 'continue', 'else', 'elseif', 'end', 'for', 'function',
  'global', 'if', 'otherwise', 'parfor', 'persistent', 'return', 'spmd', 'switch', 'try', 'while',
]);
// Reservadas para a futura linguagem de modelagem. `state`, `next`, `block`, `port`, `parameter` e `der`
// são identificadores comuns; no futuro serão palavras-chave contextuais só dentro de um bloco `model`.
export const FUTURE_RESERVED = new Set(['classdef', 'model']);
// Existem no MATLAB, mas não na v1.
export const UNSUPPORTED_V1 = new Set(['try', 'catch', 'global', 'persistent', 'parfor', 'spmd']);
export const KEYWORDS = new Set([...MATLAB_KEYWORDS, ...FUTURE_RESERVED]);
// Palavras de declaração: só valem no início da instrução, seguidas de identificador.
export const DECL_TYPES = new Set(['int', 'real', 'complex', 'bool', 'char', 'sys']);

// ---- REGRA OCTAVE (confirmada pelo autor) ------------------------------------------
// Toda a detecção de sintaxe exclusiva do Octave está neste bloco e em `octaveStep`.
// Para desligar: tokenize(src, {octave: false}) ou apague `octaveStep`.
export const OCTAVE_END_WORDS = new Set(['endif', 'endfor', 'endwhile', 'endfunction', 'endswitch', 'end_try_catch', 'endparfor']);
// -----------------------------------------------------------------------------------

const VALUE_END_OPS = new Set([')', ']', '}', "'", ".'"]);
const TWO_OPS = new Set(['==', '~=', '<=', '>=', '&&', '||', '.*', './', '.\\', '.^']);
const ONE_OPS = new Set(['+', '-', '*', '/', '\\', '^', '<', '>', '&', '|', '~', '(', ')', '[', ']', '{', '}', ',', ';', ':', '=', '@', '.']);

// ---- LETRAS GREGAS EM IDENTIFICADORES (docs/SCRIPT-STUDIO.md, seção 8) -------------
// Divergência deliberada do MATLAB/Octave, que só aceitam ASCII. Vale só o alfabeto grego básico,
// sem acentos, para não abrir a porta a outros alfabetos com letras iguais às latinas.
//  - Maiúsculas iguais a letras latinas e o ómicron são erro (requisito 8: uma única leitura).
//  - Variantes tipográficas são sinônimos da forma comum (µ → μ, ϕ → φ, ϑ → θ, ϵ → ε, ς → σ ...).
// O token guarda o nome canônico em `value`; o texto original continua em source[start, end).
export const GREEK_LOOKALIKES = Object.freeze({
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M',
  'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', 'ο': 'o',
});
export const GREEK_VARIANTS = Object.freeze({
  'µ': 'μ', // U+00B5 sinal de micro (AltGr+M no teclado ABNT2) → U+03BC mu
  'ϕ': 'φ', 'ϑ': 'θ', 'ϵ': 'ε', 'ς': 'σ', 'ϖ': 'π', 'ϰ': 'κ', 'ϱ': 'ρ',
});
// Constantes que não podem ser redefinidas (π = pi). `pi` continua redefinível como no MATLAB.
export const CONSTANT_NAMES = new Set(['π']);
const isGreekLetter = (c) => (c >= 'α' && c <= 'ω') || (c >= 'Α' && c <= 'Ω' && c !== '\u03A2');
const isGreekChar = (c) => c !== undefined && (isGreekLetter(c) || c in GREEK_VARIANTS);
// -----------------------------------------------------------------------------------

const isDigit = (c) => c >= '0' && c <= '9';
const isIdentStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || isGreekChar(c);
const isIdentChar = (c) => isIdentStart(c) || isDigit(c);

export function createLocator(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) starts.push(i + 1);
  let hint = 0;
  const lineOf = (off) => {
    if (off >= starts[hint] && (hint + 1 >= starts.length || off < starts[hint + 1])) return hint;
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= off) lo = mid; else hi = mid - 1;
    }
    hint = lo;
    return lo;
  };
  return (start, end = start) => {
    const a = lineOf(start);
    const line = a + 1;
    const col = start - starts[a] + 1;
    const b = end === start ? a : lineOf(end);
    return { line, col, endLine: b + 1, endCol: end - starts[b] + 1, start, end };
  };
}

export function tokenize(source, options = {}) {
  const octave = options.octave !== false;
  const locate = createLocator(source);
  const tokens = [];
  const errors = [];
  const stack = [];
  const n = source.length;
  let i = 0;
  let space = false;
  let first = true;

  const err = (code, params, a, b) => errors.push(makeError(code, params, locate(a, b)));
  const last = () => tokens[tokens.length - 1];
  const push = (type, value, start, end, extra) => {
    const t = { type, value, start, end, space };
    if (extra) Object.assign(t, extra);
    tokens.push(t);
    space = false;
    first = false;
    return t;
  };
  const virtual = (value, pos) => tokens.push({ type: 'op', value, start: pos, end: pos, space: false, virtual: true });
  const isValueEnd = (t) => !!t && !t.virtual && (
    t.type === 'num' || t.type === 'str' || t.type === 'ident'
    || (t.type === 'kw' && t.value === 'end' && t.inBracket)
    || (t.type === 'op' && VALUE_END_OPS.has(t.value)));

  const inMatrix = () => { const t = stack[stack.length - 1]; return t === '[' || t === '{'; };

  function startsValue(p) {
    const ch = source[p];
    const nx = source[p + 1];
    if (isIdentStart(ch) || isDigit(ch)) return true;
    switch (ch) {
      case "'": case '"': case '(': case '[': case '{': case '@': return true;
      case '.': return nx !== undefined && isDigit(nx);
      case '~': case '!': return nx !== '=';
      case '+': case '-': return nx !== undefined && nx !== ' ' && nx !== '\t' && nx !== '\n' && nx !== '\r' && nx !== '=';
      default: return false;
    }
  }

  function newline(pos) {
    const top = stack[stack.length - 1];
    if (top === '[' || top === '{') {
      const l = last();
      if (l && !(l.type === 'op' && (l.value === ';' || l.value === ',' || l.value === '[' || l.value === '{'))) virtual(';', pos);
    } else {
      if (top === '(') stack.length = 0; // recuperação: parêntese não fechado na linha
      push('nl', '\n', pos, pos + 1);
    }
  }

  function skipBlockComment(start, eol) {
    let depth = 1;
    let pos = eol + 1;
    while (eol < n && pos <= n) {
      let e = source.indexOf('\n', pos);
      if (e < 0) e = n;
      const t = source.slice(pos, e).trim();
      if (t === '%{') depth++;
      else if (t === '%}' && --depth === 0) return e;
      if (e >= n) break;
      pos = e + 1;
    }
    err('unterminatedBlockComment', {}, start, Math.min(eol, n));
    return n;
  }

  function lexNumber() {
    const start = i;
    if (source[i] === '.') {
      i++;
      while (i < n && isDigit(source[i])) i++;
    } else {
      while (i < n && isDigit(source[i])) i++;
      const nx = source[i + 1];
      if (source[i] === '.' && !(nx === '.' && source[i + 2] === '.') && !(nx !== undefined && '*/\\^\''.includes(nx))) {
        i++;
        while (i < n && isDigit(source[i])) i++;
      }
    }
    if ((source[i] === 'e' || source[i] === 'E')) {
      const a = source[i + 1];
      const b = source[i + 2];
      if ((a !== undefined && isDigit(a)) || ((a === '+' || a === '-') && b !== undefined && isDigit(b))) {
        i += 2;
        while (i < n && isDigit(source[i])) i++;
      }
    }
    let imag = false;
    if ('ij'.includes(source[i] || '#') && !(i + 1 < n && isIdentChar(source[i + 1]))) {
      imag = true;
      i++;
    }
    if (i < n && isIdentChar(source[i])) {
      while (i < n && isIdentChar(source[i])) i++;
      err('invalidNumber', { text: source.slice(start, i) }, start, i);
    }
    push('num', source.slice(start, i), start, i, { imag });
  }

  function lexString(quote) {
    const start = i;
    let j = i + 1;
    let value = '';
    for (;;) {
      if (j >= n || source[j] === '\n') {
        err('unterminatedString', { quote }, start, j);
        break;
      }
      const c = source[j];
      if (c === quote) {
        if (source[j + 1] === quote) { value += quote; j += 2; continue; }
        j++;
        break;
      }
      if (c === '\r' && source[j + 1] === '\n') { j++; continue; }
      value += c;
      j++;
    }
    i = j;
    push('str', value, start, j, { quote });
  }

  // Nome canônico de source[a, b): variantes gregas viram a forma comum; letras gregas iguais às
  // latinas dão erro e são trocadas pela latina (recuperação), para o parser seguir adiante.
  function canonicalWord(a, b) {
    let word = '';
    for (let k = a; k < b; k++) {
      const c = source[k];
      if (c in GREEK_LOOKALIKES) {
        err('greekLookalike', { char: c, latin: GREEK_LOOKALIKES[c] }, k, k + 1);
        word += GREEK_LOOKALIKES[c];
      } else word += GREEK_VARIANTS[c] ?? c;
    }
    return word;
  }

  // REGRA OCTAVE: devolve true se tratou o caractere (e avançou `i`).
  function octaveStep(c) {
    if (c === '#') {
      let eol = source.indexOf('\n', i);
      if (eol < 0) eol = n;
      err('octaveComment', {}, i, i + 1);
      i = eol;
      return true;
    }
    const nx = source[i + 1];
    if (c === '!') {
      if (nx === '=') { err('octaveNotEqual', {}, i, i + 2); push('op', '~=', i, i + 2); i += 2; return true; }
      err('octaveNot', {}, i, i + 1);
      push('op', '~', i, i + 1);
      i++;
      return true;
    }
    if ((c === '+' || c === '-') && nx === c) {
      let j = i + 2;
      while (source[j] === ' ' || source[j] === '\t') j++;
      const e = source[j];
      if (e === undefined || e === '\n' || e === '\r' || e === ';' || e === ',' || e === '%' || e === ')') {
        err('octaveIncrement', { op: c + c }, i, i + 2);
        i += 2;
        return true;
      }
    }
    if ('+-*/^'.includes(c) && nx === '=' && source[i + 2] !== '=') {
      err('octaveCompoundAssign', { op: c + '=' }, i, i + 2);
      push('op', '=', i, i + 2);
      i += 2;
      return true;
    }
    return false;
  }

  while (i < n) {
    const c = source[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === ' ' || c === '﻿') { i++; space = true; continue; }
    if (c === '\n') { newline(i); i++; first = true; space = false; continue; }
    if (c === '%') {
      let eol = source.indexOf('\n', i);
      if (eol < 0) eol = n;
      if (first) {
        const line = source.slice(i, eol).trim();
        if (line === '%{') { i = skipBlockComment(i, eol); continue; }
        if (line.startsWith('%%') && stack.length === 0) {
          push('section', line.slice(2).trim(), i, i + source.slice(i, eol).trimEnd().length);
          i = eol;
          continue;
        }
      }
      i = eol;
      continue;
    }
    if (c === '.' && source.startsWith('...', i)) {
      const e = source.indexOf('\n', i);
      i = e < 0 ? n : e + 1;
      space = true;
      continue;
    }
    if (octave && octaveStep(c)) continue;

    const top = stack[stack.length - 1];
    if ((top === '[' || top === '{') && space && isValueEnd(last()) && startsValue(i)) virtual(',', i);

    if (isDigit(c) || (c === '.' && i + 1 < n && isDigit(source[i + 1]))) { lexNumber(); continue; }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentChar(source[j])) j++;
      const word = canonicalWord(i, j);
      const l = last();
      const afterDot = l && l.type === 'op' && l.value === '.' && !l.virtual && l.end === i;
      if (afterDot) push('ident', word, i, j);
      else if (KEYWORDS.has(word)) push('kw', word, i, j, { inBracket: stack.length > 0 });
      else if (octave && OCTAVE_END_WORDS.has(word)) {
        err('octaveEnd', { word }, i, j);
        push('kw', 'end', i, j, { inBracket: stack.length > 0, octave: true });
      } else {
        if (octave && word === 'printf') err('octavePrintf', {}, i, j);
        push('ident', word, i, j);
      }
      i = j;
      continue;
    }
    if (c === "'") {
      const l = last();
      if (isValueEnd(l) && (l.end === i || !inMatrix())) { push('op', "'", i, i + 1); i++; } else lexString("'");
      continue;
    }
    if (c === '"') { lexString('"'); continue; }
    if (c === '.' && source[i + 1] === "'" && isValueEnd(last()) && (last().end === i || !inMatrix())) {
      push('op', ".'", i, i + 2);
      i += 2;
      continue;
    }
    const two = source.substr(i, 2);
    if (TWO_OPS.has(two)) { push('op', two, i, i + 2); i += 2; continue; }
    if (ONE_OPS.has(c)) {
      if (c === '(' || c === '[' || c === '{') stack.push(c);
      else if (c === ')' || c === ']' || c === '}') {
        const open = c === ')' ? '(' : c === ']' ? '[' : '{';
        const k = stack.lastIndexOf(open);
        if (k >= 0) stack.length = k;
      }
      push('op', c, i, i + 1);
      i++;
      continue;
    }
    err('unexpectedChar', { char: c }, i, i + 1);
    i++;
  }
  tokens.push({ type: 'eof', value: '', start: n, end: n, space });
  return { tokens, errors, locate };
}
