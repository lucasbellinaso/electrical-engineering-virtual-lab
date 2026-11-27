import { initialize } from '../../../assets/js/common.js';
import { language } from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import { defaults, presets, MODULATIONS, simulate } from './model.js';
import { steps } from './equations.js';

const $ = id => document.getElementById(id);
const form = $('parameters');

const DEFAULT_IQ_EXTENT = 1.8;
const DEFAULT_BER_LOG_MIN = -6;
const DEFAULT_BER_LOG_MAX = 0;

let dictionary = {};
let result = null;
let experiment = 'qpsk';
let errorCode = '';
let selectedSample = 0;
let iqExtent = DEFAULT_IQ_EXTENT;
let berLogRange = [DEFAULT_BER_LOG_MIN, DEFAULT_BER_LOG_MAX];

const tr = (key, values = {}) =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    dictionary[language]?.[key] ?? dictionary.en?.[key] ?? key
  );

const formatNum = (x, digits = 4) =>
  new Intl.NumberFormat(language, {
    maximumSignificantDigits: digits,
    notation: x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e5) ? 'scientific' : 'standard'
  }).format(Object.is(x, -0) ? 0 : x);

const formatFixed = (x, decimals = 2) =>
  new Intl.NumberFormat(language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Object.is(x, -0) ? 0 : x);

const formatProb = p => {
  if (p === 0) return formatNum(0, 2);
  if (p >= 0.01) return formatFixed(p, 4);
  return new Intl.NumberFormat(language, {
    notation: 'scientific',
    maximumSignificantDigits: 3
  }).format(p);
};

const math = (node, latex, displayMode = true) =>
  katex.render(latex, node, { displayMode, throwOnError: false, trust: false, output: 'htmlAndMathml' });

function mathNumber(value, decimals = 4) {
  const formatted = new Intl.NumberFormat(language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).formatToParts(Object.is(value, -0) ? 0 : value)
    .map(part => (part.type === 'group' ? '\\,' : part.type === 'decimal' ? (part.value === ',' ? '{,}' : '.') : part.value))
    .join('');
  return formatted;
}

function svgMath(latex, x, y, width, height, size = 13) {
  const rendered = katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    trust: false,
    output: 'htmlAndMathml'
  });
  return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" class="svg-math" style="font-size:${size}px">${rendered}</div></foreignObject>`;
}

const MATH_TOKEN_RE = /Q\(√\(2 E_b\/N_0\)\)|√\(6\/\(M−1\)\)|2 sin\(π\/8\)|\(r_I, r_Q\)|E_b\/N_0|E_s\/N_0|N_sym|d_min|E_s|E_b|N_0|P_b|P_s|p_1|p_2|r_I|r_Q|n_I|n_Q|10\^-6|Δφ = 0°|Δφ ≠ 0°|Δφ = 8°|Δφ|σ²|σ|I = 0|M = \d+/g;

const TOKEN_TO_LATEX = new Map([
  ['Q(√(2 E_b/N_0))', String.raw`Q(\sqrt{2E_b/N_0})`],
  ['√(6/(M−1))', String.raw`\sqrt{6/(M-1)}`],
  ['2 sin(π/8)', String.raw`2\sin(\pi/8)`],
  ['(r_I, r_Q)', String.raw`(r_I, r_Q)`],
  ['E_b/N_0', String.raw`E_b/N_0`],
  ['E_s/N_0', String.raw`E_s/N_0`],
  ['N_sym', String.raw`N_{\mathrm{sym}}`],
  ['d_min', String.raw`d_{\min}`],
  ['E_s', String.raw`E_s`],
  ['E_b', String.raw`E_b`],
  ['N_0', String.raw`N_0`],
  ['P_b', String.raw`P_b`],
  ['P_s', String.raw`P_s`],
  ['p_1', String.raw`p_1`],
  ['p_2', String.raw`p_2`],
  ['r_I', String.raw`r_I`],
  ['r_Q', String.raw`r_Q`],
  ['n_I', String.raw`n_I`],
  ['n_Q', String.raw`n_Q`],
  ['10^-6', String.raw`10^{-6}`],
  ['Δφ = 0°', String.raw`\Delta\phi = 0^{\circ}`],
  ['Δφ ≠ 0°', String.raw`\Delta\phi \neq 0^{\circ}`],
  ['Δφ = 8°', String.raw`\Delta\phi = 8^{\circ}`],
  ['Δφ', String.raw`\Delta\phi`],
  ['σ²', String.raw`\sigma^2`],
  ['σ', String.raw`\sigma`],
  ['I = 0', String.raw`I = 0`]
]);

