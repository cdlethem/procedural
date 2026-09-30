import assert from "node:assert/strict";
import test from "node:test";
import {
  GLYPH_PACKING_LIMITS, bundledContainerIds, bundledSymbol, bundledVocabulary, canPrepareInstrument, containerSilhouette, createInstrument, definition,
  domainIntersection, domainRings, drawGlyphPacking, drawInstrument, flatRing, footprintOf, glyphPackingComposition, glyphPackingProducts, glyphVocabulary,
  instanceInk, locateInDomain, locateInFlatRing, negativeSpace, noNegativeSpace, packGlyphs, packedGlyphOutline, packingField, pickEntry, placeContainer,
  planDemands, planarDomain, planarRegion, prepareGlyphPacking, regionsContact, ringWithin, ringsContact, segmentsContact, symbolSource, usesSeed, validateInstrument,
  validatePack, wordSource, CAP_HEIGHT,
  type CompositionSurface, type GlyphInstance, type GlyphPacking, type PackOptions, type PlanarDomain,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const deepFrozen = (value: unknown): boolean =>
  value === null || typeof value !== "object" || ArrayBuffer.isView(value) || (Object.isFrozen(value) && Object.values(value as object).every(deepFrozen));

/** Deterministic pseudo-random stream for the tests' own data. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

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

// --- independent exact arithmetic: BigInt on the dyadic coordinates, classical sign-based segment tests ---------------------------
const SCALE = 2 ** 40;
const big = (v: number): bigint => BigInt(Math.round(v * SCALE));
type BP = [bigint, bigint];
const bp = (p: readonly number[]): BP => [big(p[0]), big(p[1])];
const sign = (x: bigint) => (x > 0n ? 1 : x < 0n ? -1 : 0);
const orientB = (a: BP, b: BP, c: BP) => sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const minB = (a: bigint, b: bigint) => (a < b ? a : b), maxB = (a: bigint, b: bigint) => (a > b ? a : b);
const onSegment = (a: BP, b: BP, p: BP) => orientB(a, b, p) === 0 && p[0] >= minB(a[0], b[0]) && p[0] <= maxB(a[0], b[0]) && p[1] >= minB(a[1], b[1]) && p[1] <= maxB(a[1], b[1]);
function contactB(a: BP, b: BP, c: BP, d: BP): boolean {
  const o1 = orientB(a, b, c), o2 = orientB(a, b, d), o3 = orientB(c, d, a), o4 = orientB(c, d, b);
  return (o1 * o2 < 0 && o3 * o4 < 0) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

test("segment contact equals a BigInt evaluation on dyadic points, including touches, collinear runs and 2^-40 nudges", () => {
  const random = stream(7);
  const coordinate = () => Math.floor(random() * 9) / 8 + (Math.floor(random() * 3) - 1) * 2 ** -40 * (random() < 0.5 ? 0 : 1);
  let contacts = 0, collinearContacts = 0;
  for (let i = 0; i < 30_000; i++) {
    const p = Array.from({ length: 8 }, coordinate);
    const expected = contactB(bp(p.slice(0, 2)), bp(p.slice(2, 4)), bp(p.slice(4, 6)), bp(p.slice(6, 8)));
    assert.equal(segmentsContact(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]), expected, JSON.stringify(p));
    if (expected) { contacts++; if (orientB(bp(p.slice(0, 2)), bp(p.slice(2, 4)), bp(p.slice(4, 6))) === 0 && orientB(bp(p.slice(0, 2)), bp(p.slice(2, 4)), bp(p.slice(6, 8))) === 0) collinearContacts++; }
  }
  // Collinear pairs at dyadic positions along one line: overlapping, abutting and separate runs.
  for (let i = 0; i < 4000; i++) {
    const a: [number, number] = [Math.floor(random() * 5) / 4, Math.floor(random() * 5) / 4], b: [number, number] = [Math.floor(random() * 5) / 4, Math.floor(random() * 5) / 4];
    const at = (t: number): [number, number] => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const t = Array.from({ length: 2 }, () => (Math.floor(random() * 17) - 4) / 4);
    const c = at(t[0]), d = at(t[1]);
    const expected = contactB(bp(a), bp(b), bp(c), bp(d));
    assert.equal(segmentsContact(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]), expected, JSON.stringify([a, b, c, d]));
    if (expected) collinearContacts++;
  }
  assert.ok(contacts > 3000 && collinearContacts > 800, `the sample exercises touches (${contacts}) and collinear overlaps (${collinearContacts})`);
});

test("ring contact filters edges by box but decides like the all-pairs BigInt test; point location equals the kernel's", () => {
  const random = stream(11);
  const ring = (n: number, spread: number, dx: number, dy: number): [number, number][] =>
    Array.from({ length: n }, () => [dx + Math.floor(random() * 33) / 4 * spread, dy + Math.floor(random() * 33) / 4 * spread]);
  let touching = 0;
  for (let i = 0; i < 4000; i++) {
    const a = ring(3 + Math.floor(random() * 7), 1, 0, 0), b = ring(3 + Math.floor(random() * 7), 1, Math.floor(random() * 6), Math.floor(random() * 6));
    let expected = false;
    for (let s = 0; s < a.length && !expected; s++) for (let t = 0; t < b.length; t++)
      if (contactB(bp(a[s]), bp(a[(s + 1) % a.length]), bp(b[t]), bp(b[(t + 1) % b.length]))) { expected = true; break; }
    assert.equal(ringsContact(flatRing(a), flatRing(b)), expected);
    if (expected) touching++;
  }
  assert.ok(touching > 500 && touching < 3500);
  // Point location against the kernel on star-shaped polygons with integer vertices and grid points (many exactly on edges).
  let compared = 0, onBoundary = 0;
  for (let i = 0; i < 300; i++) {
    const n = 5 + Math.floor(random() * 4);
    const points: [number, number][] = Array.from({ length: n }, (_, k) => {
      const r = 8 + Math.floor(random() * 14), t = 2 * Math.PI * k / n;
      return [Math.round(20 + r * Math.cos(t)), Math.round(20 + r * Math.sin(t))];
    });
    let region;
    try { region = planarRegion({ outer: points }); } catch { continue; }
    const flat = flatRing(region.outer);
    for (let y = 0; y <= 40; y += 0.5) for (let x = 0; x <= 40; x += 0.5) {
      const at = locateInDomain(region, x, y);
      assert.equal(locateInFlatRing(flat, x, y), at === "inside" ? 1 : at === "boundary" ? 0 : -1, `${JSON.stringify(points)} at ${x},${y}`);
      compared++; if (at === "boundary") onBoundary++;
    }
  }
  assert.ok(compared > 1_000_000 && onBoundary > 1000);
});

test("a ring is within a shape only strictly inside it: every axis-aligned rectangle against a square with a square hole", () => {
  const domain = planarDomain(planarRegion({ outer: [[0, 0], [100, 0], [100, 100], [0, 100]], holes: [[[40, 40], [60, 40], [60, 60], [40, 60]]] }));
  const marks = [-20, 0, 10, 20, 30, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120];
  let within = 0, total = 0, enclosing = 0, inHole = 0, touching = 0;
  for (const x0 of marks) for (const x1 of marks) for (const y0 of marks) for (const y1 of marks) {
    if (!(x0 < x1 && y0 < y1)) continue;
    const strictlyInOuter = x0 > 0 && x1 < 100 && y0 > 0 && y1 < 100;
    const clearOfHole = x1 < 40 || x0 > 60 || y1 < 40 || y0 > 60;
    const expected = strictlyInOuter && clearOfHole;
    const got = ringWithin(domain, flatRing([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]));
    assert.equal(got, expected, `[${x0},${y0}]–[${x1},${y1}]`);
    total++; if (got) within++;
    if (strictlyInOuter && x0 < 40 && x1 > 60 && y0 < 40 && y1 > 60) enclosing++;
    if (strictlyInOuter && x0 > 40 && x1 < 60 && y0 > 40 && y1 < 60) inHole++;
    if ((x0 === 40 || x1 === 40 || x0 === 60 || x1 === 60) && strictlyInOuter && !clearOfHole) touching++;
  }
  assert.ok(within > 100 && enclosing > 0 && inHole > 0 && touching > 10, `${within}/${total} ${enclosing} ${inHole} ${touching}`);
});

test("region contact: rectangles with holes against the closed-set intersection found on the lattice", () => {
  // Rectilinear regions on a lattice of 10: if two closed regions meet at all, the meeting set has a lattice vertex, so lattice points decide it independently.
  const random = stream(23);
  type Box = [number, number, number, number];
  const rings = ([x0, y0, x1, y1]: Box) => flatRing([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const closedIn = (b: Box, x: number, y: number) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  const openIn = (b: Box, x: number, y: number) => x > b[0] && x < b[2] && y > b[1] && y < b[3];
  const make = () => {
    const x0 = Math.floor(random() * 6) * 10, y0 = Math.floor(random() * 6) * 10, w = 20 + Math.floor(random() * 9) * 10, h = 20 + Math.floor(random() * 9) * 10;
    const outer: Box = [x0, y0, x0 + w, y0 + h];
    const hole: Box | null = random() < 0.6 && w >= 30 && h >= 30 ? [x0 + 10, y0 + 10, x0 + w - 10, y0 + h - 10] : null;
    return { outer, hole };
  };
  let contacts = 0, nestedInHole = 0, containedNoTouch = 0, total = 0;
  for (let i = 0; i < 20000; i++) {
    const a = make(), b = make();
    let expected = false;
    for (let x = 0; x <= 150 && !expected; x += 10) for (let y = 0; y <= 150; y += 10) {
      const inA = closedIn(a.outer, x, y) && !(a.hole && openIn(a.hole, x, y)), inB = closedIn(b.outer, x, y) && !(b.hole && openIn(b.hole, x, y));
      if (inA && inB) { expected = true; break; }
    }
    const fa = { outer: rings(a.outer), holes: a.hole ? [rings(a.hole)] : [] }, fb = { outer: rings(b.outer), holes: b.hole ? [rings(b.hole)] : [] };
    assert.equal(regionsContact(fa, fb), expected, JSON.stringify([a, b]));
    assert.equal(regionsContact(fb, fa), expected, "symmetric");
    total++; if (expected) contacts++;
    if (!expected && a.hole && b.outer[0] > a.hole[0] && b.outer[2] < a.hole[2] && b.outer[1] > a.hole[1] && b.outer[3] < a.hole[3]) nestedInHole++;
    if (expected && a.outer[0] < b.outer[0] && a.outer[2] > b.outer[2] && a.outer[1] < b.outer[1] && a.outer[3] > b.outer[3] && !a.hole) containedNoTouch++;
  }
  assert.ok(contacts > 1500 && contacts < total - 1500 && containedNoTouch > 20, `${contacts}/${total} ${containedNoTouch}`);
  assert.ok(nestedInHole > 5, `${nestedInHole} regions lie inside another's hole without touching it`);
});

// --- sources, containers, footprints ---------------------------------------------------------------------------------------------
const shoelace = (ring: readonly (readonly number[])[]) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return sum / 2;
};

test("sources: cap-height words, analytic dingbat areas, counters as holes, and errors naming the text", () => {
  const h = wordSource("H");
  near(h.bounds[3] - h.bounds[1], 1, 1e-9, "the cap height is the unit of a word");
  near((h.bounds[0] + h.bounds[2]) / 2, 0, 1e-9); near((h.bounds[1] + h.bounds[3]) / 2, 0, 1e-9);
  const o = wordSource("o");
  assert.equal(o.parts.length, 1); assert.equal(o.parts[0].holes.length, 1, "the counter of an o is a hole of its part");
  assert.ok(o.area < o.solidArea);
  const two = wordSource("ii");
  assert.equal(two.parts.length, 4, "two i's: stems and dots are four pieces of ink");
  // A 32-gon of radius ½ with a 24-gon counter of radius 0.22 (already spanning 1 × 1, so unscaled).
  const ring = bundledSymbol("ring");
  near(ring.solidArea, 16 * 0.25 * Math.sin(2 * Math.PI / 32), 1e-12);
  near(ring.area, ring.solidArea - 12 * 0.22 ** 2 * Math.sin(2 * Math.PI / 24), 1e-12);
  for (const id of ["dot", "star", "cross", "arrow", "leaf", "crescent", "rosette", "bolt", "drop"] as const) {
    const s = bundledSymbol(id);
    near(Math.max(s.bounds[2] - s.bounds[0], s.bounds[3] - s.bounds[1]), 1, 1e-12, `${id}: the longer side is the unit`);
    near((s.bounds[0] + s.bounds[2]) / 2, 0, 1e-12); near((s.bounds[1] + s.bounds[3]) / 2, 0, 1e-12);
  }
  assert.throws(() => wordSource("é"), /"é"/);
  assert.throws(() => wordSource("   "), /not blank/);
  assert.throws(() => wordSource("x".repeat(21)), /1–20 printable/);
  assert.throws(() => symbolSource({ id: "bow", regions: [{ outer: [[0, 0], [2, 2], [2, 0], [0, 2]] }] }), /intersect|cross/i);
  assert.ok(deepFrozen(o) && deepFrozen(ring) && deepFrozen(bundledVocabulary("garden")));
  for (const id of ["garden", "tide", "letters", "ornaments", "words-and-ornaments"] as const)
    assert.ok(bundledVocabulary(id).entries.length >= 6, id);
});

test("footprints: solid fills counters, open keeps them, the gap grows by the round offset (a unit square grows to 1 + 4h + πh²)", () => {
  const solid = footprintOf(bundledSymbol("ring"), 0, "solid"), open = footprintOf(bundledSymbol("ring"), 0, "open");
  assert.equal(solid.raw[0].holes.length, 0); assert.equal(open.raw[0].holes.length, 1);
  near(solid.area, bundledSymbol("ring").solidArea, 1e-12); near(open.area, bundledSymbol("ring").area, 1e-12);
  assert.equal(footprintOf(bundledSymbol("ring"), 0, "solid"), solid, "footprints are cached");
  const square = symbolSource({ id: "square", regions: [{ outer: [[0, 0], [1, 0], [1, 1], [0, 1]] }] });
  const grown = footprintOf(square, 0.2, "solid");
  const h = 0.1;
  const area = grown.padded.reduce((sum, part) => sum + Math.abs(shoelace(Array.from({ length: part.outer.xy.length / 2 }, (_, i) => [part.outer.xy[2 * i], part.outer.xy[2 * i + 1]]))), 0);
  assert.ok(area <= 1 + 4 * h + Math.PI * h * h && area > 1 + 4 * h + Math.PI * h * h - 0.004, `grown area ${area}`);
  assert.equal(footprintOf(square, 0, "solid").padded, footprintOf(square, 0, "solid").raw, "a zero gap is the ink itself");
  // A counter smaller than the gap closes: the ring's counter has radius 0.22, so half gap 0.25 removes it.
  assert.equal(footprintOf(bundledSymbol("ring"), 0.5, "open").padded[0].holes.length, 0);
  assert.equal(footprintOf(bundledSymbol("ring"), 0.2, "open").padded[0].holes.length, 1);
  assert.throws(() => footprintOf(square, -1, "solid"), /gap/);
});

test("containers: analytic areas, placement, protected space, and the margin as an exact inset", () => {
  const n = 120;
  near(containerSilhouette("disc").area, n / 2 * 0.25 * Math.sin(2 * Math.PI / n), 1e-12);
  const holes = (48 / 2 * 0.15 ** 2 * Math.sin(2 * Math.PI / 48)) + (40 / 2 * 0.1 ** 2 * Math.sin(2 * Math.PI / 40)) + (56 / 2 * 0.19 ** 2 * Math.sin(2 * Math.PI / 56));
  near(containerSilhouette("slab").area, 1 * 0.72 - holes, 1e-12);
  assert.equal(containerSilhouette("slab").regions[0].holes.length, 3);
  assert.equal(containerSilhouette("archipelago").regions.length, 4);
  assert.equal(containerSilhouette("archipelago").regions.flatMap((region) => region.holes).length, 1);
  assert.equal(containerSilhouette("annulus").regions[0].holes.length, 1);
  for (const id of bundledContainerIds) {
    const [l, t, r, b] = containerSilhouette(id).bounds!;
    assert.ok(l >= -0.5 - 1e-9 && r <= 0.5 + 1e-9 && t >= -0.5 - 1e-9 && b <= 0.5 + 1e-9, `${id} fits the unit box`);
  }
  const placement = { centerX: 300, centerY: 200, width: 400, height: 200, rotation: 0 };
  const disc = placeContainer("disc", placement);
  near(disc.area, containerSilhouette("disc").area * 400 * 200, 1e-6);
  assert.deepEqual(disc.bounds!.map((v) => Math.round(v * 1e6) / 1e6), [100, 100, 500, 300]);
  const turned = placeContainer("disc", { ...placement, rotation: 37 });
  near(turned.area, disc.area, 1e-6, "rotation preserves area"); near(turned.centroid![0], 300, 1e-6); near(turned.centroid![1], 200, 1e-6);
  assert.equal(placeContainer("disc", placement), disc, "placement is cached by its construction");
  // Margin: a regular 120-gon of circumradius 200 has apothem 200·cos(π/120); insetting by m leaves a regular 120-gon of apothem a − m.
  const round = placeContainer("disc", { centerX: 0, centerY: 0, width: 400, height: 400, rotation: 0 });
  const apothem = 200 * Math.cos(Math.PI / n);
  near(packingField(round, noNegativeSpace, 10).available.area, n * (apothem - 10) ** 2 * Math.tan(Math.PI / n), 1e-3);
  assert.equal(packingField(round, noNegativeSpace, 0).available, round, "no margin and no protected space leaves the container itself");
  assert.equal(packingField(round, noNegativeSpace, 10), packingField(round, noNegativeSpace, 10));
  // A band of thickness 0.2 · 400 = 80 across the middle removes the strip |y| < 40.
  const band = negativeSpace({ kind: "band", size: 0.2, x: 0, y: 0 }, { centerX: 0, centerY: 0, width: 400, height: 400, rotation: 0 });
  const cut = packingField(round, band, 0).available;
  const strip = 2 * (40 * Math.sqrt(200 ** 2 - 40 ** 2) + 200 ** 2 * Math.asin(40 / 200));
  near(cut.area / (round.area - strip), 1, 4e-3, "disc minus a horizontal band");
  assert.equal(cut.regions.length, 2);
  assert.equal(locateInDomain(cut, 0, 0), "outside"); assert.equal(locateInDomain(cut, 0, 100), "inside");
  // The band follows the container's turn; a disc sits where its fractions say.
  const zone = negativeSpace({ kind: "disc", size: 0.5, x: 0.25, y: -0.25 }, { centerX: 100, centerY: 100, width: 200, height: 200, rotation: 90 });
  // Box fraction (0.25, −0.25) of a 200 box is (50, −50); turned by 90° clockwise on screen it lies at (50, 50) from the centre.
  near(zone.centroid![0], 150, 1e-6); near(zone.centroid![1], 150, 1e-6);
  assert.throws(() => packingField(round, noNegativeSpace, -1), /Margin/);
  assert.throws(() => placeContainer("disc", { ...placement, width: 0 }), /width/);
  assert.throws(() => containerSilhouette("blob" as never), /Unknown container/);
});

// --- planning ----------------------------------------------------------------------------------------------------------------------
const dots = glyphVocabulary({ id: "dots", entries: [{ source: bundledSymbol("dot") }] });
const dotArea = bundledSymbol("dot").solidArea;
const plan = (over: Partial<PackOptions> = {}, area = 200_000) => planDemands(area, { seed: 1, vocabulary: dots, coverage: 0.4, largest: 40, smallest: 5, falloff: 2, hierarchy: 0, counters: "solid", ...over });

test("the plan is a ranked power-law schedule whose demanded area is the requested coverage", () => {
  const demands = plan();
  assert.equal(demands[0].size, 40);
  for (let i = 1; i < demands.length; i++) assert.ok(demands[i].size <= demands[i - 1].size, "ranked large to small");
  assert.ok(demands[demands.length - 1].size >= 5 && demands.every((d, j) => d.id === `d${j}` && d.index === j));
  const total = demands.reduce((sum, d) => sum + dotArea * d.size * d.size, 0);
  assert.ok(total >= 0.4 * 200_000 && total < 0.4 * 200_000 * 1.02, `demanded area ${total}`);
  // D = 2 gives every octave of size the same area: [5,10), [10,20), [20,40].
  const octave = (lo: number, hi: number) => demands.filter((d) => d.size >= lo && d.size < hi).reduce((sum, d) => sum + d.size * d.size, 0);
  const areas = [octave(5, 10), octave(10, 20), octave(20, 40.01)];
  for (const a of areas) near(a / areas[1], 1, 0.12, `octave areas ${areas}`);
  // D = 1 puts most area in large glyphs, D = 3.5 in small ones.
  const share = (falloff: number) => { const d = plan({ falloff }); const big = d.filter((x) => x.size >= 14).reduce((s, x) => s + x.size ** 2, 0); return big / d.reduce((s, x) => s + x.size ** 2, 0); };
  assert.ok(share(1) > 0.65 && share(3.5) < 0.3, `${share(1)} ${share(3.5)}`);
  // The count of glyphs larger than s is C·(s^-D − largest^-D): the ratio of counts across a halving is 2^D.
  const count = (s: number) => demands.filter((d) => d.size > s).length;
  near(count(10) / count(20), (10 ** -2 - 40 ** -2) / (20 ** -2 - 40 ** -2), 0.04 * count(10) / count(20), "count law");
  assert.deepEqual(plan(), demands);
  assert.equal(plan({ coverage: 0 }).length, 0);
  const equal = plan({ largest: 12, smallest: 12, coverage: 0.1 }, 100_000);
  assert.ok(equal.every((d) => d.size === 12));
  near(equal.length * dotArea * 144, 0.1 * 100_000, dotArea * 144, "equal sizes stop at the requested area");
});

test("hierarchy ties rank to size; frequency weights the draw", () => {
  const vocabulary = bundledVocabulary("garden");
  const meanRank = (hierarchy: number, from: number, to: number) => {
    const d = planDemands(300_000, { seed: 3, vocabulary, coverage: 0.5, largest: 40, smallest: 6, falloff: 2.4, hierarchy, counters: "solid" });
    const slice = d.slice(Math.floor(d.length * from), Math.floor(d.length * to));
    return slice.reduce((sum, x) => sum + x.entry, 0) / slice.length;
  };
  assert.ok(meanRank(1, 0.9, 1) - meanRank(1, 0, 0.1) > 4, "at full hierarchy the smallest are far down the list from the largest");
  assert.ok(Math.abs(meanRank(0, 0.9, 1) - meanRank(0, 0, 0.1)) < 1.2, "at zero hierarchy rank is independent of size");
  // Frequency: an entry with 9x the weight is drawn about 9x as often when rank does not matter.
  const two = glyphVocabulary({ id: "two", entries: [{ source: wordSource("a"), weight: 9 }, { source: wordSource("b"), weight: 1 }] });
  let a = 0;
  for (let i = 0; i < 4000; i++) if (pickEntry(two, 0, 0.5, (i + 0.5) / 4000) === 0) a++;
  near(a / 4000, 0.9, 0.005);
  assert.equal(pickEntry(two, 1, 0, 0.99), 0, "at the top of the range and full hierarchy the head is drawn");
});

test("requests beyond the bounds throw naming the controls; invalid options name the control", () => {
  const field = packingField(placeContainer("disc", { centerX: 300, centerY: 300, width: 500, height: 500, rotation: 0 }), noNegativeSpace, 0);
  const base: PackOptions = { seed: 1, vocabulary: bundledVocabulary("garden"), coverage: 0.4, largest: 40, smallest: 8, falloff: 2, gap: 0.1, counters: "solid",
    hierarchy: 0.8, retries: 20, orientation: { rule: "aligned", angle: 0, spread: 0, upright: true } };
  assert.throws(() => packGlyphs(field, { ...base, coverage: 0.9, smallest: 2, largest: 10 }), new RegExp(`more than ${GLYPH_PACKING_LIMITS.maxDemands} glyphs.*Smallest size.*Coverage`));
  assert.throws(() => packGlyphs(field, { ...base, retries: 2000 }), /Retry budget/);
  assert.throws(() => packGlyphs(field, { ...base, largest: 5, smallest: 8 }), /Largest size.*Smallest size/);
  assert.throws(() => validatePack({ ...base, gap: 3 }), /Gap/);
  assert.throws(() => validatePack({ ...base, falloff: 9 }), /Falloff/);
  assert.throws(() => validatePack({ ...base, retries: 0 }), /Retry budget/);
  assert.throws(() => validatePack({ ...base, coverage: 1 }), /Coverage/);
  assert.throws(() => validatePack({ ...base, hierarchy: 2 }), /Hierarchy/);
  assert.throws(() => validatePack({ ...base, orientation: { rule: "spiral" as never, angle: 0, spread: 0, upright: true } }), /Orientation/);
  assert.throws(() => validatePack({ ...base, counters: "half" as never }), /Counters/);
});

// --- the packing itself, checked with independent geometry -----------------------------------------------------------------------------
type XY = [number, number];
function canvasOuters(instance: GlyphInstance): XY[][] {
  const c = Math.cos(instance.angle), s = Math.sin(instance.angle), k = instance.scale;
  return instance.glyph.parts.map((part) => part.outer.map(([x, y]): XY => [instance.position[0] + k * (c * x - s * y), instance.position[1] + k * (s * x + c * y)]));
}
function segmentDistance(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const pointSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const ex = x2 - x1, ey = y2 - y1, len = ex * ex + ey * ey;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * ex + (py - y1) * ey) / len));
    return Math.hypot(px - x1 - t * ex, py - y1 - t * ey);
  };
  return Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
}
/** Smallest distance between two sets of closed rings that do not cross (their crossing would be a collision found elsewhere). */
function ringSetDistance(a: readonly (readonly XY[])[], b: readonly (readonly XY[])[], stop = 0): number {
  let best = Infinity;
  for (const p of a) for (const q of b) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) for (let k = 0, m = q.length - 1; k < q.length; m = k++) {
      const d = segmentDistance(p[j][0], p[j][1], p[i][0], p[i][1], q[m][0], q[m][1], q[k][0], q[k][1]);
      if (d < best) { best = d; if (best <= stop) return best; }
    }
  }
  return best;
}
const bounds = (rings: readonly (readonly XY[])[]) => {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  return [l, t, r, b];
};

