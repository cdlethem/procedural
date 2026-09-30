import assert from "node:assert/strict";
import test from "node:test";
import {
  CAP_HEIGHT, MAX_LAYOUT_ITEMS, MIN_CONDENSE, MIN_STRAIGHTNESS, OPTICAL_CLEARANCE, arcPointAt, arcSpan, arcTable, arcTurn, attachmentSites, branchChains,
  branchTree, bundledBranchTree, componentSeed, createInstrument, definition, disruptFrames, drawPathTypography, drawInstrument, glyphFill, glyphOf, glyphOutline,
  glyphTone, layoutAlongPath, readableSpans, SPAN_STEP, layoutPaths, opticalKern, pathText, pathTypographyComposition, pathTypographyProducts, preparePathTypography, rankedPaths, shapeRun,
  supplyPaths, usesSeed, validateInstrument, prepareInstrument,
  type AdvanceItem, type CompositionSurface, type GlyphItem, type Path, type PathFrame, type PathLayoutOptions, type PathTypographyComposition,
} from "../dist/index.js";
import { textOutlines } from "../dist/adapters/image-signal-instruments.js";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected}`);
const deepFrozen = (value: unknown): boolean =>
  value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value as object).every(deepFrozen));

const polyline = (points: [number, number][], id = "path", closed = false): Path =>
  ({ id, seed: 5, points, closed, level: 0, levelFraction: 0 });
/** A regular polygon fine enough that its chords are the circle to 1e-5. Clockwise on screen, or counter-clockwise when `reverse`. */
const circle = (cx: number, cy: number, radius: number, reverse = false, id = "circle"): Path => {
  const points: [number, number][] = [];
  for (let k = 0; k < 2880; k++) { const t = (reverse ? -k : k) * 2 * Math.PI / 2880; points.push([cx + radius * Math.cos(t), cy + radius * Math.sin(t)]); }
  return polyline(points, id, true);
};
const options = (over: Partial<PathLayoutOptions> = {}): PathLayoutOptions =>
  ({ scale: 1, start: 0, direction: "forward", baseline: 0, gap: 0, repeat: "once", policy: "ignore", minStraightness: MIN_STRAIGHTNESS, clearance: 0, ...over });
const boxes = (count: number, advance: number): AdvanceItem[] => Array.from({ length: count }, (_, i) => ({ id: `m${i}`, advance }));
const text = (value: string) => pathText({ id: "t", text: value });
const run = (value: string, kerning: "metric" | "optical" | "mono" = "metric", tracking = 0) => shapeRun(text(value), { kerning, tracking });

// --- independent geometry: boundary samples against even-odd ink, not the library's segment tests ---
type Rings = readonly (readonly (readonly number[])[])[];
function canvasRings(frame: PathFrame<GlyphItem>): number[][][] {
  const c = Math.cos(frame.angle), s = Math.sin(frame.angle);
  return frame.item.ink!.map((ring) => ring.map(([x, y]) => {
    const px = x * frame.condense * frame.scale, py = y * frame.scale;
    return [frame.position[0] + px * c - py * s, frame.position[1] + px * s + py * c];
  }));
}
function insideInk(rings: Rings, x: number, y: number): boolean {
  let odd = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}
/** Some sample of either boundary lies in the other's ink. */
function inkOverlaps(a: Rings, b: Rings): boolean {
  const boundary = (rings: Rings, other: Rings) => {
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length], steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.2));
      for (let k = 0; k <= steps; k++) if (insideInk(other, x1 + (x2 - x1) * k / steps, y1 + (y2 - y1) * k / steps)) return true;
    }
    return false;
  };
  return boundary(a, b) || boundary(b, a);
}
const adjacentOverlaps = (frames: readonly PathFrame<GlyphItem>[]) => {
  let count = 0;
  for (let i = 1; i < frames.length; i++) if (inkOverlaps(canvasRings(frames[i - 1]), canvasRings(frames[i]))) count++;
  return count;
};

/** Records every drawing call. */
class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: Array<[string, ...unknown[]]> = [];
  push() { this.ops.push(["push"]); } pop() { this.ops.push(["pop"]); }
  translate(...a: number[]) { this.ops.push(["translate", ...a]); } rotate(...a: number[]) { this.ops.push(["rotate", ...a]); }
  scale(...a: number[]) { this.ops.push(["scale", ...a]); }
  noFill() { this.ops.push(["noFill"]); } noStroke() { this.ops.push(["noStroke"]); }
  fill(...a: number[]) { this.ops.push(["fill", ...a]); } stroke(...a: number[]) { this.ops.push(["stroke", ...a]); }
  strokeWeight(...a: number[]) { this.ops.push(["strokeWeight", ...a]); } strokeCap(...a: unknown[]) { this.ops.push(["strokeCap", ...a]); }
  circle(...a: number[]) { this.ops.push(["circle", ...a]); } line(...a: number[]) { this.ops.push(["line", ...a]); }
  rect(...a: number[]) { this.ops.push(["rect", ...a]); } beginShape() { this.ops.push(["beginShape"]); }
  vertex(...a: number[]) { this.ops.push(["vertex", ...a]); } endShape(...a: unknown[]) { this.ops.push(["endShape", ...a]); }
  count(name: string) { return this.ops.filter((op) => op[0] === name).length; }
}

test("arc-length lookup: positions, headings, turning and spans on open and closed polylines", () => {
  const ell = arcTable([[0, 0], [10, 0], [10, 10]], false);
  near(ell.length, 20);
  assert.deepEqual([arcPointAt(ell, 5).x, arcPointAt(ell, 5).y, arcPointAt(ell, 5).heading], [5, 0, 0]);
  const up = arcPointAt(ell, 15);
  assert.deepEqual([up.x, up.y], [10, 5]); near(up.heading, Math.PI / 2);
  assert.deepEqual([arcPointAt(ell, 25).x, arcPointAt(ell, 25).y], [10, 10], "open paths clamp");
  assert.deepEqual([arcPointAt(ell, -3).x, arcPointAt(ell, -3).y], [0, 0]);
  const corner = arcTurn(ell, 5, 15);
  near(corner.signed, Math.PI / 2); near(corner.total, Math.PI / 2);
  assert.deepEqual(arcTurn(ell, 10, 15), { signed: 0, total: 0 }, "a vertex exactly at the start is not inside the span");
  const bend = arcTurn(arcTable([[0, 0], [10, 0], [10, 10], [20, 10]], false), 0, 30);
  near(bend.signed, 0); near(bend.total, Math.PI);
  const square = arcTable([[0, 0], [10, 0], [10, 10], [0, 10]], true);
  near(square.length, 40);
  assert.deepEqual([arcPointAt(square, 45).x, arcPointAt(square, 45).y], [5, 0], "closed paths wrap");
  const wrapped = arcPointAt(square, -5);
  assert.deepEqual([wrapped.x, wrapped.y], [0, 5]); near(wrapped.heading, -Math.PI / 2);
  near(arcTurn(square, 5, 45).signed, 2 * Math.PI); near(arcTurn(square, 5, 45).total, 2 * Math.PI);
  near(arcTurn(square, 0, 40).signed, 1.5 * Math.PI, 1e-12, "vertices strictly inside (0, 40): three corners");
  assert.deepEqual(arcSpan(ell, 5, 15), [[5, 0], [10, 0], [10, 5]]);
  assert.deepEqual(arcSpan(square, 35, 45), [[0, 5], [0, 0], [5, 0]], "a closed span wraps through the start vertex");
  assert.throws(() => arcSpan(square, 0, 41), /one lap/);
  assert.throws(() => arcTable([[0, 0], [1, 0], [1, 1], [0, 0]], true), /repeat its first point/);
  assert.throws(() => arcTable([[0, 0]], false), /at least two points/);
});

test("branch flank stations still equal the original walk along an edge, which the shared lookup replaced", () => {
  const tree = branchTree(bundledBranchTree({ seed: 42, centerX: 320, centerY: 320, extent: 520, attractors: 90, ticks: 34, branches: 2, spread: 40, routing: "smooth" }));
  const spacing = 9;
  const sites = attachmentSites(tree, { role: "flank", minDepth: 0, maxDepth: 450, offset: 0, inherit: 1, falloff: 0, flank: { spacing, angle: 0, sides: "single" } });
  const expected = new Map<string, [number, number, number]>();
  for (const edge of tree.edges) {
    const stations = Math.floor(edge.length / spacing);
    let segment = 0, walked = 0;
    for (let i = 0; i < stations; i++) {
      const at = (i + 0.5) * spacing;
      while (segment < edge.points.length - 2 && walked + Math.hypot(edge.points[segment + 1][0] - edge.points[segment][0], edge.points[segment + 1][1] - edge.points[segment][1]) <= at) {
        walked += Math.hypot(edge.points[segment + 1][0] - edge.points[segment][0], edge.points[segment + 1][1] - edge.points[segment][1]);
        segment++;
      }
      const a = edge.points[segment], b = edge.points[segment + 1], run2 = Math.hypot(b[0] - a[0], b[1] - a[1]), t = run2 > 0 ? Math.min(1, (at - walked) / run2) : 0;
      expected.set(`flank@${edge.id}#${i}+`, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])]);
    }
  }
  assert.equal(sites.length, expected.size);
  assert.ok(sites.length > 100);
  for (const site of sites) assert.deepEqual([site.position[0], site.position[1], site.angle], expected.get(site.id));
});

