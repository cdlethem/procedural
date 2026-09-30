import { MAX_LINKS } from "../composition/point-view.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => control(toggle(key, label, description), visibleWhen);

const surfaced: Condition = { subject: ["figure", "vase", "terrain", "torus"] };
const vase: Condition = { subject: ["vase"] };
const terrain: Condition = { subject: ["terrain"] };
const galaxy: Condition = { subject: ["galaxy"] };
const volume: Condition = { subject: ["noise-volume"] };
const ranked: Condition = { thinRule: ["even-out", "features"] };
const focused: Condition = { focus: ["ball"] };
const cutting: Condition = { cut: ["x", "y", "z"] };
const marked: Condition = { mark: ["grain", "ring", "rosette", "arrow", "disc", "stroke"] };
const stroked: Condition = { mark: ["ring", "rosette", "arrow", "disc", "stroke"] };
const rosette: Condition = { mark: ["rosette"] };
const opened: Condition = { mark: ["ring", "rosette"] };
const directed: Condition = { mark: ["arrow", "stroke"] };
const linked: Condition = { links: ["nearest"] };
const outlined: Condition = { outline: ["silhouette", "features"] };
const creased: Condition = { outline: ["features"] };
const perspective: Condition = { projection: ["perspective"] };

export const pointCloudsParameters: Parameter[] = [
  select("subject", "Subject", "What the points sample. Four bundled surfaces are sampled by area (a faceted figure, a vase, a hill terrain, a torus); the galaxy and the noise volume are generated point by point. The same points can be drawn as grains, discs, strokes or glyphs.",
    [["vase", "Vase"], ["figure", "Faceted figure"], ["terrain", "Terrain"], ["torus", "Torus"], ["galaxy", "Spiral galaxy"], ["noise-volume", "Noise volume"]]),
  select("vaseProfile", "Vase profile", "Silhouette of the vase: a two-handled amphora, a goblet with a stem, a narrow-necked bottle or a wide urn.",
    [["amphora", "Amphora"], ["goblet", "Goblet"], ["bottle", "Bottle"], ["urn", "Urn"]], vase),
  select("terrainVariant", "Terrain form", "Height field of the terrain: rolling hills, sharp ridges, a crater or long dunes. The seed changes the relief itself.",
    [["hills", "Hills"], ["ridges", "Ridges"], ["crater", "Crater"], ["dunes", "Dunes"]], terrain),
  n("arms", "Arms", "Spiral arms of the galaxy. The disk points are shared out among them; the seed decides where each point falls.", 1, 6, 1, 1, 8, galaxy, true),
  n("twist", "Twist", "Turns each arm makes from the centre to the rim. 0 gives straight spokes, 1 a full turn, more a tight winding.", 0, 2.5, 0.05, 0, 3, galaxy),
  n("bulge", "Bulge", "Share of points in the round central bulge instead of the disk.", 0, 0.6, 0.01, 0, 0.9, galaxy),
  n("thickness", "Disk thickness", "Vertical spread of the disk as a share of its radius, thickest at the centre. The disk is always slightly warped.", 0, 0.6, 0.01, 0, 1, galaxy),
  n("looseness", "Arm looseness", "How far points stray from an arm's centre line, as a share of the arm spacing. A tenth of the disk points ignore the arms altogether.", 0, 2, 0.02, 0, 2, galaxy),
  n("noiseScale", "Noise frequency", "Features of the noise across the unit ball: low values make a few large clouds, high values a fine froth.", 0.5, 5, 0.05, 0.25, 8, volume),
  n("noiseContrast", "Noise contrast", "0 fills the ball evenly; higher values keep points only where the noise is densest, leaving voids between filaments.", 0, 1, 0.01, 0, 1, volume),
  n("noiseOctaves", "Noise octaves", "Layers of noise summed at doubling frequency and half strength: more octaves add small-scale roughness.", 1, 4, 1, 1, 4, volume, true),
  n("count", "Points", "Number of sampled points. Adding points never moves the existing ones: a smaller count is exactly the first part of a larger one. Every later stage (structure estimates, thinning, links, marks) works on this population.", 500, 12000, 100, 1, 40000, undefined, true),
  select("distribution", "Sampling", "Even spreads points with a low-discrepancy sequence, so no region is starved; random draws each point independently and clumps as chance dictates.",
    [["even", "Even"], ["random", "Random"]], surfaced),
  n("neighbors", "Neighbors", "Points in each local neighbourhood used to estimate curvature, crowding, spacing and the principal direction. Small values follow fine detail and noise; large values smooth over it.", 4, 12, 1, 3, 16, undefined, true),

  n("centerX", "Center X", "Horizontal canvas position of the subject's centre.", 80, 560, 1, -100000, 100000),
  n("centerY", "Center Y", "Vertical canvas position of the subject's centre.", 80, 560, 1, -100000, 100000),
  n("fit", "Size", "Radius of the sphere that encloses the subject, as a fraction of half the canvas: the subject is fitted to this in both projections, so turning the camera never rescales it.", 0.3, 1.5, 0.01, 0.01, 20),

  n("keep", "Keep", "Share of the points that remain. Thinning is by a fixed random rank per point, so the points kept at one value are always among those kept at any higher value and never change identity; changing the camera does not re-deal them.", 0, 1, 0.01, 0, 1),
  select("thinRule", "Thin by", "What decides which points go first: nothing (uniform), crowding (dense places lose points first, leaving an even spread) or flatness (smooth places lose points first, so edges and folds stay).",
    [["uniform", "Uniform"], ["even-out", "Crowding"], ["features", "Flatness"]]),
  n("thinBias", "Rule strength", "How strongly the rule favours its points. 0 is uniform; 1 already keeps almost all of the favoured points while thinning the rest hard.", 0, 1.5, 0.01, 0, 3, ranked),
  select("focus", "Dense region", "Keep one chosen ball of the subject at full density however much the rest is thinned. The ball is fixed in the subject, not on the screen.", [["none", "None"], ["ball", "Ball"]]),
  n("focusX", "Region X", "Position of the ball's centre across the subject's width: -1 the left extreme, 1 the right.", -1, 1, 0.01, -3, 3, focused),
  n("focusY", "Region Y", "Position of the ball's centre up the subject: -1 the bottom, 1 the top.", -1, 1, 0.01, -3, 3, focused),
  n("focusZ", "Region Z", "Position of the ball's centre through the subject's depth: -1 the back extreme, 1 the front.", -1, 1, 0.01, -3, 3, focused),
  n("focusRadius", "Region radius", "Radius of the dense ball as a fraction of the subject's bounding radius.", 0.05, 1.2, 0.01, 0, 5, focused),
  n("focusFalloff", "Region softness", "Width of the ball's edge as a share of its radius: 0 is a sharp boundary, 1 fades from the centre.", 0, 1, 0.01, 0, 1, focused),

  select("cut", "Cut away", "Remove everything on one side of a plane, opening the subject to show its interior. The surface used to hide points behind it is cut the same way, so what is inside is seen.",
    [["none", "None"], ["x", "Across X"], ["y", "Across Y"], ["z", "Across Z"]]),
  n("cutAt", "Cut position", "Where the plane sits, from -1 to 1 of the subject's half extent about its centre.", -1, 1, 0.01, -3, 3, cutting),
  flag("cutFlip", "Keep the other side", "Keep the high-coordinate side of the plane instead of the low.", cutting),

  n("dispersion", "Dispersion", "Every point moves by a fixed random offset of up to this many local point spacings, blurring the surface into a shell of grains. 0 leaves points exactly on the surface.", 0, 3, 0.01, 0, 20),
  n("dispersionBias", "Along normals", "0 scatters points in every direction; 1 pushes them only in and out along the surface normal, thickening a skin without smearing its outline sideways.", 0, 1, 0.01, 0, 1, { dispersion: { gt: 0 } }),

  select("mark", "Mark", "What is drawn at each point: a round grain, a ring, a rosette glyph, an arrow or a short stroke along an axis, or a disc lying on the surface normal (seen edge-on it thins to a sliver). None keeps only links and outline.",
    [["disc", "Disc on normal"], ["grain", "Grain"], ["stroke", "Stroke"], ["arrow", "Arrow"], ["ring", "Ring"], ["rosette", "Rosette"], ["none", "None"]]),
  n("markSize", "Mark size", "Diameter of a grain, ring, rosette or disc, or length of an arrow or stroke, in canvas units at the subject's centre depth. Perspective and Size by depth then vary it.", 0.5, 24, 0.1, 0.1, 200, marked),
  n("markWeight", "Line weight", "Thickness of stroke, arrow, ring and rosette lines and of the darker edge of a disc (0 for none).", 0, 3, 0.05, 0, 50, stroked),
  n("petals", "Petals", "Radial strokes in each rosette.", 3, 12, 1, 1, 48, rosette, true),
  n("opening", "Opening", "Open centre of a rosette, or the offset of the inner ring, as a share of the radius.", 0, 0.9, 0.01, 0, 1, opened),
  select("axis", "Direction", "Which way arrows and strokes point in space: along the local principal direction of the points, around the form (horizontal, normal to up), down the fall line, or along a world axis.",
    [["contour", "Around the form"], ["principal", "Principal direction"], ["fall", "Fall line"], ["x", "World X"], ["y", "World Y"], ["z", "World Z"]], directed),
  n("axisTurn", "Turn", "Rotates every direction about its surface normal, in degrees.", -180, 180, 1, -3600, 3600, directed),
  n("axisJitter", "Jitter", "Each direction is also turned by a fixed random amount of up to this many degrees either way.", 0, 90, 1, 0, 180, directed),
  n("localScale", "Follow spacing", "How much marks grow where the points are sparse (measured on the source, before thinning): 0 keeps every mark the same size, 1 sizes each mark to the local point spacing.", 0, 1, 0.01, 0, 1, marked),
  n("opacity", "Opacity", "Strength of every mark before the depth fade.", 0.05, 1, 0.01, 0, 1, marked),

  n("sizeByDepth", "Size by depth", "Makes near marks larger and far ones smaller than their nominal size, in either projection: the nearest is 1 + this times nominal, the farthest 1 - this.", 0, 0.9, 0.01, 0, 1),
  n("fade", "Fade by depth", "Makes the far side of the subject more transparent: at 1 the farthest points vanish.", 0, 1, 0.01, 0, 1),
  flag("sort", "Paint far to near", "Draw the farthest marks and links first so nearer ones cover them. Off draws in point order, which reads as a translucent cloud with no front."),
  flag("hideBack", "Hide back-facing", "Drop points whose surface normal faces away from the eye. Cheap, and right for the outside of a closed form; it also removes the far inside wall of an open vessel."),
  flag("hideBehind", "Hide behind surface", "Drop points that another part of the source surface covers, tested exactly against the surface's triangles. The galaxy and the noise volume have no surface, so this does nothing there.", surfaced),

  select("links", "Links", "Short lines joining each point to its nearest neighbours, drawn in depth order with the marks. Thinning the points thins the network.", [["none", "None"], ["nearest", "Nearest neighbors"]]),
  n("linkNodes", "Link nodes", "Share of the points that are network nodes, chosen by a fixed random rank: raising it only adds nodes. Links join nodes, so a small share gives a sparse network over a dense cloud.", 0, 0.5, 0.005, 0, 1, linked),
  n("linkNeighbors", "Link neighbors", "Each node links to this many of its nearest nodes; a link is drawn once however many nodes ask for it.", 1, 6, 1, 1, 12, linked, true),
  n("linkReach", "Link reach", "Longest link, in multiples of the typical distance between nearest nodes. Small values join only close pairs; large values let isolated nodes connect. Points facing opposite ways are never linked.", 1, 6, 0.05, 0.1, 100, linked),
  n("linkWeight", "Link weight", "Thickness of link lines, scaled by depth like marks.", 0.1, 3, 0.05, 0, 50, linked),
  select("linkColor", "Link color", "Ink (the first palette color) or the mean color of the link's two end points.", [["cloud", "As points"], ["ink", "Ink"]], linked),

  select("outline", "Outline", "Visible lines of the source surface drawn above the points: its silhouette, or silhouette plus creases and open edges. Lines are cut exactly where a triangle covers them. The galaxy and the noise volume have no surface.",
    [["none", "None"], ["silhouette", "Silhouette"], ["features", "Silhouette and creases"]], surfaced),
  select("outlineMaterial", "Outline material", "Ink, stitches or beads along the outline (first palette color).", [["ink", "Ink"], ["stitch", "Stitch"], ["beads", "Beads"]], outlined),
  n("creaseAngle", "Crease angle", "Smallest fold, in degrees between neighbouring faces, that counts as a crease.", 10, 120, 1, 1, 180, creased),
  n("outlineWeight", "Outline weight", "Line thickness of the outline.", 0.2, 4, 0.05, 0, 50, outlined),
  select("outlineHidden", "Hidden lines", "What happens to outline stretches a triangle covers: dropped, or drawn as fine stitches.", [["drop", "Drop"], ["dashed", "Dashed"]], outlined),

  select("colorBy", "Color by", "What picks each point's palette color: its height, its distance from the viewer (near is the last color), how curved or how crowded its neighbourhood is (ranked, so the whole palette is used), how directly it faces the eye, the subject part it belongs to, a seeded random color, or the first color only.",
    [["height", "Height"], ["depth", "Depth"], ["curvature", "Curvature"], ["density", "Crowding"], ["facing", "Facing"], ["part", "Part"], ["mixed", "Random"], ["single", "One color"]]),
  select("blend", "Palette use", "Smooth blends between palette colors (Oklab); Bands snaps each point to one palette color.", [["smooth", "Smooth"], ["bands", "Bands"]],
    { colorBy: ["height", "depth", "curvature", "density", "facing"] }),

  select("projection", "Projection", "Perspective shrinks distant points toward the centre and foreshortens marks; orthographic keeps parallel lines parallel.", [["perspective", "Perspective"], ["orthographic", "Orthographic"]]),
  n("yaw", "Yaw", "Turns the camera around the subject, in degrees. Positive swings the eye toward +X.", -180, 180, 1, -3600, 3600),
  n("pitch", "Pitch", "Raises the eye above the horizon, in degrees; 90 looks straight down.", -90, 90, 1, -90, 90),
  n("roll", "Roll", "Turns the picture about the view axis, in degrees, clockwise.", -180, 180, 1, -3600, 3600),
  n("perspective", "Eye distance", "Eye distance in bounding radii: near 1.2 the front is huge and the back tiny; large values approach orthographic.", 1.2, 12, 0.05, 1.06, 1000, perspective),
];

