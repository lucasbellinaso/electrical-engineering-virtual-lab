import {initialize} from '../../../assets/js/common.js';
import {language} from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import {proseParts} from '../../electrical-circuits/shared/presentation.js';
import {MAX_COMPONENTS, simulate, analyze, evaluateCosines, evaluateSines, parseSamples, halfLength, sampleTimes} from './model.js';
import {presets, defaultPreset} from './presets.js';

const $ = id => document.getElementById(id), form = $('parameters'), svgNS = 'http://www.w3.org/2000/svg';
const area = {left: 58, top: 10, width: 566, height: 0};
let selectFirstComponent = false, dictionary = {}, mode = 'synthetic', data = null, result = null, selectedK = 1, hoverK = null, scheduled = false;
const scales = {time: {ref: null, cur: null}, amp: {ref: null, cur: null}};

// ---------- presentation helpers ----------
const tr = (key, vars = {}) => String(dictionary[language]?.[key] ?? dictionary.en?.[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(vars, name) ? vars[name] : match);
const fmt = (value, digits = 4) => new Intl.NumberFormat(language, {maximumSignificantDigits: digits}).format(Math.abs(value) < 1e-12 ? 0 : value);
const math = (node, source, display = false) => katex.render(source, node, {throwOnError: false, displayMode: display, trust: false});
function prose(node, value) {
  node.replaceChildren();
  for (const part of proseParts(value)) {
    if (part.text !== undefined) node.append(document.createTextNode(part.text));
    else { const span = document.createElement('span'); math(span, part.latex); node.append(span); }
  }
}
const plain = value => proseParts(value).map(p => p.text ?? p.latex).join('');
function svg(tag, attrs = {}, content = null) {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (content !== null) e.textContent = content;
  return e;
}
function niceTicks(min, max, count = 5) {
  const span = max - min || 1, raw = span / count, power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * power).find(s => s >= raw) ?? 10 * power;
  const ticks = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}
