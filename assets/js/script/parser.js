// Parser do Script Studio (fase 1): tokens -> AST. Módulo ESM puro, sem DOM.
// Gramática e regras de desambiguação: docs/SCRIPT-GRAMMAR.md.
// O parser NÃO decide se `f(x)` é chamada ou indexação (CallOrIndex), nem resolve nomes,
// nem checa tipos ou número de dimensões: isso é da análise semântica.

import { tokenize, FUTURE_RESERVED, UNSUPPORTED_V1, DECL_TYPES } from './lexer.js';
import { makeError } from './errors.js';

class ParseError extends Error {
  constructor(err) {
    super(err.message);
    this.err = err;
  }
}

const BLOCK_END = new Set(['end']);
const IF_STOP = new Set(['end', 'elseif', 'else']);
const SWITCH_STOP = new Set(['end', 'case', 'otherwise']);
const STRAY = new Set(['end', 'else', 'elseif', 'case', 'otherwise']);

const MUL_OPS = new Set(['*', '/', '\\', '.*', './', '.\\']);
const CMP_OPS = new Set(['==', '~=', '<', '<=', '>', '>=']);

const isLValue = (e) => e.type === 'Ident'
  || (e.type === 'CallOrIndex' && isLValue(e.callee))
  || (e.type === 'Field' && isLValue(e.object));

class Parser {
  constructor(source, tokens, locate) {
    this.src = source;
    this.toks = tokens;
    this.locate = locate;
    this.p = 0;
    this.prevEnd = 0;
    this.errors = [];
    this.indexDepth = 0;
    this.funcDepth = 0;
  }

  // ---- utilitários de token ------------------------------------------------------
  peek(k = 0) { return this.toks[Math.min(this.p + k, this.toks.length - 1)]; }

  next() {
    const t = this.toks[this.p];
    if (t.type !== 'eof') this.p++;
    if (t.type !== 'nl' && !t.virtual) this.prevEnd = t.end;
    return t;
  }

  isOp(v, k = 0) { const t = this.peek(k); return t.type === 'op' && t.value === v; }

  desc(t) {
    if (t.type === 'eof') return '<eof>';
    if (t.type === 'nl') return '<eol>';
    if (t.virtual) return t.value === ';' ? '<eol>' : ',';
    if (t.type === 'section') return '%%';
    return this.src.slice(t.start, t.end);
  }

  failAt(code, params, a, b) {
    const s = typeof a === 'number' ? a : a.start;
    const e = b === undefined ? (typeof a === 'number' ? s : a.end) : (typeof b === 'number' ? b : b.end);
    throw new ParseError(makeError(code, params, this.locate(s, e)));
  }

  pushError(code, params, s, e) { this.errors.push(makeError(code, params, this.locate(s, e))); }

  unexpected(tok, expected) {
    if (tok.type === 'kw') {
      if (FUTURE_RESERVED.has(tok.value)) this.failAt('reservedWord', { word: tok.value }, tok);
      if (UNSUPPORTED_V1.has(tok.value)) this.failAt('unsupportedKeyword', { word: tok.value }, tok);
      if (STRAY.has(tok.value)) this.failAt('strayKeyword', { word: tok.value }, tok);
    }
    if (tok.type === 'op' && tok.value === '{') this.failAt('cellNotSupported', {}, tok);
    const params = { found: this.desc(tok) };
    if (expected) params.expected = expected;
    this.failAt('unexpectedToken', params, tok);
  }

  expectOp(v) {
    if (this.isOp(v)) return this.next();
    return this.unexpected(this.peek(), v);
  }

  expectIdent() {
    const t = this.peek();
    if (t.type === 'ident') return this.next();
    return this.unexpected(t, '<identifier>');
  }

  mk(type, fields, start, end = this.prevEnd) {
    return { type, ...fields, loc: this.locate(start, end) };
  }

  missingEnd(block, startTok, name) {
    const params = { block };
    if (name !== undefined) params.name = name;
    params.line = this.locate(startTok.start).line;
    this.pushError('missingEnd', params, startTok.start, startTok.end);
  }

