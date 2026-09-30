import { componentSeed } from "../composition/core.js";
import { DEFAULT_FLATNESS, MAX_SPOKES, MIN_PERIOD } from "../composition/patterns.js";
import type { PatternSpec } from "../composition/patterns.js";
import type { OpticalPlatesOptions, PlateInk, PlateOptions, PlatesRecipe } from "../composition/plates.js";
import { partitionRegions } from "../composition/sources.js";
import type { MaskSource, SupportSpec } from "../composition/support.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, text, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter => {
  const parameter = numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter => {
  const parameter = choice(key, label, description, options);
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};

const patterns = ["grating", "rings", "dots", "waves", "spokes"];
const masked = ["A", "B", "both"];
const uses = (x: "A" | "B", ...kinds: string[]): Condition => ({ [`pattern${x}`]: kinds });
const plateBShown: Condition = { show: ["both", "B"] };
// Plate A's Y offset matters while A is drawn, or while a linked B is registered to it.
const offsetYAShown: Condition = [{ link: ["linked"] }, { show: ["both", "A"] }];

/** Every plate has the same controls, so both are built by one function and share one group. */
function plateControls(x: "A" | "B", name: string): Parameter[] {
  const p = `plate ${name}`;
  return [
    // A plate's pattern matters only while that plate is drawn; its registration also positions a linked B, so stays visible.
    select(`pattern${x}`, "Pattern", `The source pattern of ${p}: parallel lines, concentric rings, a dot lattice, a wave-bent grating or radial spokes.`, patterns, { show: ["both", x] }),
    n(`period${x}`, "Period", `Distance between neighbouring lines, rings or dots of ${p}. Never below ${MIN_PERIOD}, so a screen is not finer than the device can draw.`, 6, 40, .25, MIN_PERIOD, 400, uses(x, "grating", "rings", "dots", "waves")),
    n(`chirp${x}`, "Frequency drift", `Relative change of ${p}'s local frequency per 100 units from its center: lines crowd on one side and open on the other. Zero is regular. A drift times the plate's size above 80% is refused.`, -.15, .15, .005, -1, 1, uses(x, "grating", "rings", "waves")),
    n(`amplitude${x}`, "Wave height", `How far the wave pushes each line of ${p} sideways.`, 0, 30, .5, 0, 400, uses(x, "waves")),
    n(`wavelength${x}`, "Wavelength", `Distance along the lines over which the wave repeats.`, 40, 400, 1, 4, 5000, uses(x, "waves")),
    n(`count${x}`, "Spokes", `Number of rays of ${p}. The hub grows automatically so spokes never start closer than ${MIN_PERIOD} units.`, 12, 120, 1, 2, MAX_SPOKES, uses(x, "spokes"), true),
    n(`hub${x}`, "Hub radius", `Empty radius at the center of ${p}'s spokes.`, 0, 80, 1, 0, 1000, uses(x, "spokes")),
    select(`lattice${x}`, "Lattice", `Square rows or staggered hexagonal rows of dots in ${p}.`, ["square", "hex"], uses(x, "dots")),
    n(`dotSize${x}`, "Dot diameter", `Diameter of each dot of ${p}.`, 2, 9, .25, .5, 60, uses(x, "dots")),
    n(`angle${x}`, "Rotation", x === "A"
      ? "Turn plate A about the footprint center, in degrees. A linked plate B turns with it."
      : "Turn plate B, in degrees: relative to plate A when linked, in the canvas frame when detached.", -90, 90, .25, -360, 360,
      x === "B" ? plateBShown : undefined),
    n(`phase${x}`, "Phase", `Slide ${p}'s pattern by this fraction of its period: lines and dots slide, rings grow, spokes turn.${
      x === "A" ? " A linked plate B is phased on top of this." : " Added to plate A's phase when linked."}`, -.5, .5, .01, -1000, 1000,
      x === "B" ? plateBShown : undefined),
    n(`offsetX${x}`, "Offset X", x === "A" ? "Move plate A sideways, in canvas units. A linked plate B moves with it."
      : "Move plate B sideways, in canvas units; when linked, in plate A's rotated frame.", -60, 60, 1, -800, 800, x === "B" ? plateBShown : undefined),
    n(`offsetY${x}`, "Offset Y", x === "A" ? "Move plate A vertically, in canvas units." : "Move plate B vertically, in canvas units.", -60, 60, 1, -800, 800,
      x === "A" ? offsetYAShown : plateBShown),
    n(`weight${x}`, "Line weight", `Stroke width of ${p}'s lines. Dot plates use the dot diameter instead.`, .4, 3, .05, 0, 20, uses(x, "grating", "rings", "waves", "spokes")),
  ];
}
const plateGroup = (label: string, x: "A" | "B"): ControlGroup => ({ label, stage: "form", controls: [`pattern${x}`, `period${x}`, `chirp${x}`,
  { label: "Wave", controls: [`amplitude${x}`, `wavelength${x}`] }, { label: "Spokes", controls: [`count${x}`, `hub${x}`] },
  { label: "Dots", controls: [`lattice${x}`, `dotSize${x}`] },
  { label: "Registration", controls: [`angle${x}`, `phase${x}`, { label: "Offset", controls: [`offsetX${x}`, `offsetY${x}`] }] }, `weight${x}`] });

