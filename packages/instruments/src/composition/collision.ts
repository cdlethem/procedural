/**
 * Collision Scores producer: discs moving in a bounded container as a stepped `Simulation` (foundation F7) whose
 * projection is the collision record, and the frozen `CollisionScore` that every drawing treatment reads.
 * See `docs/composition-collision-scores.md`; the solver's laws and tie order are in `collision-solver.ts`.
 *
 * Inputs (`CollisionSetup`): a container (any `PlanarShape`; its rings are the walls, holes are islands), free round
 * posts `[x, y, radius]`, the bodies (count, radius, radius spread, mass law), an emitter and the physics. All
 * lengths are canvas units, speeds units per frame, angles degrees, time frames (one simulation step is one frame).
 *
 * Bodies and ids. Body `k` is `body:k`, numbered by birth (a counter in the state); ids are never reused and never
 * come from array order. Every random draw of a body (size, launch, placement) comes from
 * `ctx.stream("body:k", purpose)`, so no other body can move it. Contacts are `contact:n` in log order (time, then
 * the solver's tie order); more steps only append.
 *
 * Emitters. `scatter`: all bodies placed at step 0 by seeded rejection sampling; `line`, `ring`: placed evenly on a
 * segment or circle at step 0; `nozzle`: body 0 at step 0, then one more at the start of step `k ≥ every · (born)`,
 * from the nozzle point, when that spot is free (occupied means try again next step, deterministically). A body that
 * cannot be placed throws naming the control to change; nothing is placed overlapping, and no body is dropped.
 * Headings are `heading ± headingSpread` degrees (absolute, except `ring` where `heading` is measured from the
 * outward direction); speeds `speed · (1 ± speedSpread)`.
 *
 * Bounds (each throws naming the control): bodies ≤ 96, steps ≤ 3000, container edges + posts ≤ 4000, collision log
 * ≤ 30,000 contacts, each frame ≤ 32 + 8·bodies contacts, work per step ≤ 2000 + 1200·bodies units.
 *
 * Output ownership. `collisionSnapshots` returns the cached `Snapshots` of one construction; `collisionScore` builds
 * the frozen score from it once per snapshot object (identity is stable under any appearance edit). Nothing here
 * reads palette, marks or materials.
 */
import { componentSeed } from "./core.js";
import { EVENT, EVENT_STRIDE, KIND_EMIT, KIND_PAIR, KIND_WALL, solveFrame, type Physics } from "./collision-solver.js";
import { buildWalls, distanceToWalls, insideContainer, wallsNear, type WallSet } from "./collision-walls.js";
import { containerRings } from "./collision-containers.js";
import type { PlanarShape } from "./domains.js";
import { createSimulationCache, type Simulation, type SimulationContext, type Snapshots } from "./snapshots.js";
import type { Point } from "./types.js";

export type EmitterMode = "scatter" | "line" | "ring" | "nozzle";
export const emitterModes = ["scatter", "line", "ring", "nozzle"] as const;
export type MassLaw = "equal" | "area";

export interface CollisionBodies { count: number; radius: number; radiusSpread: number; massLaw: MassLaw }
export interface CollisionEmitter {
  mode: EmitterMode;
  /** Line centre, ring centre or nozzle point. */
  x: number; y: number;
  /** Line length or ring diameter. */
  extent: number;
  /** Line orientation in degrees. */
  angle: number;
  /** Nozzle: steps between births. */
  every: number;
  heading: number; headingSpread: number; speed: number; speedSpread: number;
}
export interface CollisionSetup {
  container: PlanarShape;
  posts: readonly (readonly [number, number, number])[];
  bodies: CollisionBodies;
  emitter: CollisionEmitter;
  physics: Physics;
}
/** The construction: plain data, and everything the cache key contains. Fields an emitter mode ignores are zeroed. */
export interface CollisionModel {
  rings: number[][][];
  posts: number[][];
  bodies: CollisionBodies;
  emitter: CollisionEmitter;
  physics: Physics;
}

