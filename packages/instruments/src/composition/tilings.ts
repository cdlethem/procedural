import { componentSeed } from "./core.js";
import { memoized } from "./sources.js";
import type { Path, Point, Tiling, TilingEdge, TilingOptions, TilingRuleName, TilingTile, TilingVertex } from "./types.js";

/*
 * Substitution tilings: an exact rule, a seed patch and a depth give oriented tiles with ancestry.
 *
 * Inputs   `TilingOptions`. `rule` names one supported construction (there is no generic polygon
 *          rule); `patch` is one of that rule's seed patches; `depth` substitution generations.
 * Outputs  A deeply frozen `Tiling`, cached by construction (options including the seed, never
 *          palette, tone, omission or any consumer): `tiles` (Sites at their centroids with the
 *          polygon, ancestry and corner angles), `vertices` (Sites) and `edges` (deduplicated shared
 *          segments). `tilingEdgePaths` publishes the edges as Paths for `strokeWith`.
 * Exactness Vertices are integer vectors of an exact coordinate ring, never rounded floats:
 *          Penrose P3 uses Z[ζ5] (four integer coefficients, φ⁻¹ = ζ + ζ⁻¹ is a ring element), the
 *          chair uses dyadic rationals (exact binary64). Vertex identity is an exact string key, so
 *          matching, deduplication and T-junction splitting need no tolerance.
 * Ownership Piece ids are child-index paths from the seed piece (`p:2/1/0`), so ids depend on the
 *          patch and rule only: raising `depth`, changing `radius`, `rotation`, `crop`, or any
 *          appearance never renames a surviving tile, vertex (`v:<exact coordinates>`) or edge.
 *          A Penrose tile that joins two half-tiles is named for the half with the smaller path.
 * Seeds    Substitution is deterministic. `seed` only names each element's independent chance stream
 *          (`componentSeed(seed, id, purpose)`) for consumers that omit, vary or jitter elements.
 * Units    Canvas units, degrees in options, radians in frames. `radius` fixes the seed patch, so
 *          deeper tilings subdivide the same region and the tile edge is `edgeLength`.
 * Work     Leaf pieces are bounded by MAX_TILING_PIECES: an unbounded request fails before any
 *          expansion; a cropped request prunes subtrees that cannot reach the crop and fails as
 *          soon as the retained pieces exceed the limit. Invalid input throws precise errors.
 */

export const MAX_TILING_DEPTH = 16;
/** Measured: 40,000 pieces build in about 0.3 s (Penrose) to 1 s (chair) and draw within the default callback budget. */
export const MAX_TILING_PIECES = 40_000;
const PHI = (1 + Math.sqrt(5)) / 2;
const U32 = 0x1_0000_0000;

type Vec = readonly number[];
interface Piece { readonly cls: number; readonly pts: readonly Vec[] }
interface Leaf { readonly path: readonly number[]; readonly lineage: readonly number[]; readonly piece: Piece }
interface Draft {
  readonly canonical: Leaf;
  readonly halves: readonly Leaf[];
  readonly ring: Vec[];
  readonly corners: readonly number[];
  readonly classIndex: number;
  /** Polygon indices of the axis start and end; an end of -1 means the midpoint of the remaining vertices. */
  readonly axis: readonly [number, number];
  readonly complete: boolean;
}
interface Rule {
  readonly name: TilingRuleName;
  readonly patches: readonly string[];
  readonly classes: readonly string[];
  readonly unitsPerTurn: number;
  /** Longest ring length of any tile at generation g, in units where seed pieces have unit legs. */
  reach(generation: number): number;
  /** Shortest tile edge in ring units. */
  edgeUnit(depth: number): number;
  embed(v: Vec): Point;
  seed(patch: string): Piece[];
  /** Fixed center of a patch in embedded coordinates (its rotation center); the bounding-box center when absent. */
  anchor?(patch: string): Point | undefined;
  subdivide(piece: Piece): Piece[];
  /** Ring points whose convex hull contains the piece. */
  hull(piece: Piece): readonly Vec[];
  count(seeds: readonly Piece[], depth: number): number;
  assemble(leaves: readonly Leaf[]): Draft[];
  /** Axis-aligned rules need T-junction splitting on exact coordinate lines. */
  readonly axisAligned: boolean;
}

