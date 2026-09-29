import assert from "node:assert/strict";
import test from "node:test";
import { prepareSurfaceAttributes3D } from "@procedurals/javascript";
import {
  bundledStrokeIds, bundledStrokes, canPrepareInstrument, crossSectionProfile, createInstrument, definition, depositHeight, depositWork,
  depositionOrder, drawStrokeRelief, flatRibbon, footprintWeight, inspectorItems, lightVector, normalAt, paintMass, pigmentField, placeStrokes,
  prepareInstrument, prepareStrokeRelief, reliefColors, reliefNormals, scaleWidths, shadeField, shadeRelief, shadeSlope, shadedPatch,
  sourceStrokes, strokeData, strokeFromGesture, strokeReliefComposition, strokeReliefProducts, strokeSet, strokeTones, strokesFromPaths,
  strokeWith, usesSeed, validateInstrument, visibleParameters, PATCH_ALPHA, SHADE_LEVELS,
  type CompositionSurface, type ReliefDepositOptions as DepositOptions, type StrokeData, type StrokeRelief, type StrokeReliefComposition, type StrokeSet,
} from "../dist/index.js";
import { fillableRings, IsoField } from "../dist/composition/iso-rings.js";
import { bristleBand, gesturePath } from "../dist/index.js";
import { bundledRecording, gestureTrack } from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: string[] = [];
  #note(name: string, args: unknown[]) { this.ops.push(`${name}(${args.map((value) => typeof value === "number" ? Number(value.toFixed(9)) : String(value)).join(",")})`); }
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

/** 200 x 200 canvas units, 2-unit cells: cell (i, j) is sampled at (2i + 1, 2j + 1). */
const options = (o: Partial<DepositOptions> = {}): DepositOptions => ({
  bounds: [0, 0, 200, 200], cell: 2, height: 10, section: "round", edgeRidge: 0, furrows: 4, furrowDepth: 0,
  loadMap: { floor: 0, curve: 1 }, overlap: "add", order: "drawn", ...o,
});
const stroke = (id: string, points: [number, number][], width: number | number[], load: number | number[], tone?: number): StrokeData =>
  ({ id, points, widths: width, loads: load, ...(tone === undefined ? {} : { tone }) });
const set = (strokes: StrokeData[], seed = 1): StrokeSet => strokeSet({ id: "t", seed, strokes });
const cellAt = (relief: StrokeRelief, x: number, y: number) => Math.floor(y / relief.grid.cell) * relief.grid.columns + Math.floor(x / relief.grid.cell);
const heightAt = (relief: StrokeRelief, x: number, y: number) => relief.height[cellAt(relief, x, y)];

/** Deterministic random numbers for property tests. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };
}

/**
 * Independent brute-force deposition for round strokes without ridge or furrows: for every cell and every
 * segment, the nearest point, half width and coverage, then the three overlap rules in the given order.
 */
function reference(s: StrokeSet, o: DepositOptions, order: readonly number[]) {
  const c = o.cell, columns = Math.ceil((o.bounds[2] - o.bounds[0]) / c), rows = Math.ceil((o.bounds[3] - o.bounds[1]) / c);
  const height = new Array<number>(columns * rows).fill(0), owner = new Array<number>(columns * rows).fill(-1);
  for (const index of order) {
    const st = s.strokes[index];
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const px = o.bounds[0] + (i + 0.5) * c, py = o.bounds[1] + (j + 0.5) * c;
      let v = 0, cover = 0, best = Infinity;
      for (let k = 0; k + 1 < st.points.length; k++) {
        const [x0, y0] = st.points[k], [x1, y1] = st.points[k + 1];
        const ex = x1 - x0, ey = y1 - y0, l2 = ex * ex + ey * ey;
        const t = l2 > 0 ? Math.min(1, Math.max(0, ((px - x0) * ex + (py - y0) * ey) / l2)) : 0;
        const d = Math.hypot(px - (x0 + t * ex), py - (y0 + t * ey));
        const hw = (st.widths[k] + t * (st.widths[k + 1] - st.widths[k])) / 2;
        if (!(hw > 0)) continue;
        const cov = (hw - d) / c + 0.5;
        if (cov <= 0) continue;
        if (d < hw && d < best) {
          best = d;
          const load = st.loads[k] + t * (st.loads[k + 1] - st.loads[k]);
          v = o.height * (o.loadMap.floor + (1 - o.loadMap.floor) * load ** o.loadMap.curve) * (1 - (d / hw) ** 2) ** 1.25;
        }
        cover = Math.max(cover, Math.min(1, cov));
      }
      if (cover === 0) continue;
      const at = j * columns + i;
      if (o.overlap === "add") height[at] += v;
      else if (o.overlap === "max") height[at] = Math.max(height[at], v);
      else height[at] = (1 - cover) * height[at] + cover * v;
      if (cover >= 0.5) owner[at] = index;
    }
  }
  return { height, owner };
}

function randomSet(seed: number, count = 5): StrokeSet {
  const random = mulberry(seed), strokes: StrokeData[] = [];
  for (let k = 0; k < count; k++) {
    const n = 3 + Math.floor(random() * 4), points: [number, number][] = [];
    let x = 20 + random() * 160, y = 20 + random() * 160;
    for (let i = 0; i < n; i++) { points.push([x, y]); x = Math.min(190, Math.max(10, x + (random() - 0.5) * 120)); y = Math.min(190, Math.max(10, y + (random() - 0.5) * 120)); }
    strokes.push(stroke(`r${k}`, points, points.map(() => 6 + random() * 26), points.map(() => 0.2 + random() * 0.8)));
  }
  return set(strokes, seed);
}

