import assert from "node:assert/strict";
import test from "node:test";
import {
  createInstrument, drawInstrument, drawQuilled, letterPaths, MAX_QUILL_FACES, MAX_QUILL_VERTICES, projectPoint, quillCamera, quillComposition,
  quillGeometry, quillPaper, quillProducts, quillProjection, quillScaffold, quillStrips, rollPoints, scrollPaths, spiralPaths, stripHeight, subdivide,
  poissonSites, typeLine, usesSeed, validateInstrument, validateParameters,
  type CompositionSurface, type InstrumentInput, type Path, type Point, type QuillCamera, type QuillFace, type QuillGeometry, type QuillStripOptions,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const TAU = Math.PI * 2;

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  polygons: number[][] = []; private shape: number[] = []; fills: number[][] = []; private fillNow: number[] = [];
  push() {} pop() {} translate() {} rotate() {} scale() {} noFill() {} noStroke() {}
  fill(...a: number[]) { this.fillNow = a; } stroke() {} strokeWeight() {} strokeCap() {} circle() {} line() {} rect() {}
  beginShape() { this.shape = []; } vertex(x: number, y: number) { this.shape.push(x, y); }
  endShape() { this.polygons.push(this.shape); this.fills.push(this.fillNow); }
}

const path = (id: string, points: Point[], closed = false, level = 0): Path =>
  Object.freeze({ id, seed: 1, points: Object.freeze(points.map((p) => Object.freeze([...p] as const))), closed, level, levelFraction: 0 });
const circle = (id: string, radius: number, count = 180, cx = 0, cy = 0, sign = 1): Path =>
  path(id, Array.from({ length: count }, (_, i) => [cx + radius * Math.cos(sign * TAU * i / count), cy + radius * Math.sin(sign * TAU * i / count)] as Point), true);
const options = (over: Partial<QuillStripOptions> = {}): QuillStripOptions => ({
  seed: 1, spacing: 9, nest: 0, nestSide: "inward", thickness: 3, clearance: 1, resolution: 4, overlap: "trim", terminals: "none", curl: "left",
  curlRadius: 20, curlGap: 1.5, ...over,
});
const line = (id: string, a: Point, b: Point) => path(id, [a, b]);

// --- independent geometry helpers -------------------------------------------------------------
/** Closest distance between two segments by Ericson's closest-point algorithm (not the implementation's formulation). */
function segmentDistance(p1: Point, q1: Point, p2: Point, q2: Point): number {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1]], d2 = [q2[0] - p2[0], q2[1] - p2[1]], r = [p1[0] - p2[0], p1[1] - p2[1]];
  const a = d1[0] * d1[0] + d1[1] * d1[1], e = d2[0] * d2[0] + d2[1] * d2[1], f = d2[0] * r[0] + d2[1] * r[1];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  let s: number, t: number;
  const c = d1[0] * r[0] + d1[1] * r[1], b = d1[0] * d2[0] + d1[1] * d2[1], denom = a * e - b * b;
  s = denom > 1e-12 ? clamp((b * f - c * e) / denom) : 0;
  t = (b * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
  const dx = p1[0] + d1[0] * s - (p2[0] + d2[0] * t), dy = p1[1] + d1[1] * s - (p2[1] + d2[1] * t);
  return Math.hypot(dx, dy);
}
function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const segmentsOf = (points: readonly Point[], closed: boolean): Array<[Point, Point]> =>
  Array.from({ length: closed ? points.length : points.length - 1 }, (_, i) => [points[i], points[(i + 1) % points.length]] as [Point, Point]);
/** Radius of the circle through three points. */
function circumradius(a: Point, b: Point, c: Point): number {
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return ab * bc * ca / (2 * area2);
}
const shoelace = (ring: readonly Point[]) => ring.reduce((sum, [x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return sum + (x1 * y2 - x2 * y1) / 2; }, 0);

// --- rolls -------------------------------------------------------------------------------------
test("a roll leaves tangentially and its radius of curvature falls by one pitch per turn to the tightest bend", () => {
  const R = 24, pitch = 4, core = 5, step = 1, k = pitch / TAU;
  const pts = rollPoints([10, 20], 0.7, 1, R, pitch, core, step);
  // Tangent at the origin is the heading (first chord within half a step of turning).
  near(Math.atan2(pts[0][1] - 20, pts[0][0] - 10), 0.7, 0.06, "initial heading");
  const dirs: number[] = [];
  pts.forEach((p, i) => {
    const q = i === 0 ? [10, 20] : pts[i - 1];
    const raw = Math.atan2(p[1] - q[1], p[0] - q[0]);
    dirs.push(i === 0 ? raw : dirs[i - 1] + ((((raw - dirs[i - 1] + Math.PI) % TAU) + TAU) % TAU) - Math.PI);
  });
  for (let i = 1; i + 1 < pts.length; i++) {
    const turned = (dirs[i] + dirs[i + 1]) / 2 - 0.7;
    const expected = R - k * turned;
    const measured = circumradius(pts[i - 1], pts[i], pts[i + 1]);
    assert.ok(Math.abs(measured / expected - 1) < 0.04, `vertex ${i}: radius ${measured} vs ${expected}`);
  }
  const total = dirs[dirs.length - 1] - 0.7;
  near(total / TAU, (R - core) / pitch, 0.05, "number of turns");
  near(circumradius(pts[pts.length - 3], pts[pts.length - 2], pts[pts.length - 1]), core, core * 0.1, "ends at the tightest bend");
  // Successive turns stay one pitch apart: the nearest point on the arc one turn later.
  let checked = 0;
  for (let i = 2; i < pts.length - 2; i++) {
    const turned = dirs[i] - 0.7;
    if (turned + TAU + 0.7 > total) break;
    let best = Infinity;
    for (let j = 1; j < pts.length; j++) {
      const t = dirs[j] - 0.7;
      if (t < turned + TAU - 0.9 || t > turned + TAU + 0.9) continue;
      best = Math.min(best, pointSegmentDistance(pts[i], pts[j - 1], pts[j]));
    }
    assert.ok(best > pitch * 0.9 && best < pitch * 1.03, `turn gap ${best} at vertex ${i}`);
    checked++;
  }
  assert.ok(checked > 20);
});

test("rolling toward the other side mirrors the roll about its heading line", () => {
  const a = rollPoints([0, 0], 0, 1, 18, 3, 4, 1), b = rollPoints([0, 0], 0, -1, 18, 3, 4, 1);
  assert.equal(a.length, b.length);
  a.forEach(([x, y], i) => { near(b[i][0], x, 1e-9); near(b[i][1], -y, 1e-9); });
  assert.ok(a.every(([, y]) => y >= -1e-9), "a clockwise roll of a heading +x stays on the +y side");
});

test("subdivision keeps every original vertex, never exceeds the maximum and spaces each segment equally", () => {
  const src: Point[] = [[0, 0], [10, 0], [10, 3], [0, 3.5]];
  for (const closed of [false, true]) {
    const out = subdivide(src, closed, 2);
    for (const p of src) assert.ok(out.some((q) => q[0] === p[0] && q[1] === p[1]), "original vertex kept");
    const segs = segmentsOf(out, closed);
    assert.equal(segs.length, out.length - (closed ? 0 : 1));
    for (const [a, b] of segs) assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) <= 2 + 1e-9);
    const length = (pts: readonly Point[]) => segmentsOf(pts, closed).reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
    near(length(out), length(src), 1e-9);
    // the first source segment (10 long) is cut into exactly five equal pieces
    near(Math.hypot(out[1][0] - out[0][0], out[1][1] - out[0][1]), 2, 1e-9);
  }
});

