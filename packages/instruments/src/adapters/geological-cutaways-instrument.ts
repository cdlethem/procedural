import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["strata", "faultCount", "resolution", "beds", "contours"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

const folded: Condition = { fold: ["sinusoidal", "chevron", "dome"] };
const faulted: Condition = { faulted: [true] };
const eroded: Condition = { ground: ["eroded"] };
const graded: Condition = { sequence: ["thinning", "thickening", "rhythmic", "random"] };
const sliced: Condition = { cut: ["slice", "exploded"] };
const cornered: Condition = { cut: ["corner"] };
const exploded: Condition = { cut: ["exploded"] };
const perspective: Condition = { projection: ["perspective"] };
const filled: Condition = { fill: ["flat", "shaded"] };
const shaded: Condition = { fill: ["shaded"] };

const parameters: Parameter[] = [
  n("strata", "Strata", "Rock units in the stack, from the oldest at the base to the youngest at the surface. The oldest and the youngest run to the base and the surface; the ones between have thickness. More units make thinner layers and a finer section.", 3, 12, 1, 2, 16),
  select("sequence", "Thickness sequence", "How thickness varies up the stack: all equal, thinning or thickening upward, alternating thick and thin, or seeded random. A new seed re-rolls a random sequence.",
    [["uniform", "Uniform"], ["thinning", "Thinning upward"], ["thickening", "Thickening upward"], ["rhythmic", "Alternating"], ["random", "Random"]]),
  n("contrast", "Thickness contrast", "Ratio of the thickest to the thinnest unit in the sequence. 1 makes every unit equal whatever the sequence.", 1, 8, 0.1, 1, 40, graded),
  n("stack", "Stack depth", "Combined thickness of the units between the oldest and the youngest, as a fraction of the block height. Under 1 leaves thick basement and cover; over 1 pushes the stack through the top and base so more units outcrop or vanish.", 0.5, 1.6, 0.01, 0.2, 3),
  n("trend", "Thickness trend", "Lateral wedging: alternate units thicken toward one side of the block while their neighbours thin, so the contacts fan out instead of running parallel. 0 keeps every unit the same thickness everywhere.", -0.8, 0.8, 0.01, -1, 1),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the block.", 100, 540, 1, -100000, 100000),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the block.", 100, 540, 1, -100000, 100000),
  n("size", "Block size", "Canvas diameter of the sphere that contains the whole block (including an exploded cut), so any camera angle fits the same footprint.", 200, 560, 1, 20, 100000),

  n("tilt", "Tilt", "Dip of the whole stack in degrees, before folds and faults. The layers meet the walls and the surface at an angle.", -25, 25, 0.5, -60, 60),
  n("tiltAzimuth", "Tilt direction", "Direction the stack descends toward, in degrees from the block's right-hand side (+x) toward the front (+z).", -180, 180, 1, -1e6, 1e6),

  select("fold", "Fold type", "Sinusoidal: smooth waves; chevron: straight limbs and sharp hinges; dome: closed domes and basins (a horizontal cut then shows rings); none: undeformed layers.",
    [["none", "None"], ["sinusoidal", "Sinusoidal"], ["chevron", "Chevron"], ["dome", "Domes and basins"]]),
  n("foldAmplitude", "Fold amplitude", "Half the crest-to-trough height of the folds, as a fraction of the block height.", 0, 0.4, 0.005, 0, 2, folded),
  n("foldWavelength", "Fold wavelength", "Distance between crests as a fraction of the block width.", 0.3, 2, 0.01, 0.05, 20, folded),
  n("foldAxis", "Fold axis", "Direction of the hinge lines, in degrees from +x toward +z. 90 gives folds you see end-on in the right-hand face.", -90, 90, 1, -1e6, 1e6, folded),
  n("foldPhase", "Fold phase", "Slides the folds across the block, in degrees of one wavelength, added to the seeded phase.", -180, 180, 1, -1e6, 1e6, folded),

  flag("faulted", "Faults", "Cut the block by a family of parallel planar faults that shift the layers along the fault plane."),
  n("faultCount", "Fault count", "Number of parallel faults, evenly spaced across the block.", 1, 4, 1, 1, 6, faulted),
  n("faultThrow", "Fault throw", "Vertical offset of each fault as a fraction of the block height. Positive drops the hanging wall (normal fault), negative raises it (reverse fault). Every layer is offset by exactly this across the plane.", -0.3, 0.3, 0.005, -3, 3, faulted),
  n("faultDip", "Fault dip", "Angle of the fault planes from horizontal. 90 is vertical; shallower planes give a longer slip and a wider offset at the surface. Steep folds and tilts need a steep enough dip.", 35, 90, 1, 5, 90, faulted),
  select("faultStrike", "Fault strike", "Whether the faults run into the picture (their dip shows on the front face) or across it (their dip shows on the right-hand face).",
    [["depth", "Into the picture"], ["width", "Across the picture"]], faulted),
  select("faultDipDirection", "Dips toward", "Which way the fault planes lean, seen across the strike from the default camera.", [["left", "Left"], ["right", "Right"]], faulted),
  select("faultStyle", "Fault pattern", "Stepped: every fault the same sense, a staircase; alternating: sense alternates, giving horsts and grabens; mixed: seeded random senses.",
    [["stepped", "Stepped"], ["alternating", "Alternating"], ["mixed", "Mixed"]], faulted),
  n("faultShift", "Fault position", "Slides the whole family across the block, as a fraction of one fault spacing.", -0.4, 0.4, 0.01, -0.45, 0.45, faulted),
  n("faultScatter", "Fault scatter", "Seeded irregularity of fault spacing and throw. 0 gives an even family with equal throws.", 0, 1, 0.01, 0, 1, faulted),

  select("ground", "Ground surface", "Flat: the top of the block is level, so folds and tilt appear as outcrop bands. Eroded: valleys are cut into it, exposing older units in the low ground.",
    [["flat", "Flat"], ["eroded", "Eroded"]]),
  n("relief", "Erosion depth", "Depth of the valleys as a fraction of the block height.", 0, 0.4, 0.005, 0, 0.9, eroded),
  n("reliefScale", "Valley spacing", "Wavelength of the valleys as a fraction of the block width.", 0.3, 2, 0.01, 0.05, 20, eroded),

  n("depth", "Block depth", "Front-to-back size as a fraction of the block width.", 0.4, 1.4, 0.01, 0.2, 4),
  n("height", "Block height", "Height as a fraction of the block width.", 0.25, 0.9, 0.01, 0.1, 3),
  n("resolution", "Grid resolution", "Cells along the longer horizontal side of every layer surface. Finer grids follow tight folds and faults more closely and cost more to build; the count of layers, faults and cells together is bounded.", 16, 60, 1, 8, 120),

  select("cut", "Cutaway", "Whole block; one slice plane that removes the near side and exposes the layers on it; a corner box cut out to expose three faces; or the block split along a plane and pulled apart.",
    [["block", "Whole block"], ["slice", "Slice"], ["corner", "Corner cut"], ["exploded", "Exploded"]]),
  n("slicePosition", "Slice position", "Where the plane sits across the block along its normal: 0 at the far side, 1 at the near side.", 0.1, 0.9, 0.01, 0.02, 0.98, sliced),
  n("sliceAzimuth", "Slice direction", "Direction the plane's normal points toward (the removed side), in degrees from +x toward +z. 0 exposes a face across the right-hand side, 90 a face parallel to the front.", -180, 180, 1, -1e6, 1e6, sliced),
  n("sliceDip", "Slice dip", "Dip of the plane from horizontal: 90 is a vertical section, 0 a horizontal map slice, in between an oblique cut.", 10, 90, 1, 1, 90, sliced),
  n("gap", "Explosion", "How far the removed half moves along the plane normal, as a fraction of the block diagonal.", 0.05, 0.6, 0.01, 0, 1.5, exploded),
  select("corner", "Corner", "Which top corner of the block is cut away.", [["front-right", "Front right"], ["front-left", "Front left"], ["back-right", "Back right"], ["back-left", "Back left"]], cornered),
  n("cutWidth", "Cut width", "Share of the block width removed at the corner.", 0.15, 0.85, 0.01, 0.02, 0.98, cornered),
  n("cutDepth", "Cut depth", "Share of the block depth removed at the corner.", 0.15, 0.85, 0.01, 0.02, 0.98, cornered),
  n("cutHeight", "Cut height", "Share of the block height removed from the top.", 0.15, 0.85, 0.01, 0.02, 0.98, cornered),

  select("projection", "Projection", "Orthographic keeps parallel edges parallel; perspective converges them and makes the near corner larger.", [["orthographic", "Orthographic"], ["perspective", "Perspective"]]),
  n("yaw", "Yaw", "Turns the block about the vertical axis, in degrees. 0 looks at the front face; positive swings the viewpoint toward the right-hand face.", -180, 180, 1, -1e6, 1e6),
  n("pitch", "Pitch", "Raises the viewpoint above the block in degrees; 0 is level with it, 90 looks straight down, negative looks up from below.", 5, 80, 1, -90, 90),
  n("distance", "Viewing distance", "Distance to the eye as a multiple of the block's size. Small values give strong perspective.", 1.6, 8, 0.1, 1.05, 100, perspective),

  select("fill", "Fill", "Shaded: strata colors darkened by the direction each face points; flat: strata colors only; none: lines only, which keeps every contact, fault and edge legible.",
    [["shaded", "Shaded"], ["flat", "Flat"], ["none", "None"]]),
  n("shade", "Shading", "How strongly faces turned away from the light darken: 0 is flat color.", 0, 1, 0.01, 0, 1, shaded),
  n("opacity", "Fill opacity", "Paint strength of the fills. Below 1 the layers behind show through the ones in front.", 0.2, 1, 0.01, 0, 1, filled),
  select("colorBy", "Color by", "Palette entries by unit, repeating up the stack, or one smooth ramp through the palette from the oldest to the youngest unit. The first palette entry is ink.",
    [["cycle", "Cycle"], ["ramp", "Ramp"]]),

  select("lineColor", "Line color", "Ink, or the palette entry of the unit beside each contact line.", [["ink", "Ink"], ["stratum", "By stratum"]]),
  select("hidden", "Hidden edges", "Drop lines behind the block, or draw the hidden block edges and faults as faint dashes.", [["drop", "Drop"], ["dashed", "Dashed"]]),
  n("beds", "Bedding lines", "Fine lines inside each unit, parallel to its contacts, on walls, cut faces and the ground surface.", 0, 6, 1, 0, 6),
  n("contours", "Ground contours", "Topographic contour lines of the eroded surface (drawn only when it has relief).", 0, 12, 1, 0, 60),
  n("outlineWeight", "Outline weight", "Line thickness of block edges and the boundary of every cut face.", 0.2, 3, 0.05, 0, 50),
  n("contactWeight", "Contact weight", "Line thickness of the boundaries between units.", 0.2, 3, 0.05, 0, 50),
  n("faultWeight", "Fault weight", "Line thickness of fault traces.", 0.2, 4, 0.05, 0, 50),
  n("bedWeight", "Bedding weight", "Line thickness of bedding lines.", 0.1, 2, 0.05, 0, 50),
  n("contourWeight", "Contour weight", "Line thickness of ground contours.", 0.1, 2, 0.05, 0, 50),
];

