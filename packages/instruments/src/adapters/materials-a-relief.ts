import { convolve2DSigned, gradientNoise2D01, seededTrianglePoints2D } from "@procedurals/javascript";
import type { ControlGroup, Layer } from "../types.js";
import { choice, numeric, type StudioDefinition } from "./types.js";

const reliefParameters = (id: "embossed-field" | "signed-edge-print") => [
  numeric("scale", "Pixel size", "Changes sampling density and the size of each printed mark.", 6, 48, 1, { hardMin: 4, hardMax: 120, integer: true }),
  choice("source", "Source field", "Mounds, localized waves, or sharp-edged cutouts built from seeded features.", ["waves", "mounds", "cutout"]),
  numeric("features", "Features", "Number of independently seeded source features.", 1, 24, 1, { hardMin: 1, hardMax: 64, integer: true }),
  numeric("featureScale", "Feature radius", "Typical radius as a fraction of the 600-unit drawing area, independently of pixel size.", .03, .36, .005, { hardMin: .01, hardMax: 1.5, integer: false }),
  numeric("spread", "Spread", "Width and height of the region where feature centers are seeded; zero stacks them.", 0, 1, .01, { hardMin: 0, hardMax: 2, integer: false }),
  numeric("centerX", "Center X", "Horizontal location of the seeded source region, in canvas fractions.", 0, 1, .01, { hardMin: -1, hardMax: 2, integer: false }),
  numeric("centerY", "Center Y", "Vertical location of the seeded source region, in canvas fractions.", 0, 1, .01, { hardMin: -1, hardMax: 2, integer: false }),
  numeric("aspect", "Aspect ratio", "Stretches each feature across one axis while preserving its approximate area.", .35, 3.5, .05, { hardMin: .1, hardMax: 10, integer: false }),
  numeric("orientation", "Orientation", "Rotation of source features in degrees, with small seeded variations.", -180, 180, 1, { hardMin: -3600, hardMax: 3600, integer: false }),
  numeric("contrast", "Source contrast", "Scales the source heights before directional convolution.", 0, 3, .05, { hardMin: 0, hardMax: 10, integer: false }),
  choice("axis", "Response axis", "Chooses which direction of change the signed convolution emphasizes.", ["vertical", "horizontal", "diagonal"]),
  id === "embossed-field"
    ? numeric("gain", "Relief strength", "Controls the opacity of the light and shadow marks.", 0, 4, .05, { hardMin: 0, hardMax: 20 })
    : numeric("cutoff", "Edge cutoff", "Keeps signed responses whose magnitude exceeds this value.", 0, 1, .01, { hardMin: 0, hardMax: 4 }),
  choice("treatment", "Mark treatment", "Draws the response as full tiles or smaller marks.", id === "embossed-field" ? ["tiles", "dots"] : ["tiles", "bars"]),
];
const reliefDefaults = (id: "embossed-field" | "signed-edge-print") => ({
  scale: id === "embossed-field" ? 9 : 10,
  source: id === "embossed-field" ? "mounds" : "cutout",
  axis: id === "embossed-field" ? "horizontal" : "diagonal",
  treatment: id === "embossed-field" ? "dots" : "bars",
  ...(id === "embossed-field" ? { gain: 1.2 } : { cutoff: .16 }),
  features: id === "embossed-field" ? 8 : 13,
  featureScale: id === "embossed-field" ? .14 : .12,
  spread: id === "embossed-field" ? .62 : .72,
  centerX: .5, centerY: .5,
  aspect: id === "embossed-field" ? 1.6 : 2.1,
  orientation: id === "embossed-field" ? -28 : 35,
  contrast: id === "embossed-field" ? 1.3 : 1.1,
});

/** Both relief studies share the seeded source field and its placement; only the response control differs. */
const reliefGroups = (response: "gain" | "cutoff"): ControlGroup[] => [
  { label: "Field", stage: "form", controls: ["source", "features", "featureScale", "aspect", "orientation", "contrast"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "spread"] },
  { label: "Response", stage: "process", controls: ["axis", response] },
  { label: "Mark", stage: "material", controls: ["treatment", "scale"] },
];

