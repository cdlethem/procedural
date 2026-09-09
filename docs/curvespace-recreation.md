# Draw a luminous, folded grid

Curvespace bends horizontal and vertical lines around circular areas of influence. The
lines glow where they overlap, while a faint grid of dots stays straight behind them.
This example uses Processing’s P2D renderer and additive blending.

[Install the Java library](building-java-from-source.md), then open the repository’s
[Curvespace sketch](../examples/recreations/Curvespace/Curvespace.pde) with its adjacent
`CurvespaceComposition.java` tab. This example is separate from the library example menu.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **C** | Shift the palette without changing the folds. |
| **R** | Choose a new arrangement of influences and rebuild the drawing. |
| **0** | Return to the starting arrangement and palette. |
| **S** | Save the displayed picture as `curvespace.png`. |

## Make it your own

Edit the influence settings in `CurvespaceComposition.java` to place the folds.

| Setting | Visible effect |
| --- | --- |
| Influence centers | Where the grid is pulled. |
| Radius | How far each influence reaches. |
| Power | How the strength of the pull changes across that area. |
| Line sampling | How closely the drawn lines follow the deformation between points. |
| Palette and opacity | The colors and brightness that build up at overlaps. |

Sparse line samples can jump across a sharp fold. Use enough samples for the shape you
want, and remember that crossing lines are part of this effect. The background dots remain
undeformed so you can compare the folds with the original grid.
