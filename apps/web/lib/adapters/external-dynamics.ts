import type {Layer} from '../studio-types';
import {defaultPalettes} from '../default-palettes';
import {choice,numeric,toggle,channels,type StudioDefinition} from './types';
import {contactHistory2D} from '../../../../packages/javascript/src/contact-history-2d.js';
import {radiusPairs2D} from '../../../../packages/javascript/src/radius-pairs-2d.js';
import {sensorMotorStep2D} from '../../../../packages/javascript/src/sensor-motor-step-2d.js';
import {flockSteer2D} from '../../../../packages/javascript/src/flock-steer-2d.js';
import {selectTaperedStrokeStrips2D} from '../../../../packages/javascript/src/select-tapered-stroke-strips-2d.js';
import {hatchRegionLines2D} from '../../../../packages/javascript/src/hatch-region-lines-2d.js';
import {insertSegmentBridge2D} from '../../../../packages/javascript/src/insert-segment-bridge-2d.js';
import {relativeNeighborhoodPairs2D} from '../../../../packages/javascript/src/relative-neighborhood-pairs-2d.js';
import {thresholdEdgeRelaxation2D} from '../../../../packages/javascript/src/threshold-edge-relaxation-2d.js';
import {elasticCurveGrowStep2D} from '../../../../packages/javascript/src/elastic-curve-grow-step-2d.js';
import {marchingSquares2D} from '../../../../packages/javascript/src/marching-squares-2d.js';
import {SIZE as FLUID_SIZE,CELLS,initialFluid,stepFluid} from '../../../../packages/javascript/examples/dye-currents/study.js';

/** App-only controls; the operation contracts retain their own required inputs. */
export const externalDynamicsDefinitions:StudioDefinition[]=[
  {id:'lingering-links',title:'Lingering links',description:'A moving constellation keeps contacts after nearby points separate.',parameters:[numeric('ticks','Ticks','Replay explicit contact and movement steps.',0,60,1),numeric('radius','Radius','Changes the supplied proximity graph.',60,130,1),numeric('linger','Linger','Absent steps retained for a contact.',0,24,1),toggle('dotMarks','Dot marks','Replace retained link strokes with midpoint marks.')],defaults:{ticks:24,radius:82,linger:12,dotMarks:false}},
  {id:'sensing-trails',title:'Sensing trails',description:'Paired probes turn agents through a replaceable scalar field.',parameters:[numeric('ticks','Ticks','Replay paired sensing and motion.',0,80,1),choice('field','Field source','Replay the agents through a different scalar field.',['upper-right','lower-left']),numeric('gain','Turn gain','Signed response to right-minus-left field samples.',-.1,.1,.01),toggle('dotMarks','Dot marks','Stamp sampled trail points instead of joining them.')],defaults:{ticks:40,field:'upper-right',gain:.05,dotMarks:false}},
  {id:'flocking-marks',title:'Flocking marks',description:'Supplied graph steering grows a field of connected moving marks.',parameters:[numeric('ticks','Ticks','Replay synchronous graph steering.',0,80,1),toggle('chain','Open chain','Substitute a fixed chain for ring-and-chord neighbors.'),numeric('separation','Separation','Weight of noncoincident outward neighbor vectors.',0,.8,.02),toggle('dotMarks','Dot marks','Draw trail samples as dots rather than paths.')],defaults:{ticks:40,chain:false,separation:.42,dotMarks:false}},
  {id:'guarded-bands',title:'Guarded bands',description:'Select shaped tidal ribbons by actual filled-region clearance.',parameters:[toggle('wide','Wide ribbons','Expand the candidate width profile.'),numeric('clearance','Clearance','Required separation between retained ribbons.',0,40,1),toggle('transfer','Crossing path','Substitute the sloped candidate family.'),toggle('showRejected','Rejected paths','Show rejected centerlines as dashed paths.')],defaults:{wide:false,clearance:10,transfer:false,showRejected:true}},
  {id:'hatched-islands',title:'Hatched islands',description:'Two clipped hatch fields trace a region and its holes.',parameters:[toggle('angle','Rotate hatches','Change both hatch directions.'),toggle('dense','Dense hatches','Reduce both line spacings.'),toggle('transfer','Other island','Replace the filled region and its holes.'),toggle('outline','Outline','Draw the region and hole boundaries over hatching.')],defaults:{angle:false,dense:false,transfer:false,outline:true}},
  {id:'bridge-web',title:'Bridge web',description:'Selected candidate gaps accumulate as stable graph bridges.',parameters:[numeric('ticks','Bridges','Replay selected graph insertions from the authored strands.',0,42,1),toggle('weave','Cross route','Change candidate slant and selected gap order.'),toggle('candidate','Candidate guide','Show the next potential cross-strand segment.')],defaults:{ticks:42,weave:false,candidate:true}},
  {id:'neighborhood-growth',title:'Neighborhood growth',description:'An exact local graph guides synchronous point relaxation.',parameters:[numeric('ticks','Ticks','Replay point relaxation and graph queries.',0,24,1),toggle('chain','Open chain','Substitute a supplied chain for the exact neighborhood graph.'),numeric('minLength','Length threshold','Edges at or below this length do not move points.',0,100,1),toggle('largeMarks','Large marks','Change point size without changing the graph.')],defaults:{ticks:8,chain:false,minLength:38,largeMarks:false}},
  {id:'elastic-loops',title:'Elastic loops',description:'Growing elastic strands refine while preserving a noncrossing embedding.',parameters:[numeric('ticks','Ticks','Replay bounded elastic growth and refinement.',0,36,1),toggle('reverseCurl','Reverse curl','Reverse the authored bend-target changes.'),numeric('windX','Wind','Apply horizontal external acceleration.',-2,2,.25),toggle('structure','Structure','Reveal retained nodes over the same curve state.')],defaults:{ticks:36,reverseCurl:false,windX:0,structure:false}},
  {id:'dye-currents',title:'Dye currents',description:'Dye and texture travel through a periodic projected velocity field.',parameters:[numeric('ticks','Frames','Replay the explicit transport/projection system.',0,120,10),numeric('injection','Injection','Change the externally supplied vortex force.',0,.3,.01),numeric('viscosity','Viscosity','Change explicit velocity diffusion.',0,.24,.01),toggle('projection','Projection','Apply bounded pressure projection.'),toggle('texture','Stripe source','Replace the initial soft dye disks with striped disks.'),toggle('contours','Contours','Draw measured dye isolines over the same flow state.')],defaults:{ticks:30,injection:.1,viscosity:.01,projection:true,texture:false,contours:true}},
];

