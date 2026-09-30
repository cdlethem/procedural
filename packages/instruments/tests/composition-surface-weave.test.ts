import assert from "node:assert/strict";
import test from "node:test";
import {
  camera, createInstrument, definition, drawInstrument, orderCrossings, projectWeave, surfaceWeaveComposition, surfaceWeaveProducts, surfaceWeaveStrands, surfaceWeaveView, terrainMesh,
  validateInstrument, visibleParameters, weaveCamera, weavePieces, type CompositionSurface, type InstrumentInput, type Mesh, type SurfaceWeaveComposition,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const ID = "surface-weave";
const input = (params: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput => {
  const value = createInstrument(ID);
  value.seed = seed;
  Object.assign(value.params, params);
  return value;
};
const recipe = (params: Record<string, number | string | boolean> = {}, seed = 42): SurfaceWeaveComposition => surfaceWeaveComposition(input(params, seed));
const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const flatSheet = (): Mesh => terrainMesh({ width: 4, depth: 4, columns: 20, rows: 20, height: () => 0 });
/** Threads along x and z on the flat sheet, seen straight down through an orthographic camera. */
const overhead = (extra: Record<string, number | string | boolean> = {}) =>
  recipe({ flow: "plane", flowAngle: 90, angle: 0, cross: 90, swirl: 0, density: "none", spacing: 0.05, style: "solid", model: "none", projection: "orthographic", pitch: 90, yaw: 0, roll: 0, size: 500, shade: "none", ...extra });

test("the camera never changes the mesh, strands, crossings or over/under order", () => {
  const first = surfaceWeaveProducts(recipe({ yaw: 30, pitch: 16 }));
  for (const view of [{ yaw: -70, pitch: 5 }, { yaw: 120, pitch: 60 }, { yaw: 0, pitch: -30, projection: "orthographic" }, { yaw: 30, pitch: 16, distance: 1.2 }, { yaw: 30, pitch: 16, roll: 40, size: 300 }]) {
    const other = surfaceWeaveProducts(recipe(view));
    assert.equal(other.strands, first.strands, "the very same frozen strands");
    assert.equal(other.crossings, first.crossings);
    assert.equal(other.mesh, first.mesh);
    assert.deepEqual(other.order.over, first.order.over);
    assert.deepEqual(surfaceWeaveView(recipe(view), other).projected.set.crossings.map((c) => c.id), first.crossings.map((c) => c.id), "the canvas table keeps every id in the same order");
  }
  // ... but a structural edit does change them, and only a structural edit.
  assert.notEqual(surfaceWeaveProducts(recipe({ spacing: 0.06 })).strands, first.strands);
  assert.equal(surfaceWeaveProducts(recipe({ colorA: 3, veilColor: 2, shade: "depth", casing: 2 })).strands, first.strands);
  assert.equal(surfaceWeaveProducts(recipe({ rule: "seeded" })).strands, first.strands, "the rule changes the order only");
  assert.notDeepEqual(surfaceWeaveProducts(recipe({ rule: "seeded" })).order.over, first.order.over);
});

test("appearance edits reuse the projection; width edits reuse it and recut only the pieces; the camera recomputes both", () => {
  const base = recipe(), products = surfaceWeaveProducts(base), view = surfaceWeaveView(base, products);
  const shaded = surfaceWeaveView(recipe({ shade: "depth", shadeAmount: 0.9, colorA: 4, coloring: "strands" }), products);
  assert.equal(shaded.projected, view.projected);
  assert.equal(shaded.pieces, view.pieces, "colour and shading are drawn from the cached fragments");
  const wider = surfaceWeaveView(recipe({ width: 0.7 }), products);
  assert.equal(wider.projected, view.projected);
  assert.notEqual(wider.pieces, view.pieces);
  const moved = surfaceWeaveView(recipe({ yaw: 75 }), products);
  assert.notEqual(moved.projected, view.projected);
  assert.equal(surfaceWeaveView(base, products).projected, view.projected, "returning to the first camera hits the cache");
});

test("gaps in the under thread are exactly (over + under) / (2 sin) + clearance each side, in canvas units", () => {
  const r = overhead({ width: 0.4, clearance: 2, section: "round" }), products = surfaceWeaveProducts(r, flatSheet()), view = surfaceWeaveView(r, products);
  const zoom = r.view.size / Math.hypot(4, 4, 0), width = 0.4 * products.spacing * zoom;
  assert.ok(view.pieces.strands.gaps.length > 20);
  for (const gap of view.pieces.strands.gaps) near(gap.to - gap.from, 2 * (width + 2), 1e-9);
  // and the pieces of one thread stop and restart exactly at those gaps
  // each gap is centred on its crossing: the under strand's canvas point at the gap's middle is the projected crossing
  const at = (strand: number, arc: number) => {
    const { points } = view.projected.strands[strand].path;
    let run = 0;
    for (let k = 1; k < points.length; k++) {
      const l = Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]);
      if (run + l >= arc) return [points[k - 1][0] + (points[k][0] - points[k - 1][0]) * (arc - run) / l, points[k - 1][1] + (points[k][1] - points[k - 1][1]) * (arc - run) / l];
      run += l;
    }
    return points[points.length - 1];
  };
  const camera = weaveCamera(products.mesh, r.view);
  for (const gap of view.pieces.strands.gaps) {
    const crossing = products.crossings.find((c) => c.id === gap.crossing)!, canvas = camera.project(crossing.position)!, middle = at(gap.path, (gap.from + gap.to) / 2);
    near(middle[0], canvas.x, 1e-6); near(middle[1], canvas.y, 1e-6);
  }
  const byStrand = new Map<number, typeof view.pieces.visible[number][]>();
  for (const piece of view.pieces.visible) byStrand.set(piece.source, [...(byStrand.get(piece.source) ?? []), piece]);
  const strand = [...byStrand.values()].find((list) => list.length > 3)!;
  const lengths = (piece: typeof strand[number]) => piece.points.slice(1).reduce((sum, p, k) => sum + Math.hypot(p[0] - piece.points[k][0], p[1] - piece.points[k][1]), 0);
  strand.sort((a, b) => a.start - b.start);
  for (let k = 1; k < strand.length; k++) near(strand[k].start - (strand[k - 1].start + lengths(strand[k - 1])), 2 * (width + 2), 1e-6);
});

