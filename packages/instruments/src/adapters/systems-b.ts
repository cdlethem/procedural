import type { ControlGroup, Layer } from "../types.js";
import { choice, numeric, toggle, type StudioDefinition } from "./types.js";
import { drawWaveQuality, validateWaveQuality } from "./systems-b-wave-quality.js";
import { drawBranchSentences, validateBranchSentences } from "./systems-b-branches.js";
import { systemsBSettings } from "@procedurals/javascript/examples/systems-b-studies.js";
const bounded=(key:string,title:string,description:string,sliderMin:number,sliderMax:number,hardMin:number,hardMax:number,step=1,integer=false)=>
  numeric(key,title,description,sliderMin,sliderMax,step,{hardMin,hardMax,integer});
const impulseControls=(site:number)=>[
  bounded(`impulseX${site}`,`Impulse ${site} X`,"Horizontal center in frame widths; values outside the frame can crop a pulse.",0,1,-1,2,.01),
  bounded(`impulseY${site}`,`Impulse ${site} Y`,"Vertical center in frame heights; values outside the frame can crop a pulse.",0,1,-1,2,.01),
  bounded(`impulseSpread${site}`,`Impulse ${site} spread`,"Gaussian radius in grid cells.",.5,8,.2,12,.1),
  bounded(`impulseAmplitude${site}`,`Impulse ${site} amplitude`,"Signed initial displacement; zero disables this site.",-1.5,1.5,-3,3,.05),
];
const waveParameters=[
  bounded("impulseCount","Impulses","Number of independently placed initial pulses.",1,3,1,3,1,true),
  ...impulseControls(1),...impulseControls(2),...impulseControls(3),
  choice("pinMode","Pin geometry","Cells that remain at zero displacement while the field evolves.",["none","perimeter","vertical","horizontal","disc"]),
  bounded("pinX","Pin X","Normalized horizontal center for a vertical or disc pin.",0,1,-1,2,.01),
  bounded("pinY","Pin Y","Normalized vertical center for a horizontal or disc pin.",0,1,-1,2,.01),
  bounded("pinRadius","Pin radius","Disc pin radius in grid cells.",.5,8,.2,12,.1),
  toggle("showPins","Show pins","Draw small marks at the pinned grid cells."),
  bounded("passes","Passes","Elapsed wave updates; zero shows the initial displacement.",0,38,0,80,1,true),
  bounded("scale","Cell spacing","Distance between grid samples on the canvas; large values may crop.",10,28,.1,100,.1),
  bounded("weight","Line weight","Thickness of the wave contours.",.5,4,.1,12,.1),
];
const impulseGroup = (site:number):ControlGroup=>({label:`Impulse ${site}`,
  controls:[`impulseX${site}`,`impulseY${site}`,`impulseSpread${site}`,`impulseAmplitude${site}`]});
const waveGroups:ControlGroup[]=[
  {label:"Impulses",stage:"form",controls:["impulseCount",impulseGroup(1),impulseGroup(2),impulseGroup(3)]},
  {label:"Pins",stage:"form",controls:["pinMode","pinX","pinY","pinRadius","showPins"]},
  {label:"Evolution",stage:"process",controls:["passes"]},
  {label:"Drawing",stage:"material",controls:["scale","weight"]},
];
const waveDefaults={impulseCount:2,
  impulseX1:26*.32/25,
  impulseY1:26*.48/25,
  impulseSpread1:Math.sqrt(7/2),
  impulseAmplitude1:1,
  impulseX2:26*.69/25,
  impulseY2:26*.53/25,
  impulseSpread2:Math.sqrt(10/2),
  impulseAmplitude2:-1,
  impulseX3:.5,
  impulseY3:.5,
  impulseSpread3:2,
  impulseAmplitude3:0,
  pinMode:"none",
  pinX:.5,
  pinY:.5,
  pinRadius:4,
  showPins:false};
