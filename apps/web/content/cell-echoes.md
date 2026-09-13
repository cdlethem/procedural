# Cell echoes

Fill irregular cells with nested polygon outlines. Each echo repeats the cell's shape at a smaller scale, creating a woven field of angular rings with transparent space between the lines.

Try fewer **Cells** and more **Echoes** for broad nested forms. Reduce **Site spread** to crowd the controlling points toward the center and stretch outer regions toward the frame.

| Control | Canvas effect |
|---|---|
| Cells | Changes the number of independently nested regions. |
| Echoes | Adds or removes outlines inside every cell. |
| Site spread | Expands or contracts the arrangement of controlling points. |
| Line weight | Thickens the polygon outlines. |
| Alternating colors | Cycles the palette through echoes within each cell. |
| Seed | Repositions the supplied sites repeatably. |
| Palette | Changes outline colors while retaining their geometry. |

The same [Voronoi polygons](../catalog/operations/voronoi-cells-2d.json) can support filled tiles, line work or other marks. Echoes are simple scaled copies around each site, so their gaps are not uniform polygon offsets.