function renderInlineMathText(node, textValue) {
  const fragments = [];
  let offset = 0;
  for (const match of textValue.matchAll(MATH_TOKEN_RE)) {
    fragments.push(document.createTextNode(textValue.slice(offset, match.index)));
    const token = match[0];
    const latex = TOKEN_TO_LATEX.get(token) ?? token;
    const span = document.createElement('span');
    math(span, latex, false);
    fragments.push(span);
    offset = match.index + token.length;
  }
  fragments.push(document.createTextNode(textValue.slice(offset)));
  node.replaceChildren(...fragments);
}

function read() {
  return {
    modulation: form.elements.modulation.value,
    ebN0Db: form.elements.ebN0Db.valueAsNumber,
    symbolCount: form.elements.symbolCount.valueAsNumber,
    phaseOffsetDeg: form.elements.phaseOffsetDeg.valueAsNumber,
    seed: form.elements.seed.valueAsNumber
  };
}

function fill(p) {
  for (const radio of form.elements.modulation) {
    radio.checked = radio.value === p.modulation;
  }
  form.elements.ebN0Db.value = p.ebN0Db;
  $('ebn0-slider').value = p.ebN0Db;
  form.elements.symbolCount.value = p.symbolCount;
  form.elements.phaseOffsetDeg.value = p.phaseOffsetDeg;
  $('phase-slider').value = p.phaseOffsetDeg;
  form.elements.seed.value = p.seed;
}

function run() {
  try {
    const input = read();
    result = simulate(input);
    errorCode = '';
    $('error').hidden = true;
    $('results').hidden = false;
    $('ebn0-slider').value = result.p.ebN0Db;
    $('phase-slider').value = result.p.phaseOffsetDeg;
    if (selectedSample >= result.operating.inspector.length) selectedSample = 0;
    render();
  } catch (error) {
    result = null;
    errorCode = dictionary.en?.[error.code] ? error.code : 'invalid';
    $('results').hidden = true;
    $('error').hidden = false;
    $('error').textContent = tr(errorCode);
  }
}

function translate() {
  document.querySelectorAll('[data-m]').forEach(el => {
    renderInlineMathText(el, tr(el.dataset.m));
  });
  document.querySelectorAll('[data-m-aria]').forEach(el => {
    el.setAttribute('aria-label', tr(el.dataset.mAria));
  });
  document.title = `${tr('title')} · EEVL`;

  const predKey = {
    qpsk: 'predictQpsk',
    bpsk: 'predictBpsk',
    qam16: 'predictQam16',
    qam64Phase: 'predictQam64Phase'
  }[experiment];
  renderInlineMathText($('prediction'), tr(predKey));

  if (errorCode) $('error').textContent = tr(errorCode);

  $('derivation').replaceChildren(
    ...steps.map((equations, i) => {
      const section = document.createElement('div');
      section.className = 'step';
      const h = document.createElement('h3');
      renderInlineMathText(h, tr(`step${i + 1}`));
      const p = document.createElement('p');
      renderInlineMathText(p, tr(`step${i + 1}Text`));
      section.append(h, p);
      equations.forEach(eq => {
        const div = document.createElement('div');
        div.className = 'eq';
        div.tabIndex = 0;
        div.setAttribute('role', 'region');
        div.setAttribute('aria-label', h.textContent);
        math(div, eq, true);
        section.append(div);
      });
      return section;
    })
  );

  render();
}

