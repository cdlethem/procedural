import { geologicalCutawaysDefinition } from "../adapters/geological-cutaways-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { camera as makeCamera, type Camera } from "./camera.js";
import { createCompositionRun } from "./core.js";
import { meshDerived, meshStorage } from "./mesh.js";
import { geologicalBlock, type GeologicalBlock } from "./strata-block.js";
import { viewGeometry, TRI, type CornerSide, type CutKind, type CutOptions, type LineKind, type LineOptions, type ViewGeometry } from "./strata-cut.js";
import { strataModel, type FaultDipDirection, type FaultStrike, type FaultStyle, type FoldType, type StrataModel, type StrataOptions, type ThicknessSequence } from "./strata.js";
import { hiddenLines, paintOrder, type HiddenLineResult, type PaintOrder } from "./visibility.js";
import type { CompositionRun, CompositionSurface } from "./types.js";

/**
 * Geological Cutaways as a typed, JSON-compatible composition over the producers in `strata.ts`, `strata-block.ts` and
 * `strata-cut.ts`:
 *
 *   strataModel -> geologicalBlock (block Mesh, erosion surface) -> viewGeometry (cut, sections, lines)   [geology: no camera]
 *   camera -> paintOrder + hiddenLines                                                                     [view: no geology]
 *   palette, fill, shading, line weights                                                                   [appearance]
 *
 * `geologicalProducts` returns the geology stages, each cached by its own construction: a camera edit never rebuilds the block or
 * the sections, an appearance edit never re-orders or re-projects anything, a cut edit never re-solves the strata. Structure
 * (strata, folds, faults, erosion, block shape, grid) is one key, the cut and the line counts a second, the camera a third.
 *
 * The persisted form is the technique id, scalar parameters and a palette. Meshes are accepted by the direct API (`drawGeologicalView`
 * takes any `ViewGeometry`); host binding of a user's own mesh or scan as a model is future work: the model here is the stated
 * horizon-function model, not a reconstruction. Entry 0 of the palette is ink (lines) whenever the palette has more than one entry;
 * strata use entries 1..n-1. Work is charged to the run (default 600,000 units) per painted triangle and line point; construction
 * has its own explicit limits (`BLOCK_LIMITS`, `MAX_BED_VERTICES`, the section limits of the mesh foundation).
 */
export type GeologicalColorBy = "cycle" | "ramp";
export type GeologicalFill = "shaded" | "flat" | "none";

export interface GeologicalCutawaysComposition {
  kind: "geological-cutaways";
  seed: number;
  palette: readonly number[];
  structure: StrataOptions;
  resolution: number;
  cut: CutOptions;
  lines: LineOptions;
  view: { projection: "orthographic" | "perspective"; yaw: number; pitch: number; distance: number; size: number; centerX: number; centerY: number };
  paint: {
    fill: GeologicalFill; shade: number; opacity: number; colorBy: GeologicalColorBy;
    lineColor: "ink" | "stratum"; hidden: "drop" | "dashed";
    weights: { outline: number; contact: number; fault: number; bed: number; contour: number };
  };
}

type Scalar = number | string | boolean;
const definition = geologicalCutawaysDefinition;
export const DEFAULT_GEOLOGICAL_WORK = 600_000;

