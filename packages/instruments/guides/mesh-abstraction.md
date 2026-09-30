# Mesh Abstraction

A detailed surface that turns into coarse flat facets, with one chosen part left exactly as
detailed as it was. The starting picture is a terrain of a few dozen large triangles around a
patch where every original vertex is still there: fine ruled edges inside the patch, wide
shaded facets outside it, and a soft transition between them. The facets are painted far to
near and the edges are hidden-line solved, so it reads as a real solid seen from a camera, not
a 2D overlay. Turn the camera, and the same abstraction is seen from a new side.

The abstraction is edge collapse. Every edge has a price (how far its two ends would move the
surface if they merged); the cheapest edge goes first, its ends become one vertex, and the
next price is recomputed around it. Nothing tears and no facet ever turns inside out: a
collapse that would pinch the surface, fuse a boundary or fold a neighbouring facet is refused.
Vertices inside the preserved region are never collapsed or moved. The list of collapses does
not depend on how many you ask for, so **Facets kept** is a scrub: fewer facets just continue
the same sequence, more rewind it.

## Choose and abstract the source

| Controls | What changes on the canvas |
|---|---|
| **Source**, **Source detail** | The detailed surface: an icosphere, a seeded terrain (kind: hills, ridges, crater, dunes), a revolved vase (amphora, goblet, bottle, urn), a faceted figure whose head is a fine sphere on a blocky body, or a torus. Detail raises the triangle count (icosphere level 5 is 20,480 triangles). Terrain heights follow the seed. |
| **Facets kept** | Share of the triangles outside the preserved region that survive. The region's own triangles always stay. Low values are a few large facets; 1 is the source untouched. |
| **Collapse rule** | **Error-driven** merges where the surface is flat and keeps facets where it curves, so facet size follows the form. **Shortest edge** merges the shortest edges first and gives every facet nearly the same size whatever the form. |
| **Error limit** | Refuses a merge that would move the surface by more than this root-mean-square distance (a fraction of the source's diagonal, tightening to zero toward the preserved region). 0 means no limit. Set it and the abstraction may stop before it reaches the facet count. |
| **Boundary** | For a terrain or vase: **hold** keeps the open edge in place under a strong penalty, **free** lets it erode, **frozen** keeps every rim vertex exactly. |
| **Keep creases**, **Crease angle** | Sharp folds (at least this many degrees between facets) get a strong penalty against moving, so a block's corners survive. The same angle picks the crease lines of *Outline* edges. |

## Preserve a region

| Controls | What changes on the canvas |
|---|---|
| **Region** | **Sphere**, **box**, **band** across an axis, **seeded spheres** on random surface points, or **none**. Everything is a fraction of the source's own size, so a setting fits any source. |
| **Region X/Y/Z**, **Region size** | Where a sphere or box sits and how big it is (radius as a share of the diagonal, or half the extent of a box). |
| **Band axis**, **Band from/to** | The slab kept between two fractions of the axis. |
| **Region count** | Seeded spheres; raising it only adds spheres. |
| **Falloff** | Distance over which importance fades from 1 to 0 outside the region. Importance-1 vertices are frozen; the fade makes facets grow gradually away from the region. 0 is a hard edge. |
| **Invert region** | Abstract inside the region and keep everything else. |

## Look at it

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Size** | Where the source sits and how large its bounding diagonal is on the canvas. |
| **Projection**, **Yaw**, **Pitch**, **Roll**, **Eye distance** | The camera. Orthographic keeps parallels; perspective foreshortens (eye distance in diagonals). Moving it never rebuilds the abstraction. |
| **Facets**, **Facet opacity**, **Light direction**, **Contrast** | Shaded (a light fixed in the world, so shading slides across the form as you orbit), flat color, or none. Below full opacity, farther facets show through in correct depth order. |
| **Edges**, **Line material**, **Hidden lines**, **Line weights** | No edges, the outline (silhouette, boundary, creases) or every edge. What a nearer facet covers is solved exactly; hidden edges can be dropped, faint or dashed. Lines can be ink, stitches or beads. |
| **Highlight**, **Tint amount** | Tint the facets that touch the region and/or rule its edges in the accent color. |
| **Compare**, **Ghost edges**, **Ghost opacity** | Ghost: the source's own visible edges faintly over the abstraction. Side by side: the source left, the abstraction right, same camera. |

Palette entry 0 is the facet color, 1 the lines, 2 the preserved region.

Turning **Facets** to *none* and **Edges** to *Every edge* leaves a hidden-line drawing of the
abstracted mesh; it stands on its own, or over a fill from another layer.
