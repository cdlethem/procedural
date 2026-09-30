/**
 * Typed signed-distance trees (brief 56, implicit sculpture).
 *
 * A tree is plain data (`SdfNode`): primitives (sphere, box, torus, capsule, cylinder), operators (union,
 * intersection, subtract, smooth union, shell, bounded repetition, placement, twist, bend, bounded fractal fold)
 * and, for trusted code only, a `field` node wrapping a caller's function. `sdf(root)` validates it (every failure
 * names the node path and the field), copies and freezes it, compiles ONE closure `distance(x, y, z)` and reports
 * what the number means.
 *
 * Sign and units. World units are the caller's (right-handed, +Y up as in `mesh.ts`). The field is NEGATIVE inside the
 * solid and positive outside; the surface is the zero set.
 *
 * WHAT THE FIELD MEANS (`sdf.class`). Sphere tracing steps by the field value, so it is safe only where
 * `|field(p)| <= distance from p to the surface`. Three classes are distinguished and never silently mixed:
 *  - `exact`: the true Euclidean signed distance everywhere: a single primitive under rotation, translation and
 *    uniform scale (also an identity fold, a zero twist or bend, and a repeat of one copy).
 *  - `bound`: 1-Lipschitz and zero on the surface, so it never exceeds the true distance (steps are safe, if short).
 *    Every operator below yields at least this. Union, intersection, subtraction and smooth union are 1-Lipschitz
 *    combinations (min, max, and a polynomial smooth minimum that only lowers min) of 1-Lipschitz fields. A shell is
 *    `|d| - t/2`. Twist and bend divide by a Lipschitz constant derived from the declared marching region (below). A
 *    bounded repeat is `min(child(p - cell centre), b)` where `b` is the distance to the nearest neighbouring copy's
 *    bounding slab, which needs the child's bounding half-extent to be at most half the spacing (else the node is
 *    refused). A fold is `child(fold(p)) / scale^n` for isometric folds and a uniform scale.
 *  - `scalar`: nothing is known (a `field` node without a declared Lipschitz constant, or any tree containing one).
 *    Such a tree can be evaluated, drawn as a mesh by `sdfMesh`, sliced and sampled, but `marchRays` REFUSES it: an
 *    arbitrary scalar field is never silently treated as a safe distance estimator.
 * A `field` node with `lipschitz: L` is trusted: the evaluator divides by L and calls the result a bound.
 *
 * REGION. Twist and bend derive their Lipschitz constant from a ball of radius `sdf.region` about the origin (the
 * bounding sphere's centre offset plus its radius); the field is guaranteed only for points inside that ball.
 * `marchRays` starts every ray where it enters the bounding sphere, so it never evaluates outside it.
 *
 * Twist rotates about Y by `rate * y` radians (Lipschitz `(m + sqrt(m^2 + 4)) / 2`, `m = |rate| R`); bend rotates about Z
 * by `rate * x` (Lipschitz `1 + |rate| R`). `place` maps a child point `q = M^T (p - t) / s` with `M = Ry(ry) Rx(rx) Rz(rz)`
 * (degrees), scaling the field back by `s`. Fold `menger` uses the sorted-absolute fold `p -> 3p - (2, 2, 2|0)` and
 * `tetra` the three swap-negate reflections then `p -> 2p - (1, 1, 1)`; the solid is a union of `20^n` (menger) or `4^n`
 * (tetra) copies of the child. Iterations are capped at `SDF_LIMITS.maxFoldIterations`.
 *
 * Bounds. Every node's bounding box is conservative and computed bottom-up; `sdf.bounds` is the root's, `sdf.center` its
 * middle, `sdf.radius` the bounding sphere (3 percent larger than the box's circumscribed sphere so rays start outside
 * solids that touch the box). An intersection whose children's boxes do not overlap is refused (nothing would exist).
 *
 * Work. `sdf.cost` counts primitive evaluations per field evaluation (a fold multiplies its child by its iterations, a
 * repeat adds one); `marchRays` and `sdfMesh` multiply it by their sample counts against explicit limits.
 *
 * Ownership. `sdf()` returns a frozen value cached by tree content (32 entries, least recently used); equal trees give
 * the same object. Callers never see a mutable node. `field` nodes are keyed by id and the function's identity.
 */
import { componentSeed } from "./core.js";
import type { Vec3 } from "./mesh.js";
import { sha256Hex } from "./raster.js";

export const SDF_LIMITS = Object.freeze({ maxNodes: 128, maxDepth: 16, maxChildren: 64, maxFoldIterations: 5, maxRepeatCount: 32, maxCoordinate: 1e6 });

export type SdfClass = "exact" | "bound" | "scalar";
export type SdfFold = "menger" | "tetra";