// --- scaffolds ---------------------------------------------------------------------------------
test("letter scaffolds fit the frame, keep counters as depth one and are cached frozen values", () => {
  const frame = { seed: 1, word: "QUILL", centerX: 300, centerY: 200, width: 400, height: 300, rotation: 0 };
  const paths = letterPaths(frame);
  assert.strictEqual(letterPaths({ ...frame }), paths, "same construction, same cached value");
  assert.ok(Object.isFrozen(paths) && Object.isFrozen(paths[0]) && Object.isFrozen(paths[0].points) && Object.isFrozen(paths[0].points[0]));
  const xs = paths.flatMap((p) => p.points.map((q) => q[0])), ys = paths.flatMap((p) => p.points.map((q) => q[1]));
  const line = typeLine("QUILL");
  const scale = Math.min(400 / (line.right - line.left), 300 / (line.bottom - line.top));
  near(Math.max(...xs) - Math.min(...xs), (line.right - line.left) * scale, 1e-6, "ink width");
  near((Math.max(...xs) + Math.min(...xs)) / 2, 300, 1e-6);
  near((Math.max(...ys) + Math.min(...ys)) / 2, 200, 1e-6);
  // "O" has an outer ring (depth 0) and one counter (depth 1); counters lie inside their outer ring.
  const o = letterPaths({ ...frame, word: "O" });
  assert.deepEqual(o.map((p) => p.level).sort(), [0, 1]);
  const box = (p: Path) => [Math.min(...p.points.map((q) => q[0])), Math.max(...p.points.map((q) => q[0]))];
  const outer = o.find((p) => p.level === 0)!, inner = o.find((p) => p.level === 1)!;
  assert.ok(box(inner)[0] > box(outer)[0] && box(inner)[1] < box(outer)[1]);
  assert.ok(o.every((p) => p.closed && p.id.startsWith("letter:")));
  // Rotation by 90 degrees swaps the extents.
  const turned = letterPaths({ ...frame, rotation: 90 });
  const tx = turned.flatMap((p) => p.points.map((q) => q[0]));
  near(Math.max(...tx) - Math.min(...tx), Math.max(...ys) - Math.min(...ys), 1e-6, "rotated extent");
});

test("spiral arms follow their radius laws from the inner end to the outer end", () => {
  const base = { seed: 1, arms: 3, turns: 2, core: 0.1, variation: 0, centerX: 100, centerY: 100, width: 200, height: 200, rotation: 0 };
  const arch = spiralPaths({ ...base, family: "archimedean" });
  assert.equal(arch.length, 3);
  arch.forEach((arm, k) => {
    const radii = arm.points.map(([x, y]) => Math.hypot(x - 100, y - 100));
    near(radii[0], 10, 1e-6, "inner radius"); near(radii[radii.length - 1], 100, 1e-6, "outer radius");
    for (let i = 1; i < radii.length; i++) assert.ok(radii[i] >= radii[i - 1] - 1e-9, "radius grows along the arm");
    near(Math.atan2(arm.points[0][1] - 100, arm.points[0][0] - 100), TAU * k / 3 > Math.PI ? TAU * k / 3 - TAU : TAU * k / 3, 1e-6, "arm offset");
    // Archimedean: radius is linear in the turned angle; check the midpoint of the arm.
    const mid = arm.points.reduce((best, p) => Math.abs(Math.hypot(p[0] - 100, p[1] - 100) - 55) < Math.abs(Math.hypot(best[0] - 100, best[1] - 100) - 55) ? p : best);
    near(Math.hypot(mid[0] - 100, mid[1] - 100), 55, 0.5);
  });
  const log = spiralPaths({ ...base, family: "logarithmic", arms: 1 })[0], fermat = spiralPaths({ ...base, family: "fermat", arms: 1 })[0];
  const total = TAU * 2;
  for (const [family, arm, law] of [["log", log, (u: number) => 0.1 ** (1 - u)], ["fermat", fermat, (u: number) => Math.sqrt(0.01 + 0.99 * u)]] as const) {
    let angle = 0, previous = Math.atan2(arm.points[0][1] - 100, arm.points[0][0] - 100), unwrapped = previous;
    for (const [x, y] of arm.points) {
      const a = Math.atan2(y - 100, x - 100);
      unwrapped += ((a - previous + Math.PI * 3) % TAU) - Math.PI; previous = a; angle = unwrapped - Math.atan2(arm.points[0][1] - 100, arm.points[0][0] - 100);
      near(Math.hypot(x - 100, y - 100), 100 * law(Math.min(1, angle / total)), 0.5, `${family} radius at turned angle ${angle.toFixed(2)}`);
    }
  }
  // Variation shortens some arms and is a function of the seed only.
  const varied = spiralPaths({ ...base, family: "archimedean", variation: 1, seed: 9 }), again = spiralPaths({ ...base, family: "archimedean", variation: 1, seed: 9 });
  assert.strictEqual(varied, again);
  const other = spiralPaths({ ...base, family: "archimedean", variation: 1, seed: 10 });
  assert.notDeepEqual(varied.map((p) => p.points.length), other.map((p) => p.points.length));
});