function drawConstellation() {
  const r = result;
  const spec = r.spec;
  const showBoundaries = $('toggle-boundaries').checked;
  const showLabels = $('toggle-labels').checked;
  const ext = iqExtent;
  const size = 560, pad = 54, span = size - 2 * pad;
  const cx = v => pad + ((v + ext) / (2 * ext)) * span;
  const cy = v => size - pad - ((v + ext) / (2 * ext)) * span;

  let svg = `<title>${tr('constellationTitle')}</title><desc>${tr('constellationDescription')}</desc>`;
  svg += `<defs><clipPath id="iq-clip"><rect x="${pad}" y="${pad}" width="${span}" height="${span}"/></clipPath></defs>`;

  // Grid lines and ticks
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const val = -ext + (2 * ext * i) / tickCount;
    const px = cx(val).toFixed(1), py = cy(val).toFixed(1);
    svg += `<path class="grid" d="M${pad} ${py}H${size - pad}M${px} ${pad}V${size - pad}"/>`;
    svg += `<text x="${px}" y="${size - pad + 18}" text-anchor="middle">${formatFixed(val, 2)}</text>`;
    svg += `<text x="${pad - 8}" y="${Number(py) + 4}" text-anchor="end">${formatFixed(val, 2)}</text>`;
  }

  svg += `<path class="axis" d="M${pad} ${cy(0).toFixed(1)}H${size - pad}M${cx(0).toFixed(1)} ${pad}V${size - pad}"/>`;
  svg += `<rect x="${pad}" y="${pad}" width="${span}" height="${span}" fill="none" stroke="var(--line)" stroke-width="1.2"/>`;
  svg += svgMath(String.raw`I\,(\sqrt{E_s})`, size - pad - 76, cy(0) - 24, 74, 22, 12);
  svg += svgMath(String.raw`Q\,(\sqrt{E_s})`, cx(0) + 6, pad + 4, 74, 22, 12);

  // Decision boundaries
  let boundaries = '';
  if (showBoundaries) {
    if (spec.modulation === 'BPSK') {
      boundaries += `<line class="boundary" x1="${cx(0)}" y1="${pad}" x2="${cx(0)}" y2="${size - pad}"/>`;
    } else if (spec.modulation === 'QPSK') {
      boundaries += `<line class="boundary" x1="${cx(0)}" y1="${pad}" x2="${cx(0)}" y2="${size - pad}"/>`;
      boundaries += `<line class="boundary" x1="${pad}" y1="${cy(0)}" x2="${size - pad}" y2="${cy(0)}"/>`;
    } else if (spec.modulation === '8-PSK') {
      const rMax = ext * 1.5;
      for (let m = 0; m < 4; m++) {
        const ang = (Math.PI / 8) + (m * Math.PI) / 4;
        const dx = rMax * Math.cos(ang), dy = rMax * Math.sin(ang);
        boundaries += `<line class="boundary" x1="${cx(-dx).toFixed(1)}" y1="${cy(-dy).toFixed(1)}" x2="${cx(dx).toFixed(1)}" y2="${cy(dy).toFixed(1)}"/>`;
      }
    } else {
      const L = spec.pamLevels;
      for (let idx = 0; idx < L - 1; idx++) {
        const edge = (2 * idx - L + 2) * spec.scale;
        boundaries += `<line class="boundary" x1="${cx(edge).toFixed(1)}" y1="${pad}" x2="${cx(edge).toFixed(1)}" y2="${size - pad}"/>`;
        boundaries += `<line class="boundary" x1="${pad}" y1="${cy(edge).toFixed(1)}" x2="${size - pad}" y2="${cy(edge).toFixed(1)}"/>`;
      }
    }
  }

  // Received samples
  let outOfRange = 0;
  let okLayer = '';
  let errLayer = '';
  const clampVal = v => Math.max(-ext, Math.min(ext, v));

  for (const s of r.operating.scatter) {
    const clipped = Math.abs(s.i) > ext || Math.abs(s.q) > ext;
    if (clipped) outOfRange++;
    const px = cx(clampVal(s.i)).toFixed(1);
    const py = cy(clampVal(s.q)).toFixed(1);
    if (s.error) {
      const x = Number(px), y = Number(py);
      errLayer += `<path class="sample-err" d="M${(x - 3).toFixed(1)} ${(y - 3).toFixed(1)}L${(x + 3).toFixed(1)} ${(y + 3).toFixed(1)}M${(x + 3).toFixed(1)} ${(y - 3).toFixed(1)}L${(x - 3).toFixed(1)} ${(y + 3).toFixed(1)}"/>`;
    } else {
      okLayer += `<circle class="sample-ok" cx="${px}" cy="${py}" r="2.3"/>`;
    }
  }

  // Ideal constellation points
  let idealLayer = '';
  for (const pt of spec.points) {
    const px = cx(pt.i).toFixed(1), py = cy(pt.q).toFixed(1);
    idealLayer += `<circle class="ideal-pt" cx="${px}" cy="${py}" r="${spec.M === 64 ? 3.5 : 5.5}"/>`;
    if (showLabels) {
      const dy = spec.M === 64 ? -6 : -10;
      const cls = spec.M === 64 ? 'bit-label compact' : 'bit-label';
      idealLayer += `<text class="${cls}" x="${px}" y="${Number(py) + dy}" text-anchor="middle">${pt.bits}</text>`;
    }
  }

  // Selected sample highlight
  let selLayer = '';
  const sel = r.operating.inspector[selectedSample];
  if (sel) {
    const txX = cx(clampVal(sel.txPoint.i)).toFixed(1);
    const txY = cy(clampVal(sel.txPoint.q)).toFixed(1);
    const rotX = cx(clampVal(sel.rotatedPoint.i)).toFixed(1);
    const rotY = cy(clampVal(sel.rotatedPoint.q)).toFixed(1);
    const rxX = cx(clampVal(sel.rxPoint.i)).toFixed(1);
    const rxY = cy(clampVal(sel.rxPoint.q)).toFixed(1);
    if (r.p.phaseOffsetDeg !== 0) {
      selLayer += `<circle class="rot-pt" cx="${rotX}" cy="${rotY}" r="7"/>`;
      selLayer += `<line class="sel-vec" x1="${txX}" y1="${txY}" x2="${rotX}" y2="${rotY}"/>`;
    }
    selLayer += `<line class="sel-vec" x1="${rotX}" y1="${rotY}" x2="${rxX}" y2="${rxY}"/>`;
    selLayer += `<circle class="sample-sel" cx="${rxX}" cy="${rxY}" r="8"/>`;
  }

  svg += `<g clip-path="url(#iq-clip)">${boundaries}${okLayer}${errLayer}${idealLayer}${selLayer}</g>`;
  $('constellation').innerHTML = svg;

  const oor = $('iq-out-of-range');
  if (outOfRange > 0) {
    oor.hidden = false;
    oor.textContent = tr('outOfRangeSamples', { count: formatNum(outOfRange, 5) });
  } else {
    oor.hidden = true;
  }
}

