import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { materialsBDefinitions } from "../lib/adapters/materials-b";
import { drawMaterials } from "../lib/adapters/materials";
import type { Layer } from "../lib/studio-types";

type MeshId = "extruded-seals" | "stepped-blocks" | "transported-ribbons" |
  "twisting-streamers" | "rounded-polyhedra" | "subdivided-shells";
const ids: MeshId[] = ["extruded-seals", "stepped-blocks", "transported-ribbons",
  "twisting-streamers", "rounded-polyhedra", "subdivided-shells"];
const palette = [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7];
function layerFor(id: MeshId, params?: Record<string, number | string | boolean>): Layer {
  const definition = materialsBDefinitions.find(item => item.id === id)!;
  return {
    id: "mesh-quality", technique: id, visible: true, opacity: 1, seed: 42,
    palette: [...palette], cutEdits: [], transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...definition.defaults, ...params },
  };
}
function render(layer: Layer) {
  const styled = createHash("sha256"), geometry = createHash("sha256");
  const vertices: [number, number][] = [];
  const segments: [number, number, number, number][] = [];
  const calls: string[] = [];
  const p = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, any>, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        assert.notEqual(key, "background", "mesh layer leaves document paper transparent");
        assert.notEqual(key, "rect", "mesh layer has no full-frame backing rectangle");
        for (const x of args) if (typeof x === "number") assert.ok(Number.isFinite(x), `${key}: finite coordinate`);
        const command = JSON.stringify([key, ...args]);
        styled.update(command); calls.push(key);
        if (key === "vertex") {
          geometry.update(command);
          vertices.push(args as [number, number]);
        }
        if (key === "line") segments.push(args as [number, number, number, number]);
      };
    },
  });
  const input = structuredClone(layer);
  drawMaterials(p, layer);
  assert.deepEqual(layer, input, "renderer does not mutate the caller's layer");
  return { styled: styled.digest("hex"), geometry: geometry.digest("hex"), vertices, segments, calls };
}
function bounds(points: [number, number][]) {
  const x = points.map(point => point[0]), y = points.map(point => point[1]);
  return [Math.min(...x), Math.max(...x), Math.min(...y), Math.max(...y)];
}

test("six source/appearance definitions have complete defaults and readable initial framing", () => {
  assert.deepEqual(materialsBDefinitions.map(item => item.id), ids);
  for (const id of ids) {
    const definition = materialsBDefinitions.find(item => item.id === id)!;
    assert.deepEqual(definition.parameters.map(item => item.key).sort(), Object.keys(definition.defaults).sort());
    assert.equal(definition.defaults.legacy, false);
    assert.equal(definition.parameters.find(item => item.key === "legacy")?.hidden, true);
    const result = render(layerFor(id));
    assert.ok(result.vertices.length >= 12, id);
    assert.ok(bounds(result.vertices).every(value => value >= 0 && value <= 640), `${id}: readable default canvas bounds`);
    assert.ok(result.calls.includes("push") && result.calls.includes("pop"), `${id}: painter state restored`);
  }
});

