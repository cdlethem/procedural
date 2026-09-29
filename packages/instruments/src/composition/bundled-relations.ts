import { GROUP_COUNT, bundledRelationsDefinition } from "../adapters/bundled-relations-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { relationColumns, relationSample } from "./bundle-samples.js";
import { bundleEdges, groupBands, highlightedEdges, layoutEndpoints, pathMarkers, relationsFromTables, selectRelations } from "./bundling.js";
import type { BundleOptions, BundledEdges, BundledPath, EdgeScope, EndpointLayout, EndpointLayoutOptions, LayoutFrame, FamilyHighlight, EndpointOrder,
  RelationColumns, RelationData, SectorBasis } from "./bundling.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { dataTable } from "./data-table.js";
import type { DataTable, DataTableInput } from "./data-table.js";
import { MAX_GRAPH_EDGES, nodeFraction, nodeSites } from "./graph.js";
import type { GraphRoleOptions, GraphView } from "./graph.js";
import { motif, pathMaterial } from "./materials.js";
import { memoized } from "./sources.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Site } from "./types.js";

/**
 * Bundled RelationData as a typed, JSON-compatible composition: two owned tables, an endpoint layout, a
 * selection, the bundling options, a highlight rule and per-role materials. Every stage is the
 * ordinary function from `bundling.ts` applied to the cached, frozen product of the stage before it;
 * appearance (materials, colours, arrows, marks) never recomputes a stage and can never rename or
 * move a path.
 *
 * Stages and their cache keys (construction only; never palette, material or mark):
 *   relations    tables + seed + directed
 *   layout       + endpoint options
 *   selection    + scope, weight range, retention
 *   bundles      + bundle options
 *   plan         + edge tone, highlight rule, arrow, place-size mapping (geometry the consumers draw)
 *
 * Drawing order, back to front: group bands, edges by weight band (light to heavy), highlighted edges,
 * arrowheads, places. Edge weight is encoded in five weight bands (`sqrt(weight fraction)`, so
 * the many light flows and the few heavy ones both read) of stroke width or bead size.
 *
 * Substitution. `drawBundledRelations(surface, recipe, consumers)` replaces the edge, highlight, arrow,
 * place or band consumer with an ordinary callback that receives the same frozen paths or sites.
 * `bundledStructure(recipe)` exposes the relations, layout, selection and bundled paths for any other
 * consumer. Host binding of a user's own tables is future host work: a recipe accepts any two tables
 * (`relationsFromTables` documents the columns) but the named instrument reads the bundled samples.
 *
 * Bounds (errors name the control): edge and vertex counts (`minWeight`/`retention`, `detail`) in
 * `bundleEdges`, and the drawing work of stitches and beads (`edgeSpacing`, `highlightSpacing`,
 * `detail`) before anything is drawn.
 */
export interface BundledRelationsRecipe {
  kind: "bundled-relations";
  seed: number;
  palette: readonly number[];
  relations: { nodes: DataTableInput | DataTable; edges: DataTableInput | DataTable; columns: RelationColumns; directed: boolean };
  layout: EndpointLayoutOptions;
  select: { scope: EdgeScope; minWeight: number; maxWeight: number; retention: number };
  bundle: BundleOptions;
  highlight: { rule: FamilyHighlight; tone: "edge" | "ink"; material: PathMaterialSpec };
  edges: { material: PathMaterialSpec; tone: EdgeTone; contrast: number };
  /** Arrowheads at fraction `at` along each directed edge; size 0 draws none. */
  arrows: { mark: MotifSpec; at: number; share: number };
  places: { mark: MotifSpec; scaleBy: "none" | "weight"; amount: number };
  /** Group bands: stroke weight 0 draws none; `offset` canvas units outside the endpoints. */
  bands: { weight: number; offset: number };
}

/** Palette role of an edge: one color, its source group, its target group, or source then target (each half of its length). */
export type EdgeTone = "flat" | "source" | "target" | "flow";

export interface BundledConsumers {
  edge?: PathMaterial;
  highlight?: PathMaterial;
  band?: PathMaterial;
  arrow?: Mark;
  place?: Mark;
}

