import { medianCutQuantize } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";
import { parseRgbColor } from "./color-source.js";
import { channels, choice, numeric, text, type StudioDefinition } from "./types.js";

const num = (key: string, label: string, description: string, min: number, max: number,
  step: number, hardMin: number, hardMax: number, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });

export const quantizedStripeDefinitions: StudioDefinition[] = [{
  id: "quantized-stripes",
  title: "Quantized Stripes",
  description: "Reduce an editable RGB source to a smaller palette, then place its weighted colors in rows of separated strips or tiles.",
  parameters: [
    choice("source", "Color source", "Sample every palette stop in encoded RGB, or edit an explicit weighted color sequence.", ["palette-ramp", "sequence"]),
    num("samples", "Ramp samples", "Number of source colors interpolated across all palette stops; only used for palette-ramp.", 2, 128, 1, 0, 512, true),
    text("sequence", "Weighted color sequence", 'For sequence source: JSON rows ["#hex", positiveWeight], 1–512 rows. Hex colors may use three or six digits; weights are at most 10000.', 32768, true),
    num("colors", "Retained colors", "Requested median-cut palette size; similar inputs can produce fewer distinct colors. Subject to the 3,000,000-work limit.", 1, 32, 1, 1, 256, true),
    choice("order", "Color order", "Keep source order, group by reduced color (stable within each group), or shuffle the source positions using the layer seed.", ["source", "grouped", "shuffle"]),
    num("columns", "Columns", "Maximum weighted cells across each row; one column produces horizontal strips.", 1, 24, 1, 1, 128, true),
    num("width", "Field width", "Total horizontal extent of the unshifted color rows, in canvas units.", 0, 600, 1, 0, 10000),
    num("height", "Field height", "Total height of the field; row heights follow the sum of their source weights.", 0, 600, 1, 0, 10000),
    num("centerX", "Center X", "Horizontal center of the unshifted color field, in canvas units.", 0, 640, 1, -10000, 10000),
    num("centerY", "Center Y", "Vertical center of the field, in canvas units.", 0, 640, 1, -10000, 10000),
    num("rotation", "Rotation", "Rotation of all rows about the field center in degrees.", -180, 180, 1, -36000, 36000),
    num("rowShift", "Alternate row shift", "Shift odd rows by this many nominal column widths; even rows stay put.", -1, 1, .05, -2, 2),
    num("coverageX", "Horizontal coverage", "Fraction of each weighted cell painted, centered to leave transparent side gaps.", 0, 1, .01, 0, 1),
    num("coverageY", "Vertical coverage", "Fraction of each row painted, centered to leave transparent top and bottom gaps.", 0, 1, .01, 0, 1),
  ],
  controlGroups: [
    { label: "Source", stage: "form", controls: ["source", "samples", "sequence"] },
    { label: "Reduction", stage: "process", controls: ["colors", "order"] },
    { label: "Layout", stage: "form", controls: ["columns", "rowShift"] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
    { label: "Coverage", stage: "material", controls: ["coverageX", "coverageY"] },
  ],
  defaults: {
    source: "palette-ramp", samples: 48,
    sequence: '[["#1b2439",2],["#376b89",1],["#84b8b3",3],["#f2d698",1],["#e98567",2],["#784558",1],["#b9a6c6",2],["#35476e",1]]',
    colors: 5, order: "source", columns: 1, width: 420, height: 420,
    centerX: 320, centerY: 320, rotation: 0, rowShift: 0, coverageX: .92, coverageY: .72,
  },
  validate: validateQuantizedStripeParams,
}];

type Params = Layer["params"];
type RGB = [number, number, number];
type SourceColor = { color: RGB; weight: number };
export type QuantizedStripe = {
  sourceIndex: number;
  paletteIndex: number;
  color: number[];
  /** Rectangle coordinates before rotation, relative to the field center. */
  x: number; y: number; width: number; height: number;
};
export type QuantizedStripePreparation = { palette: number[][]; indices: number[]; stripes: QuantizedStripe[] };

function bounded(q: Params, key: string, low: number, high: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${low} and ${high}`);
  return value;
}
function sourceSequence(value: unknown): SourceColor[] {
  if (typeof value !== "string" || value.length > 32768) throw Error("sequence must be JSON text of at most 32768 characters");
  let rows: unknown;
  try { rows = JSON.parse(value); } catch { throw Error("sequence must be a JSON array of [hex color, positive weight] rows"); }
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 512)
    throw Error("sequence must have 1–512 [hex color, positive weight] rows");
  return rows.map((row, index) => {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" ||
      typeof row[1] !== "number" || !Number.isFinite(row[1]) || row[1] <= 0 || row[1] > 10000)
      throw Error(`sequence row ${index + 1} must be [hex color, positive weight <= 10000]`);
    try { return { color: parseRgbColor(row[0]), weight: row[1] }; }
    catch { throw Error(`sequence row ${index + 1} must contain a 3- or 6-digit #hex RGB color`); }
  });
}
function sourceColors(q: Params, palette: number[], sequence: SourceColor[] | null): SourceColor[] {
  if (sequence) return sequence;
  const count = q.samples as number;
  if (!count) return [];
  if (!Array.isArray(palette) || !palette.length || palette.some(color =>
    typeof color !== "number" || !Number.isInteger(color) || color < 0 || color > 0xffffffff))
    throw Error("palette-ramp needs at least one valid packed RGB palette color");
  const stops = palette.map(color => channels(color).map(channel => channel / 255) as RGB);
  return Array.from({ length: count }, (_, index) => {
    const station = count === 1 ? 0 : index * (stops.length - 1) / (count - 1);
    const first = Math.floor(station), last = Math.min(stops.length - 1, first + 1), mix = station - first;
    return { color: [0, 1, 2].map(channel => stops[first][channel] * (1 - mix) + stops[last][channel] * mix) as RGB, weight: 1 };
  });
}
function check(q: Params): SourceColor[] | null {
  bounded(q, "samples", 0, 512, true); bounded(q, "colors", 1, 256, true);
  bounded(q, "columns", 1, 128, true);
  bounded(q, "width", 0, 10000); bounded(q, "height", 0, 10000);
  bounded(q, "centerX", -10000, 10000); bounded(q, "centerY", -10000, 10000);
  bounded(q, "rotation", -36000, 36000); bounded(q, "rowShift", -2, 2);
  bounded(q, "coverageX", 0, 1); bounded(q, "coverageY", 0, 1);
  if (q.source !== "palette-ramp" && q.source !== "sequence") throw Error("source must be palette-ramp or sequence");
  if (q.order !== "source" && q.order !== "grouped" && q.order !== "shuffle") throw Error("order must be source, grouped or shuffle");
  const sequence = q.source === "sequence" ? sourceSequence(q.sequence) : null;
  const count = sequence ? sequence.length : q.samples as number;
  const colors = q.colors as number, work = count * count * colors + count * colors + count;
  if (work > 3_000_000) throw Error(`Median-cut work limit: ${count} source colors × ${colors} retained colors requires ${work} work, maximum 3000000`);
  return sequence;
}
export function validateQuantizedStripeParams(q: Params): void { check(q); }