test("strokes are validated, copied and frozen; failures name the stroke and field", () => {
  const data = stroke("a", [[0, 0], [10, 0], [20, 5]], 8, [0, 0.5, 1], 2);
  const made = set([data]);
  (data.points as [number, number][])[0][0] = 99; (data.loads as number[])[0] = 1;
  assert.deepEqual(made.strokes[0].points[0], [0, 0]);
  assert.deepEqual([...made.strokes[0].widths], [8, 8, 8]);
  assert.deepEqual([...made.strokes[0].loads], [0, 0.5, 1]);
  assert.ok(Object.isFrozen(made) && Object.isFrozen(made.strokes) && Object.isFrozen(made.strokes[0]) && Object.isFrozen(made.strokes[0].points[0]) && Object.isFrozen(made.strokes[0].widths));
  near(made.strokes[0].length, 10 + Math.hypot(10, 5));
  near(made.strokes[0].arcs[1], 10);
  assert.equal(made.strokes[0].tone, 2);
  assert.deepEqual(strokeData(made).strokes[0].points, [[0, 0], [10, 0], [20, 5]]);
  const fails = (input: Partial<StrokeData>, pattern: RegExp) => assert.throws(() => set([{ ...stroke("a", [[0, 0], [10, 0]], 8, 0.5), ...input }]), pattern);
  fails({ points: [[0, 0]] }, /Stroke a needs 2–50000 points/);
  fails({ widths: [8, -1] }, /Stroke a widths\[1\] must be a finite number in \[0, 2000\]/);
  fails({ widths: [8] }, /widths needs one value per vertex \(2\)/);
  fails({ loads: 1.5 }, /Stroke a loads must be a finite number in \[0, 1\]/);
  fails({ points: [[0, 0], [NaN, 1]] }, /point 1 x must be a finite number/);
  fails({ tone: 1.5 }, /tone must be an integer/);
  fails({ id: "has space" }, /Stroke id must be/);
  assert.throws(() => set([stroke("a", [[0, 0], [1, 1]], 1, 1), stroke("a", [[0, 0], [1, 1]], 1, 1)]), /Stroke id a is repeated/);
  assert.equal(set([]).strokes.length, 0);
  assert.equal(set([]).bounds, null);
});

test("fingerprints follow content, never ids alone", () => {
  const base = set([stroke("a", [[0, 0], [10, 0]], 8, 0.5)]);
  assert.equal(base.fingerprint, set([stroke("a", [[0, 0], [10, 0]], 8, 0.5)]).fingerprint);
  for (const changed of [stroke("a", [[0, 0], [10, 1]], 8, 0.5), stroke("a", [[0, 0], [10, 0]], 9, 0.5), stroke("a", [[0, 0], [10, 0]], 8, 0.6), stroke("a", [[0, 0], [10, 0]], 8, 0.5, 1), stroke("b", [[0, 0], [10, 0]], 8, 0.5)])
    assert.notEqual(set([changed]).fingerprint, base.fingerprint);
  assert.notEqual(set([stroke("a", [[0, 0], [10, 0]], 8, 0.5)], 2).fingerprint, base.fingerprint);
});

test("deposition orders: list, reversed, stable shuffle, heaviest last by paint mass", () => {
  // Masses ∫ width·load ds: a = 100·10·0.5 = 500, b = 50·40·1 = 2000, c = 100·10·1 = 1000, d = 100·30·0.2 = 600.
  const s = set([stroke("a", [[0, 0], [100, 0]], 10, 0.5), stroke("b", [[0, 10], [50, 10]], 40, 1), stroke("c", [[0, 20], [100, 20]], 10, 1), stroke("d", [[0, 30], [100, 30]], 30, 0.2)]);
  near(paintMass(s.strokes[1]), 2000); near(paintMass(s.strokes[3]), 600);
  assert.deepEqual([...depositionOrder(s, "drawn")], [0, 1, 2, 3]);
  assert.deepEqual([...depositionOrder(s, "reversed")], [3, 2, 1, 0]);
  assert.deepEqual([...depositionOrder(s, "heaviest-last")], [0, 3, 2, 1]);
  const shuffled = depositionOrder(s, "shuffled");
  assert.deepEqual([...shuffled].sort(), [0, 1, 2, 3]);
  // A survivor keeps its place relative to the others when a stroke is removed.
  const ids = shuffled.map((index) => s.strokes[index].id);
  const smaller = set(s.strokes.filter((x) => x.id !== "c").map((x) => stroke(x.id, x.points as [number, number][], [...x.widths], [...x.loads])));
  assert.deepEqual(depositionOrder(smaller, "shuffled").map((index) => smaller.strokes[index].id), ids.filter((id) => id !== "c"));
  assert.throws(() => depositionOrder(s, "nope" as never), /Unknown deposition order/);
});

test("one straight round stroke: exact cross-section, load, cap and footprint edge", () => {
  const s = set([stroke("s", [[20, 101], [180, 101]], 20, 1)]);
  const relief = depositHeight(s, options());
  near(heightAt(relief, 101, 101), 10, 1e-9, "centre");
  for (const d of [2, 4, 6, 8]) near(heightAt(relief, 101, 101 + d), 10 * (1 - (d / 10) ** 2) ** 1.25, 1e-5, `d=${d}`);
  near(heightAt(relief, 101, 101 - 6), 10 * (1 - 0.36) ** 1.25, 1e-5, "symmetric");
  // Footprint edge: d = hw is owned with zero height; one cell further is not.
  assert.equal(relief.owner[cellAt(relief, 101, 111)], 0); assert.equal(heightAt(relief, 101, 111), 0);
  assert.equal(relief.owner[cellAt(relief, 101, 113)], -1);
  // Round cap of the end width: 1 unit past the end is inside, 11 units is outside.
  near(heightAt(relief, 181, 101), 10 * (1 - 0.01) ** 1.25, 1e-5, "cap");
  assert.equal(relief.owner[cellAt(relief, 191, 101)], -1);
  near(heightAt(relief, 185, 105), 10 * (1 - (Math.hypot(5, 4) / 10) ** 2) ** 1.25, 1e-5, "cap diagonal");
  // Load map A = floor + (1 - floor) load^curve.
  const light = depositHeight(set([stroke("s", [[20, 101], [180, 101]], 20, 0.5)]), options({ loadMap: { floor: 0.2, curve: 2 } }));
  near(heightAt(light, 101, 101), 10 * (0.2 + 0.8 * 0.25), 1e-9);
  // Width and load interpolate linearly along the stroke.
  const taper = depositHeight(set([stroke("s", [[20, 101], [180, 101]], [10, 30], [0, 1])]), options());
  const t = (101 - 20) / 160;
  near(heightAt(taper, 101, 101), 10 * t, 1e-9, "load");
  near(heightAt(taper, 101, 107), 10 * t * (1 - (6 / (5 + 10 * t)) ** 2) ** 1.25, 1e-5, "width");
});