/** The frozen products of the construction stages, exactly as drawn. */
export interface BundledStructure {
  readonly relations: RelationData;
  readonly layout: EndpointLayout;
  readonly view: GraphView;
  readonly bundled: BundledEdges;
  readonly highlighted: ReadonlySet<string>;
}
/** The geometry the consumers draw: paths already toned and split into weight bands, marker and place sites. */
interface Plan {
  readonly structure: BundledStructure;
  readonly bands: readonly Path[];
  readonly base: readonly (readonly Path[])[];
  readonly highlight: readonly (readonly Path[])[];
  readonly arrows: readonly Site[];
  readonly places: readonly Site[];
}

export const WEIGHT_BANDS = 5;
/** Most units (path callbacks, vertices and stations) the material passes may charge; the shared run allows 100,000. */
export const MAX_MATERIAL_WORK = 80_000;
const BAND_OFFSET = 11;

const relationsStore = new Map<string, RelationData>();
const layoutStore = new Map<string, EndpointLayout>();
const selectionStore = new Map<string, GraphView>();
const bundleStore = new Map<string, BundledEdges>();
const structureStore = new Map<string, BundledStructure>();
const plans = new WeakMap<BundledStructure, Map<string, Plan>>();

function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function validate(recipe: BundledRelationsRecipe): void {
  finite("minWeight", recipe.select.minWeight, 0, 1); finite("maxWeight", recipe.select.maxWeight, recipe.select.minWeight, 1);
  finite("weightContrast", recipe.edges.contrast, 0, .95);
  finite("nodeScaleAmount", recipe.places.amount, 0, .95);
  finite("arrowAt", recipe.arrows.at, 0, 1); finite("arrowShare", recipe.arrows.share, 0, 1);
  finite("bandWeight", recipe.bands.weight, 0, 50);
  if (recipe.select.scope !== "all" && recipe.select.scope !== "between" && recipe.select.scope !== "within") throw new Error(`scope must be "all", "between" or "within"`);
}
const bandOf = (path: BundledPath) => Math.min(WEIGHT_BANDS - 1, Math.floor(Math.sqrt(path.weight) * WEIGHT_BANDS));

/** RelationData, layout, selection, bundles and highlight of a recipe; every level cached and frozen. */
export function bundledStructure(recipe: BundledRelationsRecipe): BundledStructure {
  validate(recipe);
  const nodes = dataTable(recipe.relations.nodes), edges = dataTable(recipe.relations.edges);
  const relationsKey = JSON.stringify([nodes.key, edges.key, recipe.relations.columns, recipe.seed, recipe.relations.directed]);
  const layoutKey = `${relationsKey}|${JSON.stringify(recipe.layout)}`;
  const selectionKey = `${layoutKey}|${JSON.stringify(recipe.select)}`;
  const bundleKey = `${selectionKey}|${JSON.stringify(recipe.bundle)}`;
  const structureKey = `${bundleKey}|${JSON.stringify(recipe.highlight.rule)}`;
  return memoized(structureStore, structureKey, () => {
    const relations = memoized(relationsStore, relationsKey, () => relationsFromTables(nodes, edges, recipe.relations.columns, { seed: recipe.seed, directed: recipe.relations.directed }));
    const layout = memoized(layoutStore, layoutKey, () => layoutEndpoints(relations, recipe.layout));
    const view = memoized(selectionStore, selectionKey, () => {
      const roles: GraphRoleOptions = { minDegree: 0, maxDegree: MAX_GRAPH_EDGES, minWeight: recipe.select.minWeight, maxWeight: recipe.select.maxWeight,
        minAge: 0, maxAge: 1, isolated: true };
      return selectRelations(layout, roles, { scope: recipe.select.scope, retention: recipe.select.retention });
    });
    const bundled = memoized(bundleStore, bundleKey, () => bundleEdges(layout, view, recipe.bundle));
    return Object.freeze({ relations, layout, view, bundled, highlighted: highlightedEdges(bundled, recipe.highlight.rule) });
  });
}

