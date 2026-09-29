import { atEach, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import {
  MAX_GRAPH_EDGES, branchGraph, connectedNodes, contactGraph, edgeFraction, edgeMarkers, edgePaths, graphRoute, latticeGraph, nearestNode, nodeFraction, nodeSites,
  planarFaces, selectGraph, withDirection,
} from "./graph.js";
import type { BranchGraphOptions, ContactGraphOptions, Graph, GraphAttribute, GraphEdge, GraphFace, GraphNode, GraphRoleOptions, GraphRoute,
  GraphView, LatticeGraphOptions, RouteMetric, RouteMode } from "./graph.js";
import { color, motif, pathMaterial } from "./materials.js";
import { memoized } from "./sources.js";
import type { CompositionRun, CompositionSurface, MotifSpec, Path, PathMaterial, PathMaterialSpec, Point } from "./types.js";

/** Which construction feeds the graph. Every member carries its own seed. */
export type GraphSourceOptions =
  | ({ kind: "contact" } & ContactGraphOptions)
  | ({ kind: "lattice" } & LatticeGraphOptions)
  | ({ kind: "branches" } & BranchGraphOptions);
/** Colour role of an edge: one colour, or the edge's weight or age split into three bands. */
export type EdgeTone = "flat" | "weight" | "age";
/** Graph-role recipe fields below the source: what is selected, which route is highlighted, how each role is drawn. */
export interface GraphRouteRecipe {
  readonly mode: "off" | RouteMode;
  readonly metric: RouteMetric;
  /** Canvas points; each picks the nearest node of the selected view. */
  readonly start: Point;
  readonly end: Point;
  readonly followDirection: boolean;
}
export interface FaceFillSpec {
  readonly tint: "flat" | "size" | "varied";
  /** Fill opacity, 0–1. */
  readonly opacity: number;
  /** Faces smaller/larger than this area (canvas units squared) are left open. */
  readonly minArea: number;
  readonly maxArea: number;
  /** Stable per-face omission. */
  readonly retention: number;
  /** Palette indices used by the tints, first one for `flat`. */
  readonly colors: readonly number[];
}
export interface GraphComposition {
  readonly source: GraphSourceOptions;
  readonly directed: boolean;
  readonly roles: GraphRoleOptions;
  readonly route: GraphRouteRecipe;
  /** The thin supporting network: one material for every selected edge, plus optional direction markers. */
  readonly support: { readonly material: PathMaterialSpec; readonly tone: EdgeTone; /** `retention` is the share of eligible edges that carry a marker (chosen by edge id). */ readonly arrow: MotifSpec };
  readonly nodes: { readonly mark: MotifSpec; readonly scaleBy: "none" | GraphAttribute; readonly amount: number };
  /** The bold focal route, drawn with its own material, and its endpoint marks. */
  readonly focal: { readonly material: PathMaterialSpec; readonly endpoints: MotifSpec };
  readonly faces: FaceFillSpec | null;
  readonly palette: readonly number[];
}

/** Palette indices by role: support ink, route accent, mid tint, light tint, deep band. Short palettes wrap. */
export const graphTones = { ink: 0, route: 1, mid: 2, high: 3, deep: 4 } as const;
/** Edge colour bands for the weight and age roles, lowest to highest. */
const edgeBands = [graphTones.ink, graphTones.mid, graphTones.deep] as const;

function sourceGraph(source: GraphSourceOptions): Graph {
  if (source.kind === "contact") return contactGraph(source);
  if (source.kind === "lattice") return latticeGraph(source);
  return branchGraph(source);
}
/** Edge colour by role: a caller-visible function so other consumers can substitute their own. */
export function edgeToneRole(role: EdgeTone): (edge: GraphEdge, graph: Graph) => number {
  if (role === "flat") return () => graphTones.ink;
  return (edge, graph) => edgeBands[Math.min(2, Math.floor(edgeFraction(edge, graph, role) * 3))];
}

/** The graph, its selected view, the highlighted route (null when off or absent) and the valid faces (empty when off). */
export interface GraphStructure { readonly graph: Graph; readonly view: GraphView; readonly route: GraphRoute | null; readonly faces: readonly GraphFace[] }
const views = new Map<string, { graph: Graph; view: GraphView }>();
const routes = new Map<string, GraphRoute | null>();
const edgeLayers = new Map<string, readonly Path[]>();
/** Selection depends on construction and roles only; a route or face edit never rebuilds it. */
function viewKey(recipe: GraphComposition): string {
  return JSON.stringify([recipe.source, recipe.directed, recipe.roles]);
}
function structure(recipe: GraphComposition): GraphStructure {
  const key = viewKey(recipe);
  const { graph, view } = memoized(views, key, () => {
    const directed = withDirection(sourceGraph(recipe.source), recipe.directed);
    return { graph: directed, view: selectGraph(directed, recipe.roles) };
  });
  const route = recipe.route.mode === "off" ? null : memoized(routes, JSON.stringify([key, recipe.route]), () => {
    // Endpoint rule: the start is the nearest selected node; the end is the nearest node connected to it, so
    // a route exists whenever the start's component has two nodes (direction may still forbid it).
    const from = nearestNode(view, recipe.route.start);
    const to = from ? nearestNode(view, recipe.route.end, connectedNodes(view, from.id)) : undefined;
    return from && to ? graphRoute(view, { from: from.id, to: to.id, mode: recipe.route.mode as RouteMode, metric: recipe.route.metric,
      followDirection: recipe.route.followDirection }) : null;
  });
  return Object.freeze({ graph, view, route, faces: recipe.faces ? planarFaces(view).faces : Object.freeze([]) });
}

/**
 * Fill each face polygon (a closed `Path` from `planarFaces`) in one palette colour, with no outline.
 * Retention is a stable per-face omission from the face id; `minArea`/`maxArea` leave faces open.
 * Tints: `flat` uses the first colour; `size` bands the face's log-area position (small first colour, large last) across the colours;
 * `varied` picks a colour from the face's id. Palette edits never move or omit a face.
 */
export function faceFill(spec: FaceFillSpec, palette: readonly number[]): PathMaterial {
  if (!Number.isFinite(spec.opacity) || spec.opacity < 0 || spec.opacity > 1) throw new Error("Face opacity must be in [0, 1]");
  if (!Number.isFinite(spec.retention) || spec.retention < 0 || spec.retention > 1) throw new Error("Face retention must be in [0, 1]");
  if (!Number.isFinite(spec.minArea) || spec.minArea < 0 || !(spec.maxArea >= spec.minArea)) throw new Error("Face area limits must satisfy 0 ≤ min ≤ max");
  if (spec.colors.length === 0) throw new Error("Face fill needs at least one colour index");
  return (surface, path) => {
    const face = path as Partial<GraphFace>;
    if (spec.opacity === 0 || spec.retention === 0 || path.points.length < 3) return;
    if (face.area !== undefined && (face.area < spec.minArea || face.area > spec.maxArea)) return;
    if (componentSeed(path.seed, path.id, "keep") / 0x1_0000_0000 >= spec.retention) return;
    const pick = spec.tint === "flat" ? 0 : spec.tint === "size"
      ? Math.min(spec.colors.length - 1, Math.floor(path.levelFraction * spec.colors.length))
      : componentSeed(path.seed, path.id, "tint") % spec.colors.length;
    surface.noStroke();
    color(surface, palette, spec.colors[pick], Math.round(spec.opacity * 255), true);
    surface.beginShape();
    for (const [x, y] of path.points) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  };
}

/** The mark drawn at both route endpoints. */
function endpointSites(structure: GraphStructure) {
  const route = structure.route;
  if (!route) return [];
  const ids = route.nodes.length === 1 ? [route.nodes[0]] : [route.nodes[0], route.nodes[route.nodes.length - 1]];
  const chosen = new Set(ids);
  return nodeSites({ ...structure.view, nodes: structure.view.nodes.filter((node) => chosen.has(node.id)) },
    { tone: () => graphTones.route });
}

/**
 * Draw the recipe: faces, the thin support network (and direction markers), nodes, the focal
 * route, then its endpoints. Each role is the ordinary consumer (`strokeWith`, `atEach`) applied
 * to a cached frozen value, so appearance edits recompute nothing.
 */
export function drawGraphComposition(surface: CompositionSurface, recipe: GraphComposition, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const shape = structure(recipe);
  const { view, route, faces } = shape;
  if (recipe.faces) strokeWith(surface, faces, faceFill(recipe.faces, recipe.palette), run);
  if (recipe.support.material.retention > 0) {
    const key = JSON.stringify([viewKey(recipe), recipe.support.tone]);
    strokeWith(surface, memoized(edgeLayers, key, () => edgePaths(view, edgeToneRole(recipe.support.tone))),
      pathMaterial(recipe.support.material, recipe.palette), run);
  }
  if (view.graph.directed && recipe.support.arrow.size > 0 && recipe.support.arrow.retention > 0)
    atEach(surface, edgeMarkers(view, recipe.support.arrow.size, edgeToneRole(recipe.support.tone), recipe.support.arrow.retention), motif({ ...recipe.support.arrow, retention: 1 }, recipe.palette), run);
  if (recipe.nodes.mark.size > 0 && recipe.nodes.mark.retention > 0) {
    const onRoute = new Set(route?.nodes ?? []);
    const scaleBy = recipe.nodes.scaleBy, amount = recipe.nodes.amount;
    if (!Number.isFinite(amount) || amount < 0 || amount > .95) throw new Error("Node scale amount must be in [0, 0.95]");
    atEach(surface, nodeSites(view, {
      scale: scaleBy === "none" ? undefined : (node: GraphNode, graph: Graph) => 1 - amount * (1 - nodeFraction(node, graph, scaleBy)),
      tone: (node) => onRoute.has(node.id) ? graphTones.route : graphTones.ink }), motif(recipe.nodes.mark, recipe.palette), run);
  }
  if (route && recipe.focal.material.retention > 0) strokeWith(surface, [route.path], pathMaterial(recipe.focal.material, recipe.palette), run);
  if (route && recipe.focal.endpoints.size > 0) atEach(surface, endpointSites(shape), motif(recipe.focal.endpoints, recipe.palette), run);
}

/** Build every cached value the recipe draws from, honouring cancellation between stages. */
export async function prepareGraphComposition(recipe: GraphComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  pathMaterial(recipe.support.material, recipe.palette); pathMaterial(recipe.focal.material, recipe.palette);
  if (recipe.faces) faceFill(recipe.faces, recipe.palette);
  motif(recipe.nodes.mark, recipe.palette);
  structure(recipe);
  return !cancelled();
}

/** The graph, selected view, route and faces of a recipe, exactly as drawn. Frozen and cached. */
export function graphStructure(recipe: GraphComposition): GraphStructure {
  return structure(recipe);
}

type Scalar = number | string | boolean;
/** Marks are single-colour by default: a ring or rosette opening would tint its inner part with the next palette colour, which here is a role colour. */
const mark = (kind: MotifSpec["kind"], size: number, weight: number, petals = 6, opening = 0): MotifSpec =>
  ({ kind, size, petals: kind === "arrow" ? 0 : petals, opening, weight, rotation: 0, variation: 0, retention: 1 });
const material = (kind: PathMaterialSpec["kind"], weight: number, spacing: number, retention: number, bead: MotifSpec): PathMaterialSpec =>
  ({ kind, weight, spacing, phase: .5, phaseSpread: 0, levelRamp: 0, retention, mark: bead });

/** Resolve the named scalar controls of the Graph Roles instrument to its public typed recipe. Only the chosen source's controls are read. */
export function graphRolesComposition(q: Record<string, Scalar>, seed: number, palette: readonly number[]): GraphComposition {
  const num = (key: string) => q[key] as number;
  const common = { seed, centerX: num("centerX"), centerY: num("centerY"), width: num("width"), height: num("height"), rotation: num("rotation") };
  let source: GraphSourceOptions;
  if (q.source === "contact") {
    source = { kind: "contact", ...common, count: num("agents"), startShape: q.startShape as ContactGraphOptions["startShape"],
      disorder: num("disorder"), ticks: num("ticks"), radius: num("radius"), force: num("force"), avoidance: .22, speed: num("speed"), damping: num("damping") };
  } else if (q.source === "lattice") {
    source = { kind: "lattice", ...common, columns: num("columns"), rows: num("rows"), region: q.region as LatticeGraphOptions["region"],
      innerRadius: num("innerRadius"), blocked: num("blocked"), braid: num("braid"), diagonals: num("diagonals"), wobble: num("wobble"),
      rootX: num("rootX"), rootY: num("rootY") };
  } else {
    // The trunk is sized so an unbranched line of generations spans the footprint height.
    const contraction = num("contraction");
    let span = 0;
    for (let generation = 0; generation <= num("generations"); generation++) span += contraction ** generation;
    source = { kind: "branches", ...common, roots: num("roots"), generations: num("generations"), children: Number(q.children) as 2 | 3,
      angle: num("branchAngle"), angleSpread: num("angleSpread"), contraction, survival: num("survival"), rootLength: num("height") / span };
  }
  const directed = q.direction === "source";
  const edgeBead = mark(q.edgeBead as MotifSpec["kind"], num("edgeBeadSize"), 1);
  const routeBead = mark(q.routeBead as MotifSpec["kind"], num("routeBeadSize"), 1.4);
  return { source, directed, palette,
    roles: { minDegree: num("minDegree"), maxDegree: num("maxDegree") === 0 ? MAX_GRAPH_EDGES : num("maxDegree"), minWeight: num("minWeight"), maxWeight: num("maxWeight"),
      minAge: num("minAge"), maxAge: num("maxAge"), isolated: q.isolated as boolean },
    route: { mode: q.route as GraphRouteRecipe["mode"], metric: q.metric as RouteMetric, start: [num("startX"), num("startY")],
      end: [num("endX"), num("endY")], followDirection: directed && (q.followDirection as boolean) },
    support: { material: material(q.edgeMaterial as PathMaterialSpec["kind"], num("edgeWeight"), num("edgeSpacing"), num("edgeRetention"), edgeBead),
      tone: q.edgeTone as EdgeTone, arrow: { ...mark("arrow", q.arrows === true ? num("arrowSize") : 0, 1.1), retention: num("arrowShare") } },
    nodes: { mark: mark(q.nodeMark as MotifSpec["kind"], num("nodeSize"), 1.2, 8),
      scaleBy: q.nodeScaleBy === "uniform" ? "none" : q.nodeScaleBy as GraphAttribute, amount: num("nodeScaleAmount") },
    focal: { material: material(q.routeMaterial as PathMaterialSpec["kind"], num("routeWeight"), num("routeSpacing"), 1, routeBead),
      endpoints: mark("rings", q.endpoints === true ? num("endpointSize") : 0, 1.6, 6, .35) },
    faces: q.faces === true ? { tint: q.faceTint as FaceFillSpec["tint"], opacity: num("faceOpacity"), minArea: num("faceMinArea"),
      maxArea: num("faceMaxArea"), retention: num("faceRetention"), colors: [graphTones.high, graphTones.mid] } : null };
}

/** Whether a new seed can change what these controls draw. */
export function graphRolesUsesSeed(q: Record<string, Scalar>): boolean {
  const num = (key: string) => q[key] as number;
  if (num("edgeRetention") > 0 && num("edgeRetention") < 1 || q.faces === true && num("faceRetention") > 0 && num("faceRetention") < 1) return true;
  if (q.source === "contact") return num("disorder") > 0 && num("width") > 0 || num("speed") > 0;
  if (q.source === "branches") return num("survival") < 1 || num("angleSpread") > 0;
  return true;
}