const branchDefinition: StudioDefinition = {
  id: "branching-sentences", title: "Branching sentences",
  description: "Compose depth-indexed branching grammar with seeded irregularity and spatially placed specimens.",
  parameters: [
    bounded("branchCount", "Branches per fork", "Number of child branches from each joint; one grows a single crooked path.", 1, 4, 1, 8, 1, true),
    bounded("angle", "Signed divergence", "Degrees between each outer branch and its parent heading; negative reverses the fork order.", -75, 75, -180, 180, 1),
    bounded("branchBias", "Branch bias", "Degrees turning the entire fork toward one side.", -50, 50, -180, 180, 1),
    bounded("branchSurvival", "Branch survival", "Seeded chance for each child subtree to grow. Zero leaves bare trunks; one keeps every fork.", .3, 1, 0, 1, .01),
    bounded("tipSpread", "Tip opening", "Divergence multiplier reached at the last fork; one keeps a constant fan angle.", .3, 2, 0, 4, .01),
    bounded("contraction", "Length contraction", "Each depth's step is multiplied by this factor; values above one lengthen outer branches.", .45, 1.15, .1, 1.5, .01),
    bounded("angularDisorder", "Angular disorder", "Seeded per-joint turn variation in degrees, plus or minus this amount.", 0, 40, 0, 180, 1),
    bounded("lengthDisorder", "Length disorder", "Seeded per-segment length variation as a fraction of its depth's step.", 0, .5, 0, .95, .01),
    bounded("iterations", "Depth", "Number of rewrite generations and drawn trunk-to-tip steps.", 1, 7, 1, 12, 1, true),
    bounded("step", "Trunk step", "First trunk segment length in canvas pixels; never automatically fit to the frame.", 5, 65, .1, 160, .1),
    bounded("heading", "Starting heading", "Trunk direction in degrees: -90 points up.", -180, 180, -1080, 1080, 1),
    bounded("specimens", "Specimens", "Number of independently sampled branches; combined grammar work is bounded.", 1, 8, 1, 24, 1, true),
    bounded("centerX", "Center X", "Normalized horizontal center for the grove; values beyond the canvas deliberately crop.", 0, 1, -1, 2, .01),
    bounded("centerY", "Center Y", "Normalized vertical center for the grove; values beyond the canvas deliberately crop.", 0, 1, -1, 2, .01),
    bounded("spreadX", "Horizontal spread", "Maximum horizontal scattering span between specimen origins, in pixels.", 0, 320, 0, 1000, 1),
    bounded("spreadY", "Vertical spread", "Maximum vertical scattering span between specimen origins, in pixels.", 0, 240, 0, 1000, 1),
    bounded("weight", "Stroke weight", "Trunk stroke width in pixels.", .4, 6, .1, 20, .1),
    bounded("taper", "Branch taper", "Stroke multiplier per depth; zero leaves only the trunks.", .4, 1.2, 0, 2, .01),
    toggle("tips", "Draw tips", "Place small color marks at the final branch endpoints."),
  ],
  controlGroups: [
    { label: "Growth", stage: "form", controls: ["iterations", "branchCount", "branchSurvival", "step", "contraction", "heading",
      { label: "Fork", controls: ["angle", "branchBias", "tipSpread"] }] },
    { label: "Disorder", stage: "process", controls: ["angularDisorder", "lengthDisorder"] },
    { label: "Placement", stage: "frame", controls: ["specimens", "centerX", "centerY",
      { label: "Spread", controls: ["spreadX", "spreadY"], proportional: true }] },
    { label: "Stroke", stage: "material", controls: ["weight", "taper", "tips"] },
  ],
  defaults: {iterations: 6,
    step: 65,
    angle: 32,
    branchCount: 2,
    branchBias: 12,
    contraction: .86,
    branchSurvival: .88,
    tipSpread: 1.5,
    angularDisorder: 18,
    lengthDisorder: .22,
    heading: -90,
    specimens: 3,
    centerX: .5,
    centerY: .72,
    spreadX: 200,
    spreadY: 90,
    weight: 2,
    taper: .82,
    tips: false},
  validate: validateBranchSentences,
};
const waveDefinitions:Record<string,StudioDefinition>={
  "ripple-interference":{id:"ripple-interference",title:"Ripple interference",description:"Compose signed wave impulses and evolve their interference as drawn contours.",
    parameters:waveParameters,controlGroups:waveGroups,defaults:{...waveDefaults,...systemsBSettings["ripple-interference"].defaults},validate:validateWaveQuality},
  "pinned-waves":{id:"pinned-waves",title:"Pinned waves",description:"Compose wave impulses and pin chosen cells while the field evolves.",
    parameters:waveParameters,controlGroups:waveGroups,defaults:{...waveDefaults,...systemsBSettings["pinned-waves"].defaults,impulseCount:1,pinMode:"perimeter",showPins:true},validate:validateWaveQuality},
};
export const systemsBDefinitions:StudioDefinition[]=[
  waveDefinitions["ripple-interference"],
  waveDefinitions["pinned-waves"],
  branchDefinition,
];
export function drawSystemsB(p:Parameters<typeof drawBranchSentences>[0],layer:Layer):void{
  if(waveDefinitions[layer.technique])return drawWaveQuality(p,layer);
  if(layer.technique==="branching-sentences")return drawBranchSentences(p,layer);
  throw Error("Unknown systems B technique");
}
