import type { Layer } from "../studio-types";
import {
  RadialProfile3D,
  annularSolid3D,
  bilinearRasterRemap2D,
  clipSegmentsSimplePolygon2D,
  gradientNoise3D01,
  radialPull2D,
  separableBlur2D,
  sequentialDiscProjection2D,
  stopRamp,
  targetSprings2D,
} from "../../../../packages/javascript/src/index.js";
import { numeric, toggle, choice, type StudioDefinition } from "./types";

const SIDE = 640;
const TAU = Math.PI * 2;
type Query = Record<string, number | string | boolean>;
const q = (layer: Layer) => layer.params as Query;
const palette = (layer: Layer): number[] => layer.palette;
const n = (query: Query, key: string) => query[key] as number;
const b = (query: Query, key: string) => query[key] as boolean;
const color = (value: number): [number, number, number] => [
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const paletteAt = (layer: Layer, index: number) => {
  const colors = palette(layer);
  return color(colors[index % colors.length]);
};
const rng = (seed: number) => {
  let state = seed >>> 0;
  return () =>
    ((state = (state + 0x6d2b79f5) >>> 0),
    (Math.imul(state ^ (state >>> 15), 1 | state) ^
      Math.imul(state ^ (state >>> 7), 61 | state) ^
      state) >>>
      0) / 4294967296;
};
const faceCount = (mesh: any) =>
  typeof mesh.faceCount === "function" ? mesh.faceCount() : mesh.faceCount;

function line(
  p: any,
  points: readonly number[],
  rgb: readonly number[],
  weight = 1,
): void {
  p.stroke(rgb[0], rgb[1], rgb[2]);
  p.strokeWeight(weight);
  p.noFill();
  p.beginShape();
  for (let i = 0; i < points.length; i += 2) p.vertex(points[i], points[i + 1]);
  p.endShape();
}
function mesh(p: any, shape: any, layer: Layer, phase = 0): void {
  const normal = new Float64Array(3),
    triangle = new Int32Array(3),
    vertex = new Float64Array(3);
  p.beginShape(p.TRIANGLES);
  for (let face = 0; face < faceCount(shape); face += 1) {
    const rgb = paletteAt(layer, face + phase);
    p.fill(...rgb);
    shape.normalInto(face, normal, 0);
    p.normal(normal[0], normal[1], normal[2]);
    shape.triangleInto(face, triangle, 0);
    for (let corner = 0; corner < 3; corner += 1) {
      shape.vertexInto(triangle[corner], vertex, 0);
      p.vertex(vertex[0], vertex[1], vertex[2]);
    }
  }
  p.endShape();
}
function profile(kind: number, height: number, radius: number): number[][] {
  const points: number[][] = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    let r = radius;
    if (kind === 1) r *= 0.38 + 0.62 * Math.abs(2 * t - 1);
    if (kind === 2) r *= 1 - t;
    points.push([-height / 2 + height * t, Math.max(0, r)]);
  }
  return points;
}
function packed(rgb: readonly number[]): number {
  return (0xff000000 | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]) >>> 0;
}
function putRaster(
  p: any,
  raster: { width: number; height: number; pixels: number[] },
): void {
  p.loadPixels();
  for (let y = 0; y < SIDE; y += 1)
    for (let x = 0; x < SIDE; x += 1) {
      const pixel =
        raster.pixels[
          Math.floor((y * raster.height) / SIDE) * raster.width +
            Math.floor((x * raster.width) / SIDE)
        ];
      const offset = 4 * (y * SIDE + x);
      p.pixels[offset] = (pixel >>> 16) & 255;
      p.pixels[offset + 1] = (pixel >>> 8) & 255;
      p.pixels[offset + 2] = pixel & 255;
      p.pixels[offset + 3] = pixel >>> 24;
    }
  p.updatePixels();
}

