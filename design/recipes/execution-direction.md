# Recipe execution direction

Status: root architectural direction; schema and implementation are not accepted.
This is D3 work needed before X1 execution/export, based on the current Java0.15 catalog.
It does not change any accepted operation signature or target attestation.

## Artist task and first acceptance compositions

Save a composition as portable data, change its palette or mark length while retaining
its geometry, and export an editable project which reproduces that composition. Begin
with the accepted FieldMarks and PathMarks workflows, because their different data flows
exercise this promise without requiring a new generative algorithm.

The required end state remains four-target exports, explicit animation and assets, and
MCP/web consumers. A first static composition slice must not claim that end state. Existing
native starters remain useful and independent of this new execution layer.

Source evidence inspected:

- `packages/java/examples/FieldMarks/MarkField.java`: retained grid positions, three noise
  samples with different coordinates, and separate heading/length/colour attributes.
- `packages/java-processing/examples/FieldMarks/MarkCommands.java`: palette queries, segment
  or quad construction, and ordered command batches. Zero-length marks are skipped.
- `packages/java/examples/PathMarks/PathMarkComposition.java`: ordered start grid, retained
  trajectories, trace versus perpendicular mark treatment, and sparse endpoint selection.
- `catalog/operations/{regular-grid,gradient-noise-2d-01,cyclic-palette,gradient-path}.json`:
  reviewed portable behavior and schemas.
- `catalog/drawing/`: the reviewed fresh-raster drawing profile and command schemas.

These sources demonstrate composition requirements; they do not establish a portable
recipe evaluator. Recipe machinery below is an engineering design choice.

## Decisions

1. A recipe references exact catalog IDs and semantic versions. Its export also records
   catalog content hashes and the actual target support evidence used. Unknown IDs,
   mismatched contracts and unsupported requested capabilities fail before rendering.
2. Keep values distinct from constructed operation instances. A noise descriptor containing
   a seed is not a scalar sample; a grid descriptor is not a materialized point array.
   Instances are constructed from validated input data and queried through declared access
   interfaces. Retained path positions/headings remain ordinary typed arrays.
3. Use an explicitly ordered program with lexical bindings and bounded collection traversal.
   Dependencies may be displayed as a graph, but the evaluator must not invent a topological
   order for observable calls. No arbitrary host code, reflection, callback, filesystem access,
   recursion or unbounded loop belongs in a recipe.
4. Composition needs literals, record/array construction, field/index access, references,
   scalar expressions, conditional selection, bounded iteration and command emission.
   Define these as shared, versioned composition infrastructure before permitting them in
   persisted recipes. Do not add a public generative operation for every multiplication,
   or an opaque `runFieldMarks` operation which hides the composition.
5. The composition infrastructure must live under the catalog authority alongside drawing
   infrastructure. It references existing operation schema locations rather than copying
   their defaults or constraints. MCP/web must not maintain a second handwritten registry.
6. Separate retained construction from frame evaluation. Palette and mark-style edits should
   reuse spatial results; geometry edits invalidate dependent retained results. A simple full
   recomputation is semantically valid initially, but cannot be presented as retained-edit
   support until reuse and invalidation are tested. Caches never enter serialized recipes.
7. Explicit seed, canvas, frame/time and asset declarations belong in the recipe. A seed is
   an input value passed to the operations that consume it, not a new shared random stream.
   Assets are named byte-identified dependencies, not arbitrary host paths. There is no
   implicit system font, renderer fallback or wall-clock input.
8. Operation bounds are not execution budgets. Validate collection lengths, nesting,
   retained memory, command count and frame work against explicit execution limits. Reject
   exhaustion with the node/iteration location; never publish a partial successful frame.

## Catalog execution gap to close first

| Existing contract | Available interchange | Missing execution description |
| --- | --- | --- |
| `layout.regular-grid` | `input_schema`, serialized `output_schema`, `access_schema`, `point_schema` | Named constructor/access binding and typed instance versus descriptor distinction |
| `field.gradient-noise-2d-01` | constructor and scalar `query_schema`/`query_output_schema` | A common query binding that references these schemas |
| `color.cyclic-palette` | constructor and scalar query schemas | The same binding mechanism, with this operation's distinct scalar types |
| `path.gradient-trace-2d` | constructor and materialized `positions`/`headings` output | A declared evaluation/materialization binding and bounded array traversal |
| Fresh-raster drawing profile | environment and command schemas | Ordered sink invocation in the same validated execution contract |

Verify IDs against the catalog when implementing; filenames and Java class names are not
portable identifiers. Execution descriptors must be reviewed and synchronized, not inferred
from host method spelling. Preserve existing source-bound acceptance: adding metadata is not
permission to rewrite already accepted behavior or upgrade support evidence mechanically.

## Pre-schema walkthroughs

FieldMarks: construct grid and seeded noise; traverse positions in row-major order; retain
heading, length factor and colour cycles; query palette and construct ordered segment/quad
records; submit them to the declared drawing profile. Keep the three noise coordinate
expressions separate and preserve arithmetic evaluation order. The accepted starter's mark
size and frequency constants are composition choices, not new catalog defaults.