const paletteIds:Record<string,string>={
  'lingering-links':'sage-linen','sensing-trails':'cobalt-night','flocking-marks':'coral-slate',
  'guarded-bands':'ochre-plum','hatched-islands':'honey-cream','bridge-web':'copper-patina',
  'neighborhood-growth':'deep-teal','elastic-loops':'cobalt-night','dye-currents':'ochre-plum',
};
export function externalDynamicsPalette(id:string):number[]|null{
  const palette=defaultPalettes.find(item=>item.id===paletteIds[id]);
  return palette?palette.colors.map(hex=>Number.parseInt(hex.slice(1),16)):null;
}
const cache=new Map<string,any>();
function retained<T>(key:string,make:()=>T):T{
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const value=make();cache.set(key,value);if(cache.size>12)cache.delete(cache.keys().next().value!);return value;
}
/** Retains replayed step snapshots so one control edit extends the chain instead of restarting it.
 *  Each snapshot is the exact state after that many steps, so drawings stay identical. */
function replayed<S>(key:string,ticks:number,seed:()=>S,step:(state:S,tick:number)=>S,stride=1,limit=64):S{
  const entry=retained(`replay:${key}`,()=>({snapshots:new Map<number,S>([[0,seed()]])}));
  let from=0;
  for(const tick of entry.snapshots.keys())if(tick<=ticks&&tick>from)from=tick;
  let state:S=entry.snapshots.get(from) as S;
  for(let tick=from;tick<ticks;tick++){
    state=step(state,tick);
    if((tick+1)%stride===0&&entry.snapshots.size<limit)entry.snapshots.set(tick+1,state);
  }
  return state;
}
const v=(layer:Layer,key:string)=>layer.params[key];
const rgb=(layer:Layer,index:number):[number,number,number]=>channels(layer.palette[((index%layer.palette.length)+layer.palette.length)%layer.palette.length]);
function scale(p:any,size:number,draw:()=>void){p.push();p.scale(640/size);draw();p.pop();}
function polyline(p:any,points:number[][],closed=false){if(points.length<2)return;p.beginShape();for(const point of points)p.vertex(point[0],point[1]);if(closed)p.endShape(p.CLOSE);else p.endShape();}
function color(p:any,layer:Layer,index:number,alpha=255){p.stroke(...rgb(layer,index),alpha);}
function fill(p:any,layer:Layer,index:number,alpha=255){p.fill(...rgb(layer,index),alpha);}

