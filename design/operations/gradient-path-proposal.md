# Gradient path contract proposal

Status: root draft following the [CP2 architecture decision](../capabilities/cp2-architecture-decision.md).
Not admitted to the catalog or implemented as a public operation. The bounded visual
experiment and remaining semantic review precede admission. This document resolves the
whole-sketch responsibility into one candidate operation; the catalog will be the sole
normative schema after review.

## Identity and artist-facing use

Proposed identifier: `path.gradient-trace-2d`, native concept `GradientPath2D`.
Naming the currently supported field avoids suggesting that arbitrary force fields,
callbacks, simplex sources or animated agents are already interchangeable inputs.

An artist constructs an explicit gradient field, calls a complete eager trace with a start
and movement settings, then reads that returned path as often as needed. The path exposes
its point count, step count, an indexed point and an indexed sampled heading. A
caller-supplied numeric buffer route avoids allocating a point object at every mark.
There is no one-step integration API to reconstruct in the sketch. Java and Android
share the core; JavaScript and Python implement the same portable contract independently.

## Proposed configuration and result

One serializable configuration contains the existing field's seed-only configuration,
start pair, integer steps, step distance, scalar field scale, field-offset pair, angle
base and angle scale. All are explicit; no artistic defaults or encouraged intervals
are inferred. A native convenience accepts the existing immutable field value and resolves
to the same serialization. A scalar field scale is sufficient for this evidenced first
operation; affine matrices, rotations and anisotropic scaling do not enter by accident.

The complete result privately owns a packed array of 2(N+1) position coordinates and an
array of N headings. Point zero is the supplied start. Heading i is the value used for
movement from point i to point i+1. Counts and traversal indices are exact. Returning
read-only views must not leak mutable arrays or aliases across targets; point-copy methods
and serialization return detached data. Replay does not invoke the field or trigonometry.
The result needs no renderer, global RNG, host clock or mutable callback.

Explicit eager `trace` authorizes its O(N) work. Configuration construction or validation
alone never computes a trajectory. Check packed-length integer overflow before allocation.
The representational ceiling must be derived once for the shared layout and all ports;
it is not a practical memory guarantee or an artist range. Incidental allocation failure
returns no path and stays distinguishable from invalid configuration. Measure the 2k/16k
per-path and 24-path example workloads before imposing another package limit.

## Proposed arithmetic and failure order

Static validation: exact known configuration keys and passive types; finite numeric fields;
start/offset tuple shape; integer nonnegative steps with layout-safe count; then field
construction under its existing unsigned seed contract. Reject booleans as numbers in every
port. The final contract must fix property-validation order and stable error details.

For each i from zero to N-1, with all listed operations separately rounded binary64:

1. qx = x * fieldScale; qx = qx + fieldOffset.x; likewise qy.
2. Sample the named field at (qx,qy), applying its existing query-domain checks.
3. mapped = angleScale * sample; heading = angleBase + mapped.
4. dx = stepDistance * hostCos(heading); dy = stepDistance * hostSin(heading).
5. nextX = x + dx; nextY = y + dy.
6. Store heading i and point i+1, then advance x/y to that point.

Never normalize angles, clamp positions, close a shape or round movement to binary32.
Validate finite computed queries, heading, displacement and endpoints at their respective
stages. A dynamic failure identifies its step index and stage and returns no retained
path. A final endpoint is not sampled again merely to validate a hypothetical next step;
otherwise N-step execution would perform an unrequested query. Zero steps performs no
field queries and returns the start, after static validation. Prefix identity applies
when both requested traces succeed on the same target.

Step distance nonnegative versus signed is still a semantic review item: the evidenced
first task is forward stepping; zero should remain a deliberate stationary degenerate
case rather than silently reducing count. Angle scale may be zero or negative; field scale
zero yields a constant queried field and negative scale reflects coordinates. These are
mathematical behaviors, not observed useful artistic settings.

## Numerical promise and tests

Within a pinned target/runtime and unchanged configuration, replay and the shared prefix
are exact. Cross-target sine/cosine and consequent feedback coordinates use explicit
per-fixture tolerances; the current diagnostic does not establish universal same-seed bit
identity or a global error bound for arbitrary valid configurations. Record sampled
headings and intermediate positions as well as endpoints. Android numerical execution
remains required alongside Java/JavaScript/Python. Preserve fixture constants as diagnostic
or example inputs, not a continuous recommended parameter range.

Distinguishing fixtures must cover actual position-dependent feedback, initial/final point
inclusion, zero/one steps, stationary steps, count-prefix, step-distance changes, mark
attachment, negative coordinates and maps, non-finite intermediates, field-domain failure,
size overflow, error order, detached ownership and zero-query replay. The visual experiment
covers independent segment traces and perpendicular marks; it does not imply joined-stroke
or source-pixel equivalence.

## Candidate accounting to prepare

Ciserp#0 supplies the integrated movement need but includes seed population, signed simplex,
mark jitter/envelopes, perpendicular strokes, endpoint dots, white trail and palette mixes.
Mantel#0 motivates finite motion-to-polyline but its scene closes and fills the path.
Natalata#0 includes size/envelope modulation and mixed mark timing. Limo002#1 contains
multiple trajectories and branch creation. None is a whole-computation merge into this
named gradient tracer. Admit the independent capability dependency with exact note/evidence
hashes and explicit remainder accounting; leave unresolved family records visible. The
existing `path.flow-trace` family is not a ready operation merely because it has provisional
members. No broad ledger reassignment is authorized by this draft.
