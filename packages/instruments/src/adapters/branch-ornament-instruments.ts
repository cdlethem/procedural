import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { attractorGrowthDefinitions, validateAttractorGrowth } from "./attractor-growth.js";
import { fitRoots, growthParams } from "../composition/branch-tree.js";
import type { GrowthConstruction } from "../composition/branch-tree.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["sourceCount", "rootCount", "ticks", "branches", "edgeMinDepth", "edgeMaxDepth",
  "terminalMinDepth", "terminalMaxDepth", "forkMinDepth", "forkMaxDepth", "flankMinDepth", "flankMaxDepth",
  "terminalPetals", "forkPetals", "trunkPetals", "flankPetals"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);

/**
 * The growth controls are the Attractor Growth study's own (same keys, labels, domains and
 * validation), so this study cannot drift from the computation it reads. Only the conditions
 * (the same ones measured for that study) and explicit integrality are added.
 */
const growthConditions: Record<string, Condition> = {
  band: { sourceMode: ["ring"] }, exclusion: { sourceMode: ["area", "two-lobe"] },
  lobeBias: { sourceMode: ["two-lobe"] }, lobeGap: { sourceMode: ["two-lobe"] },
  rootCount: { rootPlacement: ["manual"] }, rootX: { rootPlacement: ["manual"] }, rootY: { rootPlacement: ["manual"] },
  rootHeading: { rootPlacement: ["manual"] }, rootSpread: { rootPlacement: ["manual"] }, rootJitter: { rootPlacement: ["manual"] },
};
function growth(key: keyof GrowthConstruction): Parameter {
  const found = attractorGrowthDefinitions[0].parameters.find((parameter) => parameter.key === key);
  if (!found) throw new Error(`Attractor growth has no control ${key}`);
  return withCondition({ ...found, integer: integerKeys.has(key) }, growthConditions[key]);
}

const kinds = ["none", "dot", "rings", "rosette", "arrow"];
const shown = ["dot", "rings", "rosette", "arrow"];
/**
 * One attachment role's mark: kind, optional eligible depth window, offset, size, line weight and
 * shape. Every control but the kind is hidden while the role has no mark.
 */
function roleControls(role: string, noun: string, depth: boolean): Parameter[] {
  const on = { [`${role}Mark`]: shown };
  return [
    select(`${role}Mark`, `${noun} mark`, `Mark attached at each ${noun.toLowerCase()}; none leaves them bare.`, kinds),
    ...(depth ? [
      n(`${role}MinDepth`, `${noun} first depth`, "Shallowest fork depth that receives this mark, counting forks from the trunk.", 0, 48, 1, 0, 450, on),
      n(`${role}MaxDepth`, `${noun} last depth`, "Deepest fork depth that receives this mark.", 0, 48, 1, 0, 450, on),
    ] : []),
    n(`${role}Offset`, `${noun} offset`, "Moves each mark along its attachment axis; negative pulls it back along the branch.", -30, 30, .5, -500, 500, on),
    n(`${role}Size`, `${noun} size`, "Nominal diameter of the mark before depth falloff and variation.", 2, 50, .5, 0, 500, on),
    n(`${role}Weight`, `${noun} line weight`, "Ring outline, rosette petal and arrow stroke width.", .2, 4, .05, 0, 50, { [`${role}Mark`]: ["rings", "rosette", "arrow"] }),
    n(`${role}Petals`, `${noun} petals`, "Radial strokes in each rosette.", 3, 16, 1, 1, 48, { [`${role}Mark`]: ["rosette"] }),
    n(`${role}Opening`, `${noun} opening`, "Empty center of a rosette or inner ring offset.", 0, .9, .01, 0, 1, { [`${role}Mark`]: ["rings", "rosette"] }),
  ];
}
const scale = (role: string): ControlGroup => ({ label: "Scale", controls: [`${role}Size`, `${role}Weight`], proportional: true });
const shape = (role: string): ControlGroup => ({ label: "Shape", controls: [`${role}Petals`, `${role}Opening`] });
const eligible = (role: string): ControlGroup => ({ label: "Eligible depth", controls: [`${role}MinDepth`, `${role}MaxDepth`] });
const roleGroup = (label: string, role: string, depth: boolean, extra: string[] = []): ControlGroup =>
  ({ label, controls: [`${role}Mark`, ...(depth ? [eligible(role)] : []), ...extra, `${role}Offset`, scale(role), shape(role)] });

