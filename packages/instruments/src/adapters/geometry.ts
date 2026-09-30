import type { ControlGroup, Layer } from "../types.js";
import {
  numeric,
  choice,
  toggle,
  channels,
  type StudioDefinition,
} from "./types.js";

import { createCutModel } from "../cut-model.js";
import { drawLoopMarksModern, validateLoopMarks } from "./loop-marks-quality.js";

type Q = Record<string, any>;
const colors = (layer: Layer): number[] => layer.palette;

const fill = (p: any, value: number, alpha = 255) =>
  p.fill(...channels(value), alpha);
const pick = (palette: number[], index: number) =>
  palette[index % palette.length];

export const geometryDefinitions: StudioDefinition[] = [
  {
    id: "loop-marks",
    title: "Loop marks",
    description: "Construct closed loops, then choose outlines, edge tiles, or triangle fans.",
    procedure: "Closed loops swell into lobes as radial waves ripple around a base curve, each loop set to a different phase. The code walks each outline at even steps and drops a coloured diamond at every station.",
    parameters: [choice("layout", "Layout", "Arrange loops along a row, in a grid, or concentrically.", ["row", "grid", "nested"]),
      numeric("loopCount", "Loops", "Number of loops in the chosen layout.", 1, 16, 1, { integer: true }),
      numeric("columns", "Grid columns", "Number of columns when Layout is grid.", 1, 8, 1, { integer: true }),
      numeric("spacingX", "Spacing X", "Horizontal step between loop centers.", 10, 500, 1),
      numeric("spacingY", "Spacing Y", "Vertical step between loop centers.", 10, 500, 1),
      numeric("centerX", "Center X", "Horizontal center of the loop arrangement.", -320, 960, 1),
      numeric("centerY", "Center Y", "Vertical center of the loop arrangement.", -320, 960, 1),
      numeric("radiusX", "Radius X", "Horizontal radius of each base spline.", 4, 500, 1),
      numeric("radiusY", "Radius Y", "Vertical radius of each base spline.", 4, 500, 1),
      numeric("nestedScale", "Nested scale", "Scale factor between concentric loops.", .2, 1, .01),
      numeric("knotCount", "Base knots", "Control points in the base closed spline.", 5, 16, 1, { integer: true }),
      numeric("lobes", "Lobes", "Number of radial waves around the sampled contour; zero keeps the base spline.", 0, 12, 1, { integer: true }),
      numeric("lobeDepth", "Lobe depth", "Strength of the radial waves.", 0, .8, .01),
      numeric("phase", "Lobe phase", "Rotates the radial wave pattern in degrees.", -180, 180, 1),
      numeric("subdivisions", "Subdivisions", "Samples per base spline span.", 8, 64, 1, { integer: true }),
      choice("treatment", "Treatment", "Draw outlines, edge tiles, fans, or outlines with tiles.", ["outline", "tiles", "fans", "outline-tiles"]),
      choice("tileShape", "Tile shape", "Bar, diamond, or perpendicular tick along the contour.", ["bar", "diamond", "tick"]),
      numeric("tileSpacing", "Tile spacing", "Distance between edge marks along the contour.", 4, 80, 1),
      numeric("tileWidth", "Tile width", "Along-contour tile width, or tick stroke width.", 1, 80, 1),
      numeric("tileHeight", "Tile height", "Across-contour tile height.", 1, 80, 1),
      numeric("outlineWeight", "Outline weight", "Width of the closed contour stroke.", .1, 12, .1),
      numeric("fanOpacity", "Fan opacity", "Opacity of triangle fans.", 0, 255, 1)],
    controlGroups: [
      { label: "Layout", stage: "form", controls: ["layout", "loopCount", "columns",
        { label: "Spacing", controls: ["spacingX", "spacingY"], proportional: true }, "nestedScale"] },
      { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["radiusX", "radiusY"], proportional: true }] },
      { label: "Contour", stage: "form", controls: ["knotCount", "subdivisions",
        { label: "Lobes", controls: ["lobes", "lobeDepth", "phase"] }] },
      { label: "Treatment", stage: "material", controls: ["treatment", "outlineWeight",
        { label: "Tiles", controls: ["tileShape", "tileSpacing",
          { label: "Size", controls: ["tileWidth", "tileHeight"], proportional: true }] },
        "fanOpacity"] },
    ],
    defaults: {layout: "row",
      loopCount: 3,
      columns: 3,
      spacingX: 200,
      spacingY: 20,
      centerX: 320,
      centerY: 320,
      radiusX: 78,
      radiusY: 105,
      nestedScale: .78,
      knotCount: 8,
      lobes: 4,
      lobeDepth: .25,
      phase: 0,
      subdivisions: 24,
      treatment: "outline-tiles",
      tileShape: "diamond",
      tileSpacing: 28,
      tileWidth: 8,
      tileHeight: 14,
      fanOpacity: 120,
      outlineWeight: 1.5},
    validate: validateLoopMarks,
  },
  {
    id: "cut-marks",
    title: "Cut marks",
    description: "Seeded retained unequal rectangles.",
    procedure: "A single rectangle splits again and again, each seeded cut landing near its middle and some crossed by a perpendicular cut. The surviving panels are painted and inset, while removed ones open as holes.",
    parameters: [
      numeric("cuts", "Cut rounds", "Number of retained cut rounds.", 2, 24, 1),
      numeric(
        "spread",
        "Cut spread",
        "Random cut-ratio spread around the midpoint.",
        0.05,
        0.45,
        0.01,
      ),
      numeric("inset", "Inset", "Rectangle inset in pixels.", 0, 12, 0.5),
      numeric("opacity", "Opacity", "Filled-region opacity.", 30, 240, 1),
      toggle(
        "staggered",
        "Staggered",
        "Use independent second horizontal cuts.",
      ),
    ],
    controlGroups: [
      { label: "Cuts", stage: "form", controls: ["cuts", "staggered", "spread"] },
      { label: "Drawing", stage: "material", controls: ["inset", "opacity"] },
    ],
    defaults: {
      cuts: 10,
      spread: 0.25,
      inset: 1,
      opacity: 190,
      staggered: false,
    },
  }
];

export function drawGeometry(p: any, layer: Layer): void {
  p.push();
  try {
    switch (layer.technique) {
      case "loop-marks":
        return drawLoopMarksModern(p, layer);
      case "cut-marks":
        return cuts(p, layer);
      default:
        throw new Error(
          `Unknown geometry technique: ${String(layer.technique)}`,
        );
    }
  } finally {
    p.pop();
  }
}

function cuts(p: any, l: Layer) {
  const q = l.params as Q,
    model = createCutModel(l),
    palette = colors(l);
  p.noStroke();
  for (const leaf of model.leaves()) {
    const b = leaf.bounds;
    fill(p, pick(palette, leaf.id), q.opacity);
    p.rect(
      b[0] + q.inset,
      b[1] + q.inset,
      b[2] - b[0] - 2 * q.inset,
      b[3] - b[1] - 2 * q.inset,
    );
  }
}



