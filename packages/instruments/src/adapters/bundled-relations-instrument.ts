import { relationGroupNames, relationSampleTitles } from "../composition/bundle-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  control(toggle(key, label, description), visibleWhen);

/** Every bundled sample has six groups; a group control names one by position and its label lists every sample's group there. */
export const GROUP_COUNT = 6;
const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const groupPick = (slot: number) => `${ordinals[slot]} group (${relationGroupNames.map((names) => names[slot]).join(" · ")})`;
const groupNote = ` Groups are picked by position, so what this names depends on the Dataset: ${relationSampleTitles.map(([, title], i) => `${title}: ${relationGroupNames[i].join(", ")}`).join("; ")}.`;

const ring: Condition = { endpoints: ["circle"] };
const sectored: Condition = { endpoints: ["circle", "line"] };
const directed: Condition = { direction: ["source"] };
const arrowed: Condition = { direction: ["source"], arrows: [true] };
const banded: Condition = { endpoints: ["circle", "line"], groupBands: [true] };
const highlighted: Condition = { highlight: ["group", "pair", "heaviest"] };
const marks = [["dot", "Dot"], ["rings", "Ring"], ["rosette", "Rosette"], ["arrow", "Arrow"]] as const satisfies readonly Option[];
const materials = [["ink", "Ink"], ["stitch", "Stitches"], ["beads", "Beads"]] as const satisfies readonly Option[];