  // ---- separadores e fim de instrução ---------------------------------------------
  skipSeparators(sink) {
    for (;;) {
      const t = this.peek();
      if (t.type === 'nl' || (t.type === 'op' && !t.virtual && (t.value === ';' || t.value === ','))) this.next();
      else if (t.type === 'section') {
        this.next();
        if (sink) sink.push(this.mk('Section', { title: t.value, raw: this.src.slice(t.start, t.end) }, t.start, t.end));
      } else return;
    }
  }

  skipHeaderSep() {
    for (;;) {
      const t = this.peek();
      if (t.type === 'nl' || (t.type === 'op' && !t.virtual && (t.value === ';' || t.value === ','))) this.next();
      else return;
    }
  }

  // Devolve `display`: false quando termina em ';'.
  endStatement() {
    const t = this.peek();
    if (t.type === 'op' && t.value === ';') { this.next(); return false; }
    if (t.type === 'op' && t.value === ',') { this.next(); return true; }
    if (t.type === 'nl') { this.next(); return true; }
    if (t.type === 'eof' || t.type === 'section') return true;
    if (t.type === 'kw' && STRAY.has(t.value)) return true;
    return this.failAt('expectedStatementEnd', { found: this.desc(t) }, t);
  }

  eatTerminator() {
    const t = this.peek();
    if (t.type === 'nl' || (t.type === 'op' && !t.virtual && (t.value === ';' || t.value === ','))) this.next();
  }

  // ---- programa e blocos ------------------------------------------------------------
  parseProgram() {
    const body = [];
    const functions = [];
    for (;;) {
      this.skipSeparators(body);
      const tok = this.peek();
      if (tok.type === 'eof') break;
      const startP = this.p;
      try {
        if (tok.type === 'kw' && tok.value === 'function') { functions.push(this.parseFunction()); continue; }
        const st = this.parseStatement();
        if (functions.length) this.pushError('statementAfterFunction', {}, st.loc.start, st.loc.end);
        body.push(st);
      } catch (e) { this.recover(e, startP); }
    }
    return { type: 'Program', body, functions, loc: this.locate(0, this.src.length) };
  }

  recover(e, startP) {
    if (!(e instanceof ParseError)) throw e;
    this.errors.push(e.err);
    this.indexDepth = 0;
    if (this.p === startP && this.peek().type !== 'eof') this.p++;
    for (;;) {
      const t = this.peek();
      if (t.type === 'eof') return;
      this.p++;
      if (t.type === 'nl') return;
    }
  }

  parseBlock(stopSet) {
    const body = [];
    for (;;) {
      this.skipSeparators(null);
      const tok = this.peek();
      if (tok.type === 'eof') return { body, stop: null };
      if (tok.type === 'kw' && stopSet.has(tok.value)) return { body, stop: tok };
      const startP = this.p;
      try { body.push(this.parseStatement()); } catch (e) { this.recover(e, startP); }
    }
  }

  parseStatement() {
    const tok = this.peek();
    if (tok.type === 'kw') {
      switch (tok.value) {
        case 'if': return this.parseIf();
        case 'for': return this.parseFor();
        case 'while': return this.parseWhile();
        case 'switch': return this.parseSwitch();
        case 'break': case 'continue': case 'return': {
          this.next();
          this.endStatement();
          const type = tok.value === 'break' ? 'Break' : tok.value === 'continue' ? 'Continue' : 'Return';
          return this.mk(type, {}, tok.start);
        }
        case 'function': return this.failAt(this.funcDepth > 0 ? 'nestedFunction' : 'functionInBlock', {}, tok);
        default: return this.unexpected(tok);
      }
    }
    if (this.isDeclStart()) return this.parseDecl();
    return this.parseSimple();
  }