test("a shaped run reproduces the font's own line outlines and advances exactly", () => {
  const value = "Hag,%";
  const shaped = run(value), raw = textOutlines(value).filter((ring) => ring.length >= 3);
  let width = 0;
  for (const char of value) width += glyphOf(char).advance;
  near(shaped.length, width, 1e-9);
  const rebuilt: number[][][] = [];
  let pen = -width / 2;
  for (const item of shaped.items) {
    for (const ring of item.ink ?? []) rebuilt.push(ring.map(([x, y]) => [x + pen + item.advance / 2, y]));
    pen += item.advance;
  }
  assert.equal(rebuilt.length, raw.length);
  rebuilt.forEach((ring, i) => ring.forEach(([x, y], j) => { near(x, raw[i][j][0], 1e-9); near(y, raw[i][j][1], 1e-9); }));
  assert.deepEqual(shaped.items.map((item) => item.id), ["g0", "g1", "g2", "g3", "g4"]);
  assert.ok(deepFrozen(shaped));
  assert.equal(run("Hag,%"), shaped, "runs are cached by text and options");
});

test("tracking adds exactly its cap heights to every glyph; mono centres each glyph in one shared cell", () => {
  const value = "AVO H";
  const plain = run(value), tracked = run(value, "metric", 0.25);
  near(tracked.length - plain.length, 0.25 * CAP_HEIGHT * value.length, 1e-9);
  const mono = run(value, "mono"), pitch = Math.max(...[...value].map((char) => glyphOf(char).advance));
  for (const item of mono.items) near(item.advance, pitch, 1e-9);
  for (const item of mono.items) if (item.ink) {
    const xs = item.ink.flat().map(([x]) => x);
    near((Math.min(...xs) + Math.max(...xs)) / 2, 0, 1e-9, `${item.id} ink centre`);
  }
  assert.ok(mono.items[3].spacer, "the space is a spacer item");
  assert.throws(() => run("x", "metric", -1), /Tracking must be/);
  assert.throws(() => run("i", "metric", -0.5), /"i" at index 0 with no advance/, "tracking may not swallow a glyph's whole advance");
});

test("optical kerning: straight-sided pairs are untouched, rounds and diagonals close, and facing ink never touches", () => {
  assert.equal(opticalKern("H", "H"), 0);
  near(opticalKern("H", "I"), 0, 1e-9);
  assert.equal(opticalKern("A", " "), 0, "no kerning beside a space");
  assert.ok(opticalKern("A", "V") < -0.04 * CAP_HEIGHT, "a diagonal pair closes");
  assert.ok(opticalKern("T", "o") < -0.05 * CAP_HEIGHT && opticalKern("o", "T") < -0.05 * CAP_HEIGHT, "an open shape beside a round pulls in");
  assert.ok(Math.abs(opticalKern("o", "o")) < 0.03 * CAP_HEIGHT, "two rounds are already about as open as two stems");
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZfgjkrtvwxyoae1247.,?";
  let touching = 0, tested = 0;
  for (const a of letters) for (const b of letters) {
    const kern = opticalKern(a, b);
    assert.ok(kern >= -0.35 * CAP_HEIGHT - 1e-9 && kern <= 0.15 * CAP_HEIGHT + 1e-9);
    const first = glyphOf(a), second = glyphOf(b), shift = first.advance + kern;
    const left = first.rings.map((ring) => ring.map(([x, y]) => [x, y])), right = second.rings.map((ring) => ring.map(([x, y]) => [x + shift, y]));
    tested++;
    if (kern < 0.15 * CAP_HEIGHT - 1e-9 && inkOverlaps(left, right)) touching++;
  }
  assert.equal(touching, 0, `${touching} of ${tested} kerned pairs overlap`);
  assert.ok(OPTICAL_CLEARANCE > 0);
});

