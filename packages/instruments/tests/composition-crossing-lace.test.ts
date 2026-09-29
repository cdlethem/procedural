import assert from "node:assert/strict";
import test from "node:test";
import {
  CROSSING_LIMITS, createInstrument, crossingHalfGap, crossingLaceComposition, crossingLaceProducts, cutPath, drawCrossingLace, drawInstrument,
  findCrossings, lacePaths, orderCrossings, retainedSegments, strandEnds, strandPieces, strandRoles, usesSeed, validateInstrument,
  type CompositionSurface, type Crossing, type CrossingOrder, type CrossingSet, type InstrumentInput, type LaceShape, type Path,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
type P = [number, number];
const path = (id: string, points: P[], closed = false): Path => ({ id, seed: 1, points, closed, level: 0, levelFraction: 0 });
const circle = (id: string, cx: number, cy: number, r: number, n = 240): Path =>
  path(id, Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)] as P), true);
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const frame = { centerX: 320, centerY: 320, width: 480, height: 400, rotation: 0 };
const lace = (shape: LaceShape, smoothing = 0, seed = 1) => lacePaths({ seed, frame, smoothing, shape });
const kinds = (set: CrossingSet) => {
  const count: Record<string, number> = {};
  for (const crossing of set.crossings) count[crossing.kind] = (count[crossing.kind] ?? 0) + 1;
  for (const contact of set.contacts) count[contact.kind] = (count[contact.kind] ?? 0) + 1;
  return count;
};
const random = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 0x100000000; };

/* ---------------------------------------------------------- known diagrams */

test("braid knot diagrams have exactly twists x (strands - 1) crossings and gcd(strands, twists) loops", () => {
  // Trefoil (2,3) = 3, figure-eight diagram (3,2) = 4, cinquefoil (2,5) = 5, Hopf link (2,2) = 2, (3,3) = 6, (4,6) = 18, (9,12) = 96.
  const cases: [number, number, number, number][] = [[2, 3, 3, 1], [3, 2, 4, 1], [2, 5, 5, 1], [2, 2, 2, 2], [3, 4, 8, 1], [4, 3, 9, 1], [3, 3, 6, 3], [4, 6, 18, 2], [5, 5, 20, 5], [7, 9, 54, 1], [9, 12, 96, 3]];
  for (const [strands, twists, crossings, loops] of cases) {
    for (const smoothing of [0, 2]) {
      const set = findCrossings(lace({ kind: "knot", strands, twists, depth: 0.45, detail: 40 }, smoothing));
      assert.equal(set.crossings.length, crossings, `T(${strands},${twists}) smoothing ${smoothing}`);
      assert.equal(set.paths.length, loops);
      assert.equal(set.contacts.length, 0, "a braid closure has no touching, overlapping or ending strands");
    }
  }
});

test("hand-built diagrams: linked rings, a ring chain, concentric and nested circles, a plus sign", () => {
  assert.equal(findCrossings([circle("a", 300, 300, 100), circle("b", 380, 300, 100)]).crossings.length, 2, "Hopf link");
  assert.equal(findCrossings([circle("a", 300, 300, 100), circle("b", 400, 300, 100), circle("c", 350, 386.6, 100)]).crossings.length, 6, "three mutually overlapping rings");
  for (const n of [6, 9]) {
    // n rings centred on a circle of radius R: neighbours overlap (2 crossings each pair), next neighbours do not.
    const R = 100, spacing = 2 * R * Math.sin(Math.PI / n), radius = 0.7 * spacing, rings = Array.from({ length: n }, (_, i) =>
      circle(`r${i}`, 320 + R * Math.cos(2 * Math.PI * i / n), 320 + R * Math.sin(2 * Math.PI * i / n), radius));
    assert.ok(2 * radius > spacing && 2 * radius < 2 * R * Math.sin(2 * Math.PI / n), "test geometry: only neighbours overlap");
    assert.equal(findCrossings(rings).crossings.length, 2 * n, `${n}-ring chain`);
  }
  assert.equal(findCrossings([circle("a", 300, 300, 100), circle("b", 300, 300, 60)]).crossings.length, 0, "concentric");
  assert.equal(findCrossings([circle("a", 300, 300, 100), circle("b", 310, 300, 30)]).crossings.length, 0, "nested");
  assert.equal(findCrossings([path("h", [[0, 50], [100, 50]]), path("v", [[50, 0], [50, 100]])]).crossings.length, 1, "plus sign");
});

test("Celtic plaits cross at every interior edge midpoint and close into gcd(columns, rows) strands", () => {
  for (const [columns, rows] of [[2, 2], [3, 2], [4, 4], [5, 3], [6, 4], [8, 8], [7, 1], [1, 5]]) {
    const set = findCrossings(lace({ kind: "celtic", columns, rows, breaks: 0 }));
    assert.equal(set.crossings.length, 2 * columns * rows - columns - rows, `${columns}x${rows} crossings`);
    assert.equal(set.paths.length, gcd(columns, rows), `${columns}x${rows} strands`);
    assert.ok(set.paths.every((p) => p.closed));
    assert.equal(set.contacts.length, 0);
    // Without smoothing each crossing is the two strands' shared vertex; smoothing turns them transversal, count unchanged.
    assert.equal(kinds(set).vertex, set.crossings.length);
    if (columns > 1 && rows > 1) assert.equal(kinds(findCrossings(lace({ kind: "celtic", columns, rows, breaks: 0 }, 2))).transversal, set.crossings.length);
  }
});

