import { GROWTH_STEP_LIMIT, MAX_ITERATIONS, checkGrowthSpec } from "../composition/laplacian-growth.js";
import type { GrowthSpec } from "../composition/laplacian-growth.js";
import { GROWTH_LIMITS } from "../composition/laplacian-layout.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Values = Record<string, number | string | boolean>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["seedLobes", "seedCount", "sourceCount", "sinkCount", "barrierGaps", "pillarCount", "grid", "precision", "maxIterations",
  "steps", "frontEvery", "frontSmooth", "fillBands", "potentialLines"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);

const lobed: Condition = { seedShape: ["lobed"] };
const counted: Condition = { seedShape: ["cluster", "necklace"] };
const spread: Condition = { seedShape: ["cluster", "necklace", "bar"] };
const turned: Condition = { seedShape: ["lobed", "necklace", "bar"] };
const radial: Condition = { source: ["ring", "points"] };
const banded: Condition = { source: ["frame", "edge", "points"] };
const pointed: Condition = { source: ["points"] };
const sided: Condition = { source: ["edge"] };
const sunk: Condition = { sinks: ["discs"] };
const walled: Condition = { barrier: ["wall"] };
const pillared: Condition = { barrier: ["pillars"] };
const stroked: Condition = { frontMaterial: ["ink", "stitch", "beads"] };
const spaced: Condition = { frontMaterial: ["stitch", "beads"] };
const beaded: Condition = { frontMaterial: ["beads"] };
const filled: Condition = { fill: ["flat", "bands"] };
const bands: Condition = { fill: ["bands"] };
const marked: Condition = { marks: ["age", "tips"] };
const aged: Condition = { marks: ["age"] };
const tipped: Condition = { marks: ["tips"] };
const lined: Condition = { potential: ["lines"] };
const walled2: Condition = { barrier: ["wall", "pillars"] };
const wallLined: Condition = { barrierOutline: [true] };
const sinkLined: Condition = { sinkOutline: [true] };

