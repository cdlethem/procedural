import { strokeReliefDefinition } from "../adapters/stroke-relief-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { createCompositionRun, strokeWith } from "./core.js";
import { bristleBand, gesturePath } from "./gesture.js";
import { depositHeight, pigmentField, reliefNormals, shadeRelief } from "./relief.js";
import type { DepositOptions, Light, ReliefNormals, ShadeMaterial, ShadedPatch, StrokeRelief } from "./relief.js";
import { gestureTrack } from "./recording.js";
import { bundledRecording } from "./recording-samples.js";
import type { BundledRecordingId } from "./recording-samples.js";
import { memoized } from "./sources.js";
import { bundledStrokes } from "./stroke-samples.js";
import type { BundledStrokeId } from "./stroke-samples.js";
import { depositionOrder, placeStrokes, scaleWidths, strokeSet, strokesFromPaths } from "./strokes.js";
import type { ReliefStroke, StrokeData, StrokeFrame, StrokeSet } from "./strokes.js";
import type { CompositionRun, CompositionSurface } from "./types.js";

/**
 * Stroke Relief as a typed, JSON-compatible composition: one producer chain (strokes -> height ->
 * normals -> shaded patch) and two consumers that can be used on their own.
 *
 * - `source`: a bundled ribbon set (`{kind: "bundled", id, widthScale}`), the existing dry-brush
 *   hairs (`{kind: "dry-brush", ...}`: a bundled recording replayed by `gestureTrack`/`gesturePath`,
 *   its hairs from `bristleBand`, each hair one narrow stroke) or caller-resolved strokes
 *   (`{kind: "data", strokes}`, validated by `strokeSet`). Persisted instruments name only bundled
 *   sources; a host's own strokes go through the third form (future host work: an asset field).
 * - `frame` places the whole set (`placeStrokes`); `deposit` builds the height (`depositHeight`);
 *   `light` and `material` shade it (`shadeRelief`); `view` chooses the flat layer, the relief
 *   patch or both; `colorBy` chooses the pigment of each stroke.
 *
 * TWO INDEPENDENT LAYERS. The FLAT layer is the strokes as round-capped, variable-width ribbons in
 * flat pigment, painted in deposition order (the last is on top). It needs no height and is
 * exactly the footprint the height field is built on. The RELIEF layer is a transparent patch
 * of light and shadow: shadow and light colours at an alpha that follows the shading, empty where the
 * surface is flat and outside the strokes. Drawn over the flat layer it is the lit impasto;
 * drawn alone it is light and shadow on the paper; it can equally be drawn over any other layer.
 * Palette entry 0 is the shadow colour, entries 1.. are the pigments (cycled by tone) and the light
 * colour is white tinted 20% toward entry 1. `view: "flat"` never builds a height field.
 *
 * COLOUR. A stroke's tone is `stroke.tone ?? 0` (`colorBy: "stroke"`), its rank in the deposition order
 * (`"deposition"`, so the stack reads as a colour sequence) or 0 (`"single"`); the pigment is
 * `pigments[tone mod pigments.length]`. Tone changes repaint only: no producer reads it.
 *
 * WORK. Drawing charges the run one unit per stroke and one per shaded band. The deposition
 * has its own measured bound (`relief.ts`). Any consumer is replaceable by an ordinary callback
 * while every producer stays the same cached object.
 */
export type ReliefSource =
  | { kind: "bundled"; id: BundledStrokeId; widthScale: number }
  | { kind: "dry-brush"; recording: Extract<BundledRecordingId, "sweep" | "spiral" | "loops">; hairs: number; brushWidth: number; hairWidth: number; dryness: number; depletion: number }
  | { kind: "data"; strokes: { id: string; seed: number; strokes: readonly StrokeData[] } };

export type ReliefView = "flat" | "relief" | "both";
export type ColorBy = "stroke" | "deposition" | "single";

export interface StrokeReliefComposition {
  kind: "stroke-relief";
  seed: number;
  palette: readonly number[];
  source: ReliefSource;
  frame: StrokeFrame;
  /** The canvas [0, 640]^2 is always the relief domain of the named instrument; `bounds` is a library option. */
  deposit: Omit<DepositOptions, "bounds"> & { bounds?: DepositOptions["bounds"] };
  light: Light;
  material: ShadeMaterial;
  view: ReliefView;
  colorBy: ColorBy;
}

/** Replace any consumer of `drawStrokeRelief` with an ordinary callback. */
export interface StrokeReliefConsumers {
  /** One stroke, `tone` set to its pigment tone, in deposition order. */
  flat?: (surface: CompositionSurface, stroke: ReliefStroke, run: CompositionRun) => void;
  patch?: (surface: CompositionSurface, patch: ShadedPatch, run: CompositionRun) => void;
}

