import {advectPeriodicScalar2D, diffusePeriodicScalar2D, marchingSquares2D, projectPeriodicVelocity2D} from '@procedurals/javascript';
import {JavaRandom} from '@procedurals/javascript/examples/city-marks/city-marks.js';
import type {Layer} from '../types.js';
import {channels, numeric, toggle, choice, type StudioDefinition} from './types.js';

/** Fixed 64² periodic simulation lattice; the independent footprint below is only its display transform. */
export const FLUID_GRID = 64;
const CELLS = FLUID_GRID * FLUID_GRID;
const PRESSURE_ITERATIONS = 32;
const BASE_STEP_WORK = 3 + 6 + 2 + 9;
const WORK_BUDGET = 18_000_000;
const DT = .4;
const grid = {columns: FLUID_GRID, rows: FLUID_GRID};

export type FluidParams = {
  ticks:number; injection:number; viscosity:number; projection:boolean; texture:boolean; contours:boolean;
  sourceCount:number; sourceX:number; sourceY:number; sourceSpread:number; sourceSize:number; sourceAspect:number; sourceAngle:number;
  stripeSpacing:number; stripeAngle:number; direction:number; drift:number; waveStrength:number;
  vortexCount:number; vortexX:number; vortexY:number; vortexSpread:number; vortexRadius:number; vortexPolarity:string;
  footprintX:number; footprintY:number; footprintWidth:number; footprintHeight:number;
  pigment:boolean; contourThreshold:number; contourSpacing:number; contourWeight:number;
};
export type FluidState = {u:number[];v:number[];dyes:number[][]};
export type FluidSource = {x:number;y:number;radius:number;angle:number;channel:number};
export type FluidVortex = {x:number;y:number;radius:number;sign:number};

