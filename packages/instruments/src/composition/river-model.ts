/**
 * Pure geometry of a migrating channel (brief 44, see `docs/composition-river-ribbons.md`).
 *
 * A channel is an open polyline of `n >= 3` nodes stored as interleaved `xy` with one integer id per node.
 * Both ends are pinned. Every function here is deterministic, allocates its own results and never reads a
 * clock or a random source; `river.ts` runs them as one fixed-order simulation step.
 *
 * Units: canvas units for lengths, 1/canvas unit for curvature, radians inside, no time other than "one
 * step". Curvature is signed: positive turns toward the left normal `(-ty, tx)`.
 */
import { PointGrid } from "./spatial-index.js";

/** Most taps on each side of the curvature smoothing kernel. */
export const MAX_KERNEL_TAPS = 100;
/** A neck cutoff needs the channel between its two nodes to be at least this many times the neck width: the length of the half circle whose diameter is the neck. */
export const LOOP_FACTOR = Math.PI / 2;
/** A step that moves no node by more than this fraction of the node spacing, and cuts nothing, is a no-op: the channel has settled. */
export const SETTLE_TOLERANCE = 1e-9;

/** Cumulative arc length at every node. */
export function arcLengths(xy: ArrayLike<number>): Float64Array {
  const n = xy.length / 2, arc = new Float64Array(n);
  for (let i = 1; i < n; i++) arc[i] = arc[i - 1] + Math.hypot(xy[2 * i] - xy[2 * i - 2], xy[2 * i + 1] - xy[2 * i - 1]);
  return arc;
}

/**
 * Signed curvature at each interior node: `2 sin(phi / 2) / c`, where `phi` is the turning angle at the node
 * and `c` the mean of the two adjacent chords. This is exactly `1 / R` for nodes on a circle of radius `R`,
 * whatever the spacing. The two end nodes have no curvature and are reported as 0.
 */
export function signedCurvature(xy: ArrayLike<number>): Float64Array {
  const n = xy.length / 2, kappa = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    const ax = xy[2 * i] - xy[2 * i - 2], ay = xy[2 * i + 1] - xy[2 * i - 1];
    const bx = xy[2 * i + 2] - xy[2 * i], by = xy[2 * i + 3] - xy[2 * i + 1];
    const chord = (Math.hypot(ax, ay) + Math.hypot(bx, by)) / 2;
    if (chord > 0) kappa[i] = 2 * Math.sin(Math.atan2(ax * by - ay * bx, ax * bx + ay * by) / 2) / chord;
  }
  return kappa;
}

/** Taps on each side of the exponential kernel of length `scale` at node spacing `spacing` (its weight falls below 2% at this reach). */
export function kernelTaps(spacing: number, scale: number): number {
  return scale > 0 ? Math.ceil(4 * scale / spacing) : 0;
}

/**
 * Curvature smoothed along the channel: a weighted mean of the interior nodes' curvature, weight
 * `(1 + skew) exp(-m h / scale)` for a node `m` steps upstream, `(1 - skew) exp(-m h / scale)` downstream and
 * 1 at the node itself, over the interior nodes that exist (the weights are renormalised near the ends, so a
 * constant curvature stays exactly constant). `skew = 0` is symmetric; `skew = 1` looks only upstream, so bends
 * respond to what came before them and drift downstream. `scale = 0` returns the curvature unchanged.
 */
export function smoothCurvature(kappa: Float64Array, spacing: number, scale: number, skew: number): Float64Array {
  const n = kappa.length, taps = kernelTaps(spacing, scale);
  if (taps > MAX_KERNEL_TAPS) throw new Error(`Smoothing kernel needs ${taps} taps, above ${MAX_KERNEL_TAPS}`);
  if (taps === 0) return Float64Array.from(kappa);
  const up = new Float64Array(taps + 1), down = new Float64Array(taps + 1);
  for (let m = 1; m <= taps; m++) { const decay = Math.exp(-m * spacing / scale); up[m] = (1 + skew) * decay; down[m] = (1 - skew) * decay; }
  const out = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    let sum = kappa[i], weight = 1;
    for (let m = 1; m <= taps; m++) {
      const before = i - m, after = i + m;
      if (before >= 1) { sum += up[m] * kappa[before]; weight += up[m]; }
      if (after <= n - 2) { sum += down[m] * kappa[after]; weight += down[m]; }
    }
    out[i] = sum / weight;
  }
  return out;
}

