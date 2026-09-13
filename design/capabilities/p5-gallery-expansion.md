# p5 gallery expansion

Root design decision, 2026-09-13. The maintainer explicitly requests more p5.js
operations and gallery studies, including designs outside the survey. This batch
uses independent specifications: no survey candidate is reassigned, no source code
is copied, and no original-sketch recreation credit is claimed. Java, py5 and Android
are deferred. `independent_design` admission records this provenance honestly.

| Operation | Artist task and computation removed | Alternative and reusable output | Meaningful edit and transfer |
|---|---|---|---|
| Voronoi cells | Divide a canvas into nearest-site mosaic regions without implementing half-plane intersection | Delaunay returns triangles, rectangle partitions cannot produce nearest-site polygons; return one bounded polygon per supplied site | Move sites or change their distribution; reuse polygons as stained glass fills or nested outlines |
| Polyline resampling | Space stitches or repeated marks evenly along an explicit angular/open path without writing cumulative-length lookup | Closed spline changes geometry and requires cyclic controls; return points, traveled distances and source segment indices | Change sample count independently of source corners; transfer from stitched waves to beaded orbit paths |
| Marching squares | Extract contour lines from a sampled scalar field without implementing cell classification, edge interpolation and saddle topology | Noise paths integrate a direction field rather than extract level sets; return independent segments and source cell indices | Edit threshold independently of field resolution; transfer from terrain contours to interacting blob contours |

Six original design studies are planned: cell-mosaic, cell-echoes, stitched-paths,
orbit-beads, contour-terrain and contour-blobs. These are composition demonstrations,
not six corpus recreations. Before this batch these computations require caller
algorithms; afterward only passed and visually reviewed studies count as demonstrated.
General polygon Boolean operations, robust arbitrary-precision Voronoi topology,
contour stitching/filling, grammar rewriting and text shaping remain outside scope.

Inputs and outputs are plain data with explicit ordering, no ambient RNG/noise/time,
no dependencies and no hidden rendering. Example field/site/path construction is
ordinary drawing composition; the nontrivial algorithms live in the operations.
All public fields are design choices, not measured corpus ranges. Required parameters
have no library defaults or encouraged ranges. UI limits are study execution budgets.
Each call has an explicit maxWork budget; geometry remains detached and failures atomic.
Costs and precise semantics are in the three catalog entries.

Root reviews analytical fixtures before delegation and implementation and native images
before support acceptance. An independent architecture challenge is recorded in the
contract review. Native evidence is scoped to p5 Canvas2D and the selected studies;
no cross-target or exact-pixel guarantees follow.