/** Resolve stored scalar controls to the public composition value. */
export function geologicalCutawaysComposition(input: InstrumentInput): GeologicalCutawaysComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const num = (key: string) => q[key] as number;
  const faulted = q.faulted === true, eroded = q.ground === "eroded", folded = q.fold !== "none";
  return {
    kind: "geological-cutaways", seed: input.seed, palette: [...input.palette],
    structure: {
      seed: input.seed, depth: num("depth"), height: num("height"), strata: num("strata"), sequence: q.sequence as ThicknessSequence,
      contrast: q.sequence === "uniform" ? 1 : num("contrast"), stack: num("stack"), trend: num("trend"), tilt: num("tilt"), tiltAzimuth: num("tiltAzimuth"),
      fold: q.fold as FoldType, foldAmplitude: folded ? num("foldAmplitude") : 0, foldWavelength: folded ? num("foldWavelength") : 1,
      foldAxis: folded ? num("foldAxis") : 0, foldPhase: folded ? num("foldPhase") : 0,
      faultCount: faulted ? num("faultCount") : 0, faultThrow: faulted ? num("faultThrow") : 0, faultDip: faulted ? num("faultDip") : 90,
      faultStrike: (faulted ? q.faultStrike : "depth") as FaultStrike, faultDipDirection: (faulted ? q.faultDipDirection : "left") as FaultDipDirection,
      faultStyle: (faulted ? q.faultStyle : "stepped") as FaultStyle, faultShift: faulted ? num("faultShift") : 0, faultScatter: faulted ? num("faultScatter") : 0,
      relief: eroded ? num("relief") : 0, reliefScale: eroded ? num("reliefScale") : 1,
    },
    resolution: num("resolution"),
    cut: {
      kind: q.cut as CutKind,
      slicePosition: q.cut === "slice" || q.cut === "exploded" ? num("slicePosition") : 0.5, sliceAzimuth: q.cut === "slice" || q.cut === "exploded" ? num("sliceAzimuth") : 0,
      sliceDip: q.cut === "slice" || q.cut === "exploded" ? num("sliceDip") : 90,
      corner: (q.cut === "corner" ? q.corner : "front-right") as CornerSide, cutWidth: q.cut === "corner" ? num("cutWidth") : 0.5, cutDepth: q.cut === "corner" ? num("cutDepth") : 0.5,
      cutHeight: q.cut === "corner" ? num("cutHeight") : 0.5, gap: q.cut === "exploded" ? num("gap") : 0,
    },
    lines: { beds: num("beds"), contours: eroded ? num("contours") : 0 },
    view: { projection: q.projection as "orthographic", yaw: num("yaw"), pitch: num("pitch"), distance: q.projection === "perspective" ? num("distance") : 3.5, size: num("size"), centerX: num("centerX"), centerY: num("centerY") },
    paint: {
      fill: q.fill as GeologicalFill, shade: q.fill === "shaded" ? num("shade") : 0, opacity: q.fill === "none" ? 1 : num("opacity"), colorBy: q.colorBy as GeologicalColorBy,
      lineColor: q.lineColor as "ink", hidden: q.hidden as "drop",
      weights: { outline: num("outlineWeight"), contact: num("contactWeight"), fault: num("faultWeight"), bed: num("bedWeight"), contour: num("contourWeight") },
    },
  };
}

/** Whether the seed can change this construction. */
export function geologicalCutawaysUsesSeed(q: Record<string, Scalar>): boolean {
  return q.fold !== "none" || q.sequence === "random" && Number(q.contrast) > 1 || q.ground === "eroded" && Number(q.relief) > 0 ||
    q.faulted === true && (Number(q.faultScatter) > 0 || q.faultStyle === "mixed");
}

export interface GeologicalProducts {
  readonly model: StrataModel;
  readonly block: GeologicalBlock;
  readonly view: ViewGeometry;
}

/** The geology stages the consumers read; none depends on the camera or the appearance. */
export function geologicalProducts(recipe: GeologicalCutawaysComposition): GeologicalProducts {
  const model = strataModel(recipe.structure);
  const block = geologicalBlock(model, recipe.resolution);
  const view = viewGeometry(block, recipe.cut, recipe.lines);
  return { model, block, view };
}

/** The camera of a recipe: its size fits the whole block (and any explosion) whatever the angle. */
export function geologicalCamera(recipe: GeologicalCutawaysComposition, view: ViewGeometry): Camera {
  const { view: v } = recipe, diameter = 2 * view.fit.radius;
  return makeCamera({
    projection: v.projection, yaw: v.yaw, pitch: v.pitch, roll: 0, target: view.fit.center, zoom: v.size / diameter, distance: v.distance * diameter,
    near: v.distance * diameter / 50, center: [v.centerX, v.centerY],
  });
}

// ---------------------------------------------------------------------------------------------
// Camera stage: painter order and hidden lines, cached per view geometry and camera

