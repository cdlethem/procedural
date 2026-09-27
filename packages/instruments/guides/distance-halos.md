# Distance Halos

A small, editable group of **distinct raster sites** becomes a measured distance field through `euclideanDistanceTransform2D`. Contours trace equal measured distances from the *nearest* site, so neighboring bands meet and bend where sites compete. No invisible regular lattice supplies extra features. The footprint defines where sites can be placed, not a painted mask or frame.

| Control | What it changes |
| --- | --- |
| Site arrangement / Sites | Area, ring, line or grid placement, and the exact number of distinct occupied cells. The instrument rejects an impossible count in a tiny or off-canvas footprint instead of overlapping sites. |
| Grid resolution | Sampling detail of the binary source and of contours; measured radius and spacing are in grid cells. |
| Site disorder | Seeded displacement of source sites. Zero gives organized geometry; the seed remains relevant to an area/ring arrangement. |
| Source extent / aspect / orientation / X / Y | Size, proportions, direction and location of the *site population*, without automatically fitting it to the canvas. |
| First radius / Radius spacing / Contour count | Independently choose the first positive distance threshold, gap between thresholds, and number of contours. |
| Contour weight / Show sites / Site dot size | Stroke width independent of distance spacing; optional marks at the occupied cells. Zero weight hides contours, zero dot size hides site dots. |
| Palette | Ink for each ring and optional dots, never a source resampling decision. |

The convenient controls span roughly 35–105 cells, 1–48 sites, source extent .05–.9 canvas fractions, first radius .25–12 cells, spacing .25–16 cells and 1–12 contours. Exact entry supports 8–160 cells, 1–256 sites, extent .005–2, positive first radius and spacing up to 160, and up to 64 contours **when the joint site-selection, transform and contour-work budget permits it**. These are computational and geometric hard limits, not a recommended composition. A positive first radius avoids treating a zero-level edge as a mandatory outer rectangle.

Try **a compact interference group**: area, 9 sites, extent .32, disorder .34, first radius 1.4, spacing 3.2, five contours, weight 1.35. For **one off-center accent**, use line, 3 sites, center X .28, center Y .7, extent .14, aspect .45, orientation 35°, first radius .7, spacing 1.5, two contours, weight 2. For **open network bands**, use ring, 28 sites, extent .65, aspect 1.8, disorder .2, first radius 2, spacing 5, eight contours, weight .8. Compare seeds before changing weight: geometry should move with the seed, but weight, palette and ring spacing must not move the source.
