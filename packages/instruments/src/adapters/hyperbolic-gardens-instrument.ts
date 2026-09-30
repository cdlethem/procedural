import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["p", "q", "generations", "ringCount", "petals", "twigs"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

const filled: Condition = { cellFill: ["flat", "hatch", "flat-bare", "hatch-bare", "flat-hatch"] };
const hatched: Condition = { cellFill: ["hatch", "hatch-bare", "flat-hatch"] };
const edged: Condition = { edgeMaterial: ["ink", "stitch", "beads"] };
const weighted: Condition = { edgeMaterial: ["ink", "stitch"] };
const stationed: Condition = { edgeMaterial: ["stitch", "beads"] };
const beaded: Condition = { edgeMaterial: ["beads"] };
const ringed: Condition = { ringsAround: ["cell", "vertex", "edge"] };
const marked: Condition = { motif: ["arrow", "dot", "rings", "rosette", "sprig"] };
const stroked: Condition = { motif: ["arrow", "rings", "rosette", "sprig"] };
const turned: Condition = { motif: ["arrow", "rosette", "sprig"] };
const limited: Condition = { limit: [true] };

const markChoices: [string, string][] = [["dot", "Dot"], ["rings", "Rings"], ["rosette", "Rosette"], ["arrow", "Arrow"]];

const parameters: Parameter[] = [
  n("p", "Polygon sides", "Sides of every cell. With Cells at a vertex it names the tiling {p,q}: the cells are regular p-gons, q of them meeting at each corner. It must satisfy (p-2)(q-2) > 4; smaller pairs are the Euclidean or spherical tilings and are refused.", 3, 12, 1, 3, 24),
  n("q", "Cells at a vertex", "Cells meeting at every corner. More cells per corner and more sides both make cells shrink faster toward the boundary; {7,3}, {5,4}, {4,5} and {3,7} are the classic small cases.", 3, 12, 1, 3, 24),
  select("center", "Centre on", "Where the middle of the disk sits: on a cell centre (p-fold symmetry), on a vertex (q-fold) or on the midpoint of an edge (two-fold). The tiling is the same; the view of it is not.",
    [["polygon", "Cell centre"], ["vertex", "Vertex"], ["edge", "Edge midpoint"]]),
  n("generations", "Generations", "Rings of cells grown outward from the centre; each ring is every cell sharing an edge with the previous one. Growth also stops at the disk radius and the smallest cell, so this is a ceiling, not a count.", 0, 10, 1, 0, 40),
  n("diskRadius", "Disk radius", "Cells are kept only when all their corners lie inside this fraction of the disk. Near 1 the cells crowd toward the boundary circle; lower it to stop early and leave a plain rim. Tilings with many-sided cells have large cells and need a value near 1 before any cell beyond the first fits.", 0.5, 0.999, 0.001, 0.001, 0.9999),
  n("minSize", "Smallest cell", "Cells whose drawn diameter falls below this many canvas units are not built and nothing beyond them is either: the pixel-scale stop that bounds the work. Lower it to reach closer to the boundary.", 0.5, 12, 0.1, 0.05, 10000,
    [{ diskRadius: { gt: 0.9985 } }, { p: { lte: 12 } }]),
  n("retention", "Cell retention", "Share of cells kept. Omitted cells leave bare paper and take their edges, rings and motifs with them; the same cells are omitted whatever the drawing style.", 0, 1, 0.01, 0, 1),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the disk.", 80, 560, 1, -100000, 100000),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the disk.", 80, 560, 1, -100000, 100000),
  n("radius", "Disk radius (canvas)", "Canvas radius of the boundary circle. Every length in the tiling scales with it.", 100, 320, 1, 1, 100000),
  n("rotation", "Rotation", "Turns the whole tiling about the disk centre, clockwise in degrees. At 0 the central vertex axis points up.", -180, 180, 1, -3600, 3600),

  select("cellFill", "Fill", "How cell interiors are painted. The checker choices alternate by generation: with an even number of cells at a vertex that is an exact two-colouring of the tiling, otherwise a ring pattern. Hatching runs at one direction across the canvas.",
    [["none", "None"], ["flat", "Flat"], ["hatch", "Hatched"], ["flat-bare", "Checker: flat and bare"], ["hatch-bare", "Checker: hatched and bare"], ["flat-hatch", "Checker: flat and hatched"]]),
  n("inset", "Gap between fills", "How far each filled cell is drawn back toward its centre, as a fraction of the way to its corners. The gap is a true hyperbolic inset, so it narrows toward the boundary like everything else.", 0, 0.6, 0.01, 0, 0.95, filled),
  n("opacity", "Fill opacity", "Paint strength of flat fills and hatch lines.", 0, 1, 0.01, 0, 1, filled),
  n("hatchSpacing", "Hatch spacing", "Distance between hatch lines, in canvas units (not tapered).", 2, 16, 0.25, 0.5, 1000, hatched),
  n("hatchAngle", "Hatch angle", "Direction of the hatch lines on the canvas, in degrees.", -90, 90, 1, -3600, 3600, hatched),
  n("hatchWeight", "Hatch weight", "Line thickness of hatching at the disk centre; it follows Weight taper toward the boundary.", 0.2, 3, 0.05, 0, 50, hatched),

  select("edgeMaterial", "Edge material", "Every shared cell edge is drawn once as a geodesic arc: ink, stitches or beads along it.",
    [["none", "None"], ["ink", "Ink"], ["stitch", "Stitch"], ["beads", "Beads"]]),
  select("edgeColor", "Edge color", "Ink, or a palette color by the generation of the cells the edge borders.", [["ink", "Ink"], ["generation", "By generation"]], edged),
  n("edgeWeight", "Edge weight", "Line thickness of ink and stitches at the disk centre; it follows Weight taper toward the boundary.", 0.2, 3, 0.05, 0, 50, weighted),
  n("edgeSpacing", "Station spacing", "Distance between stitch or bead stations along an edge at the disk centre; it shrinks with Weight taper.", 3, 24, 0.5, 0.5, 1000, stationed),
  n("edgePhase", "Station phase", "Slides stations along every edge by a fraction of the spacing.", 0, 1, 0.01, 0, 1, stationed),
  select("beadMark", "Bead mark", "Point vocabulary on each bead station.", markChoices, beaded),
  n("beadSize", "Bead diameter", "Size of each bead at the disk centre.", 1, 16, 0.5, 0, 500, beaded),
  n("beadWeight", "Bead line weight", "Thickness of ring outlines, rosette petals and arrows in beads.", 0.2, 3, 0.05, 0, 50, beaded),

  select("ringsAround", "Rings around", "Concentric circles drawn in every chamber and joined across the mirror lines into closed rings: around cell centres, around vertices or around edge midpoints. Where they open, the region ends.",
    [["none", "None"], ["cell", "Cell centres"], ["vertex", "Vertices"], ["edge", "Edge midpoints"]]),
  n("ringCount", "Rings", "Concentric rings per centre, evenly spaced out to the ring radius.", 1, 6, 1, 1, 24, ringed),
  n("ringRadius", "Ring radius", "Outermost ring as a fraction of the largest circle that fits: at 1 a cell ring touches the edge midpoints and vertex rings touch each other.", 0.1, 1, 0.01, 0.01, 1, ringed),
  n("ringRound", "Roundness", "0 draws each ring as a straight-sided geodesic polygon, 1 as a true hyperbolic circle; between them the corners soften.", 0, 1, 0.01, 0, 1, ringed),
  n("ringWeight", "Ring weight", "Line thickness of rings at the disk centre; it follows Weight taper toward the boundary.", 0.2, 3, 0.05, 0, 50, ringed),

  select("motif", "Motif", "A small mark placed once in every fundamental triangle of every cell, turned and reflected exactly as the group moves it and scaled by the disk's conformal factor, so it shrinks toward the boundary. Arrows and sprigs are chiral, so reflections read.",
    [["none", "None"], ["arrow", "Arrow"], ["sprig", "Sprig"], ["dot", "Dot"], ["rings", "Rings"], ["rosette", "Rosette"]]),
  n("anchorRadial", "Anchor: centre to edge", "Where in the triangle the motif sits: 0 is the cell centre, 1 is on the cell edge. At 0 or 1 the copies that land on one point are merged, so a motif on a mirror is placed once, not twice.", 0, 1, 0.01, 0, 1, marked),
  n("anchorAlong", "Anchor: vertex to edge middle", "Slides the anchor along the cell edge from the vertex (0) to the edge midpoint (1). At 0 or 1 the anchor is on a mirror line and coincident copies are merged.", 0, 1, 0.01, 0, 1, marked),
  select("motifColor", "Motif color", "Ink, the same palette entry as the cells beneath (color by), or the next entry along so the motif stands out from a fill of its own color.",
    [["ink", "Ink"], ["color", "As cells"], ["contrast", "Contrast"]], marked),
  n("motifFit", "Motif size", "Motif diameter as a fraction of one cell edge at that place, so it shrinks with the cells.", 0.05, 1.2, 0.01, 0, 3, marked),
  n("motifWeight", "Motif line weight", "Thickness of motif strokes at the disk centre; strokes shrink with the motif.", 0.2, 3, 0.05, 0, 50, stroked),
  n("motifTurn", "Motif turn", "Extra rotation of the motif inside its frame, in degrees, before the frame is applied.", -180, 180, 1, -3600, 3600, turned),
  n("petals", "Rosette petals", "Radial strokes in each rosette.", 3, 12, 1, 1, 48, { motif: ["rosette"] }),
  n("twigs", "Sprig twigs", "Side twigs on each sprig; every twig forks once at its tip.", 2, 8, 1, 1, 12, { motif: ["sprig"] }),
  n("opening", "Motif opening", "Open center of rosettes, or inner ring offset of rings.", 0, 0.9, 0.01, 0, 1, { motif: ["rings", "rosette"] }),
  n("motifVariation", "Size variation", "Stable random shrinkage of individual motifs; a new seed reshuffles it.", 0, 1, 0.01, 0, 1, marked),
  n("minMark", "Smallest motif", "Motifs whose drawn diameter falls below this many canvas units are left out: the pixel-scale stop for marks.", 0, 8, 0.25, 0, 1000, marked),

  select("colorBy", "Color by", "What decides the palette entry of fills, rings and motifs: generation (rings of color outward), mirror distance (the wave of reflections from the base triangle), parity (cells by ring parity, motifs by reflection), symmetry sector (petals around the centre), one accent, or ink.",
    [["generation", "Generation"], ["distance", "Mirror distance"], ["parity", "Parity"], ["sector", "Sector"], ["single", "One accent"], ["ink", "Ink"]]),

  flag("limit", "Boundary circle", "Draw the boundary circle the tiling compresses toward."),
  n("limitWeight", "Boundary weight", "Line thickness of the boundary circle.", 0.2, 4, 0.05, 0, 50, limited),
  n("taper", "Weight taper", "How much line weights (edges, rings, hatching) and station spacing shrink with the disk's conformal factor: 0 keeps them constant, 1 makes them proportional, so lines thin out toward the boundary as the cells do.", 0, 1, 0.01, 0, 1),
];

