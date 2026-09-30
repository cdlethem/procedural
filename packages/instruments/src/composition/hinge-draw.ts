import { hingedPanelsDefinition } from "../adapters/hinged-panels-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { camera as makeCamera } from "./camera.js";
import type { Camera } from "./camera.js";
import { atEach, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { foldPanels, hingeAngles, panelNormal, panelPoint } from "./hinge-fold.js";
import type { ClosureOptions, FoldedPanels, FoldFieldOptions } from "./hinge-fold.js";
import { posedPanels } from "./hinge-mesh.js";
import type { PosedMeshOptions, PosedPanels } from "./hinge-mesh.js";
import { hatchPolygon } from "./hyperbolic-draw.js";
import { panelBoundaryEdges, panelTiling } from "./hinge-tiling.js";
import type { PanelPoint, PanelTiling, PanelTilingOptions } from "./hinge-tiling.js";
import { motif } from "./materials.js";
import { meshDerived, meshStorage } from "./mesh.js";
import type { Vec3 } from "./mesh.js";
import { pointCloud } from "./mesh-sample.js";
import type { PointCloud } from "./mesh-sample.js";
import { memoized } from "./sources.js";
import { hiddenLines, paintOrder, visiblePoints } from "./visibility.js";
import type { HiddenLineResult, PaintOrder, SpatialCurve } from "./visibility.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, Site } from "./types.js";

/**
 * Hinged Panels as a typed, JSON-compatible composition over separate producer stages, each a public function:
 *
 *   panelTiling -> hingeAngles -> foldPanels -> posedPanels (mesh)     construction: cached by structure only
 *   camera -> paintOrder / hiddenLines / visiblePoints                 view: cached by mesh key and camera
 *   fills, hatch, lines, motifs                                        appearance: recomputes nothing above
 *
 * `hingedProducts` returns the construction values: none depends on the camera, palette, fill, hatching, lines or
 * motifs, so an appearance edit reuses every one of them, and a camera edit reuses the mesh (the tests compare mesh
 * keys). A crease-pattern drawing never builds the posed mesh or a camera.
 *
 * Coordinates: sheet lengths are panel edges (the shortest edge is 1); `size` maps the flat sheet's diagonal to canvas
 * units, so the folded sheet keeps that scale. Tones follow the other studies: palette entry 0 is ink (lines, hatch,
 * cracks use entry 1 when there is more than one entry), fills use entries 1..n-1, the motif the next one along.
 *
 * Folded drawing: painter's algorithm over the mesh triangles (exact where `PaintOrder.exact`), each triangle lit by
 * a fixed world light, panel hatching clipped to the triangle in screen space, then hinge lines through the exact
 * hidden-line solver and panel motifs through the exact point-occlusion test. Motifs are drawn whole where their
 * centre is visible, so a panel partly covered by another shows its motif over the cover.
 */
export type HingedTreatment = "folded" | "crease";
export type HingedFill = "none" | "flat" | "shaded";
export type HingedColorBy = "class" | "depth" | "fold" | "tilt" | "height" | "panel" | "single";
export type HingedLines = "none" | "folds" | "hinges" | "panels";
export type HingedMotif = "none" | "dot" | "rings" | "rosette" | "arrow";

export interface HingedPanelsComposition {
  kind: "hinged-panels";
  seed: number;
  palette: readonly number[];
  tiling: PanelTilingOptions;
  fold: FoldFieldOptions;
  closure: ClosureOptions;
  body: PosedMeshOptions;
  placement: { centerX: number; centerY: number; size: number; fit: "sheet" | "form"; roll: number };
  view: { projection: "orthographic" | "perspective"; yaw: number; pitch: number; perspective: number };
  treatment: HingedTreatment;
  fill: { mode: HingedFill; colorBy: HingedColorBy; opacity: number; shade: number; lightAzimuth: number; lightElevation: number };
  hatch: { on: boolean; angle: number; spacing: number; weight: number };
  lines: { mode: HingedLines; weight: number; hidden: "drop" | "faint"; open: boolean };
  motif: { kind: HingedMotif; size: number; weight: number; turn: number; variation: number };
}

/** Replace a built-in consumer with an ordinary callback. */
export interface HingedConsumers {
  /** Receives each visible line run; `path.tone` is 0 mountain, 1 valley, 2 flat hinge, 3 crack, 4 outline. */
  line?: PathMaterial;
  /** Draws in the panel's own frame (edge units, x along the panel's u axis, y opposite v), already foreshortened. */
  mark?: Mark;
}

type Scalar = number | string | boolean;
const definition = hingedPanelsDefinition;
const radians = Math.PI / 180;
const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const PAPER: readonly [number, number, number] = [240, 234, 220];

/** Resolve stored scalar controls to the public composition value. */
export function hingedPanelsComposition(input: InstrumentInput): HingedPanelsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const num = (key: string) => q[key] as number;
  const seed = input.seed;
  return {
    kind: "hinged-panels", seed, palette: [...input.palette],
    tiling: { seed, source: q.source as PanelTilingOptions["source"], columns: num("columns"), rows: num("rows"), patch: q.patch as string, depth: num("depth"), retention: num("retention") },
    fold: { seed, rule: q.rule as FoldFieldOptions["rule"], angle: num("angle"), direction: q.direction as "mountain", period: num("period"), stripeAngle: num("stripeAngle"),
      phase: num("phase"), disorder: num("disorder"), amount: num("amount"), select: q.hinges as FoldFieldOptions["select"], axis: num("hingeAxis"), share: num("hingeShare") },
    closure: { seed, anchor: q.anchor as ClosureOptions["anchor"], anchors: num("anchors"), tree: q.tree as ClosureOptions["tree"] },
    body: { gap: num("gap"), thickness: num("thickness") },
    placement: { centerX: num("centerX"), centerY: num("centerY"), size: num("size"), fit: q.fit as "sheet" | "form", roll: num("roll") },
    view: { projection: q.projection as "orthographic", yaw: num("yaw"), pitch: num("pitch"), perspective: num("perspective") },
    treatment: q.treatment as HingedTreatment,
    fill: { mode: q.fill as HingedFill, colorBy: q.colorBy as HingedColorBy, opacity: num("opacity"), shade: num("shade"), lightAzimuth: num("lightAzimuth"), lightElevation: num("lightElevation") },
    hatch: { on: q.hatch as boolean, angle: num("hatchAngle"), spacing: num("hatchSpacing"), weight: num("hatchWeight") },
    lines: { mode: q.lines as HingedLines, weight: num("lineWeight"), hidden: q.hidden as "drop", open: q.open as boolean },
    motif: { kind: q.motif as HingedMotif, size: num("motifSize"), weight: num("motifWeight"), turn: num("motifTurn"), variation: num("motifVariation") },
  };
}

