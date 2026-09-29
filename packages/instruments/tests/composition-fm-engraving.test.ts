import assert from "node:assert/strict";
import test from "node:test";
import {
  areaAverage, canPrepareInstrument, componentSeed, createInstrument, createRaster, drawEngraving, engravedLines, engravingCarriers, engravingComposition,
  engravingProducts, inspectorItems, prepareInstrument, segmentValueBands, srgbToLinear, toneField, tonePieces, usesSeed, validateParameters, valueRegionMask,
  visibleParameters, TONE_BINS, ENGRAVING_LIMITS,
  type CompositionSurface, type EngravingOptions, type Raster,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const TAU = Math.PI * 2;
const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);

/** Independent CIE lightness of an sRGB gray byte, as a tone in [0, 1] (1 = black). */
function darkTone(byte: number): number {
  const y = srgbToLinear(byte / 255);
  const lightness = y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
  return 1 - lightness / 100;
}

const gray = (width: number, height: number, byte: (x: number, y: number) => number): Raster =>
  createRaster({ width, height, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none",
    data: Uint8Array.from({ length: width * height }, (_, p) => byte(p % width, Math.floor(p / width))) });
const uniform = (byte: number): Raster => gray(32, 32, () => byte);
const halves = gray(32, 32, (x) => (x < 16 ? 0 : 255));

