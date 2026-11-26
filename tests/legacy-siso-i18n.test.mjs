import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {messages, patterns} from '../assets/js/legacy-locales/siso.js';

const html = readFileSync(new URL('../simulators/control-systems/siso/app.html', import.meta.url), 'utf8')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const sourceTextNodes = html.split(/<[^>]*>/).map(value => value.trim()).filter(Boolean);

function translate(source, locale) {
  const exact = messages[source];
  if (exact) return exact[locale === 'es' ? 1 : 0];
  for (const pattern of patterns) {
    const match = new RegExp(pattern.source).exec(source);
    if (match) return (locale === 'es' ? pattern.es : pattern.en).replace(/\$(\d+)/g, (_, n) => match[Number(n)] ?? '');
  }
  return source;
}

test('SISO text-node fragments split by inline markup are translated', () => {
  const cases = [
    ['Malha aberta: T = G', 'Open loop: T = G', 'Lazo abierto: T = G'],
    ['. Entradas: referência r e distúrbios d', '. Inputs: reference r and disturbances d', '. Entradas: referencia r y perturbaciones d'],
    [') ou expressão em ', ') or an expression in ', ') o una expresión en '],
    ['Planta G', 'Plant G', 'Planta G'],
    ['+ Adicionar polo/zero', '+ Add pole/zero', '+ Añadir polo/cero'],
    ['+ Adicionar sinal', '+ Add signal', '+ Añadir señal'],
  ];
  for (const [source, en, es] of cases) {
    assert.ok(sourceTextNodes.includes(source.trim()), `expected HTML text node ${JSON.stringify(source.trim())}`);
    assert.equal(translate(source, 'en'), en, `English translation for ${source}`);
    assert.equal(translate(source, 'es'), es, `Spanish translation for ${source}`);
  }
});

test('dynamic plot annotations translate labels and preserve computed values', () => {
  assert.equal(translate('Lugar das raízes', 'en'), 'Root locus');
  assert.equal(translate('MG = ∞', 'en'), 'GM = ∞');
  assert.equal(translate('zeros: -1', 'en'), 'zeros: -1');
  assert.equal(translate('polos: 0', 'en'), 'poles: 0');
  assert.equal(translate('ganho k (forma zpk): 1', 'es'), 'ganancia k (forma ZPK): 1');
  assert.equal(translate('MF = 29.4° em 0.1927 Hz', 'en'), 'PM = 29.4° at 0.1927 Hz');
  assert.equal(translate('MF = 29.4° em 0.1927 Hz', 'es'), 'MF = 29.4° a 0.1927 Hz');
  assert.equal(translate('MG = 6.2 dB em 3.1 Hz', 'en'), 'GM = 6.2 dB at 3.1 Hz');
  assert.equal(translate('Frequência deve ser menor que a de Nyquist (1.25 Hz).', 'es'), 'La frecuencia debe ser menor que la frecuencia de Nyquist (1.25 Hz).');
  assert.equal(translate('✓ Malha fechada estável (Padé)', 'es'), '✓ Lazo cerrado estable (Padé)');
});
