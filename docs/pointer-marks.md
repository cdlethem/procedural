# Pull a drawing with the mouse

PointerMarks starts with a square grid of dots. Hold and drag the mouse to pull nearby
points toward it, then release to let them return toward the grid. Switch to a wire view
to see the connections stretch and bend. The sketch starts paused.

[Install the Java library](building-java-from-source.md), then open **PointerMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **Space** | Run or pause the movement. |
| **Mouse press / drag** | While running, pull nearby points toward the held pointer. |
| **Mouse release** | Stop pulling; points move back toward their original arrangement. |
| **.** | Advance one movement step while paused, using the current pointer position. |
| **M** | Switch dots to a connected wire drawing. |
| **T** | Show or hide target guides. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit the initial grid for a different arrangement. In `PointerMarks.pde`, the pointer’s
radius controls how far its influence reaches, the pull amount controls how strongly it
moves nearby targets, and the return amount controls how quickly targets drift home.
The springs make the points follow those targets with a softer response.

The wire keeps the connections made from the original grid; it does not reconnect at each
frame. Large deformations may make lines cross. Change the drawing code to attach other
marks to the moving points. For a keyboard-controlled introduction to the spring settings,
see [SpringMarks](spring-marks.md).
