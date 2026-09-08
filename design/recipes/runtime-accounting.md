# Runtime limits and failure accounting

Status: root implementation requirements; numerical limits are provisional engineering
limits until exercised by the evaluator fixtures. They are not artistic ranges, target
attestations or evidence of a working executor.

## Static preflight being implemented

Read at most 2 MiB UTF-8 JSON. Reject duplicate keys, nonfinite/overflowing numeric tokens
and malformed input before grammar validation. Interpret JSON numbers as binary64; boolean
values are not numbers. Bound the parsed document to depth 64 (root depth zero) and 20,000
JSON values, counting every container and scalar including literal payloads. This bounds
validation work; it does not bound the recipe's eventual runtime work.

Resolve exact catalog identity/version and draft execution schema pointers, declarations
and lexical names. This initial tool returns `static-valid-draft`, with unperformed checks
explicitly listed. It must not call the recipe executable, target-supported or accepted.
Dynamic instance/port compatibility, operation inputs, target capabilities, execution
budgets, command output and native rendering remain separate checks. Even a port name known
to another declared operation cannot validate a query on the wrong instance.

## Evaluator accounting to implement next

The Java evaluator receives an explicit host limit object. Recipes cannot override it.
Proposed initial desktop limits:

| Counter | Limit | Charge point |
| --- | ---: | --- |
| Expression/statement visits | 10,000,000 | Before each evaluated AST expression/statement, including every repeated body visit |
| Operation API calls | 200,000 | Before construct/query/values; failed calls consume their reservation |
| Core work units | 500,000 | Before each call using the binding-specific cost below |
| Aggregate loop iterations | 200,000 | Before entering each map/for body, summed across nesting and retain/frame |
| Single array length | 100,000 | Before range/map/materialized array allocation |
| Cumulative created value units | 5,000,000 | Reserve before creating arrays/records/materialized operation values/commands |
| Commands | 100,000 | Before accepting each emitted command, including invisible commands |
| Frames per request | 1 | Before frame evaluation; animation remains unimplemented |
| Elapsed execution | 30 seconds | Check at AST/call boundaries; outer process supervisor terminates an overrun |

These are a bounded starting profile for the inspected desktop compositions, not portable
performance guarantees. Lower-limit fixtures must prove that each reservation fails before
the affected allocation or emission. Larger values require explicit host configuration and
new representative-range checks, not relaxation by untrusted recipe input.

A value unit is one scalar, array container or record container plus recursively created
children. References to an existing immutable value cost no new value units. A fresh detached
copy costs its full value tree. Cumulative accounting never refunds discarded temporaries,
which makes allocation work deterministic without depending on garbage collector timing.
The input tree has already been bounded; literals can reuse detached immutable parsed data.
Normalize native arrays to the evaluator value model without exposing writable host storage.

Core work reservations for this first immutable binding set:

- Grid construction: one; indexed query: one. The grid remains a compact descriptor, never
  an implicit materialization of columns*rows. A requested traversal is charged separately.
- Noise construction/sample: one each; no host noise or hidden full-field allocation.
- Palette construction: one plus entry count; sample: one. Reserve copied color entries.
- Gradient path construction: one plus steps. Reserve positions for steps+1 and headings
  for steps BEFORE calling the native operation. A path instance counts its owned buffers
  even before `values` produces a second detached copy.
- `values`: one plus returned scalar/container count; reserve the entire result before the
  copy. Grid/noise/palette descriptors and path arrays follow their distinct output schemas.

All size arithmetic is checked before conversion to native allocation sizes; avoid overflow
in steps+1, rows*columns and nested sums. Dynamic schema/type checks precede size-cost
calculation when a field could otherwise cause coercion or an invalid native cast.

## Failure and publication

Errors use `{code, path, message}`; runtime errors additionally carry iteration context and,
for native operation failures, operation identity and original error code. JSON Pointers
refer to the submitted recipe. Use distinct codes for parse/shape, catalog binding,
declaration/version, scope, type/access, operation, arithmetic and limit failures. Preserve
underlying operation errors after valid binding dispatch; no fabricated result or fallback.

Retain evaluation publishes only after all its bindings succeed. Frame evaluation builds
and validates its complete ordered command list before requesting a drawing surface. A
native adapter failure still aborts the frame through its existing lifecycle contract.
No successful frame/result/file is published after a budget or operation failure. Temporary
export directories remain unaccepted until compilation and native review complete.

## Concrete acceptance cases

FieldMarks baseline and its length/palette/bar edits must match the existing Java commands;
PathMarks baseline, traces, changed step count/distance and retained styling must do likewise.
Include zero-size traversal, lazy invalid arithmetic, negative remainder, duplicate/forward
bindings, wrong instance port, huge path steps and tiny array/command/work budgets. Test
round-trip values and preserve source recipes. Only later target fixtures can establish
cross-target numeric tolerance or renderer support.

## Prototype preflight correction

Root recalculated materialized path output as `4*steps+6` value units. For 24 paths
of 2000 steps, constructors plus values calls alone consume 240,192 work units before
grid/palette calls. The initial provisional 200,000 work limit was insufficient; the
prototype profile is therefore 500,000. Keep the full cost instead of undercounting it.
Native positions storage also contains `2*(steps+1)` scalars and must pass the single-array
limit before construction. These costs now have prototype command evidence; complete accounting and boundary admission
remain under review.


## Root accounting clarification for the prototype correction

Value units count recipe-visible values and owned native numeric buffers, not JVM object
headers, hash-table capacity or lexical-scope bookkeeping. Visits and iterations separately
bound that bookkeeping. This is a deterministic work budget, not a byte-accurate heap limit.

- Array/record/map construction charges the new container; referenced children are not
  copied and do not incur a second recursive charge. Newly evaluated children pay their
  own allocation charges. A range additionally creates one scalar per element.
- Each evaluated math result, scalar query result and generated loop index costs one scalar
  unit, independent of whether a particular JVM caches its boxed representation.
- Native materialization and detached publication copies cost their complete value trees.
  Temporary command normalization is also a copy and must be reserved before calling the
  normalizer; discarding it does not refund the cost.
- Host limits are snapshotted on entry. Changing the caller's mutable configuration must
  not change the budget of an execution already underway. Concurrent mutation of the input
  recipe during evaluation is outside the prototype's supported input contract.

These clarify the existing created-value rule; they do not authorize increasing the default
budget to hide incorrect accounting. Boundary probes and the existing nine command cases
must be rerun after the correction. Full schema admission and native/export support remain
separate gates.

## Seeded placement binding reservation

Before calling CirclePlacements2D.seeded, use attempts n to reserve a worst-case proposal
budget of1+4n+n(n-1)/2 work units: construction, four RNG draws per proposal and every ordered
pair comparison when all proposals survive. This is a work-unit definition, not elapsed time
or a count of individual floating-point instructions. No packing loop is duplicated.

Reproduce only the core's backing-capacity schedule for allocation accounting: initial
capacity min(n,16), grow by max(1,floor(capacity/2)) until capacity>=n, capped at1073741823.
Sum4*capacity+3 units for each allocation generation (coordinates/radii/source indices and
array containers). Reserve another4n+19 for worst-case final trimming and fixed state.
Check maximum coordinate-array length2*finalCapacity against the host array limit before
calling the core. Reservations are deliberately conservative when many proposals reject.
For k accepted circles, values() costs5k+5 output units and5k+6 work units; its arrays require
length k and each nonempty centre requires length2. Session reuse reserves the original
retained reservation as with the existing immutable bindings.
