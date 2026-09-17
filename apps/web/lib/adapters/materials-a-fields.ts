import type { Layer } from "../studio-types";
import { euclideanDistanceTransform2D, medianCutQuantize, oklabRamp } from "../../../../packages/javascript/src/index.js";
import { drawNearestFeatureMosaic, drawPerceptualBands, drawQuantizedStripes, drawReducedMosaic } from "../../../../packages/javascript/examples/materials-a-studies.js";

const q = (layer: Layer, key: string): number => Number(layer.params[key]);
const rgb = (layer: Layer, index: number): [number, number, number] => {
  const color = layer.palette[index % layer.palette.length] >>> 0;
  return [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
};
const stops = (layer: Layer): number[][] => [0, 1, 2].map(index => rgb(layer, index).map(channel => channel / 255));
function fraction(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
    throw Error(`${key} must be a finite fraction between 0 and 1`);
  return value;
}

export function drawQuantizedStripesField(p: any, layer: Layer): void {
  const coverage = fraction(layer.params.bandCoverage, "Band coverage");
  if (coverage === 1) return drawQuantizedStripes(p, layer);
  if (coverage === 0) return;
  const count = q(layer, "stripes"), source = stops(layer);
  const colors = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1), a = source[i % 3], b = source[(i + 1) % 3];
    return a.map((value, channel) => value * t + b[channel] * (1 - t));
  });
  const reduced = medianCutQuantize({ colors, count: q(layer, "count"), maxWork: count * count * q(layer, "count") + count * q(layer, "count") + count });
  const bandHeight = 640 / count;
  p.noStroke();
  for (let i = 0; i < count; i++) {
    const color = reduced.palette[reduced.indices[i]];
    p.fill(color[0] * 255, color[1] * 255, color[2] * 255);
    p.rect(0, i * bandHeight + (1 - coverage) * bandHeight / 2, 640, bandHeight * coverage);
  }
}

export function drawPerceptualBandsField(p: any, layer: Layer): void {
  const coverage = fraction(layer.params.bandCoverage, "Band coverage");
  if (coverage === 1) return drawPerceptualBands(p, layer);
  if (coverage === 0) return;
  const bands = q(layer, "bands");
  const colors = oklabRamp({ stops: stops(layer), count: bands, maxWork: bands + 3 }).colors;
  const bandHeight = 600 / bands;
  p.noStroke();
  for (let i = 0; i < bands; i++) {
    const edge = 15 * Math.sin(q(layer, "phase") + i * .3);
    const color = colors[i];
    p.fill(color[0] * 255, color[1] * 255, color[2] * 255);
    p.rect(20 + edge, 20 + i * bandHeight + (1 - coverage) * bandHeight / 2,
      600 - 2 * edge, bandHeight * coverage);
  }
}

export function drawReducedMosaicField(p: any, layer: Layer): void {
  const mode = layer.params.fieldMask;
  if (!["all", "high", "low"].includes(String(mode))) throw Error("Unknown mosaic field mask");
  const threshold = fraction(layer.params.maskThreshold, "Mask threshold");
  if (mode === "all") return drawReducedMosaic(p, layer);
  const n = Math.max(20, Math.floor(600 / q(layer, "scale"))), size = 600 / n;
  const field = Array.from({ length: n * n }, (_, i) => {
    const x = i % n, y = Math.floor(i / n);
    return Math.max(0, Math.min(1, .5 + .3 * Math.sin(x * .29 + layer.seed * .02) + .22 * Math.cos(y * .21 + x * .07)));
  });
  const source = stops(layer);
  const colors = field.map(value => [0, 1, 2].map(channel =>
    value * source[0][channel] + (1 - value) * source[1][channel]));
  const reduced = medianCutQuantize({ colors, count: q(layer, "count"), maxWork: n ** 4 * q(layer, "count") + n * n * q(layer, "count") + n * n });
  p.noStroke(); p.push(); p.translate(20, 20);
  for (let i = 0; i < field.length; i++) {
    if (mode === "high" ? field[i] < threshold : field[i] >= threshold) continue;
    const color = reduced.palette[reduced.indices[i]];
    p.fill(color[0] * 255, color[1] * 255, color[2] * 255);
    p.rect((i % n) * size, Math.floor(i / n) * size, size, size);
  }
  p.pop();
}

export function drawNearestFeatureField(p: any, layer: Layer): void {
  const mode = layer.params.display;
  if (!["regions", "boundaries", "both"].includes(String(mode))) throw Error("Unknown feature display");
  const width = q(layer, "boundaryWidth"), siteSize = q(layer, "siteSize");
  if (![width, siteSize].every(Number.isFinite) || width < 0 || siteSize < 0 ||
      typeof layer.params.showSites !== "boolean") throw Error("Invalid feature mark settings");
  if (mode === "regions" && !layer.params.showSites) return drawNearestFeatureMosaic(p, layer);
  const n = Math.max(24, Math.floor(600 / q(layer, "scale"))), size = 600 / n;
  const divisor = Math.max(3, Math.floor(n * n / q(layer, "features")));
  const features = Array.from({ length: n * n }, (_, i) => {
    const x = i % n, y = Math.floor(i / n);
    return ((x * 17 + y * 31 + layer.seed) % divisor) === 0;
  });
  const result = euclideanDistanceTransform2D({ mask: features, columns: n, rows: n, maxWork: n * n * 6 });
  p.noStroke(); p.push(); p.translate(20, 20);
  if (mode !== "boundaries") for (let i = 0; i < result.nearestIndices.length; i++) {
    const color = rgb(layer, result.nearestIndices[i] ?? 0);
    p.fill(color[0], color[1], color[2], 210);
    p.rect((i % n) * size, Math.floor(i / n) * size, size, size);
  }
  if (width > 0 && mode !== "regions") {
    const color = rgb(layer, 0);
    p.noFill(); p.stroke(color[0], color[1], color[2], 220); p.strokeWeight(width);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, id = result.nearestIndices[i];
      if (x + 1 < n && id !== result.nearestIndices[i + 1])
        p.line((x + 1) * size, y * size, (x + 1) * size, (y + 1) * size);
      if (y + 1 < n && id !== result.nearestIndices[i + n])
        p.line(x * size, (y + 1) * size, (x + 1) * size, (y + 1) * size);
    }
  }
  if (layer.params.showSites && siteSize > 0) {
    const color = rgb(layer, 1);
    p.noStroke(); p.fill(color[0], color[1], color[2], 255);
    for (let i = 0; i < features.length; i++) if (features[i])
      p.circle((i % n + .5) * size, (Math.floor(i / n) + .5) * size, siteSize);
  }
  p.pop();
}
