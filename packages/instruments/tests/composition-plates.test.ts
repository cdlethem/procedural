import assert from "node:assert/strict";
import test from "node:test";
import {
  clipToSupport, createCompositionRun, createInstrument, drawPlate, drawReferenceComposition, drawPlatesRecipe, gratingLines, makePlate, opticalPlates,
  planeWave, plateFrames, radialWave, referenceComposition, resolveSupport, supportContains, usesSeed,
  validateInstrument, warpPaths,
  type OpticalPlatesOptions, type PatternRequest, type PatternSpec, type PlateOptions, type PlatesRecipe, type Point, type SupportSpec,
} from "../dist/index.js";
import { interferenceLaceField } from "../dist/adapters/interference-lace.js";
import { registeredScreenSegments } from "../dist/adapters/weave-screen-instruments.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const box = (width: number, height: number, cx = 0, cy = 0): SupportSpec =>
  ({ footprint: { shape: "rectangle", centerX: cx, centerY: cy, width, height } });
const plate = (pattern: PatternSpec, over: Partial<PlateOptions> = {}): PlateOptions =>
  ({ pattern, registration: { offsetX: 0, offsetY: 0, rotation: 0, phase: 0 }, support: box(200, 100), ...over });
const pair = (a: PlateOptions, b: PlateOptions, over: Partial<OpticalPlatesOptions> = {}): OpticalPlatesOptions =>
  ({ seed: 7, link: "linked", originX: 0, originY: 0, flatness: .02, plates: [a, b], ...over });
const grating = (period = 10, chirp = 0): PatternSpec => ({ kind: "grating", period, chirp });
/** Signed distance of a point from a line through (ox, oy) with direction angle `theta`. */
const normalDistance = (p: Point, ox: number, oy: number, theta: number) =>
  -(p[0] - ox) * Math.sin(theta) + (p[1] - oy) * Math.cos(theta);

test("a grating is the lattice of lines (k + phase)·period from the frame origin, clipped to the footprint", () => {
  const built = opticalPlates(pair(plate(grating(10), { registration: { offsetX: 0, offsetY: 0, rotation: 0, phase: .25 } }), plate(grating(10))));
  const paths = built.plates[0].paths;
  assert.deepEqual(paths.map((path) => path.id), Array.from({ length: 10 }, (_, i) => `A/line:${i - 5}#0`));
  paths.forEach((path, index) => {
    const y = (index - 5 + .25) * 10;
    assert.equal(path.points.length, 2);
    near(path.points[0][0], -100); near(path.points[1][0], 100);
    near(path.points[0][1], y); near(path.points[1][1], y);
  });
});

