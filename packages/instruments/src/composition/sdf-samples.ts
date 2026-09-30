/**
 * Bundled implicit sculptures (brief 56): four typed trees chosen by a validated select, then one shared pipeline of
 * carving, deformation and repetition. Everything is a function of scalar controls and a seed, so nothing here is a
 * URL, an asset or a closure; a caller's own tree goes to `sdf()` directly (host binding of user trees is future work).
 *
 *   form tree  ->  [hollow shell / cutaway, in either order]  ->  twist -> bend  ->  bounded repeat of the whole
 *
 * Forms (world unit = half the block's side):
 *  - `carved-block`: a half-size-1 box, optionally intersected with a sphere (`roundness` 0 keeps the box, 1 the sphere
 *    that touches its faces), with `bores` cylinders (Y, then X, then Z) subtracted through it.
 *  - `lattice-cavity`: a block minus a bounded lattice of `cells`^3 spherical voids (radius `voidSize` of half a cell)
 *    joined by tunnels along the three axes (`tunnel` of the void radius), the cavities smooth-unioned with `blend` (a
 *    fraction of the cell). `voidKeep` omits voids by a stable per-cell hash of the seed (the repeat node's `keep`).
 *  - `coral`: a holdfast, a trunk and `branches` capsules leaving it at seeded heights, azimuths, tilts and lengths, each
 *    with `twigs` capsules and (`bulbs`) a knob at every tip, all smooth-unioned with `blend`. `spread` tilts the limbs
 *    from the vertical and `thickness` is the limb radius.
 *  - `fractal-fragment`: a bounded fractal fold (`menger` or `tetra`, `iterations` at most `SDF_LIMITS.maxFoldIterations`)
 *    of a box or sphere: the child is repeated by 20^n (Menger sponge) or 4^n (tetrahedral arrangement) similar copies.
 *
 * Cutaway (`cut`): `half` removes everything beyond a plane at `at` along +X; `quarter` removes the wedge beyond `at` in +X and
 * +Z, `corner` the octant beyond `at` on +X, +Y and +Z, each turned about the vertical axis by `turn` degrees (clockwise seen
 * from above); `slot` opens a horizontal slit at height `at`. `hollow` turns the form into a skin `wall` thick. OPERATION
 * ORDER (`order`): `shell-first` shells the solid
 * and then cuts the shell open (the cut shows the empty interior between two skins); `cut-first` cuts the solid and then
 * shells the result (every cut face is skinned too and the interior stays sealed from view). The two differ wherever a cut
 * meets a wall.
 *
 * Repeat: `repeat` copies the whole sculpture on an `x` by `y` by `z` lattice spaced by the sculpture's own extent times
 * `1 + gap`, so copies never overlap (the repeat node's bound requires it).
 */
import { componentSeed } from "./core.js";
import {
  sdf, sdfBend, sdfBox, sdfCapsule, sdfCylinder, sdfFold, sdfIntersection, sdfPlace, sdfRepeat, sdfShell, sdfSmoothUnion, sdfSphere, sdfSubtract, sdfTwist, sdfUnion,
  type Sdf, type SdfNode,
} from "./sdf.js";
import type { Vec3 } from "./mesh.js";

export type SculptureForm = "carved-block" | "lattice-cavity" | "coral" | "fractal-fragment";
export const sculptureForms: readonly SculptureForm[] = ["carved-block", "lattice-cavity", "coral", "fractal-fragment"];
export type SculptureCut = "none" | "half" | "quarter" | "corner" | "slot";
export type SculptureOrder = "shell-first" | "cut-first";