const controlGroups: ControlGroup[] = [
  { label: "Tiling", controls: ["p", "q", "center", "generations", "diskRadius", "minSize", "retention"] },
  { label: "Placement", controls: ["centerX", "centerY", "radius", "rotation"] },
  { label: "Cells", controls: ["cellFill", "inset", "opacity", { label: "Hatch", controls: ["hatchSpacing", "hatchAngle", "hatchWeight"] }] },
  { label: "Edges", controls: ["edgeMaterial", "edgeColor", "edgeWeight", { label: "Stations", controls: ["edgeSpacing", "edgePhase"] },
    { label: "Bead mark", controls: ["beadMark", { label: "Scale", controls: ["beadSize", "beadWeight"], proportional: true }] }] },
  { label: "Rings", controls: ["ringsAround", "ringCount", "ringRadius", "ringRound", "ringWeight"] },
  { label: "Motif", controls: ["motif", "motifColor", { label: "Anchor", controls: ["anchorRadial", "anchorAlong"] }, "motifFit", "motifWeight", "motifTurn", "petals", "twigs", "opening", "motifVariation", "minMark"] },
  { label: "Color", controls: ["colorBy"] },
  { label: "Boundary", controls: ["limit", "limitWeight", "taper"] },
];

type Values = Record<string, number | string | boolean>;

