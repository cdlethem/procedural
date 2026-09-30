import { roadsParcelsDefinition } from "../adapters/roads-parcels-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, componentSeed, createCompositionRun, inside, strokeWith } from "./core.js";
import { selectGraph } from "./graph.js";
import type { GraphView } from "./graph.js";
import { motif, pathMaterial, regionFill } from "./materials.js";
import { growRoads, prepareRoads, roadNetwork } from "./road-network.js";
import type { RoadNetwork, RoadPlacement, RoadSnapshots } from "./road-network.js";
import type { RoadGrowthParams } from "./road-growth.js";
import { classWidth, prepareBlocks, prepareParcels, roadBlocks, roadClass, roadParcels } from "./road-parcels.js";
import type { BlockOptions, LotOptions, Parcel, RoadBlocks, RoadHierarchy, RoadParcels, RoadWidths, TypeRule, UnbuiltRule } from "./road-parcels.js";
import { roadGrowthParams } from "./roads-parcels-params.js";
import type { CompositionRun, CompositionSurface, MotifSpec, Path, PathMaterial, PathMaterialSpec, Region, RegionFillSpec, RegionFiller, Site } from "./types.js";

/**
 * Roads and Parcels as a typed, JSON-compatible composition: ONE producer chain and several consumers of it.
 *
 *   growth (stepped simulation, `road-growth.ts`) → network (`road-network.ts`) → blocks → parcels
 *
 * `roadsParcelsProducts(recipe)` returns that chain (frozen values, each cached by the identity of the one
 * before it), and `drawRoadsParcels(surface, recipe, consumers)` reads it with four treatments:
 *
 * - LOTS: every parcel of role `lot` is painted by the filler of its type: flat colour (the parcel's own
 *   polygon), or hatching, dots or contours through the existing `regionFill` in the parcel's frame (the largest
 *   rectangle turned to its road that fits inside it), with the hatching direction measured from the road.
 *   `open` types leave the lot empty. An underpaint tints the polygon under a hatched, dotted or contoured
 *   lot; outlines draw the exact polygon.
 * - ROADS: the streets (one `Path` each, so stitches and beads run through junctions) drawn by the existing
 *   `pathMaterial`, one class at a time, streets first and avenues on top, in the class's width.
 * - JUNCTION MARKS: `motif` at every node of degree 3 or more (larger at four or more).
 * - Unbuilt land (reserved zone, hub plaza, blocks left unbuilt, courts, slivers) is never painted: it is the
 *   layer's transparent negative space.
 *
 * Palette roles: 0 ink (roads, outlines), 1 / 2 / 3 lot types A / B / C, 4 accent (junction marks; middle-aged
 * streets when coloured by age). Short palettes wrap. Nothing here paints a background.
 *
 * What is construction and what is appearance: `growth` and `steps` decide the network (its cache key);
 * `placement` moves it; `hierarchy`, `widths` and `setback` decide the land; `lots` decide the parcels; everything
 * else only paints. `drawRoadsParcels(surface, recipe, { road, lot })` replaces the road material or the lot filler
 * with an ordinary callback while the network, blocks and parcels stay the same cached objects.
 * Persisted instruments name only these scalars; user-supplied geometry is a future host feature.
 */
export type LotFill = "solid" | "hatch" | "dots" | "contours" | "none";

export interface RoadsParcelsComposition {
  kind: "roads-parcels";
  seed: number;
  palette: readonly number[];
  growth: RoadGrowthParams;
  steps: number;
  placement: RoadPlacement;
  hierarchy: RoadHierarchy;
  widths: RoadWidths;
  setback: number;
  lots: { lotWidth: number; lotDepth: number; variety: number; unbuiltShare: number; unbuiltRule: UnbuiltRule; typeBy: TypeRule; focus: readonly [number, number] };
  fill: { types: readonly [LotFill, LotFill, LotFill]; spacing: number; weight: number; hatchAngle: number; inset: number; underpaint: number; outline: boolean; outlineWeight: number };
  roads: { material: "ink" | "stitch" | "beads"; stitchSpacing: number; color: "ink" | "age"; junctionMark: "none" | "dot" | "rings"; markSize: number };
}

/** Replace either consumer of `drawRoadsParcels` with an ordinary callback. */
export interface RoadsParcelsConsumers {
  /** Called for every street with its class (0 avenue, 1 collector, 2 street) already resolved into the path's `level`. */
  road?: PathMaterial;
  /** Called for every lot in its own frame: local (0, 0) is the corner of the lot's rectangle, `region.bounds` its size. */
  lot?: RegionFiller;
}

export interface RoadsParcelsProducts {
  readonly snapshots: RoadSnapshots;
  readonly network: RoadNetwork;
  readonly blocks: RoadBlocks;
  readonly parcels: RoadParcels;
}