export interface SculptureSpec {
  readonly seed: number;
  readonly form: SculptureForm;
  readonly carved: { readonly roundness: number; readonly bores: number; readonly boreRadius: number };
  readonly lattice: { readonly cells: number; readonly voidSize: number; readonly tunnel: number; readonly voidKeep: number };
  /** Smooth-union width for coral limbs and lattice cavities. */
  readonly blend: number;
  readonly coral: { readonly branches: number; readonly twigs: number; readonly spread: number; readonly thickness: number; readonly bulbs: boolean };
  readonly fractal: { readonly fold: "menger" | "tetra"; readonly iterations: number; readonly shape: "box" | "sphere" };
  readonly carve: { readonly cut: SculptureCut; readonly at: number; readonly turn: number; readonly hollow: boolean; readonly wall: number; readonly order: SculptureOrder };
  readonly deform: { readonly twist: number; readonly bend: number };
  readonly repeat: { readonly x: number; readonly y: number; readonly z: number; readonly gap: number };
}

const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const cyl = (radius: number, axis: "x" | "y" | "z", halfHeight: number): SdfNode => {
  const c = sdfCylinder(radius, halfHeight);
  return axis === "y" ? c : sdfPlace(c, { rotate: axis === "x" ? [0, 0, 90] : [90, 0, 0] });
};
const join = (k: number, parts: SdfNode[]): SdfNode => (parts.length === 1 ? parts[0] : k > 0 ? sdfSmoothUnion(k, ...parts) : sdfUnion(...parts));

function carvedBlock(s: SculptureSpec["carved"]): SdfNode {
  const box = sdfBox([1, 1, 1]);
  const solid = s.roundness > 0 ? sdfIntersection(box, sdfSphere(Math.sqrt(3) - s.roundness * (Math.sqrt(3) - 1))) : box;
  const axes = (["y", "x", "z"] as const).slice(0, s.bores);
  return axes.length ? sdfSubtract(solid, ...axes.map((a) => cyl(s.boreRadius, a, 1.6))) : solid;
}

function latticeCavity(s: SculptureSpec["lattice"], blend: number, seed: number): SdfNode {
  const n = s.cells, cell = 2 / n, rv = s.voidSize * cell / 2, rt = s.tunnel * rv, spacing: Vec3 = [cell, cell, cell];
  const parts: SdfNode[] = [];
  if (s.voidKeep > 0 && rv > 0)
    parts.push(sdfRepeat(sdfSphere(rv), spacing, [n, n, n], s.voidKeep < 1 ? { seed: componentSeed(seed, "lattice", "voids"), probability: s.voidKeep } : undefined));
  if (rt > 0) {
    parts.push(sdfRepeat(cyl(rt, "y", 1.3), spacing, [n, 1, n]), sdfRepeat(cyl(rt, "x", 1.3), spacing, [1, n, n]), sdfRepeat(cyl(rt, "z", 1.3), spacing, [n, n, 1]));
  }
  const block = sdfBox([1, 1, 1]);
  return parts.length ? sdfSubtract(block, join(blend * cell, parts)) : block;
}

function coral(s: SculptureSpec["coral"], blend: number, seed: number): SdfNode {
  const parts: SdfNode[] = [sdfPlace(sdfCylinder(0.6, 0.09), { translate: [0, -1.02, 0] }), sdfCapsule([0, -1, 0], [0, 0.15, 0], s.thickness * 1.5)];
  const norm = (v: number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  for (let k = 0; k < s.branches; k++) {
    const id = `b${k}`, u = (purpose: string) => unit(seed, id, purpose);
    const y0 = -0.8 + 0.85 * u("height"), phi = 2 * Math.PI * (k + 0.7 * (u("azimuth") - 0.5)) / s.branches;
    const theta = s.spread * (0.4 + 0.8 * u("tilt")), length = (0.55 + 0.5 * u("length")) * (1.05 - 0.35 * (y0 + 0.8));
    const dir = norm([Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)]);
    const from: Vec3 = [0, y0, 0], tip: Vec3 = [dir[0] * length, y0 + dir[1] * length, dir[2] * length];
    parts.push(sdfCapsule(from, tip, s.thickness));
    if (s.bulbs) parts.push(sdfSphere(s.thickness * 1.9, tip));
    for (let j = 0; j < s.twigs; j++) {
      const tid = `${id}/t${j}`, v = (purpose: string) => unit(seed, tid, purpose);
      const psi = phi + (j % 2 === 0 ? 1 : -1) * (0.9 + 0.7 * v("azimuth")), lift = 0.25 + 0.55 * v("lift");
      const d = norm([dir[0] * 0.6 + Math.cos(psi) * 0.8, dir[1] * 0.6 + lift, dir[2] * 0.6 + Math.sin(psi) * 0.8]), l2 = length * (0.4 + 0.3 * v("length"));
      const end: Vec3 = [tip[0] + d[0] * l2, tip[1] + d[1] * l2, tip[2] + d[2] * l2];
      parts.push(sdfCapsule(tip, end, s.thickness * 0.7));
      if (s.bulbs) parts.push(sdfSphere(s.thickness * 1.5, end));
    }
  }
  return join(blend * 0.3, parts);
}

