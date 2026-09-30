import { along, apply, frameOf, inverse, lorentz, mirrorAddress, mul, normalizeVec, triangleGroup } from "./hyperbolic-geometry.js";
import type { Mat3, TriangleGroup, Vec3 } from "./hyperbolic-geometry.js";
import { curvePolyline } from "./hyperbolic.js";
import type { HyperbolicTile, HyperbolicTiling } from "./hyperbolic.js";
import { componentSeed } from "./core.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Motif frames and ring paths of a hyperbolic tiling: what to place, and what to stroke, in every fundamental
 * triangle (chamber) of the kept cells.
 *
 * `hyperbolicFrames(tiling, {radial, along})` returns one `Site` per chamber image of a chosen anchor point.
 * The anchor sits in the base triangle O (cell centre), V (vertex), M (edge midpoint): `along` in [0, 1] moves a
 * point from V to M on the cell edge, `radial` in [0, 1] goes from O to that point (hyperbolic fractions of
 * the geodesic). Each frame carries the image's true local frame: `angle` is the direction the base
 * triangle's +x axis is sent to, `scale` is the disk's conformal factor 1 - |z|^2 at the image (a mark of size
 * s draws at s times it: hyperbolic scaling), and a negative `scale` marks a chamber reached by an odd number
 * of reflections, which reflects the mark across its axis exactly as `atEach` does. So a chiral mark shows the
 * mirror structure and its size follows the conformal factor, with no approximation beyond the first-order
 * frame itself.
 *
 * Coincident copies are removed exactly. An anchor on a mirror (`radial` 0 or 1, `along` 0 or 1) is the image
 * of several chambers; all chambers giving the same point have the same mirror address (see
 * `hyperbolic-geometry.ts`), so only one frame is kept: the orientation-preserving chamber of least
 * address. Anchors within 1e-9 of a mirror count as on it. Frame ids are `frame:<address of the image point>`
 * and depend on {p,q} and the anchor only, never on crop or view.
 *
 * `hyperbolicRings(tiling, options)` publishes circle-like closed curves around every cell centre, vertex or
 * edge midpoint as chains of arcs assembled across chamber walls by exact endpoint identity (the address of
 * each wall crossing). `radius` is a fraction of the largest circle that fits (cell: the inradius, so the ring
 * touches the edge midpoints at 1; vertex: half an edge, so rings around neighbouring vertices touch at 1;
 * edge: the smaller of the two), `count` gives concentric rings at k/count of it, and `round` blends each arc
 * from the straight geodesic chord (0, a geodesic polygon) to the true hyperbolic circle (1).
 * At `radius` 1 rings touch where a chain point is shared by more than two arcs; chains stop there rather
 * than guessing which arcs continue. Chains open at the region boundary. Ids are `ring:<around>:<k>:<least
 * chamber address>`; a chain that grows when the region grows may take a smaller address, and every closed
 * ring inside the region keeps its id.
 *
 * Failure and bounds. Anchor and ring numbers are validated with the control named; more than
 * more than `MAX_HYPERBOLIC_FRAMES` frames or `MAX_HYPERBOLIC_ARCS` ring arcs is an error naming the controls that
 * grow them, never a truncation. Results are frozen and cached by construction on the tiling object.
 */
export interface HyperbolicFrame extends Site {
  readonly cell: string;
  readonly generation: number;
  /** Mirror lines between this chamber and the base chamber (the chamber address length). */
  readonly distance: number;
  readonly sector: number;
  readonly mirrored: boolean;
  /** Disk radius (0..1) of the frame's position. */
  readonly diskRadius: number;
  /** Address of the chamber that carries this frame. */
  readonly chamber: string;
}

export interface HyperbolicRing extends Path {
  readonly around: HyperbolicRingAround;
  /** 1..count. */
  readonly ring: number;
  readonly generation: number;
  /** Chamber address length of the lead arc's chamber. */
  readonly distance: number;
  readonly sector: number;
  readonly cell: string;
}

