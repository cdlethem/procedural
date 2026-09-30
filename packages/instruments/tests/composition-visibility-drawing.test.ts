import assert from "node:assert/strict";
import test from "node:test";
import {
  assemblyMesh, boxMesh, camera, creaseCurvesExcluding, createInstrument, cueBin, cueFactor, definition, depthRange, drawInstrument, icosphereMesh, inspectorItems,
  mergeMeshes, meanCurvature, meshComponents, meshData, meshTopology, meshVertex, paintedFaces, splitByDepth, toneDarkness, tonedHatch, torusMesh, transformMesh, usesSeed,
  validateInstrument, viewCamera, visibleParameters, visibilityConstructionCounts, visibilityContourCurves, visibilityCreaseEdges, visibilityDrawingComposition, visibilityEdgeCurves,
  visibilityMesh, visibilityProducts, visibilitySectionCurves, visibilitySilhouetteEdges, VISIBILITY_LIMITS, MAX_HATCH_SEGMENTS,
  type Camera, type CompositionSurface, type Mesh, type VisibilityProducts, type ProjectedPath, type Vec3,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const ID = "visibility-drawing";
const input = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const value = createInstrument(ID);
  value.seed = seed;
  value.params = { ...value.params, ...params };
  validateInstrument(value);
  return value;
};
const recipeOf = (params: Record<string, number | string | boolean> = {}, seed = 42) => visibilityDrawingComposition(input(params, seed));
const products = (params: Record<string, number | string | boolean> = {}, seed = 42) => visibilityProducts(recipeOf(params, seed));
const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const counts = () => ({ ...visibilityConstructionCounts });
const delta = (before: ReturnType<typeof counts>) => Object.fromEntries(Object.entries(visibilityConstructionCounts).map(([k, v]) => [k, v - (before as Record<string, number>)[k]])) as Record<string, number>;

// ---- an independent triangulation and ray caster (Moller-Trumbore), used to check occlusion without the library's solver
function triangulate(m: Mesh): { p: Float64Array; t: number[] } {
  const data = meshData(m), p = data.positions, t = [...data.triangles];
  const d = (a: number, b: number) => Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
  for (let i = 0; i < data.quads.length; i += 4) {
    const [a, b, c, e] = data.quads.slice(i, i + 4);
    if (d(a, c) <= d(b, e)) t.push(a, b, c, a, c, e); else t.push(a, b, e, b, c, e);
  }
  return { p, t };
}
/** Nearest triangle hit along the ray that lies in front of the origin by more than `tolerance` measured perpendicular to the triangle (the solver's rule). */
function firstHit(tri: { p: Float64Array; t: number[] }, origin: readonly number[], dir: readonly number[], tolerance: number, maxT: number): number | null {
  const { p, t } = tri;
  let best: number | null = null;
  for (let i = 0; i < t.length; i += 3) {
    const [a, b, c] = [t[i] * 3, t[i + 1] * 3, t[i + 2] * 3];
    const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const h = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-14) continue;
    const s = [origin[0] - p[a], origin[1] - p[a + 1], origin[2] - p[a + 2]];
    const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const hit = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    const perpendicular = hit * Math.abs(det) / Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
    if (hit > 0 && perpendicular > tolerance && hit < maxT && (best === null || hit < best)) best = hit;
  }
  return best;
}
/** The 3D point of a projected path's segment midpoint (perspective-correct depth) and whether anything lies between it and the eye. */
function samples(path: ProjectedPath, view: Camera): Vec3[] {
  const perspective = view.options.projection === "perspective", out: Vec3[] = [];
  for (let i = 1; i < path.points.length; i++) {
    const [x0, y0] = path.points[i - 1], [x1, y1] = path.points[i], z0 = path.depths[i - 1], z1 = path.depths[i];
    if (Math.hypot(x1 - x0, y1 - y0) < 1e-3) continue; // slivers under a thousandth of a canvas unit have no sampleable interior
    const z = perspective ? 1 / (0.5 / z0 + 0.5 / z1) : (z0 + z1) / 2;
    out.push(view.unproject((x0 + x1) / 2, (y0 + y1) / 2, z));
  }
  return out;
}
/** Is a surface nearer to the eye than the point by more than `margin` times the solver's tolerance (1e-6 of the bounds diagonal)? */
function covered(tri: ReturnType<typeof triangulate>, view: Camera, diagonal: number, point: Vec3, margin: number): boolean {
  const perspective = view.options.projection === "perspective";
  const dir = perspective ? view.viewDirection(point) : [-view.forward[0], -view.forward[1], -view.forward[2]];
  const maxT = perspective ? Math.hypot(view.eye[0] - point[0], view.eye[1] - point[1], view.eye[2] - point[2]) : Infinity;
  return firstHit(tri, point, dir, margin * 1e-6 * diagonal, maxT) !== null;
}

