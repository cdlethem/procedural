import type { Point } from "./types.js";

/**
 * Evenly spaced streamline tracing through any direction field (Jobard and Lefer, 1997), with the
 * field consumer as a plain function so the same tracer serves image orientation fields and any other.
 *
 * `DirectionFn(x, y, hint)` returns a UNIT tangent at a point, or `null` where no line may pass (outside
 * the field, too little confidence, masked). The field may be unsigned (an orientation): the tracer
 * passes the previous travel direction as `hint`, and the function must return the sign with a
 * non-negative dot product with it (`[0, 0]` means "no preference"; return the field's default sign).
 * That is what stops a line from turning back where an unsigned angle wraps.
 *
 * Integration is classical RK4 with a fixed arc-length `step`; each stage takes the sign closest to
 * the previous stage. A stage that finds no direction reuses the previous stage's, so a line is cut
 * only where the direction is missing at the accepted point itself.
 *
 * A line grows from its seed in both directions and stops at the first of: no direction at the next
 * point, the domain boundary (the last segment is cut exactly at the boundary), `maxLength` (shared by
 * both halves), a turn tighter than `minRadius` (the turn between two successive steps exceeding
 * `step / minRadius`), or the next point coming closer than `separation * stopFraction` to any
 * other line (or to the same line after leaving its own neighbourhood, which closes loops with a gap
 * instead of overprinting). Finished lines shorter than `minLength` are removed together with the
 * space they occupied, so a rejected stub never blocks its neighbours.
 *
 * Seeds are tried in the given order. With `fill`, each accepted line then offers candidate seeds at
 * `separation` to both sides of every `stride`-th vertex (`ceil(separation / (2 * step))` vertices)
 * in acceptance order, until no valid candidate is left. A candidate is valid when it is inside the
 * domain, has a direction and lies at least `0.95 * separation` from every line. Everything is a pure
 * function of the options: no random source, no clock.
 *
 * Work is counted exactly (integration steps, including those of removed lines) and any limit that is
 * exceeded throws, naming the option to change; nothing is truncated.
 */
export type DirectionFn = (x: number, y: number, hint: readonly [number, number]) => readonly [number, number] | null;

export interface TraceSeed {
  /** Stable id of the line grown from this seed. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Grow the half against the field's default sign first (they share `maxLength`). */
  readonly reverseFirst?: boolean;
}

export interface StreamlineOptions {
  field: DirectionFn;
  /** Domain `[left, top, right, bottom]`; lines never leave it. */
  bounds: readonly [number, number, number, number];
  seeds: readonly TraceSeed[];
  /** Region in which a line may START (a supplied seed or a fill candidate); defaults to `bounds`. */
  startBounds?: readonly [number, number, number, number];
  /** Target distance between neighbouring lines (> 0). */
  separation: number;
  /** Lines stop at `separation * stopFraction` from another line, in (0, 1]. */
  stopFraction: number;
  /** Integration step in arc length, at most `separation * stopFraction` (> 0). */
  step: number;
  /** Shortest line kept (>= 0). */
  minLength: number;
  /** Longest line (> 0), both halves together. */
  maxLength: number;
  /** Tightest allowed turning radius; 0 switches the limit off. */
  minRadius: number;
  fill: boolean;
  maxLines: number;
  maxVertices: number;
  maxSteps: number;
  cancelled?: () => boolean;
}

export interface Streamline {
  readonly id: string;
  /** Vertices `step` apart, except the last of a clipped end; ordered so that the seed's forward half comes last. */
  readonly points: readonly Point[];
  readonly length: number;
  /** The seed the line grew from. */
  readonly seed: Point;
  /** The line whose vertex offered this seed, or null for a supplied seed. */
  readonly parent: string | null;
}

export interface StreamlineResult {
  readonly lines: readonly Streamline[];
  /** Integration steps taken, including those of lines that were removed. */
  readonly steps: number;
  /** Lines removed for being shorter than `minLength`. */
  readonly removed: number;
}

/** Fraction of `separation` a candidate seed must keep from existing lines. */
export const SEED_CLEARANCE = 0.95;
const CANCEL_POLL = 256;
const MAX_CELLS = 4_000_000;

function positive(name: string, value: number, allowZero = false): void {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) throw new Error(`traceStreamlines: ${name} must be a finite number ${allowZero ? ">= 0" : "> 0"}`);
}

