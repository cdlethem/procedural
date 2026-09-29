import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PAINT_MARKS, PAINT_FAMILIES, bundledRaster, canPrepareInstrument, convertRaster, createCompositionRun, createInstrument, createRaster,
  drawPainterly, keepsMark, linearToSrgb, paintCandidateCount, paintDrawWork, paintLayerGeometry, paintLayerMaterial, paintPalette, paintPlan,
  painterlyComposition, painterlyPlan, prepareInstrument, usesSeed, validateParameters, visibleParameters,
  type CompositionSurface, type PaintMark, type PaintPlanOptions, type PainterlyComposition, type Raster,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance: number, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  weights: number[] = []; circles: number[][] = []; shapes = 0; lines: number[][] = [];
  push() {} pop() {} translate() {} rotate() {} scale() {}
  noFill() {} noStroke() {} fill() {} stroke() {} strokeCap() {}
  strokeWeight(w: number) { this.weights.push(w); }
  circle(...a: number[]) { this.circles.push(a); }
  line(...a: number[]) { this.lines.push(a); }
  rect() {} beginShape() {} vertex() {}
  endShape() { this.shapes++; }
}

/** A `size` x `size` opaque 8-bit sRGB raster whose pixel (x, y) is `color(x, y)`. */
function image(size: number, color: (x: number, y: number) => readonly number[], extra: { alpha?: (x: number, y: number) => number } = {}): Raster {
  const channels = extra.alpha ? 4 : 3, data = new Uint8Array(size * size * channels);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = color(x, y);
    for (let k = 0; k < 3; k++) data[(y * size + x) * channels + k] = c[k];
    if (extra.alpha) data[(y * size + x) * channels + 3] = extra.alpha(x, y);
  }
  return createRaster({ width: size, height: size, channels: channels as 3 | 4, format: "u8", colorSpace: "srgb", alpha: extra.alpha ? "straight" : "none", data });
}

// 40 px raster on a 200-unit frame: 5 canvas units per pixel; frame spans x, y in [0, 200).
const frame = { centerX: 100, centerY: 100, width: 200, height: 200 };
const opts = (source: Raster, over: Partial<PaintPlanOptions> = {}): PaintPlanOptions => ({
  seed: 5, source, frame, layers: 3, brush: 40, ratio: 2, coverage: 3, family: "dot", threshold: 0, jitter: 0, coherence: 0, baseAngle: 0,
  smoothing: 1, scatter: 0, paper: 1, subject: null, ...over });
const flat = image(40, () => [200, 80, 40]);
const halves = image(40, (x) => (x < 20 ? [255, 0, 0] : [0, 0, 255]));
const inLayer = (marks: readonly PaintMark[], layer: number) => marks.filter((mark) => mark.layer === layer);
const xOf = (mark: PaintMark) => mark.site.position[0];
const yOf = (mark: PaintMark) => mark.site.position[1];

test("a flat picture is covered by layer 0 alone: exact grid count, exact colour, nothing repainted at threshold 0", () => {
  const plan = paintPlan(opts(flat));
  // spacing = brush * sqrt(aspect / coverage) = 40 / sqrt(3); centres (i + 1/2) * spacing < 200 for i <= 8
  const spacing = 40 * Math.sqrt(1 / 3), cells = Math.ceil(200 / spacing);
  assert.equal(cells, 9);
  assert.deepEqual(plan.layers.map((layer) => layer.count), [cells * cells, 0, 0]);
  // Candidates are the cells whose centre (i + 1/2) * spacing lies inside the 200-unit frame.
  assert.deepEqual(plan.layers.map((layer) => layer.candidates),
    [40, 20, 10].map((brush) => Math.ceil(200 / (brush / Math.sqrt(3)) - 0.5) ** 2));
  for (const mark of plan.marks) {
    assert.equal(mark.color >>> 16, 200, "red");
    near((mark.color >>> 8) & 255, 80, 1, "green"); near(mark.color & 255, 40, 1, "blue");
  }
  // Jitter 0: every centre is exactly the cell centre.
  const first = plan.marks.find((mark) => mark.id === "L0:3:2")!;
  near(xOf(first), 3.5 * spacing, 1e-9); near(yOf(first), 2.5 * spacing, 1e-9);
});