PathMarks: construct start grid; traverse starts in order; evaluate each retained trajectory;
traverse its endpoints with the chosen stride; query palette by path index; choose consecutive
segments or perpendicular endpoint marks. Do not retrace movement merely to recolour it.
The current canvas-specific culling is an example optimization, not a general clipping node:
compare full command streams first, then evaluate whether culling is necessary for the profile.

These walkthroughs are requirements, not executable examples or user-test evidence.

## Next bounded deliverables and stopping conditions

1. Root freezes the shared expression/instance/traversal model after checking both walkthroughs.
   Resolve binary64 arithmetic order, transcendental tolerance, boolean/error semantics,
   conditional evaluation and traversal bounds in writing. Reuse existing numerical contracts;
   do not assume Java Math and browser Math give pixel-identical marks.
2. Root approves catalog-referenced execution descriptors and recipe schema. Apply the catalog
   synchronization skill. Create the recipe execution/validation skill at this gate, before
   accepting persisted recipes, as required by AGENTS.md.
3. Terra implements one validator and Java evaluator against those frozen inputs. Acceptance
   covers malformed/unknown/type-invalid bindings, precise errors, round-trip serialization,
   seed/geometry/style edits, budgets, and command comparison with BOTH existing compositions.
4. Root reviews the actual exported Java project and representative native result under the
   shared machine lock. The separate porting work can then implement the same semantics on
   the other targets; acceptance remains per target. No MCP/web planning before X1 exists.

Do not implement a starter-parameter JSON wrapper and call it the completed recipe system.
Do not expand to all fifteen operations before the two compositions validate the execution
boundary. Later operations, animation and assets are explicit remaining X1 obligations.

## Draft implementation inputs

`expression-model.md` specifies the proposed evaluation model.
`catalog/recipes/recipe.schema.json` is a strict grammar draft;
`catalog/recipes/execution-bindings.json` points at the existing four contracts.
Four grammar tests and schema-pointer checks pass. No complete recipe execution, lexical
validation, budget enforcement or export has been accepted. Full CP1/CP2 translations are
the next architecture check before freezing this surface.

## Prototype finding: PathMarks visibility

Seven initial raw command cases matched before the distance edit hit the fresh-raster
profile coordinate bounds. The original runnable workflow uses `streamForCanvas`. Root
therefore added its fixed 640x640, one-pixel-padded bounding-box visibility decision to the
draft via existing `if`, `lt` and `when` expressions. Compare the resulting emitted stream
against `streamForCanvas`; do not weaken the profile or claim a general clipping operation.
The predicates are equivalent for the finite coordinates already required by the core.


## Runtime admission decision before evaluator acceptance

Root inspected the four constructor schemas and their native validators. Runtime input
validation will consume the schema pointers in `catalog/recipes/execution-bindings.json`, with the existing
contract hashes checked at generation time. Generate a Java schema-data class for the
prototype using the established Java literal emitter; keep dispatch explicit. A small
validator interprets that data. Do not copy parameter bounds into handwritten branches or
execute the Java binding proposal strings. Generation must reject unknown schema keywords
and provide deterministic drift checking before this becomes an accepted consumer.

The initial subset needs object properties/required/additionalProperties, tuple prefixItems,
homogeneous items schemas (palette colors), items:false, array length constraints, numeric
bounds and object/array/number/integer types. Annotation keys do not affect admission.
Runtime numbers must be finite supported Java numeric wrappers, with boolean distinct from
number and integral binary64 values allowed for integer schemas. This is a closed subset
for these four bindings, not a claim of general JSON Schema implementation.

Order is: resolve instance/declaration/port; evaluate input expressions in declared order;
validate resulting input shape and scalar bounds; calculate and reserve operation costs;
invoke the existing native method. Expression evaluation can itself exhaust budgets before
an operation input exists. Native semantic failures remain native failures: grid product/
coordinate overflow, instance-dependent point index bounds and path trace failures should
not be reimplemented in the schema validator. Cost reservation may therefore precede those
native semantic failures. This is consistent with failed calls consuming reservations.

Focused admission evidence must include malformed path input with huge steps (schema error
before allocation reservation), a schema-valid path over the host work budget (limit error
before trace), a wrong instance port, and a schema-valid native semantic failure preserving
its original code. No runtime acceptance follows merely from generating schema data.

## Target-specific export admission

Java prototype exports explicitly identify `processing-java` (the Java-specific CLI default)
and reject other requested targets with `UNSUPPORTED_TARGET` before output creation. The
same bounded recipe object passes the existing static validator and is canonically hashed
in export metadata. Its declared operations must pass the shared attestation checker for
that target, including implementation hashes, evidence predicates and acceptance reviews;
core must be conformant and native support validated-scoped. Export metadata includes only
those checked target dimensions. The existing full-catalog checker still checks all targets.

This admission verifies the dependencies used by an experimental export. It does not grant
executor acceptance or make the direct Java Map API a structurally validating API. Editable
parameters remain data-only and are separately checked at build/evaluation time; their build
hashes identify the actual edit, while the validated recipe hash identifies the export input.
The next execution-boundary work is a validated-composition interface before exposing Java
submission to application callers. Other target executors, assets and animation remain open.