function recipeOf(params: Record<string, unknown> = {}, seed = 42) {
  const input = createInstrument("glyph-packing");
  input.seed = seed; Object.assign(input.params, params);
  return glyphPackingComposition(input);
}

test("every placed glyph is inside the container, clear of holes and protected space by the margin, and clear of every neighbour by their gaps; nesting exists where bounding boxes overlap", () => {
  const recipe = recipeOf({ container: "pebble", negative: "disc", negativeSize: 0.3, negativeX: 0.18, negativeY: -0.14, margin: 12, gap: 0.2, hierarchy: 0.9, coverage: 0.45, smallest: 9 });
  const { field, packing } = glyphPackingProducts(recipe);
  const list = packing.instances;
  assert.ok(list.length > 150, `${list.length} glyphs placed`);
  const container = domainRings(field.container).map((ring) => ring.map(([x, y]): XY => [x, y]));
  const zone = domainRings(field.negative).map((ring) => ring.map(([x, y]): XY => [x, y]));
  for (const instance of list) {
    const outers = canvasOuters(instance);
    for (const ring of outers) for (const [x, y] of ring) {
      assert.equal(locateInDomain(field.container, x, y), "inside", `${instance.id} vertex in the container`);
      assert.equal(locateInDomain(field.negative, x, y), "outside", `${instance.id} vertex clear of the protected space`);
    }
    const [l, t, r, b] = bounds(outers);
    // Distance to the container's boundary and to the protected space, both ≥ margin (the inset's round joins are inscribed: ≥ 97%).
    for (const rings of [container, zone]) {
      const bb = bounds(rings);
      if (l > bb[2] + 12 || r < bb[0] - 12 || t > bb[3] + 12 || b < bb[1] - 12) continue;
      assert.ok(ringSetDistance(outers, rings, 12 * 0.97) >= 12 * 0.97, `${instance.id} keeps the margin`);
    }
    assert.ok(instance.bounds[0] <= l + 1e-9 && instance.bounds[2] >= r - 1e-9, "reported bounds hold the ink");
  }
  // Pairs: no overlap of any kind, and distance at least (approximately) the two half gaps.
  const half = (i: GlyphInstance) => 0.2 * i.size / 2;
  let close = 0, boxOverlaps = 0;
  const boxes = list.map((i) => bounds(canvasOuters(i)));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const reach = half(list[i]) + half(list[j]);
    const a = boxes[i], b = boxes[j];
    if (a[0] > b[2] + reach || b[0] > a[2] + reach || a[1] > b[3] + reach || b[1] > a[3] + reach) continue;
    close++;
    const distance = ringSetDistance(canvasOuters(list[i]), canvasOuters(list[j]), reach * 0.87);
    assert.ok(distance >= reach * 0.87, `${list[i].id} and ${list[j].id}: ${distance} < ${reach}`);
    if (!(a[0] > b[2] || b[0] > a[2] || a[1] > b[3] || b[1] > a[3])) {
      boxOverlaps++;
      const overlap = domainIntersection(planarDomain(canvasOuters(list[i]).map((outer) => ({ outer }))), planarDomain(canvasOuters(list[j]).map((outer) => ({ outer }))));
      assert.equal(overlap.area, 0, `${list[i].id} and ${list[j].id} overlap as regions`);
    }
  }
  assert.ok(close > 150, `${close} neighbouring pairs were checked`);
  assert.ok(boxOverlaps > 20, `${boxOverlaps} pairs interlock: their bounding boxes overlap while their outlines do not (a box packer places none)`);
});