  parseIf() {
    const start = this.next();
    const condition = this.parseExpression();
    this.skipHeaderSep();
    let r = this.parseBlock(IF_STOP);
    const body = r.body;
    const elseifs = [];
    let elseBody = null;
    for (;;) {
      if (!r.stop) { this.missingEnd('if', start); break; }
      if (r.stop.value === 'elseif') {
        const k = this.next();
        const cond = this.parseExpression();
        this.skipHeaderSep();
        r = this.parseBlock(IF_STOP);
        elseifs.push(this.mk('ElseIf', { condition: cond, body: r.body }, k.start));
        continue;
      }
      if (r.stop.value === 'else') {
        this.next();
        r = this.parseBlock(BLOCK_END);
        elseBody = r.body;
        if (!r.stop) { this.missingEnd('if', start); break; }
      }
      this.next();
      this.eatTerminator();
      break;
    }
    return this.mk('If', { condition, body, elseifs, elseBody }, start.start);
  }

  parseFor() {
    const start = this.next();
    const paren = this.isOp('(') && this.peek(1).type === 'ident' && this.isOp('=', 2);
    if (paren) this.next();
    const v = this.expectIdent();
    const variable = this.mk('Ident', { name: v.value }, v.start, v.end);
    this.expectOp('=');
    const iterable = this.parseExpression();
    if (paren) this.expectOp(')');
    this.skipHeaderSep();
    const r = this.parseBlock(BLOCK_END);
    if (!r.stop) this.missingEnd('for', start);
    else { this.next(); this.eatTerminator(); }
    return this.mk('For', { variable, iterable, body: r.body }, start.start);
  }

  parseWhile() {
    const start = this.next();
    const condition = this.parseExpression();
    this.skipHeaderSep();
    const r = this.parseBlock(BLOCK_END);
    if (!r.stop) this.missingEnd('while', start);
    else { this.next(); this.eatTerminator(); }
    return this.mk('While', { condition, body: r.body }, start.start);
  }

  parseSwitch() {
    const start = this.next();
    const subject = this.parseExpression();
    this.skipHeaderSep();
    const cases = [];
    let otherwise = null;
    for (;;) {
      this.skipSeparators(null);
      const tok = this.peek();
      if (tok.type === 'eof') { this.missingEnd('switch', start); break; }
      if (tok.type === 'kw' && tok.value === 'end') { this.next(); this.eatTerminator(); break; }
      if (tok.type === 'kw' && tok.value === 'case') {
        this.next();
        let values;
        let cell = false;
        if (this.isOp('{')) { cell = true; values = this.parseBraceList(); } else values = [this.parseExpression()];
        this.skipHeaderSep();
        const r = this.parseBlock(SWITCH_STOP);
        cases.push(this.mk('Case', { values, cell, body: r.body }, tok.start));
        continue;
      }
      if (tok.type === 'kw' && tok.value === 'otherwise') {
        this.next();
        const r = this.parseBlock(SWITCH_STOP);
        otherwise = this.mk('Otherwise', { body: r.body }, tok.start);
        continue;
      }
      this.unexpected(tok);
    }
    return this.mk('Switch', { subject, cases, otherwise }, start.start);
  }

  // `{a, b}` em `case` e em validadores do bloco arguments.
  parseBraceList() {
    const open = this.next();
    const items = [];
    for (;;) {
      if (this.isOp('}')) { this.next(); return items; }
      if (this.isOp(',')) { this.next(); continue; }
      const t = this.peek();
      if (t.type === 'eof' || t.type === 'nl') this.failAt('unclosedBracket', { open: '{', close: '}' }, open);
      items.push(this.parseExpression());
      if (!this.isOp(',') && !this.isOp('}')) this.unexpected(this.peek(), '}');
    }
  }

  // ---- funções -------------------------------------------------------------------
  parseParam(allowIgnore) {
    const t = this.peek();
    if (allowIgnore && t.type === 'op' && t.value === '~') {
      this.next();
      return this.mk('Param', { name: '~', ignored: true }, t.start, t.end);
    }
    const id = this.expectIdent();
    return this.mk('Param', { name: id.value, ignored: false }, id.start, id.end);
  }

