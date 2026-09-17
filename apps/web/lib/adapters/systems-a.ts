import type { Layer } from "../studio-types";
import { choice, numeric, toggle, type StudioDefinition } from "./types";
import { systemsASettings, drawStreamRibbons, drawCurvedTrajectories, drawReactionSpots, drawReactionStripes, drawOrganicCells, drawGeometricGenerations, drawWovenRows, drawTriangleGlyphs, drawSwirlingParticles, drawFlowNeedles } from "../../../../packages/javascript/examples/systems-a-studies.js";
import { drawSystemsAQuality, validateSystemsAQuality } from "./systems-a-quality";
const rows=[["stream-ribbons","Stream ribbons","RK4 streamlines.",["steps",8,70],["lanes",6,32]],["curved-trajectories","Curved trajectories","RK4 curved paths.",["steps",10,90],["paths",5,20]],["reaction-spots","Reaction spots","Gray-Scott spots.",["passes",1,24],["scale",8,20]],["reaction-stripes","Reaction stripes","Gray-Scott stripe masks.",["passes",1,24],["scale",7,18]],["organic-cells","Organic cells","Life-like rounded colonies.",["passes",1,16],["cellSize",10,22]],["geometric-generations","Geometric generations","Life-like square cells.",["passes",1,16],["cellSize",10,24]],["woven-rows","Woven rows","Elementary rule rows.",["rule",0,255],["rows",8,40]],["triangle-glyphs","Triangle glyphs","Elementary triangle rows.",["rule",0,255],["rows",8,40]],["swirling-particles","Swirling particles","Curl-driven RK4 paths.",["count",8,64],["steps",8,50]],["flow-needles","Flow needles","Scalar curl vector samples.",["columns",8,30],["scale",8,28]]] as const;
const labels:Record<string,string>={steps:"Steps",lanes:"Lanes",paths:"Paths",passes:"Passes",scale:"Scale",cellSize:"Cell size",rule:"Rule",rows:"Rows",count:"Count",columns:"Columns"};
const n = (key:string,label:string,description:string,min:number,max:number,hardMin:number,hardMax:number,step=1,integer=false) =>
  numeric(key,label,description,min,max,step,{hardMin,hardMax,integer});
const legacy = { ...toggle("legacy","Legacy layout","Retains the earlier saved composition."),hidden:true };
const sourceControls = (chemical:boolean, sparse=false) => [
  choice("source","Initial field","Choose the spatial source before simulation.",
    sparse?["disc","bands","speckle"]:["disc","bands","checker","speckle"]),
  n("sourceX","Source X","Moves the initial field horizontally in normalized frame widths.",-.43,.43,-100,100,.01),
  n("sourceY","Source Y","Moves the initial field vertically in normalized frame widths.",-.43,.43,-100,100,.01),
  n("frequency","Source frequency","Feature periods across the field; bounded by the fixed grid sampling resolution.",1,8,1,chemical?12:10,1,true),
  n("occupancy","Initial fill",sparse?"Fraction of cells activated from the highest source values.":"Source-value threshold for active starting cells.",
    sparse ? 0 : .1,sparse ? .35 : .7,0,1,.01),
];
const commonDefaults = { sourceX:0,sourceY:0,frequency:4,occupancy:.35,legacy:false };
const modern:Record<string,StudioDefinition>={};
for(const [id,title,source,passes,scale] of [
  ["reaction-spots","Reaction spots","speckle",12,18],
  ["reaction-stripes","Reaction stripes","bands",8,13],
] as const) modern[id]={
  id,title,description:"Evolve an editable initial concentration field with Gray–Scott dynamics.",
  parameters:[
    ...sourceControls(true,id==="reaction-stripes"),
    n("passes","Passes","Elapsed chemical updates; zero shows the initial state.",0,16,0,256,1,true),
    n("feed","Feed","U replenishment coefficient of the Gray–Scott update.",.02,.06,.02,.06,.001),
    n("kill","Kill","V removal coefficient of the Gray–Scott update.",.04,.08,.04,.08,.001),
    n("scale","Cell size","Diameter or width of concentration marks.",7,24,.01,10000),
    n("weight","Stroke weight","Width of concentration mark outlines.",0,8,0,100,.25),legacy,
  ],
  defaults:{...commonDefaults,source,passes,scale,weight:1,feed:.035,kill:.062,
    occupancy:id==="reaction-stripes" ? .1 : commonDefaults.occupancy},
  validate:params=>validateSystemsAQuality(id,params),
};
for(const [id,title,source,passes,cellSize] of [
  ["organic-cells","Organic cells","speckle",8,18],
  ["geometric-generations","Geometric generations","checker",6,22],
] as const) modern[id]={
  id,title,description:"Evolve an editable binary field under a selectable Life-like rule.",
  parameters:[
    ...sourceControls(false),
    choice("rule","Rule","Birth and survival counts used for every synchronous generation.",["life","highlife","seeds","day-night"]),
    choice("boundary","Boundary","Whether neighbors wrap around the grid or end at its edge.",["WRAP","DEAD"]),
    n("passes","Passes","Elapsed cellular generations; zero shows the initial state.",0,32,0,256,1,true),
    n("cellSize","Cell size","Diameter or width of each live cell mark.",7,30,.01,10000),
    n("weight","Stroke weight","Width of live cell mark outlines.",0,8,0,100,.25),legacy,
  ],
  defaults:{...commonDefaults,source,passes,cellSize,weight:1,rule:"life",boundary:"WRAP"},
  validate:params=>validateSystemsAQuality(id,params),
};
export const systemsADefinitions:StudioDefinition[]=rows.map(([id,title,description,a,b])=>modern[id] ?? ({id,title,description,parameters:[numeric(a[0],labels[a[0]],`Changes ${a[0]}.`,a[1],a[2]),numeric(b[0],labels[b[0]],`Changes ${b[0]}.`,b[1],b[2]),"cellSize" in systemsASettings[id].defaults && (id === "woven-rows" || id === "triangle-glyphs") ? numeric("cellSize","Cell size","Glyph spacing, capped to fit the canvas.",6,14,1) : numeric("weight","Stroke weight","Outline width.",.5,5,.25)],defaults:systemsASettings[id].defaults}));
const draws:Record<string,(p:any,l:Layer)=>void>={"stream-ribbons":drawStreamRibbons,"curved-trajectories":drawCurvedTrajectories,"reaction-spots":drawReactionSpots,"reaction-stripes":drawReactionStripes,"organic-cells":drawOrganicCells,"geometric-generations":drawGeometricGenerations,"woven-rows":drawWovenRows,"triangle-glyphs":drawTriangleGlyphs,"swirling-particles":drawSwirlingParticles,"flow-needles":drawFlowNeedles};
export function drawSystemsA(p:any,layer:Layer):void{const draw=draws[layer.technique];if(!draw)throw Error("Unknown systems A technique");if(modern[layer.technique]&&layer.params.legacy!==true)drawSystemsAQuality(p,layer);else draw(p,layer);}