function drawPullLegacy(p: any, layer: Layer): void {
  const x = q(layer),
    random = rng(layer.seed),
    radius = n(x, "radius"),
    field = radialPull2D({
      influences: [
        [210, 250, radius, n(x, "power")],
        [430, 360, radius, n(x, "power")],
      ],
    });
  p.noFill();
  p.strokeCap(p.ROUND);
  for (let row = 0; row < n(x, "lines"); row += 1) {
    const points: number[] = [];
    const y = 80 + (row * 480) / Math.max(1, n(x, "lines") - 1);
    for (let i = 0; i <= 96; i += 1) {
      const out = [0, 0];
      field.transformInto(
        40 + (i * 560) / 96,
        y + (random() - 0.5) * n(x, "jitter"),
        out,
      );
      points.push(out[0], out[1]);
    }
    line(p, points, paletteAt(layer, row), n(x, "weight"));
  }
}
function drawProjectionLegacy(p: any, layer: Layer): void {
  const x = q(layer),
    count = n(x, "lines"),
    points: number[][] = [],
    discs = [
      [230, 250, n(x, "radius")],
      [410, 350, n(x, "radius") * 0.78],
    ];
  for (let row = 0; row < count; row += 1)
    for (let i = 0; i <= 90; i += 1)
      points.push([
        55 + (i * 530) / 90,
        90 + (row * 470) / Math.max(1, count - 1),
      ]);
  const output = sequentialDiscProjection2D({
    points,
    discs,
    strength: n(x, "strength"),
    maxTests: points.length * discs.length,
  }).points();
  for (let row = 0; row < count; row += 1) {
    const path: number[] = [];
    for (let i = 0; i <= 90; i += 1) {
      const point = 2 * (row * 91 + i);
      path.push(output[point], output[point + 1]);
    }
    line(p, path, paletteAt(layer, row), n(x, "weight"));
  }
}
const PATH_SAMPLES = 96;
const PATH_WORK_LIMIT = 16_000;
type SourceMode = "rows" | "columns" | "spokes";
function modernPathSettings(layer: Layer, pull: boolean) {
  const x = q(layer), sourceMode = x.sourceMode as SourceMode;
  if (!["rows", "columns", "spokes"].includes(sourceMode)) throw Error("Unknown source path mode");
  const pathCount = n(x, "pathCount"), count = n(x, "influenceCount"), jitter = n(x, "jitter"), weight = n(x, "weight");
  if (!Number.isInteger(pathCount) || pathCount < 4 || pathCount > 80 ||
      !Number.isInteger(count) || count < 1 || count > 2 ||
      !Number.isFinite(jitter) || jitter < 0 || jitter > 40 ||
      !Number.isFinite(weight) || weight < .1 || weight > 12 ||
      pathCount * PATH_SAMPLES * count > PATH_WORK_LIMIT)
    throw Error("Invalid path or influence work settings");
  const influences: number[][] = [];
  for (let i = 1; i <= count; i++) {
    const cx = n(x, `centerX${i}`), cy = n(x, `centerY${i}`), radius = n(x, `radius${i}`);
    if (![cx, cy, radius].every(Number.isFinite) || cx < 0 || cx > SIDE || cy < 0 || cy > SIDE || radius < 10 || radius > 450)
      throw Error(`Invalid influence ${i} geometry`);
    const power = pull ? n(x, `power${i}`) : undefined;
    if (pull && (!Number.isFinite(power) || power! < .2 || power! > 6)) throw Error(`Invalid influence ${i} power`);
    influences.push(pull ? [cx, cy, radius, power!] : [cx, cy, radius]);
  }
  if (!pull && (!Number.isFinite(n(x, "strength")) || n(x, "strength") < 0 || n(x, "strength") > 1))
    throw Error("Invalid projection strength");
  return { sourceMode, pathCount, jitter, weight, influences };
}
function sourcePaths(seed: number, mode: SourceMode, count: number, jitter: number): number[][] {
  const random = rng(seed), paths: number[][] = [];
  for (let path = 0; path < count; path++) {
    const points: number[] = [];
    const across = count === 1 ? .5 : path / (count - 1);
    const angle = -Math.PI / 2 + path * TAU / count;
    for (let sample = 0; sample < PATH_SAMPLES; sample++) {
      const t = sample / (PATH_SAMPLES - 1), offset = (random() - .5) * jitter;
      if (mode === "rows") points.push(40 + t * 560, 48 + across * 544 + offset);
      else if (mode === "columns") points.push(48 + across * 544 + offset, 40 + t * 560);
      else {
        const r = 20 + 330 * t;
        points.push(320 + Math.cos(angle) * r - Math.sin(angle) * offset,
          320 + Math.sin(angle) * r + Math.cos(angle) * offset);
      }
    }
    paths.push(points);
  }
  return paths;
}
function drawPull(p: any, layer: Layer): void {
  if (q(layer).legacy === true) return drawPullLegacy(p, layer);
  const { sourceMode, pathCount, jitter, weight, influences } = modernPathSettings(layer, true);
  const field = radialPull2D({ influences });
  const paths = sourcePaths(layer.seed, sourceMode, pathCount, jitter), point = [0, 0];
  p.noFill(); p.strokeCap(p.ROUND);
  paths.forEach((source, index) => {
    const drawn: number[] = [];
    for (let i = 0; i < source.length; i += 2) {
      field.transformInto(source[i], source[i + 1], point);
      drawn.push(point[0], point[1]);
    }
    line(p, drawn, paletteAt(layer, index), weight);
  });
}
function drawProjection(p: any, layer: Layer): void {
  if (q(layer).legacy === true) return drawProjectionLegacy(p, layer);
  const { sourceMode, pathCount, jitter, weight, influences } = modernPathSettings(layer, false);
  const paths = sourcePaths(layer.seed, sourceMode, pathCount, jitter);
  const points = paths.flatMap(path => {
    const pairs: number[][] = [];
    for (let i = 0; i < path.length; i += 2) pairs.push([path[i], path[i + 1]]);
    return pairs;
  });
  const output = sequentialDiscProjection2D({ points, discs: influences,
    strength: n(q(layer), "strength"), maxTests: points.length * influences.length }).points();
  for (let path = 0; path < pathCount; path++) {
    const drawn: number[] = [];
    for (let sample = 0; sample < PATH_SAMPLES; sample++) {
      const index = 2 * (path * PATH_SAMPLES + sample);
      drawn.push(output[index], output[index + 1]);
    }
    line(p, drawn, paletteAt(layer, path), weight);
  }
}
function drawClipLegacy(p: any, layer: Layer): void {
  const x = q(layer),
    random = rng(layer.seed),
    rows = n(x, "paths"),
    segments: number[][] = [],
    polygon = [
      [80, 80],
      [560, 80],
      [560, 560],
      [380, 560],
      [380, n(x, "notch")],
      [260, n(x, "notch")],
      [260, 560],
      [80, 560],
    ];
  for (let row = 0; row < rows; row += 1) {
    let px = 20,
      py = 100 + (row * 440) / Math.max(1, rows - 1);
    for (let step = 0; step < n(x, "steps"); step += 1) {
      const nx = px + 7,
        ny = py + (random() - 0.5) * n(x, "wander");
      segments.push([px, py, nx, ny]);
      px = nx;
      py = ny;
    }
  }
  const clipped = clipSegmentsSimplePolygon2D({
    polygon,
    segments,
    maxWork: 1200000,
    maxOutputSegments: 5000,
  }).toValues();
  p.noFill();
  for (let i = 0; i < clipped.segments.length; i += 1) {
    const s = clipped.segments[i];
    p.stroke(...paletteAt(layer, clipped.sourceIndices[i] % rows));
    p.strokeWeight(n(x, "weight"));
    p.line(...s);
  }
}
type ClipSourceMode = "rows" | "wander" | "fan";
type ClipRegionMode = "rectangle" | "portal" | "bay" | "regular";
const CLIP_WORK_LIMIT = 4_000_000;
const CLIP_OUTPUT_LIMIT = 50_000;
function clipSettings(layer: Layer) {
  const x = q(layer), sourceMode = x.sourceMode as ClipSourceMode, regionMode = x.regionMode as ClipRegionMode;
  if (!["rows", "wander", "fan"].includes(sourceMode) ||
      !["rectangle", "portal", "bay", "regular"].includes(regionMode)) throw Error("Unknown clip source or region mode");
  const pathCount = n(x, "pathCount"), steps = n(x, "steps"), wander = n(x, "wander"),
    cx = n(x, "centerX"), cy = n(x, "centerY"), width = n(x, "regionWidth"), height = n(x, "regionHeight"),
    notchWidth = n(x, "notchWidth"), notchDepth = n(x, "notchDepth"), sides = n(x, "sides"),
    angle = n(x, "angle"), weight = n(x, "weight"), showOutline = x.showOutline;
  if (!Number.isInteger(pathCount) || pathCount < 1 || pathCount > 80 ||
      !Number.isInteger(steps) || steps < 2 || steps > 160 ||
      !Number.isFinite(wander) || wander < 0 || wander > 80 ||
      !Number.isFinite(cx) || cx < -320 || cx > 960 || !Number.isFinite(cy) || cy < -320 || cy > 960 ||
      !Number.isFinite(width) || width < 10 || width > 1000 || !Number.isFinite(height) || height < 10 || height > 1000 ||
      !Number.isFinite(notchWidth) || notchWidth < 0 || notchWidth > 1000 ||
      !Number.isFinite(notchDepth) || notchDepth < 0 || notchDepth > 1000 ||
      !Number.isInteger(sides) || sides < 3 || sides > 12 ||
      !Number.isFinite(angle) || angle < -180 || angle > 180 ||
      !Number.isFinite(weight) || weight < .1 || weight > 12 || typeof showOutline !== "boolean")
    throw Error("Invalid clip construction settings");
  return { sourceMode, regionMode, pathCount, steps, wander, cx, cy, width, height,
    notchWidth, notchDepth, sides, angle, weight, showOutline };
}
function clipRegion(x: ReturnType<typeof clipSettings>): number[][] {
  const { cx, cy, width, height, notchWidth, notchDepth, regionMode } = x;
  const left = cx - width / 2, right = cx + width / 2, top = cy - height / 2, bottom = cy + height / 2;
  const rect = [[left, top], [right, top], [right, bottom], [left, bottom]];
  if (regionMode === "rectangle") return rect;
  if (regionMode === "regular") {
    const start = x.angle * Math.PI / 180;
    return Array.from({ length: x.sides }, (_, i) => {
      const a = start + i * TAU / x.sides;
      return [cx + Math.cos(a) * width / 2, cy + Math.sin(a) * height / 2];
    });
  }
  const span = regionMode === "portal" ? width : height;
  const reach = regionMode === "portal" ? height : width;
  if (notchWidth > span) throw Error("Notch opening exceeds region span");
  if (notchWidth === 0 || notchDepth === 0) return rect;
  if (notchDepth >= reach) throw Error("Full-depth notch would disconnect the simple polygon");
  if (regionMode === "portal") {
    const innerTop = bottom - notchDepth;
    if (notchWidth === width) return [[left, top], [right, top], [right, innerTop], [left, innerTop]];
    return [[left, top], [right, top], [right, bottom], [cx + notchWidth / 2, bottom],
      [cx + notchWidth / 2, innerTop], [cx - notchWidth / 2, innerTop],
      [cx - notchWidth / 2, bottom], [left, bottom]];
  }
  const innerLeft = right - notchDepth;
  if (notchWidth === height) return [[left, top], [innerLeft, top], [innerLeft, bottom], [left, bottom]];
  return [[left, top], [right, top], [right, cy - notchWidth / 2],
    [innerLeft, cy - notchWidth / 2], [innerLeft, cy + notchWidth / 2],
    [right, cy + notchWidth / 2], [right, bottom], [left, bottom]];
}
function clipSource(x: ReturnType<typeof clipSettings>, seed: number): number[][] {
  const random = rng(seed), segments: number[][] = [];
  for (let path = 0; path < x.pathCount; path++) {
    const across = x.pathCount === 1 ? .5 : path / (x.pathCount - 1);
    let px = 20, py = x.sourceMode === "fan" ? 320 : 80 + across * 480;
    for (let step = 1; step <= x.steps; step++) {
      const t = step / x.steps, nx = 20 + t * 600;
      const ny = x.sourceMode === "fan" ? 320 + (across - .5) * 480 * t :
        x.sourceMode === "wander" ? py + (random() - .5) * x.wander : py;
      segments.push([px, py, nx, ny]);
      px = nx; py = ny;
    }
  }
  return segments;
}
function drawClip(p: any, layer: Layer): void {
  if (q(layer).legacy === true) return drawClipLegacy(p, layer);
  const settings = clipSettings(layer), polygon = clipRegion(settings), edges = polygon.length;
  const segmentCount = settings.pathCount * settings.steps;
  const work = edges * edges + segmentCount * (edges * edges * 8 + edges * 16 + 8);
  const potentialOutput = segmentCount * (Math.floor(edges / 2) + 1);
  if (work > CLIP_WORK_LIMIT || potentialOutput > CLIP_OUTPUT_LIMIT)
    throw Error("Clip construction exceeds combined work or output limit");
  const segments = clipSource(settings, layer.seed);
  const clipped = clipSegmentsSimplePolygon2D({ polygon, segments,
    maxWork: work, maxOutputSegments: CLIP_OUTPUT_LIMIT }).toValues();
  p.noFill(); p.strokeWeight(settings.weight);
  for (let i = 0; i < clipped.segments.length; i++) {
    const sourcePath = Math.floor(clipped.sourceIndices[i] / settings.steps);
    p.stroke(...paletteAt(layer, sourcePath));
    p.line(...clipped.segments[i]);
  }
  if (settings.showOutline) {
    p.stroke(...paletteAt(layer, layer.palette.length - 1), 150);
    p.strokeWeight(Math.min(settings.weight, 2));
    p.beginShape();
    for (const point of polygon) p.vertex(point[0], point[1]);
    p.endShape(p.CLOSE);
  }
}
function drawRamp(p: any, layer: Layer): void {
  const x = q(layer),
    colors = palette(layer),
    stops = colors.map((value: number, i: number) => ({
      position: i / (colors.length - 1),
      color: value,
    })),
    ramp = stopRamp({ stops }),
    step = n(x, "spacing");
  p.noStroke();
  for (let y = step / 2; y < SIDE; y += step)
    for (let px = step / 2; px < SIDE; px += step) {
      const t = b(x, "radial")
        ? Math.hypot(px - 320, y - 320) / (320 * n(x, "spread"))
        : px / SIDE;
      p.fill(...color(ramp.sample(t)));
      p.circle(px, y, n(x, "size"));
    }
}
function generatedRaster(
  layer: Layer,
  size: number,
  stripe: number,
  coverage = 1,
): { width: number; height: number; pixels: number[] } {
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 1)
    throw Error("Source coverage must be between 0 and 1");
  const random = rng(layer.seed),
    pixels = new Array<number>(size * size);
  const colors = palette(layer);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const band = (x + y * 0.55 + random() * stripe) / stripe;
      const index =
        ((Math.floor(band) %
          colors.length) +
          colors.length) %
        colors.length;
      // Keep the source color and RNG schedule. A coherent mask group spans
      // three source stripes, leaving gutters wide enough to survive blur.
      const maskBand = (x + y * 0.55) / (stripe * 3);
      const phase = maskBand - Math.floor(maskBand);
      pixels[y * size + x] = coverage === 1 || Math.abs(phase - 0.5) < coverage / 2
        ? packed(paletteAt(layer, index)) : 0;
    }
  return { width: size, height: size, pixels };
}
function premultiplyRaster(raster: { width: number; height: number; pixels: number[] }) {
  return { ...raster, pixels: raster.pixels.map(pixel => {
    const alpha = pixel >>> 24;
    const channel = (shift: number) => Math.round(((pixel >>> shift) & 255) * alpha / 255);
    return ((alpha << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)) >>> 0;
  }) };
}
function unpremultiplyRaster(raster: { width: number; height: number; pixels: number[] }) {
  return { ...raster, pixels: raster.pixels.map(pixel => {
    const alpha = pixel >>> 24;
    if (alpha === 0) return 0;
    const channel = (shift: number) => Math.min(255, Math.round(((pixel >>> shift) & 255) * 255 / alpha));
    return ((alpha << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)) >>> 0;
  }) };
}
function sourceCoverage(query: Query): number {
  return query.sourceCoverage === undefined ? 1 : n(query, "sourceCoverage");
}
function drawWarp(p: any, layer: Layer): void {
  const x = q(layer),
    size = 160,
    coverage = sourceCoverage(x),
    source = generatedRaster(layer, size, n(x, "stripe"), coverage),
    noise = gradientNoise3D01({ seed: layer.seed }),
    coordinates: number[][] = [];
  for (let py = 0; py < size; py += 1)
    for (let px = 0; px < size; px += 1) {
      const angle =
        noise.sample(px / n(x, "scale"), py / n(x, "scale"), 0) * TAU;
      coordinates.push([
        px + Math.cos(angle) * n(x, "strength"),
        py + Math.sin(angle) * n(x, "strength"),
      ]);
    }
  const remapped = bilinearRasterRemap2D({
      source: coverage === 1 ? source : premultiplyRaster(source),
      outputWidth: size,
      outputHeight: size,
      sourceCoordinates: coordinates,
    }).toValues();
  putRaster(p, coverage === 1 ? remapped : unpremultiplyRaster(remapped));
}
function drawBlur(p: any, layer: Layer): void {
  const x = q(layer),
    size = 128,
    source = generatedRaster(layer, size, n(x, "stripe"), sourceCoverage(x)),
    radius = n(x, "radius"),
    kernel = Array.from(
      { length: radius * 2 + 1 },
      (_, i) => radius + 1 - Math.abs(i - radius),
    );
  putRaster(
    p,
    separableBlur2D({
      source,
      kernelX: kernel,
      kernelY: b(x, "horizontal") ? [1] : kernel,
      maxSamples: size * size * (kernel.length + (b(x, "horizontal") ? 1 : kernel.length)),
    }).toValues(),
  );
}
function drawProfile(p: any, layer: Layer): void {
  const x = q(layer),
    shape = RadialProfile3D.generate({
      profile: profile(n(x, "form"), n(x, "height"), n(x, "radius")),
      slices: n(x, "slices"),
      capStart: b(x, "caps"),
      capEnd: b(x, "caps"),
      maxFaces: 3000,
    });
  p.noStroke();
  p.noLights();
  p.ambientLight(110);
  p.directionalLight(255, 255, 255, -0.3, 0.5, -1);
  p.push();
  p.rotateX(0.85);
  p.rotateY(0.35);
  mesh(p, shape, layer);
  p.pop();
}
function drawAnnular(p: any, layer: Layer): void {
  const x = q(layer),
    shape = annularSolid3D({
      outerRadius: n(x, "outer"),
      innerRadius: n(x, "inner"),
      bottomZ: -n(x, "depth") / 2,
      topZ: n(x, "depth") / 2,
      slices: n(x, "slices"),
      maxFaces: 1000,
    });
  p.noStroke();
  p.noLights();
  p.ambientLight(120);
  p.directionalLight(255, 255, 255, -0.2, 0.5, -1);
  p.push();
  p.rotateX(0.9);
  p.rotateY(0.35);
  mesh(p, shape, layer);
  p.pop();
}
function drawDepth(p: any, layer: Layer): void {
  const x = q(layer),
    noise = gradientNoise3D01({ seed: layer.seed }),
    radius = n(x, "radius"),
    slices = n(x, "slices"),
    shape = RadialProfile3D.generate({
      profile: profile(2, n(x, "height"), radius),
      slices,
      capStart: false,
      capEnd: false,
      maxFaces: 3000,
    });
  p.noStroke();
  p.noLights();
  p.ambientLight(120);
  p.directionalLight(255, 255, 255, -0.2, 0.4, -1);
  p.push();
  p.rotateX(0.85);
  p.rotateY(0.35);
  p.beginShape(p.TRIANGLES);
  const normal = new Float64Array(3),
    triangle = new Int32Array(3),
    vertex = new Float64Array(3);
  for (let face = 0; face < faceCount(shape); face += 1) {
    const rgb = paletteAt(
      layer,
      Math.floor(
        noise.sample(face / slices, n(x, "depth"), 0) * palette(layer).length,
      ),
    );
    p.fill(...rgb);
    shape.normalInto(face, normal);
    p.normal(...normal);
    shape.triangleInto(face, triangle);
    for (const corner of triangle) {
      shape.vertexInto(corner, vertex);
      p.vertex(...vertex);
    }
  }
  p.endShape();
  p.pop();
}
function drawSpring(p: any, layer: Layer): void {
  const x = q(layer),
    random = rng(layer.seed),
    count = n(x, "count"),
    bodies = [],
    targets: number[][] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (TAU * i) / count;
    targets.push([
      320 + Math.cos(angle) * n(x, "radius"),
      320 + Math.sin(angle) * n(x, "radius"),
    ]);
    bodies.push({
      position: [320 + (random() - 0.5) * 360, 320 + (random() - 0.5) * 360],
      velocity: [0, 0],
      strength: n(x, "strength"),
      retention: n(x, "damping"),
    });
  }
  let state: any = { bodies };
  for (let tick = 0; tick < n(x, "ticks"); tick += 1)
    state = targetSprings2D({ state, targets }).toValues();
  p.noFill();
  for (let i = 0; i < count; i += 1) {
    const point = state.bodies[i].position;
    p.stroke(...paletteAt(layer, i));
    p.strokeWeight(n(x, "weight"));
    p.line(point[0], point[1], targets[i][0], targets[i][1]);
    p.fill(...paletteAt(layer, i));
    p.circle(point[0], point[1], 5);
    p.noFill();
  }
}

