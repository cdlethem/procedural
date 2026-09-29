import assert from "node:assert/strict";
import test from "node:test";
import {
  accumulateDensity, bundledControlSequence, bundledControlSequenceIds, bundledControlSequenceInfo, canPrepareInstrument, controlSequenceData,
  createControlSequence, createInstrument, curveAtTime, curveFamily, curvePaths, CurveCursor, densityAtTone, densityContours, depositionDensity,
  drawSandDeposition, exposeGrains, grainAlpha, keepOut, lengthIntegral, prepareInstrument, protectedSpace, sandDepositionComposition,
  sandDepositionProducts, sequenceFingerprint, smoothDensity, splineDeposit, usesSeed, validateParameters,
  type CompositionSurface, type ControlSequenceData, type DepositGrain, type FallModel, type GestureFrame, type SandDepositionComposition, type Site,
} from "../dist/index.js";

/** Records the alpha of every dot that is drawn, and nothing else. */
class Tally implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  alphas: number[] = [];
  #alpha = 255;
  push() {} pop() {} translate() {} rotate() {} scale() {} noFill() {} noStroke() {}
  fill(...a: number[]) { this.#alpha = a[3]; } stroke() {} strokeWeight() {} strokeCap() {}
  circle() { this.alphas.push(this.#alpha); }
  line() {} rect() {} beginShape() {} vertex() {} endShape() {}
}

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const TAU = Math.PI * 2;
const frameAt = (cx: number, cy: number): GestureFrame => ({ centerX: cx, centerY: cy, scale: 1, rotation: 0 });
const sequence = (id: string, t: number[], rows: [number, number][][], closed = false) => createControlSequence({ id, closed, t, controls: rows });

/** A 400-unit horizontal line that never moves: length integral 400 x 2 s = 800 unit-seconds. */
const still = sequence("still", [0, 2000], [[[100, 320], [500, 320]], [[100, 320], [500, 320]]]);
const stillFamily = curveFamily(still, { motion: 1, frame: frameAt(300, 320) });
/** The same line drifting 200 units to the right in 2 s (100 units per second); its bounding box centre is x = 400. */
const sliding = sequence("sliding", [0, 2000], [[[100, 320], [500, 320]], [[300, 320], [700, 320]]]);
const slidingFamily = curveFamily(sliding, { motion: 1, frame: frameAt(400, 320) });
/** The right end travels from 500 to 900: length 400 + 400 t / T. */
const stretching = sequence("stretch", [0, 2000], [[[100, 320], [500, 320]], [[100, 320], [900, 320]]]);
const stretchFamily = curveFamily(stretching, { motion: 1, frame: frameAt(500, 320) });

const rest: FallModel = { lag: 0, fall: 0, fallAngle: 90, inherit: 0, spread: 0 };
const full = { start: 0, end: 2000 };
const grains = (family: typeof stillFamily, over: Partial<{ seed: number; window: { start: number; end: number }; deposit: number; grainMass: number; fall: FallModel }> = {}) =>
  splineDeposit(family, { seed: 5, window: full, deposit: 3, grainMass: 2, fall: rest, ...over });

const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42): SandDepositionComposition => {
  const input = createInstrument("sand-deposition");
  return sandDepositionComposition({ ...input, seed, params: { ...input.params, ...params } });
};

/* ------------------------------------------------------------- the input */

test("control sequences are validated, copied and frozen; every failure names its keyframe and control", () => {
  const data: ControlSequenceData = { id: "s", closed: false, t: [0, 10, 25], controls: [[[0, 0], [5, 5]], [[1, 0], [5, 6]], [[2, 0], [5, 7]]] };
  const made = createControlSequence(data);
  data.t.push(99); (data.controls[0][0] as unknown as number[])[0] = 77;
  assert.deepEqual([...made.t], [0, 10, 25]);
  assert.equal(made.controls[0][0][0], 0, "the caller's later edits do not reach the copy");
  assert.ok(Object.isFrozen(made) && Object.isFrozen(made.t) && Object.isFrozen(made.controls) && Object.isFrozen(made.controls[1]) && Object.isFrozen(made.controls[1][1]));
  assert.equal(made.duration, 25); assert.equal(made.count, 2);
  assert.deepEqual(controlSequenceData(made), { id: "s", closed: false, t: [0, 10, 25], controls: [[[0, 0], [5, 5]], [[1, 0], [5, 6]], [[2, 0], [5, 7]]] });
  const good = { id: "s", closed: false, t: [0, 10], controls: [[[0, 0], [1, 1]], [[0, 0], [1, 1]]] } as ControlSequenceData;
  assert.throws(() => createControlSequence({ ...good, t: [0, 0] }), /t\[1\] = 0 does not exceed t\[0\] = 0/);
  assert.throws(() => createControlSequence({ ...good, t: [0, NaN] }), /t\[1\] must be a finite number/);
  assert.throws(() => createControlSequence({ ...good, controls: [good.controls[0], [[0, 0]]] }), /keyframe 1 has 1 control points but keyframe 0 has 2/);
  assert.throws(() => createControlSequence({ ...good, controls: [good.controls[0], [[0, 0], [1, Infinity]]] }), /controls\[1\]\[1\] must be two finite numbers/);
  assert.throws(() => createControlSequence({ ...good, controls: [good.controls[0]] }), /controls has 1 keyframes but t has 2/);
  assert.throws(() => createControlSequence({ ...good, closed: true }), /a closed sequence needs 3 to 64/);
  assert.throws(() => createControlSequence({ ...good, extra: 1 } as unknown as ControlSequenceData), /unknown field: extra/);
  assert.throws(() => createControlSequence({ id: "s", closed: false, t: [0, 1] } as unknown as ControlSequenceData), /missing controls/);
});

test("the fingerprint is a content hash of every keyframe, position and the closure", () => {
  const base = still, again = createControlSequence(controlSequenceData(still));
  assert.equal(sequenceFingerprint(base), sequenceFingerprint(again));
  const edited = (edit: (data: ControlSequenceData) => void) => { const data = controlSequenceData(still) as { -readonly [K in keyof ControlSequenceData]: ControlSequenceData[K] }; edit(data); return sequenceFingerprint(createControlSequence(data)); };
  const seen = new Set([sequenceFingerprint(base),
    edited((d) => { (d.t as number[])[1] = 2001; }),
    edited((d) => { ((d.controls[1] as [number, number][])[1])[1] = 320.001; }),
    edited((d) => { ((d.controls[0] as [number, number][])[0])[0] = 100.5; })]);
  assert.equal(seen.size, 4);
});

test("the family is exact for straight, equally spaced controls and uses arc length as its parameter", () => {
  const three = sequence("three", [0, 1000], [[[100, 320], [300, 320], [500, 320]], [[100, 320], [300, 320], [500, 320]]]);
  const family = curveFamily(three, { motion: 1, frame: frameAt(300, 320) });
  const points = curveAtTime(family, 400);
  assert.equal(points.length, family.samples + 1);
  points.forEach(([x, y], k) => { near(x, 100 + 400 * k / family.samples, 1e-9, `x at ${k}`); near(y, 320, 1e-9, `y at ${k}`); });
  near(family.length[10], 400, 1e-9);
  near(lengthIntegral(family, 0, 1000), 400, 1e-9, "400 units for 1 s");
  near(lengthIntegral(family, 250, 750), 200, 1e-9, "half the time, half the integral");
});

test("a closed Catmull-Rom curve through points of a circle stays on it, wraps, and has the circle's length", () => {
  const ring = (radius: number): [number, number][] => Array.from({ length: 8 }, (_, i) => [320 + radius * Math.cos(TAU * i / 8), 320 + radius * Math.sin(TAU * i / 8)] as [number, number]);
  const family = curveFamily(sequence("ring", [0, 1000], [ring(100), ring(100)], true), { motion: 1, frame: frameAt(320, 320) });
  const points = curveAtTime(family, 500);
  for (const [x, y] of points) near(Math.hypot(x - 320, y - 320), 100, 1.2, "radius");
  near(points[0][0], points[points.length - 1][0], 1e-9); near(points[0][1], points[points.length - 1][1], 1e-9);
  near(family.length[0], TAU * 100, TAU * 100 * 0.01, "circumference");
  // An open curve passes through every control point.
  const open = curveFamily(sequence("bent", [0, 1000], [[[100, 100], [200, 300], [400, 250], [500, 500]], [[100, 100], [200, 300], [400, 250], [500, 500]]]), { motion: 1, frame: frameAt(300, 300) });
  const line = curveAtTime(open, 0);
  for (const control of [[100, 100], [200, 300], [400, 250], [500, 500]]) assert.ok(Math.min(...line.map(([x, y]) => Math.hypot(x - control[0], y - control[1]))) < 1.5, `passes ${control}`);
});

test("motion scales every control's excursion about its own average, and never moves the placement", () => {
  // Two controls drift up together from y = 200 to y = 400 (average 300); the line stays 100 units long.
  const drift = sequence("drift", [0, 1000], [[[100, 200], [200, 200]], [[100, 400], [200, 400]]]);
  const at = (motion: number, time: number) => { const cursor = new CurveCursor(curveFamily(drift, { motion, frame: frameAt(150, 300) })); return cursor.at(time, 0.5).y; };
  for (const time of [0, 250, 500, 1000]) near(at(0, time), 300, 1e-9, "motion 0 freezes the average shape");
  near(at(1, 0), 200); near(at(1, 1000), 400);
  near(at(2, 0), 100, 1e-9, "motion 2 doubles the excursion"); near(at(2, 1000), 500, 1e-9);
  near(at(0.5, 0), 250, 1e-9);
  near(at(1, 500), 300, 1e-6, "the average stays put whatever the motion");
});

test("the frame is a similarity about the centre of the unscaled control points", () => {
  const line = sequence("frame", [0, 1000], [[[0, 0], [200, 0]], [[0, 0], [200, 0]]]);
  const family = curveFamily(line, { motion: 1, frame: { centerX: 300, centerY: 200, scale: 2, rotation: 90 } });
  const cursor = new CurveCursor(family);
  // Centre (100, 0) goes to (300, 200); the end points, 100 units either side, become 200 units away along +y / -y after a quarter turn.
  cursor.at(0, 0); near(cursor.x, 300, 1e-9); near(cursor.y, 0, 1e-9);
  cursor.at(0, 1); near(cursor.x, 300, 1e-9); near(cursor.y, 400, 1e-9);
  near(cursor.length, 400, 1e-9);
});

test("the family depends on the curve and its timing, not on how densely the keyframes were given", () => {
  const point = (i: number, t: number): [number, number] => [80 + 90 * i + 40 * Math.sin(TAU * 1.1 * t / 2000 + i), 320 + 120 * Math.sin(TAU * 0.7 * t / 2000 + 1.7 * i)];
  const times = (n: number, salt: number) => Array.from({ length: n }, (_, k) => k === 0 ? 0 : k === n - 1 ? 2000 : 2000 * k / (n - 1) + Math.sin(k * 12.9898 + salt) * 0.25 * 2000 / (n - 1));
  const build = (n: number, salt: number) => { const t = times(n, salt); return sequence(`dense${n}`, t, t.map((time) => [0, 1, 2, 3].map((i) => point(i, time)))); };
  const frame = frameAt(80 + 135, 320);
  const sparse = curveFamily(build(60, 1), { motion: 1, frame }), dense = curveFamily(build(400, 2), { motion: 1, frame });
  let worst = 0;
  for (const time of [0, 130, 400.5, 777, 1234.5, 1999]) {
    const a = curveAtTime(sparse, time), b = curveAtTime(dense, time);
    for (let k = 0; k <= sparse.samples; k += 16) worst = Math.max(worst, Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1]));
  }
  assert.ok(worst < 0.5, `30 Hz against 200 Hz differ by ${worst}`);
});

