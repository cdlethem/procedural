# Blur marks

Filter an editable **transparent** RGBA population of bars, discs, rings or tiles with independently sized horizontal and vertical kernels. The blur works on the *same* source construction as Warp marks, not a special baked stripe image. A zero-mark or zero-alpha source stays invisible; it never paints a full-frame gradient or paper.

| Controls | Canvas effect |
| --- | --- |
| Source mark, arrangement, marks | Choose bars, discs, rings or tiles in a line, grid or scattered area. Zero marks clears the layer. |
| Source seed offset, source X/Y, width/height, spacing, disorder | Position the source independently of the filter and palette. Line spacing affects line layouts; grid/area use extent. |
| Mark length/width/aspect/direction, ink alpha | Set silhouette, color coverage and real RGBA opacity before filtering. |
| Raster resolution | Square sample grid between 64 and 192 pixels; higher resolution increases work and edge detail, not canvas footprint. |
| Horizontal blur, vertical blur | Each radius generates a normalized triangular kernel of odd width `2 × radius + 1`. Zero means an identity kernel on that axis. |
| Output X/Y, width/height | Place and size the image in canvas pixels, separately from source mark placement. Zero width/height hides it. |
| Seed, palette | Seed changes the mark centers; palette changes their color without changing their centers. |

For isolated soft patches, use one or two discs, small source extent and moderate blur in both directions. For bands, use line-arranged narrow bars, adjust line spacing, then use a broad horizontal and narrow vertical kernel (or reverse them). A low ink alpha over another composited layer stays translucent; no obligatory frame or legend is added.

`separableBlur2D` normalizes each kernel and computes color with premultiplied alpha, returning straight RGBA. Both passes **clamp to source edge pixels**. On a transparent source with at least each kernel's radius of clear gutter before the raster edges, total alpha mass is preserved up to 8-bit rounding; a painted edge instead replicates its edge samples, so the raster boundary is not a lossless infinite transparent plane. Alpha softens and expands into nearby zero pixels; zero-alpha pixels have zero RGB and cannot introduce a colored halo. A coupled resolution × kernel work budget rejects excessive combinations instead of silently narrowing kernels.
