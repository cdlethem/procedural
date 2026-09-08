const MAX_SEGMENTS = 357_913_941;
const MASK64 = (1n << 64n) - 1n;
const KEYS = ["seed", "root", "rules", "maxSegments"];
const ROOT_KEYS = ["origin", "heading", "length"];
const RULE_KEYS = ["lengthScale", "slots"];
const SLOT_KEYS = ["probability", "turn"];

export class BranchTreeError extends Error {
  constructor(code, parentIndex = undefined, slotIndex = undefined, stage = undefined) {
    super(code); this.name = "BranchTreeError"; this.code = code;
    if (parentIndex !== undefined) this.parentIndex = parentIndex;
    if (slotIndex !== undefined) this.slotIndex = slotIndex;
    if (stage !== undefined) this.stage = stage;
  }
}
function fail(code) { throw new BranchTreeError(code); }
function arithmetic(parentIndex, slotIndex, stage) { throw new BranchTreeError("BRANCH_ARITHMETIC_INVALID", parentIndex, slotIndex, stage); }
function limit(parentIndex, slotIndex) { throw new BranchTreeError("SEGMENT_LIMIT_EXCEEDED", parentIndex, slotIndex); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function zero(value) { return value === 0 ? 0 : value; }
function number(value) { if (!finite(value)) fail("INVALID_INPUT"); return zero(value); }
function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null || Reflect.ownKeys(value).length !== keys.length) fail("INVALID_INPUT");
  for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT"); }
  return value;
}
function value(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value, length = undefined) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || (length !== undefined && value.length !== length)) fail("INVALID_INPUT");
  return value;
}
function item(array, index) { const descriptor = Object.getOwnPropertyDescriptor(array, String(index)); if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT"); return descriptor.value; }
function pair(value) { return passiveArray(value, 2); }
function nonnegative(value) { const result = number(value); if (result < 0) fail("INVALID_INPUT"); return result; }
function integral(value, minimum, maximum) { const result = number(value); if (!Number.isSafeInteger(result) || result < minimum || result > maximum) fail("INVALID_INPUT"); return result; }
function root(value_) {
  const record = passiveRecord(value_, ROOT_KEYS), origin = pair(value(record, "origin"));
  return { x: number(item(origin, 0)), y: number(item(origin, 1)), heading: number(value(record, "heading")), length: nonnegative(value(record, "length")) };
}
function rules(value_) {
  const supplied = passiveArray(value_), output = new Array(supplied.length);
  for (let ruleIndex = 0; ruleIndex < supplied.length; ruleIndex += 1) {
    const record = passiveRecord(item(supplied, ruleIndex), RULE_KEYS), scale = pair(value(record, "lengthScale"));
    const scaleLow = nonnegative(item(scale, 0)), scaleHigh = nonnegative(item(scale, 1)); if (scaleLow > scaleHigh) fail("INVALID_INPUT");
    const suppliedSlots = passiveArray(value(record, "slots")), slots = new Array(suppliedSlots.length);
    for (let slotIndex = 0; slotIndex < suppliedSlots.length; slotIndex += 1) {
      const slot = passiveRecord(item(suppliedSlots, slotIndex), SLOT_KEYS), probability = number(value(slot, "probability"));
      if (probability < 0 || probability > 1) fail("INVALID_INPUT");
      const turn = pair(value(slot, "turn")), low = number(item(turn, 0)), high = number(item(turn, 1)); if (low > high) fail("INVALID_INPUT");
      slots[slotIndex] = { probability, low, high };
    }
    output[ruleIndex] = { scaleLow, scaleHigh, slots };
  }
  return output;
}
function interpolate(low, high, unit) {
  if (unit === 0) return zero(low); if (unit === 1) return zero(high);
  let raw = (low < 0 && high > 0) || (high < 0 && low > 0) ? low * (1 - unit) + high * unit : low + (high - low) * unit;
  if (raw < low) raw = low; else if (raw > high) raw = high;
  return zero(raw);
}
function splitMix(state) { state = ((state ^ (state >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64; state = ((state ^ (state >> 27n)) * 0x94d049bb133111ebn) & MASK64; return (state ^ (state >> 31n)) & MASK64; }
class Stream {
  constructor(seed) { let state = (BigInt(seed) + 0x9e3779b97f4a7c15n) & MASK64; const first = splitMix(state); state = (state + 0x9e3779b97f4a7c15n) & MASK64; const second = splitMix(state); this.s0 = Number(first & 0xffffffffn) >>> 0; this.s1 = Number(first >> 32n) >>> 0; this.s2 = Number(second & 0xffffffffn) >>> 0; this.s3 = Number(second >> 32n) >>> 0; }
  output() { const value_ = Math.imul(this.s1, 5) >>> 0, result = Math.imul(((value_ << 7) | (value_ >>> 25)) >>> 0, 9) >>> 0, temporary = (this.s1 << 9) >>> 0; this.s2 = (this.s2 ^ this.s0) >>> 0; this.s3 = (this.s3 ^ this.s1) >>> 0; this.s1 = (this.s1 ^ this.s2) >>> 0; this.s0 = (this.s0 ^ this.s3) >>> 0; this.s2 = (this.s2 ^ temporary) >>> 0; this.s3 = ((this.s3 << 11) | (this.s3 >>> 21)) >>> 0; return result; }
  unit() { return this.output() / 4_294_967_296; }
  state() { return [this.s0, this.s1, this.s2, this.s3]; }
}
class Storage {
  constructor(maximum) { this.maximum = maximum; this.size = 0; this.capacity = Math.min(maximum, 16); this.startX = new Float64Array(this.capacity); this.startY = new Float64Array(this.capacity); this.endX = new Float64Array(this.capacity); this.endY = new Float64Array(this.capacity); this.headings = new Float64Array(this.capacity); this.lengths = new Float64Array(this.capacity); this.parents = new Int32Array(this.capacity); this.generations = new Int32Array(this.capacity); this.childCounts = new Int32Array(this.capacity); }
  grow() { if (this.size < this.capacity) return; let capacity = this.capacity; while (capacity < this.size + 1) capacity = Math.min(this.maximum, capacity + Math.max(capacity, 16)); for (const name of ["startX", "startY", "endX", "endY", "headings", "lengths"]) { const next = new Float64Array(capacity); next.set(this[name]); this[name] = next; } for (const name of ["parents", "generations", "childCounts"]) { const next = new Int32Array(capacity); next.set(this[name]); this[name] = next; } this.capacity = capacity; }
  append(x0, y0, x1, y1, heading, length, parent, generation) { this.grow(); const i = this.size++; this.startX[i] = x0; this.startY[i] = y0; this.endX[i] = x1; this.endY[i] = y1; this.headings[i] = heading; this.lengths[i] = length; this.parents[i] = parent; this.generations[i] = generation; this.childCounts[i] = 0; }
  finish() { for (const name of ["startX", "startY", "endX", "endY", "headings", "lengths", "parents", "generations", "childCounts"]) this[name] = this[name].slice(0, this.size); return this; }
}
class Result {
  #storage;
  constructor(storage) { this.#storage = storage; Object.freeze(this); }
  get size() { return this.#storage.size; }
  #index(index) { if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) fail("INVALID_INDEX"); if (index >= this.size) fail("INDEX_OUT_OF_RANGE"); return index; }
  segmentAt(index) { const i = this.#index(index), s = this.#storage; return [zero(s.startX[i]), zero(s.startY[i]), zero(s.endX[i]), zero(s.endY[i])]; }
  headingAt(index) { return zero(this.#storage.headings[this.#index(index)]); }
  lengthAt(index) { return zero(this.#storage.lengths[this.#index(index)]); }
  parentAt(index) { return this.#storage.parents[this.#index(index)]; }
  generationAt(index) { return this.#storage.generations[this.#index(index)]; }
  childCountAt(index) { return this.#storage.childCounts[this.#index(index)]; }
  segmentInto(index, out, offset = 0) { const i = this.#index(index); if (!(out instanceof Float64Array) && !(Array.isArray(out) && Object.getPrototypeOf(out) === Array.prototype)) fail("INVALID_OUTPUT"); if (!finite(offset) || !Number.isSafeInteger(offset) || offset < 0 || offset > out.length - 4) fail("INVALID_OUTPUT"); if (Array.isArray(out)) for (let n = 0; n < 4; n += 1) { const descriptor = Object.getOwnPropertyDescriptor(out, String(offset + n)); if (descriptor !== undefined && (!("value" in descriptor) || descriptor.writable !== true) || descriptor === undefined && !Object.isExtensible(out)) fail("INVALID_OUTPUT"); } const s = this.#storage; out[offset] = zero(s.startX[i]); out[offset + 1] = zero(s.startY[i]); out[offset + 2] = zero(s.endX[i]); out[offset + 3] = zero(s.endY[i]); return out; }
  toValues() { const s = this.#storage, result = { segments: new Array(this.size), headings: new Array(this.size), lengths: new Array(this.size), parents: new Array(this.size), generations: new Array(this.size), childCounts: new Array(this.size) }; for (let i = 0; i < this.size; i += 1) { result.segments[i] = this.segmentAt(i); result.headings[i] = zero(s.headings[i]); result.lengths[i] = zero(s.lengths[i]); result.parents[i] = s.parents[i]; result.generations[i] = s.generations[i]; result.childCounts[i] = s.childCounts[i]; } return result; }
}

/**
 * Retain a bounded breadth-first endpoint branch tree.
 * Motivated by survey/out/2018/Generativos/arbolito3/notes.md and
 * survey/out/2018/Generativos/arbolito4/notes.md. Their measured edits establish
 * impact, not defaults or recommended parameter ranges. See
 * topology.seeded-endpoint-branches-2d.
 */
export function seededEndpointBranches2D(config) {
  const record = passiveRecord(config, KEYS), seed = integral(number(value(record, "seed")), 0, 0xffffffff), root_ = root(value(record, "root")), rules_ = rules(value(record, "rules")), maximum = integral(number(value(record, "maxSegments")), 1, MAX_SEGMENTS);
  const rootDx = zero(Math.cos(root_.heading) * root_.length); if (!finite(rootDx)) arithmetic(-1, -1, "delta_x");
  const rootDy = zero(Math.sin(root_.heading) * root_.length); if (!finite(rootDy)) arithmetic(-1, -1, "delta_y");
  const rootEndX = zero(root_.x + rootDx); if (!finite(rootEndX)) arithmetic(-1, -1, "position_x");
  const rootEndY = zero(root_.y + rootDy); if (!finite(rootEndY)) arithmetic(-1, -1, "position_y");
  const storage = new Storage(maximum); storage.append(root_.x, root_.y, rootEndX, rootEndY, root_.heading, root_.length, -1, 0);
  if (rules_.length === 0) return new Result(storage.finish());
  const stream = new Stream(seed);
  for (let parentIndex = 0; parentIndex < storage.size; parentIndex += 1) {
    const generation = storage.generations[parentIndex]; if (generation >= rules_.length) continue;
    const rule = rules_[generation], scale = interpolate(rule.scaleLow, rule.scaleHigh, stream.unit());
    for (let slotIndex = 0; slotIndex < rule.slots.length; slotIndex += 1) { const slot = rule.slots[slotIndex]; if (!(stream.unit() < slot.probability)) continue; if (storage.size >= maximum) limit(parentIndex, slotIndex); const turn = interpolate(slot.low, slot.high, stream.unit()); const childLength = zero(storage.lengths[parentIndex] * scale); if (!finite(childLength)) arithmetic(parentIndex, slotIndex, "length"); const childHeading = zero(storage.headings[parentIndex] + turn); if (!finite(childHeading)) arithmetic(parentIndex, slotIndex, "heading"); const childDx = zero(Math.cos(childHeading) * childLength); if (!finite(childDx)) arithmetic(parentIndex, slotIndex, "delta_x"); const childDy = zero(Math.sin(childHeading) * childLength); if (!finite(childDy)) arithmetic(parentIndex, slotIndex, "delta_y"); const childEndX = zero(storage.endX[parentIndex] + childDx); if (!finite(childEndX)) arithmetic(parentIndex, slotIndex, "position_x"); const childEndY = zero(storage.endY[parentIndex] + childDy); if (!finite(childEndY)) arithmetic(parentIndex, slotIndex, "position_y"); storage.append(storage.endX[parentIndex], storage.endY[parentIndex], childEndX, childEndY, childHeading, childLength, parentIndex, generation + 1); storage.childCounts[parentIndex] += 1; }
  }
  return new Result(storage.finish());
}
