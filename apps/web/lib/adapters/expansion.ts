import type { Layer } from "../studio-types";
import { numeric, toggle, channels, type StudioDefinition } from "./types";
import { voronoiCells2D } from "@procedurals/javascript"
import { resamplePolyline2D } from "@procedurals/javascript"
import { marchingSquares2D } from "@procedurals/javascript"
import { gradientNoise2D01 } from "@procedurals/javascript"
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js"

type Point = [number, number];
type Controls = Record<string, any>;

/** Canvas composition settings; these bounds are choices for the editable studies. */
export const expansionDefinitions: StudioDefinition[] = [
  {
    id: "cell-mosaic", title: "Cell mosaic",
    description: "Nearest-site cells become colored tiles with independently editable spacing and facets.",
    parameters: [
      numeric("sites", "Cells", "Number of sites dividing the canvas.", 8, 100, 1),
      numeric("disorder", "Disorder", "Move sites away from their regular rows.", 0, 1, 0.05),
      numeric("inset", "Tile inset", "Shrink each tile toward its site, opening clear seams.", 0, 0.24, 0.01),
      toggle("facets", "Facets", "Add translucent triangular accents inside each tile."),
      toggle("dots", "Site dots", "Mark the sites that control the cell boundaries."),
    ],
    defaults: { sites: 48, disorder: 0.9, inset: 0.04, facets: true, dots: false },
  },
  {
    id: "cell-echoes", title: "Cell echoes",
    description: "Nested outlines echo inside a field of irregular nearest-site cells.",
    parameters: [
      numeric("sites", "Cells", "Number of irregular regions.", 8, 90, 1),
      numeric("echoes", "Echoes", "Nested outlines inside each cell.", 2, 16, 1),
      numeric("spread", "Site spread", "Move the sites from the center toward the outer canvas.", 0.35, 1, 0.05),
      numeric("weight", "Line weight", "Width of each polygon outline.", 0.4, 2.5, 0.1),
      toggle("alternating", "Alternating colors", "Cycle the palette through the nested outlines."),
    ],
    defaults: { sites: 35, echoes: 7, spread: 0.85, weight: 1.1, alternating: true },
  },
  {
    id: "stitched-paths", title: "Stitched paths",
    description: "Evenly spaced cross stitches follow explicit wave-shaped paths.",
    parameters: [
      numeric("rows", "Rows", "Number of independent stitched paths.", 4, 22, 1),
      numeric("amplitude", "Wave height", "Vertical excursion of each supplied path.", 4, 65, 1),
      numeric("waves", "Wave count", "Undulations across the canvas.", 0.5, 4, 0.1),
      numeric("stitches", "Stitches per path", "Marks evenly spaced by traveled distance.", 20, 150, 1),
      numeric("length", "Stitch length", "Length of the perpendicular thread marks.", 2, 18, 0.5),
      toggle("thread", "Connecting thread", "Show the original path beneath its stitches."),
    ],
    defaults: { rows: 12, amplitude: 24, waves: 1.8, stitches: 65, length: 9, thread: true },
  },
  {
    id: "orbit-beads", title: "Orbit beads",
    description: "Beads follow nested closed orbits with equal travel distance between marks.",
    parameters: [
      numeric("orbits", "Orbits", "Number of nested closed paths.", 3, 14, 1),
      numeric("beads", "Beads per orbit", "Evenly spaced marks on each loop.", 16, 180, 1),
      numeric("lobes", "Lobes", "Broad radial waves in the supplied outlines.", 2, 7, 1),
      numeric("depth", "Lobe depth", "Strength of the radial waves.", 0, 0.24, 0.01),
      numeric("size", "Bead size", "Diameter of the circular marks.", 1, 8, 0.25),
      toggle("thread", "Orbit lines", "Show the supplied closed outlines beneath the beads."),
    ],
    defaults: { orbits: 9, beads: 85, lobes: 3, depth: 0.13, size: 3.75, thread: false },
  },
  {
    id: "contour-terrain", title: "Contour terrain",
    description: "Layered contour strokes reveal a sampled noise field like a topographic drawing.",
    parameters: [
      numeric("levels", "Contour levels", "Number of separate height thresholds.", 4, 24, 1),
      numeric("scale", "Terrain scale", "Field frequency across the drawing; larger values make smaller features.", 0.003, 0.018, 0.001),
      numeric("resolution", "Grid samples", "Samples along each side; finer grids resolve the same terrain.", 32, 96, 4),
      numeric("weight", "Line weight", "Contour stroke width.", 0.4, 2.5, 0.1),
      toggle("indexLines", "Index lines", "Emphasize every fourth contour."),
    ],
    defaults: { levels: 15, scale: 0.007, resolution: 72, weight: 0.9, indexLines: true },
  },
  {
    id: "contour-blobs", title: "Contour blobs",
    description: "Contours wrap around overlapping soft hills and merge as their level changes.",
    parameters: [
      numeric("sources", "Hills", "Number of seeded peaks in the supplied scalar field.", 2, 12, 1),
      numeric("radius", "Hill radius", "Spread of each soft peak; wider hills merge more readily.", 30, 110, 2),
      numeric("threshold", "First level", "Lowest traced scalar level.", 0.15, 1.2, 0.05),
      numeric("levels", "Contour levels", "Nested thresholds spaced 0.14 scalar units apart.", 2, 12, 1),
      numeric("weight", "Line weight", "Width of the contour strokes.", 0.5, 3, 0.1),
      toggle("centers", "Peak marks", "Show a small cross at each supplied hill center."),
    ],
    defaults: { sources: 6, radius: 70, threshold: 0.35, levels: 7, weight: 1.3, centers: false },
  },
];

