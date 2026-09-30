import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { SIMPLIFY_LIMITS } from "../composition/mesh-simplify.js";
import { MAX_SEEDED_REGIONS } from "../composition/mesh-region.js";
import { terrainVariants, vaseProfileNames } from "../composition/mesh-samples.js";
import { SOURCES } from "../composition/mesh-abstraction.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number, hardMin: number, hardMax: number, options: { integer?: boolean; visibleWhen?: Condition } = {}): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, ...(options.integer ? { integer: true } : {}) }), options.visibleWhen);
const select = (key: string, label: string, description: string, values: readonly string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, [...values]), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => withCondition(toggle(key, label, description), visibleWhen);

const open: Condition = { source: ["terrain", "vase"] };
const placed: Condition = { region: ["sphere", "box"] };
const sized: Condition = { region: ["sphere", "box", "seeded"] };
const marked: Condition = { region: ["sphere", "box", "band", "seeded"] };
const lined: Condition = { edges: ["outline", "mesh"] };
const filled: Condition = { facets: ["shaded", "flat"] };
const ghosted: Condition = { compare: ["ghost"] };

const parameters: Parameter[] = [
  select("source", "Source", "The detailed surface that gets abstracted: a finely subdivided sphere, a seeded terrain, a revolved vase, a faceted figure whose head is a fine sphere on a blocky body or a torus. Each is a closed or open triangle or quad mesh; a quad counts as two triangles.", SOURCES,
    [{ compare: ["ghost"] }, { edges: ["outline", "mesh"] }, { facets: ["shaded", "flat"] }]),
  n("detail", "Source detail", "How finely the source is built. Icosphere: subdivision level is one less (level 5, 20,480 triangles, is the limit; 7 is refused). Figure: the head is subdivided to that level (5 at most). Terrain: 8 cells per side per step. Vase: 8 slices per step. Torus: 12 by 6 segments per step.", 1, 6, 1, 1, 7,
    { integer: true, visibleWhen: [{ compare: ["ghost"] }, { edges: ["outline", "mesh"] }, { facets: ["shaded", "flat"] }] }),
  select("terrainVariant", "Terrain kind", "Which seeded height field: rolling hills, ridges, a crater or dunes. The seed rerolls the heights.", terrainVariants, { source: ["terrain"] }),
  select("vaseProfile", "Vase profile", "Which profile is revolved: amphora, goblet, bottle or urn.", vaseProfileNames, { source: ["vase"] }),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the source's bounding box.", 0, 640, 1, -640, 1280),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the source's bounding box.", 0, 640, 1, -640, 1280),
  n("size", "Size", "Canvas length of the source's bounding-box diagonal, so every source fills about the same space. Moving the camera or changing this never recomputes the abstraction.", 120, 620, 1, 10, 4000,
    { visibleWhen: [{ compare: ["ghost"] }, { edges: ["outline", "mesh"] }, { facets: ["shaded", "flat"] }] }),

  n("keep", "Facets kept", "Share of the triangles outside the preserved region that remain (the region's own triangles always stay). Edge collapse removes the cheapest edges first until this many are left: 1 is the source untouched, small values leave coarse facets. Scrub it: the same collapses simply continue or rewind.", 0.02, 0.6, 0.005, 0.0001, 1),
  select("rule", "Collapse rule", "What decides which edge goes first. Error-driven collapse (quadric) flattens where the surface is flat and keeps facets where it curves, so facet size follows the form. Shortest edge gives every facet the same scale whatever the form.", ["quadric", "length"]),
  n("maxError", "Error limit", "Stops collapsing edges whose merge would move the surface by more than this root-mean-square distance, as a fraction of the source's diagonal; the limit tightens to zero toward the preserved region. 0 sets no limit, so the facet count decides. A limit below what the count needs stops early instead.", 0, 0.08, 0.001, 0, 1),
  select("boundary", "Boundary", "What happens along the open edge of a terrain or vase: hold keeps its outline in place (with a strong penalty against moving it), free lets it erode, frozen keeps every rim vertex exactly where it was.", ["hold", "free", "frozen"], open),
  flag("keepCreases", "Keep creases", "Protect sharp folds: edges bent by at least the crease angle get a strong penalty against moving. The figure's blocks and the vase's shoulder keep their corners."),
  n("creaseAngle", "Crease angle", "Fold, in degrees between neighbouring facets, from which an edge counts as a crease. It protects creases when Keep creases is on, and picks the crease lines of the Outline edges.", 10, 90, 1, 1, 180),

  select("region", "Region", "The part that keeps its detail: nothing, a sphere, a box, a band along an axis, or seeded spheres centred on random surface points. Inside it the source is preserved vertex for vertex; outside it the surface is abstracted.", ["none", "sphere", "box", "band", "seeded"],
    [{ edges: ["outline", "mesh"] }, { facets: ["shaded", "flat"] }]),
  n("regionX", "Region X", "Where the region sits along X, as a fraction of the source's width (0 left edge, 1 right edge).", 0, 1, 0.01, -1, 2, { visibleWhen: placed }),
  n("regionY", "Region Y", "Where the region sits along Y (up), as a fraction of the source's height.", 0, 1, 0.01, -1, 2, { visibleWhen: placed }),
  n("regionZ", "Region Z", "Where the region sits along Z (depth), as a fraction of the source's depth.", 0, 1, 0.01, -1, 2, { visibleWhen: placed }),
  n("regionSize", "Region size", "Sphere or seeded sphere radius as a fraction of the source's diagonal; for a box, half of its extent along each axis as a fraction of that extent (0.5 is the whole thing).", 0.02, 0.6, 0.005, 0, 2, { visibleWhen: sized }),
  select("regionAxis", "Band axis", "Which axis the band runs across.", ["x", "y", "z"], { region: ["band"] }),
  n("bandFrom", "Band from", "Where the band starts along its axis, as a fraction of the source's extent there.", 0, 1, 0.01, -1, 2, { visibleWhen: { region: ["band"] } }),
  n("bandTo", "Band to", "Where the band ends. It must not be smaller than Band from.", 0, 1, 0.01, -1, 2, { visibleWhen: { region: ["band"] } }),
  n("regionCount", "Region count", `How many seeded spheres. Raising it only adds spheres; the earlier ones stay where they are. At most ${MAX_SEEDED_REGIONS}.`, 1, 12, 1, 1, MAX_SEEDED_REGIONS, { integer: true, visibleWhen: { region: ["seeded"] } }),
  n("falloff", "Falloff", "Distance, as a fraction of the diagonal, over which importance fades from 1 to 0 outside the region. Vertices at importance 1 are frozen; the fade makes facets grow gradually from the region outward. 0 makes a hard edge.", 0, 0.5, 0.005, 0, 2, { visibleWhen: marked }),
  flag("invert", "Invert region", "Abstract inside the region and preserve everything outside it.", marked),

  n("yaw", "Yaw", "Turns the camera around the vertical axis, in degrees. Positive swings the eye toward +X.", -180, 180, 1, -3600, 3600),
  n("pitch", "Pitch", "Raises the camera above the horizon, in degrees. Negative looks up from below.", -90, 90, 1, -360, 360, { visibleWhen: [
    { compare: ["ghost"] }, { edges: ["outline", "mesh"] }, { facets: ["flat"] },
    { facets: ["shaded", "flat"], compare: ["ghost", "beside"] }, { facets: ["shaded"], compare: ["off", "ghost"] }] }),
  n("roll", "Roll", "Turns the picture about the viewing axis, in degrees; positive turns it clockwise.", -180, 180, 1, -360, 360),
  select("projection", "Projection", "Orthographic keeps parallel edges parallel; perspective foreshortens, so near facets are larger and depth reads more strongly.", ["orthographic", "perspective"]),
  n("distance", "Eye distance", "How far a perspective camera sits, in diagonals of the source: small is a wide-angle close-up, large approaches orthographic. Below 0.75 the source can pass through the near plane.", 1.2, 6, 0.05, 0.75, 50, { visibleWhen: { projection: ["perspective"] } }),

  select("facets", "Facets", "How the facets are filled, back to front so nearer facets hide farther ones: shaded by a light, a single flat color, or not at all (leave only the edges).", ["shaded", "flat", "none"]),
  n("facetOpacity", "Facet opacity", "Opacity of the facets. Below 1 the ones behind show through and the painter order still holds.", 0, 1, 0.01, 0, 1, { visibleWhen: filled }),
  n("light", "Light direction", "Where the light comes from around the vertical axis, in degrees, fixed in the world so turning the camera moves the shading across the form.", 0, 360, 1, -3600, 3600, { visibleWhen: { facets: ["shaded"] } }),
  n("contrast", "Contrast", "How much darker facets turned away from the light are: 0 leaves every facet the same color, 1 goes to the darkest.", 0, 1, 0.01, 0, 1, { visibleWhen: { facets: ["shaded"] } }),

  select("edges", "Edges", "Which mesh edges are drawn as lines: none, the outline only (silhouette, boundary and creases) or every edge of the abstracted mesh. Hidden-line removal decides what a nearer facet covers; it is solved exactly, not faded.", ["none", "outline", "mesh"]),
  select("lineMaterial", "Line material", "Solid ink, dashed stitches or dotted beads along each edge.", ["ink", "stitch", "beads"], lined),
  select("hiddenLines", "Hidden lines", "Edges behind a nearer facet: dropped, drawn faintly, or drawn as dashes.", ["drop", "faint", "dashed"], lined),
  n("lineWeight", "Line weight", "Stroke width of the edge lines.", 0.3, 3, 0.1, 0, 50, { visibleWhen: lined }),

  select("highlight", "Highlight", "Show the preserved region: tint the facets that touch it, color the edges inside it, both, or leave it unmarked. With no region there is nothing to show.", ["off", "tint", "lines", "both"], { region: ["sphere", "box", "band", "seeded"] }),
  n("highlightAmount", "Tint amount", "How far the tint moves a facet toward the highlight color where importance is 1.", 0, 1, 0.01, 0, 1, { visibleWhen: { region: ["sphere", "box", "band", "seeded"], highlight: ["tint", "both"] } }),

  select("compare", "Compare", "Ghost draws the source's own visible edges faintly over the abstraction, so you see what the facets replaced. Side by side draws the source on the left and the abstraction on the right, each with the same camera and treatment.", ["off", "ghost", "beside"]),
  select("ghostLines", "Ghost edges", "The source's outline only, or all of its edges.", ["outline", "mesh"], ghosted),
  n("ghostWeight", "Ghost weight", "Stroke width of the ghost lines.", 0.2, 2, 0.1, 0, 50, { visibleWhen: ghosted }),
  n("ghostOpacity", "Ghost opacity", "Opacity of the ghost lines.", 0.05, 0.8, 0.01, 0, 1, { visibleWhen: ghosted }),
];

