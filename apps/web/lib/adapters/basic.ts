import type { Layer } from "../studio-types";
import { numeric, toggle, channels, type StudioDefinition } from "./types";
import {
  createMarkField,
  markCommands,
} from "../../../../packages/javascript/examples/field-marks/mark-field.js";
import { createPathMarks } from "../../../../packages/javascript/examples/path-marks/path-marks.js";
import {
  createSeededPlacementMarks,
  createRadialPlacementMarks,
  vertexInto,
} from "../../../../packages/javascript/examples/placement-marks/placement-marks.js";
import { occupiedLatticePaths2D } from "../../../../packages/javascript/src/occupied-lattice-paths.js";
import { cyclicPalette } from "../../../../packages/javascript/src/cyclic-palette.js";

export const basicDefinitions: StudioDefinition[] = [
  {
    id: "field-marks",
    title: "Field marks",
    description: "A sampled noise field drawn as short lines or bars.",
    parameters: [
      numeric("columns", "Columns", "Number of field columns.", 16, 160),
      numeric("rows", "Rows", "Number of field rows.", 16, 160),
      numeric(
        "pitch",
        "Pitch",
        "Distance between field samples in pixels.",
        4,
        16,
      ),
      numeric("maxLength", "Maximum length", "Longest mark in pixels.", 1, 64),
      toggle("bars", "Bars", "Draw filled bars instead of line marks."),
    ],
    defaults: { columns: 80, rows: 80, pitch: 8, maxLength: 14, bars: false },
  },
  {
    id: "path-marks",
    title: "Path marks",
    description: "Marks or traces along seeded gradient paths.",
    parameters: [
      numeric("steps", "Steps", "Steps per path.", 50, 2000),
      numeric(
        "distance",
        "Step distance",
        "Distance travelled at each path step.",
        0.1,
        2,
        0.05,
      ),
      numeric(
        "markLength",
        "Mark length",
        "Length of perpendicular marks.",
        1,
        64,
      ),
      toggle(
        "trace",
        "Trace",
        "Draw connected paths instead of perpendicular marks.",
      ),
    ],
    defaults: { steps: 600, distance: 0.4, markLength: 12, trace: false },
  },
  {
    id: "placement-marks",
    title: "Placement marks",
    description: "Circle placements rendered as rings or diamonds.",
    parameters: [
      numeric(
        "attempts",
        "Proposals",
        "Circle proposals to consider, not a guaranteed shape count.",
        100,
        5000,
      ),
      numeric("minimum", "Minimum radius", "Smallest proposed radius.", 2, 32),
      numeric("maximum", "Maximum radius", "Largest proposed radius.", 4, 64),
      numeric(
        "separation",
        "Separation",
        "Spacing relative to the proposed circle radii.",
        0.5,
        2,
        0.05,
      ),
      toggle(
        "radial",
        "Radial source",
        "Use the supplied radial proposal layout instead of random proposals.",
      ),
      toggle(
        "diamonds",
        "Diamonds",
        "Draw four-cornered forms in the same placements.",
      ),
    ],
    defaults: {
      attempts: 3000,
      minimum: 4,
      maximum: 48,
      separation: 1,
      radial: false,
      diamonds: false,
    },
    validate: (q) => {
      if (Number(q.minimum) > Number(q.maximum))
        throw Error("Minimum radius cannot exceed maximum radius.");
    },
  },
  {
    id: "lattice-marks",
    title: "Lattice marks",
    description: "Ordered paths claiming cells across a square lattice.",
    parameters: [
      numeric("count", "Paths", "Number of ordered starting cells.", 1, 36),
      numeric(
        "steps",
        "Moves",
        "Maximum moves per route; blocked routes can stop early.",
        1,
        72,
      ),
      numeric("weight", "Stroke width", "Route width in pixels.", 1, 20, 0.1),
      numeric("dotSize", "Dot size", "Diameter of cell marks.", 2, 20, 0.5),
      toggle("dots", "Dots", "Draw dots instead of connected routes."),
      toggle("grid", "Grid", "Show the underlying lattice."),
    ],
    defaults: {
      count: 12,
      steps: 12,
      weight: 8.4,
      dotSize: 6,
      dots: false,
      grid: true,
    },
  },
];
export function drawBasic(p: any, layer: Layer): void {
  switch (layer.technique) {
    case "field-marks":
      return field(p, layer);
    case "path-marks":
      return paths(p, layer);
    case "placement-marks":
      return placements(p, layer);
    case "lattice-marks":
      return lattice(p, layer);
    default:
      throw Error("Unknown basic technique");
  }
}
/** Existing FieldMarks composition; palette is a layer-owned ordered set of RGB colors. */
function field(p: any, l: Layer) {
  const q = l.params;
  const model = createMarkField(
    l.seed,
    Number(q.columns),
    Number(q.rows),
    Number(q.pitch),
  );
  p.noFill();
  p.strokeWeight(1);
  p.strokeCap(p.ROUND);
  for (const c of markCommands(
    model,
    Number(q.maxLength),
    l.palette,
    Boolean(q.bars),
  )) {
    const color = channels(c.rgb);
    if (c.kind === "segment2" && c.from && c.to) {
      p.stroke(...color, c.opacity8);
      p.line(...c.from, ...c.to);
    } else if (c.vertices) {
      p.noStroke();
      p.fill(...color, c.opacity8);
      p.quad(...c.vertices.flat());
    }
  }
}
/** Marks follow the existing PathMarks geometry; every supplied palette entry participates. */
function paths(p: any, l: Layer) {
  const q = l.params,
    model = createPathMarks(l.seed, Number(q.steps), Number(q.distance));
  p.noFill();
  p.strokeWeight(1);
  p.strokeCap(p.ROUND);
  const from = [0, 0],
    to = [0, 0];
  for (let i = 0; i < model.paths.length; i++) {
    const path = model.paths[i];
    p.stroke(...channels(l.palette[i % l.palette.length]), 150);
    for (let step = 0; step < path.steps; step += q.trace ? 1 : 4) {
      path.pointInto(step + 1, to);
      if (q.trace) {
        path.pointInto(step, from);
      } else {
        const a = path.headingAt(step) + Math.PI / 2,
          dx = Math.cos(a) * Number(q.markLength) * 0.5,
          dy = Math.sin(a) * Number(q.markLength) * 0.5;
        from[0] = to[0] - dx;
        from[1] = to[1] - dy;
        to[0] += dx;
        to[1] += dy;
      }
      if (
        Math.max(from[0], to[0]) < -1 ||
        Math.min(from[0], to[0]) > 641 ||
        Math.max(from[1], to[1]) < -1 ||
        Math.min(from[1], to[1]) > 641
      )
        continue;
      p.line(...from, ...to);
    }
  }
}
function placements(p: any, l: Layer) {
  const q = l.params,
    model = q.radial
      ? createRadialPlacementMarks(Number(q.separation))
      : createSeededPlacementMarks(
          l.seed,
          Number(q.attempts),
          Number(q.minimum),
          Number(q.maximum),
          Number(q.separation),
        );
  const pt = new Float64Array(2),
    vertices = q.diamonds ? 4 : 64;
  p.noFill();
  p.strokeWeight(1);
  p.strokeCap(p.ROUND);
  p.strokeJoin(p.ROUND);
  for (let i = 0; i < model.placements.size; i++) {
    p.stroke(
      ...channels(
        l.palette[model.placements.sourceIndexAt(i) % l.palette.length],
      ),
    );
    p.beginShape();
    for (let v = 0; v < vertices; v++) {
      vertexInto(model.placements, i, v, Boolean(q.diamonds), pt);
      p.vertex(pt[0], pt[1]);
    }
    p.endShape(p.CLOSE);
  }
}
function lattice(p: any, l: Layer) {
  const q = l.params,
    count = Number(q.count),
    steps = Number(q.steps);
  const starts = Array.from({ length: count }, (_, i) => {
    const s = (13 * i) % 36;
    return [2 + 4 * (s % 6), 2 + 4 * Math.floor(s / 6)];
  });
  const paths = occupiedLatticePaths2D({
    dimensions: [24, 24],
    starts,
    maxSteps: steps,
    maxCells: count * (steps + 1),
    random: { seed: l.seed },
  });
  const palette = cyclicPalette({ colors: l.palette });
  const pixel = (x: number) => 44 + 24 * x;
  if (q.grid) {
    p.stroke(205, 200, 190);
    p.strokeWeight(1);
    for (let i = 0; i <= 24; i++) {
      p.line(32, 32 + 24 * i, 608, 32 + 24 * i);
      p.line(32 + 24 * i, 32, 32 + 24 * i, 608);
    }
  }
  p.strokeCap(p.ROUND);
  p.strokeJoin(p.ROUND);
  for (let i = 0; i < paths.pathCount; i++) {
    const n = paths.pathLengthAt(i);
    if (!n) continue;
    const col = palette.sample(i * 0.173);
    if (q.dots) {
      p.noStroke();
      p.fill(...channels(col));
      for (let j = 0; j < n; j++) {
        const [x, y] = paths.cellAt(i, j);
        p.circle(pixel(x), pixel(y), q.dotSize);
      }
      continue;
    }
    p.strokeWeight(q.weight);
    for (const offset of [3, 0]) {
      p.stroke(...(offset ? [30, 30, 30, 70] : channels(col)));
      for (let j = 1; j < n; j++) {
        const a = paths.cellAt(i, j - 1),
          b = paths.cellAt(i, j);
        p.line(
          pixel(a[0]) + offset,
          pixel(a[1]) + offset,
          pixel(b[0]) + offset,
          pixel(b[1]) + offset,
        );
      }
    }
    p.stroke(...channels(col));
    p.strokeWeight(2);
    p.fill(255, 250, 230);
    for (const j of n > 1 ? [0, n - 1] : [0]) {
      const a = paths.cellAt(i, j);
      p.circle(pixel(a[0]), pixel(a[1]), 8);
    }
  }
}
