/**
 * An evolving control sequence: the input of Sand Deposition (a recorded-channels value like
 * `Recording`, with control points instead of one hand).
 *
 * Input contract (host-owned). A `ControlSequence` is a RESOLVED, immutable, deeply frozen value: the
 * positions of `n` control points of a spline at each of `k` keyframes with explicit, strictly
 * increasing timestamps in MILLISECONDS. The library never captures, fetches or decodes anything;
 * a host (or the bundled generators in `control-sequence-samples.ts`) hands over
 * `ControlSequenceData` and `createControlSequence` validates it. Instruments persist only a
 * bundled sequence's id; binding a user's own sequence to a saved instrument is future host work.
 *
 * Meaning. Control point `i` follows the piecewise-cubic Hermite interpolation of its keyframe
 * positions (`recording.ts`, exact at every keyframe, zero slope at an exact rest, independent of
 * how often the keyframes are spaced). The spline through the points at one moment is a uniform
 * Catmull-Rom curve (`spline-family.ts`): OPEN sequences pass through every control and continue
 * straight past the ends, CLOSED ones wrap around (the last control is followed by the first).
 * Every control keeps its index for the whole sequence: control points never appear, vanish or
 * swap. Raw values are never changed; motion scaling, framing and sampling are derived values.
 *
 * Units and limits. Time in ms from the first keyframe's own timestamp (the sequence starts at 0
 * whatever the first timestamp is), coordinates in canvas units within +-1e6, 2 to 4,000 keyframes,
 * 2 (open) or 3 (closed) to 64 control points, at most ten minutes. Each failure names the keyframe
 * and control. `sequenceFingerprint` (64-bit content hash) keys every cache.
 */

export const SEQUENCE_LIMITS = Object.freeze({
  minKeyframes: 2, maxKeyframes: 4_000, minControls: 2, minClosedControls: 3, maxControls: 64, maxDuration: 600_000, maxCoordinate: 1e6,
});

/** JSON-compatible sequence: `controls[k][i]` is control point `i` at keyframe `k`. */
export interface ControlSequenceData {
  id: string;
  closed: boolean;
  /** Milliseconds, strictly increasing. */
  t: readonly number[];
  controls: readonly (readonly (readonly [number, number])[])[];
}
export interface ControlSequence {
  readonly id: string;
  readonly closed: boolean;
  readonly t: readonly number[];
  readonly controls: readonly (readonly (readonly [number, number])[])[];
  /** Control points per keyframe. */
  readonly count: number;
  /** Milliseconds from the first to the last keyframe. */
  readonly duration: number;
}

const DATA_KEYS = ["id", "closed", "t", "controls"] as const;

function list(id: string, name: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Control sequence "${id}": ${name} must be an array`);
  return value;
}

/** Validate, copy and freeze a control sequence. Failures name the keyframe and control. */
export function createControlSequence(data: ControlSequenceData): ControlSequence {
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("Control sequence must be an object");
  for (const key of Reflect.ownKeys(data))
    if (typeof key !== "string" || !(DATA_KEYS as readonly string[]).includes(key)) throw new Error(`Control sequence has an unknown field: ${String(key)}`);
  for (const key of DATA_KEYS)
    if (!Object.hasOwn(data, key) || (data as unknown as Record<string, unknown>)[key] === undefined) throw new Error(`Control sequence is missing ${key}`);
  const { id, closed } = data;
  if (typeof id !== "string" || id.length === 0 || id.length > 120) throw new Error("Control sequence id must be a nonempty string of at most 120 characters");
  if (typeof closed !== "boolean") throw new Error(`Control sequence "${id}": closed must be true or false`);
  const L = SEQUENCE_LIMITS;
  const times = list(id, "t", data.t);
  if (times.length < L.minKeyframes || times.length > L.maxKeyframes)
    throw new Error(`Control sequence "${id}" has ${times.length} keyframes; it needs ${L.minKeyframes} to ${L.maxKeyframes}`);
  const t = times.map((value, k) => {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e15) throw new Error(`Control sequence "${id}": t[${k}] must be a finite number`);
    return value;
  });
  for (let k = 1; k < t.length; k++)
    if (!(t[k] > t[k - 1])) throw new Error(`Control sequence "${id}": timestamps must strictly increase (t[${k}] = ${t[k]} does not exceed t[${k - 1}] = ${t[k - 1]})`);
  const duration = t[t.length - 1] - t[0];
  if (duration > L.maxDuration) throw new Error(`Control sequence "${id}" lasts ${duration} ms; the limit is ${L.maxDuration} ms`);
  const frames = list(id, "controls", data.controls);
  if (frames.length !== t.length) throw new Error(`Control sequence "${id}": controls has ${frames.length} keyframes but t has ${t.length}`);
  const count = list(id, "controls[0]", frames[0]).length;
  const least = closed ? L.minClosedControls : L.minControls;
  if (count < least || count > L.maxControls)
    throw new Error(`Control sequence "${id}" has ${count} control points; a ${closed ? "closed" : "open"} sequence needs ${least} to ${L.maxControls}`);
  const controls = frames.map((frame, k) => {
    const row = list(id, `controls[${k}]`, frame);
    if (row.length !== count) throw new Error(`Control sequence "${id}": keyframe ${k} has ${row.length} control points but keyframe 0 has ${count}`);
    return Object.freeze(row.map((point, i) => {
      if (!Array.isArray(point) || point.length !== 2) throw new Error(`Control sequence "${id}": controls[${k}][${i}] must be [x, y]`);
      for (const value of point)
        if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > L.maxCoordinate)
          throw new Error(`Control sequence "${id}": controls[${k}][${i}] must be two finite numbers within +-${L.maxCoordinate}`);
      return Object.freeze([point[0], point[1]] as const);
    }));
  });
  return Object.freeze({ id, closed, t: Object.freeze(t), controls: Object.freeze(controls), count, duration });
}

/** The sequence as plain JSON-compatible data (a copy). */
export function controlSequenceData(sequence: ControlSequence): ControlSequenceData {
  return { id: sequence.id, closed: sequence.closed, t: [...sequence.t], controls: sequence.controls.map((row) => row.map(([x, y]) => [x, y] as const)) };
}

const fingerprints = new WeakMap<ControlSequence, string>();
/** Content hash of every keyframe (64 bits, hex); cache keys use it, never the id alone. */
export function sequenceFingerprint(sequence: ControlSequence): string {
  const hit = fingerprints.get(sequence);
  if (hit) return hit;
  const buffer = new DataView(new ArrayBuffer(8));
  let a = 0x811c9dc5, b = 0x9747b28c;
  const mix = (v: number) => {
    buffer.setFloat64(0, v);
    for (let k = 0; k < 8; k += 4) {
      const w = buffer.getUint32(k);
      a = Math.imul(a ^ w, 0x01000193) >>> 0; a ^= a >>> 15;
      b = Math.imul(b ^ w, 0x85ebca6b) >>> 0; b ^= b >>> 13;
    }
  };
  mix(sequence.closed ? 1 : 0); mix(sequence.count); mix(sequence.t.length);
  for (const v of sequence.t) mix(v);
  for (const row of sequence.controls) for (const [x, y] of row) { mix(x); mix(y); }
  const value = `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
  fingerprints.set(sequence, value);
  return value;
}