const orders = new WeakMap<ViewGeometry, Map<string, PaintOrder>>();
const hidden = new WeakMap<ViewGeometry, Map<string, HiddenLineResult>>();
function perCamera<T>(store: WeakMap<ViewGeometry, Map<string, T>>, view: ViewGeometry, cam: Camera, make: () => T): T {
  let by = store.get(view);
  if (!by) { by = new Map(); store.set(view, by); }
  const hit = by.get(cam.key);
  if (hit !== undefined) { by.delete(cam.key); by.set(cam.key, hit); return hit; }
  const value = make();
  by.set(cam.key, value);
  if (by.size > 3) by.delete(by.keys().next().value!);
  return value;
}
export function geologicalPaintOrder(view: ViewGeometry, cam: Camera): PaintOrder {
  return perCamera(orders, view, cam, () => paintOrder(view.mesh, cam, { cull: "back", maxWork: 200_000_000 }));
}
export function geologicalHiddenLines(view: ViewGeometry, cam: Camera): HiddenLineResult {
  return perCamera(hidden, view, cam, () => hiddenLines(view.mesh, view.curves, cam, { occluders: "front", maxWork: 200_000_000 }));
}

// ---------------------------------------------------------------------------------------------
// Appearance

/** RGB of a stratum: palette entries 1..n-1 cycled, or one ramp through them; entry 0 is ink when the palette has more than one entry. */
export function stratumColor(palette: readonly number[], mode: GeologicalColorBy, stratum: number, strata: number): readonly [number, number, number] {
  const split = (c: number): [number, number, number] => [(c >>> 16) & 255, (c >>> 8) & 255, c & 255];
  if (palette.length === 1) return split(palette[0]);
  const colors = palette.slice(1);
  if (mode === "cycle" || colors.length === 1) return split(colors[stratum % colors.length]);
  const t = strata <= 1 ? 0 : (stratum / (strata - 1)) * (colors.length - 1), lo = Math.floor(t), hi = Math.min(colors.length - 1, lo + 1), f = t - lo;
  const a = split(colors[lo]), b = split(colors[hi]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const inkColor = (palette: readonly number[]): readonly [number, number, number] => [(palette[0] >>> 16) & 255, (palette[0] >>> 8) & 255, palette[0] & 255];

function dashed(points: readonly (readonly [number, number])[], on: number, off: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let draw = true, left = on;
  for (let i = 0; i + 1 < points.length; i++) {
    let [x, y] = points[i];
    const [x2, y2] = points[i + 1], length = Math.hypot(x2 - x, y2 - y);
    if (length === 0) continue;
    let remaining = length;
    while (remaining > 1e-9) {
      const step = Math.min(left, remaining), t = step / remaining, nx = x + (x2 - x) * t, ny = y + (y2 - y) * t;
      if (draw) out.push([x, y, nx, ny]);
      x = nx; y = ny; remaining -= step; left -= step;
      if (left <= 1e-9) { draw = !draw; left = draw ? on : off; }
    }
  }
  return out;
}

const LINE_ORDER: readonly LineKind[] = ["contour", "bed", "contact", "fault", "outline"];

/**
 * Paint a geometry stage through a camera and appearance: far-to-near fills of the cut block's triangles, then lines with hidden-line
 * removal. Any `ViewGeometry` can be drawn, whatever produced it.
 */
export function drawGeologicalView(surface: CompositionSurface, recipe: GeologicalCutawaysComposition, view: ViewGeometry, cam: Camera, run: CompositionRun): void {
  const { paint, palette } = recipe, n = recipe.structure.strata;
  const store = meshStorage(view.mesh), normals = meshDerived(view.mesh).triangleNormals;
  const order = paint.fill === "none" ? [] : geologicalPaintOrder(view, cam).order;
  const result = geologicalHiddenLines(view, cam);
  run.enter(order.length + result.paths.reduce((sum, p) => sum + p.points.length, 0));
  try {
    if (order.length) {
      // Light from the upper left, toward the viewer, in camera space.
      const L = [0, 1, 2].map((i) => -0.35 * cam.right[i] + 0.75 * cam.up[i] - 0.55 * cam.forward[i]);
      const norm = Math.hypot(L[0], L[1], L[2]);
      const alpha = Math.round(255 * paint.opacity);
      const colors: (readonly [number, number, number])[] = [];
      for (let k = 0; k < n; k++) colors.push(stratumColor(palette, paint.colorBy, k, n));
      surface.strokeWeight(0.6); surface.strokeCap(surface.ROUND);
      for (const t of order) {
        run.check();
        const pts: [number, number][] = [];
        let ok = true;
        for (let k = 0; k < 3; k++) {
          const i = store.triangles[t * 3 + k];
          const p = cam.project([store.positions[i * 3], store.positions[i * 3 + 1], store.positions[i * 3 + 2]]);
          if (!p) { ok = false; break; }
          pts.push([p.x, p.y]);
        }
        if (!ok) continue;
        const lambert = Math.max(0, (normals[t * 3] * L[0] + normals[t * 3 + 1] * L[1] + normals[t * 3 + 2] * L[2]) / norm);
        const f = 1 - paint.shade * (1 - (0.3 + 0.7 * lambert));
        const c = colors[view.triStratum[t]];
        surface.fill(c[0] * f, c[1] * f, c[2] * f, alpha);
        if (paint.opacity >= 1) surface.stroke(c[0] * f, c[1] * f, c[2] * f, alpha); else surface.noStroke();
        surface.beginShape();
        surface.vertex(pts[0][0], pts[0][1]); surface.vertex(pts[1][0], pts[1][1]); surface.vertex(pts[2][0], pts[2][1]);
        surface.endShape(surface.CLOSE);
      }
    }
    // Lines: kinds in a fixed order so heavier structure lands on top of finer.
    const kindOf = new Map(view.curves.map((c) => [c.id, c] as const));
    const ink = inkColor(palette), strataColors: (readonly [number, number, number])[] = [];
    for (let k = 0; k < n; k++) strataColors.push(stratumColor(palette, paint.colorBy, k, n));
    surface.noFill();
    for (const kind of LINE_ORDER) {
      const weight = paint.weights[kind];
      if (weight <= 0) continue;
      surface.strokeWeight(weight);
      for (const path of result.paths) {
        const curve = kindOf.get(path.curve);
        if (!curve || curve.kind !== kind) continue;
        const showHidden = paint.hidden === "dashed" && (kind === "outline" || kind === "fault");
        if (!path.visible && !showHidden) continue;
        const c = paint.lineColor === "stratum" && (kind === "contact" || kind === "bed") ? strataColors[Math.min(n - 1, Math.max(0, curve.tone))] : ink;
        run.check();
        if (path.visible) {
          surface.stroke(c[0], c[1], c[2], 255);
          if (path.points.length === 2) surface.line(path.points[0][0], path.points[0][1], path.points[1][0], path.points[1][1]);
          else { surface.beginShape(); for (const [x, y] of path.points) surface.vertex(x, y); surface.endShape(path.closed ? surface.CLOSE : undefined); }
        } else {
          surface.stroke(c[0], c[1], c[2], 110);
          for (const [x1, y1, x2, y2] of dashed(path.points, 5, 4)) surface.line(x1, y1, x2, y2);
        }
      }
    }
  } finally { run.leave(); }
}

/** Draw already-built geology through the recipe's camera and appearance. */
export function drawGeologicalProducts(surface: CompositionSurface, recipe: GeologicalCutawaysComposition, products: GeologicalProducts, run: CompositionRun): void {
  drawGeologicalView(surface, recipe, products.view, geologicalCamera(recipe, products.view), run);
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawGeologicalCutaways(surface: CompositionSurface, recipe: GeologicalCutawaysComposition, run: CompositionRun = createCompositionRun({ maxWork: DEFAULT_GEOLOGICAL_WORK })): void {
  run.check();
  drawGeologicalProducts(surface, recipe, geologicalProducts(recipe), run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the stages one at a time, yielding between them; false if cancelled. */
export async function prepareGeologicalCutaways(recipe: GeologicalCutawaysComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const model = strataModel(recipe.structure);
  await yieldToHost();
  if (cancelled()) return false;
  const block = geologicalBlock(model, recipe.resolution);
  await yieldToHost();
  if (cancelled()) return false;
  const view = viewGeometry(block, recipe.cut, recipe.lines);
  await yieldToHost();
  if (cancelled()) return false;
  const cam = geologicalCamera(recipe, view);
  geologicalPaintOrder(view, cam);
  geologicalHiddenLines(view, cam);
  return !cancelled();
}
export { TRI };
