# Aspect Tiles: Packed Shapes starting recipe

The Aspect Tiles starting recipe opens Packed Shapes with a broader initial width/height distribution than Posters; both use the same skyline packing instrument. Each seed draws an ordered population of real rectangles before packing. The skyline places whichever complete padded footprints fit; it reports the rest as unplaced. It does not randomly position tiles, resize them to fit, or paint a background/container.

| Configuration | Settings | Result |
|---|---|---|
| Small quilt fragment | Count 18, width 18–75, height 15–60, pack extent 280×220, center (175, 470), gutter 3, turn chance 0.5 | An off-center patch of varied blocks with negative space beyond it. |
| Parallel strips | Count 26, width 100–210, height 8–20, pack extent 560×240, center (360, 360), gutter 7, turn chance 0 | Long narrow rectangles instead of square tiles. |
| Separated islands | Count 8, width 25–50, height 20–45, pack extent 500×350, gutter 35, group angle −18°, fill off, outline 2 | Sparse outlined pieces. |

Min/max width and height set the seeded source population; dimension scale multiplies those sizes before packing. Turn chance swaps width and height before packing. Packing width/height, center and group angle localize the arrangement without a drawn frame. Gutter reserves room around **cores**, but an outline may extend into that room. Fill, outline and optional inner inset can change without regenerating rectangles; fill off plus zero outline draws nothing. A high requested count or overlarge dimensions can leave many unplaced rectangles; this is not a silent reduction of their sizes.

Slider intervals give practical starting values; exact entry accepts 0–96 requests, source dimensions 0.1–3000, scale 0.01–20, extent dimensions 1–1600 and gutter 0–1000. The hard 8,000,000-unit bound on 8 × count³ + count preflights skyline computation before allocating proposals.
