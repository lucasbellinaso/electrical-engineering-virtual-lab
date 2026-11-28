/**
 * EEVL Script Studio · fase 0 · página de testes. Script externo (a CSP não permite inline).
 */
import * as S from './samples.js';

const $ = id => document.getElementById(id);
const logEl = $('log');
const cspEl = $('csp-log');
$('ua').textContent = navigator.userAgent;

const t0 = performance.now();
function log(s) {
  logEl.textContent += '[' + ((performance.now() - t0) / 1000).toFixed(2) + ' s] ' + s + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

// ---- violações de CSP (página e Workers) ----
const cspEvents = [];
function noteCsp(where, d) {
  const e = { where, directive: d.directive, blocked: d.blocked, sample: d.sample };
  cspEvents.push(e);
  cspEl.textContent += where + ': ' + e.directive + ' bloqueou ' + e.blocked + (e.sample ? ' [' + e.sample + ']' : '') + '\n';
}
document.addEventListener('securitypolicyviolation', e => noteCsp('página', { directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample }));

// ---- resultados ----
const TESTS = {
  '1': 'Worker de módulo carrega e importa o core',
  '2': 'Módulo gerado por Blob URL sob a CSP',
  '3': 'Diagnóstico: eval em Worker criado por URL direta (FAIL esperado se a CSP da página não alcançar o Worker)',
  '4': 'Capacidades neutralizadas (Worker via Blob bootstrap)',
  '5': 'Modo de depuração (linhas, Pause, Step, Continue)',
  '6': 'Stop: terminate() e novo Worker',
  '7': 'Verificação nos back-edges (sem terminate)',
  '8': 'Medição: laço de 10^7 iterações',
  '3b': 'Diagnóstico: eval em Worker criado por Blob bootstrap (herda a CSP da página)',
  '3c': 'Worker de runtime via Blob bootstrap: core, eval bloqueado, Blob do código gerado e comunicação',
};
const results = {};
const tbody = $('results');
const rows = {};
for (const [id, name] of Object.entries(TESTS)) {
  const tr = document.createElement('tr');
  tr.innerHTML = '<td></td><td></td><td></td><td class="detail"></td>';
  tr.children[0].textContent = id;
  tr.children[1].textContent = name;
  tr.children[2].textContent = 'não executado';
  tbody.appendChild(tr);
  rows[id] = tr;
}
function setResult(id, status, detail) {
  results[id] = { name: TESTS[id], status, detail };
  rows[id].children[2].textContent = status;
  rows[id].children[2].className = status === 'PASS' || status === 'FAIL' ? status : 'RUN';
  rows[id].children[3].textContent = detail || '';
  log('Teste ' + id + ': ' + status + (detail ? ' · ' + detail : ''));
}

// ---- cliente do Worker ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
let nextId = 1;
class Client {
  constructor(kind = 'blob') {
    this.history = [];
    this.waiters = [];
    this.kind = kind;
    const abs = new URL('./runtime-worker.js', import.meta.url).href;
    if (kind === 'blob') {
      const u = URL.createObjectURL(new Blob(['import ' + JSON.stringify(abs) + ';'], { type: 'text/javascript' }));
      this.w = new Worker(u, { type: 'module' });
    } else {
      this.w = new Worker(abs, { type: 'module' });
    }
    this.w.onmessage = e => {
      const m = e.data;
      this.history.push(m);
      if (m.type === 'csp') noteCsp('Worker', m);
      this.waiters = this.waiters.filter(w => !w.try(m));
    };
    this.w.onerror = e => {
      const m = { type: 'worker-error', message: e.message || 'erro ao carregar o Worker' };
      this.history.push(m);
      log('erro do Worker: ' + m.message);
      this.waiters = this.waiters.filter(w => !w.try(m));
    };
    this.ready = this.waitFor(m => m.type === 'ready', 8000);
  }
  waitFor(pred, ms = 20000, from = 0) {
    return new Promise((resolve, reject) => {
      for (let i = from; i < this.history.length; i++) if (pred(this.history[i])) return resolve(this.history[i]);
      const timer = setTimeout(() => { this.waiters = this.waiters.filter(w => w !== waiter); reject(new Error('tempo esgotado')); }, ms);
      const waiter = {
        try: m => {
          if (m.type === 'worker-error') { clearTimeout(timer); reject(new Error(m.message)); return true; }
          if (pred(m)) { clearTimeout(timer); resolve(m); return true; }
          return false;
        },
      };
      this.waiters.push(waiter);
    });
  }
  send(m) { this.w.postMessage(m); }
  /** Executa no modo rápido; resolve com 'result' ou 'error'. */
  async runFast(source, extra = {}, ms = 20000) {
    await this.ready;
    const id = nextId++;
    const mark = this.history.length;
    const p = this.waitFor(m => m.id === id && (m.type === 'result' || m.type === 'error'), ms, mark);
    this.send({ type: 'run-fast', id, source, ...extra });
    return p;
  }
  async runDebug(source, extra = {}) {
    await this.ready;
    const id = nextId++;
    const mark = this.history.length;
    this.send({ type: 'run-debug', id, source, ...extra });
    return { id, mark };
  }
  linesOf(id) { return this.history.filter(m => m.id === id && m.type === 'lines').flatMap(m => m.lines); }
  terminate() { this.w.terminate(); }
}
const fmt = v => JSON.stringify(v);
const sameArray = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---- testes ----
async function test1() {
  const c = new Client();
  try {
    const rdy = await c.ready;
    const r = await c.runFast(S.linspaceProbe);
    const ok = r.type === 'result' && sameArray(r.value, [0, 0.25, 0.5, 0.75, 1]);
    setResult('1', ok ? 'PASS' : 'FAIL', r.type === 'result' ? 'rt.linspace(0,1,5) = ' + fmt(r.value) : r.name + ': ' + r.message);
  } catch (e) { setResult('1', 'FAIL', e.message); } finally { c.terminate(); }
}

async function test2() {
  const before = cspEvents.length;
  const c = new Client();
  try {
    const r = await c.runFast(S.linspaceProbe);
    await sleep(300); // dá tempo aos eventos de violação
    const novas = cspEvents.length - before;
    const ok = r.type === 'result' && novas === 0;
    setResult('2', ok ? 'PASS' : 'FAIL', (r.type === 'result' ? 'import() do Blob executou' : 'erro: ' + r.name + ': ' + r.message) + '; violações de CSP: ' + novas);
  } catch (e) { setResult('2', 'FAIL', e.message); } finally { c.terminate(); }
}

async function evalTest(kind, id) {
  const c = new Client(kind);
  try {
    const r = await c.runFast(S.evalProbe);
    if (r.type !== 'result') return setResult(id, 'FAIL', 'o código gerado não executou: ' + r.name + ': ' + r.message);
    const v = r.value;
    setResult(id, v.blocked ? 'PASS' : 'FAIL', v.blocked ? 'eval lançou ' + v.name + ': ' + v.message : 'eval FOI PERMITIDO no Worker (valor ' + v.value + '); a CSP da página não alcançou este Worker');
  } catch (e) { setResult(id, 'FAIL', e.message); } finally { c.terminate(); }
}
const test3 = () => evalTest('url', '3');
const test3b = () => evalTest('blob', '3b');

async function test3c() {
  const c = new Client('blob');
  const partes = {};
  try {
    const rdy = await c.ready; // (d) o Worker enviou 'ready' à página apesar da neutralização
    partes.comunicacao = rdy.type === 'ready';
    const a = await c.runFast(S.linspaceProbe);
    partes.core = a.type === 'result' && sameArray(a.value, [0, 0.25, 0.5, 0.75, 1]);
    partes.blobGerado = a.type === 'result'; // import() do Blob dentro do Worker via Blob
    const b = await c.runFast(S.evalProbe);
    partes.evalBloqueado = b.type === 'result' && b.value.blocked === true;
    const id = nextId++;
    c.send({ type: 'ping', id });
    const pong = await c.waitFor(m => m.id === id, 2000, 0).catch(() => null);
    partes.pong = !!pong;
    const k = await c.runFast(S.capabilitiesProbe);
    partes.postMessageGeradoBloqueado = k.type === 'result' && String(k.value.postMessage).startsWith('bloqueado');
    const ok = Object.values(partes).every(Boolean);
    let det = fmt(partes);
    if (a.type === 'error') det += ' | erro do código gerado: ' + a.name + ': ' + a.message;
    if (b.type === 'result') det += ' | eval: ' + (b.value.blocked ? b.value.name + ': ' + b.value.message : 'PERMITIDO');
    setResult('3c', ok ? 'PASS' : 'FAIL', det);
  } catch (e) { setResult('3c', 'FAIL', e.message + ' | ' + fmt(partes)); } finally { c.terminate(); }
}

async function test4() {
  const c = new Client();
  try {
    const rdy = await c.ready;
    const r = await c.runFast(S.capabilitiesProbe);
    if (r.type !== 'result') return setResult('4', 'FAIL', r.name + ': ' + r.message);
    const ok = Object.values(r.value).every(v => v.startsWith('bloqueado'));
    setResult('4', ok ? 'PASS' : 'FAIL', fmt(r.value) + ' | bootstrap: ' + fmt(rdy.neutralized));
  } catch (e) { setResult('4', 'FAIL', e.message); } finally { c.terminate(); }
}

async function test5() {
  const c = new Client();
  try {
    const { id, mark } = await c.runDebug(S.debugExample, { delayMs: 80 });
    const is = t => m => m.id === id && m.type === t;
    // Espera ao menos 2 linhas e pede Pause.
    await c.waitFor(m => m.id === id && m.type === 'lines' && c.linesOf(id).length >= 2, 5000, mark);
    c.send({ type: 'pause' });
    await c.waitFor(is('paused'), 5000, mark);
    const nPause = c.linesOf(id).length;
    await sleep(500);
    const parado = c.linesOf(id).length === nPause;
    // Step: exatamente uma linha a mais e nova pausa.
    const mStep = c.history.length;
    c.send({ type: 'step' });
    await c.waitFor(is('paused'), 5000, mStep);
    const umaLinha = c.linesOf(id).length === nPause + 1;
    // Continue até o fim.
    c.send({ type: 'continue' });
    const done = await c.waitFor(is('done'), 8000, mark);
    const linhas = c.linesOf(id);
    const out = c.history.filter(m => m.id === id && m.out).flatMap(m => m.out);
    const ordem = sameArray(linhas, S.debugExampleLines);
    const saidaOk = out.includes('x = 15') && out.includes('x = 15') && done.result === 15;
    const ok = parado && umaLinha && ordem && saidaOk;
    setResult('5', ok ? 'PASS' : 'FAIL',
      'linhas ' + fmt(linhas) + '; sem avanço em pausa: ' + parado + '; Step avançou 1: ' + umaLinha + '; ordem esperada: ' + ordem + '; retorno ' + fmt(done.result) + '; saída ' + fmt(out));
  } catch (e) { setResult('5', 'FAIL', e.message); } finally { c.terminate(); }
}

async function test6() {
  let c = new Client();
  try {
    await c.ready;
    const id = nextId++;
    c.send({ type: 'run-fast', id, source: S.infiniteLoop });
    let resp = null;
    try { resp = await c.waitFor(m => m.id === id, 700, 0); } catch (e) { /* esperado: sem resposta */ }
    const semResposta = resp === null;
    const ping = nextId++;
    let pong = null;
    c.send({ type: 'ping', id: ping });
    try { pong = await c.waitFor(m => m.id === ping, 400, 0); } catch (e) { /* esperado */ }
    c.terminate();
    const c2 = new Client();
    const r = await c2.runFast(S.linspaceProbe);
    c2.terminate();
    const ok = semResposta && pong === null && r.type === 'result';
    setResult('6', ok ? 'PASS' : 'FAIL', 'Worker preso sem responder: ' + (semResposta && pong === null) + '; novo Worker após terminate() executou: ' + (r.type === 'result'));
  } catch (e) { setResult('6', 'FAIL', e.message); c.terminate(); }
}

async function test7() {
  const c = new Client();
  try {
    const t = performance.now();
    const r = await c.runFast(S.backEdgeLoop, { deadlineMs: 300 }, 8000);
    const dt = performance.now() - t;
    const id = nextId++;
    c.send({ type: 'ping', id });
    const pong = await c.waitFor(m => m.id === id, 2000, 0).catch(() => null);
    const r2 = pong ? await c.runFast(S.linspaceProbe) : null;
    const ok = r.type === 'error' && r.name === 'LimitError' && r.line === 3 && !!pong && r2 && r2.type === 'result';
    setResult('7', ok ? 'PASS' : 'FAIL', 'erro ' + r.name + ' na linha ' + r.line + ' após ' + dt.toFixed(0) + ' ms (prazo 300 ms); mesmo Worker respondeu: ' + !!pong + '; nova execução no mesmo Worker: ' + !!(r2 && r2.type === 'result'));
  } catch (e) { setResult('7', 'FAIL', e.message); } finally { c.terminate(); }
}

async function test8() {
  const c = new Client();
  try {
    await c.ready;
    const esperado = S.expectedLoopSum();
    const rapido = [], yielded = [];
    let correto = true;
    for (let i = 0; i < 3; i++) {
      const r = await c.runFast(S.fastLoop, {}, 60000);
      if (r.type !== 'result' || r.value !== esperado) correto = false; else rapido.push(r.ms);
    }
    for (let i = 0; i < 3; i++) {
      const { id, mark } = await c.runDebug(S.debugLoop, { quiet: true });
      const d = await c.waitFor(m => m.id === id && (m.type === 'done' || m.type === 'error'), 120000, mark);
      if (d.type !== 'done' || d.result !== esperado || d.yields !== S.N_LOOP) correto = false; else yielded.push(d.ms);
    }
    const f = a => a.map(x => x.toFixed(0)).join(' / ') + ' ms (mín. ' + Math.min(...a).toFixed(0) + ' ms)';
    setResult('8', correto ? 'PASS' : 'FAIL',
      '10^7 iterações, 3 execuções. Modo rápido: ' + f(rapido) + '. Com yield por iteração (condutor, sem enviar linhas): ' + f(yielded));
  } catch (e) { setResult('8', 'FAIL', e.message); } finally { c.terminate(); }
}

const RUNNERS = { '1': test1, '2': test2, '3': test3, '4': test4, '5': test5, '6': test6, '7': test7, '8': test8, '3b': test3b, '3c': test3c };
async function runOne(id) {
  setResult(id, 'executando…', '');
  try { await RUNNERS[id](); } catch (e) { setResult(id, 'FAIL', e.message); }
}
document.querySelectorAll('button[data-test]').forEach(b => b.addEventListener('click', () => runOne(b.dataset.test)));
$('run-all').addEventListener('click', async () => {
  $('run-all').disabled = true;
  for (const id of ['1', '2', '3', '3b', '3c', '4', '5', '6', '7', '8']) await runOne(id);
  $('run-all').disabled = false;
});

// ---- depuração manual ----
let manual = null;
const dbg = { start: $('dbg-start'), pause: $('dbg-pause'), step: $('dbg-step'), cont: $('dbg-continue') };
function dbgButtons(running, paused) {
  dbg.start.disabled = running;
  dbg.pause.disabled = !running || paused;
  dbg.step.disabled = !running || !paused;
  dbg.cont.disabled = !running || !paused;
}
dbg.start.addEventListener('click', async () => {
  if (manual) manual.terminate();
  manual = new Client();
  const c = manual;
  c.w.addEventListener('message', e => {
    const m = e.data;
    if (m.type === 'lines') log('linha(s) ' + fmt(m.lines) + (m.out ? ' saída ' + fmt(m.out) : ''));
    if (m.type === 'paused') { log('pausado na linha ' + m.line); dbgButtons(true, true); }
    if (m.type === 'done' || m.type === 'error') { log('depuração terminou: ' + m.type + (m.message ? ' ' + m.message : '')); dbgButtons(false, false); }
  });
  dbgButtons(true, false);
  await c.runDebug(S.debugExample, { delayMs: 400 });
});
dbg.pause.addEventListener('click', () => manual && manual.send({ type: 'pause' }));
dbg.step.addEventListener('click', () => manual && manual.send({ type: 'step' }));
dbg.cont.addEventListener('click', () => { if (manual) { manual.send({ type: 'continue' }); dbgButtons(true, false); } });

$('copy').addEventListener('click', async () => {
  const text = JSON.stringify({ userAgent: navigator.userAgent, results, cspEvents }, null, 2);
  try { await navigator.clipboard.writeText(text); $('copy-status').textContent = 'copiado'; }
  catch (e) { $('copy-status').textContent = 'não foi possível copiar; veja o log'; log(text); }
});
log('Página pronta. Clique em "Executar todos".');