// ---- a recording surface
interface Recorded { op: string; args: number[]; weight: number; stroke: number[]; fill: number[] }
function recorder(): { surface: CompositionSurface; log: Recorded[] } {
  const log: Recorded[] = [];
  let weight = 1, stroke: number[] = [0, 0, 0, 255], fill: number[] = [0, 0, 0, 255];
  const stack: [number, number[], number[]][] = [];
  let vertices: number[] = [];
  const surface: CompositionSurface = {
    CLOSE: "close", ROUND: "round",
    push: () => { stack.push([weight, stroke, fill]); }, pop: () => { [weight, stroke, fill] = stack.pop()!; },
    translate() { throw new Error("unexpected translate"); }, rotate() {}, scale() {},
    noFill: () => { fill = []; }, noStroke: () => { stroke = []; },
    fill: (...c: number[]) => { fill = c.length === 3 ? [...c, 255] : c; }, stroke: (...c: number[]) => { stroke = c.length === 3 ? [...c, 255] : c; },
    strokeWeight: (w: number) => { weight = w; }, strokeCap() {},
    circle: (x: number, y: number, d: number) => { log.push({ op: "circle", args: [x, y, d], weight, stroke, fill }); },
    line: (a: number, b: number, c: number, d: number) => { log.push({ op: "line", args: [a, b, c, d], weight, stroke, fill }); },
    rect() {}, beginShape: () => { vertices = []; }, vertex: (x: number, y: number) => { vertices.push(x, y); },
    endShape: () => { log.push({ op: "shape", args: vertices, weight, stroke, fill }); },
  };
  return { surface, log };
}
function draw(params: Record<string, number | string | boolean> = {}, seed = 42): Recorded[] {
  const { surface, log } = recorder();
  // translate is used by stitches and beads (atEach); accept it as a frame change
  (surface as { translate: unknown }).translate = () => {};
  drawInstrument(surface as never, input(params, seed));
  return log;
}
const lineLength = (r: Recorded) => Math.hypot(r.args[2] - r.args[0], r.args[3] - r.args[1]);

/** Everything off except the named class. */
const only = (extra: Record<string, number | string | boolean>) => ({ silhouette: "off", crease: "off", boundary: "off", sections: "off", contours: "off", shading: "none", depthCue: "none", ...extra });

// ---------------------------------------------------------------------------------------------
// Scenes and the curvature field

test("the assembly is five separate closed parts that never touch, deterministically arranged by the seed", () => {
  const mesh = visibilityMesh({ shape: "assembly", detail: 2, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 });
  const topology = meshTopology(mesh), parts = meshComponents(mesh, topology);
  assert.equal(parts.length, 5);
  assert.deepEqual(parts.map((p) => p.faces).length, 5);
  // components connect through vertices; five means no two parts share a vertex or edge, and the vase is the only one with a rim
  assert.equal(parts.filter((p) => p.boundaryEdges > 0).length, 1);
  assert.equal(topology.kind, "open-manifold");
  // seed 0 fixes the arrangement; another seed permutes the slots and is reproducible
  const same = visibilityMesh({ shape: "assembly", detail: 2, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 });
  assert.equal(same.key, mesh.key);
  const seven = assemblyMesh(2, "amphora", 7), again = assemblyMesh(2, "amphora", 7);
  assert.equal(seven.key, again.key);
  assert.notEqual(seven.key, mesh.key);
  assert.equal(meshComponents(seven, meshTopology(seven)).length, 5);
  // the parts stay separated by the seed's size and turn variation: five components for many seeds
  for (let s = 1; s <= 40; s++) { const m = assemblyMesh(1, "goblet", s); assert.equal(meshComponents(m, meshTopology(m)).length, 5, `seed ${s}`); }
});

test("detail is validated per shape with the control named, and the figure ignores it", () => {
  assert.throws(() => visibilityMesh({ shape: "icosphere", detail: 7, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 }), /Detail must be an integer from 1 to 6 for the icosphere/);
  assert.throws(() => visibilityMesh({ shape: "terrain", detail: 9, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 }), /Detail must be an integer from 1 to 8 for the terrain/);
  assert.throws(() => visibilityMesh({ shape: "vase", detail: 2, terrainVariant: "hills", vaseProfile: "tureen", seed: 0 }), /Vase profile must be one of/);
  const a = visibilityMesh({ shape: "figure", detail: 1, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 });
  const b = visibilityMesh({ shape: "figure", detail: 5, terrainVariant: "hills", vaseProfile: "amphora", seed: 9 });
  assert.equal(a.key, b.key);
  assert.throws(() => validateInstrument(input({ shape: "icosphere", detail: 7 })), /Detail 7 is too high for the icosphere/);
});

