import assert from "node:assert/strict";
import test from "node:test";
import {
  WASH_LIMITS, canPrepareInstrument, createInstrument, definitions, domainIntersection, domainUnion, drawInstrument, drawPolygonWatercolor,
  locateInDomain, offsetDomain, planarDomain, planarRegion, polygonWatercolorComposition, polygonWatercolorParent, polygonWatercolorPasses, prepareInstrument, usesSeed, validateInstrument, visibleParameters,
  textDomain, washBroadest, washLaw, washOctaves, washOffset, washOutline, washParentDomain, washPasses, washWork,
  type CompositionSurface, type DrawingContext, type PlanarDomain, type WashBoundary, type WashOptions, type WashPass,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

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

type Params = Record<string, number | string | boolean>;
const near = (actual: number, expected: number, tolerance: number, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const instrument = (params: Params = {}, seed = 42) => { const input = createInstrument("polygon-watercolor"); return { ...input, seed, params: { ...input.params, ...params } }; };
const recipeFor = (params: Params = {}, seed = 42) => polygonWatercolorComposition(instrument(params, seed));

const boundary: WashBoundary = { swell: 0.2, octaves: 1, roughness: 0.5, variance: 1, independence: 0, divergence: "all" };
const options = (patch: Partial<WashOptions> & { boundary?: Partial<WashBoundary> } = {}): WashOptions => ({
  seed: 7, passes: 4, creep: 0, patches: null, coupling: "one", holes: "reserved", margin: 0, ...patch,
  boundary: { ...boundary, ...patch.boundary },
});
const square = (x0: number, y0: number, x1: number, y1: number, id = "sq") => planarDomain([{ id, outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }], { id });
const shoelace = (ring: readonly (readonly [number, number])[]) => { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
/** Nonzero winding number of a point about a set of rings (independent oracle). */
const winding = (rings: readonly (readonly (readonly [number, number])[])[], x: number, y: number) => {
  let w = 0;
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) w++; }
    else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) w--;
  }
  return w;
};
/** Small deterministic generator, independent of the library's seeds. */
const lcg = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000;
const pearson = (a: number[], b: number[]) => {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return ab / Math.sqrt(aa * bb);
};
const cloud = (b: WashBoundary, side: number, passA: number, passB: number, n = 9000) => {
  const random = lcg(99), xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = random() * 4000, y = random() * 4000;
    xs.push(washOffset(5, "wash", passA, b, side, x, y)[0]); ys.push(washOffset(5, "wash", passB, b, side, x, y)[0]);
  }
  return { xs, ys };
};
const rms = (values: number[]) => Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);

test("two passes' displacements have correlation exactly 1 - independence; independence 0 is one boundary", () => {
  for (const [independence, expected, tolerance] of [[0, 1, 1e-12], [0.36, 0.64, 0.06], [0.75, 0.25, 0.06], [1, 0, 0.06]] as const) {
    const { xs, ys } = cloud({ ...boundary, independence }, 400, 0, 3);
    near(pearson(xs, ys), expected, tolerance, `independence ${independence}`);
  }
  const same = cloud({ ...boundary, independence: 0 }, 400, 1, 5, 200);
  assert.deepEqual(same.xs, same.ys);
});

test("octaves diverge as documented: all, fine only (coarse shared) or coarse only", () => {
  const side = 400, octaves = 3, swell = 0.3, variance = 0.8, roughness = 0.6;
  for (const divergence of ["all", "fine", "coarse"] as const) {
    const b: WashBoundary = { swell, octaves, roughness, variance, independence: 1, divergence };
    // Documented law: rms A_o = min(0.1 v S 2^(-(1 - 0.8 r) o), 0.3 S / 2^o); rho_o = independence * t_o.
    const amplitude = [0, 1, 2].map((o) => Math.min(0.1 * variance * swell * side * 2 ** (-(1 - 0.8 * roughness) * o), 0.3 * swell * side / 2 ** o));
    const t = [0, 1, 2].map((o) => divergence === "all" ? 1 : divergence === "fine" ? o / 2 : 1 - o / 2);
    const expected = amplitude.reduce((s, a, o) => s + a * a * (1 - t[o]), 0) / amplitude.reduce((s, a) => s + a * a, 0);
    const { xs, ys } = cloud(b, side, 2, 9, 12000);
    near(pearson(xs, ys), expected, 0.06, divergence);
    near(rms(xs), Math.sqrt(amplitude.reduce((s, a) => s + a * a, 0)), 0.08 * Math.sqrt(amplitude.reduce((s, a) => s + a * a, 0)), `rms ${divergence}`);
  }
});

