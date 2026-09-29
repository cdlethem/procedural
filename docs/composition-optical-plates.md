# Optical Plates (brief 28)

Status: **implemented on branch `w1/optical-plates`, unreleased. Reviewed from rendered output
and package tests only; not exercised through the real Studio interface.** It extends the
existing Registered Screens and Interference Lace families and the frozen
[composition boundary](composition-reference-slice.md); it does not claim a new moiré
algorithm. The composite of two plates is the two real plates drawn over each other.

## Artist-facing brief

Two pattern plates, each with its own pattern, period, drift, rotation, phase, offset and
support, are registered to one another and drawn alone, as a linked pair or as detached layers.
One plate can follow type or a set of regions while the other stays regular.

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Pattern functions: grating, rings, dots, wave-warped grating, spokes; scalar `planeWave`/`radialWave` | `composition/patterns.ts` | Extracted from `registeredScreenSegments` and `interferenceLaceField`, which now call them |
| Support: rectangle/ellipse footprint ∩ optional mask (paths, regions, type), `clipToSupport` | `composition/support.ts` | Frozen `Region` values; the licensed glyph outlines (`textOutlines`, extracted from Word Echo) |
| Plates, registration, composite, recipe consumers | `composition/plates.ts` | `Path`/`Site`, `componentSeed`, `atEach`, `strokeWith`, `pathMaterial`, `motif`, the run budget |
| Instrument, controls, named recipe | `adapters/optical-plates.ts` | `partitionRegions`; recipe kind `plates` is one more member of `ReferenceComposition` |

- **Pattern functions.** `PatternFunction = (request) => { strokes, dots, minPeriod }`; the request
  is a frame (origin, radians), the `reach` that covers the support, a phase in cycles and the
  flatness. Ordinary functions of this type and `PatternSpec` descriptors are interchangeable.
  Stroke ids come from lattice indices (`line:12`, `ring:4`, `spoke:7`, `dot:i:j`), never from
  draw order or support, so growing the footprint adds elements without renaming any.
- **Sampling rule.** Every vertex lies on the ideal curve and no chord deviates by more than
  `flatness` (0.02 units); ring vertex count follows `r(1 − cos(π/n)) ≤ flatness` and wave step
  `√(8·flatness/κmax)`. Straight lines have two vertices. No sample lattice is tied to a
  preview or export pixel grid. `MIN_PERIOD = 3` keeps every local spacing above the two-pixel
  Nyquist limit at 1:1. What the device does with strokes is outside the rule. Lace keeps its
  own rule (eight samples per undistorted shortest wave plus the noise bend).
- **Frequency drift.** Local frequency `(1 + chirp·u/100)/period` at distance `u` from the frame
  origin; lines sit where the counted phase `(u + chirp·u²/200)/period` is an integer (closed
  form inverse, exact at chirp 0). Drift over the reach above 80% or a local period below 3 is
  refused.
- **Registration.** `detached`: `origin + offset`, `rotation`, `phase` for every plate.
  `linked`: each plate after the first is composed onto the previous plate's frame; rotations and
  phases add, the offset is read in the previous plate's rotated axes. Supports are canvas
  stencils in both modes. Per-plate cache keys contain the resolved frame, so editing plate B
  returns plate A as the same object, and a detached B is independent of A.
- **Support.** Nonzero winding; boundaries are inside by a half-open crossing rule; `invert` keeps
  the footprint outside the mask. Dots are kept whole when their center is inside.
- **Elements.** Clipped pieces are `<plate>/<stroke id>#<n>` (`n` counts the pieces); an
  uncut closed ring stays one closed path. `tone` is the plate index, `level` the stroke index.
- **Limits** (each an explicit error): 4,000 lines, 400,000 vertices, 40,000 generated dots
  (refused up front when the lattice estimate exceeds 42,000), 720 spokes, 4,000 mask rings, 60,000 mask vertices, 60,000,000
  segment-edge clipping tests, 8 plates.
- **No recorded phase sequence.** Phase is one static value per plate; the library has no
  recording foundation to replay one from.

## Checks

`tests/composition-plates.test.ts` (28 tests): independent formulas for grating, rotation,
offset, drift, ring radii and sagitta, spoke angles and hub floor, hex and square lattices, wave
displacement and chord bound; exact chords through rectangles and ellipses; nonzero versus
even-odd masks, region inset and inversion, glyph counters; closed-ring joining; linked versus
detached frames and plates; cache identity and freezing; id stability under footprint growth;
custom callbacks and custom pattern functions; stock consumers through the descriptor; every
refusal. Six mutations (linked rotation, even-odd rule, loose flatness, phase sign, detached
composing like linked, ignored inversion) each fail a test. Registered Screens and Interference
Lace drew identical fingerprints (defaults, four seeds and 120 random valid configurations
each) before and after their pattern code moved.
