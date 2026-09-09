const MAX_BODIES = 357913941;
const MAX_SAFE = 9007199254740991;

/** Error with one of the stable motion.target-springs-2d contract codes. */
export class SpringError extends Error {
  constructor(code, bodyIndex = null, axis = null, stage = null) {
    super(code);
    this.name = "SpringError";
    this.code = code;
    if (code === "SPRING_ARITHMETIC_INVALID") {
      this.bodyIndex = bodyIndex;
      this.axis = axis;
      this.stage = stage;
    }
  }
}

function fail(code) { throw new SpringError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function zero(value) { return value === 0 ? 0 : value; }
function number(value, code) { if (!finite(value)) fail(code); return zero(value); }
function strengthOf(value) { const n = number(value, "INVALID_INPUT"); if (n < 0) fail("INVALID_INPUT"); return n; }
function retentionOf(value) { const n = number(value, "INVALID_INPUT"); if (n < 0 || n > 1) fail("INVALID_INPUT"); return n; }

function passiveRecord(value, keys, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  if (Reflect.ownKeys(value).length !== keys.length) fail(code);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) fail(code);
  }
  return value;
}
function recordValue(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value, code) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(code);
  return value;
}
function arrayItem(array, index, code) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor === undefined || !("value" in descriptor)) fail(code);
  return descriptor.value;
}
function pair(value, code) {
  const array = passiveArray(value, code);
  if (array.length !== 2) fail(code);
  return array;
}
function writableSlot(array, index) {
  const key = String(index);
  const descriptor = Object.getOwnPropertyDescriptor(array, key);
  if (descriptor !== undefined) return "value" in descriptor && descriptor.writable === true;
  if (!Object.isExtensible(array)) return false;
  for (let prototype = Object.getPrototypeOf(array); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    if (Object.getOwnPropertyDescriptor(prototype, key) !== undefined) return false;
  }
  return true;
}

function validateBody(supplied) {
  const record = passiveRecord(supplied, ["position", "velocity", "strength", "retention"], "INVALID_INPUT");
  const position = pair(recordValue(record, "position"), "INVALID_INPUT");
  number(arrayItem(position, 0, "INVALID_INPUT"), "INVALID_INPUT");
  number(arrayItem(position, 1, "INVALID_INPUT"), "INVALID_INPUT");
  const velocity = pair(recordValue(record, "velocity"), "INVALID_INPUT");
  number(arrayItem(velocity, 0, "INVALID_INPUT"), "INVALID_INPUT");
  number(arrayItem(velocity, 1, "INVALID_INPUT"), "INVALID_INPUT");
  strengthOf(recordValue(record, "strength"));
  retentionOf(recordValue(record, "retention"));
}
function validateTargetPair(supplied) {
  const target = pair(supplied, "INVALID_INPUT");
  number(arrayItem(target, 0, "INVALID_INPUT"), "INVALID_INPUT");
  number(arrayItem(target, 1, "INVALID_INPUT"), "INVALID_INPUT");
}
function arithmetic(value, bodyIndex, axis, stage) {
  if (!Number.isFinite(value)) throw new SpringError("SPRING_ARITHMETIC_INVALID", bodyIndex, axis, stage);
  return value;
}