test("edge variance scales the displacement linearly up to the ripple cap; zero variance gives back the parent exactly", () => {
  const side = 400;
  const base = rms(cloud({ ...boundary, variance: 0.4, independence: 1 }, side, 0, 1, 6000).xs);
  near(base, 0.1 * 0.4 * 0.2 * side, 0.08 * 0.1 * 0.4 * 0.2 * side, "0.1 * v * S");
  near(rms(cloud({ ...boundary, variance: 0.8, independence: 1 }, side, 0, 1, 6000).xs) / base, 2, 0.15);
  assert.equal(washLaw({ ...boundary, variance: 0 }, side).amplitude[0], 0);
  for (const parent of [washParentDomain({ kind: "blob", lobes: 5, holes: 2, holeSize: 0.12 }, { centerX: 320, centerY: 320, width: 400, height: 380, rotation: 10 }, 3),
    textDomain("Wash", { centerX: 320, centerY: 320, width: 500, height: 200 })]) {
    const wash = washPasses(parent, options({ boundary: { variance: 0, independence: 1 }, passes: 3 }));
    for (const pass of wash.passes) {
      const region = parent.regions.find((r) => r.id === pass.region)!;
      const difference = domainUnion(pass.domain, region).area - domainIntersection(pass.domain, region).area;
      near(difference, 0, 1e-6 * region.area, `${pass.id} differs from its parent`);
      near(pass.domain.area, region.area, 1e-9 * region.area);
    }
  }
});

test("reserved holes are never painted: ring analytics with and without margin, type counters, and an extra reserve", () => {
  const side = 400, r = 200 * 0.5, apothem = r * Math.cos(Math.PI / 96);
  const ring = washParentDomain({ kind: "ring", holeSize: 0.5 }, { centerX: 320, centerY: 320, width: side, height: side, rotation: 0 }, 1);
  const random = lcg(5);
  for (const margin of [0, 12]) {
    const wash = washPasses(ring, options({ margin, passes: 6, boundary: { variance: 1, independence: 1, swell: 0.3, octaves: 4 } }));
    for (const pass of wash.passes) {
      // Exact Boolean difference; computed crossing vertices are rounded to the nearest binary64 point, so slivers of a few 1e-14 may remain.
      assert.ok(domainIntersection(pass.domain, pass.reserved!).area < 1e-9, `${pass.id} intersects its reserve`);
      for (let i = 0; i < 400; i++) {
        const angle = random() * 2 * Math.PI, radius = random() * (apothem + margin - 0.05);
        assert.equal(locateInDomain(pass.domain, 320 + radius * Math.cos(angle), 320 + radius * Math.sin(angle)), "outside", `${pass.id} paints inside the reserve at radius ${radius}`);
      }
    }
    // The reserve is not merely empty space: the washes do reach a ring just beyond it in most passes.
    const reached = wash.passes.filter((p) => locateInDomain(p.domain, 320 + apothem + margin + 6, 320) === "inside").length;
    assert.ok(reached >= 3, `only ${reached} of 6 passes reach past the reserve`);
  }
  // An open ring washes over the counter.
  const open = washPasses(ring, options({ holes: "open", boundary: { variance: 0.2 } }));
  assert.ok(open.passes.every((p) => p.reserved === null && locateInDomain(p.domain, 320, 320) === "inside"));
  // Counters of type stay open in every pass; an extra reserve (type) stays open on a plain parent.
  const type = textDomain("BOB", { centerX: 320, centerY: 320, width: 500, height: 250 });
  for (const pass of washPasses(type, options({ margin: 1, passes: 5, boundary: { swell: 0.15, octaves: 3, independence: 1 } })).passes) {
    const region = type.regions.find((q) => q.id === pass.region)!;
    for (const hole of region.holes) {
      const cx = hole.reduce((s, p) => s + p[0], 0) / hole.length, cy = hole.reduce((s, p) => s + p[1], 0) / hole.length;
      assert.equal(locateInDomain(region, cx, cy), "outside", "the counter's centre is outside the parent");
      assert.equal(locateInDomain(pass.domain, cx, cy), "outside", `${pass.id} paints its counter`);
    }
  }
  const words = textDomain("HI", { centerX: 320, centerY: 320, width: 300, height: 200 });
  const covered = washPasses(square(100, 100, 540, 540), options({ reserve: words, margin: 3, passes: 4, boundary: { variance: 1, independence: 1 } }));
  for (const pass of covered.passes) {
    assert.ok(domainIntersection(pass.domain, words).area < 1e-9);
    assert.ok(pass.domain.area > 0.5 * 440 * 440 - words.area * 2);
  }
});