const stitched: Condition = { edgeMaterial: ["stitch"] };
const drawn: Condition = { edgeMaterial: ["ink", "stitch"] };
const flanked: Condition = { flankMark: shown };

const parameters: Parameter[] = [
  select("sourceMode", "Attractor footprint", "Area, annulus, or two unequal lobes: the region the branches grow toward.", ["area", "ring", "two-lobe"]),
  ...(["sourceCount", "disorder", "exclusion", "band", "lobeGap", "lobeBias"] as const).map(growth),
  ...(["centerX", "centerY", "extent", "aspect", "direction"] as const).map(growth),
  select("rootPlacement", "Root placement", "Auto puts one root below an area or ring and one under each lobe of a two-lobe footprint, so the growth reaches all of it. Manual exposes every root control.", ["auto", "manual"]),
  ...(["rootCount", "rootX", "rootY", "rootHeading", "rootSpread", "rootJitter"] as const).map(growth),
  ...(["ticks", "step", "reach", "branches", "branchSpread"] as const).map(growth),

  select("routing", "Branch routing", "How each branch runs between its junctions: as grown, softened, straight chords, or circuit-style 45° elbows. The tree itself does not change.", ["grown", "smooth", "straight", "octilinear"]),
  select("edgeMaterial", "Branch material", "Continuous ink, tangent stitches, or none (leave only the outline and marks).", ["ink", "stitch", "none"]),
  n("edgeWeight", "Branch weight", "Stroke width of the trunk; thinner with depth.", .3, 8, .1, 0, 50, drawn),
  n("edgeFalloff", "Weight falloff", "Multiplier on stroke weight per fork depth; 1 keeps every branch as thick as the trunk.", .55, 1, .01, 0, 1, drawn),
  n("edgeSpacing", "Stitch spacing", "Distance between stitches along a branch.", 3, 40, .5, .5, 1000, stitched),
  n("edgePhase", "Stitch phase", "Slides stitches along each branch by a fraction of their spacing.", 0, 1, .01, 0, 1, stitched),
  n("edgePhaseSpread", "Cross-branch phase", "Stable spread of the stitch phase between branches.", 0, 1, .01, 0, 1, stitched),
  n("edgeMinDepth", "First visible depth", "Shallowest branch shown, counting forks from the trunk (0 is the trunk itself). Marks are unaffected.", 0, 48, 1, 0, 450),
  n("edgeMaxDepth", "Last visible depth", "Deepest branch shown; lower values leave the twigs off the drawing.", 0, 48, 1, 0, 450),
  n("edgeRetention", "Branch retention", "Stable omission of whole branches; a branch keeps its place as others come and go.", 0, 1, .01, 0, 1),

  n("outlineWidth", "Outline half-width", "Half-width of the ribbon drawn around each visible branch at the trunk; 0 turns the outline off.", 0, 14, .25, 0, 200),
  n("outlineFalloff", "Outline falloff", "Multiplier on the ribbon width per fork depth.", .5, 1, .01, 0, 1),
  n("outlineTaper", "Outline taper", "0 keeps parallel sides; 1 narrows every ribbon to a point at the branch end, like a blade.", 0, 1, .01, 0, 1),
  n("outlineWeight", "Outline weight", "Stroke width of the ribbon; 0 hides it.", .2, 3, .05, 0, 50),

  n("angleInheritance", "Angle inheritance", "0 keeps every mark upright; 1 turns each with its branch direction.", 0, 1, .01, 0, 1),
  n("sizeFalloff", "Size falloff", "Shrinks marks with depth, up to this fraction at the deepest fork.", 0, .95, .01, 0, .95),
  toggle("marksFollowBranches", "Marks follow branches", "On: marks attach only to visible branches, and a pruned twig end counts as a tip. Off: marks stay wherever the full tree puts them, even where the branch is hidden."),
  n("variation", "Size variation", "Stable random size variation per mark.", 0, 1, .01, 0, 1),
  n("ornamentRetention", "Mark retention", "Stable omission of marks without moving the rest.", 0, 1, .01, 0, 1),
  ...roleControls("terminal", "Tip", true),
  ...roleControls("fork", "Junction", true),
  ...roleControls("trunk", "Base", false),
  ...roleControls("flank", "Flank", true),
  n("flankSpacing", "Flank spacing", "Distance along a branch between flank marks.", 8, 80, .5, 1, 1000, flanked),
  select("flankSides", "Flank sides", "Alternate sides, both sides in mirrored pairs, or one side only.", ["alternate", "paired", "single"], flanked),
  n("flankAngle", "Flank angle", "Turn of each flank mark away from the branch direction (degrees); mirrored across the branch on the other side.", 0, 120, 1, -180, 180, flanked),
];

