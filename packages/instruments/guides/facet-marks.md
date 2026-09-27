# Facet marks

**Center X/Y**, **Source width/height**, **Source sides** and **Source angle** create a triangular or convex polygonal site domain, not a fixed canvas-sized triangle. **Source groups** and **Group spread** create independently sampled local groups around the center; at one group the source sits exactly at the center. **Sites per group** feed the accepted Delaunay triangulator. **Sites distribution** can use uniform area or a seeded cluster, with **Cluster extent** determining how tightly sampled points pull toward its local center. **Site jitter** mixes sampled points with an ordered interior spiral; full jitter uses uniform/cluster positions.

| Controls | What changes on the canvas |
| --- | --- |
| Center X/Y, Source width/height, Source sides, Source angle | Set each local polygon where input sites can fall; the polygon is not an automatically drawn border. |
| Source groups, Group spread | Form separately sampled local constellations and move their centers apart. |
| Sites per group, Sites distribution, Cluster extent, Site jitter, seed | Change the actual input sites and therefore the Delaunay triangles; cluster extent matters for clustered sites, while jitter mixes ordered and sampled sites. |
| Facet fraction | Independently select which computed triangles to draw, without rebuilding the mesh. |
| Material, Grain density, Wire weight, Opacity, palette | Choose filled faces, wire edges or per-face sampled grain and change their appearance without relocating the input sites. The grain budget depends on selected triangle areas. |

**Facet fraction** independently selects triangles of the real Delaunay mesh. **Material** switches between fill, wire, and per-facet grain; **Grain density**, **Wire weight**, and **Opacity** only change appearance. No source border, frame, or filled hull is forced. A local shape and fractional selection can be a useful fragment rather than a complete tiling. The 25,000-point grain cap counts only selected triangle areas before sampling; zero selection is valid at every allowed density. Triangulation work is independently bounded.

For isolated mesh fragments, try Width 120, Height 145, Sides 3, Center X 195, Center Y 420, Groups 2, Group spread 220, Sites 20, Facet fraction .4, Material wire. For a small grain wedge, try Width 180, Height 180, Sides 3, Groups 1, Sites 45, Cluster distribution, Cluster extent .5, Facet fraction .65, Material grain, Grain density .025. A triangular mesh ends at the sampled sites rather than automatically reaching the source polygon's outline; close to the boundary may remain blank.
