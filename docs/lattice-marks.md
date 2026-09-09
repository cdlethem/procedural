# Route paths through a grid

LatticeMarks draws angular paths that move between neighboring grid cells. Each path
claims the cells it visits, leaving later paths to find room around it. Draw the routes
as connected lines or as dots.

[Install the Java library](building-java-from-source.md), then open **LatticeMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **C** | Change the palette without changing routes. |
| **M** | Switch connected lines to dots at visited cells. |
| **W** | Make lines or marks wider: 0.35 or 0.65 of a cell. |
| **L** | Allow up to 36 moves per path instead of 12. |
| **N** | Try 36 starting cells instead of 12. |
| **R** | Generate another set of routes. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Supply grid dimensions, an ordered list of starts, a seed and a move limit to
`OccupiedLatticePaths2D`. The result gives you the visited cells for each route. Scale
those cell coordinates to your canvas and replace the drawing in `LatticeMarks.pde`
with your own line or mark treatment.

Paths can stop before reaching the move limit when no neighboring cell is free. A start
already claimed by an earlier path may produce no path. Increasing the start count does
not guarantee more visible routes. Cell occupancy separates the paths’ centers; it does
not prevent very thick marks from touching.