test("the fold policy: a raw displaced outline can cross itself, the pass never does and reversed loops paint nothing", () => {
  const disc = planarDomain([{ id: "disc", outer: Array.from({ length: 64 }, (_, i) => [320 + 100 * Math.cos(2 * Math.PI * i / 64), 320 + 100 * Math.sin(2 * Math.PI * i / 64)] as [number, number]) }], { id: "disc" });
  const wild = options({ passes: 8, boundary: { swell: 0.5, octaves: 6, roughness: 1, variance: 1, independence: 1 } });
  let folded = 0, reversedTotal = 0;
  const random = lcg(11);
  for (let k = 0; k < 8; k++) {
    const { rings } = washOutline(disc, wild, "disc", k);
    const raw = rings.map((r) => r.map((p) => [p[0], p[1]] as [number, number]));
    let crosses = false;
    try { planarRegion({ outer: raw[0] }); } catch (error) { crosses = /self|touch|cross/i.test(String(error)); }
    if (crosses) folded++;
    const pass = washPasses(disc, wild).passes[k];
    planarDomain(pass.domain.regions.map((q) => ({ id: q.id, outer: q.outer as [number, number][], holes: q.holes as [number, number][][] })));
    let inside = 0;
    for (let i = 0; i < 3000; i++) {
      const x = 130 + random() * 380, y = 130 + random() * 380, w = winding(raw, x, y), location = locateInDomain(pass.domain, x, y);
      if (location !== "boundary") assert.equal(location === "inside", w > 0, `pass ${k}: winding ${w} but ${location}`);
      if (w < 0) reversedTotal++;
      if (w > 0) inside++;
    }
    assert.ok(inside > 0);
  }
  assert.ok(reversedTotal > 0, "no reversed loop was sampled, so the policy was not exercised");
  assert.ok(folded >= 3, `only ${folded} of 8 wild outlines folded, so the policy was not exercised`);
});

test("touching regions move together under one field and pull apart under separate ones", () => {
  const parent = washParentDomain({ kind: "quilt", compartments: 12, merge: 0.3, layout: "abutting", gutter: 0 }, { centerX: 320, centerY: 320, width: 420, height: 380, rotation: 0 }, 9);
  assert.ok(parent.regions.length >= 6);
  // Below the fold threshold: a fold on a shared edge is dropped on one side and kept on the other (the loops have opposite orientation from the two sides), which opens a small overlap.
  const wobbly = { swell: 0.3, octaves: 3, roughness: 0.2, variance: 0.35, independence: 0.8 };
  for (const k of [0, 1, 2]) {
    const passes = washPasses(parent, options({ passes: 3, boundary: wobbly })).passes.filter((p) => p.index === k);
    const total = passes.reduce((s, p) => s + p.domain.area, 0);
    let overlap = 0;
    for (let i = 0; i < passes.length; i++) for (let j = i + 1; j < passes.length; j++) overlap += domainIntersection(passes[i].domain, passes[j].domain).area;
    assert.ok(overlap < 1e-9, `pass ${k}: shared edges overlap by ${overlap}`);
    const union = passes.map((p) => p.domain).reduce((a, b) => domainUnion(a, b));
    near(union.area, total, 1e-6, "union area is the sum of the parts");
    assert.equal(union.regions.length, 1, "the tiles stay one piece");
    assert.equal(union.regions[0].holes.length, 0, "no gap opens between tiles");
  }
  const separate = washPasses(parent, options({ passes: 3, coupling: "separate", boundary: wobbly })).passes.filter((p) => p.index === 0);
  let overlap = 0;
  for (let i = 0; i < separate.length; i++) for (let j = i + 1; j < separate.length; j++) overlap += domainIntersection(separate[i].domain, separate[j].domain).area;
  assert.ok(overlap > 20, `separate fields left only ${overlap} of overlap`);
});

test("ids and geometry are stable: passes only append, and appearance never reaches the producers", () => {
  const parent = polygonWatercolorParent(recipeFor());
  const few = washPasses(parent, options({ passes: 3, boundary: { independence: 0.6 } })), many = washPasses(parent, options({ passes: 6, boundary: { independence: 0.6 } }));
  few.passes.forEach((pass, i) => { assert.equal(pass.id, many.passes[i].id); assert.equal(pass, many.passes[i], "same pass objects are reused"); });
  assert.deepEqual(many.passes.map((p) => p.id), [0, 1, 2, 3, 4, 5].map((k) => `blob/p${k}`));
  assert.ok(many.passes.every((p) => p.domain.id === p.id && p.domain.regions.every((r, n) => r.id === `${p.id}/${n}`)));
  assert.equal(washPasses(parent, options({ passes: 3, boundary: { independence: 0.6 } })), few, "the same construction returns the same object");
  const other = washPasses(parent, options({ passes: 3, seed: 8, boundary: { independence: 0.6 } }));
  assert.notEqual(JSON.stringify(other.passes[0].domain), JSON.stringify(few.passes[0].domain));
  // Colour, opacity, edge and pigment are ink: same producer objects, same vertices, different paint.
  const a = recipeFor(), b = recipeFor({ opacity: 0.3, pigment: "two", mix: 0.9, edge: 0.7, edgeWeight: 2 });
  assert.equal(polygonWatercolorPasses(a), polygonWatercolorPasses({ ...b, palette: [1, 2, 3, 4] }));
  const vertices = (recipe: ReturnType<typeof recipeFor>) => { const r = new Recorder(); drawPolygonWatercolor(r, recipe); return r.ops.filter((op) => op.startsWith("vertex")).join("|"); };
  assert.equal(vertices(a), vertices({ ...b, edge: a.ink.edge, edgeWeight: a.ink.edgeWeight }));
  assert.notEqual(drawFingerprint(instrument()), drawFingerprint(instrument({ opacity: 0.3 })));
  assert.notEqual(drawFingerprint(instrument()), drawFingerprint({ ...instrument(), palette: [0x111111, 0x222222, 0x333333, 0x444444] }));
});