export const fluidInstrumentDefinitions:StudioDefinition[]=[{
  id:'dye-currents',title:'Dye currents',description:'Compose compact seeded dye deposits and periodic currents; display them in an independent footprint.',
  procedure: "Deposit dye in a few elliptical patches on a periodic 64 by 64 grid, optionally striped, with vortices and drift supplying a velocity field. Advect and diffuse the dye for a set number of frames, then draw blended pigment pixels and measured contour lines.",
  parameters:[
    numeric('ticks','Frames','Advance periodic transport, diffusion and optional pressure projection.',0,75,1,{hardMin:0,hardMax:120,integer:true}),
    numeric('sourceCount','Dye sources','Independent deposits, cycling among three pigment channels.',1,8,1,{hardMin:0,hardMax:24,integer:true}),
    numeric('sourceX','Source X','Deposit group center, in 64-cell simulation coordinates.',0,64,.5,{hardMin:-512,hardMax:512}),
    numeric('sourceY','Source Y','Deposit group center, in simulation coordinates.',0,64,.5,{hardMin:-512,hardMax:512}),
    numeric('sourceSpread','Source spread','Radius of seeded deposit-center scattering in simulation cells.',0,24,.5,{hardMin:0,hardMax:256}),
    numeric('sourceSize','Source size','Approximate radius of each compact dye deposit in cells.',1,20,.5,{hardMin:0,hardMax:128}),
    numeric('sourceAspect','Source aspect','Vertical radius relative to horizontal radius, before rotation.',.25,3,.05,{hardMin:.05,hardMax:16}),
    numeric('sourceAngle','Source angle','Rotation of deposit ellipses in degrees.',-180,180,1,{hardMin:-3600,hardMax:3600}),
    toggle('texture','Stripe source','Stripe the deposits before transport, inside their compact support.'),
    numeric('stripeSpacing','Stripe spacing','Stripe period in simulation cells.',2,20,.5,{hardMin:.25,hardMax:128}),
    numeric('stripeAngle','Stripe angle','Stripe direction in degrees, independent of deposit orientation.',-180,180,1,{hardMin:-3600,hardMax:3600}),
    numeric('direction','Drift direction','Angle of the uniform initial flow in degrees.',-180,180,1,{hardMin:-3600,hardMax:3600}),
    numeric('drift','Drift','Uniform initial velocity in simulation cells per step.',0,3,.05,{hardMin:0,hardMax:8}),
    numeric('waveStrength','Periodic waves','Strength of seeded-phase, periodic cross-currents.',0,3,.05,{hardMin:0,hardMax:8}),
    numeric('vortexCount','Vortices','Seeded local force centers; zero leaves only the initial current.',0,6,1,{hardMin:0,hardMax:24,integer:true}),
    numeric('vortexX','Vortex X','Force group center in simulation coordinates.',0,64,.5,{hardMin:-512,hardMax:512}),
    numeric('vortexY','Vortex Y','Force group center in simulation coordinates.',0,64,.5,{hardMin:-512,hardMax:512}),
    numeric('vortexSpread','Vortex spread','Radius of seeded force-center scattering in cells.',0,28,.5,{hardMin:0,hardMax:256}),
    numeric('vortexRadius','Vortex radius','Radius of each compact force region in cells.',1,28,.5,{hardMin:.25,hardMax:128}),
    choice('vortexPolarity','Vortex polarity','All forces share the signed injection, or successive vortices oppose it.',['same','alternating']),
    numeric('injection','Injection','Signed rotational acceleration: reverse sign to reverse circulation.',-.4,.4,.01,{hardMin:-2,hardMax:2}),
    numeric('viscosity','Viscosity','Explicit velocity diffusion (the stable core domain is 0–0.25).',0,.24,.01,{hardMin:0,hardMax:.25}),
    toggle('projection','Projection','Solve pressure after forcing/diffusion, before dye transport.'),
    numeric('footprintX','Footprint X','Horizontal display center in canvas coordinates, independent of source center.',0,640,1,{hardMin:-4096,hardMax:4096}),
    numeric('footprintY','Footprint Y','Vertical display center in canvas coordinates.',0,640,1,{hardMin:-4096,hardMax:4096}),
    numeric('footprintWidth','Footprint width','Display width of the periodic simulation.',64,640,1,{hardMin:1,hardMax:4096}),
    numeric('footprintHeight','Footprint height','Display height of the periodic simulation.',64,640,1,{hardMin:1,hardMax:4096}),
    toggle('pigment','Pigment','Show the transported three-channel dye as transparent pixels.'),
    toggle('contours','Contours','Draw independently optional concentration isolines.'),
    numeric('contourThreshold','First contour','Starting concentration for five isolines per pigment.',.02,.8,.01,{hardMin:.001,hardMax:3}),
    numeric('contourSpacing','Contour spacing','Concentration increment between isolines.',.02,.35,.01,{hardMin:.001,hardMax:3}),
    numeric('contourWeight','Contour weight','Zero suppresses all contour strokes, even if contours are enabled.',0,4,.1,{hardMin:0,hardMax:20}),
  ],
  controlGroups:[
    {label:'Dye sources',stage:'form',controls:['sourceCount','sourceX','sourceY','sourceSpread',
      {label:'Shape',controls:['sourceSize','sourceAspect','sourceAngle']},
      {label:'Stripes',controls:['texture','stripeSpacing','stripeAngle']}]},
    {label:'Currents',stage:'process',controls:['direction','drift','waveStrength']},
    {label:'Vortices',stage:'process',controls:['vortexCount','vortexX','vortexY','vortexSpread','vortexRadius','vortexPolarity','injection']},
    {label:'Simulation',stage:'process',controls:['ticks','viscosity','projection']},
    {label:'Placement',stage:'frame',controls:['footprintX','footprintY',{label:'Size',controls:['footprintWidth','footprintHeight'],proportional:true}]},
    {label:'Display',stage:'material',controls:['pigment',
      {label:'Contours',controls:['contours','contourThreshold','contourSpacing','contourWeight']}]},
  ],
  defaults:{ticks:26,
    injection:.18,
    viscosity:.01,
    projection:true,
    texture:false,
    contours:true,
    sourceCount:3,
    sourceX:32,
    sourceY:32,
    sourceSpread:13,
    sourceSize:8,
    sourceAspect:.9,
    sourceAngle:-25,
    stripeSpacing:6,
    stripeAngle:30,
    direction:-25,
    drift:.35,
    waveStrength:.8,
    vortexCount:2,
    vortexX:32,
    vortexY:32,
    vortexSpread:10,
    vortexRadius:15,
    vortexPolarity:'alternating',
    footprintX:320,
    footprintY:320,
    footprintWidth:530,
    footprintHeight:530,
    pigment:true,
    contourThreshold:.1,
    contourSpacing:.12,
    contourWeight:.8},
  validate:validateFluidInstrument,
}];

