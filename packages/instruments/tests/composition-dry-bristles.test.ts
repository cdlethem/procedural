import assert from "node:assert/strict";
import test from "node:test";
import {
  bristleBand, bristleContact, bristleSourcePaths, bristleStroke, bristleStrokes, bristleTrack, bundledRecording, canPrepareInstrument, contourPaths, createInstrument,
  drawDryBristles, drawInstrument, dryBristlesComposition, dryBristlesPlan, dryBristlesStrokes, gesturePath, gestureTrack, paperTooth, pathSet, prepareInstrument,
  MAX_HAIR_POINTS, type BristleFrame, type BristleOptions, type CompositionSurface, type DrawingContext, type Path,
} from "../dist/index.js";

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: string[] = [];
  #note(name: string, args: unknown[]) { this.ops.push(`${name}(${args.map((v) => typeof v === "number" ? Number(v.toFixed(9)) : String(v)).join(",")})`); }
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
const path = (id: string, points: [number, number][], closed = false, seed = 5): Path =>
  Object.freeze({ id, seed, points: Object.freeze(points.map((p) => Object.freeze(p))), closed, level: 0, levelFraction: 0 });
const even = (level = 1): BristleFrame["pressure"] => ({ profile: "even", level, pulses: 1 });
const frame = (step = 2, level = 1): BristleFrame => ({ step, pressure: even(level) });
/** Every hair down at every station: no dryness, depletion, waver, entry or exit. */
const solid: BristleOptions = { hairs: 20, width: 40, map: { floor: 0, curve: 1 }, dryness: 0, depletion: 0, wander: 0, attack: 0, release: 0 };
const straight = path("straight", [[100, 300], [500, 300]]);
const offsetOf = (hair: { levelFraction: number }) => hair.levelFraction * 2 - 1;
const plainInstrument = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("dry-bristles");
  return { ...input, seed, params: { ...input.params, ...params } };
};
const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42) => dryBristlesComposition(plainInstrument(params, seed));

test("a solid brush lays every hair on every station: exact ink load, hair length and lateral strata", () => {
  const stroke = bristleStroke(straight, frame(), solid);
  near(stroke.inkLoad, 1);
  assert.equal(stroke.hairs.length, 20);
  near(stroke.hairLength, 20 * 400, 1e-6);
  assert.ok(stroke.contact.every((c) => c === 1));
  // Hair k lies in its own stratum of the brush: offset in (k/10 - 1, (k+1)/10 - 1), y = 300 + offset * width / 2.
  for (const hair of stroke.hairs) {
    const o = offsetOf(hair);
    assert.ok(o > hair.hair / 10 - 1 && o < (hair.hair + 1) / 10 - 1, `hair ${hair.hair} offset ${o}`);
    for (const [, y] of hair.points) near(y, 300 + o * 20, 1e-9);
    near(hair.points[0][0], 100, 1e-9); near(hair.points[hair.points.length - 1][0], 500, 1e-9);
  }
  const offsets = stroke.hairs.map(offsetOf);
  near(stroke.area, (Math.max(...offsets) - Math.min(...offsets)) * 20 * 400, 1e-6);
  assert.equal(stroke.footprint.length, 1);
});