test("perspective thread width is share x spacing x scale at the strand's own mean depth", () => {
  const r = recipe({ density: "none", section: "round", style: "solid", projection: "perspective", distance: 1.6, width: 0.5 }), products = surfaceWeaveProducts(r), view = surfaceWeaveView(r, products);
  const cam = weaveCamera(products.mesh, r.view), widths = view.pieces.widths;
  products.strands.forEach((strand, i) => {
    let depth = 0;
    for (const p of strand.points) depth += cam.project(p)!.depth;
    depth /= strand.points.length;
    near(widths[i], 0.5 * strand.spacing * cam.scaleAt(depth), 1e-9);
    near(strand.spacing, products.spacing, 1e-9 * products.spacing);
  });
  const nearest = widths.indexOf(Math.max(...widths)), farthest = widths.indexOf(Math.min(...widths));
  assert.ok(widths[nearest] > 1.1 * widths[farthest], "perspective really varies the width");
});

test("a sphere hides its far half: visible fragments are in front of the centre, hidden ones behind, and half the length is hidden", () => {
  const r = recipe({ surface: "sphere", cap: 180, detail: 4, density: "none", spacing: 0.07, projection: "orthographic", hidden: "faint", yaw: 25, pitch: 20 });
  const products = surfaceWeaveProducts(r), view = surfaceWeaveView(r, products), cam = weaveCamera(products.mesh, r.view);
  // The mesh's silhouette is polyhedral: a front-facing facet may reach one edge length (1.05 / 2^levels) past the limb plane.
  const centre = cam.project([0, 0, 0])!.depth, facet = 1.05 / 16;
  assert.ok(view.pieces.visible.length > 100 && view.pieces.hidden.length > 100);
  for (const piece of view.pieces.visible) assert.ok(piece.depth <= centre + facet, `visible fragment ${piece.id} behind the centre`);
  for (const piece of view.pieces.hidden) assert.ok(piece.depth >= centre - facet, `hidden fragment ${piece.id} in front of the centre`);
  const { hiddenLength, visibleLength } = view.projected.stats;
  assert.ok(Math.abs(hiddenLength / (hiddenLength + visibleLength) - 0.5) < 0.06, `hidden share ${hiddenLength / (hiddenLength + visibleLength)}`);
  // crossings well on the back (more than about 7 degrees past the limb, clear of the polyhedral silhouette) are not visible, well on the front they are
  const eye = cam.viewDirection([0, 0, 0]);
  view.projected.set.crossings.forEach((c, i) => {
    const p = products.crossings[i].position, front = p[0] * eye[0] + p[1] * eye[1] + p[2] * eye[2] > 0.12, back = p[0] * eye[0] + p[1] * eye[1] + p[2] * eye[2] < -0.12;
    if (front) assert.equal(view.projected.visibleCrossing[c.index], 1, "a crossing facing the eye is visible");
    if (back) assert.equal(view.projected.visibleCrossing[c.index], 0, "a crossing on the far side is hidden");
  });
});

