# Panel marks

Binary partition attempts cut an integer grid into ordered rectangular leaves. **Columns** and **Rows** determine the cutting grid independently; **Center X/Y** and **Width/Height** place its footprint without automatically fitting the canvas. The **Longest** axis policy follows the grid's integer dimensions, not physical pixels; **Random** makes independent axis decisions. Attempts may fail when a selected cell is already too narrow in the chosen axis.

| Controls | What changes on the canvas |
| --- | --- |
| Center X/Y, Width/Height | Place and size the partition's footprint without changing its integer grid dimensions or fitting it to the canvas. |
| Columns, Rows, Cut attempts, Axis policy | Set the cutting grid and attempt seeded binary splits. Longest follows grid dimensions; Random chooses cut directions independently. Attempts may fail. |
| Subdivision bias | Select among the original and up to four additional seeded partitions to favor even or contrasting leaf areas; it does not edit an individual cut ratio. |
| Leaf retention | Omit panels after partitioning, leaving the surviving panel bounds in place. |
| Fill, Outline, Nested lines, Inset, Gap, Stroke weight, palette | Paint retained leaves as fills, borders or interior outlines; inset and gap may hide small leaves. These controls do not recut the grid. |

**Subdivision bias** chooses among the original partition and up to four additional seeded partitions from the same accepted binary-cut operation. Positive favors a stronger contrast of leaf areas; negative favors more even areas. It does not change the core's individual cut ratios, and some grids or low attempt counts have no meaningful alternative to select.

**Leaf retention** makes isolated panels or gaps in a patchwork *after* cutting, without changing the partition. **Fill**, **Outline**, and **Nested lines** are separate treatments. **Inset** draws within each cell, and **Gap** adds clearance at cell boundaries. Either can erase very small leaves rather than growing or clipping them. A palette change doesn't affect cuts or retained leaves.

For a sparse accent, try Width 220, Height 140, Center X 150, Center Y 485, Columns 12, Rows 6, Attempts 22, Retention .14, Fill on, Outline off, Nested lines 0. For a wide thin patchwork, try Width 500, Height 95, Center X 320, Center Y 195, Columns 45, Rows 7, Attempts 95, Random axis, Retention .85, Fill off, Outline on, Nested lines 3. Small cells may disappear at large inset or gap.