/** Discharge relative to the inlet at fraction `f` of the channel: it grows linearly to `ratio` at the outlet. */
export const dischargeAt = (fraction: number, ratio: number): number => 1 + (ratio - 1) * fraction;

/** Channel width at each node: `width * sqrt(Q)` (hydraulic geometry with exponent 1/2), a function of the fraction along the channel only. */
export function dischargeWidths(arc: Float64Array, width: number, ratio: number): Float64Array {
  const n = arc.length, out = new Float64Array(n), total = arc[n - 1];
  for (let i = 0; i < n; i++) out[i] = width * Math.sqrt(dischargeAt(total > 0 ? arc[i] / total : 0, ratio));
  return out;
}

/** The valley: an axis through `(cx, cy)` with unit direction `(ax, ay)`; `u` runs along it, `v` across (left normal). */
export interface Valley { readonly cx: number; readonly cy: number; readonly ax: number; readonly ay: number; readonly length: number }

export const valleyOf = (cx: number, cy: number, length: number, angleDegrees: number): Valley =>
  ({ cx, cy, length, ax: Math.cos(angleDegrees * Math.PI / 180), ay: Math.sin(angleDegrees * Math.PI / 180) });
export const valleyU = (valley: Valley, x: number, y: number): number => (x - valley.cx) * valley.ax + (y - valley.cy) * valley.ay;
export const valleyV = (valley: Valley, x: number, y: number): number => -(x - valley.cx) * valley.ay + (y - valley.cy) * valley.ax;

/** The channel is anchored to the valley over this many inlet widths at each end: migration ramps in smoothly from 0 at the pinned node. */
export const ANCHOR_WIDTHS = 6;
/** Banks slow down over this many inlet widths before a valley wall, and stop at it. */
export const WALL_WIDTHS = 3;

const smoothstep = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/**
 * Bank-erosion displacement of every node for one step, read from the old positions everywhere:
 * `-mobility * erodibility * w^2 * smoothedCurvature` along the left normal, so a bend moves toward its outside
 * at a rate proportional to its smoothed curvature. The rate ramps from 0 at each pinned end to full over
 * `anchor` (a smoothstep of the arc length from the nearest end), so the pinned ends cannot spin into curls.
 * `erodibility` is a function of position.
 */
export function migrationOffsets(xy: ArrayLike<number>, arc: Float64Array, smooth: Float64Array, width: Float64Array, mobility: number, anchor: number,
  erodibility: (x: number, y: number) => number): { offsets: Float64Array; maxMove: number } {
  const n = xy.length / 2, offsets = new Float64Array(2 * n), total = arc[n - 1];
  let maxMove = 0;
  for (let i = 1; i < n - 1; i++) {
    const tx = xy[2 * i + 2] - xy[2 * i - 2], ty = xy[2 * i + 3] - xy[2 * i - 1], length = Math.hypot(tx, ty);
    if (length === 0) continue;
    const held = smoothstep(Math.min(arc[i], total - arc[i]) / anchor);
    const speed = -mobility * held * erodibility(xy[2 * i], xy[2 * i + 1]) * width[i] * width[i] * smooth[i];
    offsets[2 * i] = speed * (-ty / length); offsets[2 * i + 1] = speed * (tx / length);
    maxMove = Math.max(maxMove, Math.abs(speed));
  }
  return { offsets, maxMove };
}

/** The valley is a rectangle `length` long and `2 * half` wide; its walls are the two long sides and the two end walls, which the pinned end nodes touch at their midpoints. */
export interface Walls { readonly valley: Valley; readonly half: number }