export function traceStreamlines(options: StreamlineOptions): StreamlineResult {
  const { field, bounds, startBounds = options.bounds, seeds, separation, stopFraction, step, minLength, maxLength, minRadius, fill, maxLines, maxVertices, maxSteps, cancelled } = options;
  positive("separation", separation); positive("step", step); positive("maxLength", maxLength);
  positive("minLength", minLength, true); positive("minRadius", minRadius, true);
  if (!(stopFraction > 0 && stopFraction <= 1)) throw new Error("traceStreamlines: stopFraction must be in (0, 1]");
  if (step > separation * stopFraction) throw new Error("traceStreamlines: step must not exceed separation * stopFraction");
  const [left, top, right, bottom] = bounds;
  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) throw new Error("traceStreamlines: bounds must be a finite rectangle with positive size");

  const dtest = separation * stopFraction, dseed = separation * SEED_CLEARANCE, recent = Math.ceil(2 * separation / step) + 2;
  const nx = Math.floor((right - left) / separation) + 1, ny = Math.floor((bottom - top) / separation) + 1;
  if (nx * ny > MAX_CELLS) throw new Error(`traceStreamlines: the domain needs ${nx * ny} separation cells; the limit is ${MAX_CELLS}: raise separation or shrink the image`);
  const head = new Int32Array(nx * ny).fill(-1);
  const px: number[] = [], py: number[] = [], next: number[] = [], cellOf: number[] = [], lineOf: number[] = [], halfOf: number[] = [], seqOf: number[] = [];
  const cellX = (x: number): number => Math.min(nx - 1, Math.max(0, Math.floor((x - left) / separation)));
  const cellY = (y: number): number => Math.min(ny - 1, Math.max(0, Math.floor((y - top) / separation)));
  let steps = 0, removed = 0, currentLine = -1;

  const register = (x: number, y: number, half: number, seq: number): void => {
    if (px.length >= maxVertices) throw new Error(`Streamlines would need more than ${maxVertices} vertices: raise separation or start spacing, lower max length, or narrow the image`);
    const cell = cellY(y) * nx + cellX(x), index = px.length;
    px.push(x); py.push(y); next.push(head[cell]); cellOf.push(cell); lineOf.push(currentLine); halfOf.push(half); seqOf.push(seq);
    head[cell] = index;
  };
  /** Any registered vertex closer than `radius`, ignoring the current line's own neighbourhood (arc distance <= recent steps). */
  const crowded = (x: number, y: number, radius: number, half: number, seq: number): boolean => {
    const r2 = radius * radius, cx = cellX(x), cy = cellY(y);
    for (let j = Math.max(0, cy - 1); j <= Math.min(ny - 1, cy + 1); j++)
      for (let i = Math.max(0, cx - 1); i <= Math.min(nx - 1, cx + 1); i++)
        for (let p = head[j * nx + i]; p >= 0; p = next[p]) {
          const dx = px[p] - x, dy = py[p] - y;
          if (dx * dx + dy * dy >= r2) continue;
          if (lineOf[p] === currentLine && half >= 0) {
            const along = halfOf[p] === half ? Math.abs(seq - seqOf[p]) : seq + seqOf[p];
            if (along <= recent) continue;
          }
          return true;
        }
    return false;
  };
  const inside = (x: number, y: number): boolean => x >= left && x <= right && y >= top && y <= bottom;
  const mayStart = (x: number, y: number): boolean => x >= startBounds[0] && x <= startBounds[2] && y >= startBounds[1] && y <= startBounds[3];

  const stage = (x: number, y: number, hint: readonly [number, number], fallback: readonly [number, number]): readonly [number, number] => field(x, y, hint) ?? fallback;

  /** Grow one half; returns its vertices after the seed and its length. */
  const grow = (sx: number, sy: number, hx: number, hy: number, half: number, limit: number): { points: Point[]; length: number } => {
    const points: Point[] = [];
    let x = sx, y = sy, dx = hx, dy = hy, length = 0, seq = 0;
    const h = step;
    while (length + h <= limit + 1e-9) {
      if (steps >= maxSteps) throw new Error(`Streamline tracing needs more than ${maxSteps} integration steps: raise separation or start spacing, or lower max length`);
      if ((steps & (CANCEL_POLL - 1)) === 0 && cancelled?.()) throw new Error("Composition cancelled");
      const k1 = field(x, y, [dx, dy]);
      if (!k1) break;
      const k2 = stage(x + 0.5 * h * k1[0], y + 0.5 * h * k1[1], k1, k1);
      const k3 = stage(x + 0.5 * h * k2[0], y + 0.5 * h * k2[1], k2, k2);
      const k4 = stage(x + h * k3[0], y + h * k3[1], k3, k3);
      let ex = k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0], ey = k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1];
      const norm = Math.hypot(ex, ey);
      if (!(norm > 1e-12)) break;
      ex /= norm; ey /= norm;
      if (minRadius > 0 && seq > 0 && Math.acos(Math.min(1, Math.max(-1, ex * dx + ey * dy))) * minRadius > h) break;
      steps++;
      let qx = x + h * ex, qy = y + h * ey, last = false;
      if (!inside(qx, qy)) {
        // Cut the segment where it leaves the domain.
        let t = 1;
        if (qx < left) t = Math.min(t, (left - x) / (qx - x)); else if (qx > right) t = Math.min(t, (right - x) / (qx - x));
        if (qy < top) t = Math.min(t, (top - y) / (qy - y)); else if (qy > bottom) t = Math.min(t, (bottom - y) / (qy - y));
        if (!(t > 1e-6)) break;
        qx = Math.min(right, Math.max(left, x + t * (qx - x))); qy = Math.min(bottom, Math.max(top, y + t * (qy - y)));
        last = true;
      }
      if (crowded(qx, qy, dtest, half, seq + 1)) break;
      seq++;
      length += Math.hypot(qx - x, qy - y);
      register(qx, qy, half, seq);
      points.push([qx, qy]);
      x = qx; y = qy; dx = ex; dy = ey;
      if (last) break;
    }
    return { points, length };
  };

  const lines: Streamline[] = [];
  const tryLine = (seed: TraceSeed, parent: string | null): boolean => {
    if (!inside(seed.x, seed.y) || !mayStart(seed.x, seed.y)) return false;
    const d0 = field(seed.x, seed.y, [0, 0]);
    if (!d0) return false;
    if (crowded(seed.x, seed.y, dseed, -1, 0)) return false;
    if (lines.length >= maxLines) throw new Error(`Streamlines would exceed ${maxLines} lines: raise separation or start spacing`);
    currentLine = lines.length;
    const first = px.length;
    register(seed.x, seed.y, 0, 0);
    const forwardFirst = !seed.reverseFirst;
    const a = forwardFirst ? d0 : [-d0[0], -d0[1]] as const, b = [-a[0], -a[1]] as const;
    const one = grow(seed.x, seed.y, a[0], a[1], 0, maxLength);
    const two = grow(seed.x, seed.y, b[0], b[1], 1, maxLength - one.length);
    const length = one.length + two.length;
    if (length < minLength || length <= 0) {
      for (let p = px.length - 1; p >= first; p--) head[cellOf[p]] = next[p];
      px.length = py.length = next.length = cellOf.length = lineOf.length = halfOf.length = seqOf.length = first;
      removed++;
      return false;
    }
    const points: Point[] = [...two.points.reverse(), [seed.x, seed.y] as Point, ...one.points];
    lines.push(Object.freeze({ id: seed.id, points: Object.freeze(points.map((p) => Object.freeze(p) as Point)), length, seed: Object.freeze([seed.x, seed.y]) as Point, parent }));
    return true;
  };

  for (const seed of seeds) tryLine(seed, null);
  if (fill) {
    const stride = Math.max(1, Math.ceil(separation / (2 * step)));
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li], pts = line.points;
      for (let k = 0; k < pts.length; k += stride) {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], norm = Math.hypot(tx, ty);
        if (!(norm > 0)) continue;
        for (const side of [1, -1]) {
          const x = pts[k][0] - side * ty / norm * separation, y = pts[k][1] + side * tx / norm * separation;
          tryLine({ id: `${line.id}/${k}${side > 0 ? "L" : "R"}`, x, y }, line.id);
        }
      }
    }
  }
  return Object.freeze({ lines: Object.freeze(lines), steps, removed });
}
