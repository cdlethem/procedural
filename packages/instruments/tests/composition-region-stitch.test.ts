import assert from "node:assert/strict";
import test from "node:test";
import {
  bundledStitchRegions, boundStitches, canPrepareInstrument, clipPath, componentSeed, createInstrument, createRaster, domainIntersection, drawStitchProducts,
  drawStitches, inspectorItems, locateInDomain, offsetDomain, planarDomain, polylineLength, prepareInstrument, regionBoundaries, regionStitchComposition,
  regionStitchProducts, routeRuns, runningStitches, samplePolyline, spanStitches, stitchField, stitchRegionsOf, stitchRuns, stitchThreads, stitchUsesSeed,
  usesSeed, validateInstrument, visibleParameters, STITCH_INSIDE_TOLERANCE, STITCH_LIMITS,
  drawInstrument, type CompositionSurface, type DrawingContext, type StitchOptions, type StitchProducts, type StitchThread,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);

const rect = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as [number, number][];
const regionsOf = (...shapes: { outer: [number, number][]; holes?: [number, number][][] }[]) =>
  stitchRegionsOf(planarDomain(shapes.map((shape, k) => ({ id: `s${k}`, ...shape })), { id: "test" }), { prefix: "r" });

type Over = { [K in keyof Omit<StitchOptions, "regions" | "seed" | "origin" | "seam" | "field">]?: Partial<StitchOptions[K]> } & { seed?: number; seam?: number; field?: StitchOptions["field"] };
/** Constant field at 0 degrees, running fill, spacing 4, stitch length 10, no stagger, nothing else. */
function make(regions: StitchOptions["regions"], over: Over = {}): StitchOptions {
  const base: StitchOptions = {
    seed: 7, regions, field: { kind: "constant", angle: 0 }, origin: [0, 0],
    fill: { rule: "running", spacing: 4, length: 10, stagger: 0, scatter: 0, angleSpread: 0, inset: 0 },
    underlay: { kind: "none", spacing: 8, inset: 0 }, crossing: { kind: "none", angle: 90, spacing: 8 },
    outline: { kind: "none", width: 3, lap: 0 }, seam: 45, routing: { order: "label", travel: false },
  };
  return { ...base, seed: over.seed ?? base.seed, seam: over.seam ?? base.seam, field: over.field ?? base.field,
    fill: { ...base.fill, ...over.fill }, underlay: { ...base.underlay, ...over.underlay }, crossing: { ...base.crossing, ...over.crossing },
    outline: { ...base.outline, ...over.outline }, routing: { ...base.routing, ...over.routing } };
}

