/** Artist-facing guides for the reviewed weighted-image, signal and 3D queries. */
export const externalVisualApiGuides = {
  "sampling.weighted-raster-points-2d": {
    title: "Place marks from image mass",
    summary: "Turn a caller-prepared weight raster into replayable, jittered mark positions.",
    useWhen: "You have one nonnegative integer mass per pixel and want denser marks where that mass is larger.",
    inputs: {
      width: "Raster width in pixels; x increases right and the flat array is row-major.",
      height: "Raster height in pixels; y increases down.",
      weights: "One nonnegative integer mass per pixel. Zero mass excludes that pixel from selection.",
      count: "Number of positions to draw with replacement; several may land in one pixel.",
      rngState: "Explicit unsigned 32-bit LCG state. Pass the returned state into the next call to continue the stream.",
      maxWork: "Explicit work cap: pixel scan, four draws per emitted mark and charged search comparisons."
    },
    output: "{points,pixelIndices,rngState}: detached jittered positions, source pixel indices in draw order and the advanced RNG state.",
    code: "const result = weightedRasterPoints2D({width:3,height:2,weights:[0,2,5,1,0,3],count:4,rngState:42,maxWork:100});\nconsole.log(result.pixelIndices, result.points, result.rngState);",
    tryThis: "Swap in a second image-derived mass raster while keeping count and rngState fixed; then switch dots to stitches without resampling.",
    pitfalls: [
      "Prepare the mass raster yourself; this operation does not choose luminance, handle alpha or render marks.",
      "The supplied LCG stream is deterministic, but sampled marks have no minimum spacing."
    ]
  },
  "layout.weighted-raster-centroids-2d": {
    title: "Relax marks toward weighted centers",
    summary: "Move sites once toward the image mass assigned to each nearest site.",
    useWhen: "You already have site positions and want one synchronous, mass-weighted layout update.",
    inputs: {
      width: "Raster width in pixel cells; each pixel center is at column + 0.5.",
      height: "Raster height in pixel cells; each pixel center is at row + 0.5.",
      weights: "Row-major nonnegative integer masses; zero-weight cells do not participate.",
      sites: "Original [x,y] sites inside the closed raster bounds. Exact distance ties choose the first site.",
      maxWork: "Explicit cap for P pixel inspections plus M positive pixels times S sites."
    },
    output: "{sites,masses}: one detached centroid per original site and its assigned integer mass. Empty sites retain their original positions.",
    code: "const result = weightedRasterCentroids2D({width:3,height:2,weights:[0,2,5,1,0,3],sites:[[0.5,0.5],[2.5,1.5]],maxWork:100});\nconsole.log(result.sites, result.masses);",
    tryThis: "Use sampled marks as the sites, then call this operation once per deliberate relaxation step while retaining the same weights.",
    pitfalls: [
      "Every pixel is assigned using the original sites, so one call is not an implicit convergence loop.",
      "The output preserves one entry per input site even when a site receives no mass."
    ]
  },
  "signal.sample-recorded-controls": {
    title: "Map a recorded signal to controls",
    summary: "Sample explicit time-series channels and map them to editable drawing parameters.",
    useWhen: "You have recorded or authored feature samples and need repeatable values at a chosen logical time.",
    inputs: {
      times: "Strictly increasing nonnegative sample times; a query outside them holds the endpoint row.",
      channels: "Unique ASCII channel identifiers, matching the columns of each sample row.",
      samples: "One finite numeric row per time; every row has one value per channel.",
      time: "Explicit query time. The operation reads no wall clock or media device.",
      maxGap: "Largest allowed strict-interior time bracket. A wider gap raises TIME_GAP, even for STEP.",
      mappings: "Ordered channel maps with STEP or LINEAR interpolation, domain, range and clamp flag.",
      maxWork: "Explicit budget for T times × C channels + M mappings."
    },
    output: "{values}: detached mapped values in mapping order, ready for size, spacing, opacity or another caller-chosen parameter.",
    code: "const result = sampleRecordedControls({times:[0,2,4],channels:['level','accent'],samples:[[0,1],[1,0],[0,1]],time:1,maxGap:2,mappings:[{channel:'level',interpolation:'LINEAR',domain:[0,1],range:[4,12],clamp:true},{channel:'accent',interpolation:'STEP',domain:[0,1],range:[10,2],clamp:true}],maxWork:8});\nconsole.log(result.values); // [8, 2]",
    tryThis: "Keep the same samples but map level to mark spacing instead of radius, or swap in a non-audio data series with the same channel names.",
    pitfalls: [
      "STEP changes at an exact knot; it does not skip a large interior gap.",
      "Signal acquisition, FFT/RMS analysis, text contours and drawing belong to the caller."
    ]
  },
  "mesh.prepare-surface-attributes-3d": {
    title: "Light and texture an indexed mesh",
    summary: "Compute explicit face or smooth normals while preserving chosen per-corner UV seams.",
    useWhen: "Your triangles need controlled hard edges, smooth lighting or an image placed by your own UV chart.",
    inputs: {
      positions: "Finite right-handed xyz source vertices.",
      triangles: "Indexed corners [i,j,k]; winding determines the outward face normal.",
      normalMode: "flat duplicates each triangle's corners; smooth averages incident face normals within each smoothing group.",
      smoothingGroups: "One nonnegative integer per triangle. Distinct groups make a hard lighting seam in smooth mode.",
      cornerUVs: "Three [u,v] pairs per triangle, or null for no texture. u increases right and v down on an upright image.",
      maxVertices: "Worst-case output cap of three vertices per triangle, including seam duplication.",
      maxWork: "Explicit geometry reservation V + 27F before normal or UV construction."
    },
    output: "Detached {positions,triangles,normals,uvs,sourceVertexIndices}; seam/group splits can duplicate a source vertex.",
    code: "const result = prepareSurfaceAttributes3D({positions:[[0,0,0],[2,0,0],[2,2,0],[0,2,0]],triangles:[[0,1,2],[0,2,3]],normalMode:'smooth',smoothingGroups:[0,0],cornerUVs:[[[0,0],[1,0],[1,1]],[[0,0],[0,1],[1,1]]],maxVertices:6,maxWork:58});\nconsole.log(result.positions.length, result.triangles, result.normals, result.uvs);",
    tryThis: "Change one corner UV while leaving source positions and smoothing groups fixed, then switch to flat mode to compare the lighting seam.",
    pitfalls: [
      "This operation does not create a UV chart, repair winding, choose materials or render the mesh.",
      "A zero-area face, represented cross-product collapse and overflowing arithmetic have distinct error codes."
    ]
  },
  "field.raymarch-implicit-rays-3d": {
    title: "Query blended and cut volumes",
    summary: "Return bounded CPU hit records for rays through a typed sphere, box and CSG scene.",
    useWhen: "You want to inspect an implicit form's silhouette, cut, surface depth or estimated normal with explicit rays.",
    inputs: {
      scene: "A passive tree of sphere/axisBox leaves, union/intersection/difference/smoothUnion nodes and positive-uniform transforms.",
      rays: "Ordered world-space origin/direction pairs. Directions are normalized by the operation.",
      maxDistance: "Positive world-space travel limit; an exact reached endpoint is sampled once.",
      hitEpsilon: "Positive approximate-hit threshold in world units.",
      normalStep: "Positive central-difference offset for six extra field samples on a smooth hit.",
      maxSteps: "Maximum primary field samples per ray, including the initial sample.",
      maxRays: "Input-ray count cap.",
      maxSceneNodes: "Typed scene-node count cap; tree depth is separately limited to 64.",
      maxWork: "Exact reservation R × (maxSteps + 6) × scene nodes before tracing."
    },
    output: "{results}: one detached hit/miss record per ray with sampled travel and position, field value, optional normal, overshoot flag and sample counts.",
    code: "const scene={kind:'difference',left:{kind:'sphere',center:[0,0,0],radius:1.5},right:{kind:'axisBox',center:[0,0,1.3],halfExtents:[0.28,0.65,0.7]}};\nconst result=raymarchImplicitRays3D({scene,rays:[{origin:[0,0,4],direction:[0,0,-1]},{origin:[1,0,4],direction:[0,0,-1]}],maxDistance:10,hitEpsilon:0.005,normalStep:0.01,maxSteps:20,maxRays:2,maxSceneNodes:3,maxWork:200});\nconsole.log(result.results.map(hit=>[hit.kind,hit.distance,hit.normalStatus]));",
    tryThis: "Widen the subtracting box or replace it with a sphere, then shade the returned normals with a separate light and camera choice.",
    pitfalls: [
      "Finite steps and epsilon do not certify an exact surface intersection or every thin feature.",
      "A sharp corner or CSG tie can return an undefined normal; the operation does not produce a mesh or GPU image."
    ]
  },
  "complex.escape-distance-2d": {
    title: "Sample a complex escape field",
    summary: "Compute escape counts and derivative distance estimates over a caller-defined complex-plane grid.",
    useWhen: "You want deterministic Mandelbrot or Julia structure as reusable scalar fields before choosing colors or marks.",
    inputs: {
      mapping: "mandelbrot starts each orbit at zero; julia starts at the sampled point.",
      constant: "Finite [real,imaginary] Julia constant; still required but unused for Mandelbrot.",
      grid: "Output width, height, world origin and strictly positive [x,y] cell spacing.",
      iterations: "Positive maximum orbit steps per sample.",
      maxWork: "Explicit cap for iterations multiplied by width and height."
    },
    output: "{width,height,iteration,distance}: detached row-major escape-count and nonnegative distance buffers.",
    code: "const result=complexEscapeDistance2D({mapping:'mandelbrot',constant:[0,0],grid:{width:3,height:2,origin:[-2,-1],cell:[0.75,1]},iterations:20,maxWork:120});\nconsole.log(result.iteration, result.distance);",
    tryThis: "Keep the grid fixed and switch to Julia with a chosen constant, then map iteration and distance to separate visual channels.",
    pitfalls: [
      "The operation returns fields, not a palette or rendered fractal.",
      "Increasing either grid area or iterations consumes the precharged work budget."
    ]
  },
  "fractal.flame-accumulate-2d": {
    title: "Accumulate a transform flame",
    summary: "Advance a seeded weighted transform process and splat its points into a reusable density grid.",
    useWhen: "You want deterministic iterated-transform density without coupling the process to color mapping or drawing.",
    inputs: {
      transforms: "Nonempty weighted affine transforms with a, t and one supported component-wise power.",
      seeds: "Nonempty finite starting points used in order when a nonfinite iterate is reset.",
      iterations: "Positive number of transform advances and RNG draws.",
      density: "Output width, height, world origin and strictly positive [x,y] cell spacing.",
      rngState: "Explicit unsigned 32-bit LCG state; retain the returned state to continue the stream.",
      maxWork: "Explicit cap for the iteration count."
    },
    output: "{density,plotted,dropped,rngState}: a detached row-major density grid, accounting counters and advanced RNG state.",
    code: "const result=fractalFlameAccumulate2D({transforms:[{a:[0.5,0,0,0.5],t:[-0.4,0],power:'linear',weight:1},{a:[0.5,0,0,0.5],t:[0.4,0.5],power:'linear',weight:1}],seeds:[[0,0]],iterations:12,density:{width:8,height:8,origin:[-1,-1],cell:[0.25,0.25]},rngState:42,maxWork:12});\nconsole.log(result.density, result.plotted, result.dropped, result.rngState);",
    tryThis: "Change transform translations while preserving weights and rngState, then recolor the same density buffer.",
    pitfalls: [
      "The density is raw accumulated weight; normalization and tone mapping belong to the caller.",
      "Out-of-grid or nonfinite iterates are counted as dropped rather than silently relocated."
    ]
  },
  "growth.space-colonization-step-2d": {
    title: "Grow tips toward source points",
    summary: "Advance one bounded nearest-source growth step and return explicit segments and replacement tips.",
    useWhen: "You want to build branching linework from your own tips and attraction points while controlling each simulation step.",
    inputs: {
      tips: "Nonempty finite [x,y] growth fronts in processing order.",
      sources: "Nonempty finite [x,y] attraction points.",
      consumed: "One boolean per source, carried between calls.",
      step: "Strictly positive growth distance for each emitted replacement tip.",
      reach: "Strictly positive distance at which a source is consumed and branching occurs.",
      branches: "Positive number of replacement tips emitted at a reached source.",
      branchAngle: "Finite branch fan half-angle in radians.",
      maxWork: "Explicit cap for tips multiplied by sources."
    },
    output: "{tips,segments,consumed,dropped}: replacement fronts, this step's xyxy segments, updated source flags and bounded-tip drops.",
    code: "const result=spaceColonizationStep2D({tips:[[0,0]],sources:[[4,0],[4,3]],consumed:[false,false],step:1,reach:0.5,branches:2,branchAngle:0.4,maxWork:2});\nconsole.log(result.tips, result.segments, result.consumed, result.dropped);",
    tryThis: "Feed the returned tips and consumed flags into another call, or replace sources with points sampled from your own silhouette.",
    pitfalls: [
      "One call performs one step; iteration, source creation and segment drawing stay under caller control.",
      "The output tip cap is 2048; excess branch tips are counted in dropped."
    ]
  }
};
