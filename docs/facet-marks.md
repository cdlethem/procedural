# FacetMarks: turn sites into fill, wire, or grain

FacetMarks begins with sites rather than a shape. `FacetComposition` retains a
`Delaunay2D` mesh from those sites, then retains one `TrianglePoints2D` batch for
each final face. The Processing tab can draw the same composition as filled
facets, unique wire edges, or points inside each facet. Changing a palette or
mark treatment does not re-triangulate or re-sample the result.

This editable Java-only workflow has passed native Processing execution and
visual review. See the [installation guide](installing-facet-marks.md) for the
package and checkout paths. Other target ports remain deferred.

## Choose a source of sites

The default source makes 128 sites in a disc centred at `(320,320)` with radius
240. `N` selects 512 sites. The editable `FacetComposition.discSites` creates a
new `java.util.Random(seed)`, consumes angle before radius for each site, and
uses a square-root radius expression. That is an authored example stream, not the
portable stream of any core operation and not an exact replay of `datata`.

`X` replaces the disc source with centres of retained `QuadrantPartition2D`
leaves. Coarse mode uses 42 replacements (127 centres); fine mode uses 170
replacements (511 centres). This is a useful way to turn RegionMarks structure
into facets. It is not a claim to reproduce `lightcity`'s prisms, windows, camera,
or imported triangulator.

The triangulator covers the convex hull of the supplied sites. The disc is only
how this example chooses points: it does not clip triangles to a circle, and the
helper does not expose a hidden circle-mask option. The hull has straight edges
between its outermost sites rather than following the circular boundary.

## Draw the retained result

Open the editable [FacetMarks.pde](../packages/java-processing/examples/FacetMarks/FacetMarks.pde)
and [FacetComposition.java](../packages/java/examples/FacetMarks/FacetComposition.java)
tabs. The composition returns `mesh()`, `grainAt(face)`, and `grainCount()`.
The PDE uses reusable buffers with `triangleInto`, `edgeInto`, `edgeFacesInto`,
and `pointInto`; it draws each retained edge once in wire mode.

| Key | Edit | Retained geometry |
| --- | --- | --- |
| `M` | Filled faces, wire edges, or grain points | Retains mesh and every grain batch |
| `C` | Swap palettes | Retains mesh and grain |
| `P` | Show/hide dark site markers | Retains mesh and grain |
| `N` | Coarse/fine site count | Rebuilds sites, mesh, and grain |
| `X` | Disc sites / quadrant-cell centres | Rebuilds sites, mesh, and grain |
| `R` | Advance the explicit unsigned-32 seed | Rebuilds sites, mesh, and grain |
| `0` | Restore seed 42 and baseline controls | Rebuilds the baseline composition |
| `S` | Save the cached displayed frame | Does not rebuild or redraw |

The face sampler uses `seed = (seed + faceIndex) & 0xffffffff`, so every final
face owns its own retained point batch. Its count is `floor(faceArea * 0.06)`.
The helper preflights a total of 20,000 points before it creates any batches and
uses `maxWork = 50,000,000` for the triangulation. These numbers fit this
640-by-640 piece. They are editable example controls and work guards, not
measured recommended count, density, or budget ranges.

To make a different piece, start by editing the source of sites, the two
coarse/fine counts, or the colour and mark code in the PDE. Keep the mesh and
sampling objects when you only want a new treatment. Change `N`, `X`, or `R`
when you want a new arrangement.

## What this demonstrates

The workflow demonstrates a technique-level composition: caller-supplied sites
become retained connected facets; style can change independently; RegionMarks
centres can substitute for scatter; and a returned face can feed the existing
triangle sampler. It does not promise source-image identity, source random-stream
compatibility, circular clipping, arbitrary polygon constraints, halos, corner
shading, or a complete city renderer.

The motivating reports are [datata](../survey/out/2018/Generativos/datata/notes.md)
and [lightcity](../survey/out/2019/generativos/lightcity/notes.md). Their point
count and density substitutions show that source arrangements and workload can
matter, but they bundle other placement, filtering, randomness, and drawing
choices. They do not establish the example's editable values as general artistic
ranges. The [capability direction](../design/capabilities/cp9-facet-marks-direction.md),
[admission review](../design/capabilities/cp9-admission-review.md), and
[registered acceptance plan](../design/capabilities/cp9-facet-marks-acceptance.md)
record those boundaries and the required native checks. The
[accepted workflow review](../evidence/reproductions/cp9-java2d/root-review.json)
records 18 rendered states, six exact resets and direct inspection of all 12
distinct images. Grain is a light texture here; increase its authored density or
mark weight in your own piece when you want stronger coverage.

For the exact topology, mapping, work-budget, and ownership rules, see the
[Delaunay operation contract](../catalog/operations/delaunay-2d.json). FacetMarks
adds no new operation or rendering API.
