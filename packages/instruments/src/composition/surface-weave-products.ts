import { componentSeed } from "./core.js";
import { orderCrossings, type CrossingOrder, type CrossingOrderOptions, type OverRule } from "./crossing-order.js";
import type { CrossingSet } from "./crossings.js";
import { bundledMesh, torusMesh, vaseMesh, type TerrainVariant, type VaseProfile } from "./mesh-samples.js";
import { icospherePatchMesh, parametricSheetMesh, type SheetKind } from "./mesh-surfaces.js";
import { flowVectors, spacingField, type DensitySpec, type FlowSpec, type ScalarSpec } from "./surface-fields.js";
import { estimateStrandVertices, STRAND_LIMITS, surfaceCrossingSet, surfaceCrossings, traceStrands, type SurfaceCrossing, type SurfaceStrand } from "./surface-strands.js";
import { meshDerived, transformMesh, type Mesh } from "./mesh.js";
import { memoized } from "./sources.js";

/**
 * Surface Weave, stage 1 to 3 (camera free): surface, threads, crossings and their order.
 *
 *   weaveMesh → flowVectors / spacingField → traceStrands (two families) → surfaceCrossings → orderCrossings
 *
 * A `SurfaceWeaveStructure` is everything that decides which threads exist: the surface, the direction field (source, angle,
 * weave angle, swirl), the spacing (base, second-family multiple, density field, edge treatment). Two constructions with equal
 * structure and seed return the SAME frozen `SurfaceWeaveStrands` (cached by mesh content, structure and seed). The view (camera,
 * widths, shading, colours) is not an input: nothing here is recomputed when it changes. The order rule, Invert and Exceptions
 * change `order` only; the crossing table and strands are untouched.
 *
 * SURFACES are the bundled meshes of `mesh-samples.ts` and `mesh-surfaces.ts`, chosen by a validated select and scaled by the
 * controls named in `WeaveSurface`; a resolved `Mesh` (a host's own model) can be passed to the direct API instead. The mesh must
 * be a manifold with consistent orientation. There is no UV: strands are traced across triangles, so a seam or a pole has no
 * special case. Declared treatment: a pole or any place where the direction field vanishes (a critical point of the scalar,
 * a constant scalar such as the flat base under a height field, a guide along the normal) has no direction, so strands stop
 * before it (`ends: "singular"`) and that small region is left bare; the tests list it for the sphere and the vase.
 *
 * UNITS. Spacing is a share of `scale = sqrt(surface area)` in the structure and world units below it. Thread widths are shares
 * of the strand's local spacing (see the view stage).
 *
 * WORK. `estimateStrandVertices` (sum of area over `0.35 spacing^2` per family) is compared with `STRAND_LIMITS.vertices`
 * BEFORE anything is traced; over it the call throws naming Thread spacing, Second family spacing and Density ratio.
 * Crossings above `STRAND_LIMITS.crossings` also throw. Nothing is truncated.
 */
export type WeaveSurface =
  | { kind: "terrain"; variant: TerrainVariant; detail: number; relief: number }
  | { kind: "vase"; profile: VaseProfile; detail: number }
  | { kind: "torus"; tube: number; detail: number }
  | { kind: "sphere"; cap: number; detail: number }
  | { kind: "sheet"; shape: SheetKind; detail: number; relief: number };

export type FlowField = "height" | "axis" | "centre" | "plane" | "waves" | "guide";
export type ModulationField = "height" | "axis" | "centre" | "diagonal" | "waves";
export interface SurfaceWeaveStructure {
  surface: WeaveSurface;
  flow: { field: FlowField; bandAngle: number; frequency: number; yaw: number; pitch: number };
  /** Degrees from the isolines (or guide) to the first family. */
  angle: number;
  /** Degrees between the two families. */
  cross: number;
  swirl: { amount: number; field: ModulationField };
  threads: { spacing: number; spacingB: number; density: { field: ModulationField | "none"; ratio: number; reverse: boolean } };
  edge: { mode: "flush" | "inset" | "fringe"; margin: number };
}
export interface SurfaceWeaveOrder { rule: OverRule; invert: boolean; exceptions: readonly number[] }

const meshes = new Map<string, Mesh>();

