import type { Layer } from "../studio-types";
import {
  numeric,
  choice,
  toggle,
  channels,
  type StudioDefinition,
} from "./types";
import { noiseBandPath2D } from "../../../../packages/javascript/src/noise-band-path.js";
import { gradientNoise2D01 } from "../../../../packages/javascript/src/gradient-noise-2d-01.js";
import { seededLinePool2D } from "../../../../packages/javascript/src/line-pool.js";
import { seededEndpointBranches2D } from "../../../../packages/javascript/src/branch-tree.js";
import { seededCirclePlacement2D } from "../../../../packages/javascript/src/circle-placements.js";
import { seededQuadrantPartition2D } from "../../../../packages/javascript/src/quadrant-partition.js";
import { binaryCellPartition2D } from "../../../../packages/javascript/src/binary-cell-partition.js";
import { retainedRectangleCuts2D } from "../../../../packages/javascript/src/retained-rectangle-cuts.js";
import { orderedConvexPolygonFilter2D } from "../../../../packages/javascript/src/convex-polygon-placements.js";
import { delaunay2D } from "../../../../packages/javascript/src/delaunay.js";
import { seededTrianglePoints2D } from "../../../../packages/javascript/src/triangle-points.js";
import {
  createLoopMarks,
  loopFanTriangles,
  loopTileCommands,
} from "../../../../packages/javascript/examples/loop-marks/loop-marks.js";
import { createGrainComposition } from "../../../../packages/javascript/examples/grain-marks/grain-marks.js";

type Q = Record<string, any>;
const colors = (layer: Layer): number[] => layer.palette;
const colour = (p: any, value: number, alpha = 255) =>
  p.stroke(...channels(value), alpha);
const fill = (p: any, value: number, alpha = 255) =>
  p.fill(...channels(value), alpha);
const pick = (palette: number[], index: number) =>
  palette[index % palette.length];

