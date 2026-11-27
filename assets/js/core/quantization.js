import {round, floor, ceil} from './rounding.js';

/** Uniform endpoint-inclusive quantization, with input saturation. */
export function quantize(input, options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
  const {min, max, levels, bits, rounding = 'nearest'} = options;
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) throw new RangeError('min and max must be finite with max > min');
  if ((levels === undefined) === (bits === undefined)) throw new RangeError('Specify exactly one of levels or bits');
  if (bits !== undefined && (!Number.isInteger(bits) || bits < 1 || bits > 52)) throw new RangeError('bits must be an integer between 1 and 52');
  const count = bits === undefined ? levels : 2 ** bits;
  if (!Number.isSafeInteger(count) || count < 2) throw new RangeError('levels must be a safe integer of at least 2');
  const steps = {nearest: round, floor, ceil};
  if (!Object.hasOwn(steps, rounding)) throw new RangeError('rounding must be nearest, floor or ceil');
  const span = max - min, step = span / (count - 1);
  if (!Number.isFinite(span) || !Number.isFinite(step) || step <= 0 || min + step === min || max - step === max) throw new RangeError('quantization step is not representable');
  const one = value => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('input values must be finite real numbers');
    const clamped = Math.max(min, Math.min(max, value));
    const index = Math.max(0, Math.min(count - 1, steps[rounding]((clamped - min) / step)));
    const quantized = index === 0 ? min : index === count - 1 ? max : min + index * step;
    return {value: quantized, index, error: quantized - value};
  };
  const map = value => {
    if (Array.isArray(value) || value instanceof Float64Array) {
      const items = Array.from(value, map);
      return {value: items.map(v => v.value), index: items.map(v => v.index), error: items.map(v => v.error)};
    }
    return one(value);
  };
  const result = map(input);
  return {values: result.value, indices: result.index, error: result.error, step, levels: count};
}