test("scroll scaffolds are one S strip per Poisson site, centred on the site with its own stable length", () => {
  const sites = { seed: 3, width: 400, height: 300, centerX: 200, centerY: 150, separation: 60, maxPoints: 200, support: "rectangle" as const, opening: 0, rotation: 0 };
  const population = poissonSites(sites);
  const scrolls = scrollPaths({ seed: 3, sites, length: 90, lengthVariation: 0.4, bend: 0.3 });
  assert.equal(scrolls.length, population.length);
  scrolls.forEach((s, i) => {
    assert.equal(s.id, `scroll:${i}`);
    const [a, b] = [s.points[0], s.points[s.points.length - 1]];
    near((a[0] + b[0]) / 2, population[i].position[0], 1e-9); near((a[1] + b[1]) / 2, population[i].position[1], 1e-9);
    const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    assert.ok(chord <= 90 + 1e-9 && chord >= 90 * 0.6 - 1e-9, `chord ${chord}`);
  });
  // No bend: every strip is straight.
  for (const s of scrollPaths({ seed: 3, sites, length: 90, lengthVariation: 0, bend: 0 })) {
    const [a, b] = [s.points[0], s.points[s.points.length - 1]];
    near(Math.hypot(b[0] - a[0], b[1] - a[1]), 90, 1e-9);
    for (const p of s.points) near(Math.abs(orientArea(a, b, p)), 0, 1e-6);
  }
  // Same site, another seed for the angle stream: strips turn differently but sit on the same sites.
  const other = scrollPaths({ seed: 4, sites: { ...sites, seed: 3 }, length: 90, lengthVariation: 0.4, bend: 0.3 });
  assert.notDeepEqual(other[0].points, scrolls[0].points);
});
const orientArea = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// --- strips ------------------------------------------------------------------------------------
test("nest rings are exact offsets toward the interior, exterior or both, whatever the path's winding", () => {
  const n = 180, half = Math.PI / n, R = 100, apothem = R * Math.cos(half);
  for (const sign of [1, -1]) {
    const strips = quillStrips([circle("c", R, n, 0, 0, sign)], options({ nest: 3, nestSide: "both", spacing: 9 }));
    const ids = strips.strips.map((s) => s.id).sort();
    assert.deepEqual(ids, ["c#0", "c/nest:+1#0", "c/nest:+2#0", "c/nest:+3#0", "c/nest:-1#0", "c/nest:-2#0", "c/nest:-3#0"].sort());
    for (const strip of strips.strips) {
      const d = strip.ring * 9, a = apothem - d;
      for (const [x, y] of strip.points) {
        const r = Math.hypot(x, y);
        assert.ok(r >= a - 1e-6 && r <= a / Math.cos(half) + 1e-6, `ring ${strip.ring}: radius ${r} outside [${a}, ${a / Math.cos(half)}]`);
      }
    }
  }
  const inward = quillStrips([circle("c", R, n)], options({ nest: 2, nestSide: "inward" }));
  assert.deepEqual(inward.strips.map((s) => s.ring).sort((a, b) => a - b), [0, 1, 2]);
  const outward = quillStrips([circle("c", R, n)], options({ nest: 2, nestSide: "outward" }));
  assert.deepEqual(outward.strips.map((s) => s.ring).sort((a, b) => a - b), [-2, -1, 0]);
});

test("a nest ring stops where the offset would collapse or cross itself, and only for that path", () => {
  const small = quillStrips([circle("small", 30, 90)], options({ nest: 6, spacing: 9 }));
  assert.deepEqual(small.strips.map((s) => s.ring).sort(), [0, 1, 2, 3]);
  assert.deepEqual(small.diagnostics.nestStops.map((s) => [s.ring, s.reason]), [[4, "inverted"]]);
  // A thin rectangle 100 x 10: inset 4 leaves a 92 x 2 rectangle exactly; inset 8 would invert it.
  const rect = path("rect", [[0, 0], [100, 0], [100, 10], [0, 10]], true);
  const thin = quillStrips([rect, circle("big", 60, 90, 300, 0)], options({ nest: 4, spacing: 4 }));
  const rectRings = thin.strips.filter((s) => s.source === "rect").map((s) => s.ring).sort();
  assert.deepEqual(rectRings, [0, 1]);
  const ring1 = thin.strips.find((s) => s.id === "rect/nest:+1#0")!;
  const xs = ring1.points.map((p) => p[0]), ys = ring1.points.map((p) => p[1]);
  near(Math.min(...xs), 4, 1e-9); near(Math.max(...xs), 96, 1e-9); near(Math.min(...ys), 4, 1e-9); near(Math.max(...ys), 6, 1e-9);
  assert.deepEqual(thin.diagnostics.nestStops.filter((s) => s.source === "rect").map((s) => s.ring), [2]);
  // The big circle is unaffected by the rectangle's stop: it nests all four rings.
  assert.equal(thin.strips.filter((s) => s.source === "big").length, 5);
});

test("rolled ends curl toward the requested side of the strip and stay tangent to it", () => {
  const straight = line("s", [0, 0], [200, 0]);
  const side = (curl: QuillStripOptions["curl"]) => {
    const strip = quillStrips([straight], options({ terminals: "both", curl })).strips;
    assert.equal(strip.length, 1);
    return strip[0].points;
  };
  const both = side("left"), oppo = side("opposite"), right = side("right");
  const ySide = (pts: readonly Point[], atEnd: boolean) => {
    const roll = atEnd ? pts.filter(([x, y]) => x >= 200 - 1e-9 && (Math.abs(y) > 1e-9 || x > 200 + 1e-9)) : pts.filter(([x, y]) => x <= 0 + 1e-9 && (Math.abs(y) > 1e-9 || x < -1e-9));
    return { min: Math.min(...roll.map((p) => p[1])), max: Math.max(...roll.map((p) => p[1])), roll };
  };
  // Left of a strip travelling +x on a y-down canvas is -y.
  assert.ok(ySide(both, true).max <= 1e-9 && ySide(both, true).min < -10, "end curls to -y");
  assert.ok(ySide(both, false).max <= 1e-9 && ySide(both, false).min < -10, "C scroll: start also curls to -y");
  assert.ok(ySide(oppo, true).max <= 1e-9 && ySide(oppo, false).min >= -1e-9 && ySide(oppo, false).max > 10, "S scroll: start curls to +y");
  assert.ok(ySide(right, true).min >= -1e-9 && ySide(right, true).max > 10 && ySide(right, false).min >= -1e-9);
  // Only the requested ends roll.
  const endOnly = quillStrips([straight], options({ terminals: "end", curl: "left" })).strips[0];
  assert.deepEqual(endOnly.rolled, { start: false, end: true });
  assert.equal(endOnly.points[0][0], 0);
  const none = quillStrips([straight], options({ terminals: "none" })).strips[0];
  assert.deepEqual(none.rolled, { start: false, end: false });
  assert.equal(none.points[none.points.length - 1][0], 200);
  // Random is a stable choice per end and depends on the seed.
  const randomSides = (seed: number) => {
    const pts = quillStrips([straight], options({ terminals: "both", curl: "random", seed })).strips[0].points;
    return [Math.sign(ySide(pts, true).min < -1 ? -1 : 1), Math.sign(ySide(pts, false).min < -1 ? -1 : 1)].join();
  };
  assert.equal(randomSides(5), randomSides(5));
  assert.ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(randomSides)).size > 1, "different seeds choose different sides");
});

test("a roll is tangent at the join: no corner where the roll starts", () => {
  const strip = quillStrips([line("s", [0, 0], [100, 0])], options({ terminals: "end", curl: "right" })).strips[0];
  const join = strip.points.findIndex(([x]) => Math.abs(x - 100) < 1e-9);
  const before = strip.points[join], after = strip.points[join + 1], prior = strip.points[join - 1];
  const a = Math.atan2(before[1] - prior[1], before[0] - prior[0]), b = Math.atan2(after[1] - before[1], after[0] - before[0]);
  assert.ok(Math.abs(b - a) < 0.15, `heading jumps by ${b - a}`);
});