const parameters: Parameter[] = [
  select("seedShape", "Seed shape", "The region that is occupied at the start and grows: a disc, a lobed disc (a circle whose radius swells and shrinks around it), a cluster of scattered discs, a necklace of discs on a ring, or a bar.",
    ["disc", "lobed", "cluster", "necklace", "bar"]),
  n("seedLobes", "Lobes", "How many swellings the lobed seed has around its edge. The tips of the lobes are where the flux concentrates first.", 2, 12, 1, 1, 24, lobed),
  n("seedDepth", "Lobe depth", "How far the lobes swell and shrink, as a fraction of the seed radius: 0 is a plain disc.", 0, 0.5, 0.01, 0, 0.95, lobed),
  n("seedCount", "Seed discs", "Number of discs of a cluster (scattered by the structural seed) or of a necklace (equally spaced on a ring).", 2, 24, 1, 1, GROWTH_LIMITS.maxSeedDiscs, counted),

  n("seedX", "Seed X", "Horizontal canvas position of the middle of the seed.", 0, 640, 1, -640, 1280),
  n("seedY", "Seed Y", "Vertical canvas position of the middle of the seed.", 0, 640, 1, -640, 1280),
  n("seedRadius", "Seed radius", "Radius of a disc or lobed seed, of each disc of a cluster or necklace, and the half-thickness of a bar, in canvas units. A seed too small for the surface tension never grows.", 6, 140, 1, 0.01, 2560),
  n("seedSpread", "Seed spread", "Cluster: radius of the area the discs are scattered over. Necklace: radius of the ring. Bar: its length. Canvas units.", 20, 260, 1, 0, 2560, spread),
  n("seedAngle", "Seed angle", "Degrees. Turns the lobes, the first necklace disc or the bar.", -180, 180, 1, -3600, 3600, turned),

  select("source", "Source", "Where the potential is held at 1 and the flux comes from: a ring far from the seed, the whole frame of the canvas, one side, or a few point sources. Everywhere else the canvas edge is insulating.",
    ["ring", "frame", "edge", "points"]),
  n("sourceRadius", "Source radius", "Ring: the distance from the canvas centre beyond which the potential is 1. Points: the radius of the circle they sit on. Canvas units.", 100, 320, 1, 0, 2560, radial),
  n("sourceSize", "Source size", "Frame and edge: thickness of the source band. Points: radius of each point. Canvas units.", 4, 80, 1, 0, 2560, banded),
  n("sourceCount", "Source points", "How many point sources, equally spaced on their circle.", 1, 12, 1, 1, GROWTH_LIMITS.maxSourcePoints, pointed),
  select("sourceSide", "Source side", "Which side of the canvas is the source.", ["top", "right", "bottom", "left"], sided),
  n("sourceAngle", "Source angle", "Degrees. Where the first point source sits.", -180, 180, 1, -3600, 3600, pointed),

  select("sinks", "Sinks", "Absorbers: fixed potential 0 regions that are not part of the growth. They steal flux from the growing region, so it leans away from them and leaves bare space around them.", ["none", "discs"]),
  n("sinkCount", "Sink discs", "How many absorbers, equally spaced on their circle.", 1, 8, 1, 1, GROWTH_LIMITS.maxSinks, sunk),
  n("sinkSize", "Sink size", "Radius of each absorber, canvas units.", 6, 80, 1, 0, 2560, sunk),
  n("sinkRing", "Sink ring", "Radius of the circle the absorbers sit on, canvas units.", 40, 300, 1, 0, 2560, sunk),
  n("sinkAngle", "Sink angle", "Degrees. Where the first absorber sits.", -180, 180, 1, -3600, 3600, sunk),
  withCondition(toggle("sinkOutline", "Outline sinks", "Draw the outline of each absorber."), sunk),
  n("sinkLineWeight", "Sink line weight", "Stroke width of the sink outline, canvas units.", 0.5, 4, 0.1, 0, 50, sinkLined),

  select("barrier", "Barrier", "Insulating obstacles the front cannot enter and the flux cannot cross: a wall with gaps, or scattered pillars. Flux funnels through the gaps and around the pillars.", ["none", "wall", "pillars"]),
  n("barrierAngle", "Wall angle", "Degrees. Direction of the wall: 0 is horizontal.", -90, 90, 1, -3600, 3600, walled),
  n("barrierOffset", "Wall offset", "How far the wall lies from the middle of the canvas, perpendicular to itself, canvas units.", -250, 250, 1, -2560, 2560, walled),
  n("barrierWidth", "Wall width", "Thickness of the wall, canvas units.", 4, 60, 1, 0, 2560, walled),
  n("barrierGaps", "Wall gaps", "How many gaps the wall has, equally spaced along it; the structural seed slides them together.", 1, 6, 1, 1, GROWTH_LIMITS.maxGaps, walled),
  n("barrierGapWidth", "Gap width", "Width of each gap, canvas units.", 20, 200, 1, 0, 2560, walled),
  n("pillarCount", "Pillars", "How many pillars, scattered by the structural seed and kept clear of the seed region.", 1, 24, 1, 1, GROWTH_LIMITS.maxPillars, pillared),
  n("pillarSize", "Pillar size", "Radius of each pillar, canvas units.", 6, 60, 1, 0, 2560, pillared),
  withCondition(toggle("barrierOutline", "Outline barrier", "Draw the outline of the wall or pillars, so the reason a front bends is visible."), walled2),
  n("barrierLineWeight", "Barrier line weight", "Stroke width of the barrier outline, canvas units.", 0.5, 4, 0.1, 0, 50, wallLined),

  n("steps", "Steps", "How many times the front advances. Each step moves the fastest point of the front by the step size; growth that has ended (no flux, or surface tension holding every point) simply stops, and every earlier front stays exactly as it was.", 1, 120, 1, 0, GROWTH_STEP_LIMIT),
  n("eta", "Growth bias", "The exponent η of the front speed: speed follows the potential gradient to the power η. 0 moves every point at the same speed, an offset of the seed; 1 is Laplacian growth, where protruding tips run ahead; higher favours fewer, sharper fingers.", 0, 3, 0.05, 0, 8),
  n("tension", "Surface tension", "Regularization, in canvas units: the speed is reduced by this length times the front's curvature, so tips are rounded off, notches fill, and a seed smaller than this length cannot grow at all. 0 leaves the growth unregularized.", 0, 40, 0.5, 0, 2560),
  n("stepScale", "Step size", "How many grid cells the fastest point of the front advances in one step. Smaller steps follow the flux more closely and need more steps to go the same way.", 0.1, 1, 0.05, 0.02, 1),
  n("noise", "Noise", "Seeded variation of how readily each place grows, in lumps about 24 canvas units wide. It breaks the symmetry of a symmetric seed; a new seed is a different set of lumps and so different lobes.", 0, 0.9, 0.01, 0, 0.95),

  n("grid", "Grid", "Cells per side of the square grid the potential is solved on and the front is traced through. Finer grids resolve narrow gaps and thin fingers and cost much more: the work grows with the fourth power of this.", 48, 112, 8, GROWTH_LIMITS.minGrid, GROWTH_LIMITS.maxGrid),
  n("precision", "Solver precision", "Decimal digits of residual the potential solve must reach every step (8 means a residual of 1e-8 against a potential drop of 1). If the iteration limit is reached first the drawing fails with the residual instead of being drawn from an unfinished solution.", 4, 8, 1, 2, 12),
  n("maxIterations", "Solver iterations", "Most relaxation sweeps one step's solve may use (the first solve may use four times as many). It bounds the work: steps × grid² × this.", 100, 1000, 50, 10, MAX_ITERATIONS),

  select("frontMaterial", "Front material", "How the fronts are stroked: ink lines, stitches along them, beads along them, or not at all. Every front takes its color from its age along the palette.", ["ink", "stitch", "beads", "none"]),
  n("frontEvery", "Front interval", "Draw every this-many-th step's front. The most recent one in the window is always drawn.", 1, 20, 1, 1, GROWTH_STEP_LIMIT, stroked),
  n("frontFrom", "First front", "Where in the growth the drawn fronts begin, as a fraction of the steps that changed the front: 0 starts at the seed.", 0, 1, 0.01, 0, 1, stroked),
  n("frontTo", "Last front", "Where the drawn fronts end, as a fraction: 1 ends at the final front.", 0, 1, 0.01, 0, 1, stroked),
  n("frontWeight", "Front weight", "Stroke width of the fronts, canvas units.", 0.3, 3, 0.05, 0, 50, stroked),
  n("finalWeight", "Final weight", "Stroke width of the last front drawn, so the present edge stands out from its history. 0 draws it like the others.", 0, 5, 0.1, 0, 50, stroked),
  n("frontSpacing", "Stitch spacing", "Arc length between stitches or beads, canvas units.", 3, 20, 0.5, 0.5, 1000, spaced),
  n("frontBeadSize", "Bead size", "Diameter of each bead, canvas units.", 1, 8, 0.25, 0, 500, beaded),
  n("frontSmooth", "Front smoothing", "Rounds of corner cutting applied to each drawn front, which rounds the cell-sized steps of the grid without changing the growth.", 0, 3, 1, 0, 3, stroked),

  select("fill", "Fill", "Fill the occupied region: one flat tone, or bands whose tone follows the age of the front that bounded them, oldest inside.", ["none", "flat", "bands"]),
  n("fillOpacity", "Fill opacity", "How strongly the fill covers the paper. Bands overlap, so older bands beneath show through fainter fills as deeper tones.", 0.05, 1, 0.01, 0, 1, filled),
  n("fillBands", "Fill bands", "How many age bands the region is divided into.", 2, 16, 1, 2, 32, bands),

  select("marks", "Marks", "Motifs placed from the same growth: by age (a scatter over the occupied region whose size and tone follow how long ago each place was taken) or at the tips (the places the flux runs fastest now, pointing the way the front is going).", ["none", "age", "tips"]),
  select("markKind", "Mark shape", "The motif drawn at every site.", ["dot", "rings", "rosette", "arrow"], marked),
  n("markSize", "Mark size", "Diameter of a mark, canvas units. By age the mark is smaller where the region is older; at the tips it grows with the local speed.", 3, 30, 0.5, 0, 500, marked),
  n("markSpacing", "Mark spacing", "Distance between the lattice points the age scatter starts from, canvas units (each is nudged a little by the structural seed).", 8, 60, 1, 4, 640, aged),
  n("tipThreshold", "Tip threshold", "Which tips get a mark: only local maxima of the speed whose speed is at least this fraction of the fastest point's.", 0, 1, 0.01, 0, 1, tipped),
  n("markRetention", "Mark retention", "Share of the sites that get a mark; the ones dropped are stable under changes elsewhere.", 0, 1, 0.01, 0, 1, marked),

  select("potential", "Potential lines", "Draw lines of equal potential around the final region: the field the growth followed. They crowd where the flux is strong.", ["none", "lines"]),
  n("potentialLines", "Potential levels", "How many equipotential lines, evenly spaced in potential between the region (0) and the source (1).", 1, 12, 1, 1, 24, lined),
  n("potentialWeight", "Potential weight", "Stroke width of the equipotential lines, canvas units.", 0.3, 2, 0.05, 0, 50, lined),
];

