import { branchOrnamentDefinitions } from "../adapters/branch-ornament-instruments.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { motif, pathMaterial } from "./materials.js";
import { attachmentSites, branchOutline, branchTree, fitRoots, prepareBranchTree, visibleEdges } from "./branch-tree.js";
import type { AttachmentOptions, AttachmentRole, BranchTreeOptions, BranchVisibility, OutlineShape } from "./branch-tree.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec } from "./types.js";

/**
 * Branch Ornament as a typed, JSON-compatible composition: a producer (`tree`) and consumers
 * (edge material, outline layer, one mark per attachment role).
 *
 * - `tree` builds the frozen branch tree (`branch-tree.ts`). Nothing below it can regrow it.
 * - `visibility` picks which edges the edge and outline layers show (depth window plus stable
 *   per-edge retention). Ornaments are selected by their own attachment windows, so hiding a
 *   branch never hides what is attached to its nodes.
 * - `edges` strokes visible edges with a path material whose weight is multiplied by
 *   `falloff ** depth` (never thinner than the smaller of 0.25 and the material's weight).
 * - `outline` strokes `branchOutline` ribbons of the same visible edges.
 * - `ornaments` are drawn in array order, each one `attachmentSites(tree, attach)` through `motif`.
 *
 * The palette's colour by role is structural: edges and trunk marks index 0, fork marks 1,
 * terminal marks 2, flank marks 3 (wrapping), outline `shape.tone`.
 *
 * Substitution. `drawBranchOrnament(surface, recipe, consumers)` replaces any consumer with an
 * ordinary callback (`Mark`, `PathMaterial`) while the tree and its sites stay the same cached
 * objects; the same producers are public, so `atEach(surface, attachmentSites(tree, ...), mark)`
 * and `strokeWith(surface, tree.edges, material)` need no descriptor. Work is charged to the run
 * (`createCompositionRun` defaults) per site and per path before drawing.
 */
export interface BranchOrnamentComposition {
  kind: "branch-ornament";
  tree: BranchTreeOptions;
  visibility: BranchVisibility;
  edges: { material: PathMaterialSpec; falloff: number } | null;
  outline: { shape: OutlineShape; material: PathMaterialSpec } | null;
  ornaments: readonly { mark: MotifSpec; attach: AttachmentOptions }[];
  palette: readonly number[];
}
/** Replace any consumer of `drawBranchOrnament` with ordinary callbacks. */
export interface BranchConsumers {
  edge?: PathMaterial;
  outline?: PathMaterial;
  marks?: Partial<Record<AttachmentRole, Mark>>;
}

type Scalar = number | string | boolean;
const definition = branchOrnamentDefinitions[0];
const ROLES = ["flank", "fork", "trunk", "terminal"] as const;

function markSpec(q: Record<string, Scalar>, role: string): MotifSpec {
  return { kind: q[`${role}Mark`] as MotifSpec["kind"], size: q[`${role}Size`] as number, petals: q[`${role}Petals`] as number,
    opening: q[`${role}Opening`] as number, weight: q[`${role}Weight`] as number, rotation: 0,
    variation: q.variation as number, retention: q.ornamentRetention as number };
}
function materialSpec(kind: PathMaterialSpec["kind"], weight: number, q: Record<string, Scalar>): PathMaterialSpec {
  return { kind, weight, spacing: q.edgeSpacing as number, phase: q.edgePhase as number, phaseSpread: q.edgePhaseSpread as number,
    levelRamp: 0, retention: 1, mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } };
}

