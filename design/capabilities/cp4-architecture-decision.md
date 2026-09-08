# CP4 architecture: generate regions, then compose within them

Root admits `layout.seeded-quadrant-partition-2d` for contract preparation after reading
the decisive sources, comparing the source scheduler with actual Processing RNG, and
inspecting the five-image private walkthrough. Sol review is paused by the maintainer;
root owns this architectural decision and the subsequent contract review.

## Entry point and burden removed

The artist supplies an explicit rectangle, seed, replacement count and eligible-list
fraction. The operation repeatedly selects a live leaf and replaces it with four equal
quadrants. It returns owned, immutable leaf bounds and creation identities in live-list
order. The artist draws a panel, central motif, repeated marks or their own content inside
each rectangle. There are no renderer objects, content callbacks or implicit global RNG.

This is a cohesive generator, not a public collection of list-mutation primitives. Its
value is eliminating seeded selection, iterative leaf replacement, identity bookkeeping
and safe retained geometry. RegularGrid can supply mark positions *within* a cell but
cannot provide a varying-depth partition by itself. A four-corner interpolation primitive
would leave the substantive algorithm in each sketch.

Creation identities belong to one run: root identity zero, new children receive consecutive
identities in their declared creation order. Removing another leaf does not change an
existing identity. Different seeds or policies have no promised identity correspondence.
Style edits reuse the retained result; geometry edits regenerate it. Return no adjacency,
parent tree, split history or mutable session until a real workflow requires them.

## Specific semantics to carry into the contract

Use axis-aligned geometry with equal half splits, append children TL/TR/BR/BL and then
remove the selected parent. Selection uses the fraction of the current *ordered list*,
including its fractional last index weight for odd lengths; do not round the eligible
count before sampling or relabel this as size weighting. Fraction 1 exposes the whole
list. Positive fractions through 1 are mathematical policy inputs; no recommended
continuous range or default is established.

Own a private xoshiro128** 1.1 stream with the existing uint32-seed/Two-SplitMix64 expansion
used by circle placement. Consume one unit per replacement, with no background/style
prelude. This is an explicit portable design divergence from both Processing's source
stream and the private JavaRandom walkthrough. Freeze the mapping and arithmetic in the
catalog and exercise actual public-code examples before claiming delivery.

Require positive finite rectangle extent and an explicit nonnegative replacement count.
Preserve shared split boundaries, positive child interiors and deterministic order. A split
whose midpoint cannot be represented strictly inside its parent must fail explicitly,
without silent skipping, clamping, infinite work or partial success. Formal input/error
precedence, finite endpoint checks, output carrier, accessors and representational count
limit are specification details to resolve in the contract; the algorithmic boundary is
fixed here. Do not invent a small canvas range to hide floating-point edge cases.

Use eager execution and immutable output. Avoid per-mark allocation in traversal and
benchmark practical leaf counts. A representational maximum is not a practical workload
recommendation. The seed/fraction/count are required inputs with no implicit defaults.

## Evidence and deliberate limits

`2018/Generativos/mosaic02#0` motivates equal quadrants and ordered-fraction selection;
`2018/Generativos/mosaic#0` is supporting equal-quadrant source evidence, with pending
parameter records. Their whole source computations remain in their existing unresolved
family: this independent stream and retained result do not reproduce Processing float
arithmetic, source preludes, shading or mesh generation. The original family is not merged.

The [source audit](cp4-partition-source-audit.md),
[native numeric check](../../evidence/investigations/cp4-selection-java-check.json), and
[private visual decision](../../evidence/parameter-experiments/cp4-regions/decision.md)
record the evidence and the conflicting survey prose. All five native images succeeded;
301-to-601 leaves, changed selection and retained-content substitution were inspected.
These discrete settings justify the controls' usefulness in a piece, not continuous ranges.

`chinasseForms` has variable grid dimensions and skipped undersized passes; `NeoGeo`
has unequal random cuts. Neither is equivalent to this generator. Explicit 2×3 refinement
stays in the example/private route after its transfer test: ordinary cell bounds already
provide the substitution point, and this test does not justify a public mutation engine.
Binary, integer-grid, warped quadrilateral and 3D subdivisions remain separate future work.
No major family is rejected by this choice.

## Acceptance and implementation order

First record the dependency admission and pass the architecture prerequisite check. Then
freeze one language-neutral contract and distinguishing fixtures: seeded outputs and RNG
consumption, odd-list fractional selection, child order and creation IDs, count zero,
finite/degenerate bounds, representability failures, all-or-error ownership and detached
access. Compare topology and identities exactly; do not introduce a broad epsilon.

Implement Java first with a complete RegionMarks native example. Verify geometry reuse
under motif/palette edits, regeneration under seed/count/selection edits, the editable
ordinary-cell content substitution, and saving the displayed canvas. Re-evaluate visual
behavior under the actual portable stream; the private investigation is not its oracle.
Package and document only the validated Java scope. Defer ports to the agreed batch.
