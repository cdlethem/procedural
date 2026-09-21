import type { Layer } from "../studio-types";
import { drawMaterialsA, materialsADefinitions } from "./materials-a";
import { drawDiffusionEngraving, drawDitheredRibbons, drawOrderedHalftone, drawBayerWeave, drawEmbossedField, drawSignedEdgePrint, drawDistanceHalos, drawErodedLace, drawDilatedStamps, drawOklabOrbits } from "@procedurals/javascript/examples/materials-a-studies.js"
import { materialsBDefinitions } from "./materials-b";
import { drawExtrudedSeals, drawSteppedBlocks, drawTransportedRibbons, drawTwistingStreamers, drawRoundedPolyhedra, drawSubdividedShells } from "@procedurals/javascript/examples/materials-b-studies.js"
export const materialsDefinitions = [...materialsADefinitions, ...materialsBDefinitions];
export function drawMaterials(p: any, layer: Layer): void {
 switch(layer.technique) {
 case "diffusion-engraving": return drawDiffusionEngraving(p, layer);
 case "dithered-ribbons": return drawDitheredRibbons(p, layer);
 case "ordered-halftone": return drawOrderedHalftone(p, layer);
 case "bayer-weave": return drawBayerWeave(p, layer);
 case "embossed-field": return drawEmbossedField(p, layer);
 case "signed-edge-print": return drawSignedEdgePrint(p, layer);
 case "distance-halos": return drawDistanceHalos(p, layer);
 case "nearest-feature-mosaic": return drawMaterialsA(p, layer);
 case "eroded-lace": return drawErodedLace(p, layer);
 case "dilated-stamps": return drawDilatedStamps(p, layer);
 case "perceptual-bands": return drawMaterialsA(p, layer);
 case "oklab-orbits": return drawOklabOrbits(p, layer);
 case "reduced-mosaic": return drawMaterialsA(p, layer);
 case "quantized-stripes": return drawMaterialsA(p, layer);
 case "extruded-seals": return drawExtrudedSeals(p, layer);
 case "stepped-blocks": return drawSteppedBlocks(p, layer);
 case "transported-ribbons": return drawTransportedRibbons(p, layer);
 case "twisting-streamers": return drawTwistingStreamers(p, layer);
 case "rounded-polyhedra": return drawRoundedPolyhedra(p, layer);
 case "subdivided-shells": return drawSubdividedShells(p, layer);
 default: throw new Error("Unknown materials technique");
 }
}
