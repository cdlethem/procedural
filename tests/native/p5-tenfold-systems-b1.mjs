import assert from "node:assert/strict";import {readFile} from "node:fs/promises";import {dampedWaveStep2D} from "../../packages/javascript/src/damped-wave-step-2d.js";import {parallelTokenRewrite} from "../../packages/javascript/src/parallel-token-rewrite.js";
for(const [name,fn] of [["damped-wave-step-2d",dampedWaveStep2D],["parallel-token-rewrite",parallelTokenRewrite]]){const f=JSON.parse(await readFile(new URL(`../../fixtures/operations/${name}.json`,import.meta.url)));for(const x of f.cases){if(x.error)assert.throws(()=>fn(x.input),e=>e.code===x.error);else assert.deepEqual(fn(x.input),x.output);}}
const source={state:{displacement:[1],velocity:[0]},columns:1,rows:1,spacing:[1,1],speed:0,damping:0,dt:0,pinned:[0],boundary:"CLAMP",maxWork:7};const out=dampedWaveStep2D(source);source.state.displacement[0]=9;assert.equal(out.displacement[0],1);assert.deepEqual(parallelTokenRewrite({axiom:["AB"],rules:[],iterations:2,maxTokens:1,maxWork:7}),{tokens:["AB"]});console.log("p5 systems b1 passed");
// Root: CLAMP must sample the preceding cell, not the center, in both axes.
const impulse={state:{displacement:[0,1,0],velocity:[0,0,0]},columns:3,rows:1,spacing:[1,1],speed:1,damping:0,dt:1,pinned:[0,0,0],boundary:'CLAMP',maxWork:21};
assert.deepEqual(dampedWaveStep2D(impulse),{displacement:[1,-1,1],velocity:[1,-2,1]});
assert.deepEqual(dampedWaveStep2D({...impulse,columns:1,rows:3}),{displacement:[1,-1,1],velocity:[1,-2,1]});
const replacement=Array(150000).fill('x');
assert.equal(parallelTokenRewrite({axiom:['A'],rules:[{symbol:'A',replacement}],iterations:1,maxTokens:150000,maxWork:300004}).tokens.length,150000);