test("the error test is strictly greater: an unpainted pixel has error exactly 1, so threshold 1 paints nothing", () => {
  assert.equal(paintPlan(opts(flat, { threshold: 1 })).marks.length, 0);
  assert.ok(paintPlan(opts(flat, { threshold: 0.999 })).marks.length > 0);
});

test("finer layers appear only near the edge that the coarse marks cannot follow", () => {
  const plan = paintPlan(opts(halves, { layers: 2, threshold: 0.02 }));
  const fine = inLayer(plan.marks, 1), coarse = inLayer(plan.marks, 0);
  const s1 = 20 * Math.sqrt(1 / 3);
  assert.ok(fine.length > 0);
  // A pixel further than one coarse brush from the edge is covered by marks whose blur windows are pure:
  // its error is zero. Allow two raster pixels (5 units each) for window rounding.
  for (const mark of fine) assert.ok(Math.abs(xOf(mark) - 100) <= 40 + s1 + 10, `${mark.id} at ${xOf(mark)}`);
  assert.ok(fine.some((mark) => Math.abs(xOf(mark) - 100) <= 12));
  assert.ok(fine.length < 0.5 * plan.layers[1].candidates, "far from every candidate");
  assert.equal(coarse.length, plan.layers[0].candidates);
  for (const mark of fine) assert.ok(mark.source.error > 0.02 && mark.source.error <= 1);
});

test("marks average source colour in linear light over the brush window, not in encoded values", () => {
  const bw = image(40, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]));
  const plan = paintPlan(opts(bw, { layers: 1 }));
  // Layer 0: radius round(0.5 * 40 / 5) = 4 pixels; window [i - 4, i + 4] clipped to the image.
  const checked = plan.marks.filter((mark) => { const i = Math.floor(xOf(mark) / 5); return i >= 16 && i <= 23; });
  assert.ok(checked.length >= 2);
  for (const mark of checked) {
    const i = Math.floor(xOf(mark) / 5);
    let white = 0, count = 0;
    for (let x = Math.max(0, i - 4); x <= Math.min(39, i + 4); x++) { count++; if (x >= 20) white++; }
    const expected = Math.round(255 * linearToSrgb(white / count));
    for (const c of [mark.color >>> 16, (mark.color >>> 8) & 255, mark.color & 255]) near(c, expected, 1, `${mark.id} window ${white}/${count}`);
  }
});

test("direction: strokes follow the level lines; coherence and base angle blend as half-turns", () => {
  const rampX = image(40, (x) => [x * 6, x * 6, x * 6]);      // varies along x: level lines are vertical
  const rampY = image(40, (_, y) => [y * 6, y * 6, y * 6]);   // varies along y: level lines are horizontal
  const angles = (source: Raster, over: Partial<PaintPlanOptions>) =>
    paintPlan(opts(source, { family: "stroke", layers: 1, brush: 30, coverage: 1, ...over })).marks.map((mark) => mark.site.angle);
  for (const a of angles(rampX, { coherence: 1, baseAngle: 33 })) near(a, Math.PI / 2, 1e-6);
  for (const a of angles(rampY, { coherence: 1, baseAngle: 33 })) near(Math.min(a, Math.PI - a), 0, 1e-6);
  for (const a of angles(rampX, { coherence: 0, baseAngle: 33 })) near(a, 33 * Math.PI / 180, 1e-9);
  // Halfway between vertical (90 deg) and 30 deg is 60 deg; halfway between horizontal and 170 deg is 175 deg, not 85.
  for (const a of angles(rampX, { coherence: 0.5, baseAngle: 30 })) near(a, Math.PI / 3, 1e-6);
  for (const a of angles(rampY, { coherence: 0.5, baseAngle: 170 })) near(a, 175 * Math.PI / 180, 1e-6);
  // The path runs along that direction and is centred on the site.
  const mark = paintPlan(opts(rampX, { family: "stroke", layers: 1, brush: 30, coverage: 1, coherence: 1 })).marks.find((m) => m.path.points.length === 5)!;
  const xs = mark.path.points.map((p) => p[0]);
  for (const x of xs) near(x, xs[0], 1e-6);
  near(mark.path.points[2][1], yOf(mark), 1e-9);
  // Edge of two flat halves: strong structure only at the edge, where strokes turn vertical.
  const edge = paintPlan(opts(halves, { family: "stroke", layers: 1, brush: 20, coverage: 1, coherence: 1, baseAngle: 0, smoothing: 1 })).marks;
  const atEdge = edge.filter((m) => Math.abs(xOf(m) - 100) < 6);
  assert.ok(atEdge.length > 0);
  for (const m of atEdge) near(m.site.angle, Math.PI / 2, 0.05);
  for (const m of edge.filter((m2) => Math.abs(xOf(m2) - 100) > 80)) near(m.site.angle, 0, 1e-9);
});

