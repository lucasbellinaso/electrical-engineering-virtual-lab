// Tipos de nó da AST do Script Studio (fase 1). Documentados em docs/SCRIPT-GRAMMAR.md.
// Todo nó é um objeto simples {type, ...campos, loc}, serializável em JSON sem ciclos.
// loc = {line, col, endLine, endCol, start, end}: 1-based; start/end são deslocamentos
// (unidades UTF-16) e end é exclusivo.

export const NODE_TYPES = Object.freeze([
  // Programa e estrutura
  'Program', 'Section', 'Function', 'Param', 'ArgumentsBlock', 'ArgumentDecl',
  // Instruções
  'ExprStmt', 'Assign', 'Ignore', 'Decl', 'Declarator',
  'If', 'ElseIf', 'For', 'While', 'Switch', 'Case', 'Otherwise', 'Break', 'Continue', 'Return',
  // Expressões
  'Number', 'String', 'Ident', 'Colon', 'End', 'Range', 'Binary', 'Unary', 'Postfix',
  'CallOrIndex', 'Field', 'Matrix', 'AnonFn', 'FuncHandle', 'NamedArg', 'Paren',
]);

// Percorre a AST em profundidade (ordem das chaves). visit(node, parent) pode devolver
// false para não descer nos filhos.
export function walk(node, visit, parent = null) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit, parent);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (visit(node, parent) === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const value = node[key];
    if (value && typeof value === 'object') walk(value, visit, node);
  }
}