const vadd = (a: Vec, b: Vec): number[] => a.map((x, i) => x + b[i]);
const vsub = (a: Vec, b: Vec): number[] => a.map((x, i) => x - b[i]);
const vkey = (v: Vec): string => v.join(",");
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const pt = (x: number, y: number): Point => Object.freeze([x, y] as const);
function comparePath(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length && i < b.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// ── Penrose P3 ────────────────────────────────────────────────────────────────────────────────
// Robinson triangles (A apex, B and C the other corners). Class 0: acute 36-72-72, legs AB = AC, half of a
// thin rhombus. Class 1: obtuse 108-36-36, half of a thick rhombus. Two halves glue along BC with the SAME
// (B, C) order (the partner is the mirror image, so its labelling keeps B and C); that pairing is what makes
// the subdivision consistent across parent boundaries (swapping it leaves cracks, see the tests).
//   acute   → acute(C, P, B) + obtuse(P, C, A),          P = A + (B − A)/φ
//   obtuse  → obtuse(R, C, A) + obtuse(Q, R, B) + acute(R, Q, A),
//             Q = B + (A − B)/φ,  R = B + (C − B)/φ
// Coordinates are integer vectors over 1, ζ, ζ², ζ³ with ζ = e^{2πi/5}. Division by φ is multiplication by
// ζ + ζ⁴ = −1 − ζ² − ζ³, an integer matrix.
const P3_INVERSE: readonly (readonly number[])[] = [[-1, 0, -1, -1], [1, 0, 1, 0], [0, 1, 0, 1], [-1, -1, 0, -1]];
const P3_COS = [0, 1, 2, 3].map((k) => Math.cos(2 * Math.PI * k / 5));
const P3_SIN = [0, 1, 2, 3].map((k) => Math.sin(2 * Math.PI * k / 5));
const P3_ORIGIN: Vec = [0, 0, 0, 0];
const P3_ROOTS: readonly Vec[] = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [-1, -1, -1, -1]];
/** The 10th roots of unity: index m is the direction 36m degrees. */
const p3Direction = (m: number): Vec => {
  const k = ((m % 10) + 10) % 10;
  return k % 2 === 0 ? P3_ROOTS[k / 2] : P3_ROOTS[((5 + k) / 2) % 5].map((x) => -x);
};
function p3Scale(v: Vec): number[] {
  const r = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) r[j] += v[k] * P3_INVERSE[k][j];
  return r;
}
const p3Toward = (from: Vec, to: Vec): number[] => vadd(from, p3Scale(vsub(to, from)));