test("rotation and offset move the whole family rigidly", () => {
  const theta = 30 * Math.PI / 180;
  const options = plate(grating(10), { registration: { offsetX: 5, offsetY: -3, rotation: 30, phase: .4 } });
  const { paths } = opticalPlates(pair(options, plate(grating(10)))).plates[0];
  assert.ok(paths.length > 8);
  for (const path of paths) {
    const k = Number(/line:(-?\d+)#/.exec(path.id)![1]);
    for (const point of path.points) near(normalDistance(point, 5, -3, theta), (k + .4) * 10, 1e-9);
    const [a, b] = path.points;
    near(Math.atan2(b[1] - a[1], b[0] - a[0]), theta, 1e-9);
  }
});

test("frequency drift counts lines by the integral of the local frequency", () => {
  const { paths, minPeriod } = opticalPlates(pair(plate(grating(10, .2), { support: box(300, 100) }), plate(grating(10)))).plates[0];
  for (const path of paths) {
    const k = Number(/line:(-?\d+)#/.exec(path.id)![1]);
    const u = path.points[0][1];
    near((u + .2 * u * u / 200) / 10, k, 1e-9);
  }
  // Local period at u is period / (1 + chirp·u/100): spacing between neighbours follows it.
  const ys = paths.map((path) => path.points[0][1]).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    const mid = (ys[i] + ys[i - 1]) / 2;
    near(ys[i] - ys[i - 1], 10 / (1 + .2 * mid / 100), .1);
  }
  near(minPeriod, 10 / (1 + .2 * Math.hypot(150, 50) / 100), 1e-9);
});

test("rings have the stated radii and flatten within the chord tolerance", () => {
  const options = pair(plate({ kind: "rings", period: 12, chirp: 0 }, { registration: { offsetX: 0, offsetY: 0, rotation: 0, phase: .5 }, support: box(400, 400) }),
    plate(grating(10)));
  const { paths } = opticalPlates(options).plates[0];
  const closed = paths.filter((path) => path.closed);
  assert.deepEqual(closed.slice(0, 3).map((path) => path.id), ["A/ring:0#0", "A/ring:1#0", "A/ring:2#0"]);
  closed.forEach((path) => {
    const k = Number(/ring:(\d+)#/.exec(path.id)![1]), r = (k + .5) * 12;
    for (const [x, y] of path.points) near(Math.hypot(x, y), r, 1e-9);
    for (let i = 0; i < path.points.length; i++) {
      const a = path.points[i], b = path.points[(i + 1) % path.points.length];
      const sagitta = r - Math.hypot((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      assert.ok(sagitta <= .02 + 1e-9 && sagitta >= 0, `sagitta ${sagitta} at ring ${k}`);
    }
  });
  // The tolerance is what drives the vertex count: a coarser one uses fewer vertices on the same ring.
  const coarse = opticalPlates({ ...options, flatness: .5 }).plates[0].paths.find((path) => path.id === "A/ring:5#0")!;
  assert.ok(coarse.points.length < closed.find((path) => path.id === "A/ring:5#0")!.points.length / 3);
});

test("spokes turn with phase, keep their ids, and never start closer than the minimum period", () => {
  const spokes = (phase: number, hub: number) => opticalPlates(pair(plate({ kind: "spokes", count: 12, hub },
    { registration: { offsetX: 0, offsetY: 0, rotation: 0, phase }, support: box(300, 300) }), plate(grating(10)))).plates[0].paths;
  const base = spokes(0, 0), turned = spokes(.5, 0);
  const floor = 12 * 3 / (2 * Math.PI);
  assert.deepEqual(base.map((path) => path.id), turned.map((path) => path.id));
  base.forEach((path, k) => {
    near(Math.hypot(...path.points[0]), floor, 1e-9);
    near(Math.atan2(path.points[0][1], path.points[0][0]), k * Math.PI / 6 > Math.PI ? k * Math.PI / 6 - 2 * Math.PI : k * Math.PI / 6, 1e-9);
    const t = turned[k].points[0];
    near(Math.atan2(t[1], t[0]), Math.atan2(Math.sin((k + .5) * Math.PI / 6), Math.cos((k + .5) * Math.PI / 6)), 1e-9);
  });
  spokes(0, 40).forEach((path) => near(Math.hypot(...path.points[0]), 40, 1e-9));
});

test("dot lattices keep their nearest-neighbour distance and row spacing", () => {
  const sites = (lattice: "square" | "hex", phase = 0) => opticalPlates(pair(plate({ kind: "dots", period: 10, lattice },
    { registration: { offsetX: 0, offsetY: 0, rotation: 0, phase }, support: box(120, 120) }), plate(grating(10)))).plates[0].sites;
  for (const [lattice, rowStep] of [["square", 10], ["hex", 10 * Math.sqrt(3) / 2]] as const) {
    const all = sites(lattice);
    const rows = [...new Set(all.map((site) => Math.round(site.position[1] * 1e6)))].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) near((rows[i] - rows[i - 1]) / 1e6, rowStep, 1e-6);
    // Interior sites (all neighbours inside the footprint) have exactly this nearest-neighbour distance.
    const interior = all.filter((site) => Math.abs(site.position[0]) < 40 && Math.abs(site.position[1]) < 40);
    assert.ok(interior.length > 20);
    for (const site of interior) {
      const nearest = Math.min(...all.filter((other) => other !== site).map((other) =>
        Math.hypot(other.position[0] - site.position[0], other.position[1] - site.position[1])));
      near(nearest, 10, 1e-9);
    }
  }
  // Phase .3 of a 10-unit period moves every site 3 units along x; ids follow the lattice index, not the position.
  const shifted = sites("square", .3);
  for (const site of shifted) near((site.position[0] - 3) / 10 - Math.round((site.position[0] - 3) / 10), 0, 1e-9);
  assert.equal(new Set(shifted.map((s) => s.id)).size, shifted.length);
  assert.ok(sites("square").every((s) => s.id.startsWith("B/") === false && /^A\/dot:-?\d+:-?\d+$/.test(s.id)));
});

test("waves displace lines by amplitude·sin(2π·distance/wavelength) within the chord tolerance", () => {
  const spec: PatternSpec = { kind: "waves", period: 10, chirp: 0, amplitude: 6, wavelength: 80 };
  const { paths } = opticalPlates(pair(plate(spec, { support: box(300, 100) }), plate(grating(10)))).plates[0];
  assert.ok(paths.length > 8);
  const curve = (x: number, u: number) => u + 6 * Math.sin(2 * Math.PI * x / 80);
  for (const path of paths) {
    const k = Number(/line:(-?\d+)#/.exec(path.id)![1]);
    // Interior vertices lie exactly on the curve; the two clipped ends lie on a chord, so within the tolerance.
    path.points.forEach(([x, y], i) => near(y, curve(x, k * 10), i === 0 || i === path.points.length - 1 ? .02 : 1e-9));
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], mx = (a[0] + b[0]) / 2;
      assert.ok(Math.abs((a[1] + b[1]) / 2 - curve(mx, k * 10)) <= .02 + 1e-9, "chord deviation");
    }
  }
  // With no amplitude the same pattern is exactly straight.
  const flat = opticalPlates(pair(plate({ ...spec, amplitude: 0 } as PatternSpec, { support: box(300, 100) }), plate(grating(10)))).plates[0].paths;
  assert.ok(flat.every((path) => path.points.length === 2));
});

test("clipping a line to a rectangle or ellipse keeps exactly the chord", () => {
  const rect = resolveSupport(box(200, 100), .02);
  const line: Point[] = [[-300, 20], [300, 20]];
  const [piece] = clipToSupport(line, false, rect).pieces;
  near(piece[0][0], -100); near(piece[1][0], 100);
  const ellipse = resolveSupport({ footprint: { shape: "ellipse", centerX: 0, centerY: 0, width: 200, height: 100 } }, .02);
  const [chord] = clipToSupport(line, false, ellipse).pieces;
  const half = 100 * Math.sqrt(1 - (20 / 50) ** 2);
  assert.ok(Math.abs(chord[0][0] + half) < .05 && Math.abs(chord[1][0] - half) < .05, `${chord[0][0]}, ${chord[1][0]} vs ±${half}`);
  assert.equal(clipToSupport([[-300, 80], [300, 80]], false, rect).pieces.length, 0);
});

test("a supplied path set uses the nonzero rule: opposite winding cuts a hole, the same winding unions", () => {
  const ring = (l: number, t: number, r: number, b: number, reverse = false): Point[] => {
    const points: Point[] = [[l, t], [r, t], [r, b], [l, b]];
    return reverse ? points.reverse() : points;
  };
  const support = (inner: Point[]) => resolveSupport({ footprint: { shape: "rectangle", centerX: 50, centerY: 50, width: 100, height: 100 },
    mask: { invert: false, source: { kind: "paths", rings: [ring(0, 0, 100, 100), inner] } } }, .02);
  const holed = support(ring(40, 40, 60, 60, true)), unioned = support(ring(40, 40, 60, 60));
  assert.equal(supportContains(holed, 20, 50), true);
  assert.equal(supportContains(holed, 50, 50), false);
  assert.equal(supportContains(unioned, 50, 50), true);
  const pieces = clipToSupport([[-10, 50], [110, 50]], false, holed).pieces;
  assert.equal(pieces.length, 2);
  near(pieces[0][1][0], 40); near(pieces[1][0][0], 60);
  near(pieces[0][0][0], 0); near(pieces[1][1][0], 100);
});

test("region masks keep each rectangle less its inset, and invert keeps the complement", () => {
  const source = { kind: "regions" as const, inset: 5,
    regions: [{ bounds: [0, 0, 50, 50] as const }, { bounds: [50, 50, 100, 100] as const }, { bounds: [20, 20, 30, 30] as const }] };
  const footprint = { shape: "rectangle" as const, centerX: 50, centerY: 50, width: 100, height: 100 };
  const inside = resolveSupport({ footprint, mask: { source, invert: false } }, .02);
  const outside = resolveSupport({ footprint, mask: { source, invert: true } }, .02);
  const upper = clipToSupport([[-10, 25], [110, 25]], false, inside).pieces;
  assert.equal(upper.length, 1); near(upper[0][0][0], 5); near(upper[0][1][0], 45);
  assert.equal(clipToSupport([[-10, 75], [110, 75]], false, inside).pieces[0][0][0], 55);
  for (const [x, y] of [[10, 10], [75, 75], [3, 3], [25, 75], [75, 25], [99, 1]] as const)
    assert.notEqual(supportContains(inside, x, y), supportContains(outside, x, y), `(${x}, ${y})`);
  const complement = clipToSupport([[-10, 25], [110, 25]], false, outside).pieces;
  assert.deepEqual(complement.map((p) => [p[0][0], p[p.length - 1][0]]), [[0, 5], [45, 100]]);
});

test("type masks keep the letter strokes and leave counters empty", () => {
  const support = resolveSupport({ footprint: { shape: "rectangle", centerX: 100, centerY: 100, width: 200, height: 200 },
    mask: { invert: false, source: { kind: "text", text: "O", centerX: 100, centerY: 100, width: 200, height: 200 } } }, .02);
  assert.equal(supportContains(support, 100, 100), false, "the counter of an O is empty");
  const pieces = clipToSupport([[0, 100], [200, 100]], false, support).pieces;
  assert.equal(pieces.length, 2, "a line through an O is two strokes");
  assert.ok(pieces[0][1][0] < 100 && pieces[1][0][0] > 100);
  for (const [a, b] of pieces) assert.ok(supportContains(support, (a[0] + b[0]) / 2, 100));
  // Type is fitted, not stretched: scaling the box up scales every outline by the same factor.
  const bigger = resolveSupport({ footprint: { shape: "rectangle", centerX: 100, centerY: 100, width: 400, height: 400 },
    mask: { invert: false, source: { kind: "text", text: "O", centerX: 100, centerY: 100, width: 400, height: 400 } } }, .02);
  const widthOf = (s: typeof support) => Math.max(...s.mask!.rings.flat().map((p) => p[0])) - Math.min(...s.mask!.rings.flat().map((p) => p[0]));
  near(widthOf(bigger) / widthOf(support), 2, 1e-9);
  assert.throws(() => resolveSupport({ ...box(10, 10),
    mask: { invert: false, source: { kind: "text", text: "é", centerX: 0, centerY: 0, width: 10, height: 10 } } }, .02), /printable ASCII/);
});

test("closed rings stay closed when inside and rejoin across their start vertex when cut", () => {
  const rect = resolveSupport(box(100, 100), .02);
  const circle = (cx: number, r: number): Point[] => Array.from({ length: 64 }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / 64), r * Math.sin(2 * Math.PI * i / 64)]);
  const whole = clipToSupport(circle(0, 20), true, rect);
  assert.equal(whole.closed, true); assert.equal(whole.pieces.length, 1); assert.equal(whole.pieces[0].length, 64);
  // Vertex 0 sits at x = cx + r = 70 (outside the footprint); the arc that survives wraps around it.
  const cut = clipToSupport(circle(50, 20), true, rect);
  assert.equal(cut.closed, false); assert.equal(cut.pieces.length, 1);
  const [arc] = cut.pieces;
  for (const [x, y] of arc) assert.ok(x <= 50 + 1e-9 && Math.abs(y) < 20.0001);
  near(arc[0][0], 50); near(arc[arc.length - 1][0], 50);
  // A ring wholly outside vanishes.
  assert.equal(clipToSupport(circle(300, 20), true, rect).pieces.length, 0);
});

