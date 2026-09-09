#!/usr/bin/env node
/**
 * Focused pure-model checks for the PointerMarks starter: pointer pull
 * geometry, return-to-initial drift, tick advance, wire/targets toggles,
 * pointer release, and reset semantics. Cross-checked against a real
 * RegularGrid + TargetSprings2D + Delaunay2D Java reference run before this
 * test was written (body24 after one tick at pointer (300,300):
 * 319.94942809041584, byte-identical).
 */
import assert from "node:assert/strict";
import { createPointerMarks, PALETTE } from "../../packages/javascript/examples/pointer-marks/pointer-marks.js";

function channels(rgb) { return { r: (rgb >> 16) & 0xff, g: (rgb >> 8) & 0xff, b: rgb & 0xff }; }

function main() {
  const composition = createPointerMarks();
  assert.equal(composition.motion.size, 49, "7x7 grid produces 49 spring bodies");
  assert.equal(composition.initialMesh.edgeCount, 120, "initial Delaunay wire has 120 edges");
  const p0 = [0, 0];
  composition.motion.positionInto(0, p0, 0);
  assert.deepEqual(p0, [128, 128], "grid origin body starts at (128,128)");
  assert.equal(composition.tick, 0);
  assert.equal(composition.running, false);

  // One tick with no pointer: nothing inside the radius moves, but the
  // spring state is stepped (positions at initial targets stay fixed).
  composition.stepWithInput(false, 0, 0);
  assert.equal(composition.tick, 1);
  const p0b = [0, 0];
  composition.motion.positionInto(0, p0b, 0);
  assert.deepEqual(p0b, [128, 128], "body outside pointer radius stays at initial");

  // Pointer pull: body24 starts at (320,320); pointer at (300,300) is within
  // radius and pulls it toward the pointer.
  const c2 = createPointerMarks();
  c2.stepWithInput(true, 300, 300);
  const p24 = [0, 0];
  c2.motion.positionInto(24, p24, 0);
  assert.equal(p24[0], 319.94942809041584, "body24 matches Java reference exactly");
  assert.equal(p24[1], 319.94942809041584, "body24 matches Java reference exactly (y)");

  // Pointer outside the canvas is not held.
  const c3 = createPointerMarks();
  c3.capturePointer(700, 300, 640, 640);
  assert.equal(c3.pointerHeld, false, "pointer outside canvas is released");
  c3.capturePointer(300, 300, 640, 640);
  assert.equal(c3.pointerHeld, true, "pointer inside canvas is held");
  c3.releasePointer();
  assert.equal(c3.pointerHeld, false, "releasePointer clears held state");

  // Finite-pointer contract.
  assert.throws(() => c3.stepWithInput(true, NaN, 0), /finite pointer required/);

  // Toggles and reset restore the exact initial state.
  const c4 = createPointerMarks();
  c4.toggleWire();
  c4.toggleShowTargets();
  c4.toggleRunning();
  c4.capturePointer(280, 280, 640, 640);
  c4.stepWithInput(true, 280, 280);
  const after = c4.motion.toValues();
  c4.reset();
  assert.equal(c4.tick, 0, "reset zeroes tick");
  assert.equal(c4.wire, false, "reset clears wire");
  assert.equal(c4.showTargets, false, "reset clears target guides");
  assert.equal(c4.running, false, "reset clears running");
  assert.equal(c4.pointerHeld, false, "reset clears pointer hold");
  const before = createPointerMarks().motion.toValues();
  assert.deepEqual(c4.motion.toValues(), before, "reset restores identical spring state");
  assert.deepEqual(c4.targets, createPointerMarks().targets, "reset restores identical targets");
  assert.notDeepEqual(after.bodies[24].position, before.bodies[24].position, "pre-reset state actually changed");

  // Palette channels used by the renderer.
  assert.deepEqual(Object.values(channels(PALETTE[0])), [0x17, 0x3f, 0x5f]);

  return { bodyCount: 49, edgeCount: 120, body24AfterPull: p24 };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