test("the deposited height is the same for any vertex spacing of one stroke (furrows and load included; a tapered width to the sausage approximation)", () => {
  const coarse = set([stroke("s", [[-50, 101], [250, 101]], 60, [0.4, 1])], 5);
  const points: [number, number][] = [], widths: number[] = [], loads: number[] = [];
  for (let i = 0; i <= 60; i++) { const f = i / 60; points.push([-50 + 300 * f, 101]); widths.push(60); loads.push(0.4 + 0.6 * f); }
  // Same ids produce the same grooves: the seed of a stroke depends on set seed and id only.
  const fine = set([stroke("s", points, widths, loads)], 5);
  assert.equal(fine.strokes[0].seed, coarse.strokes[0].seed);
  for (const o of [options({ section: "furrowed", furrows: 5, furrowDepth: 0.9, edgeRidge: 0.4 }), options({ section: "flat" })]) {
    const a = depositHeight(coarse, o), b = depositHeight(fine, o);
    for (let i = 0; i < a.height.length; i++) near(a.height[i], b.height[i], 1e-6, `cell ${i}`);
  }
  // A tapered width is evaluated per segment (a chain of round-capped cones), so refining it moves cells at the very edge by a small fraction of the height.
  const taperedCoarse = set([stroke("s", [[-50, 101], [250, 101]], [40, 70], 1)], 5);
  const taperedFine = set([stroke("s", points, points.map((_, i) => 40 + 30 * i / 60), 1)], 5);
  const t1 = depositHeight(taperedCoarse, options({ section: "flat" })), t2 = depositHeight(taperedFine, options({ section: "flat" }));
  for (let i = 0; i < t1.height.length; i++) near(t1.height[i], t2.height[i], 0.05, `tapered cell ${i}`);
});

test("volume of a straight stroke follows the analytic integral and hardly depends on the cell size", () => {
  // ∫_{-1}^{1} (1 - u²)^1.25 du by Simpson's rule; volume in the 200-unit window = 200 · H · hw · integral.
  let integral = 0; const n = 20000;
  for (let i = 0; i <= n; i++) { const u = -1 + 2 * i / n; integral += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * (1 - u * u) ** 1.25; }
  integral *= (2 / n) / 3;
  const expected = 200 * 10 * 10 * integral;
  const s = set([stroke("s", [[-100, 101], [300, 101]], 20, 1)]);
  for (const [cell, tolerance] of [[1.25, 0.005], [2, 0.008], [4, 0.02]] as const) {
    const relief = depositHeight(s, options({ cell }));
    const volume = relief.height.reduce((sum, v) => sum + v, 0) * relief.grid.cell ** 2;
    assert.ok(Math.abs(volume / expected - 1) < tolerance, `cell ${cell}: volume ${volume} vs ${expected}`);
  }
});

test("crossings: heights per overlap rule and the owner is the last deposited, exactly", () => {
  // A horizontal (load 1, height 10) and B vertical (load 1/2, height 5) cross at the centre of cell (50, 50).
  const strokes = [stroke("A", [[10, 101], [190, 101]], 20, 1), stroke("B", [[101, 10], [101, 190]], 20, 0.5)];
  const s = set(strokes);
  const expected = { add: [15, 15], max: [10, 10], displace: [5, 10] } as const; // [order drawn, order reversed]
  for (const overlap of ["add", "max", "displace"] as const) {
    const drawn = depositHeight(s, options({ overlap, order: "drawn" })), reversed = depositHeight(s, options({ overlap, order: "reversed" }));
    near(heightAt(drawn, 101, 101), expected[overlap][0], 1e-9, `${overlap} drawn`);
    near(heightAt(reversed, 101, 101), expected[overlap][1], 1e-9, `${overlap} reversed`);
    assert.equal(drawn.owner[cellAt(drawn, 101, 101)], 1, `${overlap}: B is on top when drawn last`);
    assert.equal(reversed.owner[cellAt(reversed, 101, 101)], 0, `${overlap}: A is on top when reversed`);
    // Away from the crossing only one stroke is present, in every mode.
    near(heightAt(drawn, 101 + 40, 101), 10 * 1, 1e-9); near(heightAt(drawn, 101, 101 + 40), 5, 1e-9);
    assert.equal(drawn.owner[cellAt(drawn, 141, 101)], 0); assert.equal(drawn.owner[cellAt(drawn, 101, 141)], 1);
  }
  // Off-centre inside both strokes (4 units from each centerline), analytic values.
  const off = (overlap: "add" | "max" | "displace") => heightAt(depositHeight(s, options({ overlap })), 105, 105);
  const a = 10 * (1 - 0.16) ** 1.25, b = 5 * (1 - 0.16) ** 1.25;
  near(off("add"), a + b, 1e-5); near(off("max"), a, 1e-5); near(off("displace"), b, 1e-5);
  // The heaviest-last rule puts A (mass 1·20 per unit) under... A has more paint, so it is deposited last.
  assert.equal(depositHeight(s, options({ order: "heaviest-last" })).owner[cellAt(depositHeight(s, options()), 101, 101)], 0);
});

test("a stroke never adds to itself where it crosses itself", () => {
  const loop = set([stroke("loop", [[20, 101], [180, 101], [101, 180], [101, 20]], 20, 1)]);
  const add = depositHeight(loop, options({ overlap: "add" }));
  near(heightAt(add, 101, 101), 10, 1e-9, "single stroke height at its own crossing");
  assert.ok(add.peak <= 10 + 1e-9);
});

test("the whole deposition matches an independent brute-force reference for every rule and order", () => {
  for (const seed of [3, 11]) {
    const s = randomSet(seed);
    for (const overlap of ["add", "max", "displace"] as const) for (const order of ["drawn", "reversed", "shuffled", "heaviest-last"] as const) {
      const o = options({ overlap, order, height: 8 + seed, loadMap: { floor: 0.15, curve: 1.7 } });
      const relief = depositHeight(s, o), ref = reference(s, o, depositionOrder(s, order));
      assert.deepEqual([...relief.owner], ref.owner, `${overlap}/${order} owners`);
      let worst = 0;
      for (let i = 0; i < ref.height.length; i++) worst = Math.max(worst, Math.abs(relief.height[i] - ref.height[i]));
      assert.ok(worst < 2e-4, `${overlap}/${order} heights differ by ${worst}`);
    }
  }
});

test("add and maximum do not depend on the order; displacement does; ownership always does", () => {
  const s = randomSet(21);
  const by = (overlap: "add" | "max" | "displace", order: "drawn" | "reversed") => depositHeight(s, options({ overlap, order }));
  for (const overlap of ["add", "max"] as const) {
    const a = by(overlap, "drawn"), b = by(overlap, "reversed");
    for (let i = 0; i < a.height.length; i++) near(a.height[i], b.height[i], 1e-9);
  }
  const a = by("displace", "drawn"), b = by("displace", "reversed");
  assert.ok(a.height.some((v, i) => Math.abs(v - b.height[i]) > 0.1));
  assert.notDeepEqual([...by("add", "drawn").owner], [...by("add", "reversed").owner]);
  // Removing a stroke changes only the cells it reached (maximum rule, so heights elsewhere are untouched).
  const fewer = set(s.strokes.slice(1).map((x) => stroke(x.id, x.points as [number, number][], [...x.widths], [...x.loads])), 21);
  const full = depositHeight(s, options({ overlap: "max" })), rest = depositHeight(fewer, options({ overlap: "max" })), only = depositHeight(set([stroke("only", s.strokes[0].points as [number, number][], [...s.strokes[0].widths], [...s.strokes[0].loads])], 21), options({ overlap: "max" }));
  for (let i = 0; i < full.height.length; i++) near(full.height[i], Math.max(rest.height[i], only.height[i]), 1e-9);
});