export const reliefDefinitions: StudioDefinition[] = [
  { id: "embossed-field", title: "Embossed field", description: "Signed convolution relief.",
  procedure: "Scatter seeded mounds, waves or cutout ovals into a small height field, then run a directional signed 3×3 convolution over it. Rising and falling slopes print in two inks, as tiles or dots sized by response, and blank cells print nothing.",
    parameters: reliefParameters("embossed-field"), controlGroups: reliefGroups("gain"), defaults: reliefDefaults("embossed-field") },
  { id: "signed-edge-print", title: "Signed edge print", description: "Two-ink convolution edges.",
  procedure: "Build a grayscale height field from seeded oval cutouts, then run a directional signed 3×3 convolution over it. Keep only responses above an edge cutoff and print the two signs in two inks, so opposite sides of each boundary take different colours.",
    parameters: reliefParameters("signed-edge-print"), controlGroups: reliefGroups("cutoff"), defaults: reliefDefaults("signed-edge-print") },
];

type ReliefSource = "mounds" | "waves" | "cutout";
export type ReliefFeature = { x: number; y: number; radiusX: number; radiusY: number; angle: number; phase: number };

const kernels: Record<string, number[]> = {
  vertical: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
  horizontal: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
  diagonal: [-2, -1, 0, -1, 0, 1, 0, 1, 2],
};
const number = (layer: Layer, key: string): number => Number(layer.params[key]);
const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Normalized source geometry: sampling resolution, palette and ink controls never enter construction. */
export function buildReliefFeatures(layer: Layer): ReliefFeature[] {
  const count = number(layer, "features"), radius = number(layer, "featureScale");
  const spread = number(layer, "spread"), aspect = number(layer, "aspect");
  const centerX = number(layer, "centerX"), centerY = number(layer, "centerY");
  const aspectRoot = Math.sqrt(aspect);
  const orientation = number(layer, "orientation") * Math.PI / 180;
  const upper = seededTrianglePoints2D({ seed: layer.seed >>> 0, count: Math.ceil(count / 2), triangle: [[0, 0], [1, 0], [0, 1]] });
  const lower = seededTrianglePoints2D({ seed: (layer.seed ^ 0x9e3779b9) >>> 0, count: Math.floor(count / 2), triangle: [[1, 1], [0, 1], [1, 0]] });
  const noise = gradientNoise2D01({ seed: (layer.seed ^ 0x85ebca6b) >>> 0 });
  const features: ReliefFeature[] = [];
  for (let i = 0; i < count; i++) {
    const [x, y] = (i % 2 ? lower : upper).pointAt(Math.floor(i / 2));
    const size = radius * (0.65 + 0.7 * noise.sample(i * 2.13 + 0.7, 3.1));
    features.push({
      x: centerX + (x - 0.5) * spread,
      y: centerY + (y - 0.5) * spread,
      radiusX: size * aspectRoot, radiusY: size / aspectRoot,
      angle: orientation + (noise.sample(i * 2.13 + 0.7, 11.3) - 0.5) * 0.75,
      phase: noise.sample(i * 2.13 + 0.7, 23.7) * Math.PI * 4,
    });
  }
  return features;
}