test("layout on a straight path: exact centres, direction, baseline, start, overflow and repeat counts, for items with no text at all", () => {
  const path = polyline([[100, 200], [500, 200]], "road");
  const items = boxes(5, 20);
  const layout = layoutAlongPath(path, items, options({ scale: 2 }));
  assert.deepEqual(layout.frames.map((frame) => frame.position[0]), [120, 160, 200, 240, 280]);
  assert.ok(layout.frames.every((frame) => frame.position[1] === 200 && frame.angle === 0 && frame.scale === 2 && frame.condense === 1 && !frame.seam));
  assert.deepEqual(layout.frames.map((frame) => frame.id), ["road/r0/m0", "road/r0/m1", "road/r0/m2", "road/r0/m3", "road/r0/m4"]);
  assert.deepEqual(layout.frames[1].span, [40, 80], "spans are arc length from the start of the path");
  near(layout.frames[0].seed - componentSeed(5, "road/r0/m0", "glyph"), 0);

  assert.deepEqual(layoutAlongPath(path, items, options({ scale: 2, baseline: 7 })).frames.map((f) => f.position[1]), [193, 193, 193, 193, 193], "positive baseline lifts a rightward run");
  assert.deepEqual(layoutAlongPath(path, items, options({ scale: 2, start: 50 })).frames.map((f) => f.position[0]), [170, 210, 250, 290, 330]);

  const back = layoutAlongPath(path, items, options({ scale: 2, direction: "reverse", baseline: 7 }));
  assert.deepEqual(back.frames.map((f) => f.position[0]), [480, 440, 400, 360, 320]);
  assert.ok(back.frames.every((f) => Math.abs(Math.abs(f.angle) - Math.PI) < 1e-12 && Math.abs(f.position[1] - 207) < 1e-9), "a reversed run is upside down, so its up is screen-down");
  assert.equal(back.report.direction, "reverse");

  const leftward = polyline([[500, 200], [100, 200]], "west");
  const upright = layoutAlongPath(leftward, items, options({ scale: 2, direction: "upright" }));
  assert.equal(upright.report.direction, "reverse");
  assert.deepEqual(upright.frames.map((f) => f.position[0]), [120, 160, 200, 240, 280]);
  assert.ok(upright.frames.every((f) => f.angle === 0), "upright reads left to right");
  assert.equal(layoutAlongPath(path, items, options({ direction: "upright" })).report.direction, "forward");

  const twelve = layoutAlongPath(path, boxes(12, 20), options({ scale: 2 }));
  assert.equal(twelve.frames.length, 10);
  assert.deepEqual(twelve.dropped.map((d) => [d.index, d.reason]), [[10, "overflow"], [11, "overflow"]]);
  assert.deepEqual(twelve.report.dropped, { overflow: 2, fold: 0, curvature: 0, crowded: 0 });

  const short = polyline([[0, 0], [100, 0]], "short"), three = boxes(3, 10);
  const counts = (repeat: "once" | "whole" | "fill") => layoutAlongPath(short, three, options({ repeat, gap: 10 }));
  assert.equal(counts("once").frames.length, 3);
  assert.equal(counts("whole").frames.length, 6, "runs start at 0 and 40; a run at 80 would end at 110");
  const fill = counts("fill");
  assert.equal(fill.frames.length, 8);
  assert.deepEqual(fill.dropped.map((d) => [d.id, d.reason]), [["short/r2/m2", "overflow"]]);
  assert.deepEqual(fill.frames.filter((f) => f.repeat === 2).map((f) => f.span[0]), [80, 90]);
  assert.throws(() => layoutAlongPath(path, items, options({ start: 401 })), /outside the path/);
  const shortWhole = layoutAlongPath(polyline([[0, 0], [20, 0]], "tiny"), three, options({ repeat: "whole", gap: 5 }));
  assert.equal(shortWhole.frames.length, 2, "the first run is always started, then cut at the end");
});

test("layout on a circle: frames lie on it with the chord as heading, signed turn, baseline side and one-lap limit", () => {
  const radius = 100, cw = circle(300, 300, radius), lap = arcTable(cw.points, true).length;
  const layout = layoutAlongPath(cw, boxes(8, 30), options({ baseline: 10 }));
  layout.frames.forEach((frame, k) => {
    const theta = (15 + 30 * k) / radius;
    near(frame.position[0], 300 + (radius + 10) * Math.cos(theta), 2e-3, "x");
    near(frame.position[1], 300 + (radius + 10) * Math.sin(theta), 2e-3, "y");
    near(Math.atan2(Math.sin(frame.angle - theta - Math.PI / 2), Math.cos(frame.angle - theta - Math.PI / 2)), 0, 1e-3, "heading is the tangent");
    near(frame.turn, 0.3, 2.5e-3, "clockwise on screen is positive (to within one polygon vertex)");
  });
  const inward = layoutAlongPath(circle(300, 300, radius, true), boxes(8, 30), options({ baseline: 10 }));
  for (const frame of inward.frames) near(Math.hypot(frame.position[0] - 300, frame.position[1] - 300), radius - 10, 2e-3, "counter-clockwise puts up toward the centre");
  for (const frame of inward.frames) near(frame.turn, -0.3, 2.5e-3);

  const long = layoutAlongPath(cw, boxes(25, 30), options());
  assert.equal(long.frames.length, Math.floor(lap / 30));
  assert.deepEqual(long.dropped.map((d) => d.reason), Array(25 - Math.floor(lap / 30)).fill("overflow"), "a run never passes its own start");
  near(layoutAlongPath(cw, boxes(8, 30), options({ start: lap + 30 })).frames[0].position[0], layoutAlongPath(cw, boxes(8, 30), options({ start: 30 })).frames[0].position[0], 1e-6, "start wraps on a closed path");

  const seam = layoutAlongPath(cw, boxes(3, 30), options({ start: lap - 45 }));
  assert.deepEqual(seam.frames.map((f) => f.seam), [false, true, false], "only the item that crosses arc length 0 is flagged");
  near(seam.frames[1].position[0], 300 + radius * Math.cos(0), 2e-3);
  assert.ok(seam.report.closed);
});