const stitchesOf = (thread: StitchThread) => thread.points.slice(1).map((b, i) => ({ a: thread.points[i], b, length: Math.hypot(b[0] - thread.points[i][0], b[1] - thread.points[i][1]), index: i }));
const isConnector = (thread: StitchThread, index: number) => thread.rowStarts.some((start, k) => k > 0 && start - 1 === index);
const angleOf = (a: readonly number[], b: readonly number[]) => { const t = Math.atan2(b[1] - a[1], b[0] - a[0]); return ((t % Math.PI) + Math.PI) % Math.PI; };
const byRole = (products: StitchProducts, role: string) => products.threads.filter((thread) => thread.role === role);
const outsideLength = (a: readonly number[], b: readonly number[], region: StitchOptions["regions"][number]) =>
  clipPath([a as [number, number], b as [number, number]], region.domain, { keep: "outside" }).reduce((sum, piece) => sum + polylineLength(piece.points), 0);

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round"; ops: unknown[][] = [];
  #n(name: string, args: unknown[]) { this.ops.push([name, ...args]); }
  push() { this.#n("push", []); } pop() { this.#n("pop", []); }
  translate(...a: number[]) { this.#n("translate", a); } rotate(...a: number[]) { this.#n("rotate", a); } scale(...a: number[]) { this.#n("scale", a); }
  noFill() { this.#n("noFill", []); } noStroke() { this.#n("noStroke", []); }
  fill(...a: number[]) { this.#n("fill", a); } stroke(...a: number[]) { this.#n("stroke", a); }
  strokeWeight(...a: number[]) { this.#n("strokeWeight", a); } strokeCap(...a: unknown[]) { this.#n("strokeCap", a); }
  circle(...a: number[]) { this.#n("circle", a); } line(...a: number[]) { this.#n("line", a); } rect(...a: number[]) { this.#n("rect", a); }
  beginShape() { this.#n("beginShape", []); } vertex(...a: number[]) { this.#n("vertex", a); } endShape(...a: unknown[]) { this.#n("endShape", a); }
  count(name: string) { return this.ops.filter((op) => op[0] === name).length; }
}

test("stitch cutting: running, span and bound rules give the analytic stitch lengths and keep the ends", () => {
  const straight = [[0, 0], [25, 0]] as const;
  const lengths = (points: readonly (readonly [number, number])[]) => points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  assert.deepEqual(lengths(runningStitches(straight, 10, 0)), [10, 10, 5]);
  const shifted = lengths(runningStitches(straight, 10, 0.3));
  [3, 10, 10, 2].forEach((expected, i) => near(shifted[i], expected, 1e-12));
  assert.deepEqual(runningStitches(straight, 10, 0.3)[0], [0, 0]);
  assert.deepEqual(runningStitches(straight, 10, 0.3).at(-1), [25, 0]);
  assert.deepEqual(runningStitches([[0, 0], [10, 0]], 10, 0).length, 2, "a polyline exactly one stitch long is one stitch");
  // A quarter circle of radius 20, arc length 10 pi: chords are shorter than arcs, so the bound holds, and the count is ceil(arc / L).
  const arc = Array.from({ length: 401 }, (_, i) => [20 * Math.cos((Math.PI / 2) * i / 400), 20 * Math.sin((Math.PI / 2) * i / 400)] as [number, number]);
  const cut = runningStitches(arc, 6, 0);
  assert.equal(cut.length - 1, Math.ceil(polylineLength(arc) / 6));
  assert.ok(Math.max(...lengths(cut)) <= 6 + 1e-9);
  for (const p of cut) near(Math.hypot(p[0], p[1]), 20, 1e-3, "penetrations stay on the arc");
  // Satin: equal parts.
  assert.deepEqual(lengths(spanStitches([[0, 0], [100, 0]], 30)), [25, 25, 25, 25]);
  assert.deepEqual(lengths(spanStitches([[0, 0], [100, 0]], 100)), [100]);
  // Bound: every vertex stays; longer segments divide equally.
  const bent = boundStitches([[0, 0], [25, 0], [25, 3]], 10);
  assert.equal(bent.length, 5);
  [25 / 3, 25 / 3, 25 / 3, 3].forEach((expected, i) => near(lengths(bent)[i], expected, 1e-12));
  assert.deepEqual(bent.filter((p) => p[0] === 25 && p[1] === 0).length, 1, "the corner is a penetration");
  assert.throws(() => runningStitches(straight, 0, 0), /Stitch length/);
  assert.throws(() => runningStitches(straight, 10, 1), /phase/);
  const sampled = samplePolyline([[0, 0], [10, 0], [10, 10]], [0, 5, 10, 15, 20]);
  assert.deepEqual(sampled, [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]);
});

test("routing visits every run once, enters at the nearest end and alternates direction across parallel rows", () => {
  const rows = Array.from({ length: 6 }, (_, k) => ({ points: [[0, 4 * k], [100, 4 * k]] as [number, number][] }));
  const joined = routeRuns(rows, [100, 20], { join: (end, entry) => Math.hypot(entry[0] - end[0], entry[1] - end[1]) <= 5, cell: 8 });
  assert.equal(joined.length, 1);
  assert.deepEqual(joined[0].rowStarts, [0, 2, 4, 6, 8, 10], "each run begins after the one-stitch run and the one-stitch turn before it");
  // Start at the right end of the last row: right-to-left, then left-to-right, alternating.
  const xs = joined[0].points.map((p) => p[0]);
  assert.deepEqual(xs, [100, 0, 0, 100, 100, 0, 0, 100, 100, 0, 0, 100]);
  assert.deepEqual(joined[0].points.map((p) => p[1]), [20, 20, 16, 16, 12, 12, 8, 8, 4, 4, 0, 0]);
  // Without joining every run is its own thread; nothing is lost or repeated.
  const apart = routeRuns(rows, [0, 0], { join: null, cell: 8 });
  assert.equal(apart.length, 6);
  assert.equal(new Set(apart.map((chain) => chain.points[0][1])).size, 6);
  assert.deepEqual(apart.map((chain) => chain.firstRow), [0, 1, 2, 3, 4, 5]);
  // A refusing join splits a chain exactly where it refuses.
  const cut = routeRuns(rows, [100, 20], { join: (end, entry) => entry[1] > 10, cell: 8 });
  assert.deepEqual(cut.map((chain) => chain.rowStarts.length), [3, 1, 1, 1], "rows at y = 16 and 12 join, the rest refuse");
  // Random runs: the multiset of points is preserved.
  const seededRuns = Array.from({ length: 300 }, (_, i) => {
    const x = (componentSeed(1, `x${i}`, "t") % 1000) / 10, y = (componentSeed(1, `y${i}`, "t") % 1000) / 10;
    return { points: [[x, y], [x + 3, y + 1]] as [number, number][] };
  });
  const routed = routeRuns(seededRuns, [50, 50], { join: () => true, cell: 7 });
  const key = (p: readonly number[]) => `${p[0]},${p[1]}`;
  assert.deepEqual(routed.flatMap((chain) => chain.points).map(key).sort(), seededRuns.flatMap((run) => run.points).map(key).sort());
});

test("direction fields: constant, radial, swirl and image follow their definitions", () => {
  const deg = Math.PI / 180;
  const mod = (a: number) => ((a % Math.PI) + Math.PI) % Math.PI;
  near(stitchField({ kind: "constant", angle: -30 }).angleAt(5, 9), mod(-30 * deg), 1e-15);
  const radial = stitchField({ kind: "radial", angle: 20, centerX: 10, centerY: 20 });
  for (const [x, y] of [[30, 20], [10, 60], [-5, 5], [40, 55]]) near(radial.angleAt(x, y), mod(Math.atan2(y - 20, x - 10) + 20 * deg), 1e-12);
  const swirl = stitchField({ kind: "swirl", angle: 0, twist: 90, centerX: 0, centerY: 0 });
  near(swirl.angleAt(100, 0), mod(90 * deg), 1e-12, "a quarter turn per 100 units");
  near(swirl.angleAt(0, 50), mod(Math.PI / 2 + 45 * deg), 1e-12);
  assert.ok(stitchField({ kind: "constant", angle: 3 }).constant && !radial.constant);
  // Vertical stripes in a 64 x 64 picture: the level lines are vertical, so the follow direction is pi/2.
  const stripes = createRaster({ width: 64, height: 64, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none",
    data: Uint8Array.from({ length: 64 * 64 }, (_, p) => (Math.floor((p % 64) / 4) % 2 === 0 ? 30 : 225)) });
  const image = (follow: number, angle: number) => stitchField({ kind: "image", angle, follow, smoothing: 0, image: { kind: "raster", raster: stripes },
    frame: { centerX: 32, centerY: 32, width: 64, height: 64, rotation: 0 } });
  near(image(1, 0).angleAt(32.5, 32.3), Math.PI / 2, 0.05, "coherent stripes are followed");
  near(image(0, 45).angleAt(32.5, 32.3), 45 * deg, 1e-12, "follow 0 is the constant angle exactly");
  const half = image(0.7, 45).angleAt(32.5, 32.3);
  assert.ok(half > 45 * deg + 0.05 && half < Math.PI / 2 - 0.05, `partial follow lies between the two: ${half}`);
  assert.throws(() => stitchField({ kind: "image", angle: 0, follow: 2, smoothing: 0, image: { kind: "raster", raster: stripes }, frame: { centerX: 0, centerY: 0, width: 1, height: 1, rotation: 0 } }), /Image follow/);
});

test("running fill on a rectangle: one alternating thread with the analytic stitch count and length", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) });
  const products = stitchThreads(make(regions));
  // Rows at y = 2, 6, ..., 38; each 100 long cut into 10 stitches of 10; 9 turning stitches of 4 join them.
  assert.equal(products.threads.length, 1);
  const [thread] = products.threads;
  assert.equal(thread.stitches, 100 + 9);
  near(thread.length, 1000 + 9 * 4, 1e-9);
  assert.deepEqual(thread.points[0], [100, 38], "routing starts at the seam (bottom right for 45 degrees) on the nearest row end");
  assert.equal(thread.rowStarts.length, 10);
  const stitches = stitchesOf(thread);
  const horizontal = stitches.filter((s) => Math.abs(s.b[1] - s.a[1]) < 1e-12);
  near(horizontal.reduce((sum, s) => sum + s.length, 0), 1000, 1e-9, "the rows cover exactly the rectangle");
  near(Math.max(...stitches.map((s) => s.length)), 10, 1e-9);
  // Alternating direction: successive rows run opposite ways.
  const dirs = thread.rowStarts.map((start) => Math.sign(thread.points[start + 1][0] - thread.points[start][0]));
  assert.deepEqual(dirs, [-1, 1, -1, 1, -1, 1, -1, 1, -1, 1]);
  // Stagger 0: every interior penetration sits at a multiple of 10 from its row's start; 0 or 100 for row ends.
  for (const [x] of thread.points) assert.ok(Math.abs(x / 10 - Math.round(x / 10)) < 1e-9, `aligned penetration at ${x}`);
  assert.equal(products.regions[0].fillArea, 4000);
});

test("stagger shifts each row by up to that fraction of a stitch, from the seed; zero uses no seed", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) });
  const aligned = stitchThreads(make(regions, { fill: { stagger: 0 } }));
  assert.strictEqual(stitchThreads(make(regions, { fill: { stagger: 0 }, seed: 99 })), aligned, "no seeded choice is read, so the same result is shared");
  const scattered = stitchThreads(make(regions, { fill: { stagger: 1 } }));
  const offGrid = scattered.threads.flatMap((t) => t.points).filter(([x]) => Math.abs(x / 10 - Math.round(x / 10)) > 1e-6).length;
  assert.ok(offGrid > 40, `most penetrations leave the 10-unit grid: ${offGrid}`);
  const other = stitchThreads(make(regions, { fill: { stagger: 1 }, seed: 8 }));
  assert.notDeepEqual(other.threads[0].points.slice(0, 20), scattered.threads[0].points.slice(0, 20));
  // With stagger s the first cut in a row lies at s * u * L from the row start, u = componentSeed(...)/2^32 in [0, 1).
  for (const t of scattered.threads) for (const start of t.rowStarts) {
    const a = t.points[start], b = t.points[start + 1];
    assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) <= 10 + 1e-9);
  }
  assert.equal(stitchUsesSeed(make(regions, { fill: { stagger: 0 } })), false);
  assert.equal(stitchUsesSeed(make(regions, { fill: { stagger: 0.2 } })), true);
});

