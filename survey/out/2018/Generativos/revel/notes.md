---
sketch: 2018/Generativos/revel
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1601
animated: false
techniques: [grid, symmetry, dots-stippling]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#F8C43D", "#F35076", "#4886B6", "#023390", "#6AA6E2", "#F6F6F6"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cw, default: "random(8,30)", tried: [12], change: large, effect: "fixed 12 columns -> much wider cells; large diff also includes re-rolled random layout"}
  - {name: ch, default: "random(16,50)", tried: [24], change: large, effect: "fixed 24 rows -> short, wide cells, denser horizontal stripes"}
  - {name: sphereProb, default: 0.2, tried: [0.5], change: large, effect: "roughly twice as many blue spheres, same size distribution"}
  - {name: sizeMax, default: "width*0.3", tried: [0.6], change: moderate, effect: "spheres up to 2x bigger; large spheres dominate, canvas more covered"}
  - {name: background, default: "#F8C43D", tried: ["#023390"], change: large, effect: "dark blue ground; pink cells pop, blue spheres nearly merge into background"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, shd1, shd2) -> void", note: "polar ring of quads with two alpha bands, used as soft shadow/halo and specular highlight"}
  - {name: srect, signature: "srect(x, y, w, h, s, col, alp1, alp2) -> void", note: "four skewed translucent trapezoids around a rect, fake 3-D side walls (commented out in baseline)"}
  - {name: checkerRects, signature: "checkerRects(cw, ch, jitter) -> Rect[]", note: "checkerboard subset of a jittered grid, only (i+j) even cells kept"}
---

## What it draws
A full-bleed checkerboard of flat yellow (#F8C43D) and rose-pink (#F35076) rectangles, roughly 20x35 cells with slightly irregular cell boundaries. Scattered over it are about 20 blue (#4886B6) spheres of widely varying sizes (from a few pixels to over 200 px), each with a soft dark shadow ring behind it and a small white specular dot at the upper left. The spheres overlap both checkerboard colours and each other; some pink cells show a faintly darker lower-right half.

## How the code works
`setup()` (revel.pde:2) sizes the canvas 960x960 P2D and calls `generate()` once; `draw()` (revel.pde:10) is empty, so the image is static. `generate()` (revel.pde:32):

1. Background is painted yellow `#F8C43D` (line 33).
2. A grid of `cw = random(8,30)` columns and `ch = random(16,50)` rows (lines 35-36) is jittered: interior column positions get `random(-0.4, 0.4)` offset (line 44), so cell widths vary slightly.
4. The rect list is shuffled (line 57), so draw order is random and later rects cover earlier ones.
5. In the same loop, with probability 0.2 per rect (line 61) a blue "sphere" is drawn at a random position: `arc2` (line 66, defined line 129) paints a full polar ring of quads in black at alpha 20 as a soft shadow behind, then `ellipse` fills `#4886B6` (line 70), then two `arc2` calls (lines 72-73) paint small white alpha-10 rings at the upper left as a specular highlight. Sphere size `s = width*random(0.3)*random(1)` (line 64) has a `random*random` distribution, heavily skewed to small radii with a few large ones.
6. Each pink cell then gets a `beginShape` quad (lines 78-85): top-left half transparent, bottom-right half `fill(255,0,0,30)` — a faint red 30% tint on the lower-right half, the subtle two-tone shading of the pink squares.

Colour is fully fixed per layer (`rcol()` at line 154 is commented out at line 69). Randomness enters through grid counts (35-36), jitter (44), shuffle (57), sphere probability/position/size (61-64). The unused palette array (line 153) includes `#023390`, `#6AA6E2`, `#F6F6F6` but only the first two colours plus blue are actually used. Note: `deterministic: false` in the baseline — small frame-to-frame differences are expected.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_12 | `int cw = int(random(8, 30));` -> `int cw = 12;` | large (mean 0.1511, 0.497 of pixels) | cells visibly wider (~12 columns); note the code never calls randomSeed, so the random sphere/grid layout also re-rolled between renders | variants/cw_12/frame_00001.png |
| ch_24 | `int ch = int(random(16, 50));` -> `int ch = 24;` | large (mean 0.161, 0.518 of pixels) | ~24 rows: short, wide cells; checkerboard reads as thin horizontal pink stripes over yellow | variants/ch_24/frame_00001.png |
| prob_0.5 | `if (random(1) < 0.2) {` -> `if (random(1) < 0.5) {` | large (mean 0.1765, 0.468 of pixels) | clearly more spheres (~30+ vs ~20), same size skew; more overlap between spheres | variants/prob_0.5/frame_00001.png |
| csize_0.6 | `float s = width*random(0.3)*random(1);` -> `float s = width*random(0.6)*random(1);` | moderate (mean 0.144, 0.4 of pixels) | spheres up to ~2x larger; a few huge spheres cover much of the canvas, checkerboard still visible between them | variants/csize_0.6/frame_00001.png |
| bg_023390 | `background(#F8C43D);` -> `background(#023390);` | large (mean 0.2522, 0.43 of pixels) | dark blue ground: pink cells pop strongly, but blue spheres lose most of their contrast and only the faint shadow ring separates them from the background | variants/bg_023390/frame_00001.png |

## Modularisation notes
- Generic: `arc2` (polar quad-ring with two alpha bands) is a reusable soft-ring/shadow primitive; `srect` (skewed translucent side walls, currently commented out) is a reusable fake-3D rect; the checkerboard-rect selection (jittered grid + parity filter) is a generic composition primitive.
- One-off art decisions: the 0.2 sphere probability, the `random*random` size skew, the specific 3-colour scheme (yellow bg / pink cells / blue spheres), the 30% red tint on cell halves, and the fixed 960 canvas.
- A clean parameter object: `{grid: {cols, rows, jitter}, sphere: {prob, sizeMax, color, shadowAlpha, highlightAlpha}, cell: {fill, tintAlpha}, background}`.
