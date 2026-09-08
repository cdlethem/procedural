# Sol review: CP3 minimum-radius and attempt controls

Status: accepted visual evidence for the two registered private control edits. This
review closes the two questions left open by the first placement experiment. It does not
admit an operation, freeze a signature, choose defaults or recommended ranges, reproduce
an upstream image, or establish target support.

## Evidence inspected

I inspected the original 640x640 PNGs for the preserved baseline and both supplement
cases at original detail:

| case | PNG SHA-256 | accepted circles | direct visual finding |
|---|---|---:|---|
| preserved `base-rings` | `d9b3cbaf32ba3f817582e0ded52aa3afe0a150e3147a403c542fe471d2d59485` | 424 | The radius-4 floor permits many fine rings between a smaller population of medium and large anchors. |
| `larger-minimum` | `ffd8424f0ab5b4b23af2b5d5a66ef8e3279b50fdcfe154f8eb8ac29f9626f1e8` | 239 | Raising the floor from 4 to 8 removes the finest filler rings. Medium and large rings dominate, the field is more open, and recognizable large anchors remain. The edit reads as a lower bound on motif size rather than as a global rescaling. |
| `more-attempts` | `91cb6ff7c2be4dc981dbd6455a126434cab65dbafdb8c1b6c48890ef64a851fb` | 517 | Extending the proposal budget from 5,000 to 10,000 keeps the baseline composition visible and adds mostly small rings in remaining gaps. The original large anchors and crowded groups remain in place, so the edit reads as continued filling rather than a reshuffle. |

The bound [result](../../evidence/parameter-experiments/cp3-placement-controls/result.json)
has SHA-256
`c7f9ca93b4463912eadfd6c4f7f1682b036d207937ff29c4b697fb77d9b17d93`.
The registered [plan](../../evidence/parameter-experiments/cp3-placement-controls/experiment.json)
has SHA-256
`251f2c9c3739c873a3b661caa0fbc1dbb708e4c905399d72a503d7b48e12f0fb`.
Both attempts rendered once with empty stderr. Each output is an opaque, nonblank
640x640 image with the registered background. The frozen prototype remains SHA-256
`6456603fdc26daa438ad9f4a319ca02621b79d2391e7cfcf3bf8d010b16e644c`.

Against the preserved baseline, `larger-minimum` changes 64,556 pixels (15.7607%)
with normalized RGB MAE 0.04875969. `more-attempts` changes 4,757 pixels (1.1614%)
with normalized RGB MAE 0.00417044. Thin outlines make the whole-canvas score for the
attempt extension small; the added marks are nevertheless plainly visible on direct
inspection. These measurements describe change and are not acceptance thresholds.

The independent numeric records give the stronger identity claims. The minimum-radius
case has the same proposed-centre digest as the baseline while its radii and accepted
set change. The 10,000-attempt case retains the exact 424-circle accepted prefix from
the first 5,000 proposals, including source indices and their modulo-five colour
assignment, before adding 93 accepted circles. Native profiles match the independent
candidate and ordered-acceptance references, and drawing leaves each accepted-geometry
digest unchanged.

## Decision against the registered criteria

Minimum radius earns an explicit place in seeded convenience contract design. The
4-to-8 edit creates an understandable size-floor control: it removes fine filler while
retaining a mixed-size composition. It should not be hidden as the prototype constant
4. These two inspected values do not establish a recommended interval, a default, or
usefulness for every finite value.

Attempt count supports both finite-work authorization and the proposed editing task.
The 10,000-proposal image visibly continues filling available gaps, while exact prefix
evidence shows that increasing the budget does not relocate or recolour earlier accepted
circles. It remains an attempt budget, not a requested or promised output count. Values
5,000 and 10,000 do not establish a recommended density range, universal runtime, or
public maximum.

Together with the first five-image review, the evidence now supports carrying minimum
radius, maximum radius, separation scale and explicit attempt count into contract design
for the seeded route. Seed and centre rectangle remain deterministic construction inputs,
without artist-recommended ranges. The explicit ordered-circle filter continues to take
authored radii directly and therefore has no radius-interval or rectangle parameter.

## Numeric policy carried into contract work

The visual result does not settle extreme binary64 geometry. For the next contract, I
support finite positive candidate radii and separation scale, finite positive seeded
rectangle spans, and `0 < minimumRadius <= maximumRadius`. Validate all explicit circle
values before ordered filtering. Then evaluate each pair in named, separately rounded
binary64 stages and fail the whole invocation, with candidate source index and stage, if
an intermediate becomes nonfinite or loses required positive magnitude through
underflow. In particular:

- `(radiusSum * separationScale)` must remain positive, and a nonzero limit must not
  square to zero;
- a nonzero `dx` or `dy` must not square to zero;
- subtraction, addition, multiplication, squaring and the distance-square addition must
  remain finite.

No retained prefix should escape a dynamic arithmetic failure. A retained-circle index
need not become public error surface, and this milestone does not justify an arbitrary
coordinate envelope or a new normalized comparator. Finite centre mapping that merely
rounds or collapses remains a separate generator-semantics question rather than a reason
to alter the overlap predicate silently.

## Limits

- Both edits use seed 42, one 512x512 centre rectangle, Processing 4.5.6 JAVA2D and one
  ring treatment. They establish two inspected configurations, not broad sensitivity.
- Raising the radius floor changes acceptance decisions as well as individual sizes. The
  experiment proves useful control of the resulting composition, not identity of the
  retained set.
- Increasing attempts demonstrates monotone prefix retention for this deterministic
  stream and ordered filter. It does not promise that every extra budget produces an
  extra circle or that all configurations have comparable cost.
- Whole-circle containment, zero-count results, carrier ownership, validation and error
  precedence, resource limits and four-target conformance remain contract and
  implementation work.
- The proposal stream, small-biased radius mapping and checked binary64 predicate are
  package design choices. The images are not pixel or RNG compatibility claims for
  `caramelo`, `candy`, `studio`, or Processing's random stream.