test("mean curvature matches the closed forms of a sphere and a torus, and its integral matches the cube's 6 pi", () => {
  const sphere = icosphereMesh(4, 2), h = meanCurvature(sphere);
  let mean = 0; for (const v of h) mean += v;
  near(mean / h.length, 0.5, 0.02); // 1 / r for r = 2
  // torus R = 1, r = 0.4: outer equator (1/r + 1/(R+r)) / 2, top (1/r + 0) / 2, inner equator (1/r - 1/(R-r)) / 2
  const torus = torusMesh({ major: 1, minor: 0.4, u: 96, v: 48 }), ht = meanCurvature(torus);
  const at = (predicate: (p: Vec3) => boolean): number => { for (let v = 0; v < torus.vertexCount; v++) if (predicate(meshVertex(torus, v))) return ht[v]; throw new Error("vertex not found"); };
  const R = 1, r = 0.4, eps = 1e-9;
  near(at((p) => Math.abs(p[0] - (R + r)) < eps && Math.abs(p[1]) < eps && Math.abs(p[2]) < eps), (1 / r + 1 / (R + r)) / 2, 0.03);
  near(at((p) => Math.abs(p[0] - (R - r)) < eps && Math.abs(p[1]) < eps && Math.abs(p[2]) < eps), (1 / r - 1 / (R - r)) / 2, 0.03);
  near(at((p) => Math.abs(p[0] - R) < eps && Math.abs(p[1] - r) < eps && Math.abs(p[2]) < eps), 1 / (2 * r), 0.03);
  assert.ok(at((p) => Math.abs(p[0] - (R - r)) < eps && Math.abs(p[1]) < eps && Math.abs(p[2]) < eps) < at((p) => Math.abs(p[0] - (R + r)) < eps && Math.abs(p[1]) < eps && Math.abs(p[2]) < eps), "inside of the tube is flatter than the outside");
  // cube of side 2: integral of mean curvature is (1/2) sum |e| theta = 1/2 * 12 * 2 * pi/2 = 6 pi, whatever the triangulation
  // every cube vertex meets three faces of area 4, each giving it a quarter: A_i = 3
  const cube = boxMesh([2, 2, 2]), hc = meanCurvature(cube);
  let integral = 0; for (let v = 0; v < cube.vertexCount; v++) integral += hc[v] * 3;
  near(integral, 6 * Math.PI, 1e-9);
});

// ---------------------------------------------------------------------------------------------
// Which stage caches what

test("a camera edit reuses every view-independent class and recomputes silhouettes, visibility and hatch", () => {
  const params = { silhouette: "visible", crease: "dashed", boundary: "visible", sections: "visible", contours: "visible", shading: "hatch" };
  products(params); // warm
  const first = products(params), before = counts();
  const moved = products({ ...params, yaw: 61, pitch: 12 });
  const d = delta(before);
  assert.equal(d.crease, 0); assert.equal(d.boundary, 0); assert.equal(d.sections, 0); assert.equal(d.contours, 0);
  assert.equal(d.silhouette, 1); assert.equal(d.hatch, 1);
  assert.equal(d.hidden, 5, "one visibility solve per drawn class");
  assert.equal(moved.mesh, first.mesh);
  // the view-independent CANDIDATES are the same frozen objects; the visible runs are new
  const rule = { angle: 40, convexity: "both" as const };
  assert.equal(visibilityCreaseEdges(moved.mesh, rule), visibilityCreaseEdges(first.mesh, rule));
  const rec = recipeOf(params);
  assert.equal(visibilitySectionCurves(first.mesh, rec.sections), visibilitySectionCurves(moved.mesh, rec.sections));
  assert.equal(visibilityContourCurves(first.mesh, rec.contours), visibilityContourCurves(moved.mesh, rec.contours));
  assert.notEqual(visibilitySilhouetteEdges(first.mesh, first.camera), visibilitySilhouetteEdges(moved.mesh, moved.camera));
  const of = (p: VisibilityProducts, name: string) => p.classes.find((c) => c.name === name)!;
  assert.notEqual(of(moved, "crease").visible, of(first, "crease").visible);
});

test("an appearance edit recomputes nothing and returns the identical producer values", () => {
  const params = { silhouette: "visible", crease: "dashed", sections: "visible", contours: "dashed", shading: "fill-hatch" };
  const first = products(params), before = counts();
  const styled = products({ ...params, silhouetteWeight: 3, creaseMaterial: "beads", depthCue: "opacity", cueAmount: 0.9, colorBy: "ink", hiddenDash: 9, fillColor: 3, fillPale: 0.2, fillBands: 6, hiddenOpacity: 0.3, stitchSpacing: 12, contourMaterial: "stitch", crease: "visible" });
  assert.deepEqual(delta(before), { crease: 0, boundary: 0, sections: 0, contours: 0, silhouette: 0, chains: 0, hidden: 0, hatch: 0, paint: 0 });
  first.classes.forEach((c, i) => { assert.equal(styled.classes[i].visible, c.visible); assert.equal(styled.classes[i].hidden, c.hidden); });
  assert.equal(styled.hatch, first.hatch); assert.equal(styled.fill, first.fill);
  // Visible only and Hidden dashed are one computation
  assert.equal(products({ ...params, crease: "visible" }).classes[1].hidden, first.classes[1].hidden);
});

