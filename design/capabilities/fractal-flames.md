# Fractal flames: density-accumulated iterated maps

Root admits one p5-first operation for the first I-family slice: a bounded fractal
flame that iterates a weighted transform set from supplied seeds and accumulates the
resulting point process into a bilinear density buffer. This is the first of the six
distinct I-family proposals in the external expansion (venation, DLA, multiscale
Turing, flames, complex dynamics, maps); the others remain individual proposals and
are not admitted by this decision. The September 2026 external-art manifest records are
bound by id below; this is a new capability, not a Processing-corpus reassignment.

Artists author a small set of weighted transforms (an affine part, a translation and an
optional per-coordinate power), choose seeds and an iteration budget, and retain the
accumulated density so exposure and palette can be edited without resimulating the point
sequence. The mechanism is Draves's fractal flame: recursive equations rendered from a
large point process (corpus `other-scott-draves-hifidreams-b7eea3a9`,
`other-scott-draves-sheep-2c69001b`, `other-scott-draves-bomb-74b0c7a1`). The
accumulation renderer — hit counts, logarithmic exposure and a reconstruction kernel —
is reusable independently of the flame dynamics (plan row 49); this decision admits the
combined flame as one bounded operation and leaves a standalone density accumulator as a
documented follow-up, not an implied capability.

The operation is a pure function of its input: it streams the iterate directly into the
buffer and does not materialize the point sequence. Probability selection uses the
accepted seeded 32-bit LCG in a single fixed draw order; the transform advance, the
bilinear splat and the boundary clamping are frozen in the contract. A nonfinite iterate
(the `inv` power maps 0 to +Infinity by definition) is a handled drop path that resets
the running point to the next seed, not an arithmetic error. The density buffer is
provably finite for valid inputs because each cell accumulates at most the iteration
count. Presentation (log remap, dither, palette) composes with the already-accepted
raster operations; no new presentation surface is admitted here.

Reusable outputs are the detached density buffer and the plotted/dropped counters. The
withheld transfer renders a dense agent-history point process through the same bilinear
accumulation and the same log-exposure/palette presentation with the flame transforms
removed, demonstrating the renderer is separable from the dynamics; it does not claim the
agent system is a flame. No original flame parameters, temporal evolution or learned
preference are reconstructed from the source, and no default or recommended visual range
is inferred from the source images. Public descriptions, attractive previews and
proposed equations are not acceptance.
