---
sketch: 2020/generative/05_08/comun
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 35049
animated: false
techniques: [dots-stippling, grid, packing]
primitives: [ellipse, rect, line]
palette:
  colors: ["#131C26", "#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: minDistScatter, signature: "minDistScatter(count, minDist, w, h, sizeRange) -> PVector[]", note: "rejection-sampled scatter with minimum distance (O(n^2) loop; slow at 10k points)"}
  - {name: stackedEllipseForm, signature: "form(cx, cy, size, count, amp) -> void", note: "stacked ellipses with rim satellite + 100-dot cluster; line-166 i++/k++ infinite-loop bug must be fixed"}
---

## What it draws
The baseline render (seed 42) is effectively blank: a flat, very dark navy field
(#131C26) with no visible dots, squares, or forms. `generate()` never finished
inside the 30 s budget — the watchdog killed the sketch at frame 0 (t=35049 ms)
and the saved frame contains only the background fill, so it looks near-black.

## How the code works
- `setup()` -> `generate()` (lines 20-22); `draw()` is empty (30-34), so the
  piece is static; any keypress regenerates with a new seed (36-42).
- `generate()`: background `#131C26` (61). A 10000-point loop (66-87) does
  O(n^2) rejection sampling with minimum distance 4 (72-80) and draws 2-3 px
  dots (69, 84) in random palette colours via `rcol()` (204-206) -> a stippled
  full-bleed field.
- A 16x16 sub-grid (89-98): each 60 px cell gets a flat random-colour `rect`,
  then `form()` at the cell centre with size `dd*0.5 = 30` (96).
- One big `form()` at the centre with `size = width*0.8` (101-104).
- `form()` (119-181): `count = 20` stacked ellipses (129-137), height scaled by
  `pow(1-v1, 0.8)` (131), width modulated by a decaying `amp` (123, 134, 152);
  white stroke with random alpha (132), fill `rcol()` at alpha 250-255 (133).
  With 80% probability (147) a satellite ellipse on the rim (148), a tiny 2%
  centre dot (151), a radial line + second satellite (154-161), and a cluster
  of 100 tiny dots around the satellite (172-177).
- **Bug:** line 166 `for (int k = 0; k < points.size(); i++)` increments `i`
  instead of `k`, so whenever a point was added (80% per iteration) this loops
  forever. This is why the baseline never completes: the sketch hangs in the
  first `form()` call of the grid.
- `def()` (183-188, simplex-noise displacement) is defined but never called;
  the triangulate import and most of the toxi import are unused in the render
  path. Renderer is P3D with `DISABLE_DEPTH_TEST` (56), so layering is purely
  by draw order.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the min-distance scatter (rejection sampling; needs a spatial hash
  to scale past a few thousand points), `rcol()` random palette pick, and the
  grid-of-flat-rects background.
- One-off art decisions: the specific 10-colour palette, the stacked-ellipse
  "form" motif with rim satellites and dot clusters, the 0.8 centre size, the
  80% satellite probability.
- A clean parameter object: `{seed, dotCount, minDist, dotSize:[2,3], sub,
  formCount, amp:[1,2], ma:[0.95,1.05], satelliteP, clusterDots,
  centerSizeFrac, palette}`.
- The `k++` loop bug (line 166) must be fixed before any of this is reusable;
  `def()` is dead code (wire in or delete).