test("solid counters are not packing space; open counters take smaller glyphs", () => {
  const ring = bundledSymbol("ring");
  const vocabulary = glyphVocabulary({ id: "ring-and-dot", entries: [{ source: ring, weight: 1 }, { source: bundledSymbol("dot"), weight: 3 }] });
  const field = packingField(placeContainer("disc", { centerX: 300, centerY: 300, width: 560, height: 560, rotation: 0 }), noNegativeSpace, 0);
  const options = (counters: "solid" | "open"): PackOptions => ({ seed: 5, vocabulary, coverage: 0.35, largest: 220, smallest: 7, falloff: 1.6, gap: 0.06, counters,
    hierarchy: 1, retries: 200, orientation: { rule: "aligned", angle: 0, spread: 0, upright: true } });
  // Ring counters: radius 0.22 of the ring's size, at the ring's position. Independent of the packer's footprints.
  const countersOf = (packing: GlyphPacking) => packing.instances.filter((i) => i.glyph.id === ring.id).filter((i) => i.size > 60);
  const inside = (packing: GlyphPacking) => {
    let found = 0;
    for (const holder of countersOf(packing)) for (const other of packing.instances) {
      if (other === holder) continue;
      if (Math.hypot(other.position[0] - holder.position[0], other.position[1] - holder.position[1]) < 0.22 * holder.size - other.size / 2 * 0.5) found++;
    }
    return found;
  };
  const solid = packGlyphs(field, options("solid")), open = packGlyphs(field, options("open"));
  assert.ok(countersOf(solid).length >= 1 && countersOf(open).length >= 1, "big rings were placed");
  assert.equal(inside(solid), 0, "nothing lies in a solid counter");
  assert.ok(inside(open) >= 3, `${inside(open)} glyphs nest in open counters`);
  // And an open-counter glyph really is clear of the ring's ink: every nested glyph is farther than 0.22·size from any ring outline point.
  for (const holder of countersOf(open)) for (const other of open.instances) {
    if (other === holder || Math.hypot(other.position[0] - holder.position[0], other.position[1] - holder.position[1]) >= 0.22 * holder.size - other.size / 2 * 0.5) continue;
    const counter = holder.glyph.parts[0].holes[0].map(([x, y]): XY => { const c = Math.cos(holder.angle), s = Math.sin(holder.angle); return [holder.position[0] + holder.size * (c * x - s * y), holder.position[1] + holder.size * (s * x + c * y)]; });
    assert.ok(ringSetDistance(canvasOuters(other), [counter]) > 0, "the nested glyph does not touch the counter's edge");
    assert.equal(locateInDomain(planarRegion({ outer: counter }), other.position[0], other.position[1]), "inside");
  }
});