export const geometryDefinitions: StudioDefinition[] = [
  {
    id: "band-marks",
    title: "Band marks",
    description: "Seeded noise paths rendered as bands or perpendicular ticks.",
    parameters: [
      numeric("count", "Paths", "Number of noise paths.", 8, 120, 1),
      numeric(
        "tolerance",
        "Tolerance",
        "Noise-band acceptance tolerance.",
        0.001,
        0.02,
        0.001,
      ),
      numeric(
        "fieldScale",
        "Field scale",
        "Scale of the path direction field.",
        0.002,
        0.02,
        0.001,
      ),
      numeric("weight", "Stroke weight", "Width of path marks.", 0.25, 3, 0.05),
      toggle(
        "ticks",
        "Ticks",
        "Draw perpendicular ticks instead of connected paths.",
      ),
    ],
    defaults: {
      count: 24,
      tolerance: 0.005,
      fieldScale: 0.006,
      weight: 0.8,
      ticks: false,
    },
  },
  {
    id: "branch-marks",
    title: "Branch marks",
    description: "Retained endpoint branch trees.",
    parameters: [
      numeric(
        "generations",
        "Generations",
        "Branch rule generations.",
        3,
        7,
        1,
      ),
      numeric("weight", "Base weight", "Root stroke weight.", 0.3, 5, 0.1),
      numeric("tipSize", "Tip size", "Terminal-dot diameter.", 0, 10, 0.5),
      toggle("forest", "Forest", "Place several roots."),
      toggle("binary", "Binary", "Use two child slots."),
    ],
    defaults: {
      generations: 5,
      weight: 2,
      tipSize: 4,
      forest: false,
      binary: false,
    },
  },
  {
    id: "cut-branch-marks",
    title: "Cut branch marks",
    description: "A line pool repeatedly cut into retained segments.",
    parameters: [
      numeric("attempts", "Cuts", "Line-pool cut attempts.", 500, 24000, 100),
      numeric("angle", "Cut angle", "First-cut angle scale.", 0.2, 1.8, 0.05),
      numeric(
        "weight",
        "Stroke weight",
        "Retained segment stroke width.",
        0.15,
        2,
        0.05,
      ),
      numeric("opacity", "Opacity", "Segment opacity.", 20, 220, 1),
    ],
    defaults: { attempts: 6000, angle: 1.1, weight: 0.6, opacity: 105 },
  },
  {
    id: "loop-marks",
    title: "Loop marks",
    description: "Closed spline loops with tiles or translucent triangle fans.",
    parameters: [
      numeric(
        "tileScale",
        "Tile scale",
        "Scale of each oriented tile.",
        0.3,
        2.5,
        0.05,
      ),
      numeric(
        "outlineWeight",
        "Outline weight",
        "Spline outline stroke width.",
        0.2,
        3,
        0.05,
      ),
      numeric("opacity", "Fan opacity", "Triangle-fan opacity.", 20, 220, 1),
      toggle("fans", "Fans", "Fill loops with triangle fans."),
      toggle(
        "moved",
        "Moved control",
        "Offset one control point in each loop.",
      ),
    ],
    defaults: {
      tileScale: 1,
      outlineWeight: 0.8,
      opacity: 120,
      fans: false,
      moved: false,
    },
  },
  {
    id: "region-marks",
    title: "Region marks",
    description: "Seeded quadrant cells with circle marks.",
    parameters: [
      numeric(
        "replacements",
        "Replacements",
        "Quadrant partition replacements.",
        8,
        220,
        1,
      ),
      numeric(
        "fraction",
        "Selection fraction",
        "Fraction of cells eligible for replacement.",
        0.1,
        1,
        0.05,
      ),
      numeric("inset", "Inset", "Cell inset in pixels.", 0, 16, 0.5),
      numeric(
        "markScale",
        "Mark scale",
        "Circle diameter relative to its cell.",
        0.05,
        0.8,
        0.01,
      ),
      toggle("grid", "Nine marks", "Draw a 3 by 3 mark grid."),
    ],
    defaults: {
      replacements: 80,
      fraction: 0.5,
      inset: 1,
      markScale: 0.28,
      grid: false,
    },
  },
  {
    id: "panel-marks",
    title: "Panel marks",
    description: "Integer-grid binary partitions drawn as panels.",
    parameters: [
      numeric("attempts", "Attempts", "Binary partition attempts.", 5, 300, 1),
      numeric(
        "columns",
        "Grid columns",
        "Integer partition grid width.",
        20,
        90,
        1,
      ),
      numeric("inset", "Inset", "Panel inset in pixels.", 0, 10, 0.5),
      numeric("weight", "Outline weight", "Panel outline width.", 0.2, 3, 0.1),
      choice("axis", "Axis policy", "Cut-axis selection.", [
        "LONGEST",
        "RANDOM",
      ]),
      toggle("solid", "Solid", "Fill panels instead of nested outlines."),
    ],
    defaults: {
      attempts: 80,
      columns: 60,
      inset: 2,
      weight: 1,
      axis: "LONGEST",
      solid: false,
    },
  },
  {
    id: "cut-marks",
    title: "Cut marks",
    description: "Seeded retained unequal rectangles.",
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
    defaults: {
      cuts: 10,
      spread: 0.25,
      inset: 1,
      opacity: 190,
      staggered: false,
    },
  },
  {
    id: "polygon-marks",
    title: "Polygon marks",
    description: "Greedy non-overlapping convex polygon placements.",
    parameters: [
      numeric(
        "proposals",
        "Proposals",
        "Convex polygon proposals to filter.",
        40,
        700,
        1,
      ),
      numeric(
        "ratio",
        "Aspect ratio",
        "Minor-to-major polygon ratio.",
        0.15,
        1,
        0.01,
      ),
      numeric("size", "Size", "Maximum polygon half-length.", 8, 100, 1),
      numeric("weight", "Outline weight", "Polygon stroke width.", 0.2, 4, 0.1),
      choice("shape", "Shape", "Proposal outline.", ["capsule", "diamond"]),
    ],
    defaults: {
      proposals: 300,
      ratio: 0.65,
      size: 70,
      weight: 1,
      shape: "capsule",
    },
  },
  {
    id: "facet-marks",
    title: "Facet marks",
    description: "Delaunay facets with fill, wire, or grain rendering.",
    parameters: [
      numeric("sites", "Sites", "Number of seeded facet sites.", 12, 180, 1),
      numeric(
        "grain",
        "Grain density",
        "Points sampled per facet area.",
        0,
        0.16,
        0.005,
      ),
      numeric("weight", "Wire weight", "Facet edge stroke width.", 0.2, 3, 0.1),
      numeric("opacity", "Fill opacity", "Facet fill opacity.", 20, 240, 1),
      choice("mode", "Mode", "Facet drawing mode.", ["fill", "wire", "grain"]),
    ],
    defaults: {
      sites: 72,
      grain: 0.025,
      weight: 1,
      opacity: 150,
      mode: "fill",
    },
  },
  {
    id: "grain-marks",
    title: "Grain marks",
    description: "Triangle samples with selectable distributions.",
    parameters: [
      numeric(
        "density",
        "Density",
        "Samples per triangle pixel.",
        0.002,
        0.15,
        0.002,
      ),
      numeric("size", "Mark size", "Dot or line size.", 0.5, 8, 0.25),
      numeric(
        "weight",
        "Stroke weight",
        "Line mark stroke width.",
        0.2,
        3,
        0.1,
      ),
      choice(
        "distribution",
        "Distribution",
        "Triangle coordinate distribution.",
        ["uniform", "vertex", "edge"],
      ),
      toggle(
        "cells",
        "Cell triangles",
        "Sample triangles from seeded quadrant cells.",
      ),
      toggle("strokes", "Strokes", "Draw short strokes instead of dots."),
    ],
    defaults: {
      density: 0.018,
      size: 2,
      weight: 1,
      distribution: "uniform",
      cells: false,
      strokes: false,
    },
  },
];

