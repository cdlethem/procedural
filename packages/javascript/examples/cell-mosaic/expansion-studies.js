import { voronoiCells2D } from "../../src/voronoi-cells-2d.js";
import { resamplePolyline2D } from "../../src/resample-polyline-2d.js";
import { marchingSquares2D } from "../../src/marching-squares-2d.js";
import { gradientNoise2D01 } from "../../src/gradient-noise-2d-01.js";
import { JavaRandom } from "../city-marks/city-marks.js";

const palettes = [
  [[28, 66, 86], [231, 133, 72], [238, 205, 112], [171, 70, 83]],
  [[46, 47, 90], [113, 178, 161], [244, 214, 122], [215, 100, 86]],
];
const defaults = {
  "cell-mosaic": { sites: 48, disorder: .9, inset: .04, facets: true, dots: false },
  "cell-echoes": { sites: 35, echoes: 7, spread: .85, weight: 1.1, alternating: true },
  "stitched-paths": { rows: 12, amplitude: 24, waves: 1.8, stitches: 65, length: 9, thread: true },
  "orbit-beads": { orbits: 9, beads: 85, lobes: 3, depth: .13, size: 3.75, thread: false },
  "contour-terrain": { levels: 15, scale: .007, resolution: 72, weight: .9, indexLines: true },
  "contour-blobs": { sources: 6, radius: 70, threshold: .35, levels: 7, weight: 1.3, centers: false },
};
const titles = { "cell-mosaic": "cell mosaic", "cell-echoes": "cell echoes", "stitched-paths": "stitched paths", "orbit-beads": "orbit beads", "contour-terrain": "contour terrain", "contour-blobs": "contour blobs" };
const point = (p, points) => { p.beginShape(); for (const [x, y] of points) p.vertex(x, y); p.endShape(p.CLOSE); };
const color = (alternate, index) => palettes[alternate ? 1 : 0][index % 4];

export function createExpansionSketch(kind) {
  const art = document.querySelector("#art"), controls = document.querySelector("#controls"), status = document.querySelector("#status");
  const settings = { seed: 42, alternate: false, geometry: false };
  let revision = 0;
  new window.p5((p) => {
    p.setup = () => { p.createCanvas(640, 640, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); paint(); };
    function paint() {
      p.background(248, 245, 238);
      const q = { ...defaults[kind] };
      if (settings.geometry) geometryEdit(kind, q);
      draw(kind, p, q, settings.seed, settings.alternate);
      revision += 1; art.dataset.revision = String(revision);
      status.textContent = `${titles[kind]} · seed ${settings.seed} · ${settings.geometry ? "structural edit" : "default structure"} · ${settings.alternate ? "alternate palette" : "base palette"}`;
    }
    function action(name) {
      if (name === "t") settings.geometry = !settings.geometry;
      else if (name === "c") settings.alternate = !settings.alternate;
      else if (name === "0") Object.assign(settings, { seed: 42, alternate: false, geometry: false });
      else if (name === "s") { p.saveCanvas(kind, "png"); return; }
      else return;
      paint();
    }
    controls.addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); if (button) action(button.dataset.action); });
    p.keyPressed = () => action(String(p.key).toLowerCase());
  }, art);
}

function geometryEdit(kind, q) {
  if (kind === "cell-mosaic") q.sites = 72;
  if (kind === "cell-echoes") q.echoes = 11;
  if (kind === "stitched-paths") q.waves = 3.1;
  if (kind === "orbit-beads") q.lobes = 5;
  if (kind === "contour-terrain") q.levels = 20;
  if (kind === "contour-blobs") q.radius = 94;
}

function draw(kind, p, q, seed, alternate) {
  if (kind === "cell-mosaic") return mosaic(p, q, seed, alternate);
  if (kind === "cell-echoes") return echoes(p, q, seed, alternate);
  if (kind === "stitched-paths") return stitches(p, q, seed, alternate);
  if (kind === "orbit-beads") return beads(p, q, seed, alternate);
  if (kind === "contour-terrain") return terrain(p, q, seed, alternate);
  return blobs(p, q, seed, alternate);
}

function mosaic(p, q, seed, alternate) {
  const random = new JavaRandom(seed), columns = Math.ceil(Math.sqrt(q.sites)), rows = Math.ceil(q.sites / columns);
  const sites = Array.from({ length: q.sites }, (_, i) => [32 + ((i % columns) + .5 + (random.nextDouble() - .5) * q.disorder) * 576 / columns, 32 + (Math.floor(i / columns) + .5 + (random.nextDouble() - .5) * q.disorder) * 576 / rows]);
  const { cells } = voronoiCells2D({ sites, bounds: [32, 32, 608, 608], maxWork: 2_000_000 }); p.noStroke();
  cells.forEach((cell, i) => { const [cx, cy] = sites[i], tile = cell.map(([x, y]) => [cx + (x - cx) * (1 - q.inset), cy + (y - cy) * (1 - q.inset)]); p.fill(...color(alternate, i), 225); point(p, tile); if (q.facets) { p.fill(...color(alternate, i + 1), 80); for (let v = 0; v < tile.length; v += 2) { const a = tile[v], b = tile[(v + 1) % tile.length]; p.triangle(cx, cy, a[0], a[1], b[0], b[1]); } } });
}

