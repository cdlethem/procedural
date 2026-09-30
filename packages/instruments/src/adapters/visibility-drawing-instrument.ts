import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["detail", "contourLevels", "hatchFamilies", "fillColor", "fillBands"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);

const drawn: [string, string][] = [["off", "Removed"], ["visible", "Visible only"], ["dashed", "Hidden dashed"]];
const materials: [string, string][] = [["ink", "Ink"], ["stitch", "Stitch"], ["beads", "Beads"]];
const on = (key: string): Condition => ({ [key]: ["visible", "dashed"] });
const perspective: Condition = { projection: ["perspective"] };
const shaded: Condition = { shading: ["hatch", "fill", "fill-hatch"] };
const hatched: Condition = { shading: ["hatch", "fill-hatch"] };
const filled: Condition = { shading: ["fill", "fill-hatch"] };
const cued: Condition = { depthCue: ["weight", "opacity", "both"] };
const open: Condition = { shape: ["terrain", "vase", "assembly"] };

const parameters: Parameter[] = [
  select("shape", "Shape", "The bundled solid or surface to draw. The assembly is four separate solids on a plinth (a vase, a sphere, an upright ring and a block) so that parts hide one another; the terrain and the vase are open surfaces, the rest are closed. Owned meshes are accepted by the functions; binding a user's model to a layer is future host work.",
    [["assembly", "Assembly"], ["icosphere", "Icosphere"], ["torus", "Torus"], ["terrain", "Terrain"], ["vase", "Vase"], ["figure", "Faceted figure"]]),
  n("detail", "Detail", "Tessellation of the shape: subdivision levels of the icosphere and the assembly's sphere (20 x 4^detail triangles), and a multiple of the segments of the torus, terrain and vase. Higher detail makes more facets, so silhouettes and contours follow the surface more smoothly and creases fewer, at a cost. The icosphere and the assembly stop at 6, the others at 8. The figure has fixed geometry.",
    1, 5, 1, 1, 8, { shape: ["assembly", "icosphere", "torus", "terrain", "vase"] }),
  select("terrainVariant", "Terrain", "Which seeded height field the terrain is: rolling hills, sharp ridges, a crater or dunes. A new seed makes a different landscape of the same kind.",
    [["hills", "Hills"], ["ridges", "Ridges"], ["crater", "Crater"], ["dunes", "Dunes"]], { shape: ["terrain"] }),
  select("vaseProfile", "Vase profile", "The silhouette revolved into the vase (also the vase in the assembly): an amphora, a goblet, a bottle or an urn. The vase is open at the top, so its inside can be seen and drawn.",
    [["amphora", "Amphora"], ["goblet", "Goblet"], ["bottle", "Bottle"], ["urn", "Urn"]], { shape: ["vase", "assembly"] }),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the object's bounds.", 80, 560, 1, -100000, 100000),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the object's bounds.", 80, 560, 1, -100000, 100000),
  n("size", "Object size", "Canvas diameter of the smallest sphere around the object (centred on its bounds) at the centre depth: how large the object is drawn. It moves the camera's zoom only; nothing is rebuilt.", 200, 640, 1, 20, 5000),

  select("projection", "Projection", "Orthographic keeps parallel edges parallel (drafting); perspective converges them toward the horizon and makes near parts larger, which shows depth and lets the near plane cut the object.",
    [["orthographic", "Orthographic"], ["perspective", "Perspective"]]),
  n("yaw", "Yaw", "Turns the eye around the object about the vertical axis, in degrees; positive swings the eye toward +x.", -180, 180, 1, -3600, 3600),
  n("pitch", "Pitch", "Raises the eye above the horizon in degrees; 90 looks straight down and -90 straight up.", -80, 80, 1, -90, 90),
  n("roll", "Roll", "Turns the picture about the viewing axis, clockwise in degrees.", -180, 180, 1, -3600, 3600),
  n("distance", "Eye distance", "Distance from the eye to the object in object diameters (of the sphere around it). Small values exaggerate perspective; below about 0.5 the eye is inside that sphere and the near plane removes what is closer than a fiftieth of the distance.", 1.5, 10, 0.05, 0.25, 100, perspective),

  select("silhouette", "Silhouette", "The outline of the form: edges between a face turned toward the eye and one turned away. It follows the camera, so it is recomputed when the view moves. Hidden dashed also draws the part of the outline that another part of the object covers.", drawn),
  select("silhouetteMaterial", "Silhouette material", "Ink is a continuous stroke, stitch a row of dashes and beads a row of dots along the outline.", materials, on("silhouette")),
  n("silhouetteWeight", "Silhouette weight", "Line thickness of the outline (beads are this many times the bead scale).", 0.2, 4, 0.05, 0, 12, on("silhouette")),

  select("crease", "Creases", "Edges where the surface folds sharply, chosen by the dihedral angle between the two faces. They do not depend on the camera, so moving the view never re-classifies them; hidden dashed draws the creases behind other parts too.", drawn),
  n("creaseAngle", "Crease angle", "Smallest fold that counts as a crease, in degrees between the two faces' normals (0 flat, 90 a cube's edge). Lower it and gentler folds join in; on a smooth faceted surface a low angle draws the whole mesh.", 5, 120, 1, 0.5, 180, on("crease")),
  select("creaseKind", "Crease kind", "Ridges (convex folds), valleys (concave folds) or both.", [["both", "Ridges and valleys"], ["convex", "Ridges"], ["concave", "Valleys"]], on("crease")),
  select("creaseMaterial", "Crease material", "Ink, stitch or beads along the creases.", materials, on("crease")),
  n("creaseWeight", "Crease weight", "Line thickness of creases.", 0.2, 4, 0.05, 0, 12, on("crease")),

  select("boundary", "Rim", "The free edge of an open surface: the terrain's border, the vase's mouth. Closed solids have none.", drawn, open),
  select("boundaryMaterial", "Rim material", "Ink, stitch or beads along the rim.", materials, on("boundary")),
  n("boundaryWeight", "Rim weight", "Line thickness of the rim.", 0.2, 4, 0.05, 0, 12, on("boundary")),

  select("sections", "Sections", "Exact cuts of the surface by evenly spaced parallel planes, drawn where each plane meets it: rings around a sphere, a terrain's profile lines, slices through a ring. They do not depend on the camera.", drawn),
  select("sectionAxis", "Section direction", "Which axis the planes are stacked along: y gives horizontal slices, x and z vertical ones.", [["y", "Vertical stack (y)"], ["x", "Along x"], ["z", "Along z"]], on("sections")),
  n("sectionTilt", "Section tilt", "Turns the stack of planes away from its axis, in degrees, so the cuts run obliquely.", -60, 60, 1, -89, 89, on("sections")),
  n("sectionSpacing", "Section spacing", "Distance between planes as a fraction of the object's extent along the stack. Smaller spacing cuts more; 0.05 makes about twenty planes and the limit is 250.", 0.02, 0.3, 0.005, 0.004, 1, on("sections")),
  n("sectionOffset", "Section shift", "Slides the whole stack by a fraction of the spacing; the stack is centred on the object, so 0 puts one plane through the middle.", 0, 1, 0.01, -50, 50, on("sections")),
  select("sectionMaterial", "Section material", "Ink, stitch or beads along the section curves.", materials, on("sections")),
  n("sectionWeight", "Section weight", "Line thickness of section curves.", 0.2, 4, 0.05, 0, 12, on("sections")),

  select("contours", "Contours", "Lines of constant value of a field on the surface, traced exactly across every triangle. They do not depend on the camera.", drawn),
  select("contourField", "Contour field", "Height (world y), slope (the angle of the surface from facing up, so bands follow steepness) or mean curvature (ridges and hollows: positive convex, negative concave).", [["height", "Height"], ["slope", "Slope"], ["curvature", "Curvature"]], on("contours")),
  n("contourLevels", "Contour levels", "Number of lines, evenly spaced strictly inside the range of the field (its 5th to 95th percentile for curvature). A constant field, like a sphere's curvature, has none.", 1, 40, 1, 1, 200, on("contours")),
  select("contourMaterial", "Contour material", "Ink, stitch or beads along contours.", materials, on("contours")),
  n("contourWeight", "Contour weight", "Line thickness of contours.", 0.2, 4, 0.05, 0, 12, on("contours")),

  select("shading", "Surface tone", "Tone the visible faces by the light: parallel hatch lines whose families multiply as faces darken, an opaque fill in bands, or both. The lines are hidden exactly where another surface covers them; the fill is painted far to near. None leaves a pure line drawing.",
    [["none", "None"], ["hatch", "Hatched"], ["fill", "Filled"], ["fill-hatch", "Filled and hatched"]]),
  n("shadeAngle", "Smoothing angle", "Faces meeting at a fold no sharper than this are shaded as one smooth surface (their normals blend around each corner); sharper folds stay crisp. 0 shades every triangle flat; 35 smooths a sphere or torus but keeps a cube's edges hard.", 0, 90, 1, 0, 180, shaded),
  n("hatchSpacing", "Hatch spacing", "Distance between hatch lines on the canvas, in canvas units. The lines sit on one lattice across the whole object, so neighbouring faces continue each other's strokes.", 2, 10, 0.25, 1, 200, hatched),
  n("hatchAngle", "Hatch angle", "Direction of the first family on the canvas, degrees clockwise from horizontal; further families are spread evenly through 180 degrees.", -90, 90, 1, -3600, 3600, hatched),
  n("hatchFamilies", "Hatch families", "Most crossing directions a face can carry: 1 gives single hatching, 2 and 3 cross-hatching for the darkest faces.", 1, 3, 1, 1, 3, hatched),
  n("hatchBare", "Bare highlights", "Darkness below which a face is left bare paper; the remaining range is divided among the families. Raise it to keep only the shadows hatched.", 0, 0.8, 0.01, 0, 0.99, hatched),
  select("hatchMaterial", "Hatch material", "Ink, stitch or beads along the hatch strokes; beads make a stippled tone.", materials, hatched),
  n("hatchWeight", "Hatch weight", "Line thickness of hatch strokes.", 0.2, 3, 0.05, 0, 12, hatched),
  n("fillColor", "Fill color", "Which palette entry the fill takes before shading (entries wrap around).", 0, 7, 1, 0, 255, filled),
  n("fillPale", "Fill paleness", "Mixes the palette color toward white before shading, so lines drawn over the fill stay readable: 0 is the full color, 1 white.", 0, 1, 0.01, 0, 1, filled),
  n("fillBands", "Fill bands", "Number of tone steps in the fill: 2 to 3 is toon shading, higher is smoother, 0 is continuous.", 0, 8, 1, 0, 32, filled),
  n("fillShade", "Fill shade", "How much the darkest faces are darkened toward black (0 leaves every face the palette color).", 0, 1, 0.01, 0, 1, filled),
  n("lightAzimuth", "Light direction", "Where the light comes from around the object, degrees from +z toward +x; the light is fixed in the world, so turning the camera changes which faces it lights.", -180, 180, 1, -3600, 3600, shaded),
  n("lightElevation", "Light height", "Height of the light above the horizon, degrees; 90 is overhead. There are no cast shadows.", 5, 85, 1, -90, 90, shaded),
  n("ambient", "Ambient light", "Share of light that reaches faces turned away from the source; 0 leaves them fully dark.", 0, 0.8, 0.01, 0, 1, shaded),

  select("colorBy", "Color by", "Class gives each feature class its own palette entry (silhouette 0 as ink, creases 1, rim 2, sections 3, contours 4, hatch 0); ink draws everything in palette entry 0.", [["class", "Class"], ["ink", "Ink"]]),
  select("depthCue", "Depth cue", "Lets line weight, opacity or both fall with distance from the eye, so near edges read strongest. It follows the depth of every point along a line.", [["none", "None"], ["weight", "Weight"], ["opacity", "Opacity"], ["both", "Weight and opacity"]]),
  n("cueAmount", "Cue strength", "How much the farthest lines are reduced: at 1 they keep 15% of their weight or opacity.", 0, 1, 0.01, 0, 1, cued),
  n("hiddenOpacity", "Hidden opacity", "Opacity of dashed hidden lines relative to visible ones.", 0.1, 1, 0.01, 0, 1),
  n("hiddenWeight", "Hidden weight", "Thickness of dashed hidden lines as a fraction of their class's weight.", 0.2, 1, 0.01, 0, 1),
  n("hiddenDash", "Dash length", "Period of the dashes on hidden lines, in canvas units.", 2, 12, 0.5, 0.5, 100),
  n("stitchSpacing", "Station spacing", "Distance between stitches or beads along a line, in canvas units.", 3, 16, 0.5, 0.5, 1000),
  n("beadScale", "Bead scale", "Diameter of a bead as a multiple of its line's weight.", 1.5, 6, 0.1, 0.5, 20),
];

