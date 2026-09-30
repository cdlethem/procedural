import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { barrierKinds, containerShapes } from "../composition/collision-containers.js";
import { emitterModes } from "../composition/collision.js";
import { checkFeasible, roomParams } from "../composition/collision-room.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys: Record<string, true> = { count: true, steps: true, window: true, barrierCount: true, emitEvery: true, markPetals: true };
const n = (key: string, label: string, description: string, min: number, max: number, step: number, hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys[key] === true }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, [...options]), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => withCondition(toggle(key, label, description), visibleWhen);

const barred: Condition = { barriers: ["pins", "slats"] };
const slatted: Condition = { barriers: ["slats"] };
const placed: Condition = { emitter: ["line", "ring", "nozzle"] };
const sized: Condition = { emitter: ["line", "ring"] };
const lined: Condition = { emitter: ["line"] };
const nozzled: Condition = { emitter: ["nozzle"] };
const stitched: Condition = { trails: ["stitch", "beads"] };
const beaded: Condition = { trails: ["beads"] };
const brushed: Condition = { trails: ["bristle"] };
const weighted: Condition = { trails: ["ink", "stitch", "bristle"] };
const marked: Condition = { markKind: ["dot", "rings", "rosette", "arrow"] };
const stroked: Condition = { markKind: ["rings", "rosette", "arrow"] };
const rosette: Condition = { markKind: ["rosette"] };
const rayed: Condition = { rays: ["reflected", "both"] };
const networked: Condition = { graph: [true] };
const bodied: Condition = { bodies: ["filled", "outline"] };

