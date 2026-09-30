/**
 * Collision Scores as a typed composition: one producer (the collision score of `collision.ts`) and five treatments
 * that all read the same frozen log: disc positions, trails through `pathMaterial` (or the dry-brush material),
 * marks at contact points through `motif`, bounce-angle rays through `pathMaterial`, and the contact graph through
 * the graph edge/node consumers. Nothing here changes what the bodies did.
 *
 * - `recipe.setup` is the construction (container, posts, bodies, emitter, physics) and `recipe.steps` the time: they
 *   are the whole cache key with the seed. `recipe.view` is appearance: the recording window, what is shown, sizes,
 *   colors, materials. Editing the view or the palette reuses the same snapshots and score objects.
 * - The recording window `[t0, steps]` (`window` steps, or everything for 0) filters every treatment the same way.
 * - Contacts shown: kind (`contacts`), and impulse at least `minImpulse` of the strongest in the whole recording.
 *   A mark's size and a ray's length are `floor + (1 - floor) * sqrt(impulse / strongest)` of their maxima.
 * - Colors (`colorBy`): body → each disc's palette tone (a contact takes its first disc's); kind → trails 0, disc
 *   contacts 1, wall contacts 2; time → the palette in order through the window (trails are cut into that many bands).
 * - `drawCollisionScores(surface, recipe, consumers)` replaces any treatment with an ordinary callback.
 *   `collisionScoreOfRecipe(recipe)` returns the score for any other consumer.
 */
import { collisionScoresDefinition } from "../adapters/collision-scores-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, cachedBy, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { MAX_HAIR_POINTS, MAX_STATIONS, bristleMaterial, checkBristleWork } from "./bristle.js";
import { resolveRoom, roomParams } from "./collision-room.js";
import {
  collisionModel, collisionScore, collisionSnapshots, prepareCollisionSnapshots, type CollisionEmitter, type CollisionScore, type CollisionSetup, type CollisionTrail, type Contact, type EmitterMode,
} from "./collision.js";
import { edgeFraction, edgePaths, graphFromParts, nodeFraction, nodeSites, type Graph } from "./graph.js";
import { color, motif, pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Point, Site } from "./types.js";

export type CollisionColorBy = "body" | "kind" | "time";
export interface CollisionView {
  /** Steps drawn, counted back from the end of the recording; 0 draws everything. */
  window: number;
  colorBy: CollisionColorBy;
  contacts: "bodies" | "walls" | "all";
  /** Share of the strongest impulse below which a contact is not drawn. */
  minImpulse: number;
  /** Share of the maximum size a weakest shown contact keeps. */
  floor: number;
  outline: boolean;
  discs: { style: "none" | "filled" | "outline"; weight: number };
  trail: { kind: "none" | "ink" | "stitch" | "beads" | "bristle"; weight: number; spacing: number; bead: number; brushWidth: number };
  mark: { kind: "none" | "dot" | "rings" | "rosette" | "arrow"; size: number; weight: number; petals: number };
  rays: { mode: "none" | "reflected" | "both"; length: number; weight: number };
  graph: { on: boolean; anchor: "contacts" | "final"; weight: number; nodeSize: number };
}
export interface CollisionScoresRecipe {
  kind: "collision-scores";
  seed: number;
  palette: readonly number[];
  setup: CollisionSetup;
  steps: number;
  view: CollisionView;
}
/** A contact as a placement site: at the contact point, turned to its normal, `scale` from its impulse. */
export interface ContactSite extends Site { readonly contact: Contact; readonly strength: number }
/** A disc at the end of the window: `scale` is its radius, so a mark draws a unit disc at the origin. */
export interface DiscSite extends Site { readonly body: string; readonly radius: number }
export interface TrailPath extends Path { readonly body: string }
export interface CollisionConsumers {
  disc?: (surface: CompositionSurface, site: DiscSite, run: CompositionRun) => void;
  trail?: PathMaterial;
  mark?: (surface: CompositionSurface, site: ContactSite, run: CompositionRun) => void;
  ray?: PathMaterial;
  edge?: PathMaterial;
  node?: Mark;
}

