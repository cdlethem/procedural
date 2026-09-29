import assert from "node:assert/strict";
import test from "node:test";
import {
  bundledFrameStack, componentSeed, createFrameStack, createInstrument, createRaster, definition, drawInstrument, drawSlit, partitionRegions,
  prepareInstrument, quiltCells, slicePermutation, sliceTable, slitBands, slitComposition, slitFragments, slitRects, slitScene, slitStrips, stripPixel,
  timeProgress, visibleParameters, bundledRecording, gestureTrack,
  type CompositionSurface, type DrawingContext, type FrameStack, type FragmentSet, type SlitRectOptions, type StripSet, type InstrumentInput, type Raster, type SliceOrder, type SliceTableOptions, type SlitLine, type SlitRect,
} from "../dist/index.js";

const decode = (c: number): number => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const encode = (l: number): number => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055));
const U32 = 0x1_0000_0000;

const image = (width: number, height: number, pixel: (i: number, j: number) => [number, number, number]): Raster => {
  const data = new Uint8Array(width * height * 3);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) data.set(pixel(i, j), (j * width + i) * 3);
  return createRaster({ width, height, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data });
};
const order = (kind: SliceOrder["kind"], extra: Partial<SliceOrder> = {}): SliceOrder => ({ kind, groups: 3, disorder: 0, phase: 0, ...extra });
const none = { mode: "none" as const, amount: 0, period: 10 };
const table = (overrides: Partial<SliceTableOptions> = {}, stack?: FrameStack) => sliceTable({
  seed: 1, count: 16, repeats: 1, repeatMode: "same", order: order("sequence"), offset: none, scale: none, scan: { kind: "space" }, ...overrides,
}, stack);
const LINE: SlitLine = { x: 0.5, angle: 0, bend: 0, length: 1 };
const stripOptions = { direction: "columns" as const, width: 160, height: 160, detail: 16, outside: "clamp" as const, slit: LINE };
/** A 16 x 16 image whose pixel (i, j) has red 16 i and green 16 j: every sample identifies its source pixel. */
const coordinates = image(16, 16, (i, j) => [16 * i, 16 * j, 0]);
const pixels = (strips: StripSet, row: number) => Array.from({ length: strips.detail }, (_, m) => stripPixel(strips, row, m));

test("permutations are exact: reverse, comb, interleave and phase on known lengths", () => {
  assert.deepEqual([...slicePermutation(5, order("sequence"), 1)], [0, 1, 2, 3, 4]);
  assert.deepEqual([...slicePermutation(5, order("reverse"), 1)], [4, 3, 2, 1, 0]);
  assert.deepEqual([...slicePermutation(7, order("comb", { groups: 3 }), 1)], [0, 3, 6, 1, 4, 2, 5]);
  assert.deepEqual([...slicePermutation(5, order("interleave", { groups: 2 }), 1)], [0, 3, 1, 4, 2]);
  assert.deepEqual([...slicePermutation(7, order("interleave", { groups: 3 }), 1)], [0, 3, 6, 1, 4, 2, 5]);
  assert.deepEqual([...slicePermutation(5, order("sequence", { phase: 0.4 }), 1)], [2, 3, 4, 0, 1]);
  assert.deepEqual([...slicePermutation(5, order("reverse", { phase: 1.4 }), 1)], [2, 1, 0, 4, 3]);
  assert.deepEqual([...slicePermutation(4, order("comb", { groups: 9 }), 1)], [0, 1, 2, 3], "groups beyond the count are capped to it");
});

test("every order is a permutation of the slice indices, for random sizes, groups, phases and seeds", () => {
  let state = 12345;
  const rand = (n: number) => { state = (Math.imul(state, 1103515245) + 12345) >>> 0; return state % n; };
  for (let trial = 0; trial < 300; trial++) {
    const count = 1 + rand(80), kinds = ["sequence", "reverse", "comb", "interleave", "shuffle"] as const;
    const p = slicePermutation(count, order(kinds[rand(5)], { groups: 2 + rand(9), disorder: rand(101) / 100, phase: rand(300) / 100 - 1 }), rand(1000));
    assert.deepEqual([...p].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i));
  }
});

test("shuffle moves exactly the slices whose own ids pick them, among themselves", () => {
  const count = 40, seed = 7, disorder = 0.35;
  const picked = Array.from({ length: count }, (_, s) => s).filter((s) => componentSeed(seed, `slice:${String(s).padStart(3, "0")}`, "pick") / U32 < disorder);
  assert.ok(picked.length > 3 && picked.length < count - 3);
  const p = slicePermutation(count, order("shuffle", { disorder }), seed);
  for (let slot = 0; slot < count; slot++) if (!picked.includes(slot)) assert.equal(p[slot], slot);
  assert.deepEqual(picked.map((s) => p[s]).sort((a, b) => a - b), picked);
  assert.deepEqual([...slicePermutation(count, order("shuffle", { disorder: 0 }), seed)], Array.from({ length: count }, (_, i) => i));
  assert.notDeepEqual([...slicePermutation(count, order("shuffle", { disorder: 1 }), seed)], [...slicePermutation(count, order("shuffle", { disorder: 1 }), seed + 1)]);
  // The traded order comes from the ids' own hashes.
  const keyed = [...picked].sort((a, b) => componentSeed(seed, `slice:${String(a).padStart(3, "0")}`, "shuffle") - componentSeed(seed, `slice:${String(b).padStart(3, "0")}`, "shuffle"));
  picked.forEach((slot, j) => assert.equal(p[slot], keyed[j]));
});