test("the cursor reports the material point's own velocity, the tangent and the length", () => {
  const cursor = new CurveCursor(slidingFamily);
  for (const [time, u] of [[0, 0], [700, 0.25], [1500, 1]] as const) {
    cursor.at(time, u);
    near(cursor.vx, 100, 1e-6, "100 units per second to the right"); near(cursor.vy, 0, 1e-9);
    near(cursor.tx, 1, 1e-12); near(cursor.ty, 0, 1e-12); near(cursor.length, 400, 1e-9);
    near(cursor.x, 100 + 400 * u + 0.1 * time, 1e-6, "position");
  }
  near(lengthIntegral(stretchFamily, 0, 2000), 1200, 1e-9, "L grows from 400 to 800: mean 600 for 2 s");
  near(lengthIntegral(stretchFamily, 500, 1500), 600, 1e-9);
});

/* ------------------------------------------------------- bundled sequences */

test("bundled sequences are deterministic, valid, frozen, irregularly timed, and the seed is the take", () => {
  assert.deepEqual([...bundledControlSequenceIds], ["curtain", "whip", "bloom", "unfurl", "fold"]);
  const frame = frameAt(320, 320);
  for (const id of bundledControlSequenceIds) {
    const info = bundledControlSequenceInfo[id], made = bundledControlSequence(id, 42);
    assert.equal(bundledControlSequence(id, 42), made, "cached");
    assert.equal(made.count, info.controls); assert.equal(made.closed, info.closed);
    assert.equal(made.t[0], 0); assert.equal(made.duration, info.duration);
    assert.ok(Object.isFrozen(made) && Object.isFrozen(made.controls[0][0]));
    const gaps = made.t.slice(1).map((value, k) => value - made.t[k]);
    assert.ok(Math.max(...gaps) / Math.min(...gaps) > 1.25, `${id}: irregular keyframes`);
    const prints = new Set([1, 2, 3, 4].map((seed) => sequenceFingerprint(bundledControlSequence(id, seed))));
    assert.equal(prints.size, 4, `${id}: every seed performs it differently`);
    // Different seeds are different structures, not a shuffle: the curves themselves differ substantially.
    const a = curveAtTime(curveFamily(bundledControlSequence(id, 1), { motion: 1, frame }), info.duration / 2), b = curveAtTime(curveFamily(bundledControlSequence(id, 2), { motion: 1, frame }), info.duration / 2);
    const gap = a.reduce((sum, [x, y], k) => sum + Math.hypot(x - b[k][0], y - b[k][1]), 0) / a.length;
    assert.ok(gap > 15, `${id}: mean curve difference between takes is ${gap}`);
  }
});

