import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { GROWTH_FIELD_KINDS, checkSurfaceGrowthControls } from "../composition/surface-growth-controls.js";
import { GROWTH_SEED_KINDS } from "../composition/growth-seeds.js";
import { GROWTH_LIMITS, GROWTH_PINS } from "../composition/surface-growth.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["resolution", "sweeps", "steps", "maxVertices", "levels", "grains"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number, hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, [...options]), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => withCondition(toggle(key, label, description), visibleWhen);

const open: Condition = { surface: ["sheet", "disc", "strip"] };
const ringed: Condition = { field: ["edge", "radial"] };
const radial: Condition = { field: ["radial"] };
const striped: Condition = { field: ["stripes"] };
const noisy: Condition = { field: ["noise"] };
const spotted: Condition = { spot: [true] };
const refined: Condition = { refine: [true] };
const filled: Condition = { faces: ["flat", "shaded"] };
const shaded: Condition = { faces: ["facets", "shaded"] };
const contoured: Condition = { lines: ["contour", "both"] };
const wired: Condition = { lines: ["wire", "both"] };
const creased: Condition = { lines: ["contour", "both"] };
const faded: Condition = { hidden: ["fade"] };
const levelled: Condition = { levelBy: ["growth", "stretch", "height", "depth"] };
const perspective: Condition = { projection: ["perspective"] };

