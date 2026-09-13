import { chaikinPolyline2D } from "../src/chaikin-polyline-2d.js";
import { simplifyPolyline2D } from "../src/simplify-polyline-2d.js";
import { offsetPolyline2D } from "../src/offset-polyline-2d.js";
import { convexHull2D } from "../src/convex-hull-2d.js";
import { triangulateSimplePolygon2D } from "../src/triangulate-simple-polygon-2d.js";

export const pathsASettings = {
  "rounded-panels": { defaults: { iterations: 3, panels: 5, weight: 2 }, structuralEdit: { panels: 8 } },
  "flowing-brushes": { defaults: { iterations: 3, rows: 8, weight: 3 }, structuralEdit: { rows: 13 } },
  "contour-abstraction": { defaults: { tolerance: 12, layers: 7, weight: 2 }, structuralEdit: { tolerance: 28 } },
  "gesture-skeletons": { defaults: { tolerance: 7, gestures: 7, weight: 3 }, structuralEdit: { gestures: 11 } },
  "road-margins": { defaults: { distance: 13, routes: 5, weight: 2 }, structuralEdit: { distance: 24 } },
  "nested-contour-strokes": { defaults: { distance: 10, rings: 7, weight: 2 }, structuralEdit: { rings: 11 } },
  "scatter-envelopes": { defaults: { count: 44, weight: 2, inset: 18 }, structuralEdit: { count: 80 } },
  "terraced-islands": { defaults: { count: 38, terraces: 6, weight: 2 }, structuralEdit: { terraces: 10 } },
  "faceted-silhouettes": { defaults: { scale: 220, weight: 2, grain: 16 }, structuralEdit: { grain: 28 } },
  "concave-grain": { defaults: { scale: 230, weight: 1, grain: 34 }, structuralEdit: { grain: 58 } },
};
const q = (layer, name) => Number(layer.params[name]);
const color = (p, layer, i, alpha = 255) => { const c = layer.palette[i % layer.palette.length] >>> 0; p.stroke((c >>> 16) & 255, (c >>> 8) & 255, c & 255, alpha); };
const fill = (p, layer, i, alpha = 255) => { const c = layer.palette[i % layer.palette.length] >>> 0; p.fill((c >>> 16) & 255, (c >>> 8) & 255, c & 255, alpha); };
const wave = (y, phase, bends = 6) => Array.from({ length: bends + 1 }, (_, i) => [40 + i * 560 / bends, y + Math.sin(phase + i * 1.3) * 35]);
function linePath(p, points, close = false) { p.beginShape(); for (const point of points) p.vertex(point[0], point[1]); p.endShape(close ? p.CLOSE : undefined); }
function hullSites(seed, count, radius = 210) { return Array.from({ length: count }, (_, i) => { const a = i * 2.3999632297 + seed * .17, r = radius * (.35 + .65 * ((Math.sin(i * 12.9898 + seed) + 1) / 2)); return [320 + Math.cos(a) * r, 320 + Math.sin(a) * r]; }); }