function drawBerChart() {
  const r = result;
  const showSer = $('toggle-ser').checked;
  const showCompare = $('toggle-compare').checked;
  const [logMin, logMax] = berLogRange;
  const w = 800, h = 340, left = 72, right = w - 24, top = 28, bottom = 284;
  const x = db => left + (db / 24) * (right - left);
  const y = p => {
    const lp = Math.log10(Math.max(p, 10 ** (logMin - 2)));
    const clamped = Math.max(logMin, Math.min(logMax, lp));
    return bottom - ((clamped - logMin) / (logMax - logMin)) * (bottom - top);
  };

  let svg = `<title>${tr('berTitle')}</title><desc>${tr('berDescription')}</desc>`;
  svg += `<defs><clipPath id="ber-clip"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/></clipPath></defs>`;

  // Horizontal log grid lines
  const minExp = Math.ceil(logMin);
  const maxExp = Math.floor(logMax);
  for (let exp = minExp; exp <= maxExp; exp++) {
    const py = y(10 ** exp).toFixed(1);
    svg += `<path class="grid" d="M${left} ${py}H${right}"/>`;
    svg += `<text x="${left - 8}" y="${Number(py) + 4}" text-anchor="end">10<tspan dy="-5" font-size="9">${exp}</tspan></text>`;
  }

  // Vertical Eb/N0 grid lines
  for (let db = 0; db <= 24; db += 4) {
    const px = x(db).toFixed(1);
    svg += `<path class="grid" d="M${px} ${top}V${bottom}"/>`;
    svg += `<text x="${px}" y="${bottom + 18}" text-anchor="middle">${db}</text>`;
  }

  svg += `<path class="axis" d="M${left} ${top}V${bottom}H${right}"/>`;
  svg += `<text x="${left}" y="18">${tr('berAxisY')}</text>`;
  svg += svgMath(String.raw`E_b/N_0\;(\mathrm{dB})`, (left + right) / 2 - 55, 310, 110, 24, 13);

  let clippedAny = false;
  const pathFrom = (pts, getter) => {
    let d = '';
    for (const pt of pts) {
      const val = getter(pt);
      if (val === null || val <= 0 || !Number.isFinite(val)) continue;
      if (Math.log10(val) < logMin) clippedAny = true;
      const px = x(pt.ebN0Db).toFixed(1), py = y(val).toFixed(1);
      d += `${d ? 'L' : 'M'}${px} ${py}`;
    }
    return d;
  };

  let layers = '';

  // Optional comparison curves across all modulations
  if (showCompare) {
    for (const mod of MODULATIONS) {
      if (mod === r.p.modulation) continue;
      const pts = r.comparisons[mod];
      const d = pathFrom(pts, pt => pt.ber);
      layers += `<path class="curve-compare" d="${d}"/>`;
      const labelPt = pts.find(pt => pt.ber < 10 ** (logMin + 0.8) && pt.ber > 10 ** logMin) ?? pts[Math.min(4, pts.length - 1)];
      if (labelPt && labelPt.ber > 0) {
        layers += `<text x="${x(labelPt.ebN0Db).toFixed(1)}" y="${(y(labelPt.ber) - 5).toFixed(1)}" font-size="10">${mod}</text>`;
      }
    }
  }

  // Theoretical SER and BER curves (ideal coherent reference)
  if (showSer) {
    layers += `<path class="curve-ser" d="${pathFrom(r.theoryCurve, pt => pt.ser)}"/>`;
  }
  layers += `<path class="curve-ber" d="${pathFrom(r.theoryCurve, pt => pt.ber)}"/>`;

  // Analytical impaired BER curve when phaseOffsetDeg != 0
  const hasImpaired = r.p.phaseOffsetDeg !== 0 && r.theoryCurve.some(pt => pt.impairedBer !== null);
  $('leg-impaired').hidden = !hasImpaired;
  if (hasImpaired) {
    layers += `<path class="curve-impaired" d="${pathFrom(r.theoryCurve, pt => pt.impairedBer)}"/>`;
  }

  // Monte Carlo sweep points (only positive observed rates)
  let zeroPoints = 0;
  for (const pt of r.sweep) {
    if (pt.mcBer <= 0) {
      zeroPoints++;
      clippedAny = true;
      continue;
    }
    if (Math.log10(pt.mcBer) < logMin) clippedAny = true;
    layers += `<circle class="mc-marker" cx="${x(pt.ebN0Db).toFixed(1)}" cy="${y(pt.mcBer).toFixed(1)}" r="4"/>`;
  }

  // Operating point crosshair & marker
  const opX = x(r.p.ebN0Db).toFixed(1);
  layers += `<line class="boundary" x1="${opX}" y1="${top}" x2="${opX}" y2="${bottom}"/>`;
  const opYVal = r.operating.ber > 0 ? r.operating.ber : r.theory.ber;
  if (r.operating.ber <= 0 || Math.log10(opYVal) < logMin) clippedAny = true;
  if (opYVal > 0) {
    layers += `<circle class="op-marker" cx="${opX}" cy="${y(opYVal).toFixed(1)}" r="5.5"/>`;
  }

  svg += `<g clip-path="url(#ber-clip)">${layers}</g>`;
  $('ber-chart').innerHTML = svg;

  $('ber-out-of-range').hidden = !clippedAny;
  const zeroNote = $('ber-zero-note');
  if (zeroPoints > 0) {
    zeroNote.hidden = false;
    zeroNote.textContent = tr('berZeroNote', {
      count: formatNum(zeroPoints, 2),
      total: formatNum(r.p.symbolCount, 5)
    });
  } else {
    zeroNote.hidden = true;
  }
}

