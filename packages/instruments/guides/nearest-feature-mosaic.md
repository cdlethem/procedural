# Nearest Feature Mosaic

The **same editable binary feature-site source** used by Distance Halos divides a sample grid by true nearest-site ownership. `euclideanDistanceTransform2D` returns both the nearest occupied raster index and measured distance. The display chooses colored ownership cells, edges only between different supported owners, or both; there is no automatic full-page color panel.

| Control | What it changes |
| --- | --- |
| Site arrangement / Sites | Area, ring, line or grid organization, with an exact number of distinct occupied raster cells. Impossible counts in a footprint are reported, not silently merged. |
| Grid resolution | Sample-cell and boundary detail. |
| Site disorder | Seeded variation of site positions; fill, boundary and dot edits do not reroll sites. |
| Source extent / aspect / orientation / X / Y | The local population's spread, proportions, angle and center. These place sites without painting a frame. |
| Region display | **Regions** shows fills, **boundaries** leaves interiors transparent, **both** overlays ownership edges. |
| Cell coverage | Fraction of each supported cell filled; zero hides fills, while boundaries may remain. |
| Site support | Maximum real distance from the nearest site, in grid cells. Small values yield separated colored fragments; large values can connect into a broad mosaic. Zero supports only site cells. |
| Boundary width | Stroke between neighboring supported cells with *different owners*. Zero hides those edges. |
| Show sites / Site size | Mark actual occupied cells; zero site size hides dots. |
| Palette | Colors the assigned owners and optional marks, not the source distribution. |

Practical sliders span 35–105 cells, 1–48 sites, extent .05–.9, coverage 0–1 and support 0–100 cells. Exact-entry limits are 8–160 cells, 1–256 distinct sites, extent .005–2 and support 0–226 cells; a joint grid × site-selection budget may restrict expensive combinations. These limits ensure bounded computation rather than impose a minimum filled area.

Try **floating fragments**: area, 7 sites, extent .27, center X .29, center Y .6, support 2.5, coverage .65, regions, with dots on. For **connected cells**, ring, 24 sites, extent .65, aspect 1.4, disorder .25, support 35, coverage .95, both, boundary width 1.5. For **transparent seams** above another layer, line, 12 sites, extent .7, orientation 35°, support 11, boundaries, site dots off. Increase support to connect previously separated ownership patches; lower it to reveal more of the other layer. Change the seed to rearrange sites, then change coverage and palette without changing that geometry.
