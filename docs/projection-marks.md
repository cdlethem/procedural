# ProjectionMarks — sequential deformation

Make a contour or line family yield to local circular influences. Supply existing points,
ordered discs and an explicit strength to DiscProjection2D. Inside each disc, the operation
moves a point toward that disc's radial boundary before testing the next disc.

The example is `packages/java-processing/examples/ProjectionMarks/ProjectionMarks.pde`.
It is included in the accepted Java0.30 distribution, with native and extracted-package validation.

- **M** cycles fractional, full and zero-strength deformation.
- **O** reverses influence order while preserving the points and discs.
- **C** recolors the retained result.
- **S** saves the display cache.

The example computes six strength/order results once, then switches among them. Both a
closed sampled contour and open parallel lines use the same operation. Point generation,
line grouping and drawing remain independent; replace the supplied points with positions
from another package operation without replacing the deformation arithmetic.

The thin reference lines show the input geometry and circles show supplied influences.
Full strength can concentrate samples onto a boundary. A later influence can push a point
back inside an earlier disc, and straight segments between projected samples can cross a
disc. This is not clipping or guaranteed collision avoidance. An exact-center point uses
positiveX as an explicit direction convention. No recommended strength range is claimed.

Motivation: [colidion](../survey/out/2019/generativos/colidion/notes.md), with an independently
specified portable transform. Its owner-ray recovery, radial stipple envelope and full
composition are not reproduced. See the [contract](../catalog/operations/sequential-disc-projection-2d.json)
and [native acceptance plan](../design/capabilities/projection-marks-native-plan.md).
