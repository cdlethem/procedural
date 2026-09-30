import { surfaceWeaveDefinition } from "../adapters/surface-weave-instrument.js";
import { parseExceptions } from "../adapters/crossing-lace-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { drawNumber } from "./crossing-lace.js";
import { createCompositionRun, strokeWith } from "./core.js";
import type { OverRule } from "./crossing-order.js";
import { color } from "./materials.js";
import { meshStorage, type Mesh } from "./mesh.js";
import { HAIRLINE_WIDTH, weaveModel, weavePieces, type WeaveModel, type WeavePiece, type WeavePieces } from "./surface-weave-pieces.js";
import { surfaceWeaveOrder, surfaceWeaveStrands, weaveMesh, type SurfaceWeaveOrder, type SurfaceWeaveProducts, type SurfaceWeaveStructure, type WeaveSurface } from "./surface-weave-products.js";
import { projectWeave, weaveCamera, type ProjectedWeave, type WeaveViewOptions } from "./surface-weave-view.js";
import type { CompositionRun, CompositionSurface, PathMaterial } from "./types.js";

/**
 * Surface Weave as a typed, JSON-compatible composition: a surface, two thread families traced on it, their crossings and
 * order, and a camera stage with visibility, each a public function.
 *
 *   weaveMesh → flowVectors, spacingField → traceStrands (A, B) → surfaceCrossings → orderCrossings      (camera free)
 *   → weaveCamera → projectWeave (hidden lines, canvas crossings) → weavePieces (cut under strands) → material / model / overlay
 *
 * `surfaceWeaveProducts` returns the camera-free producer value; `surfaceWeaveView` returns the three camera-dependent stage values.
 * Each stage is cached by its own inputs: the palette, colours, shading and outline colour recompute nothing; thread width,
 * clearance and cross-section recompute the pieces only; the camera recomputes projection, visibility, pieces and the model's
 * edges and never the mesh, strands, crossings or order; structure (surface, flow, spacing, edge) and the seed rebuild everything. Rule, Invert and
 * Exceptions change the order and what follows it. The seed reaches the terrain and sheet waves, seeded scalar fields, the seed
 * positions of the threads, fringes and the seeded rule, so it is always structural.
 *
 * Only bundled surfaces are named in the instrument (validated selects). A caller's own `Mesh` goes to
 * `surfaceWeaveProducts(recipe, mesh)` / `drawSurfaceWeave(surface, recipe, consumers, run, mesh)`; binding a user's model or scan to a Studio
 * layer is future host work. `drawSurfaceWeave` takes `{ strand }` to replace the built-in thread material with an ordinary
 * callback that receives the same frozen `WeavePiece`s. Painting is 2D only: no WEBGL, and nothing here claims scan reconstruction or fabrication.
 */
type Scalar = number | string | boolean;
const definition = surfaceWeaveDefinition;

export interface SurfaceWeaveComposition {
  kind: "surface-weave";
  seed: number;
  palette: readonly number[];
  structure: SurfaceWeaveStructure;
  order: SurfaceWeaveOrder;
  view: WeaveViewOptions;
  strands: {
    style: "cased" | "solid" | "hairline"; section: "round" | "flat"; width: number; casing: number; clearance: number; minAngle: number;
    shade: "none" | "facing" | "depth"; shadeAmount: number; hidden: "remove" | "faint"; coloring: "families" | "strands"; colors: readonly [number, number]; ink: number;
  };
  model: { draw: "none" | "outline" | "veil"; outlineWeight: number; veilOpacity: number; veilColor: number };
  overlay: "none" | "numbers" | "breaks";
}
/** Replace the built-in thread drawing with an ordinary callback over the cached visible fragments. */
export interface WeaveConsumers { strand?: PathMaterial }

