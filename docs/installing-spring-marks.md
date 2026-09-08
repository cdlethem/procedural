# Preview: install SpringMarks on Processing Java

SpringMarks is the tenth editable Processing starter and uses the Java
`motion.target-springs-2d` operation. The Java core and the registered Processing JAVA2D
workflow have scoped acceptance. The local 0.10.0 archive is available; it has not been
published to a registry.

The archive is staged at
`.work/dist/cp10/java/procedurals-processing-0.10.0.zip`. Extract its `procedurals`
folder into your Processing sketchbook's `libraries` folder, restart Processing, and
open `SpringMarks` from the library examples. It requires desktop Processing 4 with
the JAVA2D renderer. The archive is a local build, not a registry release.

For a checkout copy, stage the candidate example with:

```sh
python3 tools/prepare_spring_marks.py --output .work/examples/my-spring-build
```

Open the resulting `SpringMarks/SpringMarks.pde` in Processing. The staging command
compiles the candidate core and helper and checks PDE preprocessing; the registered
JAVA2D render acceptance is recorded separately in the
[workflow review](../evidence/reproductions/cp10-java2d/root-review.json). Use a fresh
output directory for another attempt.

The sketch starts paused. Press **D**, then **Space** to disturb the targets and begin
motion. Press **.** while paused for one explicit tick. **M** changes dots, velocity
segments and fixed-connectivity wire; **C** changes palette; **H** toggles trails; **T**
shows target guides; **K** and **V** change the authored response settings; **0** resets;
and **S** saves the cached completed frame. For a controlled response comparison, press
**0**, choose **K** or **V** while paused, press **D**, and use **.** the same number of
times in each run. This preserves the target sequence and logical tick count while
comparing coefficients. See the [SpringMarks guide](spring-marks.md) for the editable
boundary and the [operation reference](reference/operations.md) for the state contract.

The example's canvas, regular layout, response values and target-return policy are
authored choices. They are not library defaults or recommended ranges. The core uses
specified binary64 arithmetic; the source sketch that motivated the recurrence used
Processing binary32 behavior. The scoped JAVA2D acceptance does not claim source-pixel
reproduction, natural frame-rate performance, or support for other targets.
