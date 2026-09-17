# Add octave detail to a gradient field

Root capability decision, 2026-09-17. Third and last batch-1 capability; p5 first.

## Artist task and algorithm removed

Keep a broad spatial pattern while adding smaller-scale variation, then reuse the same
values for mark size, colour or displacement. The operation owns frequency/weight progression,
ordered repeated field evaluation, accumulation, optional weight normalization, query-domain
checks and bounded work. Artists supply positions and use the returned scalar values; geometry,
colour ramps, nonlinear size shaping and drawing remain replaceable composition.

## Evidence

Root read exact notes and active source call sites at source revision
`69bdd8513e4482a5e6018e36887d4bc208660eb5`:

- `2018/Generativos/noisub/noisub003#0`, [notes](../../survey/out/2018/Generativos/noisub/noisub003/notes.md),
  SHA256 `469a9a49c3acd8d38b34af3b19ea5a53e6518639fabc720fbca948e9d7bb627a`.
  `noiseDetail(2,.45)` precedes queries that control subdivision/shading. The candidate is
  the composite `noiseSubdivide`, not an extracted octave helper. This admits its field
  dependency only. Notes have no parameter experiments and their high-noise split explanation
  reverses the size-threshold condition; no subdivision coverage follows from this decision.
- `2018/Generativos/micro#0`, [notes](../../survey/out/2018/Generativos/micro/notes.md),
  SHA256 `9e4bf68abaca6166b121a99060fe7dc132b84172cdd422515348f2e27d788990`.
  Active `noiseDetail(2,.45)` drives size, colour and connection details. Frequency*3 and
  size power2→4 changed the composition substantially; neither isolates octave count.
  The candidate is circle packing with a supplied size field; packing and power shaping
  remain separate. Processing noise is **not assumed to equal our gradient profile**.

The broad family also contains abs/value-noise, products, ridged multifractals and even
count accumulation (`dondon002`). `erosion` has separately shifted, gamma-shaped fields,
not a geometric weight progression. None is silently admitted as equivalent. Explicit
source `noiseDetail` motivates octave controls, not exact Processing noise replay.

## Boundary and alternatives

`field.octave-gradient-noise`, named p5 `octaveGradientNoise(input)`, is a batch evaluator
using the existing 2D or3D `gradient-noise-*-01@0.1.0` profiles with one explicit seed.
Input: dimension, points, seed, octave count, initial frequency/amplitude, positive
lacunarity, nonnegative persistence, normalization NONE or WEIGHT_SUM, and maxWork.
Output: detached `{values,amplitudeSum}` in point order. All inputs explicit; no defaults
or recommended ranges. Existing gradient samplers remain single-octave and unchanged.

For each octave, evaluate the same seed field at `point*frequency`, weight it by amplitude
and add left-to-right. Progress frequency by lacunarity and weight by persistence, never
advance beyond the final used octave. Optional division uses the sum of weights in that
same order. No signed recentering, abs/ridge/product transform, per-octave seed/offset,
Processing replay or simplex/value-noise implementation. Caller coordinate offsets occur
before the frequency progression, so they scale at every octave.

A private example loop would hide this central algorithm from reuse, testing and numeric
semantics. A generic callback accumulator would introduce unbounded side effects and blur
field-profile guarantees. Two accepted dimensions behind one explicit discriminator keep
this one capability while preserving the existing field algorithms and their query domain.

## Control, transfer and cost

Octaves adds bands of detail; lacunarity changes relative spatial frequency; persistence
changes the relative weight of smaller scales. WEIGHT_SUM separates total scale from detail
count; NONE preserves the explicit weighted sum. Sample values feed the displacement
operation by pairing two result arrays, or draw entirely different marks at retained points.
Reserve `2018/Generativos/noisub/noisub004` for source/contract transfer after freeze.

Cost: a finite schedule of K octave frequency/weight pairs, N supplied points, O(K+N*K)
work and O(K+N) storage; one schedule event plus one field evaluation per point per octave.
`maxWork >= (N+1)*K` is checked before schedule/output allocation. This includes empty
point lists, so huge unused schedules cannot bypass the budget. Profile query limits,
finite arithmetic, positive lacunarity and normalization's nonzero initial amplitude are
representation/definition bounds, not artistic guidance. Time, animation and RNG consumption
remain outside this pure operation.

## Acceptance and marginal coverage

Step0 baseline459/800 plausible and366/800 operation-led. The family-level optimistic
sequential gain was+20 after grain/displacement, not a promise for this narrow accumulator.
Only exact affected-case mappings may remove a gap; source value/simplex, abs/ridge/product,
nongeometric components and unrelated count accumulation remain residuals.

Shared fixtures precede implementation and distinguish seed/dimension, single-octave
identity, normalized/raw sums, independent fractional/negative queries, geometric frequency
versus coordinate iteration, weight order, zero persistence, underflow, no unused terminal
update, full validation before budget, schedule overflow before query and query-domain errors.
Use the existing independent Fraction noise oracles to derive expected outputs.

Native `octave-noise` is an independent field-sized dot study motivated by micro's size
field. Preregister component fidelity before rendering: same supplied positions, edits to
count/persistence/normalization, reset/reload/save; inspect source and native images. No
whole-scene micro/noisub reproduction or demonstrated-original credit. Benchmark small and
100k query batches with 1/4/8 octaves, not a full corpus/render matrix.

After validation: [p5 core/native accepted](../../evidence/coverage/batch1/octave-gradient-noise/root-review.json).
The independent native study passes count/persistence/normalization edits and reset/reload/save.
Withheld noisub004 transfers at the field-dependency level by source walkthrough only.
The [affected-case review](../../evidence/coverage/batch1/coverage-review.json) closes fifteen
field dependencies, leaving fifteen residual cases. Newly demonstrated originals: zero.
No target beyond p5 is accepted by this decision.
