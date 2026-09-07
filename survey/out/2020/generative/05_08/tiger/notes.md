---
sketch: 2020/generative/05_08/tiger
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1521
animated: false
techniques: [grid]
primitives: [rect, shape]
palette:
  colors: ["#CD5102", "#971C1E", "#35292F", "#CDB4C0"]
  selection: random-from-list
composition: centered
parameters:
  - {name: sep, default: 9, tried: [4], change: moderate, effect: "finer snap grid (53px cells instead of 107px); squares and vertices land on a finer lattice, composition more fragmented and off-center"}
  - {name: rectSize, default: 0.8, tried: [0.3], change: subtle, effect: "subtle: opaque squares shrink to at most ~288px, cluster becomes compact, translucent fan dominates more"}
  - {name: polyCount, default: 10, tried: [20], change: subtle, effect: "subtle: denser fan of translucent triangles; the pale pink overlap zone in the center grows lighter and wider"}
  - {name: polyAlpha, default: 255, tried: [80], change: subtle, effect: "subtle: fan drops to alpha <= 80 and becomes nearly invisible; the opaque squares read as the whole picture"}
  - {name: rectCount, default: 4, tried: [8], change: moderate, effect: "twice as many opaque squares (incl. dark plum and large brick red) filling the field; the fan is partly buried under them"}
  - {name: palette, default: "warm 4-color", tried: ["cool 6-color (#2B349E #F57E15 #ED491C #9B407D #B48DC0 #E3E8EA)"], change: large, effect: "same geometry, completely new look: lavender ground, orange/red and purple squares, pale lavender square bottom-right"}
reusable_candidates:
  - {name: gridSnap, signature: "gridSnap(x, cell) -> float", note: "snap a coordinate down to the cell grid (xx -= xx % cell)"}
  - {name: centerLerp, signature: "centerLerp(lo, hi, center, wMin, wMax) -> float", note: "lerp a random position from the extended edge band toward the canvas center by a random weight in [wMin, wMax]"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "pick a random color from a palette list"}
---

## What it draws
A dark aubergine/charcoal ground (one of the palette colors) with a cluster of large flat
squares in burnt orange and deep brick red occupying the center and center-right of the canvas.
Over the squares, a fan of sharp translucent polygons - mostly long thin triangles in orange and
pink - sweeps diagonally from the upper-left corner to the lower-right, and the overlapping
translucent fills build up lighter salmon and dusty-pink zones where they intersect. A pale
grey-pink translucent square sits at the bottom-right. The whole composition is flat, grid-
aligned, and concentrated around the center.

## How the code works
Single tab, one-shot: `setup()` calls `generate()` (line 21), `draw()` is empty (line 29), so the
image is static and deterministic (seed 42 via `noiseSeed`/`randomSeed`, lines 42-43).

1. **Ground** - `background(rcol())` (line 45) fills the canvas with a random palette color; with
   seed 42 this lands on the dark `#35292F`.
2. **Grid** - `sep = 9` (line 47) splits the 960 px canvas into 9 equal cells (`ss = width/sep`,
   line 48). Every position below is snapped down to this grid: `xx -= xx%ss` (lines 55-56, 68-69),
   which is why all rectangle corners and polygon vertices sit on a coarse 107-px lattice.
3. **Opaque squares** - loop `k = 0..3` (line 51): each square's top-left corner is a random point
   from the band `[-ss, width+2ss]` lerped toward the canvas center with a random weight in
   `[0.2, 1]` (line 52) - i.e. a "scatter with center pull" (line 53 for y). The size is
   `width * random(0.8)` (line 54): up to 768 px, so squares are huge relative to the grid.
   `fill(rcol()); rect(...)` (lines 57-58) paints them opaque in a random palette color.
