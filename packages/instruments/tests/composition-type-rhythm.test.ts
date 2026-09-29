import assert from "node:assert/strict";
import test from "node:test";
import {
  CAP_HEIGHT, bundledTextSources, createCompositionRun, createInstrument, drawInstrument, keyholeRings, moduleFrame, moduleLined, moduleOutline,
  moduleScreen, moduleType, referenceComposition, screenFrame, textSource, typeAnchor, typeContent, typeField, typeRhythmLayout, usesSeed,
  validateInstrument, drawTypeRhythm, prepareTypeRhythm,
  type CompositionSurface, type Point, type Ring, type TypeFieldOptions, type TypeLayout, type TypeLayoutOptions, type TypeModule, type TypeRhythmComposition,
} from "../dist/index.js";
import { textOutlines } from "../dist/adapters/image-signal-instruments.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

/** A plain, fully neutral grid; each test overrides what it studies. */
const layoutOf = (over: Partial<TypeLayoutOptions> = {}): TypeLayoutOptions => ({
  seed: 7, centerX: 200, centerY: 150, width: 400, height: 300, anchorSide: "bottom", anchorHeight: 60, slicing: "grid", columns: 4, rows: 3,
  cuts: 0, axis: "LONGEST", bias: 0, gutter: 0, correlation: 2, displacement: 0, stretch: 0, zoom: 0, focalX: 200, focalY: 150, focalRadius: 0,
  pinned: 0, blank: 0, turned: 0, screens: 0, flats: 0, screenAngles: "aligned", ...over,
});
/** size = the font's cap height, so one font unit is exactly one canvas unit. */
const fieldOf = (over: Partial<TypeFieldOptions> = {}): TypeFieldOptions => ({ size: CAP_HEIGHT, leading: 1.25, gap: .5, rowsPerLine: 1, phase: .25, ...over });
const words = textSource({ id: "test", lines: ["HI", "OX"], anchor: "HI OX" });