test("a path that folds back inside one item drops it under every policy; placed items follow the path", () => {
  const hairpin = polyline([[0, 0], [100, 0], [0, 10]], "hairpin");
  for (const policy of ["ignore", "skip", "compress", "rotate"] as const) {
    const layout = layoutAlongPath(hairpin, boxes(13, 15), options({ policy }));
    const folded = layout.dropped.filter((d) => d.reason === "fold");
    assert.ok(folded.length >= 1, `${policy}: the item across the apex is dropped`);
    assert.ok(folded.some((d) => d.index === 6), "interval [90, 105] straddles the apex");
    const table = arcTable(hairpin.points, false);
    for (const frame of layout.frames) {
      const a = arcPointAt(table, frame.span[0]), b = arcPointAt(table, frame.span[1]);
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= MIN_STRAIGHTNESS * 15 - 1e-9, "every placed item follows its path");
      assert.ok(Math.abs(Math.atan2(Math.sin(frame.angle - arcPointAt(table, frame.arc).heading), Math.cos(frame.angle - arcPointAt(table, frame.arc).heading))) < 1e-9, "on straight legs the chord is the heading");
    }
  }
});

test("curvature policies: ignore leaves overlaps, skip drops, compress narrows, rotate turns back; positions never move", () => {
  const word = run("HHHHHHHHHH");
  const inner = circle(300, 300, 40, true, "tight");
  const at = (policy: PathLayoutOptions["policy"]) => layoutAlongPath(inner, word.items, options({ scale: 30 / CAP_HEIGHT, policy, baseline: 0 }));
  const ignore = at("ignore"), skip = at("skip"), compress = at("compress"), rotate = at("rotate");
  assert.ok(ignore.frames.length >= 6 && adjacentOverlaps(ignore.frames) >= 3, "the inside of a bend crowds neighbouring letters");
  assert.ok(ignore.frames.every((f) => f.condense === 1 && f.adapted === "none"));
  for (const layout of [skip, compress, rotate]) assert.equal(adjacentOverlaps(layout.frames), 0, "no placed neighbours overlap");
  const positions = new Map(ignore.frames.map((f) => [f.id, f.position]));
  for (const layout of [skip, compress, rotate]) for (const f of layout.frames) assert.deepEqual(f.position, positions.get(f.id), "policy never moves an anchor");

  assert.ok(skip.frames.length < ignore.frames.length && skip.dropped.some((d) => d.reason === "curvature"));
  assert.ok(skip.frames.every((f) => f.condense === 1 && f.adapted === "none"));
  const skipAngles = new Map(ignore.frames.map((f) => [f.id, f.angle]));
  for (const f of skip.frames) assert.equal(f.angle, skipAngles.get(f.id));

  const narrowed = compress.frames.filter((f) => f.adapted === "compress");
  assert.ok(narrowed.length >= 1 && narrowed.every((f) => f.condense >= MIN_CONDENSE && f.condense < 1));
  assert.ok(compress.frames.some((f) => f.condense > MIN_CONDENSE && f.condense < 1), "an interior width, from bisection");

  const turned = rotate.frames.filter((f) => f.adapted === "rotate");
  assert.ok(turned.length >= 1);
  for (const f of turned) assert.ok(Math.abs(f.angle - ignore.frames.find((g) => g.id === f.id)!.angle) > 1e-3, "rotate changes the angle");
  assert.ok(rotate.frames.every((f) => f.condense === 1));

  const straight = polyline([[0, 300], [800, 300]], "straight");
  const base = layoutAlongPath(straight, word.items, options({ scale: 30 / CAP_HEIGHT }));
  for (const policy of ["skip", "compress", "rotate"] as const) {
    const other = layoutAlongPath(straight, word.items, options({ scale: 30 / CAP_HEIGHT, policy }));
    assert.deepEqual(other.frames.map((f) => [f.id, f.position, f.angle, f.condense]), base.frames.map((f) => [f.id, f.position, f.angle, f.condense]), `${policy} leaves straight type alone`);
  }
});

test("crowding: later paths yield whole repeats, clearance is honoured, a hairpin's run stops where it meets itself", () => {
  const word = run("HHHH"), scale = 30 / CAP_HEIGHT, long = run("HHHHHHHHHHHHHHHH");
  const across = [polyline([[0, 100], [400, 100]], "a"), polyline([[200, 0], [200, 300]], "b")];
  const layoutOf2 = (paths: Path[], over: Partial<PathLayoutOptions> = {}, crowding: "allow" | "avoid" = "avoid", items = word.items) =>
    layoutPaths(paths, items, { ...options({ scale, gap: 60, repeat: "fill", ...over }), start: 0 }, crowding);
  const allow = layoutOf2(across, { }, "allow");
  assert.ok(allow[0].frames.length > 4 && allow[1].frames.length > 4);
  const overlapAB = allow[0].frames.some((a) => allow[1].frames.some((b) => inkOverlaps(canvasRings(a), canvasRings(b))));
  assert.ok(overlapAB, "the crossing lines of type collide when allowed");
  const avoid = layoutOf2(across);
  assert.deepEqual(avoid[0].frames.map((f) => f.id), allow[0].frames.map((f) => f.id), "the first path keeps priority");
  for (const frame of avoid[1].frames) for (const other of avoid[0].frames) assert.ok(!inkOverlaps(canvasRings(frame), canvasRings(other)));
  const lostRepeats = new Set(avoid[1].dropped.filter((d) => d.reason === "crowded").map((d) => d.repeat));
  assert.ok(lostRepeats.size >= 1);
  for (const repeat of lostRepeats) assert.ok(!avoid[1].frames.some((f) => f.repeat === repeat), `repeat ${repeat} yields whole`);
  const allowedIds = new Set(allow[1].frames.map((f) => f.id));
  for (const d of avoid[1].dropped.filter((x) => x.reason === "crowded")) assert.ok(allowedIds.has(d.id), "only letters that would have been placed are crowded");

  // Parallel lines 4 units apart: fine at clearance 0 or 3, crowded at 10.
  const parallel = [polyline([[0, 100], [400, 100]], "low"), polyline([[0, 66], [400, 66]], "high")];
  assert.equal(layoutOf2(parallel, { clearance: 0 })[1].frames.length > 0, true);
  assert.equal(layoutOf2(parallel, { clearance: 3 })[1].frames.length > 0, true);
  assert.equal(layoutOf2(parallel, { clearance: 10 })[1].frames.length, 0);
  assert.ok(layoutOf2(parallel, { clearance: 10 })[1].dropped.every((d) => d.reason === "crowded" || d.reason === "overflow"));

  // A hairpin whose text hangs inside the fold: the run stops at the first letter that meets it.
  const fold = polyline([[0, 100], [300, 100], [300, 120], [0, 120]], "fold");
  const hangs = { baseline: -30, repeat: "once" as const };
  const open = layoutOf2([fold], hangs, "allow", long.items)[0], stopped = layoutOf2([fold], hangs, "avoid", long.items)[0];
  const crowded = stopped.dropped.filter((d) => d.reason === "crowded");
  assert.ok(crowded.length >= 1 && stopped.frames.length < open.frames.length);
  const kept = stopped.frames.map((f) => f.id);
  assert.deepEqual(kept, open.frames.slice(0, kept.length).map((f) => f.id), "everything before the first meeting is as allowed");
  const firstLost = Math.min(...crowded.map((d) => d.index));
  assert.ok(stopped.frames.every((f) => f.index < firstLost), "nothing after the first meeting survives");
  for (let i = 0; i < stopped.frames.length; i++) for (let j = 0; j < i - 2; j++)
    assert.ok(!inkOverlaps(canvasRings(stopped.frames[i]), canvasRings(stopped.frames[j])), "kept letters never meet each other");
});