export function validateFluidInstrument(params:Layer['params']):void {
  
  const definition=fluidInstrumentDefinitions[0];
  for(const parameter of definition.parameters){
    const value=params[parameter.key];
    if(parameter.type==='number' && (typeof value!=='number'||!Number.isFinite(value)||value<(parameter.hardMin??-Infinity)||value>(parameter.hardMax??Infinity)||(parameter.integer&&!Number.isSafeInteger(value))))throw Error(`Invalid ${parameter.key}`);
    if(parameter.type==='boolean'&&typeof value!=='boolean')throw Error(`Invalid ${parameter.key}`);
    if(parameter.type==='select'&&!parameter.options?.some(option=>option.value===value))throw Error(`Invalid ${parameter.key}`);
  }
  const q=params as unknown as FluidParams;
  const work=q.sourceCount*CELLS+q.ticks*CELLS*(BASE_STEP_WORK+(q.projection?PRESSURE_ITERATIONS:0)+q.vortexCount);
  if(work>WORK_BUDGET)throw Error('Fluid ticks × cells × pressure-iteration/force work budget exceeded');
}

/** Source geometry is in simulation cells, never canvas pixels. Prefixes are stable as count grows. */
export function fluidSources(q:FluidParams,seed:number):FluidSource[]{
  const random=new JavaRandom(seed^0x5da71e);
  const sources:FluidSource[]=[];
  for(let k=0;k<q.sourceCount;k++){
    const angle=random.nextDouble()*2*Math.PI, distance=q.sourceSpread*Math.sqrt(random.nextDouble());
    sources.push({x:q.sourceX+distance*Math.cos(angle),y:q.sourceY+distance*Math.sin(angle),
      radius:q.sourceSize*(.8+.4*random.nextDouble()),angle:q.sourceAngle*Math.PI/180,channel:k%3});
  }
  return sources;
}
export function fluidVortices(q:FluidParams,seed:number):FluidVortex[]{
  const random=new JavaRandom(seed^0x217dd2);
  const vortices:FluidVortex[]=[];
  for(let k=0;k<q.vortexCount;k++){
    const angle=random.nextDouble()*2*Math.PI,distance=q.vortexSpread*Math.sqrt(random.nextDouble());
    vortices.push({x:q.vortexX+distance*Math.cos(angle),y:q.vortexY+distance*Math.sin(angle),
      radius:q.vortexRadius*(.85+.3*random.nextDouble()),sign:q.vortexPolarity==='alternating'&&k%2?-1:1});
  }
  return vortices;
}
export function initialFluidInstrument(q:FluidParams,seed:number):FluidState{
  const dyes=[new Array<number>(CELLS).fill(0),new Array<number>(CELLS).fill(0),new Array<number>(CELLS).fill(0)];
  const u=new Array<number>(CELLS),v=new Array<number>(CELLS);
  const sources=fluidSources(q,seed).map(source=>({source,cos:Math.cos(source.angle),sin:Math.sin(source.angle)}));
  const phase=new JavaRandom(seed^0x3a7f0c),waveX=phase.nextDouble()*2*Math.PI,waveY=phase.nextDouble()*2*Math.PI;
  const heading=q.direction*Math.PI/180, baseU=q.drift*Math.cos(heading),baseV=q.drift*Math.sin(heading);
  const stripeAngle=q.stripeAngle*Math.PI/180,sc=-Math.sin(stripeAngle),ss=Math.cos(stripeAngle);
  const waveV=new Array<number>(FLUID_GRID);
  for(let x=0;x<FLUID_GRID;x++)waveV[x]=q.waveStrength*Math.sin(2*Math.PI*x/FLUID_GRID+waveX);
  for(let y=0;y<FLUID_GRID;y++){
    const rowWave=q.waveStrength*Math.sin(2*Math.PI*y/FLUID_GRID+waveY);
    for(let x=0;x<FLUID_GRID;x++){
      const i=y*FLUID_GRID+x;
      u[i]=baseU+rowWave;
      v[i]=baseV+waveV[x];
      for(const {source,cos,sin} of sources){
        if(source.radius===0)continue;
        const dx=((x+.5-source.x+FLUID_GRID/2)%FLUID_GRID+FLUID_GRID)%FLUID_GRID-FLUID_GRID/2;
        const dy=((y+.5-source.y+FLUID_GRID/2)%FLUID_GRID+FLUID_GRID)%FLUID_GRID-FLUID_GRID/2;
        const ex=(dx*cos+dy*sin)/source.radius,ey=(-dx*sin+dy*cos)/(source.radius*q.sourceAspect);
        const r2=ex*ex+ey*ey;
        if(r2>=1)continue;
        const support=(1-r2)*(1-r2);
        const stripe=q.texture?(.12+.88*(.5+.5*Math.cos(2*Math.PI*(dx*sc+dy*ss)/q.stripeSpacing))**3):1;
        dyes[source.channel][i]+=support*stripe;
      }
    }
  }
  return {u,v,dyes};
}
/** MAC offsets and synchronous old-velocity transport match the installed dye-currents solver. */
export function stepFluidInstrument(old:FluidState,q:FluidParams,vortices:FluidVortex[]):FluidState{
  const transport={...grid,u:old.u,v:old.v,dt:DT,maxWork:3*CELLS};
  let u=advectPeriodicScalar2D({...transport,values:old.u,offset:[.5,0]}).values;
  let v=advectPeriodicScalar2D({...transport,values:old.v,offset:[0,.5]}).values;
  if(q.injection!==0)for(let y=0;y<FLUID_GRID;y++)for(let x=0;x<FLUID_GRID;x++){
    const i=y*FLUID_GRID+x;
    for(const vortex of vortices){
      // The force is compactly supported; periodic distance respects seam-adjacent cells.
      const dx=((x+.5-vortex.x+FLUID_GRID/2)%FLUID_GRID+FLUID_GRID)%FLUID_GRID-FLUID_GRID/2;
      const dy=((y+.5-vortex.y+FLUID_GRID/2)%FLUID_GRID+FLUID_GRID)%FLUID_GRID-FLUID_GRID/2;
      const distance=dx*dx+dy*dy, r2=distance/(vortex.radius*vortex.radius);
      if(r2>=1)continue;
      const force=q.injection*vortex.sign*(1-r2)*(1-r2)/Math.max(1,vortex.radius);
      u[i]-=force*dy;v[i]+=force*dx;
    }
  }
  u=diffusePeriodicScalar2D({...grid,values:u,rate:q.viscosity,retention:1,maxWork:CELLS}).values;
  v=diffusePeriodicScalar2D({...grid,values:v,rate:q.viscosity,retention:1,maxWork:CELLS}).values;
  const projected=projectPeriodicVelocity2D({...grid,u,v,iterations:q.projection?PRESSURE_ITERATIONS:0,maxWork:CELLS*(PRESSURE_ITERATIONS+3)});
  const dyes=old.dyes.map(values=>advectPeriodicScalar2D({...grid,values,u:projected.u,v:projected.v,offset:[0,0],dt:DT,maxWork:3*CELLS}).values);
  return {u:projected.u,v:projected.v,dyes};
}
const structuralKeys=['ticks','sourceCount','sourceX','sourceY','sourceSpread','sourceSize','sourceAspect','sourceAngle',
  'texture','stripeSpacing','stripeAngle','direction','drift','waveStrength','vortexCount','vortexX','vortexY',
  'vortexSpread','vortexRadius','vortexPolarity','injection','viscosity','projection'] as const;