test("patches: each pass is the analytic patch ellipse when the boundary is left alone, and focus gathers them", () => {
  const big = square(20, 20, 620, 620);
  const patches = { size: 0.12, focus: 0 };
  const calm = options({ passes: 20, boundary: { variance: 0 }, patches });
  const sides = 32, halfDiagonal = Math.hypot(600, 600) / 2;
  // radius = size * halfDiagonal * (0.75 + 0.5 u), aspect 0.6 + 0.4 u': a patch polygon has area 1/2 n sin(2 pi / n) r^2 aspect, so the ratio to r^2 lies in [0.6, 1] times the polygon constant.
  const polygon = 0.5 * sides * Math.sin(2 * Math.PI / sides);
  let whole = 0;
  for (const pass of washPasses(big, calm).passes) {
    const lo = polygon * (0.12 * halfDiagonal * 0.75) ** 2 * 0.6, hi = polygon * (0.12 * halfDiagonal * 1.25) ** 2;
    assert.ok(pass.domain.area <= hi * (1 + 1e-9), `${pass.id} area ${pass.domain.area} above ${hi}`);
    assert.ok(pass.domain.regions.length <= 1);
    const ring = washOutline(big, calm, "sq", pass.index).patch!;
    const inside = ring.every((p) => locateInDomain(big, p[0], p[1]) === "inside");
    // A patch that lies inside the region is painted whole: its area is the ring's, and within the analytic range; a cut patch is smaller.
    if (inside) { whole++; near(pass.domain.area, Math.abs(shoelace(ring)), 1e-6, pass.id); assert.ok(pass.domain.area >= lo * (1 - 1e-9), `${pass.id} area ${pass.domain.area} below ${lo}`); }
    else assert.ok(pass.domain.area < Math.abs(shoelace(ring)));
  }
  assert.ok(whole >= 4, `only ${whole} of 20 patches were whole`);
  const spread = (focus: number) => {
    const centres = washPasses(big, options({ passes: 30, boundary: { variance: 0 }, patches: { size: 0.15, focus } })).passes.map((p) => p.domain.centroid!);
    const mx = centres.reduce((s, c) => s + c[0], 0) / centres.length, my = centres.reduce((s, c) => s + c[1], 0) / centres.length;
    return Math.sqrt(centres.reduce((s, c) => s + (c[0] - mx) ** 2 + (c[1] - my) ** 2, 0) / centres.length);
  };
  const scattered = spread(0), gathered = spread(1), half = spread(0.5);
  // At focus 1 every patch is centred on the same point (a patch cut by the region edge shifts its centroid a little).
  assert.ok(gathered < 0.02 * scattered, `focus 1 left a spread of ${gathered} against ${scattered}`);
  near(half / scattered, 0.5, 0.15, "spread is linear in 1 - focus");
  // A patch covers part of the region; the whole shape covers all of it.
  near(washPasses(big, options({ passes: 2, boundary: { variance: 0 } })).passes[0].domain.area, 600 * 600, 1e-6);
});

test("creep offsets pass k by creep * k with the exact Steiner area, growing and shrinking", () => {
  const w = 200, h = 100;
  const rect = square(100, 100, 100 + w, 100 + h);
  for (const creep of [2.5, -3]) {
    const passes = washPasses(rect, options({ passes: 5, creep, boundary: { variance: 0 } })).passes;
    passes.forEach((pass, k) => {
      const d = Math.abs(creep) * k;
      const expected = creep > 0 ? w * h + 2 * d * (w + h) + Math.PI * d * d : (w - 2 * d) * (h - 2 * d);
      // Round joins are inscribed polygons: the area is at most the true offset's, within the arc tolerance.
      near(pass.domain.area, expected, creep > 0 ? 0.004 * expected : 1e-6, `pass ${k} of creep ${creep}`);
      assert.ok(pass.domain.area <= expected + 1e-6);
    });
  }
  // Shrunk away entirely: a valid empty pass, not an error.
  const vanish = washPasses(rect, options({ passes: 3, creep: -30, boundary: { variance: 0 } })).passes;
  assert.equal(vanish[2].domain.regions.length, 0);
  assert.equal(vanish[2].domain.area, 0);
  assert.equal(vanish[2].edges.length, 0);
});

