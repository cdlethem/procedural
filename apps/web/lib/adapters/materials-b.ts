import type { Layer, Parameter } from "../studio-types";
import { choice, numeric, type StudioDefinition } from "./types";
import * as draws from "../../../../packages/javascript/examples/materials-b-studies.js";

const cameraAndSurface: Parameter[] = [
  numeric("rotation", "Camera yaw", "Turn the view around the source while keeping its geometry fixed.", -3.14, 3.14, .01, { hardMin: -2 * Math.PI, hardMax: 2 * Math.PI }),
  numeric("pitch", "Camera pitch", "Tilt the view above or below the source.", -1.2, 1.2, .01, { hardMin: -Math.PI / 2, hardMax: Math.PI / 2 }),
  numeric("zoom", "View zoom", "Set a fixed projection scale; geometry edits no longer refit the frame.", .5, 8, .05, { hardMin: .05, hardMax: 20 }),
  choice("faceMode", "Face colour", "Choose lit single ink, height bands, or visible facets.", ["solid-lit", "bands", "facets"]),
  numeric("weight", "Outline weight", "Draw section and silhouette edges in solid-lit mode, or facet edges in facet mode; zero hides them.", 0, 3, .1, { hardMin: 0, hardMax: 12 }),
  { key: "legacy", label: "Legacy rendering", description: "Preserves the exact previous saved drawing until edited.", type: "boolean", hidden: true },
];

const footprintControls: Parameter[] = [
  choice("footprint", "Footprint", "Choose a beveled contour or stepped outline.", ["beveled", "stepped"]),
  numeric("footprintWidth", "Footprint width", "Sets the x span of the polygon before extrusion.", 80, 420, 1, { hardMin: 20, hardMax: 600 }),
  numeric("footprintDepth", "Footprint depth", "Sets the y span of the polygon before extrusion.", 80, 420, 1, { hardMin: 20, hardMax: 600 }),
  numeric("inset", "Corner inset", "Cuts or skews the footprint corners.", 0, 100, 1, { hardMin: 0, hardMax: 150 }),
  // A stepped footprint needs a positive ledge, so the slider interval starts above zero
  // while the hard domain still accepts an exact zero for beveled outlines.
  numeric("stepDepth", "Step depth", "Moves the upper shoulder or the stepped cut.", 1, 160, 1, { hardMin: 0, hardMax: 300 }),
  numeric("shoulder", "Shoulder width", "Changes the upper slope or the horizontal step.", 1, 160, 1, { hardMin: 0, hardMax: 300 }),
  numeric("height", "Extrusion height", "Pushes the polygon into depth at the current fixed camera zoom.", 10, 300, 1, { hardMin: .001, hardMax: 1000 }),
];
const ribbonControls: Parameter[] = [
  numeric("segments", "Path samples", "Samples the same centerline more or less finely.", 4, 80, 1, { hardMin: 2, hardMax: 512, integer: true }),
  numeric("verticalAmplitude", "Vertical bend", "Moves the centerline up or down; zero makes it level.", -220, 220, 1, { hardMin: -640, hardMax: 640 }),
  numeric("verticalCycles", "Vertical cycles", "Changes the number and direction of vertical turns.", -4, 4, .05, { hardMin: -32, hardMax: 32 }),
  numeric("depthAmplitude", "Depth bend", "Moves the centerline toward and away from the camera.", -220, 220, 1, { hardMin: -640, hardMax: 640 }),
  numeric("depthCycles", "Depth cycles", "Changes the number and direction of depth turns.", -4, 4, .05, { hardMin: -32, hardMax: 32 }),
  numeric("width", "Start width", "Sets the full ribbon width at its first sample.", 0, 160, 1, { hardMin: 0, hardMax: 640 }),
  numeric("endWidth", "End width", "Sets the full ribbon width at its final sample.", 0, 160, 1, { hardMin: 0, hardMax: 640 }),
  numeric("widthPulse", "Middle width pulse", "Expands or contracts the middle relative to the endpoint widths.", -1, 2, .05, { hardMin: -1, hardMax: 8 }),
];
const subdivisionControls: Parameter[] = [
  choice("base", "Base mesh", "Refine a closed tetrahedron, closed octahedron, or open patch.", ["tetra", "octa", "patch"]),
  numeric("axisX", "X scale", "Stretches, flattens, or mirrors the source across x before refinement.", -2, 2, .05, { hardMin: -8, hardMax: 8 }),
  numeric("axisY", "Y scale", "Stretches, flattens, or mirrors the source across y before refinement.", -2, 2, .05, { hardMin: -8, hardMax: 8 }),
  numeric("axisZ", "Z scale", "Stretches, flattens, or mirrors the source across z before refinement.", -2, 2, .05, { hardMin: -8, hardMax: 8 }),
  numeric("cornerLift", "Corner lift", "Moves one source vertex before refinement.", -180, 180, 1, { hardMin: -640, hardMax: 640 }),
  numeric("levels", "Refinement", "Subdivides each triangle fourfold per level.", 0, 4, 1, { hardMin: 0, hardMax: 6, integer: true }),
];

function validateFootprint(params: Layer["params"]): void {
  const w = Number(params.footprintWidth), d = Number(params.footprintDepth);
  const inset = Number(params.inset), step = Number(params.stepDepth), shoulder = Number(params.shoulder);
  if (inset > Math.min(w, d) / 4 || step > .75 * d || shoulder > .75 * w)
    throw Error("Footprint inset, step depth, and shoulder must fit the chosen width and depth");
  if (params.footprint === "stepped" && (step === 0 || shoulder === 0))
    throw Error("A stepped footprint needs positive step depth and shoulder width");
}
function validateSubdivision(params: Layer["params"]): void {
  let faces = params.base === "tetra" ? 4 : params.base === "octa" ? 8 : 2;
  for (let level = 0; level < Number(params.levels); level++) {
    faces *= 4;
    if (faces > 8192) throw Error("Refinement exceeds the 8192-face study budget");
  }
}

const rows = [
  ["extruded-seals", "Extruded seals", "Choose and extrude a polygon footprint.", footprintControls, validateFootprint],
  ["stepped-blocks", "Stepped blocks", "Cut a step into a polygon and extrude it.", footprintControls, validateFootprint],
  ["transported-ribbons", "Transported ribbons", "Transport a variable-width strip along an editable 3D path.", ribbonControls, undefined],
  ["twisting-streamers", "Twisting streamers", "Bend a variable-width strip through independent vertical and depth cycles.", ribbonControls, undefined],
  ["rounded-polyhedra", "Rounded polyhedra", "Refine a selected base mesh with independent axis proportions.", subdivisionControls, validateSubdivision],
  ["subdivided-shells", "Subdivided shells", "Refine closed or open base meshes and control their silhouette.", subdivisionControls, validateSubdivision],
] as const;

export const materialsBDefinitions: StudioDefinition[] = rows.map(([id, title, description, source, validate]) => ({
  id, title, description, parameters: [...source, ...cameraAndSurface],
  defaults: draws.materialsBSettings[id].defaults, validate,
}));
const map = {
  "extruded-seals": "drawExtrudedSeals", "stepped-blocks": "drawSteppedBlocks",
  "transported-ribbons": "drawTransportedRibbons", "twisting-streamers": "drawTwistingStreamers",
  "rounded-polyhedra": "drawRoundedPolyhedra", "subdivided-shells": "drawSubdividedShells",
} as const;
export function drawMaterialsB(p: any, layer: Layer): void {
  const name = map[layer.technique as keyof typeof map], draw = (draws as any)[name];
  if (!draw) throw Error("Unknown materials B technique");
  draw(p, layer);
}