const controlGroups: ControlGroup[] = [
  { label: "Source", stage: "form", controls: ["source", "detail", "terrainVariant", "vaseProfile"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "size"] },
  { label: "Abstraction", stage: "process", controls: ["keep", "rule", "maxError", "boundary", "keepCreases", "creaseAngle"] },
  { label: "Preserved region", stage: "process", controls: ["region", "regionX", "regionY", "regionZ", "regionSize", "regionAxis", "bandFrom", "bandTo", "regionCount", "falloff", "invert"] },
  { label: "View", stage: "frame", controls: ["projection", "yaw", "pitch", "roll", "distance"] },
  { label: "Facets", stage: "material", controls: ["facets", "facetOpacity", "light", "contrast"] },
  { label: "Lines", stage: "material", controls: ["edges", "lineMaterial", "hiddenLines", { label: "Line weights", controls: ["lineWeight", "ghostWeight"], proportional: true }] },
  { label: "Highlight", stage: "material", controls: ["highlight", "highlightAmount"] },
  { label: "Comparison", stage: "process", controls: ["compare", "ghostLines", "ghostOpacity"] },
];

const optionLabels: Record<string, Record<string, string>> = {
  source: { icosphere: "Icosphere", terrain: "Terrain", vase: "Vase", figure: "Faceted figure", torus: "Torus" },
  rule: { quadric: "Error-driven", length: "Shortest edge" },
  boundary: { hold: "Hold", free: "Free", frozen: "Frozen" },
  region: { none: "None", sphere: "Sphere", box: "Box", band: "Band", seeded: "Seeded spheres" },
  regionAxis: { x: "X", y: "Y", z: "Z" },
  projection: { orthographic: "Orthographic", perspective: "Perspective" },
  facets: { shaded: "Shaded", flat: "Flat color", none: "None" },
  edges: { none: "None", outline: "Outline", mesh: "Every edge" },
  lineMaterial: { ink: "Ink", stitch: "Stitch", beads: "Beads" },
  hiddenLines: { drop: "Drop", faint: "Faint", dashed: "Dashed" },
  highlight: { off: "Off", tint: "Tint facets", lines: "Color edges", both: "Both" },
  compare: { off: "Off", ghost: "Ghost source", beside: "Side by side" },
  ghostLines: { outline: "Outline", mesh: "Every edge" },
  terrainVariant: { hills: "Hills", ridges: "Ridges", crater: "Crater", dunes: "Dunes" },
  vaseProfile: { amphora: "Amphora", goblet: "Goblet", bottle: "Bottle", urn: "Urn" },
};
const labelled = (parameter: Parameter): Parameter => {
  const labels = optionLabels[parameter.key];
  return labels ? { ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) } : parameter;
};

