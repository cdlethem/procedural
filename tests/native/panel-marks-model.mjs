#!/usr/bin/env node
/**
 * Focused pure-model checks for the PanelMarks starter: retained layout identity,
 * cell-count/attempt behavior, and reset semantics.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createPanelMarks } from "../../packages/javascript/examples/panel-marks/panel-marks.js";

function main() {
  const composition = createPanelMarks();
  assert.equal(composition.attempts, 80, "default attempts is 80");
  assert.equal(composition.randomAxis, false, "default axis policy is longest");
  const baseSize = composition.layout.size;
  assert.ok(baseSize > 1, "80 attempts produces more than the initial single cell");

  const bounds = [0, 0, 0, 0];
  composition.layout.boundsInto(0, bounds);
  assert.equal(bounds.length, 4, "boundsInto writes a 4-element rectangle");

  composition.cycleAttempts();
  assert.equal(composition.attempts, 240, "cycle 80 -> 240");
  const size240 = composition.layout.size;

  composition.cycleAttempts();
  assert.equal(composition.attempts, 20, "cycle 240 -> 20");
  const size20 = composition.layout.size;
  assert.ok(size20 < baseSize && baseSize < size240, "fewer attempts yields fewer cells");

  composition.cycleAttempts();
  assert.equal(composition.attempts, 80, "cycle 20 -> 80 wraps");
  assert.equal(composition.layout.size, baseSize, "same seed/attempts rebuilds identical cell count");

  composition.toggleAxisPolicy();
  assert.equal(composition.randomAxis, true, "axis policy toggled to random");
  const randomSize = composition.layout.size;

  composition.reset();
  assert.equal(composition.attempts, 80, "reset restores attempts");
  assert.equal(composition.randomAxis, false, "reset restores axis policy");
  assert.equal(composition.layout.size, baseSize, "reset restores identical cell count");

  return { baseSize, size240, size20, randomSize };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