test("a hair's contact is a function of arc length: stations shared by two steps agree exactly", () => {
  const brush: BristleOptions = { hairs: 30, width: 40, map: { floor: 0.1, curve: 1 }, dryness: 0.8, depletion: 0.6, wander: 0, attack: 30, release: 30,
    distribution: { bias: 0, tufts: 3, clumping: 0, cohesion: 0.4 } };
  const swell: BristleFrame["pressure"] = { profile: "swell", level: 1, pulses: 1 };
  const touching = (step: number) => {
    const out = new Set<string>();
    for (const hair of bristleStroke(straight, { step, pressure: swell }, brush).hairs) for (const [x] of hair.points) out.add(`${hair.hair}@${Math.round(x - 100)}`);
    return out;
  };
  const fine = touching(1), coarse = touching(2);
  let compared = 0;
  for (const key of new Set([...fine, ...coarse])) {
    const arc = Number(key.split("@")[1]);
    if (arc % 2 !== 0) continue;
    compared++;
    // A one-station run is never published, so a lone touching station may be missing from either set; disagreement needs two neighbours.
    if (fine.has(key) !== coarse.has(key)) {
      const hair = key.split("@")[0], side = (a: number) => fine.has(`${hair}@${a}`) || coarse.has(`${hair}@${a}`);
      assert.ok(!(side(arc - 2) || side(arc + 2)), `hair ${key} disagrees between steps`);
    }
  }
  assert.ok(compared > 200);
});
test("ink load does not depend on how the path or the stroke is sampled", () => {
  const wave = (n: number) => path(`wave${n}`, Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [60 + 520 * t, 320 + 70 * Math.sin(t * 9) + 30 * Math.sin(t * 23)] as [number, number]; }), false, 9);
  const brush: BristleOptions = { hairs: 80, width: 50, map: { floor: 0.2, curve: 1 }, dryness: 0.7, depletion: 0.5, wander: 0.2,
    distribution: { bias: 0, tufts: 5, clumping: 0.3, cohesion: 0.5 }, paper: { seed: 3, strength: 0.6, grain: 5 } };
  const swell: BristleFrame["pressure"] = { profile: "swell", level: 1, pulses: 1 };
  const reference = bristleStroke(wave(4000), { step: 1, pressure: swell }, brush);
  assert.ok(reference.inkLoad > 0.2 && reference.inkLoad < 0.9, `a partial load is what makes the comparison informative: ${reference.inkLoad}`);
  for (const [vertices, step] of [[4000, 2], [4000, 4], [300, 1], [300, 3], [90, 2]] as const) {
    // Same shape, so different id and seed for the vertex-density variants would change random draws: keep them identical.
    const source = { ...wave(vertices), id: "wave4000", seed: 9 };
    const other = bristleStroke(source, { step, pressure: swell }, brush);
    near(other.inkLoad / reference.inkLoad, 1, 0.01, `ink load at ${vertices} vertices, step ${step}`);
    near(other.hairLength / reference.hairLength, 1, 0.05, `hair length at ${vertices} vertices, step ${step}`);
  }
});

test("a corner turns the brush frame through its bisector and never flips the hairs", () => {
  const ell = path("ell", [[100, 100], [300, 100], [300, 300]]);
  const track = bristleTrack(ell, frame(1));
  let previous = 0;
  for (const angle of track.angles) { assert.ok(angle >= previous - 1e-9 && angle <= Math.PI / 2 + 1e-9, `angle ${angle}`); previous = angle; }
  near(track.angles[0], 0); near(track.angles[track.angles.length - 1], Math.PI / 2);
  const stroke = bristleContact(track, { ...solid, hairs: 12, width: 30 });
  // Every hair keeps its own side of the frame's normal, in order, at every station: no crossing, no swap.
  const at = new Map<number, { lateral: number; hair: number }[]>();
  for (const hair of stroke.hairs) {
    const first = Math.round(Number(/@(.+)$/.exec(hair.id)![1]));
    hair.points.forEach(([x, y], j) => {
      const i = first + j, [sx, sy] = track.points[i], a = track.angles[i];
      const lateral = (x - sx) * -Math.sin(a) + (y - sy) * Math.cos(a);
      if (!at.has(i)) at.set(i, []);
      at.get(i)!.push({ lateral, hair: hair.hair });
      const o = offsetOf(hair);
      assert.ok(lateral * o >= -1e-9, `hair ${hair.hair} crossed the centre at station ${i}`);
    });
  }
  for (const entries of at.values()) {
    entries.sort((p, q) => p.hair - q.hair);
    for (let k = 1; k < entries.length; k++) assert.ok(entries[k].lateral >= entries[k - 1].lateral - 1e-9, "hair order swapped");
  }
  // The inside of the turn bunches: the innermost hairs sit closer to the corner than the outside ones do.
  const corner = track.points.findIndex(([x, y]) => x >= 299.9 && y <= 100.1);
  const spread = at.get(corner)!.map((e) => e.lateral);
  assert.ok(Math.max(...spread) - Math.min(...spread) < 30, "the brush cannot be wider than itself");
  assert.ok(track.points.length > 0);
  // A hairpin folds the chord to nothing; the frame keeps the incoming direction instead of turning NaN.
  const hairpin = bristleStroke(path("pin", [[100, 100], [300, 100], [100, 100.0001]]), frame(1), { ...solid, hairs: 8, width: 20 });
  for (const hair of hairpin.hairs) for (const [x, y] of hair.points) assert.ok(Number.isFinite(x) && Number.isFinite(y));
});

