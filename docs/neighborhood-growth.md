# Neighborhood Growth

Connect two points when no third point is strictly closer to both, then move points along the resulting links. **Step** runs an exact relative-neighborhood query and one reciprocal relaxation. **Graph marks** changes point appearance; **Reset** restores the initial points; **Save** downloads the displayed canvas.

| Editable control | Effect on canvas |
|---|---|
| Seed points in `packages/javascript/examples/neighborhood-growth/sketch.js` | Set the starting arrangement and graph. |
| `minLength` | Links at or below this length stop moving their endpoints. |
| `stepScale` | Change each active link's contribution to the next point positions. |
| Pinned flags | Keep selected points fixed while their neighbors may move. |
| Supplied pairs | Replace the neighborhood query with an independently chosen graph through `neighborhoodGrowth.setPairs(pairs)`. |

The query and relaxation are separate operations; the supplied graph is an explicit input to the motion step.
