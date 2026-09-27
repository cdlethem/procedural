# Arrival Contours

Trace cost rings that bend around expensive cells and stop at obstacles or unreachable regions. `costGridPaths2D` computes four-neighbor arrival costs from one exact start, and `marchingSquares2D` traces levels only in quads whose four corners have finite reachable distances. Obstacles and disconnected regions terminate isolines rather than becoming zero-valued bridges. This is accumulated destination-cell cost along shortest paths, not steering or an obstacle-distance transform. Isolines are separate strokes, not joined or filled polygons.

For a smaller grid, first put the start cell inside the new dimensions. Prepare dimensions and text with Noise or Stripes selected, then choose Numeric grid last. The interface keeps the last valid recipe rather than committing a partly resized grid.

| Control | What it changes |
| --- | --- |
| Columns / Rows | Grid sample density. Exact values 2–50 per axis with at most 2,500 cells; contour quads are formed between neighboring cell centers. |
| Origin X / Y; Grid width / height | Left/top grid edge and extent in canvas units. Resizing or repositioning the drawing does not resample the numeric costs. |
| Start column / row | Exact zero-based source cell; a blocked start errors before the native path operation. No start relocation or retries. |
| Cost source / Numeric grid | Noise generates seeded cost and obstacle fields; Stripes is deterministic; Grid overrides both with precisely Rows lines of Columns comma- or space-separated costs or `x` obstacles. Nonnegative finite entries <=1,000,000 only; `0` is a genuine zero-cost cell, **not** an obstacle marker. |
| Obstacle density / Source frequency / Cost contrast | For Noise, seeded coherent obstacle and cost signals; for Stripes, repeated barrier bands and horizontal cost waves. Density 0–.95, frequency .05–40, contrast 0–100. These controls are inactive for explicit Grid. |
| First arrival / Arrival spacing / Contour count | Ascending isolines at `base + k * spacing` for `k=0..count-1`, measured in actual accumulated cost. Count 1–32, spacing positive >=0.000001; first level >=0 and last <=100,000,000. A level outside the reachable range has no line. |
| Stroke weight | Zero suppresses contour strokes. It never changes costs or reachable territory. |
| Obstacle ink | Paint only actually blocked cells as translucent colored rectangles; zero leaves no panel or grid background. |
| Palette / Seed | Palette changes isoline colors, not arrival. Seed affects Noise only while density or contrast is nonzero; both zero makes an unblocked uniform-cost grid. Explicit Grid and Stripes are deterministic regardless of seed. |

**Compact arrival rings:** Noise, 28×28, start 5,14, density .08, contrast 2.3, first arrival 7, spacing 6, 12 levels, stroke 1.4, obstacle ink 0. Reduce grid width/height to 220 each and move its origin to 190,180 to make an isolated local patch; levels are still cost units, not pixels.

**Disconnected island:** Grid mode, 5×5, start 0,2. Put `1 1 x 9 9` on each of five lines. The two left columns remain reachable and the two right columns are unreachable; no contour crosses the `x` column. Set first arrival 1, spacing 1, count 8 to study the left region. The right-hand cost 9 does not create a contour because no path arrives there. Switch the center row to `1 1 1 9 9` to reopen a channel: reachable quads and contours now follow the actual corridor, with no invented zero-cost bridge.

**High-cost vs blocked cells:** In a small grid of all `1`, replace one traversable cell by `12` to create a local high-cost arrival seam; compare the result with a blocked `x`. Those choices are different: one is expensive but passable, the other removes the cell. If the start is covered, explicitly choose another valid start or edit the grid. No hidden fallback changes the source.
