# Thick regions and plot paths

A centerline becomes a visible band when each point has a width. `taperedStrokeStrip2D` builds that band as a strict filled region, retaining both forward-traversed side boundaries and the join decision at each corner. Open paths can use butt or square caps; closed paths produce one outer ring and one hole when the offset geometry is valid. A rejected strip has an explicit topology result, so a drawing can omit it or let an artist revise its path.

`selectTaperedStrokeStrips2D` visits candidate bands in the supplied order. It keeps a band only when its filled region does not meet an exclusion or an earlier accepted band and its exact boundary clearance reaches the requested gap. An equal gap passes. The returned `visible` regions can be drawn directly or handed to another operation. `regionClearance2D` is available separately when an artist needs the relationship and closest-boundary witness between two strict regions; its edge indices refer to the rings as supplied.

`hatchRegionLines2D` clips parallel two-point fragments to a filled region. A hole splits a line into separate fragments; a positive span on a boundary remains, while a point contact produces no path. `svgPlotPlan01` writes those paths in millimetres, with a new SVG path element for each pen lift. It does not convert to machine commands or establish physical plotter safety.

| Control | Canvas effect |
| --- | --- |
| Centerline points | Move bends and change the band's overall route. |
| Per-vertex widths | Widen or narrow the band at each point; a wide inner corner may make the strip invalid. |
| Cap and join | Change open ends and outer corners. Inner corners are trimmed to their finite side sections. |
| Miter limit | Lets a sufficiently short outer miter replace a bevel; an optional miter that cannot be represented falls back to bevel. |
| Clearance and exclusion regions | Reserve visible space around selected bands, using actual filled boundaries rather than centerline distance. |
| Hatch direction, spacing and phase | Rotate, separate and shift the clipped path fragments. |
| SVG dimensions, stroke width and byte cap | Set the millimetre page and ink width, and bound the resulting document. |

[Guarded bands](../packages/javascript/examples/guarded-bands/) starts with eight varying-width, bending ribbons. Increasing clearance visibly rejects nearby routes; dashed centerlines keep those decisions legible, and a separate ink control leaves the selected geometry fixed. Replace the supplied routes or width arrays to change the structure. [Hatched islands](../packages/javascript/examples/hatched-islands/) clips two angle/spacing fields to an irregular outer contour and two holes. Rotate or densify the fields, substitute a different island, restyle the same fragments, save PNG, or download the exact SVG path stream. The [capability decision](../design/capabilities/thick-regions-and-plotting.md) explains the reusable geometry behind both studies.

All geometric inputs use plain coordinate arrays and explicit work or output caps. Region rings must be simple; holes must be strictly inside and disjoint. These operations use exact comparisons for topology and clearance but return binary64 coordinates. A representation-collapse error means a required positive span or gap disappeared on rounding. No recommended artistic parameter range is inferred from the motivating corpus.
