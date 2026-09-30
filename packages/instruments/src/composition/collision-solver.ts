/**
 * The Collision Scores solver: one fixed frame of elastic-or-lossy disc motion, event-driven inside the frame.
 *
 * Model (2D, discs, not physical accuracy). Time is measured in frames; a frame is the fixed step of the
 * stateful simulation. Inside a frame:
 *
 * 1. Gravity is one velocity kick `vy += gravity` at the start of the frame; flight between contacts is a
 *    straight line. (Semi-implicit Euler: energy is conserved exactly only without gravity.)
 * 2. The earliest contact of any disc with a wall element or another disc is found exactly (`collision-walls.ts`,
 *    `timeToReach`), every disc advances to that instant, the contact is resolved, and the search repeats
 *    for the rest of the frame. There is no tunnelling at any speed, and no overlap is ever repaired by
 *    moving a disc: positions come from the exact flight times only.
 * 3. **Simultaneous contacts.** Contacts whose times differ by at most `TIE` (1e-9 frames) are simultaneous. They
 *    are resolved one at a time in this order: wall contacts before disc contacts, then by the lower disc serial,
 *    then by the higher serial (discs) or the lower wall-element index (walls). Each resolution changes the
 *    velocities before the next contact is looked for, so a body touching two things at once bounces off them in
 *    that order. This is a sequential-impulse convention, not a physical claim about ties.
 *
 * Laws (exact; tested against closed forms):
 * - Two discs, masses `m₁ m₂`, unit normal `n` from 1 to 2, approach speed `u = (v₁ − v₂)·n > 0`, restitution `e`:
 *   `J = (1 + e) u / (1/m₁ + 1/m₂)`, `v₁ ← v₁ − (J/m₁) n`, `v₂ ← v₂ + (J/m₂) n`. Momentum is conserved and, for `e = 1`,
 *   so is kinetic energy; tangential velocities are untouched (frictionless discs).
 * - A wall with inward normal `n`, approach speed `u = −v·n > 0`, restitution `e`: `v ← v + (1 + e) u n`, so the angle of
 *   reflection equals the angle of incidence for `e = 1`. Coulomb friction `μ` then removes tangential speed
 *   `min(μ (1 + e) u, |v_t|)` (discs do not spin).
 * - `e < 1` and an approach speed below `max(REST_SPEED, 2 |gravity|)` count as `e = 0`, so a lossy disc settles
 *   instead of bouncing forever (the Zeno case; a disc at rest under gravity meets the wall at exactly the
 *   kick each frame). `e = 1` is never altered.
 *
 * Log. Every resolved contact is appended to `out` except resting contact: with gravity `g`, a contact whose approach speed
 * is at most `2 |g|` (a disc lying on a wall meets it at exactly the kick each frame) is resolved but not recorded, so a pile
 * does not fill the log with one micro-impulse per body per frame. With `g = 0` nothing is dropped.
 *
 * Bounds: a frame may resolve at most `maxEvents` contacts (logged or not); over that the frame throws a `FrameLimitError`
 * instead of dropping any (the caller then discards the whole frame).
 */
import { PointGrid } from "./spatial-index.js";
import { timeToReach, timeToSegment, wallsNear, type WallSet } from "./collision-walls.js";

export const EVENT_STRIDE = 20;
/** Field offsets of one record of the packed event list. */
export const EVENT = Object.freeze({
  kind: 0, a: 1, b: 2, time: 3, x: 4, y: 5, nx: 6, ny: 7, impulse: 8, approach: 9,
  aInX: 10, aInY: 11, aOutX: 12, aOutY: 13, bInX: 14, bInY: 15, bOutX: 16, bOutY: 17, radius: 18, mass: 19,
});
export const KIND_PAIR = 0, KIND_WALL = 1, KIND_EMIT = 2;
/** Approach speed (units per frame) under which a lossy contact is perfectly inelastic. */
export const REST_SPEED = 0.02;
/** Contacts closer in time than this (frames) are simultaneous and resolved in the stated order. */
export const TIE = 1e-9;

export interface Bodies {
  count: number;
  readonly x: Float64Array; readonly y: Float64Array; readonly vx: Float64Array; readonly vy: Float64Array;
  readonly r: Float64Array; readonly m: Float64Array;
}
export interface Physics { restitution: number; wallRestitution: number; wallFriction: number; gravity: number }

