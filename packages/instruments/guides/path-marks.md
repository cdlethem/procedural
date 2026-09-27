# Draw marks on field-driven paths

These trajectories follow the existing seeded gradient-path operation. Paths sets the number of starts; Source width, Source height, center and Start direction shape their origin distribution. Grid uses editable rows and columns; Area scatters starts across an ellipse and Ring scatters them near its edge. Start changes and Field scale, Field bias or Field response rebuild the actual trajectories. Steps and Step distance determine how far each one can travel. A path can leave the canvas; the renderer does not fit it back inside.

| Controls | What changes on the canvas |
| --- | --- |
| Paths, Start arrangement, Grid columns/rows | Choose how many starts are placed and whether they form a grid, fill an elliptical area or gather near its ring. Grid cells must cover all requested starts. |
| Source X/Y, Source width/height, Start direction | Move, resize or rotate the start distribution; this is not a clipping boundary for the paths. |
| Field scale, Field bias, Field response, Steps, Step distance | Bend and extend the computed trajectories. These change the movement, not merely the marks drawn on it. |
| Trace, Mark spacing | Show the traveled segments, or place separate marks by distance traveled along each path. |
| Mark disorder, Cross drift, Gap cycle, Omitted marks | Shift or omit marks along/across the retained trajectories without rerouting them. Omitted marks must be fewer than a nonzero gap cycle. |
| Mark, Mark length, Weight, palette | Choose line, bar or dot treatment and its size, thickness and color without changing the paths. |

## Separate movement from marks

Trace draws connected movement segments. Switch it off to place perpendicular Line, Bar or Dot marks at **arc-length** stations. Mark spacing is measured in traveled canvas units, not in integration steps. Mark disorder slides each mark along its retained trajectory and Cross drift offsets it across the trajectory; neither changes the trajectory itself. Mark length and Weight set the painted material, while Gap cycle and Omitted marks define recurring holes. Zero weight removes all painted marks. A palette edit changes color without moving the paths.

## Try distinct constructions

- Local fragment: Paths 5, Area, source width 70 and height 45, center (160, 520), Steps 180, Step distance .5, Trace off, spacing 9, Dot.
- A few noisy runs: Paths 4, Ring, source width 150 and height 90, Steps 700, Field scale .012, Field response 18, Trace on, gap cycle 7 and omitted marks 2.
- Dense accumulation: Paths 36, Grid 9 × 4, source width 470 and height 260, Steps 850, Mark spacing 3, Bar, Mark disorder .5.

The field bends paths; this is not a hand-drawn/folded path editor (Stitched Contours supplies that different construction). A grid with more requested paths than cells is rejected rather than quietly recycling starts. Very short/zero travel yields few or no marks.
