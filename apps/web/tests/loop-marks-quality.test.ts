import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { geometryDefinitions, drawGeometry } from "../lib/adapters/geometry";
import { buildLoopMarks } from "../lib/adapters/loop-marks-quality";
import type { Layer } from "../lib/studio-types";

const definition = geometryDefinitions.find(item => item.id === "loop-marks")!;
function layer(edits: Record<string, string | number | boolean> = {}): Layer {
  return { id: "loop-quality-test", technique: "loop-marks", visible: true, opacity: 1, seed: 42,
    palette: [0x1f3b51, 0xe38355, 0xc5ad79, 0x61a19b], cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: { ...definition.defaults, ...edits } };
}
function commands(input: Layer) {
  const output: { name: string; values: unknown[] }[] = [];
  const p = new Proxy({ CLOSE: "CLOSE" } as Record<string, unknown>, { get(target, name: string) {
    if (name in target) return target[name];
    return (...values: unknown[]) => { for (const value of values)
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${name} has finite coordinates`);
      output.push({ name, values }); };
  } });
  drawGeometry(p, input);
  return output;
}
const digest = (marks: ReturnType<typeof commands>) => createHash("sha256").update(JSON.stringify(marks)).digest("hex");

test("modern schema exposes independent construction and hides legacy fields", () => {
  const visible = definition.parameters.filter(parameter => !parameter.hidden).map(parameter => parameter.key);
  for (const key of ["layout", "loopCount", "columns", "spacingX", "spacingY", "centerX", "centerY",
    "radiusX", "radiusY", "nestedScale", "knotCount", "lobes", "lobeDepth", "phase",
    "subdivisions", "treatment", "tileShape", "tileSpacing", "tileWidth", "tileHeight", "outlineWeight", "fanOpacity"])
    assert.ok(visible.includes(key), key);
  for (const key of ["legacy", "tileScale", "opacity", "fans", "moved"])
    assert.ok(definition.parameters.some(parameter => parameter.key === key && parameter.hidden), key);
  assert.equal(definition.defaults.legacy, false);
});

test("row, grid, and nested layouts change retained centers and radii", () => {
  const row = buildLoopMarks(layer({ layout: "row", loopCount: 3, spacingX: 100, spacingY: 30 }).params);
  assert.deepEqual(row.loops.map(loop => loop.center), [[220, 290], [320, 320], [420, 350]]);
  const grid = buildLoopMarks(layer({ layout: "grid", loopCount: 5, columns: 3, spacingX: 100, spacingY: 80 }).params);
  assert.deepEqual(grid.loops.map(loop => loop.center), [[220, 280], [320, 280], [420, 280], [270, 360], [370, 360]]);
  const nested = buildLoopMarks(layer({ layout: "nested", loopCount: 3, nestedScale: .5, lobes: 0 }).params);
  assert.deepEqual(nested.loops.map(loop => loop.center), [[320, 320], [320, 320], [320, 320]]);
  const extents = nested.loops.map(loop => Math.max(...loop.points.map(point => point[0])) - 320);
  assert.ok(Math.abs(extents[1] / extents[0] - .5) < .01);
  assert.ok(Math.abs(extents[2] / extents[1] - .5) < .01);
});

test("base knots and harmonic lobes change contour independently of treatment", () => {
  const base = layer({ layout: "row", loopCount: 1, treatment: "outline", lobes: 0 });
  const smooth = buildLoopMarks(base.params).loops[0].points;
  const lobed = buildLoopMarks({ ...base.params, lobes: 12, lobeDepth: .5 }).loops[0].points;
  assert.notDeepEqual(lobed, smooth);
  assert.equal(lobed.length, Number(base.params.knotCount) * Number(base.params.subdivisions));
  assert.notDeepEqual(buildLoopMarks({ ...base.params, knotCount: 5 }).loops[0].points, smooth);
  assert.deepEqual(buildLoopMarks({ ...base.params, treatment: "fans" }).loops[0].points, smooth);
});

test("four treatments and three tiles produce distinct transparent commands", () => {
  for (const treatment of ["outline", "tiles", "fans", "outline-tiles"]) {
    const marks = commands(layer({ treatment }));
    assert.equal(marks.some(mark => ["background", "image", "rect"].includes(mark.name)), false);
    assert.equal(marks.some(mark => mark.name === "triangle"), treatment === "fans");
    assert.equal(marks.some(mark => mark.name === "vertex"), treatment === "tiles" || treatment === "outline-tiles");
    assert.equal(marks.some(mark => mark.name === "line"), treatment === "outline" || treatment === "outline-tiles");
  }
  const bar = commands(layer({ treatment: "tiles", tileShape: "bar" }));
  const diamond = commands(layer({ treatment: "tiles", tileShape: "diamond" }));
  const tick = commands(layer({ treatment: "tiles", tileShape: "tick" }));
  assert.notEqual(digest(bar), digest(diamond));
  assert.equal(tick.some(mark => mark.name === "vertex"), false);
  assert.ok(tick.some(mark => mark.name === "line"));
});

test("combined work and numeric domains fail before paint", () => {
  const invalid: Record<string, string | number | boolean>[] = [{ loopCount: 16, knotCount: 16, subdivisions: 64 },
    { layout: "grid", loopCount: 16, radiusX: 500, radiusY: 500, lobes: 12, lobeDepth: .8,
      treatment: "tiles", tileSpacing: 4 },
    { loopCount: 1.5 }, { radiusX: 0 }, { phase: 181 }, { layout: "single" }];
  for (const edits of invalid) {
    const input = layer(edits);
    assert.throws(() => definition.validate?.(input.params));
    assert.throws(() => commands(input));
  }
  assert.doesNotThrow(() => commands(layer({ loopCount: 1, centerX: -320, centerY: 960,
    radiusX: 4, radiusY: 500, phase: -180, lobes: 12, subdivisions: 64 })));
});

test("saved legacy commands have stable exact signatures", () => {
  const cases = [
    [{ legacy: true, tileScale: 1, outlineWeight: .8, opacity: 120, fans: false, moved: false }, "6d1e1befc8f42249a59e1c28df52e89d4b1f10b7b3d4c94be485cb2baf069a31"],
    [{ legacy: true, tileScale: 1.7, outlineWeight: 2, opacity: 180, fans: false, moved: true }, "6b389fe716acc8bf36c19a61b89389d5776c0974f80fff957b95bc23f1d82a74"],
    [{ legacy: true, tileScale: 1, outlineWeight: .8, opacity: 120, fans: true, moved: false }, "704d7d4cd59544388ede270a6d09eab005b17a686d8fb35cba72561af0b262ea"],
  ] as const;
  for (const [edits, expected] of cases) {
    const actual = digest(commands(layer(edits)));
    assert.equal(actual, expected);
  }
});