test("rows keep stable ids under reordering while their bands move; repeats add suffixed rows", () => {
  const sequence = table(), reversed = table({ order: order("reverse") }), shuffled = table({ order: order("shuffle", { disorder: 1 }) });
  for (const t of [reversed, shuffled]) assert.deepEqual(t.rows.map((r) => r.id).sort(), sequence.rows.map((r) => r.id).sort());
  reversed.rows.forEach((row, slot) => {
    assert.equal(row.slot, slot);
    assert.equal(row.source, 15 - slot);
    assert.equal(row.id, `slice:${String(15 - slot).padStart(3, "0")}`);
    assert.deepEqual(row.interval, [(15 - slot) / 16, (16 - slot) / 16]);
    assert.deepEqual(row.across, [slot / 16, (slot + 1) / 16]);
  });
  const repeated = table({ count: 4, repeats: 3, repeatMode: "alternate" });
  assert.equal(repeated.total, 12);
  assert.deepEqual(repeated.rows.map((r) => r.source), [0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3]);
  assert.deepEqual(repeated.rows.map((r) => r.id), ["slice:000", "slice:001", "slice:002", "slice:003", "slice:003:r1", "slice:002:r1", "slice:001:r1", "slice:000:r1", "slice:000:r2", "slice:001:r2", "slice:002:r2", "slice:003:r2"]);
  assert.deepEqual(repeated.rows[5].across, [5 / 12, 6 / 12]);
  assert.deepEqual(repeated.rows[5].interval, [0.5, 0.75], "each repeat reads the whole source");
  assert.deepEqual(table({ count: 4, repeats: 2 }).rows.map((r) => r.source), [0, 1, 2, 3, 0, 1, 2, 3]);
  assert.equal(repeated.rows[4].seed, repeated.rows[3].seed, "a repeat draws from its slice's own stream");
});

test("offset and scale patterns follow the output slot (ramp, wave, alternate) or the slice (random)", () => {
  const wave = { mode: "wave" as const, amount: 0.3, period: 8 };
  const t = table({ count: 9, offset: { mode: "ramp", amount: 0.2, period: 1 }, scale: { mode: "alternate", amount: 1, period: 1 } });
  t.rows.forEach((row, slot) => {
    assert.ok(Math.abs(row.offset - 0.2 * ((2 * slot) / 8 - 1)) < 1e-12);
    assert.equal(row.scale, slot % 2 === 0 ? 2 : 0.5);
  });
  const w = table({ count: 9, offset: wave });
  assert.ok(Math.abs(w.rows[2].offset - 0.3) < 1e-6 && Math.abs(w.rows[6].offset + 0.3) < 1e-6 && Math.abs(w.rows[0].offset) < 1e-12 && Math.abs(w.rows[4].offset) < 1e-6);
  const random = { mode: "random" as const, amount: 0.25, period: 1 };
  const a = table({ count: 6, offset: random, seed: 3 }), b = table({ count: 6, offset: random, order: order("reverse"), seed: 3 });
  for (const row of a.rows) {
    const expected = 0.25 * (2 * (componentSeed(3, row.id, "offset") / U32) - 1);
    assert.equal(row.offset, expected);
    assert.equal(b.rows.find((other) => other.id === row.id)!.offset, expected, "the value travels with the slice");
  }
  // ramp stays at the slot: reversing the order does not change any slot's offset.
  const ramp = { mode: "ramp" as const, amount: 0.2, period: 1 };
  assert.deepEqual(table({ offset: ramp }).rows.map((r) => r.offset), table({ offset: ramp, order: order("reverse") }).rows.map((r) => r.offset));
  assert.equal(table({ count: 1, offset: ramp }).rows[0].offset, 0);
});

test("time curves have exact values; a recorded gesture drives time with its own timing", () => {
  assert.equal(timeProgress({ kind: "linear" }, 0.3, 1), 0.3);
  assert.equal(timeProgress({ kind: "power", power: 2 }, 0.5, 1), 0.25);
  assert.ok(Math.abs(timeProgress({ kind: "power", power: 0.5 }, 0.25, 1) - 0.5) < 1e-12);
  const swing = (u: number) => timeProgress({ kind: "swing", cycles: 1 }, u, 1);
  assert.ok(Math.abs(swing(0)) < 1e-6 && Math.abs(swing(0.5) - 1) < 1e-6 && Math.abs(swing(1)) < 1e-6 && Math.abs(swing(0.25) - 0.5) < 1e-6);
  assert.ok(Math.abs(timeProgress({ kind: "swing", cycles: 0.5 }, 1, 1) - 1) < 1e-6);
  const distance = (u: number) => timeProgress({ kind: "gesture", recording: "spiral", channel: "distance" }, u, 1);
  let previous = -1;
  for (let i = 0; i <= 200; i++) { const v = distance(i / 200); assert.ok(v >= previous - 1e-12); previous = v; }
  assert.equal(distance(0), 0);
  assert.equal(distance(1), 1);
  // The spiral has two exact rests: distance is constant across them (time freezes), so some stretch of u is flat.
  const track = gestureTrack(bundledRecording("spiral", 1), { smoothing: 0, frame: { centerX: 0, centerY: 0, scale: 1, rotation: 0 } });
  const halfway = track.arc[Math.floor((track.count - 1) / 2)] / track.length;
  assert.ok(Math.abs(distance(0.5) - halfway) < 1e-9, "the map is the recording's own arc fraction at the same fraction of its time");
  const flat = Array.from({ length: 400 }, (_, i) => distance((i + 1) / 400) - distance(i / 400)).filter((d) => d < 1e-9).length;
  assert.ok(flat > 8, `${flat} flat steps at the rests`);
  assert.throws(() => timeProgress({ kind: "power", power: 0 }, 0.5, 1), /Curve power/);
});