export interface PairOutcome { impulse: number; approach: number; v1x: number; v1y: number; v2x: number; v2y: number }
/** The disc-disc law. `n` points from disc 1 to disc 2. Discs that are not approaching are unchanged (impulse 0). */
export function pairLaw(m1: number, m2: number, v1x: number, v1y: number, v2x: number, v2y: number, nx: number, ny: number, restitution: number, restSpeed = REST_SPEED): PairOutcome {
  const approach = (v1x - v2x) * nx + (v1y - v2y) * ny;
  if (!(approach > 0)) return { impulse: 0, approach, v1x, v1y, v2x, v2y };
  const e = restitution < 1 && approach < restSpeed ? 0 : restitution;
  const impulse = (1 + e) * approach / (1 / m1 + 1 / m2);
  return { impulse, approach, v1x: v1x - impulse / m1 * nx, v1y: v1y - impulse / m1 * ny, v2x: v2x + impulse / m2 * nx, v2y: v2y + impulse / m2 * ny };
}

export interface WallOutcome { impulse: number; approach: number; vx: number; vy: number }
/** The disc-wall law. `n` is the wall's normal towards the disc. Friction acts on the tangential velocity only. */
export function wallLaw(m: number, vx: number, vy: number, nx: number, ny: number, restitution: number, friction: number, restSpeed = REST_SPEED): WallOutcome {
  const approach = -(vx * nx + vy * ny);
  if (!(approach > 0)) return { impulse: 0, approach, vx, vy };
  const e = restitution < 1 && approach < restSpeed ? 0 : restitution;
  const kick = (1 + e) * approach;
  let outX = vx + kick * nx, outY = vy + kick * ny;
  if (friction > 0) {
    const along = outX * -ny + outY * nx, speed = Math.abs(along);
    if (speed > 0) {
      const removed = Math.min(friction * kick, speed) * Math.sign(along);
      outX -= removed * -ny; outY -= removed * nx;
    }
  }
  return { impulse: m * kick, approach, vx: outX, vy: outY };
}

/** Thrown when one frame needs more contacts or work than its bound; the caller decides what that means (Collision Scores ends the recording). */
export class FrameLimitError extends Error {
  constructor(message: string) { super(message); this.name = "FrameLimitError"; }
}

export interface FrameLimits {
  readonly maxEvents: number;
  charge(units: number): void;
  /** Message of the `FrameLimitError` thrown when a frame exceeds `maxEvents`; names the controls to change. */
  overflow(events: number): string;
}

/**
 * Advance every born body one frame (see the header), appending each contact as an `EVENT_STRIDE` record to
 * `out`. `frameStart` is the absolute time at the start of the frame.
 */
