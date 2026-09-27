# Cell mosaic

Make a colored mosaic confined to an editable local patch, or strip it back to cell outlines, facets and site marks.

This **Cell Fields** preset starts with a jittered grid and no relaxation: each initial site owns its actual nearest region returned by `voronoiCells2D`. Edit a local rectangle rather than filling the page. Turning on `lloydRelaxation2D` passes retains the entire site history for optional trajectories. This shares controls with **Cell echoes**, **Relaxed stones**, and **Centroid trails**.

| Control | Canvas effect |
|---|---|
| Sites / Initial arrangement | Choose 1–96 sites in a grid, area, ring or clusters. |
| Site spread / Disorder | Spread 0.05–1 controls footprint within the domain; disorder 0–1 adds seeded jitter (zero ignores seed). |
| Relaxation passes / Relaxation strength | 0–12 synchronous centroid moves, each at strength 0–1. Default passes 0 leaves the grid unsmoothed. |
| Domain center X / Y | Move the rectangular source in canvas units, including off-canvas. |
| Domain width / height / rotation | Set real local Voronoi dimensions and rotate the completed material, without clipping to the page or auto-fit. |
| Cell inset (units) | Pull polygon vertices a fixed physical distance toward their sites, stopping at the sites. This is **not** a proportional scale or constant-distance edge offset. |
| Cell fill / Cell outline | Independently enable polygons with opacity (0–255) and outer stroke width (0–50). |
| Facets / Facet opacity | Overlay site-to-edge translucent triangles with independent opacity; facets can remain when base fills are off. |
| Nested echoes / Echo stroke / Alternating echoes | Optionally add 0–16 scaled-cell loops, set their independent width and palette cycling. |
| Trail weight | Per-site movement line width, 0–50; zero suppresses paths. |
| Initial sites / Final site dots / Final dot size | Independent start dot diameter, final dot toggle and final dot diameter. |

Site history and final cells are reused when color and drawing settings change. A conservative joint 3,000,000-unit site/pass/echo budget may require fewer passes for dense fields.

**Contrasted recipes.** Default: 48 grid sites, disorder 0.9, 0 passes, fill 225 and facets 80 in a 400 × 330 local region. For a small quiet patch, use 8 ring sites, a 90 × 75 domain at (130, 490), disorder 0, strength 0.4 for one pass, fill 130, facets off, final site dots enabled at size 3. For empty tiles with trajectory scribbles, set fill, outline, facets, echoes and dots off and give trail weight 1.4 with five passes.
