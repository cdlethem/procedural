---
sketch: 2018/Generativos/citylab
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2583
animated: false
techniques: [grid, subdivision, dots-stippling, particles]
primitives: [rect, ellipse, triangle, shape]
palette:
  colors: ["#050505", "#FFFFFF", "#1180FF", "#43B16A", "#FF5403", "#FFDD07"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: randomSubdivide, signature: "randomSubdivide(rects, iterations, maxParts) -> Rect[]", note: "iteratively pick a random rect and replace it with a random cw x ch split (grid1/grid2, lines 103-177)"}
  - {name: noiseDots, signature: "noiseDots(count, detail, sizeMin, sizeMax) -> ellipses", note: "random ellipses sized by 2-D noise (balls, lines 83-101)"}
  - {name: wobbleTrail, signature: "wobbleTrail(x, y, steps, stepX, freq, amp, squareSize) -> rotated squares", note: "100-step trail of rotated squares whose y follows cos(x*vy) (vivoritas, lines 51-81)"}
  - {name: frameStroke, signature: "srect(x, y, w, h, inset, col, a1, a2) -> quad frame", note: "four trapezoid quads forming a beveled frame around a rect (lines 228-270)"}
---

## What it draws
A full-bleed 3250x3250 mosaic of flat colored rectangles in black, white, blue, green, orange and
yellow. The rectangles form vertical bands of varying width: dense narrow strips in the middle and
wide tall columns toward the right, over a mostly white background. Thin black beveled frames
outline many rectangles. Over everything is a scatter of small colored and black dots of varying
sizes, plus a few faint wavy squiggle lines made of tiny rotated squares.

## How the code works
`setup()` (citylab.pde:2-10) seeds from `seed`, calls `generate()` once and exits; `draw()` is empty
so the piece is static. `generate()` (lines 34-49) layers five passes on a black background, all
colored by `rcol()` (lines 273-275), which picks a uniform random color from the 6-entry `colors[]`
list:

1. `grid2()` (lines 152-177): starts with one rect covering the canvas, then `sub = int(random(1000))`
   iterations pick a random rect and replace it with a random 1-5 x 1-5 split (lines 155-169).
   Each surviving rect is filled with a random palette color (lines 172-176). This is the flat
   colored mosaic layer.
2. `balls(4000)` (lines 41, 83-101): up to `cc = int(random(800, 4000))` random ellipses; each
   diameter is `map(noise(x*det+des, y*det+des), 0, 1, min, max) * ss` with `ss = random(1, 8)`
   (lines 88-94) — a noise-sized dot scatter. `noStroke()` after the first dot (line 98) leaves
   later dots strokeless.
3. `grid1()` (lines 103-150): the same subdivision routine as `grid2`, but with a bug at line 113:
   `float hh = r.x*1./ch;` uses `r.x` instead of `r.h`, so split heights grow with horizontal
   position. That is why the right side of the image shows tall vertical columns while the middle
   stays in narrow vertical strips. Each final rect gets a black stroke and random fill (lines
   125-127); with 1/10 probability it is further tiled by four triangles meeting at its center
   (lines 131-143); then three `srect()` calls (lines 146-148) draw beveled frame quads in a
   random color at low alpha (10, 30) and one in near-black (50 alpha, size 0.05 of the rect) —
   the thin black outlines visible in the image.
4. `vivoritas()` (lines 51-81): `cc = int(random(10, 90))` trails; each walks 100 steps with
   `x += vx; y += cos(x*vy)*hh` (lines 68-71) and draws a tiny rotated square of size
   `random(4)` at each step (lines 73-77). With `stroke(0, 30)` (line 53) and 4px squares on a
   3250px canvas these read as faint squiggle lines.
5. `balls(300)` (line 48): a second, sparser dot layer on top.

Randomness enters via `randomSeed(seed)` (line 37); every `random()`/`noise()` call is then
deterministic for a given seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `randomSubdivide` (grid1/grid2) is the core generic block: an iterative random quadtree-like
  subdivision with a max split of 5x5. `grid2` is the correct version; `grid1` deliberately (or by
  accident) distorts the split with `hh = r.x/ch`, producing the vertical banding — that
  distortion could be exposed as a `heightBias` parameter instead of the bug.
- `noiseDots` (balls) is a clean generic stipple pass: count, noise detail, size range, palette.
- `vivoritas` is a one-off decorative trail; `wobbleTrail` above would generalize it.
- `srect` (beveled frame) and the 4-triangle center tile (lines 131-143) are small generic
  "rect decoration" functions.
- A clean parameter object: `{subdivisions, maxSplit, dotCount1, dotCount2, dotDetail, dotSizeMax,
  trailCount, trailSquareSize, trailAlpha, palette, frameInset}` — the layer order
  (grid2, dots, grid1, trails, dots) is an art decision worth keeping as an explicit list.
