# PullMarks: bend grids and contours with radial influences

PullMarks is the Java 0.22 workflow for localized radial folds, built on `RadialPull2D`. It starts with a retained grid of sample points and three
sampled closed contours. Two radial influences transform those samples, and the sketch
then draws the resulting polylines. The field stores only influence data. The sketch retains transformed values so drawing
choices can be changed without rebuilding the deformation.

| Key | Edit |
| --- | --- |
| R | Change the influence radius from the authored 120 to 180 and rebuild outputs. |
| P | Change power from the authored 2 to 0.5 and rebuild outputs. |
| C | Change the palette while retaining the field and transformed values. |
| M | Draw the retained transformed closed contours instead of the grid. |
| 0 | Restore radius 120, power 2, the first palette, and grid mode. |
| S | Save the cached displayed frame to `pull-marks.png`. |

Change the centers by editing the influence descriptor in `rebuildFieldAndOutputs()`:

```java
double[][] influences = {
    {200.0, 240.0, 120.0, 2.0},
    {350.0, 320.0, 120.0, 2.0}
};
RadialPull2D field = RadialPull2D.create(influences);
double[] target = new double[2];
field.transform(260.0, 240.0, target);
// target contains the transformed x and y coordinates.
```

The typed field accepts explicit `[centerX, centerY, radius, power]` rows. The field is
immutable and detached from constructor inputs; `transform(x, y, target)` reuses a caller buffer and commits both
coordinates only after validation and arithmetic succeed. The object does not generate
centers, sample a grid, draw, or retain query history. Sampling the grid and the
`ClosedSpline2D` contours is ordinary sketch work. PullMarks transfers the same sampled
contour values into a later closed-contour drawing mode; it does not add polygon filling,
topology construction, inverse deformation, or smoothness guarantees.

At an exact influence center that influence contributes zero. The nearby field is
still discontinuous under this rule, so sampled lines can fold and self-intersect. Coarse
sampling can hide or exaggerate those changes. Radius endpoints contribute zero. Multiple
influences are applied to the original query and their displacement contributions are
summed in supplied order; they are not sequential point updates.

The radius, power, two centers, 512-pixel canvas, contour count, and sampling densities are
authored example settings, not recommended ranges. The [RadialPull2D contract](../design/operations/radial-pull-contract.md)
defines the exact arithmetic and validation. The independently composed workflow is
motivated by the radial pulls in [`curvespace`](../survey/out/2018/Generativos/curvespace/notes.md);
it does not replay that source or claim pixel reproduction.