type Scalar = number | string | boolean;
const definition = roadsParcelsDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function roadsParcelsComposition(input: InstrumentInput): RoadsParcelsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const angle = q.rotation as number * Math.PI / 180, fx = q.focusX as number, fy = q.focusY as number;
  return {
    kind: "roads-parcels", seed: input.seed, palette: [...input.palette], growth: roadGrowthParams(q), steps: q.steps as number,
    placement: { centerX: q.centerX as number, centerY: q.centerY as number, rotation: q.rotation as number },
    hierarchy: { avenues: q.avenues as number, collectors: q.collectors as number },
    widths: { avenue: q.avenueWidth as number, collector: q.collectorWidth as number, street: q.streetWidth as number },
    setback: q.setback as number,
    lots: { lotWidth: q.lotWidth as number, lotDepth: q.lotDepth as number, variety: q.lotVariety as number, unbuiltShare: q.unbuiltShare as number,
      unbuiltRule: q.unbuiltRule as UnbuiltRule, typeBy: q.typeBy as TypeRule,
      focus: [q.centerX as number + Math.cos(angle) * fx - Math.sin(angle) * fy, q.centerY as number + Math.sin(angle) * fx + Math.cos(angle) * fy] },
    fill: { types: [q.typeA as LotFill, q.typeB as LotFill, q.typeC as LotFill], spacing: q.fillSpacing as number, weight: q.fillWeight as number,
      hatchAngle: q.hatchAngle as number, inset: q.fillInset as number, underpaint: q.underpaint as number, outline: q.lotOutline as boolean, outlineWeight: q.outlineWeight as number },
    roads: { material: q.roadMaterial as "ink" | "stitch" | "beads", stitchSpacing: q.stitchSpacing as number, color: q.roadColor as "ink" | "age",
      junctionMark: q.junctionMark as "none" | "dot" | "rings", markSize: q.markSize as number },
  };
}

const blockOptions = (r: RoadsParcelsComposition): BlockOptions => ({ hierarchy: r.hierarchy, widths: r.widths, setback: r.setback });
const lotOptions = (r: RoadsParcelsComposition): LotOptions => ({ ...r.lots, seed: componentSeed(r.seed, "roads-parcels", "lots") });

/** The whole producer chain of a recipe, exactly as drawn. Frozen; cached by construction (growth), then by the options of each stage. */
export function roadsParcelsProducts(recipe: RoadsParcelsComposition): RoadsParcelsProducts {
  const snapshots = growRoads(recipe.growth, recipe.seed, recipe.steps);
  const network = roadNetwork(snapshots, recipe.placement);
  const blocks = roadBlocks(network, blockOptions(recipe));
  return Object.freeze({ snapshots, network, blocks, parcels: roadParcels(blocks, lotOptions(recipe)) });
}

/** Build every cached value the recipe draws from, yielding to the host; false if cancelled (nothing partial is cached). */
export async function prepareRoadsParcels(recipe: RoadsParcelsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const snapshots = await prepareRoads(recipe.growth, recipe.seed, recipe.steps, cancelled);
  if (!snapshots) return false;
  const network = roadNetwork(snapshots, recipe.placement);
  const blocks = await prepareBlocks(network, blockOptions(recipe), cancelled);
  if (!blocks) return false;
  return (await prepareParcels(blocks, lotOptions(recipe), cancelled)) !== null;
}

/* --------------------------------------------------------------------------------- treatments */

const dot = (size: number): MotifSpec => ({ kind: "dot", size, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 });

function fillSpec(kind: "hatch" | "motifs" | "contours", f: RoadsParcelsComposition["fill"]): RegionFillSpec {
  return { kind, inset: f.inset, retention: 1, spacing: f.spacing, angle: f.hatchAngle, weight: f.weight, underpaint: 0, mark: dot(f.weight * 2.2),
    material: { kind: "ink", weight: f.weight, spacing: f.spacing, phase: .5, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot(f.weight * 2.2) },
    contour: { source: "noise", resolution: 24, frequency: 1.4, aspect: 1, hillCount: 3, hillRadius: .5, levelBase: .3, levelStep: Math.max(.04, f.spacing / 40), levels: 6 } };
}

const junctionViews = new WeakMap<RoadNetwork, GraphView>();
function junctions(network: RoadNetwork): GraphView {
  let view = junctionViews.get(network);
  if (!view) {
    view = selectGraph(network.graph, { minDegree: 3, maxDegree: 60_000, minWeight: 0, maxWeight: 1, minAge: 0, maxAge: 1, isolated: false });
    junctionViews.set(network, view);
  }
  return view;
}

