import assert from "node:assert/strict";
import test from "node:test";
import { systemsADefinitions } from "../lib/adapters/systems-a";
import { drawSystems } from "../lib/adapters/systems";
import { cellularInitialCells, cellularState } from "../lib/adapters/systems-a-quality";
import { drawReactionSpots, drawReactionStripes, drawOrganicCells, drawGeometricGenerations } from "../../../packages/javascript/examples/systems-a-studies.js";
import type { Layer } from "../lib/studio-types";

const ids = ["reaction-spots", "reaction-stripes", "organic-cells", "geometric-generations"] as const;
function layer(id: typeof ids[number], edits: Record<string, number | string | boolean> = {}): Layer {
  const definition = systemsADefinitions.find(item => item.id === id)!;
  return { id: "cellular-test", technique: id, visible: true, opacity: 1, seed: 42,
    palette: [0x175d7a, 0xeb9c40, 0xce5552, 0x3e8867, 0x8c60a4], cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...definition.defaults, ...edits } };
}
function commands(input: Layer, direct?: (p: any, layer: Layer) => void): { name: string; values: unknown[] }[] {
  const output: { name: string; values: unknown[] }[] = [];
  const p = new Proxy({} as Record<string, unknown>, {
    get(_target, name: string) {
      return (...values: unknown[]) => {
        for (const value of values) if (typeof value === "number") assert.ok(Number.isFinite(value), `${String(name)} has finite coordinates`);
        output.push({ name, values });
      };
    },
  });
  (direct ?? drawSystems)(p, input);
  return output;
}
const checksum = (input: Layer) => JSON.stringify(commands(input));

test("four modern cellular studies expose replaceable initial state and draw transparent layers through dispatcher", () => {
  for (const id of ids) {
    const definition = systemsADefinitions.find(item => item.id === id)!;
    assert.ok(definition.parameters.some(parameter => parameter.key === "legacy" && parameter.hidden));
    for (const key of ["source", "sourceX", "sourceY", "frequency", "occupancy", "passes"])
      assert.ok(definition.parameters.some(parameter => parameter.key === key), `${id} exposes ${key}`);
    const base = layer(id);
    definition.validate?.(base.params);
    const marks = commands(base);
    assert.ok(marks.some(mark => mark.name === (id === "reaction-stripes" || id === "geometric-generations" ? "rect" : "circle")), id);
    assert.equal(marks.some(mark => ["background", "image"].includes(mark.name)), false, `${id} has no opaque page`);
    assert.notEqual(checksum(layer(id, { source: "disc" })), checksum(layer(id, { source: "bands" })), `${id} source changes drawing`);
  }
});

test("source families, offsets, occupancy and seed change initial state independently of simulation passes", () => {
  const base = layer("reaction-spots", { passes: 0, source: "speckle" });
  const defaultCells = cellularInitialCells("reaction-spots", base.params, base.seed);
  const inputs = [
    layer("reaction-spots", { passes: 0, source: "disc" }),
    layer("reaction-spots", { passes: 0, source: "bands" }),
    layer("reaction-spots", { passes: 0, source: "checker" }),
    layer("reaction-spots", { passes: 0, sourceX: .21 }),
    layer("reaction-spots", { passes: 0, sourceY: -.17 }),
    layer("reaction-spots", { passes: 0, frequency: 7 }),
    layer("reaction-spots", { passes: 0, occupancy: .65 }),
    { ...base, seed: 43 },
  ];
  for (const candidate of inputs)
    assert.notDeepEqual(cellularInitialCells("reaction-spots", candidate.params, candidate.seed), defaultCells);
  assert.deepEqual(cellularInitialCells("reaction-spots", base.params, base.seed), defaultCells, "source is deterministic");
  assert.deepEqual(cellularState("reaction-spots", base.params, base.seed).concentration,
    defaultCells.map(value => value ? .8 : 0), "zero passes displays the initial concentration");
  const paired = layer("reaction-stripes", { ...base.params });
  assert.equal(cellularInitialCells("reaction-stripes", paired.params, paired.seed).reduce((a, b) => a + b, 0),
    Math.round(Number(base.params.occupancy) * 576), "stripes selects a ranked fraction of the same source");
});