4. **Translucent polygons** - `noStroke()` (line 62), loop `i = 0..9` (line 63): each shape is a
   4-vertex `beginShape`/`endShape` (lines 64, 73) whose vertices are drawn by the same
   center-pulled, grid-snapped random placement (lines 66-69). `fill(rcol(), random(255))`
   (line 70) is only set on even vertices, so each quad's fill alternates between two random
   palette colors at varying alpha; the resulting quads read as sharp overlapping triangles.
   Because they are translucent (default BLEND), overlaps mix into lighter tints.
5. **Palette** - `rcol()` (lines 92-94) picks uniformly from the 4 warm colors
   `#CD5102 #971C1E #35292F #CDB4C0` (line 88); a dozen alternative palettes are commented out
   (lines 82-91). `getColor()` (lines 100-106) is an unused lerp-based variant.
6. **Imports** - triangulate and toxi SimplexNoise (lines 1-2) are imported but never used.
   `keyPressed` (lines 32-38) re-rolls the seed; `saveImage` (line 77) is unused headless.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_4 | `int sep = 9;` -> `int sep = 4;` | moderate | finer snap lattice (53px cells); squares and polygon vertices shift onto the finer grid, composition more fragmented, fan spreads wider with sharper edge offsets | variants/sep_4/frame_00001.png |
| rectsize_0.3 | `float s = width*random(0.8);` -> `float s = width*random(0.3);` | subtle | subtle: opaque squares shrink to at most ~288 px, the cluster becomes a compact block and the translucent fan dominates the composition | variants/rectsize_0.3/frame_00001.png |
| polys_20 | `for (int i = 0; i < 10; i++) {` -> `for (int i = 0; i < 20; i++) {` | subtle | subtle: denser fan of translucent triangles; the pale-pink overlap zone center-left grows lighter and wider, edges busier | variants/polys_20/frame_00001.png |
| alpha_80 | `if (k%2 == 0)fill(rcol(), random(255));` -> `... random(80));` | subtle | subtle: fan alpha capped at 80, the translucent triangles become barely visible washes; the opaque orange/brick squares read as the whole image | variants/alpha_80/frame_00001.png |
| rects_8 | rect loop `k < 4` -> `k < 8` (whole 7-line block) | moderate | twice as many opaque squares: extra dark-plum square bottom-left and large brick-red square center; the fan is partly buried under the squares | variants/rects_8/frame_00001.png |
| palette_cool | `int colors[] = {#CD5102, #971C1E, #35292F, #CDB4C0};` -> `{#2B349E, #F57E15, #ED491C, #9B407D, #B48DC0, #E3E8EA};` | large | identical geometry, completely new look: lavender ground, orange/red and purple squares, pale lavender square at bottom right | variants/palette_cool/frame_00001.png |

Note: the first `rects_8` attempt failed with `bad_sub` (my multi-line OLD omitted line 54,
`float s = width*random(0.8);`, inside the rect loop) and was retried once with the correct
block; 7 of the 8 allowed render commands were used.

## Modularisation notes
- **Generic, library-worthy**: the "scatter with center pull" placement (random point in an
  extended edge band lerped toward the center by a random weight, then snapped to a cell grid)
  is the core generator - `centerLerp(lo, hi, center, wMin, wMax)` + `gridSnap(x, cell)`; the
  opaque-rect loop and the translucent-quad loop are just two samplers of it. `rcol(colors[])`
  is a trivial palette picker.
- **One-off art decisions**: the specific 4-color warm palette, the 4-vertex alternating-alpha
  quads (the `k%2` fill trick that makes pairs of vertices share a color), the 0.8-size factor,
  and the choice of 4 squares vs 10 quads.
- **Clean parameter object**: `{seed, cell (sep), squares: n, squareSizeMax: f, polys: n,
  polyAlpha: max, centerPull: [wMin, wMax], palette: int[]}` - everything else in the sketch is
  plumbing (settings, save, key handling).
- Experiments confirm the interesting knobs are `sep` (structure), the shape counts, and the
  palette (dominant, `large`); `polyAlpha` near zero collapses the piece to plain squares.
