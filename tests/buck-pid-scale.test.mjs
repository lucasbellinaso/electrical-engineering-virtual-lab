import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const helperSource = await readFile(new URL('../assets/js/buck-pid-scale.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../simulators/control-systems/buck-pid/app.html', import.meta.url), 'utf8');
const context = {};
runInNewContext(helperSource, context);
const createRange = () => context.BuckPidScale.createRange();
const bounds = range => {
  const value = range.bounds();
  return value === null ? null : Array.from(value);
};

test('cumulative limits expand monotonically and retain extrema after they leave the ring buffer', () => {
  const range = createRange();
  assert.equal(range.bounds(), null);
  range.include(12);
  range.include(18);
  const first = bounds(range);
  assert.deepEqual(first, [-0.5, 18.72]);
  assert.equal(range.min, 12);
  assert.equal(range.max, 18);

  // Model ring eviction: only later samples within the old extrema remain in the window.
  for (const value of [13, 14, 15, 16]) range.include(value);
  assert.deepEqual(bounds(range), first);
  assert.equal(range.min, 12);
  assert.equal(range.max, 18);

  range.include(-4);
  const expanded = bounds(range);
  assert.ok(expanded[0] < first[0]);
  assert.ok(expanded[1] >= first[1]);
  for (const value of [0, 1, 2, 3]) range.include(value);
  assert.deepEqual(bounds(range), expanded);
});

test('negative-only, zero-constant and near-zero samples produce finite padded limits', () => {
  const negative = createRange();
  negative.include(-5);
  negative.include(-2);
  const negativeBounds = bounds(negative);
  assert.deepEqual(negativeBounds, [-5.62, 0.5]);
  assert.ok(negativeBounds.every(Number.isFinite));

  const zero = createRange();
  zero.include(0);
  assert.deepEqual(bounds(zero), [-0.62, 0.62]);

  const tiny = createRange();
  tiny.include(1e-12);
  const tinyBounds = bounds(tiny);
  assert.ok(Math.abs(tinyBounds[0] + 0.62) < 1e-10 && Math.abs(tinyBounds[1] - 0.62) < 1e-10);
  assert.ok(tinyBounds[0] < 1e-12 && tinyBounds[1] > 1e-12);
});

test('non-finite values are ignored without changing range state', () => {
  const range = createRange();
  for (const value of [NaN, Infinity, -Infinity]) range.include(value);
  assert.equal(range.bounds(), null);
  assert.equal(range.min, null);
  assert.equal(range.max, null);

  range.include(-3);
  range.include(4);
  const before = bounds(range);
  for (const value of [NaN, Infinity, -Infinity]) range.include(value);
  assert.deepEqual(bounds(range), before);
  assert.equal(range.min, -3);
  assert.equal(range.max, 4);
});

test('explicit reset clears accumulated extrema and starts the next scale afresh', () => {
  const range = createRange();
  range.include(-50);
  range.include(80);
  range.reset();
  assert.equal(range.bounds(), null);
  assert.equal(range.min, null);
  assert.equal(range.max, null);
  range.include(3);
  assert.deepEqual(bounds(range), [-0.5, 3.62]);
  assert.equal(range.min, 3);
  assert.equal(range.max, 3);
});

test('Buck PID integration samples each period, keeps duty fixed, and resets ranges only with simulation reset', () => {
  assert.match(appSource, /<script src="\.\.\/\.\.\/\.\.\/assets\/js\/buck-pid-scale\.js"><\/script>/);
  assert.match(appSource, /const plotScale=window\.buckPidScale=\{voltage:BuckPidScale\.createRange\(\),current:BuckPidScale\.createRange\(\)\}/);
  assert.match(appSource, /for\(let k=0;k<n;k\+\+\)\{period\(\);capturePlotScale\(\)\}/);
  assert.match(appSource, /plotScale\.voltage\.include\(bv\[idx\]\);plotScale\.voltage\.include\(br\[idx\]\);plotScale\.current\.include\(bi\[idx\]\)/);

  // The third pane retains its fixed [-0.05, 1.05] duty range; only voltage/current read adapters.
  assert.match(appSource, /\{a:bd,lab:"D",c:red,fixed:\[-0\.05,1\.05\]\}/);
  assert.match(appSource, /pn\.fixed\|\|\(ix===0\?plotScale\.voltage:plotScale\.current\)\.bounds\(\)/);

  // Pause/resume and rolling-buffer changes leave cumulative limits alone.
  assert.match(appSource, /\$\("bRun"\)\.addEventListener\("click",\(\)=>\{running=!running;/);
  assert.match(appSource, /\$\("sWin"\)\.addEventListener\("change",e=>\{win=\+e\.target\.value\*1e-3;resetBuf\(\)\}\);/);
  assert.match(appSource, /if\(k==="fsw"\)resetBuf\(\)/);
  assert.doesNotMatch(appSource, /function resetBuf\(\)\{[^}]*resetPlotScale/);
  assert.match(appSource, /\$\("bReset"\)\.addEventListener\("click",\(\)=>\{resetSim\(\);resetBuf\(\);resetPlotScale\(\)\}\);/);
  assert.match(appSource, /if\(!isFinite\(s\.vC\)\|\|Math\.abs\(s\.vC\)>1e6\)\{resetSim\(\);resetBuf\(\);resetPlotScale\(\)\}/);
});
