/**
 * EEVL Script Studio · fase 0 · Worker de execução (módulo, carregado do próprio site).
 *
 * 1. Importa o core por caminho relativo (linspace) e o expõe ao código gerado via `rt`.
 * 2. Neutraliza capacidades de rede/armazenamento e guarda postMessage numa closure privada
 *    (seção 3, item 4 de docs/SCRIPT-STUDIO.md) antes de carregar qualquer código gerado.
 * 3. Recebe o texto do módulo gerado, cria um Blob URL e faz import() dele.
 */
import { linspace } from '../../assets/js/core/numeric.js';
import { Conductor } from './conductor.js';
import { createRt, loadGenerated } from './runtime-core.js';

// Closure privada: o código gerado perde o acesso a postMessage global.
const post = self.postMessage.bind(self);

function neutralize() {
  const status = {};
  const off = name => function () { throw new Error('capacidade desativada pelo runtime: ' + name); };
  const offObject = name => new Proxy({}, { get() { throw new Error('capacidade desativada pelo runtime: ' + name); } });
  const plan = {
    fetch: off('fetch'),
    XMLHttpRequest: off('XMLHttpRequest'),
    WebSocket: off('WebSocket'),
    importScripts: off('importScripts'),
    indexedDB: offObject('indexedDB'),
    caches: offObject('caches'),
    postMessage: off('postMessage'),
  };
  for (const [name, value] of Object.entries(plan)) {
    try {
      Object.defineProperty(globalThis, name, { value, writable: false, configurable: false });
      status[name] = 'neutralizado';
    } catch (e) {
      try { globalThis[name] = value; status[name] = 'neutralizado (atribuição)'; }
      catch (e2) { status[name] = 'FALHOU: ' + e2.name; }
    }
  }
  return status;
}

self.addEventListener('securitypolicyviolation', e => {
  post({ type: 'csp', directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
});

const neutralized = neutralize();
let conductor = null;

function errInfo(e) {
  return { name: e && e.name, message: String(e && e.message), line: e && e.line != null ? e.line : null };
}

async function runFast(m) {
  const rt = createRt({ linspace }, { deadlineMs: m.deadlineMs });
  try {
    const mod = await loadGenerated(m.source);
    const t0 = performance.now();
    const value = mod.main(rt);
    const ms = performance.now() - t0;
    post({ type: 'result', id: m.id, value, ms, out: rt.takeOut() });
  } catch (e) {
    post({ type: 'error', id: m.id, ...errInfo(e) });
  }
}

async function runDebug(m) {
  const rt = createRt({ linspace }, { deadlineMs: 0 });
  const env = {};
  try {
    const mod = await loadGenerated(m.source);
    conductor = new Conductor(mod.main(env, rt), {
      emit: msg => post({ ...msg, id: m.id }),
      delayMs: m.delayMs || 0,
      quiet: !!m.quiet,
      deadlineMs: m.deadlineMs || 0,
      takeOut: rt.takeOut,
    });
    await conductor.run();
  } catch (e) {
    post({ type: 'error', id: m.id, ...errInfo(e) });
  } finally {
    conductor = null;
  }
}

self.onmessage = ev => {
  const m = ev.data;
  switch (m && m.type) {
    case 'run-fast': runFast(m); break;
    case 'run-debug': runDebug(m); break;
    case 'pause': case 'step': case 'continue': if (conductor) conductor.handle(m.type); break;
    case 'ping': post({ type: 'pong', id: m.id }); break;
    default: break;
  }
};

post({ type: 'ready', neutralized, linspaceType: typeof linspace });
