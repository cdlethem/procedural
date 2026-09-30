import assert from "node:assert/strict";
import test from "node:test";
import {
  CAP_HEIGHT, MAX_FILL_MARKS, OUTLINE_MIXED_KINDS, bundledOutlineTexts, createInstrument, definition, deformDomain, displacementField, displaceUnits, domainClearance,
  domainIntersection, drawInstrument, drawOutlineType, glyphOf, outlineLayout, outlineText, outlineTone, outlineTypeComposition,
  outlineTypeProducts, outlineUnits, planarDomain, prepareOutlineType, robustOffset, shadowDomain, unionDomains, offsetDomain, resolveOutlineFillKind, sweepDomain, trimPath, usesSeed, validateInstrument,
  type CompositionSurface, type OutlineText, type OutlineTypeComposition, type OutlineTypeProducts, type OutlineUnitProduct, type Path, type PlanarDomain,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const deepFrozen = (value: unknown): boolean =>
  value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value as object).every(deepFrozen));

// --- independent geometry helpers: even-odd and segment distance over a domain's own rings ---
type Pt = readonly [number, number];
const ringsOf = (d: PlanarDomain): (readonly Pt[])[] => d.regions.flatMap((r) => [r.outer, ...r.holes]);
function evenOdd(rings: readonly (readonly (readonly number[])[])[], x: number, y: number): boolean {
  let odd = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}
function boundaryDistance(rings: readonly (readonly (readonly number[])[])[], x: number, y: number): number {
  let best = Infinity;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
    best = Math.min(best, Math.hypot(ax + t * ex - x, ay + t * ey - y));
  }
  return best;
}
/** Inside the closed domain by independent arithmetic, allowing float dust on the boundary. */
const within = (d: PlanarDomain, [x, y]: Pt, dust = 1e-6): boolean => evenOdd(ringsOf(d), x, y) || boundaryDistance(ringsOf(d), x, y) <= dust;
const polygonArea = (ring: readonly Pt[]): number => Math.abs(ring.reduce((s, p, i) => s + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1], 0)) / 2;

// --- a recording surface that tracks the transform stack, so calls can be read in canvas coordinates ---
class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: [string, ...unknown[]][] = [];
  shapes: Pt[][] = []; lines: [Pt, Pt][] = []; circles: Pt[] = [];
  private stack: number[][] = []; private m = [1, 0, 0, 1, 0, 0]; private shape: Pt[] | null = null;
  private world(x: number, y: number): Pt { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  private mul(n: number[]): void { const m = this.m; this.m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
  push(): void { this.stack.push([...this.m]); this.ops.push(["push"]); }
  pop(): void { this.m = this.stack.pop() ?? this.m; this.ops.push(["pop"]); }
  translate(x: number, y: number): void { this.mul([1, 0, 0, 1, x, y]); }
  rotate(a: number): void { this.mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); }
  scale(x: number, y = x): void { this.mul([x, 0, 0, y, 0, 0]); }
  noFill(): void { this.ops.push(["noFill"]); } noStroke(): void { this.ops.push(["noStroke"]); }
  fill(...c: number[]): void { this.ops.push(["fill", ...c]); } stroke(...c: number[]): void { this.ops.push(["stroke", ...c]); }
  strokeWeight(w: number): void { this.ops.push(["strokeWeight", w]); } strokeCap(): void {}
  circle(x: number, y: number, d: number): void { this.circles.push(this.world(x, y)); this.ops.push(["circle", d]); }
  line(a: number, b: number, c: number, d: number): void { this.lines.push([this.world(a, b), this.world(c, d)]); this.ops.push(["line"]); }
  rect(): void { this.ops.push(["rect"]); }
  beginShape(): void { this.shape = []; }
  vertex(x: number, y: number): void { this.shape!.push(this.world(x, y)); }
  endShape(): void { this.shapes.push(this.shape!); this.ops.push(["endShape"]); this.shape = null; }
  count(name: string): number { return this.ops.filter((op) => op[0] === name).length; }
}

// --- recipes ---
function recipeOf(params: Record<string, unknown> = {}, seed = 42): OutlineTypeComposition {
  const input = createInstrument("outline-type");
  input.seed = seed; Object.assign(input.params, params);
  return outlineTypeComposition(input);
}
const single = (text: string) => outlineText({ id: "t", lines: [text] });
/** A recipe over any text, with the fill fixed and the field, outlines and shadow switched off unless stated. */
function directRecipe(text: OutlineText, params: Record<string, unknown> = {}, seed = 42): OutlineTypeComposition {
  return { ...recipeOf({ displace: "none", outline: "none", shadow: "none", fill: "none", unit: "glyph", ...params }, seed), text };
}
const layoutOf = (lines: string[], over: Record<string, unknown> = {}) => outlineLayout({ text: outlineText({ id: "t", lines }), kerning: "metric", tracking: 0, size: 100, leading: 1.3,
  centerX: 300, centerY: 250, rotation: 0, ...over } as never);

test("text scope: printable ASCII only, with visible errors instead of substitution", () => {
  assert.throws(() => outlineText({ id: "x", lines: ["caf\u00e9"] }), /Line 1 character 4 \("é", U\+00E9\) has no glyph.*nothing is substituted/);
  assert.throws(() => outlineText({ id: "x", lines: ["ok", "e\u0301"] }), /Line 2 character 2 .*U\+0301/, "a combining mark is refused, not folded into its base");
  assert.throws(() => outlineText({ id: "x", lines: ["of\ufb01ce"] }), /Line 1 character 3 .*U\+FB01/, "a ligature code point has no glyph");
  assert.throws(() => outlineText({ id: "x", lines: ["\u{1F600}"] }), /U\+1F600/);
  assert.throws(() => outlineText({ id: "x", lines: ["   "] }), /not a space/);
  assert.throws(() => outlineText({ id: "x", lines: [] }), /1–4 lines/);
  assert.throws(() => outlineText({ id: "x", lines: ["a", "b", "c", "d", "e"] }), /1–4 lines/);
  assert.throws(() => outlineText({ id: "x", lines: ["A".repeat(15)] }), /1–14 characters/);
  assert.throws(() => outlineText({ id: "has space", lines: ["A"] }), /id must be/);
  const text = outlineText({ id: "ok", lines: ["Az 09 ~", "{}"] });
  assert.ok(deepFrozen(text));
  for (const bundled of Object.values(bundledOutlineTexts)) assert.deepEqual(outlineText(bundled), bundled);
});

/** Nonzero winding of raw font rings, mapped by the documented layout transform. Independent of the kernel and of the layout code. */
function rawGlyphRings(char: string, size: number, cx: number, baseline: number): number[][][] {
  const glyph = glyphOf(char), s = size / CAP_HEIGHT;
  const rings = glyph.rings.map((ring) => ring.map(([x, y]) => [x - glyph.advance / 2, y]));
  const xs = rings.flat().map((p) => p[0]), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  return rings.map((ring) => ring.map(([x, y]) => [cx + s * (x - mid), baseline + s * y]));
}
function winding(rings: number[][][], x: number, y: number): number {
  let w = 0;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xj, yj] = ring[j], [xi, yi] = ring[i];
    if (yj <= y) { if (yi > y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) > 0) w++; }
    else if (yi <= y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) < 0) w--;
  }
  return w;
}

