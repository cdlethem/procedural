import { gradientNoise2D01, marchingSquares2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";
import { planeWave, type WavePattern } from "../composition/patterns.js";
import { channels, numeric, type StudioDefinition } from "./types.js";

const TAU = Math.PI * 2;
const n = (key: string, label: string, description: string, min: number, max: number,
  step: number, hardMin = min, hardMax = max, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });

/** Two interfering wave families inside a soft source, not a simulated wave surface. */
export const interferenceLaceDefinition: StudioDefinition = {
  id: "interference-lace", title: "Interference lace",
  description: "Interfering wave crests open into ribbons, beads and cellular lace.",
  parameters: [
    n("frequency", "Wave count", "Cycles across the source; controls the spacing of the fine ribs.", 2, 18, .25, .25, 32),
    n("ratio", "Frequency ratio", "Relative spacing of the second wave family; near equality produces broad beats.", .5, 1.5, .01, .05, 4),
    n("angle", "Crossing angle", "Angle between the wave families. Small angles make ribbons; wide angles make cells.", 0, 90, 1, -360, 360),
    n("phase", "Relative phase", "Slide the second family through the first without rerolling its distortion.", -180, 180, 1, -3600, 3600),
    n("warp", "Wave distortion", "Bend both wave families through separate seeded noise samples, in source-width units.", 0, .45, .01, 0, .5),
    n("warpScale", "Distortion scale", "Number of broad distortion features across the source.", .5, 4, .1, .1, 8),
    n("threshold", "Crest cutoff", "Keep positive crests above this level. Higher cutoffs break ribbons into small islands.", .03, .7, .01, .001, 1),
    n("levels", "Crest echoes", "Number of contour levels above the cutoff; levels above the highest crest are empty.", 1, 6, 1, 1, 8, true),
    n("levelGap", "Echo spacing", "Scalar distance between contour levels; independent of line thickness.", .03, .25, .01, .001, 1),
    n("width", "Source width", "Width of the soft elliptical source, as a fraction of the canvas.", .15, 1, .01, .01, 4),
    n("height", "Source height", "Height of the source; squeeze it into a small patch or a thin ribbon.", .15, 1, .01, .01, 4),
    n("centerX", "Source X", "Horizontal source position in canvas fractions.", 0, 1, .01, -2, 3),
    n("centerY", "Source Y", "Vertical source position in canvas fractions.", 0, 1, .01, -2, 3),
    n("weight", "Line weight", "Contour stroke width. Zero omits the marks without changing the field.", .4, 3, .1, 0, 20),
  ],
  controlGroups: [
    { label: "Waves", controls: ["frequency", "ratio", "angle", "phase", { label: "Distortion", controls: ["warp", "warpScale"] }] },
    { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
    { label: "Contours", controls: ["threshold", "levels", "levelGap", "weight"] },
  ],
  defaults: { frequency: 7, ratio: 1.08, angle: 27, phase: 0, warp: .42,
    warpScale: 3, threshold: .03, levels: 3, levelGap: .16,
    width: .88, height: .78, centerX: .5, centerY: .5, weight: 1.4 },
  validate: validateInterferenceLace,
};

export function validateInterferenceLace(params: Layer["params"]): void {
  // Eight samples per undistorted shortest wave, then extra samples for the noise bend.
  // A joint limit prevents resolving arbitrary frequency/warp combinations synchronously.
  if (laceResolution(params) > 289)
    throw new Error("Reduce wave count, frequency ratio or distortion: their combined sampling requirement exceeds 289 samples per side.");
}

function laceResolution(q: Layer["params"]): number {
  const frequency = Number(q.frequency) * Math.max(1, Number(q.ratio));
  const stretch = 1 + Number(q.warp) * Number(q.warpScale) * 2;
  return Math.max(97, Math.ceil(frequency * stretch * 8) + 1);
}

/** The two wave families as replaceable scalar patterns; each takes its own domain-warp sample. */
export function interferenceLaceWaves(seed: number, q: Layer["params"]): readonly [WavePattern, WavePattern] {
  const random = new JavaRandom(seed), firstPhase = random.nextDouble() * TAU;
  const secondPhase = random.nextDouble() * TAU + Number(q.phase) * Math.PI / 180;
  const frequency = Number(q.frequency);
  return [planeWave({ frequency, angle: 0, phase: firstPhase }),
    planeWave({ frequency, ratio: Number(q.ratio), angle: Number(q.angle) * Math.PI / 180, phase: secondPhase })];
}

/** Reusable scalar samples; palette, contour levels, source placement and stroke never reroll them.
 *  `waves` may replace either family (for example with `radialWave`); the sampling rule, eight samples
 *  per undistorted shortest wave plus the noise bend, is unchanged. */
export function interferenceLaceField(seed: number, q: Layer["params"], waves = interferenceLaceWaves(seed, q)) {
  validateInterferenceLace(q);
  const size = laceResolution(q), values = new Array<number>(size * size);
  const noise = gradientNoise2D01({ seed });
  const warp = Number(q.warp), scale = Number(q.warpScale);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1) - .5;
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1) - .5, radius2 = 4 * (u * u + v * v);
      if (radius2 >= 1) { values[y * size + x] = 0; continue; }
      const bendA = warp === 0 ? 0 : (noise.sample(u * scale + 11, v * scale + 7) - .5) * warp;
      const bendB = warp === 0 ? 0 : (noise.sample(u * scale - 19, v * scale + 31) - .5) * warp;
      const a = waves[0](u, v, bendA);
      const b = waves[1](u, v, bendB);
      values[y * size + x] = (1 - radius2) ** 2 * (a + b) * .5;
    }
  }
  return { size, values };
}

type LaceCanvas = {
  ROUND: string;
  noFill(): void;
  strokeCap(cap: string): void;
  strokeWeight(weight: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};

export function drawInterferenceLace(p: LaceCanvas, layer: Layer): void {
  const q = layer.params;
  if (q.weight === 0) return;
  const { size, values } = interferenceLaceField(layer.seed, q);
  const width = Number(q.width) * 640, height = Number(q.height) * 640;
  const origin = [Number(q.centerX) * 640 - width / 2, Number(q.centerY) * 640 - height / 2];
  const spacing = [width / (size - 1), height / (size - 1)];
  p.noFill(); p.strokeCap(p.ROUND); p.strokeWeight(Number(q.weight));
  for (let level = 0; level < Number(q.levels); level++) {
    const threshold = Number(q.threshold) + level * Number(q.levelGap);
    if (threshold >= 1) break;
    const { segments } = marchingSquares2D({ values, columns: size, rows: size,
      origin, spacing, threshold, maxWork: size * size + (size - 1) ** 2 });
    p.stroke(...channels(layer.palette[level % layer.palette.length]), 220);
    for (const [x1, y1, x2, y2] of segments) p.line(x1, y1, x2, y2);
  }
}