test("blocked plait edges remove exactly one crossing each, leave one tangent touch each, and only accumulate", () => {
  const columns = 6, rows = 5, edges = 2 * columns * rows - columns - rows;
  let previous: Set<string> | null = null;
  for (const share of [0.1, 0.3, 0.6]) {
    const set = findCrossings(lace({ kind: "celtic", columns, rows, breaks: share }, 0, 9));
    const blocked = Math.round(share * edges);
    assert.equal(set.crossings.length, edges - blocked);
    assert.equal(set.contacts.filter((c) => c.kind === "tangent").length, blocked, "each blocked edge is one apex-to-apex touch");
    assert.equal(set.contacts.length, blocked);
    const here = new Set(set.contacts.map((c) => c.point.join(",")));
    if (previous) for (const point of previous) assert.ok(here.has(point), "raising the share never unblocks an edge");
    previous = here;
  }
});

test("a brute-force reference agrees with the search on random integer polylines full of degeneracies", () => {
  const draw = random(11);
  for (let trial = 0; trial < 60; trial++) {
    const paths: Path[] = [];
    for (let k = 0; k < 4; k++) {
      const count = 3 + Math.floor(draw() * 5), points: P[] = [];
      while (points.length < count) {
        const next: P = [Math.floor(draw() * 9) * 8, Math.floor(draw() * 9) * 8];
        const last = points[points.length - 1];
        if (!last || last[0] !== next[0] || last[1] !== next[1]) points.push(next);
      }
      const closed = draw() < 0.5;
      const first = points[0], last = points[points.length - 1];
      if (closed && first[0] === last[0] && first[1] === last[1]) points.pop();
      if (points.length < (closed ? 3 : 2)) { k--; continue; }
      paths.push(path(`p${k}`, points, closed));
    }
    const segments: { p: number; i: number; a: P; b: P; n: number; closed: boolean }[] = [];
    paths.forEach((route, p) => {
      const n = route.closed ? route.points.length : route.points.length - 1;
      for (let i = 0; i < n; i++) segments.push({ p, i, a: route.points[i] as P, b: route.points[(i + 1) % route.points.length] as P, n, closed: route.closed });
    });
    const side = (a: P, b: P, c: P) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    let proper = 0;
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
      const s = segments[i], t = segments[j];
      if (s.p === t.p && (t.i - s.i === 1 || (s.closed && t.i - s.i === s.n - 1))) continue;
      if (side(s.a, s.b, t.a) * side(s.a, s.b, t.b) < 0 && side(t.a, t.b, s.a) * side(t.a, t.b, s.b) < 0) proper++;
    }
    const set = findCrossings(paths);
    assert.equal(set.crossings.filter((c) => c.kind === "transversal").length, proper, `trial ${trial}`);
  }
});

/* --------------------------------------------- degenerate-case policy */

test("degenerate contacts are classified, not guessed: vertex crossings, tangent touches, T-junctions, shared stretches", () => {
  const line = (id: string, ...points: P[]) => path(id, points);
  const one = (paths: Path[]) => kinds(findCrossings(paths));
  assert.deepEqual(one([line("p", [0, 0], [50, 50], [100, 100]), line("q", [0, 100], [50, 50], [100, 0])]), { vertex: 1 }, "an X whose arms meet at a common vertex is one crossing");
  assert.deepEqual(one([line("p", [0, 0], [100, 100]), line("q", [0, 100], [50, 50], [100, 0])]), { vertex: 1 }, "a path passing through the other's vertex");
  assert.deepEqual(one([line("p", [0, 0], [50, 50], [100, 0]), line("q", [0, 100], [50, 50], [100, 100])]), { tangent: 1 }, "two chevrons touching at their tips do not cross");
  assert.deepEqual(one([line("p", [0, 0], [100, 0]), line("q", [50, 0], [50, 100])]), { terminal: 1 }, "an open end on another strand is a T, not a crossing");
  assert.deepEqual(one([line("p", [0, 0], [100, 0]), line("q", [50, 0], [150, 0])]), { overlap: 2 }, "collinear shared stretch: reported at both ends, never woven");
  assert.deepEqual(one([path("a", [[0, 0], [100, 0], [100, 100], [0, 100]], true), path("b", [[100, 0], [200, 0], [200, 100], [100, 100]], true)]), { overlap: 2 }, "squares sharing an edge");
  assert.deepEqual(one([path("a", [[0, 0], [100, 0], [100, 100], [0, 100]], true), path("b", [[50, 50], [150, 50], [150, 150], [50, 150]], true)]), { transversal: 2 }, "overlapping squares");
  const diamond = (id: string, cx: number) => path(id, [[cx, 0], [cx + 50, 50], [cx, 100], [cx - 50, 50]], true);
  assert.deepEqual(one([diamond("a", 0), diamond("b", 100)]), { tangent: 1 }, "diamonds touching at one corner");
});

