# Guarded bands

Variable-width tidal routes are kept in source order only when their filled ribbon shapes leave the requested clearance. Solid regions show accepted candidates; optional dashed centerlines reveal rejections.

| Control | Canvas effect |
| --- | --- |
| Wide ribbons | Expands the candidate width profile before selection. |
| Clearance | Changes the minimum filled-region separation. |
| Crossing path | Substitutes a sloped path family with different conflicts. |
| Rejected paths | Shows or hides rejected candidate centerlines without rerunning selection. |

The adapter supplies eight editable paths to `select-tapered-stroke-strips-2d` and draws its returned regions. Selection is greedy in input order, not a global packing optimum. Palette and rejected-path visibility only affect presentation.
