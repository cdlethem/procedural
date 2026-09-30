import { chemotacticTrailsDefinition } from "../adapters/chemotactic-trails-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, cachedBy, createCompositionRun, strokeWith } from "./core.js";
import { bristleMaterial, planBristles, unit } from "./bristle.js";
import type { BristleFrame, BristleMaterialSpec, BristleOptions } from "./bristle.js";
import { planarDomain } from "./domains.js";
import type { PlanarRegionData } from "./domains.js";
import { fillableRings } from "./iso-rings.js";
import { color, motif, pathMaterial, tonedMaterial } from "./materials.js";
import {
  chemicalField, chemotaxisAgents, chemotaxisSnapshots, chemotaxisTrails, contourLevels, fieldBands, fieldContourPaths, prepareChemotaxis,
  type ChemicalField, type ChemotaxisAgent, type ChemotaxisConstruction, type ChemotaxisSnapshots, type ChemotaxisTrail,
} from "./chemotaxis.js";
import { colonyGeometry, type ColonyControls } from "./chemotaxis-layouts.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Point } from "./types.js";

/**
 * Chemotactic Trails as a typed, JSON-compatible composition: one producer (the stepped colony of
 * `chemotaxis.ts`, run through the F7 snapshot cache) and three consumers of the SAME snapshots:
 *
 * - `field`: the chemical at the last step as contour paths (`iso-rings.ts` marching squares, the
 *   existing `pathMaterial`) and/or tonal bands (nested filled level sets);
 * - `trails`: each agent's recorded trajectory as paths, through `pathMaterial` (ink, stitch) or the
 *   dry brush of `bristle.ts` (`bristleMaterial`), one tone per emitter or one for all;
 * - `marks`: a `motif` at each living agent, turned to its heading.
 *
 * `construction` and `steps` are everything the colony computes (emitters, chemistry, sensing, arena,
 * barrier, steps); `field`, `trails`, `marks` and `barrier` are appearance and never reach the cache
 * key: a palette or material edit draws the same `Snapshots` object. `drawChemotacticTrails(surface,
 * recipe, {contour, trail, mark})` replaces any consumer with an ordinary callback. The direct API takes
 * any emitters and resolved barrier regions; the instrument names bundled layouts and barriers only
 * (binding a user's own barrier region is future host work).
 *
 * Palette tones: 0 the chemical (lines and bands), barrier fill and single-color marks, 1 trails; with
 * `colorBy: "origin"` emitter `k` uses tone `1 + k mod (palette size - 1)` (a label of where an agent
 * came from: every agent shares one chemical). Draw order: barrier, bands, contours, trails, marks.
 */
export interface ChemotacticTrailsComposition {
  kind: "chemotactic-trails";
  seed: number;
  palette: readonly number[];
  construction: ChemotaxisConstruction;
  steps: number;
  field: { mode: "none" | "contours" | "wash" | "both"; levels: number; lowest: number; line: "ink" | "stitch" | "beads"; weight: number; washOpacity: number };
  trails: { line: "none" | "ink" | "stitch" | "bristles"; share: number; memory: number; minLength: number; weight: number; colorBy: "single" | "origin"; brushWidth: number; hairs: number };
  marks: { kind: "none" | MotifSpec["kind"]; share: number; size: number; colorBy: "single" | "origin" };
  barrier: { opacity: number };
}

/** Replace any consumer of `drawChemotacticTrails` with an ordinary callback. */
export interface ChemotacticConsumers {
  contour?: PathMaterial;
  trail?: PathMaterial;
  mark?: Mark;
}

type Scalar = number | string | boolean;
const definition = chemotacticTrailsDefinition;
const dot = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } as const;
const DRAW_WORK = 400_000;
const CONTOUR_SPACING = 7;
const TRAIL_SPACING = 6;