const parameters: Parameter[] = [
  select("container", "Container", "The walls the bodies bounce in: a rectangle, an ellipse (a 96-sided polygon, so its walls are its edges), a diamond, an L-shaped room whose inner corner is struck as a point, or a rectangle around a diamond island.", containerShapes),
  select("barriers", "Barriers", "Obstacles inside the container: none, staggered round pins, or tilted slats cut out of it. Pins and slats never block the emitter.", barrierKinds),
  n("barrierCount", "Barrier count", "Pin rows (each row has as many pins) or number of slats. Pins that would not leave room for a body are left out.", 1, 8, 1, 1, 24, barred),
  n("barrierSize", "Barrier size", "Pin radius, or slat length, in canvas units.", 4, 60, 1, 1, 400, barred),
  n("barrierAngle", "Slat tilt", "Tilt of the slats from horizontal, alternating sides, in degrees.", 0, 80, 1, -90, 90, slatted),

  n("centerX", "Center X", "Horizontal canvas position of the container's center.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the container's center.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Container width before rotation, in canvas units.", 120, 640, 1, 20, 4000),
  n("height", "Height", "Container height before rotation, in canvas units.", 120, 640, 1, 20, 4000),
  n("rotation", "Rotation", "Turns the container (and its barriers) about its center, in degrees. The emitter does not turn with it.", -180, 180, 1, -3600, 3600),

  n("count", "Bodies", "Number of discs. Each is born once and keeps its id; a nozzle releases them one by one. Cost grows with the count and the steps.", 1, 48, 1, 1, 96),
  n("radius", "Radius", "Nominal disc radius in canvas units.", 3, 30, 0.5, 1, 60),
  n("radiusSpread", "Radius spread", "Seeded variation of each disc's radius: 0 gives equal discs, 0.5 lets radii range over ±50%.", 0, 0.8, 0.01, 0, 0.9),
  select("massLaw", "Mass", "Equal: every disc has the same mass, so equal discs swap their normal velocities exactly. Area: mass grows with the square of the radius, so big discs barely deflect when small ones hit them.", ["equal", "area"]),

  select("emitter", "Emitter", "How the discs start: scattered at random over the container, evenly along a line, around a ring, or released one by one from a nozzle.", emitterModes),
  n("emitterX", "Emitter X", "Canvas x of the line's or ring's center or of the nozzle.", 0, 640, 1, -4096, 4096, placed),
  n("emitterY", "Emitter Y", "Canvas y of the line's or ring's center or of the nozzle.", 0, 640, 1, -4096, 4096, placed),
  n("emitterSize", "Emitter size", "Length of the line, or diameter of the ring, in canvas units. Discs must fit on it without overlapping.", 0, 500, 1, 0, 4000, sized),
  n("emitterAngle", "Line angle", "Orientation of the emitting line, in degrees.", -180, 180, 1, -3600, 3600, lined),
  n("emitEvery", "Release every", "Steps between two births at the nozzle. A birth waits while the nozzle is occupied.", 1, 30, 1, 1, 600, nozzled),
  n("heading", "Heading", "Launch direction in degrees from the canvas x axis (from the outward direction for a ring).", -180, 180, 1, -3600, 3600),
  n("headingSpread", "Heading spread", "Seeded variation of each launch direction, ± degrees. 180 launches in every direction.", 0, 180, 1, 0, 360),
  n("speed", "Speed", "Launch speed in canvas units per step.", 0, 12, 0.1, 0, 40),
  n("speedSpread", "Speed spread", "Seeded variation of each launch speed as a share of Speed.", 0, 1, 0.01, 0, 1),

  n("restitution", "Disc bounce", "Share of approach speed returned when two discs meet: 1 is perfectly elastic (energy and momentum both conserved), 0 leaves them sliding together.", 0, 1, 0.01, 0, 1),
  n("wallRestitution", "Wall bounce", "Share of approach speed returned by a wall, corner or post: 1 reflects at the incoming angle.", 0, 1, 0.01, 0, 1),
  n("wallFriction", "Wall friction", "Coulomb friction of walls on the sliding component of velocity (discs do not spin): 0 keeps it, larger values turn glancing bounces steeper.", 0, 1, 0.01, 0, 5),
  n("gravity", "Gravity", "Velocity added downward each step, in canvas units per step squared; negative pulls up. Gravity is a kick at the start of each step, so energy is conserved exactly only at 0.", -0.2, 0.2, 0.005, -2, 2),

  n("steps", "Steps", "How long the motion runs, in fixed steps. Later steps only extend earlier ones: scrubbing never changes the past.", 0, 900, 1, 0, 3000),
  n("window", "Recording window", "Draw only the last this-many steps of the recording; 0 draws everything. Dragging Steps with a window fixed slides it along the score.", 0, 900, 1, 0, 3000),

  select("contacts", "Contacts shown", "Which contacts receive marks and rays: disc-disc contacts, wall contacts (walls, corners and posts) or both. The contact graph always joins discs.", ["bodies", "walls", "all"]),
  n("minImpulse", "Weakest contact", "Contacts weaker than this share of the strongest impulse are left out of marks, rays and the graph, which hides the tiny impulses of resting contact.", 0, 1, 0.01, 0, 1),
  n("floor", "Smallest size", "Mark size and ray length of the weakest shown contact as a share of the strongest's; sizes follow the square root of the impulse.", 0, 1, 0.01, 0, 1),
  select("colorBy", "Color by", "Body: each disc its own palette color. Kind: trails, disc contacts and wall contacts in three colors. Time: palette colors in order through the recording window.", ["body", "kind", "time"]),

  flag("outline", "Container outline", "Draw the walls, corners' islands and posts in the first palette color."),
  select("bodies", "Draw discs", "Draw the discs at the end of the recording window at their true radius: filled, or outlined.", ["none", "filled", "outline"]),
  n("bodyWeight", "Body outline", "Stroke width of an outlined disc.", 0.3, 4, 0.1, 0, 30, { bodies: ["outline"] }),

  select("trails", "Trails", "How each disc's path is drawn: continuous ink, stitches, beads, or a dry brush. The path has an exact corner at every bounce.", ["none", "ink", "stitch", "beads", "bristle"]),
  n("trailWeight", "Trail weight", "Stroke width of ink and stitches, and the hair weight of the brush.", 0.3, 4, 0.1, 0, 30, weighted),
  n("trailSpacing", "Station spacing", "Distance between stitches or beads along a trail, in canvas units.", 3, 30, 0.5, 0.5, 1000, stitched),
  n("trailBead", "Bead diameter", "Diameter of each bead.", 1, 12, 0.25, 0.25, 100, beaded),
  n("brushWidth", "Brush width", "Width of the dry brush, in canvas units.", 2, 40, 0.5, 0.5, 400, brushed),

  select("markKind", "Contact mark", "The mark placed at each contact point, sized by the impulse and turned to the contact normal. None leaves contacts unmarked.", ["none", "dot", "rings", "rosette", "arrow"]),
  n("markSize", "Mark size", "Diameter of the mark at the strongest contact, in canvas units.", 4, 60, 0.5, 0.5, 400, marked),
  n("markWeight", "Mark line weight", "Line weight of ring, rosette and arrow marks.", 0.3, 4, 0.1, 0, 50, stroked),
  n("markPetals", "Petals", "Spokes of a rosette mark.", 3, 16, 1, 1, 48, rosette),

  select("rays", "Bounce rays", "Rays from each contact point along the direction each disc leaves in (reflected), or along that and the direction it arrived from (both). Ray length follows the impulse.", ["none", "reflected", "both"]),
  n("rayLength", "Ray length", "Length of the ray at the strongest contact, in canvas units.", 6, 120, 1, 1, 1000, rayed),
  n("rayWeight", "Ray weight", "Stroke width of the rays.", 0.3, 4, 0.1, 0, 30, rayed),

  flag("graph", "Contact graph", "Join every pair of discs that met with a line whose thickness follows their summed impulse."),
  select("graphAnchor", "Graph nodes at", "Where each disc sits in the graph: at its position at the end of the window (the drawn discs), or at the mean of its disc contacts, which pulls a long run toward the middle.", ["final", "contacts"], networked),
  n("graphWeight", "Graph line weight", "Stroke width of the strongest edge; weaker edges are thinner.", 0.5, 8, 0.1, 0, 30, networked),
  n("graphNodeSize", "Graph node size", "Diameter of a node dot at the most connected disc; 0 draws none.", 0, 20, 0.5, 0, 100, networked),
];

