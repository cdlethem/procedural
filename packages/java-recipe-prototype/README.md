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
