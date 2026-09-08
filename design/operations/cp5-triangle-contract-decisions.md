# CP5 triangle contract decisions

Root owns these decisions; this is a design worksheet, not a second operation schema.
Both explicit dependency admissions now pass the Phase 2 prerequisite checker. Root
reviewed the first mapping diagnostic and selected the policies below for catalog drafting.
The endpoint-clamp supplement and distinguishing fixtures are now reviewed; the frozen
catalog inputs and Java implementation authorization are in triangle-points-contract-review.md.

## Artist-facing data and ownership

Both responsibilities produce the same immutable retained planar point result, traversable
without allocating per point. The seeded path owns its stream and takes an explicit count;
the mapping path takes explicit ordered unit-coordinate pairs. Neither draws or chooses
colour, opacity, density, topology or whole-mark clipping.

Use three ordered planar vertices. Preserve their order: permuting vertices changes the
meaning of concentration in caller-supplied coordinates even when uniform area coverage
has the same ideal distribution. No vertex sorting or winding normalization.

The explicit route initially consumes materialized JSON-compatible coordinate pairs, not
callbacks or implicit RNG. Validate every pair before allocating the output-sized packed
buffer; then map in order. Passive input ownership rules exclude concurrent mutation and
active property hooks. The returned result must never retain caller-owned pair lists.
At the investigated 15,680–40,960 points, memory for boxed input pairs deserves observation
but does not by itself justify a second streaming/callback API. The uniform seeded path
must generate directly into packed output without materializing input pairs.

Retain only point geometry, not a reconstruction configuration or serialize alias. A
materialized plain-value output contains points; indexed access exposes size and points,
including an output-buffer path with all-or-nothing writes after validation. Match existing
native carrier/index/error conventions rather than inventing a new set for this operation.

## Selected numeric map for contract drafting

Map the two coordinates u,v through s=sqrt(u), then interpolate B to C by v, and A to that
result by s, independently for x and y. This is algebraically the same square-root
barycentric construction used in the investigated examples, but deliberately changes
floating-point evaluation order to avoid direct weighted-sum overflow.

Selected scalar interpolation L(a,b,t), with finite endpoints and t in [0,1]:

1. t=0 returns a; t=1 returns b.
2. For strictly opposite signs (a<0<b or b<0<a), evaluate a*(1-t)+b*t with separate
   binary64 operations.
3. Otherwise, including any zero endpoint, evaluate a+(b-a)*t with separate binary64
   operations.
4. Clamp that raw result to the closed endpoint interval [min(a,b),max(a,b)], then
   canonicalize a zero result to positive zero. Endpoint branches also canonicalize zero.

Input negative zero is normalized before mapping. No FMA, reassociation or implicit
binary32 conversions. Strictly opposite signs avoid an overflowing endpoint subtraction;
all other differences are finite. Products have magnitude no greater than their finite
factors. An opposite-sign sum cannot overflow; a same-sign raw addition is clamped even
if it overflows to infinity. None of these permitted paths can produce NaN. Thus the final
result is finite and within its endpoint component interval without an epsilon. The clamp
is part of the specified algorithm, not a post-hoc fixture tolerance.

The first 172,800-case bounded diagnostic found no nested-map bound failures and showed
160 direct weighted-sum bound failures. It also supplied endpoint, constant-coordinate and
one-ulp ordering adversaries. The accepted clamp supplement is additional evidence, not a
substitute for the argument above. Per-coordinate bounds do not imply exact real-arithmetic
triangle containment at every floating boundary; document the prescribed rounded map.
Never claim identical private/source bits: those use different arithmetic and streams.

A square root requires an explicit correctly rounded binary64 policy and distinguishing
vectors. Other target implementations remain deferred, not exempt from that future policy.

## Accepted collapsed geometry

Accept every finite triple, including collinear and repeated vertices, as the
continuous collapsed form of the same mapping. Uniform-area interpretation applies only
to a nondegenerate triangle; a collapsed segment is not promised uniform arclength density.
This avoids computing area merely to reject it when a valid small determinant underflows.
It also permits a caller's animated geometry to collapse without changing RNG consumption.
Document it directly rather than naming such cases invalid triangles elsewhere.

An empty output still validates its triangle and all required input fields. A collapsed
triangle with a positive count still consumes the prescribed two seeded units per point;
no special branch may skip observable stream progression. Explicit mapping consumes none.

## Selected stream, count and resource policy

Use the existing xoshiro128**1.1 uint32-seed/two-SplitMix64 expansion and uint32/2^32 unit
mapping. Consume first u, then v, exactly twice per point. No shared host stream or hidden
style draws. Longer seeded counts retain the shorter point prefix under identical input.
Explicit mapping of the same generated units must match the seeded result bit for bit.

Bound count by representability of two scalar slots per point across the current Java
representation, not by an invented artistic maximum. Host allocation failure remains a
host exception; never turn it into a validation claim or partial success. Distinguish that
representation limit from measured runtime/memory observations and example density choices.

## Required failure and verification distinctions

- Reject non-finite coordinates, malformed triples/pairs, invalid seed/count and unit
  coordinates outside the chosen closed unit interval; booleans are not numbers.
- Preserve validation order and atomic point-buffer writes. Failed access must not alter
  destination sentinels or rely on host bounds exceptions as public error codes.
- Require adversaries for direct-sum overflow, opposite-sign difference overflow, endpoint
  identity and weighted-sum versus nested-map rounding, not only ordinary triangle output.
- Check reordered vertices, repeated points, collinear/tiny shapes, empty lists and invalid
  later pair input. No exact area computation should sneak into an accepted collapse policy.
- Carry five shared seed vectors, consecutive units, count prefix, and explicit/seeded
  equivalence through meaningful native fixtures. Distribution metrics supplement them;
  no finite sample histogram proves an exact continuous uniform law.

## Concrete data conventions for the catalog drafts

The seeded required fields are seed, count and triangle. The mapping required fields are
triangle and unitCoordinates. No optional fields or defaults; reject extra keys. Triangle
is exactly three pairs; unitCoordinates is an ordered list of pairs in closed [0,1].
Count and pair-list length are bounded at 1,073,741,823 to fit two scalar slots under the
current shared signed-index representation limit. That is not an allocation guarantee.
Output materialization is {points:[[x,y],...]}; no seed, config, IDs or count alias is retained.

Static seeded validation order is record keys, seed, count, then triangle rows/coordinates.
Mapped validation is record keys, triangle rows/coordinates, outer unitCoordinates length,
then each pair and its u/v coordinates in order. Validate all required data even for empty
output. Common validation failures use INVALID_INPUT. Access follows existing INVALID_INDEX,
INDEX_OUT_OF_RANGE and INVALID_OUTPUT precedence with atomic destination writes.

Java uses one TrianglePoints2D result class with seeded(Object) and map(Object) factories,
size(), pointAt(Object|long), pointInto(Object|long,double[],int) and toValues(). Passive
Map/List and ordinary Byte/Short/Integer/Long/Float/Double carriers follow CP4 conventions;
no arrays/PVector input aliases, arbitrary Number subclasses or boolean-as-number coercion.
JavaScript/Python keep the same plain data and established target accessor conventions.
