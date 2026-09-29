import { convexHull2D, parallelTransportRibbon3D } from "@procedurals/javascript";
import type { QuillStrip, QuillStrips } from "./quill-strips.js";
import type { Ring } from "./support.js";
import type { Point } from "./types.js";

/**
 * Wall geometry and the tilt camera.
 *
 * GEOMETRY. `quillGeometry(strips, options)` stands every strip on its centerline as a thin box
 * `thickness` wide (the strips' own option) and `height` tall on the ground plane z = 0
 * (x, y canvas plan units, y down; z up in the same units). Per segment it emits a cap at the top
 * and the two side walls; an open strip adds an end face at each end. The bottom is never
 * visible and is not built. The side walls are `parallelTransportRibbon3D` ribbons along the two
 * offset polylines with the ribbon normal fixed to +z, so a wall cannot twist or flip at a bend.
 * Offsets use the miter of the two adjacent segments, with the half thickness reduced (a
 * PINCH, counted in `pinchedVertices`) where a bend is tighter than the paper: the slides of the
 * inner offsets along a segment never exceed 90% of its length and the miter never exceeds three
 * half thicknesses. Every quad therefore keeps its orientation and no wall is inverted.
 *
 * HEIGHT. `height * (1 - heightVariation * u) * (1 + nestHeight)^|ring|`, at least
 * `MIN_WALL`, where `u` is the strip's stable per-scaffold-path value. Appearance and camera
 * never enter; only height and its two modifiers rebuild the geometry.
 *
 * FACES. Struct-of-arrays, frozen: `corners` holds 12 numbers per face (four x, y, z corners),
 * `normals` the outward unit normal, `kind` one of `CAP`, `WALL_LEFT`, `WALL_RIGHT`, `END_START`,
 * `END_END`. Left is the algebraic side of `(-dy, dx)` for travel `(dx, dy)`, which is
 * clockwise-of-heading on a y-down canvas.
 *
 * CAMERA AND PAINTER'S ORDER. An orthographic camera rotates the plan by `yaw` (degrees, about
 * `pivot`), tilts by `pitch` (0 looks straight down; the view stays above the ground) and scales by
 * `zoom`. A plan point maps to `anchor + zoom * (u, v cos(pitch) - z sin(pitch))`, with `(u, v)` the
 * rotated plan offset. A face is visible when its normal points toward the camera,
 * `n_v sin(pitch) + n_z cos(pitch) > 0`; the others are dropped (a thin box's hidden faces are
 * the opposite sides of visible ones). Visible faces are painted in ASCENDING PLAN DEPTH: the
 * rotated `v` of the face's plan centroid, ties broken walls first, then by face index. For
 * vertical walls over one ground plane this is the correct visibility order (a ray toward the camera
 * moves toward larger `v`), so heights never enter the order; it is exact wherever strips are
 * apart, and approximate only within one segment (at most `resolution` long). Overlapping strips
 * never reach this stage (see `quillStrips`: trimmed or rejected).
 *
 * FOOTPRINT. `projection.footprint` is the extent of everything painted: `bounds`, the convex
 * `hull` of the painted corners, and each strip's ground outline (rings of its left and right
 * offsets at z = 0) projected with the same camera. In plan (`pitch` 0, `yaw` 0) the outlines are
 * the strips' true plan shapes.
 *
 * WORK BOUNDS. `MAX_QUILL_FACES` faces; exceeded means the strips are too long or too many
 * for the wall height's path resolution. Throws naming Path resolution and the nest rings.
 */
export const MAX_QUILL_FACES = 220_000;
/** Shortest wall, in canvas units. */
export const MIN_WALL = 0.5;
const MITER_THICKNESS = 3;
const PINCH_SLIDE = 0.9;

export const CAP = 0, WALL_LEFT = 1, WALL_RIGHT = 2, END_START = 3, END_END = 4;
export type QuillFaceKind = 0 | 1 | 2 | 3 | 4;

