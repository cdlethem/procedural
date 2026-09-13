import { rk4VectorGridTrace2D } from "../src/rk4-vector-grid-trace-2d.js";
import { grayScottStep2D } from "../src/gray-scott-step-2d.js";
import { lifeLikeStep2D } from "../src/life-like-step-2d.js";
import { elementaryCellularRows } from "../src/elementary-cellular-rows.js";
import { scalarGridCurl2D } from "../src/scalar-grid-curl-2d.js";
export const systemsASettings={
 "stream-ribbons":{defaults:{steps:42,lanes:18,weight:2},structuralEdit:{lanes:30}},"curved-trajectories":{defaults:{steps:58,paths:16,weight:1.5},structuralEdit:{steps:86}},
 "reaction-spots":{defaults:{passes:12,scale:18,weight:1},structuralEdit:{passes:22}},"reaction-stripes":{defaults:{passes:16,scale:13,weight:1},structuralEdit:{scale:9}},
 "organic-cells":{defaults:{passes:8,cellSize:18,weight:1},structuralEdit:{passes:14}},"geometric-generations":{defaults:{passes:6,cellSize:22,weight:1},structuralEdit:{cellSize:14}},
 "woven-rows":{defaults:{rule:90,rows:28,cellSize:12},structuralEdit:{rule:30}},"triangle-glyphs":{defaults:{rule:110,rows:25,cellSize:14},structuralEdit:{rows:38}},
 "swirling-particles":{defaults:{count:36,steps:34,weight:1},structuralEdit:{count:60}},"flow-needles":{defaults:{columns:20,scale:22,weight:1},structuralEdit:{columns:30}},
};
const n=(l,k)=>Number(l.params[k]), rgb=(p,l,i,a=255)=>{const c=l.palette[i%l.palette.length]>>>0;p.stroke((c>>>16)&255,(c>>>8)&255,c&255,a);}, fill=(p,l,i,a=255)=>{const c=l.palette[i%l.palette.length]>>>0;p.fill((c>>>16)&255,(c>>>8)&255,c&255,a);};
const path=(p,pts)=>{p.beginShape();for(const v of pts)p.vertex(v[0],v[1]);p.endShape();};
function vectorGrid(columns,rows){return Array.from({length:columns*rows},(_,i)=>{const x=i%columns/(columns-1)*2-1,y=Math.floor(i/columns)/(rows-1)*2-1;return [-y*18,x*18];});}
/** RK4 streamlines make soft parallel ribbons from a visible vector grid. */
export function drawStreamRibbons(p,l){const columns=12,rows=12,vectors=vectorGrid(columns,rows);p.noFill();p.strokeWeight(n(l,"weight"));for(let i=0;i<n(l,"lanes");i++){const out=rk4VectorGridTrace2D({vectors,columns,rows,origin:[80,80],spacing:[40,40],start:[100+i*410/Math.max(1,n(l,"lanes")-1),240+Math.sin(i)*90],dt:1,steps:n(l,"steps"),boundary:"STOP",maxWork:columns*rows+17*n(l,"steps")+1});rgb(p,l,i,170);path(p,out.points);}}
/** Curved trajectories fan through the same explicit rotating velocity samples. */
export function drawCurvedTrajectories(p,l){const columns=16,rows=16,vectors=vectorGrid(columns,rows);p.noFill();p.strokeWeight(n(l,"weight"));for(let i=0;i<n(l,"paths");i++){const out=rk4VectorGridTrace2D({vectors,columns,rows,origin:[20,20],spacing:[40,40],start:[70+i*500/Math.max(1,n(l,"paths")-1),120],dt:1,steps:n(l,"steps"),boundary:"STOP",maxWork:columns*rows+17*n(l,"steps")+1});rgb(p,l,i,190);path(p,out.points);}}
function chemical(l,passes,seed){let state={u:Array(24*24).fill(1),v:Array.from({length:576},(_,i)=>((i+seed*17)%73<9?.8:0))};for(let i=0;i<passes;i++)state=grayScottStep2D({state,columns:24,rows:24,spacing:[1,1],diffusionU:.16,diffusionV:.08,feed:.035,kill:.062,dt:1,boundary:"WRAP",maxWork:5184});return state;}
/** Gray-Scott spots are rendered from an explicit bounded replay of concentration state. */
export function drawReactionSpots(p,l){const s=chemical(l,n(l,"passes"),l.seed),z=n(l,"scale");rgb(p,l,0,120);p.strokeWeight(n(l,"weight"));for(let i=0;i<s.v.length;i++){if(s.v[i]<=.12)continue;fill(p,l,Math.floor(s.v[i]*8),180);p.circle(320-11.5*z+(i%24)*z,320-11.5*z+Math.floor(i/24)*z,z*Math.min(1,s.v[i]));}}
/** A different seeded Gray-Scott disturbance yields horizontal stripe-like masks. */
export function drawReactionStripes(p,l){const s=chemical(l,n(l,"passes"),l.seed+8),z=n(l,"scale");rgb(p,l,0,120);p.strokeWeight(n(l,"weight"));for(let i=0;i<s.v.length;i++){if(s.v[i]<=.08)continue;fill(p,l,Math.floor((i%24+s.v[i]*12)),160);p.rect(320-12*z+(i%24)*z,320-12*z+Math.floor(i/24)*z,z,z);}}
function life(passes,rule){let cells=Array.from({length:20*20},(_,i)=>((i*17+rule)%29<7?1:0));for(let i=0;i<passes;i++)cells=lifeLikeStep2D({cells,columns:20,rows:20,birth:[3],survival:[2,3],boundary:"WRAP",maxWork:3600}).cells;return cells;}
/** Organic life colonies use rounded cells after synchronous totalistic replays. */
export function drawOrganicCells(p,l){const cells=life(n(l,"passes"),l.seed),z=n(l,"cellSize");rgb(p,l,0,120);p.strokeWeight(n(l,"weight"));for(let i=0;i<cells.length;i++)if(cells[i]){fill(p,l,i,200);p.circle(320-9.5*z+(i%20)*z,320-9.5*z+Math.floor(i/20)*z,z*.9);}}
/** The same rule state becomes a crisp square-grid geometric generation. */
export function drawGeometricGenerations(p,l){const cells=life(n(l,"passes"),l.seed+5),z=n(l,"cellSize");rgb(p,l,0,120);p.strokeWeight(n(l,"weight"));for(let i=0;i<cells.length;i++)if(cells[i]){fill(p,l,i,190);p.rect(320-10*z+(i%20)*z,320-10*z+Math.floor(i/20)*z,z-1,z-1);}}
function elementary(rule,rows){return elementaryCellularRows({initial:Array.from({length:40},(_,i)=>i===20?1:0),rule,rows,boundary:"WRAP",maxWork:40+4*40*(rows-1)});}
/** Elementary rows become alternating woven bands of colored cells. */
export function drawWovenRows(p,l){const out=elementary(n(l,"rule"),n(l,"rows")),z=Math.min(n(l,"cellSize"),560/Math.max(40,n(l,"rows")));p.noStroke();for(let i=0;i<out.cells.length;i++)if(out.cells[i]){fill(p,l,i+Math.floor(i/out.columns),190);p.rect(320-20*z+(i%40)*z,320-out.rows*z/2+Math.floor(i/40)*z,z,z*.55);}}
/** Elementary rows use triangle glyphs to emphasize ordered left/center/right rules. */
export function drawTriangleGlyphs(p,l){const out=elementary(n(l,"rule"),n(l,"rows")),z=Math.min(n(l,"cellSize"),560/Math.max(40,n(l,"rows")));p.noStroke();for(let i=0;i<out.cells.length;i++)if(out.cells[i]){const x=320-20*z+(i%40)*z,y=320-out.rows*z/2+Math.floor(i/40)*z;fill(p,l,i,200);p.triangle(x,y+z,x+z,y+z,x+z/2,y);}}
function curl(columns){const values=Array.from({length:columns*columns},(_,i)=>{const x=i%columns/(columns-1)*6,y=Math.floor(i/columns)/(columns-1)*6;return Math.sin(x)*Math.cos(y);});return scalarGridCurl2D({values,columns,rows:columns,spacing:[1,1],boundary:"WRAP",maxWork:5*columns*columns});}
/** Curl vectors feed the named RK4 tracer to make circular particle streams. */
export function drawSwirlingParticles(p,l){const columns=16,field=curl(columns).vectors,palette=field; p.noFill();p.strokeWeight(n(l,"weight"));for(let i=0;i<n(l,"count");i++){const out=rk4VectorGridTrace2D({vectors:palette,columns,rows:columns,origin:[80,80],spacing:[32,32],start:[100+(i%9)*48,110+Math.floor(i/9)*58],dt:8,steps:n(l,"steps"),boundary:"STOP",maxWork:columns*columns+17*n(l,"steps")+1});rgb(p,l,i,160);path(p,out.points);}}
/** Curl samples render directly as short flow needles, without normalization. */
export function drawFlowNeedles(p,l){const c=n(l,"columns"),vectors=curl(c).vectors,z=Math.min(n(l,"scale"),500/(c-1));p.noFill();p.strokeWeight(n(l,"weight"));for(let i=0;i<vectors.length;i++){const x=70+(i%c)*z,y=70+Math.floor(i/c)*z,v=vectors[i];rgb(p,l,i,190);p.line(x,y,x+v[0]*z*.8,y+v[1]*z*.8);}}