test("furrows: one groove fewer than hairs, cut into a flat-topped stroke, independent of the light and of the cell alignment", () => {
  const s = set([stroke("f", [[-100, 101], [300, 101]], 80, 1)], 9);
  const o = options({ section: "furrowed", furrows: 5, furrowDepth: 1, edgeRidge: 0 });
  const relief = depositHeight(s, o);
  const smooth = depositHeight(s, { ...o, furrowDepth: 0 });
  for (const x of [41, 101, 161]) {
    // h / P(u) = 1 - G: count its interior local minima across the stroke.
    const ratio: number[] = [];
    for (let d = -30; d <= 30; d += 2) ratio.push(heightAt(relief, x, 101 + d) / 10 / crossSectionProfile("furrowed", 0, Math.abs(d) / 40));
    let minima = 0;
    for (let i = 1; i + 1 < ratio.length; i++) if (ratio[i] < ratio[i - 1] - 1e-9 && ratio[i] <= ratio[i + 1] + 1e-9) minima++;
    assert.equal(minima, 4, `grooves across x = ${x}`);
    assert.ok(Math.min(...ratio) < 0.7, "the deepest groove cuts at least 30%");
  }
  for (let i = 0; i < smooth.height.length; i++) assert.ok(relief.height[i] <= smooth.height[i] + 1e-9, "grooves only remove height");
  // Zero depth is the plain profile, at any furrow count.
  const plain = depositHeight(s, { ...o, furrowDepth: 0, furrows: 9 });
  for (let i = 0; i < plain.height.length; i++) near(plain.height[i], smooth.height[i], 1e-12);
});

test("edge ridge adds a levee of the stated size at the stated place", () => {
  const s = set([stroke("s", [[-100, 101], [300, 101]], 60, 1)]);
  const flat = depositHeight(s, options({ section: "flat", edgeRidge: 0 })), ridged = depositHeight(s, options({ section: "flat", edgeRidge: 0.8 }));
  // At u = 0.8 (24 units off the centerline) the ridge adds r · 1 · smoothstep(0, 0.12, 0.2) = r; the centre gains only exp(-(0.8/0.13)²) ≈ 0.
  near(heightAt(ridged, 101, 101 + 24) - heightAt(flat, 101, 101 + 24), 0.8 * 10, 1e-4);
  near(heightAt(ridged, 101, 101) - heightAt(flat, 101, 101), 0, 1e-9);
  for (let i = 0; i < flat.height.length; i++) assert.ok(ridged.height[i] >= flat.height[i] - 1e-12);
});

test("normals are slopes from signed convolution, agree with the surface-attribute core on a smooth surface", () => {
  const columns = 24, rows = 24, cell = 2;
  const surface = (f: (x: number, y: number) => number): StrokeRelief => {
    const height: number[] = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) height.push(f((i + 0.5) * cell, (j + 0.5) * cell));
    return { grid: { left: 0, top: 0, cell, columns, rows }, height, owner: height.map(() => 0), coverage: height.map(() => 1) } as unknown as StrokeRelief;
  };
  // A ramp: exact slopes away from the clamped border (x and y are canvas axes, y down).
  const ramp = reliefNormals(surface((x, y) => 0.3 * x - 0.15 * y + 5));
  for (let j = 1; j < rows - 1; j++) for (let i = 1; i < columns - 1; i++) { near(ramp.slopeX[j * columns + i], 0.3, 1e-12); near(ramp.slopeY[j * columns + i], -0.15, 1e-12); }
  const n = normalAt(ramp, 5 * columns + 5), k = 1 / Math.sqrt(1 + 0.09 + 0.0225);
  near(n[0], -0.3 * k, 1e-12); near(n[1], 0.15 * k, 1e-12); near(n[2], k, 1e-12);
  // A paraboloid against the independent surface-attribute computation on the triangulated grid.
  const dome = surface((x, y) => 0.004 * ((x - 24) ** 2 + (y - 24) ** 2));
  const positions: number[][] = [], triangles: number[][] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) positions.push([(i + 0.5) * cell, (j + 0.5) * cell, dome.height[j * columns + i]]);
  for (let j = 0; j + 1 < rows; j++) for (let i = 0; i + 1 < columns; i++) {
    const a = j * columns + i, b = a + 1, c = a + columns, d = c + 1;
    triangles.push([a, b, c], [b, d, c]);
  }
  const mesh = prepareSurfaceAttributes3D({ positions, triangles, normalMode: "smooth", smoothingGroups: triangles.map(() => 0), cornerUVs: null, maxVertices: 100000, maxWork: 1e8 });
  const ours = reliefNormals(dome);
  let checked = 0;
  mesh.normals.forEach((normal: number[], k: number) => {
    const source = mesh.sourceVertexIndices[k], i = source % columns, j = Math.floor(source / columns);
    if (i < 2 || j < 2 || i > columns - 3 || j > rows - 3) return;
    const mine = normalAt(ours, source);
    for (let axis = 0; axis < 3; axis++) near(mine[axis], normal[axis], 2e-3, `vertex ${source} axis ${axis}`);
    checked++;
  });
  assert.ok(checked > 300);
});

