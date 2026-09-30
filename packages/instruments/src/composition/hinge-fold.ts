import { componentSeed } from "./core.js";
import type { Hinge, PanelTiling } from "./hinge-tiling.js";
import type { Vec3 } from "./mesh.js";
import { sha256Hex } from "./raster.js";
import { memoized } from "./sources.js";

/*
 * Hinge fold model: angle fields and rigid forward kinematics on a spanning forest.
 *
 * Inputs   A `PanelTiling` (flat panels and hinges) and either an explicit signed angle per hinge
 *          (`ArrayLike<number>`, degrees; the direct API) or a `FoldFieldOptions` rule that produces them.
 * Fields   `stripes` is `cos(2 pi t / period + phase)` in `t`, the distance along `stripeAngle` from the sheet's lower-left
 *          corner (so hinge rows land on whole numbers and period 2 alternates mountain and valley); `radial` is the same
 *          wave in distance from the sheet centre; `checker` alternates the sign every `period` cells; `seeded` gives
 *          each hinge `angle * (2u - 1)` from `componentSeed(seed, hinge id, "fold")`. `disorder` blends any of the first
 *          four toward that seeded value. All are scaled by `amount`.
 * Angles   A hinge's angle is the signed DIHEDRAL angle between its two panels, in degrees, with the mesh
 *          convention of `meshEdgeAngle`: positive is a ridge (a mountain fold: both fronts turn away from the
 *          viewer above the sheet), negative a valley, 0 flat. Magnitudes are bounded by `MAX_FOLD_ANGLE` (179):
 *          exactly 180 would lay one panel on the other. A hinge the rule does not select has angle 0: it stays a
 *          rigid flat joint.
 * Model    Each panel is a rigid body. A pose is a proper rotation `R` and a translation `t` mapping a flat point
 *          `(u, v)`, placed at `(u, 0, -v)`, to world space. The anchored panels (roots) keep the identity pose.
 *          A child panel across a hinge from a posed panel `P` has `T_C = T_P . Rot(axis, -theta)`, `Rot` a
 *          rotation of the FLAT plane about the hinge's own line, so the hinge's two ends have the same world
 *          position through both panels and the dihedral angle equals `theta` exactly (up to rounding).
 * Cycles   A hinge graph with cycles cannot honour every hinge: the tiling's closure conditions (e.g. the angles
 *          around a vertex) generally fail. The policy is: fold ONLY along a spanning forest, and report every other
 *          hinge. For a non-tree hinge the report holds `gap`, the larger distance between the two panels' images of
 *          the hinge's ends, and `achieved`, the dihedral angle the panels really make when the ends do meet:
 *          `realized` (ends meet, angle as requested within `ANGLE_TOLERANCE`), `off-angle` (ends meet at another
 *          angle: the request is in conflict with the tree) or `open` (ends do not meet: a crack). Nothing is
 *          adjusted to hide a conflict, and self-intersection of the posed panels is not detected.
 * Forest   `tree: "breadth"` grows from the roots hinge by hinge in order of distance (few folds compound, so
 *          errors and the drawn cracks stay far from the anchors); `"strongest"` takes the largest |angle| first, so
 *          the deepest folds are the ones honoured. Ties follow discovery order, which follows hinge index; both are
 *          deterministic. Panels not reachable from an anchor (retention islands) become extra flat roots
 *          (`strays`).
 * Anchors  `anchors` roots: the first by `anchor` (`center` panel nearest the bounds centre, `corner` nearest the
 *          lower-left corner, `seeded` the smallest `componentSeed(seed, id, "anchor")`), the rest by farthest
 *          point among panel centroids. Distinct anchors are all flat, so hinges between two anchors' trees are
 *          usually conflicts, which is the point.
 * Units    Edge units of the tiling for lengths; degrees for angles.
 * Work     Linear in panels and hinges (a heap over the frontier). Cached by tiling key and angle content.
 */

