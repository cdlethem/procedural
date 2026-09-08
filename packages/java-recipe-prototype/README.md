# Java recipe evaluator prototype

This directory is outside the accepted Java library and source-bundle manifest. It is an
implementation experiment for the draft composition model and four reviewed immutable
operations, not an accepted executor, exporter or target support attestation.

`RecipeEvaluator.evaluate(recipe, limits)` consumes an in-memory Map after static recipe
validation. It uses existing operation implementations and returns a complete detached,
read-only command list plus environment and diagnostic counters. It does not parse JSON,
render, or cache retained geometry between evaluations.

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
Java output across nine FieldMarks/PathMarks baseline/edit scenarios. FieldMarks covers
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

Native project export and representative render evidence, retained-geometry reuse/invalidation,
catalog promotion and complete budget failure review remain separate gates. Later operation
bindings, assets, animation, other target exporters and MCP/web are unfinished. Root owns
acceptance; successful command comparison alone does not establish those capabilities.

## Snapshot export experiment

`tools/export_recipe_java_prototype.py --recipe <draft.json> --output .work/<fresh-name>`
produces recipe JSON, embedded Java data, library/adapter sources, licenses, source hashes
and a standalone build script. Supply an explicit JDK and Processing core to that script.
Edit the source recipe and re-export to change this snapshot; no runtime JSON parser is
claimed. Sources must match their manifest before building.

The first copied FieldMarks export compiled independently and matched the accepted baseline
exactly in native JAVA2D. Root inspected it; evidence is in
`evidence/distribution/recipe-java-export-prototype.json`. This is one native case, with
PathMarks export, retained reuse, catalog promotion and general support still pending.
