import assert from "node:assert/strict";
import test from "node:test";
import { createLayer } from "../lib/studio";
import { drawExternalExpansion, externalExpansionDefinitions,
  ornamentFieldRecords, shapeMatrixRecords, orbitalBrushRecords } from "../lib/adapters/external-expansion";
import { ornamentFieldRecords as nativeOrnamentRecords,
  shapeMatrixRecords as nativeMatrixRecords } from "../../../packages/javascript/examples/motif-compositions/field-records.js";
import { orbitalBrushRecords as nativeOrbitalRecords,
  validateOrbitalRecordInput } from "../../../packages/javascript/examples/motif-compositions/orbital-records.js";
import type { Layer } from "../lib/studio-types";

function withParams(layer: Layer, changes: Record<string, number | string | boolean>): Layer {
  return { ...layer, params: { ...layer.params, ...changes } };
}

function drawingCalls(layer: Layer): string[] {
  const calls: string[] = [];
  const p = new Proxy({
    PI: Math.PI, HALF_PI: Math.PI / 2, SQUARE: "square",
    drawingContext: {
      save: () => calls.push("context.save"),
      restore: () => calls.push("context.restore"),
      beginPath: () => calls.push("context.beginPath"),
      rect: () => calls.push("context.rect"),
      clip: () => calls.push("context.clip"),
    },
  } as Record<string, any>, {
    get(target, name: string) {
      if (name in target) return target[name];
      return (...args: unknown[]) => {
        for (const value of args)
          if (typeof value === "number") assert.ok(Number.isFinite(value), `${name} received finite coordinates`);
        calls.push(name);
      };
    },
  });
  drawExternalExpansion(p, layer);
  return calls;
}

test("ornament field retains anchors through styling and supports seeded packed and ordered grid layouts", () => {
  const layer = createLayer("ornament-poster");
  assert.equal(layer.params.legacy, false);
  const baseline = ornamentFieldRecords(layer);
  assert.ok(baseline.length > 20);
  assert.deepEqual(ornamentFieldRecords(layer), baseline);
  assert.deepEqual(ornamentFieldRecords(withParams(layer, { petalWeight: 10 })).map(({ x, y, sourceIndex }) => [x, y, sourceIndex]),
    baseline.map(({ x, y, sourceIndex }) => [x, y, sourceIndex]));
  const movedX = ornamentFieldRecords(withParams(layer, { offsetX: 47.25 }));
  assert.ok(movedX.every((mark, i) => mark.x === baseline[i].x + 47.25 && mark.y === baseline[i].y));
  const movedY = ornamentFieldRecords(withParams(layer, { offsetY: -63.5 }));
  assert.ok(movedY.every((mark, i) => mark.y === baseline[i].y - 63.5 && mark.x === baseline[i].x));
  const turned = ornamentFieldRecords(withParams(layer, { angle: 90, scale: 2 }));
  assert.deepEqual(turned.map(({ x, y, sourceIndex, kind }) => [x, y, sourceIndex, kind]),
    baseline.map(({ x, y, sourceIndex, kind }) => [x, y, sourceIndex, kind]));
  assert.ok(turned.every((mark, i) => Math.abs(mark.radius - baseline[i].radius * 2 / Number(layer.params.scale)) < 1e-10));
  assert.ok(ornamentFieldRecords(withParams(layer, { density: 100 })).length >= baseline.length);
  assert.deepEqual(ornamentFieldRecords(withParams(layer, { density: 0 })), []);
  assert.notDeepEqual(ornamentFieldRecords({ ...layer, seed: layer.seed + 1 }), baseline);
  const grid = ornamentFieldRecords(withParams(layer, { layout: "grid", density: 100 }));
  assert.equal(grid.length, 144);
  assert.deepEqual(grid, ornamentFieldRecords(withParams(layer, { layout: "grid", density: 100 })));
  assert.ok(ornamentFieldRecords(withParams(layer, { petalWeight: 0, leafWeight: 0, emblemWeight: 10 })).every((mark) => mark.kind === "emblems"));
  assert.ok(!drawingCalls(layer).includes("background"));
});

