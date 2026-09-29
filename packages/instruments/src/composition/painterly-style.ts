import { medianCutQuantize } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { PAINT_FAMILIES } from "./painterly.js";
import type { PaintFamily, PaintLayer, PaintMark, PaintPlan } from "./painterly.js";
import { LUMA } from "./raster.js";
import type { MotifSpec, PathMaterialSpec } from "./types.js";

/**
 * How a painterly plan is drawn: appearance only. Nothing here can move, add or remove a plan mark.
 *
 * - `paintLayerMaterial` turns one layer and a material choice into the ordinary `PathMaterialSpec`
 *   (ink, stitch, beads: drawn along each mark's centerline) or `MotifSpec` (dot, rings, rosette, arrow:
 *   drawn at each mark's site) that the existing `pathMaterial` / `motif` consume. Sizes follow the
 *   layer's brush, so one material choice scales across the layers.
 * - `paintPalette` maps the marks' source colours to an INTERLEAVED drawing palette: entry `2i` is mark
 *   `i`'s colour and entry `2i + 1` a darker shade of it, so `tone = 2i` (set by the plan) selects the
 *   mark's own colour and the second colour that rings and rosettes draw (`tone + 1`) stays in the
 *   same hue.
 * - `keepsMark` is the stable retention test shared by every material, so switching material never
 *   changes which marks are omitted.
 */
export type PaintMaterialKind = "ink" | "stitch" | "beads" | "dot" | "rings" | "rosette" | "arrow";
export const PATH_MATERIALS: readonly PaintMaterialKind[] = ["ink", "stitch", "beads"];
export const POINT_MATERIALS: readonly PaintMaterialKind[] = ["dot", "rings", "rosette", "arrow"];
export const isPathMaterial = (kind: PaintMaterialKind): boolean => PATH_MATERIALS.includes(kind);

export interface PaintMaterialSpec {
  kind: PaintMaterialKind;
  /** Drawn width as a fraction of the planned brush width (1 fills the footprint), 0.05..2. */
  fill: number;
  /** Outline weight of rings, rosette petals and arrows, canvas units. */
  lineWeight: number;
  petals: number;
}

export type PaintColorMode = "source" | "reduced" | "palette" | "ramp";
export interface PaintColorSpec {
  mode: PaintColorMode;
  /** Colours kept by `reduced` (median cut of a deterministic sample of the marks), 1..64. */
  colors: number;
  /** Push of each source colour away from (above 1) or toward (below 1) its own gray, applied before mapping. */
  saturation: number;
}

const MAX_INK_WEIGHT = 50;
const MAX_MOTIF_SIZE = 500;
const ROUND_AREA = 2 / Math.sqrt(Math.PI); // diameter of the disc with the area of a square of side 1

/** Per-material sizes for a layer; the single source of truth for both drawing and validation. */
export function paintLayerMaterial(layer: Pick<PaintLayer, "brush" | "length">, family: PaintFamily, spec: PaintMaterialSpec):
  { path: PathMaterialSpec } | { mark: MotifSpec } {
  const b = layer.brush, fill = spec.fill, { aspect } = PAINT_FAMILIES[family];
  const motifSpec = (kind: MotifSpec["kind"], size: number): MotifSpec => ({ kind, size, petals: spec.petals,
    opening: kind === "rosette" ? 0.35 : 0.42, weight: spec.lineWeight, rotation: 0, variation: 0, retention: 1 });
  const path = (kind: PathMaterialSpec["kind"], weight: number, spacing: number, bead: number): { path: PathMaterialSpec } =>
    ({ path: { kind, weight, spacing, phase: 0.3, phaseSpread: 0, levelRamp: 0, retention: 1, mark: motifSpec("dot", bead) } });
  const round = ROUND_AREA * b * Math.sqrt(aspect) * fill;
  switch (spec.kind) {
    case "ink": return path("ink", b * fill, Math.max(0.5, b), 1);
    case "stitch": return path("stitch", Math.max(0.3, b * fill * 0.45), Math.max(1, b * 2), 1);
    case "beads": return path("beads", 1, Math.max(0.5, b * 1.2), b * fill);
    case "dot": return { mark: motifSpec("dot", round) };
    case "rings": return { mark: motifSpec("rings", round) };
    case "rosette": return { mark: motifSpec("rosette", round) };
    case "arrow": return { mark: motifSpec("arrow", layer.length * fill) };
  }
}