test("holes stay open: no stitch enters a hole and rows through it are cut exactly", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40), holes: [rect(40, 10, 60, 30)] });
  const products = stitchThreads(make(regions));
  // Rows y = 2, ..., 38: 10 rows of 100, minus the five rows (12, 16, 20, 24, 28) that cross the 20-wide hole.
  const stitches = products.threads.flatMap(stitchesOf);
  near(stitches.filter((s) => Math.abs(s.b[1] - s.a[1]) < 1e-12).reduce((sum, s) => sum + s.length, 0), 1000 - 5 * 20, 1e-9);
  for (const s of stitches) assert.ok(outsideLength(s.a, s.b, regions[0]) <= STITCH_INSIDE_TOLERANCE, `stitch ${s.a} -> ${s.b} strays`);
  for (const s of stitches) assert.notEqual(locateInDomain(regions[0].domain, (s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2), "outside");
  // Joins never bridge the hole: no stitch crosses x in (40, 60) within y in (10, 30).
  for (const s of stitches) {
    const mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2;
    assert.ok(!(mx > 40.0001 && mx < 59.9999 && my > 10.0001 && my < 29.9999));
  }
  assert.ok(products.stats.trims > 0, "the hole ends threads (trims) instead of bridging");
});

test("region inset shrinks the stitched area, grows holes and makes narrow regions vanish", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) });
  const products = stitchThreads(make(regions, { fill: { inset: 5 } }));
  // Fill domain [5, 95] x [5, 35]: rows y = 6, 10, ..., 34, eight rows of 90.
  const stitches = products.threads.flatMap(stitchesOf);
  near(stitches.filter((s) => Math.abs(s.b[1] - s.a[1]) < 1e-12).reduce((sum, s) => sum + s.length, 0), 8 * 90, 1e-9);
  for (const p of products.threads.flatMap((t) => t.points)) assert.ok(p[0] >= 5 - 1e-9 && p[0] <= 95 + 1e-9 && p[1] >= 5 - 1e-9 && p[1] <= 35 + 1e-9);
  near(products.regions[0].fillArea, 90 * 30, 1e-9);
  const holed = regionsOf({ outer: rect(0, 0, 100, 40), holes: [rect(40, 10, 60, 30)] });
  const opened = stitchThreads(make(holed, { fill: { inset: 3 } }));
  for (const s of opened.threads.flatMap(stitchesOf)) assert.ok(!(s.a[0] > 37.0001 && s.a[0] < 62.9999 && s.a[1] > 7.0001 && s.a[1] < 32.9999 && s.b[0] > 37.0001 && s.b[0] < 62.9999 && s.b[1] > 7.0001 && s.b[1] < 32.9999), "the hole grew by the inset");
  const thin = stitchThreads(make(regionsOf({ outer: rect(0, 0, 100, 8) }), { fill: { inset: 5 } }));
  assert.equal(thin.threads.length, 0);
  assert.equal(thin.stats.emptyRegions, 1);
});

