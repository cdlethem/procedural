# CP7 selection: retained radial-profile surfaces

Root accepted the seven-image private comparison in
[the visual review](../../evidence/parameter-experiments/cp7-profiles/root-review.json).
This selects the next capability and supersedes provisional boundary questions in
[the investigation direction](cp7-profile-mesh-direction.md) where stated below. It does
not freeze a public operation contract or declare a shipped implementation.

The same retained mesh construction supports a cylinder, a clearly waisted column and a
pointed form. Changing angular subdivision exposes deliberate large facets. Removing
the end caps opens the rim. Recolouring and the three-object arrangement reuse retained
geometry. These are observable artist edits and a successful composition transfer, not
just a mathematically tidy grouping of candidate names.

Select one generator from a supplied ordered sequence of axial coordinates and radii,
an angular subdivision count, and independent endpoint closure choices. Use local Z as
the axis, shared angular seam indices, one vertex at a zero-radius endpoint, and ordered
indexed triangles with per-face band/cell/kind identity. The sequence itself determines
axial sampling; do not add a redundant length-resolution field. Camera, transforms,
profile formulas, palettes and drawing stay outside generation.

For this first operation, require increasing axial coordinates, positive interior radii
and nonnegative endpoint radii. A pair of poles without a positive ring is not a surface.
The explicit endpoint fan policy applies only to positive-radius endpoint rings. A pole
is already closed. The full numeric and representational validity of these rules remains
contract work. Do not quietly add arbitrary/self-intersecting or closed meridian profiles.
Annular solids remain a distinct recorded expansion rather than a falsely covered family.

## Include the geometry needed for ordinary lighting

The private renderer currently computes two edge vectors, a cross product and a normalized
face normal for every drawn triangle:8,784evaluations across this comparison. The rendered
facets are useful, but making each artist write that geometry code would leave an obvious
part of mesh use unfinished. Select local flat unit face normals as part of the proposed
retained result. They derive from triangle geometry and belong with its face attributes.
This is a root design decision, not an extracted upstream normal implementation: the
motivating helpers supply no explicit normals.

The public drawing loop should read a triangle's indices, colour it using its retained
band/cell/kind, submit its supplied normal, and submit its three positions. It should not
repair seam/cap/pole topology or compute lighting geometry. A separate generic normal
operation, opaque colour callback, or permanently named cylinder/waist preset is not
needed for this workflow. Smooth normals and crease controls are deliberately deferred;
the demonstrated flat-shaded result is the first declared shading attribute.

Before contract freeze, specify arithmetic for normals and finite-but-collapsed output,
not just the ideal mathematical surface. Reject unrepresentable geometry explicitly
instead of returning NaN normals or silently dropping faces. Distinguish same-runtime
replay from allowed trigonometric differences across future targets. Define owned result
storage, allocation-free indexed reads, topology/provenance ordering, validation precedence
and bounded work. This is a linear mesh construction; repeated rendering should reuse
its result and should not recompute normals.

## Honest evidence and admission

Root read six source sketches and their notes; exact bindings are in
[the source review](../../evidence/investigations/cp7-profile-source-review.json).
cilindros, fieeee and Circo motivate connected circular side bands; caps are explicit in
cilindros. Their full helpers include colour, random profiles or composition and are not
equivalent to the new generator. The old prueba4 provisional merge reason incorrectly
describes contiguous rings: source strips overlap. Any admission must supersede that
reason, not use its provisional label as authority. cityPink3d and aros retain different
surface semantics as recorded in the neighbour audit.

The private attempt generated4,496faces and drew8,784faces in7frames. All seven images
were inspected, all exact native/preflight geometry records matched, and input bindings
remained stable. The environment was Processing4.5.6 P3D on Mesa llvmpipe under Xvfb.
Only preregistered EGL/X11 warnings appeared. This neither repairs the earlier strict
no-stderr probe's failure nor certifies hardware rendering or clean shutdown.

No library default or encouraged numeric interval is established. The successful supplied
profiles and8/32angular samples are example configurations. Visibility of a change and a
single useful example do not establish a continuous range. Native Java implementation,
installed editable starter, final operation fixtures and target attestation remain required
before this capability can be counted as delivered. Other platform ports remain deferred.
