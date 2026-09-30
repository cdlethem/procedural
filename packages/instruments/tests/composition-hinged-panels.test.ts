import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FOLD_ANGLE, MAX_PANELS, componentSeed, createInstrument, definition, drawHingedPanels, drawInstrument, faceArea, faceNormal, foldPanels, hingeAngles,
  hingedCamera, hingedCurves, hingedPanelsComposition, hingedPosed, hingedProducts, hingedView, inspectorItems, meshBoundaryEdges, meshComponents, meshEdgeAngle,
  meshEdgeClass, meshEdgeFaces, meshMeasures, meshTopology, panelBoundaryEdges, panelNormal, panelPoint, panelTiling, panelTilingFromPolygons, panelTones,
  posedPanels, prepareInstrument, usesSeed, validateInstrument, visibleParameters,
  type ClosureOptions, type CompositionSurface, type FoldFieldOptions, type FoldedPanels, type PanelTiling, type PanelTilingOptions,
} from "../dist/index.js";

const ID = "hinged-panels";
const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const RAD = 180 / Math.PI;

const tilingOptions = (over: Partial<PanelTilingOptions> = {}): PanelTilingOptions =>
  ({ seed: 42, source: "square", columns: 4, rows: 3, patch: "sun", depth: 2, retention: 1, ...over });
const foldOptions = (over: Partial<FoldFieldOptions> = {}): FoldFieldOptions =>
  ({ seed: 42, rule: "uniform", angle: 40, direction: "mountain", period: 2, stripeAngle: 90, phase: 0, disorder: 0, amount: 1, select: "all", axis: 0, share: 1, ...over });
const closure = (over: Partial<ClosureOptions> = {}): ClosureOptions => ({ seed: 42, anchor: "corner", anchors: 1, tree: "breadth", ...over });

/** Angles by hinge id, zero elsewhere. */
const angleMap = (tiling: PanelTiling, values: Record<string, number>): number[] => tiling.hinges.map((h) => values[h.id] ?? 0);
const hingeIndex = (tiling: PanelTiling, id: string): number => {
  const found = tiling.hinges.find((h) => h.id === id);
  assert.ok(found, `no hinge ${id}`);
  return found.index;
};

// ------------------------------------------------------------------------------------ flat tilings

test("bundled tilings have the closed-form panel and hinge counts, areas and boundary length", () => {
  for (const [c, r] of [[2, 2], [4, 3], [7, 5]]) {
    const square = panelTiling(tilingOptions({ columns: c, rows: r }));
    assert.equal(square.panels.length, c * r);
    assert.equal(square.hinges.length, (c - 1) * r + c * (r - 1));
    square.panels.forEach((p) => near(p.area, 1));
    const triangle = panelTiling(tilingOptions({ source: "triangle", columns: c, rows: r }));
    assert.equal(triangle.panels.length, 2 * c * r);
    assert.equal(triangle.hinges.length, c * r + (c - 1) * r + c * (r - 1));
    triangle.panels.forEach((p) => near(p.area, Math.sqrt(3) / 4));
    const brick = panelTiling(tilingOptions({ source: "brick", columns: c, rows: r }));
    assert.equal(brick.panels.length, c * r);
    // adjacent rows overlap in 2c - 1 unit segments (a T-junction: one edge shared with two bricks)
    assert.equal(brick.hinges.length, (c - 1) * r + (r - 1) * (2 * c - 1));
    brick.panels.forEach((p) => near(p.area, 2));
    brick.hinges.forEach((h) => near(h.length, 1));
  }
  // Perimeter identity: sum of panel perimeters = 2 x hinge length + boundary length, for every source, T-junctions included.
  for (const options of [tilingOptions(), tilingOptions({ source: "triangle" }), tilingOptions({ source: "brick", columns: 5, rows: 4 }), tilingOptions({ source: "penrose", depth: 2 })]) {
    const t = panelTiling(options);
    const perimeter = t.panels.reduce((sum, p) => sum + p.corners.reduce((s, [x, y], i) => s + Math.hypot(p.corners[(i + 1) % p.corners.length][0] - x, p.corners[(i + 1) % p.corners.length][1] - y), 0), 0);
    const hinged = t.hinges.reduce((s, h) => s + h.length, 0);
    const outline = panelBoundaryEdges(t).reduce((s, e) => s + Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), 0);
    near(perimeter, 2 * hinged + outline, 1e-9);
  }
  assert.equal(panelBoundaryEdges(panelTiling(tilingOptions({ columns: 5, rows: 2 }))).length, 2 * (5 + 2));
});

test("Penrose panels are unit rhombs and their lone half-rhombs, one connected patch of Euler characteristic 1", () => {
  for (const patch of ["sun", "decagon", "thick", "thin"]) {
    const t = panelTiling(tilingOptions({ source: "penrose", patch, depth: 2 }));
    for (const p of t.panels) {
      const rhomb = p.corners.length === 4, k = p.corners.length;
      assert.ok(rhomb || k === 3);
      // a rhomb has four unit edges; a lone half of one has two unit edges (the third is the short or long diagonal)
      const lengths = p.corners.map(([x, y], i) => Math.hypot(p.corners[(i + 1) % k][0] - x, p.corners[(i + 1) % k][1] - y));
      assert.equal(lengths.filter((l) => Math.abs(l - 1) < 1e-8).length, rhomb ? 4 : 2);
      const scale = rhomb ? 1 : 0.5;
      assert.ok(Math.abs(p.area - scale * Math.sin(Math.PI / 5)) < 1e-8 || Math.abs(p.area - scale * Math.sin(2 * Math.PI / 5)) < 1e-8, `area ${p.area}`);
    }
    // vertices by rounded coordinates, edges = (4F + boundary pieces) / 2: V - E + F = 1 for a disc
    const key = (x: number, y: number) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
    const vertices = new Set(t.panels.flatMap((p) => p.corners.map(([x, y]) => key(x, y))));
    const boundary = panelBoundaryEdges(t).length;
    const corners = t.panels.reduce((n, p) => n + p.corners.length, 0);
    assert.equal(t.hinges.length * 2 + boundary, corners, "every panel edge is a hinge half or an outline piece");
    const edges = (corners + boundary) / 2;
    assert.equal(vertices.size - edges + t.panels.length, 1);
  }
});