test("marks stay inside the frame; strokes are no longer than their footprint and are centred on their site", () => {
  const plan = paintPlan(opts(bundledRaster("portrait", 3, 96), { family: "ribbon", layers: 3, brush: 20, coverage: 1.4, jitter: 1, coherence: 1, scatter: 20, threshold: 0.03 }));
  assert.ok(plan.marks.length > 50);
  for (const mark of plan.marks) {
    let length = 0;
    const pts = mark.path.points;
    for (let i = 0; i < pts.length; i++) {
      assert.ok(pts[i][0] >= 0 && pts[i][0] < 200 && pts[i][1] >= 0 && pts[i][1] < 200, `${mark.id} vertex ${i}`);
      if (i) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    assert.ok(length <= mark.length - mark.width + 1e-9 || length <= 0.25 * mark.width + 1e-9, `${mark.id} ${length}`);
    assert.deepEqual(mark.site.position, [xOf(mark), yOf(mark)]);
    assert.ok(pts.some((p) => p[0] === xOf(mark) && p[1] === yOf(mark)));
    assert.equal(mark.site.tone, 2 * mark.index);
    assert.equal(mark.path.tone, 2 * mark.index);
    assert.equal(mark.path.id, mark.site.id);
  }
  assert.equal(new Set(plan.marks.map((mark) => mark.id)).size, plan.marks.length);
});

test("ids are stable: extra layers, a higher threshold, palette and material never rename or move a surviving mark", () => {
  const source = bundledRaster("portrait", 3, 96);
  const shape = (over: Partial<PaintPlanOptions>) => opts(source, { family: "stroke", layers: 3, brush: 30, coverage: 1.5, jitter: 0.8, coherence: 0.9, scatter: 6, threshold: 0.04, ...over });
  const strip = (m: PaintMark) => JSON.stringify([m.id, m.layer, m.seed, m.site.position, m.site.angle, m.path.points, m.color, m.source]);
  const base = paintPlan(shape({}));
  const deeper = paintPlan(shape({ layers: 4 }));
  assert.deepEqual(base.marks.map(strip), deeper.marks.slice(0, base.marks.length).map(strip), "adding a layer only appends");
  const strict = paintPlan(shape({ threshold: 0.12 }));
  const byId = new Map(base.marks.map((m) => [m.id, m]));
  const layer1 = inLayer(strict.marks, 1);
  assert.ok(layer1.length > 0 && layer1.length < inLayer(base.marks, 1).length);
  for (const m of layer1) { const same = byId.get(m.id); assert.ok(same, `${m.id} exists at the lower threshold`); assert.equal(strip(m), strip(same!)); }
  assert.deepEqual(inLayer(strict.marks, 0).map(strip), inLayer(base.marks, 0).map(strip));
  // A different seed moves marks (jitter and order), keeping the ids of the layer-0 grid.
  const other = paintPlan(shape({ seed: 6 }));
  const shared = inLayer(other.marks, 0).filter((m) => byId.has(m.id));
  assert.ok(shared.length > 0.8 * inLayer(base.marks, 0).length, "only cells at the frame edge can differ");
  assert.ok(shared.some((m) => xOf(m) !== xOf(byId.get(m.id)!)), "jitter is per seed");
});

test("plans are cached by construction, frozen, and unaffected by appearance", () => {
  const source = bundledRaster("geometry", 2, 64);
  const a = paintPlan(opts(source, { threshold: 0.05 }));
  assert.equal(paintPlan(opts(source, { threshold: 0.05 })), a);
  assert.notEqual(paintPlan(opts(source, { threshold: 0.06 })), a);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.marks) && Object.isFrozen(a.marks[0]) && Object.isFrozen(a.marks[0].path.points) &&
    Object.isFrozen(a.marks[0].path.points[0]) && Object.isFrozen(a.layers[0]) && Object.isFrozen(a.options));
  const input = createInstrument("painterly-source");
  const recipe = painterlyComposition({ ...input, params: { ...input.params, layers: 2 } });
  const plan = painterlyPlan(recipe);
  const restyled = painterlyComposition({ ...input, palette: [0x111111, 0xeeeeee], params: { ...input.params, layers: 2, material: "arrow", colorMode: "ramp", retention: 0.5, fill: 0.5, saturation: 0.3, colors: 3, lineWeight: 2 } });
  assert.equal(painterlyPlan(restyled), plan);
});