const CANVAS: DepositOptions["bounds"] = Object.freeze([0, 0, 640, 640] as const);
const definition = strokeReliefDefinition;
type Scalar = number | string | boolean;

/** Resolve stored scalar controls to the public composition value. */
export function strokeReliefComposition(input: InstrumentInput): StrokeReliefComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length < 2 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Stroke relief needs at least two packed RGB colors (shadow, pigment)");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const source = q.source as string;
  return {
    kind: "stroke-relief", seed: input.seed, palette: [...input.palette],
    source: source.startsWith("dry-")
      ? { kind: "dry-brush", recording: source.slice(4) as "sweep" | "spiral" | "loops", hairs: q.hairs as number, brushWidth: q.brushWidth as number,
        hairWidth: q.hairWidth as number, dryness: q.dryness as number, depletion: q.depletion as number }
      : { kind: "bundled", id: source as BundledStrokeId, widthScale: q.strokeWidth as number },
    frame: { centerX: q.centerX as number, centerY: q.centerY as number, scale: q.scale as number, rotation: q.rotation as number },
    deposit: { cell: q.cell as number, height: q.height as number, section: q.section as DepositOptions["section"], edgeRidge: q.edgeRidge as number,
      furrows: q.furrows as number, furrowDepth: q.furrowDepth as number, loadMap: { floor: q.loadFloor as number, curve: q.loadCurve as number },
      overlap: q.overlap as DepositOptions["overlap"], order: q.order as DepositOptions["order"] },
    light: { azimuth: q.azimuth as number, elevation: q.elevation as number },
    material: { contrast: q.contrast as number, gloss: q.gloss as number, shininess: q.shininess as number },
    view: q.view as ReliefView, colorBy: q.colorBy as ColorBy,
  };
}

const dryCache = new Map<string, StrokeSet>();
const dataCache = new Map<string, StrokeSet>();
const DRY_SPACING = 2.5;
const DRY_SMOOTHING = 30;

/** The strokes a recipe deposits, before placement. Cached by construction. */
export function sourceStrokes(recipe: Pick<StrokeReliefComposition, "source" | "seed">): StrokeSet {
  const { source, seed } = recipe;
  if (source.kind === "bundled") return scaleWidths(bundledStrokes(source.id, seed), source.widthScale);
  if (source.kind === "data") return memoized(dataCache, JSON.stringify(source.strokes), () => strokeSet(source.strokes));
  if (source.kind !== "dry-brush") throw new Error("Unknown stroke source");
  return memoized(dryCache, JSON.stringify([source, seed]), () => {
    const track = gestureTrack(bundledRecording(source.recording, seed), { smoothing: DRY_SMOOTHING, frame: { centerX: 320, centerY: 320, scale: 1, rotation: 0 } });
    const path = gesturePath(track, { seed, sampling: { kind: "arc", spacing: DRY_SPACING }, window: { start: 0, end: track.duration },
      pressure: { source: "recorded", whenAbsent: "speed", level: 0.6 } });
    const hairs = bristleBand(path, { seed, hairs: source.hairs, width: source.brushWidth, map: { floor: 0.18, curve: 1 },
      dryness: source.dryness, depletion: source.depletion, wander: 0.2 });
    // Hairs at the brush edge carry less paint than the middle ones.
    return strokesFromPaths({ id: `dry-${source.recording}:${seed}`, seed, paths: hairs, width: source.hairWidth, load: 1, edgeLoad: 0.55 });
  });
}

/** Pigment tone of each stroke of `set` (indexed like `set.strokes`). */
export function strokeTones(set: StrokeSet, colorBy: ColorBy, order: readonly number[]): readonly number[] {
  if (colorBy === "stroke") return Object.freeze(set.strokes.map((stroke) => stroke.tone ?? 0));
  if (colorBy === "single") return Object.freeze(set.strokes.map(() => 0));
  if (colorBy !== "deposition") throw new Error(`Unknown colour rule: ${String(colorBy)}`);
  const tones = new Array<number>(set.strokes.length);
  order.forEach((index, rank) => { tones[index] = rank; });
  return Object.freeze(tones);
}

/** Everything the consumers read. The relief chain is null when the view is the flat layer alone. */
export interface StrokeReliefProducts {
  readonly strokes: StrokeSet;
  /** Deposition order: indices into `strokes.strokes`, the last on top. */
  readonly order: readonly number[];
  readonly tones: readonly number[];
  readonly relief: StrokeRelief | null;
  /** Pigment tone per relief cell, -1 where no stroke owns the cell. */
  readonly pigment: readonly number[] | null;
  readonly normals: ReliefNormals | null;
  readonly patch: ShadedPatch | null;
}

