# Ordered recipe expression model

Status: root proposal for schema implementation; not an accepted runtime contract.
Companion: execution-direction.md. The first evaluator targets immutable CP1/CP2 operations.
Stateful operations, frame stepping and asset-backed sinks remain explicit follow-up work.

## Document and evaluation scopes

A document has `format` (literal `procedurals.recipe`), `version` (initial draft `0.1.0`),
`status` (literal `draft` until acceptance), `parameters` (a JSON object), `operations`
(an ordered list of exact ID/version references), `drawing` (ID/version), `environment`
(an expression evaluated to the referenced drawing environment), `retain` (ordered bindings)
and `frame` (ordered statements). No extra keys are silently ignored. Input JSON rejects
nonfinite numbers and duplicate keys before schema validation.

A binding is exactly `{name, value}`. Names match `[A-Za-z][A-Za-z0-9_]*`; bindings are immutable.
The outer scope contains `params` referring to `parameters`. Retain bindings see params and
previous retain bindings; frame bindings see all retain bindings and earlier frame bindings.
No forward references or shadowing. Local iteration variables exist only inside their body.
Parameters carry values only, never executable code. Controls/ranges will reference catalog
parameter evidence or explicit example choices; they are not inferred from numeric literals.

Evaluate environment after retain, before frame statements. The environment uses the same
outer scope as frame start. Operations must be declared in `operations` to be constructed;
there is no implicit catalog version. Duplicate operation IDs are invalid in this first
format, even when their versions differ. Drawing support is checked separately from core.

## Expressions (exact tagged objects)

Each expression has one of these shapes. Every child expression is evaluated in the stated
order. A JSON literal is never inferred to be an executable node.

| Shape | Meaning and order |
| --- | --- |
| `{kind:"literal", value:JSON}` | Detached JSON value; all numbers finite binary64; no instance values |
| `{kind:"ref", name:string}` | Previously bound value or lexical iteration variable |
| `{kind:"array", items:[expr...]}` | Evaluate items left to right; preserve order |
| `{kind:"record", fields:[{name:string,value:expr}...]}` | Evaluate values in listed order; reject duplicate names; resulting record key order is not behavior |
| `{kind:"get", value:expr, key:string}` | Require record and present key; no prototype/native property access |
| `{kind:"index", value:expr, index:expr}` | Evaluate array then index; require nonnegative exact integer less than length; return element |
| `{kind:"math", op:string, args:[expr...]}` | Evaluate arguments left to right, then the arithmetic below |
| `{kind:"if", condition:expr, then:expr, else:expr}` | Require boolean; evaluate only selected branch |
| `{kind:"range", start:expr, stop:expr, step:expr}` | Evaluate start, stop, step; safe nonnegative integers, positive step; ascending half-open sequence; stop<=start yields empty |
| `{kind:"map", items:expr, as:string, indexAs:string, value:expr}` | Evaluate finite array; bind element and zero-based index; evaluate body in array order; return ordered results |
| `{kind:"construct", operation:string, input:expr}` | Resolve declared operation, evaluate input, validate against operation input schema, construct opaque instance through reviewed binding |
| `{kind:"query", instance:expr, port:string, input:expr}` | Evaluate instance and resolve its port, then evaluate input; validate port input and return value using referenced schemas |
| `{kind:"values", instance:expr}` | Return detached data matching operation output_schema through its binding; not generic serialization of native object internals |

`map` cannot bind the same name twice or shadow any visible name. Structural validation
checks both branches and resolves references in both; only runtime value evaluation is lazy.
Index/field access cannot expose or mutate instance state. Arrays/records can retain instance
references internally, but literals, persisted JSON and sink commands cannot contain them.

`values` matters: grid/noise/palette output is a descriptor; path output is retained
positions/headings. Path `serialize()` returns configuration and is therefore NOT its
`values` binding. Host classes and methods never appear in a persisted recipe.

## Arithmetic and types

No truthiness, string coercion, boolean-as-number or broadcasting. `add`, `sub`, `mul`,
`div`, `rem`, `lt`, `le`, `eq` take exactly two numeric arguments; `neg`, `sin`, `cos`,
`floor` take exactly one. `length` takes one array. `lt`, `le`, `eq` return booleans;
all others return numbers. Conditional control is `if`; no eager boolean operator substitutes
for lazy evaluation. This set is sufficient for the inspected mark expressions, including
path index remainder and stride. New arithmetic requires an explicit contract addition.

