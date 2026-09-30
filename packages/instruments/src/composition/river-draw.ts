/**
 * Migrating river ribbons (brief 44): the consumers. Four treatments read the same cached `RiverScene`:
 * the current channel as a variable-width ribbon, earlier channels as faded scars, oxbows, and the floodplain
 * tinted by the age field. Nothing here changes the scene; palette and every drawing control are appearance.
 */
import { riverOptionsOf, riverRibbonsDefinition } from "../adapters/river-ribbons-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { createCompositionRun, strokeWith } from "./core.js";
import { color, pathMaterial } from "./materials.js";
import { oxbowPaths, prepareRiverRibbons, riverAgeField, riverFields, riverRibbons, riverTraces, type RiverOptions, type RiverScene } from "./river.js";
import { signedCurvature } from "./river-model.js";
import type { CompositionRun, CompositionSurface, PathMaterial, PathMaterialSpec, Point } from "./types.js";

/** The recipe of the named instrument: a JSON-compatible descriptor of one river and its treatments. `null` treatments are not drawn. */
export interface RiverRibbonsComposition {
  kind: "river-ribbons";
  palette: readonly number[];
  source: RiverOptions;
  channel: { opacity: number; widening: number; banks: { weight: number } | null } | null;
  scars: { style: "lines" | "bands"; every: number; opacity: number; weight: number } | null;
  oxbows: { style: "ribbon" | "ink" | "stitch" | "beads"; opacity: number; weight: number } | null;
  /** Steps at which scars and oxbows are faintest, and how much of their width sediment has filled by then. */
  age: { fade: number; deposition: number };
  floodplain: { cell: number; opacity: number } | null;
}

/** A ribbon: the two banks of a centerline, drawn as one closed polygon by a ribbon painter. `age` is in steps. */
export interface RiverRibbon { readonly id: string; readonly left: readonly Point[]; readonly right: readonly Point[]; readonly age: number }
export type RibbonPainter = (surface: CompositionSurface, ribbon: RiverRibbon, run: CompositionRun) => void;

/** Replace any consumer of `drawRiverRibbons` with an ordinary callback; the producer's scene is the same cached object. */
export interface RiverConsumers { ribbon?: RibbonPainter; scar?: PathMaterial; oxbow?: PathMaterial }

type Scalar = number | string | boolean;
const definition = riverRibbonsDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function riverRibbonsComposition(input: InstrumentInput): RiverRibbonsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const scars = q.scars as string, oxbows = q.oxbows as string;
  return {
    kind: "river-ribbons", palette: [...input.palette], source: riverOptionsOf(q, input.seed),
    channel: q.showChannel ? { opacity: q.channelOpacity as number, widening: q.widening as number, banks: q.banks ? { weight: q.bankWeight as number } : null } : null,
    scars: scars === "off" ? null : { style: scars as "lines" | "bands", every: q.scarEvery as number, opacity: q.scarOpacity as number, weight: q.scarWeight as number },
    oxbows: oxbows === "off" ? null : { style: oxbows as "ribbon" | "ink" | "stitch" | "beads", opacity: q.oxbowOpacity as number, weight: q.oxbowWeight as number },
    age: { fade: q.fade as number, deposition: q.deposition as number },
    floodplain: q.floodplain ? { cell: q.plainCell as number, opacity: q.plainOpacity as number } : null,
  };
}

/**
 * Half the ribbon width at each node: the discharge width, swelled where the smoothed curvature is high
 * (`1 + widening * min(1, 2 W |curvature|)`, `W` the inlet width), never wider than 0.9 of the local radius of
 * curvature (so the inner bank cannot turn inside out), then scaled by `narrowing`.
 */
export function ribbonHalfWidths(xy: Readonly<Float64Array>, width: ArrayLike<number>, curvature: ArrayLike<number>, inletWidth: number, widening: number, narrowing = 1): Float64Array {
  const raw = signedCurvature(xy), out = new Float64Array(width.length);
  for (let i = 0; i < out.length; i++) {
    const swelled = width[i] / 2 * (1 + widening * Math.min(1, 2 * inletWidth * Math.abs(curvature[i])));
    out[i] = narrowing * Math.min(swelled, raw[i] === 0 ? Infinity : 0.9 / Math.abs(raw[i]));
  }
  return out;
}