export const MAX_FOLD_ANGLE = 179;
/** Degrees within which a closed non-tree hinge is `realized`. */
export const ANGLE_TOLERANCE = 1e-6;
export const MAX_ANCHORS = 16;
export const FOLD_RULES = ["uniform", "stripes", "radial", "checker", "seeded"] as const;
export type FoldRule = (typeof FOLD_RULES)[number];
/** Half-width in degrees of the window `select: "axis"` takes around an axis direction. */
export const AXIS_WINDOW = 18;
const U32 = 0x1_0000_0000;

export interface FoldFieldOptions {
  readonly seed: number;
  readonly rule: FoldRule;
  /** Peak |angle| in degrees, 0 to `MAX_FOLD_ANGLE`. */
  readonly angle: number;
  /** Sign of the base fold: `mountain` is positive. */
  readonly direction: "mountain" | "valley";
  /** Wavelength (stripes, radial) or cell (checker) in edge units, positive. */
  readonly period: number;
  /** Stripes vary along this direction (degrees from +u). */
  readonly stripeAngle: number;
  /** Wave phase in degrees: 0 puts a crest (the full angle) at the wave's origin. */
  readonly phase: number;
  /** Blend toward a random angle per hinge, 0 (the rule alone) to 1 (a seeded angle). Ignored by the `seeded` rule. */
  readonly disorder: number;
  /** Fold progress: every angle is multiplied by this, 0 to 1. 0 is the flat sheet. */
  readonly amount: number;
  /** Which hinges fold at all. */
  readonly select: "all" | "axis" | "share";
  /** `axis`: hinges whose axis lies within `AXIS_WINDOW` degrees of this direction (mod 180). */
  readonly axis: number;
  /** `share`: probability that a hinge folds, chosen independently per hinge. */
  readonly share: number;
}

export interface ClosureOptions {
  readonly seed: number;
  readonly anchor: "center" | "corner" | "seeded";
  readonly anchors: number;
  readonly tree: "breadth" | "strongest";
}

export type HingeKind = "tree" | "realized" | "off-angle" | "open";
export interface HingeReport {
  readonly kind: HingeKind;
  /** The requested signed dihedral angle. */
  readonly requested: number;
  /** The signed dihedral angle the posed panels make; NaN for an `open` hinge. Equals `requested` for `tree`. */
  readonly achieved: number;
  /** Larger distance between the two panels' images of the hinge's ends (0 for a tree hinge). */
  readonly gap: number;
}
export interface FoldCounts {
  readonly panels: number;
  readonly hinges: number;
  /** Hinges the forest folds along. */
  readonly tree: number;
  /** Tree hinges with a nonzero angle. */
  readonly folded: number;
  readonly realized: number;
  readonly offAngle: number;
  readonly open: number;
  readonly roots: number;
  readonly strays: number;
}
export interface FoldedPanels {
  readonly key: string;
  readonly tiling: PanelTiling;
  /** Requested signed angle per hinge, degrees (a private copy). */
  readonly angles: Float64Array;
  /** Parent panel of each panel (-1 for a root). */
  readonly parent: Int32Array;
  /** Tree hinge to the parent (-1 for a root). */
  readonly parentHinge: Int32Array;
  /** Hinges from the root. */
  readonly depth: Int32Array;
  /** Panels root-first: every panel appears after its parent. */
  readonly order: Int32Array;
  readonly roots: readonly number[];
  /** The first `anchors` of `roots` are anchors; the rest are strays. */
  readonly anchors: number;
  /** 12 numbers per panel: row-major rotation (0..8), translation (9..11). */
  readonly pose: Float64Array;
  readonly treeHinges: readonly number[];
  readonly report: readonly HingeReport[];
  readonly counts: FoldCounts;
  /** Distance below which two positions count as the same point. */
  readonly tolerance: number;
}

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const cache = new Map<string, FoldedPanels>();
const angleCache = new Map<string, Float64Array>();