test("rolls need a radius the paper can make and a bounded number of turns", () => {
  const o = options({ terminals: "end", thickness: 3, curlGap: 2 });
  assert.throws(() => quillStrips([line("s", [0, 0], [100, 0])], { ...o, curlRadius: 6 }), /Curl radius 6 is below the tightest roll .* \(6\.25\)/);
  assert.throws(() => quillStrips([line("s", [0, 0], [100, 0])], { ...o, curlGap: 0.5, clearance: 1 }), /Curl gap 0\.5 must be at least the clearance 1/);
  assert.throws(() => quillStrips([line("s", [0, 0], [100, 0])], { ...o, curlRadius: 500 }), /turns; the limit is 40/);
  // With no terminals none of those checks applies.
  quillStrips([line("s", [0, 0], [100, 0])], { ...o, terminals: "none", curlRadius: 1, curlGap: 0 });
  assert.throws(() => quillStrips([circle("c", 50)], options({ nest: 1, spacing: 3.5 })), /Strip spacing 3\.5 must be at least paper thickness \+ clearance \(4\)/);
});

test("overlap is trimmed segment by segment against higher-ranked strips, or rejected with a diagnostic", () => {
  const limit = 0.97 * (3 + 1);
  const pair = (gap: number) => quillStrips([line("a", [0, 0], [100, 0]), line("b", [0, gap], [100, gap])], options());
  assert.equal(pair(6).strips.length, 2);
  assert.equal(pair(6).diagnostics.trimmedSegments, 0);
  assert.equal(pair(limit + 0.01).strips.length, 2, "just clear of the limit");
  const near1 = pair(limit - 0.01);
  assert.deepEqual(near1.strips.map((s) => s.id), ["a#0"], "the later strip loses");
  assert.equal(near1.diagnostics.trimmedSegments, 25);
  // Order decides the loser: reversing the list trims the other strip.
  const reversed = quillStrips([line("b", [0, 1], [100, 1]), line("a", [0, 0], [100, 0])], options());
  assert.deepEqual(reversed.strips.map((s) => s.id), ["b#0"]);
  // Crossing strips: every segment of the later strip is kept exactly when it is clear of the earlier one.
  const across = line("a", [-100, 0], [100, 0]), down = line("b", [0, -100], [0, 100]);
  const result = quillStrips([across, down], options());
  const original = segmentsOf(subdivide(down.points, false, 4), false), other = segmentsOf(subdivide(across.points, false, 4), false);
  const kept = new Set(result.strips.filter((s) => s.source === "b").flatMap((s) => segmentsOf(s.points, s.closed).map(([p, q]) => `${p}|${q}`)));
  let dropped = 0;
  for (const [p, q] of original) {
    const clear = other.every(([r, s]) => segmentDistance(p, q, r, s) >= limit);
    assert.equal(kept.has(`${p}|${q}`), clear, `segment ${p}→${q}`);
    if (!clear) dropped++;
  }
  assert.ok(dropped >= 2 && result.strips.filter((s) => s.source === "b").length === 2, "the later strip splits in two");
  assert.equal(result.diagnostics.trimmedSegments, dropped);
  assert.throws(() => quillStrips([line("a", [0, 0], [100, 0]), line("b", [0, 1], [100, 1])], options({ overlap: "reject" })),
    /Strips overlap along 25 segments \(first: b and a near .*\); raise Strip spacing/);
});

test("scaffold strips outrank nest rings, and shallower rings outrank deeper ones", () => {
  // a: radius 100, b: radius 88, nest 2 at spacing 9. a's ring +1 (91) is 3 from b's scaffold ring (88);
  // a's ring +2 (82) is 3 from b's ring +1 (79), a shallower ring than a's own +2.
  const result = quillStrips([circle("a", 100, 180), circle("b", 88, 180)], options({ nest: 2, spacing: 9 }));
  const rings = (source: string) => result.strips.filter((s) => s.source === source).map((s) => s.ring).sort();
  assert.deepEqual(rings("a"), [0]);
  assert.deepEqual(rings("b"), [0, 1, 2]);
  assert.ok(result.strips.every((s) => s.closed), "kept rings are whole loops");
  // Swapping the list order leaves the scaffold-versus-nest rule unchanged: b's rings still win over a's deeper ones.
  const swapped = quillStrips([circle("b", 88, 180), circle("a", 100, 180)], options({ nest: 2, spacing: 9 }));
  assert.deepEqual(swapped.strips.filter((s) => s.source === "a").map((s) => s.ring).sort(), [0]);
  assert.deepEqual(swapped.strips.filter((s) => s.source === "b").map((s) => s.ring).sort(), [0, 1, 2]);
});

test("a roll that touches another strip is cut at the first contact, not left as detached arcs", () => {
  const stem = line("stem", [0, 0], [100, 0]);
  const wall = line("wall", [123, -60], [123, 60]);
  const o = options({ terminals: "end", curl: "left", curlRadius: 26, curlGap: 1.5 });
  const result = quillStrips([wall, stem], o);
  const pieces = result.strips.filter((s) => s.source === "stem");
  const full = [...subdivide(stem.points, false, 4), ...rollPoints([100, 0], 0, -1, 26, 4.5, 1.25 * 4.5, 4)];
  const limit = 0.97 * 4, guard = segmentsOf(subdivide(wall.points, false, 4), false);
  const firstBad = segmentsOf(full, false).findIndex(([p, q]) => guard.some(([r, s]) => segmentDistance(p, q, r, s) < limit));
  assert.ok(firstBad > 25, "the roll, not the stem, meets the wall");
  assert.equal(pieces.length, 1);
  assert.deepEqual(pieces[0].points.map((p) => [...p]), full.slice(0, firstBad + 1).map((p) => [...p]));
  assert.deepEqual(pieces[0].rolled, { start: false, end: false });
});

test("no two kept segments of different strips are closer than the clearance, on real scaffolds", () => {
  for (const params of [{ source: "scrolls", scrollSeparation: 40 }, { source: "contours", nest: 3, contourLevels: 9, contourStep: 0.06 }]) {
    const input = createInstrument("quilled-paths");
    Object.assign(input.params, params);
    const recipe = quillComposition(validateInstrument(input));
    const strips = quillProducts(recipe).strips, r = 0.97 * (recipe.strips.thickness + recipe.strips.clearance);
    const segs = strips.strips.flatMap((s, i) => segmentsOf(s.points, s.closed).map((seg) => ({ seg, key: `${s.source}|${s.ring}`, i })));
    let pairs = 0;
    for (let a = 0; a < segs.length; a++) for (let b = a + 1; b < segs.length; b++) {
      if (segs[a].key === segs[b].key) continue;
      const [[p1, q1], [p2, q2]] = [segs[a].seg, segs[b].seg];
      if (Math.min(p1[0], q1[0]) - r > Math.max(p2[0], q2[0]) || Math.max(p1[0], q1[0]) + r < Math.min(p2[0], q2[0]) ||
        Math.min(p1[1], q1[1]) - r > Math.max(p2[1], q2[1]) || Math.max(p1[1], q1[1]) + r < Math.min(p2[1], q2[1])) continue;
      pairs++;
      assert.ok(segmentDistance(p1, q1, p2, q2) >= r - 1e-9, `${segs[a].key} and ${segs[b].key} are ${segmentDistance(p1, q1, p2, q2)} apart`);
    }
    assert.ok(pairs > 0 && strips.strips.length > 5);
  }
});

