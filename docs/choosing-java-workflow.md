# Choose a starting point for your sketch

To start from an empty sketch, use the [direct Java API guide](java-api.md), which
includes a complete grid-and-palette example without starter-specific tabs.

Start with the decision you want to make. Each link opens an editable Processing example
and explains its controls. [Build and install the Java library](building-java-from-source.md),
open the named example from Processing's contributed-library examples, and save your own copy.
For combining them, see [composing drawings, partitions and image effects](composing-java-effects.md).

| Your idea | Start here | What the library supplies |
| --- | --- | --- |
| Stop directed strokes at supplied obstacles | [ContactMarks](contact-marks.md) | First contact, hit identity and retained obstacle edits. |
| Fill irregular windows with replaceable drawings or image crops | [MaskedPartitionMarks](masked-partition-marks.md) | Retained masks, local/canvas callbacks and independent layout/content edits. |
| Reveal field-generated paths inside an editable outline | [PathClipMarks](path-clip-marks.md) | Retained path-to-segment conversion, polygon clipping and original-path identity for styling. |
| Trim an existing line drawing to a concave outline | [ClipMarks](clip-marks.md) | Retained clipped segments, source identities and parameter intervals; reuse geometry for styling. |
| Cover a surface with related strokes or bars | [FieldMarks](getting-started.md) | Grid positions and repeatable spatial attributes; replace the drawn mark. |
| Push a contour or line family around local circular influences | [ProjectionMarks](projection-marks.md) | Sequential outward deformation with explicit strength and influence order; retained points for alternate drawing. |
| Bend a grid or closed contour around chosen centers | [PullMarks](pull-marks.md) | Local radius/power edits; retain the computed lines for recoloring or contour drawing. |
| Change a field slice or color a3D form | [DepthMarks](depth-marks.md) | Three-coordinate scalar samples, cached attribute values and retained mesh geometry. |
| Select, split and remove individual rectangle regions | [CutMarks](cut-marks.md) | Supplied-coordinate cuts with stable live IDs; retain unrelated regions and replace their decoration. |
| Divide a surface into unequal rectangular panels | [PanelMarks](techniques/panel-marks.md) | Attempt-bounded integer-cell cuts with random or longer-axis selection; retain cells for different decoration. |
| Shape a smooth closed outline and place marks along it | [LoopMarks](loop-marks.md) | Retained uniform curves, approximate distance queries and raw tangents. |
| Make lines wander through a field | [PathMarks](path-marks.md) | Connected positions and headings from repeated movement. |
| Keep wandering lines near a noise level | [BandMarks](band-marks.md) | Proposal acceptance inside a scalar band; retain paths for different marks. |
| Scatter differently sized forms with room between them | [PlacementMarks](placement-marks.md) | Seeded circle placements and explicit overlap filtering. |
| Pack supplied noncircular outlines | [PolygonMarks](polygon-marks.md) | Ordered filtering of supplied strictly convex polygons; retain geometry for alternate decoration. |
| Divide a surface into changing rectangular regions | [RegionMarks](region-marks.md) | Retained quadrant subdivisions to fill or decorate independently. |
| Add grain inside a triangle | [GrainMarks](grain-marks.md) | Repeatable points inside supplied geometry. |
| Grow a tree from segment endpoints | [BranchMarks](branch-marks.md) | Retained branching geometry with explicit stopping. |
| Grow fine branches by cutting existing strokes | [CutBranchMarks](cut-branch-marks.md) | Selection, cuts and mutation of a shared line pool. |
| Turn points into connected facets | [FacetMarks](facet-marks.md) | Delaunay triangles for fills, edges and grain. |
| Make paths that avoid occupied grid cells | [LatticeMarks](lattice-marks.md) | Retained occupied-cell routes. |
| Pull an arrangement with pointer input | [PointerMarks](pointer-marks.md) | Supplied-target springs with replay and retained initial connectivity. |
| Draw tapered bodies along a field | [BodyMarks](body-marks.md) | Backward field paths and headings, retained across body/centerline and taper edits. |
| Give an arrangement spring motion | [SpringMarks](spring-marks.md) | Explicit target-driven stepping and replay. |
| Build a ring with inner and outer walls | [AnnularMarks](annular-marks.md) | Retained annular triangles and normals; independent width, depth, facets and appearance. |
| Build a three-dimensional form from a radius profile | [ProfileMarks](profile-marks.md) | Indexed ring surfaces and caps from an axial profile. |
| Use letters as repeated marks along a path | [GlyphMarks](glyph-marks.md) | Path-based placement with an explicit font in the native example. |
| Build clustered relief | [ReliefMarks](relief-marks.md) | A composition of existing subdivision and triangulation operations. |
| Compose a faceted city | [CityMarks](city-marks.md) | A working 3D composition using shared operations. |
| Layer a banded landscape | [LandscapeMarks](landscape-marks.md) | A working composition of retained regions and marks. |
| Bend an already drawn pattern | [WarpMarks](warp-marks.md) | Bilinear raster sampling from supplied displacement coordinates. |
| Fill partitions with local drawings or windows onto a larger image | [LayerMarks](layer-marks.md) | Independent region layout, content callbacks, coordinate origins and feathered visibility. |
| Fit a picture or selected snippet into a frame | [PlacementImageMarks](placement-image-marks.md) | Explicit crop, contain/cover/stretch and alignment; reuse the placed layer with masks. |
| Reveal different drawings through the same shapes | [MaskMarks](mask-marks.md) | Retained transparent layers, reusable alpha masks and explicit two-content crossfades. |
| Let an image control mark size, visibility or color | [ImageFieldMarks](image-field-marks.md) | Retained image sampling at supplied positions; independent alpha and maximum-RGB attributes. |
| Soften a drawing and blend it with its sharp version | [BlurMarks](blur-marks.md) | Independent horizontal/vertical kernels, transparent image filtering and retained masked transitions. |
| Decide where colors transition | [RampMarks](ramp-marks.md) | Unequally spaced color stops, independent of geometry. |
| Recreate the Curvespace composition | [Curvespace recreation guide](curvespace-recreation.md) | A separately maintained P2D example using accepted operations; it is not packaged as a shipped starter. |

For your first session, choose one example, run it unchanged, make one structural edit,
then change its palette or mark. Save each result. [Compare saved variants](comparing-variants.md)
with a contact sheet before changing several controls together.

A **reusable operation** computes values: positions, paths, colors, topology or updated state.
A **starter** is a complete sketch that combines those values with ordinary drawing and
artistic settings. Keep the operation when changing the artwork; replace the surrounding
mark, palette or composition. Several starters use the same operations.

Choose between similar-looking approaches by their behavior. PathMarks advances at every
step; BandMarks can reject a proposed move; LatticeMarks reasons about occupied grid cells.
BranchMarks grows from endpoints; CutBranchMarks revises an existing pool of strokes.
CyclicPalette repeats evenly spaced colors; StopRamp holds endpoints and lets you place
transitions unequally. Those differences matter when you compose the tools.

The examples are useful starting points, not promises of every algorithm in a family.
FacetMarks does not supply Voronoi cells, ProfileMarks is not arbitrary solid extrusion,
and glyph placement is not font-outline extraction or general text shaping. BandMarks
is not a complete contour extractor. Other renderers and language ports have their own
recorded support limits; the links above describe the Java workflows.
