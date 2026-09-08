# Java recipe evaluator prototype

This directory is outside the accepted Java library and source-bundle manifest. It is an
implementation experiment against the draft expression model and four reviewed immutable
operations. It is not an accepted recipe executor, exporter or target support attestation.

`RecipeEvaluator.evaluate(recipe, limits)` consumes an in-memory Map after the static
validator. It calls existing library implementations, creates ordered raw command records,
and checks commands using the existing drawing-value validator. No renderer or JSON parser
is implemented here. A native dependency's presence on the compilation classpath does not
mean a renderer ran.

The comparison tool uses the established Java fixture literal generator and compares actual
FieldMarks/PathMarks Java composition output. PathMarks uses its source workflow's canvas
visibility decision, now represented explicitly in the draft recipe. The first unculled
prototype passed seven scenarios before the distance edit failed drawing-profile bounds;
that failure prompted the composition correction, not a weakened profile.

```sh
uv run python tools/run_recipe_java_prototype.py \
  --java-home /path/to/jdk \
  --processing-core /path/to/audited/processing/core.jar \
  --output .work/recipe-comparison-fresh
```

Before acceptance, review runtime type and error precedence, cumulative allocation accounting,
limit snapshots/native allocation sizes, nested iteration diagnostics, low-budget atomicity,
round-trip replay and retained-edit invalidation. Run meaningful failure cases in addition to
command comparisons. Catalog ownership/synchronization, native exports, animation/assets and
all later operation bindings remain incomplete. Root writes acceptance only after review.

Focused failure probes now run through the same tool. They cover lazy arithmetic/type
errors, array preallocation limits, command limits and recovery, nested map diagnostics,
and statement/attempted-iteration budget diagnostics. Root found and corrected missing
iteration context; nine composition comparisons remain exact. This is partial failure
coverage, not acceptance of the complete accounting or replay contract.

Result ownership now has a regression case: changing an input literal cannot change a prior
result, nested result containers are read-only, and fresh execution sees an edited recipe.
Emitted snapshots reserve their detached copy cost. This establishes fresh evaluation
isolation; retained-geometry cache invalidation remains unverified.

The runner now serializes both draft recipes with reordered object keys, deserializes and
revalidates them, then executes those round-tripped values in all nine command comparisons.
It preserves expression/statement array order. Allocation probes also reject a count above
Java's signed-int collection limit even when host budgets are widened. Broader accounting
and retained-edit caching remain unaccepted.

Accounting now includes fresh scalar results, operation materialization, temporary command
normalization, detached publication and owned native arrays. Eight focused failure groups
include limits mutated during evaluation and descriptor work/copy boundaries. The nine
command comparisons pass within unchanged default limits. This remains a prototype: full
schema-driven admission and complete budget failure coverage precede runtime acceptance.

Constructor and query admission now uses immutable schema data generated from catalog
pointers by `tools/generate_recipe_java_schemas.py` (`--check` detects drift). The closed
validator checks finite numeric types, shape and bounds before operation reservations;
it reports the input expression and relative invalid value location separately. Native
semantic errors remain native errors. Nine failure groups and nine command comparisons
pass; six generator tests cover generation and rejection behavior. These are prototype
checks, not accepted runtime, target or exporter support.