/** The palette index of an edge under a tone rule; group tones are `1 + group index` (0 is the ink color). */
function edgeTone(rule: EdgeTone, path: BundledPath): number {
  return rule === "flat" ? 0 : rule === "target" ? 1 + path.toGroup : 1 + path.fromGroup;
}

/** The two halves (by arc length) of a path: ids `<id>/from` and `<id>/to`, each keeping the path's level and seed. */
function halves(path: BundledPath, first: number, second: number): readonly [Path, Path] {
  const half = path.length / 2;
  const head: (readonly [number, number])[] = [path.points[0]], tail: (readonly [number, number])[] = [];
  let walked = 0, joint: readonly [number, number] | null = null;
  for (let i = 1; i < path.points.length; i++) {
    const p = path.points[i - 1], q = path.points[i], step = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (joint === null && walked + step >= half) {
      const f = step > 0 ? (half - walked) / step : 0;
      joint = Object.freeze([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f] as const);
      head.push(joint); tail.push(joint);
      if (f < 1) tail.push(q);
    } else if (joint === null) head.push(q);
    else tail.push(q);
    walked += step;
  }
  const make = (suffix: string, points: readonly (readonly [number, number])[], tone: number): Path => Object.freeze({
    id: `${path.id}/${suffix}`, seed: path.seed, points: Object.freeze(points), closed: false, level: path.level, levelFraction: path.levelFraction, tone });
  return [make("from", head, first), make("to", tail, second)];
}

function plan(recipe: BundledRelationsRecipe): Plan {
  const structure = bundledStructure(recipe);
  const { bundled, layout, highlighted } = structure;
  let inner = plans.get(structure);
  if (!inner) plans.set(structure, inner = new Map());
  const key = JSON.stringify([recipe.edges.tone, recipe.highlight.tone, recipe.arrows.at, recipe.arrows.mark.size, recipe.arrows.share, recipe.places.scaleBy,
    recipe.places.amount, recipe.bands.weight > 0, recipe.bands.offset, recipe.relations.directed]);
  return memoized(inner, key, () => {
    const split = (paths: readonly BundledPath[], rule: EdgeTone, ink: boolean) => {
      const groups: Path[][] = Array.from({ length: WEIGHT_BANDS }, () => []);
      for (const path of paths) {
        if (rule === "flow" && !ink) groups[bandOf(path)].push(...halves(path, edgeTone("source", path), edgeTone("target", path)));
        else groups[bandOf(path)].push(Object.freeze({ ...path, tone: ink ? 0 : edgeTone(rule, path) }));
      }
      return Object.freeze(groups.map((list) => Object.freeze(list)));
    };
    const base = bundled.paths.filter((path) => !highlighted.has(path.id));
    const hot = bundled.paths.filter((path) => highlighted.has(path.id));
    const graph = layout.graph;
    const groupAt = new Map(graph.nodes.map((node, index) => [node.id, layout.groups.groupOf[index]] as const));
    const arrows = recipe.relations.directed && recipe.arrows.mark.size > 0 && recipe.arrows.share > 0
      ? pathMarkers(bundled, { at: recipe.arrows.at, size: recipe.arrows.mark.size, share: recipe.arrows.share,
        tone: (path) => highlighted.has(path.id) && recipe.highlight.tone === "ink" ? 0 : edgeTone(recipe.edges.tone === "flow" ? (recipe.arrows.at < .5 ? "source" : "target") : recipe.edges.tone, path) }) : Object.freeze([]);
    const { amount, scaleBy } = recipe.places;
    const places = nodeSites(structure.view, {
      scale: scaleBy === "none" ? undefined : (node, g) => 1 - amount * (1 - nodeFraction(node, g, "weight")),
      tone: (node) => 1 + groupAt.get(node.id)! });
    return Object.freeze({ structure, bands: recipe.bands.weight > 0 ? groupBands(layout, recipe.bands.offset) : Object.freeze([]),
      base: split(base, recipe.edges.tone, false), highlight: split(hot, recipe.edges.tone, recipe.highlight.tone === "ink"), arrows, places });
  });
}