/** Whether the seed can change this drawing (only controls in effect count). */
export function hingedPanelsUsesSeed(q: Record<string, Scalar>): boolean {
  const share = q.hingeShare as number;
  return (q.retention as number) < 1 || q.rule === "seeded" || q.rule !== "seeded" && (q.disorder as number) > 0 || q.hinges === "share" && share > 0 && share < 1 || q.anchor === "seeded"
    || q.colorBy === "panel" && q.fill !== "none" || q.motif !== "none" && (q.motifVariation as number) > 0 || q.colorBy === "panel" && q.motif !== "none";
}

export interface HingedProducts {
  readonly tiling: PanelTiling;
  /** Requested signed angle per hinge (degrees; mountain positive). */
  readonly angles: Float64Array;
  readonly folded: FoldedPanels;
}

/** The construction values the consumers read; each is cached by its own construction. */
export function hingedProducts(recipe: HingedPanelsComposition): HingedProducts {
  const tiling = panelTiling(recipe.tiling);
  const angles = hingeAngles(tiling, recipe.fold);
  return { tiling, angles, folded: foldPanels(tiling, angles, recipe.closure) };
}

/** The posed mesh (folded treatment only; depends on gap and thickness, never on the camera). */
export function hingedPosed(recipe: HingedPanelsComposition, products: HingedProducts = hingedProducts(recipe)): PosedPanels {
  return posedPanels(products.folded, recipe.body);
}

