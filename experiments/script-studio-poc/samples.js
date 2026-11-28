/**
 * EEVL Script Studio · fase 0 · Código "gerado" escrito à mão, imitando o que o tradutor
 * produzirá (seção 5 de docs/SCRIPT-STUDIO.md). Strings: o conteúdo só é executado
 * dentro do Worker, por Blob URL.
 *
 * Observação: a amostra `evalProbe` contém uma chamada de eval. É o teste 3 da fase 0
 * (a CSP deve impedir a avaliação), executada somente como código gerado dentro do Worker.
 */
export const N_LOOP = 10000000;

export const linspaceProbe = [
  'export function main(rt) {',
  '  return rt.linspace(0, 1, 5);',
  '}',
].join('\n');

export const evalProbe = [
  'export function main(rt) {',
  '  try {',
  "    const v = eval('1');",
  '    return { blocked: false, value: v };',
  '  } catch (e) {',
  '    return { blocked: true, name: e.name, message: String(e.message) };',
  '  }',
  '}',
].join('\n');

export const capabilitiesProbe = [
  'export function main(rt) {',
  '  const tests = {',
  "    fetch: () => fetch('poc-probe.txt'),",
  '    XMLHttpRequest: () => new XMLHttpRequest(),',
  "    WebSocket: () => new WebSocket('wss://example.invalid/'),",
  "    importScripts: () => importScripts('poc-probe.js'),",
  "    indexedDB: () => indexedDB.open('poc'),",
  "    caches: () => caches.open('poc'),",
  "    postMessage: () => postMessage('x'),",
  "    'self.postMessage': () => self.postMessage('x'),",
  '  };',
  '  const out = {};',
  '  for (const k of Object.keys(tests)) {',
  '    try {',
  '      const r = tests[k]();',
  "      out[k] = 'PERMITIDO';",
  '      if (r && r.catch) r.catch(() => {});',
  '    } catch (e) {',
  "      out[k] = 'bloqueado: ' + e.name;",
  '    }',
  '  }',
  '  return out;',
  '}',
].join('\n');

/** Modo rápido: laço escalar de 10^7 iterações. */
export const fastLoop = [
  'export function main(rt) {',
  '  let s = 0;',
  '  for (let i = 0; i < ' + N_LOOP + '; i++) s += i % 7;',
  '  return s;',
  '}',
].join('\n');

/** Modo rápido: laço infinito sem verificação (só terminate() encerra). */
export const infiniteLoop = [
  'export function main(rt) {',
  '  while (true) {}',
  '}',
].join('\n');

/** Modo rápido: laço infinito com verificação no back-edge (linha 3 do script). */
export const backEdgeLoop = [
  'export function main(rt) {',
  '  let i = 0;',
  '  while (true) {',
  '    i++;',
  '    if (++rt.tick > 65535) rt.check(3);',
  '  }',
  '}',
].join('\n');

/** Modo de depuração: exemplo de laço da seção 5 (linhas 1, 3, 4 x5, 7). */
export const debugExample = [
  'export function* main(env, rt) {',
  '  yield 1; env.x = 0;',
  '  yield 3;',
  '  for (const k of rt.range(1, 5)) {',
  '    env.k = k;',
  '    yield 4; env.x = rt.plus(env.x, env.k); rt.show("x", env.x);',
  '  }',
  '  yield 7; rt.print([env.x], ["x"]);',
  '  return env.x;',
  '}',
].join('\n');
export const debugExampleLines = [1, 3, 4, 4, 4, 4, 4, 7];

/** Modo de depuração: o mesmo laço de 10^7 iterações, com yield por iteração. */
export const debugLoop = [
  'export function* main(env, rt) {',
  '  let s = 0;',
  '  for (let i = 0; i < ' + N_LOOP + '; i++) {',
  '    yield 3;',
  '    s += i % 7;',
  '  }',
  '  return s;',
  '}',
].join('\n');

/** Valor esperado dos dois laços de 10^7 iterações. */
export function expectedLoopSum() {
  let s = 0;
  for (let i = 0; i < N_LOOP; i++) s += i % 7;
  return s;
}
