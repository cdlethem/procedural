import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { bundledContainerIds, bundledContainerTitles } from "../composition/glyph-containers.js";
import { bundledVocabularyIds, bundledVocabularyTitles } from "../composition/glyph-sources.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly (readonly [string, string])[], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen: Condition): Parameter => withCondition(toggle(key, label, description), visibleWhen);

const protectedZone: Condition = { negative: ["disc", "band", "ring"] };
const positioned: Condition = { negative: ["disc", "ring"] };
const scattered: Condition = { orientation: ["boundary", "random"] };
const along: Condition = { orientation: ["boundary"] };
const outlined: Condition = { style: ["outline"] };

const parameters: Parameter[] = [
  select("container", "Container", "The silhouette the glyphs occupy. Holes and islands are respected: nothing is placed in a hole, and a glyph never straddles two islands' gap.",
    bundledContainerIds.map((id) => [id, bundledContainerTitles[id]] as const)),
  n("margin", "Margin", "Space kept between every glyph and the container's edge, its holes and the protected space, in canvas units. A large margin can consume a small island entirely.", 0, 40, 0.5, 0, 300),
  select("negative", "Protected space", "Carves a region out of the container that stays empty: a disc, a band across it, or a thin ring (a moat that separates an inner area). Orientation along the boundary wraps around it.",
    [["none", "None"], ["disc", "Disc"], ["band", "Band"], ["ring", "Ring"]]),
  n("negativeSize", "Protected size", "Diameter of the disc or ring as a fraction of the container's smaller side; thickness of the band as a fraction of its height.", 0.1, 0.9, 0.01, 0.02, 2, false, protectedZone),
  n("negativeX", "Protected X", "Horizontal position of the protected space in the container's frame, as a fraction of its width from the middle.", -0.5, 0.5, 0.01, -1.5, 1.5, false, positioned),
  n("negativeY", "Protected Y", "Vertical position of the protected space in the container's frame, as a fraction of its height from the middle.", -0.5, 0.5, 0.01, -1.5, 1.5, false, protectedZone),

  n("centerX", "Center X", "Horizontal center of the container in canvas units.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical center of the container in canvas units.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the container in canvas units; the silhouette is stretched to fit.", 120, 620, 1, 20, 4000),
  n("height", "Height", "Height of the container in canvas units; the silhouette is stretched to fit.", 120, 620, 1, 20, 4000),
  n("rotation", "Rotation", "Turns the container about its center, in degrees. Glyph orientation follows it only under the boundary rule.", -180, 180, 1, -3600, 3600),

  select("vocabulary", "Vocabulary", "What is packed: words set in the outline font, single letters, ornaments, or words with ornaments to fill the gaps. Entries are ranked; the first are the largest when Hierarchy is high.",
    bundledVocabularyIds.map((id) => [id, bundledVocabularyTitles[id]] as const)),
  n("hierarchy", "Hierarchy", "How strongly rank follows size. At 0 any entry appears at any size; at 1 the head of the list is set large and the tail small.", 0, 1, 0.01, 0, 1),
  select("counters", "Counters", "Solid treats a letter's counter (the hole in an o or a ring) as part of the letter, so nothing sits inside it. Open lets a smaller glyph nest inside a counter that is big enough.",
    [["solid", "Solid"], ["open", "Open"]]),

  n("coverage", "Coverage", "Share of the container's usable area the glyphs are asked to cover. The result is usually lower because glyphs cannot always fit; the achieved share is reported.", 0.05, 0.7, 0.01, 0, 0.95),
  n("largest", "Largest size", "Size of the biggest glyph: cap height of a word, the longer side of an ornament, in canvas units.", 12, 120, 1, 3, 600),
  n("smallest", "Smallest size", "Size of the smallest glyph, in canvas units. It cannot exceed the largest size. Smaller sizes mean many more glyphs and longer preparation.", 5, 40, 0.5, 2, 300),
  n("falloff", "Size falloff", "How fast counts grow as sizes shrink. Near 1 few glyphs and mostly large; 2 gives every size band the same area; higher packs in many small ones.", 0.5, 4, 0.05, 0.25, 6),
  n("gap", "Gap", "Space kept between glyphs as a fraction of glyph size, so big glyphs get more air than small ones.", 0, 0.6, 0.01, 0, 2),
  n("retries", "Retry budget", "Attempts to find a spot for each glyph before it is left unplaced. More retries fill tighter and take longer.", 4, 200, 1, 1, 2000, true),

  select("orientation", "Orientation", "Aligned sets every glyph at one angle. Along boundary turns each to follow the nearest edge of the container, its holes and the protected space. Random draws each angle within a range.",
    [["aligned", "Aligned"], ["boundary", "Along boundary"], ["random", "Random"]]),
  n("angle", "Angle", "Base angle in degrees. Aligned: the angle. Along boundary: added to the boundary direction (90 sets glyphs across the edge). Random: the middle of the range.", -90, 90, 1, -3600, 3600),
  n("spread", "Spread", "Random variation of each angle, plus and minus this many degrees.", 0, 90, 1, 0, 360, false, scattered),
  flag("upright", "Keep upright", "Turn a boundary-following glyph by half a turn when it would read upside down, so words stay legible.", along),

  select("style", "Ink", "Fill paints glyphs solid; outline strokes their edges only.", [["fill", "Fill"], ["outline", "Outline"]]),
  n("weight", "Outline weight", "Stroke width of outlined glyphs in canvas units.", 0.3, 3, 0.1, 0.05, 50, false, outlined),
  select("colorBy", "Color by", "Ink uses one color. Size cycles the palette by size quartile, rank by vocabulary rank, kind by word or ornament.",
    [["ink", "Ink"], ["size", "Size"], ["rank", "Rank"], ["kind", "Kind"]]),
  select("showContainer", "Show container", "Also draw the container: nothing, its outline, or a pale wash under the glyphs.", [["none", "None"], ["outline", "Outline"], ["wash", "Wash"]]),
];