test("ids and seeds do not depend on size, tracking, kerning, policy or colour; disruption keeps them too", () => {
  const path = polyline([[0, 100], [900, 100]], "line");
  const a = layoutAlongPath(path, run("ROAD BEND").items, options({ scale: 0.2, policy: "compress" }));
  const b = layoutAlongPath(path, run("ROAD BEND", "optical", 0.3).items, options({ scale: 0.3, policy: "rotate", baseline: 4 }));
  assert.deepEqual(a.frames.map((f) => f.id), b.frames.map((f) => f.id));
  assert.deepEqual(a.frames.map((f) => f.seed), b.frames.map((f) => f.seed));
  assert.equal(a.frames[3].id, "line/r0/g3");
  assert.equal(a.frames[3].seed, componentSeed(5, "line/r0/g3", "glyph"));
  const moved = disruptFrames(a, { seed: 3, length: 20, shift: 4, tilt: 0.3, grow: 0.2, dropout: 0 });
  assert.deepEqual(moved.frames.map((f) => [f.id, f.seed]), a.frames.map((f) => [f.id, f.seed]));
  assert.ok(deepFrozen(a) && deepFrozen(moved));
  assert.equal(layoutAlongPath(path, run("ROAD BEND").items, options({ scale: 0.2, policy: "compress" })), a, "identical inputs return the cached layout");
});

test("disruption is bounded, correlated along the path, monotone in dropout and seeded", () => {
  const path = polyline([[0, 300], [2400, 300]], "long");
  const layout = layoutAlongPath(path, boxes(300, 8), options());
  assert.equal(disruptFrames(layout, { seed: 1, length: 30, shift: 0, tilt: 0, grow: 0, dropout: 0 }).frames, layout.frames, "zero amounts change nothing");
  const disrupt = (over: Partial<Parameters<typeof disruptFrames>[1]> = {}) => disruptFrames(layout, { seed: 9, length: 40, shift: 6, tilt: 0.4, grow: 0.3, dropout: 0, ...over });
  const moved = disrupt();
  moved.frames.forEach((f, i) => {
    assert.ok(Math.abs(f.position[1] - 300) <= 6 + 1e-9 && Math.abs(f.position[0] - layout.frames[i].position[0]) <= 1e-9, "shift is sideways and bounded");
    assert.ok(Math.abs(f.angle) <= 0.4 + 1e-9);
    assert.ok(f.scale >= 0.7 - 1e-9 && f.scale <= 1.3 + 1e-9);
  });
  const roughness = (frames: readonly PathFrame[]) => frames.slice(1).reduce((sum, f, i) => sum + Math.abs(f.position[1] - frames[i].position[1]), 0) / (frames.length - 1);
  assert.ok(roughness(disrupt({ length: 8 }).frames) > 3 * roughness(disrupt({ length: 400 }).frames), "a longer correlation length moves neighbours together");
  assert.ok(Math.max(...moved.frames.map((f) => Math.abs(f.position[1] - 300))) > 3 && Math.max(...moved.frames.map((f) => Math.abs(f.angle))) > 0.2, "amplitudes are reached, not just bounded");
  assert.deepEqual(disrupt().frames.map((f) => f.position), moved.frames.map((f) => f.position), "same seed, same field");
  assert.notDeepEqual(disrupt({ seed: 10 }).frames.map((f) => f.position[1]), moved.frames.map((f) => f.position[1]));

  const light = disrupt({ dropout: 0.15 }), heavy = disrupt({ dropout: 0.4 });
  assert.ok(light.omitted.length > 0 && heavy.omitted.length > light.omitted.length);
  assert.ok(light.omitted.every((id) => heavy.omitted.includes(id)), "raising dropout only omits more, never different letters");
  assert.equal(light.frames.length + light.omitted.length, layout.frames.length);
  const runs: number[] = [];
  let length = 0;
  const omitted = new Set(heavy.omitted);
  for (const f of layout.frames) { if (omitted.has(f.id)) length++; else if (length) { runs.push(length); length = 0; } }
  assert.ok(Math.max(...runs) >= 3, "omissions come in runs");
  assert.throws(() => disrupt({ dropout: 2 }), /dropout/);
});

test("baselines are the offset reading path of each repeat, split at cusps", () => {
  const path = polyline([[0, 200], [400, 200]], "b");
  const layout = layoutAlongPath(path, boxes(5, 20), options({ baseline: 12, repeat: "fill", gap: 20 }));
  assert.equal(layout.baselines.length, layout.report.repeats);
  const [first] = layout.baselines;
  assert.equal(first.id, "b/r0/baseline");
  assert.deepEqual(first.points.map(([x, y]) => [x, y]), [[0, 188], [100, 188]]);
  const cusp = polyline([[0, 0], [100, 0], [0, 4]], "cusp");
  const folded = layoutAlongPath(cusp, boxes(12, 10), options());
  assert.ok(folded.baselines.length >= 1 && folded.baselines.every((line) => line.points.length >= 2));
  const inward = layoutAlongPath(polyline([[0, 0], [100, 0], [100, 100]], "corner"), boxes(9, 20), options({ baseline: -5 }));
  assert.deepEqual(inward.baselines[0].points[0], [0, 5], "a negative baseline hangs below a rightward path");
});

