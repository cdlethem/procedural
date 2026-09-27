# Obstacle Roads

Draw orthogonal routes through an editable cost and obstacle field, from a few separated segments to branching shared routes.

A single requested start cell sends `costGridPaths2D` across a rectangular four-neighbor grid. Each step adds the **destination** cell's cost; the predecessor chain for each reachable goal is a weighted shortest route, not simulated steering. An `x` cell is impassable; an unreachable or blocked goal contributes no route. The requested start never moves to a convenient neighboring cell: a blocked start is an input error. A destination with cost 0 is legal.

For a smaller grid, first reduce the start and goal coordinates/count to fit. Prepare dimensions and text with Noise or Stripes selected, then choose Numeric grid last. The interface keeps the last valid recipe rather than committing a partly resized grid.

| Control | What it changes |
| --- | --- |
| Columns / Rows | Row-major grid resolution; at most 2,500 cells, 2–50 along each axis. |
| Origin X / Y; Grid width / height | Left/top edge and independent horizontal/vertical extent in canvas units. Cell centers are `(originX + (column + .5) * width / columns, originY + (row + .5) * height / rows)`; no canvas fitting. |
| Start column / row | Exact zero-based start cell. These must lie inside the edited grid and be traversable. |
| Cost source | **Noise** samples seeded coherent cost and obstacle signals; **stripes** makes deterministic parallel cost and obstruction stripes; **grid** uses only Numeric grid. |
| Numeric grid | In grid mode, supply exactly Rows lines, each with exactly Columns space- or comma-separated numeric costs (0–1,000,000) or `x` for blocked. Extra/missing cells and negative, malformed or nonfinite costs error. Example for a 5×3 grid: `1 1 x 3 1` / `1 2 x 2 1` / `1 1 1 1 1` (write as separate lines). Density, frequency, contrast and seed are ignored in this mode. |
| Obstacle density / Source frequency / Cost contrast | Noise uses an independent seeded obstacle sample below the density cutoff and cost `1 + contrast * noise`; stripes block the density fraction of each frequency cycle and use `1 + contrast * (.5 + .5 * sin(2π * frequency * (column + .5) / columns))`. Density zero leaves every cell open. Frequency 0.05–40, density 0–0.95, contrast 0–100. |
| Goal placement / Goals / Explicit goals | Edge distributes goals across the rightmost column; ring places them around the grid center; explicit takes one zero-based `column,row` pair per line (up to 96). A procedural goal count that cannot fit distinct grid cells errors instead of silently dropping goals. Blocked or disconnected goals simply have no route. |
| Stroke weight / Path node size | Independent width of predecessor lines and diameter of dots at nodes on reached paths. Zero each to remove that material. Shared predecessor edges are drawn once. |
| Obstacle ink | Optional colored rectangles centered in blocked cells. Zero means no board and no obstacle paint; at 1, rectangles fill only blocked cells. |
| Contour count / First arrival / Arrival spacing | Shared controls with Arrival Contours; only that treatment draws arrival isolines. They do not alter route construction. |
| Palette / Seed | Palette changes ink only. Seed changes Noise cost/obstacle geography when density or contrast is nonzero; with both zero all cells cost 1 and seed is inert. Seed does not change deterministic stripes, an explicit grid, start, goal coordinates or material. |

**Blocked-channel detour:** set Columns/Rows to 5/5, Cost source to grid, Start column/row to 0/2, Goal placement to explicit and Explicit goals to `4,2`. Enter numeric grid as five lines: `1 1 x 1 1`, `1 1 x 1 1`, `1 1 x 1 1`, `1 1 1 1 1`, `1 1 x 1 1`. Routes descend through the only opening before climbing the far side. Increase the cost of `3,3` to force a different predecessor corridor if an alternative opening exists.

**Sparse traversals:** start with the default Noise, 24×24 cells, start 3,12, twelve edge goals, density .17, contrast 3, weight 1.8, node size 2 and obstacle ink .65. Try density .02, contrast 9 and just three goals for a small cluster of route lines; turn obstacle ink off entirely for floating route fragments. **Regular barricades:** choose Stripes, frequency 3.2, density .3, start column 3, contrast 8 and a ring of 14 goals; the seed no longer has any effect. When a stripe covers the start, change the requested start or density explicitly rather than relying on relocation.