type Scalar = number | string | boolean;
const definition = collisionScoresDefinition;

/** Whether the seed can change the construction: random placement, radii or launch draws that reach a body. */
export function collisionScoresUsesSeed(q: InstrumentInput["params"]): boolean {
  return q.emitter === "scatter" || Number(q.radiusSpread) > 0 || (Number(q.speed) > 0 && (Number(q.headingSpread) > 0 || Number(q.speedSpread) > 0));
}

/** Resolve stored scalar controls to the public composition value. */
export function collisionScoresComposition(input: InstrumentInput): CollisionScoresRecipe {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) => !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const emitter: CollisionEmitter = { mode: q.emitter as EmitterMode, x: q.emitterX as number, y: q.emitterY as number, extent: q.emitterSize as number, angle: q.emitterAngle as number,
    every: q.emitEvery as number, heading: q.heading as number, headingSpread: q.headingSpread as number, speed: q.speed as number, speedSpread: q.speedSpread as number };
  const room = resolveRoom(roomParams(q));
  return {
    kind: "collision-scores", seed: input.seed, palette: [...input.palette], steps: q.steps as number,
    setup: { container: room.container, posts: room.posts,
      bodies: { count: q.count as number, radius: q.radius as number, radiusSpread: q.radiusSpread as number, massLaw: q.massLaw as "equal" | "area" },
      emitter, physics: { restitution: q.restitution as number, wallRestitution: q.wallRestitution as number, wallFriction: q.wallFriction as number, gravity: q.gravity as number } },
    view: {
      window: q.window as number, colorBy: q.colorBy as CollisionColorBy, contacts: q.contacts as CollisionView["contacts"], minImpulse: q.minImpulse as number, floor: q.floor as number,
      outline: q.outline as boolean, discs: { style: q.bodies as CollisionView["discs"]["style"], weight: q.bodyWeight as number },
      trail: { kind: q.trails as CollisionView["trail"]["kind"], weight: q.trailWeight as number, spacing: q.trailSpacing as number, bead: q.trailBead as number, brushWidth: q.brushWidth as number },
      mark: { kind: q.markKind as CollisionView["mark"]["kind"], size: q.markSize as number, weight: q.markWeight as number, petals: q.markPetals as number },
      rays: { mode: q.rays as CollisionView["rays"]["mode"], length: q.rayLength as number, weight: q.rayWeight as number },
      graph: { on: q.graph as boolean, anchor: q.graphAnchor as "contacts" | "final", weight: q.graphWeight as number, nodeSize: q.graphNodeSize as number },
    },
  };
}

/** The construction of a recipe: its model, the seed that matters, and the step count. */
function construction(recipe: CollisionScoresRecipe) {
  const model = collisionModel(recipe.setup), e = model.emitter, b = model.bodies;
  const seeded = e.mode === "scatter" || b.radiusSpread > 0 || (e.speed > 0 && (e.headingSpread > 0 || e.speedSpread > 0));
  return { model, seed: seeded ? recipe.seed : 0, steps: recipe.steps };
}

/** The frozen score of a recipe: cached snapshots of its construction, then the score built once per snapshot object. */
export function collisionScoreOfRecipe(recipe: CollisionScoresRecipe, options: { cancelled?: () => boolean } = {}): CollisionScore {
  const { model, seed, steps } = construction(recipe);
  return collisionScore(collisionSnapshots(model, seed, steps, options));
}

/** Run the simulation in time slices (cancellable), then build the score; false when cancelled. */
export async function prepareCollisionScores(recipe: CollisionScoresRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const { model, seed, steps } = construction(recipe);
  const snaps = await prepareCollisionSnapshots(model, seed, steps, { cancelled });
  if (!snaps) return false;
  collisionScore(snaps);
  return !cancelled();
}

/* ------------------------------------------------------------------------------------- treatments */

