import assert from 'node:assert/strict';
import {delaunay2D} from '../../packages/javascript/src/delaunay.js';
// A strict convex upper chain longer than V8's function-argument limit.
// Every point is an exact integer; no tolerance or uncertain hull membership.
const count=140000;
const result=delaunay2D({points:Array.from({length:count},(_,i)=>[i,-i*i]),maxWork:560000});
assert.equal(result.vertexCount,count);
assert.equal(result.faceCount,count-2);
assert.equal(result.edgeCount,2*count-3);
assert.ok(result.workUsed<=560000);
console.log(JSON.stringify({status:'passed',vertices:result.vertexCount,faces:result.faceCount,edges:result.edgeCount,workUsed:result.workUsed}));
