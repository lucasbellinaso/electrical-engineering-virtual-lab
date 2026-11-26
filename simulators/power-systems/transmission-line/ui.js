import {initialize} from '../../../assets/js/common.js';
import {language} from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import * as c from '../../../assets/js/core/complex.js';
import {defaults, presets, solve} from './model.js';
import {steps} from './equations.js';

const $ = id => document.getElementById(id), form = $('parameters');
let dictionary = {}, result, selectedTerm = 'av', representation = 'twoport', experiment = 'lesson', errorCode = '';
const tr = (key, values = {}) => Object.entries(values).reduce((s, [k, v]) => s.replaceAll('{'+k+'}', String(v)), dictionary[language]?.[key] ?? dictionary.en?.[key] ?? key);
const number = (x, digits = 5) => new Intl.NumberFormat(language, {maximumSignificantDigits: digits, notation: x !== 0 && (Math.abs(x) < .001 || Math.abs(x) > 1e6) ? 'scientific' : 'standard'}).format(Object.is(x, -0) ? 0 : x);
const rectangular = z => `${number(z.re)} ${z.im < 0 ? '−' : '+'} j${number(Math.abs(z.im))}`;
const polar = z => `${number(c.abs(z))} ∠ ${number(c.abs(z) === 0 ? 0 : c.toPolarDeg(z).phase, 4)}°`;
const math = (node, latex, displayMode = true) => katex.render(latex, node, {displayMode, throwOnError: false, trust: false, output: 'htmlAndMathml'});
const text = (id, value) => { $(id).textContent = value; };
const termLatex = {av: 'AV_R', bi: 'BI_R', cv: 'CV_R', di: 'DI_R'};
function mathNumber(value, digits = 5) {
  const scientific = value !== 0 && (Math.abs(value) < .001 || Math.abs(value) > 1e6);
  const exponent = scientific ? Math.floor(Math.log10(Math.abs(value))) : 0;
  const mantissa = scientific ? value / 10 ** exponent : value;
  const formatted = new Intl.NumberFormat(language, {maximumSignificantDigits: digits}).formatToParts(Object.is(mantissa,-0) ? 0 : mantissa)
    .map(part => part.type === 'group' ? '\\,' : part.type === 'decimal' ? (part.value === ',' ? '{,}' : '.') : part.value).join('');
  return scientific ? `${formatted}\\times10^{${exponent}}` : formatted;
}
function inlineExplanation(node, value, symbols = /\b(?:AV_R|BI_R|CV_R|DI_R|A|B|C|D|S)\b|Ω/g) {
  const fragments = []; let offset = 0;
  for (const match of value.matchAll(symbols)) {
    fragments.push(document.createTextNode(value.slice(offset,match.index)));
    const span = document.createElement('span'), symbol = match[0];
    const latex = symbol === 'Ω' ? '\\Omega' : symbol === 'S' ? '\\mathrm{S}' : symbol === 'ℓ' ? '\\ell' : symbol === '|S_R|' ? '\\lvert S_R\\rvert' : symbol.replace('′',"'");
    math(span, latex, false);
    fragments.push(span); offset = match.index + symbol.length;
  }
  fragments.push(document.createTextNode(value.slice(offset)));node.replaceChildren(...fragments);
}
const parameterText = (node,value) => inlineExplanation(node,value,/\|S_R\||[VISZ]_[RSce]|[RLCG]′|ℓ|\bf\b/g);
const rectangularLatex = z => `\\left(${mathNumber(z.re)} ${z.im < 0 ? '-' : '+'} \\mathrm{j}\\,${mathNumber(Math.abs(z.im))}\\right)`;
function svgMath(latex, x, y, width, height, size = 18) {
  const rendered = katex.renderToString(latex,{displayMode:false,throwOnError:false,trust:false,output:'htmlAndMathml'});
  return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" class="svg-math" style="font-size:${size}px">${rendered}</div></foreignObject>`;
}

