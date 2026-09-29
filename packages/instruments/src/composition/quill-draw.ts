import { oklabRamp } from "@procedurals/javascript";
import { quilledPathsDefinition, quillGeometryOptions, quillStripOptions } from "../adapters/quilled-paths-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { createCompositionRun } from "./core.js";
import { CAP, quillGeometry, quillProjection } from "./quill-geometry.js";
import type { QuillCamera, QuillFaceKind, QuillGeometry, QuillGeometryOptions, QuillProjection } from "./quill-geometry.js";
import { quillScaffold } from "./quill-scaffold.js";
import type { QuillScaffoldSpec } from "./quill-scaffold.js";
import { quillStrips } from "./quill-strips.js";
import type { QuillStrip, QuillStripOptions, QuillStrips } from "./quill-strips.js";
import type { CompositionRun, CompositionSurface, Path } from "./types.js";

/**
 * Quilled Paths as a typed, JSON-compatible composition: producers (scaffold paths -> strips ->
 * wall geometry -> projection) and one replaceable consumer (the face painter).
 *
 * - `scaffold` is one of the four bundled constructions (`quillScaffold`). Any other `Path[]` goes
 *   straight to `quillStrips` through the direct API; persisted instruments name only bundled ones,
 *   and binding a host's own paths is future host work.
 * - `strips` and `geometry` are the option values of `quillStrips` and `quillGeometry`; `view`
 *   is the camera (`flat` = pitch 0, yaw 0: the plan view of the paper's top edge). The camera
 *   pivots about and stays anchored at the placement center.
 * - `material` is only how faces are painted: colour choice, the fixed-elevation light and the edge
 *   line. It never enters a producer, so appearance edits reuse every cached value.
 *
 * `drawQuilled(surface, recipe, consumers)` paints the projected faces back to front through
 * `consumers.face`; `quillPaper` is the stock painter. The producers are public, so a caller can
 * paint `quillProducts(recipe).projection` with its own callback without a descriptor.
 * Work is charged to the run (default 600,000 units) once for the faces painted.
 */
export type QuillTone = "strip" | "ring" | "level" | "height" | "single";
export interface QuillMaterialSpec {
  tone: QuillTone;
  /** 0..1 strength of the directional shading. */
  light: number;
  /** Degrees on the canvas plan: 0 lights from the right, 90 from the bottom. */
  lightAngle: number;
  /** Width of the dark edge line along cap edges, in screen units; 0 for none. */
  edgeWeight: number;
}
export interface QuillView {
  mode: "tilted" | "flat";
  yaw: number;
  pitch: number;
  zoom: number;
  /** Plan point that stays at the same screen point: the placement center. */
  centerX: number;
  centerY: number;
}
export interface QuilledPathsComposition {
  kind: "quilled-paths";
  seed: number;
  scaffold: QuillScaffoldSpec;
  strips: QuillStripOptions;
  geometry: QuillGeometryOptions;
  view: QuillView;
  material: QuillMaterialSpec;
  palette: readonly number[];
}

/** One face as its painter sees it: screen corners in painter's order plus what colours it. */
export interface QuillFace {
  /** Position in painter's order, 0 = farthest. */
  readonly position: number;
  /** Index in the geometry's face arrays. */
  readonly index: number;
  readonly kind: QuillFaceKind;
  readonly strip: QuillStrip;
  readonly stripIndex: number;
  /** Four screen corners, x then y. */
  readonly screen: readonly number[];
  /** Outward unit normal in the plan frame (before the camera's yaw). */
  readonly normal: readonly [number, number, number];
  readonly height: number;
  /** 0 at the lowest wall of the sculpture, 1 at the highest, by height relative to the requested wall height; 0 when all are equal. */
  readonly heightFraction: number;
}
export type QuillFacePainter = (surface: CompositionSurface, face: QuillFace, run: CompositionRun) => void;
export interface QuillConsumers { face?: QuillFacePainter }