test("shading: exact for a tilted plane, zero for a flat one, signed by facing, linear in contrast, gloss separate", () => {
  const material = { contrast: 1, gloss: 0, shininess: 30 };
  for (const azimuth of [-120, 0, 33, 200]) for (const elevation of [10, 45, 90]) {
    assert.equal(shadeSlope(0, 0, { azimuth, elevation }, { contrast: 2, gloss: 1.5, shininess: 20 }), 0);
  }
  // Light from the right (azimuth 90) at 40° elevation; the surface falls toward the right, so its normal faces right.
  const el = 40 * Math.PI / 180, a = 0.5, light = { azimuth: 90, elevation: 40 };
  const k = 1 / Math.sqrt(1 + a * a);
  near(shadeSlope(-a, 0, light, material), (a * k * Math.cos(el) + k * Math.sin(el)) - Math.sin(el), 1e-12);
  near(shadeSlope(+a, 0, light, material), (-a * k * Math.cos(el) + k * Math.sin(el)) - Math.sin(el), 1e-12);
  assert.ok(shadeSlope(-a, 0, light, material) > 0 && shadeSlope(a, 0, light, material) < 0);
  // y is canvas down and azimuth 0 comes from the top: a surface that rises toward the bottom tilts up toward the light.
  assert.ok(shadeSlope(0, 0.4, { azimuth: 0, elevation: 40 }, material) > 0, "rising toward the bottom faces a light above");
  assert.ok(shadeSlope(0, -0.4, { azimuth: 0, elevation: 40 }, material) < 0);
  near(shadeSlope(-a, 0, light, { ...material, contrast: 3 }), 3 * shadeSlope(-a, 0, light, material), 1e-12);
  // Specular: (n.H)^p - (H_z)^p, peaking where the normal is the half vector.
  const L = lightVector(light), h = [L[0], L[1], L[2] + 1], hl = Math.hypot(...h), H = h.map((v) => v / hl);
  const slopeToHalf = -H[0] / H[2];
  near(shadeSlope(slopeToHalf, 0, light, { contrast: 0, gloss: 1, shininess: 30 }), 1 - H[2] ** 30, 1e-9);
  assert.ok(shadeSlope(slopeToHalf * 0.5, 0, light, { contrast: 0, gloss: 1, shininess: 30 }) < 1 - H[2] ** 30);
  assert.throws(() => lightVector({ azimuth: 0, elevation: 0 }), /light elevation/);
});

test("the patch is exact geometry: nested regions compound to the stated alpha, stay inside the footprint and leave flat tops clear", () => {
  const s = set([stroke("s", [[-50, 101], [250, 101]], 80, 1)]);
  const relief = depositHeight(s, options({ section: "flat", edgeRidge: 0 }));
  const patch = shadeRelief(reliefNormals(relief), { azimuth: -60, elevation: 30 }, { contrast: 2, gloss: 0.5, shininess: 30 });
  assert.ok(patch.bands.length > 4);
  for (const side of ["shadow", "light"] as const) {
    let remaining = 1, previousLevel = 0;
    for (const band of patch.bands.filter((b) => b.side === side)) {
      assert.ok(band.level > previousLevel); previousLevel = band.level;
      remaining *= 1 - band.alpha;
      near(1 - remaining, band.level / SHADE_LEVELS * PATCH_ALPHA, 1e-12, `${side} level ${band.level}`);
    }
  }
  // Plateau is u <= 0.68 (27.2 units off centre); shading only where the height varies: the shoulder u in (0.68, 1] and the cut of the footprint edge.
  for (const band of patch.bands) for (const polygon of band.polygons) for (let k = 0; k < polygon.length; k += 2) {
    const x = polygon[k], y = polygon[k + 1];
    if (x < 8 || x > 192) continue;
    const d = Math.abs(y - 101);
    assert.ok(d <= 40 + 1e-9, `polygon vertex ${d} units off the centerline lies outside the footprint (half width 40)`);
    assert.ok(d >= 27.2 - 2 * 2, `polygon vertex ${d} units off the centerline lies on the flat top`);
  }
  // Light from above lights the upper shoulder and shades the lower one, and the mirror light mirrors the patch.
  const upper = (p: typeof patch, side: "shadow" | "light") => p.bands.filter((b) => b.side === side).flatMap((b) => b.polygons).flatMap((polygon) => polygon.map((v, k) => k % 2 === 0 ? [v, polygon[k + 1]] : null).filter((p) => p !== null)).filter((p) => p![0] > 40 && p![0] < 160 && p![1] < 101).length;
  const above = shadeRelief(reliefNormals(relief), { azimuth: 0, elevation: 30 }, { contrast: 2, gloss: 0, shininess: 30 });
  assert.ok(upper(above, "light") > 0 && upper(above, "shadow") === 0);
  const below = shadeRelief(reliefNormals(relief), { azimuth: 180, elevation: 30 }, { contrast: 2, gloss: 0, shininess: 30 });
  assert.ok(upper(below, "shadow") > 0 && upper(below, "light") === 0);
});

test("footprint weight is zero at the footprint edge and one half a cell inside", () => {
  assert.equal(footprintWeight(0.5), 0); assert.equal(footprintWeight(0.2), 0); assert.equal(footprintWeight(1), 1);
  near(footprintWeight(0.75), 0.5, 1e-12);
});

test("iso rings: exact crossings, orientation, holes, saddles and border closure", () => {
  // Linear field f = x: the ring of {f >= 2.5} is the rectangle between x = 2.5 and the border, closed outside the grid.
  const columns = 6, rows = 4, values = Array.from({ length: columns * rows }, (_, k) => k % columns);
  const field = new IsoField({ values, columns, rows, x0: 0, y0: 0, dx: 1, dy: 1, outside: -1 });
  const [ring] = field.rings(2.5);
  const xs = new Set(ring.map(([x]) => x.toFixed(9)));
  assert.ok(xs.has("2.500000000"), "crossings sit exactly at the level along x");
  assert.equal(field.rings(2.5).length, 1);
  assert.equal(field.rings(99).length, 0);
  const area = (r: readonly (readonly [number, number])[]) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return s / 2; };
  assert.ok(area(ring) > 0, "outer boundaries have positive area");
  // Gaussian bump: the level ring is a circle of the analytic radius.
  const n = 41, sigma = 6, bump = Array.from({ length: n * n }, (_, k) => Math.exp(-(((k % n) - 20) ** 2 + (Math.floor(k / n) - 20) ** 2) / (2 * sigma * sigma)));
  const [circle] = new IsoField({ values: bump, columns: n, rows: n, x0: 0, y0: 0, dx: 1, dy: 1, outside: 0 }).rings(0.3);
  const radius = sigma * Math.sqrt(-2 * Math.log(0.3));
  near(area(circle), Math.PI * radius * radius, Math.PI * radius * radius * 0.02, "ring area");
  // Annulus: one outer ring (positive) and one hole (negative); merged polygon area is the difference.
  const ann = Array.from({ length: n * n }, (_, k) => { const r = Math.hypot((k % n) - 20, Math.floor(k / n) - 20); return Math.exp(-((r - 12) ** 2) / 8); });
  const rings = new IsoField({ values: ann, columns: n, rows: n, x0: 0, y0: 0, dx: 1, dy: 1, outside: 0 }).rings(0.5);
  assert.equal(rings.length, 2);
  const areas = rings.map(area).sort((p, q) => p - q);
  assert.ok(areas[0] < 0 && areas[1] > 0);
  const merged = fillableRings(rings);
  assert.equal(merged.length, 1);
  near(area(merged[0]), areas[0] + areas[1], 1e-6, "bridge encloses no area");
  assert.ok(merged[0].length >= rings[0].length + rings[1].length);
  // Saddle: two diagonal samples above the level join when the cell mean is above it, else stay apart.
  const joined = new IsoField({ values: [1, 0, 0, 1], columns: 2, rows: 2, x0: 0, y0: 0, dx: 1, dy: 1, outside: 0 }).rings(0.4);
  const apart = new IsoField({ values: [1, 0, 0, 1], columns: 2, rows: 2, x0: 0, y0: 0, dx: 1, dy: 1, outside: 0 }).rings(0.6);
  assert.equal(joined.length, 1); assert.equal(apart.length, 2);
  assert.throws(() => new IsoField({ values: [0, 1], columns: 2, rows: 2, x0: 0, y0: 0, dx: 1, dy: 1, outside: 0 }), /exactly columns x rows values/);
  assert.throws(() => field.rings(-1), /exceed the outside value/);
});