/** The camera for a posed sheet: the target is the centre of the folded bounds, so a fold never leaves the canvas centre. */
export function hingedCamera(recipe: HingedPanelsComposition, posed: PosedPanels): Camera {
  const { min, max } = posed.mesh.bounds, { view, placement } = recipe;
  const D = placement.fit === "sheet" ? posed.folded.tiling.diameter : Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  return makeCamera({ projection: view.projection, yaw: view.yaw, pitch: view.pitch, roll: placement.roll,
    target: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], zoom: placement.size / D, distance: view.perspective * D,
    center: [placement.centerX, placement.centerY] });
}

// ---- line and tone assignment ------------------------------------------------------------------

/** Line tones. */
export const LINE_TONE = Object.freeze({ mountain: 0, valley: 1, flat: 2, crack: 3, outline: 4 });

interface LineCurve extends SpatialCurve { readonly tone: number }

/** The 3D hinge, crack and outline curves for a line mode, on the posed panels. */
export function hingedCurves(folded: FoldedPanels, mode: HingedLines, cracks: boolean): readonly LineCurve[] {
  const { tiling } = folded, out: LineCurve[] = [];
  for (const hinge of tiling.hinges) {
    const status = folded.report[hinge.index], closed = status.kind !== "open";
    if (closed && mode !== "none") {
      const angle = status.kind === "tree" ? status.requested : status.achieved;
      const tone = Math.abs(angle) < 1e-6 ? LINE_TONE.flat : angle > 0 ? LINE_TONE.mountain : LINE_TONE.valley;
      if (mode === "folds" ? tone !== LINE_TONE.flat : true)
        out.push({ id: hinge.id, points: [panelPoint(folded, hinge.panels[0], hinge.a[0], hinge.a[1]), panelPoint(folded, hinge.panels[0], hinge.b[0], hinge.b[1])], tone });
    } else if (!closed) {
      // an open hinge is two separate edges, one carried by each panel
      const requested = status.requested;
      const tone = cracks ? LINE_TONE.crack : Math.abs(requested) < 1e-6 ? LINE_TONE.flat : requested > 0 ? LINE_TONE.mountain : LINE_TONE.valley;
      if (cracks || (mode !== "none" && (mode !== "folds" || tone !== LINE_TONE.flat)))
        for (const side of [0, 1] as const)
          out.push({ id: `${hinge.id}@${side}`, points: [panelPoint(folded, hinge.panels[side], hinge.a[0], hinge.a[1]), panelPoint(folded, hinge.panels[side], hinge.b[0], hinge.b[1])], tone });
    }
  }
  if (mode === "panels") for (const [k, piece] of panelBoundaryEdges(tiling).entries())
    out.push({ id: `outline:${k}`, points: [panelPoint(folded, piece.panel, piece.a[0], piece.a[1]), panelPoint(folded, piece.panel, piece.b[0], piece.b[1])], tone: LINE_TONE.outline });
  return out;
}

/** Palette tone (1..n-1, or 0 for a one-colour palette) of every panel, from its structure. */
export function panelTones(folded: FoldedPanels, colorBy: HingedColorBy, paletteLength: number, seed: number): Int32Array {
  const { panels } = folded.tiling, tones = new Int32Array(panels.length), accents = Math.max(1, paletteLength - 1), base = paletteLength > 1 ? 1 : 0;
  const ramp = (t: number): number => base + Math.min(accents - 1, Math.max(0, Math.floor(t * accents)));
  let lo = Infinity, hi = -Infinity;
  const height = new Float64Array(panels.length);
  if (colorBy === "height") {
    for (const p of panels) {
      let sum = 0;
      for (const [u, v] of p.corners) sum += panelPoint(folded, p.index, u, v)[1];
      height[p.index] = sum / p.corners.length;
      lo = Math.min(lo, height[p.index]); hi = Math.max(hi, height[p.index]);
    }
  }
  let maxDepth = 1;
  if (colorBy === "depth") for (const d of folded.depth) maxDepth = Math.max(maxDepth, d);
  for (const p of panels) {
    let tone: number;
    switch (colorBy) {
      case "class": tone = base + p.cls % accents; break;
      case "depth": tone = base + folded.depth[p.index] % accents; break;
      case "fold": {
        const h = folded.parentHinge[p.index], angle = h < 0 ? 0 : folded.angles[h];
        tone = base + (Math.abs(angle) < 1e-6 ? 0 : angle > 0 ? 1 : 2) % accents;
        break;
      }
      case "tilt": tone = ramp(Math.acos(Math.max(-1, Math.min(1, panelNormal(folded, p.index)[1]))) / Math.PI); break;
      case "height": tone = ramp(hi > lo ? (height[p.index] - lo) / (hi - lo) : 0); break;
      case "panel": tone = base + componentSeed(seed, p.id, "tone") % accents; break;
      default: tone = base;
    }
    tones[p.index] = tone;
  }
  return tones;
}