test("a structural edit recomputes only the classes that depend on it, and a Removed class is not computed", () => {
  const params = { silhouette: "visible", crease: "visible", sections: "visible", contours: "visible", shading: "none" };
  const first = products(params), before = counts();
  const more = products({ ...params, contourLevels: 13 });
  const d = delta(before);
  assert.equal(d.contours, 1); assert.equal(d.hidden, 1);
  assert.equal(d.crease + d.sections + d.silhouette + d.hatch + d.paint, 0);
  for (const name of ["silhouette", "crease", "sections"]) assert.equal(more.classes.find((c) => c.name === name)!.visible, first.classes.find((c) => c.name === name)!.visible);
  assert.notEqual(more.classes.find((c) => c.name === "contours")!.visible, first.classes.find((c) => c.name === "contours")!.visible);
  const b2 = counts();
  const none = products({ ...params, boundary: "off", sections: "off", contours: "off", crease: "off", silhouette: "off" });
  assert.equal(none.classes.length, 0);
  assert.deepEqual(delta(b2), { crease: 0, boundary: 0, sections: 0, contours: 0, silhouette: 0, chains: 0, hidden: 0, hatch: 0, paint: 0 });
  // light changes hatch structure but not line classes
  const b3 = counts();
  products({ ...params, shading: "hatch", hatchSpacing: 4.71 }); products({ ...params, shading: "hatch", hatchSpacing: 4.71, lightAzimuth: 100 });
  const d3 = delta(b3);
  assert.equal(d3.hatch, 2); assert.equal(d3.crease + d3.contours + d3.sections + d3.silhouette, 0);
});

// ---------------------------------------------------------------------------------------------
// Hidden-line removal respects occlusion (checked by an independent ray caster)

for (const projection of ["orthographic", "perspective"] as const) {
  test(`visible and hidden runs of every class agree with independent ray casting (${projection})`, () => {
    const params = { projection, silhouette: "dashed", crease: "dashed", boundary: "dashed", sections: "dashed", sectionSpacing: 0.09, contours: "dashed", contourLevels: 6, shading: "none", yaw: 33, pitch: 27 };
    const p = products(params), tri = triangulate(p.mesh), diagonal = Math.hypot(...([0, 1, 2].map((k) => p.mesh.bounds.max[k] - p.mesh.bounds.min[k])));
    let visibleWrong = 0, hiddenWrong = 0, visibleN = 0, hiddenN = 0, hiddenPaths = 0;
    for (const c of p.classes) {
      hiddenPaths += c.hidden.length;
      for (const path of c.visible) for (const point of samples(path, p.camera)) { visibleN++; if (covered(tri, p.camera, diagonal, point, 2)) visibleWrong++; }
      for (const path of c.hidden) for (const point of samples(path, p.camera)) { hiddenN++; if (!covered(tri, p.camera, diagonal, point, 1)) hiddenWrong++; }
    }
    assert.ok(hiddenPaths > 20, "the view has real occlusion to check");
    assert.ok(visibleN > 200 && hiddenN > 100, `${visibleN} visible and ${hiddenN} hidden samples`);
    assert.equal(visibleWrong, 0, "no visible sample has a surface between it and the eye");
    assert.equal(hiddenWrong, 0, "every hidden sample has a surface between it and the eye");
  });
}

test("visible hatch strokes are visible surface only: one lattice line across a plate and a block in front of it", () => {
  const plate = boxMesh([6, 6, 0.2], [0, 0, -1], "plate"), block = boxMesh([2, 2, 0.2], [0, 0, 1], "block");
  const scene = mergeMeshes("scene", [plate, block]);
  const view = camera({ projection: "orthographic", yaw: 0, pitch: 0, zoom: 100, distance: 10, center: [320, 320] });
  // light from behind the viewer's -z side so that the +z faces are dark: darkness 1 - ambient
  const result = tonedHatch(scene, view, { spacing: 10, angle: 0, families: 1, threshold: 0.3, light: { azimuth: 180, elevation: 5, ambient: 0.1, smooth: false } });
  const depthOf = (x: number, y: number) => (Math.abs(x - 320) < 100 && Math.abs(y - 320) < 100 ? 10 - 1.1 : 10 + 0.9); // block front z = 1.1, plate front z = -0.9
  let inside = 0, outside = 0;
  for (const path of result.paths) {
    for (let i = 1; i < path.points.length; i++) {
      const [x0, y0] = path.points[i - 1], [x1, y1] = path.points[i], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const expected = depthOf(mx, my);
      near(path.depths[i - 1], expected, 1e-6); near(path.depths[i], expected, 1e-6);
      if (expected < 10) inside++; else outside++;
    }
  }
  // 60 lattice lines cross the plate (y in 20..620), 20 of them cross the block (y in 220..420), and each line's plate pieces stop at the block
  assert.ok(inside >= 20 && outside >= 60 + 20);
  // no plate depth anywhere in the block's rectangle (that part of the plate is hidden) although the plate is hatched on both sides of it
  for (const path of result.paths) for (let i = 1; i < path.points.length; i++) {
    const mx = (path.points[i][0] + path.points[i - 1][0]) / 2, my = (path.points[i][1] + path.points[i - 1][1]) / 2;
    if (Math.abs(mx - 320) < 99 && Math.abs(my - 320) < 99) assert.ok(path.depths[i] < 10, "hidden plate hatch removed behind the block");
  }
});

