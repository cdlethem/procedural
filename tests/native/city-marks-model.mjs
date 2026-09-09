#!/usr/bin/env node
/**
 * Focused pure-model checks for the CityMarks starter: the full generation
 * pipeline (layout.seeded-quadrant-partition-2d -> topology.delaunay-2d ->
 * this module's java.util.Random-driven building policy) cross-checked
 * against a real CityComposition.create(42) Java reference run (saved before
 * this test was written): face/window counts, five early faces' full policy
 * (height, palette phase, ground visibility/tone, window counts, all three
 * walls' width/height fractions, ten lit-window bits), and one face deep into
 * the sequence (580 faces total, exercising ~30 RNG draws per face).
 */
import assert from "node:assert/strict";
import { createCityComposition } from "../../packages/javascript/examples/city-marks/city-marks.js";

// CityComposition.create(42) reference (CityVerify.java, real Processing run).
const JAVA_FACES = [
  { height: 0.4970885833984255, phase: 0.30871945533265976, groundVisible: true, groundGray: 133, vertical: 19, horizontal: 20,
    walls: [[0.5245575030664074, 0.7480312451530251], [0.24102250895793872, 0.6464287767712846], [0.8965580586292701, 0.5407181539885753]],
    lit: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { height: 0.21930592033674198, phase: 0.24128759322058135, groundVisible: true, groundGray: 156, vertical: 19, horizontal: 16,
    walls: [[0.6946599612455309, 0.7691939762571092], [0.7535953570407594, 0.7071047730013562], [0.34852503379905675, 0.8164491772862803]],
    lit: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
  { height: 0.3124690033830687, phase: 0.37466650014770153, groundVisible: true, groundGray: 159, vertical: 19, horizontal: 21,
    walls: [[0.5977383956930318, 0.3182901509399457], [0.6467478944142607, 0.5606614891785844], [0.7606491536260043, 0.7287136726592429]],
    lit: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { height: 0.25251719228869823, phase: 0.37926158955538614, groundVisible: true, groundGray: 90, vertical: 16, horizontal: 22,
    walls: [[0.33109131811982573, 0.4561826337647855], [0.7525692153881696, 0.8041182722666451], [0.768543558421009, 0.2769573594128172]],
    lit: [0, 0, 0, 1, 0, 1, 0, 0, 1, 0] },
  { height: 0.342891273059524, phase: 0.809290065013873, groundVisible: false, groundGray: 33, vertical: 22, horizontal: 17,
    walls: [[0.667164830889013, 0.3264857860083449], [0.3931107128997553, 0.3513121677025425], [0.21942555251951695, 0.47397881361154687]],
    lit: [0, 1, 1, 1, 0, 0, 1, 0, 0, 0] },
];

function main() {
  const composition = createCityComposition(42);
  assert.equal(composition.mesh.faceCount, 580, "faceCount matches Java");
  assert.equal(composition.windowCount, 624033, "windowCount matches Java");

  for (let f = 0; f < JAVA_FACES.length; f += 1) {
    const jf = JAVA_FACES[f];
    assert.equal(composition.heightUnit(f), jf.height, `face ${f} height`);
    assert.equal(composition.palettePhase(f), jf.phase, `face ${f} phase`);
    assert.equal(composition.groundVisible(f), jf.groundVisible, `face ${f} groundVisible`);
    assert.equal(composition.groundGray(f), jf.groundGray, `face ${f} groundGray`);
    assert.equal(composition.verticalCount(f), jf.vertical, `face ${f} vertical`);
    assert.equal(composition.horizontalCount(f), jf.horizontal, `face ${f} horizontal`);
    for (let w = 0; w < 3; w += 1) {
      assert.equal(composition.wallWidthFraction(f, w), jf.walls[w][0], `face ${f} wall ${w} width`);
      assert.equal(composition.wallHeightFraction(f, w), jf.walls[w][1], `face ${f} wall ${w} height`);
    }
    for (let i = 0; i < 10; i += 1) {
      assert.equal(composition.windowLit(f, 0, i), jf.lit[i] === 1, `face ${f} wall0 window ${i} lit`);
    }
    // The window grid's point count matches vertical*horizontal exactly.
    assert.equal(composition.windowGrid(f).size, jf.vertical * jf.horizontal, `face ${f} window grid size`);
  }

  // A face deep into the sequence (exercises far more RNG draws than the
  // first few faces, catching any cumulative drift from a transcription bug).
  assert.equal(composition.heightUnit(290), 0.044087834152159514, "face 290 height");
  assert.equal(composition.palettePhase(290), 0.6002684818858645, "face 290 phase");

  // Bounds checking on the public accessors.
  assert.throws(() => composition.windowLit(0, 0, -1), RangeError);
  assert.throws(() => composition.windowLit(0, 0, composition.verticalCount(0) * composition.horizontalCount(0)), RangeError);
  assert.throws(() => composition.wallWidthFraction(0, 3), RangeError);

  return { faceCount: composition.mesh.faceCount, windowCount: composition.windowCount };
}

const result = main();
console.log(JSON.stringify({ status: "passed", ...result }));
