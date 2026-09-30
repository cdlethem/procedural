import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import { validateColonyControls } from "../composition/aggregation-controls.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["seedCount", "steps", "lifetime", "patience", "bands", "domainVariant"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number, hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly (string | readonly [string, string])[], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map((option) => typeof option === "string" ? option : option[0])),
    options: options.map((option) => typeof option === "string" ? { value: option, label: option } : { value: option[0], label: option[1] }) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => withCondition(toggle(key, label, description), visibleWhen);

const spread: Condition = { seedShape: ["ring", "line", "scatter"] };
const rounded: Condition = { seedShape: ["ring", "scatter"] };
const sourced: Condition = { source: ["ellipse", "rectangle", "line"] };
const boxed: Condition = { source: ["ellipse", "rectangle"] };
const shaped: Condition = { domain: ["rectangle", "ellipse", "ring", "letters", "image"] };
const holed: Condition = { domain: ["ring"] };
const lettered: Condition = { domain: ["letters"] };
const pictured: Condition = { domain: ["image"] };
const colored: Condition = { colorBy: ["age", "limb", "depth"] };
const marked: Condition = { mark: ["dot", "rings", "rosette", "arrow"] };
const tipped: Condition = { tipMark: ["dot", "rings", "rosette", "arrow"] };
const haloed: Condition = { halo: [true] };
const inked: Condition = { ink: ["line", "stitch", "beads"] };
const spaced: Condition = { ink: ["stitch", "beads"] };
const beaded: Condition = { ink: ["beads"] };
const outlined: Condition = { outline: [true] };

const markKinds: readonly (readonly [string, string])[] = [["none", "None"], ["dot", "Dot"], ["rings", "Ring"], ["rosette", "Rosette"], ["arrow", "Arrow"]];

/** The bundled words a letters domain can be. Unshaped Latin only; each is fitted into the domain's box. */
const words: readonly (readonly [string, string])[] = [["S", "S"], ["R", "R"], ["8", "8"], ["OK", "OK"], ["GROW", "GROW"]];

