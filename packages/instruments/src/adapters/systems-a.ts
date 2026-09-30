import type { ControlGroup, Layer } from "../types.js";
import { choice, numeric, type StudioDefinition } from "./types.js";
import { drawSystemsAQuality, validateSystemsAQuality } from "./systems-a-quality.js";
import { drawCurlStudy, validateCurlStudy } from "./systems-a-curl.js";
const n = (key:string,label:string,description:string,min:number,max:number,hardMin:number,hardMax:number,step=1,integer=false) =>
  numeric(key,label,description,min,max,step,{hardMin,hardMax,integer});

const sourceControls = (chemical:boolean, sparse=false) => [
  choice("source","Initial field","Choose the spatial source before simulation.",
    sparse?["disc","bands","speckle"]:["disc","bands","checker","speckle"]),
  n("sourceX","Source X","Moves the initial field horizontally in normalized frame widths.",-.43,.43,-100,100,.01),
  n("sourceY","Source Y","Moves the initial field vertically in normalized frame widths.",-.43,.43,-100,100,.01),
  n("frequency","Source frequency","Feature periods across the field; bounded by the fixed grid sampling resolution.",1,8,1,chemical?12:10,1,true),
  n("occupancy","Initial fill",sparse?"Fraction of cells activated from the highest source values.":"Source-value threshold for active starting cells.",
    sparse ? 0 : .1,sparse ? .35 : .7,0,1,.01),
];
const commonDefaults = {sourceX:0, sourceY:0, frequency:4, occupancy:.35};
const initialField: ControlGroup = { label: "Initial field", stage: "form", controls: ["source", "sourceX", "sourceY", "frequency", "occupancy"] };
/** A concentration or live-cell mark: its size and outline weight scale together. */
const cellMark = (size: string): ControlGroup => ({ label: "Mark", stage: "material", controls: [size, "weight"], proportional: true });
const curlField: ControlGroup = { label: "Field", stage: "form", controls: ["fieldFrequency", "anisotropy", "disorder"] };
const PROCEDURES: Record<string, string> = {
  "reaction-spots": "Two virtual chemicals react and diffuse across a small grid seeded with speckle, the Gray–Scott model run for a dozen steps. Wherever one chemical is concentrated, a disc is drawn, larger where it is stronger.",
  "reaction-stripes": "Two virtual chemicals are seeded along diagonal bands and left to react and diffuse for a few steps. Every cell where the concentration crosses a threshold becomes a coloured square, so the bands break into stripes.",
  "organic-cells": "Scattered live cells on a small grid follow Conway's Life for a handful of generations, wrapping at the edges. Every cell still alive at the end is drawn as a round disc, so the colonies read as soft clusters.",
  "geometric-generations": "A checkerboard of live cells runs through a few generations of Conway's Life, wrapping at the edges. Each survivor is drawn as a square, so the grid's order breaks into blocks and gaps.",
};
const modern:Record<string,StudioDefinition>={};
for(const [id,title,source,passes,scale] of [
  ["reaction-spots","Reaction spots","speckle",12,18],
  ["reaction-stripes","Reaction stripes","bands",8,13],
] as const) modern[id]={
  id,title,description:"Evolve an editable initial concentration field with Gray–Scott dynamics.",procedure:PROCEDURES[id],
  parameters:[
    ...sourceControls(true,id==="reaction-stripes"),
    n("passes","Passes","Elapsed chemical updates; zero shows the initial state.",0,16,0,256,1,true),
    n("feed","Feed","U replenishment coefficient of the Gray–Scott update.",.02,.06,.02,.06,.001),
    n("kill","Kill","V removal coefficient of the Gray–Scott update.",.04,.08,.04,.08,.001),
    n("scale","Cell size","Diameter or width of concentration marks.",7,24,.01,10000),
    n("weight","Stroke weight","Width of concentration mark outlines.",0,8,0,100,.25),
  ],
  controlGroups:[initialField,
    { label: "Evolution", stage: "process", controls: ["passes", "feed", "kill"] },
    cellMark("scale")],
  defaults:{...commonDefaults,source,passes,scale,weight:1,feed:.035,kill:.062,
    occupancy:id==="reaction-stripes" ? .1 : commonDefaults.occupancy},
  validate:params=>validateSystemsAQuality(id,params),
};
for(const [id,title,source,passes,cellSize] of [
  ["organic-cells","Organic cells","speckle",8,18],
  ["geometric-generations","Geometric generations","checker",6,22],
] as const) modern[id]={
  id,title,description:"Evolve an editable binary field under a selectable Life-like rule.",procedure:PROCEDURES[id],
  parameters:[
    ...sourceControls(false),
    choice("rule","Rule","Birth and survival counts used for every synchronous generation.",["life","highlife","seeds","day-night"]),
    choice("boundary","Boundary","Whether neighbors wrap around the grid or end at its edge.",["WRAP","DEAD"]),
    n("passes","Passes","Elapsed cellular generations; zero shows the initial state.",0,32,0,256,1,true),
    n("cellSize","Cell size","Diameter or width of each live cell mark.",7,30,.01,10000),
    n("weight","Stroke weight","Width of live cell mark outlines.",0,8,0,100,.25),
  ],
  controlGroups:[initialField,
    { label: "Evolution", stage: "process", controls: ["rule", "boundary", "passes"] },
    cellMark("cellSize")],
  defaults:{...commonDefaults,source,passes,cellSize,weight:1,rule:"life",boundary:"WRAP"},
  validate:params=>validateSystemsAQuality(id,params),
};
const curlFieldControls = [
  n("fieldFrequency","Field frequency","Scalar waves across the canvas; frequency × anisotropy must leave at least four samples per shortest wavelength.",.4,3,.01,6,.05),
  n("anisotropy","Anisotropy","Stretches scalar waves in X while compressing Y; jointly limited by field sampling.",.5,2,1/16,16,.05),
  n("disorder","Noise mix","Mixes seeded portable gradient noise into the scalar potential before curl; zero is ordered waves, one is entirely noise.",0,1,0,1,.01),
  n("sourceX","Source center X","Horizontal center in frame fractions (0 is left, 1 is right); exact entry permits off-frame accents.",0,1,-100,100,.01),
  n("sourceY","Source center Y","Vertical center in frame fractions (0 is top, 1 is bottom); exact entry permits off-frame accents.",0,1,-100,100,.01),
  n("sourceSpread","Source extent","Width of the start region or sampled needle region in canvas fractions; tiny and off-frame ranges permit fragments.",.1,1.2,.0001,10000,.01),
];
modern["swirling-particles"]={
  id:"swirling-particles",title:"Swirling particles",
  description:"Trace seeded starting points through a shared scalar curl field with RK4.",
  procedure: "Waves and seeded noise are blended into a smooth landscape, and its curl gives a velocity field that spins around every hill and hollow. Particles released into it are advanced step by step, and their paths are drawn as swirling trails.",
  parameters:[
    ...curlFieldControls,
    choice("sourceMode","Source placement","Start particles throughout an area, around a ring, or along a line.",["area","ring","line"]),
    n("sourceAngle","Line direction","Orientation of the source line in degrees; periodic angles are equivalent.",0,360,-360000,360000,1),
    n("count","Particles","Number of independent traces; the joint tracing budget counts a grid copy per trace.",8,120,1,10000,1,true),
    n("steps","Trail steps","RK4 steps per path; count × (grid copy + 17 × steps) has a one-million-unit tracing budget.",20,180,1,10000,1,true),
    n("stepSize","Advection step","Continuous RK4 integration time per trail step; zero holds a particle at its start.",.2,3,0,10000,.05),
    n("weight","Stroke weight","Path width in canvas pixels; zero omits path marks.",.25,4,0,100,.1),
  ],
  controlGroups:[curlField,
    { label: "Starts", stage: "form", controls: ["sourceMode", "sourceAngle", "sourceX", "sourceY", "sourceSpread", "count"] },
    { label: "Trails", stage: "material", controls: ["steps", "stepSize", "weight"] }],
  defaults:{fieldFrequency:1.25,
    anisotropy:1.2,
    disorder:.34,
    sourceX:.5,
    sourceY:.5,
    sourceSpread:.78,
    sourceMode:"area",
    sourceAngle:0,
    count:55,
    steps:70,
    stepSize:1.1,
    weight:1},
  validate:params=>validateCurlStudy("swirling-particles",params),
};
modern["flow-needles"]={
  id:"flow-needles",title:"Flow needles",
  description:"Read the same seeded scalar curl field as directional vector marks, not paths.",
  procedure: "Waves and seeded noise are blended into a smooth landscape, and its curl gives a velocity field that circles every hill. The field is read at the points of a grid, and a short needle is drawn at each one pointing along the flow.",
  parameters:[
    ...curlFieldControls,
    n("columns","Sample columns","Samples per axis; at most 128² direction marks to keep drawing bounded.",8,50,8,128,1,true),
    n("scale","Mark length","Length of each directional mark in pixels; independent of spacing between samples.",0,48,0,10000,.5),
    n("weight","Stroke weight","Needle width in canvas pixels; zero omits needle marks.",.25,4,0,100,.1),
  ],
  controlGroups:[curlField,
    { label: "Samples", stage: "form", controls: ["sourceX", "sourceY", "sourceSpread", "columns"] },
    { label: "Mark", stage: "material", controls: ["scale", "weight"], proportional: true }],
  defaults:{fieldFrequency:1.25,
    anisotropy:1.2,
    disorder:.34,
    sourceX:.5,
    sourceY:.5,
    sourceSpread:.78,
    columns:20,
    scale:18,
    weight:1},
  validate:params=>validateCurlStudy("flow-needles",params),
};
export const systemsADefinitions:StudioDefinition[]=Object.values(modern);
export function drawSystemsA(p:Parameters<typeof drawCurlStudy>[0],layer:Layer):void{
  if(layer.technique==="swirling-particles"||layer.technique==="flow-needles")
    return drawCurlStudy(p,layer);
  if(modern[layer.technique])return drawSystemsAQuality(p,layer);
  throw Error("Unknown systems A technique");
}
