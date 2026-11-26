import test from 'node:test';
import assert from 'node:assert/strict';
import {messages, patterns} from '../assets/js/legacy-locales/opamp-pid.js';

function translate(value, language) {
  const exact = messages[value];
  if (exact) return exact[language === 'es' ? 1 : 0];
  for (const pattern of patterns) {
    const match = value.match(new RegExp(pattern.source));
    if (match) return value.replace(new RegExp(pattern.source), pattern[language]);
  }
  return value;
}

test('regex-source escaping matches literal separators and plus signs', () => {
  const simple = 'Saída mínima: -1.250 V | máxima: 14.500 V | amostras limitadas: 2.4%';
  const schmitt = `${simple} | Limiares: -4.125 V e 5.875 V`;
  assert.match(translate(simple, 'en'), /^Minimum output: -1\.250 V \| maximum: 14\.500 V \| clipped samples: 2\.4%$/);
  assert.match(translate(schmitt, 'es'), /^Salida mínima: -1\.250 V \| máxima: 14\.500 V \| muestras limitadas: 2\.4% \| umbrales: -4\.125 V y 5\.875 V$/);
  assert.equal(translate(simple, 'en').includes('amostras limitadas'), false);
  assert.equal(translate(schmitt, 'es').includes('Limiares'), false);
  assert.equal(patterns.find(p => p.source.includes('Saída mínima')).source.includes('\\\\|'), false);
});

test('formula captions translate prose while preserving formula fragments', () => {
  const comparator = 'Vo = V+ se V1 > Vref; senão V−';
  const schmitt = 'Schmitt inversor: Vlim = (R2 Vref + R1 Vo)/(R1+R2)';
  assert.equal(translate(comparator, 'en'), 'Vo = V+ if V1 > Vref; otherwise V−');
  assert.equal(translate(comparator, 'es'), 'Vo = V+ si V1 > Vref; en caso contrario V−');
  assert.equal(translate(schmitt, 'en'), 'Inverting Schmitt trigger: Vlim = (R2 Vref + R1 Vo)/(R1+R2)');
  assert.equal(translate(schmitt, 'es'), 'Disparador Schmitt inversor: Vlim = (R2 Vref + R1 Vo)/(R1+R2)');
});

test('dynamic labels and values remain complete in both locales', () => {
  for (const [source, expectedEn, expectedEs] of [
    ['R3 (kΩ)', 'R3 (kΩ)', 'R3 (kΩ)'],
    ['Cf (nF)', 'Cf (nF)', 'Cf (nF)'],
    ['Frequência (Hz)', 'Frequency (Hz)', 'Frecuencia (Hz)'],
    ['Amplitude (V)', 'Amplitude (V)', 'Amplitud (V)'],
  ]) {
    assert.equal(translate(source, 'en'), expectedEn);
    assert.equal(translate(source, 'es'), expectedEs);
  }
});