export interface QuillGeometryOptions {
  height: number;
  /** 0..1: stable per-scaffold-path shortening. */
  heightVariation: number;
  /** Height change per nest ring, as a fraction: rings are `(1 + nestHeight)^|ring|` as tall. */
  nestHeight: number;
}
export interface QuillGeometry {
  readonly strips: QuillStrips;
  readonly options: Readonly<QuillGeometryOptions>;
  readonly faceCount: number;
  readonly corners: readonly number[];
  readonly normals: readonly number[];
  readonly kind: readonly QuillFaceKind[];
  /** Index into `strips.strips`. */
  readonly strip: readonly number[];
  readonly segment: readonly number[];
  /** Absolute wall height per strip. */
  readonly heights: readonly number[];
  readonly heightRange: readonly [number, number];
  /** Per strip height relative to the requested height (see `stripHeightFactor`); scaling the height leaves it unchanged. */
  readonly factors: readonly number[];
  /** Ground outline rings per strip (plan coordinates). */
  readonly outlines: readonly (readonly Ring[])[];
  readonly pinchedVertices: number;
}

/** A strip's height relative to `options.height`, before the minimum wall: independent of the absolute height. */
export function stripHeightFactor(strip: Pick<QuillStrip, "ring" | "heightUnit">, o: Pick<QuillGeometryOptions, "heightVariation" | "nestHeight">): number {
  return (1 - o.heightVariation * strip.heightUnit) * (1 + o.nestHeight) ** Math.abs(strip.ring);
}
/** The absolute wall height of a strip. */
export function stripHeight(strip: Pick<QuillStrip, "ring" | "heightUnit">, o: QuillGeometryOptions): number {
  return Math.max(MIN_WALL, o.height * stripHeightFactor(strip, o));
}

function validateGeometryOptions(o: QuillGeometryOptions): void {
  if (!Number.isFinite(o.height) || o.height < 0.05 || o.height > 10_000) throw new Error("Wall height must be finite and in [0.05, 10000]");
  if (!Number.isFinite(o.heightVariation) || o.heightVariation < 0 || o.heightVariation > 1) throw new Error("Height variation must be finite and in [0, 1]");
  if (!Number.isFinite(o.nestHeight) || o.nestHeight <= -1 || o.nestHeight > 10) throw new Error("Nest height step must be finite and in (-1, 10]");
}

/**
 * Left and right offset polylines with miter joins and the pinch rule of the header. A vertex's
 * requested inner slide is `half * tan(turn / 2)`; on each segment the slides at its two ends that
 * fall on the same side add up, and every vertex's half thickness is scaled by the smallest factor
 * that keeps each adjacent segment's total slide within `PINCH_SLIDE` of its length, so an
 * inner offset edge never reverses. A clean right angle between long segments is not pinched.
 */