// ---- drawing helpers ---------------------------------------------------------------------------

function rgb(palette: readonly number[], index: number): [number, number, number] {
  const value = palette[index % palette.length] >>> 0;
  return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

/** A dashed stroke along a polyline (canvas units). */
function dashed(surface: CompositionSurface, points: readonly (readonly [number, number])[], pattern: readonly number[]): void {
  let index = 0, remaining = pattern[0], on = true;
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1];
    const [tx, ty] = points[i], length = Math.hypot(tx - x, ty - y);
    if (length === 0) continue;
    const dx = (tx - x) / length, dy = (ty - y) / length;
    let left = length;
    while (left > 1e-9) {
      const step = Math.min(left, remaining);
      if (on) surface.line(x, y, x + dx * step, y + dy * step);
      x += dx * step; y += dy * step; left -= step; remaining -= step;
      if (remaining <= 1e-9) { index = (index + 1) % pattern.length; remaining = pattern[index]; on = !on; }
    }
  }
}

function lineMaterial(recipe: HingedPanelsComposition, mode: HingedTreatment, faint: boolean): PathMaterial {
  const { palette, lines } = recipe, w = lines.weight;
  return (surface, path) => {
    if (w === 0 || path.points.length < 2) return;
    const tone = path.tone ?? 0;
    const crack = tone === LINE_TONE.crack;
    const [r, g, b] = rgb(palette, 0);
    let weight = w, alpha = 235;
    if (tone === LINE_TONE.flat) { weight = w * 0.55; alpha = 120; }
    else if (tone === LINE_TONE.outline) weight = w * 1.25;
    else if (crack) weight = w * 1.7;
    if (faint) { weight = Math.max(0.3, weight * 0.55); alpha = 55; }
    surface.noFill(); surface.stroke(r, g, b, alpha); surface.strokeWeight(weight); surface.strokeCap(surface.ROUND);
    const dash = mode === "crease" && !faint ? tone === LINE_TONE.mountain ? [7 * w, 2.5 * w, 1.2 * w, 2.5 * w] : tone === LINE_TONE.valley ? [5 * w, 3 * w] : crack ? [1.5 * w, 2.5 * w] : null : null;
    if (dash) dashed(surface, path.points as readonly (readonly [number, number])[], dash);
    else { surface.beginShape(); for (const [x, y] of path.points) surface.vertex(x, y); surface.endShape(); }
  };
}

const EDGE_ON = 0.03;

/** A motif site: `angle` is the left rotation, `sigma` the two axis scales (negative: mirrored), `turn` the right rotation. */
interface MotifSite extends Site { readonly sigma: readonly [number, number]; readonly turn: number }

/** Draws a motif in a panel's affine frame: `m` maps (x right, y down) motif units to canvas units. */
function frameSite(panel: { id: string; seed: number }, position: PanelPoint, m: readonly [number, number, number, number], tone: number): MotifSite | null {
  // M = [[a, b], [c, d]] = R(phi) diag(s1, s2) R(theta)
  const [a, b, c, d] = m;
  const E = (a + d) / 2, F = (a - d) / 2, G = (c + b) / 2, H = (c - b) / 2;
  const Q = Math.hypot(E, H), R = Math.hypot(F, G), s1 = Q + R, s2 = Q - R;
  if (!(s1 > 0) || Math.abs(s2) < EDGE_ON * s1) return null;
  const a1 = Math.atan2(G, F), a2 = Math.atan2(H, E);
  return { id: panel.id, seed: panel.seed, position, angle: (a2 + a1) / 2, scale: 1, tone, sigma: [s1, s2], turn: (a2 - a1) / 2 };
}