test("supplies: ranked longest first, windows slide, chains partition the tree, errors name the control", () => {
  const source = { seed: 42, source: "noise" as const, width: 520, height: 520, centerX: 320, centerY: 320, resolution: 60, frequency: 2.2, aspect: 1.5, hillCount: 5, hillRadius: 0.23,
    levelBase: -0.1, levelStep: 0.2, levels: 5, rotation: 12 };
  const supply = { kind: "contour" as const, source };
  const ranked = rankedPaths(supply);
  const length = (path: Path) => path.points.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - path.points[i - 1][0], p[1] - path.points[i - 1][1]) : 0, 0)
    + (path.closed ? Math.hypot(path.points[0][0] - path.points.at(-1)![0], path.points[0][1] - path.points.at(-1)![1]) : 0);
  for (let i = 1; i < ranked.length; i++) assert.ok(length(ranked[i - 1]) >= length(ranked[i]) - 1e-9);
  const window = supplyPaths(supply, { pick: 2, count: 3, smooth: 0 });
  assert.deepEqual(window.paths.map((p) => p.id), ranked.slice(2, 5).map((p) => p.id));
  assert.equal(window.available, ranked.length);
  assert.equal(supplyPaths(supply, { pick: 2, count: 3, smooth: 0 }), window, "selections are cached, so layouts can share");
  assert.equal(supplyPaths(supply, { pick: ranked.length - 1, count: 64, smooth: 0 }).paths.length, 1, "count is capped by what exists");
  const past = supplyPaths(supply, { pick: ranked.length, count: 1, smooth: 0 });
  assert.deepEqual([past.paths.length, past.available], [0, ranked.length], "a pick past the last path is a valid empty selection that reports what exists");
  assert.throws(() => supplyPaths(supply, { pick: 1.5, count: 1, smooth: 0 }), /nonnegative integer/);
  const smooth = supplyPaths(supply, { pick: 0, count: 1, smooth: 2 }).paths[0];
  assert.equal(smooth.id, `${ranked[0].id}~s2`);
  assert.ok(smooth.points.length > ranked[0].points.length);
  assert.deepEqual(smooth.points[0], ranked[0].points[0], "an open path keeps its ends");
  assert.deepEqual(supplyPaths({ kind: "contour", source: { ...source, levels: 0 } }, { pick: 0, count: 1, smooth: 0 }), { paths: [], available: 0 });

  const treeOptions = bundledBranchTree({ seed: 42, centerX: 320, centerY: 320, extent: 520, attractors: 90, ticks: 34, branches: 2, spread: 40, routing: "smooth" });
  const tree = branchTree(treeOptions), chains = branchChains(tree);
  const edgeLength = tree.edges.reduce((sum, edge) => sum + edge.length, 0);
  near(chains.reduce((sum, chain) => sum + length(chain), 0), edgeLength, 1e-6, "chains cover every edge exactly once");
  const edges = new Map(tree.edges.map((edge) => [edge.id, edge]));
  let longest = 0;
  for (const node of tree.nodes) if (node.role === "terminal") {
    let total = 0;
    for (let id: string | null = node.edgeIn; id !== null; id = edges.get(id)!.parent) total += edges.get(id)!.length;
    longest = Math.max(longest, total);
  }
  near(Math.max(...chains.map(length)), longest, 1e-6, "the longest chain is the longest root-to-tip lineage");
  assert.ok(chains.every((chain) => !chain.closed && chain.id.startsWith("chain@")));
  const gesture = supplyPaths({ kind: "gesture", recording: "sweep", seed: 42, smoothing: 30, spacing: 3, frame: { centerX: 320, centerY: 320, scale: 1, rotation: 0 } }, { pick: 0, count: 1, smooth: 0 });
  assert.equal(gesture.available, 1);
  const pts = gesture.paths[0].points;
  for (let i = 1; i < pts.length - 1; i++) assert.ok(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) <= 3 + 1e-6, "vertices every 3 units of arc");
});

function recipeOf(params: Record<string, unknown> = {}, seed = 42): PathTypographyComposition {
  const input = createInstrument("path-typography");
  input.seed = seed; Object.assign(input.params, params);
  return pathTypographyComposition(input);
}

test("producers are shared across appearance edits and rebuilt by structural ones", () => {
  const base = pathTypographyProducts(recipeOf());
  assert.equal(pathTypographyProducts(recipeOf()), pathTypographyProducts(recipeOf()) , "identical recipes give the cached value");
  for (const appearance of [{ style: "outline", weight: 2 }, { colorBy: "word" }, { guide: "path", guideWeight: 3 }, { colorBy: "adapted", style: "outline" }]) {
    const other = pathTypographyProducts(recipeOf(appearance));
    assert.equal(other.layouts[0], base.layouts[0], JSON.stringify(appearance));
    assert.equal(other.paths, base.paths);
  }
  const palette = pathTypographyProducts({ ...recipeOf(), palette: [1, 2, 3] });
  assert.equal(palette.layouts[0], base.layouts[0], "a palette edit never re-lays the type");
  for (const structural of [{ size: 30 }, { phrase: "river" }, { start: 0.3 }, { baseline: 9 }, { curves: "skip" }, { field: "hills" }, { tracking: 0.3 }]) {
    const other = pathTypographyProducts(recipeOf(structural));
    assert.notEqual(other.layouts[0], base.layouts[0], JSON.stringify(structural));
  }
  const phrase = pathTypographyProducts(recipeOf({ phrase: "river" }));
  assert.equal(phrase.paths, base.paths, "changing the text never rebuilds the supply");
  assert.notEqual(pathTypographyProducts(recipeOf({}, 7)).paths, base.paths);
  assert.ok(deepFrozen(base.layouts) && deepFrozen(base.frames) && deepFrozen(base.paths));
});

test("consumers: fills, outlines, colour rules and replacement by ordinary callbacks", () => {
  const recipe = recipeOf({ count: 2, guide: "none" });
  const products = pathTypographyProducts(recipe);
  const frames = products.frames.flat();
  assert.ok(frames.length > 20);
  const filled = new Recorder();
  drawPathTypography(filled, recipe);
  assert.equal(filled.count("endShape"), frames.reduce((sum, f) => sum + f.item.fill!.length, 0), "one shape per keyholed polygon of every placed letter");
  assert.equal(filled.count("push"), frames.length);
  const guided = new Recorder();
  drawPathTypography(guided, recipeOf({ count: 2, guide: "path" }));
  assert.equal(guided.count("push"), frames.length + products.paths.length, "a guide adds one isolated stroke per path");
  const outlined = new Recorder();
  drawPathTypography(outlined, recipeOf({ count: 2, guide: "none", style: "outline", weight: 1.5 }));
  assert.equal(outlined.count("endShape"), frames.reduce((sum, f) => sum + f.item.ink!.length, 0));
  const weights = new Set(outlined.ops.filter((op) => op[0] === "strokeWeight").map((op) => op[1] as number));
  assert.deepEqual([...weights].map((w) => Math.round(w * frames[0].scale * 1e6) / 1e6), [1.5], "a stroke is 1.5 canvas units wide whatever the letter's scale");

  const seen: string[] = [];
  const custom = new Recorder();
  drawPathTypography(custom, recipe, { glyph: (surface, frame) => { seen.push(frame.id); surface.circle(0, 0, 3); } });
  assert.deepEqual(seen, frames.map((f) => f.id), "a replacement consumer sees the same frames in order");
  assert.equal(custom.count("circle"), frames.length);
  assert.equal(custom.count("endShape"), 0);

  const pick = (repeat: number, word: number, adapted: "none" | "compress" | "rotate") =>
    ({ repeat, adapted, item: { word } }) as unknown as PathFrame<GlyphItem>;
  assert.equal(glyphTone(pick(2, 5, "none"), "ink"), 0);
  assert.equal(glyphTone(pick(2, 5, "none"), "repeat"), 2);
  assert.equal(glyphTone(pick(2, 5, "none"), "word"), 5);
  assert.deepEqual((["none", "compress", "rotate"] as const).map((adapted) => glyphTone(pick(0, 0, adapted), "adapted")), [0, 1, 2]);
  const condensedFrame = frames.find((f) => f.condense < 1);
  if (condensedFrame) {
    const rec = new Recorder();
    glyphFill([0xff0000], "ink")(rec, condensedFrame, undefined as never);
    const xs = rec.ops.filter((op) => op[0] === "vertex").map((op) => op[1] as number);
    const raw = condensedFrame.item.fill!.flat().map(([x]) => x * condensedFrame.condense);
    assert.deepEqual(xs, raw, "condense narrows the points, not the surface");
  }
  void glyphOutline;
});