function surfaceOf(q: Record<string, Scalar>): WeaveSurface {
  const detail = q.detail as number;
  switch (q.surface) {
    case "terrain": return { kind: "terrain", variant: q.terrain as "hills", detail, relief: q.relief as number };
    case "vase": return { kind: "vase", profile: q.vase as "amphora", detail };
    case "torus": return { kind: "torus", tube: q.tube as number, detail };
    case "sphere": return { kind: "sphere", cap: q.cap as number, detail };
    case "sheet": return { kind: "sheet", shape: q.sheet as "twist", detail, relief: q.relief as number };
    default: throw new Error(`Unknown surface: ${String(q.surface)}`);
  }
}

/** Resolve stored scalar controls to the public composition value. */
export function surfaceWeaveComposition(input: InstrumentInput): SurfaceWeaveComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>, num = (key: string) => q[key] as number;
  return {
    kind: "surface-weave", seed: input.seed, palette: [...input.palette],
    structure: {
      surface: surfaceOf(q),
      flow: { field: q.flow as "height", bandAngle: num("flowAngle"), frequency: num("flowFrequency"), yaw: num("guideYaw"), pitch: num("guidePitch") },
      angle: num("angle"), cross: num("cross"), swirl: { amount: num("swirl"), field: q.swirlField as "height" },
      threads: { spacing: num("spacing"), spacingB: num("spacingB"), density: { field: q.density as "none", ratio: num("ratio"), reverse: q.reverse as boolean } },
      edge: { mode: q.edge as "flush", margin: num("margin") },
    },
    order: { rule: q.rule as OverRule, invert: q.invert as boolean, exceptions: parseExceptions(q.exceptions as string) },
    view: { projection: q.projection as "perspective", yaw: num("yaw"), pitch: num("pitch"), roll: num("roll"), distance: num("distance"), centerX: num("centerX"), centerY: num("centerY"), size: num("size") },
    strands: {
      style: q.style as "cased", section: q.section as "round", width: num("width"), casing: num("casing"), clearance: num("clearance"), minAngle: num("minAngle"),
      shade: q.shade as "none", shadeAmount: num("shadeAmount"), hidden: q.hidden as "remove", coloring: q.coloring as "families", colors: [num("colorA"), num("colorB")], ink: num("inkColor"),
    },
    model: { draw: q.model as "none", outlineWeight: num("outlineWeight"), veilOpacity: num("veilOpacity"), veilColor: num("veilColor") },
    overlay: q.overlay as "none",
  };
}

/** The seed is structural in every configuration: it positions the threads. */
export const surfaceWeaveUsesSeed = (_q: Record<string, Scalar>): boolean => true;

/** The camera-free producers for a recipe (or for `mesh`, a resolved caller-owned surface). */
export function surfaceWeaveProducts(recipe: SurfaceWeaveComposition, mesh?: Mesh): SurfaceWeaveProducts {
  return surfaceWeaveOrder(surfaceWeaveStrands(recipe.structure, recipe.seed, mesh), recipe.order, recipe.seed);
}

export interface SurfaceWeaveView { readonly projected: ProjectedWeave; readonly pieces: WeavePieces; readonly model: WeaveModel }

/** The camera-dependent stage values for a recipe's view and drawing widths. */
export function surfaceWeaveView(recipe: SurfaceWeaveComposition, products: SurfaceWeaveProducts): SurfaceWeaveView {
  const camera = weaveCamera(products.mesh, recipe.view), projected = projectWeave(products, camera), { strands } = recipe;
  const hairline = strands.style === "hairline";
  const pieces = weavePieces(products, projected, {
    share: strands.width, hairline, clearance: strands.clearance, minAngle: strands.minAngle, flat: !hairline && strands.section === "flat", faint: strands.hidden === "faint",
  });
  return { projected, pieces, model: weaveModel(products.mesh, camera, recipe.model.draw === "veil") };
}

function threadColor(recipe: SurfaceWeaveComposition, piece: WeavePiece): number {
  return recipe.strands.coloring === "families" ? recipe.strands.colors[piece.family] : 1 + piece.source % Math.max(1, recipe.palette.length - 1);
}