function drawMotifs(surface: CompositionSurface, recipe: HingedPanelsComposition, consumers: HingedConsumers, sites: readonly MotifSite[], run: CompositionRun): void {
  const m = recipe.motif;
  const spec: MotifSpec = { kind: m.kind as MotifSpec["kind"], size: m.size, petals: 6, opening: 0.35, weight: m.weight, rotation: m.turn, variation: m.variation, retention: 1 };
  atEach(surface, sites, (s, site, r) => {
    const [s1, s2] = site.sigma;
    s.scale(s1, s2);
    s.rotate(site.turn);
    // keep the stroke near `weight` canvas units whatever the foreshortening
    const local = { ...spec, weight: m.weight / ((Math.abs(s1) + Math.abs(s2)) / 2) };
    (consumers.mark ?? motif(local, recipe.palette))(s, site, r);
  }, run);
}

/** Cyrus-Beck clip of a segment to a convex screen triangle (either winding). */
function clipToTriangle(t: Float64Array, x1: number, y1: number, x2: number, y2: number, out: number[]): boolean {
  const area = (t[2] - t[0]) * (t[5] - t[1]) - (t[3] - t[1]) * (t[4] - t[0]), sign = area >= 0 ? 1 : -1;
  let lo = 0, hi = 1;
  const dx = x2 - x1, dy = y2 - y1;
  for (let e = 0; e < 3; e++) {
    const ax = t[e * 2], ay = t[e * 2 + 1], bx = t[((e + 1) % 3) * 2], by = t[((e + 1) % 3) * 2 + 1];
    // inside is on the left of a->b for a counter-clockwise (area > 0) triangle
    const ex = bx - ax, ey = by - ay, f0 = sign * (ex * (y1 - ay) - ey * (x1 - ax)), df = sign * (ex * dy - ey * dx);
    if (df === 0) { if (f0 < 0) return false; continue; }
    const s = -f0 / df;
    if (df > 0) lo = Math.max(lo, s); else hi = Math.min(hi, s);
    if (lo >= hi) return false;
  }
  out[0] = x1 + dx * lo; out[1] = y1 + dy * lo; out[2] = x1 + dx * hi; out[3] = y1 + dy * hi;
  return true;
}

/** Flat hatch segments of a panel (panel edge units), on its gap-shrunk outline; lines are anchored to the sheet origin. */
function panelHatch(panel: PanelTiling["panels"][number], gap: number, angle: number, spacing: number): [number, number, number, number][] {
  const [cx, cy] = panel.centroid;
  const outline = panel.corners.map(([x, y]) => [cx + (x - cx) * (1 - gap), cy + (y - cy) * (1 - gap)] as const);
  return hatchPolygon(outline, angle, spacing, "Hatch spacing");
}

// ---- view stage --------------------------------------------------------------------------------

export interface HingedView {
  readonly camera: Camera;
  readonly order: PaintOrder;
}

const orderCache = new Map<string, PaintOrder>(), lineCache = new Map<string, HiddenLineResult>(), visibleCache = new Map<string, Uint8Array>();

function tooBig(what: string, advice: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return /maxWork|budget/.test(message) ? new Error(`${what} is too large for this view (${message}). ${advice}`) : (error as Error);
}

/** Painter order for the posed mesh under a camera (cached by mesh and camera). */
export function hingedView(recipe: HingedPanelsComposition, posed: PosedPanels): HingedView {
  const view = hingedCamera(recipe, posed);
  const order = memoized(orderCache, `${posed.mesh.key}|${view.key}`, () => {
    try { return paintOrder(posed.mesh, view, { cull: "none" }); }
    catch (error) { throw tooBig("The painter's order", "Reduce Columns and Rows, Substitution depth or Thickness", error); }
  });
  return { camera: view, order };
}

function hingedLines(recipe: HingedPanelsComposition, posed: PosedPanels, view: Camera): HiddenLineResult | null {
  const { mode, open } = recipe.lines;
  if (mode === "none" && !open) return null;
  const curves = hingedCurves(posed.folded, mode, open);
  if (curves.length === 0) return null;
  return memoized(lineCache, `${posed.mesh.key}|${view.key}|${mode}|${open}`, () => {
    try { return hiddenLines(posed.mesh, curves, view, { seed: recipe.seed }); }
    catch (error) { throw tooBig("The hidden-line solve", "Reduce Columns and Rows, Substitution depth or Thickness, or set Lines to None", error); }
  });
}

