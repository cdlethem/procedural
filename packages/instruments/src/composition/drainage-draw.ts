import { drainageErosionDefinition } from "../adapters/drainage-erosion-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, cachedBy, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { erodedTerrain, erosionCache, erosionSimulation, checkErosionWork, MAX_EROSION_WORK, RETENTION, type ErosionParams, type ErosionProjection, type ErosionSnapshots } from "./drainage-erosion.js";
import { analyzeDrainage, drainageBasins, streamNetwork, type BasinMap, type Drainage, type GridFrame, type StreamNetwork, type StreamReach } from "./drainage-network.js";
import { basinColors, hillshadePatch, lakeDomain } from "./drainage-shade.js";
import { erosionParamsFor, footprintFor, viewFor, drainageUsesSeed, type DrainageView, type Footprint } from "./drainage-settings.js";
import { domainRings, keyholeRing, type PlanarDomain } from "./domains.js";
import { hatchDomain } from "./domains-paths.js";
import { labelDomains, type LabelDomain } from "./domains-raster.js";
import { gridContours } from "./grid-contours.js";
import { motif, pathMaterial } from "./materials.js";
import { shadedPatch } from "./stroke-relief.js";
import type { ShadedPatch } from "./relief.js";
import type { CompositionRun, CompositionSurface, Mark, Path, PathMaterial, Site } from "./types.js";

/**
 * Drainage and Erosion as a typed composition: one retained simulation (`drainage-erosion.ts`) and several
 * treatments that read the same snapshot. See `docs/composition-drainage-erosion.md`.
 *
 * INPUT. `terrain` (the construction: grid, landform, water, bedrock, erosion), `steps` (how long), `footprint` (where the
 * grid sits on the canvas) and `view` (what is drawn and how). Persisted instruments name only scalar controls and a
 * palette; the typed value is also accepted directly. A host's own terrain (a resolved height raster) is future work: the
 * initial state is `initialTerrain` and would be replaced by an input there.
 *
 * TREATMENTS (each computed only when its view asks for it, each a frozen value cached on the snapshot):
 *  - hillshade: transparent polygon bands of light and shadow (`drainage-shade.ts`);
 *  - contours: linear-time marching-square chains of the height (`grid-contours.ts`), drawn by `pathMaterial` ink, index
 *    contours heavier, optionally with the contours of the starting terrain beneath;
 *  - streams: the reaches of the stream network (`drainage-network.ts`), width by accumulated flow as ribbons, or as paths
 *    through `pathMaterial` ink, stitches or beads by Strahler order;
 *  - basins: label grid to planar regions with holes (`labelDomains`), washed, hatched or outlined by their divides;
 *  - lakes: the filled depressions as planar regions; marks: `atEach` over the nodes of the network.
 *
 * PALETTE. Entry 0 is the ink (contours, divides, marks, hillshade shadow), entry 1 the water (streams, lakes, and the tint of the
 * light), entries 2.. the basin washes (entry 1 when there are only two). Appearance never reaches the simulation: a palette or
 * view edit reuses the same `Snapshots` object (asserted by identity in the tests) and only re-extracts what it changes.
 *
 * WORK. Drawing charges a composition run one unit per path, band, region and site; the extraction has the bounds
 * documented on each producer (contour levels, shading vertices, stream cells, hatch strokes), which throw naming the control.
 */
export interface DrainageErosionComposition {
  kind: "drainage-erosion";
  seed: number;
  palette: readonly number[];
  terrain: ErosionParams;
  steps: number;
  footprint: Footprint;
  view: DrainageView;
}

const definition = drainageErosionDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function drainageErosionComposition(input: InstrumentInput): DrainageErosionComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length < 2 || input.palette.some((color) => !Number.isSafeInteger(color) || color < 0 || color > 0xffffff))
    throw new Error("Drainage and Erosion needs at least two packed RGB colors (ink, water)");
  const q = validateParameterValues(definition, input.params);
  return { kind: "drainage-erosion", seed: input.seed, palette: [...input.palette], terrain: erosionParamsFor(q), steps: q.steps as number, footprint: footprintFor(q), view: viewFor(q) };
}

