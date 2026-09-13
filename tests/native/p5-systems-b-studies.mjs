import assert from "node:assert/strict";
import * as studies from "../../packages/javascript/examples/systems-b-studies.js";

const p={CENTER:"CENTER",CORNER:"CORNER",CLOSE:"CLOSE",noFill(){},noStroke(){},stroke(){},fill(){},strokeWeight(v){assert.ok(Number.isFinite(v));},beginShape(){},endShape(){},vertex(...v){v.forEach(x=>assert.ok(Number.isFinite(x)));},line(...v){v.forEach(x=>assert.ok(Number.isFinite(x)));},circle(...v){v.forEach(x=>assert.ok(Number.isFinite(x)));},rect(...v){v.forEach(x=>assert.ok(Number.isFinite(x)));},rectMode(){},push(){},pop(){},translate(...v){v.forEach(x=>assert.ok(Number.isFinite(x)));},rotate(v){assert.ok(Number.isFinite(v));}};
const draw={"ripple-interference":studies.drawRippleInterference,"pinned-waves":studies.drawPinnedWaves,"branching-sentences":studies.drawBranchingSentences,"woven-grammar":studies.drawWovenGrammar,"turtle-canopies":studies.drawTurtleCanopies,"recursive-tiles":studies.drawRecursiveTiles,"compatible-mosaics":studies.drawCompatibleMosaics,"tiled-circuits":studies.drawTiledCircuits,"maze-gardens":studies.drawMazeGardens,"branching-networks":studies.drawBranchingNetworks};
const ranges={"ripple-interference":[["passes",4,38],["scale",12,28],["weight",.5,4]],"pinned-waves":[["passes",4,38],["scale",10,25],["weight",.5,4]],"branching-sentences":[["iterations",1,5],["step",5,18],["angle",10,45]],"woven-grammar":[["iterations",1,6],["step",4,16],["angle",20,80]],"turtle-canopies":[["depth",1,6],["step",5,18],["angle",10,45]],"recursive-tiles":[["depth",1,5],["step",6,24],["angle",60,120]],"compatible-mosaics":[["columns",5,20],["rows",5,20],["size",20,55]],"tiled-circuits":[["columns",5,20],["rows",5,20],["size",18,48]],"maze-gardens":[["columns",6,26],["rows",6,26],["weight",.8,5]],"branching-networks":[["columns",6,24],["rows",6,24],["weight",.8,5]]};
for(const [slug,setting] of Object.entries(studies.systemsBSettings)){
  const layer=params=>({seed:42,palette:[0x111111,0x4477aa,0xdd9955],params});
  draw[slug](p,layer(setting.defaults));
  draw[slug](p,layer({...setting.defaults,...setting.structuralEdit}));
  for(const [name,min,max] of ranges[slug]) for(const value of [min,max]) draw[slug](p,layer({...setting.defaults,[name]:value}));
}
console.log("p5 systems B study smoke passed");