type Scalar = number | string | boolean;
const definition = quilledPathsDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function quillComposition(input: InstrumentInput): QuilledPathsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const seed = input.seed;
  const frame = { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number };
  let scaffold: QuillScaffoldSpec;
  switch (q.source) {
    case "contours":
      scaffold = { kind: "contours", contour: { seed, source: q.contourShape as "noise", ...frame, resolution: 56, frequency: q.contourFrequency as number, aspect: 1.3,
        hillCount: q.contourHills as number, hillRadius: q.contourHillRadius as number, levelBase: q.contourLevel as number, levelStep: q.contourStep as number, levels: q.contourLevels as number } };
      break;
    case "letters": scaffold = { kind: "letters", seed, word: q.word as string, ...frame }; break;
    case "spirals":
      scaffold = { kind: "spirals", seed, family: q.spiralFamily as "archimedean", arms: q.arms as number, turns: q.turns as number, core: q.spiralCore as number,
        variation: q.armVariation as number, ...frame };
      break;
    case "scrolls":
      scaffold = { kind: "scrolls", seed, length: q.scrollLength as number, lengthVariation: q.lengthVariation as number, bend: q.scrollBend as number,
        sites: { seed, width: frame.width, height: frame.height, centerX: frame.centerX, centerY: frame.centerY, separation: q.scrollSeparation as number,
          maxPoints: 400, support: "rectangle", opening: 0, rotation: frame.rotation } };
      break;
    default: throw new Error(`Unknown scaffold: ${String(q.source)}`);
  }
  const flat = q.view === "flat";
  return {
    kind: "quilled-paths", seed, palette: [...input.palette], scaffold,
    strips: quillStripOptions(q, seed), geometry: quillGeometryOptions(q),
    view: { mode: flat ? "flat" : "tilted", yaw: flat ? 0 : q.yaw as number, pitch: flat ? 0 : q.pitch as number, zoom: q.zoom as number, centerX: frame.centerX, centerY: frame.centerY },
    material: { tone: q.tone as QuillTone, light: q.light as number, lightAngle: q.lightAngle as number, edgeWeight: q.edgeWeight as number },
  };
}

/** Whether the seed can change the construction of these stored values. */
export function quillUsesSeed(q: Record<string, Scalar>): boolean {
  if (q.source === "scrolls" || q.source === "contours" && (q.contourShape === "noise" || q.contourShape === "hills")) return true;
  if (q.source === "spirals" && Number(q.armVariation) > 0) return true;
  if (Number(q.heightVariation) > 0) return true;
  return q.source !== "letters" && q.terminals !== "none" && q.curl === "random";
}

/** The camera a view means. */
export function quillCamera(view: QuillView): QuillCamera {
  return { yaw: view.yaw, pitch: view.pitch, zoom: view.zoom, pivot: [view.centerX, view.centerY], anchor: [view.centerX, view.centerY] };
}

export interface QuillProducts {
  readonly scaffold: readonly Path[];
  readonly strips: QuillStrips;
  readonly geometry: QuillGeometry;
  readonly projection: QuillProjection;
}
/** The cached producer results `drawQuilled` consumes, each built only when its own inputs changed. */
export function quillProducts(recipe: QuilledPathsComposition): QuillProducts {
  const scaffold = quillScaffold(recipe.scaffold);
  const strips = quillStrips(scaffold, recipe.strips);
  const geometry = quillGeometry(strips, recipe.geometry);
  return { scaffold, strips, geometry, projection: quillProjection(geometry, quillCamera(recipe.view)) };
}

const LIGHT_ELEVATION = 55 * Math.PI / 180;
const rgb = (color: number): [number, number, number] => [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];

const RAMP_STEPS = 64;
/** The palette as a perceptual (Oklab) ramp of `RAMP_STEPS` colours, 0..255 per channel. */
function paletteRamp(palette: readonly number[]): Array<[number, number, number]> {
  if (palette.length === 1) return [rgb(palette[0])];
  const stops = palette.map((color) => rgb(color).map((channel) => channel / 255));
  return oklabRamp({ stops, count: RAMP_STEPS, maxWork: stops.length + RAMP_STEPS }).colors
    .map(([r, g, b]) => [r * 255, g * 255, b * 255] as [number, number, number]);
}

/**
 * The stock face painter. A face is filled with its strip's colour times a shade from its normal
 * against a fixed light (elevation 55 degrees, azimuth `lightAngle` in the plan), and stroked in the
 * same colour so neighbouring quads leave no seams; caps then get the dark edge line along both long
 * edges. It reads only `face` and the spec, so it can replace or wrap any other painter.
 */