test("work is bounded and measured before any pass exists; every invalid option names its control", () => {
  const side = 1000, big = square(0, 0, side, side, "big"), huge = square(0, 0, 4000, 4000, "huge");
  // Square of side 1000, swell .4, 5 octaves: finest wavelength 400 / 16 = 25, spacing 25 / 3, so 4 * ceil(1000 / (25 / 3)) samples per pass.
  const per = 4 * Math.ceil(1000 / (25 / 3));
  assert.equal(washWork(big, options({ passes: 10, boundary: { swell: 0.4, octaves: 5 } })), 10 * per);
  // Square of side 4000, swell .1 (broadest 400), 8 octaves: finest 400 / 128 = 3.125, spacing 3.125 / 3, so 4 * ceil(4000 / (3.125 / 3)) samples per pass; 64 passes pass the limit.
  const over = options({ passes: 64, boundary: { swell: 0.1, octaves: 8 } });
  assert.equal(washWork(huge, over), 64 * 4 * Math.ceil(4000 / (3.125 / 3)));
  assert.ok(washWork(huge, over) > WASH_LIMITS.vertices);
  // Detail is a maximum: the finest scales are dropped until the budget holds. 7 octaves: spacing 400 / 64 / 3, 64 * 4 * ceil(4000 / (400 / 64 / 3)) = 491,520 samples.
  assert.equal(washOctaves(huge, over), 7);
  assert.equal(washPasses(huge, over).work, 64 * 4 * Math.ceil(4000 / (400 / 64 / 3)));
  assert.equal(washOctaves(huge, options({ passes: 30, boundary: { swell: 0.1, octaves: 8 } })), 8);
  // ... and until the finest ripple is at least 2 units, and the broadest at least 4: side 100, swell .08 gives 8 units, so 3 scales (8, 4, 2); swell .005 gives 4, so 2 scales.
  const small = square(0, 0, 100, 100, "small");
  assert.equal(washOctaves(small, options({ boundary: { swell: 0.08, octaves: 5 } })), 3);
  assert.equal(washOctaves(small, options({ boundary: { swell: 0.005, octaves: 5 } })), 2);
  assert.equal(washBroadest({ ...boundary, swell: 0.005 }, 100), 4);
  assert.equal(washLaw({ ...boundary, swell: 0.005, octaves: 2 }, 100).wavelength[0], 4);
  // Only a parent whose single-scale outline alone passes the budget is refused: 3600 separate 10-unit squares at 1.33-unit spacing, 32 samples each.
  const squares = planarDomain(Array.from({ length: 3600 }, (_, i) => ({ id: `s${i}`, outer: [[(i % 60) * 12, Math.floor(i / 60) * 12], [(i % 60) * 12 + 10, Math.floor(i / 60) * 12], [(i % 60) * 12 + 10, Math.floor(i / 60) * 12 + 10], [(i % 60) * 12, Math.floor(i / 60) * 12 + 10]] as [number, number][] })), { id: "grid" });
  assert.throws(() => washPasses(squares, options({ passes: 6, boundary: { swell: 0.005, octaves: 1 } })), /boundary samples.*limit of 600000.*even with a single ripple scale.*Passes/s);
  const bad: [Partial<WashOptions> & { boundary?: Partial<WashBoundary> }, RegExp][] = [
    [{ passes: 0 }, /Passes must be an integer/], [{ passes: 65 }, /Passes must be an integer/], [{ passes: 1.5 }, /Passes must be an integer/],
    [{ boundary: { swell: 0 } }, /Swell must be/], [{ boundary: { octaves: 9 } }, /Detail must be an integer/], [{ boundary: { independence: 1.1 } }, /Independence must be/],
    [{ boundary: { variance: -1 } }, /Edge variance must be/], [{ boundary: { roughness: 2 } }, /Roughness must be/], [{ margin: -1 }, /Reserve margin must be/],
    [{ creep: Infinity }, /Pass creep must be/], [{ patches: { size: 0, focus: 0 } }, /Patch size must be/], [{ patches: { size: 1, focus: 2 } }, /Patch focus must be/],
    [{ seed: -1 }, /Seed must be/]
  ];
  for (const [patch, message] of bad) assert.throws(() => washPasses(big, options(patch)), message, JSON.stringify(patch));
  assert.equal(washPasses(planarDomain([]), options()).passes.length, 0);
});

