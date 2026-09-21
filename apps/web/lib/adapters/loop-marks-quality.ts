import type { Layer } from "../studio-types";
import { closedSpline2D } from "@procedurals/javascript"

type Params = Layer["params"];
type Point = [number, number];
type Layout = "row" | "grid" | "nested";
type Treatment = "outline" | "tiles" | "fans" | "outline-tiles";
type TileShape = "bar" | "diamond" | "tick";
type LoopRecord = { center: Point; points: Point[]; length: number; cumulative: number[] };
const WORK_LIMIT = 12_000;

function number(params: Params, key: string, min: number, max: number, integer = false): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function member<T extends string>(params: Params, key: string, values: readonly T[]): T {
  const value = params[key];
  if (!values.includes(value as T)) throw new Error(`${key} must be one of ${values.join(", ")}`);
  return value as T;
}
function options(params: Params) {
  const layout = member(params, "layout", ["row", "grid", "nested"] as const);
  const treatment = member(params, "treatment", ["outline", "tiles", "fans", "outline-tiles"] as const);
  const tileShape = member(params, "tileShape", ["bar", "diamond", "tick"] as const);
  return {
    layout, treatment, tileShape,
    loopCount: number(params, "loopCount", 1, 16, true),
    columns: number(params, "columns", 1, 8, true),
    spacingX: number(params, "spacingX", 10, 500),
    spacingY: number(params, "spacingY", 10, 500),
    centerX: number(params, "centerX", -320, 960),
    centerY: number(params, "centerY", -320, 960),
    radiusX: number(params, "radiusX", 4, 500),
    radiusY: number(params, "radiusY", 4, 500),
    nestedScale: number(params, "nestedScale", .2, 1),
    knotCount: number(params, "knotCount", 5, 16, true),
    lobes: number(params, "lobes", 0, 12, true),
    lobeDepth: number(params, "lobeDepth", 0, .8),
    phase: number(params, "phase", -180, 180),
    subdivisions: number(params, "subdivisions", 8, 64, true),
    tileSpacing: number(params, "tileSpacing", 4, 80),
    tileWidth: number(params, "tileWidth", 1, 80),
    tileHeight: number(params, "tileHeight", 1, 80),
    outlineWeight: number(params, "outlineWeight", .1, 12),
    fanOpacity: number(params, "fanOpacity", 0, 255),
  };
}

export function validateLoopMarks(params: Params): void {
  if (params.legacy === true) return;
  buildLoopMarks(params);
}

function centerAt(q: ReturnType<typeof options>, index: number): [Point, number] {
  if (q.layout === "row")
    return [[q.centerX + (index - (q.loopCount - 1) / 2) * q.spacingX,
      q.centerY + (index - (q.loopCount - 1) / 2) * q.spacingY], 1];
  if (q.layout === "nested") return [[q.centerX, q.centerY], q.nestedScale ** index];
  const row = Math.floor(index / q.columns), rowStart = row * q.columns;
  const rowCount = Math.min(q.columns, q.loopCount - rowStart);
  const column = index - rowStart, rows = Math.ceil(q.loopCount / q.columns);
  return [[q.centerX + (column - (rowCount - 1) / 2) * q.spacingX,
    q.centerY + (row - (rows - 1) / 2) * q.spacingY], 1];
}

