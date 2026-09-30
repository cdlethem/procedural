import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { barrierKinds, colonyGeometry, emitterLayouts, type ColonyControls } from "../composition/chemotaxis-layouts.js";
import { CHEMOTAXIS_LIMITS, checkChemotaxisBudget } from "../composition/chemotaxis.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["emitters", "agents", "release", "lifespan", "grid", "steps", "contours", "trailMemory", "hairs", "pillars"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number, hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, [...options]), visibleWhen);

const oriented: Condition = { layout: ["ring", "line"] };
const barred: Condition = { barrier: ["wall", "enclosure", "island", "pillars"] };
const sized: Condition = { barrier: ["wall", "enclosure", "island"] };
const opening: Condition = { barrier: ["wall", "enclosure"] };
const pillared: Condition = { barrier: ["pillars"] };
const fielded: Condition = { fieldMode: ["contours", "wash", "both"] };
const lined: Condition = { fieldMode: ["contours", "both"] };
const washed: Condition = { fieldMode: ["wash", "both"] };
const trailed: Condition = { trailLine: ["ink", "stitch", "bristles"] };
const thin: Condition = { trailLine: ["ink", "stitch"] };
const brushed: Condition = { trailLine: ["bristles"] };
const marked: Condition = { mark: ["dot", "rings", "rosette", "arrow"] };

