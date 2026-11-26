import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {legacyTranslations, translateExact, translateFrame, translateText} from '../assets/js/legacy-i18n.js';
import {installPresentationHooks, redrawPresentation} from '../assets/js/legacy-runtime.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');

test('legacy localization is wrapper-only and preserves every provenance hash', async () => {
  const provenance = JSON.parse(await read('docs/provenance.json'));
  for (const entry of provenance.files) {
    assert.equal(hash(await read(entry.source)), entry.sourceSha256, entry.source);
    assert.equal(hash(await read(entry.integrated)), entry.integratedSha256, entry.integrated);
    const wrapper = await read(entry.integrated.replace('app.html', 'index.html'));
    assert.ok(wrapper.includes('assets/js/legacy-i18n.js'));
  }
});

test('adapter includes reversible English and Spanish UI mappings', async () => {
  const adapter = await read('assets/js/legacy-i18n.js');
  for (const phrase of ['Restaurar valores', 'Tensão de entrada', 'Modelo matemático', 'Copiar MATLAB']) {
    assert.ok(adapter.includes(phrase), 'missing translation source: ' + phrase);
  }
  assert.match(adapter, /language === 'pt-BR'/);
  assert.match(adapter, /languagechange/);
  assert.match(adapter, /MutationObserver/);
  assert.match(adapter, /script,style,canvas,math,code,pre/);
});

test('canvas and dialog hooks preserve numbers, coordinates, default input and return values', () => {
  const calls=[];
  class Context {fillText(...args){calls.push(['fill',this,...args]);return 'drawn';} strokeText(...args){calls.push(['stroke',this,...args]);}}
  const win={CanvasRenderingContext2D:Context,Event:class {constructor(type){this.type=type;}},dispatchEvent(event){calls.push(['event',event.type]);return true;},prompt(...args){calls.push(['prompt',...args]);return 'user value';},confirm(...args){calls.push(['confirm',...args]);return false;}};
  installPresentationHooks(win,text=>translateText(text,'en'));
  const context=new Context();
  assert.equal(context.fillText('Tempo (ms)',10,20,300),'drawn');
  assert.deepEqual(calls.at(-1),['fill',context,'Time (ms)',10,20,300]);
  context.fillText(12.5,5,6);
  assert.deepEqual(calls.at(-1),['fill',context,12.5,5,6]);
  const hooked=Context.prototype.fillText;
  installPresentationHooks(win,text=>translateText(text,'es'));
  assert.equal(Context.prototype.fillText,hooked,'hooks must not stack on language changes');
  context.fillText('Tempo (ms)',10,20);
  assert.equal(calls.at(-1)[2],'Tiempo (ms)');
  assert.equal(win.prompt('Copie o link:','http://example.test/?v=12.5'),'user value');
  assert.equal(calls.at(-1)[2],'http://example.test/?v=12.5');
  assert.equal(win.confirm('unchanged'),false);
  redrawPresentation(win);
  assert.deepEqual(calls.at(-1),['event','resize']);
});

test('dynamic translation preserves numeric substrings and returns to its original source', () => {
  const original='1220 períodos simulados • 160 passos por período';
  assert.equal(translateText(original,'en'),'1220 periods simulated • 160 steps per period');
  assert.equal(translateText(original,'es'),'1220 períodos simulados • 160 pasos por período');
  assert.equal(translateText(original,'pt-BR'),original);
  for(const source of ['42.5','1e-9','Vout = Vin·D','R1','jωL'])assert.equal(translateText(source,'es'),source);
  assert.equal(translateText('Erro na planta: símbolo inválido perto de "Quadrada"','es'),'Error en la planta: símbolo no válido cerca de "Quadrada"');
  const author='Projeto de controladores SISO — baseado no PythonSisoDesignApp (Prof. Lucas V. Bellinaso, UFSM)';
  for(const code of ['en','es'])assert.ok(translateText(author,code).includes('PythonSisoDesignApp (Prof. Lucas V. Bellinaso, UFSM)'));
  const dab='Degrau efetivo: 2.0000 ms. Resíduo do ponto fixo: 2.67e-12. Maior resíduo do balanço de potência por período: 1.88e-7 W. Último período não implica regime permanente.\nJanela fora da simulação.';
  const result=translateText(dab,'en');
  assert.match(result,/^Effective step: 2\.0000 ms/);
  assert.ok(result.endsWith('\nWindow is outside the simulation interval.'));
  assert.deepEqual(result.match(/\d+(?:\.\d+)?(?:e-\d+)?/g),dab.match(/\d+(?:\.\d+)?(?:e-\d+)?/g));
});

