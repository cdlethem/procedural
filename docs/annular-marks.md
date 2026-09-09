# Build solid rings with open centers

AnnularMarks draws a lit, washer-like solid with a hole through its center. Make the
ring broader, make it deeper, or reduce the number of sides for a more angular form.
The example uses Processing’s P3D renderer.

[Install the Java library](building-java-from-source.md), then open **AnnularMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **W** | Shrink the hole radius from 110 to 60 while keeping the outer radius at 150, making the ring broader. |
| **D** | Increase depth from 30 to 90. |
| **F** | Switch from 48 sides to 12, making the rim more visibly faceted. |
| **C** | Change face colors without changing the shape. |
| **M** | Show one ring or a group of three. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit `rebuildMesh()` to supply outer radius, inner radius, bottom and top heights,
and the number of sides to `AnnularMesh3D`. The result includes the inner wall, outer
wall and the two flat ring-shaped ends.

The inner radius must be smaller than the outer radius and greater than zero. Change
colors by face type to make the inner wall or end faces stand out. Use Processing transforms
to position several copies of the same mesh. More sides make a smoother-looking rim at
the cost of more triangles to draw.