test("on a tight circle the inside hairs are limited to 90% of the radius of curvature", () => {
  const R = 40, circle = path("circle", Array.from({ length: 721 }, (_, i) => [300 + R * Math.cos(i / 720 * Math.PI * 2), 300 + R * Math.sin(i / 720 * Math.PI * 2)] as [number, number]));
  const wide = bristleStroke(circle, frame(1), { ...solid, hairs: 40, width: 200 });
  let smallest = Infinity, outermost = 0;
  for (const hair of wide.hairs) for (const [x, y] of hair.points) { const d = Math.hypot(x - 300, y - 300); smallest = Math.min(smallest, d); outermost = Math.max(outermost, d); }
  assert.ok(smallest >= 0.1 * R - 0.6, `inner hairs stay outside 10% of the radius: ${smallest}`);
  assert.ok(outermost > R + 90, `outer hairs are not limited: ${outermost}`);
  // A brush narrower than the radius is untouched: distance from the centre is R plus the offset, to within the chord error.
  const narrow = bristleStroke(circle, frame(1), { ...solid, hairs: 10, width: 20 });
  for (const hair of narrow.hairs) for (const [x, y] of hair.points) near(Math.hypot(x - 300, y - 300), R + offsetOf(hair) * 10 * -1, 0.05);
});

test("tilt carries the cross-section on the frame; a canvas hold keeps one angle and goes thin along its edge", () => {
  const tilted = bristleStroke(straight, frame(), { ...solid, hold: { mode: "path", tilt: 30 } });
  for (const hair of tilted.hairs) for (const [x, y] of hair.points) {
    const o = offsetOf(hair);
    near(y, 300 + o * 20 * Math.cos(Math.PI / 6), 1e-9);
    const along = (x + o * 20 * Math.sin(Math.PI / 6) - 100) / 2;   // stations are 2 apart from x = 100
    near(along, Math.round(along), 1e-6);
  }
  const edgeAlong = bristleStroke(straight, frame(), { ...solid, hold: { mode: "canvas", tilt: 0 } });
  for (const hair of edgeAlong.hairs) for (const [, y] of hair.points) near(y, 300, 1e-9);
  const across = bristleStroke(path("v", [[300, 100], [300, 500]]), frame(), { ...solid, hold: { mode: "canvas", tilt: 0 } });
  for (const hair of across.hairs) for (const [x, y] of hair.points) { near(x, 300 + offsetOf(hair) * 20, 1e-9); assert.ok(y >= 100 && y <= 500); }
});

test("tips taper the width by their shape over their length", () => {
  const long = path("long", [[100, 300], [500, 300]]);
  const brush = { ...solid, hairs: 41, width: 40 };
  const halfSpan = (stroke: ReturnType<typeof bristleStroke>, index: number) => {
    const ring = stroke.footprint[0], n = ring.length / 2;
    return (ring[index][1] - ring[ring.length - 1 - index][1]) / 2 * 1; // high side minus low side, at station index
  };
  const expectFor = (shape: "round" | "pointed" | "dragged", s: number, fromEnd: boolean) =>
    shape === "pointed" || (shape === "dragged" && fromEnd) ? s : shape === "round" ? Math.sqrt(1 - (1 - s) ** 2) : 1;
  for (const shape of ["pointed", "round", "dragged"] as const) {
    const stroke = bristleStroke(long, frame(), { ...brush, tip: { shape, length: 100 } });
    const offsets = stroke.hairs.map(offsetOf);
    const full = (Math.max(...offsets) - Math.min(...offsets)) * 20;
    for (const arc of [10, 30, 50, 80, 120, 200, 320, 370, 390]) {
      const index = arc / 2, s = Math.min(1, arc / 100), e = Math.min(1, (400 - arc) / 100);
      const expected = full * Math.min(expectFor(shape, s, false), expectFor(shape, e, true));
      near(Math.abs(halfSpan(stroke, index)) * 2, expected, 1e-6, `${shape} at arc ${arc}`);
    }
  }
});