const sourceEdits: Record<MeshId, Record<string, number | string>> = {
  "extruded-seals": { footprint: "stepped", footprintWidth: 335, footprintDepth: 280, inset: 12, stepDepth: 100, shoulder: 105, height: 160 },
  "stepped-blocks": { footprint: "beveled", footprintWidth: 310, footprintDepth: 250, inset: 30, stepDepth: 120, shoulder: 110, height: 135 },
  "transported-ribbons": { segments: 30, verticalAmplitude: 125, verticalCycles: 2, depthAmplitude: 110, depthCycles: 3, width: 80, endWidth: 18, widthPulse: 1 },
  "twisting-streamers": { segments: 32, verticalAmplitude: 45, verticalCycles: .5, depthAmplitude: 115, depthCycles: 2, width: 68, endWidth: 90, widthPulse: -.5 },
  "rounded-polyhedra": { base: "patch", axisX: 1.5, axisY: .4, axisZ: 1.8, cornerLift: 80, levels: 2 },
  "subdivided-shells": { base: "tetra", axisX: 1.4, axisY: 1.5, axisZ: .7, cornerLift: -60, levels: 2 },
};
for (const id of ids) test(`${id}: source geometry, camera and face treatment are independent`, () => {
  const base = layerFor(id), baseline = render(base);
  assert.equal(render(base).styled, baseline.styled, "deterministic replay");
  for (const [key, value] of Object.entries(sourceEdits[id])) {
    const changed = render(layerFor(id, { [key]: value }));
    assert.notEqual(changed.geometry, baseline.geometry, `${key} changes projected source geometry`);
  }
  const zoomed = render(layerFor(id, { zoom: Number(base.params.zoom) * 1.25 }));
  assert.notEqual(zoomed.geometry, baseline.geometry);
  const before = bounds(baseline.vertices), after = bounds(zoomed.vertices);
  assert.ok(after[1] - after[0] > before[1] - before[0], "fixed zoom increases actual projected width");
  const recolored = render({ ...base, palette: [0x112233, 0x77aacc, 0xdd4455] });
  assert.equal(recolored.geometry, baseline.geometry);
  assert.notEqual(recolored.styled, baseline.styled);
  for (const faceMode of ["bands", "facets"]) {
    const appearance = render(layerFor(id, { faceMode }));
    assert.equal(appearance.geometry, baseline.geometry, `${faceMode} leaves geometry unchanged`);
    assert.notEqual(appearance.styled, baseline.styled, `${faceMode} visibly changes face commands`);
  }
  const noOutline = render(layerFor(id, { weight: 0 }));
  assert.ok(noOutline.calls.includes("noStroke"), "zero outline invokes noStroke");
  assert.equal(noOutline.geometry, baseline.geometry);
});

test("coupled geometry and face budgets reject invalid work before drawing", () => {
  const extrude = materialsBDefinitions.find(item => item.id === "stepped-blocks")!;
  assert.throws(() => extrude.validate!({ ...extrude.defaults, footprintDepth: 80, stepDepth: 100 }), /fit/);
  assert.throws(() => extrude.validate!({ ...extrude.defaults, stepDepth: 0 }), /positive/);
  const subdiv = materialsBDefinitions.find(item => item.id === "subdivided-shells")!;
  assert.throws(() => subdiv.validate!({ ...subdiv.defaults, levels: 6 }), /face/);
  assert.throws(() => render(layerFor("subdivided-shells", { levels: 6 })), /STUDY_MESH_BUDGET/);
  assert.ok(render(layerFor("transported-ribbons", { segments: 512 })).vertices.length > 1000);
  assert.ok(render(layerFor("rounded-polyhedra", { axisX: 0, axisY: -1 })).vertices.length > 0,
    "flat and mirrored source axes remain valid artistic extremes");
});

test("solid-lit outlines omit extrusion triangulation diagonals", () => {
  const id = "extruded-seals", layer = layerFor(id);
  const w = Number(layer.params.footprintWidth), d = Number(layer.params.footprintDepth);
  const inset = Number(layer.params.inset), step = Number(layer.params.stepDepth), shoulder = Number(layer.params.shoulder);
  const ring = [
    [-w / 2 + inset, -d / 2], [w / 2 - inset, -d / 2], [w / 2, -d / 2 + inset],
    [w / 2, d / 2 - step], [w / 2 - shoulder, d / 2], [-w / 2, d / 2 - inset],
  ];
  const yaw = Number(layer.params.rotation), pitch = Number(layer.params.pitch), zoom = Number(layer.params.zoom);
  const projected = [0, Number(layer.params.height)].flatMap(z => ring.map(([x, y]) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const vx = x, vy = y, vz = z - 55;
    const rx = vx * cy - vz * sy, rz = vx * sy + vz * cy;
    return [320 + rx * zoom, 320 - (vy * cp - rz * sp) * zoom];
  }));
  const vertexIndex = (x: number, y: number) => projected.findIndex(point =>
    Math.abs(point[0] - x) < 1e-7 && Math.abs(point[1] - y) < 1e-7);
  const result = render(layer);
  assert.ok(result.segments.length > 0, "outline weight still draws feature edges");
  for (const [x1, y1, x2, y2] of result.segments) {
    const a = vertexIndex(x1, y1), b = vertexIndex(x2, y2);
    assert.ok(a >= 0 && b >= 0, "every outline endpoint belongs to the source prism");
    const ai = a % ring.length, bi = b % ring.length;
    const ringNeighbors = Math.abs(ai - bi) === 1 || Math.abs(ai - bi) === ring.length - 1;
    assert.ok((Math.floor(a / ring.length) === Math.floor(b / ring.length) && ringNeighbors) || ai === bi,
      `outline ${a}–${b} is a silhouette or section edge, never a face diagonal`);
  }
  assert.equal(render(layerFor(id, { weight: 0 })).segments.length, 0);
  assert.equal(render(layerFor(id, { faceMode: "bands" })).segments.length, 0,
    "banded triangles still use their existing path outlines");
});