const controlGroups: ControlGroup[] = [
  { label: "Subject", controls: ["subject", "vaseProfile", "terrainVariant",
    { label: "Galaxy", controls: ["arms", "twist", "bulge", "thickness", "looseness"] },
    { label: "Volume", controls: ["noiseScale", "noiseContrast", "noiseOctaves"] },
    { label: "Sampling", controls: ["count", "distribution", "neighbors"] }] },
  { label: "Placement", controls: ["centerX", "centerY", "fit"] },
  { label: "Thinning", controls: ["keep", "thinRule", "thinBias",
    { label: "Dense region", controls: ["focus", "focusX", "focusY", "focusZ", "focusRadius", "focusFalloff"] }] },
  { label: "Cut", controls: ["cut", "cutAt", "cutFlip"] },
  { label: "Dispersion", controls: ["dispersion", "dispersionBias"] },
  { label: "Mark", controls: ["mark", { label: "Scale", controls: ["markSize", "markWeight"], proportional: true }, "petals", "opening",
    { label: "Direction", controls: ["axis", "axisTurn", "axisJitter"] }, "localScale", "opacity"] },
  { label: "Depth", controls: ["sizeByDepth", "fade", "sort", "hideBack", "hideBehind"] },
  { label: "Links", controls: ["links", "linkNodes", "linkNeighbors", "linkReach", "linkWeight", "linkColor"] },
  { label: "Outline", controls: ["outline", "outlineMaterial", "creaseAngle", "outlineWeight", "outlineHidden"] },
  { label: "Color", controls: ["colorBy", "blend"] },
  { label: "View", controls: ["projection", "yaw", "pitch", "roll", "perspective"] },
];