export const effectsDefinitions: StudioDefinition[] = [
  {
    id: "pull-marks" as any,
    title: "Pull marks",
    description: "Arrange source paths and pull them toward one or two editable radial influences.",
    parameters: [
      choice("sourceMode", "Source paths", "Choose horizontal rows, vertical columns or radial spokes before deformation.", ["rows", "columns", "spokes"]),
      numeric("pathCount", "Paths", "Number of independent source paths.", 4, 80, 1, { hardMin: 4, hardMax: 80, integer: true }),
      numeric("jitter", "Source jitter", "Random displacement perpendicular to each source path.", 0, 12, .5, { hardMin: 0, hardMax: 40, integer: false }),
      numeric("influenceCount", "Influences", "Use the first pull or both independent pulls.", 1, 2, 1, { hardMin: 1, hardMax: 2, integer: true }),
      numeric("centerX1", "First center X", "Horizontal position of the first pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY1", "First center Y", "Vertical position of the first pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius1", "First radius", "Reach of the first pull.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("power1", "First falloff", "How the first pull decays toward its radius.", .2, 6, .1, { hardMin: .2, hardMax: 6, integer: false }),
      numeric("centerX2", "Second center X", "Horizontal position of the optional second pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY2", "Second center Y", "Vertical position of the optional second pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius2", "Second radius", "Reach of the optional second pull.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("power2", "Second falloff", "How the second pull decays toward its radius.", .2, 6, .1, { hardMin: .2, hardMax: 6, integer: false }),
      numeric("weight", "Stroke weight", "Thickness of the transformed paths.", .1, 6, .1, { hardMin: .1, hardMax: 12, integer: false }),
      numeric("radius", "Earlier radius", "Saved-study radius.", 80, 280, 1, { hidden: true }),
      numeric("power", "Earlier falloff", "Saved-study falloff.", .3, 4, .1, { hidden: true }),
      numeric("lines", "Earlier lines", "Saved-study path count.", 8, 48, 1, { hidden: true }),
      { key: "legacy", label: "Earlier composition", description: "Keeps the saved drawing layout.", type: "boolean", hidden: true },
    ],
    defaults: { sourceMode: "rows", pathCount: 28, jitter: 0, influenceCount: 2,
      centerX1: 245, centerY1: 280, radius1: 225, power1: 1.3,
      centerX2: 410, centerY2: 380, radius2: 185, power2: 1.8, weight: 1.3,
      radius: 170, power: 1.5, lines: 26, legacy: false },
  },
  {
    id: "projection-marks" as any,
    title: "Projection marks",
    description: "Arrange source paths and project them away from one or two ordered discs.",
    parameters: [
      choice("sourceMode", "Source paths", "Choose horizontal rows, vertical columns or radial spokes before projection.", ["rows", "columns", "spokes"]),
      numeric("pathCount", "Paths", "Number of independent source paths.", 4, 80, 1, { hardMin: 4, hardMax: 80, integer: true }),
      numeric("jitter", "Source jitter", "Random displacement perpendicular to each source path.", 0, 12, .5, { hardMin: 0, hardMax: 40, integer: false }),
      numeric("influenceCount", "Discs", "Use the first disc or both ordered discs.", 1, 2, 1, { hardMin: 1, hardMax: 2, integer: true }),
      numeric("centerX1", "First center X", "Horizontal position of the first disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY1", "First center Y", "Vertical position of the first disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius1", "First radius", "Reach of the first disc.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("centerX2", "Second center X", "Horizontal position of the optional second disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY2", "Second center Y", "Vertical position of the optional second disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius2", "Second radius", "Reach of the optional second disc.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("strength", "Projection strength", "How far source samples move away from discs.", 0, 1, .05, { hardMin: 0, hardMax: 1, integer: false }),
      numeric("weight", "Stroke weight", "Thickness of the transformed paths.", .1, 6, .1, { hardMin: .1, hardMax: 12, integer: false }),
      numeric("radius", "Earlier radius", "Saved-study radius.", 40, 180, 1, { hidden: true }),
      numeric("lines", "Earlier lines", "Saved-study path count.", 6, 32, 1, { hidden: true }),
      { key: "legacy", label: "Earlier composition", description: "Keeps the saved drawing layout.", type: "boolean", hidden: true },
    ],
    defaults: { sourceMode: "rows", pathCount: 24, jitter: 0, influenceCount: 2,
      centerX1: 230, centerY1: 250, radius1: 160,
      centerX2: 410, centerY2: 350, radius2: 110,
      strength: .75, weight: 1.2, radius: 105, lines: 18, legacy: false },
  },
  {
    id: "path-clip-marks" as any,
    title: "Path clip marks",
    description: "Clip rows, wandering paths or a fan through an editable simple boundary.",
    parameters: [
      choice("sourceMode", "Source paths", "Choose straight rows, seeded wander or rays fanning from the left.", ["rows", "wander", "fan"]),
      numeric("pathCount", "Paths", "Number of paths supplied to the clipping operation.", 1, 40, 1, { hardMin: 1, hardMax: 80, integer: true }),
      numeric("steps", "Segments per path", "Number of straight source segments in each path.", 2, 100, 1, { hardMin: 2, hardMax: 160, integer: true }),
      numeric("wander", "Wander", "Seeded vertical variation in wander mode; rows and fan ignore it.", 0, 30, .5, { hardMin: 0, hardMax: 80, integer: false }),
      choice("regionMode", "Clip boundary", "Choose a rectangle, bottom portal, right bay or regular polygon.", ["rectangle", "portal", "bay", "regular"]),
      numeric("centerX", "Boundary center X", "Horizontal position of the clip boundary.", 0, 640, 5, { hardMin: -320, hardMax: 960, integer: false }),
      numeric("centerY", "Boundary center Y", "Vertical position of the clip boundary.", 0, 640, 5, { hardMin: -320, hardMax: 960, integer: false }),
      numeric("regionWidth", "Boundary width", "Horizontal extent before a portal or bay cut.", 100, 640, 10, { hardMin: 10, hardMax: 1000, integer: false }),
      numeric("regionHeight", "Boundary height", "Vertical extent before a portal or bay cut.", 100, 640, 10, { hardMin: 10, hardMax: 1000, integer: false }),
      numeric("notchWidth", "Notch opening", "Opening along the bottom portal or right bay edge; zero gives a rectangle.", 0, 400, 5, { hardMin: 0, hardMax: 1000, integer: false }),
      numeric("notchDepth", "Notch depth", "How far the portal or bay enters the boundary; zero gives a rectangle.", 0, 400, 5, { hardMin: 0, hardMax: 1000, integer: false }),
      numeric("sides", "Polygon sides", "Number of corners in regular boundary mode.", 3, 12, 1, { hardMin: 3, hardMax: 12, integer: true }),
      numeric("angle", "Polygon angle", "Rotates the regular polygon around its center.", -180, 180, 5, { hardMin: -180, hardMax: 180, integer: false }),
      numeric("weight", "Stroke weight", "Thickness of retained path marks.", .1, 6, .1, { hardMin: .1, hardMax: 12, integer: false }),
      toggle("showOutline", "Show boundary", "Trace the actual clip boundary over the retained paths."),
      numeric("paths", "Earlier paths", "Saved-study path count.", 3, 18, 1, { hidden: true }),
      numeric("notch", "Earlier notch floor", "Saved-study notch position.", 180, 480, 1, { hidden: true }),
      { key: "legacy", label: "Earlier composition", description: "Keeps the saved source and portal layout.", type: "boolean", hidden: true },
    ],
    defaults: { sourceMode: "rows", pathCount: 16, steps: 70, wander: 9,
      regionMode: "portal", centerX: 320, centerY: 320, regionWidth: 480, regionHeight: 480,
      notchWidth: 160, notchDepth: 220, sides: 6, angle: 0, weight: 1.5,
      showOutline: true, paths: 8, notch: 300, legacy: false },
  },
  {
    id: "ramp-marks" as any,
    title: "Ramp marks",
    description: "Palette stops colour a dot field.",
    parameters: [
      numeric("spacing", "Spacing", "Distance between dots.", 12, 48),
      numeric("size", "Size", "Dot diameter.", 2, 36),
      numeric("spread", "Radial spread", "Radial ramp scale.", 0.5, 2, 0.1),
      toggle("radial", "Radial", "Sample the ramp radially."),
    ],
    defaults: { spacing: 24, size: 15, spread: 1, radial: false },
  },
  {
    id: "warp-marks" as any,
    title: "Warp marks",
    description: "A generated palette raster remapped through noise.",
    parameters: [
      numeric("strength", "Strength", "Pixel displacement.", 0, 40),
      numeric("scale", "Scale", "Noise field scale.", 8, 80),
      numeric("stripe", "Stripe", "Generated source band width.", 3, 30),
      numeric("sourceCoverage", "Source coverage", "The filled fraction of each source stripe group; clear gutters bend with the image.", 0, 1, 0.01, { hardMin: 0, hardMax: 1 }),
    ],
    defaults: { strength: 14, scale: 34, stripe: 12, sourceCoverage: 1 },
  },
  {
    id: "blur-marks" as any,
    title: "Blur marks",
    description: "A generated palette raster filtered by a separable kernel.",
    parameters: [
      numeric("radius", "Radius", "Blur-kernel radius.", 1, 12),
      numeric("stripe", "Stripe", "Generated source band width.", 3, 30),
      numeric("sourceCoverage", "Source coverage", "The filled fraction of each source stripe group before blur; clear gutters become soft alpha edges.", 0, 1, 0.01, { hardMin: 0, hardMax: 1 }),
      toggle(
        "horizontal",
        "Horizontal only",
        "Restrict blur to horizontal pass.",
      ),
    ],
    defaults: { radius: 5, stripe: 10, horizontal: false, sourceCoverage: 1 },
  },
  {
    id: "profile-marks" as any,
    title: "Profile marks",
    description: "A normal-lit radial profile mesh.",
    renderer: "webgl",
    parameters: [
      numeric("form", "Form", "Cylinder, waist, or point.", 0, 2),
      numeric("slices", "Slices", "Mesh angular slices.", 8, 64),
      numeric("height", "Height", "Profile height.", 180, 440),
      numeric("radius", "Radius", "Profile radius.", 50, 200),
      toggle("caps", "Caps", "Close both profile ends."),
    ],
    defaults: { form: 1, slices: 32, height: 330, radius: 120, caps: true },
  },
  {
    id: "annular-marks" as any,
    title: "Annular marks",
    description: "A normal-lit indexed annular solid.",
    renderer: "webgl",
    parameters: [
      numeric("outer", "Outer radius", "Outer ring radius.", 90, 220),
      numeric("inner", "Inner radius", "Inner ring radius.", 20, 80),
      numeric("depth", "Depth", "Ring depth.", 20, 180),
      numeric("slices", "Slices", "Mesh angular slices.", 8, 80),
    ],
    defaults: { outer: 160, inner: 78, depth: 80, slices: 40 },
  },
  {
    id: "depth-marks" as any,
    title: "Depth marks",
    description: "Noise-coloured normal-lit profile facets.",
    renderer: "webgl",
    parameters: [
      numeric("radius", "Radius", "Form radius.", 70, 220),
      numeric("height", "Height", "Form height.", 180, 440),
      numeric("slices", "Slices", "Mesh angular slices.", 8, 64),
      numeric("depth", "Depth sample", "Noise depth coordinate.", 0, 4, 0.05),
    ],
    defaults: { radius: 180, height: 360, slices: 32, depth: 0.5 },
  },
  {
    id: "spring-marks" as any,
    title: "Spring marks",
    description: "Seeded bodies advanced by explicit spring ticks.",
    parameters: [
      numeric("count", "Bodies", "Number of independent springs.", 6, 72),
      numeric("ticks", "Ticks", "Explicit simulation steps.", 0, 180),
      numeric(
        "strength",
        "Strength",
        "Target spring strength.",
        0.005,
        0.25,
        0.005,
      ),
      numeric("damping", "Damping", "Velocity retention.", 0.5, 0.99, 0.01),
      numeric("radius", "Target radius", "Target ring radius.", 60, 250),
      numeric("weight", "Weight", "Line weight.", 0.5, 4, 0.5),
    ],
    defaults: {
      count: 28,
      ticks: 48,
      strength: 0.06,
      damping: 0.86,
      radius: 190,
      weight: 1,
    },
  },
];

export function drawEffects(p: any, layer: Layer): void {
  switch (layer.technique as string) {
    case "pull-marks":
      return drawPull(p, layer);
    case "projection-marks":
      return drawProjection(p, layer);
    case "path-clip-marks":
      return drawClip(p, layer);
    case "ramp-marks":
      return drawRamp(p, layer);
    case "warp-marks":
      return drawWarp(p, layer);
    case "blur-marks":
      return drawBlur(p, layer);
    case "profile-marks":
      return drawProfile(p, layer);
    case "annular-marks":
      return drawAnnular(p, layer);
    case "depth-marks":
      return drawDepth(p, layer);
    case "spring-marks":
      return drawSpring(p, layer);
    default:
      throw new Error(`Unknown effects technique: ${String(layer.technique)}`);
  }
}