export function stripSides(points: readonly Point[], closed: boolean, half: number): { left: Point[]; right: Point[]; pinched: number } {
  const n = points.length;
  const turn = new Array<number>(n).fill(0), miterX = new Array<number>(n), miterY = new Array<number>(n), scale = new Array<number>(n).fill(1);
  const slide = new Array<number>(n).fill(0), reversal = new Array<boolean>(n).fill(false);
  const lengths = new Array<number>(closed ? n : n - 1);
  for (let j = 0; j < lengths.length; j++) lengths[j] = Math.hypot(points[(j + 1) % n][0] - points[j][0], points[(j + 1) % n][1] - points[j][1]);
  for (let i = 0; i < n; i++) {
    const hasPrev = closed || i > 0, hasNext = closed || i < n - 1;
    const p = points[i], prev = points[(i + n - 1) % n], next = points[(i + 1) % n];
    let t1x = 0, t1y = 0, t2x = 0, t2y = 0;
    if (hasPrev) { const l = lengths[(i + n - 1) % n]; t1x = (p[0] - prev[0]) / l; t1y = (p[1] - prev[1]) / l; }
    if (hasNext) { const l = lengths[i]; t2x = (next[0] - p[0]) / l; t2y = (next[1] - p[1]) / l; }
    if (!hasPrev) { t1x = t2x; t1y = t2y; }
    if (!hasNext) { t2x = t1x; t2y = t1y; }
    const bx = -t1y - t2y, by = t1x + t2x, blen = Math.hypot(bx, by);
    turn[i] = t1x * t2y - t1y * t2x;
    if (blen < 1e-9) { reversal[i] = true; miterX[i] = -t1y; miterY[i] = t1x; continue; }
    miterX[i] = bx / blen; miterY[i] = by / blen;
    const cosHalf = miterX[i] * -t1y + miterY[i] * t1x;
    scale[i] = 1 / cosHalf;
    slide[i] = half * Math.sqrt(Math.max(0, 1 - cosHalf * cosHalf)) / cosHalf;
  }
  // Per-vertex factor: the tightest requirement of its adjacent segments, and the miter length limit.
  const factor = new Array<number>(n).fill(1);
  for (let j = 0; j < lengths.length; j++) {
    const a = j, b = (j + 1) % n;
    const leftSlide = (turn[a] > 0 ? slide[a] : 0) + (turn[b] > 0 ? slide[b] : 0), rightSlide = (turn[a] < 0 ? slide[a] : 0) + (turn[b] < 0 ? slide[b] : 0);
    const need = Math.max(leftSlide, rightSlide);
    if (need > PINCH_SLIDE * lengths[j]) { const f = PINCH_SLIDE * lengths[j] / need; factor[a] = Math.min(factor[a], f); factor[b] = Math.min(factor[b], f); }
  }
  const left: Point[] = [], right: Point[] = [];
  let pinched = 0;
  for (let i = 0; i < n; i++) {
    const w = reversal[i] ? 0 : Math.min(half * factor[i], half * MITER_THICKNESS / scale[i]);
    if (w < half - 1e-12) pinched++;
    const offset = w * scale[i], p = points[i];
    left.push([p[0] + miterX[i] * offset, p[1] + miterY[i] * offset]);
    right.push([p[0] - miterX[i] * offset, p[1] - miterY[i] * offset]);
  }
  return { left, right, pinched };
}

/** A vertical wall as a transported ribbon along `side`: positions `[2i]` top, `[2i + 1]` bottom. */
function wallPositions(side: readonly Point[], closed: boolean, height: number, id: string): number[][] {
  const path = (closed ? [...side, side[0]] : side).map(([x, y]) => [x, y, height / 2]);
  try {
    return parallelTransportRibbon3D({ points: path, widths: path.map(() => height), initialNormal: [0, 0, 1], maxWork: 40 * path.length + 64 }).positions;
  } catch (error) {
    throw new Error(`Strip ${id} could not be walled (${(error as Error).message}); its path folds back on itself. Raise Path resolution or lower Paper thickness`);
  }
}

const geometryCache = new WeakMap<QuillStrips, Map<string, QuillGeometry>>();

/** Cached wall geometry of the strips; see the header. */
export function quillGeometry(strips: QuillStrips, options: QuillGeometryOptions): QuillGeometry {
  validateGeometryOptions(options);
  const key = JSON.stringify([options.height, options.heightVariation, options.nestHeight]);
  let byOptions = geometryCache.get(strips);
  if (!byOptions) { byOptions = new Map(); geometryCache.set(strips, byOptions); }
  const hit = byOptions.get(key);
  if (hit) return hit;
  const built = buildGeometry(strips, { ...options });
  byOptions.set(key, built);
  if (byOptions.size > 4) byOptions.delete(byOptions.keys().next().value!);
  return built;
}