const parameters: Parameter[] = [
  select("surface", "Seed surface", "The flat or closed skin that grows: a square sheet, a disc, a long strip (all lying flat, ready to buckle upward) or a sphere. Every one is a triangulated mesh; growth starts from its material lengths.", GROWTH_SEED_KINDS),
  n("resolution", "Resolution", "Vertex density of the seed surface: cells per side of the sheet, twice the rings of the disc, cells across the strip, or (as its logarithm) the subdivisions of the sphere. Refinement adds detail where the skin stretches on top of this.", 8, 24, 1, 4, 60),
  n("perturb", "Perturbation", "Random push of every free vertex along the surface normal at the start, as a fraction of a seed edge (from each vertex's own stream). A perfectly flat sheet under compression has no reason to buckle in one direction; this is the nudge. 0 keeps it exactly flat.", 0, 0.6, 0.01, 0, 1),

  n("centerX", "Center X", "Horizontal canvas position of the surface's center (the world origin).", 0, 640, 1, 0, 640),
  n("centerY", "Center Y", "Vertical canvas position of the surface's center (the world origin).", 0, 640, 1, 0, 640),
  n("size", "Size", "Radius on the canvas, in canvas units, of the sphere about the surface's center that contains all of it. The picture is framed to the grown surface, so a surface that has grown larger still fills the same space; only the view changes, never the growth.", 100, 320, 1, 1, 4000),

  select("field", "Growth field", "Where the skin is allowed to expand: near its edge, in a ring around a point, in stripes, in seeded blobs, or everywhere. Growth goes where this field is high; the rest is pushed into folds. A sphere has no edge, so there Edge grows a cap around its pole with the same Band width.", GROWTH_FIELD_KINDS),
  n("fieldWidth", "Band width", "Width of the growing band in seed units: how far from the edge growth reaches, or the Gaussian half width of the ring.", 0.1, 1.2, 0.01, 0.01, 10, ringed),
  n("fieldRadius", "Ring radius", "Radius of the growing ring around its center, in seed units. 0 grows a round spot.", 0, 1.4, 0.01, 0, 10, radial),
  n("fieldX", "Ring center X", "Horizontal position of the ring's center on the seed (-1 to 1). On the sphere the center sits on the surface above this point.", -1, 1, 0.01, -2, 2, radial),
  n("fieldY", "Ring center Y", "Vertical position of the ring's center on the seed (-1 to 1), measured along the seed's second flat axis.", -1, 1, 0.01, -2, 2, radial),
  n("stripeCount", "Stripes", "Periods of the growth stripes across two seed units: more stripes make finer ruffles.", 1, 10, 0.1, 0.5, 40, striped),
  n("stripeAngle", "Stripe angle", "Direction of the stripes in degrees, turning them about the seed's center.", -90, 90, 1, -3600, 3600, striped),
  n("stripeSharp", "Stripe sharpness", "0 grows smoothly across each stripe; 1 makes growth all-or-nothing with narrow transitions.", 0, 1, 0.01, 0, 1, striped),
  n("noiseScale", "Blob scale", "Size of the growth blobs: larger values make smaller, more numerous blobs. Two octaves of gradient noise seeded by the seed.", 0.5, 5, 0.05, 0.05, 40, noisy),
  n("noiseContrast", "Blob contrast", "How sharply blobs separate growth from no growth: 1 keeps the noise soft; large values make patches of full growth in still skin.", 1, 8, 0.1, 0.1, 20, noisy),
  n("baseline", "Baseline growth", "Growth every point receives regardless of the field, as a share of the full rate. 0 confines growth to the field; raising it swells the whole skin so folds become uniform.", 0, 0.5, 0.01, 0, 1),
  flag("spot", "Hot spot", "Add a second growing region: a round spot the field's own region is joined with (the larger of the two wins)."),
  n("spotX", "Spot X", "Horizontal position of the hot spot on the seed (-1 to 1).", -1, 1, 0.01, -2, 2, spotted),
  n("spotY", "Spot Y", "Vertical position of the hot spot on the seed (-1 to 1).", -1, 1, 0.01, -2, 2, spotted),
  n("spotWidth", "Spot width", "Gaussian half width of the hot spot in seed units.", 0.05, 0.8, 0.01, 0.01, 10, spotted),

  n("rate", "Growth rate", "How much a vertex in full growth lengthens each step, as a fraction of its length. A step multiplies its growth scale by 1 + rate × field, up to the limit.", 0.005, 0.08, 0.001, 0, GROWTH_LIMITS.maxRate),
  n("limit", "Growth limit", "Largest expansion of any part of the skin: 2 lets edges grow to twice their seed length. When every growing part reaches it, growth has ended and the skin only settles.", 1.2, 5, 0.05, 1, GROWTH_LIMITS.maxScale),
  n("steps", "Steps", "How many growth steps have run. Scrub it to watch the ruffles form: earlier steps are the same skin, younger; it is one run, extended or replayed from a checkpoint, never re-rolled.", 0, 160, 1, 0, GROWTH_LIMITS.maxSteps),

  n("bending", "Bending", "Stiffness of the folds relative to stretching, in bending rigidity (stretch modulus × seed unit²). Low values give many tight ruffles; higher ones give a few broad, smooth folds; 0 is a limp skin.", 0, 0.01, 0.0001, 0, 1),
  select("pin", "Pin", "Hold part of the skin still: nothing, its whole rim, one center vertex, or one side (the left edge of a sheet or strip, the left arc of a disc). Pinned parts never move, so the free part buckles against them. The sphere has no rim and ignores it.", GROWTH_PINS, open),
  n("sweeps", "Relaxation", "Relaxation sweeps per step, at most (a step ends early once the skin has settled). More sweeps follow the growth more exactly; fewer make the skin lag and the folds soften. Cost is proportional.", 4, 16, 1, 1, GROWTH_LIMITS.maxSweeps),
  n("thickness", "Contact distance", "Vertices closer than this (in seed edges) that are not neighbours push apart, so ruffles that fold over each other keep apart. 0 lets folds pass through one another; this does not stop faces crossing between vertices.", 0, 1.2, 0.01, 0, GROWTH_LIMITS.maxThickness),

  flag("refine", "Refine", "Split the skin's longest edges as it stretches, so growing regions get the detail their new length needs. Off keeps the seed's triangles."),
  n("edgeLimit", "Edge limit", "An edge longer than this many seed edges is split at its midpoint (both its triangles). Lower values make finer, more detailed ruffles and use more vertices.", 1.2, 3, 0.05, GROWTH_LIMITS.minEdgeLimit, GROWTH_LIMITS.maxEdgeLimit, refined),
  n("maxVertices", "Vertex limit", "The most vertices the refined skin may have. Once it is reached, longer edges stay unsplit (the frame counts how many were refused); it may not be below the seed's own vertex count.", 300, 1400, 10, 8, GROWTH_LIMITS.maxVertices, refined),

  select("faces", "Faces", "How the skin's triangles are painted, far to near so nearer folds hide farther ones: not at all, in one flat color, lit with each triangle's own normal (facets), or lit with normals smoothed across triangles.", ["none", "flat", "facets", "shaded"]),
  select("backFaces", "Underside", "How faces turned away from the camera are painted: like the top, mixed toward the line color so the two sides read differently, or not at all.", ["same", "tinted", "hidden"], filled),
  n("faceOpacity", "Face opacity", "Opacity of the painted faces. Below 1 the far folds show through the near ones.", 0.05, 1, 0.01, 0, 1, filled),
  n("lightAzimuth", "Light direction", "Where the light comes from around the view, in degrees: 0 from above, positive to the right. The light is fixed to the view, so orbiting does not change how a fold is lit.", -180, 180, 1, -3600, 3600, shaded),
  n("lightElevation", "Light height", "How far toward the viewer the light stands, in degrees: 0 rakes the surface from the side, 90 lights it flat-on.", 0, 90, 1, 0, 90, shaded),
  n("lightStrength", "Light strength", "How far lit and shadowed faces differ: 0 paints every face the same, 1 lets the shadow side fall to a dark ambient.", 0, 1, 0.01, 0, 1, shaded),
  select("colorBy", "Color by", "Color faces and grains by a measured quantity: how much each part has grown, its stretch (compression to tension), or how many times refinement split it. Colors ramp through the palette.", ["none", "growth", "stretch", "depth"]),

  select("lines", "Lines", "Which edges are drawn with hidden-line removal: silhouette, rim and creases; every mesh edge; both; or none.", ["none", "contour", "wire", "both"]),
  n("creaseAngle", "Crease angle", "Also draw edges where the surface folds sharper than this many degrees. 0 draws only silhouettes and the rim.", 0, 120, 1, 0, 180, creased),
  select("hidden", "Hidden lines", "What happens to parts of a line behind the surface: removed, or drawn faintly.", ["remove", "fade"]),
  n("hiddenOpacity", "Hidden opacity", "Opacity of the hidden part of a line.", 0.05, 0.6, 0.01, 0, 1, faded),
  select("lineMaterial", "Line material", "How lines are drawn: continuous ink, stitches, or beads along the line.", ["ink", "stitch", "beads"]),
  n("contourWeight", "Contour weight", "Stroke width of silhouettes and the rim; creases use 0.7 of it.", 0.3, 3, 0.05, 0, 50, contoured),
  n("wireWeight", "Wire weight", "Stroke width of the mesh edges.", 0.2, 2, 0.05, 0, 50, wired),
  select("levelBy", "Level lines", "Draw lines of equal value across the surface: growth, stretch, height or refinement depth. They follow the folds and are hidden where the surface hides them.", ["none", "growth", "stretch", "height", "depth"]),
  n("levels", "Levels", "How many level lines, evenly spaced inside the range of the chosen quantity (for depth: one per split generation, up to this many).", 2, 24, 1, 1, 60, levelled),
  n("levelWeight", "Level weight", "Stroke width of the level lines.", 0.2, 2, 0.05, 0, 50, levelled),

  n("grains", "Grains", "Marks scattered evenly over the surface, at least those the surface does not hide, far to near, each smaller the farther it is. 0 draws none; more only adds grains.", 0, 8000, 50, 0, 100000),
  select("grainMark", "Grain mark", "Shape of each grain: dot, rings or rosette.", ["dot", "rings", "rosette"]),
  n("grainSize", "Grain size", "Diameter of a grain at the surface's center depth, in canvas units.", 1, 12, 0.1, 0, 200),

  select("projection", "Projection", "Perspective shrinks what is farther; orthographic keeps the same scale at every depth.", ["perspective", "orthographic"]),
  n("yaw", "Yaw", "Turn around the vertical axis, in degrees.", -180, 180, 1, -3600, 3600),
  n("pitch", "Pitch", "Height of the eye above the surface, in degrees: 0 sees the flat skin edge-on, 90 looks straight down.", -90, 90, 1, -90, 90),
  n("roll", "Roll", "Turns the picture clockwise on the canvas, in degrees.", -180, 180, 1, -3600, 3600),
  n("distance", "Eye distance", "Distance of the eye from the surface's center, in radii of the surface. Smaller is stronger perspective; a part of the surface nearer than a fiftieth of that distance is not drawn.", 1.5, 12, 0.1, 1.05, 1000, perspective),
];

