# Give an arrangement spring motion

SpringMarks shows an arrangement of points that move toward target positions, overshoot
and settle. Draw the motion as dots, velocity strokes or a bending wire network. The
sketch starts paused: disturb the targets, then run it to see movement.

[Install the Java library](building-java-from-source.md), then open **SpringMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **D** | Disturb the targets so the arrangement has somewhere new to move. |
| **Space** | Run or pause the motion. |
| **.** | Advance one step while paused. |
| **K** | Switch pull strength between 0.025 and 0.05; the higher value pulls points more strongly toward targets. |
| **V** | Switch motion retention between 0.7 and 0.9; the higher value keeps more motion between steps, so it takes longer to settle. |
| **M** | Cycle dots, velocity strokes and the connected wire drawing. |
| **H** | Show or hide motion trails. |
| **T** | Show or hide the target guides. |
| **C** | Change the palette. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Use `TargetSprings2D` when you have positions and want them to move toward supplied
targets. Change target placement in `SpringComposition.java`, then choose how to draw
the moving positions in `SpringMarks.pde`.

Stronger pull and less damping can produce more overshoot; they are not simple speed
controls. Compare settings by resetting, disturbing the targets and advancing the same
number of steps. Style changes while paused leave the point positions unchanged.

The wire keeps its original connections as it bends, so edges may cross. This is not a
collision simulation. For mouse-controlled targets, try [PointerMarks](pointer-marks.md).