function requireNumber(label: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a number in [${min}, ${max}] (got ${String(value)})`);
}

/** The signed angle each hinge is asked to fold to, per the rule (see `FoldFieldOptions`). */
export function hingeAngles(tiling: PanelTiling, options: FoldFieldOptions): Float64Array {
  const { seed, rule, angle, direction, period, stripeAngle, phase, disorder, amount, select, axis, share } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Fold seed must be a uint32 integer");
  if (!(FOLD_RULES as readonly string[]).includes(rule)) throw new Error(`Fold rule must be one of ${FOLD_RULES.join(", ")} (got ${String(rule)})`);
  if (direction !== "mountain" && direction !== "valley") throw new Error(`Fold direction must be "mountain" or "valley" (got ${String(direction)})`);
  if (select !== "all" && select !== "axis" && select !== "share") throw new Error(`Hinge selection must be "all", "axis" or "share" (got ${String(select)})`);
  requireNumber("Fold angle", angle, 0, MAX_FOLD_ANGLE);
  requireNumber("Fold amount", amount, 0, 1);
  requireNumber("Fold period", period, 1e-6, 1e6);
  requireNumber("Stripe angle", stripeAngle, -1e6, 1e6);
  requireNumber("Wave phase", phase, -1e6, 1e6);
  requireNumber("Disorder", disorder, 0, 1);
  requireNumber("Hinge axis", axis, -1e6, 1e6);
  requireNumber("Folding share", share, 0, 1);
  const key = JSON.stringify([tiling.key, options]);
  const hit = angleCache.get(key);
  if (hit) return hit;
  const { minU, maxU, minV, maxV } = tiling.bounds, cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const base = direction === "mountain" ? 1 : -1, a = stripeAngle * Math.PI / 180, ph = phase * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  const out = new Float64Array(tiling.hinges.length);
  for (const hinge of tiling.hinges) {
    let chosen = true;
    if (select === "axis") {
      const d = (((hinge.axis - axis) % 180) + 180) % 180;
      chosen = Math.min(d, 180 - d) <= AXIS_WINDOW + 1e-9;
    } else if (select === "share") chosen = unit(seed, hinge.id, "select") < share;
    if (!chosen) continue;
    const x = hinge.mid[0], y = hinge.mid[1];
    let field: number;
    switch (rule) {
      case "uniform": field = base; break;
      case "stripes": field = base * Math.cos(2 * Math.PI * ((x - minU) * ca + (y - minV) * sa) / period + ph); break;
      case "radial": field = base * Math.cos(2 * Math.PI * Math.hypot(x - cu, y - cv) / period + ph); break;
      case "checker": field = (Math.floor((x - minU) / period + 0.25) + Math.floor((y - minV) / period + 0.25)) % 2 === 0 ? 1 : -1; break;
      default: field = 2 * unit(seed, hinge.id, "fold") - 1;
    }
    if (rule !== "seeded" && disorder > 0) field = (1 - disorder) * field + disorder * (2 * unit(seed, hinge.id, "fold") - 1);
    out[hinge.index] = angle * amount * field + 0;
  }
  angleCache.set(key, out);
  if (angleCache.size > 16) angleCache.delete(angleCache.keys().next().value!);
  return out;
}

// ---- rigid poses -------------------------------------------------------------------------------

/** out = R_P * R_h and translation R_P (p - R_h p) + t_P, then re-orthonormalised. */
function compose(pose: Float64Array, parent: number, child: number, px: number, pz: number, dx: number, dz: number, phi: number): void {
  const c = Math.cos(phi), s = Math.sin(phi), k = 1 - c;
  // axis d = (dx, 0, dz), unit; Rodrigues: R = c I + k d d^T + s [d]x
  const r = [c + k * dx * dx, -s * dz, k * dx * dz,
    s * dz, c, -s * dx,
    k * dx * dz, s * dx, c + k * dz * dz];
  const o = parent * 12, m = child * 12;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    pose[m + i * 3 + j] = pose[o + i * 3] * r[j] + pose[o + i * 3 + 1] * r[3 + j] + pose[o + i * 3 + 2] * r[6 + j];
  }
  // p - R_h p with p = (px, 0, pz)
  const wx = px - (r[0] * px + r[2] * pz), wy = 0 - (r[3] * px + r[5] * pz), wz = pz - (r[6] * px + r[8] * pz);
  for (let i = 0; i < 3; i++) pose[m + 9 + i] = pose[o + i * 3] * wx + pose[o + i * 3 + 1] * wy + pose[o + i * 3 + 2] * wz + pose[o + 9 + i];
  // Gram-Schmidt on the columns keeps the rotation proper however deep the tree
  let c0x = pose[m], c0y = pose[m + 3], c0z = pose[m + 6];
  const n0 = Math.hypot(c0x, c0y, c0z);
  c0x /= n0; c0y /= n0; c0z /= n0;
  let c1x = pose[m + 1], c1y = pose[m + 4], c1z = pose[m + 7];
  const d01 = c0x * c1x + c0y * c1y + c0z * c1z;
  c1x -= d01 * c0x; c1y -= d01 * c0y; c1z -= d01 * c0z;
  const n1 = Math.hypot(c1x, c1y, c1z);
  c1x /= n1; c1y /= n1; c1z /= n1;
  pose[m] = c0x; pose[m + 3] = c0y; pose[m + 6] = c0z;
  pose[m + 1] = c1x; pose[m + 4] = c1y; pose[m + 7] = c1z;
  pose[m + 2] = c0y * c1z - c0z * c1y; pose[m + 5] = c0z * c1x - c0x * c1z; pose[m + 8] = c0x * c1y - c0y * c1x;
}

function identity(pose: Float64Array, panel: number): void {
  const m = panel * 12;
  pose.fill(0, m, m + 12);
  pose[m] = 1; pose[m + 4] = 1; pose[m + 8] = 1;
}

/** World position of the flat point `(u, v)` carried by `panel`. */
export function panelPoint(folded: FoldedPanels, panel: number, u: number, v: number): Vec3 {
  const p = folded.pose, m = panel * 12, z = -v;
  return [p[m] * u + p[m + 2] * z + p[m + 9] + 0, p[m + 3] * u + p[m + 5] * z + p[m + 10] + 0, p[m + 6] * u + p[m + 8] * z + p[m + 11] + 0];
}
/** World unit normal of the front of `panel` (flat +y through the pose). */
export function panelNormal(folded: FoldedPanels, panel: number): Vec3 {
  const p = folded.pose, m = panel * 12;
  return [p[m + 1] + 0, p[m + 4] + 0, p[m + 7] + 0];
}

interface Frontier { readonly key: number; readonly seq: number; readonly hinge: number; readonly from: number; readonly to: number }

class Heap {
  private items: Frontier[] = [];
  get size(): number { return this.items.length; }
  private less(a: Frontier, b: Frontier): boolean { return a.key < b.key || (a.key === b.key && a.seq < b.seq); }
  push(item: Frontier): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (!this.less(items[i], items[up])) break;
      [items[i], items[up]] = [items[up], items[i]];
      i = up;
    }
  }
  pop(): Frontier {
    const items = this.items, top = items[0], last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < items.length && this.less(items[l], items[m])) m = l;
        if (r < items.length && this.less(items[r], items[m])) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m], items[i]];
        i = m;
      }
    }
    return top;
  }
}

function chooseAnchors(tiling: PanelTiling, options: ClosureOptions): number[] {
  const { anchor, anchors, seed } = options, panels = tiling.panels;
  if (anchor !== "center" && anchor !== "corner" && anchor !== "seeded") throw new Error(`Anchor must be "center", "corner" or "seeded" (got ${String(anchor)})`);
  if (!Number.isInteger(anchors) || anchors < 1 || anchors > MAX_ANCHORS) throw new Error(`Anchors must be an integer in [1, ${MAX_ANCHORS}] (got ${String(anchors)})`);
  const { minU, maxU, minV, maxV } = tiling.bounds;
  let first = 0;
  if (anchor === "seeded") {
    let best = Infinity;
    for (const panel of panels) { const h = componentSeed(seed, panel.id, "anchor"); if (h < best) { best = h; first = panel.index; } }
  } else {
    const tu = anchor === "center" ? (minU + maxU) / 2 : minU, tv = anchor === "center" ? (minV + maxV) / 2 : minV;
    let best = Infinity;
    for (const panel of panels) { const d = Math.hypot(panel.centroid[0] - tu, panel.centroid[1] - tv); if (d < best - 1e-12) { best = d; first = panel.index; } }
  }
  const chosen = [first], nearest = new Float64Array(panels.length).fill(Infinity);
  while (chosen.length < Math.min(anchors, panels.length)) {
    const last = panels[chosen[chosen.length - 1]];
    let far = -1, farDistance = -1;
    for (const panel of panels) {
      nearest[panel.index] = Math.min(nearest[panel.index], Math.hypot(panel.centroid[0] - last.centroid[0], panel.centroid[1] - last.centroid[1]));
      if (nearest[panel.index] > farDistance + 1e-12) { farDistance = nearest[panel.index]; far = panel.index; }
    }
    chosen.push(far);
  }
  return chosen;
}

/** The signed dihedral angle of panels `a` and `b` about the axis `(ux, 0, uz)` oriented so `b` lies on its left. */
function poseAngle(pose: Float64Array, a: number, b: number, ux: number, uz: number): number {
  // Relative rotation Rel = R_a^T R_b applied to the left vector l = n x d = (uz, 0, -ux).
  const lx = uz, lz = -ux;
  const ra = a * 12, rb = b * 12;
  // R_b l
  const bx = pose[rb] * lx + pose[rb + 2] * lz, by = pose[rb + 3] * lx + pose[rb + 5] * lz, bz = pose[rb + 6] * lx + pose[rb + 8] * lz;
  // R_a^T (R_b l)
  const x = pose[ra] * bx + pose[ra + 3] * by + pose[ra + 6] * bz, y = pose[ra + 1] * bx + pose[ra + 4] * by + pose[ra + 7] * bz, z = pose[ra + 2] * bx + pose[ra + 5] * by + pose[ra + 8] * bz;
  // Rotation angle of l about d: cos = l . x, and since l = n x d, sin = d . (l x x) = y.
  return -Math.atan2(y, lx * x + lz * z) * 180 / Math.PI + 0;
}

/**
 * Fold the tiling: a spanning forest from the anchors, rigid poses, and a report on every hinge.
 * `angles` holds one signed dihedral angle per hinge (see the module header).
 */
export function foldPanels(tiling: PanelTiling, angles: ArrayLike<number>, closure: ClosureOptions): FoldedPanels {
  if (angles.length !== tiling.hinges.length) throw new Error(`foldPanels needs one angle per hinge: ${tiling.hinges.length} hinges, ${angles.length} angles`);
  const requested = new Float64Array(tiling.hinges.length);
  for (let i = 0; i < requested.length; i++) {
    const value = angles[i];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Fold angle of hinge "${tiling.hinges[i].id}" is not a finite number`);
    if (Math.abs(value) > MAX_FOLD_ANGLE) throw new Error(`Fold angle ${value} on hinge "${tiling.hinges[i].id}" exceeds ${MAX_FOLD_ANGLE} degrees: lower Fold angle`);
    requested[i] = value + 0;
  }
  if (closure.tree !== "breadth" && closure.tree !== "strongest") throw new Error(`Spanning tree must be "breadth" or "strongest" (got ${String(closure.tree)})`);
  const key = `${tiling.key}|${sha256Hex(new Uint8Array(requested.buffer))}|${closure.seed}|${closure.anchor}|${closure.anchors}|${closure.tree}`;
  return memoized(cache, key, () => build(tiling, requested, closure, key));
}