test('exact UI translation is reversible and leaves user values and formulas alone', () => {
  const source = 'Tensão de entrada';
  const en = translateExact(source, source, 'en', legacyTranslations);
  const es = translateExact(en, source, 'es', legacyTranslations);
  assert.equal(en, 'Input voltage');
  assert.equal(es, 'Tensión de entrada');
  assert.equal(translateExact(es, source, 'pt-BR', legacyTranslations), source);
  assert.equal(translateExact('42.5', '42.5', 'en', legacyTranslations), '42.5');
  assert.equal(translateExact('Vout = Vin·D', 'Vout = Vin·D', 'es', legacyTranslations), 'Vout = Vin·D');
  assert.equal(translateExact('custom user text', 'custom user text', 'en', legacyTranslations), 'custom user text');
});

test('frame walker handles reused dynamic text, attributes, and protects editable content', () => {
  globalThis.NodeFilter = {SHOW_TEXT: 4};
  const makeText = (text, tag = 'div') => ({
    nodeValue: text,
    parentElement: {
      closest: selector => selector.includes(tag) ? {} : null,
      getAttribute: () => null
    }
  });
  const nodes = [makeText('Pausar'), makeText('Pausar', 'textarea'),makeText('Ponte 1','svg')];
  const separator=makeText(' a ');
  separator.parentElement.closest=selector=>selector==='.gainbox'?{}:null;
  nodes.push(separator,makeText('a'));
  const author='Projeto de controladores SISO — baseado no PythonSisoDesignApp (Prof. Lucas V. Bellinaso, UFSM)';
  nodes.push(makeText(author));
  let cursor = 0;
  const attrs = new Map([['aria-label', 'Tensão de entrada']]);
  const el = {
    hasAttribute: name => attrs.has(name),
    getAttribute: name => attrs.get(name),
    setAttribute: (name, value) => attrs.set(name, value)
  };
  const doc = {
    body: {},
    documentElement:{lang:'pt-BR'},
    createTreeWalker: () => ({nextNode: () => nodes[cursor++] || null}),
    querySelectorAll: selector => selector==='pre,code'?[]:[el]
  };
  const frame = {contentDocument: doc};
  cursor = 0;
  translateFrame(frame, 'en');
  assert.equal(doc.documentElement.lang,'en');
  assert.equal(nodes[0].nodeValue, 'Pause');
  assert.equal(nodes[1].nodeValue, 'Pausar');
  assert.equal(nodes[2].nodeValue, 'Bridge 1');
  assert.equal(separator.nodeValue,' to ');
  assert.equal(nodes[4].nodeValue,'a','the mathematical variable must stay intact');
  assert.ok(nodes[5].nodeValue.startsWith('SISO controller design'));
  assert.equal(attrs.get('aria-label'), 'Input voltage');

  nodes[0].nodeValue = 'Reiniciar';
  cursor = 0;
  translateFrame(frame, 'en');
  assert.equal(nodes[0].nodeValue, 'Restart');
  assert.equal(attrs.get('aria-label'), 'Input voltage');

  cursor=0;
  translateFrame(frame,'es');
  assert.ok(nodes[5].nodeValue.startsWith('Diseño de controladores SISO'));
  assert.ok(nodes[5].nodeValue.endsWith('PythonSisoDesignApp (Prof. Lucas V. Bellinaso, UFSM)'));

  cursor = 0;
  translateFrame(frame, 'pt-BR');
  assert.equal(doc.documentElement.lang,'pt-BR');
  assert.equal(nodes[0].nodeValue, 'Reiniciar');
  assert.equal(nodes[1].nodeValue, 'Pausar');
  assert.equal(nodes[2].nodeValue, 'Ponte 1');
  assert.equal(separator.nodeValue,' a ');
  assert.equal(nodes[5].nodeValue,author);
  assert.equal(attrs.get('aria-label'), 'Tensão de entrada');
});
