# Install RegionMarks 0.4.0

The local Java 0.4.0 archive contains four editable starters: FieldMarks, PathMarks,
PlacementMarks and RegionMarks. It is not a published registry release. RegionMarks adds
seeded surface subdivision and content that can be changed independently of its cells.

Extract `.work/dist/cp4/java/procedurals-processing-0.4.0.zip` and put its `procedurals`
folder in your Processing sketchbook's `libraries` directory. Use one installed version
of this library. Restart Processing, then open `examples/RegionMarks/RegionMarks.pde`.
Copy the whole example folder to your sketchbook before editing; keep
`RegionComposition.java` beside the PDE. That Java tab is editable composition code,
while `QuadrantPartition2D` lives in the library JAR.

Use Processing 4.5.6 and JAVA2D. Press **M** to replace each dot with a grid while retaining
the cells, **C** to recolour, **N** for 100/200 replacements, **G** for half/full-list
selection, **R** for another seed, **X** for authored rectangular cells and **S** to save.
N/G/R apply to the seeded layout. The [RegionMarks guide](region-marks.md) explains the
operation and the editable content boundary.

To build in a prepared checkout with JDK 17 and pinned Processing/preprocessor dependencies
under `.work/toolchains/processing-4.5.6/`, run:

```sh
python3 tools/build_region_marks_java.py --java-home /path/to/jdk-17
```

The builder also requires current passing quadrant-partition conformance evidence. It
preserves existing output and evidence rather than overwriting them, and does not download
dependencies or publish a package. Its local outputs are the core JAR, Processing adapter
JAR and starter ZIP under `.work/dist/cp4/java/`.

The [distribution report](../evidence/distribution/cp4-java.json) records artifact hashes,
extracted-JAR fixture checks and official PDE compilation. The
[native review](../evidence/reproductions/cp4-java2d/root-review.json) accepts the installed
example's 11 states/events, retained edits, authored transfer and cached save. This is
scoped Java/JAVA2D evidence; other CP4 target ports and upstream pixel reproduction remain
outside this delivery claim.
