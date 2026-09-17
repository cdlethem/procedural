// Artist-facing guidance for the separately reviewed dynamics/regions expansion.
export const externalDynamicsApiGuides = {
  "spatial.contact-history-2d": {
    "title": "Keep fading contact links",
    "summary": "Retain relationships after nearby marks separate.",
    "useWhen": "Use current pairs with stable caller IDs, then map contact age or missing steps to opacity.",
    "inputs": {
      "ids": "Unique safe-integer identities corresponding to current point indices. Keep IDs across reordering.",
      "pairs": "Unique [i,j] indices with i<j, in strict lexicographic order; the caller chooses the graph.",
      "contacts": "Previous sorted ID-pair records with activeTicks and missingTicks; empty starts fresh.",
      "lingerSteps": "How many absent logical steps a contact may survive. Zero removes absent pairs immediately.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "{contacts}: fresh ID-pair records with accumulated active ticks and consecutive missing ticks.",
    "code": "const result = contactHistory2D({\"ids\":[10,20],\"pairs\":[[0,1]],\"contacts\":[],\"lingerSteps\":2,\"maxWork\":3});\nconsole.log(result);",
    "tryThis": "Change lingerSteps while keeping motion fixed, or replace the current pair graph without changing identity.",
    "pitfalls": [
      "Reusing an ID reuses its identity.",
      "This operation does not find neighbors, move bodies or draw links."
    ]
  },
  "motion.sensor-motor-step-2d": {
    "title": "Steer marks with paired sensors",
    "summary": "Turn moving marks toward or away from differences in a supplied scalar field.",
    "useWhen": "Provide old agent positions, headings and speeds; each step samples two probes before updating all agents.",
    "inputs": {
      "agents": "Records {position,headingTurns,speed}; heading zero points right, positive turns point toward increasing y.",
      "field": "Values, columns, rows, origin at the first cell center, spacing, and explicit clamp/wrap/zero boundary policy.",
      "sensorDistance": "Probe distance from the old position, in position units.",
      "sensorAngleTurns": "Lateral probe angle, in turns, around the old heading.",
      "turnGain": "Signed heading response to right-minus-left sampled field difference.",
      "dt": "Explicit logical time step; no frame clock is read.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "{agents,probes,samples}: moved agents and the two old-state probe positions/values used for each response.",
    "code": "const result = sensorMotorStep2D({\"agents\":[{\"position\":[1.5,0],\"headingTurns\":0,\"speed\":0}],\"field\":{\"values\":[1,2],\"columns\":2,\"rows\":1,\"origin\":[0,0],\"spacing\":[1,1],\"boundary\":\"zero\"},\"sensorDistance\":0,\"sensorAngleTurns\":0,\"turnGain\":1,\"dt\":1,\"maxWork\":3});\nconsole.log(result);",
    "tryThis": "Replace the field while retaining agents, or invert turnGain to reverse the response.",
    "pitfalls": [
      "Field wrapping changes sampling, not automatic agent position wrapping.",
      "There is no deposition or field diffusion in this step."
    ]
  },
  "motion.flock-steer-2d": {
    "title": "Steer a supplied flock graph",
    "summary": "Combine neighbor position, velocity and separation into editable steering vectors.",
    "useWhen": "Choose the neighbor graph independently, then integrate returned steering in your motion model.",
    "inputs": {
      "points": "Supplied finite [x,y] positions in canvas or chosen world units.",
      "velocities": "One [vx,vy] old velocity per point.",
      "pairs": "Unique [i,j] indices with i<j, in strict lexicographic order; the caller chooses the graph.",
      "cohesion": "Weight of the vector toward mean neighbor position.",
      "alignment": "Weight of the difference from mean neighbor velocity.",
      "separation": "Weight of the mean unit vector away from noncoincident neighbors.",
      "maxSteer": "Nonnegative cap on each final steering-vector length.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "{steering}: one detached vector per original point; this does not integrate positions.",
    "code": "const result = flockSteer2D({\"points\":[[0,0],[2,0]],\"velocities\":[[0,0],[4,2]],\"pairs\":[[0,1]],\"cohesion\":0,\"alignment\":0.5,\"separation\":0,\"maxSteer\":100,\"maxWork\":3});\nconsole.log(result);",
    "tryThis": "Swap proximity pairs for a fixed chain, then change alignment while preserving the graph.",
    "pitfalls": [
      "Coincident neighbors contribute no invented separation direction.",
      "No neighbor search, walls or collision resolution is implicit."
    ]
  },
  "geometry.region-clearance-2d": {
    "title": "Measure room between filled regions",
    "summary": "Check whether shaped marks overlap, touch or leave a visible gap.",
    "useWhen": "Compare complete outer rings and holes rather than only their centerlines.",
    "inputs": {
      "a": "First strict Region2D: outer ring and disjoint, strictly contained holes.",
      "b": "Second strict Region2D in the same coordinates.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "{relation,minimumDistance,witness}: classification and deterministic geometry indices; minimumDistance is null for intersecting filled regions, otherwise the boundary distance.",
    "code": "const result = regionClearance2D({\"a\":{\"outer\":[[0,0],[2,0],[2,2],[0,2]],\"holes\":[]},\"b\":{\"outer\":[[5,0],[7,0],[7,2],[5,2]],\"holes\":[]},\"maxWork\":10000});\nconsole.log(result);",
    "tryThis": "Move a mark near a hole and compare the filled-region result with a centerline-only intuition.",
    "pitfalls": [
      "Rings must be simple; touching or nested holes are unsupported.",
      "The result does not repair geometry or choose a new placement."
    ]
  },
  "geometry.tapered-stroke-strip-2d": {
    "title": "Build a variable-width ribbon",
    "summary": "Turn a centerline with changing widths into a reusable filled boundary.",
    "useWhen": "Draw, hatch or test the resulting region independently of its centerline.",
    "inputs": {
      "points": "Supplied finite [x,y] positions in canvas or chosen world units.",
      "widths": "Positive full widths, one per centerline point.",
      "closed": "Whether the centerline closes. Closed strips may return one outer ring and one hole.",
      "cap": "BUTT or SQUARE end caps; explicit even for a closed line.",
      "join": "BEVEL or MITER outer joins. Inner turns require valid finite trimming.",
      "miterLimit": "Maximum outer miter distance relative to half-width; at least one.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "An ACCEPTED strip with visible region, boundaries and resolved joins, or REJECTED with a topology witness.",
    "code": "const result = taperedStrokeStrip2D({\"points\":[[0,0],[4,0]],\"widths\":[2,4],\"closed\":false,\"cap\":\"BUTT\",\"join\":\"BEVEL\",\"miterLimit\":1,\"maxWork\":10000});\nconsole.log(result);",
    "tryThis": "Taper one end, switch joins, then reuse the returned region for hatching or clearance.",
    "pitfalls": [
      "Self-crossing or collapsed strips are rejected, not repaired.",
      "A wide sharp bend can be invalid even when its centerline is simple."
    ]
  },
  "geometry.select-tapered-stroke-strips-2d": {
    "title": "Keep ribbons with room around them",
    "summary": "Select ordered variable-width paths that leave the requested negative space.",
    "useWhen": "Supply candidate IDs, paths and widths; reuse retained regions for different drawing treatments.",
    "inputs": {
      "candidates": "Ordered records with id, points, widths, closed, cap, join and miterLimit. Earlier accepted strips take priority.",
      "clearance": "Minimum filled-region separation in position units; equality is accepted.",
      "exclusions": "Strict filled regions that every candidate must avoid.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit.",
      "maxAccepted": "Maximum retained candidates; later records receive static validation and LIMIT reporting, without strip construction or topology checks."
    },
    "output": "{accepted,rejected}: retained strips and explicit rejection reasons/witnesses in deterministic order.",
    "code": "const result = selectTaperedStrokeStrips2D({\"candidates\":[{\"id\":\"a\",\"points\":[[0,0],[4,0]],\"widths\":[2,2],\"closed\":false,\"cap\":\"BUTT\",\"join\":\"BEVEL\",\"miterLimit\":1},{\"id\":\"b\",\"points\":[[0,3],[4,3]],\"widths\":[2,2],\"closed\":false,\"cap\":\"BUTT\",\"join\":\"BEVEL\",\"miterLimit\":1}],\"clearance\":1,\"exclusions\":[],\"maxAccepted\":2,\"maxWork\":100000});\nconsole.log(result);",
    "tryThis": "Increase clearance while keeping candidate paths fixed, or reorder paths to change which competing marks survive.",
    "pitfalls": [
      "This is ordered selection, not a global packing optimum.",
      "Every candidate receives static validation; candidates skipped after the accepted-count cap are not constructed or topology-tested."
    ]
  },
  "geometry.hatch-region-lines-2d": {
    "title": "Clip hatch lines around holes",
    "summary": "Fill an irregular region with parallel line fragments that stop at its holes.",
    "useWhen": "Compose several calls with different directions for crosshatching, then draw or export the returned paths.",
    "inputs": {
      "region": "Strict Region2D outer ring and disjoint holes.",
      "origin": "Reference [x,y] position for the hatch field.",
      "direction": "Finite nonzero [dx,dy] line direction; normalized by the operation.",
      "spacing": "Positive perpendicular distance between lines, in region units.",
      "phase": "Offset of the line family, in the same units.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit.",
      "maxOutputPaths": "Hard cap on clipped fragments before output is published."
    },
    "output": "{paths,lineIndices,intervals}: detached ordered two-point fragments with their hatch-line indices and parametric intervals, retaining positive-length boundary portions.",
    "code": "const result = hatchRegionLines2D({\"region\":{\"outer\":[[0,0],[4,0],[4,4],[0,4]],\"holes\":[]},\"origin\":[0,0],\"direction\":[1,0],\"spacing\":2,\"phase\":1,\"maxWork\":100000,\"maxOutputPaths\":10});\nconsole.log(result);",
    "tryThis": "Rotate direction without changing the region, or replace the outer shape and keep hatch spacing.",
    "pitfalls": [
      "Clipping is against supplied polygon edges, not a raster mask.",
      "Holes must satisfy the strict region contract."
    ]
  },
  "export.svg-plot-plan-01": {
    "title": "Export paths as a simple SVG plot",
    "summary": "Turn explicit line paths into a small millimeter-based SVG document.",
    "useWhen": "Scale your geometry to physical units first and retain each intended pen lift as a separate path.",
    "inputs": {
      "widthMm": "Positive document width in millimeters.",
      "heightMm": "Positive document height in millimeters.",
      "paths": "Ordered polylines of finite [x,y] millimeter coordinates.",
      "strokeWidthMm": "Positive displayed stroke width in millimeters.",
      "maxOutputBytes": "Hard UTF-8 output byte cap, including document markup."
    },
    "output": "{svg}: deterministic SVG text with one path element per supplied polyline.",
    "code": "const result = svgPlotPlan01({\"widthMm\":10,\"heightMm\":5,\"paths\":[[[0,0],[10,5]]],\"strokeWidthMm\":0.2,\"maxOutputBytes\":1000});\nconsole.log(result);",
    "tryThis": "Export the same hatch geometry at a different physical scale without rerunning clipping.",
    "pitfalls": [
      "No travel optimization, device commands, tool offsets or fabrication guarantee.",
      "The caller owns saving the returned string."
    ]
  },
  "graph.insert-segment-bridge-2d": {
    "title": "Connect an embedded line network",
    "summary": "Insert a bridge between adjacent intersections and preserve stable graph ancestry.",
    "useWhen": "Supply a candidate segment through an existing valid embedding; select the gap to connect.",
    "inputs": {
      "graph": "Stable node/edge IDs, node points, edge endpoints and next-ID counters; graph edges must form a valid embedding.",
      "candidate": "Two distinct finite [x,y] endpoints of the search segment.",
      "gapIndex": "Zero-based gap between consecutive distinct hits along the candidate.",
      "maxNodes": "Hard retained-node cap; exceeding it fails without publishing partial state.",
      "maxEdges": "Hard retained-edge cap; exceeding it fails without publishing partial state.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "A new graph with exact hit grouping, split ancestry and the selected connecting edge, or an explicit unchanged outcome.",
    "code": "const result = insertSegmentBridge2D({\"graph\":{\"nodes\":[{\"id\":0,\"point\":[0,-1]},{\"id\":1,\"point\":[0,1]},{\"id\":2,\"point\":[2,-1]},{\"id\":3,\"point\":[2,1]}],\"edges\":[{\"id\":10,\"a\":0,\"b\":1},{\"id\":20,\"a\":2,\"b\":3}],\"nextNodeId\":4,\"nextEdgeId\":21},\"candidate\":[[-1,0],[3,0]],\"gapIndex\":0,\"maxNodes\":6,\"maxEdges\":5,\"maxWork\":53});\nconsole.log(result);",
    "tryThis": "Change the candidate direction while holding the old network, then style old and newly split edges separately.",
    "pitfalls": [
      "Overlapping segments and representation-collapsed intersections fail explicitly.",
      "This operation does not generate a road layout or find planar faces."
    ]
  },
  "spatial.relative-neighborhood-pairs-2d": {
    "title": "Connect local neighbors without a radius",
    "summary": "Build a proximity graph using the empty-lune rule.",
    "useWhen": "Reuse the returned pairs for lines, graph motion or another mark treatment.",
    "inputs": {
      "points": "Supplied finite [x,y] positions in canvas or chosen world units.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "{pairs}: ordered point-index pairs whose strict relative-neighborhood lune contains no third point.",
    "code": "const result = relativeNeighborhoodPairs2D({\"points\":[[0,0],[9,3]],\"maxWork\":2});\nconsole.log(result);",
    "tryThis": "Change point positions while keeping the same rule, then draw the same graph with different ink.",
    "pitfalls": [
      "Equal-distance boundary points do not block an edge.",
      "Exact distance comparisons may need cubic work; this is not a spatial-index performance claim."
    ]
  },
  "motion.threshold-edge-relaxation-2d": {
    "title": "Relax long graph edges",
    "summary": "Move connected points toward each other only when their edge exceeds a threshold.",
    "useWhen": "Supply graph pairs and optional pinned points independently from the line renderer.",
    "inputs": {
      "points": "Supplied finite [x,y] positions in canvas or chosen world units.",
      "pairs": "Unique [i,j] indices with i<j, in strict lexicographic order; the caller chooses the graph.",
      "pinned": "One boolean per point; pinned outputs stay fixed after force accumulation.",
      "minLength": "Edges at or below this length do not contribute.",
      "stepScale": "Scale of the reciprocal unit edge contributions in this logical step.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "Detached new positions from a synchronous old-state edge traversal.",
    "code": "const result = thresholdEdgeRelaxation2D({\"points\":[[0,0],[2,0],[0,5]],\"pairs\":[[0,1],[0,2]],\"pinned\":[false,false,false],\"minLength\":0,\"stepScale\":1,\"maxWork\":5});\nconsole.log(result);",
    "tryThis": "Pin boundary points, change minLength, or swap the graph while preserving the same positions.",
    "pitfalls": [
      "No mass, rest-length spring or collision barrier is implied.",
      "A graph edit and a style edit are separate choices."
    ]
  },
  "motion.elastic-curve-grow-step-2d": {
    "title": "Grow elastic curves without crossing",
    "summary": "Expand material rest lengths and refine curves while testing the final embedding.",
    "useWhen": "Retain stable curve state across explicit logical steps; draw its nodes or edges with your own marks.",
    "inputs": {
      "state": "Stable nodes, velocities, pins, ordered curves, material rest lengths/turns and next-ID counters.",
      "restGrowth": "Per-curve edge growth inputs in the exact state order.",
      "turnRates": "Per-curve bend-target changes in the exact state order.",
      "externalAccelerations": "One external vector per node, independent of internal stretch/bend/contact forces.",
      "stretchStiffness": "Strength of axial rest-length response.",
      "bendStiffness": "Strength of rest-turn response.",
      "contactRange": "Range of nonincident edge repulsion.",
      "contactStrength": "Repulsion strength within contactRange.",
      "damping": "Per-step multiplier on updated velocities.",
      "dt": "Strictly positive explicit time step.",
      "maxSpeed": "Velocity magnitude cap before movement.",
      "maxSegmentLength": "Refine longer final segments by stable midpoint splitting.",
      "maxNodes": "Hard retained-node cap; exceeding it fails without publishing partial state.",
      "maxEdges": "Hard retained-edge cap; exceeding it fails without publishing partial state.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit.",
      "maxBacktracks": "Bound on global movement-halving attempts used by the embedding barrier."
    },
    "output": "{state,events,acceptedMotionScale}: updated retained state, stable split events and the accepted global movement scale.",
    "code": "const result = elasticCurveGrowStep2D({\"state\":{\"nodes\":[{\"id\":0,\"position\":[0,0],\"velocity\":[0,0],\"pinned\":false},{\"id\":1,\"position\":[1,0],\"velocity\":[0,0],\"pinned\":false},{\"id\":2,\"position\":[2,0],\"velocity\":[0,0],\"pinned\":false}],\"curves\":[{\"id\":0,\"closed\":false,\"nodeIds\":[0,1,2],\"edgeIds\":[10,11],\"restLengths\":[1.0,1.0],\"restTurns\":[0]}],\"nextNodeId\":3,\"nextEdgeId\":12},\"restGrowth\":[[0,0]],\"turnRates\":[[0]],\"externalAccelerations\":[[0,0],[0,0],[0,0]],\"stretchStiffness\":1,\"bendStiffness\":1,\"contactRange\":0,\"contactStrength\":0,\"damping\":1,\"dt\":1,\"maxSpeed\":100,\"maxSegmentLength\":100,\"maxNodes\":3,\"maxEdges\":2,\"maxWork\":60,\"maxBacktracks\":0});\nconsole.log(result);",
    "tryThis": "Change growth independently from external forcing, or restyle the same retained geometry.",
    "pitfalls": [
      "The barrier tests final geometry, not swept continuous collisions.",
      "Refinement does not claim physical conservation of mass or energy."
    ]
  },
  "simulation.project-periodic-velocity-2d": {
    "title": "Reduce divergence in a looping flow",
    "summary": "Project a periodic staggered velocity grid with a bounded pressure solve.",
    "useWhen": "Use before advecting dye or texture through a flow with explicitly supplied forcing.",
    "inputs": {
      "columns": "Positive number of cells across the periodic unit-cell grid.",
      "rows": "Positive number of cells down the periodic unit-cell grid.",
      "u": "Row-major horizontal face velocities at (column+0.5,row), in cells per time unit.",
      "v": "Row-major vertical face velocities at (column,row+0.5), in cells per time unit.",
      "iterations": "Number of weighted-Jacobi pressure iterations; zero still performs the declared diagnostics.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "Corrected face velocities, pressure and before/after divergence diagnostics.",
    "code": "const result = projectPeriodicVelocity2D({\"columns\":2,\"rows\":1,\"u\":[3,-3],\"v\":[0,0],\"iterations\":1,\"maxWork\":8});\nconsole.log(result);",
    "tryThis": "Increase solver iterations while keeping the input velocity, then inspect residual divergence.",
    "pitfalls": [
      "Finite iterations do not guarantee exact incompressibility.",
      "The grid wraps in both axes and uses unit cell spacing."
    ]
  },
  "field.advect-periodic-scalar-2d": {
    "title": "Carry dye through a periodic flow",
    "summary": "Backtrace scalar samples through supplied face velocities with bilinear sampling.",
    "useWhen": "Transport dye, a texture channel or velocity components at their explicit grid offset.",
    "inputs": {
      "columns": "Positive number of cells across the periodic unit-cell grid.",
      "rows": "Positive number of cells down the periodic unit-cell grid.",
      "values": "Supplied row-major scalar samples: dye, texture or another scalar channel.",
      "u": "Row-major horizontal face velocities at (column+0.5,row), in cells per time unit.",
      "v": "Row-major vertical face velocities at (column,row+0.5), in cells per time unit.",
      "offset": "Sample offset [x,y] within the unit cell: [0,0] for dye, [0.5,0] for u, [0,0.5] for v.",
      "dt": "Nonnegative time step in the velocity time unit; zero returns a validated copy.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "{values}: a new periodic scalar field after one semi-Lagrangian transport step.",
    "code": "const result = advectPeriodicScalar2D({\"columns\":3,\"rows\":1,\"values\":[1,2,3],\"u\":[1,1,1],\"v\":[0,0,0],\"offset\":[0,0],\"dt\":1,\"maxWork\":9});\nconsole.log(result);",
    "tryThis": "Replace the initial texture while keeping velocity, or change the flow without changing the color map.",
    "pitfalls": [
      "Bilinear transport is dissipative and not exactly mass-conserving.",
      "This operation does not generate velocity or apply a pressure solve."
    ]
  },
  "field.diffuse-periodic-scalar-2d": {
    "title": "Spread and fade a scalar field",
    "summary": "Apply one periodic four-neighbor diffusion step and explicit retention.",
    "useWhen": "Soften dye or another scalar field independently from transport and drawing.",
    "inputs": {
      "columns": "Positive number of cells across the periodic unit-cell grid.",
      "rows": "Positive number of cells down the periodic unit-cell grid.",
      "values": "Supplied row-major scalar samples: dye, texture or another scalar channel.",
      "rate": "Neighbor diffusion coefficient from zero through 0.25.",
      "retention": "Post-diffusion scalar multiplier from zero through one.",
      "maxWork": "Explicit computation budget. See the operation contract for its event formula; this is not a millisecond limit."
    },
    "output": "{values}: detached row-major field after the explicit diffusion/retention step.",
    "code": "const result = diffusePeriodicScalar2D({\"columns\":3,\"rows\":3,\"values\":[0,0,0,0,1,0,0,0,0],\"rate\":0.125,\"retention\":1,\"maxWork\":9});\nconsole.log(result);",
    "tryThis": "Compare rate and retention separately: one redistributes values, the other scales them.",
    "pitfalls": [
      "At rate0.25 a checkerboard can oscillate rather than strictly smooth.",
      "This is an explicit unit-grid step, not an unconditionally stable continuous solver."
    ]
  }
};