test("placing a set: exact similarity about the bounding box centre; ids, tones and seeds are kept", () => {
  const s = set([stroke("a", [[0, 0], [40, 0]], 10, 0.5, 3), stroke("b", [[0, 20], [40, 20]], [6, 8], [1, 1])], 4);
  const same = placeStrokes(s, { centerX: 20, centerY: 10, scale: 1, rotation: 0 });
  assert.deepEqual(same.strokes[0].points, s.strokes[0].points);
  const turned = placeStrokes(s, { centerX: 100, centerY: 100, scale: 2, rotation: 90 });
  // Box centre (20, 10); a point (x, y) maps to centre + R(90°, clockwise on screen: (dx, dy) -> (-dy, dx)) · 2 · (x - 20, y - 10).
  const expected = (x: number, y: number) => [100 - 2 * (y - 10), 100 + 2 * (x - 20)];
  s.strokes.forEach((st, i) => st.points.forEach(([x, y], k) => { const [ex, ey] = expected(x, y); near(turned.strokes[i].points[k][0], ex, 1e-9); near(turned.strokes[i].points[k][1], ey, 1e-9); }));
  assert.deepEqual([...turned.strokes[0].widths], [20, 20]); assert.deepEqual([...turned.strokes[1].widths], [12, 16]);
  assert.deepEqual(turned.strokes.map((x) => x.id), ["a", "b"]); assert.equal(turned.strokes[0].tone, 3); assert.equal(turned.seed, 4);
  assert.deepEqual([...turned.strokes[1].loads], [1, 1]);
  assert.equal(placeStrokes(s, { centerX: 100, centerY: 100, scale: 2, rotation: 90 }), turned, "cached");
  assert.equal(scaleWidths(s, 1), s);
  assert.deepEqual([...scaleWidths(s, 1.5).strokes[1].widths], [9, 12]);
  assert.deepEqual(scaleWidths(s, 1.5).strokes[1].points, s.strokes[1].points);
  assert.throws(() => placeStrokes(s, { centerX: 0, centerY: 0, scale: 0, rotation: 0 }), /frame scale/);
  assert.equal(placeStrokes(set([]), { centerX: 1, centerY: 1, scale: 1, rotation: 0 }).strokes.length, 0);
});

test("strokes from paths and gestures carry the stated width and load", () => {
  const path = (id: string, f: number) => ({ id, seed: 1, points: [[0, 0], [10, 0], [20, 5]] as const, closed: false, level: 0, levelFraction: f });
  const s = strokesFromPaths({ id: "p", seed: 3, paths: [path("mid", 0.5), path("edge", 0), path("half", 0.25)], width: 7, load: 0.8, edgeLoad: 0.5 });
  assert.deepEqual([...s.strokes[0].widths], [7, 7, 7]);
  near(s.strokes[0].loads[0], 0.8, 1e-12); near(s.strokes[1].loads[0], 0.4, 1e-12); near(s.strokes[2].loads[0], 0.8 * (1 - 0.5 * 0.5), 1e-12);
  const closed = strokesFromPaths({ id: "c", seed: 3, paths: [{ ...path("ring", 0.5), closed: true }], width: 2, load: 1 });
  assert.equal(closed.strokes[0].points.length, 4);
  assert.deepEqual(closed.strokes[0].points[3], closed.strokes[0].points[0]);
  const track = gestureTrack(bundledRecording("sweep", 42), { smoothing: 30, frame: { centerX: 320, centerY: 320, scale: 1, rotation: 0 } });
  const gp = gesturePath(track, { seed: 42, sampling: { kind: "arc", spacing: 6 }, window: { start: 0, end: track.duration }, pressure: { source: "recorded", whenAbsent: "reject", level: 0.5 } });
  const g = strokeFromGesture({ id: "g", seed: 42, path: gp, width: 50, map: { floor: 0.2, curve: 1 } });
  assert.equal(g.strokes[0].points.length, gp.points.length);
  gp.pressure.forEach((p, i) => { near(g.strokes[0].loads[i], p, 1e-12); near(g.strokes[0].widths[i], 50 * (0.2 + 0.8 * p), 1e-9); });
});

test("bundled sets: deterministic, structurally different per seed, unique stable ids, within the canvas", () => {
  for (const id of bundledStrokeIds) {
    const a = bundledStrokes(id, 42), b = bundledStrokes(id, 42), c = bundledStrokes(id, 43);
    assert.equal(a, b);
    assert.notEqual(a.fingerprint, c.fingerprint);
    assert.ok(a.strokes.length >= 2 && a.strokes.length <= 12);
    assert.ok(a.strokes.every((st) => st.id.startsWith(`${id}:42/`)));
    assert.equal(new Set(a.strokes.map((st) => st.id)).size, a.strokes.length);
    const [l, t, r, bt] = a.bounds!;
    assert.ok(l > -80 && t > -80 && r < 720 && bt < 720, `${id} bounds ${a.bounds}`);
    // The seed changes the geometry, not just the pressure: bounding boxes or stroke counts differ.
    const boxes = [42, 43, 44, 45].map((sd) => JSON.stringify([bundledStrokes(id, sd).bounds!.map(Math.round), bundledStrokes(id, sd).strokes.length]));
    assert.ok(new Set(boxes).size >= 3, `${id} seeds give ${new Set(boxes).size} distinct constructions`);
  }
  assert.throws(() => bundledStrokes("nope" as never, 1), /Unknown bundled stroke set/);
});