const parameters: Parameter[] = [
  select("seedShape", "Seed shape", "What the colony grows from. A point gives one tree; a ring, a line or a scatter gives several that compete and merge. Seeds that fall outside the domain or overlap another seed are dropped.", [["point", "Single point"], ["ring", "Ring of seeds"], ["line", "Line of seeds"], ["scatter", "Scatter of seeds"]]),
  n("seedCount", "Seed grains", "How many seed grains a ring, line or scatter is made of. Each is the root of its own tree.", 2, 60, 1, 1, 400, spread),

  n("seedX", "Seed X", "Horizontal canvas position of the seeds. Walkers with Pull to seed also drift toward this point.", 0, 640, 1, -5000, 5000),
  n("seedY", "Seed Y", "Vertical canvas position of the seeds.", 0, 640, 1, -5000, 5000),
  n("seedWidth", "Seed width", "Width of the seed ring or scatter, or the length of the seed line, in canvas units.", 0, 500, 1, 0, 4000, spread),
  n("seedHeight", "Seed height", "Height of the seed ring or scatter, in canvas units. Equal to the width it is a circle.", 0, 500, 1, 0, 4000, rounded),
  n("seedAngle", "Seed angle", "Turns the seed shape about its centre, in degrees.", -180, 180, 1, -3600, 3600, spread),

  select("source", "Source", "Where walkers are released: along an ellipse or rectangle outline, along a line, or anywhere inside the domain (the whole canvas without one). Growth reaches the source from inside and stops there.", [["ellipse", "Ellipse outline"], ["rectangle", "Rectangle outline"], ["line", "Line"], ["inside", "Inside the domain"]]),
  n("sourceX", "Source X", "Horizontal canvas position of the source's centre.", 0, 640, 1, -5000, 5000, sourced),
  n("sourceY", "Source Y", "Vertical canvas position of the source's centre.", 0, 640, 1, -5000, 5000, sourced),
  n("sourceWidth", "Source width", "Width of the source ellipse or rectangle, or the length of the source line, in canvas units.", 20, 900, 1, 0, 8000, sourced),
  n("sourceHeight", "Source height", "Height of the source ellipse or rectangle, in canvas units. Equal to the width an ellipse is a circle.", 20, 900, 1, 0, 8000, boxed),
  n("sourceAngle", "Source angle", "Turns the source shape about its centre, in degrees. A line at 0 runs left to right; at 90 top to bottom.", -180, 180, 1, -3600, 3600, sourced),

  select("domain", "Domain", "The region growth is confined to. Its boundary, and the boundary of any hole, is a wall: walkers bounce off it and grains stay a radius clear of it. None leaves the whole canvas open.", [["none", "None"], ["rectangle", "Rectangle"], ["ellipse", "Ellipse"], ["ring", "Ellipse with a hole"], ["letters", "Letters"], ["image", "Image silhouette"]]),
  select("domainWord", "Letters", "The bundled characters whose outline confines growth. Their counters (the holes in R or 8) are walls too. Your own type arrives as a typed region through the library; binding it in Studio is future host work.", words, lettered),
  select("domainImage", "Silhouette image", "The bundled deterministic picture whose bright pixels form the domain. Your own mask arrives as a typed region through the library; binding it in Studio is future host work.", bundledRasterIds.filter((id) => id !== "noise").map((id): [string, string] => [id, bundledRasterInfo[id].title]), pictured),
  n("domainVariant", "Image variant", "The picture's own seed: it moves and re-tints the picture's parts, so the silhouette changes.", 0, 24, 1, 0, 4294967295, pictured),
  n("domainThreshold", "Brightness cut", "Luminance at or above which a pixel belongs to the domain. Low values give large regions, high values small bright islands.", 0.1, 0.8, 0.01, 0, 1, pictured),
  n("domainX", "Domain X", "Horizontal canvas position of the domain's centre.", 0, 640, 1, -5000, 5000, shaped),
  n("domainY", "Domain Y", "Vertical canvas position of the domain's centre.", 0, 640, 1, -5000, 5000, shaped),
  n("domainWidth", "Domain width", "Width of the domain in canvas units. Letters and images are fitted inside the box without stretching.", 60, 640, 1, 1, 4000, shaped),
  n("domainHeight", "Domain height", "Height of the domain in canvas units.", 60, 640, 1, 1, 4000, shaped),
  n("domainHole", "Hole size", "Width of the hole as a fraction of the ellipse. The hole is an obstacle walkers cannot enter.", 0.1, 0.9, 0.01, 0.02, 0.95, holed),

  n("radius", "Particle radius", "Radius of every grain. A grain touches its parent at twice this distance, so it sets both the scale of the detail and how many grains fill a given area.", 1.5, 8, 0.1, 0.75, 40),
  n("stick", "Sticking probability", "Chance that a walker touching the colony sticks. Low values let walkers slide deeper before they attach, filling channels and thickening branches; 1 gives the classic sparse, tip-dominated tree.", 0.02, 1, 0.01, 0.005, 1),
  n("bias", "Wind", "Drift of the walkers as a fraction of each random step. 0 is pure diffusion; larger values push walkers along the wind direction, so growth piles up on the side facing the wind.", 0, 0.9, 0.01, 0, 0.9),
  n("biasAngle", "Wind direction", "Direction of the wind in degrees. 0 blows toward the right and 90 toward the bottom of the canvas.", -180, 180, 1, -3600, 3600),
  n("pull", "Pull to seed", "Drift of the walkers toward the seed point as a fraction of each random step. It fills the colony's interior and shortens the branches; 0 leaves them free.", 0, 0.9, 0.01, 0, 0.9),
  n("turn", "Path turning", "Largest heading change per step, in degrees. 180 is a free random walk; small values run in long straight stretches, so walkers arrive as ballistic streaks.", 20, 180, 1, 5, 180),

  n("steps", "Walkers", "Released walkers: each one is a growth step. Growth only ever appends, so a larger number keeps every grain already there. Walkers that escape or time out add nothing, so the grain count is smaller (see the guide for the usual share).", 0, 4000, 10, 0, 12000),
  n("reach", "Step reach", "Longest step a walker makes in empty space, in canvas units. It is a speed, not a shape: steps shrink automatically near grains and walls, so no contact is ever skipped.", 10, 120, 1, 1, 400),
  n("lifetime", "Walker lifetime", "Most steps a walker takes before it is abandoned. Together with Walkers it bounds the run's work.", 200, 6000, 50, 10, 20000),
  n("patience", "Give up after", "The colony stalls, and stays as it is, once this many walkers in a row fail to attach (escape, time out or find no room to start). Every later step then costs nothing.", 5, 500, 5, 1, 5000,
    { seedShape: ["ring", "scatter"], domain: ["none", "image"] }),
  n("escape", "Escape margin", "How far past the canvas edge a walker may wander before it is lost. Small margins lose more walkers; large ones waste steps on walkers that will not return.", 0, 300, 5, 0, 400, { domain: ["none"] }),

  n("reveal", "Reveal", "Draws only the grains attached by this fraction of the walkers, like a time scrub of the finished colony. Nothing is recomputed and colours keep their full-run meaning.", 0, 1, 0.01, 0, 1),
  select("colorBy", "Colour by", "What the palette means: attachment age (early to late), limb (each seed and its direct children start a colour), depth in the tree, or one flat colour. Every treatment uses the same colour for the same grain.", [["age", "Attachment age"], ["limb", "Limb"], ["depth", "Depth in tree"], ["flat", "Flat"]]),
  n("bands", "Colour bands", "How many palette colours the colouring spreads over. Short palettes wrap.", 1, 8, 1, 1, 16, colored),
  n("taper", "Branch taper", "Thins the marks and links toward the tips: 0 keeps every grain full size; 1 shrinks the thinnest branches to a sixth. Thickness follows how much of the colony hangs from a grain.", 0, 1, 0.01, 0, 1),

  select("mark", "Grain mark", "The mark drawn at every grain. Size is measured in grain diameters, so the marks touch their neighbours at 1.", markKinds),
  n("markSize", "Mark size", "Diameter of the grain mark in grain diameters (twice the particle radius).", 0.3, 2.5, 0.05, 0.05, 20, marked),
  select("tipMark", "Tip mark", "A second mark drawn only at the active tips, the grains with no children. Rings or rosettes at the tips show where growth is still happening.", markKinds),
  n("tipSize", "Tip size", "Diameter of the tip mark in grain diameters.", 0.5, 5, 0.05, 0.05, 20, tipped),
  flag("halo", "Halo", "Draws a large translucent dot at every grain; where they overlap they add up to a soft density field around the colony."),
  n("haloSize", "Halo size", "Diameter of each halo dot in grain diameters.", 2, 12, 0.1, 0.5, 60, haloed),
  n("haloStrength", "Halo strength", "Opacity of each halo dot. Many overlap, so small values are enough.", 0.01, 0.3, 0.005, 0.005, 1, haloed),

  select("ink", "Parent links", "Draws the parent graph: each grain connected to the grain it stuck to, as one continuous stroke per limb, stitches, or beads.", [["none", "None"], ["line", "Ink"], ["stitch", "Stitch"], ["beads", "Beads"]]),
  n("inkWeight", "Link weight", "Stroke width of the heaviest links, in canvas units; the taper thins the others.", 0.4, 8, 0.1, 0, 50, inked),
  n("inkSpacing", "Link spacing", "Distance between stitches or beads along a link, in canvas units.", 2, 20, 0.5, 0.5, 1000, spaced),
  n("beadSize", "Bead size", "Diameter of a bead on the heaviest links, in canvas units.", 1, 12, 0.1, 0, 200, beaded),
  flag("outline", "Domain outline", "Draws the domain's walls and holes as a line in the second palette colour.", shaped),
  n("outlineWeight", "Outline weight", "Stroke width of the outline.", 0.4, 4, 0.1, 0, 50, outlined),
];

