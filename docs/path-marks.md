# Make paths, then choose their marks

Use this example when you want movement to accumulate: each step samples a field at
its current position and moves to the next position. The resulting path retains its
points and headings. You can draw the movement itself or attach marks along it.
For independent marks at fixed positions, start with [field marks](getting-started.md).

The PathMarks source examples run in Processing JAVA2D, p5.js, py5 and Android and
have accepted native reviews on their recorded runtimes. Use the
[PathMarks 0.2.0 installer](installing-path-marks.md) for the available standalone
packages and target prerequisites.

## Try the edits

The piece starts with 24 paths and perpendicular strokes. Keep its seed fixed while
trying these controls. Each pair of values is an example configuration, not a
recommended library range.

| intention | control | effect on retained movement |
|---|---|---|
| See where the paths travel | **M** switches between traces and marks | reuses the same paths |
| Extend the marks across their paths | **L** switches total mark length between 12 and 24 | reuses the same paths |
| Change colours | **C** switches palettes | reuses the same paths |
| Extend the calculation by one step | **N** switches between 2000 and 2001 steps | rebuilds paths; the first 2000 steps are identical |
| Change how far each step travels | **D** switches distance between 0.4 and 0.8 | rebuilds paths; later field queries and headings can change |
| Keep the displayed result | **S** saves the current canvas | does not integrate or redraw |

The one-step extension may be outside the canvas or too small to notice. Its purpose
is to demonstrate that extending a path preserves its existing prefix. It is not a
strong visual density control. Step distance changes the integration itself: doubling
it does not simply enlarge a finished drawing.

## Open the composition

In Processing, [PathMarks.pde](../packages/java-processing/examples/PathMarks/PathMarks.pde)
owns the controls. [PathMarkComposition.java](../packages/java/examples/PathMarks/PathMarkComposition.java)
contains the editable arrangement and mark construction. Its `create()` method lays
out the starting positions, then calls `GradientPath2D.trace()` for each start. Its
`mark()` method constructs one perpendicular segment. `PathMarksCanvas.java` draws
the resulting commands into the native canvas.

To change the treatment, begin in `mark()`. It receives an endpoint, the incoming
movement heading, total mark length and colour. The current implementation adds
a right angle (`Math.PI / 2` radians) to make the mark perpendicular. Using
`heading` directly makes it parallel instead. This is a suggested source edit, not
a separately validated reproduction. The existing canvas submission is designed
for the example's bounded line segments; replacing them with much larger geometry
also requires reviewing that submission boundary.

To change movement, edit the starting grid or field mapping in `create()`. The
current field scale is 0.002, angle base is -20 radians and angle scale is 40 radians.
These configure this particular piece. They are not built-in defaults or measured
useful intervals. A change to these inputs requires creating new paths; a change to
the palette or mark treatment does not.

The equivalent editable modules are
[path-marks.js](../packages/javascript/examples/path-marks/path-marks.js) and
[path_marks.py](../packages/python/examples/path_marks/path_marks.py). The reusable
operation is the integration calculation. Grid arrangement, choosing every fourth
step for a mark, per-path palette selection and perpendicular strokes remain visible
example choices.

## What this demonstrates

The separation between movement and mark treatment is motivated by
[ciserp](../survey/out/2019/generativos/ciserp/notes.md), with related path evidence in
[mantel](../survey/out/2018/Generativos/mantel/notes.md),
[natalata](../survey/out/2019/generativos/natalata/notes.md) and
[limo002](../survey/out/2019/generativos/limo002/notes.md). This example uses the
package's gradient field and its own composition; it does not reproduce their
original noise algorithms or pixels.

The inspected examples show converging paths, canvas exits and horizontal runs.
The field is not guaranteed to give equally varied movement in every direction.
The accepted [Processing](../evidence/reproductions/cp2-java2d/review.json),
[browser](../evidence/reproductions/cp2-p5js/review.json) and
[py5](../evidence/reproductions/cp2-py5/review.json) and
[Android](../evidence/reproductions/cp2-android/review.json) reviews cover the registered
trace, marks and longer-marks images, actual example edits and saving. They establish
those behaviors on the recorded runtimes; human usability feedback remains to be gathered.