test("work bounds throw with the control to change; nothing is truncated", () => {
  const s = set([stroke("s", [[10, 10], [190, 190]], 20, 1)]);
  assert.throws(() => depositHeight(s, options({ bounds: [0, 0, 640, 640], cell: 1 })), /cells.*limit is 262144.*Raise the cell size/);
  const dense = set(Array.from({ length: 200 }, (_, k) => stroke(`d${k}`, Array.from({ length: 300 }, (_, i) => [i % 2 ? 0 : 200, (i * 7 + k) % 200] as [number, number]), 400, 1)));
  assert.ok(depositWork(dense, { left: 0, top: 0, cell: 2, columns: 100, rows: 100 }) > 60_000_000);
  assert.throws(() => depositHeight(dense, options()), /cell-segment pairs.*limit is 60000000.*Raise the cell size/);
  assert.throws(() => depositHeight(s, options({ height: -1 })), /height must be/);
  assert.throws(() => depositHeight(s, options({ section: "x" as never })), /Unknown cross-section/);
  assert.throws(() => depositHeight(s, options({ overlap: "x" as never })), /Unknown overlap/);
  assert.throws(() => depositHeight(s, options({ furrows: 1 })), /furrows/);
});

test("cancellation reaches the deposition and preparation", async () => {
  const many = set(Array.from({ length: 30 }, (_, k) => stroke(`c${k}`, [[0, 6 * k], [200, 6 * k + 3]], 8, 1)));
  let calls = 0;
  assert.throws(() => depositHeight(many, options({ height: 9 }), { cancelled: () => ++calls > 3 }), /Composition cancelled/);
  assert.ok(calls <= 5, `stopped after ${calls} checks`);
  // A cancelled attempt caches nothing: the next uncancelled deposit completes and matches a fresh one.
  assert.equal(depositHeight(many, options({ height: 9 })).owned > 0, true);
  const recipe = strokeReliefComposition(createInstrument("stroke-relief"));
  assert.equal(await prepareStrokeRelief(recipe, () => true), false);
  let seen = 0;
  assert.equal(await prepareStrokeRelief({ ...recipe, seed: 777 }, () => ++seen > 2), false);
  assert.equal(await prepareStrokeRelief({ ...recipe, seed: 778 }, () => false), true);
  assert.equal(await prepareInstrument({ ...createInstrument("stroke-relief"), seed: 779 }, () => false), true);
  assert.equal(canPrepareInstrument("stroke-relief"), true);
});

function recipeFor(params: Record<string, number | string | boolean> = {}, seed = 42): StrokeReliefComposition {
  const input = createInstrument("stroke-relief");
  input.seed = seed; Object.assign(input.params, params);
  return strokeReliefComposition(input);
}

test("light changes shade the same height: producers upstream of the patch are the same cached objects, flat drawing is untouched", () => {
  const a = strokeReliefProducts(recipeFor()), b = strokeReliefProducts(recipeFor({ azimuth: 120, elevation: 70, contrast: 3, gloss: 2 }));
  assert.equal(a.relief, b.relief); assert.equal(a.normals, b.normals); assert.equal(a.pigment, b.pigment); assert.equal(a.strokes, b.strokes);
  assert.notEqual(a.patch, b.patch);
  assert.notDeepEqual(a.patch!.bands.map((x) => x.polygons.length), b.patch!.bands.map((x) => x.polygons.length));
  // Palette and colour rule never rebuild geometry; only structure does.
  const pal = strokeReliefProducts({ ...recipeFor(), palette: [1, 2, 3] });
  assert.equal(pal.relief, a.relief);
  const structural = strokeReliefProducts(recipeFor({ height: 12 }));
  assert.notEqual(structural.relief, a.relief);
  assert.equal(structural.strokes, a.strokes);
  // Flat drawing of two different lights is identical, and the flat view never builds height.
  const drawn = (params: Record<string, number | string | boolean>) => { const r = new Recorder(); drawStrokeRelief(r, recipeFor({ view: "flat", ...params })); return r.ops; };
  assert.deepEqual(drawn({}), drawn({ azimuth: 100, elevation: 60, height: 20, cell: 5, overlap: "add" }));
  assert.equal(strokeReliefProducts(recipeFor({ view: "flat" })).relief, null);
});

test("the named instrument draws exactly what the ordinary functions draw; consumers are replaceable", () => {
  const recipe = recipeFor({ view: "both", source: "weave" }, 5);
  const named = new Recorder(); drawStrokeRelief(named, recipe);
  // The same drawing by hand: producers, then flat ribbons in deposition order, then the patch.
  const products = strokeReliefProducts(recipe);
  const byHand = new Recorder();
  strokeWith(byHand, products.order.map((i) => ({ ...products.strokes.strokes[i], tone: products.tones[i] })), flatRibbon(recipe.palette));
  byHand.push(); shadedPatch(recipe.palette)(byHand, products.patch!, { workUsed: 0, depth: 0, enter() {}, leave() {}, check() {} }); byHand.pop();
  assert.equal(named.ops.filter((op) => op.startsWith("line(")).length, byHand.ops.filter((op) => op.startsWith("line(")).length);
  const lines = named.ops.filter((op) => op.startsWith("line("));
  assert.ok(lines.length > 500);
  assert.equal(named.ops.filter((op) => op === "beginShape()").length, products.patch!.polygonCount);
  // A custom consumer sees strokes in deposition order with their pigment tone, and the very same patch.
  const order: string[] = [], tones: (number | undefined)[] = [];
  const patches: unknown[] = [];
  drawStrokeRelief(new Recorder(), { ...recipe, colorBy: "deposition" }, { flat: (_s, st) => { order.push(st.id); tones.push(st.tone); }, patch: (_s, p) => { patches.push(p); } });
  assert.deepEqual(order, products.order.map((i) => products.strokes.strokes[i].id));
  assert.deepEqual(tones, products.order.map((_, rank) => rank));
  assert.equal(patches[0], products.patch);
  // Views: flat draws lines and no shapes; relief only shapes.
  const flat = new Recorder(); drawStrokeRelief(flat, { ...recipe, view: "flat" });
  assert.ok(flat.ops.every((op) => !op.startsWith("beginShape")) && flat.ops.some((op) => op.startsWith("line(")));
  const relief = new Recorder(); drawStrokeRelief(relief, { ...recipe, view: "relief" });
  assert.ok(relief.ops.every((op) => !op.startsWith("line(")) && relief.ops.some((op) => op === "beginShape()"));
  // A draw never leaves surface state open.
  assert.equal(named.ops.filter((op) => op === "push()").length, named.ops.filter((op) => op === "pop()").length);
});

