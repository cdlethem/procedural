import assert from "node:assert/strict";
import test from "node:test";
import {
  canPrepareInstrument, createInstrument, createRaster, drawImageDirectedField, fieldLines, fieldSites, fieldTone, imageDirectedFieldComposition,
  imageDirectedFieldProducts, imageField, pathMaterial, prepareInstrument, strokeWith, toneLevel, traceStreamlines, usesSeed, validateParameters,
  type CompositionSurface, type DirectionFn, type ImageDirectedFieldComposition, type ImageFieldOptions, type Raster, type StreamlineOptions,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

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
/** Distance between two unsigned angles. */
const axisGap = (a: number, b: number): number => { const d = Math.abs(a - b) % Math.PI; return Math.min(d, Math.PI - d); };

/** Gray 8-bit sRGB picture from a function of the pixel centre (0..1 values). */
function picture(size: number, value: (x: number, y: number) => number, label = "test"): Raster {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data[y * size + x] = Math.round(Math.max(0, Math.min(1, value(x + 0.5, y + 0.5))) * 255);
  return createRaster({ width: size, height: size, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data, label });
}
const TAU = Math.PI * 2;
const verticalStripes = (size = 64) => picture(size, (x) => 0.5 + 0.4 * Math.sin(TAU * x / 16), "vertical-stripes");
const rings = (size = 96) => picture(size, (x, y) => 0.5 + 0.4 * Math.sin(TAU * Math.hypot(x - size / 2, y - size / 2) / 16), "rings");
const crossed = (size = 64) => picture(size, (x, y) => 0.5 + 0.2 * Math.sin(TAU * x / 16) + 0.2 * Math.sin(TAU * y / 16), "crossed");
const flat = (size = 64) => picture(size, () => 0.4, "flat");
const diagonalRamp = (size = 64) => picture(size, (x, y) => (x + y) / (2 * size), "diagonal-ramp");

const frameOf = (over: Partial<ImageFieldOptions["frame"]> = {}) => ({ centerX: 320, centerY: 320, width: 256, height: 256, rotation: 0, ...over });
const fieldOptions = (raster: Raster, over: Partial<ImageFieldOptions> = {}): ImageFieldOptions => ({
  image: { kind: "raster", raster }, value: "lightness", smoothing: 4, mode: "follow", ambient: { kind: "angle", angle: 0, weight: 0.5 }, frame: frameOf(), ...over });
const lineOptions = (raster: Raster, over: Record<string, unknown> = {}, field: Partial<ImageFieldOptions> = {}) => ({
  field: imageField(fieldOptions(raster, field)), gate: { minConfidence: 0.5, mask: null }, seed: 42, clip: true, separation: 8, stopFraction: 0.6,
  startSpacing: 32, startJitter: 0.5, fill: true, minLength: 10, maxLength: 400, minRadius: 0, ...over });

// ── the tracer, on analytic fields ───────────────────────────────────────────────────────────────

/** Unsigned counter-clockwise circles about the origin: the angle is reduced to [0, pi), so the sign flips across the horizontal axis. */
const circles: DirectionFn = (x, y, hint) => {
  let a = Math.atan2(x, -y);
  a = a - Math.PI * Math.floor(a / Math.PI);
  let dx = Math.cos(a), dy = Math.sin(a);
  if (dx * hint[0] + dy * hint[1] < 0) { dx = -dx; dy = -dy; }
  return [dx, dy];
};
const horizontal: DirectionFn = (_x, _y, hint) => (hint[0] < 0 ? [-1, 0] : [1, 0]);
const base = (over: Partial<StreamlineOptions>): StreamlineOptions => ({
  field: horizontal, bounds: [0, 0, 200, 200], seeds: [], separation: 10, stopFraction: 0.6, step: 2, minLength: 0, maxLength: 1000, minRadius: 0, fill: false,
  maxLines: 1000, maxVertices: 100000, maxSteps: 100000, ...over });

test("RK4 rides a circle to a stated accuracy and never reverses where an unsigned angle wraps", () => {
  const { lines } = traceStreamlines(base({ field: circles, bounds: [-150, -150, 150, 150], seeds: [{ id: "a", x: 100, y: 0 }], maxLength: 2000 }));
  assert.equal(lines.length, 1);
  const pts = lines[0].points;
  for (const [x, y] of pts) near(Math.hypot(x, y), 100, 5e-3, "radius");
  for (let i = 1; i < pts.length - 1; i++) near(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), 2, 1e-9, "step");
  // One turn in a single sense: the unwrapped polar angle changes monotonically and covers the circle up to the closing gap.
  const angles = pts.map(([x, y]) => Math.atan2(y, x));
  let total = 0, sign = 0;
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1];
    if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
    if (sign === 0) sign = Math.sign(d);
    assert.equal(Math.sign(d), sign, "direction never reverses");
    total += Math.abs(d);
  }
  const gap = 0.6 * 10 + 2 * 2;
  assert.ok(total > TAU - (2 * gap) / 100 && total < TAU, `covered ${total} rad of ${TAU}`);
});