/* ------------------------------------------------------------- the deposit */

test("deposition is a measure: the mass is deposit x the length integral, however many grains stand for it", () => {
  for (const [family, expected] of [[stillFamily, 3 * 800], [stretchFamily, 3 * 1200]] as const) {
    const masses = [0.55, 0.7, 1.3, 3.3].map((grainMass) => {
      const made = grains(family, { grainMass });
      near(made.mass, expected, 1e-9, "requested mass");
      near(made.grains.reduce((sum, g) => sum + g.mass, 0), expected, expected * 1e-12, `grain mass ${grainMass}`);
      near(made.grains.length, Math.ceil(expected / grainMass), 3, "the grain count is the mass over the grain mass");
      return made.grains.length;
    });
    assert.ok(masses[0] > masses[1] && masses[1] > masses[2] && masses[2] > masses[3]);
  }
  // A window's mass is the integral over that window, and it holds for every grain size.
  for (const grainMass of [0.7, 2.3]) near(grains(stretchFamily, { grainMass, window: { start: 500, end: 1500 } }).grains.reduce((s, g) => s + g.mass, 0), 3 * 600, 1e-9);
  near(grains(stillFamily, { window: { start: 0, end: 500 } }).mass, 3 * 200, 1e-9);
});

test("each grain carries the mass of the curve length it left: equal mass per unit of curve", () => {
  const made = grains(stretchFamily, { grainMass: 1 });
  const ratios = made.grains.map((g) => g.mass / (400 + 400 * g.time / 2000));
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  for (const r of ratios) near(r / mean, 1, 1e-9);
});

