import {spaceColonizationStep2D} from '@procedurals/javascript';
import {JavaRandom} from '@procedurals/javascript/examples/city-marks/city-marks.js';
import type {ControlGroup, Layer} from '../types.js';
import {channels, choice, numeric, toggle, type StudioDefinition} from './types.js';

type Point = [number, number];
type Stroke = [number, number, number, number, number];
type Canvas = {push():void;pop():void;noFill():void;noStroke():void;stroke(...values:number[]):void;fill(...values:number[]):void;strokeWeight(value:number):void;line(x0:number,y0:number,x1:number,y1:number):void;circle(x:number,y:number,diameter:number):void};
type Params = Layer['params'];
/**
 * The published growth: attractor positions, the pending tips, and every grown segment as
 * `[x0,y0,x1,y1,tick]` in tick-major order. `lineage` records how the segments connect: for each
 * segment, the segment that grew its tip (`-1 - root` for a root tip) and, when that tip was born
 * from a consumed attractor, its slot (0..branches-1) among that fork's siblings (0 otherwise).
 * A parent always precedes its children, so a longer `ticks` only appends. It is absent only if
 * the native step's result could not be matched to its tips exactly (a growing tip landed exactly
 * on an attractor consumed by another tip in the same tick); drawing does not need it.
 */
export type GrowthModel = {sources:Point[];tips:Point[];segments:Stroke[];lineage?:{parents:Int32Array;slots:Uint8Array}};
type Model = GrowthModel;