export type SdfNode =
  | { readonly kind: "sphere"; readonly radius: number; readonly center?: Vec3 }
  | { readonly kind: "box"; readonly half: Vec3; readonly round?: number }
  | { readonly kind: "torus"; readonly major: number; readonly minor: number }
  | { readonly kind: "capsule"; readonly from: Vec3; readonly to: Vec3; readonly radius: number }
  | { readonly kind: "cylinder"; readonly radius: number; readonly halfHeight: number }
  | { readonly kind: "place"; readonly child: SdfNode; readonly translate?: Vec3; readonly rotate?: Vec3; readonly scale?: number }
  | { readonly kind: "union" | "intersection"; readonly children: readonly SdfNode[] }
  | { readonly kind: "subtract"; readonly base: SdfNode; readonly cuts: readonly SdfNode[] }
  | { readonly kind: "smoothUnion"; readonly children: readonly SdfNode[]; readonly k: number }
  | { readonly kind: "shell"; readonly child: SdfNode; readonly thickness: number }
  | { readonly kind: "repeat"; readonly child: SdfNode; readonly spacing: Vec3; readonly counts: readonly [number, number, number];
      readonly keep?: { readonly seed: number; readonly probability: number } }
  | { readonly kind: "twist" | "bend"; readonly child: SdfNode; readonly rate: number }
  | { readonly kind: "fold"; readonly child: SdfNode; readonly fold: SdfFold; readonly iterations: number }
  | { readonly kind: "field"; readonly id: string; readonly evaluate: (x: number, y: number, z: number) => number;
      readonly bounds: { readonly min: Vec3; readonly max: Vec3 }; readonly lipschitz?: number };

export type SdfFn = (x: number, y: number, z: number) => number;
export interface Sdf {
  /** Content key: equal trees have equal keys. */
  readonly key: string;
  /** The validated, frozen tree (defaults filled in). */
  readonly root: SdfNode;
  readonly class: SdfClass;
  readonly nodeCount: number;
  readonly depth: number;
  /** Primitive evaluations per field evaluation. */
  readonly cost: number;
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  readonly center: Vec3;
  /** Bounding sphere about `center`, including a 3 percent margin. */
  readonly radius: number;
  /** Radius about the origin of the ball the Lipschitz derivations assume. */
  readonly region: number;
  readonly distance: SdfFn;
  /** Unit gradient by four samples (tetrahedron), step `h` world units; null where the gradient vanishes. */
  normal(x: number, y: number, z: number, h: number): Vec3 | null;
}

type Box = { min: [number, number, number]; max: [number, number, number] };
interface Info {
  readonly node: SdfNode;
  readonly path: string;
  readonly kids: readonly Info[];
  readonly box: Box;
  readonly cls: SdfClass;
  readonly cost: number;
  readonly count: number;
  readonly depth: number;
}

const DEG = Math.PI / 180;
const fieldIds = new WeakMap<object, number>();
let fieldCounter = 0;

function fail(path: string, kind: string, message: string): never {
  throw new Error(`SDF node ${path} (${kind}): ${message}`);
}
function num(path: string, kind: string, name: string, value: unknown, min = -Infinity, max = Infinity, inclusive = true): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, kind, `${name} must be a finite number (got ${String(value)})`);
  const v = value as number;
  if (Math.abs(v) > SDF_LIMITS.maxCoordinate) fail(path, kind, `${name} ${v} exceeds ${SDF_LIMITS.maxCoordinate}`);
  if (inclusive ? (v < min || v > max) : (v <= min || v >= max)) fail(path, kind, `${name} ${v} must be in ${inclusive ? "[" : "("}${min}, ${max}${inclusive ? "]" : ")"}`);
  return v === 0 ? 0 : v;
}
function vec(path: string, kind: string, name: string, value: unknown, positive = false): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) fail(path, kind, `${name} must be three numbers`);
  const v = value as unknown[];
  return Object.freeze([0, 1, 2].map((i) => num(path, kind, `${name}[${i}]`, v[i], positive ? 0 : -Infinity, Infinity, !positive) + 0)) as unknown as Vec3;
}
function children(path: string, kind: string, name: string, value: unknown, min: number): readonly SdfNode[] {
  if (!Array.isArray(value)) fail(path, kind, `${name} must be an array of nodes`);
  const list = value as SdfNode[];
  if (list.length < min) fail(path, kind, `${name} needs at least ${min} node${min === 1 ? "" : "s"} (got ${list.length})`);
  if (list.length > SDF_LIMITS.maxChildren) fail(path, kind, `${name} has ${list.length} nodes; the limit is ${SDF_LIMITS.maxChildren}`);
  return list;
}