const controlGroups: ControlGroup[] = [
  { label: "Container", controls: ["container", "barriers", "barrierCount", "barrierSize", "barrierAngle"] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Bodies", controls: ["count", "radius", "radiusSpread", "massLaw"] },
  { label: "Emitter", controls: ["emitter", "emitterX", "emitterY", "emitterSize", "emitterAngle", "emitEvery", { label: "Launch", controls: ["heading", "headingSpread", "speed", "speedSpread"] }] },
  { label: "Collisions", controls: ["restitution", "wallRestitution", "wallFriction", "gravity"] },
  { label: "Time", controls: ["steps", "window"] },
  { label: "Contacts", controls: ["contacts", "minImpulse", "floor", "colorBy"] },
  { label: "Drawing", controls: ["outline", { label: "Discs", controls: ["bodies", "bodyWeight"] },
    { label: "Trails", controls: ["trails", "trailWeight", "trailSpacing", "trailBead", "brushWidth"] },
    { label: "Marks", controls: ["markKind", { label: "Scale", controls: ["markSize", "markWeight"], proportional: true }, "markPetals"] },
    { label: "Rays", controls: ["rays", "rayLength", "rayWeight"] },
    { label: "Graph", controls: ["graph", "graphAnchor", "graphWeight", "graphNodeSize"] }] },
];

const optionLabels: Record<string, Record<string, string>> = {
  container: { rectangle: "Rectangle", ellipse: "Ellipse", diamond: "Diamond", "l-room": "L-shaped room", island: "Island in a box" },
  barriers: { none: "None", pins: "Pins", slats: "Slats" },
  massLaw: { equal: "Equal masses", area: "Mass by area" },
  emitter: { scatter: "Scattered", line: "Line", ring: "Ring", nozzle: "Nozzle" },
  contacts: { bodies: "Disc contacts", walls: "Wall contacts", all: "All contacts" },
  colorBy: { body: "Body", kind: "Kind of contact", time: "Time" },
  bodies: { none: "None", filled: "Filled", outline: "Outline" },
  trails: { none: "None", ink: "Ink", stitch: "Stitch", beads: "Beads", bristle: "Dry brush" },
  markKind: { none: "None", dot: "Dots", rings: "Rings", rosette: "Rosettes", arrow: "Arrows" },
  rays: { none: "None", reflected: "Reflected", both: "Arrived and reflected" },
  graphAnchor: { final: "Final position", contacts: "Contact centroid" },
};
const labelled = (parameter: Parameter): Parameter => {
  const labels = optionLabels[parameter.key];
  return labels ? { ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) } : parameter;
};

export const collisionScoresDefinition: InstrumentDefinition = {
  id: "collision-scores", title: "Collision Scores",
  description: "Discs bounce in a container and the record of every contact becomes the drawing: trails with exact corners at each bounce, marks sized by impulse, rays along the bounce angles and a graph of who met whom, all read from one deterministic log.",
  renderer: "2d",
  parameters: parameters.map(labelled), controlGroups,
  validate: (params) => checkFeasible(roomParams(params)),
  defaults: {
    container: "ellipse", barriers: "none", barrierCount: 3, barrierSize: 14, barrierAngle: 35,
    centerX: 320, centerY: 320, width: 540, height: 460, rotation: 0,
    count: 14, radius: 10, radiusSpread: 0.3, massLaw: "area",
    emitter: "nozzle", emitterX: 150, emitterY: 320, emitterSize: 130, emitterAngle: 90, emitEvery: 4, heading: 0, headingSpread: 42, speed: 5, speedSpread: 0.25,
    restitution: 1, wallRestitution: 1, wallFriction: 0, gravity: 0,
    steps: 200, window: 0,
    contacts: "all", minImpulse: 0.04, floor: 0.2, colorBy: "kind",
    outline: true, bodies: "outline", bodyWeight: 1.3,
    trails: "ink", trailWeight: 0.9, trailSpacing: 8, trailBead: 3.5, brushWidth: 10,
    markKind: "rings", markSize: 24, markWeight: 1.5, markPetals: 6,
    rays: "reflected", rayLength: 28, rayWeight: 0.9,
    graph: true, graphAnchor: "final", graphWeight: 2.4, graphNodeSize: 7,
  },
};