function fractal(s: SculptureSpec["fractal"]): SdfNode {
  const child = s.shape === "box" ? sdfBox([1, 1, 1]) : sdfSphere(s.fold === "menger" ? 1.22 : 1.3);
  return sdfFold(child, s.fold, s.iterations);
}

/** Bundled form tree, before carving, deformation and repetition. */
export function formTree(spec: SculptureSpec): SdfNode {
  switch (spec.form) {
    case "carved-block": return carvedBlock(spec.carved);
    case "lattice-cavity": return latticeCavity(spec.lattice, spec.blend, spec.seed);
    case "coral": return coral(spec.coral, spec.blend, spec.seed);
    case "fractal-fragment": return fractal(spec.fractal);
    default: throw new Error(`Unknown sculpture form: ${String(spec.form)}`);
  }
}

function cutter(spec: SculptureSpec): SdfNode | null {
  const { cut, at, turn } = spec.carve;
  if (cut === "none") return null;
  const big = 3, at3 = (x: number, y: number, z: number): SdfNode => sdfPlace(sdfBox([big, big, big]), { translate: [x, y, z] });
  const turned = (node: SdfNode): SdfNode => (turn === 0 ? node : sdfPlace(node, { rotate: [0, -turn, 0] }));
  switch (cut) {
    case "half": return turned(at3(at + big, 0, 0));
    case "quarter": return turned(at3(at + big, 0, at + big));
    case "corner": return turned(at3(at + big, at + big, at + big));
    case "slot": return sdfPlace(sdfBox([big, 0.1, big]), { translate: [0, at, 0] });
    default: throw new Error(`Unknown cut: ${String(cut)}`);
  }
}

/** The complete sculpture tree for a spec. */
export function sculptureTree(spec: SculptureSpec): SdfNode {
  let node = formTree(spec);
  const cutNode = cutter(spec), { hollow, wall, order } = spec.carve;
  if (hollow && cutNode) node = order === "shell-first" ? sdfSubtract(sdfShell(node, wall), cutNode) : sdfShell(sdfSubtract(node, cutNode), wall);
  else if (hollow) node = sdfShell(node, wall);
  else if (cutNode) node = sdfSubtract(node, cutNode);
  if (spec.deform.twist !== 0) node = sdfTwist(node, spec.deform.twist);
  if (spec.deform.bend !== 0) node = sdfBend(node, spec.deform.bend);
  const { x, y, z, gap } = spec.repeat;
  if (x * y * z > 1) {
    const { bounds } = sdf(node);
    const spacing = [0, 1, 2].map((a) => 2 * Math.max(Math.abs(bounds.min[a]), Math.abs(bounds.max[a])) * (1 + gap)) as unknown as Vec3;
    node = sdfRepeat(node, spacing, [x, y, z]);
  }
  return node;
}

/** The compiled sculpture for a spec (cached by tree content, so equal specs give the same object). */
export const sculptureSdf = (spec: SculptureSpec): Sdf => sdf(sculptureTree(spec));