const parameters: Parameter[] = [
  select("layout", "Emitter layout", "How the emitters are arranged around the center: evenly on a ring, evenly along a line, or scattered in a disc (the seed scatters them; adding one keeps the others).", emitterLayouts),
  n("emitters", "Emitters", "Sources where agents are born. A single emitter sits exactly at the center. More emitters make more colonies that meet and compete for the same chemical.", 1, 8, 1, 1, CHEMOTAXIS_LIMITS.maxEmitters),
  n("agents", "Agents per emitter", "Agents born at each emitter. Emitters × agents may not exceed 2,400; the trajectory history keeps four values per agent per step, so the slider stops where every slider at its maximum still fits (typing a larger number is allowed within the limits).", 10, 150, 1, 1, 1000),
  n("strengthTaper", "Strength taper", "How much weaker the last emitter is than the first: 0 gives every emitter the same strength; 1 makes the last one lay no chemical at all. Strength scales the deposit of an emitter's agents and its beacon.", 0, 1, 0.01, 0, 1),
  n("release", "Release", "Steps over which the agents are born, one emitter after another in turn. 0 starts the whole population at once; a longer release streams agents out.", 0, 200, 1, 0, CHEMOTAXIS_LIMITS.maxSteps),
  n("lifespan", "Lifespan", "Steps an agent acts before it dies. 0 lives for ever. When every agent has died and no emitter leaks, the chemical decays away and the drawing ends.", 0, 400, 1, 0, CHEMOTAXIS_LIMITS.maxSteps),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the emitters (and of the barrier).", 0, 640, 1, 0, 640),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the emitters (and of the barrier).", 0, 640, 1, 0, 640),
  n("layoutRadius", "Layout radius", "Ring radius, line half length or scatter radius of the emitters, in canvas units.", 0, 300, 1, 0, 640),
  n("spawnRadius", "Spawn radius", "Agents appear at random inside a disc of this radius around their emitter, in canvas units. 0 starts them all on the emitter.", 0, 80, 1, 0, 640),
  n("layoutAngle", "Layout angle", "Turns the ring or line of emitters about the center, in degrees.", -180, 180, 1, -3600, 3600, oriented),

  n("deposit", "Deposit", "Chemical each agent lays per step. Everything else is measured against this: an agent's chemical reads clearly above 0.02.", 0, 4, 0.05, 0, 1000),
  n("beacon", "Beacon", "Chemical each emitter leaks per step whether or not agents are near, like a fixed source. It draws agents out and keeps a colony's nest marked; 0 leaves the field to the agents.", 0, 10, 0.1, 0, 1e5),
  n("diffusion", "Diffusion", "Share of the difference to its four neighbours that each cell exchanges per step. It smooths trails into halos that agents can sense from farther away.", 0, 0.5, 0.01, 0, 1),
  n("decay", "Decay", "Share of the chemical lost per step. Fast decay makes trails forget quickly and agents follow only fresh ones; slow decay lets old trails keep pulling.", 0, 0.3, 0.005, 0, 1),

  n("reach", "Probe reach", "How far ahead the two probes read the chemical, in canvas units.", 4, 60, 1, 0, 640),
  n("sensorAngle", "Probe angle", "Angle of each probe from the heading, in degrees. Wide probes compare distant sides; narrow ones follow ridges.", 5, 90, 1, 0, 180),
  n("turnRate", "Turn rate", "The turn per step, in degrees, of an agent whose two probes read very different amounts.", 0, 90, 1, 0, 360),
  n("attraction", "Attraction", "Positive follows the chemical, so trails reinforce into veins; negative flees it, so agents avoid each other's trails and spread out; 0 ignores it (a plain random walker).", -1, 1, 0.01, -1, 1),
  n("wander", "Wander", "Half range of a random turn each step, in degrees, drawn from each agent's own stream. It lets agents leave a trail and find new ground.", 0, 45, 0.5, 0, 360),
  n("speed", "Speed", "Distance an agent moves per step, in canvas units.", 0.5, 5, 0.1, 0, CHEMOTAXIS_LIMITS.maxSpeed),

  select("edge", "Edge", "Wall bounces agents off the canvas edge and keeps the chemical inside. Wrap joins opposite edges into a torus; trails and contours then continue on the other side.", ["wall", "wrap"]),
  n("grid", "Field resolution", "Cells per side of the chemical grid. Finer grids follow thin trails and cost more per step; diffusion and decay are per cell per step, so a finer grid diffuses over shorter distances.", 48, 160, 1, CHEMOTAXIS_LIMITS.minGrid, CHEMOTAXIS_LIMITS.maxGrid),
  select("barrier", "Barrier", "A solid obstacle centered on the middle: a wall with a door, an enclosure with a mouth, an island, or scattered pillars. Agents bounce off it and no chemical crosses it. An emitter inside the barrier is an error.", barrierKinds),
  n("barrierSize", "Barrier size", "Wall half length, or enclosure or island radius, in canvas units.", 20, 300, 1, 1, 1000, sized),
  n("barrierGap", "Barrier opening", "Width of the door in the wall or the mouth of the enclosure, in canvas units.", 0, 200, 1, 0, 2000, opening),
  n("pillarRadius", "Pillar radius", "Radius of each pillar, in canvas units.", 6, 40, 1, 1, 300, pillared),
  n("pillars", "Pillars", "How many pillars are scattered clear of the emitters; a count that cannot fit is an error.", 1, 24, 1, 0, 60, pillared),

  n("steps", "Steps", "How many synchronous updates have run. Scrub it to watch the colony organize: earlier steps are the same colony, only younger.", 0, 600, 1, 0, CHEMOTAXIS_LIMITS.maxSteps),

  select("fieldMode", "Field", "How the chemical is drawn: contour lines at levels of its peak, filled tonal bands, both, or not at all.", ["none", "contours", "wash", "both"]),
  n("contours", "Levels", "Number of levels drawn, spaced geometrically from the lowest to 0.85 of the field's peak, so faint halos and dense cores both show.", 1, 10, 1, 1, 24, fielded),
  n("lowestContour", "Lowest level", "The faintest level drawn, as a fraction of the field's peak.", 0.01, 0.5, 0.01, 0.0001, 0.85, fielded),
  select("contourLine", "Contour line", "Ink draws each contour as a line; stitch cuts it into dashes; beads sets a dot at regular distances.", ["ink", "stitch", "beads"], lined),
  n("contourWeight", "Contour weight", "Stroke width of the contour lines.", 0.3, 4, 0.1, 0, 50, lined),
  n("washOpacity", "Band opacity", "Opacity of each filled band; bands lie on top of each other, so the densest field is darkest.", 0.02, 0.5, 0.01, 0, 1, washed),

  select("trailLine", "Trails", "Each agent's recorded trajectory: ink, stitches, a dry brush of separate hairs, or none. The trajectories are the same whichever material draws them.", ["none", "ink", "stitch", "bristles"]),
  n("trailShare", "Trail share", "Share of the trails drawn, by a stable draw per agent. Raising it only adds trails.", 0, 1, 0.01, 0, 1, trailed),
  n("trailMemory", "Trail memory", "Steps of history drawn behind each agent. 0 draws the whole history from birth. Only the drawing changes; the trajectories do not.", 0, 300, 1, 0, CHEMOTAXIS_LIMITS.maxSteps, trailed),
  n("trailMinLength", "Shortest trail", "Trails shorter than this, in canvas units, are left out.", 0, 300, 1, 0, 100000, trailed),
  n("trailWeight", "Trail weight", "Stroke width of trail ink or stitches.", 0.3, 4, 0.1, 0, 50, thin),
  select("trailColor", "Trail color", "One color, or each emitter's colony in its own palette color. The colors label where an agent came from; all agents share one chemical.", ["single", "origin"], trailed),
  n("brushWidth", "Brush width", "Width of the brush laid along each trail, in canvas units.", 3, 30, 1, 1, 200, brushed),
  n("hairs", "Hairs", "Hairs across the brush. Every trail costs hairs × its length; the total is bounded.", 3, 20, 1, 1, 60, brushed),

  select("mark", "Agent mark", "A small mark at each living agent, turned to its heading: dot, rings, rosette or arrow.", ["none", "dot", "rings", "rosette", "arrow"]),
  n("markShare", "Mark share", "Share of the living agents that carry a mark, by a stable draw per agent. Raising it only adds marks.", 0, 1, 0.01, 0, 1, marked),
  n("markSize", "Mark size", "Diameter of the mark, in canvas units.", 2, 40, 0.5, 0, 500, marked),
  select("markColor", "Mark color", "One color, or the palette color of the agent's emitter.", ["single", "origin"], marked),

  n("barrierOpacity", "Barrier opacity", "Opacity of the solid drawn where the barrier stands. 0 leaves it invisible; agents and chemical still respect it.", 0, 1, 0.01, 0, 1, barred),
];

