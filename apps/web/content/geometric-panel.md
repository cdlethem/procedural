# Shape matrix

Arrange wedges, crossed bars, discs and open arcs on an editable grid. Mix their relative frequencies, leave space between marks or overlap them, and use row and column shifts to make staggered rhythms. The study paints a transparent layer that can be combined with other Studio layers.

Choose the row and column counts first, then set a weight for each shape. A weight of zero removes that shape; higher weights make it appear more often among the occupied cells. At least one shape needs a positive weight. The matrix has a combined limit of 2,048 cells so large grids remain bounded during editing.

| Control | Canvas effect |
| --- | --- |
| Rows and columns | Set vertical and horizontal repetition independently, including a single row or column. |
| Wedges, bars, discs, arcs | Set each shape family’s relative frequency; zero excludes it. |
| Density | Sets the percentage of grid cells with marks; increasing it retains earlier selections. |
| Mark scale | Sizes the primitives relative to a cell. Zero hides marks, while large values can overlap. |
| Horizontal and vertical offset | Translate the whole arrangement independently, including intentional cropping. |
| Alternate row shift | Moves every second row horizontally by a fraction or multiple of cell spacing. |
| Alternate column shift | Moves every second column vertically by a fraction or multiple of cell spacing. |
| Angle | Rotates every shape in its own cell. |
| Angle step | Adds rotation along the row-major grid order. |
| Guides | Shows the underlying grid and placement frame. |
| Palette | Recolors marks without changing positions or shape selection. |

The anchors come from the package’s regular grid operation. Shape assignment and mark drawing remain local p5 choices, making the same grid useful for other visual treatments.