export function drawExternalDynamics(p:any,layer:Layer):void{
  switch(layer.technique){
    case 'lingering-links':return drawContacts(p,layer);
    case 'sensing-trails':return drawSensors(p,layer);
    case 'flocking-marks':return drawFlock(p,layer);
    case 'guarded-bands':return drawBands(p,layer);
    case 'hatched-islands':return drawHatches(p,layer);
    case 'bridge-web':return drawBridge(p,layer);
    case 'neighborhood-growth':return drawNeighborhood(p,layer);
    case 'elastic-loops':return drawElastic(p,layer);
    case 'dye-currents':return drawFluid(p,layer);
    default:throw Error('Unknown external dynamics technique');
  }
}

type ContactAgent={id:number,x:number,y:number,vx:number,vy:number};
function initialContacts():ContactAgent[]{return Array.from({length:48},(_,i)=>({id:100+i,x:320+Math.cos(i*2.4)*(70+i%6*20),y:320+Math.sin(i*2.4)*(70+i%5*23),vx:Math.sin(i*1.7)*.6,vy:Math.cos(i*1.3)*.6}));}
function contactModel(ticks:number,radius:number,linger:number){
  let agents=initialContacts(),contacts:any[]=[];
  for(let tick=0;tick<ticks;tick++){
    const pairs=radiusPairs2D({points:agents.map(a=>[a.x,a.y]),radius,maxWork:48*48}).pairs;
    contacts=contactHistory2D({ids:agents.map(a=>a.id),pairs,contacts,lingerSteps:linger,maxWork:5000}).contacts;
    agents=agents.map((a,i)=>({...a,x:a.x+a.vx+Math.sin(tick*.03+i)*.12,y:a.y+a.vy+Math.cos(tick*.027+i)*.12}));
  }
  return {agents,contacts};
}
function drawContacts(p:any,l:Layer){const q=l.params,m=retained(`contacts:${q.ticks}:${q.radius}:${q.linger}`,()=>contactModel(Number(q.ticks),Number(q.radius),Number(q.linger)));
  scale(p,640,()=>{p.noFill();color(p,l,2,100);p.rect(24,24,592,592);const byId=new Map(m.agents.map((a:ContactAgent)=>[a.id,a]));
    for(const link of m.contacts){const a=byId.get(link.ids[0]) as ContactAgent,b=byId.get(link.ids[1]) as ContactAgent;if(!a||!b)continue;color(p,l,1,Math.max(20,220-link.missingTicks*16));p.strokeWeight(1+Math.min(4,link.activeTicks*.28));if(q.dotMarks)p.circle((a.x+b.x)/2,(a.y+b.y)/2,2+Math.min(5,link.activeTicks*.35));else p.line(a.x,a.y,b.x,b.y);}
    p.noStroke();fill(p,l,0);for(const a of m.agents)p.circle(a.x,a.y,5);
  });}

function sensorField(kind:string){const values:number[]=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++){const dx=x-(kind==='lower-left'?18:45),dy=y-(kind==='lower-left'?44:21);values.push(Math.exp(-(dx*dx+dy*dy)/170)+.55*Math.exp(-((x-36)**2+(y-36)**2)/90));}return {values,columns:64,rows:64,origin:[0,0],spacing:[640/63,640/63],boundary:'wrap'};}
function sensorModel(ticks:number,kind:string,gain:number){const field=retained(`sensor-field:${kind}`,()=>sensorField(kind));let agents=Array.from({length:72},(_,i)=>({position:[80+i%12*40,100+Math.floor(i/12)*60],headingTurns:i/72,speed:1.35}));let paths=agents.map(a=>[a.position]);
  for(let tick=0;tick<ticks;tick++){agents=sensorMotorStep2D({agents,field,sensorDistance:13,sensorAngleTurns:.105,turnGain:gain,dt:1,maxWork:72*3}).agents;paths=paths.map((path,i)=>[...path.slice(-110),agents[i].position]);}
  return {agents,paths,field};}