function panelCentres(posed: PosedPanels): { cloud: PointCloud; centres: readonly Vec3[] } {
  const { folded } = posed, { panels } = folded.tiling, positions: number[] = [], normals: number[] = [], centres: Vec3[] = [];
  for (const p of panels) {
    const c = panelPoint(folded, p.index, p.centroid[0], p.centroid[1]);
    centres.push(c);
    positions.push(...c); normals.push(...panelNormal(folded, p.index));
  }
  return { cloud: pointCloud({ id: "panel-centres", positions, normals }), centres };
}

// ---- drawing -----------------------------------------------------------------------------------

function fillColor(recipe: HingedPanelsComposition, tone: number, shadeFactor: number, role: "front" | "under" | "side"): [number, number, number] {
  let [r, g, b] = rgb(recipe.palette, tone);
  if (role === "under") { r = r * 0.42 + PAPER[0] * 0.58; g = g * 0.42 + PAPER[1] * 0.58; b = b * 0.42 + PAPER[2] * 0.58; }
  else if (role === "side") { r *= 0.78; g *= 0.78; b *= 0.78; }
  const f = shadeFactor;
  const lit = (v: number) => Math.max(0, Math.min(255, f <= 1 ? v * f : v + (255 - v) * Math.min(1, (f - 1) * 0.6)));
  return [lit(r), lit(g), lit(b)];
}