test("in a uniform field, fill lines sit exactly one separation apart and are cut exactly at the domain edge", () => {
  const { lines } = traceStreamlines(base({ seeds: [{ id: "s", x: 101.3, y: 95 }], fill: true }));
  const ys = lines.map((l) => l.points[0][1]).sort((a, b) => a - b);
  assert.equal(lines.length, 20);
  for (let i = 1; i < ys.length; i++) near(ys[i] - ys[i - 1], 10, 1e-9, "gap");
  near(ys[0], 5, 1e-9); near(ys[ys.length - 1], 195, 1e-9);
  for (const line of lines) {
    const xs = line.points.map((p) => p[0]);
    near(Math.min(...xs), 0, 1e-9); near(Math.max(...xs), 200, 1e-9);
    assert.ok(line.points.every((p) => p[1] === line.points[0][1]), "horizontal");
  }
  // Fill-line ids record their parent and are unique.
  assert.equal(new Set(lines.map((l) => l.id)).size, lines.length);
  assert.ok(lines.filter((l) => l.parent !== null).length === 19);
});

test("no two lines of any trace come closer than the stopping distance", () => {
  const { lines } = traceStreamlines(base({ field: circles, bounds: [-150, -150, 150, 150], separation: 12, fill: true, maxLength: 3000,
    seeds: [{ id: "a", x: 30, y: 0 }, { id: "b", x: 0, y: 50 }, { id: "c", x: -70, y: 0 }] }));
  assert.ok(lines.length >= 8);
  const dtest = 12 * 0.6;
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++)
    for (const p of lines[i].points) for (const q of lines[j].points)
      assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) >= dtest - 1e-9, `${lines[i].id} and ${lines[j].id} are ${Math.hypot(p[0] - q[0], p[1] - q[1])} apart`);
});

test("a line whose turn is tighter than minRadius ends where it turns; the same circle is traced at a looser limit", () => {
  const seeds = [{ id: "a", x: 100, y: 0 }];
  // A turn needs two steps to be seen: at minRadius 150 the circle of radius 100 ends after one step each way, a 4-unit stub that minLength removes.
  const tight = traceStreamlines(base({ field: circles, bounds: [-150, -150, 150, 150], seeds, minRadius: 150, maxLength: 2000, minLength: 10 }));
  assert.equal(tight.lines.length, 0, "a turn of radius 100 is refused at minRadius 150");
  const stub = traceStreamlines(base({ field: circles, bounds: [-150, -150, 150, 150], seeds, minRadius: 150, maxLength: 2000 }));
  near(stub.lines[0].length, 4, 1e-9, "one step each way");
  const loose = traceStreamlines(base({ field: circles, bounds: [-150, -150, 150, 150], seeds, minRadius: 60, maxLength: 2000 }));
  assert.equal(loose.lines.length, 1);
  assert.ok(loose.lines[0].length > 550);
});

test("a stub shorter than minLength is removed together with the room it took; without the limit it blocks its neighbour", () => {
  // Lines may only run where y >= 52 or x <= 30; the seed at (10, 50) has 30 units of room, the seed at (10, 55) has a full row.
  const field: DirectionFn = (x, y, hint) => (x > 30 && y < 52 ? null : horizontal(x, y, hint));
  const seeds = [{ id: "stub", x: 10, y: 50 }, { id: "long", x: 10, y: 55 }];
  const withLimit = traceStreamlines(base({ field, seeds, minLength: 50 }));
  assert.deepEqual(withLimit.lines.map((l) => l.id), ["long"]);
  assert.equal(withLimit.removed, 1);
  const without = traceStreamlines(base({ field, seeds, minLength: 0 }));
  assert.deepEqual(without.lines.map((l) => l.id), ["stub"], "the stub occupies the space and the long line's seed is refused");
});

test("tracing is a pure function of its options, and its limits throw naming the option", () => {
  const options = base({ field: circles, bounds: [-150, -150, 150, 150], seeds: [{ id: "a", x: 60, y: 0 }], fill: true, separation: 20 });
  assert.deepEqual(traceStreamlines(options), traceStreamlines(options));
  assert.throws(() => traceStreamlines({ ...options, maxSteps: 50 }), /needs more than 50 integration steps.*separation/);
  assert.throws(() => traceStreamlines({ ...options, maxVertices: 50 }), /more than 50 vertices/);
  assert.throws(() => traceStreamlines({ ...options, maxLines: 2 }), /exceed 2 lines/);
  assert.throws(() => traceStreamlines({ ...options, step: 20 }), /step must not exceed separation \* stopFraction/);
  assert.throws(() => traceStreamlines({ ...options, cancelled: () => true }), /Composition cancelled/);
});