export function solveFrame(bodies: Bodies, walls: WallSet, physics: Physics, frameStart: number, out: number[], limits: FrameLimits): void {
  const n = bodies.count;
  if (n === 0) return;
  const { x, y, vx, vy, r, m } = bodies;
  if (physics.gravity !== 0) for (let i = 0; i < n; i++) vy[i] += physics.gravity;
  // A disc resting on a wall meets it at exactly the gravity kick each frame, so that speed must count as resting too.
  const restSpeed = Math.max(REST_SPEED, 2 * Math.abs(physics.gravity));
  // Resting contact under gravity (approach speed within twice the kick) is resolved every frame but not logged: it is not a collision event.
  const logFloor = 2 * Math.abs(physics.gravity);
  let rmax = 0;
  for (let i = 0; i < n; i++) rmax = Math.max(rmax, r[i]);
  const marks = new Int32Array(walls.segmentCount + walls.roundCount);
  let stamp = 0, tNow = 0, events = 0, vBound = 0;
  let pairs: number[] = [];
  const lists: number[][] = Array.from({ length: n }, () => []);
  const [wx0, wy0, wx1, wy1] = walls.bounds;

  /** Candidate pairs and wall elements that can still touch during the rest of the frame, given a speed bound. */
  const build = () => {
    const tau = 1 - tNow;
    let vmax = 0;
    for (let i = 0; i < n; i++) vmax = Math.max(vmax, Math.hypot(vx[i], vy[i]));
    vBound = Math.max(vmax * 1.25, 1e-6);
    const travel = vBound * tau;
    pairs = [];
    if (n > 1) {
      const query = rmax * 2 + 2 * travel;
      const pad = rmax + 1;
      const grid = new PointGrid({ bounds: [wx0 - pad, wy0 - pad, wx1 + pad, wy1 + pad], cellSize: Math.max(query, 4), onWork: limits.charge });
      for (let i = 0; i < n; i++) grid.insert(i, x[i], y[i]);
      for (let i = 0; i < n; i++)
        for (const hit of grid.within(x[i], y[i], r[i] + rmax + 2 * travel, { exclude: i })) if (hit.id > i) pairs.push(i, hit.id);
    }
    for (let i = 0; i < n; i++) {
      const reach = r[i] + travel + 1e-6;
      limits.charge(wallsNear(walls, x[i] - reach, y[i] - reach, x[i] + reach, y[i] + reach, marks, ++stamp, lists[i]));
    }
    limits.charge(n);
  };
  build();

  // Scratch for the candidates of one search: time, rank (0 wall, 1 pair), first disc, second disc or element.
  const ct: number[] = [], cr: number[] = [], ca: number[] = [], cb: number[] = [];
  const advance = (dt: number) => { for (let i = 0; i < n; i++) { x[i] += vx[i] * dt; y[i] += vy[i] * dt; } };
  const S = walls.segmentCount;

  for (;;) {
    const tau = 1 - tNow;
    let count = 0, minT = Infinity, tests = pairs.length / 2;
    for (let p = 0; p < pairs.length; p += 2) {
      const i = pairs[p], j = pairs[p + 1];
      const t = timeToReach(x[j] - x[i], y[j] - y[i], vx[j] - vx[i], vy[j] - vy[i], r[i] + r[j], tau);
      if (t < Infinity) { ct[count] = t; cr[count] = 1; ca[count] = i; cb[count] = j; count++; if (t < minT) minT = t; }
    }
    for (let i = 0; i < n; i++) {
      const list = lists[i];
      tests += list.length;
      for (let q = 0; q < list.length; q++) {
        const e = list[q];
        const t = e < S ? timeToSegment(walls, e, x[i], y[i], vx[i], vy[i], r[i], tau)
          : timeToReach(x[i] - walls.rounds[(e - S) * 3], y[i] - walls.rounds[(e - S) * 3 + 1], vx[i], vy[i], walls.rounds[(e - S) * 3 + 2] + r[i], tau);
        if (t < Infinity) { ct[count] = t; cr[count] = 0; ca[count] = i; cb[count] = e; count++; if (t < minT) minT = t; }
      }
    }
    limits.charge(tests);
    if (count === 0) { advance(tau); return; }
    let best = -1;
    for (let c = 0; c < count; c++) {
      if (ct[c] > minT + TIE) continue;
      if (best < 0 || cr[c] < cr[best] || (cr[c] === cr[best] && (ca[c] < ca[best] || (ca[c] === ca[best] && cb[c] < cb[best])))) best = c;
    }
    const dt = ct[best];
    advance(dt);
    tNow += dt;
    if (++events > limits.maxEvents) throw new FrameLimitError(limits.overflow(events));
    const i = ca[best], time = frameStart + tNow;
    let fastest = 0;
    if (cr[best] === 1) {
      const j = cb[best];
      const dx = x[j] - x[i], dy = y[j] - y[i], distance = Math.hypot(dx, dy), nx = dx / distance, ny = dy / distance;
      const ain = [vx[i], vy[i]], bin = [vx[j], vy[j]];
      const law = pairLaw(m[i], m[j], vx[i], vy[i], vx[j], vy[j], nx, ny, physics.restitution, restSpeed);
      vx[i] = law.v1x; vy[i] = law.v1y; vx[j] = law.v2x; vy[j] = law.v2y;
      if (law.approach > logFloor) out.push(KIND_PAIR, i, j, time, x[i] + nx * r[i], y[i] + ny * r[i], nx, ny, law.impulse, law.approach,
        ain[0], ain[1], vx[i], vy[i], bin[0], bin[1], vx[j], vy[j], r[i], m[i]);
      fastest = Math.max(Math.hypot(vx[i], vy[i]), Math.hypot(vx[j], vy[j]));
    } else {
      const e = cb[best];
      let nx: number, ny: number;
      if (e < S) { nx = walls.segments[e * 7 + 4]; ny = walls.segments[e * 7 + 5]; }
      else {
        const dx = x[i] - walls.rounds[(e - S) * 3], dy = y[i] - walls.rounds[(e - S) * 3 + 1], distance = Math.hypot(dx, dy);
        nx = dx / distance; ny = dy / distance;
      }
      const ain = [vx[i], vy[i]];
      const law = wallLaw(m[i], vx[i], vy[i], nx, ny, physics.wallRestitution, physics.wallFriction, restSpeed);
      vx[i] = law.vx; vy[i] = law.vy;
      if (law.approach > logFloor) out.push(KIND_WALL, i, e, time, x[i] - nx * r[i], y[i] - ny * r[i], nx, ny, law.impulse, law.approach,
        ain[0], ain[1], vx[i], vy[i], 0, 0, 0, 0, r[i], m[i]);
      fastest = Math.hypot(vx[i], vy[i]);
    }
    if (fastest > vBound) build();
  }
}
