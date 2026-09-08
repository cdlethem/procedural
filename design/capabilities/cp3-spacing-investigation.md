# Next capability: scatter forms with room between them

Root investigation, after the two field capabilities. This selects the next design
question; it does not freeze an API, merge candidates or approve parameter ranges.

## Source-review continuation

The [pinned source audit](cp3-packing-source-audit.md) and
[independent review](cp3-spacing-review.md) are now available. Root read the decisive
outer and nested `caramelo` loops, `candy` loop and `studio` loop directly. Their
stored sizes are diameters: the outer `caramelo` and `studio` thresholds use half
the diameter sum and permit tangency; `candy` uses 0.48 and permits slight overlap.
The nested `caramelo` loop uses 0.6, so its threshold is 1.2 times the sum of radii.
That size-relative clearance differs from a fixed pixel gap. These are distinct
configurations, not evidence for silently calling every helper non-overlapping.

Root adopts Sol's distinction between the artist entry and the lower-level kernel:
the complete example must own seeded proposal generation and bounded work. An ordered
explicit-proposal filter earns a public interface only if the radial/nested or authored
placement transfer actually needs it. Both routes should share acceptance semantics;
the artist should not reimplement the collision algorithm to change a motif.

Next resolve the seed/proposal interface and execute a paper walkthrough before
contract work. Proposal-domain containment, inter-form clearance and output accounting
must be separate decisions. The remaining sections preserve the initial investigation
and its evidence limits; their source-unit question is resolved by the audit above.

## Why investigate spacing next

The artist task is to arrange forms of different sizes without manually checking each
new form against all the earlier ones. The returned placements should remain reusable
when the artist changes colour or draws another motif inside each form. This adds a
spatial constraint to composition, beyond the existing regular grid and field movement.

Root selects size-aware circle placement for the next capability investigation, ahead
of recursive cell subdivision. This is a design priority: exclusion and reuse of
placements open a new compositional decision. It is not a claim that packing is more
frequent or that artists prefer it. Subdivision remains retained for investigation;
the choice does not reject its family or Delaunay operations.

The end-to-end example should make these edits understandable: change the space allowed
for each form; change the size distribution; recolour the same accepted placements;
replace the motif without running placement again. A fixed attempt budget must report
how many forms were actually accepted. It must not promise an arbitrary requested count
in an already full region or hide an unbounded search.

## Decisive evidence read by root

| exact candidate | computation described by the report | implication and unresolved detail |
|---|---|---|
| [caramelo #0](../../survey/out/2018/Generativos/caramelo/notes.md) | sequential proposals, reject against earlier circles; repeated inside parent circles | retain accepted centre and size independently from the candy renderer; distinguish outer and nested proposal domains |
| [candy #0](../../survey/out/2018/Generativos/candy/notes.md) | 200,000 proposals, pairwise distance threshold scaled by the sum of sizes | attempt count is work, not output count; factor 0.48 allows a different overlap rule from exact non-overlap |
| [studio #0](../../survey/out/2017/Generativos/studio/notes.md) | radial proposals around a centre, varying sizes, rejection before drawing segmented rings | proposal distribution and spatial acceptance are separate responsibilities; ring style does not belong inside packing |
| [mosaic02 #0](../../survey/out/2018/Generativos/mosaic02/notes.md) | select an existing rectangle from a list prefix and replace it by four quadrants | subdivision creates a covering partition, unlike spacing; a general scatter operation must not absorb it |

The reports call several helpers “Poisson” or “Poisson-like.” That does not establish
Bridson sampling, maximal packing, a blue-noise guarantee or equivalent candidate streams.
Any public operation name must describe the algorithm we actually specify.

There is a material unit problem in the packing notes. `caramelo` calls `s` a radius,
but describes drawing an ellipse of size `s` and an exclusion threshold `(p.z+s)*0.5`.
Those statements suggest a diameter-valued source variable. `candy` has the same naming
risk. Root has not yet checked the pinned upstream source for the exact drawing mode
and comparisons, so radius conversion and tangency behavior remain unresolved. No
candidate merge or signature should inherit these words uncritically.

The `candy` speckle explanation also describes `acos(random(PI))` as a rim distribution;
that expression can take values outside acos's real domain. This is a warning about
the report's explanation, not a reason to import that formula into a sampler. Speckle
placement is outside this capability's initial boundary.

## Parameter evidence and design alternatives

`caramelo` reports a large change when the maximum relative size changes from 0.5 to
0.25. It also explicitly reports a reshuffled layout, so this is whole-composition
evidence, not a controlled proof of size alone. `studio` reports moderate changes for
maximum size 320 to 120 and radial extent `cx*1.5-s` to `cx*2.0-s`. These motivate size
and placement-domain questions. They do not justify a continuous recommended range.
`candy` has no scored variants for its packing factor; its `none` row has no trials and
must not be read as a measured finding that spacing has no effect.

Two boundaries need a complete usage walkthrough before selection:

1. A deterministic ordered-proposal filter removes collision checking and returns
   accepted placements. It is composable, but by itself leaves users to implement
   candidate generation, seed handling and size distributions.
2. A seeded placement convenience also owns proposal generation and bounded attempts.
   It is useful only if the proposal choices are clear and it composes the same
   acceptance behavior. It must not become an opaque candy-making helper.

The usable package may need both levels. A tiny filter that leaves the difficult
setup to each artist would fail the build brief. Conversely, a single function that
combines placement, shadows, rings, palette draws and nested decoration would obscure
the decisions the artist needs to control.

## Work before a contract

- Inspect the pinned source revision for diameter/radius, tangency, candidate order,
  rejection comparisons, proposal distributions and RNG draw consumption. Preserve
  exact candidate identities and evidence hashes in the eventual admission decision.
- Compare nearby minimum-spacing, occupancy-grid and circle-packing candidates at the
  computation level. `persons06` motivates spacing as an artist task but its animated,
  grid-snapped five-pixel exclusion does not establish this packer's semantics.
- Specify the artist's seed interface and deterministic stream behavior. The package
  has a seeded field but no general public RNG contract yet; do not silently borrow a
  host RNG or force artists to manage raw state words.
- Walk through one complete bounded placement example and a motif substitution, then
  ask Sol to challenge the public/private split. Explicitly decide what is a value,
  what is a reusable operation, and what stays editable composition code.
- Follow parameter-evidence and operation-contract workflows for any proposed exposed
  controls. Design meaningful work/memory benchmarks and exclusion/order fixtures
  before choosing an optimization. An acceleration structure must preserve accepted
  order and observable comparisons, not change the composition to make tests fast.

No new packing implementation, RNG contract or public parameter is approved by this
investigation. Its result is a concrete next decision and the evidence needed to make it.