test("near misses are reported apart from crossings and contacts, and ignore curvature and crossings' own neighbourhoods", () => {
  const parallel = [path("p", [[0, 0], [100, 0]]), path("q", [[0, 2], [100, 2]])];
  const found = findCrossings(parallel, { nearMiss: 5 });
  assert.equal(found.crossings.length + found.contacts.length, 0);
  assert.equal(found.nearMisses.length, 1);
  near(found.nearMisses[0].distance, 2);
  assert.equal(findCrossings(parallel, { nearMiss: 1 }).nearMisses.length, 0, "beyond the tolerance");
  assert.equal(findCrossings(parallel).nearMisses.length, 0, "off by default");
  const crossing = findCrossings([path("h", [[0, 50], [100, 50]]), path("v", [[50, 0], [50, 100]])], { nearMiss: 20 });
  assert.equal(crossing.crossings.length, 1);
  assert.equal(crossing.nearMisses.length, 0, "the neighbourhood of a crossing is that crossing");
  const ring = findCrossings([circle("c", 300, 300, 60)], { nearMiss: 12 });
  assert.equal(ring.nearMisses.length, 0, "a smooth curve is not close to itself");
  const touching = findCrossings([path("a", [[0, 0], [50, 50], [100, 0]]), path("b", [[0, 100], [50, 50], [100, 100]])], { nearMiss: 30 });
  assert.equal(touching.contacts.length, 1);
  assert.equal(touching.nearMisses.length, 0, "a tangent touch is a contact, not a near miss");
});

test("classification is invariant under reversal, restart, reordering, rotation and mirroring", () => {
  const draw = random(5);
  for (let trial = 0; trial < 50; trial++) {
    const paths: Path[] = [];
    for (let k = 0; k < 4; k++) {
      const count = 3 + Math.floor(draw() * 4), points: P[] = [];
      while (points.length < count) {
        const next: P = [Math.floor(draw() * 7) * 10, Math.floor(draw() * 7) * 10];
        const last = points[points.length - 1];
        if (!last || last[0] !== next[0] || last[1] !== next[1]) points.push(next);
      }
      const closed = draw() < 0.5, first = points[0], last = points[points.length - 1];
      if (closed && first[0] === last[0] && first[1] === last[1]) points.pop();
      if (points.length < (closed ? 3 : 2)) { k--; continue; }
      paths.push(path(`p${k}`, points, closed));
    }
    const base = kinds(findCrossings(paths));
    const variants: Path[][] = [
      paths.map((p) => ({ ...p, points: [...p.points].reverse() })),
      paths.map((p) => p.closed ? { ...p, points: [...p.points.slice(1), p.points[0]] } : p),
      [...paths].reverse(),
      paths.map((p) => ({ ...p, points: p.points.map(([x, y]) => [-y, x] as P) })),
      paths.map((p) => ({ ...p, points: p.points.map(([x, y]) => [-x, y] as P) })),
    ];
    variants.forEach((variant, index) => assert.deepEqual(kinds(findCrossings(variant)), base, `trial ${trial} variant ${index}`));
  }
});

test("coordinates are snapped to 1/256 unit: sub-grid noise cannot change the count, and bad input names the path", () => {
  const base = [circle("a", 300, 300, 100), circle("b", 380, 300, 100)];
  const jittered = base.map((p) => ({ ...p, points: p.points.map(([x, y]) => [x + 1e-4, y - 1e-4] as P) }));
  assert.equal(findCrossings(jittered).crossings.length, 2);
  assert.throws(() => findCrossings([path("bad", [[0, 0], [Number.NaN, 4]])]), /bad/);
  assert.throws(() => findCrossings([path("far", [[0, 0], [9000, 4]])]), /far/);
  assert.throws(() => findCrossings([path("tiny", [[0, 0], [0.001, 0.001]])]), /tiny.*fewer than 2 distinct/);
  assert.throws(() => findCrossings([path("dup", [[0, 0], [5, 5]]), path("dup", [[0, 5], [5, 0]])]), /twice/);
});

/* ------------------------------------------------------ over/under order */

const trefoil = () => findCrossings(lace({ kind: "knot", strands: 2, twists: 3, depth: 0.45, detail: 40 }, 1));
const stateAlong = (order: CrossingOrder, pathIndex: number) =>
  order.occurrences[pathIndex].map((o) => (order.over[o.crossing] === o.side ? 1 : 0));

test("alternate rule on a trefoil: over and under strictly alternate around its six passes, for every seed", () => {
  const set = trefoil();
  assert.equal(set.crossings.length, 3);
  const bases: number[][] = [];
  for (const seed of [0, 1, 2, 3, 99, 4242]) {
    const order = orderCrossings(set, { rule: "alternate", seed });
    const states = stateAlong(order, 0);
    assert.equal(states.length, 6);
    for (let i = 0; i < 6; i++) assert.notEqual(states[i], states[(i + 1) % 6], `seed ${seed}, pass ${i}`);
    assert.equal(order.feasible, true);
    assert.deepEqual([...order.breaks], []);
    // every crossing has exactly one over strand and one under strand, on different sides
    for (const crossing of set.crossings) { const { over, under } = strandRoles(order, crossing); assert.notEqual(over, under); assert.equal(over.path, under.path); }
    bases.push([...order.over]);
  }
  // A seed can only choose which of the two consistent weaves it is (the mirror image).
  for (const over of bases) assert.ok(over.every((v, i) => v === bases[0][i]) || over.every((v, i) => v !== bases[0][i]));
  assert.ok(bases.some((over) => over[0] !== bases[0][0]) && bases.some((over) => over[0] === bases[0][0]), "both weaves occur across seeds");
});

