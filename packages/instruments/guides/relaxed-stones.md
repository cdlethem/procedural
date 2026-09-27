# Relaxed stones

Build a small cluster of inset polygonal stones, an open cellular web or the gradual tracks of relaxing sites.

The shared **Cell Fields** instrument moves sites toward the centroids of their Voronoi polygons with `lloydRelaxation2D`, retaining each pass, then computes final polygons with `voronoiCells2D`. Stones are inset polygons, not a packing or non-overlap guarantee. The rectangular domain is local to this layer: no canvas-wide frame or automatic fit. **Cell mosaic**, **Cell echoes**, **Relaxed stones**, and **Centroid trails** expose the same controls; only their starting recipes differ.

| Control | Canvas effect |
|---|---|
| Sites / Initial arrangement | Count (1–96) and area, ring, grid or clustered starting positions inside the domain. |
| Site spread / Disorder | Footprint as a fraction of domain (0.05–1); seeded site jitter 0–1. At zero disorder, geometry ignores seed. |
| Relaxation passes / Relaxation strength | 0–12 synchronous passes; strength 0–1 moves each site partway toward the centroid at every pass. Zero passes retains initial sites. |
| Domain center X / Y | Center in canvas units, including off-canvas positions. |
| Domain width / height / rotation | Rectangular local Voronoi bounds (positive sizes in canvas units), rotated for drawing after relaxation. Tiny patches remain tiny; no auto-fit. |
| Cell inset (units) | Pull each polygon vertex toward its final site by this many canvas units, at most to the site itself. This is not a proportional scale or constant-distance edge offset. |
| Cell fill / Cell outline | Independent fill opacity (0–255) and outer outline width (0–50); either zero disables just that material. |
| Facets / Facet opacity | Toggle translucent triangular accents and set opacity independently of cell fill. |
| Nested echoes / Echo stroke / Alternating echoes | Optional concentric polygon outlines, width and per-echo versus per-site palette colors. Echoes 0–16. |
| Trail weight | Independent trajectory stroke width (0–50), one segment per retained pass. |
| Initial sites / Final site dots / Final dot size | Initial dot diameter, independent final dot toggle and diameter (0–60 each). |

Colors, placement, rotation, inset and material edits reuse geometry/history. The joint work preflight limits site/pass/echo combinations to 3,000,000 conservative units including final cells; high site counts require fewer passes.

**Contrasted recipes.** For a cell-only mosaic, use 18 grid sites, 2 passes, strength 0.55, cell inset 8, fill 210, outline 0, facets off, echoes 0, and dots/trails off. For partially relaxed specks, use 9 ring sites, 1 pass, strength 0.2, a 95 × 75 domain centered at (535, 180), cell inset 1, fill 0, outline 1.5 and final dots enabled at size 4. For trails alone, turn fill/outline/facets/echoes off, set trail weight 1.5 with 5 passes, and enable small initial/final dots.