export type HyperbolicRingAround = "cell" | "vertex" | "edge";
/** `minScale`: frames whose conformal factor 1 - |z|^2 is below it are not produced (the pixel-scale stop for marks); 0 keeps all. */
export interface HyperbolicFrameOptions { seed: number; radial: number; along: number; minScale?: number }
export interface HyperbolicRingOptions { seed: number; around: HyperbolicRingAround; count: number; radius: number; round: number }

export const MAX_HYPERBOLIC_FRAMES = 60_000;
export const MAX_HYPERBOLIC_ARCS = 80_000;
const ON_MIRROR = 1e-9;
type Rank = { mirrored: boolean; chamber: string };
/** Among chambers sharing an image point keep the orientation-preserving one, then the least address. */
const better = (a: Rank, b: Rank): boolean => a.mirrored !== b.mirrored ? !a.mirrored : a.chamber < b.chamber;

function check(label: string, value: number, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} in [${min}, ${max}], got ${value}`);
}

const cache = new WeakMap<HyperbolicTiling, Map<string, unknown>>();
function cached<T>(tiling: HyperbolicTiling, key: string, make: () => T): T {
  let byKey = cache.get(tiling);
  if (!byKey) cache.set(tiling, byKey = new Map());
  const hit = byKey.get(key);
  if (hit !== undefined) return hit as T;
  const value = make();
  byKey.set(key, value);
  if (byKey.size > 6) byKey.delete(byKey.keys().next().value!);
  return value;
}

/** The 2p chamber matrices of a canonical cell: cell rotations, each with its mirror through the base axis. */
function chamberMatrices(group: TriangleGroup): Mat3[] {
  const result: Mat3[] = [];
  for (const turn of group.turns) result.push(turn, mul(turn, group.mirrors[1]));
  return result;
}

/** Frames at the anchor image in every chamber of every kept cell. See the module header. */
export function hyperbolicFrames(tiling: HyperbolicTiling, options: HyperbolicFrameOptions): readonly HyperbolicFrame[] {
  const { seed, radial, along: alongEdge, minScale = 0 } = options;
  check("Anchor radius", radial, 0, 1);
  check("Anchor position", alongEdge, 0, 1);
  check("Smallest frame scale", minScale, 0, 1);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Frame seed must be a uint32 integer");
  return cached(tiling, `frames:${seed}:${radial}:${alongEdge}:${minScale}`, () => {
    const group = triangleGroup(tiling.p, tiling.q);
    const matrices = chamberMatrices(group);
    const anchor = along(group.O, along(group.V, group.M, alongEdge), radial);
    const onMirror = radial <= ON_MIRROR || radial >= 1 - ON_MIRROR || alongEdge <= ON_MIRROR || alongEdge >= 1 - ON_MIRROR;
    const viewInverse = inverse(tiling.view);
    const { centerX, centerY, radius } = tiling.placement;
    const winners = new Map<string, HyperbolicFrame>();
    const rank = new Map<string, Rank>();
    for (const tile of tiling.tiles) {
      const canonical = mul(viewInverse, tile.transform);
      for (const chamber of matrices) {
        const frame = frameOf(mul(tile.transform, chamber), anchor);
        if (frame.kappa < minScale) continue;
        const address = mirrorAddress(group, apply(mul(canonical, chamber), anchor)).word;
        let word = address;
        if (onMirror) word = mirrorAddress(group, apply(mul(canonical, chamber), group.interior)).word;
        const id = `frame:${address}`;
        const mine = { mirrored: frame.mirrored, chamber: word };
        const held = rank.get(id);
        if (held && !better(mine, held)) continue;
        rank.set(id, mine);
        if (!winners.has(id) && winners.size >= MAX_HYPERBOLIC_FRAMES)
          throw new Error(`The tiling would carry more than ${MAX_HYPERBOLIC_FRAMES} frames (2 x ${tiling.p} sides per cell over ${tiling.tiles.length} cells). Raise Smallest motif or Smallest cell, lower Generations, Polygon sides or Disk radius`);
        winners.set(id, Object.freeze({
          id, seed: componentSeed(seed, id, "frame"),
          position: Object.freeze([centerX + radius * frame.z[0], centerY + radius * frame.z[1]] as const),
          angle: frame.angle, scale: frame.mirrored ? -frame.kappa : frame.kappa,
          cell: tile.id, generation: tile.generation, distance: word.length, sector: tile.sector, mirrored: frame.mirrored,
          diskRadius: Math.hypot(frame.z[0], frame.z[1]), chamber: word,
        }));
      }
    }
    return Object.freeze([...winners.values()]);
  });
}

/** The corner a ring circles and the two chamber walls that meet there, with each wall's length from the corner. */
function cornerOf(group: TriangleGroup, around: HyperbolicRingAround) {
  const { O, V, M } = group;
  const half = group.edgeLength / 2;
  if (around === "cell") return { corner: O, first: V, second: M, firstLength: group.circumradius, secondLength: group.inradius, reach: group.inradius, angle: Math.PI / group.p };
  if (around === "vertex") return { corner: V, first: O, second: M, firstLength: group.circumradius, secondLength: half, reach: half, angle: Math.PI / group.q };
  return { corner: M, first: O, second: V, firstLength: group.inradius, secondLength: half, reach: Math.min(group.inradius, half), angle: Math.PI / 2 };
}

/** Concentric ring `k` (of `count`) as a canonical curve in the base chamber, endpoints on its two walls. */
function ringCurve(group: TriangleGroup, options: HyperbolicRingOptions, k: number): { at: (t: number) => Vec3; first: Vec3; second: Vec3 } {
  const c = cornerOf(group, options.around);
  const rho = options.radius * c.reach * k / options.count;
  const first = along(c.corner, c.first, rho / c.firstLength), second = along(c.corner, c.second, rho / c.secondLength);
  const ch = Math.cosh(rho), sh = Math.sinh(rho);
  // Unit tangents at the corner toward each wall point; the circle turns from one to the other through `angle`.
  const tangent = (x: Vec3): Vec3 => [(x[0] - ch * c.corner[0]) / sh, (x[1] - ch * c.corner[1]) / sh, (x[2] - ch * c.corner[2]) / sh];
  const ea = tangent(first), eb = tangent(second);
  const dot = lorentz(ea, eb);
  const perp: Vec3 = [eb[0] - dot * ea[0], eb[1] - dot * ea[1], eb[2] - dot * ea[2]];
  const norm = Math.sqrt(lorentz(perp, perp));
  const ep: Vec3 = [perp[0] / norm, perp[1] / norm, perp[2] / norm];
  const lambda = options.round;
  const at = (t: number): Vec3 => {
    const phi = t * c.angle, cos = Math.cos(phi), sin = Math.sin(phi);
    const arc = [0, 1, 2].map((i) => ch * c.corner[i] + sh * (cos * ea[i] + sin * ep[i]));
    if (lambda >= 1) return normalizeVec(arc);
    const chord = along(first, second, t);
    return normalizeVec(arc.map((x, i) => (1 - lambda) * chord[i] + lambda * x));
  };
  return { at, first, second };
}

interface Arc { first: string; second: string; points: readonly Point[]; chamber: string; tile: HyperbolicTile }

/** Closed and open ring chains around every cell centre, vertex or edge midpoint. See the module header. */
export function hyperbolicRings(tiling: HyperbolicTiling, options: HyperbolicRingOptions): readonly HyperbolicRing[] {
  const { seed, around, count, radius, round } = options;
  if (!["cell", "vertex", "edge"].includes(around)) throw new Error(`Unknown ring centre: ${around}`);
  check("Rings", count, 1, 24, true);
  check("Ring radius", radius, 0.01, 1);
  check("Ring roundness", round, 0, 1);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Ring seed must be a uint32 integer");
  return cached(tiling, `rings:${seed}:${around}:${count}:${radius}:${round}`, () => {
    const group = triangleGroup(tiling.p, tiling.q);
    const arcs = 2 * tiling.p * tiling.tiles.length * count;
    if (arcs > MAX_HYPERBOLIC_ARCS)
      throw new Error(`The rings would need ${arcs} arcs (2 x ${tiling.p} sides x ${tiling.tiles.length} cells x ${count} rings); the limit is ${MAX_HYPERBOLIC_ARCS}. Lower Rings, Generations or Polygon sides, lower Disk radius or raise Smallest cell`);
    const matrices = chamberMatrices(group);
    const curves = Array.from({ length: count }, (_, k) => ringCurve(group, options, k + 1));
    const viewInverse = inverse(tiling.view);
    const perRing: Arc[][] = curves.map(() => []);
    for (const tile of tiling.tiles) {
      const canonical = mul(viewInverse, tile.transform);
      for (const chamber of matrices) {
        const canonicalChamber = mul(canonical, chamber);
        const viewChamber = mul(tile.transform, chamber);
        const word = mirrorAddress(group, apply(canonicalChamber, group.interior)).word;
        curves.forEach((curve, k) => {
          const points = curvePolyline((t) => apply(viewChamber, curve.at(t)), tiling.placement);
          perRing[k].push({
            // The word alone names the chamber the descent ends in; the wall point is the word plus which wall it is on.
            first: `${mirrorAddress(group, apply(canonicalChamber, curve.first)).word}:1`, second: `${mirrorAddress(group, apply(canonicalChamber, curve.second)).word}:2`,
            points, chamber: word, tile,
          });
        });
      }
    }
    const result: HyperbolicRing[] = [];
    perRing.forEach((list, k) => result.push(...chains(tiling, list, around, k + 1, seed)));
    return Object.freeze(result);
  });
}

/** Join arcs that share a wall crossing with exactly two arcs into maximal chains. */
function chains(tiling: HyperbolicTiling, arcs: readonly Arc[], around: HyperbolicRingAround, ring: number, seed: number): HyperbolicRing[] {
  const at = new Map<string, number[]>();
  arcs.forEach((arc, index) => {
    for (const end of [arc.first, arc.second]) {
      const list = at.get(end);
      if (list) list.push(index); else at.set(end, [index]);
    }
  });
  const used = new Array<boolean>(arcs.length).fill(false);
  const other = (arc: Arc, end: string) => end === arc.first ? arc.second : arc.first;
  // The one other arc meeting `from` at `end`, or -1 where the chain ends: a free end or a point shared by more than two arcs.
  const next = (end: string, from: number): number => {
    const list = at.get(end)!;
    return list.length === 2 ? (list[0] === from ? list[1] : list[0]) : -1;
  };
  const out: HyperbolicRing[] = [];
  for (let start = 0; start < arcs.length; start++) {
    if (used[start]) continue;
    // Walk back to the chain's first arc, or notice that the chain closes on itself.
    let head = start, entry = arcs[start].first, closed = false;
    for (;;) {
      const before = next(entry, head);
      if (before < 0) break;
      if (before === start) { closed = true; entry = arcs[start].first; head = start; break; }
      entry = other(arcs[before], entry);
      head = before;
    }
    const ordered: { arc: Arc; reversed: boolean }[] = [];
    for (let current = head;;) {
      used[current] = true;
      const arc = arcs[current];
      ordered.push({ arc, reversed: arc.first !== entry });
      const exit = other(arc, entry);
      const step = next(exit, current);
      if (step < 0 || used[step]) break;
      current = step;
      entry = exit;
    }
    const points: Point[] = [];
    ordered.forEach(({ arc, reversed }, index) => {
      const line = reversed ? [...arc.points].reverse() : arc.points;
      const dropEnd = closed && index === ordered.length - 1;
      for (let i = index === 0 ? 0 : 1; i < line.length - (dropEnd ? 1 : 0); i++) points.push(line[i]);
    });
    let lead = ordered[0].arc;
    for (const { arc } of ordered) if (arc.chamber < lead.chamber) lead = arc;
    const id = `ring:${around}:${ring}:${lead.chamber}`;
    out.push(Object.freeze({
      id, seed: componentSeed(seed, id, "ring"), points: Object.freeze(points), closed, level: ring, levelFraction: 0,
      around, ring, generation: Math.min(...ordered.map(({ arc }) => arc.tile.generation)), distance: lead.chamber.length, sector: lead.tile.sector, cell: lead.tile.id,
    }));
  }
  const deepest = Math.max(1, tiling.layers.length - 1);
  return out.map((r) => Object.freeze({ ...r, levelFraction: r.generation / deepest }));
}
