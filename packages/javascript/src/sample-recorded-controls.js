/** Stable errors for signal.sample-recorded-controls 0.1.0. */
export class SampleRecordedControlsError extends Error {
  constructor(code) { super(code); this.name = 'SampleRecordedControlsError'; this.code = code; }
}

function fail(code) { throw new SampleRecordedControlsError(code); }
const invalid = () => fail('INVALID_INPUT');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const identifier = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
const own = (object, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid();
  return descriptor.value;
};
function record(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length) invalid();
  for (const key of keys) own(value, key);
  return value;
}
function array(value, count = null) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length === 0 || value.length > 2147483647 ||
      (count !== null && value.length !== count) ||
      Reflect.ownKeys(value).length !== value.length + 1) invalid();
  // Exact key count together with every own data slot excludes extras and holes.
  for (let i = 0; i < value.length; i += 1) own(value, String(i));
  return value;
}
function numeric(value, positive = false) {
  if (!finite(value) || (positive ? value <= 0 : value < 0)) invalid();
  return value;
}
function computed(value) {
  if (!Number.isFinite(value)) fail('NUMERIC_OVERFLOW');
  return value;
}

/**
 * Samples explicit scalar channels at a caller-supplied time. All carriers and all
 * source values are validated before the exact T*C+M work preflight. The result is
 * detached and stateless; feature extraction, fonts and media remain host work.
 * Motivated by the recorded-control task in Davis's NikeLab 21 Mercer work;
 * see design/capabilities/recorded-controls-and-type.md for evidence limits.
 */
export function sampleRecordedControls(input) {
  record(input, ['times', 'channels', 'samples', 'time', 'maxGap', 'mappings', 'maxWork']);
  const times = array(own(input, 'times'));
  const tCount = times.length;
  let previous = -1;
  for (let i = 0; i < tCount; i += 1) {
    const time = numeric(own(times, String(i)));
    if (time <= previous) invalid();
    previous = time;
  }
  const channels = array(own(input, 'channels'));
  const cCount = channels.length, channelIndex = new Map();
  for (let i = 0; i < cCount; i += 1) {
    const name = own(channels, String(i));
    if (!identifier(name) || channelIndex.has(name)) invalid();
    channelIndex.set(name, i);
  }
  const samples = array(own(input, 'samples'), tCount);
  for (let i = 0; i < tCount; i += 1) {
    const row = array(own(samples, String(i)), cCount);
    for (let j = 0; j < cCount; j += 1) {
      if (!finite(own(row, String(j)))) invalid();
    }
  }
  const query = numeric(own(input, 'time'));
  const maxGap = numeric(own(input, 'maxGap'), true);
  const mappings = array(own(input, 'mappings'));
  const mCount = mappings.length, indices = new Array(mCount);
  for (let i = 0; i < mCount; i += 1) {
    const mapping = record(own(mappings, String(i)),
      ['channel', 'interpolation', 'domain', 'range', 'clamp']);
    const channel = own(mapping, 'channel');
    if (!identifier(channel) || !channelIndex.has(channel)) invalid();
    indices[i] = channelIndex.get(channel);
    const interpolation = own(mapping, 'interpolation');
    if (interpolation !== 'LINEAR' && interpolation !== 'STEP') invalid();
    const domain = array(own(mapping, 'domain'), 2);
    const d0 = own(domain, '0'), d1 = own(domain, '1');
    if (!finite(d0) || !finite(d1) || d0 >= d1) invalid();
    const range = array(own(mapping, 'range'), 2);
    if (!finite(own(range, '0')) || !finite(own(range, '1'))) invalid();
    if (typeof own(mapping, 'clamp') !== 'boolean') invalid();
  }
  const maxWork = own(input, 'maxWork');
  if (!Number.isSafeInteger(maxWork) || maxWork < 0) invalid();
  const work = tCount * cCount + mCount;
  if (!Number.isSafeInteger(work) || work > maxWork) fail('WORK_LIMIT');

  let left = 0, right = 0, fraction = null;
  if (query >= own(times, String(tCount - 1))) left = right = tCount - 1;
  else if (query > own(times, '0')) {
    let lo = 0, hi = tCount - 1;
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (query < own(times, String(mid))) hi = mid; else lo = mid;
    }
    left = lo;
    if (query !== own(times, String(lo))) {
      right = hi;
      const gap = computed(own(times, String(hi)) - own(times, String(lo)));
      if (gap > maxGap) fail('TIME_GAP');
      fraction = computed(computed(query - own(times, String(lo))) / gap);
    } else right = lo;
  }

  const values = new Array(mCount);
  for (let i = 0; i < mCount; i += 1) {
    const mapping = own(mappings, String(i));
    const column = String(indices[i]);
    let value = own(own(samples, String(left)), column);
    if (left !== right && own(mapping, 'interpolation') === 'LINEAR') {
      const next = own(own(samples, String(right)), column);
      value = computed(value + computed(fraction * computed(next - value)));
    }
    const domain = own(mapping, 'domain'), range = own(mapping, 'range');
    const delta = computed(value - own(domain, '0'));
    const span = computed(own(domain, '1') - own(domain, '0'));
    let normalized = computed(delta / span);
    if (own(mapping, 'clamp')) normalized = Math.min(1, Math.max(0, normalized));
    const extent = computed(own(range, '1') - own(range, '0'));
    const scaled = computed(normalized * extent);
    const result = computed(own(range, '0') + scaled);
    values[i] = result === 0 ? 0 : result;
  }
  return { values };
}
