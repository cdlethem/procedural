import type { Layer } from "../studio-types";
import { numeric, type StudioDefinition } from "./types";
import { systemsBSettings, drawRippleInterference, drawPinnedWaves, drawBranchingSentences, drawWovenGrammar, drawTurtleCanopies, drawRecursiveTiles, drawCompatibleMosaics, drawTiledCircuits, drawMazeGardens, drawBranchingNetworks } from "../../../../packages/javascript/examples/systems-b-studies.js";
const rows=[
["ripple-interference","Ripple interference","Damped wave contours.",["passes",4,38],["scale",12,28],["weight",.5,4]], ["pinned-waves","Pinned waves","Pinned-edge wave contours.",["passes",4,38],["scale",10,25],["weight",.5,4]],
["branching-sentences","Branching sentences","Rewritten tokens interpreted by a turtle.",["iterations",1,5],["step",5,18],["angle",10,45]], ["woven-grammar","Woven grammar","Square grammar turtle paths.",["iterations",1,6],["step",4,16],["angle",30,100]],
["turtle-canopies","Turtle canopies","Explicit recursive turtle branches.",["depth",1,6],["step",5,18],["angle",10,45]], ["recursive-tiles","Recursive tiles","Recursive right-angle turtle tiling.",["depth",1,5],["step",6,24],["angle",60,120]],
["compatible-mosaics","Compatible mosaics","Collapsed compatible tile fields.",["columns",5,20],["rows",5,20],["size",20,55]], ["tiled-circuits","Tiled circuits","Collapsed directional circuit tiles.",["columns",5,20],["rows",5,20],["size",18,48]],
["maze-gardens","Maze gardens","Seeded depth-first garden paths.",["columns",6,26],["rows",6,26],["weight",.8,5]], ["branching-networks","Branching networks","Seeded depth-first network paths.",["columns",6,24],["rows",6,24],["weight",.8,5]],
] as const;
const label=(key:string)=>key.replace(/^./,c=>c.toUpperCase());
export const systemsBDefinitions:StudioDefinition[]=rows.map(([id,title,description,a,b,c])=>({id,title,description,parameters:[numeric(a[0],label(a[0]),`Changes ${a[0]} in the supplied computation.`,a[1],a[2]),numeric(b[0],label(b[0]),`Changes ${b[0]} in the supplied computation.`,b[1],b[2]),numeric(c[0],label(c[0]),`Changes ${c[0]} in the supplied computation.`,c[1],c[2],c[0]==="weight"?.1:1)],defaults:systemsBSettings[id].defaults}));
const draws:Record<string,(p:any,l:Layer)=>void>={"ripple-interference":drawRippleInterference,"pinned-waves":drawPinnedWaves,"branching-sentences":drawBranchingSentences,"woven-grammar":drawWovenGrammar,"turtle-canopies":drawTurtleCanopies,"recursive-tiles":drawRecursiveTiles,"compatible-mosaics":drawCompatibleMosaics,"tiled-circuits":drawTiledCircuits,"maze-gardens":drawMazeGardens,"branching-networks":drawBranchingNetworks};
export function drawSystemsB(p:any,layer:Layer):void{const draw=draws[layer.technique];if(!draw)throw Error("Unknown systems B technique");draw(p,layer);}