// Command-stream goldens from the previous bound implementation's six native
// defaults and its T structural edits, recorded before this renderer revision.
const legacy: Record<MeshId, { defaults: Record<string, number>; edit: Record<string, number>; hashes: [string, string] }> = {
  "extruded-seals": { defaults: { height: 110, rotation: .55, weight: 1 }, edit: { height: 190 }, hashes: ["22a0adecc7e8af76c8047d8c7db35bd8e28d6cd7e1312585fb8ec4de3f1fb226", "7b7dfca5dc78cda9824d244a77e9c90f4df2ebb555bb5f50e57023114cf3d3a6"] },
  "stepped-blocks": { defaults: { height: 80, rotation: .7, weight: 1 }, edit: { rotation: 1.2 }, hashes: ["8f694a362af92e7c9e0d12f6395c68ca83972950a0bb62d7ee6c696a1e40875c", "75cecf1fdf375d226a1c8c454509252e0be3284631b2e24787e6d8629b2a7ae0"] },
  "transported-ribbons": { defaults: { segments: 12, width: 54, rotation: .5, weight: 1 }, edit: { segments: 22 }, hashes: ["8d174cb699da6604f6d8d16014ddf7d28568f0f73aaa58e7ac0d2d46b0743a98", "41c32e4f50bd1ebf1c7e73190d19ed2816a2b16fb9713cd7a51d5d62c70e83cb"] },
  "twisting-streamers": { defaults: { segments: 16, width: 38, rotation: .8, weight: 1 }, edit: { width: 82 }, hashes: ["79ed6addf166e1d876e109dd67bdb9c0753455fd606908624c90245e87f4d066", "9101e52bc57ba3b83c81d1edd92ae6217e1dc90f250fd3a1e1f5cc59a23075c3"] },
  "rounded-polyhedra": { defaults: { levels: 1, rotation: .6, weight: 1 }, edit: { levels: 2 }, hashes: ["eb20bd26f7f12e385457e9125d9f90eb6f1908bba555b7c0da179ac59c7a6454", "403496563370ad00c2ceafe65985d33b897522f3f3476769e0188f07f165b3d7"] },
  "subdivided-shells": { defaults: { levels: 1, rotation: 1.1, weight: 1 }, edit: { rotation: 1.8 }, hashes: ["504974d2e85bc6dedbeaa0cedf17b5a8ae7dc63dc227e81bf844bd6ffa2f4c3c", "21b07dc5eb4f919373699e387e878915ce1e5c0d86942d6862654c0f96ad760d"] },
};
for (const id of ids) test(`${id}: saved legacy defaults and structural edit retain exact commands`, () => {
  const historical = legacy[id];
  for (const [index, params] of [historical.defaults, { ...historical.defaults, ...historical.edit }].entries()) {
    const result = render(layerFor(id, { ...params, legacy: true }));
    assert.equal(result.styled, historical.hashes[index]);
  }
});
