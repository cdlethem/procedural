/** Example-private mirror of the web path-study composition. Keep construction semantics in parity. */
import { chaikinPolyline2D } from "../src/chaikin-polyline-2d.js";
import { offsetPolyline2D } from "../src/offset-polyline-2d.js";
import { triangulateSimplePolygon2D } from "../src/triangulate-simple-polygon-2d.js";
const WORK_LIMIT = 2e5;
const number = (params, key) => Number(params[key]);
const radians = (degrees) => degrees * Math.PI / 180;
function requireBudget(value) {
  if (!Number.isSafeInteger(value) || value > WORK_LIMIT)
    throw new Error("Path study combined generation budget exceeded");
}
function checked(params, key, min, max, integer = false) {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function polygonVertexCount(params) {
  return number(params, "sides") + (number(params, "notch") > 0 ? 1 : 0);
}
function validatePathsAQuality(id, params) {
  if (params.legacy === true) return;
  if (id === "rounded-panels" || id === "nested-contour-strokes") {
    checked(params, "sides", 3, 256, true);
    checked(params, "notch", 0, 0.95);
    checked(params, "aspect", 0.01, 100);
    checked(params, "rotation", -1e6, 1e6);
    checked(params, "weight", 0, 100);
    const n2 = polygonVertexCount(params);
    if (id === "rounded-panels") {
      const panels = checked(params, "panels", 1, 1e3, true);
      const iterations = checked(params, "iterations", 0, 16, true);
      checked(params, "panelSize", 0.01, 1e4);
      checked(params, "columns", 1, 1e3, true);
      checked(params, "gapX", -1e4, 1e4);
      checked(params, "gapY", -1e4, 1e4);
      checked(params, "stagger", -100, 100);
      checked(params, "fillAlpha", 0, 255);
      if (!["outline", "fill", "both"].includes(String(params.treatment))) throw new Error("Invalid panel treatment");
      const refined = n2 * 2 ** iterations;
      requireBudget(panels * (n2 * (2 ** (iterations + 1) - 1) + refined));
    } else {
      const rings = checked(params, "rings", 1, 1e3, true);
      checked(params, "distance", -1e4, 1e4);
      checked(params, "startOffset", -1e4, 1e4);
      checked(params, "scale", 0.01, 1e4);
      checked(params, "miterLimit", 1, 1e3);
      checked(params, "dotSize", 0, 1e3);
      checked(params, "alpha", 0, 255);
      if (!["outline", "dots", "both"].includes(String(params.marks))) throw new Error("Invalid contour marks");
      requireBudget(rings * (4 * n2 + 2 * n2));
    }
    return;
  }
  if (id === "road-margins") {
    const routes = checked(params, "routes", 1, 1e3, true);
    const turns = checked(params, "turns", 1, 1e3, true);
    const iterations = checked(params, "iterations", 0, 16, true);
    checked(params, "distance", -1e4, 1e4);
    checked(params, "amplitude", -1e4, 1e4);
    checked(params, "frequency", -1e3, 1e3);
    checked(params, "phase", -1e6, 1e6);
    checked(params, "routeSpacing", -1e4, 1e4);
    checked(params, "miterLimit", 1, 1e3);
    checked(params, "weight", 0, 100);
    for (const key of ["showCenterline", "showEdges", "bothSides", "showNodes"])
      if (typeof params[key] !== "boolean") throw new Error(`${key} must be boolean`);
    const n2 = turns + 1;
    const refined = n2 * 2 ** iterations;
    const offsetCalls = params.showEdges ? params.bothSides ? 2 : 1 : 0;
    requireBudget(routes * (n2 * (2 ** (iterations + 1) - 1) + refined * (1 + 5 * offsetCalls) + n2));
    return;
  }
  const sides = checked(params, "sides", 3, 256, true);
  checked(params, "innerRadius", 0.01, 1);
  checked(params, "aspect", 0.01, 100);
  checked(params, "rotation", -1e6, 1e6);
  checked(params, "scale", 0.01, 1e4);
  checked(params, "grain", 0, 1e3, true);
  checked(params, "weight", 0, 100);
  checked(params, "fillAlpha", 0, 255);
  checked(params, "hatchAlpha", 0, 255);
  if (typeof params.showEdges !== "boolean") throw new Error("showEdges must be boolean");
  if (!["convex", "notched"].includes(String(params.kind))) throw new Error("Invalid facet boundary");
  if (!["none", "fan", "dots"].includes(String(params.hatchMode))) throw new Error("Invalid hatch mode");
  if (params.kind === "notched" && Math.abs(number(params, "innerRadius") - Math.cos(Math.PI / sides)) < 1e-9)
    throw new Error("Notched boundary has collinear corners");
  const n = sides * (params.kind === "notched" ? 2 : 1);
  requireBudget(n ** 3 + n ** 2 + (n - 2) * (number(params, "grain") + 4));
}
function polygonSource(params, centerX, centerY, radius) {
  const sides = number(params, "sides"), aspect = number(params, "aspect"), rotation = radians(number(params, "rotation"));
  const outer = Array.from({ length: sides }, (_, i) => {
    const a = rotation + 2 * Math.PI * i / sides - Math.PI / 2;
    return [centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius * aspect];
  });
  const notch = number(params, "notch");
  if (notch <= 0) return outer;
  const midX = (outer[0][0] + outer[1][0]) / 2;
  const midY = (outer[0][1] + outer[1][1]) / 2;
  outer.splice(1, 0, [midX + (centerX - midX) * notch, midY + (centerY - midY) * notch]);
  return outer;
}
function roadSource(params, index = 0) {
  const turns = number(params, "turns"), routes = number(params, "routes");
  const centerY = 320 + (index - (routes - 1) / 2) * number(params, "routeSpacing");
  const phase = radians(number(params, "phase")) + index * 0.67;
  return Array.from({ length: turns + 1 }, (_, i) => [
    40 + 560 * i / turns,
    centerY + number(params, "amplitude") * Math.sin(phase + 2 * Math.PI * number(params, "frequency") * i / turns)
  ]);
}
function facetSource(params) {
  const sides = number(params, "sides"), notched = params.kind === "notched";
  const length = sides * (notched ? 2 : 1), rotation = radians(number(params, "rotation"));
  const radius = number(params, "scale"), aspect = number(params, "aspect");
  return Array.from({ length }, (_, i) => {
    const a = rotation + 2 * Math.PI * i / length - Math.PI / 2;
    const r = notched && i % 2 ? radius * number(params, "innerRadius") : radius;
    return [320 + Math.cos(a) * r, 320 + Math.sin(a) * r * aspect];
  });
}
function palette(p, layer, i, alpha, target) {
  const c = layer.palette[(i % layer.palette.length + layer.palette.length) % layer.palette.length] >>> 0;
  p[target](c >>> 16 & 255, c >>> 8 & 255, c & 255, alpha);
}
function path(p, points, close) {
  p.beginShape();
  for (const point of points) p.vertex(point[0], point[1]);
  p.endShape(close ? p.CLOSE : void 0);
}
function drawPanels(p, layer) {
  const params = layer.params, count = number(params, "panels"), columns = number(params, "columns");
  const rows = Math.ceil(count / columns), width = number(params, "panelSize") * 2;
  const height = width * number(params, "aspect");
  const pitchX = width + number(params, "gapX"), pitchY = height + number(params, "gapY");
  for (let i = 0; i < count; i++) {
    const col = i % columns, row = Math.floor(i / columns);
    const x = 320 + (col - (Math.min(columns, count) - 1) / 2 + row * number(params, "stagger")) * pitchX;
    const y = 320 + (row - (rows - 1) / 2) * pitchY;
    const source = polygonSource(params, x, y, number(params, "panelSize"));
    const result = chaikinPolyline2D({ points: source, closed: true, iterations: number(params, "iterations"), maxWork: source.length * (2 ** (number(params, "iterations") + 1) - 1) });
    if (params.treatment === "outline") p.noFill();
    else palette(p, layer, i, number(params, "fillAlpha"), "fill");
    if (params.treatment === "fill" || number(params, "weight") === 0) p.noStroke();
    else {
      palette(p, layer, i + 1, 230, "stroke");
      p.strokeWeight(number(params, "weight"));
    }
    path(p, result.points, true);
  }
}
function drawRoads(p, layer) {
  const params = layer.params;
  p.noFill();
  p.strokeWeight(number(params, "weight"));
  for (let i = 0; i < number(params, "routes"); i++) {
    const source = roadSource(params, i);
    const refined = chaikinPolyline2D({ points: source, closed: false, iterations: number(params, "iterations"), maxWork: source.length * (2 ** (number(params, "iterations") + 1) - 1) }).points;
    if (params.showCenterline && number(params, "weight") > 0) {
      palette(p, layer, i, 115, "stroke");
      path(p, refined, false);
    }
    if (params.showEdges && number(params, "weight") > 0) {
      const distances = params.bothSides ? [number(params, "distance"), -number(params, "distance")] : [number(params, "distance")];
      distances.forEach((distance, side) => {
        const out = offsetPolyline2D({ points: refined, closed: false, distance, miterLimit: number(params, "miterLimit"), maxWork: refined.length * 4 });
        palette(p, layer, i + side, 220, "stroke");
        path(p, out.points, false);
      });
    }
    if (params.showNodes) {
      p.noStroke();
      palette(p, layer, i + 2, 220, "fill");
      for (const point of source) p.circle(point[0], point[1], Math.max(2, number(params, "weight") * 2));
      p.noFill();
      p.strokeWeight(number(params, "weight"));
    }
  }
}
function drawRings(p, layer) {
  const params = layer.params;
  const source = polygonSource(params, 320, 320, number(params, "scale"));
  p.noFill();
  p.strokeWeight(number(params, "weight"));
  for (let i = 0; i < number(params, "rings"); i++) {
    const out = offsetPolyline2D({ points: source, closed: true, distance: number(params, "startOffset") + i * number(params, "distance"), miterLimit: number(params, "miterLimit"), maxWork: source.length * 4 });
    if (params.marks !== "dots" && number(params, "weight") > 0) {
      palette(p, layer, i, number(params, "alpha"), "stroke");
      path(p, out.points, true);
    }
    if (params.marks !== "outline") {
      p.noStroke();
      palette(p, layer, i, number(params, "alpha"), "fill");
      for (const point of out.points) p.circle(point[0], point[1], number(params, "dotSize"));
      p.noFill();
      p.strokeWeight(number(params, "weight"));
    }
  }
}
function drawFacets(p, layer) {
  const params = layer.params, source = facetSource(params);
  const mesh = triangulateSimplePolygon2D({ points: source, maxWork: source.length ** 3 + source.length ** 2 });
  for (let i = 0; i < mesh.triangles.length; i++) {
    const [a, b, c] = mesh.triangles[i].map((index) => mesh.points[index]);
    if (number(params, "fillAlpha") > 0) palette(p, layer, i, number(params, "fillAlpha"), "fill");
    else p.noFill();
    if (params.showEdges && number(params, "weight") > 0) {
      palette(p, layer, i + 1, 220, "stroke");
      p.strokeWeight(number(params, "weight"));
    } else p.noStroke();
    path(p, [a, b, c], true);
    if (params.hatchMode === "none" || number(params, "grain") === 0 || params.hatchMode === "fan" && number(params, "weight") === 0) continue;
    palette(p, layer, i + 2, number(params, "hatchAlpha"), params.hatchMode === "dots" ? "fill" : "stroke");
    if (params.hatchMode === "dots") p.noStroke();
    else {
      p.noFill();
      p.strokeWeight(number(params, "weight"));
    }
    for (let j = 1; j <= number(params, "grain"); j++) {
      const t = j / (number(params, "grain") + 1);
      const x1 = a[0] + t * (b[0] - a[0]), y1 = a[1] + t * (b[1] - a[1]);
      const x2 = a[0] + t * (c[0] - a[0]), y2 = a[1] + t * (c[1] - a[1]);
      if (params.hatchMode === "dots") p.circle((x1 + x2) / 2, (y1 + y2) / 2, Math.max(1, number(params, "weight") * 1.5));
      else p.line(x1, y1, x2, y2);
    }
  }
}
function drawPathsAQuality(p, layer) {
  const id = layer.technique;
  validatePathsAQuality(id, layer.params);
  if (id === "rounded-panels") drawPanels(p, layer);
  else if (id === "road-margins") drawRoads(p, layer);
  else if (id === "nested-contour-strokes") drawRings(p, layer);
  else drawFacets(p, layer);
}
export {
  drawPathsAQuality,
  facetSource,
  polygonSource,
  roadSource,
  validatePathsAQuality
};