/** Base knots shape a closed spline; lobes displace its densely sampled contour. */
export function buildLoopMarks(params: Params): { loops: LoopRecord[]; tileCounts: number[]; work: number } {
  const q = options(params), loops: LoopRecord[] = [], tileCounts: number[] = [];
  const sampleCount = q.knotCount * q.subdivisions;
  const drawsOutline = q.treatment === "outline" || q.treatment === "outline-tiles";
  const drawsTiles = q.treatment === "tiles" || q.treatment === "outline-tiles";
  const drawsFans = q.treatment === "fans";
  let work = q.loopCount * sampleCount * (1 + Number(drawsOutline) + Number(drawsFans));
  if (work > WORK_LIMIT) throw new Error("Loop marks sampled-contour work budget exceeded");
  for (let index = 0; index < q.loopCount; index++) {
    const [center, scale] = centerAt(q, index), [cx, cy] = center;
    const controls: Point[] = Array.from({ length: q.knotCount }, (_, knot) => {
      const angle = 2 * Math.PI * knot / q.knotCount;
      return [cx + q.radiusX * scale * Math.cos(angle), cy + q.radiusY * scale * Math.sin(angle)];
    });
    const spline = closedSpline2D({ controls, subdivisions: q.subdivisions });
    const points: Point[] = Array.from({ length: sampleCount }, (_, sample) => {
      const base = spline.sampleParameter(sample / q.subdivisions);
      const angle = 2 * Math.PI * sample / sampleCount;
      const modulation = q.lobes === 0 ? 1 :
        1 + q.lobeDepth * Math.cos(q.lobes * angle + q.phase * Math.PI / 180 + index * 2 * Math.PI / q.loopCount);
      return [cx + (base.x - cx) * modulation, cy + (base.y - cy) * modulation];
    });
    const cumulative = [0];
    for (let sample = 0; sample < sampleCount; sample++) {
      const a = points[sample], b = points[(sample + 1) % sampleCount];
      cumulative.push(cumulative[sample] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const length = cumulative[sampleCount];
    const tileCount = drawsTiles && length > 0 ? Math.ceil(length / q.tileSpacing) : 0;
    work += tileCount * 4;
    if (work > WORK_LIMIT) throw new Error("Loop marks tile/fan work budget exceeded");
    loops.push({ center, points, length, cumulative });
    tileCounts.push(tileCount);
  }
  return { loops, tileCounts, work };
}

function colour(p: any, layer: Layer, index: number, alpha: number, kind: "stroke" | "fill") {
  const rgb = layer.palette[((index % layer.palette.length) + layer.palette.length) % layer.palette.length] >>> 0;
  p[kind]((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
}
function tileAt(loop: LoopRecord, distance: number): { point: Point; tangent: Point; normal: Point } {
  const { points, cumulative } = loop;
  let low = 0, high = points.length;
  while (low + 1 < high) {
    const mid = (low + high) >>> 1;
    if (cumulative[mid] <= distance) low = mid; else high = mid;
  }
  const a = points[low], b = points[(low + 1) % points.length];
  const length = cumulative[low + 1] - cumulative[low];
  const t = length > 0 ? (distance - cumulative[low]) / length : 0;
  const tx = length > 0 ? (b[0] - a[0]) / length : 1;
  const ty = length > 0 ? (b[1] - a[1]) / length : 0;
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    tangent: [tx, ty], normal: [-ty, tx] };
}

function polygon(p: any, vertices: Point[]) {
  p.beginShape();
  for (const vertex of vertices) p.vertex(vertex[0], vertex[1]);
  p.endShape(p.CLOSE);
}

export function drawLoopMarksModern(p: any, layer: Layer): void {
  const q = options(layer.params), { loops, tileCounts } = buildLoopMarks(layer.params);
  const drawsOutline = q.treatment === "outline" || q.treatment === "outline-tiles";
  const drawsTiles = q.treatment === "tiles" || q.treatment === "outline-tiles";
  for (let index = 0; index < loops.length; index++) {
    const loop = loops[index], points = loop.points;
    if (q.treatment === "fans") {
      p.noStroke();
      for (let sample = 0; sample < points.length; sample++) {
        colour(p, layer, index + Math.floor(sample / Math.max(1, q.subdivisions)), q.fanOpacity, "fill");
        const a = points[sample], b = points[(sample + 1) % points.length];
        p.triangle(loop.center[0], loop.center[1], a[0], a[1], b[0], b[1]);
      }
    }
    if (drawsOutline) {
      p.noFill(); p.strokeWeight(q.outlineWeight); colour(p, layer, index, 220, "stroke");
      for (let sample = 0; sample < points.length; sample++) {
        const a = points[sample], b = points[(sample + 1) % points.length];
        p.line(a[0], a[1], b[0], b[1]);
      }
    }
    if (drawsTiles) {
      for (let tile = 0; tile < tileCounts[index]; tile++) {
        const { point: [x, y], tangent: [tx, ty], normal: [nx, ny] } = tileAt(loop, tile * q.tileSpacing);
        colour(p, layer, index + tile, 235, q.tileShape === "tick" ? "stroke" : "fill");
        if (q.tileShape === "tick") {
          p.strokeWeight(q.tileWidth);
          p.line(x - nx * q.tileHeight / 2, y - ny * q.tileHeight / 2,
            x + nx * q.tileHeight / 2, y + ny * q.tileHeight / 2);
        } else {
          p.noStroke();
          const w = q.tileWidth / 2, h = q.tileHeight / 2;
          const v = (u: number, v: number): Point => [x + tx * u + nx * v, y + ty * u + ny * v];
          polygon(p, q.tileShape === "bar" ? [v(-w, -h), v(w, -h), v(w, h), v(-w, h)] :
            [v(0, -h), v(w, 0), v(0, h), v(-w, 0)]);
        }
      }
    }
  }
}
