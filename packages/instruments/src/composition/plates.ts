import { atEach, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { motif, pathMaterial } from "./materials.js";
import { patternFunction } from "./patterns.js";
import type { PatternFunction, PatternSpec } from "./patterns.js";
import { memoized } from "./sources.js";
import { clipToSupport, resolveSupport, supportContains, MAX_CLIP_WORK } from "./support.js";
import type { Support, SupportSpec } from "./support.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Site } from "./types.js";

/**
 * Optical plates: two (or more) independent pattern sources, each bounded by its own support,
 * registered to one another explicitly, and returned both separately and as a composite.
 *
 * A PLATE is `pattern function × frame × support` evaluated once into frozen `Path`s (lines,
 * rings, spokes) and `Site`s (dots). The COMPOSITE is those same element objects in plate
 * order; there is no summed field, no raster and no computed fringe — the moiré is whatever the
 * two real plates make when drawn over each other. Sampling and antialiasing follow the rule in
 * patterns.ts: vertices sit on the ideal curves with a stated chord tolerance, and the drawing
 * device rasterises strokes at whatever resolution the host chooses, so preview and export
 * differ only in device antialiasing, never in geometry.
 *
 * REGISTRATION. A `Registration` is offset (canvas units), rotation (degrees) and phase (cycles
 * of the pattern's own period; see each pattern for what a cycle moves).
 * - `detached`: every plate uses its own registration in the canvas frame:
 *   `origin + offset`, `rotation`, `phase`. Moving plate A never moves plate B.
 * - `linked`: plate 0 is registered as in `detached`; every later plate is registered *relative
 *   to the plate before it*, so the pair moves as one body. Rotations and phases add, and the
 *   offset is read in the previous plate's rotated axes about its own frame origin. With the
 *   first plate at identity a linked pair equals a detached one.
 * The support is a stencil fixed in canvas coordinates in both modes; only patterns move under it.
 * There is no recorded phase sequence: phase is one static value per plate, because the
 * library has no recording foundation to replay from.
 *
 * IDENTITY AND SEEDS. Path ids are `<plate>/<stroke id>#<n>`, where the stroke id comes from
 * the pattern's lattice indices (`line:12`, `ring:4`, `spoke:7`) and `n` counts the pieces the
 * support cut it into; site ids are `<plate>/dot:<i>:<j>`. Appearance never enters a key, so
 * weight, ink, colour, omission and the choice of consumer never rename or move an element.
 * Seeds are `componentSeed(seed, id, purpose)`. `level` is the stroke's index in its pattern,
 * `levelFraction` runs 0..1 over them, and `tone` is the plate index, so the stock consumers
 * colour plate 0 and plate 1 with palette entries 0 and 1.
 *
 * CACHING. `opticalPlates` returns frozen values cached by construction options; each plate is
 * additionally cached by its own construction, so editing plate B returns plate A as the very
 * same object. Ordinary pattern functions passed to `makePlate` are not cached.
 *
 * FAILURE. Every invalid input, every pattern bound (lines, vertices, dots) and the clipping
 * work limit throw an Error naming the limit; nothing is thinned or clamped.
 */
export interface Registration {
  offsetX: number;
  offsetY: number;
  /** Degrees. */
  rotation: number;
  /** Cycles of the plate's own pattern. */
  phase: number;
}
export interface PlateOptions {
  pattern: PatternSpec;
  registration: Registration;
  support: SupportSpec;
}
export interface OpticalPlatesOptions {
  seed: number;
  link: "linked" | "detached";
  /** Canvas point about which unrotated frames are anchored (usually the footprint center). */
  originX: number;
  originY: number;
  /** Maximum chord deviation of flattened curves, canvas units. */
  flatness: number;
  plates: readonly PlateOptions[];
}
export interface PlateFrame {
  readonly x: number;
  readonly y: number;
  /** Radians. */
  readonly angle: number;
  readonly phase: number;
}
export interface Plate {
  readonly id: string;
  /** Palette index used by the stock consumers. */
  readonly tone: number;
  readonly frame: PlateFrame;
  /** Radius about the frame origin that covers the whole footprint. */
  readonly reach: number;
  readonly support: Support;
  readonly paths: readonly Path[];
  readonly sites: readonly Site[];
  /** Smallest local spacing of the pattern, canvas units. */
  readonly minPeriod: number;
}
export interface OpticalPlates {
  readonly link: "linked" | "detached";
  readonly plates: readonly Plate[];
  /** All plates' elements in plate order; the same objects as in `plates`. */
  readonly composite: { readonly paths: readonly Path[]; readonly sites: readonly Site[] };
}

const radians = Math.PI / 180;
const MAX_PLATES = 8;
const plateCache = new Map<string, Plate>();
const platesCache = new Map<string, OpticalPlates>();
const plateName = (index: number) => String.fromCharCode(65 + index);

function finite(label: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function checkRegistration(registration: Registration): void {
  finite("Plate offset x", registration.offsetX, -1e5, 1e5); finite("Plate offset y", registration.offsetY, -1e5, 1e5);
  finite("Plate rotation", registration.rotation, -1e5, 1e5); finite("Plate phase", registration.phase, -1e5, 1e5);
}

/** Resolve each plate's canvas frame; see the registration rules above. */
export function plateFrames(link: "linked" | "detached", originX: number, originY: number,
  registrations: readonly Registration[]): readonly PlateFrame[] {
  if (link !== "linked" && link !== "detached") throw new Error("Plate link must be linked or detached");
  finite("Origin x", originX, -1e5, 1e5); finite("Origin y", originY, -1e5, 1e5);
  const frames: PlateFrame[] = [];
  for (const registration of registrations) {
    checkRegistration(registration);
    const previous = frames[frames.length - 1];
    if (link === "detached" || !previous) {
      frames.push(Object.freeze({ x: originX + registration.offsetX, y: originY + registration.offsetY,
        angle: registration.rotation * radians, phase: registration.phase }));
      continue;
    }
    const c = Math.cos(previous.angle), s = Math.sin(previous.angle);
    frames.push(Object.freeze({ x: previous.x + c * registration.offsetX - s * registration.offsetY,
      y: previous.y + s * registration.offsetX + c * registration.offsetY,
      angle: previous.angle + registration.rotation * radians, phase: previous.phase + registration.phase }));
  }
  return Object.freeze(frames);
}

/** One plate from an ordinary pattern function; the caller owns caching and validation of `pattern`. */
export function makePlate(input: { id: string; tone: number; seed: number; pattern: PatternFunction;
  frame: PlateFrame; support: Support; flatness: number }): Plate {
  const { id, tone, seed, pattern, frame, support, flatness } = input;
  if (!id || id.includes("/") || id.includes("#")) throw new Error("Plate id must be non-empty and contain neither / nor #");
  finite("Plate tone", tone, 0, 1e3);
  let reach = 0;
  for (const [x, y] of support.footprint) reach = Math.max(reach, Math.hypot(x - frame.x, y - frame.y));
  const elements = pattern({ x: frame.x, y: frame.y, angle: frame.angle, reach, phase: frame.phase, flatness });
  const seen = new Set<string>();
  for (const item of [...elements.strokes, ...elements.dots]) {
    if (seen.has(item.id)) throw new Error(`Pattern produced the duplicate element id ${item.id}`);
    seen.add(item.id);
  }
  const budget = { work: 0 };
  const paths: Path[] = [];
  elements.strokes.forEach((stroke, level) => {
    for (const point of stroke.points) finite(`Pattern ${stroke.id} coordinate`, point[0] + point[1], -1e9, 1e9);
    const clipped = clipToSupport(stroke.points, stroke.closed, support, budget);
    clipped.pieces.forEach((piece, part) => {
      const pathId = `${id}/${stroke.id}#${part}`;
      paths.push(Object.freeze({ id: pathId, seed: componentSeed(seed, pathId, "path"), points: Object.freeze(piece),
        closed: clipped.closed, level, levelFraction: elements.strokes.length > 1 ? level / (elements.strokes.length - 1) : 0, tone }));
    });
  });
  budget.work += elements.dots.length * support.edges;
  if (budget.work > MAX_CLIP_WORK) throw new Error(`Support tests need ${budget.work} operations; limit ${MAX_CLIP_WORK}. Simplify the mask or enlarge the period.`);
  const sites: Site[] = [];
  for (const dot of elements.dots) {
    if (!supportContains(support, dot.position[0], dot.position[1])) continue;
    const siteId = `${id}/${dot.id}`;
    sites.push(Object.freeze({ id: siteId, seed: componentSeed(seed, siteId, "site"), position: dot.position,
      angle: dot.angle, scale: 1, tone }));
  }
  return Object.freeze({ id, tone, frame, reach, support, paths: Object.freeze(paths), sites: Object.freeze(sites),
    minPeriod: elements.minPeriod });
}

/** Build every plate and the composite from a JSON-compatible description; cached by construction. */
export function opticalPlates(options: OpticalPlatesOptions): OpticalPlates {
  const { seed, link, originX, originY, flatness, plates } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Plate seed must be a uint32 integer");
  if (plates.length < 1 || plates.length > MAX_PLATES) throw new Error(`Optical plates need 1–${MAX_PLATES} plates`);
  finite("Flatness", flatness, 0.001, 10);
  return memoized(platesCache, JSON.stringify(options), () => {
    const frames = plateFrames(link, originX, originY, plates.map((plate) => plate.registration));
    const built = plates.map((plate, index) => {
      const id = plateName(index);
      return memoized(plateCache, JSON.stringify([id, seed, plate.pattern, frames[index], plate.support, flatness]), () =>
        makePlate({ id, tone: index, seed, pattern: patternFunction(plate.pattern), frame: frames[index],
          support: resolveSupport(plate.support, flatness), flatness }));
    });
    return Object.freeze({ link, plates: Object.freeze(built), composite: Object.freeze({
      paths: Object.freeze(built.flatMap((plate) => plate.paths)), sites: Object.freeze(built.flatMap((plate) => plate.sites)) }) });
  });
}

// --- Consumers --------------------------------------------------------------------------
/** Any pair of ordinary callbacks can draw a plate: strokes go to `strokeWith`, dots to `atEach`. */
export interface PlateConsumers { stroke: PathMaterial; mark: Mark }
export function drawPlate(surface: CompositionSurface, plate: Plate, consumers: PlateConsumers,
  run: CompositionRun = createCompositionRun()): void {
  strokeWith(surface, plate.paths, consumers.stroke, run);
  atEach(surface, plate.sites, consumers.mark, run);
}

export interface PlateInk { material: PathMaterialSpec; mark: MotifSpec }
/** The named, JSON-compatible descriptor: construction (`source`), which plates to draw, and each plate's ink. */
export interface PlatesRecipe {
  kind: "plates";
  source: OpticalPlatesOptions;
  /** Which plates to draw; registration is the same for every choice. */
  show: "all" | readonly number[];
  ink: readonly PlateInk[];
  palette: readonly number[];
}
function visiblePlates(recipe: PlatesRecipe, built: OpticalPlates): readonly Plate[] {
  if (recipe.ink.length !== built.plates.length) throw new Error("Plates recipe needs one ink per plate");
  if (recipe.show === "all") return built.plates;
  for (const index of recipe.show)
    if (!Number.isInteger(index) || index < 0 || index >= built.plates.length) throw new Error("Plates recipe shows a plate that does not exist");
  return recipe.show.map((index) => built.plates[index]);
}
/** Draw a recipe with the stock path material and point mark; no surface clearing. */
export function drawPlatesRecipe(surface: CompositionSurface, recipe: PlatesRecipe, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const built = opticalPlates(recipe.source);
  for (const plate of visiblePlates(recipe, built)) {
    const ink = recipe.ink[plate.tone];
    drawPlate(surface, plate, { stroke: pathMaterial(ink.material, recipe.palette), mark: motif(ink.mark, recipe.palette) }, run);
  }
}
/** Warm the plate caches; false when cancelled. Plate construction is synchronous and bounded. */
export async function preparePlatesRecipe(recipe: PlatesRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  visiblePlates(recipe, opticalPlates(recipe.source));
  return !cancelled();
}