// ── the field ────────────────────────────────────────────────────────────────────────────────────

test("follow runs along stripes and resist across them, with confidence near one", () => {
  const stripes = verticalStripes();
  const follow = imageField(fieldOptions(stripes)), resist = imageField(fieldOptions(stripes, { mode: "resist" }));
  for (const [x, y] of [[250, 300], [320, 320], [400, 200], [300, 450]]) {
    const f = follow.at(x, y), r = resist.at(x, y);
    near(f.angle, Math.PI / 2, 0.03, "follow vertical");
    near(r.angle, 0, 0.03, "resist horizontal");
    assert.ok(f.confidence > 0.97 && r.confidence > 0.97);
  }
});

test("a stretched picture stretches its directions: 45 degree image lines become atan2(-1, 2) on a 2:1 frame", () => {
  const ramp = diagonalRamp();
  // Value grows along x + y, so level lines run along (1, -1) in the picture; on a 128 x 64 frame that vector becomes (2, -1).
  const field = imageField(fieldOptions(ramp, { smoothing: 0, frame: frameOf({ width: 128, height: 64 }) }));
  const expected = Math.PI + Math.atan2(-1, 2);
  near(field.at(320, 320).angle, expected, 1e-6);
  near(imageField(fieldOptions(ramp, { smoothing: 0 })).at(320, 320).angle, 3 * Math.PI / 4, 1e-6, "square frame");
  near(imageField(fieldOptions(ramp, { smoothing: 0, mode: "resist" })).at(320, 320).angle, Math.PI / 4, 1e-6, "across the level lines");
});

test("rotating the frame turns the field and its geometry about the picture centre", () => {
  const stripes = verticalStripes();
  const turned = imageField(fieldOptions(stripes, { frame: frameOf({ rotation: 90 }) }));
  near(axisGap(turned.at(320, 320).angle, 0), 0, 0.03, "vertical stripes turned a quarter become horizontal");
  const [x, y] = turned.toCanvas(320 + 100, 320);
  near(x, 320, 1e-9); near(y, 420, 1e-9);
  const upright = imageField(fieldOptions(stripes));
  const turnedSites = fieldSites({ field: turned, gate: { minConfidence: 0.5, mask: null }, seed: 1, spacing: 64, jitter: 0 });
  const uprightSites = fieldSites({ field: upright, gate: { minConfidence: 0.5, mask: null }, seed: 1, spacing: 64, jitter: 0 });
  assert.deepEqual(turnedSites.map((s) => s.id), uprightSites.map((s) => s.id));
  const [left, top] = upright.rect;
  const cell = uprightSites[0];
  near(cell.position[0], left + 32, 1e-9); near(cell.position[1], top + 32, 1e-9);
  const rotated = turnedSites[0].position;
  near(rotated[0], 320 - (cell.position[1] - 320), 1e-9, "quarter turn maps (dx, dy) to (-dy, dx)");
  near(rotated[1], 320 + (cell.position[0] - 320), 1e-9);
});

test("flat pictures define no direction: follow and resist draw nothing at any threshold, blend fills with the ambient direction", () => {
  const picture = flat();
  const open = { minConfidence: 0, mask: null };
  for (const mode of ["follow", "resist"] as const) {
    const field = imageField(fieldOptions(picture, { mode }));
    assert.equal(field.at(320, 320).confidence, 0);
    assert.equal(field.at(320, 320).defined, false);
    assert.deepEqual(fieldLines({ ...lineOptions(picture, { gate: open }, { mode }) }), []);
    assert.deepEqual(fieldSites({ field, gate: open, seed: 3, spacing: 20, jitter: 0.5 }), []);
  }
  const blend = imageField(fieldOptions(picture, { mode: "blend", ambient: { kind: "angle", angle: 30, weight: 0.5 } }));
  near(blend.at(300, 340).angle, Math.PI / 6, 1e-12);
  near(blend.at(300, 340).confidence, 0.5, 1e-12);
  const lines = fieldLines(lineOptions(picture, { gate: { minConfidence: 0.4, mask: null } }, { mode: "blend", ambient: { kind: "angle", angle: 30, weight: 0.5 } }));
  assert.ok(lines.length > 5);
  for (const line of lines) for (let i = 1; i < line.points.length; i++)
    near(axisGap(Math.atan2(line.points[i][1] - line.points[i - 1][1], line.points[i][0] - line.points[i - 1][0]), Math.PI / 6), 0, 1e-9, "straight at 30 degrees");
  // A threshold above the ambient confidence removes them again.
  assert.deepEqual(fieldLines(lineOptions(picture, { gate: { minConfidence: 0.6, mask: null } }, { mode: "blend", ambient: { kind: "angle", angle: 30, weight: 0.5 } })), []);
});

