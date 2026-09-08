# Install GrainMarks 0.5.0

The local Java 0.5.0 archive contains five editable starters: FieldMarks, PathMarks,
PlacementMarks, RegionMarks and GrainMarks. It is a local build, not a registry release.
GrainMarks adds retained triangle sampling and explicit coordinate mapping for point textures.

Extract `.work/dist/cp5/java/procedurals-processing-0.5.0.zip` and put its `procedurals`
folder in your Processing sketchbook's `libraries` directory. Keep one installed version
of this library. Restart Processing and open `examples/GrainMarks/GrainMarks.pde`.
Copy the whole example folder before editing; keep `GrainComposition.java` beside the PDE.
That Java tab is editable composition; `TrianglePoints2D` lives in the library JAR.

Use Processing 4.5.6 and JAVA2D. Press **B** to change the grain distribution, **N** to
change its density, **C** to recolour and **M** to replace dots with strokes. **X** applies
grain to divided cells; **R** changes seed; **0** restores the baseline; **S** saves the
canvas currently displayed. The [GrainMarks guide](grain-marks.md) explains the two operations.

In a prepared checkout with JDK 17 and pinned Processing/preprocessor dependencies:

```sh
uv run python tools/run_triangle_points_java.py --output evidence/conformance/triangle-points-java.json
uv run python tools/build_grain_marks_java.py --publish-evidence
```

These commands rebuild core evidence and local artifacts; they do not publish externally.
The builder preserves an existing output directory and refuses to overwrite it. Do not
rerun an accepted evidence build merely to install its existing archive. It creates core
and Processing adapter JARs plus the starter ZIP under `.work/dist/cp5/java/`.

The [distribution report](../evidence/distribution/cp5-java.json) records artifact hashes,
an extracted-JAR fixture consumer and official compilation of all five examples. The
[native review](../evidence/reproductions/cp5-java2d/root-review.json) accepts the installed
GrainMarks interaction and images. CP5 support is Java/JAVA2D only; the other ports remain
deferred. Original-source pixel identity and full-corpus certification are not claimed.
