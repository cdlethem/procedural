import assert from 'node:assert/strict';
import test from 'node:test';
import { createInstrument, validateInstrument, validateParameters } from '../dist/index.js';

test('created instrument inputs have independent mutable parameters, palettes and edits', () => {
  const first = createInstrument('cut-marks');
  const second = createInstrument('cut-marks');
  const original = structuredClone(second);
  const key = Object.keys(first.params)[0];
  first.params[key] = 'changed by a consumer';
  first.palette[0] = 0;
  first.cutEdits.push({ kind: 'remove', id: 0 });
  assert.deepEqual(second, original);
  assert.deepEqual(createInstrument('cut-marks'), original);
});

test('current admission rejects historical fields and invalid seed or palette data', () => {
  const input = createInstrument('perceptual-bands');
  assert.deepEqual(validateInstrument(input), input);
  const original = structuredClone(input);
  assert.throws(() => validateInstrument({ ...input, legacy: true }));
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, legacy: false } }));
  for (const seed of [-1, 2 ** 32, 1.5, Infinity])
    assert.throws(() => validateInstrument({ ...input, seed }));
  for (const palette of [[], [0x123456], [0x123456, NaN], Array(13).fill(0x123456)])
    assert.throws(() => validateInstrument({ ...input, palette }));
  const admitted = validateInstrument(input);
  admitted.palette[0] = (admitted.palette[0] + 1) >>> 0;
  admitted.params.centerX = Number(admitted.params.centerX) + 1;
  assert.deepEqual(input, original);
});

test('parameter admission separates slider intervals, integer counts and coupled work bounds', () => {
  const band = createInstrument('perceptual-bands');
  const entered = { ...band.params, centerX: -123.25, rotation: 721.5 };
  assert.deepEqual(validateParameters(band.technique, entered), entered);
  assert.throws(() => validateParameters(band.technique, { ...entered, bands: 2.5 }));
  const arc = createInstrument('oklab-orbits');
  assert.throws(() => validateParameters(arc.technique, { ...arc.params, orbits: 256, segments: 256 }));
  const empty = { ...arc.params, orbits: 0, segments: 2048 };
  assert.deepEqual(validateParameters(arc.technique, empty), empty);
});

test('growth admission rejects coupled work before preparation or drawing', () => {
  for (const [id, ticks] of [
    ['bridge-web', 12],
    ['neighborhood-growth', 18],
    ['elastic-loops', 14],
  ] as const) {
    const input = createInstrument(id);
    assert.throws(() => validateInstrument({
      ...input, params: { ...input.params, ticks },
    }));
  }
});
