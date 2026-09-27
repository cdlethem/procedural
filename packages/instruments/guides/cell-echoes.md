# Cell echoes

Build nested polygonal rings inside a local cell field, from a few separated cells to dense contour textures.

This **Cell Fields** preset repeats each actual `voronoiCells2D` polygon at smaller scales around its site. The rings are copies, not constant-width offsets, and no canvas-wide frame is required. The same controls work in **Cell mosaic**, **Relaxed stones**, and **Centroid trails**; this preset begins with 0 Lloyd passes but can retain site paths when relaxation is enabled.

| Control | Canvas effect |
|---|---|
| Sites / Initial arrangement | 1–96 starting sites in an area, ring, grid or clusters. |
| Site spread / Disorder | Source footprint 0.05–1 within the local domain and seeded jitter 0–1; zero jitter ignores seed. |
| Relaxation passes / Relaxation strength | 0–12 retained `lloydRelaxation2D` steps at 0–1 centroid strength; default zero passes. |
| Domain center X / Y | Local-domain placement in canvas units; off-canvas domains are allowed. |
| Domain width / height / rotation | Physical rectangular Voronoi bounds, then visible drawing rotation. |
| Cell inset (units) | Pull outer polygons inward toward their sites by a physical distance before drawing nested copies. The original mosaic proportional inset is not this control. |
| Cell fill / Cell outline | Independent fill opacity and outer border width; both off by default. |
| Facets / Facet opacity | Optional independent triangles between final sites and alternating cell edges. |
| Nested echoes / Echo stroke / Alternating echoes | 0–16 nested polygons per site, with independent line width and either per-echo or per-site palette colors. |
| Trail weight | Independent per-pass line material, useful when enabling relaxation. |
| Initial sites / Final site dots / Final dot size | Separate start diameter, final-site visibility and final diameter. |

Edits to color, echo count, width, dot size, inset and rotation reuse the same bounded site history and final polygons. The joint conservative site/pass/echo budget is 3,000,000 units.

**Contrasted recipes.** Default: 35 area sites, 0 passes, 7 alternating echoes at stroke 1.1 and no cell fill. For a sparse nested fragment choose 6 ring sites, spread 0.6, disorder 0, 4 echoes with width 2, a 150 × 120 domain near (475, 170), fill 0, facets off. For a partly relaxed colored partition choose 15 clustered sites, 2 passes at strength 0.4, 2 echoes at width 0.6, fill 120 and final dots at size 3; either material can be disabled without moving the sites.
