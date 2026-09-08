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