test("blend averages orientations, not angles: an ambient near the half-turn wrap stays there where the image has no coherence", () => {
  const cross = crossed();
  // Two perpendicular equal stripe sets have an isotropic smoothed tensor: no coherent direction of their own.
  const plain = imageField(fieldOptions(cross, { smoothing: 40 }));
  const centre = plain.at(320, 320);
  assert.ok(centre.coherence < 0.05, `coherence ${centre.coherence}`);
  for (const angle of [0.3, 180 - 3]) {
    const field = imageField(fieldOptions(cross, { smoothing: 40, mode: "blend", ambient: { kind: "angle", angle, weight: 1 } }));
    const sample = field.at(320, 320);
    near(axisGap(sample.angle, angle * Math.PI / 180), 0, 0.06, `ambient ${angle}`);
    assert.ok(sample.confidence > 0.95);
  }
  // With no coherent structure to fight it, radial and swirl differ by a quarter turn everywhere.
  const radial = imageField(fieldOptions(cross, { smoothing: 40, mode: "blend", ambient: { kind: "radial", angle: 0, weight: 1 } }));
  const swirl = imageField(fieldOptions(cross, { smoothing: 40, mode: "blend", ambient: { kind: "swirl", angle: 0, weight: 1 } }));
  near(axisGap(radial.at(400, 320).angle, 0), 0, 0.06, "rays point along x on the +x axis");
  near(axisGap(swirl.at(400, 320).angle, Math.PI / 2), 0, 0.06, "the swirl is vertical on the +x axis");
});

test("a strong image direction beats the ambient one where coherence is high, and confidence dips only under disagreement", () => {
  const stripes = verticalStripes();
  const agree = imageField(fieldOptions(stripes, { mode: "blend", ambient: { kind: "angle", angle: 90, weight: 1 } })).at(320, 320);
  const clash = imageField(fieldOptions(stripes, { mode: "blend", ambient: { kind: "angle", angle: 0, weight: 1 } })).at(320, 320);
  near(agree.angle, Math.PI / 2, 0.03); assert.ok(agree.confidence > 0.97);
  // Coherence ~1 leaves ambient weight ~0: the image wins with the same confidence either way.
  near(clash.angle, Math.PI / 2, 0.05); assert.ok(clash.confidence > 0.95);
});

test("the smoothing scale is in canvas units: the same picture at another size needs proportionally more pixels", () => {
  assert.throws(() => imageField(fieldOptions(verticalStripes(), { smoothing: 300 })), /Coherence scale \(smoothing\) 300 canvas units is 75\.0 image pixels; the limit is 64/);
  const small = imageField(fieldOptions(verticalStripes(), { smoothing: 8 }));
  const doubled = imageField(fieldOptions(verticalStripes(), { smoothing: 8, frame: frameOf({ width: 512, height: 512 }) }));
  near(small.orientation.smoothing, 2, 1e-12); near(doubled.orientation.smoothing, 1, 1e-12);
});

// ── lines and sites ──────────────────────────────────────────────────────────────────────────────

test("lines follow the field: every segment on vertical stripes is vertical, on the same stripes resisted horizontal", () => {
  const stripes = verticalStripes();
  for (const [mode, axis] of [["follow", Math.PI / 2], ["resist", 0]] as const) {
    const lines = fieldLines(lineOptions(stripes, {}, { mode }));
    assert.ok(lines.length > 8, `${mode}: ${lines.length} lines`);
    let total = 0, aligned = 0;
    for (const line of lines) for (let i = 1; i < line.points.length; i++) {
      const dx = line.points[i][0] - line.points[i - 1][0], dy = line.points[i][1] - line.points[i - 1][1], length = Math.hypot(dx, dy);
      total += length;
      if (axisGap(Math.atan2(dy, dx), axis) < 0.06) aligned += length;
    }
    assert.ok(aligned / total > 0.98, `${mode}: ${aligned / total} of the length is on the axis`);
  }
});