/** The mesh a surface spec names (cached by construction). */
export function weaveMesh(surface: WeaveSurface, seed: number): Mesh {
  const detail = surface.detail;
  if (!Number.isInteger(detail) || detail < 1 || detail > 8) throw new Error(`Detail must be an integer in 1..8 (got ${String(detail)})`);
  switch (surface.kind) {
    case "terrain": {
      const base = bundledMesh("terrain", { detail, seed, variant: surface.variant });
      if (surface.relief === 1) return base;
      if (!(surface.relief > 0) || !Number.isFinite(surface.relief)) throw new Error("Relief must be a positive number");
      return memoized(meshes, `t|${base.key}|${surface.relief}`, () => transformMesh(base, { scale: [1, surface.relief, 1] }, `${base.id}*relief`));
    }
    case "vase": return vaseMesh({ profile: surface.profile, slices: 8 * detail, smooth: Math.max(2, Math.min(8, detail)) });
    case "torus": return torusMesh({ major: 1, minor: surface.tube, u: 12 * detail, v: 6 * detail });
    case "sphere": return icospherePatchMesh(Math.min(6, detail), surface.cap);
    case "sheet": {
      const base = parametricSheetMesh({ kind: surface.shape, columns: 8 * detail, rows: 8 * detail, seed });
      if (surface.relief === 1) return base;
      if (!(surface.relief > 0) || !Number.isFinite(surface.relief)) throw new Error("Relief must be a positive number");
      return memoized(meshes, `s|${base.key}|${surface.relief}`, () => transformMesh(base, { scale: [1, surface.relief, 1] }, `${base.id}*relief`));
    }
  }
}

function scalarFor(field: ModulationField | Exclude<FlowField, "guide">, seed: number, purpose: string, angle = 45, frequency = 2.5): ScalarSpec {
  const kind = field === "diagonal" ? "plane" : field;
  return { kind, angle: field === "diagonal" ? 45 : angle, frequency, seed: componentSeed(seed, purpose, "surface-weave-field") };
}

function flowSpec(structure: SurfaceWeaveStructure, seed: number): FlowSpec {
  const { flow, swirl } = structure;
  return {
    source: flow.field === "guide" ? "guide" : "isolines",
    scalar: scalarFor(flow.field === "guide" ? "height" : flow.field, seed, "flow", flow.bandAngle, flow.frequency),
    yaw: flow.yaw, pitch: flow.pitch, angle: structure.angle, swirl: swirl.amount, swirlScalar: scalarFor(swirl.field, seed, "swirl"),
  };
}
function densitySpec(structure: SurfaceWeaveStructure, seed: number): DensitySpec {
  const { field, ratio, reverse } = structure.threads.density;
  return { scalar: field === "none" ? null : scalarFor(field, seed, "density", 45, 2), ratio, reverse };
}

export interface SurfaceWeaveStrands {
  readonly mesh: Mesh;
  /** `sqrt(area)` of the mesh, world units. */
  readonly scale: number;
  /** Base spacing of the first family, world units. */
  readonly spacing: number;
  readonly strands: readonly SurfaceStrand[];
  readonly crossings: readonly SurfaceCrossing[];
  /** The crossings as a `CrossingSet` over developed strands (see `surfaceCrossingSet`). */
  readonly set: CrossingSet;
  readonly stats: { readonly vertices: number; readonly families: readonly [number, number]; readonly closed: number; readonly estimate: number };
}

const strandCache = new Map<string, SurfaceWeaveStrands>();

function checkStructure(s: SurfaceWeaveStructure): void {
  for (const [name, value, low, high] of [["Thread spacing", s.threads.spacing, 0.005, 1], ["Second family spacing", s.threads.spacingB, 0.05, 20], ["Density ratio", s.threads.density.ratio, 1, 64],
    ["Edge margin", s.edge.margin, 0, 100]] as const)
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(`${name} must be between ${low} and ${high} (got ${String(value)})`);
  const turn = (((s.cross % 180) + 180) % 180);
  if (!Number.isFinite(s.cross) || turn < 5 || turn > 175) throw new Error("Weave angle must differ from 0 and 180 degrees by at least 5, or both families would run together");
}

