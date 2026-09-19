# Fractal Flame

A weighted set of contractive maps iterates a seeded point process, and the accumulated density is exposed with a logarithmic ramp. The maps converge to a fractal attractor — here a vertical, flame-like form — whose shape is fixed by the authored transforms. **Variation** nudges the maps into neighboring flames; **Exposure** and **Ramp** are presentation and never resimulate the point sequence. **Reset** restores the base; **Save** downloads the displayed canvas.

| Editable control | Effect on canvas |
|---|---|
| Transform matrices, powers, weights in `packages/javascript/examples/fractal-flame/sketch.js` | Define the attractor's shape. A mild-scale body map keeps the form connected; branch maps add the wisps. |
| Seeds in the sketch | The starting iterates the point process advances from. |
| `iterations` in the sketch | The point budget scattered into the density; larger budgets converge the density. |
| `Variation` button | Apply a deterministic small perturbation to each map (scale, angle, offset) for a neighboring flame. |
| `Exposure` button | Cycle the logarithmic exposure; low exposure clamps bright cores, high exposure spreads a wide gradient. |
| `Ramp` button | Invert the color ramp without changing the density. |
| Density window (`GRID`, `WORLD`) in the sketch | The accumulation resolution and world framing. |

The iteration and bilinear accumulation are one portable operation, `fractal.flame-accumulate-2d`; it returns the raw density buffer and plotted/dropped counters. Log exposure and the color ramp are presentation, done with the buffer as input so they can be edited without resimulating the point process. The accumulation renderer is reusable independently of the flame dynamics — a dense point process from another source renders through the same bilinear accumulation and exposure. For related context, see Scott Draves's *Dreams in High Fidelity* fractal flames.