/** Control checks that need more than one value (only for values that matter under the current choices). */
export function validateMeshAbstraction(q: Record<string, number | string | boolean>): void {
  if (q.region === "band" && Number(q.bandFrom) > Number(q.bandTo)) throw new Error(`Band from (${q.bandFrom}) must not exceed Band to (${q.bandTo})`);
  if (q.source === "figure" && Number(q.detail) > 6) throw new Error(`Source detail ${q.detail} is too fine for the figure's head (at most 6); lower Source detail`);
  if (q.source === "icosphere" && 20 * 4 ** (Number(q.detail) - 1) > SIMPLIFY_LIMITS.maxTriangles)
    throw new Error(`Source detail ${q.detail} makes an icosphere of ${20 * 4 ** (Number(q.detail) - 1)} triangles; the limit is ${SIMPLIFY_LIMITS.maxTriangles}; lower Source detail`);
}

export const meshAbstractionDefinition: InstrumentDefinition = {
  id: "mesh-abstraction", title: "Mesh Abstraction",
  description: "A detailed surface (a fine sphere, terrain, vase, figure or torus) transitions into coarse flat facets while a chosen region keeps every vertex of its detail. Edge collapse removes the cheapest edges first under a stated error rule, never tearing the surface or folding a facet, and the facet count is scrubbable. The facets are painted far to near, the edges are hidden-line solved, the preserved region can be tinted or ruled in its own color, and the untouched source can ghost over the result or stand beside it.",
  procedure: "Take a detailed terrain mesh and collapse its edges cheapest first, where each edge's price is how far its ends would move the surface if merged. Refuse any collapse that pinches, tears or folds a facet, and never touch vertices in one preserved patch. Paint the facets far to near and solve the hidden lines.",
  renderer: "2d",
  parameters: parameters.map(labelled), controlGroups,
  validate: validateMeshAbstraction,
  defaults: {
    source: "terrain", detail: 5, terrainVariant: "hills", vaseProfile: "amphora",
    centerX: 320, centerY: 330, size: 560,
    keep: 0.05, rule: "quadric", maxError: 0, boundary: "hold", keepCreases: false, creaseAngle: 35,
    region: "sphere", regionX: 0.62, regionY: 0.5, regionZ: 0.42, regionSize: 0.16, regionAxis: "y", bandFrom: 0.4, bandTo: 0.7, regionCount: 3, falloff: 0.14, invert: false,
    projection: "orthographic", yaw: 28, pitch: 34, roll: 0, distance: 2.6,
    facets: "shaded", facetOpacity: 1, light: 300, contrast: 0.75,
    edges: "mesh", lineMaterial: "ink", hiddenLines: "drop", lineWeight: 0.9,
    highlight: "both", highlightAmount: 0.45,
    compare: "off", ghostLines: "outline", ghostWeight: 0.6, ghostOpacity: 0.35,
  },
};
