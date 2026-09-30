import type { MotifSpec, ReferenceComposition, TileFillSpec, TilingRuleName } from "../composition/types.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Scalar = number | string | boolean;
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys: Record<string, true> = { depth: true, colorLevel: true, layers: true, interiorPetals: true, vertexPetals: true, beadPetals: true };
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys[key] === true }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  control(choice(key, label, description, options), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen: Condition): Parameter =>
  control(toggle(key, label, description), visibleWhen);

const marks = ["dot", "rings", "rosette", "arrow"];
const penrose: Condition = { rule: ["penrose-p3"] };
const chair: Condition = { rule: ["chair"] };
const filled: Condition = { interior: ["flat", "wash", "hatch", "concentric"] };
const colored: Condition = { interior: ["flat", "wash", "hatch", "concentric", "mark"] };
const edgesOn: Condition = { edges: ["visible", "all"] };
const stations: Condition = { edges: ["visible", "all"], edgeMaterial: ["stitch", "beads"] };
const beadsOn: Condition = { edges: ["visible", "all"], edgeMaterial: ["beads"] };
const vertexOn: Condition = { vertices: ["all", "interior", "regular"] };
const crops: Condition = { crop: ["rectangle", "ellipse"] };

const markScale = (size: string, weight: string): ControlGroup => ({ label: "Scale", controls: [size, weight], proportional: true });
const markShape = (petals: string, opening: string): ControlGroup => ({ label: "Shape", controls: [petals, opening] });

