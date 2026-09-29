import { slitCompositionsDefinition } from "../adapters/slit-compositions-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { createCompositionRun } from "./core.js";
import { bundledFrameStack } from "./frame-samples.js";
import type { BundledSequenceId } from "./frame-samples.js";
import type { EndBehaviour, FrameStack, Interpolation } from "./frame-stack.js";
import type { Raster } from "./raster.js";
import { bundledRaster } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import { sliceTable } from "./slit-map.js";
import type { Modulation, SliceOrder, SliceTable, TimeCurve } from "./slit-map.js";
import { slitFragments, slitRects, slitStrips } from "./slit.js";
import type { ColorMode, FragmentSet, OutsidePolicy, SlitCell, SlitDirection, SlitLine, SlitRect, SlitSourceValue, StripSet } from "./slit.js";
import { partitionRegions } from "./sources.js";
import { componentSeed } from "./core.js";
import type { CompositionRun, CompositionSurface } from "./types.js";

/**
 * Slit Compositions as a typed, JSON-compatible recipe with one producer chain and one consumer.
 *
 * Producers (all cached by construction, none aware of colour, gap or placement):
 * source (`bundledRaster` / `bundledFrameStack` or a caller-resolved value) -> `sliceTable` (the
 * output-band -> source mapping) -> `slitStrips` (sampled strips) and `slitFragments` (unsliced
 * windows) -> `slitRects` (quantized, run-merged, optionally clipped vector bands). `drawSlit` fills those
 * rectangles; a `band` consumer replaces the fill with any callback.
 *
 * Source. `image` and `raster` are spatial (`slice one image`); `sequence` and `stack` are temporal (`slit-scan
 * a frame sequence`). Bundled sources resolve with the composition's seed. `raster` and `stack` carry
 * caller-resolved typed values (not JSON; a host exports their hashes) - the persisted instrument names
 * only bundled sources, and binding a host's own image or frames to a Studio layer is future host work.
 *
 * Mask. `quilt` clips the bands to the retained leaves of a Region Quilt partition (`partitionRegions`, longest-side
 * cuts, bias -0.2) of the footprint: every leaf keeps its id and rectangle when `keep` changes, and
 * a leaf is retained when `componentSeed(seed, leafId, "keep")` falls below `keep`. Fragments are not clipped.
 *
 * Placement. Rectangles are in footprint-local units (origin at the centre); `drawSlit` translates to the centre and turns by
 * `rotation` degrees (positive clockwise on screen). Nothing is painted outside the footprint and no paper is drawn.
 *
 * Bands are opaque fills drawn with a hairline spill of 0.3 canvas units on every side so antialiasing does
 * not open seams between bands that abut; the spill also narrows any `gap` by 0.6 units.
 */
export type SlitSource =
  | { kind: "image"; id: BundledRasterId }
  | { kind: "sequence"; id: BundledSequenceId; frames: number }
  | { kind: "raster"; raster: Raster }
  | { kind: "stack"; stack: FrameStack };

export type SlitMask = { kind: "none" } | { kind: "quilt"; grid: number; cuts: number; keep: number };

export interface SlitComposition {
  kind: "slit-compositions";
  seed: number;
  palette: readonly number[];
  source: SlitSource;
  direction: SlitDirection;
  slices: { count: number; repeats: number; repeatMode: "same" | "alternate"; order: SliceOrder; offset: Modulation; scale: Modulation };
  /** Used by temporal sources. */
  time: { curve: TimeCurve; window: { start: number; length: number }; end: EndBehaviour; interpolation: Interpolation };
  /** Used by temporal sources. */
  slit: SlitLine;
  outside: OutsidePolicy;
  detail: number;
  footprint: { centerX: number; centerY: number; width: number; height: number; rotation: number };
  color: { mode: ColorMode; levels: number; threshold: number };
  gap: number;
  mask: SlitMask;
  fragments: { count: number; size: number; moment: number };
}

export interface SlitConsumers {
  /** Replace the default opaque fill; receives one merged rectangle in footprint-local coordinates. */
  band?: (surface: CompositionSurface, rect: SlitRect, run: CompositionRun) => void;
}