// ---------------------------------------------------------------------------------------------
// Hatch: lattice, tone families, merged strokes

test("tone decides how many hatch families a face carries, and a lattice line is one stroke across triangles", () => {
  const box = boxMesh([4, 1, 4]);
  const view = camera({ projection: "orthographic", yaw: 0, pitch: 90, zoom: 100, distance: 10, center: [320, 320] });
  const families = (elevation: number, ambient: number, threshold = 0) => {
    const r = tonedHatch(box, view, { spacing: 10, angle: 0, families: 3, threshold, light: { azimuth: 0, elevation, ambient, smooth: false } });
    return { ids: new Set(r.paths.map((p) => p.curve.split(":")[0])), r };
  };
  // the top face's darkness is 1 - (ambient + (1 - ambient) sin(elevation)); families j = 0, 1, 2 need darkness above j / 3
  near(toneDarkness(Math.sin(60 * Math.PI / 180), 0.1), 1 - (0.1 + 0.9 * Math.sin(60 * Math.PI / 180)), 1e-12);
  const one = families(60, 0.1), two = families(20, 0.1), three = families(5, 0.1);
  assert.deepEqual([...one.ids].sort(), ["0"]);       // darkness 0.12
  assert.deepEqual([...two.ids].sort(), ["0", "1"]);  // darkness 0.59
  assert.deepEqual([...three.ids].sort(), ["0", "1", "2"]); // darkness 0.82
  // family 0 is horizontal at spacing 10 anchored at the canvas origin: lines y = (k + 0.5) 10 strictly inside the 400 x 400 square (120, 520): k = 12..51
  const horizontal = one.r.paths.filter((p) => p.curve.startsWith("0:"));
  assert.equal(horizontal.length, 40, "one stroke per lattice line (the top quad's two triangles are joined)");
  const ys = horizontal.map((p) => p.points[0][1]).sort((a, b) => a - b);
  ys.forEach((y, i) => near(y, (12 + i + 0.5) * 10, 1e-9));
  for (const p of horizontal) { near(Math.hypot(p.points[p.points.length - 1][0] - p.points[0][0], p.points[p.points.length - 1][1] - p.points[0][1]), 400, 1e-9); near(p.points[0][1], p.points[p.points.length - 1][1], 1e-12); }
  // Bare highlights above the darkness leaves the face bare
  assert.equal(families(60, 0.1, 0.5).r.paths.length, 0);
  // a rotated family stays on its lattice: lines of angle 90 are vertical at x = (k + 0.5) 10 for the direction's normal (-sin, cos) = (-1, 0): offsets -x
  const vertical = tonedHatch(box, view, { spacing: 10, angle: 90, families: 1, threshold: 0, light: { azimuth: 0, elevation: 60, ambient: 0.1, smooth: false } });
  for (const p of vertical.paths) { const x = p.points[0][0]; near(p.points[1][0], x, 1e-12); const k = -x / 10 - 0.5; near(k, Math.round(k), 1e-9); }
});

test("a hatch that needs too many segments fails naming the controls, and limits are named", () => {
  assert.throws(() => draw(only({ shape: "icosphere", detail: 4, shading: "hatch", hatchFamilies: 3, hatchBare: 0, hatchSpacing: 1, size: 5000 })), /Hatch needs more than 150000 segments\. Raise Hatch spacing/);
  assert.equal(MAX_HATCH_SEGMENTS, 150_000);
  const mesh = visibilityMesh({ shape: "icosphere", detail: 2, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 });
  assert.throws(() => visibilitySectionCurves(mesh, { axis: "y", tilt: 0, spacing: 0.003, offset: 0 }), new RegExp(`the limit is ${VISIBILITY_LIMITS.maxSectionPlanes}\\. Raise Section spacing`));
  assert.throws(() => visibilityContourCurves(mesh, { field: "height", levels: 201 }), /Contour levels must be an integer from 1 to 200/);
  assert.throws(() => visibilityCreaseEdges(mesh, { angle: 0, convexity: "both" }), /Crease angle/);
  assert.throws(() => viewCamera(mesh, { projection: "orthographic", yaw: 0, pitch: 0, roll: 0, distance: 3, centerX: 0, centerY: 0, size: -1 }), /Size must be positive/);
});

// ---------------------------------------------------------------------------------------------
// Edge classes and ownership