test("linked plates ride the previous plate; detached plates keep absolute registration", () => {
  const registrations = [{ offsetX: 10, offsetY: 0, rotation: 90, phase: .25 }, { offsetX: 3, offsetY: 4, rotation: 5, phase: .5 }];
  const detached = plateFrames("detached", 100, 200, registrations);
  near(detached[1].x, 103); near(detached[1].y, 204); near(detached[1].angle, 5 * Math.PI / 180); near(detached[1].phase, .5);
  const linked = plateFrames("linked", 100, 200, registrations);
  // A sits at (110, 200) turned 90°; B's (3, 4) is read in A's axes: x' = −4, y' = 3.
  near(linked[0].x, 110); near(linked[0].y, 200);
  near(linked[1].x, 106); near(linked[1].y, 203);
  near(linked[1].angle, 95 * Math.PI / 180); near(linked[1].phase, .75);
  assert.throws(() => plateFrames("bound" as "linked", 0, 0, registrations), /linked or detached/);
});

test("rotating plate A carries plate B when linked and leaves it alone when detached", () => {
  const spec = (rotation: number, link: "linked" | "detached") => opticalPlates(pair(
    plate(grating(10), { registration: { offsetX: 0, offsetY: 0, rotation, phase: 0 } }),
    plate(grating(10), { registration: { offsetX: 0, offsetY: 0, rotation: 4, phase: 0 } }), { link }));
  const before = spec(0, "linked"), turned = spec(20, "linked"), detachedTurned = spec(20, "detached");
  const direction = (path: { points: readonly Point[] }) => Math.atan2(path.points[1][1] - path.points[0][1], path.points[1][0] - path.points[0][0]);
  near(direction(before.plates[1].paths[0]), 4 * Math.PI / 180);
  near(direction(turned.plates[1].paths[0]), 24 * Math.PI / 180);
  near(direction(detachedTurned.plates[1].paths[0]), 4 * Math.PI / 180);
  assert.equal(detachedTurned.plates[1], spec(0, "detached").plates[1], "detached B does not depend on A at all (same cached plate)");
  assert.equal(before.plates[1], spec(0, "detached").plates[1], "with A at identity, linked equals detached");
  assert.notEqual(turned.plates[1], before.plates[1]);
});