function p3Subdivide(piece: Piece): Piece[] {
  const [A, B, C] = piece.pts;
  if (piece.cls === 0) {
    const P = p3Toward(A, B);
    return [{ cls: 0, pts: [C, P, B] }, { cls: 1, pts: [P, C, A] }];
  }
  const Q = p3Toward(B, A), R = p3Toward(B, C);
  return [{ cls: 1, pts: [R, C, A] }, { cls: 1, pts: [Q, R, B] }, { cls: 0, pts: [R, Q, A] }];
}
function p3Seed(patch: string): Piece[] {
  if (patch === "decagon") {
    // Ten acute half-tiles around one 36° corner; alternate mirroring keeps every shared leg consistent.
    return Array.from({ length: 10 }, (_, i): Piece => {
      let B = p3Direction(i), C = p3Direction(i + 1);
      if (i % 2 === 0) [B, C] = [C, B];
      return { cls: 0, pts: [P3_ORIGIN, B, C] };
    });
  }
  if (patch === "sun") {
    // Five thick rhombi meeting at their 72° corners, halves glued along the long diagonal from the center.
    const pieces: Piece[] = [];
    for (let j = 0; j < 5; j++) {
      const a = p3Direction(2 * j), b = p3Direction(2 * j + 2), far = vadd(a, b);
      pieces.push({ cls: 1, pts: [a, P3_ORIGIN, far] }, { cls: 1, pts: [b, P3_ORIGIN, far] });
    }
    return pieces;
  }
  if (patch === "thick") {
    const a = p3Direction(0), b = p3Direction(2), far = vadd(a, b);
    return [{ cls: 1, pts: [a, P3_ORIGIN, far] }, { cls: 1, pts: [b, P3_ORIGIN, far] }];
  }
  if (patch === "thin") {
    const b = p3Direction(0), c = p3Direction(1), far = vadd(b, c);
    return [{ cls: 0, pts: [P3_ORIGIN, b, c] }, { cls: 0, pts: [far, b, c] }];
  }
  throw new Error(`Unknown penrose-p3 patch: ${patch}`);
}
function p3Count(seeds: readonly Piece[], depth: number): number {
  let acute = seeds.filter((p) => p.cls === 0).length, obtuse = seeds.length - acute;
  for (let g = 0; g < depth; g++) [acute, obtuse] = [acute + obtuse, acute + 2 * obtuse];
  return acute + obtuse;
}
function p3Assemble(leaves: readonly Leaf[]): Draft[] {
  const glue = new Map<string, number>();
  const partner = new Int32Array(leaves.length).fill(-1);
  for (let i = 0; i < leaves.length; i++) {
    const [, B, C] = leaves[i].piece.pts;
    const kb = vkey(B), kc = vkey(C), edge = kb < kc ? `${kb}|${kc}` : `${kc}|${kb}`;
    const other = glue.get(edge);
    if (other === undefined) { glue.set(edge, i); continue; }
    if (partner[other] !== -1 || leaves[other].piece.cls !== leaves[i].piece.cls)
      throw new Error("Substitution produced an inconsistent glue edge");
    partner[other] = i; partner[i] = other;
  }
  const drafts: Draft[] = [];
  for (let i = 0; i < leaves.length; i++) {
    const j = partner[i];
    if (j !== -1 && j < i) continue;
    const leaf = leaves[i], cls = leaf.piece.cls;
    if (j === -1) {
      const [A, B, C] = leaf.piece.pts;
      drafts.push({ canonical: leaf, halves: [leaf], ring: [A as number[], B as number[], C as number[]],
        corners: cls === 1 ? [3, 1, 1] : [1, 2, 2], classIndex: cls, axis: [0, -1], complete: false });
      continue;
    }
    // Both halves start with their apex; the smaller path names the tile.
    const other = leaves[j];
    const [first, second] = comparePath(leaf.path, other.path) <= 0 ? [leaf, other] : [other, leaf];
    const [A1, B1, C1] = first.piece.pts, [A2] = second.piece.pts;
    drafts.push({ canonical: first, halves: [first, second], ring: [A1 as number[], B1 as number[], A2 as number[], C1 as number[]],
      corners: cls === 1 ? [3, 2, 3, 2] : [1, 4, 1, 4], classIndex: cls, axis: [0, 2], complete: true });
  }
  return drafts;
}
const PENROSE: Rule = {
  name: "penrose-p3", patches: ["sun", "decagon", "thick", "thin"], classes: ["thin", "thick"], unitsPerTurn: 10, axisAligned: false,
  reach: (generation) => PHI ** (1 - generation), edgeUnit: (depth) => PHI ** -depth,
  embed: (v) => [v[0] + v[1] * P3_COS[1] + v[2] * P3_COS[2] + v[3] * P3_COS[3], v[1] * P3_SIN[1] + v[2] * P3_SIN[2] + v[3] * P3_SIN[3]] as const,
  seed: p3Seed, anchor: (patch) => patch === "sun" || patch === "decagon" ? [0, 0] : undefined, subdivide: p3Subdivide, hull: (piece) => piece.pts, count: p3Count, assemble: p3Assemble,
};