export const tilingDefinitions: InstrumentDefinition[] = [
  {
    id: "substitution-tilings", title: "Substitution Tilings",
    description: "Nonperiodic tilings grown by exact substitution (Penrose rhombi or the chair), with editable tile interiors, shared edges and vertex marks colored by ancestry.",
    renderer: "2d",
    parameters: [
      select("rule", "Construction", "Penrose rhombi (thin and thick, aperiodic, golden-ratio scaling) or the chair (an L-shaped tile, four copies per substitution).", ["penrose-p3", "chair"]),
      select("penrosePatch", "Seed patch", "What is substituted: five thick rhombi around a point (sun), ten acute half-tiles around a point (decagon), or one thick or thin rhombus.", ["sun", "decagon", "thick", "thin"], penrose),
      select("chairPatch", "Seed patch", "What is substituted: one chair, two chairs forming a 2 x 3 rectangle, or four forming a 4 x 3 block.", ["chair", "rectangle", "block"], chair),
      n("depth", "Depth", "Substitution generations: each one splits every tile into smaller ones inside the same seed patch. Penrose tile counts grow about 2.6 times per generation, the chair four times.", 1, 8, 1, 0, 16),
      select("boundary", "Boundary tiles", "Where the seed boundary cuts a rhombus, keep the leftover half-tile or leave it out for a clean outline.", ["half-tiles", "whole"], penrose),
      n("centerX", "Center X", "Horizontal center of the seed patch.", 80, 560, 1, -320, 960),
      n("centerY", "Center Y", "Vertical center of the seed patch.", 80, 560, 1, -320, 960),
      n("radius", "Patch radius", "Distance from the patch center to its farthest seed vertex. Depth subdivides this region; it never changes its size.", 60, 700, 1, 1, 5000),
      n("rotation", "Rotation", "Turns the whole tiling, clockwise in degrees.", -180, 180, 1, -3600, 3600),
      select("crop", "Crop", "Keep the whole patch, or only the tiles whose centers fall inside a rectangle or ellipse. A large patch cropped small stays cheap: tiles that cannot reach the crop are never built.", ["none", "rectangle", "ellipse"]),
      n("cropX", "Crop center X", "Horizontal center of the crop window; move it to pan across the tiling.", 0, 640, 1, -4096, 4096, crops),
      n("cropY", "Crop center Y", "Vertical center of the crop window.", 0, 640, 1, -4096, 4096, crops),
      n("cropWidth", "Crop width", "Width of the crop window.", 40, 640, 1, 1, 4096, crops),
      n("cropHeight", "Crop height", "Height of the crop window.", 40, 640, 1, 1, 4096, crops),
      flag("showThin", "Thin rhombi", "Draw the thin (36 degree) rhombi; turn off to leave them as bare paper.", penrose),
      flag("showThick", "Thick rhombi", "Draw the thick (72 degree) rhombi; turn off to leave them as bare paper.", penrose),
      flag("showNw", "Chair elbow NW", "Draw chairs whose elbow points to the upper left in the unrotated seed.", chair),
      flag("showNe", "Chair elbow NE", "Draw chairs whose elbow points to the upper right in the unrotated seed.", chair),
      flag("showSe", "Chair elbow SE", "Draw chairs whose elbow points to the lower right in the unrotated seed.", chair),
      flag("showSw", "Chair elbow SW", "Draw chairs whose elbow points to the lower left in the unrotated seed.", chair),
      n("retention", "Tile retention", "Omit tiles at random without moving any other tile; edges and vertex marks follow the tiles that remain.", 0, 1, .01, 0, 1),
      select("interior", "Interior", "Flat paint, layered watercolor wash, hatching, concentric outlines, or one mark per tile. Every tile is drawn in its own frame, so hatching and marks turn with it.", ["none", "flat", "wash", "hatch", "concentric", "mark"]),
      select("colorBy", "Color by", "Class colors thin and thick tiles differently. Ancestor colors by the kind of supertile a tile came from, slot by which child of its parent it is, supertile gives every supertile its own color.", ["class", "ancestor", "slot", "supertile"], colored),
      n("colorLevel", "Ancestor level", "How many generations up the color is taken from: 1 is the parent, larger values group tiles into ever bigger supertiles.", 1, 8, 1, 1, 16, { interior: ["flat", "wash", "hatch", "concentric", "mark"], colorBy: ["ancestor", "slot", "supertile"] }),
      n("inset", "Inset", "Clearance between the interior and every tile edge.", 0, 12, .25, 0, 500, filled),
      n("opacity", "Opacity", "Paint strength of the interior.", 0, 1, .01, 0, 1, filled),
      n("bleed", "Wash bleed", "How far each wash layer wanders from the tile outline, as a fraction of tile size; a new seed reshuffles it.", 0, 1, .01, 0, 1, { interior: ["wash"] }),
      n("layers", "Wash layers", "Translucent passes that build up the wash.", 1, 6, 1, 1, 8, { interior: ["wash"] }),
      n("hatchSpacing", "Line spacing", "Distance between hatch lines or concentric outlines.", 2, 24, .25, 1, 1000, { interior: ["hatch", "concentric"] }),
      n("hatchAngle", "Hatch angle", "Hatch direction relative to the tile's own axis, in degrees.", -90, 90, 1, -3600, 3600, { interior: ["hatch"] }),
      n("classTurn", "Turn per class", "Extra hatch turn added for each tile class index, so thin and thick tiles hatch in different directions.", -90, 90, 1, -3600, 3600, { interior: ["hatch"] }),
      n("interiorWeight", "Line weight", "Stroke width of hatch lines and concentric outlines.", .2, 4, .05, 0, 50, { interior: ["hatch", "concentric"] }),
      select("interiorMark", "Tile mark", "The mark drawn at each tile center, turned with the tile; the arrow shows orientation.", marks, { interior: ["mark"] }),
      n("interiorSize", "Mark size", "Mark diameter as a fraction of the tile's own size.", .1, 1.4, .01, 0, 1.5, { interior: ["mark"] }),
      n("interiorPetals", "Mark petals", "Radial strokes in each rosette.", 3, 14, 1, 1, 48, { interior: ["mark"], interiorMark: ["rosette"] }),
      n("interiorOpening", "Mark opening", "Open center of rosettes or inner ring offset.", 0, .9, .01, 0, 1, { interior: ["mark"], interiorMark: ["rings", "rosette"] }),
      n("interiorMarkWeight", "Mark line weight", "Stroke width of ring outlines, rosette petals and arrows.", .2, 4, .05, 0, 50, { interior: ["mark"], interiorMark: ["rings", "rosette", "arrow"] }),
      select("edges", "Shared edges", "Draw each shared edge once: around the tiles that are drawn, around every tile including omitted ones, or not at all.", ["none", "visible", "all"]),
      select("edgeColor", "Edge color", "Uniform ink, or colored by hierarchy: the coarsest boundaries (the patch outline and the seed-piece borders first) take the accent colors in order; finer edges stay ink.", ["uniform", "hierarchy"], edgesOn),
      select("edgeMaterial", "Edge material", "Ink, stitches or beads along every shared edge.", ["ink", "stitch", "beads"], edgesOn),
      n("edgeWeight", "Edge weight", "Line thickness of ink and stitches.", .2, 5, .05, 0, 50, { edges: ["visible", "all"], edgeMaterial: ["ink", "stitch"] }),
      n("edgeSpacing", "Station spacing", "Distance between stitch or bead stations along an edge.", 3, 30, .5, .5, 1000, stations),
      n("edgePhase", "Station phase", "Slides stations along each edge by a fraction of their spacing.", 0, 1, .01, 0, 1, stations),
      n("edgePhaseSpread", "Cross-edge phase", "Stable spread of station phase between edges so neighboring stitches stop lining up.", 0, 1, .01, 0, 1, stations),
      n("levelRamp", "Size ramp by level", "Shrink beads on finer edges, so coarse supertile boundaries read as larger beads.", 0, 1, .01, 0, 1, beadsOn),
      select("beadMark", "Bead motif", "Point vocabulary on each bead station.", marks, beadsOn),
      n("beadSize", "Bead diameter", "Size of each bead motif.", 1, 20, .5, 0, 500, beadsOn),
      n("beadPetals", "Bead petals", "Radial strokes in rosette beads.", 3, 14, 1, 1, 48, { edges: ["visible", "all"], edgeMaterial: ["beads"], beadMark: ["rosette"] }),
      n("beadOpening", "Bead opening", "Open center of rosette beads or inner ring offset.", 0, .9, .01, 0, 1, { edges: ["visible", "all"], edgeMaterial: ["beads"], beadMark: ["rings", "rosette"] }),
      n("beadWeight", "Bead line weight", "Thickness of ring outlines, rosette petals and arrows.", .2, 3, .05, 0, 50, { edges: ["visible", "all"], edgeMaterial: ["beads"], beadMark: ["rings", "rosette", "arrow"] }),
      select("vertices", "Vertex marks", "Mark all tile corners, only interior ones, or only regular vertices where equal corners close the turn (the Penrose sun, the chair four-corner points). Marks are colored by how many corners meet.", ["none", "all", "interior", "regular"]),
      select("vertexMark", "Vertex mark", "Mark drawn at each chosen vertex.", marks, vertexOn),
      n("vertexSize", "Vertex size", "Diameter of each vertex mark.", 0, 40, .5, 0, 500, vertexOn),
      n("vertexPetals", "Vertex petals", "Radial strokes in rosette marks.", 3, 14, 1, 1, 48, { vertices: ["all", "interior", "regular"], vertexMark: ["rosette"] }),
      n("vertexOpening", "Vertex opening", "Open center of rosettes or inner ring offset.", 0, .9, .01, 0, 1, { vertices: ["all", "interior", "regular"], vertexMark: ["rings", "rosette"] }),
      n("vertexWeight", "Vertex line weight", "Thickness of ring outlines, rosette petals and arrows.", .2, 4, .05, 0, 50, { vertices: ["all", "interior", "regular"], vertexMark: ["rings", "rosette", "arrow"] }),
    ],
    controlGroups: [
      { label: "Tiling", stage: "form", controls: ["rule", "penrosePatch", "chairPatch", "depth", "boundary"] },
      { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "radius", "rotation"] },
      { label: "Crop", stage: "frame", controls: ["crop", "cropX", "cropY", { label: "Size", controls: ["cropWidth", "cropHeight"], proportional: true }] },
      { label: "Tiles", stage: "material", controls: [{ label: "Classes", controls: ["showThin", "showThick", "showNw", "showNe", "showSe", "showSw"] }, "retention"] },
      { label: "Interior", stage: "material", controls: ["interior", { label: "Color", controls: ["colorBy", "colorLevel"] }, "inset", "opacity",
        { label: "Wash", controls: ["bleed", "layers"] },
        { label: "Hatch", controls: ["hatchSpacing", "hatchAngle", "classTurn", "interiorWeight"] },
        { label: "Tile mark", controls: ["interiorMark", "interiorSize", "interiorMarkWeight", markShape("interiorPetals", "interiorOpening")] }] },
      { label: "Edges", stage: "material", controls: ["edges", "edgeColor", "edgeMaterial", "edgeWeight",
        { label: "Stations", controls: ["edgeSpacing", "edgePhase", "edgePhaseSpread"] }, "levelRamp",
        { label: "Bead mark", controls: ["beadMark", markScale("beadSize", "beadWeight"), markShape("beadPetals", "beadOpening")] }] },
      { label: "Vertices", stage: "material", controls: ["vertices", "vertexMark", markScale("vertexSize", "vertexWeight"), markShape("vertexPetals", "vertexOpening")] },
    ],
    defaults: { rule: "penrose-p3", penrosePatch: "sun", chairPatch: "chair", depth: 5, boundary: "half-tiles",
      centerX: 320, centerY: 320, radius: 290, rotation: 0,
      crop: "none", cropX: 320, cropY: 320, cropWidth: 480, cropHeight: 480,
      showThin: true, showThick: true, showNw: true, showNe: true, showSe: true, showSw: true, retention: 1,
      interior: "wash", colorBy: "supertile", colorLevel: 3, inset: 1, opacity: .85, bleed: .35, layers: 3,
      hatchSpacing: 3.5, hatchAngle: 0, classTurn: 72, interiorWeight: 1.1,
      interiorMark: "arrow", interiorSize: .6, interiorPetals: 6, interiorOpening: .3, interiorMarkWeight: 1,
      edges: "visible", edgeColor: "uniform", edgeMaterial: "ink", edgeWeight: .9, edgeSpacing: 6, edgePhase: .3, edgePhaseSpread: 0, levelRamp: 0,
      beadMark: "dot", beadSize: 4, beadPetals: 6, beadOpening: .4, beadWeight: 1,
      vertices: "regular", vertexMark: "rosette", vertexSize: 24, vertexPetals: 8, vertexOpening: .3, vertexWeight: 1.2 },
  },
];