class TargetSprings {
  #current; #count;
  constructor(current, count) {
    this.#current = current;
    this.#count = count;
    Object.freeze(this);
  }
  get size() { return this.#count; }

  #checkedIndex(index) {
    if (typeof index !== "number" || !Number.isFinite(index) || index < 0
        || index !== Math.floor(index) || index > MAX_SAFE) fail("INVALID_INDEX");
    if (index >= this.#count) throw new SpringError("INDEX_OUT_OF_RANGE");
    return index;
  }
  #checkOutput(output, offset) {
    if (!Array.isArray(output) && !(output instanceof Float64Array)) throw new SpringError("INVALID_OUTPUT");
    if (!Number.isInteger(offset) || offset < 0 || offset > output.length - 2) throw new SpringError("INVALID_OUTPUT");
    if (!writableSlot(output, offset) || !writableSlot(output, offset + 1)) throw new SpringError("INVALID_OUTPUT");
  }
  positionAt(index) {
    const i = this.#checkedIndex(index), offset = i * 6;
    return [this.#current[offset], this.#current[offset + 1]];
  }
  velocityAt(index) {
    const i = this.#checkedIndex(index), offset = i * 6;
    return [this.#current[offset + 2], this.#current[offset + 3]];
  }
  positionInto(index, output, offset = 0) {
    const i = this.#checkedIndex(index);
    this.#checkOutput(output, offset);
    const source = i * 6;
    output[offset] = this.#current[source];
    output[offset + 1] = this.#current[source + 1];
    return output;
  }
  velocityInto(index, output, offset = 0) {
    const i = this.#checkedIndex(index);
    this.#checkOutput(output, offset);
    const source = i * 6;
    output[offset] = this.#current[source + 2];
    output[offset + 1] = this.#current[source + 3];
    return output;
  }
  strengthAt(index) { return this.#current[this.#checkedIndex(index) * 6 + 4]; }
  retentionAt(index) { return this.#current[this.#checkedIndex(index) * 6 + 5]; }

  toValues() {
    const bodies = [];
    for (let index = 0, offset = 0; index < this.#count; index += 1, offset += 6) {
      bodies.push({
        position: [this.#current[offset], this.#current[offset + 1]],
        velocity: [this.#current[offset + 2], this.#current[offset + 3]],
        strength: this.#current[offset + 4],
        retention: this.#current[offset + 5],
      });
    }
    return { bodies };
  }
}

function buildState(state) {
  const record = passiveRecord(state, ["bodies"], "INVALID_INPUT");
  const suppliedBodies = recordValue(record, "bodies");
  const bodies = passiveArray(suppliedBodies, "INVALID_INPUT");
  if (bodies.length > MAX_BODIES) fail("INVALID_INPUT");
  const count = bodies.length;
  for (let i = 0; i < count; i += 1) validateBody(arrayItem(bodies, i, "INVALID_INPUT"));

  const current = new Array(count * 6).fill(0);
  for (let i = 0, offset = 0; i < count; i += 1, offset += 6) {
    const body = passiveRecord(arrayItem(bodies, i, "INVALID_INPUT"), ["position", "velocity", "strength", "retention"], "INVALID_INPUT");
    const position = pair(recordValue(body, "position"), "INVALID_INPUT");
    const velocity = pair(recordValue(body, "velocity"), "INVALID_INPUT");
    current[offset] = number(arrayItem(position, 0, "INVALID_INPUT"), "INVALID_INPUT");
    current[offset + 1] = number(arrayItem(position, 1, "INVALID_INPUT"), "INVALID_INPUT");
    current[offset + 2] = number(arrayItem(velocity, 0, "INVALID_INPUT"), "INVALID_INPUT");
    current[offset + 3] = number(arrayItem(velocity, 1, "INVALID_INPUT"), "INVALID_INPUT");
    current[offset + 4] = strengthOf(recordValue(body, "strength"));
    current[offset + 5] = retentionOf(recordValue(body, "retention"));
  }
  return { current, count };
}

function buildTargets(targets, count) {
  const pairs = passiveArray(targets, "INVALID_INPUT");
  if (pairs.length !== count) fail("INVALID_INPUT");
  for (let i = 0; i < pairs.length; i += 1) validateTargetPair(arrayItem(pairs, i, "INVALID_INPUT"));
  const captured = new Array(count * 2).fill(0);
  for (let i = 0, offset = 0; i < pairs.length; i += 1, offset += 2) {
    const p = pair(arrayItem(pairs, i, "INVALID_INPUT"), "INVALID_INPUT");
    captured[offset] = number(arrayItem(p, 0, "INVALID_INPUT"), "INVALID_INPUT");
    captured[offset + 1] = number(arrayItem(p, 1, "INVALID_INPUT"), "INVALID_INPUT");
  }
  return captured;
}

/**
 * Advance an ordered independent target-spring state by one explicit logical step:
 * target force, position using updated velocity, then velocity retention.
 * Implements motion.target-springs-2d 0.1.0 independently of source code. Motivating
 * sketch: survey/out/2018/Generativos/araniaaas; no artistic strength/retention range
 * is established, see the catalog contract for evidence. Each call is a pure one-step
 * transition; feed a returned state back in as the next call's state for animation.
 */
export function targetSprings2D(input) {
  const record = passiveRecord(input, ["state", "targets"], "INVALID_INPUT");
  const { current, count } = buildState(recordValue(record, "state"));
  const captured = buildTargets(recordValue(record, "targets"), count);

  const next = new Array(count * 6).fill(0);
  for (let body = 0, stateOffset = 0, targetOffset = 0; body < count; body += 1, stateOffset += 6, targetOffset += 2) {
    for (const [axis, axisOffset] of [["x", 0], ["y", 1]]) {
      const delta = arithmetic(captured[targetOffset + axisOffset] - current[stateOffset + axisOffset], body, axis, "delta");
      const force = arithmetic(delta * current[stateOffset + 4], body, axis, "force");
      const advanced = arithmetic(current[stateOffset + 2 + axisOffset] + force, body, axis, "advanced");
      const position = arithmetic(current[stateOffset + axisOffset] + advanced, body, axis, "position");
      const velocity = arithmetic(advanced * current[stateOffset + 5], body, axis, "velocity");
      next[stateOffset + axisOffset] = zero(position);
      next[stateOffset + 2 + axisOffset] = zero(velocity);
    }
    next[stateOffset + 4] = current[stateOffset + 4];
    next[stateOffset + 5] = current[stateOffset + 5];
  }
  return new TargetSprings(next, count);
}
