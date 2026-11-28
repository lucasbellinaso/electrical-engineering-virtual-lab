// Auxiliares dos testes do Script Studio (fase 1): JSON estável e forma compacta da AST.

// JSON determinístico: chaves na ordem de construção da AST; `loc` e arrays de primitivos em uma linha.
export function stableJson(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const pad1 = '  '.repeat(indent + 1);
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (value.every((v) => v === null || typeof v !== 'object')) return JSON.stringify(value);
    return `[\n${value.map((v) => pad1 + stableJson(v, indent + 1)).join(',\n')}\n${pad}]`;
  }
  const keys = Object.keys(value);
  if (!keys.length) return '{}';
  if ('endCol' in value && 'line' in value) return JSON.stringify(value);
  return `{\n${keys.map((k) => `${pad1}${JSON.stringify(k)}: ${stableJson(value[k], indent + 1)}`).join(',\n')}\n${pad}}`;
}

// Forma compacta (s-expression) de uma expressão, para afirmar estrutura nos testes.
export function sx(n) {
  if (n === null || n === undefined) return '_';
  if (Array.isArray(n)) return n.map(sx).join(' ');
  switch (n.type) {
    case 'Number': return n.raw;
    case 'String': return n.quote === '"' ? `"${n.value}"` : `'${n.value}'`;
    case 'Ident': return n.name;
    case 'Colon': return ':';
    case 'End': return 'end';
    case 'Binary': return `(${n.operator} ${sx(n.left)} ${sx(n.right)})`;
    case 'Unary': return `(u${n.operator} ${sx(n.operand)})`;
    case 'Postfix': return `(post${n.operator} ${sx(n.operand)})`;
    case 'Range': return n.step ? `(range ${sx(n.start)} ${sx(n.step)} ${sx(n.stop)})` : `(range ${sx(n.start)} ${sx(n.stop)})`;
    case 'CallOrIndex': return `(call ${sx(n.callee)}${n.args.length ? ' ' : ''}${sx(n.args)})`;
    case 'Field': return `(. ${sx(n.object)} ${n.name})`;
    case 'Paren': return `(paren ${sx(n.expression)})`;
    case 'Matrix': return `[${n.rows.map((r) => r.map(sx).join(' ')).join(' ; ')}]`;
    case 'AnonFn': return `(@ (${n.params.map((p) => p.name).join(' ')}) ${sx(n.body)})`;
    case 'FuncHandle': return `@${n.name}`;
    case 'NamedArg': return `${n.name}=${sx(n.value)}`;
    case 'Ignore': return '~';
    default: return `<${n.type}>`;
  }
}
