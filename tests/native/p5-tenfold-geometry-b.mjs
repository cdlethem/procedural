import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assembleSegmentChains2D } from "../../packages/javascript/src/assemble-segment-chains-2d.js";
import { poissonDisc2D } from "../../packages/javascript/src/poisson-disc-2d.js";
import { lloydRelaxation2D } from "../../packages/javascript/src/lloyd-relaxation-2d.js";
import { skylinePack2D } from "../../packages/javascript/src/skyline-pack-2d.js";
import { costGridPaths2D } from "../../packages/javascript/src/cost-grid-paths-2d.js";

const cases = [
  ["assemble-segment-chains-2d", assembleSegmentChains2D], ["poisson-disc-2d", poissonDisc2D],
  ["lloyd-relaxation-2d", lloydRelaxation2D], ["skyline-pack-2d", skylinePack2D], ["cost-grid-paths-2d", costGridPaths2D],
];
for (const [name, operation] of cases) {
  const fixture = JSON.parse(await readFile(new URL(`../../fixtures/operations/${name}.json`, import.meta.url)));
  for (const test of fixture.cases) {
    if (test.error) assert.throws(() => operation(test.input), (error) => error.code === test.error, `${name}/${test.id}`);
    else assert.deepEqual(operation(test.input), test.output, `${name}/${test.id}`);
  }
}
const chains = assembleSegmentChains2D({segments:[[[2,0],[1,0]],[[0,0],[1,0]],[[4,0],[3,0]]],maxWork:84}).chains;
assert.deepEqual(chains.map(c=>c.segmentIndices), [[1,0],[2]], "chains use canonical orientation and component edge order");
assert.throws(() => assembleSegmentChains2D({segments:[[[0,0],[1,0]],[[1,0],[0,0]]],maxWork:40}), e=>e.code === "INVALID_TOPOLOGY");
const poisson = poissonDisc2D({bounds:[0,0,10,10],radius:.6,attemptsPerActive:5,maxPoints:100,rngState:42,maxWork:100000});
for(let i=0;i<poisson.points.length;i+=1) for(let j=0;j<i;j+=1) assert.ok(Math.hypot(poisson.points[i][0]-poisson.points[j][0],poisson.points[i][1]-poisson.points[j][1]) >= .6, "Poisson grid agrees with brute-force separation");
assert.equal(poissonDisc2D({bounds:[0,0,10,10],radius:.6,attemptsPerActive:5,maxPoints:100,rngState:42,maxWork:100000}).rngState, poisson.rngState, "Poisson explicit LCG is replayable");
assert.throws(()=>lloydRelaxation2D({sites:[[0,0]],bounds:[0,0,2,2],iterations:1,strength:1,maxWork:10}),e=>e.code === "WORK_LIMIT", "Lloyd reserves child and centroid budget");
const path=costGridPaths2D({columns:3,rows:2,costs:[0,0,0,0,0,0],start:0,maxWork:66});
assert.deepEqual(path.predecessors,[null,0,1,0,1,2], "Dijkstra visits neighbors up/right/down/left and retains equal ties");
const packed=skylinePack2D({width:2,height:1,rectangles:[{width:1,height:1},{width:1,height:1}],maxWork:66});assert.deepEqual(packed.placements.map(p=>p.x),[0,1]);
console.log("p5 tenfold geometry B passed");