test("shape matrix exposes independent dimensions, shape membership, spacing, rotation and bounded work", () => {
  const layer = createLayer("geometric-panel");
  const baseline = shapeMatrixRecords(layer);
  assert.ok(baseline.length > 10);
  assert.deepEqual(shapeMatrixRecords(layer), baseline);
  const sparse = shapeMatrixRecords(withParams(layer, { density: 25 }));
  assert.ok(sparse.every((mark) => baseline.some((other) => other.sourceIndex === mark.sourceIndex)));
  const singleRow = shapeMatrixRecords(withParams(layer, { rows: 1, columns: 11, density: 100 }));
  assert.equal(singleRow.length, 11);
  assert.ok(singleRow.every((mark) => mark.row === 0));
  const singleColumn = shapeMatrixRecords(withParams(layer, { rows: 9, columns: 1, density: 100 }));
  assert.equal(singleColumn.length, 9);
  assert.ok(singleColumn.every((mark) => mark.column === 0));
  const asymmetric = shapeMatrixRecords(withParams(layer, { rows: 4, columns: 11, density: 100,
    wedgeWeight: 0, barWeight: 1, discWeight: 0, arcWeight: 3 }));
  assert.equal(asymmetric.length, 44);
  assert.ok(asymmetric.some((mark) => mark.kind === "arcs"));
  assert.ok(asymmetric.every((mark) => mark.kind === "arcs" || mark.kind === "bars"));
  const xOnly = shapeMatrixRecords(withParams(layer, { offsetX: 31.75 }));
  assert.ok(xOnly.every((mark, i) => mark.x === baseline[i].x + 31.75 && mark.y === baseline[i].y));
  const yOnly = shapeMatrixRecords(withParams(layer, { offsetY: -28.5 }));
  assert.ok(yOnly.every((mark, i) => mark.y === baseline[i].y - 28.5 && mark.x === baseline[i].x));
  const full = withParams(layer, { density: 100 });
  const fullBaseline = shapeMatrixRecords(full);
  const rowShifted = shapeMatrixRecords(withParams(full, { rowShift: 1 }));
  assert.ok(rowShifted.every((mark, i) => mark.y === fullBaseline[i].y &&
    (mark.row % 2 === 0 ? mark.x === fullBaseline[i].x : mark.x !== fullBaseline[i].x)));
  const columnShifted = shapeMatrixRecords(withParams(full, { columnShift: -1 }));
  assert.ok(columnShifted.every((mark, i) => mark.x === fullBaseline[i].x &&
    (mark.column % 2 === 0 ? mark.y === fullBaseline[i].y : mark.y !== fullBaseline[i].y)));
  const rotated = shapeMatrixRecords(withParams(layer, { angleStep: 0 }));
  assert.deepEqual(rotated.map(({ x, y, kind }) => [x, y, kind]), baseline.map(({ x, y, kind }) => [x, y, kind]));
  assert.ok(rotated.every((mark) => mark.angle === rotated[0].angle));
  assert.equal(shapeMatrixRecords(withParams(layer, { rows: 1, columns: 2048, density: 100 })).length, 2048);
  assert.throws(() => shapeMatrixRecords(withParams(layer, { rows: 2, columns: 2048 })), /2048-cell/);
  assert.ok(!drawingCalls(layer).includes("background"));
});

test("modern fields reject empty shape sets while saved legacy treatments can replay", () => {
  const ornament = externalExpansionDefinitions.find((item) => item.id === "ornament-poster")!;
  const panel = externalExpansionDefinitions.find((item) => item.id === "geometric-panel")!;
  const a = createLayer("ornament-poster"), b = createLayer("geometric-panel");
  assert.throws(() => ornament.validate?.({ ...a.params, petalWeight: 0, leafWeight: 0, emblemWeight: 0 }), /at least one/);
  assert.throws(() => panel.validate?.({ ...b.params, wedgeWeight: 0, barWeight: 0, discWeight: 0, arcWeight: 0 }), /at least one/);
  const oldA = withParams(a, { legacy: true, petalWeight: 0, leafWeight: 0, emblemWeight: 0 });
  const oldB = withParams(b, { legacy: true, wedgeWeight: 0, barWeight: 0, discWeight: 0, arcWeight: 0 });
  assert.doesNotThrow(() => ornament.validate?.(oldA.params));
  assert.doesNotThrow(() => panel.validate?.(oldB.params));
  assert.ok(drawingCalls(oldA).includes("text"), "legacy ornament retains its saved lettering");
  assert.ok(drawingCalls(oldB).includes("rect"), "legacy panel retains its saved bands");
});

test("standalone p5 and web studies use identical retained fields", () => {
  const ornament = createLayer("ornament-poster");
  const matrix = createLayer("geometric-panel");
  for (const layer of [ornament,
    withParams(ornament, { layout: "grid", density: 27, petalWeight: 0, leafWeight: 2, emblemWeight: 9,
      scale: 2.25, angleStride: -43.5, offsetX: 68.5 }),
    { ...ornament, seed: 811 }]) {
    assert.deepEqual(nativeOrnamentRecords({ seed: layer.seed, params: layer.params }), ornamentFieldRecords(layer));
  }
  for (const layer of [matrix,
    withParams(matrix, { rows: 1, columns: 11, density: 100, wedgeWeight: 0, barWeight: 1,
      discWeight: 0, arcWeight: 3, rowShift: -0.5, columnShift: 0.4, angleStep: 0 }),
    withParams(matrix, { rows: 32, columns: 64, density: 100, angle: 720, scale: 0.2 })]) {
    assert.deepEqual(nativeMatrixRecords({ params: layer.params }), shapeMatrixRecords(layer));
  }
});

test("standalone p5 orbital paths match the web source vertices, samples and work budget", () => {
  const orbital = createLayer("orbital-brush");
  for (const layer of [orbital,
    withParams(orbital, { source: "ellipse", paths: 11, centerStepX: 31.25,
      centerStepY: -16, radialSpacing: -5, angleStep: -37, samples: 213 }),
    withParams(orbital, { source: "wave", lobes: 11, depth: -0.38,
      radiusX: 133, radiusY: 37, marks: "dashes", markSpacing: 0 })]) {
    assert.deepEqual(nativeOrbitalRecords({ params: layer.params }), orbitalBrushRecords(layer));
  }
  assert.throws(() => validateOrbitalRecordInput({ ...orbital.params, paths: 2048 }), /64000-point/);
  assert.throws(() => validateOrbitalRecordInput({ ...orbital.params, radialSpacing: -100 }), /radius negative/);
});