Basic arithmetic uses IEEE binary64 round-to-nearest ties-to-even, each operation separately
rounded, no reassociation/FMA. Division or remainder by either signed zero is an error.
`rem` uses truncation toward zero (Java/JavaScript remainder), NOT Python's `%` rule for
negative operands; ports must implement that distinction. Nonfinite arguments/results fail
at the current expression. Canonicalize completed zero to +0. Numeric comparison is exact;
there is no hidden approximate equality.

`sin`/`cos` use the named target runtime's binary64 functions without angle normalization,
as in the gradient-path contract. Same-runtime replay is exact; cross-target acceptance uses
reviewed per-fixture tolerances. No universal accumulated-error bound or pixel equality is
claimed. Pi is an explicit binary64 literal (`3.141592653589793`) in the composition.
Array counts, indices and range operands must be exactly integral and within 0..2^53-1;
execution budgets impose much smaller materialization limits before allocating sequences.

## Frame statements

`{kind:"bind", name:string, value:expr}` binds a local frame value.
`{kind:"emit", value:expr}` evaluates and validates one command against the drawing profile.
`{kind:"for", items:expr, as:string, indexAs:string, body:[statement...]}` traverses an array
in order with a fresh local scope per element. Body bindings do not escape the iteration.
`{kind:"when", condition:expr, body:[statement...]}` conditionally evaluates a body in a new
local scope. This supports skipping zero-length marks without emitting a fake command.
There is no mutation, return, break, recursion, host call or unbounded while loop.

Statements preserve order; command batching cannot reorder, duplicate or omit commands.
Construct and retain all command values for a frame before handing them to the sink in this
first implementation. Reject command-budget exhaustion before rendering; streaming can be
added later with equivalent atomic frame behavior, not silently partial output.

## Validation and execution failures

Validation order: JSON syntax/duplicates/numbers; document schema; declared catalog identity
and target capabilities; lexical binding/port resolution; then ordered evaluation and dynamic
type/schema/budget checks. A structural pass does not claim all dynamic inputs satisfy an
operation schema. Such input validation happens before the corresponding operation call.

Report an error code, JSON Pointer into the recipe, lexical iteration indices where relevant,
and operation ID plus original operation error when a catalog call fails. Distinguish format,
unknown catalog/version/port, unsupported target, unbound name, invalid type/access, arithmetic,
operation failure and budget exhaustion. Do not replace precise operation failure with a
plausible default value. Failed retain evaluation publishes no retained instance collection;
failed frame evaluation publishes no successful image. Allocation failure is not acceptance.

The execution environment supplies mandatory limits for AST nodes/depth, operation calls,
loop iterations, aggregate retained values, array size, commands, canvas/frame count and
elapsed work. This first document shape does not accept limit overrides. A later version may request
lower limits but must not raise host limits. Exact default
limits and accounting units require fixtures before runtime acceptance; no unchecked huge
array is permitted merely because its operation contract mathematically permits that size.

## Remaining freeze gates

Create a draft schema and positive/negative grammar examples from this model, then root
walks both complete compositions against it. Resolve expression/statement type checking,
resource accounting and execution bindings in catalog-owned metadata without duplicating
operation constraints. The schema alone cannot prove this model useful or executable.
Create the recipe execution/validation skill before accepting persisted recipes or executor.
No acceptance label or target support change is authorized by this proposal.

Concrete first-operation schema pointers and inspected Java access forms are recorded in
`catalog/recipes/execution-bindings.json`. They are draft execution metadata, not a parallel
operation catalog.

See `runtime-accounting.md` for the static input limits and proposed runtime reservations.
The static validator does not implement those runtime reservations.

Runtime schema errors use `INPUT_SCHEMA`. Their recipe `path` identifies the input
expression that produced the invalid value; the message separately identifies the relative
value pointer (for example `/colors/0`). Computed record fields are not necessarily JSON
nodes in the submitted recipe, so do not append their names to the recipe pointer. Preserve
the operation ID and enclosing iteration context. Native semantic failures retain their
existing operation codes after successful schema admission and resource reservation.