test("distribution: clumping gathers hairs about tuft centres and bias moves density across the brush", () => {
  const many = { ...solid, hairs: 400, width: 100 };
  const clumped = bristleStroke(straight, frame(8), { ...many, distribution: { bias: 0, tufts: 4, clumping: 1, cohesion: 0 } });
  for (const hair of clumped.hairs) {
    const tuft = Math.min(3, Math.floor((offsetOf(hair) + 1) / 2 * 4 + 1e-12));
    const centre = ((tuft + 0.5) / 4) * 2 - 1;
    assert.ok(Math.abs(offsetOf(hair) - centre) <= 0.1 / 4 + 1e-9, `hair ${hair.hair}: ${offsetOf(hair)} vs tuft centre ${centre}`);
    assert.equal(hair.tuft, Math.floor(hair.hair * 4 / 400));
  }
  const meanAbs = (bias: number) => { const s = bristleStroke(straight, frame(8), { ...many, distribution: { bias, tufts: 1, clumping: 0, cohesion: 0 } }); return s.hairs.reduce((sum, h) => sum + Math.abs(offsetOf(h)), 0) / s.hairs.length; };
  near(meanAbs(0), 0.5, 0.02);
  near(meanAbs(1), 1 / (2 ** 1.5 + 1), 0.02);
  near(meanAbs(-1), 1 / (2 ** -1.5 + 1), 0.02);
});

test("cohesion makes a tuft lift and run dry as one; independent hairs do not nest", () => {
  const path2 = path("wave", Array.from({ length: 800 }, (_, i) => [50 + i * 0.7, 300 + 40 * Math.sin(i / 60)] as [number, number]), false, 21);
  const brush: BristleOptions = { hairs: 60, width: 20, map: { floor: 0, curve: 1 }, dryness: 1, depletion: 0.5, wander: 0, attack: 30, release: 0 };
  const track = bristleTrack(path2, frame(1, 0.55));
  /** Stations where a hair with |offset| touches. A hair is nested when every hair with a smaller |offset| also touches wherever it does. */
  const violations = (cohesion: number) => {
    const stroke = bristleContact(track, { ...brush, distribution: { bias: 0, tufts: 1, clumping: 0, cohesion } });
    const down = new Map<number, Set<number>>();   // station -> hairs
    for (const hair of stroke.hairs) {
      const first = Math.round(Number(/@(.+)$/.exec(hair.id)![1]));
      hair.points.forEach((_, j) => { if (!down.has(first + j)) down.set(first + j, new Set()); down.get(first + j)!.add(hair.hair); });
    }
    const size = new Map(stroke.hairs.map((h) => [h.hair, Math.abs(offsetOf(h))]));
    let count = 0;
    for (const set of down.values()) for (const a of set) for (const [b, mag] of size) if (mag < size.get(a)! && !set.has(b)) count++;
    return count;
  };
  assert.equal(violations(1), 0);
  assert.ok(violations(0) > 50, `independent hairs lift in their own streaks: ${violations(0)}`);
});

test("paper tooth decides contact by position alone, and hard pressure fills it", () => {
  const options = (strength: number): BristleOptions => ({ ...solid, hairs: 12, width: 30, map: { floor: 0.05, curve: 1 }, paper: { seed: 11, strength, grain: 4 } });
  const key = ([x, y]: readonly [number, number]) => `${x.toFixed(6)},${y.toFixed(6)}`;
  const all = new Set(bristleBand(bristleTrack(straight, frame(1, 0)), options(0)).flatMap((h) => h.points.map(key)));
  const touched = bristleBand(bristleTrack(straight, frame(1, 0)), options(1)).flatMap((h) => h.points);
  // Pressure 0 maps to width factor 0.05, so a hair touches where 0.05 >= strength * (0.5 - tooth).
  const expected = new Set<string>();
  for (const h of bristleBand(bristleTrack(straight, frame(1, 0)), options(0))) for (const p of h.points) if (paperTooth(11, 4, p[0], p[1]) >= 0.45 - 1e-12) expected.add(key(p));
  const seen = new Set(touched.map(key));
  // A hair run of one station is never published, so compare on points that belong to a published run in both.
  for (const k of seen) assert.ok(expected.has(k) && all.has(k), `unexpected contact at ${k}`);
  assert.ok(seen.size > 0.5 * expected.size && seen.size < all.size * 0.9, `${seen.size} of ${all.size}`);
  const hard = bristleStroke(straight, frame(1, 1), { ...options(1), map: { floor: 0, curve: 1 } });
  near(hard.inkLoad, 1, 1e-12);
  const tooth: number[] = [];
  for (let i = 0; i < 4000; i++) tooth.push(paperTooth(11, 4, 17 + i * 0.37, 90 + (i % 13) * 3.1));
  assert.ok(Math.min(...tooth) >= 0 && Math.max(...tooth) <= 1);
  assert.ok(Math.max(...tooth) - Math.min(...tooth) > 0.6, "the tooth uses most of its range");
  assert.equal(paperTooth(11, 4, 33.3, 44.4), paperTooth(11, 4, 33.3, 44.4));
  assert.notEqual(paperTooth(12, 4, 33.3, 44.4), paperTooth(11, 4, 33.3, 44.4));
});