const controlGroups: ControlGroup[] = [
  { label: "Form", stage: "form", controls: ["shape", "detail", "terrainVariant", "vaseProfile"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "size"] },
  { label: "View", stage: "frame", controls: ["projection", "yaw", "pitch", "roll", "distance"] },
  { label: "Silhouette", stage: "material", controls: ["silhouette", "silhouetteMaterial", "silhouetteWeight"] },
  { label: "Creases", stage: "material", controls: ["crease", "creaseAngle", "creaseKind", "creaseMaterial", "creaseWeight"] },
  { label: "Rim", stage: "material", controls: ["boundary", "boundaryMaterial", "boundaryWeight"] },
  { label: "Sections", stage: "material", controls: ["sections", "sectionAxis", "sectionTilt", "sectionSpacing", "sectionOffset", "sectionMaterial", "sectionWeight"] },
  { label: "Contours", stage: "material", controls: ["contours", "contourField", "contourLevels", "contourMaterial", "contourWeight"] },
  { label: "Surface tone", stage: "material", controls: ["shading", "shadeAngle",
    { label: "Hatch", controls: ["hatchSpacing", "hatchAngle", "hatchFamilies", "hatchBare", "hatchMaterial", "hatchWeight"] },
    { label: "Fill", controls: ["fillColor", "fillPale", "fillBands", "fillShade"] },
    { label: "Light", controls: ["lightAzimuth", "lightElevation", "ambient"] }] },
  { label: "Lines", stage: "material", controls: ["colorBy", "depthCue", "cueAmount", "hiddenOpacity", "hiddenWeight",
    { label: "Stations", controls: ["stitchSpacing", "hiddenDash"], proportional: true }, "beadScale"] },
];

