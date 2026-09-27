# Polygon marks

**Center X/Y**, **Source width/height**, **Source sides**, and **Source angle** define a convex placement domain. **Vertex irregularity** alters the source's radial vertices with the seed; if they are no longer strictly convex, the operation rejects that input rather than repairing or silently skipping it. The source is a construction boundary, not an automatically drawn triangular backdrop.

| Controls | What changes on the canvas |
| --- | --- |
| Center X/Y, Source width/height, Source sides, Source angle | Place and reshape the convex domain used to admit proposed marks; it is not a painted background. |
| Vertex irregularity, seed | Vary source vertices. A nonconvex result is rejected instead of being silently repaired. |
| Proposals, Proposal retention | Set how many seeded candidate sites are tried. Retention applies before placement, not to accepted marks. |
| Half length, Mark aspect, Size disorder, Mark angle, Angle spread, Shape | Give candidates independent capsule or diamond dimensions and directions; larger or rotated shapes can fail the boundary or overlap checks. |
| Fill, Outline, Outline weight, palette | Change how accepted marks are painted without resampling or repositioning them. |

**Proposals** and **Proposal retention** decide how many seeded sites are attempted. **Half length**, **Mark aspect**, **Size disorder**, **Mark angle** and **Angle spread** set the proposed capsule or diamond independently of site height. A candidate crossing the source boundary is omitted; the accepted convex-polygon filter greedily removes any candidate touching or overlapping an earlier accepted one. The result can therefore contain fewer marks than proposals, especially at large mark sizes. **Fill** and **Outline** are independent and do not resample the marks.

For a compact diagonal cluster, try Center X 155, Center Y 465, Source width 280, Source height 160, Sides 6, Proposals 100, Half length 8, Aspect .35, Angle 45, Angle spread 25. For a few larger facets, try Center X 435, Center Y 240, Source width 250, Source height 250, Sides 5, Proposals 35, Half length 24, Shape diamond, Retention .5, Fill on and Outline off. High irregularity with many sides may be rejected as concave; use fewer sides or less irregularity rather than treating invalid outlines as a valid domain.