const maskOn = { maskedPlate: masked };
export const opticalPlatesDefinition: InstrumentDefinition = {
  id: "optical-plates", title: "Optical Plates",
  description: "Two editable pattern plates, linked or detached, alone or overlaid, with one of them following a type or region mask.",
  procedure: "Two dot screens are laid over each other, the second slightly finer and turned, and confined to the letters OP. Where the screens drift in and out of register, moiré makes the letters appear.",
  renderer: "2d",
  parameters: [
    ...plateControls("A", "A"), ...plateControls("B", "B"),
    select("link", "Link", "Linked: plate B is registered to plate A and rides with it when A is rotated, moved or phased. Detached: every plate keeps its own absolute registration.", ["linked", "detached"], plateBShown),
    select("show", "Show", "Draw both plates over each other, or one plate alone. The plates keep their registration either way, so two layers with different choices line up.", ["both", "A", "B"]),
    n("centerX", "Center X", "Horizontal center of the footprint and of the registration frame, canvas units.", 80, 560, 1, -1000, 1600),
    n("centerY", "Center Y", "Vertical center of the footprint and of the registration frame, canvas units.", 80, 560, 1, -1000, 1600),
    n("width", "Width", "Footprint width. The footprint bounds every plate; a type mask is fitted inside it.", 100, 640, 1, 1, 1600),
    n("height", "Height", "Footprint height.", 100, 640, 1, 1, 1600),
    select("footprint", "Footprint", "Rectangle or ellipse that bounds every plate; a plate that follows the mask is confined to the mask inside it.", ["rectangle", "ellipse"]),
    select("maskedPlate", "Follows mask", "Which plate is confined to the mask; the other keeps the plain footprint and stays regular.", ["none", ...masked]),
    select("maskShape", "Mask", "Type outlines or a set of rectangular regions.", ["type", "regions"], maskOn),
    { ...toggle("invertMask", "Invert mask", "Off keeps the plate inside the mask; on keeps it in the footprint outside the mask."), visibleWhen: maskOn },
    { ...text("text", "Type", "One to twenty printable ASCII characters, fitted to the footprint in the licensed glyph font.", 20),
      visibleWhen: { ...maskOn, maskShape: ["type"] } },
    n("regionGrid", "Region grid", "Cut coordinates on each side of the footprint that regions may use.", 2, 40, 1, 2, 150, { ...maskOn, maskShape: ["regions"] }, true),
    n("regionCuts", "Region cuts", "Seeded binary subdivisions of the footprint.", 1, 60, 1, 0, 400, { ...maskOn, maskShape: ["regions"] }, true),
    n("regionKeep", "Region retention", "Stable fraction of regions kept; dropped regions leave paper without moving any other.", 0, 1, .01, 0, 1, { ...maskOn, maskShape: ["regions"] }),
    n("regionInset", "Region inset", "Clearance inside each region so neighbours do not touch.", 0, 20, .5, 0, 200, { ...maskOn, maskShape: ["regions"] }),
  ],
  controlGroups: [
    plateGroup("Plate A", "A"), plateGroup("Plate B", "B"),
    { label: "Pair", stage: "form", controls: ["link", "show"] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
    { label: "Support", stage: "form", controls: ["footprint", "maskedPlate", "maskShape", "invertMask", "text",
      { label: "Regions", controls: ["regionGrid", "regionCuts", "regionKeep", "regionInset"] }] },
  ],
  defaults: {
    patternA: "dots", periodA: 7, chirpA: 0, amplitudeA: 8, wavelengthA: 160, countA: 60, hubA: 0, latticeA: "square", dotSizeA: 3,
    angleA: -2, phaseA: 0, offsetXA: 0, offsetYA: 0, weightA: 1.2,
    patternB: "dots", periodB: 7.3, chirpB: 0, amplitudeB: 8, wavelengthB: 160, countB: 60, hubB: 0, latticeB: "square", dotSizeB: 3.2,
    angleB: 5, phaseB: 0, offsetXB: 0, offsetYB: 0, weightB: 1.5,
    link: "linked", show: "both", centerX: 320, centerY: 320, width: 560, height: 480,
    footprint: "rectangle", maskedPlate: "B", maskShape: "type", invertMask: false, text: "OP",
    regionGrid: 12, regionCuts: 14, regionKeep: .8, regionInset: 3,
  },
  validate: validateOpticalPlates,
};

export function validateOpticalPlates(q: InstrumentDefinitionValues): void {
  const word = q.text;
  if (typeof word !== "string" || !/^[\x20-\x7E]{1,20}$/.test(word) || !word.trim())
    throw new Error("Type must be 1–20 printable ASCII characters and not blank");
}
type InstrumentDefinitionValues = Record<string, number | string | boolean>;

function patternSpec(q: InstrumentDefinitionValues, x: "A" | "B"): PatternSpec {
  const period = q[`period${x}`] as number, chirp = q[`chirp${x}`] as number;
  switch (q[`pattern${x}`]) {
    case "grating": return { kind: "grating", period, chirp };
    case "rings": return { kind: "rings", period, chirp };
    case "dots": return { kind: "dots", period, lattice: q[`lattice${x}`] as "square" | "hex" };
    case "waves": return { kind: "waves", period, chirp, amplitude: q[`amplitude${x}`] as number, wavelength: q[`wavelength${x}`] as number };
    default: return { kind: "spokes", count: q[`count${x}`] as number, hub: q[`hub${x}`] as number };
  }
}

/** Resolve the named scalar controls to the public, JSON-compatible plates descriptor. */
export function opticalPlatesRecipe(q: InstrumentDefinitionValues, seed: number, palette: readonly number[]): PlatesRecipe {
  const footprint = { shape: q.footprint as "rectangle" | "ellipse", centerX: q.centerX as number, centerY: q.centerY as number,
    width: q.width as number, height: q.height as number };
  let source: MaskSource | undefined;
  if (q.maskedPlate !== "none") {
    if (q.maskShape === "type") source = { kind: "text", text: q.text as string, centerX: footprint.centerX,
      centerY: footprint.centerY, width: footprint.width, height: footprint.height };
    else {
      const regions = partitionRegions({ seed, width: footprint.width, height: footprint.height, centerX: footprint.centerX,
        centerY: footprint.centerY, columns: q.regionGrid as number, rows: q.regionGrid as number, attempts: q.regionCuts as number,
        axis: "LONGEST", bias: 0 });
      // Retention is per region id, so dropping one never moves another.
      source = { kind: "regions", inset: q.regionInset as number, regions: regions.filter((region) =>
        componentSeed(seed, region.id, "mask") / 0x1_0000_0000 < (q.regionKeep as number)) };
    }
  }
  const support = (x: "A" | "B"): SupportSpec => q.maskedPlate === x || q.maskedPlate === "both"
    ? { footprint, mask: { source: source!, invert: q.invertMask === true } } : { footprint };
  const plate = (x: "A" | "B"): PlateOptions => ({ pattern: patternSpec(q, x), support: support(x),
    registration: { offsetX: q[`offsetX${x}`] as number, offsetY: q[`offsetY${x}`] as number,
      rotation: q[`angle${x}`] as number, phase: q[`phase${x}`] as number } });
  const ink = (x: "A" | "B"): PlateInk => ({
    material: { kind: "ink", weight: q[`weight${x}`] as number, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
      mark: { kind: "dot", size: 0, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } },
    mark: { kind: "dot", size: q[`dotSize${x}`] as number, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } });
  const options: OpticalPlatesOptions = { seed, link: q.link as "linked" | "detached", originX: footprint.centerX,
    originY: footprint.centerY, flatness: DEFAULT_FLATNESS, plates: [plate("A"), plate("B")] };
  return { kind: "plates", source: options, ink: [ink("A"), ink("B")], palette,
    show: q.show === "both" ? "all" : q.show === "A" ? [0] : [1] };
}