const frameCode = (k: number): Raster => image(16, 16, (i, j) => [16 * i, 16 * j, 64 * k]);
const codes = createFrameStack({ id: "codes", times: [0, 1, 2, 3], frames: [0, 1, 2, 3].map(frameCode) });
const timeScan = (extra: Partial<Extract<SliceTableOptions["scan"], { kind: "time" }>> = {}): SliceTableOptions["scan"] =>
  ({ kind: "time", curve: { kind: "linear" }, window: { start: 0, length: 1 }, end: "clamp", interpolation: "hold", ...extra });

test("a temporal table maps each band to its frame and timestamp exactly", () => {
  const hold = table({ count: 4, scan: timeScan() }, codes);
  // u = 1/8, 3/8, 5/8, 7/8 of a 3 s sequence: 0.375, 1.125, 1.875, 2.625 s.
  assert.deepEqual(hold.rows.map((r) => r.time!.time), [0.375, 1.125, 1.875, 2.625]);
  assert.deepEqual(hold.rows.map((r) => r.time!.frame), [0, 1, 1, 2]);
  const linear = table({ count: 4, scan: timeScan({ interpolation: "linear" }) }, codes);
  assert.deepEqual(linear.rows.map((r) => [r.time!.frame, r.time!.next]), [[0, 1], [1, 2], [1, 2], [2, 3]]);
  assert.deepEqual(linear.rows.map((r) => r.time!.mix), [0.375, 0.125, 0.875, 0.625]);
  const nearest = table({ count: 4, scan: timeScan({ interpolation: "nearest" }) }, codes);
  assert.deepEqual(nearest.rows.map((r) => r.time!.frame), [0, 1, 2, 3]);
  const reversed = table({ count: 4, order: order("reverse"), scan: timeScan() }, codes);
  assert.deepEqual(reversed.rows.map((r) => r.time!.frame), [2, 1, 1, 0], "reordering slices reorders time");
  const shifted = table({ count: 4, order: order("sequence", { phase: 0.25 }), scan: timeScan() }, codes);
  assert.deepEqual(shifted.rows.map((r) => r.time!.time), [1.125, 1.875, 2.625, 0.375]);
  const windowed = table({ count: 4, scan: timeScan({ window: { start: 0.5, length: 0.5 } }) }, codes);
  assert.deepEqual(windowed.rows.map((r) => r.time!.time), [1.6875, 2.0625, 2.4375, 2.8125]);
  assert.equal(table({ count: 4 }).rows[0].time, null, "a spatial table has no time source");
  assert.throws(() => table({ scan: timeScan() }), /needs a frame stack/);
});

test("past-the-end times follow the chosen behaviour and fail names the controls to change", () => {
  const wide = (end: "clamp" | "loop" | "mirror" | "fail") => table({ count: 4, scan: timeScan({ window: { start: 0, length: 2 }, end }) }, codes);
  assert.deepEqual(wide("clamp").rows.map((r) => r.time!.time), [0.75, 2.25, 3, 3]);
  assert.deepEqual(wide("loop").rows.map((r) => r.time!.time), [0.75, 2.25, 0.75, 2.25]);
  assert.deepEqual(wide("mirror").rows.map((r) => r.time!.time), [0.75, 2.25, 2.25, 0.75]);
  assert.throws(() => wide("fail"), /Time 3\.75 s is outside the frame sequence \[0, 3\] s.*Window start, Window length or Time curve/);
  assert.equal(table({ count: 4, scan: timeScan({ window: { start: 0, length: 1 }, end: "fail" }) }, codes).rows.length, 4, "an exact fit needs no end behaviour");
});

test("strips reproduce the source pixels exactly for the identity mapping, reversal and repeats", () => {
  const source = { kind: "image" as const, raster: coordinates };
  const identity = slitStrips(source, table(), stripOptions);
  for (let s = 0; s < 16; s++) pixels(identity, s).forEach((px, m) => assert.deepEqual(px, [16 * s, 16 * m, 0, 255], `slice ${s} sample ${m}`));
  const reversed = slitStrips(source, table({ order: order("reverse") }), stripOptions);
  for (let slot = 0; slot < 16; slot++) assert.deepEqual(stripPixel(reversed, slot, 5), [16 * (15 - slot), 80, 0, 255]);
  const rows = slitStrips(source, table(), { ...stripOptions, direction: "rows" });
  for (let s = 0; s < 16; s++) pixels(rows, s).forEach((px, m) => assert.deepEqual(px, [16 * m, 16 * s, 0, 255], `row ${s} sample ${m}`));
  // Repeats squeeze the whole source into each period: band k of period r shows slice k.
  const repeated = slitStrips(source, table({ count: 8, repeats: 2 }), { ...stripOptions, detail: 16 });
  assert.deepEqual(stripPixel(repeated, 3, 4), stripPixel(repeated, 11, 4));
  assert.equal(repeated.rows, 16);
});