function drawFolded(surface: CompositionSurface, recipe: HingedPanelsComposition, products: HingedProducts, consumers: HingedConsumers, run: CompositionRun): void {
  const posed = hingedPosed(recipe, products), { mesh } = posed, view = hingedView(recipe, posed), cam = view.camera;
  const store = meshStorage(mesh), derived = meshDerived(mesh), { fill, hatch, palette } = recipe;
  const tones = panelTones(products.folded, fill.colorBy, palette.length, recipe.seed);
  const az = fill.lightAzimuth * radians, el = fill.lightElevation * radians;
  // world light: azimuth about +y from +z toward +x
  const light: Vec3 = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const { order } = view.order, pos = store.positions, tri = store.triangles;
  const hatchCache = new Map<number, [number, number, number, number][]>();
  const screen = new Float64Array(6), clipped = [0, 0, 0, 0];
  const [hr, hg, hb] = rgb(palette, 0);
  const painted = fill.mode !== "none" && fill.opacity > 0, alpha = 255 * fill.opacity;
  if (painted || hatch.on) {
    run.enter(order.length);
    try {
      for (let k = 0; k < order.length; k++) {
        if ((k & 255) === 0) run.check();
        const t = order[k];
        let visible = true;
        for (let c = 0; c < 3 && visible; c++) {
          const v = tri[t * 3 + c], p = cam.project([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]);
          if (!p) visible = false; else { screen[c * 2] = p.x; screen[c * 2 + 1] = p.y; }
        }
        if (!visible) continue;
        const face = store.triangleFace[t], panel = posed.panelOfFace[face], role = posed.roleOfFace[face];
        const nx = derived.triangleNormals[t * 3], ny = derived.triangleNormals[t * 3 + 1], nz = derived.triangleNormals[t * 3 + 2];
        // facing the eye: n . (eye - centre) at the triangle's first corner (constant for orthographic views)
        const v0 = tri[t * 3];
        const toEye = cam.viewDirection([pos[v0 * 3], pos[v0 * 3 + 1], pos[v0 * 3 + 2]]);
        const facing = nx * toEye[0] + ny * toEye[1] + nz * toEye[2];
        const sign = facing >= 0 ? 1 : -1;
        if (painted) {
          const lambert = Math.max(0, sign * (nx * light[0] + ny * light[1] + nz * light[2]));
          const factor = fill.mode === "shaded" ? (1 - fill.shade) + fill.shade * (0.3 + 0.95 * lambert) : 1;
          const kind = role === 2 ? "side" : role === 1 || facing < 0 ? "under" : "front";
          const [r, g, b] = fillColor(recipe, tones[panel], factor, kind);
          surface.fill(r, g, b, alpha);
          if (fill.opacity >= 0.98) { surface.stroke(r, g, b, alpha); surface.strokeWeight(0.6); } else surface.noStroke();
          surface.beginShape();
          for (let c = 0; c < 3; c++) surface.vertex(screen[c * 2], screen[c * 2 + 1]);
          surface.endShape(surface.CLOSE);
        }
        if (hatch.on && role === 0 && facing > 0) {
          let segments = hatchCache.get(panel);
          if (!segments) {
            segments = panelHatch(products.tiling.panels[panel], recipe.body.gap, hatch.angle, hatch.spacing);
            hatchCache.set(panel, segments);
          }
          surface.noFill(); surface.stroke(hr, hg, hb, 150); surface.strokeWeight(hatch.weight); surface.strokeCap(surface.ROUND);
          for (const [u1, v1, u2, v2] of segments) {
            const a = cam.project(panelPoint(products.folded, panel, u1, v1)), b = cam.project(panelPoint(products.folded, panel, u2, v2));
            if (a && b && clipToTriangle(screen, a.x, a.y, b.x, b.y, clipped)) surface.line(clipped[0], clipped[1], clipped[2], clipped[3]);
          }
        }
      }
    } finally { run.leave(); }
  }
  // hinge lines, cracks and outline through the exact hidden-line solver
  const lines = hingedLines(recipe, posed, cam);
  if (lines) {
    const runs = lines.paths.filter((p) => p.visible), hidden = recipe.lines.hidden === "faint" ? lines.paths.filter((p) => !p.visible) : [];
    if (hidden.length) strokeWith(surface, hidden as readonly Path[], consumers.line ?? lineMaterial(recipe, "folded", true), run);
    strokeWith(surface, runs as readonly Path[], consumers.line ?? lineMaterial(recipe, "folded", false), run);
  }
  if (recipe.motif.kind !== "none" && recipe.motif.size > 0) {
    const { cloud, centres } = panelCentres(posed);
    const seen = memoized(visibleCache, `${mesh.key}|${cam.key}`, () => visiblePoints(mesh, cloud, cam));
    const sites: MotifSite[] = [];
    const h = 0.01, contrast = palette.length > 2;
    for (const p of products.tiling.panels) {
      if (!seen[p.index]) continue;
      const c = centres[p.index], f = products.folded;
      const o = cam.project(c), pu = cam.project(panelPoint(f, p.index, p.centroid[0] + h, p.centroid[1])), pv = cam.project(panelPoint(f, p.index, p.centroid[0], p.centroid[1] + h));
      if (!o || !pu || !pv) continue;
      const tone = fill.mode === "none" || !contrast ? 0 : 1 + tones[p.index] % (palette.length - 1);
      const site = frameSite(p, [o.x, o.y], [(pu.x - o.x) / h, -(pv.x - o.x) / h, (pu.y - o.y) / h, -(pv.y - o.y) / h], tone);
      if (site) sites.push(site);
    }
    drawMotifs(surface, recipe, consumers, sites, run);
  }
}

