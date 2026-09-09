# Nearest closed-segment contact — dependency admission

Root architecture decision,2026-09-08. Admit an independently specified geometry dependency
for implementation-contract preparation. This is not implementation/native acceptance.

Artist task: shorten directed strokes at their first obstacle contact, retain the obstacle
identity for decoration, and edit obstacles without regenerating the strokes. Exact segment
intersection, overlap handling and nearest ordering are the nontrivial burden removed.
SegmentClip2D returns inside intervals of a polygon and cannot substitute for this query.
Raster masks only alter visibility. A source-specific ray-web generator would hide useful
substitution points behind pass/order/extension flags.

Motivation: plasma007 candidate#2 and pinned source/notes in vector-clipping-source-review.json.
Root has read both; nearest-hit-direction.md records their discrepancy. The dependency uses
finite directed query segments and a separately supplied obstacle list; it is not equivalent
to the source's suffix-only/drop/re-extend two-pass composition. Rays, same-origin group
exclusion, pass sequencing, miss filtering, decoration and fan layout remain consumer work.
The source's accidental axis-aligned rejection and strict box-extent tests are corrected.
No source code is copied. Ports and original-sketch recreation remain unvalidated.

Evidence/parameter-experiments/nearest-contact/root-review.json records13exact witnesses and
root-viewed native images of precomputed ray-web and boundary-connector data. Both have a
visible input edit. The connector transfer is explicit project design, not an additional
survey occurrence or accepted Java workflow. This evidence justifies a small query operation;
production Java must still reproduce the exact cases and support an editable native example.

## Frozen semantic boundary for contract preparation

One batch consumes finite binary64 query quadruples, obstacle quadruples and maxWork.
No defaults. Output has one nullable contact record per query, preserving query order.
Contact record: obstacleIndex, t and point[x,y]. A miss is null; it does not drop the query.
No automatic exclusions: a caller includes precisely the obstacles they want tested.

Queries and obstacles are closed segments. Include endpoint/origin contact. For a collinear
intersection interval, select its onset along the directed query. Point obstacles are valid;
a zero-length query returns t=0 when its point belongs to any obstacle, otherwise misses.
Choose the smallest exact t, resolving ties by smallest obstacle ordinal. Overlap length is
not exposed: this is a first-contact query, not a full segment-intersection classification.
Selection must precede binary64 rounding. Rounded equal distances must not change identity.

Return t and point by rounding exact rational values once to binary64 nearest-even, with
canonical positive zero. Exact endpoint contacts return the normalized corresponding input
endpoint. An exact interior t that rounds to0or1 is REPRESENTATION_COLLAPSE; likewise reject
an exact interior contact whose rounded point coincides with either query endpoint. Intentional
exact t=0or1 contacts, including point queries, remain valid. Rounded points may lie slightly
off an exact obstacle; no raster stroke-footprint guarantee follows. Reject the whole batch
on collapse, reporting queryIndex and stage (parameter before point). No partial output.

Validate exact keys; query list/quadruples/numbers, obstacle list/quadruples/numbers, then
maxWork before processing. Supported Java numeric carriers follow the existing six-carrier
rule; no bool/string coercion. Counts <=536870911 bound packed quadruple storage, not useful
artistic size. maxWork is an explicit integer0..9007199254740991. Compute queryCount*obstacleCount
in exact integers; reject WORK_LIMIT_EXCEEDED before intersection work if it exceeds maxWork.
This counts pair tests, not CPU instructions, bit operations, allocations or milliseconds.
Empty queries/obstacles are valid. Input validation still runs in full for empty results.

Results own their data. No host objects, stochastic state, mutations or inter-query feedback.
Java exact arithmetic should share established internal machinery if its extraction preserves
all clipper behavior; the internal refactor is an implementation choice, not a new public API.

## Remaining acceptance work

Create the single catalog contract and shared fixtures from these semantics, including
rounded selection adversaries, collapse, degenerate inputs and exact work precedence. Run
the Phase2 gate before preparing that contract. Root reviews contract and fixture agreement
before authorizing Java production code. Then focused core checks, bounded representative
performance, actual editable native workflow and extracted distribution acceptance. No new
support or completion claim is made by this admission.