/** Full source, reduction and geometry, without p5 or hidden artist-facing defaults. */
export function prepareQuantizedStripes(q: Params, palette: number[], seed: number): QuantizedStripePreparation {
  const sequence = check(q);
  const entries = sourceColors(q, palette, sequence), count = entries.length;
  if (q.order === "shuffle" && !Number.isSafeInteger(seed)) throw Error("Shuffle seed must be a safe integer");
  if (!count || q.width === 0 || q.height === 0 || q.coverageX === 0 || q.coverageY === 0)
    return { palette: [], indices: [], stripes: [] };
  const colors = q.colors as number, work = count * count * colors + count * colors + count;
  const reduced = medianCutQuantize({ colors: entries.map(entry => entry.color), count: colors, maxWork: work });
  const order = Array.from({ length: count }, (_, index) => index);
  if (q.order === "grouped") order.sort((a, b) => reduced.indices[a] - reduced.indices[b] || a - b);
  else if (q.order === "shuffle") {
    const random = new JavaRandom(seed >>> 0);
    for (let i = count - 1; i > 0; i--) {
      const j = random.nextInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  const columns = q.columns as number, width = q.width as number, height = q.height as number;
  const coverageX = q.coverageX as number, coverageY = q.coverageY as number;
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const stripes: QuantizedStripe[] = [];
  let top = -height / 2;
  for (let start = 0, row = 0; start < count; start += columns, row++) {
    const end = Math.min(start + columns, count);
    let weightSum = 0;
    for (let position = start; position < end; position++) weightSum += entries[order[position]].weight;
    const rowHeight = height * weightSum / totalWeight;
    let left = -width / 2 + (row % 2 ? (q.rowShift as number) * width / columns : 0);
    for (let position = start; position < end; position++) {
      const sourceIndex = order[position], cellWidth = width * entries[sourceIndex].weight / weightSum;
      const paletteIndex = reduced.indices[sourceIndex];
      stripes.push({ sourceIndex, paletteIndex, color: reduced.palette[paletteIndex],
        x: left + cellWidth * (1 - coverageX) / 2,
        y: top + rowHeight * (1 - coverageY) / 2,
        width: cellWidth * coverageX, height: rowHeight * coverageY });
      left += cellWidth;
    }
    top += rowHeight;
  }
  return { palette: reduced.palette, indices: reduced.indices, stripes };
}

type Canvas = {
  push(): void; pop(): void; translate(x: number, y: number): void; rotate(angle: number): void;
  noStroke(): void; fill(r: number, g: number, b: number): void;
  rect(x: number, y: number, width: number, height: number): void;
};
export function drawQuantizedStripeInstrument(p: Canvas, layer: Layer): void {
  const { stripes } = prepareQuantizedStripes(layer.params, layer.palette, layer.seed);
  if (!stripes.length) return;
  p.push();
  p.translate(layer.params.centerX as number, layer.params.centerY as number);
  p.rotate((layer.params.rotation as number) * Math.PI / 180);
  p.noStroke();
  for (const stripe of stripes) {
    p.fill(stripe.color[0] * 255, stripe.color[1] * 255, stripe.color[2] * 255);
    p.rect(stripe.x, stripe.y, stripe.width, stripe.height);
  }
  p.pop();
}