test("plates are separately usable and their composite is exactly their elements in order", () => {
  const built = opticalPlates(pair(plate(grating(10)), plate({ kind: "dots", period: 12, lattice: "square" })));
  const [a, b] = built.plates;
  assert.equal(a.paths.length > 0 && b.sites.length > 0, true);
  assert.equal(a.sites.length + b.paths.length, 0);
  assert.equal(built.composite.paths.length, a.paths.length + b.paths.length);
  assert.equal(built.composite.sites.length, a.sites.length + b.sites.length);
  assert.ok(a.paths.every((path, i) => built.composite.paths[i] === path));
  const ids = [...built.composite.paths, ...built.composite.sites].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(a.paths.every((path) => path.id.startsWith("A/") && path.tone === 0));
  assert.ok(b.sites.every((site) => site.id.startsWith("B/") && site.tone === 1));
  assert.equal(opticalPlates(pair(plate(grating(10)), plate({ kind: "dots", period: 12, lattice: "square" }))), built, "cached by construction");
});

test("editing one plate returns the other plate as the very same object", () => {
  const first = opticalPlates(pair(plate(grating(10)), plate(grating(9))));
  const second = opticalPlates(pair(plate(grating(10)), plate({ kind: "rings", period: 9, chirp: 0 })));
  assert.equal(second.plates[0], first.plates[0]);
  assert.notEqual(second.plates[1], first.plates[1]);
});

