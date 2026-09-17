# Organic cells

Grow rounded colonies from a starting grid you can replace. Each colored disc
is a live cell after a selected Life-like rule has advanced the same binary
field. Speckle gives the default loose clusters; repeated discs, diagonal
bands, and checker regions start with different arrangements. The same cell
state can be drawn as squares in Geometric generations.

| Control | Canvas effect |
| --- | --- |
| Initial field | Selects repeated discs, bands, checker regions, or seeded speckle as the first live cells. |
| Source X / Source Y | Moves the starting pattern across the grid; reseeding changes its phase and the speckle pattern. |
| Source frequency | Changes the number and size of repeated starting features. |
| Initial fill | Raises or lowers the starting live-cell count. Zero begins empty; one fills the grid. |
| Rule | Changes the birth and survival counts for every generation: Life, HighLife, Seeds, or Day & Night. The same starting cells can grow into different structures. |
| Boundary | WRAP joins opposite grid edges as neighbors; DEAD treats positions beyond an edge as empty. |
| Passes | Advances whole generations. Zero displays the initial cells; later generations may grow, settle, or die out under the chosen rule. |
| Cell size | Changes the diameter and spacing of painted circles, not the 20 × 20 simulation grid. |
| Stroke weight | Changes circle outlines; zero removes them. |
| Palette | Recolors the resulting live cells without changing the rule or source. |

The initial field and rule are separate choices: changing the rule does not
reseed the starting cells. The layer draws only live cells, leaving other areas
transparent for Studio composition. Exact entry can reach valid values beyond
the slider interval; a combined cell-update budget limits long replays. Some
rule, fill, and pass combinations intentionally produce no live cells.
