import assert from "node:assert/strict";
import test from "node:test";
import { oklabRamp } from "@procedurals/javascript";
import type { InstrumentInput as Layer } from "../dist/types.js";
import { parseRgbColor, rampStops } from "../dist/adapters/color-source.js";
import { perceptualColorDefinitions, perceptualBandPolygons, oklabOrbitArcs,
  perceptualRampColors, drawPerceptualColor, validatePerceptualBands, validateOklabOrbits } from "../dist/adapters/perceptual-color-instruments.js";

function layer(technique: "perceptual-bands" | "oklab-orbits", edits: Layer["params"] = {}, palette = [0x112233, 0x95bb7e, 0xffcc11]): Layer {
  const definition = perceptualColorDefinitions.find(value => value.id === technique)!;
  return { technique, seed: 17, palette, cutEdits: [],
    params: { ...definition.defaults, ...edits } };
}
function record(source: Layer) {
  const shapes: { color: number[]; points: number[][]; closed: boolean }[] = [], lines: { color: number[]; ends: number[] }[] = [];
  let color: number[] = [], points: number[][] = [];
  drawPerceptualColor({ CLOSE: "close", noStroke() {}, noFill() {}, fill(...rgb) { color = rgb; },
    stroke(...rgb) { color = rgb; }, strokeWeight() {}, beginShape() { points = []; },
    vertex(...xy) { points.push(xy); }, endShape(mode) { shapes.push({ color: color.slice(), points, closed: mode === "close" }); },
    line(...ends) { lines.push({ color: color.slice(), ends }); },
  }, source);
  return { shapes, lines };
}

test("profile knots and trim meet exact unscaled band cell boundaries", () => {
  const q = layer("perceptual-bands", { bands: 2, height: 100, centerX: 0, centerY: 0, rotation: 0,
    bandCoverage: 1, from: .1, to: .8, profile: "[[0,0,10],[0.25,-20,20],[0.6,0,30],[1,10,15]]" }).params;
  const polygons = perceptualBandPolygons(q);
  assert.deepEqual(polygons.map(p => p.rank), [0, 1]);
  const rounded = (p: number[][]) => p.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
  assert.deepEqual(rounded(polygons[0].points), [
    [-8, -40], [-20, -25], [-5.714286, 0], [27.142857, 0], [20, -25], [14, -40],
  ]);
  assert.deepEqual(rounded(polygons[1].points), [
    [-5.714286, 0], [0, 10], [5, 30], [22.5, 30], [30, 10], [27.142857, 0],
  ]);
  assert.deepEqual(perceptualBandPolygons({ ...q, from: .8, to: .8 }), []);
  assert.deepEqual(perceptualBandPolygons({ ...q, bandCoverage: 0 }), []);
  assert.deepEqual(perceptualBandPolygons({ ...q, bands: 0 }), []);
  assert.deepEqual(perceptualBandPolygons({ ...q, height: 0 }), []);
});

test("signed arcs preserve traversal, spacing, eccentric centers and rotation", () => {
  const base = layer("oklab-orbits", { orbits: 3, innerRadius: 10, outerRadius: 30, spacingPower: 2,
    aspect: .5, driftX: 40, driftY: 20, startAngle: 0, sweep: -180, segments: 2,
    centerX: 100, centerY: 200, twist: 0, rotation: 0 }).params;
  assert.deepEqual(oklabOrbitArcs(base).map(arc => arc.points.map(point => point.map(value => Math.round(value * 1e9) / 1e9))), [
    [[110, 200], [100, 195], [90, 200]],
    [[135, 210], [120, 202.5], [105, 210]],
    [[170, 220], [140, 205], [110, 220]],
  ]);
  const rotated = oklabOrbitArcs({ ...base, rotation: 90, twist: 90 });
  assert.ok(Math.abs(rotated[0].points[0][0] - 100) < 1e-9);
  assert.ok(Math.abs(rotated[0].points[0][1] - 210) < 1e-9);
  assert.ok(Math.abs(rotated[2].points[0][0] - 50) < 1e-9);
  assert.ok(Math.abs(rotated[2].points[0][1] - 240) < 1e-9);
  assert.deepEqual(oklabOrbitArcs({ ...base, orbits: 1 })[0].points, oklabOrbitArcs(base)[0].points);
  assert.deepEqual(oklabOrbitArcs({ ...base, sweep: 0 }), []);
  assert.deepEqual(oklabOrbitArcs({ ...base, weight: 0 }), []);
  assert.deepEqual(oklabOrbitArcs({ ...base, orbits: 0 }), []);
});

