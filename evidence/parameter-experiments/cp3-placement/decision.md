# CP3 placement: first visual parameter decision

Root inspected all five original images from the registered private JAVA2D experiment.
The result supports retaining separation scale and maximum radius for contract design,
and supports the seeded convenience plus ordered explicit-circle filter boundary.
This is not a frozen operation contract, a native package test, a human usability study,
or reproduction of an upstream frame. Independent Sol visual review is recorded separately
in `design/capabilities/cp3-placement-visual-review.md` when complete.

## Registration and evidence

The unchanged [registration](experiment.json) defines the question, configurations and
retention criteria. [Generated result](result.json), SHA-256
`d5f729b829b44e62b5b104141520562c7ce442deb25a4953d991565e755b1b7e`, records
five attempted and five successful images, exact source/runtime bindings, numeric evidence,
PNG hashes and comparisons. No render emitted stderr. All images are opaque, nonblank
640×640 outputs with the registered background. They remain under ignored
`.work/experiments/cp3-placement/`; there is no external survey-image comparison.

The baseline uses seed 42, 5,000 attempts, centre rectangle origin (64,64) and size
(512,512), radius mapping `4 + ((64-4)*u)*v`, and separation scale 1. Each proposal
consumes four units, including rejected proposals. Colours use original proposal index
modulo the five-colour palette. Stroke width is 1, with round caps/joins; the ring uses
64 vertices. The exact stream, arithmetic and radial arrangement are in the registration.
The model vertex digest precedes conversion to Java float for native vertex submission.

| image / sole change from baseline | accepted | normalized RGB MAE | changed pixels | root's direct observation |
|---|---:|---:|---:|---|
| `base-rings.png` / baseline | 424 | — | — | Many small rings fill the spaces between a few much larger rings. Several crowded clusters read as touching outlines. Large rings act as visible anchors across the rectangular field. |
| `more-separation.png` / scale 1 → 1.2 | 353 | 0.01845218 | 5.6353% | More background separates neighbouring outlines, particularly around the large anchors. Several prominent circles remain in place; the smaller population changes. The result reads as a more open version of the same arrangement. |
| `smaller-forms.png` / maximum radius 64 → 32 | 613 | 0.05472750 | 16.8872% | The large anchors disappear and the field becomes a finer, more even collection of rings. Small rings remain readable at this size; more circles occupy the canvas. |
| `diamonds.png` / 64-vertex rings → 4-vertex diamonds | 424 | 0.04354336 | 16.7837% | The same large anchors and small-form locations are recognizable through angular outlines. More background is visible around the inscribed shapes without changing their reserved circles. |
| `authored-radial.png` / explicit radial proposals | 111 | not an isolated comparison | not an isolated comparison | The field becomes circular, with forms distributed around an empty centre. Repeated circular bands are visible through the varying sizes. The ring drawing treatment remains recognizable. |

The metrics are descriptive, not acceptance thresholds. Thin outlines occupy a small
fraction of the image: the separation change is understandable on inspection even though
its whole-canvas MAE is small. The radial route is a composition transfer, not a parameter
measurement. Neither counts nor difference scores imply an aesthetically superior result.

## Geometry and cost checks

The Python stream oracle and JavaScript feasibility probe agree on their recorded streams
and candidate digests. Root's independent Python ordered acceptance check also matches
Java's exact retained-circle hashes and comparison counts for the three seeded configurations.
Baseline and separation use identical proposals; the size edit preserves proposed centres
and random consumption, while changing radii and the accepted set. Ring and diamond model
commands use the same retained object in the numeric check. Their separate render processes
reconstruct equal geometry; they do not demonstrate a live editor's object lifecycle.

Extending the numeric run to 10,000 proposals retains the baseline's exact 424-circle
prefix and produces 517 accepted circles. The extension has not been inspected as an image.
The reference kernel is shared by seeded and authored routes; no collision code appears in
the motif drawing loop. This is the substitution that earns the explicit filter alongside
the artist-facing seeded convenience.

The recorded JDK 17 numeric observation is about 2.49 ms for 5,000 proposals and 68.32 ms
for 200,000 proposals, each averaged over three runs after one warmup. The larger run
accepts 930 circles and makes 16,938,721 pair comparisons. It retains 26,040 bytes of
primitive accepted payload in 28,672 bytes of backing-array payload capacity. These are
not peak memory or total allocation measurements; timings include proposal generation and
SHA summaries. They support continuing the prototype on this host, not a universal frame
budget or a 200,000-input public limit. Different configurations can require quadratic work.

## Parameter conclusions

- **Separation scale: retain as an explicit required control for contract design.** Its
  unit is dimensionless, multiplying the sum of radii. The squared binary64 predicate
  accepts equality. Scales 1 and 1.2 are useful inspected settings in this prototype.
  There is no approved default or continuous encouraged range. No hard upper bound was
  measured. The source's 0.96 overlap mechanism remains evidenced but visually untested here.
- **Maximum radius: retain as an explicit required geometric control for contract design.**
  Values 32 and 64 produce useful distinct compositions with minimum radius fixed at 4.
  This establishes those configurations, not every value between them or a general range
  independent of canvas size and minimum radius. No default or performance limit is approved.
- **Minimum radius: retain as an unresolved parameter decision.** Four pixels is the fixed
  prototype floor. Its independent visual effect was not tested. The operation must not
  silently hardcode that pixel value merely to avoid an evidence question. Resolve the floor
  control before freezing the seeded public contract; the explicit-circle filter naturally
  receives already specified radii.
- **Attempt count: retain explicit accounting and prefix semantics.** An attempt budget is
  not a requested output count. Numeric prefix evidence supports the mechanism, but the
  proposed “continue filling” editing task still needs visual/native demonstration. No
  encouraged attempt range or universal time guarantee follows from this experiment.
- **Seed, centre rectangle and motif/style ownership:** these are explicit design inputs and
  composition boundaries, not measured recommended ranges. Centres may be placed throughout
  the specified rectangle; whole-circle containment is a separate caller construction.
  Motif and palette changes must retain geometry in the future runnable starter.

The next contract must settle positive/degenerate radii, scale validity, empty/zero inputs,
finite and underflow/overflow behavior, immutable outputs, errors and cross-target fixtures.
None of these are implied by the successful fixed profiles. No public RNG surface is needed.

## Source observations versus package design

The motivating source audit is
[`cp3-packing-source-audit.md`](../../../design/capabilities/cp3-packing-source-audit.md):
`2018/Generativos/caramelo`, `2018/Generativos/candy`, and `2017/Generativos/studio` use
ordered size-aware rejection, with diameter-valued storage and different domains, scale
factors and random preludes. Prior size substitutions and their limits are in
[`cp3-neighbor-audit.md`](../../../design/capabilities/cp3-neighbor-audit.md).

The package deliberately separates placement randomness from style and chooses its own
portable stream and small-form-biased radius mapping. The sampled settings, rings,
diamonds and authored radial arrangement are private design tests. They are not claims
that any complete surveyed helper computes this new operation. Grid occupancy, fixed
point exclusion and covering subdivision remain distinct capabilities; this experiment
makes no new whole-candidate keep/merge/reject disposition.