test("satin fill: each row piece is one stitch, or equal parts when longer than the bound", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) });
  const long = stitchThreads(make(regions, { fill: { rule: "satin", length: 100 } }));
  assert.deepEqual(long.threads.flatMap(stitchesOf).filter((s) => Math.abs(s.b[1] - s.a[1]) < 1e-12).map((s) => Math.round(s.length)), Array(10).fill(100));
  const split = stitchThreads(make(regions, { fill: { rule: "satin", length: 30 } }));
  const lengths = split.threads.flatMap(stitchesOf).filter((s) => Math.abs(s.b[1] - s.a[1]) < 1e-12).map((s) => s.length);
  assert.equal(lengths.length, 40);
  for (const l of lengths) near(l, 25, 1e-9);
});

test("curved rows follow a radial ring field, stay evenly spaced and keep to the bound", () => {
  const regions = regionsOf({ outer: rect(-120, -120, 120, 120) });
  const spacing = 4, length = 8;
  const products = stitchThreads(make(regions, { field: { kind: "radial", angle: 90, centerX: 0, centerY: 0 }, fill: { spacing, length } }));
  const rows: { radius: number }[] = [];
  for (const thread of products.threads) {
    const bounds = [...thread.rowStarts, thread.stitches + 1];
    thread.rowStarts.forEach((start, k) => {
      const pts = thread.points.slice(start, bounds[k + 1]);
      if (pts.length < 6) return;
      const radii = pts.map((p) => Math.hypot(p[0], p[1]));
      if (Math.min(...radii) < 25) return;
      near(Math.max(...radii) - Math.min(...radii), 0, 0.6, "a ring row keeps its radius");
      rows.push({ radius: radii.reduce((a, b) => a + b, 0) / radii.length });
    });
  }
  // Every non-connecting stitch lies along the tangent (a chord is perpendicular to the radius at its midpoint).
  for (const thread of products.threads) for (const s of stitchesOf(thread)) {
    if (isConnector(thread, s.index)) continue;
    const mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2, r = Math.hypot(mx, my);
    if (r < 25) continue;
    const cos = ((s.b[0] - s.a[0]) * mx + (s.b[1] - s.a[1]) * my) / (s.length * r);
    assert.ok(Math.abs(cos) < 0.08, `stitch at radius ${r.toFixed(1)} is ${Math.abs(cos).toFixed(3)} off the tangent`);
  }
  const radii = rows.map((row) => row.radius).sort((a, b) => a - b);
  const rings: number[] = [];
  for (const r of radii) if (rings.length === 0 || r - rings[rings.length - 1] > 0.5 * spacing) rings.push(r);
  const gaps = rings.slice(1).map((r, i) => r - rings[i]);
  assert.ok(rings.length > 10);
  assert.ok(Math.min(...gaps) >= 0.8 * spacing, `neighbouring rings are at least 0.8 spacing (the crowding stop) apart: ${Math.min(...gaps)}`);
  assert.ok(Math.max(...gaps) <= 2.2 * spacing, `and no more than about two spacings apart: ${Math.max(...gaps)}`);
  const longest = Math.max(...products.threads.flatMap(stitchesOf).map((s) => s.length));
  assert.ok(longest <= length + 1e-9, `${longest}`);
});

test("a constant field's angle is measured clockwise on screen from +x, for rows and for the turn each region takes from the spread", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 60) });
  for (const degrees of [-60, -30, 25, 80]) {
    const products = stitchThreads(make(regions, { field: { kind: "constant", angle: degrees }, fill: { spacing: 3 } }));
    const expected = (((degrees * Math.PI) / 180) % Math.PI + Math.PI) % Math.PI;
    for (const t of products.threads) for (const s of stitchesOf(t)) if (!isConnector(t, s.index) && s.length > 1e-6) near(angleOf(s.a, s.b), expected, 1e-9, `${degrees} degrees`);
  }
  // With a spread the region's field is turned by the reported amount, a seeded value within +-spread degrees.
  const turned = stitchThreads(make(regions, { field: { kind: "constant", angle: 10 }, fill: { spacing: 3, angleSpread: 50 } }));
  const turn = turned.regions[0].turn;
  assert.ok(Math.abs(turn) <= 50 && turn !== 0);
  for (const t of turned.threads) for (const s of stitchesOf(t)) if (!isConnector(t, s.index) && s.length > 1e-6) near(angleOf(s.a, s.b), ((((10 + turn) * Math.PI) / 180) % Math.PI + Math.PI) % Math.PI, 1e-9);
});

