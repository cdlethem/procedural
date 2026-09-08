#!/usr/bin/env node
import assert from 'node:assert/strict';
import { seededEndpointBranches2D } from '../../packages/javascript/src/branch-tree.js';
import { seededTrianglePoints2D, mapTriangleCoordinates2D } from '../../packages/javascript/src/triangle-points.js';

const tree = seededEndpointBranches2D({ seed:42, root:{ origin:[0,0], heading:0, length:1 }, rules:[], maxSegments:1 });
const triangle = [[0,0],[16,0],[0,8]];
const seeded = seededTrianglePoints2D({ seed:42, count:1, triangle });
const mapped = mapTriangleCoordinates2D({ triangle, unitCoordinates:[[0.25,0.5]] });
for (const [name, result, into, at, width] of [
  ['branches',tree,'segmentInto','segmentAt',4],
  ['seeded triangle',seeded,'pointInto','pointAt',2],
  ['mapped triangle',mapped,'pointInto','pointAt',2],
]) {
  for (const variant of ['readonly','setter','nonextensible']) {
    const out = new Array(width); out[0] = 99;
    const before = Object.getOwnPropertyDescriptors(out);
    let calls = 0, caught;
    const descriptor = variant === 'setter'
      ? { configurable:true, set() { calls += 1; } }
      : { configurable:true, value:88, writable:variant === 'nonextensible' };
    const old = Object.getOwnPropertyDescriptor(Array.prototype,'1');
    Object.defineProperty(Array.prototype,'1',descriptor);
    try {
      if (variant === 'nonextensible') Object.preventExtensions(out);
      try { result[into](0,out,0); } catch (error) { caught = error; }
    } finally {
      if (old) Object.defineProperty(Array.prototype,'1',old);
      else delete Array.prototype[1];
    }
    assert.equal(caught?.code,'INVALID_OUTPUT',`${name} ${variant}`);
    assert.equal(calls,0,`${name} setter not invoked`);
    assert.deepEqual(Object.getOwnPropertyDescriptors(out),before,`${name} atomic failure`);
  }
  const sparse = new Array(width + 2); sparse[0] = 99; sparse[width+1] = 98;
  assert.equal(result[into](0,sparse,1),sparse);
  assert.deepEqual(sparse.slice(1,width+1),result[at](0));
  assert.equal(sparse[0],99); assert.equal(sparse[width+1],98);
}
console.log('Passed inherited-slot atomicity and sparse success for all three retained outputs.');