/** Draw grid, ticks and a clipped plot group; returns scale functions. */
function frame(element, height, xr, yr, {xTicks = niceTicks(...xr), yTicks = niceTicks(...yr)} = {}) {
  element.replaceChildren();
  const h = height - 40, {left, top, width} = area, clip = element.id + 'Clip';
  const x = v => left + (v - xr[0]) / (xr[1] - xr[0]) * width, y = v => top + h - (v - yr[0]) / (yr[1] - yr[0]) * h;
  const defs = svg('defs'), clipPath = svg('clipPath', {id: clip});
  clipPath.append(svg('rect', {x: left, y: top, width, height: h})); defs.append(clipPath); element.append(defs);
  element.append(svg('rect', {x: left, y: top, width, height: h, class: 'plot-bg'}));
  for (const v of yTicks) if (v >= yr[0] && v <= yr[1]) element.append(svg('line', {x1: left, x2: left + width, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid'}), svg('text', {x: left - 7, y: y(v) + 4, 'text-anchor': 'end', class: 'tick'}, fmt(v, 3)));
  for (const v of xTicks) if (v >= xr[0] && v <= xr[1]) element.append(svg('line', {x1: x(v), x2: x(v), y1: top, y2: top + h, class: 'grid'}), svg('text', {x: x(v), y: top + h + 18, 'text-anchor': 'middle', class: 'tick'}, fmt(v, 4)));
  const plot = svg('g', {'clip-path': `url(#${clip})`}); element.append(plot);
  return {x, y, plot, h, xr, yr};
}
const polyline = (xs, ys, f, cls) => svg('polyline', {points: xs.map((v, i) => f.x(v).toFixed(2) + ',' + f.y(ys[i]).toFixed(2)).join(' '), class: cls});

// ---------- reading the form ----------
function number(id) {
  const input = $(id);
  if (input.value.trim() === '' || !input.checkValidity()) throw new RangeError(id);
  return Number(input.value);
}
function readSynthetic() {
  const components = [];
  for (let i = 1; i <= MAX_COMPONENTS; i++) components.push({amplitude: number('a' + i), frequency: number('f' + i), phase: number('p' + i)});
  return {samples: number('samples'), duration: number('duration'), components, noise: number('noise'), seed: number('seed'), threshold: number('threshold')};
}
const view = () => document.querySelector('input[name=view]:checked')?.value ?? 'half';

function compute() {
  if (mode === 'synthetic') {
    const r = simulate(readSynthetic()), p = r.parameters;
    // Fine grid for the continuous true signal (shows aliasing between samples).
    const fmax = Math.max(0, ...p.components.filter(c => c.amplitude > 0).map(c => c.frequency));
    const points = Math.min(4000, Math.max(800, 8 * p.samples, Math.ceil(24 * fmax * p.duration)));
    r.fineTime = Array.from({length: points + 1}, (_, i) => i * p.duration / points);
    r.fineClean = evaluateSines(p.components, r.fineTime);
    return r;
  }
  if (!data) throw new RangeError('noData');
  const duration = number('duration'), threshold = number('threshold');
  return {parameters: {samples: data.values.length, duration, threshold}, time: sampleTimes(data.values.length, duration), clean: null, noisy: data.values, analysis: analyze(data.values, duration, threshold), reference: []};
}

// ---------- scales (fixed Y; see docs/UI-CONVENTIONS.md) ----------
function timeRange(r) {
  const values = [...r.noisy, ...r.analysis.filtered, ...(r.fineClean ?? [])].filter(Number.isFinite);
  let min = Math.min(...values), max = Math.max(...values);
  if (!(max - min > 1e-9)) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  return [min - pad, max + pad];
}
function ampRange(r) {
  const peak = Math.max(...r.analysis.bins.map(b => b.lessonAmplitude), r.analysis.threshold, 1e-9);
  return [0, peak * 1.1];
}
function setReferenceScales() {
  scales.time.ref = timeRange(result); scales.time.cur = scales.time.ref.slice();
  scales.amp.ref = ampRange(result); scales.amp.cur = scales.amp.ref.slice();
  const range = $('thresholdRange'), top = scales.amp.ref[1];
  range.max = String(top); range.step = String(top / 1000); range.value = $('threshold').value;
}

// ---------- update cycle ----------
function scheduleUpdate(rescale = false) {
  if (rescale) scheduleUpdate.rescale = true;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; const r = scheduleUpdate.rescale; scheduleUpdate.rescale = false; update(r); });
}
function update(rescale = false) {
  try {
    result = compute();
    if (rescale || !scales.time.ref) setReferenceScales();
    if (selectFirstComponent) { selectedK = result.reference[0]?.bin || 1; selectFirstComponent = false; }
    selectedK = Math.min(selectedK, result.analysis.samples - 1);
    $('error').textContent = '';
    document.querySelector('.results').classList.remove('stale');
    render();
  } catch (error) {
    if (!(error instanceof RangeError)) console.error(error);
    $('error').textContent = tr(error.message === 'noData' ? 'noData' : 'inputError');
    document.querySelector('.results').classList.add('stale');
  }
}

function render() {
  if (!result) return;
  renderMetrics(); renderWarnings(); renderTime(); renderAmplitude(); renderPhase(); renderTables();
}

function renderMetrics() {
  const a = result.analysis, container = $('metrics');
  const items = [['N', String(a.samples), ''], ['f_s', fmt(a.sampleRate), String.raw`\mathrm{Hz}`], [String.raw`\Delta f=1/T`, fmt(a.resolution), String.raw`\mathrm{Hz}`], [String.raw`f_s/2`, fmt(a.nyquist), String.raw`\mathrm{Hz}`], [String.raw`|\mathcal{K}|`, String(a.components.length), '']];
  if (result.clean) {
    const rms = Math.sqrt(a.filtered.reduce((s, v, i) => s + (v - result.clean[i]) ** 2, 0) / a.samples);
    items.push([String.raw`\varepsilon_{\mathrm{rms}}`, fmt(rms, 3), '']);
  }
  container.replaceChildren();
  for (const [label, value, unit] of items) {
    const card = document.createElement('div'), name = document.createElement('span'), strong = document.createElement('strong');
    card.className = 'metric'; math(name, label); strong.textContent = value + (unit ? ' ' : '');
    if (unit) { const u = document.createElement('span'); math(u, unit); strong.append(u); }
    card.append(name, strong); container.append(card);
  }
}

function renderWarnings() {
  const messages = [];
  for (const c of result.reference) {
    if (c.aliased) messages.push(tr('aliasWarning', {f: fmt(c.frequency), alias: fmt(c.alias)}));
    else if (c.leakage) messages.push(tr('leakageWarning', {f: fmt(c.frequency), cycles: fmt(c.frequency * result.parameters.duration)}));
  }
  const box = $('warnings'); box.hidden = !messages.length; box.replaceChildren();
  for (const m of messages) { const line = document.createElement('span'); prose(line, m); box.append(line); }
}

function renderTime() {
  const r = result, T = r.parameters.duration, yr = scales.time.cur, f = frame($('timeChart'), 260, [0, T], yr);
  const a = r.analysis, out = [];
  if (r.fineClean) { f.plot.append(polyline(r.fineTime, r.fineClean, f, 'line clean')); out.push(...r.fineClean); }
  f.plot.append(polyline(r.time, r.noisy, f, 'line noisy')); out.push(...r.noisy);
  if (r.noisy.length <= 128) for (let i = 0; i < r.noisy.length; i++) f.plot.append(svg('circle', {cx: f.x(r.time[i]), cy: f.y(r.noisy[i]), r: 2.6, class: 'sample'}));
  // Continuous reconstruction from the kept cosines when it is cheap; otherwise the inverse-DFT samples.
  if (a.components.length <= 64) {
    const count = Math.min(4000, 8 * a.samples), fine = r.fineTime ?? Array.from({length: count + 1}, (_, i) => i * T / count);
    const rec = evaluateCosines(a.components, fine);
    f.plot.append(polyline(fine, rec, f, 'line filtered')); out.push(...rec);
  } else { f.plot.append(polyline(r.time, a.filtered, f, 'line filtered')); out.push(...a.filtered); }
  $('timeOut').hidden = out.every(v => v >= yr[0] && v <= yr[1]);
  $('legendCleanGroup').hidden = !r.clean;
  $('timeChart').setAttribute('aria-label', tr('timeChartLabel'));
}

function visibleBins() {
  const a = result.analysis, n = a.samples;
  if (view() === 'full') return {bins: a.bins, xr: [0, a.sampleRate], value: b => b.lessonAmplitude};
  const fmax = Math.max(Number($('maxFrequency').value) || a.nyquist, a.resolution), top = Math.min(fmax, a.nyquist);
  return {bins: a.bins.slice(0, halfLength(n) + 1).filter(b => b.frequency <= top + 1e-12), xr: [0, top], value: b => b.amplitude};
}

function renderAmplitude() {
  const a = result.analysis, yr = scales.amp.cur, {bins, xr, value} = visibleBins(), f = frame($('ampChart'), 260, xr, yr);
  const width = bins.length > 300 ? 1 : 2, base = f.y(Math.max(0, yr[0]));
  let rest = '', kept = '', outside = false;
  for (const b of bins) {
    const v = value(b), seg = `M${f.x(b.frequency).toFixed(2)} ${base.toFixed(2)}V${f.y(v).toFixed(2)}`;
    if (v > yr[1]) outside = true;
    if (a.keep[b.k]) kept += seg; else rest += seg;
  }
  f.plot.append(svg('path', {d: rest, class: 'stem', 'stroke-width': width}), svg('path', {d: kept, class: 'stem kept', 'stroke-width': width + 1}));
  if (bins.length <= 300) for (const b of bins) if (a.keep[b.k]) f.plot.append(svg('circle', {cx: f.x(b.frequency), cy: f.y(value(b)), r: 3, class: 'stem-head'}));
  f.plot.append(svg('line', {x1: area.left, x2: area.left + area.width, y1: f.y(a.threshold), y2: f.y(a.threshold), class: 'threshold'}));
  for (const [k, cls] of [[selectedK, 'selected'], [hoverK, 'hover']]) {
    const b = a.bins[k];
    if (k === null || !b || !bins.includes(b)) continue;
    f.plot.append(svg('line', {x1: f.x(b.frequency), x2: f.x(b.frequency), y1: area.top, y2: area.top + f.h, class: 'marker ' + cls}));
  }
  $('ampOut').hidden = !outside;
  math($('ampAxis'), view() === 'full' ? String.raw`2|F_k|/N` : 'A_k');
  $('maxFrequency').disabled = view() === 'full';
  $('ampChart').setAttribute('aria-label', tr('ampChartLabel'));
  $('ampChart').frameInfo = {xr, bins};
  renderInspection();
}

function renderInspection() {
  const a = result.analysis, k = hoverK ?? selectedK, b = a.bins[k], node = $('inspection');
  if (!b) { node.textContent = ''; return; }
  const amp = b.amplitude ?? b.lessonAmplitude;
  prose(node, tr('inspectBin', {k: String(k), f: fmt(b.frequency), a: fmt(amp), twice: fmt(b.lessonAmplitude), phase: fmt(b.phase), kept: tr(a.keep[k] ? 'keptYes' : 'keptNo')}));
}

function renderPhase() {
  const a = result.analysis, {bins, xr} = visibleBins(), yr = [-Math.PI * 1.1, Math.PI * 1.1];
  const f = frame($('phaseChart'), 200, xr, yr, {yTicks: [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]});
  let d = '';
  for (const b of bins) if (a.keep[b.k]) d += `M${f.x(b.frequency).toFixed(2)} ${f.y(0).toFixed(2)}V${f.y(b.phase).toFixed(2)}`;
  f.plot.append(svg('path', {d, class: 'stem kept', 'stroke-width': 2}));
  for (const b of bins) if (a.keep[b.k]) f.plot.append(svg('circle', {cx: f.x(b.frequency), cy: f.y(b.phase), r: 3, class: 'stem-head'}));
  $('phaseChart').setAttribute('aria-label', tr('phaseChartLabel'));
}

const LIMIT_ROWS = 64;
function renderTables() {
  const a = result.analysis, body = $('detected').tBodies[0];
  body.replaceChildren();
  for (const c of a.components.slice(0, LIMIT_ROWS)) {
    const row = body.insertRow();
    for (const v of [String(c.k), fmt(c.frequency, 6), fmt(c.amplitude, 5), fmt(c.phase, 5), fmt(c.phase * 180 / Math.PI, 5)]) row.insertCell().textContent = v;
    row.tabIndex = 0; row.dataset.k = c.k;
  }
  const note = $('tableNote');
  if (!a.components.length) prose(note, tr('noneDetected'));
  else if (a.components.length > LIMIT_ROWS) prose(note, tr('tableTruncated', {shown: String(LIMIT_ROWS), count: String(a.components.length)}));
  else note.textContent = '';
  $('referenceBlock').hidden = !result.reference.length;
  const ref = $('reference').tBodies[0]; ref.replaceChildren();
  result.reference.forEach((c, i) => {
    const row = ref.insertRow(), bin = a.bins[c.bin];
    for (const v of [String(i + 1), fmt(c.amplitude, 5), fmt(c.frequency, 6), fmt(c.phase, 5), fmt(c.cosinePhase, 5)]) row.insertCell().textContent = v;
    const cell = row.insertCell();
    if (bin && c.bin <= halfLength(a.samples)) prose(cell, tr(c.aliased ? 'observedAlias' : c.leakage ? 'observedLeakage' : 'observed', {k: String(c.bin), a: fmt(bin.amplitude, 5), phase: fmt(bin.phase, 5)}));
  });
}

// ---------- interaction ----------
function binAtPointer(event) {
  const element = $('ampChart'), info = element.frameInfo;
  if (!info || !result) return null;
  const m = element.getScreenCTM(); if (!m) return null;
  const p = element.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
  const local = p.matrixTransform(m.inverse());
  if (local.x < area.left || local.x > area.left + area.width) return null;
  const freq = info.xr[0] + (local.x - area.left) / area.width * (info.xr[1] - info.xr[0]);
  let best = null;
  for (const b of info.bins) if (!best || Math.abs(b.frequency - freq) < Math.abs(best.frequency - freq)) best = b;
  return best?.k ?? null;
}
const amp = $('ampChart');
amp.addEventListener('pointermove', e => { const k = binAtPointer(e); if (k !== hoverK) { hoverK = k; renderAmplitude(); } });
amp.addEventListener('pointerleave', () => { hoverK = null; renderAmplitude(); });
amp.addEventListener('click', e => { const k = binAtPointer(e); if (k !== null) selectBin(k); });
amp.addEventListener('keydown', e => {
  if (!result || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault(); selectBin(Math.max(0, Math.min(result.analysis.samples - 1, selectedK + (e.key === 'ArrowRight' ? 1 : -1))));
});
$('detected').addEventListener('click', e => { const row = e.target.closest('tr[data-k]'); if (row) selectBin(Number(row.dataset.k)); });
$('detected').addEventListener('keydown', e => { const row = e.target.closest('tr[data-k]'); if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectBin(Number(row.dataset.k)); } });
function selectBin(k) { selectedK = k; hoverK = null; renderAmplitude(); }

const syntheticIds = ['samples', 'noise', 'seed', ...Array.from({length: MAX_COMPONENTS}, (_, i) => ['a', 'f', 'p'].map(s => s + (i + 1))).flat()];
form.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'thresholdRange') { $('threshold').value = e.target.value; scheduleUpdate(); return; }
  if (id === 'threshold') { $('thresholdRange').value = e.target.value; scheduleUpdate(); return; }
  if (['preset', 'dataText', 'dataFile'].includes(id) || e.target.name === 'source') return;
  if (syntheticIds.includes(id) || (id === 'duration' && mode === 'synthetic')) { $('preset').value = 'custom'; presetNote(); }
  scheduleUpdate();
});
for (const input of form.elements.source) input.addEventListener('change', () => setMode(form.elements.source.value));
document.querySelectorAll('input[name=view]').forEach(input => input.addEventListener('change', () => { if (result) { renderAmplitude(); renderPhase(); } }));
$('maxFrequency').addEventListener('input', () => { if (result && $('maxFrequency').checkValidity()) { renderAmplitude(); renderPhase(); } });
$('preset').addEventListener('change', e => { if (e.target.value !== 'custom') applyPreset(e.target.value); else presetNote(); });
$('reset').addEventListener('click', () => applyPreset(defaultPreset));
document.querySelectorAll('[data-fit]').forEach(b => b.addEventListener('click', () => {
  if (!result) return;
  const key = b.dataset.fit; scales[key].cur = key === 'time' ? timeRange(result) : ampRange(result); render();
}));
document.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => {
  const key = b.dataset.restore; if (!scales[key].ref) return; scales[key].cur = scales[key].ref.slice(); render();
}));

