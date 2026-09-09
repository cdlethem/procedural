const MAX_LEAF_ID = 9007199254740990;
const EXHAUSTED_NEXT_ID = 9007199254740991;

/** Validation/access error with a stable catalog code. */
export class RectangleCutError extends Error {
  constructor(code) {
    super(code);
    this.name = "RectangleCutError";
    this.code = code;
  }
}

function invalidInput() { throw new RectangleCutError("INVALID_INPUT"); }
function unknownId() { throw new RectangleCutError("UNKNOWN_ID"); }
function invalidCut() { throw new RectangleCutError("INVALID_CUT"); }
function limitExceeded() { throw new RectangleCutError("LIMIT_EXCEEDED"); }

function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function zero(value) { return value === 0 ? 0 : value; }

function coordinate(value) {
  if (typeof value !== "number") invalidInput();
  if (!finite(value)) invalidInput();
  return zero(value);
}

function checkedId(id) {
  if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > MAX_LEAF_ID) {
    throw new RectangleCutError("INVALID_ID");
  }
  return id;
}

function leafValue(id, left, top, right, bottom) {
  return Object.freeze({ id, bounds: Object.freeze([left, top, right, bottom]) });
}

/**
 * Caller-directed retained rectangular regions with stable never-reused identities.
 * Implements layout.retained-rectangle-cuts-2d 0.1.0.
 *
 * Independently specified from survey/out/2019/generativos/griton/notes.md. The
 * motivating work supplies retained unequal regions; its source-specific selection,
 * ratios, omission, drawing, and random behavior are outside this operation.
 */
export class RetainedRectangleCuts2D {
  #leaves = new Map();
  #nextId = 1;

  constructor(left, top, right, bottom) {
    this.#leaves.set(0, leafValue(0, left, top, right, bottom));
    Object.seal(this);
  }

  /** Replaces a live leaf with low-coordinate then high-coordinate children; returns their IDs. */
  cut(id, axis, coord) {
    checkedId(id);
    const parent = this.#leaves.get(id);
    if (parent === undefined) unknownId();
    if (axis !== "X" && axis !== "Y") invalidInput();
    if (typeof coord !== "number" || !finite(coord)) invalidInput();
    const c = zero(coord);
    const cutX = axis === "X";
    const [pl, pt, pr, pb] = parent.bounds;
    const low = cutX ? pl : pt;
    const high = cutX ? pr : pb;
    if (!(c > low && c < high)) invalidCut();
    if (this.#leaves.size >= 2147483647 || this.#nextId > EXHAUSTED_NEXT_ID - 2) limitExceeded();

    const lowId = this.#nextId, highId = this.#nextId + 1;
    const lowLeaf = cutX ? leafValue(lowId, pl, pt, c, pb) : leafValue(lowId, pl, pt, pr, c);
    const highLeaf = cutX ? leafValue(highId, c, pt, pr, pb) : leafValue(highId, pl, c, pr, pb);
    this.#leaves.delete(id);
    this.#leaves.set(lowId, lowLeaf);
    this.#leaves.set(highId, highLeaf);
    this.#nextId += 2;
    return [lowId, highId];
  }

  /** Removes a live leaf without replacing it or changing later identity allocation. */
  remove(id) {
    checkedId(id);
    if (!this.#leaves.delete(id)) unknownId();
  }

  /** Returns the immutable value for a live leaf. */
  leaf(id) {
    checkedId(id);
    const leaf = this.#leaves.get(id);
    if (leaf === undefined) unknownId();
    return leaf;
  }

  /** Returns a detached array in current live-leaf order. */
  leaves() { return Array.from(this.#leaves.values()); }

  /** Returns the current live-leaf count. */
  get size() { return this.#leaves.size; }

  /**
   * Materializes a fully detached mutable {nextId,leaves:[{id,bounds}]} snapshot.
   * This snapshot is descriptive only and is not a restoration or replay input.
   */
  toValues() {
    const leaves = [];
    for (const leaf of this.#leaves.values()) leaves.push({ id: leaf.id, bounds: leaf.bounds.slice() });
    return { nextId: this.#nextId, leaves };
  }
}

/** Creates a root from exactly {bounds:[left,top,right,bottom]}. */
export function retainedRectangleCuts2D(config) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) invalidInput();
  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null) invalidInput();
  if (Reflect.ownKeys(config).length !== 1 || !Object.prototype.hasOwnProperty.call(config, "bounds")) invalidInput();
  const rawBounds = config.bounds;
  if (!Array.isArray(rawBounds) || Object.getPrototypeOf(rawBounds) !== Array.prototype || rawBounds.length !== 4) {
    invalidInput();
  }
  const left = coordinate(rawBounds[0]);
  const top = coordinate(rawBounds[1]);
  const right = coordinate(rawBounds[2]);
  const bottom = coordinate(rawBounds[3]);
  return createValidated(left, top, right, bottom);
}

function createValidated(left, top, right, bottom) {
  if (!(left < right) || !(top < bottom)) invalidInput();
  const width = right - left, height = bottom - top;
  if (!finite(width) || !finite(height)) invalidInput();
  return new RetainedRectangleCuts2D(left, top, right, bottom);
}
