# Java recipe preview

This is a Java-only experimental route for exporting the two draft compositions. It is
separate from the accepted Processing starters and does not establish a general recipe
executor or exporter. The current slice binds four operations: regular grid, gradient
noise, cyclic palette, and gradient path. Its drawing output is static JAVA2D using the
segment and single-fill convex-quad commands.

The established artist entry points remain the accepted [FieldMarks starter](getting-started.md)
and [PathMarks guide](path-marks.md). Their editable Java sources are
`packages/java/examples/FieldMarks/MarkField.java` and
`packages/java/examples/PathMarks/PathMarkComposition.java`; the Processing tabs live
under `packages/java-processing/examples/`.

## Export a composition

Use a fresh output directory for each export. From the repository root:

```sh
uv run python tools/export_recipe_java_prototype.py \
  --recipe design/recipes/examples/field-marks.draft.json \
  --output .work/recipe-export-field
```

For the path composition, substitute:

```sh
--recipe design/recipes/examples/path-marks.draft.json \
--output .work/recipe-export-path
```

The exporter writes a standalone snapshot containing the recipe, editable
`parameters.json`, Java sources, provenance and a `build.py` script. The drafts are
architecture examples, so this workflow remains prototype-only.

Build the fresh snapshot with an explicit JDK and the audited Processing 4.5.6 core JAR
(see [Java build dependencies](building-java-from-source.md)):

```sh
python3 .work/recipe-export-field/build.py \
  --java-home /path/to/jdk \
  --processing-core /path/to/processing/core.jar \
  --output .work/recipe-build-field
```

The script prints the standalone Java command. Give that command a new absolute PNG
path. On this machine, run it through the shared native-render lock, for example by
placing the printed command after:

```sh
python3 tools/with_native_render_lock.py -- xvfb-run -a
```

The output path must end in `.png` and must not already exist.

## Make edits

The FieldMarks snapshot exposes the composition controls used by the starter:
`maxLength` (stroke length), `bars` (mark treatment), `colors` (palette), and `seed`.
The PathMarks snapshot exposes `trace`, `markLength`, and `seed`. Edit those keys in
`parameters.json`, then build into another fresh output directory. The build records
the exact parameter file and canonical values used for that build.

To change composition, edit the original draft JSON and run the exporter again. The
standalone one-shot export does not reuse geometry between runs. Geometry reuse is
available only through the direct Java `RecipeEvaluator.Session` API in the prototype;
it is not part of this exported artist workflow.

This preview covers static Java JAVA2D output only. Assets, animation, other export
targets and additional operations are outside the current slice.