test("bundled parents are frozen, cached, valid and fitted to their box; bad input names its control", () => {
  const box = { centerX: 300, centerY: 340, width: 360, height: 240, rotation: 0 };
  const ring = washParentDomain({ kind: "ring", holeSize: 0.4 }, box, 1);
  assert.equal(ring, washParentDomain({ kind: "ring", holeSize: 0.4 }, box, 999), "a ring has no chance in it, so the seed is not part of its identity");
  const ideal = Math.PI * 180 * 120 * (1 - 0.4 * 0.4), polygon = 96 * Math.sin(2 * Math.PI / 96) / (2 * Math.PI);
  near(ring.area, ideal * polygon, 1e-6 * ideal, "annulus area");
  assert.deepEqual(ring.bounds!.map((v) => Math.round(v)), [120, 220, 480, 460]);
  assert.ok(Object.isFrozen(ring) && Object.isFrozen(ring.regions[0]));
  const blob = washParentDomain({ kind: "blob", lobes: 5, holes: 3, holeSize: 0.1 }, box, 4);
  assert.equal(blob.regions.length, 1);
  assert.equal(blob.regions[0].holes.length, 3);
  assert.notDeepEqual(blob.regions[0].outer, washParentDomain({ kind: "blob", lobes: 5, holes: 3, holeSize: 0.1 }, box, 5).regions[0].outer, "the seed changes the outline");
  const quilt = washParentDomain({ kind: "quilt", compartments: 10, merge: 0, layout: "abutting", gutter: 0 }, box, 2);
  assert.ok(quilt.regions.length >= 7 && quilt.regions.length <= 10, `${quilt.regions.length} compartments for 10 requested`);
  near(quilt.area, 360 * 240, 1e-6, "abutting compartments tile the box");
  const gapped = washParentDomain({ kind: "quilt", compartments: 10, merge: 0, layout: "gapped", gutter: 10 }, box, 2);
  assert.ok(gapped.area < quilt.area - 1000 && gapped.regions.length === quilt.regions.length);
  const unmerged = washParentDomain({ kind: "quilt", compartments: 14, merge: 0, layout: "abutting", gutter: 0 }, box, 2);
  const merged = washParentDomain({ kind: "quilt", compartments: 14, merge: 0.6, layout: "abutting", gutter: 0 }, box, 2);
  assert.equal(merged.regions.length, unmerged.regions.length - Math.floor(0.6 * unmerged.regions.length / 2), "each merge joins two compartments");
  assert.ok(merged.regions.some((r) => r.outer.length > 4), "merged compartments are non-rectangular");
  near(merged.area, 360 * 240, 1e-6);
  // A hole that finds no room shrinks until it fits, so crowded settings still give every hole: 12 large holes.
  const crowded = washParentDomain({ kind: "blob", lobes: 5, holes: 6, holeSize: 0.25 }, box, 1);
  assert.equal(crowded.regions[0].holes.length, 6);
  assert.throws(() => washParentDomain({ kind: "blob", lobes: 5, holes: 12, holeSize: 0.5 }, box, 1), /Could not place hole.*Hole count/);
  const roomy = washParentDomain({ kind: "blob", lobes: 5, holes: 2, holeSize: 0.1 }, box, 1);
  assert.ok(crowded.regions[0].holes.every((h) => Math.abs(shoelace(h as never)) > 0) && roomy.regions[0].holes.length === 2);
  // A gutter wider than a compartment leaves it nothing to wash: it is dropped, not an error (all of them at gutter 200 in this box, some at 90).
  const bare = washParentDomain({ kind: "quilt", compartments: 10, merge: 0, layout: "gapped", gutter: 200 }, box, 2);
  assert.equal(bare.regions.length, 0);
  const fewer = washParentDomain({ kind: "quilt", compartments: 10, merge: 0, layout: "gapped", gutter: 90 }, box, 2);
  assert.ok(fewer.regions.length > 0 && fewer.regions.length < quilt.regions.length, `${fewer.regions.length} of ${quilt.regions.length} compartments`);
  assert.throws(() => washParentDomain({ kind: "ring", holeSize: 1.2 }, box, 1), /Hole size/);
  const turned = washParentDomain({ kind: "letters", word: "BLOOM" }, { ...box, rotation: 90 }, 1), flat = washParentDomain({ kind: "letters", word: "BLOOM" }, box, 1);
  near(turned.area, flat.area, 1e-6 * flat.area, "rotation preserves area");
  near(turned.bounds![3] - turned.bounds![1], flat.bounds![2] - flat.bounds![0], 1e-6, "a quarter turn swaps the extents");
});