const controlGroups: ControlGroup[] = [
  { label: "Strata", controls: ["strata", "sequence", "contrast", "stack", "trend"] },
  { label: "Placement", controls: ["centerX", "centerY", "size"] },
  { label: "Tilt", controls: ["tilt", "tiltAzimuth"] },
  { label: "Folds", controls: ["fold", "foldAmplitude", "foldWavelength", "foldAxis", "foldPhase"] },
  { label: "Faults", controls: ["faulted", "faultCount", "faultThrow", "faultDip", "faultStrike", "faultDipDirection", "faultStyle", "faultShift", "faultScatter"] },
  { label: "Erosion", controls: ["ground", "relief", "reliefScale"] },
  { label: "Block", controls: [{ label: "Proportions", controls: ["depth", "height"], proportional: true }, "resolution"] },
  { label: "Cutaway", controls: ["cut", { label: "Slice", controls: ["slicePosition", "sliceAzimuth", "sliceDip"] }, "gap", { label: "Corner", controls: ["corner", "cutWidth", "cutDepth", "cutHeight"] }] },
  { label: "View", controls: ["projection", "yaw", "pitch", "distance"] },
  { label: "Fill", controls: ["fill", "shade", "opacity", "colorBy"] },
  { label: "Lines", controls: ["lineColor", "hidden", "beds", "contours", { label: "Line weights", controls: ["outlineWeight", "contactWeight", "faultWeight", "bedWeight", "contourWeight"], proportional: true }] },
];

