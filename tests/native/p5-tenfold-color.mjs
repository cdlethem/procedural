import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { oklabRamp } from "../../packages/javascript/src/oklab-ramp.js";
import { medianCutQuantize } from "../../packages/javascript/src/median-cut-quantize.js";

const operations=[["oklab-ramp",oklabRamp],["median-cut-quantize",medianCutQuantize]];
for(const [name,operation] of operations){const fixture=JSON.parse(await readFile(new URL(`../../fixtures/operations/${name}.json`,import.meta.url)));for(const test of fixture.cases){if(test.error)assert.throws(()=>operation(test.input),e=>e.code===test.error,`${name}/${test.id}`);else assert.deepEqual(operation(test.input),test.output,`${name}/${test.id}`);}}

// Independent transcription of the published Oklab matrices, intentionally not imported
// from the implementation under test.
function oracleRedBlue(){const decode=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;const forward=rgb=>{const r=decode(rgb[0]),g=decode(rgb[1]),b=decode(rgb[2]),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return [.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s];};const a=forward([1,0,0]),b=forward([0,0,1]),L=a[0]+.5*(b[0]-a[0]),A=a[1]+.5*(b[1]-a[1]),B=a[2]+.5*(b[2]-a[2]),l=(L+.3963377774*A+.2158037573*B)**3,m=(L-.1055613458*A-.0638541728*B)**3,s=(L-.0894841775*A-1.2914855480*B)**3,linear=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s],encode=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;return linear.map(c=>encode(Math.max(0,Math.min(1,c))));}
const expected=oracleRedBlue(),actual=oklabRamp({stops:[[1,0,0],[0,0,1]],count:3,maxWork:5}).colors[1];for(let i=0;i<3;i+=1)assert.ok(Math.abs(actual[i]-expected[i])<=1e-9,`independent Oklab red-blue channel ${i}`);
const rgbw=medianCutQuantize({colors:[[1,0,0],[0,1,0],[0,0,1],[1,1,1]],count:3,maxWork:64});assert.deepEqual(rgbw.palette,[[0,0,1],[1,.5,.5],[0,1,0]],"RGBW replacement order is stable");
assert.deepEqual(medianCutQuantize({colors:[[.5,.5,.5],[.5,.5,.5]],count:2,maxWork:14}),{palette:[[.5,.5,.5]],indices:[0,0]},"unsplittable boxes stop");
const getter={count:2,maxWork:4};Object.defineProperty(getter,"stops",{enumerable:true,get(){throw new Error("read getter");}});assert.throws(()=>oklabRamp(getter),e=>e.code==="INVALID_INPUT","getter is rejected without invocation");
const input=[[0,0,0],[1,1,1]],out=oklabRamp({stops:input,count:2,maxWork:4});input[0][0]=1;out.colors[0][0]=1;assert.deepEqual(oklabRamp({stops:[[0,0,0],[1,1,1]],count:2,maxWork:4}).colors[0],[0,0,0],"ramp endpoints and output are detached");
assert.throws(()=>medianCutQuantize({colors:[[0,0,0]],count:1,maxWork:2}),e=>e.code==="WORK_LIMIT","median work formula is charged before allocation");
assert.throws(()=>oklabRamp({stops:[[0,0,0],[1,1,1]],count:2,maxWork:3}),e=>e.code==="WORK_LIMIT","ramp work formula is charged before allocation");
console.log("p5 tenfold color passed");