test("glyph domains are the font's ink: nonzero fill of the raw contours, counters as holes", () => {
  const holes: Record<string, number> = { O: 1, B: 2, A: 1, "8": 2, D: 1, P: 1, R: 1, e: 1, "%": 2, i: 0, H: 0, I: 0 };
  let seed = 12345;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (const [char, count] of Object.entries(holes)) {
    const layout = outlineLayout({ text: single(char), kerning: "metric", tracking: 0, size: 160, leading: 1.2, centerX: 300, centerY: 250, rotation: 0 });
    const domain = layout.glyphs[0].domain, baseline = layout.lines[0].baseline;
    near(baseline, 250 + 80, 1e-9, "one line: baseline is the centre plus half a cap height");
    assert.equal(domain.regions.reduce((n, r) => n + r.holes.length, 0), count, `${char} counters`);
    const raw = rawGlyphRings(char, 160, 300, baseline);
    const [l, t, r, b] = domain.bounds!;
    let checked = 0;
    for (let k = 0; k < 4000; k++) {
      const x = l - 2 + random() * (r - l + 4), y = t - 2 + random() * (b - t + 4);
      if (boundaryDistance(raw, x, y) < 1e-6) continue;
      assert.equal(evenOdd(ringsOf(domain), x, y), winding(raw, x, y) !== 0, `${char} at ${x.toFixed(2)},${y.toFixed(2)}`);
      checked++;
    }
    assert.ok(checked > 3900);
  }
  // A counter's centre is paper: for "O" the middle of the hole's box is outside the domain but inside the outer ring.
  const o = outlineLayout({ text: single("O"), kerning: "metric", tracking: 0, size: 200, leading: 1.2, centerX: 300, centerY: 250, rotation: 0 }).glyphs[0].domain.regions[0];
  const hb = o.holes[0].reduce(([a, b, c, d], p) => [Math.min(a, p[0]), Math.min(b, p[1]), Math.max(c, p[0]), Math.max(d, p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  assert.equal(evenOdd([o.outer], (hb[0] + hb[2]) / 2, (hb[1] + hb[3]) / 2), true);
  assert.equal(evenOdd([o.outer, ...o.holes], (hb[0] + hb[2]) / 2, (hb[1] + hb[3]) / 2), false);
});

test("layout algebra: baselines, leading, centring, cap height, rotation, stable ids", () => {
  const layout = layoutOf(["HELIO", "TIPBD"]);
  near(layout.lines[0].baseline, 250 + (-0.5) * 130 + 50, 1e-9); near(layout.lines[1].baseline, 250 + 0.5 * 130 + 50, 1e-9);
  near(layout.lines[1].baseline - layout.lines[0].baseline, 1.3 * 100, 1e-9, "leading × size");
  for (const g of layout.glyphs.filter((g) => "HELITPBD".includes(g.char))) {
    const [, top, , bottom] = g.domain.bounds!, base = layout.lines[g.line].baseline;
    near(bottom, base, 1e-9, `${g.id} stands on its baseline`);
    near(top, base - 100, 1e-9, `${g.id} reaches the cap height`);
  }
  for (const line of layout.lines) {
    const boxes = layout.glyphs.filter((g) => g.line === line.index).map((g) => g.domain.bounds!);
    near((Math.min(...boxes.map((b) => b[0])) + Math.max(...boxes.map((b) => b[2]))) / 2, 300, 1e-9, "ink centred on centerX");
    near(line.left, Math.min(...boxes.map((b) => b[0])), 1e-9); near(line.right, Math.max(...boxes.map((b) => b[2])), 1e-9);
  }
  // Glyphs advance left to right, never overlapping at zero tracking, and the ids name line and character index.
  assert.deepEqual(layout.glyphs.map((g) => g.id), ["l0/g0", "l0/g1", "l0/g2", "l0/g3", "l0/g4", "l1/g0", "l1/g1", "l1/g2", "l1/g3", "l1/g4"]);
  for (let i = 1; i < 5; i++) assert.ok(layout.glyphs[i].domain.bounds![0] > layout.glyphs[i - 1].domain.bounds![0]);
  // A space keeps its index and has no domain.
  assert.deepEqual(layoutOf(["A B"]).glyphs.map((g) => [g.id, g.word]), [["l0/g0", 0], ["l0/g2", 1]]);
  // Ids ignore size, tracking, kerning, placement and rotation; areas scale with size squared and ignore rotation.
  const other = layoutOf(["HELIO", "TIPBD"], { size: 40, tracking: 0.2, kerning: "optical", centerX: 90, rotation: 30 });
  assert.deepEqual(other.glyphs.map((g) => g.id), layout.glyphs.map((g) => g.id));
  layout.glyphs.forEach((g, i) => near(other.glyphs[i].domain.area, g.domain.area * 0.16, 1e-6 * g.domain.area, `${g.id} area`));
  const turned = layoutOf(["HELIO", "TIPBD"], { rotation: 90 });
  layout.glyphs.forEach((g, i) => near(turned.glyphs[i].domain.area, g.domain.area, 1e-6 * g.domain.area));
  // A quarter turn clockwise about the centre maps (x, y) to (cx − (y − cy), cy + (x − cx)): the first line's baseline runs down the canvas.
  const h0 = layout.glyphs[0].domain.bounds!, t0 = turned.glyphs[0].domain.bounds!;
  near(t0[0], 300 - (h0[3] - 250), 1e-6); near(t0[2], 300 - (h0[1] - 250), 1e-6);
  assert.ok(deepFrozen(layout));
  assert.equal(layoutOf(["HELIO", "TIPBD"]), layout, "the layout is cached by construction");
  assert.throws(() => layoutOf(["A"], { size: 1 }), /Type size must be finite and in \[4, 2000\]/);
});

test("units: words, lines and the block are exact unions; touching letters merge, counters survive", () => {
  const spaced = layoutOf(["OO", "AB"]);
  const glyphs = outlineUnits(spaced, "glyph"), words = outlineUnits(spaced, "word"), lines = outlineUnits(spaced, "line"), block = outlineUnits(spaced, "block");
  assert.deepEqual(words.map((u) => u.id), ["l0/w0", "l1/w0"]); assert.deepEqual(lines.map((u) => u.id), ["l0", "l1"]); assert.deepEqual(block.map((u) => u.id), ["all"]);
  assert.equal(glyphs[0].domain, spaced.glyphs[0].domain, "a glyph unit is the glyph's own domain");
  assert.deepEqual(words[0].glyphs, ["l0/g0", "l0/g1"]);
  near(words[0].domain.area, glyphs[0].domain.area + glyphs[1].domain.area, 1e-6, "apart, the union is the sum");
  near(block[0].domain.area, spaced.glyphs.reduce((s, g) => s + g.domain.area, 0), 1e-6);
  // Overlap by tracking: area = a + b − a∩b, one region, both counters kept.
  const tight = layoutOf(["OO"], { tracking: -0.25 });
  const [a, b] = tight.glyphs.map((g) => g.domain), overlap = domainIntersection(a, b).area;
  assert.ok(overlap > 100, "the letters overlap");
  const merged = outlineUnits(tight, "word")[0].domain;
  near(merged.area, a.area + b.area - overlap, 1e-6);
  assert.equal(merged.regions.length, 1);
  assert.equal(merged.regions[0].holes.length, 2, "both counters stay holes");
  assert.equal(outlineUnits(tight, "glyph").length, 2);
  assert.equal(outlineUnits(spaced, "word"), words, "units are cached per layout");
  assert.throws(() => outlineUnits(spaced, "paragraph" as never), /Unknown unit kind/);
});

// --- displacement ---
const rect = (l: number, t: number, r: number, b: number, id = "r") => planarDomain({ outer: [[l, t], [r, t], [r, b], [l, b]] }, { id });
const framed = planarDomain({ outer: [[0, 0], [40, 0], [40, 30], [0, 30]], holes: [[[10, 10], [10, 20], [30, 20], [30, 10]]] }, { id: "frame" });

test("displacing a domain moves its boundary by the field and keeps its topology", () => {
  const moved = deformDomain(framed, () => [3, -2], { step: 2 });
  near(moved.area, framed.area, 1e-9); assert.deepEqual(moved.bounds, [3, -2, 43, 28]);
  for (const ring of ringsOf(framed)) for (const [x, y] of ring) assert.ok(ringsOf(moved).some((r) => r.some((p) => p[0] === x + 3 && p[1] === y - 2)), "every original vertex moved exactly by the field");
  assert.equal(moved.regions[0].holes.length, 1);
  // A vertical ripple depending on x alone keeps every vertical chord's length: the area is unchanged, the counter survives.
  const ripple = deformDomain(framed, (x) => [0, 4 * Math.sin(x / 6)], { step: 0.25 });
  near(ripple.area / framed.area, 1, 2e-3); assert.equal(ripple.regions.length, 1); assert.equal(ripple.regions[0].holes.length, 1);
  for (const [x, y] of framed.regions[0].outer) assert.ok(ripple.regions[0].outer.some((p) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - (y + 4 * Math.sin(x / 6))) < 1e-9));
  // A shear (x + 0.5y, y) preserves area exactly.
  near(deformDomain(framed, (_x, y) => [0.5 * y, 0], { step: 1 }).area, framed.area, 1e-9);
  // A fold-over field still yields a valid domain: every ring simple, resolved by nonzero fill.
  const folded = deformDomain(framed, (x, y) => [60 * Math.sin(y / 3), 20 * Math.cos(x / 4)], { step: 0.5 });
  assert.ok(folded.area > 0); assert.doesNotThrow(() => planarDomain(folded));
  assert.throws(() => deformDomain(framed, () => [0, 0], { step: 1e-4 }), /more than 200000 boundary vertices.*Correlation length/);
  assert.throws(() => deformDomain(framed, () => [0, 0], { step: 0 }), /positive/);
  const layout = layoutOf(["BOLD"]);
  const units = outlineUnits(layout, "glyph");
  assert.equal(displaceUnits(units, { kind: "none" }, 1), units);
  assert.equal(displaceUnits(units, { kind: "noise", amount: 0, length: 20 }, 1), units, "zero amount is no displacement");
  const wobbled = displaceUnits(units, { kind: "noise", amount: 2, length: 40 }, 1);
  assert.deepEqual(wobbled.map((u) => u.id), units.map((u) => u.id), "ids survive displacement");
  wobbled.forEach((u, i) => { assert.equal(u.domain.regions.reduce((n, r) => n + r.holes.length, 0), units[i].domain.regions.reduce((n, r) => n + r.holes.length, 0), `${u.id} counters`); });
  assert.equal(displaceUnits(units, { kind: "noise", amount: 2, length: 40 }, 1), wobbled, "cached per unit list and field");
  assert.notEqual(displaceUnits(units, { kind: "noise", amount: 2, length: 40 }, 2), wobbled);
});

test("named fields: bounded, smooth in canvas coordinates, seeded", () => {
  const noise = displacementField({ kind: "noise", amount: 5, length: 30 }, 7);
  let seed = 99;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let peak = 0, sameEverywhere = true;
  for (let k = 0; k < 5000; k++) {
    const x = random() * 640, y = random() * 640, [dx, dy] = noise(x, y);
    assert.ok(Math.abs(dx) <= 5 && Math.abs(dy) <= 5, "each channel is bounded by the amount");
    peak = Math.max(peak, Math.abs(dx));
    const [ex, ey] = noise(x + 0.3, y - 0.2);
    assert.ok(Math.abs(ex - dx) < 8 * 5 * 0.36 / 30 && Math.abs(ey - dy) < 8 * 5 * 0.36 / 30, "nearby points move alike (correlation length 30)");
    if (dx !== dy) sameEverywhere = false;
  }
  assert.ok(peak > 1.5, "the field is not flat"); assert.equal(sameEverywhere, false, "the two channels are independent");
  assert.deepEqual(noise(10, 20), displacementField({ kind: "noise", amount: 5, length: 30 }, 7)(10, 20));
  assert.notDeepEqual(noise(10, 20), displacementField({ kind: "noise", amount: 5, length: 30 }, 8)(10, 20));
  const wave = displacementField({ kind: "wave", amount: 6, length: 80 }, 3);
  let top = 0;
  for (let k = 0; k < 400; k++) {
    const x = k * 0.25, [dx, dy] = wave(x, 17);
    assert.equal(dx, 0); near(dy, wave(x + 80, 400)[1], 1e-9, "period is the length, independent of y"); top = Math.max(top, dy);
  }
  assert.ok(top > 5.99 && top <= 6);
  assert.notEqual(wave(5, 0)[1], displacementField({ kind: "wave", amount: 6, length: 80 }, 4)(5, 0)[1], "the ripple phase follows the seed");
  assert.deepEqual(displacementField({ kind: "none" }, 1)(3, 4), [0, 0]);
  assert.throws(() => displacementField({ kind: "swirl" } as never, 1), /Unknown displacement kind/);
});

test("planar additions: sweeping along a vector and clearance from the boundary", () => {
  const square = rect(0, 0, 10, 10);
  near(sweepDomain(square, 6, 0).area, 160, 1e-9); assert.deepEqual(sweepDomain(square, 6, 0).bounds, [0, 0, 16, 10]);
  near(sweepDomain(square, 3, 4).area, 100 + 10 * 3 + 10 * 4, 1e-9); assert.deepEqual(sweepDomain(square, 3, 4).bounds, [0, 0, 13, 14]);
  near(sweepDomain(square, -3, -4).area, 170, 1e-9);
  const ell = planarDomain({ outer: [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]] });
  near(ell.area, 64, 1e-9); near(sweepDomain(ell, 5, 0).area, 15 * 4 + 9 * 6, 1e-9, "each row widens by the vector");
  near(sweepDomain(ell, 0, 5).area, 64 + 5 * 10, 1e-9);
  const ring = planarDomain({ outer: [[0, 0], [20, 0], [20, 20], [0, 20]], holes: [[[5, 5], [5, 15], [15, 15], [15, 5]]] });
  const narrowed = sweepDomain(ring, 4, 0);
  near(narrowed.area, 24 * 20 - 6 * 10, 1e-9, "the counter narrows by the vector"); assert.equal(narrowed.regions[0].holes.length, 1);
  const closed = sweepDomain(ring, 12, 0);
  near(closed.area, 32 * 20, 1e-9, "a counter narrower than the vector closes"); assert.equal(closed.regions[0].holes.length, 0);
  assert.equal(sweepDomain(square, 0, 0).area, 100);
  assert.throws(() => sweepDomain(square, Number.NaN, 0), /dx/);
  // shadows: the copy or the sweep, never over any occluder, overlapping shadows counted once
  near(shadowDomain([square], 6, 0).area, 60, 1e-9); near(shadowDomain([square], 6, 0, { sweep: true }).area, 60, 1e-9);
  near(shadowDomain([square], 3, 4).area, 100 - 7 * 6, 1e-9); near(shadowDomain([square], 3, 4, { sweep: true }).area, 70, 1e-9);
  const next = rect(12, 0, 22, 10, "next");
  near(shadowDomain([square, next], 6, 0).area, 80, 1e-9, "the gap and the far side; nothing over the second square");
  near(shadowDomain([square, next], 6, 0, { sweep: true }).area, 80, 1e-9);
  assert.equal(shadowDomain([square], 0, 0).regions.length, 0); assert.equal(shadowDomain([], 1, 1).regions.length, 0);

  near(domainClearance(square, 5, 5), 5); near(domainClearance(square, 2, 7), 2); near(domainClearance(square, 2, 7, 1), 1, 1e-12, "capped at the limit");
  near(domainClearance(square, 13, 5), -3); near(domainClearance(square, 13, 14), -5, 1e-12, "outside a corner: the distance to the corner");
  assert.equal(domainClearance(square, 0, 4), 0); assert.equal(domainClearance(square, 10, 10), 0);
  const holed = planarDomain({ outer: [[0, 0], [10, 0], [10, 10], [0, 10]], holes: [[[4, 4], [4, 6], [6, 6], [6, 4]]] });
  near(domainClearance(holed, 5, 5), -1, 1e-12, "inside a counter is outside, by the distance to its wall");
  near(domainClearance(holed, 2, 5), 2, 1e-12); near(domainClearance(holed, 4, 5), 0);
  // Against brute force on random points of the lettered domain.
  const o = outlineLayout({ text: single("B"), kerning: "metric", tracking: 0, size: 120, leading: 1.2, centerX: 300, centerY: 250, rotation: 0 }).glyphs[0].domain;
  let seed = 5;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let k = 0; k < 600; k++) {
    const x = 240 + random() * 120, y = 180 + random() * 140, want = boundaryDistance(ringsOf(o), x, y) * (evenOdd(ringsOf(o), x, y) ? 1 : -1);
    near(domainClearance(o, x, y, 1000), want, 1e-9);
    near(domainClearance(o, x, y, 3), Math.sign(want) * Math.min(3, Math.abs(want)), 1e-9);
  }
});