test("panel ids are the tiling's own and survive a bigger grid, a lower retention and a new seed", () => {
  const small = panelTiling(tilingOptions({ columns: 3, rows: 3 }));
  const big = panelTiling(tilingOptions({ columns: 6, rows: 5 }));
  const bigIds = new Set(big.panels.map((p) => p.id));
  assert.ok(small.panels.every((p) => bigIds.has(p.id)));
  const bigHinges = new Set(big.hinges.map((h) => h.id));
  assert.ok(small.hinges.every((h) => bigHinges.has(h.id)));
  assert.deepEqual(small.panels.map((p) => p.id).slice(0, 3), ["q:0,0", "q:1,0", "q:2,0"]);
  const half = panelTiling(tilingOptions({ columns: 6, rows: 5, retention: 0.5 })), most = panelTiling(tilingOptions({ columns: 6, rows: 5, retention: 0.8 }));
  const mostIds = new Set(most.panels.map((p) => p.id));
  assert.ok(half.panels.length < most.panels.length && most.panels.length < big.panels.length);
  assert.ok(half.panels.every((p) => mostIds.has(p.id)), "the set kept at a lower share is inside the set kept at a higher one");
  assert.equal(most.hinges.every((h) => h.panels.every((i) => i < most.panels.length)), true);
  const other = panelTiling(tilingOptions({ columns: 6, rows: 5, retention: 0.5, seed: 43 }));
  assert.notDeepEqual(other.panels.map((p) => p.id), half.panels.map((p) => p.id));
  assert.equal(panelTiling(tilingOptions()), panelTiling(tilingOptions()), "cached by construction");
});

test("a caller's own polygons are validated like a bundled source", () => {
  const t = panelTilingFromPolygons({
    seed: 1, id: "pair",
    panels: [{ id: "left", corners: [[0, 0], [1, 0], [1, 1], [0, 1]] }, { id: "right", corners: [[1, 0], [2, 0], [2, 1], [1, 1]] }],
    hinges: [{ panels: ["left", "right"], a: [1, 0], b: [1, 1] }],
  });
  assert.equal(t.hinges.length, 1);
  assert.equal(t.hinges[0].id, "h:left|right");
  assert.throws(() => panelTilingFromPolygons({ seed: 1, id: "x", panels: [{ id: "cw", corners: [[0, 0], [0, 1], [1, 1], [1, 0]] }], hinges: [] }), /counter-clockwise/);
  assert.throws(() => panelTilingFromPolygons({ seed: 1, id: "x", panels: [{ id: "a", corners: [[0, 0], [1, 0], [1, 1], [0, 1]] }], hinges: [{ panels: ["a", "b"], a: [0, 0], b: [1, 0] }] }), /unknown panel "b"/);
});

// ------------------------------------------------------------------------------------ fold rules

test("fold rules produce their analytic angles", () => {
  const t = panelTiling(tilingOptions({ columns: 4, rows: 4 }));
  const horizontal = (h: PanelTiling["hinges"][number]) => Math.abs(h.a[1] - h.b[1]) < 1e-12;
  // uniform: every hinge the base fold; valley flips the sign
  hingeAngles(t, foldOptions({ angle: 35 })).forEach((a) => assert.equal(a, 35));
  hingeAngles(t, foldOptions({ angle: 35, direction: "valley" })).forEach((a) => assert.equal(a, -35));
  // stripes: cos(2 pi t / period + phase), t the distance from the lower-left corner: at period 2 hinge rows alternate exactly
  const stripes = hingeAngles(t, foldOptions({ rule: "stripes", angle: 50, period: 2, stripeAngle: 90 }));
  for (const h of t.hinges) near(stripes[h.index], horizontal(h) ? 50 * Math.cos(Math.PI * h.mid[1]) : 50 * Math.cos(Math.PI * h.mid[1]), 1e-12);
  const phased = hingeAngles(t, foldOptions({ rule: "stripes", angle: 50, period: 4, stripeAngle: 0, phase: 30 }));
  for (const h of t.hinges) near(phased[h.index], 50 * Math.cos(2 * Math.PI * h.mid[0] / 4 + Math.PI / 6), 1e-12);
  // radial: the same wave in distance from the sheet centre (2, 2)
  const radial = hingeAngles(t, foldOptions({ rule: "radial", angle: 60, period: 3 }));
  for (const h of t.hinges) near(radial[h.index], 60 * Math.cos(2 * Math.PI * Math.hypot(h.mid[0] - 2, h.mid[1] - 2) / 3), 1e-12);
  // checker: sign = parity of the cell of size `period`, a quarter cell in
  const checker = hingeAngles(t, foldOptions({ rule: "checker", angle: 20, period: 1 }));
  for (const h of t.hinges) {
    const parity = (Math.floor(h.mid[0] + 0.25) + Math.floor(h.mid[1] + 0.25)) % 2;
    assert.equal(checker[h.index], parity === 0 ? 20 : -20);
  }
  // the same cells on a tiling whose hinge midpoints are not on whole numbers: the quarter-cell offset applies to both axes
  const tri = panelTiling(tilingOptions({ source: "triangle", columns: 5, rows: 4 }));
  const triChecker = hingeAngles(tri, foldOptions({ rule: "checker", angle: 20, period: 0.7 }));
  for (const h of tri.hinges) {
    const parity = Math.abs(Math.floor((h.mid[0] - tri.bounds.minU) / 0.7 + 0.25) + Math.floor((h.mid[1] - tri.bounds.minV) / 0.7 + 0.25)) % 2;
    assert.equal(triChecker[h.index], parity === 0 ? 20 : -20);
  }
  // amount scales linearly, and 0 is exactly flat
  const half = hingeAngles(t, foldOptions({ rule: "stripes", angle: 50, amount: 0.5 }));
  hingeAngles(t, foldOptions({ rule: "stripes", angle: 50 })).forEach((a, i) => near(half[i], a / 2, 1e-12));
  hingeAngles(t, foldOptions({ rule: "seeded", angle: 90, amount: 0 })).forEach((a) => assert.equal(a, 0));
});

