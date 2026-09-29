/**
 * Value plumbing for stepped simulations (see `snapshots.ts`): seeded streams, deep copy, size count,
 * frozen copies, deep equality and canonical construction keys. Nothing here knows about simulations;
 * every function is pure and deterministic.
 */

export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array
  | Float32Array | Float64Array;

/** Deep read-only view. Typed arrays cannot be frozen by the language; they are typed read-only instead. */
export type Frozen<T> = T extends TypedArray ? Readonly<T>
  : T extends readonly (infer U)[] ? readonly Frozen<U>[]
  : T extends object ? { readonly [K in keyof T]: Frozen<T[K]> }
  : T;

const isTypedArray = (value: unknown): value is TypedArray =>
  ArrayBuffer.isView(value) && !(value instanceof DataView) && !(value instanceof BigInt64Array) && !(value instanceof BigUint64Array);

const isPlain = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/* ------------------------------------------------------------------------------- seeded stream */

/**
 * Small deterministic generator (sfc32 seeded through a splitmix32 expansion). One stream per
 * (seed, step, element, purpose): draws made for one element never move another element's draws.
 */
export class SeededStream {
  private a: number; private b: number; private c: number; private d = 1;
  constructor(seed: number) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Stream seed must be a uint32 integer");
    let s = seed >>> 0;
    const mix = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = mix(); this.b = mix(); this.c = mix();
    for (let i = 0; i < 12; i++) this.uint32();
  }
  /** Next uniform integer in [0, 2^32). */
  uint32(): number {
    const t = ((this.a + this.b | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = ((this.c << 21) | (this.c >>> 11));
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }
  /** Uniform in [0, 1) with 53 random bits (two draws). */
  next(): number {
    return ((this.uint32() >>> 5) * 67108864 + (this.uint32() >>> 6)) / 9007199254740992;
  }
  /** Uniform integer in [0, n) for integer 1 ≤ n ≤ 2^32 (one `next()` draw). */
  int(n: number): number {
    if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new Error("Stream int(n) needs an integer 1 ≤ n ≤ 2^32");
    return Math.floor(this.next() * n);
  }
  /** Standard normal, Box–Muller, always exactly two `next()` draws. */
  normal(): number {
    const u = 1 - this.next(), v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

/* ------------------------------------------------------------------------------- deep copy / size */

const MAX_DEPTH = 64;

/**
 * Copy of plain simulation state: primitives, arrays, plain objects, typed arrays, `Map`, `Set`, and any
 * object with a `clone()` method (which is called). Cycles, class instances without `clone()`, functions
 * and symbols are rejected with the path, because a checkpoint that silently shares structure with the
 * live state would corrupt every later replay.
 */
export function cloneState<T>(value: T, path = "state"): T {
  return cloneAt(value, path, 0) as T;
}
function cloneAt(value: unknown, path: string, depth: number): unknown {
  if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean" || value === undefined) return value;
  if (typeof value !== "object") throw new Error(`Simulation state at ${path} is a ${typeof value}; state must be plain data`);
  if (depth > MAX_DEPTH) throw new Error(`Simulation state at ${path} nests deeper than ${MAX_DEPTH} levels (or contains a cycle)`);
  if (isTypedArray(value)) return value.slice();
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = cloneAt(value[i], `${path}[${i}]`, depth + 1);
    return out;
  }
  if (value instanceof Map) {
    const out = new Map();
    for (const [key, item] of value) out.set(cloneAt(key, `${path}.<key>`, depth + 1), cloneAt(item, `${path}.get(${String(key)})`, depth + 1));
    return out;
  }
  if (value instanceof Set) {
    const out = new Set();
    for (const item of value) out.add(cloneAt(item, `${path}.<item>`, depth + 1));
    return out;
  }
  const cloneable = value as { clone?: unknown };
  if (typeof cloneable.clone === "function") return (cloneable.clone as () => unknown).call(value);
  if (!isPlain(value)) throw new Error(`Simulation state at ${path} is a ${(value as object).constructor?.name ?? "non-plain object"}; give it a clone() method or use plain data`);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = cloneAt((value as Record<string, unknown>)[key], `${path}.${key}`, depth + 1);
  return out;
}

/** Number of stored leaf values (numbers, strings, …); typed arrays count their length. Deterministic. */
export function countValues(value: unknown, depth = 0): number {
  if (value === null || typeof value !== "object") return 1;
  if (depth > MAX_DEPTH) throw new Error("Value nests too deeply to count");
  if (isTypedArray(value)) return value.length;
  if (Array.isArray(value)) { let n = 0; for (const item of value) n += countValues(item, depth + 1); return n; }
  if (value instanceof Map) { let n = 0; for (const [key, item] of value) n += countValues(key, depth + 1) + countValues(item, depth + 1); return n; }
  if (value instanceof Set) { let n = 0; for (const item of value) n += countValues(item, depth + 1); return n; }
  const counted = value as { valueCount?: unknown };
  if (typeof counted.valueCount === "function") return Math.max(1, Number((counted.valueCount as () => number).call(value)));
  let n = 0;
  for (const key of Object.keys(value)) n += countValues((value as Record<string, unknown>)[key], depth + 1);
  return n;
}

/**
 * Deep copy that is frozen: plain arrays and objects become frozen; typed arrays are copied (a private
 * buffer no caller holds) but cannot be frozen. Only JSON-like data and typed arrays are accepted; the
 * error names the path, so a projection returning a `Map` or a class instance fails where it happens.
 */
export function freezeCopy<T>(value: T, path = "value"): Frozen<T> {
  return freezeAt(value, path, 0) as Frozen<T>;
}
function freezeAt(value: unknown, path: string, depth: number): unknown {
  if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean" || value === undefined) return value;
  if (typeof value !== "object") throw new Error(`Projection at ${path} is a ${typeof value}; projections must be plain data`);
  if (depth > MAX_DEPTH) throw new Error(`Projection at ${path} nests deeper than ${MAX_DEPTH} levels (or contains a cycle)`);
  if (isTypedArray(value)) return value.slice();
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = freezeAt(value[i], `${path}[${i}]`, depth + 1);
    return Object.freeze(out);
  }
  if (!isPlain(value)) throw new Error(`Projection at ${path} is a ${(value as object).constructor?.name ?? "non-plain object"}; return plain arrays, objects and typed arrays`);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = freezeAt((value as Record<string, unknown>)[key], `${path}.${key}`, depth + 1);
  return Object.freeze(out);
}

/** Bit-exact structural equality: `Object.is` on numbers (NaN equals NaN, 0 differs from -0), key order ignored. */
export function identical(a: unknown, b: unknown, depth = 0): boolean {
  if (typeof a === "number" || typeof b === "number") return Object.is(a, b);
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
  if (depth > MAX_DEPTH) throw new Error("Value nests too deeply to compare");
  if (isTypedArray(a) || isTypedArray(b)) {
    if (!isTypedArray(a) || !isTypedArray(b) || a.constructor !== b.constructor || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!identical(a[i], b[i], depth + 1)) return false;
    return true;
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    const left = [...a], right = [...b];
    return left.every(([key, item], i) => identical(key, right[i][0], depth + 1) && identical(item, right[i][1], depth + 1));
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    const left = [...a], right = [...b];
    return left.every((item, i) => identical(item, right[i], depth + 1));
  }
  const left = Object.keys(a), right = Object.keys(b);
  if (left.length !== right.length) return false;
  for (const key of left) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!identical((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth + 1)) return false;
  }
  return true;
}

/**
 * Canonical text of JSON-like parameters: keys sorted, `-0` distinct from `0`, non-finite numbers,
 * `undefined`, functions and class instances rejected with the path. Equal keys mean equal construction.
 */
export function canonicalKey(value: unknown, path = "params"): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "number":
      if (!Number.isFinite(value)) throw new Error(`${path} must be a finite number`);
      return Object.is(value, -0) ? "-0" : String(value);
    case "string": return JSON.stringify(value);
    case "boolean": return value ? "true" : "false";
    case "object": {
      if (Array.isArray(value)) return `[${value.map((item, i) => canonicalKey(item, `${path}[${i}]`)).join(",")}]`;
      if (!isPlain(value)) throw new Error(`${path} must be plain JSON-like data`);
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalKey(record[key], `${path}.${key}`)}`).join(",")}}`;
    }
    default: throw new Error(`${path} must be JSON-like data (found ${typeof value})`);
  }
}