// --- fills ---
function productsOf(params: Record<string, unknown>, seed = 42) { const recipe = recipeOf(params, seed); return { recipe, products: outlineTypeProducts(recipe) }; }
function densePoints(path: Path, step = 0.4): Pt[] {
  const out: Pt[] = [], pts = path.closed ? [...path.points, path.points[0]] : path.points;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}

test("every fill is exactly inside its unit: lines, shapes and marks, counters excluded", () => {
  const base = { phrase: "open", size: 120, spacing: 5, unit: "glyph", displace: "none", outline: "none" };
  const cases: Record<string, unknown>[] = [
    { fill: "hatch", cross: true, angle: 33 }, { fill: "waves", waveAmplitude: 4, waveLength: 20 }, { fill: "rings", chirp: 0.05 },
    { fill: "contours", steps: 12 }, { fill: "dots", lattice: "hex", markSize: 0.7, ramp: 0.6, angle: 12 }, { fill: "bands", steps: 7, angle: 25 },
    { fill: "solid" }, { fill: "mixed" }, { fill: "hatch", unit: "word", tracking: -0.15 }, { fill: "waves", unit: "block", origin: "unit" },
    { fill: "mixed", displace: "noise", displaceAmount: 0.06, displaceLength: 0.8 }, { fill: "hatch", displace: "wave", displaceAmount: 0.05, displaceLength: 1.4, unit: "line" },
  ];
  for (const params of cases) {
    const { products, recipe } = productsOf({ ...base, ...params }, 5);
    let strokes = 0, marks = 0, shapes = 0;
    for (const p of products.units) {
      if (!p.fill) continue;
      const domain = p.unit.domain;
      for (const path of p.fill.paths) for (const point of densePoints(path)) { assert.ok(within(domain, point), `${JSON.stringify(params)} ${path.id} leaves ${p.unit.id} at ${point}`); strokes++; }
      for (const shape of p.fill.shapes) {
        for (const ring of ringsOf(shape.domain)) for (const point of ring) assert.ok(within(domain, point), `${shape.id} vertex outside`);
        assert.ok(shape.domain.area <= domain.area + 1e-6);
        shapes++;
      }
      for (const mark of p.fill.marks) {
        assert.ok(evenOdd(ringsOf(domain), mark.position[0], mark.position[1]), "a mark is inside");
        assert.ok(boundaryDistance(ringsOf(domain), mark.position[0], mark.position[1]) >= mark.radius - 1e-9, `${mark.id} disc fits`);
        assert.ok(Math.abs(mark.radius - recipe.fill.markSize * recipe.fill.spacing * mark.scale / 2) < 1e-9);
        marks++;
      }
    }
    assert.ok(strokes + marks + shapes > 0, JSON.stringify(params));
  }
});

