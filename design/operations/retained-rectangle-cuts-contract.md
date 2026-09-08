# Retained rectangle cuts — normative contract 0.1.0

Operation layout.retained-rectangle-cuts-2d. Root admission:
../capabilities/cp21-retained-cuts-admission.md. Root froze catalog schema and analytic fixtures with this contract. Java implementation
and runtime support remain pending. Generic catalog checks cover creation cases only;
command_cases require explicit native execution, including post-error state and recovery.

## Values and identity

Create from exactly {bounds:[left,top,right,bottom]}. Four finite binary64 coordinates,
left<right and top<bottom, separately rounded right-left and bottom-top finite. Normalize
all coordinate negative zeros to positive zero. Coordinates have caller-defined common
units; right/down positive axes. No implicit domain scaling, seed, tolerance or defaults.

Live leaf is exactly {id,bounds}; id integer in0..9007199254740990. Root leaf ID0,
nextId1. Every successful cut allocates nextId then nextId+1; nextId increases by2.
9007199254740991 is an exhausted nextId sentinel, never a leaf ID. Never reuse removed IDs.
Live order starts root; survivors retain order, children append low-coordinate then high.

Store live leaves only. A removed parent's Leaf value can remain held by a caller as
immutable historical data, but is no longer addressable through the model. Empty state
is valid after removal. No ancestry, undo, hidden seed, implicit selection or shared state.
Objects are independently owned and not thread-safe; external synchronization is caller work.

## Commands

cut(id,axis,coordinate): require valid live ID, axis exactly X or Y, finite coordinate
strictly between corresponding stored endpoints. No rounding-to-grid, epsilon or clamping.
Canonicalize zero. Validate that live count after cut is at most2147483647 and nextId is
at most9007199254740989 before mutation. On X, children share the supplied x boundary;
on Y, share supplied y. Other bounds are copied exactly. Return allocated IDs in order.
Unrelated Leaf identities and coordinates do not change. No caller container is retained.

remove(id): validate live ID, remove it; no automatic replacement, merging or renumbering.
Deleting last leaf succeeds. It changes neither nextId nor unrelated membership/order.

leaf(id): immutable value for a currently live ID. leaves(): detached ordered collection
of immutable live values. size(): current live count. toValues(): fully detached mutable
{nextId,leaves:[{id,bounds:[left,top,right,bottom]},...]}. This is a snapshot, not a
restore constructor, replay recipe or persistence/version migration guarantee.

Every failed validation leaves model membership, order and nextId unchanged. Resource
allocation failure is a host failure, not a fabricated validation code; no guarantee of
recovering from exhausted process memory. Validate counts before attempting growth.
Single commands are atomic for specified failures; multiple cuts are not a transaction.

## Java surface

org.procedurals.layout.RetainedRectangles2D, final mutable class:
create(Object config); create(double left,double top,double right,double bottom);
cut(long id,String axis,double coordinate) returning fresh long[2]; remove(long id);
leaf(long id); leaves() returning fresh List<Leaf>; size(); toValues().
Leaf final nested immutable class with public final long id and double left,top,right,bottom.
No setters, public constructor or mutable bounds arrays. Repeated leaf lookup may return
same immutable instance; unrelated retained Leaf identity must survive edits.

Creation Object route accepts Map exact key bounds and List exactly four numeric values;
only Byte/Short/Integer/Long/Float/Double carriers, finite after conversion. Reject arbitrary
Number, Boolean, string, null, arrays and unknown keys. There are no Object command
adapters: language-neutral command fixtures call the typed native equivalents.

Nested final EditException extends IllegalArgumentException, public final String code:
INVALID_INPUT malformed creation/config/coordinate bounds or invalid axis/nonfinite cut;
INVALID_ID id outside0..9007199254740990;
UNKNOWN_ID valid-domain id not live;
INVALID_CUT finite coordinate not strictly interior;
LIMIT_EXCEEDED live-count or identity capacity exhausted.
Validation precedence: creation container/keys, list length, coordinates left/top/right/bottom,
then extent/order; commands id domain, membership, axis, coordinate finite, interior, limits.
remove/leaf validate domain then membership. No exception messages are contractual.

## Work, evidence and acceptance

Expected O(1) ID lookup, cut and removal using ordered hash storage; O(n) snapshot time
and extra storage. Internal retained storage O(n), independent of prior removed nodes.
No all-leaf copy on every edit or traversal allocation hidden in primitive Leaf access.
Safe-integer IDs and signed32 count limits are representational, not workload recommendations.
Measure source-scale1200 refinements and a bounded larger workload with identity checksum;
no image-render FPS promise or repeated huge assertion matrix.

Fixtures should distinguish aligned/staggered cuts, survivor-child order, both axes,
explicit deletion/empty, stale IDs, positive-zero normalization, immutable ownership,
finite-extents overflow, adjacent representable endpoints, malformed creation and failure
atomicity including no consumed IDs. Capacity edge tests may inject private state only in
native diagnostics; do not add public test hooks. Query costs require implementation review.

Public native example must use actual class, retain local edits across decoration, reset,
and cached save. Private CP21 images justify design only. Whole-source reproduction,
source RNG/float order, concave geometry, arbitrary polygon splitting, portable target
support and serialized restore remain outside this contract.
