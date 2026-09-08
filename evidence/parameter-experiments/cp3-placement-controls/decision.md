# CP3 control supplement: minimum radius and continued filling

Root inspected both new original PNGs against the preserved baseline. Retain minimum
radius as an explicit required geometric control for contract design. The increased-attempt
image also demonstrates the proposed continued-filling edit. These conclusions supplement,
not replace, the [first decision](../cp3-placement/decision.md). No default, continuous
encouraged range or public implementation is approved by these images.

## Bound experiment and observations

The [registration](experiment.json) permits exactly two independent temporary-copy
substitutions. Both were attempted once and succeeded without stderr. The original source,
executor, reports and all five earlier images remain unchanged and hash-verified.
The new [result](result.json) has SHA-256
`c7f9ca93b4463912eadfd6c4f7f1682b036d207937ff29c4b697fb77d9b17d93`.
Sol's independent image assessment is recorded in
[`cp3-controls-visual-review.md`](../../../design/capabilities/cp3-controls-visual-review.md).

Both images retain the original seed42, 640×640 JAVA2D canvas, centre rectangle, palette,
source-index colour assignment, ring construction, stroke and scale1. The comparison
baseline was read from `.work/experiments/cp3-placement/base-rings.png`, never rerendered.
Only the stated literal changed in each separate temporary source copy.

| image | change | accepted circles | normalized RGB MAE | changed pixels |
|---|---|---:|---:|---:|
| `larger-minimum.png` | radius floor4 → 8, maximum64 and5,000 attempts unchanged | 239 | 0.04875969 | 15.7607% |
| `more-attempts.png` | 5,000 → 10,000 attempts, radius interval4..64 unchanged | 517 | 0.00417044 | 1.1614% |

The larger minimum visibly removes the tiny rings that fill the baseline's small gaps.
Medium and large rings dominate a coarser field, while the shape and colour treatment
remain recognizable. This is useful size-floor control, distinct from reducing maximum
radius, which removed the largest anchors. The floor edit changes every mapped radius
according to `minimum + ((maximum-minimum)*u)*v`; it is not a post-filter deletion of
small circles, and accepted placements can change.

The extended run retains recognizable large anchors and adds small rings into previously
open spaces between them. The new fine marks are visible on comparison without replacing
the original composition. Its small whole-image difference is expected for additional
thin outlines on an otherwise preserved canvas; it does not make the editing task useless.
The exact numeric evidence proves preservation more strongly than visual alignment alone.

## Causal checks and parameter decision

Independent Python generation and acceptance match each modified Java base profile's
full candidate, centre and accepted-geometry digests, final RNG state and comparison count.
The minimum edit retains the baseline centre-proposal digest. The 10,000 run retains the
original 5,000 candidate prefix and exact 424-circle accepted prefix, including source
indices and their colour assignments, then adds 93 circles. Before/after native geometry
hashes match each pure profile. Every new PNG is opaque and nonblank with the registered
dimensions and background.

- **Minimum radius: retain, required and explicit.** Four and8 pixels are inspected useful
  settings for this exact canvas, maximum64 and proposal mapping. Do not interpolate an
  encouraged range, choose a default, or hardcode4 inside the operation. The eventual
  positive-radius validity rule is a separate geometry decision, not this visual result.
- **Attempts: retain as an explicit finite proposal budget, with actual accepted count
  reported.** The continued-filling example is now supported at5,000 versus10,000 on this
  seed/configuration. It preserves the accepted prefix; it does not promise93 additions
  for another seed, a desired output count, maximal packing or a density range. Recomputing
  a longer deterministic run is sufficient; this does not require a public resumable RNG.
- **Two-level composition: retain.** Together with the first five images, artists can
  adjust separation and both size endpoints, extend the proposal budget, replace motifs
  while retaining geometry, and supply an authored arrangement through the same filter.
  Seed changes and the actual live starter lifecycle still belong to implementation tests.

No new rendered survey baseline was used. The motivating source paths and discrepancies
remain those in the [pinned audit](../../../design/capabilities/cp3-packing-source-audit.md).
The floor is a deliberate package design control; the source samples do not supply a
positive public default. These seven private images establish mechanism/edit evidence,
not corpus-pixel equivalence or four-target package support.