const emptyBox = (): Box => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const unionBox = (boxes: readonly Box[]): Box => {
  const out = emptyBox();
  for (const b of boxes) for (let i = 0; i < 3; i++) { out.min[i] = Math.min(out.min[i], b.min[i]); out.max[i] = Math.max(out.max[i], b.max[i]); }
  return out;
};
const grow = (b: Box, by: number): Box => ({ min: b.min.map((v) => v - by) as Box["min"], max: b.max.map((v) => v + by) as Box["max"] });
const rank: Record<SdfClass, number> = { exact: 0, bound: 1, scalar: 2 };
const worse = (a: SdfClass, b: SdfClass): SdfClass => (rank[a] >= rank[b] ? a : b);
/** Combining fields loses exactness but keeps a bound; an unknown field stays unknown. */
const combined = (cls: readonly SdfClass[]): SdfClass => (cls.some((c) => c === "scalar") ? "scalar" : "bound");

/** Rotation `Ry(ry) Rx(rx) Rz(rz)` (degrees) as a row-major 3x3; exact at multiples of 90 degrees. */
function rotation(rx: number, ry: number, rz: number): number[] {
  const sc = (d: number): [number, number] => {
    const m = ((d % 360) + 360) % 360;
    if (m === 0) return [0, 1]; if (m === 90) return [1, 0]; if (m === 180) return [0, -1]; if (m === 270) return [-1, 0];
    return [Math.sin(d * DEG), Math.cos(d * DEG)];
  };
  const [sx, cx] = sc(rx), [sy, cy] = sc(ry), [sz, cz] = sc(rz);
  const X = [1, 0, 0, 0, cx, -sx, 0, sx, cx], Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const mul = (A: number[], B: number[]) => {
    const C = new Array<number>(9).fill(0);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) C[r * 3 + c] += A[r * 3 + k] * B[k * 3 + c];
    return C.map((v) => v + 0);
  };
  return mul(Y, mul(X, Z));
}

