# Java segment clipping implementation brief

Contract and34fixtures are reviewed; root integrated the focused validator and the full
catalog check passes. Production implementation may begin against the active catalog.
The contract is authoritative; this brief assigns implementation responsibilities.

## Core slice

Implement `org.procedurals.geometry.SegmentClip2D` as one public operation class. Use an
owned packed result: four doubles per output segment, two doubles per parameter interval,
one integer source index. Keep exact arithmetic helpers private to this implementation;
do not alter existing Delaunay or convex-placement classes to share a new public numeric API.
The private RationalStudy/ExactSegmentClipStudy establish an algorithm, not production code
quality, public validation or tested resource behavior. Remove diagnostic mains from core.

`clip(Object input)` eagerly validates passive Map/List data, computes exact work preflight,
validates polygon topology and produces the retained result. Follow exact schema key and
carrier order. Source malformed-input checks must finish before work-limit checks. Retain
no caller records/lists or rational geometry. Do not preallocate the maximum budget.

Implement size(), sourceIndexAt(), segmentAt/Into(), intervalAt/Into() and toValues() with
the established long/Object index overloads, detached copies and validation-failure atomic
Into behavior. Object indices accept only six Java numeric carriers. Finite and safe-integer
checks precede narrowing. Publish source-linked, meaningful Javadoc for every public member
at implementation time, including exceptions and input domain; no inferred defaults/ranges.

Failures need clear stable codes. Dynamic failures carry sourceIndex and zero-based merged
intervalIndex; representation failures additionally carry parameter/endpoints/gap stage.
Global static/work/polygon errors do not fabricate a source index. Every failure returns no
result. Document host allocation failure separately. Do not catch OutOfMemoryError as an
invalid-input result or truncate output to meet a limit.

## Focused validation and artist workflow

Run every shared success/error case from fixtures, exact output bits included. Root owns
fixture changes. Add Java-specific carrier rejection, safe-index/range/destination precedence,
nonzero Into offsets and failure preservation, caller mutation and nested-export detachment.
Avoid duplicating every fixture in handwritten tests or counting assertions as capability.

Measure geometry validation/setup and full clipping separately enough to explain cost.
Use tiny, 100-stroke/8-vertex and one bounded larger workload, warmup, repeated checksum,
elapsed time and allocation where available. A slow correct result is evidence for optimizing
exact predicates/cut storage, not permission to replace them with epsilons. Any optimization
must preserve shared output bits and topology, with uncertain signs falling back exactly.

Root owns a complete native JAVA2D example: retain supplied strokes, change polygon notch,
change hatch spacing, substitute a second retained source drawing, recolor without reclipping,
reset, and save cached output. Gray original lines may be an optional diagnostic overlay,
not a required part of the artwork. Generate visual output through the one machine lease
and add the reviewed images to the central gallery. Exact-core native output and extracted
bundle execution are still required; the private double study is not their acceptance.

## Ownership and boundaries

Execution worker may own core and focused native test/runner after explicit assignment.
Root retains catalog, fixtures, support attestations, example architecture, complete code
review and distribution acceptance. Ports remain deferred. No production implementation
or release is implied by this prepared brief.
