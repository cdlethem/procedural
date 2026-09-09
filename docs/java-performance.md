# Keep compositions responsive

Separate generating geometry, drawing it, and displaying the completed image. Retain the
results you want to preserve. Recompute a stage when its inputs change; a color edit usually
needs a redraw, while a changed clipping boundary needs new clipped geometry.

| What changed? | What to recompute |
| --- | --- |
| Palette, stroke width or endpoint decorations | Draw retained geometry again; keep paths, source identities and layout. |
| Clipping polygon or source strokes | Run `SegmentClip2D.clip` again, then redraw. |
| Region arrangement | Recompose the regions; reuse expensive source images when their content is unchanged. |
| Image used to control marks | Resample that image at the retained positions; keep the layout if it has not changed. |
| Blur kernel | Filter the source again; retain the source image. |
| Transition mask between two filtered images | Recombine the retained images; keep both filtered results. |
| Spring targets | Advance the existing spring state explicitly; preserve topology if the composition calls for fixed connections. |

These are composition choices, not an automatic dependency system. The examples make the
retained objects and rebuild calls visible. [ClipMarks](clip-marks.md),
[BlurMarks](blur-marks.md), [LayerMarks](layer-marks.md) and
[PointerMarks](pointer-marks.md) demonstrate the respective choices.

## Traverse retained values without making a new object for each mark

Where available, use the `Into` accessors with a reusable destination array.
`RegularGrid.pointInto`, `SegmentClip2D.segmentInto` and
`TargetSprings2D.positionInto` write into caller-owned storage. Their `At` alternatives
return detached values, which are convenient when you need to keep an individual result.
Consult each class reference for its destination size and index/error rules.

Keep passive configuration maps and exported `toValues()` records outside drawing loops
when the inputs are unchanged. Detached exports are useful for transport and inspection;
repeatedly exporting a complete result creates avoidable copies.

For a static composition, retain the completed `PImage` for display and save. Region
callbacks borrow the active drawing target: draw into it and return, without retaining
it or calling its lifecycle methods. Prepare simulation state and random geometry outside
those callbacks when redraws should preserve them.

## Set budgets for the work you actually intend

Valid numeric limits describe representability, not a recommended canvas or batch size.
Choose finite counts and explicit work/output allowances from the intended composition.
For clipping, the work charge is `V² + S × (8V² + 16V + 8)`, where `V` is polygon vertices
and `S` is supplied segments. Even an empty segment list pays for polygon validation.
The independent output allowance bounds retained pieces, which can outnumber source strokes
when a concave boundary splits them.

Blur's `maxSamples` charges pixels times the sum of the horizontal and vertical kernel
lengths. Increasing image dimensions therefore increases filtering work even when the
kernels stay the same. These allowances are neither heap limits nor elapsed-time deadlines.
Raster region composition also needs temporary image buffers; many regions and large
canvases should be measured together in the actual composition.

## Read measurements at their stated scope

The [clipping measurement](../evidence/conformance/segment-clip-performance.json) on the
recorded desktop JDK used an eight-vertex polygon and three measured calls after warmup:

| Supplied strokes | Retained pieces | Measured time per call | Thread-allocated bytes per call |
| --- | --- | --- | --- |
| 100 | 166 | 2.10–2.37 ms | 4,826,408 |
| 1,000 | 1,666 | 17.47–25.95 ms | 80,825,152–80,825,600 |

Input construction and checksum traversal are excluded. Allocation counts include temporary
objects, not just the retained output, and do not measure peak heap. This supports using
clipping when geometry changes and retaining its output; it does not promise frame rates.
Different vertex counts and coordinate arithmetic can change the cost substantially.

Other scoped records cover [triangulation](../evidence/performance/cp9-java.json),
[springs](../evidence/performance/cp10-java.json),
[lattice paths](../evidence/performance/cp11-java.json),
[filtering](../evidence/conformance/separable-blur-performance.json),
[disc projection](../evidence/conformance/disc-projection-performance.json) and
[annular meshes](../evidence/conformance/annular-mesh-performance.json).
These records bind particular sources and workloads; some precede documented source
revisions. They are observations, not a uniform benchmark of the entire current package.
Measure the complete native sketch when making interactive performance decisions: geometry,
image transport, rendering and display are different costs. Desktop core results do not
establish Android performance.