function renderMetrics() {
  const r = result;
  math($('m-spectral'), `${r.spec.k}\\,\\mathrm{bit/s/Hz}\\;(M=${r.spec.M})`, false);
  math($('m-dmin'), `${mathNumber(r.spec.dMin, 4)}\\,\\sqrt{E_s}`, false);
  math($('m-esn0'), `${mathNumber(r.esN0Db, 2)}\\,\\mathrm{dB},\\;\\sigma=${mathNumber(r.sigma, 4)}`, false);
  $('m-ber').textContent = `${formatProb(r.operating.ber)} / ${formatProb(r.theory.ber)}`;
  $('m-ser').textContent = `${formatProb(r.operating.ser)} / ${formatProb(r.theory.ser)}`;
  $('m-counts').textContent = `${formatNum(r.operating.bitErrors, 6)} / ${formatNum(r.operating.symbolErrors, 6)}`;

  $('phase-warning').hidden = r.p.phaseOffsetDeg === 0;
  if (r.p.phaseOffsetDeg !== 0) {
    renderInlineMathText($('phase-warning'), tr('phaseWarning'));
  }
}

function renderTablesAndInspector() {
  const r = result;
  $('ber-table').innerHTML = r.sweep
    .map(
      row =>
        `<tr><td>${formatFixed(row.ebN0Db, 1)}</td><td>${formatProb(row.theoryBer)}</td><td>${formatProb(row.theorySer)}</td><td>${formatProb(row.mcBer)}</td><td>${formatProb(row.mcSer)}</td><td>${formatNum(row.bitErrors, 6)} / ${formatNum(row.symbolErrors, 6)}</td></tr>`
    )
    .join('');

  const buttons = r.operating.inspector.map(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(item.index === selectedSample));
    if (item.symbolError) btn.classList.add('is-err');
    btn.textContent = tr('inspectorSelect', {
      index: item.index + 1,
      tx: item.txBits,
      rx: item.rxBits
    });
    btn.addEventListener('click', () => {
      selectedSample = item.index;
      renderTablesAndInspector();
      drawConstellation();
    });
    return btn;
  });
  $('sample-buttons').replaceChildren(...buttons);

  const sel = r.operating.inspector[selectedSample];
  if (sel) {
    const summary = tr('inspectorDetails', {
      txBits: sel.txBits,
      rxBits: sel.rxBits,
      ri: formatFixed(sel.rxPoint.i, 3),
      rq: formatFixed(sel.rxPoint.q, 3),
      bitErrors: formatNum(sel.bitErrors, 2)
    });
    const status = tr(sel.symbolError ? 'inspectorWithError' : 'inspectorNoError');
    $('sample-detail').textContent = `${summary} — ${status}`;
  }

  $('inspector-table').innerHTML = r.operating.inspector
    .map(
      item =>
        `<tr class="${item.index === selectedSample ? 'row-selected' : ''}"><td>${item.index + 1}</td><td><code>${item.txBits}</code></td><td>(${formatFixed(item.rxPoint.i, 3)}, ${formatFixed(item.rxPoint.q, 3)})</td><td><code>${item.rxBits}</code></td><td>${item.bitErrors}</td></tr>`
    )
    .join('');
}

