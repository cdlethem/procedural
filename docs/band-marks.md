# Draw winding bands of lines

BandMarks draws fine, wandering lines that often curl around shared areas of the canvas.
Imagine an invisible height map: each line tries to stay near the height where it began.
A looser tolerance gives it more freedom to wander away from that level.

[Install the Java library](building-java-from-source.md), then open **BandMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **T** | Switch tolerance from 0.002 to 0.008, allowing a wider band of field values and changing the routes. |
| **C** | Change the palette without changing paths. |
| **M** | Replace connected lines with short strokes placed across them. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit `rebuildPaths()` to choose where the lines begin and how they move.

| Parameter | What it changes |
| --- | --- |
| `start` | Where each line begins. |
| `tolerance` | How closely the line must stay near its starting field value. |
| `fieldScale` | The spatial scale of the invisible pattern the lines follow. |
| `stepDistance` | How far a proposed movement reaches. |
| `attempts` | How many movements are tried; rejected movements do not lengthen the line. |

`NoiseBandPath2D` returns the points and directions. Replace the drawing loop to decorate
the same routes with other marks. These paths are not complete contour lines: they may
cross themselves or one another, and their lengths vary. Use [PathClipMarks](path-clip-marks.md)
to reveal the resulting lines only inside a chosen outline.
