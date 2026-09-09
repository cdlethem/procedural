# Choose where colors change

RampMarks colors a fixed grid of circles with a gradient. Move the color stops to
control where transitions happen, then switch from a left-to-right gradient to color
radiating from the center. The circles never move during these edits.

[Install the Java library](building-java-from-source.md), then open **RampMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **T** | Move the second color stop from 0.25 to 0.6, stretching one transition and shortening the next. |
| **C** | Choose another set of colors. |
| **F** | Switch a left-to-right gradient to a center-outward gradient. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

In `rebuildRamp()`, give `StopRamp.create` matching arrays of positions and colors.
A stop says which color belongs at a particular value; colors between stops are blended.
Ask `ramp.sample(value)` for a color and use it in your own `fill()` or `stroke()` call.

| Choice | What you see |
| --- | --- |
| Stops close together | A color transition happens over a shorter distance. |
| Stops farther apart | A longer, more gradual transition. |
| Value from horizontal position | Colors change across the width of the canvas. |
| Value from distance to a center | Colors spread outward around that center. |

Positions must increase. Values before the first stop use its color, and values after
the last use the last color. You can also color by path progress, height or an image value;
the ramp does not decide where your marks go.