test("strip work is bounded and throws naming what to change", () => {
  const huge = path("huge", [[0, 0], [1e6, 0]]);
  assert.throws(() => quillStrips([huge], options()), new RegExp(`the limit is ${MAX_QUILL_VERTICES}.*Path resolution`));
  const many = Array.from({ length: 4001 }, (_, i) => line(`l${i}`, [i * 8, 0], [i * 8, 6]));
  assert.throws(() => quillStrips(many, options({ resolution: 8 })), /more than 4000 strips/);
  const paths = Array.from({ length: 40 }, (_, i) => path(`p${i}`, Array.from({ length: 4000 }, (_, j) => [j * 2, i * 50] as Point)));
  assert.throws(() => quillStrips(paths, options({ resolution: 2 })), /limit is 90000/);
});

// --- geometry ----------------------------------------------------------------------------------
const geo = (scaffold: readonly Path[], o: Partial<QuillStripOptions> = {}, h = 20, extra = {}) =>
  quillGeometry(quillStrips(scaffold, options(o)), { height: h, heightVariation: 0, nestHeight: 0, ...extra });
const corner = (g: QuillGeometry, face: number, c: number) => [0, 1, 2].map((a) => g.corners[face * 12 + c * 3 + a]);

test("a straight strip stands as a thin box: cap, left and right walls per segment and two end faces", () => {
  const g = geo([line("s", [0, 0], [40, 0])]);
  assert.equal(g.faceCount, 10 * 3 + 2);
  // Segment 0: cap at z = 20 spanning y in [-1.5, 1.5]; left of +x on a y-down canvas is +y.
  assert.deepEqual([0, 1, 2, 3].map((c) => corner(g, 0, c)), [[0, 1.5, 20], [4, 1.5, 20], [4, -1.5, 20], [0, -1.5, 20]]);
  assert.deepEqual([0, 0, 1], [g.normals[0], g.normals[1], g.normals[2]]);
  assert.deepEqual([0, 1, 2, 3].map((c) => corner(g, 1, c)), [[0, 1.5, 20], [4, 1.5, 20], [4, 1.5, 0], [0, 1.5, 0]]);
  assert.deepEqual([g.normals[3], g.normals[4], g.normals[5]].map((v) => v + 0), [0, 1, 0]);
  assert.deepEqual([0, 1, 2, 3].map((c) => corner(g, 2, c)), [[0, -1.5, 20], [4, -1.5, 20], [4, -1.5, 0], [0, -1.5, 0]]);
  assert.deepEqual([g.normals[6], g.normals[7], g.normals[8]].map((v) => v + 0), [0, -1, 0]);
  assert.deepEqual([...g.normals.slice(30 * 3, 30 * 3 + 3)].map((v) => v + 0), [-1, 0, 0]);
  assert.deepEqual([...g.normals.slice(31 * 3, 31 * 3 + 3)].map((v) => v + 0), [1, 0, 0]);
  assert.deepEqual(g.outlines[0][0].map((p) => [...p]), [[0, 1.5], [4, 1.5], [8, 1.5], [12, 1.5], [16, 1.5], [20, 1.5], [24, 1.5], [28, 1.5], [32, 1.5], [36, 1.5], [40, 1.5],
    [40, -1.5], [36, -1.5], [32, -1.5], [28, -1.5], [24, -1.5], [20, -1.5], [16, -1.5], [12, -1.5], [8, -1.5], [4, -1.5], [0, -1.5]]);
  assert.ok(Object.isFrozen(g) && Object.isFrozen(g.corners) && Object.isFrozen(g.outlines[0]));
});

test("wall height is height x (1 - variation x u) x (1 + step)^|ring|, per strip, and changes only heights", () => {
  const scaffold = [circle("a", 100), circle("b", 30, 60, 300, 0)];
  const strips = quillStrips(scaffold, options({ nest: 2, spacing: 9 }));
  const g = quillGeometry(strips, { height: 40, heightVariation: 0.5, nestHeight: -0.2 });
  strips.strips.forEach((s, i) => near(g.heights[i], Math.max(0.5, 40 * (1 - 0.5 * s.heightUnit) * 0.8 ** Math.abs(s.ring)), 1e-12));
  assert.ok(strips.strips.some((s) => s.ring === 2));
  const a = strips.strips.find((s) => s.id === "a#0")!, b = strips.strips.find((s) => s.id === "b#0")!;
  assert.ok(a.heightUnit !== b.heightUnit && a.heightUnit >= 0 && a.heightUnit < 1);
  const taller = quillGeometry(strips, { height: 60, heightVariation: 0.5, nestHeight: -0.2 });
  assert.strictEqual(taller.strips, g.strips, "geometry edits reuse the strips");
  // Plan coordinates are identical; only z changes.
  for (let f = 0; f < g.faceCount; f++) for (let c = 0; c < 4; c++) { near(g.corners[f * 12 + c * 3], taller.corners[f * 12 + c * 3]); near(g.corners[f * 12 + c * 3 + 1], taller.corners[f * 12 + c * 3 + 1]); }
  near(stripHeight({ ring: 3, heightUnit: 0 }, { height: 0.6, heightVariation: 0, nestHeight: -0.9 }), 0.5, 1e-12, "walls never fall below the minimum");
  assert.throws(() => quillGeometry(strips, { height: 10, heightVariation: 0, nestHeight: -1 }), /Nest height step/);
});

test("tight bends pinch the paper instead of inverting a wall", () => {
  // A zigzag with 170 degree turns every 6 units, drawn on 6 unit thick paper.
  const zig = path("zig", Array.from({ length: 12 }, (_, i) => [i * 1.05, i % 2 ? 5.9 : 0] as Point));
  const g = geo([zig], { thickness: 6, resolution: 8 }, 10);
  assert.ok(g.pinchedVertices > 0);
  const strip = g.strips.strips[0];
  const capSigns = new Set<number>();
  for (let f = 0; f < g.faceCount; f++) {
    const c = [0, 1, 2, 3].map((k) => corner(g, f, k));
    if (g.kind[f] === 0) {
      const area = shoelace(c.map(([x, y]) => [x, y] as Point));
      assert.ok(Number.isFinite(area) && Math.abs(area) > 1e-9, `cap ${f} area ${area}`);
      capSigns.add(Math.sign(area));
    }
    if (g.kind[f] === 1 || g.kind[f] === 2) {
      const n = [g.normals[f * 3], g.normals[f * 3 + 1], g.normals[f * 3 + 2]];
      near(Math.hypot(...n), 1, 1e-9); near(n[2], 0, 1e-12);
      const j = g.segment[f], a = strip.points[j], b = strip.points[j + 1];
      const mid = [(c[0][0] + c[1][0]) / 2 - (a[0] + b[0]) / 2, (c[0][1] + c[1][1]) / 2 - (a[1] + b[1]) / 2];
      assert.ok(n[0] * mid[0] + n[1] * mid[1] > -1e-9, `wall ${f} faces into the strip`);
    }
  }
  assert.equal(capSigns.size, 1, "every cap keeps one orientation");
});

