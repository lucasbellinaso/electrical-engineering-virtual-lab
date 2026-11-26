import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {legacyTranslations, translateExact, translateFrame} from '../assets/js/legacy-i18n.js';

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
  assert.match(adapter, /script,style,svg,canvas,math,code,pre/);
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
  const nodes = [makeText('Pausar'), makeText('Pausar', 'textarea')];
  let cursor = 0;
  const attrs = new Map([['aria-label', 'Tensão de entrada']]);
  const el = {
    hasAttribute: name => attrs.has(name),
    getAttribute: name => attrs.get(name),
    setAttribute: (name, value) => attrs.set(name, value)
  };
  const doc = {
    body: {},
    createTreeWalker: () => ({nextNode: () => nodes[cursor++] || null}),
    querySelectorAll: () => [el]
  };
  const frame = {contentDocument: doc};
  cursor = 0;
  translateFrame(frame, 'en');
  assert.equal(nodes[0].nodeValue, 'Pause');
  assert.equal(nodes[1].nodeValue, 'Pausar');
  assert.equal(attrs.get('aria-label'), 'Input voltage');

  nodes[0].nodeValue = 'Reiniciar';
  cursor = 0;
  translateFrame(frame, 'en');
  assert.equal(nodes[0].nodeValue, 'Restart');
  assert.equal(attrs.get('aria-label'), 'Input voltage');

  cursor = 0;
  translateFrame(frame, 'pt-BR');
  assert.equal(nodes[0].nodeValue, 'Reiniciar');
  assert.equal(nodes[1].nodeValue, 'Pausar');
  assert.equal(attrs.get('aria-label'), 'Tensão de entrada');
});
