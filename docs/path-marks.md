# Draw flowing paths and marks

PathMarks draws short strokes along wandering curves. Show the curves themselves, or use
them as a guide for arranging your own marks. Changing the stroke length or palette keeps
the curves in place.

[Install the Java library](building-java-from-source.md), then open **PathMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **M** | Switch between the path lines and strokes placed across them. |
| **L** | Switch stroke length between 12 and 24 pixels; the paths stay put. |
| **C** | Switch palettes without changing the paths. |
| **N** | Add or remove one step at the end of each path (2,000 or 2,001 steps); the difference may be hard to see. |
| **D** | Switch the distance traveled per step from 0.4 to 0.8; paths reach different places and can turn differently. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit the starts, step count and step distance in the sketch to change where paths begin
and how far they travel. Each new position follows the direction of a field sampled at the
previous position, so changing the movement can change the rest of the curve.

`PathMarkComposition.java` creates the paths. `PathMarksCanvas.java` draws them. Replace
the mark-drawing code to put dots, bars or other shapes along the same movement. Save the
computed paths and reuse them when changing colors or marks.

Restart the sketch to restore its original settings. To show these paths only inside an
outline, use [PathClipMarks](path-clip-marks.md); the outline crops the drawing rather than
steering its movement.