// ── Chair ─────────────────────────────────────────────────────────────────────────────────────
// The L-tromino: three unit squares. A piece is its frame (O, X = O + 2U, Y = O + 2V); with
// at(a, b) = O + aU + bV the polygon is (0,0) (2,0) (2,1) (1,1) (1,2) (0,2), the reflex corner is (1,1).
// The rule (unique: a search over all placements finds one dissection of the 2×-inflated chair into four
// chairs) halves every chair into four at scale 1/2, listed as slots 0..3:
//   0 at(0,0) frame (U, V)          orientation k
//   1 at(0,2) frame (−V, U)         orientation k − 1
//   2 at(½,½) frame (U, V)          orientation k
//   3 at(2,0) frame (V, −U)         orientation k + 1
// Coordinates are exact dyadic binary64 values.
function chairAt(piece: Piece, a: number, b: number): number[] {
  const [O, X, Y] = piece.pts;
  return [O[0] + a * (X[0] - O[0]) / 2 + b * (Y[0] - O[0]) / 2, O[1] + a * (X[1] - O[1]) / 2 + b * (Y[1] - O[1]) / 2];
}
function chairSubdivide(piece: Piece): Piece[] {
  const at = (a: number, b: number) => chairAt(piece, a, b), k = piece.cls;
  return [
    { cls: k, pts: [at(0, 0), at(1, 0), at(0, 1)] },
    { cls: (k + 3) % 4, pts: [at(0, 2), at(0, 1), at(1, 2)] },
    { cls: k, pts: [at(.5, .5), at(1.5, .5), at(.5, 1.5)] },
    { cls: (k + 1) % 4, pts: [at(2, 0), at(2, 1), at(1, 0)] },
  ];
}
function chairSeed(patch: string): Piece[] {
  const upright = (ox: number, oy: number): Piece => ({ cls: 0, pts: [[ox, oy], [ox + 2, oy], [ox, oy + 2]] });
  const turned = (ox: number, oy: number): Piece => ({ cls: 2, pts: [[ox, oy], [ox - 2, oy], [ox, oy - 2]] });
  if (patch === "chair") return [upright(0, 0)];
  if (patch === "rectangle") return [upright(0, 0), turned(2, 3)];
  if (patch === "block") return [upright(0, 0), turned(2, 3), upright(2, 0), turned(4, 3)];
  throw new Error(`Unknown chair patch: ${patch}`);
}
function chairAssemble(leaves: readonly Leaf[]): Draft[] {
  return leaves.map((leaf): Draft => {
    const at = (a: number, b: number) => chairAt(leaf.piece, a, b);
    return { canonical: leaf, halves: [leaf], ring: [at(0, 0), at(2, 0), at(2, 1), at(1, 1), at(1, 2), at(0, 2)],
      corners: [1, 1, 1, 3, 1, 1], classIndex: leaf.piece.cls, axis: [3, 0], complete: true };
  });
}
const CHAIR: Rule = {
  name: "chair", patches: ["chair", "rectangle", "block"], classes: ["nw", "ne", "se", "sw"], unitsPerTurn: 4, axisAligned: true,
  reach: (generation) => 2 * Math.SQRT2 * 2 ** -generation, edgeUnit: (depth) => 2 ** -depth,
  embed: (v) => [v[0], v[1]] as const,
  seed: chairSeed, subdivide: chairSubdivide,
  hull: (piece) => { const [O, X, Y] = piece.pts; return [O, X, Y, [X[0] + Y[0] - O[0], X[1] + Y[1] - O[1]]]; },
  count: (seeds, depth) => seeds.length * 4 ** depth, assemble: chairAssemble,
};
const RULES: Readonly<Record<TilingRuleName, Rule>> = { "penrose-p3": PENROSE, chair: CHAIR };

/** The supported constructions, their seed patches, tile classes and substitution ratios. */
export const tilingRules: Readonly<Record<TilingRuleName, {
  readonly patches: readonly string[]; readonly classes: readonly string[]; readonly unitsPerTurn: number;
  /** Linear inflation factor: one generation scales every length by 1/ratio and every area by 1/ratio². */
  readonly ratio: number;
}>> = Object.freeze({
  "penrose-p3": Object.freeze({ patches: Object.freeze([...PENROSE.patches]), classes: Object.freeze([...PENROSE.classes]), unitsPerTurn: 10, ratio: PHI }),
  chair: Object.freeze({ patches: Object.freeze([...CHAIR.patches]), classes: Object.freeze([...CHAIR.classes]), unitsPerTurn: 4, ratio: 2 }),
});