/**
 * Valley walls act on the migration before it is applied: the part of a node's displacement that carries its
 * bank toward a wall is scaled by a smoothstep of the room left (`wall - w/2 - distance`) over `soft`, reaching 0
 * at the wall. Movement away from a wall and along it is untouched, so a bend flattens against a wall without a
 * corner. The end nodes are pinned and never move.
 */
export function easeAtWalls(offsets: Float64Array, xy: ArrayLike<number>, width: Float64Array, walls: Walls, soft: number): void {
  const { valley, half } = walls;
  for (let i = 1; i < width.length - 1; i++) {
    const axes: [number, number, number, number][] = [
      [valleyV(valley, xy[2 * i], xy[2 * i + 1]), -valley.ay, valley.ax, half],
      [valleyU(valley, xy[2 * i], xy[2 * i + 1]), valley.ax, valley.ay, valley.length / 2],
    ];
    for (const [distance, nx, ny, wall] of axes) {
      const toward = offsets[2 * i] * nx + offsets[2 * i + 1] * ny;
      if (toward * distance <= 0) continue;
      const drop = (1 - smoothstep((wall - width[i] / 2 - Math.abs(distance)) / soft)) * toward;
      offsets[2 * i] -= nx * drop; offsets[2 * i + 1] -= ny * drop;
    }
  }
}

/** Backstop for `easeAtWalls`: hold every interior node's centerline at least half a channel width inside every wall. Returns how many nodes were held. */
export function confine(xy: Float64Array, width: Float64Array, walls: Walls): number {
  const { valley, half } = walls;
  let held = 0;
  for (let i = 1; i < width.length - 1; i++) {
    let moved = false;
    for (const [axis, nx, ny, wall] of [[valleyV, -valley.ay, valley.ax, half], [valleyU, valley.ax, valley.ay, valley.length / 2]] as const) {
      const limit = wall - width[i] / 2, distance = axis(valley, xy[2 * i], xy[2 * i + 1]);
      if (Math.abs(distance) <= limit) continue;
      const shift = Math.sign(distance) * limit - distance;
      xy[2 * i] += nx * shift; xy[2 * i + 1] += ny * shift; moved = true;
    }
    if (moved) held++;
  }
  return held;
}

/**
 * A cutoff between nodes `i < j` (indices into the channel) that removes the interior `i + 1 .. j - 1`.
 * A neck cutoff joins node `i` straight to node `j`, which were `distance` apart. A crossing cutoff (`crossing` is
 * the intersection point, `distance` 0) is where segment `i` crosses segment `j - 1`: the channel passes through the
 * intersection and the loop it closes leaves.
 */
export interface Cut { readonly i: number; readonly j: number; readonly distance: number; readonly crossing?: readonly [number, number] }

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

/** Where segments `(a, a + 1)` and `(b, b + 1)` properly cross (strictly inside both), or null. */
function crossingOf(xy: Float64Array, a: number, b: number): [number, number] | null {
  const rx = xy[2 * a + 2] - xy[2 * a], ry = xy[2 * a + 3] - xy[2 * a + 1], sx = xy[2 * b + 2] - xy[2 * b], sy = xy[2 * b + 3] - xy[2 * b + 1];
  const denominator = cross(rx, ry, sx, sy);
  if (denominator === 0) return null;
  const qx = xy[2 * b] - xy[2 * a], qy = xy[2 * b + 1] - xy[2 * a + 1];
  const t = cross(qx, qy, sx, sy) / denominator, u = cross(qx, qy, rx, ry) / denominator;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [xy[2 * a] + t * rx, xy[2 * a + 1] + t * ry] : null;
}