/** Reject a material that the existing consumers would refuse, naming the controls to change. */
export function checkPaintMaterial(brush: number, ratio: number, layers: number, family: PaintFamily, spec: PaintMaterialSpec): void {
  for (const b of [brush, brush * ratio ** -(layers - 1)]) {
    const built = paintLayerMaterial({ brush: b, length: b * PAINT_FAMILIES[family].aspect }, family, spec);
    if ("path" in built && built.path.weight > MAX_INK_WEIGHT)
      throw new Error(`Painterly source: ${spec.kind} would draw ${built.path.weight.toFixed(1)} unit lines; the limit is ${MAX_INK_WEIGHT}. Lower brush or fill`);
    if ("mark" in built && built.mark.size > MAX_MOTIF_SIZE)
      throw new Error(`Painterly source: ${spec.kind} marks would be ${built.mark.size.toFixed(0)} units; the limit is ${MAX_MOTIF_SIZE}. Lower brush or fill, or choose a shorter mark family`);
  }
}

const U32 = 0x1_0000_0000;
/** Stable omission: a mark is kept when its own draw is below `retention` (1 keeps all, 0 none). */
export const keepsMark = (mark: Pick<PaintMark, "id" | "seed">, retention: number): boolean =>
  componentSeed(mark.seed, mark.id, "keep") / U32 < retention;

const channels = (packed: number): [number, number, number] => [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
const packed = (c: readonly number[]): number =>
  ((Math.round(Math.min(255, Math.max(0, c[0]))) << 16) | (Math.round(Math.min(255, Math.max(0, c[1]))) << 8) | Math.round(Math.min(255, Math.max(0, c[2])))) >>> 0;
const luma = (c: readonly number[]): number => LUMA.r * c[0] + LUMA.g * c[1] + LUMA.b * c[2];
const nearest = (c: readonly number[], among: readonly (readonly number[])[]): number => {
  let best = 0, distance = Infinity;
  for (let i = 0; i < among.length; i++) {
    const d = (c[0] - among[i][0]) ** 2 + (c[1] - among[i][1]) ** 2 + (c[2] - among[i][2]) ** 2;
    if (d < distance) { distance = d; best = i; }
  }
  return best;
};

const MAX_REDUCE_SAMPLE = 1024;
const SHADE = 0.62;

/**
 * The interleaved drawing palette of a plan (length `2 * marks`). Modes: `source` the mark colours
 * as they are; `reduced` median cut (the existing `medianCutQuantize`, in encoded sRGB) of at most
 * 1024 marks taken at even steps of plan order, every mark then takes its nearest reduced colour;
 * `palette` every mark takes the nearest colour (encoded-sRGB distance) of the instrument palette;
 * `ramp` marks take the instrument palette sorted dark to light, chosen by the mark's CIE lightness.
 * `saturation` first moves each source colour away from its gray by that factor.
 */
export function paintPalette(plan: Pick<PaintPlan, "marks">, color: PaintColorSpec, palette: readonly number[]): readonly number[] {
  const { marks } = plan, n = marks.length, out: number[] = new Array(2 * n);
  if (n === 0) return out;
  if (!palette.length) throw new Error("Composition palette must have at least one color");
  const source = marks.map((mark) => {
    const c = channels(mark.color), y = luma(c);
    return [y + (c[0] - y) * color.saturation, y + (c[1] - y) * color.saturation, y + (c[2] - y) * color.saturation];
  });
  let chosen: number[];
  if (color.mode === "source") chosen = source.map(packed);
  else if (color.mode === "reduced") {
    const m = Math.min(n, MAX_REDUCE_SAMPLE), count = Math.min(color.colors, m);
    const sample = Array.from({ length: m }, (_, i) => source[Math.floor(i * n / m)].map((v) => Math.min(1, Math.max(0, v / 255))));
    const reduced = medianCutQuantize({ colors: sample, count, maxWork: m * m * count + m * count + m }).palette as number[][];
    const table = reduced.map((entry) => entry.map((v) => v * 255));
    chosen = source.map((c) => packed(table[nearest(c, table)]));
  } else if (color.mode === "palette") {
    const table = palette.map(channels);
    chosen = source.map((c) => palette[nearest(c, table)] >>> 0);
  } else {
    const ordered = [...palette].map((value) => value >>> 0).sort((a, b) => luma(channels(a)) - luma(channels(b)) || a - b);
    chosen = marks.map((mark) => ordered[Math.min(ordered.length - 1, Math.floor(mark.source.lightness * ordered.length))]);
  }
  for (let i = 0; i < n; i++) {
    out[2 * i] = chosen[i];
    out[2 * i + 1] = packed(channels(chosen[i]).map((v) => v * SHADE));
  }
  return out;
}