export function drawGeometry(p: any, layer: Layer): void {
  p.push();
  try {
    switch (layer.technique) {
      case "band-marks":
        return band(p, layer);
      case "branch-marks":
        return branch(p, layer);
      case "cut-branch-marks":
        return cutBranch(p, layer);
      case "loop-marks":
        return loops(p, layer);
      case "region-marks":
        return regions(p, layer);
      case "panel-marks":
        return panels(p, layer);
      case "cut-marks":
        return cuts(p, layer);
      case "polygon-marks":
        return polygons(p, layer);
      case "facet-marks":
        return facets(p, layer);
      case "grain-marks":
        return grain(p, layer);
      default:
        throw new Error(
          `Unknown geometry technique: ${String(layer.technique)}`,
        );
    }
  } finally {
    p.pop();
  }
}

function band(p: any, l: Layer) {
  const q = l.params as Q,
    palette = colors(l);
  p.noFill();
  p.strokeWeight(q.weight);
  for (let i = 0; i < q.count; i++) {
    const path = noiseBandPath2D({
      field: { seed: (l.seed + 17) >>> 0 },
      start: [40 + 80 * (i % 8), 40 + 80 * Math.floor(i / 8)],
      heading: 0,
      seed: (l.seed + i) >>> 0,
      attempts: 700,
      stepDistance: 1,
      fieldScale: q.fieldScale,
      fieldOffset: [7.3, 11.7],
      tolerance: q.tolerance,
      maxVertices: 701,
    });
    const a = [0, 0],
      b = [0, 0];
    colour(p, pick(palette, i), 150);
    for (let j = 1; j < path.size; j += q.ticks ? 8 : 1) {
      path.pointInto(j, a);
      if (q.ticks) {
        const h = path.headingAt(j - 1),
          dx = -Math.sin(h) * 3,
          dy = Math.cos(h) * 3;
        p.line(a[0] - dx, a[1] - dy, a[0] + dx, a[1] + dy);
      } else {
        path.pointInto(j - 1, b);
        p.line(b[0], b[1], a[0], a[1]);
      }
    }
  }
}
function branch(p: any, l: Layer) {
  const q = l.params as Q,
    rules: any[] = [];
  for (let g = 0; g < q.generations; g++) {
    const spread = q.binary ? 0.12 : 0.5;
    const probability = q.binary ? 0.8 : 0.7;
    const row: any[] = [
      { probability, turn: [-spread, -spread * 0.5] },
      { probability, turn: [spread * 0.5, spread] },
    ];
    if (!q.binary)
      row.push({ probability: 0.4, turn: [-spread * 0.2, spread * 0.2] });
    rules.push({ lengthScale: [0.65, 0.85], slots: row });
  }
  const roots = q.forest
      ? seededCirclePlacement2D({
          seed: l.seed,
          attempts: 6,
          origin: [90, 260],
          extent: [460, 280],
          radiusRange: [28, 42],
          separationScale: 1,
        })
      : null,
    trees: any[] = [];
  if (roots) {
    const pt = new Float64Array(2);
    for (let i = 0; i < roots.size; i++) {
      roots.pointInto(i, pt);
      trees.push(
        seededEndpointBranches2D({
          seed: (l.seed + i) >>> 0,
          root: {
            origin: [pt[0], pt[1]],
            heading: -Math.PI / 2,
            length: roots.radiusAt(i),
          },
          rules,
          maxSegments: 10000,
        }),
      );
    }
  } else
    trees.push(
      seededEndpointBranches2D({
        seed: l.seed,
        root: { origin: [320, 590], heading: -Math.PI / 2, length: 105 },
        rules,
        maxSegments: 10000,
      }),
    );
  const palette = colors(l),
    s = new Float64Array(4);
  p.noFill();
  p.strokeCap(p.ROUND);
  for (const tree of trees)
    for (let i = 0; i < tree.size; i++) {
      tree.segmentInto(i, s);
      colour(p, pick(palette, Math.floor(tree.generationAt(i) / 2)));
      p.strokeWeight(Math.max(0.2, (q.weight * tree.lengthAt(i)) / 100));
      p.line(s[0], s[1], s[2], s[3]);
      if (q.tipSize && tree.childCountAt(i) === 0) {
        p.noStroke();
        fill(p, pick(palette, palette.length - 1));
        p.circle(s[2], s[3], q.tipSize);
      }
    }
}
function cutBranch(p: any, l: Layer) {
  const q = l.params as Q,
    pool = seededLinePool2D({
      seed: l.seed,
      segment: [120, 620, 520, 120],
      attempts: q.attempts,
      firstCutAngleScale: q.angle,
      minCutLength: 4,
      maxSegments: q.attempts * 2 + 1,
    }),
    s = [0, 0, 0, 0];
  p.noFill();
  p.strokeWeight(q.weight);
  colour(p, pick(colors(l), 0), q.opacity);
  for (let i = 0; i < pool.size; i++) {
    pool.segmentInto(i, s);
    p.line(s[0], s[1], s[2], s[3]);
  }
}
function loops(p: any, l: Layer) {
  const q = l.params as Q,
    model = createLoopMarks(!!q.moved),
    palette = colors(l);
  if (q.fans) {
    p.noStroke();
    for (const t of loopFanTriangles(model, false)) {
      fill(p, pick(palette, Math.floor(t.cx / 100)), q.opacity);
      p.triangle(t.cx, t.cy, t.x1, t.y1, t.x2, t.y2);
    }
    return;
  }
  for (const raw of loopTileCommands(model, false)) {
    const c: any = raw;
    if (c.kind === "segment2") {
      colour(p, pick(palette, Math.floor(c.from[0] / 100)), 100);
      p.strokeWeight(q.outlineWeight);
      p.line(...c.from, ...c.to);
    } else {
      const vs: any[] = c.vertices,
        cx = (vs[0][0] + vs[2][0]) * 0.5,
        cy = (vs[0][1] + vs[2][1]) * 0.5;
      p.noStroke();
      fill(p, pick(palette, Math.floor(cx / 100)));
      p.beginShape();
      for (const v of vs)
        p.vertex(
          cx + (v[0] - cx) * q.tileScale,
          cy + (v[1] - cy) * q.tileScale,
        );
      p.endShape(p.CLOSE);
    }
  }
}
function regions(p: any, l: Layer) {
  const q = l.params as Q,
    model = seededQuadrantPartition2D({
      seed: l.seed,
      replacements: q.replacements,
      origin: [0, 0],
      extent: [640, 640],
      selectionFraction: q.fraction,
    }),
    b = new Float64Array(4),
    pt = new Float64Array(2),
    palette = colors(l);
  p.noStroke();
  for (let i = 0; i < model.size; i++) {
    model.boundsInto(i, b);
    const w = b[2] - b[0],
      h = b[3] - b[1];
    fill(p, pick(palette, model.idAt(i)), 180);
    p.rect(b[0] + q.inset, b[1] + q.inset, w - q.inset * 2, h - q.inset * 2);
    fill(p, pick(palette, i + 1), 230);
    if (q.grid) {
      for (let n = 0; n < 9; n++) {
        const x = b[0] + w * (((n % 3) + 0.5) / 3),
          y = b[1] + h * ((Math.floor(n / 3) + 0.5) / 3);
        p.circle(x, y, (Math.min(w, h) * q.markScale) / 3);
      }
    } else p.circle(b[0] + w / 2, b[1] + h / 2, Math.min(w, h) * q.markScale);
  }
}
function panels(p: any, l: Layer) {
  const q = l.params as Q,
    layout = binaryCellPartition2D({
      seed: l.seed,
      columns: q.columns,
      rows: q.columns,
      attempts: q.attempts,
      axisPolicy: q.axis,
    }),
    b = [0, 0, 0, 0],
    palette = colors(l),
    scale = 600 / q.columns;
  p.rectMode(p.CORNER);
  for (let i = 0; i < layout.size; i++) {
    layout.boundsInto(i, b);
    const x = 20 + b[0] * scale,
      y = 20 + b[1] * scale,
      w = (b[2] - b[0]) * scale,
      h = (b[3] - b[1]) * scale;
    if (q.solid) {
      colour(p, pick(palette, i));
      fill(p, pick(palette, i), 100);
      p.strokeWeight(q.weight);
      p.rect(x + q.inset, y + q.inset, w - 2 * q.inset, h - 2 * q.inset);
    } else {
      p.noFill();
      colour(p, pick(palette, i), 210);
      p.strokeWeight(q.weight);
      for (
        let z = q.inset;
        w - 2 * z > 0 && h - 2 * z > 0;
        z += Math.max(3, q.inset + 2)
      )
        p.rect(x + z, y + z, w - 2 * z, h - 2 * z);
    }
  }
}
function cuts(p: any, l: Layer) {
  const q = l.params as Q,
    model = retainedRectangleCuts2D({ bounds: [24, 24, 616, 616] }),
    field = gradientNoise2D01({ seed: l.seed }),
    palette = colors(l);
  for (let i = 0; i < q.cuts; i++) {
    const leaf = model.leaves()[i % model.size],
      b = leaf.bounds,
      axis = i % 2 ? "Y" : "X",
      ratio = 0.5 + (field.sample(i, 0) - 0.5) * 2 * q.spread,
      coord =
        axis === "X"
          ? b[0] + (b[2] - b[0]) * ratio
          : b[1] + (b[3] - b[1]) * ratio;
    model.cut(leaf.id, axis, coord);
    if (q.staggered && i % 3 === 0) {
      const child = model.leaves()[model.size - 1],
        d = child.bounds;
      model.cut(
        child.id,
        axis === "X" ? "Y" : "X",
        axis === "X"
          ? d[1] + (d[3] - d[1]) * (0.3 + 0.4 * field.sample(i, 1))
          : d[0] + (d[2] - d[0]) * (0.3 + 0.4 * field.sample(i, 1)),
      );
    }
  }
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
function polygons(p: any, l: Layer) {
  const q = l.params as Q,
    samples = seededTrianglePoints2D({
      seed: l.seed,
      count: q.proposals,
      triangle: [
        [24, 616],
        [616, 616],
        [320, 24],
      ],
    }),
    proposals: any[] = [];
  for (let i = 0; i < q.proposals; i++) {
    const [x, y] = samples.pointAt(i),
      a = (x + y) * 0.01,
      len = 8 + q.size * (y / 640),
      n = q.shape === "diamond" ? 4 : 12,
      poly = [];
    for (let j = 0; j < n; j++) {
      const t = (j * Math.PI * 2) / n;
      const u = Math.cos(t) * len,
        v = Math.sin(t) * len * q.ratio;
      poly.push([
        x + u * Math.cos(a) - v * Math.sin(a),
        y + u * Math.sin(a) + v * Math.cos(a),
      ]);
    }
    proposals.push(poly);
  }
  const kept = orderedConvexPolygonFilter2D({ polygons: proposals });
  p.noFill();
  p.strokeWeight(q.weight);
  for (let i = 0; i < kept.size; i++) {
    colour(p, pick(colors(l), i), 210);
    p.beginShape();
    for (let j = 0; j < kept.vertexCountAt(i); j++)
      p.vertex(kept.xAt(i, j), kept.yAt(i, j));
    p.endShape(p.CLOSE);
  }
}
function facets(p: any, l: Layer) {
  const q = l.params as Q,
    samples = seededTrianglePoints2D({
      seed: l.seed,
      count: q.sites,
      triangle: [
        [36, 596],
        [604, 596],
        [320, 44],
      ],
    }),
    sites = Array.from({ length: samples.size }, (_, index) =>
      samples.pointAt(index),
    );
  const mesh = delaunay2D({ points: sites, maxWork: 50000000 }),
    a = [0, 0],
    b = [0, 0],
    c = [0, 0],
    palette = colors(l);
  for (let i = 0; i < mesh.faceCount; i++) {
    const ix = mesh.triangleAt(i);
    mesh.pointInto(ix[0], a);
    mesh.pointInto(ix[1], b);
    mesh.pointInto(ix[2], c);
    const col = pick(palette, i);
    if (q.mode === "wire") {
      p.noFill();
      colour(p, col);
      p.strokeWeight(q.weight);
      p.triangle(...a, ...b, ...c);
    } else if (q.mode === "fill") {
      p.noStroke();
      fill(p, col, q.opacity);
      p.triangle(...a, ...b, ...c);
    } else {
      p.noStroke();
      fill(p, col, 210);
      const area =
          Math.abs(
            (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
          ) * 0.5,
        count = Math.min(800, Math.floor(area * q.grain)),
        points = seededTrianglePoints2D({
          seed: (l.seed + i) >>> 0,
          count,
          triangle: [a, b, c],
        });
      for (let j = 0; j < points.size; j++) {
        const pt = points.pointAt(j);
        p.circle(pt[0], pt[1], 1.5);
      }
    }
  }
}
function grain(p: any, l: Layer) {
  const q = l.params as Q,
    dist =
      q.distribution === "uniform" ? 0 : q.distribution === "vertex" ? 1 : 2,
    model = createGrainComposition(l.seed, q.density, dist, !!q.cells),
    palette = colors(l);
  p.strokeWeight(q.weight);
  for (let i = 0; i < model.size; i++) {
    const points = model.regionAt(i);
    for (let j = 0; j < points.size; j++) {
      const pt = points.pointAt(j),
        col = pick(palette, i + j);
      if (q.strokes) {
        colour(p, col, 190);
        p.line(pt[0] - q.size, pt[1], pt[0] + q.size, pt[1]);
      } else {
        p.noStroke();
        fill(p, col, 200);
        p.circle(pt[0], pt[1], q.size);
      }
    }
  }
}