const dotMark: MotifSpec = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
const pathSpec = (kind: PathMaterialSpec["kind"], weight: number, spacing: number, bead: number): PathMaterialSpec =>
  ({ kind, weight, spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: { ...dotMark, size: bead } });
const frozenPoint = (x: number, y: number): Point => Object.freeze([x, y] as const);

const trailCache = new WeakMap<object, Map<string, readonly TrailPath[]>>();
const contactCache = new WeakMap<object, Map<string, readonly Contact[]>>();
const siteCache = new WeakMap<object, Map<string, readonly ContactSite[]>>();
const graphCache = new WeakMap<object, Map<string, Graph | null>>();

const windowStart = (score: CollisionScore, view: CollisionView): number => view.window > 0 ? Math.max(0, score.steps - view.window) : 0;
const band = (time: number, t0: number, t1: number, bands: number): number => t1 > t0 ? Math.max(0, Math.min(bands - 1, Math.floor((time - t0) / (t1 - t0) * bands))) : 0;
const contactTone = (contact: Contact, view: CollisionView, t0: number, t1: number, bands: number): number =>
  view.colorBy === "body" ? Number(contact.a.slice(5)) : view.colorBy === "kind" ? (contact.kind === "body" ? 1 : 2) : band(contact.time, t0, t1, bands);

/** Vertices of a trail within `[from, to]`, cut exactly where the window edges cross a straight stretch. */
function sliceTrail(trail: CollisionTrail, from: number, to: number): Point[] {
  const { times, xs, ys } = trail, out: Point[] = [];
  const at = (i: number, j: number, t: number): Point => {
    const span = times[j] - times[i], f = span > 0 ? (t - times[i]) / span : 0;
    return frozenPoint(xs[i] + (xs[j] - xs[i]) * f, ys[i] + (ys[j] - ys[i]) * f);
  };
  for (let i = 0; i < times.length; i++) {
    if (times[i] < from || times[i] > to) continue;
    if (out.length === 0 && i > 0 && times[i] > from) out.push(at(i - 1, i, from));
    out.push(frozenPoint(xs[i], ys[i]));
    if (i + 1 < times.length && times[i + 1] > to) { out.push(at(i, i + 1, to)); break; }
  }
  return out;
}

function trailPaths(score: CollisionScore, view: CollisionView, palette: number): readonly TrailPath[] {
  const t0 = windowStart(score, view), t1 = score.steps, bands = view.colorBy === "time" ? palette : 1;
  return cachedBy(trailCache, score, `${t0}|${view.colorBy}|${bands}`, () => {
    const paths: TrailPath[] = [];
    for (const trail of score.trails) for (let b = 0; b < bands; b++) {
      const from = t0 + (t1 - t0) * b / bands, to = t0 + (t1 - t0) * (b + 1) / bands;
      const points = sliceTrail(trail, from, to);
      if (points.length < 2) continue;
      const id = bands > 1 ? `${trail.id}#${b}` : trail.id;
      paths.push(Object.freeze({ id, seed: componentSeed(trail.seed, id, "path"), points: Object.freeze(points), closed: false, level: 0, levelFraction: 0,
        tone: view.colorBy === "body" ? trail.serial : view.colorBy === "kind" ? 0 : b, body: trail.body }));
    }
    return Object.freeze(paths);
  });
}

function shownContacts(score: CollisionScore, view: CollisionView): readonly Contact[] {
  const t0 = windowStart(score, view);
  return cachedBy(contactCache, score, `${t0}|${view.contacts}|${view.minImpulse}`, () => Object.freeze(score.contacts.filter((contact) =>
    contact.time > t0 && contact.impulse >= view.minImpulse * score.maxImpulse && (view.contacts === "all" || contact.kind === (view.contacts === "bodies" ? "body" : "wall")))));
}
const strengthOf = (contact: Contact, score: CollisionScore, floor: number): { strength: number; size: number } => {
  const strength = score.maxImpulse > 0 ? Math.sqrt(contact.impulse / score.maxImpulse) : 0;
  return { strength, size: floor + (1 - floor) * strength };
};