const controlGroups: readonly ControlGroup[] = [
  { label: "Container", controls: ["container", "margin", { label: "Protected space", controls: ["negative", "negativeSize", "negativeX", "negativeY"] }] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Vocabulary", controls: ["vocabulary", "hierarchy", "counters"] },
  { label: "Packing", controls: ["coverage", { label: "Size", controls: ["largest", "smallest"], proportional: true }, "falloff", "gap", "retries"] },
  { label: "Orientation", controls: ["orientation", "angle", "spread", "upright"] },
  { label: "Ink", controls: ["style", "weight", "colorBy", "showContainer"] },
];

export const glyphPackingDefinition: InstrumentDefinition = {
  id: "glyph-packing", title: "Glyph Packing",
  description: "Words and ornaments packed into a silhouette from largest to smallest without touching: each keeps its own outline clear of its neighbours and of the container's edge and holes, follows the boundary or an angle you set, and the ones that cannot fit are counted rather than squeezed in.",
  renderer: "2d",
  parameters,
  controlGroups,
  defaults: {
    container: "pebble", margin: 10, negative: "disc", negativeSize: 0.3, negativeX: 0.18, negativeY: -0.14,
    centerX: 320, centerY: 320, width: 560, height: 560, rotation: 0,
    vocabulary: "words-and-ornaments", hierarchy: 0.9, counters: "solid",
    coverage: 0.6, largest: 42, smallest: 7, falloff: 2.2, gap: 0.16, retries: 100,
    orientation: "boundary", angle: 0, spread: 6, upright: true,
    style: "fill", weight: 1, colorBy: "size", showContainer: "outline",
  },
};

/** Whether the seed can change this construction: it picks every candidate position, entry and jittered angle. */
export function glyphPackingUsesSeed(q: Record<string, number | string | boolean>): boolean {
  return (q.coverage as number) > 0;
}