test("a figure-eight diagram (3 strands, 2 twists) alternates too, and an exception breaks it exactly where it is put", () => {
  const set = findCrossings(lace({ kind: "knot", strands: 3, twists: 2, depth: 0.6, detail: 40 }, 1));
  assert.equal(set.crossings.length, 4);
  const order = orderCrossings(set, { rule: "alternate", seed: 5 });
  const states = stateAlong(order, 0);
  for (let i = 0; i < states.length; i++) assert.notEqual(states[i], states[(i + 1) % states.length]);
  const flipped = orderCrossings(set, { rule: "alternate", seed: 5, flips: [set.crossings[1].id] });
  assert.equal(flipped.over[1], order.over[1] === 0 ? 1 : 0);
  for (const i of [0, 2, 3]) assert.equal(flipped.over[i], order.over[i]);
  // The reversed crossing has two passes on this single strand; each has two neighbours: four equal-state neighbours.
  assert.equal(flipped.breaks.length, 4);
  assert.ok(flipped.breaks.every((item) => item.cause === "exception" && (item.before === set.crossings[1].id || item.after === set.crossings[1].id)));
  assert.deepEqual([...flipped.flipped], [1]);
  assert.throws(() => orderCrossings(set, { rule: "alternate", seed: 5, flips: ["nope"] }), /Unknown crossing id/);
  const mirror = orderCrossings(set, { rule: "alternate", seed: 5, invert: true });
  assert.ok([...mirror.over].every((v, i) => v !== order.over[i]));
  assert.equal(mirror.breaks.length, 0, "the mirror weave is still alternating");
});

test("closed-strand alternation is impossible with an odd number of passes, and that is reported, not hidden", () => {
  const loop = circle("ring", 300, 300, 100);
  // A strand that starts inside the ring and leaves it crosses once: the ring has one pass, which cannot alternate with itself.
  const oneCut = findCrossings([loop, path("arc", [[300, 300], [450, 300]])]);
  assert.equal(oneCut.crossings.length, 1);
  const bad = orderCrossings(oneCut, { rule: "alternate", seed: 3 });
  assert.equal(bad.feasible, false);
  assert.equal(bad.unavoidable.length, 1);
  assert.equal(bad.breaks.length, 1);
  assert.equal(bad.breaks[0].cause, "unavoidable");
  assert.equal(bad.breaks[0].pathId, "ring");
  // A strand that passes right through crosses twice and can alternate.
  const twoCuts = orderCrossings(findCrossings([loop, path("arc", [[150, 300], [450, 300]])]), { rule: "alternate", seed: 3 });
  assert.equal(twoCuts.feasible, true);
  assert.equal(twoCuts.breaks.length, 0);
  // An arc that leaves, re-enters and leaves again crosses three times: the ring has three passes.
  const three = findCrossings([loop, path("zig", [[300, 300], [450, 300], [450, 200], [300, 250], [300, 50]])]);
  assert.equal(three.crossings.length, 3);
  const odd = orderCrossings(three, { rule: "alternate", seed: 3 });
  assert.equal(odd.feasible, false);
  assert.ok(odd.unavoidable.length >= 1);
  assert.equal(odd.breaks.length, odd.unavoidable.length, "with no exceptions, the breaks are exactly the unavoidable ones");
  assert.ok(odd.breaks.every((item) => item.cause === "unavoidable"));
});

test("rank puts the higher path over at every crossing; equal ranks fall back to a stable coin; seeded is a per-crossing coin", () => {
  const rings = [circle("a", 300, 300, 100), circle("b", 400, 300, 100), circle("c", 350, 386.6, 100)];
  const set = findCrossings(rings);
  const byIndex = orderCrossings(set, { rule: "rank", seed: 1 });
  for (const crossing of set.crossings) assert.equal(strandRoles(byIndex, crossing).over.path, Math.max(crossing.first.path, crossing.second.path));
  const reversed = orderCrossings(set, { rule: "rank", seed: 1, ranks: [2, 1, 0] });
  for (const crossing of set.crossings) assert.equal(strandRoles(reversed, crossing).over.path, Math.min(crossing.first.path, crossing.second.path));
  const tied = [0, 1, 2].map((seed) => orderCrossings(set, { rule: "rank", seed, ranks: [5, 5, 5] }));
  assert.deepEqual([...tied[0].over], [...orderCrossings(set, { rule: "rank", seed: 0, ranks: [5, 5, 5] }).over]);
  assert.ok(tied.some((order) => [...order.over].some((v, i) => v !== tied[0].over[i])), "ties are decided by the seed");
  assert.throws(() => orderCrossings(set, { rule: "rank", seed: 1, ranks: [1, 2] }), /one entry per path/);
  const seeded = orderCrossings(set, { rule: "seeded", seed: 8 });
  assert.equal(seeded.over.length, 6);
  const other = orderCrossings(set, { rule: "seeded", seed: 9 });
  assert.ok([...seeded.over].some((v, i) => v !== other.over[i]));
});