test("grain times are spread evenly over the sequence, whatever the seed", () => {
  for (const seed of [1, 99]) {
    const made = grains(stillFamily, { seed, deposit: 3, grainMass: 0.6 });
    const bins = new Array<number>(10).fill(0);
    for (const g of made.grains) bins[Math.min(9, Math.floor(g.time / 200))]++;
    for (const count of bins) near(count, made.grains.length / 10, 3, `seed ${seed} bin`);
  }
});

test("raising the deposit or lowering the grain mass only adds grains; the survivors do not move", () => {
  const small = grains(stillFamily, { deposit: 2, grainMass: 2, fall: { ...rest, spread: 6, lag: 500, fall: 80 } });
  const large = grains(stillFamily, { deposit: 3, grainMass: 1, fall: { ...rest, spread: 6, lag: 500, fall: 80 } });
  assert.ok(large.grains.length > 2 * small.grains.length);
  const byId = new Map(large.grains.map((g) => [g.id, g]));
  for (const g of small.grains) {
    const other = byId.get(g.id)!;
    assert.ok(other, `${g.id} survives`);
    assert.deepEqual([...other.position], [...g.position]); assert.equal(other.time, g.time); assert.deepEqual([...other.origin], [...g.origin]);
  }
});

test("narrowing the window keeps every surviving grain exactly where and when it was", () => {
  const options = { fall: { ...rest, spread: 6, lag: 500, fall: 80 } };
  const whole = grains(stillFamily, options), part = grains(stillFamily, { ...options, window: { start: 600, end: 1300 } });
  const byId = new Map(whole.grains.map((g) => [g.id, g]));
  assert.ok(part.grains.length > 100 && part.grains.length < whole.grains.length);
  for (const g of part.grains) {
    assert.ok(g.time >= 600 && g.time <= 1300);
    const before = byId.get(g.id)!;
    assert.deepEqual([...g.position], [...before.position]); assert.equal(g.angle, before.angle); assert.equal(g.seed, before.seed);
  }
  // Every grain of the whole that left inside the window survives.
  assert.equal(whole.grains.filter((g) => g.time >= 600 && g.time <= 1300).length, part.grains.length);
});

test("grains are released from the material point of the curve and fall along the stated vector", () => {
  const model: FallModel = { lag: 1000, fall: 200, fallAngle: 90, inherit: 0.5, spread: 0 };
  const made = grains(slidingFamily, { grainMass: 0.5, fall: model, deposit: 4 });
  let sumDelay = 0;
  for (const g of made.grains) {
    // The origin lies on the curve at the release time: y = 320, x between the ends.
    near(g.origin[1], 320, 1e-9);
    assert.ok(g.origin[0] >= 100 + 0.1 * g.time - 1e-6 && g.origin[0] <= 500 + 0.1 * g.time + 1e-6, "on the curve");
    // Velocity of the point is (100, 0) per second, so displacement is delay x (0.5 * 100, 200).
    const dx = g.position[0] - g.origin[0], dy = g.position[1] - g.origin[1];
    assert.ok(dy >= 0 && dy <= 200 + 1e-9);
    near(dx, dy / 4, 1e-9, "dx / dy = 50 / 200");
    near(g.angle, Math.atan2(200, 50), 1e-12, "frame along the total velocity");
    sumDelay += dy / 200;
  }
  near(sumDelay / made.grains.length, 0.5, 0.02, "the delay is uniform on [0, lag]");
});

test("the scatter is isotropic with the stated standard deviation", () => {
  const made = grains(stillFamily, { grainMass: 0.3, fall: { ...rest, spread: 10 } });
  let sx = 0, sy = 0, sxx = 0, syy = 0;
  for (const g of made.grains) { const dx = g.position[0] - g.origin[0], dy = g.position[1] - g.origin[1]; sx += dx; sy += dy; sxx += dx * dx; syy += dy * dy; }
  const n = made.grains.length;
  near(Math.sqrt(sxx / n - (sx / n) ** 2), 10, 0.5); near(Math.sqrt(syy / n - (sy / n) ** 2), 10, 0.5);
  near(sx / n, 0, 0.5); near(sy / n, 0, 0.5);
});

test("seeded sampling is reproducible, and a new seed lands different grains", () => {
  const options = { fall: { ...rest, spread: 4, lag: 300, fall: 50 } };
  const a = grains(stillFamily, options), b = splineDeposit(stillFamily, { seed: 5, window: full, deposit: 3, grainMass: 2, fall: options.fall });
  assert.equal(a, b, "cached by construction");
  const fresh = curveFamily(createControlSequence(controlSequenceData(still)), { motion: 1, frame: frameAt(300, 320) });
  const again = splineDeposit(fresh, { seed: 5, window: full, deposit: 3, grainMass: 2, fall: options.fall });
  assert.notEqual(again, a);
  assert.deepEqual(again.grains.map((g) => [g.id, ...g.position, g.mass]), a.grains.map((g) => [g.id, ...g.position, g.mass]), "equal inputs give equal grains");
  const other = grains(stillFamily, { ...options, seed: 6 });
  assert.equal(other.grains.length, a.grains.length);
  assert.ok(other.grains.some((g, i) => g.position[0] !== a.grains[i].position[0]));
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.grains) && Object.isFrozen(a.grains[0]) && Object.isFrozen(a.grains[0].position));
  assert.ok(a.grains.every((g) => g.id.startsWith("still/grain:")));
});

