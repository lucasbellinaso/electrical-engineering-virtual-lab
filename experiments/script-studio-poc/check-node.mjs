/**
 * Verificação em Node (fora do navegador) da lógica da fase 0: condutor, rt e geradores.
 * Não substitui os testes da página (Worker, CSP, Blob URL). Uso: node check-node.mjs
 */
import assert from 'node:assert/strict';
import { linspace } from '../../assets/js/core/numeric.js';
import { Conductor } from './conductor.js';
import { createRt, loadGenerated, LimitError } from './runtime-core.js';
import * as S from './samples.js';

const io = { toUrl: s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64'), revoke() {} };
const load = src => loadGenerated(src, io);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0;
const ok = name => console.log('ok ' + (++n) + ' - ' + name);

// 1. rt.linspace dentro do código gerado
{
  const mod = await load(S.linspaceProbe);
  assert.deepEqual(mod.main(createRt({ linspace })), [0, 0.25, 0.5, 0.75, 1]);
  ok('código gerado usa rt.linspace do core');
}

// 7. back-edge com prazo
{
  const mod = await load(S.backEdgeLoop);
  const rt = createRt({ linspace }, { deadlineMs: 100 });
  const t = performance.now();
  assert.throws(() => mod.main(rt), e => e instanceof LimitError && e.line === 3);
  const dt = performance.now() - t;
  assert.ok(dt >= 100 && dt < 1000, 'dt=' + dt);
  ok('verificação nos back-edges lança LimitError com a linha (' + dt.toFixed(0) + ' ms)');
}

// 5. condutor: ordem das linhas, saída e retorno (sem pausa)
function makeConductor(src, extra = {}) {
  return load(src).then(mod => {
    const rt = createRt({ linspace });
    const msgs = [];
    const c = new Conductor(mod.main({}, rt), { emit: m => msgs.push(m), takeOut: rt.takeOut, ...extra });
    return { c, msgs };
  });
}
const linesOf = msgs => msgs.filter(m => m.type === 'lines').flatMap(m => m.lines);
{
  const { c, msgs } = await makeConductor(S.debugExample);
  await c.run();
  assert.deepEqual(linesOf(msgs), S.debugExampleLines);
  const done = msgs.at(-1);
  assert.equal(done.type, 'done');
  assert.equal(done.result, 15);
  assert.ok(msgs.flatMap(m => m.out || []).includes('x = 15'));
  ok('condutor entrega as linhas na ordem 1,3,4x5,7 e o retorno 15');
}

// 5. Pause / Step / Continue
{
  const { c, msgs } = await makeConductor(S.debugExample, { delayMs: 30 });
  const p = c.run();
  while (linesOf(msgs).length < 2) await sleep(5);
  c.handle('pause');
  while (!msgs.some(m => m.type === 'paused')) await sleep(5);
  const n0 = linesOf(msgs).length;
  await sleep(200);
  assert.equal(linesOf(msgs).length, n0, 'sem avanço em pausa');
  const np = msgs.filter(m => m.type === 'paused').length;
  c.handle('step');
  while (msgs.filter(m => m.type === 'paused').length === np) await sleep(5);
  assert.equal(linesOf(msgs).length, n0 + 1, 'Step avança exatamente uma linha');
  c.handle('continue');
  await p;
  assert.deepEqual(linesOf(msgs), S.debugExampleLines);
  assert.equal(msgs.at(-1).type, 'done');
  ok('Pause, Step (1 linha) e Continue preservam a ordem completa');
}

// Step quando o gerador termina em pausa
{
  const { c, msgs } = await makeConductor('export function* main(env, rt) { yield 1; return 7; }', { delayMs: 20 });
  c.handle('pause');
  const p = c.run();
  while (!msgs.some(m => m.type === 'paused')) await sleep(5);
  c.handle('step'); // line 1
  await sleep(50);
  c.handle('step'); // fim
  await p;
  assert.equal(msgs.at(-1).type, 'done');
  assert.equal(msgs.at(-1).result, 7);
  ok('Step além da última instrução encerra com done');
}

// Lotes: sem uma mensagem por instrução
{
  const { c, msgs } = await makeConductor(
    'export function* main(env, rt) { for (let i = 0; i < 50000; i++) { yield 2; } }');
  await c.run();
  const batches = msgs.filter(m => m.type === 'lines');
  assert.equal(linesOf(msgs).length, 50000);
  assert.ok(batches.length <= 50000 / 100, 'lotes=' + batches.length);
  assert.deepEqual(batches.map(b => b.seq), batches.map((_, i) => i + 1));
  ok('50000 yields viram ' + batches.length + ' mensagens, com seq crescente');
}

// Erro com linha
{
  const { c, msgs } = await makeConductor('export function* main(env, rt) { yield 5; throw new Error("boom"); }');
  await c.run();
  const e = msgs.at(-1);
  assert.equal(e.type, 'error');
  assert.equal(e.line, 5);
  ok('erro no gerador reporta a linha do último yield');
}

// Prazo no condutor
{
  const { c, msgs } = await makeConductor(
    'export function* main(env, rt) { while (true) { yield 9; } }', { deadlineMs: 100, quiet: true });
  await c.run();
  const e = msgs.at(-1);
  assert.equal(e.type, 'error');
  assert.equal(e.name, 'LimitError');
  assert.equal(e.line, 9);
  ok('prazo no condutor encerra com LimitError e a linha');
}

// 8. medição (informativa; em Node, não representa os navegadores)
{
  const expected = S.expectedLoopSum();
  const fast = await load(S.fastLoop);
  const t = performance.now();
  const v = fast.main(createRt({ linspace }));
  const tFast = performance.now() - t;
  assert.equal(v, expected);
  const { c, msgs } = await makeConductor(S.debugLoop, { quiet: true });
  await c.run();
  const d = msgs.at(-1);
  assert.equal(d.type, 'done');
  assert.equal(d.result, expected);
  assert.equal(d.yields, S.N_LOOP);
  ok('10^7 iterações em Node ' + process.version + ': rápido ' + tFast.toFixed(0) + ' ms; com yield por iteração ' + d.ms.toFixed(0) + ' ms');
}
console.log('todos os ' + n + ' grupos passaram');
