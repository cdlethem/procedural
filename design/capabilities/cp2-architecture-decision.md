# CP2 architecture decision: retain one reusable path

Root decision after Sol's independent challenge, 2026-09-07. This accepts the capability
boundary for contract preparation, not a finished operation or a visual reproduction.
The [proposal](cp2-integrated-paths.md) and its root-read evidence remain the rationale.

## Accepted boundary

The package will compute a complete finite, fixed-step two-dimensional feedback path.
At each index it transforms the current position into field coordinates, samples the
explicit field, maps the scalar to a heading in radians, computes one displacement, and
advances. The output retains N+1 positions and N sampled headings in immutable packed
binary64 storage, with indices implicit. The initial position is included even for zero
steps. No automatic closure, clipping, boundary collision, forces, branching or time state
is implied. Those are separate computational choices.

A replayable indexed view gives artists each movement's start, end and sampled heading.
Perpendicular marks in the first example attach explicitly to the end position. Other
examples can use the start; that is not another integration algorithm. Index and requested
count remain available for artist-defined envelopes. The core will not store a progress
value with a hidden zero/one-step convention.

Root accepts Sol's correction to the initial two-route proposal: first implement one
retained per-path result. Process starts sequentially and feed existing bounded drawing
batches. A second streaming-generation API is deferred unless measured per-path cost
requires it. It would introduce cancellation and partial-result semantics before its
value is demonstrated, while weakening the immediate replay/recolour use case. At 16,000
steps, the raw position/heading payload is 384,016 bytes per path; this is a calculated
storage size, not measured runtime memory or a universal budget. Retaining many paths
still needs an explicit example workload and measurements.

An explicit eager trace call with its step count authorizes that O(N) work and retained
result. Creating/validating a configuration remains O(1) and never traces. Root accepts
Sol's follow-up: do not require redundant maxSteps/maxOutputBytes inputs. Validate the
packed-layout representational count ceiling before allocation; measure practical example
budgets separately. Incidental host allocation failure produces no partial trace and is
not a numerical input error. A package execution ceiling would need measured process-safety
evidence and its own versioned error policy, not an invented artistic range.
A failed complete trace returns no path. Precise validation order and failure codes remain
contract work; previously completed independent paths need not be discarded.

## Field and numerics

Initially the admitted field carrier is the existing named GradientNoise2D01 configuration,
with explicit coordinate scale/offset and angle base/scale. The mathematical sampler seam
is useful for internal testing, but there is no new public callback protocol, operation
registry, expression graph or one-member tagged union. The existing seed-only field
configuration is sufficient interchange data for this first carrier. Native convenience
may accept the existing immutable field value if serialization resolves to that same
configuration; it must not imply arbitrary sampler support.

This is an explicit technique-level substitution for ciserp's signed toxi simplex. Affine
mapping of [0,1] to signed angle intervals does not make the fields equivalent. Root will
inspect a bounded visual example before accepting that it delivers wandering paths and
reusable perpendicular marks. Simplex remains a distinct possible field admission if
visual evidence or another capability warrants it; it is neither silently supported nor
rejected. The straight-line check uses angleScale=0 or an internal constant sampler. It
does not add a public constant-field operation merely for a fixture.

All movement state stays binary64. Drawing's binary32 conversion happens downstream and
must never feed back into field queries. The existing noise evaluation is exact under its
specified arithmetic, but host sine/cosine agreement is a separate issue. The preserved
20-case Java/JavaScript/Python feedback diagnostic found position disagreement up to
4.43e-12 in the tested 16,000-step paths. Root accepts Sol's recommendation to specify
fixed-order host binary64 sine/cosine, exact within-target prefix/replay, and explicit
per-fixture cross-target tolerances. This is not universal bit-identical geometry or a
universal bound over arbitrary finite high-gain inputs. Android remains a required native
numerical target before the four-target claim. A separately specified portable trigonometry
implementation is warranted if future product requirements demand universal bit identity;
it is not smuggled in as an unreviewed dependency now. Neither renderer pixel tolerances
nor this bounded matrix can establish broader numerical claims.

## Complete artist check and next gate

The first example must draw a set of paths, reuse the identical retained paths for
perpendicular marks, recolour without recomputing movement, and distinguish changing the
step count from changing step distance. Increasing count preserves the old movement prefix;
changing distance generally changes subsequent field queries. Layout, mark length and
palette stay independent visible choices. The artist does not reimplement the trace loop.
Independent segment drawing is an explicit rendering route, not a claim of joined-polyline
stroke equivalence.

Before implementation, root will record exact candidate extraction/remainder accounting,
resource and failure semantics, numerical policy, and the authoritative catalog contract.
Sol will review those semantics. Parameter and visual/performance experiments must bind a
specific configuration and acceptance before execution. The native four-target example and
edit checks remain required for I2 acceptance. I1 remains accepted; no other major family
or downstream milestone is declared complete by this decision.