const controlGroups: ControlGroup[] = [
  { label: "Seed", controls: ["seedShape", "seedLobes", "seedDepth", "seedCount"] },
  { label: "Placement", controls: ["seedX", "seedY", { label: "Size", controls: ["seedRadius", "seedSpread"], proportional: true }, "seedAngle"] },
  { label: "Source", controls: ["source", "sourceRadius", "sourceSize", "sourceCount", "sourceSide", "sourceAngle"] },
  { label: "Sinks", controls: ["sinks", "sinkCount", { label: "Size", controls: ["sinkSize", "sinkRing"], proportional: true }, "sinkAngle", "sinkOutline", "sinkLineWeight"] },
  { label: "Barrier", controls: ["barrier", "barrierAngle", "barrierOffset", { label: "Widths", controls: ["barrierWidth", "barrierGapWidth"], proportional: true },
    "barrierGaps", "pillarCount", "pillarSize", "barrierOutline", "barrierLineWeight"] },
  { label: "Growth", controls: ["steps", "eta", "tension", "stepScale", "noise"] },
  { label: "Solver", controls: ["grid", "precision", "maxIterations"] },
  { label: "Fronts", controls: ["frontMaterial", "frontEvery", "frontFrom", "frontTo", { label: "Line weights", controls: ["frontWeight", "finalWeight"], proportional: true },
    "frontSpacing", "frontBeadSize", "frontSmooth"] },
  { label: "Fill", controls: ["fill", "fillOpacity", "fillBands"] },
  { label: "Marks", controls: ["marks", "markKind", "markSize", "markSpacing", "tipThreshold", "markRetention"] },
  { label: "Potential lines", controls: ["potential", "potentialLines", "potentialWeight"] },
];