/** Producer results: the cached values `drawStrokeRelief` consumes. */
export function strokeReliefProducts(recipe: StrokeReliefComposition, control: { cancelled?: () => boolean } = {}): StrokeReliefProducts {
  const strokes = placeStrokes(sourceStrokes(recipe), recipe.frame);
  const order = depositionOrder(strokes, recipe.deposit.order);
  const tones = strokeTones(strokes, recipe.colorBy, order);
  if (recipe.view === "flat") return { strokes, order, tones, relief: null, pigment: null, normals: null, patch: null };
  const relief = depositHeight(strokes, { ...recipe.deposit, bounds: recipe.deposit.bounds ?? CANVAS }, control);
  const normals = reliefNormals(relief);
  return { strokes, order, tones, relief, pigment: pigmentField(relief, tones), normals, patch: shadeRelief(normals, recipe.light, recipe.material) };
}

const channels = (color: number): [number, number, number] => [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
/** Shadow colour, the pigment cycle and the light colour of a palette (see the header). */
export function reliefColors(palette: readonly number[]): { shadow: number; pigments: readonly number[]; light: number } {
  if (palette.length < 2) throw new Error("Stroke relief needs at least two colors (shadow, pigment)");
  const [r, g, b] = channels(palette[1]);
  const tint = (v: number) => Math.round(255 * 0.8 + v * 0.2);
  return { shadow: palette[0], pigments: palette.slice(1), light: (tint(r) << 16) | (tint(g) << 8) | tint(b) };
}

/** The flat consumer: a variable-width ribbon of round-capped segments in the pigment of `stroke.tone`. */
export function flatRibbon(palette: readonly number[]): NonNullable<StrokeReliefConsumers["flat"]> {
  const { pigments } = reliefColors(palette);
  return (surface, stroke) => {
    const [r, g, b] = channels(pigments[(stroke.tone ?? 0) % pigments.length]);
    surface.noFill(); surface.stroke(r, g, b); surface.strokeCap(surface.ROUND);
    const { points, widths } = stroke;
    for (let i = 0; i + 1 < points.length; i++) {
      const w = (widths[i] + widths[i + 1]) / 2;
      if (!(w > 0)) continue;
      surface.strokeWeight(w);
      surface.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    }
  };
}

/** The patch consumer: every band's polygons filled in the shadow or light colour at the band's alpha. */
export function shadedPatch(palette: readonly number[]): NonNullable<StrokeReliefConsumers["patch"]> {
  const { shadow, light } = reliefColors(palette);
  const colors = { shadow: channels(shadow), light: channels(light) };
  return (surface, patch, run) => {
    surface.noStroke();
    for (const band of patch.bands) {
      run.enter(1);
      try {
        const [r, g, b] = colors[band.side];
        surface.fill(r, g, b, band.alpha * 255);
        for (const polygon of band.polygons) {
          surface.beginShape();
          for (let i = 0; i < polygon.length; i += 2) surface.vertex(polygon[i], polygon[i + 1]);
          surface.endShape(surface.CLOSE);
        }
      } finally { run.leave(); }
    }
  };
}

/** Draw the recipe into a caller-owned surface: the flat ribbons in deposition order, then the relief patch. */
export function drawStrokeRelief(surface: CompositionSurface, recipe: StrokeReliefComposition,
  consumers: StrokeReliefConsumers = {}, run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const products = strokeReliefProducts(recipe);
  if (recipe.view !== "relief") {
    const flat = consumers.flat ?? flatRibbon(recipe.palette);
    const ordered = products.order.map((index): ReliefStroke => ({ ...products.strokes.strokes[index], tone: products.tones[index] }));
    strokeWith(surface, ordered, flat, run);
  }
  if (recipe.view !== "flat" && products.patch) {
    const patch = consumers.patch ?? shadedPatch(recipe.palette);
    run.enter(1);
    try {
      surface.push();
      try { patch(surface, products.patch, run); } finally { surface.pop(); }
    } finally { run.leave(); }
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producer chain stage by stage, yielding between stages; false if cancelled. */
export async function prepareStrokeRelief(recipe: StrokeReliefComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const strokes = placeStrokes(sourceStrokes(recipe), recipe.frame);
  if (recipe.view === "flat") return !cancelled();
  await yieldToHost();
  if (cancelled()) return false;
  let relief: StrokeRelief;
  try { relief = depositHeight(strokes, { ...recipe.deposit, bounds: recipe.deposit.bounds ?? CANVAS }, { cancelled }); }
  catch (error) { if (cancelled() && error instanceof Error && error.message === "Composition cancelled") return false; throw error; }
  await yieldToHost();
  if (cancelled()) return false;
  const normals = reliefNormals(relief);
  await yieldToHost();
  if (cancelled()) return false;
  shadeRelief(normals, recipe.light, recipe.material);
  return !cancelled();
}