/** One weight band's material: stroke width (ink, stitches) or bead size scaled so the heaviest band keeps the authored value. */
function bandSpec(spec: PathMaterialSpec, contrast: number, band: number): PathMaterialSpec {
  const scale = 1 - contrast * (1 - (band + 1) / WEIGHT_BANDS);
  return spec.kind === "beads" ? { ...spec, mark: { ...spec.mark, size: spec.mark.size * scale } } : { ...spec, weight: spec.weight * scale };
}

/** Units the material passes charge: one per path, its vertices, and (stitches, beads) its stations. */
function materialWork(bands: readonly (readonly Path[])[], spec: PathMaterialSpec, spacingControl: string): number {
  let work = 0;
  for (const list of bands) for (const path of list) {
    work += 1 + path.points.length;
    if (spec.kind === "ink") continue;
    let length = 0;
    for (let i = 1; i < path.points.length; i++) length += Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1]);
    work += Math.max(1, Math.ceil(length / spec.spacing)) + 1;
  }
  if (work > MAX_MATERIAL_WORK) throw new Error(`Drawing these edges needs ${work} units; the limit is ${MAX_MATERIAL_WORK} (raise ${spacingControl}, lower detail or select fewer edges)`);
  return work;
}

/**
 * Draw the recipe into a caller-owned surface. Every callback is isolated by the shared consumers and
 * charged to `run`; nothing clears the canvas or fills it.
 */