export function drawExpansion(p: any, layer: Layer): void {
  switch (layer.technique) {
    case "cell-mosaic": return cellMosaic(p, layer);
    case "cell-echoes": return cellEchoes(p, layer);
    case "stitched-paths": return stitchedPaths(p, layer);
    case "orbit-beads": return orbitBeads(p, layer);
    case "contour-terrain": return contourTerrain(p, layer);
    case "contour-blobs": return contourBlobs(p, layer);
    default: throw new Error(`Unknown expansion technique: ${layer.technique}`);
  }
}

function palette(layer: Layer, index: number): [number, number, number] {
  return channels(layer.palette[index % layer.palette.length]);
}

function polygon(p: any, points: number[][]): void {
  p.beginShape();
  for (const [x, y] of points) p.vertex(x, y);
  p.endShape(p.CLOSE);
}

function cellMosaic(p: any, layer: Layer): void {
  const q = layer.params as Controls, random = new JavaRandom(layer.seed);
  const columns = Math.ceil(Math.sqrt(q.sites)), rows = Math.ceil(q.sites / columns);
  const sites: Point[] = Array.from({ length: q.sites }, (_, i) => [
    32 + ((i % columns) + 0.5 + (random.nextDouble() - 0.5) * q.disorder) * 576 / columns,
    32 + (Math.floor(i / columns) + 0.5 + (random.nextDouble() - 0.5) * q.disorder) * 576 / rows,
  ]);
  const { cells } = voronoiCells2D({ sites, bounds: [32, 32, 608, 608], maxWork: 2_000_000 });
  p.noStroke();
  for (let i = 0; i < cells.length; i++) {
    const [cx, cy] = sites[i];
    const tile = cells[i].map(([x, y]: number[]) => [cx + (x - cx) * (1 - q.inset), cy + (y - cy) * (1 - q.inset)]);
    p.fill(...palette(layer, i), 225);
    polygon(p, tile);
    if (q.facets) {
      p.fill(...palette(layer, i + 1), 80);
      for (let v = 0; v < tile.length; v += 2) {
        const a = tile[v], b = tile[(v + 1) % tile.length];
        p.triangle(cx, cy, a[0], a[1], b[0], b[1]);
      }
    }
    if (q.dots) {
      p.fill(...palette(layer, i + 2), 240);
      p.circle(cx, cy, 4);
    }
  }
}

function cellEchoes(p: any, layer: Layer): void {
  const q = layer.params as Controls, random = new JavaRandom(layer.seed);
  const sites: Point[] = Array.from({ length: q.sites }, () => [
    320 + (random.nextDouble() - 0.5) * 550 * q.spread,
    320 + (random.nextDouble() - 0.5) * 550 * q.spread,
  ]);
  const { cells } = voronoiCells2D({ sites, bounds: [32, 32, 608, 608], maxWork: 2_000_000 });
  p.noFill();
  p.strokeWeight(q.weight);
  for (let i = 0; i < cells.length; i++) {
    const [cx, cy] = sites[i];
    for (let echo = 1; echo <= q.echoes; echo++) {
      const scale = echo / (q.echoes + 0.6);
      p.stroke(...palette(layer, i + (q.alternating ? echo : 0)), 205);
      polygon(p, cells[i].map(([x, y]: number[]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]));
    }
  }
}