function analyze(input: unknown, path: string, depth: number, tally: { count: number }): Info {
  if (input === null || typeof input !== "object") fail(path, "?", "must be a node object");
  const raw = input as { kind?: unknown } & Record<string, unknown>;
  const kind = raw.kind as string;
  if (depth > SDF_LIMITS.maxDepth) fail(path, String(kind), `nesting exceeds depth ${SDF_LIMITS.maxDepth}`);
  if (++tally.count > SDF_LIMITS.maxNodes) fail(path, String(kind), `the tree has more than ${SDF_LIMITS.maxNodes} nodes; simplify it`);
  const sub = (child: unknown, name: string): Info => analyze(child, `${path}.${name}`, depth + 1, tally);
  const make = (node: SdfNode, kids: readonly Info[], box: Box, cls: SdfClass, cost: number): Info =>
    ({ node: Object.freeze(node) as SdfNode, path, kids, box, cls, cost, count: 1 + kids.reduce((n, k) => n + k.count, 0), depth: 1 + Math.max(0, ...kids.map((k) => k.depth)) });
  const n = (name: string, min?: number, max?: number, inclusive?: boolean) => num(path, kind, name, raw[name], min, max, inclusive);
  switch (kind) {
    case "sphere": {
      const radius = n("radius", 0, Infinity, false);
      const center = raw.center === undefined ? Object.freeze([0, 0, 0]) as unknown as Vec3 : vec(path, kind, "center", raw.center);
      const box: Box = { min: center.map((v) => v - radius) as Box["min"], max: center.map((v) => v + radius) as Box["max"] };
      return make({ kind, radius, center }, [], box, "exact", 1);
    }
    case "box": {
      const half = vec(path, kind, "half", raw.half, true);
      if (half.some((h) => h <= 0)) fail(path, kind, "half extents must be positive");
      const round = raw.round === undefined ? 0 : n("round", 0, Math.min(...half));
      return make({ kind, half, round }, [], { min: half.map((h) => -h) as Box["min"], max: [...half] as Box["max"] }, "exact", 1);
    }
    case "torus": {
      const major = n("major", 0, Infinity, false), minor = n("minor", 0, Infinity, false);
      return make({ kind, major, minor }, [], { min: [-(major + minor), -minor, -(major + minor)], max: [major + minor, minor, major + minor] }, "exact", 1);
    }
    case "capsule": {
      const from = vec(path, kind, "from", raw.from), to = vec(path, kind, "to", raw.to), radius = n("radius", 0, Infinity, false);
      const box: Box = { min: [0, 1, 2].map((i) => Math.min(from[i], to[i]) - radius) as Box["min"], max: [0, 1, 2].map((i) => Math.max(from[i], to[i]) + radius) as Box["max"] };
      return make({ kind, from, to, radius }, [], box, "exact", 1);
    }
    case "cylinder": {
      const radius = n("radius", 0, Infinity, false), halfHeight = n("halfHeight", 0, Infinity, false);
      return make({ kind, radius, halfHeight }, [], { min: [-radius, -halfHeight, -radius], max: [radius, halfHeight, radius] }, "exact", 1);
    }
    case "place": {
      const child = sub(raw.child, "0");
      const translate = raw.translate === undefined ? Object.freeze([0, 0, 0]) as unknown as Vec3 : vec(path, kind, "translate", raw.translate);
      const rotate = raw.rotate === undefined ? Object.freeze([0, 0, 0]) as unknown as Vec3 : vec(path, kind, "rotate", raw.rotate);
      const scale = raw.scale === undefined ? 1 : n("scale", 0, Infinity, false);
      const M = rotation(rotate[0], rotate[1], rotate[2]), box = emptyBox();
      for (let c = 0; c < 8; c++) {
        const corner = [c & 1 ? child.box.max[0] : child.box.min[0], c & 2 ? child.box.max[1] : child.box.min[1], c & 4 ? child.box.max[2] : child.box.min[2]];
        for (let r = 0; r < 3; r++) {
          const v = scale * (M[r * 3] * corner[0] + M[r * 3 + 1] * corner[1] + M[r * 3 + 2] * corner[2]) + translate[r];
          box.min[r] = Math.min(box.min[r], v); box.max[r] = Math.max(box.max[r], v);
        }
      }
      return make({ kind, child: child.node, translate, rotate, scale }, [child], box, child.cls, child.cost + 0.25);
    }
    case "union": case "intersection": {
      const list = children(path, kind, "children", raw.children, 2);
      const kids = list.map((c, i) => sub(c, String(i)));
      let box: Box;
      if (kind === "union") box = unionBox(kids.map((k) => k.box));
      else {
        box = emptyBox();
        for (let i = 0; i < 3; i++) { box.min[i] = Math.max(...kids.map((k) => k.box.min[i])); box.max[i] = Math.min(...kids.map((k) => k.box.max[i])); }
        if ([0, 1, 2].some((i) => box.min[i] >= box.max[i])) fail(path, kind, "the children's bounding boxes do not overlap, so the intersection is empty");
      }
      return make({ kind, children: Object.freeze(kids.map((k) => k.node)) } as SdfNode, kids, box, combined(kids.map((k) => k.cls)), kids.reduce((s, k) => s + k.cost, 0) + 0.1 * kids.length);
    }
    case "smoothUnion": {
      const list = children(path, kind, "children", raw.children, 2), k = n("k", 0, Infinity, false);
      const kids = list.map((c, i) => sub(c, String(i)));
      return make({ kind, children: Object.freeze(kids.map((x) => x.node)), k }, kids, grow(unionBox(kids.map((x) => x.box)), k / 4), combined(kids.map((x) => x.cls)), kids.reduce((s, x) => s + x.cost, 0) + 0.2 * kids.length);
    }
    case "subtract": {
      const base = sub(raw.base, "base");
      const cuts = children(path, kind, "cuts", raw.cuts, 1).map((c, i) => sub(c, `cut${i}`));
      const kids = [base, ...cuts];
      return make({ kind, base: base.node, cuts: Object.freeze(cuts.map((c) => c.node)) }, kids, base.box, combined(kids.map((x) => x.cls)), kids.reduce((s, x) => s + x.cost, 0) + 0.1 * kids.length);
    }
    case "shell": {
      const child = sub(raw.child, "0"), thickness = n("thickness", 0, Infinity, false);
      return make({ kind, child: child.node, thickness }, [child], grow(child.box, thickness / 2), combined([child.cls]), child.cost + 0.1);
    }
    case "repeat": {
      const child = sub(raw.child, "0");
      const spacing = vec(path, kind, "spacing", raw.spacing, true);
      if (!Array.isArray(raw.counts) || raw.counts.length !== 3) fail(path, kind, "counts must be three integers");
      const counts = [0, 1, 2].map((i) => {
        const c = (raw.counts as unknown[])[i];
        if (!Number.isInteger(c) || (c as number) < 1 || (c as number) > SDF_LIMITS.maxRepeatCount) fail(path, kind, `counts[${i}] must be an integer in [1, ${SDF_LIMITS.maxRepeatCount}] (got ${String(c)})`);
        return c as number;
      }) as unknown as [number, number, number];
      let keep: { seed: number; probability: number } | undefined;
      if (raw.keep !== undefined) {
        const k = raw.keep as { seed?: unknown; probability?: unknown };
        if (k === null || typeof k !== "object" || !Number.isSafeInteger(k.seed) || (k.seed as number) < 0 || (k.seed as number) > 0xffffffff) fail(path, kind, "keep.seed must be a uint32 integer");
        keep = Object.freeze({ seed: k.seed as number, probability: num(path, kind, "keep.probability", k.probability, 0, 1) });
      }
      const half: number[] = [];
      for (let a = 0; a < 3; a++) {
        const h = Math.max(Math.abs(child.box.min[a]), Math.abs(child.box.max[a]));
        if (counts[a] > 1 && spacing[a] <= 0) fail(path, kind, `spacing[${a}] must be positive`);
        if (counts[a] > 1 && h > spacing[a] / 2 + 1e-12) fail(path, kind, `the child extends ${h} from its centre along ${"xyz"[a]}, more than half the spacing ${spacing[a]}: copies would overlap and the field would no longer bound the distance; raise the spacing or shrink the child`);
        half.push((counts[a] - 1) * spacing[a] / 2 + h);
      }
      const cls = counts[0] * counts[1] * counts[2] === 1 && keep === undefined ? child.cls : combined([child.cls]);
      return make({ kind, child: child.node, spacing, counts: Object.freeze(counts) as unknown as [number, number, number], ...(keep ? { keep } : {}) }, [child],
        { min: half.map((h) => -h) as Box["min"], max: half as Box["max"] }, cls, child.cost + 1);
    }
    case "twist": case "bend": {
      const child = sub(raw.child, "0"), rate = n("rate");
      const rho = (a: number, b: number) => Math.max(...[child.box.min[a], child.box.max[a]].flatMap((u) => [child.box.min[b], child.box.max[b]].map((v) => Math.hypot(u, v))));
      const box: Box = rate === 0 ? child.box : kind === "twist"
        ? (() => { const r = rho(0, 2); return { min: [-r, child.box.min[1], -r], max: [r, child.box.max[1], r] } as Box; })()
        : (() => { const r = rho(0, 1); return { min: [-r, -r, child.box.min[2]], max: [r, r, child.box.max[2]] } as Box; })();
      return make({ kind, child: child.node, rate }, [child], box, rate === 0 ? child.cls : combined([child.cls]), child.cost + 1.5);
    }
    case "fold": {
      const child = sub(raw.child, "0");
      if (raw.fold !== "menger" && raw.fold !== "tetra") fail(path, kind, `fold must be "menger" or "tetra" (got ${String(raw.fold)})`);
      const iterations = raw.iterations;
      if (!Number.isInteger(iterations) || (iterations as number) < 0 || (iterations as number) > SDF_LIMITS.maxFoldIterations)
        fail(path, kind, `iterations must be an integer in [0, ${SDF_LIMITS.maxFoldIterations}] (got ${String(iterations)}); the cap bounds the work`);
      const its = iterations as number, s = raw.fold === "menger" ? 3 : 2;
      const e = Math.max(...child.box.min.map(Math.abs), ...child.box.max.map(Math.abs));
      const H = its === 0 ? e : 1 + (e - 1) * s ** -its;
      const box: Box = its === 0 ? child.box : { min: [-H, -H, -H], max: [H, H, H] };
      return make({ kind, child: child.node, fold: raw.fold, iterations: its }, [child], box, its === 0 ? child.cls : combined([child.cls]), child.cost + its * 0.3);
    }
    case "field": {
      if (typeof raw.id !== "string" || raw.id.length === 0) fail(path, kind, "id must be a non-empty string");
      if (typeof raw.evaluate !== "function") fail(path, kind, "evaluate must be a function (x, y, z) => number");
      const b = raw.bounds as { min?: unknown; max?: unknown } | undefined;
      if (!b || typeof b !== "object") fail(path, kind, "bounds {min, max} are required: the sampled region of a field must be declared");
      const min = vec(path, kind, "bounds.min", b!.min), max = vec(path, kind, "bounds.max", b!.max);
      if ([0, 1, 2].some((i) => min[i] >= max[i])) fail(path, kind, "bounds.min must be below bounds.max on every axis");
      const lipschitz = raw.lipschitz === undefined ? undefined : n("lipschitz", 0, Infinity, false);
      return make({ kind, id: raw.id, evaluate: raw.evaluate as SdfFn, bounds: Object.freeze({ min, max }), ...(lipschitz === undefined ? {} : { lipschitz }) } as SdfNode, [],
        { min: [...min], max: [...max] }, lipschitz === undefined ? "scalar" : "bound", 4);
    }
    default:
      return fail(path, String(kind), `unknown node kind "${String(kind)}"`);
  }
}

