import type { Layer } from "../studio-types";
import { choice, numeric, toggle, type StudioDefinition } from "./types";
import { drawWaveQuality, validateWaveQuality } from "./systems-b-wave-quality";
import { systemsBSettings, drawRippleInterference, drawPinnedWaves, drawBranchingSentences, drawWovenGrammar, drawTurtleCanopies, drawRecursiveTiles, drawCompatibleMosaics, drawTiledCircuits, drawMazeGardens, drawBranchingNetworks } from "@procedurals/javascript/examples/systems-b-studies.js";
const rows=[
["ripple-interference","Ripple interference","Damped wave contours.",["passes",4,38],["scale",12,28],["weight",.5,4]], ["pinned-waves","Pinned waves","Pinned-edge wave contours.",["passes",4,38],["scale",10,25],["weight",.5,4]],
["branching-sentences","Branching sentences","Rewritten tokens interpreted by a turtle.",["iterations",1,5],["step",5,18],["angle",10,45]], ["woven-grammar","Woven grammar","Square grammar turtle paths.",["iterations",1,6],["step",4,16],["angle",30,100]],
["turtle-canopies","Turtle canopies","Explicit recursive turtle branches.",["depth",1,6],["step",5,18],["angle",10,45]], ["recursive-tiles","Recursive tiles","Recursive right-angle turtle tiling.",["depth",1,5],["step",6,24],["angle",60,120]],
["compatible-mosaics","Compatible mosaics","Collapsed compatible tile fields.",["columns",5,20],["rows",5,20],["size",20,55]], ["tiled-circuits","Tiled circuits","Collapsed directional circuit tiles.",["columns",5,20],["rows",5,20],["size",18,48]],
["maze-gardens","Maze gardens","Seeded depth-first garden paths.",["columns",6,26],["rows",6,26],["weight",.8,5]], ["branching-networks","Branching networks","Seeded depth-first network paths.",["columns",6,24],["rows",6,24],["weight",.8,5]],
] as const;
const label=(key:string)=>key.replace(/^./,c=>c.toUpperCase());
const bounded=(key:string,title:string,description:string,sliderMin:number,sliderMax:number,hardMin:number,hardMax:number,step=1,integer=false)=>
  numeric(key,title,description,sliderMin,sliderMax,step,{hardMin,hardMax,integer});
const impulseControls=(site:number)=>[
  bounded(`impulseX${site}`,`Impulse ${site} X`,"Horizontal center in frame widths; values outside the frame can crop a pulse.",0,1,-1,2,.01),
  bounded(`impulseY${site}`,`Impulse ${site} Y`,"Vertical center in frame heights; values outside the frame can crop a pulse.",0,1,-1,2,.01),
  bounded(`impulseSpread${site}`,`Impulse ${site} spread`,"Gaussian radius in grid cells.",.5,8,.2,12,.1),
  bounded(`impulseAmplitude${site}`,`Impulse ${site} amplitude`,"Signed initial displacement; zero disables this site.",-1.5,1.5,-3,3,.05),
];
const waveParameters=[
  bounded("impulseCount","Impulses","Number of independently placed initial pulses.",1,3,1,3,1,true),
  ...impulseControls(1),...impulseControls(2),...impulseControls(3),
  choice("pinMode","Pin geometry","Cells that remain at zero displacement while the field evolves.",["none","perimeter","vertical","horizontal","disc"]),
  bounded("pinX","Pin X","Normalized horizontal center for a vertical or disc pin.",0,1,-1,2,.01),
  bounded("pinY","Pin Y","Normalized vertical center for a horizontal or disc pin.",0,1,-1,2,.01),
  bounded("pinRadius","Pin radius","Disc pin radius in grid cells.",.5,8,.2,12,.1),
  toggle("showPins","Show pins","Draw small marks at the pinned grid cells."),
  bounded("passes","Passes","Elapsed wave updates; zero shows the initial displacement.",0,38,0,80,1,true),
  bounded("scale","Cell spacing","Distance between grid samples on the canvas; large values may crop.",10,28,.1,100,.1),
  bounded("weight","Line weight","Thickness of the wave contours.",.5,4,.1,12,.1),
  { ...toggle("legacy","Earlier composition","Preserves the earlier saved wave layout."),hidden:true },
];
const waveDefaults={impulseCount:2,
  impulseX1:26*.32/25,impulseY1:26*.48/25,impulseSpread1:Math.sqrt(7/2),impulseAmplitude1:1,
  impulseX2:26*.69/25,impulseY2:26*.53/25,impulseSpread2:Math.sqrt(10/2),impulseAmplitude2:-1,
  impulseX3:.5,impulseY3:.5,impulseSpread3:2,impulseAmplitude3:0,
  pinMode:"none",pinX:.5,pinY:.5,pinRadius:4,showPins:false,legacy:false};
const waveDefinitions:Record<string,StudioDefinition>={
  "ripple-interference":{id:"ripple-interference",title:"Ripple interference",description:"Compose signed wave impulses and evolve their interference as drawn contours.",
    parameters:waveParameters,defaults:{...waveDefaults,...systemsBSettings["ripple-interference"].defaults},validate:validateWaveQuality},
  "pinned-waves":{id:"pinned-waves",title:"Pinned waves",description:"Compose wave impulses and pin chosen cells while the field evolves.",
    parameters:waveParameters,defaults:{...waveDefaults,...systemsBSettings["pinned-waves"].defaults,impulseCount:1,pinMode:"perimeter",showPins:true},validate:validateWaveQuality},
};
export const systemsBDefinitions:StudioDefinition[]=rows.map(([id,title,description,a,b,c])=>waveDefinitions[id]??({id,title,description,parameters:[numeric(a[0],label(a[0]),`Changes ${a[0]} in the supplied computation.`,a[1],a[2]),numeric(b[0],label(b[0]),`Changes ${b[0]} in the supplied computation.`,b[1],b[2]),numeric(c[0],label(c[0]),`Changes ${c[0]} in the supplied computation.`,c[1],c[2],c[0]==="weight"?.1:1)],defaults:systemsBSettings[id].defaults}));
const draws:Record<string,(p:any,l:Layer)=>void>={"ripple-interference":drawRippleInterference,"pinned-waves":drawPinnedWaves,"branching-sentences":drawBranchingSentences,"woven-grammar":drawWovenGrammar,"turtle-canopies":drawTurtleCanopies,"recursive-tiles":drawRecursiveTiles,"compatible-mosaics":drawCompatibleMosaics,"tiled-circuits":drawTiledCircuits,"maze-gardens":drawMazeGardens,"branching-networks":drawBranchingNetworks};
export function drawSystemsB(p:any,layer:Layer):void{const draw=draws[layer.technique];if(!draw)throw Error("Unknown systems B technique");if(waveDefinitions[layer.technique]&&layer.params.legacy!==true)drawWaveQuality(p,layer);else draw(p,layer);}