/** Strands and crossings of a structure on its surface (or on `given`, a resolved mesh). Cached. */
export function surfaceWeaveStrands(structure: SurfaceWeaveStructure, seed: number, given?: Mesh): SurfaceWeaveStrands {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Weave seed must be a uint32 integer");
  checkStructure(structure);
  const mesh = given ?? weaveMesh(structure.surface, seed);
  const key = JSON.stringify([mesh.key, structure, seed]);
  const hit = strandCache.get(key);
  if (hit) { strandCache.delete(key); strandCache.set(key, hit); return hit; }
  const scale = Math.sqrt(meshDerived(mesh).area), spacing = structure.threads.spacing * scale, spacingB = spacing * structure.threads.spacingB;
  const density = densitySpec(structure, seed), flow = flowSpec(structure, seed);
  const fieldA = spacingField(mesh, spacing, density), fieldB = spacingField(mesh, spacingB, density);
  const estimate = estimateStrandVertices(mesh, [fieldA, fieldB]);
  if (estimate > STRAND_LIMITS.vertices)
    throw new Error(`These threads would need about ${estimate} vertices; the limit is ${STRAND_LIMITS.vertices}. Raise Thread spacing or Second family spacing, or lower Density ratio`);
  const margin = structure.edge.mode === "flush" ? 0 : structure.edge.margin, fringe = structure.edge.mode === "fringe";
  const a = traceStrands(mesh, { vectors: flowVectors(mesh, flow, 0), spacing: fieldA, family: 0, seed, margin: margin * spacing, fringe, budget: STRAND_LIMITS.vertices });
  const usedA = a.reduce((sum, strand) => sum + strand.points.length, 0);
  const b = traceStrands(mesh, { vectors: flowVectors(mesh, flow, structure.cross), spacing: fieldB, family: 1, seed, margin: margin * spacingB, fringe, budget: Math.max(1, STRAND_LIMITS.vertices - usedA) });
  const strands = Object.freeze([...a, ...b]), crossings = surfaceCrossings(mesh, strands);
  const result: SurfaceWeaveStrands = Object.freeze({
    mesh, scale, spacing, strands, crossings, set: surfaceCrossingSet(strands, crossings),
    stats: Object.freeze({ vertices: strands.reduce((sum, strand) => sum + strand.points.length, 0), families: Object.freeze([a.length, b.length] as const) as readonly [number, number], closed: strands.filter((s) => s.closed).length, estimate }),
  });
  strandCache.set(key, result);
  if (strandCache.size > 6) strandCache.delete(strandCache.keys().next().value!);
  return result;
}

export interface SurfaceWeaveProducts extends SurfaceWeaveStrands {
  readonly order: CrossingOrder;
  /** The options `order` was made with (the exceptions as crossing ids), so a camera's own crossing table can be ordered identically. */
  readonly orderOptions: CrossingOrderOptions;
  /** Closed strands whose first and last crossing (along the strand) are in the same state: the unavoidable defect at a ring's seam. */
  readonly seams: readonly SeamBreak[];
}
export interface SeamBreak { readonly strand: number; readonly strandId: string; readonly before: string; readonly after: string }

/** Closed strands whose last and first crossings do not alternate (see `surfaceCrossingSet`). */
export function seamBreaks(built: SurfaceWeaveStrands, order: CrossingOrder): readonly SeamBreak[] {
  const out: SeamBreak[] = [];
  built.strands.forEach((strand, index) => {
    const list = order.occurrences[index];
    if (!strand.closed || list.length < 2) return;
    const first = list[0], last = list[list.length - 1], state = (o: typeof first): number => order.over[o.crossing] === o.side ? 1 : 0;
    if (state(first) === state(last)) out.push(Object.freeze({ strand: index, strandId: strand.id, before: built.crossings[last.crossing].id, after: built.crossings[first.crossing].id }));
  });
  return Object.freeze(out);
}

/** Family ranks for the `rank` rule: family B (rank 1) is over family A. */
export const familyRanks = (strands: readonly SurfaceStrand[]): number[] => strands.map((strand) => strand.family);

/** The strands, crossings and their over/under order: everything the camera stage reads. */
export function surfaceWeaveOrder(built: SurfaceWeaveStrands, order: SurfaceWeaveOrder, seed: number): SurfaceWeaveProducts {
  const flips = order.exceptions.map((number) => {
    const crossing = built.crossings[number - 1];
    if (!crossing) throw new Error(`Exceptions: crossing ${number} does not exist; this weave has ${built.crossings.length} crossings`);
    return crossing.id;
  });
  const orderOptions: CrossingOrderOptions = Object.freeze({ rule: order.rule, seed, ranks: order.rule === "rank" ? Object.freeze(familyRanks(built.strands)) : undefined, flips: Object.freeze(flips), invert: order.invert });
  const result = orderCrossings(built.set, orderOptions);
  return Object.freeze({ ...built, order: result, orderOptions, seams: seamBreaks(built, result) });
}