function contactSites(score: CollisionScore, view: CollisionView, palette: number): readonly ContactSite[] {
  const t0 = windowStart(score, view), bands = palette;
  return cachedBy(siteCache, score, `${t0}|${view.contacts}|${view.minImpulse}|${view.floor}|${view.colorBy}|${bands}`, () => Object.freeze(shownContacts(score, view).map((contact): ContactSite => {
    const { strength, size } = strengthOf(contact, score, view.floor);
    return Object.freeze({ id: contact.id, seed: contact.seed, position: contact.point, angle: Math.atan2(contact.normal[1], contact.normal[0]), scale: size,
      tone: contactTone(contact, view, t0, score.steps, bands), contact, strength });
  })));
}

/** Rays leave the contact point along each disc's outgoing (and optionally arrived-from) direction. */
function rayPaths(score: CollisionScore, view: CollisionView, palette: number): readonly Path[] {
  const t0 = windowStart(score, view), out: Path[] = [];
  const ray = (contact: Contact, name: string, velocity: Point, sign: number, length: number, tone: number) => {
    const speed = Math.hypot(velocity[0], velocity[1]);
    if (!(speed > 0) || !(length > 0)) return;
    const id = `${contact.id}/${name}`, k = sign * length / speed;
    out.push(Object.freeze({ id, seed: componentSeed(contact.seed, id, "ray"), points: Object.freeze([contact.point, frozenPoint(contact.point[0] + velocity[0] * k, contact.point[1] + velocity[1] * k)]),
      closed: false, level: 0, levelFraction: 0, tone }));
  };
  for (const contact of shownContacts(score, view)) {
    const length = view.rays.length * strengthOf(contact, score, view.floor).size, tone = contactTone(contact, view, t0, score.steps, palette);
    ray(contact, "a-out", contact.aOut, 1, length, tone);
    if (view.rays.mode === "both") ray(contact, "a-in", contact.aIn, -1, length, tone);
    if (contact.bOut) {
      ray(contact, "b-out", contact.bOut, 1, length, tone);
      if (view.rays.mode === "both" && contact.bIn) ray(contact, "b-in", contact.bIn, -1, length, tone);
    }
  }
  return out;
}

/** The disc-contact graph of the window: nodes are discs that met another disc, edge weight the pair's summed impulse share. */
function contactGraph(score: CollisionScore, view: CollisionView): Graph | null {
  const t0 = windowStart(score, view), key = `${t0}|${view.minImpulse}|${view.graph.anchor}`;
  return cachedBy(graphCache, score, key, () => {
    const pairs = new Map<string, { a: number; b: number; sum: number; first: number }>();
    const centre = new Map<number, { x: number; y: number; n: number }>();
    for (const contact of shownContacts(score, { ...view, contacts: "bodies" })) {
      const a = Number(contact.a.slice(5)), b = Number(contact.b.slice(5)), low = Math.min(a, b), high = Math.max(a, b), pair = `${low}:${high}`;
      const at = pairs.get(pair) ?? pairs.set(pair, { a: low, b: high, sum: 0, first: contact.time }).get(pair)!;
      at.sum += contact.impulse;
      for (const body of [a, b]) {
        const c = centre.get(body) ?? centre.set(body, { x: 0, y: 0, n: 0 }).get(body)!;
        c.x += contact.point[0]; c.y += contact.point[1]; c.n++;
      }
    }
    if (pairs.size === 0) return null;
    let strongest = 0;
    for (const pair of pairs.values()) strongest = Math.max(strongest, pair.sum);
    const nodes = [...centre.keys()].sort((p, q) => p - q).map((serial) => {
      const trail = score.trails[serial], c = centre.get(serial)!;
      const last = trail.times.length - 1;
      return { id: `body:${serial}`, position: (view.graph.anchor === "final" ? [trail.xs[last], trail.ys[last]] : [c.x / c.n, c.y / c.n]) as unknown as Point };
    });
    const edges = [...pairs.values()].sort((p, q) => p.a - q.a || p.b - q.b).map((pair) => ({
      id: `pair:${pair.a}:${pair.b}`, from: `body:${pair.a}`, to: `body:${pair.b}`, weight: pair.sum / strongest, age: Math.max(1, Math.ceil(score.steps - pair.first)),
    }));
    return graphFromParts({ seed: score.seed, nodes, edges });
  });
}