function render() {
  if (!result) return;
  renderMetrics();
  drawConstellation();
  drawBerChart();
  renderTablesAndInspector();
}

function adjustIqScale() {
  if (!result) return;
  let maxCoord = 0;
  for (const pt of result.spec.points) {
    maxCoord = Math.max(maxCoord, Math.abs(pt.i), Math.abs(pt.q));
  }
  for (const s of result.operating.scatter) {
    if (Number.isFinite(s.i) && Number.isFinite(s.q)) {
      maxCoord = Math.max(maxCoord, Math.abs(s.i), Math.abs(s.q));
    }
  }
  iqExtent = Math.max(1.2, Math.ceil(maxCoord * 1.1 * 10) / 10);
  drawConstellation();
}

function adjustBerScale() {
  if (!result) return;
  let minPositive = 1;
  for (const pt of result.theoryCurve) {
    if (pt.ber > 0) minPositive = Math.min(minPositive, pt.ber);
    if ($('toggle-ser').checked && pt.ser > 0) minPositive = Math.min(minPositive, pt.ser);
  }
  for (const pt of result.sweep) {
    if (pt.mcBer > 0) minPositive = Math.min(minPositive, pt.mcBer);
  }
  const exp = Math.max(-12, Math.min(-2, Math.floor(Math.log10(minPositive)) - 1));
  berLogRange = [exp, 0];
  drawBerChart();
}