test("alternation is exact: breaks are the equal-state neighbours, and only the ring seams and dislocations remain", () => {
  const r = recipe({ density: "none", spacing: 0.06 }), products = surfaceWeaveProducts(r), { order, crossings, strands } = products;
  const state = (strand: number, crossing: number) => {
    const c = crossings[crossing], side = c.first.strand === strand ? 0 : 1;
    return order.over[crossing] === side ? 1 : 0;
  };
  const along = strands.map(() => [] as { s: number; crossing: number }[]);
  for (const c of crossings) { along[c.first.strand].push({ s: c.first.s, crossing: c.index }); along[c.second.strand].push({ s: c.second.s, crossing: c.index }); }
  let equal = 0, seams = 0;
  along.forEach((list, strand) => {
    list.sort((a, b) => a.s - b.s);
    for (let k = 1; k < list.length; k++) if (state(strand, list[k].crossing) === state(strand, list[k - 1].crossing)) equal++;
    if (strands[strand].closed && list.length >= 2 && state(strand, list[0].crossing) === state(strand, list[list.length - 1].crossing)) seams++;
  });
  assert.equal(order.breaks.length, equal);
  assert.equal(products.seams.length, seams);
  assert.ok(products.seams.every((seam) => strands[seam.strand].closed));
  assert.ok(equal < 0.4 * crossings.length, "the weave is mostly alternating");
  const chains = orderCrossings(products.set, { ...products.orderOptions, solve: "chains" });
  assert.ok(order.breaks.length < 0.9 * chains.breaks.length, `the chosen solve leaves ${order.breaks.length} contradictions where the chain solve leaves ${chains.breaks.length}`);
  const total = crossings.length;
  const aOver = crossings.filter((c) => (order.over[c.index] === 0) === (strands[c.first.strand].family === 0)).length;
  assert.ok(Math.abs(aOver / total - 0.5) < 0.15, "neither family is over everywhere");
  // Invert is the exact mirror; Exceptions reverse exactly the listed crossings; rank puts family B over everywhere.
  const mirrored = surfaceWeaveProducts(recipe({ density: "none", spacing: 0.06, invert: true }));
  assert.ok(mirrored.order.over.every((v, i) => v !== order.over[i]));
  const flipped = surfaceWeaveProducts(recipe({ density: "none", spacing: 0.06, exceptions: "3, 5-6" }));
  assert.deepEqual(flipped.order.over.map((v, i) => (v !== order.over[i] ? i + 1 : 0)).filter(Boolean), [3, 5, 6]);
  const rank = surfaceWeaveProducts(recipe({ density: "none", spacing: 0.06, rule: "rank" }));
  assert.ok(crossings.every((c) => (rank.order.over[c.index] === 0) === (strands[c.first.strand].family === 1)), "family B is over at every crossing");
  assert.throws(() => surfaceWeaveProducts(recipe({ exceptions: "99999" })), /Exceptions: crossing 99999 does not exist/);
});

test("a flat ribbon foreshortens exactly as a strip lying in the surface: half width x zoom x sin(pitch) across a strand along x", () => {
  for (const pitch of [90, 60, 30]) {
    const r = overhead({ section: "flat", width: 0.5, pitch, style: "cased" }), products = surfaceWeaveProducts(r, flatSheet()), view = surfaceWeaveView(r, products);
    const zoom = r.view.size / Math.hypot(4, 4), half = 0.5 * products.spacing / 2;
    // family A runs along x; its lateral direction is z, which the view axis foreshortens by sin(pitch)
    const fragment = view.pieces.visible.find((piece) => piece.family === 0 && piece.lateral)!;
    for (let k = 0; k < fragment.points.length; k++) near(Math.hypot(fragment.lateral![k * 2], fragment.lateral![k * 2 + 1]), half * zoom * Math.sin(pitch * Math.PI / 180), 1e-9);
    // family B (along z) has lateral x, which the view never foreshortens
    const other = view.pieces.visible.find((piece) => piece.family === 1 && piece.lateral)!;
    near(Math.hypot(other.lateral![0], other.lateral![1]), half * zoom, 1e-9);
  }
});

