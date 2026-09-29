import { nodalPlatesDefinition } from "../adapters/nodal-plates-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, cachedBy, createCompositionRun, strokeWith } from "./core.js";
import { keyholeRing } from "./domains.js";
import { color, motif, pathMaterial, tonedMaterial } from "./materials.js";
import { nodalBands, nodalField, nodalPaths, nodalSites, type NodalFieldOptions, type NodalMode, type NodalSite } from "./nodal-plate.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec } from "./types.js";

/*
 * Nodal plates as a composition: one field construction, four consumers.
 *
 * Producer values (`nodalField`, `nodalPaths`, `nodalSites`, `nodalBands`) are cached by construction; nothing here
 * is keyed by palette, mark, material, opacity or retention. Palette roles: 0 outline and nodal lines, 1 grains (and
 * the positive lobe), 2 the negative lobe, 3 the band fill (indices wrap over shorter palettes).
 * Draw order is fixed: bands, outline, nodal lines, grains. `consumers.line` and `consumers.grain` replace the stock
 * path material and grain mark; they receive the same frozen paths and sites, the grains carrying `tone` and `angle`.
 */
export interface NodalComposition {
  kind: "nodal-plates";
  seed: number;
  palette: readonly number[];
  plate: NodalFieldOptions;
  /** Node half-width as a fraction of peak amplitude (grain rule and band fill). */
  tolerance: number;
  particles: number;
  separation: number;
  grains: { mark: MotifSpec; color: "single" | "sign"; align: boolean };
  lines: { show: boolean; material: PathMaterialSpec };
  bands: { show: boolean; opacity: number };
  outline: { show: boolean; weight: number };
}
export interface NodalConsumers {
  line?: PathMaterial;
  grain?: Mark;
}

const tonedCache = new WeakMap<readonly NodalSite[], Map<string, readonly NodalSite[]>>();
/** Grain sites with a structural tone and (optionally) their node-following angle; cached per site set. */
function tonedGrains(sites: readonly NodalSite[], colorBy: "single" | "sign", align: boolean): readonly NodalSite[] {
  return cachedBy(tonedCache, sites, `${colorBy}:${align}`, () => Object.freeze(sites.map((site) => Object.freeze({
    ...site, angle: align ? site.angle : 0, tone: colorBy === "sign" ? 1 + site.lobe : 1 }))));
}

export function drawNodalPlate(surface: CompositionSurface, recipe: NodalComposition, consumers: NodalConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const field = nodalField(recipe.plate);
  const paths = recipe.lines.show ? nodalPaths(field, recipe.seed) : [];
  const sites = recipe.particles > 0 ? nodalSites(field, { seed: recipe.seed, tolerance: recipe.tolerance, particles: recipe.particles, separation: recipe.separation }) : [];
  if (recipe.bands.show) {
    surface.push();
    try {
      surface.noStroke();
      color(surface, recipe.palette, 3, 255 * recipe.bands.opacity, true);
      for (const region of nodalBands(field, recipe.tolerance).regions) {
        run.check();
        surface.beginShape();
        for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
        surface.endShape(surface.CLOSE);
      }
    } finally { surface.pop(); }
  }
  if (recipe.outline.show && recipe.outline.weight > 0) {
    surface.push();
    try {
      surface.noFill(); surface.strokeWeight(recipe.outline.weight);
      color(surface, recipe.palette, 0, 235, false);
      surface.beginShape();
      for (const [x, y] of field.outline.regions[0].outer) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    } finally { surface.pop(); }
  }
  if (paths.length > 0) strokeWith(surface, paths, consumers.line ?? tonedMaterial(pathMaterial(recipe.lines.material, recipe.palette), 0), run);
  if (sites.length > 0) atEach(surface, tonedGrains(sites, recipe.grains.color, recipe.grains.align), consumers.grain ?? motif(recipe.grains.mark, recipe.palette), run);
}

const tick = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** Build the field, lines, grains and bands one stage at a time, yielding between them; false if cancelled. */
export async function prepareNodalPlate(recipe: NodalComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const field = nodalField(recipe.plate);
  await tick();
  if (cancelled()) return false;
  if (recipe.lines.show) nodalPaths(field, recipe.seed);
  await tick();
  if (cancelled()) return false;
  if (recipe.particles > 0) nodalSites(field, { seed: recipe.seed, tolerance: recipe.tolerance, particles: recipe.particles, separation: recipe.separation });
  await tick();
  if (cancelled()) return false;
  if (recipe.bands.show) nodalBands(field, recipe.tolerance);
  return !cancelled();
}

// ------------------------------------------------------------------------------ named-instrument binding

type Scalar = number | string | boolean;
const definition = nodalPlatesDefinition;

/** Resolve stored scalar controls to the public recipe. Hidden controls (a mode past the count, orientation off a circle) are not read. */
export function nodalPlateComposition(input: InstrumentInput): NodalComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const count = Number(q.modes), shape = q.shape as NodalFieldOptions["shape"], single = count === 1;
  const modes: NodalMode[] = [];
  for (let i = 1; i <= count; i++) modes.push({ n: q[`n${i}`] as number, m: q[`m${i}`] as number,
    weight: single ? 1 : q[`weight${i}`] as number, phase: single ? 0 : q[`phase${i}`] as number, orient: shape === "circle" ? q[`orient${i}`] as number : 0 });
  const kind = q.grainKind as MotifSpec["kind"];
  const mark: MotifSpec = { kind, size: q.grainSize as number, petals: q.grainPetals as number, opening: q.grainOpening as number,
    weight: q.grainWeight as number, rotation: 0, variation: q.grainVariation as number, retention: q.grainRetention as number };
  const beads = q.lineKind === "beads";
  return {
    kind: "nodal-plates", seed: input.seed, palette: [...input.palette],
    plate: { shape, edge: q.edge as NodalFieldOptions["edge"], centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number,
      height: shape === "rectangle" ? q.height as number : q.width as number, rotation: q.rotation as number, modes, time: single ? 0 : q.time as number,
      resolution: q.resolution as number },
    tolerance: q.tolerance as number, particles: q.particles as number, separation: q.separation as number,
    grains: { mark, color: q.grainColor as "single" | "sign", align: q.align === true && (kind === "rosette" || kind === "arrow") },
    lines: { show: q.lines === true, material: { kind: q.lineKind as PathMaterialSpec["kind"], weight: q.lineWeight as number, spacing: q.lineSpacing as number,
      phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
      mark: { kind: "dot", size: beads ? q.lineBead as number : 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } } },
    bands: { show: q.bands === true, opacity: q.bandOpacity as number },
    outline: { show: q.outline === true, weight: q.outlineWeight as number },
  };
}

/** Whether the seed can change the drawing: only the grains read it. */
export const nodalPlatesUsesSeed = (q: InstrumentInput["params"]): boolean => Number(q.particles) > 0;