/** The seed the simulation sees: 0 where nothing in the construction draws from it, so a seed edit reuses the run. */
export const simulationSeed = (recipe: Pick<DrainageErosionComposition, "seed" | "terrain">): number =>
  drainageUsesSeed({ shape: recipe.terrain.shape, roughness: recipe.terrain.roughness, rainMode: recipe.terrain.rainMode, bedrock: recipe.terrain.bedrock }) ? recipe.seed : 0;

/** The most contour levels one drawing may ask for. */
export const MAX_CONTOUR_LEVELS = 200;
/** The most hatch strokes basins may draw. */
export const MAX_HATCH_STROKES = 150_000;

export interface BasinGeometry {
  readonly map: BasinMap;
  readonly domains: readonly LabelDomain[];
  /** Colour index of each label (entry `label - 1`). */
  readonly colors: Int32Array;
}
/** Everything the consumers read. Fields the view does not need are null. */
export interface DrainageProducts {
  readonly snapshots: ErosionSnapshots;
  readonly terrain: Readonly<ErosionProjection>;
  readonly initial: Readonly<ErosionProjection>;
  readonly frame: GridFrame;
  readonly drainage: Drainage | null;
  readonly network: StreamNetwork | null;
  readonly basins: BasinGeometry | null;
  readonly lakes: PlanarDomain | null;
  readonly patch: ShadedPatch | null;
  readonly contours: readonly Path[] | null;
  readonly ghost: readonly Path[] | null;
}

const maxOf = (values: ArrayLike<number>): number => { let m = 0; for (let i = 0; i < values.length; i++) if (values[i] > m) m = values[i]; return m; };

const contourCache = new WeakMap<object, Map<string, readonly Path[]>>();
/** Contour chains of a height grid at multiples of `interval` up to `top` (cached on the height array). */
export function terrainContours(height: Float64Array, columns: number, rows: number, frame: GridFrame, interval: number, top: number, seed: number): readonly Path[] {
  if (!Number.isFinite(interval) || interval <= 0) throw new Error(`Contour interval must be positive (got ${String(interval)})`);
  const count = Math.floor(top / interval + 1e-9);
  if (count > MAX_CONTOUR_LEVELS) throw new Error(`The contour interval ${interval} makes ${count} levels, above ${MAX_CONTOUR_LEVELS}; raise the contour interval`);
  return cachedBy(contourCache, height, JSON.stringify([columns, rows, frame.left, frame.top, frame.cell, interval, count, seed]), () =>
    gridContours({ values: height, columns, rows, x0: frame.left + frame.cell / 2, y0: frame.top + frame.cell / 2, dx: frame.cell, dy: frame.cell },
      Array.from({ length: count }, (_, k) => (k + 1) * interval), seed, "; raise the contour interval or lower the resolution"));
}

const basinCache = new WeakMap<object, Map<string, BasinGeometry>>();
function basinGeometry(drainage: Drainage, network: StreamNetwork, frame: GridFrame, depth: number, colors: number): BasinGeometry {
  return cachedBy(basinCache, network, JSON.stringify([depth, frame.left, frame.top, frame.cell, colors]), () => {
    const map = drainageBasins(drainage, network, depth);
    const domains = labelDomains({ width: map.columns, height: map.rows, data: map.labels }, { cell: frame.cell, origin: [frame.left, frame.top], background: 0, simplify: frame.cell * 1.5, id: "basin" });
    return Object.freeze({ map, domains, colors: basinColors(map.labels, map.columns, map.rows, map.basins.length, colors) });
  });
}

const washesOf = (palette: readonly number[]): readonly number[] => palette.length > 2 ? palette.slice(2) : [palette[1]];