  parseFunction() {
    const start = this.next();
    this.funcDepth++;
    try {
      let outputs = [];
      let nameTok;
      if (this.isOp('[')) {
        const open = this.next();
        for (;;) {
          if (this.isOp(']')) { this.next(); break; }
          if (this.isOp(',')) { this.next(); continue; }
          const t = this.peek();
          if (t.type === 'eof' || t.type === 'nl') this.failAt('unclosedBracket', { open: '[', close: ']' }, open);
          outputs.push(this.parseParam(false));
        }
        this.expectOp('=');
        nameTok = this.expectIdent();
      } else {
        const id = this.expectIdent();
        if (this.isOp('=')) {
          this.next();
          outputs = [this.mk('Param', { name: id.value, ignored: false }, id.start, id.end)];
          nameTok = this.expectIdent();
        } else nameTok = id;
      }
      const params = [];
      if (this.isOp('(')) {
        this.next();
        for (;;) {
          if (this.isOp(')')) { this.next(); break; }
          if (this.isOp(',')) { this.next(); continue; }
          params.push(this.parseParam(true));
          if (!this.isOp(',') && !this.isOp(')')) this.unexpected(this.peek(), ')');
        }
      }
      this.skipHeaderSep();
      const argumentBlocks = [];
      while (this.isArgumentsStart()) argumentBlocks.push(this.parseArgumentsBlock());
      const r = this.parseBlock(BLOCK_END);
      if (!r.stop) this.missingEnd('function', start, nameTok.value);
      else { this.next(); this.eatTerminator(); }
      return this.mk('Function', { name: nameTok.value, outputs, params, argumentBlocks, body: r.body }, start.start);
    } finally {
      this.funcDepth--;
    }
  }

  isArgumentsStart() {
    const t = this.peek();
    if (t.type !== 'ident' || t.value !== 'arguments') return false;
    const n1 = this.peek(1);
    if (n1.type === 'nl' || n1.type === 'eof' || (n1.type === 'op' && (n1.value === ';' || n1.value === ','))) return true;
    return this.isOp('(', 1) && this.peek(2).type === 'ident' && this.isOp(')', 3);
  }

  parseArgumentsBlock() {
    const start = this.next();
    const attributes = [];
    if (this.isOp('(')) {
      this.next();
      attributes.push(this.expectIdent().value);
      this.expectOp(')');
    }
    const entries = [];
    for (;;) {
      this.skipSeparators(null);
      const t = this.peek();
      if (t.type === 'eof') { this.missingEnd('arguments', start); break; }
      if (t.type === 'kw' && t.value === 'end') { this.next(); this.eatTerminator(); break; }
      const startP = this.p;
      try { entries.push(this.parseArgumentDecl()); } catch (e) { this.recover(e, startP); }
    }
    return this.mk('ArgumentsBlock', { attributes, entries }, start.start);
  }

  parseArgumentDecl() {
    const id = this.expectIdent();
    let name = id.value;
    while (this.isOp('.') && this.peek(1).type === 'ident') { this.next(); name += `.${this.next().value}`; }
    let dims = null;
    if (this.isOp('(')) { this.next(); dims = this.parseArgs(); }
    let className = null;
    if (this.peek().type === 'ident') className = this.next().value;
    let validators = null;
    if (this.isOp('{')) validators = this.parseBraceList();
    let defaultValue = null;
    if (this.isOp('=')) { this.next(); defaultValue = this.parseExpression(); }
    this.endStatement();
    return this.mk('ArgumentDecl', { name, dims, className, validators, defaultValue }, id.start);
  }

  // ---- declarações (seção 6.1) ------------------------------------------------------
  isDeclStart() {
    const t = this.peek();
    if (t.type !== 'ident') return false;
    if (DECL_TYPES.has(t.value)) return this.peek(1).type === 'ident';
    if (t.value === 'varsize') {
      const a = this.peek(1);
      return a.type === 'ident' && DECL_TYPES.has(a.value) && this.peek(2).type === 'ident';
    }
    return false;
  }

  parseDecl() {
    const start = this.peek();
    let varsize = false;
    if (start.value === 'varsize') { this.next(); varsize = true; }
    const typeTok = this.next();
    const declarators = [];
    let anyInit = false;
    let usedComma = false;
    for (;;) {
      const t = this.peek();
      if (t.type !== 'ident') this.failAt('declExpectedName', { type: typeTok.value, found: this.desc(t) }, t);
      this.next();
      let init = null;
      if (this.isOp('=')) { this.next(); init = this.parseExpression(); anyInit = true; }
      declarators.push(this.mk('Declarator', { name: t.value, init }, t.start));
      if (this.isOp(',')) { this.next(); usedComma = true; continue; }
      if (this.peek().type === 'ident' && !anyInit && !usedComma) continue;
      break;
    }
    const display = this.endStatement();
    return this.mk('Decl', { varsize, typeName: typeTok.value, declarators, display }, start.start);
  }