test("orders are stable: the same set and options return the same frozen object; ids do not depend on anything drawn", () => {
  const set = trefoil();
  const a = orderCrossings(set, { rule: "alternate", seed: 4, flips: [set.crossings[2].id] });
  assert.equal(orderCrossings(set, { rule: "alternate", seed: 4, flips: [set.crossings[2].id] }), a);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(set) && Object.isFrozen(set.crossings[0]) && Object.isFrozen(set.crossings[0].first.tangent));
  assert.equal(findCrossings(set.paths), findCrossings(set.paths), "cached on the identity of the input");
  assert.equal(new Set(set.crossings.map((c) => c.id)).size, set.crossings.length);
});

/* ----------------------------------------------------------- strand pieces */

const crossPair = (angleDegrees: number) => {
  const dx = Math.cos(angleDegrees * Math.PI / 180) * 200, dy = Math.sin(angleDegrees * Math.PI / 180) * 200;
  return [path("h", [[0, 100], [200, 100]]), path("d", [[100 - dx, 100 - dy], [100 + dx, 100 + dy]])];
};
const pieceEnds = (pieces: readonly { source: number; points: readonly (readonly [number, number])[] }[], source: number) =>
  pieces.filter((piece) => piece.source === source).map((piece) => [piece.points[0][0], piece.points[piece.points.length - 1][0]]);

test("the gap in the under strand is (upper + lower) / (2 sin angle) + clearance each side, measured on the strand", () => {
  for (const [angle, expected] of [[90, 6], [30, 11], [60, 10 / (2 * Math.sin(Math.PI / 3)) + 1]] as const) {
    const set = findCrossings(crossPair(angle)), order = orderCrossings(set, { rule: "rank", seed: 1 });
    const strands = strandPieces(set, order, { widths: [4, 6], clearance: 1 });
    // Path "d" has the higher rank and is over; "h" (width 4) is cut. Its two pieces end `expected` either side of x = 100.
    const ends = pieceEnds(strands.pieces, 0).sort((a, b) => a[0] - b[0]);
    assert.equal(ends.length, 2);
    near(ends[0][1], 100 - expected, 0.05); near(ends[1][0], 100 + expected, 0.05);
    near(ends[0][0], 0, 1e-9); near(ends[1][1], 200, 1e-9);
    assert.equal(strands.pieces.filter((piece) => piece.source === 1).length, 1, "the over strand is whole");
    near(crossingHalfGap(6, 4, Math.sin(angle * Math.PI / 180), 1), expected, 1e-9);
  }
});

test("a narrower angle than minAngle is left unwoven and listed; zero width hides a strand and its gaps", () => {
  const set = findCrossings(crossPair(10)), order = orderCrossings(set, { rule: "rank", seed: 1 });
  const woven = strandPieces(set, order, { widths: [4, 4], clearance: 1 });
  assert.equal(woven.pieces.length, 3);
  const flat = strandPieces(set, order, { widths: [4, 4], clearance: 1, minAngle: 20 });
  assert.equal(flat.pieces.length, 2);
  assert.deepEqual([...flat.flat], [set.crossings[0].id]);
  assert.equal(flat.gaps.length, 0);
  const hidden = strandPieces(findCrossings(crossPair(90)), orderCrossings(findCrossings(crossPair(90)), { rule: "rank", seed: 1 }), { widths: [4, 0], clearance: 1 });
  assert.equal(hidden.pieces.length, 1, "the hidden strand is not drawn and cuts nothing");
  assert.equal(hidden.pieces[0].source, 0);
  assert.equal(hidden.pieces[0].points.length, 2);
});

test("widths that cannot fit between crossings merge their gaps and say so; wider spacing reports nothing", () => {
  const under = path("under", [[0, 100], [300, 100]]);
  const at = (x: number) => path(`over${x}`, [[x, 0], [x, 200]]);
  for (const [second, pieces, merged] of [[110, 2, 1], [130, 3, 0]] as const) {
    const set = findCrossings([under, at(100), at(second)]);
    const order = orderCrossings(set, { rule: "rank", seed: 1, ranks: [0, 1, 1] });
    const strands = strandPieces(set, order, { widths: [6, 6, 6], clearance: 1 });
    assert.equal(strands.pieces.filter((piece) => piece.source === 0).length, pieces);
    assert.equal(strands.conflicts.filter((c) => c.kind === "merged").length, merged);
  }
  const end = findCrossings([path("u", [[0, 100], [300, 100]]), at(4)]);
  const trimmed = strandPieces(end, orderCrossings(end, { rule: "rank", seed: 1 }), { widths: [6, 6], clearance: 1 });
  assert.deepEqual(trimmed.conflicts.map((c) => c.kind), ["end"], "a gap running off the strand's end shortens it");
  assert.equal(trimmed.pieces.filter((piece) => piece.source === 0).length, 1);
});

