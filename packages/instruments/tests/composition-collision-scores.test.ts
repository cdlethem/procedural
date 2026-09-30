import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT, EVENT_STRIDE, KIND_PAIR, KIND_WALL, REST_SPEED, buildWalls, bundledContainer, checkSimulation, collisionBarriers, collisionModel, collisionScore, collisionScoreOfRecipe, collisionScoresComposition,
  collisionScoresUsesSeed, collisionSimulation, collisionSnapshots, containerRings, createInstrument, definition, distanceToWalls, drawCollisionScores, finalState, hasCollisionSnapshots,
  insideContainer, inspectorItems, pairLaw, prepareCollisionSnapshots, prepareInstrument, solveFrame, stateAt, timeToReach, timeToSegment, usesSeed, visibleParameters, wallLaw,
  type CollisionModel, type CollisionScore, type CollisionScoresRecipe, type CollisionSetup, type CollisionState, type CompositionSurface, type ContactSite, type Path,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const ID = "collision-scores";
const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${note} ${actual} != ${expected}`);
type Params = Record<string, number | string | boolean>;

const box = (width = 400, height = 300) => bundledContainer({ shape: "rectangle", centerX: 320, centerY: 320, width, height, rotation: 0 });
/** One disc at (320, 320), launched at `heading` degrees at `speed`, in a 400 × 300 box unless overridden. Physics are elastic and gravity-free. */
interface SetupOverrides { container?: CollisionSetup["container"]; posts?: CollisionSetup["posts"]; bodies?: Partial<CollisionSetup["bodies"]>; emitter?: Partial<CollisionSetup["emitter"]>; physics?: Partial<CollisionSetup["physics"]> }
function setupOf(over: SetupOverrides = {}): CollisionSetup {
  return {
    container: over.container ?? box(), posts: over.posts ?? [],
    bodies: { count: 1, radius: 10, radiusSpread: 0, massLaw: "equal", ...over.bodies },
    emitter: { mode: "line", x: 320, y: 320, extent: 0, angle: 0, every: 0, heading: 0, headingSpread: 0, speed: 3, speedSpread: 0, ...over.emitter },
    physics: { restitution: 1, wallRestitution: 1, wallFriction: 0, gravity: 0, ...over.physics },
  };
}
const modelOf = (over: SetupOverrides = {}): CollisionModel => collisionModel(setupOf(over));
const scoreOf = (model: CollisionModel, steps: number, seed = 1): CollisionScore => collisionScore(collisionSnapshots(model, seed, steps));
const kinetic = (state: CollisionState): number => {
  let sum = 0;
  for (let i = 0; i < state.born; i++) sum += 0.5 * state.m[i] * (state.vx[i] ** 2 + state.vy[i] ** 2);
  return sum;
};
const inputOf = (params: Params = {}, seed = 42) => { const base = createInstrument(ID); return { ...base, seed, params: { ...base.params, ...params } }; };
const recipeOf = (params: Params = {}, seed = 42) => collisionScoresComposition(inputOf(params, seed));

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round"; calls = 0;
  push() {} pop() {} translate() {} rotate() {} scale() {} noFill() {} noStroke() {} fill() {} stroke() {} strokeCap() {} strokeWeight() {}
  circle() { this.calls++; } line() { this.calls++; } rect() {} beginShape() {} vertex() {} endShape() { this.calls++; }
}
interface Drawn { marks: ContactSite[]; trails: Path[]; rays: Path[]; edges: Path[]; nodes: number; discs: number }
function drawn(recipe: CollisionScoresRecipe): Drawn {
  const out: Drawn = { marks: [], trails: [], rays: [], edges: [], nodes: 0, discs: 0 };
  drawCollisionScores(new Recorder(), recipe, {
    mark: (_s, site) => out.marks.push(site), trail: (_s, path) => out.trails.push(path), ray: (_s, path) => out.rays.push(path), edge: (_s, path) => out.edges.push(path),
    node: () => { out.nodes++; }, disc: () => { out.discs++; },
  });
  return out;
}

/* ---------------------------------------------------------------------------------------- laws */

test("disc-disc law matches the closed forms: 1-D elastic exchange, perfectly inelastic sticking, momentum and energy", () => {
  // m1 = 1 moving at 2 into m2 = 3 at rest, normal along +x: v1' = (m1 - m2) v1 / (m1 + m2) = -1, v2' = 2 m1 v1 / (m1 + m2) = 1, J = 3.
  const elastic = pairLaw(1, 3, 2, 0, 0, 0, 1, 0, 1);
  assert.deepEqual([elastic.v1x, elastic.v1y, elastic.v2x, elastic.v2y], [-1, 0, 1, 0]);
  near(elastic.impulse, 3); near(elastic.approach, 2);
  // e = 0: both move at the centre-of-mass velocity m1 v1 / (m1 + m2) = 0.5; J = m1 m2 / (m1 + m2) · u = 1.5.
  const sticky = pairLaw(1, 3, 2, 0, 0, 0, 1, 0, 0);
  near(sticky.v1x, 0.5); near(sticky.v2x, 0.5); near(sticky.impulse, 1.5);
  // Oblique, e = 0.6: the tangential relative velocity is untouched, the normal one is reversed and scaled by e.
  const nx = 0.6, ny = 0.8, tx = -ny, ty = nx;
  const oblique = pairLaw(2, 5, 3, 1, -2, -4, nx, ny, 0.6);
  const before = [(3 + 2) * nx + (1 + 4) * ny, (3 + 2) * tx + (1 + 4) * ty], after = [(oblique.v1x - oblique.v2x) * nx + (oblique.v1y - oblique.v2y) * ny, (oblique.v1x - oblique.v2x) * tx + (oblique.v1y - oblique.v2y) * ty];
  near(after[0], -0.6 * before[0]); near(after[1], before[1]);
  near(2 * oblique.v1x + 5 * oblique.v2x, 2 * 3 + 5 * -2); near(2 * oblique.v1y + 5 * oblique.v2y, 2 * 1 + 5 * -4);
  // Receding discs are untouched.
  const apart = pairLaw(1, 1, -1, 0, 1, 0, 1, 0, 1);
  assert.equal(apart.impulse, 0); assert.deepEqual([apart.v1x, apart.v2x], [-1, 1]);
});

test("wall law: reflection angle, restitution, Coulomb friction, and the resting threshold that only lossy contacts use", () => {
  // Floor with inward normal (0, -1); the disc falls at (3, 4): approach 4, e = 0.5 -> normal speed 2, tangential untouched.
  const bounce = wallLaw(2, 3, 4, 0, -1, 0.5, 0);
  assert.deepEqual([bounce.vx, bounce.vy], [3, -2]);
  near(bounce.impulse, 2 * 1.5 * 4);
  // Friction removes min(mu (1 + e) u, |v_t|) = min(0.25 · 6, 3) = 1.5, and never reverses the slide.
  const rough = wallLaw(1, 3, 4, 0, -1, 0.5, 0.25);
  near(rough.vx, 1.5); near(rough.vy, -2);
  assert.equal(wallLaw(1, 3, 4, 0, -1, 0.5, 10).vx, 0);
  // Below REST_SPEED a lossy contact is perfectly inelastic; an elastic one keeps its exact reflection.
  const slow = REST_SPEED / 2;
  assert.deepEqual([wallLaw(1, 3, slow, 0, -1, 0.5, 0).vx, wallLaw(1, 3, slow, 0, -1, 0.5, 0).vy], [3, 0]);
  near(wallLaw(1, 3, slow, 0, -1, 1, 0).vy, -slow);
  // Incidence angle equals reflection angle for an arbitrary wall direction.
  const angle = 0.7, nx = -Math.sin(angle), ny = Math.cos(angle), v = [2, -5];
  const out = wallLaw(1, v[0], v[1], nx, ny, 1, 0);
  const dot = v[0] * nx + v[1] * ny;
  near(out.vx, v[0] - 2 * dot * nx); near(out.vy, v[1] - 2 * dot * ny);
  near(Math.hypot(out.vx, out.vy), Math.hypot(v[0], v[1]));
});

test("time of impact is exact: segments, rounds and disc pairs against closed forms, and only while approaching", () => {
  const walls = buildWalls([[[0, 0], [100, 0], [100, 100], [0, 100]]], []);
  // Right wall (edge 1, inward normal (-1, 0)): a disc of radius 5 at x = 20 moving at +4 reaches x = 95 after 18.75 frames.
  near(timeToSegment(walls, 1, 20, 50, 4, 0, 5, 100), 18.75);
  assert.equal(timeToSegment(walls, 1, 20, 50, 4, 0, 5, 18), Infinity, "beyond the limit");
  assert.equal(timeToSegment(walls, 1, 20, 50, -4, 0, 5, 100), Infinity, "moving away");
  assert.equal(timeToSegment(walls, 1, 20, 150, 4, 0, 5, 100), Infinity, "contact point outside the edge");
  // Two discs 30 apart closing at 2 each with radii 3 and 7: touch at distance 10 after (30 - 10) / 4 = 5.
  near(timeToReach(30, 0, -4, 0, 10, 100), 5);
  // Glancing miss: offset 12 with reach 10 never touches.
  assert.equal(timeToReach(30, 12, -4, 0, 10, 100), Infinity);
  // Offset 6 with reach 10: |(30 - 4t, 6)| = 10 -> 30 - 4t = 8, t = 5.5.
  near(timeToReach(30, 6, -4, 0, 10, 100), 5.5);
  // Already touching and approaching: immediate; touching and receding: none.
  assert.equal(timeToReach(10, 0, -1, 0, 10, 100), 0);
  assert.equal(timeToReach(10, 0, 1, 0, 10, 100), Infinity);
});

/* ---------------------------------------------------------------------------------------- the simulation against closed forms */

test("one disc in a box: every contact time, wall, point, normal and impulse equals the triangle-wave closed form, and the trail has an exact corner at each", () => {
  const speed = 3, heading = 31 * Math.PI / 180, v = [speed * Math.cos(heading), speed * Math.sin(heading)];
  const steps = 1500, score = scoreOf(modelOf({ emitter: { heading: 31, speed } }), steps);
  // Independent reference: reflect each axis between the walls (centre limits 130..510 and 180..460).
  const limits = [[130, 510], [180, 460]];
  const events: { time: number; axis: number }[] = [];
  for (let axis = 0; axis < 2; axis++) {
    const [lo, hi] = limits[axis], along = v[axis];
    for (let time = ((along > 0 ? hi : lo) - 320) / along; time <= steps; time += (hi - lo) / Math.abs(along)) events.push({ time, axis });
  }
  events.sort((a, b) => a.time - b.time);
  assert.ok(events.length >= 8 && score.contacts.length === events.length, `${score.contacts.length} contacts, ${events.length} expected`);
  const velocity = [v[0], v[1]];
  events.forEach((e, i) => {
    const contact = score.contacts[i];
    near(contact.time, e.time, 1e-9, `contact ${i} time`);
    assert.equal(contact.kind, "wall");
    // Wall normal is opposite to the velocity component that is reflected.
    const inward = -Math.sign(velocity[e.axis]);
    assert.equal(contact.normal[e.axis], inward); near(contact.normal[1 - e.axis], 0);
    near(contact.impulse, 2 * Math.abs(velocity[e.axis]), 1e-12);
    near(contact.approach, Math.abs(velocity[e.axis]), 1e-12);
    velocity[e.axis] = -velocity[e.axis];
    assert.deepEqual([contact.aOut[0], contact.aOut[1]], [velocity[0], velocity[1]]);
    // The contact point lies on the wall (x = 520 or 120, y = 470 or 170) and at the disc's position at that time.
    const wallCoordinate = e.axis === 0 ? (inward < 0 ? 520 : 120) : (inward < 0 ? 470 : 170);
    near(contact.point[e.axis], wallCoordinate, 1e-9);
  });
  // Trail: one vertex per whole frame plus one per contact plus the birth, every segment at the constant speed.
  const trail = score.trails[0];
  assert.equal(trail.times.length, 1 + steps + score.contacts.length);
  for (let i = 1; i < trail.times.length; i++) near(Math.hypot(trail.xs[i] - trail.xs[i - 1], trail.ys[i] - trail.ys[i - 1]) / (trail.times[i] - trail.times[i - 1]), speed, 1e-9, `segment ${i}`);
  // Every contact vertex is the disc centre at the wall, one radius inside.
  score.contacts.forEach((contact) => {
    const j = trail.times.indexOf(contact.time);
    near(trail.xs[j] - contact.point[0], contact.normal[0] * 10, 1e-9); near(trail.ys[j] - contact.point[1], contact.normal[1] * 10, 1e-9);
  });
});

test("equal discs meeting head-on swap velocities at the analytic time and point, with the analytic impulse", () => {
  // Ring of 2 discs (radius 10) at x = 420 and 220 on y = 320, each launched inward at 3: they touch at |Δx| = 20 after 30 frames.
  const score = scoreOf(modelOf({ container: box(600, 400), bodies: { count: 2 }, emitter: { mode: "ring", extent: 200, heading: 180, speed: 3 } }), 40);
  const first = score.contacts[0];
  assert.equal(first.kind, "body");
  near(first.time, 30); near(first.point[0], 320); near(first.point[1], 320, 1e-9);
  assert.deepEqual([first.a, first.b], ["body:0", "body:1"]);
  near(first.normal[0], -1); near(first.normal[1], 0, 1e-12);
  near(first.impulse, 6); near(first.approach, 6);
  assert.deepEqual([first.aIn[0], first.aOut[0], first.bIn![0], first.bOut![0]].map((x) => Math.round(x * 1e9) / 1e9), [-3, 3, 3, -3]);
});

test("a run in a scatter obeys the conservation laws read from its own log: momentum and energy at every disc contact, energy overall, unequal masses included", () => {
  for (const massLaw of ["equal", "area"] as const) {
    const model = modelOf({ bodies: { count: 20, radius: 9, radiusSpread: massLaw === "area" ? 0.5 : 0, massLaw }, emitter: { mode: "scatter", speed: 4, speedSpread: 0.4, headingSpread: 180 }, container: box(360, 300) });
    const snaps = collisionSnapshots(model, 5, 500), score = collisionScore(snaps);
    const pairs = score.contacts.filter((contact) => contact.kind === "body");
    assert.ok(pairs.length > 40, `${pairs.length} disc contacts`);
    for (const c of pairs) {
      const ma = score.bodies[Number(c.a.slice(5))].mass, mb = score.bodies[Number(c.b.slice(5))].mass;
      near(ma * (c.aOut[0] - c.aIn[0]) + mb * (c.bOut![0] - c.bIn![0]), 0, 1e-9); near(ma * (c.aOut[1] - c.aIn[1]) + mb * (c.bOut![1] - c.bIn![1]), 0, 1e-9);
      near(ma * (c.aOut[0] ** 2 + c.aOut[1] ** 2) + mb * (c.bOut![0] ** 2 + c.bOut![1] ** 2), ma * (c.aIn[0] ** 2 + c.aIn[1] ** 2) + mb * (c.bIn![0] ** 2 + c.bIn![1] ** 2), 1e-9);
      const [nx, ny] = c.normal, tx = -ny, ty = nx;
      near((c.aOut[0] - c.bOut![0]) * nx + (c.aOut[1] - c.bOut![1]) * ny, -((c.aIn[0] - c.bIn![0]) * nx + (c.aIn[1] - c.bIn![1]) * ny), 1e-9);
      near((c.aOut[0] - c.bOut![0]) * tx + (c.aOut[1] - c.bOut![1]) * ty, (c.aIn[0] - c.bIn![0]) * tx + (c.aIn[1] - c.bIn![1]) * ty, 1e-9);
    }
    near(kinetic(finalState(snaps)), kinetic(stateAt(snaps, 0)), 1e-9);
  }
});

test("under gravity a released disc follows y0 + g k (k + 1) / 2 (one kick per step), and a lossy disc settles on the floor in a finite log", () => {
  const drop = { emitter: { speed: 0, x: 320, y: 200 }, physics: { gravity: 0.01 } };
  const snaps = collisionSnapshots(modelOf({ container: box(300, 600), ...drop }), 1, 60);
  for (const k of [1, 10, 50]) near(stateAt(snaps, k).y[0], 200 + 0.01 * k * (k + 1) / 2, 1e-12);
  const lossy = collisionSnapshots(modelOf({ container: box(300, 400), emitter: { speed: 0, x: 320, y: 200 }, physics: { gravity: 0.05, wallRestitution: 0.5 } }), 1, 600);
  const rest = finalState(lossy), floor = 520 - 10;
  near(rest.y[0], floor, 1e-9); assert.equal(rest.vy[0], 0);
  const score = collisionScore(lossy);
  assert.ok(score.contacts.length > 3 && score.contacts.length < 20, `${score.contacts.length} contacts: the resting frames are not logged`);
  assert.ok(score.contacts.every((contact) => contact.approach > 0.1), "only contacts faster than twice the gravity kick are recorded");
  // Each bounce keeps half of the approach speed, so successive approach speeds shrink geometrically until the threshold ends the bouncing.
  const heights = score.contacts.map((contact) => contact.approach);
  for (let i = 1; i < heights.length - 1; i++) assert.ok(heights[i] <= heights[i - 1] * 1.0000001 || heights[i] < 0.2);
});

test("a disc aimed at a reflex corner is reflected about the corner's normal, not a wall's", () => {
  const container = bundledContainer({ shape: "l-room", centerX: 320, centerY: 320, width: 400, height: 400, rotation: 0 });
  // The L's inner corner is (320, 320); the disc rises at x = 316, so it meets the corner point after (380 - 316 ... ) frames.
  const model = modelOf({ container, emitter: { x: 316, y: 380, heading: -90, speed: 3 } });
  const score = scoreOf(model, 40);
  const hit = score.contacts[0];
  assert.match(hit.b, /^corner:/);
  const distanceY = Math.sqrt(100 - 16); // the disc centre is 10 from the corner when 4 to its left and 9.165 below
  near(hit.time, (380 - (320 + distanceY)) / 3, 1e-9);
  near(hit.normal[0], -4 / 10, 1e-9); near(hit.normal[1], distanceY / 10, 1e-9);
  near(hit.point[0], 320, 1e-9); near(hit.point[1], 320, 1e-9);
  const dot = 0 * hit.normal[0] + -3 * hit.normal[1];
  near(hit.aOut[0], -2 * dot * hit.normal[0], 1e-9); near(hit.aOut[1], -3 - 2 * dot * hit.normal[1], 1e-9);
});

test("simultaneous contacts are resolved in the stated order: walls before discs, then by serial, whatever the geometry", () => {
  // Four discs leave the centre of a square room at once and reach four walls at the same instant.
  const score = scoreOf(modelOf({ container: box(300, 300), bodies: { count: 4 }, emitter: { mode: "ring", extent: 60, heading: 0, speed: 5 } }), 40);
  const walls = score.contacts.filter((contact) => contact.kind === "wall").slice(0, 4);
  assert.deepEqual(walls.map((contact) => contact.a), ["body:0", "body:1", "body:2", "body:3"]);
  for (const contact of walls) near(contact.time, walls[0].time, 1e-9);
  // Two disjoint head-on pairs meet at the same instant; the record order follows serial numbers, not where the pairs are.
  const room = buildWalls([[[0, 0], [200, 0], [200, 100], [0, 100]]], []);
  const run = (leftIsLow: boolean) => {
    const at = leftIsLow ? [40, 60, 140, 160] : [140, 160, 40, 60], velocity = [10, -10, 10, -10];
    const bodies = { count: 4, x: Float64Array.from(at), y: Float64Array.from([50, 50, 50, 50]), vx: Float64Array.from(velocity), vy: new Float64Array(4), r: Float64Array.from([5, 5, 5, 5]), m: Float64Array.from([1, 1, 1, 1]) };
    // Discs 0 and 1 (and 2 and 3) start 20 apart with radius 5 and close at 20 per frame: they touch after half a frame.
    const out: number[] = [];
    solveFrame(bodies, room, { restitution: 1, wallRestitution: 1, wallFriction: 0, gravity: 0 }, 0, out, { maxEvents: 20, charge() {}, overflow: (n) => `${n}` });
    return Array.from({ length: out.length / EVENT_STRIDE }, (_, i) => [out[i * EVENT_STRIDE + EVENT.a], out[i * EVENT_STRIDE + EVENT.b], out[i * EVENT_STRIDE + EVENT.kind]]).filter((r) => r[2] === KIND_PAIR);
  };
  assert.deepEqual(run(true).map((r) => [r[0], r[1]]), [[0, 1], [2, 3]]);
  // Swapping the positions of the two pairs changes who is where, but the earlier serials still go first.
  assert.deepEqual(run(false).map((r) => [r[0], r[1]]), [[0, 1], [2, 3]]);
});

test("a wall contact and a disc contact at one instant: the wall is resolved first, and the outcome is the sequential one", () => {
  const room = buildWalls([[[0, 0], [100, 0], [100, 100], [0, 100]]], []);
  // Disc 0 (x = 10, v = -5) reaches the left wall at t = 1; disc 1 (x = 25, v = -10) reaches disc 0 at t = 1 as well (centres 10 apart).
  const bodies = { count: 2, x: Float64Array.of(10, 25), y: Float64Array.of(50, 50), vx: Float64Array.of(-5, -10), vy: new Float64Array(2), r: Float64Array.of(5, 5), m: Float64Array.of(1, 1) };
  const out: number[] = [];
  solveFrame(bodies, room, { restitution: 1, wallRestitution: 1, wallFriction: 0, gravity: 0 }, 0, out, { maxEvents: 20, charge() {}, overflow: (n) => `${n}` });
  const kinds = Array.from({ length: out.length / EVENT_STRIDE }, (_, i) => out[i * EVENT_STRIDE + EVENT.kind]);
  assert.deepEqual(kinds.slice(0, 2), [KIND_WALL, KIND_PAIR]);
  near(out[EVENT.time], 1); near(out[EVENT_STRIDE + EVENT.time], 1);
  // Wall first: disc 0 turns to +5, then the equal discs swap (+5 vs -10): disc 0 leaves at -10, disc 1 at +5.
  near(out[EVENT_STRIDE + EVENT.aOutX], -10); near(out[EVENT_STRIDE + EVENT.bOutX], 5);
});

test("no tunnelling: a fast disc never crosses a thin slat, a post or a wall at any recorded position", () => {
  const room = collisionBarriers(box(300, 300), "slats", 3, 120, 0, 12, { mode: "scatter", x: 0, y: 0, extent: 0, angle: 0 });
  const model = collisionModel({ ...setupOf({ container: room.container, bodies: { count: 10, radius: 3 }, emitter: { mode: "scatter", speed: 39, headingSpread: 180 } }), posts: [[300, 300, 6], [340, 250, 4]] });
  const score = scoreOf(model, 300, 9), walls = score.walls;
  const all = Array.from({ length: walls.segmentCount + walls.roundCount }, (_, i) => i);
  assert.ok(score.contacts.length > 300);
  for (const trail of score.trails) for (let i = 0; i < trail.times.length; i++) {
    assert.ok(insideContainer(walls, trail.xs[i], trail.ys[i]), `centre inside at ${trail.id} vertex ${i}`);
    assert.ok(distanceToWalls(walls, trail.xs[i], trail.ys[i], all) >= 3 - 1e-6, `clear of every wall element at ${trail.id} vertex ${i}`);
  }
});

/* ---------------------------------------------------------------------------------------- emitters, ids, seeds */

test("a nozzle births bodies on its schedule with birth-counter ids, and a blocked nozzle simply waits: no growth, no error", () => {
  const score = scoreOf(modelOf({ bodies: { count: 5 }, emitter: { mode: "nozzle", every: 4, speed: 8, x: 200, y: 320 } }), 40);
  assert.deepEqual(score.bodies.map((body) => body.id), ["body:0", "body:1", "body:2", "body:3", "body:4"]);
  assert.deepEqual(score.bodies.map((body) => body.bornAt), [0, 3, 7, 11, 15]);
  const stuck = scoreOf(modelOf({ bodies: { count: 5 }, emitter: { mode: "nozzle", every: 4, speed: 0, x: 200, y: 320 } }), 60);
  assert.equal(stuck.bodies.length, 1, "the first disc sits on the nozzle for ever, so nothing else can be born");
  assert.equal(stuck.contacts.length, 0);
});

test("element independence: adding bodies never moves earlier ones; seeds change scatter, and an unused seed is not part of the construction", () => {
  const scatter = (count: number) => modelOf({ bodies: { count, radiusSpread: 0.4 }, emitter: { mode: "scatter", speed: 3, headingSpread: 180, speedSpread: 0.3 }, container: box(500, 400) });
  const small = stateAt(collisionSnapshots(scatter(6), 77, 0), 0), large = stateAt(collisionSnapshots(scatter(9), 77, 0), 0);
  for (let i = 0; i < 6; i++) for (const field of ["x", "y", "vx", "vy", "r"] as const) assert.equal(small[field][i], large[field][i], `${field}[${i}]`);
  assert.ok(new Set(Array.from(small.r.slice(0, 6))).size === 6, "each disc draws its own radius");
  assert.notDeepEqual(Array.from(stateAt(collisionSnapshots(scatter(6), 78, 0), 0).x), Array.from(small.x));
  assert.equal(collisionScoresUsesSeed({ emitter: "nozzle", radiusSpread: 0, speed: 3, headingSpread: 0, speedSpread: 0 }), false);
  assert.equal(usesSeed(inputOf({ emitter: "nozzle", radiusSpread: 0, headingSpread: 0, speedSpread: 0 })), false);
  assert.equal(usesSeed(inputOf({ emitter: "scatter" })), true);
  const first = collisionScoreOfRecipe(recipeOf({ radiusSpread: 0, headingSpread: 0, speedSpread: 0 }, 1)), second = collisionScoreOfRecipe(recipeOf({ radiusSpread: 0, headingSpread: 0, speedSpread: 0 }, 999));
  assert.equal(first, second, "an unused seed shares the snapshot");
});

test("the collision log is a prefix: more steps only append contacts, bodies and trail vertices with the same ids and values", () => {
  const model = modelOf({ bodies: { count: 12, radiusSpread: 0.3, massLaw: "area" }, emitter: { mode: "nozzle", every: 3, speed: 5, headingSpread: 60, speedSpread: 0.2, x: 200, y: 320 } });
  const short = scoreOf(model, 90, 3), long = scoreOf(model, 180, 3);
  assert.ok(short.contacts.length > 10 && long.contacts.length > short.contacts.length);
  assert.deepEqual(long.contacts.slice(0, short.contacts.length), short.contacts);
  assert.deepEqual(long.bodies.slice(0, short.bodies.length), short.bodies);
  for (const trail of short.trails) {
    const longer = long.trails[trail.serial], n = trail.times.length - 1;
    assert.deepEqual(Array.from(longer.xs.slice(0, n)), Array.from(trail.xs.slice(0, n)));
  }
});

/* ---------------------------------------------------------------------------------------- stateful contract */

test("the stateful guarantees hold for three different constructions (replay, prefix, checkpoints, resume, cancellation-free reruns)", () => {
  const cases: CollisionModel[] = [
    modelOf({ bodies: { count: 14, radiusSpread: 0.4, massLaw: "area" }, emitter: { mode: "scatter", speed: 4, headingSpread: 180, speedSpread: 0.2 } }),
    modelOf({ bodies: { count: 8 }, emitter: { mode: "nozzle", every: 2, speed: 5, headingSpread: 50, x: 200, y: 320 }, physics: { gravity: 0.03, restitution: 0.8, wallRestitution: 0.7, wallFriction: 0.3 } }),
    collisionModel({ ...setupOf({ container: bundledContainer({ shape: "island", centerX: 320, centerY: 320, width: 500, height: 400, rotation: 0 }), bodies: { count: 10, radius: 8 }, emitter: { mode: "ring", extent: 60, x: 320, y: 175, heading: 30, headingSpread: 90, speed: 4 } }), posts: [[420, 200, 12]] }),
  ];
  for (const [index, model] of cases.entries()) checkSimulation(collisionSimulation, model, 11 + index, 60);
});

test("appearance edits repaint the same snapshot and score; initial-condition edits recompute; steps extend", () => {
  const base = recipeOf({}, 5);
  const snap = collisionScoreOfRecipe(base);
  const appearance: Params = { colorBy: "time", window: 50, trails: "beads", markKind: "arrow", rays: "both", graph: false, bodies: "filled", contacts: "walls", minImpulse: 0.3, floor: 0.7, outline: false, markSize: 40 };
  const repainted = { ...recipeOf(appearance, 5), palette: [0x111111, 0x222222, 0x333333] };
  assert.equal(collisionScoreOfRecipe(repainted), snap, "same score object");
  assert.equal(collisionScoreOfRecipe(recipeOf({ steps: 200 }, 5)), snap);
  for (const change of [{ heading: 3 }, { speed: 4.1 }, { emitterX: 160 }, { restitution: 0.9 }, { gravity: 0.01 }, { radius: 12 }, { container: "diamond" }, { barriers: "pins" }, { count: 17 }]) {
    const other = collisionScoreOfRecipe(recipeOf(change, 5));
    assert.notEqual(other, snap, JSON.stringify(change));
    assert.notEqual(other.key, snap.key);
  }
  assert.notEqual(collisionScoreOfRecipe(recipeOf({}, 6)), snap, "the default seed matters (spreads are on)");
  const longer = collisionScoreOfRecipe(recipeOf({ steps: 260 }, 5));
  assert.equal(longer.steps, 260);
  assert.deepEqual(longer.contacts.slice(0, snap.contacts.length), snap.contacts);
});

test("changing one launch heading by a degree changes the score: different contacts, times and points", () => {
  const a = scoreOf(modelOf({ bodies: { count: 3 }, emitter: { mode: "nozzle", every: 5, x: 200, y: 320, speed: 5, heading: 20 } }), 200);
  const b = scoreOf(modelOf({ bodies: { count: 3 }, emitter: { mode: "nozzle", every: 5, x: 200, y: 320, speed: 5, heading: 21 } }), 200);
  assert.notEqual(a.key, b.key);
  assert.ok(a.contacts.length > 4);
  assert.notDeepEqual(a.contacts.slice(0, 6).map((c) => c.point), b.contacts.slice(0, 6).map((c) => c.point));
});

test("cancelled preparation caches nothing; a completed one is the cached result the drawing then reuses", async () => {
  const model = modelOf({ bodies: { count: 10 }, emitter: { mode: "scatter", speed: 4, headingSpread: 180 } });
  let polls = 0;
  const cancelled = await prepareCollisionSnapshots(model, 314, 400, { cancelled: () => ++polls > 25 });
  assert.equal(cancelled, null);
  assert.equal(hasCollisionSnapshots(model, 314, 400), false);
  const done = await prepareCollisionSnapshots(model, 314, 400);
  assert.ok(done && hasCollisionSnapshots(model, 314, 400));
  assert.equal(collisionSnapshots(model, 314, 400), done);
  // Through the public preparation contract: cancelled false, complete true, nothing left half-built.
  const input = inputOf({ steps: 300, count: 12, emitter: "scatter" }, 2718);
  let more = 0;
  assert.equal(await prepareInstrument(input, () => ++more > 20), false);
  assert.equal(await prepareInstrument(input, () => false), true);
  const before = collisionScoreOfRecipe(collisionScoresComposition(input));
  assert.equal(collisionScoreOfRecipe(collisionScoresComposition({ ...input, palette: [1, 2, 3] })), before);
});

test("the bounds throw, naming the control to change", () => {
  assert.throws(() => modelOf({ bodies: { count: 200 } }), /Bodies/);
  assert.throws(() => collisionSnapshots(modelOf(), 1, 4000), /Steps/);
  assert.throws(() => modelOf({ bodies: { radius: 200 } }), /Radius/);
  assert.throws(() => collisionSnapshots(modelOf({ container: box(120, 120), bodies: { count: 60, radius: 12 }, emitter: { mode: "scatter" } }), 1, 1), /Bodies or Radius/);
  assert.throws(() => collisionSnapshots(modelOf({ emitter: { mode: "nozzle", x: 2000, y: 320, every: 3 } }), 1, 1), /Emitter X\/Y/);
  assert.throws(() => collisionSnapshots(modelOf({ bodies: { count: 5 }, emitter: { mode: "ring", extent: 20 } }), 1, 1), /does not fit on the ring emitter/);
  // A crowd in a small room reaches a per-frame or whole-log bound and says so, instead of truncating.
  assert.throws(() => collisionSnapshots(modelOf({ container: box(150, 150), bodies: { count: 60, radius: 6 }, emitter: { mode: "scatter", speed: 30, headingSpread: 180 } }), 1, 3000), /Bodies|Steps|Speed|Radius/);
  // The solver itself refuses a frame with more contacts than its limit.
  const room = buildWalls([[[0, 0], [100, 0], [100, 100], [0, 100]]], []);
  const bodies = { count: 1, x: Float64Array.of(50), y: Float64Array.of(50), vx: Float64Array.of(200), vy: Float64Array.of(190), r: Float64Array.of(3), m: Float64Array.of(1) };
  assert.throws(() => solveFrame(bodies, room, { restitution: 1, wallRestitution: 1, wallFriction: 0, gravity: 0 }, 0, [], { maxEvents: 1, charge() {}, overflow: (n) => `too many (${n}); lower Speed` }), /lower Speed/);
});

/* ---------------------------------------------------------------------------------------- containers and barriers */

test("containers: inward normals, reflex corners are exactly the corners that poke into the room, barriers cut exact areas and keep the emitter clear", () => {
  const spec = (shape: "rectangle" | "ellipse" | "diamond" | "l-room" | "island") => ({ shape, centerX: 300, centerY: 310, width: 400, height: 300, rotation: 17 });
  const corners: Record<string, number> = { rectangle: 0, ellipse: 0, diamond: 0, "l-room": 1, island: 4 };
  for (const shape of (["rectangle", "ellipse", "diamond", "l-room", "island"] as const)) {
    const domain = bundledContainer(spec(shape));
    const walls = buildWalls(containerRings(domain), []);
    assert.equal(walls.roundCount, corners[shape], shape);
    // A point just inside every edge midpoint (along the inward normal) is inside; just outside is not.
    for (let s = 0; s < walls.segmentCount; s++) {
      const g = walls.segments, o = s * 7, mx = (g[o] + g[o + 2]) / 2, my = (g[o + 1] + g[o + 3]) / 2;
      assert.ok(insideContainer(walls, mx + g[o + 4] * 0.01, my + g[o + 5] * 0.01), `${shape} edge ${s} normal points into the room`);
      assert.ok(!insideContainer(walls, mx - g[o + 4] * 0.01, my - g[o + 5] * 0.01), `${shape} edge ${s} outside`);
    }
  }
  // Area: rectangle 400 × 300; the L is three quarters; the island removes a diamond of half-diagonals a/2.4 and b/2.4.
  near(bundledContainer(spec("rectangle")).area, 120000, 1e-9);
  near(bundledContainer(spec("l-room")).area, 90000, 1e-9);
  near(bundledContainer(spec("island")).area, 120000 - 2 * (400 / 2.4 / 2) * (300 / 2.4 / 2), 1e-9);
  // Two 100 × 6 slats at zero tilt inside the room each remove 600.
  const slatted = collisionBarriers(bundledContainer({ ...spec("rectangle"), rotation: 0 }), "slats", 2, 100, 0, 12, { mode: "scatter", x: 0, y: 0, extent: 0, angle: 0 });
  near(slatted.container.area, 120000 - 2 * 600, 1e-9);
  // Pins: every pin is inside with `room` to spare and none sits on the nozzle.
  const pinned = collisionBarriers(bundledContainer({ ...spec("ellipse"), rotation: 0 }), "pins", 5, 9, 0, 30, { mode: "nozzle", x: 220, y: 310, extent: 0, angle: 0 });
  const pinWalls = buildWalls(containerRings(pinned.container), []);
  assert.ok(pinned.posts.length >= 8);
  const wallElements = Array.from({ length: pinWalls.segmentCount }, (_, i) => i);
  for (const [x, y, r] of pinned.posts) {
    assert.ok(insideContainer(pinWalls, x, y));
    assert.ok(distanceToWalls(pinWalls, x, y, wallElements) >= r + 30 - 1e-9);
    assert.ok(Math.hypot(x - 220, y - 310) >= r + 30 - 1e-9);
  }
});

/* ---------------------------------------------------------------------------------------- treatments read one log */

test("every treatment reads the same log: marks, rays, graph, trails and discs equal what an independent filter of the contacts predicts", () => {
  const params: Params = { steps: 240, count: 14, window: 150, minImpulse: 0.2, floor: 0.35, contacts: "all", markKind: "rings", rays: "both", graph: true, colorBy: "kind", bodies: "filled", trails: "ink" };
  const recipe = recipeOf(params, 8), score = collisionScoreOfRecipe(recipe), out = drawn(recipe);
  const t0 = 240 - 150, floorImpulse = 0.2 * score.maxImpulse;
  const shown = score.contacts.filter((contact) => contact.time > t0 && contact.impulse >= floorImpulse);
  assert.ok(shown.length > 10 && shown.length < score.contacts.length);
  assert.deepEqual(out.marks.map((site) => site.id), shown.map((contact) => contact.id));
  for (const site of out.marks) {
    near(site.scale, 0.35 + 0.65 * Math.sqrt(site.contact.impulse / score.maxImpulse), 1e-12);
    assert.equal(site.tone, site.contact.kind === "body" ? 1 : 2);
    assert.deepEqual([site.position[0], site.position[1]], [site.contact.point[0], site.contact.point[1]]);
    near(site.angle, Math.atan2(site.contact.normal[1], site.contact.normal[0]), 1e-12);
  }
  // Rays: reflected + arrived-from, for each disc of each shown contact, of length rayLength × the same size factor.
  assert.equal(out.rays.length, shown.reduce((sum, contact) => sum + (contact.kind === "body" ? 4 : 2), 0));
  const contact = shown.find((c) => c.kind === "body")!, ray = out.rays.find((path) => path.id === `${contact.id}/a-out`)!;
  const length = 28 * (0.35 + 0.65 * Math.sqrt(contact.impulse / score.maxImpulse)), speed = Math.hypot(contact.aOut[0], contact.aOut[1]);
  near(ray.points[1][0], contact.point[0] + contact.aOut[0] / speed * length, 1e-9); near(ray.points[1][1], contact.point[1] + contact.aOut[1] / speed * length, 1e-9);
  const arrived = out.rays.find((path) => path.id === `${contact.id}/a-in`)!, inSpeed = Math.hypot(contact.aIn[0], contact.aIn[1]);
  near(arrived.points[1][0], contact.point[0] - contact.aIn[0] / inSpeed * length, 1e-9);
  // Graph: one edge per unordered pair of discs among the shown disc contacts.
  const pairs = new Set(shown.filter((c) => c.kind === "body").map((c) => `pair:${Math.min(Number(c.a.slice(5)), Number(c.b.slice(5)))}:${Math.max(Number(c.a.slice(5)), Number(c.b.slice(5)))}`));
  assert.deepEqual(new Set(out.edges.map((path) => path.id)), pairs);
  assert.equal(out.nodes, new Set(shown.filter((c) => c.kind === "body").flatMap((c) => [c.a, c.b])).size);
  assert.equal(out.discs, score.bodies.length);
  // Trails start exactly on the window edge, at the disc's true position then.
  const start = stateAt(collisionSnapshots(collisionModel(recipe.setup), 8, 240), t0);
  for (const path of out.trails) {
    const serial = Number(path.id.split(":")[2]);
    if (score.bodies[serial].bornAt <= t0) { near(path.points[0][0], start.x[serial], 1e-9); near(path.points[0][1], start.y[serial], 1e-9); }
  }
  // Scope: wall contacts only leaves disc contacts out of marks and rays but keeps the graph.
  const walls = drawn(recipeOf({ ...params, contacts: "walls" }, 8));
  assert.ok(walls.marks.length > 0 && walls.marks.every((site) => site.contact.kind === "wall"));
  assert.equal(walls.edges.length, out.edges.length);
});

test("colour by time cuts each trail into palette-many bands that meet exactly; colour by body tones follow serials", () => {
  const time = drawn({ ...recipeOf({ colorBy: "time", count: 6, steps: 120, window: 0 }, 3), palette: [1, 2, 3, 4] });
  const first = time.trails.filter((path) => path.id.startsWith("trail:body:0#"));
  assert.equal(first.length, 4);
  assert.deepEqual(first.map((path) => path.tone), [0, 1, 2, 3]);
  for (let i = 1; i < first.length; i++) assert.deepEqual(first[i].points[0], first[i - 1].points[first[i - 1].points.length - 1]);
  const body = drawn(recipeOf({ colorBy: "body", count: 6, steps: 60 }, 3));
  assert.deepEqual(body.trails.map((path) => path.tone), body.trails.map((path) => Number(path.id.split(":")[2])));
});

test("hidden controls never change the drawing (random configurations, every hidden control changed)", () => {
  const item = definition(ID);
  let state = 20260929;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const drivers = item.parameters.filter((parameter) => parameter.type === "select" || parameter.type === "boolean");
  let checked = 0;
  const failures: string[] = [];
  for (let attempt = 0; attempt < 36; attempt++) {
    const params: Params = { ...item.defaults, steps: 40 + Math.floor(random() * 40), count: 4 + Math.floor(random() * 6) };
    for (const driver of drivers) {
      const pool = driver.type === "boolean" ? [false, true] : driver.options!.map((option) => option.value);
      params[driver.key] = pool[Math.floor(random() * pool.length)];
    }
    if (params.barriers === "slats") params.barrierSize = 40;
    params.trails = attempt % 5 === 0 ? "bristle" : params.trails;
    params.brushWidth = 6;
    const shown = new Set(visibleParameters(ID, params).map((parameter) => parameter.key));
    let base: string;
    try { base = drawFingerprint({ ...createInstrument(ID), params }); } catch { continue; }
    for (const parameter of item.parameters.filter((entry) => !shown.has(entry.key))) {
      let value: number | string | boolean;
      if (parameter.type === "boolean") value = !params[parameter.key];
      else if (parameter.type === "select") {
        const others = parameter.options!.map((option) => option.value).filter((option) => option !== params[parameter.key]);
        value = others[Math.floor(random() * others.length)];
      } else {
        value = parameter.min! + (parameter.max! - parameter.min!) * (0.1 + 0.8 * random());
        value = parameter.integer ? Math.round(value) : Math.round(value * 100) / 100;
        if (value === params[parameter.key]) continue;
      }
      let changed: string;
      try { changed = drawFingerprint({ ...createInstrument(ID), params: { ...params, [parameter.key]: value } }); }
      catch (error) { failures.push(`${parameter.key}=${String(value)} throws ${(error as Error).message}`); continue; }
      checked++;
      if (changed !== base) failures.push(`${parameter.key} (=${String(value)}) changed the drawing under ${JSON.stringify(Object.fromEntries(drivers.map((d) => [d.key, params[d.key]])))}`);
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(checked > 150, `only ${checked} hidden changes exercised`);
});

test("controls: groups, proportional clusters and dependencies are as authored; slider intervals sit inside hard limits", () => {
  const items = inspectorItems(ID, createInstrument(ID).params);
  assert.deepEqual(items.map((entry) => entry.label), ["Container", "Placement", "Bodies", "Emitter", "Collisions", "Time", "Contacts", "Drawing"]);
  const keys = (params: Params) => new Set(visibleParameters(ID, { ...createInstrument(ID).params, ...params }).map((parameter) => parameter.key));
  assert.ok(!keys({ emitter: "scatter" }).has("emitterX") && keys({ emitter: "nozzle" }).has("emitEvery") && !keys({ emitter: "ring" }).has("emitEvery") && keys({ emitter: "line" }).has("emitterAngle"));
  assert.ok(!keys({ barriers: "none" }).has("barrierSize") && keys({ barriers: "slats" }).has("barrierAngle") && !keys({ barriers: "pins" }).has("barrierAngle"));
  assert.ok(!keys({ markKind: "none" }).has("markSize") && keys({ markKind: "rosette" }).has("markPetals") && !keys({ markKind: "dot" }).has("markWeight"));
  assert.ok(!keys({ trails: "ink" }).has("trailSpacing") && keys({ trails: "beads" }).has("trailBead") && !keys({ trails: "beads" }).has("trailWeight") && keys({ trails: "bristle" }).has("brushWidth"));
  for (const parameter of definition(ID).parameters) if (parameter.type === "number") {
    assert.ok(parameter.hardMin! <= parameter.min! && parameter.hardMax! >= parameter.max!, `${parameter.key} slider inside hard limits`);
    const value = createInstrument(ID).params[parameter.key] as number;
    assert.ok(value >= parameter.min! && value <= parameter.max!, `${parameter.key} default on the slider`);
  }
});

test("defaults draw, and the authored default shows every treatment", () => {
  const out = drawn(recipeOf());
  assert.ok(out.trails.length >= 10 && out.marks.length > 20 && out.rays.length > 20 && out.edges.length > 3 && out.discs >= 10 && out.nodes >= 4);
  assert.ok(definition(ID).controlGroups.length === 8);
  const surface = new Recorder();
  drawCollisionScores(surface, recipeOf());
  assert.ok(surface.calls > 100);
});
