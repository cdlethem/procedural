import { clipSegmentsSimplePolygon2D, gradientNoise2D01 } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

const TAU = 2 * Math.PI;
type Point = [number, number];
type Segment = [number, number, number, number];
type Ink = { noFill(): void; strokeCap(cap: string): void; strokeWeight(width: number): void;
  stroke(red: number, green: number, blue: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  ROUND: string; SQUARE: string };
const num = (key: string, label: string, description: string, min: number, max: number,
  step: number, hardMin = min, hardMax = max, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
const v = (q: Layer["params"], key: string) => Number(q[key]);
function rectangle(cx: number, cy: number, width: number, height: number): Point[] {
  return [[cx - width / 2, cy - height / 2], [cx + width / 2, cy - height / 2],
    [cx + width / 2, cy + height / 2], [cx - width / 2, cy + height / 2]];
}
function clip(segments: Segment[], polygon: Point[]): Segment[] {
  if (!segments.length) return [];
  // Four polygon edges: the core's documented bound for this convex footprint.
  return clipSegmentsSimplePolygon2D({ segments, polygon,
    maxWork: 16 + segments.length * 200, maxOutputSegments: segments.length }).toValues().segments as Segment[];
}
function validateRange(q: Layer["params"], key: string, low: number, high: number, integer = false): void {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${low} and ${high}`);
}
function validateCommon(q: Layer["params"]): void {
  validateRange(q, "centerX", -1000, 1600); validateRange(q, "centerY", -1000, 1600);
  validateRange(q, "width", 1, 1600); validateRange(q, "height", 1, 1600);
}

/** Screens A and B share one control set; only the key suffix differs. */
const screenGroup = (label: string, suffix: "A" | "B"): ControlGroup => ({ label, controls: [`enable${suffix}`, `pitch${suffix}`,
  `angle${suffix}`, `phase${suffix}`, { label: "Offset", controls: [`offsetX${suffix}`, `offsetY${suffix}`] },
  { label: "Wave", controls: [`curve${suffix}`, `frequency${suffix}`] }, `weight${suffix}`] });

export const weaveScreenDefinitions: StudioDefinition[] = [
  {
    id: "woven-strands", title: "Woven Strands",
    description: "Two ink strand families cross on the same warped lattice; the lower path is truly interrupted at each junction.",
    parameters: [
      num("rows", "Horizontal strands", "Number of row paths; one makes a sparse strip.", 2, 24, 1, 1, 64, true),
      num("columns", "Vertical strands", "Number of column paths; one makes a sparse strip.", 2, 24, 1, 1, 64, true),
      num("spacing", "Cell spacing", "Horizontal distance between neighboring lattice junctions in pixels.", 10, 35, 1, 3, 200),
      num("aspect", "Cell aspect", "Vertical spacing as a multiple of horizontal spacing.", .5, 2, .05, .4, 2),
      num("skew", "Lattice skew", "Horizontal shear per vertical spacing; leaves every row/column sharing its junctions.", -.45, .45, .02, -.6, .6),
      num("warp", "Broad warp", "Seeded low-frequency junction displacement as a fraction of the smaller cell spacing.", 0, .06, .005, 0, .06),
      num("warpFrequency", "Warp scale", "Broad field cycles over the lattice.", .3, 2, .1, .1, 3),
      num("disorder", "Junction disorder", "Independent seeded junction displacement as a fraction of the smaller cell spacing.", 0, .04, .005, 0, .04),
      choice("sequence", "Over/under sequence", "Seeded generates a repeating crossing pattern; checker alternates; twill advances diagonally; binary uses your written sequence.", ["seeded", "checker", "twill", "binary"]),
      num("repeat", "Pattern repeat", "Side length of the seeded crossing tile, or cycle of the diagonal twill.", 2, 8, 1, 2, 16, true),
      num("phase", "Sequence phase", "Shift over/under ordering without moving the lattice.", -8, 8, 1, -128, 128, true),
      text("binary", "Binary repeat", "0 makes a row pass over; 1 makes a column pass over. Repeats across columns, advances once per row.", 32),
      num("clearance", "Crossing clearance", "Visible gap beyond the crossing widths and rounded lower-path caps, in pixels.", 0, 5, .25, 0, 24),
      num("rowWidth", "Row ink width", "Stroke width of horizontal strands; zero hides only those marks.", .5, 7, .25, 0, 20),
      num("columnWidth", "Column ink width", "Stroke width of vertical strands; zero hides only those marks.", .5, 7, .25, 0, 20),
      num("rowColor", "Row palette slot", "Palette entry for horizontal strands (zero-based).", 0, 4, 1, 0, 15, true),
      num("columnColor", "Column palette slot", "Palette entry for vertical strands (zero-based).", 0, 4, 1, 0, 15, true),
      num("width", "Source width", "Crop the strand lattice to this local footprint width.", 100, 640, 5, 1, 1600),
      num("height", "Source height", "Crop the strand lattice to this local footprint height.", 100, 640, 5, 1, 1600),
      num("centerX", "Source X", "Local footprint and lattice center X.", 100, 540, 5, -1000, 1600),
      num("centerY", "Source Y", "Local footprint and lattice center Y.", 100, 540, 5, -1000, 1600),
    ],
    controlGroups: [
      { label: "Lattice", controls: [{ label: "Strands", controls: ["rows", "columns"], proportional: true }, "spacing", "aspect", "skew"] },
      { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
      { label: "Disorder", controls: ["warp", "warpFrequency", "disorder"] },
      { label: "Crossings", controls: ["sequence", "repeat", "phase", "binary", "clearance"] },
      { label: "Ink", controls: [{ label: "Line weights", controls: ["rowWidth", "columnWidth"], proportional: true },
        { label: "Palette", controls: ["rowColor", "columnColor"] }] },
    ],
    defaults: { rows: 17, columns: 17, spacing: 29, aspect: 1, skew: .12, warp: .025,
      warpFrequency: 1, disorder: .012, sequence: "seeded", repeat: 4, phase: 0, binary: "0011",
      clearance: 1.4, rowWidth: 7, columnWidth: 5, rowColor: 0, columnColor: 1,
      width: 520, height: 520, centerX: 320, centerY: 320 },
    validate: validateWovenStrands,
  },
  {
    id: "registered-screens", title: "Registered Screens",
    description: "Two independently positioned line screens compose optical beats through real registration and rotation.",
    parameters: [
      toggle("enableA", "Screen A", "Show the first screen."), toggle("enableB", "Screen B", "Show the second screen."),
      num("pitchA", "A pitch", "Perpendicular line spacing of screen A.", 8, 32, .5, 3, 160),
      num("angleA", "A direction", "Direction of lines in screen A, degrees.", -90, 90, .5, -360, 360),
      num("phaseA", "A phase", "Normal displacement of A's lines, in pixels.", -30, 30, .25, -1600, 1600),
      num("offsetXA", "A offset X", "Move A's center relative to the common footprint.", -45, 45, 1, -800, 800),
      num("offsetYA", "A offset Y", "Move A's center relative to the common footprint.", -45, 45, 1, -800, 800),
      num("curveA", "A bend", "Normal wave displacement of A's lines in pixels; zero makes straight lines.", 0, 20, .5, 0, 100),
      num("frequencyA", "A wave cycles", "Wave cycles per longest footprint dimension.", .2, 3, .1, .1, 12),
      num("weightA", "A line weight", "A stroke width; zero leaves A unpainted.", .4, 3, .1, 0, 20),
      num("pitchB", "B pitch", "Perpendicular line spacing of screen B.", 8, 32, .5, 3, 160),
      num("angleB", "B direction", "Small differences from A yield long optical beats.", -90, 90, .5, -360, 360),
      num("phaseB", "B phase", "Slide B through A without changing either screen's pitch.", -30, 30, .25, -1600, 1600),
      num("offsetXB", "B offset X", "Move B's center relative to the common footprint.", -45, 45, 1, -800, 800),
      num("offsetYB", "B offset Y", "Move B's center relative to the common footprint.", -45, 45, 1, -800, 800),
      num("curveB", "B bend", "Normal wave displacement of B's lines in pixels.", 0, 20, .5, 0, 100),
      num("frequencyB", "B wave cycles", "Wave cycles per longest footprint dimension.", .2, 3, .1, .1, 12),
      num("weightB", "B line weight", "B stroke width; zero leaves B unpainted.", .4, 3, .1, 0, 20),
      num("width", "Source width", "Width of the shared screen clipping footprint.", 100, 640, 5, 1, 1600),
      num("height", "Source height", "Height of the shared screen clipping footprint.", 100, 640, 5, 1, 1600),
      num("centerX", "Source X", "Shared footprint center X.", 100, 540, 5, -1000, 1600),
      num("centerY", "Source Y", "Shared footprint center Y.", 100, 540, 5, -1000, 1600),
    ],
    controlGroups: [
      screenGroup("Screen A", "A"),
      screenGroup("Screen B", "B"),
      { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
    ],
    defaults: { enableA: true, enableB: true, pitchA: 16, angleA: 0, phaseA: 0,
      offsetXA: 0, offsetYA: 0, curveA: 0, frequencyA: 1.2, weightA: 1.5,
      pitchB: 16.4, angleB: 5, phaseB: 6, offsetXB: 0, offsetYB: 0,
      curveB: 0, frequencyB: 1.2, weightB: 1.5, width: 500, height: 490, centerX: 320, centerY: 320 },
    validate: validateRegisteredScreens,
  },
];

export function validateWovenStrands(q: Layer["params"]): void {
  validateCommon(q);
  validateRange(q, "rows", 1, 64, true); validateRange(q, "columns", 1, 64, true);
  validateRange(q, "spacing", 3, 200); validateRange(q, "aspect", .4, 2);
  validateRange(q, "skew", -.6, .6); validateRange(q, "warp", 0, .06);
  validateRange(q, "warpFrequency", .1, 3); validateRange(q, "disorder", 0, .04);
  validateRange(q, "repeat", 2, 16, true); validateRange(q, "phase", -128, 128, true);
  validateRange(q, "clearance", 0, 24);
  validateRange(q, "rowWidth", 0, 20); validateRange(q, "columnWidth", 0, 20);
  validateRange(q, "rowColor", 0, 15, true); validateRange(q, "columnColor", 0, 15, true);
  if (!["seeded", "checker", "twill", "binary"].includes(String(q.sequence))) throw Error("Unknown over/under sequence");
  if (typeof q.binary !== "string" || !/^[01]{1,32}$/.test(q.binary)) throw Error("Binary repeat must contain 1–32 digits, only 0 or 1");
  // At most 4096 junctions, 8192 edge segments and 4096 deleted intervals. No hidden resampling.
  if (v(q, "rows") * v(q, "columns") > 1600) throw Error("Reduce rows or columns: woven lattice exceeds 1600 junctions");
  // The node perturbation on either axis is at most .1 of the smaller pitch: even neighboring
  // displacements at opposite extremes preserve a positive cell determinant for |skew|<=.6.
}

function rowOver(q: Layer["params"], row: number, column: number, pattern: readonly boolean[] | null): boolean {
  if (pattern) {
    const repeat = v(q, "repeat"), shifted = ((column + v(q, "phase")) % repeat + repeat) % repeat;
    return pattern[(row % repeat) * repeat + shifted];
  }
  if (q.sequence === "checker") return ((row + column + v(q, "phase")) % 2 + 2) % 2 === 0;
  if (q.sequence === "twill") return ((column - row + v(q, "phase")) % v(q, "repeat") + v(q, "repeat")) % v(q, "repeat") < Math.ceil(v(q, "repeat") / 2);
  const binary = String(q.binary);
  return binary[((column + row + v(q, "phase")) % binary.length + binary.length) % binary.length] === "0";
}

/** Shared node positions: row and column paths refer to the identical junction object. */
export function wovenLattice(q: Layer["params"], seed: number): Point[][] {
  validateWovenStrands(q);
  const rows = v(q, "rows"), columns = v(q, "columns"), pitchX = v(q, "spacing"), pitchY = pitchX * v(q, "aspect");
  const small = Math.min(pitchX, pitchY), frequency = v(q, "warpFrequency");
  const warp = v(q, "warp") * small, disorder = v(q, "disorder") * small;
  const random = disorder ? new JavaRandom(seed) : undefined;
  const fieldX = warp ? gradientNoise2D01({ seed }) : undefined;
  const fieldY = warp ? gradientNoise2D01({ seed: seed ^ 0x24af31c5 }) : undefined;
  const centerX = v(q, "centerX"), centerY = v(q, "centerY"), skew = v(q, "skew");
  const points: Point[][] = [];
  for (let row = 0; row < rows; row++) {
    const current: Point[] = []; points.push(current);
    for (let column = 0; column < columns; column++) {
      const u = column / Math.max(1, columns - 1), w = row / Math.max(1, rows - 1);
      const jitterX = random ? (random.nextDouble() * 2 - 1) * disorder : 0;
      const jitterY = random ? (random.nextDouble() * 2 - 1) * disorder : 0;
      const yy = (row - (rows - 1) / 2) * pitchY;
      current.push([centerX + (column - (columns - 1) / 2) * pitchX + yy * skew
        + (fieldX ? (fieldX.sample(u * frequency + 7, w * frequency + 11) * 2 - 1) * warp : 0) + jitterX,
      centerY + yy + (fieldY ? (fieldY.sample(u * frequency + 23, w * frequency + 29) * 2 - 1) * warp : 0) + jitterY]);
    }
  }
  return points;
}
function direction(a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  return [dx / length, dy / length];
}
function tangent(path: Point[], index: number): Point {
  return direction(path[Math.max(0, index - 1)], path[Math.min(path.length - 1, index + 1)]);
}
function lerp(a: Point, b: Point, fraction: number): Point {
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
}
/** Delete intervals in travel distance, then reconstruct actual retained polyline fragments. */
function retained(path: Point[], distance: number[], gaps: [number, number][]): Segment[] {
  if (path.length < 2) return [];
  const result: Segment[] = [];
  for (let i = 1; i < path.length; i++) {
    const start = distance[i - 1], end = distance[i], segmentLength = end - start;
    let cursor = start;
    for (const [low, high] of gaps) {
      if (low >= end) break;
      if (high <= cursor) continue;
      const stop = Math.min(end, low);
      if (stop > cursor) {
        const a = lerp(path[i - 1], path[i], (cursor - start) / segmentLength);
        const b = lerp(path[i - 1], path[i], (stop - start) / segmentLength);
        result.push([a[0], a[1], b[0], b[1]]);
      }
      cursor = Math.max(cursor, high);
      if (cursor >= end) break;
    }
    if (cursor < end) {
      const a = lerp(path[i - 1], path[i], (cursor - start) / segmentLength);
      result.push([a[0], a[1], path[i][0], path[i][1]]);
    }
  }
  return result;
}

/** Geometry is independent of palette, widths, clearance and over/under sequence. */
export function wovenFragments(q: Layer["params"], seed: number): { rows: Segment[]; columns: Segment[] } {
  const lattice = wovenLattice(q, seed), rowCount = lattice.length, columnCount = lattice[0].length;
  const polygon = rectangle(v(q, "centerX"), v(q, "centerY"), v(q, "width"), v(q, "height"));
  const rowPaths = lattice, columnPaths = Array.from({ length: columnCount }, (_, c) => lattice.map(row => row[c]));
  const rowGaps: [number, number][][] = rowPaths.map(() => []);
  const columnGaps: [number, number][][] = columnPaths.map(() => []);
  const rowDistance = rowPaths.map(path => cumulative(path));
  const columnDistance = columnPaths.map(path => cumulative(path));
  let pattern: boolean[] | null = null;
  if (q.sequence === "seeded") {
    const random = new JavaRandom((seed ^ 0x569ac127) >>> 0);
    pattern = Array.from({length: v(q, "repeat") ** 2}, () => random.nextDouble() < .5);
  }
  for (let r = 0; r < rowCount; r++) for (let c = 0; c < columnCount; c++) {
    if (rowCount < 2 || columnCount < 2) continue;
    const rowTangent = tangent(rowPaths[r], c), columnTangent = tangent(columnPaths[c], r);
    const sine = Math.abs(rowTangent[0] * columnTangent[1] - rowTangent[1] * columnTangent[0]);
    const rowAbove = rowOver(q, r, c, pattern), lowerWidth = v(q, rowAbove ? "columnWidth" : "rowWidth"),
      upperWidth = v(q, rowAbove ? "rowWidth" : "columnWidth");
    if (upperWidth === 0) continue;
    // Project both the upper stroke and the lower round cap onto the lower path;
    // add explicit clearance along travel. This remains safe at shallow angles.
    const halfGap = (upperWidth + lowerWidth) / (2 * sine) + v(q, "clearance");
    const distances = rowAbove ? columnDistance[c] : rowDistance[r];
    (rowAbove ? columnGaps[c] : rowGaps[r]).push([distances[rowAbove ? r : c] - halfGap,
      distances[rowAbove ? r : c] + halfGap]);
  }
  const rows = rowPaths.flatMap((path, index) => retained(path, rowDistance[index], rowGaps[index]));
  const columns = columnPaths.flatMap((path, index) => retained(path, columnDistance[index], columnGaps[index]));
  return { rows: clip(rows, polygon), columns: clip(columns, polygon) };
}
function cumulative(path: Point[]): number[] {
  const distances = [0];
  for (let i = 1; i < path.length; i++) distances.push(distances[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return distances;
}

function screenSettings(q: Layer["params"], family: "A" | "B") {
  return { enabled: q[`enable${family}`], pitch: v(q, `pitch${family}`), angle: v(q, `angle${family}`),
    phase: v(q, `phase${family}`), offsetX: v(q, `offsetX${family}`), offsetY: v(q, `offsetY${family}`),
    curve: v(q, `curve${family}`), frequency: v(q, `frequency${family}`), weight: v(q, `weight${family}`) };
}
function screenCount(q: Layer["params"], family: "A" | "B"): { lines: number; steps: number; first: number; travel: number } {
  const s = screenSettings(q, family), angle = s.angle * Math.PI / 180,
    nx = -Math.sin(angle), ny = Math.cos(angle);
  const halfNormal = (Math.abs(nx) * v(q, "width") + Math.abs(ny) * v(q, "height")) / 2 + s.curve
    + Math.abs(nx * s.offsetX + ny * s.offsetY) + s.pitch;
  const first = Math.ceil((-halfNormal - s.phase) / s.pitch), last = Math.floor((halfNormal - s.phase) / s.pitch);
  const travel = Math.hypot(v(q, "width"), v(q, "height")) / 2 + Math.hypot(s.offsetX, s.offsetY) + s.curve + s.pitch;
  const steps = s.curve === 0 ? 1 : Math.ceil(16 * s.frequency * 2 * travel / Math.max(v(q, "width"), v(q, "height")));
  return { lines: last - first + 1, first, steps, travel };
}
export function validateRegisteredScreens(q: Layer["params"]): void {
  validateCommon(q);
  let segments = 0;
  for (const family of ["A", "B"] as const) {
    if (typeof q[`enable${family}`] !== "boolean") throw Error(`enable${family} must be boolean`);
    validateRange(q, `pitch${family}`, 3, 160); validateRange(q, `angle${family}`, -360, 360);
    validateRange(q, `phase${family}`, -1600, 1600);
    validateRange(q, `offsetX${family}`, -800, 800); validateRange(q, `offsetY${family}`, -800, 800);
    validateRange(q, `curve${family}`, 0, 100); validateRange(q, `frequency${family}`, .1, 12);
    validateRange(q, `weight${family}`, 0, 20);
    if (q[`enable${family}`] && v(q, `weight${family}`) > 0) {
      const { lines, steps } = screenCount(q, family);
      segments += lines * steps;
    }
  }
  // 12,000 input segments; 4-edge core clipping costs at most 2,400,016 work and
  // convex footprints return at most one piece per input. Reject instead of thinning.
  if (segments > 12000) throw Error("Reduce screen density, curvature frequency or footprint size: 12000 segment budget exceeded");
}
/** Real line segments clipped to the shared rectangle; no raster, summed field or panel. */
export function registeredScreenSegments(q: Layer["params"], family: "A" | "B"): Segment[] {
  validateRegisteredScreens(q);
  const s = screenSettings(q, family);
  if (!s.enabled || s.weight === 0) return [];
  const { lines, first, steps, travel } = screenCount(q, family);
  const radians = s.angle * Math.PI / 180, dx = Math.cos(radians), dy = Math.sin(radians), nx = -dy, ny = dx;
  const input: Segment[] = [];
  for (let line = 0; line < lines; line++) {
    const shift = (first + line) * s.pitch + s.phase;
    let previous: Point | undefined;
    for (let step = 0; step <= steps; step++) {
      const t = -travel + 2 * travel * step / steps;
      const normal = shift + s.curve * Math.sin(TAU * s.frequency * t / Math.max(v(q, "width"), v(q, "height")));
      const next: Point = [v(q, "centerX") + s.offsetX + dx * t + nx * normal,
        v(q, "centerY") + s.offsetY + dy * t + ny * normal];
      if (previous) input.push([previous[0], previous[1], next[0], next[1]]);
      previous = next;
    }
  }
  return clip(input, rectangle(v(q, "centerX"), v(q, "centerY"), v(q, "width"), v(q, "height")));
}

export function drawWeaveScreen(p: Ink, layer: Layer): void {
  const q = layer.params;
  p.noFill();
  if (layer.technique === "woven-strands") {
    const fragments = wovenFragments(q, layer.seed);
    p.strokeCap(p.ROUND);
    for (const [family, widthKey, colorKey] of [[fragments.rows, "rowWidth", "rowColor"],
      [fragments.columns, "columnWidth", "columnColor"]] as const) {
      if (v(q, widthKey) === 0 || !family.length) continue;
      p.strokeWeight(v(q, widthKey)); p.stroke(...channels(layer.palette[v(q, colorKey) % layer.palette.length]));
      for (const segment of family) p.line(...segment);
    }
  } else if (layer.technique === "registered-screens") {
    validateRegisteredScreens(q);
    p.strokeCap(p.SQUARE);
    for (const [family, color] of [["A", 0], ["B", 1]] as const) {
      const segments = registeredScreenSegments(q, family);
      if (!segments.length) continue;
      p.strokeWeight(v(q, `weight${family}`)); p.stroke(...channels(layer.palette[color % layer.palette.length]));
      for (const segment of segments) p.line(...segment);
    }
  } else throw Error(`Unknown weave/screen instrument: ${layer.technique}`);
}
