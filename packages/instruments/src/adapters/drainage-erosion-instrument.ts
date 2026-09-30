import { checkErosionWork } from "../composition/drainage-erosion.js";
import { erosionParamsFor, footprintFor, type Values } from "../composition/drainage-settings.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["octaves", "resolution", "storms", "steps", "streamSmooth", "basinDepth", "indexEvery"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

const shaped: Condition = { shape: ["dome", "ridge", "plane", "escarpment"] };
const variable: Condition = { rainMode: ["gradient", "storms"] };
const graded: Condition = { rainMode: ["gradient"] };
const stormy: Condition = { rainMode: ["storms"] };
const layered: Condition = { bedrock: ["layers", "blobs"] };
const banded: Condition = { bedrock: ["layers"] };
const contoured: Condition = { contours: [true] };
const shaded: Condition = { shading: [true] };
const streamed: Condition = { streams: ["ribbon", "ink", "stitch", "beads"] };
const ribbon: Condition = { streams: ["ribbon"] };
const lined: Condition = { streams: ["ink", "stitch", "beads"] };
const spaced: Condition = { streams: ["stitch", "beads"] };
const basined: Condition = { basins: ["wash", "hatch", "divides", "wash-divides"] };
const washed: Condition = { basins: ["wash", "wash-divides"] };
const hatched: Condition = { basins: ["hatch"] };
const divided: Condition = { basins: ["divides", "wash-divides"] };
const lakey: Condition = { lakes: [true] };
const marked: Condition = { marks: ["sources", "confluences", "both"] };

const shapeSelect: Parameter = {
  ...select("shape", "Landform", "The shape the land starts with. Dome: a rounded hill draining to every side. Ridge: a crest down the middle. Plane: a tilted slope. Escarpment: a high plateau above a low plain. Noise: fractal noise alone. Erosion starts from this and carves it.",
    ["dome", "ridge", "plane", "escarpment", "noise"]),
  options: [["dome", "Dome"], ["ridge", "Ridge"], ["plane", "Tilted plane"], ["escarpment", "Escarpment"], ["noise", "Noise only"]].map(([value, label]) => ({ value, label })),
};
const outletSelect: Parameter = {
  ...select("outlets", "Outlets", "Where water can leave the map, held at base level. All edges: the whole border. Bottom: the bottom edge only, the other sides are closed walls. Sides: the left and right edges. One outlet: a single cell in the middle of the bottom edge, so every river must find its way there and basins between drain through lakes. The land falls to base level toward an open side.",
    ["edges", "bottom", "sides", "single"]),
  options: [["edges", "All edges"], ["bottom", "Bottom edge"], ["sides", "Left and right"], ["single", "One outlet"]].map(([value, label]) => ({ value, label })),
};

