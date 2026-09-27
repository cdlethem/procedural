# Compatible mosaics

A sparse, edge-matched mosaic made by `adjacencyTileCollapse2D`. Each tile is exactly a four-bit connector mask: north = 1, east = 2, south = 4, west = 8. For example `5` joins north to south, `10` joins east to west, and `0` is blank. Adjacent cells match the two facing bits; no opaque tile image or fixed board is required. This preset favors blank space, ends and corners. The circuit preset uses the **same instrument** with more through paths.

| Control | Visible effect |
| --- | --- |
| Columns, rows | Local grid size, 1–32 each with at most 400 cells total; no hidden fitting. |
| Horizontal pitch (`size`), vertical pitch | Independent spacing of tile centers, in canvas pixels. |
| Center X/Y, grid angle | Move or rotate the local field, including partly outside the canvas. |
| Boundary connectors | **Open** permits outward-facing perimeter ends; **closed** restricts perimeter domains to masks with no outward-facing bits. |
| Blank/end/straight/turn/tee/cross weights | Nonnegative relative selection weights. Zero *removes* all masks in that category from every domain. Straight means `5` or `10`, while the other degree-two masks are turns. |
| Pinned cells | Optional separate `col,row,mask` lines; zero-based coordinates and decimal mask 0–15. Invalid lines, duplicates, out-of-range pins, disabled masks, and pins pointing out of a closed perimeter are errors. |
| Tile body, body size | Optional small marks only on nonblank cells; never a solid board. |
| Connectors, connector weight | Actual arms meeting at matched cell edges; weight zero removes the connector ink without changing the solved masks. |
| Junctions, junction size | Independently ink nonblank cell centers; zero size omits this material. |
| Palette | Recolors only ink; no effect on masks. |
| Seed | Selects among remaining alternatives during collapse; no effect when propagation/pins leave one mask per cell. |

Try **island scatter**: 9 × 7, pitch 48 × 48, blank 12, end 5, straight 0, turn 2, tee 0, cross 0; body on, connectors off, junctions on. Try **bounded paths**: 10 × 8, boundary closed, blank 3, end 0, straight 4, turn 6, tee 0, cross 0; pins such as `3,0,2` are invalid at the top only when their north bit is present; `3,0,4` points into the field. Try **one shaped mark**: 1 × 1, boundary open, pins `0,0,5`, body off and connectors on. Closed boundaries forbid that single-cell mask.

The solver uses minimum-domain choice and weighted picks, not backtracking or weighted entropy. A `CONTRADICTION` from the core is shown as an error, even if another seed could have succeeded: no partial board, silent fallback or automatic retry. Seed material is exactly the 32-bit unsigned `layer.seed` passed as `rngState`; compatibility, domains, weight categories and pins are structural. Placement, palette, and body/connector/junction ink never enter the seed or the solver. Increasing a category weight changes probabilities but never changes compatibility.