test("light pressure lifts edge hairs first; depletion, entry and exit are stable shares of their lengths", () => {
  const brush: BristleOptions = { hairs: 100, width: 40, map: { floor: 0, curve: 1 }, dryness: 0.8, depletion: 0, wander: 0, attack: 0, release: 0 };
  const shape: BristleFrame = { step: 2, pressure: { profile: "swell", level: 1, pulses: 1 } };
  const stroke = bristleStroke(straight, shape, brush);
  const mean = (from: number, to: number) => { const s = stroke.contact.slice(Math.round(from * stroke.contact.length), Math.round(to * stroke.contact.length)); return s.reduce((a, b) => a + b, 0) / s.length; };
  assert.ok(mean(0.4, 0.6) > 2 * mean(0.02, 0.08), `${mean(0.4, 0.6)} vs ${mean(0.02, 0.08)}`);
  // Depletion 1: the latest a hair can run out is 85% of the path; the hairs run out at different points.
  const spent = bristleStroke(straight, frame(), { ...solid, hairs: 40, depletion: 1 });
  const ends = spent.hairs.map((h) => h.points[h.points.length - 1][0]);
  assert.ok(Math.max(...ends) <= 100 + 0.85 * 400 + 2 + 1e-9, `${Math.max(...ends)}`);
  assert.ok(new Set(ends.map((e) => Math.round(e))).size > 15);
  // Entry 30 and exit 40 canvas units: every hair starts within 30 and stops within 40 of the ends, and not all at once.
  const framed = bristleStroke(straight, frame(), { ...solid, hairs: 40, attack: 30, release: 40 });
  const starts = framed.hairs.map((h) => h.points[0][0] - 100), stops = framed.hairs.map((h) => 500 - h.points[h.points.length - 1][0]);
  assert.ok(Math.max(...starts) <= 30 + 2 && Math.max(...stops) <= 40 + 2);
  assert.ok(Math.max(...starts) > 15 && Math.max(...stops) > 20 && Math.min(...starts) < 10);
});

test("closed paths are opened at their first vertex; empty paths give empty strokes; bad input names itself", () => {
  const square = path("square", [[100, 100], [300, 100], [300, 300], [100, 300]], true);
  const track = bristleTrack(square, frame());
  near(track.trackLength, 800, 1e-9);
  assert.deepEqual([...track.points[0]], [100, 100]); assert.deepEqual([...track.points[track.points.length - 1]], [100, 100]);
  const still = bristleStroke(path("dot", [[10, 10], [10, 10]]), frame(), solid);
  assert.deepEqual([still.hairs.length, still.footprint.length, still.inkLoad, still.hairLength, still.area], [0, 0, 0, 0, 0]);
  assert.throws(() => bristleTrack(path("bad", [[0, 0], [NaN, 4]]), frame()), /Path bad has a non-finite coordinate/);
  assert.throws(() => bristleStroke(straight, frame(), { ...solid, hairs: 401 }), /integer in \[1, 400\]/);
  assert.throws(() => bristleTrack(straight, { step: 0.1, pressure: even() }), /path step must be a finite number/);
  assert.throws(() => bristleTrack(path("vast", [[0, 0], [30000, 0]]), frame(1)), /Path vast would need 30001 brush stations.*Raise the path step/);
});

