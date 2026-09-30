import assert from "node:assert/strict";
import test from "node:test";
import {
  PACK_LIMITS, createCompositionRun, createInstrument, customItem, customShape, definition, domainDifference, domainIntersection, drawInstrument, drawShapePacking,
  inspectorItems, locateInDomain, packContainer, packItems, packNegativeSpace, packOrder, packShapes, packedSites, planarDomain, planarRegion, prepareInstrument,
  shapeCovers, shapePackingComposition, shapePackingLayout, unionDomains, visibleParameters,
  type CompositionSurface, type DrawingContext, type InstrumentInput, type PackItem, type PackRules, type PackedInstance, type PlanarDomain, type ShapePacking, type ShapePackingRecipe,
} from "../dist/index.js";

const ID = "shape-packing";
type Params = Record<string, number | string | boolean>;
type P = [number, number];
function input(params: Params = {}, seed = 42): InstrumentInput {
  const base = createInstrument(ID);
  return { ...base, seed, params: { ...base.params, ...params } };
}
const recipeOf = (params: Params = {}, seed = 42): ShapePackingRecipe => shapePackingComposition(input(params, seed));
const layoutOf = (params: Params = {}, seed = 42): ShapePacking => shapePackingLayout(recipeOf(params, seed));

function recorder(): { surface: CompositionSurface; ops: string[] } {
  const ops: string[] = [];
  const round = (value: unknown) => typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value;
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => { ops.push(JSON.stringify([key, ...args.map(round)])); }; },
  });
  return { surface: surface as unknown as CompositionSurface, ops };
}
const drawnInput = (value: InstrumentInput): string[] => { const { surface, ops } = recorder(); drawInstrument(surface as unknown as DrawingContext, value); return ops; };

const rules = (o: Partial<PackRules> = {}): PackRules => ({ order: "largest", rule: "center", settleAngle: 90, rotations: 4, mirror: false, gap: 0, margin: 0, counters: "open", resolution: 200, retries: 0, shrink: 0.8, stop: null, ...o });
const rectangle = (width: number, height: number, cx = 320, cy = 320): PlanarDomain => packContainer({ kind: "rectangle", centerX: cx, centerY: cy, width, height, angle: 0 });
const poly = (outer: P[], holes: P[][] = []) => planarRegion({ outer, holes });
const TROMINO = customShape("tromino", poly([[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]]));
const SQUARE = customShape("square", poly([[0, 0], [1, 0], [1, 1], [0, 1]]));
const FRAME = customShape("frame", poly([[0, 0], [4, 0], [4, 4], [0, 4]], [[[1, 1], [1, 3], [3, 3], [3, 1]]]));

