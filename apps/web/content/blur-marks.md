# Blur marks

Soften a generated stripe image into broad bands or translucent ink ribbons. Studio blurs the source raster horizontally and, unless **Horizontal only** is selected, vertically as well. Cut clear gutters into the source with **Source coverage** and the blur will soften their alpha edges instead of filling them with paper color.

| Control | Canvas effect |
| --- | --- |
| Radius | Widens the triangular blur kernel and spreads color and alpha farther from each source stripe. |
| Stripe | Changes the generated source band width before filtering. |
| Source coverage | Sets the filled fraction of each three-stripe source group. One keeps the original continuous opaque field; zero clears the layer; intermediate values leave softened transparent gutters. |
| Horizontal only | Filters across rows without vertical spread. Turn it off to soften in both directions. |
| Seed | Changes the local variation of the source stripes. |
| Palette | Recolors the stripes while preserving the mask geometry. |

The source mask is made before `separableBlur2D`, whose color filtering accounts for alpha so transparent gutters do not contaminate their neighbors. The fully covered setting keeps the original opaque output. Edit the generated raster in `apps/web/lib/adapters/effects.ts` to blur another image. The Studio document supplies the background; a lower layer shows through the gutters even when this layer is fully opaque.