test("everything published is deeply frozen", () => {
  const built = opticalPlates(pair(plate({ kind: "rings", period: 20, chirp: 0 }), plate({ kind: "dots", period: 15, lattice: "hex" })));
  const frozen = (value: unknown): boolean => value === null || typeof value !== "object" ||
    (Object.isFrozen(value) && Object.values(value as object).every(frozen));
  assert.ok(frozen(built.plates[0].paths) && frozen(built.plates[1].sites) && frozen(built.plates[0].frame));
  assert.ok(Object.isFrozen(built) && Object.isFrozen(built.plates[0]) && Object.isFrozen(built.composite));
  assert.ok(frozen(built.plates[0].support));
});

test("growing the footprint adds lines without renaming or moving the existing ones", () => {
  const small = opticalPlates(pair(plate(grating(10, .1), { support: box(160, 80) }), plate(grating(10)))).plates[0].paths;
  const large = opticalPlates(pair(plate(grating(10, .1), { support: box(260, 140) }), plate(grating(10)))).plates[0].paths;
  const byId = new Map(large.map((path) => [path.id, path]));
  assert.ok(large.length > small.length);
  for (const path of small) {
    const grown = byId.get(path.id)!;
    assert.ok(grown, path.id);
    // Same line: identical distance from the frame origin, even though the ends moved outward.
    near(normalDistance(grown.points[0], 0, 0, 0), normalDistance(path.points[0], 0, 0, 0), 1e-9);
  }
});