const controlGroups: ControlGroup[] = [
  { label: "Seed surface", controls: ["surface", "resolution", "perturb"] },
  { label: "Placement", controls: ["centerX", "centerY", "size"] },
  { label: "Growth field", controls: ["field", { label: "Ring", controls: ["fieldRadius", "fieldWidth"], proportional: true }, "fieldX", "fieldY", "stripeCount", "stripeAngle", "stripeSharp", "noiseScale", "noiseContrast", "baseline", "spot", "spotX", "spotY", "spotWidth"] },
  { label: "Growth", controls: ["rate", "limit", "steps"] },
  { label: "Skin", controls: ["bending", "pin", "sweeps", "thickness"] },
  { label: "Refinement", controls: ["refine", "edgeLimit", "maxVertices"] },
  { label: "Faces", controls: ["faces", "backFaces", "faceOpacity", { label: "Light", controls: ["lightAzimuth", "lightElevation", "lightStrength"] }] },
  { label: "Color", controls: ["colorBy"] },
  { label: "Lines", controls: ["lines", "creaseAngle", "hidden", "hiddenOpacity", "lineMaterial", { label: "Line weights", controls: ["contourWeight", "wireWeight", "levelWeight"], proportional: true }, "levelBy", "levels"] },
  { label: "Grains", controls: ["grains", "grainMark", "grainSize"] },
  { label: "View", controls: ["projection", "yaw", "pitch", "roll", "distance"] },
];