function exportCsv() {
  if (!result) return;
  const header = 'modulation,ebN0_dB,phaseOffset_deg,symbolCount,theory_BER,theory_SER,mc_BER,mc_SER,bitErrors,symbolErrors';
  const rows = result.sweep.map(row =>
    [
      result.p.modulation,
      row.ebN0Db,
      result.p.phaseOffsetDeg,
      row.symbolCount,
      row.theoryBer,
      row.theorySer,
      row.mcBer,
      row.mcSer,
      row.bitErrors,
      row.symbolErrors
    ].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `eevl-${result.p.modulation.toLowerCase()}-awgn.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function selectExperiment(name) {
  experiment = name;
  fill(presets[name]);
  document.querySelectorAll('[data-preset]').forEach(btn => {
    const active = btn.dataset.preset === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  iqExtent = DEFAULT_IQ_EXTENT;
  berLogRange = [DEFAULT_BER_LOG_MIN, DEFAULT_BER_LOG_MAX];
  selectedSample = 0;
  run();
  translate();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  run();
});

form.addEventListener('input', e => {
  if (e.target.name === 'ebN0Db') $('ebn0-slider').value = e.target.value;
  if (e.target.name === 'phaseOffsetDeg') $('phase-slider').value = e.target.value;
  run();
});

$('ebn0-slider').addEventListener('input', e => {
  form.elements.ebN0Db.value = e.target.value;
  run();
});

$('phase-slider').addEventListener('input', e => {
  form.elements.phaseOffsetDeg.value = e.target.value;
  run();
});

$('new-noise').addEventListener('click', () => {
  const current = Number.isInteger(form.elements.seed.valueAsNumber) ? form.elements.seed.valueAsNumber : defaults.seed;
  form.elements.seed.value = (current % 2147483646) + 1;
  run();
});

$('reset').addEventListener('click', () => selectExperiment('qpsk'));
$('toggle-boundaries').addEventListener('change', () => { if (result) drawConstellation(); });
$('toggle-labels').addEventListener('change', () => { if (result) drawConstellation(); });
$('toggle-ser').addEventListener('change', () => { if (result) drawBerChart(); });
$('toggle-compare').addEventListener('change', () => { if (result) drawBerChart(); });
$('iq-adjust').addEventListener('click', adjustIqScale);
$('iq-restore').addEventListener('click', () => { iqExtent = DEFAULT_IQ_EXTENT; if (result) drawConstellation(); });
$('ber-adjust').addEventListener('click', adjustBerScale);
$('ber-restore').addEventListener('click', () => { berLogRange = [DEFAULT_BER_LOG_MIN, DEFAULT_BER_LOG_MAX]; if (result) drawBerChart(); });
$('export-csv').addEventListener('click', exportCsv);

document.querySelectorAll('[data-preset]').forEach(btn =>
  btn.addEventListener('click', () => selectExperiment(btn.dataset.preset))
);

document.addEventListener('languagechange', () => {
  if (dictionary.en) translate();
});

try {
  const response = await fetch(new URL('./locales.json', import.meta.url));
  if (!response.ok) throw new Error('locales');
  dictionary = await response.json();
  await initialize();
  selectExperiment('qpsk');
} catch (error) {
  console.error(error);
  $('results').hidden = true;
  $('error').hidden = false;
  $('error').textContent = tr('loadError');
}