test("named work bounds throw naming what to change, and nothing is truncated silently", () => {
  assert.throws(() => layoutAlongPath(polyline([[0, 0], [1e6, 0]], "huge"), run("ROAD").items, options({ scale: 0.001, repeat: "fill" })), new RegExp(`limit is ${MAX_LAYOUT_ITEMS}.*size.*once`));
  const dense = { ...recipeOf({ field: "hills", levels: 32, levelStep: 0.03, count: 28, repeat: "fill", crowding: "allow", curves: "ignore", phrase: "alphabet", gap: 0 }), size: 1.5 };
  assert.throws(() => pathTypographyProducts(dense), /more than 20000 letters.*Paths lettered/);
  assert.throws(() => pathTypographyProducts(recipeOf({ field: "noise", frequency: 5, levels: 32, levelStep: 0.02, count: 64, size: 4, repeat: "fill", phrase: "alphabet", gap: 0 })), /Curvature tests exceed.*fewer paths.*Tight curves/);
  assert.throws(() => validateInstrument({ ...createInstrument("path-typography"), params: { ...createInstrument("path-typography").params, supply: "branch", ticks: 160, sourceCount: 450 } }), /Attractor growth budget exceeded/);
  assert.throws(() => layoutAlongPath(polyline([[0, 0], [10, 0]], "s"), [{ id: "a/b", advance: 1 }], options()), /contain no '\/'/);
  assert.throws(() => layoutAlongPath(polyline([[0, 0], [10, 0]], "s"), [{ id: "a", advance: 0 }], options()), /positive finite advance/);
  assert.throws(() => layoutAlongPath(polyline([[0, 0], [0, 0]], "dot"), boxes(1, 1), options()), /too few distinct points/);
  assert.throws(() => pathText({ id: "x", text: "   " }), /not a space/);
  assert.throws(() => pathText({ id: "x", text: "naïve" }), /printable ASCII/);
  assert.throws(() => pathText({ id: "x", text: "a".repeat(121) }), /1–120/);
});

test("the instrument: seeds are structural, work is admitted, the layer is transparent, preparation cancels", async () => {
  const input = createInstrument("path-typography");
  assert.equal(usesSeed(input), true);
  assert.equal(usesSeed({ ...input, params: { ...input.params, field: "saddle", disruption: "off" } }), false);
  assert.equal(usesSeed({ ...input, params: { ...input.params, field: "saddle", disruption: "correlated" } }), true);
  assert.equal(usesSeed({ ...input, params: { ...input.params, field: "saddle", disruption: "correlated", disruptShift: 0, disruptTilt: 0, disruptGrow: 0, disruptDropout: 0 } }), false);
  const shape = (seed: number, params: Record<string, unknown> = {}) => pathTypographyProducts(recipeOf(params, seed)).frames.flat().map((f) => f.position.map((v) => Math.round(v)).join(",")).join(";");
  for (const params of [{}, { supply: "branch" }, { supply: "gesture" }]) assert.notEqual(shape(1, params), shape(2, params), `${JSON.stringify(params)}: seeds move the type`);
  assert.equal(shape(1, { field: "saddle" }), shape(2, { field: "saddle" }), "saddle contours ignore the seed");
  const recorder = new Recorder();
  drawInstrument(recorder as never, input);
  assert.equal(recorder.count("rect"), 0, "no full-canvas fill");
  assert.equal(definition("path-typography").controlGroups.length, 6);
  const recipe = recipeOf();
  assert.equal(await preparePathTypography(recipe, () => true), false);
  assert.equal(await preparePathTypography(recipe, () => false), true);
  const branch = recipeOf({ supply: "branch", ticks: 60, sourceCount: 120 });
  let calls = 0;
  assert.equal(await preparePathTypography(branch, () => ++calls > 3), false, "cancelling mid-growth stops preparation");
  assert.throws(() => pathTypographyComposition({ ...createInstrument("path-typography"), seed: -1 }), /uint32/);
  assert.throws(() => pathTypographyComposition({ ...createInstrument("path-typography"), technique: "contour-scores" }), /Not a path-typography input/);
});