/** The single lettered rectangle "I": known width, height and centre, so fills have closed forms. */
function bar(params: Record<string, unknown> = {}) {
  const recipe = directRecipe(single("I"), { size: 100, centerX: 300, centerY: 250, angleSpread: 0, ...params });
  const products = outlineTypeProducts(recipe);
  const unit = products.units[0], [l, t, r, b] = unit.unit.domain.bounds!;
  assert.equal(unit.unit.domain.regions[0].outer.length, 4, "the bar is a rectangle");
  return { recipe, products, unit, l, t, r, b, w: r - l, h: b - t };
}

test("fill constructions against closed forms on a rectangle", () => {
  // hatch: lines sit at origin + (k + ½)·spacing from the block centre, each spanning the full width
  for (const angle of [0, 90]) {
    const { unit, l, t, r, b } = bar({ fill: "hatch", spacing: 6, angle, origin: "shared" });
    const centre = angle === 0 ? 250 : 300, lo = angle === 0 ? t : l, hi = angle === 0 ? b : r;
    const expected: number[] = [];
    for (let k = Math.ceil((lo - centre) / 6 - 0.5); k <= Math.floor((hi - centre) / 6 - 0.5); k++) expected.push(centre + (k + 0.5) * 6);
    if (angle === 90) expected.reverse(); // the normal of a 90° family points toward −x, so line indices run leftward
    const paths = unit.fill!.paths;
    assert.equal(paths.length, expected.length, `angle ${angle}`);
    paths.forEach((path, i) => {
      const [[x1, y1], [x2, y2]] = [path.points[0], path.points[1]];
      if (angle === 0) { near(y1, expected[i], 1e-9); near(y2, expected[i], 1e-9); near(Math.min(x1, x2), l, 1e-9); near(Math.max(x1, x2), r, 1e-9); }
      else { near(x1, expected[i], 1e-9); near(Math.min(y1, y2), t, 1e-9); near(Math.max(y1, y2), b, 1e-9); }
    });
  }
  // the total length of a slanted hatch is area / spacing (a line integral), on a lettered "O" with a counter
  const o = directRecipe(single("O"), { size: 200, fill: "hatch", spacing: 3, angle: 37 });
  const product = outlineTypeProducts(o).units[0];
  const length = product.fill!.paths.reduce((s, p) => s + Math.hypot(p.points[1][0] - p.points[0][0], p.points[1][1] - p.points[0][1]), 0);
  near(length * 3 / product.unit.domain.area, 1, 0.01, "Σ length · spacing ≈ area, counter excluded");
  assert.ok(product.fill!.paths.length > 100);
  // cross-hatch doubles the family, the second at 90°
  const cross = outlineTypeProducts(directRecipe(single("I"), { size: 100, fill: "hatch", spacing: 6, angle: 0, angleSpread: 0, cross: true })).units[0].fill!.paths;
  assert.ok(cross.some((p) => p.id.includes("/x/")) && cross.some((p) => !p.id.includes("/x/")));
  const vertical = cross.filter((p) => p.id.includes("/x/"));
  for (const p of vertical) near(p.points[0][0], p.points[1][0], 1e-9, "the second family is perpendicular");
  // contours: each ring is the rectangle inset by k·spacing while anything is left (w = 13.5 lasts two rings of 3)
  const c = bar({ fill: "contours", spacing: 3, steps: 9 });
  assert.equal(c.unit.fill!.paths.length, 2);
  c.unit.fill!.paths.forEach((path, i) => {
    const k = i + 1, xs = path.points.map((p) => p[0]), ys = path.points.map((p) => p[1]);
    near(Math.min(...xs), c.l + 3 * k, 1e-9); near(Math.max(...xs), c.r - 3 * k, 1e-9); near(Math.min(...ys), c.t + 3 * k, 1e-9); near(Math.max(...ys), c.b - 3 * k, 1e-9);
    assert.equal(path.closed, true);
  });
  // contours around a counter: the ring k of "O" is k·spacing from every boundary, exactly
  const oc = outlineTypeProducts(directRecipe(single("O"), { size: 200, fill: "contours", spacing: 4, steps: 5 })).units[0];
  for (const path of oc.fill!.paths) {
    const k = path.level;
    for (const [x, y] of path.points) near(boundaryDistance(ringsOf(oc.unit.domain), x, y), 4 * k, 0.16 + 1e-9, `ring ${k}`);
    assert.ok(path.points.every((p) => evenOdd(ringsOf(oc.unit.domain), p[0], p[1])));
  }
  // bands: layer k of stripes across y is the part of the rectangle from k/count of the way down
  const bands = bar({ fill: "bands", steps: 5, angle: 0 });
  assert.equal(bands.unit.fill!.shapes.length, 5);
  bands.unit.fill!.shapes.forEach((shape, k) => { near(shape.domain.area, bands.w * bands.h * (1 - k / 5), 1e-6); near(shape.domain.bounds![1], bands.t + bands.h * k / 5, 1e-9); assert.equal(shape.layer, k); });
  const across = bar({ fill: "bands", steps: 4, angle: 90 });
  across.unit.fill!.shapes.forEach((shape, k) => near(shape.domain.bounds![2], across.r - across.w * k / 4, 1e-9, "stripes turned 90° start from the right"));
  // straight waves are the hatch: same count and spans
  const straight = bar({ fill: "waves", waveAmplitude: 0, spacing: 6, angle: 0 });
  assert.equal(straight.unit.fill!.paths.length, bar({ fill: "hatch", spacing: 6, angle: 0 }).unit.fill!.paths.length);
  // rings about the block centre: radius (k + ½)·spacing; the first stays whole and closed
  const rings = bar({ fill: "rings", spacing: 6, origin: "shared" });
  const first = rings.unit.fill!.paths.find((p) => p.closed)!;
  for (const [x, y] of first.points) near(Math.hypot(x - 300, y - 250), 3, 1e-9);
  assert.equal(rings.unit.fill!.paths.filter((p) => p.closed).length, 1, "only rings narrower than the bar stay whole");
  for (const p of rings.unit.fill!.paths.filter((q) => !q.closed)) for (const [x, y] of p.points) {
    assert.ok(x >= rings.l - 1e-9 && x <= rings.r + 1e-9 && y >= rings.t - 1e-9 && y <= rings.b + 1e-9, "clipped arcs stay in the bar");
    const d = Math.hypot(x - 300, y - 250), nearest = Math.round((d - 3) / 6) * 6 + 3;
    assert.ok(Math.abs(d - nearest) < 0.125, `arc vertex at radius ${d} is on a ring (chord error 0.12)`);
  }
});

