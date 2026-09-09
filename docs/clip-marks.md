# ClipMarks — clip a drawing to a polygon

Included in Java0.32.0. Core, native editing/transfer and extracted-package validation
are accepted in [the CP29 distribution review](../evidence/distribution/cp29-java-review.json).

Use this example to trim an existing line drawing to a concave polygon and keep the
resulting pieces as geometry. The polygon, source strokes and appearance are independent.

| Key | Change |
| --- | --- |
| H | Dense/sparse hatch strokes; remembered while supplied-stroke mode is active. |
| N | Deep/shallow notch in the clipping region. |
| T | Hatch pattern or a supplied zigzag drawing. |
| C | Uniform color or alternating colors chosen by original stroke index. |
| M | Show/hide endpoint marks. |
| O | Show/hide the original unclipped strokes as a faint overlay. |
| 0 | Reset the composition. |
| S | Save the cached displayed image. |

The hatch and zigzag inputs are retained. Region edits clip them again; color, endpoint
marks and overlay reuse the clipped result. Pieces from the same original stroke retain
the same source index even when a notch separates them.

Replace `sources` with segments from your own drawing. For a retained polyline, supply
successive pairs of points. The operation does the intersection, ordering, boundary and
concavity work; the example draws the returned pieces with ordinary Processing calls.

This clips stroke centerlines. A thick line or endpoint dot can extend beyond the visible
region. Apply a raster mask afterward if the entire painted footprint must remain inside.
Photographs and other raster content use the existing image placement/mask workflows.

The fixed dimensions, spacing and resource allowances are example settings, not defaults
or recommended artistic ranges. Work and output limits fail explicitly; they never return
a truncated successful drawing. This example does not claim an original-sketch recreation.

Clipping uses exact rational arithmetic and allocates temporary objects. Compute it when
source geometry or the boundary changes, retain the result, and reuse it for drawing.
The work allowance bounds abstract geometric work; it is not a memory or frame-time promise.