/* -------------------------------------------------------------- exposure */

test("exposure is a photographic law: alpha = 1 - exp(-2^stops * mass / footprint), never moving a grain", () => {
  near(grainAlpha(2, { stops: 0, footprint: 2 }), 1 - Math.exp(-1), 1e-15);
  near(grainAlpha(2, { stops: 1, footprint: 2 }), 1 - Math.exp(-2), 1e-15);
  near(grainAlpha(2, { stops: -2, footprint: 8 }), 1 - Math.exp(-0.0625), 1e-15);
  const made = grains(stillFamily, { grainMass: 0.3, fall: { ...rest, spread: 6 } });
  const footprint = Math.PI;
  const dim = exposeGrains(made.grains, { stops: -2, footprint }), bright = exposeGrains(made.grains, { stops: 2, footprint });
  const brightById = new Map(bright.map((s) => [s.id, s]));
  assert.ok(dim.length < bright.length, "more exposure shows more grains");
  const source = new Map(made.grains.map((g) => [g.id, g]));
  for (const site of dim) {
    const other = brightById.get(site.id)!;
    assert.ok(other, "a grain shown dimly is shown brightly");
    assert.ok(other.opacity! >= site.opacity!, "and no fainter");
    assert.equal(site.position, source.get(site.id)!.position, "the producer's own position object");
    assert.equal(other.angle, source.get(site.id)!.angle);
  }
  assert.equal(exposeGrains(made.grains, { stops: -2, footprint }), dim, "cached");
  assert.throws(() => exposeGrains(made.grains, { stops: 11, footprint }), /Exposure stops must be a finite number in \[-10, 10\]/);
  assert.throws(() => exposeGrains([{ ...made.grains[0], mass: -1 } as DepositGrain], { stops: 0, footprint }), /needs mass/);
});

test("the optical depth of a deposit does not depend on how many grains stand for it", () => {
  const fall = { ...rest, spread: 8 };
  const depth = (grainMass: number, size: number, stops: number) => {
    const made = grains(stillFamily, { grainMass, fall });
    const tally = new Tally();
    const footprint = Math.PI * (size / 2) ** 2;
    const sites = exposeGrains(made.grains, { stops, footprint });
    assert.ok(sites.length > 0);
    // Draw through the stock dot: its alpha channel is 225 * opacity, out of 255.
    const mark = (surface: CompositionSurface, site: Site) => { surface.fill(0, 0, 0, 225 * (site.opacity ?? 1)); surface.circle(0, 0, size); };
    for (const site of sites) mark(tally, site);
    return tally.alphas.reduce((sum, alpha) => sum - Math.log(1 - alpha / 255), 0);
  };
  const expected = 0.5 * 2400 / (Math.PI * 1.5 ** 2);
  for (const grainMass of [0.5, 2, 5]) near(depth(grainMass, 3, -1) / expected, 1, 0.05, `grain mass ${grainMass}`);
  // A larger mark spreads the same mass over more paper per grain, so each grain is fainter and the depth is unchanged.
  near(depth(2, 6, -1) / (0.5 * 2400 / (Math.PI * 9)), 1, 0.05);
});

test("changing exposure, marks or colours never changes any producer value; structural edits do", () => {
  const base = sandDepositionProducts(recipeFor());
  const restyled = sandDepositionProducts(recipeFor({ exposure: -1.5, grainSize: 3.5, material: "both", isoLevels: 3, isoWeight: 2, fieldCell: 9, isoSmooth: 3, overlay: true, overlayEvery: 300, overlayWeight: 3 }));
  assert.equal(restyled.family, base.family);
  assert.equal(restyled.deposit, base.deposit);
  assert.equal(restyled.kept, base.kept);
  for (const change of [{ deposit: 7 }, { grainMass: 1.5 }, { windowStart: 0.2 }, { motion: 0.6 }, { spread: 9 }, { sequence: "whip" }, { protectWidth: 200 }, { scale: 0.9 }]) {
    const other = sandDepositionProducts(recipeFor(change));
    assert.notEqual(other.kept, base.kept, `${JSON.stringify(change)} rebuilds the deposit`);
  }
  assert.notEqual(sandDepositionProducts(recipeFor({}, 43)).deposit, base.deposit);
  // The protected space edits only the kept set; the sampling and family are reused.
  const moved = sandDepositionProducts(recipeFor({ protectX: 300 }));
  assert.equal(moved.deposit, base.deposit); assert.equal(moved.family, base.family); assert.notEqual(moved.kept, base.kept);
});

/* ------------------------------------------------------------ protected space */