test("a strand nearer than the perspective near plane is an error, never a picture with a hole", () => {
  const r = overhead(), products = surfaceWeaveProducts(r, flatSheet());
  assert.throws(() => projectWeave(products, camera({ projection: "perspective", distance: 30, near: 31, target: [0, 0, 0], pitch: 90, zoom: 100 })), /near plane/);
});

test("the instrument validates its work bound from the controls and names them", () => {
  assert.throws(() => validateInstrument(input({ spacing: 0.012, spacingB: 0.25 })), /Thread spacing/);
  assert.throws(() => validateInstrument(input({ exceptions: "1, x" })), /Exceptions/);
  validateInstrument(input({ spacing: 0.012 }));
});

/* ------------------------------------------------- hidden controls change nothing */

const random = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 0x100000000; };

test("changing a hidden control never changes the drawing (seeded random configurations)", () => {
  const next = random(11), def = definition(ID);
  let checked = 0;
  for (let round = 0; round < 6; round++) {
    const params: Record<string, number | string | boolean> = { ...def.defaults, detail: 2, spacing: 0.07 + 0.03 * next() };
    for (const p of def.parameters) {
      if (p.key === "detail" || p.key === "spacing") continue;
      if (p.type === "select") params[p.key] = p.options![Math.floor(next() * p.options!.length)].value;
      else if (p.type === "boolean") params[p.key] = next() < 0.5;
      else if (p.type === "number" && !["spacingB"].includes(p.key)) params[p.key] = p.integer ? Math.round(p.min! + next() * (p.max! - p.min!)) : Math.round((p.min! + next() * (p.max! - p.min!)) / (p.step ?? 1)) * (p.step ?? 1);
    }
    const base = input(params, 5 + round), shown = new Set(visibleParameters(ID, base.params).map((p) => p.key)), baseline = drawFingerprint(base);
    const hidden = def.parameters.filter((p) => !shown.has(p.key));
    for (const p of hidden) {
      const changed = { ...params };
      if (p.type === "select") changed[p.key] = p.options!.find((o) => o.value !== params[p.key])!.value;
      else if (p.type === "boolean") changed[p.key] = !params[p.key];
      else if (p.type === "number") changed[p.key] = params[p.key] === p.max ? p.min! : p.max!;
      assert.equal(drawFingerprint(input(changed, 5 + round)), baseline, `round ${round}: hidden control ${p.key} changed the drawing`);
      checked++;
    }
  }
  assert.ok(checked >= 40, `${checked} hidden-control changes checked`);
});

test("with the model not drawn, its outline weight and veil settings change nothing; drawn, they do", () => {
  const base = { model: "none", outlineWeight: 1.2 }, none = drawFingerprint(input(base));
  assert.equal(drawFingerprint(input({ ...base, outlineWeight: 3 })), none);
  assert.equal(drawFingerprint(input({ ...base, veilOpacity: 0.9, veilColor: 2 })), none);
  assert.notEqual(drawFingerprint(input({ model: "outline", outlineWeight: 3 })), drawFingerprint(input({ model: "outline", outlineWeight: 1.2 })));
  assert.notEqual(drawFingerprint(input({ model: "veil" })), drawFingerprint(input({ model: "outline" })));
});

test("the drawing is deterministic, seed dependent and transparent (no full-canvas fill)", () => {
  const a = drawFingerprint(input({}, 3)), b = drawFingerprint(input({}, 3)), c = drawFingerprint(input({}, 4));
  assert.equal(a, b);
  assert.notEqual(a, c, "the seed positions the threads");
  const calls: string[] = [];
  const surface = new Proxy({ CLOSE: 1, ROUND: 1 } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : (...args: unknown[]) => { calls.push(k === "rect" ? `rect ${args.join(",")}` : k); }) });
  drawInstrument(surface as unknown as CompositionSurface & Parameters<typeof drawInstrument>[0], input({}, 3));
  assert.ok(!calls.some((c) => c.startsWith("rect") || c === "background"), "a study layer draws no rectangle and no background");
  assert.ok(calls.filter((c) => c === "endShape").length > 100);
});
