import { pairForceStep2D, radiusPairs2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer, Parameter } from "../types.js";
import { choice, numeric, toggle, type StudioDefinition } from "./types.js";
import { createSimulationCache, finalState, runSimulation, type Simulation, type Snapshots } from "../composition/snapshots.js";

type Kind = "contact-network" | "agent-trails";
type Point = [number, number];
type Params = Layer["params"];
type Canvas = {
  noFill(): void; noStroke(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(weight: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
};
type Settings = {
  count: number; ticks: number; sourceMode: string; centerX: number; centerY: number;
  extent: number; aspect: number; angle: number; disorder: number;
  velocityHeading: number; speed: number; velocitySpread: number;
  radius: number; avoidance: number; openChains: boolean;
  force: number; repulsionRadius: number; damping: number; maxSpeed: number;
  trails: boolean; trailWeight: number; trailStride: number;
  links: boolean; linkWeight: number; linkDotSize: number;
  nodes: boolean; nodeSize: number; dotMarks: boolean;
  showVelocities: boolean; velocityScale: number; velocityWeight: number;
};
/**
 * `history[t]` are the frozen positions after t ticks; `pairHistory[t]` is the flat `[a0, b0, a1, b1, …]` pair
 * list of `history[t]` (compact: 8 bytes a pair, a private copy that must not be written); the last entry
 * equals `pairs`. Built from `Snapshots`, so the same frames can be replayed from any checkpoint.
 */
export type ProximityReplay = {
  history: readonly (readonly (readonly number[])[])[]; points: readonly (readonly number[])[]; velocities: Point[]; pairs: number[][]; pairHistory: readonly Int32Array[];
};


const parameters: Parameter[] = [
  numeric("count", "Agents", "Number of initial bodies (1–160).", 1, 126, 1, { hardMin: 1, hardMax: 160, integer: true }),
  choice("sourceMode", "Starting shape", "Initial area, line, ring or grid; no automatic fit to page.", ["area", "line", "ring", "grid"]),
  numeric("centerX", "Source X", "Center in canvas coordinates.", 0, 640, 1, { hardMin: -4000, hardMax: 4000, integer: false }),
  numeric("centerY", "Source Y", "Center in canvas coordinates.", 0, 640, 1, { hardMin: -4000, hardMax: 4000, integer: false }),
  numeric("extent", "Source extent", "Width/diameter of the initial shape in canvas units.", 0, 500, 1, { hardMin: 0, hardMax: 2000, integer: false }),
  numeric("aspect", "Source aspect", "Vertical/horizontal extent before rotation.", 0, 2, .01, { hardMin: 0, hardMax: 10, integer: false }),
  numeric("angle", "Source angle", "Initial layout rotation in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600, integer: false }),
  numeric("disorder", "Starting disorder", "Seeded positional jitter as a fraction of average spacing; zero is ordered.", 0, 1, .01, { hardMin: 0, hardMax: 2, integer: false }),
  numeric("velocityHeading", "Velocity heading", "Global initial travel direction in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600, integer: false }),
  numeric("speed", "Starting speed", "Initial speed before the first force step.", 0, 3, .05, { hardMin: 0, hardMax: 20, integer: false }),
  numeric("velocitySpread", "Heading spread", "Seeded heading variation in degrees (+/−); zero is uniform.", 0, 180, 1, { hardMin: 0, hardMax: 360, integer: false }),
  numeric("ticks", "Ticks", "Number of complete synchronous pair-force steps from initial state.", 0, 120, 1, { hardMin: 0, hardMax: 180, integer: true }),
  numeric("radius", "Radius", "Inclusive Euclidean radius for current pairs at each step, unless Open chains is on.", 0, 130, 1, { hardMin: 0, hardMax: 2000, integer: false }),
  numeric("avoidance", "Avoidance", "Repulsive force inside repulsion radius on each supplied pair.", 0, .75, .01, { hardMin: 0, hardMax: 10, integer: false }),
  toggle("openChains", "Open chains", "Use consecutive agent indices as open edges for force and current links; radius is unused."),
  numeric("force", "Attraction", "Attractive pair force per unit displacement.", 0, .005, .00005, { hardMin: 0, hardMax: 1, integer: false }),
  numeric("repulsionRadius", "Avoidance reach", "Distance below which avoidance acts (exclusive).", 0, 100, 1, { hardMin: 0, hardMax: 2000, integer: false }),
  numeric("damping", "Damping", "Velocity multiplier applied once per step after force.", 0, 1, .005, { hardMin: 0, hardMax: 1, integer: false }),
  numeric("maxSpeed", "Speed cap", "Per-agent maximum velocity after damping.", 0, 8, .1, { hardMin: 0, hardMax: 50, integer: false }),
  toggle("trails", "Retained trails", "Paint successive stored positions without advancing simulation."),
  numeric("trailStride", "Trail stride", "Sample every N retained ticks, including the final tick.", 1, 16, 1, { hardMin: 1, hardMax: 180, integer: true }),
  numeric("trailWeight", "Trail weight", "Independent trail stroke width; zero hides trails.", 0, 5, .1, { hardMin: 0, hardMax: 30, integer: false }),
  toggle("links", "Current links", "Show current radius pairs or consecutive open-chain pairs."),
  numeric("linkWeight", "Link weight", "Independent current-link stroke width; zero hides links.", 0, 5, .1, { hardMin: 0, hardMax: 30, integer: false }),
  numeric("linkDotSize", "Link dot size", "Diameter of pair midpoint dots when Dot marks is on.", 0, 9, .1, { hardMin: 0, hardMax: 40, integer: false }),
  toggle("nodes", "Current nodes", "Paint the current agent positions separately from links/trails."),
  numeric("nodeSize", "Node size", "Current-agent diameter; zero hides nodes.", 0, 10, .1, { hardMin: 0, hardMax: 50, integer: false }),
  toggle("dotMarks", "Dot marks", "Use dots on sampled trails and pair midpoints instead of continuous strokes."),
  toggle("showVelocities", "Final velocity spokes", "Draw each final velocity vector from its final agent position, independently of trails/links/nodes."),
  numeric("velocityScale", "Velocity length", "Multiply actual final velocity components to draw a spoke in canvas units.", 0, 20, .25, { hardMin: 0, hardMax: 1000, integer: false }),
  numeric("velocityWeight", "Velocity weight", "Independent final velocity spoke stroke width; zero hides spokes.", 0, 4, .1, { hardMin: 0, hardMax: 30, integer: false }),
];
const base = {sourceMode: "area",
  centerX: 320,
  centerY: 320,
  extent: 260,
  aspect: .9,
  angle: 0,
  disorder: .15,
  velocityHeading: -30,
  speed: .42,
  velocitySpread: 80,
  ticks: 72,
  radius: 54,
  avoidance: .22,
  openChains: false,
  force: .0011,
  repulsionRadius: 42,
  damping: .94,
  maxSpeed: 2.1,
  trails: false,
  trailStride: 3,
  trailWeight: 1.1,
  links: true,
  linkWeight: .8,
  linkDotSize: 2.2,
  nodes: true,
  nodeSize: 3.5,
  dotMarks: false,
  showVelocities: false,
  velocityScale: 7,
  velocityWeight: .85};
const controlGroups: ControlGroup[] = [
  { label: "Population", controls: ["sourceMode", "count", "disorder"] },
  { label: "Placement", controls: ["centerX", "centerY", "extent", "aspect", "angle"] },
  { label: "Starting motion", controls: ["velocityHeading", "speed", "velocitySpread"] },
  { label: "Simulation", controls: ["ticks", "openChains", "radius", "force",
    { label: "Avoidance", controls: ["avoidance", "repulsionRadius"] }, "damping", "maxSpeed"] },
  { label: "Drawing", controls: ["dotMarks",
    { label: "Trails", controls: ["trails", "trailStride", "trailWeight"] },
    { label: "Links", controls: ["links", "linkWeight", "linkDotSize"] },
    { label: "Nodes", controls: ["nodes", "nodeSize"] },
    { label: "Velocity spokes", controls: ["showVelocities", "velocityScale", "velocityWeight"] }] },
];
export const proximityReplayInstrumentDefinitions: StudioDefinition[] = [
  { id: "contact-network", title: "Contact network", description: "Editable current neighborhood links under synchronous pair-force replay.",
    parameters, controlGroups, defaults: { ...base, count: 60, extent: 320, ticks: 24, radius: 43, nodeSize: 2.6, linkWeight: .7 }, validate: validateProximityReplayInstrument },
  { id: "agent-trails", title: "Agent trails", description: "Retained movement histories from the same editable proximity-force replay.",
    parameters, controlGroups, defaults: { ...base, count: 75, sourceMode: "ring", extent: 340, aspect: .8, disorder: .06,
      velocityHeading: 30, speed: 1.5, velocitySpread: 100, force: .00042,
      repulsionRadius: 34, damping: .995, trails: true, trailStride: 2, trailWeight: 1.2,
      links: false, nodes: true, nodeSize: 3.2, showVelocities: true }, validate: validateProximityReplayInstrument },
];
function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return value;
}
function settings(q: Params): Settings {
  const count = checked(q, "count", 1, 160, true);
  const ticks = checked(q, "ticks", 0, 180, true);
  if (typeof q.openChains !== "boolean") throw new Error("openChains must be boolean");
  const pairWork = q.openChains
    ? ticks * (2 * count - (Math.min(3, Math.floor(count / 2)) || 1))
    : (2 * ticks + 1) * (count + count * (count - 1) / 2);
  if (pairWork > 3_000_000) throw new Error("Proximity replay exceeds the 3,000,000-unit pair-work budget");
  const sourceMode = q.sourceMode;
  if (sourceMode !== "area" && sourceMode !== "line" && sourceMode !== "ring" && sourceMode !== "grid")
    throw new Error("sourceMode must be area, line, ring or grid");
  const values = {
    count, ticks, sourceMode,
    centerX: checked(q, "centerX", -4000, 4000), centerY: checked(q, "centerY", -4000, 4000),
    extent: checked(q, "extent", 0, 2000), aspect: checked(q, "aspect", 0, 10),
    angle: checked(q, "angle", -3600, 3600), disorder: checked(q, "disorder", 0, 2),
    velocityHeading: checked(q, "velocityHeading", -3600, 3600), speed: checked(q, "speed", 0, 20),
    velocitySpread: checked(q, "velocitySpread", 0, 360), radius: checked(q, "radius", 0, 2000),
    avoidance: checked(q, "avoidance", 0, 10), force: checked(q, "force", 0, 1),
    repulsionRadius: checked(q, "repulsionRadius", 0, 2000), damping: checked(q, "damping", 0, 1),
    maxSpeed: checked(q, "maxSpeed", 0, 50), trailWeight: checked(q, "trailWeight", 0, 30),
    trailStride: checked(q, "trailStride", 1, 180, true),
    linkWeight: checked(q, "linkWeight", 0, 30), linkDotSize: checked(q, "linkDotSize", 0, 40),
    nodeSize: checked(q, "nodeSize", 0, 50),
    velocityScale: checked(q, "velocityScale", 0, 1000),
    velocityWeight: checked(q, "velocityWeight", 0, 30),
  };
  for (const key of ["openChains", "trails", "links", "nodes", "dotMarks", "showVelocities"] as const)
    if (typeof q[key] !== "boolean") throw new Error(`${key} must be boolean`);
  return { ...values, openChains: q.openChains as boolean, trails: q.trails as boolean,
    links: q.links as boolean, nodes: q.nodes as boolean, dotMarks: q.dotMarks as boolean,
    showVelocities: q.showVelocities as boolean };
}
export function validateProximityReplayInstrument(q: Params): void {
  
  settings(q);
}
function makeInitial(s: Readonly<Construction>, seed: number): { points: Point[]; velocities: Point[] } {
  const positionRng = s.disorder > 0 && s.extent > 0 ? new JavaRandom(seed) : null;
  const velocityRng = s.speed > 0 && s.velocitySpread > 0 ? new JavaRandom((seed ^ 0x5a17c9e3) >>> 0) : null;
  const points: Point[] = [], velocities: Point[] = [];
  const rad = s.angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const columns = Math.ceil(Math.sqrt(s.count / Math.max(s.aspect, .05)));
  const rows = Math.ceil(s.count / columns);
  const spacing = s.extent / Math.max(1, Math.sqrt(s.count));
  for (let i = 0; i < s.count; i++) {
    let x: number, y: number;
    if (s.sourceMode === "line") { x = s.count === 1 ? 0 : (i / (s.count - 1) - .5) * s.extent; y = 0; }
    else if (s.sourceMode === "grid") {
      x = (i % columns - (columns - 1) / 2) * s.extent / Math.max(1, columns - 1);
      y = (Math.floor(i / columns) - (rows - 1) / 2) * s.extent;
      y /= Math.max(1, rows - 1);
    } else {
      const direction = s.sourceMode === "ring" ? 2 * Math.PI * i / s.count : i * 2.399963229728653;
      const distance = s.extent * .5 * (s.sourceMode === "ring" ? 1 : Math.sqrt((i + .5) / s.count));
      x = Math.cos(direction) * distance; y = Math.sin(direction) * distance;
    }
    y *= s.aspect;
    if (positionRng) {
      x += (positionRng.nextDouble() * 2 - 1) * s.disorder * spacing;
      y += (positionRng.nextDouble() * 2 - 1) * s.disorder * spacing;
    }
    points.push([s.centerX + x * cos - y * sin, s.centerY + x * sin + y * cos]);
    const heading = (s.velocityHeading + (velocityRng
      ? (velocityRng.nextDouble() * 2 - 1) * s.velocitySpread : 0)) * Math.PI / 180;
    velocities.push([Math.cos(heading) * s.speed, Math.sin(heading) * s.speed]);
  }
  return { points, velocities };
}
/** The construction of a replay: everything that shapes a tick, and none of `ticks` (the step count) or appearance. */
const constructionKeys = ["count", "sourceMode", "centerX", "centerY", "extent", "aspect", "angle", "disorder",
  "velocityHeading", "speed", "velocitySpread", "radius", "avoidance", "openChains", "force", "repulsionRadius", "damping", "maxSpeed"] as const;
type Construction = Pick<Settings, typeof constructionKeys[number]>;
/** `pairs` always belongs to `points`; a tick reads them and computes the next pair list. */
type ReplayState = { points: Point[]; velocities: Point[]; pairs: number[][] };
type ReplayFrame = { points: Point[]; pairs: Int32Array };
const flatPairs = (pairs: number[][]): Int32Array => {
  const out = new Int32Array(pairs.length * 2);
  for (let i = 0; i < pairs.length; i++) { out[2 * i] = pairs[i][0]; out[2 * i + 1] = pairs[i][1]; }
  return out;
};
function chainPairs(s: Construction): number[][] {
  const chains: number[][] = [];
  if (s.openChains) {
    const groups = Math.min(3, Math.floor(s.count / 2)) || 1;
    for (let i = 1; i < s.count; i++)
      if (Math.floor(i * groups / s.count) === Math.floor((i - 1) * groups / s.count))
        chains.push([i - 1, i]);
  }
  return chains;
}
function pairsFor(s: Construction, points: Point[]): number[][] {
  return s.openChains ? chainPairs(s) : radiusPairs2D({ points, radius: s.radius, maxWork: s.count + s.count * (s.count - 1) / 2 }).pairs;
}
/** One synchronous pair-force tick per step; the retained projection is each tick's positions and pair list. */
const proximitySimulation: Simulation<ReplayState, Construction, ReplayFrame> = {
  id: "proximity-replay",
  limits: (s) => ({ stepLimit: 180, workPerStep: s.count * s.count + s.count }),
  initial(ctx) {
    const { points, velocities } = makeInitial(ctx.params, ctx.seed);
    ctx.charge(ctx.params.count + ctx.params.count * (ctx.params.count - 1) / 2);
    return { points, velocities, pairs: pairsFor(ctx.params, points) };
  },
  step(state, ctx) {
    const s = ctx.params;
    const next = pairForceStep2D({ points: state.points, velocities: state.velocities, pairs: state.pairs, attraction: s.force,
      repulsion: s.avoidance, repulsionRadius: s.repulsionRadius, damping: s.damping,
      dt: 1, maxSpeed: s.maxSpeed, maxWork: s.count + state.pairs.length });
    ctx.charge(s.count + state.pairs.length);
    ctx.charge(s.count + s.count * (s.count - 1) / 2);
    return { points: next.points, velocities: next.velocities, pairs: pairsFor(s, next.points) };
  },
  project: (state) => ({ points: state.points, pairs: flatPairs(state.pairs) }),
};
/** Ticks 0…N as frozen frames; `velocities` and `pairs` are the final state's, as copies this replay owns. */
function replayOf(snaps: Snapshots<ReplayState, Construction, ReplayFrame>): ProximityReplay {
  const end = finalState(snaps);
  return { history: snaps.history.map((entry) => entry.value.points), points: end.points, velocities: end.velocities,
    pairs: end.pairs, pairHistory: snaps.history.map((entry) => entry.value.pairs) };
}
function construction(s: Settings): Construction {
  return Object.fromEntries(constructionKeys.map((k) => [k, k === "radius" && s.openChains ? 0 : s[k]])) as Construction;
}
/** The seed matters only where a seeded stream is actually drawn. */
const seedOf = (s: Settings, seed: number): number =>
  (s.disorder > 0 && s.extent > 0) || (s.speed > 0 && s.velocitySpread > 0) ? seed : 0;
/** Fresh source for geometry tests or analysis; never consults the drawing cache. */
export function buildProximityReplay(params: Params, seed: number): ProximityReplay {
  const s = settings(params);
  return replayOf(runSimulation(proximitySimulation, construction(s), seed, { steps: s.ticks }));
}
/** Retained snapshots by construction: recolouring never reruns the replay, and a longer `ticks` extends a cached shorter run. */
const replays = createSimulationCache({ capacity: 6 });
const composed = new WeakMap<object, ProximityReplay>();
function retained(s: Settings, seed: number): ProximityReplay {
  const snaps = replays.get(proximitySimulation, construction(s), seedOf(s, seed), { steps: s.ticks });
  let replay = composed.get(snaps);
  if (!replay) { replay = replayOf(snaps); composed.set(snaps, replay); }
  return replay;
}
/** The replay a drawing of these settings uses: the same object for the same construction, whatever the appearance. */
export function cachedProximityReplay(params: Params, seed: number): ProximityReplay {
  return retained(settings(params), seed);
}
function color(layer: Layer, channel: number): [number, number, number] {
  const packed = (layer.palette[channel % layer.palette.length] ?? 0x232323) >>> 0;
  return [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
}
export function drawProximityReplayInstrument(p: Canvas, layer: Layer): void {
  const s = settings(layer.params);
  const result = retained(s, layer.seed);
  p.noFill();
  if (s.trails && s.trailWeight > 0) {
    p.stroke(...color(layer, 1), 165);
    p.strokeWeight(s.trailWeight);
    for (let i = 0; i < s.count; i++) {
      let previous = result.history[0][i];
      for (let frame = s.trailStride; frame <= s.ticks; frame += s.trailStride) {
        const next = result.history[frame][i];
        if (s.dotMarks) p.circle(next[0], next[1], s.trailWeight * 2);
        else p.line(previous[0], previous[1], next[0], next[1]);
        previous = next;
      }
      if (s.ticks > 0 && s.ticks % s.trailStride !== 0) {
        const next = result.points[i];
        if (s.dotMarks) p.circle(next[0], next[1], s.trailWeight * 2);
        else p.line(previous[0], previous[1], next[0], next[1]);
      }
    }
  }
  if (s.links && s.linkWeight > 0 && (!s.dotMarks || s.linkDotSize > 0)) {
    p.stroke(...color(layer, 0), 160);
    p.strokeWeight(s.linkWeight);
    for (const [a, b] of result.pairs) {
      const left = result.points[a], right = result.points[b];
      if (s.dotMarks) p.circle((left[0] + right[0]) / 2, (left[1] + right[1]) / 2, s.linkDotSize);
      else p.line(left[0], left[1], right[0], right[1]);
    }
  }
  if (s.showVelocities && s.velocityScale > 0 && s.velocityWeight > 0) {
    p.stroke(...color(layer, 2), 220);
    p.strokeWeight(s.velocityWeight);
    for (let i = 0; i < s.count; i++) {
      const [vx, vy] = result.velocities[i];
      if (vx === 0 && vy === 0) continue;
      const [x, y] = result.points[i];
      p.line(x, y, x + vx * s.velocityScale, y + vy * s.velocityScale);
    }
  }
  if (s.nodes && s.nodeSize > 0) {
    p.noStroke(); p.fill(...color(layer, 2), 240);
    for (const [x, y] of result.points) p.circle(x, y, s.nodeSize);
  }
}
