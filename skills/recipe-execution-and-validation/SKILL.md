---
name: recipe-execution-and-validation
description: Validate, execute and export declarative Procedurals recipes using catalog-bound behavior, explicit environments and evidence on each claimed target.
---

# Recipe execution and validation

Use for persisted recipe acceptance, validators/evaluators and project exporters. Current
schema/model and composition drafts are under `design/recipes/`; drafts are not accepted
runtime contracts. This skill exists because those concrete inputs now exist. It does not
approve them or authorize bypassing unresolved semantics.

## Before execution

Read the current schema, execution model and binding status. Reference authoritative
operation/drawing schemas and support evidence; do not duplicate parameter defaults or
invent native method mappings. Apply catalog-surface-synchronization when those references
become mirrored or generated consumers.

Separate validation layers in results: JSON/grammar, lexical/catalog bindings, dynamic
values/types, target capabilities, bounded execution, commands and native output. A pass
at one layer cannot be labeled a successful runnable recipe. Validate both branches
structurally while evaluating only the chosen branch. Distinguish operation instances,
configuration descriptors and materialized values; path serialization is not path geometry.

Require explicit seed, canvas, time/frame and declared assets when consumed. Check actual
requested target support and byte-identified asset/runtime dependencies before rendering.
Reject unsupported capabilities without host defaults or silent fallback. Never execute
host-language snippets, reflection strings or unrestricted filesystem paths from a recipe.

## Execution and replay

Preserve specified expression, traversal, operation-call and command order. Follow the
existing deterministic-generative-semantics contracts, including binary64 rounding and
remainder behavior. Use catalog operation implementations rather than reimplementing their
algorithms inside the evaluator. No hidden host RNG, global noise or wall clock.

Enforce explicit limits before large operation allocation and throughout traversal; a small
AST can request huge internal work. Treat operation calls, retained data and emitted commands
as separate accounting surfaces. Failed construction publishes no partial retained state;
failed frame execution publishes no successful image. Errors retain recipe location,
iteration context and underlying operation identity/code.

Round-trip recipes without losing seed, operation versions, asset identity, parameter values
or expression order. Runtime instances/caches never enter serialized JSON. Test retained
geometry/style edits and cache invalidation before claiming that edits reuse geometry.

## Acceptance and export

First compare complete FieldMarks and PathMarks commands with their existing Java
compositions, including mark/palette edits and numerical/branch boundaries. Grammar examples
alone are insufficient. Compare the raw PathMarks stream separately from canvas culling;
do not turn that example optimization into an undocumented clipping operation.

Exported projects carry recipe, catalog identities, dependencies, licensing/provenance and
scoped conformance metadata. Build from extracted artifacts and inspect representative
native results on every claimed target. Include all required adapter JARs/dependencies;
matching a portable core alone does not prove an installable project works.

Use the machine-wide native render lock required by AGENTS.md. Reuse existing harnesses,
focused cases and prior exact payload evidence when applicable. Root owns semantic decisions,
representative native review and acceptance records; port workers propose evidence without
writing root acceptance. Leave unimplemented operations, animation, assets and targets
explicitly unsupported/unvalidated until their own evidence exists.
