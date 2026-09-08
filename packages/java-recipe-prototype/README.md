# Java recipe evaluator prototype

This directory is outside the accepted Java library and source-bundle manifest. It is an
implementation experiment for the draft composition model and four reviewed immutable
operations, not an accepted executor, exporter or target support attestation.

`RecipeEvaluator.evaluate(recipe, limits)` consumes an in-memory Map after static recipe
validation. It uses existing operation implementations and returns a complete detached,
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

The established runner serializes and reparses both draft recipes, then compares actual
Java output across eleven FieldMarks/PathMarks baseline/edit scenarios, comparing both fresh and session
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

General project export support, catalog promotion and complete admission review remain
separate gates. Later operation
bindings, assets, animation, other target exporters and MCP/web are unfinished. Root owns
acceptance; successful command comparison alone does not establish those capabilities.

## Snapshot export experiment

`tools/export_recipe_java_prototype.py --recipe <draft.json> --output .work/<fresh-name>`
produces recipe JSON, embedded Java data, library/adapter sources, licenses, source hashes
and a standalone build script. Supply an explicit JDK and Processing core to that script.
Edit `parameters.json` in the exported folder and build a fresh output to change values.
The standalone build validates that JSON and generates data-only Java; no runtime JSON
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
not hypothetical reconstruction. The eleven exact comparisons and focused failure groups
cover style reuse, geometry invalidation, alias detachment, budget rejection and recovery.
This establishes the scoped prototype behavior, not accepted general executor support.

Standalone parameter editing now has a copied-project native case: default FieldMarks and
an edit to its palette both match the accepted native references exactly. The build records
actual parameter bytes, canonical values, generated data source and JDK/core identities.
Malformed JSON fails before compilation; invalid operation values fail in the evaluator
before the exported entry point requests a renderer. Composition changes still require a
new export. Evidence: `evidence/distribution/recipe-parameter-edit-prototype.json`.
