/** Teaching copy for each constructor, reviewed against its own operation contract. */
const seed =
  "An integer from 0 to 4294967295. Reuse it with the same inputs to reproduce the result; change it to explore another arrangement.";
const raster =
  "A plain `{width, height, pixels}` object. Width and height are positive pixel counts; `pixels` contains exactly width × height unsigned `0xAARRGGBB` integers in row order. Convert p5.Image RGBA channels to this packed format first.";
const separation =
  "A positive multiplier on the sum of two radii. At 1 circles may touch; below 1 they may overlap; above 1 they have size-relative clearance. It is not a fixed pixel gap.";
const field =
  "A descriptor `{seed: 42}` for the package’s 2D noise field. This field seed selects the terrain being sampled; pass data rather than a p5 noise function.";
const fieldScale =
  "Multiply each drawing coordinate by this value before sampling the field. Larger magnitudes sample a wider span of the field across the same drawing; zero samples one fixed location. Negative values are allowed.";
const fieldOffset =
  "A finite `[x, y]` translation applied after fieldScale, in field coordinates. Change it to sample a different part of the same seeded field without moving the path’s starting point.";
export const apiInputs = {
  "mesh.annular-solid-3d": {
    outerRadius:
      "Distance from the Z axis to the outside wall, in your drawing units. It must be greater than innerRadius.",
    innerRadius:
      "Radius of the central hole, in the same units. It must be positive and smaller than outerRadius; increasing it makes the ring thinner.",
    bottomZ: "Z coordinate of the bottom face. Choose a value below topZ.",
    topZ: "Z coordinate of the top face. The difference topZ − bottomZ sets the solid’s height.",
    slices:
      "Integer number of angular sections around the ring, at least 3. More sections make the circular outline finer and increase mesh size.",
    maxFaces:
      "Positive integer limit on generated triangles. This mesh needs 8 × slices faces; a smaller budget fails instead of returning a partial solid.",
  },
  "raster.bilinear-remap-2d": {
    source: raster,
    outputWidth:
      "Positive integer width of the new raster. This sets the number of sampling positions in each output row.",
    outputHeight:
      "Positive integer height of the new raster. Together with outputWidth it determines the required map length.",
    sourceCoordinates:
      "One source `[x, y]` pair for each output pixel, in row order. Coordinates are in source pixel units: integer positions copy pixels, fractional positions interpolate nearby colors. Coordinates beyond an edge clamp to that edge. This is a destination-to-source map.",
  },
  "layout.binary-cell-partition-2d": {
    seed,
    columns:
      "Positive integer width of the starting grid in cells. Cuts fall on integer cell boundaries; multiply returned bounds by your cell size when drawing.",
    rows: "Positive integer height of the starting grid in cells. Together with columns it defines the rectangle to subdivide.",
    attempts:
      "Nonnegative integer number of split attempts. An attempt may select a cell that cannot split, so this is not the final panel count.",
    axisPolicy:
      '`"RANDOM"` chooses seeded cut axes. `"LONGEST"` cuts along the selected cell’s longer dimension; ties follow the contract’s fixed rule.',
  },
  "geometry.clip-segments-simple-polygon-2d": {
    polygon:
      "At least three distinct `[x, y]` vertices around the clipping boundary. Concave outlines and either winding work. Do not repeat the first vertex at the end; edges must not cross or touch non-neighboring edges.",
    segments:
      "Line segments as `[x1, y1, x2, y2]`, in the same coordinate system as the polygon. A segment can produce multiple pieces inside a concave outline. Zero-length segments and point-only contacts produce no piece.",
    maxWork:
      "Nonnegative integer geometry-work budget. For V polygon vertices and S segments, allow at least V² + S × (8V² + 16V + 8). This is an operation budget, not a duration in milliseconds.",
    maxOutputSegments:
      "Nonnegative integer limit on all retained pieces. Allow more than the input count when a concave boundary can split one line into several pieces. Exceeding it fails the call without partial output.",
  },
  "geometry.closed-spline-2d": {
    controls:
      "At least three ordered `[x, y]` points. The curve passes through them and closes from the last back to the first automatically. Repeated points are allowed; the curve may overshoot between controls.",
    subdivisions:
      "Positive integer number of chords per control-to-control span used to estimate arc length. Increase it for finer distance-based sampling. It refines the length lookup, not the underlying Catmull–Rom curve.",
  },
  "color.cyclic-palette": {
    colors:
      "One or more colors as unsigned `0xRRGGBB` integers, in cycle order. Samples interpolate between neighbors, including the last back to the first. Repeated colors can hold a hue longer; a one-color palette is constant.",
  },
  "topology.delaunay-2d": {
    points:
      "Your sites as finite `[x, y]` pairs. Duplicate coordinates merge and unique sites sort by X then Y, so returned vertex indices may differ from input indices. Collinear sites have no triangles.",
    maxWork:
      "Nonnegative integer budget for preprocessing, hull tests, face searches and edge legalization. It must cover at least the input count; larger point sets may need much more. An exhausted budget throws without returning a partial mesh.",
  },
  "field.gradient-noise-2d-01": {
    seed: "An integer from 0 to 4294967295 that selects a repeatable 2D field. Construct once, then call sample(x, y) at many coordinates. Changing the seed changes the field; sampling does not advance random state.",
  },
  "field.gradient-noise-3d-01": {
    seed: "An integer from 0 to 4294967295 that selects a repeatable 3D field. Construct once, then call sample(x, y, z). You supply z explicitly, so it can represent depth or an animation coordinate.",
  },
  "path.gradient-trace-2d": {
    field,
    start:
      "The initial `[x, y]` point in drawing units. It is retained as point 0, before any movement.",
    steps:
      "Nonnegative integer number of advances. The returned path has steps + 1 positions and steps headings.",
    stepDistance:
      "Nonnegative drawing distance for each advance. Larger values separate consecutive points more; zero keeps every point at the start.",
    fieldScale,
    fieldOffset,
    angleBase:
      "Heading offset in radians, applied at every step. The heading is angleBase + noiseValue × angleScale; this is not just the initial direction.",
    angleScale:
      "Number of radians represented by the field’s 0–1 span. For example, 2π maps that span around a full turn; 0 produces a straight path at angleBase.",
  },
  "raster.masked-source-over-2d": {
    source: raster,
    destination:
      "The background raster in the same `{width, height, pixels}` format and with exactly the same dimensions as source. It is left unchanged; the operation creates a new raster.",
    mask: "One finite value from 0 to 1 per pixel, in row order. Zero keeps the destination; one uses the source’s full alpha; intermediate values reduce source opacity before source-over blending.",
  },
  "geometry.nearest-segment-contact-2d": {
    queries:
      "Directed `[x1, y1, x2, y2]` segments. The first endpoint is the search origin; reversing endpoints can change which contact is first. Each query gets one hit or an explicit miss.",
    obstacles:
      "Obstacle segments in the same `[x1, y1, x2, y2]` format and coordinate units. Input order breaks ties when contacts lie at the same query position. Endpoint contacts and collinear overlaps count.",
    maxWork:
      "Nonnegative integer pair-test budget. Set it to at least queries.length × obstacles.length. The operation tests the complete supplied sets and does not shorten later obstacles after a hit.",
  },
  "path.noise-band-trace-2d": {
    field,
    start:
      "Starting `[x, y]` position, always retained. Its noise value establishes the reference level for every proposal in this path.",
    heading:
      "Initial direction in radians. Zero points along positive X; positive angles turn toward positive Y. On a usual p5 canvas that appears clockwise.",
    seed: "An integer from 0 to 4294967295 for the path’s proposal turns. This is separate from field.seed: change it to try another route through the same noise field.",
    attempts:
      "Nonnegative integer number of proposals. Rejected proposals do not add a point, but subsequent attempts continue. This is not a requested number of vertices.",
    stepDistance:
      "Nonnegative distance between the current point and a proposed next point. Zero permits repeated positions when the band accepts them.",
    fieldScale,
    fieldOffset,
    tolerance:
      "Nonnegative allowed difference from the starting noise value. A proposal is accepted only when its absolute difference is strictly less than tolerance. Zero accepts none; larger values relax the band.",
    maxVertices:
      "Positive integer limit including the starting point. Set attempts + 1 to allow every proposal to succeed. An accepted proposal beyond this capacity throws rather than truncating the path.",
  },
  "path.occupied-lattice-paths-2d": {
    dimensions:
      "Positive integer `[columns, rows]` cell counts. Coordinates run from 0 through columns − 1 and rows − 1; this is a grid, not a canvas size in pixels.",
    starts:
      "Ordered integer `[x, y]` starting cells within the grid. Paths grow in this order and share occupancy, so earlier paths can block later starts. A blocked start returns an empty path.",
    maxSteps:
      "Nonnegative integer move limit per path. Each successful move visits a free north/east/south/west neighbor. A path may stop earlier when all neighbors are occupied or outside the grid.",
    maxCells:
      "Integer cell-work capacity. It must cover starts.length × (maxSteps + 1), even if paths would actually become blocked earlier. The operation checks this before growing any paths.",
    random:
      "Either `{seed: 42}` or `{state: [s0, s1, s2, s3]}`. Each number is an integer from 0 to 4294967295; the four state words cannot all be zero. State can continue random choices, but does not preserve previous calls’ occupancy.",
  },
  "sampling.ordered-circle-filter-2d": {
    centres:
      "Proposed circle centers as `[x, y]` pairs, in priority order. Earlier accepted circles can exclude later proposals; the operation does not move any center.",
    radii:
      "One positive radius per center, in the same drawing units. These are radii, so use twice each value as a p5 circle diameter.",
    separationScale: separation,
  },
  "sampling.ordered-convex-polygon-filter-2d": {
    polygons:
      "An ordered list of polygon proposals, each containing at least three `[x, y]` vertices around a strictly convex outline. Earlier accepted polygons win. Edge or point contact, overlap and containment exclude a later polygon; do not repeat the closing vertex.",
  },
  "mesh.radial-profile-surface-3d": {
    profile:
      "At least two `[z, radius]` pairs describing a silhouette around the Z axis. Z must strictly increase. Interior radii must be positive; either endpoint can have radius 0 to form a pole. Two zero-radius endpoints alone cannot form a surface.",
    slices:
      "Integer number of sections around the axis, at least 3. Increasing it refines the circular direction; add profile points to refine the silhouette along Z.",
    capStart:
      "Boolean requesting a flat cap when the first profile radius is positive. A zero-radius start pole already closes the surface.",
    capEnd:
      "Boolean requesting a flat cap when the last profile radius is positive. A zero-radius end pole already closes the surface.",
    maxFaces:
      "Positive integer triangle budget covering the side bands and requested caps. If the mesh would exceed it, generation fails without publishing partial geometry.",
  },
  "geometry.radial-pull-2d": {
    influences:
      "Ordered `[centerX, centerY, radius, power]` tuples. Radius and power must be positive. Points inside each radius receive an inward displacement whose falloff uses (distance/radius)^power. Larger power increases that pull at a fixed interior distance. Contributions use the original point and add together; overlapping pulls may fold geometry.",
  },
  "raster.crossfade-2d": {
    first: raster,
    second:
      "The second raster, with the same dimensions and packed pixel format as first. Neither input raster is modified.",
    weights:
      "One finite 0–1 value per pixel in row order. Zero selects first, one selects second, and intermediate values blend their alpha and premultiplied color. Use a constant array for a uniform fade or varying weights for a spatial transition.",
  },
  "layout.regular-grid": {
    origin:
      "The first `[x, y]` position in your drawing units. This is the location of the top-left grid point when drawing with p5’s usual axes.",
    spacing:
      "Positive `[horizontalDistance, verticalDistance]` between neighboring points. These are center-to-center distances; choose your mark size separately.",
    columns:
      "Nonnegative integer number of points in each row. Zero produces an empty grid.",
    rows: "Nonnegative integer number of rows. The total point count is columns × rows; zero produces an empty grid.",
  },
  "layout.retained-rectangle-cuts-2d": {
    bounds:
      "The initial rectangle as `[minX, minY, maxX, maxY]`, with each minimum strictly below its maximum. Maxima are coordinates, not width/height. The rectangle starts with stable ID 0; pass that ID to cut or remove.",
  },
  "sampling.seeded-circle-placement-2d": {
    seed,
    attempts:
      "Nonnegative integer count of circle proposals. Only proposals that pass separation are kept; more attempts do not guarantee a particular circle count or a filled canvas.",
    origin:
      "The `[x, y]` origin of the rectangle in which centers are proposed. This limits centers, not the full circles.",
    extent:
      "Positive `[width, height]` of the center-proposal rectangle. Circle edges may extend outside it; add your own containment rule if needed.",
    radiusRange:
      "Positive `[minimumRadius, maximumRadius]`, with minimum no larger than maximum. Equal values make fixed-size circles. The proposal distribution favors smaller radii rather than sampling them uniformly.",
    separationScale: separation,
  },
  "topology.seeded-endpoint-branches-2d": {
    seed,
    root: "The first branch as `{origin: [x, y], heading, length}`. Heading is in radians and length is nonnegative. Zero heading points along positive X; length is in your drawing units.",
    rules:
      "One rule per generation, in order. Each is `{lengthScale: [min, max], slots: [{probability, turn: [min, max]}, ...]}`. Length scales are ordered nonnegative multipliers on parent length; turns are ordered radian offsets from parent heading; probability is 0–1. Each slot can create a child at a parent endpoint.",
    maxSegments:
      "Positive integer limit on all retained segments including the root. More generations or child slots can grow the tree quickly; exceeding the limit fails the complete call.",
  },
  "topology.seeded-line-pool-2d": {
    seed,
    segment:
      "Initial `[x1, y1, x2, y2]` line in your drawing units. It is retained even with zero attempts. Later cuts shorten selected segments and may append branches.",
    attempts:
      "Nonnegative integer number of attempts to cut a selected segment. Segments shorter than minCutLength are skipped; successful cuts do not all create the same number of branches.",
    firstCutAngleScale:
      "Nonnegative multiplier on the generated first-cut angular spread, measured in radians. Larger values spread first-cut branches farther from their parent direction. Repeat cuts use their own fixed turn rule.",
    minCutLength:
      "Positive drawing length threshold for selecting a segment to cut. Shorter segments are skipped. This does not promise that all output branches exceed the threshold.",
    maxSegments:
      "Positive integer capacity including the original line and appended children. If a cut would exceed it, the call throws with no partial pool.",
  },
  "layout.seeded-quadrant-partition-2d": {
    seed,
    replacements:
      "Nonnegative integer number of leaf replacements. Each selected rectangle becomes four quadrants, so the result has 1 + 3 × replacements cells.",
    origin:
      "The `[x, y]` lower-coordinate corner of the starting rectangle. With p5’s downward Y axis this is its top-left corner.",
    extent:
      "Positive `[width, height]` of the starting rectangle in drawing units. Child rectangles occupy quadrants of this area.",
    selectionFraction:
      "A value greater than 0 and no greater than 1. It limits selection to a prefix of the current ordered cell list: 1 considers all cells; smaller values favor earlier cells. It controls which cells split, not how many split.",
  },
  "sampling.seeded-triangle-points-2d": {
    seed,
    count:
      "Nonnegative integer number of points to produce. This is an exact output count; zero returns an empty set.",
    triangle:
      "Three finite `[x, y]` vertices in drawing units, forming a triangle with nonzero area. Points are sampled uniformly over its area; either winding is accepted.",
  },
  "raster.separable-blur-2d": {
    source: raster,
    kernelX:
      "An odd-length list of nonnegative horizontal weights, with at least one positive value. The middle entry aligns with the current pixel. Weights are normalized, so [1, 2, 1] and [2, 4, 2] express the same kernel. [1] leaves this axis unblurred.",
    kernelY:
      "Vertical weights with the same rules as kernelX. Use a wider kernel for a broader vertical blur, or [1] for horizontal-only filtering. Samples beyond an edge clamp to that edge.",
    maxSamples:
      "Positive integer work budget of at least width × height × (kernelX.length + kernelY.length). Zero-weight taps still count. The operation checks this before filtering.",
  },
  "geometry.sequential-disc-projection-2d": {
    points:
      "Finite `[x, y]` positions to adjust. The result keeps the same count and order; the input list remains unchanged.",
    discs:
      "Ordered `[centerX, centerY, radius]` circles, with positive radii. A point inside a disc moves toward its edge before the next disc is tested. Order therefore matters; a later move can enter an earlier disc again.",
    strength:
      "A value from 0 to 1. Zero leaves points unchanged; one moves an interior point to the current disc’s edge; intermediate values move it partway. An exact-center point moves along positive X.",
    maxTests:
      "Nonnegative integer budget of at least points.length × discs.length, including when strength is zero. This is one pass through the discs, not an iterative collision solver.",
  },
  "color.stop-ramp": {
    stops:
      "One or more `{position, color}` records. Positions must strictly increase within 0–1; colors are unsigned `0xRRGGBB` integers. Closer stops create faster color changes. The first and last colors hold outside their positions; this ramp does not wrap.",
  },
  "motion.target-springs-2d": {
    state:
      "`{bodies: [...]}`, where each body is `{position: [x, y], velocity: [vx, vy], strength, retention}`. Position is in drawing units and velocity is distance per logical step. Nonnegative strength scales attraction toward the target; retention from 0–1 controls how much velocity survives for the next step. Even retention 0 allows the current position advance.",
    targets:
      "One finite `[x, y]` target per body, in matching order and drawing units. Each call advances exactly one logical step; call it again with the returned state to animate. Targets can change between calls.",
  },
  "sampling.triangle-coordinate-map-2d": {
    triangle:
      "Three finite `[x, y]` vertices with nonzero area, in your drawing units. Either winding works. The mapping preserves your coordinate-pair order.",
    unitCoordinates:
      "Your chosen `[u, v]` pairs, each value between 0 and 1 inclusive. The map uses sqrt(u) to convert the unit square to triangle area coordinates. Uniform independent pairs give area-uniform points; patterned pairs create your own distribution. The operation itself draws no random numbers.",
  },
};