test("offset moves content along the band and the outside policy decides what the vacated end shows", () => {
  const source = { kind: "image" as const, raster: coordinates };
  const shifted = (outside: "clamp" | "wrap" | "mirror" | "void") => slitStrips(source, table({ offset: { mode: "alternate", amount: 0.25, period: 1 } }), { ...stripOptions, outside });
  // Slot 0 has offset +0.25 = 4 samples toward larger l: sample m shows source row m - 4.
  const rowOf = (strips: StripSet, m: number) => stripPixel(strips, 0, m)[1] / 16;
  const rows = (o: "clamp" | "wrap" | "mirror" | "void") => Array.from({ length: 16 }, (_, m) => (stripPixel(shifted(o), 0, m)[3] === 0 ? null : rowOf(shifted(o), m)));
  assert.deepEqual(rows("void"), [null, null, null, null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(rows("clamp"), [0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(rows("wrap"), [12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(rows("mirror"), [3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // The next slot has offset -0.25: content moves toward smaller l.
  assert.equal(stripPixel(shifted("void"), 1, 15)[3], 0);
  assert.equal(stripPixel(shifted("void"), 1, 11)[1] / 16, 15);
});

test("scale stretches content about the band's middle", () => {
  const step = image(4, 16, (_, j) => (j < 12 ? [0, 0, 0] : [255, 255, 255]));
  const strips = slitStrips({ kind: "image", raster: step }, table({ count: 4, scale: { mode: "alternate", amount: 1, period: 1 } }),
    { ...stripOptions, width: 64, height: 256, detail: 16 });
  // Slot 1 has scale 1/2: the edge at p = 12/16 lands at l = 0.5 + 0.25 * 0.5 = 0.625, so samples m <= 9 read black and m >= 10 white.
  const lum = (m: number) => stripPixel(strips, 1, m)[0];
  for (let m = 0; m < 16; m++) assert.equal(lum(m), m >= 10 ? 255 : 0, `sample ${m}`);
  // Slot 0 has scale 2: the middle stays put and only the central half of the source is read.
  const slot0 = Array.from({ length: 16 }, (_, m) => stripPixel(strips, 0, m)[0]);
  assert.ok(slot0.slice(0, 15).every((v) => v === 0), "the edge lies beyond the band");
  assert.ok(slot0[15] > 0 && slot0[15] < 255, "the last sample only starts to reach it");
});

test("a slit reads frame, position and time exactly: line, angle, bend, length and the frame edge", () => {
  const source = { kind: "stack" as const, stack: codes };
  const t = table({ count: 4, scan: timeScan() }, codes);
  const options = { ...stripOptions, slit: { ...LINE, x: 8.5 / 16 } };
  const vertical = slitStrips(source, t, options);
  for (let s = 0; s < 4; s++) pixels(vertical, s).forEach((px, m) => assert.deepEqual(px, [16 * 8, 16 * m, 64 * [0, 1, 1, 2][s], 255], `band ${s} sample ${m}`));
  // A horizontal slit (angle 90) through a stack that only varies by column reads column m.
  const columns = createFrameStack({ id: "c", times: [0, 1, 2, 3], frames: [0, 1, 2, 3].map((k) => image(16, 16, (i) => [16 * i, 0, 64 * k])) });
  const across = slitStrips({ kind: "stack", stack: columns }, table({ count: 4, scan: timeScan() }, columns), { ...stripOptions, slit: { ...LINE, x: 0.5, angle: 90 } });
  pixels(across, 2).forEach((px, m) => assert.deepEqual(px, [16 * m, 0, 64, 255]));
  // A bend pushes the middle sample (p = 0.5) to the right by bend x frame side.
  const bent = slitStrips({ kind: "stack", stack: columns }, table({ count: 4, scan: timeScan() }, columns), { ...stripOptions, detail: 5, slit: { x: 8.5 / 16, angle: 0, bend: 0.25, length: 1 } });
  assert.equal(stripPixel(bent, 0, 2)[0], 16 * 12);
  // At p = 0.1 the bulge is 0.25 * 16 * (1 - 0.8^2) = 1.44, so x = 9.94: 0.44 of the way from column 9 (center 9.5) to column 10, mixed in linear light.
  assert.equal(stripPixel(bent, 0, 0)[0], encode(0.56 * decode(144) + 0.44 * decode(160)));
  // A slit longer than the frame is void where it leaves it: p < 1/6 and p > 5/6 for length 1.5 (samples 0-2 and 13-15 of 16).
  const long = slitStrips(source, t, { ...stripOptions, slit: { ...LINE, x: 8.5 / 16, length: 1.5 } });
  const voids = pixels(long, 0).map((px, m) => (px[3] === 0 ? m : -1)).filter((m) => m >= 0);
  assert.deepEqual(voids, [0, 1, 2, 13, 14, 15]);
});

test("cross-fading mixes the two frames in linear light", () => {
  const flat = (v: number): Raster => image(4, 4, () => [v, v, v]);
  const stack = createFrameStack({ id: "f", times: [0, 1], frames: [flat(20), flat(220)] });
  const strips = slitStrips({ kind: "stack", stack }, table({ count: 4, scan: timeScan({ interpolation: "linear" }) }, stack), { ...stripOptions, detail: 4 });
  for (let s = 0; s < 4; s++) {
    const mix = (s + 0.5) / 4, expected = encode((1 - mix) * decode(20) + mix * decode(220));
    assert.deepEqual(stripPixel(strips, s, 1), [expected, expected, expected, 255]);
    assert.notEqual(expected, Math.round((1 - mix) * 20 + mix * 220), "not the sRGB average");
  }
});

test("alpha is thresholded at one half: transparent source regions are void, not black", () => {
  const data = new Uint8Array(4 * 4 * 4);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) data.set([200, 50, 20, i < 2 ? 255 : 100], (j * 4 + i) * 4);
  const raster = createRaster({ width: 4, height: 4, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight", data });
  const strips = slitStrips({ kind: "image", raster }, table({ count: 4 }), { ...stripOptions, width: 40, height: 40, detail: 4 });
  assert.equal(stripPixel(strips, 0, 0)[3], 255);
  assert.equal(stripPixel(strips, 1, 0)[3], 255);
  assert.equal(stripPixel(strips, 2, 0)[3], 0);
  assert.equal(stripPixel(strips, 3, 3)[3], 0);
  assert.deepEqual(stripPixel(strips, 0, 0).slice(0, 3), [200, 50, 20]);
});

const flat = (r: number, g: number, b: number): Raster => image(32, 32, () => [r, g, b]);
const paletteDark = [0x000000, 0xffffff];
const rectOptions = (o: Partial<SlitRectOptions> = {}): SlitRectOptions => ({
  direction: "columns", width: 200, height: 100, color: { mode: "source", levels: 8, threshold: 0.5, palette: paletteDark }, gap: 0, cells: null, ...o,
});
const rectsFor = (raster: Raster, t = table({ count: 8 }), o: Partial<SlitRectOptions> = {}, detail = 10, fragments = null as FragmentSet | null) => {
  const width = o.width ?? 200, height = o.height ?? 100;
  const strips = slitStrips({ kind: "image", raster }, t, { direction: o.direction ?? "columns", width, height, detail, outside: "clamp", slit: LINE });
  return slitRects(t, strips, fragments, rectOptions(o));
};
const area = (rects: readonly SlitRect[]) => rects.reduce((sum, r) => sum + r.width * r.height, 0);

test("bands merge into runs and across neighbours: a flat picture is one rectangle, gaps separate the bands", () => {
  const merged = rectsFor(flat(200, 30, 90));
  assert.equal(merged.length, 1);
  assert.deepEqual([merged[0].x, merged[0].y, merged[0].width, merged[0].height], [-100, -50, 200, 100]);
  const levels = 8, quantized = [200, 30, 90].map((c) => Math.round((Math.round((c / 255) * (levels - 1)) / (levels - 1)) * 255));
  assert.deepEqual([...merged[0].rgb], quantized);
  assert.deepEqual(merged[0].rows, ["slice:000", "slice:007"]);
  const gapped = rectsFor(flat(200, 30, 90), table({ count: 8 }), { gap: 0.2 });
  assert.equal(gapped.length, 8);
  for (const r of gapped) assert.ok(Math.abs(r.width - 25 * 0.8) < 1e-9 && r.height === 100);
  assert.ok(Math.abs(area(gapped) - 0.8 * 200 * 100) < 1e-6);
  gapped.slice(1).forEach((r, k) => assert.ok(Math.abs(r.x - (gapped[k].x + gapped[k].width) - 25 * 0.2) < 1e-9));
  const rows = rectsFor(flat(200, 30, 90), table({ count: 8 }), { direction: "rows" });
  assert.deepEqual([rows[0].width, rows[0].height], [200, 100]);
});

test("a two-tone picture gives one rectangle per tone and reversal swaps them", () => {
  const halves = image(32, 32, (i) => (i < 16 ? [255, 0, 0] : [0, 0, 255]));
  const two = rectsFor(halves);
  assert.equal(two.length, 2);
  assert.deepEqual([two[0].x, two[0].width, [...two[0].rgb]], [-100, 100, [255, 0, 0]]);
  assert.deepEqual([two[1].x, two[1].width, [...two[1].rgb]], [0, 100, [0, 0, 255]]);
  const swapped = rectsFor(halves, table({ count: 8, order: order("reverse") }));
  assert.deepEqual([[...swapped[0].rgb], [...swapped[1].rgb]], [[0, 0, 255], [255, 0, 0]]);
  const doubled = rectsFor(halves, table({ count: 4, repeats: 2 }));
  assert.equal(doubled.length, 4, "each period is red then blue");
  assert.deepEqual(doubled.map((r) => r.width), [50, 50, 50, 50]);
});

test("the tonal ramp steps lightness through the palette and ink keeps only the dark samples", () => {
  const ramp = image(64, 4, (i) => { const v = Math.round((i * 255) / 63); return [v, v, v]; });
  const t = table({ count: 8 });
  const strips = slitStrips({ kind: "image", raster: ramp }, t, { ...stripOptions, width: 64, height: 4, detail: 4 });
  const rects = slitRects(t, strips, null, { ...rectOptions({ width: 64, height: 4 }), color: { mode: "ramp", levels: 4, threshold: 0.5, palette: paletteDark } });
  // One rectangle per tone step; each band is 8 columns of the ramp, so its tone is the step of its central column's gray.
  const expected = Array.from({ length: 8 }, (_, s) => {
    const v = Math.round((Math.round(((s * 8 + 3.5) * 255) / 63) / 255) * 3); // near-center of band
    return v;
  });
  const steps = rects.map((r) => Math.round(r.rgb[0] / 85));
  assert.deepEqual(rects.map((r) => r.rgb[0]), steps.map((v) => v * 85), "colors are palette stops 0, 85, 170, 255");
  assert.ok(steps.every((v, k) => k === 0 || v > steps[k - 1]), "tones increase left to right");
  assert.equal(rects.length, new Set(steps).size);
  assert.ok(expected.length === 8);
  const ink = slitRects(t, strips, null, { ...rectOptions({ width: 64, height: 4 }), color: { mode: "ink", levels: 4, threshold: 0.5, palette: [0x102030, 0xffffff] } });
  assert.deepEqual([...ink[0].rgb], [0x10, 0x20, 0x30]);
  assert.ok(Math.abs(area(ink) - 64 * 4 * 0.5) < 64 * 4 * 0.06, "roughly the darker half is inked");
  for (const r of ink) assert.ok(r.x + r.width <= 0 + 1e-9, "only the left (dark) half");
});

test("a quilt mask clips bands exactly to the retained leaves", () => {
  const raster = flat(90, 160, 30), width = 200, height = 100, seed = 5;
  const mask = { kind: "quilt" as const, grid: 6, cuts: 8, keep: 0.6 };
  const cells = quiltCells(mask, seed, width, height);
  const leaves = partitionRegions({ seed: componentSeed(seed, "mask", "partition"), width, height, centerX: 0, centerY: 0, columns: 6, rows: 6, attempts: 8, axis: "LONGEST", bias: -0.2 });
  const kept = leaves.filter((leaf) => componentSeed(seed, leaf.id, "keep") / U32 < 0.6);
  assert.ok(kept.length > 2 && kept.length < leaves.length);
  assert.deepEqual(cells, kept.map((leaf) => leaf.bounds));
  const total = leaves.reduce((s, l) => s + (l.bounds[2] - l.bounds[0]) * (l.bounds[3] - l.bounds[1]), 0);
  assert.ok(Math.abs(total - width * height) < 1e-6, "the leaves tile the footprint");
  for (const direction of ["columns", "rows"] as const) {
    const rects = rectsFor(raster, table({ count: 13 }), { cells, direction, width, height }, 17);
    const painted = kept.reduce((s, l) => s + (l.bounds[2] - l.bounds[0]) * (l.bounds[3] - l.bounds[1]), 0);
    assert.ok(Math.abs(area(rects) - painted) < 1e-6, `${direction}: painted ${area(rects)} != kept ${painted}`);
    for (const r of rects) assert.ok(kept.some((l) => r.x >= l.bounds[0] - 1e-9 && r.y >= l.bounds[1] - 1e-9 && r.x + r.width <= l.bounds[2] + 1e-9 && r.y + r.height <= l.bounds[3] + 1e-9));
  }
  // Raising keep only adds leaves: every earlier leaf keeps its bounds.
  const more = quiltCells({ ...mask, keep: 0.9 }, seed, width, height);
  for (const cell of cells) assert.ok(more.some((other) => other.every((v, k) => v === cell[k])));
  assert.equal(quiltCells({ ...mask, keep: 0 }, seed, width, height).length, 0);
});

test("fragments keep the unsliced picture in place with ids that never move when others are added", () => {
  const source = { kind: "image" as const, raster: coordinates };
  const options = { seed: 9, count: 3, size: 0.3, time: 0, width: 200, height: 100, detail: 20 };
  const few = slitFragments(source, options), many = slitFragments(source, { ...options, count: 6 });
  assert.deepEqual(few.fragments.map((f) => f.id), ["fragment:00", "fragment:01", "fragment:02"]);
  for (const f of few.fragments) assert.deepEqual(many.fragments.find((g) => g.id === f.id)!.rect, f.rect);
  for (const f of many.fragments) { const [x0, y0, x1, y1] = f.rect; assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1); }
  assert.equal(few, slitFragments(source, options));
  assert.equal(slitFragments(source, { ...options, count: 0 }).fragments.length, 0);
  assert.throws(() => slitFragments(source, { ...options, count: 25 }), /Fragments must be an integer in \[0, 24\]/);
  // Unsliced: a fragment reproduces the source exactly where it sits (cover fit of a square image onto 200 x 100 crops the top and bottom).
  const t = table({ count: 8 });
  const strips = slitStrips(source, t, { ...stripOptions, width: 200, height: 100, detail: 20 });
  const rects = slitRects(t, strips, few, rectOptions({ width: 200, height: 100, color: { mode: "source", levels: 64, threshold: 0.5, palette: paletteDark } }));
  const own = rects.filter((r) => r.fragment === "fragment:00");
  assert.ok(own.length > 3);
  for (const r of own.slice(0, 40)) {
    // Sample the source at this rectangle's centre in raster space (scale 16/200 px per unit under cover: 200 / 16 = 12.5 units per px).
    const px = Math.floor(8 + (r.x + r.width / 2) / 12.5), py = Math.floor(8 + (r.y + r.height / 2) / 12.5);
    const expected = [16 * px, 16 * py].map((v) => Math.round(Math.round((v / 255) * 63) / 63 * 255));
    assert.ok(Math.abs(r.rgb[0] - expected[0]) <= 10 && Math.abs(r.rgb[1] - expected[1]) <= 10, `${r.id}: ${[...r.rgb]} vs ${expected}`);
  }
});

const input = (params: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput => {
  const base = createInstrument("slit-compositions");
  return { ...base, seed, params: { ...base.params, ...params } };
};
const recipeOf = (params: Record<string, number | string | boolean> = {}, seed = 42) => slitComposition(input(params, seed));

function recorder(): { surface: CompositionSurface; ops: string[] } {
  const ops: string[] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" }, { get(target, name) {
    if (name in target) return (target as Record<string | symbol, unknown>)[name];
    return (...args: unknown[]) => { ops.push(`${String(name)}(${args.map((a) => (typeof a === "number" ? Math.round(a * 1e6) / 1e6 : String(a))).join(",")})`); };
  } }) as unknown as CompositionSurface;
  return { surface, ops };
}
const drawn = (params: Record<string, number | string | boolean>, seed = 42): string[] => {
  const { surface, ops } = recorder();
  drawInstrument(surface as unknown as DrawingContext, input(params, seed));
  return ops;
};

test("appearance edits reuse every producer; structural edits replace exactly what depends on them", () => {
  const base = slitScene(recipeOf());
  for (const appearance of [{ color: "ramp" }, { color: "ink" }, { levels: 4 }, { threshold: 0.7 }, { gap: 0.3 }, { centerX: 200 }, { centerY: 260 }, { rotation: 33 }]) {
    const scene = slitScene(recipeOf(appearance));
    assert.equal(scene.table, base.table, JSON.stringify(appearance));
    assert.equal(scene.strips, base.strips, JSON.stringify(appearance));
    assert.equal(scene.fragments, base.fragments, JSON.stringify(appearance));
  }
  const palette = slitScene({ ...recipeOf(), palette: [1, 2, 3] });
  assert.equal(palette.strips, base.strips);
  // Mask keep touches only the clipping cells.
  const quilt = slitScene(recipeOf({ mask: "quilt", maskKeep: 0.5 }));
  assert.equal(quilt.strips, base.strips);
  assert.notEqual(slitScene(recipeOf({ mask: "quilt", maskKeep: 0.8 })).cells, quilt.cells);
  // Structural edits.
  assert.notEqual(slitScene(recipeOf({ slices: 97 })).table, base.table);
  assert.notEqual(slitScene(recipeOf({ order: "reverse" })).table, base.table);
  assert.notEqual(slitScene(recipeOf({ detail: 97 })).strips, base.strips);
  assert.equal(slitScene(recipeOf({ detail: 97 })).table, base.table, "detail resamples, it does not re-map");
  assert.notEqual(slitScene(recipeOf({ width: 400 })).strips, base.strips);
  assert.equal(slitScene(recipeOf({ width: 400 })).table, base.table);
  assert.equal(slitScene(recipeOf({ fragments: 3 })).strips, base.strips);
  assert.notEqual(slitScene(recipeOf({ fragments: 3 })).fragments, base.fragments);
  assert.deepEqual(slitScene(recipeOf({ order: "reverse" })).table.rows.map((r) => r.id).sort(), base.table.rows.map((r) => r.id).sort());
});

test("a hidden control never changes the drawing (in both methods, for every driver combination)", () => {
  const cases: Array<[Record<string, number | string | boolean>, Record<string, number | string | boolean>]> = [
    [{ mode: "space" }, { scene: "orbits", frames: 12, interpolation: "hold", timeCurve: "swing", swings: 3, curvePower: 3, gesture: "loops", gestureChannel: "x", windowStart: 0.4, windowLength: 1.5, end: "loop", slitX: 0.2, slitAngle: 40, slitBend: 0.3, slitLength: 0.5, fragmentMoment: 0.9 }],
    [{ mode: "time" }, { image: "geometry" }],
    [{ order: "sequence" }, { disorder: 0.9, groups: 6 }], [{ order: "shuffle" }, { groups: 7 }], [{ order: "reverse" }, { groups: 5, disorder: 0.7 }],
    [{ offsetMode: "none" }, { offset: 0.4, offsetPeriod: 7 }], [{ offsetMode: "ramp" }, { offsetPeriod: 13 }],
    [{ scaleMode: "none" }, { scale: 0.9, scalePeriod: 5 }], [{ scaleMode: "alternate" }, { scalePeriod: 5 }],
    [{ color: "ink" }, { levels: 3 }], [{ color: "source" }, { threshold: 0.9 }], [{ color: "ramp" }, { threshold: 0.9 }],
    [{ mask: "none" }, { maskGrid: 3, maskCuts: 40, maskKeep: 0.1 }],
    [{ mode: "time", timeCurve: "linear" }, { curvePower: 3, swings: 3, gesture: "wander", gestureChannel: "y" }],
    [{ mode: "time", timeCurve: "power" }, { swings: 3, gesture: "wander" }], [{ mode: "time", timeCurve: "swing" }, { curvePower: 4, gestureChannel: "x" }],
  ];
  for (const [driver, hidden] of cases) {
    const visible = new Set(visibleParameters("slit-compositions", input(driver).params).map((p) => p.key));
    for (const key of Object.keys(hidden)) assert.equal(visible.has(key), false, `${key} should be hidden under ${JSON.stringify(driver)}`);
    assert.deepEqual(drawn({ ...driver, ...hidden }), drawn(driver), `${JSON.stringify(driver)} + ${JSON.stringify(hidden)}`);
  }
});

test("draws only inside its footprint on a transparent layer, in one translate/rotate frame", () => {
  const { surface, ops } = recorder();
  drawSlit(surface, recipeOf({ rotation: 30, centerX: 300, centerY: 200, width: 320, height: 200, gap: 0.2 }));
  assert.equal(ops[0], "push()");
  assert.equal(ops[1], "translate(300,200)");
  assert.ok(ops[2].startsWith("rotate(0.52359"));
  assert.equal(ops.filter((op) => op.startsWith("background") || op.startsWith("clear")).length, 0);
  const local = ops.filter((op) => op.startsWith("rect(")).map((op) => op.slice(5, -1).split(",").map(Number));
  assert.ok(local.length > 100);
  for (const [x, y, w, h] of local) assert.ok(x >= -160.3 - 1e-9 && y >= -100.3 - 1e-9 && x + w <= 160.3 + 1e-9 && y + h <= 100.3 + 1e-9);
  const expected = slitBands(recipeOf({ rotation: 30, centerX: 300, centerY: 200, width: 320, height: 200, gap: 0.2 }));
  assert.equal(local.length, expected.length);
  const unrotated = recorder();
  drawSlit(unrotated.surface, recipeOf({ rotation: 0 }));
  assert.equal(unrotated.ops.some((op) => op.startsWith("rotate")), false);
});

test("a band consumer replaces the default fill and receives every rectangle once", () => {
  const recipe = recipeOf({ gap: 0.1 });
  const seen: SlitRect[] = [], { surface, ops } = recorder();
  drawSlit(surface, recipe, { band: (s, rect) => { seen.push(rect); s.circle(rect.x, rect.y, 2); } });
  assert.deepEqual(seen, slitBands(recipe));
  assert.equal(ops.filter((op) => op.startsWith("rect(")).length, 0);
  assert.equal(ops.filter((op) => op.startsWith("circle(")).length, seen.length);
});

test("the recipe is JSON and redraws identically; sources may be caller-resolved typed values", () => {
  const recipe = recipeOf({ mode: "time", scene: "windmill", frames: 10, mask: "quilt" });
  const reloaded = JSON.parse(JSON.stringify(recipe));
  const render = (r: typeof recipe) => { const { surface, ops } = recorder(); drawSlit(surface, r); return ops; };
  assert.deepEqual(render(reloaded), render(recipe));
  const stack = bundledFrameStack("windmill", 42, 10);
  assert.deepEqual(render({ ...recipe, source: { kind: "stack", stack } }), render(recipe));
  const own = { ...recipeOf(), source: { kind: "raster" as const, raster: coordinates } };
  assert.ok(render(own).length > 10);
});

test("failures name the control to change and never draw a fallback picture", () => {
  const throwsDraw = (params: Record<string, number | string | boolean>, pattern: RegExp) => assert.throws(() => drawn(params), pattern);
  throwsDraw({ mode: "time", windowLength: 2, end: "fail" }, /outside the frame sequence.*Window start, Window length or Time curve/);
  throwsDraw({ slices: 600, repeats: 3 }, /make 1800 bands; the limit is 1200. Lower Slices or Repeats/);
  throwsDraw({ fragments: 12, fragmentSize: 0.5, detail: 400, width: 8192, height: 8192 }, /Fragments need \d+ cells.*Lower Fragments, Fragment size or Detail/);
  const noisy = { ...recipeOf({ slices: 600, repeats: 2, detail: 400, gap: 0.5, levels: 64 }), source: { kind: "image" as const, id: "noise" as const } };
  assert.throws(() => drawSlit(recorder().surface, noisy), /more than 120000 rectangles; lower Detail, Slices or Tone steps/);
  assert.throws(() => drawInstrument(recorder().surface as unknown as DrawingContext, { ...input(), params: { ...input().params, slices: 0 } }), /slices must be between 1 and 600/);
  assert.equal(definition("slit-compositions").parameters.find((p) => p.key === "slices")!.max, 160, "slider interval stays inside the hard limit");
});

test("cooperative preparation warms every producer and honours cancellation", async () => {
  const params = { mode: "time", scene: "sunrise", frames: 20 };
  assert.equal(await prepareInstrument(input(params), () => true), false);
  let calls = 0;
  assert.equal(await prepareInstrument(input(params, 77), () => ++calls > 2), false);
  assert.equal(await prepareInstrument(input(params), () => false), true);
  const first = slitScene(recipeOf(params));
  assert.equal(slitScene(recipeOf(params)).strips, first.strips);
});

test("different seeds re-deal the chance in structure: order, offsets, fragments and the source itself", () => {
  const a = slitScene(recipeOf({ order: "shuffle", disorder: 0.5, offsetMode: "random", offset: 0.2 }, 1)), b = slitScene(recipeOf({ order: "shuffle", disorder: 0.5, offsetMode: "random", offset: 0.2 }, 2));
  assert.notDeepEqual(a.table.rows.map((r) => r.source), b.table.rows.map((r) => r.source));
  assert.notDeepEqual(a.table.rows.map((r) => r.offset), b.table.rows.map((r) => r.offset));
  assert.notDeepEqual(a.fragments.fragments.map((f) => f.rect), b.fragments.fragments.map((f) => f.rect));
  assert.notEqual(a.strips, b.strips);
  const w1 = slitScene(recipeOf({ mode: "time", timeCurve: "gesture", gesture: "wander" }, 1)), w2 = slitScene(recipeOf({ mode: "time", timeCurve: "gesture", gesture: "wander" }, 2));
  assert.notDeepEqual(w1.table.rows.map((r) => r.time!.time), w2.table.rows.map((r) => r.time!.time));
});