function buildGeometry(strips: QuillStrips, o: QuillGeometryOptions): QuillGeometry {
  const list = strips.strips, half = strips.options.thickness / 2;
  let faceCount = 0;
  for (const strip of list) {
    const n = strip.points.length;
    faceCount += 3 * (strip.closed ? n : n - 1) + (strip.closed ? 0 : 2);
  }
  if (faceCount > MAX_QUILL_FACES)
    throw new Error(`The strips would need ${faceCount} faces; the limit is ${MAX_QUILL_FACES}. Raise Path resolution or lower the nest rings, the scaffold size or its path count`);
  const corners = new Float64Array(faceCount * 12), normals = new Float64Array(faceCount * 3);
  const kind = new Array<QuillFaceKind>(faceCount), strip = new Array<number>(faceCount), segment = new Array<number>(faceCount);
  const heights: number[] = [], factors: number[] = [], outlines: Ring[][] = [];
  let face = 0, pinchedVertices = 0, low = Infinity, high = -Infinity;
  const emit = (k: QuillFaceKind, s: number, j: number, quad: readonly number[][], nx: number, ny: number, nz: number) => {
    for (let c = 0; c < 4; c++) { corners[face * 12 + c * 3] = quad[c][0]; corners[face * 12 + c * 3 + 1] = quad[c][1]; corners[face * 12 + c * 3 + 2] = quad[c][2]; }
    normals[face * 3] = nx; normals[face * 3 + 1] = ny; normals[face * 3 + 2] = nz;
    kind[face] = k; strip[face] = s; segment[face] = j;
    face++;
  };
  list.forEach((item, s) => {
    const h = stripHeight(item, o), n = item.points.length, closed = item.closed;
    heights.push(h); low = Math.min(low, h); high = Math.max(high, h); factors.push(stripHeightFactor(item, o));
    const { left, right, pinched } = stripSides(item.points, closed, half);
    pinchedVertices += pinched;
    const segments = closed ? n : n - 1;
    const wl = wallPositions(left, closed, h, item.id), wr = wallPositions(right, closed, h, item.id);
    const at = (side: readonly Point[], i: number): Point => side[i % n];
    for (let j = 0; j < segments; j++) {
      const a = at(left, j), b = at(left, j + 1), c = at(right, j), d = at(right, j + 1);
      const jl = 2 * j, jn = 2 * (j + 1);
      emit(CAP, s, j, [[a[0], a[1], h], [b[0], b[1], h], [d[0], d[1], h], [c[0], c[1], h]], 0, 0, 1);
      let dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      emit(WALL_LEFT, s, j, [wl[jl], wl[jn], wl[jn + 1], wl[jl + 1]], -dy / len, dx / len, 0);
      dx = d[0] - c[0]; dy = d[1] - c[1]; len = Math.hypot(dx, dy) || 1;
      emit(WALL_RIGHT, s, j, [wr[jl], wr[jn], wr[jn + 1], wr[jl + 1]], dy / len, -dx / len, 0);
    }
    if (!closed) {
      const first = item.points[0], second = item.points[1], last = item.points[n - 1], before = item.points[n - 2];
      let dx = second[0] - first[0], dy = second[1] - first[1], len = Math.hypot(dx, dy);
      emit(END_START, s, 0, [[right[0][0], right[0][1], h], [left[0][0], left[0][1], h], [left[0][0], left[0][1], 0], [right[0][0], right[0][1], 0]], -dx / len, -dy / len, 0);
      dx = last[0] - before[0]; dy = last[1] - before[1]; len = Math.hypot(dx, dy);
      emit(END_END, s, segments - 1, [[left[n - 1][0], left[n - 1][1], h], [right[n - 1][0], right[n - 1][1], h], [right[n - 1][0], right[n - 1][1], 0], [left[n - 1][0], left[n - 1][1], 0]], dx / len, dy / len, 0);
    }
    outlines.push(closed ? [Object.freeze(left.map(freezePoint)), Object.freeze(right.map(freezePoint))]
      : [Object.freeze([...left, ...right.slice().reverse()].map(freezePoint))]);
  });
  return Object.freeze({
    strips, options: Object.freeze(o), faceCount,
    corners: Object.freeze(Array.from(corners)), normals: Object.freeze(Array.from(normals)),
    kind: Object.freeze(kind), strip: Object.freeze(strip), segment: Object.freeze(segment),
    heights: Object.freeze(heights), factors: Object.freeze(factors), heightRange: Object.freeze([list.length ? low : 0, list.length ? high : 0] as const),
    outlines: Object.freeze(outlines.map((rings) => Object.freeze(rings))), pinchedVertices,
  });
}
const freezePoint = ([x, y]: Point): Point => Object.freeze([x, y] as const);