test("a rectangle keeps every grain out of its box; accepted plus rejected mass is the deposit's mass", () => {
  const made = grains(stillFamily, { grainMass: 0.7, fall: { ...rest, spread: 25 } });
  const space = protectedSpace({ shape: "rectangle", centerX: 300, centerY: 320, width: 100, height: 60 });
  const kept = keepOut(made, space);
  assert.ok(kept.rejected > 50 && kept.grains.length > 50);
  assert.equal(kept.rejected + kept.grains.length, made.grains.length);
  for (const g of kept.grains) assert.ok(Math.abs(g.position[0] - 300) > 50 || Math.abs(g.position[1] - 320) > 30, "no kept grain is inside");
  const inside = made.grains.filter((g) => Math.abs(g.position[0] - 300) <= 50 && Math.abs(g.position[1] - 320) <= 30);
  assert.equal(inside.length, kept.rejected, "and every grain inside is rejected");
  near(kept.mass + kept.rejectedMass, made.mass, made.mass * 1e-12);
  near(kept.rejectedMass, inside.reduce((s, g) => s + g.mass, 0), 1e-9);
  assert.equal(keepOut(made, space), kept, "cached");
  assert.equal(keepOut(made, null).grains, made.grains, "nothing reserved keeps the deposit's own grains");
});

test("an ellipse is inscribed within a stated tolerance", () => {
  const made = grains(stillFamily, { grainMass: 0.7, fall: { ...rest, spread: 25 } });
  const kept = keepOut(made, protectedSpace({ shape: "ellipse", centerX: 300, centerY: 320, width: 160, height: 80 }));
  const norm = (g: Site) => Math.hypot((g.position[0] - 300) / 80, (g.position[1] - 320) / 40);
  const gone = made.grains.filter((g) => !kept.grains.includes(g as DepositGrain));
  assert.ok(gone.length > 50);
  for (const g of gone) assert.ok(norm(g) <= 1, "rejected grains are inside the ellipse");
  for (const g of kept.grains) assert.ok(norm(g) >= 1 - 2 * 0.2 / 40, `kept grain at ${norm(g)}`);
});

test("a word is reserved by its letters: nothing outside the box is touched, the counters stay open", () => {
  const made = grains(stillFamily, { grainMass: 0.7, fall: { ...rest, spread: 40 } });
  const kept = keepOut(made, protectedSpace({ shape: "text", text: "SAND", centerX: 300, centerY: 320, width: 300, height: 120 }));
  assert.ok(kept.rejected > 100);
  const outside = (g: Site) => g.position[0] < 150 || g.position[0] > 450 || g.position[1] < 260 || g.position[1] > 380;
  for (const g of made.grains) if (outside(g)) assert.ok(kept.grains.includes(g as DepositGrain), "outside the word's box");
  const inBox = made.grains.filter((g) => !outside(g)).length;
  assert.ok(kept.rejected < inBox * 0.6 && kept.rejected > inBox * 0.1, "letters cover part of their box, not all of it");
});

/* --------------------------------------------------------------- the field */

test("density accumulation conserves mass at any cell size and splits a grain bilinearly", () => {
  const cell = 10, bounds = [0, 0, 100, 100] as const;
  const at = (x: number, y: number, mass: number) => ({ position: [x, y] as const, mass });
  // At a cell centre all the mass is in that cell: density mass / cell^2.
  const centre = accumulateDensity([at(35, 45, 8)], bounds, cell);
  near(centre.values[4 * 10 + 3], 8 / 100, 1e-15); near(centre.mass, 8, 1e-12);
  // On the corner shared by four cells each takes a quarter.
  const corner = accumulateDensity([at(40, 50, 8)], bounds, cell);
  for (const [i, j] of [[3, 4], [4, 4], [3, 5], [4, 5]]) near(corner.values[j * 10 + i], 2 / 100, 1e-15);
  // The outer half cell keeps all of its mass in the edge cell; grains beyond the grid are reported, not moved.
  const edge = accumulateDensity([at(2, 2, 3), at(150, 50, 5)], bounds, cell);
  near(edge.values[0], 3 / 100, 1e-15); near(edge.mass, 3, 1e-12); assert.equal(edge.outside, 5); assert.equal(edge.grains, 1);
  // Any cell size sees the same mass.
  const made = keepOut(grains(stillFamily, { grainMass: 0.7, fall: { ...rest, spread: 12 } }), null);
  const masses = [2, 5, 13, 40].map((size) => accumulateDensity(made.grains, [0, 0, 640, 640], size)).map((field) => field.mass + field.outside);
  for (const m of masses) near(m, made.mass, made.mass * 1e-12);
  assert.equal(accumulateDensity(made.grains, [0, 0, 640, 640], 5), accumulateDensity(made.grains, [0, 0, 640, 640], 5), "cached");
  assert.throws(() => accumulateDensity(made.grains, [0, 0, 640, 640], 1), /Density field would need 409600 cells; the limit is 250000\. Raise the field cell size/);
});

test("smoothing spreads density symmetrically and conserves mass, even against the edge", () => {
  const spot = (x: number, y: number) => accumulateDensity([{ position: [x, y] as const, mass: 10 }], [0, 0, 200, 200], 5);
  const middle = smoothDensity(spot(102.5, 102.5), 10);
  near(middle.mass, 10, 1e-12);
  const at = (i: number, j: number) => middle.values[j * middle.columns + i];
  near(at(23, 20), at(17, 20), 1e-15, "symmetric about the cell"); near(at(20, 22), at(20, 18), 1e-15); near(at(21, 22), at(22, 21), 1e-15, "and about the diagonal");
  assert.ok(at(20, 20) > at(23, 20) && at(23, 20) > at(26, 20));
  const corner = smoothDensity(spot(2.5, 2.5), 10);
  near(corner.mass, 10, 1e-12, "mass mirrored back, not lost off the edge");
  assert.ok(corner.values[0] > middle.values[20 * middle.columns + 20], "mirroring piles it up at the edge");
  assert.equal(smoothDensity(spot(102.5, 102.5), 0).mass, 10);
  assert.throws(() => smoothDensity(spot(50, 50), 500), /Smoothing 500 spans 300 cells; the limit is 60/);
});