test("hairs times stations is bounded exactly at the limit, for a path and for a family, before any hair exists", () => {
  const atLimit = path("limit", [[0, 0], [1499, 0]]), over = path("over", [[0, 0], [1500, 0]]);
  const big: BristleOptions = { ...solid, hairs: 400 };
  assert.equal(bristleTrack(atLimit, frame(1)).points.length * 400, MAX_HAIR_POINTS);
  assert.doesNotThrow(() => bristleStroke(atLimit, frame(1), big));
  assert.throws(() => bristleStroke(over, frame(1), big), /Bristles would need 600400 hair points.*limit is 600000/);
  const half = path("half", [[0, 0], [749, 0]]), other = { ...half, id: "half2" };
  assert.doesNotThrow(() => bristleStrokes([half, other], frame(1), big));
  assert.throws(() => bristleStrokes([half, other, { ...half, id: "half3" }], frame(1), big), /over 3 paths/);
  assert.throws(() => drawInstrument(new Recorder() as unknown as DrawingContext, plainInstrument({ source: "traces", traceCount: 8, hairs: 400, brushShare: 1 })),
    /Bristles would need \d+ hair points.*Lower Hairs, raise Path step/);
});

test("a path that carries its own frame (a gesture path) is used as given", () => {
  const track = gestureTrack(bundledRecording("sweep", 3), { smoothing: 20, frame: { centerX: 320, centerY: 320, scale: 1, rotation: 0 } });
  const own = gesturePath(track, { seed: 3, sampling: { kind: "arc", spacing: 3 }, window: { start: 0, end: track.duration }, pressure: { source: "recorded", whenAbsent: "reject", level: 0.5 } });
  assert.equal(bristleTrack(own, { step: 8, pressure: even(0.1) }), own);
  const stripped = path(own.id, own.points.map(([x, y]) => [x, y] as [number, number]), false, own.seed);
  assert.notEqual(bristleTrack(stripped, frame(3)), stripped);
});

const strokeOf = (recipe: ReturnType<typeof recipeFor>) => dryBristlesStrokes(dryBristlesPlan(recipe));

test("appearance never reaches a producer; raising the heavy share only adds strokes", () => {
  const base = strokeOf(recipeFor());
  const plain = plainInstrument();
  const restyled = strokeOf(dryBristlesComposition({ ...plain, palette: [0x111111, 0x222222, 0x333333, 0x444444],
    params: { ...plain.params, hairWeight: 2.4, hairMix: 0.9, wash: 0.5, line: "ink", lineWeight: 3, lineOverBrush: true } }));
  assert.equal(restyled.length, base.length);
  base.forEach((stroke, i) => assert.equal(restyled[i], stroke, "same cached stroke object"));
  const more = strokeOf(recipeFor({ brushShare: 0.7 }));
  assert.ok(more.length > base.length);
  for (const stroke of base) assert.ok(more.some((other) => other === stroke), `stroke ${stroke.track.id} survives a larger share unchanged`);
  const ids = (share: number) => dryBristlesPlan(recipeFor({ brushShare: share })).brushed.map((p) => p.id);
  assert.deepEqual(ids(0), []);
  assert.equal(ids(0.001).length, 1);
  const eligible = bristleSourcePaths(42, recipeFor().source).filter((p) => p.points.length > 1).length;
  assert.ok(ids(1).length <= eligible && ids(1).length >= ids(0.7).length);
  assert.ok(dryBristlesPlan(recipeFor({ brushShare: 1, brushMinLength: 0 })).brushed.length === eligible);
  assert.ok(dryBristlesPlan(recipeFor({ brushShare: 1, brushMinLength: 800 })).brushed.length < eligible);
});

