# Clip field-generated paths to a region

PathClipMarks is included in Java0.33.0. It connects existing path generation, segment
clipping and layer rendering; see the [distribution review](../evidence/distribution/path-clip-java-review.json).

Generate your movement first. The example retains six `GradientPath2D` results, converts
each consecutive pair of positions into a supplied segment, then calls `SegmentClip2D`.
Changing the notch clips those same segments again. It does not restart the field or
change where the paths travel outside the visible region.

Press N to change the notch, C to color by original path, O to reveal the unclipped
movement faintly, 0 to reset the view, and S to save the cached result. Color and overlay
changes reuse the clipped geometry.

The connection between these operations is explicit data. `sourceToPath` and `sourceToStep`
map each supplied segment back to its generating path. Each clipped piece's
`sourceIndexAt` recovers that identity, even when one supplied segment yields multiple
pieces. Use it to attach your own path colors or step-dependent marks. Draw each returned
piece separately: joining successive output pieces can draw across excluded gaps.

Replace the path generator with another source of positions while keeping the same
conversion and clipping stages. Or keep the full paths and reveal their rendered image
through a mask when you only need visibility, rather than reusable clipped geometry.
Clipping trims mathematical centerlines; painted stroke width can extend past the edge.
The boundary does not steer movement or make paths avoid obstacles.

The seed, six starts,160 steps per path and all other settings describe this example.
They are not library defaults or recommended ranges. Clipping is computed on structural
edits and cached for drawing; see [performance guidance](java-performance.md).
