# CP3 architecture: place sized forms, then draw into them

Owner: root. This is the architectural decision for contract preparation, not approval
of public code or a frozen JSON signature. Sol challenged the boundary, source reading,
private code and experiment designs; both reviewers inspected the first five images.
The two-image control supplement has root's visual decision and a separate Sol review.
The public contracts still require independent review and distinguishing fixtures.

## Artist entry and reusable result

Keep two public responsibilities in the sampling module:

1. **Seeded circle placement** (`sampling.seeded-circle-placement-2d`): propose centres
   within a caller-supplied rectangle, draw radii from an explicit small-form-biased interval,
   and keep proposals in order when their radius-dependent exclusion test passes. The artist
   supplies a seed, attempt budget, centre rectangle, radius endpoints and separation scale.
   This is the starter's entry point: it removes RNG handling, proposal loops, collision
   search, ordered acceptance and accounting.
2. **Ordered circle filtering** (`sampling.ordered-circle-filter-2d`): take a finite explicit
   sequence of centres/radii and apply the identical acceptance kernel. This earns its
   separate public role through the authored radial transfer; custom arrangements and
   size distributions should not require reimplementing collision checks.

Both produce owned, immutable accepted centre/radius geometry in proposal order, original
proposal indices and attempted-count accounting. Accepted count derives from the retained
length. An artist associates colours or other metadata using source indices, then draws
rings, inscribed diamonds or their own marks. No style payload, callbacks, renderer objects
or drawing calls belong in these operations. The exact carrier and host accessor spellings
will be specified once in the contracts.

The seeded route streams proposals into the shared acceptance kernel and retains only
accepted geometry. It does not build a giant rejected-proposal array. The explicit filter
validates its finite input fully before pair work and owns detached result geometry; it
must not retain caller arrays. Both calls are eager. No public incremental session or raw
RNG state is needed to support a longer deterministic run with an unchanged accepted prefix.

## Required controls and editing behavior

All geometric controls and seed/budget are explicit, with no approved defaults. The
inspected settings are configurations, not continuous recommended ranges:

- separation scales1 and1.2 visibly distinguish close packing from more open clearance;
- maximum radii64 and32 change the size hierarchy with minimum4;
- minimum radii4 and8 change the finest forms with maximum64;
- attempt counts5,000 and10,000 demonstrate adding placements without moving the prefix.

Changing geometric configuration, seed or budget rebuilds placement. Changing palette or
motif retains it. The runnable starter must demonstrate that lifecycle, show actual
accepted-versus-attempted count and save its cached view. The private images do not yet
establish a functioning editor or successful human introduction.

Separation scale multiplies the sum of radii; it is not a fixed pixel gap. Scale1 permits
tangency in the specified predicate. Positive scales below1 allow circle overlap and must
be described accordingly, without recommending the unrendered source0.96 setting. The
rectangle constrains proposed centres, not whole circles. An example can inset that
rectangle by maximum radius to construct a margin; the operation does not silently add
containment. The explicit filter supports other proposal domains without a domain enum.

## Portable semantics selected for specification

The seeded operation owns xoshiro128**1.1 initialized from an explicit uint32 seed using
two SplitMix64 outputs, packed low/high words as established by the independent oracles.
Each attempt consumes four unconditional units in x,y,u,v order. Map the radius as
`min + ((max-min)*u)*v` with separately rounded binary64 arithmetic. Rejections consume
all four units. Colour draws never share this stream. This is deliberate portable package
behavior, not Processing random-stream compatibility.

Map each centre axis in two separately rounded binary64 steps: `scaledX = width * ux`,
then `x = scaledX + originX`, and likewise for y. Check proposal arithmetic for nonfinite
results and fail the whole call with the original proposal index and stage; even the
first proposal must not retain an invalid centre merely because no pair comparison runs.
Zero attempts never evaluates these dynamic stages. Finite rounded results, including
absorption or collapse at large origins, remain the specified generated coordinates.

Use the reviewed ordered squared-distance comparison, with equality accepted, for ordinary
geometry. Require finite centres/origins, positive finite radii and scale, positive finite
rectangle spans, and `minRadius <= maxRadius`. Equal radius endpoints are meaningful;
zero/negative circles and a degenerate rectangular generator are outside this operation.
The explicit filter may still receive collinear or coincident positive-circle proposals.
Zero attempts and empty candidate input should yield empty accepted geometry after static
validation, with no pair comparisons.

Adopt checked all-or-error arithmetic rather than an arbitrary coordinate envelope or a
new robust comparator. Check every named pair-arithmetic stage for nonfinite output;
reject a positive threshold product that rounds to zero, and nonzero dx/dy/threshold
whose square rounds to zero. A dynamic error reports the candidate's original index and
stage, discards the internal prefix and returns no placement result. Do not expose the
index of the compared retained circle: that would unnecessarily constrain future equivalent
search acceleration. The contract must freeze exact stage names, order and fixture outcomes.

This addresses the concrete underflow/overflow counterexamples in
[the numeric investigation](cp3-numeric-boundaries.md). Proposal multiply/add rounding is
separate: a finite collapsed centre mapping remains its defined binary64 result. No general
exclusive geometric upper endpoint or exact real-number non-overlap promise follows from
a finite-precision predicate. Cross-port accepted indices must match exactly; tolerance
must never hide a topology difference.

The reference scan has worst-case quadratic pair work and linear retained storage. An
explicit finite budget authorizes that work; it does not promise a practical worst-case
latency. Any cardinality ceiling must derive from the selected portable storage/index
representation, not the observed200,000-proposal workload. Allocation failure returns no
result and follows the existing host-resource convention. Public performance and memory
validation remains part of implementation across each claimed target.

## Evidence, alternatives and deliberate exclusions

The [walkthrough](cp3-placement-walkthrough.md),
[first decision](../../evidence/parameter-experiments/cp3-placement/decision.md), and
[control supplement](../../evidence/parameter-experiments/cp3-placement-controls/decision.md)
provide task, transfer and parameter evidence. The source audit pins
`2018/Generativos/caramelo#0`, `2018/Generativos/candy#0` and
`2017/Generativos/studio#0` to their reports and upstream MIT source. Their candidates
remain composite evidence, not whole-operation equivalence claims.

The filter alone would leave too much repeated generation code in the artist's sketch.
The seeded convenience alone would force authored/radial arrangements to copy collision
logic. A generic callback/domain/distribution framework adds complexity without evidence
that these two useful substitution points require it. A named radial public generator,
containment modes, maximal packing, Poisson-disk/blue-noise guarantees, spatial indexing,
source RNG compatibility, shadows, glows, rim speckles and nested composition are not
silently included. Their absence does not reject the corresponding artistic idioms.

Discrete occupancy packing, fixed-distance snapped agents and covering subdivision remain
separate mechanisms as established by [the neighbour audit](cp3-neighbor-audit.md). Major
rare-family coverage remains outstanding after this capability. The authored ledger records
both capability-dependency admissions with exact evidence and source remainder accounting.
Both structural prerequisite checks pass. Prepare and review the two contracts before
assigning public implementation.