test("lines around a ring pattern circle it without doubling back through the unsigned wrap", () => {
  const pattern = rings();
  const lines = fieldLines(lineOptions(pattern, { maxLength: 2000, startSpacing: 60, separation: 12, minLength: 60 }, { frame: frameOf({ width: 288, height: 288 }), smoothing: 6 }));
  const long = lines.filter((l) => l.length > 200);
  assert.ok(long.length >= 3, `${long.length} long lines`);
  for (const line of long) {
    const radii = line.points.map(([x, y]) => Math.hypot(x - 320, y - 320));
    const mean = radii.reduce((s, r) => s + r, 0) / radii.length;
    assert.ok(Math.max(...radii) - Math.min(...radii) < 0.1 * mean + 4, `${line.id}: radius ${Math.min(...radii)}..${Math.max(...radii)}`);
    const angles = line.points.map(([x, y]) => Math.atan2(y - 320, x - 320));
    let sign = 0;
    for (let i = 1; i < angles.length; i++) {
      let d = angles[i] - angles[i - 1];
      if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      if (Math.abs(d) < 1e-9) continue;
      if (sign === 0) sign = Math.sign(d);
      assert.equal(Math.sign(d), sign, `${line.id} turns one way`);
    }
  }
});

test("lines stay inside the picture when clipped, may leave it otherwise, and rotation only re-maps vertices", () => {
  const stripes = verticalStripes();
  const clipped = fieldLines(lineOptions(stripes));
  const [left, top, right, bottom] = imageField(fieldOptions(stripes)).rect;
  for (const line of clipped) for (const [x, y] of line.points) assert.ok(x >= left - 1e-9 && x <= right + 1e-9 && y >= top - 1e-9 && y <= bottom + 1e-9);
  const open = fieldLines(lineOptions(stripes, { clip: false }));
  assert.ok(open.some((line) => line.points.some(([, y]) => y < top - 1 || y > bottom + 1)), "unclipped lines run past the border");
  assert.ok(open.every((line) => line.points.every(([, y]) => y >= top - 400 && y <= bottom + 400)));
  const turned = fieldLines(lineOptions(stripes, {}, { frame: frameOf({ rotation: 90 }) }));
  assert.deepEqual(turned.map((l) => l.id), clipped.map((l) => l.id));
  near(turned[0].points[3][0], 320 - (clipped[0].points[3][1] - 320), 1e-9);
  near(turned[0].points[3][1], 320 + (clipped[0].points[3][0] - 320), 1e-9);
  near(turned[0].meanDirection, (clipped[0].meanDirection + Math.PI / 2) % Math.PI, 1e-9);
});

test("the tone mask limits lines and sites to the window and the threshold to coherent places", () => {
  // Left half dark stripes (0.1..0.5), right half light stripes (0.6..1).
  const twoTone = picture(64, (x) => (x < 32 ? 0.3 + 0.2 * Math.sin(TAU * x / 16) : 0.8 + 0.2 * Math.sin(TAU * x / 16)), "two-tone");
  const field = imageField(fieldOptions(twoTone, { smoothing: 2 }));
  const [left] = field.rect, mid = left + 128;
  const gate = { minConfidence: 0.5, mask: { min: 0.7, max: 1 } };
  const sites = fieldSites({ field, gate, seed: 5, spacing: 16, jitter: 0.6 });
  assert.ok(sites.length > 20);
  for (const site of sites) { assert.ok(site.value >= 0.7 && site.value <= 1); assert.ok(site.position[0] > mid - 12, `site at ${site.position[0]}`); }
  const lines = fieldLines(lineOptions(twoTone, { gate }, { smoothing: 2 }));
  assert.ok(lines.length > 4);
  for (const line of lines) for (const [x] of line.points) assert.ok(x > mid - 12);
  assert.ok(fieldSites({ field, gate: { minConfidence: 0.5, mask: null }, seed: 5, spacing: 16, jitter: 0.6 }).length > sites.length, "no mask keeps the dark half too");
  assert.throws(() => fieldSites({ field, gate: { minConfidence: 0.5, mask: { min: 0.9, max: 0.2 } }, seed: 5, spacing: 16, jitter: 0 }), /minimum must not exceed the maximum/);
});

test("sites: a zero-scatter grid is exact, ids and geometry ignore appearance, and scatter is a stable per-cell function of the seed", () => {
  const stripes = verticalStripes();
  const field = imageField(fieldOptions(stripes));
  const gate = { minConfidence: 0.5, mask: null };
  const exact = fieldSites({ field, gate, seed: 1, spacing: 64, jitter: 0 });
  assert.equal(exact.length, 16);
  const [left, top] = field.rect;
  exact.forEach((site, k) => {
    near(site.position[0], left + 32 + 64 * (k % 4), 1e-9); near(site.position[1], top + 32 + 64 * Math.floor(k / 4), 1e-9);
    assert.equal(site.id, `mark:${k % 4}:${Math.floor(k / 4)}`);
    near(site.angle, Math.PI / 2, 0.03);
  });
  const a = fieldSites({ field, gate, seed: 1, spacing: 40, jitter: 0.8 }), b = fieldSites({ field, gate, seed: 2, spacing: 40, jitter: 0.8 });
  assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id));
  assert.notDeepEqual(a.map((s) => s.position), b.map((s) => s.position));
  assert.equal(fieldSites({ field, gate, seed: 1, spacing: 40, jitter: 0.8 }), a, "cached by construction");
  // One cell's scatter does not depend on which other cells exist.
  const sparser = fieldSites({ field, gate: { minConfidence: 0.99, mask: null }, seed: 1, spacing: 40, jitter: 0.8 });
  for (const site of sparser) assert.deepEqual(site.position, a.find((s) => s.id === site.id)!.position);
});

