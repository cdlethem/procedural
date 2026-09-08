# Java recipe snapshot export prototype

Status: implementation direction, not accepted exporter support.

The first export is a self-contained project source snapshot: canonical recipe JSON,
generated Java recipe data/entry point, existing core/adapter/prototype sources, catalog
contracts and licenses. A stdlib-only build script checks manifest hashes and an explicit
Processing core dependency, then compiles with the supplied JDK. No dependency download,
font, copied corpus asset or rendered image belongs in the export inputs.

The project renders only after complete evaluator success, through the existing Java2DFrame
adapter. It must release the completed surface after saving and preserve adapter failures.
The output PNG must be a new path. Compilation does not render or imply acceptance.
All native runs on this machine use the shared root tools/with_native_render_lock.py wrapper.

This is a snapshot: edit the recipe and re-export to change its embedded data. The generated
Java and library sources remain readable project files. Dynamic JSON loading, cached geometry
edits and an installed general exporter are later work; do not imply they exist here.
Four-target exports, other operations, assets, animation and MCP/web remain in the full goal.

## First native verification

Choose FieldMarks baseline before rendering. Require all nine existing command comparisons
and focused failures against the exact evaluator sources first. Export to a fresh ignored
directory, copy the project to another fresh directory, and compile there without reading
repository sources. Check copied input hashes and record JDK/core identities.

Render the copied project through Processing JAVA2D under the shared lease. Expected result
is exact RGBA equality with the accepted CP1 adapter baseline, using its recorded dimensions
and explicit recipe parameters. Baseline evidence:
`evidence/reproductions/cp1-java2d-adapter/result.json`, case `base`, image
`.work/reproductions/cp1-java2d-adapter/base.png`, RGBA SHA-256
`d534f2fd76c5efba72c3b6bb3f967f3d1589b81213b0be9d30714ebf203f7ce4`.
Verify the baseline image against that hash before comparing; missing/mismatched baseline
is an evidence gap, not permission to silently replace it. Root inspects the candidate.
This proves one native export case, not every recipe or original-sketch recreation.

## PathMarks extension selected before rendering

Compare baseline marks and the trace=true edit with the corresponding accepted images
from `evidence/reproductions/cp2-java2d/review.json`: `marks.png` and `trace.png` under
`.work/reproductions/cp2-public-pde-visible-stream/`. Verify both recorded PNG hashes first.
Both exported projects must compile from copies and match reference RGBA exactly. This
checks the second composition and an actual recipe-data edit, not retained geometry reuse.

## Standalone parameter-edit correction

Sealed source snapshots required repository re-export for every palette or mark edit. That
is inadequate for an editable project. Export an explicit editable `parameters.json` beside
the sealed composition. The standalone stdlib build validates bounded finite JSON and the
combined recipe size/depth, generates only data literals, and records actual parameter and
compiled source hashes. Dynamic operation validation still occurs before renderer creation.
No arbitrary AST or host code is interpreted from the parameter file.

Select FieldMarks baseline and the accepted CP1 `palette` case for native checking. Change
only `parameters.json` in a copied export, rebuild there, then require exact RGBA equality
with `.work/reproductions/cp1-java2d-adapter/palette.png` using its verified evidence hash.
Also reject duplicate keys/nonfinite JSON before compilation and dynamically invalid inputs
before PNG creation. This establishes standalone parameter editing, not mutable composition
source acceptance or general installed exporter support.

## Large-data export correction

A valid12000-value parameter array reproduced javac's `code too large` failure with the
literal-emitting prototype. Arbitrary valid strings can also exceed constant-pool limits.
Keep JSON as the recipe interchange format, but encode the combined validated recipe into a
private `recipe-data.bin` build resource. Generated Java contains only its SHA256 identity;
the bounded reader verifies that identity before decoding and structural admission.

Private artifact layout: ASCII `PRD1`, followed by one tagged value. Tags0/1/2 are null/false/
true;3 is a big-endian binary64;4 is a UTF8 string with a nonnegative32-bit byte length;5 is
an array with a32-bit count and tagged elements;6 is an object with a32-bit count and string
keys (length+UTF8 without a tag), each followed by its tagged value. Integers in the encoding
are big-endian. Bound resource bytes to4MiB, depth to64 and values to20000. Reject nonfinite
numbers, malformed UTF8, duplicate keys, unknown tags, invalid lengths and trailing bytes.
This is build plumbing, not a second public recipe format or Java JSON-parser claim.

Validation uses the existing command-comparison driver's complete FieldMarks/PathMarks
recipe constructors as independent expected data. Check default PathMarks and FieldMarks
with12000 extra numeric values plus a70000-character Unicode string. Both decoded recipes
and evaluated command streams must match; verify each extra value and character explicitly.
The native JVM probe is `tests/native/RecipeExportDataProbe.java`; it compiles against the
exported classes and established recipe-comparison classes. Corrupt-resource cases call the
reader with the actual corrupt digest to test decoding separately from digest rejection.
No renderer is needed when proving this data round trip and exact command equality.

## Placement-bars native preview plan

After the six exact direct-core command/session comparisons pass, render the standalone
placement-bars default and an edit changing only lengthScale to0.75 and colors to the existing
CP1 alternate palette. Both must show164 horizontal marks with unchanged centres; command
comparisons are the geometry oracle. Root inspects mark separation, palette and shortened
lengths. This is a technique-level recipe transfer, not reproduction of an original corpus
image. Native runs use the shared machine lease; record source/build/image identities.