export function drawBundledRelations(surface: CompositionSurface, recipe: BundledRelationsRecipe, consumers: BundledConsumers = {}, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const drawn = plan(recipe);
  const palette = recipe.palette;
  const { edges, highlight } = recipe;
  if (!consumers.edge) materialWork(drawn.base, edges.material, "edgeSpacing");
  if (!consumers.highlight) materialWork(drawn.highlight, highlight.material, "highlightSpacing");
  if (drawn.bands.length > 0)
    strokeWith(surface, drawn.bands, consumers.band ?? pathMaterial({ kind: "ink", weight: recipe.bands.weight, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
      mark: { kind: "dot", size: 4, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, palette), run);
  if (consumers.edge) strokeWith(surface, drawn.base.flat(), consumers.edge, run);
  else drawn.base.forEach((list, band) => { if (list.length > 0) strokeWith(surface, list, pathMaterial(bandSpec(edges.material, edges.contrast, band), palette), run); });
  if (consumers.highlight) strokeWith(surface, drawn.highlight.flat(), consumers.highlight, run);
  else drawn.highlight.forEach((list, band) => { if (list.length > 0) strokeWith(surface, list, pathMaterial(bandSpec(highlight.material, edges.contrast, band), palette), run); });
  if (drawn.arrows.length > 0) atEach(surface, drawn.arrows, consumers.arrow ?? motif({ ...recipe.arrows.mark, retention: 1 }, palette), run);
  if (recipe.places.mark.size > 0 && recipe.places.mark.retention > 0 && drawn.places.length > 0)
    atEach(surface, drawn.places, consumers.place ?? motif(recipe.places.mark, palette), run);
}

/** Build every cached value the recipe draws from, honouring cancellation between stages. */
export async function prepareBundledRelations(recipe: BundledRelationsRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const drawn = plan(recipe);
  materialWork(drawn.base, recipe.edges.material, "edgeSpacing");
  materialWork(drawn.highlight, recipe.highlight.material, "highlightSpacing");
  pathMaterial(recipe.edges.material, recipe.palette); pathMaterial(recipe.highlight.material, recipe.palette);
  motif(recipe.places.mark, recipe.palette);
  return !cancelled();
}

/* ------------------------------------------------ named-instrument binding */

type Scalar = number | string | boolean;
const mark = (kind: MotifSpec["kind"], size: number, weight: number, petals = 6, opening = 0): MotifSpec =>
  ({ kind, size, petals: kind === "arrow" ? 0 : petals, opening, weight, rotation: 0, variation: 0, retention: 1 });
const material = (kind: PathMaterialSpec["kind"], weight: number, spacing: number, bead: MotifSpec): PathMaterialSpec =>
  ({ kind, weight, spacing, phase: .5, phaseSpread: 0, levelRamp: 0, retention: 1, mark: bead });

/**
 * Resolve the stored scalar controls to the public recipe. The chosen bundled tables are embedded by
 * value. Only controls that apply to the chosen layout, direction and highlight reach the recipe.
 */
export function bundledRelationsComposition(input: InstrumentInput): BundledRelationsRecipe {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) => !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(bundledRelationsDefinition, input.params) as Record<string, Scalar>;
  const num = (key: string) => q[key] as number;
  const sample = relationSample(q.dataset as string);
  const directed = q.direction === "source" && sample.directed;
  const frame: LayoutFrame = { centerX: num("centerX"), centerY: num("centerY"), width: num("width"), height: num("height"), rotation: num("rotation") };
  const layout: EndpointLayoutOptions = q.endpoints === "circle"
    ? { kind: "circle", frame, startAngle: num("startAngle"), gap: num("groupGap"), sectorBy: q.sectorBy as SectorBasis, order: q.nodeOrder as EndpointOrder }
    : q.endpoints === "line" ? { kind: "line", frame, gap: num("groupGap"), sectorBy: q.sectorBy as SectorBasis, order: q.nodeOrder as EndpointOrder }
      : { kind: "graph", frame, fit: true };
  const highlightKind = q.highlight as string;
  const rule: FamilyHighlight = highlightKind === "group" ? { kind: "group", group: num("focusGroup") - 1 }
    : highlightKind === "pair" ? { kind: "pair", group: num("focusGroup") - 1, partner: num("partnerGroup") - 1 }
      : highlightKind === "heaviest" ? { kind: "heaviest", share: num("heaviestShare") } : { kind: "none" };
  const bead = (key: string, size: string) => mark(q[key] as MotifSpec["kind"], num(size), 1);
  return {
    kind: "bundled-relations", seed: input.seed, palette: [...input.palette],
    relations: { nodes: sample.nodes, edges: sample.edges, columns: relationColumns, directed },
    layout,
    select: { scope: q.scope as EdgeScope, minWeight: num("minWeight"), maxWeight: 1, retention: num("retention") },
    bundle: { strength: num("strength"), inset: num("inset"), lift: num("lift"), separation: num("separation"), detail: num("detail"),
      families: directed && q.families === "directed" ? "directed" : "pair" },
    highlight: { rule, tone: q.highlightTone as "edge" | "ink",
      material: material(q.highlightMaterial as PathMaterialSpec["kind"], num("highlightWeight"), num("highlightSpacing"), bead("highlightBead", "highlightBeadSize")) },
    edges: { material: material(q.edgeMaterial as PathMaterialSpec["kind"], num("edgeWeight"), num("edgeSpacing"), bead("edgeBead", "edgeBeadSize")),
      tone: q.edgeTone as EdgeTone, contrast: num("weightContrast") },
    arrows: { mark: mark("arrow", directed && q.arrows === true ? num("arrowSize") : 0, 1.1), at: num("arrowAt"), share: num("arrowShare") },
    places: { mark: mark(q.nodeMark as MotifSpec["kind"], num("nodeSize"), 1.2, 8), scaleBy: q.nodeScaleBy === "weight" ? "weight" : "none", amount: num("nodeScaleAmount") },
    bands: { weight: (q.endpoints !== "map" && q.groupBands === true) ? num("bandWeight") : 0, offset: BAND_OFFSET },
  };
}

/** Whether a new seed can change what these controls draw. */
export function bundledRelationsUsesSeed(q: InstrumentInput["params"]): boolean {
  if (Number(q.retention) > 0 && Number(q.retention) < 1) return true;
  // Arrowheads on a fraction of the edges are chosen by edge seed (only directed datasets have any).
  if (q.direction === "source" && q.arrows === true && q.dataset !== "citations" && Number(q.arrowShare) > 0 && Number(q.arrowShare) < 1) return true;
  return q.endpoints !== "map" && q.nodeOrder === "shuffled";
}