export function quillPaper(spec: QuillMaterialSpec, palette: readonly number[]): QuillFacePainter {
  if (!palette.length) throw new Error("Composition palette must have at least one color");
  const gradient = spec.tone === "level" || spec.tone === "height" ? paletteRamp(palette) : [];
  const along = (t: number) => gradient[Math.round(Math.max(0, Math.min(1, t)) * (gradient.length - 1))];
  const azimuth = spec.lightAngle * Math.PI / 180;
  const lx = Math.cos(LIGHT_ELEVATION) * Math.cos(azimuth), ly = Math.cos(LIGHT_ELEVATION) * Math.sin(azimuth), lz = Math.sin(LIGHT_ELEVATION);
  return (surface, face) => {
    const { strip, normal } = face;
    let base: [number, number, number];
    switch (spec.tone) {
      case "strip": base = rgb(palette[strip.sourceIndex % palette.length]); break;
      case "ring": base = rgb(palette[Math.abs(strip.ring) % palette.length]); break;
      case "level": base = along(strip.levelFraction); break;
      case "height": base = along(face.heightFraction); break;
      default: base = rgb(palette[0]);
    }
    const lit = Math.max(0, normal[0] * lx + normal[1] * ly + normal[2] * lz);
    const shade = 1 - spec.light + spec.light * (0.25 + 0.75 * lit);
    const r = Math.round(base[0] * shade), g = Math.round(base[1] * shade), b = Math.round(base[2] * shade);
    const s = face.screen;
    // The seam stroke must not be wider than the edge line's round caps, or it leaves gaps between segments' lines.
    const edged = face.kind === CAP && spec.edgeWeight > 0;
    surface.fill(r, g, b, 255);
    surface.stroke(r, g, b, 255);
    surface.strokeWeight(edged ? Math.min(1, spec.edgeWeight) : 1);
    surface.beginShape();
    for (let c = 0; c < 4; c++) surface.vertex(s[c * 2], s[c * 2 + 1]);
    surface.endShape(surface.CLOSE);
    if (edged) {
      surface.stroke(Math.round(r * 0.45), Math.round(g * 0.45), Math.round(b * 0.45), 255);
      surface.strokeWeight(spec.edgeWeight);
      surface.line(s[0], s[1], s[2], s[3]);
      surface.line(s[6], s[7], s[4], s[5]);
    }
  };
}

const CHECK_EVERY = 512;
/** Paint every visible face, back to front, through the face painter. */
export function drawQuilled(surface: CompositionSurface, recipe: QuilledPathsComposition, consumers: QuillConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 600_000 })): void {
  run.check();
  const { projection, geometry } = quillProducts(recipe);
  const paint = consumers.face ?? quillPaper(recipe.material, recipe.palette);
  const { order, screen } = projection;
  const low = Math.min(...geometry.factors), high = Math.max(...geometry.factors);
  run.enter(order.length);
  surface.push();
  try {
    surface.noStroke();
    for (let position = 0; position < order.length; position++) {
      if (position % CHECK_EVERY === 0) run.check();
      const index = order[position], stripIndex = geometry.strip[index], height = geometry.heights[stripIndex];
      paint(surface, {
        position, index, kind: geometry.kind[index], strip: geometry.strips.strips[stripIndex], stripIndex,
        screen: screen.slice(position * 8, position * 8 + 8),
        normal: [geometry.normals[index * 3], geometry.normals[index * 3 + 1], geometry.normals[index * 3 + 2]],
        height, heightFraction: high > low ? (geometry.factors[stripIndex] - low) / (high - low) : 0,
      }, run);
    }
  } finally { surface.pop(); run.leave(); }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between stages; false if cancelled. */
export async function prepareQuilled(recipe: QuilledPathsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const scaffold = quillScaffold(recipe.scaffold);
  await yieldToHost(); if (cancelled()) return false;
  const strips = quillStrips(scaffold, recipe.strips);
  await yieldToHost(); if (cancelled()) return false;
  const geometry = quillGeometry(strips, recipe.geometry);
  await yieldToHost(); if (cancelled()) return false;
  quillProjection(geometry, quillCamera(recipe.view));
  return !cancelled();
}