test("orientation rules: aligned is exact, random stays in its range and uses it, boundary follows the nearest edge and reads upright", () => {
  const rect = packingField(planarDomain(planarRegion({ outer: [[0, 0], [600, 0], [600, 300], [0, 300]] })), noNegativeSpace, 0);
  const options = (rule: "aligned" | "boundary" | "random", extra: Partial<PackOptions["orientation"]> = {}): PackOptions => ({
    seed: 9, vocabulary: bundledVocabulary("garden"), coverage: 0.4, largest: 30, smallest: 7, falloff: 2, gap: 0.1, counters: "solid", hierarchy: 0.5, retries: 30,
    orientation: { rule, angle: 0, spread: 0, upright: false, ...extra } });
  const aligned = packGlyphs(rect, options("aligned", { angle: 25 }));
  assert.ok(aligned.instances.length > 100);
  assert.ok(aligned.instances.every((i) => i.angle === 25 * Math.PI / 180), "every glyph at exactly the angle");
  const random = packGlyphs(rect, options("random", { angle: 10, spread: 30 }));
  const degrees = random.instances.map((i) => i.angle * 180 / Math.PI);
  assert.ok(degrees.every((d) => d >= -20 - 1e-9 && d <= 40 + 1e-9), "within angle ± spread");
  assert.ok(Math.min(...degrees) < -14 && Math.max(...degrees) > 34, "and the whole range is used");
  const boundary = packGlyphs(rect, options("boundary"));
  let horizontal = 0, vertical = 0;
  for (const i of boundary.instances) {
    const [x, y] = i.position;
    const distances = [y, 300 - y, x, 600 - x];
    const nearest = Math.min(...distances);
    if (distances.filter((d) => Math.abs(d - nearest) < 1e-6).length > 1) continue;
    const turn = ((i.angle % Math.PI) + Math.PI) % Math.PI;
    if (distances[0] === nearest || distances[1] === nearest) { assert.ok(turn < 1e-9 || Math.PI - turn < 1e-9, `${i.id} beside a horizontal edge`); horizontal++; }
    else { near(turn, Math.PI / 2, 1e-9, `${i.id} beside a vertical edge`); vertical++; }
  }
  assert.ok(horizontal > 30 && vertical > 10, `${horizontal} ${vertical}`);
  assert.ok(boundary.instances.some((i) => Math.cos(i.angle) < -0.5), "without upright some glyphs run backwards");
  const upright = packGlyphs(rect, options("boundary", { upright: true }));
  assert.ok(upright.instances.every((i) => Math.cos(i.angle) >= -1e-9), "upright never reads upside down");
  const turned = packGlyphs(rect, options("boundary", { angle: 90, upright: true }));
  for (const i of turned.instances) {
    const [x, y] = i.position;
    const nearest = Math.min(y, 300 - y, x, 600 - x);
    if (Math.abs(Math.min(y, 300 - y) - Math.min(x, 600 - x)) < 1e-6) continue;
    const horizontalEdge = Math.min(y, 300 - y) === nearest;
    const across = ((i.angle % Math.PI) + Math.PI) % Math.PI;
    if (horizontalEdge) near(across, Math.PI / 2, 1e-9); else assert.ok(across < 1e-9 || Math.PI - across < 1e-9);
  }
});

