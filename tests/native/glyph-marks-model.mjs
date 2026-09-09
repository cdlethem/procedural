#!/usr/bin/env node
/**
 * Pure-model checks for the GlyphMarks starter. The accepted gradient-path
 * core is composed with JDK17 java.util.Random metadata and compared to a real
 * GlyphComposition.create(42) Java run, including alternate integration
 * settings that must retain metadata while changing paths.
 */
import assert from "node:assert/strict";
import { createGlyphComposition } from "../../packages/javascript/examples/glyph-marks/glyph-marks.js";

const JAVA_PATHS = [
  [370, 563, 16, 4, 313.1014776788869, 576.8765799177265, 262.6493917056511, 548.5458973287552],
  [570, 205, 33, 8, 527.0433164108102, 243.431416681132, 504.7468026718165, 297.452693722997],
  [599, 533, 30, 2, 542.2372323538401, 520.8960311485033, 484.7876958142017, 512.322039284827],
  [516, 572, 36, 2, 462.4417163141203, 549.0048709766334, 411.5409087573371, 523.2668698275012],
  [96, 290, 23, 9, 97.56863580983931, 349.0962913825025, 70.31987243060429, 401.1389901881818],
  [80, 223, 18, 3, 36.222865864774846, 183.4079463317207, -18.414728761474038, 170.96782823838103],
];

function point(path, index) {
  const result = new Float64Array(2);
  path.pointInto(index, result, 0);
  return [...result];
}

function main() {
  const base = createGlyphComposition(42, 0.75, 0.006);
  assert.equal(base.pathCount, 48, "fixed path count");
  for (let i = 0; i < JAVA_PATHS.length; i += 1) {
    const [x, y, size, symbol, x80, y80, x159, y159] = JAVA_PATHS[i];
    const path = base.pathAt(i);
    // Step zero is the retained pre-advance anchor used for the first stamp.
    assert.deepEqual(point(path, 0), [x, y], `path ${i} pre-advance anchor`);
    assert.equal(base.sizeAt(i), size, `path ${i} size`);
    assert.equal(base.symbolIndexAt(i), symbol, `path ${i} symbol index`);
    assert.deepEqual(point(path, 80), [x80, y80], `path ${i} step 80`);
    assert.deepEqual(point(path, 159), [x159, y159], `path ${i} final stamped point`);
  }
  assert.equal(base.sizeAt(47), 30, "last path size");
  assert.equal(base.symbolIndexAt(47), 3, "last path symbol");
  assert.deepEqual(point(base.pathAt(47), 0), [372, 451], "last path start");
  assert.deepEqual(point(base.pathAt(47), 159), [265.06285187602026, 403.7225178325658], "last path final stamped point");

  const fast = createGlyphComposition(42, 2, 0.006);
  const fine = createGlyphComposition(42, 0.75, 0.03);
  for (const altered of [fast, fine]) {
    for (let i = 0; i < base.pathCount; i += 1) {
      assert.equal(altered.sizeAt(i), base.sizeAt(i), `settings retain size ${i}`);
      assert.equal(altered.symbolIndexAt(i), base.symbolIndexAt(i), `settings retain symbol ${i}`);
      assert.deepEqual(point(altered.pathAt(i), 0), point(base.pathAt(i), 0), `settings retain start ${i}`);
    }
  }
  assert.deepEqual(point(fast.pathAt(0), 80), [236.11256204504014, 518.188928863577], "distance setting changes trajectory");
  assert.deepEqual(point(fine.pathAt(0), 80), [321.35632777136084, 531.9526307871523], "field-scale setting changes trajectory");

  assert.throws(() => base.pathAt(-1), RangeError);
  assert.throws(() => base.sizeAt(48), RangeError);
  assert.throws(() => createGlyphComposition(-1, 0.75, 0.006), RangeError);
  assert.throws(() => createGlyphComposition(42, 0, 0.006), RangeError);
  return { pathCount: base.pathCount, baselineStamps: base.pathCount * 160 };
}

console.log(JSON.stringify({ status: "passed", ...main() }));
