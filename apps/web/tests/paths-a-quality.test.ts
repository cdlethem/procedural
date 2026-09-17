import assert from "node:assert/strict";
import test from "node:test";
import { pathsADefinitions } from "../lib/adapters/paths-a";
import { drawPaths } from "../lib/adapters/paths";
import { facetSource, polygonSource, roadSource, validatePathsAQuality } from "../lib/adapters/paths-a-quality";
import { drawRoundedPanels } from "../../../packages/javascript/examples/paths-a-studies.js";
import { triangulateSimplePolygon2D } from "../../../packages/javascript/src/triangulate-simple-polygon-2d.js";
import type { Layer } from "../lib/studio-types";

const ids = ["rounded-panels", "road-margins", "nested-contour-strokes", "faceted-silhouettes", "concave-grain"] as const;
function layer(id: typeof ids[number], edits: Record<string, number | string | boolean> = {}): Layer {
  const definition = pathsADefinitions.find(item => item.id === id)!;
  return { id: "path-test", technique: id, visible: true, opacity: 1, seed: 42,
    palette: [0x175d7a, 0xeb9c40, 0xce5552, 0x3e8867, 0x8c60a4], cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...definition.defaults, ...edits } };
}
function commands(input: Layer): { name: string; values: unknown[] }[] {
  const output: { name: string; values: unknown[] }[] = [];
  const p = new Proxy({ CLOSE: "close" } as Record<string, unknown>, {
    get(target, name: string) {
      if (name in target) return target[name];
      return (...values: unknown[]) => {
        for (const value of values) if (typeof value === "number") assert.ok(Number.isFinite(value));
        output.push({ name, values });
      };
    },
  });
  drawPaths(p, input);
  return output;
}

test("each modern path study has an independent source control and transparent output", () => {
  for (const id of ids) {
    const definition = pathsADefinitions.find(item => item.id === id)!;
    assert.ok(definition.parameters.some(parameter => parameter.key === "legacy" && parameter.hidden));
    const base = layer(id);
    definition.validate?.(base.params);
    const current = commands(base);
    assert.ok(current.some(command => ["vertex", "line", "circle"].includes(command.name)), id);
    assert.equal(current.some(command => ["background", "rect", "square", "image"].includes(command.name)), false, id);
    const sourceEdit: Record<string, number> = id === "road-margins" ? { turns: Number(base.params.turns) + 1 } : { sides: Number(base.params.sides) + 1 };
    assert.ok(JSON.stringify(commands(layer(id, sourceEdit))) !== JSON.stringify(current), id);
  }
});

test("panels separate topology, corner cuts, layout and fill treatment", () => {
  const base = layer("rounded-panels");
  const source = polygonSource(base.params, 320, 320, 60);
  assert.equal(source.length, 6);
  assert.equal(polygonSource({ ...base.params, notch: 0, sides: 3 }, 320, 320, 60).length, 3);
  const topology = commands(layer("rounded-panels", { sides: 8, notch: 0 }));
  const smooth = commands(layer("rounded-panels", { iterations: 0 }));
  const layout = commands(layer("rounded-panels", { columns: 2, stagger: -.4 }));
  const marks = commands(layer("rounded-panels", { treatment: "fill", fillAlpha: 200 }));
  const fillWithoutOutline = commands(layer("rounded-panels", { weight: 0, treatment: "both" }));
  const original = commands(base);
  for (const variant of [topology, smooth, layout, marks]) assert.ok(JSON.stringify(variant) !== JSON.stringify(original));
  assert.ok(marks.some(command => command.name === "fill"));
  assert.ok(fillWithoutOutline.some(command => command.name === "noStroke"));
});

test("road curvature and signed margin stay independently editable", () => {
  const base = layer("road-margins");
  assert.notDeepEqual(roadSource(base.params), roadSource({ ...base.params, amplitude: 120 }));
  assert.notDeepEqual(roadSource(base.params), roadSource({ ...base.params, frequency: 2.5 }));
  assert.notDeepEqual(roadSource(base.params), roadSource({ ...base.params, turns: 3 }));
  const oneEdge = layer("road-margins", { bothSides: false, showCenterline: true, showNodes: true });
  assert.notDeepEqual(commands(oneEdge), commands({ ...oneEdge, params: { ...oneEdge.params, distance: -12 } }));
  assert.ok(commands(oneEdge).some(command => command.name === "circle"));
  validatePathsAQuality("road-margins", { ...oneEdge.params, amplitude: -300, distance: 0 });
});

test("rings use the entered signed gap and can switch from lines to vertices", () => {
  const base = layer("nested-contour-strokes", { distance: -25, startOffset: 80, rings: 5 });
  const outlines = commands(base);
  const dots = commands({ ...base, params: { ...base.params, marks: "dots" } });
  assert.ok(outlines.some(command => command.name === "vertex"));
  assert.equal(dots.some(command => command.name === "vertex"), false);
  assert.ok(dots.some(command => command.name === "circle"));
  assert.notDeepEqual(commands(layer("nested-contour-strokes", { distance: 0 })), commands(layer("nested-contour-strokes")));
});

test("faceting accepts convex and deeply notched boundaries with different marks", () => {
  const convex = layer("faceted-silhouettes", { sides: 10, kind: "convex" });
  const notched = layer("faceted-silhouettes", { sides: 10, kind: "notched", innerRadius: .15 });
  assert.equal(facetSource(convex.params).length, 10);
  assert.equal(facetSource(notched.params).length, 20);
  for (const candidate of [convex, notched]) {
    const boundary = facetSource(candidate.params);
    const mesh = triangulateSimplePolygon2D({ points: boundary, maxWork: boundary.length ** 3 + boundary.length ** 2 });
    assert.equal(mesh.triangles.length, boundary.length - 2);
  }
  const dots = layer("concave-grain", { hatchMode: "dots", showEdges: false, fillAlpha: 0 });
  assert.ok(commands(dots).some(command => command.name === "circle"));
  assert.equal(commands(dots).some(command => command.name === "line"), false);
});

test("combined work and impossible topology fail before p5 drawing", () => {
  for (const [id, edits] of [
    ["rounded-panels", { panels: 1000, sides: 256, iterations: 16 }],
    ["road-margins", { routes: 1000, turns: 1000, iterations: 8 }],
    ["nested-contour-strokes", { rings: 1000, sides: 256 }],
    ["concave-grain", { sides: 256, kind: "notched", grain: 1000 }],
  ] as const) {
    const candidate = layer(id, edits);
    assert.throws(() => commands(candidate), /generation budget/);
  }
  const sides = 6;
  const collinear = layer("concave-grain", { sides, innerRadius: Math.cos(Math.PI / sides) });
  assert.throws(() => commands(collinear), /collinear/);
});

test("legacy panel branch remains byte-for-byte the native example draw", () => {
  const old = layer("rounded-panels", { iterations: 3, panels: 5, weight: 2, legacy: true });
  const actual = commands(old);
  const p = new Proxy({ CLOSE: "close" } as Record<string, unknown>, {
    get(target, name: string) {
      if (name in target) return target[name];
      return (...values: unknown[]) => expected.push({ name, values });
    },
  });
  const expected: { name: string; values: unknown[] }[] = [];
  drawRoundedPanels(p, old);
  assert.deepEqual(actual, expected);
});