test("isolines trace where the density crosses a level: one closed loop per island at the right radius", () => {
  // A lattice of unit-mass grains (spacing 2) inside a disk of radius 60 is a uniform density of 1/4.
  const disk = (cx: number, cy: number, radius: number) => {
    const out: { position: readonly [number, number]; mass: number }[] = [];
    for (let x = cx - radius; x <= cx + radius; x += 2) for (let y = cy - radius; y <= cy + radius; y += 2) if (Math.hypot(x - cx, y - cy) < radius) out.push({ position: [x, y], mass: 1 });
    return out;
  };
  const one = smoothDensity(accumulateDensity(disk(320, 320, 60), [0, 0, 640, 640], 4), 6);
  const paths = densityContours(one, [0.125], 1);
  assert.equal(paths.length, 1); assert.ok(paths[0].closed);
  const radii = paths[0].points.map(([x, y]) => Math.hypot(x - 320, y - 320));
  near(radii.reduce((a, b) => a + b, 0) / radii.length, 60, 3, "mean radius of the half-density line");
  assert.deepEqual(densityContours(one, [0.9], 1), [], "above the peak there is no line");
  const two = smoothDensity(accumulateDensity([...disk(160, 320, 40), ...disk(480, 320, 40)], [0, 0, 640, 640], 4), 4);
  const pair = densityContours(two, [0.125], 1);
  assert.equal(pair.length, 2); assert.ok(pair.every((p) => p.closed));
  const lower = densityContours(one, [0.05, 0.125, 0.2], 1);
  assert.deepEqual([...new Set(lower.map((p) => p.level))], [0.05, 0.125, 0.2]);
  const meanRadius = (level: number) => { const p = lower.find((q) => q.level === level)!; return p.points.reduce((s, [x, y]) => s + Math.hypot(x - 320, y - 320), 0) / p.points.length; };
  assert.ok(meanRadius(0.05) > meanRadius(0.125) && meanRadius(0.125) > meanRadius(0.2), "higher levels sit inside lower ones");
  near(densityAtTone(1 - Math.exp(-2), 0), 2, 1e-12); near(densityAtTone(1 - Math.exp(-2), 1), 1, 1e-12);
});

/* -------------------------------------------------------------- trajectory */

test("the overlay is the generating curve at times anchored to the sequence start, cut by the protected space", () => {
  const whole = curvePaths(stillFamily, { seed: 1, every: 1000, window: full });
  assert.deepEqual(whole.map((p) => p.id), ["curve:0", "curve:1", "curve:2"]);
  assert.deepEqual(whole.map((p) => p.level), [0, 1000, 2000]);
  for (const p of whole) { near(p.points[0][0], 100, 1e-9); near(p.points[p.points.length - 1][0], 500, 1e-9); assert.ok(p.points.every(([, y]) => Math.abs(y - 320) < 1e-9)); }
  const part = curvePaths(stillFamily, { seed: 1, every: 1000, window: { start: 500, end: 1700 } });
  assert.deepEqual(part.map((p) => p.id), ["curve:1"]);
  assert.deepEqual(part[0].points, whole[1].points, "survivors are unchanged");
  const cut = curvePaths(stillFamily, { seed: 1, every: 1000, window: { start: 500, end: 1700 } }, protectedSpace({ shape: "rectangle", centerX: 300, centerY: 320, width: 100, height: 60 }));
  assert.equal(cut.length, 2);
  const [left, right] = cut;
  near(Math.max(...left.points.map((p) => p[0])), 250, 1e-6); near(Math.min(...left.points.map((p) => p[0])), 100, 1e-9);
  near(Math.min(...right.points.map((p) => p[0])), 350, 1e-6); near(Math.max(...right.points.map((p) => p[0])), 500, 1e-9);
  assert.deepEqual(cut.map((p) => p.id), ["curve:1#0", "curve:1#1"]);
  assert.throws(() => curvePaths(stillFamily, { seed: 1, every: 1, window: full }), /would draw 2001 curves; the limit is 400\. Raise the overlay interval or narrow the window/);
});

/* -------------------------------------------------------- the named instrument */

test("the instrument resolves stored scalars to a typed, JSON-compatible recipe", () => {
  const recipe = recipeFor();
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), recipe);
  assert.equal(recipe.kind, "sand-deposition");
  assert.deepEqual(recipe.sequence, { kind: "bundled", id: "curtain" });
  near(recipe.window.start, 0.04 * 4200, 1e-9); near(recipe.window.end, 0.6 * 4200, 1e-9);
  assert.equal(recipe.protect?.shape, "ellipse");
  assert.equal(recipeFor({ protect: "none" }).protect, null);
  assert.equal(recipeFor({ protect: "word", protectWord: "VOID" }).protect?.shape, "text");
  assert.equal(recipeFor({ material: "isolines" }).grains, null);
  assert.equal(recipeFor({ material: "grains" }).isolines, null);
  assert.ok(recipeFor({ material: "both" }).grains && recipeFor({ material: "both" }).isolines);
  assert.equal(recipeFor({ overlay: true }).overlay?.every, 700);
  assert.equal(usesSeed(createInstrument("sand-deposition")), true);
});

