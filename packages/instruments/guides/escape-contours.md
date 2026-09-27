# Escape Contours

`complexEscapeDistance2D` samples the actual quadratic map $z\mapsto z^2+c$. In Mandelbrot mode the world point is $c$ and iteration starts at $z=0$; in Julia mode the world point is the initial $z$, and **Julia c real / imaginary** supply the fixed complex constant. The instrument sends the native escape-count field to `marchingSquares2D` for separate isolines. It does not fill the set, draw a frame, or treat the native nonnegative derivative distance estimate as a signed distance. Space beyond contour strokes remains transparent.

| Control | What it changes |
| --- | --- |
| Complex mapping / Julia c real / imaginary | Which mathematical plane is sampled; the Julia constant affects geometry in Julia mode only. No seed controls are needed. |
| World center X/Y, width, aspect | Independent complex-plane sampling window and zoom; width / aspect gives world height. |
| Sample resolution / escape iterations | Samples per axis and maximum quadratic-map updates per sample. Both alter the underlying escape field. |
| First contour / contour interval / contour count | Escape-count isoline thresholds $s, s+\Delta,\ldots$. The interval is independent of the iteration budget and count. |
| Contour weight / palette | Stroke width and cycling inks, without recomputing the escape field. Zero weight hides all marks. |
| Output X/Y, width, height | Local stroke placement and scale, independent of the complex-plane window. |

Resolution ranges 120–260 on the slider (48–320 exact entry), iterations 50–180 (8–450 exact entry), and contours 1–14 (1–24 exact entry). The instrument rejects `resolution² × (iterations + 2 × contour count) > 10,000,000` before allocating the field. Changing contour thresholds, count, weight, palette or output placement reuses the sampled field. Counts equal to the iteration limit mean **not escaped in the allotted budget**, not a measured interior distance or proof of set membership. A threshold above the budget simply has no segments.

Try **boundary bands**: Mandelbrot, center (-.5, 0), world width 3.1, aspect 1, resolution 210, iterations 140, first contour 4.5, interval 4, nine contours, weight 1.1. For **separated Julia lobes**: Julia $c=-.4+0.6i$, center (0, 0), width 3.2, aspect 1.3, first contour 3.5, interval 2.5, twelve contours; move output X to 390 and width to 420 without changing its complex sampling. For a **filament close-up**: Mandelbrot, center (-.7435, .1314), width .03, aspect 1.3, resolution 260, iterations 100, first contour 28.5, interval 5, nine contours, weight .7; experiment with nearby world centers rather than reseeding.