/** The resolved producers of a recipe: everything a consumer may read, all frozen values. */
export interface SlitScene {
  readonly source: SlitSourceValue;
  readonly table: SliceTable;
  readonly strips: StripSet;
  readonly fragments: FragmentSet;
  /** Retained clipping cells in footprint-local units, or `null` without a mask. */
  readonly cells: readonly SlitCell[] | null;
}

const IMAGE_SIZE = 256;

export function slitSource(recipe: SlitComposition): SlitSourceValue {
  const { source, seed } = recipe;
  switch (source.kind) {
    case "image": return { kind: "image", raster: bundledRaster(source.id, seed, IMAGE_SIZE) };
    case "sequence": return { kind: "stack", stack: bundledFrameStack(source.id, seed, source.frames) };
    case "raster": return { kind: "image", raster: source.raster };
    case "stack": return { kind: "stack", stack: source.stack };
    default: throw new Error(`Unknown slit source: ${String((source as { kind: unknown }).kind)}`);
  }
}

function check(label: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}
function validate(recipe: SlitComposition): void {
  const { footprint: f, gap, fragments, mask } = recipe;
  check("Center X", f.centerX, -1e6, 1e6); check("Center Y", f.centerY, -1e6, 1e6);
  check("Width", f.width, 1e-6, 1e6); check("Height", f.height, 1e-6, 1e6); check("Rotation", f.rotation, -1e6, 1e6);
  check("Gap", gap, 0, 0.999);
  check("Fragment size", fragments.size, 0.01, 1); check("Fragment moment", fragments.moment, 0, 1);
  if (mask.kind === "quilt") {
    if (!Number.isInteger(mask.grid) || mask.grid < 2 || mask.grid > 96) throw new Error("Mask grid must be an integer in [2, 96]");
    if (!Number.isInteger(mask.cuts) || mask.cuts < 0 || mask.cuts > 400) throw new Error("Mask cuts must be an integer in [0, 400]");
    check("Mask keep", mask.keep, 0, 1);
  } else if (mask.kind !== "none") throw new Error(`Unknown mask: ${String((mask as { kind: unknown }).kind)}`);
}

/** Retained quilt leaves in footprint-local units (a fraction `keep` of the leaves, by stable id). */
export function quiltCells(mask: Extract<SlitMask, { kind: "quilt" }>, seed: number, width: number, height: number): readonly SlitCell[] {
  const leaves = partitionRegions({ seed: componentSeed(seed, "mask", "partition"), width, height, centerX: 0, centerY: 0,
    columns: mask.grid, rows: mask.grid, attempts: mask.cuts, axis: "LONGEST", bias: -0.2 });
  const U32 = 0x1_0000_0000;
  return Object.freeze(leaves.filter((leaf) => componentSeed(seed, leaf.id, "keep") / U32 < mask.keep).map((leaf) => leaf.bounds as SlitCell));
}

/** Resolve every producer of the recipe. Appearance (colour, gap, placement, palette) plays no part. */
export function slitScene(recipe: SlitComposition): SlitScene {
  validate(recipe);
  const source = slitSource(recipe), { footprint: f, slices, time } = recipe;
  const temporal = source.kind === "stack";
  const table = sliceTable({ seed: recipe.seed, count: slices.count, repeats: slices.repeats, repeatMode: slices.repeatMode, order: slices.order,
    offset: slices.offset, scale: slices.scale,
    scan: temporal ? { kind: "time", curve: time.curve, window: time.window, end: time.end, interpolation: time.interpolation } : { kind: "space" } },
  temporal ? source.stack : undefined);
  const strips = slitStrips(source, table, { direction: recipe.direction, width: f.width, height: f.height, detail: recipe.detail, outside: recipe.outside, slit: recipe.slit });
  const fragments = slitFragments(source, { seed: recipe.seed, count: recipe.fragments.count, size: recipe.fragments.size, time: recipe.fragments.moment,
    width: f.width, height: f.height, detail: recipe.detail });
  const cells = recipe.mask.kind === "quilt" ? quiltCells(recipe.mask, recipe.seed, f.width, f.height) : null;
  return Object.freeze({ source, table, strips, fragments, cells });
}

/** The vector rectangles of a scene under the recipe's appearance (colour, gap, mask). */
export function slitBands(recipe: SlitComposition, scene: SlitScene = slitScene(recipe)): readonly SlitRect[] {
  const { footprint: f } = recipe;
  return slitRects(scene.table, scene.strips, scene.fragments, { direction: recipe.direction, width: f.width, height: f.height,
    color: { ...recipe.color, palette: recipe.palette }, gap: recipe.gap, cells: scene.cells });
}