test("dot marks are exactly the lattice sites whose disc fits, and the ramp shrinks them along the angle", () => {
  const { unit, l, t, r, b, recipe } = bar({ fill: "dots", spacing: 6, markSize: 0.5, ramp: 0, lattice: "square", angle: 0, origin: "shared" });
  const radius = 1.5, expected: string[] = [];
  for (let j = -30; j <= 30; j++) for (let i = -30; i <= 30; i++) {
    const x = 300 + (i + 0.5) * 6, y = 250 + j * 6;
    if (x - l >= radius && r - x >= radius && y - t >= radius && b - y >= radius) expected.push(`${x.toFixed(6)},${y.toFixed(6)}`);
  }
  const got = unit.fill!.marks.map((m) => `${m.position[0].toFixed(6)},${m.position[1].toFixed(6)}`).sort();
  assert.deepEqual(got, expected.sort());
  assert.ok(expected.length > 10 && recipe.fill.markSize === 0.5);
  // hex rows are √3/2 apart and every other row is staggered half a period
  const hex = bar({ fill: "dots", spacing: 6, markSize: 0.3, ramp: 0, lattice: "hex", angle: 0 }).unit.fill!.marks;
  const rows = [...new Set(hex.map((m) => m.position[1].toFixed(6)))].map(Number).sort((p, q) => p - q);
  for (let k = 1; k < rows.length; k++) near(rows[k] - rows[k - 1], 6 * Math.sqrt(3) / 2, 1e-5);
  const xsAt = (row: number) => hex.filter((m) => Math.abs(m.position[1] - row) < 1e-6).map((m) => m.position[0]).sort((p, q) => p - q);
  near(((xsAt(rows[1])[0] - xsAt(rows[0])[0]) % 6 + 6) % 6, 3, 1e-9, "alternate rows are half a period apart");
  // ramp: the mark shrinks from scale 1 at one side of the unit to 1 − ramp at the other, along the angle direction
  const turned = bar({ fill: "dots", spacing: 6, markSize: 0.5, ramp: 0.6, lattice: "square", angle: 90 }), ramp = turned.unit.fill!.marks;
  const byY = [...ramp].sort((p, q) => p.position[1] - q.position[1]);
  assert.ok(byY[0].scale > byY[byY.length - 1].scale);
  ramp.forEach((m) => near(m.scale, 1 - 0.6 * (m.position[1] - turned.t) / (turned.b - turned.t), 1e-9));
});

test("the drawn shadow is every unit's shadow united and cleared of all letters", () => {
  const recipe = directRecipe(outlineText({ id: "ii", lines: ["II"] }), { size: 100, centerX: 300, centerY: 250, unit: "glyph" });
  const products = outlineTypeProducts({ ...recipe, shadow: { kind: "extrude", dx: 30, dy: 0 } });
  const [a, b] = products.units.map((u) => u.unit.domain.bounds!), gap = b[0] - a[2], h = a[3] - a[1];
  assert.ok(gap > 0 && gap < 30, "the first bar's extrusion reaches the second bar");
  near(products.shadow!.area, h * (gap + 30), 1e-6, "one region between and after the bars, no double cover");
  for (const [x, y] of [[(a[0] + a[2]) / 2, (a[1] + a[3]) / 2], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]]) assert.equal(evenOdd(ringsOf(products.shadow!), x, y), false, "no shadow over ink");
  assert.equal(outlineTypeProducts(recipe).shadow, null);
});