/** Resolve stored scalar controls to the public composition value. */
export function chemotacticTrailsComposition(input: InstrumentInput): ChemotacticTrailsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const { emitters, barrier } = colonyGeometry(q as unknown as ColonyControls, input.seed);
  return {
    kind: "chemotactic-trails", seed: input.seed, palette: [...input.palette], steps: q.steps as number,
    construction: {
      emitters, spawnRadius: q.spawnRadius as number, release: q.release as number, lifespan: q.lifespan as number,
      deposit: q.deposit as number, beacon: q.beacon as number, diffusion: q.diffusion as number, decay: q.decay as number,
      reach: q.reach as number, sensorAngle: q.sensorAngle as number, turnRate: q.turnRate as number, attraction: q.attraction as number, wander: q.wander as number,
      speed: q.speed as number, edge: q.edge as "wall" | "wrap", grid: q.grid as number, barrier,
    },
    field: { mode: q.fieldMode as ChemotacticTrailsComposition["field"]["mode"], levels: q.contours as number, lowest: q.lowestContour as number,
      line: q.contourLine as "ink" | "stitch" | "beads", weight: q.contourWeight as number, washOpacity: q.washOpacity as number },
    trails: { line: q.trailLine as ChemotacticTrailsComposition["trails"]["line"], share: q.trailShare as number, memory: q.trailMemory as number,
      minLength: q.trailMinLength as number, weight: q.trailWeight as number, colorBy: q.trailColor as "single" | "origin",
      brushWidth: q.brushWidth as number, hairs: q.hairs as number },
    marks: { kind: q.mark as ChemotacticTrailsComposition["marks"]["kind"], share: q.markShare as number, size: q.markSize as number, colorBy: q.markColor as "single" | "origin" },
    barrier: { opacity: q.barrierOpacity as number },
  };
}

/** What the consumers read. Every value is the cached product of the snapshots (and the appearance options that select from them). */
export interface ChemotacticProducts {
  readonly snapshots: ChemotaxisSnapshots;
  readonly field: ChemicalField;
  /** Contour levels drawn, chemical units. */
  readonly levels: readonly number[];
  readonly contours: readonly Path[];
  /** Filled level sets, one entry per level. */
  readonly bands: readonly (readonly (readonly Point[])[])[];
  /** Selected trails (share and shortest length applied). */
  readonly trails: readonly ChemotaxisTrail[];
  /** Living agents at the last step. */
  readonly agents: readonly ChemotaxisAgent[];
}

const bristleFrame: BristleFrame = { step: 3, pressure: { profile: "swell", level: 0.7, pulses: 3 } };
const brushOptions = (t: ChemotacticTrailsComposition["trails"]): BristleOptions => ({
  hairs: t.hairs, width: t.brushWidth, map: { floor: 0.25, curve: 1 }, dryness: 0.6, depletion: 0.5, wander: 0.2,
  distribution: { bias: 0, tufts: 3, clumping: 0.3, cohesion: 0.5 }, hold: { mode: "path", tilt: 0 }, tip: { shape: "round", length: 20 }, attack: 10, release: 14,
});
const selectionCache = new WeakMap<readonly ChemotaxisTrail[], Map<string, readonly ChemotaxisTrail[]>>();

/** The colony's cached snapshots at `recipe.steps`. Cancellation and bounds as in `chemotaxisSnapshots`. */
export function chemotacticSnapshots(recipe: ChemotacticTrailsComposition, run?: CompositionRun): ChemotaxisSnapshots {
  return chemotaxisSnapshots(recipe.construction, recipe.seed, recipe.steps, run ? { run } : {});
}

/** The producers for a recipe: snapshots, the field and its level paths, the trail paths and the living agents. */
export function chemotacticProducts(recipe: ChemotacticTrailsComposition, run?: CompositionRun): ChemotacticProducts {
  const snapshots = chemotacticSnapshots(recipe, run);
  const field = chemicalField(snapshots);
  const f = recipe.field, t = recipe.trails;
  const levels = f.mode === "none" ? [] : contourLevels(field.max, f.levels, f.lowest);
  const contours = f.mode === "contours" || f.mode === "both" ? fieldContourPaths(field, levels, recipe.seed) : [];
  const bands = f.mode === "wash" || f.mode === "both" ? fieldBands(field, levels) : [];
  let trails: readonly ChemotaxisTrail[] = [];
  if (t.line !== "none" && t.share > 0) {
    const all = chemotaxisTrails(snapshots, { memory: t.memory, minLength: t.minLength });
    trails = cachedBy(selectionCache, all, `${recipe.seed}|${t.share}`, () => Object.freeze(all.filter((trail) => unit(trail.seed, trail.id, "keep") < t.share)));
    if (t.line === "bristles")
      planBristles(trails, bristleFrame, brushOptions(t), "Lower Hairs, Trail share or Trail memory, or raise Shortest trail");
  }
  const agents = recipe.marks.kind === "none" || recipe.marks.share === 0 ? [] : chemotaxisAgents(snapshots).filter((agent) => agent.alive);
  return { snapshots, field, levels, contours, bands, trails, agents };
}

