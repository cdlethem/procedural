# Cut branch marks

Cut branch marks turn one editable stroke into a retained set of branching
segments. The idea is simple: choose a seed stroke, spend a bounded amount of
cutting work, then draw each resulting segment with whatever style the sketch
needs. The generator owns selection, first and repeated cuts, deterministic
randomness, and termination; the sketch owns placement, colour, stroke weight,
and composition.

The runnable Processing example is
[`CutBranchMarks.pde`](../packages/java-processing/examples/CutBranchMarks/CutBranchMarks.pde).
Press `a` to narrow the first cut angle, `w` to reduce the work budget, `t` to
toggle the alternate seed stroke, `r` for another seed, `c` to change colour,
`0` to reset, and `s` to save the displayed frame. These edits rebuild the
pool only when geometry changes. Colour changes reuse the same retained pool.

## Make one

Start with an idea such as “a sparse blue twig rising from the lower edge.”
Choose the stroke in your canvas coordinates, pass all required fields to
`LinePool2D.generate`, and draw the returned segments:

```java
import org.procedurals.topology.LinePool2D;
import java.util.Arrays;
import java.util.Map;
import java.util.LinkedHashMap;

Map<String,Object> passiveMap = new LinkedHashMap<String,Object>();
passiveMap.put("seed", 42L);
passiveMap.put("segment", Arrays.asList(480d, 850d, 480d, 200d));
passiveMap.put("attempts", 9000);
passiveMap.put("firstCutAngleScale", 1.4d);
passiveMap.put("minCutLength", 4d);
passiveMap.put("maxSegments", 180001);
LinePool2D pool = LinePool2D.generate(passiveMap);

double[] segment = new double[4];
for (int i = 0; i < pool.size(); i++) {
  pool.segmentInto(i, segment, 0);
  line((float) segment[0], (float) segment[1],
       (float) segment[2], (float) segment[3]);
}
```

The map is a passive carrier with exactly these keys: `seed`, `segment`,
`attempts`, `firstCutAngleScale`, `minCutLength`, and `maxSegments`. The segment
is four finite coordinates. There are no defaults. `segmentInto` writes into a
reusable buffer, so it is useful inside a draw loop without allocating one
array per mark. `segmentAt` and `toValues` return detached values when a
materialized result is more convenient.

`attempts` is the amount of selection work. Some attempts skip a segment shorter
than `minCutLength`; successful cuts append at most two children. `minCutLength`
is a coordinate-unit termination threshold, while `maxSegments` caps the retained
segment count. It is not a byte budget: growing and finishing the owned buffers
also needs temporary memory. Neither control promises visual density or runtime.
The accepted single-pool edit review found that 9000 attempts preserve the
scaffold with fewer fine branches than 90000, and that angle scale changes the
spread. The fixed example viewport does not automatically fit the result.

The small policy helper
[`CutBranchComposition.java`](../packages/java/examples/CutBranchMarks/CutBranchComposition.java)
shows how an artist-facing preset can construct that passive map while keeping
the generator interchangeable.

The operation is deliberately separate from endpoint `BranchTree`: this pool
cuts existing segments, including interior points, and retains ordered final
segments. It does not expose ancestry or a general branching grammar. Keep
placement, tips, colour, and multiple independent pools in the surrounding
composition; do not duplicate the cutting algorithm there.

The contract and implementation details are in
[`seeded-line-pool-2d.json`](../catalog/operations/seeded-line-pool-2d.json),
with the admission rationale in
[`line-pool-admission.md`](../design/capabilities/line-pool-admission.md).
The capability is extracted from
[`2019/generativos/brotes/notes.md`](../survey/out/2019/generativos/brotes/notes.md);
the source sketch remains provenance rather than copied library code. The
editable single-pool observations are recorded in
[`edits-review.json`](../evidence/reproductions/line-pool-p2d/edits-review.json).

Java currently has exact binary64/StrictMath evidence for this operation. The
other ports are deferred. The full 30-pool workload has also passed at 1920×1920
with 594,036 retained segments; see the [workload review](../evidence/reproductions/line-pool-p2d/workload-review.json)
for timings and limits. See [installation](installing-cut-branch-marks.md) to open
the example. This guide does not claim whole-`brotes`
recreation coverage.