test("halos, insets and shadows are exact offsets and sweeps of the letter", () => {
  const base = { size: 100 };
  const rectangle = bar(base), { w, h } = rectangle;
  const halo = (join: "miter" | "round" | "bevel", d = 4) => outlineTypeProducts({ ...rectangle.recipe, outline: { edge: false, halo: d, inline: null, join } }).units[0].halo!;
  near(halo("miter").area, (w + 8) * (h + 8), 1e-6);
  near(halo("bevel").area, w * h + 8 * (w + h) + 2 * 16, 1e-6, "bevelled corners: 4·½·d² added at each corner");
  const round = halo("round").area, steiner = w * h + 8 * (w + h);
  assert.ok(round > steiner + 0.95 * Math.PI * 16 && round < steiner + Math.PI * 16, "round corners: an inscribed quarter disc each");
  const inset = (d: number) => outlineTypeProducts({ ...rectangle.recipe, outline: { edge: false, halo: null, inline: d, join: "round" } }).units[0].inline!;
  near(inset(2).area, (w - 4) * (h - 4), 1e-6);
  assert.equal(inset(w / 2 + 0.01).regions.length, 0, "a stroke narrower than twice the inset has no inline");
  const shadow = (kind: "cast" | "extrude", dx: number, dy: number) => outlineTypeProducts({ ...rectangle.recipe, shadow: { kind, dx, dy } }).units[0].shadow!;
  near(shadow("cast", 6, 10).area, w * h - (w - 6) * (h - 10), 1e-6, "the copy minus the letter");
  near(shadow("extrude", 6, 10).area, w * 10 + h * 6, 1e-6, "the sweep minus the letter");
  near(shadow("cast", -20, 0).area, w * h, 1e-6, "a shift beyond the width clears the letter entirely");
  for (const kind of ["cast", "extrude"] as const) {
    const s = shadow(kind, 8, 5);
    assert.ok(!within(rectangle.unit.unit.domain, [rectangle.l + 5, rectangle.t + 5]) || !evenOdd(ringsOf(s), rectangle.l + 5, rectangle.t + 5), "the shadow never covers the letter itself");
  }
  // counters shrink under a halo and grow under an inset (the "O" hole is a hole in the halo domain too)
  const o = directRecipe(single("O"), { size: 200 });
  const ho = outlineTypeProducts({ ...o, outline: { edge: true, halo: 5, inline: 5, join: "round" } }).units[0];
  const holeArea = (d: PlanarDomain) => d.regions[0].holes.reduce((s, ring) => s + polygonArea(ring), 0);
  assert.ok(holeArea(ho.halo!) < holeArea(ho.unit.domain) && holeArea(ho.inline!) > holeArea(ho.unit.domain));
});

test("products are cached by construction: appearance edits reuse everything, structural edits rebuild only what they change", () => {
  const base = outlineTypeProducts(recipeOf());
  assert.equal(outlineTypeProducts(recipeOf()), base);
  for (const appearance of [{ weight: 3 }, { colorBy: "unit" }, { stroke: "stitch", pitch: 4 }, { outlineWeight: 4 }, { wash: 0.5 }, { shadowOpacity: 0.9 }]) {
    assert.equal(outlineTypeProducts(recipeOf(appearance)), base, JSON.stringify(appearance));
  }
  assert.equal(outlineTypeProducts({ ...recipeOf(), palette: [1, 2, 3] }), base, "a palette edit reuses the products");
  for (const structural of [{ spacing: 7 }, { angle: 10 }, { fill: "hatch" }, { size: 100 }, { phrase: "open" }, { unit: "word" }, { displaceAmount: 0.08 }, { share: 0.5 }, { outline: "all" }, { shadow: "cast" }, { join: "miter", outline: "halo" }]) {
    assert.notEqual(outlineTypeProducts(recipeOf(structural)), base, JSON.stringify(structural));
  }
  // a fill edit keeps the letters: same layout, same glyph domains and ids
  assert.equal(outlineTypeProducts(recipeOf({ spacing: 8, fill: "hatch" })).layout, base.layout);
  assert.deepEqual(outlineTypeProducts(recipeOf({ spacing: 8 })).units.map((u) => u.unit.id), base.units.map((u) => u.unit.id));
  assert.notEqual(outlineTypeProducts(recipeOf({ tracking: 0.2 })).layout, base.layout);
  assert.ok(deepFrozen(base));
  assert.equal(base.units.length, 8);
  assert.deepEqual(base.units.map((u) => u.unit.id), ["l0/g0", "l0/g1", "l0/g2", "l0/g3", "l1/g0", "l1/g1", "l1/g2", "l1/g3"]);
  // ids of the fill come from lattice and unit ids, so a seed change that leaves the technique alone keeps them
  const ids = (x: OutlineTypeProducts) => x.units.flatMap((u) => u.fill!.paths.map((p) => p.id)).join("|");
  assert.equal(ids(outlineTypeProducts(recipeOf({ fill: "rings", displace: "none" }, 1))), ids(outlineTypeProducts(recipeOf({ fill: "rings", displace: "none" }, 2))));
});

test("seeds change structure where chance belongs, and nowhere else", () => {
  const kinds = (seed: number) => outlineTypeProducts(recipeOf({ fill: "mixed", displace: "none" }, seed)).units.map((u) => u.fill!.kind).join();
  assert.notEqual(kinds(1), kinds(2)); assert.equal(kinds(1), kinds(1));
  const counts: Record<string, number> = {};
  for (let k = 0; k < 600; k++) { const kind = resolveOutlineFillKind({ kind: "mixed" }, 9, `l0/g${k}`); counts[kind] = (counts[kind] ?? 0) + 1; }
  for (const kind of OUTLINE_MIXED_KINDS) assert.ok(counts[kind] > 60 && counts[kind] < 150, `${kind}: ${counts[kind]}`);
  assert.equal(resolveOutlineFillKind({ kind: "waves" }, 9, "x"), "waves");
  // share: raising it only adds filled units
  const filled = (share: number) => new Set(outlineTypeProducts(recipeOf({ share, fill: "hatch" }, 3)).units.filter((u) => u.fill).map((u) => u.unit.id));
  const few = filled(0.4), more = filled(0.7);
  assert.ok(few.size < more.size && [...few].every((id) => more.has(id)) && filled(1).size === 8 && filled(0).size === 0);
  // angle variation is drawn from each unit's own id: a unit keeps its hatch when others are removed
  const angled = outlineTypeProducts(recipeOf({ fill: "hatch", angleSpread: 60 }, 8)).units.map((u) => u.fill!.paths[0].points[0][1] === u.fill!.paths[0].points[1][1]);
  assert.ok(angled.includes(false), "spread tilts hatches");
  // the seed is unused (and the drawing identical) when nothing random is set
  const draw = (seed: number, params: Record<string, unknown>) => { const r = new Recorder(); drawOutlineType(r, recipeOf(params, seed)); return JSON.stringify([r.ops, r.shapes, r.lines, r.circles]); };
  const still = { fill: "rings", displace: "none", share: 1, angleSpread: 40 };
  const input = createInstrument("outline-type");
  assert.equal(usesSeed({ ...input, params: { ...input.params, ...still } }), false);
  assert.equal(draw(1, still), draw(2, still));
  for (const params of [{ fill: "mixed", displace: "none" }, { fill: "hatch", displace: "noise", displaceAmount: 0.05 }, { fill: "hatch", displace: "none", angleSpread: 10 }, { fill: "solid", displace: "none", share: 0.5 }]) {
    assert.equal(usesSeed({ ...input, params: { ...input.params, ...params } }), true, JSON.stringify(params));
    assert.notEqual(draw(1, params), draw(2, params), JSON.stringify(params));
  }
  assert.equal(usesSeed({ ...input, params: { ...input.params, fill: "none", share: 0.5, displace: "none" } }), false);
  assert.equal(usesSeed({ ...input, params: { ...input.params, fill: "hatch", angleSpread: 0, displace: "noise", displaceAmount: 0 } }), false);
});

