import { lloydRelaxation2D, voronoiCells2D } from "@procedurals/javascript";
import type { ControlGroup, Layer, Parameter } from "../types.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Painter = {
  CLOSE: string;
  noFill(): void; noStroke(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(weight: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
};




const parameters: Parameter[] = [numeric("sites", "Sites", "Exact number of initial sites.", 2, 48, 1, { hardMin: 1, hardMax: 96, integer: true }),
  choice("arrangement", "Initial arrangement", "Site distribution within the local rectangular domain.", ["area", "ring", "grid", "cluster"]),
  numeric("spread", "Site spread", "Source footprint relative to the domain; lower values cluster sites near the center.", .1, 1, .01, { hardMin: .05, hardMax: 1 }),
  numeric("disorder", "Disorder", "Seeded independent local position jitter; zero is fully ordered.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
  numeric("iterations", "Relaxation passes", "Synchronous Lloyd updates, each retained for trajectories.", 0, 8, 1, { hardMin: 0, hardMax: 12, integer: true }),
  numeric("strength", "Relaxation strength", "Fraction of the site-to-centroid displacement per pass.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
  numeric("centerX", "Domain center X", "Horizontal placement in canvas units; can be off canvas.", 0, 640, 1, { hardMin: -5000, hardMax: 5000 }),
  numeric("centerY", "Domain center Y", "Vertical placement in canvas units; can be off canvas.", 0, 640, 1, { hardMin: -5000, hardMax: 5000 }),
  numeric("domainWidth", "Domain width", "Physical width of the local Voronoi rectangle, in canvas units.", 20, 620, 1, { hardMin: .01, hardMax: 2000 }),
  numeric("domainHeight", "Domain height", "Physical height of the local Voronoi rectangle, in canvas units.", 20, 620, 1, { hardMin: .01, hardMax: 2000 }),
  numeric("domainRotation", "Domain rotation", "Rotate the entire local source and geometry about its center, degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  numeric("cellInset", "Cell inset (units)", "Pull each polygon vertex toward its site by this many canvas units, never a proportional scale.", 0, 24, .25, { hardMin: 0, hardMax: 2000 }),
  numeric("fillOpacity", "Cell fill", "Cell fill opacity; zero disables fills without disabling outlines.", 0, 255, 1, { hardMin: 0, hardMax: 255 }),
  numeric("outlineWeight", "Cell outline", "Independent outer cell border width; zero disables outlines.", 0, 6, .1, { hardMin: 0, hardMax: 50 }),
  toggle("facets", "Facets", "Draw translucent triangles from final sites to alternating edges inside the filled cells."),
  numeric("facetOpacity", "Facet opacity", "Independent triangular accent opacity; zero disables facets.", 0, 255, 1, { hardMin: 0, hardMax: 255 }),
  numeric("echoes", "Nested echoes", "Number of nested outlines within each final cell; zero removes echoes.", 0, 12, 1, { hardMin: 0, hardMax: 16, integer: true }),
  numeric("echoWeight", "Echo stroke", "Width of the nested outlines, independent of outer cells and trajectories.", 0, 4, .1, { hardMin: 0, hardMax: 50 }),
  toggle("alternating", "Alternating echoes", "Advance palette index for each nested outline, otherwise color by site."),
  numeric("trailWeight", "Trail weight", "Independent per-site trajectory width; zero disables trails.", 0, 6, .1, { hardMin: 0, hardMax: 50 }),
  numeric("initialSize", "Initial sites", "Diameter of marks at the original positions; zero hides them.", 0, 14, .25, { hardMin: 0, hardMax: 60 }),
  toggle("dots", "Final site dots", "Show the final sites independently of cell and trail materials."),
  numeric("finalSize", "Final dot size", "Final-site mark diameter; zero hides them even when dots are enabled.", 0, 14, .25, { hardMin: 0, hardMax: 60 })];
/** The four relaxed-cell instruments share one control set, so they share one organization. */
const controlGroups: ControlGroup[] = [
  { label: "Sites", stage: "form", controls: ["sites", "arrangement", "spread", "disorder"] },
  { label: "Relaxation", stage: "process", controls: ["iterations", "strength"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["domainWidth", "domainHeight"], proportional: true }, "domainRotation"] },
  { label: "Cells", stage: "form", controls: ["cellInset", "fillOpacity", "outlineWeight", "facets", "facetOpacity"] },
  { label: "Echoes", stage: "material", controls: ["echoes", "echoWeight", "alternating"] },
  { label: "Trails and marks", stage: "material", controls: ["trailWeight", "dots",
    { label: "Scale", controls: ["initialSize", "finalSize"], proportional: true }] },
];
const commonDefaults = {sites: 24,
  arrangement: "area",
  spread: 1,
  disorder: .38,
  iterations: 3,
  strength: 1,
  centerX: 320,
  centerY: 320,
  domainWidth: 400,
  domainHeight: 330,
  domainRotation: -12,
  cellInset: 4,
  fillOpacity: 180,
  outlineWeight: .8,
  facets: false,
  facetOpacity: 80,
  echoes: 0,
  echoWeight: 1.1,
  alternating: true,
  trailWeight: 0,
  initialSize: 0,
  dots: false,
  finalSize: 4};

export const relaxedCellInstrumentDefinitions: StudioDefinition[] = [
  { id: "cell-mosaic", title: "Cell mosaic", description: "Inset local Voronoi tiles, site marks and independent faceted accents.",
    parameters, controlGroups, defaults: {...commonDefaults,
      sites: 48,
      arrangement: "grid",
      disorder: .9,
      iterations: 0,
      cellInset: 5,
      facets: true,
      fillOpacity: 225,
      outlineWeight: 0},
    validate: validateRelaxedCells },
  { id: "cell-echoes", title: "Cell echoes", description: "Nested contours of locally constructed Voronoi cells.",
    parameters, controlGroups, defaults: {...commonDefaults,
      sites: 35,
      arrangement: "area",
      spread: .85,
      iterations: 0,
      echoes: 7,
      echoWeight: 1.1,
      fillOpacity: 0,
      outlineWeight: 0,
      cellInset: 0},
    validate: validateRelaxedCells },
  { id: "relaxed-stones", title: "Relaxed stones", description: "Inset Voronoi cells from retained, locally relaxed sites.",
    parameters, controlGroups, defaults: { ...commonDefaults }, validate: validateRelaxedCells },
  { id: "centroid-trails", title: "Centroid trails", description: "Follow each site's synchronous Lloyd centroid moves in a local domain.",
    parameters, controlGroups, defaults: {...commonDefaults,
      sites: 18,
      arrangement: "cluster",
      iterations: 6,
      domainWidth: 430,
      domainHeight: 360,
      fillOpacity: 0,
      outlineWeight: 0,
      trailWeight: 1.2,
      initialSize: 7,
      dots: true,
      finalSize: 4}, validate: validateRelaxedCells },
];

function checked(q: Params, key: string, low: number, high: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high ||
      (integer && !Number.isSafeInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${low}, ${high}]`);
  return value;
}
/** N half-plane clips each visit at most N+3 polygon vertices; add centroid
 * visits and bounded optional echo/facet vertices to the same conservative budget. */
function workBudget(n: number, passes: number, echoes: number): number {
  const clip = n * n + n * (n - 1) * (n + 3);
  const centroid = n * (n + 4);
  return (passes + 1) * clip + passes * (centroid + n + 1) + n * (echoes + 1) * (n + 3);
}
export function validateRelaxedCells(q: Params): void {
  
  if (!["area", "ring", "grid", "cluster"].includes(String(q.arrangement))) throw Error("Unknown site arrangement");
  const n = checked(q, "sites", 1, 96, true), passes = checked(q, "iterations", 0, 12, true);
  const echoes = checked(q, "echoes", 0, 16, true);
  for (const [key, lo, hi] of [
    ["spread", .05, 1], ["disorder", 0, 1], ["strength", 0, 1],
    ["centerX", -5000, 5000], ["centerY", -5000, 5000],
    ["domainWidth", .01, 2000], ["domainHeight", .01, 2000], ["domainRotation", -3600, 3600],
    ["cellInset", 0, 2000], ["fillOpacity", 0, 255], ["outlineWeight", 0, 50],
    ["facetOpacity", 0, 255], ["echoWeight", 0, 50], ["trailWeight", 0, 50],
    ["initialSize", 0, 60], ["finalSize", 0, 60],
  ] as const) checked(q, key, lo, hi);
  for (const name of ["facets", "dots", "alternating"] as const)
    if (typeof q[name] !== "boolean") throw Error(`${name} must be boolean`);
  if (workBudget(n, passes, echoes) > 3_000_000)
    throw Error("Sites × passes × echoes exceeds the 3,000,000-unit core/mark work budget");
}

export type RelaxedCellSource = { history: Point[][]; cells: Point[][]; bounds: [number, number, number, number] };
const sourceKeys = ["sites", "arrangement", "spread", "disorder", "iterations", "strength", "domainWidth", "domainHeight"] as const;
const cache = new Map<string, RelaxedCellSource>();
/** Geometry is computed in the local unrotated domain; placement, palette and mark settings never rerun Lloyd. */
export function relaxedCellSource(q: Params, seed: number): RelaxedCellSource {
  validateRelaxedCells(q);
  const key = JSON.stringify([q.disorder === 0 ? 0 : seed >>> 0, ...sourceKeys.map(name => q[name])]);
  const found = cache.get(key);
  if (found) return found;
  const n = Number(q.sites), width = Number(q.domainWidth), height = Number(q.domainHeight);
  const bounds: [number, number, number, number] = [0, 0, width, height];
  let state = seed >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const initial: Point[] = [];
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    let u: number, v: number;
    if (q.arrangement === "area") {
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      const radius = .76 * Math.sqrt((i + .5) / n);
      u = radius * Math.cos(angle); v = radius * Math.sin(angle);
    } else if (q.arrangement === "ring") {
      const angle = 2 * Math.PI * i / n;
      u = .72 * Math.cos(angle); v = .72 * Math.sin(angle);
    } else if (q.arrangement === "grid") {
      u = .72 * ((i % cols + .5) / cols * 2 - 1);
      v = .72 * ((Math.floor(i / cols) + .5) / rows * 2 - 1);
    } else {
      const cluster = i % 3, angle = (i / 3) * Math.PI * (3 - Math.sqrt(5));
      const radius = .17 * Math.sqrt((Math.floor(i / 3) + .5) / Math.ceil(n / 3));
      u = (cluster === 0 ? -.51 : cluster === 1 ? .49 : .06) + radius * Math.cos(angle);
      v = (cluster === 0 ? -.39 : cluster === 1 ? -.23 : .46) + radius * Math.sin(angle);
    }
    const jitter = Number(q.disorder) * .12;
    if (jitter) { u += (2 * random() - 1) * jitter; v += (2 * random() - 1) * jitter; }
    // Base layouts stay inside ±.76 (clusters ±.68); jitter ≤.12, spread ≤1. No clipping.
    initial.push([width * (.5 + u * Number(q.spread) * .5), height * (.5 + v * Number(q.spread) * .5)]);
  }
  const history: Point[][] = [initial];
  const clip = n * n + n * (n - 1) * (n + 3);
  for (let pass = 0; pass < Number(q.iterations); pass++) {
    const next = lloydRelaxation2D({ sites: history[pass], bounds, iterations: 1,
      strength: Number(q.strength), maxWork: n + 1 + 2 * Math.max(clip, n * (n + 4)) }).sites as Point[];
    history.push(next);
  }
  const cells = voronoiCells2D({ sites: history[history.length - 1], bounds, maxWork: clip }).cells as Point[][];
  const result = { history, cells, bounds };
  cache.set(key, result);
  if (cache.size > 3) cache.delete(cache.keys().next().value!);
  return result;
}

export function drawRelaxedCellInstrument(p: Painter, layer: Layer): void {
  const q = layer.params;
  validateRelaxedCells(q);
  if (q.fillOpacity === 0 && q.outlineWeight === 0 && (!q.facets || q.facetOpacity === 0) &&
      (q.echoes === 0 || q.echoWeight === 0) && q.trailWeight === 0 && q.initialSize === 0 &&
      (!q.dots || q.finalSize === 0)) return;
  const { history, cells } = relaxedCellSource(q, layer.seed);
  const palette = layer.palette.map(channels);
  const radians = Number(q.domainRotation) * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const cx = Number(q.centerX), cy = Number(q.centerY);
  const halfW = Number(q.domainWidth) / 2, halfH = Number(q.domainHeight) / 2;
  const toCanvas = ([x, y]: Point): Point => {
    const dx = x - halfW, dy = y - halfH;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };
  const latest = history[history.length - 1];
  for (let i = 0; i < cells.length; i++) {
    const color = palette[i % palette.length];
    const cell = cells[i];
    if (cell.length > 0 && (Number(q.fillOpacity) > 0 || Number(q.outlineWeight) > 0 ||
      (q.facets && Number(q.facetOpacity) > 0) || Number(q.echoWeight) > 0 && Number(q.echoes) > 0)) {
      const tile = cell.map(vertex => {
        const dx = vertex[0] - latest[i][0], dy = vertex[1] - latest[i][1];
        const distance = Math.hypot(dx, dy);
        const fraction = distance === 0 ? 0 : Math.max(0, 1 - Number(q.cellInset) / distance);
        return toCanvas([latest[i][0] + dx * fraction, latest[i][1] + dy * fraction]);
      });
      if (Number(q.fillOpacity) > 0 || Number(q.outlineWeight) > 0) {
        if (Number(q.fillOpacity) > 0) p.fill(...color, Number(q.fillOpacity)); else p.noFill();
        if (Number(q.outlineWeight) > 0) { p.stroke(...color, 235); p.strokeWeight(Number(q.outlineWeight)); }
        else p.noStroke();
        p.beginShape();
        for (const [x, y] of tile) p.vertex(x, y);
        p.endShape(p.CLOSE);
      }
      if (q.facets && Number(q.facetOpacity) > 0) {
        p.noStroke(); p.fill(...palette[(i + 1) % palette.length], Number(q.facetOpacity));
        const [sx, sy] = toCanvas(latest[i]);
        for (let v = 0; v < tile.length; v += 2) {
          const a = tile[v], b = tile[(v + 1) % tile.length];
          p.triangle(sx, sy, a[0], a[1], b[0], b[1]);
        }
      }
      if (Number(q.echoes) > 0 && Number(q.echoWeight) > 0) {
        p.noFill(); p.strokeWeight(Number(q.echoWeight));
        const [sx, sy] = toCanvas(latest[i]);
        for (let echo = 1; echo <= Number(q.echoes); echo++) {
          p.stroke(...palette[(i + (q.alternating ? echo : 0)) % palette.length], 205);
          const scale = echo / (Number(q.echoes) + .6);
          p.beginShape();
          for (const [x, y] of tile) p.vertex(sx + (x - sx) * scale, sy + (y - sy) * scale);
          p.endShape(p.CLOSE);
        }
      }
    }
    if (Number(q.trailWeight) > 0 && history.length > 1) {
      p.stroke(...color, 210); p.strokeWeight(Number(q.trailWeight));
      for (let pass = 1; pass < history.length; pass++) {
        const [x1, y1] = toCanvas(history[pass - 1][i]);
        const [x2, y2] = toCanvas(history[pass][i]);
        p.line(x1, y1, x2, y2);
      }
    }
    if (Number(q.initialSize) > 0) {
      p.noStroke(); p.fill(...color, 150);
      p.circle(...toCanvas(history[0][i]), Number(q.initialSize));
    }
    if (q.dots && Number(q.finalSize) > 0) {
      p.noStroke(); p.fill(...color, 245);
      p.circle(...toCanvas(latest[i]), Number(q.finalSize));
    }
  }
}
