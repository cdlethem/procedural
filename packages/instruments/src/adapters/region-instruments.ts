import {
  hatchRegionLines2D, regionClearance2D, selectTaperedStrokeStrips2D,
  SelectTaperedStrokeStrips2DError,
} from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";;
import { numeric, toggle, type StudioDefinition } from "./types.js";;

type Point = [number, number];
type Region = { outer: Point[]; holes: Point[][] };
type Params = Layer["params"];
type Painter = {
  width: number;
  push(): void; pop(): void; scale(x: number, y?: number): void;
  noStroke(): void; noFill(): void; strokeWeight(weight: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: unknown): void;
  CLOSE: unknown;
  drawingContext: {
    beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void;
    closePath(): void; fill(rule: "evenodd"): void; setLineDash(segments: number[]): void;
  };
  line(x1: number, y1: number, x2: number, y2: number): void;
};
const n = (q: Params, key: string) => Number(q[key]);





export const regionInstrumentDefinitions: StudioDefinition[] = [
  {
    id: "guarded-bands", title: "Guarded bands",
    description: "Seeded ordered ribbons retained only when their filled footprints leave the required clearance.",
    parameters: [numeric("candidateCount", "Candidates", "Ordered ribbon proposals; earlier candidates take precedence.", 1, 14, 1, { hardMin: 1, hardMax: 64, integer: true }),
      numeric("sourcePoints", "Points per ribbon", "Polyline resolution before actual strip selection.", 2, 8, 1, { hardMin: 2, hardMax: 80, integer: true }),
      numeric("length", "Length", "Positive span keeps adjacent trajectory points distinct.", 25, 620, 1, { hardMin: .01, hardMax: 4000, integer: false }),
      numeric("spacing", "Ribbon spacing", "Distance between ordered candidate center tracks; negative reverses their order.", -65, 85, 1, { hardMin: -4000, hardMax: 4000 }),
      numeric("amplitude", "Curvature", "Transverse wave amplitude of each trajectory.", 0, 80, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("frequency", "Wave cycles", "Cycles across the trajectory; negative reverses wave travel.", -2, 3, .05, { hardMin: -40, hardMax: 40 }),
      numeric("disorder", "Disorder", "Seeded irregularity in each trajectory and its placement.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
      numeric("direction", "Direction", "Rotate the ribbon family around its source center, in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("sourceCenterX", "Source X", "Horizontal center on the 720-unit canvas.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
      numeric("sourceCenterY", "Source Y", "Vertical center on the 720-unit canvas.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
      numeric("baseWidth", "Ribbon width", "Base filled width before taper and seeded variation.", 1, 65, 1, { hardMin: .01, hardMax: 1000 }),
      numeric("widthVariation", "Width variation", "Seeded relative change in width along each ribbon.", 0, .9, .02, { hardMin: 0, hardMax: 1 }),
      numeric("taper", "End taper", "Narrow both ends without changing the trajectory.", 0, .95, .025, { hardMin: 0, hardMax: .99 }),
      numeric("clearance", "Clearance", "Minimum gap between actual filled ribbons.", 0, 50, 1, { hardMin: 0, hardMax: 1000 }),
      toggle("fillRibbons", "Filled ribbons", "Paint selected filled footprints."),
      toggle("centerlines", "Centerlines", "Draw center paths inside selected strips."),
      toggle("outlines", "Outlines", "Trace selected filled boundaries."),
      numeric("weight", "Line weight", "Thickness of centerlines, outlines and optional rejected paths; zero hides all lines.", 0, 5, .1, { hardMin: 0, hardMax: 50 }),
      toggle("showRejected", "Rejected paths", "Show rejected candidates as dashed source centerlines.")],
    defaults: {candidateCount: 9,
      sourcePoints: 5,
      length: 495,
      spacing: 36,
      amplitude: 14,
      frequency: .85,
      disorder: .32,
      direction: -8,
      sourceCenterX: 360,
      sourceCenterY: 360,
      baseWidth: 22,
      widthVariation: .38,
      taper: .65,
      clearance: 9,
      fillRibbons: true,
      centerlines: false,
      outlines: false,
      weight: 1.2,
      showRejected: false},
    controlGroups: [
      { label: "Candidates", stage: "form", controls: ["candidateCount", "spacing", "clearance"] },
      { label: "Placement", stage: "frame", controls: ["sourceCenterX", "sourceCenterY", "length", "direction"] },
      { label: "Trajectory", stage: "process", controls: ["sourcePoints", "amplitude", "frequency", "disorder"] },
      { label: "Ribbon", stage: "material", controls: ["baseWidth", "widthVariation", "taper"] },
      { label: "Drawing", stage: "material", controls: ["fillRibbons", "centerlines", "outlines", "showRejected", "weight"] },
    ],
    validate: (q) => validateBands(q),
  },
  {
    id: "hatched-islands", title: "Hatched islands",
    description: "Seeded perforated silhouette with independently directed, clipped hatch fields.",
    parameters: [numeric("sourceCenterX", "Source X", "Horizontal center of the island on a 720-unit canvas.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
      numeric("sourceCenterY", "Source Y", "Vertical center of the island.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
      numeric("radius", "Radius", "Horizontal outer source radius.", 20, 330, 1, { hardMin: 1, hardMax: 2000 }),
      numeric("aspect", "Aspect", "Vertical radius divided by horizontal radius.", .12, 2, .02, { hardMin: .02, hardMax: 10 }),
      numeric("orientation", "Orientation", "Rotate the island and its hole placement in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("vertices", "Vertices", "Number of corners on the star-shaped outer polygon.", 5, 42, 1, { hardMin: 3, hardMax: 80, integer: true }),
      numeric("lobes", "Lobes", "Radial undulations around the source center.", 1, 12, 1, { hardMin: 1, hardMax: 30, integer: true }),
      numeric("irregularity", "Irregularity", "Seeded radial variation, from round to perforated shard.", 0, .8, .02, { hardMin: 0, hardMax: .95 }),
      numeric("holeCount", "Holes", "Exact requested number of disjoint perforations; impossible packing reports an error.", 0, 7, 1, { hardMin: 0, hardMax: 16, integer: true }),
      numeric("holeRadius", "Hole radius", "Radius of each perforation in source coordinates.", 3, 60, 1, { hardMin: .1, hardMax: 500 }),
      numeric("holeSpread", "Hole spread", "Maximum distance of hole centers from source center.", 0, 240, 1, { hardMin: 0, hardMax: 2000 }),
      numeric("spacing", "Primary spacing", "Spacing of the first hatch field.", 5, 70, 1, { hardMin: .5, hardMax: 4000 }),
      numeric("cross", "Cross spacing", "Spacing of the optional second hatch field.", 5, 100, 1, { hardMin: .5, hardMax: 4000 }),
      numeric("rotation", "Hatch direction", "First line family direction in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("twist", "Cross angle", "Second field direction relative to the first.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("phase", "Hatch phase", "Translation of primary scanlines in hatch-normal coordinates.", -100, 100, 1, { hardMin: -4000, hardMax: 4000 }),
      numeric("crossPhase", "Cross phase", "Independent translation of secondary scanlines.", -100, 100, 1, { hardMin: -4000, hardMax: 4000 }),
      numeric("weight", "Line weight", "Thickness of both hatch fields; zero hides hatch marks.", 0, 4, .1, { hardMin: 0, hardMax: 50 }),
      toggle("secondary", "Second field", "Include a crossing hatch field."),
      toggle("outline", "Boundary outline", "Draw the outer and hole boundaries."),
      toggle("regionFill", "Region fill", "Color just the island, leaving holes and surrounding canvas transparent.")],
    controlGroups: [
      { label: "Island", stage: "form", controls: ["vertices", "lobes", "irregularity"] },
      { label: "Placement", stage: "frame", controls: ["sourceCenterX", "sourceCenterY", "radius", "aspect", "orientation"] },
      { label: "Holes", stage: "form", controls: ["holeCount", "holeRadius", "holeSpread"] },
      { label: "Primary hatch", stage: "material", controls: ["spacing", "rotation", "phase"] },
      { label: "Cross hatch", stage: "material", controls: ["secondary", "cross", "twist", "crossPhase"] },
      { label: "Drawing", stage: "material", controls: ["weight", "outline", "regionFill"] },
    ],
    defaults: {sourceCenterX: 360,
      sourceCenterY: 355,
      radius: 245,
      aspect: .75,
      orientation: -12,
      vertices: 22,
      lobes: 5,
      irregularity: .26,
      holeCount: 3,
      holeRadius: 29,
      holeSpread: 115,
      spacing: 23,
      cross: 37,
      rotation: 16,
      twist: 106,
      phase: 7,
      crossPhase: 13,
      weight: 1.3,
      secondary: true,
      outline: true,
      regionFill: false},
    validate: (q) => validateIslands(q),
  },
];

function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return value;
}
function flag(q: Params, key: string): void {
  if (typeof q[key] !== "boolean") throw new Error(`${key} must be boolean`);
}
// Match the selector's exact algebra before allocating paths. Keep its documented WORK_LIMIT error.
const SELECT_WORK = 1_800_000;
function selectorWork(candidates: number, points: number): bigint {
  const c = BigInt(candidates), count = BigInt(points), e = 4n * count + 4n;
  const v = e * e + 16n * e + 16n;
  return c * (32n * count + v) + c * (c - 1n) * (v + e + 6n * e * e);
}
export function validateBands(q: Params): void {
  
  const count = checked(q, "candidateCount", 1, 64, true), points = checked(q, "sourcePoints", 2, 80, true);
  for (const [key, lo, hi] of [
    ["length", .01, 4000], ["spacing", -4000, 4000], ["amplitude", -2000, 2000],
    ["frequency", -40, 40], ["disorder", 0, 1], ["direction", -3600, 3600],
    ["sourceCenterX", -4000, 4000], ["sourceCenterY", -4000, 4000],
    ["baseWidth", .01, 1000], ["widthVariation", 0, 1], ["taper", 0, .99],
    ["clearance", 0, 1000], ["weight", 0, 50],
  ] as const) checked(q, key, lo, hi);
  for (const key of ["fillRibbons", "centerlines", "outlines", "showRejected"]) flag(q, key);
  if (selectorWork(count, points) > BigInt(SELECT_WORK)) throw new SelectTaperedStrokeStrips2DError("WORK_LIMIT");
}
export function validateIslands(q: Params): void {
  
  for (const [key, lo, hi] of [
    ["sourceCenterX", -4000, 4000], ["sourceCenterY", -4000, 4000], ["radius", 1, 2000],
    ["aspect", .02, 10], ["orientation", -3600, 3600], ["irregularity", 0, .95],
    ["holeRadius", .1, 500], ["holeSpread", 0, 2000], ["spacing", .5, 4000],
    ["cross", .5, 4000], ["rotation", -3600, 3600], ["twist", -3600, 3600],
    ["phase", -4000, 4000], ["crossPhase", -4000, 4000], ["weight", 0, 50],
  ] as const) checked(q, key, lo, hi);
  const vertices = checked(q, "vertices", 3, 80, true);
  checked(q, "lobes", 1, 30, true);
  const holes = checked(q, "holeCount", 0, 16, true);
  for (const key of ["secondary", "outline", "regionFill"]) flag(q, key);
  // Upper bound on two complete hatch fields, validation and polygon/placement checks.
  const edges = vertices + holes * 10;
  const span = 4 * n(q, "radius") * Math.max(1, n(q, "aspect"));
  const lines = Math.ceil(span / n(q, "spacing")) + (q.secondary ? Math.ceil(span / n(q, "cross")) : 0) + 4;
  if (edges * edges + lines * (8 * edges * edges + 16 * edges + 8) > 2_500_000)
    throw new Error("Island vertices × holes × hatch density exceeds work budget");
  const pathsPerLine = Math.floor(edges / 2);
  for (const spacing of q.secondary ? [n(q, "spacing"), n(q, "cross")] : [n(q, "spacing")])
    if ((Math.ceil(span / spacing) + 2) * pathsPerLine > 6000)
      throw new Error("Island extent × hatch density exceeds the 6000-fragment field budget");
}

type Candidate = { id: string; points: Point[]; widths: number[]; closed: boolean; cap: string; join: string; miterLimit: number };
export function bandCandidates(q: Params, seed: number): Candidate[] {
  validateBands(q);
  const count = n(q, "candidateCount"), points = n(q, "sourcePoints");
  const direction = n(q, "direction") * Math.PI / 180;
  const along: Point = [Math.cos(direction), Math.sin(direction)];
  const normal: Point = [-along[1], along[0]];
  const result: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    const random = new JavaRandom((seed + Math.imul(i + 1, 0x9e3779b9)) >>> 0);
    const phase = random.nextDouble() * Math.PI * 2;
    const jitter = (random.nextDouble() * 2 - 1) * n(q, "disorder") * Math.abs(n(q, "spacing")) * .35;
    const widthShift = random.nextDouble() * 2 - 1;
    const track: Point[] = [], widths: number[] = [];
    for (let j = 0; j < points; j++) {
      const t = j / (points - 1);
      const disturbance = (random.nextDouble() * 2 - 1) * n(q, "disorder") * n(q, "amplitude") * .7;
      const across = (i - (count - 1) / 2) * n(q, "spacing") + jitter +
        n(q, "amplitude") * Math.sin(Math.PI * 2 * n(q, "frequency") * t + phase) + disturbance;
      const forward = (t - .5) * n(q, "length");
      track.push([n(q, "sourceCenterX") + forward * along[0] + across * normal[0],
        n(q, "sourceCenterY") + forward * along[1] + across * normal[1]]);
      const pulse = .5 * widthShift + .5 * (random.nextDouble() * 2 - 1);
      widths.push(n(q, "baseWidth") * (1 + n(q, "widthVariation") * pulse) *
        (1 - n(q, "taper") * Math.abs(2 * t - 1)));
    }
    result.push({ id: `ribbon-${i}`, points: track, widths, closed: false,
      cap: "SQUARE", join: "BEVEL", miterLimit: 2 });
  }
  return result;
}
function cached<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const old = cache.get(key);
  if (old !== undefined) { cache.delete(key); cache.set(key, old); return old; }
  const result = make(); cache.set(key, result);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return result;
}
type BandSelection = { candidates: Candidate[]; accepted: { id: string; visible: { outer: Point[] }; centerline: Point[] }[]; rejected: { id: string; reason: string }[] };
const bandsCache = new Map<string, BandSelection>();
const BAND_STRUCTURE = ["candidateCount", "sourcePoints", "length", "spacing", "amplitude", "frequency", "disorder",
  "direction", "sourceCenterX", "sourceCenterY", "baseWidth", "widthVariation", "taper", "clearance"] as const;
export function bandSelection(q: Params, seed: number): BandSelection {
  validateBands(q);
  return cached(bandsCache, JSON.stringify([seed, ...BAND_STRUCTURE.map(key => q[key])]), () => {
    const candidates = bandCandidates(q, seed);
    return { ...selectTaperedStrokeStrips2D({ candidates, clearance: n(q, "clearance"), exclusions: [],
      maxAccepted: candidates.length, maxWork: SELECT_WORK }), candidates };
  });
}

const HOLE_VERTICES = 10, ATTEMPTS = 80;
function inRing(ring: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function edgeDistance(a: Point, b: Point, point: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const projection = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - a[0] - projection * dx, point[1] - a[1] - projection * dy);
}
export function islandSource(q: Params, seed: number): Region {
  validateIslands(q);
  const random = new JavaRandom(seed >>> 0);
  const angle = n(q, "orientation") * Math.PI / 180;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const vertices = n(q, "vertices"), irregularity = n(q, "irregularity");
  const phase = random.nextDouble() * Math.PI * 2;
  const outer: Point[] = [];
  for (let i = 0; i < vertices; i++) {
    const theta = i * Math.PI * 2 / vertices;
    const radial = 1 + irregularity * (.64 * Math.sin(n(q, "lobes") * theta + phase) +
      .36 * (random.nextDouble() * 2 - 1));
    const x = n(q, "radius") * radial * Math.cos(theta);
    const y = n(q, "radius") * n(q, "aspect") * radial * Math.sin(theta);
    outer.push([n(q, "sourceCenterX") + x * cosine - y * sine,
      n(q, "sourceCenterY") + x * sine + y * cosine]);
  }
  const holes: Point[][] = [], centers: Point[] = [];
  const r = n(q, "holeRadius"), spread = n(q, "holeSpread");
  for (let hole = 0; hole < n(q, "holeCount"); hole++) {
    let placed = false;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const bearing = random.nextDouble() * Math.PI * 2;
      const distance = Math.sqrt(random.nextDouble()) * spread;
      const center: Point = [n(q, "sourceCenterX") + distance * Math.cos(bearing),
        n(q, "sourceCenterY") + distance * Math.sin(bearing)];
      if (!inRing(outer, center) || outer.some((a, i) => edgeDistance(a, outer[(i + 1) % vertices], center) <= r * 1.02) ||
        centers.some(other => Math.hypot(other[0] - center[0], other[1] - center[1]) <= 2 * r * 1.02)) continue;
      const offset = random.nextDouble() * Math.PI * 2;
      holes.push(Array.from({ length: HOLE_VERTICES }, (_, j): Point => [
        center[0] + r * Math.cos(offset + j * Math.PI * 2 / HOLE_VERTICES),
        center[1] + r * Math.sin(offset + j * Math.PI * 2 / HOLE_VERTICES),
      ]));
      centers.push(center); placed = true; break;
    }
    if (!placed) throw new Error(`Cannot place ${n(q, "holeCount")} disjoint holes strictly inside this island; adjust hole radius or spread`);
  }
  // Reuse the core's exact ring, crossing, and strict-hole checks before hatching.
  // An external disjoint probe gives regionClearance2D a valid comparison region.
  const probe: Region = { outer: [[100000, 100000], [100001, 100000], [100000, 100001]], holes: [] };
  regionClearance2D({ a: { outer, holes }, b: probe, maxWork: 250_000 });
  return { outer, holes };
}
const sourceCache = new Map<string, Region>();
const ISLAND_STRUCTURE = ["sourceCenterX", "sourceCenterY", "radius", "aspect", "orientation", "vertices", "lobes",
  "irregularity", "holeCount", "holeRadius", "holeSpread"] as const;
function source(q: Params, seed: number): Region {
  return cached(sourceCache, JSON.stringify([seed, ...ISLAND_STRUCTURE.map(key => q[key])]), () => islandSource(q, seed));
}
const hatchCache = new Map<string, { region: Region; fields: Point[][][] }>();
export function islandHatching(q: Params, seed: number) {
  validateIslands(q);
  const key = JSON.stringify([seed, ...ISLAND_STRUCTURE.map(k => q[k]), q.spacing, q.cross, q.rotation,
    q.twist, q.phase, q.crossPhase, q.secondary]);
  return cached(hatchCache, key, () => {
    const region = source(q, seed);
    const angles = [n(q, "rotation"), n(q, "rotation") + n(q, "twist")];
    const fields = angles.slice(0, q.secondary ? 2 : 1).map((angle, i) => {
      const rad = angle * Math.PI / 180;
      return hatchRegionLines2D({ region, origin: [0, 0], direction: [Math.cos(rad), Math.sin(rad)],
        spacing: n(q, i ? "cross" : "spacing"), phase: n(q, i ? "crossPhase" : "phase"),
        maxWork: 2_500_000, maxOutputPaths: 6000 }).paths as Point[][];
    });
    return { region, fields };
  });
}
function paint(p: Painter, layer: Layer, index: number, alpha: number, fillColor = false): void {
  const rgb = layer.palette[index % layer.palette.length] >>> 0;
  const parts: [number, number, number, number] = [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha];
  if (fillColor) p.fill(...parts); else p.stroke(...parts);
}
function polygon(p: Painter, vertices: Point[], close = false): void {
  p.beginShape();
  for (const [x, y] of vertices) p.vertex(x, y);
  p.endShape(close ? p.CLOSE : undefined);
}
function fillRegion(p: Painter, region: Region): void {
  const ctx = p.drawingContext;
  ctx.beginPath();
  for (const ring of [region.outer, ...region.holes]) {
    ctx.moveTo(...ring[0]);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(...ring[i]);
    ctx.closePath();
  }
  ctx.fill("evenodd");
}
export function drawRegionInstrument(p: Painter, layer: Layer): void {
  const q = layer.params;
  if (layer.technique === "guarded-bands") {
    validateBands(q);
    if (!q.fillRibbons && (n(q, "weight") === 0 || (!q.centerlines && !q.outlines && !q.showRejected))) return;
    const model = bandSelection(q, layer.seed);
    p.push(); p.scale(p.width / 720);
    for (const [i, strip] of model.accepted.entries()) {
      if (q.fillRibbons) { p.noStroke(); paint(p, layer, i + 1, 220, true); polygon(p, strip.visible.outer as Point[], true); }
      if (n(q, "weight") > 0) {
        p.noFill(); p.strokeWeight(n(q, "weight")); paint(p, layer, 0, 230);
        if (q.outlines) polygon(p, strip.visible.outer as Point[], true);
        if (q.centerlines) polygon(p, strip.centerline as Point[]);
      }
    }
    if (q.showRejected && n(q, "weight") > 0) {
      const rejected = new Set(model.rejected.map(item => item.id));
      p.noFill(); p.strokeWeight(n(q, "weight")); paint(p, layer, 0, 130);
      p.drawingContext.setLineDash([4, 6]);
      for (const candidate of model.candidates) if (rejected.has(candidate.id)) polygon(p, candidate.points);
      p.drawingContext.setLineDash([]);
    }
    p.pop();
  } else if (layer.technique === "hatched-islands") {
    validateIslands(q);
    if (!q.regionFill && n(q, "weight") === 0) return;
    const model = n(q, "weight") > 0 ? islandHatching(q, layer.seed) : { region: source(q, layer.seed), fields: [] };
    p.push(); p.scale(p.width / 720);
    if (q.regionFill) { p.noStroke(); paint(p, layer, 2, 180, true); fillRegion(p, model.region); }
    if (q.outline && n(q, "weight") > 0) {
      p.noFill(); p.strokeWeight(n(q, "weight")); paint(p, layer, 0, 210);
      polygon(p, model.region.outer, true);
      for (const hole of model.region.holes) polygon(p, hole, true);
    }
    if (n(q, "weight") > 0) {
      p.strokeWeight(n(q, "weight"));
      model.fields.forEach((field, index) => {
        paint(p, layer, index, 215);
        for (const segment of field) p.line(...segment[0], ...segment[1]);
      });
    }
    p.pop();
  }
}