test("seeded angles belong to hinge names; disorder blends toward them; selection is per hinge", () => {
  const small = panelTiling(tilingOptions({ columns: 3, rows: 3 })), big = panelTiling(tilingOptions({ columns: 6, rows: 6 }));
  const a = hingeAngles(small, foldOptions({ rule: "seeded", angle: 80 })), b = hingeAngles(big, foldOptions({ rule: "seeded", angle: 80 }));
  for (const h of small.hinges) {
    assert.equal(a[h.index], b[hingeIndex(big, h.id)], "a hinge keeps its angle when the grid grows");
    near(a[h.index], 80 * (2 * componentSeed(42, h.id, "fold") / 0x1_0000_0000 - 1), 1e-12);
    assert.ok(Math.abs(a[h.index]) <= 80);
  }
  assert.notDeepEqual(Array.from(hingeAngles(small, foldOptions({ rule: "seeded", angle: 80, seed: 7 }))), Array.from(a));
  // disorder 1 is the seeded rule whatever the rule is; 0 leaves the rule alone
  const full = hingeAngles(small, foldOptions({ rule: "stripes", angle: 80, disorder: 1 }));
  full.forEach((v, i) => near(v, a[i], 1e-12));
  const mixed = hingeAngles(small, foldOptions({ rule: "uniform", angle: 80, disorder: 0.25 }));
  mixed.forEach((v, i) => near(v, 0.75 * 80 + 0.25 * a[i], 1e-12));
  // selection: a horizontal axis takes only horizontal hinges; a share takes nested subsets
  const axis = hingeAngles(small, foldOptions({ select: "axis", axis: 0 }));
  for (const h of small.hinges) assert.equal(axis[h.index] !== 0, Math.abs(h.a[1] - h.b[1]) < 1e-12);
  const vertical = hingeAngles(small, foldOptions({ select: "axis", axis: 80 }));
  for (const h of small.hinges) assert.equal(vertical[h.index] !== 0, Math.abs(h.a[0] - h.b[0]) < 1e-12, "within 18 degrees of 80");
  const few = hingeAngles(big, foldOptions({ select: "share", share: 0.3 })), many = hingeAngles(big, foldOptions({ select: "share", share: 0.6 }));
  const chosen = (angles: Float64Array) => angles.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
  assert.ok(chosen(few) > 0 && chosen(few) < chosen(many) && chosen(many) < big.hinges.length);
  few.forEach((v, i) => { if (v !== 0) assert.notEqual(many[i], 0); });
  assert.equal(chosen(hingeAngles(big, foldOptions({ select: "share", share: 0 }))), 0);
  assert.equal(chosen(hingeAngles(big, foldOptions({ select: "share", share: 1 }))), big.hinges.length);
});

// ------------------------------------------------------------------------------------ rigid folding

const unitDot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossOf = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The rigid-body and hinge invariants of a folded sheet, checked from posed coordinates alone. */
function assertRigid(folded: FoldedPanels): void {
  const { tiling } = folded, scale = Math.max(1, tiling.diameter), tolerance = 1e-11 * scale;
  for (const p of tiling.panels) {
    const posed = p.corners.map(([u, v]) => panelPoint(folded, p.index, u, v));
    for (let i = 0; i < posed.length; i++) for (let j = i + 1; j < posed.length; j++)
      near(Math.hypot(...(sub(posed[i], posed[j]) as [number, number, number])), Math.hypot(p.corners[i][0] - p.corners[j][0], p.corners[i][1] - p.corners[j][1]), 1e-12);
    const n = crossOf(sub(posed[1], posed[0]), sub(posed[2], posed[0]));
    const length = Math.hypot(n[0], n[1], n[2]);
    const front = panelNormal(folded, p.index);
    near(Math.hypot(...front), 1, 1e-12);
    assert.ok(unitDot(front, n) / length > 1 - 1e-12, "orientation is preserved: the front stays the front");
  }
  for (const h of tiling.hinges) {
    if (folded.report[h.index].kind !== "tree") continue;
    for (const end of [h.a, h.b]) {
      const a = panelPoint(folded, h.panels[0], end[0], end[1]), b = panelPoint(folded, h.panels[1], end[0], end[1]);
      assert.ok(Math.hypot(...(sub(a, b) as [number, number, number])) <= tolerance, `hinge ${h.id} ends are coincident`);
    }
    // magnitude of the dihedral angle from the two fronts' normals alone
    const na = panelNormal(folded, h.panels[0]), nb = panelNormal(folded, h.panels[1]);
    near(Math.acos(Math.max(-1, Math.min(1, unitDot(na, nb)))) * RAD, Math.abs(folded.angles[h.index]), 1e-7);
  }
}

test("rigid invariants hold on every source for random angles, anchors and both tree policies", () => {
  let state = 12345;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x1_0000_0000; };
  for (const options of [tilingOptions({ columns: 6, rows: 5 }), tilingOptions({ source: "triangle", columns: 5, rows: 4 }), tilingOptions({ source: "brick", columns: 5, rows: 5 }), tilingOptions({ source: "penrose", depth: 3 })]) {
    const t = panelTiling(options);
    for (const [tree, anchors] of [["breadth", 1], ["strongest", 3]] as const) {
      const angles = t.hinges.map(() => (random() * 2 - 1) * MAX_FOLD_ANGLE);
      const folded = foldPanels(t, angles, closure({ tree, anchors, anchor: "center" }));
      assertRigid(folded);
      assert.equal(folded.counts.tree + folded.counts.roots, t.panels.length, "a forest: panels = tree hinges + roots");
      assert.equal(folded.counts.tree + folded.counts.realized + folded.counts.offAngle + folded.counts.open, t.hinges.length);
    }
  }
});