/**
 * The construction the stored values describe: everything that decides the potential, the growth and its history, and nothing about
 * how it is drawn. Values that a selection hides are replaced by fixed constants so that changing them reuses the cached run (and
 * cannot change the drawing).
 */
export function growthSpecOf(q: Values): GrowthSpec {
  const num = (key: string): number => q[key] as number;
  const shape = q.seedShape as GrowthSpec["seedShape"], source = q.source as GrowthSpec["source"];
  const has = (condition: Condition): boolean => Object.entries(condition).every(([key, allowed]) => allowed.includes(q[key]));
  const keep = (condition: Condition, key: string, fallback: number): number => has(condition) ? num(key) : fallback;
  return {
    grid: num("grid"),
    seedShape: shape, seedX: num("seedX"), seedY: num("seedY"), seedRadius: num("seedRadius"),
    seedLobes: keep(lobed, "seedLobes", 1), seedDepth: keep(lobed, "seedDepth", 0), seedCount: keep(counted, "seedCount", 1),
    seedSpread: keep(spread, "seedSpread", 0), seedAngle: keep(turned, "seedAngle", 0),
    source, sourceRadius: keep(radial, "sourceRadius", 0), sourceSize: keep(banded, "sourceSize", 0), sourceCount: keep(pointed, "sourceCount", 1),
    sourceSide: has(sided) ? q.sourceSide as GrowthSpec["sourceSide"] : "top", sourceAngle: keep(pointed, "sourceAngle", 0),
    sinks: q.sinks as GrowthSpec["sinks"], sinkCount: keep(sunk, "sinkCount", 1), sinkSize: keep(sunk, "sinkSize", 0), sinkRing: keep(sunk, "sinkRing", 0), sinkAngle: keep(sunk, "sinkAngle", 0),
    barrier: q.barrier as GrowthSpec["barrier"], barrierAngle: keep(walled, "barrierAngle", 0), barrierOffset: keep(walled, "barrierOffset", 0),
    barrierWidth: keep(walled, "barrierWidth", 0), barrierGaps: keep(walled, "barrierGaps", 1), barrierGapWidth: keep(walled, "barrierGapWidth", 0),
    pillarCount: keep(pillared, "pillarCount", 1), pillarSize: keep(pillared, "pillarSize", 0),
    noise: num("noise"), eta: num("eta"), tension: num("tension"), stepScale: num("stepScale"),
    tolerance: 10 ** -num("precision"), maxIterations: num("maxIterations"),
  };
}