export const COLLISION_LIMITS = Object.freeze({
  maxBodies: 96, maxSteps: 3000, maxWallElements: 4000, maxContacts: 30_000, maxRadius: 60, maxSpeed: 40,
  /** Rejection-sampling tries per scattered body. */
  placementTries: 300, /** Smallest gap between a newly placed body and anything else. */ placementGap: 0.5,
  checkpointEvery: 100,
});
const perFrameEvents = (count: number) => 32 + 8 * count;
const workPerStep = (count: number) => 2000 + 1200 * count;

function check(label: string, value: number, low: number, high: number, integer = false): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} from ${low} to ${high} (got ${String(value)})`);
}

/** Validate a setup and resolve it to the plain construction. */
export function collisionModel(setup: CollisionSetup): CollisionModel {
  const { bodies, emitter, physics } = setup;
  check("Bodies", bodies.count, 1, COLLISION_LIMITS.maxBodies, true);
  check("Radius", bodies.radius, 1, COLLISION_LIMITS.maxRadius);
  check("Radius spread", bodies.radiusSpread, 0, 0.9);
  if (bodies.massLaw !== "equal" && bodies.massLaw !== "area") throw new Error(`Unknown mass law: ${String(bodies.massLaw)}`);
  if (!(emitterModes as readonly string[]).includes(emitter.mode)) throw new Error(`Unknown emitter: ${String(emitter.mode)}`);
  check("Speed", emitter.speed, 0, COLLISION_LIMITS.maxSpeed);
  check("Speed spread", emitter.speedSpread, 0, 1);
  check("Heading", emitter.heading, -3600, 3600);
  check("Heading spread", emitter.headingSpread, 0, 360);
  check("Restitution", physics.restitution, 0, 1);
  check("Wall restitution", physics.wallRestitution, 0, 1);
  check("Wall friction", physics.wallFriction, 0, 5);
  check("Gravity", physics.gravity, -2, 2);
  const posts = setup.posts.map((post, k) => {
    for (const value of post) if (!Number.isFinite(value)) throw new Error(`Post ${k} needs finite [x, y, radius]`);
    if (!(post[2] > 0)) throw new Error(`Post ${k} needs a positive radius`);
    return [post[0], post[1], post[2]];
  });
  const rings = containerRings(setup.container);
  const elements = rings.reduce((sum, ring) => sum + ring.length, 0) * 2 + posts.length;
  if (elements > COLLISION_LIMITS.maxWallElements)
    throw new Error(`The container has ${elements} wall elements (edges, corners and posts); the limit is ${COLLISION_LIMITS.maxWallElements}. Simplify the container or lower Barrier count`);
  const nozzle = emitter.mode === "nozzle", line = emitter.mode === "line", ring = emitter.mode === "ring";
  if (nozzle) check("Emit every", emitter.every, 1, 600, true);
  if (line || ring) check("Emitter size", emitter.extent, 0, 4000);
  if (line) check("Emitter angle", emitter.angle, -3600, 3600);
  if (emitter.mode !== "scatter") { check("Emitter X", emitter.x, -4096, 4096); check("Emitter Y", emitter.y, -4096, 4096); }
  return {
    rings, posts, bodies: { ...bodies },
    emitter: { mode: emitter.mode, x: emitter.mode === "scatter" ? 0 : emitter.x, y: emitter.mode === "scatter" ? 0 : emitter.y, extent: line || ring ? emitter.extent : 0,
      angle: line ? emitter.angle : 0, every: nozzle ? emitter.every : 0, heading: emitter.heading, headingSpread: emitter.headingSpread, speed: emitter.speed, speedSpread: emitter.speedSpread },
    physics: { ...physics },
  };
}

/* ------------------------------------------------------------------------------------- simulation */

export interface CollisionState {
  born: number;
  /** Nozzle: first step at which the next body may be born. */
  nextBirth: number;
  /** Records logged so far (contacts and births), for the log bound. */
  total: number;
  x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; r: Float64Array; m: Float64Array;
  /** Packed records (`EVENT_STRIDE` each) of the step just taken; the births of step 0 in the initial state. */
  events: Float64Array;
}
export interface CollisionFrame {
  born: number;
  /** `x0, y0, x1, y1, …` of the born bodies at the end of the step. */
  positions: Float64Array;
  events: Float64Array;
}

const wallMemo = new WeakMap<object, WallSet>();
function wallsOf(model: CollisionModel): WallSet {
  let walls = wallMemo.get(model);
  if (!walls) { walls = buildWalls(model.rings, model.posts); wallMemo.set(model, walls); }
  return walls;
}

const radians = Math.PI / 180;

/** Place and launch bodies for one step. Reads only the model, the ctx streams and the state. */
class Spawner {
  private readonly marks: Int32Array;
  private readonly near: number[] = [];
  private stamp = 0;
  constructor(readonly walls: WallSet, readonly model: CollisionModel, readonly ctx: SimulationContext<CollisionModel>, readonly state: CollisionState) {
    this.marks = new Int32Array(walls.segmentCount + walls.roundCount);
  }
  radiusOf(serial: number): number {
    const { radius, radiusSpread } = this.model.bodies;
    return radius * (1 + radiusSpread * (2 * this.ctx.stream(`body:${serial}`, "size").next() - 1));
  }
  /** True when a disc of radius `r` at `(x, y)` is inside, clear of every wall and post, and clear of the born bodies. */
  fits(x: number, y: number, r: number): boolean {
    const gap = COLLISION_LIMITS.placementGap, { walls, state } = this;
    this.ctx.charge(walls.segmentCount + state.born + 2);
    if (!insideContainer(walls, x, y)) return false;
    const reach = r + gap;
    wallsNear(walls, x - reach, y - reach, x + reach, y + reach, this.marks, ++this.stamp, this.near);
    if (distanceToWalls(walls, x, y, this.near) < reach) return false;
    for (let j = 0; j < state.born; j++) if (Math.hypot(x - state.x[j], y - state.y[j]) < r + state.r[j] + gap) return false;
    return true;
  }
  /** Add body `serial` at `(x, y)` launched at `base` radians plus the seeded spread; logs its birth at `time`. */
  birth(serial: number, x: number, y: number, r: number, base: number, time: number, out: number[]): void {
    const { state, model } = this, e = model.emitter, id = `body:${serial}`;
    const launch = this.ctx.stream(id, "launch");
    const heading = base + (e.heading + e.headingSpread * (2 * launch.next() - 1)) * radians;
    const speed = e.speed * (1 + e.speedSpread * (2 * launch.next() - 1));
    const mass = model.bodies.massLaw === "equal" ? 1 : (r / model.bodies.radius) ** 2;
    state.x[serial] = x; state.y[serial] = y; state.r[serial] = r; state.m[serial] = mass;
    state.vx[serial] = Math.cos(heading) * speed; state.vy[serial] = Math.sin(heading) * speed;
    state.born = serial + 1;
    out.push(KIND_EMIT, serial, -1, time, x, y, Math.cos(heading), Math.sin(heading), 0, speed,
      0, 0, state.vx[serial], state.vy[serial], 0, 0, 0, 0, r, mass);
  }
}

const packed = (list: number[]): Float64Array => Float64Array.from(list);

function emptyState(count: number): CollisionState {
  return { born: 0, nextBirth: 0, total: 0, x: new Float64Array(count), y: new Float64Array(count), vx: new Float64Array(count),
    vy: new Float64Array(count), r: new Float64Array(count), m: new Float64Array(count), events: new Float64Array(0) };
}

function initial(ctx: SimulationContext<CollisionModel>): CollisionState {
  const model = ctx.params as CollisionModel, walls = wallsOf(model), e = model.emitter, n = model.bodies.count;
  const state = emptyState(n), spawn = new Spawner(walls, model, ctx, state), out: number[] = [];
  const tooCrowded = (k: number, what: string) => new Error(`Body ${k + 1} of ${n} ${what}; lower Bodies or Radius, move or resize the emitter, or enlarge the container`);
  if (e.mode === "scatter") {
    const [x0, y0, x1, y1] = walls.bounds;
    for (let k = 0; k < n; k++) {
      const r = spawn.radiusOf(k), place = ctx.stream(`body:${k}`, "place");
      let done = false;
      for (let attempt = 0; attempt < COLLISION_LIMITS.placementTries && !done; attempt++) {
        const x = x0 + place.next() * (x1 - x0), y = y0 + place.next() * (y1 - y0);
        if (spawn.fits(x, y, r)) { spawn.birth(k, x, y, r, 0, 0, out); done = true; }
      }
      if (!done) throw tooCrowded(k, `could not be placed after ${COLLISION_LIMITS.placementTries} tries`);
    }
  } else if (e.mode === "nozzle") {
    const r = spawn.radiusOf(0);
    if (!spawn.fits(e.x, e.y, r)) throw new Error("The nozzle does not fit: move Emitter X/Y inside the container, away from walls and posts, or lower Radius");
    spawn.birth(0, e.x, e.y, r, 0, 0, out);
    state.nextBirth = e.every;
  } else {
    for (let k = 0; k < n; k++) {
      const r = spawn.radiusOf(k);
      let x: number, y: number, base = 0;
      if (e.mode === "line") {
        const along = n === 1 ? 0 : (k / (n - 1) - 0.5) * e.extent, a = e.angle * radians;
        x = e.x + Math.cos(a) * along; y = e.y + Math.sin(a) * along;
      } else {
        const theta = 2 * Math.PI * k / n;
        x = e.x + Math.cos(theta) * e.extent / 2; y = e.y + Math.sin(theta) * e.extent / 2; base = theta;
      }
      if (!spawn.fits(x, y, r)) throw tooCrowded(k, `does not fit on the ${e.mode} emitter (it overlaps a wall, a post or another body)`);
      spawn.birth(k, x, y, r, base, 0, out);
    }
  }
  state.events = packed(out);
  state.total = out.length / EVENT_STRIDE;
  return state;
}

function step(state: CollisionState, ctx: SimulationContext<CollisionModel>): CollisionState {
  const model = ctx.params as CollisionModel, walls = wallsOf(model), e = model.emitter, k = ctx.step, out: number[] = [];
  if (e.mode === "nozzle" && state.born < model.bodies.count && k >= state.nextBirth) {
    const spawn = new Spawner(walls, model, ctx, state), serial = state.born, r = spawn.radiusOf(serial);
    if (spawn.fits(e.x, e.y, r)) { spawn.birth(serial, e.x, e.y, r, 0, k - 1, out); state.nextBirth = k + e.every; }
  }
  const cap = workPerStep(model.bodies.count);
  let used = 0;
  solveFrame({ count: state.born, x: state.x, y: state.y, vx: state.vx, vy: state.vy, r: state.r, m: state.m }, walls, model.physics, k - 1, out, {
    maxEvents: perFrameEvents(model.bodies.count),
    charge(units) {
      used += units;
      if (used > cap) throw new Error(`Step ${k} needed more than ${cap} work units; lower Bodies, Radius or Speed, or enlarge the container`);
      ctx.charge(units);
    },
    overflow: (events) => `Step ${k} resolved more than ${perFrameEvents(model.bodies.count)} contacts (${events}); lower Bodies, Radius or Restitution, or enlarge the container`,
  });
  state.events = packed(out);
  state.total += out.length / EVENT_STRIDE;
  if (state.total > COLLISION_LIMITS.maxContacts)
    throw new Error(`The collision log passed ${COLLISION_LIMITS.maxContacts} records by step ${k}; lower Steps, Bodies, Speed or Radius`);
  return state;
}

export const collisionSimulation: Simulation<CollisionState, CollisionModel, CollisionFrame> = {
  id: "collision-scores",
  limits(model) {
    const walls = wallsOf(model as CollisionModel);
    const n = model.bodies.count;
    return { stepLimit: COLLISION_LIMITS.maxSteps, workPerStep: workPerStep(n),
      initialWork: 1000 + n * (model.emitter.mode === "scatter" ? COLLISION_LIMITS.placementTries : 1) * (walls.segmentCount + n + 2) };
  },
  initial: (ctx) => initial(ctx as SimulationContext<CollisionModel>),
  step: (state, ctx) => step(state, ctx as SimulationContext<CollisionModel>),
  project: (state): CollisionFrame => {
    const positions = new Float64Array(state.born * 2);
    for (let i = 0; i < state.born; i++) { positions[2 * i] = state.x[i]; positions[2 * i + 1] = state.y[i]; }
    return { born: state.born, positions, events: state.events };
  },
};

/* ------------------------------------------------------------------------------------- cache */

const cache = createSimulationCache({ capacity: 6, maxStoredValues: 6_000_000 });
export interface CollisionRunOptions { cancelled?: () => boolean }

function runOptions(model: CollisionModel, steps: number, options: CollisionRunOptions) {
  check("Steps", steps, 0, COLLISION_LIMITS.maxSteps, true);
  const n = model.bodies.count;
  return { steps, checkpointEvery: COLLISION_LIMITS.checkpointEvery, historyEvery: 1, cancelled: options.cancelled,
    maxWork: 1000 + n * (COLLISION_LIMITS.placementTries + 1) * (COLLISION_LIMITS.maxWallElements + n + 2) + steps * workPerStep(n) };
}

/** The cached snapshots of a construction, computing (or extending a shorter cached run) on a miss. */
export function collisionSnapshots(model: CollisionModel, seed: number, steps: number, options: CollisionRunOptions = {}): Snapshots<CollisionState, CollisionModel, CollisionFrame> {
  return cache.get(collisionSimulation, model, seed, runOptions(model, steps, options));
}
/** Cooperative variant: `null` when cancelled; nothing is cached then. */
export function prepareCollisionSnapshots(model: CollisionModel, seed: number, steps: number, options: CollisionRunOptions = {}): Promise<Snapshots<CollisionState, CollisionModel, CollisionFrame> | null> {
  return cache.prepare(collisionSimulation, model, seed, runOptions(model, steps, options));
}
export const hasCollisionSnapshots = (model: CollisionModel, seed: number, steps: number): boolean =>
  cache.has(collisionSimulation, model, seed, runOptions(model, steps, {}));

/* ------------------------------------------------------------------------------------- score */

export interface CollisionBody { readonly id: string; readonly serial: number; readonly radius: number; readonly mass: number; readonly bornAt: number; readonly seed: number }
/** A body's centre over time: vertices at every whole frame and at every contact, so bounces are exact corners. */
export interface CollisionTrail {
  readonly id: string; readonly body: string; readonly serial: number; readonly seed: number;
  readonly times: Float64Array; readonly xs: Float64Array; readonly ys: Float64Array;
}
export interface Contact {
  readonly id: string;
  readonly index: number;
  /** Two discs, or a disc against a wall element, a corner or a post. */
  readonly kind: "body" | "wall";
  /** Absolute time in frames, in `(0, steps]`. */
  readonly time: number;
  readonly a: string;
  /** The other body's id, or the wall element's id (`wall:n`, `corner:n`, `post:n`). */
  readonly b: string;
  readonly point: Point;
  /** Unit normal: from `a` to `b` for two discs, from the wall towards `a` otherwise. */
  readonly normal: Point;
  /** Normal impulse, mass × canvas units per frame. */
  readonly impulse: number;
  /** Approach speed along the normal before the contact, canvas units per frame. */
  readonly approach: number;
  readonly aIn: Point; readonly aOut: Point;
  readonly bIn: Point | null; readonly bOut: Point | null;
  readonly seed: number;
}
export interface CollisionScore {
  readonly key: string;
  readonly seed: number;
  readonly steps: number;
  readonly bodies: readonly CollisionBody[];
  readonly trails: readonly CollisionTrail[];
  /** Every contact, in log order. */
  readonly contacts: readonly Contact[];
  /** The largest impulse of any contact (0 for none). */
  readonly maxImpulse: number;
  readonly walls: WallSet;
}

const scores = new WeakMap<object, CollisionScore>();
const point = (x: number, y: number): Point => Object.freeze([x, y] as const);

/** The frozen score of some snapshots. The same snapshots give the same object. */
export function collisionScore(snaps: Snapshots<CollisionState, CollisionModel, CollisionFrame>): CollisionScore {
  const hit = scores.get(snaps);
  if (hit) return hit;
  const model = snaps.params as unknown as CollisionModel, walls = wallsOf(model);
  const bodies: CollisionBody[] = [];
  const times: number[][] = [], xs: number[][] = [], ys: number[][] = [];
  const contacts: Contact[] = [];
  const vertex = (serial: number, time: number, x: number, y: number) => {
    const t = times[serial], px = xs[serial], py = ys[serial], last = t.length - 1;
    if (last >= 0 && t[last] === time && Math.abs(px[last] - x) < 1e-9 && Math.abs(py[last] - y) < 1e-9) return;
    t.push(time); px.push(x); py.push(y);
  };
  let maxImpulse = 0;
  for (const entry of snaps.history) {
    const { positions, events } = entry.value;
    for (let o = 0; o < events.length; o += EVENT_STRIDE) {
      const kind = events[o + EVENT.kind], a = events[o + EVENT.a], time = events[o + EVENT.time];
      if (kind === KIND_EMIT) {
        bodies.push(Object.freeze({ id: `body:${a}`, serial: a, radius: events[o + EVENT.radius], mass: events[o + EVENT.mass], bornAt: time, seed: componentSeed(snaps.seed, `body:${a}`, "body") }));
        times[a] = []; xs[a] = []; ys[a] = [];
        vertex(a, time, events[o + EVENT.x], events[o + EVENT.y]);
        continue;
      }
      const px = events[o + EVENT.x], py = events[o + EVENT.y], nx = events[o + EVENT.nx], ny = events[o + EVENT.ny], ra = bodies[a].radius;
      const id = `contact:${contacts.length}`, impulse = events[o + EVENT.impulse];
      maxImpulse = Math.max(maxImpulse, impulse);
      let b: string, bIn: Point | null = null, bOut: Point | null = null;
      if (kind === KIND_PAIR) {
        const other = events[o + EVENT.b], rb = bodies[other].radius;
        const ax = px - nx * ra, ay = py - ny * ra;
        vertex(a, time, ax, ay); vertex(other, time, ax + nx * (ra + rb), ay + ny * (ra + rb));
        b = `body:${other}`;
        bIn = point(events[o + EVENT.bInX], events[o + EVENT.bInY]); bOut = point(events[o + EVENT.bOutX], events[o + EVENT.bOutY]);
      } else if (kind === KIND_WALL) {
        vertex(a, time, px + nx * ra, py + ny * ra);
        b = walls.ids[events[o + EVENT.b]];
      } else throw new Error(`Unknown record kind ${kind}`);
      contacts.push(Object.freeze({
        id, index: contacts.length, kind: kind === KIND_PAIR ? "body" : "wall", time, a: `body:${a}`, b, point: point(px, py), normal: point(nx, ny),
        impulse, approach: events[o + EVENT.approach], aIn: point(events[o + EVENT.aInX], events[o + EVENT.aInY]), aOut: point(events[o + EVENT.aOutX], events[o + EVENT.aOutY]),
        bIn, bOut, seed: componentSeed(snaps.seed, id, "contact"),
      }));
    }
    if (entry.step > 0) for (let i = 0; i < entry.value.born; i++) vertex(i, entry.step, positions[2 * i], positions[2 * i + 1]);
  }
  const trails = bodies.map((body): CollisionTrail => Object.freeze({
    id: `trail:${body.id}`, body: body.id, serial: body.serial, seed: componentSeed(snaps.seed, body.id, "trail"),
    times: Float64Array.from(times[body.serial]), xs: Float64Array.from(xs[body.serial]), ys: Float64Array.from(ys[body.serial]),
  }));
  const score: CollisionScore = Object.freeze({
    key: snaps.key, seed: snaps.seed, steps: snaps.steps, bodies: Object.freeze(bodies), trails: Object.freeze(trails),
    contacts: Object.freeze(contacts), maxImpulse, walls,
  });
  scores.set(snaps, score);
  return score;
}

/** Score of a construction (cached snapshots, then the score built once per snapshot object). */
export function collisionScoreOfModel(model: CollisionModel, seed: number, steps: number, options: CollisionRunOptions = {}): CollisionScore {
  return collisionScore(collisionSnapshots(model, seed, steps, options));
}