test("the descriptor route and ordinary callbacks draw the same elements", () => {
  const options = pair(plate(grating(20)), plate({ kind: "dots", period: 25, lattice: "hex" }));
  const built = opticalPlates(options);
  const seen: string[] = [], marks: { id: string; frame: string }[] = [];
  const frames: string[] = [];
  const surface = { CLOSE: "close", ROUND: "round", push() {}, pop() {}, translate(x: number, y: number) { frames.push(`t${x.toFixed(6)},${y.toFixed(6)}`); },
    rotate() {}, scale() {}, noFill() {}, noStroke() {}, fill() {}, stroke() {}, strokeWeight() {}, strokeCap() {},
    circle() {}, line() {}, rect() {}, beginShape() {}, vertex() {}, endShape() {} };
  drawPlate(surface, built.plates[0], { stroke: (_s, path) => { seen.push(path.id); }, mark: () => { throw new Error("no dots on plate A"); } });
  drawPlate(surface, built.plates[1], { stroke: () => { throw new Error("no lines on plate B"); },
    mark: (_s, site) => { marks.push({ id: site.id, frame: frames[frames.length - 1] }); } });
  assert.deepEqual(seen, built.plates[0].paths.map((path) => path.id));
  assert.deepEqual(marks.map((mark) => mark.id), built.plates[1].sites.map((site) => site.id));
  marks.forEach((mark, index) => assert.equal(mark.frame, `t${built.plates[1].sites[index].position[0].toFixed(6)},${built.plates[1].sites[index].position[1].toFixed(6)}`));

  const ink = { material: { kind: "ink" as const, weight: 1, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
    mark: { kind: "dot" as const, size: 0, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } },
    mark: { kind: "dot" as const, size: 4, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } };
  const count = (show: PlatesRecipe["show"]) => {
    let shapes = 0, circles = 0;
    drawPlatesRecipe({ ...surface, beginShape() { shapes++; }, circle() { circles++; } },
      { kind: "plates", source: options, show, ink: [ink, ink], palette: [0x102030, 0xa04030] });
    return [shapes, circles];
  };
  assert.deepEqual(count("all"), [built.plates[0].paths.length, built.plates[1].sites.length]);
  assert.deepEqual(count([1]), [0, built.plates[1].sites.length]);
  assert.deepEqual(count([0]), [built.plates[0].paths.length, 0]);
  assert.throws(() => drawPlatesRecipe(surface, { kind: "plates", source: options, show: [2], ink: [ink, ink], palette: [0] }), /does not exist/);
  assert.throws(() => drawPlatesRecipe(surface, { kind: "plates", source: options, show: "all", ink: [ink, ink], palette: [0x102030, 0xa04030] },
    createCompositionRun({ maxWork: 3 })), /budget exceeded/);
});

test("any function of the pattern type can replace a stock pattern", () => {
  const support = resolveSupport(box(100, 100), .02);
  const diagonal = (request: PatternRequest) => ({
    strokes: [{ id: "diag", closed: false, points: [[request.x - 200, request.y - 200] as Point, [request.x + 200, request.y + 200] as Point] }],
    dots: [], minPeriod: 5 });
  const custom = makePlate({ id: "X", tone: 3, seed: 1, pattern: diagonal, frame: { x: 0, y: 0, angle: 0, phase: 0 }, support, flatness: .02 });
  assert.equal(custom.paths.length, 1);
  near(custom.paths[0].points[0][0], -50); near(custom.paths[0].points[1][0], 50);
  assert.equal(custom.paths[0].tone, 3);
  assert.throws(() => makePlate({ id: "X", tone: 0, seed: 1, frame: { x: 0, y: 0, angle: 0, phase: 0 }, support, flatness: .02,
    pattern: () => ({ strokes: [{ id: "s", closed: false, points: [[0, 0], [1, 1]] }, { id: "s", closed: false, points: [[0, 0], [1, 1]] }], dots: [], minPeriod: 1 }) }),
    /duplicate element id/);
  assert.throws(() => makePlate({ id: "a/b", tone: 0, seed: 1, pattern: diagonal, frame: { x: 0, y: 0, angle: 0, phase: 0 }, support, flatness: .02 }), /Plate id/);
});

test("plate paths are ordinary composition paths: a coordinate map splits and keeps them", () => {
  const { paths } = opticalPlates(pair(plate(grating(20), { support: box(200, 100) }), plate(grating(10)))).plates[0];
  const mapped = warpPaths(paths, { centerX: 0, centerY: 0, radius: 100, iterations: 1, bound: 8, stages: [{ map: "sinusoidal", amount: .5, frequency: 1 }] });
  assert.ok(mapped.length >= paths.length);
  assert.ok(mapped.every((path) => path.id.startsWith("A/line:") && path.tone === 0));
});

