# Centroid trails

Draw short site-motion trails, then optionally expose their surrounding cell outlines.

Each original site leaves one segment per synchronous `lloydRelaxation2D` pass toward the centroid of its current Voronoi polygon. History preserves site identity: a line connects the same site across neighboring passes, not unrelated points. This trail-first preset shares **Cell Fields** controls with **Cell mosaic**, **Cell echoes**, and **Relaxed stones**. No frame or guide is drawn.

| Control | Canvas effect |
|---|---|
| Sites / Initial arrangement | Choose 1–96 sites distributed in an area, ring, grid or three clusters, entirely within the domain. |
| Site spread / Disorder | Footprint fraction 0.05–1 and seeded position variation 0–1; at zero disorder, the starting sites and paths ignore seed. |
| Relaxation passes / Relaxation strength | 0–12 recorded updates, each moved by a fraction 0–1 of its centroid displacement. Zero passes yields no trail segments. |
| Domain center X / Y | Position the local source in canvas units, even beyond the canvas. |
| Domain width / height / rotation | Set real rectangular Voronoi dimensions and rotate the finished result; small domains are not expanded. |
| Cell inset (units) | Pull polygon corners toward final sites by a physical distance, not a proportional scale; applies to optional echoes and facets too. |
| Cell fill / Cell outline | Independent polygon fill opacity and outer outline width; zero disables either. |
| Facets / Facet opacity | Optional triangular accents and their independent opacity. |
| Nested echoes / Echo stroke / Alternating echoes | 0–16 concentric polygons per cell with their own weight and optional per-echo palette cycling. |
| Trail weight | Independent trajectory width; zero removes trajectories but not cells or dots. |
| Initial sites / Final site dots / Final dot size | Independent initial diameter, final visibility toggle and final diameter; zero diameters hide marks. |

A bounded structural cache reuses site history and final cells across palette, dot, stroke, placement, rotation and inset edits. Site/pass/echo work shares a conservative 3,000,000-unit limit; high site counts require fewer passes.

**Contrasted recipes.** The default clustered layout uses 18 sites and 6 passes with cell material off, trails at 1.2 and initial/final dots at 7/4. For sparse, partially relaxed trajectories choose 7 ring sites, 3 passes, strength 0.3, disorder 0 and a 140 × 100 domain near (465, 195), with initial dots 0 and final dots enabled at size 3. To reveal the partition instead, switch to a 4 × 4 grid of 16 sites, 3 passes and strength 1, set trail weight 0, fill 0, outline 1.5, and optionally enable final site dots.