/** Alpha (0..255) of a fragment from the shading rule. */
function threadAlpha(recipe: SurfaceWeaveComposition, projected: ProjectedWeave, piece: WeavePiece): number {
  const { shade, shadeAmount } = recipe.strands;
  if (shade === "none") return 235;
  const [near, far] = projected.depthRange, strength = shade === "facing" ? piece.facing : far > near ? (far - piece.depth) / (far - near) : 1;
  return Math.round(235 * (1 - shadeAmount * (1 - Math.min(1, Math.max(0, strength)))));
}

function strandMaterial(recipe: SurfaceWeaveComposition, projected: ProjectedWeave, passes: "casing" | "core" | "all"): PathMaterial {
  const { palette } = recipe, { style, section, casing, ink } = recipe.strands;
  return (surface, path) => {
    const piece = path as WeavePiece, alpha = threadAlpha(recipe, projected, piece), lateral = piece.lateral;
    if (piece.points.length < 2) return;
    if (style !== "hairline" && section === "flat" && lateral) {
      const n = piece.points.length;
      surface.beginShape();
      for (let k = 0; k < n; k++) surface.vertex(piece.points[k][0] + lateral[k * 2], piece.points[k][1] + lateral[k * 2 + 1]);
      for (let k = n - 1; k >= 0; k--) surface.vertex(piece.points[k][0] - lateral[k * 2], piece.points[k][1] - lateral[k * 2 + 1]);
      color(surface, palette, threadColor(recipe, piece), alpha, true);
      if (style === "cased" && casing > 0) { color(surface, palette, ink, alpha, false); surface.strokeWeight(casing); } else surface.noStroke();
      surface.endShape(surface.CLOSE);
      return;
    }
    surface.noFill(); surface.strokeCap(surface.ROUND);
    const draw = (weight: number): void => {
      surface.strokeWeight(weight);
      surface.beginShape(); for (const [x, y] of piece.points) surface.vertex(x, y);
      surface.endShape(piece.closed ? surface.CLOSE : undefined);
    };
    if (style === "hairline") { color(surface, palette, threadColor(recipe, piece), alpha, false); draw(HAIRLINE_WIDTH); return; }
    if (style === "solid") { color(surface, palette, threadColor(recipe, piece), alpha, false); draw(piece.width); return; }
    if (passes !== "core") { color(surface, palette, ink, alpha, false); draw(piece.width); }
    if (passes !== "casing" && piece.width - 2 * casing > 0.2) { color(surface, palette, threadColor(recipe, piece), alpha, false); draw(piece.width - 2 * casing); }
  };
}

/** Draw already-built stage values; the recipe's `strands`, `model` and `overlay` choose the built-in consumers. */
export function drawSurfaceWeaveProducts(surface: CompositionSurface, recipe: SurfaceWeaveComposition, products: SurfaceWeaveProducts,
  stages: SurfaceWeaveView, consumers: WeaveConsumers, run: CompositionRun): void {
  const { projected, pieces, model } = stages, { palette } = recipe, { style, section, ink } = recipe.strands;
  surface.push();
  try {
    if (model.veil) {
      const { order, x, y, facing } = model.veil;
      const rgb = palette[recipe.model.veilColor % palette.length] >>> 0, alpha = Math.round(255 * recipe.model.veilOpacity);
      run.enter(order.length);
      try {
        const corners = meshStorage(products.mesh).triangles;
        surface.strokeWeight(0.7); surface.strokeCap(surface.ROUND);
        for (const t of order) {
          const a = corners[t * 3], b = corners[t * 3 + 1], c = corners[t * 3 + 2];
          if (Number.isNaN(x[a]) || Number.isNaN(x[b]) || Number.isNaN(x[c])) continue;
          const shade = 0.72 + 0.28 * facing[t], r = ((rgb >>> 16) & 255) * shade, g = ((rgb >>> 8) & 255) * shade, bl = (rgb & 255) * shade;
          surface.fill(r, g, bl, alpha); surface.stroke(r, g, bl, alpha);
          surface.beginShape(); surface.vertex(x[a], y[a]); surface.vertex(x[b], y[b]); surface.vertex(x[c], y[c]); surface.endShape(surface.CLOSE);
        }
      } finally { run.leave(); }
    }
    if (pieces.hidden.length) {
      strokeWith(surface, pieces.hidden, (p, path) => {
        p.noFill(); color(p, palette, ink, 70, false); p.strokeWeight(0.9); p.strokeCap(p.ROUND);
        p.beginShape(); for (const [px, py] of path.points) p.vertex(px, py); p.endShape(path.closed ? p.CLOSE : undefined);
      }, run);
    }
    if (consumers.strand) strokeWith(surface, pieces.visible, consumers.strand, run);
    else if (style === "cased" && section === "round") {
      strokeWith(surface, pieces.visible, strandMaterial(recipe, projected, "casing"), run);
      strokeWith(surface, pieces.visible, strandMaterial(recipe, projected, "core"), run);
    } else strokeWith(surface, pieces.visible, strandMaterial(recipe, projected, "all"), run);
    if (model.outline.length) {
      strokeWith(surface, model.outline, (p, path) => {
        p.noFill(); color(p, palette, ink, 230, false); p.strokeWeight(recipe.model.outlineWeight); p.strokeCap(p.ROUND);
        p.beginShape(); for (const [px, py] of path.points) p.vertex(px, py); p.endShape(path.closed ? p.CLOSE : undefined);
      }, run);
    }
    if (recipe.overlay !== "none") drawOverlay(surface, recipe, products, stages, run);
  } finally { surface.pop(); }
}