test("the descriptor is plain data, the painter is replaceable over the same frozen passes, and any domain can be washed", () => {
  const recipe = recipeFor();
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), recipe);
  const seen: WashPass[] = [];
  const surface = new Recorder();
  drawPolygonWatercolor(surface, recipe, { pass: (s, pass) => { seen.push(pass); s.line(0, 0, 1, 1); } });
  const produced = polygonWatercolorPasses(recipe);
  assert.equal(seen.length, produced.passes.length);
  seen.forEach((pass, i) => assert.equal(pass, produced.passes[i]));
  assert.ok(Object.isFrozen(produced) && Object.isFrozen(produced.passes[0]) && Object.isFrozen(produced.passes[0].domain));
  const custom: PlanarDomain = square(150, 200, 450, 380, "given");
  const wash = washPasses(custom, options({ passes: 3 }));
  assert.deepEqual(wash.passes.map((p) => p.id), ["given/p0", "given/p1", "given/p2"]);
  const drawn = new Recorder();
  drawPolygonWatercolor(drawn, { ...recipe, parent: { kind: "domain", domain: custom }, wash: { ...recipe.wash, passes: 3 } });
  assert.ok(drawn.ops.filter((op) => op.startsWith("endShape(close")).length >= 3);
  assert.throws(() => polygonWatercolorComposition({ ...instrument(), technique: "dry-bristles" }), /Not a polygon-watercolor input/);
  assert.throws(() => recipeFor({ passes: 100 }), /between 1 and 64/);
  assert.throws(() => recipeFor({ shape: "photograph" }), /not an available option/);
});

test("edges omit the stretches that lie on a mask, so a reserved boundary is stroked once, not once per pass", () => {
  const ring = washParentDomain({ kind: "ring", holeSize: 0.5 }, { centerX: 320, centerY: 320, width: 400, height: 400, rotation: 0 }, 1);
  const wash = washPasses(ring, options({ passes: 5, boundary: { variance: 0.6, independence: 1, swell: 0.3, octaves: 3 } }));
  for (const pass of wash.passes) {
    const length = (edge: { points: readonly (readonly [number, number])[]; closed: boolean }) => {
      let sum = 0;
      for (let i = 0; i + 1 < edge.points.length; i++) sum += Math.hypot(edge.points[i + 1][0] - edge.points[i][0], edge.points[i + 1][1] - edge.points[i][1]);
      return edge.closed && edge.points.length > 1 ? sum + Math.hypot(edge.points[0][0] - edge.points.at(-1)![0], edge.points[0][1] - edge.points.at(-1)![1]) : sum;
    };
    const drawn = pass.edges.reduce((s, e) => s + length(e), 0);
    assert.ok(drawn < pass.domain.perimeter - 1, `${pass.id} draws its whole outline`);
    // The mask is the hole's 96-gon (apothem 100 cos(pi / 96)): no drawn point is deeper inside it than rounding.
    for (const edge of pass.edges) for (const p of edge.points) assert.ok(Math.hypot(p[0] - 320, p[1] - 320) >= 100 * Math.cos(Math.PI / 96) - 1e-9, `edge point (${p}) is inside the mask`);
  }
});

test("preparation builds the passes cooperatively, honours cancellation and leaves the cache warm", async () => {
  assert.equal(canPrepareInstrument("polygon-watercolor"), true);
  const input = instrument({ shape: "letters", passes: 8 }, 3);
  assert.equal(await prepareInstrument(input, () => true), false);
  let checks = 0;
  assert.equal(await prepareInstrument(input, () => { checks++; return false; }), true);
  assert.ok(checks >= 2);
  const recipe = polygonWatercolorComposition(input);
  const first = polygonWatercolorPasses(recipe);
  assert.equal(polygonWatercolorPasses(recipe), first);
  let cancelAfter = 0;
  const fresh = instrument({ shape: "letters", passes: 9, swell: 0.31 }, 3);
  assert.equal(await prepareInstrument(fresh, () => ++cancelAfter > 3), false);
});

