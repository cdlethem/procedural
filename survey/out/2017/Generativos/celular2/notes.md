---
sketch: 2017/Generativos/celular2
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 9697
animated: false
techniques: [packing, grid]
primitives: [shape]
palette:
  colors: ["#F8CA9C", "#F8B6D9", "#EF276B", "#A14FBE", "#1D43B8"]
  selection: lerp-between
composition: full-bleed
parameters:
reusable_candidates:
  - {name: packCapsules, signature: "packCapsules(attempts, sizeMin, sizeMax, thickness) -> List<Capsule>", note: "rejection-sampling packer: propose random stadium shapes, keep only if edge-disjoint from all kept (O(n^2) polyPoly test)"}
  - {name: polyPoly, signature: "polyPoly(PVector[] a, PVector[] b) -> boolean", note: "generic polygon/polygon intersection (edge-edge lineLine + point-in-polygon containment), from poly.pde"}
  - {name: getColor, signature: "getColor(float v) -> color", note: "wrap-around lerp between adjacent palette entries for smooth palette sampling"}
---

## What it draws
A full-bleed field of scattered rounded capsule shapes ("cells" / pills) in a candy palette:
soft pink background, cells in cream, pale pink, magenta, purple, blue, and gray. Capsules
range from tiny specks to large blobs at arbitrary angles; the big blobs are visibly filled
with smaller capsules of other colors that fit in the gaps. No overlaps: every cell's outline
stays clear of its neighbors, and the gaps between cells show the background.

## How the code works
`setup()` (celular2.pde:3) calls `generate()` once; `draw()` only draws a 2px offscreen dot
(line 15), so the image is static. `generate()` (lines 28-71):

1. `background(getColor(random(colors.length*2)))` (line 31) picks the background by lerping
   between two adjacent palette entries — a pastel tint of the palette.
2. Rejection packer (lines 37-54): 100,000 attempts. Each attempt makes a `Line` (the class
   name is misleading; it's a capsule) centered at a random point with length
   `s = random(5, random(100, 600))` and thickness `ss = s*0.8` (line 80), i.e. stadium
   shapes whose half-radius is up to 40% of the length. It builds a 12-vertex polygon
   (`getPoly()`, lines 106-117: 6 points on each flat end + arc approximation via the
   angle sweep in the loop) and tests it against every already-kept capsule with
   `polyPoly()` (poly.pde:2) — edge/edge segment intersection plus a containment check.
   Non-overlapping candidates are appended; the list order is the paint order.
3. Draw loop (lines 56-70): each kept capsule is painted with `show()` (lines 89-104):
   a 20-vertex stadium outline (10 points per end, angle sweep `-PI/2..3PI/2` around each
   end-center, radius `ss*0.5`), filled with `getColor(random(colors.length))` (line 95) —
   a random wrap-around lerp between two adjacent palette colors, no stroke.
4. Because the packer keeps proposing capsules until 100k attempts and draws in keep-order,
   small capsules that slip between big ones are painted on top, producing the "cells
   inside cells" look.

Randomness: all of it (positions, sizes, angles, fills). Palette: 5 hex colors at line 138,
sampled via adjacent-lerp. The unused `line(..., c1, c2)` gradient helper (lines 120-134)
and `c1`/`c2` fields show an abandoned gradient-line idea.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the whole poly.pde collision module (`polyPoly`/`polyLine`/`lineLine`/`polyPoint`)
  is a clean, parameter-free 2D polygon-intersection utility — library-ready as-is.
- Generic: `packCapsules` — the rejection loop with a pluggable shape factory and
  overlap predicate. Its O(n^2) test is the bottleneck; a spatial hash would make it
  reusable at scale.
- One-off: the stadium/capsule shape (`Line` class), the 5-color palette, the pastel
  background trick, and the 20-vertex drawing resolution.
- Parameter object: `{attempts, sizeMin, sizeMax, thicknessRatio, palette, backgroundMode}`.