/** Resolve stored scalar controls to the public composition value. */
export function branchOrnamentComposition(input: InstrumentInput): BranchOrnamentComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params);
  const edgeKind = q.edgeMaterial as string;
  const ornaments: { mark: MotifSpec; attach: AttachmentOptions }[] = [];
  const common = { inherit: q.angleInheritance as number, falloff: q.sizeFalloff as number };
  const visibility = { minDepth: q.edgeMinDepth as number, maxDepth: q.edgeMaxDepth as number, retention: q.edgeRetention as number };
  for (const role of ROLES) {
    if (q[`${role}Mark`] === "none") continue;
    // The trunk node is always at depth 0; it has no depth window of its own.
    const attach: AttachmentOptions = { ...common, role, offset: q[`${role}Offset`] as number,
      minDepth: role === "trunk" ? 0 : q[`${role}MinDepth`] as number, maxDepth: role === "trunk" ? 0 : q[`${role}MaxDepth`] as number };
    if (q.marksFollowBranches) attach.visible = { ...visibility };
    if (role === "flank")
      attach.flank = { spacing: q.flankSpacing as number, angle: q.flankAngle as number, sides: q.flankSides as "alternate" | "paired" | "single" };
    ornaments.push({ mark: markSpec(q, role), attach });
  }
  const outlineWeight = q.outlineWeight as number, outlineWidth = q.outlineWidth as number;
  const roots = q.rootPlacement === "auto"
    ? fitRoots({ sourceMode: q.sourceMode as BranchTreeOptions["sourceMode"], extent: q.extent as number, aspect: q.aspect as number,
      direction: q.direction as number, centerX: q.centerX as number, centerY: q.centerY as number, lobeGap: q.lobeGap as number })
    : { rootCount: q.rootCount as number, rootSpread: q.rootSpread as number, rootJitter: q.rootJitter as number,
      rootX: q.rootX as number, rootY: q.rootY as number, rootHeading: q.rootHeading as number };
  return {
    kind: "branch-ornament", palette: [...input.palette],
    tree: { seed: input.seed, routing: q.routing as BranchTreeOptions["routing"],
      sourceCount: q.sourceCount as number, sourceMode: q.sourceMode as BranchTreeOptions["sourceMode"], extent: q.extent as number,
      aspect: q.aspect as number, direction: q.direction as number, centerX: q.centerX as number, centerY: q.centerY as number,
      disorder: q.disorder as number, exclusion: q.exclusion as number, band: q.band as number, lobeGap: q.lobeGap as number,
      lobeBias: q.lobeBias as number, ...roots,
      ticks: q.ticks as number, step: q.step as number, reach: q.reach as number, branches: q.branches as number,
      branchSpread: q.branchSpread as number },
    visibility,
    edges: edgeKind === "none" ? null : { material: materialSpec(edgeKind as "ink" | "stitch", q.edgeWeight as number, q), falloff: q.edgeFalloff as number },
    outline: outlineWidth > 0 && outlineWeight > 0
      ? { shape: { width: outlineWidth, falloff: q.outlineFalloff as number, taper: q.outlineTaper as number, tone: 3 },
        material: materialSpec("ink", outlineWeight, q) }
      : null,
    ornaments,
  };
}

/** Per-depth edge material: weight scales by `falloff ** depth`, floored so twigs stay visible. */
function depthMaterial(spec: PathMaterialSpec, falloff: number, palette: readonly number[]): PathMaterial {
  const byDepth = new Map<number, PathMaterial>();
  return (surface, path, run) => {
    let material = byDepth.get(path.level);
    if (!material) {
      const weight = Math.max(spec.weight * falloff ** path.level, Math.min(spec.weight, 0.25));
      material = pathMaterial({ ...spec, weight }, palette);
      byDepth.set(path.level, material);
    }
    material(surface, path, run);
  };
}

/** Draw the recipe into a caller-owned surface: outline, edges, then each role's marks in order. */
export function drawBranchOrnament(surface: CompositionSurface, recipe: BranchOrnamentComposition,
  consumers: BranchConsumers = {}, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const tree = branchTree(recipe.tree);
  if (recipe.outline) {
    const outlines = branchOutline(tree, { ...recipe.visibility, ...recipe.outline.shape });
    strokeWith(surface, outlines, consumers.outline ?? pathMaterial(recipe.outline.material, recipe.palette), run);
  }
  if (recipe.edges) {
    strokeWith(surface, visibleEdges(tree, recipe.visibility),
      consumers.edge ?? depthMaterial(recipe.edges.material, recipe.edges.falloff, recipe.palette), run);
  }
  for (const { mark, attach } of recipe.ornaments) {
    if (mark.retention === 0 || mark.size === 0) continue;
    atEach(surface, attachmentSites(tree, attach), consumers.marks?.[attach.role] ?? motif(mark, recipe.palette), run);
  }
}

/** Grow cooperatively (yielding between ticks), then warm the sites and outline; false if cancelled. */
export async function prepareBranchOrnament(recipe: BranchOrnamentComposition, cancelled: () => boolean): Promise<boolean> {
  if (!(await prepareBranchTree(recipe.tree, cancelled))) return false;
  const tree = branchTree(recipe.tree);
  if (recipe.outline) branchOutline(tree, { ...recipe.visibility, ...recipe.outline.shape });
  visibleEdges(tree, recipe.visibility);
  for (const { attach } of recipe.ornaments) attachmentSites(tree, attach);
  return !cancelled();
}
