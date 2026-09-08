# Curvespace recreation: composition and fidelity

Root source walkthrough after Java0.22 at838eb1da. Status: plausibly supported;
implementation/native review pending. This does not add an operation or count a recreation.
Source: survey/out/2018/Generativos/curvespace/notes.md, note SHA256
6bad58b922c2ebb38ffd2aecec420f7aca50b053224eac9cad007fc06661286a.
Pinned upstream69bdd8513e4482a5e6018e36887d4bc208660eb5,
2018/Generativos/curvespace/curvespace.pde SHA256
b379b238cc23184c9836d3eb008253ce6bbfd8b75642c531d09130f697df7e91.

## Complete active composition

The source draws a960 square in P2D, smooth8,density2, dark aubergine background0x1C1528.
ADD blending makes coincident translucent strokes accumulate. An unused Chivo font is
created but no glyph is drawn. Its seed variable is initialized and replaced on keys but
never supplied to randomSeed/noiseSeed; default source repeatability is not established by
that variable. The survey deterministic label alone cannot prove source seed replay.

1. Pick grid count30..79, then draw its cell-center dots in random source palette colors
   at alpha50. RegularGrid can supply these explicit positions; count/color generation is
   ordinary caller composition, not a new layout algorithm.
2. Pick4..9 influences. Source diameter is uniform in[0,768), centers are independently
   uniform within the half-diameter inset. Power is either a uniform[1,10) value or its
   reciprocal, selected with equal probability. These scalar distributions can remain
   explicit seeded caller arithmetic. RadialPull2D consumes radius=diameter/2, not diameter.
3. Draw each influence circle with its diameter, a random palette color and alpha20.
   This scaffolding is part of the visible composition, not expendable helper metadata.
4. Draw count-1 vertical and count-1 horizontal polylines, each with2880 samples along
   the varying axis and the original half-open canvas interval. RadialPull2D owns summed
   radial deformation. Ordinary loops sample the lines; no deformation code belongs there.
   Choose one random source palette color per line, alpha40, no fill. Preserve both families.

Source palette is0xFF5949,0xFFC956,0x1CEA64,0x53EFF4. No interpolation is used in the active
source, so a palette-operation call merely to count another dependency would be unnecessary.
RegularGrid and RadialPull2D suffice for the defining computations. Random scalar mapping,
line sampling, circles, points and additive drawing remain visible editable host composition.

## Declared structural target, before implementation/render tuning

Use the accepted Java0.22 JAR; actual Processing P2D960x960 density1. Use explicit seeded
java.util.Random(42) for caller choices; no Processing stream compatibility. Record actual
count/influence descriptors and sample counts. Choose a strictly positive radius proposal
by using1-nextDouble for the diameter factor; this changes the probability-zero endpoint
policy rather than admitting an invalid zero-radius descriptor. Keep the source-like
marginal distributions and mixed reciprocal powers. Do not hard-code two convenient centers.

Keep dark ground, ADD blend, all four colors, low-alpha dots/circles and both dense line
families. Density1 and supported native smoothing differ from source; exact pixels are not
claimed. RadialPull2D's binary64 direction normalization, exact-center zero and ordered sum
are explicit semantic differences from float atan2/cos/sin source evaluation. Center folds
and overlaps must remain visible. No other active component may be silently dropped.

First implement retained composition data and an ordinary native PDE. Recolor must retain
geometry; seed regeneration changes input choices; reset reproduces baseline and cached save
matches the displayed frame. Native P2D and ADD behavior must actually run through the shared
machine lease, using existing pinned JOGL infrastructure. Root inspects dots, influence
outlines, coherent grid outside affected areas and luminous folded/tangled strands. If any
component is absent, the whole-sketch recreation remains incomplete.

No external source baseline pixels have been compared in this walkthrough. Structural
acceptance follows the established selected-recreation policy; it is not the full-corpus
benchmark or a pixel-diff certification. Public package support remains22 operations and22
workflows until any new artifact is independently accepted. Curves_str sequential outward
pushes and culin stochastic per-axis motion remain different algorithms, not coverage gains.