test("ids, sizes and accounting: every demand is placed or reported, coverage is the placed area over the field's area", () => {
  const { field, packing } = glyphPackingProducts(recipeOf({ vocabulary: "garden", counters: "solid" }));
  const stats = packing.stats;
  assert.equal(stats.placed + stats.unplaced, stats.planned);
  assert.equal(packing.instances.length, stats.placed); assert.equal(packing.unplaced.length, stats.unplaced);
  const ids = [...packing.instances.map((i) => i.id), ...packing.unplaced.map((u) => u.id)].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  assert.deepEqual(ids, Array.from({ length: stats.planned }, (_, j) => `d${j}`), "instances and unplaced partition the demands d0..dN-1");
  assert.ok(packing.instances.every((i, k) => k === 0 || i.demand > packing.instances[k - 1].demand), "placed in ranked order, largest first");
  assert.ok(packing.instances.every((i) => i.size === i.scale && i.tone === i.tier));
  // Coverage from the ring areas: shoelace of the transformed outer rings (positive area, region on the left of travel).
  let area = 0;
  for (const i of packing.instances) for (const ring of canvasOuters(i)) area += Math.abs(shoelace(ring));
  near(stats.coverage, area / field.available.area, 1e-9, "coverage");
  assert.ok(stats.coverage < stats.plannedCoverage && stats.coverage > 0.2);
  assert.equal(stats.rejectedOutside + stats.rejectedCollision + packing.instances.length, stats.attempts - 0 , "every attempt is a placement or a counted rejection");
  assert.ok(packing.unplaced.every((u) => u.attempts === u.rejectedOutside + u.rejectedCollision || u.reason === "no-room"));
  assert.ok(packing.instances.every((i) => i.attempts >= 1));
  assert.equal(stats.placedByTier.reduce((a, b) => a + b, 0), stats.placed);
  assert.ok(deepFrozen(packing));
  // Ink canvas footprint equals the independent transform.
  const one = packing.instances[3];
  const ink = instanceInk(one);
  const expected = canvasOuters(one)[0];
  const c = Math.cos(one.angle), s = Math.sin(one.angle);
  near(ink[0][0][0], one.position[0] + one.scale * (c * one.glyph.ink[0][0][0] - s * one.glyph.ink[0][0][1]), 1e-9);
  assert.equal(ink[0].length, expected.length);
});

