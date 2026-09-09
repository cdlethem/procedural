# Color a drawing with a three-dimensional field

DepthMarks uses a slice through a three-dimensional field to vary the colors of short
strokes. It can also color a rounded mesh, using each face’s position in space. The
example uses Processing’s P3D renderer.

[Install the Java library](building-java-from-source.md), then open **DepthMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **Z** | Switch the field depth from 0.25 to 1.25, revealing another pattern without moving the strokes. |
| **C** | Change the palette. |
| **M** | Switch between the flat stroke view and the mesh view. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Use `GradientNoise3D01` to sample a value at `(x, y, z)`, then turn that value into a
color or another mark attribute. Changing z chooses a different slice of the field;
it does not move the camera or the artwork itself.

Edit the coordinate scale to change how quickly the pattern varies across space. Keep
the same geometry and try new depths or palettes, or replace the profile used in the mesh
view. Lighting also affects the mesh’s appearance, so it will not look exactly like the
flat stroke view.
