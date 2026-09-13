import { assembleSegmentChains2D } from "../src/assemble-segment-chains-2d.js";
import { poissonDisc2D } from "../src/poisson-disc-2d.js";
import { lloydRelaxation2D } from "../src/lloyd-relaxation-2d.js";
import { skylinePack2D } from "../src/skyline-pack-2d.js";
import { costGridPaths2D } from "../src/cost-grid-paths-2d.js";
import { marchingSquares2D } from "../src/marching-squares-2d.js";
import { voronoiCells2D } from "../src/voronoi-cells-2d.js";

export const pathsBSettings = {
  "stitched-contours": { defaults:{lines:9,weight:1.2,waves:3}, structuralEdit:{waves:6} },
  "fragmented-lines": { defaults:{lines:18,weight:2,gaps:4}, structuralEdit:{gaps:9} },
  "blue-noise-stipple": { defaults:{radius:18,size:4,attempts:8}, structuralEdit:{radius:11} },
  "spaced-symbols": { defaults:{radius:26,size:10,attempts:7}, structuralEdit:{size:17} },
  "relaxed-stones": { defaults:{sites:24,iterations:2,inset:4}, structuralEdit:{iterations:4} },
  "centroid-trails": { defaults:{sites:18,iterations:3,weight:1}, structuralEdit:{iterations:6} },
  "packed-posters": { defaults:{count:22,scale:1,outline:2}, structuralEdit:{count:38} },
  "aspect-tiles": { defaults:{count:25,scale:1,outline:1}, structuralEdit:{scale:.65} },
  "obstacle-roads": { defaults:{columns:24,rows:24,weight:2}, structuralEdit:{columns:34} },
  "arrival-contours": { defaults:{columns:28,rows:28,weight:1.2}, structuralEdit:{rows:40} },
};
const q=(l)=>l.params, colors=(l)=>l.packedRGBpalette||l.palette||[0x222222], c=(p,v,a=255)=>p.stroke((v>>>16)&255,(v>>>8)&255,v&255,a), f=(p,v,a=255)=>p.fill((v>>>16)&255,(v>>>8)&255,v&255,a);
const rng=(seed)=>{let s=seed>>>0;return()=>((s=Math.imul(1664525,s)+1013904223>>>0)/4294967296)};
const bounds=[32,32,608,608];
function chains(p,l,fragment) {
  const z=q(l), segments=[], waves=z.waves||3;
  for(let r=0;r<z.lines;r++) {
    const vertices=Array.from({length:25},(_,x)=>[32+x*24,70+r*500/Math.max(1,z.lines-1)+Math.sin((x+r)*waves*.45)*20]);
    for(let x=0;x<24;x++) if(!fragment||x%z.gaps) {
      const edge=[vertices[x],vertices[x+1]];
      segments.push(x%2?edge.reverse():edge);
    }
  }
  segments.reverse();
  const out=assembleSegmentChains2D({segments,maxWork:8*segments.length**2+4*segments.length});
  p.noFill(); p.strokeWeight(z.weight);
  out.chains.forEach((chain,i)=>{c(p,colors(l)[i%colors(l).length]);p.beginShape();chain.points.forEach(v=>p.vertex(...v));p.endShape();});
}
export function drawStitchedContours(p,l){chains(p,l,false)} export function drawFragmentedLines(p,l){chains(p,l,true)}
function poisson(p,l,symbol){const z=q(l),out=poissonDisc2D({bounds,radius:z.radius,attemptsPerActive:z.attempts,maxPoints:500,rngState:l.seed>>>0,maxWork:200000});p.noStroke();out.points.forEach((v,i)=>{f(p,colors(l)[i%colors(l).length]);if(symbol){p.push();p.translate(...v);p.rotate(i*.6);p.rectMode(p.CENTER);p.square(0,0,z.size);p.pop();}else p.circle(...v,z.size);});}
export function drawBlueNoiseStipple(p,l){poisson(p,l,false)} export function drawSpacedSymbols(p,l){poisson(p,l,true)}
function relaxed(p,l,trails) {
  const z=q(l),r=rng(l.seed); let sites=Array.from({length:z.sites},()=>[60+r()*520,60+r()*520]);
  const history=[sites];
  for(let i=0;i<z.iterations;i++){sites=lloydRelaxation2D({sites,bounds,iterations:1,strength:1,maxWork:1000000}).sites;history.push(sites);}
  if(trails) {
    p.noFill();p.strokeWeight(z.weight);
    for(let i=0;i<z.sites;i++) {
      const color=colors(l)[i%colors(l).length];c(p,color);p.beginShape();history.forEach(s=>p.vertex(...s[i]));p.endShape();
      p.circle(...history[0][i],10);f(p,color);p.circle(...sites[i],5);p.noFill();
    }
  } else {
    const cells=voronoiCells2D({sites,bounds,maxWork:1000000}).cells;
    p.noStroke();cells.forEach((cell,i)=>{f(p,colors(l)[i%colors(l).length],210);p.beginShape();
      cell.forEach(v=>{const dx=v[0]-sites[i][0],dy=v[1]-sites[i][1],scale=Math.max(0,1-z.inset/Math.hypot(dx,dy));p.vertex(sites[i][0]+dx*scale,sites[i][1]+dy*scale);});p.endShape(p.CLOSE);});
  }
}
export function drawRelaxedStones(p,l){relaxed(p,l,false)} export function drawCentroidTrails(p,l){relaxed(p,l,true)}
function packed(p,l,tiles) {
  const z=q(l),r=rng(l.seed),rectangles=Array.from({length:z.count},()=>({width:(tiles?20+r()*75:45+r()*80)*z.scale,height:(tiles?20+r()*75:40+r()*55)*z.scale}));
  const out=skylinePack2D({width:560,height:560,rectangles,maxWork:8*z.count**3+z.count});p.rectMode(p.CORNER);
  out.placements.forEach((a,i)=>{
    const x=40+a.x,y=40+a.y;f(p,colors(l)[i%colors(l).length],210);c(p,colors(l)[(i+1)%colors(l).length]);p.strokeWeight(z.outline);p.rect(x,y,a.width,a.height);
    if(!tiles){p.noStroke();f(p,colors(l)[(i+2)%colors(l).length]);p.rect(x+a.width*.12,y+a.height*.14,a.width*.6,a.height*.4);for(let j=0;j<3;j++)p.rect(x+a.width*.12,y+a.height*(.65+j*.09),a.width*(.72-j*.12),a.height*.025);}
    else {c(p,colors(l)[(i+2)%colors(l).length],130);p.strokeWeight(.7);for(let t=.15;t<1;t+=.15)p.line(x+a.width*t,y,x,y+a.height*t);}
  });
}
export function drawPackedPosters(p,l){packed(p,l,false)} export function drawAspectTiles(p,l){packed(p,l,true)}
function grid(p,l,contours) {
  const z=q(l),n=z.columns*z.rows,cx=560/z.columns,cy=560/z.rows;
  const costs=Array.from({length:n},(_,i)=>{
    const x=i%z.columns,y=Math.floor(i/z.columns);
    if(contours)return 1+2*(1+Math.sin(x*.3+l.seed*.01)*Math.cos(y*.24));
    return x>0&&y>0&&(i*17+l.seed)%13===0?null:1;
  });
  const start=contours?Math.floor(z.rows/2)*z.columns+Math.floor(z.columns/2):0;
  const out=costGridPaths2D({columns:z.columns,rows:z.rows,costs,start,maxWork:n*n+5*n});
  if(contours){
    const maximum=Math.max(...out.distances);p.strokeWeight(z.weight);
    for(let k=1;k<=16;k++){
      const ms=marchingSquares2D({values:out.distances,columns:z.columns,rows:z.rows,origin:[40+cx/2,40+cy/2],spacing:[cx,cy],threshold:maximum*k/17,maxWork:n+(z.columns-1)*(z.rows-1)});
      c(p,colors(l)[k%colors(l).length]);ms.segments.forEach(s=>p.line(...s));
    }
  }else{
    p.rectMode(p.CORNER);p.noStroke();f(p,colors(l)[1],90);
    costs.forEach((v,i)=>{if(v===null)p.rect(40+(i%z.columns)*cx,40+Math.floor(i/z.columns)*cy,cx,cy);});
    p.strokeWeight(z.weight);
    for(let goal=z.columns-1;goal<n;goal+=Math.max(1,Math.floor(n/28))){
      c(p,colors(l)[goal%colors(l).length],190);let i=goal;
      while(out.predecessors[i]!==null){const a=out.predecessors[i];p.line(40+(i%z.columns+.5)*cx,40+(Math.floor(i/z.columns)+.5)*cy,40+(a%z.columns+.5)*cx,40+(Math.floor(a/z.columns)+.5)*cy);i=a;}
    }
  }
}
export function drawObstacleRoads(p,l){grid(p,l,false)} export function drawArrivalContours(p,l){grid(p,l,true)}
