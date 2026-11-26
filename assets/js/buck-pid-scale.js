(function (root) {
  'use strict';

  // Keep the displayed limits monotonic, including their padding.
  function createRange() {
    let min = Infinity, max = -Infinity, lower = -0.5, upper = 0.5;
    return {
      include(value) {
        if (!Number.isFinite(value)) return;
        min = Math.min(min, value);
        max = Math.max(max, value);
        let lo = min, hi = max;
        if (!(hi > lo)) { lo -= 0.5; hi += 0.5; }
        const pad = (hi - lo) * 0.12;
        lower = Math.min(lower, lo - pad);
        upper = Math.max(upper, hi + pad);
      },
      bounds() { return min === Infinity ? null : [lower, upper]; },
      reset() { min = Infinity; max = -Infinity; lower = -0.5; upper = 0.5; },
      get min() { return min === Infinity ? null : min; },
      get max() { return max === -Infinity ? null : max; }
    };
  }
  root.BuckPidScale = Object.freeze({createRange});
})(globalThis);