test("an impossible request returns a partial packing with the unplaced set, and an emptied field is a valid empty packing", () => {
  const box = (size: number) => packingField(planarDomain(planarRegion({ outer: [[0, 0], [size, 0], [size, size], [0, size]] })), noNegativeSpace, 0);
  const base: PackOptions = { seed: 2, vocabulary: bundledVocabulary("garden"), coverage: 0.4, largest: 80, smallest: 60, falloff: 2, gap: 0.1, counters: "solid",
    hierarchy: 0.5, retries: 30, orientation: { rule: "aligned", angle: 0, spread: 0, upright: true } };
  const none = packGlyphs(box(100), base);
  assert.ok(none.stats.planned > 0 && none.instances.length === 0 && none.unplaced.length === none.stats.planned, "nothing fits: every demand is reported");
  assert.ok(none.unplaced.every((u) => u.reason === "outside" && u.attempts === 30));
  const partial = packGlyphs(box(140), { ...base, largest: 30, smallest: 8, coverage: 0.6 });
  assert.ok(partial.instances.length > 3 && partial.unplaced.length > 3, `${partial.instances.length} placed, ${partial.unplaced.length} not`);
  assert.ok(partial.unplaced.every((u) => u.size >= 8 && u.size <= 30 && (u.reason === "collision" || u.reason === "outside" || u.reason === "no-room")));
  const consumed = packGlyphs(packingField(placeContainer("disc", { centerX: 100, centerY: 100, width: 120, height: 120, rotation: 0 }), noNegativeSpace, 80), base);
  assert.equal(consumed.instances.length, 0); assert.equal(consumed.stats.planned, 0); assert.equal(consumed.stats.availableArea, 0);
});

