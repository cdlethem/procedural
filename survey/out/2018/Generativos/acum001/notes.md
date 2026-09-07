---
sketch: 2018/Generativos/acum001
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1685
animated: false
techniques: [grid, packing, subdivision]
primitives: [rect, shape]
palette:
  colors: ["#191718", "#1E4B78", "#7F9DA3", "#BAB7B0", "#C50311", "#AF1D53"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: gg, default: 20, tried: [10], change: large, effect: "halving the grid cell makes a much finer, denser mosaic; checkers and extruded blocks shrink too"}
  - {name: ssMult (line 47 random(1,4)), default: 4, tried: [8], change: large, effect: "4x max square size: large flat beveled squares in horizontal bands, coarser checkers"}
  - {name: ccCheck (line 58 random(2,11)), default: 11, tried: [21], change: large, effect: "finer checker sub-grids (up to 20x20 cells): granular texture, same macro composition"}
  - {name: scatterMax (line 84 random(30,80)), default: 80, tried: [200], change: subtle, effect: "no visible macro change; a few more extruded stepped blocks"}
  - {name: extrudeMult (line 96 random(1,5)), default: 5, tried: [9], change: subtle, effect: "longer, smoother gradient ramps on the extruded blocks"}
reusable_candidates:
  - {name: rectShw, signature: "rectShw(x, y, w, h, s, shw)", note: "square with a 3-sided drop shadow (two quads per side), gives the beveled-block look"}
  - {name: getColor, signature: "getColor(v) -> color", note: "lerps between adjacent palette entries, wraps the list"}
---

## What it draws
Full-bleed mosaic of hundreds of overlapping squares in a palette of near-black,
red, magenta, steel blue and gray. Most cells carry a tiny checkered sub-grid of
2-10 squares per row; a few larger squares sit on top with a soft 3-sided drop
shadow (beveled-block look), and a handful of big squares appear extruded in
diagonal steps with smoothly lerped colors. A faint dark grid is drawn over
everything. Dominant colors: red/magenta, gray, steel blue.

## How the code works
`setup()` sizes a 960x960 P2D canvas, calls `generate()` once; `draw()` is empty
so the piece is static (line 3-12). `generate()` (line 22):
1. Background `#D5DEE3`; `noiseSeed`/`randomSeed(seed)` (line 23-26) - all
   randomness is the `seed` field, so the render is deterministic.
2. Grid pass (line 28-72): for each 20px cell, the square's x is re-rolled to a
   random grid column (`xx = random(width); xx -= xx%gg`, line 43-44) so squares
   scatter along the row but stay aligned to the grid. Size `ss = gg*random(1,4)`
   (line 47). A shadowed square via `rectShw` (line 106, two translucent quads
   per side) is drawn, then a solid `rcol()` square on top (line 50-53). With 50%
   probability the square is subdivided into a `cc x cc` checker, `cc` random
   2-10, each cell a fresh random palette color (line 55-70).
3. Faint grid overlay: 20px cells stroked `rgba(0,0,10,2)` (line 74-81).
4. Scatter pass (line 84-103): `cc = random(10, random(30,80))` big squares,
   grid-aligned, each "extruded" by stepping `vv` (random 20-80 in 0.5 steps)
   copies diagonally (`dx`,`dy` in {-1,1}) with `getColor(ic+dc*j)` lerping
   through the palette (line 98-102). This produces the stepped, gradient
   blocks.
Color choice: `rcol()` picks a uniform random palette entry (line 156-158);
`getColor` lerps adjacent entries (line 159-165). No blend modes, no shaders,
no image sources; accumulation is just z-order of later-drawn squares.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| gg_10 | `int gg = 20;` -> `int gg = 10;` | large (mean 0.2619, 0.852) | much finer, denser mosaic of tiny squares and tiny checkers; extruded gradient blocks also smaller; overall busier, more granular | variants/gg_10/frame_00001.png |
| ss_mult_8 | `float ss = gg*int(random(1, 4));` -> `... random(1, 8));` | large (mean 0.199, 0.645) | squares up to 4x bigger (160 px): large flat beveled squares stacked in horizontal bands, coarser checkers, fewer visible details | variants/ss_mult_8/frame_00001.png |
| cc_check_21 | `int cc = int(random(2, 11));` -> `... random(2, 21));` | large (mean 0.2695, 0.844) | same scale and composition as baseline but checker sub-grids go up to 20x20 cells: clearly finer, more granular texture | variants/cc_check_21/frame_00001.png |
| scatter_200 | `int cc = int(random(10, random(30, 80)));` -> `... random(30, 200)));` | subtle (mean 0.0239, 0.076) | no visible macro change vs baseline; slightly more extruded stepped blocks, mostly overlapping similar colors | variants/scatter_200/frame_00001.png |
| steps_9 | `int vv = gg*int(random(1, 5));` -> `... random(1, 9));` | subtle (mean 0.0412, 0.136) | extruded blocks step up to 2x farther: longer, smoother red/blue/gray gradient ramps, still close to baseline overall | variants/steps_9/frame_00001.png |

## Modularisation notes
- `rectShw` (beveled square with drop shadow) is generic and reusable as-is.
- The checker-subdivision pass (line 55-70) is a clean `subdivideRect(x,y,s,cc,palette)`
  candidate.
- The extruded-square pass (line 84-103) generalises to `extrudedRect(x,y,s,steps,dir,palette)`
  with a palette-lerp ramp.
- The grid pass (line 28-72) is the sketch-specific composition: re-rolling x to a
  random grid column is an oddity; a clean parameter object would hold `cell`,
  `sizeMult`, `checkerProb`, `checkerMax`, `scatterCount`, `maxSteps`, and the
  palette.