const optionLabels: Record<string, Record<string, string>> = {
  surface: { sheet: "Sheet", disc: "Disc", strip: "Strip", sphere: "Sphere" },
  field: { edge: "Edge", radial: "Ring", stripes: "Stripes", noise: "Blobs", uniform: "Everywhere" },
  pin: { none: "None", rim: "Whole rim", center: "Center", side: "One side" },
  faces: { none: "None", flat: "Flat", facets: "Facets", shaded: "Smooth" },
  backFaces: { same: "Same as top", tinted: "Tinted", hidden: "Hidden" },
  colorBy: { none: "One color", growth: "Growth", stretch: "Stretch", depth: "Refinement depth" },
  lines: { none: "None", contour: "Contours", wire: "Wire", both: "Contours and wire" },
  hidden: { remove: "Removed", fade: "Faded" },
  lineMaterial: { ink: "Ink", stitch: "Stitch", beads: "Beads" },
  levelBy: { none: "None", growth: "Growth", stretch: "Stretch", height: "Height", depth: "Refinement depth" },
  grainMark: { dot: "Dot", rings: "Rings", rosette: "Rosette" },
  projection: { perspective: "Perspective", orthographic: "Orthographic" },
};
const labelled = (parameter: Parameter): Parameter => {
  const labels = optionLabels[parameter.key];
  return labels ? { ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) } : parameter;
};

export const surfaceGrowthDefinition: InstrumentDefinition = {
  id: "surface-growth", title: "Surface Growth",
  description: "A triangulated sheet, disc, strip or sphere whose edges are allowed to lengthen unevenly. A growth field says where; each step grows the rest lengths there, relaxes the skin in 3-D under stretch and bending, and splits the edges that stretch too far, so ruffles and folds form by real surface evolution. Painted as lit faces far to near, hidden-line contours and wire, level lines and grains, from a camera that never touches the growth.",
  renderer: "2d",
  parameters: parameters.map(labelled), controlGroups,
  validate: (q) => checkSurfaceGrowthControls(q),
  defaults: {
    surface: "disc", resolution: 16, perturb: 0.15,
    centerX: 320, centerY: 320, size: 250,
    field: "edge", fieldWidth: 0.45, fieldRadius: 0.5, fieldX: 0, fieldY: 0, stripeCount: 3, stripeAngle: 20, stripeSharp: 0.5, noiseScale: 1.6, noiseContrast: 3,
    baseline: 0.04, spot: false, spotX: 0.4, spotY: -0.3, spotWidth: 0.25,
    rate: 0.012, limit: 3, steps: 150,
    bending: 0.0004, pin: "none", sweeps: 12, thickness: 0,
    refine: true, edgeLimit: 1.4, maxVertices: 1400,
    faces: "shaded", backFaces: "tinted", faceOpacity: 1, lightAzimuth: -35, lightElevation: 45, lightStrength: 0.85, colorBy: "growth",
    lines: "contour", creaseAngle: 0, hidden: "remove", hiddenOpacity: 0.25, lineMaterial: "ink", contourWeight: 1.1, wireWeight: 0.5, levelBy: "none", levels: 8, levelWeight: 0.6,
    grains: 0, grainMark: "dot", grainSize: 2,
    projection: "perspective", yaw: 20, pitch: 38, roll: 0, distance: 3.6,
  },
};
