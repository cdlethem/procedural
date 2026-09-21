import assert from "node:assert/strict";
import test from "node:test";
import { drawMaterials, materialsDefinitions } from "../lib/adapters/materials";
import { drawNearestFeatureMosaic, drawPerceptualBands, drawQuantizedStripes, drawReducedMosaic } from "@procedurals/javascript/examples/materials-a-studies.js"
import type { Layer } from "../lib/studio-types";

type Id = "quantized-stripes" | "perceptual-bands" | "reduced-mosaic" | "nearest-feature-mosaic";
const oldDraws = { "quantized-stripes": drawQuantizedStripes, "perceptual-bands": drawPerceptualBands,
  "reduced-mosaic": drawReducedMosaic, "nearest-feature-mosaic": drawNearestFeatureMosaic };
function layer(id: Id, edits: Record<string, number | string | boolean> = {}): Layer {
  const definition = materialsDefinitions.find(entry => entry.id === id)!;
  return { id: `field-${id}`, technique: id, visible: true, opacity: 1, seed: 42,
    palette: [0x21735c, 0xe59f28, 0x193756, 0xe35c49, 0x45b1b5], cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: { ...definition.defaults, ...edits } };
}
type Call = [string, unknown[]];
function commands(input: Layer, native = false): Call[] {
  const calls: Call[] = [];
  const p = new Proxy({} as Record<string, unknown>, { get: (_, key: string) => (...args: unknown[]) => {
    for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value));
    calls.push([key, args]);
  } });
  if (native) oldDraws[input.technique as Id](p, input);
  else drawMaterials(p, input);
  return calls;
}
const marks = (calls: Call[], name: string) => calls.filter(([method]) => method === name);

test("opaque defaults traverse the app dispatcher with the exact prior drawing commands", () => {
  for (const id of Object.keys(oldDraws) as Id[]) {
    const definition = materialsDefinitions.find(entry => entry.id === id)!;
    assert.deepEqual(Object.keys(definition.defaults).sort(), definition.parameters.map(parameter => parameter.key).sort());
    const input = layer(id);
    assert.deepEqual(commands(input), commands(input, true), `${id} default retains its existing pixels and command order`);
  }
});

test("band coverage preserves colors on shorter bands and zero paints no pixels", () => {
  for (const id of ["quantized-stripes", "perceptual-bands"] as const) {
    const old = commands(layer(id));
    const half = commands(layer(id, { bandCoverage: .5 }));
    assert.equal(marks(half, "rect").length, marks(old, "rect").length);
    assert.deepEqual(marks(half, "fill"), marks(old, "fill"), `${id} keeps original colors`);
    assert.ok(marks(half, "rect").every(([, args], i) => (args[3] as number) < (marks(old, "rect")[i][1][3] as number)));
    assert.equal(marks(commands(layer(id, { bandCoverage: 0 })), "rect").length, 0);
    assert.throws(() => commands(layer(id, { bandCoverage: 1.01 })), /Band coverage/);
  }
});

test("mosaic masks choose source cells after quantization without changing their colors", () => {
  const full = commands(layer("reduced-mosaic"));
  const high = commands(layer("reduced-mosaic", { fieldMask: "high", maskThreshold: .5 }));
  const low = commands(layer("reduced-mosaic", { fieldMask: "low", maskThreshold: .5 }));
  const coloredCells = (calls: Call[]) => {
    const cells = new Map<string, unknown[]>();
    let color: unknown[] = [];
    for (const [method, args] of calls) {
      if (method === "fill") color = args;
      if (method === "rect") cells.set(`${args[0]},${args[1]}`, color);
    }
    return cells;
  };
  const original = coloredCells(full), upper = coloredCells(high), lower = coloredCells(low);
  assert.ok(upper.size > 0 && upper.size < original.size);
  assert.ok(lower.size > 0 && lower.size < original.size);
  for (const selection of [upper, lower]) for (const [position, color] of selection)
    assert.deepEqual(color, original.get(position), `surviving ${position} keeps its quantized color`);
  assert.ok(marks(commands(layer("reduced-mosaic", { fieldMask: "high", maskThreshold: 1 })), "rect").length < upper.size);
  assert.equal(marks(commands(layer("reduced-mosaic", { fieldMask: "low", maskThreshold: 0 })), "rect").length, 0);
  assert.equal(marks(commands(layer("reduced-mosaic", { fieldMask: "high", maskThreshold: 0 })), "rect").length, original.size);
  assert.deepEqual(commands(layer("reduced-mosaic", { fieldMask: "all", maskThreshold: .1 })), full);
});

test("nearest-feature boundaries trace ownership changes without painting interior cells", () => {
  const regions = commands(layer("nearest-feature-mosaic"));
  const edges = commands(layer("nearest-feature-mosaic", { display: "boundaries" }));
  const both = commands(layer("nearest-feature-mosaic", { display: "both" }));
  const sites = commands(layer("nearest-feature-mosaic", { display: "boundaries", showSites: true }));
  assert.ok(marks(regions, "rect").length > 0);
  assert.equal(marks(edges, "rect").length, 0);
  assert.ok(marks(edges, "line").length > 0);
  assert.equal(marks(both, "rect").length, marks(regions, "rect").length);
  assert.ok(marks(sites, "circle").length > 0);
  assert.ok(marks(sites, "circle").length < marks(regions, "rect").length);
  assert.throws(() => commands(layer("nearest-feature-mosaic", { display: "other" })), /Unknown feature display/);
});