test("controls that matter change the picture, hidden ones do not, and groups are complete", () => {
  const picture = (params: Params, seed = 42) => drawFingerprint(instrument(params, seed));
  const base = picture({});
  for (const change of [{ passes: 8 }, { extent: "whole" }, { patchSize: 0.3 }, { focus: 1 }, { creep: 2 }, { independence: 0.1 }, { divergence: "coarse" }, { swell: 0.4 },
    { detail: 2 }, { roughness: 0.9 }, { variance: 0.3 }, { holeCount: 4 }, { holeSize: 0.2 }, { lobes: 8 }, { holes: "open" }, { margin: 15 }, { pigment: "two", mix: 0.6 },
    { opacity: 0.2 }, { edge: 0 }, { edgeWeight: 2 }, { rotation: 40 }, { width: 300 }, { centerX: 250 }, { shape: "ring" }, { shape: "letters" }, { shape: "quilt" }])
    assert.notEqual(picture(change), base, JSON.stringify(change));
  assert.notEqual(picture({}, 1), picture({}, 2));
  // usesSeed is exact where it says the seed is irrelevant: a calm ring or word with one whole-shape pass family is the same for every seed.
  for (const calm of [{ shape: "ring", variance: 0, extent: "whole", pigment: "one" }, { shape: "letters", variance: 0, extent: "whole", pigment: "one" }]) {
    assert.equal(usesSeed(instrument(calm)), false);
    assert.equal(picture(calm, 1), picture(calm, 2));
  }
  for (const seeded of [{ shape: "ring", variance: 0.5, extent: "whole" }, { shape: "ring", variance: 0, extent: "patches" }, { shape: "ring", variance: 0, extent: "whole", pigment: "two", mix: 0.5 }])
    assert.equal(usesSeed(instrument(seeded)), true);
  assert.notEqual(picture({ shape: "ring", variance: 0, extent: "patches" }, 1), picture({ shape: "ring", variance: 0, extent: "patches" }, 2));
  // Hidden while another choice decides: no effect.
  assert.equal(picture({ shape: "blob", ringHole: 0.2, word: "WASH", compartments: 20, merge: 0.7, layout: "gapped", gutter: 30, coupling: "separate" }), base);
  assert.equal(picture({ shape: "ring", lobes: 8, holeCount: 5, holeSize: 0.2 }), picture({ shape: "ring" }));
  assert.equal(picture({ extent: "whole", patchSize: 1, focus: 0 }), picture({ extent: "whole" }));
  assert.equal(picture({ pigment: "one", mix: 0.9 }), picture({ pigment: "one", mix: 0.1 }));
  assert.equal(picture({ holes: "open", margin: 25 }), picture({ holes: "open", margin: 0 }));
  assert.equal(picture({ shape: "quilt", rotation: 60, holes: "open" }), picture({ shape: "quilt" }));
  assert.equal(picture({ shape: "quilt", layout: "abutting", gutter: 30 }), picture({ shape: "quilt", layout: "abutting", gutter: 5 }));
  assert.equal(picture({ shape: "blob", coupling: "separate" }), base);
  const definition = definitions.find((d) => d.id === "polygon-watercolor")!;
  const shown = (params: Params) => visibleParameters("polygon-watercolor", { ...definition.defaults, ...params }).map((p) => p.key);
  assert.ok(!shown({ shape: "blob" }).includes("gutter") && shown({ shape: "quilt", layout: "gapped" }).includes("gutter") && !shown({ shape: "quilt", layout: "abutting" }).includes("gutter"));
  assert.ok(!shown({ shape: "quilt" }).includes("rotation") && shown({ shape: "letters" }).includes("coupling") && !shown({ shape: "ring" }).includes("coupling"));
  assert.ok(definition.controlGroups.some((g) => g.label === "Placement"));
});

test("drawing goes through a real 2d context call sequence: transparent, no background, one keyholed fill per region per pass", () => {
  const calls: string[] = [];
  const p = new Proxy({ CLOSE: "close", ROUND: "round", background: () => calls.push("background") } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => { calls.push(key); void args; }; },
  });
  drawInstrument(p as unknown as DrawingContext, instrument({ edge: 0 }));
  assert.ok(!calls.includes("background") && !calls.includes("rect"));
  const passes = polygonWatercolorPasses(recipeFor({ edge: 0 }));
  assert.equal(calls.filter((c) => c === "endShape").length, passes.passes.reduce((n, pass) => n + pass.domain.regions.length, 0));
});

test("every slider end, and every combination of slider ends, is admitted and draws", () => {
  const definition = definitions.find((d) => d.id === "polygon-watercolor")!;
  const numbers = definition.parameters.filter((p) => p.type === "number");
  const edge = (which: "min" | "max") => Object.fromEntries(numbers.map((p) => [p.key, p[which]!])) as Params;
  const surface = new Recorder();
  const draws = (params: Params, seed = 42) => {
    const input = instrument(params, seed);
    assert.deepEqual(validateInstrument(JSON.parse(JSON.stringify(input))).params, input.params);
    surface.ops.length = 0;
    drawInstrument(surface as unknown as DrawingContext, input);
    assert.ok(surface.ops.length > 0, JSON.stringify(params));
  };
  const worlds: Params[] = [];
  for (const shape of ["blob", "ring", "letters", "quilt"]) for (const extent of ["whole", "patches"]) for (const holes of ["reserved", "open"])
    worlds.push({ shape, extent, holes, layout: shape === "quilt" ? "gapped" : "abutting", coupling: "separate", pigment: "region" });
  for (const word of ["BLOOM", "PIGMENT", "tide", "WASH"]) worlds.push({ shape: "letters", word, extent: "patches", holes: "reserved" });
  let slowest = 0;
  for (const world of worlds) for (const which of ["min", "max"] as const) {
    const t = performance.now();
    draws({ ...world, ...edge(which) });
    if (which === "max") slowest = Math.max(slowest, performance.now() - t);
  }
  assert.ok(slowest < 2500, `the all-max corner took ${slowest.toFixed(0)} ms`);
  // Each control alone at each end, in the default world, and the blob's crowded corner for a few seeds.
  for (const p of numbers) for (const which of ["min", "max"] as const) draws({ [p.key]: p[which]! });
  for (const seed of [0, 1, 7, 99, 12345]) draws({ ...edge("max"), shape: "blob" }, seed);
});