test("start scatter and order come from the seed: different seeds give different lines, the same seed the same, and ids are cell ids", () => {
  const stripes = verticalStripes();
  const one = fieldLines(lineOptions(stripes, { seed: 1 })), two = fieldLines(lineOptions(stripes, { seed: 2 }));
  assert.notDeepEqual(one.map((l) => l.points[0]), two.map((l) => l.points[0]));
  assert.equal(fieldLines(lineOptions(stripes, { seed: 1 })), one);
  assert.ok(one.some((l) => /^line:\d+:\d+$/.test(l.id)) && one.every((l) => /^line:\d+:\d+(\/\d+[LR])*$/.test(l.id)));
  assert.equal(new Set(one.map((l) => l.id)).size, one.length);
  const sparse = fieldLines(lineOptions(stripes, { seed: 1, fill: false, startSpacing: 64, startJitter: 0, stopFraction: 0.5 }));
  assert.equal(sparse.length, 4, "a 4 x 4 grid of starts on 4 stripes: the seeds below the first in each column lie on its line");
  assert.ok(sparse.every((l) => l.parent === null));
});

// ── the instrument ───────────────────────────────────────────────────────────────────────────────

const inputFor = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("image-directed-field");
  return { ...input, seed, params: { ...input.params, ...params } };
};
const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42): ImageDirectedFieldComposition => imageDirectedFieldComposition(inputFor(params, seed));

test("stored scalars resolve to a typed, JSON-compatible descriptor with a bundled image", () => {
  const recipe = recipeFor({ mode: "blend", maskTones: true, maskMin: 0.1, maskMax: 0.4, mark: "arrow", lines: true });
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), recipe);
  assert.equal(recipe.kind, "image-directed-field");
  assert.deepEqual(recipe.field.image, { kind: "bundled", id: "portrait", variant: 3, size: 128 });
  assert.deepEqual(recipe.gate.mask, { min: 0.1, max: 0.4 });
  assert.equal(recipeFor({ lines: false }).lines, null);
  assert.equal(recipeFor({ mark: "none" }).marks, null);
  assert.throws(() => imageDirectedFieldComposition(createInstrument("motif-ecologies")), /Not a image-directed-field input/);
  assert.throws(() => recipeFor({ image: "photograph" }), /not an available option/);
  assert.throws(() => recipeFor({ separation: 500 }), /between 3 and 40|400/);
});

test("appearance edits never touch the producers: palette, material, weight, color rule and mark style reuse the same frozen objects", () => {
  const base = imageDirectedFieldProducts(recipeFor({ mark: "arrow" }));
  const input = inputFor({ mark: "arrow", material: "beads", beadMark: "rings", beadSize: 9, weight: 3, toneWeight: 0.9, colorBy: "direction", retention: 0.5, markSize: 20, markRetention: 0.5, markVariation: 0.9, markWeight: 2 });
  const restyled = imageDirectedFieldProducts(imageDirectedFieldComposition({ ...input, palette: [0x111111, 0x222222] }));
  assert.equal(restyled.lines, base.lines); assert.equal(restyled.sites, base.sites); assert.equal(restyled.field, base.field);
  assert.ok(Object.isFrozen(base.lines) && Object.isFrozen(base.lines[0]) && Object.isFrozen(base.lines[0].points) && Object.isFrozen(base.sites[0]));
  const structural = imageDirectedFieldProducts(recipeFor({ mark: "arrow", separation: 9 }));
  assert.notEqual(structural.lines, base.lines);
  assert.equal(structural.sites, base.sites, "a line edit leaves the sites alone");
  assert.notDeepEqual(imageDirectedFieldProducts(recipeFor({}, 7)).lines.map((l) => l.points[0]), base.lines.map((l) => l.points[0]));
});

test("the descriptor draws exactly what the ordinary functions draw, and a substituted material sees the same cached lines", () => {
  const recipe = recipeFor({ toneWeight: 0, colorBy: "single", material: "stitch", mark: "none" });
  const viaDescriptor = new Recorder();
  drawImageDirectedField(viaDescriptor, recipe);
  const { lines } = imageDirectedFieldProducts(recipe);
  const viaFunctions = new Recorder();
  strokeWith(viaFunctions, lines.map((line) => ({ ...line, tone: 0 })), pathMaterial(recipe.material, recipe.palette));
  assert.deepEqual(viaDescriptor.ops, viaFunctions.ops);
  const seen: string[] = [];
  drawImageDirectedField(new Recorder(), recipe, { line: (_surface, path) => { seen.push(path.id); } });
  assert.deepEqual(seen, lines.map((l) => l.id));
  assert.equal(imageDirectedFieldProducts(recipe).lines, lines);
});

