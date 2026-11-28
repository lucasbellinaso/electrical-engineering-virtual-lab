// Erros de sintaxe do Script Studio (fase 1).
// Cada erro é {code, params, loc, message}. Somente `code` e `params` são estáveis
// e independentes de idioma; `message` é gerada aqui em pt-BR (docs/I18N.md prevê en e es depois).
// Em `params`, os símbolos especiais <eol>, <eof> e <identifier> são neutros quanto ao idioma.

const q = (s) => `'${s}'`;

function found(s) {
  if (s === '<eol>') return 'o fim da linha';
  if (s === '<eof>') return 'o fim do arquivo';
  return q(s);
}

function expected(s) {
  if (s === '<identifier>') return 'um identificador';
  if (s === '<expression>') return 'uma expressão';
  return q(s);
}

export const MESSAGES_PT = {
  // Léxico
  unterminatedString: (p) => `String não terminada: falta o ${p.quote} de fechamento.`,
  unterminatedBlockComment: () => "Comentário de bloco '%{' sem o '%}' correspondente.",
  unexpectedChar: (p) => `Caractere inesperado ${q(p.char)}.`,
  invalidNumber: (p) => `Número inválido ${q(p.text)}.`,
  // Sintaxe exclusiva do Octave
  octaveComment: () => "'#' não inicia comentário no Script Studio; use '%'.",
  octaveNot: () => "'!' não é suportado; use '~' para negação.",
  octaveNotEqual: () => "'!=' não é suportado; use '~=' para diferente.",
  octaveCompoundAssign: (p) => `'${p.op}' não é suportado; escreva a atribuição completa, por exemplo 'a = a ${p.op[0]} b'.`,
  octaveIncrement: (p) => `'${p.op}' não é suportado; escreva 'a = a ${p.op[0]} 1'.`,
  octaveEnd: (p) => `'${p.word}' é sintaxe do Octave; feche o bloco com 'end'.`,
  octavePrintf: () => "'printf' é do Octave; use 'fprintf' ou 'disp'.",
  // Sintaxe
  unexpectedToken: (p) => (p.expected
    ? `Esperava ${expected(p.expected)}, mas encontrou ${found(p.found)}.`
    : `Símbolo inesperado: ${found(p.found)}.`),
  expectedStatementEnd: (p) => `Esperava ';', ',' ou o fim da linha, mas encontrou ${found(p.found)}.`,
  unclosedBracket: (p) => `Falta fechar ${q(p.open)} (esperava ${q(p.close)}).`,
  missingEnd: (p) => (p.block === 'function' && p.name
    ? `A função '${p.name}' (linha ${p.line}) precisa terminar com 'end'.`
    : `O bloco '${p.block}' aberto na linha ${p.line} não foi fechado com 'end'.`),
  strayKeyword: (p) => `'${p.word}' sem bloco correspondente.`,
  reservedWord: (p) => `'${p.word}' é palavra reservada (uso futuro) e não pode ser nome de variável ou função.`,
  unsupportedKeyword: (p) => `'${p.word}' ainda não é suportado nesta versão.`,
  commandSyntax: (p) => `Sintaxe de comando não é suportada. Use a forma de função: ${p.suggestion}.`,
  cellNotSupported: () => 'Células e chaves {...} estão fora desta versão.',
  dynamicFieldNotSupported: () => 'Campo dinâmico x.(nome) não é suportado nesta versão.',
  invalidAssignTarget: () => 'Lado esquerdo inválido na atribuição: use uma variável, índice ou campo.',
  endOutsideIndex: () => "'end' só pode aparecer dentro de um índice, por exemplo A(end).",
  functionInBlock: () => "'function' só pode aparecer no nível do script (no fim do arquivo), não dentro de if, laço ou switch.",
  nestedFunction: () => 'Funções aninhadas não são suportadas; defina funções locais no fim do script.',
  statementAfterFunction: () => 'Depois da primeira função local só podem aparecer outras funções; mova este código para antes das funções.',
  declExpectedName: (p) => `Esperava o nome da variável na declaração '${p.type}', mas encontrou ${found(p.found)}.`,
};

export function formatMessage(code, params = {}) {
  const fn = MESSAGES_PT[code];
  return fn ? fn(params) : `Erro de sintaxe (${code}).`;
}

export function makeError(code, params, loc) {
  return { code, params: params || {}, loc, message: formatMessage(code, params || {}) };
}