/** The flat crease pattern: the same panels, fold signs and closure report, drawn as a plane figure. */
function drawCrease(surface: CompositionSurface, recipe: HingedPanelsComposition, products: HingedProducts, consumers: HingedConsumers, run: CompositionRun): void {
  const { tiling, folded } = products, { fill, hatch, palette, placement, body } = recipe;
  const b = tiling.bounds, s = placement.size / tiling.diameter, u0 = (b.minU + b.maxU) / 2, v0 = (b.minV + b.maxV) / 2;
  const at = (u: number, v: number): [number, number] => [s * (u - u0), -s * (v - v0)];
  const tones = panelTones(folded, fill.colorBy, palette.length, recipe.seed);
  surface.translate(placement.centerX, placement.centerY);
  surface.rotate(placement.roll * radians);
  const painted = fill.mode !== "none" && fill.opacity > 0;
  const [hr, hg, hb] = rgb(palette, 0);
  if (painted || hatch.on) {
    run.enter(tiling.panels.length);
    try {
      for (const panel of tiling.panels) {
        run.check();
        const [cx, cy] = panel.centroid;
        const outline = panel.corners.map(([x, y]) => at(cx + (x - cx) * (1 - body.gap), cy + (y - cy) * (1 - body.gap)));
        if (painted) {
          const [r, g, bl] = fillColor(recipe, tones[panel.index], 1, "front");
          surface.fill(r, g, bl, 255 * fill.opacity);
          if (fill.opacity >= 0.98) { surface.stroke(r, g, bl, 255); surface.strokeWeight(0.6); } else surface.noStroke();
          surface.beginShape();
          for (const [x, y] of outline) surface.vertex(x, y);
          surface.endShape(surface.CLOSE);
        }
        if (hatch.on) {
          surface.noFill(); surface.stroke(hr, hg, hb, 150); surface.strokeWeight(hatch.weight); surface.strokeCap(surface.ROUND);
          for (const [u1, v1, u2, v2] of panelHatch(panel, body.gap, hatch.angle, hatch.spacing)) { const [x1, y1] = at(u1, v1), [x2, y2] = at(u2, v2); surface.line(x1, y1, x2, y2); }
        }
      }
    } finally { run.leave(); }
  }
  // crease lines from the flat geometry: requested sign for every hinge, cracks where the closure failed
  const { mode, open } = recipe.lines, paths: Path[] = [];
  const push = (id: string, tone: number, p: PanelPoint, q: PanelPoint): void => {
    paths.push({ id, seed: componentSeed(recipe.seed, id, "path"), points: [at(p[0], p[1]), at(q[0], q[1])], closed: false, level: 0, levelFraction: 0, tone });
  };
  for (const hinge of tiling.hinges) {
    const report = folded.report[hinge.index];
    const requested = report.requested, sign = Math.abs(requested) < 1e-6 ? LINE_TONE.flat : requested > 0 ? LINE_TONE.mountain : LINE_TONE.valley;
    if (report.kind === "open" && open) push(hinge.id, LINE_TONE.crack, hinge.a, hinge.b);
    else if (mode !== "none" && (mode !== "folds" || sign !== LINE_TONE.flat)) push(hinge.id, sign, hinge.a, hinge.b);
  }
  if (mode === "panels") for (const [k, piece] of panelBoundaryEdges(tiling).entries()) push(`outline:${k}`, LINE_TONE.outline, piece.a, piece.b);
  if (paths.length) strokeWith(surface, paths, consumers.line ?? lineMaterial(recipe, "crease", false), run);
  if (recipe.motif.kind !== "none" && recipe.motif.size > 0) {
    const contrast = palette.length > 2, sites: MotifSite[] = [];
    for (const p of tiling.panels) {
      const [x, y] = at(p.centroid[0], p.centroid[1]);
      const tone = fill.mode === "none" || !contrast ? 0 : 1 + tones[p.index] % (palette.length - 1);
      const site = frameSite(p, [x, y], [s, 0, 0, s], tone);
      if (site) sites.push(site);
    }
    drawMotifs(surface, recipe, consumers, sites, run);
  }
}

/** Draw already-built producer values into a caller-owned surface; transparent layer, no clearing. */
export function drawHingedProducts(surface: CompositionSurface, recipe: HingedPanelsComposition, products: HingedProducts, consumers: HingedConsumers, run: CompositionRun): void {
  surface.push();
  try {
    if (recipe.treatment === "crease") drawCrease(surface, recipe, products, consumers, run);
    else drawFolded(surface, recipe, products, consumers, run);
  } finally { surface.pop(); }
}

export function drawHingedPanels(surface: CompositionSurface, recipe: HingedPanelsComposition, consumers: HingedConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  drawHingedProducts(surface, recipe, hingedProducts(recipe), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the stages one by one, yielding between them; false if cancelled. */
export async function prepareHingedPanels(recipe: HingedPanelsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  panelTiling(recipe.tiling);
  await yieldToHost();
  if (cancelled()) return false;
  const products = hingedProducts(recipe);
  if (recipe.treatment === "crease") return !cancelled();
  await yieldToHost();
  if (cancelled()) return false;
  const posed = hingedPosed(recipe, products);
  await yieldToHost();
  if (cancelled()) return false;
  hingedView(recipe, posed);
  return !cancelled();
}

