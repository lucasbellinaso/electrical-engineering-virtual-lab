/**
 * EEVL Script Studio · fase 0 · Núcleo do runtime (sem DOM, sem Worker; testável em Node).
 *
 * createRt monta o objeto `rt` que o código "gerado" recebe. loadGenerated cria o módulo
 * a partir do texto gerado: Blob URL + import() no navegador (nos testes em Node, o
 * chamador passa toUrl/revoke próprios, com data: URL).
 */
export class LimitError extends Error {
  constructor(message, line) { super(message); this.name = 'LimitError'; this.line = line; }
}

/**
 * @param {object} core funções do core importadas pelo Worker, por exemplo { linspace }
 * @param {object} [opts] { deadlineMs, now }
 */
export function createRt(core, opts = {}) {
  const now = opts.now || (() => performance.now());
  const deadline = opts.deadlineMs ? now() + opts.deadlineMs : Infinity;
  let out = [];
  const rt = {
    linspace: core.linspace,
    tick: 0,
    // Verificação nos back-edges: o código gerado chama quando ++rt.tick > 65535.
    check(line) {
      rt.tick = 0;
      if (now() > deadline) throw new LimitError('prazo de execução excedido', line);
    },
    * range(a, b) { for (let i = a; i <= b; i++) yield i; },
    plus(a, b) { return a + b; },
    show(name, v) { out.push(name + ' = ' + v); },
    print(vals, names) { out.push(names.map((n, i) => n + ' = ' + vals[i]).join('; ')); },
    takeOut() { const o = out; out = []; return o; },
  };
  return rt;
}

/** Carrega o módulo gerado. Por padrão usa Blob URL (navegador). */
export async function loadGenerated(source, io = {}) {
  const toUrl = io.toUrl || (s => URL.createObjectURL(new Blob([s], { type: 'text/javascript' })));
  const revoke = io.revoke || (u => URL.revokeObjectURL(u));
  const importer = io.importer || (u => import(u));
  const url = toUrl(source);
  try { return await importer(url); } finally { revoke(url); }
}