test("chords of curved rows never cut into a hole, even where the row hugs the hole's edge", () => {
  // Rows are circles about the centre; a chord of a row at radius r dips to sqrt(r^2 - (L/2)^2), inside the hole when r is just above it.
  const ring = (radius: number) => Array.from({ length: 96 }, (_, i) => [radius * Math.cos((2 * Math.PI * i) / 96), radius * Math.sin((2 * Math.PI * i) / 96)] as [number, number]);
  let hugging = 0;
  for (const radius of [15, 15.4, 15.8, 16.2, 16.6, 17, 17.4, 17.8, 18.2, 18.6]) {
    const regions = regionsOf({ outer: rect(-60, -60, 60, 60), holes: [ring(radius).reverse()] });
    const products = stitchThreads(make(regions, { field: { kind: "radial", angle: 90, centerX: 0, centerY: 0 }, fill: { spacing: 4, length: 10 } }));
    for (const t of products.threads) for (const s of stitchesOf(t)) {
      assert.ok(outsideLength(s.a, s.b, regions[0]) <= STITCH_INSIDE_TOLERANCE, `hole radius ${radius}: stitch ${s.a} -> ${s.b} cuts into the hole`);
      const r = Math.hypot((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2);
      if (r < radius + 0.8) hugging++;
    }
  }
  assert.ok(hugging >= 10, `rows do run against the hole's edge in these cases: ${hugging}`);
});

test("seed stitching scatters short stitches inside the region, one thread each, along the field unless scattered", () => {
  const regions = regionsOf({ outer: rect(0, 0, 120, 80), holes: [rect(40, 20, 80, 60)] });
  const aligned = stitchThreads(make(regions, { fill: { rule: "seed", spacing: 3, length: 8, scatter: 0 } }));
  const stitches = aligned.threads.flatMap(stitchesOf);
  assert.ok(aligned.threads.every((t) => t.stitches === 1 && t.rule === "seed"));
  for (const s of stitches) {
    assert.ok(s.length <= 8 + 1e-9 && s.length >= 0.25 * 4 - 1e-9, `${s.length}`);
    assert.ok(Math.abs(s.b[1] - s.a[1]) < 1e-9, "scatter 0 lies every stitch along the field (horizontal)");
    assert.ok(outsideLength(s.a, s.b, regions[0]) <= STITCH_INSIDE_TOLERANCE);
  }
  // Density: about one candidate per 3 x 3 cell of the (9600 - 1600) unit^2 region, minus dropped clipped stitches.
  const cells = 8000 / 9;
  assert.ok(stitches.length > 0.8 * cells && stitches.length <= cells * 1.1, `${stitches.length} vs ${cells}`);
  const scattered = stitchThreads(make(regions, { fill: { rule: "seed", spacing: 3, length: 8, scatter: 1 } }));
  const angles = scattered.threads.flatMap(stitchesOf).map((s) => angleOf(s.a, s.b));
  const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
  assert.ok(Math.abs(mean - Math.PI / 2) < 0.25, `a full scatter covers all directions: mean ${mean}`);
  assert.ok(Math.max(...angles) - Math.min(...angles) > 2.5);
  const reseeded = stitchThreads(make(regions, { fill: { rule: "seed", spacing: 3, length: 8, scatter: 0 }, seed: 8 }));
  assert.notDeepEqual(reseeded.threads.slice(0, 10).map((t) => t.points), aligned.threads.slice(0, 10).map((t) => t.points), "the seed rearranges the moss");
});

test("underlay, crossing layer, outline and seam are laid where they are documented", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) });
  const products = stitchThreads(make(regions, {
    underlay: { kind: "both", spacing: 8, inset: 3 }, crossing: { kind: "over", angle: 60, spacing: 6 }, outline: { kind: "running", lap: 7 }, fill: { inset: 2 },
  }));
  const roles = products.threads.map((t) => t.role);
  assert.deepEqual([...new Set(roles)], ["underlay", "fill", "crossing", "outline"], "underlay first, outline last: the fill crosses what is under it");
  assert.deepEqual(products.threads.map((t) => t.order), products.threads.map((_, i) => i));
  // Edge underlay: the ring of [5, 95] x [5, 35], closed, starting at the seam corner (bottom right).
  const edge = products.threads.find((t) => t.id === "r:0/ue:0")!;
  assert.deepEqual(edge.points[0], [95, 35]);
  assert.deepEqual(edge.points.at(-1), [95, 35]);
  near(edge.length, 2 * (90 + 30), 1e-9);
  for (const [x, y] of edge.points) assert.ok(x === 5 || x === 95 || y === 5 || y === 35, `${x},${y} lies on the ring`);
  // Cross underlay lies at 90 degrees to the fill (vertical here), crossing layer at 60.
  const under = byRole(products, "underlay").filter((t) => t.id.includes("/uc:"));
  assert.ok(under.length > 0);
  for (const t of under) for (const s of stitchesOf(t)) if (!isConnector(t, s.index)) near(angleOf(s.a, s.b), Math.PI / 2, 1e-9);
  for (const t of byRole(products, "crossing")) for (const s of stitchesOf(t)) if (!isConnector(t, s.index)) near(angleOf(s.a, s.b), Math.PI / 3, 1e-9);
  for (const t of byRole(products, "fill")) for (const s of stitchesOf(t)) if (!isConnector(t, s.index)) near(angleOf(s.a, s.b), 0, 1e-9);
  // Running outline of [2, 98] x [2, 38]: starts at the seam corner, has a penetration at each corner, laps 7 past the start.
  const outline = byRole(products, "outline")[0];
  assert.deepEqual(outline.points[0], [98, 38]);
  near(outline.length, 2 * (96 + 36) + 7, 1e-9);
  for (const corner of [[2, 2], [98, 2], [2, 38], [98, 38]]) assert.ok(outline.points.some((p) => p[0] === corner[0] && p[1] === corner[1]));
  const end = outline.points.at(-1)!;
  assert.ok(end[1] === 38 || end[0] === 98, "the lap continues along the first edge it took");
  near(Math.hypot(end[0] - 98, end[1] - 38), 7, 1e-9);
  for (const t of products.threads) for (const s of stitchesOf(t)) assert.ok(s.length <= 10 + 1e-9);
});

test("seam position names the extreme boundary point in that direction", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) });
  const start = (seam: number) => byRole(stitchThreads(make(regions, { seam, outline: { kind: "running" } })), "outline")[0].points[0];
  assert.deepEqual(start(45), [100, 40], "down-right on screen");
  assert.deepEqual(start(-135), [0, 0], "up-left");
  assert.deepEqual(start(135), [0, 40], "down-left");
  assert.deepEqual(start(-45), [100, 0], "up-right");
});

test("satin outline is a zigzag band of the stated width, inside the region", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 60), holes: [rect(40, 20, 60, 40)] });
  const products = stitchThreads(make(regions, { outline: { kind: "satin", width: 4, lap: 0 }, fill: { spacing: 3 } }));
  const outline = byRole(products, "outline");
  assert.ok(outline.length >= 2, "the outer ring and the hole each get a band");
  let across = 0, total = 0;
  for (const t of outline) for (const s of stitchesOf(t)) {
    total++;
    if (Math.abs(s.length - 4) < 1e-6) across++;
    assert.ok(outsideLength(s.a, s.b, regions[0]) <= STITCH_INSIDE_TOLERANCE, "the band never enters the hole or leaves the region");
  }
  assert.ok(across > 0.4 * total, `most stitches cross the band: ${across}/${total}`);
});