test("consumers: order, colour rules, stitch and bead containment, replacement", () => {
  const recipe = recipeOf({ phrase: "open", fill: "hatch", spacing: 7, outline: "all", shadow: "cast", displace: "none", colorBy: "unit" });
  const products = outlineTypeProducts(recipe);
  const log: string[] = [];
  const r = new Recorder();
  drawOutlineType(r, recipe, {
    fill: (surface, product, tone) => { log.push(`fill:${product.unit.id}:${tone}`); surface.circle(0, 0, 1); },
    outline: (surface, _domain, role, product) => { log.push(`${role}:${product.unit.id}`); surface.circle(0, 0, 1); },
  });
  const n = products.units.length, roles = log.map((entry) => entry.split(":")[0]);
  assert.deepEqual(roles, [...Array(n).fill("halo"), ...Array(n).fill("fill"), ...Array(n).fill("edge"), ...Array(n).fill("inline")], "halos, fills, edges, insets");
  assert.ok(r.ops.findIndex((op) => op[0] === "fill") < r.ops.findIndex((op) => op[0] === "circle"), "shadows come first");
  const shadowFills = r.ops.filter((op) => op[0] === "fill");
  assert.equal(shadowFills.length, 1, "shadows are drawn as one united shape"); for (const op of shadowFills) near(op[4] as number, 255 * 0.25, 1e-9);
  assert.deepEqual(log.filter((e) => e.startsWith("fill")).map((e) => Number(e.split(":")[2])), Array.from({ length: n }, (_, i) => 1 + i % 6), "unit colours cycle the six fill colours");
  // tone rules
  const product = products.units[5] as OutlineUnitProduct;
  assert.equal(outlineTone(product, "ink", 5), 1); assert.equal(outlineTone(product, "unit", 5), 1 + 5 % 4);
  assert.equal(outlineTone(product, "line", 5), 1 + 1 % 4); assert.equal(outlineTone(product, "unit", 1), 0);
  assert.equal(outlineTone({ ...product, fill: { ...product.fill!, kind: "bands" } }, "technique", 12), 1 + ["none", "solid", ...OUTLINE_MIXED_KINDS].indexOf("bands"), "with a long palette every technique has its own colour");
  // trimming
  const straight: Path = { id: "p", seed: 1, points: [[0, 0], [10, 0], [20, 0]], closed: false, level: 0, levelFraction: 0 };
  assert.deepEqual(trimPath(straight, 3)!.points, [[3, 0], [10, 0], [17, 0]]);
  assert.equal(trimPath(straight, 10), null); assert.equal(trimPath(straight, 12), null);
  assert.equal(trimPath({ ...straight, closed: true }, 50)!.closed, true);
  // stitches and beads stay inside the letters: every stitch end, every bead centre
  for (const stroke of ["stitch", "beads"] as const) {
    const stitched = recipeOf({ phrase: "open", fill: "hatch", angle: 20, spacing: 9, stroke, pitch: 6, weight: 1.6, outline: "none", displace: "none", unit: "glyph" });
    const rec = new Recorder();
    drawOutlineType(rec, stitched);
    const units = outlineTypeProducts(stitched).units.map((u) => u.unit.domain);
    const points = stroke === "stitch" ? rec.lines.flat() : rec.circles;
    assert.ok(points.length > 100, stroke);
    for (const point of points) assert.ok(units.some((d) => within(d, point, 1e-6)), `${stroke} mark leaves the letters at ${point}`);
  }
  // ink lines are the clipped geometry
  const ink = new Recorder();
  drawOutlineType(ink, recipeOf({ phrase: "open", fill: "hatch", spacing: 9, outline: "none", displace: "none", stroke: "line" }));
  const domains = products.units.map((u) => u.unit.domain);
  for (const shape of ink.shapes) for (const point of shape) assert.ok(domains.some((d) => within(d, point, 1e-6)));
  // a custom filler is used instead of the stock one and bypasses the cache
  const custom = (unit: { id: string; domain: PlanarDomain }) => ({ id: unit.id, kind: "solid" as const, paths: [], shapes: [{ id: `${unit.id}/mine`, domain: unit.domain, layer: 0, layers: 1 }], marks: [] });
  const a = outlineTypeProducts(recipe, custom), b = outlineTypeProducts(recipe, custom);
  assert.notEqual(a, b); assert.equal(a.units[0].fill!.shapes[0].id, "l0/g0/mine");
  const solid = new Recorder(); drawOutlineType(solid, { ...recipe, outline: { edge: false, halo: null, inline: null, join: "round" }, shadow: { kind: "none", dx: 0, dy: 0 } }, { filler: custom });
  assert.equal(solid.count("endShape"), products.units.reduce((s, u) => s + u.unit.domain.regions.length, 0), "one keyholed polygon per region of every solid unit");
});

test("named work bounds throw naming the controls, and nothing is thinned", () => {
  const long = outlineText({ id: "w", lines: Array(4).fill("W".repeat(14)) });
  const crowded = (params: Record<string, unknown>) => outlineTypeProducts({ ...directRecipe(long, { unit: "glyph", displace: "none" }), ...params });
  const dots = directRecipe(long, { fill: "dots", spacing: 3, size: 130, markSize: 0.3, lattice: "hex" });
  assert.equal(MAX_FILL_MARKS, 30000);
  assert.throws(() => outlineTypeProducts(dots), /would draw \d+ marks; the limit is 30000.*Line spacing.*Mark size.*Type size/);
  assert.throws(() => outlineTypeProducts(directRecipe(long, { fill: "hatch", cross: true, spacing: 3, size: 400 })), /would draw \d+ lines; the limit is 20000.*Line spacing/);
  assert.throws(() => drawOutlineType(new Recorder(), recipeOf({ fill: "hatch", cross: true, stroke: "stitch", pitch: 3, spacing: 3, size: 500, phrase: "open", displace: "none" })), /stations.*limit is 40000.*Stitch pitch/);
  assert.throws(() => outlineTypeProducts(recipeOf({ fill: "waves", chirp: 0.6, spacing: 3.5, unit: "block", size: 260, waveAmplitude: 2 })), /Frequency drift.*Change: .*Frequency drift/);
  assert.ok(crowded({}).units.length === 56, "56 letters at once are fine without a fill");
  assert.throws(() => outlineTypeComposition({ ...createInstrument("outline-type"), params: { ...createInstrument("outline-type").params, size: 5000 } }), /size/i);
  assert.throws(() => validateInstrument({ ...createInstrument("outline-type"), params: { ...createInstrument("outline-type").params, phrase: "nothing" } }), /phrase/i);
});