function requireFinite(label: string, value: number, min = -Infinity, max = Infinity): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function validate(options: TilingOptions): Rule {
  const rule = RULES[options.rule];
  if (!rule) throw new Error(`Unknown tiling rule: ${String(options.rule)}`);
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error("Tiling seed must be a uint32 integer");
  if (!rule.patches.includes(options.patch)) throw new Error(`Unknown ${rule.name} patch: ${String(options.patch)}`);
  if (!Number.isInteger(options.depth) || options.depth < 0 || options.depth > MAX_TILING_DEPTH)
    throw new Error(`Tiling depth must be an integer in [0, ${MAX_TILING_DEPTH}]`);
  requireFinite("Tiling center X", options.centerX, -1e6, 1e6);
  requireFinite("Tiling center Y", options.centerY, -1e6, 1e6);
  requireFinite("Tiling radius", options.radius, 1e-3, 1e5);
  requireFinite("Tiling rotation", options.rotation, -3600, 3600);
  if (options.boundary !== "half-tiles" && options.boundary !== "whole") throw new Error(`Unknown tiling boundary: ${String(options.boundary)}`);
  if (options.crop !== "none" && options.crop !== "rectangle" && options.crop !== "ellipse") throw new Error(`Unknown tiling crop: ${String(options.crop)}`);
  if (options.crop !== "none") {
    requireFinite("Tiling crop X", options.cropX, -1e6, 1e6);
    requireFinite("Tiling crop Y", options.cropY, -1e6, 1e6);
    requireFinite("Tiling crop width", options.cropWidth, 1e-3, 1e5);
    requireFinite("Tiling crop height", options.cropHeight, 1e-3, 1e5);
  }
  return rule;
}
function limitError(pieces: number): Error {
  return new Error(`Tiling needs ${pieces > MAX_TILING_PIECES ? "more than " + MAX_TILING_PIECES : pieces} substitution pieces; limit ${MAX_TILING_PIECES}. Reduce depth, or crop to the part you need`);
}

const tilingCache = new Map<string, Tiling>();

/** The construction key: everything that can change geometry, ids or element seeds; nothing about drawing. */
function cacheKey(o: TilingOptions): string {
  const crop = o.crop === "none" ? ["none"] : [o.crop, o.cropX, o.cropY, o.cropWidth, o.cropHeight];
  return JSON.stringify([o.seed, o.rule, o.patch, o.depth, o.centerX, o.centerY, o.radius, o.rotation, o.boundary, ...crop]);
}

/**
 * Oriented tiles with ancestry, vertices and deduplicated shared edges for one rule, seed patch and depth.
 * See the module comment for the exactness, identity, seed, unit and work rules.
 */
export function substitutionTiling(options: TilingOptions): Tiling {
  const rule = validate(options);
  return memoized(tilingCache, cacheKey(options), () => build(options, rule));
}

