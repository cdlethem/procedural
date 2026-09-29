import {elasticCurveGrowStep2D, insertSegmentBridge2D, radiusPairs2D, relativeNeighborhoodPairs2D, thresholdEdgeRelaxation2D} from '@procedurals/javascript';
import {JavaRandom} from '@procedurals/javascript/examples/city-marks/city-marks.js';
import type {ControlGroup, Layer} from '../types.js';
import {channels, choice, numeric, toggle, type StudioDefinition} from './types.js';

type Point = [number, number];
type Kind = 'bridge-web' | 'neighborhood-growth' | 'elastic-loops';
type Settings = Record<string, number | string | boolean>;
type Canvas = {push():void; pop():void; scale(value:number):void; noFill():void; noStroke():void; stroke(...values:number[]):void; fill(...values:number[]):void; strokeWeight(value:number):void; line(x1:number,y1:number,x2:number,y2:number):void; circle(x:number,y:number,diameter:number):void};
type Graph = {nodes:{id:number;point:Point}[];edges:{id:number;a:number;b:number}[];nextNodeId:number;nextEdgeId:number};
type BridgeModel = {graph:Graph;kinds:Map<number,'strand'|'bridge'>;candidate:[Point,Point]};
type NeighborhoodModel = {seed:Point[];points:Point[];pairs:number[][]};
type ElasticNode = {id:number;position:Point;velocity:Point;pinned:boolean};
type ElasticCurve = {id:number;closed:boolean;nodeIds:number[];edgeIds:number[];restLengths:number[];restTurns:number[]};
type ElasticState = {nodes:ElasticNode[];curves:ElasticCurve[];nextNodeId:number;nextEdgeId:number};
type ElasticModel = {seed:ElasticState;state:ElasticState};
type Model = BridgeModel | NeighborhoodModel | ElasticModel;

