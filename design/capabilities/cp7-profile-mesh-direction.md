# CP7 architect direction: build a form from a radial profile

Status: root-selected private investigation, not operation admission or a frozen public
signature. Java/Processing is first; Sol review remains paused. Root read all four pinned
sources in [the evidence audit](profile-mesh-evidence-audit.md), plus the decisive
cilindros and fieeee reports. No upstream implementation is copied.

## Artist task and boundary

Start with a striped cylinder, then change a short sequence of axial positions and radii
to make a waisted or pointed form. Keep the same mesh for palette, camera and drawing
changes. Reuse the mesh in a small arrangement of differently transformed objects. The
operation should remove ring construction, seam closure, face connectivity and cap/pole
bookkeeping; the artist supplies the silhouette and controls its appearance.

Investigate an indexed triangle mesh generated from ordered circular rings around local
Z. Each supplied profile point is an axial coordinate and radius. Angular subdivision is
explicit. Endpoint closure is explicit. Return retained positions, triangle indices and
face provenance sufficient to colour by axial band or angular cell and distinguish caps.
The artist must not recover bands by comparing coordinates or infer caps from normals.
Neither colour callbacks nor renderer objects belong in the geometry result.

This is an independently specified generalization. cilindros uses a constant radius and
closed ends; fieeee connects a nonconstant cosine-derived sequence of radii. Neither
returns a retained mesh. Supplied profiles, indexed triangles, deliberate winding, exact
seam identity and face provenance are design choices that need their own validation.

The first prototype uses strictly increasing axial coordinates, positive interior radii,
and nonnegative endpoint radii. A zero-radius endpoint is one pole vertex, not a collapsed
ring of duplicate vertices. Two positive endpoint rings can remain open or be closed by
triangle fans; a pole is already closed and receives no extra cap. This deliberately
bounded profile domain covers cylinders, waisted columns and pointed ends without
pretending to handle arbitrary self-intersecting lathe curves, interior pinches, toroidal
profiles or unequal-height steps. These restrictions remain provisional until the
prototype demonstrates that they enable the intended work.

## What the source does and does not establish

cilindros builds 128 angular cells and 32 axial bands. Its diameter edit also changes
length through the fixed `cilindro(s,s*8)` call. Its colours vary between axial rings,
including fill changes inside a patch. Its two end polygons traverse in the same angular
direction; they do not establish outward cap winding. No explicit normals are supplied.
The library must make a considered winding choice rather than reproduce that ambiguity.

fieeee directly connects adjacent rings with different radii. Its `colum` calls use the
global drawing methods despite an active offscreen texture pass, so the report's claimed
flattening is not established. It colours once per axial band, not once per angular quad.
Changing its single resolution value changes both angular and axial sampling and the
number of random colour draws. Those variants do not isolate a useful angular range.

prueba4 repeats overlapping full-length tube strips; it is not the same contiguous mesh.
cityPink3d emits vertical bands at alternating radii without the sloped connectors. It
does not become equivalent merely because both outputs resemble columns. Existing
candidate dispositions stay unchanged during this investigation; any later admission
must account for these differences explicitly. No whole 3D family is rejected here.

## Alternatives and cost of use

A cylinder-only helper would hide the silhouette decision inside another source-shaped
preset. A point-on-circle helper leaves the difficult topology and closure work to every
caller. A fully generic surface callback brings opaque evaluation, singularities and
portability problems without evidence that this first workflow needs them. A profile
mesh is the useful intermediate boundary to test.

The renderer remains ordinary P3D example code initially. It must consume the retained
geometry, apply explicit transforms and colour, and provide correct visible lighting.
Compare flat facet normals in the prototype before deciding whether shading normals need
a reusable API. Do not silently treat missing normals, a software projection or JAVA2D
output as proof of a P3D workflow. A future adapter must preserve renderer state and
declare its supported geometry/capabilities separately from the pure mesh computation.

The profile should be authored in a few readable lines. The renderer may iterate faces
and submit vertices, but must not regenerate connectivity or special-case each silhouette.
If usable lighting requires substantial mesh algorithms in the example, revise the
boundary before a contract is frozen.

## Private geometry diagnostic before rendering

Use local Cartesian coordinates `(r*cos(theta), r*sin(theta), z)`, with angular order
increasing from +X toward +Y. Share the angular seam by wrapped indices; do not evaluate
a separate 2-pi endpoint. Traverse profile bands then angular cells. For two positive
rings, split each quad along its lower-current to upper-next diagonal. Winding points
outward. Bottom and top fans face -Z and +Z respectively. Pole-adjacent cells produce one
triangle each. Retain band/cell identity and cap kind for every triangle.

Independently check cylinder, waisted profile, frustum, bottom pole, top pole and two-pole
profiles, plus open ends. Check finite positions, index bounds, no repeated indices in a
triangle, nonzero triangle area, outward side/cap orientation, exact wrapped seam
connectivity, counts, edge incidence and Euler characteristic for closed genus-zero
examples. Open examples must have exactly their declared boundary loops. Do not claim
that these moderate fixtures prove robustness for all finite doubles. Extreme arithmetic,
allocation bounds, ownership and target trig tolerances belong to the future contract.

Geometry uses no RNG. Style changes must retain exact geometry. The diagnostic is private
and must not alter delivered operations or create a second public mesh implementation.

## Visual comparison and decision rules

Prepare a registered bounded P3D comparison only after geometry and runtime readiness are
reviewed. The intended comparisons are a constant-radius baseline, one waisted profile,
one pointed profile, lower angular resolution, open versus closed ends, recolouring the
same retained mesh, and a transformed multi-object composition. Profile substitutions
and the composition transfer are design tests, not isolated corpus parameter experiments.
Keep camera and lighting fixed for the profile and angular-resolution comparisons.

Accept the boundary only if silhouette edits are legible, seam/cap/pole geometry is sound,
band colouring needs no topology reconstruction, retained appearance edits preserve
geometry, and one ordinary rendering loop serves all selected profiles. If caps or poles
require renderer-specific geometry repair, fix the generator. If the profile interface
requires an opaque preset dispatcher, simplify the example or revisit the operation.

No library default or encouraged numeric interval is selected. Corpus observations justify
investigation; visible change scores alone do not establish usefulness. Prototype values
will be example configurations. Required subdivision minima and profile validity are
mathematical domain decisions, distinct from measured resource or recommended bounds.
No render has run and no CP7 feature has shipped at this checkpoint.
