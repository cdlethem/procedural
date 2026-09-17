import { clipSegmentsSimplePolygon2D } from "../../src/segment-clip.js";

export const PATH_CLIP_DEFAULTS = Object.freeze({
  sourceMode: "rows", pathCount: 16, steps: 70, wander: 9,
  regionMode: "portal", centerX: 320, centerY: 320,
  regionWidth: 480, regionHeight: 480, notchWidth: 160, notchDepth: 220,
  sides: 6, angle: 0, weight: 1.5, showOutline: true, seed: 17,
});
export const PATH_CLIP_COLORS = Object.freeze([0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7]);
export const PATH_CLIP_WORK_LIMIT = 4_000_000;
export const PATH_CLIP_OUTPUT_LIMIT = 50_000;

function numberIn(value, min, max, integer = false) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max &&
    (!integer || Number.isInteger(value));
}

export function validatePathClipSettings(x) {
  if (!["rows", "wander", "fan"].includes(x.sourceMode) ||
      !["rectangle", "portal", "bay", "regular"].includes(x.regionMode) ||
      !numberIn(x.pathCount, 1, 80, true) || !numberIn(x.steps, 2, 160, true) ||
      !numberIn(x.wander, 0, 80) || !numberIn(x.centerX, -320, 960) ||
      !numberIn(x.centerY, -320, 960) || !numberIn(x.regionWidth, 10, 1000) ||
      !numberIn(x.regionHeight, 10, 1000) || !numberIn(x.notchWidth, 0, 1000) ||
      !numberIn(x.notchDepth, 0, 1000) || !numberIn(x.sides, 3, 12, true) ||
      !numberIn(x.angle, -180, 180) || !numberIn(x.weight, .1, 12) ||
      !numberIn(x.seed, 0, 4294967295, true) || typeof x.showOutline !== "boolean")
    throw new Error("Invalid clip construction settings");
  return x;
}

export function pathClipRegion(x) {
  const { centerX: cx, centerY: cy, regionWidth: width, regionHeight: height,
    notchWidth, notchDepth, regionMode } = x;
  const left = cx - width / 2, right = cx + width / 2;
  const top = cy - height / 2, bottom = cy + height / 2;
  const rect = [[left, top], [right, top], [right, bottom], [left, bottom]];
  if (regionMode === "rectangle") return rect;
  if (regionMode === "regular") {
    const start = x.angle * Math.PI / 180;
    return Array.from({ length: x.sides }, (_, i) => {
      const a = start + i * Math.PI * 2 / x.sides;
      return [cx + Math.cos(a) * width / 2, cy + Math.sin(a) * height / 2];
    });
  }
  const span = regionMode === "portal" ? width : height;
  const reach = regionMode === "portal" ? height : width;
  if (notchWidth > span) throw new Error("Notch opening exceeds region span");
  if (notchWidth === 0 || notchDepth === 0) return rect;
  if (notchDepth >= reach) throw new Error("Full-depth notch would disconnect the simple polygon");
  if (regionMode === "portal") {
    const innerTop = bottom - notchDepth;
    if (notchWidth === width) return [[left, top], [right, top], [right, innerTop], [left, innerTop]];
    return [[left, top], [right, top], [right, bottom], [cx + notchWidth / 2, bottom],
      [cx + notchWidth / 2, innerTop], [cx - notchWidth / 2, innerTop],
      [cx - notchWidth / 2, bottom], [left, bottom]];
  }
  const innerLeft = right - notchDepth;
  if (notchWidth === height) return [[left, top], [innerLeft, top], [innerLeft, bottom], [left, bottom]];
  return [[left, top], [right, top], [right, cy - notchWidth / 2],
    [innerLeft, cy - notchWidth / 2], [innerLeft, cy + notchWidth / 2],
    [right, cy + notchWidth / 2], [right, bottom], [left, bottom]];
}

function rng(seed) {
  let state = seed >>> 0;
  return () => ((state = (state + 0x6d2b79f5) >>> 0),
    (Math.imul(state ^ (state >>> 15), 1 | state) ^
      Math.imul(state ^ (state >>> 7), 61 | state) ^ state) >>> 0) / 4294967296;
}

export function pathClipSources(x) {
  const random = rng(x.seed), segments = [];
  for (let path = 0; path < x.pathCount; path++) {
    const across = x.pathCount === 1 ? .5 : path / (x.pathCount - 1);
    let px = 20, py = x.sourceMode === "fan" ? 320 : 80 + across * 480;
    for (let step = 1; step <= x.steps; step++) {
      const nx = 20 + step / x.steps * 600;
      const ny = x.sourceMode === "fan" ? 320 + (across - .5) * 480 * step / x.steps :
        x.sourceMode === "wander" ? py + (random() - .5) * x.wander : py;
      segments.push([px, py, nx, ny]);
      px = nx; py = ny;
    }
  }
  return segments;
}

export function buildPathClipComposition(settings = PATH_CLIP_DEFAULTS) {
  const x = validatePathClipSettings(settings);
  const polygon = pathClipRegion(x);
  const edges = polygon.length, segmentCount = x.pathCount * x.steps;
  const work = edges * edges + segmentCount * (edges * edges * 8 + edges * 16 + 8);
  const potentialOutput = segmentCount * (Math.floor(edges / 2) + 1);
  if (work > PATH_CLIP_WORK_LIMIT || potentialOutput > PATH_CLIP_OUTPUT_LIMIT)
    throw new Error("Clip construction exceeds combined work or output limit");
  const sources = pathClipSources(x);
  const clipped = clipSegmentsSimplePolygon2D({ polygon, segments: sources,
    maxWork: work, maxOutputSegments: PATH_CLIP_OUTPUT_LIMIT });
  return { polygon, sources, clipped, work, potentialOutput };
}
