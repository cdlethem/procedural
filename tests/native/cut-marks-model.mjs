#!/usr/bin/env node
/**
 * Focused pure-model checks for the CutMarks starter: retained identity, select/cut/
 * remove semantics, and reset behavior. Cross-checked against a real java.util.Random(42)
 * + RetainedRectangles2D reference run (leaf 3 bounds 24,24,308.79477376762543,298.5078454482841;
 * size 37) before this test was written.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createCutMarks } from "../../packages/javascript/examples/cut-marks/cut-marks.js";

function main() {
  const composition = createCutMarks();
  assert.equal(composition.model.size, 37, "seeded 12-cut setup produces 37 aligned regions");
  const leaf3 = composition.model.leaf(3);
  assert.deepEqual(leaf3.bounds, [24, 24, 308.79477376762543, 298.5078454482841],
    "leaf 3 bounds match the real java.util.Random(42) reference run");

  const alignedBoundsKey = composition.model.leaves().map((l) => l.bounds.join(",")).sort().join("|");
  composition.toggleStaggered();
  assert.equal(composition.staggered, true);
  const staggeredSize = composition.model.size;
  assert.equal(staggeredSize, 37, "staggered policy keeps the same region count (ratios stay interior)");
  const staggeredBoundsKey = composition.model.leaves().map((l) => l.bounds.join(",")).sort().join("|");
  assert.notEqual(staggeredBoundsKey, alignedBoundsKey, "staggered Y-ratio policy changes the cut geometry");

  composition.toggleHoles();
  assert.equal(composition.holes, true);
  for (const leaf of composition.model.leaves()) assert.notEqual(leaf.id % 7, 0, "every id%7===0 leaf was removed");

  composition.reset();
  assert.equal(composition.staggered, false, "reset restores aligned setup");
  assert.equal(composition.holes, false, "reset restores solid (no holes)");
  assert.equal(composition.model.size, 37, "reset restores the identical 37-region layout");
  assert.deepEqual(composition.model.leaf(3).bounds, [24, 24, 308.79477376762543, 298.5078454482841],
    "reset restores byte-identical leaf 3 bounds");

  composition.select(100, 100);
  assert.equal(composition.selectedId, 3, "clicking inside leaf 3's bounds selects it");
  composition.select(-10, -10);
  assert.equal(composition.selectedId, -1, "clicking outside every region clears selection");

  composition.select(100, 100);
  composition.cutSelected("X");
  assert.notEqual(composition.selectedId, 3, "cutting the selection replaces it with a low-side child");
  assert.equal(composition.model.size, 38, "a successful cut adds exactly one region");

  const afterCutId = composition.selectedId;
  composition.removeSelected();
  assert.equal(composition.selectedId, -1, "removal clears the selection");
  assert.throws(() => composition.model.leaf(afterCutId), { code: "UNKNOWN_ID" }, "removed id is no longer live");
  assert.equal(composition.model.size, 37, "removal restores the pre-cut region count");

  // removeSelected() on an already-cleared selection (selectedId === -1) is a guarded no-op.
  composition.removeSelected();
  assert.equal(composition.selectedId, -1, "removeSelected with no selection stays a no-op");
  assert.equal(composition.model.size, 37, "no-op removal does not change the region count");

  return {
    baseSize: 37,
    staggeredSize,
    leaf3Bounds: leaf3.bounds,
  };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
