# Choose a starting point for your sketch

Start with the decision you want to make. Each link opens an editable Processing example
and explains its controls. [Build and install the Java library](building-java-from-source.md),
open the named example from Processing's contributed-library examples, and save your own copy.

| Your idea | Start here | What the library supplies |
| --- | --- | --- |
| Cover a surface with related strokes or bars | [FieldMarks](getting-started.md) | Grid positions and repeatable spatial attributes; replace the drawn mark. |
| Bend a grid or closed contour around chosen centers | [PullMarks](pull-marks.md) | Local radius/power edits; retain the computed lines for recoloring or contour drawing. |
| Change a field slice or color a3D form | [DepthMarks](depth-marks.md) | Three-coordinate scalar samples, cached attribute values and retained mesh geometry. |
| Divide a surface into unequal rectangular panels | [PanelMarks](techniques/panel-marks.md) | Attempt-bounded integer-cell cuts with random or longer-axis selection; retain cells for different decoration. |
| Shape a smooth closed outline and place marks along it | [LoopMarks](loop-marks.md) | Retained uniform curves, approximate distance queries and raw tangents. |
| Make lines wander through a field | [PathMarks](path-marks.md) | Connected positions and headings from repeated movement. |
| Keep wandering lines near a noise level | [BandMarks](band-marks.md) | Proposal acceptance inside a scalar band; retain paths for different marks. |
| Scatter differently sized forms with room between them | [PlacementMarks](placement-marks.md) | Seeded circle placements and explicit overlap filtering. |
| Divide a surface into changing rectangular regions | [RegionMarks](region-marks.md) | Retained quadrant subdivisions to fill or decorate independently. |
| Add grain inside a triangle | [GrainMarks](grain-marks.md) | Repeatable points inside supplied geometry. |
| Grow a tree from segment endpoints | [BranchMarks](branch-marks.md) | Retained branching geometry with explicit stopping. |
| Grow fine branches by cutting existing strokes | [CutBranchMarks](cut-branch-marks.md) | Selection, cuts and mutation of a shared line pool. |
| Turn points into connected facets | [FacetMarks](facet-marks.md) | Delaunay triangles for fills, edges and grain. |
| Make paths that avoid occupied grid cells | [LatticeMarks](lattice-marks.md) | Retained occupied-cell routes. |
| Give an arrangement spring motion | [SpringMarks](spring-marks.md) | Explicit target-driven stepping and replay. |
| Build a three-dimensional form from a radius profile | [ProfileMarks](profile-marks.md) | Indexed ring surfaces and caps from an axial profile. |
| Use letters as repeated marks along a path | [GlyphMarks](glyph-marks.md) | Path-based placement with an explicit font in the native example. |
| Build clustered relief | [ReliefMarks](relief-marks.md) | A composition of existing subdivision and triangulation operations. |
| Compose a faceted city | [CityMarks](city-marks.md) | A working 3D composition using shared operations. |
| Layer a banded landscape | [LandscapeMarks](landscape-marks.md) | A working composition of retained regions and marks. |
| Bend an already drawn pattern | [WarpMarks](warp-marks.md) | Bilinear raster sampling from supplied displacement coordinates. |
| Decide where colors transition | [RampMarks](ramp-marks.md) | Unequally spaced color stops, independent of geometry. |

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

For noncircular packing, use [PolygonMarks](polygon-marks.md): supply convex outlines,
filter overlaps, then edit thickness or replace rounded shapes with diamonds.
