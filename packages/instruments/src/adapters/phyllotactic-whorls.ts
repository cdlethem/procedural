import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Painter = {
  push(): void; pop(): void; translate(x: number, y: number): void; rotate(angle: number): void;
  noFill(): void; noStroke(): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void; strokeWeight(weight: number): void;
  circle(x: number, y: number, diameter: number): void;
  ellipse(x: number, y: number, width: number, height: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  beginShape(): void; vertex(x: number, y: number): void;
  bezierVertex(x: number, y: number): void;
  endShape(mode?: unknown): void; CLOSE: unknown;
};
export type WhorlSite = { index: number; radius: number; angle: number; x: number; y: number };
const radians = Math.PI / 180;
const limits = [
  ["count", 0, 5000, true], ["startIndex", 0, 100000, true],
  ["divergence", -3600, 3600, false], ["radialScale", 0, 1000, false],
  ["exponent", .05, 2, false], ["innerRadius", 0, 10000, false],
  ["anisotropy", .05, 20, false], ["centerX", -10000, 10000, false],
  ["centerY", -10000, 10000, false], ["rotation", -3600, 3600, false],
  ["angularDisorder", 0, 180, false], ["radialDisorder", 0, 1000, false],
  ["size", 0, 300, false], ["aspect", .05, 10, false],
  ["taper", 0, 5, false], ["markAngle", -3600, 3600, false],
  ["weight", 0, 30, false], ["retention", 0, 1, false],
  ["connectionStride", 0, 5000, true], ["connectionWeight", 0, 30, false],
] as const;
const number = (q: Params, key: string) => Number(q[key]);
function color(p: Painter, value: number, kind: "fill" | "stroke"): void {
  const [r, g, b] = channels(value);
  p[kind](r, g, b, 225);
}

const phyllotacticWhorlsGroups: ControlGroup[] = [
  { label: "Ranks", stage: "form", controls: ["count", "startIndex", "divergence", "exponent"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY",
    { label: "Size", controls: ["radialScale", "innerRadius"], proportional: true }, "anisotropy", "rotation"] },
  { label: "Disorder", stage: "process", controls: ["angularDisorder", "radialDisorder"] },
  { label: "Mark", stage: "material", controls: ["mark", { label: "Orientation", controls: ["markOrientation", "markAngle"] }, "aspect",
    { label: "Scale", controls: ["size", "weight"], proportional: true }, "taper", "retention"] },
  { label: "Connections", stage: "material", controls: ["connectionStride", "connectionWeight"] },
];

export const phyllotacticWhorlsDefinitions: StudioDefinition[] = [{
  id: "phyllotactic-whorls",
  title: "Phyllotactic whorls",
  description: "Ranked radius and divergence marks, optionally joined at a parastichy stride; no packing or botanical simulation.",
  procedure: "Each dot is turned by a fixed divergence angle from the last and pushed outward as its index grows, the way seeds pack in a sunflower head. Spiral arms emerge from that single rule, and each position is marked with a leaf, disc or bar.",
  parameters: [
    numeric("count", "Ranks", "Number of ranked sites; zero gives an empty source.", 0, 1400, 1, { hardMin: 0, hardMax: 5000, integer: true }),
    numeric("startIndex", "Starting index", "Absolute index of the first site, not an offset applied after construction.", 0, 300, 1, { hardMin: 0, hardMax: 100000, integer: true }),
    numeric("divergence", "Divergence °", "Angle added for each successive index; continuous, not rounded to a whole degree.", 0, 360, .1, { hardMin: -3600, hardMax: 3600, integer: false }),
    numeric("radialScale", "Radial scale", "Canvas units multiplying index raised to the radial exponent.", 0, 35, .1, { hardMin: 0, hardMax: 1000, integer: false }),
    numeric("exponent", "Radial exponent", "Positive power applied to the absolute index.", .2, 1.5, .01, { hardMin: .05, hardMax: 2, integer: false }),
    numeric("innerRadius", "Inner radius", "Minimum radial distance before anisotropic stretching; an empty inner region, not exclusion of overlapping marks.", 0, 140, 1, { hardMin: 0, hardMax: 10000, integer: false }),
    numeric("anisotropy", "X anisotropy", "Stretch local X before rotating the entire source.", .4, 2, .01, { hardMin: .05, hardMax: 20, integer: false }),
    numeric("centerX", "Center X", "Source center in canvas units; no automatic fitting.", 0, 640, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
    numeric("centerY", "Center Y", "Source center in canvas units.", 0, 640, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
    numeric("rotation", "Source rotation °", "Rotate the anisotropic source about its center.", -180, 180, .5, { hardMin: -3600, hardMax: 3600, integer: false }),
    numeric("angularDisorder", "Angular disorder °", "Independent seeded angle perturbation on either side of each indexed angle.", 0, 60, .5, { hardMin: 0, hardMax: 180, integer: false }),
    numeric("radialDisorder", "Radial disorder", "Independent seeded canvas-unit radial perturbation, clamped at inner radius.", 0, 35, .5, { hardMin: 0, hardMax: 1000, integer: false }),
    choice("mark", "Primitive", "Choose a disc, ellipse, bar or pointed curved leaf mark.", ["disc", "ellipse", "bar", "leaf"]),
    choice("markOrientation", "Mark orientation", "Orient each non-disc mark along its source radial angle, tangent, or fixed canvas angle.", ["radial", "tangent", "fixed"]),
    numeric("markAngle", "Mark angle °", "Added to radial/tangent orientation, or the whole fixed orientation.", -180, 180, 1, { hardMin: -3600, hardMax: 3600, integer: false }),
    numeric("size", "Mark size", "Disc diameter or other mark length; zero omits marks independently of connections.", 0, 32, .5, { hardMin: 0, hardMax: 300, integer: false }),
    numeric("aspect", "Mark aspect", "Ellipse height or bar/leaf breadth relative to mark length.", .1, 2, .05, { hardMin: .05, hardMax: 10, integer: false }),
    numeric("taper", "Last rank scale", "Relative mark size at the last rank; interpolated from 1 at the first rank.", 0, 2, .05, { hardMin: 0, hardMax: 5, integer: false }),
    numeric("weight", "Mark outline weight", "Zero removes mark outlines while retaining fill.", 0, 5, .1, { hardMin: 0, hardMax: 30, integer: false }),
    numeric("retention", "Retained ranks", "Seeded fraction retained for drawing, independent of source positions; zero paints nothing.", 0, 1, .01, { hardMin: 0, hardMax: 1, integer: false }),
    numeric("connectionStride", "Connection stride", "Join rank i to i + stride only when both ranks are present. Zero disables links; never wraps.", 0, 89, 1, { hardMin: 0, hardMax: 5000, integer: true }),
    numeric("connectionWeight", "Connection weight", "Zero omits connections without removing marks.", 0, 4, .1, { hardMin: 0, hardMax: 30, integer: false }),
  ],
  controlGroups: phyllotacticWhorlsGroups,
  defaults: {
    count: 850, startIndex: 1, divergence: 137.508, radialScale: 8.3, exponent: .5,
    innerRadius: 19, anisotropy: 1, centerX: 320, centerY: 320, rotation: 0,
    angularDisorder: 0, radialDisorder: 0, mark: "ellipse", markOrientation: "tangent",
    markAngle: 0, size: 7.2, aspect: .55, taper: .65, weight: 0,
    retention: 1, connectionStride: 0, connectionWeight: .6,
  },
  validate: validatePhyllotacticWhorls,
}];

export function validatePhyllotacticWhorls(q: Params): void {
  for (const [key, low, high, integer] of limits) {
    const value = q[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isSafeInteger(value)))
      throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${low}, ${high}]`);
  }
  if (!["disc", "ellipse", "bar", "leaf"].includes(String(q.mark))) throw new Error("mark must be disc, ellipse, bar or leaf");
  if (!["radial", "tangent", "fixed"].includes(String(q.markOrientation))) throw new Error("markOrientation must be radial, tangent or fixed");
  const highest = number(q, "startIndex") + Math.max(0, number(q, "count") - 1);
  if (number(q, "count") > 0 && number(q, "innerRadius") + number(q, "radialScale") *
      Math.pow(highest, number(q, "exponent")) + number(q, "radialDisorder") > 10_000_000)
    throw new Error("Ranked radius exceeds the 10,000,000-unit source budget");
}

// Three distinct counter-based streams: radial, angular and retention changes cannot consume each other's values.
function unit(seed: number, index: number, stream: number): number {
  let bits = Math.imul((seed >>> 0) ^ stream, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b);
  bits ^= bits >>> 16;
  bits = Math.imul(bits, 0x7feb352d);
  bits ^= bits >>> 15;
  bits = Math.imul(bits, 0x846ca68b);
  bits ^= bits >>> 16;
  return (bits >>> 0) / 0x100000000;
}
const geometryKeys = ["count", "startIndex", "divergence", "radialScale", "exponent", "innerRadius", "anisotropy", "centerX", "centerY", "rotation", "angularDisorder", "radialDisorder"] as const;
let previous: { key: string; sites: WhorlSite[] } | undefined;
export function phyllotacticWhorlSites(q: Params, seed: number): WhorlSite[] {
  validatePhyllotacticWhorls(q);
  const key = JSON.stringify([number(q, "angularDisorder") || number(q, "radialDisorder") ? seed : 0, ...geometryKeys.map(k => q[k])]);
  if (previous?.key === key) return previous.sites;
  const sites: WhorlSite[] = [];
  const rotation = number(q, "rotation") * radians, cr = Math.cos(rotation), sr = Math.sin(rotation);
  const angular = number(q, "angularDisorder"), radial = number(q, "radialDisorder");
  const inner = number(q, "innerRadius");
  for (let rank = 0; rank < number(q, "count"); rank++) {
    const index = number(q, "startIndex") + rank;
    const theta = (index * number(q, "divergence") + (angular ? (2 * unit(seed, index, 0x72616431) - 1) * angular : 0)) * radians;
    const radius = Math.max(inner, inner + number(q, "radialScale") * Math.pow(index, number(q, "exponent")) +
      (radial ? (2 * unit(seed, index, 0x72616432) - 1) * radial : 0));
    const localX = radius * Math.cos(theta) * number(q, "anisotropy"), localY = radius * Math.sin(theta);
    const dx = localX * cr - localY * sr, dy = localX * sr + localY * cr;
    sites.push({ index, radius, angle: Math.atan2(dy, dx), x: number(q, "centerX") + dx, y: number(q, "centerY") + dy });
  }
  previous = { key, sites };
  return sites;
}

export function drawPhyllotacticWhorls(p: Painter, layer: Layer): void {
  const q = layer.params, sites = phyllotacticWhorlSites(q, layer.seed);
  const retention = number(q, "retention"), size = number(q, "size");
  const stride = number(q, "connectionStride"), connectionWeight = number(q, "connectionWeight");
  if (!sites.length || retention === 0 || (size === 0 && (!stride || connectionWeight === 0))) return;
  const palette = layer.palette.length ? layer.palette : [0x202020];
  const kept = (index: number) => retention === 1 || unit(layer.seed, index, 0x72657431) < retention;
  if (stride > 0 && connectionWeight > 0) {
    p.noFill(); p.strokeWeight(connectionWeight);
    for (let rank = 0; rank + stride < sites.length; rank++) {
      const a = sites[rank], b = sites[rank + stride];
      if (!kept(a.index) || !kept(b.index)) continue;
      color(p, palette[(rank + 1) % palette.length], "stroke");
      p.line(a.x, a.y, b.x, b.y);
    }
  }
  if (size === 0) return;
  const weight = number(q, "weight"), aspect = number(q, "aspect"), taper = number(q, "taper");
  for (let rank = 0; rank < sites.length; rank++) {
    const site = sites[rank];
    if (!kept(site.index)) continue;
    const length = size * (1 + (taper - 1) * (sites.length === 1 ? 0 : rank / (sites.length - 1)));
    if (length <= 0) continue;
    color(p, palette[rank % palette.length], "fill");
    if (weight > 0) {
      color(p, palette[(rank + 1) % palette.length], "stroke");
      p.strokeWeight(weight);
    } else p.noStroke();
    if (q.mark === "disc") { p.circle(site.x, site.y, length); continue; }
    const orientation = q.markOrientation === "fixed" ? 0 : site.angle + (q.markOrientation === "tangent" ? Math.PI / 2 : 0);
    p.push(); p.translate(site.x, site.y); p.rotate(orientation + number(q, "markAngle") * radians);
    if (q.mark === "ellipse") p.ellipse(0, 0, length, length * aspect);
    else if (q.mark === "bar") p.rect(-length / 2, -length * aspect / 2, length, length * aspect);
    else {
      const half = length / 2, breadth = length * aspect / 2;
      p.beginShape(); p.vertex(-half, 0);
      p.bezierVertex(-half / 3, -breadth); p.bezierVertex(half / 3, -breadth); p.bezierVertex(half, 0);
      p.bezierVertex(half / 3, breadth); p.bezierVertex(-half / 3, breadth); p.bezierVertex(-half, 0);
      p.endShape(p.CLOSE);
    }
    p.pop();
  }
}