test("regions are independent: neither travel nor joins cross between disconnected regions", () => {
  const regions = regionsOf({ outer: rect(0, 0, 40, 20) }, { outer: rect(60, 0, 100, 20) }, { outer: rect(20, 40, 60, 60) });
  const off = stitchThreads(make(regions, { fill: { spacing: 3 } }));
  assert.equal(off.stats.travelThreads, 0);
  for (const t of off.threads) {
    const home = regions.find((r) => r.id === t.region)!;
    for (const s of stitchesOf(t)) assert.ok(outsideLength(s.a, s.b, home) <= STITCH_INSIDE_TOLERANCE, "every visible stitch lies in its own region");
  }
  assert.deepEqual(off.threads.map((t) => t.region).filter((r, i, all) => all.indexOf(r) === i), ["r:0", "r:1", "r:2"]);
  const nearest = stitchThreads(make(regions, { fill: { spacing: 3 }, routing: { order: "nearest" } }));
  // From region 0's last point (in the top-left rectangle) region 2 (below, 20 away in x) is nearer than region 1 (60 away).
  const orderOf = nearest.threads.map((t) => t.region).filter((r, i, all) => all.indexOf(r) === i);
  assert.equal(orderOf[0], "r:0");
  assert.equal(orderOf.length, 3);
  const on = stitchThreads(make(regions, { fill: { spacing: 3 }, routing: { travel: true } }));
  assert.ok(on.stats.travelThreads > 0);
  const travel = on.threads.filter((t) => t.role === "travel");
  for (const t of travel) {
    const before = on.threads[t.order - 1], after = on.threads[t.order + 1];
    assert.deepEqual(t.points[0], before.points.at(-1));
    assert.deepEqual(t.points.at(-1), after.points[0]);
    for (const s of stitchesOf(t)) assert.ok(s.length <= 10 + 1e-9, "travel obeys the bound too");
  }
  assert.equal(on.threads.length, off.threads.length + travel.length);
});

test("the stitch bound holds for every source, fill rule and layer", () => {
  const footprint = { centerX: 320, centerY: 320, width: 420, height: 420 };
  const sources = [
    { ...footprint, kind: "letters" as const, word: "THREAD" as const, weight: 5 },
    { ...footprint, kind: "blob" as const, variant: 2 },
    { ...footprint, kind: "quilt" as const, variant: 3, patches: 8, merge: 0.3, windows: 0.4 },
    { ...footprint, kind: "tones" as const, image: "geometry" as const, variant: 1, bands: 3, minRegion: 80, leaveLightest: false },
  ];
  const fields = [{ kind: "constant" as const, angle: 20 }, { kind: "swirl" as const, angle: 10, twist: 50, centerX: 300, centerY: 340 }];
  for (const source of sources) for (const rule of ["running", "satin", "seed", "mixed"] as const) for (const field of fields) {
    const regions = bundledStitchRegions(source);
    const o = make(regions, { field, fill: { rule, spacing: 5, length: 9, stagger: 0.6, scatter: 0.4, angleSpread: 40, inset: 2 },
      underlay: { kind: "both", spacing: 10, inset: 1.5 }, crossing: { kind: "over", angle: 70, spacing: 9 }, outline: { kind: "satin", width: 3, lap: 4 }, routing: { order: "nearest", travel: true } });
    const products = stitchThreads({ ...o, origin: [320, 320] });
    let longest = 0;
    for (const thread of products.threads) for (const s of stitchesOf(thread)) {
      longest = Math.max(longest, s.length);
      if (thread.role === "travel") continue;
      const home = regions.find((r) => r.id === thread.region)!;
      assert.ok(outsideLength(s.a, s.b, home) <= STITCH_INSIDE_TOLERANCE, `${source.kind}/${rule}/${field.kind}: ${thread.id} stitch leaves its region`);
    }
    assert.ok(longest <= 9 + 1e-9, `${source.kind}/${rule}/${field.kind}: longest ${longest}`);
    for (const thread of products.threads) for (const s of stitchesOf(thread)) assert.ok(s.length > 1e-9, `${thread.id} has a zero-length stitch`);
    assert.ok(products.stats.stitches > 0);
    near(products.stats.longest, longest, 1e-12);
  }
});

test("bundled region sources: letters, blob, quilt and tone bands have the documented topology", () => {
  const footprint = { centerX: 300, centerY: 250, width: 500, height: 300 };
  const word = bundledStitchRegions({ ...footprint, kind: "letters", word: "THREAD", weight: 0 });
  assert.equal(word.length, 6);
  assert.equal(word.reduce((sum, r) => sum + r.domain.regions[0].holes.length, 0), 3, "R, A and D have one counter each");
  const bold = bundledStitchRegions({ ...footprint, kind: "letters", word: "THREAD", weight: 8 });
  assert.ok(bold.length < word.length, "bold strokes that touch merge into one region");
  assert.ok(bold.reduce((sum, r) => sum + r.domain.area, 0) > word.reduce((sum, r) => sum + r.domain.area, 0));
  for (const r of bold) { const [l, t, rr, b] = r.domain.bounds!; assert.ok(l >= 50 - 1e-6 && rr <= 550 + 1e-6 && t >= 100 - 1e-6 && b <= 400 + 1e-6, "still inside the footprint"); }
  assert.deepEqual(word.map((r) => r.id), ["letter:0", "letter:1", "letter:2", "letter:3", "letter:4", "letter:5"]);
  for (const r of word) assert.ok(r.tone >= 0 && r.tone <= 1);

  const blob = bundledStitchRegions({ ...footprint, kind: "blob", variant: 4 });
  assert.equal(blob.length, 3);
  assert.equal(blob[0].domain.regions[0].holes.length, 1);
  near(domainIntersection(blob[0].domain, blob[1].domain).area, 0);
  near(domainIntersection(blob[0].domain, blob[2].domain).area, 0);
  assert.ok(blob[1].domain.area > 0 && blob[2].domain.area > 0);
  assert.strictEqual(bundledStitchRegions({ ...footprint, kind: "blob", variant: 4 }), blob, "cached by construction");
  assert.notDeepEqual(bundledStitchRegions({ ...footprint, kind: "blob", variant: 5 })[0].domain.regions[0].outer, blob[0].domain.regions[0].outer);

  const plain = bundledStitchRegions({ ...footprint, kind: "quilt", variant: 7, patches: 10, merge: 0, windows: 0 });
  near(plain.reduce((sum, r) => sum + r.domain.area, 0), 500 * 300, 1e-6);
  const joined = bundledStitchRegions({ ...footprint, kind: "quilt", variant: 7, patches: 10, merge: 0.5, windows: 0 });
  near(joined.reduce((sum, r) => sum + r.domain.area, 0), 500 * 300, 1e-6);
  assert.ok(joined.length < plain.length, "joining patches reduces their number");
  const windowed = bundledStitchRegions({ ...footprint, kind: "quilt", variant: 7, patches: 10, merge: 0, windows: 1 });
  assert.equal(windowed.length, plain.length);
  assert.ok(windowed.every((r) => r.domain.regions[0].holes.length === 1));
  assert.ok(windowed.reduce((sum, r) => sum + r.domain.area, 0) < 500 * 300 * 0.95);
  assert.deepEqual(windowed.map((r) => r.id), plain.map((r) => r.id), "windows do not rename patches");

  const tones = bundledStitchRegions({ ...footprint, kind: "tones", image: "geometry", variant: 1, bands: 3, minRegion: 60, leaveLightest: false });
  const side = 300;
  const covered = tones.reduce((sum, r) => sum + r.domain.area, 0);
  assert.ok(Math.abs(covered - side * side) < 0.03 * side * side, `bands tile the contain square: ${covered}`);
  for (const r of tones) assert.ok(r.tone >= 0 && r.tone <= 1);
  const open = bundledStitchRegions({ ...footprint, kind: "tones", image: "geometry", variant: 1, bands: 3, minRegion: 60, leaveLightest: true });
  assert.ok(open.length < tones.length && open.every((r) => tones.some((t) => t.id === r.id)));
  assert.throws(() => bundledStitchRegions({ ...footprint, kind: "tones", image: "noise", variant: 1, bands: 8, minRegion: 1, leaveLightest: false }), /Smallest region/);
  assert.throws(() => bundledStitchRegions({ ...footprint, kind: "letters", word: "NOPE" as "THREAD", weight: 0 }), /Word/);

  const rings = regionBoundaries(blob);
  assert.equal(rings.length, 4, "body, its hole and two islands");
  assert.ok(rings.every((p) => p.closed) && rings[0].id === "blob:0/ring:0" && rings[1].id === "blob:0/ring:1");
});