test("a shared crease and silhouette edge is drawn once, by the silhouette; the crease class keeps the rest", () => {
  const p = products(only({ shape: "figure", silhouette: "visible", crease: "visible", projection: "orthographic", yaw: 35, pitch: 15, creaseAngle: 30 }));
  const segments = (curves: readonly { points: readonly (readonly number[])[]; closed?: boolean }[]) => {
    const set = new Set<string>();
    for (const c of curves) for (let i = 0; i < c.points.length - (c.closed ? 0 : 1); i++) {
      const a = c.points[i].join(","), b = c.points[(i + 1) % c.points.length].join(",");
      set.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
    return set;
  };
  const mesh = p.mesh, sil = visibilitySilhouetteEdges(mesh, p.camera), creaseAll = visibilityCreaseEdges(mesh, { angle: 30, convexity: "both" });
  const shared = creaseAll.filter((e) => sil.includes(e));
  assert.ok(shared.length > 3, "the figure's outline includes creases");
  const silhouetteSegments = segments(visibilityEdgeCurves(mesh, sil));
  const creaseSegments = segments(creaseCurvesExcluding(mesh, { angle: 30, convexity: "both" }, sil));
  for (const s of creaseSegments) assert.ok(!silhouetteSegments.has(s), "no edge is in both classes");
  // together they still cover every crease and every silhouette edge
  const all = segments(visibilityEdgeCurves(mesh, [...new Set([...creaseAll, ...sil])]));
  assert.equal(new Set([...silhouetteSegments, ...creaseSegments]).size, all.size);
  // with the silhouette Removed the crease class owns the shared edges again
  const unowned = segments(creaseCurvesExcluding(mesh, { angle: 30, convexity: "both" }, []));
  assert.ok(unowned.size > creaseSegments.size);
});

test("the silhouette of an orthographic sphere is one closed loop on the sphere's outline", () => {
  const p = products(only({ shape: "icosphere", detail: 4, silhouette: "dashed", projection: "orthographic", yaw: 40, pitch: 30, size: 400 }));
  const silhouette = p.classes.find((c) => c.name === "silhouette")!;
  assert.equal(silhouette.visible.length, 1);
  assert.equal(silhouette.hidden.length, 0);
  assert.equal(silhouette.visible[0].closed, true);
  const [cx, cy] = p.camera.options.center, zoom = p.camera.options.zoom;
  // icosphere vertices lie on the unit sphere, so the outline lies between the tangent circle and 0.98 of it
  for (const [x, y] of silhouette.visible[0].points) { const rr = Math.hypot(x - cx, y - cy) / zoom; assert.ok(rr <= 1 + 1e-9 && rr > 0.97, `radius ${rr}`); }
});

test("sections are exact: each ring of a sphere lies on its plane and inside the sphere", () => {
  const mesh = visibilityMesh({ shape: "icosphere", detail: 4, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 });
  const set = visibilitySectionCurves(mesh, { axis: "y", tilt: 0, spacing: 0.1, offset: 0 });
  assert.equal(set.closed, set.planes.length);
  assert.equal(set.open, 0);
  // stack centred on the bounds (about y = 0), spacing 0.1 of the extent: planes at k * 0.1 * extent
  const ys = set.curves.map((c) => c.points[0][1]);
  for (const curve of set.curves) { const y = curve.points[0][1]; for (const q of curve.points) near(q[1], y, 1e-12); assert.ok(Math.abs(y) < 1); for (const q of curve.points) assert.ok(Math.hypot(q[0], q[2]) <= Math.sqrt(1 - y * y) + 1e-9); }
  assert.ok(new Set(ys.map((y) => y.toFixed(9))).size === ys.length);
  const extent = mesh.bounds.max[1] - mesh.bounds.min[1];
  const centre = (mesh.bounds.max[1] + mesh.bounds.min[1]) / 2;
  for (const y of ys) { const k = (y - centre) / (0.1 * extent); near(k, Math.round(k), 1e-9); }
});

// ---------------------------------------------------------------------------------------------
// Depth cue

test("depth cuts are exact where the depth crosses a bin boundary, in both projections", () => {
  for (const projection of ["orthographic", "perspective"] as const) {
    const view = camera({ projection, yaw: 25, pitch: 15, zoom: 120, distance: 6, center: [320, 320], target: [0, 0, 0] });
    const a: Vec3 = [-1.2, -0.3, 1.5], b: Vec3 = [0.9, 0.6, -1.6];
    const pa = view.project(a)!, pb = view.project(b)!;
    const path: ProjectedPath = { id: "t", seed: 0, points: [[pa.x, pa.y], [pb.x, pb.y]], closed: false, level: 0, levelFraction: 0, visible: true, depths: [pa.depth, pb.depth], curve: "t" };
    const range = { near: 4.2, far: 7.8 };
    const width = (range.far - range.near) / 6;
    const pieces = splitByDepth(path, range, projection === "perspective");
    const expectedBins = new Set<number>();
    for (let s = 0; s <= 2000; s++) { const u = s / 2000, q: Vec3 = [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), a[2] + u * (b[2] - a[2])]; expectedBins.add(cueBin(view.project(q)!.depth, range)); }
    assert.deepEqual(pieces.map((p) => p.bin).sort(), [...expectedBins].sort(), `${projection}: one piece per bin along the segment`);
    // every interior cut point is the projection of a 3D point of the segment whose depth is exactly a bin boundary
    for (const piece of pieces) for (const which of [0, piece.points.length - 1]) {
      const [x, y] = piece.points[which];
      if ((x === pa.x && y === pa.y) || (x === pb.x && y === pb.y)) continue;
      let lo = 0, hi = 1;
      for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2, q: Vec3 = [a[0] + m * (b[0] - a[0]), a[1] + m * (b[1] - a[1]), a[2] + m * (b[2] - a[2])]; const pr = view.project(q)!; if ((pr.x - pa.x) * (pb.x - pa.x) + (pr.y - pa.y) * (pb.y - pa.y) < (x - pa.x) * (pb.x - pa.x) + (y - pa.y) * (pb.y - pa.y)) lo = m; else hi = m; }
      const q: Vec3 = [a[0] + lo * (b[0] - a[0]), a[1] + lo * (b[1] - a[1]), a[2] + lo * (b[2] - a[2])];
      const depth = view.project(q)!.depth, offset = (depth - range.near) / width;
      near(offset, Math.round(offset), 1e-6);
    }
  }
  // nothing to cut when the depths share a bin
  const flat: ProjectedPath = { id: "f", seed: 0, points: [[0, 0], [1, 1]], closed: false, level: 0, levelFraction: 0, visible: true, depths: [5, 5.1], curve: "f" };
  assert.equal(splitByDepth(flat, { near: 4, far: 8 }, false).length, 1);
  near(cueFactor(1, 5), 1 - 0.85 * 5.5 / 6, 1e-12);
  near(cueFactor(0, 3), 1, 1e-15);
});

