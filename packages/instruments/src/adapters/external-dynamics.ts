import type {ControlGroup, Layer} from '../types.js';
import {defaultPalettes} from '../default-palettes.js';
import {choice,numeric,toggle,channels,type StudioDefinition} from './types.js';

import {motionConstruction,motionSimulations,validateMotion,type ContactModel,type SensorModel,type FlockModel,type MotionParams} from './external-motion-sources.js';
import {createSimulationCache,type Frozen} from '../composition/snapshots.js';
import { creativePreparers } from './creative-instruments.js';

const sourceParameters=[
  numeric('count','Agents','Number of seeded moving agents.',8,90,1,{hardMin:1,hardMax:240,integer:true}),
  choice('sourceMode','Source shape','Distribute starting agents in an area, ring, or line.',['area','ring','line']),
  numeric('centerX','Source X','Horizontal source center in canvas coordinates.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('centerY','Source Y','Vertical source center in canvas coordinates.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('extent','Extent','Width or diameter of the starting distribution.',0,520,1,{hardMin:0,hardMax:2048}),
  numeric('aspect','Aspect','Vertical extent relative to horizontal extent before rotation.',0,2,.05,{hardMin:0,hardMax:20}),
  numeric('sourceAngle','Direction','Rotate the source and set the common heading in degrees.',-180,180,1,{hardMin:-3600,hardMax:3600}),
  numeric('disorder','Heading disorder','Spread the seeded headings away from the common direction.',0,1,.01),
  numeric('speed','Speed','Initial agent speed in pixels per step.',0,3,.05,{hardMin:0,hardMax:20}),
];
const sourceDefaults={count:48,sourceMode:'ring',centerX:320,centerY:320,extent:230,aspect:.8,sourceAngle:0,disorder:.75,speed:1.1};

/** Shared source sections; each study appends its own sections after them. */
const sourceGroups:ControlGroup[]=[
  {label:'Population',stage:'form',controls:['sourceMode','count','speed','disorder']},
  {label:'Placement',stage:'frame',controls:['centerX','centerY','extent','aspect','sourceAngle']},
];

/** Artist-facing controls; operation contracts retain their own required inputs. */
export const externalDynamicsDefinitions:StudioDefinition[]=[
  {id:'lingering-links',title:'Lingering links',description:'A seeded moving population leaves remembered proximity marks in a freely placed region.', procedure: "Move agents from seeded starts on fixed headings. At every tick, link each pair that comes within the contact radius. A pair that separates keeps its link for a few more ticks before it is forgotten. Draw the links, midpoint dots and agent positions.",controlGroups:[...sourceGroups,
    {label:'Contacts',stage:'process',controls:['ticks','radius','linger']},
    {label:'Drawing',stage:'material',controls:['weight','linkMarks','dotMarks','agentDots']}],
  parameters:[numeric('ticks','Ticks','Advance motion and contact memory.',0,80,1,{hardMin:0,hardMax:240,integer:true}), ...sourceParameters, numeric('radius','Contact radius','Distance at which pairs make or renew a contact.',0,180,1,{hardMin:0,hardMax:1024}), numeric('linger','Linger','Steps a separated contact stays present.',0,36,1,{hardMin:0,hardMax:240,integer:true}), numeric('weight','Stroke weight','Scale the thickness of contact strokes and midpoint marks.',.3,3,.1,{hardMin:0,hardMax:20}), toggle('linkMarks','Link strokes','Draw retained connections.'), toggle('dotMarks','Midpoint dots','Mark retained contacts at their midpoint.'), toggle('agentDots','Agent dots','Draw current positions.')],defaults:{ticks:38, ...sourceDefaults, radius:75, linger:15, weight:1, linkMarks:true, dotMarks:false, agentDots:false},validate:q=>validateMotion('lingering-links',q)},
  {id:'sensing-trails',title:'Sensing trails',description:'Seeded agents probe an editable landscape of compact scalar peaks and leave local paths.', procedure: "Scatter compact scalar peaks, then let agents move through them. Each agent samples the field at two probes ahead, left and right, and turns toward the difference by a set gain. Keep every step and draw each agent's path as a trail.",controlGroups:[...sourceGroups,
    {label:'Field',stage:'form',controls:['peaks','fieldSpread','fieldRadius']},
    {label:'Sensing',stage:'process',controls:['ticks','gain','reach','probeAngle']},
    {label:'Drawing',stage:'material',controls:['weight','trailMarks','dotMarks','agentDots','showField']}],
  parameters:[numeric('ticks','Ticks','Advance the paired-probe trajectories.',0,90,1,{hardMin:0,hardMax:240,integer:true}), ...sourceParameters, numeric('peaks','Peaks','Count of seeded scalar-field peaks.',1,8,1,{hardMin:1,hardMax:12,integer:true}), numeric('fieldSpread','Peak spread','Radius within which peak centers scatter about the source center.',0,280,1,{hardMin:0,hardMax:1024}), numeric('fieldRadius','Peak radius','Width of each scalar peak.',5,140,1,{hardMin:1,hardMax:640}), numeric('gain','Turn gain','Signed response to the right-minus-left probe values.',-.2,.2,.005,{hardMin:-4,hardMax:4}), numeric('reach','Probe distance','Distance ahead of an agent sampled by each sensor.',0,60,1,{hardMin:0,hardMax:640}), numeric('probeAngle','Probe angle','Turn separation between the heading and each sensor, in turns.',0,.25,.005,{hardMin:0,hardMax:.5}), numeric('weight','Stroke weight','Set trajectory and sampled-dot weight without changing the field or paths.',.3,3,.1,{hardMin:0,hardMax:20}), toggle('trailMarks','Trail strokes','Connect successive agent positions.'), toggle('dotMarks','Trail dots','Stamp spaced samples along trails.'), toggle('agentDots','Agent dots','Draw current agent positions.'), toggle('showField','Show field','Show the sampled scalar peaks as translucent tiles.')],defaults:{ticks:56, ...sourceDefaults, count:55, extent:170, speed:1.35, peaks:3, fieldSpread:115, fieldRadius:72, gain:.075, reach:16, probeAngle:.105, weight:1.6, trailMarks:true, dotMarks:false, agentDots:false, showField:false},validate:q=>validateMotion('sensing-trails',q)},
  {id:'flocking-marks',title:'Flocking marks',description:'Seeded agents steer through actual nearby neighbors, tracing local collective motion.', procedure: "Start agents in an area, ring or line with spread headings. Each tick, find the neighbours within a radius and steer every agent by cohesion, alignment and separation, all agents at once. Keep each agent's trajectory and draw it as a trail, with optional dots and neighbour links.",controlGroups:[...sourceGroups,
    {label:'Steering',stage:'process',controls:['ticks','radius','cohesion','alignment','separation']},
    {label:'Drawing',stage:'material',controls:['weight','trailMarks','dotMarks','links','agentDots']}],
  parameters:[numeric('ticks','Ticks','Advance synchronous local steering.',0,90,1,{hardMin:0,hardMax:240,integer:true}), ...sourceParameters, numeric('radius','Neighbor radius','Proximity radius queried afresh every tick.',0,170,1,{hardMin:0,hardMax:1024}), numeric('cohesion','Cohesion','Pull toward nearby neighbors.',0,.06,.002,{hardMin:0,hardMax:2}), numeric('alignment','Alignment','Match nearby velocity.',0,.3,.01,{hardMin:0,hardMax:2}), numeric('separation','Separation','Push away from nearby neighbors.',0,.8,.02,{hardMin:0,hardMax:2}), numeric('weight','Stroke weight','Scale trajectory and optional neighbor-link weight.',.3,3,.1,{hardMin:0,hardMax:20}), toggle('trailMarks','Trail strokes','Join successive positions into trajectories.'), toggle('dotMarks','Trail dots','Draw spaced trajectory samples.'), toggle('links','Neighbor links','Show the current proximity graph.'), toggle('agentDots','Agent dots','Mark current agent positions.')],defaults:{ticks:52, ...sourceDefaults, count:48, extent:190, speed:1.1, radius:62, cohesion:.012, alignment:.08, separation:.42, weight:1, trailMarks:true, dotMarks:false, links:false, agentDots:false},validate:q=>validateMotion('flocking-marks',q)}
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
/** Retained motion snapshots by construction (no palette, weight or mark toggle); a longer `ticks` extends a cached shorter run. */
const motionCache=createSimulationCache({capacity:12});
/** Thrown when cooperative preparation is cancelled before publishing a model. */
export class PreparationCancelledError extends Error{
  constructor(){super('preparation cancelled');this.name='PreparationCancelledError';}
}
type MotionKind='lingering-links'|'sensing-trails'|'flocking-marks';
type MotionResult=ContactModel|SensorModel|FlockModel;
/** Models are published frozen and read by every draw; they are never rebuilt for an appearance edit. */
function motionRequest(kind:MotionKind,l:Layer){
  validateMotion(kind,l.params);
  const q=l.params as unknown as MotionParams;
  return {sim:motionSimulations[kind],construction:motionConstruction(kind,q),seed:l.seed,options:{steps:q.ticks,checkpointEvery:20,historyEvery:0}};
}
function motionModel(kind:MotionKind,l:Layer):Frozen<MotionResult>{
  const {sim,construction,seed,options}=motionRequest(kind,l);
  return motionCache.get(sim,construction,seed,options).final;
}
async function prepareMotion(kind:MotionKind,l:Layer,isCancelled:()=>boolean):Promise<void>{
  const {sim,construction,seed,options}=motionRequest(kind,l);
  if(!await motionCache.prepare(sim,construction,seed,{...options,cancelled:isCancelled}))throw new PreparationCancelledError();
}

/** Studies whose model work can be prepared cooperatively. */
export const externalDynamicsPreparable=new Set(['lingering-links','sensing-trails','flocking-marks',...Object.keys(creativePreparers)]);
/** Warms the module caches for a study's model so the following synchronous draw is
 *  a cache hit. Runs step work across macrotasks and stops when isCancelled() is true;
 *  the last successful image is never touched by preparation. */
export async function prepareExternalDynamics(layer:Layer,isCancelled:()=>boolean):Promise<void>{
  const prepare=creativePreparers[layer.technique];
  if(prepare){
    if(!await prepare(layer,isCancelled))throw new PreparationCancelledError();
    return;
  }
  switch(layer.technique){
    case 'lingering-links':
    case 'sensing-trails':
    case 'flocking-marks':
      await prepareMotion(layer.technique,layer,isCancelled);
      return;
    default:
      throw Error(`No cooperative preparation for ${String(layer.technique)}`);
  }
}

const rgb=(layer:Layer,index:number):[number,number,number]=>channels(layer.palette[((index%layer.palette.length)+layer.palette.length)%layer.palette.length]);
function scale(p:any,size:number,draw:()=>void){p.push();p.scale(640/size);draw();p.pop();}
function polyline(p:any,points:readonly (readonly number[])[],closed=false){if(points.length<2)return;p.beginShape();for(const point of points)p.vertex(point[0],point[1]);if(closed)p.endShape(p.CLOSE);else p.endShape();}
function color(p:any,layer:Layer,index:number,alpha=255){p.stroke(...rgb(layer,index),alpha);}
function fill(p:any,layer:Layer,index:number,alpha=255){p.fill(...rgb(layer,index),alpha);}

export function drawExternalDynamics(p:any,layer:Layer):void{
  switch(layer.technique){
    case 'lingering-links':return drawSeededContacts(p,layer);
    case 'sensing-trails':return drawSeededSensors(p,layer);
    case 'flocking-marks':return drawSeededFlock(p,layer);
    default:throw Error('Unknown external dynamics technique');
  }
}
type MotionDrawing={
  strokeWeight:(weight:number)=>void;noFill:()=>void;noStroke:()=>void;
  line:(...coordinates:number[])=>void;circle:(...coordinates:number[])=>void;
  rect:(...coordinates:number[])=>void;point:(...coordinates:number[])=>void;
};
function drawSeededContacts(p:MotionDrawing,l:Layer):void{
  const q=l.params,m=motionModel('lingering-links',l) as Frozen<ContactModel>,weight=Number(q.weight);
  scale(p,640,()=>{
    if(weight>0&&(q.linkMarks||q.dotMarks)){
      p.noFill();
      const byId=new Map(m.agents.map(a=>[a.id,a]));
      for(const link of m.contacts){
        const a=byId.get(link.ids[0]),b=byId.get(link.ids[1]);if(!a||!b)continue;
        color(p,l,1,Math.max(20,220-link.missingTicks*16));
        p.strokeWeight((1+Math.min(4,link.activeTicks*.28))*weight);
        if(q.linkMarks)p.line(a.x,a.y,b.x,b.y);
        if(q.dotMarks)p.circle((a.x+b.x)/2,(a.y+b.y)/2,(2+Math.min(5,link.activeTicks*.35))*weight);
      }
    }
    if(q.agentDots){p.noStroke();fill(p,l,0);for(const a of m.agents)p.circle(a.x,a.y,4);}
  });
}
function drawSeededSensors(p:MotionDrawing,l:Layer):void{
  const q=l.params,m=motionModel('sensing-trails',l) as Frozen<SensorModel>,weight=Number(q.weight);
  scale(p,640,()=>{
    if(q.showField){p.noStroke();for(let y=0;y<64;y+=2)for(let x=0;x<64;x+=2){
      const value=m.field.values[y*64+x];fill(p,l,2,Math.min(70,value*45));
      p.rect(x*640/63,y*640/63,640/63+.5,640/63+.5);
    }}
    if(weight>0&&(q.trailMarks||q.dotMarks)){
      color(p,l,3,230);p.noFill();
      for(const path of m.paths){
        if(q.trailMarks){p.strokeWeight(weight);polyline(p,path);}
        if(q.dotMarks){p.strokeWeight(weight*2);for(let i=0;i<path.length;i+=8)p.point(...path[i]);}
      }
    }
    if(q.agentDots){p.noStroke();fill(p,l,4);for(const a of m.agents)p.circle(...a.position,3.6);}
  });
}
function drawSeededFlock(p:MotionDrawing,l:Layer):void{
  const q=l.params,m=motionModel('flocking-marks',l) as Frozen<FlockModel>,weight=Number(q.weight);
  scale(p,640,()=>{
    if(weight>0){
      if(q.links){color(p,l,2,120);p.strokeWeight(weight*.65);for(const [a,b] of m.pairs)p.line(...m.bodies[a].point,...m.bodies[b].point);}
      if(q.trailMarks||q.dotMarks){
        color(p,l,1,185);p.noFill();
        for(const trail of m.trails){
          if(q.trailMarks){p.strokeWeight(weight);polyline(p,trail);}
          if(q.dotMarks){p.strokeWeight(weight*2);for(let i=0;i<trail.length;i+=8)p.point(...trail[i]);}
        }
      }
    }
    if(q.agentDots){p.noStroke();fill(p,l,0);for(const b of m.bodies)p.circle(...b.point,4);}
  });
}

type ContactAgent={id:number,x:number,y:number,vx:number,vy:number};



















/** Canvas2D even-odd fill preserves actual transparency inside supplied holes. */







type BridgeGraph={nodes:{id:number,point:number[]}[],edges:{id:number,a:number,b:number}[],nextNodeId:number,nextEdgeId:number};
type BridgeState={graph:BridgeGraph,kinds:Map<number,string>,lastEvents:any[]};





const NEIGHBORHOOD_CELL=640/14;
const NEIGHBORHOOD_POOL=(()=>{
  const fract=(x:number)=>x-Math.floor(x);
  const jitter=(row:number,col:number,salt:number)=>fract(Math.sin(row*127.1+col*311.7+salt*74.7)*43758.5453);
  const points:number[][]=[];
  const keyed: {index:number;key:number}[]=[];
  for(let row=0;row<14;row++)for(let col=0;col<14;col++){
    const index=row*14+col;
    points.push([NEIGHBORHOOD_CELL*(col+0.5)+(jitter(row,col,1)-0.5)*NEIGHBORHOOD_CELL*0.7,
      NEIGHBORHOOD_CELL*(row+0.5)+(jitter(row,col,2)-0.5)*NEIGHBORHOOD_CELL*0.7]);
    keyed.push({index,key:jitter(row,col,3)});
  }
  keyed.sort((a,b)=>a.key-b.key||a.index-b.index);
  return {points,order:keyed.map(item=>item.index)};
})();






type NeighborhoodState={points:number[][];used:boolean[];cursor:number};





 
 
 
 



