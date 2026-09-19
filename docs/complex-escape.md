# Complex Escape

One bounded operation iterates the quadratic map `z -> z^2 + c` over a sampling window and returns a per-pixel escape count plus a derivative distance estimate. Two views share the operation: the **Mandelbrot** mapping samples the constant over the plane, and the **Julia** mapping samples the start point for a fixed constant. **Mapping** switches views; **Zoom in / Zoom out / pan** move the sampling window; **Julia constant** picks the set; **Budget** sets the escape depth. Two colorings show the two outputs: **bands** cycles the escape count across the budget so the bands accumulate at the boundary and read as the classic set, and **glow** maps the distance estimate to a warm ramp. **Reset** restores the defaults; **Save** downloads the displayed canvas.

| Editable control | Effect on canvas |
|---|---|
| `Mapping` button | Switch between the Mandelbrot view (constant sampled over the plane) and the Julia view (start point sampled for a fixed constant); the window resets to the view's default. |
| `Julia constant` button | Cycle eight authored constants, mostly lacy (boundary-dominant) sets; only changes the Julia view. |
| `Zoom in / Zoom out` and pan buttons | Move and scale the square sampling window around the current center; zooming into the boundary reveals the fractal detail. |
| `Budget` button | Cycle the escape depth (128–1024); larger budgets resolve finer boundary detail at the cost of work. |
| `Coloring` button | Switch between the escape-count bands (classic set) and the distance-estimate glow. |
| `Exposure` button | Cycle the glow's logarithmic exposure; bands ignore it. |
| Julia constants, default view windows, budgets, ramps in `packages/javascript/examples/complex-escape/sketch.js` | The authored sets, framing, work ladder and palettes. |

The iteration and the distance estimate are one portable operation, `complex.escape-distance-2d`; it returns the raw escape count and distance buffers and takes no palette. Both colorings are presentation, done with the buffers as input so they can be edited without resimulating the orbits. The operation is bounded (exact integer work, `iterations × width × height`); high-zoom precision and filtering are separate limits. For related context, see the Mandelbrot and Julia sets.