// --- Independent references (raw font outlines, never the library's own line values) -----------------
const rawRings = (text: string): number[][][] => textOutlines(text).filter((ring) => ring.length >= 3);
function rawBounds(text: string) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const ring of rawRings(text)) for (const [x, y] of ring) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  return { left, right, top, bottom };
}
const rawArea = (ring: readonly (readonly number[])[]) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return sum / 2;
};
/** Nonzero winding number of a set of rings about (x, y), by signed crossings. */
function winding(rings: readonly (readonly (readonly number[])[])[], x: number, y: number): number {
  let count = 0;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    const left = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
    if (ay <= y) { if (by > y && left > 0) count++; } else if (by <= y && left < 0) count--;
  }
  return count;
}
const mod = (a: number, n: number) => ((a % n) + n) % n;
const key = (ring: readonly (readonly number[])[]) => ring.map(([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`).join(";");

/** Canvas points of every glyph ring of instance (row, repeat) of a neutral field, computed from the raw font. */
function expectedRings(text: typeof words, options: TypeFieldOptions, area: TypeLayout["area"], row: number, repeat: number, clip: readonly number[]) {
  const line = text.lines[mod(row, text.lines.length * options.rowsPerLine) / options.rowsPerLine | 0], bounds = rawBounds(line);
  const s = options.size / CAP_HEIGHT, pitch = options.leading * options.size;
  const period = (bounds.right - bounds.left) * s + options.gap * options.size;
  const left = area[0] + repeat * period + row * options.phase * period, baseline = area[1] + row * pitch + (pitch + options.size) / 2;
  return rawRings(line).map((ring) => ring.map(([x, y]): Point => [left + (x - bounds.left) * s - clip[0], baseline + y * s - clip[1]]));
}
const overlaps = (ring: readonly (readonly number[])[], w: number, h: number) => {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return !(Math.max(...xs) < 0 || Math.min(...xs) > w || Math.max(...ys) < 0 || Math.min(...ys) > h);
};
const deepFrozen = (value: unknown): boolean =>
  value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value as object).every(deepFrozen));
const rectArea = (b: readonly number[]) => (b[2] - b[0]) * (b[3] - b[1]);
const overlapArea = (a: readonly number[], b: readonly number[]) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

test("text sources admit only outlined printable ASCII lines and freeze what they accept", () => {
  assert.throws(() => textSource({ id: "x", lines: ["A".repeat(21)], anchor: "A" }), /Text line 1 must be 1–20/);
  assert.throws(() => textSource({ id: "x", lines: ["ok", "café"], anchor: "A" }), /Text line 2/);
  assert.throws(() => textSource({ id: "x", lines: ["   "], anchor: "A" }), /not blank/);
  assert.throws(() => textSource({ id: "x", lines: [], anchor: "A" }), /1–8 lines/);
  assert.throws(() => textSource({ id: "x", lines: Array(9).fill("A"), anchor: "A" }), /1–8 lines/);
  assert.throws(() => textSource({ id: "x", lines: ["A"], anchor: "" }), /Text anchor/);
  assert.throws(() => textSource({ id: "has space", lines: ["A"], anchor: "A" }), /Text id/);
  assert.ok(deepFrozen(words));
  assert.ok(Object.keys(bundledTextSources).length >= 6);
  for (const source of Object.values(bundledTextSources)) assert.ok(deepFrozen(source) && source.lines.every((line) => line.length <= 20) && source.anchor.length <= 20);
});

test("modules tile the module area exactly; the anchor strip is disjoint and completes the composition", () => {
  const cases: Partial<TypeLayoutOptions>[] = [
    {}, { anchorSide: "top" }, { anchorSide: "none", columns: 7, rows: 5 },
    { slicing: "partition", columns: 8, rows: 8, cuts: 30 }, { slicing: "partition", columns: 12, rows: 6, cuts: 80, axis: "RANDOM", bias: .6, seed: 99 },
    { slicing: "partition", columns: 5, rows: 5, cuts: 10, anchorSide: "top", anchorHeight: 90 },
  ];
  for (const over of cases) {
    const layout = typeRhythmLayout(layoutOf(over));
    const bounds = layout.modules.map((module) => module.bounds);
    near(bounds.reduce((sum, b) => sum + rectArea(b), 0), rectArea(layout.area), 1e-6);
    for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) near(overlapArea(bounds[i], bounds[j]), 0, 1e-6);
    for (const b of bounds) assert.ok(b[0] >= layout.area[0] - 1e-9 && b[1] >= layout.area[1] - 1e-9 && b[2] <= layout.area[2] + 1e-9 && b[3] <= layout.area[3] + 1e-9);
    if (layout.anchor) {
      near(rectArea(layout.anchor) + rectArea(layout.area), rectArea(layout.region), 1e-6);
      for (const b of bounds) near(overlapArea(b, layout.anchor), 0, 1e-6);
    } else assert.deepEqual([...layout.area], [...layout.region]);
  }
  assert.equal(typeRhythmLayout(layoutOf({ anchorSide: "none", anchorHeight: 250 })), typeRhythmLayout(layoutOf({ anchorSide: "none", anchorHeight: 10 })),
    "an anchor height with no anchor is not a construction input");
  assert.throws(() => typeRhythmLayout(layoutOf({ anchorHeight: 290 })), /at least 16 units of height/);
});

test("gutter insets each clip by half on every side; a module too small for it is published blank", () => {
  const layout = typeRhythmLayout(layoutOf({ gutter: 10 }));
  for (const module of layout.modules) {
    const [l, t, r, b] = module.bounds;
    assert.deepEqual([...module.clip.bounds], [l + 5, t + 5, r - 5, b - 5]);
    assert.equal(module.clip.id, module.id);
  }
  const tight = typeRhythmLayout(layoutOf({ columns: 16, rows: 3, gutter: 26 }));
  assert.ok(tight.modules.every((module) => module.kind === "blank" && rectArea(module.clip.bounds) === rectArea(module.bounds)));
  const grid = typeRhythmLayout(layoutOf());
  assert.deepEqual(grid.modules.map((module) => module.id).slice(0, 5), ["lat:0:0", "lat:1:0", "lat:2:0", "lat:3:0", "lat:0:1"]);
});

test("a neutral module shows exactly the piece of the poster under it, culled by the clip rectangle and by nothing else", () => {
  const options = fieldOf(), layout = typeRhythmLayout(layoutOf({ gutter: 6 })), field = typeField(words, options);
  let checked = 0, published = 0;
  for (const module of layout.modules) {
    const clip = module.clip.bounds, w = clip[2] - clip[0], h = clip[3] - clip[1];
    const type = moduleType(layout, field, module);
    // Enumerate a superset of instances independently of the library's row and repeat ranges.
    const want = new Map<string, number>();
    for (let row = -3; row <= 12; row++) for (let repeat = -8; repeat <= 8; repeat++)
      for (const ring of expectedRings(words, options, layout.area, row, repeat, clip)) if (overlaps(ring, w, h)) want.set(key(ring), (want.get(key(ring)) ?? 0) + 1);
    const got = new Map<string, number>();
    for (const ring of type.rings) got.set(key(ring), (got.get(key(ring)) ?? 0) + 1);
    assert.deepEqual([...got].sort(), [...want].sort(), `module ${module.id}`);
    for (const instance of type.instances) assert.equal(instance.line, mod(instance.row, 2));
    checked += want.size; published += type.rings.length;
  }
  assert.ok(checked > 20 && published === checked);
});

test("the transform is displace, stretch, quarter turn about the module centre, then clip (order matters)", () => {
  const bounds = [100, 100, 220, 190] as const, clip = [104, 104, 216, 186] as const;
  const module: TypeModule = Object.freeze({ id: "probe", seed: 1, bounds, clip: Object.freeze({ id: "probe", seed: 1, bounds: clip }), kind: "text", tone: 0, pinned: false,
    turn: 1, displacement: Object.freeze([13, -7] as const), stretch: Object.freeze([1.5, .5] as const), screenStep: 0,
    source: Object.freeze({ slicing: "grid", site: "probe", col: 0, row: 0, shift: Object.freeze([0, 0] as const), turnChannel: 0, growChannel: 0 }) });
  const area = [0, 0, 500, 500] as const;
  const options = fieldOf({ phase: 0 }), field = typeField(textSource({ id: "p", lines: ["H"], anchor: "H" }), options);
  const type = moduleType({ area }, field, module);
  const cx = 160, cy = 145, [dx, dy] = module.displacement, [sx, sy] = module.stretch;
  const bH = rawBounds("H"), period = (bH.right - bH.left) + .5 * options.size, pitch = options.leading * options.size;
  const map = (row: number, repeat: number, x: number, y: number, order: "stretch-turn" | "turn-stretch"): Point => {
    const qx = repeat * period + (x - bH.left), qy = row * pitch + (pitch + options.size) / 2 + y;
    let ux = qx - cx - dx, uy = qy - cy - dy;
    if (order === "stretch-turn") { ux *= sx; uy *= sy; [ux, uy] = [-uy, ux]; }
    else { [ux, uy] = [-uy, ux]; ux *= sx; uy *= sy; }
    return [cx + ux - clip[0], cy + uy - clip[1]];
  };
  const w = clip[2] - clip[0], h = clip[3] - clip[1];
  let matched = 0;
  for (const instance of type.instances) {
    for (const ring of rawRings("H")) {
      const expected = ring.map(([x, y]) => map(instance.row, instance.repeat, x, y, "stretch-turn"));
      const swapped = ring.map(([x, y]) => map(instance.row, instance.repeat, x, y, "turn-stretch"));
      if (!overlaps(expected, w, h)) continue;
      assert.ok(type.rings.some((published) => key(published) === key(expected)), "ring at the documented position");
      assert.notEqual(key(expected), key(swapped), "the two orders differ, so the check discriminates");
      matched++;
    }
  }
  assert.ok(matched >= 2);
  // Clockwise on the canvas: a field point right of the centre lands below it.
  const frame = moduleFrame(module);
  assert.equal(frame.a, 0); assert.equal(frame.b, -sy); assert.equal(frame.c, sx); assert.equal(frame.d, 0);
  near(frame.ia * frame.a + frame.ib * frame.c, 1); near(frame.ia * frame.b + frame.ib * frame.d, 0);
});

test("fills are clipped to the module and keep the glyph area, counters included", () => {
  const bounds = [0, 0, 90, 140] as const;
  const module: TypeModule = Object.freeze({ id: "b", seed: 2, bounds, clip: Object.freeze({ id: "b", seed: 2, bounds }), kind: "text", tone: 0, pinned: false, turn: 0,
    displacement: Object.freeze([0, 0] as const), stretch: Object.freeze([1, 1] as const), screenStep: 0,
    source: Object.freeze({ slicing: "grid", site: "b", col: 0, row: 0, shift: Object.freeze([0, 0] as const), turnChannel: 0, growChannel: 0 }) });
  const field = typeField(textSource({ id: "b", lines: ["B"], anchor: "B" }), fieldOf({ phase: 0, gap: 3 }));
  // Place the window so it cuts through both counters of the B.
  const rings = rawRings("B"), b = rawBounds("B"), pitch = 1.25 * CAP_HEIGHT;
  const originX = -10 - (b.left + 20), originY = 0;
  const layout = { area: [originX, originY, 400, 400] as const };
  const type = moduleType(layout, field, module);
  const baseline = originY + (pitch + CAP_HEIGHT) / 2, left = originX;
  const local = rings.map((ring) => ring.map(([x, y]): Point => [left + (x - b.left), baseline + y]));
  // Independent estimate: dense point sampling with the nonzero rule inside the window.
  let inside = 0;
  const step = .25;
  for (let x = step / 2; x < 90; x += step) for (let y = step / 2; y < 140; y += step) if (winding(local, x, y) !== 0) inside++;
  const estimate = inside * step * step;
  const filled = type.fill.reduce((sum, polygon) => sum + rawArea(polygon), 0);
  assert.ok(estimate > 500 && Math.abs(filled - estimate) < 0.01 * estimate + 3, `${filled} vs ${estimate}`);
  for (const polygon of type.fill) for (const [x, y] of polygon) assert.ok(x >= -1e-9 && x <= 90 + 1e-9 && y >= -1e-9 && y <= 140 + 1e-9, "inside the clip rectangle");
  // A window wholly inside the bar of an "I" fills exactly the rectangle.
  const bar = textSource({ id: "i", lines: ["I"], anchor: "I" }), bi = rawBounds("I");
  const small: TypeModule = { ...module, id: "s", clip: Object.freeze({ id: "s", seed: 2, bounds: [0, 0, 6, 30] as const }), bounds: [0, 0, 6, 30] as const };
  const around = { area: [-(bi.right - bi.left) / 2 + 3 - 0, -20, 400, 400] as const };
  const solid = moduleType(around, typeField(bar, fieldOf({ phase: 0 })), small);
  assert.equal(solid.fill.length, 1);
  near(rawArea(solid.fill[0]), 6 * 30);
});

test("keyholed polygons fill exactly the glyph interior: counters stay open, no cut leaves an area", () => {
  for (const text of ["B8&@", "OPQR", "%e"]) {
    const rings = rawRings(text), polygons = keyholeRings(rings.map((ring) => ring.map(([x, y]): Point => [x, y]) as Ring));
    const bounds = rawBounds(text);
    let compared = 0;
    for (let x = bounds.left; x < bounds.right; x += 2.3) for (let y = bounds.top; y < bounds.bottom; y += 2.3) {
      const expected = winding(rings, x, y) !== 0;
      // Skip points within a hair of an outline, where either answer is defensible.
      let close = Infinity;
      for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[j], [bx, by] = ring[i], dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        close = Math.min(close, Math.hypot(x - ax - t * dx, y - ay - t * dy));
      }
      if (close < .05) continue;
      // Each polygon is painted as its own shape, so a point is inked when any one of them winds around it.
      assert.equal(polygons.some((polygon) => winding([polygon], x, y) !== 0), expected, `${text} at ${x},${y}`);
      compared++;
    }
    assert.ok(compared > 150);
    near(polygons.reduce((sum, polygon) => sum + rawArea(polygon), 0), rings.reduce((sum, ring) => sum + rawArea(ring), 0), 1e-6);
  }
});

test("screens are the field's own grating: same line index and phase across modules, mapped by the module transform", () => {
  const make = (over: Partial<TypeModule>): TypeModule => Object.freeze({ id: "s", seed: 5, bounds: [40, 30, 200, 150] as const,
    clip: Object.freeze({ id: "s", seed: 5, bounds: [40, 30, 200, 150] as const }), kind: "screen", tone: 2, pinned: false, turn: 0,
    displacement: Object.freeze([0, 0] as const), stretch: Object.freeze([1, 1] as const), screenStep: 0,
    source: Object.freeze({ slicing: "grid", site: "s", col: 0, row: 0, shift: Object.freeze([0, 0] as const), turnChannel: 0, growChannel: 0 }), ...over } as TypeModule);
  // Neutral: horizontal lines at world y = k·period, whatever the module's position.
  const neutral = moduleScreen(make({}), { period: 20, angle: 0 });
  assert.deepEqual(neutral.map((path) => path.id), Array.from({ length: 6 }, (_, i) => `s/line:${2 + i}#0`));
  for (const path of neutral) {
    const k = Number(/line:(-?\d+)#/.exec(path.id)![1]);
    for (const [x, y] of path.points) near(y + 30, k * 20);
    near(path.points[0][0], 0); near(path.points[1][0], 160);
  }
  // Stretched, displaced, turned and tilted: every point satisfies n·q = k·period in field coordinates.
  const angle = 33;
  for (const turn of [-1, 0, 1] as const) {
    const module = make({ turn, stretch: [1.7, .6], displacement: [23.5, -11.25], screenStep: 1 });
    const spec = { period: 17, angle }, paths = moduleScreen(module, spec);
    const alpha = (angle + 45) * Math.PI / 180, nx = -Math.sin(alpha), ny = Math.cos(alpha);
    const [cx, cy] = [120, 90], [dx, dy] = module.displacement, [sx, sy] = module.stretch;
    const toField = (px: number, py: number): Point => {
      let ux = px + 40 - cx, uy = py + 30 - cy;             // canvas offset from the centre
      [ux, uy] = turn === 1 ? [uy, -ux] : turn === -1 ? [-uy, ux] : [ux, uy];   // undo the turn
      return [cx + dx + ux / sx, cy + dy + uy / sy];        // undo the stretch, then the displacement
    };
    const indices = new Set<number>();
    for (const path of paths) {
      const k = Number(/line:(-?\d+)#/.exec(path.id)![1]);
      indices.add(k);
      for (const [x, y] of path.points) { const [qx, qy] = toField(x, y); near((nx * qx + ny * qy) / 17, k, 1e-9); }
    }
    const values = [[0, 0], [160, 0], [160, 120], [0, 120]].map(([x, y]) => { const [qx, qy] = toField(x, y); return (nx * qx + ny * qy) / 17; });
    const expected = new Set<number>();
    for (let k = Math.ceil(Math.min(...values)); k <= Math.floor(Math.max(...values)); k++) expected.add(k);
    assert.deepEqual([...indices].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), `turn ${turn}`);
  }
  // The mapped period is stretched; below the minimum it is refused, naming the module.
  near(screenFrame(make({ stretch: [1, 2] }), { period: 20, angle: 0 }).period, 40);
  near(screenFrame(make({ stretch: [2, 1], turn: 1 }), { period: 20, angle: 0 }).period, 20);
  near(screenFrame(make({ stretch: [1, 2], turn: 1 }), { period: 20, angle: 0 }).period, 40);
  near(screenFrame(make({ stretch: [2, 1] }), { period: 20, angle: 90 }).period, 40);
  assert.throws(() => moduleScreen(make({ stretch: [.1, .1] }), { period: 20, angle: 0 }), /module s.*below the 3-unit minimum/);
});

test("module kinds are stable draws: raising one share only converts modules to that kind", () => {
  const kinds = (over: Partial<TypeLayoutOptions>, seed = 3) => typeRhythmLayout(layoutOf({ columns: 12, rows: 10, seed, ...over })).modules.map((module) => module.kind);
  assert.ok(kinds({}).every((kind) => kind === "text"));
  for (const seed of [3, 4]) {
    const base = kinds({ screens: .2, flats: .2 }, seed), blank = kinds({ screens: .2, flats: .2, blank: .3 }, seed);
    assert.ok(blank.filter((kind) => kind === "blank").length > 5);
    assert.ok(base.filter((kind) => kind === "flat").length > 8 && base.filter((kind) => kind === "screen").length > 8, "independent draws realise both shares");
    blank.forEach((kind, index) => { if (kind !== "blank") assert.equal(kind, base[index]); });
    const more = kinds({ screens: .5, flats: .2 }, seed);
    more.forEach((kind, index) => { if (kind !== "screen") assert.equal(kind, base[index] === "screen" ? "screen" : base[index]); });
    more.forEach((kind, index) => { if (base[index] === "screen") assert.equal(kind, "screen"); });
    assert.ok(more.filter((kind) => kind === "screen").length > base.filter((kind) => kind === "screen").length);
  }
  assert.ok(kinds({ screens: 1 }).every((kind) => kind === "screen"));
  assert.ok(kinds({ flats: 1 }).every((kind) => kind === "flat"));
  assert.notDeepEqual(kinds({ screens: .3, flats: .3 }, 3), kinds({ screens: .3, flats: .3 }, 4), "a seed rearranges kinds");
  const turned = typeRhythmLayout(layoutOf({ columns: 12, rows: 10, turned: 1, screens: .3 })).modules;
  for (const module of turned) {
    assert.equal(module.turn !== 0, module.kind === "text");
    assert.equal(module.tone, module.kind === "text" ? 1 : module.kind === "screen" ? 2 : 0);
  }
  assert.ok(turned.some((module) => module.turn === 1) && turned.some((module) => module.turn === -1));
});

test("pinned modules stay in exact alignment and the focus confines disruption", () => {
  const strong = { displacement: 1, stretch: 1, zoom: .6, correlation: 1.5 };
  const pinned = typeRhythmLayout(layoutOf({ columns: 10, rows: 8, ...strong, pinned: 1 }));
  for (const module of pinned.modules) {
    assert.deepEqual([...module.displacement], [0, 0]); assert.deepEqual([...module.stretch], [1, 1]); assert.ok(module.pinned);
  }
  const free = typeRhythmLayout(layoutOf({ columns: 10, rows: 8, ...strong }));
  assert.ok(free.modules.filter((module) => module.displacement[0] !== 0 || module.stretch[0] !== 1).length > 60);
  const focus = typeRhythmLayout(layoutOf({ columns: 10, rows: 8, ...strong, focalX: 60, focalY: 40, focalRadius: 150 }));
  let inside = 0;
  for (const module of focus.modules) {
    const cx = (module.bounds[0] + module.bounds[2]) / 2, cy = (module.bounds[1] + module.bounds[3]) / 2;
    const changed = module.displacement[0] !== 0 || module.displacement[1] !== 0 || module.stretch[0] !== 1;
    if (Math.hypot(cx - 60, cy - 40) >= 150) assert.equal(changed, false, module.id); else if (changed) inside++;
  }
  assert.ok(inside >= 2);
  // Neighbouring modules share the field: displacement differs less between neighbours than across the sheet.
  const along = free.modules.slice(0, 10).map((module) => module.source.shift[0]);
  const stepped = along.slice(1).map((value, index) => Math.abs(value - along[index]));
  const spread = Math.max(...along) - Math.min(...along);
  assert.ok(Math.max(...stepped) < spread + 1e-9 && stepped.reduce((a, b) => a + b, 0) / stepped.length < spread);
  assert.ok(Math.max(...free.modules.map((module) => Math.abs(module.source.shift[0]))) <= 1 && Math.max(...free.modules.map((module) => Math.abs(module.source.growChannel))) <= 1);
});

test("the anchor is set once, unstretched, inside its strip, and never overlaps a module", () => {
  for (const side of ["top", "bottom"] as const) {
    const layout = typeRhythmLayout(layoutOf({ anchorSide: side, columns: 6, displacement: 1, stretch: 1, slicing: "partition", cuts: 30 }));
    const anchor = typeAnchor(layout, words, 7)!, strip = layout.anchor!;
    assert.ok(anchor.bounds[0] >= strip[0] && anchor.bounds[2] <= strip[2] && anchor.bounds[1] >= strip[1] && anchor.bounds[3] <= strip[3]);
    const ink = rawBounds(words.anchor);
    near((anchor.bounds[2] - anchor.bounds[0]) / (anchor.bounds[3] - anchor.bounds[1]), (ink.right - ink.left) / (ink.bottom - ink.top), 1e-9);
    assert.equal(anchor.site.scale > 0, true); assert.equal(anchor.site.angle, 0);
    near((anchor.bounds[2] - anchor.bounds[0]) / (ink.right - ink.left), anchor.site.scale, 1e-9);
    for (const module of layout.modules) near(overlapArea(module.clip.bounds, anchor.bounds), 0, 1e-9);
  }
  assert.equal(typeAnchor(typeRhythmLayout(layoutOf({ anchorSide: "none" })), words, 7), null);
});

test("modules never depend on the text, the size or any appearance choice; a construction edit does change them", () => {
  const recipe = (params: Record<string, number | string | boolean>) => recipeFor(params);
  const base = recipe({});
  const layout = typeRhythmLayout(base.layout);
  for (const params of [{ phrase: "more" }, { phrase: "quiet", size: 60, leading: 1.6, repeatGap: 1, rowsPerLine: 3, phase: -.3 }, { textStyle: "outline", weight: 3, screenWeight: 3 }, { screenPeriod: 30, screenAngle: 40 }])
    assert.equal(typeRhythmLayout(recipe(params).layout), layout, JSON.stringify(params));
  assert.notEqual(typeRhythmLayout(recipe({ columns: 9 }).layout), layout);
  assert.notEqual(typeRhythmLayout(recipe({ gutter: 9 }).layout), layout);
  // Changing the phrase keeps every module object and changes only what they show.
  const a = typeField(base.text, base.field), b = typeField(recipe({ phrase: "more" }).text, base.field);
  const text = layout.modules.filter((module) => module.kind === "text");
  assert.ok(text.length > 5);
  const differing = text.filter((module) => key(moduleType(layout, a, module).rings.flat()) !== key(moduleType(layout, b, module).rings.flat()));
  assert.ok(differing.length > text.length / 2);
  assert.equal(moduleType(layout, a, text[0]), moduleType(layout, a, text[0]), "geometry is cached per module and field");
  // The same field on the same text is the same object, so an ink edit reuses every module's geometry.
  assert.equal(typeField(base.text, base.field), a);
  assert.equal(typeContent(layout, a), typeContent(layout, a));
});

test("every published value is deeply frozen", () => {
  const layout = typeRhythmLayout(layoutOf({ screens: .3, turned: .4, columns: 5, rows: 4, gutter: 3 })), field = typeField(words, fieldOf());
  assert.ok(deepFrozen(layout) && deepFrozen(field));
  const text = layout.modules.find((module) => module.kind === "text")!, screen = layout.modules.find((module) => module.kind === "screen")!;
  const type = moduleType(layout, field, text);
  assert.ok(deepFrozen(type) && deepFrozen(moduleScreen(screen, { period: 12, angle: 0 })) && deepFrozen(moduleOutline(text, type)) && deepFrozen(moduleLined(text, type, { period: 12, angle: 0 })));
  assert.ok(deepFrozen(typeAnchor(layout, words, 7)));
});

test("outline strokes are the glyph edges clipped as polylines; lined strokes stay inside the glyphs", () => {
  const layout = typeRhythmLayout(layoutOf({ gutter: 4 })), field = typeField(words, fieldOf({ size: 140 }));
  let outlined = 0, lined = 0;
  for (const module of layout.modules) {
    const type = moduleType(layout, field, module), w = module.clip.bounds[2] - module.clip.bounds[0], h = module.clip.bounds[3] - module.clip.bounds[1];
    const vertices = new Set(type.rings.flatMap((ring) => ring.map((point) => `${point[0]},${point[1]}`)));
    for (const path of moduleOutline(module, type)) {
      for (const [x, y] of path.points) {
        assert.ok(x >= -1e-9 && x <= w + 1e-9 && y >= -1e-9 && y <= h + 1e-9);
        assert.ok(vertices.has(`${x},${y}`) || Math.abs(x) < 1e-9 || Math.abs(x - w) < 1e-9 || Math.abs(y) < 1e-9 || Math.abs(y - h) < 1e-9, "only clip crossings are new points");
      }
      outlined++;
    }
    for (const path of moduleLined(module, type, { period: 9, angle: 25 })) {
      for (let i = 1; i < path.points.length; i++) {
        const mx = (path.points[i][0] + path.points[i - 1][0]) / 2, my = (path.points[i][1] + path.points[i - 1][1]) / 2;
        assert.notEqual(winding(type.rings, mx, my), 0, "a lined stroke lies in the ink");
      }
      lined++;
    }
  }
  assert.ok(outlined >= 15 && lined > 100);
});

/** A p5-shaped recording surface with a real transform stack. */
function recorder() {
  const stack: number[][] = [], m = [1, 0, 0, 1, 0, 0];
  const events: Array<{ op: string; points: Point[]; fill: string | null }> = [];
  let shape: Point[] = [], fill: string | null = null;
  const apply = (x: number, y: number): Point => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mul = (a: number, b: number, c: number, d: number, e: number, f: number) => {
    const [ma, mb, mc, md, me, mf] = m;
    m[0] = ma * a + mc * b; m[1] = mb * a + md * b; m[2] = ma * c + mc * d; m[3] = mb * c + md * d; m[4] = ma * e + mc * f + me; m[5] = mb * e + md * f + mf;
  };
  const surface: CompositionSurface = {
    CLOSE: "close", ROUND: "round",
    push() { stack.push([...m]); }, pop() { m.splice(0, 6, ...stack.pop()!); },
    translate(x, y) { mul(1, 0, 0, 1, x, y); }, rotate(r) { mul(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0); },
    scale(x, y = x) { mul(x, 0, 0, y, 0, 0); },
    noFill() { fill = null; }, noStroke() {}, fill(...c) { fill = c.join(","); }, stroke() {}, strokeWeight() {}, strokeCap() {},
    circle() {}, line(a, b, c, d) { events.push({ op: "line", points: [apply(a, b), apply(c, d)], fill }); },
    rect(x, y, w, h) { events.push({ op: "rect", points: [apply(x, y), apply(x + w, y + h)], fill }); },
    beginShape() { shape = []; }, vertex(x, y) { shape.push(apply(x, y)); },
    endShape(mode) { events.push({ op: mode === "close" ? "polygon" : "polyline", points: shape, fill }); },
  };
  return { surface, events };
}
const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42): TypeRhythmComposition => {
  const built = referenceComposition({ ...createInstrument("typographic-rhythm"), seed, params: { ...createInstrument("typographic-rhythm").params, ...params } });
  assert.equal(built.kind, "typography");
  return built as TypeRhythmComposition & { kind: "typography" };
};

test("drawing paints only inside the non-blank clip rectangles and the anchor strip, and blank modules stay bare", () => {
  for (const style of ["solid", "outline", "lined"]) {
    const recipe = recipeFor({ textStyle: style, blank: .3, screens: .3, flats: .2, turned: .3, gutter: 4 });
    const layout = typeRhythmLayout(recipe.layout), { surface, events } = recorder();
    drawTypeRhythm(surface, recipe);
    const anchor = typeAnchor(layout, recipe.text, recipe.layout.seed)!;
    const allowed = [...layout.modules.filter((module) => module.kind !== "blank").map((module) => module.clip.bounds), anchor.bounds];
    assert.ok(events.length > 30);
    const stroke = 1e-6;
    for (const event of events) for (const [x, y] of event.points)
      assert.ok(allowed.some((b) => x >= b[0] - stroke && x <= b[2] + stroke && y >= b[1] - stroke && y <= b[3] + stroke), `${style} point ${x},${y} outside every module`);
    const blanks = layout.modules.filter((module) => module.kind === "blank");
    assert.ok(blanks.length > 3);
    for (const module of blanks) for (const event of events) for (const [x, y] of event.points) {
      const b = module.bounds;
      assert.ok(!(x > b[0] + 1e-6 && x < b[2] - 1e-6 && y > b[1] + 1e-6 && y < b[3] - 1e-6), `${style} paints in blank ${module.id}`);
    }
    // Flat modules are one rectangle of exactly their clip.
    for (const module of layout.modules.filter((m) => m.kind === "flat")) {
      const rect = events.find((event) => event.op === "rect" && Math.abs(event.points[0][0] - module.clip.bounds[0]) < 1e-9 && Math.abs(event.points[0][1] - module.clip.bounds[1]) < 1e-9);
      assert.ok(rect, `flat ${module.id}`);
      near(rect!.points[1][0], module.clip.bounds[2]); near(rect!.points[1][1], module.clip.bounds[3]);
    }
  }
});

test("drawing is bounded by the shared run, and cancelled runs stop", () => {
  const recipe = recipeFor();
  assert.throws(() => drawTypeRhythm(recorder().surface, recipe, createCompositionRun({ maxWork: 3 })), /work budget exceeded/);
  assert.throws(() => drawTypeRhythm(recorder().surface, recipe, createCompositionRun({ cancelled: () => true })), /cancelled/);
});

test("work bounds throw named errors instead of thinning", () => {
  const dense = typeField(words, fieldOf({ size: 4, leading: .5, gap: 0 }));
  const big = typeRhythmLayout(layoutOf({ anchorSide: "none", width: 1000, height: 1000, columns: 2, rows: 2, zoom: 1.5, stretch: 2, displacement: 0 }));
  assert.throws(() => moduleType(big, dense, big.modules[0]), /more than 150000 vertices|more than 2000 glyph runs|spans \d+ type rows/);
  const many = typeRhythmLayout(layoutOf({ anchorSide: "none", width: 1000, height: 1000, columns: 24, rows: 24 }));
  assert.throws(() => typeContent(many, typeField(words, fieldOf({ size: 8, leading: .5, gap: 0 }))), /1000000 vertices/);
  assert.throws(() => typeRhythmLayout(layoutOf({ columns: 25 })), /Columns must be an integer in \[2, 24\]/);
  assert.throws(() => typeField(words, fieldOf({ rowsPerLine: 0 })), /Rows per line/);
});

test("the instrument resolves named controls to a typed descriptor, varies structurally with the seed, and validates coupled bounds", () => {
  const input = createInstrument("typographic-rhythm");
  const layouts = [1, 2, 3].map((seed) => typeRhythmLayout(recipeFor({}, seed).layout).modules.map((module) => `${module.id}:${module.kind}:${module.turn}`).join("|"));
  assert.equal(new Set(layouts).size, 3, "each seed is a different arrangement");
  assert.equal(usesSeed(input), true);
  const still = { ...input, params: { ...input.params, slicing: "grid", blank: 0, screens: 0, flats: 0, turned: 0, displacement: 0, stretch: 0, zoom: 0 } };
  assert.equal(usesSeed(still), false);
  const fingerprint = (seed: number) => { const { events, surface } = recorder(); drawInstrument(surface as never, { ...still, seed }); return JSON.stringify(events); };
  assert.equal(fingerprint(1), fingerprint(2), "with nothing random the seed changes nothing");
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, screenPeriod: 12, zoom: .8, stretch: 1.5 } }), /would be stretched below 3 units/);
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, anchorHeight: 160, height: 170 } }), /at least 16 units of height/);
  const recipe = recipeFor({ phrase: "quiet" });
  assert.deepEqual([...recipe.text.lines], ["quiet", "noise", "quiet"]);
  assert.equal(recipe.text, bundledTextSources.quiet);
});