function build(tiling: PanelTiling, requested: Float64Array, closure: ClosureOptions, key: string): FoldedPanels {
  const n = tiling.panels.length, hinges = tiling.hinges;
  const parent = new Int32Array(n).fill(-1), parentHinge = new Int32Array(n).fill(-1), depth = new Int32Array(n);
  const posed = new Uint8Array(n), pose = new Float64Array(n * 12), order: number[] = [], treeSet = new Uint8Array(hinges.length);
  const anchorList = chooseAnchors(tiling, closure), roots: number[] = [];
  const heap = new Heap();
  let seq = 0;
  const strongest = closure.tree === "strongest";
  const enqueue = (panel: number): void => {
    for (const h of tiling.adjacency[panel]) {
      const [a, b] = hinges[h].panels, other = a === panel ? b : a;
      if (!posed[other]) heap.push({ key: strongest ? -Math.abs(requested[h]) : depth[panel] + 1, seq: seq++, hinge: h, from: panel, to: other });
    }
  };
  const root = (panel: number): void => {
    posed[panel] = 1; identity(pose, panel); roots.push(panel); order.push(panel); enqueue(panel);
  };
  const grow = (): void => {
    while (heap.size > 0) {
      const item = heap.pop();
      if (posed[item.to]) continue;
      const hinge = hinges[item.hinge], child = tiling.panels[item.to];
      // flat axis through p with direction d, oriented so the child lies on its left (left = (dz, 0, -dx))
      let dx = hinge.b[0] - hinge.a[0], dz = -(hinge.b[1] - hinge.a[1]);
      const length = Math.hypot(dx, dz);
      dx /= length; dz /= length;
      const px = hinge.a[0], pz = -hinge.a[1];
      const wx = child.centroid[0] - px, wz = -child.centroid[1] - pz;
      if (dz * wx - dx * wz < 0) { dx = -dx; dz = -dz; }
      compose(pose, item.from, item.to, px, pz, dx, dz, -requested[item.hinge] * Math.PI / 180);
      posed[item.to] = 1; parent[item.to] = item.from; parentHinge[item.to] = item.hinge; depth[item.to] = depth[item.from] + 1;
      treeSet[item.hinge] = 1; order.push(item.to);
      enqueue(item.to);
    }
  };
  for (const a of anchorList) root(a);
  grow();
  const strays: number[] = [];
  for (let panel = 0; panel < n; panel++) if (!posed[panel]) { root(panel); strays.push(panel); grow(); }

  const tolerance = 1e-9 * Math.max(1, tiling.diameter);
  const folded: FoldedPanels = { key, tiling, angles: requested, parent, parentHinge, depth, order: Int32Array.from(order), roots: Object.freeze(roots),
    anchors: anchorList.length, pose, treeHinges: [], report: [], counts: undefined as unknown as FoldCounts, tolerance };
  const report: HingeReport[] = [], tree: number[] = [];
  let realized = 0, offAngle = 0, open = 0, foldedCount = 0;
  for (const hinge of hinges) {
    const [a, b] = hinge.panels;
    if (treeSet[hinge.index]) {
      tree.push(hinge.index);
      if (requested[hinge.index] !== 0) foldedCount++;
      const achieved = achievedAngle2(pose, tiling, hinge);
      report.push(Object.freeze({ kind: "tree" as const, requested: requested[hinge.index], achieved, gap: 0 }));
      continue;
    }
    const pa = panelPoint(folded, a, hinge.a[0], hinge.a[1]), pb = panelPoint(folded, b, hinge.a[0], hinge.a[1]);
    const qa = panelPoint(folded, a, hinge.b[0], hinge.b[1]), qb = panelPoint(folded, b, hinge.b[0], hinge.b[1]);
    const gap = Math.max(Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]), Math.hypot(qa[0] - qb[0], qa[1] - qb[1], qa[2] - qb[2]));
    const achieved = gap > tolerance ? NaN : achievedAngle2(pose, tiling, hinge);
    let kind: HingeKind;
    if (gap > tolerance) { kind = "open"; open++; }
    else if (Math.abs(achieved - requested[hinge.index]) <= ANGLE_TOLERANCE) { kind = "realized"; realized++; }
    else { kind = "off-angle"; offAngle++; }
    report.push(Object.freeze({ kind, requested: requested[hinge.index], achieved, gap }));
  }
  const counts: FoldCounts = Object.freeze({ panels: n, hinges: hinges.length, tree: tree.length, folded: foldedCount, realized, offAngle, open, roots: roots.length, strays: strays.length });
  return Object.freeze({ ...folded, treeHinges: Object.freeze(tree), report: Object.freeze(report), counts });
}

function achievedAngle2(pose: Float64Array, tiling: PanelTiling, hinge: Hinge): number {
  const [a, b] = hinge.panels;
  let dx = hinge.b[0] - hinge.a[0], dz = -(hinge.b[1] - hinge.a[1]);
  const length = Math.hypot(dx, dz);
  dx /= length; dz /= length;
  const c = tiling.panels[b].centroid;
  if (dz * (c[0] - hinge.a[0]) - dx * (-c[1] + hinge.a[1]) < 0) { dx = -dx; dz = -dz; }
  return poseAngle(pose, a, b, dx, dz);
}