const controlGroups: ControlGroup[] = [
  { label: "Attractors", controls: ["sourceMode", "sourceCount", "disorder", "exclusion", "band", "lobeGap", "lobeBias"] },
  { label: "Placement", controls: ["centerX", "centerY", "extent", "aspect", "direction"] },
  { label: "Roots", controls: ["rootPlacement", "rootCount", "rootX", "rootY", "rootHeading", { label: "Spread", controls: ["rootSpread", "rootJitter"], proportional: true }] },
  { label: "Growth", controls: ["ticks", { label: "Reach", controls: ["step", "reach"], proportional: true },
    { label: "Branching", controls: ["branches", "branchSpread"] }] },
  { label: "Branches", controls: ["routing", "edgeMaterial", "edgeWeight", "edgeFalloff",
    { label: "Stitches", controls: ["edgeSpacing", "edgePhase", "edgePhaseSpread"] },
    { label: "Visibility", controls: ["edgeMinDepth", "edgeMaxDepth", "edgeRetention"] }] },
  { label: "Outline", controls: ["outlineWidth", "outlineFalloff", "outlineTaper", "outlineWeight"] },
  { label: "Marks", controls: ["marksFollowBranches", "angleInheritance", "sizeFalloff", "variation", "ornamentRetention"] },
  roleGroup("Tips", "terminal", true),
  roleGroup("Junctions", "fork", true),
  roleGroup("Base", "trunk", false),
  roleGroup("Flanks", "flank", true, ["flankSpacing", "flankSides", "flankAngle"]),
];

/** The growth controls of these values must respect the Attractor Growth domains and work budget. */
export function validateBranchOrnament(params: Record<string, number | string | boolean>): void {
  const construction = params as unknown as GrowthConstruction;
  validateAttractorGrowth(growthParams(params.rootPlacement === "auto" ? { ...construction, ...fitRoots(construction) } : construction));
}

export const branchOrnamentDefinitions: InstrumentDefinition[] = [{
  id: "branch-ornament", title: "Branch Ornament",
  description: "Grow a branching tree toward an editable attractor field, then attach marks by role: blossoms at tips, joints at forks, pennants along the stems, with a separate outline.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    sourceMode: "area", sourceCount: 90, disorder: .6, exclusion: .1, band: .18, lobeGap: .15, lobeBias: .5,
    centerX: 320, centerY: 250, extent: 420, aspect: 1, direction: 0,
    rootPlacement: "auto", rootCount: 1, rootX: 320, rootY: 540, rootHeading: 0, rootSpread: 0, rootJitter: 0,
    ticks: 34, step: 11, reach: 16, branches: 2, branchSpread: 40,
    routing: "smooth", edgeMaterial: "ink", edgeWeight: 3.2, edgeFalloff: .82, edgeSpacing: 8, edgePhase: .35, edgePhaseSpread: 0,
    edgeMinDepth: 0, edgeMaxDepth: 48, edgeRetention: 1,
    outlineWidth: 3, outlineFalloff: .7, outlineTaper: 1, outlineWeight: .7,
    marksFollowBranches: true, angleInheritance: 1, sizeFalloff: .35, variation: .45, ornamentRetention: 1,
    terminalMark: "rosette", terminalMinDepth: 0, terminalMaxDepth: 48, terminalOffset: 5, terminalSize: 20, terminalWeight: 1.1, terminalPetals: 7, terminalOpening: .25,
    forkMark: "dot", forkMinDepth: 0, forkMaxDepth: 48, forkOffset: 0, forkSize: 5, forkWeight: 1, forkPetals: 6, forkOpening: .3,
    trunkMark: "rings", trunkOffset: 0, trunkSize: 12, trunkWeight: 1.2, trunkPetals: 6, trunkOpening: .4,
    flankMark: "arrow", flankMinDepth: 0, flankMaxDepth: 1, flankOffset: 6, flankSize: 12, flankWeight: 1, flankPetals: 5, flankOpening: .3,
    flankSpacing: 24, flankSides: "alternate", flankAngle: 50,
  },
  validate: validateBranchOrnament,
}];
