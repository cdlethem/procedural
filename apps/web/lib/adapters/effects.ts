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
import { numeric, toggle, type StudioDefinition } from "./types";

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

function drawPull(p: any, layer: Layer): void {
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
function drawProjection(p: any, layer: Layer): void {
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
function drawClip(p: any, layer: Layer): void {
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
): { width: number; height: number; pixels: number[] } {
  const random = rng(layer.seed),
    pixels = new Array<number>(size * size);
  const colors = palette(layer);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const index =
        ((Math.floor((x + y * 0.55 + random() * stripe) / stripe) %
          colors.length) +
          colors.length) %
        colors.length;
      pixels[y * size + x] = packed(paletteAt(layer, index));
    }
  return { width: size, height: size, pixels };
}
function drawWarp(p: any, layer: Layer): void {
  const x = q(layer),
    size = 160,
    source = generatedRaster(layer, size, n(x, "stripe")),
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
  putRaster(
    p,
    bilinearRasterRemap2D({
      source,
      outputWidth: size,
      outputHeight: size,
      sourceCoordinates: coordinates,
    }).toValues(),
  );
}
function drawBlur(p: any, layer: Layer): void {
  const x = q(layer),
    size = 128,
    source = generatedRaster(layer, size, n(x, "stripe")),
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
      maxSamples: size * size * (kernel.length * (b(x, "horizontal") ? 1 : 2)),
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
    description: "Radial fields pull retained scanlines.",
    parameters: [
      numeric("radius", "Radius", "Pull reach.", 80, 280),
      numeric("power", "Power", "Pull falloff power.", 0.3, 4, 0.1),
      numeric("lines", "Lines", "Scanline count.", 8, 48),
      numeric("jitter", "Jitter", "Seeded line offset.", 0, 8, 0.5),
      numeric("weight", "Weight", "Line weight.", 0.5, 4, 0.5),
    ],
    defaults: { radius: 170, power: 1.5, lines: 26, jitter: 1, weight: 1 },
  },
  {
    id: "projection-marks" as any,
    title: "Projection marks",
    description: "Sequential discs push paths outward.",
    parameters: [
      numeric("radius", "Radius", "Disc reach.", 40, 180),
      numeric("strength", "Strength", "Projection amount.", 0, 1, 0.05),
      numeric("lines", "Lines", "Path count.", 6, 32),
      numeric("weight", "Weight", "Line weight.", 0.5, 4, 0.5),
    ],
    defaults: { radius: 105, strength: 0.6, lines: 18, weight: 1 },
  },
  {
    id: "path-clip-marks" as any,
    title: "Path clip marks",
    description: "Seeded wandering segments clipped by a notch.",
    parameters: [
      numeric("paths", "Paths", "Path count.", 3, 18),
      numeric("steps", "Steps", "Segments per path.", 30, 80),
      numeric("wander", "Wander", "Vertical step variation.", 1, 20),
      numeric("notch", "Notch floor", "Notch vertical position.", 180, 480),
      numeric("weight", "Weight", "Line weight.", 0.5, 3, 0.5),
    ],
    defaults: { paths: 8, steps: 70, wander: 9, notch: 300, weight: 1 },
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
    ],
    defaults: { strength: 14, scale: 34, stripe: 12 },
  },
  {
    id: "blur-marks" as any,
    title: "Blur marks",
    description: "A generated palette raster filtered by a separable kernel.",
    parameters: [
      numeric("radius", "Radius", "Blur-kernel radius.", 1, 12),
      numeric("stripe", "Stripe", "Generated source band width.", 3, 30),
      toggle(
        "horizontal",
        "Horizontal only",
        "Restrict blur to horizontal pass.",
      ),
    ],
    defaults: { radius: 5, stripe: 10, horizontal: false },
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
