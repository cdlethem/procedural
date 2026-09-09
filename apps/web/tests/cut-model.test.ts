import assert from "node:assert/strict";
import test from "node:test";
import {
  createCutModel,
  cutRegions,
  MAX_CUT_EDITS,
  validateCutEdits,
} from "../lib/cut-model";

function layer(cutEdits: unknown[] = [], params: Record<string, unknown> = {}) {
  return {
    id: "cut-test",
    technique: "cut-marks",
    visible: true,
    opacity: 1,
    seed: 42,
    palette: [0x123456, 0xabcdef],
    cutEdits,
    params: {
      cuts: 0,
      spread: 0.25,
      inset: 1,
      opacity: 190,
      staggered: false,
      ...params,
    },
  } as any;
}

test("CutMarks starts from stable seeded geometry when no direct edits exist", () => {
  const first = createCutModel(
    layer([], { cuts: 10, staggered: true }),
  ).toValues();
  const second = createCutModel(
    layer([], { cuts: 10, staggered: true }),
  ).toValues();
  assert.deepEqual(first, second);
  assert.deepEqual(cutRegions(layer()), [
    { id: 0, bounds: [24, 24, 616, 616] },
  ]);
});

test("CutMarks replays stable-id X and Y cuts then removal in recorded order", () => {
  const regions = cutRegions(
    layer([
      { kind: "cut", id: 0, axis: "X", coordinate: 320 },
      { kind: "cut", id: 1, axis: "Y", coordinate: 200 },
      { kind: "remove", id: 2 },
    ]),
  );
  assert.deepEqual(regions, [
    { id: 3, bounds: [24, 24, 320, 200] },
    { id: 4, bounds: [24, 200, 320, 616] },
  ]);
});

test("CutMarks rejects invalid edits before exposing any replay state", () => {
  assert.throws(
    () =>
      validateCutEdits(
        layer([{ kind: "cut", id: 0, axis: "Z", coordinate: 320 }]),
      ),
    /axis must be X or Y/,
  );
  assert.throws(
    () => validateCutEdits(layer([{ kind: "remove", id: -1 }])),
    /nonnegative safe integer/,
  );
  assert.throws(
    () =>
      validateCutEdits(
        layer([{ kind: "cut", id: 0, axis: "X", coordinate: Infinity }]),
      ),
    /coordinate must be finite/,
  );
  assert.throws(
    () =>
      cutRegions(
        layer([
          { kind: "remove", id: 0 },
          { kind: "cut", id: 0, axis: "X", coordinate: 320 },
        ]),
      ),
    /UNKNOWN_ID/,
  );
  assert.throws(
    () =>
      cutRegions(layer([{ kind: "cut", id: 0, axis: "X", coordinate: 24 }])),
    /INVALID_CUT/,
  );
});

test("CutMarks bounds direct edit history and forbids it on other techniques", () => {
  assert.throws(
    () =>
      validateCutEdits(
        layer(
          Array.from({ length: MAX_CUT_EDITS + 1 }, () => ({
            kind: "remove",
            id: 0,
          })),
        ),
      ),
    /64 edit limit/,
  );
  const nonCut = {
    ...layer([{ kind: "remove", id: 0 }]),
    technique: "field-marks",
  };
  assert.throws(() => validateCutEdits(nonCut), /only supported by cut-marks/);
});
