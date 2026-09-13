import { dampedWaveStep2D } from "../src/damped-wave-step-2d.js";
import { parallelTokenRewrite } from "../src/parallel-token-rewrite.js";
import { tokenTurtle2D } from "../src/token-turtle-2d.js";
import { adjacencyTileCollapse2D } from "../src/adjacency-tile-collapse-2d.js";
import { seededDepthFirstSpanningTree } from "../src/seeded-depth-first-spanning-tree.js";

export const systemsBSettings={
 "ripple-interference":{defaults:{passes:18,scale:22,weight:1.2},structuralEdit:{passes:34}},"pinned-waves":{defaults:{passes:22,scale:20,weight:1.5},structuralEdit:{scale:13}},
 "branching-sentences":{defaults:{iterations:4,step:11,angle:25},structuralEdit:{iterations:5}},"woven-grammar":{defaults:{iterations:5,step:9,angle:90},structuralEdit:{angle:38}},
 "turtle-canopies":{defaults:{depth:5,step:13,angle:25},structuralEdit:{depth:6}},"recursive-tiles":{defaults:{depth:4,step:16,angle:90},structuralEdit:{depth:5}},
 "compatible-mosaics":{defaults:{columns:12,rows:12,size:42},structuralEdit:{columns:18}},"tiled-circuits":{defaults:{columns:13,rows:13,size:38},structuralEdit:{rows:18}},
 "maze-gardens":{defaults:{columns:16,rows:16,weight:3},structuralEdit:{columns:25}},"branching-networks":{defaults:{columns:13,rows:13,weight:2},structuralEdit:{rows:20}},
};
const q=l=>l.params, colors=l=>l.packedRGBpalette||l.palette||[0x222222], stroke=(p,l,i,a=255)=>{const c=colors(l)[i%colors(l).length]>>>0;p.stroke(c>>>16,(c>>>8)&255,c&255,a)}, fill=(p,l,i,a=255)=>{const c=colors(l)[i%colors(l).length]>>>0;p.fill(c>>>16,(c>>>8)&255,c&255,a)};
function waves(l,pinned=false){const z=q(l),c=26,r=26,n=c*r;let d=Array.from({length:n},(_,i)=>{const x=i%c,y=Math.floor(i/c),a=Math.hypot(x-c*.32,y-r*.48),b=Math.hypot(x-c*.69,y-r*.53);return Math.exp(-a*a/7)-(pinned?0:Math.exp(-b*b/10));}),v=Array(n).fill(0),pins=Array.from({length:n},(_,i)=>pinned&&((i%c===0)||(i%c===c-1)||(Math.floor(i/c)===0)||(Math.floor(i/c)===r-1))?1:0);for(let i=0;i<n;i++)if(pins[i])d[i]=0;for(let k=0;k<z.passes;k++){({displacement:d,velocity:v}=dampedWaveStep2D({state:{displacement:d,velocity:v},columns:c,rows:r,spacing:[1,1],speed:.34,damping:.055,dt:1,pinned:pins,boundary:"CLAMP",maxWork:7*n}));}return {d,c,r};}
function paintWave(p,l,pinned){const z=q(l),s=waves(l,pinned),cell=Math.min(z.scale,560/(s.c-1));p.noFill();p.strokeWeight(z.weight);for(let y=1;y<s.r-1;y++){p.beginShape();for(let x=1;x<s.c-1;x++){const i=y*s.c+x;stroke(p,l,y,190);p.vertex(320+(x-s.c/2)*cell,320+(y-s.r/2)*cell+s.d[i]*cell*3);}p.endShape();}if(pinned){p.noStroke();for(let i=0;i<s.d.length;i++)if((i%s.c===0)||(i%s.c===s.c-1)||Math.floor(i/s.c)===0||Math.floor(i/s.c)===s.r-1){fill(p,l,i,150);p.circle(320+(i%s.c-s.c/2)*cell,320+(Math.floor(i/s.c)-s.r/2)*cell,4);}}}
export function drawRippleInterference(p,l){paintWave(p,l,false)} export function drawPinnedWaves(p,l){paintWave(p,l,true)}
function grammar(iter,kind){return parallelTokenRewrite({axiom:["F"],rules:kind? [{symbol:"F",replacement:["F","+","F","-","F","-","F","+","F"]}]:[{symbol:"F",replacement:["F","[","+","F","]","F","[","-","F","]","F"]}],iterations:iter,maxTokens:1000000,maxWork:5000000}).tokens;}
function turtle(tokens,z,start=[320,560],angle=-Math.PI/2){return tokenTurtle2D({tokens,commands:[{token:"F",kind:"DRAW",distance:z.step},{token:"+",kind:"TURN",angle:z.angle*Math.PI/180},{token:"-",kind:"TURN",angle:-z.angle*Math.PI/180},{token:"[",kind:"PUSH"},{token:"]",kind:"POP"}],start:{position:start,heading:angle},unknown:"IGNORE",maxSegments:1000000,maxStackDepth:100,maxWork:3000000});}
function paintTurtle(p,l,tokens,tiled=false) {
  const z=q(l),out=turtle(tokens,z),xs=out.segments.flatMap(s=>[s[0],s[2]]),ys=out.segments.flatMap(s=>[s[1],s[3]]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const extent=300+z.step*10,scale=extent/Math.max(1,xmax-xmin,ymax-ymin);
  const project=(x,y)=>[320+(x-(xmin+xmax)/2)*scale,320+(y-(ymin+ymax)/2)*scale];
  p.noFill();p.strokeWeight(tiled?1.2:1.6);
  out.segments.forEach((s,i)=>{stroke(p,l,tiled?Math.floor(i/13):out.depths[i],200);p.line(...project(s[0],s[1]),...project(s[2],s[3]));});
}
export function drawBranchingSentences(p,l){paintTurtle(p,l,grammar(q(l).iterations,false))}
export function drawWovenGrammar(p,l){
 const tokens=parallelTokenRewrite({axiom:["A"],rules:[
  {symbol:"A",replacement:["+","B","F","-","A","F","A","-","F","B","+"]},
  {symbol:"B",replacement:["-","A","F","+","B","F","B","+","F","A","-"]}
 ],iterations:q(l).iterations,maxTokens:1000000,maxWork:5000000}).tokens;
 paintTurtle(p,l,tokens,true);
}
function recursiveTokens(depth,tiles){
  return parallelTokenRewrite({axiom:["F"],rules:[{symbol:"F",replacement:tiles?["F","+","F","-","F","-","F","+","F"]:["F","[","+","F","]","[","-","F","]","F"]}],iterations:depth,maxTokens:1000000,maxWork:5000000}).tokens;
}
export function drawTurtleCanopies(p,l){paintTurtle(p,l,recursiveTokens(q(l).depth,false))}
export function drawRecursiveTiles(p,l){paintTurtle(p,l,recursiveTokens(q(l).depth,true),true)}
function tiles(l,circuit){
 const z=q(l),all=Array.from({length:circuit?16:4},(_,i)=>i);
 const right=circuit?all.map(a=>all.filter(b=>Boolean(a&2)===Boolean(b&8))):[[1,3],[0,2],[1,3],[0,2]];
 const down=circuit?all.map(a=>all.filter(b=>Boolean(a&4)===Boolean(b&1))):[[1,3],[0,2],[1,3],[0,2]];
 const weights=all.map(t=>circuit&&[1,2,4,8].filter(bit=>t&bit).length===2?4:1);
 return adjacencyTileCollapse2D({columns:z.columns,rows:z.rows,right,down,weights,domains:Array.from({length:z.columns*z.rows},()=>all),rngState:l.seed>>>0,maxWork:3000000});
}
function paintTiles(p,l,circuit){const z=q(l),out=tiles(l,circuit),w=Math.min(z.size,560/z.columns),h=Math.min(z.size,560/z.rows);p.rectMode(p.CORNER);out.tiles.forEach((t,i)=>{const x=40+(i%z.columns)*w,y=40+Math.floor(i/z.columns)*h;fill(p,l,t,205);p.noStroke();p.rect(x,y,w-1,h-1);p.noFill();stroke(p,l,(t+1)%4,220);p.strokeWeight(2);if(circuit){const cx=x+w/2,cy=y+h/2;if(t&1)p.line(cx,cy,cx,y);if(t&2)p.line(cx,cy,x+w,cy);if(t&4)p.line(cx,cy,cx,y+h);if(t&8)p.line(cx,cy,x,cy);p.circle(cx,cy,3);}else p.circle(x+w/2,y+h/2,Math.min(w,h)*(.25+t*.12));});}
export function drawCompatibleMosaics(p,l){paintTiles(p,l,false)} export function drawTiledCircuits(p,l){paintTiles(p,l,true)}
function tree(l){const z=q(l),n=z.columns*z.rows,edges=[];for(let y=0;y<z.rows;y++)for(let x=0;x<z.columns;x++){const a=y*z.columns+x;if(x+1<z.columns)edges.push([a,a+1]);if(y+1<z.rows)edges.push([a,a+z.columns]);}return seededDepthFirstSpanningTree({vertexCount:n,edges,root:Math.floor(n/2),rngState:l.seed>>>0,maxWork:3000000});}
function paintTree(p,l,network){const z=q(l),out=tree(l),sx=560/Math.max(1,z.columns-1),sy=560/Math.max(1,z.rows-1),pt=i=>[40+(i%z.columns)*sx,40+Math.floor(i/z.columns)*sy];p.noFill();p.strokeWeight(z.weight);out.edges.forEach(([a,b],i)=>{stroke(p,l,network?out.depths[b]:i,210);p.line(...pt(a),...pt(b));});if(!network){p.noStroke();out.edges.forEach(([,b],i)=>{fill(p,l,i,200);p.circle(...pt(b),Math.max(2,z.weight*1.6));});}}
export function drawMazeGardens(p,l){paintTree(p,l,false)} export function drawBranchingNetworks(p,l){paintTree(p,l,true)}
