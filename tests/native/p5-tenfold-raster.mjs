import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { floydSteinbergDither } from "../../packages/javascript/src/floyd-steinberg-dither.js";
import { bayerDither } from "../../packages/javascript/src/bayer-dither.js";
import { convolve2DSigned } from "../../packages/javascript/src/convolve-2d-signed.js";
import { binaryMorphology2D } from "../../packages/javascript/src/binary-morphology-2d.js";
import { euclideanDistanceTransform2D } from "../../packages/javascript/src/euclidean-distance-transform-2d.js";

const operations=[["floyd-steinberg-dither",floydSteinbergDither],["bayer-dither",bayerDither],["convolve-2d-signed",convolve2DSigned],["binary-morphology-2d",binaryMorphology2D],["euclidean-distance-transform-2d",euclideanDistanceTransform2D]];
for(const [name,operation] of operations){const fixture=JSON.parse(await readFile(new URL(`../../fixtures/operations/${name}.json`,import.meta.url)));for(const test of fixture.cases){if(test.error)assert.throws(()=>operation(test.input),e=>e.code===test.error,`${name}/${test.id}`);else assert.deepEqual(operation(test.input),test.output,`${name}/${test.id}`);}}
assert.deepEqual(convolve2DSigned({values:[1,2,3,4,5,6],columns:3,rows:2,kernel:[1,2,3,4,5,6,7,8,9],kernelColumns:3,kernelRows:3,boundary:"zero",maxWork:54}).values,[26,56,54,62,119,102],"asymmetric 2d convolution reverses both axes");
const dilated=binaryMorphology2D({mask:[false,false,false,false,true,false,false,false,false],columns:3,rows:3,element:[true,true,true,true,true,true,true,true,true],elementColumns:3,elementRows:3,mode:"dilate",boundary:"zero",maxWork:81});assert.ok(dilated.mask.every(Boolean),"dilation expands a center dot");
const eroded=binaryMorphology2D({mask:dilated.mask,columns:3,rows:3,element:[true,true,true,true,true,true,true,true,true],elementColumns:3,elementRows:3,mode:"erode",boundary:"one",maxWork:81});assert.ok(eroded.mask.every(Boolean),"one boundary preserves full mask under erosion");
function brute(mask,c,r){const d=[],n=[];for(let i=0;i<mask.length;i+=1){let best=null,bi=null;const x=i%c,y=Math.floor(i/c);for(let j=0;j<mask.length;j+=1)if(mask[j]){const dx=x-j%c,dy=y-Math.floor(j/c),v=dx*dx+dy*dy;if(best===null||v<best||v===best&&j<bi){best=v;bi=j;}}d.push(best===null?null:Math.sqrt(best));n.push(bi);}return {distances:d,nearestIndices:n};}
for(let bits=0;bits<512;bits+=1){const mask=Array.from({length:9},(_,i)=>Boolean(bits&(1<<i))),actual=euclideanDistanceTransform2D({mask,columns:3,rows:3,maxWork:54});assert.deepEqual(actual,brute(mask,3,3),`EDT brute ${bits}`);}
assert.deepEqual(euclideanDistanceTransform2D({mask:[true,false,true,false],columns:2,rows:2,maxWork:24}).nearestIndices,[0,0,2,2],"EDT ties select lowest row-major feature");
const getter={columns:1,rows:1,threshold:.5,maxWork:1};Object.defineProperty(getter,"values",{get(){throw new Error("getter read");},enumerable:true});assert.throws(()=>floydSteinbergDither(getter),e=>e.code==="INVALID_INPUT","required getter is rejected without invocation");
const source=[.5];const output=floydSteinbergDither({values:source,columns:1,rows:1,threshold:.5,maxWork:1});source[0]=0;output.bits[0]=0;assert.equal(floydSteinbergDither({values:[.5],columns:1,rows:1,threshold:.5,maxWork:1}).bits[0],1,"input and returned output are detached");
assert.throws(()=>convolve2DSigned({values:[1],columns:1,rows:1,kernel:[1],kernelColumns:1,kernelRows:1,boundary:"zero",maxWork:-1}),e=>e.code==="INVALID_INPUT","invalid fields precede work");
assert.throws(()=>euclideanDistanceTransform2D({mask:[true],columns:1,rows:1,maxWork:5}),e=>e.code==="WORK_LIMIT","EDT explicit budget");
const checksum=createHash("sha256").update(JSON.stringify(operations.map(([name,op])=>[name,typeof op]))).digest("hex").slice(0,16);
console.log(`p5 tenfold raster passed checksum=${checksum}`);