/** Producer results: the cached values the consumers draw. */
export function drainageErosionProducts(recipe: DrainageErosionComposition, control: { cancelled?: () => boolean } = {}): DrainageProducts {
  const { terrain: params, view, footprint } = recipe, seed = simulationSeed(recipe);
  const snapshots = erodedTerrain(params, seed, recipe.steps, control);
  const final = snapshots.final, initial = snapshots.history[0].value;
  const frame: GridFrame = { left: footprint.left, top: footprint.top, cell: footprint.cell };
  const { columns, rows } = params, spacing = 1 / Math.max(columns, rows);
  const needsNetwork = view.streams !== "none" || view.basins !== "none" || view.marks !== "none";
  const drainage = needsNetwork || view.lakes ? analyzeDrainage(final.height as Float64Array, params, seed, control) : null;
  const network = needsNetwork && drainage ? streamNetwork(drainage, frame, { threshold: view.streamThreshold, smooth: view.streamSmooth }, recipe.seed) : null;
  const basins = view.basins !== "none" && drainage && network ? basinGeometry(drainage, network, frame, view.basinDepth, washesOf(recipe.palette).length) : null;
  const top = Math.max(maxOf(final.height), maxOf(initial.height));
  const lakes = view.lakes && drainage ? lakeDomain(final.height as Float64Array, drainage.depth, columns, rows, maxOf(final.height), view.lakeDepth, frame) : null;
  const patch = view.shading ? hillshadePatch(final.height as Float64Array, columns, rows, frame, { azimuth: view.azimuth, elevation: view.elevation }, view.shadeDepth, spacing) : null;
  const contours = view.contours ? terrainContours(final.height as Float64Array, columns, rows, frame, view.contourInterval, top, recipe.seed) : null;
  const ghost = view.contours && view.ghost ? terrainContours(initial.height as Float64Array, columns, rows, frame, view.contourInterval, top, recipe.seed) : null;
  return { snapshots, terrain: final, initial, frame, drainage, network, basins, lakes, patch, contours, ghost };
}

/** Replace any consumer with an ordinary callback; every producer stays the same cached object. */
export interface DrainageConsumers {
  /** Contour lines: the ordinary and the index contours (`Path.level` is the elevation). */
  contour?: (index: boolean) => PathMaterial;
  /** One stream reach: `reach.flow` holds the flow share at every point. */
  stream?: (surface: CompositionSurface, reach: StreamReach, run: CompositionRun) => void;
  patch?: (surface: CompositionSurface, patch: ShadedPatch, run: CompositionRun) => void;
  mark?: Mark;
}

const channels = (color: number): [number, number, number] => [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
const fade = (color: number, share: number): number => {
  const [r, g, b] = channels(color), mix = (v: number) => Math.round(v * (1 - share) + 255 * share);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
};

/** The tapering ribbon of one reach: width `width × flow^0.5` (at least half a unit), an opaque polygon of the water colour. */
export function streamRibbon(color: number, width: number): NonNullable<DrainageConsumers["stream"]> {
  const [r, g, b] = channels(color);
  return (surface, reach) => {
    const { points, flow } = reach, count = points.length;
    if (count < 2) return;
    const left: [number, number][] = [], right: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const a = points[Math.max(0, i - 1)], c = points[Math.min(count - 1, i + 1)];
      const tx = c[0] - a[0], ty = c[1] - a[1], length = Math.hypot(tx, ty) || 1;
      const half = Math.max(0.5, width * Math.sqrt(flow[i])) / 2, nx = -ty / length * half, ny = tx / length * half;
      left.push([points[i][0] + nx, points[i][1] + ny]); right.push([points[i][0] - nx, points[i][1] - ny]);
    }
    surface.fill(r, g, b); surface.stroke(r, g, b); surface.strokeWeight(0.5);
    surface.beginShape();
    for (const [x, y] of left) surface.vertex(x, y);
    for (let i = count - 1; i >= 0; i--) surface.vertex(right[i][0], right[i][1]);
    surface.endShape(surface.CLOSE);
  };
}

