import {contactHistory2D, flockSteer2D, radiusPairs2D, sensorMotorStep2D} from '@procedurals/javascript';
import {JavaRandom} from '@procedurals/javascript/examples/city-marks/city-marks.js';

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
export function scalarPeaks(q:MotionParams,seed:number):SensorModel['field'] {
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

/** Generators expose one original-core step at a time for cooperative preparation. */
export function* contactSteps(q:MotionParams,seed:number):Generator<void,ContactModel> {
  validateMotion('lingering-links',q);
  const source=motionSource(q,seed);
  let agents:ContactAgent[]=source.points.map(([x,y],i)=>({id:100+i,x,y,vx:source.velocities[i][0],vy:source.velocities[i][1]}));
  let contacts:ContactModel['contacts']=[];
  for(let tick=0;tick<q.ticks;tick++){
    const pairs=radiusPairs2D({points:agents.map(a=>[a.x,a.y]),radius:q.radius,maxWork:q.count+q.count*(q.count-1)/2}).pairs;
    contacts=contactHistory2D({ids:agents.map(a=>a.id),pairs,contacts,lingerSteps:q.linger,maxWork:q.count*q.count*2}).contacts;
    agents=agents.map(a=>({...a,x:a.x+a.vx,y:a.y+a.vy}));
    yield;
  }
  return {agents,contacts};
}
export function* sensorSteps(q:MotionParams,seed:number):Generator<void,SensorModel> {
  validateMotion('sensing-trails',q);
  const source=motionSource(q,seed),field=scalarPeaks(q,seed);
  let agents:SensorAgent[]=source.points.map((position,i)=>({position,headingTurns:source.headings[i],speed:q.speed}));
  const paths:Point[][]=agents.map(a=>[a.position]);
  for(let tick=0;tick<q.ticks;tick++){
    agents=sensorMotorStep2D({agents,field,sensorDistance:q.reach,sensorAngleTurns:q.probeAngle,turnGain:q.gain,dt:1,maxWork:q.count*3}).agents;
    for(let i=0;i<agents.length;i++)paths[i].push(agents[i].position);
    yield;
  }
  return {agents,paths,field};
}
export function* flockSteps(q:MotionParams,seed:number):Generator<void,FlockModel> {
  validateMotion('flocking-marks',q);
  const source=motionSource(q,seed);
  let bodies:FlockBody[]=source.points.map((point,i)=>({point,velocity:source.velocities[i]}));
  const trails:Point[][]=bodies.map(b=>[b.point]);
  let pairs:number[][]=[];
  for(let tick=0;tick<q.ticks;tick++){
    pairs=radiusPairs2D({points:bodies.map(b=>b.point),radius:q.radius,maxWork:q.count+q.count*(q.count-1)/2}).pairs;
    const steering=flockSteer2D({points:bodies.map(b=>b.point),velocities:bodies.map(b=>b.velocity),pairs,
      cohesion:q.cohesion,alignment:q.alignment,separation:q.separation,maxSteer:.8,maxWork:q.count+pairs.length}).steering;
    bodies=bodies.map((b,i)=>{
      let vx=b.velocity[0]+steering[i][0],vy=b.velocity[1]+steering[i][1];
      const speed=Math.hypot(vx,vy),cap=q.speed*2.5;
      if(speed>cap){vx*=cap/speed;vy*=cap/speed;}
      return {point:[b.point[0]+vx,b.point[1]+vy] as Point,velocity:[vx,vy] as Point};
    });
    for(let i=0;i<bodies.length;i++)trails[i].push(bodies[i].point);
    yield;
  }
  // Link only agents in actual proximity at the visible final state.
  pairs=radiusPairs2D({points:bodies.map(b=>b.point),radius:q.radius,maxWork:q.count+q.count*(q.count-1)/2}).pairs;
  return {bodies,trails,pairs};
}

export function motionKey(kind:string,q:MotionParams,seed:number):string {
  const common=[kind,seed,q.ticks,q.count,q.sourceMode,q.centerX,q.centerY,q.extent,q.aspect,q.sourceAngle,q.disorder,q.speed];
  const specific=kind==='lingering-links'?[q.radius,q.linger]:kind==='sensing-trails'?[q.peaks,q.fieldSpread,q.fieldRadius,q.reach,q.gain,q.probeAngle]:[q.radius,q.cohesion,q.alignment,q.separation];
  return JSON.stringify([...common,...specific]);
}