/** Road materials by class: ink and stitches at the class's width, beads sized to it. */
function roadMaterial(recipe: RoadsParcelsComposition, cls: number): PathMaterial {
  const width = classWidth(recipe.widths, cls), r = recipe.roads;
  const spec: PathMaterialSpec = { kind: r.material, weight: width, spacing: r.stitchSpacing, phase: .5, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot(width * 1.8) };
  return pathMaterial(spec, recipe.palette);
}

function lotPolygon(surface: CompositionSurface, parcel: Parcel): void {
  surface.beginShape();
  for (const [x, y] of parcel.region.outer) surface.vertex(x, y);
  surface.endShape(surface.CLOSE);
}
const rgb = (palette: readonly number[], tone: number): [number, number, number] => {
  const value = palette[tone % palette.length] >>> 0;
  return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
};

/** Paint the lots of `parcels` (underpaint, filler, outline), one parcel at a time. */
function drawLots(surface: CompositionSurface, recipe: RoadsParcelsComposition, parcels: RoadParcels, consumers: RoadsParcelsConsumers, run: CompositionRun): void {
  const { fill, palette } = recipe;
  const fillers = fill.types.map((kind, type) => {
    if (kind === "none" || kind === "solid") return null;
    return regionFill(fillSpec(kind === "dots" ? "motifs" : kind, fill), [palette[(type + 1) % palette.length]]);
  });
  for (const parcel of parcels.lots) {
    run.check();
    const kind = fill.types[parcel.type];
    if (kind === "none" && !fill.outline) continue;
    surface.push();
    try {
      const [r, g, b] = rgb(palette, parcel.type + 1);
      if (kind === "solid" || (kind !== "none" && fill.underpaint > 0)) {
        surface.noStroke();
        surface.fill(r, g, b, kind === "solid" ? 235 : Math.round(fill.underpaint * 255));
        lotPolygon(surface, parcel);
      }
      const frame = parcel.frame;
      const filler = consumers.lot ?? fillers[parcel.type];
      if (filler && frame && kind !== "none" && kind !== "solid") {
        const region: Region = { id: parcel.id, seed: parcel.seed, bounds: [-frame.width / 2, -frame.height / 2, frame.width / 2, frame.height / 2] };
        surface.push();
        try {
          surface.translate(frame.center[0], frame.center[1]);
          surface.rotate(frame.angle);
          inside(surface, [region], filler, run);
        } finally { surface.pop(); }
      }
      if (fill.outline && fill.outlineWeight > 0) {
        const [ir, ig, ib] = rgb(palette, 0);
        surface.noFill(); surface.stroke(ir, ig, ib, 150); surface.strokeWeight(fill.outlineWeight);
        lotPolygon(surface, parcel);
      }
    } finally { surface.pop(); }
  }
}

/** The streets of a network as materialised paths: class in `level`, tone by the road colour rule. */
export function roadPaths(recipe: RoadsParcelsComposition, network: RoadNetwork): readonly (readonly Path[])[] {
  const groups: Path[][] = [[], [], []];
  const routes = Math.max(1, network.progress.streets - 1);
  for (const street of network.streets) {
    const cls = roadClass(street, recipe.hierarchy);
    const band = recipe.roads.color === "age" && street.kind === "route" ? Math.min(2, Math.floor(3 * street.rank / (routes + 1))) : 0;
    groups[cls].push({ ...street.path, level: cls, tone: [0, 4, 1][band] });
  }
  return groups;
}

/**
 * Draw the recipe: lots (with their fills and outlines), then roads (streets, collectors, avenues), then junction
 * marks. Each treatment is an ordinary `strokeWith` / `atEach` / `inside` over a cached frozen value.
 */
export function drawRoadsParcels(surface: CompositionSurface, recipe: RoadsParcelsComposition, consumers: RoadsParcelsConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 2_000_000 })): void {
  run.check();
  const products = roadsParcelsProducts(recipe);
  drawLots(surface, recipe, products.parcels, consumers, run);
  const groups = roadPaths(recipe, products.network);
  for (const cls of [2, 1, 0]) if (groups[cls].length > 0 && classWidth(recipe.widths, cls) > 0) strokeWith(surface, groups[cls], consumers.road ?? roadMaterial(recipe, cls), run);
  const { junctionMark, markSize } = recipe.roads;
  if (junctionMark !== "none" && markSize > 0) {
    const view = junctions(products.network);
    const sites: Site[] = view.nodes.map((node) => ({ id: node.id, seed: node.seed, position: node.position, angle: 0, scale: node.degree >= 4 ? 1.4 : 1, tone: 4 }));
    atEach(surface, sites, motif({ ...dot(markSize), kind: junctionMark === "dot" ? "dot" : "rings", weight: 1.1 }, recipe.palette), run);
  }
}
