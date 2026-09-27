# Terraced islands

Every island starts with its own seeded sites and a real convex hull. Each inner contour is a scaled copy of that **same** island's hull around its own center, so terrace levels are nested instead of independently jittering through each other. No fixed 18-pixel shrink or page-fitting layout is involved.

| Control | Visible effect |
| --- | --- |
| Sites per island, Point disorder | Polygon density and seeded radial variation of each island's initial sites. |
| Islands, Island spread | Independently seeded hull count and maximum local center displacement; a single island stays exactly centered. |
| Outer radius, Crosswise aspect | Initial longitudinal reach and height-to-width shape ratio. |
| Center X/Y, Direction | Placement and rigid orientation of the complete island group. |
| Terrace levels, Terrace scale, Terrace inset | Number of nested copies, multiplicative scale per step and additional linear reduction of radius per step. An inset too large for the outer radius is rejected. |
| Fill terraces, Outline terraces, Outline weight | Optional translucent fills and independent perimeter strokes; outlines only by default. |
| Source dots, Source dot size | Optionally reveal the original sites beneath the contours. |

**Single stepped island:** Islands 1, Sites per island 38, Outer radius 230, Crosswise aspect .85, Point disorder .55, Terrace levels 6, Terrace scale .91, Terrace inset 4, Outline terraces on, Fill terraces off.

**Archipelago:** Islands 5, Island spread 185, Outer radius 78, Sites per island 11, Point disorder .8, Terrace levels 4, Terrace scale .78, Terrace inset 2, Source dots on, Source dot size 3. Contrast with one large, near-smooth contour: Islands 1, Sites per island 70, Point disorder .05, Terrace levels 10, Terrace scale .96, Terrace inset 2.

`geometry.convex-hull-2d` computes one hull per island. Source sites and their convex hull are independent of fill, weight, dots and terrace treatment. Combined sites × islands × terraces and hull work are checked before allocation.
