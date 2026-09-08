# Smooth loops and marks

Build the [Java source bundle](building-java-from-source.md), open **LoopMarks** from the
library examples, and save your own copy. Four closed outlines carry small oriented tiles.

- **T** moves one control point on each loop, rebuilding its curve.
- **C** changes colors while retaining exactly the same curves.
- **M** replaces tiles with radial fans using those retained curves.
- **0** restores the initial composition; **S** saves `loop-marks.png` from the displayed image.

The defining operation is `ClosedSpline2D`: supply an ordered array of planar controls and
an explicit number of lookup chords per span. The curve passes through the controls and
wraps smoothly around the last-to-first connection. Edit `controls` in `rebuildCurves()`
to reshape the artwork; keep the interpolation and distance lookup inside the library.

```java
ClosedSpline2D curve = ClosedSpline2D.create(
    new double[][] {{40,40}, {220,50}, {190,210}, {60,180}}, 32);
double[] mark = new double[4];
curve.sampleDistance(30, mark); // x, y, raw tangent x, raw tangent y
```

`sampleParameter` uses one unit per control span; `sampleDistance` uses drawing units along
an approximate length table. Both wrap periodically, including negative inputs. A larger
`subdivisions` value spends more setup work and memory on that table.32 is this example's
choice, not a recommended range or an error guarantee. Even perfect equal arc lengths do
not imply equal straight-line distances across tight bends.

The raw tangent can be zero. LoopMarks skips an oriented tile in that case; choose your
own stationary-mark policy. Reuse the four-value buffer in loops to avoid per-query
allocation. `serialize()` returns a detached creation descriptor; changing it cannot change
the retained curve.

[databol](../survey/out/2018/Generativos/databol/notes.md) motivates placing rotated marks
along closed splines; [blobs](../survey/out/2018/Generativos/blobs/notes.md) motivates filling
sampled outlines. Their source lookup uses approximate lengths only between whole control
spans. This operation retains interior chord distances and returns analytic derivatives,
so it intentionally differs from that source behavior. It does not reproduce either full
original. Observed control-count substitutions changed those compositions substantially,
but changed random consumption too; they do not establish a portable recommended count.

Uniform splines may overshoot or self-intersect. The fan view is ordinary drawing for these
chosen shapes, not a general polygon triangulator. The operation supplies no drawing,
font, RNG, open-curve mode or exact arc-length guarantee. Current native validation covers
Processing Java/JAVA2D only; other ports remain deferred.