test("sources are frozen, cached, stable and structurally seeded", () => {
  const traces = (seed: number, extra = {}) => bristleSourcePaths(seed, recipeFor({ source: "traces", ...extra }, seed).source);
  const a = traces(1);
  assert.equal(a, traces(1));
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a[0]) && Object.isFrozen(a[0].points));
  assert.deepEqual(a.map((p) => p.id), ["trace:0", "trace:1", "trace:2"]);
  assert.equal(traces(1, { traceCount: 5 }).length, 5);
  assert.deepEqual(traces(1, { traceCount: 5 }).slice(0, 3).map((p) => p.points[100]), a.map((p) => p.points[100]), "more traces never move the first ones");
  const box = (paths: readonly Path[]) => { const xs = paths.flatMap((p) => p.points.map((q) => q[0])), ys = paths.flatMap((p) => p.points.map((q) => q[1])); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(Math.round); };
  assert.notDeepEqual(box(traces(2)), box(traces(3)), "the seed changes the figure");
  // Contours are the existing contour construction, unchanged.
  const recipe = recipeFor();
  if (recipe.source.kind !== "contours") throw new Error("default source");
  const s = recipe.source;
  assert.equal(bristleSourcePaths(42, s), contourPaths({ seed: 42, source: s.field, width: 474, height: 460, centerX: 320, centerY: 320, resolution: 54, frequency: s.frequency,
    aspect: 1.5, hillCount: 5, hillRadius: 0.23, levelBase: -0.55, levelStep: s.interval, levels: s.levels, rotation: 12 }));
});

test("a scribble is cut into strokes of the stated length at the hand's bends", () => {
  for (const strokeLength of [150, 320]) {
    const paths = bristleSourcePaths(42, recipeFor({ source: "scribble", strokeLength }).source);
    assert.ok(paths.length >= 3);
    const length = (p: Path) => p.points.reduce((sum, q, i) => i ? sum + Math.hypot(q[0] - p.points[i - 1][0], q[1] - p.points[i - 1][1]) : 0, 0);
    paths.forEach((p, i) => {
      if (i > 0) assert.deepEqual([...p.points[0]], [...paths[i - 1].points[paths[i - 1].points.length - 1]], "strokes join end to start");
      const l = length(p);
      if (i < paths.length - 1) assert.ok(l >= strokeLength - 3 && l <= 1.6 * strokeLength + 3, `stroke ${i} is ${l}`);
      else assert.ok(l >= 0.5 * strokeLength - 3 && l <= 2.1 * strokeLength + 3, `last stroke is ${l}`);
    });
  }
  assert.notDeepEqual(bristleSourcePaths(1, recipeFor({ source: "scribble" }, 1).source).map((p) => p.points.length),
    bristleSourcePaths(2, recipeFor({ source: "scribble" }, 2).source).map((p) => p.points.length));
});

test("supplied path data is validated and frozen; ids stay stable", () => {
  const good = [{ id: "a", points: [[0, 0], [10, 5]] as [number, number][] }, { id: "b", points: [[0, 10], [10, 15], [20, 10]] as [number, number][], closed: true }];
  const set = pathSet(good, 7);
  good[0].points[0][0] = 99;
  assert.equal(set[0].points[0][0], 0);
  assert.ok(Object.isFrozen(set[1]) && set[1].closed && set[0].seed !== set[1].seed);
  assert.throws(() => pathSet([good[0], good[0]], 1), /Duplicate path id: a/);
  assert.throws(() => pathSet([{ id: "c", points: [[0, 0]] }], 1), /Path c needs at least two points/);
  assert.throws(() => pathSet([{ id: "d", points: [[0, 0], [Infinity, 1]] }], 1), /Path d point 1 must be two finite/);
  assert.throws(() => pathSet([{ id: "", points: [[0, 0], [1, 1]] }], 1), /needs a non-empty id/);
  assert.throws(() => pathSet([], 1), /1 to 1000 paths/);
  const drawn = new Recorder();
  const recipe = { ...recipeFor(), source: { kind: "paths" as const, paths: [{ id: "a", points: [[100, 300], [500, 300]] as [number, number][] }] }, strokes: { share: 1, minLength: 0, widthVariation: 0 } };
  drawDryBristles(drawn, recipe);
  assert.ok(drawn.ops.length > 10);
});