export const geologicalCutawaysDefinition: InstrumentDefinition = {
  id: "geological-cutaways", title: "Geological Cutaways",
  description: "A layered block of strata with tilt, folds, planar faults and an eroded surface, cut open along slice planes, corners or exploded halves: sections painted by stratum, outcrops on the ground, fault traces and contact lines with hidden-line removal.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    strata: 8, sequence: "random", contrast: 3, stack: 1, trend: 0.25,
    centerX: 320, centerY: 322, size: 540,
    tilt: 4, tiltAzimuth: 20,
    fold: "sinusoidal", foldAmplitude: 0.1, foldWavelength: 0.9, foldAxis: 25, foldPhase: 0,
    faulted: true, faultCount: 2, faultThrow: 0.09, faultDip: 62, faultStrike: "depth", faultDipDirection: "left", faultStyle: "stepped", faultShift: 0, faultScatter: 0.25,
    ground: "eroded", relief: 0.08, reliefScale: 0.9,
    depth: 0.8, height: 0.55, resolution: 44,
    cut: "corner", slicePosition: 0.5, sliceAzimuth: 30, sliceDip: 90, gap: 0.25, corner: "front-right", cutWidth: 0.5, cutDepth: 0.5, cutHeight: 0.45,
    projection: "orthographic", yaw: 32, pitch: 26, distance: 3.5,
    fill: "shaded", shade: 0.5, opacity: 1, colorBy: "cycle",
    lineColor: "ink", hidden: "drop", beds: 2, contours: 0,
    outlineWeight: 1.6, contactWeight: 0.9, faultWeight: 1.6, bedWeight: 0.4, contourWeight: 0.5,
  },
};