test("invalid plate descriptions and exceeded bounds are refused with their limit named", () => {
  const build = (a: PatternSpec, over: Partial<OpticalPlatesOptions> = {}, support = box(200, 100)) =>
    opticalPlates(pair(plate(a, { support }), plate(grating(10)), over));
  assert.throws(() => build(grating(2.9)), /Period must be finite and in \[3/);
  assert.throws(() => build({ kind: "spokes", count: 1, hub: 0 }), /Spoke count/);
  assert.throws(() => build({ kind: "spokes", count: 721, hub: 0 }), /Spoke count/);
  assert.throws(() => build({ kind: "dots", period: 3, lattice: "square" }, {}, box(600, 600)), /Dot lattice needs/);
  assert.throws(() => build(grating(10, .5), {}, box(600, 600)), /more than 80%/);
  assert.throws(() => build(grating(3, .3), {}, box(120, 100)), /below the 3-unit minimum/);
  assert.throws(() => build({ kind: "grating", period: 10, chirp: 0 }, { seed: -1 }), /uint32/);
  assert.throws(() => build({ kind: "torus" } as unknown as PatternSpec), /Unknown pattern kind/);
  assert.throws(() => opticalPlates({ ...pair(plate(grating(10)), plate(grating(10))), plates: [] }), /1–8 plates/);
  assert.throws(() => opticalPlates(pair(plate(grating(10), { registration: { offsetX: NaN, offsetY: 0, rotation: 0, phase: 0 } }), plate(grating(10)))), /Plate offset x/);
  assert.throws(() => resolveSupport({ footprint: { shape: "rectangle", centerX: 0, centerY: 0, width: 0, height: 10 } }, .02), /Footprint width/);
  assert.throws(() => resolveSupport({ ...box(10, 10), mask: { invert: false, source: { kind: "paths", rings: [[[0, 0], [1, 1]]] } } }, .02), /at least three/);
  // Too many wave vertices are refused; so is a screen whose clipping against a mask would exceed the work limit.
  const wavy = (period: number): PatternSpec => ({ kind: "waves", period, chirp: 0, amplitude: 20, wavelength: 20 });
  assert.throws(() => build(wavy(4), {}, box(600, 600)), /Wave grating vertices needs/);
  const glyphs = { kind: "text" as const, text: "MMMMMMMMMMMMMMMMMMMM", centerX: 0, centerY: 0, width: 600, height: 300 };
  assert.throws(() => build(wavy(7), {}, { ...box(600, 600), mask: { invert: false, source: glyphs } }), /Support clipping needs/);
});

test("the pattern primitive shared with Registered Screens places each vertex on its line", () => {
  const lines = gratingLines({ originX: 10, originY: 20, angle: Math.PI / 2, offsets: [0, 5], travel: 8, steps: 2, curve: 3, waveCycles: 1, waveSpan: 16 });
  // Direction (0, 1), normal (−1, 0): vertex t sits at (10 − normal, 20 + t).
  const expected = (shift: number, t: number): Point => [10 - (shift + 3 * Math.sin(2 * Math.PI * t / 16)), 20 + t];
  [0, 5].forEach((shift, index) => [-8, 0, 8].forEach((t, i) => {
    near(lines[index][i][0], expected(shift, t)[0]); near(lines[index][i][1], expected(shift, t)[1]);
  }));
});

test("Registered Screens draws the shared grating lines clipped to its footprint", () => {
  const input = createInstrument("registered-screens");
  Object.assign(input.params, { enableA: true, pitchA: 20, angleA: 0, phaseA: 0, offsetXA: 0, offsetYA: 0, curveA: 0, width: 200, height: 100, centerX: 100, centerY: 50 });
  const segments = registeredScreenSegments(input.params, "A");
  assert.deepEqual(segments.map((s) => s[1]).sort((a, b) => a - b), [10, 30, 50, 70, 90]);
  for (const [x1, y1, x2, y2] of segments) { near(x1, 0); near(x2, 200); near(y1, y2); }
  Object.assign(input.params, { angleA: 90, phaseA: 4 });
  const vertical = registeredScreenSegments(input.params, "A");
  // Direction (0, 1), normal (−1, 0): line k sits at x = 100 − (20k + 4).
  assert.deepEqual(vertical.map((s) => Math.round(s[0] * 1e6) / 1e6).sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => 16 + 20 * i));
});

test("scalar wave patterns evaluate their stated cosines and replace Interference Lace's families", () => {
  const angle = .7, wave = planeWave({ frequency: 2, ratio: 1.5, angle, phase: .3 });
  near(wave(.2, -.1, .05), Math.cos(2 * Math.PI * 2 * 1.5 * (.2 * Math.cos(angle) - .1 * Math.sin(angle) + .05) + .3));
  near(radialWave({ frequency: 3, phase: 1 })(.3, .4, 0), Math.cos(2 * Math.PI * 3 * .5 + 1));
  const params = createInstrument("interference-lace").params;
  const constant = interferenceLaceField(42, { ...params, warp: 0 }, [() => 1, () => 1]);
  const mid = (constant.size - 1) / 2;
  near(constant.values[mid * constant.size + mid], 1);
  assert.equal(constant.values[0], 0, "outside the soft source the field is zero");
  const mixed = interferenceLaceField(42, { ...params, warp: 0 }, [() => 1, () => -1]);
  near(mixed.values[mid * mixed.size + mid], 0);
});

