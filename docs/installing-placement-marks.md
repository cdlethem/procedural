# Install PlacementMarks 0.3.0

PlacementMarks 0.3.0 is a **local Java-only artifact**, not a public package release.
It contains the Processing desktop starter and the Java core that supplies its retained
circle placements. JavaScript, py5, and Android ports of this CP3 capability are deferred.
The earlier [FieldMarks 0.1 installer](installing.md) and
[PathMarks 0.2 installer](installing-path-marks.md) remain available.

## Build the local archive

Start from this checkout with JDK 17 and the pinned Processing 4.5.6 runtime and
preprocessor available under `.work/toolchains/processing-4.5.6/`:

```sh
python3 tools/build_placement_marks_java.py --java-home /path/to/jdk-17
```

The builder writes these ignored local artifacts:

```text
.work/dist/cp3/java/procedurals-core-0.3.0.jar
.work/dist/cp3/java/procedurals-processing-adapter-0.3.0.jar
.work/dist/cp3/java/procedurals-processing-0.3.0.zip
```

It preserves an existing CP3 output directory and stops rather than replacing it. It does
not download Processing, install a library, or publish anything. The build check compiles
the extracted core JAR consumer and the extracted PlacementMarks PDE with the pinned
Processing preprocessor.

## Put it in the Processing sketchbook

Extract `procedurals-processing-0.3.0.zip`. Copy its `procedurals` directory into your
Processing sketchbook's `libraries` directory, so the installed path is:

```text
<sketchbook>/libraries/procedurals/
```

That folder contains `library.properties`, `library/procedurals.jar`, the matching desktop
adapter JAR, notices, and three editable examples. Restart Processing if it was open. Open
`examples/PlacementMarks/PlacementMarks.pde`, or copy the whole `PlacementMarks` example
folder into your own sketchbook before editing.

Keep `PlacementComposition.java` beside `PlacementMarks.pde`. It is an editable Java tab,
not a class hidden in the JAR: it contains the seeded rectangle proposal configuration and
the authored radial proposal example. The core JAR does not contain that helper, so the
sketch has one unambiguous `PlacementComposition` class.

Use Processing 4.5.6 with the JAVA2D renderer. The supplied sketch fixes its canvas and
renderer in `settings()`; those are starter choices, not an API requirement.

## Try the recorded edits

The keys below are discrete edits exercised by this starter. They are not a recommendation
for a continuous parameter range.

| Key | Effect |
|---|---|
| `R` | Advance the explicit seed and rebuild the seeded placement. |
| `N` | Toggle the starter's 5,000 and 10,000 proposal budgets. The tested longer run keeps the shorter accepted prefix. |
| `G` | Toggle the starter's separation scale between 1 and 1.2. |
| `I` / `O` | Toggle the starter's minimum or maximum proposed radius settings. |
| `M` / `C` | Change motif or palette while retaining the current placement. |
| `X` | Switch to the editable radial proposal list in `PlacementComposition.java`. |
| `S` | Save the displayed cached canvas. |

`CirclePlacements2D` returns retained centres, radii, and source indices; it does not draw.
The sketch's rings, diamonds, colours, rectangle, radial bands, and canvas are composition
code you can change. The [PlacementMarks guide](placement-marks.md) explains that boundary
and the ordered size-aware exclusion rule.

## What was checked

The [distribution report](../evidence/distribution/cp3-java.json) records the 0.3.0 artifact
hashes, extracted-JAR class origin, seeded and explicit-filter fixture checks, and official
PDE preprocessing/compilation. The accepted
[Java/JAVA2D starter review](../evidence/reproductions/cp3-java2d/root-review.json) covers
14 recorded compositions, retained style edits, the tested prefix extension, authored radial
transfer, and cached-save equality.

Those checks are scoped to this Processing Java/JAVA2D starter. They do not establish a
registry release, a human installation study, JavaScript/py5/Android support, arbitrary
parameter ranges, maximal packing, or pixel reproduction of the surveyed source sketches.