function build(options: TilingOptions, rule: Rule): Tiling {
  const { seed, depth, centerX, centerY, radius, rotation, crop, boundary } = options;
  const seeds = rule.seed(options.patch);
  // Ring → canvas: center the patch (its five- or ten-fold center, else its bounding box) and scale so its
  // farthest vertex sits at `radius`.
  const seedPoints = seeds.flatMap((piece) => rule.hull(piece).map((v) => rule.embed(v)));
  const minX = Math.min(...seedPoints.map((p) => p[0])), maxX = Math.max(...seedPoints.map((p) => p[0]));
  const minY = Math.min(...seedPoints.map((p) => p[1])), maxY = Math.max(...seedPoints.map((p) => p[1]));
  const anchor = rule.anchor?.(options.patch), cx = anchor ? anchor[0] : (minX + maxX) / 2, cy = anchor ? anchor[1] : (minY + maxY) / 2;
  const reach = Math.max(...seedPoints.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
  const k = radius / reach, theta = rotation * Math.PI / 180, cos = Math.cos(theta), sin = Math.sin(theta);
  const canvas = (v: Vec): Point => {
    const [x, y] = rule.embed(v), dx = x - cx, dy = y - cy;
    return [centerX + k * (cos * dx - sin * dy), centerY + k * (sin * dx + cos * dy)];
  };
  const edgeLength = rule.edgeUnit(depth) * k;
  const leafReach = rule.reach(depth) * k;
  // A tile whose centroid is in the crop has both halves within one tile diameter of it; keep that margin.
  const margin = crop === "none" ? 0 : 4 * leafReach;
  const box = crop === "none" ? undefined : [options.cropX - options.cropWidth / 2 - margin, options.cropY - options.cropHeight / 2 - margin,
    options.cropX + options.cropWidth / 2 + margin, options.cropY + options.cropHeight / 2 + margin] as const;

  if (!box) {
    const total = rule.count(seeds, depth);
    if (total > MAX_TILING_PIECES) throw limitError(total);
  }
  const leaves: Leaf[] = [];
  const visit = (piece: Piece, path: readonly number[], lineage: readonly number[]): void => {
    if (box) {
      let lo = Infinity, hi = Infinity, lx = -Infinity, ly = -Infinity;
      for (const v of rule.hull(piece)) {
        const [x, y] = canvas(v);
        if (x < lo) lo = x; if (y < hi) hi = y; if (x > lx) lx = x; if (y > ly) ly = y;
      }
      if (lx < box[0] || ly < box[1] || lo > box[2] || hi > box[3]) return;
    }
    if (path.length === depth + 1) {
      if (leaves.length >= MAX_TILING_PIECES) throw limitError(leaves.length + 1);
      leaves.push({ path, lineage, piece });
      return;
    }
    const children = rule.subdivide(piece);
    for (let slot = 0; slot < children.length; slot++)
      visit(children[slot], [...path, slot], [...lineage, children[slot].cls]);
  };
  seeds.forEach((piece, index) => visit(piece, [index], [piece.cls]));

  const drafts = rule.assemble(leaves).sort((p, q) => comparePath(p.canonical.path, q.canonical.path));
  if (rule.name === "chair" && drafts.length !== leaves.length) throw new Error("Chair substitution lost pieces");

  // Tiles: canvas polygon (positive winding), centroid, axis and the local outline.
  const inCrop = (x: number, y: number): boolean => {
    if (crop === "none") return true;
    const dx = (x - options.cropX) / (options.cropWidth / 2), dy = (y - options.cropY) / (options.cropHeight / 2);
    return crop === "rectangle" ? Math.abs(dx) <= 1 && Math.abs(dy) <= 1 : dx * dx + dy * dy <= 1;
  };
  interface Built { draft: Draft; ring: Vec[]; points: Point[]; centroid: Point; area: number; angle: number; kept: boolean; id: string; keys: string[] }
  const built: Built[] = drafts.map((draft): Built => {
    let ring = draft.ring, points = ring.map(canvas);
    let signed = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
      signed += x1 * y2 - x2 * y1;
    }
    if (signed < 0) {
      // Reverse the two side vertices, keeping the reference vertex first (symmetric corners keep their order).
      const order = draft.ring.length === 4 ? [0, 3, 2, 1] : [0, 2, 1];
      if (rule.name === "chair") throw new Error("Chair tiles must have positive winding");
      ring = order.map((i) => draft.ring[i]); points = order.map((i) => points[i]); signed = -signed;
    }
    let gx = 0, gy = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length], cross = x1 * y2 - x2 * y1;
      gx += (x1 + x2) * cross; gy += (y1 + y2) * cross;
    }
    const area = signed / 2, centroid: Point = [gx / (6 * area), gy / (6 * area)];
    const [from, to] = draft.axis;
    const target: Point = to >= 0 ? points[to] : [(points[1][0] + points[2][0]) / 2, (points[1][1] + points[2][1]) / 2];
    const angle = Math.atan2(target[1] - points[from][1], target[0] - points[from][0]);
    const kept = (draft.complete || boundary === "half-tiles") && inCrop(centroid[0], centroid[1]);
    return { draft, ring, points, centroid, area, angle, kept, id: `t:${draft.canonical.path.join("/")}`, keys: ring.map(vkey) };
  });

  // Vertices accumulate corners over every assembled tile, so a vertex near the crop still reports its true neighborhood.
  interface VertexAcc { ring: Vec; corners: number[]; through: number; kept: string[] }
  const vertexAt = new Map<string, VertexAcc>();
  for (const tile of built) tile.ring.forEach((ring, i) => {
    let acc = vertexAt.get(tile.keys[i]);
    if (!acc) vertexAt.set(tile.keys[i], acc = { ring, corners: [], through: 0, kept: [] });
    acc.corners.push(tile.draft.corners[i]);
    if (tile.kept) acc.kept.push(tile.id);
  });

  // Edges: polygon sides, split at any vertex lying inside them (exact coordinate lines for the chair).
  const linesX = new Map<number, number[]>(), linesY = new Map<number, number[]>();
  if (rule.axisAligned) {
    for (const acc of vertexAt.values()) {
      const [x, y] = acc.ring;
      (linesY.get(y) ?? linesY.set(y, []).get(y)!).push(x);
      (linesX.get(x) ?? linesX.set(x, []).get(x)!).push(y);
    }
    for (const list of [...linesX.values(), ...linesY.values()]) list.sort((a, b) => a - b);
  }
  interface EdgeAcc { a: string; b: string; tiles: number[] }
  const edgeAt = new Map<string, EdgeAcc>();
  built.forEach((tile, index) => {
    for (let i = 0; i < tile.ring.length; i++) {
      const p = tile.ring[i], q = tile.ring[(i + 1) % tile.ring.length];
      let chain: string[] = [tile.keys[i], tile.keys[(i + 1) % tile.ring.length]];
      if (rule.axisAligned) {
        const horizontal = p[1] === q[1], line = horizontal ? linesY.get(p[1])! : linesX.get(p[0])!;
        const lo = Math.min(horizontal ? p[0] : p[1], horizontal ? q[0] : q[1]), hi = Math.max(horizontal ? p[0] : p[1], horizontal ? q[0] : q[1]);
        let first = 0, last = line.length;
        while (first < last) { const mid = (first + last) >> 1; if (line[mid] <= lo) first = mid + 1; else last = mid; }
        const inner: number[] = [];
        for (let at = first; at < line.length && line[at] < hi; at++) inner.push(line[at]);
        if (inner.length > 0) {
          if (horizontal ? p[0] > q[0] : p[1] > q[1]) inner.reverse();
          const keys = inner.map((v) => vkey(horizontal ? [v, p[1]] : [p[0], v]));
          for (const key of keys) vertexAt.get(key)!.through++;
          chain = [chain[0], ...keys, chain[1]];
        }
      }
      for (let s = 0; s + 1 < chain.length; s++) {
        const a = chain[s], b = chain[s + 1], key = a < b ? `${a}|${b}` : `${b}|${a}`;
        let acc = edgeAt.get(key);
        if (!acc) edgeAt.set(key, acc = { a: a < b ? a : b, b: a < b ? b : a, tiles: [] });
        if (acc.tiles.length === 2) throw new Error("Tiles overlap along an edge");
        acc.tiles.push(index);
      }
    }
  });

  const tiles: TilingTile[] = [], vertexIds = (keys: readonly string[]) => Object.freeze(keys.map((key) => `v:${key}`));
  for (const tile of built) {
    if (!tile.kept) continue;
    const { draft } = tile, c = tile.centroid, cosA = Math.cos(-tile.angle), sinA = Math.sin(-tile.angle);
    const path = draft.canonical.path;
    tiles.push(Object.freeze({
      id: tile.id, seed: componentSeed(seed, tile.id, "tile"), position: pt(c[0], c[1]), angle: tile.angle, scale: 1,
      tone: draft.classIndex,
      class: rule.classes[draft.classIndex], classIndex: draft.classIndex, generation: depth,
      parentId: path.length > 1 ? `p:${path.slice(0, -1).join("/")}` : null,
      pieces: Object.freeze(draft.halves.map((half) => `p:${half.path.join("/")}`)),
      path: Object.freeze([...path]), lineage: Object.freeze([...draft.canonical.lineage]),
      complete: draft.complete,
      points: Object.freeze(tile.points.map(([x, y]) => pt(x, y))),
      outline: Object.freeze(tile.points.map(([x, y]) => pt(cosA * (x - c[0]) - sinA * (y - c[1]), sinA * (x - c[0]) + cosA * (y - c[1])))),
      corners: Object.freeze([...draft.corners]), vertexIds: vertexIds(tile.keys), area: tile.area,
    }));
  }

  const vertices: TilingVertex[] = [];
  for (const [key, acc] of vertexAt) {
    if (acc.kept.length === 0) continue;
    const id = `v:${key}`, [x, y] = canvas(acc.ring);
    const sum = acc.corners.reduce((total, value) => total + value, 0) + 2 * acc.through;
    vertices.push(Object.freeze({
      id, seed: componentSeed(seed, id, "vertex"), position: pt(x, y), angle: 0, scale: 1,
      valence: acc.corners.length, signature: [...acc.corners].sort((a, b) => a - b).join("."),
      interior: sum === rule.unitsPerTurn, tiles: Object.freeze([...acc.kept]),
      regular: acc.through === 0 && acc.corners.every((value) => value === acc.corners[0]) && acc.corners.length * acc.corners[0] === rule.unitsPerTurn,
    }));
  }

  const position = new Map<string, Point>(), ringOf = new Map<string, Vec>();
  for (const [key, acc] of vertexAt) ringOf.set(key, acc.ring);
  const at = (key: string): Point => position.get(key) ?? (position.set(key, canvas(ringOf.get(key)!)), position.get(key)!);
  const edges: TilingEdge[] = [];
  for (const [key, acc] of edgeAt) {
    const sides = acc.tiles.filter((index) => built[index].kept);
    if (sides.length === 0) continue;
    let level = 0;
    if (acc.tiles.length === 2) {
      const p = built[acc.tiles[0]].draft.canonical.path, q = built[acc.tiles[1]].draft.canonical.path;
      while (level < p.length && p[level] === q[level]) level++;
    }
    const id = `e:${key}`;
    edges.push(Object.freeze({
      id, seed: componentSeed(seed, id, "edge"), a: `v:${acc.a}`, b: `v:${acc.b}`,
      points: Object.freeze([pt(...at(acc.a)), pt(...at(acc.b))] as const),
      tiles: Object.freeze([built[sides[0]].id, sides.length > 1 ? built[sides[1]].id : null] as const), level,
    }));
  }
  return Object.freeze({
    rule: rule.name, patch: options.patch, depth, classes: Object.freeze([...rule.classes]), unitsPerTurn: rule.unitsPerTurn,
    edgeLength, pieces: leaves.length,
    tiles: Object.freeze(tiles), vertices: Object.freeze(vertices), edges: Object.freeze(edges),
  });
}