  // ---- atribuição e expressões como instrução ------------------------------------------
  looksLikeMultiAssign() {
    let depth = 0;
    for (let j = this.p; j < this.toks.length; j++) {
      const t = this.toks[j];
      if (t.type === 'eof' || t.type === 'nl') return false;
      if (t.type !== 'op') continue;
      if (t.value === '[' || t.value === '(' || t.value === '{') depth++;
      else if (t.value === ']' || t.value === ')' || t.value === '}') {
        depth--;
        if (depth === 0) {
          const nx = this.toks[j + 1];
          return !!nx && nx.type === 'op' && nx.value === '=';
        }
      }
    }
    return false;
  }

  parseSimple() {
    const first = this.peek();
    if (this.isOp('[') && this.looksLikeMultiAssign()) {
      this.next();
      const targets = [];
      for (;;) {
        if (this.isOp(']')) { this.next(); break; }
        if (this.isOp(',')) { this.next(); continue; }
        const t = this.peek();
        if (t.type === 'op' && t.value === '~' && (this.isOp(',', 1) || this.isOp(']', 1))) {
          this.next();
          targets.push(this.mk('Ignore', {}, t.start, t.end));
          continue;
        }
        const e = this.parsePostfixPrimary();
        if (!isLValue(e)) this.failAt('invalidAssignTarget', {}, e.loc.start, e.loc.end);
        targets.push(e);
      }
      this.expectOp('=');
      const value = this.parseExpression();
      const display = this.endStatement();
      return this.mk('Assign', { targets, bracket: true, value, display }, first.start);
    }
    const expr = this.parseExpression();
    if (this.isOp('=')) {
      if (!isLValue(expr)) this.failAt('invalidAssignTarget', {}, expr.loc.start, expr.loc.end);
      this.next();
      const value = this.parseExpression();
      const display = this.endStatement();
      return this.mk('Assign', { targets: [expr], bracket: false, value, display }, first.start);
    }
    const nx = this.peek();
    if (expr.type === 'Ident' && (nx.type === 'ident' || nx.type === 'num' || nx.type === 'str')) this.commandSyntaxError(expr, nx);
    const display = this.endStatement();
    return this.mk('ExprStmt', { expression: expr, display }, first.start);
  }

  commandSyntaxError(nameNode, firstArg) {
    const args = [];
    let endOff = firstArg.start;
    for (let j = this.p; j < this.toks.length; j++) {
      const t = this.toks[j];
      if (t.type === 'eof' || t.type === 'nl' || t.type === 'section' || (t.type === 'op' && (t.value === ';' || t.value === ','))) break;
      if (t.virtual) continue;
      args.push(t.type === 'str' ? t.value : this.src.slice(t.start, t.end));
      endOff = t.end;
    }
    const suggestion = `${nameNode.name}(${args.map((a) => JSON.stringify(a)).join(', ')})`;
    this.failAt('commandSyntax', { name: nameNode.name, args, suggestion }, nameNode.loc.start, endOff);
  }

  // ---- expressões (precedência do MATLAB, da menor para a maior) ------------------------
  parseExpression() { return this.parseOrOr(); }

  binary(operator, left, right) {
    return { type: 'Binary', operator, left, right, loc: this.locate(left.loc.start, right.loc.end) };
  }

  parseOrOr() {
    let left = this.parseAndAnd();
    while (this.isOp('||')) { this.next(); left = this.binary('||', left, this.parseAndAnd()); }
    return left;
  }