const near = (a: number, b: number, tol: number, note = "") => assert.ok(Math.abs(a - b) <= tol, `${note} ${a} != ${b} (±${tol})`);
function segments(region: PlanarDomain): number[][] {
  const out: number[][] = [];
  for (const r of region.regions) for (const ring of [r.outer, ...r.holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) out.push([ring[j][0], ring[j][1], ring[i][0], ring[i][1]]);
  return out;
}
const pointSegment = (px: number, py: number, [ax, ay, bx, by]: number[]): number => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
/** Distance between two non-crossing polygon sets: the minimum vertex-to-segment distance over both directions. */
function distance(a: PlanarDomain, b: PlanarDomain): number {
  const sa = segments(a), sb = segments(b);
  let best = Infinity;
  for (const s of sa) for (const t of sb) best = Math.min(best, pointSegment(s[0], s[1], t), pointSegment(t[0], t[1], s));
  return best;
}
const boxesTouch = (a: PlanarDomain, b: PlanarDomain, slack: number): boolean =>
  !!a.bounds && !!b.bounds && a.bounds[0] <= b.bounds[2] + slack && b.bounds[0] <= a.bounds[2] + slack && a.bounds[1] <= b.bounds[3] + slack && b.bounds[1] <= a.bounds[3] + slack;

// ------------------------------------------------------------------ the collision test is exact, not a bounding box

test("interlocking L pieces both fit where two bounding boxes could not, and their interiors are disjoint", () => {
  // Two L trominoes (2 x 2 boxes at size 200) tile a 3 x 2 rectangle when one is turned half a turn; two boxes need 4 x 2.
  const container = rectangle(340, 240);
  // Settling to the left: the first piece rests corner-first against the wall, its notch opens towards the second.
  const packing = packShapes(container, [customItem("a", TROMINO, 200), customItem("b", TROMINO, 200)], rules({ resolution: 240, rule: "settle", settleAngle: 180 }));
  assert.equal(packing.instances.length, 2, `unplaced: ${JSON.stringify(packing.unplaced.map((u) => u.reason))}`);
  const [a, b] = packing.instances;
  const boxOverlap = Math.min(a.region.bounds![2], b.region.bounds![2]) - Math.max(a.region.bounds![0], b.region.bounds![0]);
  const boxOverlapY = Math.min(a.region.bounds![3], b.region.bounds![3]) - Math.max(a.region.bounds![1], b.region.bounds![1]);
  assert.ok(boxOverlap > 0 && boxOverlapY > 0, "the bounding boxes overlap in area");
  near(domainIntersection(a.region, b.region).area, 0, 1e-9, "interiors");
  near(packing.placedArea, 2 * 3 * 100 * 100, 1e-6, "two trominoes of area 3 at 100 units per cell");
  assert.ok(shapeCovers(container, unionDomains([a.region, b.region])));
});

test("a piece may sit inside another piece's counter when counters are open, and not when they are solid", () => {
  const container = rectangle(232, 232);
  const items = [customItem("frame", FRAME, 200), customItem("small", SQUARE, 40)];
  const open = packShapes(container, items, rules({ gap: 3, margin: 4, counters: "open", resolution: 232 }));
  assert.equal(open.instances.length, 2, "small piece placed");
  const frame = open.instances.find((i) => i.id === "frame")!, small = open.instances.find((i) => i.id === "small")!;
  const counter = planarRegion({ outer: frame.region.regions[0].holes[0] as unknown as P[] });
  assert.ok(shapeCovers(counter, small.region), "the small square lies inside the frame's counter");
  near(counter.area, 100 * 100, 1e-6);
  assert.ok(distance(frame.region, small.region) >= 3 * 15 / 16, "and keeps the gap to the frame");
  const solid = packShapes(container, items, rules({ gap: 3, margin: 4, counters: "solid", resolution: 232 }));
  assert.deepEqual(solid.instances.map((i) => i.id), ["frame"]);
  assert.deepEqual(solid.unplaced.map((u) => [u.id, u.reason]), [["small", "no-room"]]);
});

// ------------------------------------------------------------------ failure to pack is a result

test("what does not fit is reported with its reason, and every item is placed or unplaced exactly once", () => {
  const container = rectangle(300, 300);
  const items = [customItem("a", SQUARE, 200), customItem("b", SQUARE, 200), customItem("c", SQUARE, 500)];
  const packing = packShapes(container, items, rules({ retries: 2, shrink: 0.9 }));
  const ids = [...packing.instances.map((i) => i.id), ...packing.unplaced.map((u) => u.id)].sort();
  assert.deepEqual(ids, ["a", "b", "c"]);
  assert.equal(packing.instances.length, 1);
  assert.ok(packing.unplaced.every((u) => u.reason === "no-room" && u.attempts === 3));
  near(packing.unplaced.find((u) => u.id === "c")!.size, 500 * 0.81, 1e-9, "size of the last attempt");
  near(packing.coverage, 200 * 200 / (300 * 300), 1e-9, "coverage is piece area over container area");
});

test("retries shrink an item until it fits, and record both the size and the number of retries used", () => {
  const container = rectangle(100, 100);
  const tight = packShapes(container, [customItem("x", SQUARE, 130)], rules({ retries: 0 }));
  assert.equal(tight.instances.length, 0);
  const shrunk = packShapes(container, [customItem("x", SQUARE, 130)], rules({ retries: 2, shrink: 0.6 }));
  assert.equal(shrunk.instances.length, 1);
  assert.equal(shrunk.instances[0].retries, 1);
  near(shrunk.instances[0].size, 78, 1e-9);
  near(shrunk.instances[0].region.area, 78 * 78, 1e-6);
});

test("a stop coverage ends packing as soon as it is reached; the rest are reported as stopped", () => {
  const items = packItems({ seed: 3, family: "blobs", count: 60, sizeMax: 100, sizeMin: 30, skew: 1 });
  const container = packContainer({ kind: "ellipse", centerX: 320, centerY: 320, width: 500, height: 500, angle: 0 });
  const packing = packShapes(container, items, rules({ gap: 3, margin: 4, stop: 0.2 }), 3);
  assert.ok(packing.coverage >= 0.2);
  const last = packing.instances[packing.instances.length - 1];
  assert.ok(packing.coverage - last.region.area / container.area < 0.2, "the last placed piece is the one that reached the target");
  assert.ok(packing.unplaced.length > 0 && packing.unplaced.every((u) => u.reason === "stopped" && u.attempts === 0));
  assert.equal(packing.instances.length + packing.unplaced.length, 60);
});

// ------------------------------------------------------------------ gap, margin, containers

test("pieces keep the gap and the edge margin (checked by brute-force distances, not by the packer)", () => {
  const packing = layoutOf({ container: "ellipse", family: "mixed", count: 60, gap: 7, margin: 12, rotations: 8 }, 5);
  assert.ok(packing.instances.length > 20);
  const nearest: number[] = [];
  for (const a of packing.instances) {
    let best = Infinity;
    for (const b of packing.instances) if (a !== b && boxesTouch(a.region, b.region, 40)) best = Math.min(best, distance(a.region, b.region));
    if (Number.isFinite(best)) { nearest.push(best); assert.ok(best >= 7 * 15 / 16, `${a.id} is only ${best} from a neighbour`); }
    // Distance to the container's boundary: at least the margin (up to the offset chord tolerance).
    const edge = distance(a.region, packing.container);
    assert.ok(edge >= 12 * 15 / 16 - 1e-9, `${a.id} is ${edge} from the edge`);
  }
  nearest.sort((x, y) => x - y);
  assert.ok(nearest[nearest.length >> 1] <= 7 + 0.3, `pieces are settled onto their neighbours (median nearest ${nearest[nearest.length >> 1]})`);
});

test("a container's holes are obstacles: nothing enters a ring's hole or a letter's counter", () => {
  for (const params of [{ container: "ring", hole: 0.5 }, { container: "letter", letter: "B" }, { container: "letter", letter: "8" }] as Params[]) {
    const packing = layoutOf({ ...params, family: "blobs", count: 80, sizeMax: 70, sizeMin: 14 }, 9);
    assert.ok(packing.instances.length > 10, JSON.stringify(params));
    assert.ok(packing.container.regions.some((r) => r.holes.length > 0), "the container has holes");
    for (const i of packing.instances) {
      near(domainDifference(i.region, packing.container).area, 0, 1e-6, `${i.id} within ${JSON.stringify(params)}`);
      assert.ok(shapeCovers(packing.usable, i.region), `${i.id} within the usable region`);
    }
  }
});

test("a rectangle container has exact analytic geometry, rotation included", () => {
  const box = rectangle(300, 200, 100, 50);
  near(box.area, 60_000, 1e-9);
  assert.deepEqual([...box.bounds!], [-50, -50, 250, 150]);
  const turned = packContainer({ kind: "rectangle", centerX: 0, centerY: 0, width: 300, height: 200, angle: 90 });
  near(turned.area, 60_000, 1e-6);
  near(turned.bounds![2], 100, 1e-9); near(turned.bounds![3], 150, 1e-9);
  const ring = packContainer({ kind: "ring", centerX: 0, centerY: 0, width: 400, height: 400, angle: 0, hole: 0.5 });
  assert.equal(ring.regions.length, 1); assert.equal(ring.regions[0].holes.length, 1);
  near(ring.area, Math.PI * (200 * 200 - 100 * 100), Math.PI * 300 * 300 * 0.002, "a 120-gon area against the circle formula");
});

// ------------------------------------------------------------------ the rule

test("the placement rules pick their documented places for the first piece", () => {
  const container = rectangle(300, 300);
  const item = [customItem("s", SQUARE, 60)];
  const cell = 300 / 200;
  const settle = packShapes(container, item, rules({ rule: "settle", settleAngle: 90, margin: 6, rotations: 1 })).instances[0];
  near(settle.region.bounds![3], 470 - 6, 0.1, "falls to the bottom margin");
  const up = packShapes(container, item, rules({ rule: "settle", settleAngle: 270, margin: 6, rotations: 1 })).instances[0];
  near(up.region.bounds![1], 170 + 6, 0.1, "rises to the top margin");
  const right = packShapes(container, item, rules({ rule: "settle", settleAngle: 0, margin: 6, rotations: 1 })).instances[0];
  near(right.region.bounds![2], 470 - 6, 0.1, "slides to the right margin");
  const middle = packShapes(container, item, rules({ rule: "center", rotations: 1 })).instances[0];
  assert.ok(Math.hypot(middle.position[0] - 320, middle.position[1] - 320) <= cell, "grows from the middle");
  const wall = packShapes(container, item, rules({ rule: "walls", margin: 6, rotations: 1 })).instances[0];
  const toWall = Math.min(wall.region.bounds![0] - 170, wall.region.bounds![1] - 170, 470 - wall.region.bounds![2], 470 - wall.region.bounds![3]);
  near(toWall, 6, 0.1, "the first piece rests against a wall at the margin");
});

test("angles come from the declared set, every angle is tried, and the transform maps the shape exactly", () => {
  const items = packItems({ seed: 2, family: "leaves", count: 30, sizeMax: 90, sizeMin: 30, skew: 1 });
  const container = packContainer({ kind: "ellipse", centerX: 320, centerY: 320, width: 480, height: 480, angle: 0 });
  const four = packShapes(container, items, rules({ rotations: 4, gap: 3, margin: 4 }), 2);
  assert.ok(four.instances.length > 10);
  for (const i of four.instances) {
    const turns = i.angle / (Math.PI / 2);
    near(turns, Math.round(turns), 1e-12, "a quarter turn");
    assert.equal(i.mirrored, false);
  }
  assert.ok(new Set(four.instances.map((i) => Math.round(i.angle / (Math.PI / 2)))).size >= 3, "the search really uses the angle set, not only the first angle");
  const one = packShapes(container, items, rules({ rotations: 1, gap: 3, margin: 4 }), 2);
  assert.ok(one.instances.every((i) => i.angle === 0));
  const mirrored = packShapes(container, items, rules({ rotations: 3, mirror: true, gap: 3, margin: 4 }), 2);
  assert.ok(mirrored.instances.some((i) => i.mirrored), "mirrored variants are used when allowed");
  for (const packing of [four, mirrored]) for (const i of packing.instances) {
    // world = position + R(angle)(±x, y)·size for the normal-form shape (centroid at the origin).
    near(i.region.area, i.item.shape.area * i.size * i.size, 1e-6 * i.size * i.size, "area");
    near(i.region.centroid![0], i.position[0], 1e-6 * i.size, "centroid x"); near(i.region.centroid![1], i.position[1], 1e-6 * i.size, "centroid y");
    const c = Math.cos(i.angle), s = Math.sin(i.angle);
    for (const ring of i.item.shape.domain.regions[0].outer.slice(0, 6)) {
      const x = (i.mirrored ? -ring[0] : ring[0]) * i.size, y = ring[1] * i.size;
      assert.equal(locateInDomain(i.region, i.position[0] + x * c - y * s, i.position[1] + x * s + y * c) === "outside", false, "a transformed vertex lies on the placed region");
    }
  }
});

test("the order is a pure function of the list: largest, smallest, or shuffled by the seed", () => {
  const items = packItems({ seed: 4, family: "polygons", count: 25, sizeMax: 120, sizeMin: 20, skew: 1.5 });
  const largest = packOrder(items, "largest", 4), smallest = packOrder(items, "smallest", 4);
  for (let k = 1; k < items.length; k++) { assert.ok(largest[k - 1].size >= largest[k].size); assert.ok(smallest[k - 1].size <= smallest[k].size); }
  const a = packOrder(items, "shuffled", 1).map((i) => i.id), b = packOrder(items, "shuffled", 2).map((i) => i.id);
  assert.deepEqual(a, packOrder(items, "shuffled", 1).map((i) => i.id));
  assert.notDeepEqual(a, b);
  assert.deepEqual([...a].sort(), items.map((i) => i.id).sort(), "a permutation");
  const container = packContainer({ kind: "ellipse", centerX: 320, centerY: 320, width: 500, height: 500, angle: 0 });
  const packing = packShapes(container, items, rules({ gap: 3, margin: 4 }), 4);
  const placedInOrder = largest.filter((it) => packing.instances.some((i) => i.id === it.id)).map((it) => it.id);
  assert.deepEqual(packing.instances.map((i) => i.id), placedInOrder, "placement rank follows the order");
});

// ------------------------------------------------------------------ results

test("the negative space is the container minus the pieces, and coverage is consistent with it", () => {
  const packing = layoutOf({ count: 50, gap: 4 }, 8);
  const negative = packNegativeSpace(packing);
  near(negative.area, packing.containerArea - packing.placedArea, 1e-6 * packing.containerArea, "areas add up");
  near(1 - negative.area / packing.containerArea, packing.coverage, 1e-9);
  for (const i of packing.instances) near(domainIntersection(negative, i.region).area, 0, 1e-6, `${i.id} does not overlap the negative space`);
  assert.equal(packNegativeSpace(packing), negative, "cached");
  const empty = packShapes(rectangle(50, 50), [], rules());
  assert.equal(packNegativeSpace(empty), empty.container);
  assert.equal(empty.coverage, 0);
});

test("results are deterministic, cached by construction, and independent of appearance", () => {
  const base = recipeOf({ count: 40 }, 6);
  const layout = shapePackingLayout(base);
  assert.equal(shapePackingLayout(base), layout, "same construction, same object");
  const restyled = recipeOf({ count: 40, render: "hatch", colorBy: "angle", weight: 2, leftover: "fill", frame: true, hatchSpacing: 6 }, 6);
  assert.equal(shapePackingLayout({ ...restyled, palette: [1, 2, 3] }), layout, "look, colors and palette never re-solve");
  // A fresh, equal container is a different cache slot; the solve must give the same numbers.
  const container = planarDomain(JSON.parse(JSON.stringify(layout.container)).regions, { id: layout.container.id });
  const items = packItems({ seed: 6, family: "mixed", letters: "upper", count: 40, sizeMax: base.pieces.sizeMax, sizeMin: base.pieces.sizeMin, skew: base.pieces.skew });
  const again = packShapes(container, items, base.rules, 6);
  assert.notEqual(again, layout);
  assert.deepEqual(again.instances.map((i) => [i.id, i.position, i.angle, i.size]), layout.instances.map((i) => [i.id, i.position, i.angle, i.size]));
});

test("item identity: p<j> keeps its shape and size when the count changes, and the seed changes the population", () => {
  const params = { seed: 9, family: "mixed" as const, sizeMax: 130, sizeMin: 20, skew: 1.5 };
  const few = packItems({ ...params, count: 20 }), many = packItems({ ...params, count: 45 });
  for (let j = 0; j < 20; j++) { assert.equal(few[j].id, `p${j}`); assert.equal(many[j].shape.id, few[j].shape.id); assert.equal(many[j].size, few[j].size); }
  const other = packItems({ ...params, seed: 10, count: 20 });
  assert.notDeepEqual(other.map((i) => [i.shape.id, i.size]), few.map((i) => [i.shape.id, i.size]));
  // Sizes stay in the requested range and, with skew > 1, mostly small.
  const sizes = many.map((i) => i.size);
  assert.ok(Math.min(...sizes) >= 20 - 1e-9 && Math.max(...sizes) <= 130 + 1e-9);
  assert.ok(sizes.filter((s) => s < Math.sqrt(20 * 130)).length > sizes.length * 0.55, "a skewed population has more small pieces than large");
  // Every bundled family gives simple valid shapes in normal form.
  for (const family of ["letters", "leaves", "blobs", "polygons"] as const) for (const item of packItems({ seed: 1, family, letters: "mixed", count: 60, sizeMax: 100, sizeMin: 40, skew: 1 })) {
    const d = item.shape.domain, w = d.bounds![2] - d.bounds![0], h = d.bounds![3] - d.bounds![1];
    near(Math.max(w, h), 1, 1e-9, `${item.shape.id} longest side`);
    near(d.centroid![0], 0, 1e-9, item.shape.id); near(d.centroid![1], 0, 1e-9, item.shape.id);
    assert.ok(d.area > 0.02, `${item.shape.id} has area`);
  }
});

// ------------------------------------------------------------------ limits and errors

test("work limits and invalid input name the control to change; nothing is truncated", () => {
  assert.throws(() => layoutOf({ count: 600, rotations: 24, mirror: true, resolution: 320, sizeMax: 60, sizeMin: 8, gap: 1, margin: 1 }),
    /more than \d+ search steps: lower Pieces, Rotations, Retries or Search resolution/);
  assert.throws(() => recipeOf({ sizeMin: 100, sizeMax: 60 }), /Smallest piece exceeds Largest piece/);
  assert.throws(() => layoutOf({ margin: 300 }), /Edge margin leaves no room/);
  assert.throws(() => packShapes(rectangle(200, 200), [customItem("a", SQUARE, 20), customItem("a", SQUARE, 30)], rules()), /Duplicate item id a/);
  assert.throws(() => packShapes(rectangle(200, 200), [], rules({ rotations: 25 })), /Rotations must be an integer in \[1, 24\]/);
  assert.throws(() => packShapes(rectangle(200, 200), [], rules({ resolution: 400 })), /Search resolution/);
  assert.throws(() => customItem("z", SQUARE, 0), /Item size/);
  assert.equal(PACK_LIMITS.rotations, 24);
  const seen = { calls: 0 };
  const stopper = { check(): void { if (++seen.calls > 3) throw new Error("cancelled by test"); } };
  assert.throws(() => packShapes(rectangle(400, 400), packItems({ seed: 1, family: "blobs", count: 30, sizeMax: 90, sizeMin: 30, skew: 1 }), rules({ resolution: 100 }), 1, stopper), /cancelled by test/);
});

// ------------------------------------------------------------------ the instrument

test("the instrument draws a transparent layer inside its container, and appearance edits repaint without re-solving", async () => {
  const ops = drawnInput(input());
  assert.ok(ops.length > 200);
  assert.ok(!ops.some((op) => op.startsWith('["background"') || op.startsWith('["clear"')), "never clears the canvas");
  const recipe = recipeOf();
  const bounds = shapePackingLayout(recipe).container.bounds!;
  for (const op of ops) {
    if (!op.startsWith('["vertex"')) continue;
    const [, x, y] = JSON.parse(op) as [string, number, number];
    assert.ok(x >= bounds[0] - 1e-6 && x <= bounds[2] + 1e-6 && y >= bounds[1] - 1e-6 && y <= bounds[3] + 1e-6, `vertex ${x},${y} escapes the container`);
  }
  const before = shapePackingLayout(recipe);
  for (const edit of [{ render: "outline" }, { render: "hatch" }, { render: "mixed" }, { colorBy: "order" }, { leftover: "fill" }, { frame: true }] as Params[]) {
    assert.notDeepEqual(drawnInput(input(edit)), ops, JSON.stringify(edit));
    assert.equal(shapePackingLayout(recipeOf(edit)), before, `${JSON.stringify(edit)} keeps the layout`);
  }
  assert.notDeepEqual(drawnInput(input({ render: "outline", weight: 2.5 })), drawnInput(input({ render: "outline" })), "weight is the outline width");
  assert.equal(await prepareInstrument(input(), () => false), true);
  assert.equal(await prepareInstrument(input(), () => true), false);
});

test("a new seed re-deals the pieces and their arrangement; a structural control changes the placement", () => {
  const a = layoutOf({}, 1), b = layoutOf({}, 2);
  assert.notDeepEqual(a.instances.map((i) => i.item.shape.id), b.instances.map((i) => i.item.shape.id));
  const rule = layoutOf({ rule: "walls" }), center = layoutOf({});
  assert.notDeepEqual(rule.instances.map((i) => i.position), center.instances.map((i) => i.position));
  const gaps = layoutOf({ gap: 12 }), tight = layoutOf({ gap: 1 });
  assert.ok(tight.coverage !== gaps.coverage);
});

test("hidden controls are not read: switching a choice off leaves the recipe unchanged", () => {
  const settle = recipeOf({ rule: "walls", settleAngle: 10 }), other = recipeOf({ rule: "walls", settleAngle: 200 });
  assert.deepEqual(settle, other);
  assert.deepEqual(recipeOf({ family: "blobs", letters: "digits", counters: "solid" }), recipeOf({ family: "blobs", letters: "lower", counters: "open" }));
  assert.deepEqual(recipeOf({ stop: "all", coverage: 0.2 }), recipeOf({ stop: "all", coverage: 0.9 }));
  assert.deepEqual(recipeOf({ render: "fill", hatchAngle: 5, hatchSpacing: 9, hatchFollow: false }), recipeOf({ render: "fill", hatchAngle: 90, hatchSpacing: 2, hatchFollow: true }));
  assert.deepEqual(recipeOf({ container: "ellipse", hole: 0.2, letter: "R" }), recipeOf({ container: "ellipse", hole: 0.8, letter: "A" }));
  const names = visibleParameters(ID, input({ render: "fill", rule: "center", container: "ellipse", family: "blobs", stop: "all" }).params).map((p) => p.key);
  for (const hidden of ["hatchSpacing", "hatchAngle", "hatchFollow", "settleAngle", "hole", "letter", "letters", "counters", "coverage"]) assert.ok(!names.includes(hidden), `${hidden} is hidden`);
  const shown = visibleParameters(ID, input({ render: "hatch", rule: "settle", container: "ring", family: "mixed", stop: "coverage" }).params).map((p) => p.key);
  for (const key of ["hatchSpacing", "hatchAngle", "hatchFollow", "settleAngle", "hole", "letters", "counters", "coverage"]) assert.ok(shown.includes(key), `${key} is shown`);
});

test("controls are grouped with two proportional pairs and the inspector shows only what applies", () => {
  const def = definition(ID);
  const groups = new Map(def.parameters.map((p) => [p.key, p.group]));
  assert.equal(groups.get("width"), "Placement/Size");
  assert.equal(groups.get("sizeMax"), "Pieces/Size range");
  assert.equal(groups.get("gap"), "Packing rule/Spacing");
  const tree = inspectorItems(ID, input({ render: "fill" }).params);
  const flat = JSON.stringify(tree);
  assert.ok(!flat.includes("hatchSpacing"));
  assert.ok(flat.includes('"Spacing"') && flat.includes('"proportional":true'));
});

test("consumers replace the stock rendering and receive one site per placed piece in placement order", () => {
  const recipe = recipeOf({ count: 30 }, 3), packing = shapePackingLayout(recipe);
  const seen: PackedInstance[] = [], { surface, ops } = recorder();
  drawShapePacking(surface, recipe, { piece: (_s, site) => { seen.push(site.instance); assert.equal(Math.abs(site.scale), site.size); assert.equal(site.scale < 0, site.instance.mirrored); } },
    createCompositionRun({ maxWork: 1000 }));
  assert.deepEqual(seen.map((i) => i.id), packing.instances.map((i) => i.id));
  assert.equal(ops.filter((op) => op.startsWith('["translate"')).length, packing.instances.length);
  const sites = packedSites(packing, recipe);
  assert.deepEqual(sites.map((s) => s.id), packing.instances.map((i) => i.id));
  assert.ok(sites.every((s) => s.tone! >= 1 && s.tone! < recipe.palette.length));
  assert.throws(() => drawShapePacking(recorder().surface, recipe, { piece: () => {} }, createCompositionRun({ maxWork: 5 })), /work budget/);
});

test("stock drawing: filled pieces are one shape per region with counters left open, colors come from the palette", () => {
  const recipe = recipeOf({ count: 40, family: "letters" }, 4), packing = shapePackingLayout(recipe);
  const { surface, ops } = recorder();
  drawShapePacking(surface, recipe);
  const regions = packing.instances.reduce((n, i) => n + i.region.regions.length, 0);
  assert.equal(ops.filter((op) => op.startsWith('["endShape"')).length, regions);
  const withHoles = packing.instances.filter((i) => i.region.regions.some((r) => r.holes.length > 0)).length;
  assert.ok(withHoles > 3, "letters with counters were packed");
  const fills = new Set(ops.filter((op) => op.startsWith('["fill"')).map((op) => (JSON.parse(op) as number[]).slice(1, 4).join(",")));
  const tones = new Set(recipe.palette.slice(1).map((rgb) => [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255].join(",")));
  for (const f of fills) assert.ok(tones.has(f), `fill ${f} is a piece tone`);
});

test("hatching stays inside its piece and its total length is area over spacing", () => {
  const spacing = 4, recipe = recipeOf({ count: 40, family: "polygons", render: "hatch", hatchSpacing: spacing, hatchFollow: true }, 2), packing = shapePackingLayout(recipe);
  const { surface, ops } = recorder();
  drawShapePacking(surface, recipe);
  const union = unionDomains(packing.instances.map((i) => i.region));
  let length = 0, lines = 0;
  for (const op of ops) {
    if (!op.startsWith('["line"')) continue;
    const [, x1, y1, x2, y2] = JSON.parse(op) as number[] & [string];
    length += Math.hypot(x2 - x1, y2 - y1); lines++;
    assert.notEqual(locateInDomain(union, (x1 + x2) / 2, (y1 + y2) / 2), "outside", "a hatch line starts and ends on its piece");
  }
  assert.ok(lines > 200);
  near(length / (packing.placedArea / spacing), 1, 0.06, "Cavalieri: hatch length ≈ area / spacing");
});

test("the packing feeds other techniques: every placed region is a valid planar region of its own id", () => {
  const packing = layoutOf({ count: 30, family: "letters" }, 1);
  for (const i of packing.instances) {
    assert.equal(i.region.id, i.id);
    assert.ok(i.region.regions.every((r, k) => r.id === `${i.id}/${k}`));
    assert.doesNotThrow(() => planarRegion({ outer: i.region.regions[0].outer as unknown as P[], holes: i.region.regions[0].holes as unknown as P[][] }));
    assert.ok(Object.isFrozen(i) && Object.isFrozen(i.region) && Object.isFrozen(i.footprint));
    assert.ok(i.footprint.length >= 1);
  }
  assert.ok(Object.isFrozen(packing) && Object.isFrozen(packing.instances) && Object.isFrozen(packing.unplaced));
});

test("every bundled container packs every family without overlaps (independent Boolean check)", () => {
  const kinds = ["rectangle", "ellipse", "ring", "letter", "leaf"] as const, families = ["letters", "leaves", "blobs", "polygons", "mixed"] as const;
  let placed = 0;
  kinds.forEach((container, k) => {
    const packing = layoutOf({ container, family: families[k], count: 45, rotations: [1, 8, 3, 24, 5][k], gap: [0, 3, 6, 2, 9][k], margin: [0, 5, 2, 8, 4][k], counters: k % 2 ? "open" : "solid", mirror: k === 2 }, 20 + k);
    const list = packing.instances;
    placed += list.length;
    for (let a = 0; a < list.length; a++) {
      near(domainDifference(list[a].region, packing.container).area, 0, 1e-6, `${container}/${list[a].id} inside`);
      for (let b = a + 1; b < list.length; b++) if (boxesTouch(list[a].region, list[b].region, 0)) near(domainIntersection(list[a].region, list[b].region).area, 0, 1e-9, `${container}: ${list[a].id} / ${list[b].id}`);
    }
  });
  assert.ok(placed > 100);
});

test("items are a public value: custom silhouettes pack like bundled ones", () => {
  const star = customShape("star", poly(Array.from({ length: 10 }, (_, i): P => [Math.cos(i * Math.PI / 5) * (i % 2 ? 0.4 : 1), Math.sin(i * Math.PI / 5) * (i % 2 ? 0.4 : 1)])));
  const items: PackItem[] = Array.from({ length: 12 }, (_, k) => customItem(`s${k}`, star, 70 - k * 3, k));
  const packing = packShapes(packContainer({ kind: "ellipse", centerX: 320, centerY: 320, width: 420, height: 420, angle: 0 }), items, rules({ rotations: 10, gap: 2, margin: 3 }));
  assert.equal(packing.instances.length, 12);
  near(star.domain.centroid![0], 0, 1e-12);
  near(Math.max(star.domain.bounds![2] - star.domain.bounds![0], star.domain.bounds![3] - star.domain.bounds![1]), 1, 1e-12);
  assert.equal(star.id, "custom:star");
});
