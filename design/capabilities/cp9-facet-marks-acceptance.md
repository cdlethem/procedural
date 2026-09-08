# FacetMarks implementation and native acceptance

Root registers this workflow before implementation/rendering. The CP9 Java core
is accepted; this document defines the next artist-facing slice. Scope is an
editable 640 by 640 Processing JAVA2D sketch, density1, static redraw on edits.
No font, image, shader, third-party geometry or other-platform support is required.

## Composition and substitution points

Use a small ordinary Java example helper, FacetComposition, with
create(seed,fine,cells), mesh(), grainAt(face), and grainCount(). This helper is
editable example code, not another catalog operation. The PDE draws retained
geometry using public Delaunay2D and TrianglePoints2D accessors.

The first site source is a disc centred at (320,320), radius240. For each of
128 coarse or512 fine sites, a newly created Java Random(seed) draws angle first
(nextDouble times2pi), radius second (240 times sqrt(nextDouble)). This is an
explicit Java example input policy, not portable RNG or exact datata replay.
It preserves the original input prefix on count changes. The core covers the
convex hull of supplied sites; do not call that clipping against the circle.

The alternate site source uses centres of QuadrantPartition2D leaves: origin
(64,64), extent(512,512), selectionFraction0.5, replacements42 or170, same seed.
These produce127 or511 centres. This demonstrates lightcity's centre-to-facet
mechanism without claiming its prisms/windows/camera or imported triangulator.

Triangulate with explicit example maxWork50000000. For each final face, gather
its three vertices through public indices and pass them to TrianglePoints2D.seeded.
Use floor(area*0.06) points and seed=(seed+faceIndex)&0xffffffff. Preflight a
20000-point total example budget before sampling. The finite canvas area formula
is example glue, not a new robust geometry API. Retain every sampled batch.

All counts, colours and mark settings here are authored example choices, not
library defaults or measured encouraged ranges. The source/design distinctions
and exact evidence are in cp9-facet-marks-direction.md and the admission review.

## Drawing and edits

M cycles filled faces → unique-edge wire → grain. Face colour samples CyclicPalette
at faceIndex*0.173 cycles; wire colour uses the edge's first incident face. C swaps
the palette; P toggles dark site markers. These edits retain the identical
composition, mesh and grain objects. Draw each wire edge exactly once. Filled
faces use no stroke. Grain uses point marks; site markers are separate ellipses.

N toggles coarse/fine, X swaps site sources, R advances the unsigned32 example seed.
Those edits rebuild geometry and grain. 0 restores all baseline state and seed42.
S saves the cached completed canvas through PImage.save and does not regenerate
geometry or redraw. Use explicit RGB255 style; preserve the prior accepted
examples and their executable bytes while developing this new one.

## Required native states, in order

Baseline; wire(M); grain(M); reset(0); colour(C); reset; sites(P); reset;
fine(N); reset; new-seed(R); reset; cells(X); cells-wire(M); cells-grain(M);
cells-fine(N); cells-colour(C); final-reset(0); save(S).

This is18 rendered states and one save action. All six resets must reproduce the
baseline geometry, mark counts, style and pixels exactly in the same environment.
Every changed state must be present; no filtered selection can establish this
workflow's acceptance. Root inspects all12 distinct state images.

The actual preprocessed PDE must run against the built core/example classes.
Native instrumentation checks public triangle/line/point/ellipse arguments, style,
counts, object retention, coordinate membership, seed/reset and save identity.
Do not replace the PDE with a diagnostic lookalike. Official preprocessing and
headless composition tests precede a serialized native render through root's
executor. Bind all sources/runtime inputs before launch, preserve failed attempts,
and keep render output in a new ignored .work directory.

## Reproduction claim

Success is technique-level: supplied sites become reusable facets; styling can
change without retriangulating; region centres substitute for scatter; returned
faces feed the existing grain sampler. It is not source-pixel identity or a
reproduction of datata's halos/filtering or lightcity's complete city. Native
state comparisons use this registered sketch's baseline, clearly distinct from
survey-image comparisons. Direct visual inspection must confirm usable structure
and distinguish the edits; counts or fixture success alone are insufficient.

Only after this workflow passes should Java0.9.0 packaging add the ninth starter
and twelfth operation. Packaging must preserve the prior eight examples and
carry the newly accepted core; no registry publication is implied.