/** Compact supports guarantee an exactly zero source and response on genuinely empty background cells. */
export function reliefSourceValues(layer: Layer, resolution: number): number[] {
  const source = layer.params.source as ReliefSource;
  if (source !== "mounds" && source !== "waves" && source !== "cutout") throw Error(`Unknown relief source: ${source}`);
  const contrast = number(layer, "contrast");
  const features = buildReliefFeatures(layer);
  const values = new Array<number>(resolution * resolution).fill(0);
  for (const feature of features) {
    const cosine = Math.cos(feature.angle), sine = Math.sin(feature.angle);
    // Rotated elliptical support fits inside this square; it is independent of sample resolution.
    const reach = Math.hypot(feature.radiusX, feature.radiusY);
    const minX = Math.max(0, Math.floor((feature.x - reach) * resolution));
    const maxX = Math.min(resolution - 1, Math.ceil((feature.x + reach) * resolution));
    const minY = Math.max(0, Math.floor((feature.y - reach) * resolution));
    const maxY = Math.min(resolution - 1, Math.ceil((feature.y + reach) * resolution));
    for (let y = minY; y <= maxY; y++) {
      const v = (y + 0.5) / resolution - feature.y;
      for (let x = minX; x <= maxX; x++) {
        const u = (x + 0.5) / resolution - feature.x;
        const localX = (u * cosine + v * sine) / feature.radiusX;
        const localY = (v * cosine - u * sine) / feature.radiusY;
        const r2 = localX * localX + localY * localY;
        if (r2 >= 1) continue;
        let height: number;
        if (source === "mounds") height = (1 - r2) ** 2;
        else if (source === "cutout") height = smooth((1 - Math.sqrt(r2)) * 10);
        else {
          // The explicit radial envelope is essential: waves do not leak into blank paper.
          const envelope = (1 - r2) ** 2;
          height = envelope * (0.5 + 0.5 * Math.cos(12 * localX + 1.5 * Math.sin(3 * localY + feature.phase)));
        }
        values[y * resolution + x] += contrast * height;
      }
    }
  }
  return values;
}

export function reliefResponse(layer: Layer): { resolution: number; cell: number; values: number[] } {
  const pixelSize = number(layer, "scale"), resolution = Math.floor(600 / pixelSize);
  if (!Number.isFinite(pixelSize) || pixelSize < 4 || pixelSize > 120 || resolution < 5 || resolution > 150)
    throw Error("Pixel size must be between 4 and 120");
  const kernel = kernels[String(layer.params.axis)];
  if (!kernel) throw Error(`Unknown response axis: ${layer.params.axis}`);
  const values = reliefSourceValues(layer, resolution);
  const response = convolve2DSigned({ values, columns: resolution, rows: resolution,
    kernel, kernelColumns: 3, kernelRows: 3, boundary: "clamp", maxWork: resolution * resolution * 9 });
  return { resolution, cell: 600 / resolution, values: response.values };
}

export function drawReliefField(p: {
  noStroke(): void; push(): void; pop(): void; translate(x: number, y: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  circle(x: number, y: number, diameter: number): void;
  rect(x: number, y: number, width: number, height: number): void;
}, layer: Layer): void {
  const { resolution, cell, values } = reliefResponse(layer);
  const embossed = layer.technique === "embossed-field";
  const treatment = layer.params.treatment;
  if (embossed && treatment !== "tiles" && treatment !== "dots") throw Error(`Unknown emboss treatment: ${treatment}`);
  if (!embossed && treatment !== "tiles" && treatment !== "bars") throw Error(`Unknown edge treatment: ${treatment}`);
  const gain = number(layer, "gain"), cutoff = number(layer, "cutoff");
  if (embossed && (!Number.isFinite(gain) || gain < 0 || gain > 20)) throw Error("Relief strength must be between 0 and 20");
  if (!embossed && (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > 4)) throw Error("Edge cutoff must be between 0 and 4");
  const positive = layer.palette[(embossed ? 1 : 0) % layer.palette.length] >>> 0;
  const negative = layer.palette[(embossed ? 0 : 2) % layer.palette.length] >>> 0;
  p.noStroke(); p.push(); p.translate(20, 20);
  for (let i = 0; i < values.length; i++) {
    const response = values[i], magnitude = Math.abs(response);
    if (magnitude === 0 || (embossed ? gain === 0 : magnitude <= cutoff)) continue;
    const ink = response > 0 ? positive : negative;
    p.fill((ink >>> 16) & 255, (ink >>> 8) & 255, ink & 255,
      embossed ? Math.min(230, magnitude * 120 * gain) : 230);
    const x = i % resolution * cell, y = Math.floor(i / resolution) * cell;
    if (treatment === "dots") p.circle(x + cell / 2, y + cell / 2, cell * (0.15 + 0.8 * Math.min(1, magnitude * gain)));
    else if (treatment === "bars") p.rect(x + cell * 0.2, y + cell * 0.3, cell * 0.6, cell * 0.4);
    else p.rect(x, y, cell, cell);
  }
  p.pop();
}