test("the flat state is the identity: amount 0 poses every panel where the tiling put it", () => {
  for (const options of [tilingOptions({ columns: 5, rows: 4 }), tilingOptions({ source: "triangle" }), tilingOptions({ source: "brick" }), tilingOptions({ source: "penrose", depth: 2 })]) {
    const t = panelTiling(options);
    const folded = foldPanels(t, hingeAngles(t, foldOptions({ rule: "seeded", angle: 120, amount: 0 })), closure({ anchor: "seeded" }));
    for (const p of t.panels) for (const [u, v] of p.corners) assert.deepEqual(panelPoint(folded, p.index, u, v), [u + 0, 0, -v + 0], "exact, not close");
    assert.ok(folded.report.every((r) => r.kind === "tree" || r.kind === "realized"), "nothing conflicts when nothing folds");
    assert.equal(folded.counts.open + folded.counts.offAngle, 0);
    const mesh = posedPanels(folded, { gap: 0, thickness: 0 }).mesh;
    near(meshMeasures(mesh).area, t.panels.reduce((s, p) => s + p.area, 0), 1e-12);
    assert.equal(meshMeasures(mesh).bounds.max[1], 0);
  }
});

test("tree hinges read back exactly through the mesh topology: dihedral angle = requested, sign = mountain positive", () => {
  for (const options of [tilingOptions({ columns: 5, rows: 4 }), tilingOptions({ source: "triangle", columns: 5, rows: 4 }), tilingOptions({ source: "penrose", depth: 3 })]) {
    const t = panelTiling(options);
    const angles = Array.from(hingeAngles(t, foldOptions({ rule: "seeded", angle: 120, seed: 9 })));
    const folded = foldPanels(t, angles, closure({ anchor: "center" }));
    const posed = posedPanels(folded, { gap: 0, thickness: 0 });
    const topology = meshTopology(posed.mesh);
    const byPair = new Map(t.hinges.map((h) => [[...h.panels].sort((a, b) => a - b).join(","), h.index]));
    let checked = 0;
    for (let e = 0; e < topology.counts.edges; e++) {
      if (meshEdgeClass(topology, e) !== "manifold") continue;
      const pair = meshEdgeFaces(topology, e).map((f) => posed.panelOfFace[f]).sort((a, b) => a - b).join(",");
      const h = byPair.get(pair);
      assert.notEqual(h, undefined, "every welded manifold edge is a hinge");
      near(meshEdgeAngle(topology, e), folded.report[h!].kind === "tree" ? angles[h!] : folded.report[h!].achieved, 1e-9);
      checked++;
    }
    assert.equal(checked, folded.counts.tree + folded.counts.realized + folded.counts.offAngle, "closed hinges are the shared edges, open ones are cracks");
    // a single ridge and a single valley by hand
    const pair = panelTilingFromPolygons({ seed: 1, id: "pair", panels: [{ id: "a", corners: [[0, 0], [1, 0], [1, 1], [0, 1]] }, { id: "b", corners: [[1, 0], [2, 0], [2, 1], [1, 1]] }], hinges: [{ panels: ["a", "b"], a: [1, 0], b: [1, 1] }] });
    for (const angle of [60, -60, 0, 179]) {
      const two = foldPanels(pair, [angle], closure({ anchor: "corner" }));
      const m = posedPanels(two, { gap: 0, thickness: 0 }).mesh, top = meshTopology(m);
      const edge = [...Array(top.counts.edges).keys()].find((k) => meshEdgeClass(top, k) === "manifold")!;
      near(meshEdgeAngle(top, edge), angle, 1e-9);
      // ridge: the far panel dips below the anchored one
      near(panelPoint(two, 1, 2, 0)[1], -Math.sin(angle / RAD), 1e-12);
    }
  }
});

test("closure: consistent, off-angle and open hinges are told apart with their analytic gaps", () => {
  const t = panelTiling(tilingOptions({ columns: 2, rows: 2 }));
  const H0 = "h:q:0,0|q:0,1", H1 = "h:q:1,0|q:1,1", V0 = "h:q:0,0|q:1,0", V1 = "h:q:0,1|q:1,1";
  // Both horizontal hinges fold the same way, the vertical ones stay flat: a 4-cycle that closes for any spanning tree.
  for (const tree of ["breadth", "strongest"] as const) {
    const ok = foldPanels(t, angleMap(t, { [H0]: 40, [H1]: 40 }), closure({ tree }));
    assert.deepEqual([ok.counts.tree, ok.counts.realized, ok.counts.offAngle, ok.counts.open], [3, 1, 0, 0]);
    const closed = ok.report.find((r, i) => ok.report[i].kind === "realized")!;
    assert.ok(closed.gap === 0 || closed.gap < 1e-12);
    assertRigid(ok);
  }
  // Opposite folds on the two horizontal hinges: from the corner anchor with the strongest-first tree, the tree takes
  // both horizontal hinges, so the vertical hinge V1 is left, and its far end is 2 sin(40 degrees) apart (a rotation of 80).
  const conflict = foldPanels(t, angleMap(t, { [H0]: 40, [H1]: -40 }), closure({ tree: "strongest" }));
  assert.deepEqual([conflict.counts.tree, conflict.counts.open, conflict.counts.offAngle], [3, 1, 0]);
  const open = conflict.report[hingeIndex(t, V1)];
  assert.equal(open.kind, "open");
  near(open.gap, 2 * Math.sin(40 / RAD), 1e-12);
  assert.ok(Number.isNaN(open.achieved));
  // Nearest first from the corner anchor takes V0, H0 and then V1, so H1 is the hinge left. Asked for the opposite fold to H0,
  // its ends still meet (it is collinear with H0) but the panels make +40 there, not -40: a conflict at a closed hinge.
  const off = foldPanels(t, angleMap(t, { [H0]: 40, [H1]: -40 }), closure({ tree: "breadth" }));
  const clash = off.report[hingeIndex(t, H1)];
  assert.equal(clash.kind, "off-angle");
  near(clash.achieved, 40, 1e-9);
  assert.equal(clash.requested, -40);
  assert.ok(clash.gap < 1e-12);
  assert.deepEqual([off.counts.tree, off.counts.offAngle, off.counts.open, off.counts.realized], [3, 1, 0, 0]);
  // Maximum spanning tree on a cycle drops the weakest hinge: distinct magnitudes 10, 20, 30, 40
  const strong = foldPanels(t, angleMap(t, { [H0]: 40, [H1]: -30, [V0]: 20, [V1]: 10 }), closure({ tree: "strongest" }));
  assert.equal(strong.report[hingeIndex(t, V1)].kind === "tree", false, "the weakest hinge is the one dropped");
  assert.ok([H0, H1, V0].every((id) => strong.report[hingeIndex(t, id)].kind === "tree"));
  // Nearest first differs: the tree grows outward from the anchor whatever the angles
  const near1 = foldPanels(t, angleMap(t, { [H0]: 40, [H1]: -30, [V0]: 20, [V1]: 10 }), closure({ tree: "breadth" }));
  assert.equal(near1.report[hingeIndex(t, V0)].kind, "tree");
  assert.equal(near1.report[hingeIndex(t, H0)].kind, "tree");
  assert.equal(near1.report[hingeIndex(t, H1)].kind === "tree", false, "the hinge farthest from the corner anchor is the one dropped");
});