function drawBasins(surface: CompositionSurface, geometry: BasinGeometry, recipe: DrainageErosionComposition, frame: GridFrame, run: CompositionRun): void {
  const { view, palette } = recipe, washes = washesOf(palette), style = view.basins;
  const { columns, rows } = recipe.terrain, right = frame.left + columns * frame.cell, bottom = frame.top + rows * frame.cell;
  const tolerance = frame.cell * 1e-6;
  if (style === "wash" || style === "wash-divides") {
    surface.noStroke();
    for (const { label, domain } of geometry.domains) {
      run.enter(domain.regions.length);
      try {
        const [r, g, b] = channels(washes[geometry.colors[label - 1]]);
        surface.fill(r, g, b, view.washAlpha * 255);
        for (const region of domain.regions) {
          surface.beginShape();
          for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
          surface.endShape(surface.CLOSE);
        }
      } finally { run.leave(); }
    }
  }
  if (style === "hatch") {
    let strokes = 0;
    surface.noFill(); surface.strokeCap(surface.ROUND); surface.strokeWeight(0.7);
    for (const { label, domain } of geometry.domains) {
      const color = geometry.colors[label - 1], lines = hatchDomain(domain, { angle: 15 + 47 * color, spacing: view.hatchSpacing, maxLines: MAX_HATCH_STROKES });
      strokes += lines.length;
      if (strokes > MAX_HATCH_STROKES) throw new Error(`Basin hatching needs more than ${MAX_HATCH_STROKES} strokes; raise the hatch spacing`);
      run.enter(1 + lines.length);
      try {
        const [r, g, b] = channels(washes[color]);
        surface.stroke(r, g, b, 210);
        for (const { points: [a, c] } of lines) surface.line(a[0], a[1], c[0], c[1]);
      } finally { run.leave(); }
    }
  }
  if (style === "divides" || style === "wash-divides") {
    const [r, g, b] = channels(palette[0]);
    surface.noFill(); surface.stroke(r, g, b, 200); surface.strokeWeight(view.dividesWeight); surface.strokeCap(surface.ROUND);
    for (const { domain } of geometry.domains) {
      run.enter(1);
      try {
        for (const ring of domainRings(domain)) {
          // Skip the stretches that lie along the footprint border: only interior divides are ridge lines.
          const onBorder = (p: readonly [number, number], q: readonly [number, number]) =>
            (Math.abs(p[0] - frame.left) < tolerance && Math.abs(q[0] - frame.left) < tolerance) || (Math.abs(p[0] - right) < tolerance && Math.abs(q[0] - right) < tolerance) ||
            (Math.abs(p[1] - frame.top) < tolerance && Math.abs(q[1] - frame.top) < tolerance) || (Math.abs(p[1] - bottom) < tolerance && Math.abs(q[1] - bottom) < tolerance);
          let open = false;
          for (let i = 0; i < ring.length; i++) {
            const p = ring[i], q = ring[(i + 1) % ring.length];
            if (onBorder(p, q)) { if (open) { surface.endShape(); open = false; } continue; }
            if (!open) { surface.beginShape(); surface.vertex(p[0], p[1]); open = true; }
            surface.vertex(q[0], q[1]);
          }
          if (open) surface.endShape();
        }
      } finally { run.leave(); }
    }
  }
}

function drawLakes(surface: CompositionSurface, lakes: PlanarDomain, water: number, run: CompositionRun): void {
  const [r, g, b] = channels(water);
  surface.noStroke(); surface.fill(r, g, b, 120);
  run.enter(Math.max(1, lakes.regions.length));
  try {
    for (const region of lakes.regions) {
      surface.beginShape();
      for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    }
  } finally { run.leave(); }
}