test("a closed strip has no end faces and two outline rings; an open strip has one", () => {
  const closed = geo([circle("c", 50, 40)], { resolution: 100 });
  assert.equal(closed.faceCount, 3 * 40);
  assert.equal(closed.outlines[0].length, 2);
  const outer = shoelace(closed.outlines[0][0]), inner = shoelace(closed.outlines[0][1]);
  assert.ok(Math.abs(Math.abs(outer) - Math.abs(inner)) > 100, "an annulus: two rings of different area");
  assert.equal(geo([line("s", [0, 0], [40, 0])]).outlines[0].length, 1);
  const zigzagLoop = geo([path("sq", [[0, 0], [40, 0], [40, 40], [0, 40]], true)], { thickness: 4 }, 10);
  // Square corners keep the full thickness: no pinch, and the outer ring is exactly 2 larger on each side.
  assert.equal(zigzagLoop.pinchedVertices, 0);
  const ring = zigzagLoop.outlines[0].map((r) => Math.abs(shoelace(r))).sort((a, b) => a - b);
  near(ring[0], 36 * 36, 1e-6); near(ring[1], 44 * 44, 1e-6);
});

test("face count is bounded and names Path resolution", () => {
  const scaffold = Array.from({ length: 20 }, (_, i) => path(`row${i}`, [[0, i * 30], [1e4, i * 30]]));
  const strips = quillStrips(scaffold, options({ resolution: 2.5, thickness: 2, clearance: 0.5 }));
  assert.throws(() => quillGeometry(strips, { height: 10, heightVariation: 0, nestHeight: 0 }), new RegExp(`the limit is ${MAX_QUILL_FACES}.*Path resolution`));
});

// --- camera, projection and painter's order -----------------------------------------------------
const view = (over: Partial<{ yaw: number; pitch: number; zoom: number }> = {}) => ({ yaw: 0, pitch: 0, zoom: 1, pivot: [100, 100] as Point, anchor: [100, 100] as Point, ...over });

test("the camera maps plan points, heights and yaw by its documented orthographic formula", () => {
  const cam = view({ pitch: 60, zoom: 2 });
  const [x, y] = projectPoint(cam, 110, 90, 30);
  near(x, 100 + 2 * 10, 1e-9); near(y, 100 + 2 * (-10 * Math.cos(Math.PI / 3) - 30 * Math.sin(Math.PI / 3)), 1e-9);
  const turned = projectPoint(view({ yaw: 90 }), 110, 100, 0);
  near(turned[0], 100, 1e-9); near(turned[1], 110, 1e-9);
  assert.deepEqual(projectPoint(view(), 37, -12, 55).map((v) => +v.toFixed(9)), [37, -12]);
  assert.throws(() => quillProjection(geo([line("s", [0, 0], [40, 0])]), view({ pitch: 86 })), /pitch/);
  assert.throws(() => quillProjection(geo([line("s", [0, 0], [40, 0])]), view({ zoom: 0 })), /zoom/);
});

test("looking straight down shows only the caps, at their plan positions: the flat view", () => {
  const g = geo([circle("c", 60, 60, 100, 100), line("s", [0, 0], [80, 10])], { nest: 0 }, 25);
  const p = quillProjection(g, view());
  assert.ok(p.order.length > 0 && p.order.every((f) => g.kind[f] === 0), "walls are edge-on and culled");
  p.order.forEach((f, position) => {
    for (let c = 0; c < 4; c++) { near(p.screen[position * 8 + c * 2], g.corners[f * 12 + c * 3], 1e-9); near(p.screen[position * 8 + c * 2 + 1], g.corners[f * 12 + c * 3 + 1], 1e-9); }
  });
  // The footprint outlines of an open straight strip are its plan rectangle: length x thickness.
  const stripIndex = g.strips.strips.findIndex((s) => s.source === "s");
  const ring = p.footprint.strips[stripIndex].rings[0];
  near(Math.abs(shoelace(ring)), Math.hypot(80, 10) * 3, 1e-9);
});

test("a face is painted only when its normal turns toward the camera", () => {
  const g = geo([circle("c", 60, 72, 100, 100)], { thickness: 4 }, 30);
  for (const [yaw, pitch] of [[0, 45], [90, 30], [200, 70], [-45, 10]]) {
    const p = quillProjection(g, view({ yaw, pitch }));
    const psi = yaw * Math.PI / 180, phi = pitch * Math.PI / 180;
    const expected = new Set<number>();
    for (let f = 0; f < g.faceCount; f++) {
      const nx = g.normals[f * 3], ny = g.normals[f * 3 + 1], nz = g.normals[f * 3 + 2];
      if ((nx * Math.sin(psi) + ny * Math.cos(psi)) * Math.sin(phi) + nz * Math.cos(phi) > 1e-9) expected.add(f);
    }
    assert.deepEqual(new Set(p.order), expected);
    assert.equal(p.order.length, expected.size);
  }
});

/** A tiny z-buffer: which strip owns each pixel by TRUE camera depth, against painting in the projection's order. */
function coverage(g: QuillGeometry, order: readonly number[], camera: QuillCamera, size: number, by: "zbuffer" | "painter") {
  const psi = camera.yaw * Math.PI / 180, phi = camera.pitch * Math.PI / 180;
  const cy = Math.cos(psi), sy = Math.sin(psi);
  const project = (x: number, y: number, z: number) => {
    const dx = x - camera.pivot[0], dy = y - camera.pivot[1], v = dx * sy + dy * cy;
    return [camera.anchor[0] + camera.zoom * (dx * cy - dy * sy), camera.anchor[1] + camera.zoom * (v * Math.cos(phi) - z * Math.sin(phi)), v * Math.sin(phi) + z * Math.cos(phi)];
  };
  const ids = new Int32Array(size * size).fill(-1), depth = new Float64Array(size * size).fill(-Infinity);
  const scale = size / 640;
  for (const f of order) {
    const q = [0, 1, 2, 3].map((c) => project(g.corners[f * 12 + c * 3], g.corners[f * 12 + c * 3 + 1], g.corners[f * 12 + c * 3 + 2]));
    for (const tri of [[0, 1, 2], [0, 2, 3]]) {
      const [a, b, c] = tri.map((i) => q[i]);
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) * scale)), maxX = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0]) * scale));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) * scale)), maxY = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1]) * scale));
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-12) continue;
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const x = (px + 0.5) / scale, y = (py + 0.5) / scale;
        const w0 = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area, w1 = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (by === "painter" || d > depth[py * size + px]) { ids[py * size + px] = g.strip[f]; depth[py * size + px] = d; }
      }
    }
  }
  return ids;
}
function mismatch(g: QuillGeometry, camera: QuillCamera, order: readonly number[], size = 320) {
  const exact = coverage(g, order, camera, size, "zbuffer"), painted = coverage(g, order, camera, size, "painter");
  let covered = 0, wrong = 0;
  for (let i = 0; i < exact.length; i++) if (exact[i] >= 0) { covered++; if (exact[i] !== painted[i]) wrong++; }
  return { covered, wrong, ratio: wrong / covered };
}