// --- producers, appearance and structure ---------------------------------------------------------------------------------------------
test("producers are shared across appearance edits and rebuilt by structural ones", () => {
  const base = glyphPackingProducts(recipeOf());
  assert.equal(glyphPackingProducts(recipeOf()).packing, base.packing, "identical recipes give the cached value");
  for (const appearance of [{ style: "outline", weight: 2 }, { colorBy: "rank" }, { showContainer: "wash" }, { showContainer: "none", colorBy: "kind" }]) {
    const other = glyphPackingProducts(recipeOf(appearance));
    assert.equal(other.packing, base.packing, JSON.stringify(appearance));
    assert.equal(other.field, base.field);
  }
  assert.equal(glyphPackingProducts({ ...recipeOf(), palette: [1, 2, 3] }).packing, base.packing, "a palette edit never re-packs");
  for (const structural of [{ coverage: 0.4 }, { gap: 0.3 }, { orientation: "aligned" }, { angle: 30 }, { hierarchy: 0.5 }, { largest: 60 }, { vocabulary: "tide" }, { counters: "open" }, { retries: 60 }]) {
    const other = glyphPackingProducts(recipeOf(structural));
    assert.notEqual(other.packing, base.packing, JSON.stringify(structural));
    assert.equal(other.field, base.field, `${JSON.stringify(structural)} keeps the field`);
  }
  for (const spatial of [{ container: "star" }, { margin: 20 }, { negative: "band" }, { width: 400 }]) assert.notEqual(glyphPackingProducts(recipeOf(spatial)).field, base.field, JSON.stringify(spatial));
  const seeded = glyphPackingProducts(recipeOf({}, 7));
  assert.equal(seeded.field, base.field, "a seed never rebuilds the container");
  const moved = seeded.packing.instances.filter((i, k) => base.packing.instances[k]?.position[0] !== i.position[0]).length;
  assert.ok(moved > seeded.packing.instances.length * 0.9, "a new seed is a different arrangement, not a nudge");
  assert.ok(deepFrozen(base.packing) && deepFrozen(base.field.available));
});