export function fluidModelKey(q:FluidParams,seed:number):string{return JSON.stringify([seed,...structuralKeys.map(key=>q[key])]);}
const cache=new Map<string,FluidState>();
function completed(key:string,state:FluidState):void{cache.delete(key);cache.set(key,state);if(cache.size>4)cache.delete(cache.keys().next().value!);}
function model(l:Layer):FluidState{
  validateFluidInstrument(l.params);
  const q=l.params as unknown as FluidParams,key=fluidModelKey(q,l.seed),hit=cache.get(key);
  if(hit){completed(key,hit);return hit;}
  let current=initialFluidInstrument(q,l.seed);const vortices=fluidVortices(q,l.seed);
  for(let tick=0;tick<q.ticks;tick++)current=stepFluidInstrument(current,q,vortices);
  completed(key,current);return current;
}
/** Completed models only are published; cancellation cannot expose partial state to drawing. */
export async function prepareFluidInstrument(layer:Layer,isCancelled:()=>boolean):Promise<boolean>{
  validateFluidInstrument(layer.params);
  if(isCancelled())return false;
  const q=layer.params as unknown as FluidParams,key=fluidModelKey(q,layer.seed);
  if(cache.has(key))return true;
  let current=initialFluidInstrument(q,layer.seed);const vortices=fluidVortices(q,layer.seed);
  for(let tick=0;tick<q.ticks;tick++){
    if(isCancelled())return false;
    current=stepFluidInstrument(current,q,vortices);
    if(tick+1<q.ticks)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  if(isCancelled())return false;
  completed(key,current);return true;
}

type CanvasImage={pixels:Uint8ClampedArray;loadPixels:()=>void;updatePixels:()=>void};
type FluidCanvas={createImage:(width:number,height:number)=>CanvasImage;image:(image:CanvasImage,x:number,y:number,width:number,height:number)=>void;
  noFill:()=>void;stroke:(red:number,green:number,blue:number,alpha:number)=>void;strokeWeight:(weight:number)=>void;
  line:(x1:number,y1:number,x2:number,y2:number)=>void};
export function drawFluidInstrument(p:FluidCanvas,l:Layer):void{
  const q=l.params as unknown as FluidParams,state=model(l),inks=[channels(l.palette[2%l.palette.length]),channels(l.palette[4%l.palette.length]),channels(l.palette[1%l.palette.length])];
  const left=q.footprintX-q.footprintWidth/2,top=q.footprintY-q.footprintHeight/2;
  if(q.pigment){
    const image=p.createImage(FLUID_GRID,FLUID_GRID);image.loadPixels();
    for(let i=0;i<CELLS;i++){
      const a=Math.min(1,Math.max(0,state.dyes[0][i])),b=Math.min(1,Math.max(0,state.dyes[1][i])),c=Math.min(1,Math.max(0,state.dyes[2][i]));
      const total=a+b+c;
      if(total===0)continue;
      for(let channel=0;channel<3;channel++)image.pixels[i*4+channel]=Math.round((a*inks[0][channel]+b*inks[1][channel]+c*inks[2][channel])/total);
      image.pixels[i*4+3]=Math.round(255*Math.min(.98,total*1.7));
    }
    image.updatePixels();p.image(image,left,top,q.footprintWidth,q.footprintHeight);
  }
  if(q.contours&&q.contourWeight>0){
    p.noFill();p.strokeWeight(q.contourWeight);
    for(let k=0;k<3;k++){
      p.stroke(...inks[k],170);
      for(let level=0;level<5;level++){
        const threshold=q.contourThreshold+q.contourSpacing*level;
        const lines=marchingSquares2D({values:state.dyes[k],...grid,
          origin:[left+q.footprintWidth/(2*FLUID_GRID),top+q.footprintHeight/(2*FLUID_GRID)],
          spacing:[q.footprintWidth/FLUID_GRID,q.footprintHeight/FLUID_GRID],threshold,maxWork:2*CELLS}).segments;
        for(const segment of lines)p.line(segment[0],segment[1],segment[2],segment[3]);
      }
    }
  }
}
