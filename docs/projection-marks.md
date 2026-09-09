# Bend lines around circular influences

A contour and a family of straight lines bend toward the boundaries of several circles. The
original lines remain faintly visible, making the deformation easy to compare.

[Install the Java library](building-java-from-source.md), then open **ProjectionMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| M | Cycle between partial movement, full movement toward circle edges, and the original drawing. |
| O | Apply the circles in the opposite order, changing how overlapping influences bend the drawing. |
| C | Switches the projected-line color. |
| S | Saves the displayed image. |

Supply your own points and ordered circles, then draw the returned points as contours, lines,
or marks. Keep point grouping and drawing outside the projection so the same deformation can
serve several visual treatments. The example precomputes the strength and order combinations,
then switches among them.

Circle order matters. A later circle can move a point back inside an earlier one, and straight
segments between projected samples can cross a circle. This is a deformation tool, not clipping
or collision avoidance. A point exactly at a circle center uses the positive-x direction. See
the [projection API](../catalog/operations/sequential-disc-projection-2d.json) and [Java
performance guidance](java-performance.md) for advanced detail.