const inkSpec = (weight: number) => ({ kind: "ink" as const, weight, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot" as const, size: 3, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } });

/** The stock consumers of a recipe, from its palette and view. */
function stockContour(recipe: DrainageErosionComposition, faint: boolean): NonNullable<DrainageConsumers["contour"]> {
  const ink = faint ? fade(recipe.palette[0], 0.55) : recipe.palette[0], weight = recipe.view.contourWeight * (faint ? 0.7 : 1);
  return (index) => pathMaterial(inkSpec(index ? weight * 2.2 : weight), [ink]);
}

/** Draw the recipe into a caller-owned surface, bottom to top: basins, lakes, relief shading, starting contours, contours, streams, marks. */
export function drawDrainageErosion(surface: CompositionSurface, recipe: DrainageErosionComposition, consumers: DrainageConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 600_000 })): void {
  run.check();
  const products = drainageErosionProducts(recipe), { view, palette } = recipe, { frame } = products;
  const water = palette[1];
  if (products.basins) drawBasins(surface, products.basins, recipe, frame, run);
  if (products.lakes) drawLakes(surface, products.lakes, water, run);
  if (products.patch) {
    const patch = consumers.patch ?? shadedPatch(palette);
    run.enter(1);
    try { surface.push(); try { patch(surface, products.patch, run); } finally { surface.pop(); } } finally { run.leave(); }
  }
  const drawContours = (paths: readonly Path[], material: NonNullable<DrainageConsumers["contour"]>) => {
    const every = view.indexEvery, isIndex = (path: Path) => every > 0 && Math.round(path.level / view.contourInterval) % every === 0;
    strokeWith(surface, paths.filter((path) => !isIndex(path)), material(false), run);
    strokeWith(surface, paths.filter(isIndex), material(true), run);
  };
  if (products.ghost) drawContours(products.ghost, consumers.contour ?? stockContour(recipe, true));
  if (products.contours) drawContours(products.contours, consumers.contour ?? stockContour(recipe, false));
  const { network } = products;
  if (network && view.streams !== "none") {
    if (consumers.stream || view.streams === "ribbon") {
      const draw = consumers.stream ?? streamRibbon(water, view.streamWidth);
      for (const reach of network.reaches) {
        run.enter(1);
        try { surface.push(); try { draw(surface, reach, run); } finally { surface.pop(); } } finally { run.leave(); }
      }
    } else {
      const maxOrder = Math.max(1, ...network.reaches.map((reach) => reach.order));
      for (let order = 1; order <= maxOrder; order++) {
        const weight = view.streamWeight * (0.45 + 0.55 * order / maxOrder);
        const spec = { ...inkSpec(weight), kind: view.streams, spacing: view.streamSpacing, mark: { ...inkSpec(0).mark, kind: "dot" as const, size: weight * 2.2 } };
        strokeWith(surface, network.reaches.filter((reach) => reach.order === order), pathMaterial(spec, [water]), run);
      }
    }
  }
  if (network && view.marks !== "none") {
    const wanted = network.nodes.filter((node) => node.kind === "source" ? view.marks !== "confluences" : node.kind === "confluence" && view.marks !== "sources");
    const sites: Site[] = wanted.map((node) => ({ id: node.id, seed: componentSeed(recipe.seed, node.id, "site"), position: node.position, angle: node.angle,
      scale: 1 + 2 * Math.sqrt(node.flowShare) }));
    const mark = consumers.mark ?? motif({ kind: view.markKind, size: view.markSize, petals: 1, opening: 0, weight: 1.2, rotation: 0, variation: 0, retention: 1 }, [palette[0]]);
    atEach(surface, sites, mark, run);
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Run the simulation cooperatively, then build each treatment in turn; false if cancelled (nothing is retained). */
export async function prepareDrainageErosion(recipe: DrainageErosionComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  checkErosionWork(recipe.terrain, recipe.steps);
  const snapshots = await erosionCache.prepare(erosionSimulation, recipe.terrain, simulationSeed(recipe), { steps: recipe.steps, ...RETENTION, maxWork: MAX_EROSION_WORK, cancelled });
  if (!snapshots || cancelled()) return false;
  await yieldToHost();
  if (cancelled()) return false;
  try { drainageErosionProducts(recipe, { cancelled }); }
  catch (error) { if (cancelled() && error instanceof Error && /cancelled/i.test(error.message)) return false; throw error; }
  return !cancelled();
}