/** Antialiasing spill, canvas units per side. */
export const SLIT_SPILL = 0.3;

const packed = (rgb: readonly [number, number, number]): number => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

export function drawSlit(surface: CompositionSurface, recipe: SlitComposition, consumers: SlitConsumers = {}, run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const rects = slitBands(recipe);
  const { footprint: f } = recipe;
  surface.push();
  try {
    surface.translate(f.centerX, f.centerY);
    if (f.rotation !== 0) surface.rotate((f.rotation * Math.PI) / 180);
    surface.noStroke();
    if (consumers.band) {
      for (const rect of rects) {
        run.enter(1);
        try {
          surface.push();
          try { consumers.band(surface, rect, run); } finally { surface.pop(); }
        } finally { run.leave(); }
      }
    } else {
      let last = -1;
      for (let i = 0; i < rects.length; i++) {
        if ((i & 4095) === 0) run.check();
        const r = rects[i], color = packed(r.rgb);
        if (color !== last) { surface.fill(r.rgb[0], r.rgb[1], r.rgb[2]); last = color; }
        surface.rect(r.x - SLIT_SPILL, r.y - SLIT_SPILL, r.width + 2 * SLIT_SPILL, r.height + 2 * SLIT_SPILL);
      }
    }
  } finally { surface.pop(); }
}

const tick = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Resolve the source, table, strips and fragments one stage at a time, yielding between stages; false if cancelled. */
export async function prepareSlit(recipe: SlitComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  validate(recipe);
  slitSource(recipe);
  await tick();
  if (cancelled()) return false;
  const scene = slitScene(recipe);
  await tick();
  if (cancelled()) return false;
  slitBands(recipe, scene);
  return !cancelled();
}

// ------------------------------------------------------------------------------ named-instrument binding

type Scalar = number | string | boolean;
const definition = slitCompositionsDefinition;

/** Resolve stored scalar controls to the public recipe. */
export function slitComposition(input: InstrumentInput): SlitComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const temporal = q.mode === "time";
  const curve: TimeCurve = q.timeCurve === "power" ? { kind: "power", power: q.curvePower as number }
    : q.timeCurve === "swing" ? { kind: "swing", cycles: q.swings as number }
    : q.timeCurve === "gesture" ? { kind: "gesture", recording: q.gesture as never, channel: q.gestureChannel as never } : { kind: "linear" };
  const modulation = (prefix: "offset" | "scale"): Modulation => ({ mode: q[`${prefix}Mode`] as Modulation["mode"], amount: q[prefix] as number, period: q[`${prefix}Period`] as number });
  return {
    kind: "slit-compositions", seed: input.seed, palette: [...input.palette],
    source: temporal ? { kind: "sequence", id: q.scene as BundledSequenceId, frames: q.frames as number } : { kind: "image", id: q.image as BundledRasterId },
    direction: q.direction as SlitDirection,
    slices: { count: q.slices as number, repeats: q.repeats as number, repeatMode: q.repeatMode as "same" | "alternate",
      order: { kind: q.order as SliceOrder["kind"], groups: q.groups as number, disorder: q.disorder as number, phase: q.phase as number },
      offset: modulation("offset"), scale: modulation("scale") },
    time: { curve, window: { start: q.windowStart as number, length: q.windowLength as number }, end: q.end as EndBehaviour, interpolation: q.interpolation as Interpolation },
    slit: { x: q.slitX as number, angle: q.slitAngle as number, bend: q.slitBend as number, length: q.slitLength as number },
    outside: q.outside as OutsidePolicy, detail: q.detail as number,
    footprint: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number },
    color: { mode: q.color as ColorMode, levels: q.levels as number, threshold: q.threshold as number },
    gap: q.gap as number,
    mask: q.mask === "quilt" ? { kind: "quilt", grid: q.maskGrid as number, cuts: q.maskCuts as number, keep: q.maskKeep as number } : { kind: "none" },
    fragments: { count: q.fragments as number, size: q.fragmentSize as number, moment: q.fragmentMoment as number },
  };
}
