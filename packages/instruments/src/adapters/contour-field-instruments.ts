import type { ControlGroup, Layer, Parameter } from "../types.js";
import { channels, numeric, toggle, type StudioDefinition } from "./types.js";
import { contourReliefContours, contourReliefField, contourReliefDefinitions, validateContourRelief } from "./contour-relief.js";

type Canvas = {
  ROUND: unknown;
  push(): void; pop(): void; translate(x: number, y: number): void; rotate(angle: number): void;
  noFill(): void; strokeCap(cap: unknown): void; strokeWeight(weight: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  line(x: number, y: number, x2: number, y2: number): void;
};
type Params = Layer["params"];
const base = contourReliefDefinitions[0];
const byKey = (key: string): Parameter => {
  const parameter = base.parameters.find(item => item.key === key);
  if (!parameter) throw Error(`Missing contour control ${key}`);
  return parameter;
};
const controls = ["source", "columns", "rows", "grid", "frequency", "aspect", "phase", "hillCount", "hillRadius", "width", "height", "centerX", "centerY"];
const sourceDefaults = Object.fromEntries(controls.map(key => [key, base.defaults[key]]));
const common: Parameter[] = [
  ...controls.map(byKey),
  numeric("orientation", "Orientation", "Rotation in degrees about the editable local field center.", -180, 180, 1,
    { hardMin: -3600, hardMax: 3600, integer: false }),
  numeric("levelBase", "First level", "Scalar threshold for the first contour in source-value units.", -1, 1, .05,
    { hardMin: -16, hardMax: 16, integer: false }),
  numeric("levelStep", "Level spacing", "Positive scalar interval between successive levels, not a fixed hidden gap.", .05, .3, .01,
    { hardMin: .001, hardMax: 16, integer: false }),
  numeric("levels", "Contour levels", "Number of contour thresholds sampled from the field.", 1, 12, 1,
    { hardMin: 1, hardMax: 32, integer: true }),
  numeric("weight", "Line weight", "Stroke weight of sampled contour segments; zero omits them.", .3, 3, .1,
    { hardMin: 0, hardMax: 20, integer: false }),
  toggle("indexLines", "Index lines", "Emphasize every fourth contour level."),
  toggle("centers", "Hill centers", "Show crosses at actual seeded hill centers when the source is Hills."),
];
/** Terrain and blobs share one control set, so they share one organization. */
const contourGroups: ControlGroup[] = [
  { label: "Field", controls: ["source", { label: "Samples", controls: ["columns", "rows"], proportional: true }, "grid", "frequency", "aspect", "phase",
    { label: "Hills", controls: ["hillCount", "hillRadius", "centers"] }] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "orientation"] },
  { label: "Levels", controls: ["levels", "levelBase", "levelStep"] },
  { label: "Lines", controls: ["weight", "indexLines"] },
];

export const contourFieldDefinitions: StudioDefinition[] = [{
  id: "contour-terrain", title: "Contour terrain",
  description: "Locally placed contours of editable sampled noise, hills or numeric heights.",
  parameters: [...common],
  controlGroups: contourGroups,
  defaults: {
    ...sourceDefaults,
    source: "noise",
    columns: 57,
    rows: 47,
    frequency: 3.1,
    aspect: 1.1,
    width: 440,
    height: 340,
    centerX: 320,
    centerY: 320,
    orientation: 0,
    levelBase: -.45,
    levelStep: .09,
    levels: 11,
    weight: .9,
    indexLines: true,
    centers: false},
  validate: validateContourField,
}, {
  id: "contour-blobs", title: "Contour blobs",
  description: "Locally placed sampled contours around seeded hills or an edited numeric grid.",
  parameters: [...common],
  controlGroups: contourGroups,
  defaults: {
    ...sourceDefaults,
    source: "hills",
    columns: 57,
    rows: 51,
    hillCount: 5,
    hillRadius: .19,
    width: 390,
    height: 360,
    centerX: 320,
    centerY: 320,
    orientation: 0,
    levelBase: .15,
    levelStep: .15,
    levels: 7,
    weight: 1.4,
    centers: false,
    indexLines: false},
  validate: validateContourField,
}];

function sourceParams(q: Params): Params {
  return { ...base.defaults, ...q, levelMode: "sequence", levelCount: q.levels,
    faces: false, edges: false, contours: true, faceColor: "height", edgeWeight: 0,
    contourWeight: q.weight };
}

export function validateContourField(q: Params): void {
  
  
  if (typeof q.orientation !== "number" || !Number.isFinite(q.orientation) || Math.abs(q.orientation) > 3600)
    throw Error("orientation must be a finite angle in [-3600,3600]");
  if (typeof q.levels !== "number" || !Number.isInteger(q.levels) || q.levels < 1 || q.levels > 32)
    throw Error("levels must be an integer from 1 to 32");
  if (typeof q.weight !== "number" || !Number.isFinite(q.weight) || q.weight < 0 || q.weight > 20)
    throw Error("weight must be a finite number from 0 to 20");
  if (q.centers !== undefined && typeof q.centers !== "boolean") throw Error("centers must be boolean");
  if (q.indexLines !== undefined && typeof q.indexLines !== "boolean") throw Error("indexLines must be boolean");
  validateContourRelief(sourceParams(q));
}

export function drawContourField(p: Canvas, layer: Layer): void {
  
  validateContourField(layer.params);
  if (layer.params.weight === 0 && !(layer.params.centers === true && layer.params.source === "hills")) return;
  const shared = { ...layer, params: sourceParams(layer.params) }, q = layer.params;
  p.push();
  try {
    p.translate(Number(q.centerX), Number(q.centerY)); p.rotate(Number(q.orientation) * Math.PI / 180);
    p.noFill(); p.strokeCap(p.ROUND);
    const palette = layer.palette;
    if (Number(q.weight) > 0) for (const [index, { segments }] of contourReliefContours(shared).entries()) {
      p.stroke(...channels(palette[index % palette.length] ?? 0), 230);
      p.strokeWeight(Number(q.weight) * (q.indexLines === true && index % 4 === 0 ? 1.9 : 1));
      for (const [x1, y1, x2, y2] of segments) p.line(x1, y1, x2, y2);
    }
    if (q.centers === true && q.source === "hills") {
      p.strokeWeight(1.4);
      for (const [index, hill] of (contourReliefField(shared).hills ?? []).entries()) {
        p.stroke(...channels(palette[index % palette.length] ?? 0), 230);
        const x = hill.x * Number(q.width), y = hill.y * Number(q.height);
        p.line(x - 3, y, x + 3, y); p.line(x, y - 3, x, y + 3);
      }
    }
  } finally { p.pop(); }
}
