import assert from "node:assert/strict";
import test from "node:test";
import {
  PlanarError, clipPath, clipPaths, domainContains, domainDifference, domainIntersection, domainRings, domainUnion, domainXor, hatchDomain,
  keyholeRing, labelDomains, locateInDomain, maskDomain, offsetDomain, partitionRegions, planarDomain, planarRegion, rectangleDomain, rectangleRegion,
  ringsDomain, simplifyDomain, textDomain, unionDomains, createCompositionRun, outlineText, outlineLayout, outlineUnits, clipRingToRect, keyholeRings, resolveSupport, supportContains, clipToSupport,
  type Path, type PlanarDomain, type PlanarRegion,
} from "../dist/index.js";

type P = [number, number];
const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected}`);
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rect = (x: number, y: number, w: number, h: number): P[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const box = (x: number, y: number, w: number, h = w, id?: string) => planarRegion({ ...(id ? { id } : {}), outer: rect(x, y, w, h) });
function star(r: () => number, cx: number, cy: number, n: number, rMin: number, rMax: number): P[] {
  // Stratified angles keep every angular gap small, so the polygon is star-shaped and simple.
  const angles = Array.from({ length: n }, (_, i) => (i + r() * 0.98) / n * Math.PI * 2);
  return angles.map((a): P => { const rad = rMin + r() * (rMax - rMin); return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; });
}
const geometry = (d: PlanarDomain) => JSON.stringify(d.regions.map((g) => [g.outer, g.holes]));
const asData = (g: PlanarRegion) => ({ outer: g.outer as unknown as P[], holes: g.holes as unknown as P[][] });
const signed = (ring: readonly (readonly number[])[]) => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return s / 2; };
function assertValid(domain: PlanarDomain, note = "") {
  for (const g of domain.regions) assert.doesNotThrow(() => planarRegion(asData(g)), `${note}: region ${g.id} must satisfy the strict constructor`);
  for (let i = 0; i < domain.regions.length; i++) for (let j = i + 1; j < domain.regions.length; j++)
    near(domainIntersection(domain.regions[i], domain.regions[j]).area, 0, 1e-9, `${note}: regions ${i},${j} overlap`);
}
const deepFrozen = (value: unknown): boolean => value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value).every(deepFrozen));
const planarCode = (fn: () => unknown, code: string, fragment?: RegExp) =>
  assert.throws(fn, (error: unknown) => error instanceof PlanarError && error.code === code && (!fragment || fragment.test(error.message)), `expected ${code} ${fragment ?? ""}`);

// ---------------------------------------------------------------------------------------------
test("a region normalises orientation and reports analytic measures", () => {
  // Outer given clockwise-in-math, hole given counter-clockwise: both are reversed.
  const region = planarRegion({ id: "r", outer: rect(0, 0, 10, 10).reverse(), holes: [rect(1, 1, 2, 2)] });
  assert.ok(signed(region.outer) > 0 && signed(region.holes[0]) < 0);
  near(signed(region.outer), 100); near(signed(region.holes[0]), -4);
  near(region.area, 96); near(region.perimeter, 40 + 8);
  assert.deepEqual([...region.bounds], [0, 0, 10, 10]);
  near(region.centroid[0], (100 * 5 - 4 * 2) / 96); near(region.centroid[1], (100 * 5 - 4 * 2) / 96);
  assert.equal(region.id, "r");
  assert.ok(deepFrozen(region));
});

test("values are plain data: JSON round trip reproduces them, and results are deeply frozen", () => {
  const domain = domainDifference(box(0, 0, 10), box(3, 3, 2));
  assert.ok(deepFrozen(domain));
  const back = planarDomain(JSON.parse(JSON.stringify(domain)).regions);
  assert.equal(geometry(back), geometry(domain));
  near(back.area, 96);
  const text = textDomain("A", { centerX: 50, centerY: 50, width: 80, height: 80 });
  assert.ok(deepFrozen(text));
  assert.equal(textDomain("A", { centerX: 50, centerY: 50, width: 80, height: 80 }), text, "same construction is cached");
});

test("point location uses a closed set with exact predicates", () => {
  const ring = planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(4, 4, 2, 2)] });
  assert.equal(locateInDomain(ring, 1, 1), "inside");
  assert.equal(locateInDomain(ring, 0, 5), "boundary");
  assert.equal(locateInDomain(ring, 10, 10), "boundary");
  assert.equal(locateInDomain(ring, 4, 5), "boundary", "hole boundary belongs to the region");
  assert.equal(locateInDomain(ring, 5, 5), "outside", "inside a hole");
  assert.equal(locateInDomain(ring, -1e-9, 5), "outside");
  assert.equal(domainContains(ring, 4, 4), true);
  // A slanted edge y = x: one ulp either side is decided correctly.
  const tri = planarRegion({ outer: [[0, 0], [1, 1], [0, 1]] });
  const up = (x: number) => { const b = new Float64Array([x]), i = new BigInt64Array(b.buffer); i[0] += 1n; return b[0]; };
  const down = (x: number) => { const b = new Float64Array([x]), i = new BigInt64Array(b.buffer); i[0] -= 1n; return b[0]; };
  assert.equal(locateInDomain(tri, 0.1, 0.1), "boundary");
  assert.equal(locateInDomain(tri, 0.1, up(0.1)), "inside");
  assert.equal(locateInDomain(tri, 0.1, down(0.1)), "outside");
});

test("orientation predicate agrees with exact rational arithmetic on near-collinear points", () => {
  // Reference: exact dyadic arithmetic in BigInt, independent of the library.
  const exact = (x: number): [bigint, number] => {
    if (x === 0) return [0n, 0];
    let e = Math.floor(Math.log2(Math.abs(x))) - 52;
    let m = x / 2 ** e;
    while (!Number.isInteger(m)) { e -= 1; m = x / 2 ** e; }
    return [BigInt(m), e];
  };
  const lowExp = (values: number[]) => Math.min(...values.map((v) => exact(v)[1]).filter((_, i) => values[i] !== 0));
  const big = (v: number, low: number) => { const [m, e] = exact(v); return m << BigInt(e - low); };
  const r = rng(99);
  let checked = 0, nonTrivial = 0;
  for (let k = 0; k < 400; k++) {
    // Triangle (a, b, c) whose edge a→b passes within ulps of the probe point p.
    const ax = r() * 4 - 2, ay = r() * 4 - 2, bx = r() * 4 - 2, by = r() * 4 - 2, t = r();
    let px = ax + t * (bx - ax), py = ay + t * (by - ay);
    const bump = (v: number, n: number) => { const f = new Float64Array([v]), i = new BigInt64Array(f.buffer); i[0] += BigInt(n * (v < 0 ? -1 : 1)); return f[0]; };
    px = bump(px, Math.floor(r() * 5) - 2); py = bump(py, Math.floor(r() * 5) - 2);
    const values = [ax, ay, bx, by, px, py], low = lowExp(values);
    const [A, B, C, D, E, F] = values.map((v) => big(v, low));
    const det = (A - E) * (D - F) - (B - F) * (C - E); // > 0: p left of a→b
    // Triangle a, b, c with c far to the left of a→b, so p being left of a→b and inside its slab is the question.
    const cx = ax - (by - ay) * 10, cy = ay + (bx - ax) * 10;
    const region = planarRegion({ outer: [[ax, ay], [bx, by], [cx, cy]] });
    if (t > 0.01 && t < 0.99) {
      const at = locateInDomain(region, px, py);
      checked++;
      if (det === 0n) assert.equal(at, "boundary", "exactly on the edge");
      else { nonTrivial++; assert.equal(at === "inside", det > 0n, `side of a→b (det ${det})`); }
    }
  }
  assert.ok(checked > 300 && nonTrivial > 150);
});

// ---------------------------------------------------------------------------------------------
test("Booleans of overlapping squares give the hand-computed shapes", () => {
  const a = box(0, 0, 2), b = box(1, 1, 2);
  const u = domainUnion(a, b), i = domainIntersection(a, b), d = domainDifference(a, b), x = domainXor(a, b);
  near(u.area, 7); near(i.area, 1); near(d.area, 3); near(x.area, 6);
  assert.deepEqual(u.regions[0].outer.map((p) => [...p]), [[0, 0], [2, 0], [2, 1], [3, 1], [3, 3], [1, 3], [1, 2], [0, 2]]);
  assert.deepEqual(i.regions[0].outer.map((p) => [...p]), [[1, 1], [2, 1], [2, 2], [1, 2]]);
  assert.deepEqual(d.regions[0].outer.map((p) => [...p]), [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]]);
  assert.equal(x.regions.length, 2);
  assert.equal(u.regions[0].id, "union(region,region)/0");
});

test("holes, islands in holes and pinched holes come out nested correctly", () => {
  const ring = domainDifference(box(0, 0, 10), box(3, 3, 4));
  assert.equal(ring.regions.length, 1); assert.equal(ring.regions[0].holes.length, 1);
  const island = domainUnion(ring, box(4, 4, 2));
  assert.equal(island.regions.length, 2, "the island is its own region");
  near(island.area, 100 - 16 + 4);
  const two = domainDifference(box(0, 0, 10), unionDomains([box(1, 1, 2), box(5, 5, 3)]));
  assert.equal(two.regions.length, 1); assert.equal(two.regions[0].holes.length, 2);
  // A hole that touches the outer boundary at exactly one corner point stays a hole of one region.
  const pinched = domainDifference(box(0, 0, 10), planarRegion({ outer: [[0, 0], [3, 1], [1, 3]] }));
  assert.equal(pinched.regions.length, 1);
  near(pinched.area, 100 - 4);
  assertValid(pinched);
  // Deep nesting: rings inside rings inside rings.
  let nested: PlanarDomain = box(0, 0, 100);
  for (let k = 1; k <= 4; k++) nested = domainXor(nested, box(10 * k, 10 * k, 100 - 20 * k));
  assert.equal(nested.regions.length, 3);
  near(nested.area, 100 ** 2 - 80 ** 2 + 60 ** 2 - 40 ** 2 + 20 ** 2 - 0);
  assertValid(nested);
});

test("touching edges and corners: shared edges merge, corner contacts stay separate", () => {
  const merged = domainUnion(box(0, 0, 1), box(1, 0, 1));
  assert.equal(merged.regions.length, 1);
  assert.deepEqual(merged.regions[0].outer.map((p) => [...p]), [[0, 0], [2, 0], [2, 1], [0, 1]], "no leftover collinear vertex");
  const partial = domainUnion(box(0, 0, 2), box(2, 1, 2));
  near(partial.area, 8); assert.equal(partial.regions.length, 1);
  assert.equal(domainIntersection(box(0, 0, 1), box(1, 0, 1)).regions.length, 0, "edge contact has no area");
  const corner = domainUnion(box(0, 0, 1), box(1, 1, 1));
  assert.equal(corner.regions.length, 2); near(corner.area, 2);
  near(domainDifference(box(0, 0, 2), box(0, 0, 2)).area, 0);
  assert.equal(domainDifference(box(0, 0, 2), box(-1, -1, 4)).regions.length, 0);
  near(domainDifference(box(0, 0, 2), box(2, 0, 2)).area, 4);
});

test("thin slivers and collinear runs survive exactly", () => {
  const sliver = domainIntersection(box(0, 0, 1000, 1e-9), box(10, -1, 5, 2));
  near(sliver.area, 5 * 1e-9, 1e-21);
  const collinear = planarRegion({ outer: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 3], [0, 3]] });
  near(domainUnion(collinear, box(3, 0, 1, 3)).area, 12);
  near(domainDifference(collinear, box(1, -1, 1, 1)).area, 9, 1e-12, "contact along a collinear vertex run only");
  // Nearly parallel long edges: a wedge meeting a rectangle edge at a tiny angle.
  const wedge = planarRegion({ outer: [[0, 0], [1e6, 0], [1e6, 1e-6]] });
  near(domainIntersection(wedge, box(0, 0, 1e6, 5e-7)).area + domainDifference(wedge, box(0, 0, 1e6, 5e-7)).area, wedge.area, 1e-6);
});

test("tiny and huge coordinates satisfy the same identities", () => {
  for (const k of [1e-12, 1e-6, 1, 1e6, 1e12]) {
    const r = rng(7);
    const a = planarRegion({ outer: star(r, 0, 0, 12, 3, 9).map(([x, y]): P => [x * k, y * k]) });
    const b = planarRegion({ outer: star(r, 2, 1, 9, 3, 9).map(([x, y]): P => [x * k, y * k]) });
    const u = domainUnion(a, b), i = domainIntersection(a, b);
    near((u.area + i.area) / (a.area + b.area), 1, 1e-9, `scale ${k}`);
    near(domainDifference(a, b).area / a.area, 1 - i.area / a.area, 1e-9, `scale ${k}`);
    assertValid(u, `scale ${k}`);
  }
  const far = planarRegion({ outer: rect(1e9, 1e9, 3, 3) });
  near(domainIntersection(far, planarRegion({ outer: rect(1e9 + 1, 1e9 + 1, 3, 3) })).area, 4);
});

test("orientation, ring start and region order never change a result", () => {
  const r = rng(11);
  const a = planarRegion({ outer: star(r, 0, 0, 14, 3, 9), holes: [star(r, 0, 0, 5, 0.3, 1).reverse()] });
  const b = planarRegion({ outer: star(r, 1, 1, 11, 3, 9) });
  const reference = geometry(domainUnion(a, b));
  const rotate = (ring: readonly P[] | readonly (readonly [number, number])[], k: number) => [...ring.slice(k), ...ring.slice(0, k)] as P[];
  const variant = planarRegion({ outer: rotate(a.outer, 5).reverse(), holes: a.holes.map((h) => rotate(h, 2).reverse()) });
  assert.equal(geometry(domainUnion(variant, b)), reference);
  assert.equal(geometry(domainUnion(b, a)), reference, "union is symmetric to the last bit");
  assert.equal(geometry(domainIntersection(a, b)), geometry(domainIntersection(b, a)));
  const u = domainUnion(a, b);
  assert.equal(geometry(domainUnion(u, u)), geometry(u), "idempotent");
  assert.equal(geometry(domainIntersection(u, u)), geometry(u));
  assert.equal(geometry(unionDomains([b, a])), geometry(unionDomains([a, b])));
});

test("area identities hold over seeded random polygons with holes, shifts and integer grids", () => {
  let cases = 0;
  for (const grid of [0, 1, 0.25]) for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed * 7919 + grid * 1000);
    const snap = (p: P): P => grid ? [Math.round(p[0] / grid) * grid, Math.round(p[1] / grid) * grid] : p;
    const make = () => {
      try {
        const outer = planarRegion({ outer: star(r, 10 + r() * 5, 10 + r() * 5, 3 + Math.floor(r() * 16), 3, 9).map(snap) });
        if (r() < 0.5) return outer;
        return domainDifference(outer, planarRegion({ outer: star(r, outer.centroid[0], outer.centroid[1], 3 + Math.floor(r() * 6), 0.5, 2.5).map(snap) }));
      } catch { return null; }
    };
    const a = make(), b = make();
    if (!a || !b) continue;
    cases++;
    const u = domainUnion(a, b), i = domainIntersection(a, b), d = domainDifference(a, b), x = domainXor(a, b);
    const tol = 1e-9 * (a.area + b.area);
    near(u.area + i.area, a.area + b.area, tol, `inclusion-exclusion grid ${grid} seed ${seed}`);
    near(d.area, a.area - i.area, tol, `difference grid ${grid} seed ${seed}`);
    near(x.area, a.area + b.area - 2 * i.area, tol, `xor grid ${grid} seed ${seed}`);
    near(domainDifference(u, i).area, x.area, tol, "union minus intersection is the symmetric difference");
    for (const domain of [u, i, d, x]) assertValid(domain, `grid ${grid} seed ${seed}`);
    assert.equal(geometry(domainUnion(u, u)), geometry(u), "idempotent");
    // A copy shifted by 1e-13 is a near-degenerate overlay: identities still hold.
    const shifted = planarDomain(("regions" in a ? a.regions : [a]).map((g) => ({ outer: g.outer.map(([px, py]): P => [px + 1e-13, py - 7e-14]), holes: g.holes.map((h) => h.map(([px, py]): P => [px + 1e-13, py - 7e-14])) })));
    near(domainUnion(a, shifted).area + domainIntersection(a, shifted).area, 2 * a.area, 1e-9 * a.area);
  }
  assert.ok(cases > 300, `only ${cases} usable cases`);
});

test("Booleans of pixel masks match per-pixel logic exactly", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const r = rng(seed * 31337), w = 3 + Math.floor(r() * 12), h = 3 + Math.floor(r() * 12), p = 0.3 + r() * 0.4;
    const a = Array.from({ length: w * h }, () => r() < p ? 1 : 0), b = Array.from({ length: w * h }, () => r() < p ? 1 : 0);
    const A = maskDomain({ width: w, height: h, data: a }), B = maskDomain({ width: w, height: h, data: b });
    const expect = (name: string, dom: PlanarDomain, fn: (i: number) => boolean) => {
      let count = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const inside = fn(y * w + x);
        if (inside) count++;
        assert.equal(locateInDomain(dom, x + 0.5, y + 0.5) === "inside", inside, `${name} pixel ${x},${y} seed ${seed}`);
      }
      near(dom.area, count, 0, `${name} area`);
      assertValid(dom, name);
    };
    expect("A", A, (k) => a[k] === 1);
    expect("union", domainUnion(A, B), (k) => a[k] + b[k] > 0);
    expect("intersection", domainIntersection(A, B), (k) => a[k] + b[k] === 2);
    expect("difference", domainDifference(A, B), (k) => a[k] === 1 && b[k] === 0);
    expect("xor", domainXor(A, B), (k) => a[k] !== b[k]);
  }
});

// ---------------------------------------------------------------------------------------------
test("invalid regions are rejected explicitly, each naming its problem", () => {
  planarCode(() => planarRegion({ outer: [[0, 0], [2, 2], [2, 0], [0, 2]] }), "SELF_INTERSECTION", /crosses itself/);
  planarCode(() => planarRegion({ outer: [[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 1]] }), "SELF_INTERSECTION", /touches itself/);
  planarCode(() => planarRegion({ outer: [[0, 0], [4, 0], [2, 0]] }), "SELF_INTERSECTION");
  planarCode(() => planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(8, 8, 5, 5)] }), "SELF_INTERSECTION", /crosses/);
  planarCode(() => planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(20, 20, 2, 2)] }), "INVALID_REGION", /not properly nested/);
  planarCode(() => planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(2, 2, 3, 3), rect(3, 3, 3, 3)] }), "SELF_INTERSECTION");
  planarCode(() => planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(1, 1, 6, 6), rect(2, 2, 2, 2)] }), "INVALID_REGION", /not properly nested/);
  planarCode(() => planarRegion({ outer: rect(0, 0, 10, 10), holes: [[[0, 2], [0, 4], [3, 3]]] }), "SELF_INTERSECTION", /overlaps a boundary piece/);
  planarCode(() => planarRegion({ outer: [[0, 0], [1, 0]] }), "INVALID_INPUT", /at least 3/);
  planarCode(() => planarRegion({ outer: [[0, 0], [1, 0], [Number.NaN, 1]] }), "INVALID_INPUT", /outer\[2\]\[0\]/);
  planarCode(() => planarRegion({ outer: [[0, 0], [1, 0], [1e101, 1]] }), "INVALID_INPUT", /magnitude/);
  planarCode(() => planarRegion({ outer: [[0, 0], [1, 0], [1, 1e-101]] }), "INVALID_INPUT", /magnitude/);
  planarCode(() => planarDomain([box(0, 0, 4), box(2, 2, 4)]), "INVALID_REGION", /overlap/);
  planarCode(() => planarDomain([box(0, 0, 1, 1, "x"), box(2, 0, 1, 1, "x")]), "INVALID_INPUT", /used twice/);
  assert.doesNotThrow(() => planarDomain([box(0, 0, 2), box(2, 0, 2)]), "regions sharing an edge do not overlap");
  assert.doesNotThrow(() => planarRegion({ outer: rect(0, 0, 10, 10), holes: [[[0, 0], [3, 1], [1, 3]]] }), "a hole may touch its outer ring at one point");
});

test("repair resolves self-intersecting rings by an explicit fill rule", () => {
  const bowtie: P[] = [[0, 0], [2, 2], [2, 0], [0, 2]];
  for (const repair of ["nonzero", "evenodd"] as const) {
    const fixed = planarDomain({ outer: bowtie }, { repair });
    // The bow-tie's net winding is 0 for the whole figure only for a signed rule; as a role-oriented outer it gives two triangles.
    assert.equal(fixed.regions.length, 2, repair); near(fixed.area, 2, 1e-12, repair);
    assertValid(fixed, repair);
  }
  // Pentagram {5/2}: nonzero fills the whole star, evenodd leaves the pentagon in the middle empty.
  const R = 10, inner = R * Math.cos(2 * Math.PI / 5) / Math.cos(Math.PI / 5);
  const star5: P[] = Array.from({ length: 5 }, (_, k): P => [R * Math.cos(-Math.PI / 2 + k * 4 * Math.PI / 5), R * Math.sin(-Math.PI / 2 + k * 4 * Math.PI / 5)]);
  const wholeStar = 5 * R * inner * Math.sin(Math.PI / 5), pentagon = 2.5 * inner * inner * Math.sin(2 * Math.PI / 5);
  const nonzero = ringsDomain([star5], { fill: "nonzero" }), evenodd = ringsDomain([star5], { fill: "evenodd" });
  near(nonzero.area, wholeStar, 1e-9 * wholeStar); assert.equal(nonzero.regions.length, 1); assert.equal(nonzero.regions[0].holes.length, 0);
  near(evenodd.area, wholeStar - pentagon, 1e-9 * wholeStar); assert.equal(evenodd.regions.length, 5, "five tips that meet at the pentagon's corners");
  // With no repair, the same input is an error.
  planarCode(() => planarRegion({ outer: star5 }), "SELF_INTERSECTION");
  // Font-style contours: two overlapping same-winding rings union, an opposite ring cuts a hole.
  const glyph = ringsDomain([rect(0, 0, 6, 6), rect(4, 0, 6, 6), rect(1, 1, 2, 2).reverse()], { fill: "nonzero" });
  near(glyph.area, 60 - 4); assert.equal(glyph.regions.length, 1); assert.equal(glyph.regions[0].holes.length, 1);
  near(ringsDomain([rect(0, 0, 6, 6), rect(1, 1, 2, 2)], { fill: "evenodd" }).area, 32);
  near(ringsDomain([[[0, 0], [1, 1]], rect(0, 0, 2, 2)], { fill: "nonzero" }).area, 4, 1e-12, "degenerate rings are ignored");
});

test("work limits and cancellation fail loudly and name what to change", () => {
  const r = rng(3);
  const a = planarRegion({ outer: star(r, 0, 0, 200, 5, 9) }), b = planarRegion({ outer: star(r, 1, 1, 200, 5, 9) });
  planarCode(() => domainUnion(a, b, { maxWork: 100 }), "WORK_LIMIT", /maxWork/);
  planarCode(() => planarRegion({ outer: a.outer as unknown as P[] }, { maxWork: 10 }), "WORK_LIMIT", /maxWork/);
  planarCode(() => domainUnion(a, b, { maxWork: 0 }), "INVALID_INPUT", /maxWork/);
  let calls = 0;
  const run = { check() { if (++calls > 2) throw new Error("stop"); } };
  planarCode(() => domainUnion(a, b, { run }), "CANCELLED", /stop/);
  assert.doesNotThrow(() => domainUnion(a, b, { run: createCompositionRun() }));
});

test("minArea drops numerically tiny pieces and holes only when asked", () => {
  const nearlyEqual = domainDifference(box(0, 0, 10), box(0, 0, 10 - 1e-6, 10));
  near(nearlyEqual.area, 1e-5, 1e-12);
  assert.equal(nearlyEqual.regions.length, 1);
  assert.equal(domainDifference(box(0, 0, 10), box(0, 0, 10 - 1e-6, 10), { minArea: 1e-3 }).regions.length, 0);
  const pinhole = domainDifference(box(0, 0, 10), box(5, 5, 1e-4));
  assert.equal(pinhole.regions[0].holes.length, 1);
  const filled = domainDifference(box(0, 0, 10), box(5, 5, 1e-4), { minArea: 1e-6 });
  assert.equal(filled.regions[0].holes.length, 0); near(filled.area, 100);
});

// ---------------------------------------------------------------------------------------------
test("offsetting a square matches the analytic area for each join", () => {
  const square = box(0, 0, 10);
  near(offsetDomain(square, 2, { join: "miter" }).area, 196);
  near(offsetDomain(square, 2, { join: "bevel" }).area, 100 + 4 * 10 * 2 + 4 * 2);
  const round = offsetDomain(square, 2, { join: "round", arcTolerance: 0.01 });
  near(round.area, 100 + 80 + Math.PI * 4, 2 * Math.PI * 2 * 0.01, "Steiner formula within the chord tolerance");
  assert.ok(round.area < 100 + 80 + Math.PI * 4, "inscribed arcs never exceed the true offset");
  for (const join of ["miter", "bevel", "round"] as const) near(offsetDomain(square, -2, { join }).area, 36, 0, `${join}: convex corners need no join`);
  near(offsetDomain(square, 0).area, 100);
  assert.equal(offsetDomain(square, -5).regions.length, 0, "a shape narrower than 2|d| vanishes");
  assert.equal(offsetDomain(square, -5.000001).regions.length, 0);
  near(offsetDomain(square, -4.999).area, 0.002 ** 2, 1e-9);
});

test("inward offset of a concave corner follows the chosen join", () => {
  const L = planarRegion({ outer: [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]] });
  near(offsetDomain(L, -1, { join: "miter" }).area, 8 * 2 + 2 * 6);
  near(offsetDomain(L, -1, { join: "bevel" }).area, 28.5);
  near(offsetDomain(L, -1, { join: "round", arcTolerance: 1e-3 }).area, 28 + 1 - Math.PI / 4, 2e-3);
  // Growing the same L: area + perimeter·d + d²·(convex corners − reflex corners) for mitered right angles.
  near(offsetDomain(L, 1, { join: "miter" }).area, 64 + 40 + 5 - 1);
});

test("miter limit falls back to a bevel exactly when the tip is too long", () => {
  const spike = planarRegion({ outer: [[0, 0], [10, 0], [0, 1]] });
  // Interior angle at the sharp corner is atan(1/10); tip distance = d / sin(θ/2).
  const theta = Math.atan2(1, 10), ratio = 1 / Math.sin(theta / 2);
  const long = offsetDomain(spike, 0.5, { join: "miter", miterLimit: ratio + 1 }), cut = offsetDomain(spike, 0.5, { join: "miter", miterLimit: ratio - 1 });
  assert.ok(long.area > cut.area);
  assert.ok(long.bounds![2] > cut.bounds![2] + 1, "the mitered tip reaches farther");
  near(long.bounds![2], 10 + 0.5 / Math.tan(theta / 2), 1e-9, "mitered tip");
  near(cut.bounds![2], 10 + 0.5 / Math.sqrt(101), 1e-9, "beveled tip");
  assert.ok(offsetDomain(spike, 0.5, { join: "bevel" }).area <= cut.area + 1e-9);
});

test("holes shrink outward and grow inward; necks split and pinholes close", () => {
  const holed = domainDifference(box(0, 0, 10), box(4, 4, 2));
  near(offsetDomain(holed, 1, { join: "miter" }).area, 144, 1e-9, "the hole closes at |d| = 1");
  assert.equal(offsetDomain(holed, 0.5, { join: "miter" }).regions[0].holes.length, 1);
  near(offsetDomain(holed, 0.5, { join: "miter" }).area, 121 - 1);
  near(offsetDomain(holed, -1, { join: "miter" }).area, 64 - 16);
  // Dumbbell: two 10×10 blocks joined by a 2-wide neck. Shrinking by 1.5 cuts the neck (width 2 < 3) into two pieces.
  const dumbbell = unionDomains([box(0, 0, 10), box(20, 0, 10), box(10, 4, 10, 2)]);
  assert.equal(offsetDomain(dumbbell, -1.5, { join: "miter" }).regions.length, 2);
  assert.equal(offsetDomain(dumbbell, -0.5, { join: "miter" }).regions.length, 1);
  // Two squares 1 apart merge when grown by 0.6 and stay apart when grown by 0.4.
  const pair = unionDomains([box(0, 0, 4), box(5, 0, 4)]);
  assert.equal(offsetDomain(pair, 0.4, { join: "miter" }).regions.length, 2);
  assert.equal(offsetDomain(pair, 0.6, { join: "miter" }).regions.length, 1);
});

test("offset properties over random convex and star polygons", () => {
  const r = rng(21);
  for (let k = 0; k < 40; k++) {
    // Convex polygon: points on a circle with random radii-free angles.
    const n = 3 + Math.floor(r() * 9), angles = Array.from({ length: n }, () => r() * 2 * Math.PI).sort((a, b) => a - b);
    const cvx = angles.map((a): P => [Math.cos(a) * 8, Math.sin(a) * 6]);
    let region: PlanarRegion;
    try { region = planarRegion({ outer: cvx }); } catch { continue; }
    const d = 0.3 + r() * 2, tolerance = d / 200;
    const grown = offsetDomain(region, d, { join: "round", arcTolerance: tolerance });
    const expected = region.area + region.perimeter * d + Math.PI * d * d; // Steiner formula for convex sets
    assert.ok(grown.area <= expected + 1e-9 && grown.area >= expected - 2 * Math.PI * d * tolerance - 1e-9, `Steiner ${grown.area} vs ${expected}`);
    assert.ok(offsetDomain(region, d, { join: "miter", miterLimit: 1e9 }).area >= grown.area, "a miter contains the round join");
    const shrunk = offsetDomain(region, -d * 0.1, { join: "round" });
    assert.ok(shrunk.area <= region.area && domainDifference(shrunk, region).area < 1e-9, "inward offset stays inside");
    assert.ok(domainDifference(region, grown).area < 1e-9, "outward offset contains the original");
  }
  for (let seed = 1; seed <= 40; seed++) {
    const rr = rng(seed);
    const s = planarRegion({ outer: star(rr, 0, 0, 10, 3, 9) });
    const g = offsetDomain(s, 0.7), h = offsetDomain(s, -0.7);
    assert.ok(g.area > s.area && h.area < s.area);
    assert.ok(domainDifference(s, g).area < 1e-9 && domainDifference(h, s).area < 1e-9, `nested offsets, seed ${seed}`);
    assertValid(g, `grown ${seed}`); assertValid(h, `shrunk ${seed}`);
  }
});

test("offset failure modes name the argument to change", () => {
  const s = box(0, 0, 10);
  planarCode(() => offsetDomain(s, 1, { join: "spiky" as "round" }), "INVALID_INPUT", /join/);
  planarCode(() => offsetDomain(s, 1, { miterLimit: 0.5 }), "INVALID_INPUT", /miterLimit/);
  planarCode(() => offsetDomain(s, 1, { arcTolerance: 0 }), "INVALID_INPUT", /arcTolerance/);
  planarCode(() => offsetDomain(s, Number.NaN), "INVALID_INPUT", /distance/);
  const circle = planarRegion({ outer: Array.from({ length: 90000 }, (_, k): P => [Math.cos(k / 90000 * 2 * Math.PI) * 500, Math.sin(k / 90000 * 2 * Math.PI) * 500]) });
  planarCode(() => offsetDomain(circle, 1), "WORK_LIMIT", /boundary edges|maxWork/);
});

// ---------------------------------------------------------------------------------------------
test("clipping an open path to a region with a hole returns exact ordered pieces", () => {
  const region = planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(4, 4, 2, 2)] });
  const pieces = clipPath([[-5, 5], [15, 5]], region, { id: "line" });
  assert.deepEqual(pieces.map((p) => [p.id, p.points.map((q) => [...q]), p.from, p.to]), [
    ["line#0", [[0, 5], [4, 5]], 0.25, 0.45], ["line#1", [[6, 5], [10, 5]], 0.55, 0.75]]);
  const outside = clipPath([[-5, 5], [15, 5]], region, { id: "line", keep: "outside" });
  assert.deepEqual(outside.map((p) => p.points.map((q) => [...q])), [[[-5, 5], [0, 5]], [[4, 5], [6, 5]], [[10, 5], [15, 5]]]);
  assert.ok(deepFrozen(pieces));
  // A polyline turning through the region joins across its vertex.
  const bent = clipPath([[-2, 2], [3, 2], [3, 8], [12, 8]], region);
  assert.equal(bent.length, 1); assert.deepEqual(bent[0].points.map((q) => [...q]), [[0, 2], [3, 2], [3, 8], [10, 8]]);
});

test("boundary runs belong to the region and diagonal or touching paths behave", () => {
  const region = box(0, 0, 10);
  assert.deepEqual(clipPath([[-3, 0], [13, 0]], region).map((p) => p.points.map((q) => [...q])), [[[0, 0], [10, 0]]], "a path along an edge is kept");
  assert.deepEqual(clipPath([[-3, 0], [13, 0]], region, { keep: "outside" }).map((p) => p.points.map((q) => [...q])), [[[-3, 0], [0, 0]], [[10, 0], [13, 0]]]);
  assert.deepEqual(clipPath([[-5, 3], [5, 13]], region).map((p) => p.points.map((q) => [...q])), [[[0, 8], [2, 10]]]);
  // Touching a vertex from outside to outside keeps nothing inside; the outside piece is one polyline through the touch point.
  assert.equal(clipPath([[-5, 5], [5, 15]], region).length, 0);
  assert.equal(clipPath([[-1, 1], [1, -1]], region).length, 0);
  assert.deepEqual(clipPath([[-1, 1], [1, -1]], region, { keep: "outside" }).map((p) => p.points.map((q) => [...q])), [[[-1, 1], [0, 0], [1, -1]]]);
  // Through a vertex into the interior.
  assert.deepEqual(clipPath([[-2, -2], [3, 3]], region).map((p) => p.points.map((q) => [...q])), [[[0, 0], [3, 3]]]);
});

test("a path running along a slanted boundary edge is kept whole even when its midpoint is not representable", () => {
  const r = rng(8);
  for (let k = 0; k < 40; k++) {
    const a = 0.1 + r() * 3, b = 0.1 + r() * 3;
    const tri = planarRegion({ outer: [[0, 0], [a, b], [-1, 4]] });
    // (−a, −b) and (2a, 2b) are exactly collinear with the edge, but the interval midpoints are not on the line.
    const path: P[] = [[-a, -b], [2 * a, 2 * b]];
    const kept = clipPath(path, tri);
    assert.equal(kept.length, 1, `edge ${a},${b}`);
    near(kept[0].points[0][0], 0, 1e-14 * a); near(kept[0].points[1][1], b, 1e-14 * b);
    assert.equal(clipPath(path, tri, { keep: "outside" }).length, 2);
  }
});

test("closed paths: fully inside stay closed, cut ones merge across their start", () => {
  const region = box(0, 0, 10);
  const inside = clipPath(rect(2, 2, 3, 3), region, { closed: true });
  assert.equal(inside.length, 1); assert.equal(inside[0].closed, true); assert.equal(inside[0].points.length, 4);
  // Square straddling the right edge, starting inside: the two inside runs meet at the start vertex.
  const straddle = clipPath([[8, 2], [12, 2], [12, 6], [8, 6]], region, { closed: true });
  assert.equal(straddle.length, 1);
  const ring = straddle[0].points.map((q) => [...q]);
  assert.deepEqual(ring, [[10, 6], [8, 6], [8, 2], [10, 2]]);
  assert.equal(straddle[0].closed, false);
  const total = (ps: readonly { points: readonly (readonly number[])[] }[]) => ps.reduce((s, p) => s + p.points.slice(1).reduce((q, pt, i) => q + Math.hypot(pt[0] - p.points[i][0], pt[1] - p.points[i][1]), 0), 0);
  near(total(straddle) + total(clipPath([[8, 2], [12, 2], [12, 6], [8, 6]], region, { closed: true, keep: "outside" })), 16, 1e-12, "the two results partition the path");
});

test("clipPaths keeps uncut paths as the same object and derives ids and seeds for pieces", () => {
  const region = box(0, 0, 10);
  const mk = (id: string, points: P[], closed = false): Path => ({ id, seed: 77, points, closed, level: 2, levelFraction: 0.5, tone: 1 });
  const whole = mk("a", [[1, 1], [5, 5]]), cut = mk("b", [[5, 5], [20, 5]]), gone = mk("c", [[20, 20], [30, 30]]);
  const out = clipPaths([whole, cut, gone], region);
  assert.equal(out.length, 2); assert.equal(out[0], whole);
  assert.equal(out[1].id, "b#0"); assert.deepEqual(out[1].points.map((p) => [...p]), [[5, 5], [10, 5]]);
  assert.equal(out[1].level, 2); assert.equal(out[1].tone, 1); assert.notEqual(out[1].seed, 77);
  assert.equal(clipPaths([cut], region)[0].seed, out[1].seed, "seeds are reproducible");
  const shrunk = box(0, 0, 8);
  assert.equal(clipPaths([whole, cut], shrunk)[0], whole, "a path's id does not depend on the other paths");
});

test("clipping partitions random paths and pieces lie where they claim", () => {
  const r = rng(5);
  const region = domainDifference(planarRegion({ outer: star(r, 0, 0, 12, 4, 9) }), planarRegion({ outer: star(r, 0, 0, 6, 1, 2.5) }));
  for (let k = 0; k < 60; k++) {
    const path: P[] = Array.from({ length: 2 + Math.floor(r() * 6) }, () => [r() * 24 - 12, r() * 24 - 12]);
    const length = (pts: readonly (readonly number[])[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const inside = clipPath(path, region), outside = clipPath(path, region, { keep: "outside" });
    near(inside.reduce((s, p) => s + length(p.points), 0) + outside.reduce((s, p) => s + length(p.points), 0), length(path), 1e-9 * length(path) + 1e-9, "conservation of length");
    for (const [set, want] of [[inside, true], [outside, false]] as const) for (const piece of set) for (let i = 1; i < piece.points.length; i++) {
      const mx = (piece.points[i][0] + piece.points[i - 1][0]) / 2, my = (piece.points[i][1] + piece.points[i - 1][1]) / 2;
      assert.equal(domainContains(region, mx, my), want, "piece midpoint classification");
    }
    for (const piece of [...inside, ...outside]) for (const q of piece.points) assert.ok(Number.isFinite(q[0]) && Number.isFinite(q[1]));
  }
});

test("path clipping bounds its work", () => {
  const r = rng(2);
  const region = planarRegion({ outer: star(r, 0, 0, 3000, 8, 9) });
  const path: P[] = Array.from({ length: 4000 }, (_, k): P => [Math.sin(k) * 12, Math.cos(k * 1.3) * 12]);
  planarCode(() => clipPath(path, region, { maxWork: 1000 }), "WORK_LIMIT", /maxWork/);
  planarCode(() => clipPath([[0, 0]], region), "INVALID_INPUT", /at least 2/);
});

// ---------------------------------------------------------------------------------------------
test("hatching a rectangle gives the hand-computed strokes, and holes split them", () => {
  const region = planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(4, 4, 2, 2)] });
  const strokes = hatchDomain(region, { spacing: 2 });
  assert.deepEqual(strokes.map((s) => [s.id, s.line, s.points.map((p) => [...p])]), [
    ["hatch(region)/h0#0", 0, [[0, 1], [10, 1]]], ["hatch(region)/h1#0", 1, [[0, 3], [10, 3]]],
    ["hatch(region)/h2#0", 2, [[0, 5], [4, 5]]], ["hatch(region)/h2#1", 2, [[6, 5], [10, 5]]],
    ["hatch(region)/h3#0", 3, [[0, 7], [10, 7]]], ["hatch(region)/h4#0", 4, [[0, 9], [10, 9]]]]);
  const vertical = hatchDomain(box(0, 0, 10), { spacing: 5, angle: 90 });
  assert.deepEqual(vertical.map((s) => s.points.map((p) => [...p])), [[[7.5, 0], [7.5, 10]], [[2.5, 0], [2.5, 10]]], "direction 90° runs up, lines are ordered by their normal offset");
});

test("hatch lines are anchored to the origin, never to the region", () => {
  const a = hatchDomain(box(0, 0, 10), { spacing: 2, angle: 30, id: "h" }), b = hatchDomain(box(0, 0, 10), { spacing: 2, angle: 30, id: "h", origin: [0, 0] });
  assert.deepEqual(a, b);
  // A region translated by a whole number of spacings along the normal yields the same lines with shifted indices.
  const shift = hatchDomain(box(0, 6, 10), { spacing: 2, id: "h" });
  const base = hatchDomain(box(0, 0, 10), { spacing: 2, id: "h" });
  assert.deepEqual(shift.map((s) => s.line), base.map((s) => s.line + 3));
  // A line exactly along a horizontal edge is kept iff the region is on the +normal side (phase 0).
  const flat = hatchDomain(box(0, 0, 4), { spacing: 2, phase: 0 });
  assert.deepEqual(flat.map((s) => s.points[0][1]), [0, 2], "bottom edge kept (region above), top edge not");
});

test("hatch length integrates the area over random polygons and never enters holes", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const r = rng(seed * 13);
    const region = domainDifference(planarRegion({ outer: star(r, 0, 0, 12, 4, 9) }), planarRegion({ outer: star(r, 0, 0, 5, 0.8, 2.5) }));
    const spacing = 0.05, angle = r() * 180;
    const strokes = hatchDomain(region, { spacing, angle });
    const total = strokes.reduce((s, h) => s + Math.hypot(h.points[1][0] - h.points[0][0], h.points[1][1] - h.points[0][1]), 0);
    near(total * spacing, region.area, region.perimeter * spacing, `area by hatching, seed ${seed}`);
    for (const s of strokes) {
      const m: P = [(s.points[0][0] + s.points[1][0]) / 2, (s.points[0][1] + s.points[1][1]) / 2];
      assert.equal(locateInDomain(region, m[0], m[1]), "inside", "stroke midpoint");
    }
  }
  planarCode(() => hatchDomain(box(0, 0, 1000), { spacing: 1e-3 }), "WORK_LIMIT", /spacing/);
  planarCode(() => hatchDomain(box(0, 0, 10), { spacing: 0 }), "INVALID_INPUT", /spacing/);
});

// ---------------------------------------------------------------------------------------------
test("mask boundaries: exact pixel area, nested holes, diagonal contacts and frames", () => {
  const data = [
    1, 1, 1, 1, 1, 0, 0,
    1, 0, 0, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 0,
    1, 0, 0, 0, 1, 0, 1,
    1, 1, 1, 1, 1, 0, 0,
  ];
  const domain = maskDomain({ width: 7, height: 5, data });
  assert.equal(domain.regions.length, 4, "frame with island, and two lone pixels");
  near(domain.area, data.reduce((s, v) => s + v, 0));
  const frame = domain.regions.find((g) => g.holes.length === 1)!;
  assert.deepEqual(frame.outer.map((p) => [...p]), [[0, 0], [5, 0], [5, 5], [0, 5]]);
  assert.deepEqual(frame.holes[0].map((p) => [...p]), [[1, 1], [1, 4], [4, 4], [4, 1]]);
  // Diagonal neighbours are two regions touching at a point; 4-connected pixels are one region.
  const diag = maskDomain({ width: 2, height: 2, data: [1, 0, 0, 1] });
  assert.equal(diag.regions.length, 2); assertValid(diag);
  const checker = maskDomain({ width: 4, height: 4, data: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1] });
  assert.equal(checker.regions.length, 8); near(checker.area, 8);
  // cell size, origin and threshold.
  const scaled = maskDomain({ width: 2, height: 1, data: [0.2, 0.9] }, { cell: 4, origin: [10, 20], threshold: 0.5 });
  assert.deepEqual(scaled.regions[0].outer.map((p) => [...p]), [[14, 20], [18, 20], [18, 24], [14, 24]]);
  assert.equal(maskDomain({ width: 3, height: 3, data: new Array(9).fill(0) }).regions.length, 0);
  near(maskDomain({ width: 3, height: 3, data: new Array(9).fill(1) }).area, 9);
  // A ring of pixels connected only diagonally is not a hole of any one region.
  const loop = maskDomain({ width: 3, height: 3, data: [0, 1, 0, 1, 0, 1, 0, 1, 0] });
  assert.equal(loop.regions.length, 4); assert.ok(loop.regions.every((g) => g.holes.length === 0));
});

test("contour mode cuts corners at midpoints and interpolates scalar fields", () => {
  const lone = maskDomain({ width: 3, height: 3, data: [0, 0, 0, 0, 1, 0, 0, 0, 0] }, { mode: "contour" });
  near(lone.area, 0.5); assert.equal(lone.regions[0].outer.length, 4);
  const border = maskDomain({ width: 2, height: 2, data: [1, 1, 1, 1] }, { mode: "contour" });
  near(border.area, 4 - 4 * 0.125, 1e-12, "regions touching the raster border close along it, cutting each corner by the midpoint rule");
  // Scalar ramp 0, 1 with threshold 0.25: the crossing sits 0.25 of the way between the two centres.
  const ramp = maskDomain({ width: 2, height: 3, data: [0, 1, 0, 1, 0, 1] }, { mode: "contour", threshold: 0.25 });
  const xs = ramp.regions[0].outer.map((p) => p[0]);
  near(Math.min(...xs), 0.5 + 0.25, 1e-12);
  near(maskDomain({ width: 3, height: 3, data: [1, 1, 1, 1, 0, 1, 1, 1, 1] }, { mode: "contour" }).regions[0].holes.length, 1, 0);
  // Threshold exactly equal to a sample value stays a valid, nonempty result.
  const exact = maskDomain({ width: 3, height: 3, data: [0, 0.5, 0, 0.5, 1, 0.5, 0, 0.5, 0] }, { mode: "contour", threshold: 0.5 });
  assertValid(exact); assert.ok(exact.area > 0);
});

test("labels share boundaries exactly, before and after simplification", () => {
  const w = 40, h = 30, r = rng(4);
  const cells = Array.from({ length: 6 }, () => [r() * w, r() * h]);
  const data = Array.from({ length: w * h }, (_, k) => {
    const x = k % w, y = Math.floor(k / w);
    let best = 0, d = Infinity;
    cells.forEach(([cx, cy], i) => { const q = (x - cx) ** 2 + (y - cy) ** 2; if (q < d) { d = q; best = i; } });
    return best + 1;
  });
  for (const simplify of [0, 0.9, 2.5]) {
    const labels = labelDomains({ width: w, height: h, data }, { simplify });
    assert.deepEqual(labels.map((l) => l.label), [1, 2, 3, 4, 5, 6].filter((label) => data.includes(label)));
    const union = unionDomains(labels.map((l) => l.domain));
    near(union.area, labels.reduce((s, l) => s + l.domain.area, 0), 1e-9, `simplify ${simplify}: no overlaps between labels`);
    if (simplify === 0) near(union.area, w * h, 1e-9, "no gaps between labels");
    assert.equal(union.regions.length, 1); assert.equal(union.regions[0].holes.length, 0);
    for (const l of labels) assertValid(l.domain, `label ${l.label} simplify ${simplify}`);
    if (simplify === 0) for (const l of labels) near(l.domain.area, data.filter((v) => v === l.label).length, 0);
  }
  const bg = labelDomains({ width: 2, height: 2, data: [0, 1, 1, 2] });
  assert.deepEqual(bg.map((l) => l.label), [1, 2]);
  assert.deepEqual(labelDomains({ width: 2, height: 2, data: [0, 1, 1, 2] }, { background: null }).map((l) => l.label), [0, 1, 2]);
});

test("simplification keeps every dropped vertex within tolerance and never breaks topology", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const r = rng(seed * 101), w = 30, h = 30;
    const noise = Array.from({ length: 64 }, () => r());
    const data = Array.from({ length: w * h }, (_, k) => {
      const x = (k % w) / 6, y = Math.floor(k / w) / 6, ix = Math.floor(x), iy = Math.floor(y);
      const at = (i: number, j: number) => noise[((i * 7 + j * 13) & 63)];
      const fx = x - ix, fy = y - iy;
      const v = at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
      return v > 0.5 ? 1 : 0;
    });
    const exact = maskDomain({ width: w, height: h, data });
    for (const tolerance of [0.5, 1.2, 3]) {
      const thin = maskDomain({ width: w, height: h, data }, { simplify: tolerance });
      assertValid(thin, `seed ${seed} tol ${tolerance}`);
      const vertices = (d: PlanarDomain) => domainRings(d).reduce((s, ring) => s + ring.length, 0);
      assert.ok(vertices(thin) <= vertices(exact));
      // every original vertex lies within tolerance of the simplified boundary
      for (const ring of domainRings(exact)) for (const [x, y] of ring) {
        let best = Infinity;
        for (const other of domainRings(thin)) for (let i = 0, j = other.length - 1; i < other.length; j = i++) {
          const [ax, ay] = other[j], [bx, by] = other[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
          const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2));
          best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
        }
        assert.ok(best <= tolerance + 1e-9, `vertex ${x},${y} is ${best} from the simplified boundary`);
      }
    }
    const viaDomain = simplifyDomain(exact, 1.2);
    assertValid(viaDomain, `simplifyDomain seed ${seed}`);
  }
  near(simplifyDomain(box(0, 0, 10), 5).area, 100);
});

/** Blobby label rasters (smoothed noise, or raw noise when radius is 0) quantised to `labels` values. */
function labelBlobs(seed: number, w: number, h: number, labels: number, radius: number): number[] {
  const r = rng(seed), g = Array.from({ length: w * h }, () => r()), smooth = g.map((_, k) => {
    const x = k % w, y = Math.floor(k / w);
    let s = 0, c = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += g[yy * w + xx]; c++; } }
    return s / c;
  });
  const lo = Math.min(...smooth), hi = Math.max(...smooth);
  return smooth.map((v) => Math.min(labels - 1, Math.floor(((v - lo) / (hi - lo)) * labels)));
}

test("label simplification keeps islands and shared vertices on their side: chords never cut a ring's interior or sweep across an island", () => {
  // Two failure modes the first version had: a chord joining two vertices of one ring ran through that ring's interior (pinched
  // pieces), and a chord replacing a long boundary swept over a small ring lying between it and the boundary (the island
  // changed sides, its hole vanished and areas overlapped). Coarse tolerances over random label rasters reach both.
  for (let seed = 1; seed <= 90; seed++) {
    const w = 14 + (seed % 17), h = 12 + (seed % 11), labels = 2 + (seed % 3), radius = seed % 3, data = labelBlobs(seed * 7919, w, h, labels, radius);
    const exact = labelDomains({ width: w, height: h, data }, { background: null });
    for (const simplify of [3, 6]) {
      const thin = labelDomains({ width: w, height: h, data }, { background: null, simplify, protectFrame: true });
      let total = 0;
      for (const { label, domain } of thin) {
        assertValid(domain, `seed ${seed} label ${label} tol ${simplify}`);
        assert.deepEqual(domain.regions.map((g) => g.holes.length).sort(), exact.find((e) => e.label === label)!.domain.regions.map((g) => g.holes.length).sort(), `seed ${seed} label ${label}: holes`);
        total += domain.area;
      }
      near(total, w * h, 1e-6, `seed ${seed} tol ${simplify}: the labels no longer tile the raster`);
    }
  }
});

test("protectFrame keeps the four corners of the raster frame under any simplification", () => {
  // A one pixel region in each corner would be cut off by any coarse chord; with the frame protected each keeps its own corner vertex.
  const w = 12, h = 9, data = Array.from({ length: w * h }, () => 0);
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) data[y * w + x] = 1;
  const corners = new Set(["0,0", `${w},0`, `0,${h}`, `${w},${h}`]);
  const holds = (list: ReturnType<typeof labelDomains>) => new Set(list.flatMap((l) => l.domain.regions.flatMap((g) => [...g.outer, ...g.holes.flat()])).map((p) => p.join(",")));
  const held = holds(labelDomains({ width: w, height: h, data }, { background: null, simplify: 20, protectFrame: true }));
  for (const c of corners) assert.ok(held.has(c), `corner ${c} kept`);
  // Without it a coarse chord cuts a corner off the picture (area is lost); the option is opt-in and the default is unchanged.
  const free = labelDomains({ width: w, height: h, data }, { background: null, simplify: 20 });
  assert.ok(free.reduce((s, l) => s + l.domain.area, 0) < w * h - 0.5);
  near(labelDomains({ width: w, height: h, data }, { background: null, simplify: 20, protectFrame: true }).reduce((s, l) => s + l.domain.area, 0), w * h, 1e-6);
  const rings = (list: ReturnType<typeof labelDomains>) => JSON.stringify(list.map((l) => l.domain.regions.map((g) => [g.outer, g.holes])));
  assert.equal(rings(labelDomains({ width: w, height: h, data }, { background: null, simplify: 0.5 })), rings(labelDomains({ width: w, height: h, data }, { background: null, simplify: 0.5, protectFrame: false })));
});

test("raster failures name the argument", () => {
  planarCode(() => maskDomain({ width: 3, height: 2, data: [1, 1, 1] }), "INVALID_INPUT", /width × height = 6/);
  planarCode(() => maskDomain({ width: 2, height: 1, data: [1, Number.NaN] }), "INVALID_INPUT", /data\[1\]/);
  planarCode(() => labelDomains({ width: 2, height: 1, data: [1, 1.5] }), "INVALID_INPUT", /not a label/);
  planarCode(() => maskDomain({ width: 4000, height: 4000, data: [] }), "WORK_LIMIT", /pixels/);
  planarCode(() => maskDomain({ width: 1, height: 1, data: [1] }, { cell: 0 }), "INVALID_INPUT", /cell/);
  planarCode(() => maskDomain({ width: 1, height: 1, data: [1] }, { simplify: -1 }), "INVALID_INPUT", /simplify/);
});

// ---------------------------------------------------------------------------------------------
test("bridges: rectangles from Region values, partition output, and outline type", () => {
  const one = rectangleRegion({ id: "cell", bounds: [10, 20, 40, 30] });
  near(one.area, 300); assert.equal(one.id, "cell");
  assert.deepEqual(one.outer.map((p) => [...p]), [[10, 20], [40, 20], [40, 30], [10, 30]]);
  planarCode(() => rectangleRegion({ bounds: [1, 1, 1, 5] }), "INVALID_INPUT", /right > left/);
  const regions = partitionRegions({ seed: 5, width: 600, height: 400, centerX: 300, centerY: 200, columns: 8, rows: 5, attempts: 20, axis: "LONGEST", bias: 0 });
  const tiles = rectangleDomain(regions);
  near(tiles.area, regions.reduce((s, g) => s + (g.bounds[2] - g.bounds[0]) * (g.bounds[3] - g.bounds[1]), 0), 1e-6);
  assert.deepEqual(tiles.regions.map((g) => g.id), regions.map((g) => g.id), "region ids and order are kept");
  const merged = unionDomains(tiles.regions);
  near(merged.area, tiles.area, 1e-6);
  assert.equal(tiles.regions.length, regions.length);

  const holes = (text: string) => textDomain(text, { centerX: 100, centerY: 50, width: 190, height: 90 }).regions.map((g) => g.holes.length).sort();
  assert.deepEqual(holes("O"), [1]);
  assert.deepEqual(holes("8"), [2]);
  assert.deepEqual(holes("B"), [2]);
  assert.deepEqual(holes("I"), [0]);
  assert.deepEqual(holes("L"), [0]);
  const word = textDomain("OO", { centerX: 100, centerY: 50, width: 190, height: 90 });
  assert.equal(word.regions.length, 2);
  near(word.area, word.regions.reduce((s, g) => s + g.area, 0));
  assert.ok(word.bounds![0] >= 5 - 1e-9 && word.bounds![2] <= 195 + 1e-9 && word.bounds![1] >= 5 - 1e-9 && word.bounds![3] <= 95 + 1e-9);
  assertValid(word);
  assert.throws(() => textDomain("é", { centerX: 0, centerY: 0, width: 1, height: 1 }), /printable ASCII/);
});

test("keyholeRing joins holes with zero-width cuts and preserves the area", () => {
  const region = planarRegion({ outer: rect(0, 0, 10, 10), holes: [rect(2, 2, 2, 2), rect(6, 6, 2, 2)] });
  const ring = keyholeRing(region);
  near(signed(ring), region.area, 1e-12);
  assert.equal(ring.length, 4 + 2 * (4 + 2), "each hole adds its vertices, its start vertex again, and the outer vertex again");
  const plain = box(0, 0, 3);
  assert.equal(keyholeRing(plain), plain.outer);
  planarCode(() => keyholeRing({ ...region }), "INVALID_INPUT");
});

test("keyholeRings keeps overlapping contours separate and joins counters even when they touch the outline", () => {
  const A = rect(0, 0, 10, 10), B = rect(6, 6, 10, 10), hole = rect(2, 2, 3, 3).reverse();
  const polygons = keyholeRings([A, B, hole]);
  assert.equal(polygons.length, 2, "outer rings are not merged");
  near(signed(polygons[0]), 100 - 9); near(signed(polygons[1]), 100);
  // A counter whose every vertex lies on the outline (as after clipping a glyph to a module) still belongs to it.
  const touching = keyholeRings([rect(0, 0, 10, 10), [[0, 0], [0, 5], [5, 0]]]);
  assert.equal(touching.length, 1); near(signed(touching[0]), 100 - 12.5);
  assert.equal(keyholeRings([rect(0, 0, 10, 10), [[20, 20], [20, 22], [22, 20]]]).length, 1, "a counter outside every outline is dropped");
  assert.equal(keyholeRings([[[0, 0], [1, 0], [2, 0]]]).length, 0, "rings without area are dropped");
});

test("the per-ring rectangle clip keeps the enclosed area of a simple ring, which equals the Boolean intersection", () => {
  const r = rng(17);
  for (let k = 0; k < 60; k++) {
    const ring = star(r, 5 + r() * 4, 5 + r() * 4, 12, 2, 8), w = 4 + r() * 8, h = 4 + r() * 8;
    const clipped = clipRingToRect(ring, w, h);
    const expected = domainIntersection(planarRegion({ outer: ring }), box(0, 0, w, h)).area;
    near(clipped ? Math.abs(signed(clipped)) : 0, expected, 1e-9, `ring ${k}`);
  }
  assert.equal(clipRingToRect(rect(20, 20, 2, 2), 10, 10), null);
});

test("the stencil is a closed planar domain: edges belong to it and a line along an edge is kept whole", () => {
  const box100 = { shape: "rectangle" as const, centerX: 50, centerY: 50, width: 100, height: 100 };
  const support = resolveSupport({ footprint: box100 }, 0.02);
  for (const [x, y] of [[0, 0], [100, 100], [0, 50], [100, 50], [50, 0], [50, 100]] as const) assert.equal(supportContains(support, x, y), true, `${x},${y}`);
  assert.equal(supportContains(support, 100.0001, 50), false);
  const along = clipToSupport([[-20, 0], [120, 0]], false, support);
  assert.equal(along.pieces.length, 1); near(along.pieces[0][0][0], 0); near(along.pieces[0][1][0], 100);
  const masked = resolveSupport({ footprint: box100, mask: { invert: true, source: { kind: "regions", regions: [{ bounds: [40, 40, 60, 60] }], inset: 0 } } }, 0.02);
  assert.equal(supportContains(masked, 50, 50), false); assert.equal(supportContains(masked, 40, 50), true, "the mask boundary belongs to the stencil");
  near(masked.domain.area, 10000 - 400);
});

test("overlapped, rotated outline type offsets without non-convergence: the reported repro", () => {
  // Nearly concurrent strokes of overlapping glyphs: re-split crossings used to creep along a sliver for ever (NOT_CONVERGED after 32 rounds).
  const text = outlineText({ id: "t", lines: ["0869", "4@&%"] });
  const layout = outlineLayout({ text, kerning: "optical", tracking: -0.2, size: 40, leading: 1.25, centerX: 0, centerY: 640, rotation: -13 });
  for (const kind of ["word", "line", "block"] as const) for (const unit of outlineUnits(layout, kind)) for (const join of ["round", "miter", "bevel"] as const) {
    const grown = offsetDomain(unit.domain, 2, { join }), shrunk = offsetDomain(unit.domain, -2, { join });
    assertValid(grown, `${unit.id} ${join}`); assertValid(shrunk, `${unit.id} ${join}`);
    near(domainDifference(unit.domain, grown).area, 0, 1e-6, `${unit.id} ${join}: growth contains the letters`);
    near(domainDifference(shrunk, unit.domain).area, 0, 1e-6, `${unit.id} ${join}: shrinking stays inside`);
    assert.ok(grown.area > unit.domain.area && shrunk.area < unit.domain.area);
    near(domainUnion(unit.domain, grown).area, grown.area, 1e-6 * grown.area);
  }
});

test("offsets of 500 seeded overlapped glyph layouts never fail to converge and keep their area identities", () => {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@&%$#8B";
  let offsets = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const r = rng(seed * 2654435761);
    const line = () => Array.from({ length: 3 + Math.floor(r() * 4) }, () => chars[Math.floor(r() * chars.length)]).join("");
    const text = outlineText({ id: "t", lines: [line(), line()] });
    const kerning = (["metric", "optical", "mono"] as const)[Math.floor(r() * 3)];
    const options = { text, kerning, tracking: -0.25 + r() * 0.3, size: 20 + r() * 80, leading: 0.8 + r() * 1.2, centerX: r() * 200 - 100, centerY: r() * 1300 - 100, rotation: r() * 360 - 180 };
    const kind = (["glyph", "word", "line", "block"] as const)[Math.floor(r() * 4)];
    for (const unit of outlineUnits(outlineLayout(options), kind)) {
      const d = (0.3 + r() * 5) * (r() < 0.6 ? 1 : -1), join = (["round", "miter", "bevel"] as const)[Math.floor(r() * 3)];
      const out = offsetDomain(unit.domain, d, { join });
      offsets++;
      for (const g of out.regions) planarRegion(asData(g));
      const escaped = d > 0 ? domainDifference(unit.domain, out).area : domainDifference(out, unit.domain).area;
      assert.ok(escaped <= 1e-6 * unit.domain.area, `seed ${seed} ${unit.id} ${d} ${join}: ${escaped} of the original is on the wrong side`);
      assert.ok(d > 0 ? out.area >= unit.domain.area - 1e-9 : out.area <= unit.domain.area + 1e-9, `seed ${seed}: ${d > 0 ? "growth" : "shrinkage"} moved area the wrong way`);
    }
  }
  assert.ok(offsets > 1500, `only ${offsets} offsets checked`);
});
