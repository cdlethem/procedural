import { euclideanDistanceTransform2D, marchingSquares2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Painter = {
  noFill(): void; noStroke(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(weight: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  circle(x: number, y: number, diameter: number): void;
};
const number = (q: Params, key: string): number => Number(q[key]);



const sourceParameters = [
  choice("siteShape", "Site arrangement", "Seeded sites in an area, ring, line or grid inside the local source footprint.", ["area", "ring", "line", "grid"]),
  numeric("gridSize", "Grid resolution", "Number of sample cells along each side of the 600-unit drawing area.", 35, 105, 1, { hardMin: 8, hardMax: 160, integer: true }),
  numeric("disorder", "Site disorder", "Independent seeded variation of site positions; zero retains ordered geometry.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
  numeric("extent", "Source extent", "Radius of the local site footprint in canvas fractions; not a rendered border.", .05, .9, .01, { hardMin: .005, hardMax: 2 }),
  numeric("aspect", "Source aspect", "Stretch the source in one direction while retaining approximate area.", .25, 4, .05, { hardMin: .05, hardMax: 20 }),
  numeric("orientation", "Source orientation", "Rotate the site's region, ring, line or grid in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  numeric("centerX", "Source X", "Horizontal center of the site group in canvas fractions.", 0, 1, .01, { hardMin: -2, hardMax: 3 }),
  numeric("centerY", "Source Y", "Vertical center of the site group in canvas fractions.", 0, 1, .01, { hardMin: -2, hardMax: 3 }),
];
const sourceDefaults = { siteShape: "area", gridSize: 78, disorder: .34, extent: .32,
  aspect: 1.25, orientation: -16, centerX: .49, centerY: .51 };
/** The seeded site source is shared: what the sites are, then where the source sits. */
const sourceGroups = (): ControlGroup[] => [
  { label: "Sites", controls: ["siteShape", "features", "disorder", "gridSize"] },
  { label: "Placement", controls: ["centerX", "centerY", "extent", "aspect", "orientation"] },
];
const siteDots: ControlGroup = { label: "Site dots", controls: ["showSites", "siteSize"] };

export const featureDistanceInstrumentDefinitions: StudioDefinition[] = [
  {
    id: "distance-halos", title: "Distance halos",
    description: "Contours of measured distance from an editable, seeded group of raster sites.",
    parameters: [...sourceParameters,
      numeric("features", "Sites", "Exact number of distinct raster sites in the shared source.", 1, 48, 1, { hardMin: 1, hardMax: 256, integer: true }),
      numeric("startRadius", "First radius", "First positive measured contour radius in raster cells.", .25, 12, .25, { hardMin: .001, hardMax: 160 }),
      numeric("radius", "Radius spacing", "Measured distance in raster cells between neighboring contours (historical radius key).", .25, 16, .25, { hardMin: .001, hardMax: 160 }),
      numeric("rings", "Contour count", "Maximum number of successive measured distance contours.", 1, 12, 1, { hardMin: 1, hardMax: 64, integer: true }),
      numeric("weight", "Contour weight", "Stroke width in canvas units; zero leaves no contour marks.", 0, 6, .1, { hardMin: 0, hardMax: 50 }),
      toggle("showSites", "Show sites", "Draw dots at the actual occupied source cells."),
      numeric("siteSize", "Site dot size", "Diameter of optional source-site dots; zero hides dots.", 0, 12, .1, { hardMin: 0, hardMax: 50 })],
    controlGroups: [...sourceGroups(),
      { label: "Contours", controls: ["rings", { label: "Radii", controls: ["startRadius", "radius"], proportional: true }, "weight"] },
      siteDots],
    defaults: {...sourceDefaults,
      features: 9,
      startRadius: 1.4,
      radius: 3.2,
      rings: 5,
      weight: 1.35,
      showSites: false,
      siteSize: 3},
    validate: (q) => validateFeatureDistance(q, "distance-halos"),
  },
  {
    id: "nearest-feature-mosaic", title: "Nearest feature mosaic",
    description: "Color real nearest-site ownership, draw its boundaries, or cut it into locally supported fragments.",
    parameters: [...sourceParameters,
      numeric("features", "Sites", "Exact number of distinct raster sites in the shared source.", 1, 48, 1, { hardMin: 1, hardMax: 256, integer: true }),
      choice("display", "Region display", "Draw region fills, actual different-owner boundaries, or both.", ["regions", "boundaries", "both"]),
      numeric("cellCoverage", "Cell coverage", "Fraction of each selected raster cell occupied by color; zero hides fills.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
      numeric("supportRadius", "Site support", "Maximum measured distance from the nearest site, in raster cells; zero retains site cells alone.", 0, 100, .5, { hardMin: 0, hardMax: 226 }),
      numeric("boundaryWidth", "Boundary width", "Line width only between differently owned, supported neighboring cells; zero hides boundaries.", 0, 6, .1, { hardMin: 0, hardMax: 30 }),
      toggle("showSites", "Show sites", "Mark the actual occupied source cells."),
      numeric("siteSize", "Site size", "Diameter of optional source-site dots; zero hides dots.", 0, 12, .1, { hardMin: 0, hardMax: 50 })],
    controlGroups: [...sourceGroups(),
      { label: "Regions", controls: ["supportRadius", "display", "cellCoverage", "boundaryWidth"] },
      siteDots],
    defaults: {...sourceDefaults,
      siteShape: "ring",
      features: 11,
      display: "both",
      cellCoverage: .84,
      supportRadius: 9,
      boundaryWidth: 1.25,
      showSites: false,
      siteSize: 4},
    validate: (q) => validateFeatureDistance(q, "nearest-feature-mosaic"),
  },
];

type Kind = "distance-halos" | "nearest-feature-mosaic";
function checked(q: Params, key: string, lo: number, hi: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < lo || value > hi || (integer && !Number.isSafeInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${lo}, ${hi}]`);
  return value;
}
function gridGeometry(q: Params) {
  const size = number(q, "gridSize"), cell = 600 / size;
  const extent = 600 * number(q, "extent"), aspect = Math.sqrt(number(q, "aspect"));
  const rx = extent / aspect, ry = extent * aspect;
  const a = number(q, "orientation") * Math.PI / 180;
  const c = Math.cos(a), s = Math.sin(a), cx = number(q, "centerX") * 640, cy = number(q, "centerY") * 640;
  const relative = (x: number, y: number): [number, number] => {
    const dx = 20 + (x + .5) * cell - cx, dy = 20 + (y + .5) * cell - cy;
    return [(dx * c + dy * s) / rx, (-dx * s + dy * c) / ry];
  };
  const physical = (u: number, v: number): [number, number] => [cx + rx * u * c - ry * v * s, cy + rx * u * s + ry * v * c];
  return { size, cell, relative, physical };
}
function candidateCount(q: Params): number {
  const { size, relative } = gridGeometry(q);
  let count = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [u, v] = relative(x, y);
    if (u * u + v * v <= 1) count++;
  }
  return count;
}
/** Reject joint work and impossible requests before allocating raster or contour arrays. */
export function validateFeatureDistance(q: Params, kind: Kind): void {
  
  if (!["area", "ring", "line", "grid"].includes(String(q.siteShape))) throw Error("Unknown site arrangement");
  const size = checked(q, "gridSize", 8, 160, true), sites = checked(q, "features", 1, 256, true);
  for (const [key, lo, hi] of [
    ["disorder", 0, 1], ["extent", .005, 2], ["aspect", .05, 20], ["orientation", -3600, 3600],
    ["centerX", -2, 3], ["centerY", -2, 3],
  ] as const) checked(q, key, lo, hi);
  let levels = 0;
  if (kind === "distance-halos") {
    checked(q, "startRadius", .001, 160); checked(q, "radius", .001, 160);
    levels = checked(q, "rings", 1, 64, true);
    checked(q, "weight", 0, 50);
  } else {
    if (!["regions", "boundaries", "both"].includes(String(q.display))) throw Error("Unknown region display");
    checked(q, "cellCoverage", 0, 1); checked(q, "supportRadius", 0, 226);
    checked(q, "boundaryWidth", 0, 30);
  }
  if (typeof q.showSites !== "boolean") throw Error("showSites must be boolean");
  checked(q, "siteSize", 0, 50);
  // Each nearest-target selection scans at most G candidate cells; EDT costs 6G,
  // each marching-squares level at most 2G. Limit their sum, not unrelated sliders.
  if (size * size * (sites + 6 + 2 * levels) > 2_000_000)
    throw Error("Sites × grid × contours exceeds the 2,000,000-step work budget");
  if (candidateCount(q) < sites)
    throw Error(`Source footprint contains fewer than ${sites} distinct raster cells; enlarge the extent, adjust placement or reduce sites`);
}

export type FeatureSource = { size: number; cell: number; mask: boolean[]; sites: number[] };
/** The boolean raster, not a modular predicate, is the sole structural input to both views. */
export function featureDistanceSource(q: Params, seed: number, kind: Kind = ("startRadius" in q ? "distance-halos" : "nearest-feature-mosaic")): FeatureSource {
  validateFeatureDistance(q, kind);
  return makeFeatureSource(q, seed);
}
function makeFeatureSource(q: Params, seed: number): FeatureSource {
  const { size, cell, relative, physical } = gridGeometry(q);
  const candidates: { index: number; x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [u, v] = relative(x, y);
    if (u * u + v * v <= 1) candidates.push({ index: y * size + x, x: 20 + (x + .5) * cell, y: 20 + (y + .5) * cell });
  }
  const mask = new Array<boolean>(size * size).fill(false), sites: number[] = [];
  const rng = new JavaRandom(seed >>> 0), count = number(q, "features"), jitter = number(q, "disorder");
  const shape = q.siteShape;
  const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols);
  const phase = rng.nextDouble() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    let u: number, v: number;
    if (shape === "area") {
      const r = .85 * Math.sqrt((i + .5) / count), angle = phase + i * Math.PI * (3 - Math.sqrt(5));
      u = r * Math.cos(angle); v = r * Math.sin(angle);
    } else if (shape === "ring") {
      const angle = phase + 2 * Math.PI * i / count;
      u = .73 * Math.cos(angle); v = .73 * Math.sin(angle);
    } else if (shape === "line") {
      u = count === 1 ? 0 : (i / (count - 1) - .5) * 1.7; v = 0;
    } else {
      u = ((i % cols + .5) / cols - .5) * 1.36;
      v = ((Math.floor(i / cols) + .5) / rows - .5) * 1.36;
    }
    // Draw independent structural randomness only here. Style never consumes RNG.
    const dx = (rng.nextDouble() * 2 - 1) * jitter * .48;
    const dy = (rng.nextDouble() * 2 - 1) * jitter * .48;
    const length = Math.hypot(u + dx, v + dy), shrink = length > .95 ? .95 / length : 1;
    const [tx, ty] = physical((u + dx) * shrink, (v + dy) * shrink);
    let closest = -1, minimum = Infinity;
    for (let j = 0; j < candidates.length; j++) {
      const candidate = candidates[j];
      if (mask[candidate.index]) continue;
      const distance = (candidate.x - tx) ** 2 + (candidate.y - ty) ** 2;
      if (distance < minimum) { closest = candidate.index; minimum = distance; }
    }
    // validateFeatureDistance established enough distinct cells; no target can collapse another.
    mask[closest] = true; sites.push(closest);
  }
  return { size, cell, mask, sites };
}

const sourceKeys = ["features", "siteShape", "gridSize", "disorder", "extent", "aspect", "orientation", "centerX", "centerY"] as const;
type DistanceField = FeatureSource & { distances: (number | null)[]; nearestIndices: (number | null)[] };
const fields = new Map<string, DistanceField>();
/** Bounded structural cache: palette, contour radii, display and material never reroll sites or EDT. */
export function featureDistanceField(q: Params, seed: number, kind: Kind = ("startRadius" in q ? "distance-halos" : "nearest-feature-mosaic")): DistanceField {
  validateFeatureDistance(q, kind);
  const key = JSON.stringify([seed, ...sourceKeys.map(name => q[name])]);
  const prior = fields.get(key);
  if (prior) { fields.delete(key); fields.set(key, prior); return prior; }
  const source = makeFeatureSource(q, seed);
  const { distances, nearestIndices } = euclideanDistanceTransform2D({
    mask: source.mask, columns: source.size, rows: source.size, maxWork: 6 * source.size ** 2,
  });
  const result = { ...source, distances, nearestIndices };
  fields.set(key, result);
  if (fields.size > 4) fields.delete(fields.keys().next().value!);
  return result;
}

export function drawFeatureDistanceInstrument(p: Painter, layer: Layer): void {
  const q = layer.params, kind = layer.technique;
  if (kind !== "distance-halos" && kind !== "nearest-feature-mosaic") throw Error("Unknown feature-distance instrument");
  // Empty material still receives full input validation; a visible layer validates in the field call.
  const halos = kind === "distance-halos";
  if (halos ? q.weight === 0 && (!q.showSites || q.siteSize === 0) :
    (q.display === "boundaries" || q.cellCoverage === 0) && (q.display === "regions" || q.boundaryWidth === 0) && (!q.showSites || q.siteSize === 0)) {
    validateFeatureDistance(q, kind);
    return;
  }
  const { size, cell, sites, distances, nearestIndices } = featureDistanceField(q, layer.seed, kind);
  const palette = layer.palette.map(channels);
  const color = (index: number) => palette[index % palette.length];
  if (halos) {
    if (number(q, "weight") > 0) {
      p.noFill(); p.strokeWeight(number(q, "weight"));
      for (let ring = 0; ring < number(q, "rings"); ring++) {
        const threshold = number(q, "startRadius") + ring * number(q, "radius");
        if (threshold >= Math.SQRT2 * (size - 1)) break;
        const { segments } = marchingSquares2D({ values: distances, columns: size, rows: size,
          origin: [20 + cell / 2, 20 + cell / 2], spacing: [cell, cell], threshold,
          maxWork: size * size + (size - 1) ** 2 });
        p.stroke(...color(ring), 215);
        for (const [x1, y1, x2, y2] of segments) p.line(x1, y1, x2, y2);
      }
    }
  } else {
    const radius = number(q, "supportRadius"), coverage = number(q, "cellCoverage");
    const supported = (index: number) => (distances[index] ?? Infinity) <= radius;
    if (q.display !== "boundaries" && coverage > 0) {
      p.noStroke();
      const margin = (1 - coverage) * cell / 2;
      let previousColor = -1;
      for (let i = 0; i < distances.length; i++) {
        if (!supported(i)) continue;
        const owner = nearestIndices[i];
        if (owner === null) continue;
        const colorIndex = owner % palette.length;
        if (colorIndex !== previousColor) { p.fill(...palette[colorIndex], 205); previousColor = colorIndex; }
        p.rect(20 + (i % size) * cell + margin, 20 + Math.floor(i / size) * cell + margin,
          cell * coverage, cell * coverage);
      }
    }
    if (q.display !== "regions" && number(q, "boundaryWidth") > 0) {
      p.noFill(); p.stroke(...color(0), 230); p.strokeWeight(number(q, "boundaryWidth"));
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (!supported(i)) continue;
        if (x + 1 < size && supported(i + 1) && nearestIndices[i] !== nearestIndices[i + 1])
          p.line(20 + (x + 1) * cell, 20 + y * cell, 20 + (x + 1) * cell, 20 + (y + 1) * cell);
        if (y + 1 < size && supported(i + size) && nearestIndices[i] !== nearestIndices[i + size])
          p.line(20 + x * cell, 20 + (y + 1) * cell, 20 + (x + 1) * cell, 20 + (y + 1) * cell);
      }
    }
  }
  if (q.showSites && number(q, "siteSize") > 0) {
    p.noStroke(); p.fill(...color(halos ? 1 : 0), 245);
    for (const index of sites) p.circle(20 + (index % size + .5) * cell,
      20 + (Math.floor(index / size) + .5) * cell, number(q, "siteSize"));
  }
}