test("tone weight thins lines toward the light parts of the picture, never to nothing, and is exactly neutral at zero", () => {
  const twoTone = picture(64, (x) => (x < 32 ? 0.25 + 0.15 * Math.sin(TAU * x / 16) : 0.85 + 0.1 * Math.sin(TAU * x / 16)), "two-tone");
  const withImage = (params: Record<string, number | string | boolean>) => {
    const recipe = recipeFor({ smoothing: 2, minConfidence: 0.5, weight: 2, ...params });
    return { ...recipe, field: { ...recipe.field, image: { kind: "raster", raster: twoTone } as const } } as ImageDirectedFieldComposition;
  };
  const weights = (recipe: ImageDirectedFieldComposition) => {
    const surface = new Recorder(); drawImageDirectedField(surface, recipe);
    return surface.ops.filter((op) => op.startsWith("strokeWeight")).map((op) => Number(op.slice(13, -1)));
  };
  const heavy = withImage({ toneWeight: 0.8 }), { lines } = imageDirectedFieldProducts(heavy);
  const drawn = weights(heavy);
  assert.equal(drawn.length, lines.length);
  lines.forEach((line, i) => near(drawn[i], 2 * Math.max(1, Math.round((1 - 0.8 * line.meanValue) * 8)) / 8, 1e-9));
  const dark = lines.map((l, i) => [l.meanValue, drawn[i]] as const).filter(([v]) => v < 0.45), light = lines.map((l, i) => [l.meanValue, drawn[i]] as const).filter(([v]) => v > 0.7);
  assert.ok(dark.length > 2 && light.length > 2);
  assert.ok(Math.min(...dark.map(([, w]) => w)) > Math.max(...light.map(([, w]) => w)), "every dark line is heavier than every light one");
  assert.ok(Math.min(...drawn) >= 2 / 8 - 1e-9, "a light line keeps an eighth of the weight");
  assert.ok(weights(withImage({ toneWeight: 0 })).every((w) => w === 2));
  assert.equal(toneLevel(1, 1), 1); assert.equal(toneLevel(0, 1), 8);
});

test("colour rules read attributes: tone runs dark to light along the palette, direction in equal turns, single is the first colour", () => {
  const palette = [1, 2, 3, 4];
  assert.equal(fieldTone("tone", palette, { value: 0.1 }), 0);
  assert.equal(fieldTone("tone", palette, { meanValue: 0.55 }), 2);
  assert.equal(fieldTone("tone", palette, { value: 1 }), 3);
  assert.equal(fieldTone("direction", palette, { angle: 0 }), 0);
  assert.equal(fieldTone("direction", palette, { meanDirection: Math.PI / 2 }), 2);
  assert.equal(fieldTone("direction", palette, { angle: Math.PI - 1e-9 }), 3);
  assert.equal(fieldTone("single", palette, { value: 0.9 }), 0);
  assert.equal(fieldTone("random", palette, { value: 0.9 }), undefined);
});

test("sites are drawn at their frames with their marks, after the lines", () => {
  const surface = new Recorder();
  drawImageDirectedField(surface, recipeFor({ mark: "dot", lines: false, markRetention: 1, markVariation: 0 }));
  const { sites } = imageDirectedFieldProducts(recipeFor({ mark: "dot", lines: false }));
  assert.ok(sites.length > 30);
  assert.equal(surface.ops.filter((op) => op.startsWith("translate")).length, sites.length);
  assert.equal(surface.ops.filter((op) => op.startsWith("circle")).length, sites.length);
  const both = new Recorder();
  drawImageDirectedField(both, recipeFor({ mark: "dot", markSize: 3 }));
  const firstLine = both.ops.findIndex((op) => op === "beginShape()"), firstDot = both.ops.findIndex((op) => op.startsWith("circle"));
  assert.ok(firstLine >= 0 && firstDot > firstLine);
});