test("the descriptor is plain data and consumers are replaceable while producers stay the same objects", () => {
  const recipe = recipeFor();
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), recipe);
  const plan = dryBristlesPlan(recipe), strokes = dryBristlesStrokes(plan);
  const hairsSeen: unknown[] = [], linesSeen: string[] = [];
  const surface = new Recorder();
  drawDryBristles(surface, { ...recipe, ink: { ...recipe.ink, wash: 0 } }, {
    hair: (s, hair) => { hairsSeen.push(hair); s.line(0, 0, 1, 1); },
    line: (s, p) => { linesSeen.push(p.id); s.line(0, 0, 2, 2); },
  });
  assert.equal(hairsSeen.length, strokes.reduce((n, s) => n + s.hairs.length, 0));
  hairsSeen.forEach((hair, i) => assert.equal(hair, strokes.flatMap((s) => s.hairs)[i]));
  assert.deepEqual(linesSeen, plan.fine.map((p) => p.id));
  const brushedIds = new Set(plan.brushed.map((p) => p.id));
  assert.ok(linesSeen.every((id) => !brushedIds.has(id)), "the fine line follows only the paths that are not brushed");
  const traced = dryBristlesPlan(recipeFor({ lineOverBrush: true })).fine.length;
  assert.equal(traced, plan.paths.length);
  assert.equal(dryBristlesPlan(recipeFor({ line: "none" })).fine.length, 0);
  assert.throws(() => dryBristlesComposition({ ...plainInstrument(), technique: "motif-ecologies" }), /Not a dry-bristles input/);
  assert.throws(() => recipeFor({ hairs: 500 }), /between 1 and 400/);
  assert.throws(() => recipeFor({ source: "photograph" }), /not an available option/);
});

test("wash and hairs are separate consumers: no wash draws no filled shape, the wash stays under every hair", () => {
  const withWash = new Recorder(), without = new Recorder();
  drawDryBristles(withWash, recipeFor({ wash: 0.4 })); drawDryBristles(without, recipeFor({ wash: 0 }));
  assert.ok(!without.ops.some((op) => op.startsWith("endShape(close")));
  assert.ok(withWash.ops.some((op) => op.startsWith("endShape(close")));
  const lastWash = withWash.ops.lastIndexOf("endShape(close)"), firstHair = withWash.ops.findIndex((op, i) => i > lastWash && op.startsWith("strokeWeight"));
  assert.ok(lastWash >= 0 && firstHair > lastWash);
});

test("preparation builds the strokes cooperatively and honours cancellation", async () => {
  assert.equal(canPrepareInstrument("dry-bristles"), true);
  const input = plainInstrument({ brushShare: 0.9 }, 5);
  assert.equal(await prepareInstrument(input, () => true), false);
  const before = strokeOf(dryBristlesComposition(input));
  let calls = 0;
  assert.equal(await prepareInstrument(input, () => { calls++; return false; }), true);
  assert.ok(calls >= 2);
  strokeOf(dryBristlesComposition(input)).forEach((s, i) => assert.equal(s, before[i]));
});

test("every bristle control that changes the picture reaches the producer, and hidden ones do not", () => {
  const picture = (params: Record<string, number | string | boolean>) => { const r = new Recorder(); drawDryBristles(r, recipeFor(params)); return r.ops.join("|"); };
  const base = picture({});
  for (const change of [{ hairs: 40 }, { brushWidth: 80 }, { bias: 0.6 }, { clumping: 0.9 }, { cohesion: 1 }, { hold: "canvas", tilt: 40 }, { tilt: 25 }, { step: 5 },
    { pressureProfile: "pulses" }, { pressureFloor: 0.6 }, { tip: "pointed" }, { dryness: 0.3 }, { depletion: 0.1 }, { hairWander: 0.9 }, { attack: 0 },
    { toothStrength: 1.2 }, { toothGrain: 12 }, { paper: false }, { hairMix: 0.8 }, { wash: 0.3 }, { line: "ink" }, { brushShare: 0.6 }, { widthVariation: 0 }, { contourLevels: 5 }, { source: "scribble" }])
    assert.notEqual(picture(change), base, JSON.stringify(change));
  // Hidden while the blunt tip or the plain paper is chosen: no effect.
  assert.equal(picture({ tip: "blunt", tipLength: 10 }), picture({ tip: "blunt", tipLength: 140 }));
  assert.equal(picture({ paper: false, toothStrength: 0.1 }), picture({ paper: false, toothStrength: 1.4 }));
  // Exit only shows where depletion has left ink to lift: with none depleted it changes the picture.
  assert.notEqual(picture({ depletion: 0, release: 0 }), picture({ depletion: 0, release: 60 }));
  assert.equal(picture({ source: "traces", figure: "3:2", contourLevels: 3 }), picture({ source: "traces", contourLevels: 12 }));
});