// ---------------------------------------------------------------------------------------------
// The drawing

test("hidden dashes are stitches at the dash period, thinner and fainter than the visible line; Visible only draws none", () => {
  const base = only({ shape: "figure", crease: "dashed", creaseWeight: 2, hiddenWeight: 0.5, hiddenOpacity: 0.5, hiddenDash: 6, creaseAngle: 30, projection: "orthographic", yaw: 30, pitch: 20 });
  const dashed = draw(base), visibleOnly = draw({ ...base, crease: "visible" });
  const dashes = dashed.filter((r) => r.op === "line" && Math.abs(r.weight - 1) < 1e-9);
  assert.ok(dashes.length > 10, "hidden creases exist behind the figure's parts");
  for (const d of dashes) { near(lineLength(d), 0.54 * 6, 1e-9); near(d.stroke[3], 225 * 0.5, 1e-9); }
  assert.ok(visibleOnly.every((r) => r.op !== "line"), "no stitches without Hidden dashed");
  const solid = visibleOnly.filter((r) => r.op === "shape");
  assert.ok(solid.length > 0);
  for (const s of solid) { assert.equal(s.weight, 2); assert.equal(s.stroke[3], 215); }
  assert.equal(dashed.filter((r) => r.op === "shape").length, solid.length, "the visible strokes are the same");
});