test("the Optical Plates instrument resolves named controls to a plates recipe with stable, honest structure", () => {
  const input = createInstrument("optical-plates");
  const recipe = referenceComposition(input);
  assert.equal(recipe.kind, "plates");
  if (recipe.kind !== "plates") return;
  const [a, b] = recipe.source.plates;
  assert.equal(a.support.mask, undefined, "the regular plate keeps the plain footprint");
  assert.equal(b.support.mask?.source.kind, "text");
  // Appearance edits never change construction: same cached plates object.
  const same = (params: Record<string, number | string | boolean>) => {
    const other = referenceComposition({ ...input, params: { ...input.params, ...params } });
    return other.kind === "plates" && opticalPlates(other.source) === opticalPlates(recipe.source);
  };
  assert.ok(same({ weightA: 2.5, weightB: .5, dotSizeA: 7, show: "A" }));
  assert.ok(!same({ periodA: 9 }));
  assert.ok(!same({ text: "AB" }));
  // Hidden controls do not reach the construction: spokes ignore the period, gratings ignore hub.
  const spokes = { patternA: "spokes" };
  assert.ok(referenceComposition({ ...input, params: { ...input.params, ...spokes, periodA: 30 } }).kind === "plates");
  const key = (params: Record<string, number | string | boolean>) => JSON.stringify((referenceComposition({ ...input, params: { ...input.params, ...params } }) as PlatesRecipe).source);
  assert.equal(key({ ...spokes, periodA: 30 }), key({ ...spokes, periodA: 11 }));
  assert.equal(key({ hubA: 50 }), key({ hubA: 5 }));
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, text: "   " } }), /Type must be/);
});

test("region masks are seeded and retention drops regions without moving any other", () => {
  const input = createInstrument("optical-plates");
  const regions = (seed: number, keep: number) => {
    const recipe = referenceComposition({ ...input, seed, params: { ...input.params, maskedPlate: "B", maskShape: "regions", regionKeep: keep } });
    const mask = (recipe as PlatesRecipe).source.plates[1].support.mask!;
    return mask.source.kind === "regions" ? mask.source.regions.map((region) => region.bounds.join(",")) : [];
  };
  const all = regions(5, 1), some = regions(5, .5), fewer = regions(5, .2);
  assert.ok(all.length > 6 && some.length < all.length && fewer.length < some.length);
  assert.ok(some.every((bounds) => all.includes(bounds)) && fewer.every((bounds) => some.includes(bounds)), "lower retention keeps a subset");
  assert.notDeepEqual(regions(6, 1), all, "a new seed re-partitions");
  const seeded = (params: Record<string, number | string | boolean>) => usesSeed({ ...input, params: { ...input.params, ...params } });
  assert.equal(seeded({}), false);
  assert.equal(seeded({ maskedPlate: "A", maskShape: "regions" }), true);
  assert.equal(seeded({ maskedPlate: "none", maskShape: "regions" }), false);
});

test("the same plates draw through another path material by replacing one field of the recipe", () => {
  const recipe = referenceComposition({ ...createInstrument("optical-plates"),
    params: { ...createInstrument("optical-plates").params, show: "A", patternA: "grating" } });
  assert.equal(recipe.kind, "plates");
  if (recipe.kind !== "plates") return;
  const counts = (spec: PlatesRecipe) => {
    const tally = { shapes: 0, lines: 0 };
    drawReferenceComposition({ CLOSE: "close", ROUND: "round", push() {}, pop() {}, translate() {}, rotate() {}, scale() {},
      noFill() {}, noStroke() {}, fill() {}, stroke() {}, strokeWeight() {}, strokeCap() {}, circle() {}, rect() {},
      line() { tally.lines++; }, beginShape() { tally.shapes++; }, vertex() {}, endShape() {} }, spec);
    return tally;
  };
  const ink = counts(recipe);
  assert.equal(ink.shapes, opticalPlates(recipe.source).plates[0].paths.length);
  assert.equal(ink.lines, 0);
  const stitched = counts({ ...recipe, ink: [{ ...recipe.ink[0], material: { ...recipe.ink[0].material, kind: "stitch", spacing: 6 } }, recipe.ink[1]] });
  assert.equal(stitched.shapes, 0);
  assert.ok(stitched.lines > ink.shapes);
});