/** The stored values alone decide these; geometry-dependent limits are checked when the tiling is built, with controls named. */
export function validateHyperbolicGardens(q: Values): void {
  const p = q.p as number, v = q.q as number;
  if (Number.isInteger(p) && Number.isInteger(v) && (p - 2) * (v - 2) <= 4)
    throw new Error(`{${p},${v}} is not a hyperbolic tiling: (p-2)(q-2) = ${(p - 2) * (v - 2)} must exceed 4. Raise Polygon sides or Cells at a vertex`);
}

export const hyperbolicGardensDefinition: InstrumentDefinition = {
  id: "hyperbolic-gardens", title: "Hyperbolic Gardens",
  description: "Regular hyperbolic tilings in the Poincaré disk: cells, geodesic edges and rings that shrink toward the boundary circle, with motifs placed in every mirror-image triangle at the true local scale and turn.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    p: 5, q: 4, center: "polygon", generations: 9, diskRadius: 0.985, minSize: 1.6, retention: 0.95,
    centerX: 320, centerY: 320, radius: 296, rotation: 0,
    cellFill: "flat-bare", inset: 0.05, opacity: 0.9, hatchSpacing: 3.5, hatchAngle: 35, hatchWeight: 0.8,
    edgeMaterial: "ink", edgeColor: "ink", edgeWeight: 1.6, edgeSpacing: 8, edgePhase: 0.3, beadMark: "dot", beadSize: 5, beadWeight: 1,
    ringsAround: "none", ringCount: 2, ringRadius: 0.6, ringRound: 1, ringWeight: 1,
    motif: "sprig", motifColor: "contrast", anchorRadial: 0.6, anchorAlong: 0.35, motifFit: 0.42, motifWeight: 1.4, motifTurn: 0, petals: 6, twigs: 4, opening: 0.3, motifVariation: 0.25, minMark: 2,
    colorBy: "generation",
    limit: true, limitWeight: 1.4, taper: 0.7,
  },
  validate: validateHyperbolicGardens,
};