test("cutting keeps every length: pieces plus the union of the gaps make up the path, across the closing seam too", () => {
  const ring = circle("ring", 300, 300, 100, 120);
  // A chord through the centre meets the ring exactly at its first vertex and its opposite vertex.
  const set = findCrossings([ring, path("chord", [[150, 300], [450, 300]])]);
  assert.equal(set.crossings.length, 2);
  assert.ok(set.crossings.every((c) => c.kind === "vertex"));
  const order = orderCrossings(set, { rule: "rank", seed: 1, ranks: [0, 1] });
  const strands = strandPieces(set, order, { widths: [8, 8], clearance: 2 });
  const measure = (points: readonly (readonly [number, number])[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
  const half = crossingHalfGap(8, 8, 1, 2);
  const pieces = strands.pieces.filter((piece) => piece.source === 0);
  assert.equal(pieces.length, 2);
  near(pieces.reduce((sum, piece) => sum + measure(piece.points), 0), set.lengths[0] - 4 * half, 0.05);
  assert.ok(pieces.every((piece) => !piece.closed));
  for (const piece of strands.pieces) assert.ok(Object.isFrozen(piece) && Object.isFrozen(piece.points));
  // A closed strand nothing passes over is one closed piece with its own points.
  const alone = strandPieces(set, order, { widths: [8, 8], clearance: 2 }).pieces.filter((piece) => piece.source === 1);
  assert.equal(alone.length, 1);
  const lone = findCrossings([ring]);
  const whole = strandPieces(lone, orderCrossings(lone, { rule: "alternate", seed: 1 }), { widths: [8], clearance: 2 }).pieces;
  assert.equal(whole.length, 1);
  assert.equal(whole[0].closed, true);
  assert.equal(whole[0].points.length, 120);
});

test("cutPath and retainedSegments delete exactly the stated travel intervals, in any order", () => {
  const line: P[] = [[0, 0], [10, 0], [10, 10]];
  const distance = [0, 10, 20];
  assert.deepEqual(retainedSegments(line, distance, [[4, 6]]), [[0, 0, 4, 0], [6, 0, 10, 0], [10, 0, 10, 10]]);
  assert.deepEqual(retainedSegments(line, distance, [[12, 15], [4, 6]]), retainedSegments(line, distance, [[4, 6], [12, 15]]));
  assert.deepEqual(retainedSegments(line, distance, [[8, 12]]), [[0, 0, 8, 0], [10, 2, 10, 10]]);
  const cut = cutPath(line, false, [[8, 12]]);
  assert.deepEqual(cut.pieces.map((piece) => piece.points), [[[0, 0], [8, 0]], [[10, 2], [10, 10]]]);
  near(cut.pieces[1].start, 12);
  const square: P[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const wrapped = cutPath(square, true, [[-2, 2]]);
  assert.equal(wrapped.length, 40);
  assert.deepEqual(wrapped.pieces.map((piece) => piece.points), [[[2, 0], [10, 0], [10, 10], [0, 10], [0, 2]]]);
  const seam = cutPath(square, true, [[19, 21]]);
  assert.deepEqual(seam.pieces.map((piece) => piece.points), [[[9, 10], [0, 10], [0, 0], [10, 0], [10, 9]]], "the parts either side of an interior gap are one piece around the closing edge");
  assert.equal(cutPath(square, true, [[0, 40]]).pieces.length, 0, "a closed strand can be consumed");
});

test("strand ends are the free ends only, turned outward, and omitted where the strand is cut", () => {
  const set = findCrossings([path("a", [[0, 100], [200, 100]]), path("b", [[100, 0], [100, 200]]), circle("ring", 400, 300, 40)]);
  const order = orderCrossings(set, { rule: "rank", seed: 1, ranks: [0, 1, 2] });
  const strands = strandPieces(set, order, { widths: [4, 4, 4], clearance: 1 });
  const ends = strandEnds(set, strands, 10);
  assert.deepEqual(ends.map((e) => e.id), ["a:end0", "a:end1", "b:end0", "b:end1"]);
  near(ends[0].position[0], 10, 1e-9); near(ends[1].position[0], 190, 1e-9);
  near(Math.abs(ends[0].angle), Math.PI, 1e-9); near(ends[1].angle, 0, 1e-9);
  near(ends[2].position[1], 10, 1e-9); near(ends[2].angle, -Math.PI / 2, 1e-9);
  assert.equal(strandEnds(set, strands, 95).length, 4);
  assert.equal(strandEnds(set, strands, 100).length, 0, "a strand shorter than twice the trim has no ends");
});

/* ------------------------------------------------------ the instrument */

const instrument = (params: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput => {
  const input = createInstrument("crossing-lace"); input.seed = seed; Object.assign(input.params, params); return validateInstrument(input);
};
const recipe = (params: Record<string, number | string | boolean> = {}, seed = 42) => crossingLaceComposition(instrument(params, seed));

test("appearance edits reuse the crossing table and order and only recut pieces; structural edits replace them", () => {
  const base = crossingLaceProducts(recipe());
  for (const params of [{ style: "ink" }, { style: "stitch", spacing: 12 }, { coloring: "families", colorA: 3 }, { casing: 3 }, { terminal: "none", overlay: "numbers" }, { overlay: "near" }]) {
    const next = crossingLaceProducts(recipe(params));
    assert.equal(next.paths, base.paths, JSON.stringify(params));
    assert.equal(next.set, base.set);
    assert.equal(next.order, base.order);
  }
  const wide = crossingLaceProducts(recipe({ widthA: 17, widthB: 17, clearance: 5 }));
  assert.equal(wide.set, base.set);
  assert.equal(wide.order, base.order);
  assert.notEqual(wide.strands, base.strands, "a wider stroke needs wider gaps");
  assert.deepEqual(wide.set.crossings.map((c) => c.id), base.set.crossings.map((c) => c.id));
  assert.ok(wide.strands.gaps.every((gap, i) => gap.to - gap.from > base.strands.gaps[i].to - base.strands.gaps[i].from));
  // Rule, invert and exceptions change the order only.
  for (const params of [{ rule: "seeded" }, { invert: true }, { exceptions: "1, 2" }]) {
    const next = crossingLaceProducts(recipe(params));
    assert.equal(next.set, base.set);
    assert.notDeepEqual([...next.order.over], [...base.order.over], JSON.stringify(params));
  }
  // (Recent constructions are kept in a small LRU, so compare the structural edits last.)
  for (const params of [{ columns: 7 }, { rows: 5 }, { smoothing: 1 }, { width: 500 }, { rotation: 10 }, { family: "knot" }, { blocked: 0.3 }]) {
    assert.notEqual(crossingLaceProducts(recipe(params)).set, base.set, JSON.stringify(params));
  }
});

test("the seed changes structure exactly where the construction reads it", () => {
  const shape = (kind: string, extra: Record<string, number> = {}) => ({ kind, ...extra }) as LaceShape;
  const knot = shape("knot", { strands: 3, twists: 3, depth: 0.4, detail: 30 });
  assert.equal(lace(knot, 0, 1), lace(knot, 0, 2), "a braid closure has no seed");
  const plait = shape("celtic", { columns: 5, rows: 4, breaks: 0 });
  assert.equal(lace(plait, 0, 1), lace(plait, 0, 2), "an unblocked plait has no seed");
  const blocked = shape("celtic", { columns: 5, rows: 4, breaks: 0.3 });
  assert.notDeepEqual(lace(blocked, 0, 1).map((p) => p.points), lace(blocked, 0, 2).map((p) => p.points));
  const loops = (count: number, openShare: number, seed = 3) => lace(shape("loops", { count, reach: 1.2, wobble: 0.4, openShare }), 0, seed);
  assert.notDeepEqual(loops(8, 0.3, 1).map((p) => p.points), loops(8, 0.3, 2).map((p) => p.points));
  // Raising the count adds loops without moving the others; raising the open share only opens more.
  loops(6, 0.3).forEach((p, i) => assert.deepEqual(p.points, loops(9, 0.3)[i].points));
  const few = loops(9, 0.2), many = loops(9, 0.5);
  few.forEach((p, i) => { if (!p.closed) { assert.equal(many[i].closed, false); assert.deepEqual(many[i].points, p.points); } else if (many[i].closed) assert.deepEqual(many[i].points, p.points); });
  assert.ok(many.filter((p) => !p.closed).length >= few.filter((p) => !p.closed).length);
});

test("usesSeed follows what the seed can actually change", () => {
  const drawings = (params: Record<string, number | string | boolean>) => new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => drawFingerprint(instrument(params, seed)))).size;
  // Three rings (T(3,3)) ranked by path order: no equal ranks, so nothing reads the seed.
  const rings = { family: "knot", strands: 3, twists: 3, rule: "rank", rankBy: "order" };
  assert.equal(usesSeed(instrument(rings)), false);
  assert.equal(drawings(rings), 1);
  // One braid strand crosses itself, so equal ranks are decided by a seeded coin.
  const one = { family: "knot", strands: 2, twists: 5, rule: "rank", rankBy: "order" };
  assert.equal(usesSeed(instrument(one)), true);
  assert.ok(drawings(one) > 1);
  for (const params of [{ family: "knot", strands: 2, twists: 3 }, { family: "loops" }, { family: "contours" }, { family: "celtic", blocked: 0 }, { family: "celtic", rule: "seeded" }]) {
    assert.equal(usesSeed(instrument(params)), true, JSON.stringify(params));
    assert.ok(drawings(params) > 1, JSON.stringify(params));
  }
});

test("work is bounded before it is built, with the control to change named", () => {
  const input = instrument();
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, family: "celtic", columns: 24, rows: 24, smoothing: 5 } }), /Corner cuts/);
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, family: "loops", loops: 24, smoothing: 5 } }), /Corner cuts/);
  assert.throws(() => lace({ kind: "loops", count: 24, reach: 1, wobble: 0.3, openShare: 0 }, 5), /Corner cuts/);
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, exceptions: "1, x" } }), /Exceptions/);
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, style: "cased", casing: 4, widthA: 6, widthB: 6 } }), /Casing/);
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, family: "contours", field: "waves", fieldB: "waves", ratio: 1 } }), /unseeded/);
  assert.throws(() => crossingLaceProducts(recipe({ exceptions: "9999" })), /crossing 9999 does not exist/);
  const big = Array.from({ length: 70 }, (_, i) => path(`q${i}`, Array.from({ length: 1000 }, (_, k) => [k, i] as P)));
  assert.throws(() => findCrossings(big), new RegExp(`more than ${CROSSING_LIMITS.segments} vertices`));
});