function discSites(score: CollisionScore, view: CollisionView, palette: number): readonly DiscSite[] {
  const t0 = windowStart(score, view);
  return score.trails.map((trail): DiscSite => {
    const last = trail.times.length - 1, body = score.bodies[trail.serial];
    const tone = view.colorBy === "body" ? trail.serial : view.colorBy === "kind" ? 0 : band(score.steps, t0, score.steps, palette);
    return Object.freeze({ id: body.id, seed: body.seed, position: frozenPoint(trail.xs[last], trail.ys[last]), angle: 0, scale: body.radius, tone, body: body.id, radius: body.radius });
  });
}

const discMark = (view: CollisionView, palette: readonly number[]) => (surface: CompositionSurface, site: DiscSite): void => {
  if (view.discs.style === "filled") { surface.noStroke(); color(surface, palette, site.tone ?? 0, 185, true); }
  else { surface.noFill(); color(surface, palette, site.tone ?? 0, 235, false); surface.strokeWeight(view.discs.weight / site.scale); }
  surface.circle(0, 0, 2);
};

/** Trail material for the view. The dry brush is one material per palette tone; its work is checked before any hair exists. */
function trailMaterial(view: CollisionView, palette: readonly number[], paths: readonly Path[]): PathMaterial | null {
  const t = view.trail;
  if (t.kind === "none") return null;
  if (t.kind !== "bristle") return pathMaterial(pathSpec(t.kind, t.weight, t.spacing, t.bead), palette);
  const step = 3, hairs = Math.max(4, Math.min(60, Math.round(t.brushWidth * 1.5)));
  let total = 0;
  for (const path of paths) {
    let length = 0;
    for (let i = 1; i < path.points.length; i++) length += Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1]);
    const stations = length / step + 1;
    if (stations > MAX_STATIONS) throw new Error(`A dry-brush trail would need ${Math.ceil(stations)} stations; the limit is ${MAX_STATIONS}. Lower Steps or Speed, or set a Recording window`);
    total += stations * hairs;
  }
  checkBristleWork(total, paths.length, `Lower Brush width, Steps or Bodies, or set a Recording window (limit ${MAX_HAIR_POINTS})`);
  const byTone = new Map<number, PathMaterial>();
  return (surface, path, run) => {
    const tone = Math.floor(path.tone ?? 0);
    let material = byTone.get(tone);
    if (!material) {
      material = bristleMaterial({
        frame: { step, pressure: { profile: "even", level: 0.85, pulses: 1 } },
        brush: { hairs, width: t.brushWidth, map: { floor: 0.3, curve: 1 }, dryness: 0.35, depletion: 0.25, wander: 0.2, tip: { shape: "round", length: 14 }, attack: 8, release: 10 },
        ink: { weight: t.weight, mix: 0, inkTone: tone, mixTone: tone, wash: 0, washTone: 0 },
      }, palette);
      byTone.set(tone, material);
    }
    material(surface, path, run);
  };
}