const parameters: Parameter[] = [
  shapeSelect,
  n("roughness", "Roughness", "How much fractal noise is mixed into the landform: 0 leaves the smooth shape, 1 is noise alone. Rougher land has more, smaller catchments and more depressions to fill.", 0, 1, 0.01, 0, 1, shaped),
  n("relief", "Relief", "Height of the land above base level as a fraction of its longer side. Steeper land erodes faster and carves deeper valleys.", 0.05, 0.6, 0.01, 0.01, 2),
  n("frequency", "Noise scale", "Cycles of the fractal noise across the longer side. Low values make a few broad hills; high values make many small ones.", 1, 12, 0.1, 0.1, 32),
  n("octaves", "Noise detail", "Octaves of noise added, each twice as fine and half as strong. One is smooth; more add small ridges and hollows.", 1, 7, 1, 1, 8),
  outletSelect,
  n("resolution", "Resolution", "Cells across the longer side of the map. It is a real setting: the solver works on this grid, streams can be no thinner than one cell and stream-power erosion and creep are expressed per unit area, so a finer grid resolves smaller branches at a cost that grows with the square of the resolution (and with the steps).", 48, 128, 1, 24, 384),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the map.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the map.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the map in canvas units. The longer side is exact; the shorter snaps to whole cells. Scaling both together redraws the same land larger.", 100, 640, 1, 16, 4096),
  n("height", "Height", "Height of the map in canvas units.", 100, 640, 1, 16, 4096),

  select("rainMode", "Rainfall", "Where rain falls. Uniform: the same everywhere. Gradient: wetter on one side, so rivers there are larger. Storms: seeded wet patches whose catchments carve deeper. Total rain is the same in every mode; only its distribution changes.", ["uniform", "gradient", "storms"]),
  n("rainVariation", "Rain contrast", "How strongly the rain varies: 0 is uniform, 1 makes the wettest places much wetter than the driest.", 0, 1, 0.01, 0, 1, variable),
  n("rainAngle", "Wet side", "Direction the rain increases toward, in degrees: 0 the right, 90 the bottom, 180 the left, -90 the top.", -180, 180, 1, -3600, 3600, graded),
  n("storms", "Storms", "Number of wet patches. Adding one never moves the others.", 1, 8, 1, 1, 12, stormy),

  select("bedrock", "Bedrock", "Whether the rock resists water equally. Layers: parallel warped bands of hard and soft rock, so rivers cut soft bands and turn along hard ones. Blobs: hard cores standing in soft rock that survive as hills.", ["uniform", "layers", "blobs"]),
  n("bedrockContrast", "Hardness contrast", "How much harder the hard rock is: the hard rock erodes at (1 - contrast) times the soft rate.", 0, 0.95, 0.01, 0, 0.99, layered),
  n("bedrockScale", "Bedrock scale", "Bands (or blobs) across the longer side.", 1, 12, 0.1, 0.25, 64, layered),
  n("bedrockAngle", "Band direction", "Direction the bands run across, in degrees.", -90, 90, 1, -3600, 3600, banded),

  n("steps", "Erosion steps", "How long the water has worked. Each step fills depressions, routes the flow, erodes, deposits and lets the slopes creep; drag it to watch the valleys deepen and the network organize. 0 shows the starting land.", 0, 200, 1, 0, 5000),
  n("erodibility", "Erodibility", "How fast flowing water lowers the ground: the stream-power coefficient K. Higher cuts deeper valleys faster and wears the land toward a plain; 0 leaves the land untouched.", 0, 0.06, 0.001, 0, 1000),
  n("areaExponent", "Area exponent", "How strongly erosion grows with the water a cell carries (drainage area to this power). Low values erode headwaters almost as hard as trunks; high values concentrate cutting in the big rivers.", 0.2, 1, 0.05, 0, 2),
  n("slopeExponent", "Slope exponent", "How strongly erosion grows with slope. Above 1, steep reaches cut much faster than gentle ones and knickpoints migrate; below 1 the profile evens out.", 0.5, 2, 0.05, 0.25, 4),
  n("uplift", "Uplift", "Rock raised everywhere each step, in map heights. It feeds relief against erosion: with none the land wears down to a plain, with plenty it settles into a steady landscape.", 0, 0.002, 0.00005, 0, 1),
  n("creep", "Hillslope creep", "Diffusion that rounds ridges and fills hollows, in units of 1e-5 map areas per step. It moves soil downhill without water, so it softens what the rivers leave sharp; a lot of it smooths away the fine valleys.", 0, 1.5, 0.05, 0, 100),
  n("deposition", "Deposition", "Share of the sediment a river cannot carry that is dropped in each cell each step, building fans and filling valley floors and lakes. 0 sends all eroded material out of the map.", 0, 1, 0.01, 0, 1),
  n("carrying", "Carrying capacity", "How much sediment a flow can carry compared with what erosion at that stream power would produce. Low values drop sediment early and build broad plains; high values carry it to the outlet.", 0.1, 3, 0.05, 0, 1000),

  flag("contours", "Contours", "Draw contour lines of the terrain at every elevation interval."),
  n("contourInterval", "Contour interval", "Elevation between contour lines, as a fraction of the longer side. Fine intervals reveal gentle slopes; coarse ones show only the main landforms. Too fine an interval for the land is refused rather than thinned.", 0.006, 0.04, 0.001, 0.001, 1, contoured),
  n("indexEvery", "Index contour", "Every this-many-th contour is drawn heavier. 0 draws them all alike.", 0, 10, 1, 0, 100, contoured),
  n("contourWeight", "Contour weight", "Line weight of the ordinary contours; index contours are heavier.", 0.3, 2.5, 0.05, 0, 20, contoured),
  flag("ghost", "Starting contours", "Also draw the contours of the land before erosion, fainter, so you can see what the water removed.", contoured),

  flag("shading", "Relief shading", "Light the terrain from a direction: slopes facing the light are pale, slopes facing away are shaded, as transparent polygon bands."),
  n("azimuth", "Light direction", "Where the light comes from, in degrees clockwise from the top of the canvas: 0 from above, 90 from the right, -45 from the upper left.", -180, 180, 1, -3600, 3600, shaded),
  n("elevation", "Light height", "Angle of the light above the ground in degrees. Low light rakes across the ridges and lengthens shadows.", 8, 90, 1, 1, 90, shaded),
  n("shadeDepth", "Shading depth", "How strongly slopes darken or lighten. Flat ground stays clear at any value.", 0, 8, 0.1, 0, 50, shaded),

  select("streams", "Streams", "How the river network is drawn. Ribbon: tapering ribbons whose width follows the water they carry. Ink, stitch and beads: the same reaches through the path materials, heavier for higher stream orders. None hides them.", ["ribbon", "ink", "stitch", "beads", "none"]),
  n("streamThreshold", "Stream threshold", "A cell is a stream once it drains this percentage of the whole map. Lower shows the fine headwater network; higher keeps only the main rivers. It also sets the basins and the confluence marks.", 0.1, 4, 0.05, 0.005, 50),
  n("streamSmooth", "Stream smoothing", "Rounds of corner cutting on the stepped grid paths. The ends stay on their nodes so reaches still meet at junctions.", 0, 4, 1, 0, 4, streamed),
  n("streamWidth", "Ribbon width", "Width of the widest river in canvas units; smaller streams taper with the square root of their flow.", 1, 14, 0.25, 0.25, 100, ribbon),
  n("streamWeight", "Line weight", "Line weight of the largest streams; smaller orders are lighter.", 0.4, 4, 0.05, 0, 30, lined),
  n("streamSpacing", "Spacing", "Distance between stitches or beads along a stream.", 3, 20, 0.5, 0.5, 200, spaced),

  select("basins", "Basins", "Drainage basins: the land that drains to each river. Wash tints each basin, hatch fills it with lines at its own angle, divides draws only the ridge lines between them. Basin boundaries follow the flow, not the contours.", ["wash", "hatch", "divides", "wash-divides", "none"]),
  n("basinDepth", "Basin detail", "How finely the network divides the land: 0 is one basin per river that reaches an outlet, 1 also splits off each tributary that joins it, and so on.", 0, 4, 1, 0, 16, basined),
  n("washAlpha", "Wash strength", "Opacity of the basin tints.", 0.05, 0.6, 0.01, 0, 1, washed),
  n("hatchSpacing", "Hatch spacing", "Distance between hatch lines in canvas units.", 2, 12, 0.25, 1, 100, hatched),
  n("dividesWeight", "Divide weight", "Line weight of the ridge lines between basins.", 0.3, 3, 0.05, 0, 20, divided),

  flag("lakes", "Lakes", "Shade the depressions that had to be filled to route water out: they hold water up to their spill level."),
  n("lakeDepth", "Lake depth", "Smallest water depth drawn as a lake, as a share of the highest ground. Shallower hollows are left dry.", 0.002, 0.05, 0.001, 0.0005, 1, lakey),

  select("marks", "Marks", "Marks at the network's nodes: sources (where a stream begins), confluences (where two join), or both. Larger rivers get larger marks.", ["none", "sources", "confluences", "both"]),
  select("markKind", "Mark shape", "Dots, rings, or arrows that point downstream.", ["dot", "rings", "arrow"], marked),
  n("markSize", "Mark size", "Diameter of the smallest mark in canvas units; marks grow with the flow at their node.", 3, 20, 0.5, 0.5, 200, marked),
];