class Log implements CompositionSurface {
  CLOSE = "close"; ROUND = "round"; calls: string[] = [];
  #note(name: string, args: unknown[]) { this.calls.push(JSON.stringify([name, ...args])); }
  push() { this.#note("push", []); } pop() { this.#note("pop", []); }
  translate(x: number, y: number) { this.#note("translate", [x, y]); } rotate(r: number) { this.#note("rotate", [r]); } scale(x: number, y?: number) { this.#note("scale", [x, y]); }
  noFill() { this.#note("noFill", []); } noStroke() { this.#note("noStroke", []); }
  fill(...c: number[]) { this.#note("fill", c); } stroke(...c: number[]) { this.#note("stroke", c); }
  strokeWeight(w: number) { this.#note("strokeWeight", [w]); } strokeCap(c: unknown) { this.#note("strokeCap", [c]); }
  circle(x: number, y: number, d: number) { this.#note("circle", [x, y, d]); } line(a: number, b: number, c: number, d: number) { this.#note("line", [a, b, c, d]); }
  rect(a: number, b: number, c: number, d: number) { this.#note("rect", [a, b, c, d]); }
  beginShape() { this.#note("beginShape", []); } vertex(x: number, y: number) { this.#note("vertex", [x, y]); } endShape(m?: unknown) { this.#note("endShape", [m]); }
}

test("overlays draw after the lace and never disturb it; a replaced strand material sees the cached pieces", () => {
  const plain = new Log(); drawCrossingLace(plain, recipe({ overlay: "none" }));
  for (const overlay of ["numbers", "breaks", "near"]) {
    const marked = new Log(); drawCrossingLace(marked, recipe({ overlay }));
    assert.deepEqual(marked.calls.slice(0, plain.calls.length), plain.calls, overlay);
  }
  const numbers = new Log(); drawCrossingLace(numbers, recipe({ overlay: "numbers" }));
  assert.ok(numbers.calls.length > plain.calls.length);
  const seen: Path[] = [];
  const products = crossingLaceProducts(recipe());
  drawCrossingLace(new Log(), recipe(), { strand: (surface, piece) => { seen.push(piece); } });
  assert.equal(seen.length, products.strands.pieces.length);
  seen.forEach((piece, i) => assert.equal(piece, products.strands.pieces[i]));
  const hidden = new Log(); drawCrossingLace(hidden, recipe({ widthA: 0, widthB: 0 }));
  assert.equal(hidden.calls.filter((c) => c.startsWith('["endShape"')).length, 0, "nothing is drawn when both families have zero width");
});

test("exceptions are 1-based crossing numbers in table order, and the numbers overlay labels each crossing with its own", () => {
  // 4 x 3 plait: 17 interior edges, round(0.41 x 17) = 7 blocked, so 10 crossings numbered 1..10.
  const plait = { family: "celtic", columns: 4, rows: 3, blocked: 0.41, rule: "alternate" };
  const base = crossingLaceProducts(recipe(plait));
  assert.equal(base.set.crossings.length, 10);
  const flipped = crossingLaceProducts(recipe({ ...plait, exceptions: "1, 5-6, 10" }));
  assert.deepEqual([...flipped.order.flipped], [0, 4, 5, 9]);
  base.set.crossings.forEach((_, i) => assert.equal(flipped.order.over[i] !== base.order.over[i], [0, 4, 5, 9].includes(i)));
  // Each crossing is labelled with the digits of its own number: strokes per digit of the drawn font, 0..9.
  const strokes = [4, 2, 5, 4, 3, 5, 5, 2, 5, 5];
  const expected = base.set.crossings.reduce((sum, _, i) => sum + [...String(i + 1)].reduce((inner, digit) => inner + strokes[Number(digit)], 0), 0);
  assert.equal(expected, 42);
  const lines = (overlay: string) => { const log = new Log(); drawCrossingLace(log, recipe({ ...plait, overlay })); return log.calls.filter((c) => c.startsWith('["line"')).length; };
  assert.equal(lines("numbers") - lines("none"), 2 * expected, "each label is drawn twice: halo, then ink");
});

test("drawing through the public instrument entry equals drawing the composition", () => {
  const input = instrument({ family: "loops", openShare: 0.4, terminal: "dot", trim: 3 }, 9);
  const direct = new Log(); drawCrossingLace(direct, crossingLaceComposition(input));
  const viaInstrument = new Log(); drawInstrument(viaInstrument as unknown as Parameters<typeof drawInstrument>[0], input);
  assert.deepEqual(viaInstrument.calls, direct.calls);
});

test("a crossing's strands, tangents and sine are consistent with their geometry", () => {
  const set = findCrossings(lace({ kind: "celtic", columns: 5, rows: 4, breaks: 0 }, 2));
  for (const crossing of set.crossings as readonly Crossing[]) {
    // 45-degree plait strands meet at right angles.
    near(crossing.sine, 1, 1e-3);
    for (const side of [crossing.first, crossing.second]) {
      near(Math.hypot(side.tangent[0], side.tangent[1]), 1, 1e-9);
      const points = set.paths[side.path].points, a = points[side.segment], b = points[(side.segment + 1) % points.length];
      const x = a[0] + (b[0] - a[0]) * side.t, y = a[1] + (b[1] - a[1]) * side.t;
      near(Math.hypot(x - crossing.point[0], y - crossing.point[1]), 0, 1e-6);
    }
  }
});
