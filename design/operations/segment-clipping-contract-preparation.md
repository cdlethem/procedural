# Segment clipping contract preparation

Root decisions for catalog authoring after the reviewed capability-dependency admission.
This document is not a parallel schema or a frozen contract. The catalog will be the sole
behavioral authority; fixture and production work must wait for its review.

## Required resource policy

Use required `maxWork` and `maxOutputSegments` values, without defaults. For V polygon
vertices and S source segments, preflight the exact integer allowance:

    W = V*V + S*(8*V*V + 16*V + 8)

W is a conservative, declared geometry-work charge, not a measured time, byte count or
literal count of BigInteger operations. It covers quadratic polygon validation plus the
cut/midpoint approach: at most 2V+2 cut candidates, at most 2V+1 classification intervals,
V edge checks per interval, and sorting/comparison overhead. Coefficients are engineering
accounting choices. Bit-level integer arithmetic cost and host allocation remain distinct.
The maximum bit sizes are bounded by finite binary64 inputs and this fixed algorithm;
iterations never feed new calculated geometry back into a recurrence.

Compute W with exact integer arithmetic or a provably equivalent overflow-safe comparison.
Reject before polygon topology tests or output allocation when W exceeds maxWork. An empty
source list still validates its polygon and pays V². Do not allow an empty batch to bypass
invalid polygon detection. maxWork may be zero; valid polygon size then necessarily exceeds
it. Permit at most the portable safe integer ceiling 9007199254740991, not a practical
recommendation. Public array size limits must additionally respect packed Java storage.

maxOutputSegments limits retained intervals, not source segments, points or cut candidates.
Zero is useful for callers requiring empty output. Check the next retained interval before
appending it; fail instead of truncating. Apply output capacity before dynamic rounding
errors for that interval. An exact preflight worst-case output reservation is unnecessary:
use bounded growth, not an allocation equal to the caller's maximum.

## Validation and failure order

1. Validate the entire passive input record, exact keys and every numeric carrier/shape in
   declared order, including both limits. Normalize signed zero. Input validation precedes
   all budget, polygon-topology and generated representation failures.
2. Compute W and reject insufficient work allowance.
3. Validate polygon topology exactly, including all vertices even with no source strokes.
4. Traverse source segments in input order. Omit zero-length sources. Compute exact cuts,
   sort/deduplicate, classify and merge contiguous retained intervals.
5. For each retained interval: output capacity, collapsed rounded t interval, collapsed
   rounded endpoint pair, then collapsed exterior t gap from previous interval of the same
   source. Append only after all applicable checks. Return no result on any failure.

Dynamic representation errors need source index and interval ordinal plus a distinct stage
(parameter interval, endpoint pair, exterior gap). A later error must not retroactively
expose partially retained output. Host allocation failures remain host failures, not invalid
input or successful truncation. Indexed result access follows established invalid-index,
range, destination precedence and validation-failure atomicity.

## Next fixture obligations

Keep the existing exact oracle cases, but add public input/order/budget tests independently
of the prototype. Distinguish W versus W-1, a zero-output budget with empty/nonempty results,
invalid late source data versus insufficient budget, and invalid polygon with empty sources.
Include exact-rational rounding ties, extreme finite scale, all polygon validity witnesses,
multiple concave intervals and both representation-collapse witnesses. Test source identity
with skipped and split inputs, detached exports, atomic Into failures and preservation of
input arrays. No randomized bulk count is required to establish these named behaviors.
