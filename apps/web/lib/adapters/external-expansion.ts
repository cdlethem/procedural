import type { Layer } from "../studio-types";
import { defaultPalettes } from "../default-palettes";
import {
  botanicalLayout,
  CANVAS,
  orbitalLayout,
  panelLayout,
} from "@procedurals/javascript/examples/motif-compositions/compositions.js"
import { ornamentFieldRecords, shapeMatrixRecords } from "@procedurals/javascript/examples/motif-compositions/field-records.js"
import { orbitalBrushRecords, spacedSampleIndices, validateOrbitalRecordInput } from "@procedurals/javascript/examples/motif-compositions/orbital-records.js"
import { pairForceStep2D } from "@procedurals/javascript"
import { radiusPairs2D } from "@procedurals/javascript"
import { choice, numeric, toggle, channels, type StudioDefinition } from "./types";

export { ornamentFieldRecords, shapeMatrixRecords, orbitalBrushRecords };

const SCALE = 640 / CANVAS;
const MAX_TICKS = 180;
const WORK_BUDGET = 20_000;
const proximityDefaults = {
  ticks: 72,
  radius: 54,
  avoidance: 0.22,
  openChains: false,
  dotMarks: false,
};

export const externalExpansionDefinitions: StudioDefinition[] = [
  {
    id: "ornament-poster",
    title: "Ornament field",
    description: "A seeded packed or ordered field with mixable botanical and emblem marks.",
    parameters: [
      choice("layout", "Layout", "Choose seeded packing or an ordered grid.", ["packed", "grid"]),
      numeric("petalWeight", "Petals", "Relative frequency of petal marks; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("leafWeight", "Leaves", "Relative frequency of leaf marks; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("emblemWeight", "Emblems", "Relative frequency of emblem marks; zero removes them.", 0, 10, 1, { integer: true }),
      numeric("density", "Density", "Percent of available anchors carrying a mark.", 0, 100, 1, { integer: true }),
      numeric("scale", "Mark scale", "Size of each mark relative to its anchor.", 0, 3, 0.05, { hardMin: 0, hardMax: 32 }),
      numeric("angle", "Angle", "Rotation of every mark in degrees.", -360, 360, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      numeric("angleStride", "Angle stride", "Additional rotation per source anchor, in degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
      numeric("offsetX", "Horizontal offset", "Move the entire field horizontally in drawing units.", -250, 250, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      numeric("offsetY", "Vertical offset", "Move the entire field vertically in drawing units.", -250, 250, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
      toggle("guides", "Guides", "Show a fine inset frame around the placement area."),
      { ...choice("motif", "Legacy motif", "Saved poster treatment.", ["petals", "leaves", "emblems"]), hidden: true },
      { ...toggle("tiered", "Legacy tiers", "Saved poster treatment."), hidden: true },
      { ...toggle("cropped", "Legacy crop", "Saved poster treatment."), hidden: true },
      { ...toggle("dense", "Legacy density", "Saved poster treatment."), hidden: true },
      { ...toggle("legacy", "Legacy rendering", "Preserves saved poster pixels."), hidden: true },
    ],
    defaults: { layout: "packed", petalWeight: 5, leafWeight: 3, emblemWeight: 0, density: 72,
      scale: 1.4, angle: 0, angleStride: 13, offsetX: 0, offsetY: 0, guides: false,
      motif: "petals", tiered: true, cropped: true, dense: false, legacy: false },
    validate: (q) => {
      if (!q.legacy && Number(q.petalWeight) + Number(q.leafWeight) + Number(q.emblemWeight) === 0)
        throw new Error("Ornament field needs at least one mark family");
    },
  },
  {
    id: "geometric-panel",
    title: "Shape matrix",
    description: "An editable matrix of weighted geometric marks, spacing and orientation.",
    parameters: [
      numeric("columns", "Columns", "Number of horizontal grid positions.", 1, 24, 1, { hardMin: 1, hardMax: 2048, integer: true }),
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
      toggle("guides", "Guides", "Show the underlying grid and inset frame."),
      { ...choice("marks", "Legacy marks", "Saved panel treatment.", ["wedges", "bars"]), hidden: true },
      { ...toggle("tight", "Legacy grid", "Saved panel treatment."), hidden: true },
      { ...toggle("legacy", "Legacy rendering", "Preserves saved panel pixels."), hidden: true },
    ],
    defaults: { columns: 6, rows: 8, wedgeWeight: 5, barWeight: 3, discWeight: 0, arcWeight: 0,
      density: 78, scale: 1, offsetX: 0, offsetY: 0, rowShift: 0.25, columnShift: 0,
      angle: -12, angleStep: 18, guides: false, marks: "wedges", tight: false, legacy: false },
    validate: (q) => {
      if (Number(q.columns) * Number(q.rows) > 2048)
        throw new Error("Shape matrix has a 2048-cell drawing budget");
      if (!q.legacy && Number(q.wedgeWeight) + Number(q.barWeight) + Number(q.discWeight) + Number(q.arcWeight) === 0)
        throw new Error("Shape matrix needs at least one shape family");
    },
  },
  {
    id: "orbital-brush",
    title: "Orbital brush",
    description: "Shape closed trajectories, sample by distance, and paint ribbons, beads or dashes.",
    parameters: [
      choice("source", "Path shape", "Choose ellipses or lobed radial waves for the supplied paths.", ["wave", "ellipse"]),
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
      toggle("guides", "Path guides", "Show the actual retained trajectories beneath the selected marks."),
      { ...choice("brush", "Legacy brush", "Saved orbital brush treatment.", ["ribbons", "beads"]), hidden: true },
      { ...toggle("more", "Legacy path family", "Saved orbital path count."), hidden: true },
      { ...toggle("legacy", "Legacy rendering", "Preserves saved orbital composition."), hidden: true },
    ],
    defaults: { source: "wave", centerX: 360, centerY: 360, centerStepX: 0, centerStepY: 0,
      radiusX: 92, radiusY: 58, paths: 7, radialSpacing: 26, angle: 0, angleStep: 19,
      lobes: 3, depth: 0.18, samples: 144, marks: "beads", markSize: 3.5,
      markSpacing: 12, markOpacity: 220, guides: false, brush: "ribbons", more: false, legacy: false },
    validate: validateOrbitalBrush,
  },
  {
    id: "contact-network",
    title: "Contact network",
    description: "Current nearby relationships after an explicit synchronous motion replay.",
    parameters: proximityParameters("current connection marks"),
    defaults: proximityDefaults,
  },
  {
    id: "agent-trails",
    title: "Agent trails",
    description: "Retained paths from an explicit synchronous motion replay.",
    parameters: proximityParameters("retained trail marks"),
    defaults: proximityDefaults,
  },
];

function validateOrbitalBrush(q: Layer["params"]): void {
  if (q.legacy) return;
  validateOrbitalRecordInput(q);
}

function proximityParameters(markDescription: string) {
  return [
    numeric("ticks", "Ticks", "Replay count from the explicit initial state.", 0, MAX_TICKS, 1),
    numeric("radius", "Radius", "Inclusive nearby-relationship distance in drawing units.", 40, 96, 1),
    numeric("avoidance", "Avoidance", "Short-range repulsion used by later replayed steps.", 0.1, 0.75, 0.01),
    toggle("openChains", "Open chains", "Replace current proximity pairs with supplied open-chain edges."),
    toggle("dotMarks", "Dot marks", `Draw ${markDescription} as dots instead of lines.`),
  ];
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
    case "contact-network": return drawProximityStudy(p, layer, "contact-network");
    case "agent-trails": return drawProximityStudy(p, layer, "agent-trails");
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

function motifRadius(radius: number, index: number, tiered: boolean): number {
  if (!tiered) return radius;
  return radius * (index % 7 === 0 ? 1.55 : index % 3 === 0 ? 1.18 : 0.72);
}

function drawOrnamentPoster(p: any, layer: Layer): void {
  if (layer.params.legacy) return drawLegacyOrnamentPoster(p, layer);
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

function drawLegacyOrnamentPoster(p: any, layer: Layer): void {
  const q = layer.params;
  const layout = botanicalLayout(Boolean(q.dense));
  withNativeScale(p, () => {
    p.noStroke();
    p.fill(...colour(layer.palette, 0), 30);
    for (let y = 40; y < CANVAS; y += 28) p.rect(0, y, CANVAS, 1);
    p.fill(...colour(layer.palette, 0));
    p.rect(45, 45, CANVAS - 90, CANVAS - 90);
    p.fill(...colour(layer.palette, 4));
    p.rect(60, 60, CANVAS - 120, CANVAS - 120);
    const crop = q.cropped ? [112, 132, 496, 432] : [78, 78, 564, 564];
    p.drawingContext.save();
    p.drawingContext.beginPath();
    p.drawingContext.rect(...crop);
    p.drawingContext.clip();
    for (const [x, y, radius, index] of layout.rows) {
      drawOrnamentMotif(p, String(q.motif), x, y, motifRadius(radius, index, Boolean(q.tiered)), index, layer.palette);
    }
    p.drawingContext.restore();
    p.noFill();
    p.stroke(...colour(layer.palette, 0));
    p.strokeWeight(2);
    p.rect(78, 78, CANVAS - 156, CANVAS - 156);
    p.noStroke();
    p.fill(...colour(layer.palette, 0));
    p.rect(168, 306, 384, 108);
    p.fill(247, 247, 235);
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textSize(36);
    p.text("WILD ORNAMENT", 360, 346);
    p.textStyle(p.NORMAL);
    p.textSize(13);
    p.text("FIELD NOTES / EDITION 08", 360, 380);
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
  if (layer.params.legacy) return drawLegacyGeometricPanel(p, layer);
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

function drawLegacyGeometricPanel(p: any, layer: Layer): void {
  const q = layer.params;
  const layout = panelLayout(Boolean(q.tight));
  withNativeScale(p, () => {
    p.noStroke();
    p.fill(...colour(layer.palette, 0));
    p.rect(45, 45, 630, 630);
    p.fill(...colour(layer.palette, 3), 100);
    p.rect(80, 102, 198, 525);
    p.fill(...colour(layer.palette, 1), 140);
    p.rect(476, 72, 150, 575);
    for (const [x, y, scale, kind] of layout.rows) {
      drawPanelMark(p, String(q.marks), x + (y > 420 ? 36 : 0), y, scale, kind, layer.palette);
    }
    p.noFill();
    p.stroke(...colour(layer.palette, 4), 170);
    p.strokeWeight(2);
    p.rect(63, 63, 594, 594);
    p.strokeWeight(1);
    for (let index = 0; index < 8; index += 1) p.line(88, 115 + index * 70, 632, 115 + index * 70);
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

function drawOrbitalBrush(p: any, layer: Layer): void {
  if (layer.params.legacy) return drawLegacyOrbitalBrush(p, layer);
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
        for (const point of path.points) p.vertex(...point);
        p.endShape(p.CLOSE);
      }
      if (q.marks === "ribbons") {
        p.noFill();
        p.stroke(...ink, Number(q.markOpacity));
        p.strokeCap(p.ROUND);
        p.strokeWeight(Number(q.markSize));
        p.beginShape();
        for (const point of path.points) p.vertex(...point);
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

function drawLegacyOrbitalBrush(p: any, layer: Layer): void {
  const q = layer.params;
  const layout = orbitalLayout(Boolean(q.more));
  withNativeScale(p, () => {
    p.noStroke();
    p.fill(...colour(layer.palette, 4), 28);
    p.circle(304, 340, 125);
    p.circle(422, 286, 98);
    p.circle(387, 448, 150);
    p.noFill();
    p.stroke(48, 42, 52, 24);
    p.strokeWeight(1);
    for (let index = 0; index < 12; index += 1) p.circle(360, 360, 110 + index * 33);
    for (let index = 0; index < layout.paths.length; index += 1) {
      const path = layout.paths[index];
      const color = colour(layer.palette, path.colorIndex);
      if (q.brush === "beads") {
        p.noStroke();
        p.fill(...color, 175);
        for (let point = 0; point < path.points.length; point += 5) p.circle(...path.points[point], 2.5 + (index % 3));
      } else {
        p.noFill();
        p.stroke(...color, 180);
        p.strokeCap(p.ROUND);
        p.strokeWeight(path.width);
        p.beginShape();
        for (const point of path.points) p.vertex(...point);
        p.endShape(p.CLOSE);
      }
    }
    p.noStroke();
    p.fill(48, 42, 52, 170);
    p.circle(304, 340, 7);
    p.circle(422, 286, 6);
    p.circle(387, 448, 8);
  });
}

type ProximityKind = "contact-network" | "agent-trails";
type ProximityState = { points: number[][]; velocities: number[][]; groups: number[]; edges: number[][] };

function initialProximityState(kind: ProximityKind, openChains: boolean): ProximityState {
  const points: number[][] = [], velocities: number[][] = [], groups: number[] = [], edges: number[][] = [];
  if (openChains) {
    for (let group = 0; group < 3; group += 1) {
      for (let index = 0; index < 25; index += 1) {
        const t = index / 24;
        const agent = points.length;
        points.push([180 + group * 180 + 48 * Math.sin(t * Math.PI * 2 + group * 0.55), 140 + t * 440]);
        velocities.push([0.16 * Math.cos(t * Math.PI * 2), 0]);
        groups.push(group);
        if (index > 0) edges.push([agent - 1, agent]);
      }
    }
  } else if (kind === "contact-network") {
    const centres = [[252, 295], [473, 335], [349, 470]];
    for (let group = 0; group < 3; group += 1) {
      for (let index = 0; index < 42; index += 1) {
        const angle = index * 2.399963229728653;
        const radius = 18 + Math.sqrt(index / 41) * 126;
        points.push([centres[group][0] + Math.cos(angle) * radius, centres[group][1] + Math.sin(angle) * radius * 0.91]);
        velocities.push([Math.sin(angle) * 0.42, -Math.cos(angle) * 0.42]);
        groups.push(group);
      }
    }
  } else {
    for (let group = 0; group < 3; group += 1) {
      for (let index = 0; index < 36; index += 1) {
        const angle = index / 36 * Math.PI * 2 + group * 0.12;
        const radius = 120 + group * 52;
        points.push([360 + Math.cos(angle) * radius, 360 + Math.sin(angle) * radius * 0.87]);
        velocities.push([-Math.sin(angle) * (1.65 - group * 0.16), Math.cos(angle) * (1.65 - group * 0.16)]);
        groups.push(group);
      }
    }
  }
  return { points, velocities, groups, edges };
}

function proximityReplay(kind: ProximityKind, layer: Layer) {
  const q = layer.params;
  const initial = initialProximityState(kind, Boolean(q.openChains));
  let points = initial.points.map((point) => point.slice());
  let velocities = initial.velocities.map((velocity) => velocity.slice());
  const history = [points.map((point) => point.slice())];
  const pairs = () => Boolean(q.openChains)
    ? initial.edges.map((edge) => edge.slice())
    : radiusPairs2D({ points, radius: Number(q.radius), maxWork: WORK_BUDGET }).pairs;
  for (let tick = 0; tick < Number(q.ticks); tick += 1) {
    const next = pairForceStep2D({
      points,
      velocities,
      pairs: pairs(),
      attraction: kind === "contact-network" ? 0.0011 : 0.00042,
      repulsion: Number(q.avoidance),
      repulsionRadius: kind === "contact-network" ? 42 : 34,
      damping: kind === "contact-network" ? 0.94 : 0.995,
      dt: 1,
      maxSpeed: 2.1,
      maxWork: WORK_BUDGET,
    });
    points = next.points;
    velocities = next.velocities;
    history.push(points.map((point) => point.slice()));
  }
  return { ...initial, points, velocities, history, pairs: pairs() };
}

function drawProximityStudy(p: any, layer: Layer, kind: ProximityKind): void {
  const state = proximityReplay(kind, layer);
  withNativeScale(p, () => {
    p.noFill();
    p.stroke(...colour(layer.palette, 0), 75);
    p.strokeWeight(0.65);
    p.rect(30, 30, 660, 660);
    for (const [x, y] of [[45, 45], [675, 45], [45, 675], [675, 675]]) {
      p.line(x - 5, y, x + 5, y);
      p.line(x, y - 5, x, y + 5);
    }
    if (kind === "contact-network") drawNetwork(p, layer, state);
    else drawTrails(p, layer, state);
  });
}

function drawNetwork(p: any, layer: Layer, state: ReturnType<typeof proximityReplay>): void {
  const dots = Boolean(layer.params.dotMarks);
  if (!dots || Boolean(layer.params.openChains)) {
    for (const [left, right] of state.pairs) {
      p.stroke(...colour(layer.palette, state.groups[left]), Boolean(layer.params.openChains) ? 190 : 68);
      p.strokeWeight(Boolean(layer.params.openChains) ? 2.2 : 0.7);
      p.line(...state.points[left], ...state.points[right]);
    }
  }
  for (let index = 0; index < state.points.length; index += 1) {
    p.noStroke();
    p.fill(...colour(layer.palette, state.groups[index]));
    p.circle(...state.points[index], dots ? 5.5 : 3.5);
  }
}

function drawTrails(p: any, layer: Layer, state: ReturnType<typeof proximityReplay>): void {
  const dots = Boolean(layer.params.dotMarks);
  for (let index = 0; index < state.points.length; index += 1) {
    const color = colour(layer.palette, state.groups[index]);
    p.noFill();
    p.stroke(...color, dots ? 180 : 140);
    p.strokeWeight(dots ? 2.3 : 1.05);
    if (dots) {
      for (let frame = 0; frame < state.history.length; frame += 6) p.point(...state.history[frame][index]);
    } else {
      p.beginShape();
      for (const frame of state.history) p.vertex(...frame[index]);
      p.endShape();
    }
    const [x, y] = state.points[index];
    const [vx, vy] = state.velocities[index];
    p.stroke(...color, 220);
    p.strokeWeight(0.85);
    p.line(x, y, x + vx * 7, y + vy * 7);
    p.noStroke();
    p.fill(...color);
    p.circle(x, y, 3.2);
  }
  if (Boolean(layer.params.openChains)) {
    p.strokeWeight(1.3);
    for (const [left, right] of state.pairs) {
      p.stroke(...colour(layer.palette, state.groups[left]), 210);
      p.line(...state.points[left], ...state.points[right]);
    }
  }
}