const originTone = (origin: number, palette: readonly number[]): number => palette.length > 1 ? 1 + origin % (palette.length - 1) : 0;
const barrierCache = new WeakMap<readonly PlanarRegionData[], readonly (readonly Point[])[]>();
function barrierPolygons(barrier: readonly PlanarRegionData[]): readonly (readonly Point[])[] {
  const hit = barrierCache.get(barrier);
  if (hit) return hit;
  const rings = barrier.length === 0 ? [] : planarDomain(barrier as PlanarRegionData[], { id: "chemotaxis-barrier" }).regions.flatMap((region) => fillableRings([region.outer, ...region.holes]));
  barrierCache.set(barrier, rings);
  return rings;
}

function fillRings(surface: CompositionSurface, rings: readonly (readonly Point[])[]): void {
  for (const ring of rings) {
    surface.beginShape();
    for (const [x, y] of ring) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
}

const lineSpec = (kind: PathMaterialSpec["kind"], weight: number, spacing: number): PathMaterialSpec =>
  ({ kind, weight, spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: { ...dot, size: Math.max(1.5, weight * 2.4) } });

/** Draw the recipe into a caller-owned surface: barrier, bands, contours, trails, agent marks. */
export function drawChemotacticTrails(surface: CompositionSurface, recipe: ChemotacticTrailsComposition, consumers: ChemotacticConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: DRAW_WORK })): void {
  run.check();
  const products = chemotacticProducts(recipe, run);
  const { palette } = recipe, f = recipe.field, t = recipe.trails, m = recipe.marks;
  if (recipe.barrier.opacity > 0) {
    const rings = barrierPolygons(recipe.construction.barrier);
    if (rings.length > 0) {
      surface.push(); surface.noStroke(); color(surface, palette, 0, 255 * recipe.barrier.opacity, true);
      fillRings(surface, rings);
      surface.pop();
    }
  }
  if (products.bands.length > 0) {
    surface.push(); surface.noStroke(); color(surface, palette, 0, 255 * f.washOpacity, true);
    for (const level of products.bands) fillRings(surface, level);
    surface.pop();
  }
  if (products.contours.length > 0)
    strokeWith(surface, products.contours, consumers.contour ?? tonedMaterial(pathMaterial(lineSpec(f.line, f.weight, CONTOUR_SPACING), palette), 0), run);
  if (products.trails.length > 0) {
    const tones = t.colorBy === "origin" ? [...new Set(products.trails.map((trail) => originTone(trail.origin, palette)))].sort((a, b) => a - b) : [1];
    for (const tone of tones) {
      const group = t.colorBy === "origin" ? products.trails.filter((trail) => originTone(trail.origin, palette) === tone) : products.trails;
      let material = consumers.trail;
      if (!material && t.line === "bristles") {
        const spec: BristleMaterialSpec = { frame: bristleFrame, brush: brushOptions(t), ink: { weight: 0.9, mix: 0, inkTone: tone, mixTone: tone, wash: 0.05, washTone: tone } };
        material = bristleMaterial(spec, palette);
      }
      material ??= tonedMaterial(pathMaterial(lineSpec(t.line === "stitch" ? "stitch" : "ink", t.weight, TRAIL_SPACING), palette), tone);
      strokeWith(surface, group, material, run);
    }
  }
  if (products.agents.length > 0) {
    const spec: MotifSpec = { kind: m.kind === "none" ? "dot" : m.kind, size: m.size, petals: 6, opening: 0.35, weight: 1.2, rotation: 0, variation: 0, retention: m.share };
    const sites = products.agents.map((agent) => ({ ...agent, tone: m.colorBy === "origin" ? originTone(agent.origin, palette) : 0 }));
    atEach(surface, sites, consumers.mark ?? motif(spec, palette), run);
  }
}

/** Run the colony (cooperatively) and build the drawing's products; false if cancelled. */
export async function prepareChemotacticTrails(recipe: ChemotacticTrailsComposition, cancelled: () => boolean): Promise<boolean> {
  if (!(await prepareChemotaxis(recipe.construction, recipe.seed, recipe.steps, cancelled))) return false;
  chemotacticProducts(recipe);
  return !cancelled();
}
