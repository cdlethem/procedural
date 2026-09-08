const MAX_COLOR_COUNT = 2_147_483_647;
const MAX_RGB24 = 0xff_ff_ff;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** Error with one of the stable cyclic-palette contract codes. */
export class CyclicPaletteError extends Error {
  constructor(code) {
    super(code);
    this.name = "CyclicPaletteError";
    this.code = code;
  }
}

function fail(code) {
  throw new CyclicPaletteError(code);
}

function normalizedZero(value) {
  return value === 0 ? 0 : value;
}

function dataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function rgb24(value) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) &&
    value >= 0 && value <= MAX_RGB24;
}

function validateColors(colors) {
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > MAX_COLOR_COUNT) {
    fail("INVALID_INPUT");
  }

  // Arrays are interchange data: require exactly contiguous own data entries and length.
  const keys = Reflect.ownKeys(colors);
  if (keys.length !== colors.length + 1 || !keys.includes("length")) {
    fail("INVALID_INPUT");
  }

  const snapshot = new Array(colors.length);
  for (let index = 0; index < colors.length; index += 1) {
    if (!hasOwn(colors, index)) fail("INVALID_INPUT");
    const value = dataProperty(colors, String(index));
    if (!rgb24(value)) fail("INVALID_INPUT");
    snapshot[index] = normalizedZero(value);
  }
  return snapshot;
}

function validateInput(params) {
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    fail("INVALID_INPUT");
  }
  const keys = Reflect.ownKeys(params);
  if (keys.length !== 1 || !hasOwn(params, "colors")) {
    fail("INVALID_INPUT");
  }
  return validateColors(dataProperty(params, "colors"));
}

function validatePhase(phase) {
  if (typeof phase !== "number" || !Number.isFinite(phase)) {
    fail("INVALID_QUERY");
  }
  return phase;
}

function channel(a, b, t) {
  const difference = b - a;
  const product = t * difference;
  const value = a + product;
  return Math.floor(value + 0.5);
}

/**
 * Create an immutable cyclic RGB24 sampler.
 *
 * Motivating notes: `survey/out/2018/Generativos/mountain4/notes.md`,
 * `survey/out/2018/Generativos/pelines/notes.md`, and
 * `survey/out/2017/Generativos/Cuadricula/notes.md`.
 * They establish cyclic adjacent-colour interpolation; this operation uses
 * portable cycles and encoded sRGB8 channels rather than host `lerpColor` behavior.
 * No default palette, phase, or encouraged artistic range is established.
 */
export function cyclicPalette(params) {
  const colors = validateInput(params);
  const length = colors.length;

  /** Sample the immutable palette at one finite binary64 phase measured in cycles. */
  function sample(phase) {
    if (arguments.length !== 1) {
      throw new TypeError("sample expects one phase");
    }
    phase = validatePhase(phase);
    if (length === 1) return colors[0];

    let fraction = phase - Math.floor(phase);
    if (fraction === 0 || fraction === 1) fraction = 0;
    let position = fraction * length;
    if (position === length) position = 0;
    const index = Math.floor(position);
    const interpolation = position - index;
    const nextIndex = index + 1 === length ? 0 : index + 1;
    const first = colors[index];
    const second = colors[nextIndex];
    const red = channel((first >>> 16) & 0xff, (second >>> 16) & 0xff, interpolation);
    const green = channel((first >>> 8) & 0xff, (second >>> 8) & 0xff, interpolation);
    const blue = channel(first & 0xff, second & 0xff, interpolation);
    return red * 65_536 + green * 256 + blue;
  }

  function serialize() {
    return { colors: colors.slice() };
  }

  const sampler = { sample, serialize };
  Object.defineProperty(sampler, "toJSON", { value: serialize });
  return Object.freeze(sampler);
}