function stitchedPaths(p: any, layer: Layer): void {
  const q = layer.params as Controls, random = new JavaRandom(layer.seed);
  p.noFill();
  p.strokeCap(p.ROUND);
  for (let row = 0; row < q.rows; row++) {
    const phase = random.nextDouble() * Math.PI * 2;
    const baseline = 84 + row * 472 / (q.rows - 1);
    const points: Point[] = Array.from({ length: 161 }, (_, i) => {
      const t = i / 160;
      return [40 + t * 560, baseline + Math.sin(t * q.waves * Math.PI * 2 + phase) * q.amplitude];
    });
    const sampled = resamplePolyline2D({ points, closed: false, count: q.stitches, maxWork: 1000 });
    if (q.thread) {
      p.stroke(...palette(layer, row), 90);
      p.strokeWeight(0.6);
      p.beginShape();
      for (const [x, y] of points) p.vertex(x, y);
      p.endShape();
    }
    p.stroke(...palette(layer, row), 240);
    p.strokeWeight(1.4);
    for (let i = 0; i < sampled.points.length; i++) {
      const [x, y] = sampled.points[i], segment = sampled.sourceSegments[i];
      const a = points[segment], b = points[segment + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      const nx = -dy / length * q.length / 2, ny = dx / length * q.length / 2;
      p.line(x - nx, y - ny, x + nx, y + ny);
    }
  }
}

function orbitBeads(p: any, layer: Layer): void {
  const q = layer.params as Controls, random = new JavaRandom(layer.seed);
  const phase = random.nextDouble() * Math.PI * 2;
  for (let orbit = 0; orbit < q.orbits; orbit++) {
    const radius = 46 + orbit * 184 / (q.orbits - 1);
    const points: Point[] = Array.from({ length: 240 }, (_, i) => {
      const angle = i / 240 * Math.PI * 2;
      const r = radius * (1 + q.depth * Math.sin(angle * q.lobes + phase + orbit * 0.27));
      return [320 + Math.cos(angle) * r, 320 + Math.sin(angle) * r];
    });
    const sampled = resamplePolyline2D({ points, closed: true, count: q.beads, maxWork: 1000 });
    if (q.thread) {
      p.noFill();
      p.stroke(...palette(layer, orbit), 95);
      p.strokeWeight(0.65);
      polygon(p, points);
    }
    p.noStroke();
    p.fill(...palette(layer, orbit), 235);
    for (const [x, y] of sampled.points) p.circle(x, y, q.size);
  }
}

function contourTerrain(p: any, layer: Layer): void {
  const q = layer.params as Controls, field = gradientNoise2D01({ seed: layer.seed });
  const n = q.resolution, spacing = 576 / (n - 1);
  const values: number[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) values.push(field.sample((32 + x * spacing) * q.scale, (32 + y * spacing) * q.scale));
  }
  p.noFill();
  p.strokeCap(p.ROUND);
  for (let level = 0; level < q.levels; level++) {
    const threshold = 0.22 + (level + 0.5) / q.levels * 0.56;
    const { segments } = marchingSquares2D({ values, columns: n, rows: n, origin: [32, 32], spacing: [spacing, spacing], threshold, maxWork: 20_000 });
    p.stroke(...palette(layer, level), 220);
    p.strokeWeight(q.weight * (q.indexLines && level % 4 === 0 ? 1.9 : 1));
    for (const [x1, y1, x2, y2] of segments) p.line(x1, y1, x2, y2);
  }
}

function contourBlobs(p: any, layer: Layer): void {
  const q = layer.params as Controls, random = new JavaRandom(layer.seed);
  const hills = Array.from({ length: q.sources }, () => ({
    x: 105 + random.nextDouble() * 430,
    y: 105 + random.nextDouble() * 430,
    radius: q.radius * (0.75 + random.nextDouble() * 0.5),
  }));
  const n = 81, spacing = 576 / (n - 1), values: number[] = [];
  // The caller supplies a field: a simple sum of soft radial peaks.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let value = 0;
      for (const hill of hills) {
        const dx = 32 + x * spacing - hill.x, dy = 32 + y * spacing - hill.y;
        value += Math.exp(-(dx * dx + dy * dy) / (2 * hill.radius * hill.radius));
      }
      values.push(value);
    }
  }
  p.noFill();
  p.strokeCap(p.ROUND);
  p.strokeWeight(q.weight);
  for (let level = 0; level < q.levels; level++) {
    const { segments } = marchingSquares2D({ values, columns: n, rows: n, origin: [32, 32], spacing: [spacing, spacing], threshold: q.threshold + level * 0.14, maxWork: 20_000 });
    p.stroke(...palette(layer, level), 235);
    for (const [x1, y1, x2, y2] of segments) p.line(x1, y1, x2, y2);
  }
  if (q.centers) {
    p.strokeWeight(1.5);
    hills.forEach((hill, index) => {
      p.stroke(...palette(layer, index), 230);
      p.line(hill.x - 3, hill.y, hill.x + 3, hill.y);
      p.line(hill.x, hill.y - 3, hill.x, hill.y + 3);
    });
  }
}