const controlGroups: ControlGroup[] = [
  { label: "Seeds", stage: "form", controls: ["seedShape", "seedCount"] },
  { label: "Placement", stage: "frame", controls: ["seedX", "seedY", { label: "Size", controls: ["seedWidth", "seedHeight"], proportional: true }, "seedAngle"] },
  { label: "Source", stage: "form", controls: ["source", "sourceX", "sourceY", { label: "Size", controls: ["sourceWidth", "sourceHeight"], proportional: true }, "sourceAngle"] },
  { label: "Domain", stage: "process", controls: ["domain", "domainWord", "domainImage", "domainVariant", "domainThreshold", "domainX", "domainY",
    { label: "Size", controls: ["domainWidth", "domainHeight"], proportional: true }, "domainHole"] },
  { label: "Walkers", stage: "process", controls: ["radius", "stick", { label: "Wind", controls: ["bias", "biasAngle"] }, "pull", "turn"] },
  { label: "Growth", stage: "process", controls: ["steps", "reach", "lifetime", "patience", "escape"] },
  { label: "Color", stage: "color", controls: ["colorBy", "bands", "taper", "reveal"] },
  { label: "Marks", stage: "material", controls: ["mark", "markSize", "tipMark", "tipSize", { label: "Halo", controls: ["halo", "haloSize", "haloStrength"] }] },
  { label: "Links", stage: "material", controls: ["ink", "inkWeight", "inkSpacing", "beadSize", { label: "Outline", controls: ["outline", "outlineWeight"] }] },
];

