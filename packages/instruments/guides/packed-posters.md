# Packed Shapes: Posters starting recipe

Packed Shapes generates a seeded population of rectangles, then gives that **ordered population** to skyline packing. The Posters starting recipe begins with compact blocks; the Aspect Tiles starting recipe begins with a broader width/height range. Width/height ranges, dimension scale and turn chance determine source geometry **before** placement. No rectangle is silently resized: if it will not fit the current skyline, it remains unplaced and is not painted. A request for 60 blocks is not a guarantee of 60 marks.

| Decision | Controls | What changes |
|---|---|---|
| Population | Requested blocks, min/max width and height, dimension scale, turn chance | Seed changes actual widths/heights and which rectangles are turned by a quarter-turn before packing. Thin long strips or varied quilt pieces need different width/height ranges. |
| Placement | Packing width/height, center X/Y, gutter, group angle | The packing extent can be a small local region. Gutter reserves a gap between rectangle **cores**; group angle rigidly rotates the finished packing. |
| Material | Filled cores, outline weight, inner inset | Outline and fill are independent; zero outline with fill off is empty. An inset colors the interior only if it fits, never enlarging the footprint. Palette changes do not repack. |

Try disconnected blocks: count 10, min/max width 20/45, height 20/50, packing width/height 440/360, gutter 24, center (380, 310), no outline. For horizontal stripwork use width 95–220, height 7–18, count 22, packing extent 540×230, gutter 6 and group angle 22°. For a tight heterogeneous quilt try width 15–100, height 15–105, turn chance 0.5, count 60, gutter 2, extent 500×500. Different seeds change the rectangles as well as their placement.

The controls offer practical slider intervals. Exact entry allows 0–96 requests, source dimensions 0.1–3000, scale 0.01–20, packing width/height 1–1600 and gutter 0–1000. The 8 × count³ + count skyline work budget must stay within 8,000,000 before allocating a rectangle population. Rectangles bigger than the extent are legitimately unplaced. Outline strokes can visually narrow the specified core-to-core gutter.
