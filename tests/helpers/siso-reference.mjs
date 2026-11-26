// Carrega as funções numéricas ORIGINAIS do SISO (app.html, preservado byte a byte)
// num contexto isolado (vm), para testes de regressão antes/depois da extração.
// Não executa a interface: só avalia declarações de funções/constantes puras.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const file = new URL('../../simulators/control-systems/siso/app.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const script = html.slice(html.indexOf('<script>\n') + 9, html.lastIndexOf('</script>'));
const lines = script.split('\n');
const at = (marker) => lines.findIndex((l) => l.startsWith(marker));
// Trechos numéricos puros: polinômios/raízes/matrizes/estado (ptrim … pade) e FR/margens.
const a = at('function ptrim'), b = at('/* ------------------------- parser de polinômios');
const c = at('function makeFR'), d = at('function charFreq');
if ([a, b, c, d].some((i) => i < 0)) throw new Error('Marcadores do SISO não encontrados');
const code = [
  "'use strict'; const TWO_PI = 2 * Math.PI, R2D = 180 / Math.PI;",
  lines.slice(a, b).join('\n'),
  lines.slice(c, d).join('\n'),
  `({ptrim, pmul, padd, pscale, pdeg, plead, pprod, polyFromRoots, roots, aberth, matchRoots,
     zeros2, eye, mmul, madd, mscale, msolve, expm, charpoly, tf2ss, c2d, pade,
     makeFR, logspace, bisect, margins})`
].join('\n');

export const siso = vm.runInNewContext(code, {Math, Float64Array, Array, Error, isFinite});