function setMode(next) {
  mode = next;
  form.querySelector(`input[name=source][value=${next}]`).checked = true;
  $('syntheticFields').hidden = next !== 'synthetic';
  $('dataFields').hidden = next !== 'data';
  if (next === 'data') { $('preset').value = 'custom'; presetNote(); }
  scheduleUpdate(true);
}
function presetNote() { prose($('presetNote'), tr('presetNote_' + $('preset').value)); }
function applyPreset(key) {
  const p = presets[key];
  $('preset').value = key;
  for (let i = 0; i < MAX_COMPONENTS; i++) {
    const c = p.components[i] ?? {amplitude: 0, frequency: 0, phase: 0};
    $('a' + (i + 1)).value = c.amplitude; $('f' + (i + 1)).value = c.frequency; $('p' + (i + 1)).value = c.phase;
  }
  for (const id of ['samples', 'duration', 'noise', 'seed', 'threshold', 'maxFrequency']) $(id).value = p[id];
  $('thresholdRange').value = p.threshold;
  document.querySelector(`input[name=view][value=${p.view}]`).checked = true;
  selectFirstComponent = true;
  presetNote();
  setMode('synthetic');
}

function dataError(error) {
  const key = {parse: 'dataParseError', columns: 'dataColumnsError', length: 'dataLengthError', spacing: 'dataSpacingError', finite: 'dataParseError'}[error.message];
  prose($('dataStatus'), tr(key ?? 'dataParseError'));
}
function loadData(text) {
  try {
    const parsed = parseSamples(text);
    data = parsed;
    if (parsed.duration !== null) $('duration').value = String(parsed.duration);
    prose($('dataStatus'), tr('dataLoaded', {count: String(parsed.values.length), duration: fmt(number('duration'))}));
    selectedK = 1;
    scheduleUpdate(true);
  } catch (error) { if (!(error instanceof RangeError || error instanceof SyntaxError)) console.error(error); dataError(error); }
}
$('dataLoad').addEventListener('click', () => loadData($('dataText').value));
$('dataFile').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return;
  if (file.size > 2e6) { prose($('dataStatus'), tr('dataLengthError')); return; }
  const text = await file.text(); $('dataText').value = text; loadData(text);
});

