# Build with the expanded p5 gallery

Open a study in the gallery, edit its controls, then add it to Studio to combine it with
other layers. The source view contains the actual drawing function. Each operation accepts
explicit data and returns reusable geometry, colors, tokens or grid state; p5 draws the result.

| What you want to draw | Operations to start with | Gallery studies |
| --- | --- | --- |
| Softer paths, clearer gestures and parallel outlines | Chaikin refinement, polyline simplification, signed offsets | Rounded panels, Gesture skeletons, Road margins |
| Point-cloud boundaries and colored silhouettes | Convex hull, simple-polygon triangulation | Scatter envelopes, Concave grain |
| Connected fragments and evenly spaced marks | Segment-chain assembly, Poisson-disc sampling | Stitched contours, Spaced symbols |
| Balanced cells, packed rectangles and routed paths | Lloyd relaxation, skyline packing, cost-grid paths | Relaxed stones, Packed posters, Arrival contours |
| Trails following an explicit field | RK4 tracing, scalar-grid curl | Stream ribbons, Swirling particles, Flow needles |
| Growing patterns and interference | Gray–Scott, life-like cells, elementary rows, damped waves | Reaction spots, Organic cells, Woven rows, Ripple interference |
| Branching or repeating symbolic designs | Parallel token rewriting, token turtle | Branching sentences, Turtle canopies, Recursive tiles |
| Compatible tiles and connected networks | Adjacency collapse, seeded depth-first tree | Compatible mosaics, Tiled circuits, Maze gardens |
| Printed texture, outlines and masks | Floyd–Steinberg, Bayer screening, signed convolution, distance transform, morphology | Diffusion engraving, Embossed field, Distance halos, Eroded lace |
| Color transitions and reduced palettes | OKLab ramp, median-cut quantization | Perceptual bands, OKLab orbits, Reduced mosaic |
| Solid silhouettes and smooth strips | Polygon extrusion, parallel-transport ribbon, Loop subdivision | Extruded seals, Transported ribbons, Subdivided shells |

The API pages show complete input examples. Start from a study's source to see how to
initialize the data, choose a work budget, and turn the returned values into drawing commands.
For stateful patterns, keep the returned state and supply it to the next explicit step.
For seeded samplers, keep the returned RNG state when continuing a sequence.

| Editable choice | Canvas effect |
| --- | --- |
| Geometry or grid controls | Change the points, cells, marks or faces produced by the computation |
| Palette | Recolors the composition using the layer's RGB colors |
| Layer position, scale and rotation | Places the whole study within a larger composition |
| Opacity | Lets underlying layers show through |
| Native example T / C / 0 / S | Applies a structural edit, changes palette, restores the baseline, or saves the canvas |

Operations have deliberate boundaries. The polygon tools accept simple boundaries without
holes; offsets do not repair intersections. Adjacency collapse has no backtracking and can
report a contradiction. Grid solvers do not silently stabilize or clamp a chosen timestep.
The mesh studies use editable 2D projection of 3D triangle data. They are useful starting
points for other renderers as well.
