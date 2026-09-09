#!/usr/bin/env node
/**
 * Focused pure-model checks for the ContactMarks starter: contact identity,
 * shifted-geometry rebuild, palette toggle, and reset semantics. Cross-checked
 * against a real NearestSegmentContact2D Java reference run before this test
 * was written (all ten contacts in both obstacle states match byte-identically).
 */
import assert from "node:assert/strict";
import { createContactMarks, PALETTE_DEFAULT, PALETTE_ALTERNATE } from "../../packages/javascript/examples/contact-marks/contact-marks.js";

const JAVA_REFERENCE = {
  false: [
    [221.0091743119266, 228.62385321100916, 3],
    [236.10108303249098, 158.19494584837545, 3],
    [346.18296529968455, 178.61198738170347, 0],
    [434.311377245509, 210.65868263473052, 0],
    [443.6641221374046, 301.6793893129771, 1],
    [420.0, 420.0, 1],
    [345.1677852348993, 455.90604026845637, 2],
    [248.22966507177034, 434.8325358851675, 2],
    [194.45378151260505, 352.54901960784315, 3],
    [210.94890510948906, 275.57177615571777, 3],
  ],
  true: [
    [248.26693227091633, 253.78486055776892, 3],
    [264.79715302491104, 213.5373665480427, 3],
    [348.5272914521112, 165.95262615859937, 0],
    [436.47166361974405, 208.59232175502743, 0],
    [443.6641221374046, 301.6793893129771, 1],
    [420.0, 420.0, 1],
    [345.1677852348993, 455.90604026845637, 2],
    [248.22966507177034, 434.8325358851675, 2],
    [209.2820133234641, 348.7046632124352, 3],
    [235.25212464589234, 285.4730878186969, 3],
  ],
};

function hitsOf(composition) {
  const hits = [];
  for (let i = 0; i < composition.contacts.size; i += 1) {
    const hit = composition.contacts.hitAt(i);
    hits.push(hit ? [hit.x, hit.y, hit.obstacleIndex] : null);
  }
  return hits;
}

function assertMatchesJava(composition, shifted) {
  const reference = JAVA_REFERENCE[shifted];
  const hits = hitsOf(composition);
  assert.equal(hits.length, 10, "ten queries produce ten results");
  for (let i = 0; i < 10; i += 1) {
    assert.notEqual(hits[i], null, `query ${i} has a hit (this piece omits misses in drawing)`);
    assert.equal(hits[i][0], reference[i][0], `query ${i} x matches Java`);
    assert.equal(hits[i][1], reference[i][1], `query ${i} y matches Java`);
    assert.equal(hits[i][2], reference[i][2], `query ${i} obstacleIndex matches Java`);
  }
}

function main() {
  const composition = createContactMarks();
  assert.equal(composition.contacts.size, 10);
  assert.equal(composition.shifted, false);
  assert.equal(composition.alternateColors, false);
  assertMatchesJava(composition, false);
  assert.deepEqual(composition.obstacles[0], [240, 140, 460, 220], "unshifted first edge");

  // Shifted corner changes only the first edge and the affected contacts.
  composition.toggleShifted();
  assert.deepEqual(composition.obstacles[0], [295, 140, 460, 220], "shifted first edge");
  assert.deepEqual(composition.obstacles[1], [460, 220, 410, 470], "other edges unchanged");
  assertMatchesJava(composition, true);

  // Palette toggle is display-only: contacts are not rebuilt.
  const before = hitsOf(composition);
  composition.toggleAlternateColors();
  assert.deepEqual(composition.palette, [...PALETTE_ALTERNATE]);
  assert.deepEqual(hitsOf(composition), before, "palette toggle does not rebuild contacts");

  // Reset: geometry rebuild only when the shifted corner actually changes.
  composition.reset();
  assert.equal(composition.shifted, false);
  assert.equal(composition.alternateColors, false);
  assertMatchesJava(composition, false);
  const afterShiftedReset = createContactMarks();
  afterShiftedReset.toggleShifted();
  afterShiftedReset.reset();
  assertMatchesJava(afterShiftedReset, false);
  assert.deepEqual(afterShiftedReset.obstacles[0], [240, 140, 460, 220], "reset restores unshifted corner");

  return { queries: 10, shiftedFirstEdge: [295, 140, 460, 220] };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