test("products are frozen, cached by construction and independent of appearance and of other regions", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) }, { outer: rect(120, 0, 200, 40) });
  const products = stitchThreads(make(regions));
  assert.ok(Object.isFrozen(products) && Object.isFrozen(products.threads) && Object.isFrozen(products.threads[0]) && Object.isFrozen(products.threads[0].points) && Object.isFrozen(products.threads[0].points[0]));
  assert.strictEqual(stitchThreads(make(regions)), products);
  assert.notStrictEqual(stitchThreads(make(regions, { fill: { spacing: 5 } })), products);
  // Removing a region leaves the other's threads (ids and vertices) exactly as they were.
  const alone = stitchThreads(make(regions.slice(0, 1)));
  const same = products.threads.filter((t) => t.region === "r:0");
  assert.deepEqual(same.map((t) => [t.id, t.points]), alone.threads.map((t) => [t.id, t.points]));
  // An inset edit renames nothing it does not have to: region and role ids keep their prefixes.
  assert.ok(stitchThreads(make(regions, { fill: { inset: 2 } })).threads.every((t) => /^r:[01]\/f:\d+$/.test(t.id)));
});

test("cancellation stops the build, is not cached, and work bounds name the control", () => {
  const regions = regionsOf({ outer: rect(0, 0, 100, 40) });
  const o = make(regions, { fill: { spacing: 4.4 } });
  assert.throws(() => stitchThreads(o, () => true), /Composition cancelled/);
  const built = stitchThreads(o);
  assert.ok(built.threads.length > 0);
  assert.strictEqual(stitchThreads(o), built);
  const big = regionsOf({ outer: rect(0, 0, 640, 640) });
  assert.throws(() => stitchThreads(make(big, { fill: { spacing: 0.8, length: 1 } })), /Row spacing/);
  assert.throws(() => stitchThreads(make(big, { fill: { rule: "seed", spacing: 0.8 } })), /Row spacing/);
  assert.throws(() => stitchThreads(make(regions, { fill: { spacing: 0.5 } })), /Row spacing/);
  assert.throws(() => stitchThreads(make(regions, { fill: { length: 0 } })), /Stitch length/);
  assert.throws(() => stitchThreads(make(regions, { fill: { stagger: 2 } })), /Stagger/);
  assert.ok(STITCH_LIMITS.stitches > 0);
  assert.equal(stitchThreads(make(regionsOf({ outer: rect(0, 0, 10, 10) }), { fill: { inset: 9 } })).threads.length, 0, "an emptied region is a valid empty drawing");
});

test("the instrument is registered with valid controls, conditions, groups and preparation", async () => {
  const input = createInstrument("region-stitch");
  validateInstrument(input);
  assert.equal(canPrepareInstrument("region-stitch"), true);
  assert.equal(await prepareInstrument(input, () => false), true);
  assert.equal(await prepareInstrument(input, () => true), false);
  const visible = (params: Record<string, number | string | boolean>) => visibleParameters("region-stitch", { ...input.params, ...params }).map((p) => p.key);
  assert.ok(!visible({ field: "constant" }).includes("twist") && visible({ field: "swirl" }).includes("twist"));
  assert.ok(visible({ source: "letters" }).includes("word") && !visible({ source: "quilt" }).includes("word"));
  assert.ok(!visible({ underlay: "none" }).includes("underlaySpacing") && visible({ underlay: "cross" }).includes("underlaySpacing"));
  assert.ok(!visible({ fill: "satin" }).includes("stagger") && visible({ fill: "mixed" }).includes("stagger"));
  const tree = inspectorItems("region-stitch", input.params);
  const sizeGroup = JSON.stringify(tree).includes('"proportional":true');
  assert.ok(sizeGroup);
  assert.equal(usesSeed({ ...input, params: { ...input.params, fill: "satin", angleSpread: 0, crossing: "none", colorBy: "region" } }), false);
  assert.equal(usesSeed({ ...input, params: { ...input.params, fill: "seed" } }), true);
});