/**
 * Cutoffs. Neck cutoffs: node pairs `i < j` closer than `cutoff * max(w_i, w_j)` whose channel between them is at
 * least `LOOP_FACTOR` times that limit. Crossing cutoffs: any two non-adjacent segments that properly cross, which
 * is what a neck the channel outran becomes. Candidates are ordered by (distance, i, j), crossings first, and
 * accepted greedily; a candidate whose closed interval `[i, j]` touches an accepted one waits for the next pass. The
 * result is ascending by `i` and independent of any traversal order. `onWork` receives the spatial index's cell
 * and point visits. The search radius covers every crossing when the spacing is at most half the smallest limit.
 */
export function findCuts(xy: Float64Array, width: Float64Array, arc: Float64Array, cutoff: number, onWork: (units: number) => void = () => {}): Cut[] {
  const n = width.length;
  let reach = 0;
  for (let i = 0; i < n; i++) reach = Math.max(reach, cutoff * width[i]);
  if (!(reach > 0)) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, xy[2 * i]); x1 = Math.max(x1, xy[2 * i]); y0 = Math.min(y0, xy[2 * i + 1]); y1 = Math.max(y1, xy[2 * i + 1]);
  }
  const grid = new PointGrid({ bounds: [x0 - reach, y0 - reach, x1 + reach, y1 + reach], cellSize: reach, onWork });
  for (let i = 0; i < n; i++) grid.insert(i, xy[2 * i], xy[2 * i + 1]);
  const candidates: Cut[] = [];
  for (let i = 0; i < n; i++) {
    for (const hit of grid.within(xy[2 * i], xy[2 * i + 1], reach, { exclude: i })) {
      const j = hit.id;
      if (j <= i) continue;
      const limit = cutoff * Math.max(width[i], width[j]);
      if (hit.distance <= limit && arc[j] - arc[i] >= LOOP_FACTOR * limit) candidates.push({ i, j, distance: hit.distance });
      for (const a of [i - 1, i]) for (const b of [j - 1, j]) {
        if (a < 0 || b + 1 >= n || b < a + 2) continue;
        const at = crossingOf(xy, a, b);
        if (at) candidates.push({ i: a, j: b + 1, distance: 0, crossing: at });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.i - b.i || a.j - b.j);
  const accepted: Cut[] = [];
  for (const candidate of candidates)
    if (!accepted.some((cut) => candidate.i <= cut.j && cut.i <= candidate.j)) accepted.push(candidate);
  return accepted.sort((a, b) => a.i - b.i);
}

/**
 * An abandoned loop. A neck loop is the open path of nodes `i..j` (both ends stay on the channel); a crossing loop is
 * the closed ring of the crossing point (the first entry, on the channel) and the removed nodes `i + 1 .. j - 1`.
 * Ids, positions (`x, y` pairs) and widths are those of the moment of the cut.
 */
export interface Loop { readonly i: number; readonly j: number; readonly distance: number; readonly closed: boolean; readonly ids: number[]; readonly xy: number[]; readonly width: number[] }

/**
 * Carry out the cuts (ascending, disjoint): remove every cut's interior; a neck joins `i` to `j`, a crossing puts a
 * new node (id `nextId`, then ascending) at the intersection. Reports each loop and the next unused id.
 */
export function applyCuts(xy: Float64Array, ids: Int32Array, width: Float64Array, cuts: readonly Cut[], nextId: number): { xy: Float64Array; ids: Int32Array; loops: Loop[]; nextId: number } {
  const n = ids.length, outXy: number[] = [], outIds: number[] = [], loops: Loop[] = [];
  const keep = (index: number) => { outXy.push(xy[2 * index], xy[2 * index + 1]); outIds.push(ids[index]); };
  let next = 0;
  for (const cut of cuts) {
    if (cut.j - cut.i < 2) throw new Error("A cutoff must take out at least one node");
    for (; next <= cut.i; next++) keep(next);
    if (cut.crossing) {
      const id = nextId++;
      outXy.push(cut.crossing[0], cut.crossing[1]); outIds.push(id);
      loops.push({ i: cut.i, j: cut.j, distance: 0, closed: true, ids: [id, ...ids.subarray(cut.i + 1, cut.j)],
        xy: [cut.crossing[0], cut.crossing[1], ...xy.subarray(2 * (cut.i + 1), 2 * cut.j)],
        width: [(width[cut.i] + width[cut.j]) / 2, ...width.subarray(cut.i + 1, cut.j)] });
    } else {
      loops.push({ i: cut.i, j: cut.j, distance: cut.distance, closed: false, ids: Array.from(ids.subarray(cut.i, cut.j + 1)),
        xy: Array.from(xy.subarray(2 * cut.i, 2 * cut.j + 2)), width: Array.from(width.subarray(cut.i, cut.j + 1)) });
    }
    next = cut.j;
  }
  for (; next < n; next++) keep(next);
  return { xy: Float64Array.from(outXy), ids: Int32Array.from(outIds), loops, nextId };
}

/**
 * Resample to equally spaced nodes along the polyline, both ends kept. The segment count is
 * `round(length / spacing)`, so the spacing is within `spacing / (2 * length)` of the request (relative) and
 * every segment is equal. Node ids are kept where the resampled node is the nearest one to an old node
 * (measured along the channel; ties go to the earlier old node); every other node is new and takes the next id,
 * ascending along the channel. Resampling an already uniform channel of the right length changes nothing.
 */
export function resample(xy: Float64Array, ids: Int32Array, nextId: number, spacing: number): { xy: Float64Array; ids: Int32Array; nextId: number } {
  const n = ids.length, arc = arcLengths(xy), total = arc[n - 1];
  if (!(total > 0)) throw new Error("Cannot resample a channel of zero length");
  const segments = Math.max(2, Math.round(total / spacing)), step = total / segments;
  const out = new Float64Array(2 * (segments + 1)), outIds = new Int32Array(segments + 1).fill(-1);
  let segment = 0;
  for (let k = 0; k <= segments; k++) {
    if (k === 0 || k === segments) {
      const from = k === 0 ? 0 : n - 1;
      out[2 * k] = xy[2 * from]; out[2 * k + 1] = xy[2 * from + 1];
      continue;
    }
    const target = k * step;
    while (segment < n - 2 && arc[segment + 1] < target) segment++;
    const span = arc[segment + 1] - arc[segment], t = span > 0 ? Math.min(1, Math.max(0, (target - arc[segment]) / span)) : 0;
    out[2 * k] = xy[2 * segment] + (xy[2 * segment + 2] - xy[2 * segment]) * t;
    out[2 * k + 1] = xy[2 * segment + 1] + (xy[2 * segment + 3] - xy[2 * segment + 1]) * t;
  }
  const claim = new Float64Array(segments + 1).fill(Infinity);
  for (let j = 0; j < n; j++) {
    const slot = Math.min(segments, Math.max(0, Math.floor(arc[j] / step + 0.5))), distance = Math.abs(arc[j] - slot * step);
    if (distance < claim[slot]) { claim[slot] = distance; outIds[slot] = ids[j]; }
  }
  for (let k = 0; k <= segments; k++) if (outIds[k] < 0) outIds[k] = nextId++;
  return { xy: out, ids: outIds, nextId };
}

/** Proper crossings among the non-adjacent segments of a polyline (brute force; for tests and audits). Returns the first pair found. */
export function firstSelfCrossing(xy: ArrayLike<number>): [number, number] | null {
  const segments = xy.length / 2 - 1;
  const side = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  for (let a = 0; a < segments; a++) for (let b = a + 2; b < segments; b++) {
    const [p, q, r, s] = [xy[2 * a], xy[2 * a + 1], xy[2 * a + 2], xy[2 * a + 3]], [t, u, v, w] = [xy[2 * b], xy[2 * b + 1], xy[2 * b + 2], xy[2 * b + 3]];
    if (side(p, q, r, s, t, u) * side(p, q, r, s, v, w) < 0 && side(t, u, v, w, p, q) * side(t, u, v, w, r, s) < 0) return [a, b];
  }
  return null;
}
