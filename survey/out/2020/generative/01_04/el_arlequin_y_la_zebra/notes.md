---
sketch: 2020/generative/01_04/el_arlequin_y_la_zebra
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1495
animated: false
techniques: [grid, distortion, symmetry]
primitives: [shape]
palette:
  colors: ["#E6D8B6", "#D52106", "#287D87", "#000200"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: div, default: 32, tried: [16], change: large, effect: "coarser 16x16 checker: 2x larger squares; central lens and diamond bands unchanged in size"}
  - {name: maxDist, default: "swidth*0.4", tried: ["swidth*0.25"], change: large, effect: "smaller warp radius: lens shrinks to a smaller circle, surrounding checker stays flatter"}
  - {name: warpExponent, default: 0.65, tried: [1.5], change: large, effect: "bulge inverts to a depression: checker pulled inward and compressed into a small central circle"}
  - {name: rrectCw, default: 8, tried: [16], change: moderate, effect: "twice the diamond columns in each band: thinner, denser isometric lattice, same band footprint"}
  - {name: colors, default: ["#E6D8B6", "#D52106", "#287D87", "#000200"], tried: [["#354998", "#D0302B", "#F76684", "#FCFAEF"]], change: subtle, effect: "bands recolored dark-blue/red/pink/near-white; checkerboard untouched"}
reusable_candidates:
  - {name: radialWarp, signature: "radialWarp(x, y, cx, cy, radius, exponent) -> PVector", note: "remaps point distance from center by pow(dis/radius, exponent), leaving the outside untouched"}
  - {name: diamondLattice, signature: "diamondLattice(x, y, w, h, cols, rows, palette) -> void", note: "grid of rotated squares (diamonds) with alternating wide/narrow sizes and a 3-color checker pattern"}
---

## What it draws
A black-and-white checkerboard (32x32) on a white background. Around the center the checker
is radially bulged outward into a large circular lens, so the squares stretch into a warped
ring that flattens back into a regular checker toward the corners. Over the checker run two
vertical bands (at 25% and 75% of the width), each made of a lattice of small diamonds in
cream, red, teal and black, arranged in an isometric, brick-like 3D pattern.

## How the code works
`setup()` -> `generate()` (L21-28). `generate()` fills the background white, then loops a 32x32
grid (L53-85): each cell is a `beginShape`/`vertex` square (L72-83) filled black or white by
`((i+j)%2)*255` (L69). Every vertex goes through `dvertex` -> `def` (L207-228), which measures
the vertex's distance from the canvas center and, if it is inside `maxDist = swidth*0.4` (L217),
replaces it with `pow(dis/maxDist, 0.65)*maxDist` along the same angle (L222). Since the exponent
< 1 pushes points outward, the central region of the checker is inflated into the circular lens.
The `amp`/`amp2` variables (L67-68) are only used by commented-out rect calls.
Then a second pass (L87-93) sets `div = 8` and calls `rrect` twice at `swidth*0.25` and
`swidth*0.75` (centered on the vertical midline), size `ss*2 x ss*6` (240x720). `rrect`
(L141-205) lays out an 8x24 lattice of diamonds: each diamond is a 4-vertex shape whose half
widths alternate (`sw*1.5/sh*0.5` vs `sw*0.5/sh*1.5`, L171-174) so adjacent diamonds interlock
into the isometric brick pattern. Color comes from `getColor(v)` (L252-258), which lerps
between adjacent entries of the 4-color palette `colors[]` (L241, cream/red/teal/near-black)
with a checker-driven index 0, 1 or 2 (L177), so only the first three colors appear. Randomness
enters only through the seed (L44-45) and unused helpers; `zebra()` (L98-139, a spiral of
alternating black/white line pairs) is never called (L95 commented out). The sketch is static:
`draw()` is empty (L30-32).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_16 | `int div = 32;` -> `int div = 16;` | large (mean 0.4202, 45.2% of pixels) | coarser 16x16 checker, squares twice as big; central lens and both diamond bands same size as baseline | variants/div_16/frame_00001.png |
| maxdist_0.25 | `float maxDist = swidth*0.4;` -> `float maxDist = swidth*0.25;` | large (mean 0.2195, 33.4% of pixels) | lens shrinks to a small circle at center; surrounding checker stays flat, only a slight bulge near the lens | variants/maxdist_0.25/frame_00001.png |
| warpexp_1.5 | `dis = pow(dis/maxDist, 0.65)*maxDist;` -> `dis = pow(dis/maxDist, 1.5)*maxDist;` | large (mean 0.2389, 36.6% of pixels) | bulge inverts to a depression: checker pulled inward and compressed into a small central circle, outer checker flattened | variants/warpexp_1.5/frame_00001.png |
| rrect_cw_16 | `rrect(..., 8, 24);` -> `rrect(..., 16, 24);` (both calls) | moderate (mean 0.0642, 17.4% of pixels) | diamond bands 16 columns wide instead of 8: denser, thinner isometric lattice, same band footprint | variants/rrect_cw_16/frame_00001.png |
| palette_alt | `int colors[] = {#E6D8B6, #D52106, #287D87, #000200};` -> `{#354998, #D0302B, #F76684, #FCFAEF};` | subtle (mean 0.0371, 8.5% of pixels) | subtle: bands recolored dark blue / red / pink / near-white; checkerboard and lens unchanged | variants/palette_alt/frame_00001.png |

## Modularisation notes
- `def`/`radialWarp` (L212-228) is a clean generic primitive: a center, a radius and an exponent;
  exponent < 1 inflates, > 1 contracts. Reusable for any grid/distortion work.
- The 32x32 checker with per-vertex warping (L64-85) is the composition: a plain checker plus
  a vertex warp function. The `amp`/`amp2` lines are dead code from a removed variant.
- `rrect` (L141-205) is a self-contained lattice primitive (diamond bricks with 3-color
  checker fill); its commented blocks show earlier rect-based and orange-fill variants.
- `getColor` (L252-258) is a generic palette-lerp sampler.
- A clean parameter object would hold: grid resolution (`div`), warp radius (`maxDist` factor),
  warp exponent, band positions (fractions of width), band lattice size (`cw`/`ch`), and the
  palette list.
