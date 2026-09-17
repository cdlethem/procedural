# Implicit Volumes

Build a soft welded form and a vessel with a visible cut, then turn the view to see how their silhouettes and depth change. The [editable p5 study](../packages/javascript/examples/implicit-volumes/index.html) queries a bounded CPU field for every camera ray. It uses the resulting hit positions and estimated normals for ordinary canvas color and light; the operation supplies no camera, material, GPU shader or mesh.

| Control or editable value | Effect on canvas |
| --- | --- |
| **Blend edge** / `smoothUnion.k` | Switch the left form between a soft join and a hard seam; changing `k` widens or narrows the blend. |
| **Open cut** / difference node | Reveal or fill the narrow slit in the right vessel. Edit the subtracting box to move or reshape the opening. |
| **Rotate view** / eye and ray directions | Turn the camera around the same geometry, changing overlap and visible depth. |
| **Perforated shell** / `implicitVolumes.setScene(scene)` | Replace the scene tree with a distinct shell and two openings. The supplied-scene method also accepts your own passive typed tree. |
| Light, stripe and background expressions in `sketch.js` | Change surface color and emphasis without changing the query records. |
| Raster width/height, `maxSteps`, `maxDistance`, `maxRays`, `maxSceneNodes`, `maxWork` | Trade resolution and search range against a deterministic CPU work reservation. |
| `hitEpsilon`, `normalStep` | Set the approximate hit threshold and the scale of the central-difference normal estimate. |

**Reset** restores the original scene and view; **Save PNG** downloads the currently displayed canvas. The core call is `raymarchImplicitRays3D({scene,rays,maxDistance,hitEpsilon,normalStep,maxSteps,maxRays,maxSceneNodes,maxWork})`. It returns one record per ray with a hit or miss category, sampled travel and position, field value, optional estimated normal, overshoot flag and sample counts. A miss retains its last sampled position and depth is `null`; an inside-start hit has distance zero. The native study uses these records to check silhouette occupancy, depth variation, edits and a separately supplied shell.

The typed scene supports sphere and axis-aligned box leaves, union, intersection, difference, polynomial smooth union and positive uniform scale with translation. No transform can turn a sphere into an ellipsoid; the example uses a tall box for an anisotropic silhouette. A field sample gives an approximate surface decision under finite steps and binary64 arithmetic, not an exact intersection. At sharp corners and CSG ties, the operation reports an undefined normal, which the study shades with a fallback tone. Inputs and outputs are detached passive data.

This technique is motivated by the distance-field family summarized in the [external art expansion plan](external-art-p5-expansion-plan.md#h-real-3d-presentation-then-implicit-geometry). The study demonstrates reusable field queries and editable presentation. It does not produce a GPU render or extracted mesh.