test("painting in ascending plan depth reproduces the true depth buffer on nested, tall and varied strips", () => {
  const scenes: Array<[string, Path[], Partial<QuillStripOptions>, { heightVariation: number; nestHeight: number }]> = [
    ["nested bowl", [circle("a", 110, 120, 320, 320), circle("b", 60, 90, 320, 320)], { nest: 3, spacing: 9 }, { heightVariation: 0, nestHeight: -0.6 }],
    ["scrolls with rolled ends", [...scrollPaths({ seed: 5, sites: { seed: 5, width: 400, height: 380, centerX: 320, centerY: 320, separation: 90, maxPoints: 40, support: "rectangle", opening: 0, rotation: 0 }, length: 110, lengthVariation: 0.3, bend: 0.3 })],
      { terminals: "both", curl: "opposite", curlRadius: 20 }, { heightVariation: 0.7, nestHeight: 0 }],
    ["wavy contour rings", quillScaffold({ kind: "contours", contour: { seed: 4, source: "waves", width: 400, height: 380, centerX: 320, centerY: 320, resolution: 40, frequency: 2, aspect: 1, hillCount: 4, hillRadius: 0.2, levelBase: -0.3, levelStep: 0.2, levels: 4, rotation: 0 } }) as Path[],
      { nest: 1, terminals: "both" }, { heightVariation: 0.5, nestHeight: -0.2 }],
  ];
  for (const [name, scaffold, so, go] of scenes) {
    const strips = quillStrips(scaffold, options(so));
    const g = quillGeometry(strips, { height: 45, ...go });
    for (const [yaw, pitch] of [[0, 55], [37, 40], [200, 70]]) {
      const camera = { ...view({ yaw, pitch }), pivot: [320, 320] as Point, anchor: [320, 320] as Point };
      const p = quillProjection(g, camera);
      const result = mismatch(g, camera, p.order);
      assert.ok(result.covered > 2000);
      assert.ok(result.ratio < 0.004, `${name} yaw ${yaw} pitch ${pitch}: ${result.wrong}/${result.covered} pixels differ from the depth buffer`);
    }
  }
  const tall = quillGeometry(quillStrips(scenes[0][1], options(scenes[0][2])), { height: 45, heightVariation: 0, nestHeight: -0.6 });
  const camera = { ...view({ yaw: 0, pitch: 55 }), pivot: [320, 320] as Point, anchor: [320, 320] as Point };
  const real = quillProjection(tall, camera);
  const phi = 55 * Math.PI / 180;
  const centroid3d = (f: number) => { let d = 0; for (let c = 0; c < 4; c++) d += (tall.corners[f * 12 + c * 3 + 1] - 320) * Math.sin(phi) + tall.corners[f * 12 + c * 3 + 2] * Math.cos(phi); return d / 4; };
  const wrongOrder = [...real.order].sort((a, b) => centroid3d(a) - centroid3d(b));
  const honest = mismatch(tall, camera, real.order), naive = mismatch(tall, camera, wrongOrder);
  assert.ok(naive.ratio > 0.01 && naive.ratio > honest.ratio * 5, `witness: 3D-centroid order differs on ${(naive.ratio * 100).toFixed(2)}% vs ${(honest.ratio * 100).toFixed(2)}%`);
});

test("the projected footprint bounds and hulls everything painted, and is cached with its projection", () => {
  const g = geo([circle("c", 70, 60, 200, 200), line("s", [40, 40], [160, 60])], { terminals: "end", nest: 1 }, 30);
  const camera = { ...view({ yaw: 25, pitch: 50, zoom: 1.3 }), pivot: [200, 200] as Point, anchor: [250, 240] as Point };
  const p = quillProjection(g, camera);
  assert.strictEqual(quillProjection(g, { ...camera }), p);
  const points: Point[] = [];
  for (const f of p.order) for (let c = 0; c < 4; c++) points.push(projectPoint(camera, g.corners[f * 12 + c * 3], g.corners[f * 12 + c * 3 + 1], g.corners[f * 12 + c * 3 + 2]));
  const [l, t, r, b] = p.footprint.bounds;
  near(l, Math.min(...points.map((q) => q[0])), 1e-9); near(r, Math.max(...points.map((q) => q[0])), 1e-9);
  near(t, Math.min(...points.map((q) => q[1])), 1e-9); near(b, Math.max(...points.map((q) => q[1])), 1e-9);
  const hull = p.footprint.hull;
  assert.ok(hull.length >= 3 && hull.length < points.length);
  const hullSign = Math.sign(shoelace(hull));
  hull.forEach((a, i) => {
    const b2 = hull[(i + 1) % hull.length], c = hull[(i + 2) % hull.length];
    assert.equal(Math.sign(orientArea(a, b2, c)), hullSign, "convex");
  });
  for (const q of points) hull.forEach((a, i) => { const b2 = hull[(i + 1) % hull.length]; assert.ok(orientArea(a, b2, q) * hullSign >= -1e-6, "every painted point is inside the hull"); });
  // Each strip's ground outline is the strip's own plan outline seen through the same camera.
  g.strips.strips.forEach((s, i) => {
    assert.equal(p.footprint.strips[i].id, s.id);
    p.footprint.strips[i].rings.forEach((ring, k) => ring.forEach(([x, y], v) => {
      const [gx, gy] = g.outlines[i][k][v], [ex, ey] = projectPoint(camera, gx, gy, 0);
      near(x, ex, 1e-9); near(y, ey, 1e-9);
    }));
  });
});

// --- the instrument -----------------------------------------------------------------------------
const make = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("quilled-paths");
  input.seed = seed;
  Object.assign(input.params, params);
  return validateInstrument(input);
};
const paint = (input: InstrumentInput) => { const r = new Recorder(); drawInstrument(r as never, input); return r; };

test("producers are reused across edits that do not touch them", () => {
  const base = quillProducts(quillComposition(make()));
  const palette = quillProducts(quillComposition({ ...make(), palette: [0x111111, 0x222222] }));
  const tone = quillProducts(quillComposition(make({ tone: "height", light: 0.2, edgeWeight: 2, lightAngle: 10 })));
  for (const same of [palette, tone]) { assert.strictEqual(same.scaffold, base.scaffold); assert.strictEqual(same.strips, base.strips); assert.strictEqual(same.geometry, base.geometry); assert.strictEqual(same.projection, base.projection); }
  const camera = quillProducts(quillComposition(make({ yaw: 80, pitch: 30, zoom: 1.2 })));
  assert.strictEqual(camera.strips, base.strips); assert.strictEqual(camera.geometry, base.geometry); assert.notStrictEqual(camera.projection, base.projection);
  const taller = quillProducts(quillComposition(make({ wallHeight: 55 })));
  assert.strictEqual(taller.strips, base.strips); assert.notStrictEqual(taller.geometry, base.geometry);
  const nested = quillProducts(quillComposition(make({ nest: 3 })));
  assert.strictEqual(nested.scaffold, base.scaffold); assert.notStrictEqual(nested.strips, base.strips);
  const word = quillProducts(quillComposition(make({ source: "letters", nest: 0 })));
  const swapped = quillProducts(quillComposition(make({ source: "letters", nest: 0, contourLevels: 3 })));
  assert.strictEqual(swapped.scaffold, word.scaffold, "hidden contour controls do not enter the scaffold");
  // Ids and points of the strips never depend on how they are painted.
  assert.deepEqual(base.strips.strips.map((s) => s.id), tone.strips.strips.map((s) => s.id));
});

