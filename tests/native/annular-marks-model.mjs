#!/usr/bin/env node
/**
 * Focused pure-model checks for the AnnularMarks starter: retained mesh identity,
 * geometry-toggle rebuild behavior, and reset semantics. Cross-checked against a real
 * AnnularMesh3D Java reference run (faceCount 384; face 0 kind outer-wall, normal
 * 0.9978589232386036,0.06540312923014303,0, triangle 0,1,49, vertex0 150,0,-15)
 * before this test was written.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createAnnularMarks } from "../../packages/javascript/examples/annular-marks/annular-marks.js";

function main() {
  const composition = createAnnularMarks();
  const mesh = composition.mesh;
  assert.equal(mesh.faceCount, 384, "default 48-slice mesh has 384 faces");
  assert.equal(mesh.faceKindAt(0), "outer-wall", "face 0 is an outer-wall face");
  const n = [0, 0, 0], t = [0, 0, 0], v = [0, 0, 0];
  mesh.normalInto(0, n, 0);
  mesh.triangleInto(0, t, 0);
  mesh.vertexInto(t[0], v, 0);
  assert.deepEqual(n, [0.9978589232386036, 0.06540312923014303, 0],
    "face 0 normal matches the real AnnularMesh3D Java reference run");
  assert.deepEqual(t, [0, 1, 49], "face 0 triangle matches the reference run");
  assert.deepEqual(v, [150, 0, -15], "face 0 vertex 0 matches the reference run");
  assert.equal(composition.meshBuilds, 1, "one build at construction");

  composition.toggleCoarse();
  assert.equal(composition.coarse, true);
  assert.equal(composition.mesh.faceCount, 96, "12-slice coarse mesh has 96 faces");
  assert.equal(composition.meshBuilds, 2, "toggle triggers exactly one rebuild");

  composition.toggleAlternate();
  assert.equal(composition.alternate, true);
  assert.equal(composition.meshBuilds, 2, "recolor-only toggle does not rebuild the mesh");
  assert.equal(composition.faceColor("outer-wall", true), 0xd386a2, "alternate palette outer-wall color");
  assert.equal(composition.faceColor("outer-wall", false), 0x7597aa, "primary palette outer-wall color");

  composition.toggleArrangement();
  assert.equal(composition.arrangement, true);
  assert.equal(composition.meshBuilds, 2, "arrangement toggle does not rebuild the mesh");

  composition.reset();
  assert.equal(composition.wide, false);
  assert.equal(composition.deep, false);
  assert.equal(composition.coarse, false, "reset restores fine facets");
  assert.equal(composition.alternate, false);
  assert.equal(composition.arrangement, false);
  assert.equal(composition.mesh.faceCount, 384, "reset restores the identical 384-face mesh");
  assert.equal(composition.meshBuilds, 3, "reset with changed geometry triggers exactly one rebuild");

  const buildsBeforeNoOpReset = composition.meshBuilds;
  composition.reset();
  assert.equal(composition.meshBuilds, buildsBeforeNoOpReset,
    "reset with no geometry change does not rebuild (matches Java's geometryChanged guard)");

  return { faceCount: mesh.faceCount, coarseFaceCount: 96 };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