const sourcePosition=[
  numeric('centerX','Source X','Source center in canvas coordinates.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('centerY','Source Y','Source center in canvas coordinates.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('direction','Source direction','Rotate the construction about its center in degrees.',-180,180,1,{hardMin:-3600,hardMax:3600}),
];
const bridgeControls=[
  numeric('ticks','Bridges','Replay this many candidate insertions.',0,18,1,{hardMin:0,hardMax:80,integer:true}),
  numeric('strandCount','Strands','Parallel starting strands.',2,10,1,{hardMin:2,hardMax:32,integer:true}),
  numeric('sourcePoints','Strand joints','Ordered joints per starting strand.',2,9,1,{hardMin:2,hardMax:40,integer:true}),
  numeric('span','Source span','Length of each strand along the source direction.',20,560,1,{hardMin:1,hardMax:2048}),
  numeric('spacing','Strand spacing','Distance between neighboring strand axes.',5,100,1,{hardMin:0.01,hardMax:1024}),
  numeric('strain','Common bend','Shared seeded curve across all strands.',0,75,1,{hardMin:0,hardMax:512}),
  numeric('disorder','Strand disorder','Bounded individual deviation, always smaller than the gap.',0,1,.01,{hardMin:0,hardMax:1}),
  ...sourcePosition,
  numeric('slant','Candidate slant','Signed longitudinal tilt across the strand field.',-100,100,1,{hardMin:-2048,hardMax:2048}),
  numeric('stride','Gap stride','Advance the selected gap modulo strands minus one.',1,10,1,{hardMin:1,hardMax:1000,integer:true}),
  numeric('bridgeSpacing','Bridge spacing','Distance between successive candidate positions along the source.',2,48,1,{hardMin:0.01,hardMax:1024}),
  numeric('bridgeAdvance','Bridge start','Initial candidate offset from the beginning of the source.',0,70,1,{hardMin:0,hardMax:2048}),
  numeric('candidateDisorder','Candidate disorder','Seeded displacement of each candidate within its spacing.',0,1,.01,{hardMin:0,hardMax:1}),
  numeric('sourceWeight','Strand weight','Independent initial-strand stroke thickness.',0,5,.1,{hardMin:0,hardMax:20}),
  numeric('bridgeWeight','Bridge weight','Independent inserted-bridge stroke thickness.',0,5,.1,{hardMin:0,hardMax:20}),
  toggle('nodes','Node marks','Mark graph joints separately from strokes.'),
  numeric('nodeSize','Node diameter','Diameter of optional graph nodes.',0,8,.2,{hardMin:0,hardMax:40}),
  toggle('candidate','Candidate guide','Show the next proposed segment; never changes the graph.'),
];
const neighborhoodControls=[
  numeric('ticks','Ticks','Relax the graph and judge proposals.',0,20,1,{hardMin:0,hardMax:90,integer:true}),
  numeric('count','Initial points','Seeded starting population.',2,40,1,{hardMin:1,hardMax:90,integer:true}),
  choice('sourceMode','Source shape','Initial area, ring or line.',['area','ring','line']),
  numeric('extent','Source extent','Width or diameter of the initial population.',0,500,1,{hardMin:0,hardMax:2048}),
  numeric('aspect','Source aspect','Vertical-to-horizontal source extent before rotation.',0,2,.05,{hardMin:0,hardMax:20}),
  ...sourcePosition,
  numeric('disorder','Source disorder','Radial or transverse irregularity in the starting ring/line.',0,1,.01,{hardMin:0,hardMax:1}),
  numeric('poolSize','Proposal count','Independently seeded candidate pool.',0,180,1,{hardMin:0,hardMax:1000,integer:true}),
  numeric('poolCenterX','Pool X','Independent proposal center.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('poolCenterY','Pool Y','Independent proposal center.',0,640,1,{hardMin:-2048,hardMax:2048}),
  numeric('poolExtent','Pool extent','Width and height of the proposal region.',0,600,1,{hardMin:0,hardMax:2048}),
  numeric('densityRadius','Density radius','Existing points counted inside this radius for admission.',0,160,1,{hardMin:0,hardMax:2048}),
  toggle('chain','Open chain','Use adjacent-index links instead of exact relative neighbors.'),
  numeric('minLength','Length threshold','Edges no longer than this do not move nodes.',0,100,1,{hardMin:0,hardMax:2048}),
  numeric('step','Relaxation step','Strength of synchronous motion along eligible edges.',0,1,.05,{hardMin:0,hardMax:1}),
  numeric('insert','Insert per tick','Maximum accepted proposals per tick.',0,4,1,{hardMin:0,hardMax:30,integer:true}),
  numeric('minNeighbors','Min neighbors','Minimum nearby existing points for admission.',0,5,1,{hardMin:0,hardMax:90,integer:true}),
  numeric('maxNeighbors','Max neighbors','Maximum nearby existing points for admission.',0,12,1,{hardMin:0,hardMax:90,integer:true}),
  toggle('graphMarks','Graph lines','Draw current neighborhood edges.'),
  numeric('graphWeight','Graph weight','Graph line thickness; zero removes graph strokes.',0,5,.1,{hardMin:0,hardMax:20}),
  toggle('nodeMarks','Nodes','Draw current point population.'),
  numeric('dotSize','Dot diameter','Independent node diameter.',0,12,.2,{hardMin:0,hardMax:40}),
  toggle('traces','Displacement traces','Connect initial positions to their current positions.'),
  numeric('traceWeight','Trace weight','Independent displacement-line weight.',0,4,.1,{hardMin:0,hardMax:20}),
];
const elasticControls=[
  numeric('ticks','Ticks','Advance material growth and refinement.',0,16,1,{hardMin:0,hardMax:60,integer:true}),
  numeric('strandCount','Sources','Number of separate filaments or concentric rings.',1,5,1,{hardMin:1,hardMax:12,integer:true}),
  numeric('sourcePoints','Source joints','Ordered points per filament or ring.',3,12,1,{hardMin:2,hardMax:36,integer:true}),
  choice('sourceMode','Source topology','Separate open filaments or closed concentric loops.',['open','ring']),
  numeric('length','Filament length','Open-source span.',20,550,1,{hardMin:1,hardMax:2048}),
  numeric('radius','Inner radius','Radius of the innermost ring.',8,240,1,{hardMin:0.01,hardMax:1024}),
  numeric('separation','Source separation','Gap between neighboring filaments or radii.',5,110,1,{hardMin:0,hardMax:1024}),
  numeric('bend','Source bend','Shared seeded smooth displacement of the initial curves.',0,70,1,{hardMin:0,hardMax:512}),
  numeric('disorder','Source disorder','Independent bounded deviation, without crossing the starting strands.',0,1,.01,{hardMin:0,hardMax:1}),
  ...sourcePosition,
  choice('pinning','Pinning','Anchor no nodes, first nodes, or both ends of open filaments.',['first','both','none']),
  numeric('growth','Growth','Rate of material rest-length increase.',0,.04,.002,{hardMin:0,hardMax:.3}),
  numeric('curl','Curl','Signed bend-target rate.',-.15,.15,.01,{hardMin:-1,hardMax:1}),
  numeric('windX','Horizontal wind','Horizontal acceleration.',-2,2,.25,{hardMin:-10,hardMax:10}),
  numeric('windY','Vertical wind','Vertical acceleration.',-2,2,.25,{hardMin:-10,hardMax:10}),
  numeric('range','Avoidance range','Contact distance between nonincident segments.',0,120,1,{hardMin:0,hardMax:1024}),
  numeric('strength','Avoidance strength','Repulsion inside the contact range.',0,24,1,{hardMin:0,hardMax:100}),
  numeric('refineLength','Refinement length','Maximum segment length before midpoint refinement.',12,95,1,{hardMin:1,hardMax:2048}),
  numeric('nodeCap','Node cap','Maximum nodes after refinement; jointly budgeted with ticks.',18,110,1,{hardMin:2,hardMax:300,integer:true}),
  numeric('weight','Line weight','One independent line thickness; zero removes all line strokes.',0,7,.1,{hardMin:0,hardMax:20}),
  toggle('seedGuides','Seed guides','Show the original source geometry.'),
  toggle('structure','Structure nodes','Reveal current node positions.'),
  toggle('endpoints','Endpoints','Mark open endpoints or the first vertex of each ring.'),
  numeric('nodeSize','Node diameter','Diameter of optional structure and endpoint nodes.',0,12,.2,{hardMin:0,hardMax:40}),
];
const bridgeGroups:ControlGroup[]=[
  {label:'Strands',controls:['strandCount','sourcePoints','span','spacing','strain','disorder']},
  {label:'Placement',controls:['centerX','centerY','direction']},
  {label:'Bridges',controls:['ticks','stride','slant','bridgeSpacing','bridgeAdvance','candidateDisorder']},
  {label:'Drawing',controls:[{label:'Line weights',controls:['sourceWeight','bridgeWeight'],proportional:true},'nodes','nodeSize','candidate']},
];
const neighborhoodGroups:ControlGroup[]=[
  {label:'Source',controls:['sourceMode','count','disorder']},
  {label:'Placement',controls:['centerX','centerY','extent','aspect','direction']},
  {label:'Proposals',controls:['poolSize','poolCenterX','poolCenterY','poolExtent']},
  {label:'Growth',controls:['ticks','insert','densityRadius','minNeighbors','maxNeighbors',{label:'Relaxation',controls:['chain','minLength','step']}]},
  {label:'Drawing',controls:[
    {label:'Graph',controls:['graphMarks','graphWeight']},
    {label:'Nodes',controls:['nodeMarks','dotSize']},
    {label:'Traces',controls:['traces','traceWeight']},
  ]},
];
const elasticGroups:ControlGroup[]=[
  {label:'Sources',controls:['sourceMode','strandCount','sourcePoints','length','radius','separation','bend','disorder']},
  {label:'Placement',controls:['centerX','centerY','direction']},
  {label:'Growth',controls:['ticks','pinning','growth','curl',
    {label:'Wind',controls:['windX','windY']},
    {label:'Avoidance',controls:['range','strength']},
    {label:'Refinement',controls:['refineLength','nodeCap']}]},
  {label:'Drawing',controls:['weight','seedGuides','structure','endpoints','nodeSize']},
];
export const growthInstrumentDefinitions:StudioDefinition[]=[
  {id:'bridge-web',title:'Bridge web',description:'Seed parallel strands, then select crossings that split and link their graph.',controlGroups:bridgeGroups,parameters:bridgeControls,defaults:{ticks:10, strandCount:6, sourcePoints:6, span:400, spacing:56, strain:24, disorder:.35, centerX:320, centerY:320, direction:90, slant:21, stride:5, bridgeSpacing:32, bridgeAdvance:42, candidateDisorder:.2, sourceWeight:1.25, bridgeWeight:2.4, nodes:false, nodeSize:3, candidate:false},validate:q=>validateGrowthInstrument('bridge-web',q)},
  {id:'neighborhood-growth',title:'Neighborhood growth',description:'Construct seeded populations and grow a density-filtered exact local graph.',controlGroups:neighborhoodGroups,parameters:neighborhoodControls,defaults:{ticks:8, count:22, sourceMode:'ring', extent:195, aspect:.9, centerX:320, centerY:320, direction:0, disorder:.55, poolSize:140, poolCenterX:320, poolCenterY:320, poolExtent:340, densityRadius:64, chain:false, minLength:22, step:.4, insert:2, minNeighbors:1, maxNeighbors:5, graphMarks:true, graphWeight:1.15, nodeMarks:true, dotSize:4, traces:false, traceWeight:.6},validate:q=>validateGrowthInstrument('neighborhood-growth',q)},
  {id:'elastic-loops',title:'Elastic loops',description:'Grow seeded filaments or concentric rings through noncrossing material dynamics.',controlGroups:elasticGroups,parameters:elasticControls,defaults:{ticks:7, strandCount:3, sourcePoints:6, sourceMode:'open', length:335, radius:75, separation:72, bend:19, disorder:.4, centerX:320, centerY:320, direction:90, pinning:'first', growth:.018, curl:.045, windX:.1, windY:0, range:42, strength:8, refineLength:70, nodeCap:72, weight:2.1, seedGuides:false, structure:false, endpoints:false, nodeSize:4},validate:q=>validateGrowthInstrument('elastic-loops',q)},
];
const keys:Record<Kind,string[]>={
  'bridge-web':['ticks','strandCount','sourcePoints','span','spacing','strain','disorder','centerX','centerY','direction','slant','stride','bridgeSpacing','bridgeAdvance','candidateDisorder'],
  'neighborhood-growth':['ticks','count','sourceMode','extent','aspect','centerX','centerY','direction','disorder','poolSize','poolCenterX','poolCenterY','poolExtent','densityRadius','chain','minLength','step','insert','minNeighbors','maxNeighbors'],
  'elastic-loops':['ticks','strandCount','sourcePoints','sourceMode','length','radius','separation','bend','disorder','centerX','centerY','direction','pinning','growth','curl','windX','windY','range','strength','refineLength','nodeCap'],
};
const hardNumbers:Record<Kind,Record<string,[number,number,boolean?]>>={
  'bridge-web':{ticks:[0,80,true],strandCount:[2,32,true],sourcePoints:[2,40,true],span:[1,2048],spacing:[.01,1024],strain:[0,512],disorder:[0,1],centerX:[-2048,2048],centerY:[-2048,2048],direction:[-3600,3600],slant:[-2048,2048],stride:[1,1000,true],bridgeSpacing:[.01,1024],bridgeAdvance:[0,2048],candidateDisorder:[0,1],sourceWeight:[0,20],bridgeWeight:[0,20],nodeSize:[0,40]},
  'neighborhood-growth':{ticks:[0,90,true],count:[1,90,true],extent:[0,2048],aspect:[0,20],centerX:[-2048,2048],centerY:[-2048,2048],direction:[-3600,3600],disorder:[0,1],poolSize:[0,1000,true],poolCenterX:[-2048,2048],poolCenterY:[-2048,2048],poolExtent:[0,2048],densityRadius:[0,2048],minLength:[0,2048],step:[0,1],insert:[0,30,true],minNeighbors:[0,90,true],maxNeighbors:[0,90,true],graphWeight:[0,20],dotSize:[0,40],traceWeight:[0,20]},
  'elastic-loops':{ticks:[0,60,true],strandCount:[1,12,true],sourcePoints:[2,36,true],length:[1,2048],radius:[.01,1024],separation:[0,1024],bend:[0,512],disorder:[0,1],centerX:[-2048,2048],centerY:[-2048,2048],direction:[-3600,3600],growth:[0,.3],curl:[-1,1],windX:[-10,10],windY:[-10,10],range:[0,1024],strength:[0,100],refineLength:[1,2048],nodeCap:[2,300,true],weight:[0,20],nodeSize:[0,40]},
};
function kindOf(layer:Layer):Kind {
  if(layer.technique==='bridge-web'||layer.technique==='neighborhood-growth'||layer.technique==='elastic-loops')return layer.technique;
  throw Error(`Unknown growth instrument: ${layer.technique}`);
}
/** Check hard domains and joint work before allocating a pool, graph, or replay. */
export function validateGrowthInstrument(kind:Kind,q:Settings):void {
  for(const [key,[min,max,integer]] of Object.entries(hardNumbers[kind])){
    const v=q[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error(`${key} outside growth instrument domain`);
  }
  const n=(key:string)=>q[key] as number;
  if(kind==='bridge-web'){
    const initial=n('strandCount')*n('sourcePoints'),edges=n('strandCount')*(n('sourcePoints')-1),cap=edges+3*n('ticks');
    if(initial+2*n('ticks')>220||cap>240||n('ticks')*(cap*cap+initial+cap)>290_000)throw Error('Bridge node/edge/step work budget exceeded');
    if(n('ticks')>0&&n('bridgeAdvance')+(n('ticks')-.5)*n('bridgeSpacing')>n('span'))throw Error('Bridge candidate schedule exceeds source span');
  }else if(kind==='neighborhood-growth'){
    if(!['area','ring','line'].includes(String(q.sourceMode)))throw Error('Unknown neighborhood source mode');
    if(typeof q.chain!=='boolean')throw Error('chain must be boolean');
    if(n('minNeighbors')>n('maxNeighbors'))throw Error('Invalid density interval');
    const count=Math.min(n('count')+n('ticks')*n('insert'),n('count')+n('poolSize'));
    const cubic=(size:number)=>size+size*(size-1)/2*Math.max(0,size-2);
    if(count>90||cubic(count)*(n('ticks')+1)>370_000||n('ticks')*Math.min(n('poolSize'),16)*count*count>450_000)throw Error('Neighborhood cubic/pool work budget exceeded');
  }else{
    if(!['open','ring'].includes(String(q.sourceMode))||!['first','both','none'].includes(String(q.pinning)))throw Error('Invalid elastic source topology or pinning');
    if(q.sourceMode==='ring'&&n('sourcePoints')<3)throw Error('A ring requires at least three points');
    if(n('strandCount')>1&&n('separation')===0)throw Error('Separate sources require positive separation');
    const initial=n('strandCount')*n('sourcePoints');
    if(initial>n('nodeCap')||n('ticks')*(n('nodeCap')**2*12+16*n('nodeCap'))>520_000)throw Error('Elastic node/step work budget exceeded');
  }
}
function axes(q:Settings):[Point,Point]{const angle=(q.direction as number)*Math.PI/180;return [[Math.cos(angle),Math.sin(angle)],[-Math.sin(angle),Math.cos(angle)]];}
function place(x:number,y:number,cx:number,cy:number,t:Point,n:Point):Point{return [cx+x*t[0]+y*n[0],cy+x*t[1]+y*n[1]];}
function rng(seed:number,salt:number):JavaRandom{return new JavaRandom(seed^salt);}
function bridgeSource(q:Settings,seed:number):Graph{
  const strands=q.strandCount as number,count=q.sourcePoints as number,span=q.span as number,spacing=q.spacing as number;
  const [t,n]=axes(q),common=rng(seed,0x45a097),individual=rng(seed,0x4f96ba),phase=common.nextDouble()*Math.PI*2,phase2=common.nextDouble()*Math.PI*2;
  const nodes:Graph['nodes']=[],edges:Graph['edges']=[];
  for(let i=0;i<strands;i++){
    const variance=(individual.nextDouble()*2-1)*spacing*.19*(q.disorder as number),shift=individual.nextDouble()*Math.PI*2;
    for(let j=0;j<count;j++){
      const u=j/(count-1),longitudinal=(u-.5)*span;
      const bend=(q.strain as number)*(Math.sin(Math.PI*u+phase)*.7+Math.sin(2*Math.PI*u+phase2)*.3);
      const transverse=(i-(strands-1)/2)*spacing+bend+variance*Math.sin(Math.PI*u+shift);
      const id=nodes.length;
      nodes.push({id,point:place(longitudinal,transverse,q.centerX as number,q.centerY as number,t,n)});
      if(j>0)edges.push({id:edges.length,a:id-1,b:id});
    }
  }
  return {nodes,edges,nextNodeId:nodes.length,nextEdgeId:edges.length};
}
function candidate(q:Settings,seed:number,tick:number):[Point,Point]{
  const [t,n]=axes(q),r=rng(seed^0x65103,tick),spacing=q.spacing as number;
  const across=((q.strandCount as number)-1)*spacing/2+spacing*.65;
  const at=-(q.span as number)/2+(q.bridgeAdvance as number)+(tick+.5)*(q.bridgeSpacing as number)+
    (r.nextDouble()-.5)*(q.candidateDisorder as number)*(q.bridgeSpacing as number)*.6;
  const slant=q.slant as number,cx=q.centerX as number,cy=q.centerY as number;
  return [place(at-slant/2,-across,cx,cy,t,n),place(at+slant/2,across,cx,cy,t,n)];
}
function* bridgeSteps(q:Settings,seed:number):Generator<void,BridgeModel>{
  let graph=bridgeSource(q,seed);
  let kinds=new Map<number,'strand'|'bridge'>(graph.edges.map(edge=>[edge.id,'strand']));
  for(let tick=0;tick<(q.ticks as number);tick++){
    const result=insertSegmentBridge2D({graph,candidate:candidate(q,seed,tick),gapIndex:tick*(q.stride as number)%((q.strandCount as number)-1),maxNodes:graph.nodes.length+2,maxEdges:graph.edges.length+3,maxWork:2*graph.edges.length+graph.nodes.length+graph.edges.length**2+(graph.edges.length+3)**2+16});
    graph=result.graph as Graph;
    const next=new Map(kinds);
    for(const event of result.events){if(event.type==='split'){
      const kind=next.get(event.parentEdgeId)??'strand';next.delete(event.parentEdgeId);
      for(const id of event.childEdgeIds!)next.set(id,kind);
    }else if(event.type==='link')next.set(event.edgeId!,'bridge');}
    kinds=next;yield;
  }
  return {graph,kinds,candidate:candidate(q,seed,q.ticks as number)};
}
function neighborhoodSource(q:Settings,seed:number,pool=false):Point[]{
  const random=rng(seed,pool?0x28f96c:0x72136f),count=q[pool?'poolSize':'count'] as number;
  const cx=q[pool?'poolCenterX':'centerX'] as number,cy=q[pool?'poolCenterY':'centerY'] as number;
  const extent=q[pool?'poolExtent':'extent'] as number,aspect=pool?1:q.aspect as number;
  const [t,n]=pool?[[1,0] as Point,[0,1] as Point]:axes(q),points:Point[]=[];
  for(let i=0;i<count;i++){
    const u=random.nextDouble(),v=random.nextDouble();let x:number,y:number;
    if(pool||q.sourceMode==='area'){x=(u-.5)*extent;y=(v-.5)*extent*aspect;}
    else if(q.sourceMode==='ring'){
      const angle=2*Math.PI*(i+u*(q.disorder as number)*.7)/count,r=extent*(.4+(v-.5)*.18*(q.disorder as number));
      x=Math.cos(angle)*r;y=Math.sin(angle)*r*aspect;
    }else{x=(i+u*(q.disorder as number)*.8)/count*extent-extent/2;y=(v-.5)*extent*aspect*(q.disorder as number)*.13;}
    points.push(place(x,y,cx,cy,t,n));
  }
  return points;
}
function neighborhoodPairs(points:Point[],chain:boolean):number[][]{
  return chain?Array.from({length:Math.max(0,points.length-1)},(_,i)=>[i,i+1]):relativeNeighborhoodPairs2D({points,maxWork:points.length+points.length*(points.length-1)/2*Math.max(0,points.length-2)}).pairs as number[][];
}
function* neighborhoodSteps(q:Settings,seed:number):Generator<void,NeighborhoodModel>{
  const initial=neighborhoodSource(q,seed),pool=neighborhoodSource(q,seed,true);
  let points=initial.slice(),cursor=0;
  for(let tick=0;tick<(q.ticks as number);tick++){
    const pairs=neighborhoodPairs(points,q.chain as boolean);
    points=thresholdEdgeRelaxation2D({points,pairs,pinned:points.map(()=>false),minLength:q.minLength,stepScale:q.step,maxWork:points.length+pairs.length}).points as Point[];
    let added=0;
    for(let judged=0;judged<16&&added<(q.insert as number)&&cursor<pool.length;judged++){
      const candidate=pool[cursor++],extended=[...points,candidate];
      let nearby=0;
      for(const pair of radiusPairs2D({points:extended,radius:q.densityRadius,maxWork:extended.length+extended.length*(extended.length-1)/2}).pairs)if(pair[1]===points.length)nearby++;
      if(nearby<(q.minNeighbors as number)||nearby>(q.maxNeighbors as number))continue;
      points.push(candidate);added++;
    }
    yield;
  }
  return {seed:initial,points,pairs:neighborhoodPairs(points,q.chain as boolean)};
}
function orientation(a:Point,b:Point,c:Point){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function segmentsMeet(a:Point,b:Point,c:Point,d:Point):boolean{
  const x=orientation(a,b,c),y=orientation(a,b,d),z=orientation(c,d,a),w=orientation(c,d,b);
  if(x*y<0&&z*w<0)return true;
  const within=(p:Point,u:Point,v:Point)=>p[0]>=Math.min(u[0],v[0])&&p[0]<=Math.max(u[0],v[0])&&p[1]>=Math.min(u[1],v[1])&&p[1]<=Math.max(u[1],v[1]);
  return (x===0&&within(c,a,b))||(y===0&&within(d,a,b))||(z===0&&within(a,c,d))||(w===0&&within(b,c,d));
}
function checkElasticEmbedding(state:ElasticState):void{
  const lines:{a:number;b:number}[]=[];
  for(const curve of state.curves)for(let j=0;j<curve.edgeIds.length;j++)lines.push({a:curve.nodeIds[j],b:curve.nodeIds[(j+1)%curve.nodeIds.length]});
  for(let i=0;i<state.nodes.length;i++)for(let j=0;j<i;j++){
    if(state.nodes[i].position[0]===state.nodes[j].position[0]&&state.nodes[i].position[1]===state.nodes[j].position[1])throw Error('Elastic source has coincident vertices');
  }
  for(let i=0;i<lines.length;i++)for(let j=0;j<i;j++){
    const a=lines[i],b=lines[j];if(a.a===b.a||a.a===b.b||a.b===b.a||a.b===b.b)continue;
    if(segmentsMeet(state.nodes[a.a].position,state.nodes[a.b].position,state.nodes[b.a].position,state.nodes[b.b].position))throw Error('Elastic source has intersecting segments');
  }
}
function elasticSource(q:Settings,seed:number):ElasticState{
  const random=rng(seed,0x34f176),[t,n]=axes(q),curves:ElasticCurve[]=[],nodes:ElasticNode[]=[];
  let nextEdgeId=0;
  const closed=q.sourceMode==='ring',count=q.sourcePoints as number,total=q.strandCount as number,sep=q.separation as number;
  const commonPhase=random.nextDouble()*2*Math.PI,commonPhase2=random.nextDouble()*2*Math.PI;
  for(let i=0;i<total;i++){
    const phase=random.nextDouble()*2*Math.PI,amplitude=(random.nextDouble()*2-1)*(q.disorder as number)*Math.min(sep*.18,(q.radius as number)*.12);
    const nodeIds:number[]=[];
    for(let j=0;j<count;j++){
      const u=closed?j/count:j/(count-1),wave=(q.bend as number)*(Math.sin(2*Math.PI*u+commonPhase)*.7+Math.sin(4*Math.PI*u+commonPhase2)*.3);
      let x:number,y:number;
      if(closed){const radius=(q.radius as number)+i*sep+wave*.12+amplitude*Math.sin(2*Math.PI*u+phase);if(radius<=0)throw Error('Elastic source has nonpositive ring radius');const angle=2*Math.PI*u;x=radius*Math.cos(angle);y=radius*Math.sin(angle);}
      else{x=(u-.5)*(q.length as number);y=(i-(total-1)/2)*sep+wave+amplitude*Math.sin(Math.PI*u+phase);}
      const id=nodes.length,node={id,position:place(x,y,q.centerX as number,q.centerY as number,t,n),velocity:[0,0] as Point,pinned:q.pinning==='first'?j===0:q.pinning==='both'?(closed?j===0:j===0||j===count-1):false};
      nodes.push(node);nodeIds.push(id);
    }
    const edgeIds:number[]=[],restLengths:number[]=[],restTurns:number[]=[];
    const edges=closed?count:count-1,turns=closed?count:count-2;
    for(let j=0;j<edges;j++){
      const a=nodes[nodeIds[j]].position,b=nodes[nodeIds[(j+1)%count]].position;
      const length=Math.hypot(a[0]-b[0],a[1]-b[1]);if(length===0)throw Error('Elastic source has zero-length segment');
      edgeIds.push(nextEdgeId++);restLengths.push(length);
    }
    for(let j=0;j<turns;j++){
      const center=closed?j:j+1,a=nodes[nodeIds[(center-1+count)%count]].position,b=nodes[nodeIds[center]].position,c=nodes[nodeIds[(center+1)%count]].position;
      const vx=b[0]-a[0],vy=b[1]-a[1],wx=c[0]-b[0],wy=c[1]-b[1];
      const angle=Math.atan2(vx*wy-vy*wx,vx*wx+vy*wy);
      restTurns.push(angle<=-Math.PI?Math.PI:angle);
    }
    curves.push({id:i,closed,nodeIds,edgeIds,restLengths,restTurns});
  }
  const state={nodes,curves,nextNodeId:nodes.length,nextEdgeId};checkElasticEmbedding(state);return state;
}
function* elasticSteps(q:Settings,seed:number):Generator<void,ElasticModel>{
  const initial=elasticSource(q,seed);let state=initial;
  for(let tick=0;tick<(q.ticks as number);tick++){
    const restGrowth=state.curves.map(curve=>curve.restLengths.map(length=>length*(q.growth as number)));
    const turnRates=state.curves.map(curve=>curve.restTurns.map((_,i)=>{
      const id=curve.nodeIds[curve.closed?i:i+1];return id<initial.nodes.length?(q.curl as number):0;
    }));
    const externalAccelerations=state.nodes.map(():Point=>[q.windX as number,q.windY as number]);
    state=elasticCurveGrowStep2D({state,restGrowth,turnRates,externalAccelerations,stretchStiffness:.03,bendStiffness:80,contactRange:q.range,contactStrength:q.strength,damping:.88,dt:.4,maxSpeed:6,maxSegmentLength:q.refineLength,maxNodes:q.nodeCap,maxEdges:q.nodeCap,maxWork:24*(q.nodeCap as number)**2+32*(q.nodeCap as number),maxBacktracks:8}).state as ElasticState;
    yield;
  }
  return {seed:initial,state};
}
function steps(kind:Kind,q:Settings,seed:number):Generator<void,Model>{return kind==='bridge-web'?bridgeSteps(q,seed):kind==='neighborhood-growth'?neighborhoodSteps(q,seed):elasticSteps(q,seed);}
const cache=new Map<string,Model>();
function key(kind:Kind,q:Settings,seed:number){return JSON.stringify([kind,seed,...keys[kind].map(k=>q[k])]);}
function store(key:string,model:Model){cache.delete(key);cache.set(key,model);if(cache.size>8)cache.delete(cache.keys().next().value!);}
function model(kind:Kind,layer:Layer):Model{
  validateGrowthInstrument(kind,layer.params);const k=key(kind,layer.params,layer.seed),cached=cache.get(k);if(cached)return cached;
  const iterator=steps(kind,layer.params,layer.seed);let next=iterator.next();while(!next.done)next=iterator.next();store(k,next.value);return next.value;
}
/** Cancel before cache publication; the same generator drives synchronous and cooperative replay. */
export async function prepareGrowthInstrument(layer:Layer,isCancelled:()=>boolean):Promise<boolean>{
  const kind=kindOf(layer);validateGrowthInstrument(kind,layer.params);
  const k=key(kind,layer.params,layer.seed);if(isCancelled())return false;if(cache.has(k))return true;
  const iterator=steps(kind,layer.params,layer.seed);
  while(true){if(isCancelled())return false;const next=iterator.next();if(next.done){if(isCancelled())return false;store(k,next.value);return true;}
    await new Promise<void>(resolve=>setTimeout(resolve,0));}
}
function stroke(p:Canvas,l:Layer,index:number,alpha=255){p.stroke(...channels(l.palette[index%l.palette.length]),alpha);}
function fill(p:Canvas,l:Layer,index:number,alpha=255){p.fill(...channels(l.palette[index%l.palette.length]),alpha);}
export function drawGrowthInstrument(p:Canvas,layer:Layer):void{
  const kind=kindOf(layer),q=layer.params,m=model(kind,layer);p.push();
  try{
    if(kind==='bridge-web'){
      const bridge=m as BridgeModel,positions=new Map(bridge.graph.nodes.map(node=>[node.id,node.point]));p.noFill();
      for(const [edgeKind,weight,index] of [['strand',q.sourceWeight,1],['bridge',q.bridgeWeight,0]] as const){
        if((weight as number)===0)continue;stroke(p,layer,index);p.strokeWeight(weight as number);
        for(const edge of bridge.graph.edges)if(bridge.kinds.get(edge.id)===edgeKind){const a=positions.get(edge.a)!,b=positions.get(edge.b)!;p.line(...a,...b);}
      }
      if(q.candidate&&(q.bridgeWeight as number)>0){stroke(p,layer,3,140);p.strokeWeight(Math.min(1,q.bridgeWeight as number));p.line(...bridge.candidate[0],...bridge.candidate[1]);}
      if(q.nodes&&(q.nodeSize as number)>0){p.noStroke();fill(p,layer,2);for(const node of bridge.graph.nodes)p.circle(...node.point,q.nodeSize as number);}
    }else if(kind==='neighborhood-growth'){
      const neighborhood=m as NeighborhoodModel;p.noFill();
      if(q.traces&&(q.traceWeight as number)>0){stroke(p,layer,3,125);p.strokeWeight(q.traceWeight as number);for(let i=0;i<neighborhood.seed.length;i++)p.line(...neighborhood.seed[i],...neighborhood.points[i]);}
      if(q.graphMarks&&(q.graphWeight as number)>0){stroke(p,layer,2,215);p.strokeWeight(q.graphWeight as number);for(const [a,b] of neighborhood.pairs)p.line(...neighborhood.points[a],...neighborhood.points[b]);}
      if(q.nodeMarks&&(q.dotSize as number)>0){p.noStroke();for(let i=0;i<neighborhood.points.length;i++){fill(p,layer,i<neighborhood.seed.length?1:4);p.circle(...neighborhood.points[i],q.dotSize as number);}}
    }else{
      const elastic=m as ElasticModel,initial=new Map(elastic.seed.nodes.map(node=>[node.id,node.position])),current=new Map(elastic.state.nodes.map(node=>[node.id,node.position]));
      const render=(state:ElasticState,positions:Map<number,Point>)=>{for(const curve of state.curves)for(let i=0;i<curve.edgeIds.length;i++)p.line(...positions.get(curve.nodeIds[i])!,...positions.get(curve.nodeIds[(i+1)%curve.nodeIds.length])!);};
      p.noFill();if(q.seedGuides&&(q.weight as number)>0){stroke(p,layer,2,85);p.strokeWeight((q.weight as number)*.45);render(elastic.seed,initial);}
      if((q.weight as number)>0){stroke(p,layer,0,235);p.strokeWeight(q.weight as number);render(elastic.state,current);}
      if((q.nodeSize as number)>0&&(q.structure||q.endpoints)){
        p.noStroke();if(q.structure){fill(p,layer,2);for(const node of elastic.state.nodes)p.circle(...node.position,q.nodeSize as number);}
        if(q.endpoints){fill(p,layer,4);for(const curve of elastic.state.curves){p.circle(...current.get(curve.nodeIds[0])!,q.nodeSize as number*1.5);if(!curve.closed)p.circle(...current.get(curve.nodeIds.at(-1)!)!,q.nodeSize as number*1.5);}}
      }
    }
  }finally{p.pop();}
}