test("ranked stripe fill keeps source switching nonempty and deterministic", () => {
  const sources = ["disc", "bands", "speckle"] as const;
  const fields = sources.map(source => {
    const input = layer("reaction-stripes", { source, occupancy: .1, passes: 0 });
    const cells = cellularInitialCells("reaction-stripes", input.params, input.seed);
    assert.equal(cells.reduce((a, b) => a + b, 0), 58, `${source} activates rounded ten percent of 576`);
    assert.deepEqual(cellularInitialCells("reaction-stripes", input.params, input.seed), cells);
    return cells;
  });
  assert.notDeepEqual(fields[0], fields[1]);
  assert.notDeepEqual(fields[1], fields[2]);
  for (const occupancy of [0, 1]) {
    const input = layer("reaction-stripes", { occupancy, passes: 0 });
    assert.equal(cellularInitialCells("reaction-stripes", input.params, input.seed).reduce((a, b) => a + b, 0),
      occupancy * 576);
  }
  assert.throws(() => commands(layer("reaction-stripes", { source: "checker" })));
  assert.doesNotThrow(() => commands(layer("reaction-spots", { source: "checker" })));
});

test("source offset slider endpoints change the default checker composition", () => {
  const definition = systemsADefinitions.find(item => item.id === "geometric-generations")!;
  const offset = definition.parameters.find(item => item.key === "sourceY")!;
  const base = layer("geometric-generations");
  assert.notDeepEqual(
    cellularState("geometric-generations", { ...base.params, sourceY: offset.max! }, base.seed).cells,
    cellularState("geometric-generations", base.params, base.seed).cells,
  );
});

test("Life rules and boundaries reach the portable operation, while paired renderers share cell state", () => {
  const base = layer("organic-cells", { source: "speckle", passes: 8 });
  const life = cellularState("organic-cells", base.params, base.seed).cells;
  for (const rule of ["highlife", "seeds", "day-night"])
    assert.notDeepEqual(cellularState("organic-cells", { ...base.params, rule }, base.seed).cells, life, rule);
  assert.notDeepEqual(cellularState("organic-cells", { ...base.params, boundary: "DEAD" }, base.seed).cells, life);
  const square = layer("geometric-generations", { ...base.params });
  assert.deepEqual(cellularState("geometric-generations", square.params, square.seed).cells, life);
  assert.notEqual(checksum(base), checksum(square), "circle and square marks remain separate treatments");
});

test("combined work and exact domains reject invalid construction before drawing", () => {
  for (const [id, edits] of [
    ["reaction-spots", { passes: 257 }],
    ["reaction-stripes", { frequency: 13 }],
    ["organic-cells", { frequency: 11 }],
    ["geometric-generations", { passes: 257 }],
  ] as const) assert.throws(() => commands(layer(id, edits)));
  const validExtreme = layer("reaction-spots", { passes: 256, feed: .06, kill: .04, sourceX: 100, sourceY: -100 });
  assert.doesNotThrow(() => commands(validExtreme));
});

test("legacy branch retains every earlier renderer exactly", () => {
  const old = { "reaction-spots": drawReactionSpots, "reaction-stripes": drawReactionStripes,
    "organic-cells": drawOrganicCells, "geometric-generations": drawGeometricGenerations };
  for (const id of ids) {
    const input = layer(id, { ...({ "reaction-spots": { passes: 12, scale: 18, weight: 1 },
      "reaction-stripes": { passes: 16, scale: 13, weight: 1 },
      "organic-cells": { passes: 8, cellSize: 18, weight: 1 },
      "geometric-generations": { passes: 6, cellSize: 22, weight: 1 } }[id]), legacy: true });
    assert.deepEqual(commands(input), commands(input, old[id]));
  }
});
