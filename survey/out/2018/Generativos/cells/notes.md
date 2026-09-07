---
sketch: 2018/Generativos/cells
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2080
animated: false
techniques: [packing, dots-stippling, distortion]
primitives: [shape]
palette:
  colors: ["#121435", "#FAF9F0", "#EDEBCA", "#FF5722"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 1000, tried: [250, 3000], change: large, effect: "fewer = separated soft disks with visible dark cores and more background showing; more = denser, busier, stronger dark navy smudges"}
  - {name: maxsize, default: 0.4, tried: [0.15], change: large, effect: "smaller max blob size turns the field into small soft dots over a visible cream background"}
  - {name: alphaMax, default: 250, tried: [80], change: moderate, effect: "same composition but paler, lower-contrast, washed-out"}
  - {name: palette, default: ["#121435", "#FAF9F0", "#EDEBCA", "#FF5722"], tried: ["#0D1B2A", "#E0E1DD", "#1B9AAA", "#776DAF"], change: large, effect: "identical structure recolored to cool teal/purple/gray-blue"}

## What it draws
A full-bleed, soft-focus field of overlapping blobs that look like out-of-focus
bokeh or watercolor cells. Dominant orange-red masses merge into large patches,
broken up by dark navy smudges and off-white/cream cloud shapes; the edges of
every blob dissolve into the background so no hard outline is visible. A
scattering of tiny crisp dots sits on top.

## How the code works
Static one-shot sketch: `setup()` -> `generate()` (line 8); `draw()` is empty, so
frames 1/10/60 are identical. `generate()` (line 22) fills the background with one
random palette color (line 23), then loops 1000 times (line 26): each iteration
picks a random position and a size `s = width*random(0.4)` (line 29) and calls
`arc2(x, y, 0, s, 0, TWO_PI, rcol(), random(250), 0)` (line 31). `arc2` (line 82)
subdivides the full circle into `cc ≈ PI * r2` wedge quads; each quad's inner
pair of vertices (at r1=0, i.e. the center) is filled with the color at a random
alpha `shd1` up to 250, and its outer pair (at r2) at alpha 0. The result is a
radial alpha ramp: opaque-ish at the center fading to transparent at the rim, so
1000 overlapping pies blend into the soft blob field. Color per blob is one of
the four hardcoded colors picked by `rcol()` (line 108); the background is drawn
from the same list. The tiny sharp dots are degenerate wedges where `cc` rounds
to 1 for very small blobs. A large commented-out block (lines 34-79) is an older
variant: non-overlapping (poisson-ish) circles filled with noise-colored 2px
stippling; it is inactive in the baseline.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_250 | `  for (int i = 0; i < 1000; i++) {` -> `  for (int i = 0; i < 250; i++) {` | large (mean 0.2235, 0.821 of px) | blobs stop merging: individual soft disks with crisp dark cores become visible, cream background shows through much more | variants/count_250/frame_00001.png |
| maxsize_015 | `    float s = width*random(0.4);` -> `    float s = width*random(0.15);` | large (mean 0.1944, 0.766 of px) | blobs shrink to small soft dots scattered over a mostly visible cream background; stipple-like field | variants/maxsize_015/frame_00001.png |
| alpha_80 | `    arc2(x, y, 0, s, 0, TWO_PI, rcol(), random(250), 0);` -> `...random(80), 0);` | moderate (mean 0.105, 0.487 of px) | same composition, but paler and lower-contrast; washed-out, background bleeds through everywhere | variants/alpha_80/frame_00001.png |
| count_3000 | `  for (int i = 0; i < 1000; i++) {` -> `  for (int i = 0; i < 3000; i++) {` | large (mean 0.1938, 0.794 of px) | denser and busier: more overlapping blobs, darker and more distinct navy smudges, less open background | variants/count_3000/frame_00001.png |
| palette_blues | `int colors[] = {#121435, #FAF9F0, #EDEBCA, #FF5722};` -> `int colors[] = {#0D1B2A, #E0E1DD, #1B9AAA, #776DAF};` | large (mean 0.1744, 0.897 of px) | identical structure recolored: cool teal, muted purple, pale gray-blue and deep navy blobs | variants/palette_blues/frame_00001.png |

## Modularisation notes
`arc2` is the reusable core: an annulus (or radial blob when r1=0) rendered as a
fan of quads with independent inner/outer alpha, giving a soft-edged disk without
blurs or shaders. Generic enough for a library as
`arc2(x, y, r1, r2, a1, a2, col, alphaInner, alphaOuter)`.
One-off art decisions: the 1000-iteration random scatter, the `random(250)`
per-blob alpha, and the fixed 4-color palette. A clean parameter object would be
`{count, sizeMax (fraction of width), alphaMax, palette[], backgroundColor}`.
The commented-out stippling loop would be a second candidate
(noise-driven color-by-noise `getColor` + per-pixel stipple), but it is dead
code in the shipped sketch.