export interface QuillCamera {
  /** Degrees, about `pivot`. */
  yaw: number;
  /** Degrees from straight down, 0..`MAX_PITCH`. */
  pitch: number;
  zoom: number;
  pivot: Point;
  anchor: Point;
}
export const MAX_PITCH = 85;
export interface QuillFootprint {
  /** Screen-space [left, top, right, bottom] of everything painted; all zero when nothing is painted. */
  readonly bounds: readonly [number, number, number, number];
  readonly hull: Ring;
  readonly strips: readonly { readonly id: string; readonly rings: readonly Ring[] }[];
}
export interface QuillProjection {
  readonly geometry: QuillGeometry;
  readonly camera: Readonly<QuillCamera>;
  /** Visible face indices, back to front. */
  readonly order: readonly number[];
  /** Four screen corners per painted face (8 numbers per position in `order`). */
  readonly screen: readonly number[];
  /** Plan depth key per position in `order`. */
  readonly depth: readonly number[];
  readonly footprint: QuillFootprint;
}

/** Map one ground or wall point to the screen. */
export function projectPoint(camera: QuillCamera, x: number, y: number, z: number): Point {
  const yaw = camera.yaw * Math.PI / 180, pitch = camera.pitch * Math.PI / 180;
  const dx = x - camera.pivot[0], dy = y - camera.pivot[1];
  const u = dx * Math.cos(yaw) - dy * Math.sin(yaw), v = dx * Math.sin(yaw) + dy * Math.cos(yaw);
  return [camera.anchor[0] + camera.zoom * u, camera.anchor[1] + camera.zoom * (v * Math.cos(pitch) - z * Math.sin(pitch))];
}

const projectionCache = new WeakMap<QuillGeometry, Map<string, QuillProjection>>();

/** Cached projection of the geometry under a camera: visible faces in painter's order plus footprint. */
export function quillProjection(geometry: QuillGeometry, camera: QuillCamera): QuillProjection {
  if (!Number.isFinite(camera.yaw) || !Number.isFinite(camera.pitch) || camera.pitch < 0 || camera.pitch > MAX_PITCH)
    throw new Error(`Camera pitch must be finite and in [0, ${MAX_PITCH}] degrees and yaw finite`);
  if (!Number.isFinite(camera.zoom) || camera.zoom <= 0 || camera.zoom > 100) throw new Error("Camera zoom must be finite and in (0, 100]");
  for (const value of [...camera.pivot, ...camera.anchor]) if (!Number.isFinite(value)) throw new Error("Camera pivot and anchor must be finite");
  const key = JSON.stringify([camera.yaw, camera.pitch, camera.zoom, camera.pivot, camera.anchor]);
  let byCamera = projectionCache.get(geometry);
  if (!byCamera) { byCamera = new Map(); projectionCache.set(geometry, byCamera); }
  const hit = byCamera.get(key);
  if (hit) return hit;
  const built = buildProjection(geometry, { ...camera, pivot: [...camera.pivot], anchor: [...camera.anchor] });
  byCamera.set(key, built);
  if (byCamera.size > 6) byCamera.delete(byCamera.keys().next().value!);
  return built;
}