test("the face painter is an ordinary callback over the same faces, back to front", () => {
  const recipe = quillComposition(make({ source: "scrolls", scrollSeparation: 110 }));
  const products = quillProducts(recipe);
  const seen: QuillFace[] = [];
  drawQuilled(new Recorder(), recipe, { face: (_surface, face) => { seen.push(face); } });
  assert.equal(seen.length, products.projection.order.length);
  assert.deepEqual(seen.map((f) => f.index), [...products.projection.order]);
  for (let i = 1; i < seen.length; i++) assert.ok(products.projection.depth[i] >= products.projection.depth[i - 1], "ascending plan depth");
  assert.ok(seen.every((f) => f.screen.length === 8 && f.heightFraction >= 0 && f.heightFraction <= 1));
  // The stock painter draws one polygon per face; cap edges add lines but no polygons.
  const stock = new Recorder();
  drawQuilled(stock, recipe);
  assert.equal(stock.polygons.length, seen.length);
  const recolored = new Recorder();
  drawQuilled(recolored, recipe, { face: quillPaper({ ...recipe.material, tone: "single" }, [0xff0000]) });
  assert.ok(recolored.fills.every(([r, g, b]) => r >= g && r >= b && g === b), "a single red paper shaded only by its light");
  // A budget too small for the faces fails with the work message rather than drawing part of them.
  assert.throws(() => drawQuilled(new Recorder(), recipe, {}, { workUsed: 0, depth: 0, enter() { throw new Error("Composition work budget exceeded"); }, leave() {}, check() {} }), /budget exceeded/);
});

test("the flat view is the plan view: caps at plan positions whatever the tilt values", () => {
  const flat = quillComposition(make({ view: "flat", yaw: 77, pitch: 63, source: "spirals" }));
  assert.equal(flat.view.pitch, 0); assert.equal(flat.view.yaw, 0);
  const p = quillProducts(flat).projection;
  assert.ok(p.order.length > 100 && p.order.every((f) => p.geometry.kind[f] === 0));
  p.order.forEach((f, position) => { near(p.screen[position * 8], p.geometry.corners[f * 12], 1e-9); near(p.screen[position * 8 + 1], p.geometry.corners[f * 12 + 1], 1e-9); });
  assert.equal(paint(make({ view: "flat", yaw: 77, pitch: 63, lightAngle: 10 })).polygons.length, paint(make({ view: "flat" })).polygons.length);
});

test("controls hidden by a selection cannot change the drawing or fail its checks", () => {
  const fingerprint = (input: InstrumentInput) => { const r = paint(input); return JSON.stringify([r.polygons, r.fills]); };
  const cases: Array<[Record<string, number | string | boolean>, Record<string, number | string | boolean>]> = [
    [{ source: "spirals" }, { contourShape: "saddle", contourLevels: 2, word: "CURL", scrollLength: 150, scrollBend: 0.6, nest: 8, spacing: 2, nestSide: "both", nestHeight: 0.5 }],
    [{ source: "letters", nest: 1 }, { terminals: "both", curl: "random", curlRadius: 200, curlGap: 0, arms: 7, spiralFamily: "fermat", scrollSeparation: 30 }],
    [{ source: "scrolls", terminals: "none" }, { curl: "right", curlRadius: 3, curlGap: 0, clearance: 0 }],
    [{ view: "flat" }, { yaw: -120, pitch: 80, lightAngle: 170 }],
    [{ source: "contours", contourShape: "noise" }, { contourHills: 3, contourHillRadius: 0.2 }],
  ];
  for (const [base, hidden] of cases) {
    if ("curlGap" in hidden && base.terminals === "none") Object.assign(base, { clearance: 1 });
    const before = fingerprint(make(base)), after = fingerprint(make({ ...base, ...hidden }));
    assert.equal(after, before, `changing ${Object.keys(hidden).join(", ")} moved the drawing`);
  }
  // Rolls on letters and nesting on spirals are neutral, so their values are not even validated together.
  make({ source: "letters", terminals: "both", curlRadius: 6, curlGap: 0, clearance: 5 });
  make({ source: "spirals", nest: 5, spacing: 2, thickness: 8 });
});

test("seed edits change structure where the construction uses chance and nothing where it does not", () => {
  const asks = (params: Record<string, number | string | boolean>) => usesSeed(make(params));
  assert.equal(asks({ source: "scrolls" }), true);
  assert.equal(asks({ source: "contours", contourShape: "noise" }), true);
  assert.equal(asks({ source: "contours", contourShape: "waves", heightVariation: 0, terminals: "none" }), false);
  assert.equal(asks({ source: "letters", heightVariation: 0 }), false);
  assert.equal(asks({ source: "letters", heightVariation: 0.4 }), true);
  assert.equal(asks({ source: "spirals", armVariation: 0, heightVariation: 0, terminals: "both", curl: "random" }), true);
  assert.equal(asks({ source: "spirals", armVariation: 0, heightVariation: 0, terminals: "both", curl: "left" }), false);
  const fp = (params: Record<string, number | string | boolean>, seed: number) => JSON.stringify(paint(make(params, seed)).polygons);
  for (const params of [{ source: "letters", heightVariation: 0 }, { source: "contours", contourShape: "waves", heightVariation: 0, terminals: "none" }])
    assert.equal(fp(params, 1), fp(params, 2), `${params.source}: the seed must not matter`);
  const scaffoldIds = (seed: number) => quillProducts(quillComposition(make({}, seed))).scaffold.map((p) => p.id).join();
  assert.notEqual(scaffoldIds(1), scaffoldIds(2), "a seed rearranges the contour family itself");
  const sides = (seed: number) => quillProducts(quillComposition(make({ source: "spirals", terminals: "both", curl: "random" }, seed))).strips.strips
    .map((s) => shoelace(s.points as Point[]) > 0).join();
  assert.notEqual(sides(1), sides(2), "random curl differs between seeds");
});

test("the instrument is registered with validated controls and reports its limits by name", () => {
  const input = createInstrument("quilled-paths");
  validateInstrument(input);
  assert.throws(() => validateParameters("quilled-paths", { ...input.params, source: "spirals", terminals: "both", curlRadius: 5 }), /Curl radius/);
  assert.throws(() => validateParameters("quilled-paths", { ...input.params, nest: 2, spacing: 3, thickness: 3 }), /Strip spacing/);
  assert.throws(() => validateParameters("quilled-paths", { ...input.params, pitch: 90 }), /pitch|Camera pitch/i);
  assert.throws(() => paint(make({ source: "spirals", arms: 32, turns: 60, resolution: 0.5, width: 640, height: 640 })), /limit is|points/);
});