function drawSensors(p:any,l:Layer){const q=l.params,m=retained(`sensors:${q.ticks}:${q.field}:${q.gain}`,()=>sensorModel(Number(q.ticks),String(q.field),Number(q.gain)));
  scale(p,640,()=>{p.noStroke();for(let y=0;y<64;y+=2)for(let x=0;x<64;x+=2){const a=m.field.values[y*64+x];fill(p,l,2,Math.min(130,a*100));p.rect(x*640/63,y*640/63,22,22);}
    color(p,l,3,210);p.strokeWeight(1);p.noFill();for(const path of m.paths){if(q.dotMarks){for(let i=0;i<path.length;i+=8)p.point(...path[i]);}else polyline(p,path);}
    p.noStroke();fill(p,l,4);for(const a of m.agents)p.circle(...a.position,3);
  });}

function flockGraph(chain:boolean){const edges:number[][]=[];if(chain)for(let i=0;i<53;i++)edges.push([i,i+1]);else for(let i=0;i<54;i++){edges.push([i,(i+1)%54].sort((a,b)=>a-b));if(i%3===0)edges.push([i,(i+9)%54].sort((a,b)=>a-b));}return [...new Map(edges.map(pair=>[pair.join(','),pair])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);}
function flockModel(ticks:number,chain:boolean,separation:number){let bodies=Array.from({length:54},(_,i)=>({point:[320+Math.cos(i*2.4)*(90+i%4*28),320+Math.sin(i*2.4)*(90+i%5*18)],velocity:[Math.sin(i)*.8,Math.cos(i*1.7)*.8]}));let trails=bodies.map(b=>[b.point]);const pairs=flockGraph(chain);
  for(let tick=0;tick<ticks;tick++){const steering=flockSteer2D({points:bodies.map(b=>b.point),velocities:bodies.map(b=>b.velocity),pairs,cohesion:.012,alignment:.08,separation,maxSteer:.8,maxWork:54+pairs.length}).steering;
    bodies=bodies.map((b,i)=>{let vx=b.velocity[0]+steering[i][0],vy=b.velocity[1]+steering[i][1];const speed=Math.hypot(vx,vy);if(speed>2.1){vx*=2.1/speed;vy*=2.1/speed;}return {point:[b.point[0]+vx,b.point[1]+vy],velocity:[vx,vy]};});trails=trails.map((path,i)=>[...path.slice(-100),bodies[i].point]);}
  return {bodies,trails,pairs};}
function drawFlock(p:any,l:Layer){const q=l.params,m=retained(`flock:${q.ticks}:${q.chain}:${q.separation}`,()=>flockModel(Number(q.ticks),Boolean(q.chain),Number(q.separation)));
  scale(p,640,()=>{color(p,l,2,150);p.strokeWeight(.65);for(const [a,b] of m.pairs)p.line(...m.bodies[a].point,...m.bodies[b].point);
    color(p,l,1,185);p.strokeWeight(q.dotMarks?2:1);p.noFill();for(const trail of m.trails){if(q.dotMarks){for(let i=0;i<trail.length;i+=8)p.point(...trail[i]);}else polyline(p,trail);}
    p.noStroke();fill(p,l,0);for(const b of m.bodies)p.circle(...b.point,4);
  });}

const bandSources=[
  {id:'estuary',points:[[66,105],[185,120],[310,93],[455,115],[650,87]],widths:[20,34,15,31,18]},
  {id:'echo',points:[[70,153],[195,161],[325,145],[468,164],[652,140]],widths:[12,19,26,17,11]},
  {id:'swell',points:[[70,232],[190,213],[310,244],[445,220],[650,246]],widths:[12,23,38,27,15]},
  {id:'crossing',points:[[125,198],[225,238],[355,265],[490,240],[625,198]],widths:[11,18,24,20,12]},
  {id:'current',points:[[64,335],[190,309],[313,327],[440,297],[650,326]],widths:[15,26,13,30,17]},
  {id:'undertow',points:[[70,377],[194,368],[325,390],[480,370],[650,392]],widths:[10,15,22,15,11]},
  {id:'lowtide',points:[[73,463],[203,435],[330,452],[473,430],[650,458]],widths:[14,27,19,33,17]},
  {id:'return',points:[[80,510],[225,490],[350,506],[500,486],[645,506]],widths:[9,17,13,20,9]},
];
const transferSlope=[19,-12,16,-18,19,-14,16,-12];
function bandModel(wide:boolean,clearance:number,transfer:boolean){const candidates=bandSources.map((source,i)=>({id:source.id,points:source.points.map(([x,y],j)=>[x,transfer?y+(j-2)*transferSlope[i]:y]),widths:source.widths.map(w=>w*(wide?1.3:1)),closed:false,cap:'SQUARE',join:'MITER',miterLimit:2}));
  const model=selectTaperedStrokeStrips2D({candidates,clearance,exclusions:[],maxAccepted:8,maxWork:1000000});return {candidates,model};}
function drawBands(p:any,l:Layer){const q=l.params,m=retained(`bands:${q.wide}:${q.clearance}:${q.transfer}`,()=>bandModel(Boolean(q.wide),Number(q.clearance),Boolean(q.transfer)));
  scale(p,720,()=>{color(p,l,3,90);p.strokeWeight(1);for(let y=67;y<=530;y+=56)p.line(56,y,665,y);
    for(const [i,strip] of m.model.accepted.entries()){color(p,l,0);p.strokeWeight(1.2);fill(p,l,i+1,230);polyline(p,strip.visible.outer,true);p.noFill();color(p,l,4,190);for(let j=1;j<strip.centerline.length;j++)p.line(...strip.centerline[j-1],...strip.centerline[j]);}
    if(q.showRejected){const rejected=new Set(m.model.rejected.map((item:any)=>item.id));p.noFill();color(p,l,0,145);p.strokeWeight(1.5);p.drawingContext.setLineDash([4,6]);for(const candidate of m.candidates)if(rejected.has(candidate.id))polyline(p,candidate.points);p.drawingContext.setLineDash([]);}
  });}

const islandRegions=[
  {outer:[[130,120],[200,75],[330,90],[430,65],[560,125],[635,210],[605,340],[550,440],[445,480],[335,455],[230,495],[120,445],[85,350],[105,230]],holes:[[[225,220],[270,180],[328,205],[345,268],[300,300],[245,282],[218,250]],[[415,275],[450,225],[515,230],[550,280],[530,345],[470,365],[420,335]]]},
  {outer:[[240,75],[340,95],[390,160],[525,160],[590,225],[560,310],[610,390],[530,475],[390,455],[320,500],[205,455],[125,350],[170,280],[125,170]],holes:[[[265,235],[310,195],[380,220],[385,300],[330,325],[275,292]],[[440,355],[480,320],[535,365],[510,420],[455,420]]]},
];
function hatchModel(angle:boolean,dense:boolean,transfer:boolean){const source=islandRegions[Number(transfer)];const region={outer:source.outer.map(point=>[...point]),holes:source.holes.map(ring=>ring.map(point=>[...point]))};const directions=angle?[[.35,1],[1,-.25]]:[[1,.28],[-.72,1]];const spacing=dense?[14,27]:[24,40];const layers=directions.map((direction,i)=>hatchRegionLines2D({region,origin:[0,0],direction,spacing:spacing[i],phase:i?13:7,maxWork:1000000,maxOutputPaths:1000}));return {region,layers};}
/** Canvas2D even-odd fill preserves actual transparency inside supplied holes. */
function fillRegionWithHoles(p:any,region:{outer:number[][];holes:number[][][]}):void{
  const context=p.drawingContext;
  context.beginPath();
  for(const ring of [region.outer,...region.holes]){
    context.moveTo(ring[0][0],ring[0][1]);
    for(let index=1;index<ring.length;index++)context.lineTo(ring[index][0],ring[index][1]);
    context.closePath();
  }
  context.fill('evenodd');
}
function drawHatches(p:any,l:Layer){const q=l.params,m=retained(`hatches:${q.angle}:${q.dense}:${q.transfer}`,()=>hatchModel(Boolean(q.angle),Boolean(q.dense),Boolean(q.transfer)));
  scale(p,720,()=>{p.noStroke();fill(p,l,2,180);fillRegionWithHoles(p,m.region);
    if(q.outline){p.noFill();color(p,l,0);p.strokeWeight(2);polyline(p,m.region.outer,true);for(const hole of m.region.holes)polyline(p,hole,true);}
    for(const [i,layer] of m.layers.entries()){color(p,l,i?1:0,220);p.strokeWeight(i?.9:1.45);for(const segment of layer.paths)p.line(...segment[0],...segment[1]);}
  });}

const BRIDGE_LEVELS=[54,162,268,374,480,586];
function initialBridge(){const nodes:any[]=[],edges:any[]=[];let edgeId=0;for(let strand=0;strand<7;strand++){let previous:number|undefined;for(const y of BRIDGE_LEVELS){const x=78+strand*80+25*Math.sin(y*.015+strand*1.1)+13*Math.cos(y*.029+strand*.65);const id=nodes.length;nodes.push({id,point:[x,y]});if(previous!==undefined)edges.push({id:edgeId++,a:previous,b:id});previous=id;}}return {nodes,edges,nextNodeId:nodes.length,nextEdgeId:edgeId};}
const bridgeCandidate=(tick:number,weave:boolean)=>{const y=110+tick*9.8,slant=(weave?-1:1)*(31+23*Math.sin(tick*.53));return [[24,y-slant],[616,y+slant]];};
const bridgeGap=(tick:number,weave:boolean)=>weave?(tick*5+2+Math.floor(tick/5))%6:(tick*5+Math.floor(tick/7))%6;
type BridgeGraph={nodes:{id:number,point:number[]}[],edges:{id:number,a:number,b:number}[],nextNodeId:number,nextEdgeId:number};
type BridgeState={graph:BridgeGraph,kinds:Map<number,string>,lastEvents:any[]};
function bridgeSeed():BridgeState{const graph=initialBridge();return {graph,kinds:new Map<number,string>(graph.edges.map(edge=>[edge.id,'strand'])),lastEvents:[]};}
function bridgeStep(state:BridgeState,tick:number,weave:boolean):BridgeState{
  const result=insertSegmentBridge2D({graph:state.graph,candidate:bridgeCandidate(tick,weave),gapIndex:bridgeGap(tick,weave),maxNodes:160,maxEdges:200,maxWork:90000});
  const kinds=new Map(state.kinds);
  for(const event of result.events as any[]){if(event.type==='split'){const kind=kinds.get(event.parentEdgeId)??'strand';kinds.delete(event.parentEdgeId);for(const id of event.childEdgeIds)kinds.set(id,kind);}else kinds.set(event.edgeId,'bridge');}
  return {graph:result.graph,kinds,lastEvents:result.events};
}
function bridgeModel(ticks:number,weave:boolean){
  const state=replayed(`bridge:${weave}`,ticks,bridgeSeed,(current,tick)=>bridgeStep(current,tick,weave));
  return {...state,candidate:bridgeCandidate(ticks,weave)};
}
function drawBridge(p:any,l:Layer){const q=l.params,m=bridgeModel(Number(q.ticks),Boolean(q.weave));
  scale(p,640,()=>{const byId=new Map<number,number[]>(m.graph.nodes.map((node:any)=>[node.id,node.point]));p.noFill();color(p,l,2,75);p.strokeWeight(1);for(const edge of m.graph.edges)if(m.kinds.get(edge.id)==='strand')p.line(...byId.get(edge.a)!,...byId.get(edge.b)!);
    color(p,l,1,220);p.strokeWeight(2.2);for(const edge of m.graph.edges)if(m.kinds.get(edge.id)==='strand')p.line(...byId.get(edge.a)!,...byId.get(edge.b)!);
    color(p,l,0,230);p.strokeWeight(3.4);for(const edge of m.graph.edges)if(m.kinds.get(edge.id)==='bridge')p.line(...byId.get(edge.a)!,...byId.get(edge.b)!);
    if(q.candidate){color(p,l,3,150);p.strokeWeight(1);p.drawingContext.setLineDash([5,7]);p.line(...m.candidate[0],...m.candidate[1]);p.drawingContext.setLineDash([]);}
    p.noStroke();fill(p,l,1);for(const node of m.graph.nodes)p.circle(...node.point,3.7);fill(p,l,0);for(const event of m.lastEvents)if(event.type==='link')for(const id of event.nodeIds)p.circle(...byId.get(id)!,7);
  });}

function neighborhoodSeed(){return Array.from({length:26},(_,i)=>[320+190*Math.cos(i*2.4)*(.6+i%5/10),320+190*Math.sin(i*2.4)*(.6+i%4/10)]);}
const neighborhoodChain=Array.from({length:25},(_,i)=>[i,i+1]);
function neighborhoodPairs(points:number[][],chain:boolean){return chain?neighborhoodChain:relativeNeighborhoodPairs2D({points,maxWork:points.length+points.length*(points.length-1)/2*Math.max(0,points.length-2)}).pairs;}
function neighborhoodModel(ticks:number,chain:boolean,minLength:number){let points=neighborhoodSeed();for(let tick=0;tick<ticks;tick++){const pairs=neighborhoodPairs(points,chain);points=thresholdEdgeRelaxation2D({points,pairs,pinned:points.map(()=>false),minLength,stepScale:.35,maxWork:points.length+pairs.length}).points;}return {points,pairs:neighborhoodPairs(points,chain)};}
function drawNeighborhood(p:any,l:Layer){const q=l.params,m=retained(`neighborhood:${q.ticks}:${q.chain}:${q.minLength}`,()=>neighborhoodModel(Number(q.ticks),Boolean(q.chain),Number(q.minLength)));
  scale(p,640,()=>{color(p,l,2,180);p.strokeWeight(1);for(const [a,b] of m.pairs)p.line(...m.points[a],...m.points[b]);p.noStroke();fill(p,l,4);for(const point of m.points)p.circle(...point,q.largeMarks?7:4);});}

function initialElastic(){const nodes:any[]=[],curves:any[]=[];let nextEdgeId=0;for(let curveIndex=0;curveIndex<3;curveIndex++){const nodeIds:number[]=[],edgeIds:number[]=[],restLengths:number[]=[],restTurns:number[]=[];
    for(let index=0;index<10;index++){const y=88+49*index,x=145+175*curveIndex+27*Math.sin(index*.72+curveIndex*.85),id=nodes.length;nodes.push({id,position:[x,y],velocity:[0,0],pinned:index===0});nodeIds.push(id);if(index>0){edgeIds.push(nextEdgeId++);const a=nodes[nodeIds[index-1]].position,b=nodes[id].position;restLengths.push(Math.hypot(b[0]-a[0],b[1]-a[1]));}}
    for(let index=1;index<9;index++){const a=nodes[nodeIds[index-1]].position,b=nodes[nodeIds[index]].position,c=nodes[nodeIds[index+1]].position;const incoming=[b[0]-a[0],b[1]-a[1]],outgoing=[c[0]-b[0],c[1]-b[1]];restTurns.push(Math.atan2(incoming[0]*outgoing[1]-incoming[1]*outgoing[0],incoming[0]*outgoing[0]+incoming[1]*outgoing[1]));}
    curves.push({id:curveIndex,closed:false,nodeIds,edgeIds,restLengths,restTurns});}
  return {nodes,curves,nextNodeId:nodes.length,nextEdgeId};}
function elasticStep(state:any,seedNodeCount:number,reverseCurl:boolean,windX:number){
  const restGrowth=state.curves.map((curve:any)=>curve.restLengths.map((length:number)=>length*.018));
  const turnRates=state.curves.map((curve:any)=>curve.restTurns.map((_:number,index:number)=>{const id=curve.nodeIds[index+1];if(id>=seedNodeCount)return 0;const direction=curve.id===1?-1:1,profile=.7+.3*Math.sin(Math.PI*(id%10)/9);return (reverseCurl?-1:1)*direction*.09*profile;}));
  const externalAccelerations=state.nodes.map(()=>[windX,0]);
  return elasticCurveGrowStep2D({state,restGrowth,turnRates,externalAccelerations,stretchStiffness:.03,bendStiffness:80,contactRange:55,contactStrength:18,damping:.88,dt:.4,maxSpeed:6,maxSegmentLength:42,maxNodes:160,maxEdges:160,maxWork:400000,maxBacktracks:8}).state;
}
function elasticModel(ticks:number,reverseCurl:boolean,windX:number){
  const seed=retained('elastic-seed',initialElastic);
  const state=replayed(`elastic:${reverseCurl}:${windX}`,ticks,()=>seed,current=>elasticStep(current,seed.nodes.length,reverseCurl,windX),1,48);
  return {state,seed};
}
function drawElastic(p:any,l:Layer){const q=l.params,m=elasticModel(Number(q.ticks),Boolean(q.reverseCurl),Number(q.windX));
  scale(p,640,()=>{p.strokeCap(p.ROUND);const initial=new Map<number,number[]>(m.seed.nodes.map((node:any)=>[node.id,node.position]));const current=new Map<number,number[]>(m.state.nodes.map((node:any)=>[node.id,node.position]));
    color(p,l,2,80);p.strokeWeight(1.2);for(const curve of m.seed.curves)for(let i=1;i<curve.nodeIds.length;i++)p.line(...initial.get(curve.nodeIds[i-1])!,...initial.get(curve.nodeIds[i])!);
    for(const curve of m.state.curves){color(p,l,0);p.strokeWeight(13);for(let i=1;i<curve.nodeIds.length;i++)p.line(...current.get(curve.nodeIds[i-1])!,...current.get(curve.nodeIds[i])!);
      color(p,l,curve.id+1);p.strokeWeight(8);for(let i=1;i<curve.nodeIds.length;i++)p.line(...current.get(curve.nodeIds[i-1])!,...current.get(curve.nodeIds[i])!);
      color(p,l,4,200);p.strokeWeight(1.1);for(let i=1;i<curve.nodeIds.length;i++)p.line(...current.get(curve.nodeIds[i-1])!,...current.get(curve.nodeIds[i])!);}
    if(q.structure){p.noStroke();fill(p,l,4);for(const node of m.state.nodes)p.circle(...node.position,node.id<m.seed.nodes.length?5:2.7);}
    p.noStroke();for(const curve of m.state.curves){fill(p,l,4);p.circle(...current.get(curve.nodeIds[0])!,10);fill(p,l,curve.id+1);p.circle(...current.get(curve.nodeIds.at(-1))!,9);}
  });}

function fluidModel(ticks:number,injection:number,viscosity:number,projection:boolean,texture:boolean){
  // Fluid frames are large, so snapshots are kept every tenth step instead of every step.
  return replayed(`fluid:${injection}:${viscosity}:${projection}:${texture}`,ticks,
    ()=>initialFluid(texture),state=>stepFluid(state,{injection,viscosity,projection}),10,16);
}
function drawFluid(p:any,l:Layer){const q=l.params,key=`fluid:${q.ticks}:${q.injection}:${q.viscosity}:${q.projection}:${q.texture}`;
  const state=fluidModel(Number(q.ticks),Number(q.injection),Number(q.viscosity),Boolean(q.projection),Boolean(q.texture));
  scale(p,720,()=>{const inks=[rgb(l,2),rgb(l,4),rgb(l,1)];p.noStroke();const image=p.createImage(FLUID_SIZE,FLUID_SIZE);image.loadPixels();
    for(let i=0;i<CELLS;i++){const amounts=state.dyes.map((dye:number[])=>Math.min(1,Math.max(0,dye[i]))),total=amounts[0]+amounts[1]+amounts[2],opacity=Math.min(.98,total*1.7);
      for(let c=0;c<3;c++)image.pixels[4*i+c]=total?amounts.reduce((sum:number,weight:number,k:number)=>sum+weight*inks[k][c],0)/total:0;
      image.pixels[4*i+3]=Math.round(255*opacity);}
    image.updatePixels();p.image(image,48,48,624,624);
    if(q.contours){const contourLayers=retained(`fluid-contours:${key}`,()=>state.dyes.map((values:number[])=>[.08,.16,.28,.44,.64].map(threshold=>marchingSquares2D({values,columns:FLUID_SIZE,rows:FLUID_SIZE,origin:[48+624/FLUID_SIZE/2,48+624/FLUID_SIZE/2],spacing:[624/FLUID_SIZE,624/FLUID_SIZE],threshold,maxWork:2*CELLS}).segments)));
      p.noFill();p.strokeWeight(.7);for(let k=0;k<3;k++){p.stroke(...inks[k],135);for(const lines of contourLayers[k])for(const segment of lines)p.line(...segment);}}
    p.noStroke();fill(p,l,0);p.textSize(11);p.text('DYE CURRENTS   /   STUDY 01',48,700);
  });}