test("uniform folds on a square vertex cannot close, and the cracks are exactly the non-tree hinges", () => {
  const t = panelTiling(tilingOptions({ columns: 5, rows: 4 }));
  const folded = foldPanels(t, hingeAngles(t, foldOptions({ angle: 50 })), closure({ anchor: "center" }));
  assert.equal(folded.counts.tree, 19);
  assert.equal(folded.counts.open + folded.counts.offAngle + folded.counts.realized, t.hinges.length - 19);
  assert.ok(folded.counts.open > 0);
  const topology = meshTopology(posedPanels(folded, { gap: 0, thickness: 0 }).mesh);
  // welded sheet: outline 2(c + r) edges plus two boundary edges per open hinge (each panel's own side of the crack)
  assert.equal(meshBoundaryEdges(topology).length, 2 * (5 + 4) + 2 * folded.counts.open);
  assert.equal(topology.counts.faces, 20);
  assert.equal(topology.counts.euler, topology.counts.usedVertices - topology.counts.edges + topology.counts.faces);
  for (const r of folded.report) if (r.kind === "open") assert.ok(r.gap > 1e-6 && Number.isNaN(r.achieved));
});

test("anchors stay put, are spread apart, and islands cut loose by retention stay flat where they were", () => {
  const t = panelTiling(tilingOptions({ columns: 7, rows: 7 }));
  const angles = hingeAngles(t, foldOptions({ angle: 60, rule: "seeded" }));
  const folded = foldPanels(t, angles, closure({ anchor: "corner", anchors: 2 }));
  assert.equal(folded.anchors, 2);
  assert.equal(t.panels[folded.roots[0]].id, "q:0,0");
  assert.equal(t.panels[folded.roots[1]].id, "q:6,6", "the second anchor is the panel farthest from the first");
  for (const root of folded.roots) for (const [u, v] of t.panels[root].corners) assert.deepEqual(panelPoint(folded, root, u, v), [u + 0, 0, -v + 0]);
  // retention islands: every panel not reached from an anchor becomes an extra flat root
  const sparse = panelTiling(tilingOptions({ columns: 9, rows: 9, retention: 0.55 }));
  const f2 = foldPanels(sparse, hingeAngles(sparse, foldOptions({ angle: 60 })), closure({ anchor: "center" }));
  assert.ok(f2.counts.strays > 0, "a random half of the panels leaves islands");
  assert.equal(f2.counts.roots, 1 + f2.counts.strays);
  for (const root of f2.roots) for (const [u, v] of sparse.panels[root].corners) assert.deepEqual(panelPoint(f2, root, u, v), [u + 0, 0, -v + 0]);
  assert.equal(f2.counts.tree + f2.counts.roots, sparse.panels.length);
  assertRigid(f2);
  // every panel's parent chain ends at a root, parents come first
  const position = new Map(Array.from(f2.order).map((panel, i) => [panel, i]));
  for (const p of sparse.panels) if (f2.parent[p.index] >= 0) assert.ok(position.get(f2.parent[p.index])! < position.get(p.index)!);
});

test("bounded angles and inputs fail naming the control", () => {
  const t = panelTiling(tilingOptions({ columns: 2, rows: 2 }));
  assert.throws(() => foldPanels(t, t.hinges.map(() => 180), closure()), /Fold angle 180 .*exceeds 179/);
  assert.throws(() => foldPanels(t, t.hinges.map(() => NaN), closure()), /not a finite number/);
  assert.throws(() => foldPanels(t, [1, 2], closure()), /one angle per hinge/);
  assert.throws(() => foldPanels(t, t.hinges.map(() => 0), closure({ anchors: 17 })), /Anchors/);
  assert.throws(() => foldPanels(t, t.hinges.map(() => 0), closure({ tree: "depth" as never })), /Spanning tree/);
  assert.throws(() => hingeAngles(t, foldOptions({ angle: 180 })), /Fold angle/);
  assert.throws(() => hingeAngles(t, foldOptions({ amount: 1.5 })), /Fold amount/);
  assert.throws(() => panelTiling(tilingOptions({ columns: 100, rows: 100 })), /Columns and Rows/);
  assert.throws(() => panelTiling(tilingOptions({ columns: 1.5 })), /Columns/);
  assert.throws(() => panelTiling(tilingOptions({ retention: 0 })), /Panel retention/);
  assert.throws(() => panelTiling(tilingOptions({ source: "penrose", depth: 9 })), /Depth/);
  assert.throws(() => panelTiling(tilingOptions({ source: "penrose", patch: "star" })), /Seed patch/);
  const folded = foldPanels(t, t.hinges.map(() => 10), closure());
  assert.throws(() => posedPanels(folded, { gap: 0.95, thickness: 0 }), /Gap between panels/);
  assert.throws(() => posedPanels(folded, { gap: 0, thickness: 5 }), /Thickness/);
  assert.equal(MAX_PANELS, 4000);
});

// ------------------------------------------------------------------------------------ posed mesh