test("hidden controls never change the drawing", () => {
  const draw = (params: Record<string, number | string | boolean>) => drawFingerprint(inputFor(params));
  const cases: [Record<string, number | string | boolean>, Record<string, number | string | boolean>][] = [
    [{ mode: "follow" }, { ambientKind: "radial", ambientAngle: 40, ambientWeight: 1 }],
    [{ maskTones: false }, { maskMin: 0.4, maskMax: 0.6 }],
    [{ lines: false, mark: "dot" }, { separation: 4, stopFraction: 0.9, startSpacing: 20, startJitter: 0, fill: false, minLength: 90, maxLength: 60, minRadius: 12, clip: false, material: "beads", weight: 4, toneWeight: 1, retention: 0.2, spacing: 20, beadSize: 20 }],
    [{ material: "ink" }, { spacing: 30, phase: 0.9, phaseSpread: 1, beadMark: "rosette", beadSize: 20, beadPetals: 12, beadOpening: 0.8, beadWeight: 3 }],
    [{ material: "beads", beadMark: "dot" }, { weight: 5, beadWeight: 3, beadPetals: 12, beadOpening: 0.8 }],
    [{ mark: "none" }, { markSpacing: 10, markJitter: 1, markSize: 40, markWeight: 3, markPetals: 12, markOpening: 0.8, markVariation: 1, markRetention: 0.1 }],
    [{ mark: "dot" }, { markWeight: 3, markPetals: 12, markOpening: 0.8 }],
  ];
  for (const [base, hidden] of cases) assert.equal(draw(base), draw({ ...base, ...hidden }), JSON.stringify(hidden));
});

test("seed use is declared honestly and preparation is cooperative and cancellable", async () => {
  assert.equal(usesSeed(inputFor()), true);
  assert.equal(usesSeed(inputFor({ lines: false })), false);
  assert.equal(usesSeed(inputFor({ lines: false, mark: "dot", markJitter: 0, markVariation: 0, markRetention: 1 })), false);
  assert.equal(usesSeed(inputFor({ lines: false, mark: "dot", markJitter: 0.1 })), true);
  assert.equal(canPrepareInstrument("image-directed-field"), true);
  assert.equal(await prepareInstrument(inputFor({ separation: 5.5 }), () => false), true);
  assert.equal(await prepareInstrument(inputFor({ separation: 5.5, imageVariant: 90 }), () => true), false);
  let polls = 0;
  assert.equal(await prepareInstrument(inputFor({ separation: 3.5, imageVariant: 91 }), () => ++polls > 3), false, "a cancellation raised while tracing is honoured");
});

test("failures name the control to change and nothing is truncated", () => {
  const values = (params: Record<string, number | string | boolean>) => ({ ...createInstrument("image-directed-field").params, ...params });
  assert.throws(() => validateParameters("image-directed-field", values({ startSpacing: 0.5 })), /Start spacing 0\.5 would make \d+ start cells; the limit is 40000/);
  assert.throws(() => validateParameters("image-directed-field", values({ mark: "dot", markSpacing: 0.5 })), /Mark spacing/);
  assert.throws(() => validateParameters("image-directed-field", values({ minLength: 200, maxLength: 100 })), /Shortest line must not exceed longest line/);
  assert.throws(() => validateParameters("image-directed-field", values({ maskTones: true, maskMin: 0.8, maskMax: 0.2 })), /Darkest tone/);
  const heavy = inputFor({ separation: 0.5, stopFraction: 0.95, width: 640, height: 640, image: "noise", minConfidence: 0, minLength: 0 });
  assert.throws(() => drawImageDirectedField(new Recorder(), imageDirectedFieldComposition(heavy)), /more than 500000 vertices.*Line separation/);
  assert.throws(() => drawImageDirectedField(new Recorder(), recipeFor({ material: "stitch", spacing: 0.5, separation: 3, width: 640, height: 640, image: "noise", minConfidence: 0 })),
    /callback units.*Station spacing/);
  assert.throws(() => imageField(fieldOptions(flat(), { ambient: { kind: "angle", angle: 0, weight: 2 } })), /ambient\.weight/);
  assert.throws(() => fieldLines(lineOptions(flat(), { seed: -1 })), /uint32/);
});

test("equal pictures share their construction: a rebuilt raster hits the cache, a different picture does not", () => {
  const a = fieldLines(lineOptions(verticalStripes())), b = fieldLines(lineOptions(verticalStripes()));
  assert.equal(a, b);
  const other = picture(64, (x) => 0.5 + 0.4 * Math.sin(TAU * x / 12), "vertical-stripes");
  assert.notEqual(fieldLines(lineOptions(other)), a);
});

test("every bundled image draws at its defaults and stays inside its picture", () => {
  for (const image of ["portrait", "geometry", "landscape", "noise"]) {
    const recipe = recipeFor({ image });
    const { field, lines } = imageDirectedFieldProducts(recipe);
    assert.ok(lines.length > 20, `${image}: ${lines.length} lines`);
    const [left, top, right, bottom] = field.rect;
    for (const line of lines) for (const [x, y] of line.points) assert.ok(x >= left - 1e-9 && x <= right + 1e-9 && y >= top - 1e-9 && y <= bottom + 1e-9);
    drawImageDirectedField(new Recorder(), recipe);
  }
});