test("actual SDK ramp colors use all packed palette stops and independent custom source", () => {
  assert.deepEqual(parseRgbColor("#aF0"), [170 / 255, 1, 0]);
  const palette = [0xaa112233, 0x445566, 0xffabcdef, 0x008899aa];
  const stops = rampStops(palette, "palette", "not JSON");
  assert.equal(stops.length, 4);
  assert.deepEqual(stops[0], [0x11 / 255, 0x22 / 255, 0x33 / 255]);
  const source = layer("perceptual-bands", { bands: 5 }, palette);
  assert.deepEqual(perceptualRampColors(source, 5), oklabRamp({ stops, count: 5, maxWork: 9 }).colors);
  const custom = layer("perceptual-bands", { colorSource: "custom", colorStops: '["#123","#f00"]', bands: 1 });
  assert.deepEqual(perceptualRampColors(custom, 1), [[0x11 / 255, 0x22 / 255, 0x33 / 255]]);
  assert.deepEqual(perceptualRampColors({ ...custom, palette: [0xff00ff], params: { ...custom.params, reverse: true } }, 1), [[1, 0, 0]]);
  const q = custom.params;
  assert.deepEqual(perceptualBandPolygons(q), perceptualBandPolygons({ ...q, colorStops: '["#111","#eee"]', reverse: true }));
  const trimmed = layer("perceptual-bands", { bands: 4, from: .55, to: 1, colorSource: "custom",
    colorStops: '["#000","#f00","#fff"]' });
  const fullRamp = perceptualRampColors(trimmed, 4);
  const painted = record(trimmed).shapes;
  assert.equal(painted.length, 2);
  assert.ok(painted.every(shape => shape.closed));
  assert.deepEqual(painted.map(shape => shape.color), fullRamp.slice(2).map(rgb => rgb.map(v => v * 255)),
    "trimming preserves original rank colors rather than resampling the clipped range");
  const orbit = layer("oklab-orbits", { orbits: 2, segments: 3, colorAxis: "arc", colorSource: "custom", colorStops: '["#000","#fff"]' });
  assert.deepEqual(oklabOrbitArcs(orbit.params), oklabOrbitArcs({ ...orbit.params, colorAxis: "rank", colorStops: '["#123","#abc"]' }));
  const output = record(orbit);
  assert.equal(output.lines.length, 6);
  assert.deepEqual(output.lines[0].color, [0, 0, 0]);
  assert.deepEqual(output.lines[2].color, [255, 255, 255]);
  assert.equal(record(layer("perceptual-bands", { bands: 0 })).shapes.length, 0);
  assert.equal(record(layer("oklab-orbits", { sweep: 0 })).lines.length, 0);
});

test("reject malformed profile/color grammar, invalid bounds and excess arc work", () => {
  const band = layer("perceptual-bands").params, orbit = layer("oklab-orbits").params;
  for (const [edit, pattern] of [
    [{ profile: "[[0,0,1],[0.5,0,1]]" }, /endpoints/],
    [{ profile: "[[0,0,1],[0.5,0,1],[0.5,0,1],[1,0,1]]" }, /strictly increase/],
    [{ profile: "[[0,1,0],[1,0,1]]" }, /left <= right/],
    [{ profile: "[[0,0,1],[1,1e999,2]]" }, /three finite/],
    [{ profile: "[[0,0,1],[1,0,1,2]]" }, /three finite/],
    [{ from: .7, to: .4 }, /from must be/],
    [{ bands: 2.5 }, /integer/],
    [{ colorSource: "custom", colorStops: '["#123","#ggg"]' }, /hex/],
    [{ colorSource: "custom", colorStops: '["#123"]' }, /2 to 32/],
  ] as const) assert.throws(() => validatePerceptualBands({ ...band, ...edit }), pattern);
  assert.throws(() => rampStops([0xabcdef], "palette", "[]"), /at least two/);
  assert.throws(() => validateOklabOrbits({ ...orbit, orbits: 256, segments: 235 }), /60000/);
  assert.throws(() => validateOklabOrbits({ ...orbit, innerRadius: 241, outerRadius: 240 }), /innerRadius/);
  assert.throws(() => validateOklabOrbits({ ...orbit, sweep: -721 }), /sweep/);
});
