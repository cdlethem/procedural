import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { washShapes, washWords } from "../composition/wash-shapes.js";
import { choice, numeric } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["lobes", "holeCount", "compartments", "passes", "detail"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, [...options]), visibleWhen);

const blob: Condition = { shape: ["blob"] };
const ring: Condition = { shape: ["ring"] };
const letters: Condition = { shape: ["letters"] };
const quilt: Condition = { shape: ["quilt"] };
const gapped: Condition = { shape: ["quilt"], layout: ["gapped"] };
const turnable: Condition = { shape: ["blob", "ring", "letters"] };
const multiple: Condition = { shape: ["letters", "quilt"] };
const patched: Condition = { extent: ["patches"] };
const reserving: Condition = { holes: ["reserved"] };
const twoPigments: Condition = { pigment: ["two"] };

const parameters: Parameter[] = [
  select("shape", "Shape", "What is washed: a lobed blob, a ring with a hole, letterforms (their counters are holes) or the compartments of a Region Quilt. Every wash pass is this shape carried through its own ragged boundary.", washShapes),
  n("lobes", "Lobes", "Main bulges of the blob outline. The seed sets their phases, so it changes the outline, not just the wash.", 2, 9, 1, 1, 24, blob),
  n("holeCount", "Hole count", "Round holes cut into the blob. They are reserved (kept unpainted) unless Holes says otherwise.", 0, 6, 1, 0, 12, blob),
  n("holeSize", "Hole size", "Radius of a blob hole as a fraction of the blob's half extent; each hole varies by a stable draw.", 0.05, 0.25, 0.005, 0.02, 0.5, blob),
  n("ringHole", "Ring hole", "Radius of the ring's hole as a fraction of its outer radius.", 0.15, 0.85, 0.01, 0.02, 0.95, ring),
  select("word", "Word", "Which bundled word is washed. Each has different counters and gaps; the seed does not change the type.", washWords, letters),
  n("compartments", "Compartments", "Region Quilt compartments to wash, each as its own parent shape (the 12 by 12 cut grid refuses a cut that would leave less than one cell, so large requests give somewhat fewer). The seed changes the partition.", 2, 24, 1, 1, 150, quilt),
  n("merge", "Merged", "Share of compartments joined with an edge neighbour into L- and T-shaped regions (non-convex parents).", 0, 0.8, 0.01, 0, 1, quilt),
  select("layout", "Layout", "Abutting compartments share their edges, so with one field their washes stay together; gapped ones are inset from each other.", ["abutting", "gapped"], quilt),
  n("gutter", "Gutter", "Gap between neighbouring compartments in canvas units (each is inset by half of it).", 2, 40, 0.5, 0.5, 200, gapped),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the shape.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the shape.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the box the shape is fitted to, in canvas units.", 120, 620, 1, 4, 4096),
  n("height", "Height", "Height of the box the shape is fitted to, in canvas units. Letterforms keep their proportions inside it.", 120, 620, 1, 4, 4096, { shape: ["blob", "ring", "quilt"] }),
  n("rotation", "Rotation", "Turns the shape about its center, in degrees. A quilt partition stays axis-aligned.", -180, 180, 1, -3600, 3600, turnable),

  n("swell", "Swell", "Wavelength of the broadest ripple of the boundary, as a fraction of the shape's shorter side. Larger swells give long, lazy bulges; smaller ones a busy edge.", 0.08, 0.6, 0.005, 0.005, 4),
  n("detail", "Detail", "Ripple scales layered on the boundary; each is half the wavelength of the one before, down to the finest. Every extra scale doubles the outline samples, so it costs proportionally more.", 1, 6, 1, 1, 8),
  n("roughness", "Roughness", "How strongly fine ripples keep up with broad ones: 0 smooth, lapping swells; 1 a torn, feathered edge.", 0, 1, 0.01, 0, 1),
  n("variance", "Edge variance", "How far the boundary strays from the parent. 1 is the largest ripple the boundary allows for its swell (a tenth of the wavelength, rms); 0 leaves every pass exactly the parent.", 0, 1, 0.01, 0, 1),
  n("independence", "Independence", "0: every pass shares one boundary, so passes coincide. 1: every pass has an unrelated boundary. In between, two passes' boundary displacements have correlation 1 minus this.", 0, 1, 0.01, 0, 1),
  select("divergence", "Independent at", "Which ripples differ between passes: all of them, only the fine ones (passes share their broad outline and differ in the ragged detail), or only the broad ones.", ["all", "fine", "coarse"]),
  select("coupling", "Regions", "One field: all regions share one boundary displacement, so touching edges move together and neighbours ripple alike. Separate: each region has its own.", ["one", "separate"], multiple),

  n("passes", "Passes", "Translucent passes laid over each region. Each pass keeps the parent's shape and gets its own ragged boundary.", 1, 40, 1, 1, 64),
  select("extent", "Reach", "Whole shape: every pass covers the entire parent. Patches: each pass covers only a ragged patch of it, so coverage builds up unevenly and paper shows through.", ["whole", "patches"]),
  n("patchSize", "Patch size", "Patch radius as a fraction of the region's half diagonal.", 0.15, 1.2, 0.01, 0.02, 3, patched),
  n("focus", "Patch focus", "0 scatters the patches over the region; 1 lays them all over one common point, a dense overpainted patch with a pale halo.", 0, 1, 0.01, 0, 1, patched),
  n("creep", "Pass creep", "Each later pass is grown (positive) or shrunk (negative) by this many canvas units per pass index before its boundary is displaced: nested tone steps instead of a common edge.", -6, 6, 0.1, -1000, 1000),

  select("holes", "Holes", "Reserved: the parent's holes stay unpainted in every pass (their edges retreat raggedly, never advance). Open: the wash covers them.", ["reserved", "open"], turnable),
  n("margin", "Reserve margin", "Extra clearance kept around reserved holes, in canvas units.", 0, 30, 0.5, 0, 1000, reserving),

  select("pigment", "Pigment", "One pigment; two pigments (a share of the passes use the second); or a pigment per region.", ["one", "two", "region"]),
  n("mix", "Second pigment", "Share of passes laid in the second palette colour, by a stable draw per pass. Raising it only recolours.", 0, 1, 0.01, 0, 1, twoPigments),
  n("opacity", "Pigment opacity", "Opacity of each pass. Where passes overlap the pigment builds up; where only one reaches it stays pale.", 0.02, 0.5, 0.005, 0, 1),
  n("edge", "Edge pigment", "Opacity of a darker line where pigment pooled along each pass's boundary; 0 draws none.", 0, 1, 0.01, 0, 1),
  n("edgeWeight", "Edge weight", "Stroke width of that boundary line, in canvas units.", 0.3, 3, 0.05, 0, 50),
];

