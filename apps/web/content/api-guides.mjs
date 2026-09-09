import { apiInputs } from "./api-inputs.mjs";

const guide = (
  title,
  summary,
  useWhen,
  inputNames,
  output,
  code,
  tryThis,
  pitfalls = [],
) => ({
  title,
  summary,
  useWhen,
  inputNames,
  inputs: {},
  output,
  code,
  tryThis,
  pitfalls,
});

const apiGuides = {
  "mesh.annular-solid-3d": guide(
    "Build an annular mesh",
    "Make indexed ring geometry you can light or export.",
    "Use it when your sketch needs a hollow solid, not a ready-made p5 shape.",
    ["outerRadius", "innerRadius", "bottomZ", "topZ", "slices", "maxFaces"],
    "vertexAt(index) reads local [x,y,z] positions, triangleAt(face) reads three indices, and normalAt(face) supplies its lighting normal. Loop the getter faceCount, call p.beginShape(p.TRIANGLES), emit its indexed vertices, then p.endShape(); toValues() is an export copy, not an image.",
    `const mesh = annularSolid3D({
  outerRadius: 20,
  innerRadius: 8,
  bottomZ: -4,
  topZ: 4,
  slices: 12,
  maxFaces: 96,
});
console.log({
  vertices: mesh.vertexCount,
  faces: mesh.faceCount,
  first: mesh.vertexAt(0),
  normal: mesh.normalAt(0),
});`,
    "In a p5 WEBGL sketch, use TRIANGLES and call `p.normal(...mesh.normalAt(face))` before emitting the three indexed vertices for each face. Add your own lights, camera and material.",
  ),
  "raster.bilinear-remap-2d": guide(
    "Remap a small raster",
    "Sample a source raster at explicit source coordinates.",
    "Use it for a controlled warp whose coordinate map you already know.",
    ["source", "outputWidth", "outputHeight", "sourceCoordinates"],
    "pixelAt(index) and pixels() return packed unsigned ARGB8/AARRGGBB values; toValues().pixels is detached data, not p5's RGBA buffer.",
    `const raster = bilinearRasterRemap2D({
  source: {
    width: 2,
    height: 2,
    pixels: [0xff000000, 0xffffffff, 0xffff0000, 0xff00ff00],
  },
  outputWidth: 2,
  outputHeight: 2,
  sourceCoordinates: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
});
console.log(raster.toValues());`,
    "Create `const image = p.createImage(raster.width, raster.height)` and call `image.loadPixels()`. Convert each packed ARGB32 pixel to RGBA slots: for pixel i, write red `(pixel >>> 16) & 255`, green `(pixel >>> 8) & 255`, blue `pixel & 255`, alpha `pixel >>> 24` at `image.pixels[4*i…4*i+3]`, then call `image.updatePixels()` and draw it with `p.image(image, 0, 0)`. Change sourceCoordinates to move sampling positions; outputWidth and outputHeight set the output grid.",
  ),
  "layout.binary-cell-partition-2d": guide(
    "Split an integer grid into panels",
    "Retain ordered rectangles made by bounded binary cuts.",
    "Use it when a panel layout should be reproducible from a seed.",
    ["seed", "columns", "rows", "attempts", "axisPolicy"],
    "size is the panel count and boundsAt(index) returns [left,top,right,bottom], so loop size and draw each rectangle with width right-left and height bottom-top. toValues() is a detached layout snapshot.",
    `const layout = binaryCellPartition2D({
  seed: 42,
  columns: 8,
  rows: 8,
  attempts: 6,
  axisPolicy: "RANDOM",
});
console.log({ cells: layout.size, first: layout.boundsAt(0) });`,
    "Draw each boundsAt() rectangle with your own fill and inset.",
  ),
  "geometry.clip-segments-simple-polygon-2d": guide(
    "Clip marks to a polygon",
    "Keep the pieces of line segments that lie inside a simple polygon.",
    "Use it to crop a mark system without changing its generator.",
    ["polygon", "segments", "maxWork", "maxOutputSegments"],
    "segmentAt(index) returns each retained [x1,y1,x2,y2] piece in input order; use size as the p.line() loop bound. toValues() is an export copy.",
    `const clipped = clipSegmentsSimplePolygon2D({
  polygon: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
  segments: [[-1, 2, 5, 2]],
  maxWork: 216,
  maxOutputSegments: 16,
});
console.log(clipped.toValues());`,
    "Pass the retained segments to p.line() in their returned order.",
  ),
  "geometry.closed-spline-2d": guide(
    "Trace a closed spline",
    "Create a smooth looping path from control points.",
    "Use it when marks should follow a reusable curved perimeter.",
    ["controls", "subdivisions"],
    "`sampleParameter(t)` and `sampleDistance(distance)` return `{x, y, tangentX, tangentY}`. Draw with `p.vertex(sample.x, sample.y)`; use `Math.atan2(sample.tangentY, sample.tangentX)` to orient a mark. `length` is an approximate perimeter from the subdivision table; `serialize()` returns the original configuration.",
    `const loop = closedSpline2D({
  controls: [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ],
  subdivisions: 2,
});
console.log({ length: loop.length, point: loop.sampleDistance(1) });`,
    "Parameter t advances one control-point span per unit and wraps at the control count. Distance is in drawing units and wraps at length. Sample at equal distance intervals to distribute marks around the loop.",
  ),
  "color.cyclic-palette": guide(
    "Cycle through RGB colors",
    "Make an immutable palette sampler that wraps a phase.",
    "Use it when multiple marks need a repeatable color sequence.",
    ["colors"],
    "`sample(phase)` returns one `0xRRGGBB` integer. A phase from 0 to 1 travels through the entire palette; values wrap, so 0 and 1 select the same color. `serialize()` returns a copy of the palette configuration.",
    `const palette = cyclicPalette({ colors: [0x224466, 0xdd8844, 0x66aa88] });
console.log(palette.sample(0.5).toString(16));`,
    "For p5 in RGB mode, convert the result c with `p.fill((c >>> 16) & 255, (c >>> 8) & 255, c & 255)`. Sampling at index / markCount distributes a color cycle across your marks.",
  ),
  "topology.delaunay-2d": guide(
    "Triangulate points",
    "Build a retained Delaunay mesh from planar sites.",
    "Use it when you want facets or adjacency from your own point set.",
    ["points", "maxWork"],
    "pointAt(index) returns each local [x,y] site and triangleAt(index) returns three site indices; loop faceCount and use those indices to fill p5 facets. toValues() is a detached mesh description.",
    `const mesh = delaunay2D({
  points: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0.25, 0.25],
  ],
  maxWork: 100,
});
console.log({ faces: mesh.faceCount, triangle: mesh.triangleAt(0) });`,
    "Fill each triangle with a palette color in p5.",
  ),
  "field.gradient-noise-2d-01": guide(
    "Sample a seeded 2D field",
    "Create a pure gradient-noise sampler with values from zero to one.",
    "Use it to steer angles, lengths, or color phases.",
    ["seed"],
    "`sample(x, y)` returns a number from 0 to 1 at your field coordinates. It does not create points or draw marks. `serialize()` returns `{seed}` so you can recreate the same field.",
    `const field = gradientNoise2D01({ seed: 42 });
console.log(field.sample(1.25, 3.5));`,
    "For a full-turn heading, use `field.sample(x * 0.01, y * 0.01) * Math.PI * 2`. The 0.01 is your chosen drawing-to-field scale, not a required default.",
  ),
  "field.gradient-noise-3d-01": guide(
    "Sample a seeded 3D field",
    "Create a pure three-dimensional gradient-noise sampler.",
    "Use it when a third coordinate represents depth, frame, or another explicit axis.",
    ["seed"],
    "`sample(x, y, z)` returns a number from 0 to 1. Use it as a color phase, displacement or heading input. Repeated sampling at the same coordinates gives the same value; `serialize()` returns `{seed}`.",
    `const field = gradientNoise3D01({ seed: 42 });
console.log(field.sample(1.25, 3.5, 0.5));`,
    "Advance z by an explicit amount per frame for an evolving field. Keep the seed and frame-to-z mapping to reproduce the animation later.",
  ),
  "path.gradient-trace-2d": guide(
    "Follow a field",
    "Retain a path by sampling a seeded direction field at each step.",
    "Use it when marks should inherit motion from a field.",
    [
      "field",
      "start",
      "steps",
      "stepDistance",
      "fieldScale",
      "fieldOffset",
      "angleBase",
      "angleScale",
    ],
    "pointAt(index) reads positions 0 through steps, while headingAt(index) reads headings 0 through steps-1; toValues() returns ordered positions and headings arrays.",
    `const path = gradientPath2D({
  field: { seed: 42 },
  start: [-0.25, 0.5],
  steps: 3,
  stepDistance: 0.4,
  fieldScale: 0.01,
  fieldOffset: [0, 0],
  angleBase: 0,
  angleScale: 6.283185307179586,
});
const values = path.toValues();
console.log({
  points: values.positions.length,
  end: values.positions.at(-1),
  heading: path.headingAt(2),
});`,
    "Use pointAt(index) and headingAt(index) to draw a short perpendicular mark at every retained step.",
  ),
  "raster.masked-source-over-2d": guide(
    "Composite through a mask",
    "Blend a source raster over a destination with per-pixel mask weights.",
    "Use it when your mask is already computed and needs exact composition.",
    ["source", "destination", "mask"],
    "pixelAt(index) and pixels() return packed unsigned ARGB8/AARRGGBB values; toValues().pixels provides detached data.",
    `const raster = maskedSourceOver2D({
  source: { width: 1, height: 1, pixels: [0xff112233] },
  destination: { width: 1, height: 1, pixels: [0xffaabbcc] },
  mask: [0.5],
});
console.log(raster.toValues());`,
    "Create `const image = p.createImage(raster.width, raster.height)` and call `image.loadPixels()`. Convert each packed ARGB32 pixel to RGBA slots: for pixel i, write red `(pixel >>> 16) & 255`, green `(pixel >>> 8) & 255`, blue `pixel & 255`, alpha `pixel >>> 24` at `image.pixels[4*i…4*i+3]`, then call `image.updatePixels()` and draw it with `p.image(image, 0, 0)`.",
  ),
  "geometry.nearest-segment-contact-2d": guide(
    "Find first segment contact",
    "Query nearest contacts between ordered segment sets.",
    "Use it when a drawing needs a deterministic closest obstacle relationship.",
    ["queries", "obstacles", "maxWork"],
    "hitAt(queryIndex) returns null or {obstacleIndex,t,x,y}; the index matches queries, so use x and y to end or highlight that query stroke. toValues().hits instead exports each point as [x,y].",
    `const contacts = nearestSegmentContact2D({
  queries: [[0, 0, 10, 0]],
  obstacles: [[3, -2, 3, 2]],
  maxWork: 1,
});
console.log({ hit: contacts.hitAt(0), exported: contacts.toValues() });`,
    "Use returned contact coordinates to place a highlight or stop a stroke.",
  ),
  "path.noise-band-trace-2d": guide(
    "Trace within a noise band",
    "Grow a bounded path while a noise condition accepts steps.",
    "Use it for organic strands with an explicit work limit.",
    [
      "field",
      "start",
      "heading",
      "seed",
      "attempts",
      "stepDistance",
      "fieldScale",
      "fieldOffset",
      "tolerance",
      "maxVertices",
    ],
    "pointAt(index) reads the start plus each accepted [x,y] step and headingAt(index) reads accepted headings; size, accepted, and rejected show what the fixed attempt budget produced. toValues() is copied geometry.",
    `const path = noiseBandPath2D({
  field: { seed: 1 },
  start: [0, 0],
  heading: 0,
  seed: 1,
  attempts: 3,
  stepDistance: 1,
  fieldScale: 0.01,
  fieldOffset: [0, 0],
  tolerance: 1,
  maxVertices: 4,
});
console.log({ points: path.size, end: path.pointAt(path.size - 1) });`,
    "Turn headings into cross marks or connected strokes.",
  ),
  "path.occupied-lattice-paths-2d": guide(
    "Grow occupied grid paths",
    "Retain non-overwriting paths through a rectangular lattice.",
    "Use it for tile routes and constrained line work.",
    ["dimensions", "starts", "maxSteps", "maxCells", "random"],
    "pathCount is the number of paths; pathLengthAt(path) and cellAt(path,cell) let you draw every retained integer [x,y] cell. completionReasonAt(path) explains where a route stopped; toValues() copies that collection.",
    `const paths = occupiedLatticePaths2D({
  dimensions: [3, 3],
  starts: [[1, 1]],
  maxSteps: 2,
  maxCells: 6,
  random: { seed: 42 },
});
console.log({
  pathCount: paths.pathCount,
  firstLength: paths.pathLengthAt(0),
  firstCell: paths.cellAt(0, 0),
  reason: paths.completionReasonAt(0),
});`,
    "Map each returned cell to your canvas grid.",
  ),
  "sampling.ordered-circle-filter-2d": guide(
    "Keep separated circles",
    "Filter caller-provided circles in proposal order.",
    "Use it after making your own circle candidates.",
    ["centres", "radii", "separationScale"],
    "`size` is the accepted circle count. `pointAt(index)` and `radiusAt(index)` supply its center and radius; `sourceIndexAt(index)` identifies the original proposal. `toValues()` copies accepted centers, radii, source indices and the attempt count.",
    `const kept = orderedCircleFilter2D({
  centres: [
    [0, 0],
    [2, 0],
  ],
  radii: [1, 1],
  separationScale: 1,
});
console.log({
  count: kept.size,
  source: kept.sourceIndexAt(0),
  exported: kept.toValues(),
});`,
    "Draw only the accepted centres and radii.",
  ),
  "sampling.ordered-convex-polygon-filter-2d": guide(
    "Keep non-overlapping polygons",
    "Filter convex polygon proposals in their supplied order.",
    "Use it to preserve a deliberate proposal sequence while avoiding collisions.",
    ["polygons"],
    "size is the retained count; vertexCountAt(polygon), xAt(polygon,vertex), and yAt(polygon,vertex) provide each accepted loop for p.beginShape()/vertex(). toValues().polygons copies those loops.",
    `const kept = orderedConvexPolygonFilter2D({
  polygons: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    [
      [10, 10],
      [14, 10],
      [14, 14],
    ],
  ],
});
console.log({
  vertices: kept.vertexCountAt(0),
  first: [kept.xAt(0, 0), kept.yAt(0, 0)],
  exported: kept.toValues().polygons,
});`,
    "Stroke the accepted polygon vertices in p5.",
  ),
  "mesh.radial-profile-surface-3d": guide(
    "Revolve a profile into a surface",
    "Create a retained mesh from a radial profile and angular slices.",
    "Use it when a silhouette should become editable 3D geometry.",
    ["profile", "slices", "capStart", "capEnd", "maxFaces"],
    "vertexAt(index) returns local [x,y,z], triangleAt(face) returns vertex indices, and normalAt(face) returns a face normal. Loop faceCount(), call p.beginShape(p.TRIANGLES), emit its indexed vertices, then p.endShape(); toValues() is detached geometry, not a rendered view.",
    `const mesh = RadialProfile3D.generate({
  profile: [
    [0, 2],
    [1, 0.75],
    [3, 2],
  ],
  slices: 4,
  capStart: true,
  capEnd: true,
  maxFaces: 1000,
});
console.log({ faces: mesh.faceCount(), vertex: mesh.vertexAt(0) });`,
    "In p5 WEBGL, call `p.normal(...mesh.normalAt(face))` before emitting the indexed vertices of each triangle. Add your own camera, lights and material; this operation only supplies geometry.",
  ),
  "geometry.radial-pull-2d": guide(
    "Pull points radially",
    "Build an influence model that displaces points around radial controls.",
    "Use it to warp your own geometry without touching its topology.",
    ["influences"],
    "transform([x,y]) returns a local [x,y] pair; transform(x,y) returns {x,y}. Apply it once per vertex before your drawing call; serialize() copies influence data.",
    `const pull = radialPull2D({ influences: [[0, 0, 10, 2]] });
console.log(pull.transform(5, 0));`,
    "Apply the model to each point before drawing a shape.",
  ),
  "raster.crossfade-2d": guide(
    "Crossfade two rasters",
    "Blend matching rasters with explicit per-pixel weights.",
    "Use it for a calculated transition rather than a renderer blend mode.",
    ["first", "second", "weights"],
    "pixelAt(index) and pixels() return packed unsigned ARGB8/AARRGGBB values; toValues().pixels is detached data rather than p5 RGBA channels.",
    `const raster = rasterCrossfade2D({
  first: { width: 1, height: 1, pixels: [0xff112233] },
  second: { width: 1, height: 1, pixels: [0xffaabbcc] },
  weights: [0.5],
});
console.log(raster.toValues());`,
    "Create `const image = p.createImage(raster.width, raster.height)` and call `image.loadPixels()`. Convert each packed ARGB32 pixel to RGBA slots: for pixel i, write red `(pixel >>> 16) & 255`, green `(pixel >>> 8) & 255`, blue `pixel & 255`, alpha `pixel >>> 24` at `image.pixels[4*i…4*i+3]`, then call `image.updatePixels()` and draw it with `p.image(image, 0, 0)`.",
  ),
  "layout.regular-grid": guide(
    "Make regular positions",
    "Create a row-major rectangular sequence of points.",
    "Use it as a repeatable starting layout for marks.",
    ["origin", "spacing", "columns", "rows"],
    "pointAt(index) returns each row-major local [x,y] position; loop size to place marks. serialize() copies {origin,spacing,columns,rows}; zero columns or rows makes an empty sequence.",
    `const grid = regularGrid({
  origin: [10, 20],
  spacing: [8, 12],
  columns: 3,
  rows: 2,
});
console.log({ count: grid.size, last: grid.pointAt(5) });`,
    "Loop over grid.size and draw a mark at each point.",
  ),
  "layout.retained-rectangle-cuts-2d": guide(
    "Edit retained rectangles",
    "Start with one rectangle and make direct stable-ID cuts or removals.",
    "Use it for interactive region editing.",
    ["bounds"],
    "cut(id, axis, coordinate) mutates the retained layout and returns stable child IDs; leaves() returns current {id,bounds:[left,top,right,bottom]} entries for drawing and selection. toValues() is a detached snapshot.",
    `const layout = retainedRectangleCuts2D({ bounds: [0, 0, 10, 8] });
const children = layout.cut(0, "X", 4);
console.log({ children, leaves: layout.leaves(), exported: layout.toValues() });`,
    "For each leaf, draw `p.rect(left, top, right - left, bottom - top)`. `cut(id, 'X', x)` makes a vertical division and `cut(id, 'Y', y)` a horizontal one; the coordinate must lie strictly inside the chosen region. `remove(id)` removes a leaf. Store those commands to replay an editing session.",
  ),
  "sampling.seeded-circle-placement-2d": guide(
    "Place circles from a seed",
    "Propose and retain separated circles under an explicit attempt budget.",
    "Use it for reproducible scattered forms.",
    ["seed", "attempts", "origin", "extent", "radiusRange", "separationScale"],
    "pointAt(index) and radiusAt(index) provide each accepted circle in proposal order; sourceIndexAt(index) points back to the accepted proposal. toValues() copies placements.",
    `const circles = seededCirclePlacement2D({
  seed: 42,
  attempts: 20,
  origin: [0, 0],
  extent: [40, 40],
  radiusRange: [2, 5],
  separationScale: 1,
});
console.log({ kept: circles.size, first: circles.pointAt(0) });`,
    "Draw circles or replace them with your own symbols.",
  ),
  "topology.seeded-endpoint-branches-2d": guide(
    "Grow retained branches",
    "Generate endpoint branches from explicit rules and a seed.",
    "Use it when a tree needs repeatable topology before styling.",
    ["seed", "root", "rules", "maxSegments"],
    "segmentAt(index) returns local [x1,y1,x2,y2] and generationAt(index) identifies its branch generation, so loop size and style each p.line(). toValues() copies it.",
    `const tree = seededEndpointBranches2D({
  seed: 4,
  root: { origin: [0, 0], heading: 0, length: 10 },
  rules: [
    { lengthScale: [0.7, 0.7], slots: [{ probability: 1, turn: [0, 0] }] },
  ],
  maxSegments: 2,
});
console.log({ segments: tree.size, first: tree.segmentAt(0) });`,
    "Use generationAt() to vary stroke color or width.",
  ),
  "topology.seeded-line-pool-2d": guide(
    "Repeatedly cut a line",
    "Build a bounded retained pool of line segments.",
    "Use it for branching cut structures with stable segment access.",
    [
      "seed",
      "segment",
      "attempts",
      "firstCutAngleScale",
      "minCutLength",
      "maxSegments",
    ],
    "segmentAt(index) returns each local [x1,y1,x2,y2] in retained order, so loop size and draw p.line() directly. toValues() copies segment data.",
    `const pool = seededLinePool2D({
  seed: 12,
  segment: [0, 0, 10, 0],
  attempts: 2,
  firstCutAngleScale: 1,
  minCutLength: 1,
  maxSegments: 5,
});
console.log({ segments: pool.size, first: pool.segmentAt(0) });`,
    "Draw each retained segment in its stored order.",
  ),
  "layout.seeded-quadrant-partition-2d": guide(
    "Subdivide seeded regions",
    "Replace eligible rectangles with quadrant cells.",
    "Use it for a repeatable mosaic skeleton.",
    ["seed", "replacements", "origin", "extent", "selectionFraction"],
    "boundsAt(index) returns [left,top,right,bottom] and idAt(index) returns the stable live ID, so loop size and draw each cell with width right-left and height bottom-top. toValues() copies the layout.",
    `const layout = seededQuadrantPartition2D({
  seed: 42,
  replacements: 2,
  origin: [0, 0],
  extent: [16, 16],
  selectionFraction: 1,
});
console.log({ cells: layout.size, first: layout.boundsAt(0) });`,
    "Draw a different mark inside every returned bounds.",
  ),
  "sampling.seeded-triangle-points-2d": guide(
    "Sample points in a triangle",
    "Generate uniform retained triangle samples from a seed.",
    "Use it for dots, grain, or point-driven marks inside a triangle.",
    ["seed", "count", "triangle"],
    "pointAt(index) returns each sampled local [x,y] coordinate; loop size to place dots or mark origins. toValues() copies them.",
    `const points = seededTrianglePoints2D({
  seed: 42,
  count: 6,
  triangle: [
    [0, 0],
    [10, 0],
    [0, 10],
  ],
});
console.log({ count: points.size, first: points.pointAt(0) });`,
    "Draw each point as a dot or use it as a mark origin.",
  ),
  "raster.separable-blur-2d": guide(
    "Blur with explicit kernels",
    "Apply horizontal and vertical kernels to a raster.",
    "Use it when blur parameters must be data rather than renderer state.",
    ["source", "kernelX", "kernelY", "maxSamples"],
    "pixelAt(index) and pixels() return packed unsigned ARGB8/AARRGGBB values; toValues().pixels is detached data rather than p5 RGBA channels.",
    `const raster = separableBlur2D({
  source: { width: 2, height: 1, pixels: [0xff112233, 0xffaabbcc] },
  kernelX: [1, 2, 1],
  kernelY: [1],
  maxSamples: 100,
});
console.log(raster.toValues());`,
    "Create `const image = p.createImage(raster.width, raster.height)` and call `image.loadPixels()`. Convert each packed ARGB32 pixel to RGBA slots: for pixel i, write red `(pixel >>> 16) & 255`, green `(pixel >>> 8) & 255`, blue `pixel & 255`, alpha `pixel >>> 24` at `image.pixels[4*i…4*i+3]`, then call `image.updatePixels()` and draw it with `p.image(image, 0, 0)`.",
  ),
  "geometry.sequential-disc-projection-2d": guide(
    "Project points out of discs",
    "Move points through ordered disc influences.",
    "Use it for a simple geometry adjustment before drawing.",
    ["points", "discs", "strength", "maxTests"],
    "pointInto(index,out,offset) writes each final local [x,y], while points() returns a packed coordinate array and toValues().points returns [x,y] pairs. Loop size to draw those points.",
    `const result = sequentialDiscProjection2D({
  points: [[5, 0]],
  discs: [[0, 0, 10]],
  strength: 0.5,
  maxTests: 1,
});
const point = [0, 0];
result.pointInto(0, point, 0);
console.log({ point, packed: result.points(), exported: result.toValues().points });`,
    "Draw the projected points with your own symbols.",
  ),
  "color.stop-ramp": guide(
    "Sample color stops",
    "Create an immutable color ramp from positioned RGB stops.",
    "Use it when colors should change along a distance or phase.",
    ["stops"],
    "sample(position) returns RGB24 at any finite position and holds the endpoint color outside the stop range; serialize() copies the ordered stops.",
    `const ramp = stopRamp({
  stops: [
    { position: 0.25, color: 0xff0000 },
    { position: 0.75, color: 0x0000ff },
  ],
});
console.log(ramp.sample(0.5).toString(16));`,
    "Map a mark index to a position before sampling.",
  ),
  "motion.target-springs-2d": guide(
    "Step points toward targets",
    "Advance a retained spring state by one explicit update.",
    "Use it for deterministic motion with no wall-clock dependency.",
    ["state", "targets"],
    "The returned state exposes size, positionAt(index), and velocityAt(index); toValues() returns {bodies:[{position,velocity,strength,retention}]} for persistence or the next update.",
    `const targets = [[1, 1]];
const next = targetSprings2D({
  state: {
    bodies: [{ position: [0, 0], velocity: [0, 0], strength: 1, retention: 1 }],
  },
  targets,
});
const following = targetSprings2D({ state: next.toValues(), targets });
console.log({ first: next.toValues(), second: following.toValues() });`,
    "Draw positions from next.toValues().bodies, then pass that same value as state for the next explicit frame.",
  ),
  "sampling.triangle-coordinate-map-2d": guide(
    "Map chosen triangle coordinates",
    "Turn supplied unit pairs into retained points in a triangle.",
    "Use it when you want a custom distribution instead of seeded uniform samples.",
    ["triangle", "unitCoordinates"],
    "pointAt(index) returns each mapped local [x,y] in unitCoordinates order; loop size to draw those points. toValues() copies them.",
    `const points = mapTriangleCoordinates2D({
  triangle: [
    [0, 0],
    [10, 0],
    [0, 10],
  ],
  unitCoordinates: [
    [0.25, 0.5],
    [0.81, 0.2],
  ],
});
console.log(points.toValues());`,
    "Generate unit coordinates with your own rule, then map them once.",
  ),
};

for (const [id, guide] of Object.entries(apiGuides)) {
  const inputs = apiInputs[id];
  if (!inputs) throw new Error(`Missing authored inputs: ${id}`);
  guide.inputs = inputs;
  delete guide.inputNames;
}

export { apiGuides };
