# Fill shapes with grain

GrainMarks fills a triangle with tiny dots. Increase the density for a fuller texture,
gather points toward one part of the shape, or replace dots with short strokes. You can
also spread the grain across a patchwork of cells.

[Install the Java library](building-java-from-source.md), then open **GrainMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **C** | Recolor the same points. |
| **M** | Replace dots with short horizontal strokes at the same centers. |
| **N** | Double the example’s point density, from 0.1 to 0.2 points per square pixel. |
| **B** | Cycle between even coverage and two uneven distributions that gather points in different parts of each triangle. |
| **R** | Try a new scatter; in cell mode, also change the layout. |
| **X** | Switch between one triangle and a divided rectangle filled with grain. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Use `TrianglePoints2D.seeded` with three triangle corners, a seed and a point count to
get positions for your own dots, strokes or small shapes. Draw those positions with ordinary
Processing calls. Keep the positions if you want to try another color or mark without
reshuffling the texture.

| Setting | What you control |
| --- | --- |
| Triangle corners | The area in which mark centers are placed. |
| Point count | How many marks are placed in that triangle. |
| Mark size and opacity | How dense or light the texture looks, without moving its centers. |
| Seed | Which repeatable scattering you get. |

The example calculates point count from triangle area and density in its Java composition
tab. Edit the PDE to change the marks. `TrianglePoints2D.map` also lets you supply the
sampling values yourself for more control over concentration.

Only the mark centers are placed inside the triangle: long strokes or large dots may
cross its edge. Use a mask if the entire painted shape must stay inside.