test("Removed classes draw nothing and a class colour follows Color by", () => {
  assert.equal(draw(only({})).length, 0);
  const crease = draw(only({ shape: "figure", crease: "visible", colorBy: "class" })), ink = draw(only({ shape: "figure", crease: "visible", colorBy: "ink" }));
  const palette = createInstrument(ID).palette;
  const rgb = (n: number) => [(n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  assert.deepEqual(crease[0].stroke.slice(0, 3), rgb(palette[1]));
  assert.deepEqual(ink[0].stroke.slice(0, 3), rgb(palette[0]));
});

test("a weight cue thins far lines monotonically between the class weight and its floor", () => {
  const log = draw(only({ shape: "torus", detail: 3, silhouette: "visible", silhouetteWeight: 3, depthCue: "weight", cueAmount: 1, projection: "perspective", distance: 1.6, pitch: 45 }));
  const weights = new Set(log.filter((r) => r.op === "shape").map((r) => Math.round(r.weight * 1e6) / 1e6));
  const expected = Array.from({ length: 6 }, (_, bin) => Math.round(3 * cueFactor(1, bin) * 1e6) / 1e6);
  for (const w of weights) assert.ok(expected.includes(w), `weight ${w} is a cue bin weight`);
  assert.ok(weights.size >= 3, "the outline crosses several depth bins");
  const opacity = new Set(draw(only({ shape: "torus", detail: 3, silhouette: "visible", depthCue: "opacity", cueAmount: 1, projection: "perspective", distance: 1.6, pitch: 45 })).filter((r) => r.op === "shape").map((r) => Math.round(r.stroke[3] * 1e6) / 1e6));
  // the opacity multiplier is quantised to a thousandth (one wrapper per value), so alpha is 215 x factor to within 0.11
  for (const a of opacity) assert.ok(Array.from({ length: 6 }, (_, bin) => 215 * cueFactor(1, bin)).some((e) => Math.abs(e - a) < 0.11), `alpha ${a}`);
  assert.ok(opacity.size >= 3);
});

test("the fill is opaque, painted from the light, and covers exactly the camera-facing faces of a closed solid", () => {
  const params = only({ shape: "icosphere", detail: 1, shading: "fill", projection: "orthographic", yaw: 0, pitch: 90, fillPale: 0, fillShade: 1, fillBands: 0, shadeNormals: "flat", lightAzimuth: 0, lightElevation: 70, ambient: 0.2, fillColor: 1 });
  const log = draw(params).filter((r) => r.op === "shape");
  const mesh = visibilityMesh({ shape: "icosphere", detail: 1, terrainVariant: "hills", vaseProfile: "amphora", seed: 0 }), tri = triangulate(mesh);
  const L = [0, Math.sin(70 * Math.PI / 180), Math.cos(70 * Math.PI / 180)];
  const palette = createInstrument(ID).palette, rgb = [(palette[1] >>> 16) & 255, (palette[1] >>> 8) & 255, palette[1] & 255];
  const expected: string[] = [];
  for (let i = 0; i < tri.t.length; i += 3) {
    const [a, b, c] = [tri.t[i] * 3, tri.t[i + 1] * 3, tri.t[i + 2] * 3], u = [0, 1, 2].map((k) => tri.p[b + k] - tri.p[a + k]), w = [0, 1, 2].map((k) => tri.p[c + k] - tri.p[a + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], len = Math.hypot(...n);
    if (n[1] / len <= 0) continue; // looking straight down: faces with +y normals face the eye
    const lit = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len, dark = 1 - (0.2 + 0.8 * Math.max(0, lit));
    expected.push(rgb.map((ch) => Math.round(ch * (1 - dark))).join(","));
  }
  assert.equal(log.length, expected.length);
  assert.deepEqual(log.map((r) => r.fill.slice(0, 3).join(",")).sort(), expected.sort());
  for (const r of log) assert.equal(r.fill[3], 255);
  const faces = paintedFaces(mesh, viewCamera(mesh, recipeOf(params).view));
  assert.equal(faces.exact, true);
});

// ---------------------------------------------------------------------------------------------
// The instrument's controls

test("hidden controls do not change the drawing, and the seed is used only by seeded shapes", () => {
  const change = (base: Record<string, number | string | boolean>, key: string, value: number | string | boolean) =>
    assert.equal(drawFingerprint(input({ ...base, [key]: value })), drawFingerprint(input(base)), `${key} while hidden`);
  const figure = { shape: "figure", detail: 2 };
  change(figure, "detail", 5); change(figure, "terrainVariant", "dunes"); change(figure, "vaseProfile", "urn"); change(figure, "boundary", "dashed");
  change({ ...figure, silhouette: "off" }, "silhouetteWeight", 3); change({ ...figure, crease: "off" }, "creaseAngle", 90); change({ ...figure, sections: "off" }, "sectionSpacing", 0.2);
  change({ ...figure, contours: "off" }, "contourLevels", 3); change({ ...figure, shading: "none" }, "hatchAngle", 12); change({ ...figure, shading: "none" }, "lightAzimuth", 100);
  change({ ...figure, shading: "hatch" }, "fillBands", 2); change({ ...figure, shading: "fill" }, "hatchSpacing", 9); change({ ...figure, projection: "orthographic" }, "distance", 2);
  change({ ...figure, depthCue: "none" }, "cueAmount", 0.2);
  assert.equal(usesSeed(input({ shape: "torus" })), false);
  assert.equal(usesSeed(input({ shape: "terrain" })), true);
  assert.equal(usesSeed(input({ shape: "assembly" })), true);
  // the control tree: all controls sit in exactly one group and Stations is the one proportional cluster
  const items = inspectorItems(ID, definition(ID).defaults);
  const labels = items.map((i) => ("label" in i ? i.label : ""));
  assert.deepEqual(labels.slice(0, 3), ["Form", "Placement", "View"]);
  const visible = visibleParameters(ID, { ...definition(ID).defaults, shape: "figure" }).map((p) => p.key);
  assert.ok(!visible.includes("detail") && !visible.includes("boundary") && !visible.includes("terrainVariant"));
});

test("shape, seed and camera change the structure; a palette does not", () => {
  const fp = (params: Record<string, number | string | boolean>, seed = 42) => drawFingerprint(input(params, seed));
  const base = fp({});
  for (const shape of ["icosphere", "torus", "terrain", "vase", "figure"]) assert.notEqual(fp({ shape }), base, shape);
  assert.notEqual(fp({}, 43), base);
  assert.notEqual(fp({ yaw: 90 }), base);
  const palette = input({}); palette.palette = [0x102030, 0x405060, 0x708090];
  assert.notEqual(drawFingerprint(palette), base);
  assert.equal(fp({ shape: "torus" }, 1), fp({ shape: "torus" }, 2), "an unseeded shape ignores the seed");
  assert.notEqual(fp({ shape: "terrain" }, 1), fp({ shape: "terrain" }, 2));
});
