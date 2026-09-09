# Shape closed loops and decorate their edges

LoopMarks draws four smooth closed outlines with small tiles following their edges.
Change a control point to stretch each outline, or switch to fans of triangles that fill
the same shapes from their centers.

[Install the Java library](building-java-from-source.md), then open **LoopMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **T** | Move one control point on each loop, stretching that part of its outline. |
| **C** | Change the palette while keeping the shapes. |
| **M** | Switch edge-following tiles to triangle fans. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit the control-point coordinates in `rebuildCurves()` to shape each loop.
`ClosedSpline2D` turns those points into a smooth closed curve and lets you ask for positions
and directions along it. The curve passes through your control points and bends smoothly
between them.

| Setting to edit | Visible effect |
| --- | --- |
| Control points | Where the outline bulges, narrows or stretches. |
| Distance between tiles | How closely marks gather along the edge. |
| Tile size | How much of the outline the marks cover. |
| Fan colors and opacity | The bands of color inside the filled version. |

The tile loop in `draw()` places a mark every 18 units of approximate curve length.
Replace its rectangle with another mark and use the sampled direction to rotate it.
Loops can cross themselves. Triangle fans are a drawing treatment for these examples,
not a general way to fill every possible concave outline.