test("the same construction is deterministic and identical instances keep ids and positions when only appearance changes", () => {
  const a = glyphPackingProducts(recipeOf({}, 5)).packing;
  const b = glyphPackingProducts(recipeOf({ style: "outline", colorBy: "rank", showContainer: "wash" }, 5)).packing;
  assert.deepEqual(a.instances.map((i) => [i.id, i.position, i.angle, i.size]), b.instances.map((i) => [i.id, i.position, i.angle, i.size]));
  const cold = packGlyphs(glyphPackingProducts(recipeOf({}, 5)).field, { seed: 5, vocabulary: recipeOf().vocabulary, ...recipeOf().pack });
  assert.deepEqual(cold.instances.map((i) => [i.id, i.position]), a.instances.map((i) => [i.id, i.position]));
});

test("drawing: one isolated shape group per glyph, replaceable marks see the same instances, outline weight is in canvas units", () => {
  const recipe = recipeOf({ showContainer: "none", coverage: 0.2 });
  const { packing } = glyphPackingProducts(recipe);
  const filled = new Recorder();
  drawGlyphPacking(filled, recipe);
  assert.equal(filled.count("push"), packing.instances.length);
  assert.equal(filled.count("endShape"), packing.instances.reduce((sum, i) => sum + i.glyph.fill.length, 0), "one shape per keyholed polygon of every glyph");
  const seen: string[] = [];
  const custom = new Recorder();
  drawGlyphPacking(custom, recipe, { glyph: (surface, instance) => { seen.push(instance.id); surface.circle(0, 0, 3); } });
  assert.deepEqual(seen, packing.instances.map((i) => i.id));
  assert.equal(custom.count("circle"), seen.length); assert.equal(custom.count("endShape"), 0);
  const outlined = new Recorder();
  drawGlyphPacking(outlined, recipeOf({ showContainer: "none", coverage: 0.2, style: "outline", weight: 1.5 }));
  assert.equal(outlined.count("endShape"), packing.instances.reduce((sum, i) => sum + i.glyph.ink.length, 0));
  const scales = packing.instances.map((i) => i.scale);
  const weights = outlined.ops.filter((op) => op[0] === "strokeWeight").map((op) => op[1] as number);
  weights.forEach((w, k) => near(w * scales[k], 1.5, 1e-9, "stroke width is 1.5 canvas units whatever the glyph's scale"));
  const washed = new Recorder();
  drawGlyphPacking(washed, recipeOf({ showContainer: "wash", coverage: 0.2 }));
  assert.equal(washed.ops.filter((op) => op[0] === "fill").length > 0, true);
  assert.ok(washed.count("endShape") > filled.count("endShape"), "the wash adds one shape per container region");
  assert.equal(glyphPackingComposition(createInstrument("glyph-packing")).kind, "glyph-packing");
  assert.equal(typeof packedGlyphOutline([0], "ink", 1), "function");
});

test("registered instrument: defaults draw, hidden controls change nothing, seed use is honest, preparation can be cancelled", async () => {
  assert.equal(definition("glyph-packing").title, "Glyph Packing");
  assert.ok(canPrepareInstrument("glyph-packing"));
  const input = createInstrument("glyph-packing");
  validateInstrument(input);
  const rec = new Recorder();
  drawInstrument(rec, input);
  assert.ok(rec.count("push") > 100, "the authored default draws a full picture");
  // A control hidden by its condition never changes the drawing.
  const base = drawFingerprint(input);
  const hiddenChanges: [Record<string, unknown>, Record<string, unknown>][] = [
    [{ orientation: "aligned" }, { spread: 60, upright: false }],
    [{ negative: "none" }, { negativeSize: 0.8, negativeX: -0.3, negativeY: 0.4 }],
    [{ negative: "band" }, { negativeX: 0.4 }],
    [{ style: "fill" }, { weight: 3 }],
  ];
  for (const [driver, hidden] of hiddenChanges) {
    const withDriver = { ...createInstrument("glyph-packing"), params: { ...input.params, ...driver } };
    const reference = drawFingerprint(withDriver);
    assert.equal(drawFingerprint({ ...withDriver, params: { ...withDriver.params, ...hidden } }), reference, JSON.stringify([driver, hidden]));
  }
  assert.notEqual(drawFingerprint({ ...input, seed: 43 }), base);
  assert.equal(usesSeed({ ...input, params: { ...input.params, coverage: 0 } }), false);
  assert.equal(usesSeed(input), true);
  // Cancellation: a cancelled preparation reports false and a later one completes with the same result.
  const recipe = recipeOf({ smallest: 6, coverage: 0.55 }, 11);
  let checks = 0;
  assert.equal(await prepareGlyphPacking(recipe, () => ++checks > 2), false);
  assert.equal(await prepareGlyphPacking(recipe, () => false), true);
  assert.ok(glyphPackingProducts(recipe).packing.stats.placed > 100);
  assert.equal(await prepareGlyphPacking(recipe, () => true), false);
});