type Values = Record<string, number | string | boolean>;

/** The stored values alone decide these; mesh-dependent limits are checked when the drawing is built, with controls named. */
export function validateVisibilityDrawing(q: Values): void {
  const shape = q.shape as string, detail = q.detail as number;
  const max = shape === "icosphere" || shape === "assembly" ? 6 : 8;
  if (shape !== "figure" && Number.isInteger(detail) && detail > max) throw new Error(`Detail ${detail} is too high for the ${shape} shape (at most ${max})`);
}

export const visibilityDrawingDefinition: InstrumentDefinition = {
  id: "visibility-drawing", title: "Visibility Drawing",
  description: "A solid drawn as a technical line drawing: silhouettes, creases, section slices and iso-contours with exact hidden-line removal, each class removed, drawn or drawn with its hidden part dashed, plus tone hatching or a banded fill from a light. The camera is separate from the surface features.",
  procedure: "Four solids on a plinth are drawn the way an engineer would, pulling out their outlines, creases, rims and cross-sections. Every line is cut where a nearer surface hides it, hidden stretches are dashed, and hatching thickens as faces turn from the light.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    shape: "assembly", detail: 3, terrainVariant: "hills", vaseProfile: "amphora",
    centerX: 320, centerY: 330, size: 600,
    projection: "perspective", yaw: 28, pitch: 24, roll: 0, distance: 3.4,
    silhouette: "visible", silhouetteMaterial: "ink", silhouetteWeight: 1.7,
    crease: "dashed", creaseAngle: 40, creaseKind: "both", creaseMaterial: "ink", creaseWeight: 1,
    boundary: "visible", boundaryMaterial: "ink", boundaryWeight: 1.2,
    sections: "off", sectionAxis: "y", sectionTilt: 0, sectionSpacing: 0.06, sectionOffset: 0.5, sectionMaterial: "ink", sectionWeight: 0.6,
    contours: "off", contourField: "height", contourLevels: 12, contourMaterial: "ink", contourWeight: 0.7,
    shading: "hatch", shadeAngle: 35, hatchSpacing: 4.5, hatchAngle: -35, hatchFamilies: 2, hatchBare: 0.3, hatchMaterial: "ink", hatchWeight: 0.6,
    fillColor: 1, fillPale: 0.55, fillBands: 3, fillShade: 0.55, lightAzimuth: -35, lightElevation: 50, ambient: 0.15,
    colorBy: "class", depthCue: "both", cueAmount: 0.55, hiddenOpacity: 0.55, hiddenWeight: 0.7, hiddenDash: 5, stitchSpacing: 7, beadScale: 3,
  },
  validate: validateVisibilityDrawing,
};