/** Rounded quilt panels made from repeated Chaikin corner cuts. */
export function drawRoundedPanels(p, layer) { p.noFill(); p.strokeWeight(q(layer, "weight")); for (let i = 0; i < q(layer, "panels"); i++) { const x = 70 + (i % 3) * 175, y = 65 + Math.floor(i / 3) * 185, s = 125; const points = chaikinPolyline2D({ points: [[x, y], [x + s, y], [x + s, y + s], [x, y + s]], closed: true, iterations: q(layer, "iterations"), maxWork: 4 * ((2 ** (q(layer, "iterations") + 1)) - 1) }).points; color(p, layer, i, 220); linePath(p, points, true); } }
/** Layered calligraphic ribbons refined from deliberately angular routes. */
export function drawFlowingBrushes(p, layer) { p.noFill(); p.strokeCap(p.ROUND); for (let i = 0; i < q(layer, "rows"); i++) { const points = chaikinPolyline2D({ points: wave(75 + i * 490 / Math.max(1, q(layer, "rows") - 1), layer.seed * .01 + i, 5), closed: false, iterations: q(layer, "iterations"), maxWork: 6 * ((2 ** (q(layer, "iterations") + 1)) - 1) }).points; color(p, layer, i, 165); p.strokeWeight(q(layer, "weight") * (1 + (i % 3) * .35)); linePath(p, points); } }
/** A terrain-like record of the same path at increasingly coarse tolerances. */
export function drawContourAbstraction(p, layer) { const base = Array.from({ length: 90 }, (_, i) => [35 + i * 6.4, 320 + Math.sin(i * .27 + layer.seed) * 110 + Math.sin(i * .71) * 24]); p.noFill(); p.strokeWeight(q(layer, "weight")); for (let i = 0; i < q(layer, "layers"); i++) { const out = simplifyPolyline2D({ points: base, tolerance: q(layer, "tolerance") * (i + 1) / q(layer, "layers"), maxWork: base.length ** 2 }); color(p, layer, i, 200); linePath(p, out.points.map(([x, y]) => [x, y - 145 + i * 290 / Math.max(1, q(layer, "layers") - 1)])); } }
/** Sparse gesture routes whose retained joints become visible skeletons. */
export function drawGestureSkeletons(p, layer) { p.noFill(); p.strokeCap(p.ROUND); p.strokeWeight(q(layer, "weight")); for (let g = 0; g < q(layer, "gestures"); g++) { const raw = Array.from({ length: 28 }, (_, i) => [35 + i * 21, 65 + g * 510 / Math.max(1, q(layer, "gestures") - 1) + Math.sin(i * .62 + g * 1.7) * 23]); const out = simplifyPolyline2D({ points: raw, tolerance: q(layer, "tolerance"), maxWork: raw.length ** 2 }); color(p, layer, g, 190); linePath(p, out.points); for (const v of out.points) { p.noStroke(); fill(p, layer, g, 220); p.circle(v[0], v[1], 5); p.noFill(); } } }
/** Parallel margins reveal the joins and bevels of winding road centerlines. */
export function drawRoadMargins(p, layer) { p.noFill(); p.strokeWeight(q(layer, "weight")); for (let i = 0; i < q(layer, "routes"); i++) { const route = wave(95 + i * 450 / Math.max(1, q(layer, "routes") - 1), i + layer.seed * .02, 4); for (const sign of [-1, 1]) { const out = offsetPolyline2D({ points: route, closed: false, distance: sign * q(layer, "distance"), miterLimit: 1.5, maxWork: route.length * 4 }); color(p, layer, i + (sign > 0 ? 1 : 0), 210); linePath(p, out.points); } } }
/** Nested offset contours turn one closed boundary into a stack of ink rings. */
export function drawNestedContourStrokes(p, layer) { const base = [[155, 115], [455, 95], [540, 280], [430, 500], [190, 515], [85, 300]]; p.noFill(); p.strokeWeight(q(layer, "weight")); for (let i = 0; i < q(layer, "rings"); i++) { const out = offsetPolyline2D({ points: base, closed: true, distance: i * q(layer, "distance") * Math.min(1, 155 / ((q(layer, "rings") - 1) * q(layer, "distance"))), miterLimit: 2, maxWork: base.length * 4 }); color(p, layer, i, 185); linePath(p, out.points, true); } }
/** Convex envelopes make a loose scatter of sites read as bold perimeter marks. */
export function drawScatterEnvelopes(p, layer) { const sites = hullSites(layer.seed, q(layer, "count")); const hull = convexHull2D({ points: sites, maxWork: sites.length ** 2 + sites.length }); p.noFill(); p.strokeWeight(q(layer, "weight")); color(p, layer, 0, 230); linePath(p, hull.points, true); p.noStroke(); for (let i = 0; i < sites.length; i++) { fill(p, layer, i + 1, 165); p.circle(sites[i][0], sites[i][1], q(layer, "inset") * .32); } }
/** A family of hulls at shrinking radii gives islands stepped terrace edges. */
export function drawTerracedIslands(p, layer) { p.noFill(); p.strokeWeight(q(layer, "weight")); for (let t = 0; t < q(layer, "terraces"); t++) { const sites = hullSites(layer.seed + t * 3, q(layer, "count"), 245 - t * 18); const hull = convexHull2D({ points: sites, maxWork: sites.length ** 2 + sites.length }); color(p, layer, t, 190); linePath(p, hull.points, true); } }
function facets(p, layer, polygon, grain) {
  const mesh = triangulateSimplePolygon2D({ points: polygon, maxWork: polygon.length ** 3 + polygon.length ** 2 });
  p.strokeWeight(q(layer, "weight"));
  for (let i = 0; i < mesh.triangles.length; i++) {
    const tri = mesh.triangles[i].map(index => mesh.points[index]);
    fill(p, layer, i, 105); color(p, layer, i + 1, 210); linePath(p, tri, true);
    // Two points on edges sharing a vertex keep every hatch inside its triangle.
    const [a, b, c] = tri; color(p, layer, i, 160);
    for (let j = 1; j <= grain; j++) {
      const t = j / (grain + 1);
      p.line(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]),
        a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1]));
    }
  }
}
/** A convex silhouette split into visible deterministic triangular planes. */
export function drawFacetedSilhouettes(p, layer) { const s = q(layer, "scale"), polygon = [[320 - s * .7, 320 + s * .6], [320 - s * .45, 320 - s * .65], [320 + s * .4, 320 - s * .72], [320 + s * .75, 320 + s * .35], [320, 320 + s * .76]]; facets(p, layer, polygon, q(layer, "grain")); }
/** A concave grain-filled silhouette demonstrates deterministic ear ordering. */
export function drawConcaveGrain(p, layer) { const s = q(layer, "scale"), polygon = [[320 - s, 320 + s * .65], [320 - s * .78, 320 - s * .62], [320 + s * .78, 320 - s * .58], [320 + s * .3, 320], [320 + s, 320 + s * .68], [320, 320 + s]]; facets(p, layer, polygon, q(layer, "grain")); }
