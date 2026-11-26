// Presentation hooks only: forward every drawing argument and dialog return value.
// No solver, parameter, state vector, numeric format or exported data is changed.
const installed = new WeakMap();

export function installPresentationHooks(win, translate) {
  let state = installed.get(win);
  if (state) { state.translate = translate; return; }
  state = {translate};
  installed.set(win, state);
  const prototype = win.CanvasRenderingContext2D?.prototype;
  for (const name of ['fillText', 'strokeText']) {
    const original = prototype?.[name];
    if (typeof original !== 'function') continue;
    prototype[name] = function (text, ...args) {
      // Keep numeric ticks as numbers. Only explicit dictionary matches change.
      return Reflect.apply(original, this, [typeof text === 'string' ? state.translate(text) : text, ...args]);
    };
  }
  for (const name of ['alert', 'confirm', 'prompt']) {
    const original = win[name];
    if (typeof original !== 'function') continue;
    win[name] = function (message, ...args) {
      return Reflect.apply(original, win, [typeof message === 'string' ? state.translate(message) : message, ...args]);
    };
  }
}

export function redrawPresentation(win) {
  // These supplied apps already redraw on resize. Buck PID draws every frame.
  // Reuse those handlers rather than copying or replacing any simulation code.
  win.dispatchEvent(new win.Event('resize'));
}