const controlGroups: ControlGroup[] = [
  { label: "Colony", stage: "form", controls: ["layout", "emitters", "agents", "strengthTaper", "release", "lifespan"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["layoutRadius", "spawnRadius"], proportional: true }, "layoutAngle"] },
  { label: "Chemistry", stage: "process", controls: ["deposit", "beacon", "diffusion", "decay"] },
  { label: "Sensing", stage: "process", controls: [{ label: "Probes", controls: ["reach", "sensorAngle"] }, { label: "Steering", controls: ["turnRate", "attraction", "wander"] }, "speed"] },
  { label: "Arena", stage: "form", controls: ["edge", "grid", "barrier", "barrierSize", "barrierGap", "pillarRadius", "pillars"] },
  { label: "Time", stage: "process", controls: ["steps"] },
  { label: "Field", stage: "form", controls: ["fieldMode", "contours", "lowestContour", "contourLine", "contourWeight", "washOpacity"] },
  { label: "Trails", stage: "material", controls: ["trailLine", "trailShare", "trailMemory", "trailMinLength", "trailWeight", "trailColor", { label: "Brush", controls: ["brushWidth", "hairs"] }] },
  { label: "Agent marks", stage: "material", controls: ["mark", "markShare", "markSize", "markColor"] },
  { label: "Barrier fill", stage: "material", controls: ["barrierOpacity"] },
];

const optionLabels: Record<string, Record<string, string>> = {
  layout: { ring: "Ring", line: "Line", scatter: "Scatter" },
  edge: { wall: "Walls", wrap: "Wrap around" },
  barrier: { none: "None", wall: "Wall with a door", enclosure: "Enclosure with a mouth", island: "Island", pillars: "Pillars" },
  fieldMode: { none: "None", contours: "Contours", wash: "Bands", both: "Contours and bands" },
  contourLine: { ink: "Ink", stitch: "Stitch", beads: "Beads" },
  trailLine: { none: "None", ink: "Ink", stitch: "Stitch", bristles: "Bristles" },
  trailColor: { single: "One color", origin: "By emitter" },
  mark: { none: "None", dot: "Dot", rings: "Rings", rosette: "Rosette", arrow: "Arrow" },
  markColor: { single: "One color", origin: "By emitter" },
};
const labelled = (parameter: Parameter): Parameter => {
  const labels = optionLabels[parameter.key];
  return labels ? { ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) } : parameter;
};

export const chemotacticTrailsDefinition: InstrumentDefinition = {
  id: "chemotactic-trails", title: "Chemotactic Trails",
  description: "Agents that both follow and lay a chemical: each senses the field with two probes, steers toward (or away from) it, and deposits more, while the field diffuses and decays. Trails reinforce into veins, colonies from separate emitters meet and compete, and barriers redirect them. The chemical is drawn as contours or bands, trajectories as ink, stitches or brush hairs, and agents as small marks.",
  procedure: "Start walker colonies at a few emitters on a grid where walkers deposit chemical that diffuses and decays. Each step, every walker senses the old chemical at two probes ahead, turns toward the stronger, moves and deposits. Draw the resulting trajectories as veins with contour halos around the busiest stretches.",
  renderer: "2d",
  parameters: parameters.map(labelled), controlGroups,
  validate: (q) => {
    checkChemotaxisBudget(Number(q.emitters) * Number(q.agents), Number(q.grid), Number(q.steps));
    colonyGeometry(q as unknown as ColonyControls, 0, false);
  },
  defaults: {
    layout: "ring", emitters: 4, agents: 150, strengthTaper: 0, release: 0, lifespan: 0,
    centerX: 320, centerY: 320, layoutRadius: 150, spawnRadius: 30, layoutAngle: 20,
    deposit: 1, beacon: 0.6, diffusion: 0.3, decay: 0.05,
    reach: 24, sensorAngle: 35, turnRate: 45, attraction: 0.5, wander: 14, speed: 2,
    edge: "wall", grid: 96, barrier: "none", barrierSize: 90, barrierGap: 70, pillarRadius: 16, pillars: 8,
    steps: 140,
    fieldMode: "contours", contours: 5, lowestContour: 0.08, contourLine: "ink", contourWeight: 1, washOpacity: 0.06,
    trailLine: "ink", trailShare: 1, trailMemory: 70, trailMinLength: 10, trailWeight: 1.1, trailColor: "origin", brushWidth: 10, hairs: 8,
    mark: "arrow", markShare: 0.2, markSize: 11, markColor: "single",
    barrierOpacity: 0.5,
  },
};
