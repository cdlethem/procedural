import {contactHistory2D, flockSteer2D, radiusPairs2D, sensorMotorStep2D} from '@procedurals/javascript';
import {JavaRandom} from '@procedurals/javascript/examples/city-marks/city-marks.js';
import type {Simulation} from '../composition/snapshots.js';

type Point = [number, number];
export type MotionSource = {count:number; sourceMode:string; centerX:number; centerY:number; extent:number; aspect:number; sourceAngle:number; disorder:number; speed:number};
export type MotionParams = MotionSource & {ticks:number; radius:number; linger:number; peaks:number; fieldSpread:number; fieldRadius:number; reach:number; gain:number; probeAngle:number; cohesion:number; alignment:number; separation:number};
export type ContactAgent = {id:number; x:number; y:number; vx:number; vy:number};
export type ContactModel = {agents:ContactAgent[]; contacts:{ids:number[]; activeTicks:number; missingTicks:number}[]};
export type SensorAgent = {position:Point; headingTurns:number; speed:number};
export type SensorModel = {agents:SensorAgent[]; paths:Point[][]; field:{values:number[]; columns:number; rows:number; origin:number[]; spacing:number[]; boundary:string}};
export type FlockBody = {point:Point; velocity:Point};
export type FlockModel = {bodies:FlockBody[]; trails:Point[][]; pairs:number[][]};

/** This budget bounds cumulative worst-case pair visits, not independent slider axes. */
const PAIR_BUDGET = 1_200_000;
const SENSOR_BUDGET = 90_000;
export function validateMotion(kind:'lingering-links'|'sensing-trails'|'flocking-marks',q:Record<string,unknown>):void {
  
  const finite=(key:string,min:number,max:number,integer=false)=>{
    const value=q[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw Error(`${key} outside motion source domain`);
    return value;
  };
  const count=finite('count',1,240,true),ticks=finite('ticks',0,240,true);
  if(typeof q.sourceMode!=='string'||!['area','ring','line'].includes(q.sourceMode))throw Error('Unknown motion source mode');
  finite('centerX',-2048,2048);finite('centerY',-2048,2048);
  finite('extent',0,2048);finite('aspect',0,20);finite('sourceAngle',-3600,3600);
  finite('disorder',0,1);finite('speed',0,20);finite('weight',0,20);
  if(kind==='sensing-trails'){
    finite('peaks',1,12,true);finite('fieldSpread',0,1024);finite('fieldRadius',1,640);
    finite('reach',0,640);finite('gain',-4,4);finite('probeAngle',0,.5);
    if(count*ticks*3> SENSOR_BUDGET)throw Error('Agent count × ticks exceeds sensor work budget');
  }else{
    finite('radius',0,1024);
    if(kind==='lingering-links')finite('linger',0,240,true);
    else {finite('cohesion',0,2);finite('alignment',0,2);finite('separation',0,2);}
    if(ticks*(count+count*(count-1)/2)>PAIR_BUDGET)throw Error('Agent count × ticks × pair visits exceeds motion work budget');
  }
}
export function motionSource(q:MotionSource,seed:number):{points:Point[]; velocities:Point[]; headings:number[]} {
  const random=new JavaRandom(seed), points:Point[]=[], velocities:Point[]=[], headings:number[]=[];
  const angle=q.sourceAngle*Math.PI/180, cs=Math.cos(angle),sn=Math.sin(angle);
  for(let i=0;i<q.count;i++){
    const u=random.nextDouble(),v=random.nextDouble(),headingRandom=random.nextDouble();
    let x:number,y:number;
    if(q.sourceMode==='ring'){
      const theta=2*Math.PI*u,radius=q.extent*(.38+.12*v);
      x=Math.cos(theta)*radius;y=Math.sin(theta)*radius*q.aspect;
    }else if(q.sourceMode==='line'){
      x=(u-.5)*q.extent;y=(v-.5)*q.extent*q.aspect*.08;
    }else{
      x=(u-.5)*q.extent;y=(v-.5)*q.extent*q.aspect;
    }
    points.push([q.centerX+x*cs-y*sn,q.centerY+x*sn+y*cs]);
    const heading=q.sourceAngle/360+q.disorder*(headingRandom-.5);
    headings.push(heading);
    velocities.push([q.speed*Math.cos(heading*2*Math.PI),q.speed*Math.sin(heading*2*Math.PI)]);
  }
  return {points,velocities,headings};
}

/** Separate random stream: changing agent count or appearance cannot move scalar peaks. */
export function scalarPeaks(q:Omit<MotionParams,'ticks'>,seed:number):SensorModel['field'] {
  const random=new JavaRandom(seed ^ 0x6b9a72d1), peaks:Point[]=[];
  for(let i=0;i<q.peaks;i++){
    const theta=random.nextDouble()*2*Math.PI, radial=Math.sqrt(random.nextDouble())*q.fieldSpread;
    peaks.push([q.centerX+radial*Math.cos(theta),q.centerY+radial*Math.sin(theta)]);
  }
  const values:number[]=[],sigma=2*q.fieldRadius*q.fieldRadius;
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const px=x*640/63,py=y*640/63;
    let value=0;
    for(const [cx,cy] of peaks)value+=Math.exp(-((px-cx)**2+(py-cy)**2)/sigma);
    values.push(value);
  }
  return {values,columns:64,rows:64,origin:[0,0],spacing:[640/63,640/63],boundary:'wrap'};
}