test("negative space: paper level, alpha and the subject window decide which marks can exist", () => {
  const halfBlack = image(40, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]));
  const everywhere = paintPlan(opts(halfBlack));
  assert.ok(everywhere.marks.some((m) => xOf(m) >= 100));
  const bare = paintPlan(opts(halfBlack, { paper: 0.5 }));
  assert.ok(bare.marks.length > 0);
  for (const m of bare.marks) assert.ok(xOf(m) < 100, `${m.id} at ${xOf(m)} is on white paper`);
  const clear = image(40, () => [10, 200, 30], { alpha: (x) => (x < 20 ? 255 : 0) });
  const seen = paintPlan(opts(clear));
  assert.ok(seen.marks.length > 0);
  for (const m of seen.marks) assert.ok(xOf(m) < 100, `${m.id} on transparent pixels`);
  const window = { centerX: 0.5, centerY: 0.5, width: 0.5, height: 0.5, feather: 0 };
  const inWindow = paintPlan(opts(flat, { subject: window }));
  assert.ok(inWindow.marks.length > 0 && inWindow.marks.length < paintPlan(opts(flat)).marks.length);
  for (const m of inWindow.marks) assert.ok(Math.hypot((xOf(m) - 100) / 50, (yOf(m) - 100) / 50) < 1.08, m.id);
  const feathered = paintPlan(opts(flat, { subject: { ...window, feather: 0.6 } }));
  const kept = new Set(inWindow.marks.filter((m) => m.layer === 0).map((m) => m.id));
  const soft = inLayer(feathered.marks, 0);
  assert.ok(soft.length > 0 && soft.length < kept.size);
  for (const m of soft) assert.ok(kept.has(m.id));
});

test("representation does not matter: linear f32 premultiplied gives the same marks as sRGB bytes", () => {
  const source = image(40, (x, y) => [x * 6, 255 - y * 6, (x * y) % 256], { alpha: (x) => 255 - (x % 7) * 20 });
  const converted = convertRaster(source, { colorSpace: "linear", alpha: "premultiplied", format: "f32" });
  const a = paintPlan(opts(source, { layers: 1 })), b = paintPlan(opts(converted, { layers: 1 }));
  assert.deepEqual(a.marks.map((m) => m.id), b.marks.map((m) => m.id));
  for (let i = 0; i < a.marks.length; i++) for (const shift of [16, 8, 0]) near((a.marks[i].color >>> shift) & 255, (b.marks[i].color >>> shift) & 255, 2, a.marks[i].id);
});