test("hidden controls never change the drawing", () => {
  const base = createInstrument("region-stitch");
  const alternatives: Record<string, number | string | boolean> = {
    word: "LOOP", letterWeight: 9, variant: 3, patches: 5, merge: 0.1, windows: 0.9, image: "landscape", bands: 6, minRegion: 200, leaveLightest: true,
    fieldX: 0.2, fieldY: -0.2, twist: -80, fieldImage: "geometry", fieldVariant: 9, follow: 0.1, smoothing: 20, stagger: 0.9, scatter: 0.9,
    underlaySpacing: 15, underlayInset: 6, crossAngle: 30, crossSpacing: 15, outlineWidth: 8, lap: 20, dash: 9,
  };
  const configs = [
    { source: "quilt", field: "constant", fill: "satin", underlay: "none", crossing: "none", outline: "none", thread: "ink" },
    { source: "letters", field: "radial", fill: "seed", underlay: "edge", crossing: "none", outline: "running", thread: "ink" },
    { source: "blob", field: "swirl", fill: "running", underlay: "cross", crossing: "over", outline: "satin", thread: "stitch" },
    { source: "tones", field: "image", fill: "mixed", underlay: "both", crossing: "none", outline: "none", thread: "beads" },
  ];
  for (const config of configs) {
    const params = { ...base.params, ...config, spacing: 5, width: 300, height: 300 };
    const shown = new Set(visibleParameters("region-stitch", params).map((p) => p.key));
    const reference = drawFingerprint({ ...base, params });
    for (const [key, value] of Object.entries(alternatives)) {
      if (shown.has(key)) continue;
      assert.equal(drawFingerprint({ ...base, params: { ...params, [key]: value } }), reference, `${key} is hidden under ${JSON.stringify(config)} but changes the drawing`);
    }
  }
});

test("drawing: appearance edits keep the threads, colours follow the documented rules and the layer is transparent", () => {
  const input = createInstrument("region-stitch");
  input.params = { ...input.params, width: 300, height: 300, spacing: 5 };
  const recipe = regionStitchComposition(input);
  const products = regionStitchProducts(recipe);
  const recolored = regionStitchComposition({ ...input, palette: [0x101010, 0xaa0000, 0x00aa00, 0x0000aa], params: { ...input.params, weight: 3, thread: "stitch", colorBy: "tone" } });
  assert.strictEqual(regionStitchProducts(recolored), products, "colour, weight and material never enter the construction");
  assert.notEqual(drawFingerprint({ ...input, palette: [0x101010, 0xaa0000, 0x00aa00, 0x0000aa] }), drawFingerprint(input));
  // Colour rules: underlay uses entry 0; region colours cycle through 1..n-1.
  const palette = 5;
  const runs = stitchRuns(products, recipe.thread, palette, recipe.seed);
  for (const run of runs) {
    const thread = products.threads.find((t) => run.id === t.id || run.id.startsWith(`${t.id}/c`))!;
    const info = products.regions.find((r) => r.id === thread.region)!;
    if (thread.role === "underlay" || thread.role === "travel") assert.equal(run.tone, 0);
    else if (thread.role === "outline") assert.equal(run.tone, 0, "trim ink");
    else assert.equal(run.tone, 1 + (info.index % (palette - 1)));
  }
  const rowRuns = stitchRuns(products, { ...recipe.thread, colorBy: "row" }, palette, recipe.seed);
  assert.ok(rowRuns.length > runs.length, "row colours split threads where the row changes");
  const conserved = (list: readonly { points: readonly (readonly number[])[]; id: string }[]) => {
    for (const thread of products.threads) {
      const parts = list.filter((r) => r.id === thread.id || r.id.startsWith(`${thread.id}/c`));
      const joined = parts.flatMap((part, i) => (i === 0 ? part.points : part.points.slice(1)));
      assert.deepEqual(joined, thread.points, `${thread.id} is covered exactly by its runs`);
    }
  };
  conserved(runs); conserved(rowRuns);
  const recorder = new Recorder();
  drawStitches(recorder, recipe);
  assert.equal(recorder.count("push"), recorder.count("pop"));
  assert.equal(recorder.count("rect"), 0, "no paper-coloured rectangle");
  assert.ok(recorder.count("endShape") > 0);
  const seen: string[] = [];
  drawStitchProducts(new Recorder(), products, recipe.thread, recipe.palette, recipe.seed, { thread: (_surface, path) => { seen.push(path.id); } });
  assert.deepEqual(seen, runs.map((r) => r.id), "a replacement material receives the same runs, in stitching order");
});

test("an existing instrument keeps its drawing when layered with the stitch, in either order", () => {
  const stitch = createInstrument("region-stitch");
  stitch.params = { ...stitch.params, width: 300, height: 300, spacing: 5 };
  const other = createInstrument("fm-engraving");
  const ops = (...layers: (typeof stitch)[]) => {
    const recorder = new Recorder();
    for (const layer of layers) drawInstrument(recorder as unknown as DrawingContext, layer);
    return recorder.ops;
  };
  const alone = ops(other), stitched = ops(stitch);
  assert.ok(alone.length > 0 && stitched.length > 0);
  assert.deepEqual(ops(other, stitch), [...alone, ...stitched], "the stitch leaves no state behind for the layer above it");
  assert.deepEqual(ops(stitch, other), [...stitched, ...alone], "and inherits none from the layer below");
  assert.ok(![...alone, ...stitched].some((op) => op[0] === "background"), "neither paints paper");
});

test("prepared and direct results agree: the typed API equals the saved instrument", () => {
  const input = createInstrument("region-stitch");
  const recipe = regionStitchComposition(input);
  const { kind: _k, palette: _p, source, thread: _t, ...options } = recipe;
  assert.strictEqual(stitchThreads({ ...options, regions: bundledStitchRegions(source) }), regionStitchProducts(recipe));
  assert.throws(() => regionStitchComposition({ ...input, technique: "fm-engraving" }), /Not a region-stitch/);
  assert.throws(() => regionStitchComposition({ ...input, palette: [] }), /packed RGB/);
  assert.ok(offsetDomain(bundledStitchRegions(source)[0].domain, -1).area < bundledStitchRegions(source)[0].domain.area);
});
