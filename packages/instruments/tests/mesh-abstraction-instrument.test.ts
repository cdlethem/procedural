import assert from "node:assert/strict";
import test from "node:test";
import {
  abstractionCamera, abstractionViewProducts, boxMesh, bundledMesh, canPrepareInstrument, createInstrument, definition, drawInstrument, drawMeshAbstraction, meshAbstractionComposition,
  meshAbstractionProducts, meshData, prepareInstrument, simplifyMesh, usesSeed, validateInstrument, visibleParameters,
  type CompositionSurface, type DrawingContext, type InstrumentInput, type Mesh, type MeshAbstractionComposition, type PathMaterial, type ProjectedPath,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const ID = "mesh-abstraction";
const make = (params: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput => {
  const input = createInstrument(ID);
  input.seed = seed; input.params = { ...input.params, ...params };
  return input;
};
const recipe = (params: Record<string, number | string | boolean> = {}, seed = 42) => meshAbstractionComposition(make(params, seed));

/** A recording surface that counts what the drawing paints. */
class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  fills: { points: [number, number][]; fill: number[] | null }[] = []; strokes = 0; lines = 0; forbidden: string[] = [];
  private fillColor: number[] | null = [0, 0, 0, 255]; private stack: (number[] | null)[] = []; private shape: [number, number][] = [];
  push() { this.stack.push(this.fillColor); } pop() { this.fillColor = this.stack.pop() ?? this.fillColor; }
  translate() {} rotate() {} scale() {}
  noFill() { this.fillColor = null; } noStroke() {}
  fill(...c: number[]) { this.fillColor = c; } stroke() {} strokeWeight() {} strokeCap() {}
  circle() { this.strokes++; } line() { this.lines++; } rect() { this.forbidden.push("rect"); }
  beginShape() { this.shape = []; } vertex(x: number, y: number) { this.shape.push([x, y]); }
  endShape(mode?: unknown) { if (mode === this.CLOSE && this.fillColor) this.fills.push({ points: this.shape, fill: this.fillColor }); else this.strokes++; }
  background() { this.forbidden.push("background"); }
}
const paint = (r: MeshAbstractionComposition, consumers = {}) => { const s = new Recorder(); drawMeshAbstraction(s, r, consumers); return s; };

test("controls: groups, conditions and validation follow the choices, and hidden values stay valid", () => {
  const item = definition(ID);
  assert.equal(item.title, "Mesh Abstraction");
  const shown = (params: Record<string, number | string | boolean>) => new Set(visibleParameters(ID, make(params).params).map((p) => p.key));
  const sphere = shown({ region: "sphere" });
  for (const key of ["regionX", "regionZ", "regionSize", "falloff", "invert", "highlight", "highlightAmount"]) assert.ok(sphere.has(key), key);
  for (const key of ["regionAxis", "bandFrom", "regionCount", "distance", "ghostLines", "vaseProfile"]) assert.ok(!sphere.has(key), key);
  const none = shown({ region: "none" });
  for (const key of ["regionX", "regionSize", "falloff", "invert", "highlight", "highlightAmount"]) assert.ok(!none.has(key), `${key} has nothing to act on without a region`);
  assert.ok(shown({ region: "band" }).has("bandTo") && shown({ region: "band" }).has("regionAxis") && !shown({ region: "band" }).has("regionSize"));
  assert.ok(shown({ region: "seeded" }).has("regionCount") && shown({ region: "seeded" }).has("regionSize") && !shown({ region: "seeded" }).has("regionX"));
  assert.ok(shown({ projection: "perspective" }).has("distance") && !shown({ projection: "orthographic" }).has("distance"));
  assert.ok(shown({ compare: "ghost" }).has("ghostWeight") && !shown({ compare: "beside" }).has("ghostWeight"));
  assert.ok(shown({ edges: "none" }).has("lineMaterial") === false && shown({ edges: "mesh" }).has("hiddenLines"));
  assert.ok(shown({ facets: "none" }).has("facetOpacity") === false && shown({ facets: "flat" }).has("light") === false && shown({ facets: "shaded" }).has("contrast"));
  assert.ok(shown({ source: "terrain" }).has("boundary") && shown({ source: "vase" }).has("vaseProfile") && !shown({ source: "torus" }).has("boundary"));
  // hidden values keep their meaning: an impossible band under another region is not an error
  assert.doesNotThrow(() => validateInstrument(make({ region: "sphere", bandFrom: 0.9, bandTo: 0.1 })));
  assert.throws(() => validateInstrument(make({ region: "band", bandFrom: 0.9, bandTo: 0.1 })), /Band from \(0\.9\) must not exceed Band to \(0\.1\)/);
  assert.throws(() => validateInstrument(make({ source: "icosphere", detail: 7 })), /Source detail 7 makes an icosphere of 81920 triangles; the limit is 40000; lower Source detail/);
  assert.throws(() => validateInstrument(make({ source: "figure", detail: 7 })), /too fine for the figure's head/);
  assert.doesNotThrow(() => validateInstrument(make({ source: "terrain", detail: 7 })));
});

test("the seed rerolls only what uses it: terrain heights and seeded regions", () => {
  assert.equal(usesSeed(make({ source: "terrain" })), true);
  assert.equal(usesSeed(make({ source: "vase", region: "sphere" })), false);
  assert.equal(usesSeed(make({ source: "vase", region: "seeded" })), true);
  const print = (params: Record<string, number | string | boolean>, seed: number) => drawFingerprint(make(params, seed));
  assert.notEqual(print({}, 1), print({}, 2), "terrain seeds differ structurally");
  const vase = { source: "vase", detail: 3, region: "sphere" };
  assert.equal(print(vase, 1), print(vase, 2), "a vase with a fixed region ignores the seed");
  const seeded = { source: "vase", detail: 3, region: "seeded", regionCount: 3 };
  assert.notEqual(print(seeded, 1), print(seeded, 2), "seeded regions move with the seed");
});

test("camera, appearance and structure are separate stages: only a structural edit rebuilds the abstraction", () => {
  const base = recipe();
  const products = meshAbstractionProducts(base);
  // camera edits
  for (const view of [{ yaw: 80 }, { pitch: 5 }, { roll: 30 }, { projection: "perspective" }, { size: 300 }, { centerX: 100 }]) {
    assert.equal(meshAbstractionProducts(recipe(view)).abstraction, products.abstraction, `${JSON.stringify(view)} must not rebuild the abstraction`);
  }
  // appearance edits
  for (const look of [{ facets: "flat" }, { edges: "outline" }, { lineMaterial: "stitch" }, { highlight: "off" }, { contrast: 0.2 }, { compare: "beside" }, { light: 10 }, { facetOpacity: 0.5 }]) {
    assert.equal(meshAbstractionProducts(recipe(look)).abstraction, products.abstraction, `${JSON.stringify(look)} must not rebuild the abstraction`);
  }
  const r2 = meshAbstractionComposition({ ...make(), palette: [1, 2, 3, 4] });
  assert.equal(meshAbstractionProducts(r2).abstraction, products.abstraction, "the palette never reaches the construction");
  // view products: same camera and selection, new palette: same object; new camera: new object
  const cam = abstractionCamera(products.source, base.view);
  const spec = { paint: true, edges: "mesh", outlineAngle: 35, importance: null, importanceKey: "" } as const;
  const first = abstractionViewProducts(products.abstraction.mesh, cam, spec);
  assert.equal(abstractionViewProducts(products.abstraction.mesh, abstractionCamera(products.source, { ...base.view }), spec), first);
  assert.notEqual(abstractionViewProducts(products.abstraction.mesh, abstractionCamera(products.source, { ...base.view, yaw: 99 }), spec), first);
  // structural edit: another facet count continues the same construction; a region change is a new construction
  const fewer = meshAbstractionProducts(recipe({ keep: 0.03 })).abstraction, more = meshAbstractionProducts(recipe({ keep: 0.2 })).abstraction;
  assert.equal(fewer.snapshots.construction, products.abstraction.snapshots.construction);
  assert.equal(more.snapshots.construction, products.abstraction.snapshots.construction);
  assert.ok(fewer.faces < products.abstraction.faces && products.abstraction.faces < more.faces);
  assert.notEqual(meshAbstractionProducts(recipe({ regionSize: 0.3 })).abstraction.snapshots.construction, products.abstraction.snapshots.construction);
  assert.notEqual(meshAbstractionProducts(recipe({ rule: "length" })).abstraction.snapshots.construction, products.abstraction.snapshots.construction);
});

test("`Facets kept` counts the triangles outside the protected region: the protected ones always stay", () => {
  const r = recipe({ source: "icosphere", detail: 4, keep: 0.1, region: "sphere", regionX: 0.5, regionY: 0.5, regionZ: 1, regionSize: 0.2, falloff: 0.1 });
  const p = meshAbstractionProducts(r), T = p.source.triangleCount;
  let protectedCount = 0;
  const tri = meshData(p.source).triangles;
  for (let t = 0; t < tri.length; t += 3) if (tri.slice(t, t + 3).every((v: number) => p.sourceImportance[v] >= 1)) protectedCount++;
  assert.ok(protectedCount > 100 && protectedCount < T / 2);
  assert.equal(p.targetFaces, protectedCount + Math.round(0.1 * (T - protectedCount)));
  assert.equal(p.abstraction.faces, p.targetFaces);
  const keepAll = meshAbstractionProducts({ ...r, construction: { ...r.construction, keep: 1 } });
  assert.equal(keepAll.abstraction.faces, T, "keep 1 is the source untouched");
});

/** Ray from `point` toward the eye against every triangle; the distance of the nearest hit strictly in front of the point, or Infinity. */
function nearestOccluder(mesh: Mesh, eye: readonly number[] | null, direction: readonly number[], point: readonly number[], tolerance: number): number {
  const d = meshData(mesh), p = d.positions, t = d.triangles;
  let dir = direction;
  if (eye) { const v = [eye[0] - point[0], eye[1] - point[1], eye[2] - point[2]], l = Math.hypot(v[0], v[1], v[2]); dir = [v[0] / l, v[1] / l, v[2] / l]; }
  let best = Infinity;
  for (let i = 0; i < t.length; i += 3) {
    const a = [p[t[i] * 3], p[t[i] * 3 + 1], p[t[i] * 3 + 2]], b = [p[t[i + 1] * 3], p[t[i + 1] * 3 + 1], p[t[i + 1] * 3 + 2]], c = [p[t[i + 2] * 3], p[t[i + 2] * 3 + 1], p[t[i + 2] * 3 + 2]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const h = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-14) continue;
    const s = [point[0] - a[0], point[1] - a[1], point[2] - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const distance = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (distance > tolerance && distance < best) best = distance;
  }
  return best;
}

test("hidden-line edges of the ABSTRACTED mesh respect occlusion: visible samples see the eye, hidden ones do not (both projections)", () => {
  for (const projection of ["orthographic", "perspective"] as const) {
    const r = recipe({ source: "icosphere", detail: 4, keep: 0.06, region: "none", projection, yaw: 33, pitch: 24, edges: "mesh", hiddenLines: "faint", distance: 2.4 });
    const { source, abstraction } = meshAbstractionProducts(r);
    const cam = abstractionCamera(source, r.view);
    const view = abstractionViewProducts(abstraction.mesh, cam, { paint: false, edges: "mesh", outlineAngle: 0, importance: null, importanceKey: "" });
    let visible = 0, hidden = 0;
    const sample = (path: ProjectedPath, i: number): [number, number, number] => {
      const a = cam.unproject(path.points[i][0], path.points[i][1], path.depths[i]), b = cam.unproject(path.points[i + 1][0], path.points[i + 1][1], path.depths[i + 1]);
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    };
    for (const path of view.paths) for (let i = 0; i + 1 < path.points.length; i++) {
      if (Math.hypot(path.points[i + 1][0] - path.points[i][0], path.points[i + 1][1] - path.points[i][1]) < 1) continue;
      const point = sample(path, i);
      const hit = nearestOccluder(abstraction.mesh, projection === "perspective" ? cam.eye : null, [-cam.forward[0], -cam.forward[1], -cam.forward[2]], point, 1e-6);
      if (path.visible) { visible++; assert.equal(hit, Infinity, `${projection}: a visible edge is covered`); } else { hidden++; assert.ok(hit < Infinity, `${projection}: a hidden edge is in the open`); }
    }
    assert.ok(visible > 20 && hidden > 20, `${projection}: ${visible} visible, ${hidden} hidden runs`);
  }
});

test("painter order covers exactly the camera-facing facets of a closed abstraction, each drawn once", () => {
  const r = recipe({ source: "icosphere", detail: 4, keep: 0.06, region: "none", yaw: 20, pitch: 30, edges: "none" });
  const { source, abstraction } = meshAbstractionProducts(r), cam = abstractionCamera(source, r.view);
  const d = meshData(abstraction.mesh), p = d.positions;
  let facing = 0;
  for (let i = 0; i < d.triangles.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => [p[d.triangles[i + k] * 3], p[d.triangles[i + k] * 3 + 1], p[d.triangles[i + k] * 3 + 2]]);
    const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    if (-(n[0] * cam.forward[0] + n[1] * cam.forward[1] + n[2] * cam.forward[2]) > 0) facing++;
  }
  const s = paint(r);
  assert.equal(s.fills.length, facing, "one polygon per front-facing facet");
  assert.deepEqual(s.forbidden, [], "a layer paints no background and no full-canvas rectangle");
  const view = abstractionViewProducts(abstraction.mesh, cam, { paint: true, edges: "none", outlineAngle: 0, importance: null, importanceKey: "" });
  assert.equal(view.paint!.order.length, facing);
});

test("an edge-only drawing is a real drawing: no fills, hidden edges dropped, faint or dashed on request", () => {
  const edges = paint(recipe({ facets: "none", edges: "mesh", hiddenLines: "drop", region: "none", source: "icosphere", detail: 4 }));
  assert.equal(edges.fills.length, 0);
  assert.ok(edges.strokes > 30);
  const faint = paint(recipe({ facets: "none", edges: "mesh", hiddenLines: "faint", region: "none", source: "icosphere", detail: 4 })), dashed = paint(recipe({ facets: "none", edges: "mesh", hiddenLines: "dashed", region: "none", source: "icosphere", detail: 4 }));
  assert.ok(faint.strokes > edges.strokes && dashed.strokes + dashed.lines > edges.strokes + edges.lines);
  const outline = paint(recipe({ facets: "none", edges: "outline", region: "none", source: "icosphere", detail: 4 }));
  assert.ok(outline.strokes > 0 && outline.strokes < edges.strokes, "the outline is a subset of the edges");
  const nothing = paint(recipe({ facets: "none", edges: "none" }));
  assert.equal(nothing.fills.length + nothing.strokes + nothing.lines, 0);
});

test("compare: the ghost adds the source's edges, side by side draws both, and the layer still paints no background", () => {
  const plain = paint(recipe({ region: "none", edges: "none", facets: "none" }));
  assert.equal(plain.strokes, 0);
  const ghost = paint(recipe({ region: "none", edges: "none", facets: "none", compare: "ghost", ghostLines: "mesh" }));
  assert.ok(ghost.strokes > 100, "the source has many more edges than the abstraction");
  const beside = paint(recipe({ region: "none", compare: "beside", edges: "outline" }));
  const alone = paint(recipe({ region: "none", edges: "outline" }));
  assert.ok(beside.fills.length > alone.fills.length, "both meshes are painted");
  const xs = beside.fills.flatMap((f) => f.points.map((q) => q[0]));
  assert.ok(Math.min(...xs) < 200 && Math.max(...xs) > 440 && beside.forbidden.length === 0);
});

test("consumers replace the stock facet painter and edge material with ordinary callbacks", () => {
  const r = recipe({ region: "sphere", edges: "mesh" });
  const facets: number[] = [], seen = { lines: 0 };
  const line: PathMaterial = (_surface, path) => { seen.lines += path.points.length > 1 ? 1 : 0; };
  const s = new Recorder();
  drawMeshAbstraction(s, r, { facet: (_surface, f) => { facets.push(f.importance); }, line });
  assert.equal(s.fills.length, 0, "the stock painter is replaced");
  assert.ok(facets.length > 20 && facets.every((w) => w >= 0 && w <= 1) && facets.some((w) => w === 1) && facets.some((w) => w < 0.5));
  assert.ok(seen.lines > 20);
});

test("the highlight and the region really change what is drawn; with no region they do not", () => {
  const print = (params: Record<string, number | string | boolean>) => drawFingerprint(make(params));
  assert.notEqual(print({ highlight: "tint" }), print({ highlight: "off" }));
  assert.notEqual(print({ highlight: "lines" }), print({ highlight: "off" }));
  assert.notEqual(print({ region: "sphere" }), print({ region: "none" }));
  assert.notEqual(print({ invert: true }), print({ invert: false }));
  assert.equal(print({ region: "none", highlight: "tint" }), print({ region: "none", highlight: "off" }), "nothing to highlight without a region");
});

test("preparation is cooperative: cancellation publishes nothing and a completed one is reused by the drawing", async () => {
  assert.equal(canPrepareInstrument(ID), true);
  const input = make({ source: "icosphere", detail: 4, keep: 0.11, region: "none" }, 3);
  assert.equal(await prepareInstrument(input, () => true), false);
  assert.equal(await prepareInstrument(input, () => false), true);
  const r = meshAbstractionComposition(input), a = meshAbstractionProducts(r).abstraction;
  assert.equal(meshAbstractionProducts(r).abstraction, a);
  const s = new Recorder();
  drawInstrument(s as unknown as DrawingContext, input);
  assert.ok(s.fills.length > 0);
});

test("a resolved mesh is accepted by the direct API: a cube shows its nine visible edges and hides three, with analytic projected lengths", () => {
  const cube = boxMesh([2, 2, 2]);
  const r: MeshAbstractionComposition = { ...recipe({ region: "none", keep: 1, edges: "outline", facets: "none", projection: "orthographic", yaw: 30, pitch: 25 }), source: cube };
  const p = meshAbstractionProducts(r);
  assert.equal(p.abstraction.faces, 12, "12 triangles, nothing collapsed");
  const cam = abstractionCamera(p.source, r.view);
  const view = abstractionViewProducts(p.abstraction.mesh, cam, { paint: false, edges: "outline", outlineAngle: 30, importance: null, importanceKey: "" });
  const length = (paths: readonly ProjectedPath[]) => paths.reduce((sum, path) => sum + path.points.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - path.points[i][0], q[1] - path.points[i][1]), 0), 0);
  // the outline of a cube is its 12 edges; an edge shows unless both faces along it turn away from the eye
  const toEye = [-cam.forward[0], -cam.forward[1], -cam.forward[2]];
  let expectedVisible = 0, expectedHidden = 0, hiddenEdges = 0;
  for (let axis = 0; axis < 3; axis++) for (const sb of [-1, 1]) for (const sc of [-1, 1]) {
    const [b, c] = [0, 1, 2].filter((k) => k !== axis), p0 = [0, 0, 0], p1 = [0, 0, 0];
    p0[axis] = -1; p1[axis] = 1; p0[b] = p1[b] = sb; p0[c] = p1[c] = sc;
    const a = cam.project(p0 as [number, number, number])!, z = cam.project(p1 as [number, number, number])!, edge = Math.hypot(a.x - z.x, a.y - z.y);
    if (sb * toEye[b] > 0 || sc * toEye[c] > 0) expectedVisible += edge; else { expectedHidden += edge; hiddenEdges++; }
  }
  assert.equal(hiddenEdges, 3);
  near(length(view.paths.filter((x) => x.visible)), expectedVisible, 1e-9);
  near(length(view.paths.filter((x) => !x.visible)), expectedHidden, 1e-9);
});

function near(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}
