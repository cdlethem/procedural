import type { Layer } from "../studio-types"; import { choice,numeric,type StudioDefinition } from "./types";
import * as draws from "@procedurals/javascript/examples/materials-a-studies.js"
import { drawNearestFeatureField, drawPerceptualBandsField, drawQuantizedStripesField, drawReducedMosaicField } from "./materials-a-fields";
const rows=[
["diffusion-engraving","Diffusion engraving","Error-diffused etched field.","scale",5,16,"threshold",.2,.8],["dithered-ribbons","Dithered ribbons","Directional dither marks.","scale",5,16,"threshold",.2,.8],["ordered-halftone","Ordered halftone","Bayer screen dots.","scale",5,16,"order",1,5],["bayer-weave","Bayer weave","Crossed ordered screen.","scale",6,20,"order",1,5],["embossed-field","Embossed field","Signed convolution relief.","scale",5,16,"gain",.4,3],["signed-edge-print","Signed edge print","Two-ink convolution edges.","scale",5,16,"gain",.4,3],["distance-halos","Distance halos","Nearest-feature rings.","scale",6,18,"radius",2,16],["nearest-feature-mosaic","Nearest feature mosaic","Voronoi-like nearest IDs.","scale",8,20,"features",4,30],["eroded-lace","Eroded lace","Shrunk binary motif.","scale",5,16,"passes",1,3],["dilated-stamps","Dilated stamps","Expanded binary motif.","scale",6,18,"passes",1,3],["perceptual-bands","Perceptual bands","OKLab color intervals.","bands",6,40,"phase",0,6.28],["oklab-orbits","OKLab orbits","Perceptual colored rings.","orbits",6,40,"phase",0,6.28],["reduced-mosaic","Reduced mosaic","Median-cut color tiles.","scale",12,20,"count",2,10],["quantized-stripes","Quantized stripes","Median-cut stripe palette.","stripes",8,52,"count",2,10]
] as const;
const label=(value:string)=>value.replace(/^./,c=>c.toUpperCase());const integer=new Set(["order","passes","count","features","bands","orbits","stripes"]);
const reliefParameters=(id:"embossed-field"|"signed-edge-print")=>[
 numeric("scale","Pixel size","Changes sampling density and the size of each printed mark.",6,48,1,{hardMin:4,hardMax:120,integer:true}),
 choice("source","Source field","Chooses the scalar image whose changes make the relief or edges.",["waves","mounds","cutout"]),
 choice("axis","Response axis","Chooses which direction of change the signed convolution emphasizes.",["vertical","horizontal","diagonal"]),
 id==="embossed-field"
  ?numeric("gain","Relief strength","Controls the opacity of the light and shadow marks.",0,4,.05,{hardMin:0,hardMax:20})
  :numeric("cutoff","Edge cutoff","Keeps signed responses whose magnitude exceeds this value.",0,1,.01,{hardMin:0,hardMax:4}),
 choice("treatment","Mark treatment","Draws the response as full tiles or smaller marks.",id==="embossed-field"?["tiles","dots"]:["tiles","bars"]),
];
const bandCoverage = numeric("bandCoverage", "Band coverage", "Fraction of each band cell painted; uncovered space reveals lower layers.", 0, 1, .01, { hardMin: 0, hardMax: 1, integer: false });
const fields: Record<string, StudioDefinition> = {
  "quantized-stripes": {
    id: "quantized-stripes", title: "Quantized stripes", description: "Reduce generated stripe colors, then leave adjustable clear gaps between their bands.",
    parameters: [
      numeric("stripes", "Stripes", "Number of source and output bands.", 8, 52, 1, { hardMin: 8, hardMax: 52, integer: true }),
      numeric("count", "Colors", "Requested median-cut output color count.", 2, 10, 1, { hardMin: 2, hardMax: 10, integer: true }),
      bandCoverage,
    ], defaults: { ...draws.materialsASettings["quantized-stripes"].defaults, bandCoverage: 1 },
  },
  "perceptual-bands": {
    id: "perceptual-bands", title: "Perceptual bands", description: "Place Oklab ramp samples in staggered bands with adjustable clear gaps.",
    parameters: [
      numeric("bands", "Bands", "Number of colors sampled along the Oklab ramp.", 6, 40, 1, { hardMin: 6, hardMax: 40, integer: true }),
      numeric("phase", "Edge phase", "Moves the staggered side edges around the bands.", 0, 6.28, .01, { hardMin: -1_000_000, hardMax: 1_000_000, integer: false }),
      bandCoverage,
    ], defaults: { ...draws.materialsASettings["perceptual-bands"].defaults, bandCoverage: 1 },
  },
  "reduced-mosaic": {
    id: "reduced-mosaic", title: "Reduced mosaic", description: "Quantize a generated color field and reveal lower layers through selected source cells.",
    parameters: [
      numeric("scale", "Cell size", "Cell width and sampling density of the source field.", 12, 20, .1, { hardMin: 12, hardMax: 20, integer: false }),
      numeric("count", "Colors", "Requested median-cut output color count.", 2, 10, 1, { hardMin: 2, hardMax: 10, integer: true }),
      choice("fieldMask", "Show source values", "Keep every cell, high-valued cells, or low-valued cells without re-quantizing.", ["all", "high", "low"]),
      numeric("maskThreshold", "Source cutoff", "Cutoff of the source scalar field when high or low cells are shown.", 0, 1, .01, { hardMin: 0, hardMax: 1, integer: false }),
    ], defaults: { ...draws.materialsASettings["reduced-mosaic"].defaults, fieldMask: "all", maskThreshold: .5 },
  },
  "nearest-feature-mosaic": {
    id: "nearest-feature-mosaic", title: "Nearest feature mosaic", description: "Show nearest-feature regions, their true boundaries, or both.",
    parameters: [
      numeric("scale", "Cell size", "Sampling resolution of the region grid.", 8, 20, .1, { hardMin: 8, hardMax: 20, integer: false }),
      numeric("features", "Features", "Requested density of seeded sites that own regions.", 4, 30, 1, { hardMin: 4, hardMax: 30, integer: true }),
      choice("display", "Region display", "Color the regions, trace only different-neighbor boundaries, or combine both.", ["regions", "boundaries", "both"]),
      numeric("boundaryWidth", "Boundary width", "Width of lines separating differently owned cells.", 0, 6, .1, { hardMin: 0, hardMax: 30, integer: false }),
      { key: "showSites", label: "Show sites", description: "Mark the actual seeded feature cells.", type: "boolean" },
      numeric("siteSize", "Site size", "Diameter of each visible feature site.", 0, 12, .1, { hardMin: 0, hardMax: 50, integer: false }),
    ], defaults: { ...draws.materialsASettings["nearest-feature-mosaic"].defaults,
      display: "regions", boundaryWidth: 1.5, showSites: false, siteSize: 5 },
  },
};
export const materialsADefinitions:StudioDefinition[]=rows.map(([id,title,description,a,amin,amax,b,bmin,bmax])=>fields[id]??({id,title,description,parameters:id==="embossed-field"||id==="signed-edge-print"?reliefParameters(id):[numeric(a,label(a),`Changes ${a}.`,amin,amax,integer.has(a)?1:.01),numeric(b,b==="count"?"Colors":label(b),`Changes ${b}.`,bmin,bmax,integer.has(b)?1:.01),...((id==="distance-halos"||id==="oklab-orbits")?[numeric("weight","Stroke weight","Thickness of the ring marks.",.5,4,.25)]:[])],defaults:draws.materialsASettings[id].defaults}));
const names={"diffusion-engraving":"drawDiffusionEngraving","dithered-ribbons":"drawDitheredRibbons","ordered-halftone":"drawOrderedHalftone","bayer-weave":"drawBayerWeave","embossed-field":"drawEmbossedField","signed-edge-print":"drawSignedEdgePrint","distance-halos":"drawDistanceHalos","nearest-feature-mosaic":"drawNearestFeatureMosaic","eroded-lace":"drawErodedLace","dilated-stamps":"drawDilatedStamps","perceptual-bands":"drawPerceptualBands","oklab-orbits":"drawOklabOrbits","reduced-mosaic":"drawReducedMosaic","quantized-stripes":"drawQuantizedStripes"} as const;
export function drawMaterialsA(p:any,layer:Layer):void{
  if(layer.technique==="quantized-stripes") return drawQuantizedStripesField(p,layer);
  if(layer.technique==="perceptual-bands") return drawPerceptualBandsField(p,layer);
  if(layer.technique==="reduced-mosaic") return drawReducedMosaicField(p,layer);
  if(layer.technique==="nearest-feature-mosaic") return drawNearestFeatureField(p,layer);
  const name=names[layer.technique as keyof typeof names];const draw=(draws as any)[name];if(!draw)throw Error("Unknown materials A technique");draw(p,layer);
}