// ---------------------------------------------------------------------------------------------
// Compilation

/** Lipschitz constant of a twist by `rate` over a ball of radius `r`: Jacobian R(I + w e_y^T), |w| = |rate| r, w perpendicular to e_y. */
export const twistLipschitz = (rate: number, r: number): number => { const m = Math.abs(rate) * r; return (m + Math.sqrt(m * m + 4)) / 2; };
/** Lipschitz constant of a bend by `rate` over a ball of radius `r`: Jacobian R(I + w e_x^T), |w| <= |rate| r. */
export const bendLipschitz = (rate: number, r: number): number => 1 + Math.abs(rate) * r;

const sqrt = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;

function compile(info: Info, R: number): SdfFn {
  const node = info.node as unknown as Record<string, any>;
  const kids = info.kids;
  switch (node.kind) {
    case "sphere": {
      const [cx, cy, cz] = node.center, r = node.radius;
      return cx === 0 && cy === 0 && cz === 0 ? (x, y, z) => sqrt(x * x + y * y + z * z) - r
        : (x, y, z) => { const dx = x - cx, dy = y - cy, dz = z - cz; return sqrt(dx * dx + dy * dy + dz * dz) - r; };
    }
    case "box": {
      const [hx, hy, hz] = node.half, r = node.round;
      return (x, y, z) => {
        const qx = abs(x) - hx + r, qy = abs(y) - hy + r, qz = abs(z) - hz + r;
        const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
        return sqrt(ox * ox + oy * oy + oz * oz) + min(max(qx, qy, qz), 0) - r;
      };
    }
    case "torus": {
      const { major, minor } = node;
      return (x, y, z) => { const l = sqrt(x * x + z * z) - major; return sqrt(l * l + y * y) - minor; };
    }
    case "capsule": {
      const [ax, ay, az] = node.from, [bx, by, bz] = node.to, r = node.radius;
      const ex = bx - ax, ey = by - ay, ez = bz - az, ee = ex * ex + ey * ey + ez * ez;
      return (x, y, z) => {
        const px = x - ax, py = y - ay, pz = z - az;
        const h = ee === 0 ? 0 : max(0, min(1, (px * ex + py * ey + pz * ez) / ee));
        const dx = px - ex * h, dy = py - ey * h, dz = pz - ez * h;
        return sqrt(dx * dx + dy * dy + dz * dz) - r;
      };
    }
    case "cylinder": {
      const r = node.radius, hh = node.halfHeight;
      return (x, y, z) => {
        const dx = sqrt(x * x + z * z) - r, dy = abs(y) - hh;
        const ox = dx > 0 ? dx : 0, oy = dy > 0 ? dy : 0;
        return min(max(dx, dy), 0) + sqrt(ox * ox + oy * oy);
      };
    }
    case "place": {
      const [tx, ty, tz] = node.translate, s = node.scale, M = rotation(node.rotate[0], node.rotate[1], node.rotate[2]);
      const child = compile(kids[0], (R + Math.hypot(tx, ty, tz)) / s);
      const identity = M[0] === 1 && M[4] === 1 && M[8] === 1;
      if (identity) return s === 1 ? (x, y, z) => child(x - tx, y - ty, z - tz) : (x, y, z) => s * child((x - tx) / s, (y - ty) / s, (z - tz) / s);
      return (x, y, z) => {
        const dx = x - tx, dy = y - ty, dz = z - tz;
        return s * child((M[0] * dx + M[3] * dy + M[6] * dz) / s, (M[1] * dx + M[4] * dy + M[7] * dz) / s, (M[2] * dx + M[5] * dy + M[8] * dz) / s);
      };
    }
    case "union": {
      const f = kids.map((k) => compile(k, R)), n = f.length;
      return (x, y, z) => { let d = f[0](x, y, z); for (let i = 1; i < n; i++) { const e = f[i](x, y, z); if (e < d) d = e; } return d; };
    }
    case "intersection": {
      const f = kids.map((k) => compile(k, R)), n = f.length;
      return (x, y, z) => { let d = f[0](x, y, z); for (let i = 1; i < n; i++) { const e = f[i](x, y, z); if (e > d) d = e; } return d; };
    }
    case "subtract": {
      const f = kids.map((k) => compile(k, R)), n = f.length;
      return (x, y, z) => { let d = f[0](x, y, z); for (let i = 1; i < n; i++) { const e = -f[i](x, y, z); if (e > d) d = e; } return d; };
    }
    case "smoothUnion": {
      const f = kids.map((k) => compile(k, R)), n = f.length, k = node.k;
      return (x, y, z) => {
        let d = f[0](x, y, z);
        for (let i = 1; i < n; i++) { const e = f[i](x, y, z), h = max(k - abs(d - e), 0) / k; d = min(d, e) - h * h * k * 0.25; }
        return d;
      };
    }
    case "shell": {
      const child = compile(kids[0], R), half = node.thickness / 2;
      return (x, y, z) => abs(child(x, y, z)) - half;
    }
    case "repeat": {
      const [sx, sy, sz] = node.spacing as Vec3, [nx, ny, nz] = node.counts as [number, number, number];
      const cmax = Math.hypot(((nx - 1) * sx) / 2, ((ny - 1) * sy) / 2, ((nz - 1) * sz) / 2);
      const child = compile(kids[0], R + cmax);
      const cb = kids[0].box;
      const hx = max(abs(cb.min[0]), abs(cb.max[0])), hy = max(abs(cb.min[1]), abs(cb.max[1])), hz = max(abs(cb.min[2]), abs(cb.max[2]));
      const keep = node.keep as { seed: number; probability: number } | undefined;
      const seed = keep?.seed ?? 0, prob = keep?.probability ?? 1;
      // Distance from coordinate u (in cell i of n cells, spacing s, half extent h) to the nearest existing neighbour slab.
      const slab = (u: number, i: number, cnt: number, s: number, h: number): number => {
        let e = Infinity;
        if (i > 0) { const lo = -s - h, hi = -s + h; e = min(e, max(0, lo - u, u - hi)); }
        if (i < cnt - 1) { const lo = s - h, hi = s + h; e = min(e, max(0, lo - u, u - hi)); }
        return e;
      };
      return (x, y, z) => {
        const ix = nx === 1 ? 0 : max(0, min(nx - 1, Math.round(x / sx + (nx - 1) / 2)));
        const iy = ny === 1 ? 0 : max(0, min(ny - 1, Math.round(y / sy + (ny - 1) / 2)));
        const iz = nz === 1 ? 0 : max(0, min(nz - 1, Math.round(z / sz + (nz - 1) / 2)));
        const qx = nx === 1 ? x : x - (ix - (nx - 1) / 2) * sx, qy = ny === 1 ? y : y - (iy - (ny - 1) / 2) * sy, qz = nz === 1 ? z : z - (iz - (nz - 1) / 2) * sz;
        let b = Infinity;
        if (nx > 1) b = min(b, slab(qx, ix, nx, sx, hx));
        if (ny > 1) b = min(b, slab(qy, iy, ny, sy, hy));
        if (nz > 1) b = min(b, slab(qz, iz, nz, sz, hz));
        const present = prob >= 1 || componentSeed(seed, `${ix},${iy},${iz}`, "keep") / 4294967296 < prob;
        return present ? min(child(qx, qy, qz), b) : b;
      };
    }
    case "twist": {
      const rate = node.rate;
      if (rate === 0) return compile(kids[0], R);
      const L = twistLipschitz(rate, R), child = compile(kids[0], R);
      return (x, y, z) => { const a = rate * y, c = Math.cos(a), s = Math.sin(a); return child(c * x + s * z, y, -s * x + c * z) / L; };
    }
    case "bend": {
      const rate = node.rate;
      if (rate === 0) return compile(kids[0], R);
      const L = bendLipschitz(rate, R), child = compile(kids[0], R);
      return (x, y, z) => { const a = rate * x, c = Math.cos(a), s = Math.sin(a); return child(c * x - s * y, s * x + c * y, z) / L; };
    }
    case "fold": {
      const n = node.iterations as number;
      if (n === 0) return compile(kids[0], R);
      if (node.fold === "menger") {
        const child = compile(kids[0], 3 ** n * R + 2 * Math.sqrt(3) * (3 ** n - 1) / 2), scale = 3 ** -n;
        return (x, y, z) => {
          let px = x, py = y, pz = z;
          for (let i = 0; i < n; i++) {
            px = abs(px); py = abs(py); pz = abs(pz);
            let t: number;
            if (px < py) { t = px; px = py; py = t; }
            if (py < pz) { t = py; py = pz; pz = t; }
            if (px < py) { t = px; px = py; py = t; }
            px = 3 * px - 2; py = 3 * py - 2; pz = pz > 1 / 3 ? 3 * pz - 2 : 3 * pz;
          }
          return child(px, py, pz) * scale;
        };
      }
      const child = compile(kids[0], 2 ** n * R + Math.sqrt(3) * (2 ** n - 1)), scale = 2 ** -n;
      return (x, y, z) => {
        let px = x, py = y, pz = z, t: number;
        for (let i = 0; i < n; i++) {
          if (px + py < 0) { t = px; px = -py; py = -t; }
          if (px + pz < 0) { t = px; px = -pz; pz = -t; }
          if (py + pz < 0) { t = py; py = -pz; pz = -t; }
          px = 2 * px - 1; py = 2 * py - 1; pz = 2 * pz - 1;
        }
        return child(px, py, pz) * scale;
      };
    }
    case "field": {
      const f = node.evaluate as SdfFn, L = node.lipschitz as number | undefined, id = node.id;
      return (x, y, z) => {
        const v = f(x, y, z);
        if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`SDF field "${id}" returned ${String(v)} at (${x}, ${y}, ${z}); fields must be finite`);
        return L === undefined ? v : v / L;
      };
    }
    default:
      throw new Error(`SDF: unknown node kind ${(node as { kind: string }).kind}`);
  }
}