test("bounds throw and name the control to change; nothing is truncated", () => {
  const source = bundledRaster("noise", 1, 32);
  assert.throws(() => paintPlan(opts(source, { layers: 8, brush: 1, ratio: 3 })), /finest layer's brush.*Lower layers or ratio, or raise brush/);
  assert.throws(() => paintPlan(opts(source, { brush: 1, coverage: 6, layers: 2 })), /candidate marks; the limit is 240000\. Lower layers, raise brush or ratio, lower coverage or shrink size/);
  assert.throws(() => paintPlan(opts(source, { frame: { centerX: 150, centerY: 150, width: 300, height: 300 }, brush: 2, coverage: 4, layers: 1 })),
    new RegExp(`the limit is ${MAX_PAINT_MARKS}\\. Raise threshold, brush or ratio, lower layers or coverage`));
  assert.throws(() => paintPlan(opts(source, { threshold: 2 })), /threshold/);
  assert.throws(() => paintPlan(opts(source, { layers: 2.5 })), /layers/);
  assert.equal(paintCandidateCount({ layers: 2, brush: 40, ratio: 2, coverage: 3, family: "dot", width: 200, height: 200 }), 81 + Math.ceil(200 / (20 / Math.sqrt(3))) ** 2);
});

const recipeOf = (params: Record<string, number | string | boolean> = {}, seed = 42, palette?: number[]): PainterlyComposition => {
  const input = createInstrument("painterly-source");
  return painterlyComposition({ ...input, seed, palette: palette ?? input.palette, params: { ...input.params, ...params } });
};

test("materials draw the plan at analytic sizes; switching material keeps the plan and the retained marks", () => {
  const recipe = recipeOf({ layers: 3, brush: 24, family: "stroke", fill: 0.5 });
  const plan = painterlyPlan(recipe);
  const ink = new Recorder();
  drawPainterly(ink, recipe);
  assert.equal(ink.shapes, plan.marks.length);
  const expected = plan.layers.filter((l) => l.count > 0).map((l) => 24 * 1.8 ** -l.index * 0.5);
  assert.deepEqual([...new Set(ink.weights)].sort((a, b) => a - b).map((w) => Number(w.toFixed(9))), expected.map((w) => Number(w.toFixed(9))).sort((a, b) => a - b));

  const dots = new Recorder(), dotRecipe = { ...recipe, material: { ...recipe.material, kind: "dot" as const } };
  drawPainterly(dots, dotRecipe);
  assert.equal(painterlyPlan(dotRecipe), plan);
  assert.equal(dots.circles.length, plan.marks.length);
  const round = 2 / Math.sqrt(Math.PI) * Math.sqrt(PAINT_FAMILIES.stroke.aspect);
  const sizes = new Set(dots.circles.map((c) => Number(c[2].toFixed(6))));
  for (const l of plan.layers) if (l.count) assert.ok(sizes.has(Number((round * l.brush * 0.5).toFixed(6))), `layer ${l.index}`);

  // Retention omits the same marks whatever the material.
  const half = { ...recipe, retention: 0.5 };
  const a = new Recorder(), b = new Recorder();
  drawPainterly(a, half); drawPainterly(b, { ...half, material: { ...half.material, kind: "arrow" as const } });
  const kept = plan.marks.filter((m) => keepsMark(m, 0.5)).length;
  assert.equal(a.shapes, kept); assert.equal(b.lines.length, 4 * kept);
  assert.ok(kept > 0.3 * plan.marks.length && kept < 0.7 * plan.marks.length);
  assert.ok(plan.marks.filter((m) => keepsMark(m, 0.3)).every((m) => keepsMark(m, 0.6)));
  const none = new Recorder();
  drawPainterly(none, { ...recipe, retention: 0 });
  assert.equal(none.shapes + none.circles.length, 0);
});

test("the work estimate is exact for every material and an over-budget drawing fails before any mark is drawn", () => {
  for (const kind of ["ink", "stitch", "beads", "dot", "rings", "arrow"] as const) {
    const recipe = recipeOf({ layers: 3, brush: 20, family: "ribbon", material: kind, retention: 0.8 });
    const plan = painterlyPlan(recipe), run = createCompositionRun({ maxWork: 5_000_000 });
    drawPainterly(new Recorder(), recipe, {}, run);
    assert.equal(run.workUsed, paintDrawWork(plan, recipe), kind);
  }
  const heavy = recipeOf({ layers: 3, brush: 20, family: "ribbon", material: "stitch" });
  const surface = new Recorder();
  assert.throws(() => drawPainterly(surface, heavy, {}, createCompositionRun({ maxWork: 50 })), /budget exceeded/);
  // 38,813 ribbons drawn as beads need 1,035,041 units, over the 1,000,000 budget: refused whole, nothing painted.
  const dense = recipeOf({ image: "noise", centerX: 450, centerY: 450, size: 900, brush: 5.6, ratio: 1.35, layers: 3, coverage: 2.2, family: "ribbon", threshold: 0, material: "beads" });
  const untouched = new Recorder();
  assert.throws(() => drawPainterly(untouched, dense), /needs 1035041 callback units for 38813 marks; the budget is 1000000\. Choose a simpler material/);
  assert.equal(untouched.circles.length + untouched.shapes, 0);
  assert.throws(() => drawPainterly(surface, recipeOf({ brush: 60, fill: 1.5 })), /unit lines; the limit is 50\. Lower brush or fill/);
  assert.throws(() => validateParameters("painterly-source", { ...createInstrument("painterly-source").params, brush: 60, fill: 1.5 }), /Lower brush or fill/);
});

test("color mapping: median cut, nearest palette, lightness ramp, saturation and interleaved shades", () => {
  const mark = (color: number, lightness = 0): PaintMark => ({ color, source: { lightness, coherence: 0, structure: 0, error: 1 } }) as PaintMark;
  const marks = [mark(0xff0000), mark(0xfe0101), mark(0x0000ff), mark(0x0101fe)];
  const reduced = paintPalette({ marks }, { mode: "reduced", colors: 2, saturation: 1 }, [0x000000]);
  assert.equal(reduced.length, 8);
  assert.equal(reduced[0], reduced[2]); assert.equal(reduced[4], reduced[6]); assert.notEqual(reduced[0], reduced[4]);
  near(reduced[0] >>> 16, 254.5, 1); near(reduced[4] & 255, 254.5, 1);
  const table = [0x102030, 0xf0e0d0];
  const nearest = paintPalette({ marks: [mark(0x203040), mark(0xe0d0c0)] }, { mode: "palette", colors: 1, saturation: 1 }, table);
  assert.deepEqual([nearest[0], nearest[2]], [0x102030, 0xf0e0d0]);
  const ramp = paintPalette({ marks: [mark(0, 0), mark(0, 0.5), mark(0, 0.99), mark(0, 1)] }, { mode: "ramp", colors: 1, saturation: 1 }, [0xffffff, 0x000000, 0x808080]);
  assert.deepEqual([ramp[0], ramp[2], ramp[4], ramp[6]], [0x000000, 0x808080, 0xffffff, 0xffffff]);
  // Second entry of each pair is a 0.62 shade of its own colour: 200, 80, 40 -> 124, 50, 25.
  assert.equal(paintPalette({ marks: [mark(0xc85028)] }, { mode: "source", colors: 1, saturation: 1 }, [0])[1], (124 << 16) | (50 << 8) | 25);
  // Zero saturation is the colour's own luma.
  const gray = paintPalette({ marks: [mark(0xff0000)] }, { mode: "source", colors: 1, saturation: 0 }, [0])[0];
  const y = Math.round(0.2126 * 255);
  assert.equal(gray, (y << 16) | (y << 8) | y);
  assert.deepEqual(paintPalette({ marks: [] }, { mode: "source", colors: 1, saturation: 1 }, [0]), []);
});

test("layer geometry follows the stated formulas", () => {
  const g = paintLayerGeometry(30, 2, 1.5, "stroke", 2);
  near(g.brush, 7.5, 1e-12); near(g.length, 7.5 * 3.6, 1e-12); near(g.spacing, 7.5 * Math.sqrt(3.6 / 1.5), 1e-12);
  const built = paintLayerMaterial({ brush: 10, length: 36 }, "stroke", { kind: "arrow", fill: 0.5, lineWeight: 1, petals: 6 });
  assert.ok("mark" in built && built.mark.size === 18, "an arrow is as long as the footprint times fill");
});

test("instrument: conditional controls, seed, preparation and control-naming failures", async () => {
  const input = createInstrument("painterly-source");
  assert.equal(usesSeed(input), true);
  const visible = (params: Record<string, number | string | boolean>) => visibleParameters("painterly-source", { ...input.params, ...params }).map((p) => p.key);
  assert.ok(!visible({}).includes("subjectX") && visible({ subject: "window" }).includes("subjectX"));
  assert.ok(visible({ colorMode: "reduced" }).includes("colors") && !visible({ colorMode: "ramp" }).includes("colors"));
  assert.ok(visible({ material: "rosette" }).includes("petals") && !visible({ material: "ink" }).includes("petals"));
  assert.equal(canPrepareInstrument("painterly-source"), true);
  assert.equal(await prepareInstrument(input, () => false), true);
  assert.equal(await prepareInstrument({ ...input, params: { ...input.params, threshold: 0.011 } }, () => true), false);
  let calls = 0;
  assert.equal(await prepareInstrument({ ...input, params: { ...input.params, threshold: 0.012 } }, () => ++calls > 2), false);
  assert.throws(() => validateParameters("painterly-source", { ...input.params, layers: 6, brush: 1, ratio: 3 }), /finest layer's brush/);
  assert.throws(() => validateParameters("painterly-source", { ...input.params, image: "sketch" }), /not an available option/);
  assert.deepEqual(JSON.parse(JSON.stringify(painterlyComposition(input))), painterlyComposition(input));
  assert.throws(() => painterlyComposition(createInstrument("motif-ecologies")), /Not a painterly-source input/);
});
