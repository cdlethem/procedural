# Make a responsive arrangement

SpringMarks keeps an arrangement of marks in motion while leaving the target policy,
drawing treatment and connectivity visible for editing. The Processing example is
[SpringMarks.pde](../packages/java-processing/examples/SpringMarks/SpringMarks.pde),
and its Java composition is
[SpringComposition.java](../packages/java/examples/SpringMarks/SpringComposition.java).
The Java core `TargetSprings2D` and the registered Processing JAVA2D workflow have
scoped acceptance. The local 0.10.0 package is available for Processing Java; this is
not a registry publication or a claim for other targets.

From the repository root, stage the editable example with:

```sh
uv run python tools/prepare_spring_marks.py --output .work/examples/SpringMarks
```

Open `.work/examples/SpringMarks/SpringMarks/SpringMarks.pde` in Processing 4 with
JAVA2D. The staging command refuses an existing attempt directory; choose a new output
path for another attempt.

## Start with one disturbance

The sketch is a 640×640 JAVA2D composition of 49 sites in a 7×7 regular arrangement.
Those layout, canvas and mark settings belong to this example. It opens paused. Press
**D**, then **Space**. **D** changes the current targets;
it does not move the sites or advance a tick. **Space** starts the explicit tick loop.
Press **.** while paused to advance exactly one tick and inspect the response. A paused
display redraw never advances the motion.

The core operation only answers one question: given each body's position, velocity,
strength and retention, and one target pair per body, what is the next state? The example
policy supplies the targets. On every tick it moves each target 4% toward its initial
position, then calls the core once. This keeps target generation as an editable policy
instead of hiding it inside the reusable operation.

The initial positions and targets are equal, and velocities start at zero, so the piece
stays still until you disturb it. Equal position and target produce zero force; with no
velocity already stored, there is no source of motion. The return policy then brings a
disturbed target back toward its initial position over later ticks.

## Change the response and the drawing

**K** switches the authored strength between `0.025` and `0.05`. **V** switches the
authored retention between `0.7` and `0.9`. Each edit exports the current state, changes
the coefficient values, and imports a new batch. Positions, velocities, targets, trail
samples, tick and fixed connectivity remain in place, so the response change begins
from the same moment in the motion. For a controlled comparison, press **0**, select K or V while paused, press **D**,
then use **.** the same number of times in each run. This holds the target sequence
and logical tick count fixed; equal wall-clock viewing time does not.

The response values belong to this example. They are authored settings, not library
defaults or recommended continuous ranges. The contract permits finite nonnegative
strength and retention from 0 through 1, but it makes no settling promise for every
permitted choice.

**M** selects one of three drawing treatments:

- dots show the current site positions;
- velocity segments show the current velocity with a display-only scale;
- wire shows the original connectivity using the current positions.

**C** changes the palette, **H** toggles trails, and **T** toggles target guides. These
style and guide edits do not step the batch. Target guides draw a line from each current
site to its current target and a cross at that target, making it clear whether an edit
changed input targets or motion state.

The wire is built once from the initial regular arrangement. Its edges are mapped back
to the original spring body indices explicitly and then drawn at the current positions.
It is a deformation of initial connectivity, not a Delaunay triangulation of the moving
sites. The example does not retriangulate, prevent face crossings or promise a valid
current Delaunay mesh.

Trails retain at most 121 complete position samples: the initial sample plus 120 ticks.
Once full, the ring replaces its oldest sample. Each trail is drawn in chronological
order and is left open; the newest sample is never joined back to the oldest. The core
owns no trail history, so the trail is an example-level visual layer.

Press **S** to save the last completed canvas. Saving uses the cached frame and does not
rerender or advance the simulation. Press **0** to return to the initial coefficients,
styles, targets, trails and paused state.

## Numeric and evidence boundary

The source sketch that motivated the recurrence used Processing `float` arithmetic and
its own pointer and target behavior. SpringMarks uses the independently specified core’s
binary64, separately rounded arithmetic and the example’s explicit target-return policy.
It does not claim source-pixel reproduction or reproduce the historical pointer input.
The source evidence is [araniaaas](../survey/out/2018/Generativos/araniaaas/notes.md).

The accepted [JAVA2D workflow review](../evidence/reproductions/cp10-java2d/root-review.json)
checked the registered paused, disturbance, target-guide, stepping, style, response,
replay, cached-save and 260-tick trail-wrap sequence. It inspected the distinct captures
and verified exact replay and drawing arguments on the recorded Processing/JDK runtime.
This scoped result does not claim source-pixel reproduction, human usability testing,
natural frame-rate performance, or support for other targets.
