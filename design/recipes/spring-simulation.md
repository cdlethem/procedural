# Explicit spring simulation in recipes

Status: root-approved implementation direction for a prototype binding and ordered scan.
This adds no core operation and does not claim interactive events or a live simulator.

## State boundary

The accepted motion.target-springs-2d contract transforms {state,targets} by one logical
update. Its native object is mutable, so never expose a stepping port on a retained recipe
instance. Construct a private TargetSprings2D from input.state, call step(input.targets)
exactly once, then expose only toValues() and no ports. The resulting recipe instance is
observationally immutable: the native handle never escapes and no later dispatch mutates it.
Session sharing is therefore safe. The core recurrence is never reimplemented in recipes.

This prioritizes explicit state and replay over the native object's allocation-free repeated
step path. Each recipe step allocates14n native slots (two6n state buffers and2n targets).
Reserve14n+8 value units, check6n array length and reserve32+128n work before construction.
Validate catalog input schemas and target/body cardinality before allocation; cardinality
failure preserves native INVALID_INPUT. Preserve SpringArithmeticException code, bodyIndex,
axis and stage. All arithmetic uses long within the catalog body-count ceiling.
Output toValues costs9n+2 value units and10n+3 work, checking n and pair length2 if nonempty.
No strength/retention defaults or artistic ranges are introduced; example coefficients may
reuse the existing SpringMarks composition choices0.025 and0.7 with that explicit label.

## Ordered recurrence expression

Add exact tagged expression {kind:"scan",items,initial,as,indexAs,stateAs,value}.
Evaluate items then initial in the outer scope, including for empty items. Items must be
an array. Reserve the output array before traversal. For each item in array order, expose
item, zero-based index and previous accumulator under the three distinct new local names.
Evaluate value once, append its result and use that same value as the next accumulator.
Return one result per item; the initial value is not an extra output. Empty items return[]
after initial evaluation. No mutation, implicit copying of previous state, skipping, fixed
point iteration or hidden clock. Existing expression/type/budget rules apply.

All three locals must differ and may not shadow visible bindings. They are visible only
inside value, not initial/items or later scope. Structural validation visits every branch.
Use map's array, iteration and value-accounting policy; produced values already pay their
own allocation charges. References to earlier immutable values are allowed. A failing
iteration preserves its JSON pointer and iteration context and publishes no successful
scan or retained stage. Cache-key dependency discovery must include initial/items/value.

## Artist workflow and acceptance

Precompute a bounded target schedule from explicit initial positions and a displacement/
return policy, scan spring state, then select a completed state by clock.index for marks.
One selected entry is the result after one logical step; timeSeconds does not rescale the
spring recurrence or imply intervening updates. Palette/mark edits reuse the trace;
coefficient/initial/schedule edits rebuild it. This is offline simulation replay, not a
substitute for the accepted native starter's live pointer interaction.

Root owns runtime, semantic tests, direct native oracle and representative render review.
Luna may implement catalog binding/schema/Python lexical validation and regenerate metadata.
Check prefix sums and empty/failing initial values for scan semantics; sequential spring
snapshots against one directly stepped native batch; cache reuse/invalidation; scan local
scope; bounds and arithmetic diagnostics. Render selected early/displaced/return snapshots
through the existing bounded exporter. Keep target support and general executor acceptance
explicitly pending beyond this Java prototype.
