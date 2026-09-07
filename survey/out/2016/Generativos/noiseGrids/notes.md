---
sketch: 2016/Generativos/noiseGrids
year: 2016
renderer: JAVA2D
size: [1920, 960]
libraries: []
deterministic: true
ms_first_frame: 395
animated: false
techniques: [grid, subdivision, lines-hatching, pixel-ops, dots-stippling]
primitives: [line, rect, pixels]
palette:
  colors: ["#5725E5", "#FACA2B", "#FFFFFF", "#282828"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: step, default: 10, tried: [20], change: subtle, effect: "doubled to 20 -> coarser hatch spacing & background grid, larger speckle cells; same composition, nearly the same look"}
  - {name: noiseRects, default: 40, tried: [120], change: moderate, effect: "40->120 -> many more faint random-grey speckle patches; visibly busier, more uniformly textured field (largest change of the set)"}
  - {name: subdivisions, default: 100, tried: [200], change: subtle, effect: "100->200 -> mosaic broken into more, smaller rectangles; finer/fragmented hatch tiles, similar overall white density"}
  - {name: hatchAlpha, default: "random(40,120)", tried: ["random(100,220)"], change: subtle, effect: "random(40,120)->random(100,220) -> diagonal hatch lines slightly brighter/bolder; composition unchanged"}
  - {name: pixelGrain, default: 5, tried: [25], change: none, effect: "random(5)->random(25) -> no visible change; per-pixel jitter stays too subtle on the dark background to register"}
reusable_candidates:
  - {name: grid, signature: "grid(x, y, w, h, stp)", note: "orthogonal grid of 1-px lines at spacing stp"}
  - {name: gridDiag, signature: "gridDiag(x, y, w, h, stp, dir)", note: "45-degree diagonal hatching inside a rect, dir=0/1 chooses slope"}
  - {name: gridRect, signature: "gridRect(x, y, w, h, stp, s)", note: "rect tiled with small squares of side stp*s"}
  - {name: gridNoise, signature: "gridNoise(x, y, w, h, stp)", note: "rect tiled with random-grayscale cells (stippling)"}
  - {name: subdivideRects, signature: "subdivideRects(rects, iters, minSize) -> Rect[]", note: "recursive half-split of a rect list into a mosaic"}
  - {name: pixelGrain, signature: "noisee(n, x, y, w, h)", note: "add per-pixel brightness jitter of +/-n over a region via get/set"}
---

## What it draws
A full-bleed dark charcoal field (near-black, ~RGB 40) covered by a faint fine square
grid. Over it sits an asymmetric mosaic of rectangles; many of those rectangles are filled
with thin white diagonal hatching (lines at 45 degrees, two opposing slopes), some dense
and some sparse, giving the dominant texture. Scattered around are soft patches of faint
random-grayscale speckle (tiny squares), and the whole image carries a low-level per-pixel
brightness grain. Colour is essentially white-on-dark with random grey accents.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (frames
1/10/60 are identical). `generate()` (line 19) layers several full-bleed passes on a
`background(40)` (line 20):

1. Faint orthogonal grid (lines 36-39): `stroke(0,20)` then three `grid()` calls at
   `step`, `2*step`, `4*step` (step=10) draw the underlying square grid; alpha 20 keeps
   it barely visible.
2. One large stipple field (lines 41-43): `fill(255,50)` and a single `gridRect()` over the
   whole canvas at a random step `step*pow(2, 0..3)` with cell scale `random(0.05,0.1)`,
   laying a sparse field of small bright squares.
3. Random speckle blocks (lines 47-59): 40 iterations place a random-sized rectangle and
   call `gridNoise()`, which tiles it with cells of `fill(random(256),5)` (line 241) —
   very faint random-grey squares that read as soft patches.
4. Recursive subdivision mosaic (lines 62-90): start with two halves of the canvas, then
   100 times pick a random rect and split it into two (vertical if `rnd<0.5`, else
   horizontal), stopping splits below `step`. The resulting `Rect[]` mosaic is then
   hatched: for each rect `gridDiag()` (line 89) draws 45-degree lines with
   `stroke(255, random(40,120))` (line 88), `dir=random(0/1)` picking the slope. This is
   the main white-hatch texture.
5. Per-pixel grain (line 177): `noisee(int(random(5)), 0,0,width,height)` does a
   `get`/`set` pass adding a brightness jitter of `random(-n,n)` (n in 0..4) to every
   pixel — the fine grain over everything.

Colour: the only live fills/strokes are `background(40)`, near-black grid `stroke(0,20)`,
white `fill(255,50)` / `stroke(255, alpha)`, and random grayscale `fill(random(256),5)`.
The declared palette `cols[] = {#5725E5, #FACA2B}` (line 190) is chosen by `rcol()`
(line 192) but is only referenced inside commented-out blocks, so the live image is
white-on-dark with grey accents. No blend modes are active (`blendMode(ADD)` at line 122
is commented). Randomness enters at: step choice (line 43), speckle count/position (48-53),
subdivision choice (66-80), hatch alpha/slope (87-89), and grain (177).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| step_20 | `float step = 10;` -> `float step = 20;` | subtle | coarser diagonal-hatch spacing and background grid, larger speckle cells; composition (seed 42) unchanged, overall look nearly the same | variants/step_20/frame_00001.png |
| noiseRects_120 | `for (int i = 0; i < 40; i++) {` -> `for (int i = 0; i < 120; i++) {` | moderate | many more faint random-grey speckle patches across the field; visibly busier and more uniformly grey-textured, white hatches now over a denser noise field | variants/noiseRects_120/frame_00001.png |
| subdivisions_200 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 200; i++) {` | subtle | mosaic subdivided into more, smaller rectangles; finer, more fragmented hatch tiles but similar overall white density | variants/subdivisions_200/frame_00001.png |
| hatchAlpha_100_220 | `stroke(255, random(40, 120));` -> `stroke(255, random(100, 220));` | subtle | diagonal hatch lines a little brighter/bolder; composition and overall tone essentially unchanged | variants/hatchAlpha_100_220/frame_00001.png |
| pixelGrain_25 | `noisee(int(random(5)), 0, 0, width, height);` -> `noisee(int(random(25)), 0, 0, width, height);` | none | no visible change; raising the per-pixel jitter from random(5) to random(25) is too subtle to register on the dark background (parameter appears not to matter at this scale) | variants/pixelGrain_25/frame_00001.png |

## Modularisation notes
- `grid`, `gridDiag`, `gridRect`, `gridNoise` are already self-contained, generic
  (position + size + step) tile-drawing routines — direct library candidates, no global
  state beyond the current stroke/fill.
- The recursive subdivision (lines 62-83) is a clean "split rect list until min size"
  routine; parameterise it by iteration count and `minSize`, return the `Rect[]` so the
  caller decides what to fill each cell with.
- `noisee` (per-pixel brightness jitter) is a generic grain/distortion primitive
  (amount + region); note it is O(w*h) get/set and is the slowest pass.
- One-off art decisions: the fixed layering order (grid -> stipple -> speckle -> mosaic
  hatches -> grain), the two-step power-of-two cell sizing, the `random(40,120)` hatch
  alpha, and the choice to keep the purple/yellow `cols` palette dormant.
- A clean parameter object: `{ step, gridAlphas[], speckleCount, speckleAlpha,
  subdivisions, minSize, hatchAlphaRange, grainAmount }`.