// ---------- CSV ----------
$('csv').addEventListener('click', () => {
  if (!result) return;
  const r = result, a = r.analysis, p = r.parameters;
  const header = `# EEVL DFT; N=${a.samples}; T_s=${p.duration}; fs_Hz=${a.sampleRate}; threshold=${a.threshold}; source=${mode}` + (mode === 'synthetic' ? `; noise=${p.noise}; seed=${p.seed}; components=${JSON.stringify(p.components)}` : '');
  const lines = ['n,t_s,x_n,s_n,xf_n,k,f_k_Hz,Re_F_k,Im_F_k,two_abs_F_over_N,A_k_one_sided,arg_F_k_rad,kept'];
  for (let n = 0; n < a.samples; n++) {
    const b = a.bins[n];
    lines.push([n, r.time[n], r.noisy[n], r.clean ? r.clean[n] : '', a.filtered[n], b.k, b.frequency, b.re, b.im, b.lessonAmplitude, b.amplitude ?? '', b.phase, a.keep[n] ? 1 : 0].join(','));
  }
  const blob = new Blob(['﻿' + header + '\n' + lines.join('\n') + '\n'], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'eevl-dft.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  prose($('message'), tr('csvDone'));
});

// ---------- translation ----------
function translate() {
  document.querySelectorAll('[data-m]').forEach(e => { if (e.tagName === 'OPTION') e.textContent = plain(tr(e.dataset.m)); else prose(e, tr(e.dataset.m)); });
  document.querySelectorAll('[data-tex]').forEach(e => math(e, e.dataset.tex, e.hasAttribute('data-display')));
  document.title = plain(tr('title')) + ' - EEVL';
  presetNote();
  if (data) prose($('dataStatus'), tr('dataLoaded', {count: String(data.values.length), duration: fmt(Number($('duration').value))}));
  if (result) render();
}
document.addEventListener('languagechange', () => { if (dictionary.en) translate(); });

try {
  const response = await fetch(new URL('./locales.json', import.meta.url));
  if (!response.ok) throw new Error('locales');
  dictionary = await response.json();
  await initialize();
  translate();
  applyPreset(defaultPreset);
} catch (error) {
  console.error(error);
  $('error').textContent = 'Unable to load the application.';
}