export const aggregationColoniesDefinition: InstrumentDefinition = {
  id: "aggregation-colonies", title: "Aggregation Colonies",
  description: "Branching accretions grown by random walkers that stick where they touch: seeded particles are released from a source, wander with a wind and a sticking chance, and attach to a growing cluster, leaving empty channels and active tips. The same colony is drawn as marks at its grains, as ink or beads along its parent links, as a halo and as tip marks, coloured by age or limb, and can be confined inside letters or an image silhouette.",
  renderer: "2d",
  parameters, controlGroups,
  procedure: "Particles are released one by one and wander at random until they touch a growing cluster and stick. The branches shield the space behind them, so growth races ahead at the tips, like frost spreading across a window.",
  featured: ["steps", "bias", "turn"],
  defaults: {
    seedShape: "point", seedCount: 12, seedX: 320, seedY: 320, seedWidth: 120, seedHeight: 120, seedAngle: 0,
    source: "ellipse", sourceX: 320, sourceY: 320, sourceWidth: 620, sourceHeight: 620, sourceAngle: 0,
    domain: "none", domainWord: "S", domainImage: "portrait", domainVariant: 0, domainThreshold: 0.3, domainX: 320, domainY: 320, domainWidth: 460, domainHeight: 460, domainHole: 0.4,
    radius: 3, stick: 1, bias: 0, biasAngle: 90, pull: 0, turn: 180,
    steps: 2800, reach: 40, lifetime: 2500, patience: 80, escape: 60,
    reveal: 1, colorBy: "age", bands: 4, taper: 0.6,
    mark: "dot", markSize: 1, tipMark: "none", tipSize: 1.8, halo: false, haloSize: 5, haloStrength: 0.05,
    ink: "line", inkWeight: 2, inkSpacing: 6, beadSize: 4, outline: true, outlineWeight: 1,
  },
  validate: validateColonyControls,
};
