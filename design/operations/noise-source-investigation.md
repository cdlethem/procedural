# CP1 noise source investigation

Owner: root. Historical investigation followed by the accepted design direction in
[the proposal](cp1-noise-proposal.md) and [visual decision](../../evidence/parameter-experiments/cp1-noise-choice/decision.md). Formal dependency admission/contract remains next; no artistic range is approved.

## What the artist needs

CP1 needs a pure scalar value at a planar coordinate, with repeatable variation and
independent control over spatial scale. Sampling order must not alter the field. The
same field must serve heading, length and palette position without owning those mappings.

## Corpus evidence and its limits

[pelines](../../survey/out/2018/Generativos/pelines/notes.md) names Processing noise and
shows separate coordinate scales/offsets for three attributes. It supplies no noise table,
seed normalization, octave configuration or versioned algorithm specification. Its det1
substitution removes a random call, so it cannot establish an isolated public scale range;
see the [parameter record](../../evidence/parameter-decisions/cp1-field-marks.json).
The note supports the capability, not a particular portable implementation.

## External semantic check

Processing documents four default octaves with successively halved weights and warns that
larger falloff can yield values above one. Consequently, `unsigned` alone does not justify
a universal unit-interval contract for arbitrary Processing noise settings.
[Official noiseDetail reference](https://processing.org/reference/noiseDetail_), checked
2026-09-07. This is host documentation, not evidence of pelines' runtime configuration.

## Root's next decision

The CP1 design name `perlin2DUnit` remains provisional. Choose and name either a precisely
specified portable field with an explicit bounded mapping, or a versioned compatibility
source. Do not delegate a port under a generic instruction to implement Perlin noise and
then treat matching names as matching algorithms. Do not silently normalize a compatibility
source: that changes lengths, headings and palette positions.

Before admission, resolve the motivating candidate/component accounting; specify seed and
table construction, negative coordinates, periodicity, numeric evaluation, output bounds
and representative cost; obtain Sol's semantic review and distinguishing shared vectors.
A new portable source may target technique-level CP1 reproduction, but its divergence from
host Processing behavior must be explicit. The integrated CP2 source remains a separate
algorithm decision, sharing only the scalar sampling boundary.

## Candidate accounting for the next admission

Root checked `2018/Generativos/pelines#0`: it remains `review_required` in `field.angle`,
with the erroneous prior `path.flow-trace` merge preserved in audit history. It describes
consumption of noise, not a standalone generator implementation. `2019/generativos/ciserp#0`
remains in `review.flow-mark-composite`: integration and rendering are not yet separated.
Neither can be relabelled a whole-computation noise merge. Admission must explicitly extract
and account for the scalar-source dependency while preserving the remaining components.
Luna's bounded retrieval corroborated the missing seed/table/octave details; it did not
approve a contract. Investigate neighboring `field.fbm` records separately: octave sums
and rectified sums are additional computations, not synonyms for a single noise sample.

## Neighbor review correction

Root read [peces](../../survey/out/2018/Generativos/peces/notes.md),
[scicirgold](../../survey/out/2020/generative/05_08/scicirgold/notes.md) and
[acid](../../survey/out/2017/Generativos/acid/notes.md). `scicirgold#1` was incorrectly merged
with a simple 2D heading sampler: its detailed section includes a second three-coordinate
noise call fed by the first angle, conflicting with its 2D/simplex description and claimed
angle range. Reopened that merge with preserved history; no source algorithm is inferred.
Peces' early-frame measurements do not establish useful frequency bounds. Acid explicitly
rectifies each octave and has nondeterministic palette order; neither behavior is silently
absorbed into the proposed CP1 scalar operation.
