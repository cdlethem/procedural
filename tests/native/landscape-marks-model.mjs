#!/usr/bin/env node
/**
 * Focused pure-model checks for the LandscapeMarks starter: the full
 * generation pipeline (this module's java.util.Random-driven policy plus
 * field.gradient-noise-2d-01, sampling.ordered-circle-filter-2d, and
 * topology.delaunay-2d) cross-checked against a real
 * LandscapeComposition.create(42) Java reference run (saved before this
 * test was written): horizon, three horizon layers, four stripe start/drift
 * pairs, five accepted circle placements (position, radius, three palette
 * indices), five mesh faces' full speck policy, two noise samples, and one
 * face/circle deep into each sequence.
 */
import assert from "node:assert/strict";
import { createLandscapeComposition } from "../../packages/javascript/examples/landscape-marks/landscape-marks.js";

const JAVA_HORIZON_LAYERS = [
  [0.006832234717598454, 0], [0.009420735430282127, 2], [0.006655489517945736, 2],
];
const JAVA_STRIPES = {
  ground0: [4.061314975009056, 0.008052734968238023],
  ground1: [6.858811557980118, 0.012704857188757315],
  sky0: [3.958198439317279, 0.002119717329900681],
  sky1: [1.3549273513130728, 0.0004825178734817249],
};
const JAVA_PLACEMENTS = [
  [263.2056963626918, 289.14986999393886, 4.681383723144363, 5, 7, 1],
  [87.03792217984119, 284.78613947573837, 4.5213963405267785, 7, 2, 3],
  [191.1183188123265, 424.9641542533637, 12.10603968856291, 3, 6, 0],
  [77.4282462130487, 254.70482360322666, 3.6738231244342394, 1, 8, 4],
  [210.74412274160565, 573.2650507083576, 23.599968436238395, 6, 3, 2],
];
const JAVA_FACES = [
  [2.4404127221351333, 3.0960575483951165, 101.71567699710491, 6],
  [0.2962474048298832, 2.3259993294086185, 86.45553870415125, 4],
  [1.7696097184862771, 2.342148294360778, 26.40157259705118, 4],
  [0.7909042302849478, 2.6925542577401, 2.0268054794293278, 5],
  [2.175898950264501, 2.1222212718292885, 167.97318185095045, 2],
];

function main() {
  const composition = createLandscapeComposition(42);
  assert.equal(composition.horizon, 0.2591345520049302, "horizon matches Java");

  for (let layer = 0; layer < 3; layer += 1) {
    assert.equal(composition.horizonFrequency(layer), JAVA_HORIZON_LAYERS[layer][0], `horizon layer ${layer} frequency`);
    assert.equal(composition.horizonColor(layer), JAVA_HORIZON_LAYERS[layer][1], `horizon layer ${layer} color`);
  }

  assert.equal(composition.stripeStart(false, 0), JAVA_STRIPES.ground0[0]);
  assert.equal(composition.stripeDrift(false, 0), JAVA_STRIPES.ground0[1]);
  assert.equal(composition.stripeStart(false, 1), JAVA_STRIPES.ground1[0]);
  assert.equal(composition.stripeDrift(false, 1), JAVA_STRIPES.ground1[1]);
  assert.equal(composition.stripeStart(true, 0), JAVA_STRIPES.sky0[0]);
  assert.equal(composition.stripeDrift(true, 0), JAVA_STRIPES.sky0[1]);
  assert.equal(composition.stripeStart(true, 1), JAVA_STRIPES.sky1[0]);
  assert.equal(composition.stripeDrift(true, 1), JAVA_STRIPES.sky1[1]);

  assert.equal(composition.placements.size, 47, "47 of 50 proposals accepted, matching Java's separation filter");
  const point = new Float64Array(2);
  for (let i = 0; i < JAVA_PLACEMENTS.length; i += 1) {
    composition.placements.pointInto(i, point, 0);
    const [x, y, r, disk, halo, inner] = JAVA_PLACEMENTS[i];
    assert.equal(point[0], x, `placement ${i} x`);
    assert.equal(point[1], y, `placement ${i} y`);
    // Radius derives from Math.pow(depth, 1.4) in the Java source (not
    // StrictMath.pow, which the JLS explicitly does not guarantee identical
    // across platforms/engines -- confirmed here too: Bun and Node disagree
    // by 1 ULP on this exact input). A tight relative tolerance still catches
    // any real transcription bug while tolerating that expected variance.
    assert.ok(Math.abs(composition.placements.radiusAt(i) - r) <= Math.abs(r) * 1e-12,
      `placement ${i} radius within pow-engine tolerance: ${composition.placements.radiusAt(i)} vs ${r}`);
    assert.equal(composition.diskColor(i), disk, `placement ${i} disk color`);
    assert.equal(composition.haloColor(i), halo, `placement ${i} halo color`);
    assert.equal(composition.innerColor(i), inner, `placement ${i} inner color`);
  }

  assert.equal(composition.mesh.faceCount, 81, "faceCount matches Java");
  for (let f = 0; f < JAVA_FACES.length; f += 1) {
    const [size, angle, stretch, color] = JAVA_FACES[f];
    assert.equal(composition.speckSize(f), size, `face ${f} speck size`);
    assert.equal(composition.speckAngle(f), angle, `face ${f} speck angle`);
    assert.equal(composition.speckStretch(f), stretch, `face ${f} speck stretch`);
    assert.equal(composition.speckColor(f), color, `face ${f} speck color`);
  }

  assert.equal(composition.noise.sample(100, 200), 0.5, "noise sample(100,200)");
  assert.equal(composition.noise.sample(0.01, 0), 0.4950049253, "noise sample(0.01,0)");

  // Deep into each sequence, catching cumulative drift from a transcription bug.
  assert.equal(composition.speckSize(80), 2.1542075907114056, "last face speck size");
  assert.equal(composition.speckColor(80), 8, "last face speck color");
  assert.equal(composition.diskColor(46), 0, "last circle disk color");

  return { horizon: composition.horizon, placementCount: composition.placements.size, faceCount: composition.mesh.faceCount };
}

const result = main();
console.log(JSON.stringify({ status: "passed", ...result }));