/** True when the seed can change the construction: seeded discs, pillars, wall gaps or noise. */
export function laplacianFrontsUsesSeed(q: Values): boolean {
  return Number(q.noise) > 0 || q.seedShape === "cluster" || q.barrier !== "none";
}

/** Work and bounds that follow from the stored values alone; every message names the control to change. */
export function validateLaplacianFronts(q: Values): void {
  checkGrowthSpec(growthSpecOf(q), q.steps as number);
  if (q.frontFrom as number > (q.frontTo as number)) throw new Error("First front must not come after Last front");
}

export const laplacianFrontsDefinitions: InstrumentDefinition[] = [{
  id: "laplacian-fronts", title: "Laplacian Fronts",
  description: "A region grows where the flux of a potential is strongest: the potential between the growing region and a source is solved on a grid, the boundary advances at a speed that follows the potential gradient (raised to a growth bias, softened by a surface tension), and every front is kept. Lobes swell into tips that run ahead, fingers branch and merge, pockets close; the history is drawn as age-colored fronts, bands of fill, marks at the tips or by age, and the equipotential lines the growth followed.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    seedShape: "lobed", seedLobes: 5, seedDepth: 0.1, seedCount: 6,
    seedX: 320, seedY: 320, seedRadius: 46, seedSpread: 110, seedAngle: 0,
    source: "ring", sourceRadius: 300, sourceSize: 12, sourceCount: 5, sourceSide: "top", sourceAngle: -90,
    sinks: "none", sinkCount: 3, sinkSize: 26, sinkRing: 190, sinkAngle: 30,
    barrier: "none", barrierAngle: 0, barrierOffset: 0, barrierWidth: 12, barrierGaps: 2, barrierGapWidth: 70, pillarCount: 6, pillarSize: 22,
    steps: 80, eta: 1.3, tension: 3, stepScale: 0.5, noise: 0.3,
    grid: 96, precision: 7, maxIterations: 1000,
    frontMaterial: "ink", frontEvery: 4, frontFrom: 0, frontTo: 1, frontWeight: 1, finalWeight: 2, frontSpacing: 6, frontBeadSize: 3, frontSmooth: 1,
    fill: "bands", fillOpacity: 0.16, fillBands: 6,
    marks: "none", markKind: "dot", markSize: 8, markSpacing: 22, tipThreshold: 0.35, markRetention: 1,
    barrierOutline: true, barrierLineWeight: 1.6, sinkOutline: true, sinkLineWeight: 1.6,
    potential: "none", potentialLines: 6, potentialWeight: 0.7,
  },
  validate: validateLaplacianFronts,
}];