/** The two banks of a centerline: each node offset by its half width along the miter normal (mitre factor at most 2). */
export function riverBanks(xy: ArrayLike<number>, half: ArrayLike<number>): { left: Point[]; right: Point[] } {
  const n = half.length, left: Point[] = [], right: Point[] = [];
  const unit = (dx: number, dy: number): [number, number] => { const length = Math.hypot(dx, dy); return length > 0 ? [-dy / length, dx / length] : [0, 0]; };
  for (let i = 0; i < n; i++) {
    const before = i > 0 ? unit(xy[2 * i] - xy[2 * i - 2], xy[2 * i + 1] - xy[2 * i - 1]) : null;
    const after = i < n - 1 ? unit(xy[2 * i + 2] - xy[2 * i], xy[2 * i + 3] - xy[2 * i + 1]) : null;
    let [nx, ny] = before && after ? [before[0] + after[0], before[1] + after[1]] : (before ?? after)!;
    const length = Math.hypot(nx, ny);
    let scale = half[i];
    if (before && after && length > 0) {
      nx /= length; ny /= length;
      scale /= Math.max(0.5, nx * before[0] + ny * before[1]);
    }
    left.push([xy[2 * i] + nx * scale, xy[2 * i + 1] + ny * scale]);
    right.push([xy[2 * i] - nx * scale, xy[2 * i + 1] - ny * scale]);
  }
  return { left, right };
}

const FADE_DEPTH = 0.85;
/** 1 for a new scar down to 0.15 at the fade age: opacity multiplier. */
const faintness = (age: number, fade: number): number => 1 - FADE_DEPTH * Math.min(1, age / fade);
/** Fraction of width left after sediment: 1 for a new channel, `1 - deposition` at the fade age. */
const remaining = (age: number, fade: number, deposition: number): number => 1 - deposition * Math.min(1, age / fade);

function polygon(surface: CompositionSurface, ribbon: Pick<RiverRibbon, "left" | "right">): void {
  surface.beginShape();
  for (const [x, y] of ribbon.left) surface.vertex(x, y);
  for (let i = ribbon.right.length - 1; i >= 0; i--) surface.vertex(ribbon.right[i][0], ribbon.right[i][1]);
  surface.endShape(surface.CLOSE);
}
function line(surface: CompositionSurface, points: readonly Point[]): void {
  surface.beginShape();
  for (const [x, y] of points) surface.vertex(x, y);
  surface.endShape();
}

function ribbonPainter(recipe: RiverRibbonsComposition): RibbonPainter {
  const spec = recipe.channel!;
  return (surface, ribbon) => {
    surface.noStroke(); color(surface, recipe.palette, 0, spec.opacity * 255, true);
    polygon(surface, ribbon);
    if (spec.banks) {
      surface.noFill(); color(surface, recipe.palette, 0, 255, false); surface.strokeWeight(spec.banks.weight); surface.strokeCap(surface.ROUND);
      line(surface, ribbon.left); line(surface, ribbon.right);
    }
  };
}

/** A stock path material drawing every path with palette tone `tone` (materials otherwise pick a random hue per path). */
function toned(material: PathMaterial, tone: number): PathMaterial {
  return (surface, path, run) => material(surface, { ...path, tone }, run);
}

function scarMaterial(scene: RiverScene, recipe: RiverRibbonsComposition): PathMaterial {
  const { scars, age } = recipe, style = scars!.style;
  return (surface, path) => {
    const old = scene.steps - path.level, keep = remaining(old, age.fade, age.deposition);
    if (keep <= 0.02) return;
    const alpha = scars!.opacity * faintness(old, age.fade) * 255;
    if (style === "lines") {
      surface.noFill(); color(surface, recipe.palette, 1, alpha, false); surface.strokeWeight(Math.max(0.15, scars!.weight * keep)); surface.strokeCap(surface.ROUND);
      line(surface, path.points);
      return;
    }
    const frame = scene.frames[path.level], fields = riverFields(frame.xy, scene.options);
    surface.noStroke(); color(surface, recipe.palette, 1, alpha, true);
    polygon(surface, riverBanks(frame.xy, ribbonHalfWidths(frame.xy, fields.width, fields.curvature, scene.options.width, 0, keep)));
  };
}