test("posed meshes keep panel areas and normals; gaps shrink by (1 - gap)^2; slabs are closed with volume area x thickness", () => {
  const t = panelTiling(tilingOptions({ source: "penrose", depth: 2 }));
  const folded = foldPanels(t, hingeAngles(t, foldOptions({ rule: "seeded", angle: 100 })), closure({ anchor: "center" }));
  const thin = posedPanels(folded, { gap: 0, thickness: 0 });
  for (const p of t.panels) {
    const face = thin.frontFace[p.index];
    assert.equal(thin.panelOfFace[face], p.index);
    near(faceArea(thin.mesh, face), p.area, 1e-11);
    const n = faceNormal(thin.mesh, face), expected = panelNormal(folded, p.index);
    for (let k = 0; k < 3; k++) near(n[k], expected[k], 1e-11);
  }
  assert.equal(thin.mesh.faceCount, t.panels.length);
  const gap = posedPanels(folded, { gap: 0.2, thickness: 0 });
  assert.equal(gap.welded, false);
  for (const p of t.panels) near(faceArea(gap.mesh, gap.frontFace[p.index]), p.area * 0.64, 1e-11);
  const slab = posedPanels(folded, { gap: 0, thickness: 0.3 });
  assert.equal(slab.mesh.faceCount, t.panels.reduce((n, p) => n + 2 + p.corners.length, 0), "front, back and one side per corner");
  const topology = meshTopology(slab.mesh);
  assert.equal(topology.kind, "closed-manifold");
  assert.equal(meshComponents(slab.mesh, topology).length, t.panels.length);
  near(meshMeasures(slab.mesh).signedVolume, 0.3 * t.panels.reduce((s, p) => s + p.area, 0), 1e-9);
  for (const p of t.panels) assert.equal(slab.roleOfFace[slab.frontFace[p.index]], 0);
});

test("camera and appearance never rebuild the pose or the mesh; structure does", () => {
  const input = createInstrument(ID);
  const base = hingedPanelsComposition(input);
  const baseProducts = hingedProducts(base), basePosed = hingedPosed(base, baseProducts);
  const edited = (params: Record<string, number | string | boolean>) => {
    const next = createInstrument(ID);
    Object.assign(next.params, params);
    return hingedPanelsComposition(next);
  };
  for (const params of [{ yaw: 100, pitch: 10 }, { projection: "orthographic" }, { roll: 30, size: 400, centerX: 200 }, { fill: "flat", colorBy: "height", shade: 0.2 }, { lines: "none", hatch: true },
    { motif: "rosette" }, { lightAzimuth: 90 }, { fit: "sheet" }]) {
    const recipe = edited(params);
    assert.equal(hingedProducts(recipe).folded, baseProducts.folded, `folded pose reused for ${JSON.stringify(params)}`);
    assert.equal(hingedPosed(recipe).mesh.key, basePosed.mesh.key);
    assert.equal(hingedPosed(recipe), basePosed);
  }
  const cameraA = hingedCamera(base, basePosed), cameraB = hingedCamera(edited({ yaw: 100 }), basePosed);
  assert.notEqual(cameraA.key, cameraB.key);
  for (const params of [{ angle: 39 }, { disorder: 0.5 }, { columns: 11 }, { gap: 0.1 }, { thickness: 0.1 }, { anchors: 2 }, { tree: "strongest" }, { amount: 0.9 }, { retention: 0.9 }]) {
    assert.notEqual(hingedPosed(edited(params)).mesh.key, basePosed.mesh.key, `${JSON.stringify(params)} is structure`);
  }
  // the view stage is keyed by mesh and camera: the same camera returns the same order object
  assert.equal(hingedView(base, basePosed).order, hingedView(edited({ fill: "flat" }), basePosed).order);
  assert.notEqual(hingedView(edited({ yaw: 100 }), basePosed).order, hingedView(base, basePosed).order);
});

// ------------------------------------------------------------------------------------ drawing

function recorder() {
  const calls: { name: string; args: unknown[] }[] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" }, {
    get(target, key) {
      if (key in target) return (target as Record<string | symbol, unknown>)[key];
      return (...args: unknown[]) => { calls.push({ name: String(key), args }); };
    },
  }) as unknown as CompositionSurface;
  return { surface, calls };
}
const drawn = (params: Record<string, number | string | boolean>, seed = 42) => {
  const input = createInstrument(ID);
  input.seed = seed;
  Object.assign(input.params, params);
  const r = recorder();
  drawInstrument(r.surface as never, input);
  return r.calls;
};
const count = (calls: { name: string }[], name: string) => calls.filter((c) => c.name === name).length;
const plain = { fill: "none", lines: "none", hatch: false, motif: "none", open: false };

test("a folded drawing is a transparent layer that paints every triangle once in the painter's order", () => {
  const params = { ...plain, fill: "flat", opacity: 1, columns: 4, rows: 3, rule: "uniform", disorder: 0, angle: 25, pitch: 50, yaw: 20, projection: "orthographic" };
  const calls = drawn(params);
  assert.ok(!calls.some((c) => ["background", "clear", "rect"].includes(c.name)), "transparent layer");
  assert.equal(count(calls, "beginShape"), 24, "12 quads = 24 triangles, one filled shape each");
  assert.equal(count(calls, "push"), count(calls, "pop"));
  // the far corner is painted before the near one: painter order runs far to near along the tilted sheet
  const input = createInstrument(ID);
  Object.assign(input.params, params);
  const recipe = hingedPanelsComposition(input), posed = hingedPosed(recipe);
  const view = hingedView(recipe, posed);
  assert.equal(view.order.order.length, 24);
  assert.equal(new Set(view.order.order).size, 24, "every triangle once");
  assert.equal(view.order.cycleBreaks, 0, "a gentle fold has no cyclic overlap");
});

