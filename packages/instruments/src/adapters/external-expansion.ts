import type { Layer } from "../types.js";
import { defaultPalettes } from "../default-palettes.js";
import { CANVAS } from "@procedurals/javascript/examples/motif-compositions/compositions.js";
import { ornamentFieldRecords, shapeMatrixRecords } from "@procedurals/javascript/examples/motif-compositions/field-records.js"
import { orbitalBrushRecords, spacedSampleIndices, validateOrbitalRecordInput } from "@procedurals/javascript/examples/motif-compositions/orbital-records.js"


import { choice, numeric, toggle, channels, type StudioDefinition } from "./types.js";

export { ornamentFieldRecords, shapeMatrixRecords, orbitalBrushRecords };

const SCALE = 640 / CANVAS;

export const externalExpansionDefinitions: StudioDefinition[] = [
  {
    id: "ornament-poster",
    title: "Ornament field",
    description: "A seeded packed or ordered field with mixable botanical and emblem marks.",
    procedure: "Circles are packed across the frame and a share of them are kept as anchors. Each anchor receives a petal, leaf or emblem chosen by weighted chance, turned a little further than its neighbour to set the rhythm.",
    parameters: [choice("layout", "Layout", "Choose seeded packing or an ordered grid.", ["packed", "grid"]),
      numeric("petalWeight", "Petals", "Relative frequency of petal marks; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("leafWeight", "Leaves", "Relative frequency of leaf marks; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("emblemWeight", "Emblems", "Relative frequency of emblem marks; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("density", "Density", "Percent of available anchors carrying a mark.", 0, 100, 1, { integer: true }),
      numeric("scale", "Mark scale", "Size of each mark relative to its anchor.", 0, 3, 0.05, { hardMin: 0, hardMax: 32 }),
      numeric("angle", "Angle", "Rotation of every mark in degrees.", -360, 360, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      numeric("angleStride", "Angle stride", "Additional rotation per source anchor, in degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      numeric("offsetX", "Horizontal offset", "Move the entire field horizontally in drawing units.", -250, 250, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("offsetY", "Vertical offset", "Move the entire field vertically in drawing units.", -250, 250, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      toggle("guides", "Guides", "Show a fine inset frame around the placement area.")],
    controlGroups: [
      { label: "Field", stage: "form", controls: ["layout", "density"] },
      { label: "Mix", stage: "process", controls: ["petalWeight", "leafWeight", "emblemWeight"] },
      { label: "Placement", stage: "frame", controls: ["offsetX", "offsetY", "guides"] },
      { label: "Mark", stage: "material", controls: ["scale", "angle", "angleStride"] },
    ],
    defaults: {layout: "packed",
      petalWeight: 5,
      leafWeight: 3,
      emblemWeight: 0,
      density: 72,
      scale: 1.4,
      angle: 0,
      angleStride: 13,
      offsetX: 0,
      offsetY: 0,
      guides: false},
    validate: (q) => {
      if (Number(q.petalWeight) + Number(q.leafWeight) + Number(q.emblemWeight) === 0)
        throw new Error("Ornament field needs at least one mark family");
    },
  },
  {
    id: "geometric-panel",
    title: "Shape matrix",
    description: "An editable matrix of weighted geometric marks, spacing and orientation.",
    procedure: "A grid of cells is filled by weighted chance with wedges, crossed bars, discs and open arcs, and some cells are left empty. Each shape turns by a fixed step from the last, and alternate rows shift sideways into a staggered rhythm.",
    parameters: [numeric("columns", "Columns", "Number of horizontal grid positions.", 1, 24, 1, { hardMin: 1, hardMax: 2048, integer: true }),
      numeric("rows", "Rows", "Number of vertical grid positions.", 1, 24, 1, { hardMin: 1, hardMax: 2048, integer: true }),
      numeric("wedgeWeight", "Wedges", "Relative frequency of wedges; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("barWeight", "Bars", "Relative frequency of crossed bars; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("discWeight", "Discs", "Relative frequency of discs; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("arcWeight", "Arcs", "Relative frequency of open arcs; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("density", "Density", "Percent of grid cells carrying a mark.", 0, 100, 1, { integer: true }),
      numeric("scale", "Mark scale", "Size of each mark relative to a grid cell.", 0, 3, 0.05, { hardMin: 0, hardMax: 32 }),
      numeric("offsetX", "Horizontal offset", "Move all marks horizontally in drawing units.", -250, 250, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("offsetY", "Vertical offset", "Move all marks vertically in drawing units.", -250, 250, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("rowShift", "Alternate row shift", "Horizontal displacement of alternate rows in cell widths.", -2, 2, 0.05, { hardMin: -100, hardMax: 100 }),
      numeric("columnShift", "Alternate column shift", "Vertical displacement of alternate columns in cell heights.", -2, 2, 0.05, { hardMin: -100, hardMax: 100 }),
      numeric("angle", "Angle", "Rotation of every shape in degrees.", -360, 360, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      numeric("angleStep", "Angle step", "Additional rotation per grid cell in degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      toggle("guides", "Guides", "Show the underlying grid and inset frame.")],
    controlGroups: [
      { label: "Grid", stage: "form", controls: [{ label: "Divisions", controls: ["columns", "rows"], proportional: true }, "rowShift", "columnShift", "density", "guides"] },
      { label: "Mix", stage: "process", controls: ["wedgeWeight", "barWeight", "discWeight", "arcWeight"] },
      { label: "Placement", stage: "frame", controls: ["offsetX", "offsetY"] },
      { label: "Mark", stage: "material", controls: ["scale", "angle", "angleStep"] },
    ],
    defaults: {columns: 6,
      rows: 8,
      wedgeWeight: 5,
      barWeight: 3,
      discWeight: 0,
      arcWeight: 0,
      density: 78,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rowShift: 0.25,
      columnShift: 0,
      angle: -12,
      angleStep: 18,
      guides: false},
    validate: (q) => {
      if (Number(q.columns) * Number(q.rows) > 2048)
        throw new Error("Shape matrix has a 2048-cell drawing budget");
      if (Number(q.wedgeWeight) + Number(q.barWeight) + Number(q.discWeight) + Number(q.arcWeight) === 0)
        throw new Error("Shape matrix needs at least one shape family");
    },
  },
  {
    id: "orbital-brush",
    title: "Orbital brush",
    description: "Shape closed trajectories, sample by distance, and paint ribbons, beads or dashes.",
    procedure: "A family of ellipses is drawn, each one shifted, resized and turned a fixed step from the one before. Beads are set at even intervals along every path, so broad steps cross into a weave and small steps nest into rings.",
    parameters: [choice("source", "Path shape", "Choose ellipses or lobed radial waves for the supplied paths.", ["wave", "ellipse"]),
      numeric("centerX", "Center X", "Move the family horizontally in drawing units.", 0, 720, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("centerY", "Center Y", "Move the family vertically in drawing units.", 0, 720, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("centerStepX", "Center step X", "Move each later path horizontally from the previous path.", -120, 120, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("centerStepY", "Center step Y", "Move each later path vertically from the previous path.", -120, 120, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("radiusX", "Horizontal radius", "Set the first path's horizontal radius.", 0, 280, 1, { hardMin: 0, hardMax: 10000, integer: false }),
      numeric("radiusY", "Vertical radius", "Set the first path's vertical radius.", 0, 280, 1, { hardMin: 0, hardMax: 10000, integer: false }),
      numeric("paths", "Paths", "Number of independently resampled closed trajectories.", 1, 24, 1, { hardMin: 1, hardMax: 2048, integer: true }),
      numeric("radialSpacing", "Radius step", "Add this amount to both radii for each later path; negative values nest inward.", -60, 80, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("angle", "First angle", "Rotate the first path in degrees.", -360, 360, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      numeric("angleStep", "Angle step", "Additional rotation of each later path, in degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      numeric("lobes", "Lobes", "Number of radial waves on each path when Path shape is wave.", 1, 12, 1, { hardMin: 1, hardMax: 2048, integer: true }),
      numeric("depth", "Wave depth", "Signed radial deformation of each wave path; zero returns an ellipse.", -0.8, 0.8, 0.02, { hardMin: -100, hardMax: 100 }),
      numeric("samples", "Samples per path", "Number of equal-distance positions retained along each closed path.", 12, 384, 1, { hardMin: 1, hardMax: 16384, integer: true }),
      choice("marks", "Marks", "Render the same path samples as ribbons, beads or perpendicular dashes.", ["beads", "ribbons", "dashes"]),
      numeric("markSize", "Mark size", "Diameter of beads, length of dashes or width of ribbons.", 0, 20, 0.25, { hardMin: 0, hardMax: 10000 }),
      numeric("markSpacing", "Mark spacing", "Distance along the source path between beads or dashes; zero marks every sample.", 0, 60, 0.5, { hardMin: 0, hardMax: 10000 }),
      numeric("markOpacity", "Mark opacity", "Opacity of the foreground marks, from invisible to solid.", 0, 255, 1, { integer: true }),
      toggle("guides", "Path guides", "Show the actual retained trajectories beneath the selected marks.")],
    controlGroups: [
      { label: "Path shape", stage: "form", controls: ["source", "lobes", "depth", "samples"] },
      { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["radiusX", "radiusY"], proportional: true }, "angle"] },
      { label: "Path family", stage: "form", controls: ["paths", { label: "Center step", controls: ["centerStepX", "centerStepY"] }, "radialSpacing", "angleStep"] },
      { label: "Mark", stage: "material", controls: ["marks", "markSize", "markSpacing", "markOpacity", "guides"] },
    ],
    defaults: {source: "wave",
      centerX: 360,
      centerY: 360,
      centerStepX: 0,
      centerStepY: 0,
      radiusX: 92,
      radiusY: 58,
      paths: 7,
      radialSpacing: 26,
      angle: 0,
      angleStep: 19,
      lobes: 3,
      depth: 0.18,
      samples: 144,
      marks: "beads",
      markSize: 3.5,
      markSpacing: 12,
      markOpacity: 220,
      guides: false},
    validate: validateOrbitalBrush,
  }
];

const orbitalBase = externalExpansionDefinitions.find(item => item.id === "orbital-brush")!;
/** A starting recipe for the same editable orbital source, not another path generator. */
export const orbitalBeadDefinitions: StudioDefinition[] = [{
  ...orbitalBase, id: "orbit-beads", title: "Orbit beads",
  description: "Equal-distance beads on editable elliptical or lobed orbit families.",
  procedure: "Several nearly circular orbits are drawn, each waved by lobes and set to its own size, centre and tilt. Beads are placed at even steps along every orbit, so the rings cross and overlap like planetary tracks.",
  parameters: [...orbitalBase.parameters],
  defaults: {...orbitalBase.defaults,
    radiusX: 60,
    radiusY: 60,
    paths: 8,
    radialSpacing: 20,
    angleStep: 9,
    lobes: 3,
    depth: .13,
    samples: 180,
    marks: "beads",
    markSize: 3.75,
    markSpacing: 12},
}];

type OrbitalPainter = {
  ROUND: unknown; CLOSE: unknown;
  push(): void; pop(): void; scale(value: number): void;
  noFill(): void; noStroke(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(value: number): void; strokeCap(value: unknown): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: unknown): void;
  circle(x: number, y: number, diameter: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};

function validateOrbitalBrush(q: Layer["params"]): void {
  
  validateOrbitalRecordInput(q);
}


/** Copy a shipped palette into a layer; source palette records stay immutable. */
export function externalExpansionPalette(id: string): number[] | null {
  const paletteId = ({
    "ornament-poster": "sage-linen",
    "geometric-panel": "ochre-plum",
    "orbital-brush": "mauve-mist",
    "contact-network": "deep-teal",
    "agent-trails": "fern-mauve",
  } as Record<string, string>)[id];
  const selected = defaultPalettes.find((candidate) => candidate.id === paletteId);
  return selected
    ? selected.colors.map((hex) => Number.parseInt(hex.slice(1), 16))
    : null;
}

export function drawExternalExpansion(p: any, layer: Layer): void {
  switch (layer.technique) {
    case "ornament-poster": return drawOrnamentPoster(p, layer);
    case "geometric-panel": return drawGeometricPanel(p, layer);
    case "orbital-brush": return drawOrbitalBrush(p, layer);
    default: throw new Error("Unknown external expansion technique");
  }
}

function withNativeScale(p: any, draw: () => void): void {
  p.push();
  p.scale(SCALE);
  draw();
  p.pop();
}

function colour(palette: number[], index: number): [number, number, number] {
  return channels(palette[index % palette.length]);
}



function drawOrnamentPoster(p: any, layer: Layer): void {
  
  const q = layer.params;
  const marks = ornamentFieldRecords(layer);
  withNativeScale(p, () => {
    for (const mark of marks) {
      drawOrnamentMotif(p, mark.kind, mark.x, mark.y, mark.radius, mark.sourceIndex, layer.palette, mark.angle);
    }
    if (q.guides) {
      p.noFill();
      p.stroke(...colour(layer.palette, 0), 110);
      p.strokeWeight(1);
      p.rect(72, 72, 576, 576);
    }
  });
}



function drawOrnamentMotif(p: any, kind: string, x: number, y: number, radius: number, index: number, palette: number[], angle = index * 0.618): void {
  p.push();
  p.translate(x, y);
  p.rotate(angle);
  p.noStroke();
  if (kind === "petals") {
    for (let petal = 0; petal < 5; petal += 1) {
      p.fill(...colour(palette, index + petal), 210);
      p.ellipse(Math.cos(petal * Math.PI * 2 / 5) * radius * 0.34, Math.sin(petal * Math.PI * 2 / 5) * radius * 0.34, radius * 0.72, radius * 0.44);
    }
    p.fill(...colour(palette, index + 2));
    p.circle(0, 0, Math.max(5, radius * 0.34));
  } else if (kind === "leaves") {
    p.fill(...colour(palette, index + 1), 220);
    p.ellipse(0, 0, radius * 0.76, radius * 1.8);
    p.stroke(...colour(palette, index + 3), 160);
    p.strokeWeight(1);
    p.line(0, -radius * 0.75, 0, radius * 0.75);
  } else {
    p.noFill();
    p.stroke(...colour(palette, index + 2), 230);
    p.strokeWeight(Math.max(2, radius * 0.13));
    p.strokeCap(p.SQUARE);
    p.line(-radius * 0.42, -radius * 0.54, -radius * 0.42, radius * 0.52);
    p.line(-radius * 0.42, -radius * 0.54, radius * 0.42, -radius * 0.54);
    if (index % 2 === 0) {
      p.line(-radius * 0.1, 0, radius * 0.42, 0);
      p.line(-radius * 0.1, 0, radius * 0.42, radius * 0.52);
    } else {
      p.arc(-radius * 0.08, 0, radius * 0.72, radius * 0.86, -p.HALF_PI, p.HALF_PI);
      p.line(-radius * 0.08, radius * 0.43, radius * 0.38, radius * 0.52);
    }
    p.noStroke();
    p.fill(...colour(palette, index + 4), 210);
    p.circle(radius * 0.44, -radius * 0.54, Math.max(4, radius * 0.16));
  }
  p.pop();
}

function drawGeometricPanel(p: any, layer: Layer): void {
  
  const q = layer.params;
  const marks = shapeMatrixRecords(layer);
  withNativeScale(p, () => {
    if (q.guides) {
      p.noFill();
      p.stroke(...colour(layer.palette, 0), 80);
      p.strokeWeight(1);
      p.rect(72, 72, 576, 576);
      const columns = Number(q.columns), rows = Number(q.rows);
      for (let column = 0; column < columns; column += 1) {
        const x = columns === 1 ? 360 : 72 + column * 576 / (columns - 1);
        p.line(x, 72, x, 648);
      }
      for (let row = 0; row < rows; row += 1) {
        const y = rows === 1 ? 360 : 72 + row * 576 / (rows - 1);
        p.line(72, y, 648, y);
      }
    }
    for (const mark of marks) {
      drawPanelMark(p, mark.kind, mark.x, mark.y, mark.scale, mark.sourceIndex, layer.palette, mark.angle);
    }
  });
}



function drawPanelMark(p: any, treatment: string, x: number, y: number, scale: number, kind: number, palette: number[], angle = (kind - 1.5) * 0.22): void {
  p.push();
  p.translate(x, y);
  p.rotate(angle);
  p.noStroke();
  if (treatment === "discs") {
    p.fill(...colour(palette, kind), 220);
    p.circle(0, 0, 100 * scale);
    p.fill(...colour(palette, kind + 2), 190);
    p.circle(20 * scale, -16 * scale, 34 * scale);
  } else if (treatment === "arcs") {
    p.noFill();
    p.stroke(...colour(palette, kind), 230);
    p.strokeWeight(Math.max(1, 10 * scale));
    p.arc(0, 0, 110 * scale, 110 * scale, -p.HALF_PI, p.PI);
    p.stroke(...colour(palette, kind + 2), 190);
    p.arc(0, 0, 67 * scale, 67 * scale, 0, p.PI + p.HALF_PI);
  } else if (treatment === "bars") {
    p.fill(...colour(palette, kind));
    p.rect(-78 * scale, -9 * scale, 156 * scale, 18 * scale);
    p.fill(...colour(palette, kind + 2), 220);
    p.rect(-9 * scale, -54 * scale, 18 * scale, 108 * scale);
  } else {
    p.fill(...colour(palette, kind));
    p.triangle(-72 * scale, 48 * scale, 72 * scale, 26 * scale, -10 * scale, -66 * scale);
    p.fill(...colour(palette, kind + 2), 210);
    p.quad(-42 * scale, 39 * scale, 19 * scale, 29 * scale, -4 * scale, -30 * scale, -55 * scale, -18 * scale);
  }
  p.pop();
}

export function drawOrbitalBrush(p: OrbitalPainter, layer: Layer): void {
  
  const q = layer.params;
  const paths = orbitalBrushRecords(layer);
  withNativeScale(p, () => {
    for (const path of paths) {
      const ink = colour(layer.palette, path.colorIndex);
      if (q.guides) {
        p.noFill();
        p.stroke(...ink, 65);
        p.strokeWeight(0.7);
        p.beginShape();
        for (const point of path.points) p.vertex(point[0], point[1]);
        p.endShape(p.CLOSE);
      }
      if (q.marks === "ribbons") {
        p.noFill();
        p.stroke(...ink, Number(q.markOpacity));
        p.strokeCap(p.ROUND);
        p.strokeWeight(Number(q.markSize));
        p.beginShape();
        for (const point of path.points) p.vertex(point[0], point[1]);
        p.endShape(p.CLOSE);
        continue;
      }
      const indices = spacedSampleIndices(path, Number(q.markSpacing));
      p.stroke(...ink, Number(q.markOpacity));
      p.fill(...ink, Number(q.markOpacity));
      p.strokeCap(p.ROUND);
      p.strokeWeight(Math.min(2, Number(q.markSize) / 3));
      for (const index of indices) {
        const point = path.points[index];
        if (q.marks === "beads") {
          p.noStroke();
          p.circle(point[0], point[1], Number(q.markSize));
          continue;
        }
        const previous = path.points[(index + path.points.length - 1) % path.points.length];
        const next = path.points[(index + 1) % path.points.length];
        const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy);
        if (length === 0) {
          p.circle(point[0], point[1], Number(q.markSize));
          continue;
        }
        const half = Number(q.markSize) / (2 * length);
        p.line(point[0] - dy * half, point[1] + dx * half,
          point[0] + dy * half, point[1] - dx * half);
      }
    }
  });
}



type ProximityKind = "contact-network" | "agent-trails";
type ProximityState = { points: number[][]; velocities: number[][]; groups: number[]; edges: number[][] };










