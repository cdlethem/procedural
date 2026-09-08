# Java recipe evaluator prototype

This directory is outside the accepted Java library and source-bundle manifest. It is an
implementation experiment for the draft composition model and seven reviewed immutable
operations, not an accepted executor, exporter or target support attestation.

`RecipeEvaluator.evaluate(recipe, limits)` consumes an in-memory Map and performs bounded structural and lexical
validation before execution. Both fresh and session entry points detach the submitted JSON
data, normalize supported numbers to binary64, and validate all branches against generated
catalog grammar. It uses existing operation implementations and returns a complete detached,
read-only command list plus environment and diagnostic counters. It does not parse JSON,
or render. Static evaluate performs fresh replay; an optional single-threaded Session can
reuse one completed retain stage between edits.

Constructor/query inputs are checked against immutable data generated from catalog schema
pointers. `tools/generate_recipe_java_schemas.py --check` detects drift. The closed validator
checks finite numeric types, shapes and bounds before operation allocation reservations.
Errors identify the input expression and separately locate the invalid computed value;
native semantic failures preserve their original operation codes.

Host limits are copied on entry. Accounting covers expression/input traversal, calls, core
work, loops, native array lengths, generated values, temporary command normalization,
detached result copies and command counts. These deterministic work units are not a byte-
accurate heap limit. Elapsed time is a supervised safeguard, not a deterministic recipe input.

## Current evidence

The established runner serializes and reparses five draft recipes, then compares actual
Java output across thirty FieldMarks/PathMarks/placement-bars/region-panels/triangle-grain baseline/edit scenarios, comparing both fresh and session
execution. FieldMarks covers
length, palette and segment/quad edits. PathMarks compares the existing `streamForCanvas`
workflow with explicit recipe visibility predicates; it is not a general clipping operation.

```sh
uv run python tools/run_recipe_java_prototype.py \
  --java-home /path/to/jdk \
  --processing-core /path/to/audited/processing/core.jar \
  --output .work/recipe-comparison-fresh
```

Focused probes exercise lazy arithmetic, types, allocation/call/visit/work/iteration/command
limits, error precedence and locations, detached ownership, host-limit mutation, fresh replay,
zero traversal and negative remainder. Structured evidence remains explicitly prototype-only
in `evidence/conformance/recipe-java-prototype-commands.json`.

## Remaining acceptance work

Catalog relocation establishes a single metadata authority; draft status remains in force.
The Java Map API now validates the document format, drawing declaration and unselected
branches before execution or cache lookup. Static admission bounds input depth to64 and
values to20000, with a separate schema traversal ceiling of1000000 visits and512 schema
levels. These are engineering limits, separate from runtime counters. Raw JSON syntax,
duplicate keys and the2MiB byte limit remain enforced by the Python reader; Java does not
parse JSON. Admission failure preserves an existing successful session cache.

The exporter separately verifies the requested target's source-bound support evidence.
This closes the known static-validation precondition; general executor/distribution admission
still requires final review of the complete supported surface.
Later operation bindings, assets, animation, other target exporters and MCP/web remain
unfinished. Root owns acceptance; command comparisons and catalog relocation alone do not
establish those capabilities.

## Snapshot export experiment

`tools/export_recipe_java_prototype.py --recipe <draft.json> --output .work/<fresh-name>`
produces recipe JSON, a bounded data-resource reader, library/adapter sources, licenses, source hashes
and a standalone build script. Supply an explicit JDK and Processing core to that script.
Edit `parameters.json` in the exported folder and build a fresh output to change values.
The standalone build validates that JSON and generates a hash-identified binary resource; no runtime JSON
parser is claimed. Composition and library sources must match their manifest before building.

Copied FieldMarks baseline and PathMarks baseline/trace-edit exports compiled independently
and matched their accepted references exactly in native JAVA2D. Root inspected all three; evidence is in
`evidence/distribution/recipe-java-export-prototype.json`. These are three native cases;
catalog promotion and general support remain pending.

## Retained session experiment

`new RecipeEvaluator.Session().evaluate(recipe, limits)` caches a whole completed retain
stage. Parameter dependencies come from the recipe AST; indirect parameter access falls back
to tracking the complete parameter object. Palette/style edits reuse geometry, while relevant
seed/count/movement edits rebuild it. Use `clear()` to discard the entry. Caches are runtime
state and never enter exported recipe JSON.

Cached data and keys are detached from callers. Each warm call checks current array limits
and reserves cached capacity against valueUnits before frame work. Result diagnostics expose
`retainedReused`, `retainedExecutedCalls` and `retainedReservedUnits`; calls count actual work,
not hypothetical reconstruction. The twenty-three exact comparisons and focused failure groups
cover style reuse, geometry invalidation, alias detachment, budget rejection and recovery.
This establishes the scoped prototype behavior, not accepted general executor support.

Standalone parameter editing now has a copied-project native case: default FieldMarks and
an edit to its palette both match the accepted native references exactly. The build records
actual parameter bytes, canonical values, generated data identity and JDK/core identities.
Malformed JSON fails before compilation; invalid operation values fail in the evaluator
before the exported entry point requests a renderer. Composition changes still require a
new export. Evidence: `evidence/distribution/recipe-parameter-edit-prototype.json`.

The private binary resource avoids Java method/constant-size limits for valid recipe data.
A12000-value array and70000-character Unicode string compile and decode exactly; PathMarks
and FieldMarks command comparisons remain exact. The reader bounds allocation and rejects
corrupt resources before evaluation. This is still prototype export behavior.

The placement-bars draft adds seeded placement through the existing CirclePlacements2D core.
Its default256 proposals produce164 marks. Palette and length edits reuse placements in a
Session; seed and proposal edits rebuild them. Packing and growing storage are reserved before
native execution. This adds a recipe binding, not a sixteenth package operation.

The region-panels draft adds retained quadrant subdivision with independently editable insets
and palette. Its resource policy and native preview criteria are in
`design/recipes/region-panels-binding.md`. This is an existing-operation recipe binding.
