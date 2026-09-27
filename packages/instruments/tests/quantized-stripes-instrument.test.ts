import assert from "node:assert/strict";
import test from "node:test";
import type { InstrumentInput as Layer } from "../dist/types.js";
import { drawQuantizedStripeInstrument, prepareQuantizedStripes, quantizedStripeDefinitions,
  validateQuantizedStripeParams, type QuantizedStripePreparation } from "../dist/adapters/quantized-stripes-instrument.js";

const defaults = quantizedStripeDefinitions[0].defaults;
const params = (overrides: Layer["params"] = {}): Layer["params"] => ({ ...defaults, ...overrides });
const seq = (rows: [string, number][]): Layer["params"] => params({ source: "sequence", sequence: JSON.stringify(rows) });
const geometry = (source: QuantizedStripePreparation) => source.stripes.map(
  ({ sourceIndex, x, y, width, height }) => ({ sourceIndex, x, y, width, height }));
function paint(q: Layer["params"], palette: number[] = [0x102030, 0xffa040], seed = 19) {
  const calls: { method: string; args: number[] }[] = [];
  const surface = new Proxy({} as Record<string, unknown>, { get(_, method: string) {
    return (...args: number[]) => { calls.push({ method, args }); };
  } });
  const layer: Layer = { technique: "quantized-stripes", seed, palette, cutEdits: [], params: q };
  drawQuantizedStripeInstrument(surface as Parameters<typeof drawQuantizedStripeInstrument>[0], layer);
  return calls;
}

test("palette-ramp visits every packed RGB stop without alpha; one and zero samples have explicit boundaries", () => {
  const palette = [0x800000ff, 0xff00ff00, 0x00ff0000];
  const q = params({ samples: 3, colors: 3, columns: 3, coverageX: 1, coverageY: 1 });
  const result = prepareQuantizedStripes(q, palette, 1);
  assert.deepEqual(result.stripes.map(stripe => stripe.color.map(value => Math.round(value * 255))),
    [[0, 0, 255], [0, 255, 0], [255, 0, 0]]);
  const interpolated = prepareQuantizedStripes({ ...q, samples: 5, colors: 5 }, palette, 1);
  assert.deepEqual(interpolated.stripes.map(stripe => stripe.color.map(value => Math.round(value * 255))),
    [[0, 0, 255], [0, 128, 128], [0, 255, 0], [128, 128, 0], [255, 0, 0]]);
  const single = prepareQuantizedStripes({ ...q, samples: 1 }, palette, 1);
  assert.deepEqual(single.stripes[0].color, [0, 0, 1]);
  const empty = prepareQuantizedStripes({ ...q, samples: 0 }, [], 1);
  assert.deepEqual(empty.stripes, []);
  assert.equal(paint({ ...q, samples: 0 }, []).length, 0);
});

test("weighted cells fill each row, keep transparent centered gaps, and shift only odd rows", () => {
  const q = { ...seq([["#f00", 1], ["#0f0", 3], ["#00f", 2], ["#fff", 2], ["#000", 1]]),
    colors: 3, columns: 2, width: 120, height: 90, coverageX: .5, coverageY: .5, rowShift: .5 };
  const result = prepareQuantizedStripes(q, [], 1);
  assert.deepEqual(result.stripes.map(({ x, y, width, height }) => [x, y, width, height]), [
    [-52.5, -35, 15, 20], [-7.5, -35, 45, 20],
    [-15, 5, 30, 20], [45, 5, 30, 20],
    [-30, 37.5, 60, 5],
  ]);
});

test("source weights determine painted area in single-column strips and multi-column tiles", () => {
  const q = { ...seq([["#f00", 1], ["#0f0", 3], ["#00f", 2]]),
    width: 120, height: 60, coverageX: 1, coverageY: 1 };
  for (const columns of [1, 2, 3]) {
    const result = prepareQuantizedStripes({ ...q, columns }, [], 1);
    assert.deepEqual(result.stripes.map(stripe => stripe.width * stripe.height), [1200, 3600, 2400]);
  }
});