test("preparation warms exactly what the drawing reuses, and cancellation is reported", async () => {
  const recipe = recipeFor({ textStyle: "outline", columns: 12, rows: 12, cuts: 120 }, 5);
  assert.equal(await prepareTypeRhythm(recipe, () => true), false);
  let polls = 0;
  assert.equal(await prepareTypeRhythm(recipe, () => ++polls > 6), false, "superseded midway");
  assert.equal(await prepareTypeRhythm(recipe, () => false), true);
  const layout = typeRhythmLayout(recipe.layout), field = typeField(recipe.text, recipe.field);
  const warmed = typeContent(layout, field), first = warmed.modules[0];
  const module = layout.modules.find((candidate) => candidate.id === first.id)!;
  const outline = moduleOutline(module, first);
  drawTypeRhythm(recorder().surface, recipe);
  assert.equal(typeContent(layout, field), warmed);
  assert.equal(moduleOutline(module, first), outline, "the drawing reuses the prepared outline");
});

test("a field object carries its own text while modules share geometry across texts with the same lines", () => {
  const a = textSource({ id: "a", lines: ["HI", "OX"], anchor: "ONE" }), b = textSource({ id: "b", lines: ["HI", "OX"], anchor: "TWO" });
  const fa = typeField(a, fieldOf()), fb = typeField(b, fieldOf());
  assert.equal(fa.text.anchor, "ONE"); assert.equal(fb.text.anchor, "TWO");
  assert.equal(fa.key, fb.key, "identical lines and options are one geometry");
  const layout = typeRhythmLayout(layoutOf({ gutter: 4 }));
  assert.equal(moduleType(layout, fa, layout.modules[0]), moduleType(layout, fb, layout.modules[0]));
});
