# Render and compare a Java sketch

The repository helper renders a configured Processing JAVA2D sketch and can vary one
numeric parameter over a bounded batch. It uses your explicit library JAR and the same
pinned Processing/JDK setup as the [source-bundle build](building-java-from-source.md).
Run from the repository root, with its Python dependencies installed.

Start with the supplied LoopSweep template and the JAR from your extracted Java bundle:

```sh
uv run python tools/render_java.py tools/templates/LoopSweep/LoopSweep.pde \
  --library /path/to/procedurals/library/procedurals.jar \
  --seed 42 --param radius=110 --sweep spacing=10,18,30 \
  --output .work/my-loop-sweep
```

Open `.work/my-loop-sweep/contact-sheet.png`. The three images have the same curve and
seed, with different mark spacing. Names show the swept values; `report.json` records all
parameters, image hashes, source/JAR/runtime hashes and completion status. A failed batch
remains marked failed even when earlier variants rendered successfully. Outputs stay in
ignored `.work/`; existing output directories are preserved.

For a single image, replace `--sweep spacing=10,18,30` with `--param spacing=18`. Use a fresh
output directory each time. Change `--seed` to vary the example's control-point arrangement.
This is a helper template, not another released library operation or counted starter.

## Connect your own sketch

Copy LoopSweep, rename its folder/main PDE consistently, and edit the drawing. The helper
accepts one main PDE and any adjacent Java tabs. Add this method to a custom sketch:

```java
public void configureRender(long seed, java.util.Map<String, Double> params) {
  // Validate recognized keys and values, store them, and use them in setup()/draw().
}
```

The helper calls this hook before `settings()` and `setup()`, passing an immutable parameter
map. Generate seeded geometry after this call, not in field initializers. Your sketch must
apply the seed to every relevant random/noise source, including explicit operation seeds.
Setting Processing's global seed alone does not seed the package's private generators.
Reject unknown keys so misspelled parameters cannot silently render unchanged artwork.

The LoopSweep hook requires `radius` and `spacing`. Its bounds keep this particular example
within its intended layout/work budget; they are not recommended library parameter ranges.
The seed feeds its local Java Random, while ClosedSpline2D itself consumes no randomness.
Spacing affects only the mark loop, which retains the same curve for a fixed seed/radius.

## Current scope

The helper captures the first completed `draw()`, then exits. The sketch must use JAVA2D,
pixel density1, and at most32 million pixels. This version has no asset/data directory,
extra dependency JAR, P2D/P3D, animation-frame selection or interaction replay support.
Those are remaining helper capabilities, not exclusions from the Java drawing library.
Existing library starters do not automatically implement this configuration hook.

`--seed` accepts unsigned32 integers. `--param name=value` supplies finite numeric values;
`--sweep name=value,value` supplies1–16 variants of one additional parameter. Values are
passed as arguments, not substituted into source code. The helper compiles a private
snapshot, serializes native rendering through the shared machine lease, and terminates a
render process group if its90-second command budget expires (including up to30 seconds
waiting for the lease). Compilation commands have60-second budgets.

Repeatability depends on the sketch honoring its seed/parameter hook and on the recorded
runtime and assets. A completed image or contact sheet is not visual-conformance acceptance
or an original-sketch recreation claim. Use the existing benchmark/review process for those.
For other saved images, use the [contact-sheet helper](comparing-variants.md).
