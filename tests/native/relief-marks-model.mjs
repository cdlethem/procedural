#!/usr/bin/env node
/**
 * Pure-model checks for the ReliefMarks starter. The accepted quadrant
 * partition and Delaunay implementations are exercised through the Momito
 * composition policy and checked against a real ReliefComposition.create(42)
 * Java reference: leaf/mesh counts, early and middle centres/spike policy,
 * early canonical faces, and a deep face.
 */
import assert from "node:assert/strict";
import { createReliefComposition } from "../../packages/javascript/examples/relief-marks/relief-marks.js";

const JAVA_LEAVES = [
  [-60, -60, true, 36.48], [-60, -420, true, 36.48], [-60, -300, true, 36.48],
  [-330, -210, true, 18.24], [-270, -390, true, 18.24], [420, -60, false, 36.48],
  [300, -60, true, 36.48], [-450, -90, true, 18.24],
];
const JAVA_FACES = [[0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 6], [0, 6, 1]];

function main() {
  const composition = createReliefComposition(42);
  assert.equal(composition.leafCount, 871, "leaf count matches Java");
  assert.equal(composition.mesh.vertexCount, 871, "mesh vertex count matches Java");
  assert.equal(composition.mesh.faceCount, 1716, "mesh face count matches Java");

  const point = new Float64Array(2);
  for (let i = 0; i < JAVA_LEAVES.length; i += 1) {
    const [x, y, spike, height] = JAVA_LEAVES[i];
    assert.equal(composition.centerInto(i, point, 0), point, `leaf ${i} returns supplied output`);
    assert.equal(point[0], x, `leaf ${i} centre x`);
    assert.equal(point[1], y, `leaf ${i} centre y`);
    assert.equal(composition.spikeAt(i), spike, `leaf ${i} spike choice`);
    assert.equal(composition.spikeHeight(i), height, `leaf ${i} spike height`);
  }
  composition.centerInto(435, point, 0);
  assert.deepEqual([...point], [213.75, -161.25], "middle centre matches Java");
  assert.equal(composition.spikeAt(435), true, "middle spike choice matches Java");
  assert.equal(composition.spikeHeight(435), 2.28, "middle spike height matches Java");

  const face = new Int32Array(3);
  for (let f = 0; f < JAVA_FACES.length; f += 1) {
    composition.mesh.triangleInto(f, face, 0);
    assert.deepEqual([...face], JAVA_FACES[f], `face ${f} canonical roles`);
  }
  composition.mesh.triangleInto(1715, face, 0);
  assert.deepEqual([...face], [867, 869, 870], "deep canonical face matches Java");

  assert.throws(() => composition.centerInto(-1, point), RangeError);
  assert.throws(() => composition.spikeAt(871), RangeError);
  assert.throws(() => createReliefComposition(-1), RangeError);
  return { leafCount: composition.leafCount, faceCount: composition.mesh.faceCount };
}

console.log(JSON.stringify({ status: "passed", ...main() }));