/** Resolve validated named controls to the public JSON-compatible tiling recipe. */
export function tilingComposition(q: Record<string, Scalar>, seed: number, palette: readonly number[]): Extract<ReferenceComposition, { kind: "tiling" }> {
  const rule = q.rule as TilingRuleName;
  const spec = (kind: string, size: unknown, petals: unknown, opening: unknown, weight: unknown): MotifSpec => ({
    kind: kind as MotifSpec["kind"], size: size as number, petals: petals as number, opening: opening as number,
    weight: weight as number, rotation: 0, variation: 0, retention: 1 });
  const classes = rule === "penrose-p3"
    ? [q.showThin && "thin", q.showThick && "thick"]
    : [q.showNw && "nw", q.showNe && "ne", q.showSe && "se", q.showSw && "sw"];
  const fill: TileFillSpec = { kind: q.interior as TileFillSpec["kind"], inset: q.inset as number, opacity: q.opacity as number,
    spacing: q.hatchSpacing as number, angle: q.hatchAngle as number, classTurn: q.classTurn as number, weight: q.interiorWeight as number,
    layers: q.layers as number, bleed: q.bleed as number, retention: 1,
    mark: spec(q.interiorMark as string, q.interiorSize, q.interiorPetals, q.interiorOpening, q.interiorMarkWeight) };
  const crop = q.crop as "none" | "rectangle" | "ellipse";
  return { kind: "tiling", palette: [...palette],
    source: { seed, rule, patch: (rule === "penrose-p3" ? q.penrosePatch : q.chairPatch) as string,
      depth: q.depth as number, centerX: q.centerX as number, centerY: q.centerY as number, radius: q.radius as number,
      rotation: q.rotation as number, boundary: rule === "penrose-p3" ? q.boundary as "half-tiles" | "whole" : "half-tiles",
      crop, cropX: q.cropX as number, cropY: q.cropY as number, cropWidth: q.cropWidth as number, cropHeight: q.cropHeight as number },
    view: { classes: classes.filter((name): name is string => typeof name === "string"), retention: q.retention as number,
      colorBy: q.colorBy as "class" | "ancestor" | "slot" | "supertile", colorLevel: q.colorLevel as number, fill,
      edges: q.edges as "none" | "visible" | "all", edgeColor: q.edgeColor as "uniform" | "hierarchy",
      edgeMaterial: { kind: q.edgeMaterial as "ink" | "stitch" | "beads", weight: q.edgeWeight as number, spacing: q.edgeSpacing as number,
        phase: q.edgePhase as number, phaseSpread: q.edgePhaseSpread as number, levelRamp: q.levelRamp as number, retention: 1,
        mark: spec(q.beadMark as string, q.beadSize, q.beadPetals, q.beadOpening, q.beadWeight) },
      vertices: q.vertices as "none" | "all" | "interior" | "regular",
      vertexMark: spec(q.vertexMark as string, q.vertexSize, q.vertexPetals, q.vertexOpening, q.vertexWeight) } };
}
