#!/usr/bin/env node
/**
 * Focused pure-model checks for the PathClipMarks starter: retained trace/clip
 * identity, notch reclip behavior, and reset semantics (reclip only when the notch
 * geometry actually changed). Cross-checked against a real GradientPath2D +
 * SegmentClip2D Java reference run (sources.size 960; clipped.size 405;
 * clipped[0]=[100,130.18768303358212,102.7492194933097,129.60672266870665],
 * source=10) before this test was written.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createPathClipMarks } from "../../packages/javascript/examples/path-clip-marks/path-clip-marks.js";

function main() {
  const composition = createPathClipMarks();
  assert.equal(composition.sources.length, 960, "6 paths x 160 steps = 960 source segments");
  assert.equal(composition.clipped.size, 405, "deep-notch clip keeps 405 pieces");
  const segment = [0, 0, 0, 0];
  composition.clipped.segmentInto(0, segment, 0);
  assert.deepEqual(segment, [100, 130.18768303358212, 102.7492194933097, 129.60672266870665],
    "clipped[0] matches the real GradientPath2D+SegmentClip2D Java reference run");
  assert.equal(composition.clipped.sourceIndexAt(0), 10, "clipped[0] source index matches the reference run");
  assert.equal(composition.clipBuilds, 1, "one clip build at construction");

  composition.toggleNotch();
  assert.equal(composition.shallowNotch, true);
  assert.equal(composition.clipBuilds, 2, "notch toggle triggers exactly one reclip");
  const shallowSize = composition.clipped.size;
  assert.notEqual(shallowSize, 405, "shallower notch changes the kept piece count");

  composition.toggleAlternateColors();
  composition.toggleShowUnclipped();
  assert.equal(composition.clipBuilds, 2, "redraw-only toggles never trigger a reclip");

  composition.reset();
  assert.equal(composition.shallowNotch, false, "reset restores deep notch");
  assert.equal(composition.alternateColors, false, "reset restores single color");
  assert.equal(composition.showUnclipped, false, "reset restores hidden source");
  assert.equal(composition.clipped.size, 405, "reset restores the identical 405-piece clip");
  assert.equal(composition.clipBuilds, 3, "reset with changed notch triggers exactly one reclip");

  const buildsBeforeNoOpReset = composition.clipBuilds;
  composition.reset();
  assert.equal(composition.clipBuilds, buildsBeforeNoOpReset,
    "reset with no notch change does not reclip (matches Java's reclips guard)");

  return { sourceCount: 960, deepSize: 405, shallowSize };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