function oxbowMaterial(scene: RiverScene, recipe: RiverRibbonsComposition): PathMaterial {
  const { oxbows, age } = recipe, weight = oxbows!.weight;
  const byId = new Map(scene.oxbows.map((oxbow) => [oxbow.id, oxbow]));
  if (oxbows!.style !== "ribbon") {
    const style = oxbows!.style;
    const mark = { kind: "dot" as const, size: weight, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
    const spec: PathMaterialSpec = { kind: style, weight, spacing: style === "beads" ? Math.max(2, weight * 2.2) : Math.max(3, weight * 3.5), phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark };
    return toned(pathMaterial(spec, recipe.palette), 2);
  }
  return (surface, path) => {
    const oxbow = byId.get(path.id)!, old = scene.steps - oxbow.born, keep = remaining(old, age.fade, age.deposition);
    if (keep <= 0.02) return;
    // A closed ring is drawn as a ribbon that returns to its first point.
    const points = oxbow.closed ? [...oxbow.points, oxbow.points[0]] : oxbow.points, widths = oxbow.closed ? [...oxbow.width, oxbow.width[0]] : oxbow.width;
    const xy = new Float64Array(2 * points.length);
    points.forEach(([x, y], i) => { xy[2 * i] = x; xy[2 * i + 1] = y; });
    const half = Float64Array.from(widths, (w) => w / 2 * keep);
    surface.noStroke(); color(surface, recipe.palette, 2, oxbows!.opacity * faintness(old, age.fade) * 255, true);
    polygon(surface, riverBanks(xy, half));
  };
}

const AGE_LEVELS = 12;

/** Draw the recipe into a caller-owned surface: floodplain age tint, scars, oxbows, then the current channel on top. */
export function drawRiverRibbons(surface: CompositionSurface, recipe: RiverRibbonsComposition, consumers: RiverConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 1_000_000 })): void {
  run.check();
  const scene = riverRibbons(recipe.source);
  if (recipe.floodplain) {
    const field = riverAgeField(scene, recipe.floodplain.cell), { cell, columns } = field, [left, top] = field.bounds;
    const level = new Int8Array(field.last.length).fill(-1);
    let count = 0;
    field.last.forEach((last, i) => {
      if (last < 0) return;
      level[i] = Math.min(AGE_LEVELS - 1, Math.floor(AGE_LEVELS * Math.min(0.999, (scene.steps - last) / recipe.age.fade)));
      count++;
    });
    run.enter(count);
    try {
      surface.noStroke();
      for (let l = 0; l < AGE_LEVELS; l++) {
        color(surface, recipe.palette, 3, recipe.floodplain.opacity * (1 - FADE_DEPTH * (l + 0.5) / AGE_LEVELS) * 255, true);
        for (let i = 0; i < level.length; i++) if (level[i] === l) surface.rect(left + (i % columns) * cell, top + Math.floor(i / columns) * cell, cell, cell);
      }
    } finally { run.leave(); }
  }
  if (recipe.scars && scene.steps > 0) strokeWith(surface, riverTraces(scene, recipe.scars.every), consumers.scar ?? scarMaterial(scene, recipe), run);
  if (recipe.oxbows && scene.oxbows.length) strokeWith(surface, oxbowPaths(scene), consumers.oxbow ?? oxbowMaterial(scene, recipe), run);
  if (recipe.channel) {
    const { channel } = scene, half = ribbonHalfWidths(channel.xy, channel.width, channel.curvature, scene.options.width, recipe.channel.widening);
    const banks = riverBanks(channel.xy, half);
    run.enter(1);
    try { (consumers.ribbon ?? ribbonPainter(recipe))(surface, { id: "channel", ...banks, age: 0 }, run); } finally { run.leave(); }
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Run the migration in time slices, then build the age field and scar paths the recipe uses; false if cancelled (nothing is cached). */
export async function prepareRiverRibbonsDrawing(recipe: RiverRibbonsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const scene = await prepareRiverRibbons(recipe.source, cancelled);
  if (!scene) return false;
  if (recipe.scars) riverTraces(scene, recipe.scars.every);
  if (recipe.oxbows) oxbowPaths(scene);
  if (recipe.floodplain) { await yieldToHost(); if (cancelled()) return false; riverAgeField(scene, recipe.floodplain.cell); }
  return !cancelled();
}