const edgePathCache = new WeakMap<Tiling, readonly Path[]>();
/**
 * Shared edges as two-point Paths for `strokeWith`. `level` is the edge's hierarchy level (0 coarsest) and
 * `levelFraction` runs from 0 at the outer boundary to 1 between siblings; ids equal the edge ids.
 * Paths carry no tone: a consumer that wants hierarchical color assigns `tone` itself.
 */
export function tilingEdgePaths(tiling: Tiling): readonly Path[] {
  let paths = edgePathCache.get(tiling);
  if (!paths) {
    paths = Object.freeze(tiling.edges.map((edge): Path => Object.freeze({
      id: edge.id, seed: edge.seed, points: edge.points, closed: false, level: edge.level,
      levelFraction: tiling.depth > 0 ? edge.level / tiling.depth : 0,
    })));
    edgePathCache.set(tiling, paths);
  }
  return paths;
}

/** Piece id of a tile's ancestor at `generation` (0 = its seed piece); the tile's own piece at its generation. */
export function tileAncestorId(tile: TilingTile, generation: number): string {
  if (!Number.isInteger(generation) || generation < 0 || generation > tile.generation)
    throw new Error(`Ancestor generation must be an integer in [0, ${tile.generation}]`);
  return `p:${tile.path.slice(0, generation + 1).join("/")}`;
}
