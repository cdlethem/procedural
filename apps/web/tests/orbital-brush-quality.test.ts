import assert from "node:assert/strict";
import test from "node:test";
import { drawExternalExpansion, externalExpansionDefinitions, externalExpansionPalette, orbitalBrushRecords } from "../lib/adapters/external-expansion";
import type { Layer } from "../lib/studio-types";

const definition = externalExpansionDefinitions.find(item => item.id === "orbital-brush")!;
function layer(params: Record<string, number | string | boolean> = {}): Layer {
  return { id: "orbital-test", technique: "orbital-brush", visible: true, opacity: 1,
    seed: 42, palette: externalExpansionPalette("orbital-brush")!, cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...definition.defaults, ...params } };
}
function commandCounts(input: Layer): Record<string, number> {
  const counts: Record<string, number> = {};
  const p = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get(target, name: string) {
      if (name in target) return target[name];
      return (...values: unknown[]) => {
        for (const value of values) if (typeof value === "number") assert.ok(Number.isFinite(value));
        counts[name] = (counts[name] ?? 0) + 1;
      };
    },
  });
  drawExternalExpansion(p, input);
  return counts;
}

test("Orbital Brush retains the source when only its mark treatment changes", () => {
  const current = layer();
  const geometry = orbitalBrushRecords(current);
  assert.equal(geometry.length, 7);
  assert.equal(geometry[0].points.length, 144);
  assert.ok(geometry.every(path => path.distances.every((distance, index) =>
    index === 0 || distance >= path.distances[index - 1])));
  const restyled = layer({ marks: "dashes", markSize: 8, markSpacing: 20, markOpacity: 80, guides: true });
  restyled.palette = [0x112233, 0x224466, 0x335577, 0x446688, 0x557799, 0x6688aa];
  assert.strictEqual(orbitalBrushRecords(restyled), geometry);
  assert.ok((commandCounts(current).circle ?? 0) > 0);
  assert.ok((commandCounts(restyled).line ?? 0) > 0);
  assert.equal(commandCounts(current).background ?? 0, 0);
  assert.equal(commandCounts(restyled).background ?? 0, 0);
});

test("source controls produce distinct closed paths and valid extreme cases", () => {
  const base = layer();
  const one = orbitalBrushRecords(layer({ paths: 1, radiusX: 200, radiusY: 35, angle: 49.5, marks: "ribbons" }));
  const nested = orbitalBrushRecords(layer({ source: "ellipse", paths: 12, radiusX: 25, radiusY: 25, radialSpacing: 20, angleStep: 0 }));
  const crossing = orbitalBrushRecords(layer({ centerStepX: 22, centerStepY: -16, angleStep: 71, depth: 0.5 }));
  assert.equal(one.length, 1);
  assert.equal(nested.length, 12);
  assert.notDeepEqual(one[0].points, orbitalBrushRecords(base)[0].points);
  assert.notDeepEqual(nested[0].points, orbitalBrushRecords(base)[0].points);
  assert.notDeepEqual(crossing[3].points, orbitalBrushRecords(base)[3].points);
  const clipped = layer({ centerX: -5000.25, angle: 725.5, radiusX: 0, radiusY: 0, paths: 1 });
  definition.validate?.(clipped.params);
  assert.equal(orbitalBrushRecords(clipped)[0].points.length, 144);
});

test("combined generation work and negative later radii fail before drawing", () => {
  const oversized = layer({ paths: 2048, samples: 16384 });
  assert.throws(() => definition.validate?.(oversized.params), /generation budget/);
  assert.throws(() => orbitalBrushRecords(oversized), /generation budget/);
  const negative = layer({ paths: 7, radialSpacing: -30 });
  assert.throws(() => definition.validate?.(negative.params), /radius negative/);
  assert.throws(() => orbitalBrushRecords(negative), /radius negative/);
});
