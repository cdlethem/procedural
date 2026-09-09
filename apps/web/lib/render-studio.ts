import type { Layer, StudioDocument } from "./studio-types";
import { validateDocument } from "./studio";
import {
  markCommands,
  createMarkField,
} from "../../../packages/javascript/examples/field-marks/mark-field.js";
import {
  BASE_PALETTE as PATH_BASE,
  ALTERNATE_PALETTE as PATH_ALTERNATE,
  createPathMarks,
  visiblePathMarkCommands,
} from "../../../packages/javascript/examples/path-marks/path-marks.js";
import {
  BASE_PALETTE as PLACEMENT_BASE,
  ALTERNATE_PALETTE as PLACEMENT_ALTERNATE,
  createRadialPlacementMarks,
  createSeededPlacementMarks,
  vertexInto,
} from "../../../packages/javascript/examples/placement-marks/placement-marks.js";
import {
  CELL_PIXEL_STEP,
  ENDPOINT_RGB,
  GRID_CELLS,
  GRID_RGB,
  cellPixel,
  createLatticeMarks,
  pathColour,
} from "../../../packages/javascript/examples/lattice-marks/lattice-marks.js";

const FIELD_PALETTES = {
  original: [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7],
  neon: [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd],
};
const rgb = (value: number): [number, number, number] => [
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const colour = (target: any, value: number) => target.stroke(...rgb(value));

/** Draws a whole document to a candidate graphics buffer, publishing it only after success. */
export function renderStudio(p: any, document: StudioDocument): void {
  const validated = validateDocument(document);
  const candidate = p.createGraphics(640, 640, p.P2D);
  try {
    candidate.pixelDensity(1);
    if (
      candidate.width !== 640 ||
      candidate.height !== 640 ||
      candidate.pixelDensity() !== 1
    )
      throw new Error("p5 did not create a 640px density-1 graphics buffer");
    candidate.background(validated.background);
    for (const layer of validated.layers) {
      if (!layer.visible || layer.opacity === 0) continue;
      const layerBuffer = p.createGraphics(640, 640, p.P2D);
      try {
        layerBuffer.pixelDensity(1);
        if (
          layerBuffer.width !== 640 ||
          layerBuffer.height !== 640 ||
          layerBuffer.pixelDensity() !== 1
        )
          throw new Error("p5 did not create a 640px density-1 layer buffer");
        layerBuffer.clear();
        drawLayer(layerBuffer, layer);
        candidate.push();
        candidate.drawingContext.globalCompositeOperation = "source-over";
        candidate.tint(255, Math.round(layer.opacity * 255));
        candidate.image(layerBuffer, 0, 0, 640, 640);
        candidate.noTint();
        candidate.pop();
      } finally {
        layerBuffer.remove();
      }
    }
    p.clear();
    p.image(candidate, 0, 0, 640, 640);
  } finally {
    candidate.remove();
  }
}

function drawLayer(p: any, layer: Layer): void {
  switch (layer.technique) {
    case "field-marks":
      return drawField(p, layer);
    case "path-marks":
      return drawPath(p, layer);
    case "placement-marks":
      return drawPlacement(p, layer);
    case "lattice-marks":
      return drawLattice(p, layer);
  }
}
function drawField(p: any, layer: Layer): void {
  const q = layer.params as any;
  const marks = createMarkField(layer.seed, q.columns, q.rows, q.pitch);
  p.noFill();
  p.strokeWeight(1);
  p.strokeCap(p.ROUND);
  for (const command of markCommands(
    marks,
    q.maxLength,
    FIELD_PALETTES[q.palette as keyof typeof FIELD_PALETTES],
    q.bars,
  )) {
    const [r, g, b] = rgb(command.rgb);
    p.stroke(r, g, b, command.opacity8);
    if (command.kind === "segment2") {
      const from = command.from;
      const to = command.to;
      if (!from || !to)
        throw new Error("field command is missing segment points");
      p.line(from[0], from[1], to[0], to[1]);
    } else {
      const vertices = command.vertices;
      if (!vertices) throw new Error("field command is missing quad vertices");
      p.noStroke();
      p.fill(r, g, b, command.opacity8);
      p.quad(...vertices.flat());
      p.noFill();
    }
  }
}
function drawPath(p: any, layer: Layer): void {
  const q = layer.params as any;
  const movement = createPathMarks(layer.seed, q.steps, q.distance);
  const colors = q.palette === "neon" ? PATH_ALTERNATE : PATH_BASE;
  p.noFill();
  p.strokeWeight(1);
  p.strokeCap(p.ROUND);
  for (const command of visiblePathMarkCommands(
    movement,
    q.trace,
    q.markLength,
    colors,
  )) {
    const [r, g, b] = rgb(command.rgb);
    p.stroke(r, g, b, command.opacity8);
    const from = command.from;
    const to = command.to;
    p.line(from[0], from[1], to[0], to[1]);
  }
}
function drawPlacement(p: any, layer: Layer): void {
  const q = layer.params as any;
  const composition = q.radial
    ? createRadialPlacementMarks(q.separation)
    : createSeededPlacementMarks(
        layer.seed,
        q.attempts,
        q.minimum,
        q.maximum,
        q.separation,
      );
  const colors = q.palette === "neon" ? PLACEMENT_ALTERNATE : PLACEMENT_BASE;
  const point = new Float64Array(2);
  const vertices = q.diamonds ? 4 : 64;
  p.noFill();
  p.strokeWeight(1);
  p.strokeCap(p.ROUND);
  p.strokeJoin(p.ROUND);
  for (let circle = 0; circle < composition.placements.size; circle += 1) {
    colour(
      p,
      colors[composition.placements.sourceIndexAt(circle) % colors.length],
    );
    p.beginShape();
    for (let vertex = 0; vertex < vertices; vertex += 1) {
      vertexInto(composition.placements, circle, vertex, q.diamonds, point);
      p.vertex(point[0], point[1]);
    }
    p.endShape(p.CLOSE);
  }
}
function drawLattice(p: any, layer: Layer): void {
  const q = layer.params as any;
  const model = createLatticeMarks(layer.seed, q.many, q.longPaths);
  p.stroke(...rgb(GRID_RGB));
  p.strokeWeight(1);
  for (let index = 0; index <= GRID_CELLS; index += 1) {
    p.line(32, 32 + CELL_PIXEL_STEP * index, 608, 32 + CELL_PIXEL_STEP * index);
    p.line(32 + CELL_PIXEL_STEP * index, 32, 32 + CELL_PIXEL_STEP * index, 608);
  }
  p.strokeCap(p.ROUND);
  p.strokeJoin(p.ROUND);
  for (let path = 0; path < model.paths.pathCount; path += 1) {
    const length = model.paths.pathLengthAt(path);
    if (!length) continue;
    const value = pathColour(q.palette === "neon" ? 1 : 0, path);
    if (q.dots) {
      p.noStroke();
      p.fill(...rgb(value));
      for (let cell = 0; cell < length; cell += 1) {
        const [x, y] = model.paths.cellAt(path, cell);
        p.circle(cellPixel(x), cellPixel(y), 6);
      }
      continue;
    }
    p.strokeWeight((q.wide ? 0.65 : 0.35) * CELL_PIXEL_STEP);
    p.stroke(30, 30, 30, 70);
    for (const offset of [3, 0]) {
      if (offset === 0) {
        p.stroke(...rgb(value));
      }
      for (let cell = 1; cell < length; cell += 1) {
        const [ax, ay] = model.paths.cellAt(path, cell - 1);
        const [bx, by] = model.paths.cellAt(path, cell);
        p.line(
          cellPixel(ax) + offset,
          cellPixel(ay) + offset,
          cellPixel(bx) + offset,
          cellPixel(by) + offset,
        );
      }
    }
    p.stroke(...rgb(value));
    p.strokeWeight(2);
    p.fill(...rgb(ENDPOINT_RGB));
    const first = model.paths.cellAt(path, 0);
    const last = model.paths.cellAt(path, length - 1);
    p.circle(cellPixel(first[0]), cellPixel(first[1]), 8);
    if (length > 1) p.circle(cellPixel(last[0]), cellPixel(last[1]), 8);
  }
}
