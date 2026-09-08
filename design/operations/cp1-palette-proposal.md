# CP1 palette boundary proposal

Status: root design direction, 2026-09-07; bounded independent Sol review incorporated. This is
not a frozen operation contract or approval of the entire `color.palette-sample`
family. The checked-in snapshot revision is
`b64fadf8cc484025f58a112b95630a7b0c420ea3`.

## Artist task and reusable result

Recolour an existing field of marks without changing its positions, headings or
lengths. Supply an ordered palette and sample smoothly around it, including the
last-to-first transition. Return a colour value that can be used for a line, a dot,
a filled shape or a mesh vertex. The operation removes cyclic neighbour selection
and consistent colour interpolation; it does not own the mark or its renderer.

The first complete example retains a dimensionless colour phase in cycles with
each mark. Root accepts Sol's recommendation to use cycles at the public boundary:
one unit traverses the supplied palette once, regardless of its length. This
removes repeated palette-length arithmetic from the artist's example. It is an
explicit design choice, not a measured corpus guarantee. A corpus entry coordinate
can be converted at the recipe boundary, but its finite-precision relationship to
the eventual sampling algorithm still needs fixtures; algebraic equivalence alone
does not prove exact reproduction. Do not add two public coordinate modes now.

Conceptual use, not an approved signature:

```text
for mark in retainedMarks:
    colour = cyclicPalette.sample(mark.colourCycles)
    drawSuppliedMark(mark.position, mark.heading, mark.length, colour)
```

## Evidence and neighbouring computations

- [`2018/Generativos/pelines#1`](../../survey/out/2018/Generativos/pelines/notes.md)
  names a scalar-driven cyclic adjacent-entry lerp. Its caller multiplies noise
  by palette length and 20. The palette replacement is reported as a large visual
  change, but also affects the background. It does not isolate interpolation
  semantics, establish arbitrary palette-size behaviour or recommend 20 cycles.
- [`2017/Generativos/Cuadricula#1`](../../survey/out/2017/Generativos/Cuadricula/notes.md)
  samples adjacent entries with wrap; column progression and random per-row
  offsets are outside the helper. This is a second use beyond noise-coloured
  strokes. Its parameter records have no measured change scores, so they supply
  computational evidence, not useful parameter ranges.
- [`2018/Generativos/mountain4#2`](../../survey/out/2018/Generativos/mountain4/notes.md),
  the current family representative, describes wrap plus lerp independently of
  its ribbon renderer. Its `dc` experiment reports a moderate change (mean 0.1283,
  43.2% of pixels) from smooth gradients to faster colour bands with unchanged
  geometry. The actual substitutions are `random(0.099, 0.1)` to
  `random(0.3, 0.4)`, not two fixed rates as the frontmatter summary suggests.
  This supports teaching colour progression separately from geometry; it does
  not establish a general recommended interval for palette sampling.
- [`2019/generativos/zozo#1`](../../survey/out/2019/generativos/zozo/notes.md)
  includes `pow(t%1, 0.8)` easing. The palette edit is reported as having no visible
  change. Do not promote an easing knob or promise every palette edit is visible
  from this evidence. A linear sampler is not equivalent to this whole helper.
- [`2019/generativos/paraisooscuro#5`](../../survey/out/2019/generativos/paraisooscuro/notes.md)
  uses a 10.8 power inside the palette interpolation. The separately measured
  `pwr` change concerns spatial band placement, not this interpolation exponent.
  Keep those two controls distinct. Extracting a linear interpolation component
  would require an explicit account of the remaining fractional remapping.

Root's proposed first scope is linear cyclic sampling of supplied colour entries.
Random selection, palette generation/shuffle, noise queries, explicit nonuniform
stop ramps and eased local transitions remain separate investigations. This does
not reject those capabilities. The existing family is an investigation bucket,
not permission to implement all its aliases as one operation.

## Admission and remaining contract review

Root moved exactly `mountain4#2`, `pelines#1` and `Cuadricula#1` into the
operation-level cluster `color.cyclic-palette`. The representative remains
`mountain4#2`. Their audits retain the complete scalar palette computation while
explicitly disclaiming source-exact numeric compatibility. The 50 other provisional
merges in the old family were reopened with their previous decisions preserved;
none received an invented replacement representative. Existing deferred records
remain deferred. Sol independently agreed with this correction. The operation
admission checker passes against the snapshot and note hashes.

The [catalog entry](../../catalog/operations/cyclic-palette.json) now contains the
single authoritative numeric specification. Sol accepted the proposed ordered
binary64 wrapping and encoded-sRGB8 half-up quantization; final review of the actual
contract and rational-oracle fixtures passed: Sol independently matched 115 samples
and 24 index vectors. Root froze version 0.1.0 and implemented the Java core; Luna
and Terra supplied Python and JavaScript against that contract. All three pass the
115 sample fixtures and the independently recomputed 250,000-query checksum
1947414708739. Intermediate index vectors are oracle review evidence; native core
coverage is reported separately. Sol approved final implementation review after adding finite-binary64 query schema
bounds and oversized-integer fixtures. Native integer-to-binary64 normalization is
explicit; a native near-limit rounding check distinguishes it from raw JSON parsing.

The following checklist records the issues resolved by admission and the contract;
it is not an additional public schema:

1. Audit a bounded set of exact members for a new operation-level cluster; preserve
   remaining family records without asserting their equivalence. Record any
   corrected dispositions and component remainders in the authored ledger.
2. Specify a portable colour value, interpolation space, alpha treatment and
   quantization. Do not inherit a renderer's mutable colour mode. The current
   private Java probe's arithmetic is experimental implementation, not authority.
3. Resolve negative coordinates, wrapping versus reflection, finite coordinate
   bounds, empty/single-entry palettes, immutability and ownership. Notes saying
   "wrap" do not settle every edge case or cross-language remainder behaviour.
4. Freeze binary64 evaluation order and native conversion rules with distinguishing
   fixtures. Endpoint selection, last-to-first transition, duplicate entries and
   alpha cases must be observable. No public easing or colour-space option is
   approved merely because the implementation could expose one.

## Acceptance and next work

Sol agrees the existing family is unsafe for direct admission and recommends
the existing `mountain4#2` representative with `pelines#1` and `Cuadricula#1` as a
bounded linear-member review. Root accepts this next scope. Sol also recommends
opaque fixed sRGB8 entries with opacity kept in mark style; this remains a proposal
until colour semantics and adapter implications are reviewed. No alpha capability
or source-exact interpolation claim follows from this recommendation.

Complete operation admission and its contract
before delegating ports. Replace private palette arithmetic in the CP1 probe.
Check that palette edits leave retained geometry unchanged and that the same
samples style a different mark. Inspect the outputs rather than relying only on
schema checks. Treat candidate-design agreement, corpus reproduction and actual
host support as separate evidence.

No missing user approval, incomplete survey or unavailable upstream images blocks
this design work. Missing baseline images limit a later reproduction claim; they
do not prevent building and inspecting a new native example now.

## Parameter evidence decision

Retain supplied palette entries and phase as necessary inputs to the evidenced
computation. Approve no default palette, default phase, encouraged palette size or
cycle-rate range. The meaningful artist control is progression/recolouring, supported
by the cited notes; exact colours remain supplied artwork. The empty-list exclusion
is semantic (there is no colour to return), RGB24 limits define the representation,
and the length limit defines shared integer indexing. None is a measured artistic
range. No new render is needed to invent a range that this operation does not offer.
The forthcoming CP1 edit/transfer render remains required for capability acceptance.