const parameters = [
  numeric('sourceCount','Attractors','Target points in the independently seeded population.',8,180,1,{hardMin:1,hardMax:450,integer:true}),
  choice('sourceMode','Attractor footprint','Area, annulus, or two unequal lobes.',['area','ring','two-lobe']),
  numeric('extent','Source extent','Width of the local attractor footprint.',35,480,1,{hardMin:1,hardMax:1600}),
  numeric('aspect','Source aspect','Height-to-width ratio before rotating the footprint.',.2,2,.05,{hardMin:.05,hardMax:8}),
  numeric('direction','Source direction','Rotate only the attractor footprint (degrees).',-180,180,1,{hardMin:-3600,hardMax:3600}),
  numeric('centerX','Source X','Attractor footprint center on the canvas.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('centerY','Source Y','Attractor footprint center on the canvas.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('disorder','Source disorder','Perturb the angular placement of ordered attractors.',0,1,.01,{hardMin:0,hardMax:1}),
  numeric('exclusion','Center exclusion','Area and lobe center holes as a fraction of their local radius.',0,.85,.01,{hardMin:0,hardMax:.95}),
  numeric('band','Ring thickness','Fraction of outer radius occupied by the annulus; zero makes a thin ring.',0,1,.01,{hardMin:0,hardMax:1}),
  numeric('lobeGap','Lobe separation','Space between the two lobes as a fraction of total width.',0,.75,.01,{hardMin:0,hardMax:.9}),
  numeric('lobeBias','Left lobe share','Approximate fraction of attractors assigned to the left lobe.',.1,.9,.01,{hardMin:.05,hardMax:.95}),
  numeric('rootCount','Root tips','Independent initial growing tips.',1,8,1,{hardMin:1,hardMax:16,integer:true}),
  numeric('rootSpread','Root spread','Distance between the first and last root along the root heading.',0,320,1,{hardMin:0,hardMax:1600}),
  numeric('rootJitter','Root jitter','Independent seeded displacement of each initial tip.',0,35,.5,{hardMin:0,hardMax:200}),
  numeric('rootX','Root X','Independent center of the initial tips.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('rootY','Root Y','Independent center of the initial tips.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('rootHeading','Root heading','Direction of the root placement axis; the toolkit aims each tip at its nearest target.',-180,180,1,{hardMin:-3600,hardMax:3600}),
  numeric('ticks','Growth ticks','Maximum complete native colonization steps; exhaustion ends growth naturally.',0,70,1,{hardMin:0,hardMax:160,integer:true}),
  numeric('step','Growth step','Distance of an advancing tip or a newly branched tip from its source.',1,18,.5,{hardMin:.01,hardMax:100}),
  numeric('reach','Consumption distance','Nearest attractor is consumed when reached within this distance.',1,30,.5,{hardMin:.01,hardMax:200}),
  numeric('branches','Branches per tip','Tips emitted when a growing tip consumes its nearest attractor.',1,3,1,{hardMin:1,hardMax:5,integer:true}),
  numeric('branchSpread','Branch spread','Angular half-span of a consumed attractor’s new tips (degrees).',0,100,1,{hardMin:0,hardMax:180}),
  numeric('weight','Growth weight','First generation stroke weight; zero hides the growth strokes.',0,7,.1,{hardMin:0,hardMax:20}),
  numeric('taper','Generation taper','Weight multiplier after each growth tick.',.86,1,.01,{hardMin:0,hardMax:1}),
  toggle('terminals','Terminal dots','Mark active tips, or last grown ends when all attractors are exhausted.'),
  numeric('terminalSize','Terminal size','Diameter of optional terminal marks.',0,12,.2,{hardMin:0,hardMax:40}),
  toggle('guides','Attractor guides','Reveal the source population without changing growth.'),
  numeric('guideSize','Guide size','Diameter of optional attractor points.',0,8,.2,{hardMin:0,hardMax:30}),
];

const controlGroups:ControlGroup[] = [
  {label:'Attractors',stage:'form',controls:['sourceMode','sourceCount','disorder','exclusion','band','lobeGap','lobeBias']},
  {label:'Placement',stage:'frame',controls:['centerX','centerY','extent','aspect','direction']},
  {label:'Roots',stage:'form',controls:['rootCount','rootSpread','rootJitter','rootX','rootY','rootHeading']},
  {label:'Growth',stage:'process',controls:['ticks','step','reach',{label:'Branching',controls:['branches','branchSpread']}]},
  {label:'Drawing',stage:'material',controls:['weight','taper',
    {label:'Terminals',controls:['terminals','terminalSize']},
    {label:'Guides',controls:['guides','guideSize']}]},
];

export const attractorGrowthDefinitions:StudioDefinition[] = [{
  id:'attractor-growth',title:'Attractor growth',description:'Seed an editable attractor footprint and independent roots; grow branching tips toward nearest unconsumed targets.', procedure: "Target points are scattered and roots placed apart from them, then every branch tip steps toward its nearest remaining target. A tip that reaches its target eats it and splits in two, so the tree reaches out and thins toward the food it hunts.",parameters,controlGroups,
  defaults:{sourceCount:95,sourceMode:'area',extent:315,aspect:1.1,direction:0,centerX:320,centerY:305,disorder:.45,exclusion:.12,band:.18,lobeGap:.3,lobeBias:.62,rootCount:1,rootSpread:0,rootJitter:5,rootX:320,rootY:530,rootHeading:0,ticks:65,step:7,reach:17,branches:2,branchSpread:42,weight:2.6,taper:.973,terminals:false,terminalSize:4,guides:false,guideSize:3},
  validate:validateAttractorGrowth,
}];

const domains:Record<string,[number,number,boolean?]> = {
  sourceCount:[1,450,true],extent:[1,1600],aspect:[.05,8],direction:[-3600,3600],centerX:[-2048,2048],centerY:[-2048,2048],disorder:[0,1],exclusion:[0,.95],band:[0,1],lobeGap:[0,.9],lobeBias:[.05,.95],rootCount:[1,16,true],rootSpread:[0,1600],rootJitter:[0,200],rootX:[-2048,2048],rootY:[-2048,2048],rootHeading:[-3600,3600],ticks:[0,160,true],step:[.01,100],reach:[.01,200],branches:[1,5,true],branchSpread:[0,180],weight:[0,20],taper:[0,1],terminalSize:[0,40],guideSize:[0,30],
};
const constructionKeys = ['sourceCount','sourceMode','extent','aspect','direction','centerX','centerY','disorder','exclusion','band','lobeGap','lobeBias','rootCount','rootSpread','rootJitter','rootX','rootY','rootHeading','ticks','step','reach','branches','branchSpread'];
const MAX_TIPS = 2048, MAX_QUERIES = 1_800_000, MAX_SEGMENTS = 16_000;
function number(q:Params,key:string):number{return q[key] as number;}
function budget(q:Params):{tipBound:number;segmentBound:number;queryBound:number}{
  const roots=number(q,'rootCount'),count=number(q,'sourceCount'),ticks=number(q,'ticks');
  // A tip can add branches-1 tips only by consuming one of the finite sources.
  // No source can be consumed twice, and a tip with no unconsumed source disappears.
  const tipBound=roots+(number(q,'branches')-1)*count;
  const segmentBound=ticks*roots+(number(q,'branches')-1)*count*Math.max(0,ticks-1);
  return {tipBound,segmentBound,queryBound:segmentBound*count};
}
/** Validate the native 2048-tip ceiling and a conservative aggregate tip-source scan/output budget. */
export function validateAttractorGrowth(q:Params):void{
  for(const [key,[low,high,integral]] of Object.entries(domains)){
    const value=q[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high||(integral&&!Number.isInteger(value)))throw Error(`Attractor growth ${key} outside supported domain`);
  }
  if(!['area','ring','two-lobe'].includes(String(q.sourceMode)))throw Error('Unknown attractor footprint');
  if(q.sourceMode==='two-lobe'&&(Math.round(number(q,'sourceCount')*number(q,'lobeBias'))===0||Math.round(number(q,'sourceCount')*number(q,'lobeBias'))===number(q,'sourceCount')))throw Error('Two-lobe attractors require at least one target in each lobe; increase attractors or adjust left lobe share');
  for(const key of ['terminals','guides'])if(typeof q[key]!=='boolean')throw Error(`Attractor growth ${key} must be boolean`);
  if(number(q,'rootCount')>1&&number(q,'rootSpread')===0)throw Error('Multiple root tips require positive root spread');
  const {tipBound,segmentBound,queryBound}=budget(q);
  if(tipBound>MAX_TIPS||segmentBound>MAX_SEGMENTS||queryBound>MAX_QUERIES)throw Error(`Attractor growth budget exceeded: at most ${MAX_TIPS} tips, ${MAX_SEGMENTS} segments and ${MAX_QUERIES} tip–attractor queries; reduce attractors, branches, roots or ticks`);
}
function place(x:number,y:number,cx:number,cy:number,angle:number):Point{
  const c=Math.cos(angle),s=Math.sin(angle);return [cx+x*c-y*s,cy+x*s+y*c];
}
function sources(q:Params,seed:number):Point[]{
  const rng=new JavaRandom(seed^0x632c741e),out:Point[]=[],count=number(q,'sourceCount'),radius=number(q,'extent')/2,aspect=number(q,'aspect');
  const angle=number(q,'direction')*Math.PI/180,mode=q.sourceMode,phase=rng.nextDouble()*2*Math.PI;
  const leftCount=mode==='two-lobe'?Math.round(count*number(q,'lobeBias')):0;
  for(let i=0;i<count;i++){
    const left=i<leftCount,lobeIndex=left?i:i-leftCount,lobeCount=left?leftCount:count-leftCount;
    const n=mode==='two-lobe'?lobeCount:count,j=mode==='two-lobe'?lobeIndex:i;
    const theta=phase+2*Math.PI*((j+.5)/n+(rng.nextDouble()-.5)*number(q,'disorder')/n);
    const inner=mode==='ring'?1-number(q,'band'):number(q,'exclusion');
    const radial=mode==='ring'?inner+(1-inner)*rng.nextDouble():Math.sqrt(inner*inner+(1-inner*inner)*rng.nextDouble());
    const lobeRadius=mode==='two-lobe'?radius*(1-number(q,'lobeGap'))/2:radius;
    const offset=mode==='two-lobe'?(left?-1:1)*radius*(1+number(q,'lobeGap'))/2:0;
    out.push(place(offset+lobeRadius*radial*Math.cos(theta),lobeRadius*radial*Math.sin(theta)*aspect,number(q,'centerX'),number(q,'centerY'),angle));
  }
  return out;
}
function roots(q:Params,seed:number):Point[]{
  const random=new JavaRandom(seed^0x517296ac),out:Point[]=[],count=number(q,'rootCount'),spread=number(q,'rootSpread');
  const angle=number(q,'rootHeading')*Math.PI/180;
  for(let i=0;i<count;i++){
    const x=(count===1?0:((i/(count-1))-.5)*spread)+(random.nextDouble()-.5)*number(q,'rootJitter');
    const y=(random.nextDouble()-.5)*number(q,'rootJitter');
    out.push(place(x,y,number(q,'rootX'),number(q,'rootY'),angle));
  }
  return out;
}
function* replay(q:Params,seed:number):Generator<void,Model>{
  const targets=sources(q,seed),segments:Stroke[]=[],parents:number[]=[],slots:number[]=[];let consumed=targets.map(()=>false);
  let tips=roots(q,seed);
  // For each current tip: the segment that grew it (`-1 - root` for a root tip) and its fork slot.
  let owners:number[]|undefined=tips.map((_,root)=>-1-root),ownerSlots=tips.map(()=>0);
  for(let tick=0;tick<number(q,'ticks')&&tips.length>0;tick++){
    const next=spaceColonizationStep2D({tips,sources:targets,consumed,step:number(q,'step'),reach:number(q,'reach'),branches:number(q,'branches'),branchAngle:number(q,'branchSpread')*Math.PI/180,maxWork:MAX_QUERIES});
    if(next.dropped!==0)throw Error('Attractor growth exceeded the native tip cap');
    if(segments.length+next.segments.length>MAX_SEGMENTS)throw Error('Attractor growth exceeded the segment budget');
    const base=segments.length,newlyConsumed=new Set<string>();
    // The native step emits one segment per tip, in tip order, for a prefix of the tips (a tip is
    // dropped only once every attractor is gone). A segment ending exactly on an attractor consumed
    // this tick reached it and spawns `branches` tips at that attractor; any other extends by one tip.
    if(owners)for(let s=0;s<targets.length;s++)if(next.consumed[s]&&!consumed[s])newlyConsumed.add(`${targets[s][0]},${targets[s][1]}`);
    const nextOwners:number[]=[],nextSlots:number[]=[];
    next.segments.forEach(([x0,y0,x1,y1],k)=>{
      segments.push([x0,y0,x1,y1,tick]);
      if(!owners)return;
      parents.push(owners[k]);slots.push(ownerSlots[k]);
      const children=newlyConsumed.has(`${x1},${y1}`)?number(q,'branches'):1;
      for(let child=0;child<children;child++){nextOwners.push(base+k);nextSlots.push(children>1?child:0);}
    });
    if(owners&&(next.segments.length>owners.length||nextOwners.length!==next.tips.length))owners=undefined;
    else if(owners){owners=nextOwners;ownerSlots=nextSlots;}
    tips=next.tips as Point[];
    consumed=next.consumed;
    // All targets have been consumed; another native step would only discard tips.
    if(consumed.every(Boolean)){tips=[];break;}
    yield;
  }
  if(tips.length===0&&segments.length){
    // The ends of the final grown generation, not extinct branch offsets.
    const finalTick=segments.at(-1)![4];
    tips=segments.filter(segment=>segment[4]===finalTick).map(segment=>[segment[2],segment[3]]);
  }
  return {sources:targets,tips,segments,lineage:owners?{parents:Int32Array.from(parents),slots:Uint8Array.from(slots)}:undefined};
}
const cache=new Map<string,Model>();
function modelKey(q:Params,seed:number):string{return JSON.stringify([seed,...constructionKeys.map(key=>q[key])]);}
function store(key:string,value:Model):void{cache.delete(key);cache.set(key,value);if(cache.size>5)cache.delete(cache.keys().next().value!);}
/**
 * The cached growth for these construction values (the same keys the drawing uses; drawing
 * controls are not part of it). Callers must treat the result as immutable.
 */
export function growthModel(q:Params,seed:number):GrowthModel{
  validateAttractorGrowth(q);const key=modelKey(q,seed),hit=cache.get(key);if(hit)return hit;
  const iterator=replay(q,seed);let current=iterator.next();while(!current.done)current=iterator.next();store(key,current.value);return current.value;
}
/** Cooperatively replay the same steps as synchronous draw; canceled states are never published. */
export async function prepareGrowthModel(q:Params,seed:number,cancel:()=>boolean):Promise<boolean>{
  validateAttractorGrowth(q);const key=modelKey(q,seed);
  if(cancel())return false;if(cache.has(key))return true;
  const iterator=replay(q,seed);
  while(true){if(cancel())return false;const current=iterator.next();if(current.done){if(cancel())return false;store(key,current.value);return true;}await new Promise<void>(resolve=>setTimeout(resolve,0));}
}
export function prepareAttractorGrowth(layer:Layer,cancel:()=>boolean):Promise<boolean>{return prepareGrowthModel(layer.params,layer.seed,cancel);}
export function drawAttractorGrowth(p:Canvas,layer:Layer):void{
  const q=layer.params,m=growthModel(q,layer.seed);p.push();
  try{
    if(number(q,'weight')>0){p.noFill();p.stroke(...channels(layer.palette[0]));let previous=-1;
      for(const [x0,y0,x1,y1,generation] of m.segments){if(generation!==previous){p.strokeWeight(number(q,'weight')*number(q,'taper')**generation);previous=generation;}p.line(x0,y0,x1,y1);}
    }
    if(q.guides&&number(q,'guideSize')>0){p.noStroke();p.fill(...channels(layer.palette[2%layer.palette.length]),160);for(const [x,y] of m.sources)p.circle(x,y,number(q,'guideSize'));}
    if(q.terminals&&number(q,'terminalSize')>0){p.noStroke();p.fill(...channels(layer.palette[1%layer.palette.length]));for(const [x,y] of m.tips)p.circle(x,y,number(q,'terminalSize'));}
  }finally{p.pop();}
}
