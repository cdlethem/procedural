# Neighborhood Growth

Connect two points when no third point is strictly closer to both, then move points along the resulting links. **Step** runs one reciprocal relaxation along the current graph, then a density-filtered candidate may join the web; the graph is requeried next tick, so relaxation and node insertion structure each other. **Growth** toggles the insertion half of each step; **Graph marks** changes point appearance; **Reset** restores the initial points; **Save** downloads the displayed canvas.

| Editable control | Effect on canvas |
|---|---|
| Seed points in `packages/javascript/examples/neighborhood-growth/sketch.js` | Set the starting arrangement and graph. |
| `INSERT` | New nodes appended per step from the fixed proposal pool; 0 keeps the 26-point web fixed (the former study). |
| `MIN_NEIGHBORS`, `MAX_NEIGHBORS` | The interval of existing points within the 70px density radius a candidate may have; 0 minimum starts growth in empty space, 1 propagates from the web only; a low maximum keeps growth sparse, a high one clusters it near the web. |
| `minLength` | Links at or below this length stop moving their endpoints. |
| `stepScale` | Change each active link's contribution to the next point positions. |
| Pinned flags | Keep selected points fixed while their neighbors may move. |
| Supplied pairs | Replace the neighborhood query with an independently chosen graph through `neighborhoodGrowth.setPairs(pairs)`. |

The pool (a 14x14 jittered grid in a fixed deterministic order), the 70px density radius, the 48-candidate judgment cap and the 96-point cap are fixed measured execution bounds of the exact O(N^3) query, not artistic choices; the interval, not the radius, chooses where growth happens. Seed points keep their dark tone while inserted nodes use the pale slot, so new material reads apart from the original web. The query, relaxation and density counting are separate operations; the supplied graph is an explicit input to the motion step.