const controlGroups: ControlGroup[] = [
  { label: "Parent shape", controls: ["shape", "lobes", "holeCount", "holeSize", "ringHole", "word", "compartments", "merge", "layout", "gutter"] },
  { label: "Placement", controls: [
    "centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Boundary", controls: ["swell", "detail", "roughness", "variance"] },
  { label: "Correlation", controls: ["independence", "divergence", "coupling"] },
  { label: "Passes", controls: ["passes", "extent", "patchSize", "focus", "creep"] },
  { label: "Reserve", controls: ["holes", "margin"] },
  { label: "Pigment", controls: ["pigment", "mix", "opacity", { label: "Edge", controls: ["edge", "edgeWeight"] }] },
];

const optionLabels: Record<string, Record<string, string>> = {
  shape: { blob: "Blob", ring: "Ring with a hole", letters: "Letterforms", quilt: "Quilt compartments" },
  divergence: { all: "All ripples", fine: "Fine ripples only", coarse: "Broad ripples only" },
  coupling: { one: "One shared field", separate: "Separate fields" },
  extent: { whole: "Whole shape", patches: "Patches" },
  holes: { reserved: "Reserved", open: "Washed over" },
  pigment: { one: "One pigment", two: "Two pigments", region: "One per region" },
};
const labelled = (parameter: Parameter): Parameter => {
  const labels = optionLabels[parameter.key];
  return labels ? { ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) } : parameter;
};

export const polygonWatercolorDefinition: InstrumentDefinition = {
  id: "polygon-watercolor", title: "Polygon Watercolor",
  description: "Translucent washes laid over a shape (a blob, a ring, letterforms or quilt compartments): every pass keeps the shape but has its own ragged boundary, correlated with the others, so pigment builds up unevenly toward the middle and reserved holes stay unpainted. A light partial wash and a dense overpainted patch are the same instrument with different settings.",
  renderer: "2d",
  parameters: parameters.map(labelled), controlGroups,
  defaults: {
    shape: "blob", lobes: 5, holeCount: 2, holeSize: 0.13, ringHole: 0.45, word: "BLOOM", compartments: 9, merge: 0.25, layout: "abutting", gutter: 8,
    centerX: 320, centerY: 320, width: 460, height: 420, rotation: 0,
    swell: 0.24, detail: 4, roughness: 0.45, variance: 1, independence: 0.75, divergence: "all", coupling: "one",
    passes: 20, extent: "patches", patchSize: 0.75, focus: 0.35, creep: 0,
    holes: "reserved", margin: 0,
    pigment: "one", mix: 0.3, opacity: 0.07, edge: 0.15, edgeWeight: 0.8,
  },
};