export const bundledRelationsDefinition: InstrumentDefinition = {
  id: "bundled-relations",
  title: "Bundled Relations",
  description: "Weighted relationships between grouped places, drawn as families of curves: edges join through shared waypoints only when they connect the same two groups, so a few readable ribbons replace the tangle. Bundle strength zero is the plain straight-edge drawing.",
  procedure: "Zones in six districts sit around a ring, and each of their weighted links is routed through shared waypoints. Links between the same districts pull together into ribbons that change colour from origin to destination, while links within a district curl back as petals.",
  renderer: "2d",
  parameters: [
    select("dataset", "Dataset", "The recorded relationships. Every dataset has six groups of places and weighted edges between them; the datasets differ in size, density and whether flows have a direction.",
      relationSampleTitles.map(([id, title]): Option => [id, title])),
    select("direction", "Direction", "None reads every edge as an undirected link. Source keeps each edge's from → to orientation, so arrowheads are available and opposite flows between two groups can form separate bundles. Datasets whose edges have no direction (Field citations) ignore it.",
      [["none", "None"], ["source", "From → to"]]),
    select("scope", "Edges shown", "All edges, only those between two groups, or only those inside a group. The layout and every remaining route are unchanged.",
      [["all", "All"], ["between", "Between groups"], ["within", "Within groups"]]),
    n("minWeight", "Weakest flow", "Leave out edges whose weight is below this fraction of the strongest edge's. Surviving edges keep their routes exactly.", 0, 1, .01, 0, 1),
    n("retention", "Edge retention", "Stable omission of edges (by edge id) that leaves open space without moving what remains; a new seed re-deals which edges stay.", 0, 1, .01, 0, 1),

    select("endpoints", "Endpoints", "How places are arranged. Circle and line put each group in its own stretch of a ring or baseline; map keeps the dataset's own positions, so bundles run between real places.",
      [["circle", "Circle"], ["line", "Line"], ["map", "Map positions"]]),
    select("nodeOrder", "Order within group", "How places are ordered inside their group: as recorded, largest flow first, a stable seeded shuffle, or by where their partners lie, which removes most crossings.",
      [["table", "As recorded"], ["flow", "Largest flow first"], ["partners", "By partners"], ["shuffled", "Seeded shuffle"]], sectored),
    select("sectorBy", "Group size by", "Give every group room proportional to its number of places, or to its total flow.", [["count", "Places"], ["flow", "Total flow"]], sectored),
    n("groupGap", "Gap between groups", "Share of the ring (or line) left empty between groups.", 0, .4, .01, 0, .9, sectored),
    n("startAngle", "Start angle", "Where the first group begins on the ring, in degrees clockwise from the right; -90 is the top.", -180, 180, 1, -720, 720, ring),
    n("centerX", "Center X", "Horizontal center of the footprint.", 0, 640, 1, -4096, 4096),
    n("centerY", "Center Y", "Vertical center of the footprint.", 0, 640, 1, -4096, 4096),
    n("width", "Width", "Footprint width: the ring's horizontal diameter, the line's length, or the width the map positions are stretched to.", 100, 640, 1, 1, 8192),
    n("height", "Height", "Footprint height: the ring's vertical diameter, how high arcs may rise above a line, or the height the map positions are stretched to.", 100, 640, 1, 1, 8192),
    n("rotation", "Rotation", "Turns the whole layout about its center, in degrees.", -180, 180, 1, -720, 720),

    n("strength", "Bundle strength", "How closely edges follow their family's shared waypoints. Zero draws every edge straight between its two places; one follows the waypoints fully.", 0, 1, .01, 0, 1),
    select("families", "Bundles", "Pair: edges between the same two groups share one bundle. Directed: a → b and b → a form separate, side-by-side bundles, so opposite flows stay apart.",
      [["pair", "One per pair of groups"], ["directed", "One per direction"]], directed),
    n("inset", "Hub depth", "How far each group's hub lies toward the interior (zero at the endpoints, one at the ring's center, the line's full height or the map's centroid). Deeper hubs pull edges into longer shared runs.", 0, 1, .01, 0, 1),
    n("lift", "Trunk lift", "How far each bundle bulges toward the interior between its two groups, as a share of half the distance between them.", 0, 1, .01, 0, 1, { scope: ["all", "between"] }),
    n("separation", "Bundle separation", "Spread of the bundles that meet at one group across that group's extent. Zero stacks them on the hub; larger values leave a visible lane for each partner group.", 0, 1, .01, 0, 1, { scope: ["all", "between"] }),
    n("detail", "Curve detail", "Samples per curve span. Low values show the polygon's corners; high values are smoother and cost more to draw.", 4, 16, 1, 1, 32, undefined, true),

    select("highlight", "Highlight", "Draw a chosen family heavier: every edge touching a group, every edge between two groups, or the heaviest few edges.",
      [["none", "None"], ["group", "Edges of a group"], ["pair", "Between two groups"], ["heaviest", "Heaviest edges"]]),
    n("focusGroup", "Group", "The group to highlight, by position (1 to 6)." + groupNote, 1, GROUP_COUNT, 1, 1, GROUP_COUNT, { highlight: ["group", "pair"] }, true),
    n("partnerGroup", "Partner group", "The second group of the highlighted pair, by position (1 to 6). Choosing the same group highlights edges inside it." + groupNote, 1, GROUP_COUNT, 1, 1, GROUP_COUNT, { highlight: ["pair"] }, true),
    n("heaviestShare", "Share of edges", "Fraction of the shown edges, heaviest first, that are highlighted (at least one).", 0, .5, .01, 0, 1, { highlight: ["heaviest"] }),
    select("highlightTone", "Highlight color", "Keep each highlighted edge's own color, or draw them all in the first (ink) color of the palette.", [["edge", "Edge color"], ["ink", "Ink"]], highlighted),
    select("highlightMaterial", "Highlight material", "Ink, stitches or beads along highlighted edges.", materials, highlighted),
    n("highlightWeight", "Highlight weight", "Stroke width of the heaviest highlighted edges.", .5, 10, .1, 0, 50, { highlight: ["group", "pair", "heaviest"], highlightMaterial: ["ink", "stitch"] }),
    n("highlightSpacing", "Highlight spacing", "Distance between stitches or beads on highlighted edges.", 3, 30, .5, .5, 1000, { highlight: ["group", "pair", "heaviest"], highlightMaterial: ["stitch", "beads"] }),
    select("highlightBead", "Highlight bead", "Mark on each highlighted bead; arrows point along the flow.", marks, { highlight: ["group", "pair", "heaviest"], highlightMaterial: ["beads"] }),
    n("highlightBeadSize", "Highlight bead size", "Diameter of the largest highlighted beads.", 2, 24, .5, 0, 500, { highlight: ["group", "pair", "heaviest"], highlightMaterial: ["beads"] }),

    select("edgeMaterial", "Edge material", "Ink, stitches or beads along every edge; the curves are the same, only how they are drawn changes.", materials),
    n("edgeWeight", "Edge weight", "Stroke width of the heaviest edges of an ink or stitch drawing.", .2, 6, .05, 0, 50, { edgeMaterial: ["ink", "stitch"] }),
    n("weightContrast", "Weight contrast", "How much thinner (or smaller, for beads) the weakest edges are than the strongest. Zero draws every edge alike; edges fall into five weight bands.", 0, .95, .01, 0, .95),
    n("edgeSpacing", "Edge spacing", "Distance between stitches or beads along an edge.", 3, 30, .5, .5, 1000, { edgeMaterial: ["stitch", "beads"] }),
    select("edgeBead", "Edge bead", "Mark on each bead; arrows point along the flow.", marks, { edgeMaterial: ["beads"] }),
    n("edgeBeadSize", "Bead size", "Diameter of the largest beads.", 1.5, 16, .5, 0, 500, { edgeMaterial: ["beads"] }),
    select("edgeTone", "Edge color", "One color, the color of each edge's source group or target group, or source color changing to target color at the middle of the edge, which shows the direction of every flow without arrowheads.", [["flat", "One color"], ["source", "Source group"], ["target", "Target group"], ["flow", "Source → target"]]),
    flag("arrows", "Arrowheads", "Mark the direction of every edge with a small arrow along it.", directed),
    n("arrowSize", "Arrow size", "Length of the direction arrows. Edges shorter than three arrow lengths get none.", 3, 16, .5, 0, 500, arrowed),
    n("arrowAt", "Arrow position", "Where along each edge the arrow sits, from its start (0) to its end (1).", .1, .95, .01, 0, 1, arrowed),
    n("arrowShare", "Arrow share", "Fraction of the eligible edges that carry an arrow, chosen by edge id; at most 400 arrows are drawn.", 0, 1, .01, 0, 1, arrowed),

    select("nodeMark", "Place mark", "Dot, ring or rosette at every place.", [["dot", "Dot"], ["rings", "Ring"], ["rosette", "Rosette"]]),
    n("nodeSize", "Place size", "Diameter of the mark of the largest place; zero hides the places.", 0, 20, .5, 0, 500),
    select("nodeScaleBy", "Size by", "Scale every place by its total flow relative to the largest, or draw all equal.", [["uniform", "Uniform"], ["weight", "Total flow"]]),
    n("nodeScaleAmount", "Size contrast", "How much smaller the place with least flow is drawn.", 0, .9, .01, 0, .95, { nodeScaleBy: ["weight"] }),
    flag("groupBands", "Group bands", "Draw a thick arc (ring) or bar (line) along each group, in the group's color.", sectored),
    n("bandWeight", "Band weight", "Stroke width of the group bands.", 1, 14, .5, 0, 50, banded),
  ],
  controlGroups: [
    { label: "Relations", stage: "form", controls: ["dataset", "direction", { label: "Selection", controls: ["scope", "minWeight", "retention"] }] },
    { label: "Endpoints", stage: "form", controls: ["endpoints", "nodeOrder", "sectorBy", "groupGap", "startAngle"] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
    { label: "Bundling", stage: "process", controls: ["strength", "families", { label: "Waypoints", controls: ["inset", "lift", "separation"] }, "detail"] },
    { label: "Highlight", stage: "material", controls: ["highlight", "focusGroup", "partnerGroup", "heaviestShare", "highlightTone", "highlightMaterial",
      "highlightWeight", "highlightSpacing", { label: "Bead mark", controls: ["highlightBead", "highlightBeadSize"] }] },
    { label: "Edges", stage: "material", controls: ["edgeMaterial", "edgeWeight", "weightContrast", "edgeSpacing", { label: "Bead mark", controls: ["edgeBead", "edgeBeadSize"] }, "edgeTone",
      { label: "Direction", controls: ["arrows", "arrowSize", "arrowAt", "arrowShare"] }] },
    { label: "Places", stage: "material", controls: ["nodeMark", "nodeSize", "nodeScaleBy", "nodeScaleAmount", { label: "Group bands", controls: ["groupBands", "bandWeight"] }] },
  ] satisfies ControlGroup[],
  defaults: {
    dataset: "commuters", direction: "source", scope: "all", minWeight: 0, retention: 1,
    endpoints: "circle", nodeOrder: "partners", sectorBy: "count", groupGap: .08, startAngle: -90,
    centerX: 320, centerY: 320, width: 450, height: 450, rotation: 0,
    strength: .9, families: "directed", inset: .6, lift: .5, separation: .15, detail: 8,
    highlight: "pair", focusGroup: 2, partnerGroup: 3, heaviestShare: .1, highlightTone: "ink", highlightMaterial: "ink", highlightWeight: 3.2,
    highlightSpacing: 8, highlightBead: "dot", highlightBeadSize: 8,
    edgeMaterial: "ink", edgeWeight: 1.5, weightContrast: .75, edgeSpacing: 8, edgeBead: "dot", edgeBeadSize: 4, edgeTone: "flow",
    arrows: false, arrowSize: 8, arrowAt: .8, arrowShare: .5,
    nodeMark: "dot", nodeSize: 7, nodeScaleBy: "weight", nodeScaleAmount: .6, groupBands: true, bandWeight: 5,
  },
};