export type MotionKind = 'lingering-links'|'sensing-trails'|'flocking-marks';
/** What shapes a motion model; `ticks` is the step count and drawing controls never appear. */
export type MotionConstruction = Omit<MotionParams,'ticks'>;
const commonKeys=['count','sourceMode','centerX','centerY','extent','aspect','sourceAngle','disorder','speed'] as const;
const specificKeys:Record<MotionKind,readonly string[]>={
  'lingering-links':['radius','linger'],
  'sensing-trails':['peaks','fieldSpread','fieldRadius','reach','gain','probeAngle'],
  'flocking-marks':['radius','cohesion','alignment','separation'],
};
/** The construction parameters of a validated layer; palette, weights and mark toggles are not among them. */
export function motionConstruction(kind:MotionKind,q:MotionParams):MotionConstruction {
  return Object.fromEntries([...commonKeys,...specificKeys[kind]].map(key=>[key,q[key as keyof MotionParams]])) as MotionConstruction;
}

const pairWork=(q:MotionConstruction)=>q.count+q.count*(q.count-1)/2;
const positions=(agents:readonly {x:number,y:number}[]):Point[]=>agents.map(a=>[a.x,a.y]);

/** One tick per step: pairs from the current positions, contact memory, then motion. */
export const contactSimulation:Simulation<ContactModel,MotionConstruction,ContactModel>={
  id:'lingering-links',
  limits:q=>({stepLimit:240,workPerStep:pairWork(q)+2*q.count*q.count}),
  initial(ctx){
    const source=motionSource(ctx.params,ctx.seed);
    ctx.charge(ctx.params.count);
    return {agents:source.points.map(([x,y],i)=>({id:100+i,x,y,vx:source.velocities[i][0],vy:source.velocities[i][1]})),contacts:[]};
  },
  step(state,ctx){
    const q=ctx.params;
    const pairs=radiusPairs2D({points:positions(state.agents),radius:q.radius,maxWork:pairWork(q)}).pairs;
    const contacts=contactHistory2D({ids:state.agents.map(a=>a.id),pairs,contacts:state.contacts,lingerSteps:q.linger,maxWork:q.count*q.count*2}).contacts;
    ctx.charge(pairWork(q)+2*q.count*q.count);
    return {agents:state.agents.map(a=>({...a,x:a.x+a.vx,y:a.y+a.vy})),contacts};
  },
  project:state=>state,
};

/** One synchronized sensor/motor update per step; the scalar field is built once in the initial state. */
export const sensorSimulation:Simulation<SensorModel,MotionConstruction,SensorModel>={
  id:'sensing-trails',
  limits:q=>({stepLimit:240,workPerStep:q.count*3,initialWork:q.count+64*64*q.peaks}),
  initial(ctx){
    const q=ctx.params,source=motionSource(q,ctx.seed),field=scalarPeaks(q,ctx.seed);
    ctx.charge(q.count+64*64*q.peaks);
    const agents:SensorAgent[]=source.points.map((position,i)=>({position,headingTurns:source.headings[i],speed:q.speed}));
    return {agents,paths:agents.map(a=>[a.position]),field};
  },
  step(state,ctx){
    const q=ctx.params;
    const agents=sensorMotorStep2D({agents:state.agents,field:state.field,sensorDistance:q.reach,sensorAngleTurns:q.probeAngle,turnGain:q.gain,dt:1,maxWork:q.count*3}).agents;
    ctx.charge(q.count*3);
    const paths=state.paths;
    for(let i=0;i<agents.length;i++)paths[i].push(agents[i].position);
    return {agents,paths,field:state.field};
  },
  project:state=>state,
};

/** One synchronous steering tick per step. `pairs` always belongs to the current bodies (the final one links only actual proximity). */
export const flockSimulation:Simulation<FlockModel,MotionConstruction,FlockModel>={
  id:'flocking-marks',
  limits:q=>({stepLimit:240,workPerStep:2*pairWork(q)+2*q.count}),
  initial(ctx){
    const q=ctx.params,source=motionSource(q,ctx.seed);
    const bodies:FlockBody[]=source.points.map((point,i)=>({point,velocity:source.velocities[i]}));
    ctx.charge(pairWork(q)+q.count);
    return {bodies,trails:bodies.map(b=>[b.point]),pairs:radiusPairs2D({points:bodies.map(b=>b.point),radius:q.radius,maxWork:pairWork(q)}).pairs};
  },
  step(state,ctx){
    const q=ctx.params;
    const steering=flockSteer2D({points:state.bodies.map(b=>b.point),velocities:state.bodies.map(b=>b.velocity),pairs:state.pairs,
      cohesion:q.cohesion,alignment:q.alignment,separation:q.separation,maxSteer:.8,maxWork:q.count+state.pairs.length}).steering;
    const bodies=state.bodies.map((b,i)=>{
      let vx=b.velocity[0]+steering[i][0],vy=b.velocity[1]+steering[i][1];
      const speed=Math.hypot(vx,vy),cap=q.speed*2.5;
      if(speed>cap){vx*=cap/speed;vy*=cap/speed;}
      return {point:[b.point[0]+vx,b.point[1]+vy] as Point,velocity:[vx,vy] as Point};
    });
    for(let i=0;i<bodies.length;i++)state.trails[i].push(bodies[i].point);
    ctx.charge(q.count+state.pairs.length+pairWork(q));
    return {bodies,trails:state.trails,pairs:radiusPairs2D({points:bodies.map(b=>b.point),radius:q.radius,maxWork:pairWork(q)}).pairs};
  },
  project:state=>state,
};

export const motionSimulations:Record<MotionKind,Simulation<any,MotionConstruction,any>>={
  'lingering-links':contactSimulation,'sensing-trails':sensorSimulation,'flocking-marks':flockSimulation,
};
