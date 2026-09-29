import assert from "node:assert/strict";
import test from "node:test";
import {
  atEach, bristleBand, bundledRecording, bundledRecordingIds, bundledRecordingInfo, canPrepareInstrument, countStations, createInstrument,
  createRecording, drawGestureScore, echoTrack, gesturePath, gestureScoreComposition, gestureScoreProducts, gestureSites, gestureTrack,
  mapPressure, motif, pathMaterial, prepareInstrument, recordingData, recordingFingerprint, resolvePressure, sandGrains, speedPressure,
  stations, strokeWith, usesSeed, validateParameters,
  type CompositionSurface, type GestureFrame, type GestureScoreComposition, type PressurePolicy, type RecordingData,
} from "../dist/index.js";
import { TrackCursor } from "../dist/composition/recording.js";

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: string[] = [];
  #note(name: string, args: unknown[]) { this.ops.push(`${name}(${args.map((value) => typeof value === "number" ? Number(value.toFixed(9)) : String(value)).join(",")})`); }
  push() { this.#note("push", []); } pop() { this.#note("pop", []); }
  translate(...a: number[]) { this.#note("translate", a); } rotate(...a: number[]) { this.#note("rotate", a); }
  scale(...a: number[]) { this.#note("scale", a); }
  noFill() { this.#note("noFill", []); } noStroke() { this.#note("noStroke", []); }
  fill(...a: number[]) { this.#note("fill", a); } stroke(...a: number[]) { this.#note("stroke", a); }
  strokeWeight(...a: number[]) { this.#note("strokeWeight", a); } strokeCap(...a: unknown[]) { this.#note("strokeCap", a); }
  circle(...a: number[]) { this.#note("circle", a); } line(...a: number[]) { this.#note("line", a); }
  rect(...a: number[]) { this.#note("rect", a); } beginShape() { this.#note("beginShape", []); }
  vertex(...a: number[]) { this.#note("vertex", a); } endShape(...a: unknown[]) { this.#note("endShape", a); }
}

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const TAU = Math.PI * 2;
const identity = (cx: number, cy: number): GestureFrame => ({ centerX: cx, centerY: cy, scale: 1, rotation: 0 });
const recorded: PressurePolicy = { source: "recorded", whenAbsent: "reject", level: 0.5 };
const rec = (id: string, t: number[], x: number[], y: number[], pressure: number[] | null = null) => createRecording({ id, t, x, y, pressure });

/** A constant-velocity horizontal stroke, 2 units/ms, irregular timestamps, pressure ramping 0 to 1. */
const ramp = rec("ramp", [0, 10, 35, 36, 100], [100, 120, 170, 172, 300], [50, 50, 50, 50, 50], [0, 0.1, 0.35, 0.36, 1]);
const rampTrack = (smoothing = 0) => gestureTrack(ramp, { smoothing, frame: identity(200, 50) });

/** Two samplings of one closed-form curve; the endpoints are exact, interior events are jittered. */
const T = 2600;
const curve = (t: number): [number, number] => [320 + 200 * Math.sin(TAU * 1.3 * t / T), 320 + 150 * Math.sin(TAU * 2.1 * t / T + 0.5)];
const jitter = (i: number, salt: number) => { let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 2 ** 32 * 2 - 1; };
function sampled(hz: number, spread: number, salt: number) {
  const period = 1000 / hz, t = [0];
  for (let i = 1; i * period < T - 0.3 * period; i++) t.push(i * period + jitter(i, salt) * spread * period);
  t.push(T);
  return rec(`curve@${hz}`, t, t.map((v) => curve(v)[0]), t.map((v) => curve(v)[1]), t.map((v) => 0.5 + 0.4 * Math.sin(TAU * 1.7 * v / T)));
}

test("recordings are validated, copied and frozen; pressure absence is an explicit state", () => {
  const data: RecordingData = { id: "r", t: [0, 5, 9], x: [1, 2, 3], y: [4, 5, 6], pressure: [0, 0.5, 1] };
  const made = createRecording(data);
  data.x[0] = 99; data.t.push(11);
  assert.deepEqual([...made.x], [1, 2, 3]);
  assert.equal(made.length, 3);
  assert.equal(made.duration, 9);
  assert.ok(Object.isFrozen(made) && Object.isFrozen(made.t) && Object.isFrozen(made.x) && Object.isFrozen(made.pressure));
  assert.deepEqual(recordingData(made), { id: "r", t: [0, 5, 9], x: [1, 2, 3], y: [4, 5, 6], pressure: [0, 0.5, 1] });
  const bare = createRecording({ ...recordingData(made), pressure: null });
  assert.equal(bare.pressure, null);
  assert.throws(() => createRecording({ id: "r", t: [0, 5], x: [1, 2], y: [4, 5] } as unknown as RecordingData), /missing pressure.*use null/);
  assert.throws(() => createRecording({ ...recordingData(made), pressure: undefined } as unknown as RecordingData), /missing pressure/);
  assert.throws(() => createRecording({ ...recordingData(made), extra: 1 } as unknown as RecordingData), /unknown field: extra/);
  // Absent pressure is a different value from any constant pressure.
  assert.notEqual(recordingFingerprint(bare), recordingFingerprint(createRecording({ ...recordingData(made), pressure: [1, 1, 1] })));
  assert.notEqual(recordingFingerprint(bare), recordingFingerprint(createRecording({ ...recordingData(made), pressure: [0, 0, 0] })));
  assert.equal(recordingFingerprint(made), recordingFingerprint(createRecording(recordingData(made))));
});

test("timestamps must strictly increase and every channel must be finite, in range and equally long", () => {
  const good = { id: "r", t: [0, 5, 9], x: [1, 2, 3], y: [4, 5, 6], pressure: null };
  for (const t of [[0, 5, 5], [0, 5, 4], [0, NaN, 9], [9, 5, 0]]) assert.throws(() => createRecording({ ...good, t }), /timestamps must strictly increase|finite/);
  assert.throws(() => createRecording({ ...good, t: [0, 5, 5] }), /t\[2\] = 5 does not exceed t\[1\] = 5/);
  assert.throws(() => createRecording({ ...good, x: [1, 2] }), /x has 2 samples but t has 3/);
  assert.throws(() => createRecording({ ...good, y: [4, Infinity, 6] }), /y\[1\]/);
  assert.throws(() => createRecording({ ...good, x: [1, 2, 2e6] }), /x\[2\]/);
  assert.throws(() => createRecording({ ...good, pressure: [0, 1.01, 1] }), /pressure\[1\]/);
  assert.throws(() => createRecording({ ...good, pressure: [0, -0.01, 1] }), /pressure\[1\]/);
  assert.throws(() => createRecording({ ...good, t: [0], x: [1], y: [4] }), /needs 2 to/);
  assert.throws(() => createRecording({ ...good, t: [0, 5, 700_000] }), /limit is 600000 ms/);
  assert.throws(() => createRecording({ ...good, id: "" }), /id/);
  assert.equal(createRecording({ ...good, t: [1000, 1005, 1009] }).duration, 9, "timestamps need not start at zero");
});

test("reconstruction is exact for constant velocity on irregular timestamps", () => {
  const track = rampTrack();
  const cursor = new TrackCursor(track, track.pressure!);
  for (const time of [0, 3.3, 10, 17.3, 35.5, 36, 60.25, 99.9, 100]) {
    cursor.at(time);
    near(cursor.x, 100 + 2 * time, 1e-9, `x(${time})`);
    near(cursor.y, 50, 1e-9);
    near(cursor.speed, 2000, 1e-6, `speed(${time})`);
    near(cursor.tx, 1, 1e-12);
    near(cursor.arc, 2 * time, 1e-9);
  }
  near(track.length, 200, 1e-9);
  near(track.step, 100 / Math.ceil(100 / 4), 1e-12);
  assert.ok(Object.isFrozen(track) && Object.isFrozen(track.x) && Object.isFrozen(track.speed));
});

test("an exact rest stays still: no swing out and back, no overshoot", () => {
  const still = rec("rest", [0, 10, 20, 30, 40], [0, 0, 0, 10, 20], [0, 0, 0, 0, 0]);
  const track = gestureTrack(still, { smoothing: 0, frame: identity(10, 0) });
  for (let j = 0; j < track.count; j++) {
    const time = j * track.step;
    if (time <= 20) near(track.x[j], 0, 1e-9, `x during rest at ${time}`);
    if (j > 0) assert.ok(track.x[j] >= track.x[j - 1] - 1e-12, `x must not decrease (${time})`);
    assert.ok(track.x[j] >= -1e-12 && track.x[j] <= 20 + 1e-12);
  }
  // The direction of the rest is carried from the movement that follows it, never undefined.
  assert.ok(track.tx.every((v, j) => Number.isFinite(v) && Number.isFinite(track.ty[j]) && Math.abs(Math.hypot(v, track.ty[j]) - 1) < 1e-9));
  near(track.tx[0], 1, 1e-12);
});

test("smoothing keeps the end points, straight runs and pressure range, and never edits the recording", () => {
  const before = recordingFingerprint(ramp);
  const line = rampTrack(80);
  for (let j = 0; j < line.count; j++) near(line.x[j], 100 + 2 * (j * line.step), 1e-6, `smoothed line ${j}`);
  assert.equal(recordingFingerprint(ramp), before);
  assert.equal(line.recording, ramp);
  assert.deepEqual([...ramp.x], [100, 120, 170, 172, 300]);
  // A zig-zag is genuinely smoothed, its ends stay put, and smoothing more smooths more.
  const zig = rec("zig", [0, 10, 20, 30, 40, 50, 60, 70, 80], [0, 10, 0, 10, 0, 10, 0, 10, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const rough = (smoothing: number) => {
    const track = gestureTrack(zig, { smoothing, frame: identity(5, 0) });
    let sum = 0;
    for (let j = 1; j < track.count - 1; j++) sum += (track.x[j - 1] - 2 * track.x[j] + track.x[j + 1]) ** 2;
    return { sum, track };
  };
  const [none, some, more] = [0, 8, 24].map(rough);
  assert.ok(none.sum > some.sum * 4 && some.sum > more.sum * 4, `${none.sum} ${some.sum} ${more.sum}`);
  near(more.track.x[0], none.track.x[0], 1e-9); near(more.track.x[more.track.count - 1], none.track.x[none.track.count - 1], 1e-9);
  near(more.track.y[0], none.track.y[0], 1e-9);
  // Pressure with a step stays inside [0, 1] and passes through the middle at the step.
  const stepped = rec("step", [0, 100, 101, 200], [0, 50, 51, 100], [0, 0, 0, 0], [0, 0, 1, 1]);
  const track = gestureTrack(stepped, { smoothing: 30, frame: identity(50, 0) });
  assert.ok(track.pressure!.every((v) => v >= -1e-12 && v <= 1 + 1e-12));
  const mid = track.pressure![Math.round((100.5 / 200) * (track.count - 1))];
  near(mid, 0.5, 0.05);
  assert.equal(track.pressure![0], 0, "the first pressure stays exactly as recorded");
});

test("the frame is a similarity about the reconstruction's centre: centre, scale and turn", () => {
  const line = rec("line", [0, 50, 100], [0, 100, 200], [0, 0, 0]);
  const frame = { centerX: 300, centerY: 200, scale: 2, rotation: 90 };
  const track = gestureTrack(line, { smoothing: 0, frame });
  // Raw extent centre (100, 0): the start (-100, 0) turns a quarter turn clockwise on screen to (0, -100), then doubles.
  near(track.x[0], 300, 1e-9); near(track.y[0], 200 - 200, 1e-9);
  near(track.x[track.count - 1], 300, 1e-9); near(track.y[track.count - 1], 200 + 200, 1e-9);
  near(track.length, 400, 1e-9);
  near(track.speed[5], 4000, 1e-6, "speed scales with the frame (2 units/ms raw, doubled)");
  near(track.tx[5], 0, 1e-12); near(track.ty[5], 1, 1e-12);
  // The anchor does not move when the same path is sampled differently.
  const dense = rec("line-dense", [0, 25, 50, 75, 100], [0, 50, 100, 150, 200], [0, 0, 0, 0, 0]);
  const other = gestureTrack(dense, { smoothing: 0, frame });
  near(other.x[0], track.x[0], 1e-9); near(other.y[0], track.y[0], 1e-9);
});

test("replay does not depend on the device event frequency", () => {
  const frame = identity(320, 320);
  const slow = gestureTrack(sampled(30, 0.45, 1), { smoothing: 0, frame }), fast = gestureTrack(sampled(240, 0.3, 2), { smoothing: 0, frame });
  const window = { start: 0, end: T };
  const timeRule = { kind: "time", interval: 50 } as const, arcRule = { kind: "arc", spacing: 6 } as const;
  const a = gesturePath(slow, { seed: 1, sampling: timeRule, window, pressure: recorded }), b = gesturePath(fast, { seed: 1, sampling: timeRule, window, pressure: recorded });
  assert.equal(a.points.length, b.points.length);
  const anchor = [slow.x[0] - curve(0)[0], slow.y[0] - curve(0)[1]];
  for (let i = 0; i < a.points.length; i++) {
    // Same moments, same place: the two agree, and both match the analytic curve, within 0.1 units on a 400-unit extent.
    near(a.times[i], b.times[i], 1e-9);
    assert.ok(Math.hypot(a.points[i][0] - b.points[i][0], a.points[i][1] - b.points[i][1]) < 0.1, `time station ${i}`);
    const [tx, ty] = curve(a.times[i]);
    assert.ok(Math.hypot(a.points[i][0] - (tx + anchor[0]), a.points[i][1] - (ty + anchor[1])) < 0.1, `analytic ${i}`);
    near(a.pressure[i], 0.5 + 0.4 * Math.sin(TAU * 1.7 * a.times[i] / T), 0.005, "recorded pressure replayed at the same moment");
  }
  const c = gesturePath(slow, { seed: 1, sampling: arcRule, window, pressure: recorded }), d = gesturePath(fast, { seed: 1, sampling: arcRule, window, pressure: recorded });
  assert.ok(Math.abs(c.points.length - d.points.length) <= 1);
  for (let i = 0; i < Math.min(c.points.length, d.points.length) - 1; i++)
    assert.ok(Math.hypot(c.points[i][0] - d.points[i][0], c.points[i][1] - d.points[i][1]) < 0.1, `arc station ${i}`);
  assert.ok(Math.abs(slow.length - fast.length) / fast.length < 1e-3, "path length agrees to 0.1%");
});

test("stations: grids are anchored at the recording start, so a narrower window keeps every survivor unchanged", () => {
  const track = gestureTrack(sampled(120, 0.3, 4), { smoothing: 20, frame: identity(320, 320) });
  for (const rule of [{ kind: "time", interval: 37 }, { kind: "arc", spacing: 9 }] as const) {
    const wide = stations(track, rule, { start: 0, end: T }), narrow = stations(track, rule, { start: 700.3, end: 1900.7 });
    assert.equal(countStations(track, rule, { start: 700.3, end: 1900.7 }), narrow.indices.length);
    const byIndex = new Map(wide.indices.map((index, i) => [index, wide.times[i]]));
    assert.ok(narrow.indices.length > 10);
    narrow.indices.forEach((index, i) => { assert.equal(byIndex.get(index), narrow.times[i]); assert.ok(narrow.times[i] >= 700.3 && narrow.times[i] <= 1900.7); });
    assert.ok(narrow.indices.length < wide.indices.length);
  }
  // Time stations are exact multiples of the interval; arc stations sit at exact multiples of the spacing.
  const timed = stations(track, { kind: "time", interval: 37 }, { start: 0, end: T });
  timed.indices.forEach((index, i) => near(timed.times[i], index * 37, 1e-9));
  const arced = stations(track, { kind: "arc", spacing: 9 }, { start: 0, end: T });
  const cursor = new TrackCursor(track, speedPressure(track));
  arced.indices.forEach((index, i) => near(cursor.at(arced.times[i]).arc, index * 9, 1e-6, `arc of station ${index}`));
  assert.throws(() => stations(track, { kind: "time", interval: 0.1 }, { start: 0, end: T }), /station interval/);
  assert.throws(() => stations(track, { kind: "arc", spacing: 0.01 }, { start: 0, end: T }), /station spacing/);
  assert.throws(() => stations(track, { kind: "arc", spacing: 5 }, { start: 100, end: 100 }), /must be after/);
});

test("time stations crowd at a rest; arc stations collapse it", () => {
  const spiral = bundledRecording("spiral", 0);
  const track = gestureTrack(spiral, { smoothing: 0, frame: identity(320, 320) });
  // The spiral rests exactly during 30-36% of its time, so its recorded positions repeat there.
  const rest = { start: 1060, end: 1190 };
  const perTime = gesturePath(track, { seed: 1, sampling: { kind: "time", interval: 5 }, window: rest, pressure: recorded });
  const perArc = gesturePath(track, { seed: 1, sampling: { kind: "arc", spacing: 2 }, window: rest, pressure: recorded });
  assert.ok(perTime.points.length > 20, "one station per 5 ms even while nothing moves");
  assert.ok(perTime.points.every(([x, y]) => Math.hypot(x - perTime.points[0][0], y - perTime.points[0][1]) < 0.5));
  assert.ok(perArc.points.length <= 3, "no path travelled, no stations besides the window ends");
});

test("pressure policy: recorded, speed and constant are explicit and report what supplied the values", () => {
  const withPressure = rampTrack(), bare = gestureTrack(rec("bare", [0, 10, 35, 36, 100], [100, 120, 170, 172, 300], [50, 50, 50, 50, 50]), { smoothing: 0, frame: identity(200, 50) });
  assert.equal(resolvePressure(withPressure, recorded).source, "recorded");
  assert.equal(resolvePressure(withPressure, recorded).values, withPressure.pressure);
  assert.throws(() => resolvePressure(bare, recorded), /Recording "bare" has no pressure channel; choose speed or constant/);
  const viaSpeed = resolvePressure(bare, { ...recorded, whenAbsent: "speed" }), viaConstant = resolvePressure(bare, { ...recorded, whenAbsent: "constant", level: 0.3 });
  assert.equal(viaSpeed.source, "speed"); assert.equal(viaConstant.source, "constant");
  assert.ok(viaConstant.values.every((v) => v === 0.3));
  assert.equal(resolvePressure(withPressure, { source: "constant", whenAbsent: "reject", level: 0.9 }).source, "constant");
  assert.equal(resolvePressure(withPressure, { source: "speed", whenAbsent: "reject", level: 0 }).source, "speed");
  // Constant velocity: every moment is the median speed, so speed pressure is 1 / (1 + 1) = 1/2.
  assert.ok(viaSpeed.values.every((v) => Math.abs(v - 0.5) < 1e-9));
  const path = gesturePath(bare, { seed: 1, sampling: { kind: "arc", spacing: 20 }, window: { start: 0, end: 100 }, pressure: { ...recorded, whenAbsent: "speed" } });
  assert.equal(path.pressureSource, "speed");
  assert.throws(() => resolvePressure(withPressure, { ...recorded, level: 1.5 }), /pressure level/);
  assert.throws(() => resolvePressure(withPressure, { ...recorded, whenAbsent: "zero" as never }), /missing-pressure policy/);
  // Speed pressure ignores the frame's scale, and a rest presses fully.
  const rested = rec("rested", [0, 100, 200, 300], [0, 100, 100, 200], [0, 0, 0, 0]);
  const small = speedPressure(gestureTrack(rested, { smoothing: 0, frame: identity(0, 0) })), big = speedPressure(gestureTrack(rested, { smoothing: 0, frame: { ...identity(0, 0), scale: 3 } }));
  small.forEach((v, j) => near(v, big[j], 1e-9));
  assert.ok(Math.max(...small) > 0.999);
  // Mapping: zero pressure gives the floor, full pressure 1, and the curve bends it.
  near(mapPressure(0, { floor: 0.2, curve: 2 }), 0.2); near(mapPressure(1, { floor: 0.2, curve: 2 }), 1); near(mapPressure(0.5, { floor: 0.2, curve: 2 }), 0.2 + 0.8 * 0.25);
});

test("a gesture path is a Path with per-point channels, window ends and stations at exact arc spacing", () => {
  const track = rampTrack();
  const path = gesturePath(track, { seed: 9, sampling: { kind: "arc", spacing: 25 }, window: { start: 20, end: 90 }, pressure: recorded });
  assert.equal(path.id, "ramp");
  assert.equal(path.closed, false);
  assert.ok(Object.isFrozen(path) && Object.isFrozen(path.points) && Object.isFrozen(path.times));
  assert.deepEqual(path.window, [20, 90]);
  near(path.times[0], 20, 1e-12); near(path.times.at(-1)!, 90, 1e-12);
  near(path.points[0][0], 140, 1e-9); near(path.points.at(-1)![0], 280, 1e-9);
  // Interior stations at multiples of 25 along the path (arc = 2 * time + 0), from the recording start, not from the window.
  const interior = path.arcs.slice(1, -1);
  assert.deepEqual(interior.map((v) => Math.round(v * 1e6) / 1e6), [50, 75, 100, 125, 150, 175]);
  path.angles.forEach((angle) => near(angle, 0, 1e-12));
  path.speeds.forEach((v) => near(v, 2000, 1e-6));
  // Pressure ramps linearly with the recorded samples between 35 and 36 ms and equals p(t) at the stations of a linear stretch.
  const p35 = path.pressure[path.times.findIndex((t) => Math.abs(t - 25) < 1e-9)];
  near(p35, 0.1 + (0.35 - 0.1) * (25 - 10) / (35 - 10), 0.01);
  assert.equal(gesturePath(track, { seed: 9, sampling: { kind: "arc", spacing: 25 }, window: { start: 20, end: 90 }, pressure: recorded }), path, "cached by construction");
  assert.notEqual(gesturePath(track, { seed: 10, sampling: { kind: "arc", spacing: 25 }, window: { start: 20, end: 90 }, pressure: recorded }).seed, path.seed);
});

/** A straight horizontal stroke at full pressure: hair offsets are then exactly their stable lateral draws. */
const straight = rec("straight", [0, 1000], [0, 600], [0, 0], [1, 1]);
const straightTrack = gestureTrack(straight, { smoothing: 0, frame: identity(300, 300) });
const straightPath = gesturePath(straightTrack, { seed: 3, sampling: { kind: "arc", spacing: 10 }, window: { start: 0, end: 1000 }, pressure: recorded });
const brush = { seed: 3, hairs: 20, width: 40, map: { floor: 0, curve: 1 }, dryness: 0, depletion: 0, wander: 0 };

test("bristles: each hair sits in its own lateral stratum of the brush width, ordered and stable", () => {
  const hairs = bristleBand(straightPath, brush);
  const byHair = new Map<number, { y: number; x: number }[]>();
  for (const hair of hairs) {
    const k = Number(/hair:(\d+)@/.exec(hair.id)![1]);
    byHair.set(k, [...(byHair.get(k) ?? []), ...hair.points.map(([x, y]) => ({ x, y: y - 300 }))]);
    assert.ok(Object.isFrozen(hair.points));
    assert.equal(hair.tone, 0);
  }
  assert.equal(byHair.size, 20);
  for (let k = 0; k < 20; k++) {
    const ys = byHair.get(k)!.map((p) => p.y);
    for (const y of ys) {
      assert.ok(y >= (-1 + 2 * k / 20) * 20 - 1e-9 && y <= (-1 + 2 * (k + 1) / 20) * 20 + 1e-9, `hair ${k} at y=${y}`);
      near(y, ys[0], 1e-9, "a straight stroke with no waver gives a straight hair");
    }
    // Ragged entry: a hair first touches after at most 36 units of path.
    assert.ok(Math.min(...byHair.get(k)!.map((p) => p.x)) - 0 <= 36 + 10 + 1e-9);
  }
  // Width scales the offsets, never the ids or the hairs' extent along the path.
  const wider = bristleBand(straightPath, { ...brush, width: 80 });
  assert.deepEqual(wider.map((hair) => hair.id), hairs.map((hair) => hair.id));
  wider.forEach((hair, i) => hair.points.forEach(([x, y], j) => { near(x, hairs[i].points[j][0], 1e-9); near(y - 300, 2 * (hairs[i].points[j][1] - 300), 1e-9); }));
});

test("bristles lift with light pressure and run dry along the stroke", () => {
  const light = rec("light", [0, 1000], [0, 600], [0, 0], [0.15, 0.15]);
  const lightPath = gesturePath(gestureTrack(light, { smoothing: 0, frame: identity(300, 300) }), { seed: 3, sampling: { kind: "arc", spacing: 10 }, window: { start: 0, end: 1000 }, pressure: recorded });
  const points = (paths: readonly { points: readonly unknown[] }[]) => paths.reduce((sum, p) => sum + p.points.length, 0);
  const wet = points(bristleBand(lightPath, brush)), dry = points(bristleBand(lightPath, { ...brush, dryness: 1 }));
  assert.ok(dry < wet * 0.75, `${dry} < ${wet}`);
  assert.equal(points(bristleBand(straightPath, { ...brush, dryness: 1 })) > 0, true);
  // Depletion 1: every hair is gone by 85% of the stroke (`1 - (0.15 + 0.85 u)` is at most 0.85).
  for (const hair of bristleBand(straightPath, { ...brush, depletion: 1 })) for (const [x] of hair.points) assert.ok(x - 0 <= 0.85 * 600 + 1e-6 + 10, `x=${x}`);
  const some = bristleBand(straightPath, { ...brush, depletion: 0.5 });
  assert.ok(points(some) < points(bristleBand(straightPath, brush)));
  assert.throws(() => bristleBand(straightPath, { ...brush, hairs: 401 }), /integer in \[1, 400\]/);
  assert.throws(() => bristleBand(straightPath, { ...brush, hairs: 400 }) && bristleBand(gesturePath(straightTrack, { seed: 3, sampling: { kind: "arc", spacing: 0.2 }, window: { start: 0, end: 1000 }, pressure: recorded }), { ...brush, hairs: 400 }), /limit is 600000/);
  assert.equal(bristleBand(straightPath, brush), bristleBand(straightPath, brush), "cached by construction");
});

test("bristles bunch inside a tight turn instead of crossing over the centre", () => {
  // A full circle of radius 30 drawn with a brush 100 wide: half the width is well beyond the radius.
  const t = Array.from({ length: 121 }, (_, i) => i * 10), turn = (i: number) => TAU * i / 120;
  const circle = rec("circle", t, t.map((_, i) => 320 + 30 * Math.cos(turn(i))), t.map((_, i) => 320 + 30 * Math.sin(turn(i))), t.map(() => 1));
  const track = gestureTrack(circle, { smoothing: 0, frame: identity(320, 320) });
  const path = gesturePath(track, { seed: 3, sampling: { kind: "arc", spacing: 1 }, window: { start: 0, end: 1200 }, pressure: recorded });
  const hairs = bristleBand(path, { ...brush, width: 100, hairs: 40 });
  let inner = 0, checked = 0;
  for (const hair of hairs) {
    // A run is consecutive stations; its first point belongs to the station at the time in its id.
    const first = path.times.findIndex((time) => Math.abs(time - Number(/@([\d.]+)$/.exec(hair.id)![1])) < 1e-3);
    assert.ok(first >= 0);
    hair.points.forEach(([x, y], m) => {
      const [px, py] = path.points[first + m];
      // Signed radial coordinate along the path point's own ray: 30 on the path, 30 - offset inside the turn.
      const along = ((x - 320) * (px - 320) + (y - 320) * (py - 320)) / Math.hypot(px - 320, py - 320);
      checked++;
      assert.ok(along >= 0.1 * 30 - 1.2, `hair point at signed radius ${along}`);
      if (along < 6) inner++;
    });
  }
  assert.ok(checked > 1000 && inner > 100, "the inner hairs pile up near the centre of the turn instead of passing it");
  // A turn wider than the brush is untouched: on a circle of radius 60 the hairs keep their exact strata (offset o at radius 60 - 50 o).
  const gentle = rec("circle60", t, t.map((_, i) => 320 + 60 * Math.cos(turn(i))), t.map((_, i) => 320 + 60 * Math.sin(turn(i))), t.map(() => 1));
  const gentlePath = gesturePath(gestureTrack(gentle, { smoothing: 0, frame: identity(320, 320) }), { seed: 3, sampling: { kind: "arc", spacing: 1 }, window: { start: 0, end: 1200 }, pressure: recorded });
  for (const hair of bristleBand(gentlePath, { ...brush, width: 100, hairs: 20 })) {
    const k = Number(/hair:(\d+)@/.exec(hair.id)![1]);
    for (const [x, y] of hair.points) {
      const r = Math.hypot(x - 320, y - 320);
      assert.ok(r >= 60 - (-1 + 2 * (k + 1) / 20) * 50 - 0.3 && r <= 60 - (-1 + 2 * k / 20) * 50 + 0.3, `hair ${k} at radius ${r}`);
    }
  }
});

test("sand: grains are released on a fixed clock and land after a stable, proportional delay", () => {
  const options = { seed: 5, window: { start: 0, end: 1000 }, pressure: recorded, map: { floor: 0, curve: 1 }, rate: 100, lag: 0, fall: 0, fallAngle: 90, inherit: 0, spread: 0, gate: 0 };
  const grains = sandGrains(straightTrack, options);
  // 100 grains per second over one second, clock ticks j * 10 ms including both ends.
  assert.equal(grains.length, 101);
  grains.forEach((grain, j) => {
    assert.equal(grain.id, `straight/grain:${j}`);
    near(grain.time, j * 10, 1e-9);
    near(grain.position[0], 300 - 300 + 0.6 * grain.time, 1e-6, "with no lag, spread or fall a grain lies on the hand");
    near(grain.position[1], 300, 1e-9);
  });
  // Lag with a downward fall: a grain moves straight down by fall * lag_fraction * lag; doubling the lag doubles each fall.
  const short = sandGrains(straightTrack, { ...options, lag: 400, fall: 100 }), long = sandGrains(straightTrack, { ...options, lag: 800, fall: 100 });
  short.forEach((grain, j) => {
    const drop = grain.position[1] - 300;
    assert.ok(drop >= 0 && drop <= 100 * 0.4 + 1e-9);
    near(grain.position[0], 0.6 * grain.time, 1e-9);
    near(long[j].position[1] - 300, 2 * drop, 1e-9, `grain ${j}`);
    near(grain.angle, Math.PI / 2, 1e-12);
  });
  assert.ok(short.some((grain) => grain.position[1] - 300 > 5) && short.some((grain) => grain.position[1] - 300 < 35), "delays are spread, not constant");
  // Carried motion: a grain keeps a share of the hand's velocity (600 units/s here).
  const thrown = sandGrains(straightTrack, { ...options, lag: 500, fall: 0, inherit: 1 });
  thrown.forEach((grain) => { near(grain.position[1], 300, 1e-9); assert.ok(grain.position[0] >= 0.6 * grain.time - 1e-9 && grain.position[0] <= 0.6 * grain.time + 600 * 0.5 + 1e-9); near(grain.angle, 0, 1e-12); });
  // Scatter is isotropic and stable: same seed, same grains; different seeds move them.
  const scattered = sandGrains(straightTrack, { ...options, spread: 4 }), again = sandGrains(straightTrack, { ...options, spread: 4 });
  assert.equal(scattered, again);
  assert.notDeepEqual(sandGrains(straightTrack, { ...options, spread: 4, seed: 6 }).map((g) => g.position), scattered.map((g) => g.position));
  const dx = scattered.map((g, j) => g.position[0] - grains[j].position[0]), dy = scattered.map((g, j) => g.position[1] - grains[j].position[1]);
  const sd = (values: number[]) => Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
  assert.ok(Math.abs(sd(dx) - 4) < 1 && Math.abs(sd(dy) - 4) < 1, `${sd(dx)} ${sd(dy)}`);
});

test("sand release follows pressure through the gate, in nested sets", () => {
  const half = rec("half", [0, 20_000], [0, 600], [0, 0], [0.5, 0.5]);
  const track = gestureTrack(half, { smoothing: 0, frame: identity(300, 300) });
  const options = { seed: 5, window: { start: 0, end: 20_000 }, pressure: recorded, map: { floor: 0, curve: 1 }, rate: 200, lag: 0, fall: 0, fallAngle: 0, inherit: 0, spread: 0, gate: 0 };
  const all = sandGrains(track, options), gated = sandGrains(track, { ...options, gate: 1 }), soft = sandGrains(track, { ...options, gate: 0.5 });
  assert.equal(all.length, 4001);
  // Release probability equals the mapped pressure 0.5: about 2000 of 4001, within five standard deviations.
  assert.ok(Math.abs(gated.length - 2000.5) < 5 * Math.sqrt(4001 * 0.25), `${gated.length}`);
  const ids = (list: readonly { id: string }[]) => new Set(list.map((g) => g.id));
  assert.ok([...ids(gated)].every((id) => ids(soft).has(id)) && [...ids(soft)].every((id) => ids(all).has(id)), "raising the gate only removes grains");
  assert.ok(soft.length > gated.length && soft.length < all.length);
  assert.throws(() => sandGrains(track, { ...options, rate: 4000 }), /limit is 60000/);
});

test("sand clock: a rest releases grains onto one spot, a narrower window keeps the same grains", () => {
  const track = gestureTrack(bundledRecording("spiral", 0), { smoothing: 0, frame: identity(320, 320) });
  const options = { seed: 2, window: { start: 0, end: 3400 }, pressure: recorded, map: { floor: 0, curve: 1 }, rate: 500, lag: 0, fall: 0, fallAngle: 0, inherit: 0, spread: 0, gate: 0 };
  const all = sandGrains(track, options);
  // The first rest lasts 6% of 3.4 s = 204 ms: at 500 grains per second, most of them on one point.
  const first = all.filter((g) => g.time > 1060 && g.time < 1190);
  assert.ok(first.length >= 60);
  first.forEach((g) => assert.ok(Math.hypot(g.position[0] - first[0].position[0], g.position[1] - first[0].position[1]) < 0.5));
  const narrow = sandGrains(track, { ...options, window: { start: 900, end: 1500 } });
  const byId = new Map(all.map((g) => [g.id, g]));
  assert.ok(narrow.length > 200 && narrow.length < all.length);
  for (const g of narrow) { assert.deepEqual(byId.get(g.id), g); assert.ok(g.time >= 900 && g.time <= 1500); }
});

test("glyph sites: arc spacing, frame, offset across the path, size following pressure, stable ids", () => {
  const options = { seed: 4, window: { start: 0, end: 1000 }, sampling: { kind: "arc", spacing: 50 } as const, pressure: recorded, map: { floor: 0, curve: 1 }, follow: 1, sizeFollow: 0, offset: 0 };
  const sites = gestureSites(straightTrack, options);
  assert.equal(sites.length, 13);
  sites.forEach((site, k) => {
    assert.equal(site.id, `straight/glyph:s${k}`);
    near(site.position[0], 50 * k, 1e-6); near(site.position[1], 300, 1e-9);
    near(site.arc, 50 * k, 1e-6); near(site.angle, 0, 1e-12); assert.equal(site.scale, 1); assert.equal(site.tone, 2);
  });
  // On a canvas (y down), travelling along +x, a positive offset moves to the right of the traveller: +y.
  const beside = gestureSites(straightTrack, { ...options, offset: 12 });
  beside.forEach((site, k) => { near(site.position[0], 50 * k, 1e-6); near(site.position[1], 312, 1e-9); assert.equal(site.id, sites[k].id); });
  // Upright when follow is 0; half way blends the heading (a downward stroke turns by a quarter turn at 0.5).
  const down = gestureTrack(rec("down", [0, 1000], [0, 0], [0, 600], [1, 1]), { smoothing: 0, frame: identity(100, 100) });
  const heading = (follow: number) => gestureSites(down, { ...options, follow })[1].angle;
  near(heading(0), 0, 1e-12); near(heading(1), Math.PI / 2, 1e-12); near(heading(0.5), Math.PI / 4, 1e-12);
  // Pressure size: full pressure is scale 1; pressure 0.25 with sizeFollow 1 gives the mapped factor.
  const soft = gestureTrack(rec("soft", [0, 1000], [0, 600], [0, 0], [0.25, 0.25]), { smoothing: 0, frame: identity(300, 300) });
  gestureSites(soft, { ...options, sizeFollow: 1, map: { floor: 0.2, curve: 2 } }).forEach((site) => near(site.scale, 0.2 + 0.8 * 0.0625, 1e-12));
  gestureSites(soft, { ...options, sizeFollow: 0.5, map: { floor: 0.2, curve: 2 } }).forEach((site) => near(site.scale, 0.5 + 0.5 * (0.2 + 0.8 * 0.0625), 1e-12));
  // A time rule names sites by their time grid.
  assert.equal(gestureSites(straightTrack, { ...options, sampling: { kind: "time", interval: 250 } })[2].id, "straight/glyph:t2");
  assert.equal(gestureSites(straightTrack, options), sites, "cached by construction");
});

test("bundled recordings are deterministic, valid, frozen and differ in rate, regularity and pressure", () => {
  assert.deepEqual([...bundledRecordingIds], ["sweep", "spiral", "loops", "scribble", "wander"]);
  for (const id of bundledRecordingIds) {
    const recording = bundledRecording(id, 42), info = bundledRecordingInfo[id];
    assert.equal(recording.duration, info.duration);
    assert.equal(recording.pressure !== null, info.pressure);
    assert.equal(recording.id, `${id}:42`);
    assert.equal(recording.t[0], 0);
    assert.ok(Object.isFrozen(recording));
    assert.deepEqual(recordingData(recording), recordingData(createRecording(recordingData(recording))));
    // The event rate is near the nominal one and the timestamps are irregular.
    const gaps = recording.t.slice(1).map((t, i) => t - recording.t[i]);
    near(gaps.reduce((s, g) => s + g, 0) / gaps.length, 1000 / info.rate, 1000 / info.rate * 0.05, `${id} mean period`);
    assert.ok(Math.max(...gaps) > Math.min(...gaps) * 1.2, `${id} has irregular timestamps`);
  }
  assert.equal(bundledRecording("sweep", 42), bundledRecording("sweep", 42));
  assert.deepEqual(recordingData(bundledRecording("loops", 1)).x.slice(0, 5), recordingData(bundledRecording("loops", 1)).x.slice(0, 5));
  // Each seed is a different take: same duration and nominal rate, different curve and timing.
  for (const id of bundledRecordingIds) assert.notDeepEqual(recordingData(bundledRecording(id, 1)).x, recordingData(bundledRecording(id, 2)).x, id);
  // The spiral has exact rests: at least 10 consecutive identical positions within each.
  const spiral = bundledRecording("spiral", 7);
  let run = 1, longest = 0, runs = 0;
  for (let i = 1; i < spiral.length; i++) {
    if (spiral.x[i] === spiral.x[i - 1] && spiral.y[i] === spiral.y[i - 1]) { run++; longest = Math.max(longest, run); if (run === 6) runs++; } else run = 1;
  }
  assert.equal(runs, 2, "two rests");
  assert.ok(longest >= 10, `${longest}`);
  assert.throws(() => bundledRecording("nope" as never, 1), /Unknown bundled recording/);
});

const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42): GestureScoreComposition => {
  const input = createInstrument("gesture-scores");
  return gestureScoreComposition({ ...input, seed, params: { ...input.params, ...params } });
};

test("the instrument resolves stored scalars to a typed, JSON-compatible descriptor", () => {
  const recipe = recipeFor();
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), recipe);
  assert.equal(recipe.kind, "gesture-scores");
  assert.deepEqual(recipe.recording, { kind: "bundled", id: "sweep" });
  assert.deepEqual(recipe.window, { start: 0, end: 2600 });
  assert.deepEqual(recipeFor({ windowStart: 0.25, windowLength: 0.5 }).window, { start: 650, end: 1950 });
  assert.equal(recipeFor({ windowStart: 0.9, windowLength: 0.5 }).window.end, 2600, "the window stops at the end of the recording");
  assert.deepEqual(recipeFor({ sampling: "time", pathInterval: 30 }).sampling, { kind: "time", interval: 30 });
  assert.deepEqual(recipe.sampling, { kind: "arc", spacing: 2 });
  assert.equal(recipeFor({ line: "none" }).line, null);
  assert.equal(recipeFor({ sandMark: "none" }).sand, null);
  assert.equal(recipeFor({ glyphMark: "none" }).glyphs, null);
  assert.equal(recipeFor({ bristles: false }).bristles, null);
  assert.throws(() => gestureScoreComposition({ ...createInstrument("motif-ecologies") }), /Not a gesture-scores input/);
  assert.throws(() => recipeFor({ recording: "unknown" }), /not an available option/);
  assert.throws(() => recipeFor({ windowLength: 1.5 }), /between 0.01 and 1/);
  assert.throws(() => recipeFor({ sandRate: 1200, echoes: 16, windowLength: 1, recording: "scribble" }), /limit is 60000/);
  assert.throws(() => recipeFor({ sampling: "time", pathInterval: 1, hairs: 400, echoes: 16 }), /limit is 600000/);
});

test("changing a material or mark never touches the recording, the track or any derived value", () => {
  const base = gestureScoreProducts(recipeFor());
  const restyled = gestureScoreProducts(recipeFor({ hairWeight: 2.5, sandMark: "rings", sandSize: 9, sandWeight: 2, sandVariation: 0.9, sandRetention: 0.5,
    glyphMark: "rosette", glyphSize: 40, glyphPetals: 9, glyphOpening: 0.6, glyphVariation: 0.7, glyphRetention: 0.4, line: "stitch", stitchSpacing: 12 }));
  assert.equal(restyled[0].track, base[0].track);
  assert.equal(restyled[0].track.recording, base[0].track.recording);
  assert.equal(restyled[0].hairs, base[0].hairs);
  assert.equal(restyled[0].grains, base[0].grains);
  assert.equal(restyled[0].glyphs, base[0].glyphs);
  assert.equal(restyled[0].path, base[0].path);
  // Palette is not part of any derived value either.
  const input = createInstrument("gesture-scores");
  const other = gestureScoreProducts(gestureScoreComposition({ ...input, palette: [0x111111, 0x222222] }));
  assert.equal(other[0].hairs, base[0].hairs);
  // But drawing does change with material.
  const a = new Recorder(), b = new Recorder();
  drawGestureScore(a, recipeFor()); drawGestureScore(b, recipeFor({ hairWeight: 2.5 }));
  assert.notDeepEqual(a.ops, b.ops);
});

test("one time window reshapes every consumer coherently", () => {
  const whole = gestureScoreProducts(recipeFor({ line: "ink" }))[0], part = gestureScoreProducts(recipeFor({ line: "ink", windowStart: 0.3, windowLength: 0.35 }))[0];
  const [t0, t1] = [0.3 * 2600, 0.65 * 2600];
  assert.equal(part.track, whole.track, "the track is the same replay");
  near(part.path!.window[0], t0, 1e-9); near(part.path!.window[1], t1, 1e-9);
  assert.ok(part.path!.times.every((t) => t >= t0 - 1e-9 && t <= t1 + 1e-9));
  // Every consumer reads the same window; nothing survives outside it (sand may only land outside).
  assert.ok(part.hairs.length > 0 && part.hairs.every((hair) => hair.id.startsWith("sweep:42/hair:") && Number(/@([\d.]+)$/.exec(hair.id)![1]) >= t0 - 1e-9 && Number(/@([\d.]+)$/.exec(hair.id)![1]) <= t1));
  assert.ok(part.grains.length > 0 && part.grains.every((g) => g.time >= t0 && g.time <= t1));
  assert.ok(part.glyphs.length > 0 && part.glyphs.every((g) => g.time >= t0 - 1e-9 && g.time <= t1 + 1e-9));
  // Survivors are the same values: glyph and grain identity, position and frame do not move.
  const glyphs = new Map(whole.glyphs.map((g) => [g.id, g])), grains = new Map(whole.grains.map((g) => [g.id, g]));
  for (const g of part.glyphs) assert.deepEqual(glyphs.get(g.id), g);
  for (const g of part.grains) assert.deepEqual(grains.get(g.id), g);
  assert.ok(part.glyphs.length < whole.glyphs.length && part.grains.length < whole.grains.length);
  // Hair vertices inside the window are the whole stroke's vertices: same offsets, depletion, ragged entry.
  const inWindow = (paths: readonly { points: readonly (readonly [number, number])[] }[]) => new Set(paths.flatMap((p) => p.points.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`)));
  const wholeVertices = inWindow(whole.hairs);
  const missing = [...inWindow(part.hairs)].filter((v) => !wholeVertices.has(v));
  assert.ok(missing.length < part.hairs.reduce((s, h) => s + h.points.length, 0) * 0.02, "only the cut ends differ");
});

test("smoothing is shared by every consumer and moves the same replay", () => {
  const raw = gestureScoreProducts(recipeFor({ smoothing: 0 }))[0], soft = gestureScoreProducts(recipeFor({ smoothing: 120 }))[0];
  assert.notEqual(raw.track, soft.track);
  assert.equal(raw.track.recording, soft.track.recording);
  assert.notDeepEqual(raw.glyphs.map((g) => g.position), soft.glyphs.map((g) => g.position));
  near(soft.track.x[0], raw.track.x[0], 1e-9, "the start stays where it was recorded");
  near(soft.track.y.at(-1)!, raw.track.y.at(-1)!, 1e-9);
});

test("repeats are the whole replay turned and moved, with their own ids and randomness", () => {
  const one = gestureScoreProducts(recipeFor({ echoes: 1 })), four = gestureScoreProducts(recipeFor({ echoes: 4, echoX: 10, echoY: -5, echoTurn: 20 }));
  assert.equal(four.length, 4);
  assert.equal(four[0].track, one[0].track);
  assert.equal(four[0].hairs, one[0].hairs);
  const base = four[0].track;
  const centerX = 320, centerY = 320;
  for (let i = 1; i < 4; i++) {
    const track = four[i].track, angle = 20 * i * Math.PI / 180;
    assert.equal(track.id, `sweep:42~${i}`);
    assert.equal(track.arc, base.arc, "arc length and speed are shared");
    for (const j of [0, 100, 300, base.count - 1]) {
      const ux = base.x[j] - centerX, uy = base.y[j] - centerY;
      near(track.x[j], centerX + ux * Math.cos(angle) - uy * Math.sin(angle) + 10 * i, 1e-9);
      near(track.y[j], centerY + ux * Math.sin(angle) + uy * Math.cos(angle) - 5 * i, 1e-9);
    }
    assert.ok(four[i].glyphs[0].id.startsWith(`sweep:42~${i}/`));
    assert.notEqual(four[i].hairs[0].seed, four[0].hairs[0].seed);
  }
  assert.equal(echoTrack(base, { index: 0, turn: 5, dx: 1, dy: 1, pivotX: 0, pivotY: 0 }), base);
  assert.throws(() => recipeFor({ echoes: 17 }), /between 1 and 16/);
});

test("the descriptor and ordinary functions draw operation for operation; callbacks replace consumers", () => {
  const recipe = recipeFor({ line: "stitch", echoes: 2 });
  const viaDescriptor = new Recorder();
  drawGestureScore(viaDescriptor, recipe);
  const parts = gestureScoreProducts(recipe), viaFunctions = new Recorder();
  const spec = { kind: "ink", weight: recipe.bristles!.weight, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } } as const;
  for (const part of parts) strokeWith(viaFunctions, part.hairs, pathMaterial(spec, recipe.palette));
  const line = pathMaterial(recipe.line!, recipe.palette);
  for (const part of parts) strokeWith(viaFunctions, [part.path!], (surface, path, run) => line(surface, { ...path, tone: 1 }, run));
  for (const part of parts) atEach(viaFunctions, part.grains, motif(recipe.sand!.mark, recipe.palette));
  for (const part of parts) atEach(viaFunctions, part.glyphs, motif(recipe.glyphs!.mark, recipe.palette));
  assert.deepEqual(viaDescriptor.ops, viaFunctions.ops);
  // Substituting the sand consumer keeps every producer value the same objects.
  const seen: string[] = [];
  const substituted = new Recorder();
  drawGestureScore(substituted, recipe, { sand: (surface, site) => { seen.push(site.id); surface.circle(0, 0, 1); } });
  assert.deepEqual(seen, parts.flatMap((part) => part.grains.map((g) => g.id)));
  assert.equal(gestureScoreProducts(recipe)[0].grains, parts[0].grains);
  // Zero-size or zero-retention marks draw nothing and skip their producers.
  const none = new Recorder();
  drawGestureScore(none, recipeFor({ sandMark: "none", glyphMark: "none", bristles: false }));
  assert.deepEqual(none.ops, []);
});

test("a recording without pressure replays through speed, and says so", () => {
  const products = gestureScoreProducts(recipeFor({ recording: "scribble" }))[0];
  assert.equal(products.track.pressure, null);
  assert.equal(products.path!.pressureSource, "speed");
  assert.equal(gestureScoreProducts(recipeFor({ recording: "scribble", pressureSource: "constant", pressureLevel: 0.7 }))[0].path!.pressureSource, "constant");
  assert.equal(gestureScoreProducts(recipeFor({ recording: "sweep" }))[0].path!.pressureSource, "recorded");
  // Recorded pressure and speed pressure give genuinely different strokes for the same recording.
  const speed = gestureScoreProducts(recipeFor({ pressureSource: "speed" }))[0].path!.pressure;
  assert.ok(speed.some((v, i) => Math.abs(v - gestureScoreProducts(recipeFor())[0].path!.pressure[i]) > 0.2));
});

test("seeds change the take, the bristles and the sand, not only their colour", () => {
  const a = gestureScoreProducts(recipeFor({}, 1))[0], b = gestureScoreProducts(recipeFor({}, 2))[0];
  assert.notDeepEqual([...a.track.x].slice(0, 50), [...b.track.x].slice(0, 50));
  assert.notEqual(a.hairs.length === b.hairs.length && a.hairs[0].points[0][1] === b.hairs[0].points[0][1], true);
  const w1 = gestureScoreProducts(recipeFor({ recording: "wander" }, 1))[0], w2 = gestureScoreProducts(recipeFor({ recording: "wander" }, 2))[0];
  const box = (t: typeof w1.track) => [Math.min(...t.x), Math.max(...t.x), Math.min(...t.y), Math.max(...t.y)];
  assert.notDeepEqual(box(w1.track).map(Math.round), box(w2.track).map(Math.round));
  const input = createInstrument("gesture-scores");
  assert.equal(usesSeed(input), true);
  assert.equal(usesSeed({ ...input, params: { ...input.params, sandMark: "none", glyphMark: "none", bristles: false } }), false);
  assert.equal(usesSeed({ ...input, params: { ...input.params, sandMark: "none", glyphMark: "none", bristles: false, recording: "wander" } }), true);
});

test("preparation builds the producers cooperatively and honours cancellation", async () => {
  assert.equal(canPrepareInstrument("gesture-scores"), true);
  const input = createInstrument("gesture-scores");
  const withRepeats = { ...input, params: { ...input.params, echoes: 3 } };
  assert.equal(await prepareInstrument(withRepeats, () => false), true);
  assert.equal(await prepareInstrument(withRepeats, () => true), false);
  let calls = 0;
  assert.equal(await prepareInstrument(withRepeats, () => ++calls > 2), false, "cancelling between repeats stops preparation");
  // After preparation, drawing needs no new producers: the cached objects are reused.
  const products = gestureScoreProducts(gestureScoreComposition(withRepeats));
  assert.equal(products[2].glyphs, gestureScoreProducts(gestureScoreComposition(withRepeats))[2].glyphs);
});

test("failures name the control to change and nothing is truncated", () => {
  assert.throws(() => validateParameters("gesture-scores", { ...createInstrument("gesture-scores").params, sandRate: 1200, echoes: 16, recording: "scribble" }), /Sand would release/);
  const track = gestureTrack(bundledRecording("scribble", 1), { smoothing: 0, frame: identity(320, 320) });
  assert.throws(() => gesturePath(track, { seed: 1, sampling: { kind: "arc", spacing: 0.05 }, window: { start: 0, end: 4200 }, pressure: { ...recorded, whenAbsent: "speed" } }), /The stroke would place \d+ stations; the limit is 60000\. Raise the spacing or narrow the window/);
  assert.throws(() => gestureTrack(bundledRecording("scribble", 1), { smoothing: 6000, frame: identity(0, 0) }), /smoothing/);
  assert.throws(() => gestureTrack(bundledRecording("scribble", 1), { smoothing: 0, frame: { ...identity(0, 0), scale: 0 } }), /frame scale/);
  assert.throws(() => gesturePath(track, { seed: -1, sampling: { kind: "arc", spacing: 5 }, window: { start: 0, end: 100 }, pressure: recorded }), /uint32/);
  assert.throws(() => gesturePath(track, { seed: 1, sampling: { kind: "arc", spacing: 5 }, window: { start: 0, end: 5000 }, pressure: { ...recorded, whenAbsent: "speed" } }), /window end/);
});
