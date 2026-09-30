import { gradientNoise2D01, marchingSquares2D } from "@procedurals/javascript";
import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Canvas = {
  TRIANGLES: unknown;
  push(): void; pop(): void; translate(x: number, y: number, z: number): void;
  rotateX(angle: number): void; rotateY(angle: number): void; rotateZ(angle: number): void;
  noStroke(): void; noFill(): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void; strokeWeight(weight: number): void;
  beginShape(kind?: unknown): void; vertex(x: number, y: number, z: number): void; endShape(): void;
  line(x: number, y: number, z: number, x2: number, y2: number, z2: number): void;
};
type Field = { columns: number; rows: number; values: number[]; hills?: { x: number; y: number }[] };
type Contour = { level: number; segments: number[][] };
const degrees = Math.PI / 180;
const n = (q: Params, key: string) => Number(q[key]);
const bounded = (q: Params, key: string, min: number, max: number, integer = false): number => {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} from ${min} to ${max}`);
  return value;
};
const control = (key: string, label: string, detail: string, min: number, max: number, step: number,
  hardMin = min, hardMax = max, integer = false) => numeric(key, label, detail, min, max, step, { hardMin, hardMax, integer });
const emptyGrid = "0 0 0 0 0\n0 1 2 1 0\n0 2 4 2 0\n0 1 2 1 0\n0 0 0 0 0";
const contourReliefGroups: ControlGroup[] = [
  { label: "Height source", stage: "form", controls: ["source",
    { label: "Grid", controls: ["columns", "rows"], proportional: true }, "grid",
    "frequency", "aspect", "phase",
    { label: "Hills", controls: ["hillCount", "hillRadius"] }] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY",
    { label: "Size", controls: ["width", "height"], proportional: true }, "heightScale",
    { label: "Rotation", controls: ["yaw", "pitch", "roll"] }] },
  { label: "Faces", stage: "material", controls: ["faces", "faceColor"] },
  { label: "Edges", stage: "material", controls: ["edges", "edgeWeight"] },
  { label: "Contours", stage: "material", controls: ["contours", "levelMode", "levelList", "levelCount", "levelBase", "levelStep", "contourWeight"] },
];

export const contourReliefDefinitions: StudioDefinition[] = [{
  id: "contour-relief", title: "Contour relief", renderer: "webgl",
  description: "Sample a rectangular heightfield as a local surface, horizontal level curves, or both.",
  procedure: "A height field of seeded hills is built from pairs of triangles and tilted in 3D. Level curves are cut through those same triangles, so the contour lines drape over the folded surface.",
  parameters: [
    choice("source", "Height source", "Waves and saddle are unseeded; noise and hills use the layer seed; numeric grid reads exact samples.", ["hills", "waves", "saddle", "noise", "grid"]),
    control("columns", "Grid columns", "Exact sample columns, including both boundaries.", 9, 65, 1, 2, 78, true),
    control("rows", "Grid rows", "Exact sample rows, including both boundaries.", 9, 65, 1, 2, 78, true),
    text("grid", "Numeric height grid", "For grid source: exactly Rows lines of exactly Columns whitespace-separated finite values in [-16,16]; no headers or blank lines.", 32768, true),
    control("frequency", "Frequency", "Wave cycles across width, noise frequency, or hill placement scale.", .5, 5, .05, 0, 20),
    control("aspect", "Source aspect", "Cycles or noise frequency on Y relative to X; hill ellipse aspect.", .4, 2, .05, .1, 8),
    control("phase", "Wave phase", "Wave offset in degrees; no effect on hills, noise, or numeric grid.", -180, 180, 1, -3600, 3600),
    control("hillCount", "Hills", "Seeded hill count; only used by the hills source.", 1, 12, 1, 1, 24, true),
    control("hillRadius", "Hill radius", "Fraction of footprint width for each soft hill.", .08, .5, .01, .01, 2),
    control("width", "Surface width", "Horizontal footprint in canvas units; contours use the same sampling locations.", 60, 500, 1, 1, 2400),
    control("height", "Surface depth", "Vertical footprint in canvas units.", 60, 500, 1, 1, 2400),
    control("heightScale", "Height scale", "Signed canvas-unit elevation per source-value unit; negative reverses relief.", -160, 160, 1, -500, 500),
    control("centerX", "Center X", "Canvas X (320 is the WEBGL viewport center); no auto-fit.", 20, 620, 1, -2400, 3040),
    control("centerY", "Center Y", "Canvas Y (320 is the WEBGL viewport center); no auto-fit.", 20, 620, 1, -2400, 3040),
    control("yaw", "Yaw", "Y-axis rotation in degrees, applied after local Z and X rotations.", -180, 180, 1, -3600, 3600),
    control("pitch", "Pitch", "X-axis rotation in degrees.", -180, 180, 1, -3600, 3600),
    control("roll", "Roll", "Z-axis rotation in degrees.", -180, 180, 1, -3600, 3600),
    choice("levelMode", "Contour levels", "Use explicit ascending source values, or count starting at base with positive step.", ["sequence", "list"]),
    text("levelList", "Level values", "For list mode: strictly increasing finite source-height values [-16,16], separated by commas or whitespace; 1–32 entries.", 512, true),
    control("levelCount", "Level count", "Number of regularly spaced source-height values.", 1, 12, 1, 1, 32, true),
    control("levelBase", "First level", "First source-height value, before applying height scale.", -3, 3, .1, -16, 16),
    control("levelStep", "Level step", "Positive increase of source values between curves.", .1, 1, .05, .001, 16),
    toggle("faces", "Surface faces", "Fill actual grid triangles."),
    toggle("edges", "Grid edges", "Stroke original sampled grid edges independently of surface faces."),
    toggle("contours", "Contour lines", "Stroke actual horizontal triangle-mesh level intersections."),
    choice("faceColor", "Face coloring", "Use palette bands by sampled elevation or local slope.", ["height", "slope"]),
    control("edgeWeight", "Edge weight", "Zero suppresses grid-edge ink.", 0, 3, .1, 0, 20),
    control("contourWeight", "Contour weight", "Zero suppresses contour ink.", 0, 4, .1, 0, 20),
  ],
  controlGroups: contourReliefGroups,
  defaults: { source: "hills", columns: 39, rows: 39, grid: emptyGrid, frequency: 1.6, aspect: .85, phase: 0,
    hillCount: 3, hillRadius: .22, width: 390, height: 330, heightScale: 75, centerX: 320, centerY: 320,
    yaw: -26, pitch: 48, roll: 0, levelMode: "sequence", levelList: ".25, .5, .75, 1, 1.25",
    levelCount: 5, levelBase: .25, levelStep: .25, faces: true, edges: false, contours: true,
    faceColor: "height", edgeWeight: .7, contourWeight: 2 },
  validate: validateContourRelief,
}];

function numericGrid(raw: string, columns: number, rows: number): number[] {
  const lines = raw.split(/\r?\n/);
  if (lines.length !== rows) throw Error(`grid requires exactly ${rows} lines`);
  const values: number[] = [];
  for (let y = 0; y < rows; y++) {
    const tokens = lines[y].trim().split(/\s+/);
    if (tokens.length !== columns) throw Error(`grid row ${y + 1} requires exactly ${columns} numbers`);
    for (const token of tokens) {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) throw Error(`grid row ${y + 1} has a nonnumeric value`);
      const value = Number(token);
      if (!Number.isFinite(value) || Math.abs(value) > 16) throw Error("grid values must be finite and within [-16,16]");
      values.push(value);
    }
  }
  return values;
}
function levels(q: Params): number[] {
  if (q.levelMode !== "sequence" && q.levelMode !== "list") throw Error("Unknown contour level mode");
  let result: number[];
  if (q.levelMode === "list") {
    if (typeof q.levelList !== "string" || q.levelList.length > 512) throw Error("levelList must be text of at most 512 characters");
    const tokens = q.levelList.trim().split(/[\s,]+/);
    if (!q.levelList.trim() || tokens.length > 32) throw Error("levelList requires 1 to 32 values");
    result = tokens.map(token => {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) throw Error("levelList requires finite numbers");
      return Number(token);
    });
  } else {
    const count = n(q, "levelCount"), base = n(q, "levelBase"), step = n(q, "levelStep");
    result = Array.from({ length: count }, (_, i) => base + step * i);
  }
  for (let i = 0; i < result.length; i++) {
    if (!Number.isFinite(result[i]) || result[i] < -16 || result[i] > 16 || (i && result[i] <= result[i - 1]))
      throw Error("Contour levels must be finite, strictly ascending, and within [-16,16]");
  }
  return result;
}

let validatedGridKey = "";
let validatedGridValues: number[] | undefined;

/** Validate linked budgets before allocating sampled fields or invoking the core. */
export function validateContourRelief(q: Params): void {
  if (!["waves", "saddle", "noise", "hills", "grid"].includes(String(q.source))) throw Error("Unknown relief source");
  const columns = bounded(q, "columns", 2, 78, true), rows = bounded(q, "rows", 2, 78, true);
  bounded(q, "frequency", 0, 20); bounded(q, "aspect", .1, 8); bounded(q, "phase", -3600, 3600);
  bounded(q, "hillCount", 1, 24, true); bounded(q, "hillRadius", .01, 2);
  bounded(q, "width", 1, 2400); bounded(q, "height", 1, 2400); bounded(q, "heightScale", -500, 500);
  bounded(q, "centerX", -2400, 3040); bounded(q, "centerY", -2400, 3040);
  for (const key of ["yaw", "pitch", "roll"]) bounded(q, key, -3600, 3600);
  bounded(q, "levelCount", 1, 32, true); bounded(q, "levelBase", -16, 16); bounded(q, "levelStep", .001, 16);
  bounded(q, "edgeWeight", 0, 20); bounded(q, "contourWeight", 0, 20);
  for (const key of ["faces", "edges", "contours"]) if (typeof q[key] !== "boolean") throw Error(`${key} must be boolean`);
  if (q.faceColor !== "height" && q.faceColor !== "slope") throw Error("Unknown face coloring");
  if (typeof q.grid !== "string" || q.grid.length > 32768) throw Error("grid must be text of at most 32768 characters");
  if (2 * (columns - 1) * (rows - 1) > 12000) throw Error("Surface exceeds 12000 triangles");
  const contourLevels = levels(q);
  if ((columns - 1) * (rows - 1) * contourLevels.length > 150000) throw Error("Contour cells × levels exceed 150000");
  if (q.source === "grid") {
    const gridKey = JSON.stringify([q.grid, columns, rows]);
    if (gridKey !== validatedGridKey || !validatedGridValues) {
      validatedGridValues = numericGrid(q.grid, columns, rows);
      validatedGridKey = gridKey;
    }
  }
}

let lastFieldKey = "";
let lastField: Field | undefined;
let lastContourKey = "";
let lastContours: Contour[] | undefined;
let lastMeshContourKey = "";
let lastMeshContours: Contour[] | undefined;

/** Values are source units: changes to footprint, rotation, scale, palette and ink never rebuild them. */
export function contourReliefField(layer: Layer): Field {
  const q = layer.params;
  validateContourRelief(q);
  const source = String(q.source), columns = n(q, "columns"), rows = n(q, "rows");
  const key = JSON.stringify([source, columns, rows,
    source === "grid" ? q.grid : source === "hills" ? [q.hillCount, q.hillRadius, q.frequency, q.aspect, layer.seed] :
      source === "noise" ? [q.frequency, q.aspect, layer.seed] : [q.frequency, q.aspect, q.phase]]);
  if (key === lastFieldKey && lastField) return lastField;
  const values = source === "grid" ? validatedGridValues! : new Array<number>(columns * rows);
  let centers: { x: number; y: number }[] | undefined;
  if (source !== "grid") {
    const noise = source === "noise" || source === "hills" ? gradientNoise2D01({ seed: layer.seed >>> 0 }) : undefined;
    const hillCount = n(q, "hillCount"), radius = n(q, "hillRadius"), aspect = n(q, "aspect"), frequency = n(q, "frequency");
    const phase = n(q, "phase") * degrees;
    const hills = source === "hills" ? Array.from({ length: hillCount }, (_, hill) => ({
      x: noise!.sample(hill * 2.7 + frequency, 11) - .5,
      y: noise!.sample(hill * 2.7 + frequency, 29) - .5,
      magnitude: .65 + .7 * noise!.sample(hill * 2.7 + frequency, 47),
    })) : [];
    if (source === "hills") centers = hills.map(({ x, y }) => ({ x, y }));
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const u = col / (columns - 1) - .5, v = row / (rows - 1) - .5;
      let value = 0;
      if (source === "waves") value = Math.sin(2 * Math.PI * frequency * u + phase) *
        Math.cos(2 * Math.PI * frequency * aspect * v);
      else if (source === "saddle") value = 4 * (u * u - aspect * v * v) +
        .35 * Math.sin(2 * Math.PI * frequency * u + phase) * Math.sin(2 * Math.PI * frequency * aspect * v);
      else if (source === "noise") value = 2 * (noise!.sample((u + .5) * frequency + 10, (v + .5) * frequency * aspect + 10) - .5);
      else for (const hill of hills) {
        const distance = ((u - hill.x) / radius) ** 2 + ((v - hill.y) / (radius / aspect)) ** 2;
        value += Math.exp(-2 * distance) * hill.magnitude;
      }
      values[row * columns + col] = value;
    }
  }
  lastFieldKey = key;
  lastField = { columns, rows, values, ...(centers ? { hills: centers } : {}) };
  return lastField;
}

/** Core contour extraction is cached independently of height scale, view, face style and palette. */
export function contourReliefContours(layer: Layer): Contour[] {
  const field = contourReliefField(layer), q = layer.params, list = levels(q);
  const key = JSON.stringify([lastFieldKey, q.width, q.height, list]);
  if (lastContourKey === key && lastContours) return lastContours;
  const origin = [-n(q, "width") / 2, -n(q, "height") / 2];
  const spacing = [n(q, "width") / (field.columns - 1), n(q, "height") / (field.rows - 1)];
  const maxWork = field.columns * field.rows + (field.columns - 1) * (field.rows - 1);
  const result = list.map(level => ({ level, segments: marchingSquares2D({
    values: field.values, columns: field.columns, rows: field.rows, origin, spacing, threshold: level, maxWork,
  }).segments }));
  lastContourKey = key;
  lastContours = result;
  return result;
}

/** Horizontal intersections of the two actual planar triangles in each sampled grid cell. */
export function contourReliefMeshContours(layer: Layer): Contour[] {
  const field = contourReliefField(layer), q = layer.params, list = levels(q);
  const key = JSON.stringify([lastFieldKey, q.width, q.height, list]);
  if (key === lastMeshContourKey && lastMeshContours) return lastMeshContours;
  const { columns, rows, values } = field, nodeCount = columns * rows;
  const xs = Array.from({ length: columns }, (_, col) => -n(q, "width") / 2 + col * n(q, "width") / (columns - 1));
  const ys = Array.from({ length: rows }, (_, row) => -n(q, "height") / 2 + row * n(q, "height") / (rows - 1));
  const node = (index: number): [number, number] => [xs[index % columns], ys[Math.floor(index / columns)]];
  const crossing = (i: number, j: number, level: number): [number, number] => {
    // The low-index ordering keeps both triangles' shared-edge intersections bit-identical.
    const a = Math.min(i, j), b = Math.max(i, j), t = (level - values[a]) / (values[b] - values[a]);
    const ax = xs[a % columns], ay = ys[Math.floor(a / columns)];
    return [ax + (xs[b % columns] - ax) * t, ay + (ys[Math.floor(b / columns)] - ay) * t];
  };
  const result = list.map(level => {
    const segments: number[][] = [], fullEdges = new Set<number>();
    const triangle = (a: number, b: number, c: number): void => {
      const equalA = values[a] === level, equalB = values[b] === level, equalC = values[c] === level;
      const count = Number(equalA) + Number(equalB) + Number(equalC);
      if (count === 3) return; // A coplanar plateau has no distinguished isoline interior.
      let first: [number, number], second: [number, number];
      if (count === 2) {
        const i = equalA ? a : b, j = equalC ? c : b;
        const edge = Math.min(i, j) * nodeCount + Math.max(i, j);
        if (fullEdges.has(edge)) return; // Shared level-valued grid/diagonal edge.
        fullEdges.add(edge);
        first = node(i); second = node(j);
      } else if (count === 1) {
        const vertex = equalA ? a : equalB ? b : c;
        const i = vertex === a ? b : a, j = vertex === c ? b : c;
        if ((values[i] < level) === (values[j] < level)) return; // Only a touching vertex.
        first = node(vertex); second = crossing(i, j, level);
      } else {
        const sideA = values[a] < level, sideB = values[b] < level, sideC = values[c] < level;
        if (sideA === sideB && sideB === sideC) return;
        if (sideA !== sideB && sideB !== sideC) {
          first = crossing(a, b, level); second = crossing(b, c, level);
        } else if (sideB !== sideC && sideC !== sideA) {
          first = crossing(b, c, level); second = crossing(c, a, level);
        } else {
          first = crossing(c, a, level); second = crossing(a, b, level);
        }
      }
      if (first[0] !== second[0] || first[1] !== second[1])
        segments.push([first[0], first[1], second[0], second[1]]);
    };
    for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns - 1; col++) {
      const a = row * columns + col, b = a + 1, c = a + columns, d = c + 1;
      triangle(a, b, c);
      triangle(b, d, c);
    }
    return { level, segments };
  });
  lastMeshContourKey = key;
  lastMeshContours = result;
  return result;
}

/** User placement uses canvas coordinates; local WEBGL vertices are relative to (320,320). */
export function drawContourRelief(p: Canvas, layer: Layer): void {
  const q = layer.params;
  validateContourRelief(q);
  const faces = q.faces === true, edges = q.edges === true && n(q, "edgeWeight") > 0;
  const contours = q.contours === true && n(q, "contourWeight") > 0;
  if (!faces && !edges && !contours) return;
  const field = contourReliefField(layer), { columns, rows, values } = field;
  const width = n(q, "width"), depth = n(q, "height"), scale = n(q, "heightScale");
  const x = (col: number) => -width / 2 + col * width / (columns - 1);
  const y = (row: number) => -depth / 2 + row * depth / (rows - 1);
  const z = (index: number) => values[index] * scale;
  const ink = (index: number): [number, number, number] => channels(layer.palette[index % layer.palette.length] ?? 0);
  p.push();
  try {
    p.translate(n(q, "centerX") - 320, n(q, "centerY") - 320, 0);
    if (faces || edges) {
      p.push();
      try {
        p.rotateY(n(q, "yaw") * degrees); p.rotateX(n(q, "pitch") * degrees); p.rotateZ(n(q, "roll") * degrees);
        if (faces) {
          p.noStroke();
          // Keep palette changes outside beginShape: p5 WebGL fill is a shape material, not a per-cell shader.
          const colors = Math.max(1, layer.palette.length);
          for (let band = 0; band < colors; band++) {
            p.fill(...ink(band), 235); p.beginShape(p.TRIANGLES);
            for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns - 1; col++) {
              const a = row * columns + col, b = a + 1, c = a + columns, d = c + 1;
              const mean = (values[a] + values[b] + values[c] + values[d]) / 4;
              const slope = Math.hypot((values[b] + values[d] - values[a] - values[c]) / (2 * width / (columns - 1)),
                (values[c] + values[d] - values[a] - values[b]) / (2 * depth / (rows - 1))) * Math.abs(scale);
              const index = q.faceColor === "height" ? Math.floor((Math.max(-2, Math.min(2, mean)) + 2) * colors / 4) :
                Math.floor(Math.min(.999, slope / 4) * colors);
              if (Math.min(colors - 1, index) !== band) continue;
              p.vertex(x(col), y(row), z(a)); p.vertex(x(col + 1), y(row), z(b)); p.vertex(x(col), y(row + 1), z(c));
              p.vertex(x(col + 1), y(row), z(b)); p.vertex(x(col + 1), y(row + 1), z(d)); p.vertex(x(col), y(row + 1), z(c));
            }
            p.endShape();
          }
        }
        if (edges) {
          p.noFill(); p.stroke(...ink(1), 160); p.strokeWeight(n(q, "edgeWeight"));
          for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
            const a = row * columns + col;
            if (col + 1 < columns) p.line(x(col), y(row), z(a), x(col + 1), y(row), z(a + 1));
            if (row + 1 < rows) p.line(x(col), y(row), z(a), x(col), y(row + 1), z(a + columns));
          }
        }
      } finally { p.pop(); }
    }
    if (contours) {
      p.push();
      try {
        // Display-only camera-facing lift precedes local rotation; source elevations stay exact.
        if (faces) p.translate(0, 0, .6);
        p.rotateY(n(q, "yaw") * degrees); p.rotateX(n(q, "pitch") * degrees); p.rotateZ(n(q, "roll") * degrees);
        p.noFill(); p.strokeWeight(n(q, "contourWeight"));
        for (const [index, contour] of contourReliefMeshContours(layer).entries()) {
          p.stroke(...ink(index + 2), 255);
          for (const [x1, y1, x2, y2] of contour.segments)
            p.line(x1, y1, contour.level * scale, x2, y2, contour.level * scale);
        }
      } finally { p.pop(); }
    }
  } finally { p.pop(); }
}
