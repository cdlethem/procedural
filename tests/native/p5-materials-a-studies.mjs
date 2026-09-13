import assert from "node:assert/strict";
import * as studies from "../../packages/javascript/examples/materials-a-studies.js";
const draws=Object.entries(studies).filter(([name,value])=>name.startsWith("draw")&&typeof value==="function");
const commands=[];const p=new Proxy({CLOSE:"close"},{get(target,key){if(key in target)return target[key];return (...args)=>{commands.push([key,args]);};}});
const palette=[0x173f5f,0x20639b,0x3caea3,0xf6d55c,0xed553b];
const minima={scale:5,threshold:.2,order:1,gain:.4,radius:2,features:4,passes:1,bands:6,orbits:6,count:2,stripes:8,phase:0,weight:.5};
for(const [name,draw] of draws){const id=name.replace(/^draw/,"").replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`).slice(1),setting=studies.materialsASettings[id];assert.ok(setting,`${id} setting`);for(const params of [setting.defaults,{...setting.defaults,...setting.structuralEdit},{...setting.defaults,...Object.fromEntries(Object.keys(setting.defaults).map(key=>[key,minima[key]]))}]){commands.length=0;const layer={params:{...params},palette:[...palette],seed:42};draw(p,layer);assert.ok(commands.length>0,`${id} emits commands`);assert.deepEqual(layer.palette,palette,`${id} does not retain or mutate palette`);}}
console.log(`p5 materials A studies passed ${draws.length} draws`);