function echoes(p, q, seed, alternate) {
  const random = new JavaRandom(seed), sites = Array.from({ length: q.sites }, () => [320 + (random.nextDouble() - .5) * 550 * q.spread, 320 + (random.nextDouble() - .5) * 550 * q.spread]);
  const { cells } = voronoiCells2D({ sites, bounds: [32, 32, 608, 608], maxWork: 2_000_000 }); p.noFill(); p.strokeWeight(q.weight);
  cells.forEach((cell, i) => { const [cx, cy] = sites[i]; for (let echo = 1; echo <= q.echoes; echo++) { p.stroke(...color(alternate, i + (q.alternating ? echo : 0)), 205); point(p, cell.map(([x, y]) => [cx + (x - cx) * echo / (q.echoes + .6), cy + (y - cy) * echo / (q.echoes + .6)])); } });
}

function stitches(p, q, seed, alternate) {
  const random = new JavaRandom(seed); p.noFill(); p.strokeCap(p.ROUND);
  for (let row = 0; row < q.rows; row++) { const phase = random.nextDouble() * Math.PI * 2, baseline = 84 + row * 472 / (q.rows - 1), points = Array.from({ length: 161 }, (_, i) => { const t = i / 160; return [40 + t * 560, baseline + Math.sin(t * q.waves * Math.PI * 2 + phase) * q.amplitude]; }); const sampled = resamplePolyline2D({ points, closed: false, count: q.stitches, maxWork: 1000 }); if (q.thread) { p.stroke(...color(alternate, row), 90); p.strokeWeight(.6); p.beginShape(); points.forEach(([x, y]) => p.vertex(x, y)); p.endShape(); } p.stroke(...color(alternate, row), 240); p.strokeWeight(1.4); sampled.points.forEach(([x, y], i) => { const a = points[sampled.sourceSegments[i]], b = points[sampled.sourceSegments[i] + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / length * q.length / 2, ny = (b[0] - a[0]) / length * q.length / 2; p.line(x - nx, y - ny, x + nx, y + ny); }); }
}

function beads(p, q, seed, alternate) {
  const phase = new JavaRandom(seed).nextDouble() * Math.PI * 2;
  for (let orbit = 0; orbit < q.orbits; orbit++) { const radius = 46 + orbit * 184 / (q.orbits - 1), points = Array.from({ length: 240 }, (_, i) => { const angle = i / 240 * Math.PI * 2, r = radius * (1 + q.depth * Math.sin(angle * q.lobes + phase + orbit * .27)); return [320 + Math.cos(angle) * r, 320 + Math.sin(angle) * r]; }), sampled = resamplePolyline2D({ points, closed: true, count: q.beads, maxWork: 1000 }); if (q.thread) { p.noFill(); p.stroke(...color(alternate, orbit), 95); p.strokeWeight(.65); point(p, points); } p.noStroke(); p.fill(...color(alternate, orbit), 235); sampled.points.forEach(([x, y]) => p.circle(x, y, q.size)); }
}

function terrain(p, q, seed, alternate) {
  const field = gradientNoise2D01({ seed }), n = q.resolution, spacing = 576 / (n - 1), values = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) values.push(field.sample((32 + x * spacing) * q.scale, (32 + y * spacing) * q.scale)); p.noFill(); p.strokeCap(p.ROUND);
  for (let level = 0; level < q.levels; level++) { const { segments } = marchingSquares2D({ values, columns: n, rows: n, origin: [32, 32], spacing: [spacing, spacing], threshold: .22 + (level + .5) / q.levels * .56, maxWork: 20_000 }); p.stroke(...color(alternate, level), 220); p.strokeWeight(q.weight * (q.indexLines && level % 4 === 0 ? 1.9 : 1)); segments.forEach(([x1, y1, x2, y2]) => p.line(x1, y1, x2, y2)); }
}

function blobs(p, q, seed, alternate) {
  const random = new JavaRandom(seed), hills = Array.from({ length: q.sources }, () => ({ x: 105 + random.nextDouble() * 430, y: 105 + random.nextDouble() * 430, radius: q.radius * (.75 + random.nextDouble() * .5) })), n = 81, spacing = 576 / (n - 1), values = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let value = 0; hills.forEach((hill) => { const dx = 32 + x * spacing - hill.x, dy = 32 + y * spacing - hill.y; value += Math.exp(-(dx * dx + dy * dy) / (2 * hill.radius * hill.radius)); }); values.push(value); }
  p.noFill(); p.strokeCap(p.ROUND); p.strokeWeight(q.weight); for (let level = 0; level < q.levels; level++) { const { segments } = marchingSquares2D({ values, columns: n, rows: n, origin: [32, 32], spacing: [spacing, spacing], threshold: q.threshold + level * .14, maxWork: 20_000 }); p.stroke(...color(alternate, level), 235); segments.forEach(([x1, y1, x2, y2]) => p.line(x1, y1, x2, y2)); }
}