type Values = Record<string, number | string | boolean>;

/** Checks that follow from the stored values alone; geometry-dependent limits are checked where the work is done. */
export function validatePointClouds(q: Values): void {
  if (q.links === "nearest") {
    const bound = (q.count as number) * (q.linkNodes as number) * (q.linkNeighbors as number);
    if (bound > 1.6 * MAX_LINKS) throw new Error(`Points (${q.count}) x Link neighbors (${q.linkNeighbors}) x Link nodes (${q.linkNodes}) allow up to ${Math.round(bound)} links; the limit is about ${Math.round(1.6 * MAX_LINKS)}. Lower Points, Link nodes or Link neighbors`);
  }
}

export const pointCloudsDefinition: InstrumentDefinition = {
  id: "point-clouds", title: "Point Clouds",
  description: "Rebuild a spatial subject (a vase, a figure, terrain, a torus, a spiral galaxy, a noise volume) from thousands of replaceable marks: discs lying on the surface, strokes along a direction, grains and glyphs, joined by sparse neighbour links, with depth cues, exact hidden-point removal, deterministic thinning and a chosen region kept dense.",
  renderer: "2d",
  parameters: pointCloudsParameters, controlGroups,
  defaults: {
    subject: "vase", vaseProfile: "amphora", terrainVariant: "hills", arms: 3, twist: 1.2, bulge: 0.2, thickness: 0.25, looseness: 0.7,
    noiseScale: 1.6, noiseContrast: 0.55, noiseOctaves: 3, count: 6000, distribution: "even", neighbors: 8,
    centerX: 320, centerY: 320, fit: 0.9,
    keep: 1, thinRule: "uniform", thinBias: 0.6, focus: "none", focusX: 0.3, focusY: 0.2, focusZ: 0.7, focusRadius: 0.45, focusFalloff: 0.5,
    cut: "none", cutAt: 0, cutFlip: false, dispersion: 0, dispersionBias: 0.5,
    mark: "disc", markSize: 9, markWeight: 0.5, petals: 6, opening: 0.3, axis: "contour", axisTurn: 0, axisJitter: 12, localScale: 0.5, opacity: 0.92,
    sizeByDepth: 0.25, fade: 0.4, sort: true, hideBack: false, hideBehind: true,
    links: "nearest", linkNodes: 0.06, linkNeighbors: 3, linkReach: 2.6, linkWeight: 1, linkColor: "ink",
    outline: "none", outlineMaterial: "ink", creaseAngle: 40, outlineWeight: 1.2, outlineHidden: "drop",
    colorBy: "height", blend: "smooth",
    projection: "perspective", yaw: 30, pitch: 16, roll: 0, perspective: 4,
  },
  validate: validatePointClouds,
};
