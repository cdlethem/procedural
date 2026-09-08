# CP3: arrange forms, then change what occupies them

Root's whole-sketch design walkthrough. This is a conceptual example, not a runnable
prototype, a user test, a frozen contract or an approved parameter range. It follows
the [source audit](cp3-packing-source-audit.md) and [Sol review](cp3-spacing-review.md).

## The piece and the burden removed

An artist starts with a surface of differently sized rings. Each ring has a reserved
circle around its centre. Placement accepts proposed circles in order, keeping a
proposal only when its exclusion rule permits it alongside all previously accepted
circles. The artist changes the palette or replaces rings with inscribed diamonds
using those same retained centres and radii.

The library removes the repeated collision search, acceptance ordering, deterministic
proposal generation and work accounting. The example keeps the motif, colour assignment,
stroke treatment and composition controls visible. The operation produces geometry;
it does not draw candy bodies, shadows, glows or a completed scene.

Root selects two related responsibilities for independent review:

- A seeded rectangular placement convenience is the tutorial entry. It owns the
  proposal stream and a finite attempt count. The artist supplies a seed and geometric
  configuration, without assembling candidate arrays or manipulating RNG words.
- An ordered circle filter accepts explicit centre/radius proposals and returns
  accepted geometry with original proposal indices. It is the entry for authored,
  radial or externally supplied arrangements. The convenience feeds the same internal
  acceptance kernel incrementally; it does not retain every rejected proposal or
  implement a second collision algorithm.

These are proposed responsibilities. Names and signatures will be frozen only after
the usage and parameter investigation are reviewed. No generic callbacks, arbitrary
payloads or renderer objects are needed in the portable result.

## First pass through the starter

The initial private prototype will use a 640×640 canvas and 5,000 proposals, with a
fixed seed of 42. Candidate centres lie in a rectangle inset from the canvas. Radius
endpoints of 4 and 64 pixels are prototype configuration, not source literals,
defaults or recommended bounds. Root proposes `minRadius + (maxRadius-minRadius)*u*v`, with independent unit
values `u` and `v`, to favour smaller forms. This is a package design informed by the
audited product distributions, not an exact source mapping. It is not uniform in radius.
The proposed private stream is xoshiro128** 1.1, initialized by two SplitMix64 outputs
from a uint32 seed; see [the comparison](cp3-rng-options.md). Four units per proposal
are consumed in x, y, u, v order, including for rejected proposals. No host RNG or
public raw state is involved. These choices await independent review.

The first view draws one ring per retained placement and shows “accepted A of 5,000
proposals.” This reports actual output; it does not pretend that 5,000 is the desired
number of rings. Ring construction can use ordinary editable segment geometry and
the existing drawing route. Circle packing does not require a new public ring
renderer. Tessellation and stroke width belong to this example and need visual review.

Try one edit at a time:

| artistic intention | proposed edit | what should happen |
|---|---|---|
| Make more room around forms | increase the separation scale, keeping the same proposal stream | recompute acceptance; report the new accepted count |
| Make the forms smaller | reduce the maximum proposal radius | rebuild proposals and acceptance; do not promise that centres stay fixed |
| Try a new arrangement | change the explicit seed | rebuild placement reproducibly |
| Continue filling available gaps | increase the attempt budget | retain the exact accepted prefix from the shorter run, then append any later acceptances |
| Recolour the piece | change the palette | retain the placement object and every accepted centre/radius/index |
| Replace rings with diamonds | replace the mark construction | retain placement; keep each diamond inside its reserved circle |
| Keep the result | save the displayed canvas | save the cached view without drawing or proposing again |

Geometry is generated before style. A palette or motif edit consumes no placement
randomness. This is an intentional usability divergence from source sketches with
colour/dust draws before packing. It does not reproduce their original random stream.

## What separation means

Root proposes a dimensionless scale on the sum of the two radii, with strict rejection
when centre distance is less than that threshold. A scale of 1 permits tangency.
Values below 1 permit overlap; values above 1 reserve size-relative clearance. This
is not a fixed pixel gap and must not be labelled simply “gap.”

The source conversions motivating investigation are explicit: outer `caramelo` and
`studio` use 1 after diameter-to-radius conversion; `candy` uses 0.96; nested `caramelo`
uses 1.2. These literals establish mechanisms, not an encouraged interval. Before
exposing the scale, a bounded experiment must establish that the proposed control is
visible and useful in the prototype and that overlap is taught honestly.

The initial convenience should use a centre-placement rectangle. A circle may extend
outside it. This matches the outer rectangular proposal mechanism and preserves a
clear full-bleed option. Whole-circle containment is a different constraint; it must
not appear as an undocumented side effect of shrinking the proposal rectangle by
each radius. If an artist needs an outer margin, the example can inset the centre
domain by the maximum radius and explain that construction. A first version need not
add a containment enum merely because one can be imagined.

## The substitution that earns the filter

Replace seeded rectangular proposals with an authored radial arrangement: create a
finite list of centres along several concentric rings, assign radii from an explicit
small list, then pass those circle proposals through the same filter. The artist now
controls radial bands, angular spacing and proposal order without rewriting collision
checks. The source `studio` motivates a radial alternative; this authored arrangement
is a design transfer test, not a reconstruction of its random radial distribution.

The filter returns each accepted proposal's original index as well as its geometry.
The example can use a parallel list of per-proposal colours or motifs. The library
does not need to carry arbitrary style payloads. Reordering the proposals is expected
to change the accepted set: large-before-small and small-before-large should produce
distinguishably different outcomes in a fixture and a readable explanation.

Both examples then share the same drawing loop. This is the central composition
test: swapping proposal generation changes arrangement while retaining collision
semantics and the mark treatment. If this transfer requires copying packing logic,
the boundary has failed.

## Decisions before contracts and implementation

1. Freeze the private portable stream, seed mapping, unit interval and exact draw
   consumption. A private algorithm may later serve a public seeded session; that
   future possibility is not permission to introduce an unspecified session now.
2. Settle the small-form size distribution and explicit separation-scale semantics.
   Keep source observations, design configuration and measured useful settings distinct.
3. Specify binary64 comparison order, overflow/underflow and tangency. Accepted indices
   and topology must match exactly across ports; a numerical tolerance cannot hide a
   different accept/reject decision.
4. Specify immutable retained outputs, zero attempts, invalid/degenerate proposals,
   rejection accounting and all-or-error behavior. Avoid exposing internal comparison
   counts as a public promise that would prevent output-preserving acceleration.
5. Define distinguishing fixtures and representative performance measurements, including
   the surveyed 200,000-proposal workload. Measure comparisons, accepted count, elapsed
   time and storage. Bounded attempts alone do not establish that a workload is practical.
6. Register a small private visual experiment for separation and size, then let its
   observations change the parameter decision before publishing a contract. Reuse the
   same proposal stream for separation comparisons to isolate acceptance from randomness.

The occupancy-grid and snapped-agent neighbours remain separate, as recorded in
[the neighbour audit](cp3-neighbor-audit.md). Subdivision remains a covering-partition
capability rather than another placement mode. This walkthrough makes no keep/merge
claim about any whole surveyed helper and no four-target support claim.