function read() {
  return Object.fromEntries(Object.keys(defaults).map(key => [key, typeof defaults[key] === 'number' ? form.elements[key].valueAsNumber : form.elements[key].value]));
}
function fill(p) {
  for (const [key, value] of Object.entries(p)) form.elements[key].value = value;
  $('length-slider').value = p.lengthKm;
  boundary();
}
function boundary() {
  const open = form.elements.mode.value === 'sending-open';
  $('load-controls').disabled = open;
  parameterText($('voltage-label'), tr(open ? 'vsInput' : 'vrInput'));
  parameterText($('boundary-note'), tr(open ? 'sendingBoundary' : 'receivingBoundary'));
}
function run() {
  boundary();
  try {
    result = solve(read()); errorCode = ''; $('error').hidden = true; $('results').hidden = false;
    $('length-slider').value = result.p.lengthKm;
    render();
  } catch (error) {
    result = null; errorCode = dictionary.en[error.code] ? error.code : 'invalid';
    $('results').hidden = true; $('error').hidden = false; text('error', tr(errorCode));
  }
}
function translate() {
  document.querySelectorAll('[data-m]').forEach(el => { el.textContent = tr(el.dataset.m); });
  document.querySelectorAll('.controls [data-m]').forEach(el => { if(el.tagName !== 'OPTION')parameterText(el,tr(el.dataset.m)); });
  document.querySelectorAll('[data-math]').forEach(el => math(el,el.dataset.math,false));
  document.querySelectorAll('[data-m-aria]').forEach(el => { el.setAttribute('aria-label', tr(el.dataset.mAria)); });
  document.title = tr('title') + ' · EEVL'; boundary();
  const predictionKey = {lesson: 'predictLesson', ferranti: 'predictFerranti', capacitive: 'predictCapacitive', long: 'predictLong'}[experiment];
  text('prediction', tr(predictionKey));
  if (errorCode) text('error', tr(errorCode));
  $('derivation').replaceChildren(...steps.map((equations, i) => {
    const section = document.createElement('div'); section.className = 'step';
    const h = document.createElement('h3'); h.textContent = tr(`step${i + 1}`);
    const p = document.createElement('p'); p.textContent = tr(`step${i + 1}Text`);
    section.append(h, p);
    equations.forEach(eq => { const div = document.createElement('div'); div.className = 'eq'; div.tabIndex = 0; div.setAttribute('role','region'); div.setAttribute('aria-label',h.textContent); math(div, eq); section.append(div); });
    return section;
  }));
  render();
}
function drawDiagram() {
  const r = result, isV = selectedTerm === 'av' || selectedTerm === 'cv';
  const selectedLetter = {av: 'A', bi: 'B', cv: 'C', di: 'D'}[selectedTerm];
  const arrows = `<path class="wire ${isV ? 'active-path' : ''}" d="M125 138V65m-5 8 5-8 5 8"/><path class="wire ${!isV ? 'active-path' : ''}" d="M580 27h65m-8-5 8 5-8 5"/>`;
  let middle;
  if (representation === 'twoport' || !r.pi) {
    middle = '<rect class="block" x="285" y="43" width="230" height="120" rx="5"/>' + [['A',350,88],['B',440,88],['C',350,129],['D',440,129]].map(([v,x,y]) => svgMath(selectedLetter === v ? `\\underline{${v}}` : v,x-16,y-26,50,40,22)).join('');
  } else {
    middle = `<path class="wire" d="M285 65h45m140 0h45M290 65v30m0 25v25m220-80v30m0 25v25"/><rect class="block" x="330" y="50" width="140" height="30"/><rect class="block" x="279" y="95" width="22" height="25"/><rect class="block" x="499" y="95" width="22" height="25"/>${svgMath('Z_e=B',330,50,140,30,16)}${svgMath('\\dfrac{Y_e}{2}',210,82,60,53,16)}${svgMath('\\dfrac{Y_e}{2}',530,82,60,53,16)}`;
  }
  const bottom = representation === 'twoport' || !r.pi ? 'H515m-230 0H80' : 'H80';
  $('diagram').innerHTML = `<title>${tr('diagramDescription')}</title><path class="wire" d="M80 65h205m230 0h205v80${bottom}V65"/><circle class="block" cx="80" cy="105" r="18"/><text x="80" y="110" text-anchor="middle">~</text><rect class="block" x="709" y="88" width="22" height="35"/>${middle}${arrows}<path class="wire" d="M190 27h60m-8-5 8 5-8 5M670 138V65m-5 8 5-8 5 8"/>${svgMath('I_S',195,-3,50,28)}${svgMath('I_R',590,-3,50,28)}${svgMath('V_S',137,88,55,35)}${svgMath('V_R',609,88,55,35)}<text x="80" y="183">${tr('source')}</text><text x="720" y="183" text-anchor="end">${tr('receiver')}</text>`;
  $('pi-values').hidden = representation !== 'pi';
  if (r.pi) math($('pi-values'),`Z_e=${rectangularLatex(r.pi.series)}\\,\\Omega,\\quad \\frac{Y_e}{2}=${rectangularLatex(c.scale(r.pi.shunt,1000))}\\,\\mathrm{mS}`,false);
  else text('pi-values',tr('piSingular'));
}
function contributions() {
  const term = (key, latex) => key === selectedTerm ? `\\boxed{${latex}}` : latex;
  math($('main-equation'), String.raw`\begin{aligned}V_S&=${term('av','AV_R')}+${term('bi','BI_R')}\\I_S&=${term('cv','CV_R')}+${term('di','DI_R')}\end{aligned}`);
  document.querySelectorAll('[data-term]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.term === selectedTerm));
    math(button,termLatex[button.dataset.term],false);
  });
  inlineExplanation($('term-description'), tr(selectedTerm));
  const z = result.contributions[selectedTerm], voltage = ['av','bi'].includes(selectedTerm), scaled = voltage ? c.scale(z, .001) : z;
  const unit = `\\mathrm{${voltage ? 'kV' : 'A'}}`, phase = c.abs(scaled) === 0 ? 0 : c.toPolarDeg(scaled).phase;
  math($('term-value'), `${rectangularLatex(scaled)}\\,${unit} = ${mathNumber(c.abs(scaled))}\\,\\angle\\, ${mathNumber(phase,4)}^{\\circ}\\,${unit}`,false);
  drawDiagram();
}
function profile() {
  const voltage = $('quantity').value === 'voltage', scale = voltage ? .001 : 1;
  const samples = result.samples, values = samples.map(s => c.abs(s[voltage ? 'voltage' : 'current']) * scale);
  const max = Math.max(...values, 1e-9) * 1.12, length = result.p.lengthKm;
  const width = Math.max(340, Math.min(800, $('profile').clientWidth)), left = 60, right = width - 15, bottom = 235;
  $('profile').setAttribute('viewBox', `0 0 ${width} 290`);
  const x = v => left + (length === 0 ? 0 : v / length * (right-left)), y = v => bottom - v / max * 190;
  let svg = `<title>${tr(voltage ? 'voltage' : 'current')}</title><desc>${tr('profileDescription')}</desc>`;
  for (let i = 0; i <= 4; i++) svg += `<path class="grid" d="M${left} ${y(max*i/4)}H${right}"/><text x="${left-8}" y="${y(max*i/4)+4}" text-anchor="end">${number(max*i/4,3)}</text><text x="${left+i/4*(right-left)}" y="256" text-anchor="middle">${number(length*i/4,3)}</text>`;
  svg += `<path class="wire" d="M${left} 42V235H${right}"/><text x="${left}" y="25">${tr(voltage ? 'voltage' : 'current')}</text><text x="${(left+right)/2}" y="282" text-anchor="middle">${tr('distanceAxis')}</text><path class="sending" d="${samples.map((s,i) => `${i ? 'L' : 'M'}${x(s.x).toFixed(2)} ${y(values[i]).toFixed(2)}`).join(' ')}"/><g id="profile-probe"></g>`;
  $('profile').innerHTML = svg;
  const index = Number($('probe').value), s = samples[index];
  $('profile-probe').innerHTML = `<path class="wire" stroke-dasharray="3 4" d="M${x(s.x)} 42V235"/><circle cx="${x(s.x)}" cy="${y(values[index])}" r="4" fill="var(--blue)"/>`;
  text('probe-value', `x = ${number(s.x)} km · V = ${polar(c.scale(s.voltage,.001))} kV · I = ${polar(s.current)} A`);
}
function phasors(id, sending, receiving, unit, label) {
  const max = Math.max(c.abs(sending), c.abs(receiving), 1e-9), scale = 105 / max;
  const arrow = (z, cls) => {
    const dx = z.re * scale, dy = -z.im * scale, norm = Math.hypot(dx,dy);
    if (norm < 1e-10) return '';
    const x = 180+dx, y = 145+dy, ux=dx/norm, uy=dy/norm;
    return `<path class="${cls}" d="M180 145L${x} ${y}m${-ux*8-uy*4} ${-uy*8+ux*4}L${x} ${y}l${-ux*8+uy*4} ${-uy*8-ux*4}"/>`;
  };
  $(id).innerHTML = `<title>${tr(label)}</title><text x="180" y="20" text-anchor="middle">${tr(label)}</text><path class="grid" d="M45 145H320M180 35V250"/><circle class="grid" cx="180" cy="145" r="105" fill="none"/><text x="320" y="136" text-anchor="end">Re (${unit})</text><text x="188" y="40">Im</text><text x="288" y="162" text-anchor="middle">${number(max,3)}</text>${arrow(receiving,'receiving')}${arrow(sending,'sending')}<path class="sending" d="M10 268h20"/><text x="36" y="272">S: ${polar(sending)} ${unit}</text><path class="receiving" d="M10 285h20"/><text x="36" y="289">R: ${polar(receiving)} ${unit}</text>`;
}
function render() {
  if (!result) return;
  const r = result;
  text('vs', number(c.abs(r.vs) * Math.sqrt(3) / 1000));
  text('vr', number(c.abs(r.vr) * Math.sqrt(3) / 1000));
  text('currents', `${number(c.abs(r.is))} / ${number(c.abs(r.ir))}`);
  $('powers').replaceChildren(...[
    tr('powerSummary', {sending: rectangular(c.scale(r.sendingPower,1e-6)), receiving: rectangular(c.scale(r.receivingPower,1e-6))}),
    tr('lossSummary', {loss: number(r.losses*1e-6), integral: number(r.integratedLosses*1e-6)})
  ].map(s => {const p=document.createElement('p');p.textContent=s;return p;}));
  $('abcd').innerHTML = ['A','B','C','D'].map(key => `<tr><th scope="row">${key} (${key==='B'?'Ω':key==='C'?'S':'1'})</th><td>${rectangular(r.exact[key])}</td><td>${polar(r.exact[key])}</td></tr>`).join('');
  text('line-values', `Z_c = ${rectangular(r.zc)} Ω · α = ${number(r.gamma.re)} Np/km · β = ${number(r.gamma.im)} rad/km`);
  text('residual', tr('residual', {value: number(r.determinantResidual)}));
  contributions(); profile();
  $('samples').innerHTML = r.samples.filter((_,i) => i%40 === 0).map(s => `<tr><td>${number(s.x)}</td><td>${number(c.abs(s.voltage)/1000)}</td><td>${number(c.toPolarDeg(s.voltage).phase)}</td><td>${number(c.abs(s.current))}</td><td>${number(c.abs(s.current)===0?0:c.toPolarDeg(s.current).phase)}</td></tr>`).join('');
  phasors('voltage-phasors', c.scale(r.vs,.001), c.scale(r.vr,.001), 'kV', 'voltagePhasors');
  phasors('current-phasors', r.is, r.ir, 'A', 'currentPhasors');
  const open = r.p.mode === 'sending-open', key = open ? 'vr' : 'vs', label = open ? 'V_R' : 'V_S';
  $('comparison').innerHTML = `<p>${tr('exact')}: ${label} = ${polar(c.scale(r[key],.001))} kV · I_S = ${polar(r.is)} A</p><p>${tr('nominal')}: ${label} = ${polar(c.scale(r.comparison[key],.001))} kV · I_S = ${polar(r.comparison.is)} A</p>`;
  text('comparison-error', tr('comparisonError', {terminal: label, value: number(r.errorPercent)}));
}
form.addEventListener('submit', event => {event.preventDefault();run();});
form.addEventListener('input', event => {
  if (event.target.name === 'mode') {
    form.elements.apparentMva.value = event.target.value === 'sending-open' ? 0 : defaults.apparentMva;
  }
  run();
});
$('length-slider').addEventListener('input', event => {form.elements.lengthKm.value = event.target.value;run();});
$('lossless').addEventListener('click', () => {form.elements.resistanceOhmKm.value=0;run();});
$('reset').addEventListener('click', () => selectExperiment('lesson'));
function selectExperiment(name) {
  experiment = name; fill(presets[name]);
  document.querySelectorAll('[data-preset]').forEach(button => {button.classList.toggle('active',button.dataset.preset===name);button.setAttribute('aria-pressed',String(button.dataset.preset===name));});
  run(); translate();
}
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => selectExperiment(button.dataset.preset)));
document.querySelectorAll('[data-term]').forEach(button => button.addEventListener('click', () => {selectedTerm=button.dataset.term;if(result)contributions();}));
for (const [id, value] of [['show-twoport','twoport'],['show-pi','pi']]) $(id).addEventListener('click', () => {
  representation = value; $('show-twoport').setAttribute('aria-pressed',String(value==='twoport'));$('show-pi').setAttribute('aria-pressed',String(value==='pi'));if(result)drawDiagram();
});
$('quantity').addEventListener('change', () => {if(result)profile();});
$('probe').addEventListener('input', () => {if(result)profile();});
document.addEventListener('languagechange', () => {if(dictionary.en)translate();});
new ResizeObserver(() => {if(result)profile();}).observe($('profile'));
try {
  const response = await fetch(new URL('./locales.json',import.meta.url));
  if (!response.ok) throw new Error('locales'); dictionary = await response.json();
  await initialize(); selectExperiment('lesson');
} catch (error) {
  console.error(error); $('results').hidden=true;$('error').hidden=false;
  text('error',tr('loadError'));
}