test("source and shuffle geometry follow source weights, not retained colors or appearance", () => {
  const rows: [string, number][] = [["#f00", 1], ["#f44", 2], ["#00f", 3], ["#0ff", 4], ["#0f0", 5], ["#fff", 6]];
  for (const order of ["source", "shuffle"]) {
    const q = { ...seq(rows), order, colors: 2, columns: 3, width: 180, height: 100 };
    const low = prepareQuantizedStripes(q, [], 37);
    const high = prepareQuantizedStripes({ ...q, colors: 6 }, [], 37);
    const changed = prepareQuantizedStripes({ ...q, sequence: JSON.stringify(rows.map(([_, weight]) => ["#789", weight])) }, [], 37);
    assert.deepEqual(geometry(high), geometry(low));
    assert.deepEqual(geometry(changed), geometry(low));
    assert.deepEqual(geometry(prepareQuantizedStripes(q, [], 37)), geometry(low));
    if (order === "shuffle") {
      assert.notDeepEqual(low.stripes.map(stripe => stripe.sourceIndex),
        prepareQuantizedStripes(q, [], 91).stripes.map(stripe => stripe.sourceIndex));
      assert.deepEqual(low.stripes.map(stripe => stripe.sourceIndex).slice().sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
    } else assert.deepEqual(geometry(prepareQuantizedStripes(q, [], 91)), geometry(low));
  }
});

test("grouping stably orders by actual reduced bucket and carries the associated weights", () => {
  const q = { ...seq([["#f00", 1], ["#00f", 2], ["#f00", 3], ["#00f", 4]]),
    colors: 2, order: "grouped", columns: 2, width: 100, height: 100, coverageX: 1, coverageY: 1 };
  const result = prepareQuantizedStripes(q, [], 4);
  const expected = [0, 1].flatMap(bucket => result.indices.flatMap((value, index) => value === bucket ? [index] : []));
  assert.deepEqual(result.stripes.map(stripe => stripe.sourceIndex), expected);
  assert.deepEqual(result.stripes.map(stripe => stripe.width), expected.map((sourceIndex, position) => {
    const weights = [1, 2, 3, 4];
    const first = Math.floor(position / 2) * 2;
    return 100 * weights[sourceIndex] / (weights[expected[first]] + weights[expected[first + 1]]);
  }));
  assert.deepEqual(geometry(prepareQuantizedStripes(q, [], 400)), geometry(result));
});

test("invalid sequence grammar, finite bounds, ordering, and quantizer work are reported without clipping", () => {
  const base = seq([["#123456", 1]]);
  for (const [value, message] of [
    ["{}", /1–512/], ["not-json", /JSON/], ['[["#112233",0]]', /positive weight/],
    ['[["#112233",10001]]', /positive weight/], ['[["#badhex",1]]', /hex RGB/],
    ['[["#112233",1,3]]', /positive weight/],
  ] as const) assert.throws(() => prepareQuantizedStripes({ ...base, sequence: value }, [], 1), message);
  for (const [key, value] of [["samples", 1.5], ["columns", 0], ["colors", 257],
    ["height", Infinity], ["coverageX", -.01], ["rowShift", 2.1]] as const)
    assert.throws(() => validateQuantizedStripeParams({ ...base, [key]: value }), new RegExp(key));
  assert.throws(() => prepareQuantizedStripes({ ...base, order: "unknown" }, [], 1), /order/);
  assert.throws(() => prepareQuantizedStripes({ ...base, order: "shuffle" }, [], NaN), /seed/i);
  assert.throws(() => prepareQuantizedStripes(params({ samples: 512, colors: 256 }), [0x123456], 1), /work limit/i);
  assert.throws(() => prepareQuantizedStripes(params({ samples: 2 }), [], 1), /palette-ramp/);
});

test("zero extents and either coverage yield no ink even for an otherwise valid sequence", () => {
  const base = seq([["#123", 2], ["#abc", 4]]);
  for (const key of ["width", "height", "coverageX", "coverageY"]) {
    const q = { ...base, [key]: 0 };
    assert.deepEqual(prepareQuantizedStripes(q, [], 5).stripes, []);
    assert.equal(paint(q).length, 0);
  }
});