/** Reading aids on top of the weave; nothing here changes a producer value. */
function drawOverlay(surface: CompositionSurface, recipe: SurfaceWeaveComposition, products: SurfaceWeaveProducts, stages: SurfaceWeaveView, run: CompositionRun): void {
  const { palette } = recipe, { projected, pieces } = stages, table = projected.set.crossings;
  const widest = Math.max(1, ...pieces.widths), visible = (index: number): boolean => projected.visibleCrossing[index] === 1;
  surface.noFill(); surface.strokeCap(surface.ROUND);
  if (recipe.overlay === "numbers") {
    run.enter(2 * table.length);
    try {
      for (const [weight, halo] of [[4.5, true], [1.5, false]] as const) {
        if (halo) surface.stroke(255, 255, 255, 235); else color(surface, palette, recipe.strands.ink, 255, false);
        surface.strokeWeight(weight);
        for (const crossing of table) if (visible(crossing.index)) drawNumber(surface, crossing.index + 1, crossing.point[0] + widest * 0.55 + 3, crossing.point[1] - widest * 0.55 - 14, 12);
      }
    } finally { run.leave(); }
  } else {
    const byId = new Map(table.map((crossing) => [crossing.id, crossing])), order = products.order;
    const items = [...order.breaks.map((item) => ({ ...item, cause: item.cause as string })), ...products.seams.map((item) => ({ ...item, cause: "seam" }))];
    run.enter(items.length * 2);
    try {
      surface.strokeWeight(2.2);
      for (const item of items) {
        color(surface, palette, item.cause === "exception" ? 2 : 1, 255, false);
        for (const id of [item.before, item.after]) { const crossing = byId.get(id)!; if (visible(crossing.index)) surface.circle(crossing.point[0], crossing.point[1], widest * 2 + 6); }
      }
    } finally { run.leave(); }
  }
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawSurfaceWeave(surface: CompositionSurface, recipe: SurfaceWeaveComposition, consumers: WeaveConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 800_000 }), mesh?: Mesh): void {
  run.check();
  const products = surfaceWeaveProducts(recipe, mesh);
  drawSurfaceWeaveProducts(surface, recipe, products, surfaceWeaveView(recipe, products), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the stages one at a time, yielding between them; false if cancelled. */
export async function prepareSurfaceWeave(recipe: SurfaceWeaveComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  weaveMesh(recipe.structure.surface, recipe.seed);
  await yieldToHost();
  if (cancelled()) return false;
  const built = surfaceWeaveStrands(recipe.structure, recipe.seed);
  await yieldToHost();
  if (cancelled()) return false;
  const products = surfaceWeaveOrder(built, recipe.order, recipe.seed);
  surfaceWeaveView(recipe, products);
  return !cancelled();
}