type Over = { [K in keyof EngravingOptions]?: Partial<EngravingOptions[K]> } & { source?: EngravingOptions["source"]; seed?: number; minLength?: number };
/** A 200 x 200 footprint centred on the origin, straight horizontal lines every 10 units, constant frequency and amplitude. */
function make(over: Over = {}): EngravingOptions {
  const base: EngravingOptions = {
    seed: 7, source: { kind: "raster", raster: uniform(0) },
    footprint: { centerX: 0, centerY: 0, width: 200, height: 200, rotation: 0, shape: "rectangle" },
    image: { fit: "contain", clip: "footprint", encode: "dark", smoothing: 0 },
    tone: { curve: 1, threshold: 0 },
    scan: { family: "straight", spacing: 10, spacingGain: 0, angle: 0, bend: 0, bendLength: 100, radialX: 0, radialY: 0, follow: 0, flowSmoothing: 0 },
    wave: { baseFrequency: 5, frequencyGain: 5, baseAmplitude: 0.1, amplitudeGain: 0.2, phaseSpread: 0 },
    minLength: 0,
  };
  return {
    seed: over.seed ?? base.seed, source: over.source ?? base.source, minLength: over.minLength ?? base.minLength,
    footprint: { ...base.footprint, ...over.footprint }, image: { ...base.image, ...over.image }, tone: { ...base.tone, ...over.tone },
    scan: { ...base.scan, ...over.scan }, wave: { ...base.wave, ...over.wave },
  };
}
const linesOf = (o: EngravingOptions, carrier: string) => engravedLines(o).lines.filter((line) => line.carrier === carrier);

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: unknown[][] = [];
  #note(name: string, args: unknown[]) { this.ops.push([name, ...args]); }
  push() { this.#note("push", []); } pop() { this.#note("pop", []); }
  translate(...a: number[]) { this.#note("translate", a); } rotate(...a: number[]) { this.#note("rotate", a); }
  scale(...a: number[]) { this.#note("scale", a); }
  noFill() { this.#note("noFill", []); } noStroke() { this.#note("noStroke", []); }
  fill(...a: number[]) { this.#note("fill", a); } stroke(...a: number[]) { this.#note("stroke", a); }
  strokeWeight(...a: number[]) { this.#note("strokeWeight", a); } strokeCap(...a: unknown[]) { this.#note("strokeCap", a); }
  circle(...a: number[]) { this.#note("circle", a); } line(...a: number[]) { this.#note("line", a); }
  rect(...a: number[]) { this.#note("rect", a); } beginShape() { this.#note("beginShape", []); }
  vertex(...a: number[]) { this.#note("vertex", a); } endShape(...a: unknown[]) { this.#note("endShape", a); }
  count(name: string) { return this.ops.filter((op) => op[0] === name).length; }
}

test("tone field: fit rectangles, bilinear reading at pixel centres, edge extension", () => {
  const wide = (fit: "contain" | "cover" | "stretch") => toneField({ source: { kind: "raster", raster: halves }, width: 400, height: 200, fit, encode: "dark", smoothing: 0 });
  assert.deepEqual([...wide("contain").image], [-100, -100, 100, 100]);
  assert.deepEqual([...wide("cover").image], [-200, -200, 200, 200]);
  assert.deepEqual([...wide("stretch").image], [-200, -100, 200, 100]);
  const contain = wide("contain");
  near(contain.at(-50, 0), 1, 1e-9, "black side");
  near(contain.at(50, 0), 0, 1e-9, "white side");
  near(contain.at(0, 0), 0.5, 1e-9, "the pixel boundary averages its two centres");
  near(contain.at(-190, 30), 1, 1e-9, "left of the image repeats the edge tone");
  near(contain.at(190, -80), 0, 1e-9, "right of the image repeats the edge tone");
  near(toneField({ source: { kind: "raster", raster: halves }, width: 200, height: 200, fit: "contain", encode: "light", smoothing: 0 }).at(-50, 0), 0, 1e-9, "light encoding inverts");
});

test("tone value is CIE lightness of linear light, with paper as zero", () => {
  for (const byte of [0, 40, 100, 180, 255]) {
    const field = toneField({ source: { kind: "raster", raster: uniform(byte) }, width: 100, height: 100, fit: "contain", encode: "dark", smoothing: 0 });
    near(field.at(3, -7), Math.max(0, darkTone(byte)), 1e-9, `byte ${byte}`);
    near(toneField({ source: { kind: "raster", raster: uniform(byte) }, width: 100, height: 100, fit: "contain", encode: "light", smoothing: 0 }).at(3, -7),
      1 - Math.max(0, darkTone(byte)), 1e-9, `byte ${byte} light`);
  }
});

test("smoothing is an exact area average", () => {
  assert.deepEqual([...areaAverage(Float64Array.from([1, 3, 5, 7, 2, 4, 6, 8]), 4, 2, 2, 1)], [(1 + 3 + 2 + 4) / 4, (5 + 7 + 6 + 8) / 4]);
  // three cells onto two: each output cell covers 1.5 source cells
  const out = areaAverage(Float64Array.from([0, 3, 6]), 3, 1, 2, 1);
  near(out[0], (0 * 1 + 3 * 0.5) / 1.5); near(out[1], (3 * 0.5 + 6 * 1) / 1.5);
  const smoothed = toneField({ source: { kind: "raster", raster: halves }, width: 200, height: 200, fit: "contain", encode: "dark", smoothing: 100 });
  assert.equal(smoothed.columns, 2);
  near(smoothed.grid ? smoothed.at(-50, 0) : 0, 1, 1e-9, "a 2-column average of the two halves keeps them");
});

test("transparent pixels are empty paper in both encodings, and a region mask empties what it excludes", () => {
  const cutout = (color: number) => createRaster({ width: 32, height: 32, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight",
    data: Uint8Array.from({ length: 32 * 32 * 4 }, (_, i) => { const x = Math.floor(i / 4) % 32, channel = i % 4; return channel === 3 ? (x < 16 ? 255 : 0) : color; }) });
  const dark = toneField({ source: { kind: "raster", raster: cutout(0) }, width: 200, height: 200, fit: "contain", encode: "dark", smoothing: 0 });
  near(dark.at(-50, 10), 1, 1e-9); near(dark.at(50, 10), 0, 1e-9, "transparent, dark encoding");
  const light = toneField({ source: { kind: "raster", raster: cutout(255) }, width: 200, height: 200, fit: "contain", encode: "light", smoothing: 0 });
  near(light.at(-50, 10), 1, 1e-9); near(light.at(50, 10), 0, 1e-9, "transparent, light encoding");
  const black = uniform(0);
  const segmentation = segmentValueBands(gray(32, 32, (x) => (x < 16 ? 0 : 255)), { bands: 2, connectivity: 4 });
  const left = valueRegionMask(segmentation, segmentation.regions.findIndex((region) => region.centroid[0] < 16));
  const masked = toneField({ source: { kind: "raster", raster: black, mask: left }, width: 200, height: 200, fit: "contain", encode: "dark", smoothing: 0 });
  near(masked.at(-50, 0), 1); near(masked.at(50, 0), 0, 1e-9, "mask excludes the right half");
  assert.throws(() => toneField({ source: { kind: "raster", raster: gray(8, 8, () => 0), mask: left }, width: 10, height: 10, fit: "contain", encode: "dark", smoothing: 0 }), /Region mask is 32 x 32 but the source image is 8 x 8/);
});

test("uniform tone: each line is exactly A sin(2 pi f s) about its carrier, starting and ending on the clip boundary", () => {
  const o = make();
  const f = 0.1, A = 3;
  for (let k = -9; k <= 9; k++) {
    const runs = linesOf(o, `straight:${k}`);
    assert.equal(runs.length, 1, `line ${k} is one run`);
    const [line] = runs;
    assert.equal(line.id, `straight:${k}/r:0`);
    near(line.points[0][0], -100, 1e-9); near(line.points[line.points.length - 1][0], 100, 1e-9);
    for (const [x, y] of line.points) near(y, 10 * k + A * Math.sin(TAU * f * (x + 100)), 1e-9, `line ${k} at x=${x}`);
  }
  // the lines at the very edge are cut by the clip, never pushed outside it
  for (const line of engravedLines(o).lines) for (const [x, y] of line.points) assert.ok(Math.abs(x) <= 100 + 1e-9 && Math.abs(y) <= 100 + 1e-9);
});

test("tone mapping: threshold remap, curve, frequency and amplitude follow the documented equations", () => {
  const byte = 100, v = darkTone(byte), threshold = 0.3, curve = 1.5;
  assert.ok(v > threshold);
  const t = (v - threshold) / (1 - threshold), tau = t ** curve;
  const o = make({ source: { kind: "raster", raster: uniform(byte) }, tone: { curve, threshold }, wave: { baseFrequency: 4, frequencyGain: 12, baseAmplitude: 0.05, amplitudeGain: 0.5 } });
  const [line] = linesOf(o, "straight:0");
  for (let i = 0; i < line.points.length; i++) {
    near(line.signal.tone[i], tau, 1e-9);
    near(line.signal.frequency[i], (4 + 12 * tau) / 100, 1e-9, "frequency");
    near(line.signal.amplitude[i], 10 * (0.05 + 0.5 * tau), 1e-9, "amplitude");
    near(line.signal.offset[i], line.signal.amplitude[i] * Math.sin(line.signal.phase[i]), 1e-9);
  }
});

test("phase is continuous where the frequency changes; the step never exceeds the declared limit", () => {
  const o = make({ source: { kind: "raster", raster: halves }, wave: { baseFrequency: 3, frequencyGain: 9 } });
  const [line] = linesOf(o, "straight:0");
  const fMax = 0.12, fMin = 0.03;
  const phase = line.signal.phase, x = line.points.map((p) => p[0]);
  let rightConstant: number | null = null, left = 0, right = 0;
  for (let i = 0; i < phase.length; i++) {
    if (i > 0) { assert.ok(phase[i] >= phase[i - 1]); assert.ok(phase[i] - phase[i - 1] <= Math.PI / 8 + 1e-12, "sampling limit"); }
    const s = x[i] + 100;
    if (x[i] < -10) { near(phase[i] - TAU * fMax * s, 0, 1e-9, "left of the change"); left++; }
    if (x[i] > 10) {
      const c = phase[i] - TAU * fMin * s;
      rightConstant ??= c;
      near(c, rightConstant, 1e-9, "right of the change keeps one phase offset");
      right++;
    }
  }
  assert.ok(left > 50 && right > 50);
  const stats = engravedLines(o).stats;
  assert.ok(stats.largestPhaseStep <= Math.PI / 8 + 1e-12 && stats.maxFrequency <= ENGRAVING_LIMITS.frequencyPer100 / 100);
  near(stats.maxFrequency, fMax, 1e-9);
});

test("negative space: runs stop at the tone threshold, the wave resumes in phase, and empty is valid", () => {
  const disc = gray(64, 64, (x, y) => (Math.hypot(x + 0.5 - 32, y + 0.5 - 32) < 14 ? 0 : 255));
  const threshold = 0.5, o = make({ source: { kind: "raster", raster: disc }, tone: { threshold }, wave: { baseFrequency: 6, frequencyGain: 0 } });
  const tone = engravedLines(o).tone;
  const half = 100 / 64;  // one pixel in canvas units
  const radius = 14 * (200 / 64);
  for (const line of engravedLines(o).lines) {
    const k = Number(line.carrier.split(":")[1]);
    for (let i = 0; i < line.points.length; i++)
      assert.ok(tone.at(line.points[i][0], 10 * k) >= threshold - 0.05, "every vertex sits over tone at or above the threshold");
  }
  // the line through the disc's centre is one run whose chord is the disc's diameter (to within the bilinear edge)
  const [through] = linesOf(o, "straight:0");
  assert.equal(linesOf(o, "straight:0").length, 1);
  near(through.points[through.points.length - 1][0] - through.points[0][0], 2 * radius, 2 * half + 1, "chord");
  // the wave never restarts: phase = 2 pi f s along the whole carrier, gaps included
  near(through.signal.phase[0], TAU * 0.06 * (through.points[0][0] + 100), 1e-9, "phase at the start of a run after a gap");
  // lines that miss the disc entirely draw nothing
  for (const k of [-9, -8, 8, 9]) assert.equal(linesOf(o, `straight:${k}`).length, 0);
  // a threshold above every tone is an empty engraving, not an error
  assert.equal(engravedLines(make({ tone: { threshold: 0.98 }, source: { kind: "raster", raster: uniform(200) } })).lines.length, 0);
});

test("minimum length drops fragments without renaming the survivors", () => {
  const speckle = gray(64, 64, (x, y) => (Math.hypot(x + 0.5 - 32, y + 0.5 - 32) < 14 || (x === 50 && y === 12) ? 0 : 255));
  const source = { kind: "raster" as const, raster: speckle };
  const all = engravedLines(make({ source, tone: { threshold: 0.5 }, minLength: 0 })).lines;
  const kept = engravedLines(make({ source, tone: { threshold: 0.5 }, minLength: 12 })).lines;
  assert.ok(kept.length < all.length && kept.length > 0);
  const ids = new Set(all.map((line) => line.id));
  for (const line of kept) { assert.ok(ids.has(line.id)); assert.ok(line.points.reduce((sum, p, i, a) => (i ? sum + Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0), 0) >= 12); }
});

test("clip: footprint ellipse, image rectangle, and placement", () => {
  const ellipse = make({ footprint: { shape: "ellipse", width: 200, height: 120 } });
  let touching = 0;
  for (const line of engravedLines(ellipse).lines) for (const [x, y] of line.points) assert.ok((x / 100) ** 2 + (y / 60) ** 2 <= 1 + 1e-9);
  for (const line of engravedLines(ellipse).lines) {
    const [a, b] = [line.points[0], line.points[line.points.length - 1]];
    for (const [x, y] of [a, b]) if (Math.abs(y) < 55) { near((x / 100) ** 2 + (y / 60) ** 2, 1, 1e-9, "a run ends on the ellipse"); touching++; }
  }
  assert.ok(touching >= 20);
  const strip = make({ footprint: { width: 400, height: 200 } });
  const clipImage = engravedLines({ ...strip, image: { ...strip.image, clip: "image" } }), clipFootprint = engravedLines(strip);
  for (const line of clipImage.lines) for (const [x] of line.points) assert.ok(Math.abs(x) <= 100 + 1e-9, "image rectangle is 200 wide inside the 400-wide footprint");
  assert.ok(Math.max(...clipFootprint.lines.flatMap((line) => line.points.map((p) => Math.abs(p[0])))) > 190);
  // `cover` fills the footprint, so the image clip is the footprint whichever `clip` says
  const cover = { ...strip, image: { ...strip.image, fit: "cover" as const } };
  assert.equal(engravedLines({ ...cover, image: { ...cover.image, clip: "image" } }), engravedLines(cover));
  // placement: rotation about the centre then translation
  const placed = engravedLines(make({ footprint: { centerX: 300, centerY: 200, rotation: 90 } }));
  const flat = engravedLines(make());
  const a = placed.lines.find((line) => line.id === "straight:3/r:0")!, b = flat.lines.find((line) => line.id === "straight:3/r:0")!;
  b.points.forEach(([x, y], i) => { near(a.points[i][0], 300 - y, 1e-9); near(a.points[i][1], 200 + x, 1e-9); });
});

test("spacing: constant, tone-driven marching, rings and spiral have their analytic radii", () => {
  const black = toneField({ source: { kind: "raster", raster: uniform(0) }, width: 200, height: 200, fit: "contain", encode: "dark", smoothing: 0 });
  const carrier = { family: "straight" as const, spacing: 10, spacingGain: 0, angle: 0, bend: 0, bendLength: 100, radialX: 0, radialY: 0, follow: 0, flowSmoothing: 0, seed: 0 };
  const plain = engravingCarriers(carrier, black, null);
  for (const c of plain) near(c.y[7], c.index * 10, 1e-9);
  // tone-driven: dark on the left, paper on the right; the gap is spacing * (1 - gain * tone) at each x
  const split = toneField({ source: { kind: "raster", raster: halves }, width: 200, height: 200, fit: "contain", encode: "dark", smoothing: 0 });
  const driven = engravingCarriers({ ...carrier, spacingGain: 0.4 }, split, (x, y) => split.at(x, y));
  const at = (k: number, x: number) => { const c = driven.find((d) => d.index === k)!; const i = c.x.findIndex((cx) => cx >= x); return c.y[i]; };
  for (const k of [1, 2, 5]) {
    near(at(k, -60) - at(k - 1, -60), 10 * 0.6, 1e-9, `dark side gap ${k}`);
    near(at(k, 60) - at(k - 1, 60), 10, 1e-9, `paper side gap ${k}`);
    near(at(-k, -60) - at(-k + 1, -60), -10 * 0.6, 1e-9, `dark side negative gap ${k}`);
  }
  const rings = engravingCarriers({ ...carrier, family: "rings", spacing: 20, spacingGain: 0 }, black, null);
  for (const c of rings) { assert.equal(c.closed, true); for (let i = 0; i < c.x.length; i += 13) near(Math.hypot(c.x[i], c.y[i]), c.index * 20, 1e-9); }
  assert.ok(rings.every((c) => c.index * 20 >= 6) && rings[0].index === 1);
  const pitch = (gain: number) => {
    const [spiral] = engravingCarriers({ ...carrier, family: "spiral", spacing: 8, spacingGain: gain }, black, (() => 1) as () => number);
    let theta = 0, previous = Math.atan2(spiral.y[1], spiral.x[1]), worst = 0;
    for (let i = 2; i < spiral.x.length; i++) {
      const a = Math.atan2(spiral.y[i], spiral.x[i]); let d = a - previous; while (d < -Math.PI) d += TAU; while (d > Math.PI) d -= TAU;
      theta += d; previous = a;
      worst = Math.max(worst, Math.abs(Math.hypot(spiral.x[i], spiral.y[i]) - (8 * (1 - gain) * (theta + Math.atan2(spiral.y[1], spiral.x[1]) - 0)) / TAU));
    }
    return worst;
  };
  assert.ok(pitch(0) < 0.05, `spiral pitch ${pitch(0)}`);
  assert.ok(pitch(0.5) < 0.05, `driven spiral pitch ${pitch(0.5)}`);
});

test("rings close their phase to a whole number of cycles and offset inward", () => {
  const o = make({ footprint: { width: 300, height: 300 }, scan: { family: "rings", spacing: 20 }, wave: { baseFrequency: 6, frequencyGain: 0 } });
  const [ring] = linesOf(o, "ring:2");
  assert.equal(ring.closed, true);
  const f = 0.06;
  const black = toneField({ source: { kind: "raster", raster: uniform(0) }, width: 300, height: 300, fit: "contain", encode: "dark", smoothing: 0 });
  const L = engravingCarriers({ ...o.scan, seed: 0 }, black, null).find((c) => c.id === "ring:2")!.length;
  assert.ok(Math.abs(L - TAU * 40) < 0.1 && L < TAU * 40, "the carrier is the inscribed polygon of the circle");
  const k = Math.floor(ring.points.length / 2);
  const s = ring.signal.s[k], c = ((ring.signal.phase[k] - TAU * f * s) * L) / s;
  const cycles = (TAU * f * L + c) / TAU;
  near(cycles, Math.round(cycles), 1e-8, "whole cycles around the ring");
  assert.ok(Math.abs(c) <= Math.PI + 1e-9 && Math.abs(c) > 1e-3);
  ring.points.forEach(([x, y], i) => near(Math.hypot(x, y), 40 - ring.signal.offset[i], 0.01, "positive offset is inward for a clockwise ring (the carrier is an inscribed polygon: sagitta at most 1.5^2/(8 r))"));
  const n = ring.points.length;
  assert.ok(Math.abs(ring.signal.offset[0] - ring.signal.offset[n - 1]) <= ring.signal.amplitude[0] * (Math.PI / 8) + 1e-9, "the seam continues smoothly");
  assert.ok(engravedLines(o).stats.largestPhaseStep <= Math.PI / 8 + 1e-9);
});

test("flow follows the image's direction, keeps its spacing, and falls back to the scan angle", () => {
  const ramp = gray(64, 64, (x) => Math.round((x * 255) / 63));
  const tone = (raster: Raster) => toneField({ source: { kind: "raster", raster }, width: 200, height: 200, fit: "contain", encode: "dark", smoothing: 0 });
  const base = { family: "flow" as const, spacing: 10, spacingGain: 0, angle: 0, bend: 0, bendLength: 100, radialX: 0, radialY: 0, follow: 1, flowSmoothing: 4, seed: 5 };
  const field = tone(ramp), tau = () => 0;
  // a ramp along x has vertical level lines: every streamline is vertical and neighbours are exactly one spacing apart
  const vertical = engravingCarriers(base, field, tau);
  assert.ok(vertical.length >= 20);
  const xs: number[] = [];
  for (const c of vertical) { near(Math.max(...c.x) - Math.min(...c.x), 0, 1e-6, "vertical"); xs.push(c.x[0]); }
  xs.sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) near(xs[i] - xs[i - 1], 10, 1e-6, "spacing");
  // follow 0: parallel lines in the scan angle, whatever the image
  const angle = 30, parallel = engravingCarriers({ ...base, follow: 0, angle }, field, tau);
  const us = parallel.map((c) => { const [x, y] = [c.x[3], c.y[3]]; near(Math.atan2(c.y[c.y.length - 1] - c.y[0], c.x[c.x.length - 1] - c.x[0]), (angle * Math.PI) / 180, 1e-9); return -x * Math.sin(angle * Math.PI / 180) + y * Math.cos(angle * Math.PI / 180); }).sort((a, b) => a - b);
  for (let i = 1; i < us.length; i++) near(us[i] - us[i - 1], 10, 1e-6, "parallel spacing");
  // radial value gradient: level lines are circles about the centre
  const cone = gray(64, 64, (x, y) => Math.min(255, Math.round((Math.hypot(x - 31.5, y - 31.5) / 45) * 255)));
  const circles = engravingCarriers({ ...base, flowSmoothing: 2 }, tone(cone), tau);
  assert.ok(circles.length >= 6);
  let checked = 0;
  for (const c of circles) for (let i = 1; i < c.x.length; i++) {
    const mx = (c.x[i] + c.x[i - 1]) / 2, my = (c.y[i] + c.y[i - 1]) / 2, r = Math.hypot(mx, my);
    if (r < 40 || r > 85) continue;
    const dx = c.x[i] - c.x[i - 1], dy = c.y[i] - c.y[i - 1];
    const cross = Math.abs((dx * mx + dy * my) / (Math.hypot(dx, dy) * r));  // |cos| of the angle between the step and the radius
    assert.ok(cross < 0.12, `step is tangent to the circle at r=${r.toFixed(1)}: radial share ${cross.toFixed(3)}`);
    checked++;
  }
  assert.ok(checked > 200);
  // distinct streamlines never come closer than half the local spacing, also where streamlines converge (hyperbolic level lines of x*y)
  const saddle = gray(64, 64, (x, y) => Math.round(255 * Math.min(1, Math.abs((x - 31.5) * (y - 31.5)) / 400)));
  for (const [name, list] of [["circles", circles], ["saddle", engravingCarriers({ ...base, flowSmoothing: 2, seed: 9 }, tone(saddle), tau)]] as const) {
    const points = list.flatMap((c, n) => c.x.map((x, i) => [x, c.y[i], n] as const)).filter(([x, y]) => Math.abs(x) <= 100 && Math.abs(y) <= 100);
    let closest = Infinity;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) if (points[i][2] !== points[j][2]) closest = Math.min(closest, Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]));
    assert.ok(list.length >= 6 && closest >= 5 * (1 - 1e-9), `${name}: closest distance between two streamlines ${closest}`);
  }
});

test("seed: phase draws from componentSeed and matters only when phase spread or flow uses it", () => {
  const o = make({ wave: { phaseSpread: 0.5 }, seed: 11 });
  const [line] = linesOf(o, "straight:2");
  near(line.signal.phase[0], TAU * 0.5 * (componentSeed(11, "straight:2", "phase") / 2 ** 32), 1e-12);
  assert.notEqual(linesOf({ ...o, seed: 12 }, "straight:2")[0].signal.phase[0], line.signal.phase[0]);
  const locked = make();
  assert.equal(engravedLines({ ...locked, seed: 1 }), engravedLines({ ...locked, seed: 2 }), "seed-free construction is one cached result");
  assert.equal(usesSeed({ ...createInstrument("fm-engraving"), params: { ...createInstrument("fm-engraving").params, phaseSpread: 0, family: "straight" } }), false);
  assert.equal(usesSeed({ ...createInstrument("fm-engraving"), params: { ...createInstrument("fm-engraving").params, phaseSpread: 0, family: "flow" } }), true);
  const flow = (seed: number) => engravedLines({ ...make({ scan: { family: "flow", follow: 0 } }), seed }).lines.map((l) => l.id + l.points.length);
  assert.notDeepEqual(flow(1), flow(2));
});

test("appearance edits reuse the very same producer results; structural edits do not", () => {
  const input = createInstrument("fm-engraving");
  const a = engravingProducts(engravingComposition(input));
  const restyled = { ...input, palette: [0xff0000, 0x00ff00], params: { ...input.params, line: "stitch", lineWeight: 2.5, widthGain: 0, colorBy: "tone", stitchSpacing: 9 } };
  assert.equal(engravingProducts(engravingComposition(restyled)), a);
  for (const change of [{ threshold: 0.5 }, { spacing: 7 }, { baseFrequency: 7 }, { angle: 5 }, { variant: 4 }, { rotation: 10 }, { image: "geometry" }]) {
    const b = engravingProducts(engravingComposition({ ...input, params: { ...input.params, ...change } }));
    assert.notEqual(b, a, JSON.stringify(change));
  }
  // ids survive appearance edits of the drawn result and are unique
  const ids = a.lines.map((line) => line.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.lines) && Object.isFrozen(a.lines[0]) && Object.isFrozen(a.lines[0].signal.phase));
});

test("limits throw naming the control to change", () => {
  assert.throws(() => engravedLines(make({ footprint: { width: 4096, height: 4096 }, scan: { spacing: 1 } })), /line spacing|carrier stations|lines/);
  assert.throws(() => engravedLines(make({ wave: { baseFrequency: 40, frequencyGain: 20 } })), /Base frequency 40 \+ frequency gain 20 exceeds 50 waves per 100 units/);
  assert.throws(() => engravedLines(make({ wave: { baseAmplitude: 2, amplitudeGain: 3 } })), /Base amplitude 2 \+ amplitude gain 3 exceeds 4 line spacings/);
  const dense = createInstrument("fm-engraving");
  assert.throws(() => validateParameters("fm-engraving", { ...dense.params, width: 4096, height: 4096, spacing: 1 }), /line spacing/);
  assert.throws(() => validateParameters("fm-engraving", { ...dense.params, spacing: 0.5 }), /between 1 and 200/);
  assert.throws(() => engravedLines(make({ source: { kind: "bundled", id: "nothing" as never, variant: 0 } })), /Unknown source image "nothing"/);
});

test("drawing: weights, colours and pieces come from tone; stitches use the same runs", () => {
  const input = createInstrument("fm-engraving");
  const recipe = (params: Record<string, number | string | boolean>, palette = input.palette) => engravingComposition({ ...input, palette, params: { ...input.params, ...params } });
  const plain = recipe({ widthGain: 0, lineWeight: 1.7, colorBy: "ink" });
  const lines = engravingProducts(plain).lines;
  const flat = new Recorder(); drawEngraving(flat, plain);
  assert.equal(flat.count("beginShape"), lines.length);
  assert.ok(flat.ops.filter((op) => op[0] === "strokeWeight").every((op) => op[1] === 1.7));
  const swell = recipe({ widthGain: 1, lineWeight: 1.7 });
  const pieces = tonePieces(engravingProducts(swell).lines);
  const drawn = new Recorder(); drawEngraving(drawn, swell);
  assert.equal(drawn.count("beginShape"), pieces.length, "every piece has a positive weight");
  const weights = new Set(drawn.ops.filter((op) => op[0] === "strokeWeight").map((op) => op[1] as number));
  for (const w of weights) assert.ok(w > 0 && w <= 2 * 1.7);
  assert.ok(weights.size >= 4, "several tone bins are drawn at several weights");
  // pieces tile each run: they share end vertices, so the vertices add up to the run's vertices plus one per joint
  const perRun = new Map<string, number>();
  for (const p of pieces) { const run = p.id.slice(0, p.id.lastIndexOf("/b:")); perRun.set(run, (perRun.get(run) ?? 0) + p.points.length); }
  const count = new Map<string, number>();
  for (const p of pieces) { const run = p.id.slice(0, p.id.lastIndexOf("/b:")); count.set(run, (count.get(run) ?? 0) + 1); }
  for (const line of engravingProducts(swell).lines) assert.equal(perRun.get(line.id), line.points.length + count.get(line.id)! - 1, line.id);
  // the palette runs light to dark in tone mode
  const toneColors = recipe({ widthGain: 0, colorBy: "tone" }, [0x111111, 0x222222, 0x333333]);
  const colored = new Recorder(); drawEngraving(colored, toneColors);
  const strokes = new Set(colored.ops.filter((op) => op[0] === "stroke").map((op) => String(op[1])));
  assert.ok(strokes.size >= 2 && strokes.size <= 3);
  const stitched = new Recorder(); drawEngraving(stitched, recipe({ line: "stitch", stitchSpacing: 6 }));
  assert.equal(stitched.count("beginShape"), 0);
  assert.ok(stitched.count("line") > 100);
  const custom = new Recorder(); let seen = 0;
  drawEngraving(custom, plain, { line: (surface, path) => { seen++; surface.circle(path.points[0][0], path.points[0][1], 2); } });
  assert.equal(seen, lines.length); assert.equal(custom.count("circle"), lines.length);
});

test("instrument: registered, grouped, conditional; hidden controls do not change the drawing", () => {
  const input = createInstrument("fm-engraving");
  assert.equal(canPrepareInstrument("fm-engraving"), true);
  const shown = (params: Record<string, number | string | boolean>) => visibleParameters("fm-engraving", { ...input.params, ...params }).map((p) => p.key);
  assert.ok(shown({ family: "flow" }).includes("follow") && !shown({ family: "straight" }).includes("follow"));
  assert.ok(shown({ family: "rings" }).includes("radialX") && !shown({ family: "rings" }).includes("angle"));
  assert.ok(shown({ line: "stitch" }).includes("stitchSpacing") && !shown({ line: "ink" }).includes("stitchSpacing"));
  assert.ok(!shown({ fit: "cover" }).includes("clip"));
  const placement = inspectorItems("fm-engraving", input.params).find((item) => item.kind === "group" && item.label === "Placement");
  const size = placement?.kind === "group" ? placement.items.find((item) => item.kind === "group" && item.label === "Size") : undefined;
  assert.ok(size?.kind === "group" && size.proportional && size.items.length === 2, "Placement holds a proportional Size group");
  const hiddenChange = (base: Record<string, number | string | boolean>, changes: Record<string, number | string | boolean>) => {
    const a = drawFingerprint({ ...input, params: { ...input.params, ...base } }), b = drawFingerprint({ ...input, params: { ...input.params, ...base, ...changes } });
    return a === b;
  };
  assert.ok(hiddenChange({ family: "straight" }, { bend: 33, bendLength: 90, radialX: 0.3, radialY: -0.2, follow: 0.1, flowSmoothing: 40 }), "straight ignores curved, radial and flow controls");
  assert.ok(hiddenChange({ family: "rings" }, { angle: 60, bend: 20, follow: 0.2 }), "rings ignore angle");
  assert.ok(hiddenChange({ family: "spiral", line: "ink" }, { angle: -40, stitchSpacing: 20, stitchPhase: 0.8 }));
  assert.ok(hiddenChange({ fit: "cover", clip: "image" }, { clip: "footprint" }), "clip only matters under contain");
  assert.ok(hiddenChange({ line: "stitch" }, { widthGain: 0.9 }), "stitches ignore tone to width");
  assert.ok(hiddenChange({ phaseSpread: 0, family: "straight" }, {}), "trivial");
  assert.equal(drawFingerprint({ ...input, seed: 1, params: { ...input.params, phaseSpread: 0 } }), drawFingerprint({ ...input, seed: 2, params: { ...input.params, phaseSpread: 0 } }));
  assert.notEqual(drawFingerprint({ ...input, seed: 1 }), drawFingerprint({ ...input, seed: 2 }));
  assert.notEqual(drawFingerprint({ ...input, params: { ...input.params, family: "rings" } }), drawFingerprint(input));
});

test("preparation is cooperative and cancellable", async () => {
  const input = createInstrument("fm-engraving");
  assert.equal(await prepareInstrument(input, () => true), false);
  assert.equal(await prepareInstrument(input, () => false), true);
  let calls = 0;
  assert.equal(await prepareInstrument({ ...input, params: { ...input.params, spacing: 9 } }, () => ++calls > 1), false);
});

test("a region mask engraves one connected value region and nothing else", () => {
  const squares = gray(32, 32, (x, y) => ((x >= 4 && x < 12 && y >= 4 && y < 12) || (x >= 20 && x < 28 && y >= 20 && y < 28) ? 0 : 255));
  const segmentation = segmentValueBands(squares, { bands: 2, connectivity: 4 });
  const first = segmentation.regions.findIndex((region) => region.band === 0 && region.centroid[0] < 16);
  const mask = valueRegionMask(segmentation, first);
  const o = make({ source: { kind: "raster", raster: squares, mask }, tone: { threshold: 0.5 }, wave: { baseFrequency: 5, frequencyGain: 0, baseAmplitude: 0.1, amplitudeGain: 0 } });
  const points = engravedLines(o).lines.flatMap((line) => line.points);
  assert.ok(points.length > 100);
  const px = 200 / 32;
  for (const [x, y] of points) {
    assert.ok(x >= -100 + 4 * px - 1 && x <= -100 + 12 * px + 1, `x ${x}`);
    assert.ok(y >= -100 + 4 * px - 1 - 1 && y <= -100 + 12 * px + 1 + 1, `y ${y}`);
  }
});