function canonical(node: SdfNode): unknown {
  const n = node as unknown as Record<string, any>;
  if (n.kind === "field") {
    if (!fieldIds.has(n.evaluate)) fieldIds.set(n.evaluate, ++fieldCounter);
    return { kind: "field", id: n.id, fn: fieldIds.get(n.evaluate), bounds: n.bounds, lipschitz: n.lipschitz ?? null };
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(n)) {
    const v = n[key];
    out[key] = key === "child" || key === "base" ? canonical(v) : key === "children" || key === "cuts" ? (v as SdfNode[]).map(canonical) : v;
  }
  return out;
}

const cache = new Map<string, Sdf>();
const utf8 = new TextEncoder();

/** Validate, freeze and compile a tree (see the module header for semantics and limits). Equal trees give the same object. */
export function sdf(root: SdfNode): Sdf {
  const tally = { count: 0 };
  const info = analyze(root, "0", 1, tally);
  const key = `sdf:${sha256Hex(utf8.encode(JSON.stringify(canonical(info.node))))}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const { min: lo, max: hi } = info.box;
  const center = Object.freeze([0, 1, 2].map((i) => (lo[i] + hi[i]) / 2 + 0)) as unknown as Vec3;
  const radius = Math.hypot(...[0, 1, 2].map((i) => (hi[i] - lo[i]) / 2)) * 1.03;
  if (!(radius > 0) || !Number.isFinite(radius)) throw new Error("SDF bounds are empty or not finite");
  const region = Math.hypot(...center) + radius;
  const distance = compile(info, region);
  const value: Sdf = Object.freeze({
    key, root: info.node, class: info.cls, nodeCount: info.count, depth: info.depth, cost: info.cost,
    bounds: Object.freeze({ min: Object.freeze([...lo]) as unknown as Vec3, max: Object.freeze([...hi]) as unknown as Vec3 }), center, radius, region, distance,
    normal(x: number, y: number, z: number, h: number): Vec3 | null {
      // Tetrahedron technique: gradient from four samples at (1,-1,-1), (-1,-1,1), (-1,1,-1), (1,1,1).
      const a = distance(x + h, y - h, z - h), b = distance(x - h, y - h, z + h), c = distance(x - h, y + h, z - h), d = distance(x + h, y + h, z + h);
      const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d, l = sqrt(gx * gx + gy * gy + gz * gz);
      return l > 0 ? [gx / l, gy / l, gz / l] : null;
    },
  });
  cache.set(key, value);
  if (cache.size > 32) cache.delete(cache.keys().next().value!);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Builders: plain functions returning nodes, for direct use.

export const sdfSphere = (radius: number, center?: Vec3): SdfNode => ({ kind: "sphere", radius, ...(center ? { center } : {}) });
export const sdfBox = (half: Vec3, round = 0): SdfNode => ({ kind: "box", half, round });
export const sdfTorus = (major: number, minor: number): SdfNode => ({ kind: "torus", major, minor });
export const sdfCapsule = (from: Vec3, to: Vec3, radius: number): SdfNode => ({ kind: "capsule", from, to, radius });
export const sdfCylinder = (radius: number, halfHeight: number): SdfNode => ({ kind: "cylinder", radius, halfHeight });
export const sdfPlace = (child: SdfNode, placement: { translate?: Vec3; rotate?: Vec3; scale?: number } = {}): SdfNode => ({ kind: "place", child, ...placement });
export const sdfUnion = (...children: SdfNode[]): SdfNode => ({ kind: "union", children });
export const sdfIntersection = (...children: SdfNode[]): SdfNode => ({ kind: "intersection", children });
export const sdfSubtract = (base: SdfNode, ...cuts: SdfNode[]): SdfNode => ({ kind: "subtract", base, cuts });
export const sdfSmoothUnion = (k: number, ...children: SdfNode[]): SdfNode => ({ kind: "smoothUnion", children, k });
export const sdfShell = (child: SdfNode, thickness: number): SdfNode => ({ kind: "shell", child, thickness });
export const sdfRepeat = (child: SdfNode, spacing: Vec3, counts: readonly [number, number, number], keep?: { seed: number; probability: number }): SdfNode =>
  ({ kind: "repeat", child, spacing, counts, ...(keep ? { keep } : {}) });
export const sdfTwist = (child: SdfNode, rate: number): SdfNode => ({ kind: "twist", child, rate });
export const sdfBend = (child: SdfNode, rate: number): SdfNode => ({ kind: "bend", child, rate });
export const sdfFold = (child: SdfNode, fold: SdfFold, iterations: number): SdfNode => ({ kind: "fold", child, fold, iterations });
/** A caller's scalar field. Without `lipschitz` it is a general scalar field: meshable, never marchable. */
export const sdfField = (id: string, evaluate: SdfFn, bounds: { min: Vec3; max: Vec3 }, lipschitz?: number): SdfNode =>
  ({ kind: "field", id, evaluate, bounds, ...(lipschitz === undefined ? {} : { lipschitz }) });