const controlGroups: ControlGroup[] = [
  { label: "Terrain", controls: ["shape", "roughness", "relief", { label: "Noise", controls: ["frequency", "octaves"] }, "outlets", "resolution"] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
  { label: "Water", controls: ["rainMode", "rainVariation", "rainAngle", "storms"] },
  { label: "Bedrock", controls: ["bedrock", "bedrockContrast", "bedrockScale", "bedrockAngle"] },
  { label: "Erosion", controls: ["steps", { label: "Stream power", controls: ["erodibility", "areaExponent", "slopeExponent"] }, "uplift", "creep",
    { label: "Sediment", controls: ["deposition", "carrying"] }] },
  { label: "Contours", controls: ["contours", "contourInterval", "indexEvery", "contourWeight", "ghost"] },
  { label: "Relief shading", controls: ["shading", { label: "Light", controls: ["azimuth", "elevation"] }, "shadeDepth"] },
  { label: "Streams", controls: ["streams", "streamThreshold", "streamSmooth", "streamWidth", "streamWeight", "streamSpacing"] },
  { label: "Basins", controls: ["basins", "basinDepth", "washAlpha", "hatchSpacing", "dividesWeight"] },
  { label: "Lakes", controls: ["lakes", "lakeDepth"] },
  { label: "Marks", controls: ["marks", "markKind", "markSize"] },
];

/**
 * Work that follows from the stored values alone: the grid, its steps and the creep sub-steps. The messages name the
 * control to change (`checkErosionWork`).
 */
export function validateDrainageErosion(q: Values): void {
  footprintFor(q);
  checkErosionWork(erosionParamsFor(q), Number(q.steps));
}

export const drainageErosionDefinition: InstrumentDefinition = {
  id: "drainage-erosion", title: "Drainage and Erosion",
  description: "Rain runs over a landform, gathers into rivers and cuts them deeper, step by step: depressions are filled, water is routed downhill and accumulated, stream power erodes, sediment is carried and dropped. The same land is drawn as contours, tapering rivers, drainage basins, lakes, marks at confluences and lit relief.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    shape: "plane", roughness: 0.75, relief: 0.25, frequency: 3.5, octaves: 5, outlets: "bottom", resolution: 112,
    centerX: 320, centerY: 320, width: 560, height: 560,
    rainMode: "uniform", rainVariation: 0.6, rainAngle: 90, storms: 3,
    bedrock: "uniform", bedrockContrast: 0.7, bedrockScale: 4, bedrockAngle: 30,
    steps: 120, erodibility: 0.02, areaExponent: 0.5, slopeExponent: 1, uplift: 0.0005, creep: 0.2, deposition: 0.3, carrying: 1,
    contours: true, contourInterval: 0.012, indexEvery: 5, contourWeight: 0.9, ghost: false,
    shading: true, azimuth: -50, elevation: 35, shadeDepth: 0.8,
    streams: "ribbon", streamThreshold: 0.3, streamSmooth: 2, streamWidth: 6, streamWeight: 1.6, streamSpacing: 8,
    basins: "wash", basinDepth: 1, washAlpha: 0.28, hatchSpacing: 5, dividesWeight: 1.1,
    lakes: true, lakeDepth: 0.01,
    marks: "none", markKind: "dot", markSize: 7,
  },
  validate: validateDrainageErosion,
};
