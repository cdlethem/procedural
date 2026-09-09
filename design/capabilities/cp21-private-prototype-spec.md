# CP21 private prototype: retained rectangle cuts

Root-owned experimental specification, not a public contract or library admission.
Read cp21-next-capability-direction.md and its source bindings. Independently implement;
no upstream code copied. Output remains an ignored private study. Java0.23 stays unchanged.

## Hypothesis

One supplied binary cut plus explicit removal is sufficient to express aligned unequal
quadrants, staggered cuts and intentional holes. Caller chooses leaf and cut position;
prototype owns positive rectangles, stable identities, replacement and iteration order.
Do not introduce a four-way mode, RNG, callback, recipe executor or immutable history tree.

## Experimental semantics

Default-package RetainedRects, private diagnostic Java tab. Start with finite bounds
left<right, top<bottom; require both differences finite. Canonicalize signed zero.
Root ID0; future IDs monotonically allocated in pairs starting1, never reused.
Maintain live insertion order. Leaf access by ID returns an immutable Leaf containing
id,left,top,right,bottom. Stale/unknown ID fails. Expose a detached ordered list of live
leaves for traversal. Keep only live leaves, not a hidden ancestry/history graph.

cut(id, axis, coordinate) uses axis X or Y and an absolute finite strictly interior
coordinate. Validate all inputs and representational capacity before any mutation.
Reject endpoint/NaN/Infinity without changing leaves or next ID. Remove selected parent;
append lower-coordinate child then upper-coordinate child. Return the two child IDs.
Unrelated IDs and bounds stay unchanged. Do not derive coordinate using a guessed ratio
or epsilon; caller supplies the already-computed cut. Binary64 child bounds share the
exact stored boundary. No zero-area children, snapping or silent failed edits.

remove(id) removes that live region; removing last region is allowed. Subsequent cuts of
removed IDs fail. Explicit holes are not a promise that all layouts cover their root.
A finite small prototype workload cap of10000 live leaves is an engineering guard,
not a proposed public parameter limit. ID overflow must be checked before incrementing.
Single edits are atomic for validation failures; no batch-transaction claim.

## Focused evidence

Core diagnostic main checks: root; unequal X then independent Y cuts (aligned and
staggered); exact child bounds/order; unchanged unrelated identity; deletion; stale IDs;
invalid endpoint/nonfinite/axis edits leave list and subsequent allocated IDs unchanged;
returned list cannot mutate internal membership. Confirm disjoint positive areas and area
conservation for cut-only scenarios; area loss equals deleted area when explicitly removed.
Use a small analytically known layout, not a huge random assertion matrix.

## Artist study

Private CutStudy.pde plus adjacent RetainedRects.java under tools/diagnostics/cp21.
512x512 JAVA2D density1. Explicit configureRender(seed, numeric params) hook compatible
with tools/render_java.py; no dependencies beyond accepted Java0.23 JAR and Processing.
Example random choices use local java.util.Random and double-suffixed PDE literals.
Start inset24 root. Repeat12 selected-leaf refinements; each refinement does primary X
cut and then Y cut of each returned child. Ratios authored0.25..0.75. Aligned mode uses
same horizontal cut in both halves; staggered mode uses independent cuts. Always consume
both horizontal ratio draws so mode edit preserves primary RNG schedule.

Render modes supplied as numeric params: staggered0/1; decoration0/1; holes0/1.
Baseline aligned filled panels; staggered changes cuts; decoration reuses same layout for
inset outlines and center lines; holes explicitly remove a few deterministic leaf IDs.
Color keyed by leaf ID with a small authored palette. No source recreation claim.
Space/inset/drawing are ordinary example arithmetic. Expose working keys A(toggle cuts),
D(decoration retaining same model), H(holes rebuild),0(reset),S(cached save). Root can
review static helper renders first; full public event acceptance is a later gate.

Stop after private code/core checks and compile preparation. Root selects and executes
at most4 meaningful native renders through existing render_java helper/shared machine
lease, reviews images, then decides admission. Do not author root acceptance or catalog.

## Alternatives root will compare

Adding ratio controls to QuadrantPartition2D preserves a short seeded entry point but
still hides selected-leaf edits and cannot express independently staggered cuts without
another mode. Expanding BinaryCellPartition2D would change its integer-cell domain and
fixed seeded selection contract. Both existing operations therefore remain unchanged in
this study. A stateless rectangle-to-two-rectangles helper handles arithmetic but leaves
identity, replacement order and stale selection management in every interactive sketch.
The retained model earns public status only by removing that repeated management burden;
it must not grow into an editor framework, undo system or generic scene graph.

The planned12 refinements are only37 final leaves, so the prototype can use an ordered
map and detached traversal snapshots. Native access and larger-workload representation
need separate production review; a small private study does not prove scalable performance.