function validateView(view: CollisionView): void {
  const finite = (label: string, value: number, low: number, high: number) => {
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(`${label} must be a finite number from ${low} to ${high}`);
  };
  finite("Recording window", view.window, 0, 3000); finite("Weakest contact", view.minImpulse, 0, 1); finite("Smallest size", view.floor, 0, 1);
  finite("Body outline", view.discs.weight, 0, 30); finite("Trail weight", view.trail.weight, 0, 30); finite("Station spacing", view.trail.spacing, 0.5, 1000);
  finite("Bead diameter", view.trail.bead, 0.25, 100); finite("Brush width", view.trail.brushWidth, 0.5, 400);
  finite("Mark size", view.mark.size, 0.5, 400); finite("Mark line weight", view.mark.weight, 0, 50); finite("Petals", view.mark.petals, 1, 48);
  finite("Ray length", view.rays.length, 1, 1000); finite("Ray weight", view.rays.weight, 0, 30);
  finite("Graph line weight", view.graph.weight, 0, 30); finite("Graph node size", view.graph.nodeSize, 0, 100);
}

/** Draw the recipe: outline, discs, graph, trails, rays, then contact marks, each from the same score. */
export function drawCollisionScores(surface: CompositionSurface, recipe: CollisionScoresRecipe, consumers: CollisionConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 600_000 })): void {
  run.check();
  const { view, palette } = recipe;
  validateView(view);
  const score = collisionScoreOfRecipe(recipe);
  const tones = palette.length;
  if (view.outline) {
    surface.push();
    surface.noFill(); color(surface, palette, 0, 235, false); surface.strokeWeight(1.5); surface.strokeCap(surface.ROUND);
    for (let s = 0; s < score.walls.segmentCount; s++) { const g = score.walls.segments, o = s * 7; surface.line(g[o], g[o + 1], g[o + 2], g[o + 3]); }
    for (let q = 0; q < score.walls.roundCount; q++) {
      const o = q * 3, radius = score.walls.rounds[o + 2];
      if (radius > 0) surface.circle(score.walls.rounds[o], score.walls.rounds[o + 1], radius * 2);
    }
    surface.pop();
  }
  if (view.discs.style !== "none") atEach(surface, discSites(score, view, tones), consumers.disc ?? discMark(view, palette), run);
  const graph = view.graph.on ? contactGraph(score, view) : null;
  if (graph) {
    const shown = { graph, nodes: graph.nodes, edges: graph.edges };
    const tone = (edge: { from: string; age: number }) => view.colorBy === "body" ? Number(edge.from.slice(5)) : view.colorBy === "kind" ? 1
      : Math.max(0, Math.min(tones - 1, Math.floor((1 - (edge.age - 1) / Math.max(1, score.steps - windowStart(score, view))) * tones)));
    const paths = edgePaths(shown, tone);
    if (view.graph.weight > 0) for (let bucket = 1; bucket <= 4; bucket++) {
      const group = paths.filter((_, i) => Math.ceil(edgeFraction(graph.edges[i], graph, "weight") * 4 - 1e-9) === bucket);
      if (group.length > 0) strokeWith(surface, group, consumers.edge ?? pathMaterial(pathSpec("ink", view.graph.weight * bucket / 4, 8, 3), palette), run);
    }
    if (view.graph.nodeSize > 0) atEach(surface, nodeSites(shown, { scale: (node) => 0.6 + 0.4 * nodeFraction(node, graph, "degree"),
      tone: (node) => view.colorBy === "body" ? Number(node.id.slice(5)) : 1 }), consumers.node ?? motif({ ...dotMark, size: view.graph.nodeSize }, palette), run);
  }
  const trails = trailPaths(score, view, tones);
  const material = consumers.trail ?? trailMaterial(view, palette, trails);
  if (material) strokeWith(surface, trails, material, run);
  if (view.rays.mode !== "none" && view.rays.weight > 0) strokeWith(surface, rayPaths(score, view, tones), consumers.ray ?? pathMaterial(pathSpec("ink", view.rays.weight, 8, 3), palette), run);
  if (view.mark.kind !== "none") atEach(surface, contactSites(score, view, tones), consumers.mark ?? motif({ kind: view.mark.kind, size: view.mark.size, petals: view.mark.petals, opening: 0.3,
    weight: view.mark.weight, rotation: 0, variation: 0, retention: 1 }, palette), run);
}
