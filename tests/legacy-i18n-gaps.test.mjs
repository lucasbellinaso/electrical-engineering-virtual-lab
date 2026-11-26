import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {messages as opampPid} from '../assets/js/legacy-locales/opamp-pid.js';
import {messages as power} from '../assets/js/legacy-locales/power.js';

const catalog = JSON.parse(await readFile(new URL('../data/simulators.json', import.meta.url), 'utf8'));

test('Op-amp input 2 offset label is translated like the neighbouring input 2 labels', () => {
  assert.deepEqual(opampPid['Offset entrada 2 (V)'], ['Input 2 offset (V)', 'Offset de la entrada 2 (V)']);
  assert.ok(opampPid['Amplitude entrada 2 (V)']);
});

test('Buck PID step-button captions use the decimal separator of each language', () => {
  assert.deepEqual(opampPid['Vref × 1,25'], ['Vref × 1.25', 'Vref × 1,25']);
  assert.deepEqual(opampPid['Vin × 0,75'], ['Vin × 0.75', 'Vin × 0,75']);
});

test('Buck conduction-mode value is translated', () => {
  assert.deepEqual(power['DCM / limite'], ['DCM / limit', 'DCM / límite']);
  assert.ok(power['Modo de condução']);
});

test('Every catalog reference title has English, Portuguese and Spanish text', () => {
  for (const item of catalog) {
    for (const reference of item.references ?? []) {
      for (const language of ['en', 'pt-BR', 'es']) {
        assert.ok(reference.title?.[language]?.trim(), `${item.id}: reference title ${language}`);
      }
      // Bibliographic citations are identical in every language; translated references must not fall back to another language.
      if (reference.title.en !== reference.title['pt-BR']) {
        assert.notEqual(reference.title.es, reference.title['pt-BR'], `${item.id}: Spanish reference equals Portuguese`);
        assert.notEqual(reference.title.es, reference.title.en, `${item.id}: Spanish reference equals English`);
      }
    }
  }
});