test("hatch lines follow analytic counts in the flat crease pattern, and hidden controls do not change it", () => {
  const base = { ...plain, treatment: "crease", columns: 4, rows: 3, hatch: true, hatchAngle: 0, hatchSpacing: 0.25, fill: "none", lines: "none", gap: 0 };
  const calls = drawn(base);
  // unit panels: lines at v = k/4 + 1/8 fall inside every panel: four per panel
  assert.equal(count(calls, "line"), 4 * 12);
  assert.deepEqual(drawn({ ...base, yaw: 120, pitch: 5, projection: "orthographic", thickness: 0.3, hidden: "faint", shade: 0.1, lightAzimuth: 30, fit: "sheet" }), calls, "camera, thickness and light are hidden in the crease pattern");
  // a gap shrinks every panel: an outline of (1 - gap) leaves fewer hatch lines than panels of full size
  const gapped = drawn({ ...base, gap: 0.5 });
  assert.equal(count(gapped, "line"), 2 * 12, "half-size panels at spacing 1/4 hold two lines each");
  // motifs: one mark per panel in the crease pattern
  assert.equal(count(drawn({ ...plain, treatment: "crease", motif: "dot", motifVariation: 0, columns: 4, rows: 3 }), "circle"), 12);
});

test("panel motifs are hidden with their panels: a wall in front hides the panel behind it", () => {
  // Two squares folded 90 degrees valley: the second stands up at x = 1 and hides the first from the +x side.
  const two = panelTilingFromPolygons({ seed: 1, id: "book", panels: [{ id: "a", corners: [[0, 0], [1, 0], [1, 1], [0, 1]] }, { id: "b", corners: [[1, 0], [2, 0], [2, 1], [1, 1]] }], hinges: [{ panels: ["a", "b"], a: [1, 0], b: [1, 1] }] });
  const folded = foldPanels(two, [-90], closure({ anchor: "corner" }));
  near(panelPoint(folded, 1, 2, 0)[1], 1, 1e-12);
  near(panelPoint(folded, 1, 2, 0)[0], 1, 1e-12);
  const surfaceFor = (yaw: number) => {
    const input = createInstrument(ID);
    Object.assign(input.params, { ...plain, motif: "dot", motifVariation: 0, motifSize: 0.3, columns: 2, rows: 1, source: "square" });
    const recipe = hingedPanelsComposition(input);
    return { recipe: { ...recipe, fold: { ...recipe.fold }, view: { ...recipe.view, yaw, pitch: 15, projection: "orthographic" as const } } };
  };
  const circles = (yaw: number) => {
    const { recipe } = surfaceFor(yaw);
    const rec = recorder();
    drawHingedPanels(rec.surface, { ...recipe, fold: { ...recipe.fold, rule: "uniform", angle: 90, direction: "valley", disorder: 0, select: "axis", axis: 90 } });
    return count(rec.calls, "circle");
  };
  // 2 x 1 squares: the single hinge is vertical; a valley fold stands panel b up. From +x (yaw 90) b hides a; from -x it is the other way; from the front both show.
  assert.equal(circles(40), 2, "seen obliquely from the front both panels are visible");
  const fromPlusX = circles(90), fromMinusX = circles(-90);
  assert.equal(fromPlusX, 1, "the standing panel hides its neighbour");
  assert.equal(fromMinusX, 2, "from the other side the standing panel is in the background: both show");
});

test("the crease pattern marks mountains, valleys and cracks in their conventional styles", () => {
  const params = { ...plain, treatment: "crease", columns: 3, rows: 3, lines: "folds", rule: "checker", disorder: 0, angle: 40, period: 1 };
  const calls = drawn(params);
  assert.ok(calls.filter((c) => c.name === "line").length > 0, "dashes are line calls");
  const flat = drawn({ ...params, angle: 0 });
  assert.equal(count(flat, "line") + count(flat, "endShape"), 0, "with no fold, mode 'folds' draws nothing");
  const all = drawn({ ...params, lines: "hinges", angle: 0 });
  assert.equal(count(all, "endShape"), 12, "12 flat hinges of a 3 x 3 sheet, drawn thin and solid");
  const outline = drawn({ ...params, lines: "panels", angle: 0 });
  assert.equal(count(outline, "endShape"), 12 + 12, "hinges plus twelve outline edges");
  const cracks = drawn({ ...params, lines: "none", open: true, rule: "uniform", angle: 50, anchor: "center" });
  assert.ok(count(cracks, "line") > 0, "cracks are dotted lines");
});

test("edge-only drawings stay legible: hinges are hidden behind panels and shown otherwise", () => {
  const params = { ...plain, fill: "none", lines: "hinges", columns: 6, rows: 6, rule: "uniform", angle: 35, disorder: 0, hinges: "axis", hingeAxis: 0, pitch: 25, yaw: 0, projection: "orthographic", hidden: "drop" };
  const dropped = count(drawn(params), "endShape"), faint = drawn({ ...params, hidden: "faint" });
  assert.ok(dropped > 0);
  assert.ok(count(faint, "endShape") > dropped, "faint keeps the hidden lengths as extra runs");
  // an accordion viewed edge-on hides every hinge except those on the near silhouette; solid thickness hides more
  const withSlabs = count(drawn({ ...params, thickness: 0.4 }), "endShape");
  assert.ok(withSlabs <= dropped + 2 * 36);
});

test("tones follow the structure they are named for", () => {
  const t = panelTiling(tilingOptions({ columns: 4, rows: 3 }));
  const folded = foldPanels(t, angleMap(t, { "h:q:0,0|q:1,0": 30, "h:q:1,0|q:2,0": -30 }), closure({ anchor: "corner", tree: "breadth" }));
  const cls = panelTones(folded, "class", 5, 1);
  t.panels.forEach((p) => assert.equal(cls[p.index], 1 + p.cls % 4));
  const depth = panelTones(folded, "depth", 5, 1);
  t.panels.forEach((p) => assert.equal(depth[p.index], 1 + folded.depth[p.index] % 4));
  const fold = panelTones(folded, "fold", 5, 1);
  assert.equal(fold[t.panels.findIndex((p) => p.id === "q:0,0")], 1, "the anchor has no fold above it: flat");
  assert.equal(fold[t.panels.findIndex((p) => p.id === "q:1,0")], 2, "a mountain above");
  assert.equal(fold[t.panels.findIndex((p) => p.id === "q:2,0")], 3, "a valley above");
  assert.ok(panelTones(folded, "single", 5, 1).every((v) => v === 1));
  assert.ok(panelTones(folded, "height", 1, 1).every((v) => v === 0), "one colour: all ink");
  const tilt = panelTones(folded, "tilt", 5, 1);
  assert.equal(tilt[t.panels.findIndex((p) => p.id === "q:0,0")], 1, "flat panels are the lowest tone");
});