/** Drop points strictly inside the octagon of axis and diagonal extremes; the hull is unchanged. */
function hullCandidates(points: readonly Point[]): Point[] {
  if (points.length < 64) return points.slice();
  const keys: Array<(p: Point) => number> = [(p) => p[0], (p) => -p[0], (p) => p[1], (p) => -p[1], (p) => p[0] + p[1], (p) => -p[0] - p[1], (p) => p[0] - p[1], (p) => p[1] - p[0]];
  const extremes = keys.map((key) => points.reduce((best, p) => (key(p) < key(best) ? p : best), points[0]));
  const cx = extremes.reduce((sum, p) => sum + p[0], 0) / extremes.length, cy = extremes.reduce((sum, p) => sum + p[1], 0) / extremes.length;
  const ring = [...new Set(extremes)].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  if (ring.length < 3) return points.slice();
  return points.filter((p) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      // Keep anything on or outside an edge: the extremes themselves lie on the polygon.
      if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) <= 0) return true;
    }
    return false;
  });
}

function buildProjection(geometry: QuillGeometry, camera: QuillCamera): QuillProjection {
  const yaw = camera.yaw * Math.PI / 180, pitch = camera.pitch * Math.PI / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const { corners, normals, kind, faceCount } = geometry, [px, py] = camera.pivot, [ax, ay] = camera.anchor, zoom = camera.zoom;
  const visible: number[] = [], key = new Float64Array(faceCount);
  for (let f = 0; f < faceCount; f++) {
    const nx = normals[f * 3], ny = normals[f * 3 + 1], nz = normals[f * 3 + 2];
    if ((nx * sy + ny * cy) * sp + nz * cp <= 1e-9) continue;
    let sum = 0;
    for (let c = 0; c < 4; c++) sum += (corners[f * 12 + c * 3] - px) * sy + (corners[f * 12 + c * 3 + 1] - py) * cy;
    key[f] = sum / 4;
    visible.push(f);
  }
  visible.sort((a, b) => key[a] - key[b] || (kind[a] === CAP ? 1 : 0) - (kind[b] === CAP ? 1 : 0) || a - b);
  const screen = new Array<number>(visible.length * 8), depth = new Array<number>(visible.length);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const painted: Point[] = [];
  visible.forEach((f, position) => {
    depth[position] = key[f];
    for (let c = 0; c < 4; c++) {
      const x = corners[f * 12 + c * 3] - px, y = corners[f * 12 + c * 3 + 1] - py, z = corners[f * 12 + c * 3 + 2];
      const sx = ax + zoom * (x * cy - y * sy), sy2 = ay + zoom * ((x * sy + y * cy) * cp - z * sp);
      screen[position * 8 + c * 2] = sx; screen[position * 8 + c * 2 + 1] = sy2;
      if (sx < left) left = sx; if (sx > right) right = sx; if (sy2 < top) top = sy2; if (sy2 > bottom) bottom = sy2;
      painted.push([sx, sy2]);
    }
  });
  const reduced = hullCandidates(painted);
  const hull = reduced.length ? (convexHull2D({ points: reduced, maxWork: reduced.length * reduced.length + reduced.length + 16 }).points as unknown as Point[]).map(freezePoint) : [];
  const stripsOut = geometry.strips.strips.map((s, i) => Object.freeze({
    id: s.id,
    rings: Object.freeze(geometry.outlines[i].map((ring) => Object.freeze(ring.map(([x, y]) => freezePoint(projectPoint(camera, x, y, 0))))))
  }));
  return Object.freeze({
    geometry, camera: Object.freeze(camera), order: Object.freeze(visible), screen: Object.freeze(screen), depth: Object.freeze(depth),
    footprint: Object.freeze({ bounds: Object.freeze(visible.length ? [left, top, right, bottom] as const : [0, 0, 0, 0] as const),
      hull: Object.freeze(hull), strips: Object.freeze(stripsOut) }),
  });
}
