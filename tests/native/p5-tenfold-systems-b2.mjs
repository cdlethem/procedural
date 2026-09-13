import assert from"node:assert/strict";import{readFile}from"node:fs/promises";import{tokenTurtle2D}from"../../packages/javascript/src/token-turtle-2d.js";import{adjacencyTileCollapse2D}from"../../packages/javascript/src/adjacency-tile-collapse-2d.js";import{seededDepthFirstSpanningTree}from"../../packages/javascript/src/seeded-depth-first-spanning-tree.js";for(const[n,f]of[["token-turtle-2d",tokenTurtle2D],["adjacency-tile-collapse-2d",adjacencyTileCollapse2D],["seeded-depth-first-spanning-tree",seededDepthFirstSpanningTree]]){const j=JSON.parse(await readFile(new URL(`../../fixtures/operations/${n}.json`,import.meta.url)));for(const x of j.cases){if(x.error)assert.throws(()=>f(x.input),e=>e.code===x.error,`${n}/${x.id}`);else assert.deepEqual(f(x.input),x.output,`${n}/${x.id}`);}}console.log('p5 systems b2 passed');
// Root review: diagnostic identity, passive carriers, deterministic graph structure.
const turtleInput={tokens:['?'],commands:[],start:{position:[0,0],heading:0},unknown:'ERROR',maxSegments:2,maxStackDepth:2,maxWork:3};
assert.throws(()=>tokenTurtle2D(turtleInput),e=>e.code==='UNKNOWN_TOKEN'&&e.tokenIndex===0);
const contradiction={columns:2,rows:1,right:[[]],down:[[]],weights:[1],domains:[[0],[0]],rngState:0,maxWork:100};
assert.throws(()=>adjacencyTileCollapse2D(contradiction),e=>e.code==='CONTRADICTION'&&e.cellIndex===0);
for(const [fn,input]of [[tokenTurtle2D,turtleInput],[adjacencyTileCollapse2D,contradiction]]){
 let reads=0;const bad={...input};Object.defineProperty(bad,Object.keys(bad)[0],{enumerable:true,get(){reads++;return null;}});assert.throws(()=>fn(bad),e=>e.code==='INVALID_INPUT');assert.equal(reads,0);
}
const graph={vertexCount:16,edges:[],root:0,rngState:42,maxWork:10000};
for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)if(b===a+4||(b===a+1&&a%4!==3))graph.edges.push([a,b]);
const original=structuredClone(graph),tree=seededDepthFirstSpanningTree(graph);assert.deepEqual(graph,original);assert.deepEqual(tree,seededDepthFirstSpanningTree(graph));assert.equal(tree.edges.length,15);
for(let i=1;i<16;i++){assert.ok(tree.parents[i]>=0);assert.equal(tree.depths[i],tree.depths[tree.parents[i]]+1);}
tree.edges[0][0]=99;assert.deepEqual(graph,original);
assert.throws(()=>seededDepthFirstSpanningTree({vertexCount:4294967295,edges:[],root:0,rngState:0,maxWork:0}),e=>e.code==='WORK_LIMIT');
