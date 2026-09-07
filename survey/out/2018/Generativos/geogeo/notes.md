---
sketch: 2018/Generativos/geogeo
year: 2018
renderer: P2D
size: [6500, 6500]
libraries: []
deterministic: true
ms_first_frame: 5323
animated: false
techniques: [subdivision, grid, polar]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#F8C43D", "#023390", "#6AA6E2", "#F35076", "#F6F6F6"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(w, h, iterations, minSize, splitRatio) -> Rect[]", note: "iteratively split a random rect into 4 equal quadrants until budget exhausted"}
  - {name: radialGradientAnnulus, signature: "radialGradientAnnulus(x, y, r1, r2, c1, c2, angle) -> shape", note: "annulus of segments, per-segment color lerped between two palette colors by a cosine of segment angle"}
  - {name: radialPoly, signature: "radialPoly(x, y, r, sides, angle, c1) -> shape", note: "fan of triangles from center, each face filled with a random palette color (faceted gem look)"}
---

## What it draws
Full-bleed tiling of squares in many sizes on a dark near-black navy ground (a quadtree subdivision).
Each square carries one of a few motifs: a soft two-tone radial "donut" with a dark hole in the
middle (pink/orange, pink/blue, yellow/blue, blue tones), a small faceted low-poly gem (triangle
fan, each face a different solid color, yellow/blue/pink/white), or a plain colored square with a
grid. Overlaid on every square: a faint white outline, thin grid lines (2-5 divisions), a faint
inscribed circle, an X and a + cross. Across the whole canvas are hundreds of faint thin arcs
scattered randomly. Dominant colors: deep blue, pink-red, warm yellow, off-white, on dark navy.

## How the code works
`setup()` calls `generate()` once and saves; `draw()` is empty, so the image is static
(geogeo.pde:3-14). `generate()` (line 24):
1. `background(25)` — dark navy ground.
2. Quadtree (lines 27-42): starts with one rect covering the canvas `PVector(0,0,width)`;
   `sub = int(random(100))` iterations pick a random surviving rect and, if `z/2 > 5`, replace it
   with its four quadrants. Result: a full-bleed mosaic of squares in a few size tiers.
3. Per-rect decoration (lines 44-108): white outline (alpha 10); a soft tinted square via
   `beginShape` with per-vertex `fill(rcol(),10)` (lines 50-57); an inner grid of
   `div = int(random(2,6))*2` divisions (even 2-10) with 2x2 center dots when cells > 8px
   (lines 61-68); inscribed ellipse, X diagonals, + cross (lines 69-71, 105-107), all faint
   white strokes.
4. Motif choice (lines 73-103): `rnd = int(random(2))` so only 0 or 1 occur:
   - 0 → `poly()` (line 122): fan of 3-6 triangles from the center, each face a random palette
     color, tip fixed to `c1` — the faceted gem.
   - 1 → `cgrad()` twice (line 139): two concentric annuli, each segment's color
     `lerpColor(c1,c2, 0.5+0.5*cos(segAngle + angleOffset))` — the soft two-tone radial donut.
   - 2 → horizontal colored bands, but unreachable since `random(2) < 2`.
5. Scatter (lines 110-119): 1000 random faint arcs (alpha ~12, sweep <= HALF_PI).
Color: fixed 5-color list (line 190); `rcol()` (line 191) picks uniformly at random. No noise,
no blend modes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic and reusable: the quadtree split loop (count, min size, split ratio are clean parameters);
`cgrad` radial-gradient annulus and `poly` radial-poly fan are self-contained motif functions with
obvious signatures; the per-rect "blueprint" overlay (grid + circle + X + +) is a separate
decorative pass. One-off art decisions: the specific 5-color palette, the alphas (10/4/20),
the unreachable bands branch, and the 1000-arc scatter. A clean parameter object would hold:
`{iterations, minSize, splitRatio, gridDivisions, motif: "poly"|"grad"|"bands" (or per-rect random),
palette, arcCount, arcAlpha}`.