test("hingedCurves labels folds by sign, flat hinges, cracks and outline", () => {
  const t = panelTiling(tilingOptions({ columns: 3, rows: 3 }));
  const folded = foldPanels(t, hingeAngles(t, foldOptions({ rule: "checker", angle: 40, period: 1 })), closure({ anchor: "center" }));
  const folds = hingedCurves(folded, "folds", false);
  assert.ok(folds.every((c) => c.tone === 0 || c.tone === 1), "folds have a sign");
  const every = hingedCurves(folded, "hinges", false);
  assert.ok(every.length >= folds.length);
  assert.equal(hingedCurves(folded, "none", false).length, 0);
  const cracks = hingedCurves(folded, "none", true);
  assert.equal(cracks.length, 2 * folded.counts.open, "every open hinge is two edges, one per panel");
  assert.ok(cracks.every((c) => c.tone === 3));
  const outline = hingedCurves(folded, "panels", false).filter((c) => c.tone === 4);
  assert.equal(outline.length, 12);
});

// ------------------------------------------------------------------------------------ the instrument

test("the instrument: controls, groups, seed use and declared visibility", () => {
  const input = createInstrument(ID);
  assert.equal(definition(ID).title, "Hinged Panels");
  assert.deepEqual(validateInstrument(input).params, input.params);
  const values = { ...input.params };
  const shown = (v: Record<string, number | string | boolean>) => new Set(visibleParameters(ID, v).map((p) => p.key));
  assert.ok(shown({ ...values, source: "square" }).has("columns") && !shown({ ...values, source: "penrose" }).has("columns") && shown({ ...values, source: "penrose" }).has("depth"));
  assert.ok(!shown({ ...values, rule: "uniform" }).has("period") && shown({ ...values, rule: "checker" }).has("period") && !shown({ ...values, rule: "checker" }).has("direction"));
  assert.ok(!shown({ ...values, rule: "seeded" }).has("disorder") && shown({ ...values, rule: "radial" }).has("disorder"));
  assert.ok(!shown({ ...values, treatment: "crease" }).has("yaw") && !shown({ ...values, treatment: "crease" }).has("thickness") && shown({ ...values, treatment: "folded" }).has("thickness"));
  assert.ok(!shown({ ...values, treatment: "folded", projection: "orthographic" }).has("perspective") && shown({ ...values, treatment: "folded", projection: "perspective" }).has("perspective"));
  assert.ok(!shown({ ...values, treatment: "crease", projection: "perspective" }).has("perspective"), "a chain: hidden under a hidden driver");
  assert.ok(!shown({ ...values, fill: "flat" }).has("shade") && shown({ ...values, fill: "shaded" }).has("shade") && !shown({ ...values, fill: "none" }).has("opacity"));
  assert.ok(!shown({ ...values, hinges: "all" }).has("hingeAxis") && shown({ ...values, hinges: "axis" }).has("hingeAxis") && shown({ ...values, hinges: "share" }).has("hingeShare"));
  assert.ok(!shown({ ...values, motif: "none" }).has("motifSize") && !shown({ ...values, motif: "dot" }).has("motifWeight") && shown({ ...values, motif: "arrow" }).has("motifWeight"));
  const groups = inspectorItems(ID, values).map((g) => ("label" in g ? g.label : ""));
  assert.deepEqual(groups.slice(0, 4), ["Panels", "Fold", "Closure", "Body"]);
  const seeded = (over: Record<string, number | string | boolean>): boolean => usesSeed({ ...input, params: { ...values, ...over } });
  const none = { retention: 1, rule: "uniform", disorder: 0, hinges: "all", anchor: "center", motif: "none", colorBy: "class" };
  assert.equal(seeded(none), false);
  for (const over of [{ retention: 0.8 }, { rule: "seeded" }, { disorder: 0.1 }, { hinges: "share", hingeShare: 0.5 }, { anchor: "seeded" }, { motif: "dot", motifVariation: 0.3 }, { colorBy: "panel", fill: "flat" }])
    assert.equal(seeded({ ...none, ...over }), true, JSON.stringify(over));
  assert.equal(seeded({ ...none, hinges: "share", hingeShare: 1 }), false, "everything chosen: nothing left to chance");
  assert.equal(seeded({ ...none, colorBy: "panel", fill: "none" }), false);
  // the drawing does not depend on the seed when nothing uses it
  assert.deepEqual(drawn(none, 1), drawn(none, 2));
  assert.notDeepEqual(drawn({ ...none, disorder: 0.5 }, 1), drawn({ ...none, disorder: 0.5 }, 2));
  // slider intervals sit inside hard limits; the hard limit on angle is the geometric one
  const angle = definition(ID).parameters.find((p) => p.key === "angle")!;
  assert.equal((angle as { hardMax?: number }).hardMax, MAX_FOLD_ANGLE);
  assert.throws(() => validateInstrument({ ...input, params: { ...values, angle: 180 } }), /angle/i);
});

test("the instrument prepares and draws every source and treatment, and an oversized sheet is refused naming the control", async () => {
  for (const source of ["square", "triangle", "brick", "penrose"]) for (const treatment of ["folded", "crease"]) {
    const input = createInstrument(ID);
    Object.assign(input.params, { source, treatment, columns: 6, rows: 5, depth: 2, thickness: 0.1, motif: "arrow", hatch: true, lines: "panels", open: true });
    assert.equal(await prepareInstrument(input, () => false), true);
    assert.ok(count(drawn({ source, treatment, columns: 6, rows: 5, depth: 2, thickness: 0.1, motif: "arrow", hatch: true, lines: "panels", open: true }), "push") > 0);
  }
  const big = createInstrument(ID);
  Object.assign(big.params, { columns: 100, rows: 100 });
  assert.throws(() => drawInstrument(recorder().surface as never, big), /Columns and Rows/);
  const cancelled = createInstrument(ID);
  assert.equal(await prepareInstrument(cancelled, () => true), false);
});