  parseAndAnd() {
    let left = this.parseOr();
    while (this.isOp('&&')) { this.next(); left = this.binary('&&', left, this.parseOr()); }
    return left;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.isOp('|')) { this.next(); left = this.binary('|', left, this.parseAnd()); }
    return left;
  }

  parseAnd() {
    let left = this.parseCompare();
    while (this.isOp('&')) { this.next(); left = this.binary('&', left, this.parseCompare()); }
    return left;
  }

  parseCompare() {
    let left = this.parseRange();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && CMP_OPS.has(t.value)) { this.next(); left = this.binary(t.value, left, this.parseRange()); } else return left;
    }
  }

  parseRange() {
    let first = this.parseAdditive();
    while (this.isOp(':') && !this.isRangeEndAhead()) {
      this.next();
      const second = this.parseAdditive();
      let r;
      if (this.isOp(':') && !this.isRangeEndAhead()) {
        this.next();
        const third = this.parseAdditive();
        r = { type: 'Range', start: first, step: second, stop: third, loc: this.locate(first.loc.start, third.loc.end) };
      } else r = { type: 'Range', start: first, step: null, stop: second, loc: this.locate(first.loc.start, second.loc.end) };
      first = r;
    }
    return first;
  }

  // ':' seguido de ',' ou ')' não continua um intervalo.
  isRangeEndAhead() { return this.isOp(',', 1) || this.isOp(')', 1); }

  parseAdditive() {
    let left = this.parseMul();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) { this.next(); left = this.binary(t.value, left, this.parseMul()); } else return left;
    }
  }

  parseMul() {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && MUL_OPS.has(t.value)) { this.next(); left = this.binary(t.value, left, this.parseUnary()); } else return left;
    }
  }

  parseUnary() {
    const t = this.peek();
    if (t.type === 'op' && (t.value === '-' || t.value === '+' || t.value === '~')) {
      this.next();
      const operand = this.parseUnary();
      return { type: 'Unary', operator: t.value, operand, loc: this.locate(t.start, operand.loc.end) };
    }
    return this.parsePower();
  }

  // ^, .^, ' e .' têm a mesma precedência e associam à esquerda (como no MATLAB).
  parsePower() {
    let base = this.parsePostfixPrimary();
    for (;;) {
      const t = this.peek();
      if (t.type !== 'op') return base;
      if (t.value === '^' || t.value === '.^') {
        this.next();
        base = this.binary(t.value, base, this.parsePowerOperand());
      } else if (t.value === "'" || t.value === ".'") {
        this.next();
        base = { type: 'Postfix', operator: t.value, operand: base, loc: this.locate(base.loc.start, t.end) };
      } else return base;
    }
  }

  // Expoente: aceita sinais (`2^-1`) mas não encadeia outro `^` (a associação é à esquerda).
  parsePowerOperand() {
    const t = this.peek();
    if (t.type === 'op' && (t.value === '-' || t.value === '+' || t.value === '~')) {
      this.next();
      const operand = this.parsePowerOperand();
      return { type: 'Unary', operator: t.value, operand, loc: this.locate(t.start, operand.loc.end) };
    }
    return this.parsePostfixPrimary();
  }

  parsePostfixPrimary() {
    let expr = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.type !== 'op') return expr;
      const callable = expr.type === 'Ident' || expr.type === 'Field' || expr.type === 'CallOrIndex' || expr.type === 'Paren';
      if (t.value === '(' && callable) {
        this.next();
        const args = this.parseArgs();
        expr = { type: 'CallOrIndex', callee: expr, args, loc: this.locate(expr.loc.start, this.prevEnd) };
      } else if (t.value === '.' && callable) {
        this.next();
        const nm = this.peek();
        if (nm.type === 'op' && nm.value === '(') this.failAt('dynamicFieldNotSupported', {}, t, nm);
        if (nm.type !== 'ident') this.unexpected(nm, '<identifier>');
        this.next();
        expr = { type: 'Field', object: expr, name: nm.value, loc: this.locate(expr.loc.start, nm.end) };
      } else if (t.value === '{' && callable) {
        this.failAt('cellNotSupported', {}, t);
      } else return expr;
    }
  }

  // Argumentos de chamada/índice; o '(' já foi consumido. Consome o ')'.
  parseArgs() {
    this.indexDepth++;
    const args = [];
    try {
      let needArg = false;
      for (;;) {
        if (this.isOp(')') && !needArg) break;
        args.push(this.parseArg());
        needArg = false;
        if (this.isOp(',')) { this.next(); needArg = true; continue; }
        break;
      }
      this.expectOp(')');
    } finally { this.indexDepth--; }
    return args;
  }

  parseArg() {
    const t = this.peek();
    if (t.type === 'op' && t.value === ':' && (this.isOp(',', 1) || this.isOp(')', 1))) {
      this.next();
      return this.mk('Colon', {}, t.start, t.end);
    }
    if (t.type === 'ident' && this.isOp('=', 1)) {
      this.next();
      this.next();
      const value = this.parseExpression();
      return this.mk('NamedArg', { name: t.value, value }, t.start);
    }
    return this.parseExpression();
  }

  parsePrimary() {
    const t = this.peek();
    switch (t.type) {
      case 'num': {
        this.next();
        const raw = t.value;
        const value = Number(t.imag ? raw.slice(0, -1) : raw);
        return this.mk('Number', { value, raw, imaginary: !!t.imag }, t.start, t.end);
      }
      case 'str':
        this.next();
        return this.mk('String', { value: t.value, quote: t.quote }, t.start, t.end);
      case 'ident':
        this.next();
        return this.mk('Ident', { name: t.value }, t.start, t.end);
      case 'kw':
        if (t.value === 'end') {
          if (this.indexDepth === 0) this.failAt('endOutsideIndex', {}, t);
          this.next();
          return this.mk('End', {}, t.start, t.end);
        }
        return this.unexpected(t);
      case 'op':
        if (t.value === '(') {
          this.next();
          const expression = this.parseExpression();
          this.expectOp(')');
          return this.mk('Paren', { expression }, t.start);
        }
        if (t.value === '[') return this.parseMatrix();
        if (t.value === '@') return this.parseHandle();
        return this.unexpected(t, '<expression>');
      default:
        return this.unexpected(t, '<expression>');
    }
  }

  parseMatrix() {
    const open = this.next();
    const rows = [];
    let row = [];
    for (;;) {
      const t = this.peek();
      if (t.type === 'eof' || t.type === 'nl') this.failAt('unclosedBracket', { open: '[', close: ']' }, open);
      if (t.type === 'op' && t.value === ']') { this.next(); break; }
      if (t.type === 'op' && t.value === ';') { this.next(); if (row.length) rows.push(row); row = []; continue; }
      if (t.type === 'op' && t.value === ',') { this.next(); continue; }
      row.push(this.parseExpression());
      const a = this.peek();
      if (!(a.type === 'op' && (a.value === ',' || a.value === ';' || a.value === ']'))) {
        if (a.type === 'eof' || a.type === 'nl') this.failAt('unclosedBracket', { open: '[', close: ']' }, open);
        this.unexpected(a, ']');
      }
    }
    if (row.length) rows.push(row);
    return this.mk('Matrix', { rows }, open.start);
  }

  parseHandle() {
    const at = this.next();
    if (this.isOp('(')) {
      this.next();
      const params = [];
      for (;;) {
        if (this.isOp(')')) { this.next(); break; }
        if (this.isOp(',')) { this.next(); continue; }
        params.push(this.parseParam(true));
        if (!this.isOp(',') && !this.isOp(')')) this.unexpected(this.peek(), ')');
      }
      const body = this.parseExpression();
      return this.mk('AnonFn', { params, body }, at.start);
    }
    const id = this.expectIdent();
    let name = id.value;
    while (this.isOp('.') && this.peek(1).type === 'ident') { this.next(); name += `.${this.next().value}`; }
    return this.mk('FuncHandle', { name }, at.start);
  }
}

// parse(source, options) -> {ast, errors, ok}. `ast` sempre existe (parcial se houver erros).
// options.octave = false desliga a detecção de sintaxe exclusiva do Octave.
export function parse(source, options = {}) {
  const lex = tokenize(source, options);
  const parser = new Parser(source, lex.tokens, lex.locate);
  const ast = parser.parseProgram();
  const errors = [...lex.errors, ...parser.errors].sort((a, b) => a.loc.start - b.loc.start);
  return { ast, errors, ok: errors.length === 0 };
}

export { tokenize };
