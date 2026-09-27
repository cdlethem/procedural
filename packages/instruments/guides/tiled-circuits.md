# Tiled circuits

This preset favors straight and turning paths of actual edge-matched connectors. It uses the same sixteen masks and `adjacencyTileCollapse2D` source as Compatible Mosaics: N = 1, E = 2, S = 4, W = 8. A tile marked `3` connects north and east; `10` connects east and west; `15` connects all four. Neighboring cells agree at every shared edge. The blank mask `0` draws no body, arm or junction.

| Control | Visible effect |
| --- | --- |
| Columns, rows | Integer grid extent, 1–32 each, limited to 400 cells. |
| Horizontal pitch (`size`), vertical pitch | Independent local canvas-unit spacing; values do not auto-fit. |
| Center X/Y, grid angle | Place and rotate the field as a local patch, possibly cropped by the canvas. |
| Boundary connectors | Open lets connector arms terminate at the outside edges; closed prohibits all outward-facing bits. |
| Blank/end/straight/turn/tee/cross weights | Relative probabilities within six categories; zero disables the category. Straights are masks 5 and 10; corners are the other degree-two masks. |
| Pinned cells | Multiline zero-based `col,row,mask`, with a decimal mask 0–15. Duplicate or invalid cells/masks, disabled categories and closed-edge violations report input errors. |
| Tile body and body size | Independent small body discs on nonblank tiles; default off, never a compulsory tile board. |
| Connectors and connector weight | Arms drawn to exactly the matching north/east/south/west edges; default on. Zero width or toggle off leaves source masks unchanged. |
| Junctions and junction size | Independent centers on nonblank tiles; zero size or toggle off omits them. |
| Seed, palette | Seed selects among source alternatives; palette changes material only. |

For **open traces**, use 12 × 9 cells, 42 × 35 pitch, open boundary, blank 2, end 4, straight 5, turn 6, tee 0, cross 0; connector marks on and body/junction marks off. For **closed loops**, use 8 × 8 cells, closed boundary, blank 2, end 0, straight 5, turn 7, tee 0, cross 0; no cell can leak a connector outward. For a **pinned junction**, use a 5 × 5 open patch with `2,2,7` to force a north/east/south tee (and leave all other cells to the solver). Some pin combinations contradict neighboring domains; remove or revise constraints rather than expecting recovery.

Core collapse enforces right-facing E = neighbor W and down-facing S = neighbor N. It propagates domains, chooses a minimum-size unresolved domain, uses category weights to pick its mask, and does **not backtrack**. Core `CONTRADICTION` is reported, not retried or rendered as partial success; equally, an over-budget collapse is an error. All numeric controls and pins are validated before allocating the tile-domain grid. The sole random input is `layer.seed >>> 0` as core `rngState`. Pin domains and enabled weights may leave no random choices, in which case seed changes do nothing. Changing pitches, position, angle, palette, stroke, body or junction styling does not change source masks or seed material.
