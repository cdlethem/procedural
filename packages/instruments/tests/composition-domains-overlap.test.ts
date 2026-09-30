import assert from "node:assert/strict";
import test from "node:test";
import { domainDifference, domainIntersection, planarRegion, regionInside, regionsOverlap, shapeCovers, shapesOverlap, unionDomains, type PlanarRegion } from "../dist/index.js";

type P = [number, number];
const rect = (x: number, y: number, w: number, h: number): P[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const box = (x: number, y: number, w: number, h = w): PlanarRegion => planarRegion({ outer: rect(x, y, w, h) });
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const overlapByBoolean = (a: PlanarRegion, b: PlanarRegion): boolean => domainIntersection(a, b).regions.length > 0;
const insideByBoolean = (outer: PlanarRegion, inner: PlanarRegion): boolean => domainDifference(inner, outer).regions.length === 0;

test("regions overlap only when their interiors share area: touching is not overlap", () => {
  const a = box(0, 0, 10);
  assert.equal(regionsOverlap(a, box(10, 0, 10)), false, "shared edge");
  assert.equal(regionsOverlap(a, box(10, 10, 5)), false, "shared corner");
  assert.equal(regionsOverlap(a, box(10, 3, 4, 2)), false, "edge contact of a shorter box");
  assert.equal(regionsOverlap(a, box(9, 9, 5)), true, "one unit of area");
  assert.equal(regionsOverlap(a, a), true, "identical regions coincide on every edge");
  assert.equal(regionsOverlap(a, box(2, 2, 3)), true, "strictly nested");
  assert.equal(regionsOverlap(a, box(0, 0, 10, 4)), true, "sharing three collinear edges");
  // A diamond whose four vertices sit on the square's edge midpoints: no proper crossing, no vertex strictly inside.
  const diamond = planarRegion({ outer: [[5, 0], [10, 5], [5, 10], [0, 5]] });
  assert.equal(regionsOverlap(a, diamond), true, "inscribed diamond overlaps though all contacts are degenerate");
  assert.equal(regionsOverlap(box(20, 20, 4), diamond), false);
});

test("holes are free space: a piece inside a counter does not overlap, one touching the counter's wall still does not, one crossing it does", () => {
  const frame = planarRegion({ outer: rect(0, 0, 20, 20), holes: [rect(5, 5, 10, 10)] });
  assert.equal(regionsOverlap(frame, box(7, 7, 6)), false, "inside the hole");
  assert.equal(regionsOverlap(frame, box(5, 5, 10)), false, "exactly filling the hole touches only its wall");
  assert.equal(regionsOverlap(frame, box(4, 7, 6)), true, "crossing the hole's wall");
  assert.equal(regionsOverlap(frame, box(7, 7, 20)), true, "hole boundary crossed by a large box");
  assert.equal(regionsOverlap(box(6, 6, 8), frame), false, "symmetric");
  // Bounding boxes overlap in every one of these; only the exact test tells them apart.
});

test("two L shapes interlock: boxes overlap, interiors do not, and a 1-unit nudge makes them overlap", () => {
  const L = (dx: number, dy: number, turn: boolean): PlanarRegion => planarRegion({ outer: (turn
    ? [[3, 3], [0, 3], [0, 0], [1, 0], [1, 2], [3, 2]]
    : [[0, 0], [1, 0], [1, 2], [3, 2], [3, 3], [0, 3]]).map(([x, y]): P => [x + dx, y + dy]) });
  const a = L(0, 0, false), b = L(1, -1, true);
  // a is a vertical bar with a foot to the right; b hooks over it.
  assert.equal(overlapByBoolean(a, b), regionsOverlap(a, b));
  const shifted = L(1, -1.5, true);
  assert.equal(regionsOverlap(a, shifted), overlapByBoolean(a, shifted));
  assert.ok(regionsOverlap(a, L(0.5, 0, true)), "sliding one notch into the other overlaps");
});

test("the fast path agrees with the Boolean on random regions, including grid-aligned contacts", () => {
  const r = rng(11);
  const int = (n: number): number => Math.floor(r() * n);
  function random(): PlanarRegion {
    const x = int(9), y = int(9), kind = int(5), w = 2 + int(6), h = 2 + int(6);
    if (kind === 0) return box(x, y, w, h);
    if (kind === 1) return planarRegion({ outer: [[x, y], [x + w, y], [x, y + h]] });
    if (kind === 2) { const e = 2 * (1 + int(3)); return planarRegion({ outer: [[x + e, y], [x + 2 * e, y + e], [x + e, y + 2 * e], [x, y + e]] }); }
    if (kind === 3) return planarRegion({ outer: [[x, y], [x + w, y], [x + w, y + 1], [x + 1, y + 1], [x + 1, y + h], [x, y + h]] });
    const W = 4 + int(4), H = 4 + int(4);
    return planarRegion({ outer: rect(x, y, W, H), holes: [rect(x + 1 + int(W - 3), y + 1 + int(H - 3), 1, 1)] });
  }
  let overlaps = 0, touches = 0;
  for (let i = 0; i < 4000; i++) {
    const a = random(), b = random();
    const expected = overlapByBoolean(a, b);
    assert.equal(regionsOverlap(a, b), expected, `pair ${i} ${JSON.stringify(a.outer)} vs ${JSON.stringify(b.outer)}`);
    assert.equal(regionsOverlap(b, a), expected, "symmetric");
    if (expected) overlaps++; else if (domainIntersection(a, b).regions.length === 0 && a.bounds[0] <= b.bounds[2] && b.bounds[0] <= a.bounds[2] && a.bounds[1] <= b.bounds[3] && b.bounds[1] <= a.bounds[3]) touches++;
  }
  assert.ok(overlaps > 500 && touches > 200, `the sample must contain both outcomes (${overlaps} overlapping, ${touches} disjoint with overlapping boxes)`);
});

test("regionInside agrees with the Boolean difference, and closed containment allows touching the boundary", () => {
  const container = planarRegion({ outer: rect(0, 0, 20, 20), holes: [rect(8, 8, 4, 4)] });
  assert.equal(regionInside(container, box(1, 1, 5)), true);
  assert.equal(regionInside(container, box(0, 0, 5)), true, "touching the corner of the outer ring");
  assert.equal(regionInside(container, box(8, 0, 4, 8)), true, "resting on the hole's wall");
  assert.equal(regionInside(container, box(-1, 1, 5)), false, "sticking out");
  assert.equal(regionInside(container, box(7, 7, 6)), false, "the hole pokes into it");
  assert.equal(regionInside(container, box(9, 9, 2)), false, "inside the container's hole");
  assert.equal(regionInside(container, planarRegion({ outer: [[10, 0], [20, 10], [10, 20], [0, 10]] })), false, "a diamond lying across the hole");
  assert.equal(shapeCovers(container, box(1, 1, 5)), true);
  assert.equal(shapeCovers(box(0, 0, 10), unionDomains([box(0, 0, 4), box(4, 4, 6)])), true, "every region of a domain");
  assert.equal(shapeCovers(box(0, 0, 10), unionDomains([box(0, 0, 4), box(8, 8, 4)])), false);
  const r = rng(5), int = (n: number): number => Math.floor(r() * n);
  let yes = 0;
  for (let i = 0; i < 1500; i++) {
    const outer = planarRegion({ outer: rect(int(3), int(3), 8 + int(6), 8 + int(6)), holes: r() < 0.5 ? [rect(3 + int(3), 3 + int(3), 1 + int(2), 1 + int(2))] : [] });
    const inner = r() < 0.5 ? box(int(12), int(12), 1 + int(5), 1 + int(5)) : (() => { const x = int(10), y = int(10); return planarRegion({ outer: [[x, y], [x + 1 + int(5), y], [x, y + 1 + int(5)]] }); })();
    const expected = insideByBoolean(outer, inner);
    assert.equal(regionInside(outer, inner), expected, `case ${i}`);
    if (expected) yes++;
  }
  assert.ok(yes > 100 && yes < 1400, `both outcomes occur (${yes} contained)`);
});

test("shape-level wrappers accept regions and domains and give the same answers", () => {
  const a = unionDomains([box(0, 0, 4), box(10, 0, 4)]);
  assert.equal(shapesOverlap(a, box(3, 1, 8)), true);
  assert.equal(shapesOverlap(a, box(4, 0, 6)), false, "fits exactly between the two, touching both");
  assert.equal(shapesOverlap(a, box(4, 0, 6.5)), true);
});
