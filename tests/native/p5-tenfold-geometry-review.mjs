import assert from "node:assert/strict";
import { chaikinPolyline2D } from "../../packages/javascript/src/chaikin-polyline-2d.js";
import { simplifyPolyline2D } from "../../packages/javascript/src/simplify-polyline-2d.js";
import { offsetPolyline2D } from "../../packages/javascript/src/offset-polyline-2d.js";
import { convexHull2D } from "../../packages/javascript/src/convex-hull-2d.js";
import { triangulateSimplePolygon2D } from "../../packages/javascript/src/triangulate-simple-polygon-2d.js";
import { assembleSegmentChains2D } from "../../packages/javascript/src/assemble-segment-chains-2d.js";
import { poissonDisc2D } from "../../packages/javascript/src/poisson-disc-2d.js";
import { lloydRelaxation2D } from "../../packages/javascript/src/lloyd-relaxation-2d.js";
import { skylinePack2D } from "../../packages/javascript/src/skyline-pack-2d.js";
import { costGridPaths2D } from "../../packages/javascript/src/cost-grid-paths-2d.js";

const err=(fn,code)=>assert.throws(fn,e=>e?.code===code);
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
// Independent geometric invariants and boundary priorities, beyond golden vectors.
const source=[[0,0],[2,0],[2,2]];
assert.deepEqual(chaikinPolyline2D({points:source,closed:false,iterations:0,maxWork:3}).points,source);
assert.deepEqual(simplifyPolyline2D({points:[[0,0],[1,0],[2,0],[3,3]],tolerance:0,maxWork:16}).sourceIndices,[0,2,3],"equal-distance ties keep the earliest point");
assert.deepEqual(offsetPolyline2D({points:source,closed:false,distance:0,miterLimit:1,maxWork:12}).points,source,"zero offset retains one vertex per input point");
const hull=convexHull2D({points:[[1,1],[0,0],[2,0],[2,2],[0,2],[1,0]],maxWork:42});
assert.deepEqual(hull.sourceIndices,[1,2,3,4]);
const concave=[[0,0],[4,0],[4,4],[2,2],[0,4]], tri=triangulateSimplePolygon2D({points:concave,maxWork:150});
assert.equal(tri.triangles.length,3); for(const t of tri.triangles){const [a,b,c]=t.map(i=>tri.points[i]);assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0);}
const cycle=assembleSegmentChains2D({segments:[[[1,0],[1,1]],[[0,0],[1,0]],[[0,1],[0,0]],[[1,1],[0,1]]],maxWork:144}).chains[0];
assert.deepEqual(cycle.points[0],[0,0]);assert.deepEqual(cycle.segmentIndices,[2,3,0,1]);assert.equal(cycle.closed,true);
const empty=poissonDisc2D({bounds:[0,0,1,1],radius:.2,attemptsPerActive:1,maxPoints:0,rngState:99,maxWork:0});assert.deepEqual(empty,{points:[],rngState:99,exhausted:false});
const samples=poissonDisc2D({bounds:[0,0,3,2],radius:.35,attemptsPerActive:4,maxPoints:50,rngState:7,maxWork:20000});for(const p of samples.points){assert.ok(p[0]>=0&&p[0]<=3&&p[1]>=0&&p[1]<=2);}for(let i=0;i<samples.points.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(samples.points[i][0]-samples.points[j][0],samples.points[i][1]-samples.points[j][1])>=.35);
const relaxed=lloydRelaxation2D({sites:[[.2,.2],[1.8,1.8]],bounds:[0,0,2,2],iterations:1,strength:0,maxWork:1000});assert.deepEqual(relaxed.sites,[[.2,.2],[1.8,1.8]],"strength zero keeps coordinates after cell work");
const packed=skylinePack2D({width:4,height:3,rectangles:[{width:3,height:2},{width:1,height:3},{width:1,height:1}],maxWork:1000});for(const a of packed.placements){assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=4&&a.y+a.height<=3);for(const b of packed.placements)if(a.index<b.index)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
err(()=>costGridPaths2D({columns:2,rows:2,costs:[0,0,0,0],start:4,maxWork:0}),"INVALID_INPUT");
const route=costGridPaths2D({columns:3,rows:3,costs:[0,1,null,1,5,1,1,1,1],start:0,maxWork:126});for(let i=0;i<route.distances.length;i++)if(i!==0&&route.predecessors[i]!==null){const p=route.predecessors[i];almost(route.distances[i],route.distances[p]+routeCost(i));}function routeCost(i){return [0,1,null,1,5,1,1,1,1][i];}
console.log("p5 tenfold geometry review passed");