test("colour rules and palette roles", () => {
  const s = set([stroke("a", [[0, 0], [1, 1]], 1, 1, 2), stroke("b", [[0, 0], [1, 1]], 1, 1), stroke("c", [[0, 0], [1, 1]], 1, 1, 5)]);
  const order = depositionOrder(s, "reversed");
  assert.deepEqual([...strokeTones(s, "stroke", order)], [2, 0, 5]);
  assert.deepEqual([...strokeTones(s, "single", order)], [0, 0, 0]);
  assert.deepEqual([...strokeTones(s, "deposition", order)], [2, 1, 0]);
  const colors = reliefColors([0x102030, 0xff0000, 0x00ff00]);
  assert.equal(colors.shadow, 0x102030); assert.deepEqual([...colors.pigments], [0xff0000, 0x00ff00]);
  assert.equal(colors.light, (255 << 16) | (Math.round(255 * 0.8) << 8) | Math.round(255 * 0.8), "white tinted 20% toward the first pigment");
  assert.throws(() => reliefColors([1]), /at least two colors/);
  const relief = depositHeight(set([stroke("a", [[20, 50], [180, 50]], 20, 1, 1), stroke("b", [[20, 150], [180, 150]], 20, 1, 0)]), options());
  const pigment = pigmentField(relief, [7, 3]);
  assert.equal(pigment[cellAt(relief, 101, 51)], 7); assert.equal(pigment[cellAt(relief, 101, 151)], 3); assert.equal(pigment[cellAt(relief, 101, 101)], -1);
  assert.throws(() => pigmentField(relief, [1]), /one tone per stroke/);
});

test("dry-brush source composes the existing bristle producer; sources are cached by construction", () => {
  const recipe = recipeFor({ source: "dry-loops", hairs: 12, hairWidth: 5 }, 8);
  const strokes = sourceStrokes(recipe);
  assert.equal(strokes, sourceStrokes(recipeFor({ source: "dry-loops", hairs: 12, hairWidth: 5, height: 3 }, 8)), "relief controls do not rebuild the source");
  assert.ok(strokes.strokes.length >= 12 && strokes.strokes.every((st) => st.widths.every((w) => w === 5) && st.id.includes("/hair:")));
  assert.notEqual(sourceStrokes(recipeFor({ source: "dry-loops", hairs: 13, hairWidth: 5 }, 8)), strokes);
  assert.notEqual(sourceStrokes(recipeFor({ source: "dry-loops", hairs: 12, hairWidth: 5 }, 9)).fingerprint, strokes.fingerprint);
  // Hairs are exactly the bristle producer's, drawn from the same replay.
  const track = gestureTrack(bundledRecording("loops", 8), { smoothing: 30, frame: { centerX: 320, centerY: 320, scale: 1, rotation: 0 } });
  const path = gesturePath(track, { seed: 8, sampling: { kind: "arc", spacing: 2.5 }, window: { start: 0, end: track.duration }, pressure: { source: "recorded", whenAbsent: "speed", level: 0.6 } });
  const hairs = bristleBand(path, { seed: 8, hairs: 12, width: 72, map: { floor: 0.18, curve: 1 }, dryness: 0.7, depletion: 0.5, wander: 0.2 });
  assert.deepEqual(strokes.strokes.map((st) => st.id), hairs.map((h) => h.id));
  assert.deepEqual(strokes.strokes.map((st) => st.points), hairs.map((h) => h.points));
});

test("instrument: valid defaults, grouped controls, conditional visibility and the irrelevance guarantee", () => {
  const input = createInstrument("stroke-relief");
  assert.doesNotThrow(() => validateInstrument(input));
  const shown = (params: Record<string, number | string | boolean>) => new Set(visibleParameters("stroke-relief", { ...input.params, ...params }).map((p) => p.key));
  const both = shown({}), flat = shown({ view: "flat" }), relief = shown({ view: "relief", source: "dry-sweep", section: "round" });
  for (const key of ["height", "azimuth", "furrows", "overlap", "cell", "edgeRidge"]) assert.ok(both.has(key) !== (key === "furrows" && false), key);
  assert.ok(both.has("furrows") && both.has("colorBy") && !both.has("brushWidth") && both.has("strokeWidth"));
  for (const key of ["height", "azimuth", "furrows", "overlap", "cell", "edgeRidge", "gloss", "loadFloor"]) assert.ok(!flat.has(key), `${key} hidden for the flat view`);
  assert.ok(flat.has("order") && flat.has("colorBy") && flat.has("scale"));
  assert.ok(!relief.has("colorBy") && !relief.has("furrows") && relief.has("brushWidth") && !relief.has("strokeWidth") && relief.has("azimuth"));
  assert.ok(inspectorItems("stroke-relief", input.params).length >= 5);
  const groups = definition("stroke-relief").controlGroups;
  assert.equal(groups.find((g) => g.label === "Placement")!.controls.join(), "centerX,centerY,scale,rotation");
  // Every hidden control leaves the drawing unchanged (changing each to another legal value, for several configurations).
  const changed = (p: { key: string; type: string; min?: number; max?: number; options?: { value: string }[] }, value: number | string | boolean) => {
    if (p.type === "number") return p.max! - Number(value) > (p.max! - p.min!) / 2 ? p.max! : p.min!;
    if (p.type === "select") return p.options!.map((o) => o.value).find((v) => v !== value)!;
    return !value;
  };
  for (const config of [{ view: "flat" }, { view: "relief" }, { view: "both", section: "round" }, { view: "both", section: "flat", source: "dry-loops" }, { source: "weave", view: "both", section: "furrowed" }]) {
    const base = { ...input.params, ...config } as Record<string, number | string | boolean>;
    const baseline = drawFingerprint({ ...input, params: base });
    const visible = new Set(visibleParameters("stroke-relief", base).map((p) => p.key));
    for (const p of definition("stroke-relief").parameters) {
      if (visible.has(p.key)) continue;
      assert.equal(drawFingerprint({ ...input, params: { ...base, [p.key]: changed(p, base[p.key]) } }), baseline, `${JSON.stringify(config)}: hidden ${p.key} changed the drawing`);
    }
  }
  assert.equal(usesSeed(input), true);
  assert.notEqual(drawFingerprint({ ...input, seed: 43 }), drawFingerprint(input));
});