test("drawing consumes exactly the producer's exposed grains and callbacks replace any consumer", () => {
  const recipe = recipeFor({ material: "both", overlay: true });
  const made = sandDepositionProducts(recipe);
  const seen: Site[] = [], strokes: string[] = [];
  drawSandDeposition(new Tally(), recipe, {
    grain: (_surface, site) => { seen.push(site); },
    isoline: (_surface, path) => { strokes.push(`iso ${path.id}`); },
    curve: (_surface, path) => { strokes.push(`curve ${path.id}`); },
  });
  const exposed = exposeGrains(made.kept.grains, { stops: recipe.exposure, footprint: Math.PI * (recipe.grains!.mark.size / 2) ** 2 });
  assert.equal(seen.length, exposed.length);
  assert.ok(seen.every((site, i) => site === exposed[i]), "the very sites the consumer exposes");
  assert.deepEqual(strokes, [...made.contours.map((p) => `iso ${p.id}`), ...made.curves.map((p) => `curve ${p.id}`)]);
  assert.ok(made.contours.length > 0 && made.curves.length > 0);
  // The density field of the same kept grains conserves their mass.
  const field = depositionDensity(made, 6, 0);
  near(field.mass + field.outside, made.kept.mass, made.kept.mass * 1e-12);
});

test("the density output is resolution-aware: the same field mass at any grain size or cell size", () => {
  const totals = [0.6, 1.2, 3].flatMap((grainMass) => [4, 9].map((cell) => {
    const made = sandDepositionProducts(recipeFor({ grainMass, protect: "none", spread: 2 }));
    const field = depositionDensity(made, cell, 0);
    return (field.mass + field.outside) / made.deposit.mass;
  }));
  for (const t of totals) near(t, 1, 1e-12);
});

test("preparation builds the producers cooperatively, honours cancellation and warms the caches", async () => {
  assert.equal(canPrepareInstrument("sand-deposition"), true);
  const input = createInstrument("sand-deposition");
  assert.equal(await prepareInstrument({ ...input, seed: 77 }, () => true), false);
  let checks = 0;
  assert.equal(await prepareInstrument({ ...input, seed: 77 }, () => ++checks > 2), false, "cancelled between stages");
  assert.equal(await prepareInstrument({ ...input, seed: 77, params: { ...input.params, material: "both", overlay: true } }, () => false), true);
  const recipe = sandDepositionComposition({ ...input, seed: 77, params: { ...input.params, material: "both", overlay: true } });
  const first = sandDepositionProducts(recipe);
  assert.equal(sandDepositionProducts(recipe).kept, first.kept);
  assert.equal(sandDepositionProducts(recipe).contours, first.contours);
});

test("failures name the control to change and nothing is truncated", () => {
  const over = { ...recipeFor({ sequence: "bloom", windowStart: 0, windowLength: 1, deposit: 12, grainMass: 0.5 }) };
  assert.throws(() => sandDepositionProducts(over), /Deposit would release \d+ grains in the window; the limit is 60000\. Lower the deposit, raise the grain mass or narrow the window/);
  assert.throws(() => splineDeposit(stillFamily, { seed: 1, window: full, deposit: 1e4, grainMass: 0.01, fall: rest }), /Deposit would sample \d+ grains over the sequence; the limit is 2000000\. Lower the deposit or raise the grain mass/);
  assert.throws(() => splineDeposit(stillFamily, { seed: 1, window: { start: 900, end: 900 }, deposit: 3, grainMass: 2, fall: rest }), /Window end 900 must be after its start 900/);
  assert.throws(() => splineDeposit(stillFamily, { seed: 1, window: full, deposit: 3, grainMass: 2, fall: { ...rest, spread: -1 } }), /grain spread must be a finite number/);
  assert.throws(() => splineDeposit(stillFamily, { seed: 1.5, window: full, deposit: 3, grainMass: 2, fall: rest }), /uint32/);
  const flat = curveFamily(sequence("point", [0, 1000], [[[300, 300], [300, 300]], [[300, 300], [300, 300]]]), { motion: 1, frame: frameAt(300, 300) });
  assert.throws(() => splineDeposit(flat, { seed: 1, window: { start: 0, end: 1000 }, deposit: 3, grainMass: 2, fall: rest }), /never has any length/);
  // One grain for the whole sequence (it leaves at 1882 ms for seed 1): a window before it holds mass but no grain.
  const one = { seed: 1, deposit: 0.001, grainMass: 100, fall: rest };
  assert.equal(splineDeposit(stillFamily, { ...one, window: full }).grains.length, 1);
  assert.throws(() => splineDeposit(stillFamily, { ...one, window: { start: 0, end: 1800 } }), /No grain leaves inside the window; raise the deposit, lower the grain mass or widen the window/);
  const q = createInstrument("sand-deposition").params;
  assert.throws(() => validateParameters("sand-deposition", { ...q, material: "isolines", isoSmooth: 100, fieldCell: 2 }), /Smoothing spans 150 cells; the limit is 60/);
  assert.throws(() => validateParameters("sand-deposition", { ...q, sequence: "nope" }), /sequence/);
});