test("readable spans: a path is cut where it turns from rightward to leftward, short wiggles never cut, forward and reverse keep whole paths", () => {
  // A U-turn: right along y=0, a half circle of radius 50 down, left along y=100.
  const uPoints: [number, number][] = [[0, 0], [200, 0]];
  for (let k = 1; k < 60; k++) { const t = -Math.PI / 2 + k * Math.PI / 60; uPoints.push([200 + 50 * Math.cos(t), 50 + 50 * Math.sin(t)]); }
  uPoints.push([200, 100], [0, 100]);
  const uturn = polyline(uPoints, "u");
  const spans = readableSpans(uturn, 30);
  assert.equal(spans.length, 2);
  assert.deepEqual(spans.map((span) => span.id), ["u#0", "u#1"]);
  assert.equal(spans[0].seed, componentSeed(5, "u#0", "path"));
  assert.deepEqual(spans[0].points[0], [0, 0], "the first span starts at the path's start");
  assert.deepEqual(spans[1].points.at(-1), [0, 100], "the last span ends at the path's end");
  const cut = spans[0].points.at(-1)!;
  assert.deepEqual(spans[1].points[0], cut, "spans meet exactly");
  assert.ok(Math.hypot(cut[0] - 250, cut[1] - 50) < 12, "the cut is at the vertical tangent, the right end of the U, to within the neutral band");
  near(Math.hypot(cut[0] - 200, cut[1] - 50), 50, 0.05, "and lies on the arc");
  const total = (path: Path) => path.points.reduce((sum, point, i) => i ? sum + Math.hypot(point[0] - path.points[i - 1][0], point[1] - path.points[i - 1][1]) : 0, 0);
  near(total(spans[0]) + total(spans[1]), total(uturn), 1e-6, "spans partition the path");
  // Upright reading of the spans: every letter's chord within 100 degrees of the reading direction.
  const items = boxes(60, 8);
  for (const span of spans) for (const f of layoutAlongPath(span, items, options({ direction: "upright", scale: 1 })).frames)
    assert.ok(Math.cos(f.angle) > -0.18, `letter turned ${(f.angle * 180 / Math.PI).toFixed(0)} degrees`);
  const whole = layoutAlongPath(uturn, items, options({ direction: "upright", scale: 1 }));
  assert.ok(whole.frames.some((f) => Math.cos(f.angle) < -0.9), "without cutting, the return arm of a U-turn is upside down");
  assert.equal(readableSpans(uturn, 30), spans, "cached");

  assert.deepEqual(readableSpans(polyline([[0, 0], [300, 20], [600, 0]], "flat"), 30).map((span) => span.id), ["flat"], "one run is the path itself");
  const same = polyline([[0, 0], [300, 20]], "one");
  assert.equal(readableSpans(same, 30)[0], same);
  // A small leftward wiggle shorter than minLength does not cut; a long minimum merges the second arm, a short one keeps it.
  const wiggle: [number, number][] = [[0, 0], [100, 0], [90, 20], [100, 40], [200, 40], [300, 40]];
  assert.equal(readableSpans(polyline(wiggle, "wig"), 60).length, 1);
  assert.equal(readableSpans(polyline([[0, 0], [100, 0], [100, 20], [0, 20]], "z"), 60).length, 2);
  assert.equal(readableSpans(polyline([[0, 0], [100, 0], [100, 20], [0, 20]], "z"), 150).length, 1, "a run shorter than the minimum is merged");
  assert.ok(SPAN_STEP > 0);

  // A closed loop is read as arcs: a circle gives a rightward top and a leftward bottom, each half a lap.
  const ring = readableSpans(circle(300, 300, 100), 30);
  assert.equal(ring.length, 2);
  const ringLength = ring.map(total);
  near(ringLength[0], Math.PI * 100, 8); near(ringLength[1], Math.PI * 100, 8);
  near(ringLength[0] + ringLength[1], 2 * Math.PI * 100, 0.5, "the two arcs make one lap");
  assert.ok(ring.every((span) => !span.closed));

  // Through the instrument: forward and reverse ride whole paths with unchanged ids; upright's uncut paths keep theirs.
  const forward = pathTypographyProducts(recipeOf({ direction: "forward" })), upright = pathTypographyProducts(recipeOf());
  assert.equal(forward.spans, forward.paths);
  assert.ok(forward.frames.flat().every((f) => f.id.startsWith(`${f.id.split("/")[0]}/r`) && !f.id.includes("#")));
  assert.ok(upright.spans.length > upright.paths.length, "the authored default cuts paths that double back");
  for (const span of upright.spans) assert.ok(span.id.startsWith(upright.paths.find((path) => span.id.startsWith(path.id))!.id));
  assert.deepEqual(pathTypographyProducts(recipeOf({ colorBy: "word" })).frames.flat().map((f) => [f.id, f.seed]), upright.frames.flat().map((f) => [f.id, f.seed]), "appearance never renames a letter");
});

test("the authored default reads upright: no letter of any default contour is turned past vertical", () => {
  for (const seed of [42, 7, 1234, 99, 5]) {
    const frames = pathTypographyProducts(recipeOf({}, seed)).frames.flat();
    assert.ok(frames.length > 60);
    for (const f of frames) assert.ok(Math.cos(f.angle) > -0.18, `seed ${seed}: ${f.id} is turned ${(f.angle * 180 / Math.PI).toFixed(0)} degrees`);
    const backwards = pathTypographyProducts(recipeOf({ direction: "forward" }, seed)).frames.flat().filter((f) => Math.cos(f.angle) < -0.5).length;
    assert.ok(backwards > 10, "forward reading leaves many letters upside down, so the rule is doing the work");
  }
  assert.equal(createInstrument("path-typography").params.direction, "upright");
});

test("sliders always give a drawing: every numeric control at slider min, at slider max, and all together, for every supply and landscape", async () => {
  const numeric = definition("path-typography").parameters.filter((parameter) => parameter.type === "number");
  const surface = new Recorder();
  const check = async (params: Record<string, unknown>, label: string) => {
    const input = createInstrument("path-typography");
    Object.assign(input.params, params);
    validateInstrument(input);
    assert.equal(await prepareInstrument(input, () => false), true, label);
    drawInstrument(surface as never, input);
  };
  // The landscape only matters to the contour supply; the others are checked with one.
  for (const supply of ["contour", "branch", "gesture"]) for (const field of supply === "contour" ? ["noise", "hills", "waves", "saddle"] : ["noise"]) {
    const base = { supply, field };
    await check({ ...base, ...Object.fromEntries(numeric.map((p) => [p.key, p.min])) }, `${supply}/${field} all min`);
    await check({ ...base, ...Object.fromEntries(numeric.map((p) => [p.key, p.max])) }, `${supply}/${field} all max`);
    if (field === "noise" || field === "waves") for (const p of numeric) for (const value of [p.min, p.max]) await check({ ...base, [p.key]: value }, `${supply}/${field} ${p.key}=${value}`);
  }
  // Every corner of the contour drivers, where paths can vanish entirely.
  const drivers = ["frequency", "level", "levelStep", "levels", "pick", "count"].map((key) => numeric.find((p) => p.key === key)!);
  for (const field of ["noise", "hills", "waves", "saddle"]) for (let mask = 0; mask < 1 << drivers.length; mask++)
    await check({ field, ...Object.fromEntries(drivers.map((p, i) => [p.key, mask >> i & 1 ? p.max : p.min])) }, `${field} corner ${mask}`);
  // An empty supply is an empty drawing: nothing is painted, and the producers say why.
  const empty = recipeOf({ levels: 1, level: 16, pick: 0 });
  const products = pathTypographyProducts(empty);
  assert.deepEqual([products.paths.length, products.available, products.frames.flat().length], [0, 0, 0]);
  const blank = new Recorder();
  drawPathTypography(blank, empty);
  assert.equal(blank.count("endShape") + blank.count("push"), 0);
});