test("the instrument: registration, groups, seeds, transparency and cooperative preparation", async () => {
  const item = definition("outline-type");
  assert.equal(item.title, "Outline Type"); assert.deepEqual(item.controlGroups.map((g) => g.label), ["Text", "Placement", "Regions", "Fill", "Ink", "Outline", "Shadow"]);
  const proportional = (label: string) => JSON.stringify((JSON.parse(JSON.stringify(item.controlGroups)) as { label: string; controls: unknown[] }[]).flatMap(function walk(g): unknown[] { return g.label === label ? [g.controls] : (g.controls as { label?: string; controls?: unknown[] }[]).filter((c) => typeof c === "object").flatMap((c) => walk(c as never)); }));
  assert.equal(proportional("Lines"), JSON.stringify([["spacing", "weight"]])); assert.equal(proportional("Offsets"), JSON.stringify([["haloDistance", "inlineDistance"]]));
  for (const p of item.parameters) if (p.type === "number") assert.ok(p.hardMin! <= p.min! && p.hardMax! >= p.max!, `${p.key}: the slider lies inside the hard limits`);
  const input = createInstrument("outline-type");
  assert.doesNotThrow(() => validateInstrument(input));
  const rec = new Recorder();
  drawInstrument(rec as never, input);
  assert.equal(rec.count("rect"), 0, "no full-canvas fill: the layer is transparent");
  assert.ok(rec.count("endShape") > 50);
  const recipe = recipeOf();
  assert.equal(await prepareOutlineType(recipe, () => true), false);
  assert.equal(await prepareOutlineType(recipeOf({ spacing: 5.5 }), () => false), true);
  let calls = 0;
  const big = recipeOf({ unit: "glyph", fill: "contours", spacing: 3.5, steps: 20, size: 220, outline: "all", tracking: 0.11 });
  assert.equal(await prepareOutlineType(big, () => ++calls > 2), false, "cancelling between units stops preparation");
  assert.equal(await prepareOutlineType(big, () => false), true);
  const t0 = performance.now(); outlineTypeProducts(big); assert.ok(performance.now() - t0 < 5, "prepared products are cached");
  assert.throws(() => outlineTypeComposition({ ...createInstrument("outline-type"), seed: -1 }), /uint32/);
  assert.throws(() => outlineTypeComposition({ ...createInstrument("outline-type"), technique: "path-typography" }), /Not a outline-type input/);
});

test("every slider end, and all ends together, is admitted and draws within the declared bound", () => {
  const item = definition("outline-type");
  const numbers = item.parameters.filter((p) => p.type === "number");
  assert.ok(numbers.length >= 25, `${numbers.length} numeric controls`);
  const DRAW_BOUND_MS = 10_000;
  const attempt = (label: string, params: Record<string, number>): void => {
    const input = createInstrument("outline-type");
    Object.assign(input.params, params);
    assert.doesNotThrow(() => validateInstrument(input), label);
    const rec = new Recorder(), started = performance.now();
    assert.doesNotThrow(() => drawInstrument(rec as never, input), label);
    assert.ok(performance.now() - started < DRAW_BOUND_MS, `${label} drew within ${DRAW_BOUND_MS} ms`);
    assert.ok(rec.count("endShape") > 0, `${label} draws something`);
  };
  for (const p of numbers) { attempt(`${p.key} at slider min`, { [p.key]: p.min! }); attempt(`${p.key} at slider max`, { [p.key]: p.max! }); }
  attempt("all sliders at min", Object.fromEntries(numbers.map((p) => [p.key, p.min!])));
  attempt("all sliders at max", Object.fromEntries(numbers.map((p) => [p.key, p.max!])));
  // fixed-stream random mixtures of slider ends and select values (30 of the 2^41 corners), each of which fuzzing found admitted
  let state = 2024;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let k = 0; k < 30; k++) {
    const input = createInstrument("outline-type");
    for (const p of item.parameters) {
      if (p.type === "number") input.params[p.key] = random() < 0.5 ? p.min! : p.max!;
      else if (p.type === "select") input.params[p.key] = p.options![Math.floor(random() * p.options!.length)].value;
    }
    const started = performance.now();
    assert.doesNotThrow(() => { validateInstrument(input); drawInstrument(new Recorder() as never, input); }, `mixture ${k}: ${JSON.stringify(input.params)}`);
    assert.ok(performance.now() - started < DRAW_BOUND_MS, `mixture ${k} drew within the bound`);
  }
  // the worst pairing for pattern drift is the largest block with the widest drift of either sign
  for (const chirp of [numbers.find((p) => p.key === "chirp")!.min!, numbers.find((p) => p.key === "chirp")!.max!])
    for (const fill of ["waves", "rings"]) {
      const input = createInstrument("outline-type");
      Object.assign(input.params, Object.fromEntries(numbers.map((p) => [p.key, p.max!])), { chirp, fill, unit: "block", phrase: "figures" });
      assert.doesNotThrow(() => { validateInstrument(input); drawInstrument(new Recorder() as never, input); }, `${fill} block chirp ${chirp}`);
    }
});

test("the offset that used to defeat the kernel now converges directly, and robustOffset returns that exact result", () => {
  // Found by fuzzing: letters overlapped by tracking -0.2, rotated -13°, line unit. The kernel used to throw NOT_CONVERGED for every single-step offset
  // (creeping crossings of nearly concurrent strokes); computed crossings now reuse nearby vertices, so no nudge or sub-step is needed.
  const layout = outlineLayout({ text: outlineText({ id: "t", lines: ["0869", "4@&%"] }), kerning: "optical", tracking: -0.2, size: 40, leading: 1.25, centerX: 0, centerY: 640, rotation: -13 });
  const line = outlineUnits(layout, "line")[1], distance = 2;
  const direct = offsetDomain(line.domain, distance, { join: "round", id: "halo" });
  const halo = robustOffset(line.domain, distance, "round", "halo");
  assert.equal(JSON.stringify(halo.regions.map((r) => [r.outer, r.holes])), JSON.stringify(direct.regions.map((r) => [r.outer, r.holes])), "no fallback was taken");
  // independent reference: dilation distributes over union, so the union of the glyphs' own halos is the same set
  const reference = unionDomains(layout.glyphs.filter((g) => g.line === 1).map((g) => offsetDomain(g.domain, distance, { join: "round" })));
  near(halo.area / reference.area, 1, 0.005, "halo area");
  assert.equal(halo.regions.length, reference.regions.length);
  const inset = robustOffset(line.domain, -distance, "round", "inline");
  assert.ok(inset.area < line.domain.area && inset.area > 0);
  near(inset.area, line.domain.area - distance * line.domain.regions.reduce((s, r) => s + [r.outer, ...r.holes].reduce((p, ring) => p + ring.reduce((l, pt, i) => l + Math.hypot(pt[0] - ring[(i + 1) % ring.length][0], pt[1] - ring[(i + 1) % ring.length][1]), 0), 0), 0), 0.1 * line.domain.area, "inset removes about perimeter × distance");
  // a failure that is not non-convergence is not retried
  assert.throws(() => robustOffset(line.domain, Number.NaN, "round", "x"), /distance/);
});
